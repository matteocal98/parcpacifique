/* KALEA — application (app.html) : Hors connexion, rappels du téléphone, connexion biométrique, verrouillage, abonnement Stripe, bouton retour Android, notifications push.
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · Consultation hors connexion
 *   · Rappels d'échéance sur le téléphone
 *   · Connexion sans mot de passe (empreinte / visage / code de l'appareil)
 *   · Verrouillage de l'application
 *   · Retour de paiement Stripe : confirmation du forfait
 *   · Retour du PORTAIL de facturation (?abonnement=retour)
 *   · Gestion de l'abonnement : portail de facturation Stripe
 *   · BOUTON/GESTE « RETOUR » ANDROID : ferme la modale ouverte plutôt que
 *   · L'ÉTAT DE L'AUTORISATION, TOUJOURS VISIBLE
 *   · LE BOUTON DE TEST
 *   · RAPPELS PUSH (FCM), CIBLÉS PAR RÔLE
 */
// ───────────────────────── début du code ─────────────────────────
// ── Consultation hors connexion ───────────────────────────────
// L'application Android embarque ses fichiers : elle DÉMARRE sans réseau. Reste
// à pouvoir consulter quelque chose — d'où cette copie des dernières données
// reçues. Sans elle, l'utilisateur hors connexion verrait un écran de chargement
// puis une erreur, alors que sa tournée de machines est déjà sur son téléphone.
//
// Les modifications, elles, continuent d'exiger la connexion : le bandeau le
// dit, et aucun écrit n'est tenté puis perdu.
const CACHE_CLE = 'parcpacific.derniere-donnees.v1';

// Durée de vie de la copie locale. Au-delà, elle est EFFACÉE : garder
// indéfiniment des noms de machines, des plans d'entretien et des coordonnées
// sur un appareil est un risque qui ne se justifie pas — une copie de trois
// semaines n'a plus aucune valeur pour l'utilisateur.
const CACHE_DUREE_MS = 7 * 24 * 60 * 60 * 1000;
const HORS_LIGNE_CLE = 'parcpacific.hors-ligne';

// La copie locale est un CONFORT, pas un dû : l'utilisateur peut la refuser
// depuis « Mon compte », et le refus efface immédiatement ce qui est stocké.
function copieHorsLigneActive() {
  try { return localStorage.getItem(HORS_LIGNE_CLE) !== 'non'; } catch (err) { return true; }
}

function reglerCopieHorsLigne(actif) {
  try {
    if (actif) {
      localStorage.removeItem(HORS_LIGNE_CLE);
    } else {
      localStorage.setItem(HORS_LIGNE_CLE, 'non');
      localStorage.removeItem(CACHE_CLE);
    }
  } catch (err) { /* stockage indisponible : sans conséquence */ }
}

function enregistrerCache(donnees) {
  if (!copieHorsLigneActive()) return;
  try {
    localStorage.setItem(CACHE_CLE, JSON.stringify({ ...donnees, schema: { ...SCHEMA }, savedAt: Date.now() }));
  } catch (err) {
    // Espace plein ou mode privé : ce n'est pas un motif d'échec pour le
    // chargement, la copie est un confort.
    console.warn('Copie hors connexion impossible :', err && err.message);
  }
}

function lireCache() {
  try {
    if (!copieHorsLigneActive()) return null;
    const brut = localStorage.getItem(CACHE_CLE);
    if (!brut) return null;
    const donnees = JSON.parse(brut);
    const perimee = !donnees
      || typeof donnees.savedAt !== 'number'
      || Date.now() - donnees.savedAt > CACHE_DUREE_MS;
    if (perimee) {
      // Copie périmée ou illisible : on l'efface plutôt que de la garder.
      localStorage.removeItem(CACHE_CLE);
      return null;
    }
    // Une copie sans machines n'a aucun intérêt : on la considère comme absente.
    return Array.isArray(donnees.machines) ? donnees : null;
  } catch (err) {
    return null;
  }
}

function effacerCache() {
  try { localStorage.removeItem(CACHE_CLE); } catch (err) { /* sans conséquence */ }
}

// Âge de la copie, en français courant : c'est ce qui indique à l'utilisateur si
// ce qu'il regarde date de ce matin ou de la semaine dernière.
function ageLisible(horodatage) {
  if (!horodatage) return '';
  const minutes = Math.max(0, Math.round((Date.now() - horodatage) / 60000));
  if (minutes < 2) return trad('à l\'instant');
  if (minutes < 60) return tR('il y a {n} minutes', { n: minutes });
  const heures = Math.round(minutes / 60);
  if (heures < 24) return tR('il y a {n} h', { n: heures });
  const jours = Math.round(heures / 24);
  return jours <= 1 ? trad('hier') : tR('il y a {n} jours', { n: jours });
}

// Une erreur de réseau se distingue d'un refus du serveur : seule la première
// justifie de se rabattre sur la copie locale. Un « profil introuvable » ou une
// règle d'accès refusée doivent rester visibles, sinon on masquerait un vrai
// problème de compte derrière des données périmées.
function estErreurReseau(erreur) {
  if (!erreur) return false;
  if (navigator && navigator.onLine === false) return true;
  const texte = String(erreur.message || erreur || '');
  return /failed to fetch|networkerror|network request failed|load failed|timeout|timed out|offline|err_internet|fetch failed/i.test(texte);
}

// Sonde une colonne pour savoir si une migration est en place (TCO, rappels,
// prénom/nom de contact…). Une SEULE tentative faisait disparaître toute une
// fonctionnalité pour le reste de la session dès qu'une requête 4G ratait
// une fois — pas parce que la colonne manquait vraiment, mais parce que
// estErreurReseau() ne dit rien sur le SCHÉMA, seulement sur le RÉSEAU au
// moment de l'appel. Constaté en direct sur un vrai téléphone : le bandeau
// TCO du tableau de bord disparaissait, revenait, disparaissait selon les
// aléas du réseau à chaque démarrage — jamais un vrai décalage d'affichage,
// une fonctionnalité entière qui clignote. Une seule reprise, après une
// courte pause, absorbe l'immense majorité des accrocs transitoires ; une
// vraie colonne absente (erreur Postgres, pas réseau) échoue tout de suite,
// sans attendre inutilement.
async function sonderColonne(table, colonne) {
  for (let essai = 0; essai < 2; essai++) {
    const { error } = await sb.from(table).select(colonne).limit(1);
    if (!error) return true;
    if (!estErreurReseau(error) || essai === 1) return false;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return false;
}

function bandeauHorsLigneHtml() {
  if (!UI.horsLigne) return '';
  const age = ageLisible(UI.horsLigne.depuis);
  return `
    <div class="offline-banner" role="status">
      <span>${tR('Hors connexion — dernières données reçues {age}. Le compteur reste modifiable : le relevé partira au retour du réseau.', { age: esc(age) })}</span>
      <button type="button" class="link-inline" id="offline-retry">${trad('Réessayer')}</button>
    </div>`;
}

// ── Rappels d'échéance sur le téléphone ───────────────────────
// L'application Android programme elle-même ses notifications : ni service
// tiers, ni compte Google, ni réseau. Sur le web, tout ce bloc reste inerte
// (window.Capacitor n'existe pas) — la rubrique « Mon compte » le dit alors.
const RAPPELS_PREF = 'parcpacific.rappels-echeances.v1';
const RAPPELS_MAX = 40;

function pluginRappels() {
  const cap = window.Capacitor;
  return (cap && cap.Plugins && cap.Plugins.LocalNotifications) || null;
}
function rappelsDisponibles() { return !!pluginRappels(); }

// ── Connexion sans mot de passe (empreinte / visage / code de l'appareil) ────
//
// GREFFON : @capgo/capacitor-native-biometric 8.6.10 (MPL-2.0). Cette application
// n'a pas d'assembleur : AUCUN import npm, le greffon est déclaré par Capacitor et
// s'annonce sur window.Capacitor.Plugins.NativeBiometric — exactement comme
// LocalNotifications pour les rappels. Sur le web, il n'existe pas.
//
// SIGNATURES VÉRIFIÉES dans la documentation officielle du greffon
// (capgo.app/docs/plugins/native-biometric et README du dépôt
// Cap-go/capacitor-native-biometric, version majeure 8) :
//   isAvailable({ useFallback?, preferMultipleBiometryType? }) -> AvailableResult
//     AvailableResult : { isAvailable, authenticationStrength, biometryType,
//                         deviceIsSecure, strongBiometryIsAvailable, errorCode? }
//   verifyIdentity({ reason, title, subtitle, description, negativeButtonText,
//                    useFallback?, fallbackTitle?, maxAttempts?, allowedBiometryTypes? })
//   setCredentials({ username, password, server, accessControl? })
//   getCredentials({ server }) -> { username, password }
//   deleteCredentials({ server }) -> Promise<void>
//   BiometryType : 0 NONE, 1 TOUCH_ID, 2 FACE_ID, 3 FINGERPRINT,
//                  4 FACE_AUTHENTICATION, 5 IRIS, 6 MULTIPLE, 7 DEVICE_CREDENTIAL.
//   AuthenticationStrength : 0 NONE, 1 STRONG, 2 WEAK.
//   Erreurs : 10 échec, 16 annulation, 17 repli, 1 indisponible,
//             3 rien d'enrôlé, 2/4 verrouillage, 14 code de déverrouillage absent.
//
// DEUX POINTS DÉCISIFS, tirés de cette documentation et constatés sur le terrain
// (Honor Magic7 Pro : visage 3D enregistré en classe FAIBLE, empreinte sous
// l'écran) :
//   • isAvailable() SANS useFallback ne regarde que la biométrie FORTE. Un visage
//     classé faible — ou un simple code de déverrouillage — le fait répondre
//     isAvailable:false alors que l'appareil authentifie parfaitement. La
//     documentation précise que sur Android ce drapeau est honoré par
//     isAvailable() : le calcul natif est
//     `fallbackAvailable = useFallback && deviceIsSecure`. On demande donc
//     TOUJOURS useFallback:true.
//   • verifyIdentity() : ne PAS passer allowedBiometryTypes — sans ce filtre, la
//     documentation indique que TOUTES les classes enrôlées, fortes ET faibles
//     (visage compris), sont proposées. useFallback y est ignoré sur Android
//     (l'authentificateur DEVICE_CREDENTIAL et le bouton d'annulation sont
//     exclusifs) : on le passe quand même, il sert sur iOS.
//
// SÉCURITÉ : le mot de passe n'est JAMAIS enregistré. Le « password » confié au
// trousseau du système (Keystore Android) est le JETON DE RAFRAÎCHISSEMENT de la
// session Supabase, que le serveur peut révoquer. Le greffon documente lui-même
// que verifyIdentity() est un confort et non une barrière de sécurité
// (contournable sur un appareil rooté) : l'authentification réelle reste celle du
// serveur, qui valide le jeton.
const BIOMETRIE_CLE = 'parcpacific.biometrie.v1';
const BIOMETRIE_SERVEUR = 'keeva.work';

// ── Verrouillage de l'application ────────────────────────────────────────────
// POURQUOI : la session Supabase persiste d'une ouverture à l'autre. Sans verrou,
// rouvrir l'application affichait le parc directement. Le verrou est demandé À
// L'OUVERTURE, AVANT tout rendu : ni le parc, ni la copie hors connexion ne
// s'affichent avant une vérification réussie.
//
// DÉCOUPLÉ DU TROUSSEAU : c'est un verrou d'AFFICHAGE. Il ne dépend que d'une
// chose — le téléphone sait-il vérifier une identité ? — et pas du tout de
// l'enregistrement d'un jeton, que certains appareils (Honor MagicOS, constaté)
// refusent. Un appareil dont le trousseau refuse tout peut donc verrouiller.
//
// Le verrou est LOCAL et ne dépend PAS du réseau : un appareil hors connexion avec
// une session valide se déverrouille, puis affiche la copie locale comme avant.
// ── Retour de paiement Stripe : confirmation du forfait ──────────────────────
// POURQUOI : la page de paiement renvoyait sur l'écran de connexion, sans un mot.
// Le client payait et ne voyait nulle part que son palier avait changé. Stripe
// renvoie désormais sur app.html?forfait=eco (ou =pro) : le paramètre est lu ici,
// et rien n'est affiché pour une autre valeur — on n'invente aucun message.
//
// LES QUATRE OFFRES SONT ACCEPTÉES : la nouvelle grille en ajoute deux (starter,
// business) et garde les clés historiques (eco, pro, paid, unlimited) — un
// ancien lien de paiement doit continuer de fonctionner. Un palier inconnu, lui,
// n'affiche toujours rien.
//
// Le palier est RELU en base, jamais supposé : le webhook Stripe écrit quelques
// secondes après le paiement. Tant qu'il n'est pas là, on le dit honnêtement,
// au lieu d'annoncer une activation qui n'a pas eu lieu.
const FORFAIT_PARAM = 'forfait';
const FORFAIT_VALEURS = ['starter', 'business', 'enterprise', 'eco', 'pro', 'paid', 'unlimited'];
const FORFAIT_ATTENTES_MS = [0, 3000, 6000];   // relecture : maintenant, puis 3 s, puis 6 s
let forfaitAnnonce = false;                    // une seule confirmation par ouverture

// LE NOM DE L'OFFRE, ÉCRIT UNE SEULE FOIS : il vient de OFFRES_LIBELLES, la
// table qui sert déjà à « Mon compte ». Un client sur une offre historique voit
// donc le nom sous lequel on la lui présente désormais (eco → Starter / Artisan),
// sans qu'aucune ligne ait été migrée : c'est une correspondance d'affichage.
function offreNom(palier) {
  const nom = OFFRES_LIBELLES[palier];
  return typeof nom === 'string' ? trad(nom) : null;
}

// LE LIBELLÉ COMPLET D'UN PALIER, pour le retour du portail de facturation :
// « Starter / Artisan — 12 €/mois, 5 machines suivies ». La phrase vient de
// LIBELLE_PALIER, la table écrite pour « Mon compte » — donc rien n'est recopié
// ici, et un palier inconnu se montre tel qu'on le lit.
function libellePalier(palier) {
  return trad(LIBELLE_PALIER[palier] || String(palier));
}

// LE PALIER EST-IL PAYANT ? « free » et « » ne le sont pas ; tout le reste
// (starter, business, enterprise, eco, pro, paid, unlimited) l'est — c'est la
// table des paliers payants, tenue à côté de LIBELLE_PALIER.
function palierPayant(palier) {
  return PALIERS_PAYANTS.indexOf(palier) !== -1;
}

// Lit ?forfait=… . Renvoie null si le paramètre est absent OU inconnu :
// dans les deux cas on n'affiche rien de spécial.
function forfaitDemande() {
  const trouve = new RegExp('[?&]' + FORFAIT_PARAM + '=([^&#]*)').exec(location.search || '');
  if (!trouve) return null;
  const valeur = decodeURIComponent(trouve[1]).toLowerCase();
  return FORFAIT_VALEURS.indexOf(valeur) === -1 ? null : valeur;
}

// Ce que dit l'écran de connexion quand le paiement arrive sans session : le cas
// réel observé, où le retour de Stripe tombait sur l'écran de connexion. Le nom
// de l'offre vient de OFFRES_LIBELLES — jamais recopié.
function messageForfaitConnexion() {
  const forfait = forfaitDemande();
  const nom = forfait ? offreNom(forfait) : null;
  if (!nom) return '';
  return tR('Ton paiement est enregistré : connecte-toi pour activer ton forfait {offre}.', { offre: nom });
}

// Retire les paramètres de retour de l'adresse : un rechargement ne doit pas
// remontrer la confirmation. Les autres paramètres et l'ancre sont conservés.
// Les DEUX paramètres partent ensemble : quand `?forfait=` gagne, laisser
// `?abonnement=` dans l'adresse ferait parler l'application une seconde fois.
function nettoyerParametres() {
  try {
    const parametres = new URLSearchParams(location.search || '');
    parametres.delete(FORFAIT_PARAM);
    parametres.delete(ABONNEMENT_PARAM);
    const reste = parametres.toString();
    history.replaceState(null, '', location.pathname + (reste ? '?' + reste : '') + (location.hash || ''));
  } catch (err) { /* sans conséquence : au pire la confirmation reviendra */ }
}

// Relit le palier en base, et met à jour l'affichage s'il a changé — pour que la
// limite de machines montrée soit la vraie, pas celle d'avant le paiement.
async function relirePalier() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data } = await sb.from('profiles').select('company_id, companies(plan)').eq('id', session.user.id).single();
  const societe = data && (Array.isArray(data.companies) ? data.companies[0] : data.companies);
  if (!societe) return null;
  const palier = societe.plan || 'free';
  if (palier !== UI.companyPlan) {
    UI.companyPlan = palier;
    if (UI.company) UI.company.plan = palier;
    renderApp();
  }
  return palier;
}

