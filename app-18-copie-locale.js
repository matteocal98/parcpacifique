// ── COPIE LOCALE (étape 3a du plan « hors-ligne », communication/plan-nouvelles-fonctionnalites-2026-10-27.md §5) ────────────────────────────────
// Objectif : tout ce que l'on peut LIRE avec du réseau reste lisible sans réseau, avec la date de la dernière copie. L'écriture hors-ligne est le palier 3b.
//
// DEUX CHOSES, UNE SEULE PETITE BASE (IndexedDB « kalea-copie », magasin « lignes ») :
//   1. L'INSTANTANÉ du démarrage (machines, plans, stock, kits, société, rôle…) : écrit par boot(), relu par boot() et par « voir la copie ».
//      Il vivait dans localStorage (≈ 5 Mo pour tout le site, plafond vite atteint avec un grand parc) ; il vit maintenant ici, avec un miroir en mémoire
//      pour que lireCache() reste SYNCHRONE (ses appelants n'ont pas changé). Ancienne copie localStorage : lue puis migrée une seule fois.
//   2. Les LECTURES « dernière version vue » (ordres, pannes, commandes, équipe…) : lireAvecCopie(cle, chargeur) essaie le réseau ; s'il échoue À CAUSE
//      DU RÉSEAU (jamais pour un refus du serveur), elle rend la dernière copie, ou relance l'erreur s'il n'y en a pas.
//
// RÈGLES (les mêmes que l'instantané d'origine) : la copie est un CONFORT que l'utilisateur peut refuser dans « Mon compte » (copieHorsLigneActive) ; elle
// expire au bout de 7 jours ; elle est EFFACÉE à la déconnexion ; une lecture est rangée sous la clé « société | personne | nom », jamais partagée entre deux comptes.
// Sans IndexedDB (navigation privée, vieux navigateur) : repli sur une mémoire de la session — rien ne casse, on perd seulement la copie au prochain démarrage.

const COPIE_BASE = 'kalea-copie';
const COPIE_MAGASIN = 'lignes';
const FILE_MAGASIN = 'file';                 // la FILE D'OPÉRATIONS (app-19) : actions faites sans réseau, en attente d'envoi. Jamais effacée par un nettoyage de copies.
const COPIE_INSTANTANE = 'instantane';
let __copieBase = null;                       // promesse de la base (une seule ouverture)
const __copieSecours = new Map();             // si IndexedDB est indisponible
let __instantaneMem;                          // undefined = pas encore lu ; null = aucune copie

