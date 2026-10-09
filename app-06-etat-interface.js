/* KALEA — application (app.html) : État de l'application, formatage, échéances, coquille de l'interface, offres, fenêtres (modales), rappels.
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · État applicatif
 *   · Formatage
 *   · Échéances et statuts
 *   · Coquille
 *   · Couverture par l'offre
 *   · Machines en plus (2026-10-08)
 *   · Confort des modales
 *   · Confirmation d'action (toast)
 *   · Éléments partagés
 *   · Rappels : ce que l'application annonce, et ce qu'elle fait
 */
// ───────────────────────── début du code ─────────────────────────
// ── État applicatif ───────────────────────────────────────────
const UI = {
  view: 'dashboard',
  companyId: null,
  companyName: '',
  companyPlan: 'free',
  contactName: '',
  contactFirstName: '',
  // Fiche société complète (rubrique « Mon compte »)
  company: {},
  email: '',
  machines: [],
  categories: [],
  components: [],
  reminders: { ...DEFAULT_REMINDERS },
  counts: { late: 0, soon: 0, ok: 0, manuals: 0, analysed: 0 },
};

const NAV_ITEMS = [
  { id: 'dashboard', label: trad('Tableau de bord'), short: trad('Accueil'), icon: 'accueil' },
  { id: 'machines', label: trad('Machines'), short: trad('Parc'), icon: 'parc' },
  { id: 'manuals', label: trad('Plan d\'entretien'), short: trad('Plan'), icon: 'manuels' },
  { id: 'agenda', label: trad('Agenda et préparation'), short: trad('Agenda'), icon: 'agenda' },
  { id: 'reminders', label: trad('Rappels et notifications'), short: trad('Rappels'), icon: 'rappels' },
  { id: 'tco', label: trad('Coûts & TCO'), short: trad('Coûts'), icon: 'couts' },
  { id: 'stock', label: trad('Stocks & SAV'), short: trad('Stocks'), icon: 'stock' },
  { id: 'telemetrie', label: trad('Télémétrie'), short: trad('Télémétrie'), icon: 'telemetrie' },
  { id: 'account', label: trad('Mon compte'), short: trad('Compte'), icon: 'compte' },
];
// NAV_ITEMS est une constante évaluée une seule fois, AVANT que tcoActif()
// ne soit connu (la sonde tourne au boot, bien après) : on ne peut donc pas
// filtrer ici. `navItemsVisibles()` refait le filtre à CHAQUE rendu — même
// garde-fou que le reste de la fonctionnalité (rien tant que la migration
// n'est pas visible), mais recalculé au bon moment. Stock combine DEUX
// conditions (migration visible ET palier Enterprise) — voir planCouvreStock().
function navItemsVisibles() {
  return NAV_ITEMS.filter((item) => {
    if (item.id === 'tco') return tcoActif();
    if (item.id === 'stock') return SCHEMA.hasStock && planCouvreStock();
    // Télémétrie : migration en place (SCHEMA) ET offre Enterprise ET gérant — la
    // création des sources et la liaison des machines sont réservées au gérant.
    if (item.id === 'telemetrie') return telemetrieActif() && UI.role === 'gerant';
    return true;
  });
}

// Onglets visibles dans la barre mobile (5 emplacements, FAB central).
const TABS = [
  { id: 'dashboard', short: trad('Accueil'), icon: 'accueil' },
  { id: 'machines', short: trad('Parc'), icon: 'parc' },
  { id: 'fab' },
  { id: 'manuals', short: trad('Plan'), icon: 'manuels' },
  { id: 'plus', short: trad('Plus'), icon: 'plus' },
];

