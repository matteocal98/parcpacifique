/* KALEA — application (app.html) : Configuration, langues, grille tarifaire, catégories de machines, modèle de compteur, pays.
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · Configuration
 *   · Utilitaires
 *   · Langues
 *   · La grille tarifaire, telle qu'elle s'écrit à l'écran
 *   · MAJUSCULES : LA VALEUR, PAS SEULEMENT L'AFFICHAGE
 *   · CATÉGORIES DE MACHINES : LA LISTE, DISPONIBLE HORS CONNEXION
 *   · DURÉES DE VIE MOYENNES PAR TYPE DE MACHINE
 *   · ORGANES DÉFAILLANTS (Dépannage curatif) : même patron que les
 *   · Modèle « compteur » générique (heures ou kilomètres)
 *   · PAYS D'EXPLOITATION DE LA SOCIÉTÉ
 */
// ───────────────────────── début du code ─────────────────────────

// ── Configuration ─────────────────────────────────────────────
const __isPasswordRecovery = window.location.hash.includes('type=recovery');
// « Se connecter en tant que » depuis la console superviseur (admin.html) :
// un jeton à usage unique dans l'URL (jamais un mot de passe) échangé UNE
// fois contre une vraie session, voir activerModeSupport() plus bas.
const __paramsSupport = new URLSearchParams(window.location.search);
const __isModeSupport = __paramsSupport.has('mode_support');
// Lien profond depuis un QR code de machine (imprimé ou scanné dans l'appli) :
// `?qr=<id machine>`. Lu ICI, avant toute authentification, car un QR peut
// être scanné par quelqu'un pas encore connecté — la constante survit
// jusqu'à ouvrirFicheDepuisQrSiPresent() (appelée après le rendu du parc,
// voir boot()) puisqu'elle n'est capturée qu'une seule fois au chargement.
const __paramsQr = new URLSearchParams(window.location.search);
const __machineIdDepuisQr = __paramsQr.get('qr');
// Même besoin que le lien profond QR, pour une raison différente : le tap
// sur une notification push peut arriver AVANT que UI.machines soit chargé
// (lancement à froid de l'appli). Posée par wirePushEcouteurs(), résolue par
// ouvrirFicheDepuisPushSiPresent() dans boot() — jamais une deuxième logique
// de navigation, seulement une deuxième façon d'arriver à ouvrirFicheParId().
let __machineIdDepuisPushEnAttente = null;
// ⚠️ NE PAS remplacer par `Array.isArray(UI.machines)` : UI.machines vaut
// `[]` dès la déclaration de UI (bien avant tout chargement réel), donc ce
// test serait TOUJOURS vrai — un tap au lancement à froid résolvait alors
// contre un tableau encore vide et affichait « Machine introuvable » (bug
// réel, vu sur un vrai téléphone). Ce drapeau ne passe à vrai qu'une fois
// UI.machines rempli avec les VRAIES données, dans boot().
let __appPretePourPush = false;
const SUPABASE_URL = "https://tiayvmnodsbygmuemeuy.supabase.co";
const SUPABASE_KEY = "sb_publishable__D5hSUJPHa9BQVrKzN2oqA_SlmhqDRg";
// Numéro de version affiché à l'utilisateur (feuille « Plus ») — à tenir à
// jour avec le champ "version" de version.json (distinct de son champ
// "empreinte", qui sert lui au contrôle de fraîcheur, voir empreintePage()).
const APP_VERSION = "1.0.0";
const app = document.getElementById('app');

// ── Utilitaires ───────────────────────────────────────────────
// ── Langues ───────────────────────────────────────────────────
// La chaîne FRANÇAISE sert de CLÉ : trad('Ajouter une machine') renvoie la
// traduction si elle existe, et le français sinon.
//
// Ce choix a trois conséquences, toutes voulues :
//   • un dictionnaire incomplet n'affiche JAMAIS de clé technique — au pire, du
//     français, ce qui reste lisible ;
//   • ajouter une langue est purement additif : on remplit un objet, on ne
//     touche à aucun appel ;
//   • tant que le dictionnaire est vide, l'application est strictement
//     identique à ce qu'elle était — c'est ce qui rend cette étape sans risque.
//
// Les dictionnaires sont écrits par `signal/i18n.mjs` entre les deux marques
// ci-dessous : c'est le SEUL endroit à remplir pour une nouvelle langue.
//
// Ce bloc vit dans la section « Utilitaires » et non au tout début du script :
// le harnais de test en découpe des tranches par ancres, et une fonction
// définie ailleurs lui échapperait.
const LANGUE_CLE = 'parcpacific.langue';
const LANGUES = [
  { code: 'fr', drapeau: '🇫🇷', nom: 'Français' },
  { code: 'en', drapeau: '🇬🇧', nom: 'English' },
];

// DICTIONNAIRES_DEBUT
// Icônes Material Symbols : police distante, chargée seulement au premier usage. Tant qu'elle n'est pas arrivée,
// le navigateur affiche le NOM de l'icône en toutes lettres (« close », « badge »…) pendant quelques instants.
// On lance le chargement dès le départ et on garde les icônes invisibles (voir styles.css) jusqu'à son arrivée.
(function precharger() {
  const pret = () => document.documentElement.classList.add('icones-pretes');
  if (!document.fonts || !document.fonts.load) { pret(); return; }
  const lancer = () => document.fonts.load('24px "Material Symbols Outlined"').then(pret, pret);
  if (document.readyState === 'complete') lancer(); else window.addEventListener('load', lancer);
  setTimeout(pret, 5000);
})();

// TEXTES (dictionnaire des traductions) : défini dans traductions-en.js, chargé juste avant ce script.
// DICTIONNAIRES_FIN

function langueDisponible(code) {
  return LANGUES.some((l) => l.code === code) && !!TEXTES[code];
}

// Langue de départ : celle choisie précédemment, sinon celle de l'appareil.
// Un utilisateur dont le téléphone est en anglais ne doit pas avoir à chercher
// le sélecteur pour comprendre l'écran de connexion.
function langueInitiale() {
  try {
    const choisie = localStorage.getItem(LANGUE_CLE);
    if (choisie && langueDisponible(choisie)) return choisie;
  } catch (err) { /* stockage indisponible */ }
  const appareil = (navigator.language || '').slice(0, 2).toLowerCase();
  return langueDisponible(appareil) ? appareil : 'fr';
}

// ⚠️ LA LANGUE EST ARRÊTÉE ICI, ET PAS PLUS BAS.
// Plusieurs libellés sont construits une seule fois, au chargement du script —
// libellés de navigation, titres de vues, unités de compteur : `t()` y est
// appelé à la construction des objets. Initialiser la langue à la fin du script
// les laissait donc en français pour toujours, y compris après un rechargement.
// C'est exactement ce qui s'est produit, et ce que l'utilisateur a vu.
let LANGUE = langueInitiale();

function trad(texte) {
  const table = TEXTES[LANGUE];
  if (!table) return texte;
  return Object.prototype.hasOwnProperty.call(table, texte) ? table[texte] : texte;
}

// Applique la langue partout : la fonction trad(), l'attribut lang du document
// (lecteurs d'écran et césure), et un rechargement.
//
// POURQUOI RECHARGER plutôt que re-rendre : plusieurs libellés sont construits
// UNE FOIS au chargement du script — libellés de navigation, titres de vues,
// unités de compteur — parce que t() y est appelé à la construction des objets.
// Un simple re-rendu laisserait donc ces libellés dans l'ancienne langue, et il
// faudrait traquer chaque valeur figée, aujourd'hui et à chaque ajout. Le
// rechargement garantit que TOUT repasse par t(), pour un coût nul : les
// fichiers sont embarqués dans l'application.
function changerLangue(code, options) {
  const choisie = langueDisponible(code) ? code : 'fr';
  const change = choisie !== LANGUE;
  LANGUE = choisie;
  try { localStorage.setItem(LANGUE_CLE, choisie); } catch (err) { /* sans conséquence */ }
  try { document.documentElement.lang = choisie; } catch (err) { /* document absent */ }
  if (options && options.silencieux) return;
  if (change && window.location && typeof window.location.reload === 'function') {
    // Le serveur doit connaître la langue choisie (e-mails de rappel, rapport,
    // e-mails d'authentification) : on la lui transmet AVANT de recharger, sinon
    // le rechargement interrompt la requête.
    memoriserLangueServeur(choisie).then(() => window.location.reload());
    return;
  }
  if (UI && UI.view) renderApp();
  else renderLogin();
}

// Transmet la langue choisie au serveur : dans les métadonnées de l'utilisateur
// (lues par les modèles d'e-mails d'authentification) et, pour le gérant, sur la
// société (lue par les rappels d'entretien envoyés par la fonction serveur).
// Jamais bloquant : sans réseau, sans session ou sans la migration, on ne fait
// rien et la langue reste simplement celle de l'appareil. Plafonné à 2,5 s pour
// ne pas retarder le rechargement.
async function memoriserLangueServeur(code) {
  try {
    if (typeof sb === 'undefined' || !sb) return;
    const { data } = await sb.auth.getSession();
    if (!data || !data.session) return;
    const taches = [sb.auth.updateUser({ data: { langue: code } })];
    if (typeof UI !== 'undefined' && UI && UI.role === 'gerant') {
      taches.push(sb.rpc('definir_langue_societe', { p_langue: code }));
    }
    await Promise.race([Promise.allSettled(taches), new Promise((ok) => setTimeout(ok, 2500))]);
  } catch (err) { /* sans conséquence : la langue de l'appareil reste appliquée */ }
}

// Première initialisation côté serveur pour un compte qui n'a encore jamais
// changé de langue : sans cela, la société resterait « sans langue » et ses
// e-mails partiraient en français même si l'appli est utilisée en anglais.
// Ne remplace JAMAIS une valeur déjà enregistrée (deux appareils réglés
// différemment ne doivent pas s'écraser l'un l'autre à chaque ouverture).
async function initialiserLangueServeur(session) {
  try {
    const meta = session && session.user && session.user.user_metadata;
    if (!meta || !meta.langue) await sb.auth.updateUser({ data: { langue: LANGUE } });
    if (UI.role !== 'gerant' || !UI.companyId) return;
    const { data, error } = await sb.from('companies').select('langue').eq('id', UI.companyId).maybeSingle();
    if (error || !data || data.langue) return;
    await sb.rpc('definir_langue_societe', { p_langue: LANGUE });
  } catch (err) { /* colonne absente avant migration : on ignore */ }
}

// Deux drapeaux, comme demandé. Le nom accompagne le drapeau : un drapeau est
// un pays, pas une langue, et « 🇬🇧 » seul ne dit pas « English » à tout le monde.
function basculeLangueHtml() {
  return `<div class="lang-switch" role="group" aria-label="${LANGUE === 'en' ? 'Language' : 'Langue'}">
      ${LANGUES.map((l) => `<button type="button" class="lang-btn${l.code === LANGUE ? ' is-active' : ''}"
        data-langue="${l.code}" aria-pressed="${l.code === LANGUE}" title="${esc(l.nom)}">
        <span class="lang-drapeau" aria-hidden="true">${l.drapeau}</span><span>${esc(l.nom)}</span>
      </button>`).join('')}
    </div>`;
}

