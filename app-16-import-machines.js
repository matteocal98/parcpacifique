// ── IMPORT DE MACHINES EN MASSE ─────────────────────────────────────────────────────────────────────────────────────────────────
// ÉTAPE 1 du plan « nouvelles fonctionnalités » (communication/plan-nouvelles-fonctionnalites-2026-10-27.md).
// Un client qui arrive avec 30 ou 300 machines ne doit pas les saisir une à une.
//
// PARCOURS : Machines → « Importer » (gérant) → modèle CSV ou fichier → APERÇU ligne par ligne (créées, mises à jour, ignorées, en erreur ;
// catégories à créer ; coût mensuel en plus) → import par paquets → RAPPORT (erreurs téléchargeables) → annulation possible 24 h.
//
// CÔTÉ SERVEUR (migrations/import-machines-journal-audit.sql) : la fonction `importer_machines` refait TOUS les contrôles (le navigateur ne fait
// foi de rien), isole chaque ligne, reconnaît une ligne déjà créée (identifiant fourni par l'appareil → un nouvel essai ne crée jamais de doublon),
// applique la limite de l'offre et écrit au journal d'audit (comptes seulement). `annuler_lot_import` retire un lot (24 h, sans historique).
//
// FORMAT : colonnes reconnues PAR LEUR NOM (accents et majuscules ignorés, synonymes acceptés, ordre libre, colonnes inconnues ignorées et signalées).
// SEPARATEUR : « ; », « , » ou tabulation, détecté tout seul (Excel français enregistre en « ; »). Encodage : UTF-8 ou UTF-16 (avec ou sans BOM).
//
// CRÔCHETS POUR LA SUITE (plan §2) : code interne (`external_ref`) rejouable, identifiants et lots, journal d'audit, catégories rattachées.

const IMPORT_MAX_LIGNES = 500;     // par import (au-delà : plusieurs fichiers)
const IMPORT_TAILLE_PAQUET = 100;  // lignes envoyées par appel (le serveur en accepte 200 au plus)