// Deux tentatives espacées après la première lecture : le webhook peut arriver
// une ou deux secondes plus tard. Au-delà, on ne ment pas — on le dira.
async function palierActif(attendu) {
  for (const attente of FORFAIT_ATTENTES_MS) {
    if (attente) await new Promise((resoudre) => setTimeout(resoudre, attente));
    try {
      if ((await relirePalier()) === attendu) return true;
    } catch (err) { /* réseau : on retente, et on le dira si ça échoue */ }
  }
  return false;
}

// Fenêtre de confirmation, commune au retour de paiement ET au retour du portail
// de facturation : mêmes qualités d'accessibilité dans les deux cas — dialogue
// annoncé, foyer posé sur le bouton, Échap et clic à côté pour fermer (fenêtres
// globales), et le parc reste rendu derrière.
function afficherFenetreConfirmation(titre, corps) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="forfait-titre">
      <h2 id="forfait-titre">${titre}</h2>
      <p class="sub">${corps}</p>
      <div class="modal-actions">
        <button type="button" class="primary" id="forfait-continuer">${trad('Continuer vers le parc')}</button>
      </div>
    </div>`;
  const fermer = () => overlay.remove();
  // document.getElementById : la fenêtre est déjà dans le document, et le bouton
  // reçoit le FOYER — au clavier, Entrée valide, Échap ferme (fenêtres globales).
  const bouton = document.getElementById('forfait-continuer');
  if (bouton) {
    bouton.addEventListener('click', fermer);
    bouton.focus();
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
}

// Confirmation du retour de paiement, aux couleurs de la marque, sans emoji.
// Le nom de l'offre vient de OFFRES_LIBELLES : un client qui revient de Stripe
// avec ?forfait=starter lit « ton forfait Starter / Artisan », pas un code.
function afficherConfirmationForfait(forfait, actif) {
  if (actif) {
    const nom = offreNom(forfait);
    if (!nom) return;
    afficherFenetreConfirmation(
      tR('Ton forfait {offre} est actif', { offre: nom }),
      forfait === 'eco' || forfait === 'starter'
        ? trad("Jusqu'à 5 machines suivies.")
        : trad('Machines suivies sans limite.'));
    return;
  }
  afficherFenetreConfirmation(trad('Ton paiement est bien enregistré'),
    trad("L'activation peut prendre une minute. Recharge la page dans un instant."));
}

// ── Retour du PORTAIL de facturation (?abonnement=retour) ────────────────────
// Le client a pu y résilier, changer de carte ou changer d'offre : l'application
// ne le sait pas. Elle relit donc le palier et ne dit que ce qu'elle observe.
// Surtout, elle n'annonce JAMAIS une résiliation : rien ici ne permet de la
// constater, et elle ne prend effet qu'à la fin de la période déjà réglée.
const ABONNEMENT_PARAM = 'abonnement';

function abonnementRetour() {
  const trouve = new RegExp('[?&]' + ABONNEMENT_PARAM + '=([^&#]*)').exec(location.search || '');
  return Boolean(trouve) && decodeURIComponent(trouve[1]).toLowerCase() === 'retour';
}

async function annoncerRetourPortail() {
  const avant = UI.companyPlan;
  let apres = null;
  try { apres = await relirePalier(); } catch (err) { /* réseau : on ne supposera rien */ }
  if (apres && apres !== avant) {
    // Palier changé : le prorata s'applique tout de suite, on annonce le nouveau.
    if (apres === 'eco' || apres === 'pro') { afficherConfirmationForfait(apres, true); return; }
    afficherFenetreConfirmation(trad('Ton offre a changé'), libellePalier(apres));
    return;
  }
  // Palier inchangé — le cas le plus fréquent (résiliation demandée ou carte
  // mise à jour). On dit ce qu'on sait, et on ne promet aucun remboursement.
  afficherFenetreConfirmation(
    trad("Tes réglages d'abonnement sont enregistrés"),
    tR("Tes réglages d'abonnement sont enregistrés. Ton offre actuelle : {offre}. Si tu as demandé une résiliation, l'accès reste actif jusqu'à la fin de la période déjà réglée ; le détail est dans « Mon compte ».", { offre: libellePalier(apres || avant) }));
}

// Appelée à la fin d'un boot() réussi : c'est le seul moment où l'on sait que
// l'utilisateur est connecté ET que le parc est déjà rendu derrière la fenêtre.
// `?forfait=` garde la PRIORITÉ sur `?abonnement=` : c'est le retour d'un
// paiement, l'information la plus forte. Les deux paramètres sont consommés.
async function annoncerForfait() {
  if (forfaitAnnonce) return;
  const forfait = forfaitDemande();
  const retourPortail = forfait ? false : abonnementRetour();
  if (!forfait && !retourPortail) return;
  forfaitAnnonce = true;
  nettoyerParametres();
  if (forfait) {
    const actif = await palierActif(forfait);
    afficherConfirmationForfait(forfait, actif);
    return;
  }
  await annoncerRetourPortail();
}

// ── Gestion de l'abonnement : portail de facturation Stripe ──────────────────
// POURQUOI : un service par abonnement ne peut pas demander à son client
// d'écrire à un support pour arrêter son abonnement. Le bouton ci-dessous ouvre
// le portail de facturation Stripe, où le client résilie (à la fin de la période
// DÉJÀ PAYÉE), change de carte, télécharge ses factures et met à jour ses
// coordonnées. Aucune résiliation immédiate, aucun remboursement au prorata :
// ce n'est pas oublié, c'est le fonctionnement de Stripe.
//
// La fonction Edge `stripe-portal` est appelée SANS aucun paramètre : c'est le
// jeton de l'utilisateur qui détermine le compte. L'application ne transmet donc
// jamais d'identifiant de société, et ne peut pas viser le compte d'un autre.
//
// Deux endroits l'appellent : « Mon compte » (Gérer mon abonnement) et la fenêtre
// des offres, pour un client DÉJÀ abonné qui veut changer d'offre — là, un lien
// de paiement lui ferait souscrire un SECOND abonnement. Les identifiants de la
// zone d'annonce et du bouton sont donc paramétrables.
async function ouvrirPortailAbonnement(idMessage, idBouton) {
  const message = document.getElementById(idMessage || 'acc-portail-msg');
  const bouton = document.getElementById(idBouton || 'acc-portail');
  const dire = (texte) => { if (message) message.textContent = texte; };
  const indisponible = () => trad('Le portail est indisponible pour le moment. Réessaie dans un instant, ou écris à support@kalea.pro.');
  dire('');
  if (bouton) bouton.disabled = true;
  try {
    const { data, error } = await sb.functions.invoke('stripe-portal', { method: 'POST' });
    if (error) { dire(messagePortail(error)); return; }
    const url = data && data.url;
    // Pas d'adresse : on le dit, plutôt que d'ouvrir une page vide ou un bouton mort.
    if (!url) { dire(indisponible()); return; }
    ouvrirLienExterne(url);
  } catch (err) {
    dire(indisponible());
  } finally {
    if (bouton) bouton.disabled = false;
  }
}

// Les cas d'erreur, dits honnêtement. 409 : le compte n'a aucun abonnement
// rattaché (compte gratuit, ou webhook Stripe pas encore passé). Tout le reste —
// réseau, 401, 500, 502 — c'est « réessaie, ou écris-nous ».
function messagePortail(erreur) {
  const statut = erreur && erreur.context && erreur.context.status;
  if (statut === 409) return trad("Aucun abonnement n'est rattaché à ce compte.");
  return trad('Le portail est indisponible pour le moment. Réessaie dans un instant, ou écris à support@kalea.pro.');
}

// Même mécanisme que les liens de paiement : une ancre target="_blank"
// rel="noopener", qui fonctionne dans le WebView Android. L'adresse n'est connue
// qu'après la réponse, donc l'ancre est construite puis cliquée.
function ouvrirLienExterne(url) {
  const lien = document.createElement('a');
  lien.href = url;
  lien.target = '_blank';
  lien.rel = 'noopener';
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
}

const VERROU_CLE = 'parcpacific.verrou.v1';
// Durée d'absence tolérée avant de redemander la vérification. En deçà, revenir
// d'une autre application ne doit rien changer : 30 secondes couvrent la lecture
// d'un message ou la prise d'une photo, et referment l'écran au-delà.
const VERROU_ARRIERE_PLAN_MS = 30 * 1000;

// Modes d'enregistrement du jeton (option séparée, dite « reconnexion
// automatique »). Valeurs de l'énumération AccessControl du greffon, relevées dans
// sa documentation : NONE = 0, BIOMETRY_CURRENT_SET = 1, BIOMETRY_ANY = 2.
// BIOMETRY_ANY protège la RELECTURE par une authentification système ; NONE laisse
// le jeton lisible par l'application, mais il reste chiffré par le trousseau
// Android — et c'est alors le verrou applicatif qui impose l'authentification.
const ACCES_MODE_CLE = 'parcpacific.acces-mode.v1';
const ACCES_BIOMETRIE_ANY = 2;   // AccessControl.BIOMETRY_ANY
const ACCES_NONE = 0;            // AccessControl.NONE

let verrouActif = false;    // l'écran de verrouillage occupe l'écran
let verrouLeve = false;     // identité prouvée pendant ce lancement
let verrouPropose = false;  // l'invite automatique est déjà partie pour ce verrou
let verrouEnCours = false;  // une vérification est en cours (pas de doublon)
let verrouMasque = 0;       // instant du passage en arrière-plan
let verrouEcoute = false;   // les écouteurs d'arrière-plan sont posés
let boutonRetourEcoute = false; // idem pour ecouterBoutonRetour() — un seul écouteur
let verrouGeneration = 0;   // numéro du verrou courant (périme les résultats tardifs)

// Le réglage « Verrouiller l'application », mémorisé sur l'appareil seulement.
function verrouRegle() {
  try { return localStorage.getItem(VERROU_CLE) === 'oui'; } catch (err) { return false; }
}
function reglerVerrouLocal(actif) {
  try {
    if (actif) localStorage.setItem(VERROU_CLE, 'oui');
    else localStorage.removeItem(VERROU_CLE);
  } catch (err) { /* stockage indisponible : le verrou reste désactivé */ }
}

// Mode retenu pour l'accès enregistré : 'biometry-any', 'none', ou 'echec'.
function accesMode() {
  try { return localStorage.getItem(ACCES_MODE_CLE) || ''; } catch (err) { return ''; }
}
function reglerAccesMode(mode) {
  try {
    if (mode) localStorage.setItem(ACCES_MODE_CLE, mode);
    else localStorage.removeItem(ACCES_MODE_CLE);
  } catch (err) { /* sans conséquence : le détail technique dira « inconnu » */ }
}
function accessControlDuMode(mode) {
  return mode === 'biometry-any' ? ACCES_BIOMETRIE_ANY : ACCES_NONE;
}

// Le verrou n'existe que dans l'application native, et seulement si l'utilisateur
// l'a activé : sur le web, rien de tout cela.
function verrouNecessaire() {
  if (!dansApplication()) return false;
  if (!verrouRegle()) return false;
  if (!pluginBiometrie()) {
    // Greffon absent (application installée avant la fonctionnalité) : rien ne
    // peut être vérifié, donc on n'enferme personne — et on retire le réglage,
    // qui laisserait croire à un verrou inexistant.
    reglerVerrouLocal(false);
    return false;
  }
  return true;
}

// Libellé du bouton : le verbe est « déverrouiller », pas « se connecter ».
function libelleVerrou(mode) {
  if (mode === 'visage') return trad('Déverrouiller par reconnaissance du visage');
  if (mode === 'empreinte') return trad('Déverrouiller par empreinte');
  if (mode === 'code') return trad('Déverrouiller avec le code de l\'appareil');
  return trad('Déverrouiller');
}

// Écran de verrouillage : la marque, une phrase, une action, et UNE issue de
// secours. Aucune donnée de l'application n'est montée ici — c'est tout l'intérêt.
function renderVerrouillage() {
  verrouActif = true;
  verrouPropose = false;
  const libelle = libelleVerrou(modeAcces(biometrieDernier.brut));
  app.innerHTML = `
    <div class="login-box verrou">
      <h1>KALEA</h1>
      <p>${trad('Déverrouille pour accéder à ton parc.')}</p>
      <div class="modal-actions">
        <button type="button" class="primary" id="verrou-bouton">${libelle}</button>
      </div>
      <div class="ui-aide" id="verrou-msg" role="status" aria-live="polite"></div>
      <button type="button" class="link-inline" id="verrou-sortie">${trad('Se déconnecter et ressaisir mon mot de passe')}</button>
    </div>`;
  document.getElementById('verrou-bouton').addEventListener('click', () => tenterDeverrouillage());
  document.getElementById('verrou-sortie').addEventListener('click', () => sortirDuVerrou());
  verrouEcouterArrierePlan();
  // Invite AUTOMATIQUE, une fois par verrouillage : l'utilisateur ne doit pas
  // avoir à chercher un bouton pour se faire reconnaître.
  tenterDeverrouillage();
}

// Verrouille maintenant : ouverture de l'application, ou retour après une absence
// assez longue. On rafraîchit d'abord ce que le téléphone annonce, pour nommer le
// bouton (empreinte, visage ou code de l'appareil).
async function verrouiller() {
  if (!verrouNecessaire()) return false;
  verrouLeve = false;
  // Un nouveau verrou REMPLACE le précédent : une vérification restée en attente
  // (invite jamais résolue par le système) ne doit pas bloquer celle-ci pour
  // toujours. C'est aussi ce qui périme son résultat éventuel.
  verrouGeneration += 1;
  verrouEnCours = false;
  await etatBiometrie();
  renderVerrouillage();
  return true;
}

// Une seule vérification à la fois.
async function tenterDeverrouillage() {
  if (verrouEnCours || !verrouActif) return;
  const generation = verrouGeneration;
  const bouton = document.getElementById('verrou-bouton');
  const msg = document.getElementById('verrou-msg');
  verrouEnCours = true;
  if (bouton) bouton.disabled = true;
  if (msg) msg.textContent = trad('Vérification demandée au téléphone…');
  const resultat = await verifierIdentite();
  // Le verrou a pu être remplacé pendant la vérification (déconnexion, nouveau
  // verrou) : un résultat périmé ne doit ni déverrouiller ni réafficher un
  // message sur un écran qui n'existe plus.
  if (generation !== verrouGeneration) return;
  verrouEnCours = false;
  if (bouton) bouton.disabled = false;
  if (resultat && resultat.ok) {
    verrouLeve = true;
    verrouActif = false;
    verrouMasque = 0;
    // Le parc (ou la copie hors connexion) s'affiche ENFIN — avec la session
    // existante : aucune nouvelle connexion n'est demandée.
    boot();
    return;
  }
  // Annulé ou refusé : on RESTE verrouillé, et le bouton reste là pour réessayer.
  messageBiometrie(msg, resultat);
}

// Seule issue quand la vérification ne passe pas : se déconnecter pour ressaisir
// son mot de passe. Le verrou est DÉSARMÉ au passage : sans cela, l'utilisateur qui
// n'arrive pas à s'authentifier serait enfermé de nouveau au lancement suivant.
async function sortirDuVerrou() {
  const msg = document.getElementById('verrou-msg');
  if (!window.confirm(trad('Se déconnecter, désactiver le verrou et effacer cet accès enregistré ?'))) return;
  if (msg) msg.textContent = trad('Déconnexion…');
  try {
    await sb.auth.signOut();
  } catch (err) { /* l'important est d'effacer ce qui est local : on continue */ }
  await oublierAccesSansMotDePasse();
  reglerVerrouLocal(false);
  verrouActif = false;
  verrouLeve = false;
  verrouMasque = 0;
  // Le verrou est démonté : toute vérification restée en attente devient sans
  // objet, et ne doit pas bloquer un futur verrouillage.
  verrouGeneration += 1;
  verrouEnCours = false;
  renderLogin(trad('Tu es déconnecté. Ressaisis ton mot de passe.'));
}

// Retour au premier plan : on redemande la vérification SEULEMENT si l'absence a
// duré au moins VERROU_ARRIERE_PLAN_MS. En deçà, rien : basculer vers une autre
// application et revenir ne doit pas être puni.
//
// Il ne s'agit QUE d'un reverrouillage d'AFFICHAGE : ni la session, ni la copie
// hors connexion ne sont touchées, et l'application reste utilisable sans réseau.
// Aucune déconnexion n'est déclenchée ici — jamais.
//
// POURQUOI @capacitor/app : dans le WebView Android, visibilitychange et focus
// sont intermittents — constaté sur le terrain, le verrou ne revenait pas. Le
// greffon officiel expose l'état réel de l'application (onStop / onResume du
// système). Comme LocalNotifications et NativeBiometric, il s'annonce sur
// window.Capacitor.Plugins.App : aucun import npm, aucun greffon à charger.
function pluginApplication() {
  const cap = window.Capacitor;
  const greffon = cap && cap.Plugins ? cap.Plugins.App : null;
  return greffon && typeof greffon.addListener === 'function' ? greffon : null;
}

function verrouEcouterArrierePlan() {
  if (verrouEcoute || !dansApplication()) return;
  verrouEcoute = true;
  const noterMasque = () => { if (!verrouActif) verrouMasque = Date.now(); };
  const revenir = () => {
    if (!verrouMasque) return;
    const ecoule = Date.now() - verrouMasque;
    verrouMasque = 0;
    if (verrouActif || !verrouNecessaire()) return;
    if (ecoule >= VERROU_ARRIERE_PLAN_MS) verrouiller();
  };
  // Un `blur` alors que la page reste visible vient d'une fenêtre système (invite
  // biométrique, clavier) : ce n'est pas un départ en arrière-plan, et cela ne doit
  // pas armer le verrou — sinon le temps passé à s'authentifier le refermerait.
  const masqueFenetre = () => {
    if (document.visibilityState && document.visibilityState !== 'hidden') return;
    noterMasque();
  };

  const application = pluginApplication();
  if (application) {
    // Voie normale : l'état remonté par le système. addListener rend une promesse
    // d'écouteur, mais l'écoute est posée dès l'appel : on n'attend rien.
    try {
      application.addListener('appStateChange', (etat) => {
        if (etat && etat.isActive === false) noterMasque();
        else revenir();
      });
      return;
    } catch (err) { /* greffon muet : le secours ci-dessous prend le relais */ }
  }

  // Secours — application installée AVANT @capacitor/app : les événements du
  // WebView, moins fiables, mais sans dépendance.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') noterMasque();
    else revenir();
  });
  window.addEventListener('focus', revenir);
  window.addEventListener('blur', masqueFenetre);
}

// ── BOUTON/GESTE « RETOUR » ANDROID : ferme la modale ouverte plutôt que
// de quitter l'appli ────────────────────────────────────────────────────
// Signalé par l'utilisateur : le geste natif (balayage depuis le bord) ou
// le bouton retour matériel ne fermaient aucune modale — il fallait
// toujours chercher le bouton Annuler/Fermer, parfois hors écran après un
// long formulaire. Le geste ET le bouton matériel émettent le MÊME
// évènement système Android (« retour »), intercepté ici via @capacitor/app
// (déjà utilisé pour verrouEcouterArrierePlan, même patron
// pluginApplication()/dansApplication() — aucun nouveau greffon).
// Toutes les modales de l'appli partagent la même structure (.overlay
// ajoutée à document.body, fermée par overlay.remove() — voir le clic hors
// modale déjà présent sur chacune) : fermer le DERNIER .overlay du DOM
// ferme donc la modale visuellement au-dessus (même si une seconde modale
// — sélecteur de date, liste de choix… — a été ouverte PAR-DESSUS une
// première), sans toucher au code de chaque modale une par une. Le verrou
// biométrique (renderVerrouillage) n'utilise PAS .overlay — jamais
// contournable par ce geste, intentionnellement.
function ecouterBoutonRetour() {
  if (boutonRetourEcoute || !dansApplication()) return;
  const application = pluginApplication();
  if (!application) return;
  boutonRetourEcoute = true;
  try {
    application.addListener('backButton', ({ canGoBack } = {}) => {
      const overlays = document.querySelectorAll('.overlay');
      if (overlays.length) { overlays[overlays.length - 1].remove(); return; }
      // Aucune modale ouverte : comportement standard Android (retour dans
      // l'historique web s'il y en a un, sinon on quitte l'appli — jamais
      // un écran bloqué qui ne répond plus au bouton retour).
      if (canGoBack) window.history.back();
      else if (typeof application.exitApp === 'function') application.exitApp();
    });
  } catch (err) { /* greffon muet : le bouton retour garde son comportement système par défaut */ }
}

// La connexion sans mot de passe de l'ÉCRAN DE CONNEXION prouve déjà l'identité :
// le verrou de ce lancement est donc levé. Sans cela, l'utilisateur serait reconnu
// deux fois de suite (invite de l'écran de connexion, puis verrou).
function verrouLeveParConnexion() {
  verrouLeve = true;
  verrouActif = false;
  verrouMasque = 0;
}

// Une seule proposition spontanée par lancement : l'invite ne doit pas revenir
// en boucle après un refus.
let biometrieProposee = false;

// Dernière réponse du greffon, conservée pour la carte « Mon compte » : une
// capture d'écran de cette carte doit suffire à diagnostiquer l'appareil à
// distance. On n'y met QUE des champs du greffon — jamais de jeton.
let biometrieDernier = {};

function pluginBiometrie() {
  const cap = window.Capacitor;
  return (cap && cap.Plugins && cap.Plugins.NativeBiometric) || null;
}

// La biométrie n'existe que dans l'application native. Le web n'a pas de
// window.Capacitor du tout : tout reste alors inerte et invisible.
function dansApplication() {
  const cap = window.Capacitor;
  return !!(cap && ((cap.isNativePlatform && cap.isNativePlatform()) || cap.platform === 'android'));
}

// Le choix est mémorisé SUR L'APPAREIL seulement, jamais côté serveur : c'est une
// commodité locale, pas un réglage de compte.
function biometrieActivee() {
  try { return localStorage.getItem(BIOMETRIE_CLE) === 'oui'; } catch (err) { return false; }
}
function reglerBiometrieActivee(actif) {
  try {
    if (actif) localStorage.setItem(BIOMETRIE_CLE, 'oui');
    else localStorage.removeItem(BIOMETRIE_CLE);
  } catch (err) { /* stockage indisponible : la fonctionnalité reste désactivée */ }
}

// Interroge le greffon AVEC le repli. Le détail brut n'est jamais perdu : il part
// dans la carte « Mon compte ». Une exception du greffon n'est pas traduite en
// « pas de capteur » : on garde son code et son message.
async function etatBiometrie() {
  const plugin = pluginBiometrie();
  if (!plugin) return { greffon: false, brut: null, utilisable: false, mode: 'aucun' };
  try {
    const brut = await plugin.isAvailable({ useFallback: true });
    const etat = brut || {};
    biometrieDernier.brut = etat;
    biometrieDernier.quand = Date.now();
    if (etat.errorCode !== undefined) biometrieDernier.errorCode = etat.errorCode;
    return { greffon: true, brut: etat, utilisable: biometrieUtilisable(etat), mode: modeAcces(etat) };
  } catch (err) {
    const code = err && (err.code !== undefined ? err.code : err.errorCode);
    biometrieDernier.brut = null;
    biometrieDernier.code = code === undefined ? null : code;
    biometrieDernier.message = (err && err.message) || '';
    biometrieDernier.quand = Date.now();
    // Seul le code est journalisé : jamais l'erreur entière, qui pourrait porter
    // des données du trousseau.
    console.warn('isAvailable sans mot de passe : code', code);
    return { greffon: true, brut: null, erreur: err, utilisable: false, mode: 'aucun' };
  }
}

// Ce qui décide de proposer la fonctionnalité : la biométrie, OU le verrouillage
// de l'appareil — jamais `isAvailable` seul, qui répond faux pour la biométrie
// faible comme pour un téléphone dont le seul verrou est un code.
function biometrieUtilisable(etat) {
  if (!etat) return false;
  if (etat.isAvailable === true) return true;
  if (typeof etat.authenticationStrength === 'number' && etat.authenticationStrength > 0) return true;
  return etat.deviceIsSecure === true;
}

// Ce que l'appareil propose, pour NOMMER la méthode dans l'interface.
// biometryType ne sert qu'à l'affichage : la documentation est explicite sur le
// fait que du matériel présent n'est pas forcément disponible.
function modeAcces(etat) {
  if (!etat) return 'aucun';
  const type = etat.biometryType;
  const biometrie = etat.isAvailable === true
    || (typeof etat.authenticationStrength === 'number' && etat.authenticationStrength > 0);
  if (biometrie) {
    if (type === 2 || type === 4) return 'visage';   // Face ID (iOS), visage Android
    if (type === 0 || type === 7) return 'code';     // disponible par le seul code
    return 'empreinte';                              // 1, 3, 5, 6
  }
  if (etat.deviceIsSecure === true) return 'code';
  return 'aucun';
}

// Libellés selon ce que l'appareil sait faire. Ce sont des littéraux du code : le
// dictionnaire les traduit (règle des chaînes déjà traduites).
function libellesAcces(mode) {
  if (mode === 'visage') {
    return {
      bouton: trad('Déverrouiller par reconnaissance du visage'),
      case: trad('Déverrouiller par reconnaissance du visage la prochaine fois'),
      repli: '',
    };
  }
  if (mode === 'code') {
    return {
      bouton: trad("Déverrouiller avec le code de l'appareil"),
      case: trad("Déverrouiller avec le code de l'appareil la prochaine fois"),
      repli: trad('Aucune biométrie utilisable n\'est annoncée : c\'est ton code, schéma ou mot de passe de téléphone qui servira.'),
    };
  }
  if (mode === 'empreinte') {
    return {
      bouton: trad('Déverrouiller par empreinte'),
      case: trad('Déverrouiller par empreinte la prochaine fois'),
      repli: '',
    };
  }
  // Rien d'annoncé : on ne renonce pas pour autant. La vérification réelle est le
  // seul juge — un « indisponible » de confort laisserait croire que le téléphone
  // n'a pas de capteur.
  // ★ LOT 2 — LES QUATRE ISSUES DE CETTE FONCTION DISENT « DÉVERROUILLER », PAS
  // « SE CONNECTER », ET ELLES SONT DÉSORMAIS TRADUITES. Le premier point est le
  // fond : ces libellés mènent à connexionSansMotDePasse(), qui relit un JETON DE
  // SESSION enregistré dans le trousseau — la personne s'est donc déjà connectée
  // AVEC SON MOT DE PASSE, et c'est ce mot de passe qui a autorisé l'enregistrement
  // du jeton. La biométrie ne remplace pas le mot de passe : elle rouvre la session
  // gardée sur CE téléphone. Le second point est un défaut trouvé en écrivant ce
  // lot : les `bouton:` et `case:` ci-dessus étaient des littéraux NUS, donc
  // affichés EN FRANÇAIS dans l'interface anglaise (l'extraction automatique ne
  // descend pas dans ces propriétés). Mêmes cas, mêmes replis, mêmes phrases :
  // seuls les mots changent — et ils passent maintenant par trad().
  return {
    bouton: trad('Essayer le déverrouillage par biométrie'),
    case: trad('Essayer le déverrouillage par biométrie la prochaine fois'),
    repli: trad('Le téléphone n\'annonce ni biométrie ni verrouillage utilisable. Tu peux essayer : la vérification dira ce que le capteur répond.'),
  };
}

// Vérification d'identité SEULE : c'est elle qui décide, pas isAvailable(). On
// tente toujours, et on rapporte ce que le greffon a répondu (code compris).
async function verifierIdentite() {
  const plugin = pluginBiometrie();
  if (!plugin) return { echec: 'greffon' };
  try {
    await plugin.verifyIdentity({
      reason: trad('Déverrouille KALEA'),
      title: trad('Connexion à KALEA'),
      subtitle: trad('Empreinte, visage ou code du téléphone'),
      description: trad('Ton mot de passe n\'est pas enregistré : cette vérification ouvre la session gardée sur ce téléphone.'),
      negativeButtonText: trad('Annuler'),
      // iOS seulement : Android ignore ce drapeau ici (voir l'en-tête) — le repli
      // Android passe par isAvailable({ useFallback: true }).
      useFallback: true,
      // Android : 1 tentative par défaut, c'est trop peu pour un capteur qui
      // hésite ; 5 est le maximum autorisé par Android.
      maxAttempts: 3,
    });
    biometrieDernier.verification = 'ok';
    biometrieDernier.quand = Date.now();
    return { ok: true };
  } catch (err) {
    const code = err && (err.code !== undefined ? err.code : err.errorCode);
    biometrieDernier.verification = 'echec';
    biometrieDernier.code = code === undefined ? null : code;
    biometrieDernier.message = (err && err.message) || '';
    biometrieDernier.quand = Date.now();
    // Annulation volontaire ou échec d'authentification : l'accès reste
    // enregistré, l'utilisateur peut réessayer. On ne journalise que le code.
    console.warn('Vérification sans mot de passe : code', code);
    if (code === 10 || code === 16 || code === 17) return { annule: true, code };
    return { echec: 'verification', code };
  }
}

// Enregistre l'accès : adresse du compte + jeton de rafraîchissement. Deux
// tentatives, dans l'ordre de protection décroissante, et on RETIENT le mode qui a
// réussi (il est affiché dans le détail technique de « Mon compte ») :
//   1. accessControl BIOMETRY_ANY (2) : la RELECTURE demande l'identité au système ;
//   2. accessControl NONE (0) : le jeton reste chiffré par le trousseau Android,
//      mais lisible sans invite — c'est alors le verrou applicatif qui impose
//      l'authentification avant de s'en servir.
// Un trousseau qui refuse les deux (constaté sur Honor MagicOS) n'est PAS une
// panne : le verrou d'affichage, lui, ne dépend pas du trousseau.
async function enregistrerAccesSansMotDePasse(email) {
  const plugin = pluginBiometrie();
  if (!plugin) return { echec: 'greffon' };
  let session = null;
  try {
    const { data } = await sb.auth.getSession();
    session = data && data.session;
  } catch (err) { session = null; }
  if (!session || !session.refresh_token) return { echec: 'session' };
  const identifiants = {
    username: email || (session.user && session.user.email) || '',
    password: session.refresh_token,
    server: BIOMETRIE_SERVEUR,
  };
  const tentatives = [
    { mode: 'biometry-any', accessControl: ACCES_BIOMETRIE_ANY },
    { mode: 'none', accessControl: ACCES_NONE },
  ];
  for (const tentative of tentatives) {
    try {
      await plugin.setCredentials({ ...identifiants, accessControl: tentative.accessControl });
      reglerBiometrieActivee(true);
      reglerAccesMode(tentative.mode);
      biometrieDernier.enregistrement = 'ok';
      biometrieDernier.mode = tentative.mode;
      biometrieDernier.accessControl = tentative.accessControl;
      biometrieDernier.quand = Date.now();
      return { ok: true, mode: tentative.mode };
    } catch (err) {
      const code = err && (err.code !== undefined ? err.code : err.errorCode);
      biometrieDernier.enregistrement = 'echec';
      biometrieDernier.mode = tentative.mode + ' refuse';
      biometrieDernier.accessControl = tentative.accessControl;
      biometrieDernier.code = code === undefined ? null : code;
      biometrieDernier.message = (err && err.message) || '';
      biometrieDernier.quand = Date.now();
      console.warn('Trousseau (' + tentative.mode + ') : code', code);
    }
  }
  reglerBiometrieActivee(false);
  reglerAccesMode('echec');
  return { echec: 'trousseau', code: biometrieDernier.code };
}

async function oublierAccesSansMotDePasse() {
  reglerBiometrieActivee(false);
  reglerAccesMode('');
  const plugin = pluginBiometrie();
  biometrieDernier.enregistrement = 'efface';
  if (!plugin) return;
  try { await plugin.deleteCredentials({ server: BIOMETRIE_SERVEUR }); } catch (err) { /* déjà absent */ }
}

// Relit le jeton enregistré selon le mode retenu. Le mode protégé
// (getSecureCredentials) fait lui-même demander l'identité : on ne la demande donc
// jamais deux fois. Si le mode retenu ne répond plus (changement de version du
// greffon, empreintes modifiées), on essaie l'autre et on corrige le mode.
// Code 21 = plus rien de protégé dans le trousseau : on bascule sur l'autre mode
// au lieu d'effacer l'accès ; une annulation (10/16/17) ne supprime rien non plus.
async function lireAccesEnregistre(plugin, mode) {
  const ordre = mode === 'biometry-any' ? ['biometry-any', 'none'] : ['none', 'biometry-any'];
  for (const essai of ordre) {
    try {
      const identifiants = essai === 'biometry-any'
        ? await plugin.getSecureCredentials({
            server: BIOMETRIE_SERVEUR,
            reason: trad('Relire ton accès KALEA'),
            title: trad('Connexion à KALEA'),
            subtitle: trad('Empreinte, visage ou code du téléphone'),
            description: trad('Ton mot de passe n\'est pas enregistré : cette vérification ouvre la session gardée sur ce téléphone.'),
            negativeButtonText: trad('Annuler'),
          })
        : await plugin.getCredentials({ server: BIOMETRIE_SERVEUR });
      if (identifiants && identifiants.password) {
        if (essai !== mode) reglerAccesMode(essai);
        biometrieDernier.mode = essai;
        return { identifiants, mode: essai };
      }
    } catch (err) {
      const code = err && (err.code !== undefined ? err.code : err.errorCode);
      biometrieDernier.code = code === undefined ? null : code;
      biometrieDernier.message = (err && err.message) || '';
      if (code === 10 || code === 16 || code === 17) return { annule: true, code };
      if (code === 21) biometrieDernier.mode = essai + ' absent';
    }
  }
  return { echec: 'lecture' };
}

// Connexion sans mot de passe : lecture du jeton enregistré, puis rafraîchissement
// par le SERVEUR (c'est lui qui authentifie réellement). Le jeton TOURNE à chaque
// usage : on réécrit donc immédiatement le nouveau, sinon l'accès enregistré serait
// périmé dès la deuxième connexion.
async function connexionSansMotDePasse() {
  const plugin = pluginBiometrie();
  if (!plugin) return { echec: 'greffon' };
  const mode = accesMode();
  // En mode protégé, la relecture demande déjà l'identité au système : la demander
  // une fois de plus ferait deux invites d'affilée.
  if (mode !== 'biometry-any') {
    const verification = await verifierIdentite();
    if (!verification.ok) return verification;
  }
  const lecture = await lireAccesEnregistre(plugin, mode);
  if (lecture.annule) return lecture;
  const identifiants = lecture.identifiants;
  const jeton = identifiants && identifiants.password;
  if (!jeton) {
    await oublierAccesSansMotDePasse();
    return { echec: 'jeton' };
  }
  let session = null;
  try {
    const reponse = await sb.auth.refreshSession({ refresh_token: jeton });
    if (reponse && !reponse.error) session = reponse.data && reponse.data.session;
  } catch (err) {
    session = null;
  }
  if (!session) {
    // Jeton révoqué ou expiré : on efface l'accès, sinon l'écran proposerait à
    // chaque lancement une connexion qui échouerait en silence.
    await oublierAccesSansMotDePasse();
    return { echec: 'jeton' };
  }
  try {
    await plugin.setCredentials({
      username: identifiants.username || (session.user && session.user.email) || '',
      password: session.refresh_token,
      server: BIOMETRIE_SERVEUR,
      accessControl: accessControlDuMode(lecture.mode || mode),
    });
  } catch (err) { /* session ouverte : la réécriture se refera à la prochaine connexion par mot de passe */ }
  verrouLeveParConnexion();
  return { ok: true };
}

// Appelée juste après une connexion par mot de passe, SI l'utilisateur a coché la
// case de l'écran de connexion (geste explicite). On ne refuse pas sur un simple
// isAvailable() faux : on demande une vérification RÉELLE, puis on enregistre.
// Le résultat n'est pas annoncé ici : un échec de cette option est expliqué dans
// « Mon compte », jamais par un message au démarrage.
async function proposerAccesSansMotDePasse(email) {
  if (!dansApplication()) return undefined;
  const cochee = document.getElementById('bio-activer');
  if (!cochee) return undefined;
  if (!cochee.checked) {
    if (biometrieActivee()) await oublierAccesSansMotDePasse();
    return undefined;
  }
  const verification = await verifierIdentite();
  if (!verification.ok) return undefined;
  return await enregistrerAccesSansMotDePasse(email);
}

// Ligne technique de « Mon compte » : la réponse du greffon, telle quelle, et son
// dernier message d'erreur. Uniquement des champs publics du greffon.
function detailGreffon(etat) {
  const b = etat && etat.brut;
  const bouts = [
    `isAvailable=${b ? b.isAvailable : trad('aucune réponse du greffon')}`,
    `biometryType=${b ? b.biometryType : '-'}`,
    `strongBiometryIsAvailable=${b ? b.strongBiometryIsAvailable : '-'}`,
    `deviceIsSecure=${b ? b.deviceIsSecure : '-'}`,
    `authenticationStrength=${b ? b.authenticationStrength : '-'}`,
    'useFallback=true',
  ];
  if (b && b.errorCode !== undefined) bouts.push(`errorCode=${b.errorCode}`);
  if (biometrieDernier.verification) bouts.push(`verifyIdentity=${biometrieDernier.verification}`);
  if (biometrieDernier.enregistrement) bouts.push(`setCredentials=${biometrieDernier.enregistrement}`);
  // Mode retenu pour l'accès enregistré : c'est CE champ qui dira, sur une capture
  // d'écran, ce que le trousseau du téléphone a accepté.
  if (biometrieDernier.mode) bouts.push(`accesMode=${biometrieDernier.mode}`);
  if (biometrieDernier.accessControl !== undefined) bouts.push(`accessControl=${biometrieDernier.accessControl}`);
  if (biometrieDernier.credentials) bouts.push(`credentialsSauvees=${biometrieDernier.credentials}`);
  if (verrouRegle()) bouts.push('verrou=actif');
  if (biometrieDernier.code !== undefined && biometrieDernier.code !== null) bouts.push(`code=${biometrieDernier.code}`);
  if (biometrieDernier.message) bouts.push(`message=${biometrieDernier.message}`);
  return bouts.join(' · ');
}

// Message d'échec de connexion, en français, sans secret. Les littéraux sont
// écrits directement en .textContent : c'est la forme que l'extraction traduit.
function messageBiometrie(el, resultat) {
  if (!el || !resultat) return;
  if (resultat.annule) el.textContent = trad('Connexion sans mot de passe annulée : tu peux saisir ton mot de passe.');
  else if (resultat.echec === 'indisponible') el.textContent = trad('L\'empreinte ou le visage n\'est plus configuré sur ce téléphone : ressaisis ton mot de passe, puis réactive la fonction dans « Mon compte ».');
  else if (resultat.echec === 'jeton') el.textContent = trad('L\'accès enregistré sur ce téléphone a expiré : ressaisis ton mot de passe pour le réactiver.');
  else if (resultat.echec === 'greffon') el.textContent = trad('Ce téléphone ne propose pas la vérification d\'identité : saisis ton mot de passe.');
  else el.textContent = trad('La vérification n\'a pas abouti. Tu peux réessayer, ou saisir ton mot de passe.');
}

// Message d'activation, en français, avec le code technique quand il y en a un.
function messageActivation(el, resultat) {
  if (!el) return;
  const code = resultat && resultat.code;
  if (resultat && resultat.annule) el.textContent = trad('Vérification annulée : rien n\'a été enregistré.');
  else if (code === 1 || code === 3 || code === 14) el.textContent = trad('Le téléphone ne propose ni biométrie ni code de verrouillage : configure-les dans les réglages Android, puis réessaie.');
  else if (resultat && resultat.echec === 'greffon') el.textContent = trad('Ce téléphone ne propose pas la vérification d\'identité : la reconnexion automatique reste indisponible.');
  else el.textContent = trad('La vérification n\'a pas abouti : rien n\'a été enregistré. Réessaie, ou utilise ton mot de passe.');
}

// Message d'échec d'activation du VERROU : il ne s'arme que si le téléphone a
// réellement vérifié l'identité.
function messageVerrou(el, resultat) {
  if (!el) return;
  const code = resultat && resultat.code;
  if (resultat && resultat.annule) el.textContent = trad('Vérification annulée : le verrou n\'a pas été activé.');
  else if (code === 1 || code === 3 || code === 14) el.textContent = trad('Le téléphone ne propose ni biométrie ni code de verrouillage : configure-les dans les réglages Android, puis réessaie.');
  else if (resultat && resultat.echec === 'greffon') el.textContent = trad('Ce téléphone ne propose pas la vérification d\'identité : le verrouillage reste indisponible.');
  else el.textContent = trad('La vérification n\'a pas abouti : le verrou n\'a pas été activé. Réessaie.');
}

// Prépare le bloc de l'écran de connexion. Rien n'est affiché si le greffon
// manque ou si l'appareil n'annonce NI biométrie NI verrouillage utilisable.
async function preparerBiometrieConnexion() {
  if (!dansApplication()) return;
  try {
    const zone = document.getElementById('login-bio');
    if (!zone) return;
    const etat = await etatBiometrie();
    const inscrit = biometrieActivee();
    if (!etat.utilisable) {
      // Un accès enregistré qui ne peut plus être vérifié est effacé, et on le
      // dit : laisser un bouton mort serait un échec silencieux.
      if (inscrit) {
        await oublierAccesSansMotDePasse();
        zone.hidden = false;
        zone.innerHTML = `<p class="ui-aide">${trad('Le déverrouillage biométrique n\'est plus disponible sur ce téléphone : ressaisis ton mot de passe.')}</p>`;
      }
      return;
    }
    const txt = libellesAcces(etat.mode);
    zone.hidden = false;
    zone.innerHTML = `
      ${inscrit ? `<button type="button" class="secondary" id="bio-connexion">${txt.bouton}</button>` : ''}
      <label class="check-row" for="bio-activer"><input type="checkbox" id="bio-activer"${inscrit ? ' checked' : ''}> ${txt.case}</label>
      ${txt.repli ? `<p class="ui-aide">${txt.repli}</p>` : ''}
      <p class="ui-aide">${trad('Aucun mot de passe n\'est enregistré : KALEA garde un jeton de session, révocable dans « Mon compte ».')}</p>
      <div class="ui-aide" id="login-bio-msg" role="status" aria-live="polite"></div>`;
    const bouton = document.getElementById('bio-connexion');
    const msg = document.getElementById('login-bio-msg');
    const cochee = document.getElementById('bio-activer');
    if (cochee) {
      // La case ne fait qu'autoriser l'enregistrement : rien n'est écrit tant
      // que la connexion par mot de passe n'a pas réussi.
      cochee.addEventListener('change', () => {
        if (!cochee.checked) oublierAccesSansMotDePasse();
      });
    }
    if (bouton) {
      bouton.addEventListener('click', async () => {
        bouton.disabled = true;
        const resultat = await connexionSansMotDePasse();
        if (resultat && resultat.ok) { boot(); return; }
        bouton.disabled = false;
        messageBiometrie(msg, resultat);
      });
    }
    // Proposition spontanée, UNE fois par lancement, et seulement si un accès
    // est déjà enregistré : c'est ce qui évite de retaper le mot de passe.
    if (inscrit && bouton && !biometrieProposee) {
      biometrieProposee = true;
      const resultat = await connexionSansMotDePasse();
      if (resultat && resultat.ok) { boot(); return; }
      if (resultat && !resultat.annule) messageBiometrie(msg, resultat);
    }
  } catch (err) {
    // Rien ne doit empêcher l'écran de connexion de fonctionner : en cas de
    // surprise, on reste sur le formulaire classique, sans message technique.
    console.warn('Bloc sans mot de passe indisponible :', err && err.code);
  }
}

// Prépare la carte « Verrouillage et reconnexion » de « Mon compte ». Deux
// réglages INDÉPENDANTS, parce qu'ils ne dépendent pas de la même chose :
//   • le VERROU ne demande rien au trousseau — il fonctionne même si l'appareil
//     refuse d'enregistrer le jeton ;
//   • la RECONNEXION AUTOMATIQUE, elle, a besoin d'un jeton enregistré.
// La carte n'existe que dans l'application native, et le détail technique est là
// pour qu'une capture d'écran suffise à diagnostiquer l'appareil.
async function preparerCarteBiometrie(root) {
  try {
    const etatBloc = root && root.querySelector('#acc-bio-etat');
    if (!etatBloc) return;
    const corps = root.querySelector('#acc-bio-corps');
    const etatAcces = root.querySelector('#acc-acces-etat');
    const corpsAcces = root.querySelector('#acc-acces-corps');
    const msg = root.querySelector('#acc-bio-msg');
    const detail = root.querySelector('#acc-bio-detail');
    if (!pluginBiometrie()) {
      etatBloc.textContent = trad('Ce téléphone ne propose pas la vérification d\'identité : ni verrouillage ni reconnexion automatique ici.');
      if (detail) detail.textContent = 'plugin=absent';
      return;
    }
    const etat = await etatBiometrie();
    const verrouille = verrouRegle();
    const inscrit = biometrieActivee();
    const mode = accesMode();
    // Présence réelle dans le trousseau : le repère local peut mentir après une
    // réinstallation, et c'est justement ce qu'une capture d'écran doit montrer.
    let presentes = null;
    try {
      const r = await pluginBiometrie().isCredentialsSaved({ server: BIOMETRIE_SERVEUR });
      presentes = !!(r && r.isSaved);
    } catch (err) { presentes = null; }
    biometrieDernier.credentials = presentes === null ? '?' : (presentes ? 'oui' : 'non');
    if (detail) detail.textContent = detailGreffon(etat);
    // 1. État du VERROU.
    if (etat.mode === 'aucun') {
      etatBloc.textContent = trad('Ce téléphone n\'annonce ni biométrie ni code de verrouillage utilisable. Tu peux essayer : la vérification dira ce que le capteur répond.');
    } else if (etat.mode === 'code') {
      etatBloc.textContent = trad('Ce téléphone n\'annonce pas de biométrie utilisable : c\'est ton code de déverrouillage qui servira.');
    } else if (verrouille) {
      etatBloc.textContent = trad('Verrouillage activé : ton identité est demandée à chaque ouverture, et de nouveau après une minute en arrière-plan.');
    } else {
      etatBloc.textContent = trad('Ce téléphone peut vérifier ton identité : tu peux verrouiller l\'application ci-dessous.');
    }
    if (corps) {
      corps.innerHTML = `
        <label class="check-row" for="acc-verrou"><input type="checkbox" id="acc-verrou"${verrouille ? ' checked' : ''}> ${trad('Verrouiller l\'application')}</label>
        <p class="ui-aide">${trad('Le verrou ne demande rien au trousseau : il fonctionne même si ce téléphone refuse d\'enregistrer quoi que ce soit. L\'empreinte, le visage ou le code de l\'appareil sont demandés à chaque ouverture, et de nouveau après une minute en arrière-plan.')}</p>`;
    }
    // 2. État de la RECONNEXION AUTOMATIQUE (option séparée).
    if (etatAcces) {
      if (inscrit && mode === 'biometry-any') etatAcces.textContent = trad('Reconnexion automatique activée : le jeton est protégé par le système, qui redemande ton identité pour le relire.');
      else if (inscrit && mode === 'none') etatAcces.textContent = trad('Reconnexion automatique activée sans protection biométrique du jeton : ce téléphone a refusé ce mode. Le verrou de l\'application reste la protection.');
      else if (inscrit) etatAcces.textContent = trad('Reconnexion automatique activée.');
      else if (mode === 'echec') etatAcces.textContent = trad('Reconnexion automatique indisponible : ce téléphone a refusé d\'enregistrer la session. Le verrouillage de l\'application, lui, fonctionne.');
      else etatAcces.textContent = trad('Reconnexion automatique : garde un jeton de session pour éviter de ressaisir ton mot de passe après une expiration. Ce téléphone peut le refuser.');
    }
    if (corpsAcces) {
      corpsAcces.innerHTML = `
        <label class="check-row" for="acc-acces"><input type="checkbox" id="acc-acces"${inscrit ? ' checked' : ''}> ${trad('Reconnexion automatique par jeton enregistré')}</label>`;
    }
    // 3. Le VERROU ne s'arme qu'après une vérification RÉELLE.
    // `rafraichir` remet les lignes d'état et les cases à jour après chaque
    // changement, sans effacer le message de confirmation déjà écrit.
    const rafraichir = () => { preparerCarteBiometrie(root); };
    const cocheVerrou = root.querySelector('#acc-verrou');
    if (cocheVerrou) {
      cocheVerrou.addEventListener('change', async () => {
        if (!cocheVerrou.checked) {
          reglerVerrouLocal(false);
          verrouLeve = false;
          verrouActif = false;
          verrouGeneration += 1;
          verrouEnCours = false;
          if (detail) detail.textContent = detailGreffon(await etatBiometrie());
          if (msg) msg.textContent = trad('Verrouillage désactivé : l\'application ne demandera plus ton identité à l\'ouverture.');
          rafraichir();
          return;
        }
        if (msg) msg.textContent = trad('Vérification demandée au téléphone…');
        const verification = await verifierIdentite();
        if (detail) detail.textContent = detailGreffon(await etatBiometrie());
        if (!verification.ok) {
          cocheVerrou.checked = false;
          reglerVerrouLocal(false);
          messageVerrou(msg, verification);
          rafraichir();
          return;
        }
        reglerVerrouLocal(true);
        verrouLeve = true;   // l'identité vient d'être prouvée : pas de verrou immédiat
        if (msg) msg.textContent = trad('Verrouillage activé : ton identité sera demandée à chaque ouverture.');
        rafraichir();
      });
    }
    // 4. La RECONNEXION AUTOMATIQUE enregistre le jeton, mode après mode.
    const cocheAcces = root.querySelector('#acc-acces');
    if (cocheAcces) {
      cocheAcces.addEventListener('change', async () => {
        if (!cocheAcces.checked) {
          await oublierAccesSansMotDePasse();
          if (detail) detail.textContent = detailGreffon(await etatBiometrie());
          if (msg) msg.textContent = trad('Reconnexion automatique désactivée : plus aucun jeton n\'est gardé sur ce téléphone.');
          rafraichir();
          return;
        }
        if (msg) msg.textContent = trad('Vérification demandée au téléphone…');
        const verification = await verifierIdentite();
        if (detail) detail.textContent = detailGreffon(await etatBiometrie());
        if (!verification.ok) {
          cocheAcces.checked = false;
          messageActivation(msg, verification);
          rafraichir();
          return;
        }
        const enregistrement = await enregistrerAccesSansMotDePasse(UI.email);
        if (detail) detail.textContent = detailGreffon(await etatBiometrie());
        if (enregistrement.ok) {
          if (msg) msg.textContent = enregistrement.mode === 'none'
            ? trad('Reconnexion automatique activée sans protection biométrique du jeton : ce téléphone a refusé ce mode, le verrou de l\'application reste la protection.')
            : trad('Reconnexion automatique activée.');
          rafraichir();
          return;
        }
        cocheAcces.checked = false;
        if (msg) msg.textContent = trad('Ce téléphone a refusé d\'enregistrer la session : la reconnexion automatique est indisponible. Le verrouillage de l\'application, lui, fonctionne (détail technique ci-dessus).');
        rafraichir();
      });
    }
  } catch (err) {
    console.warn('Carte sans mot de passe indisponible :', err && err.code);
  }
}

function rappelsActifs() {
  try { return localStorage.getItem(RAPPELS_PREF) !== 'non'; } catch (err) { return true; }
}
function activerRappels(actif) {
  try { localStorage.setItem(RAPPELS_PREF, actif ? 'oui' : 'non'); } catch (err) { /* sans conséquence */ }
}

// Le greffon n'accepte que des identifiants entiers, et il faut retrouver les
// mêmes d'une programmation à l'autre, sinon les rappels s'empileraient en
// doublons. L'identifiant est donc dérivé de la machine, de façon stable.
function idNotification(machineId, rang) {
  const texte = `${machineId}:${rang}`;
  let empreinte = 7;
  for (let i = 0; i < texte.length; i++) empreinte = (empreinte * 31 + texte.charCodeAt(i)) % 2000000000;
  return empreinte + 1;
}

// Ce qui doit être annoncé, et quand. Fonction PURE : elle ne parle ni au
// greffon ni au réseau, ce qui la rend vérifiable.
//
// Seules les échéances DATÉES sont concernées. Une machine suivie au compteur
// (heures ou kilomètres) n'a pas de date d'échéance : on ne peut pas l'annoncer
// à l'avance sans connaître son rythme d'utilisation. Mieux vaut ne rien
// annoncer que d'annoncer une date fausse.
function rappelsAProgrammer(machines, maintenant) {
  const base = maintenant ? new Date(maintenant) : new Date();
  const rappels = [];
  for (const machine of machines || []) {
    const plan = machine && machine.plan;
    if (!plan || planIsCounter(plan) || !plan.next_due_at) continue;
    const echeance = new Date(`${plan.next_due_at}T09:00:00`);
    if (isNaN(echeance.getTime())) continue;
    const modele = machineBrandModel(machine);
    const nom = modele ? `${machine.name} (${modele})` : machine.name;
    const joursAvant = Number(plan.reminder_days_before ?? FALLBACK_REMINDER_DAYS);
    if (joursAvant > 0) {
      const veille = new Date(echeance.getTime() - joursAvant * 86400000);
      if (veille > base) {
        rappels.push({
          id: idNotification(machine.id, 1),
          quand: veille,
          titre: trad('Entretien à prévoir'),
          corps: `${nom} — ${tR('échéance dans {n} jours ({date})', { n: joursAvant, date: formatShortDate(plan.next_due_at) })}`,
        });
      }
    }
    if (echeance > base) {
      rappels.push({
        id: idNotification(machine.id, 2),
        quand: echeance,
        titre: trad('Entretien à faire aujourd\'hui'),
        corps: `${nom} — ${tR('échéance du {date}', { date: formatShortDate(plan.next_due_at) })}`,
      });
    }
  }
  rappels.sort((a, b) => a.quand - b.quand);
  return rappels.slice(0, RAPPELS_MAX);
}

async function annulerRappels(plugin) {
  const cible = plugin || pluginRappels();
  if (!cible) return;
  try {
    const enAttente = await cible.getPending();
    const liste = (enAttente && enAttente.notifications) || [];
    if (liste.length) await cible.cancel({ notifications: liste.map((n) => ({ id: n.id })) });
  } catch (err) {
    console.warn('Annulation des rappels :', err && err.message);
  }
}

// Reprogramme tout, à chaque ouverture : dès qu'un entretien est validé,
// l'échéance suivante change et les notifications déjà posées annonceraient une
// date fausse.
//
// `demander: false` évite de réclamer l'autorisation au démarrage de
// l'application : elle n'est demandée que lorsque l'utilisateur active les
// rappels depuis « Mon compte ». Une demande surgie sans raison au premier
// lancement se solde presque toujours par un refus.
async function programmerRappels(options) {
  const plugin = pluginRappels();
  if (!plugin) return { natif: false };
  const demander = !options || options.demander !== false;
  if (!rappelsActifs()) { await annulerRappels(plugin); return { desactives: true }; }
  try {
    const etat = await plugin.checkPermissions();
    if (!etat || etat.display !== 'granted') {
      if (!demander) return { sansPermission: true };
      const demande = await plugin.requestPermissions();
      if (!demande || demande.display !== 'granted') return { refuse: true };
    }
    try {
      await plugin.createChannel({
        id: 'echeances',
        name: trad('Échéances d\'entretien'),
        description: trad('Rappels avant chaque entretien planifié.'),
        importance: 4,
      });
    } catch (err) { /* canal déjà créé, ou Android antérieur aux canaux */ }

    await annulerRappels(plugin);
    const rappels = rappelsAProgrammer(UI.machines);
    if (!rappels.length) return { programmees: 0 };
    await plugin.schedule({
      notifications: rappels.map((rappel) => ({
        id: rappel.id,
        title: rappel.titre,
        body: rappel.corps,
        channelId: 'echeances',
        // Inexact assumé : une alarme exacte exigerait la permission
        // SCHEDULE_EXACT_ALARM, et Android ouvrirait son écran de réglages à la
        // première programmation. Celle-ci traverse le mode veille, ce qui
        // suffit largement pour un rappel d'entretien.
        isExactNotification: false,
        allowWhileIdle: true,
        schedule: { at: rappel.quand },
      })),
    });
    return { programmees: rappels.length };
  } catch (err) {
    console.warn('Programmation des rappels :', err && err.message);
    return { erreur: (err && err.message) || trad('erreur inconnue') };
  }
}

// ── L'ÉTAT DE L'AUTORISATION, TOUJOURS VISIBLE ──────────────────────────────
// La permission n'est demandée qu'à l'activation de l'interrupteur : si elle a
// été refusée une fois, ou si l'application a été réinstallée avec l'interrupteur
// déjà coché, plus rien ne la redemande — et les rappels sont morts en silence.
// On affiche donc l'état en clair, EN PERMANENCE, même quand la case est cochée.
function texteAutorisation(etat) {
  if (etat === 'granted') return trad('Autorisation accordée : les rappels peuvent être programmés.');
  if (etat === 'denied') return trad('Autorisation refusée — Android n\'affichera aucun rappel. Accorde-la dans les réglages de l\'application.');
  return trad('Autorisation non encore demandée : coche l\'interrupteur ou utilise le bouton de test.');
}

async function etatAutorisationRappels() {
  const plugin = pluginRappels();
  if (!plugin) return null;
  try {
    const etat = await plugin.checkPermissions();
    return (etat && etat.display) || 'prompt';
  } catch (err) {
    return null;
  }
}

// CE QUI EST RÉELLEMENT PROGRAMMÉ, lu dans le système — la seule réponse honnête
// à « ça ne se déclenche pas » : on montre ce qui est en attente, et sa date.
function texteRappelsEnAttente(liste) {
  if (!liste || !liste.length) return trad('Aucun rappel daté programmé pour le moment.');
  const dates = liste
    .map((n) => (n && n.schedule ? n.schedule.at : null))
    .filter(Boolean)
    .map((v) => new Date(v))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  if (!dates.length) return `${liste.length} rappel(s) programmé(s).`;
  const prochaine = dates[0];
  return `${liste.length} rappel(s) programmé(s) — prochain le ${formatShortDate(prochaine.toISOString().slice(0, 10))}`;
}

// Ce qui est VRAIMENT dans la file du système, tel quel — titre, corps et
// date de chaque notification déjà programmée (ni ref, ni intervalle
// inventés : seuls les champs que `programmerRappels` a réellement écrits).
async function rappelsEnAttenteListe() {
  const plugin = pluginRappels();
  if (!plugin) return [];
  try {
    const enAttente = await plugin.getPending();
    const liste = (enAttente && enAttente.notifications) || [];
    return liste
      .filter((n) => n && n.id !== ID_TEST_NOTIFICATION)
      .map((n) => ({ titre: n.title || '', corps: n.body || '', quand: n.schedule ? new Date(n.schedule.at) : null }))
      .sort((a, b) => (a.quand && b.quand ? a.quand - b.quand : 0));
  } catch (err) {
    return [];
  }
}

function ligneRappelEnAttenteHtml(item) {
  const passee = item.quand && item.quand.getTime() <= Date.now();
  const quand = item.quand
    ? (passee ? trad('IMMÉDIAT') : `${formatShortDate(item.quand.toISOString().slice(0, 10))} · ${item.quand.toTimeString().slice(0, 5)}`)
    : '';
  return `
    <div class="ui-ligne is-deux">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone">${picto('cloche')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(item.titre)}</span>
          <span class="ui-ligne-sous">${esc(item.corps)}</span>
        </div>
      </div>
      ${quand ? `<div class="ui-ligne-action"><span class="ui-statut ${passee ? 'is-retard' : 'is-bientot'}">${esc(quand)}</span></div>` : ''}
    </div>`;
}

// Remplit la rubrique entière à l'ouverture : l'autorisation, la file
// d'attente détaillée, et le compte repris par la tuile de résumé du haut.
async function majRappelsLocaux(root) {
  if (!root) return;
  const ligneAutorisation = root.querySelector('#acc-rappels-autorisation');
  if (ligneAutorisation) {
    const etat = await etatAutorisationRappels();
    ligneAutorisation.innerHTML = etat
      ? `${picto(etat === 'denied' ? 'alerte' : 'case')}<p>${esc(texteAutorisation(etat))}</p>`
      : '';
    ligneAutorisation.className = `ui-encadre${etat === 'denied' ? ' is-attention' : ''}`;
    ligneAutorisation.hidden = !etat;
  }
  const liste = await rappelsEnAttenteListe();
  const zoneFile = root.querySelector('#acc-rappels-file');
  const compte = root.querySelector('#acc-rappels-compte');
  if (compte) compte.textContent = tR('{n} alerte(s) active(s)', { n: liste.length });
  if (zoneFile) {
    zoneFile.innerHTML = liste.length
      ? liste.slice(0, 6).map(ligneRappelEnAttenteHtml).join('')
      : `<p class="ui-aide">${trad('Aucun rappel daté programmé pour le moment.')}</p>`;
  }
  const tuileValeur = document.getElementById('rappel-tuile-file');
  if (tuileValeur) tuileValeur.textContent = String(liste.length);
}

// ── LE BOUTON DE TEST ──────────────────────────────────────────────────────
// « Ça ne se déclenche pas » ne se diagnostique pas à distance. Ce bouton
// programme UNE notification dans une minute : si elle arrive, le canal
// fonctionne ; sinon, le message dit quoi faire. Même chemin que la
// programmation normale pour la permission (demande réelle, refus dit).
async function testerRappelLocal(root) {
  const plugin = pluginRappels();
  const msg = root ? root.querySelector('#acc-rappels-msg') : null;
  const dire = (texte) => { if (msg) msg.textContent = texte; };
  if (!plugin) { dire(trad('Les rappels n\'existent que dans l\'application Android.')); return { natif: false }; }

  try {
    let etat = await plugin.checkPermissions();
    if (!etat || etat.display !== 'granted') {
      etat = await plugin.requestPermissions();
    }
    if (!etat || etat.display !== 'granted') {
      dire(trad('Autorisation refusée : Android n\'affichera aucun rappel. Tu peux l\'accorder dans les réglages de l\'application.'));
      majRappelsLocaux(root);
      return { refuse: true };
    }
    try {
      await plugin.createChannel({
        id: 'echeances',
        name: trad('Échéances d\'entretien'),
        description: trad('Rappels avant chaque entretien planifié.'),
        importance: 4,
      });
    } catch (err) { /* canal déjà créé, ou Android antérieur aux canaux */ }

    await plugin.schedule({
      notifications: [{
        // Un identifiant à part des rappels d'échéance : le test ne doit pas
        // pouvoir être pris pour un vrai rappel, ni être annulé avec eux.
        id: ID_TEST_NOTIFICATION,
        title: trad('Test KALEA'),
        body: trad('Test KALEA : les rappels fonctionnent.'),
        channelId: 'echeances',
        isExactNotification: false,
        allowWhileIdle: true,
        schedule: { at: new Date(Date.now() + 60000) },
      }],
    });
    dire(trad('Notification de test programmée : elle doit arriver dans une minute.'));
    await majRappelsLocaux(root);
    return { programmee: true };
  } catch (err) {
    dire(tR('Test impossible : {erreur}', { erreur: (err && err.message) || trad('erreur inconnue') }));
    return { erreur: (err && err.message) || trad('erreur inconnue') };
  }
}

// L'identifiant du test : fixe, pour pouvoir l'annuler sans toucher aux rappels.
const ID_TEST_NOTIFICATION = 987654;

function blocRappelsHtml() {
  if (!rappelsDisponibles()) {
    return `<p class="ui-aide">${trad('Les notifications locales sont gérées directement par le terminal Android, sans dépendre de la couverture réseau ni d\'un compte cloud tiers. Elles n\'existent que dans l\'application Android : installe-la sur ton téléphone pour les recevoir.')}</p>`;
  }
  const actif = rappelsActifs();
  return `
    <div class="ui-groupe">
      <div class="switch-row rappel-switch-row">
        <span class="switch-label">
          <span class="rappel-switch-titre">${trad('Me rappeler les échéances datées sur cet appareil')}</span>
          <span class="rappel-switch-sous">${trad('Déclenche des bannières prioritaires, même écran verrouillé')}</span>
        </span>
        <button type="button" class="switch${actif ? ' on' : ''}" id="acc-rappels" role="switch" aria-checked="${actif ? 'true' : 'false'}" aria-label="${trad('Me rappeler les échéances datées sur cet appareil')}"><span></span></button>
      </div>
      <div class="ui-aide">${trad('Les rappels peuvent arriver avec quelques minutes de retard : l\'application n\'utilise pas les alarmes exactes d\'Android, pour ne pas demander une permission sensible.')}</div>
    </div>
    <div class="ui-encadre" id="acc-rappels-autorisation" role="status" hidden></div>

    <div class="ui-champ-groupe">
      <span class="ui-etiquette">${trad('Prochaines alertes programmées en file d\'attente locale')} <span class="ui-tag" id="acc-rappels-compte"></span></span>
    </div>
    <div id="acc-rappels-file" class="ui-liste" role="status" aria-live="polite"></div>

    <div><button type="button" class="ui-btn ui-btn-pastille" id="acc-rappels-test">${picto('cloche')}<span>${trad('Tester le rappel local maintenant')}</span></button></div>
    <div class="ui-aide" id="acc-rappels-msg" role="status" aria-live="polite"></div>`;
}

// ── RAPPELS PUSH (FCM), CIBLÉS PAR RÔLE ─────────────────────────────────────
// Contrairement aux rappels locaux ci-dessus (Alarm Manager, autonomes sur
// l'appareil), le push est ENVOYÉ PAR LE SERVEUR (send-maintenance-reminders
// côté Supabase) : l'appli n'a qu'à s'inscrire (jeton FCM) et réagir à la
// réception/au tap. L'inscription est un choix PERSONNEL (interrupteur
// individuel, voir blocPushHtml) ; le ciblage par rôle et son délai
// d'anticipation sont un choix de société (gérant seulement, voir
// blocCiblagePushHtml) — jamais l'un à la place de l'autre : être dans un
// rôle ciblé ne suffit pas si on n'a pas soi-même activé le push.
function pluginPush() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) || null;
}
function pushDisponible() { return !!pluginPush(); }

const PUSH_TOKEN_KEY = 'parcpacific.push.token.v1';
function monTokenPushConnu() {
  try { return localStorage.getItem(PUSH_TOKEN_KEY) || null; } catch (err) { return null; }
}
function memoriserTokenPush(token) {
  try {
    if (token) localStorage.setItem(PUSH_TOKEN_KEY, token);
    else localStorage.removeItem(PUSH_TOKEN_KEY);
  } catch (err) { /* sans conséquence */ }
}

// Active : demande la permission Android, enregistre le greffon, ATTEND le
// jeton (événement asynchrone 'registration', voir wirePushEcouteurs) puis
// l'envoie au serveur. Comme programmerRappels(), la permission n'est
// réclamée qu'à l'activation explicite de l'interrupteur, jamais au démarrage.
async function activerPush() {
  const plugin = pluginPush();
  if (!plugin) return { natif: false };
  try {
    let etat = await plugin.checkPermissions();
    if (!etat || etat.receive !== 'granted') {
      etat = await plugin.requestPermissions();
    }
    if (!etat || etat.receive !== 'granted') return { refuse: true };
    await plugin.register();
    return { demande: true };
  } catch (err) {
    return { erreur: (err && err.message) || trad('erreur inconnue') };
  }
}

// À CHAQUE OUVERTURE (compte connecté) : le jeton gardé sur le téléphone est ré-annoncé au serveur au nom du compte. Avant, il n'était
// envoyé qu'une seule fois, à l'activation de l'interrupteur : si cet envoi échouait (session pas encore prête), ou si la ligne
// disparaissait côté serveur (compte ou société recréés), le téléphone se croyait « actif » à vie alors que le serveur ne le connaissait
// pas — aucun rappel ne partait, et le web affichait « À installer ». L'envoi est un « upsert » : sans doublon, et un jeton resté
// attaché à un autre compte est réattribué. On redemande aussi le jeton courant à Firebase (il peut changer) ; l'écouteur
// « registration » l'enverra.
async function resynchroniserJetonPush() {
  const plugin = pluginPush();
  const token = monTokenPushConnu();
  if (!plugin || !token) return;
  try {
    const { error } = await sb.rpc('enregistrer_mon_token_push', { p_token: token });
    if (error) console.warn('Réannonce du jeton push :', error.message);
  } catch (err) { /* hors connexion : à la prochaine ouverture */ }
  try {
    const etat = await plugin.checkPermissions();
    if (etat && etat.receive === 'granted') await plugin.register();
  } catch (err) { /* sans conséquence */ }
}

async function desactiverPush() {
  const plugin = pluginPush();
  const token = monTokenPushConnu();
  if (token) {
    try { await sb.rpc('retirer_mon_token_push', { p_token: token }); } catch (err) { /* réessaiera à la prochaine ouverture */ }
  }
  memoriserTokenPush(null);
  try { await plugin?.removeAllDeliveredNotifications(); } catch (err) { /* sans conséquence */ }
}

// Câblés UNE FOIS, au niveau racine du script (voir l'appel tout en bas,
// à côté de changerLangue) — ce sont des écouteurs du greffon natif, pas des
// éléments du DOM, ils doivent survivre aux changements de vue.
function wirePushEcouteurs() {
  const plugin = pluginPush();
  if (!plugin) return;
  plugin.addListener('registration', async (jeton) => {
    const token = jeton && jeton.value;
    if (!token) return;
    memoriserTokenPush(token);
    try { await sb.rpc('enregistrer_mon_token_push', { p_token: token }); } catch (err) { console.warn('Inscription du jeton push :', err && err.message); }
  });
  plugin.addListener('registrationError', (err) => {
    console.warn('Enregistrement push refusé par le greffon :', err && err.error);
  });
  // Premier plan : l'appli est déjà ouverte quand la notification arrive —
  // on ne laisse pas Android l'afficher une deuxième fois, on montre notre
  // propre bannière (showToast, déjà utilisé ailleurs pour ce genre de cas).
  plugin.addListener('pushNotificationReceived', (notification) => {
    const titre = notification && notification.title;
    if (titre) showToast(titre);
  });
  // Tap sur la notification (appli en arrière-plan OU fermée) : réutilise
  // EXACTEMENT ouvrirFicheParId(), comme le lien profond QR code — jamais
  // une deuxième logique de navigation pour le même résultat. Si UI.machines
  // n'est pas encore chargé (lancement à froid), voir
  // ouvrirFicheDepuisPushSiPresent() plus bas, qui reprend le patron déjà
  // établi pour le lien profond QR.
  plugin.addListener('pushNotificationActionPerformed', (action) => {
    const donnees = action && action.notification && action.notification.data;
    const machineId = donnees && donnees.machine_id;
    if (!machineId) return;
    if (__appPretePourPush) ouvrirFicheParId(machineId);
    else __machineIdDepuisPushEnAttente = machineId;
  });
}

const REMINDERS_KEY = 'parcpacific.reminders.v1';
const DEFAULT_REMINDERS = { whatsapp: true, email: true, escalate: false };

// Les noms de mois suivent la langue : sans cela, l'anglais afficherait
// « 21 septembre » au milieu d'une phrase anglaise.
const MOIS_COURT = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const MOIS_LONG = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const LOCALES = { fr: 'fr-FR', en: 'en-GB' };

function moisCourt(index) { return (MOIS_COURT[LANGUE] || MOIS_COURT.fr)[index]; }
function moisLong(index) { return (MOIS_LONG[LANGUE] || MOIS_LONG.fr)[index]; }
// Les nombres suivent la langue eux aussi : 19 240 en français, 19,240 en anglais.
function localeActive() { return LOCALES[LANGUE] || LOCALES.fr; }