// Interpolation pour les phrases construites : « échéance dans {n} jours ».
// Les chaînes purement dynamiques ne peuvent pas passer par t() au moment de
// l'extraction ; elles passent par ici, avec la phrase complète comme clé.
function tR(cle, valeurs) {
  const modele = trad(cle);
  return modele.replace(/\{(\w+)\}/g, (tout, nom) => (valeurs && nom in valeurs ? String(valeurs[nom]) : tout));
}

// Valeurs par défaut du plan « inactif » : on stocke toujours un intervalle
// cohérent dans les deux unités, même si la machine ne suit qu'un seul mode.
const FALLBACK_INTERVAL_DAYS = 90;
const FALLBACK_REMINDER_DAYS = 7;
const FALLBACK_INTERVAL_HOURS = 100;
const FALLBACK_REMINDER_HOURS = 10;

// Intervalle à proposer pour un mode donné.
//
// POURQUOI CETTE FONCTION EXISTE : sur une machine analysée en mode calendaire,
// le champ « Échéance » contenait 90 (le repli des JOURS). En basculant ensuite
// sur le compteur horaire, ce 90 restait dans le champ et partait en base comme
// « 90 heures » — alors que le carnet disait « premier entretien à 20 heures ».
// Le repli d'une unité ne doit JAMAIS servir dans l'autre.
function intervallePropose(mode, ai) {
  const valeurs = ai || {};
  if (mode === 'days') {
    const jours = Number(valeurs.days);
    return Number.isFinite(jours) && jours > 0 ? jours : FALLBACK_INTERVAL_DAYS;
  }
  const heures = Number(valeurs.hours);
  return Number.isFinite(heures) && heures > 0 ? heures : FALLBACK_INTERVAL_HOURS;
}

// Ce que l'appareil sait déjà de l'analyse en cours : les deux unités proposées
// par l'analyse, retenues sur l'élément de la modale.
function intervallesIA(overlay) {
  return { days: overlay && overlay._aiIntervalDays, hours: overlay && overlay._aiIntervalHours };
}
const HISTORY_ROWS_IN_MODAL = 50;

// Avant « REPERAGE_PAGES_MAX » : le bloc de code que découpe test-pages-utiles
// commence là, et « Mon compte » a besoin des libellés de palier plus haut.

// ── La grille tarifaire, telle qu'elle s'écrit à l'écran ──────
// CE QUE CHAQUE PALIER S'APPELLE, ET COMBIEN IL COÛTE. Les clés sont celles de
// la BASE : les quatre offres de la nouvelle grille, PLUS les clés historiques
// montrées sous leur nouveau nom. C'est une CORRESPONDANCE D'AFFICHAGE : rien
// n'est migré en base.
const OFFRES_LIBELLES = {
  free: trad('Gratuit'), starter: trad('Starter / Artisan'), business: trad('Business / Flotte'), enterprise: trad('Enterprise / Parc'),
  eco: trad('Starter / Artisan'), pro: trad('Business / Flotte'), paid: trad('Enterprise / Parc'), unlimited: trad('Enterprise / Parc'),
};
const LIBELLE_PALIER = {
  free: trad('Gratuit — 2 machines suivies'),
  starter: 'Starter / Artisan — 12 €/mois, 5 machines suivies (+ 2 € par machine, jusqu\'à 10)',
  business: 'Business / Flotte — 39 €/mois, 20 machines suivies (+ 1,50 € par machine, jusqu\'à 40) et 3 utilisateurs',
  enterprise: 'Enterprise / Parc — 79 €/mois, 40 machines incluses, puis 1 € par machine (jusqu\'à 150)',
  eco: 'Starter / Artisan — 12 €/mois, 5 machines suivies (+ 2 € par machine, jusqu\'à 10)',
  pro: 'Business / Flotte — 39 €/mois, 20 machines suivies (+ 1,50 € par machine, jusqu\'à 40) et 3 utilisateurs',
  paid: 'Enterprise / Parc — 79 €/mois, 40 machines incluses, puis 1 € par machine (jusqu\'à 150)',
  unlimited: 'Enterprise / Parc — 79 €/mois, 40 machines incluses, puis 1 € par machine (jusqu\'à 150)',
};
// LES PALIERS QUI PAIENT. « free » et « » ne paient pas ; tout le reste paie.
// C'est ce qui décide si « Mon compte » montre le bloc « Abonnement » et son
// portail de facturation — un client Enterprise ne doit pas se le voir refuser
// au seul motif qu'il n'est ni eco ni pro.
const PALIERS_PAYANTS = ['starter', 'business', 'enterprise', 'eco', 'pro', 'paid', 'unlimited'];

