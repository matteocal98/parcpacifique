// Le contenu du centre d'aide (kalea.pro/aide et kalea.pro/en/help). SOURCE UNIQUE : outils/generer-aide.mjs en fait les pages, outils/aide/captures.mjs les images.
// Règles d'écriture :
//   · {{ui:Libellé}} = le NOM EXACT d'un bouton, d'un champ ou d'un écran de l'application, écrit en français. Le générateur le remplace, en anglais, par la traduction
//     que l'application utilise vraiment (traductions-en.js) ; outils/aide/verifier-libelles.mjs échoue si le libellé n'existe plus dans l'application.
//   · {{lien:ID}} = l'adresse d'un autre article, dans la langue de la page.
//   · Aucun prix, aucun quota chiffré : ils vivent sur la page des offres (qui peut changer) — on y renvoie.
//   · Chaque affirmation vient d'un relevé du code de l'application (2026-11-02) ; ce qui n'a pas pu être vérifié n'est pas écrit.
// Les numéros des repères rouges des images (1, 2, 3) sont ceux des étapes de l'article.

export const SITE = 'https://kalea.pro';

import { ARTICLES_DEMARRER } from './articles-demarrer.mjs';
import { ARTICLES_MACHINES } from './articles-machines.mjs';
import { ARTICLES_ENTRETIEN } from './articles-entretien.mjs';
import { ARTICLES_ORDRES } from './articles-ordres.mjs';
import { ARTICLES_STOCK } from './articles-stock.mjs';

// L'ordre ci-dessous est celui de la page d'accueil de l'aide.
export const THEMES = {
  demarrer: { fr: 'Démarrer avec KALEA', en: 'Getting started' },
  compte: { fr: 'Compte, notifications et offre', en: 'Account, notifications and plan' },
  machines: { fr: 'Machines et fiches', en: 'Machines and records' },
  plans: { fr: 'Plans d\'entretien et carnets', en: 'Maintenance plans and manuals' },
  compteurs: { fr: 'Compteurs', en: 'Meters' },
  interventions: { fr: 'Interventions, agenda et rappels', en: 'Interventions, calendar and reminders' },
  ordres: { fr: 'Ordres de travail', en: 'Work orders' },
  equipe: { fr: 'Équipe, droits et hors-ligne', en: 'Team, permissions and offline' },
  stock: { fr: 'Stock & SAV', en: 'Stock & service' },
  couts: { fr: 'Coûts et TCO', en: 'Costs and TCO' },
  telemetrie: { fr: 'Télémétrie', en: 'Telemetry' },
  support: { fr: 'Aide & support', en: 'Help & support' },
};

export const HUB = {
  fr: {
    fichier: 'aide/index.html',
    titre: 'Aide KALEA : procédures pas à pas pour votre parc et vos équipes',
    description: 'Démarrer, machines, entretien, ordres de travail, stock, coûts, équipe et droits : les procédures de KALEA expliquées pas à pas, avec les noms exacts des boutons.',
    h1: 'Aide KALEA',
    intro: 'Des procédures courtes, pas à pas, et les réponses aux questions les plus fréquentes (« je ne vois pas tel bouton », « pourquoi… »). Chaque article reprend les noms exacts des boutons de l\'application ; certains sont illustrés de captures d\'écran annotées. Cherchez un mot, ou parcourez les thèmes.',
    contact: 'Vous ne trouvez pas la réponse ? Dans l\'application, ouvrez {{ui:Aide & support}} et écrivez-nous : l\'équipe vous répond dans le même écran. Vous pouvez aussi écrire à <a href="mailto:support@kalea.pro">support@kalea.pro</a>.',
    fil: 'Aide',
  },
  en: {
    fichier: 'en/help/index.html',
    titre: 'KALEA Help: step-by-step guides for your fleet and your teams',
    description: 'Getting started, machines, maintenance, work orders, stock, costs, team and permissions: KALEA procedures explained step by step, with the exact button names.',
    h1: 'KALEA Help',
    intro: 'Short, step-by-step guides, and answers to the most common questions ("I can\'t see a button", "why…"). Each article uses the exact button names you see in the app; some come with annotated screenshots. Search for a word, or browse the topics.',
    contact: 'Can\'t find the answer? In the app, open {{ui:Aide & support}} and write to us: the team replies in the same screen. You can also email <a href="mailto:support@kalea.pro">support@kalea.pro</a>.',
    fil: 'Help',
  },
};