// LES ICÔNES DE LA NAVIGATION — DESSINÉES UNE FOIS POUR TOUTES.
// Le repère est 24 × 24, le trait fait 2 px et les extrémités sont arrondies :
// c'est la grille et l'épaisseur de la marque (signal/marque.mjs). Aucune
// bibliothèque, aucune ressource distante, aucun glyphe de police — le tracé
// s'affiche pareil sur tous les téléphones, y compris hors connexion.
//
// L'ACCUEIL EST UN CONTOUR REMPLI, LES TROIS AUTRES SONT DES TRAITS. C'est
// délibéré : une maison se lit à sa SILHOUETTE (toit, murs, porte ouverte), pas
// à un trait de plus, alors qu'un cartable, un utilitaire et un menu se lisent
// très bien au trait. Le tracé de l'accueil est donc un chemin COMPOSÉ rempli
// avec `fill-rule="evenodd"` : ses sous-chemins (le creux du toit, la porte)
// percent des TROUS dans la silhouette. Superposer un second trait ne creuserait
// rien — à 15 px, une maison sans trou est un pâté plein.
const NAV_ICONES = {
  accueil: '<path fill-rule="evenodd" d="M9 3.2 1.2 10.5V21h21.6V10.5Z M3.2 11.5 9 6.1l5.8 5.4v7.5H3.2Z M9.8 13.5h3.2v5.5H9.8Z"/>',
  parc: '<rect x="2.5" y="13" width="15" height="7" rx="1.5"/><path d="M8 13V9h7l3.5 4"/><circle cx="6.5" cy="20.5" r="2"/><circle cx="16.5" cy="20.5" r="2"/>',
  manuels: '<path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8.5 3v18"/>',
  plus: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  rappels: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15z"/><path d="M10 21h4"/>',
  // Coûts & TCO : une pile de pièces (cylindre empilé), lecture immédiate
  // « argent » sans glyphe de police — même grille 24×24 / trait 2px que le
  // reste de NAV_ICONES.
  couts: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5a7 3 0 0 0 14 0V7"/><path d="M5 12v5a7 3 0 0 0 14 0v-5"/>',
  // Stock & SAV : une caisse ouverte (silhouette de carton) — lecture
  // immédiate « stockage/entrepôt », même grille 24×24 / trait 2px.
  stock: '<path d="M3 8 12 4l9 4-9 4-9-4Z"/><path d="M3 8v9l9 4 9-4V8"/><path d="M12 12v9"/>',
  // Télémétrie : un point qui émet des ondes (diffusion), lecture immédiate
  // « signal reçu d'une machine » — même grille 24×24 / trait 2px.
  telemetrie: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
  compte: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
// ★ LOT 9 — LES PICTOs DE LA CARTE MACHINE, DESSINÉS COMME CEUX DE LA NAVIGATION.
// La maquette emploie la police « Material Symbols » (une ressource DISTANTE) :
// impossible ici, et pour deux raisons qui ne se négocient pas — la politique de
// sécurité du contenu interdit toute origine, et l'application Android embarque
// cette page sans réseau. Les icônes sont donc RETRACÉES sur le repère de la
// marque : 24 × 24, trait 2 px, extrémités arrondies, `currentColor`. Le DESSIN
// est celui de la maquette (cercle barré, horloge, coche dans un cercle, triangle
// d'alerte, engrenage, calendrier à flèches, liste cochée, appareil photo,
// compteur, carnet, entonnoir de filtre) — pas une forme inventée.
const PICTOS = {
  retard: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  bientot: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5l3.5 2"/>',
  ajuste: '<circle cx="12" cy="12" r="9"/><path d="M8 12.2l2.8 2.8L16.4 9.4"/>',
  alerte: '<path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5"/><path d="M12 17.4h.01"/>',
  entretien: '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',
  prochain: '<path d="M3.5 5.5h17v15h-17z"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M9.2 14.2 11 16l3.8-3.8"/>',
  plan: '<path d="M9 4.5h9a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H9"/><path d="M4.5 8.5l1.6 1.6L9 7.2"/><path d="M4.5 15.5l1.6 1.6L9 14.2"/>',
  reglages: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  carnet: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5z"/><path d="M8.5 3v18"/>',
  qrcode: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14v3h-2"/><path d="M14 20h3"/><path d="M20 20h.01"/>',
  photo: '<path d="M3.5 8.5h3.2l1.6-2.2h7.4l1.6 2.2h3.2v10.5h-17z"/><circle cx="12" cy="13.5" r="3.4"/>',
  compteur: '<path d="M4.5 18.5a8.5 8.5 0 1 1 15 0"/><path d="M12 13.8 16.6 9"/>',
  filtre: '<path d="M3.5 5.5h17l-6.6 7.6v6.4l-3.8-2.2v-4.2z"/>',
  boite: '<path d="M3.5 8 12 3.8 20.5 8 12 12.2z"/><path d="M3.5 8v9l8.5 4.2M20.5 8v9l-8.5 4.2M12 12.2v9"/>',
  export: '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5"/><path d="M4 16.5v2A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-2"/>',
  partage: '<circle cx="18" cy="5.5" r="2.3"/><circle cx="6" cy="12" r="2.3"/><circle cx="18" cy="18.5" r="2.3"/><path d="M8.1 10.9 15.9 6.6M8.1 13.1l7.8 4.3"/>',
  goutte: '<path d="M12 3.6c0 0-6.2 7.3-6.2 11.5a6.2 6.2 0 0 0 12.4 0c0-4.2-6.2-11.5-6.2-11.5z"/>',
  case: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12.3l2.5 2.5L16 9.3"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  telephone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  message: '<path d="M21 12a8 8 0 01-11.7 7L3 21l2-6A8 8 0 1121 12z"/>',
  cloche: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
  wifi: '<path d="M4 9.5a13 13 0 0 1 16 0M7 13.2a8.5 8.5 0 0 1 10 0M10 16.8a4 4 0 0 1 4 0"/><path d="M12 20h.01"/>',
  institution: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18M3 18h18"/>',
  batiment: '<path d="M5 21V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V21"/><path d="M15 10.5h3.5A1.5 1.5 0 0 1 20 12v9"/><path d="M9 8h2M9 12h2M9 16h2"/><path d="M3 21h18"/>',
  equipe: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6"/><circle cx="17" cy="9" r="2.3"/><path d="M15.6 14c2.2.5 3.7 2.5 3.9 6"/>',
  cadenas: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  bouclier: '<path d="M12 3.3 19 6v6c0 4.6-3 8.2-7 9.2-4-1-7-4.6-7-9.2V6z"/><path d="M9 12l2 2 4-4"/>',
  ajoutPersonne: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6"/><path d="M18 8v6M15 11h6"/>',
  corbeille: '<path d="M4.5 7h15"/><path d="M9.5 7V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4A1.3 1.3 0 0 1 14.5 4.8V7"/><path d="M6.5 7l1 12.3A1.7 1.7 0 0 0 9.2 21h5.6a1.7 1.7 0 0 0 1.7-1.7L17.5 7"/><path d="M10 11v6M14 11v6"/>',
  flecheGauche: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  flecheDroite: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  crayon: '<path d="M4 20l1-4.2L15.6 5.2a1.5 1.5 0 0 1 2.1 0l1.1 1.1a1.5 1.5 0 0 1 0 2.1L8.2 19l-4.2 1z"/><path d="M13.8 6.9l3.3 3.3"/>',
  vehicule: '<path d="M4.5 16V11l2-4.5h11l2 4.5v5"/><path d="M4.5 16h15v2.5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V17h-9v1.5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1z"/><circle cx="7.5" cy="16" r="1.5"/><circle cx="16.5" cy="16" r="1.5"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6h.01"/>',
  mallette: '<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M8.5 7.5V5.8A1.8 1.8 0 0 1 10.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7"/><path d="M3 12.5h18"/>',
  // ── Reprise du mockup Stitch « WEB TCO » (voir keeva-tco-feature) : les
  // icônes Material Symbols du fichier n'existent pas ici (aucune police
  // d'icônes, jamais — voir le commentaire de NAV_ICONES) et sont retracées
  // une à une, même grille 24×24 / trait 2px que le reste de PICTOS.
  recherche: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  plusCercle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  disquette: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H16l4 4v12.5A1.5 1.5 0 0 1 18.5 21h-12A1.5 1.5 0 0 1 5 19.5z"/><path d="M8 3v5h7V3"/><path d="M7.5 21v-6.5A1 1 0 0 1 8.5 13.5h7a1 1 0 0 1 1 1V21"/>',
  devise: '<path d="M4 8h12M13 4.5 16 8l-3 3.5"/><path d="M20 16H8M11 12.5 8 16l3 3.5"/>',
  graphique: '<path d="M4 20V13"/><path d="M10.2 20V7.5"/><path d="M16.4 20v-9.5"/><path d="M4 20h16.4"/>',
  aideCercle: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a2.7 2.7 0 1 1 3.9 2.4c-.8.4-1.2 1-1.2 1.9v.3"/><path d="M12 17.2h.01"/>',
  ampoule: '<path d="M9 18.5h6"/><path d="M10 21.3h4"/><path d="M12 3a6 6 0 0 0-3.4 10.9c.5.35.7.9.7 1.5v.6h5.4v-.6c0-.6.2-1.15.7-1.5A6 6 0 0 0 12 3z"/>',
  coche: '<path d="M5 13l4 4L19 7"/>',
  // ── Reprise du mockup Stitch « modale enregistrer un entretien » — mêmes
  // raisons que les précédentes reprises (voir keeva-tco-feature) : aucune
  // police d'icônes, retracées à la main, même grille 24×24 / trait 2px.
  calendrier: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  personne: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  paiement: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5a7 3 0 0 0 14 0V7"/><path d="M5 12v5a7 3 0 0 0 14 0v-5"/>',
  croix: '<path d="M12 5v14M5 12h14"/>',
  calculatrice: '<rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M8 6.5h8"/><circle cx="8.3" cy="11.5" r=".6"/><circle cx="12" cy="11.5" r=".6"/><circle cx="15.7" cy="11.5" r=".6"/><circle cx="8.3" cy="15.5" r=".6"/><circle cx="12" cy="15.5" r=".6"/><circle cx="15.7" cy="15.5" r=".6"/>',
  etincelle: '<path d="M12 2c.6 3.6 1.8 6.6 4.5 8.5C19.2 12.4 22 12 22 12s-2.8.4-5.5 2.3C13.8 16.2 12.6 19.2 12 22.8 11.4 19.2 10.2 16.2 7.5 14.3 4.8 12.4 2 12 2 12s2.8.4 5.5-1.5C10.2 8.6 11.4 5.6 12 2z"/>',
  // ── Reprise du mockup Stitch « refonte Classement TCO / Seuils cibles »
  // (voir keeva-tco-feature, phase 3 re-skin) — mêmes raisons que les
  // reprises précédentes : aucune police d'icônes, retracées à la main,
  // même grille 24×24 / trait 2px. Beaucoup de Material Symbols du mockup
  // ont déjà un équivalent tracé plus haut (bar_chart→graphique,
  // local_shipping→vehicule, expand_more→chevron, category→filtre,
  // download→export, arrow_forward→flecheDroite, check_circle/verified→
  // ajuste, history/schedule→bientot, calendar_today→calendrier,
  // info→info) — réutilisés tels quels, pas redessinés une 2ᵉ fois.
  argent: '<rect x="3" y="6" width="15" height="10" rx="2"/><rect x="6" y="9" width="15" height="10" rx="2" fill="none"/><circle cx="13.5" cy="14" r="2"/>',
  parcMachine: '<rect x="2.5" y="13" width="15" height="7" rx="1.5"/><path d="M8 13V9h7l3.5 4"/><circle cx="6.5" cy="20.5" r="2"/><circle cx="16.5" cy="20.5" r="2"/>',
  tendanceHausse: '<path d="M3.5 16.5 10 10l4 4 6.5-6.5"/><path d="M15 7.5h5.5V13"/>',
  trier: '<path d="M7 6v12"/><path d="M4 9l3-3 3 3"/><path d="M17 18V6"/><path d="M14 15l3 3 3-3"/>',
  ciseaux: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8 8l11 8M8 16l11-8"/>',
  scie: '<path d="M3 15.5h14l4-3.5-4-3.5H3z"/><path d="M6 12h.01M9.5 12h.01M13 12h.01"/>',
  herbe: '<path d="M6 21c0-6 1-10 0-15"/><path d="M12 21c0-8 2-13 0-18"/><path d="M18 21c0-6-1-10 0-15"/>',
  curseurs: '<path d="M4 7h9M17 7h3"/><circle cx="14" cy="7" r="2.3"/><path d="M4 12h3M11 12h9"/><circle cx="8" cy="12" r="2.3"/><path d="M4 17h12M20 17h0"/><circle cx="18" cy="17" r="2.3"/>',
  camembert: '<circle cx="12" cy="12" r="9"/><path d="M12 12V3a9 9 0 0 1 9 9z"/>',
  flecheBas: '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
  chevronBas: '<path d="M6 9l6 6 6-6"/>',
  flecheHaut: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
  // ── Reprise Stitch « Tableau de bord » (voir keeva-tco-feature) — deux
  // icônes réellement nouvelles, le reste du mockup réutilise des icônes déjà
  // tracées (chronologieCarteHtml, PICTO_CATEGORIE, iconeCategorieMachine…).
  sablier: '<path d="M6 3h12M6 21h12"/><path d="M7 3v3.5a5 5 0 0 0 2.2 4.15L12 12.5l2.8 1.85A5 5 0 0 1 17 18.5V21"/><path d="M17 3v3.5a5 5 0 0 1-2.2 4.15L12 12.5l-2.8 1.85A5 5 0 0 0 7 18.5V21"/>',
  copier: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  // ── Reprise Stitch « Enregistrer une intervention » (voir keeva-tco-feature)
  // — une seule icône réellement nouvelle (pompe à carburant), le reste du
  // mockup réutilise des icônes déjà tracées (entretien→clé, alerte→triangle,
  // paiement→coûts, boite→pièces, crayon→remarques, carnet→justificatifs).
  essence: '<rect x="4" y="4" width="9" height="16" rx="1.5"/><path d="M7.5 9h2"/><path d="M13 9.5h2a2 2 0 0 1 2 2V17a1.5 1.5 0 0 0 3 0V9.8L17.3 6.5"/>',
  // Import CSV (catalogue de pièces) — même silhouette que `export`
  // (flèche + plateau), flèche inversée vers le haut.
  televerser: '<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5"/><path d="M4 16.5v2A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-2"/>',
  // Fenêtre des offres (openUpgradeNotice, reprise Stitch) — bouton de
  // l'offre recommandée.
  eclair: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  // Modale d'import CSV du catalogue (reprise Stitch) — « mise à jour
  // intelligente » (upsert par référence).
  rafraichir: '<path d="M20 12a8 8 0 1 1-3-6.3"/><path d="M20 3v5h-5"/>',
  // Support client (échange de ticket, reprise Stitch) — bouton Envoyer.
  envoyer: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  // Sélecteur d'indicatif pays (reprise Stitch) — en-tête de la modale.
  monde: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
};
function picto(nom) {
  const trace = PICTOS[nom];
  if (!trace) return '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${trace}</svg>`;
}
// L'état vient de `dueInfo()` — les MÊMES trois mots que la pastille ; le picto
// ne fait que les rendre lisibles d'un coup d'œil, il n'ajoute aucun sens.
const PICTOS_ETAT = { late: 'retard', soon: 'bientot', ok: 'ajuste' };
function pictoEtat(etat) { return picto(PICTOS_ETAT[etat] || 'ajuste'); }

function navIcone(nom) {
  const trace = NAV_ICONES[nom];
  if (!trace) return '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${trace}</svg>`;
}

function loadReminders() {
  try {
    const raw = JSON.parse(localStorage.getItem(REMINDERS_KEY) || '{}');
    return { ...DEFAULT_REMINDERS, ...(raw && typeof raw === 'object' ? raw : {}) };
  } catch (e) {
    return { ...DEFAULT_REMINDERS };
  }
}
function saveReminders(r) {
  try { localStorage.setItem(REMINDERS_KEY, JSON.stringify(r)); } catch (e) { /* stockage indisponible */ }
}

// ── Formatage ─────────────────────────────────────────────────
function formatShortDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${d} ${moisCourt(m - 1)}`;
}
function formatShortDateAvecAnnee(iso) {
  // Comme formatShortDate, mais avec l'année — utilisé pour le bouton du
  // sélecteur de date (habillerChampDate) où l'année n'est pas déductible
  // du contexte (contrairement aux échéances/rappels, toujours proches).
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${d} ${moisCourt(m - 1)} ${y}`;
}
function formatLongDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${d} ${moisLong(m - 1)} ${y}`;
}
function formatHours(n) {
  const v = Number(n);
  if (!isFinite(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
function initialsFrom(label) {
  return esc(String(label || 'PP').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'PP');
}
function firstNameFrom(label) {
  const w = String(label || '').trim().split(/\s+/).filter(Boolean);
  return w.length ? w[0] : '';
}

// ── Échéances et statuts ──────────────────────────────────────
// state : 'late' (en retard) | 'soon' (sous 15 j / fenêtre de rappel) | 'ok' | 'unknown'
// urgency : position dans la fenêtre de « bientôt » — 0 = échéance atteinte,
// 1 = bord de la fenêtre. Permet de classer ensemble des machines suivies au
// compteur et au calendrier, sans convertir des heures en jours.
function dueInfo(plan, machine) {
  if (!plan) {
    return { state: 'unknown', label: trad('Pas de plan de maintenance'), short: trad('Plan à définir'), sortKey: Number.POSITIVE_INFINITY, urgency: Number.POSITIVE_INFINITY, unit: null };
  }
  if (planIsCounter(plan)) {
    const unit = counterUnitOf(machine);
    const current = machineCounter(machine);
    const nextDue = planNextDueCounter(plan);
    if (nextDue == null || current == null) {
      return { state: 'unknown', label: tR('Renseigner le {unite}', { unite: unit === 'km' ? trad('kilométrage') : trad('compteur horaire') }), short: trad('Compteur à saisir'), sortKey: Number.POSITIVE_INFINITY, urgency: Number.POSITIVE_INFINITY, unit };
    }
    const remaining = nextDue - current;
    const horizon = planReminderCounter(plan);
    const ctx = tR('compteur {compteur} · échéance {echeance}', { compteur: formatCounter(current, unit), echeance: formatCounter(nextDue, unit) });
    const urgency = horizon > 0 ? remaining / horizon : 0;
    const short = remaining < 0 ? `+${formatCounter(Math.abs(remaining), unit)}` : formatCounter(remaining, unit);
    // Phrases CONSTRUITES : le texte et les valeurs sont mêlés, donc t() ne peut
    // pas les prendre au moment de l'extraction. Elles passent par tR(), avec la
    // phrase entière comme clé et des {emplacements} pour les valeurs.
    if (remaining < 0) return { state: 'late', label: tR('En retard de {valeur} ({contexte})', { valeur: formatCounter(Math.abs(remaining), unit), contexte: ctx }), short, sortKey: remaining, urgency, unit };
    if (remaining <= horizon) return { state: 'soon', label: tR('Échéance dans {valeur} ({contexte})', { valeur: formatCounter(remaining, unit), contexte: ctx }), short, sortKey: remaining, urgency, unit };
    return { state: 'ok', label: tR('Prochaine échéance dans {valeur} ({contexte})', { valeur: formatCounter(remaining, unit), contexte: ctx }), short, sortKey: remaining, urgency, unit };
  }
  if (!plan.next_due_at) {
    return { state: 'unknown', label: trad('Pas de plan de maintenance'), short: trad('Plan à définir'), sortKey: Number.POSITIVE_INFINITY, urgency: Number.POSITIVE_INFINITY, unit: 'days' };
  }
  const days = daysUntil(plan.next_due_at);
  if (days == null) {
    return { state: 'unknown', label: trad('Date d\'échéance illisible'), short: '—', sortKey: Number.POSITIVE_INFINITY, urgency: Number.POSITIVE_INFINITY, unit: 'days' };
  }
  const urgency = days / SOON_DAYS;
  if (days < 0) return { state: 'late', label: tR('En retard de {n} j (échéance le {date})', { n: Math.abs(days), date: formatShortDate(plan.next_due_at) }), short: tR('+{n} j', { n: Math.abs(days) }), sortKey: days, urgency, unit: 'days' };
  if (days <= SOON_DAYS) return { state: 'soon', label: tR('Échéance dans {n} j (le {date})', { n: days, date: formatShortDate(plan.next_due_at) }), short: formatShortDate(plan.next_due_at), sortKey: days, urgency, unit: 'days' };
  return { state: 'ok', label: tR('Prochaine échéance dans {n} j (le {date})', { n: days, date: formatShortDate(plan.next_due_at) }), short: formatShortDate(plan.next_due_at), sortKey: days, urgency, unit: 'days' };
}

// Tâche suivante : la PLUS URGENTE quand les tâches portent leur propre échéance
// (chantier « une échéance par tâche » : le client voit ainsi quel entretien est
// en retard) ; sinon le premier élément du plan, puis la première tâche de la
// liste — comportement d'origine, conservé pour les plans sans échéance par tâche.
function nextTaskLabel(machine) {
  const urgente = tacheLaPlusUrgente(machine.plan?.items, machine.plan, machine);
  if (urgente && urgente.item && urgente.item.label) return urgente.item.label;
  const items = normalizeItems(machine.plan?.items);
  const first = items.find(it => it.label);
  if (first) return first.label;
  const tasks = (machine.plan?.tasks || '').split(',').map(t => t.trim()).filter(Boolean);
  return tasks[0] || 'Entretien';
}

function machineCounts(machines) {
  const c = { late: 0, soon: 0, ok: 0, manuals: 0, analysed: 0 };
  machines.forEach(m => {
    const info = infoMachine(m);
    if (info.state === 'late') c.late++;
    else if (info.state === 'soon') c.soon++;
    else c.ok++;                       // à jour + plans non renseignés : rien à traiter
    if (m.manual_url) c.manuals++;
    if (normalizeItems(m.plan?.items).length) c.analysed++;
  });
  return c;
}

// Stock & SAV — décompte pur (même famille que machineCounts ci-dessus) :
// une ligne stock_items est « en alerte » quand sa quantité passe sous le
// seuil EFFECTIF (son propre reorder_point s'il existe, sinon le seuil par
// défaut de la pièce) — jamais comptée si aucun des deux seuils n'est
// renseigné (silence honnête, pas une alerte à 0 fabriquée). Utilisée par
// la pastille du menu Plus et la carte KPI de la page Stock.
function calculerStockCounts(stockItems, partsCatalog) {
  const seuilParPiece = new Map((partsCatalog || []).map((p) => [String(p.id), p.default_reorder_point]));
  let seuilBas = 0;
  (stockItems || []).forEach((it) => {
    const seuil = it.reorder_point ?? seuilParPiece.get(String(it.part_id));
    if (seuil != null && Number(it.quantity) <= Number(seuil)) seuilBas++;
  });
  return { seuilBas };
}

// Échéances à traiter, les plus urgentes d'abord.
function openAlerts() {
  return UI.machines
    .map(m => ({ machine: m, info: infoMachine(m) }))
    .filter(x => x.info.state === 'late' || x.info.state === 'soon')
    .sort((a, b) => {
      const rank = (s) => (s === 'late' ? 0 : 1);
      if (rank(a.info.state) !== rank(b.info.state)) return rank(a.info.state) - rank(b.info.state);
      // Le plus urgent d'abord, dans un cas comme dans l'autre — `urgency`
      // reste comparable même quand deux machines sont en retard sur des
      // dimensions différentes (l'une en heures, l'autre en jours).
      return a.info.urgency - b.info.urgency;
    });
}

// ★ LOT 8 — LA LISTE « ÉCHÉANCES D'ENTRETIEN » : TOUTES LES MACHINES SUIVIES.
// `openAlerts()` répond à « qu'est-ce qui est à TRAITER ? » et c'est la bonne
// question pour le bandeau et pour les compteurs : deux états seulement — en
// retard, bientôt. La LISTE, elle, répond à « où en est mon parc ? » : elle
// montre donc chaque machine, avec son état (en retard · bientôt · à jour ·
// plan à définir). La maquette fait exactement cela : le retardataire est dans le
// bandeau ET dans la liste — l'un résume, l'autre donne l'ensemble.
// Le tri est celui du bandeau (retard d'abord, puis échéance la plus proche) :
// les mêmes clés que `dueInfo()`, aucune donnée recalculée, deux machines ne
// peuvent pas permuter d'un rendu à l'autre.
function echeancesListe() {
  const rang = (s) => (s === 'late' ? 0 : s === 'soon' ? 1 : 2);
  return UI.machines
    .map(m => ({ machine: m, info: infoMachine(m) }))
    .sort((a, b) => {
      if (rang(a.info.state) !== rang(b.info.state)) return rang(a.info.state) - rang(b.info.state);
      if (a.info.urgency !== b.info.urgency) return a.info.urgency - b.info.urgency;
      return a.machine.name.localeCompare(b.machine.name);
    });
}

function badgeClass(state) {
  if (state === 'late') return 'alert';
  if (state === 'soon') return 'soon';
  if (state === 'ok') return 'ok';
  return 'neutral';
}
function badgeLabel(state) {
  if (state === 'late') return trad('En retard');
  if (state === 'soon') return trad('Bientôt');
  if (state === 'ok') return trad('À jour');
  return trad('Plan à définir');
}

// ── Coquille ──────────────────────────────────────────────────
function greetingLabel() {
  // Le prénom est saisi séparément depuis la rubrique « Mon compte » ; le repli
  // sur le contact historique garde les bases non migrées fonctionnelles.
  const who = UI.contactFirstName || firstNameFrom(UI.contactName) || firstNameFrom(UI.companyName);
  return who ? tR('Bonjour {nom}', { nom: esc(who) }) : trad('Bonjour');
}

// La marque KALEA (hexagone + barre), en SVG : l'identifiant du dégradé doit être
// unique dans la page, la couleur de la barre change selon le fond (encre sur
// blanc, blanc sur nuit).
function marqueSvg(idDegrade, couleurBarre) {
  // Symbole KALEA : barre blanche = fond sombre (version nuit), sinon version fond clair.
  return couleurBarre === '#FFFFFF'
    ? '<svg viewBox="338 248 1228 1228" focusable="false"><circle cx="952" cy="862" r="598" fill="#18183A" stroke="#8F8FCB" stroke-width="31"/><rect x="694" y="528" width="92" height="700" rx="46" fill="#FFFFFF"/><path d="M742,872 C850,780 1000,660 1130,625 C1190,610 1225,630 1205,662 C1185,700 1140,725 1080,732 C960,745 850,800 742,872 Z" fill="#16B2CB"/><path d="M742,872 C860,940 1000,1010 1110,1025 C1180,1035 1235,1055 1233,1080 C1230,1110 1170,1118 1120,1105 C1000,1075 870,960 742,872 Z" fill="#E78B20"/><circle cx="946" cy="878" r="73" fill="#8F8FCB"/></svg>'
    : '<svg viewBox="338 248 1228 1228" focusable="false"><circle cx="952" cy="862" r="598" fill="#FFFFFF" stroke="#6864DF" stroke-width="31"/><rect x="694" y="528" width="92" height="700" rx="46" fill="#18183A"/><path d="M742,872 C850,780 1000,660 1130,625 C1190,610 1225,630 1205,662 C1185,700 1140,725 1080,732 C960,745 850,800 742,872 Z" fill="#16B2CB"/><path d="M742,872 C860,940 1000,1010 1110,1025 C1180,1035 1235,1055 1233,1080 C1230,1110 1170,1118 1120,1105 C1000,1075 870,960 742,872 Z" fill="#E78B20"/><circle cx="946" cy="878" r="73" fill="#6864DF"/></svg>';
}

function sidebarHtml() {
  return `
    <span class="wordmark"><span class="wm-logo" aria-hidden="true">${marqueSvg('keeva-barre', '#0E1333')}</span><span>KALEA</span></span>
    ${navItemsVisibles().map(item => `<button type="button" class="nav-item${UI.view === item.id ? ' is-active' : ''}" data-nav="${item.id}"><span class="nav-ico" aria-hidden="true">${navIcone(item.icon)}</span>${esc(item.label)}</button>`).join('')}
    <div class="sidebar-foot">
      <div class="version-ligne"><span>${trad('Version')}</span><span>v${esc(versionAffichee())}</span></div>
      <button type="button" id="logout-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg><span>${trad('Se déconnecter')}</span></button>
    </div>`;
}

// En-tête du téléphone : la marque, le nom de l'écran, l'accès au compte. Il
// n'existe que sous 900 px (la barre latérale prend le relais au-dessus).
function barreMobileHtml() {
  const entree = NAV_ITEMS.find((item) => item.id === UI.view);
  return `
    <header class="barre-mobile">
      <span class="bm-logo" aria-hidden="true">${marqueSvg('keeva-mobile', '#FFFFFF')}</span>
      <span class="bm-texte">
        <span class="bm-nom">KALEA</span>
        ${entree ? `<span class="bm-page">${esc(entree.short)}</span>` : ''}
      </span>
      <button type="button" class="bm-compte" id="bm-compte" aria-label="${trad('Mon compte')}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></button>
    </header>`;
}

function tabbarHtml() {
  const slot = (t) => {
    if (t.id === 'fab') return `<button type="button" class="tab-fab" id="fab-add" aria-label="${trad('Ajouter une machine')}"><span>+</span></button>`;
    if (t.id === 'plus') return `<button type="button" class="tab" id="open-plus"><span class="tab-icon" aria-hidden="true">${navIcone(t.icon)}</span>${esc(t.short)}</button>`;
    const active = UI.view === t.id;
    return `<button type="button" class="tab${active ? ' is-active' : ''}" data-nav="${t.id}"><span class="tab-icon" aria-hidden="true">${navIcone(t.icon)}</span>${esc(t.short)}</button>`;
  };
  return TABS.map(slot).join('');
}

// ★ LOT 8 — L'EN-TÊTE DE LA MAQUETTE, POUR LE TABLEAU DE BORD SEUL.
// Le composant est monté dans `pageHeadHtml` (il appartient à l'en-tête de page,
// pas à une vue), et la feuille ne l'affiche QUE sur `[data-view="dashboard"]` et
// QU'À PARTIR DE 900 px : sur téléphone, l'en-tête compact que le produit a déjà
// (salut + compteur de machines) reste le bon, et le bouton « Ajouter une
// machine » vit déjà dans la barre d'onglets, au pouce.
// Aucune donnée nouvelle : le mot d'accueil vient de `greetingLabel()` (le prénom
// de « Mon compte »), le compte de `UI.machines`, les initiales de `initialsFrom`.
function dashHeadHtml() {
  const n = UI.machines.length;
  return `
    <div class="dash-head">
      <div class="dash-head-tete">
        <span class="avatar dash-avatar" aria-hidden="true">${initialsFrom(UI.contactName || UI.companyName)}</span>
        <div class="dash-head-mots">
          <h1>${greetingLabel()}</h1>
          <span class="dash-head-compte">${UI.companyName ? tR('{societe} · {n} machine(s) suivie(s)', { societe: esc(UI.companyName), n }) : tR('{n} machine(s) suivie(s)', { n })}</span>
        </div>
        <button type="button" class="dash-ajouter" id="dash-add"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg><span>${trad('Ajouter une machine')}</span></button>
        <button type="button" class="dash-compte" id="dash-compte" aria-label="${trad('Mon compte')}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></button>
      </div>
    </div>`;
}

function pageHeadHtml() {
  const view = VIEWS[UI.view] || VIEWS.dashboard;
  const n = UI.machines.length;
  const subtitle = typeof view.subtitle === 'function' ? view.subtitle() : view.subtitle;
  return `
    ${UI.view === 'dashboard' || UI.view === 'machines' ? dashHeadHtml() : ''}
    <div class="greeting-row">
      <div class="greeting">
        <span class="hello">${greetingLabel()}</span>
        <span class="count">${UI.view === 'dashboard' ? tR('{n} machine(s) suivie(s)', { n }) : `${n} machine${n > 1 ? 's' : ''}`}</span>
      </div>
      <span class="avatar">${initialsFrom(UI.contactName || UI.companyName)}</span>
    </div>
    <div class="head-title">
      <div>
        <h1>${esc(view.title)}</h1>
        <div class="sub">${esc(subtitle)}</div>
      </div>
    </div>`;
}

function renderApp() {
  // Une photo choisie hors connexion attend son envoi : on tente au premier
  // rendu venu (et le retour du réseau relance la tentative).
  if (typeof tenterViderPhotosEnAttente === 'function') tenterViderPhotosEnAttente();
  UI.counts = machineCounts(UI.machines);
  const view = VIEWS[UI.view] || VIEWS.dashboard;
  // Charte : les écrans migrés vers le kit (kit.css) reposent sur une page BLANCHE ; les autres gardent leur fond teinté.
  document.body.classList.toggle('fond-blanc', !!view.fondBlanc);
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">${sidebarHtml()}</aside>
      <div class="main">
        ${barreMobileHtml()}
        <div class="content">
          <div class="view">
            ${bandeauHorsLigneHtml()}
            <div class="page-head" data-view="${esc(UI.view)}">${pageHeadHtml()}</div>
            <main id="view-root" data-view="${esc(UI.view)}">${view.render()}</main>
          </div>
          <div class="legal-footer">
            <a href="./mentions-legales.html" target="_blank">${trad('Mentions légales')}</a> ·
            <a href="./cgu.html" target="_blank">${trad('CGU')}</a> ·
            <a href="./politique-confidentialite.html" target="_blank">${trad('Confidentialité')}</a>
          </div>
        </div>
      </div>
    </div>
    <nav class="tabbar">${tabbarHtml()}</nav>
  `;
  wireShell();
  view.mount?.();
}