// Échappe une valeur destinée à du HTML (texte ou attribut entre guillemets).
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// N'autorise que les URL http(s) : bloque javascript:, data:, etc.
function safeUrl(u) {
  const s = String(u ?? '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

// Dates « AAAA-MM-JJ » traitées en heure locale : évite les décalages de fuseau.
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysIso(isoDateStr, days) {
  const [y, m, d] = String(isoDateStr).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + (Number(days) || 0));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
// Ajoute des MOIS en vraie arithmétique de calendrier : « tous les 3 mois » ne
// veut pas dire « 90 jours ». Le quantième est ramené au dernier jour du mois
// quand il n'existe pas (31 janvier + 1 mois = 28 ou 29 février).
function addMonthsIso(isoDateStr, mois) {
  const [y, m, d] = String(isoDateStr).split('-').map(Number);
  const cible = new Date(y, m - 1 + (Number(mois) || 0), 1);
  const dernierJour = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
  cible.setDate(Math.min(d, dernierJour));
  return `${cible.getFullYear()}-${String(cible.getMonth() + 1).padStart(2, '0')}-${String(cible.getDate()).padStart(2, '0')}`;
}
// Échéance d'une tâche calendaire : jours, semaines, mois ou années.
function ajouterIntervalleIso(isoDateStr, interval, unite) {
  const n = Number(interval) || 0;
  if (unite === 'mois') return addMonthsIso(isoDateStr, n);
  if (unite === 'ans') return addMonthsIso(isoDateStr, n * 12);
  return addDaysIso(isoDateStr, unite === 'semaines' ? n * 7 : n);
}
// Nombre de jours entiers entre aujourd'hui (minuit local) et la date visée.
// 0 = aujourd'hui, -1 = hier. Pas de Math.ceil : plus de « en retard » décalé.
function daysUntil(isoDateStr) {
  const [y, m, d] = String(isoDateStr).split('-').map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}
// Écart, en jours, entre deux dates ISO (isoB - isoA). 0 si l'une des deux est
// illisible ou absente : un écart inconnu ne doit jamais décaler une échéance.
function joursEntreIso(isoA, isoB) {
  const [ay, am, ad] = String(isoA || '').split('-').map(Number);
  const [by, bm, bd] = String(isoB || '').split('-').map(Number);
  if (!ay || !am || !ad || !by || !bm || !bd) return 0;
  const a = new Date(ay, am - 1, ad);
  const b = new Date(by, bm - 1, bd);
  return Math.round((b - a) / 86400000);
}

// Les items du plan viennent soit de l'analyse (objets), soit d'anciens enregistrements
// (chaînes simples) : on normalise pour ne plus perdre l'affichage.
function normalizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(it => (typeof it === 'string' ? { label: it } : (it && typeof it === 'object' ? it : null)))
    .filter(it => it && (it.label || it.frequency || it.spec || it.qty || it.note));
}

// ── MAJUSCULES : LA VALEUR, PAS SEULEMENT L'AFFICHAGE ─────────────────
// `text-transform` ne change que le RENDU : sans normalisation de la valeur, la
// base contiendrait « tondeuse » et l'écran afficherait « TONDEUSE » — deux
// vérités pour une seule machine. On normalise donc la valeur elle-même, à la
// frappe ET à l'enregistrement (voir forcerMajusculesAEnregistrement).
// `toUpperCase()` gère les accents : « tronçonneuse » → « TRONÇONNEUSE ».
function majuscules(valeur) {
  return String(valeur == null ? '' : valeur).trim().toUpperCase();
}

// ── CATÉGORIES DE MACHINES : LA LISTE, DISPONIBLE HORS CONNEXION ──────
// La liste vit en base (table `machine_categories`, déjà en place) : elle
// s'enrichit avec l'usage, sans nouvelle version de l'application. Mais un
// formulaire ne doit pas dépendre du réseau — la promesse hors connexion se casse
// exactement là, sans qu'on s'en aperçoive. On garde donc une copie LOCALE
// (localStorage) et une liste de départ embarquée : le réseau ne fait qu'ajouter.
const CLE_CATEGORIES = 'keeva-categories';
const CATEGORIE_AUTRE = 'AUTRE';
// Liste de départ : le vocabulaire courant des chantiers et des parcs.
const CATEGORIES_DEPART = [
  'TRONÇONNEUSE', 'DÉBROUSSAILLEUSE', 'TONDEUSE', 'MOTOCULTURE', 'MINI-PELLE',
  'PELLETEUSE', 'TRACTEUR', 'REMORQUE', 'VÉHICULE', 'ÉLAGUEUSE',
  'GROUPE ÉLECTROGÈNE', 'COMPRESSEUR',
  // Ajoutés le 2026-10-05 avec les durées de vie de référence (engins de chantier, véhicules, outillage).
  'MINI-CHARGEUSE', 'CHARGEUSE SUR PNEUS', 'CHARGEUSE-PELLETEUSE', 'BULLDOZER', 'COMPACTEUR', 'NIVELEUSE', 'TOMBEREAU ARTICULÉ', 'CHARIOT TÉLESCOPIQUE', 'CHARIOT ÉLÉVATEUR', 'NACELLE ÉLÉVATRICE', 'GRUE MOBILE', 'CAMION MALAXEUR', 'TRACTEUR COMPACT', 'TONDEUSE AUTOPORTÉE', 'GROUPE ÉLECTROGÈNE STATIONNAIRE', 'COMPRESSEUR À VIS', 'MOTOPOMPE', 'FOURGON / UTILITAIRE', 'PICK-UP', 'CAMION PORTEUR', 'CAMION BENNE', 'TRACTEUR ROUTIER', 'TAILLE-HAIE', 'BROYEUR', 'MINIBUS',
];

// ── DURÉES DE VIE MOYENNES PAR TYPE DE MACHINE ────────────────────────
// Table machine_type_references (lecture seule, mise à jour annuelle par nos soins) : une valeur INDICATIVE
// proposée dans le champ « Durée de vie » quand on choisit la catégorie. Le client la modifie librement.
function cleCategorie(nom) {
  return String(nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}
// La référence d'une catégorie, SEULEMENT si elle est dans l'unité du compteur (heures ou km) de la machine.
function referenceDureeVie(nomCategorie, unite) {
  if (!unite) return null;
  const cle = cleCategorie(nomCategorie);
  const ref = (UI.referencesTypes || []).find((x) => x.cle === cle);
  return ref && ref.unite === unite ? ref : null;
}
function noteReferenceDureeVie(ref) {
  const unite = ref.unite === 'km' ? 'km' : 'h';
  const source = ref.annee ? `${ref.source}, ${ref.annee}` : ref.source;
  return tR('Durée de vie estimée moyenne indicative : {valeur} {unite} ({source}) — non exhaustive, à ajuster selon ton usage.', {
    valeur: texteAvecSeparateurs(ref.duree_vie), unite, source,
  });
}
// Branche le champ « Durée de vie » d'un formulaire de machine sur les références.
// auto = true (création) : la moyenne est écrite dans le champ tant que le client n'y a rien mis de son cru.
// auto = false (fiche existante) : rien n'est écrit d'office ; un bouton « Utiliser la moyenne » est proposé.
function brancherDureeVie(overlay, auto) {
  const champ = overlay.querySelector('#f-duree-vie');
  const note = overlay.querySelector('#f-duree-vie-note');
  const etiquette = overlay.querySelector('#f-duree-vie-etiquette');
  if (!champ || !note) return;
  const contexte = () => {
    const mode = overlay.querySelector('input[name=tm]:checked')?.value || 'days';
    const unite = mode === 'days' ? null : counterUnitFromMode(mode);
    return { unite, ref: referenceDureeVie(overlay.querySelector('#f-category')?.value || '', unite) };
  };
  const maj = () => {
    const { unite, ref } = contexte();
    if (etiquette && unite) etiquette.textContent = tR('Durée de vie ({unite})', { unite: unite === 'km' ? trad('km') : trad('heures') });
    const saisie = champ.value.trim();
    const precedent = champ.dataset.defaut || '';
    note.textContent = '';
    if (!ref) {
      if (auto && precedent && saisie === precedent) champ.value = '';
      champ.dataset.defaut = '';
      return;
    }
    if (auto && (saisie === '' || saisie === precedent)) {
      champ.value = texteAvecSeparateurs(ref.duree_vie);
      champ.dataset.defaut = champ.value;
    }
    note.textContent = noteReferenceDureeVie(ref);
    if (!auto && saisie === '') {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'ui-btn ui-btn-teinte';
      bouton.style.marginLeft = '8px';
      bouton.textContent = trad('Utiliser la moyenne');
      bouton.addEventListener('click', () => { champ.value = texteAvecSeparateurs(ref.duree_vie); maj(); });
      note.appendChild(bouton);
    }
  };
  overlay.querySelector('#f-category')?.addEventListener('change', maj);
  overlay.querySelector('#f-category-autre')?.addEventListener('input', maj);
  overlay.querySelectorAll('input[name=tm]').forEach((radio) => radio.addEventListener('change', maj));
  champ.addEventListener('input', () => { if (!auto) maj(); });
  maj();
}
// Icône approchée pour une catégorie de machine (bloc « Seuils cibles de
// coût horaire », reprise Stitch phase 3) — mots-clés simples sur le nom,
// jamais une catégorie inventée : un repli générique si rien ne
// correspond, jamais une icône qui prétend à tort une correspondance
// précise (même esprit que categorieProduit(), mais pour les catégories de
// MACHINE plutôt que les tâches de carnet).
function iconeCategorieMachine(nom) {
  const n = (nom || '').toLowerCase();
  if (n.includes('débrous') || n.includes('debrous')) return 'ciseaux';
  if (n.includes('véhicul') || n.includes('vehicul') || n.includes('camion') || n.includes('utilitaire')) return 'vehicule';
  if (n.includes('tronçon') || n.includes('troncon') || n.includes('élagu') || n.includes('elagu')) return 'scie';
  if (n.includes('tondeuse') || n.includes('motocult') || n.includes('broyeur')) return 'herbe';
  if (n.includes('pelle') || n.includes('tracteur') || n.includes('remorque')) return 'parcMachine';
  if (n.includes('compresseur') || n.includes('groupe') || n.includes('électro') || n.includes('electro')) return 'reglages';
  return 'boite';
}

function categoriesLocales() {
  try {
    const brut = localStorage.getItem(CLE_CATEGORIES);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.map(majuscules).filter(Boolean) : [];
  } catch (err) {
    return [];
  }
}

// La liste proposée = départ + ce que l'appareil a déjà vu + ce que la base
// contient. Dédoublonnée sans tenir compte de la casse, et triée en français.
function categoriesUtiles(chargees) {
  const vues = new Map();
  const ajouter = (nom) => {
    const propre = majuscules(nom);
    if (!propre) return;
    const cle = propre.toLowerCase();
    if (!vues.has(cle)) vues.set(cle, propre);
  };
  CATEGORIES_DEPART.forEach(ajouter);
  categoriesLocales().forEach(ajouter);
  (Array.isArray(chargees) ? chargees : []).forEach((c) => ajouter(c && c.name ? c.name : c));
  return [...vues.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

// Retient une catégorie pour la PROCHAINE fois : c'est ce qui fait qu'une
// catégorie écrite à la main ne se réécrit pas indéfiniment.
function retenirCategorie(nom) {
  const propre = majuscules(nom);
  if (!propre) return false;
  const liste = categoriesUtiles(categoriesLocales());
  if (liste.some((c) => c.toLowerCase() === propre.toLowerCase())) return false;
  liste.push(propre);
  try { localStorage.setItem(CLE_CATEGORIES, JSON.stringify(liste)); } catch (err) { /* stockage plein : la liste de départ suffit */ }
  return true;
}

// Les options du menu déroulant. `AUTRE` ouvre la saisie libre ; la valeur de
// cette option est ensuite REMPLACÉE par le texte saisi (voir brancherCategorie),
// pour que tout le reste du code continue de lire `#f-category.value`.
function optionsCategorie(liste, choisie) {
  const valeur = majuscules(choisie);
  const connue = liste.includes(valeur);
  const options = [`<option value="" disabled${valeur ? '' : ' selected'}>${esc(trad('Choisis une catégorie'))}</option>`];
  for (const nom of liste) {
    options.push(`<option value="${esc(nom)}"${nom === valeur ? ' selected' : ''}>${esc(nom)}</option>`);
  }
  options.push(`<option value="${CATEGORIE_AUTRE}"${valeur && !connue ? ' selected' : ''}>${esc(trad('Autre…'))}</option>`);
  return options.join('');
}

function optionsCategorieListe(choisie, chargees) {
  return optionsCategorie(categoriesUtiles(chargees), choisie);
}

// ── ORGANES DÉFAILLANTS (Dépannage curatif) : même patron que les
// catégories de machine ci-dessus — liste de départ embarquée (générique,
// utile hors connexion) + mémoire locale (localStorage) + table
// `intervention_components` (company_id) pour qu'un organe tapé via
// « Autre… » se partage avec toute l'équipe, pas seulement cet appareil.
// Rendu configurable à la demande : à l'origine une taxonomie fixe à 4
// entrées, figée dans le code (voir openLogInterventionModal).
const CLE_COMPOSANTS = 'keeva-composants';
const COMPOSANT_AUTRE = 'AUTRE';
const COMPOSANTS_DEPART = [
  'Circuit hydraulique (Flexible, vérin, pompe)',
  'Moteur thermique / Injection / Refroidissement',
  'Train de roulement (Chenille, galet, barbotin)',
  'Système électrique / Démarreur / Batterie',
  'Transmission / Boîte de vitesses / Embrayage',
  'Organe de coupe (Lame, chaîne, fil, disque)',
  'Freinage (Frein, plaquettes, disques)',
  'Pneumatiques / Roues / Essieux',
  'Direction / Timonerie',
  'Carrosserie / Châssis / Structure',
];

function composantsLocaux() {
  try {
    const brut = localStorage.getItem(CLE_COMPOSANTS);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.map((s) => String(s).trim()).filter(Boolean) : [];
  } catch (err) {
    return [];
  }
}

// Départ + vu sur cet appareil + vu en base (toute l'équipe) — dédoublonné
// sans tenir compte de la casse, trié en français. Même rôle que
// categoriesUtiles(), pour un référentiel différent (pas de majuscules
// forcées ici : ce sont des libellés de description, pas des étiquettes).
function composantsUtiles(chargees) {
  const vues = new Map();
  const ajouter = (nom) => {
    const propre = String(nom || '').trim();
    if (!propre) return;
    const cle = propre.toLowerCase();
    if (!vues.has(cle)) vues.set(cle, propre);
  };
  COMPOSANTS_DEPART.forEach(ajouter);
  composantsLocaux().forEach(ajouter);
  (Array.isArray(chargees) ? chargees : []).forEach((c) => ajouter(c && c.name ? c.name : c));
  return [...vues.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

function retenirComposant(nom) {
  const propre = String(nom || '').trim();
  if (!propre) return false;
  const liste = composantsUtiles(composantsLocaux());
  if (liste.some((c) => c.toLowerCase() === propre.toLowerCase())) return false;
  liste.push(propre);
  try { localStorage.setItem(CLE_COMPOSANTS, JSON.stringify(liste)); } catch (err) { /* stockage plein : la liste de départ suffit */ }
  return true;
}

function optionsComposant(liste, choisie) {
  const valeur = String(choisie || '').trim();
  const connue = liste.includes(valeur);
  const options = [`<option value="" disabled${valeur ? '' : ' selected'}>${esc(trad('Choisis un organe'))}</option>`];
  for (const nom of liste) {
    options.push(`<option value="${esc(nom)}"${nom === valeur ? ' selected' : ''}>${esc(trad(nom))}</option>`);
  }
  options.push(`<option value="${COMPOSANT_AUTRE}"${valeur && !connue ? ' selected' : ''}>${esc(trad('Autre…'))}</option>`);
  return options.join('');
}
function optionsComposantListe(choisie, chargees) {
  return optionsComposant(composantsUtiles(chargees), choisie);
}

// Câblage « Autre… » : même trick que brancherCategorie (l'option
// sentinelle DEVIENT le texte saisi, pour que tout le reste du code
// continue de lire `#log-organe.value` sans rien changer).
function brancherComposant(overlay) {
  const select = overlay.querySelector('#log-organe');
  const autre = overlay.querySelector('#log-organe-autre');
  if (!select || !autre) return;
  const sentinelle = select.querySelector(`option[value="${COMPOSANT_AUTRE}"]`);
  const maj = () => {
    const actif = select.dataset.autre === '1';
    autre.hidden = !actif;
    if (!actif) { autre.value = ''; return; }
    const texte = autre.value.trim();
    autre.value = texte;
    if (sentinelle) {
      sentinelle.value = texte || COMPOSANT_AUTRE;
      sentinelle.textContent = texte || trad('Autre…');
    }
  };
  select.addEventListener('change', () => {
    select.dataset.autre = select.value === COMPOSANT_AUTRE ? '1' : '0';
    maj();
    if (select.dataset.autre === '1' && typeof autre.focus === 'function') autre.focus();
  });
  autre.addEventListener('input', maj);
  maj();
}

// ── Modèle « compteur » générique (heures ou kilomètres) ──────
// Schéma cible : machines.counter_unit + machines.counter_value, et sur le plan
// interval_counter / next_due_counter / reminder_counter_before, avec
// tracking_mode ∈ {days, hours, km}.
// Tant que la migration n'est pas exécutée, l'application retombe sur les
// colonnes historiques : elle fonctionne donc AVANT et APRÈS la migration.
const SCHEMA = { hasCounter: false, hasBrandModel: false, hasContactNames: false, hasKind: false, hasPlate: false, hasModelYear: false };

// Fragment `.select()` du catalogue de pièces (parts_catalog), UN SEUL
// endroit pour les 3 lectures existantes (boot, catalogue TCO, import CSV)
// — un ajout de colonne migré séparément (default_reorder_point sous
// SCHEMA.hasStock, packaging sous SCHEMA.hasStockPackaging, chacun sa
// propre sonde) ne doit jamais dépendre de ce que CHAQUE appelant se
// souvient d'ajouter. Toujours appelé APRÈS que les sondes SCHEMA aient
// tourné (boot()) — jamais au chargement du script.
function colonnesCatalogueePiece() {
  return 'id, reference, designation, unit_price, supplier_name, avg_lead_time_days'
    + (SCHEMA.hasStock ? ', default_reorder_point' : '')
    + (SCHEMA.hasStockPackaging ? ', packaging' : '');
}

// SECOND COMPTEUR, optionnel : machines.counter_value_2 + counter_unit_2, et
// sur le plan interval_counter_2 / next_due_counter_2 /
// reminder_counter_before_2 — pour les machines dont le plan mélange deux
// unités de compteur (ex. heures ET km), ou une unité de compteur sur une
// machine par ailleurs suivie au calendrier. Même garde-fou que hasCounter :
// faux tant que la sonde n'a pas trouvé les colonnes, et rien de ce qui en
// dépend ne s'affiche ni ne s'écrit alors — comportement d'avant inchangé.
SCHEMA.hasCounter2 = false;

// Colonnes de rappel (notification_email, reminders_email, reminders_whatsapp),
// ajoutées par migration-rappels-email.sql. Faux tant que la sonde ne les a pas
// trouvées : l'écran des rappels le dit alors, au lieu de laisser croire qu'un
// réglage a été enregistré.
SCHEMA.hasReminders = false;

// Ciblage des rappels push par rôle (reminders_push, reminders_push_roles),
// ajoutées par migration-push-notifications.sql. Même discipline : faux tant
// que la sonde ne les a pas trouvées.
SCHEMA.hasPushRoles = false;

// Pays d'exploitation de la société (companies.country), ajouté par pays-societe.sql.
// Faux tant que la sonde ne l'a pas trouvé : l'écran garde alors le libellé d'origine (RIDET).
SCHEMA.hasCountry = false;

// Durées de vie de référence par type de machine (table machine_type_references, durees-de-vie-reference.sql).
SCHEMA.hasReferences = false;

// TCO (coût total de possession) : machines.purchase_price/purchase_date/
// estimated_resale_value/expected_lifespan_counter, interventions.parts_cost/
// labor_cost/labor_hours, companies.labor_hourly_rate/default_insurance_yearly/
// default_storage_yearly, et les tables parts_catalog/intervention_parts/
// operating_costs. Même garde-fou que hasCounter2 : faux tant que la sonde
// n'a pas trouvé les colonnes, et aucun bloc TCO ne s'affiche ni ne s'écrit
// alors — comportement d'avant inchangé pour qui n'a pas encore la migration.
SCHEMA.hasTco = false;

// Télémétrie (compteur automatique) : machines.telemetry_source_id/telemetry_ref/
// counter_source/telemetry_last_at/telemetry_offset + tables telemetry_sources et
// counter_readings (kalea-serveur/migrations/telemetrie.sql). Faux tant que la
// sonde n'a pas trouvé les colonnes : rien ne s'affiche alors.
SCHEMA.hasTelemetry = false;
// Géolocalisation (phase 3) : machines.position_enabled/last_lat/last_lon/last_position_at et
// la table telemetry_positions (kalea-serveur/migrations/telemetrie-gps.sql). Faux tant que la
// sonde ne les a pas trouvées : ni carte ni case « Localiser » alors.
SCHEMA.hasGps = false;

// --- Version affichée, et filet de sécurité ----------------------------------
//
// LA VERSION, C'EST UN NUMÉRO — ET IL NE BOUGE PAS.
//
// Ce que cette ligne affichait avant : `document.lastModified`, c'est-à-dire la
// date du fichier SERVI. Dans l'application Android, Capacitor sert la page
// depuis un serveur local : cette valeur était donc l'HEURE COURANTE,
// recalculée à chaque affichage — elle avançait sous les yeux de l'utilisateur et
// ne prouvait rien sur la version installée. Et le libellé (« Version ») ne
// correspondait pas à son contenu (une date).
//
// Correction : un NUMÉRO.
//   · Dans l'application Android, @capacitor/app (déjà installé pour le verrou
//     d'arrière-plan) donne la version et le numéro de build RÉELS du paquet
//     installé : « 1.0.0 (1) ».
//   · Dans le navigateur, il n'y a pas de paquet : c'est la constante
//     ci-dessous qui répond. Elle double « version » dans mobile/package.json,
//     et ce doublon est CONTRÔLÉ : signal/test-version-application.mjs compare
//     les deux, le harnais relit la valeur deux fois à une seconde d'intervalle,
//     et mobile/verifier-apk.mjs confronte la page embarquée au manifeste du
//     paquet.
//
// PAS DE DATE DE CONSTRUCTION ICI, et c'est volontaire : une date gravée dans le
// fichier livré changerait à chaque reconstruction, or deux reconstructions des
// mêmes sources doivent donner un fichier IDENTIQUE (reconstruire.mjs le
// vérifie). Le numéro de version et le numéro de build Android suffisent à
// identifier un paquet sans ambiguïté.
const VERSION_APPLICATION = '1.0.0';   // la version du paquet (mobile/package.json)
let versionNative = '';                // « 1.0.0 (1) », lue dans le paquet Android
let versionNativeDemandee = false;

// La demande part UNE SEULE FOIS, et dès le démarrage quand on est dans
// l'application : la valeur est ainsi déjà la bonne quand « Mon compte » s'ouvre,
// et deux affichages ne peuvent pas montrer deux textes différents.
function demanderVersionDuPaquet() {
  if (versionNativeDemandee) return;
  versionNativeDemandee = true;
  lireVersionDuPaquet();
}

// Ce que la ligne affiche : le numéro du paquet installé dès qu'il est connu,
// sinon la constante. Jamais une date, jamais un horodatage, jamais une valeur
// recalculée : deux affichages à une seconde d'intervalle donnent le MÊME texte.
function versionAffichee() {
  demanderVersionDuPaquet();
  return versionNative || VERSION_APPLICATION;
}

// Lit la version RÉELLE du paquet Android. Le greffon s'annonce sur
// window.Capacitor.Plugins.App : aucun import npm, rien à charger (même
// mécanisme que le verrou d'arrière-plan). Sur le web, il n'existe pas et la
// fonction ne fait rien — la constante est alors la bonne réponse.
async function lireVersionDuPaquet() {
  try {
    const cap = typeof window !== 'undefined' ? window.Capacitor : null;
    const greffon = cap && cap.Plugins ? cap.Plugins.App : null;
    if (!greffon || typeof greffon.getInfo !== 'function') return;
    const info = await greffon.getInfo();
    if (!info || !info.version) return;
    versionNative = info.build ? `${info.version} (${info.build})` : String(info.version);
    const noeud = document.getElementById('version-application');
    if (noeud) noeud.textContent = versionNative;
  } catch (err) {
    // Greffon absent ou paquet illisible : la constante affichée suffit.
  }
}

// DANS L'APPLICATION, la demande part dès le démarrage : le numéro du paquet est
// donc déjà affiché quand l'écran « Mon compte » s'ouvre (voir la fonction).
if (typeof window !== 'undefined' && window.Capacitor) demanderVersionDuPaquet();

// ════════════════════════════════════════════════════════════════════════════
// L'EMPREINTE DE LA PAGE, ET L'AVIS DE NOUVELLE VERSION
// ════════════════════════════════════════════════════════════════════════════
// POURQUOI. GitHub Pages sert la page avec un cache : après une publication, un
// navigateur peut continuer à faire tourner l'ANCIENNE version. Un bêta-testeur
// signale alors un défaut déjà corrigé — c'est arrivé en vrai, sur « Cannot
// access 'identiteDe' before initialization », vu à l'écran alors que la
// correction était livrée.
//
// La page récupère donc `version.json`, un fichier JAMAIS mis en cache, qui porte
// l'empreinte du script publié. Si elle diffère de celle qui tourne, la page se
// RECHARGE TOUTE SEULE — mais seulement dans les premières secondes qui suivent
// l'ouverture, et jamais si quelqu'un est en train de saisir quelque chose ou si
// une fenêtre est ouverte : on ne recharge jamais sous les doigts de quelqu'un.
// Il n'y a plus de bandeau « Une nouvelle version est disponible » (retiré le
// 2026-10-07 : il revenait à chaque publication et agaçait plus qu'il n'aidait).
// Un seul rechargement par version publiée (sessionStorage) : si le cache du
// navigateur sert encore l'ancienne page après ce rechargement, on reste
// silencieux au lieu de boucler.
function empreintePage() {
  // Empreinte de TOUTE la page (script en ligne + fichiers .js de l'application), posée par outils/maj-empreinte-csp.mjs.
  const pose = document.querySelector('meta[name="kalea-empreinte"]');
  const brute = pose ? String(pose.getAttribute('content') || '') : '';
  const trouve = /^sha256-([A-Za-z0-9+/=]+)$/.exec(brute);
  return trouve && trouve[1] !== '0' ? trouve[1].toLowerCase() : '';
}

// L'empreinte affichée est celle de la PAGE ENTIÈRE (script en ligne + fichiers .js) :
// c'est elle que `publier-site.mjs` écrit dans `version.json`, et c'est donc la
// seule qui permette de comparer. Huit caractères suffisent à un testeur.
function empreinteCourte() {
  const empreinte = empreintePage();
  return empreinte ? empreinte.slice(0, 8) : trad('inconnue');
}

async function verifierVersionPubliee() {
  try {
    // `fetch` peut manquer (vieil environnement) : on ne casse rien pour ça.
    if (typeof fetch !== 'function') return;
    const reponse = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!reponse || !reponse.ok) return;
    const publiee = await reponse.json();
    const ici = empreintePage();
    // `empreintePage()` renvoie le hachage NU (sans « sha256- », en minuscules) :
    // `version.json` le porte tel que `publier-site.mjs` l'écrit, préfixe et
    // casse d'origine compris. Sans cette même normalisation ici, les deux
    // chaînes ne pouvaient JAMAIS être égales — le bandeau s'affichait donc à
    // chaque chargement dès que `version.json` répondait, même sans nouvelle
    // version publiée.
    const publieeEmpreinte = publiee && publiee.empreinte
      ? String(publiee.empreinte).replace(/^sha256-/i, '').toLowerCase()
      : '';
    // Rien à dire si la version publiée est illisible, ou si c'est la nôtre.
    if (!publieeEmpreinte || !ici || publieeEmpreinte === ici) return;
    // Trop tard, saisie en cours ou fenêtre ouverte : on ne touche à rien (pas de bandeau non plus).
    const actif = document.activeElement;
    const enSaisie = !!actif && /^(INPUT|TEXTAREA|SELECT)$/.test(actif.tagName);
    const tropTard = typeof performance !== 'undefined' && performance.now() > 8000;
    if (tropTard || enSaisie || document.querySelector('.overlay')) return;
    // Une seule tentative par version publiée ; sans sessionStorage on ne risque pas une boucle.
    const cle = 'kalea.rechargement-auto';
    try {
      if (sessionStorage.getItem(cle) === publieeEmpreinte) return;
      sessionStorage.setItem(cle, publieeEmpreinte);
    } catch (err) { return; }
    location.reload();
  } catch (err) {
    // Hors connexion, ou `version.json` absent : c'est un CONFORT, pas une
    // fonction. On ne dit rien, et surtout on n'affiche pas d'erreur globale.
  }
}

// ERREURS SILENCIEUSES : une erreur non rattrapée ne doit JAMAIS se traduire par
// « le bouton ne fait rien ». C'est exactement le défaut qui a coûté plusieurs
// allers-retours : on l'affiche donc à l'écran, avec le message brut — c'est ce
// message qui permet de corriger en une fois au lieu de deviner.
function afficherErreurGlobale(message) {
  try {
    const texte = String(message || '').trim();
    if (!texte) return;
    const deja = document.getElementById('erreur-globale');
    if (deja) deja.remove();
    const bloc = document.createElement('div');
    bloc.className = 'erreur-globale';
    bloc.id = 'erreur-globale';
    bloc.setAttribute('role', 'alert');
    bloc.innerHTML = `<strong>${esc(trad('Une erreur inattendue est survenue.'))}</strong>`
      + `<code>${esc(texte.slice(0, 300))}</code>`
      + `<button type="button" class="fermer" aria-label="${esc(trad('Fermer'))}">×</button>`;
    document.body.appendChild(bloc);
    const fermer = bloc.querySelector('.fermer');
    if (fermer) fermer.addEventListener('click', () => bloc.remove());
  } catch (err) {
    // Si même l'affichage de l'erreur échoue, il ne reste que la console.
    console.error('Erreur globale :', message);
  }
}

// Le garde-fou est conditionnel : dans un environnement sans écouteurs (tests,
// outils), il ne doit pas empêcher le reste du script de se charger.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('error', (evenement) => {
    afficherErreurGlobale(evenement && evenement.message ? evenement.message : 'erreur inconnue');
  });
  window.addEventListener('unhandledrejection', (evenement) => {
    const raison = evenement && evenement.reason;
    afficherErreurGlobale(raison && raison.message ? raison.message : String(raison || 'promesse rejetée'));
  });
}

// --- Contact de la société --------------------------------------------------
// Le schéma d'origine ne stockait qu'une chaîne « nom du contact ». La migration
// « compte » ajoute prénom et nom séparés ; sans elle, tout continue de
// fonctionner à partir de contact_name.
function contactFullName(first, last, secours = '') {
  const parts = [first, last].filter(Boolean);
  return parts.length ? parts.join(' ') : (secours || '');
}
function companyFirstName(c) {
  if (!c) return '';
  if (SCHEMA.hasContactNames && c.contact_first_name) return c.contact_first_name;
  return c.contact_name || '';
}
function companyLastName(c) {
  if (!c || !SCHEMA.hasContactNames || !c.contact_first_name) return '';
  return c.contact_last_name || '';
}
// Adresse email : contrôle volontairement simple, le serveur reste juge.
function emailValide(v) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(v || '').trim());
}