const ARTICLES_BASE = [
  // ───────────────────────────────────────────────────────── 1. Modifier une machine
  {
    id: 'modifier-machine', theme: 'machines', scenario: 'modifier-machine',
    fr: {
      fichier: 'aide/modifier-une-machine.html',
      titre: 'Modifier une machine et son numéro de série | Aide KALEA',
      h1: 'Modifier une machine et son numéro de série',
      fil: 'Modifier une machine',
      description: 'Changer le nom, la marque, le modèle, l\'année ou le numéro de série d\'une machine dans KALEA : trois étapes, avec captures d\'écran.',
      intro: 'Un nom à corriger, un numéro de série oublié à la création, une plaque qui change : tout se modifie à tout moment, depuis la carte de la machine.',
      etapes: [
        { titre: 'Ouvrez la modification depuis la carte de la machine', texte: 'Dans le menu, ouvrez {{ui:Machines}}. Sur la carte de la machine, touchez l\'icône en forme de roue : c\'est le bouton {{ui:Modifier la machine}}. Vous le retrouvez aussi dans la fiche de la machine.',
          image: { nom: 'carte', alt: 'La carte d\'une machine : l\'icône en forme de roue, repérée par le numéro 1, ouvre la modification.' } },
        { titre: 'Changez les informations', texte: 'La fenêtre {{ui:Modifier une machine}} s\'ouvre. Corrigez le nom, la marque, le modèle ou l\'année. Le numéro de série se trouve dans le champ {{ui:N° de série}} ; pour un véhicule, ce champ s\'appelle {{ui:Plaque d\'immatriculation}}.',
          image: { nom: 'fenetre', alt: 'La fenêtre Modifier une machine : le champ N° de série est repéré par le numéro 1 et le bouton Enregistrer les modifications par le numéro 2.' } },
        { titre: 'Enregistrez', texte: 'Cliquez sur {{ui:Enregistrer les modifications}} pour valider : les nouvelles informations remplacent les anciennes.' },
      ],
      notes: [
        'Le numéro de série reste modifiable à tout moment, pas seulement à la création.',
        'Le compteur (heures ou kilomètres) ne se corrige pas dans cette fenêtre : voir <a href="{{lien:corriger-compteur}}">corriger le compteur d\'une machine</a>.',
        'Si votre offre ne couvre pas la machine, KALEA l\'indique et propose de changer d\'offre : la fiche reste consultable, mais ne peut pas être modifiée.',
        'Selon votre droit d\'accès, l\'icône de modification peut être absente de la carte : elle n\'est pas affichée pour un droit de saisie ni pour un droit d\'achat.',
      ],
      liees: ['photo-machine', 'carnet-entretien', 'corriger-compteur'],
    },
    en: {
      fichier: 'en/help/edit-a-machine.html',
      titre: 'Edit a machine and its serial number | KALEA Help',
      h1: 'Edit a machine and its serial number',
      fil: 'Edit a machine',
      description: 'Change a machine\'s name, make, model, year or serial number in KALEA: three steps, with screenshots.',
      intro: 'A name to fix, a serial number left blank at creation, a plate that changes: everything can be edited at any time, from the machine\'s card.',
      etapes: [
        { titre: 'Open the editor from the machine\'s card', texte: 'In the menu, open {{ui:Machines}}. On the machine\'s card, tap the cog-shaped icon: it is the {{ui:Modifier la machine}} button. You will also find it on the machine\'s page.',
          image: { nom: 'carte', alt: 'A machine card: the cog-shaped icon, marked with number 1, opens the editor.' } },
        { titre: 'Change the details', texte: 'The {{ui:Modifier une machine}} window opens. Fix the name, make, model or year. The serial number is in the {{ui:N° de série}} field; for a vehicle, that field is called {{ui:Plaque d\'immatriculation}}.',
          image: { nom: 'fenetre', alt: 'The Edit a machine window: the Serial no. field is marked with number 1 and the Save changes button with number 2.' } },
        { titre: 'Save', texte: 'Click {{ui:Enregistrer les modifications}} to confirm: the new details replace the old ones.' },
      ],
      notes: [
        'The serial number can be edited at any time, not only at creation.',
        'The meter (hours or kilometres) is not corrected in this window: see <a href="{{lien:corriger-compteur}}">correct a machine\'s meter</a>.',
        'If your plan does not cover the machine, KALEA says so and offers to change plan: the record stays readable but cannot be edited.',
        'Depending on your access level, the edit icon may be missing from the card: it is not shown for the data-entry level or the purchasing level.',
      ],
      liees: ['photo-machine', 'carnet-entretien', 'corriger-compteur'],
    },
  },

  // ───────────────────────────────────────────────────────── 2. Le carnet d'entretien
  {
    id: 'carnet-entretien', theme: 'plans', scenario: 'carnet-entretien',
    fr: {
      fichier: 'aide/deposer-remplacer-carnet-entretien.html',
      titre: 'Déposer, remplacer ou relire le carnet d\'entretien d\'une machine | Aide KALEA',
      h1: 'Déposer, remplacer ou relire le carnet d\'entretien d\'une machine',
      fil: 'Le carnet d\'entretien',
      description: 'Déposer le PDF du constructeur, photographier le tableau d\'entretien, remplacer ou relire le carnet d\'une machine dans KALEA : procédure pas à pas.',
      intro: 'Dans KALEA, le <strong>carnet d\'entretien</strong> est le document du constructeur : un PDF, ou des photos de son tableau d\'entretien. Il sert à construire le plan d\'entretien de la machine. Ce n\'est pas l\'historique des interventions.',
      etapes: [
        { titre: 'Ouvrez la modification de la machine', texte: 'Touchez l\'icône en forme de roue sur la carte de la machine (voir <a href="{{lien:modifier-machine}}">modifier une machine</a>), puis descendez jusqu\'à la section {{ui:Carnet d\'entretien du constructeur}}.' },
        { titre: 'Déposez le PDF ou photographiez le tableau d\'entretien', texte: 'Glissez le PDF dans la zone {{ui:Glissez votre PDF ici ou parcourez}}, ou touchez {{ui:Photographier le carnet}} pour photographier les pages du tableau d\'entretien. Pour relire le carnet déjà enregistré, touchez {{ui:Voir le carnet actuel (PDF)}}.',
          image: { nom: 'fenetre-carnet', alt: 'La section Carnet d\'entretien du constructeur : la zone de dépôt (1), le bouton Photographier le carnet (2) et le bouton Voir le carnet actuel (3).' } },
        { titre: 'Choisissez les pages et validez le plan', texte: 'KALEA repère les pages du tableau d\'entretien ; vous choisissez celles à analyser (six au plus). L\'analyse propose ensuite des tâches et des intervalles : relisez-les, rien n\'est activé sans votre validation.' },
        { titre: 'Enregistrez', texte: 'Cliquez sur {{ui:Enregistrer les modifications}}. Le nouveau document remplace l\'ancien.' },
      ],
      variante: {
        titre: 'Autre chemin : depuis l\'écran des plans d\'entretien',
        texte: 'Dans {{ui:Machines}}, ouvrez l\'onglet {{ui:Plans d\'entretien}}. Sur la ligne de la machine, touchez {{ui:Déposer}} (aucun carnet pour l\'instant) ou {{ui:Remplacer}} (un carnet existe déjà). Par cet écran, seul un fichier PDF est accepté.',
        image: { nom: 'plans', alt: 'L\'écran Plans d\'entretien : Remplacer (1) sur une machine qui a déjà un carnet, Déposer (2) sur une machine qui n\'en a pas.' },
      },
      notes: [
        'Il n\'y a pas de bouton « mettre à jour » : pour refaire l\'analyse, redéposez le document.',
        'Chaque analyse utilise une analyse de carnet incluse dans votre offre ; elle n\'est pas décomptée si rien n\'a pu être lu. Le détail figure sur <a href="/#tarifs">la page des offres</a>.',
        'Un PDF de plus de 8 Mo est analysé, mais n\'est pas conservé dans la fiche de la machine.',
        'Vous n\'avez pas de carnet ? Le plan peut être établi pour vous : la demande se fait depuis cette même fenêtre.',
      ],
      liees: ['modifier-machine', 'photo-machine', 'second-compteur'],
    },
    en: {
      fichier: 'en/help/upload-replace-maintenance-manual.html',
      titre: 'Upload, replace or view a machine\'s maintenance manual | KALEA Help',
      h1: 'Upload, replace or view a machine\'s maintenance manual',
      fil: 'The maintenance manual',
      description: 'Upload the manufacturer\'s PDF, photograph the maintenance table, replace or view a machine\'s manual in KALEA: step-by-step procedure.',
      intro: 'In KALEA, the <strong>maintenance manual</strong> is the manufacturer\'s document: a PDF, or photos of its maintenance table. It is used to build the machine\'s maintenance plan. It is not the history of past interventions.',
      etapes: [
        { titre: 'Open the machine editor', texte: 'Tap the cog-shaped icon on the machine\'s card (see <a href="{{lien:modifier-machine}}">edit a machine</a>), then scroll down to the {{ui:Carnet d\'entretien du constructeur}} section.' },
        { titre: 'Upload the PDF or photograph the maintenance table', texte: 'Drag the PDF into the {{ui:Glissez votre PDF ici ou parcourez}} area, or tap {{ui:Photographier le carnet}} to photograph the pages of the maintenance table. To read the manual already saved, tap {{ui:Voir le carnet actuel (PDF)}}.',
          image: { nom: 'fenetre-carnet', alt: 'The manufacturer\'s manual section: the drop area (1), the photograph button (2) and the view-current-manual button (3).' } },
        { titre: 'Choose the pages and confirm the plan', texte: 'KALEA finds the pages of the maintenance table; you choose the ones to analyse (six at most). The analysis then suggests tasks and intervals: read them through, nothing is activated without your confirmation.' },
        { titre: 'Save', texte: 'Click {{ui:Enregistrer les modifications}}. The new document replaces the old one.' },
      ],
      variante: {
        titre: 'Another route: from the maintenance plans screen',
        texte: 'In {{ui:Machines}}, open the {{ui:Plans d\'entretien}} tab. On the machine\'s row, tap {{ui:Déposer}} (no manual yet) or {{ui:Remplacer}} (a manual already exists). From this screen, only a PDF file is accepted.',
        image: { nom: 'plans', alt: 'The maintenance plans screen: Replace (1) on a machine that already has a manual, Upload (2) on one that has none.' },
      },
      notes: [
        'There is no “update” button: to run the analysis again, upload the document again.',
        'Each analysis uses one manual analysis included in your plan; it is not counted if nothing could be read. The details are on <a href="/en/#tarifs">the plans page</a>.',
        'A PDF larger than 8 MB is analysed, but is not kept on the machine\'s record.',
        'No manual? The plan can be set up for you: the request is made from that same window.',
      ],
      liees: ['modifier-machine', 'photo-machine', 'second-compteur'],
    },
  },

  // ───────────────────────────────────────────────────────── 3. La photo d'une machine
  {
    id: 'photo-machine', theme: 'machines', scenario: 'photo-machine',
    fr: {
      fichier: 'aide/ajouter-changer-photo-machine.html',
      titre: 'Ajouter ou changer la photo d\'une machine | Aide KALEA',
      h1: 'Ajouter ou changer la photo d\'une machine',
      fil: 'La photo d\'une machine',
      description: 'Choisir une photo dans vos fichiers ou en prendre une avec l\'appareil photo, pour illustrer la carte et la fiche d\'une machine KALEA.',
      intro: 'La photo s\'affiche sur la carte et dans la fiche de la machine. Vous pouvez la choisir dans vos fichiers ou la prendre sur le moment.',
      etapes: [
        { titre: 'Ouvrez la modification de la machine', texte: 'Touchez l\'icône en forme de roue sur la carte de la machine (voir <a href="{{lien:modifier-machine}}">modifier une machine</a>).' },
        { titre: 'Choisissez ou prenez la photo', texte: 'Dans la section {{ui:Visuel & photo du matériel}}, touchez {{ui:Choisir une photo}} pour prendre un fichier de votre appareil, ou {{ui:Prendre une photo}} pour utiliser l\'appareil photo.',
          image: { nom: 'fenetre-photo', alt: 'La section Visuel & photo du matériel : Choisir une photo (1), Prendre une photo (2), puis Enregistrer les modifications (3).' } },
        { titre: 'Enregistrez', texte: 'Cliquez sur {{ui:Enregistrer les modifications}}.' },
      ],
      notes: [
        'Une machine n\'a qu\'une photo : la nouvelle remplace l\'ancienne à l\'enregistrement.',
        'La photo est réduite automatiquement avant l\'envoi ; les formats JPEG, PNG et WebP sont acceptés.',
        'KALEA ne cherche pas de photo sur internet : l\'image vient toujours de vous.',
        'Sans réseau, la photo est gardée sur l\'appareil, puis envoyée au retour du réseau.',
      ],
      liees: ['modifier-machine', 'carnet-entretien'],
    },
    en: {
      fichier: 'en/help/add-change-machine-photo.html',
      titre: 'Add or change a machine\'s photo | KALEA Help',
      h1: 'Add or change a machine\'s photo',
      fil: 'A machine\'s photo',
      description: 'Choose a photo from your files or take one with the camera to illustrate a KALEA machine\'s card and record.',
      intro: 'The photo is shown on the machine\'s card and on its record. You can pick it from your files or take it on the spot.',
      etapes: [
        { titre: 'Open the machine editor', texte: 'Tap the cog-shaped icon on the machine\'s card (see <a href="{{lien:modifier-machine}}">edit a machine</a>).' },
        { titre: 'Choose or take the photo', texte: 'In the {{ui:Visuel & photo du matériel}} section, tap {{ui:Choisir une photo}} to pick a file from your device, or {{ui:Prendre une photo}} to use the camera.',
          image: { nom: 'fenetre-photo', alt: 'The visual and photo section: Choose a photo (1), Take a photo (2), then Save changes (3).' } },
        { titre: 'Save', texte: 'Click {{ui:Enregistrer les modifications}}.' },
      ],
      notes: [
        'A machine has a single photo: the new one replaces the old one when you save.',
        'The photo is reduced automatically before sending; JPEG, PNG and WebP formats are accepted.',
        'KALEA does not search the internet for a photo: the image always comes from you.',
        'Without a network, the photo is kept on the device, then sent when the network returns.',
      ],
      liees: ['modifier-machine', 'carnet-entretien'],
    },
  },

  // ───────────────────────────────────────────────────────── 4. Corriger un compteur
  {
    id: 'corriger-compteur', theme: 'compteurs', scenario: 'corriger-compteur',
    fr: {
      fichier: 'aide/corriger-compteur-machine.html',
      titre: 'Corriger ou mettre à jour le compteur d\'une machine | Aide KALEA',
      h1: 'Corriger ou mettre à jour le compteur d\'une machine',
      fil: 'Corriger le compteur',
      description: 'Saisir un nouveau relevé d\'heures ou de kilomètres, corriger une valeur, gérer un compteur remplacé : la procédure KALEA, pas à pas.',
      intro: 'Le compteur (heures ou kilomètres) se met à jour directement <strong>sur la carte de la machine</strong>, pas dans la fenêtre de modification.',
      etapes: [
        { titre: 'Repérez la carte de la machine', texte: 'Dans le menu, ouvrez {{ui:Machines}} et trouvez la carte de la machine.' },
        { titre: 'Saisissez la nouvelle valeur', texte: 'Tapez la valeur dans le champ du compteur, ou utilisez les boutons − et +.',
          image: { nom: 'carte-compteur', alt: 'La carte d\'une machine : le champ du compteur (1) et le bouton OK (2).' } },
        { titre: 'Validez le relevé', texte: 'Cliquez sur {{ui:OK}} pour enregistrer le relevé. Sur téléphone, touchez le compteur ({{ui:Ajuster}}), réglez la valeur avec les rouleaux, puis touchez {{ui:Valider le relevé}}.' },
      ],
      notes: [
        'Une valeur plus basse que la précédente est acceptée après confirmation : c\'est utile quand le compteur de la machine a été remplacé. Il n\'y a pas de bouton de remise à zéro : saisissez la nouvelle valeur (par exemple 0).',
        'Une valeur négative est refusée.',
        'Changer l\'unité (heures ou kilomètres) se fait dans {{ui:Modifier la machine}}. La valeur n\'est pas convertie : vérifiez-la après le changement.',
        'Le relevé se met aussi à jour quand vous enregistrez une intervention, dans le champ {{ui:Compteur relevé}}.',
        'Une machine non couverte par votre offre est en lecture seule : le relevé n\'y est pas enregistré.',
      ],
      liees: ['second-compteur', 'modifier-machine'],
    },
    en: {
      fichier: 'en/help/correct-machine-meter.html',
      titre: 'Correct or update a machine\'s meter | KALEA Help',
      h1: 'Correct or update a machine\'s meter',
      fil: 'Correct the meter',
      description: 'Enter a new hours or kilometres reading, correct a value, handle a replaced meter: the KALEA procedure, step by step.',
      intro: 'The meter (hours or kilometres) is updated directly <strong>on the machine\'s card</strong>, not in the edit window.',
      etapes: [
        { titre: 'Find the machine\'s card', texte: 'In the menu, open {{ui:Machines}} and find the machine\'s card.' },
        { titre: 'Enter the new value', texte: 'Type the value in the meter field, or use the − and + buttons.',
          image: { nom: 'carte-compteur', alt: 'A machine card: the meter field (1) and the OK button (2).' } },
        { titre: 'Confirm the reading', texte: 'Click {{ui:OK}} to save the reading. On a phone, tap the meter ({{ui:Ajuster}}), set the value with the wheels, then tap {{ui:Valider le relevé}}.' },
      ],
      notes: [
        'A value lower than the previous one is accepted after confirmation: this is useful when the machine\'s meter has been replaced. There is no reset button: enter the new value (for example 0).',
        'A negative value is refused.',
        'Changing the unit (hours or kilometres) is done in {{ui:Modifier la machine}}. The value is not converted: check it after the change.',
        'The reading is also updated when you log an intervention, in the {{ui:Compteur relevé}} field.',
        'A machine not covered by your plan is read-only: readings are not saved on it.',
      ],
      liees: ['second-compteur', 'modifier-machine'],
    },
  },

  // ───────────────────────────────────────────────────────── 5. Un second compteur
  {
    id: 'second-compteur', theme: 'compteurs', scenario: 'second-compteur',
    fr: {
      fichier: 'aide/ajouter-second-compteur.html',
      titre: 'Suivre une machine avec un second compteur | Aide KALEA',
      h1: 'Suivre une machine avec un second compteur',
      fil: 'Un second compteur',
      description: 'Heures ET kilomètres, ou compteur ET calendrier : ajouter un second suivi à une machine dans KALEA, pas à pas.',
      intro: 'Certains carnets d\'entretien mélangent plusieurs unités, par exemple des heures <em>et</em> des kilomètres. KALEA peut suivre une machine avec un second compteur, en plus du premier.',
      etapes: [
        { titre: 'Ouvrez la modification de la machine', texte: 'Touchez l\'icône en forme de roue sur la carte de la machine (voir <a href="{{lien:modifier-machine}}">modifier une machine</a>).' },
        { titre: 'Cochez le second suivi', texte: 'Dans la section {{ui:Mode de suivi & échéances d\'entretien}}, cochez la case {{ui:Ajouter un second suivi (le carnet mélange plusieurs unités, ex. heures ET km)}}.',
          image: { nom: 'fenetre-second', alt: 'La case Ajouter un second suivi (1) et le champ Relevé actuel du second compteur (2).' } },
        { titre: 'Renseignez le second compteur', texte: 'Choisissez son unité (elle doit différer de celle du premier suivi), puis indiquez le relevé actuel, l\'échéance et le rappel.' },
        { titre: 'Enregistrez', texte: 'Cliquez sur {{ui:Enregistrer les modifications}}.' },
      ],
      notes: [
        'Le second compteur apparaît ensuite sur la carte de la machine : on le règle en le touchant.',
        'Quand vous enregistrez une intervention, un champ dédié permet de saisir aussi le second compteur.',
      ],
      liees: ['corriger-compteur', 'carnet-entretien'],
    },
    en: {
      fichier: 'en/help/add-second-meter.html',
      titre: 'Track a machine with a second meter | KALEA Help',
      h1: 'Track a machine with a second meter',
      fil: 'A second meter',
      description: 'Hours AND kilometres, or meter AND calendar: add a second tracking to a machine in KALEA, step by step.',
      intro: 'Some maintenance manuals mix several units, for example hours <em>and</em> kilometres. KALEA can track a machine with a second meter, in addition to the first.',
      etapes: [
        { titre: 'Open the machine editor', texte: 'Tap the cog-shaped icon on the machine\'s card (see <a href="{{lien:modifier-machine}}">edit a machine</a>).' },
        { titre: 'Tick the second tracking', texte: 'In the {{ui:Mode de suivi & échéances d\'entretien}} section, tick the {{ui:Ajouter un second suivi (le carnet mélange plusieurs unités, ex. heures ET km)}} box.',
          image: { nom: 'fenetre-second', alt: 'The add-a-second-tracking box (1) and the current-reading field of the second meter (2).' } },
        { titre: 'Fill in the second meter', texte: 'Choose its unit (it must differ from the first tracking\'s unit), then enter the current reading, the due interval and the reminder.' },
        { titre: 'Save', texte: 'Click {{ui:Enregistrer les modifications}}.' },
      ],
      notes: [
        'The second meter then appears on the machine\'s card: you set it by tapping it.',
        'When you log an intervention, a dedicated field also lets you enter the second meter.',
      ],
      liees: ['corriger-compteur', 'carnet-entretien'],
    },
  },
];

// Les articles écrits par lots thématiques (chaque lot a son préfixe d'identifiant : dem-, mac-, ent-, ord-, stk-/cout-/tele-/sup-).
export const ARTICLES = [...ARTICLES_BASE, ...ARTICLES_DEMARRER, ...ARTICLES_MACHINES, ...ARTICLES_ENTRETIEN, ...ARTICLES_ORDRES, ...ARTICLES_STOCK];