function goTo(viewId) {
  UI.view = viewId;
  renderApp();
  window.scrollTo({ top: 0 });
}

function wireShell() {
  document.querySelectorAll('.sidebar [data-nav], .tabbar [data-nav]').forEach(btn => {
    btn.addEventListener('click', () => goTo(btn.dataset.nav));
  });
  document.getElementById('fab-add')?.addEventListener('click', handleAddMachine);
  // ★ LOT 8 — le bouton d'ajout de l'en-tête du tableau de bord mène au MÊME
  // chemin que le « + » de la barre d'onglets et que « Ajouter une machine » du
  // Parc : `handleAddMachine()`, qui ouvre la fenêtre des offres quand le parc a
  // atteint le plafond de l'offre. Aucun second chemin.
  document.getElementById('dash-add')?.addEventListener('click', handleAddMachine);
  document.getElementById('dash-compte')?.addEventListener('click', () => goTo('account'));
  document.getElementById('bm-compte')?.addEventListener('click', () => goTo('account'));

  document.getElementById('open-plus')?.addEventListener('click', openPlusSheet);
  document.getElementById('logout-btn')?.addEventListener('click', doLogout);
  document.getElementById('offline-retry')?.addEventListener('click', () => boot());
}

async function doLogout() {
  // La copie locale contient les données de la société : elle ne doit pas
  // survivre à une déconnexion, surtout sur un appareil partagé.
  effacerCache();
  await sb.auth.signOut();
  // Même raison pour l'accès sans mot de passe : le jeton du trousseau vient
  // d'être révoqué par la déconnexion. Le garder n'apporterait qu'un verrou
  // inutile au prochain lancement, suivi d'un message d'expiration.
  await oublierAccesSansMotDePasse();
  renderLogin();
}