// --- Téléphone : pays, indicatif et masque de saisie ------------------------
// « groupes » décrit le découpage du numéro national : [2,2,2] donne 81 54 44.
// Le nombre total de chiffres attendus en découle.
// Nouvelle-Calédonie en tête (marché principal), puis Pacifique, francophonie,
// et les principaux pays. Ajouter un pays = ajouter une ligne.
const PAYS_TEL = [
  { code: 'NC', nom: trad('Nouvelle-Calédonie'), indicatif: '687', groupes: [2, 2, 2] },
  { code: 'PF', nom: trad('Polynésie française'), indicatif: '689', groupes: [2, 2, 2, 2] },
  { code: 'WF', nom: trad('Wallis-et-Futuna'), indicatif: '681', groupes: [2, 2, 2] },
  { code: 'VU', nom: trad('Vanuatu'), indicatif: '678', groupes: [3, 4] },
  { code: 'FJ', nom: trad('Fidji'), indicatif: '679', groupes: [3, 4] },
  { code: 'WS', nom: trad('Samoa'), indicatif: '685', groupes: [3, 4] },
  { code: 'TO', nom: trad('Tonga'), indicatif: '676', groupes: [3, 4] },
  { code: 'PG', nom: trad('Papouasie-Nouvelle-Guinée'), indicatif: '675', groupes: [4, 4] },
  { code: 'SB', nom: trad('Îles Salomon'), indicatif: '677', groupes: [3, 4] },
  { code: 'KI', nom: trad('Kiribati'), indicatif: '686', groupes: [2, 3] },
  { code: 'NR', nom: trad('Nauru'), indicatif: '674', groupes: [3, 4] },
  { code: 'TV', nom: trad('Tuvalu'), indicatif: '688', groupes: [2, 3] },
  { code: 'CK', nom: trad('Îles Cook'), indicatif: '682', groupes: [2, 3] },
  { code: 'AU', nom: trad('Australie'), indicatif: '61', groupes: [3, 3, 3] },
  { code: 'NZ', nom: trad('Nouvelle-Zélande'), indicatif: '64', groupes: [2, 3, 4] },
  { code: 'FR', nom: trad('France'), indicatif: '33', groupes: [1, 2, 2, 2, 2] },
  { code: 'RE', nom: trad('La Réunion'), indicatif: '262', groupes: [3, 2, 2, 2] },
  { code: 'BE', nom: trad('Belgique'), indicatif: '32', groupes: [3, 2, 2, 2] },
  { code: 'CH', nom: trad('Suisse'), indicatif: '41', groupes: [2, 3, 2, 2] },
  { code: 'LU', nom: trad('Luxembourg'), indicatif: '352', groupes: [3, 3, 3] },
  { code: 'MC', nom: trad('Monaco'), indicatif: '377', groupes: [2, 2, 2, 2] },
  { code: 'CA', nom: trad('Canada'), indicatif: '1', groupes: [3, 3, 4] },
  { code: 'US', nom: trad('États-Unis'), indicatif: '1', groupes: [3, 3, 4] },
  { code: 'GB', nom: trad('Royaume-Uni'), indicatif: '44', groupes: [4, 6] },
  { code: 'IE', nom: trad('Irlande'), indicatif: '353', groupes: [2, 3, 4] },
  { code: 'DE', nom: trad('Allemagne'), indicatif: '49', groupes: [4, 4, 4] },
  { code: 'ES', nom: trad('Espagne'), indicatif: '34', groupes: [3, 3, 3] },
  { code: 'IT', nom: trad('Italie'), indicatif: '39', groupes: [3, 3, 4] },
  { code: 'PT', nom: trad('Portugal'), indicatif: '351', groupes: [3, 3, 3] },
  { code: 'NL', nom: trad('Pays-Bas'), indicatif: '31', groupes: [2, 3, 4] },
  { code: 'AT', nom: trad('Autriche'), indicatif: '43', groupes: [3, 3, 4] },
  { code: 'GR', nom: trad('Grèce'), indicatif: '30', groupes: [3, 3, 4] },
  { code: 'PL', nom: trad('Pologne'), indicatif: '48', groupes: [3, 3, 3] },
  { code: 'SE', nom: trad('Suède'), indicatif: '46', groupes: [2, 3, 4] },
  { code: 'NO', nom: trad('Norvège'), indicatif: '47', groupes: [3, 2, 3] },
  { code: 'DK', nom: trad('Danemark'), indicatif: '45', groupes: [2, 2, 2, 2] },
  { code: 'FI', nom: trad('Finlande'), indicatif: '358', groupes: [2, 3, 4] },
  { code: 'MA', nom: trad('Maroc'), indicatif: '212', groupes: [3, 2, 2, 2] },
  { code: 'DZ', nom: trad('Algérie'), indicatif: '213', groupes: [3, 2, 2, 2] },
  { code: 'TN', nom: trad('Tunisie'), indicatif: '216', groupes: [2, 3, 3] },
  { code: 'SN', nom: trad('Sénégal'), indicatif: '221', groupes: [2, 3, 2, 2] },
  { code: 'CI', nom: trad('Côte d\'Ivoire'), indicatif: '225', groupes: [2, 2, 2, 2] },
  { code: 'CM', nom: trad('Cameroun'), indicatif: '237', groupes: [3, 3, 3] },
  { code: 'MG', nom: trad('Madagascar'), indicatif: '261', groupes: [2, 2, 3, 2] },
  { code: 'MU', nom: trad('Maurice'), indicatif: '230', groupes: [4, 4] },
  { code: 'BR', nom: trad('Brésil'), indicatif: '55', groupes: [2, 5, 4] },
  { code: 'MX', nom: trad('Mexique'), indicatif: '52', groupes: [3, 3, 4] },
  { code: 'AR', nom: trad('Argentine'), indicatif: '54', groupes: [2, 4, 4] },
  { code: 'CL', nom: trad('Chili'), indicatif: '56', groupes: [1, 4, 4] },
  { code: 'JP', nom: trad('Japon'), indicatif: '81', groupes: [2, 4, 4] },
  { code: 'CN', nom: trad('Chine'), indicatif: '86', groupes: [3, 4, 4] },
  { code: 'IN', nom: trad('Inde'), indicatif: '91', groupes: [5, 5] },
  { code: 'SG', nom: trad('Singapour'), indicatif: '65', groupes: [4, 4] },
  { code: 'TH', nom: trad('Thaïlande'), indicatif: '66', groupes: [2, 3, 4] },
  { code: 'ID', nom: trad('Indonésie'), indicatif: '62', groupes: [3, 4, 4] },
  { code: 'PH', nom: trad('Philippines'), indicatif: '63', groupes: [3, 3, 4] },
  { code: 'MY', nom: trad('Malaisie'), indicatif: '60', groupes: [2, 4, 4] },
  { code: 'VN', nom: trad('Viêt Nam'), indicatif: '84', groupes: [3, 3, 3] },
  { code: 'AE', nom: trad('Émirats arabes unis'), indicatif: '971', groupes: [2, 3, 4] },
  { code: 'ZA', nom: trad('Afrique du Sud'), indicatif: '27', groupes: [2, 3, 4] },
];

