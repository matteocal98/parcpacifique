// Pages de contenu du site public (référencement) : une page par sujet de recherche, en français ET en anglais.
// Les faits (offres, capacités, fonctions) sont ceux de la page d'accueil : à tenir d'accord avec elle.
// Dans les textes : {{lien:ID}} devient l'adresse de la page ID dans la langue de la page ; {{accueil}} la page d'accueil ;
// {{essai}} le lien d'inscription. Mise en page : outils/generer-pages-publiques.mjs.

export const PAGES = [
  // ───────────────────────────────────────────────────────── 1. GMAO
  {
    id: 'gmao',
    fr: {
      fichier: 'logiciel-gmao-parc-engins.html',
      titre: 'Logiciel GMAO pour parc d\'engins et de machines | KALEA',
      description: 'GMAO simple pour engins, véhicules et machines : plans d\'entretien tirés des manuels, rappels, QR codes, stocks de pièces et coûts. Gratuit pour 2 machines.',
      fil: 'Logiciel GMAO',
      h1: 'Un logiciel GMAO simple pour votre parc d\'engins, de véhicules et de machines',
      intro: 'Une GMAO (gestion de la maintenance assistée par ordinateur) sert à savoir <strong>quelle machine doit être entretenue, quand, par qui, avec quelles pièces et pour quel coût</strong>. Beaucoup de solutions sont pensées pour de grandes usines. KALEA est conçue pour les entreprises qui ont <strong>de quelques machines à quelques dizaines</strong> : travaux publics, espaces verts, transport, location, collectivités.',
      sections: [
        { h2: 'Ce que fait KALEA, concrètement', liste: [
          '<strong>Plans d\'entretien depuis les manuels</strong> : vous déposez le PDF constructeur, KALEA en tire les tâches et les échéances. Voir <a href="{{lien:plan}}">le plan d\'entretien automatique</a>.',
          '<strong>Suivi à l\'heure, au kilomètre ou au calendrier</strong> : la première échéance atteinte déclenche l\'alerte. Voir <a href="{{lien:suivi}}">le suivi des engins de chantier</a>.',
          '<strong>Rappels avant l\'échéance</strong> par e-mail et notifications sur téléphone, pour le gérant comme pour le mécanicien.',
          '<strong>Agenda et interventions</strong> : planning des entretiens, checklist de ce qui est fait, historique de chaque machine.',
          '<strong>Pièces et stock</strong> : liste des pièces à commander regroupée par famille, kits d\'entretien, alertes de rupture (module Stocks &amp; SAV).',
          '<strong>Coûts et TCO</strong> : coût horaire par machine, amortissement, seuils de rentabilité.',
          '<strong>QR codes</strong> collés sur les machines : un scan ouvre la fiche de l\'engin sur le téléphone.',
          '<strong>Compteurs automatiques</strong> (télémétrie) pour mettre à jour les heures et les kilomètres sans saisie.',
        ] },
        { h2: 'Pour qui ?', paras: [
          'Pour les entreprises de travaux, les paysagistes, les loueurs de matériel, les transporteurs et les collectivités qui gèrent un parc d\'engins et de véhicules <strong>sans service maintenance dédié</strong>, ou avec un seul responsable d\'atelier. L\'application fonctionne sur ordinateur et sur téléphone, avec une application Android.',
        ] },
        { h2: 'Une GMAO pensée pour démarrer vite', paras: [
          'Pas de paramétrage interminable : <strong>vous importez le manuel, vous relisez le plan proposé, vous validez</strong>. Le plan reste modifiable ; chaque tâche peut avoir sa propre échéance. Si vous ne trouvez pas le carnet de votre modèle, nous pouvons établir le plan à votre place (29 € TTC par plan, sur demande).',
        ] },
        { h2: 'Tarifs', paras: [
          'Gratuit pour <strong>2 machines</strong>. Ensuite : <strong>Starter 12 €/mois</strong> (5 machines), <strong>Business 39 €/mois</strong> (20 machines, utilisateurs illimités, QR codes, coûts et TCO), <strong>Enterprise 79 €/mois</strong> (40 machines, Stocks &amp; SAV, télémétrie). Prix mensuels toutes taxes comprises, sans engagement, avec des machines supplémentaires facturées à l\'unité selon l\'offre. Le détail et un simulateur sont sur <a href="{{accueil}}#tarifs">la page Tarifs</a>.',
        ] },
        { h2: 'Conçu et utilisé en Nouvelle-Calédonie', paras: [
          'KALEA est éditée en Nouvelle-Calédonie, avec des parcs réels (engins de chantier, véhicules, outillage motorisé). Les données de votre société ne sont lisibles que par les comptes de votre société, et l\'historique s\'exporte en CSV.',
        ] },
      ],
      faq: [
        { q: 'Qu\'est-ce qu\'une GMAO ?', r: 'Une GMAO est un logiciel de gestion de la maintenance : il centralise les machines, les plans d\'entretien, les échéances, les interventions, les pièces et les coûts, pour éviter les entretiens oubliés et les pannes évitables.' },
        { q: 'KALEA est-elle une vraie GMAO ?', r: 'Oui, pour la maintenance préventive d\'un parc d\'engins, de véhicules et de machines : plans, échéances, rappels, interventions, pièces et coûts. Elle vise la simplicité plutôt que la couverture d\'un site industriel complet.' },
        { q: 'Faut-il installer quelque chose ?', r: 'Non. KALEA fonctionne dans le navigateur, sur ordinateur et sur téléphone, et existe en application Android.' },
        { q: 'Puis-je l\'essayer gratuitement ?', r: 'Oui : l\'offre Gratuit couvre 2 machines, sans carte bancaire.' },
      ],
    },
    en: {
      fichier: 'en/cmms-fleet-maintenance-software.html',
      titre: 'CMMS software for equipment and vehicle fleets | KALEA',
      description: 'Simple CMMS for equipment, vehicles and machines: maintenance plans built from manuals, reminders, QR codes, spare-parts stock and costs. Free for 2 machines.',
      fil: 'CMMS software',
      h1: 'Simple CMMS software for your equipment, vehicle and machine fleet',
      intro: 'A CMMS (computerised maintenance management system) tells you <strong>which machine needs servicing, when, by whom, with which parts and at what cost</strong>. Many tools are designed for large plants. KALEA is built for companies with <strong>a few machines up to a few dozen</strong>: civil works, landscaping, transport, rental, local authorities.',
      sections: [
        { h2: 'What KALEA does, in practice', liste: [
          '<strong>Maintenance plans from the manuals</strong>: upload the manufacturer PDF and KALEA extracts the tasks and intervals. See <a href="{{lien:plan}}">the automatic maintenance plan</a>.',
          '<strong>Tracking by hours, kilometres or calendar</strong>: the first interval reached triggers the alert. See <a href="{{lien:suivi}}">construction equipment tracking</a>.',
          '<strong>Reminders before the due date</strong> by e-mail and phone notifications, for the manager and the mechanic alike.',
          '<strong>Schedule and service jobs</strong>: maintenance planning, a checklist of what was done, and a full history for each machine.',
          '<strong>Parts and stock</strong>: the list of parts to order grouped by family, maintenance kits, stock-out alerts (Stock &amp; Service module).',
          '<strong>Costs and TCO</strong>: hourly cost per machine, depreciation, break-even thresholds.',
          '<strong>QR codes</strong> stuck on the machines: one scan opens the machine sheet on the phone.',
          '<strong>Automatic meters</strong> (telemetry) to update hours and kilometres without manual entry.',
        ] },
        { h2: 'Who is it for?', paras: [
          'For construction companies, landscapers, equipment rental firms, carriers and local authorities that run a fleet of machines and vehicles <strong>without a dedicated maintenance department</strong>, or with a single workshop manager. It works on computer and phone, and there is an Android app.',
        ] },
        { h2: 'A CMMS designed to get started fast', paras: [
          'No endless set-up: <strong>you import the manual, review the proposed plan and validate it</strong>. The plan stays editable, and each task can have its own interval. If you can\'t find the manual for your model, we can build the plan for you (€29 including tax per plan, on request).',
        ] },
        { h2: 'Pricing', paras: [
          'Free for <strong>2 machines</strong>. Then: <strong>Starter €12/month</strong> (5 machines), <strong>Business €39/month</strong> (20 machines, unlimited users, QR codes, costs and TCO), <strong>Enterprise €79/month</strong> (40 machines, Stock &amp; Service, telemetry). Monthly prices include all taxes, with no commitment; extra machines are billed individually depending on the plan. Details and a simulator are on <a href="{{accueil}}#tarifs">the pricing section</a>.',
        ] },
        { h2: 'Designed and used in New Caledonia', paras: [
          'KALEA is published in New Caledonia and used on real fleets (construction equipment, vehicles, motorised tools). Your company\'s data can only be read by your company\'s accounts, and the history can be exported as CSV.',
        ] },
      ],
      faq: [
        { q: 'What is a CMMS?', r: 'A CMMS is maintenance management software: it centralises machines, maintenance plans, due dates, service jobs, parts and costs, to avoid forgotten services and avoidable breakdowns.' },
        { q: 'Is KALEA a real CMMS?', r: 'Yes, for preventive maintenance of a fleet of equipment, vehicles and machines: plans, intervals, reminders, service jobs, parts and costs. It favours simplicity over covering a full industrial site.' },
        { q: 'Do I need to install anything?', r: 'No. KALEA runs in the browser, on computer and phone, and there is also an Android app.' },
        { q: 'Can I try it for free?', r: 'Yes: the Free plan covers 2 machines, with no credit card.' },
      ],
    },
  },

  // ───────────────────────────────────────────────────────── 2. Plan d'entretien automatique
  {
    id: 'plan',
    fr: {
      fichier: 'plan-entretien-automatique.html',
      titre: 'Plan d\'entretien automatique depuis le manuel | KALEA',
      description: 'Déposez le PDF du manuel de votre engin : KALEA en tire les tâches et les échéances (heures, km, calendrier). Vous validez le plan. Gratuit pour 2 machines.',
      fil: 'Plan d\'entretien automatique',
      h1: 'Plan d\'entretien automatique : déposez le manuel, KALEA construit le plan',
      intro: 'Chercher la bonne page dans quarante manuels, recopier des intervalles, oublier une échéance… KALEA fait ce travail à votre place : <strong>vous déposez le manuel constructeur, la lecture automatique en tire un plan d\'entretien</strong>, et vous gardez la main pour le relire et le corriger.',
      sections: [
        { h2: 'En trois étapes', liste: [
          '<strong>Importez le manuel.</strong> Déposez le PDF constructeur de la machine. Une photo de la plaque ou du carnet suffit à retrouver le bon document ; le modèle et l\'année peuvent être précisés.',
          '<strong>Validez le plan proposé.</strong> KALEA en tire les tâches, les échéances et l\'unité de suivi (heures, kilomètres ou mois), premier entretien compris. Vous relisez, vous corrigez si besoin, puis vous confirmez.',
          '<strong>Suivez, puis commandez.</strong> Vous relevez le compteur quand vous voulez : le tableau d\'échéances se met à jour, les rappels partent avant la date, et la liste de pièces se regroupe par famille.',
        ] },
        { h2: 'Ce que KALEA extrait du manuel', liste: [
          'les <strong>intervalles récurrents</strong>, en heures, en kilomètres ou au calendrier ;',
          'les <strong>fiches d\'entretien</strong> et les spécifications (huiles, filtres, graisses…) ;',
          'les <strong>préconisations</strong> du constructeur, tâche par tâche.',
        ] },
        { h2: 'Vous gardez la main', paras: [
          'Le plan n\'est jamais figé : chaque tâche peut être modifiée, et chacune peut avoir <strong>sa propre échéance</strong>. Une machine suit son compteur horaire et son calendrier en même temps (double suivi) : <strong>la première échéance atteinte</strong> déclenche l\'alerte et prépare la checklist d\'intervention. Le plan proposé ne remplace ni les recommandations du constructeur, ni l\'avis d\'un professionnel.',
        ] },
        { h2: 'Et si le manuel est introuvable ?', paras: [
          'Vous n\'avez pas le temps, ou vous ne retrouvez pas le carnet de votre modèle ? Envoyez-nous la photo de la plaque constructeur : nous recherchons et configurons le plan dans l\'application. Cette prestation coûte <strong>29 € TTC par plan</strong>, payable une fois le plan livré et validé avec vous.',
        ] },
        { h2: 'Aller plus loin', paras: [
          'Une fois le plan en place : <a href="{{lien:suivi}}">suivi des engins de chantier</a> (compteurs, QR codes, signalement de panne) et <a href="{{lien:gmao}}">logiciel GMAO complet</a> (pièces, stock, coûts).',
        ] },
      ],
      faq: [
        { q: 'Quels documents puis-je importer ?', r: 'Le manuel ou le carnet d\'entretien du constructeur au format PDF. Une photo de la plaque constructeur aide à retrouver le bon document.' },
        { q: 'Le plan généré est-il fiable ?', r: 'Il s\'appuie sur votre manuel, mais c\'est à vous de le relire et de le valider avant de l\'utiliser. KALEA ne remplace ni les préconisations du constructeur ni l\'avis d\'un professionnel qualifié.' },
        { q: 'Puis-je modifier le plan ?', r: 'Oui : tâches, intervalles et unités de suivi restent modifiables, machine par machine.' },
        { q: 'Combien d\'analyses de manuel sont incluses ?', r: 'Chaque offre inclut un quota mensuel d\'analyses de carnet (10 dans l\'offre Gratuit). Le détail est dans le tableau comparatif de la page Tarifs.' },
      ],
    },
    en: {
      fichier: 'en/automatic-maintenance-plan.html',
      titre: 'Automatic maintenance plan from the manual | KALEA',
      description: 'Upload your machine\'s manual PDF: KALEA extracts the tasks and intervals (hours, km, calendar). You review, you validate. Free for 2 machines.',
      fil: 'Automatic maintenance plan',
      h1: 'Automatic maintenance plan: upload the manual, KALEA builds the plan',
      intro: 'Hunting for the right page in forty manuals, copying out intervals, forgetting a service… KALEA does that work for you: <strong>you upload the manufacturer manual, automatic reading builds a maintenance plan from it</strong>, and you stay in control to review and correct it.',
      sections: [
        { h2: 'In three steps', liste: [
          '<strong>Import the manual.</strong> Upload the machine\'s manufacturer PDF. A photo of the plate or logbook is enough to find the right document; you can add the model and year.',
          '<strong>Validate the proposed plan.</strong> KALEA extracts the tasks, the intervals and the tracking unit (hours, kilometres or months), first service included. You review, correct if needed, then confirm.',
          '<strong>Track, then order.</strong> Read the meter whenever you like: the schedule updates, reminders go out before the due date, and the parts list is grouped by family.',
        ] },
        { h2: 'What KALEA extracts from the manual', liste: [
          'the <strong>recurring intervals</strong>, in hours, kilometres or calendar time;',
          'the <strong>service sheets</strong> and specifications (oils, filters, greases…);',
          'the manufacturer\'s <strong>recommendations</strong>, task by task.',
        ] },
        { h2: 'You stay in control', paras: [
          'The plan is never locked: every task can be edited, and each one can have <strong>its own due date</strong>. A machine follows its hour meter and its calendar at the same time (dual tracking): <strong>the first interval reached</strong> triggers the alert and prepares the service checklist. The proposed plan does not replace the manufacturer\'s recommendations or a qualified professional\'s advice.',
        ] },
        { h2: 'What if the manual can\'t be found?', paras: [
          'No time, or you can\'t find the logbook for your model? Send us a photo of the manufacturer\'s plate: we find the manual and set up the plan in the application. This service costs <strong>€29 including tax per plan</strong>, payable once the plan has been delivered and agreed with you.',
        ] },
        { h2: 'Going further', paras: [
          'Once the plan is in place: <a href="{{lien:suivi}}">construction equipment tracking</a> (meters, QR codes, breakdown reporting) and the <a href="{{lien:gmao}}">full CMMS</a> (parts, stock, costs).',
        ] },
      ],
      faq: [
        { q: 'Which documents can I import?', r: 'The manufacturer\'s manual or service logbook as a PDF. A photo of the manufacturer\'s plate helps find the right document.' },
        { q: 'Is the generated plan reliable?', r: 'It is based on your manual, but you must review and validate it before using it. KALEA does not replace the manufacturer\'s recommendations or a qualified professional\'s advice.' },
        { q: 'Can I edit the plan?', r: 'Yes: tasks, intervals and tracking units stay editable, machine by machine.' },
        { q: 'How many manual analyses are included?', r: 'Each plan includes a monthly quota of logbook analyses (10 on the Free plan). Details are in the comparison table of the pricing section.' },
      ],
    },
  },

  // ───────────────────────────────────────────────────────── 3. Suivi des engins de chantier
  {
    id: 'suivi',
    fr: {
      fichier: 'suivi-engins-chantier.html',
      titre: 'Suivi d\'entretien des engins de chantier : heures, km | KALEA',
      description: 'Suivez l\'entretien de vos engins de chantier aux heures, aux km ou au calendrier : QR codes, relevé du compteur en photo, rappels, signalement de panne.',
      fil: 'Suivi des engins de chantier',
      h1: 'Suivi d\'entretien des engins de chantier : heures, kilomètres, calendrier',
      intro: 'Un engin arrêté, c\'est du travail qui attend, un chantier décalé ou une location à payer à la place. KALEA suit chaque machine <strong>à son rythme réel</strong> : au compteur horaire, à l\'odomètre, au calendrier, ou aux deux à la fois, et prévient avant que l\'échéance ne soit dépassée.',
      sections: [
        { h2: 'Le bon suivi pour chaque machine', paras: [
          'Une pelle se suit aux heures, un fourgon aux kilomètres, un groupe électrogène au calendrier. KALEA gère <strong>les trois</strong>, et un <strong>double suivi</strong> quand il le faut (par exemple heures et calendrier) : la première échéance atteinte déclenche l\'alerte et prépare la checklist de l\'intervention.',
        ] },
        { h2: 'Relever le compteur, sans y passer du temps', liste: [
          '<strong>Saisie en un geste</strong> depuis la fiche de la machine.',
          '<strong>Relevé en photo</strong> : photographiez le compteur, KALEA lit la valeur (selon l\'offre).',
          '<strong>Compteurs automatiques</strong> avec un boîtier de télémétrie : les heures et les kilomètres se mettent à jour tout seuls (offre Enterprise, matériel en sus).',
        ] },
        { h2: 'Un QR code sur chaque engin', paras: [
          'Collez un QR code sur la machine : <strong>un scan avec l\'appareil photo du téléphone ouvre directement sa fiche</strong> (compteur, prochaine échéance, historique, bouton d\'intervention). Pratique sur un chantier, où personne n\'a le temps de chercher dans une liste. Les QR codes équipements et chantiers sont inclus à partir de l\'offre Business.',
        ] },
        { h2: 'Rappels et pannes', liste: [
          '<strong>Rappels avant l\'échéance</strong> par e-mail et notifications, adressés au bon rôle : gérant, mécanicien, chauffeur.',
          '<strong>Signalement de panne</strong> depuis le téléphone par l\'opérateur, avec suivi côté gérant.',
          '<strong>Coût d\'immobilisation</strong> d\'une panne, pour mesurer ce que coûte vraiment un engin à l\'arrêt.',
        ] },
        { h2: 'Aller plus loin', paras: [
          'Tout part du plan d\'entretien : voir <a href="{{lien:plan}}">le plan automatique depuis le manuel</a>. Pour les pièces, les stocks et les coûts, voir <a href="{{lien:gmao}}">le logiciel GMAO complet</a>.',
        ] },
      ],
      faq: [
        { q: 'Puis-je suivre des véhicules et des engins dans le même outil ?', r: 'Oui : chaque machine choisit son unité de suivi (heures ou kilomètres), avec un calendrier en plus si besoin.' },
        { q: 'Faut-il un boîtier sur chaque machine ?', r: 'Non. Le relevé manuel ou en photo suffit. Les compteurs automatiques sont une option (offre Enterprise, matériel en sus).' },
        { q: 'Les QR codes sont-ils inclus ?', r: 'Oui à partir de l\'offre Business. Vous imprimez l\'étiquette depuis l\'application.' },
        { q: 'L\'application fonctionne-t-elle sur téléphone ?', r: 'Oui, dans le navigateur et en application Android. Le téléphone sert au relevé du compteur, au scan des QR codes et au signalement de panne.' },
      ],
    },
    en: {
      fichier: 'en/construction-equipment-maintenance-tracking.html',
      titre: 'Construction equipment maintenance tracking: hours, km | KALEA',
      description: 'Track your construction equipment maintenance by hours, km or calendar: QR codes, meter reading by photo, reminders and breakdown reporting.',
      fil: 'Equipment maintenance tracking',
      h1: 'Construction equipment maintenance tracking: hours, kilometres, calendar',
      intro: 'A machine that is stopped means work waiting, a delayed site or a rental to pay for instead. KALEA tracks each machine <strong>at its real pace</strong>: by hour meter, by odometer, by calendar, or both at once, and warns you before the due date is missed.',
      sections: [
        { h2: 'The right tracking for each machine', paras: [
          'An excavator is tracked in hours, a van in kilometres, a generator by calendar. KALEA handles <strong>all three</strong>, with <strong>dual tracking</strong> when needed (for example hours and calendar): the first interval reached triggers the alert and prepares the service checklist.',
        ] },
        { h2: 'Reading the meter without wasting time', liste: [
          '<strong>One-step entry</strong> from the machine sheet.',
          '<strong>Photo reading</strong>: photograph the meter and KALEA reads the value (depending on the plan).',
          '<strong>Automatic meters</strong> with a telemetry box: hours and kilometres update on their own (Enterprise plan, hardware extra).',
        ] },
        { h2: 'A QR code on every machine', paras: [
          'Stick a QR code on the machine: <strong>one scan with the phone camera opens its sheet directly</strong> (meter, next due date, history, service button). Handy on a site, where nobody has time to search a list. Equipment and site QR codes are included from the Business plan.',
        ] },
        { h2: 'Reminders and breakdowns', liste: [
          '<strong>Reminders before the due date</strong> by e-mail and notifications, sent to the right role: manager, mechanic, driver.',
          '<strong>Breakdown reporting</strong> from the phone by the operator, with follow-up on the manager\'s side.',
          '<strong>Downtime cost</strong> of a breakdown, to measure what a stopped machine really costs.',
        ] },
        { h2: 'Going further', paras: [
          'Everything starts from the maintenance plan: see <a href="{{lien:plan}}">the automatic plan from the manual</a>. For parts, stock and costs, see <a href="{{lien:gmao}}">the full CMMS</a>.',
        ] },
      ],
      faq: [
        { q: 'Can I track vehicles and equipment in the same tool?', r: 'Yes: each machine picks its tracking unit (hours or kilometres), with a calendar on top if needed.' },
        { q: 'Do I need a box on every machine?', r: 'No. Manual or photo reading is enough. Automatic meters are an option (Enterprise plan, hardware extra).' },
        { q: 'Are QR codes included?', r: 'Yes, from the Business plan. You print the label from the application.' },
        { q: 'Does it work on a phone?', r: 'Yes, in the browser and as an Android app. The phone is used for meter reading, QR code scanning and breakdown reporting.' },
      ],
    },
  },
];