// Limite de machines par offre. Une offre absente de cette table n'a pas de
// limite (Pro, compte illimité de l'éditeur) : c'est la même règle que le
// déclencheur de la base, qui ne contrôle que les offres connues.
// ⚠️ free corrigé à 2 le 2026-10-02 (était à 1, en désaccord avec le tarif
// affiché partout ailleurs — OFFRE_GRILLE, CGU — qui a toujours annoncé 2
// machines pour l'offre Gratuite). Si le déclencheur de la base applique
// encore 1, il doit être corrigé pour rester en phase avec cette table.
// PLAFOND de machines par offre (2026-10-06, nouvelle grille) : le nombre de machines qu'on peut AJOUTER au maximum. C'est plus que le
// nombre de machines INCLUSES dans le prix (Starter 5, Business 20, Enterprise 40) : les suivantes sont facturées en supplément
// (+ 2 € / + 1,50 € / + 1 €), jusqu'au plafond. Au-delà : offre supérieure, ou « Grand compte » (sur devis) après 150.
// Les clés historiques (eco, pro, paid) et les clés de la grille (starter, business, enterprise) ont la même limite. 'unlimited' (compte
// illimité de l'éditeur) et toute clé inconnue : aucune limite — comme avant.
// ⚠️ MÊME TABLE dans send-maintenance-reminders et recap-hebdo (kalea-serveur) et dans le déclencheur de la base
// (limites-machines.sql) : tests/limites-offres.test.mjs (kalea-serveur) vérifie que les trois concordent.
const LIMITES_OFFRES = { free: 2, eco: 10, starter: 10, pro: 40, business: 40, paid: 150, enterprise: 150 };