const PAYS_TEL_DEFAUT = PAYS_TEL[0];

// ── PAYS D'EXPLOITATION DE LA SOCIÉTÉ ─────────────────────────────────
// Le numéro d'immatriculation d'une entreprise ne porte pas le même nom partout :
// RIDET en Nouvelle-Calédonie, SIRET en France, KvK aux Pays-Bas… Le pays choisi sur la
// fiche société (ou à l'inscription) décide du libellé du champ. [code ISO, nom, sigle du
// numéro] — sigle null : pays sans libellé propre, on écrit « Numéro d'identifiant d'entreprise ».
// ⚠️ Les sigles sont donnés de bonne foi : à faire relire par pays avant de s'y fier juridiquement.
const PAYS_DEFAUT_SOCIETE = 'FR';
const PAYS_SOCIETE = [
  ['NC', "Nouvelle-Calédonie", "RIDET"],
  ['PF', "Polynésie française", "TAHITI"],
  ['WF', "Wallis-et-Futuna", null],
  ['VU', "Vanuatu", null],
  ['FJ', "Fidji", null],
  ['WS', "Samoa", null],
  ['TO', "Tonga", null],
  ['PG', "Papouasie-Nouvelle-Guinée", null],
  ['SB', "Îles Salomon", null],
  ['KI', "Kiribati", null],
  ['NR', "Nauru", null],
  ['TV', "Tuvalu", null],
  ['CK', "Îles Cook", null],
  ['AU', "Australie", "ABN"],
  ['NZ', "Nouvelle-Zélande", "NZBN"],
  ['CA', "Canada", "NE"],
  ['US', "États-Unis", "EIN"],
  ['FR', "France", "SIRET"],
  ['RE', "La Réunion", "SIRET"],
  ['AL', "Albanie", "NIPT"],
  ['DE', "Allemagne", "HRB"],
  ['AD', "Andorre", "NRT"],
  ['AT', "Autriche", "FN"],
  ['BY', "Biélorussie", "UNP"],
  ['BE', "Belgique", "BCE"],
  ['BA', "Bosnie-Herzégovine", "JIB"],
  ['BG', "Bulgarie", "EIK"],
  ['CY', "Chypre", "HE"],
  ['HR', "Croatie", "OIB"],
  ['DK', "Danemark", "CVR"],
  ['ES', "Espagne", "NIF"],
  ['EE', "Estonie", "Registrikood"],
  ['FI', "Finlande", "Y-tunnus"],
  ['GR', "Grèce", "GEMI"],
  ['HU', "Hongrie", "Cégjegyzékszám"],
  ['IE', "Irlande", "CRO"],
  ['IS', "Islande", "Kennitala"],
  ['IT', "Italie", "P.IVA"],
  ['XK', "Kosovo", "NUI"],
  ['LV', "Lettonie", "Reģ. nr."],
  ['LI', "Liechtenstein", "FL-Nr."],
  ['LT', "Lituanie", "Įmonės kodas"],
  ['LU', "Luxembourg", "RCS"],
  ['MK', "Macédoine du Nord", "EDB"],
  ['MT', "Malte", "C-number"],
  ['MD', "Moldavie", "IDNO"],
  ['MC', "Monaco", "RCI"],
  ['ME', "Monténégro", "PIB"],
  ['NO', "Norvège", "Org.nr."],
  ['NL', "Pays-Bas", "KvK"],
  ['PL', "Pologne", "NIP"],
  ['PT', "Portugal", "NIPC"],
  ['CZ', "Tchéquie", "IČO"],
  ['RO', "Roumanie", "CUI"],
  ['GB', "Royaume-Uni", "Companies House"],
  ['RU', "Russie", "INN"],
  ['SM', "Saint-Marin", "COE"],
  ['RS', "Serbie", "PIB"],
  ['SK', "Slovaquie", "IČO"],
  ['SI', "Slovénie", "Matična št."],
  ['SE', "Suède", "Org.nr."],
  ['CH', "Suisse", "IDE"],
  ['TR', "Turquie", "MERSIS"],
  ['UA', "Ukraine", "EDRPOU"],
];
function paysSocieteListe() {
  return PAYS_SOCIETE
    .map(([code, nom, sigle]) => ({ code, nom: trad(nom), sigle }))
    .sort((a, b) => a.nom.localeCompare(b.nom, LANGUE === 'en' ? 'en' : 'fr'));
}
function sigleRegistre(code) {
  const p = PAYS_SOCIETE.find((x) => x[0] === code);
  return p ? p[2] : null;
}
// « N° SIRET », « N° RIDET »… ou le libellé générique quand le pays n'a pas de sigle connu.
function libelleRegistre(code) {
  const sigle = sigleRegistre(code);
  return sigle ? tR('N° {registre}', { registre: sigle }) : trad('Numéro d\'identifiant d\'entreprise');
}
// Devise habituelle d'un pays : le franc Pacifique en Nouvelle-Calédonie, Polynésie française et Wallis-et-Futuna,
// l'euro partout ailleurs (les seules devises que l'application sait gérer pour l'instant).
const PAYS_FRANC_PACIFIQUE = ['NC', 'PF', 'WF'];
function deviseDuPays(code) { return PAYS_FRANC_PACIFIQUE.indexOf(code) !== -1 ? 'XPF' : 'EUR'; }
function libelleDevise(code) { return code === 'XPF' ? trad('Franc Pacifique (XPF)') : trad('Euro (EUR €)'); }
function optionsPaysSocieteHtml(choisi) {
  return paysSocieteListe()
    .map((p) => `<option value="${p.code}"${p.code === choisi ? ' selected' : ''}>${esc(p.nom)}</option>`)
    .join('');
}
// Relie un menu de pays à l'étiquette du numéro d'immatriculation : elle change dès qu'on choisit un autre pays.
function brancherLibelleRegistre(select, etiquette) {
  if (!select || !etiquette) return;
  select.addEventListener('change', () => { etiquette.textContent = libelleRegistre(select.value); });
}