function importNorm(texte) {
  return String(texte ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Les colonnes. `fr` = libellé français (reconnu quelle que soit la langue de l'interface) ; `etiquette` = libellé affiché/écrit dans le modèle.
function importColonnes() {
  return [
    { cle: 'nom', fr: 'Nom', requis: true, alias: ['designation', 'machine', 'name', 'libelle', 'equipement', 'materiel', 'engin'], exemple: ['Chargeuse CAT 950', 'Pick-up chantier'] },
    { cle: 'code_interne', fr: 'Code interne', alias: ['code', 'reference', 'ref', 'n parc', 'numero de parc', 'parc', 'id interne', 'internal code', 'external ref'], exemple: ['G-14', 'V-02'] },
    { cle: 'marque', fr: 'Marque', alias: ['constructeur', 'brand', 'make'], exemple: ['CAT', 'Toyota'] },
    { cle: 'modele', fr: 'Modèle', alias: ['model'], exemple: ['950', 'Hilux'] },
    { cle: 'numero_serie', fr: 'N° de série', alias: ['numero de serie', 'n serie', 'serie', 'serial', 'serial number', 'numero serie'], exemple: ['CAT0950X12345', ''] },
    { cle: 'immatriculation', fr: 'Immatriculation', alias: ['immat', 'plaque', 'plaque d immatriculation', 'plate', 'license plate', 'licence plate'], exemple: ['', '123456 NC'] },
    { cle: 'annee', fr: 'Année', alias: ['year', 'millesime', 'annee modele', 'model year'], exemple: ['2019', '2021'] },
    { cle: 'categorie', fr: 'Catégorie', alias: ['famille', 'category', 'groupe'], exemple: ['Chargeuses', 'Véhicules légers'] },
    { cle: 'type', fr: 'Type', alias: ['genre', 'kind', 'nature'], exemple: ['machine', 'véhicule'] },
    { cle: 'statut', fr: 'Statut', alias: ['etat', 'status'], exemple: ['en service', 'en service'] },
    { cle: 'compteur', fr: 'Compteur actuel', alias: ['compteur', 'heures', 'kilometrage', 'km', 'releve', 'counter', 'current counter', 'hours', 'mileage'], exemple: ['1250', '54000'] },
    { cle: 'unite_compteur', fr: 'Unité du compteur', alias: ['unite compteur', 'unite', 'unit', 'counter unit'], exemple: ['heures', 'km'] },
    { cle: 'date_mise_en_service', fr: 'Date de mise en service', alias: ['mise en service', 'date mise en service', 'service date', 'in service date'], exemple: ['2020-03-01', '2022-06-15'] },
    { cle: 'prix_achat', fr: "Prix d'achat", alias: ['prix achat', 'prix', 'purchase price', 'price'], exemple: ['85000', '4200000'] },
    { cle: 'date_achat', fr: "Date d'achat", alias: ['date achat', 'purchase date'], exemple: ['2020-02-10', '2022-06-01'] },
  ].map((c) => ({ ...c, etiquette: trad(c.fr) }));
}
function importAliasDe(def) {
  return [importNorm(def.fr), importNorm(def.etiquette), ...def.alias];
}

// ── Lecture du CSV : séparateur détecté, guillemets, retours à la ligne dans un champ ──
function importParserCsv(texte) {
  const t = String(texte || '').replace(/^﻿/, '');
  const premiere = t.split(/\r\n|\r|\n/, 1)[0] || '';
  const compte = { ';': 0, ',': 0, '\t': 0 };
  let dansGuillemets = false;
  for (const c of premiere) {
    if (c === '"') dansGuillemets = !dansGuillemets;
    else if (!dansGuillemets && c in compte) compte[c]++;
  }
  const meilleur = Object.entries(compte).sort((a, b) => b[1] - a[1])[0];
  const sep = meilleur[1] > 0 ? meilleur[0] : ',';

  const lignes = [];
  let ligne = [];
  let champ = '';
  dansGuillemets = false;
  const finLigne = () => {
    ligne.push(champ);
    champ = '';
    if (ligne.some((c) => String(c).trim() !== '')) lignes.push(ligne);   // lignes entièrement vides ignorées
    ligne = [];
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (t[i + 1] === '"') { champ += '"'; i++; } else dansGuillemets = false;
      } else champ += c;
    } else if (c === '"') {
      dansGuillemets = true;
    } else if (c === sep) {
      ligne.push(champ);
      champ = '';
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      finLigne();
    } else {
      champ += c;
    }
  }
  if (champ !== '' || ligne.length) finLigne();
  return lignes;
}

// Date lisible : AAAA-MM-JJ (ou JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA ; année sur 2 chiffres acceptée). Jamais d'interprétation américaine MM/JJ.
function importDate(texte) {
  const s = String(texte ?? '').trim();
  if (!s) return { vide: true };
  let a; let mo; let j;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) { a = Number(m[1]); mo = Number(m[2]); j = Number(m[3]); }
  else {
    m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/.exec(s);
    if (!m) return { invalide: true };
    j = Number(m[1]); mo = Number(m[2]); a = Number(m[3]);
    if (a < 100) a += a > 50 ? 1900 : 2000;
  }
  const d = new Date(Date.UTC(a, mo - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j || a < 1950 || a > 2100) return { invalide: true };
  return { iso: `${a}-${String(mo).padStart(2, '0')}-${String(j).padStart(2, '0')}` };
}

// Une cellule qu'on RÉÉCRIT dans un fichier téléchargé (erreurs) : jamais une formule pour Excel.
function importCelluleSure(valeur) {
  const v = String(valeur ?? '');
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
function importCsvLigne(cellules, separateur = ';') {
  return cellules.map((v) => `"${importCelluleSure(v).replace(/"/g, '""')}"`).join(separateur);
}

// ── Modèle téléchargeable ──
function importModeleCsv() {
  const defs = importColonnes();
  return [
    importCsvLigne(defs.map((d) => d.etiquette), ','),
    importCsvLigne(defs.map((d) => trad(d.exemple[0])), ','),
    importCsvLigne(defs.map((d) => trad(d.exemple[1])), ','),
  ].join('\r\n');
}
function importTelechargerModele() {
  telechargerCsv('modele_import_machines.csv', importModeleCsv());
}

// ── Analyse du fichier : une « ligne » par machine, avec ses valeurs normalisées et ses erreurs ──
function importValeurType(texte) {
  const n = importNorm(texte);
  if (!n) return { valeur: 'machine' };
  if (/^(machine|engin|materiel|equipement|outil)/.test(n)) return { valeur: 'machine' };
  if (/^(vehicule|vehicle|voiture|camion|utilitaire|auto|pick)/.test(n)) return { valeur: 'vehicle' };
  return { erreur: tR('Type inconnu (« {v} ») : machine ou véhicule.', { v: String(texte).trim() }) };
}
function importValeurStatut(texte) {
  const n = importNorm(texte);
  if (!n) return { valeur: 'en_service' };
  if (/^(en service|service|actif|active|operationnel|marche|ok)/.test(n)) return { valeur: 'en_service' };
  if (/panne/.test(n)) return { valeur: 'en_panne' };
  if (/^(hors|arret|inactif|reforme|vendu)/.test(n)) return { valeur: 'hors_service' };
  return { erreur: tR('Statut inconnu (« {v} ») : en service, en panne ou hors service.', { v: String(texte).trim() }) };
}
function importValeurUnite(texte) {
  const n = importNorm(texte);
  if (!n) return { valeur: null };
  if (/^(h|hr|hrs|heure|heures|hour|hours)$/.test(n)) return { valeur: 'hours' };
  if (/^(km|kilometre|kilometres|kilometer|kilometers)$/.test(n)) return { valeur: 'km' };
  return { erreur: tR('Unité du compteur inconnue (« {v} ») : heures ou km.', { v: String(texte).trim() }) };
}

function importAnalyser(texte) {
  const lignesCsv = importParserCsv(texte);
  if (!lignesCsv.length) return { erreur: trad('Fichier vide.') };
  const entete = lignesCsv[0].map((c) => String(c ?? '').trim());
  const defs = importColonnes();
  const index = {};
  const ignorees = [];
  let uniteImplicite = null;
  entete.forEach((libelle, pos) => {
    const n = importNorm(libelle);
    if (!n) return;
    const def = defs.find((d) => !(d.cle in index) && importAliasDe(d).includes(n));
    if (!def) { ignorees.push(libelle); return; }
    index[def.cle] = pos;
    if (def.cle === 'compteur') {
      if (['km', 'kilometrage', 'mileage'].includes(n)) uniteImplicite = 'km';
      else if (['heures', 'hours'].includes(n)) uniteImplicite = 'hours';
    }
  });
  if (!('nom' in index)) {
    return { erreur: tR('Colonne « {nom} » introuvable dans la première ligne du fichier. Colonnes lues : {lues}.', { nom: defs[0].etiquette, lues: entete.filter(Boolean).join(', ') || trad('(vide)') }) };
  }
  const donnees = lignesCsv.slice(1);
  if (!donnees.length) return { erreur: trad('Le fichier ne contient que l\'en-tête : aucune machine à importer.') };
  if (donnees.length > IMPORT_MAX_LIGNES) {
    return { erreur: tR('Ce fichier contient {n} lignes : l\'import est limité à {max} lignes à la fois. Découpe-le en plusieurs fichiers.', { n: donnees.length, max: IMPORT_MAX_LIGNES }) };
  }
  const valeur = (cellules, cle) => (cle in index ? String(cellules[index[cle]] ?? '').trim() : '');
  const lignes = donnees.map((cellules, k) => {
    const erreurs = [];
    const c = { id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : null };
    c.nom = valeur(cellules, 'nom').slice(0, 200);
    if (!c.nom) erreurs.push(trad('Le nom est obligatoire.'));
    c.code_interne = valeur(cellules, 'code_interne').slice(0, 60) || null;
    c.marque = valeur(cellules, 'marque').slice(0, 120) || null;
    c.modele = valeur(cellules, 'modele').slice(0, 120) || null;
    c.numero_serie = valeur(cellules, 'numero_serie').slice(0, 60) || null;
    c.immatriculation = valeur(cellules, 'immatriculation').slice(0, 30) || null;
    c.categorie = valeur(cellules, 'categorie').slice(0, 80) || null;

    const type = importValeurType(valeur(cellules, 'type'));
    if (type.erreur) erreurs.push(type.erreur); else c.type = type.valeur;
    const statut = importValeurStatut(valeur(cellules, 'statut'));
    if (statut.erreur) erreurs.push(statut.erreur); else c.statut = statut.valeur;
    const unite = importValeurUnite(valeur(cellules, 'unite_compteur'));
    if (unite.erreur) erreurs.push(unite.erreur);

    const texteAnnee = valeur(cellules, 'annee');
    if (texteAnnee) {
      if (/^\d{4}$/.test(texteAnnee) && anneePlausible(texteAnnee)) c.annee = Number(texteAnnee);
      else erreurs.push(tR('Année invalide (« {v} »).', { v: texteAnnee }));
    }
    const texteCompteur = valeur(cellules, 'compteur');
    if (texteCompteur) {
      const n = nombreDepuisTexte(texteCompteur);
      if (n == null || n < 0 || n > 99999999) erreurs.push(tR('Compteur invalide (« {v} »).', { v: texteCompteur }));
      else c.compteur = n;
    }
    if (c.compteur != null) c.unite_compteur = unite.valeur || uniteImplicite || (c.type === 'vehicle' ? 'km' : 'hours');
    const textePrix = valeur(cellules, 'prix_achat');
    if (textePrix) {
      const n = nombreDepuisTexte(textePrix);
      if (n == null || n < 0 || n > 999999999) erreurs.push(tR('Prix d\'achat invalide (« {v} »).', { v: textePrix }));
      else c.prix_achat = n;
    }
    for (const [cle, libelle] of [['date_mise_en_service', trad('Date de mise en service')], ['date_achat', trad('Date d\'achat')]]) {
      const d = importDate(valeur(cellules, cle));
      if (d.invalide) erreurs.push(tR('{champ} invalide (« {v} ») : AAAA-MM-JJ ou JJ/MM/AAAA.', { champ: libelle, v: valeur(cellules, cle) }));
      else if (d.iso) c[cle] = d.iso;
    }
    return { n: k + 2, cellules, c, erreurs, doublonFichier: null, existant: null, action: null, message: null };
  });

  // Doublons DANS le fichier : même code interne, ou même identifiant (série / plaque) : la 2e ligne est refusée.
  const vus = new Map();
  const cleDoublon = (c) => {
    const cles = [];
    if (c.code_interne) cles.push('ref:' + c.code_interne.toLowerCase());
    const ident = c.type === 'vehicle' ? (c.immatriculation || c.numero_serie) : (c.numero_serie || c.immatriculation);
    if (ident) cles.push('id:' + ident.toLowerCase());
    return cles;
  };
  for (const l of lignes) {
    if (l.erreurs.length) continue;
    for (const cle of cleDoublon(l.c)) {
      if (vus.has(cle)) { l.doublonFichier = vus.get(cle); break; }
    }
    if (!l.doublonFichier) for (const cle of cleDoublon(l.c)) vus.set(cle, l.n);
  }

  // Doublons avec le parc DÉJÀ enregistré (aperçu : le serveur refait la vérification).
  const existantes = [...(UI.machines || []), ...(UI.machinesArchivees || [])];
  const parRef = new Map();
  const parIdent = new Map();
  for (const m of existantes) {
    if (m.external_ref) parRef.set(String(m.external_ref).trim().toLowerCase(), m);
    if (m.serial_number) parIdent.set(String(m.serial_number).trim().toLowerCase(), m);
    if (m.plate) parIdent.set(String(m.plate).trim().toLowerCase(), m);
  }
  for (const l of lignes) {
    if (l.erreurs.length || l.doublonFichier) continue;
    const ident = l.c.type === 'vehicle' ? (l.c.immatriculation || l.c.numero_serie) : (l.c.numero_serie || l.c.immatriculation);
    l.existant = (l.c.code_interne && parRef.get(l.c.code_interne.toLowerCase())) || (ident && parIdent.get(ident.toLowerCase())) || null;
  }

  // Catégories : rapprochées par nom (casse et accents ignorés) ; les manquantes seront créées après confirmation.
  const categories = new Map((UI.categories || []).map((cat) => [importNorm(cat.name), cat]));
  const aCreer = new Map();
  for (const l of lignes) {
    if (!l.c.categorie) continue;
    const trouvee = categories.get(importNorm(l.c.categorie));
    if (trouvee) l.c.categorie_id = trouvee.id;
    else if (!l.erreurs.length) aCreer.set(importNorm(l.c.categorie), l.c.categorie);
  }
  return { entete, lignes, ignorees, categoriesACreer: [...aCreer.values()] };
}

// Ce que chaque ligne deviendra, selon la politique de doublon choisie et la limite de l'offre.
function importPlanifier(analyse, politique) {
  const limite = LIMITES_OFFRES[UI.companyPlan];
  let place = limite == null ? Infinity : Math.max(0, limite - nombreMachinesComptees());
  const comptes = { creer: 0, maj: 0, ignorer: 0, erreur: 0, hors_limite: 0 };
  for (const l of analyse.lignes) {
    l.message = null;
    if (l.erreurs.length) { l.action = 'erreur'; l.message = l.erreurs.join(' '); }
    else if (l.doublonFichier) { l.action = 'erreur'; l.message = tR('Doublon : déjà présent à la ligne {n} du fichier.', { n: l.doublonFichier }); }
    else if (l.existant && politique === 'ignorer') { l.action = 'ignorer'; l.message = tR('Déjà dans ton parc : « {nom} ».', { nom: l.existant.name }); }
    else if (l.existant && politique === 'mettre_a_jour') { l.action = 'maj'; l.message = tR('Met à jour « {nom} ».', { nom: l.existant.name }); }
    else if (place <= 0) { l.action = 'hors_limite'; l.message = trad('Au-delà de la limite de ton offre.'); }
    else { l.action = 'creer'; place--; }
    comptes[l.action]++;
  }
  return comptes;
}

// ── Écran ──
function peutImporterMachines() {
  return Boolean(SCHEMA.hasImport) && UI.role === 'gerant';
}

// ── Le dernier lot reste ANNULABLE pendant 24 h, même après avoir fermé la fenêtre ──
// On retient seulement l'identifiant du lot et le nombre de machines créées (sur cet appareil). Le SERVEUR décide de ce qui est retiré
// (annuler_lot_import : moins de 24 h, sans intervention ni panne) : cette mémoire ne donne aucun droit, elle évite seulement de perdre le lien.
const IMPORT_DUREE_ANNULATION_MS = 24 * 3600 * 1000;
function importCleDernierLot() { return `kalea.dernier-import.${UI.companyId}`; }
function importMemoriserLot(lot, crees) {
  try { localStorage.setItem(importCleDernierLot(), JSON.stringify({ lot, at: Date.now(), crees })); } catch (err) { /* sans conséquence */ }
}
function importOublierLot() {
  try { localStorage.removeItem(importCleDernierLot()); } catch (err) { /* sans conséquence */ }
}
function importDernierLot() {
  try {
    const v = JSON.parse(localStorage.getItem(importCleDernierLot()) || 'null');
    if (!v || !v.lot) return null;
    if (Date.now() - Number(v.at) > IMPORT_DUREE_ANNULATION_MS) { importOublierLot(); return null; }
    return v;
  } catch (err) { return null; }
}

// Annule un lot (confirmation incluse). Renvoie { fait, supprimees, conservees } ou { fait: false }.
async function importAnnulerLot(lot) {
  if (!window.confirm(trad('Annuler cet import ? Les machines créées par ce lot (sans intervention ni panne) seront supprimées définitivement.'))) return { fait: false, annule: true };
  const { data, error } = await sb.rpc('annuler_lot_import', { p_lot: lot });
  if (error) return { fait: false };
  importOublierLot();
  synchroniserMachinesStripe();
  Promise.resolve(boot()).catch(() => {});
  return { fait: true, supprimees: data.supprimees, conservees: data.conservees };
}

// Bandeau de la page Machines : visible 24 h après un import, jusqu'à ce qu'on l'annule ou le masque.
function importBandeauHtml() {
  if (!peutImporterMachines()) return '';
  const d = importDernierLot();
  if (!d) return '';
  return `<div class="ui-encadre" id="imp-bandeau">${picto('info')}<div>
    <p>${tR('Import récent : {n} machine(s) créée(s). Tu peux l\'annuler pendant 24 heures (seules les machines sans intervention ni panne sont retirées).', { n: d.crees })}</p>
    <div class="import-bandeau-boutons">
      <button type="button" class="ui-btn ui-btn-pastille is-danger" id="imp-annuler-dernier">${trad('Annuler cet import')}</button>
      <button type="button" class="ui-btn ui-btn-pastille" id="imp-masquer">${trad('Masquer')}</button>
    </div>
    <p class="ui-aide" id="imp-bandeau-msg" role="status" aria-live="polite"></p>
  </div></div>`;
}
function importBrancherBandeau(root) {
  const bandeau = root.querySelector('#imp-bandeau');
  if (!bandeau) return;
  const msg = bandeau.querySelector('#imp-bandeau-msg');
  bandeau.querySelector('#imp-masquer').addEventListener('click', () => { importOublierLot(); bandeau.remove(); });
  bandeau.querySelector('#imp-annuler-dernier').addEventListener('click', async (e) => {
    const d = importDernierLot();
    if (!d) { bandeau.remove(); return; }
    const bouton = e.currentTarget;
    bouton.disabled = true;
    const r = await importAnnulerLot(d.lot);
    if (r.annule) { bouton.disabled = false; return; }
    if (!r.fait) { bouton.disabled = false; msg.textContent = trad('Annulation impossible pour le moment.'); return; }
    msg.textContent = tR('{s} machine(s) supprimée(s), {c} conservée(s) (elles ont un historique).', { s: r.supprimees, c: r.conservees });
    bouton.remove();
  });
}

async function importAbonnementStripeEnCours() {
  if (estInstitution()) return false;
  try {
    const { data } = await sb.from('companies').select('stripe_subscription_id').eq('id', UI.companyId).maybeSingle();
    return Boolean(data && data.stripe_subscription_id);
  } catch (err) { return false; }
}

function importLibelleAction(action) {
  return ({
    creer: [trad('À créer'), 'is-ok'], maj: [trad('Mise à jour'), 'is-bientot'], ignorer: [trad('Ignorée'), 'is-bientot'],
    erreur: [trad('Erreur'), 'is-retard'], hors_limite: [trad('Hors limite'), 'is-retard'],
    cree: [trad('Créée'), 'is-ok'], mis_a_jour: [trad('Mise à jour'), 'is-ok'], deja_cree: [trad('Déjà créée'), 'is-ok'],
  })[action] || [esc(action), ''];
}

function ouvrirImportMachines() {
  if (!peutImporterMachines()) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay import-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay && !etat.enCours) overlay.remove(); });

  const etat = { analyse: null, politique: 'ignorer', enCours: false, lot: null, abonne: false, rapport: null };
  importAbonnementStripeEnCours().then((v) => { etat.abonne = v; if (etat.analyse) afficherApercu(); });

  const coquille = (corps, pied) => {
    overlay.innerHTML = `
      <div class="modal import-csv-modal">
        <div class="import-csv-barre"></div>
        <div class="import-csv-corps">
          <div class="import-csv-entete">
            <div class="import-csv-entete-gauche">
              <div class="import-csv-icone">${picto('boite')}</div>
              <div>
                <h2>${trad('Importer des machines')}</h2>
                <p class="import-csv-sous-titre">${trad('Charge ton parc depuis un fichier CSV (Excel, Google Sheets…)')}</p>
              </div>
            </div>
            <button type="button" class="log-close2" id="imp-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
          </div>
          ${corps}
        </div>
        <div class="import-csv-pied">${pied}</div>
      </div>`;
    overlay.querySelector('#imp-x')?.addEventListener('click', () => { if (!etat.enCours) overlay.remove(); });
  };

  // ── Étape 1 : choisir le fichier ──
  function afficherChoix(messageErreur) {
    const defs = importColonnes();
    coquille(`
      <div class="import-csv-section">
        <span class="import-csv-eyebrow">${trad('Colonnes reconnues (l\'ordre est libre, seul le nom est obligatoire)')}</span>
        <div class="import-csv-terminal">
          <div class="import-csv-terminal-code">${esc(defs.map((d) => d.etiquette + (d.requis ? ' *' : '')).join(' · '))}</div>
        </div>
      </div>
      <div class="import-csv-section">
        <span class="import-csv-eyebrow">${trad('Règles')}</span>
        <div class="import-csv-regles">
          <div class="import-csv-regle"><div class="import-csv-regle-icone is-bleu">${picto('info')}</div><div><strong>${trad('Code interne :')}</strong> ${trad('ton repère (ex. G-14). Il permet de rejouer l\'import sans créer de doublon.')}</div></div>
          <div class="import-csv-regle"><div class="import-csv-regle-icone is-vert">${picto('devise')}</div><div><strong>${trad('Dates et nombres :')}</strong> ${trad('AAAA-MM-JJ ou JJ/MM/AAAA ; virgule ou point décimal. Les prix sont dans la devise de ta société.')}</div></div>
          <div class="import-csv-regle"><div class="import-csv-regle-icone is-ambre">${picto('bientot')}</div><div><strong>${trad('Type :')}</strong> ${trad('« machine » (par défaut) ou « véhicule » ; le compteur d\'un véhicule est en km.')}</div></div>
          <div class="import-csv-regle is-accent"><div class="import-csv-regle-icone is-primaire">${picto('rafraichir')}</div><div><strong>${trad('Tu vérifies avant :')}</strong> ${tR('un aperçu montre chaque ligne, les doublons et le coût, rien n\'est créé avant ta confirmation. Jusqu\'à {max} machines par fichier.', { max: IMPORT_MAX_LIGNES })}</div></div>
        </div>
      </div>
      <div class="import-csv-section">
        <button type="button" class="import-csv-bouton-modele" id="imp-modele">${picto('export')}<span>${trad('Télécharger un modèle')}</span></button>
        <input id="imp-fichier" type="file" accept=".csv,.txt,text/csv" hidden>
        <div class="import-csv-zone" id="imp-zone">
          <div class="import-csv-zone-icone">${picto('televerser')}</div>
          <span class="import-csv-zone-nom">${trad('Choisir un fichier…')}</span>
          <span class="import-csv-zone-aide">${trad('(ou glisser le .csv ici)')}</span>
        </div>
      </div>
      <div id="imp-msg" role="status" aria-live="polite" style="color:var(--danger,#c0392b);">${messageErreur ? esc(messageErreur) : ''}</div>`,
    `<button type="button" class="ui-btn ui-btn-pastille" id="imp-annuler">${trad('Annuler')}</button>`);
    overlay.querySelector('#imp-annuler').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#imp-modele').addEventListener('click', importTelechargerModele);
    const input = overlay.querySelector('#imp-fichier');
    const zone = overlay.querySelector('#imp-zone');
    const lire = async (fichier) => {
      if (!fichier) return;
      const msg = overlay.querySelector('#imp-msg');
      msg.textContent = trad('Lecture du fichier…');
      try {
        const analyse = importAnalyser(await lireTexteFichier(fichier));
        if (analyse.erreur) { afficherChoix(analyse.erreur); return; }
        etat.analyse = analyse;
        afficherApercu();
      } catch (err) {
        afficherChoix(trad('Impossible de lire ce fichier.'));
      }
    };
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => lire(input.files && input.files[0]));
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-survol'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-survol'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('is-survol'); lire(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
  }

  // ── Étape 2 : aperçu et confirmation ──
  function blocCout(comptes) {
    const plan = String(UI.companyPlan || '').toLowerCase();
    if (!etat.abonne || comptes.creer <= 0 || INCLUSES_OFFRES[plan] == null) return '';   // pas d'abonnement ou offre sans supplément (Gratuit)
    const avant = machinesEnPlusFacturees(plan, UI.machines.length);
    const apres = machinesEnPlusFacturees(plan, UI.machines.length + comptes.creer);
    if (apres <= avant) return `<div class="ui-encadre">${picto('info')}<p>${tR('Ces {n} machine(s) restent dans les machines incluses de ton offre : aucun supplément.', { n: comptes.creer })}</p></div>`;
    const delta = montantMachinesEnPlus(plan, apres) - montantMachinesEnPlus(plan, avant);
    return `<div class="ui-encadre is-attention">${picto('alerte')}<p><strong>${tR('+ {montant} par mois', { montant: prixEuros(delta) })}</strong> — ${tR('{n} machine(s) de plus que celles incluses dans ton offre seront facturées en plus, au prorata du mois en cours, sur ta prochaine facture (après l\'import : {total} machines, dont {enPlus} en plus).', { n: apres - avant, total: UI.machines.length + comptes.creer, enPlus: apres })}</p></div>`;
  }

  function afficherApercu() {
    const a = etat.analyse;
    const comptes = importPlanifier(a, etat.politique);
    const aImporter = comptes.creer + comptes.maj;
    const doublons = a.lignes.filter((l) => l.existant).length;
    const limite = LIMITES_OFFRES[UI.companyPlan];
    const lignesHtml = a.lignes.slice(0, 80).map((l) => {
      const [libelle, classe] = importLibelleAction(l.action);
      const sous = [l.c.code_interne, l.c.marque && l.c.modele ? `${l.c.marque} ${l.c.modele}` : (l.c.marque || l.c.modele), l.c.numero_serie || l.c.immatriculation].filter(Boolean).join(' · ');
      return `<div class="ui-ligne is-deux">
        <div class="ui-ligne-id"><div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(l.c.nom || trad('(sans nom)'))}</span>
          <span class="ui-ligne-sous">${tR('Ligne {n}', { n: l.n })}${sous ? ' · ' + esc(sous) : ''}${l.message ? ' — ' + esc(l.message) : ''}</span>
        </div></div>
        <div class="ui-ligne-action"><span class="ui-statut ${classe}">${libelle}</span></div>
      </div>`;
    }).join('');
    const plus = a.lignes.length > 80 ? `<p class="ui-aide">${tR('… et {n} autres lignes (toutes sont prises en compte à l\'import).', { n: a.lignes.length - 80 })}</p>` : '';
    coquille(`
      <div class="import-resume">
        <div class="ui-tuile is-ok"><span class="ui-tuile-etiquette">${trad('À créer')}</span><span class="ui-tuile-valeur">${comptes.creer}</span></div>
        <div class="ui-tuile"><span class="ui-tuile-etiquette">${trad('À mettre à jour')}</span><span class="ui-tuile-valeur">${comptes.maj}</span></div>
        <div class="ui-tuile"><span class="ui-tuile-etiquette">${trad('Ignorées')}</span><span class="ui-tuile-valeur">${comptes.ignorer + comptes.hors_limite}</span></div>
        <div class="ui-tuile ${comptes.erreur ? 'is-retard' : ''}"><span class="ui-tuile-etiquette">${trad('En erreur')}</span><span class="ui-tuile-valeur">${comptes.erreur}</span></div>
      </div>
      ${doublons ? `
      <div class="import-csv-section">
        <span class="import-csv-eyebrow">${tR('{n} machine(s) déjà dans ton parc (même code interne, n° de série ou immatriculation)', { n: doublons })}</span>
        <div class="ui-segment" role="group" aria-label="${esc(trad('Que faire des doublons ?'))}">
          ${[['ignorer', trad('Les ignorer')], ['mettre_a_jour', trad('Les mettre à jour')], ['creer', trad('Créer quand même')]].map(([cle, nom]) => `<button type="button" data-imp-politique="${cle}" class="${etat.politique === cle ? 'is-actif' : ''}" aria-pressed="${etat.politique === cle}">${esc(nom)}</button>`).join('')}
        </div>
        <p class="ui-aide">${trad('« Mettre à jour » ne remplit que les colonnes fournies et ne touche jamais à un compteur déjà renseigné. « Créer quand même » ne passe pas si le code interne existe déjà.')}</p>
      </div>` : ''}
      ${comptes.hors_limite ? `<div class="ui-encadre is-attention">${picto('alerte')}<p>${tR('Ton offre gratuite est limitée à {limite} machines : {n} ligne(s) ne seront pas importées. Passe à une offre payante pour importer tout ton parc.', { limite, n: comptes.hors_limite })}</p></div>` : ''}
      ${blocCout(comptes)}
      ${a.categoriesACreer.length ? `<div class="ui-encadre">${picto('info')}<p><strong>${tR('{n} catégorie(s) seront créées :', { n: a.categoriesACreer.length })}</strong> ${esc(a.categoriesACreer.join(', '))}</p></div>` : ''}
      ${a.ignorees.length ? `<p class="ui-aide">${tR('Colonnes ignorées (non reconnues) : {liste}.', { liste: a.ignorees.join(', ') })}</p>` : ''}
      <div class="ui-liste import-apercu">${lignesHtml}</div>${plus}
      <div id="imp-msg" role="status" aria-live="polite"></div>`,
    `<button type="button" class="ui-btn ui-btn-pastille" id="imp-retour">${trad('Choisir un autre fichier')}</button>
     <button type="button" class="primary" id="imp-go" ${aImporter ? '' : 'disabled'}>${picto('coche')}<span>${aImporter ? tR('Importer {n} machine(s)', { n: aImporter }) : trad('Rien à importer')}</span></button>`);
    overlay.querySelector('#imp-retour').addEventListener('click', () => afficherChoix());
    overlay.querySelectorAll('[data-imp-politique]').forEach((b) => b.addEventListener('click', () => { etat.politique = b.getAttribute('data-imp-politique'); afficherApercu(); }));
    overlay.querySelector('#imp-go').addEventListener('click', lancerImport);
  }

  // ── Étape 3 : import par paquets ──
  async function lancerImport() {
    const a = etat.analyse;
    importPlanifier(a, etat.politique);
    const aEnvoyer = a.lignes.filter((l) => l.action === 'creer' || l.action === 'maj');
    if (!aEnvoyer.length) return;
    etat.enCours = true;
    etat.lot = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : null;
    coquille(`
      <div class="import-csv-section">
        <p class="ui-aide" id="imp-progres" role="status" aria-live="polite">${trad('Préparation…')}</p>
        <div class="import-barre-progres"><div id="imp-barre" style="width:0%"></div></div>
        <p class="ui-aide">${trad('Ne ferme pas cette fenêtre avant la fin.')}</p>
      </div>`, '');
    const progres = overlay.querySelector('#imp-progres');
    const barre = overlay.querySelector('#imp-barre');
    const maj = (fait) => { progres.textContent = tR('Import en cours… {fait} / {total}', { fait, total: aEnvoyer.length }); barre.style.width = `${Math.round((fait / aEnvoyer.length) * 100)}%`; };

    // 1. catégories manquantes (confirmées à l'écran précédent)
    const echecCategories = new Set();
    for (const nom of a.categoriesACreer) {
      progres.textContent = tR('Création de la catégorie « {nom} »…', { nom });
      let id = null;
      try {
        const { data, error } = await sb.from('machine_categories').insert({ company_id: UI.companyId, name: nom }).select('id, name').single();
        if (error) throw error;
        id = data.id;
        UI.categories = [...(UI.categories || []), data];
      } catch (err) {
        // elle existe peut-être déjà sans que l'écran le sache : on la relit
        const { data } = await sb.from('machine_categories').select('id, name').eq('company_id', UI.companyId).ilike('name', nom.replace(/[%_]/g, '')).limit(1);
        if (data && data[0]) id = data[0].id;
      }
      if (id) a.lignes.forEach((l) => { if (l.c.categorie && importNorm(l.c.categorie) === importNorm(nom)) l.c.categorie_id = id; });
      else echecCategories.add(importNorm(nom));
    }

    // 2. paquets
    const resultats = new Map();   // numéro de ligne → { statut, message }
    const charge = (l) => ({
      id: l.c.id, nom: l.c.nom, code_interne: l.c.code_interne, marque: l.c.marque, modele: l.c.modele, numero_serie: l.c.numero_serie,
      immatriculation: l.c.immatriculation, annee: l.c.annee ?? null, categorie_id: l.c.categorie_id || null, type: l.c.type, statut: l.c.statut,
      compteur: l.c.compteur ?? null, unite_compteur: l.c.unite_compteur || null, date_mise_en_service: l.c.date_mise_en_service || null,
      prix_achat: l.c.prix_achat ?? null, date_achat: l.c.date_achat || null,
    });
    let fait = 0;
    for (let debut = 0; debut < aEnvoyer.length; debut += IMPORT_TAILLE_PAQUET) {
      const paquet = aEnvoyer.slice(debut, debut + IMPORT_TAILLE_PAQUET);
      const aSauter = paquet.filter((l) => l.c.categorie && echecCategories.has(importNorm(l.c.categorie)));
      aSauter.forEach((l) => resultats.set(l.n, { statut: 'erreur', message: tR('La catégorie « {nom} » n\'a pas pu être créée.', { nom: l.c.categorie }) }));
      const utiles = paquet.filter((l) => !aSauter.includes(l));
      let reponse = null;
      let derniereErreur = null;
      for (let essai = 1; essai <= 3 && !reponse && utiles.length; essai++) {
        try {
          const { data, error } = await sb.rpc('importer_machines', { p_lot: etat.lot, p_lignes: utiles.map(charge), p_conflit: etat.politique });
          if (error) { derniereErreur = error; if (!estErreurReseau(error)) break; await new Promise((r) => setTimeout(r, 800 * essai)); continue; }
          reponse = data;
        } catch (err) { derniereErreur = err; await new Promise((r) => setTimeout(r, 800 * essai)); }
      }
      if (reponse) {
        (reponse || []).forEach((r) => { const l = utiles[r.i - 1]; if (l) resultats.set(l.n, { statut: r.statut, message: r.message || null }); });
      } else if (utiles.length) {
        const message = derniereErreur && /Reserve au gerant/i.test(derniereErreur.message || '')
          ? trad('Réservé au gérant.')
          : trad('Réseau ou serveur indisponible : relance l\'import, les lignes déjà créées seront reconnues.');
        utiles.forEach((l) => resultats.set(l.n, { statut: 'erreur', message }));
      }
      fait += paquet.length;
      maj(fait);
    }
    etat.enCours = false;
    etat.rapport = resultats;

    const crees = [...resultats.values()].filter((r) => r.statut === 'cree' || r.statut === 'deja_cree').length;
    const majs = [...resultats.values()].filter((r) => r.statut === 'mis_a_jour').length;
    if (crees) importMemoriserLot(etat.lot, crees);   // annulable pendant 24 h, même fenêtre fermée (bandeau de la page Machines)
    if (crees || majs) {
      synchroniserMachinesStripe();      // UNE seule resynchronisation de la facturation, à la fin
      Promise.resolve(boot()).catch(() => {});
    }
    afficherRapport();
  }

  // ── Étape 4 : rapport ──
  function afficherRapport() {
    const a = etat.analyse;
    const res = etat.rapport;
    const nb = (statuts) => [...res.values()].filter((r) => statuts.includes(r.statut)).length;
    const crees = nb(['cree', 'deja_cree']);
    const majs = nb(['mis_a_jour']);
    const ignorees = nb(['ignore']) + a.lignes.filter((l) => l.action === 'ignorer').length;   // côté serveur + doublons écartés à l'aperçu
    const erreursServeur = a.lignes.filter((l) => res.get(l.n) && res.get(l.n).statut === 'erreur');
    const erreursLocales = a.lignes.filter((l) => l.action === 'erreur' || l.action === 'hors_limite');
    const erreurs = [...erreursLocales, ...erreursServeur];
    const dejaMachine = (l) => res.get(l.n);
    coquille(`
      <div class="import-resume">
        <div class="ui-tuile is-ok"><span class="ui-tuile-etiquette">${trad('Créées')}</span><span class="ui-tuile-valeur">${crees}</span></div>
        <div class="ui-tuile"><span class="ui-tuile-etiquette">${trad('Mises à jour')}</span><span class="ui-tuile-valeur">${majs}</span></div>
        <div class="ui-tuile"><span class="ui-tuile-etiquette">${trad('Ignorées')}</span><span class="ui-tuile-valeur">${ignorees}</span></div>
        <div class="ui-tuile ${erreurs.length ? 'is-retard' : ''}"><span class="ui-tuile-etiquette">${trad('En erreur')}</span><span class="ui-tuile-valeur">${erreurs.length}</span></div>
      </div>
      ${crees || majs ? `<div class="ui-encadre">${picto('coche')}<p>${trad('Import terminé. La facturation des machines en plus est recalculée automatiquement.')}</p></div>` : ''}
      ${erreurs.length ? `
      <div class="import-csv-section">
        <span class="import-csv-eyebrow">${tR('{n} ligne(s) à corriger', { n: erreurs.length })}</span>
        <div class="ui-liste import-apercu">${erreurs.slice(0, 40).map((l) => `
          <div class="ui-ligne is-deux"><div class="ui-ligne-id"><div class="ui-ligne-textes">
            <span class="ui-ligne-nom">${esc(l.c.nom || trad('(sans nom)'))}</span>
            <span class="ui-ligne-sous">${tR('Ligne {n}', { n: l.n })} — ${esc((dejaMachine(l) && dejaMachine(l).message) || l.message || '')}</span>
          </div></div></div>`).join('')}</div>
        ${erreurs.length > 40 ? `<p class="ui-aide">${tR('… et {n} autres, dans le fichier des erreurs.', { n: erreurs.length - 40 })}</p>` : ''}
        <button type="button" class="ui-btn ui-btn-pastille" id="imp-erreurs">${picto('export')}<span>${trad('Télécharger les erreurs (CSV)')}</span></button>
        <p class="ui-aide">${trad('Corrige ces lignes dans le fichier téléchargé (dernière colonne : raison), puis réimporte-le : les machines déjà créées sont reconnues grâce à leur code interne ou n° de série.')}</p>
      </div>` : ''}
      ${crees ? `<div class="import-csv-section"><p class="ui-aide">${trad('Une erreur de fichier ? Tu peux annuler ce lot pendant 24 heures : seules les machines sans intervention ni panne sont retirées.')}</p></div>` : ''}
      <div id="imp-msg" role="status" aria-live="polite"></div>`,
    `${crees ? `<button type="button" class="ui-btn ui-btn-pastille is-danger" id="imp-annuler-lot">${trad('Annuler cet import')}</button>` : ''}
     <button type="button" class="primary" id="imp-fermer">${picto('coche')}<span>${trad('Terminer')}</span></button>`);
    overlay.querySelector('#imp-fermer').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#imp-erreurs')?.addEventListener('click', () => {
      const entete = [...a.entete, trad('Erreur')];
      const lignesCsv = erreurs.map((l) => importCsvLigne([...l.cellules, (dejaMachine(l) && dejaMachine(l).message) || l.message || '']));
      telechargerCsv('erreurs_import_machines.csv', [importCsvLigne(entete), ...lignesCsv].join('\r\n'));
    });
    overlay.querySelector('#imp-annuler-lot')?.addEventListener('click', async () => {
      const msg = overlay.querySelector('#imp-msg');
      const bouton = overlay.querySelector('#imp-annuler-lot');
      bouton.disabled = true;
      const r = await importAnnulerLot(etat.lot);
      if (r.annule) { bouton.disabled = false; return; }
      if (!r.fait) { bouton.disabled = false; msg.style.color = 'var(--danger,#c0392b)'; msg.textContent = trad('Annulation impossible pour le moment.'); return; }
      msg.style.color = '';
      msg.textContent = tR('{s} machine(s) supprimée(s), {c} conservée(s) (elles ont un historique).', { s: r.supprimees, c: r.conservees });
      bouton.remove();
    });
  }

  afficherChoix();
}