// ── Couverture par l'offre ────────────────────────────────────────────────────
// Quand une période payée s'achève et que le compte repasse en gratuit, RIEN
// n'est perdu : tout reste consultable. Mais les machines AU-DELÀ de la limite
// de l'offre passent en LECTURE SEULE et ne reçoivent plus de rappels.
//
// Ce sont les plus ANCIENNES qui restent couvertes (created_at croissant,
// égalité départagée par id) : c'est déterministe, cela se dit en une phrase au
// client, et supprimer une machine couverte fait entrer la suivante dans le
// quota. Aucune machine n'est supprimée ni masquée : elle redevient pleinement
// active dès que le compte repasse à une offre couvrante.
//
// ⚠️ RÈGLE IDENTIQUE dans la fonction de rappels (send-maintenance-reminders) :
// les deux implémentations sont comparées automatiquement (_verif-biometrie.mjs,
// section « couverture »), parce que deux règles divergentes passeraient
// inaperçues — l'application dirait « couverte » et le rappel partirait, ou
// l'inverse.
function limiteOffre() {
  // MÊME REPLI que la fonction de rappels : une offre absente ou illisible vaut
  // « gratuit » (1 machine), jamais « illimité ». Sans ce repli, un compte dont
  // la colonne plan est nulle se croyait illimité côté application alors que les
  // rappels n'en couvraient qu'une — c'est ce que le contrôle croisé a montré.
  const offre = String(UI.companyPlan || 'free').toLowerCase();
  const limite = LIMITES_OFFRES[offre];
  return limite == null ? null : limite;
}

// created_at d'abord, puis l'identifiant : le même ordre que la fonction de
// rappels. Un created_at absent (base plus ancienne) laisse l'ordre par id.
function ordreCreation(a, b) {
  const ca = a && a.created_at ? String(a.created_at) : '';
  const cb = b && b.created_at ? String(b.created_at) : '';
  if (ca !== cb) return ca < cb ? -1 : 1;
  const ia = String(a && a.id ? a.id : '');
  const ib = String(b && b.id ? b.id : '');
  return ia < ib ? -1 : (ia > ib ? 1 : 0);
}

function machinesCouvertes() {
  const triees = [...UI.machines].sort(ordreCreation);
  const limite = limiteOffre();
  return limite == null ? triees : triees.slice(0, limite);
}

function machineCouverte(machine) {
  if (!machine) return true;
  if (limiteOffre() == null) return true;
  return machinesCouvertes().some((m) => m.id === machine.id);
}

// Message UNIQUE pour toutes les écritures refusées (i18n).
function messageMachineNonCouverte() {
  return tR('Ton offre actuelle couvre {n} machine(s). Repasse à une offre payante pour continuer à suivre celle-ci.', { n: limiteOffre() });
}

// Refuse une écriture sur une machine non couverte, en menant à la fenêtre des
// offres. Renvoie true quand l'écriture est refusée et que l'appelant doit
// s'arrêter là. Aucune donnée n'est touchée.
function refuserSiNonCouverte(machine) {
  if (machineCouverte(machine)) return false;
  openUpgradeNotice(UI.companyId, messageMachineNonCouverte());
  return true;
}

// ── Machines en plus (2026-10-08) ─────────────────────────────────────────────
// Le prix fixe de l'offre couvre les machines INCLUSES ; chaque machine au-delà (jusqu'au plafond de l'offre) est facturée en
// supplément sur l'abonnement Stripe : Starter + 2 €, Business + 1,50 €, Enterprise + 1 € par machine et par mois.
// C'est le SERVEUR qui ajuste l'abonnement (fonction `stripe-sync-machines`, aussi appelée par le webhook et par une tâche
// quotidienne de rattrapage) : l'application la prévient après un ajout ou une suppression, et demande une confirmation AVANT
// l'ajout d'une machine qui sera facturée en plus — le client ne doit jamais découvrir la hausse sur sa facture.
// ⚠️ MÊMES chiffres que GRILLE dans kalea-serveur/supabase/functions/_shared/machines-supplementaires.ts :
// tests/machines-supplementaires.test.mjs (kalea-serveur) vérifie qu'ils concordent. À modifier ENSEMBLE.
const INCLUSES_OFFRES = { eco: 5, starter: 5, pro: 20, business: 20, paid: 40, enterprise: 40 };
const SUPPLEMENT_OFFRES = { eco: 2, starter: 2, pro: 1.5, business: 1.5, paid: 1, enterprise: 1 };

// Combien de machines sont facturées EN PLUS pour un parc de n machines (même formule que le serveur) :
// min(n, plafond de l'offre) − machines incluses, jamais négatif. 0 pour une offre sans supplément (gratuit, illimité…).
function machinesEnPlusFacturees(plan, n) {
  const cle = String(plan || '').toLowerCase();
  const incluses = INCLUSES_OFFRES[cle];
  const plafond = LIMITES_OFFRES[cle];
  if (incluses == null || plafond == null) return 0;
  return Math.max(0, Math.min(Number(n) || 0, plafond) - incluses);
}