// Sélecteur d'indicatif pays (reprise Stitch « stitch_refonte_zone_change_
// ticketing », modale « Pays de l'indicatif ») — les 5 raccourcis de la
// maquette sont déjà les 5 premiers pays réels de PAYS_TEL (Pacifique +
// France), repris tels quels. La zone (Pacifique/Europe/Autres) n'est PAS
// une donnée téléphonique : un simple classement d'affichage pour les
// onglets de la maquette, sur la vraie liste PAYS_TEL (61 pays) — jamais le
// « 242 indicatifs mondiaux » fictif de la maquette.
const INDICATIFS_FREQUENTS = ['NC', 'PF', 'FR', 'WF', 'BE'];
const ZONE_PAYS_TEL = {
  NC: 'pacifique', PF: 'pacifique', WF: 'pacifique', VU: 'pacifique', FJ: 'pacifique', WS: 'pacifique',
  TO: 'pacifique', PG: 'pacifique', SB: 'pacifique', KI: 'pacifique', NR: 'pacifique', TV: 'pacifique',
  CK: 'pacifique', AU: 'pacifique', NZ: 'pacifique',
  FR: 'europe', BE: 'europe', CH: 'europe', LU: 'europe', MC: 'europe', IE: 'europe', DE: 'europe',
  ES: 'europe', IT: 'europe', PT: 'europe', NL: 'europe', AT: 'europe', GR: 'europe', PL: 'europe',
  SE: 'europe', NO: 'europe', DK: 'europe', FI: 'europe', GB: 'europe',
};
function zonePaysTel(code) { return ZONE_PAYS_TEL[code] || 'autres'; }