function copieBase() {
  if (__copieBase) return __copieBase;
  __copieBase = new Promise((resolve) => {
    try {
      const idb = typeof indexedDB !== 'undefined' ? indexedDB : null;
      if (!idb) { resolve(null); return; }
      const req = idb.open(COPIE_BASE, 2);       // version 2 : ajout du magasin « file »
      req.onupgradeneeded = () => {
        const base = req.result;
        try { if (!base.objectStoreNames.contains(COPIE_MAGASIN)) base.createObjectStore(COPIE_MAGASIN); } catch (err) { /* déjà créé */ }
        try { if (!base.objectStoreNames.contains(FILE_MAGASIN)) base.createObjectStore(FILE_MAGASIN, { keyPath: 'id' }); } catch (err) { /* déjà créé */ }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch (err) { resolve(null); }
  });
  return __copieBase;
}

// Une opération sur le magasin ; résout toujours (undefined en cas d'échec) : la copie est un confort, jamais une cause d'erreur.
async function copieOperation(mode, action, magasin = COPIE_MAGASIN) {
  const base = await copieBase();
  if (!base) return { secours: true };
  return new Promise((resolve) => {
    try {
      const tx = base.transaction(magasin, mode);
      const req = action(tx.objectStore(magasin));
      tx.oncomplete = () => resolve({ ok: true, valeur: req ? req.result : undefined });
      tx.onerror = () => resolve({ ok: false });
      tx.onabort = () => resolve({ ok: false });
    } catch (err) { resolve({ ok: false }); }
  });
}
async function copieLire(cle) {
  const r = await copieOperation('readonly', (st) => st.get(cle));
  if (r.secours) return __copieSecours.get(cle);
  return r.ok ? r.valeur : undefined;
}
async function copieEcrire(cle, valeur) {
  const r = await copieOperation('readwrite', (st) => st.put(valeur, cle));
  if (r.secours) { __copieSecours.set(cle, valeur); return true; }
  return Boolean(r.ok);
}
async function copieSupprimer(cle) {
  const r = await copieOperation('readwrite', (st) => st.delete(cle));
  if (r.secours) __copieSecours.delete(cle);
}
// Les écritures lancées en arrière-plan : un effacement (déconnexion…) doit passer APRÈS elles, jamais avant, sinon une copie « fantôme » renaît.
const __copieEcritures = new Set();
function suivreEcriture(promesse) {
  __copieEcritures.add(promesse);
  promesse.finally(() => __copieEcritures.delete(promesse));
  return promesse;
}
function copieAttendreEcritures() { return Promise.all([...__copieEcritures]); }
async function copieToutEffacer() {
  await copieAttendreEcritures();
  __copieSecours.clear();
  await copieOperation('readwrite', (st) => st.clear());
}

// ── L'instantané du démarrage ──
// À appeler (await) AVANT lireCache() : remplit le miroir mémoire. Migre au passage l'ancienne copie localStorage.
async function prechargerCopie() {
  if (__instantaneMem !== undefined) return;
  const lu = await copieLire(COPIE_INSTANTANE);
  if (lu) { __instantaneMem = lu; return; }
  let ancien = null;
  try { const brut = localStorage.getItem(CACHE_CLE); ancien = brut ? JSON.parse(brut) : null; } catch (err) { ancien = null; }
  __instantaneMem = ancien;
  if (ancien) ecrireInstantane(ancien);          // migration unique vers la base locale
}
// Lecture synchrone du miroir ; avant le préchargement, on retombe sur l'ancienne copie localStorage (comportement d'origine).
function instantaneBrut() {
  if (__instantaneMem !== undefined) return __instantaneMem;
  try { const brut = localStorage.getItem(CACHE_CLE); return brut ? JSON.parse(brut) : null; } catch (err) { return null; }
}
// Écrit l'instantané : miroir tout de suite, base en arrière-plan ; si la base refuse, repli sur localStorage (comme avant).
function ecrireInstantane(instantane) {
  __instantaneMem = instantane;
  suivreEcriture(copieEcrire(COPIE_INSTANTANE, instantane)).then((ok) => {
    try {
      if (ok) localStorage.removeItem(CACHE_CLE);
      else localStorage.setItem(CACHE_CLE, JSON.stringify(instantane));
    } catch (err) { console.warn('Copie hors connexion impossible :', err && err.message); }
  });
}
// Tout effacer : l'instantané, les lectures rangées, l'ancienne copie. Déconnexion, refus de la copie, copie périmée.
function effacerToutesLesCopies() {
  __instantaneMem = null;
  try { localStorage.removeItem(CACHE_CLE); } catch (err) { /* sans conséquence */ }
  return copieToutEffacer();
}

// ── Les lectures « dernière version vue » ──
function cleCopie(nom) { return `${UI.companyId || ''}|${UI.userId || ''}|${nom}`; }

// Dit, une seule fois par session, que ce que l'on voit est une copie (le bandeau complet apparaît au prochain affichage de la coquille).
function signalerCopieAffichee(depuis) {
  if (UI.horsLigne) return;
  UI.horsLigne = { depuis };
  if (typeof showToast === 'function') showToast(tR('Hors connexion : données du {age}', { age: ageLisible(depuis) }));
}

// chargeur() : une fonction async qui lit le réseau et RENVOIE les données (ou lance l'erreur de la requête).
// Rend { data, copie } : copie vaut null quand les données sont fraîches, { depuis } quand on montre la dernière copie.
async function lireAvecCopie(nom, chargeur) {
  const cle = cleCopie(nom);
  try {
    const data = await chargeur();
    if (copieHorsLigneActive()) suivreEcriture(copieEcrire(cle, { data, savedAt: Date.now() }));   // en arrière-plan
    return { data, copie: null };
  } catch (err) {
    if (!estErreurReseau(err) || !copieHorsLigneActive()) throw err;
    const lu = await copieLire(cle);
    const perimee = !lu || typeof lu.savedAt !== 'number' || Date.now() - lu.savedAt > CACHE_DUREE_MS;
    if (perimee) throw err;
    signalerCopieAffichee(lu.savedAt);
    return { data: lu.data, copie: { depuis: lu.savedAt } };
  }
}

// ── L'application elle-même sans réseau, sur le web (sw.js à la racine du site) ──
// Inactif dans l'application Android (elle embarque déjà ses fichiers : window.Capacitor existe). La copie locale étant un confort refusable,
// la refuser (Mon compte) désinscrit aussi ce fichier et vide ses copies.
function enregistrerAppliHorsLigne() {
  try {
    if (!('serviceWorker' in navigator) || window.Capacitor) return;
    if (!copieHorsLigneActive()) { desinscrireAppliHorsLigne(); return; }
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Mode hors connexion de la page indisponible :', err && err.message));
  } catch (err) { /* sans conséquence */ }
}
async function desinscrireAppliHorsLigne() {
  try {
    if ('serviceWorker' in navigator) {
      const inscriptions = await navigator.serviceWorker.getRegistrations();
      await Promise.all(inscriptions.map((i) => i.unregister()));
    }
    if (window.caches) {
      const noms = await caches.keys();
      await Promise.all(noms.filter((n) => n.startsWith('kalea-appli-')).map((n) => caches.delete(n)));
    }
  } catch (err) { /* sans conséquence */ }
}