function prixEuros(montant) {
  return `${Number(montant).toLocaleString(localeActive(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// Prévient le serveur que le nombre de machines a changé. Jamais bloquant : une erreur est sans conséquence, la tâche
// quotidienne de rattrapage corrigera l'abonnement.
function synchroniserMachinesStripe() {
  try {
    Promise.resolve(sb.functions.invoke('stripe-sync-machines', { method: 'POST' })).catch(() => {});
  } catch (err) { /* sans conséquence : voir ci-dessus */ }
}

// true = l'ajout peut continuer. Une confirmation n'est demandée que si CETTE machine sera réellement facturée en plus :
// offre à supplément, au-delà des machines incluses, et abonnement Stripe en cours (une offre accordée à la main ou une
// institution facturée sur facture ne déclenche aucune facturation automatique).
async function confirmerMachineEnPlus() {
  const plan = UI.companyPlan;
  const avant = machinesEnPlusFacturees(plan, UI.machines.length);
  const apres = machinesEnPlusFacturees(plan, UI.machines.length + 1);
  if (apres <= avant || estInstitution()) return true;
  try {
    const { data } = await sb.from('companies').select('stripe_subscription_id').eq('id', UI.companyId).maybeSingle();
    if (!data || !data.stripe_subscription_id) return true;
  } catch (err) {
    return true;
  }
  const prix = prixEuros(SUPPLEMENT_OFFRES[String(plan).toLowerCase()]);
  return window.confirm(tR('Cette machine dépasse celles incluses dans ton offre : elle est facturée {prix} par mois en plus, au prorata du mois en cours, sur ta prochaine facture. Ajouter la machine ?', { prix }));
}

// Une ligne pour « Mon compte » : « 8 machines : 5 incluses + 3 en plus (+ 6,00 € par mois) ». Vide s'il n'y a rien en plus.
function phraseMachinesEnPlus() {
  if (estInstitution()) return '';
  const plan = String(UI.companyPlan || '').toLowerCase();
  const enPlus = machinesEnPlusFacturees(plan, UI.machines.length);
  if (enPlus <= 0) return '';
  return tR('{n} machines : {incluses} incluses + {enPlus} en plus (+ {montant} par mois)', {
    n: UI.machines.length, incluses: INCLUSES_OFFRES[plan], enPlus, montant: prixEuros(enPlus * SUPPLEMENT_OFFRES[plan]),
  });
}

// Changement d'offre d'un client déjà abonné (Starter ↔ Business). Le gérant voit ce que cela change AVANT de confirmer :
// le nouveau prix, les machines facturées en plus, et — si son parc dépasse ce que couvre la nouvelle offre — l'avertissement
// (les machines au-delà passent en lecture seule, rien n'est supprimé). Le serveur refuse tout rôle autre que gérant.
async function changerOffreAbonnement(cle, bouton, idMessage, overlay) {
  const message = document.getElementById(idMessage || 'forfait-msg');
  const dire = (texte) => { if (message) message.textContent = texte; };
  const cible = offreDeLaGrille(cle);
  const n = UI.machines.length;
  const enPlus = machinesEnPlusFacturees(cible.cle, n);
  const plafond = LIMITES_OFFRES[cible.cle];
  let question = tR('Passer à l\'offre {offre} ({prix}) ? Le changement est facturé au prorata sur ta prochaine facture.',
    { offre: trad(cible.offre), prix: trad(cible.prix) });
  if (enPlus > 0) {
    question += ' ' + tR('Avec tes {n} machines, {enPlus} seront facturées en plus ({montant} par mois).',
      { n, enPlus, montant: prixEuros(enPlus * SUPPLEMENT_OFFRES[cible.cle]) });
  }
  if (plafond != null && n > plafond) {
    question += ' ' + tR('Attention : ton parc ({n} machines) dépasse ce que couvre cette offre ({plafond}) : les machines au-delà passeront en lecture seule.', { n, plafond });
  }
  if (!window.confirm(question)) return;
  dire('');
  if (bouton) bouton.disabled = true;
  try {
    const { data, error } = await sb.functions.invoke('stripe-sync-machines', { method: 'POST', body: { action: 'changer_offre', offre: cle } });
    let reponse = data;
    if (error) {
      try { reponse = await error.context.json(); } catch (err) { reponse = null; }
      const statut = error.context && error.context.status;
      if (statut === 403) { dire(trad('Seul le gérant peut changer l\'offre.')); return; }
    }
    if (reponse && reponse.statut === 'ok') {
      if (overlay) overlay.remove();
      boot(trad('Offre modifiée'));
      return;
    }
    if (reponse && reponse.raison === 'aucun abonnement Stripe') { dire(trad("Aucun abonnement n'est rattaché à ce compte.") + ' ' + trad('Écris à support@kalea.pro.')); return; }
    dire(trad('Impossible de changer l\'offre pour le moment. Réessaie dans un instant, ou écris à support@kalea.pro.'));
  } catch (err) {
    dire(trad('Impossible de changer l\'offre pour le moment. Réessaie dans un instant, ou écris à support@kalea.pro.'));
  } finally {
    if (bouton) bouton.disabled = false;
  }
}

async function handleAddMachine() {
  const limite = LIMITES_OFFRES[UI.companyPlan];
  if (limite != null && UI.machines.length >= limite) { openUpgradeNotice(UI.companyId); return; }
  if (!(await confirmerMachineEnPlus())) return;
  openAddWizard(UI.companyId, UI.categories);
}

// ── Confort des modales ───────────────────────────────────────
// Appliqué automatiquement à toute .overlay ajoutée au document : rôle de
// dialogue, focus initial, piège à focus, fermeture par Échap, et garde-fou
// contre la perte d'une saisie en cours. Aucune modale n'a besoin d'y penser.
const modalMeta = new WeakMap();

function focusableIn(root) {
  return Array.from(root.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el => el.offsetParent !== null || el === document.activeElement);
}

function formSnapshot(form) {
  return Array.from(form.elements).map(el => {
    const key = el.name || el.id || el.tagName;
    if (el.type === 'checkbox' || el.type === 'radio') return `${key}:${el.checked}`;
    if (el.type === 'file') return `${key}:${el.files ? el.files.length : 0}`;
    return `${key}:${el.value}`;
  }).join('|');
}

// Une photo distante peut ne pas se charger : on retire l'image plutôt que
// d'afficher une icône cassée. Écouteur en phase de CAPTURE, car l'événement
// « error » d'une <img> ne remonte pas jusqu'au document.
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el && el.tagName === 'IMG' && el.classList && el.classList.contains('machine-photo')) el.remove();
}, true);

function overlayIsDirty(overlay) {
  const meta = modalMeta.get(overlay);
  if (!meta) return false;
  const form = overlay.querySelector('form');
  if (!form || !meta.snapshot) return false;
  return formSnapshot(form) !== meta.snapshot;
}

function enhanceModal(overlay) {
  const meta = modalMeta.get(overlay) || {};
  if (!meta.previousFocus) meta.previousFocus = document.activeElement;
  const form = overlay.querySelector('form');
  // L'instantané est pris à l'ouverture, et repris uniquement si le formulaire
  // est REMPLACÉ (changement d'étape d'un assistant). Une mise à jour
  // asynchrone à l'intérieur du même formulaire — chargement d'une photo ou de
  // l'historique — ne doit pas déplacer la référence, sinon la saisie déjà
  // faite par l'utilisateur deviendrait la nouvelle référence.
  if (form !== meta.formEl) {
    meta.formEl = form || null;
    meta.snapshot = form ? formSnapshot(form) : null;
  }
  modalMeta.set(overlay, meta);

  const dialog = overlay.querySelector('.modal, .sheet');
  if (dialog && !dialog.hasAttribute('role')) {
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const title = dialog.querySelector('h1, h2');
    if (title) {
      if (!title.id) title.id = `modal-title-${Math.random().toString(36).slice(2, 8)}`;
      dialog.setAttribute('aria-labelledby', title.id);
    }
  }

  requestAnimationFrame(() => {
    if (!document.body.contains(overlay)) return;
    const active = document.activeElement;
    if (active && overlay.contains(active)) return;      // le focus est déjà dedans
    const target = overlay.querySelector('[autofocus]') || focusableIn(overlay)[0];
    // ★ `preventScroll` — sans lui, ce focus (posé sur le premier élément
    // focusable, en haut de la modale, pour l'accessibilité) fait remonter
    // TOUTE modale scrollable jusqu'en haut, même quand elle vient d'être
    // rouverte à une position précise (voir openPlanView/options.scrollTop) :
    // ce focus arrive PLUS TARD (via requestAnimationFrame, sur la frame
    // suivante) que l'affectation de overlay.scrollTop faite à l'ouverture,
    // et l'écrase. Signalé par l'utilisateur sur un vrai téléphone — pas
    // reproduit dans les tests navigateur (le scroll-into-view natif au
    // focus() est plus agressif sur WebView mobile que sur un onglet de
    // test sans focus OS réel, d'où le décalage). Sans effet secondaire sur
    // une ouverture FRAÎCHE : son scrollTop est déjà à 0 par défaut.
    if (target) target.focus({ preventScroll: true });
  });
}

function topOverlay() {
  const all = document.querySelectorAll('.overlay');
  return all.length ? all[all.length - 1] : null;
}

function requestCloseOverlay(overlay) {
  if (!overlay) return;
  if (overlayIsDirty(overlay)) {
    const ok = window.confirm(trad('Fermer sans enregistrer ? Les informations saisies seront perdues.'));
    if (!ok) return;
  }
  const meta = modalMeta.get(overlay);
  overlay.remove();
  const previous = meta && meta.previousFocus;
  if (previous && document.body.contains(previous) && typeof previous.focus === 'function') previous.focus();
}

// ★ UN GLISSÉ DEPUIS L'INTÉRIEUR D'UNE MODALE NE LA FERME PAS. Quand on appuie sur la souris DANS la modale (pour
//   sélectionner un texte, régler un curseur…) et qu'on relâche À L'EXTÉRIEUR, le navigateur envoie quand même un
//   « click », adressé au plus proche ancêtre commun des deux points : le fond sombre. Toutes nos modales se
//   ferment sur « un clic dont la cible est le fond » : elles se fermaient donc à tort. On retient où l'appui a
//   commencé, et on avale ce faux clic AVANT qu'il n'atteigne la modale (phase de capture, donc avant ses écouteurs).
//   Un vrai clic sur le fond (appui ET relâchement sur le fond) passe normalement. Le sens inverse (appui sur le
//   fond, relâchement dans la modale) est avalé aussi.
let cibleAppuiSouris = null;
let cibleRelacheSouris = null;
document.addEventListener('mousedown', (e) => { cibleAppuiSouris = e.target; cibleRelacheSouris = null; }, true);
document.addEventListener('mouseup', (e) => { cibleRelacheSouris = e.target; }, true);
document.addEventListener('touchstart', (e) => { cibleAppuiSouris = e.target; cibleRelacheSouris = e.target; }, { capture: true, passive: true });
document.addEventListener('click', (e) => {
  const cible = e.target;
  if (!cible || !cible.matches || !cible.matches('.overlay, [class*="-overlay"], [id$="-overlay"]')) return;
  if ((cibleAppuiSouris && cibleAppuiSouris !== cible) || (cibleRelacheSouris && cibleRelacheSouris !== cible)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);

// Un seul écouteur pour toutes les modales : Échap et piège à focus.
document.addEventListener('keydown', (e) => {
  const overlay = topOverlay();
  if (!overlay) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    requestCloseOverlay(overlay);
    return;
  }
  if (e.key !== 'Tab') return;
  const items = focusableIn(overlay);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}, true);

// Clic à l'extérieur : on intercepte avant le gestionnaire de la modale pour
// pouvoir demander confirmation si un formulaire a été modifié.
document.addEventListener('click', (e) => {
  const overlay = topOverlay();
  if (!overlay || e.target !== overlay) return;
  if (!overlayIsDirty(overlay)) return;                  // comportement d'origine
  if (!window.confirm(trad('Fermer sans enregistrer ? Les informations saisies seront perdues.'))) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

// Afficher / masquer le mot de passe : UN SEUL gestionnaire pour tous les champs
// concernés, y compris ceux des modales créées plus tard.
//
// Avant, chaque écran branchait son propre bouton : celui du nouveau mot de
// passe, celui de l'inscription… et l'écran de connexion n'en avait aucun, alors
// que c'est là qu'on saisit un mot de passe le plus souvent — et là qu'une faute
// de frappe coûte le plus cher, puisque rien ne laisse voir ce qu'on a tapé.
// Le bouton agit sur le champ de son propre groupe : aucune identification à
// maintenir, et tout nouveau champ ajouté en hérite.
// Choix de la langue : un seul gestionnaire pour les deux écrans qui le
// proposent (connexion et « Mon compte »), comme pour l'affichage du mot de passe.
document.addEventListener('click', (e) => {
  const bouton = e.target && e.target.closest ? e.target.closest('.lang-btn') : null;
  if (!bouton) return;
  changerLangue(bouton.dataset.langue);
});

document.addEventListener('click', (e) => {
  const bouton = e.target && e.target.closest ? e.target.closest('.toggle-pw-btn') : null;
  if (!bouton) return;
  const enveloppe = bouton.closest('.password-wrap');
  const champ = enveloppe ? enveloppe.querySelector('input') : null;
  if (!champ) return;
  const visible = champ.type === 'text';
  champ.type = visible ? 'password' : 'text';
  bouton.textContent = visible ? trad('Afficher') : 'Masquer';
  bouton.setAttribute('aria-pressed', String(!visible));
  // Le focus revient au champ, curseur à la fin : on continue sa saisie sans
  // avoir à recliquer dedans.
  champ.focus();
  try { champ.setSelectionRange(champ.value.length, champ.value.length); } catch (err) { /* type sans sélection */ }
});

// Chaque apparition de modale (et chaque changement d'étape) est équipée.
const modalObserver = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.classList.contains('overlay')) enhanceModal(node);
      else if (node.closest && node.closest('.overlay')) enhanceModal(node.closest('.overlay'));
      else if (node.querySelector && node.querySelector('form')) {
        const host = node.closest ? node.closest('.overlay') : null;
        if (host) enhanceModal(host);
      }
    }
  }
});
modalObserver.observe(document.body, { childList: true, subtree: true });

// ── Confirmation d'action (toast) ─────────────────────────────
function showToast(message) {
  if (!message) return;
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-on'));
  setTimeout(() => {
    el.classList.remove('is-on');
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

// ── Éléments partagés ─────────────────────────────────────────
function dropzoneHtml(id) {
  return `
    <div class="dropzone" id="${id}">
      <span class="dz-titre"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M12 17v-6M9.5 13.5L12 11l2.5 2.5"/></svg><span class="dz-title">${trad('Déposer un manuel PDF')}</span></span>
      <span class="dz-help">${trad('Notre algorithme extrait les échéances (heures, mois) et crée le plan d\'entretien. Tu valides avant activation.')}</span>
      <span class="dz-zone">
        <span class="dz-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M7 18a4 4 0 01-.6-7.96A6 6 0 0117.9 8.6 4.5 4.5 0 0117 18M12 12v7M9 15l3-3 3 3"/></svg></span>
        <span class="dz-texte">
          <span class="dz-glisser">${trad('Glissez votre PDF ici ou parcourez')}</span>
          <span class="dz-formats">${trad('Format accepté : PDF')}</span>
        </span>
      </span>
    </div>`;
}

function attachDropzone(el, onFile) {
  if (!el) return;
  el.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.addEventListener('change', () => { if (input.files && input.files[0]) onFile(input.files[0]); });
    input.click();
  });
  ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(ev => el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.remove('is-over'); }));
  el.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
    if (f) onFile(f);
  });
}

// ── Rappels : ce que l'application annonce, et ce qu'elle fait ───────────────
//
// Trois canaux existent VRAIMENT : les notifications du téléphone, programmées
// par l'application Android (sans réseau, sans service tiers) ; l'e-mail,
// envoyé par le serveur une fois par jour — il part donc même application
// fermée ; et le push (FCM), envoyé par le serveur, ciblé par rôle avec un
// délai d'anticipation propre à chaque rôle (voir blocCiblagePushHtml). Le
// canal WhatsApp envisagé un temps a été explicitement abandonné (coût par
// message, jamais gratuit contrairement au push) — plus aucune trace dans
// l'interface.
//
// D'où la disparition des interrupteurs `data-reminder` : un bouton qui
// s'allume sans rien changer côté serveur fait croire que le message partira.
// La carte affiche donc l'ÉTAT réel ; les réglages qui agissent vraiment sont
// dans la vue « Rappels » et s'enregistrent en base (update_my_reminders).

// Adresse qui reçoit les rappels : celle de la société, sinon celle du compte
// (l'adresse de connexion), qui est un repli toujours plausible — c'est aussi
// ce que la vue « Rappels » propose à la saisie.
function adresseRappels() {
  return (UI.company && UI.company.notification_email) || UI.email || '';
}

// Case « Recevoir les rappels par e-mail » : elle reflète le réglage du serveur,
// VRAI par défaut — y compris quand la colonne n'existe pas encore en base
// (migration-rappels-email.sql non exécutée), puisque la base elle-même la
// déclare « not null default true ».
function rappelsEmailCoches() {
  return !UI.company || UI.company.reminders_email !== false;
}

// Est-ce qu'un e-mail partira, là, maintenant ? Il faut les deux : une adresse
// enregistrée ET le canal activé. Une case cochée sans adresse n'envoie rien —
// l'annoncer « actif » serait exactement la promesse en l'air qu'on corrige.
function rappelsEmailActifs() {
  if (SCHEMA.hasReminders === false) return false;
  if (!rappelsEmailCoches()) return false;
  return !!(UI.company && UI.company.notification_email);
}

// TÉLÉPHONES RELIÉS AU COMPTE. Un navigateur ne sait pas ce qui se passe sur un téléphone, mais le téléphone, lui, enregistre
// son jeton de notification (push_tokens) au nom du compte dès que le client active les notifications. La table est en lecture
// personnelle : on ne compte donc QUE les téléphones de la personne connectée. Lecture silencieuse, sans effet si la table manque.
async function chargerAppareilsPush() {
  if (rappelsDisponibles()) return;
  const maintenant = Date.now();
  if (UI._appareilsPushAt && maintenant - UI._appareilsPushAt < 20000) return;
  UI._appareilsPushAt = maintenant;
  try {
    const { count, error } = await sb.from('push_tokens').select('id', { count: 'exact', head: true });
    if (error) return;
    UI.appareilsPush = count || 0;
    majIndicateursTelephone();
  } catch (err) { /* table absente ou hors connexion : l'indicateur reste « à installer » */ }
}
function libelleTelephonesLies(n) {
  return n > 1 ? tR('{n} téléphones reliés à votre compte', { n }) : trad('1 téléphone relié à votre compte');
}
function majIndicateursTelephone() {
  const n = UI.appareilsPush || 0;
  const actif = n > 0;
  document.querySelectorAll('[data-tel-statut]').forEach((el) => {
    el.classList.toggle('is-ok', actif);
    el.textContent = actif ? trad('Actif') : trad('À installer');
  });
  const tuile = document.querySelector('[data-tuile="telephone"]');
  if (tuile) {
    tuile.classList.toggle('is-ok', actif);
    const valeur = tuile.querySelector('.ui-tuile-valeur');
    if (valeur) valeur.textContent = actif ? trad('Actif') : trad('À installer');
  }
  document.querySelectorAll('[data-tel-sous]').forEach((el) => {
    el.textContent = actif ? libelleTelephonesLies(n) : (el.dataset.telSous || '');
  });
}

function remindersCardHtml() {
  chargerAppareilsPush();
  const parEmail = rappelsEmailActifs();
  // Les notifications locales n'existent QUE dans l'application Android : dans
  // un navigateur, le greffon est absent et la carte ne doit pas laisser croire
  // qu'un rappel de téléphone est déjà programmé.
  const surTelephone = rappelsDisponibles();
  const parPush = !!monTokenPushConnu();
  const canal = (icone, titre, sous, actif, texteActif, texteInactif, attrStatut, attrSous) => `
          <div class="ui-ligne is-deux">
            <div class="ui-ligne-id">
              <div class="ui-ligne-icone">${picto(icone)}</div>
              <div class="ui-ligne-textes">
                <span class="ui-ligne-nom">${titre}</span>
                <span class="ui-ligne-sous"${attrSous ? ' ' + attrSous : ''}>${sous}</span>
              </div>
            </div>
            <div class="ui-ligne-action"><span class="ui-statut ${actif ? 'is-ok' : ''}"${attrStatut ? ' ' + attrStatut : ''}>${actif ? texteActif : texteInactif}</span></div>
          </div>`;
  return `
    <section class="ui-section">
      ${teteSectionKit('cloche', trad('Canaux de rappels'), '', `<button type="button" class="ui-btn ui-btn-pastille" data-nav="reminders">${trad('Régler')}</button>`)}
      <div class="ui-section-corps">
        <div class="ui-liste">
          ${surTelephone
            ? canal('telephone', trad('Sur le téléphone'), trad('Service d\'arrière-plan actif'), true, trad('Actif'), trad('À installer'))
            : canal('telephone', trad('Sur le téléphone'), (UI.appareilsPush > 0) ? libelleTelephonesLies(UI.appareilsPush) : trad('Application Android KALEA'), UI.appareilsPush > 0, trad('Actif'), trad('À installer'), 'data-tel-statut', 'data-tel-sous="' + esc(trad('Application Android KALEA')) + '"')}
          ${canal('mail', trad('E-mail'), trad('Avant chaque échéance'), parEmail, trad('Actif'), trad('Inactif'))}
          ${pushDisponible()
            ? canal('cloche', trad('Notification push'), trad('Ciblage par droit d\'accès'), parPush, trad('Actif'), trad('Inactif'))
            : canal('cloche', trad('Notification push'), trad('Reçues sur l\'application Android'), !!(UI.company && UI.company.reminders_push), trad('Actif'), trad('Inactif'))}
        </div>
        <p class="ui-aide">${parEmail ? trad('E-mail actif : le serveur envoie le rappel avant chaque échéance, même application fermée.') : trad('Aucun e-mail ne partira tant que l\'adresse et la case ne sont pas réglées dans Rappels.')}</p>
      </div>
    </section>`;
}

function wireReminderSwitches(root) {
  root.querySelectorAll('[data-reminder]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.reminder;
      UI.reminders[key] = !UI.reminders[key];
      saveReminders(UI.reminders);
      btn.classList.toggle('on', UI.reminders[key]);
      btn.setAttribute('aria-checked', UI.reminders[key] ? 'true' : 'false');
    });
  });
}

// ★ LOT 4 — LA LIGNE COMPACTE. La maquette met le NOM DE LA MACHINE d'abord, la
// tâche ensuite, et l'état dans une pastille à droite : on balaie la liste par
// machine, pas par tâche. La pastille porte l'état ET le délai écrits par le
// produit (`info.short` : « +2 h », « dans 12 j ») — aucun taux, aucune
// projection. Sa teinte vient des voiles de la charte, et son TEXTE reste à
// l'encre (ambre et indigo sur voile clair : 2,61 et 3,70, donc jamais la
// teinte elle-même en texte).
// ★ LOT 6 — `depliable` AJOUTE LE DÉPLI, SUR LE SEUL TABLEAU DE BORD.
// L'Agenda garde exactement la ligne qu'il avait : même fonction, même rendu,
// même clic. Ici, la ligne s'ouvre SUR PLACE et montre l'échéance complète, la
// pastille d'état et « Marquer fait » — sans quitter le tableau de bord.
// Le déclencheur reste UN SEUL bouton (le corps déplié est son frère) : rien de
// ce qu'on touche n'est imbriqué dans autre chose.
function alertRowHtml(machine, info, depliable) {
  const pastille = { alert: 'late', soon: 'soon', ok: 'ok', neutral: 'neutral' }[badgeClass(info.state)] || 'neutral';
  // Le compteur relevé reste sur la ligne, entre parenthèses, à la place où la
  // maquette écrit son échéance (« Kubota U17-3 (250 h) ») : c'est la valeur qui
  // dit où en est la machine, et elle n'apparaît que si elle existe.
  const compteur = machineCounter(machine) != null
    ? formatCounter(machineCounter(machine), counterUnitOf(machine))
    : '';
  const ouvert = !!(depliable && UI.alerteOuverte === machine.id);
  const marqueur = depliable
    ? `<span class="alert-plus" aria-hidden="true">${ouvert ? '−' : '+'}</span>`
    : '';
  const ligne = `
    <button type="button" class="alert-row" data-machine="${esc(machine.id)}"${depliable ? ` data-alerte="${esc(machine.id)}" aria-expanded="${ouvert ? 'true' : 'false'}"` : ''}>
      <span class="alert-bar ${info.state}"></span>
      <span class="alert-main">
        <span class="alert-tete">
          <span class="alert-title">${esc(machine.name)}${compteur ? ` (${esc(compteur)})` : ''}</span>
          <span class="alert-etat ${pastille}">${esc(badgeLabel(info.state))}</span>
        </span>
        <span class="alert-sub">${esc(nextTaskLabel(machine))}</span>
      </span>
      <span class="pill ${pastille}">${esc(info.short)}</span>
      ${marqueur}
    </button>`;
  if (!ouvert) return ligne;
  // ★ LOT 8 — L'ÉTAT ET LE DÉLAI SUR UNE SEULE PASTILLE, comme la maquette
  // (« En retard +3 j »). Le dépli change de NOM DE CLASSE et non d'attribut :
  // `data-alerte-detail` n'était lu par PERSONNE — un repère qui ne sert à rien
  // finit par tromper celui qui le lit.
  // L'échéance COMPLÈTE est celle que le produit écrit déjà (`info.label` :
  // « En retard de 18 h (compteur 268 h · échéance 250 h) ») : aucune phrase
  // nouvelle, aucune donnée nouvelle.
  return ligne + `
    <div class="alert-detail alert-detail-${esc(machine.id)}">
      <span class="alert-detail-titre">${esc(nextTaskLabel(machine))}</span>
      <span class="alert-detail-ligne">${esc(info.label)}</span>
      <span class="alert-detail-pastille ${badgeClass(info.state)}">${esc(badgeLabel(info.state))}<span class="detail-delai">${esc(info.short)}</span></span>
      <button type="button" class="btn-tint" data-alerte-fait="${esc(machine.id)}" data-alerte-tache="${esc(nextTaskLabel(machine))}">${trad('Marquer fait')}</button>
    </div>`;
}

function wireAlertRows(root) {
  // La ligne DÉPLIABLE du tableau de bord a son propre écouteur, posé par
  // `monterAlertes` : elle ne doit pas, en plus, ouvrir le plan. Elle est donc
  // écartée ici — l'Agenda garde le comportement d'origine, inchangé.
  root.querySelectorAll('[data-machine]:not([data-alerte])').forEach(row => {
    row.addEventListener('click', () => {
      const machine = UI.machines.find(m => m.id === row.dataset.machine);
      if (machine) openPlanView(machine, UI.companyId, UI.categories);
    });
  });
}

// ★ LOT 6 — L'ÉCOUTEUR DU DÉPLI, POSÉ SUR LA ZONE, PAS SUR LA LIGNE.
// Le dépli se referme sur un rendu : un écouteur posé sur la ligne
// disparaîtrait avec elle — c'est exactement le défaut déjà vu sur la carte
// « Équipe » (equipe-zones.patch), et la même réponse s'applique.
function monterAlertes(root) {
  const zone = root.querySelector('#echeances-zone');
  if (!zone) return;
  zone.querySelectorAll('[data-alerte]').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.alerte;
      UI.alerteOuverte = UI.alerteOuverte === id ? null : id;
      renderApp();
    });
  });
  // ★ LOT 8 — « MARQUER FAIT », DANS UNE LIGNE DÉPLIÉE, EST ÉCOUTÉ ICI.
  // Il portait les attributs `data-priority-done` / `data-priority-tache`,
  // écoutés par le câblage de la CARTE PRIORITAIRE — dont le repli par défaut est
  // `openLogInterventionModal()` : la fenêtre de saisie, pas un dépli. Les deux
  // attributs n'étaient donc pas inertes du tout, et un clic sur « Marquer fait »
  // ouvrait la fenêtre par un chemin que personne n'avait prévu (le défaut ④ :
  // « les blocs renvoient toujours vers l'autre page au lieu de déplier »). Le
  // geste a maintenant SON nom, et son écouteur : le bouton n'existe que dans une
  // ligne dépliée, et OUVRE LA SAISIE — c'est le geste utile, tâche pré-cochée.
  // Aucun autre clic de ces blocs ne change d'écran.
  zone.querySelectorAll('[data-alerte-fait]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const machine = UI.machines.find(m => m.id === btn.dataset.alerteFait);
      if (machine) openLogInterventionModal(machine, btn.dataset.alerteTache || null);
    });
  });
}