function paysTel(code) {
  return PAYS_TEL.find((p) => p.code === code) || PAYS_TEL_DEFAUT;
}
function chiffresMax(pays) {
  return pays.groupes.reduce((total, n) => total + n, 0);
}
// Drapeau dérivé du code ISO : les lettres A-Z deviennent des indicateurs
// régionaux Unicode. Évite de saisir soixante emoji à la main.
function drapeauDe(iso) {
  return String(iso).toUpperCase().replace(/[A-Z]/g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
function exempleNational(pays) {
  return pays.groupes.map((n) => '0'.repeat(n)).join(' ');
}
// Applique le découpage du pays, sans jamais dépasser le nombre de chiffres.
function formatNational(chiffres, pays) {
  const brut = String(chiffres || '').replace(/\D/g, '');
  if (!brut) return '';
  if (brut.length > chiffresMax(pays)) {
    // Valeur plus longue que le format du pays (donnée ancienne) : on la
    // conserve intégralement, groupée par paires, plutôt que de la tronquer.
    return brut.replace(/(\d{2})(?=\d)/g, '$1 ');
  }
  const morceaux = [];
  let position = 0;
  for (const taille of pays.groupes) {
    if (position >= brut.length) break;
    morceaux.push(brut.slice(position, position + taille));
    position += taille;
  }
  return morceaux.join(' ');
}
// Reconstitue pays + numéro national à partir de ce qui est stocké.
function parserTelephone(valeur) {
  const brut = String(valeur || '').trim();
  const chiffres = brut.replace(/\D/g, '');
  if (!chiffres) return { pays: PAYS_TEL_DEFAUT, national: '' };

  const parIndicatif = (liste) =>
    liste.slice().sort((a, b) => b.indicatif.length - a.indicatif.length)[0];

  // ⚠️ UN INDICATIF SEUL N'EST PAS UN NUMÉRO ÉTRANGER. « +61 » collé sans
  //   numéro faisait reconnaître l'AUSTRALIE : le sélecteur affichait « +61
  //   Australie » sur un compte calédonien, et le client croyait que
  //   l'application ne connaissait pas son pays. Un indicatif n'est donc reconnu
  //   que s'il RESTE au moins un chiffre de numéro derrière.
  if (brut.startsWith('+')) {
    const candidats = PAYS_TEL.filter(
      (p) => chiffres.startsWith(p.indicatif) && chiffres.length > p.indicatif.length
    );
    if (candidats.length) {
      const pays = parIndicatif(candidats);
      return { pays, national: chiffres.slice(pays.indicatif.length) };
    }
  } else {
    // Sans « + » : on ne reconnaît un indicatif que si la longueur totale
    // correspond EXACTEMENT au format du pays. Une condition plus souple
    // (« le reste tient dans le format ») ferait passer « 81 54 44 » pour un
    // numéro japonais (+81) suivi de 5444, au lieu d'un numéro calédonien.
    const candidats = PAYS_TEL.filter(
      (p) => chiffres.startsWith(p.indicatif)
        && chiffres.length - p.indicatif.length === chiffresMax(p)
        // Le format doit être COMPLET : un numéro plus court que le format du
        // pays ne suffit pas à décider que c'est ce pays-là.
        && chiffresMax(p) > 0
    );
    if (candidats.length) {
      const pays = parIndicatif(candidats);
      return { pays, national: chiffres.slice(pays.indicatif.length) };
    }
  }
  return { pays: PAYS_TEL_DEFAUT, national: chiffres };
}
// Format de stockage : E.164 (« +687815444 »), celui qu'attendent les services
// de notification.
function telephoneE164(pays, national) {
  const chiffres = String(national || '').replace(/\D/g, '');
  return chiffres ? `+${pays.indicatif}${chiffres}` : '';
}
// Format lisible : « +687 81 54 44 ».
function telephoneLisible(valeur) {
  const { pays, national } = parserTelephone(valeur);
  return national ? `+${pays.indicatif} ${formatNational(national, pays)}` : '';
}

// Champ téléphone réutilisable : sélecteur de pays + saisie masquée.
function champTelephoneHtml(id, valeur, opts = {}) {
  // opts.kit : habillage du kit d'interface (kit.css) pour les écrans migrés ; sans lui, le rendu historique.
  const kit = !!opts.kit;
  const { pays, national } = parserTelephone(valeur);
  const desactive = opts.disabled ? ' disabled' : '';
  const requis = opts.required ? ' required' : '';
  const compact = opts.compact ? ' tel-champ-compact' : '';
  // `labelHtml` est un échappement volontaire et délibérément limité : il ne
  // sert qu'à poser un <span class="requis"> déjà construit par l'appelant
  // (jamais du texte utilisateur), quand `opts.label` échappé ne suffit pas.
  const etiquette = opts.labelHtml || esc(opts.label || trad('Téléphone'));
  // « Drapeau + indicatif + nom du pays » déborde dès que la colonne est
  // partagée avec un autre champ (le sélecteur se tronque, illisible). Un
  // <select> HTML ne peut pas afficher un texte fermé différent de celui de
  // ses <option> ouvertes : `indicatifSeul` réduit donc les DEUX au seul
  // indicatif (« +687 », 4 caractères), pour un sélecteur étroit qui laisse
  // la place au numéro. La liste de pays reste courte (5 territoires du
  // Pacifique/France) : l'indicatif seul y reste identifiable.
  const etroit = opts.indicatifSeul ? ' tel-pays-etroit' : '';
  return `
    <label${kit ? ' class="ui-etiquette"' : ''} for="${id}">${etiquette}</label>
    <div class="tel-champ${compact}">
      <select id="${id}-pays" class="tel-pays${etroit}${kit ? ' ui-selecteur' : ''}" aria-label="${trad('Pays de l\'indicatif')}"${desactive}>
        ${PAYS_TEL.map((p) => `<option value="${esc(p.code)}"${p.code === pays.code ? ' selected' : ''}>${opts.indicatifSeul ? `+${esc(p.indicatif)}` : `${drapeauDe(p.code)} +${esc(p.indicatif)} — ${esc(p.nom)}`}</option>`).join('')}
      </select>
      <input id="${id}"${kit ? ' class="ui-champ"' : ''} type="tel" inputmode="tel" autocomplete="tel-national"
             value="${esc(formatNational(national, pays))}"
             placeholder="${esc(exempleNational(pays))}"${desactive}${requis}>
    </div>
    ${opts.aide ? `<div class="${kit ? 'ui-aide' : 'hint'}">${esc(opts.aide)}</div>` : ''}`;
}

// Modale « Pays de l'indicatif » (reprise Stitch, remplace ouvrirListeChoix()
// pour CE select précis, partout où un champ téléphone existe — inscription,
// Mon compte) : recherche en direct, onglets de zone, raccourcis atelier,
// liste avec drapeau + pastille radio. `valeurActuelle` : le code ISO en
// cours (ex. 'NC') ; `onChoisi(pays)` : appelé UNIQUEMENT sur « Confirmer
// l'indicatif », jamais sur un simple clic dans la liste (même discipline
// que ouvrirSelecteurMachine, support client).
function ouvrirChoixIndicatifPays(valeurActuelle, onChoisi) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay indicatif-modal';
  document.body.appendChild(overlay);
  let choisiCode = valeurActuelle || PAYS_TEL_DEFAUT.code;
  let filtreZone = 'all';

  const correspond = (p, texte) => {
    const t = texte.trim().toLowerCase();
    if (!t) return true;
    return p.nom.toLowerCase().includes(t) || p.indicatif.includes(t.replace(/^\+/, ''));
  };
  const correspondZone = (p) => {
    if (filtreZone === 'all') return true;
    if (filtreZone === 'frequents') return INDICATIFS_FREQUENTS.includes(p.code);
    return zonePaysTel(p.code) === filtreZone;
  };

  const rendreListe = () => {
    const texte = overlay.querySelector('#indicatif-recherche').value;
    overlay.querySelector('#indicatif-effacer-recherche').classList.toggle('is-visible', texte.length > 0);
    const liste = PAYS_TEL.filter((p) => correspond(p, texte) && correspondZone(p));
    const zone = overlay.querySelector('#indicatif-liste');
    if (!liste.length) {
      zone.innerHTML = `<div class="indicatif-vide">
        <span class="card-ico">${picto('recherche')}</span>
        <p>${trad('Aucun pays trouvé')}</p>
        <p class="muted-text">${trad('Vérifie l\'orthographe du pays ou renseigne directement l\'indicatif sans symbole.')}</p>
      </div>`;
    } else {
      zone.innerHTML = liste.map((p) => `
        <button type="button" class="indicatif-ligne${p.code === choisiCode ? ' is-choisie' : ''}" data-code="${esc(p.code)}">
          <span class="indicatif-ligne-gauche">
            <span class="indicatif-drapeau">${drapeauDe(p.code)}</span>
            <span>
              <span class="indicatif-ligne-tete">
                <span class="indicatif-num">+${esc(p.indicatif)}</span>
                ${p.code === PAYS_TEL_DEFAUT.code ? `<span class="indicatif-badge">${trad('Par défaut')}</span>` : ''}
              </span>
              <span class="indicatif-nom">${esc(p.nom)}</span>
            </span>
          </span>
          <span class="indicatif-radio"><span class="point"></span></span>
        </button>`).join('');
      zone.querySelectorAll('.indicatif-ligne').forEach((ligne) => {
        ligne.addEventListener('click', () => {
          choisiCode = ligne.dataset.code;
          zone.querySelectorAll('.indicatif-ligne').forEach((l) => l.classList.toggle('is-choisie', l === ligne));
        });
      });
    }
    const compte = overlay.querySelector('#indicatif-compte');
    compte.textContent = (texte || filtreZone !== 'all')
      ? tR('{n} pays affiché(s)', { n: liste.length })
      : tR('{n} indicatifs disponibles', { n: PAYS_TEL.length });
  };

  const selectionRapide = (code) => {
    choisiCode = code;
    rendreListe();
    const p = paysTel(code);
    showToast(tR('Indicatif sélectionné : +{indicatif} ({nom})', { indicatif: p.indicatif, nom: p.nom }));
  };

  overlay.innerHTML = `<div class="modal">
    <div class="support-tete">
      <div class="indicatif-tete-gauche">
        <span class="card-ico card-ico-plein indicatif-tete-ico">${picto('monde')}</span>
        <div><h2>${trad('Pays de l\'indicatif')}</h2><p class="sub">${trad('Sélectionne l\'indicatif international pour tes alertes et notifications.')}</p></div>
      </div>
      <button type="button" class="mform-close" id="indicatif-fermer-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
    </div>
    <div class="indicatif-recherche">
      <span class="card-ico">${picto('recherche')}</span>
      <input type="text" id="indicatif-recherche" placeholder="${esc(trad('Rechercher par pays ou indicatif (+687, Calédonie, +33…)'))}">
      <button type="button" class="indicatif-effacer-recherche" id="indicatif-effacer-recherche" aria-label="${esc(trad('Effacer la recherche'))}">${picto('fermer')}</button>
    </div>
    <div class="indicatif-onglets" id="indicatif-onglets">
      <button type="button" class="indicatif-onglet is-actif" data-zone="all">${trad('Tous les pays')}</button>
      <button type="button" class="indicatif-onglet" data-zone="pacifique">${trad('DOM-TOM & Pacifique')}</button>
      <button type="button" class="indicatif-onglet" data-zone="europe">${trad('Europe')}</button>
      <button type="button" class="indicatif-onglet" data-zone="autres">${trad('Autres')}</button>
      <button type="button" class="indicatif-onglet" data-zone="frequents">${trad('Fréquents')}</button>
    </div>
    <div class="indicatif-raccourcis">
      <div class="indicatif-raccourcis-tete">
        <span>${trad('Sélections rapides atelier')}</span>
        <span class="indicatif-raccourcis-defaut" id="indicatif-defaut">${tR('Par défaut (+{indicatif})', { indicatif: PAYS_TEL_DEFAUT.indicatif })}</span>
      </div>
      <div class="indicatif-raccourcis-liste">
        ${INDICATIFS_FREQUENTS.map((code) => { const p = paysTel(code); return `
          <button type="button" class="indicatif-chip" data-code="${esc(code)}">
            <span>${drapeauDe(code)}</span><span class="indicatif-chip-num">+${esc(p.indicatif)}</span><span class="indicatif-chip-nom">${esc(p.nom)}</span>
          </button>`; }).join('')}
      </div>
    </div>
    <div class="indicatif-liste" id="indicatif-liste"></div>
    <div class="indicatif-pied">
      <span class="indicatif-pied-compte"><span class="card-ico">${picto('bouclier')}</span><span id="indicatif-compte"></span></span>
      <div class="indicatif-pied-actions">
        <button type="button" class="secondary" id="indicatif-annuler">${trad('Annuler')}</button>
        <button type="button" class="primary" id="indicatif-confirmer"><span>${trad('Confirmer l\'indicatif')}</span><span class="card-ico">${picto('coche')}</span></button>
      </div>
    </div>
  </div>`;

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#indicatif-fermer-x').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#indicatif-annuler').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#indicatif-recherche').addEventListener('input', rendreListe);
  overlay.querySelector('#indicatif-effacer-recherche').addEventListener('click', () => {
    const champ = overlay.querySelector('#indicatif-recherche');
    champ.value = '';
    champ.focus();
    rendreListe();
  });
  overlay.querySelector('#indicatif-defaut').addEventListener('click', () => selectionRapide(PAYS_TEL_DEFAUT.code));
  overlay.querySelectorAll('.indicatif-chip').forEach((chip) => {
    chip.addEventListener('click', () => selectionRapide(chip.dataset.code));
  });
  overlay.querySelectorAll('.indicatif-onglet').forEach((onglet) => {
    onglet.addEventListener('click', () => {
      filtreZone = onglet.dataset.zone;
      overlay.querySelectorAll('.indicatif-onglet').forEach((o) => o.classList.toggle('is-actif', o === onglet));
      rendreListe();
    });
  });
  overlay.querySelector('#indicatif-confirmer').addEventListener('click', () => {
    const p = paysTel(choisiCode);
    overlay.remove();
    showToast(tR('Indicatif confirmé : +{indicatif}', { indicatif: p.indicatif }));
    onChoisi(p);
  });

  rendreListe();
}

// Habillage dédié au select d'indicatif pays (même mécanique que
// habillerSelect : select natif masqué mais fonctionnel, un bouton visuel
// prend sa place) — ouvre ouvrirChoixIndicatifPays() au lieu du choix
// générique ouvrirListeChoix(), pour ce select précis seulement.
function habillerSelectIndicatif(select) {
  if (!select || select.dataset.habille) return;
  select.dataset.habille = '1';
  select.style.display = 'none';
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = `champ-select ${select.className}`.trim();
  if (select.id) bouton.id = `${select.id}-bouton`;
  select.insertAdjacentElement('afterend', bouton);

  const majBouton = () => {
    const pays = paysTel(select.value);
    const etroit = select.classList.contains('tel-pays-etroit');
    bouton.innerHTML = `<span>${etroit ? `+${esc(pays.indicatif)}` : `${drapeauDe(pays.code)} +${esc(pays.indicatif)} — ${esc(pays.nom)}`}</span>${picto('chevronBas')}`;
    bouton.disabled = select.disabled;
  };
  majBouton();

  bouton.addEventListener('click', () => {
    ouvrirChoixIndicatifPays(select.value, (pays) => {
      select.value = pays.code;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      majBouton();
    });
  });

  new MutationObserver(majBouton).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
}

// Applique le masque à la frappe et tient le sélecteur et le champ cohérents.
function wireChampTelephone(root, id) {
  const select = root.querySelector(`#${id}-pays`);
  const input = root.querySelector(`#${id}`);
  if (!select || !input) return;
  habillerSelectIndicatif(select);

  const courant = () => paysTel(select.value);
  const reformater = (tronquer) => {
    const pays = courant();
    let chiffres = input.value.replace(/\D/g, '');
    if (tronquer) chiffres = chiffres.slice(0, chiffresMax(pays));
    input.value = formatNational(chiffres, pays);
    input.placeholder = exempleNational(pays);
    input.maxLength = chiffresMax(pays) + pays.groupes.length - 1;
  };

  input.addEventListener('input', () => reformater(true));
  input.addEventListener('blur', () => reformater(false));
  select.addEventListener('change', () => {
    // On conserve les chiffres saisis et on les redécoupe selon le nouveau pays.
    reformater(true);
    input.focus();
  });
  reformater(false);
}

// Lit la valeur saisie et la renvoie au format E.164.
function lireChampTelephone(root, id) {
  const select = root.querySelector(`#${id}-pays`);
  const input = root.querySelector(`#${id}`);
  if (!select || !input) return null;
  const pays = paysTel(select.value);
  const national = input.value.replace(/\D/g, '').slice(0, chiffresMax(pays));
  if (!national) return null;
  return { pays, national, e164: telephoneE164(pays, national), lisible: `+${pays.indicatif} ${formatNational(national, pays)}` };
}

// --- Marque et modèle -------------------------------------------------------
// Le schéma d'origine ne stockait qu'une chaîne « marque / modèle ». La
// migration ajoute deux colonnes distinctes ; en attendant, l'application
// reconstitue la chaîne et tout continue de fonctionner à l'identique.
function designation(brand, model, secours = '') {
  const parts = [brand, model].filter(Boolean);
  return parts.length ? parts.join(' ') : (secours || '');
}

// Chaîne affichée : brand_model reste la référence, avec repli sur les colonnes
// séparées si elle n'est pas renseignée.
function machineBrandModel(m) {
  if (!m) return null;
  if (m.brand_model) return m.brand_model;
  const parts = [m.brand, m.model].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}
// Valeur à préremplir dans le champ « Marque ».
function machineBrand(m) {
  if (!m) return '';
  if (SCHEMA.hasBrandModel && m.brand) return m.brand;
  return m.brand_model || '';
}
// Valeur à préremplir dans le champ « Modèle » : vide tant que la ligne
// historique n'a pas été répartie par l'utilisateur.
function machineModel(m) {
  if (!m || !SCHEMA.hasBrandModel || !m.brand) return '';
  return m.model || '';
}

// --- Année du modèle (« version ») ------------------------------------------
//
// POURQUOI CE CHAMP : sur une même référence, un constructeur change parfois tout
// d'une année sur l'autre — carrosserie, motorisation, calandre. Un « PORSCHE
// CAYENNE » de 2011 et un de 2019 n'ont ni la même fiche technique, ni la même
// photo. Sans l'année, la recherche d'image ramène la version la plus récente,
// ou une page de petite annonce. La colonne est optionnelle : la sonde de schéma
// décide si on peut l'écrire, et tout continue de fonctionner sans elle.
function machineYear(m) {
  if (!m || !SCHEMA.hasModelYear) return null;
  const annee = parseInt(m.model_year, 10);
  return Number.isFinite(annee) && annee >= 1900 ? annee : null;
}

function yearPatch(annee) {
  if (!SCHEMA.hasModelYear) return {};
  const valeur = parseInt(annee, 10);
  return { model_year: Number.isFinite(valeur) && valeur >= 1900 ? valeur : null };
}

// Bornes larges mais réelles : une année de modèle peut être annoncée avec un an
// d'avance, et on ne veut pas refuser une machine ancienne.
function anneePlausible(valeur) {
  if (valeur === '' || valeur == null) return true;
  const annee = parseInt(valeur, 10);
  return Number.isFinite(annee) && annee >= 1950 && annee <= new Date().getFullYear() + 2;
}
// Colonnes à écrire selon le schéma détecté. brand_model est toujours
// renseigné : c'est lui que lisent l'affichage, la recherche et l'export.
function brandModelPatch(brand, model) {
  const complet = designation(brand, model) || null;
  return SCHEMA.hasBrandModel
    ? { brand_model: complet, brand: brand || null, model: model || null }
    : { brand_model: complet };
}

// --- Machines et véhicules ---------------------------------------------------
// Une machine s'identifie par son numéro de série, un véhicule par sa plaque
// d'immatriculation : c'est ce que l'équipe lit sur le terrain. Une seule
// colonne porte l'identifiant selon le type, et l'affichage comme la recherche
// suivent le type.
const TYPE_MACHINE = trad('machine');
const TYPE_VEHICULE = 'vehicle';
const IDENTIFIANT_LIBELLE = {
  [TYPE_MACHINE]: trad('N° de série'),
  [TYPE_VEHICULE]: "Plaque d'immatriculation",
};
const IDENTIFIANT_PLACEHOLDER = {
  [TYPE_MACHINE]: 'Ex. 123456789',
  [TYPE_VEHICULE]: 'Ex. 123456',
};
// Intervalle proposé par défaut : 100 heures pour un moteur, 10 000 kilomètres
// pour un véhicule. Le basculer évite d'enregistrer un plan à 100 km.
const INTERVALLE_DEFAUT = { [TYPE_MACHINE]: 100, [TYPE_VEHICULE]: 10000 };

function machineKind(m) {
  return m && m.kind === TYPE_VEHICULE ? TYPE_VEHICULE : TYPE_MACHINE;
}
function isVehicle(m) { return machineKind(m) === TYPE_VEHICULE; }

function kindPatch(kind) {
  return SCHEMA.hasKind ? { kind: kind === TYPE_VEHICULE ? TYPE_VEHICULE : TYPE_MACHINE } : {};
}

// L'identifiant est écrit dans la colonne de son type. L'autre colonne n'est
// jamais effacée : transformer une machine en véhicule ne fait pas perdre son
// numéro de série, il redevient simplement visible si l'on revient en arrière.
function identifiantPatch(kind, valeur) {
  const v = valeur || null;
  if (kind === TYPE_VEHICULE && SCHEMA.hasPlate) return { plate: v };
  return { serial_number: v };
}

// L'identifiant à AFFICHER : la plaque d'un véhicule, le numéro de série sinon.
// Le repli sur l'autre colonne couvre les fiches saisies avant cette version.
function machineIdentifiant(m) {
  if (!m) return '';
  return isVehicle(m)
    ? (m.plate || m.serial_number || '')
    : (m.serial_number || m.plate || '');
}
function identifiantAffiche(m) {
  const valeur = machineIdentifiant(m);
  if (!valeur) return '';
  return `${isVehicle(m) ? trad('Plaque') : trad('N° série')} ${valeur}`;
}
// Force la saisie en majuscules, au fur et à mesure de la frappe, en préservant
// la position du curseur (utile quand on corrige au milieu du champ).
function forcerMajuscules(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    const position = input.selectionStart;
    const haut = input.value.toUpperCase();
    if (haut === input.value) return;
    input.value = haut;
    if (position != null) {
      try { input.setSelectionRange(position, position); } catch (e) { /* type sans sélection */ }
    }
  });
}

