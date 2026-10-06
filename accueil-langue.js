/* KALEA — page d'accueil : traduction française / anglaise.
 *
 * Le HTML de la page reste en français (c'est la version indexée et celle des
 * visiteurs sans JavaScript). Ce script remplace les textes par leur version
 * anglaise quand l'anglais est choisi, et sait revenir au français sans
 * recharger la page.
 *
 * Langue : la même clé de stockage que l'application (parcpacific.langue), donc
 * le choix fait sur la page d'accueil suit le visiteur jusque dans l'appli, et
 * inversement. Sans choix enregistré, on prend la langue du navigateur.
 *
 * Partagé par index.html et decouvrir.html (deux copies identiques de la page).
 * Le texte français sert de clé : une phrase modifiée dans le HTML sans être
 * modifiée ici reste simplement en français (jamais de texte cassé).
 */
(function () {
  'use strict';

  var CLE = 'parcpacific.langue';

  var TEXTES = [
    // Navigation
    [`Fonctionnalités`, `Features`],
    [`Comment ça marche`, `How it works`],
    [`Vos données`, `Your data`],
    [`Tarifs`, `Pricing`],
    [`FAQ`, `FAQ`],
    [`Se connecter`, `Log in`],
    [`Essai gratuit`, `Free trial`],

    // En-tête
    [`LECTURE AUTOMATIQUE DES MANUELS — DISPONIBLE`, `AUTOMATIC MANUAL READING — AVAILABLE`],
    [`LA JUSTE MESURE DE VOTRE PARC`, `THE RIGHT MEASURE OF YOUR FLEET`],
    [`Fini la saisie : vos manuels constructeur`, `No more data entry: your manufacturer manuals`],
    [`génèrent automatiquement vos plans de maintenance`, `automatically generate your maintenance plans`],
    [`Importez vos manuels constructeur : KALEA en extrait les échéances et construit le plan de maintenance. Suivi par calendrier, heures ou kilomètres — puis la liste des pièces prête à envoyer à vos fournisseurs.`, `Import your manufacturer manuals: KALEA extracts the service intervals and builds the maintenance plan. Tracking by calendar, hours or kilometres — then the parts list, ready to send to your suppliers.`],
    [`Commencer gratuitement`, `Start for free`],
    [`Voir comment ça marche`, `See how it works`],
    [`€/mois`, `/month`],
    [`Live`, `Live`],
    [`Survoler pour zoomer`, `Hover to zoom`],
    [`Vue d'ensemble en temps réel`, `Real-time overview`],
    [`Tableau de bord : alertes d'entretien, pièces consolidées et TCO`, `Dashboard: maintenance alerts, consolidated parts and TCO`],

    // Coût d'un mauvais suivi
    [`CE QU'UN MAUVAIS SUIVI COÛTE`, `WHAT POOR TRACKING COSTS`],
    [`Un entretien en retard ne se rattrape pas toujours`, `Overdue maintenance can't always be made up`],
    [`Rien de théorique : c'est ce qui arrive quand les échéances ne sont suivies nulle part.`, `Nothing theoretical: this is what happens when service intervals aren't tracked anywhere.`],
    [`Des réparations plus coûteuses`, `More expensive repairs`],
    [`Une échéance manquée use la pièce avant l'heure : ce qui relevait de l'entretien courant devient une réparation, parfois une pièce à remplacer.`, `A missed service wears the part out early: what was routine maintenance becomes a repair, sometimes a part to replace.`],
    [`Des pannes évitables`, `Avoidable breakdowns`],
    [`Les défaillances que l'entretien prévient ne choisissent pas leur moment : elles tombent souvent quand la machine sert le plus.`, `The failures that maintenance prevents don't pick their moment: they often strike when the machine is working hardest.`],
    [`Des immobilisations`, `Downtime`],
    [`Un engin arrêté, c'est du travail qui attend, un chantier décalé, ou une location à payer à la place.`, `A machine that is stopped means work waiting, a delayed site, or a rental to pay for instead.`],
    [`À l'inverse, un parc suivi régulièrement tient plus longtemps : ce qui est déjà investi travaille plus d'années.`, `Conversely, a regularly maintained fleet lasts longer: what you've already invested keeps working for more years.`],

    // Fonctionnalités
    [`FONCTIONNALITÉS & INTERFACES`, `FEATURES & INTERFACES`],
    [`Trois gestes, et le suivi se tient tout seul`, `Three steps, and tracking runs itself`],
    [`Rien à paramétrer pendant des heures : le manuel fait le travail, vous validez. Découvrez les modules clés en action.`, `Nothing to configure for hours: the manual does the work, you validate. Discover the key modules in action.`],
    [`Extraction automatique depuis vos manuels PDF`, `Automatic extraction from your PDF manuals`],
    [`Déposez le PDF constructeur de votre machine. KALEA extrait immédiatement les intervalles récurrents (heures ou calendrier), les fiches d'entretien et les préconisations sans saisie manuelle.`, `Drop in your machine's manufacturer PDF. KALEA immediately extracts the recurring intervals (hours or calendar), the service sheets and the recommendations, with no manual entry.`],
    [`OCR & algorithme`, `OCR & algorithm`],
    [`Échéances heures & mois`, `Hour & month intervals`],
    [`Plans validés en 1 clic`, `Plans validated in 1 click`],
    [`PDF OCR`, `PDF OCR`],
    [`Zoom`, `Zoom`],
    [`Suivi Précis`, `Precise tracking`],
    [`Double suivi intelligent (Compteur horaire + Calendrier)`, `Smart dual tracking (hour meter + calendar)`],
    [`Chaque machine possède son propre cycle. La première échéance atteinte (horaire ou date calendaire) déclenche l'alerte proactive et prépare la check-list d'intervention.`, `Each machine has its own cycle. The first interval reached (hours or calendar date) triggers the proactive alert and prepares the service checklist.`],
    [`Anticipation des retards`, `Delay anticipation`],
    [`Scorecard TCO`, `TCO scorecard`],
    [`Relevé en 1 clic`, `Reading in 1 click`],
    [`Agenda & Pièces`, `Schedule & Parts`],
    [`Planning & Commandes`, `Planning & Orders`],
    [`Consolidation automatique de toutes les pièces et filtres à commander sur 30, 90 ou 180 jours.`, `Automatic consolidation of all the parts and filters to order over 30, 90 or 180 days.`],
    [`Coûts & TCO`, `Costs & TCO`],
    [`Maîtrise du TCO Réel`, `Real TCO under control`],
    [`Barèmes d'atelier, coût horaire par machine, amortissement et alertes de seuil de rentabilité.`, `Workshop rates, hourly cost per machine, depreciation and break-even threshold alerts.`],
    [`Stocks & SAV`, `Stock & Service`],
    [`Stocks & Kits d'entretien`, `Stock & Maintenance Kits`],
    [`Valorisation PUMP, mouvements magasins, alertes de rupture et kits d'entretien packagés.`, `WAC valuation, warehouse movements, stock-out alerts and packaged maintenance kits.`],

    // Comment ça marche
    [`COMMENT ÇA MARCHE`, `HOW IT WORKS`],
    [`Du PDF au carnet d'entretien, en trois étapes`, `From PDF to maintenance logbook, in three steps`],
    [`Aucun paramétrage interminable : vous importez, vous validez, vous suivez.`, `No endless setup: you import, you validate, you track.`],
    [`Importez le manuel`, `Import the manual`],
    [`Déposez le PDF constructeur de la machine. Une photo de la plaque ou du carnet suffit à retrouver le bon document, et le modèle comme l'année peuvent être précisés.`, `Drop in the machine's manufacturer PDF. A photo of the plate or the logbook is enough to find the right document, and the model and year can be specified.`],
    [`Validez le plan proposé`, `Validate the proposed plan`],
    [`KALEA en tire les tâches, les échéances et l'unité de suivi (heures, kilomètres ou mois), premier entretien compris. Vous relisez, vous corrigez si besoin, puis vous confirmez.`, `KALEA derives the tasks, the intervals and the tracking unit (hours, kilometres or months), first service included. You review, correct if needed, then confirm.`],
    [`Suivez, puis commandez`, `Track, then order`],
    [`Vous relevez le compteur quand vous voulez : le tableau d'échéances se met à jour, les rappels partent avant la date, et la liste de pièces se regroupe par famille.`, `Take a counter reading whenever you like: the schedule updates, reminders go out ahead of the date, and the parts list is grouped by family.`],

    // Vos données
    [`VOS DONNÉES`, `YOUR DATA`],
    [`Quatre engagements, vérifiables dans le produit`, `Four commitments, verifiable in the product`],
    [`Parc cloisonné`, `Ring-fenced fleet`],
    [`Les règles d'accès sont appliquées côté serveur : votre parc n'est lisible que par les comptes de votre société.`, `Access rules are enforced server-side: your fleet can only be read by your company's accounts.`],
    [`Analyse sur votre action`, `Analysis on your action`],
    [`La lecture d'un manuel ne démarre que lorsque vous l'importez, et le document ne sert qu'à construire votre plan de maintenance.`, `Reading a manual only starts when you import it, and the document is only used to build your maintenance plan.`],
    [`Aucun traceur publicitaire`, `No advertising trackers`],
    [`Pas de régie publicitaire, pas de revente. La langue et la session sont les seuls éléments gardés par le navigateur.`, `No ad network, no resale. Language and session are the only things kept by the browser.`],
    [`Emporter et effacer`, `Take it and erase it`],
    [`L'historique s'exporte en CSV, et la suppression du compte emporte les documents associés.`, `The history can be exported as CSV, and deleting the account removes the associated documents.`],
    [`Le détail figure dans la`, `Details are in the`],
    [`politique de confidentialité`, `privacy policy`],

    // Tarifs
    [`Tarifs clairs & sans engagement`, `Clear pricing, no commitment`],
    [`Une offre adaptée à chaque taille`, `A plan for every size`],
    [`Commencez gratuitement, changez d'offre au prorata ou résiliez en un clic sans préavis.`, `Start for free, change plan pro rata or cancel in one click with no notice.`],
    [`Sans carte bancaire`, `No credit card`],
    [`Gratuit`, `Free`],
    [`Découverte`, `Discovery`],
    [`0 €`, `€0`],
    [`/mois à vie`, `/month, for life`],
    [`Idéal pour tester l'application sereinement`, `Ideal for trying the app with peace of mind`],
    [`Capacité de flotte`, `Fleet capacity`],
    [`Inclus`, `Included`],
    [`2 machines`, `2 machines`],
    [`1 utilisateur`, `1 user`],
    [`Fonctionnalités incluses`, `Included features`],
    [`Consultation et gestion du parc`, `Fleet viewing and management`],
    [`Rappels e-mail automatiques`, `Automatic email reminders`],
    [`Notifications d'échéances en direct`, `Live due-date notifications`],
    [`Inclus chaque mois :`, `Included each month:`],
    [`10 analyses carnet · 10 recherches photo · 30 lectures compteur`, `10 manual analyses · 10 photo searches · 30 counter readings`],
    [`Artisan & Indépendant`, `Craftsperson & Self-employed`],
    [`Starter`, `Starter`],
    [`Artisan`, `Craftsperson`],
    [`12 €`, `€12`],
    [`/mois`, `/month`],
    [`Facturation mensuelle sans engagement`, `Monthly billing, no commitment`],
    [`+3 vs Gratuit`, `+3 vs Free`],
    [`5 machines`, `5 machines`],
    [`Tout ce qui est dans Gratuit, plus :`, `Everything in Free, plus:`],
    [`Export CSV des données`, `Data export to CSV`],
    [`Rappels d'échéances personnalisés`, `Custom due-date reminders`],
    [`Historique étendu d'entretien`, `Extended maintenance history`],
    [`20 analyses · 10 photos · 200 lectures`, `20 analyses · 10 photos · 200 readings`],
    [`Choisir Starter`, `Choose Starter`],
    [`Recommandé`, `Recommended`],
    [`PME & Parcs Actifs`, `SMEs & Active Fleets`],
    [`Business`, `Business`],
    [`Flotte`, `Fleet`],
    [`39 €`, `€39`],
    [`Pour équipes et parcs actifs en pleine croissance`, `For teams and active, fast-growing fleets`],
    [`Jusqu'à 20 engins`, `Up to 20 machines`],
    [`20 machines`, `20 machines`],
    [`3 utilisateurs`, `3 users`],
    [`Tout ce qui est dans Starter, plus :`, `Everything in Starter, plus:`],
    [`Multi-utilisateurs (3 accès inclus)`, `Multi-user (3 seats included)`],
    [`QR codes équipements & chantiers`, `Equipment & site QR codes`],
    [`Préparation groupée d'atelier`, `Grouped workshop preparation`],
    [`Module Coûts & TCO complet`, `Full Costs & TCO module`],
    [`30 analyses · 30 photos · 500 lectures`, `30 analyses · 30 photos · 500 readings`],
    [`Choisir l'offre Business`, `Choose the Business plan`],
    [`Grands Parcs & BTP`, `Large Fleets & Construction`],
    [`Enterprise`, `Enterprise`],
    [`Grand Compte`, `Key Account`],
    [`Tableau comparatif`, `Comparison table`],
    [`Toutes les caractéristiques et fonctionnalités détaillées selon votre palier d'activité, sans coûts cachés.`, `All the features and capabilities, detailed by activity tier, with no hidden costs.`],
    [`Prix toutes taxes comprises • Facturation mensuelle sans engagement`, `Prices include all taxes • Monthly billing, no commitment`],
    [`Imprimer le comparatif`, `Print the comparison`],
    [`Télécharger la fiche (.PDF)`, `Download the sheet (.PDF)`],
    [`Architecture d'offre`, `Plan architecture`],
    [`Capacités & Services`, `Capacities & Services`],
    [`Pour débuter`, `To get started`],
    [`Artisans & PME`, `Craftspeople & SMEs`],
    [`Flotte / Recommandé`, `Fleet / Recommended`],
    [`Gestion active de parc`, `Active fleet management`],
    [`Flottes industrielles`, `Industrial fleets`],
    [`Sur devis`, `On quote`],
    [`Multi-sites & Groupes`, `Multi-site & Groups`],
    [`Capacité & Dimensionnement`, `Capacity & Sizing`],
    [`+ 2 €`, `+ €2`],
    [`(jusqu'à 10)`, `(up to 10)`],
    [`+ 1,50 €`, `+ €1.50`],
    [`(jusqu'à 40)`, `(up to 40)`],
    [`+ 1 €`, `+ €1`],
    [`(jusqu'à 150)`, `(up to 150)`],
    [`Pilotage, Alertes & Intelligence Matériel`, `Monitoring, Alerts & Equipment Intelligence`],
    [`Traitement de Documents & Capteurs`, `Document & Sensor Processing`],
    [`Action immédiate`, `Get started`],
    [`Commencer`, `Start`],
    [`Choisir Business`, `Choose Business`],
    [`Besoin d'un accompagnement pour choisir votre classe ?`, `Need help choosing your plan?`],
    [`Nous évaluons avec vous votre parc et votre rythme de maintenance, sans engagement.`, `We assess your fleet and maintenance rhythm with you, with no commitment.`],
    [`Demander un conseil`, `Ask for advice`],
    [`Ce que chaque classe apporte`, `What each plan brings`],
    [`Fonctionnalité`, `Feature`],
    [`Grand compte`, `Key account`],
    [`Prix par mois`, `Price per month`],
    [`79 €`, `€79`],
    [`sur devis`, `on quote`],
    [`Machines incluses`, `Machines included`],
    [`plus de 150`, `over 150`],
    [`Machines en plus`, `Extra machines`],
    [`+ 2 € (jusqu'à 10)`, `+ €2 (up to 10)`],
    [`+ 1,50 € (jusqu'à 40)`, `+ €1.50 (up to 40)`],
    [`+ 1 € (jusqu'à 150)`, `+ €1 (up to 150)`],
    [`tarif dégressif`, `sliding-scale rate`],
    [`Utilisateurs`, `Users`],
    [`rôles d'équipe`, `team roles`],
    [`sur mesure`, `custom`],
    [`Consultation, rappels e-mail et notifications`, `Viewing, e-mail reminders and notifications`],
    [`Export CSV`, `CSV export`],
    [`QR codes, préparation groupée, Coûts & TCO`, `QR codes, grouped preparation, Costs & TCO`],
    [`Stocks & SAV, support dédié`, `Stock & Service, dedicated support`],
    [`Télémétrie (connexion et suivi)`, `Telemetry (connection and tracking)`],
    [`Intégrations sur mesure, accompagnement, contrat annuel`, `Custom integrations, onboarding support, annual contract`],
    [`Analyses de carnet par mois`, `Manual analyses per month`],
    [`Lectures de compteur par mois`, `Counter readings per month`],
    [`Au-delà de 150 machines : tarif dégressif, intégrations sur mesure, accompagnement et contrat annuel. Nous établissons un devis adapté à votre parc.`, `Beyond 150 machines: sliding-scale rate, custom integrations, onboarding support and an annual contract. We draw up a quote suited to your fleet.`],
    [`Demander un devis`, `Request a quote`],
    [`Parc`, `Fleet`],
    [`+ 2 € / machine au-delà de 5, jusqu'à 10`, `+ €2 / machine beyond 5, up to 10`],
    [`+ 1,50 € / machine au-delà de 20, jusqu'à 40`, `+ €1.50 / machine beyond 20, up to 40`],
    [`+ 1 € / machine au-delà de 40, jusqu'à 150`, `+ €1 / machine beyond 40, up to 150`],
    [`Jusqu'à 40 engins`, `Up to 40 machines`],
    [`Jusqu'à 150 engins`, `Up to 150 machines`],
    [`40 machines`, `40 machines`],
    [`Télémétrie : connexion et suivi (matériel en sus)`, `Telemetry: connection and tracking (hardware extra)`],
    [`10 analyses carnet · 30 lectures compteur`, `10 manual analyses · 30 counter readings`],
    [`20 analyses carnet · 200 lectures compteur`, `20 manual analyses · 200 counter readings`],
    [`30 analyses carnet · 500 lectures compteur`, `30 manual analyses · 500 counter readings`],
    [`5 000 analyses carnet · 2 000 lectures compteur`, `5,000 manual analyses · 2,000 counter readings`],
    [`Gratuit pour 2 machines · Starter 12 €/mois · Business 39 €/mois · Entreprise 79`, `Free for 2 machines · Starter €12/month · Business €39/month · Enterprise €79`],
    [`Sur-mesure`, `Tailor-made`],
    [`Parc sur mesure`, `Tailor-made fleet`],
    [`Tout ce qui est dans Business, plus :`, `Everything in Business, plus:`],
    [`Support dédié prioritaire`, `Dedicated priority support`],
    [`Module Stocks & SAV`, `Stock & Service module`],
    [`Magasins, mouvements de pièces, kits d'entretien`, `Warehouses, parts movements, maintenance kits`],
    [`5 000 analyses · 5 000 photos · 2 000 lectures`, `5,000 analyses · 5,000 photos · 2,000 readings`],
    [`Contacter l'équipe`, `Contact the team`],
    [`Établissement de ton plan d'entretien`, `We set up your maintenance plan`],
    [`29 € l'acte`, `€29 per plan`],
    [`Tu n'as pas le temps ou tu ne trouves pas le carnet constructeur ? Envoie-nous la photo de la plaque constructeur : nous recherchons et configurons votre plan complet dans l'application.`, `No time, or can't find the manufacturer's manual? Send us a photo of the manufacturer's plate: we research and configure your complete plan in the app.`],
    [`Demander un plan`, `Request a plan`],
    [`Paiement sécurisé par Stancer`, `Secure payment by Stancer`],
    [`Résiliable à tout moment en 1 clic`, `Cancel any time in 1 click`],
    [`Lectures de compteur`, `Counter readings`],
    [`Changement d'offre au prorata`, `Pro-rata plan changes`],

    // FAQ
    [`QUESTIONS FRÉQUENTES`, `FREQUENTLY ASKED QUESTIONS`],
    [`Ce qu'on nous demande le plus`, `What we're asked most`],
    [`Qu'est-ce qui compte comme une machine ?`, `What counts as a machine?`],
    [`Chaque engin motorisé, équipement de chantier, véhicule utilitaire ou machine d'atelier disposant de son propre carnet ou compteur représente 1 unité. Les accessoires non motorisés sans échéance propre sont inclus sans supplément.`, `Each motorised machine, site equipment, utility vehicle or workshop machine with its own logbook or counter counts as 1 unit. Non-motorised accessories with no service interval of their own are included at no extra charge.`],
    [`Puis-je changer d'offre à tout moment ?`, `Can I change plan at any time?`],
    [`Oui, tout se fait en un clic depuis les paramètres de votre compte. Le montant est immédiatement ajusté au prorata des jours restants, et aucune donnée n'est perdue.`, `Yes, it's all done in one click from your account settings. The amount is adjusted immediately pro rata for the remaining days, and no data is lost.`],
    [`Mes données et mes manuels sont-ils en sécurité ?`, `Are my data and manuals safe?`],
    [`Vos documents sont chiffrés et strictement cantonnés à votre organisation. KALEA ne revend aucune donnée et n'utilise pas vos manuels pour réentraîner des modèles publics.`, `Your documents are encrypted and strictly confined to your organisation. KALEA does not resell any data and does not use your manuals to retrain public models.`],
    [`Est-ce utilisable sur le terrain, sans réseau ?`, `Can it be used in the field, with no network?`],
    [`L'application web est responsive et progressive (PWA). Les saisies de compteur effectuées en zone blanche sont synchronisées dès le retour d'une connexion réseau.`, `The web app is responsive and progressive (PWA). Counter readings entered in a dead zone are synchronised as soon as a network connection returns.`],
    [`Faut-il forcément un manuel au format PDF ?`, `Does it have to be a PDF manual?`],
    [`Non. Une simple photo nette des tableaux d'entretien de votre carnet papier, ou la plaque de série de la machine suffit. Notre outil identifie le guide adéquat.`, `No. A clear photo of the maintenance tables in your paper logbook, or the machine's serial plate, is enough. Our tool identifies the right guide.`],
    [`Les rappels partent-ils aussi par WhatsApp ?`, `Are reminders also sent by WhatsApp?`],
    [`Les alertes sont envoyées en priorité par e-mail et notifications in-app. L'intégration SMS et WhatsApp est disponible sur les offres Business et Enterprise.`, `Alerts are sent primarily by email and in-app notifications. SMS and WhatsApp integration is available on the Business and Enterprise plans.`],
    [`Peut-on relier des boîtiers de télémétrie ?`, `Can telemetry trackers be connected?`],
    [`Oui, en option sur l'offre Enterprise : un boîtier compatible (ou un système tiers) envoie les heures ou les kilomètres de vos machines, et le compteur, les échéances et les rappels se mettent à jour tout seuls. Votre abonnement KALEA donne la connexion et le suivi ; le matériel et son installation (boîtiers, cartes SIM, pose) restent à votre charge, ou font l'objet d'un devis de KALEA. Sans boîtier, KALEA fonctionne exactement pareil avec vos relevés manuels ou photo.`, `Yes, as an option on the Enterprise plan: a compatible tracker (or a third-party system) sends your machines' hours or kilometres, and the counter, due dates and reminders update on their own. Your KALEA subscription provides the connection and the tracking; the hardware and its installation (trackers, SIM cards, fitting) remain your responsibility, or are quoted by KALEA. Without a tracker, KALEA works exactly the same with your manual or photo readings.`],

    // Appel final et pied de page
    [`DÉMARRAGE IMMÉDIAT`, `GET STARTED NOW`],
    [`Le juste suivi de votre parc commence aujourd'hui`, `The right tracking for your fleet starts today`],
    [`Un compte, un manuel, et vous saurez si KALEA tient la route sur vos machines. Gratuit pour deux machines, 12 €/mois jusqu'à cinq.`, `One account, one manual, and you'll know whether KALEA holds up on your machines. Free for two machines, €12/month up to five.`],
    [`Poser une question`, `Ask a question`],
    [`Suivi d'entretien des engins et véhicules : plans issus des manuels constructeur, échéances au calendrier ou au compteur, rappels et liste de pièces.`, `Maintenance tracking for machines and vehicles: plans built from manufacturer manuals, calendar- or counter-based due dates, reminders and parts list.`],
    [`Édité par Matthieu COURTOIS, entrepreneur individuel — Nouvelle-Calédonie.`, `Published by Matthieu COURTOIS, sole trader — New Caledonia.`],
    [`PRODUIT`, `PRODUCT`],
    [`Tarification`, `Pricing`],
    [`LÉGAL`, `LEGAL`],
    [`Mentions légales`, `Legal notice`],
    [`CGU`, `Terms`],
    [`Confidentialité`, `Privacy`],
    [`Suppression du compte`, `Account deletion`],
    [`Supprimer mes données`, `Delete my data`],
    [`CONTACT`, `CONTACT`],
    [`Une question, un manuel qui résiste ? Écrivez-nous.`, `A question, a manual that won't cooperate? Write to us.`],
    [`KALEA. Tous droits réservés.`, `KALEA. All rights reserved.`],
    [`Politique de confidentialité`, `Privacy policy`],
    [`Conditions générales`, `Terms and conditions`]
  ];

  // Attributs lus par les lecteurs d'écran : même principe, mêmes règles.
  var ATTRIBUTS = [
    [`Accueil KALEA`, `KALEA home`],
    [`Tableau de bord KALEA`, `KALEA dashboard`],
    [`Engrenage industriel usé nécessitant réparation`, `Worn industrial gear needing repair`],
    [`Pelleteuse de chantier en panne examinée par un mécanicien`, `Broken-down excavator being examined by a mechanic`],
    [`Machine de chantier à l'arrêt sur un chantier lot en attente de pièces`, `Site machine standing idle on a job site, waiting for parts`],
    [`Plans d'entretien et PDF KALEA`, `KALEA maintenance plans and PDF`],
    [`Fiche machine et double intervalle KALEA`, `KALEA machine sheet and dual interval`],
    [`Agenda et planning pièces KALEA`, `KALEA schedule and parts planning`],
    [`Coûts d'exploitation et TCO KALEA`, `KALEA operating costs and TCO`],
    [`Gestion des stocks et pièces détachées KALEA`, `KALEA stock and spare parts management`],
    [`Technicienne prenant en photo la plaque constructeur et le manuel d'un engin`, `Technician photographing a machine's manufacturer plate and manual`],
    [`Validation et contrôle d'un plan de maintenance numérique sur tablette`, `Validating and checking a digital maintenance plan on a tablet`],
    [`Contrôle du compteur d'heures et préparation des pièces de rechange`, `Checking the hour meter and preparing spare parts`]
  ];

  var TITRE = { fr: null, en: `KALEA — Fleet maintenance tracking` };

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function table(paires) {
    var t = Object.create(null);
    paires.forEach(function (p) { t[norm(p[0])] = p[1]; });
    return t;
  }
  var EN_TEXTES = table(TEXTES);
  var EN_ATTRIBUTS = table(ATTRIBUTS);
  var NOMS_ATTRIBUTS = ['alt', 'title', 'aria-label', 'placeholder'];

  // Originaux français, pour pouvoir revenir sans recharger.
  var originauxTexte = new WeakMap();
  var originauxAttr = new WeakMap();
  var originauxHref = new WeakMap();
  var OBJETS_MAIL = {
    'Demande%20Offre%20Enterprise': 'Enterprise%20plan%20request',
    'Demande%20Etablissement%20Plan%2029E': 'Maintenance%20plan%20set-up%20request%20(EUR%2029)'
  };
  var titreFrancais = document.title;

  function langueInitiale() {
    try {
      var choisie = localStorage.getItem(CLE);
      if (choisie === 'fr' || choisie === 'en') return choisie;
    } catch (err) { /* stockage indisponible */ }
    return (navigator.language || '').slice(0, 2).toLowerCase() === 'en' ? 'en' : 'fr';
  }

  function noeudsTexte() {
    var liste = [];
    var marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var noeud;
    while ((noeud = marcheur.nextNode())) {
      var parent = noeud.parentElement;
      if (!parent || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) continue;
      if (parent.closest('[data-sans-traduction]')) continue;
      liste.push(noeud);
    }
    return liste;
  }

  function appliquer(langue) {
    var en = langue === 'en';

    noeudsTexte().forEach(function (noeud) {
      if (!originauxTexte.has(noeud)) {
        var cle = norm(noeud.nodeValue);
        if (!cle || !(cle in EN_TEXTES)) return;
        originauxTexte.set(noeud, noeud.nodeValue);
      }
      var original = originauxTexte.get(noeud);
      if (!en) { noeud.nodeValue = original; return; }
      var traduit = EN_TEXTES[norm(original)];
      if (traduit === undefined) return;
      // On garde les espaces d'origine autour du texte (retours à la ligne du HTML).
      var debut = original.match(/^\s*/)[0];
      var fin = original.match(/\s*$/)[0];
      noeud.nodeValue = debut + traduit + fin;
    });

    document.querySelectorAll('[alt],[title],[aria-label],[placeholder]').forEach(function (el) {
      NOMS_ATTRIBUTS.forEach(function (nom) {
        if (!el.hasAttribute(nom)) return;
        var memo = originauxAttr.get(el) || {};
        if (!(nom in memo)) {
          if (!(norm(el.getAttribute(nom)) in EN_ATTRIBUTS)) return;
          memo[nom] = el.getAttribute(nom);
          originauxAttr.set(el, memo);
        }
        el.setAttribute(nom, en ? EN_ATTRIBUTS[norm(memo[nom])] : memo[nom]);
      });
    });

    // Objet pré-rempli des liens « écrire à… » : il suit la langue de la page.
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      var memo = originauxHref.get(a) || a.getAttribute('href');
      originauxHref.set(a, memo);
      var objet = memo.split('?subject=')[1];
      var traduit = objet && OBJETS_MAIL[objet];
      a.setAttribute('href', en && traduit ? memo.split('?subject=')[0] + '?subject=' + traduit : memo);
    });

    document.title = en ? TITRE.en : titreFrancais;
    document.documentElement.lang = langue;
    // Ne PAS toucher à l'attribut data-lang : l'ancien CSS de la page (règles
    // html[data-lang="en"] .lang-fr) masquerait tous les textes français que ce
    // script vient justement de traduire sur place.
    boutons.forEach(function (b) {
      var actif = b.getAttribute('data-langue') === langue;
      b.setAttribute('aria-pressed', actif ? 'true' : 'false');
      b.className = 'text-[11px] sm:text-xs font-bold px-1.5 sm:px-2 py-1 rounded-md transition-colors ' +
        (actif ? 'bg-brand-ink text-white' : 'text-slate-600 hover:text-brand-primary');
    });
  }

  var boutons = [];

  function creerSelecteur() {
    // Placé juste avant « Se connecter », dans le bloc d'actions de l'en-tête.
    var connexion = document.querySelector('header a[href="./app.html"]');
    if (!connexion || !connexion.parentElement) return;
    var groupe = document.createElement('div');
    groupe.setAttribute('role', 'group');
    groupe.setAttribute('aria-label', 'Langue / Language');
    groupe.setAttribute('data-sans-traduction', '');
    groupe.className = 'flex items-center gap-0.5 sm:gap-1 rounded-lg border border-slate-200 bg-white p-0.5 ml-2 shrink-0';
    [['fr', 'FR', 'Français'], ['en', 'EN', 'English']].forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-langue', l[0]);
      b.setAttribute('lang', l[0]);
      b.setAttribute('title', l[2]);
      b.textContent = l[1];
      b.addEventListener('click', function () {
        try { localStorage.setItem(CLE, l[0]); } catch (err) { /* sans conséquence */ }
        appliquer(l[0]);
      });
      groupe.appendChild(b);
      boutons.push(b);
    });
    connexion.parentElement.insertBefore(groupe, connexion);
  }

  function demarrer() {
    creerSelecteur();
    appliquer(langueInitiale());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
