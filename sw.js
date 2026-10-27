// KALEA — l'application elle-même, disponible SANS RÉSEAU sur le web (étape 3a du plan « hors-ligne »).
// Ne concerne que le navigateur (et l'iPhone en « Ajouter à l'écran d'accueil ») : l'application Android embarque déjà ses fichiers, et ne l'enregistre pas.
//
// CE QUE FAIT CE FICHIER — et RIEN d'autre :
//   · il garde sur l'appareil la page app.html et les fichiers qu'elle charge (scripts, styles, polices, icônes, bibliothèque supabase-js) ;
//   · avec du réseau, la page est TOUJOURS relue depuis le serveur (« réseau d'abord », délai de 4 s) : une nouvelle version publiée est donc vue tout de suite ;
//   · sans réseau (ou réseau trop lent), il rend la dernière version gardée : l'application s'ouvre, et ses données viennent de la copie locale (app-18-copie-locale.js).
// JAMAIS gardé : les appels à la base (supabase.co), version.json, les autres pages du site, les envois (POST).
//
// Les scripts et styles de l'application portent un « ?v=empreinte » : une nouvelle version = une nouvelle adresse, donc « cache d'abord » est sûr pour eux.
// Les fichiers sans ?v (styles.css, kit.css, polices…) sont servis depuis la copie PUIS rafraîchis en arrière-plan.
// Retour en arrière : « Mon compte » > refuser la copie locale désinscrit ce fichier et vide ses copies ; ou changer VERSION ci-dessous (l'ancien cache est supprimé).
const VERSION = 'v1';
const CACHE = 'kalea-appli-' + VERSION;
const PAGE = 'app.html';
const DELAI_RESEAU_MS = 4000;
const EXTENSIONS = /\.(?:js|css|webmanifest|png|svg|ico|woff2?|webp|jpg|jpeg)$/i;
// Hors du site : seulement ce que app.html charge depuis l'extérieur (bibliothèque supabase-js, polices Google).
const EXTERNES = ['https://cdn.jsdelivr.net/npm/@supabase/', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

const urlPage = () => new URL(PAGE, self.location).href;
const sansRecherche = (href) => { const u = new URL(href); return u.origin + u.pathname; };

// Les adresses utiles lues dans la page : src="…" et href="…" (les liens vers d'autres pages .html sont ignorés).
function adressesDeLaPage(html) {
  const adresses = new Set();
  const re = /(?:src|href)=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) {
    let u;
    try { u = new URL(m[1], urlPage()); } catch (err) { continue; }
    const ext = EXTERNES.some((d) => u.href.startsWith(d));
    if (ext) { adresses.add(u.href); continue; }
    if (u.origin === self.location.origin && EXTENSIONS.test(u.pathname)) adresses.add(u.href);
  }
  return [...adresses];
}

async function garder(cache, href) {
  try {
    const externe = new URL(href).origin !== self.location.origin;
    const reponse = await fetch(externe ? new Request(href, { mode: 'no-cors' }) : href);
    if (reponse && (reponse.ok || reponse.type === 'opaque')) await cache.put(href, reponse);
  } catch (err) { /* hors réseau : on réessaiera à la prochaine ouverture */ }
}

// Garde tout ce que la page demande, et supprime ce qu'elle ne demande plus (anciennes versions).
async function toutGarderDepuis(html) {
  const cache = await caches.open(CACHE);
  const voulues = adressesDeLaPage(html);
  await Promise.all(voulues.map(async (u) => { if (!(await cache.match(u))) await garder(cache, u); }));
  const gardees = await cache.keys();
  const attendues = new Set([...voulues, sansRecherche(urlPage())]);
  await Promise.all(gardees.filter((r) => {
    const href = r.url;
    return !attendues.has(href) && !attendues.has(sansRecherche(href)) && new URL(href).origin === self.location.origin;
  }).map((r) => cache.delete(r)));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    try {
      const reponse = await fetch(urlPage(), { cache: 'no-store' });
      if (!reponse.ok) return;
      const cache = await caches.open(CACHE);
      await cache.put(sansRecherche(urlPage()), reponse.clone());
      await toutGarderDepuis(await reponse.text());
    } catch (err) { /* installé hors réseau : la page sera gardée à la première visite en ligne */ }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n.startsWith('kalea-appli-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

const delai = (ms) => new Promise((_, rejeter) => setTimeout(() => rejeter(new Error('délai dépassé')), ms));

// La page : réseau d'abord ; sans réseau (ou trop lent), la dernière version gardée.
async function pageReseauDabord(requete, event) {
  const cache = await caches.open(CACHE);
  const cle = sansRecherche(requete.url);
  try {
    const reponse = await Promise.race([fetch(requete), delai(DELAI_RESEAU_MS)]);
    if (reponse && reponse.ok) {
      cache.put(cle, reponse.clone());
      event.waitUntil(reponse.clone().text().then(toutGarderDepuis).catch(() => {}));
      return reponse;
    }
  } catch (err) { /* repli ci-dessous */ }
  const copie = await cache.match(cle);
  if (copie) return copie;
  return fetch(requete);          // aucune copie : le navigateur affiche son erreur habituelle
}

// Fichier versionné (?v=) : copie d'abord. Sinon : copie tout de suite, rafraîchie en arrière-plan.
async function fichierAvecCopie(requete, event, versionne) {
  const cache = await caches.open(CACHE);
  const copie = await cache.match(requete);
  if (copie && versionne) return copie;                       // adresse unique par version : rien à rafraîchir
  const maj = fetch(requete).then((reponse) => {
    if (reponse && (reponse.ok || reponse.type === 'opaque')) cache.put(requete, reponse.clone());
    return reponse;
  }).catch(() => null);
  if (copie) { event.waitUntil(maj); return copie; }          // copie tout de suite, rafraîchie en arrière-plan
  const reponse = await maj;
  return reponse || Response.error();
}

self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  const memeSite = url.origin === self.location.origin;
  if (memeSite && requete.mode === 'navigate') {
    if (url.pathname === new URL(urlPage()).pathname) event.respondWith(pageReseauDabord(requete, event));
    return;                                                    // les autres pages du site ne passent pas par ici
  }
  if (memeSite) {
    if (url.pathname.endsWith('/version.json') || !EXTENSIONS.test(url.pathname)) return;
    event.respondWith(fichierAvecCopie(requete, event, url.searchParams.has('v')));
    return;
  }
  if (EXTERNES.some((d) => requete.url.startsWith(d))) event.respondWith(fichierAvecCopie(requete, event, false));
});