// Première lettre en majuscule, le reste tel que saisi (« jean-pierre » → « Jean-pierre », « MARIE » reste « MARIE »).
function premiereMajuscule(texte) {
  const t = String(texte || '');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
// Même principe que forcerMajuscules, mais pour la seule première lettre (un prénom), curseur préservé.
function forcerPremiereMajuscule(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    const position = input.selectionStart;
    const corrige = premiereMajuscule(input.value);
    if (corrige === input.value) return;
    input.value = corrige;
    if (position != null) {
      try { input.setSelectionRange(position, position); } catch (e) { /* type sans sélection */ }
    }
  });
}

const COUNTER_UNITS = {
  hours: { word: trad('heures'), short: trad('h'), label: trad('Compteur horamètre'), field: trad('Heures compteur actuelles'), placeholder: trad('Ex. 245'), step: '0.1' },
  km: { word: trad('kilomètres'), short: trad('km'), label: trad('Compteur kilométrique'), field: trad('Kilométrage actuel'), placeholder: trad('Ex. 19 240'), step: '1' },
};

function counterUnitFromMode(mode) { return mode === 'km' ? trad('km') : 'hours'; }

// L'unité d'une machine : counter_unit fait référence, tracking_mode sert de
// repli tant que la colonne n'est pas renseignée.
function counterUnitOf(machine) {
  if (machine && (machine.counter_unit === 'km' || machine.counter_unit === 'hours')) return machine.counter_unit;
  if (machine && machine.plan && machine.plan.tracking_mode === 'km') return trad('km');
  return 'hours';
}
function counterShort(unit) { return COUNTER_UNITS[unit] ? COUNTER_UNITS[unit].short : trad('h'); }
// Juste le NOMBRE, sans l'unité — factorisé hors de formatCounter : la carte
// compteur fusionnée (compteurHtml, branche téléphone) affiche le nombre et
// l'unité dans deux <span> distincts (typographie différente, comme la
// maquette), jamais un second calcul de l'arrondi/séparateur qui pourrait
// diverger de formatCounter.
function formatCounterNombre(value, unit) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!isFinite(n)) return '—';
  const u = COUNTER_UNITS[unit] ? unit : 'hours';
  // ★ LES HEURES SONT SÉPARÉES COMME LES KILOMÈTRES. Un compteur horaire réel
  //   affiche « 1 240 h » : « 1240 » se lit mal, et c'est la valeur qui sert à
  //   décider d'un entretien. Les kilomètres étaient déjà séparés, les heures
  //   non — c'était une incohérence d'affichage, pas un choix. Le séparateur
  //   décimal suit la langue active (virgule en français).
  const nombre = u === 'km' ? Math.round(n) : n;
  return nombre.toLocaleString(localeActive(),
    Number.isInteger(nombre) ? {} : { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function formatCounter(value, unit) {
  // Attention : Number(null) vaut 0. Un compteur non renseigné doit afficher
  // « — » et non « 0 h ». Même garde côté « pas un nombre » : « — h » serait
  // trompeur, on veut le même « — » nu que formatCounterNombre.
  if (value == null || value === '' || !isFinite(Number(value))) return '—';
  const u = COUNTER_UNITS[unit] ? unit : 'hours';
  return `${formatCounterNombre(value, unit)} ${COUNTER_UNITS[u].short}`;
}
function machineCounter(machine) {
  if (!machine) return null;
  const v = SCHEMA.hasCounter ? machine.counter_value : machine.current_hours;
  return v == null ? null : Number(v);
}
function planIsCounter(plan) { return !!plan && plan.tracking_mode !== 'days'; }
function planIntervalCounter(plan) {
  if (!plan) return null;
  return (SCHEMA.hasCounter ? plan.interval_counter : plan.interval_hours) ?? null;
}
function planNextDueCounter(plan) {
  if (!plan) return null;
  return (SCHEMA.hasCounter ? plan.next_due_counter : plan.next_due_hours) ?? null;
}
function planReminderCounter(plan) {
  if (!plan) return FALLBACK_REMINDER_HOURS;
  return (SCHEMA.hasCounter ? plan.reminder_counter_before : plan.reminder_hours_before) ?? FALLBACK_REMINDER_HOURS;
}
// Le service d'extraction ne connaît que « days » et « hours » : pour un
// kilométrage, la lecture du manuel reste la même, seule l'unité change.
function aiModeFrom(mode) { return mode === 'km' ? 'hours' : mode; }

// Colonnes à écrire selon le schéma détecté.
function machineCounterPatch(value, machine) {
  return SCHEMA.hasCounter
    ? { counter_value: value, counter_unit: counterUnitOf(machine) }
    : { current_hours: value };
}
function planCounterPatch(interval, reminder) {
  return SCHEMA.hasCounter
    ? { interval_counter: interval, reminder_counter_before: reminder }
    : { interval_hours: interval, reminder_hours_before: reminder };
}
function planNextDueCounterPatch(nextDue) {
  return SCHEMA.hasCounter ? { next_due_counter: nextDue } : { next_due_hours: nextDue };
}
