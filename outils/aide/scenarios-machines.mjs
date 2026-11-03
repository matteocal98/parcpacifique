// Scénarios de capture du lot « machines » (articles de outils/aide/articles-machines.mjs). Même fonctionnement que scenarios.mjs :
// chaque ÉTAPE ouvre un écran avec le parc fictif, pose des repères rouges, vérifie qu'ils sont tous dans la zone photographiée, et renvoie cette zone.
// Les numéros des repères sont ceux des étapes de l'article. Aucune capture ne clique sur un bouton qui enregistre, crée ou supprime : on photographie des ÉTATS.
// Tout ce qui manque au décor commun (etat-fictif.js) est fait ICI, dans le scénario (c.ev) : fausses données, fonctions remplacées.

const ADD = '.overlay.machine-modal-add > div';   // la fenêtre d'ajout (elle n'a pas la classe .modal)
const SECTION = (n) => `.overlay.machine-modal-add main > section:nth-of-type(${n})`;

async function toutDansLaZone(c, selecteurs, zone) {
  const dehors = await c.horsZone(selecteurs, zone);
  if (dehors.length) throw new Error('éléments repérés hors de la zone photographiée : ' + dehors.join(', '));
}
// Zone qui va du haut d'un élément au bas d'un autre, avec la largeur d'un troisième (la fenêtre ou la section qui les contient).
async function zoneEntre(c, haut, bas, large, marge = 16, margeY = marge) {
  return c.ev(`(() => {
    const a = document.querySelector(${JSON.stringify(haut)}).getBoundingClientRect();
    const b = document.querySelector(${JSON.stringify(bas)}).getBoundingClientRect();
    const l = document.querySelector(${JSON.stringify(large)}).getBoundingClientRect();
    const m = ${marge}, my = ${margeY};
    const x = Math.max(0, l.left - m), y = Math.max(0, a.top - my);
    return { x: x + (window.pageXOffset || 0), y: y + (window.pageYOffset || 0), largeur: Math.min(innerWidth - x, l.width + 2 * m), hauteur: Math.min(innerHeight - y, b.bottom + my - y) };
  })()`);
}
// Les noms du parc fictif sont en français : pour les images ANGLAISES on les traduit (machines et catégories), dans la page uniquement.
// Le faux client de base du décor commun n'a pas `range()` (les écrans qui lisent l'historique ou les coûts afficheraient « Erreur de chargement ») : on le remplace par un
// client qui répond « rien » à tout, y compris à `range()`.
async function baseVide(c) {
  await c.ev(`(() => {
    const METHODES = ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'gt', 'lt', 'is', 'neq', 'not', 'range', 'or', 'ilike', 'like', 'contains', 'filter', 'match', 'insert', 'update', 'delete', 'upsert'];
    sb.from = () => { const b = {}; METHODES.forEach((k) => { b[k] = () => b; }); b.single = () => Promise.resolve({ data: null, error: null }); b.maybeSingle = () => Promise.resolve({ data: null, error: null }); b.then = (res) => res({ data: [], error: null, count: 0 }); return b; };
    return true; })()`);
}
// Ouvre la fiche de la machine m1 avec des tâches détaillées et trois entretiens fictifs (le décor commun n'en fournit pas).
async function ouvrirFiche(c) {
  const en = c.langue === 'en';
  const taches = en
    ? [['Engine oil change', 'Every 250 h', '15W-40 oil', '12 L', 'Replace the oil filter'], ['Greasing', 'Every 50 h', 'Grease', '', 'All pivot points'], ['Air filter check', 'Every 500 h', 'Air filter', '1', ''], ['Hydraulic oil change', 'Every 1000 h', 'Hydraulic oil', '90 L', '']]
    : [['Vidange moteur', 'Toutes les 250 h', 'Huile 15W-40', '12 L', 'Remplacer le filtre à huile'], ['Graissage', 'Toutes les 50 h', 'Graisse', '', "Tous les points d'articulation"], ['Contrôle du filtre à air', 'Toutes les 500 h', 'Filtre à air', '1', ''], ['Vidange huile hydraulique', 'Toutes les 1000 h', 'Huile hydraulique', '90 L', '']];
  const faits = en ? ['Engine oil change', 'Greasing'] : ['Vidange moteur', 'Graissage'];
  const remarques = en ? ['Oil and filter replaced', 'Greasing done', 'Routine service'] : ['Huile et filtre remplacés', 'Graissage effectué', 'Entretien courant'];
  await c.ev(`(() => {
    const t = ${JSON.stringify(taches)};
    const m = UI.machines.find((x) => x.id === 'm1');
    m.plan.items = t.map(([label, frequency, spec, qty, note]) => ({ label, frequency, spec, qty, note }));
    const jour = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const faits = ${JSON.stringify(faits)}; const rem = ${JSON.stringify(remarques)};
    const lignes = [
      { id: 'i1', performed_at: jour(20), hours_at_intervention: 1180, items_done: faits, performed_by: 'u1', description: rem[0], parts_cost: null, labor_cost: null },
      { id: 'i2', performed_at: jour(75), hours_at_intervention: 1100, items_done: [faits[1]], performed_by: 'u2', description: rem[1], parts_cost: null, labor_cost: null },
      { id: 'i3', performed_at: jour(140), hours_at_intervention: 1010, items_done: faits, performed_by: 'u1', description: rem[2], parts_cost: null, labor_cost: null },
    ];
    window.fetchAllInterventions = async () => lignes;
    window.equipePourAttribution = async () => [{ id: 'u1', nom_affiche: 'Camille Martin' }, { id: 'u2', nom_affiche: 'Alex Durand' }];
    goTo('machines'); openPlanView(m, UI.companyId, UI.categories);
    return true; })()`);
  await c.attendre('.fm-toolbar');
  await c.attendre('#history-section .ref-table');
  await c.ev('document.activeElement && document.activeElement.blur && document.activeElement.blur(); true');
  await c.dort(600);
}
// Le parc commun montre 4 machines « à jour » : on en met une en retard et une bientôt à échéance, pour que les filtres d'état aient quelque chose à montrer.
async function donneesLangue(c) {
  await baseVide(c);
  await c.ev(`(() => {
    const m2 = UI.machines.find((m) => m.id === 'm2'); const m3 = UI.machines.find((m) => m.id === 'm3');
    if (m2) m2.plan.next_due_counter = 5420;
    if (m3) m3.plan.next_due_counter = 84000;
    return true; })()`);
  if (c.langue !== 'en') return;
  await c.ev(`(() => {
    const cats = { c1: 'Excavators', c2: 'Loaders', c3: 'Trucks', c4: 'Generators' };
    const noms = { m1: 'Excavator 1.7 t', m2: 'Wheel loader', m3: 'Dump truck', m4: 'Generator 60 kVA' };
    UI.categories.forEach((k) => { if (cats[k.id]) k.name = cats[k.id]; });
    UI.machines.forEach((m) => { if (m.plan) m.plan.tasks = 'Oil change, greasing, filter check'; });
    UI.machines.forEach((m) => { if (noms[m.id]) m.name = noms[m.id]; if (m.category && cats[m.category.id]) m.category.name = cats[m.category.id]; });
    return true; })()`);
}
async function listeMachines(c) {
  // Le choix « Cartes / Tuiles » est mémorisé par l'application : on repart toujours de l'affichage par défaut.
  await c.ev("try { localStorage.removeItem('kalea.parcVue'); } catch (e) {} UI.filters = null; goTo('machines'); true");
  await c.attendre('#fleet-add');
  await c.dort(600);
}
async function fenetreAjout(c) {
  await c.ev("goTo('machines'); true");
  await c.dort(400);
  await c.ev('openAddWizard(UI.companyId, UI.categories); true');
  await c.attendre('#f-name');
  await c.dort(800);
}
// Défile pour amener un élément en haut de la zone qui défile de la fenêtre d'ajout.
const enHaut = (c, sel) => c.voir(sel, 'start');

export const SCENARIOS = [
  // ─────────────────────────────────────────────── Ajouter une machine ou un véhicule
  {
    id: 'mac-ajouter-machine',
    etapes: [
      // 1. L'écran Machines : le bouton « Ajouter une machine ».
      { nom: 'liste', ecran: 'bureau', async jouer(c) {
        await listeMachines(c);
        await c.repere('#fleet-add', 1, { cote: 'gauche' });
        await toutDansLaZone(c, ['#fleet-add'], '.parc-section');
        return c.zoneJusqua('.parc-section', '#fleet-search', 22);
      } },
      // 2. Les deux grandes cartes « Machine / Engin de chantier » et « Véhicule roulant / Fourgon ».
      { nom: 'type', ecran: 'bureau', async jouer(c) {
        await fenetreAjout(c);
        await c.marquer('#f-kind-cards', 'types', 'parent');
        await c.repere('[data-aide="types"]', 2, { cote: 'gauche-centre', marge: 6 });
        await toutDansLaZone(c, ['[data-aide="types"]'], ADD);
        return zoneEntre(c, '[data-aide="types"]', '#f-name', ADD, 24);
      } },
      // 3. Nom, catégorie, relevé actuel du compteur.
      { nom: 'identite', ecran: 'bureau', async jouer(c) {
        await fenetreAjout(c);
        await c.marquer('#f-name', 'nom', 'parent');
        await c.marquer('#f-category', 'categorie', 'parent');
        await c.marquer('#f-current-hours', 'releve', 'parent');
        await enHaut(c, '[data-aide="nom"]');
        await c.dort(300);
        await c.repere('[data-aide="nom"]', 3, { cote: 'gauche-centre', marge: 6 });
        await c.repere('[data-aide="categorie"]', 3, { cote: 'droite', marge: 6 });
        await c.repere('[data-aide="releve"]', 3, { cote: 'gauche-centre', marge: 6 });
        await toutDansLaZone(c, ['[data-aide="nom"]', '[data-aide="categorie"]', '[data-aide="releve"]'], ADD);
        return zoneEntre(c, '[data-aide="nom"]', '[data-aide="releve"]', ADD, 22);
      } },
      // 4. Le mode de suivi et les tâches de maintenance.
      { nom: 'plan', ecran: 'bureau', async jouer(c) {
        await fenetreAjout(c);
        await c.marquer('input[name="tm"]', 'modes', '.grid');
        await c.marquer('#f-tasks', 'taches', 'parent');
        await enHaut(c, SECTION(3));
        await c.dort(300);
        await c.repere('[data-aide="modes"]', 4, { cote: 'gauche-centre', marge: 6 });
        await c.repere('[data-aide="taches"]', 4, { cote: 'gauche-centre', marge: 6 });
        await toutDansLaZone(c, ['[data-aide="modes"]', '[data-aide="taches"]'], ADD);
        return zoneEntre(c, SECTION(3), SECTION(4), ADD, 22);
      } },
      // 5 et 6. La photo, puis le bouton « Ajouter la machine » (une tâche est saisie, il ne manque plus que la photo : on ne clique pas).
      { nom: 'photo', ecran: 'bureau', async jouer(c) {
        await fenetreAjout(c);
        await c.ev("(() => { const t = document.getElementById('f-tasks'); t.value = 'Vidange, graissage, contrôle des filtres'; t.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
        await c.dort(400);
        await c.marquer('#pick-photo-btn', 'choisir');
        await c.marquer('#shoot-photo-btn', 'prendre');
        await c.marquer('#step-form button[type="submit"]', 'valider');
        await enHaut(c, SECTION(5));
        await c.ev("document.querySelector('.overlay.machine-modal-add main').scrollTop = 99999; true");
        await c.dort(300);
        await c.repere('[data-aide="choisir"]', 5, { marge: 4 });
        await c.repere('[data-aide="prendre"]', 5, { marge: 4 });
        await c.repere('[data-aide="valider"]', 6, { cote: 'gauche-centre', marge: 6 });
        await toutDansLaZone(c, ['[data-aide="choisir"]', '[data-aide="prendre"]', '[data-aide="valider"]'], ADD);
        return zoneEntre(c, SECTION(5), '[data-aide="valider"]', ADD, 22);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Signaler une panne (téléphone, puis la fenêtre)
  {
    id: 'mac-signaler-panne',
    etapes: [
      // 1. Le bouton + de la barre du bas ouvre la feuille « Actions rapides » : « Signaler une panne ».
      { nom: 'feuille', ecran: 'mobile', async jouer(c) {
        await c.ev("goTo('dashboard'); true");
        await c.dort(600);
        await c.ev('ouvrirFeuilleActions(); true');
        await c.attendre('.plus-sheet [data-action-rapide="panne"]');
        await c.dort(500);
        await c.repere('.plus-sheet [data-action-rapide="panne"]', 1, { marge: 3 });
        await toutDansLaZone(c, ['.plus-sheet [data-action-rapide="panne"]'], '.plus-sheet');
        return c.zone('.plus-sheet', 10);
      } },
      // 2. Le choix de la machine, avec son champ de recherche.
      { nom: 'machine', ecran: 'mobile', async jouer(c) {
        await c.ev("goTo('dashboard'); choisirMachineRapide(trad('Panne : quelle machine ?'), (m) => ouvrirSignalerPanne(m)); true");
        await c.attendre('#picker-recherche');
        await c.dort(500);
        await c.repere('#picker-recherche', 2, { marge: 4, cote: 'gauche-centre' });
        await toutDansLaZone(c, ['#picker-recherche'], '.saisie-picker');
        return c.zone('.saisie-picker', 14);
      } },
      // 3, 4 et 5. La fenêtre de signalement : description, gravité, arrêt, envoi.
      { nom: 'fenetre', ecran: 'mobile', async jouer(c) {
        await c.ev('ouvrirSignalerPanne(UI.machines[0]); true');
        await c.attendre('#panne-desc');
        await c.dort(500);
        const texte = c.langue === 'en' ? 'Oil leak under the engine' : "Fuite d'huile sous le moteur";
        await c.ev(`(() => { const t = document.getElementById('panne-desc'); t.value = ${JSON.stringify(texte)}; t.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
        await c.marquer('input[name="panne-gravite"]', 'gravite', 'div');
        await c.marquer('#panne-arret', 'arret', 'label');
        await c.repere('#panne-desc', 3, { marge: 1, cote: 'gauche-centre' });
        await c.repere('[data-aide="gravite"]', 4, { marge: 4, cote: 'gauche-centre' });
        await c.repere('[data-aide="arret"]', 4, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#panne-envoyer', 5, { marge: 4 });
        await toutDansLaZone(c, ['#panne-desc', '[data-aide="gravite"]', '[data-aide="arret"]', '#panne-envoyer'], '.panne-modal');
        return c.zone('.panne-modal', 16);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Importer des machines depuis un fichier CSV
  {
    id: 'mac-importer-csv',
    etapes: [
      // 1. Le bouton « Importer » de l'écran Machines.
      { nom: 'bouton', ecran: 'bureau', async jouer(c) {
        await listeMachines(c);
        await c.repere('#fleet-import', 1, { cote: 'gauche' });
        await toutDansLaZone(c, ['#fleet-import'], '.parc-section');
        return c.zoneJusqua('.parc-section', '#fleet-search', 22);
      } },
      // 2 et 3. La première fenêtre : « Télécharger un modèle », puis la zone « Choisir un fichier… ».
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('machines'); ouvrirImportMachines(); true");
        await c.attendre('#imp-modele');
        await c.dort(600);
        await c.repere('#imp-modele', 2, { cote: 'gauche-centre', marge: 4 });
        await c.repere('#imp-zone', 3, { cote: 'gauche-centre', marge: 4 });
        await toutDansLaZone(c, ['#imp-modele', '#imp-zone'], '.import-csv-modal');
        return c.zone('.import-csv-modal', 30);
      } },
      // 4. L'aperçu : un petit fichier d'exemple est injecté (rien n'est créé).
      { nom: 'apercu', ecran: 'bureau', async jouer(c) {
        const en = c.langue === 'en';
        const NOMS = en ? ['Mini excavator 1.8 t', 'Scissor lift', 'Excavator 1.7 t'] : ['Mini-pelle 1,8 t', 'Nacelle ciseaux', 'Pelle 1,7 t'];
        const CATS = en ? ['Excavators', 'Excavators', 'Generators'] : ['Pelles', 'Pelles', 'Groupes électrogènes'];
        await c.ev("goTo('machines'); ouvrirImportMachines(); true");
        await c.attendre('#imp-fichier');
        await c.dort(500);
        await c.ev(`(() => {
          const csv = ['Nom;Code interne;Marque;Modèle;N° de série;Catégorie;Type;Compteur actuel',
            '${NOMS[0]};G-21;TERRAX;T18;DEMO-T18-0120;${CATS[0]};machine;640',
            '${NOMS[2]};G-24;TERRAX;T17-3;DEMO-T17-0417;${CATS[0]};machine;1250',
            ';G-25;VOLTA;G30;DEMO-G30-0007;${CATS[2]};machine;90'].join('\\n');
          const dt = new DataTransfer(); dt.items.add(new File([csv], 'mon-parc.csv', { type: 'text/csv' }));
          const inp = document.getElementById('imp-fichier'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
          return true; })()`);
        await c.attendre('.import-resume');
        await c.dort(800);
        await c.repere('.import-resume', 4, { cote: 'gauche', marge: 5 });
        await toutDansLaZone(c, ['.import-resume'], '.import-csv-modal');
        return c.zone('.import-csv-modal', 24);
      } },
    ],
  },
  // ─────────────────────────────────────────────── QR code d'une machine
  {
    id: 'mac-qr-code',
    etapes: [
      // 1. La carte : toucher la photo ou le nom ouvre la fiche.
      { nom: 'carte', ecran: 'bureau', async jouer(c) {
        await listeMachines(c);
        await c.attendre('article[data-machine-id="m1"] .mstrip-identite');
        await c.repere('article[data-machine-id="m1"] .mstrip-identite', 1, { marge: 4 });
        return c.zone('article[data-machine-id="m1"]', 18);
      } },
      // 2. La barre d'outils de la fiche : « QR code ».
      { nom: 'fiche', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('machines'); openPlanView(UI.machines.find((m) => m.id === 'm1'), UI.companyId, UI.categories); true");
        await c.attendre('#plan-qr-code');
        await c.dort(700);
        await c.repere('#plan-qr-code', 2, { marge: 4 });
        await toutDansLaZone(c, ['#plan-qr-code'], '.fm-toolbar');
        return c.zone('.fm-toolbar', 44);
      } },
      // 3. La fenêtre « QR code » : « Imprimer » et « Télécharger ».
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('machines'); ouvrirQrMachine(UI.machines.find((m) => m.id === 'm1')); true");
        await c.attendre('#qr-imprimer');
        await c.dort(1200);
        await c.repere('#qr-imprimer', 3, { marge: 4 });
        await c.repere('#qr-telecharger', 3, { marge: 4 });
        await toutDansLaZone(c, ['#qr-imprimer', '#qr-telecharger'], '.qr-modal .modal');
        return c.zone('.qr-modal .modal', 24);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Archiver ou restaurer une machine
  {
    id: 'mac-archiver-restaurer',
    etapes: [
      // 2. Tout en bas de « Modifier une machine » : « Archiver cette machine ».
      { nom: 'archiver', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('machines'); true");
        await c.dort(500);
        await c.ev("openMachineModal(UI.companyId, UI.categories, UI.machines.find((m) => m.id === 'm1')); true");
        await c.attendre('#archive-machine');
        await c.dort(700);
        await c.voir('#delete-machine', 'end');
        await c.dort(300);
        await c.repere('#archive-machine', 2, { cote: 'gauche-centre', marge: 5 });
        await toutDansLaZone(c, ['#archive-machine'], '.overlay .modal');
        return zoneEntre(c, '#submit-add', '#archive-machine', '.overlay .modal', 22);
      } },
      // 4. Le bas de l'écran Machines : la section repliable des machines archivées, avec « Restaurer ».
      { nom: 'archivees', ecran: 'bureau', async jouer(c) {
        const en = c.langue === 'en';
        const archivees = en
          ? [{ id: 'a1', name: 'Telehandler', brand_model: 'BOREAL BT-30' }, { id: 'a2', name: 'Pickup truck', brand_model: 'ROUTIER P-4' }]
          : [{ id: 'a1', name: 'Chariot télescopique', brand_model: 'BOREAL BT-30' }, { id: 'a2', name: 'Camionnette plateau', brand_model: 'ROUTIER P-4' }];
        await c.ev(`UI.machinesArchivees = ${JSON.stringify(archivees)}; goTo('machines'); true`);
        await c.attendre('#machines-archivees');
        await c.dort(500);
        await c.ev("document.querySelector('#machines-archivees details').open = true; true");
        await c.dort(400);
        await c.voir('#machines-archivees', 'end');
        await c.dort(300);
        await c.repere('[data-restaurer-machine="a1"]', 4, { marge: 4 });
        await toutDansLaZone(c, ['[data-restaurer-machine="a1"]'], '#machines-archivees');
        return c.zone('#machines-archivees', 16);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Retrouver une machine : recherche et filtres
  {
    id: 'mac-rechercher-filtrer',
    etapes: [
      // 2. La recherche : on tape quelques lettres, la liste se réduit.
      { nom: 'recherche', ecran: 'bureau', async jouer(c) {
        await listeMachines(c);
        const mot = c.langue === 'en' ? 'dump' : 'benne';
        await c.ev(`(() => { const i = document.getElementById('fleet-search'); i.value = ${JSON.stringify(mot)}; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
        await c.dort(700);
        await c.repere('#fleet-search', 2, { cote: 'gauche-centre', marge: 4 });
        await toutDansLaZone(c, ['#fleet-search'], '.parc-section');
        return zoneEntre(c, '#fleet-search', '#fleet-list article.mstrip', '.parc-section', 16);
      } },
      // 3. Les boutons d'état : « En retard » est actif.
      { nom: 'etat', ecran: 'bureau', async jouer(c) {
        await listeMachines(c);
        await c.ev("document.querySelector('.parc-pill[data-status=\"late\"]').click(); true");
        await c.dort(700);
        await c.repere('.ui-puces', 3, { cote: 'gauche-centre', marge: 5 });
        await toutDansLaZone(c, ['.ui-puces'], '.parc-section');
        return zoneEntre(c, '#fleet-search', '#fleet-list article.mstrip', '.parc-section', 16);
      } },
      // 5. Les boutons « Cartes » et « Tuiles » (ordinateur) : l'affichage en tuiles est choisi.
      { nom: 'affichage', ecran: 'bureau', async jouer(c) {
        await listeMachines(c);
        await c.ev("document.querySelector('[data-parc-vue=\"tuiles\"]').click(); true");
        await c.dort(900);
        await c.repere('.parc-vue', 5, { marge: 5 });
        await toutDansLaZone(c, ['.parc-vue'], '.parc-section');
        return zoneEntre(c, '.parc-section', '#fleet-list', '.parc-section', 22);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Comprendre le tableau de bord
  {
    id: 'mac-tableau-de-bord',
    etapes: [
      // 1. Les points de vigilance.
      { nom: 'vigilance', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('dashboard'); true");
        await c.attendre('#accueil-vigilance .vig-liste');
        await c.dort(1500);
        // La tuile « Coûts élevés » dépend de données de coûts que le parc fictif n'a pas (elle afficherait « Indisponible ») : elle est facultative selon l'offre, on la retire de l'image.
        await c.ev("(() => { const t = document.getElementById('vig-couts'); if (t) t.remove(); return true; })()");
        await c.dort(200);
        await c.repere('#accueil-vigilance .vig-liste', 1, { cote: 'gauche-centre', marge: 5 });
        await toutDansLaZone(c, ['#accueil-vigilance .vig-liste'], '#accueil-vigilance');
        return c.zone('#accueil-vigilance', 20);
      } },
      // 2. « À traiter en priorité » : « Marquer fait » et « Détails ».
      { nom: 'priorites', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('dashboard'); true");
        await c.attendre('[data-priority-done]');
        await c.dort(1200);
        await c.marquer('[data-priority-done]', 'prio', 'section');
        await c.repere('[data-priority-done]', 2, { marge: 4 });
        await c.repere('[data-priority-details]', 2, { marge: 4 });
        await toutDansLaZone(c, ['[data-priority-done]', '[data-priority-details]'], '[data-aide="prio"]');
        return c.zone('[data-aide="prio"]', 18);
      } },
      // 4. « Échéances d'entretien ».
      { nom: 'echeances', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('dashboard'); true");
        await c.attendre('#echeances-zone');
        await c.dort(1200);
        await c.marquer('#echeances-zone', 'ech', 'section');
        await c.voir('[data-aide="ech"]', 'start');
        await c.dort(300);
        await c.repere('#echeances-zone', 4, { cote: 'gauche-centre', marge: 5 });
        await toutDansLaZone(c, ['#echeances-zone'], '[data-aide="ech"]');
        return c.zone('[data-aide="ech"]', 22);
      } },
      // 5. « Canaux de rappels » et son bouton « Régler ».
      { nom: 'rappels', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('dashboard'); true");
        await c.attendre('#view-root [data-nav="reminders"]');
        await c.dort(1200);
        await c.marquer('#view-root [data-nav="reminders"]', 'rap', 'section');
        await c.voir('[data-aide="rap"]', 'center');
        await c.dort(300);
        await c.repere('#view-root [data-nav="reminders"]', 5, { marge: 4 });
        await toutDansLaZone(c, ['#view-root [data-nav="reminders"]'], '[data-aide="rap"]');
        return c.zone('[data-aide="rap"]', 18);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Lire la fiche détaillée d'une machine
  {
    id: 'mac-fiche-machine',
    etapes: [
      // 2. La barre d'outils, en haut de la fiche.
      { nom: 'barre', ecran: 'bureau', async jouer(c) {
        await ouvrirFiche(c);
        await c.repere('#edit-from-plan', 2, { marge: 4 });
        await c.repere('#plan-qr-code', 2, { marge: 4 });
        await c.repere('#log-from-plan', 2, { marge: 4 });
        await toutDansLaZone(c, ['#edit-from-plan', '#plan-qr-code', '#log-from-plan'], '.fm-toolbar');
        return c.zone('.fm-toolbar', 44);
      } },
      // 3. Le bandeau de la machine.
      { nom: 'bandeau', ecran: 'bureau', async jouer(c) {
        await ouvrirFiche(c);
        await c.repere('.fm2-hero', 3, { marge: 5 });
        await toutDansLaZone(c, ['.fm2-hero'], '.overlay.plan-modal');
        return c.zone('.fm2-hero', 24);
      } },
      // 4. Le tableau de référence entretien.
      { nom: 'taches', ecran: 'bureau', async jouer(c) {
        await ouvrirFiche(c);
        await c.attendre('.ref-table');
        await c.voir('.ref-table', 'start');
        await c.dort(300);
        await c.repere('.ref-table', 4, { cote: 'gauche-centre', marge: 5 });
        await toutDansLaZone(c, ['.ref-table'], '.overlay.plan-modal');
        return c.zone('.ref-table', 44);
      } },
      // 5. L'historique des entretiens (des entretiens fictifs remplacent la lecture en base).
      { nom: 'historique', ecran: 'bureau', async jouer(c) {
        await ouvrirFiche(c);
        await c.voir('#history-section', 'start');
        await c.dort(300);
        await c.repere('#history-section', 5, { cote: 'gauche-centre', marge: 5 });
        await toutDansLaZone(c, ['#history-section'], '.overlay.plan-modal');
        return c.zone('#history-section', 44);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Exporter la liste des machines en CSV
  {
    id: 'mac-exporter-parc',
    etapes: [
      // 2. Le bouton « Exporter (CSV) » en haut de la liste.
      { nom: 'bouton', ecran: 'bureau', async jouer(c) {
        await listeMachines(c);
        await c.repere('#fleet-export', 2, { cote: 'gauche' });
        await toutDansLaZone(c, ['#fleet-export'], '.parc-section');
        return c.zoneJusqua('.parc-section', '#fleet-search', 22);
      } },
      // 3, 4 et 5. La fenêtre : contenu, format, « Télécharger » (on ne clique pas).
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('machines'); ouvrirModaleExport(); true");
        await c.attendre('#export-go');
        await c.dort(600);
        await c.marquer('input[name="export-contenu"]', 'contenu', '.ui-champ-groupe');
        await c.marquer('input[name="export-format"]', 'format', '.ui-champ-groupe');
        await c.repere('[data-aide="contenu"]', 3, { cote: 'gauche', marge: 6 });
        await c.repere('[data-aide="format"]', 4, { cote: 'gauche', marge: 6 });
        await c.repere('#export-go', 5, { marge: 4 });
        await toutDansLaZone(c, ['[data-aide="contenu"]', '[data-aide="format"]', '#export-go'], '.export-modal');
        return c.zone('.export-modal', 30);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Supprimer définitivement une machine
  {
    id: 'mac-supprimer-machine',
    etapes: [
      // 2. Tout en bas de « Modifier une machine » : « Supprimer cette machine » (on ne clique pas : la confirmation est une fenêtre du navigateur).
      { nom: 'supprimer', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('machines'); true");
        await c.dort(500);
        await c.ev("openMachineModal(UI.companyId, UI.categories, UI.machines.find((m) => m.id === 'm1')); true");
        await c.attendre('#delete-machine');
        await c.dort(700);
        await c.voir('#delete-machine', 'end');
        await c.dort(300);
        await c.repere('#delete-machine', 2, { cote: 'droite', marge: 5 });
        await toutDansLaZone(c, ['#delete-machine'], '.overlay .modal');
        return zoneEntre(c, '#submit-add', '#delete-machine', '.overlay .modal', 22);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Choisir ou créer la catégorie d'une machine
  {
    id: 'mac-categorie',
    etapes: [
      // 3. « Autre… » choisi : le champ du nom de la catégorie apparaît.
      { nom: 'autre', ecran: 'bureau', async jouer(c) {
        await fenetreAjout(c);
        await c.ev(`(() => { const s = document.getElementById('f-category'); s.value = CATEGORIE_AUTRE; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
        await c.dort(500);
        const nom = c.langue === 'en' ? 'BRUSH CUTTER' : 'DÉBROUSSAILLEUSE';
        await c.ev(`(() => { const i = document.getElementById('f-category-autre'); i.value = ${JSON.stringify(nom)}; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
                await c.marquer('#f-category', 'cat', 'parent');
        await enHaut(c, '[data-aide="cat"]');
        await c.dort(300);
        await c.repere('#f-category-autre', 3, { cote: 'gauche-centre', marge: 6 });
        await toutDansLaZone(c, ['#f-category-autre'], ADD);
        return zoneEntre(c, '[data-aide="cat"]', '#f-category-autre', ADD, 20);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Le bouton « Ajouter la machine » est grisé
  {
    id: 'mac-bouton-ajouter-grise',
    etapes: [
      // 1. La phrase sous le formulaire et le bouton grisé.
      { nom: 'message', ecran: 'bureau', async jouer(c) {
        await fenetreAjout(c);
        await c.marquer('#f-manque', 'manque');
        await c.marquer('#step-form button[type="submit"]', 'valider');
        await c.ev("document.querySelector('.overlay.machine-modal-add main').scrollTop = 99999; true");
        await c.dort(300);
        await c.repere('#f-manque', 1, { cote: 'gauche-centre', marge: 5 });
        await c.repere('[data-aide="valider"]', 1, { cote: 'gauche-centre', marge: 5 });
        await toutDansLaZone(c, ['#f-manque', '[data-aide="valider"]'], ADD);
        return zoneEntre(c, '#f-manque', '[data-aide="valider"]', ADD, 40);
      } },
      // 2. Une tâche saisie : le plan d'entretien est donné.
      { nom: 'taches', ecran: 'bureau', async jouer(c) {
        await fenetreAjout(c);
        const t = c.langue === 'en' ? 'Oil change, greasing, filter check' : 'Vidange, graissage, contrôle des filtres';
        await c.ev(`(() => { const e = document.getElementById('f-tasks'); e.value = ${JSON.stringify(t)}; e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
        await c.dort(400);
        await c.marquer('#f-tasks', 'taches', 'parent');
        await enHaut(c, SECTION(4));
        await c.dort(300);
        await c.repere('[data-aide="taches"]', 2, { cote: 'gauche-centre', marge: 6 });
        await toutDansLaZone(c, ['[data-aide="taches"]'], ADD);
        return zoneEntre(c, SECTION(4), SECTION(4), ADD, 26);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Trouver le manuel de sa machine sur internet
  {
    id: 'mac-chercher-manuel-web',
    etapes: [
      // 1. Marque, modèle et année remplis.
      { nom: 'identite', ecran: 'bureau', async jouer(c) {
        await fenetreAjout(c);
        await c.ev(`(() => { const v = { 'f-brand': 'TERRAX', 'f-model': 'T17-3', 'f-year': '2019' }; for (const k in v) { const e = document.getElementById(k); e.value = v[k]; e.dispatchEvent(new Event('input', { bubbles: true })); } return true; })()`);
        await c.dort(400);
        await c.marquer('#f-brand', 'marque', 'parent');
        await c.marquer('#f-year', 'annee', 'parent');
        await enHaut(c, '[data-aide="marque"]');
        await c.dort(300);
        await c.repere('[data-aide="marque"]', 1, { cote: 'gauche-centre', marge: 4 });
        await c.repere('#f-model', null, { marge: 4 });
        await c.repere('[data-aide="annee"]', null, { marge: 4 });
        await toutDansLaZone(c, ['[data-aide="marque"]', '#f-model', '[data-aide="annee"]'], ADD);
        return zoneEntre(c, '[data-aide="marque"]', '[data-aide="annee"]', ADD, 44, 22);
      } },
      // 2 et 3. Les liens de recherche, sous la zone du carnet (l'encadré commercial qui les précède reste hors de l'image).
      { nom: 'liens', ecran: 'bureau', async jouer(c) {
        await fenetreAjout(c);
        await enHaut(c, '#lien-manuel-web');
        await c.dort(300);
        await c.repere('#lien-manuel-web', 2, { cote: 'gauche-centre', marge: 5 });
        await c.repere('#lien-manuel-atelier', 3, { cote: 'gauche-centre', marge: 5 });
        await toutDansLaZone(c, ['#lien-manuel-web', '#lien-manuel-atelier'], ADD);
        return zoneEntre(c, '#lien-manuel-web', '#lien-manuel-atelier', ADD, 44);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Mon import CSV est refusé : les erreurs courantes
  {
    id: 'mac-import-erreurs',
    etapes: [
      // 1. Fichier refusé en entier : message rouge sous la zone de dépôt (une colonne « Nom » introuvable).
      { nom: 'refuse', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('machines'); ouvrirImportMachines(); true");
        await c.attendre('#imp-fichier');
        await c.dort(500);
        await c.ev(`(() => {
          const csv = ${JSON.stringify(c.langue === 'en' ? 'Code;Brand;Type' : 'Code;Marque;Modèle')} + '\\nG-21;TERRAX;T18';
          const dt = new DataTransfer(); dt.items.add(new File([csv], 'mon-parc.csv', { type: 'text/csv' }));
          const inp = document.getElementById('imp-fichier'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
          return true; })()`);
        await c.dort(900);
        await c.repere('#imp-msg', 1, { cote: 'gauche-centre', marge: 6 });
        await c.repere('#imp-zone', 1, { cote: 'gauche-centre', marge: 4 });
        await toutDansLaZone(c, ['#imp-msg', '#imp-zone'], '.import-csv-modal');
        return c.zone('.import-csv-modal', 30);
      } },
      // 2. Des lignes en erreur, chacune avec son message.
      { nom: 'lignes', ecran: 'bureau', async jouer(c) {
        const en = c.langue === 'en';
        const n = en ? ['Mini excavator 1.8 t', 'Dump truck', 'Telehandler'] : ['Mini-pelle 1,8 t', 'Camion plateau', 'Chariot télescopique'];   // n[0] inutilisé
        await c.ev("goTo('machines'); ouvrirImportMachines(); true");
        await c.attendre('#imp-fichier');
        await c.dort(500);
        await c.ev(`(() => {
          const csv = ['Nom;Code interne;Marque;Modèle;N° de série;Type;Compteur actuel;Date de mise en service',
            ';G-22;VOLTA;G30;DEMO-G30-0007;machine;90;2020-06-01',
            '${n[1]};G-23;ROUTIER;D-6;EF-456-GH;${en ? 'boat' : 'bateau'};52300;2022-01-10',
            '${n[2]};G-24;BOREAL;BT-30;DEMO-BT30-0044;machine;310;31/02/2023'].join('\\n');
          const dt = new DataTransfer(); dt.items.add(new File([csv], 'mon-parc.csv', { type: 'text/csv' }));
          const inp = document.getElementById('imp-fichier'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
          return true; })()`);
        await c.attendre('.import-apercu');
        await c.dort(800);
        await c.repere('.import-apercu', 2, { cote: 'gauche', marge: 5 });
        await toutDansLaZone(c, ['.import-apercu'], '.import-csv-modal');
        return c.zone('.import-csv-modal', 30);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Annuler un import de machines
  {
    id: 'mac-annuler-import',
    etapes: [
      // 2. Le bandeau « Import récent » en haut de l'écran Machines (mémorisé par l'appareil, on le pose comme l'application le ferait).
      { nom: 'bandeau', ecran: 'bureau', async jouer(c) {
        await c.ev("try { localStorage.setItem('kalea.dernier-import.' + UI.companyId, JSON.stringify({ lot: 'demo-lot', at: Date.now() - 3600000, crees: 12 })); } catch (e) {} UI.filters = null; goTo('machines'); true");
        await c.attendre('#imp-bandeau');
        await c.dort(600);
        await c.repere('#imp-annuler-dernier', 2, { cote: 'gauche-centre', marge: 4 });
        await c.repere('#imp-masquer', null, { marge: 4 });
        await toutDansLaZone(c, ['#imp-annuler-dernier', '#imp-masquer'], '#imp-bandeau');
        return zoneEntre(c, '#imp-bandeau', '#imp-bandeau', '#imp-bandeau', 44, 18);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Scanner un QR code pour ouvrir une machine
  {
    id: 'mac-scanner-qr',
    etapes: [
      // 1. Le bouton « Scanner un QR » de l'écran Machines.
      { nom: 'bouton', ecran: 'bureau', async jouer(c) {
        await listeMachines(c);
        await c.repere('#fleet-scanner', 1, { cote: 'gauche', marge: 4 });
        await toutDansLaZone(c, ['#fleet-scanner'], '.parc-section');
        return c.zoneJusqua('.parc-section', '#fleet-search', 22);
      } },
      // 3. La fenêtre du scanner : une image de caméra est simulée (le navigateur sans caméra afficherait seulement un refus d'accès).
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await c.ev(`(() => {
          const cv = document.createElement('canvas'); cv.width = 480; cv.height = 480;
          const g = cv.getContext('2d');
          const grad = g.createLinearGradient(0, 0, 480, 480); grad.addColorStop(0, '#46535f'); grad.addColorStop(1, '#1b232b');
          g.fillStyle = grad; g.fillRect(0, 0, 480, 480);
          g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 6; g.lineCap = 'round';
          [[110, 110, 1, 1], [370, 110, -1, 1], [110, 370, 1, -1], [370, 370, -1, -1]].forEach(([x, y, a, b]) => { g.beginPath(); g.moveTo(x + 60 * a, y); g.lineTo(x, y); g.lineTo(x, y + 60 * b); g.stroke(); });
          const flux = cv.captureStream(10);
          setInterval(() => { g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 1, 1); }, 100);
          navigator.mediaDevices.getUserMedia = async () => flux;
          goTo('machines'); ouvrirScannerQr();
          return true; })()`);
        await c.attendre('#scan-zone video');
        await c.ev('document.activeElement && document.activeElement.blur && document.activeElement.blur(); true');
        await c.dort(1200);
        await c.marquer('#scan-zone', 'scanmodal', '.modal');
        await c.repere('#scan-zone', 3, { cote: 'gauche-centre', marge: 5 });
        await toutDansLaZone(c, ['#scan-zone'], '[data-aide="scanmodal"]');
        return c.zone('[data-aide="scanmodal"]', 46);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Suivre et résoudre une panne signalée
  {
    id: 'mac-suivre-pannes',
    etapes: [
      // 1. La tuile « Pannes » du tableau de bord (des pannes fictives sont fournies).
      { nom: 'tuile', ecran: 'bureau', async jouer(c) {
        await pannesFictives(c);
        await c.ev("goTo('dashboard'); true");
        await c.attendre('#accueil-vigilance .vig-liste');
        await c.dort(1500);
        await c.ev("(() => { const t = document.getElementById('vig-couts'); if (t) t.remove(); return true; })()");
        await c.dort(200);
        await c.repere('#vig-pannes', 1, { marge: 4 });
        await toutDansLaZone(c, ['#vig-pannes'], '#accueil-vigilance');
        return c.zone('#accueil-vigilance', 20);
      } },
      // 2. La liste « Pannes signalées » : les boutons « Ouvertes » et « Résolues ».
      { nom: 'liste', ecran: 'bureau', async jouer(c) {
        await pannesFictives(c);
        await c.ev('ouvrirListePannes(); true');
        await c.attendre('#pannes-liste .panne-ligne');
        await c.dort(600);
        await c.repere('#pannes-filtres', 2, { cote: 'gauche-centre', marge: 5 });
        await toutDansLaZone(c, ['#pannes-filtres'], '.panne-liste-modal');
        return c.zone('.panne-liste-modal', 40);
      } },
      // 3 et 4. Les boutons d'action de chaque ligne : « Prendre en charge » (3) sur une panne ouverte, « Marquer résolue » (4) sur une panne prise en charge.
      { nom: 'actions', ecran: 'bureau', async jouer(c) {
        await pannesFictives(c);
        await c.ev('ouvrirListePannes(); true');
        await c.attendre('#pannes-liste .panne-ligne');
        await c.dort(600);
        await c.repere('[data-panne-statut="prise_en_charge"]', 3, { cote: 'gauche-centre', marge: 4 });
        await c.repere('[data-panne-statut="resolue"]', 4, { cote: 'gauche-centre', marge: 4 });
        await toutDansLaZone(c, ['[data-panne-statut="prise_en_charge"]', '[data-panne-statut="resolue"]'], '.panne-liste-modal');
        return c.zone('.panne-liste-modal', 40);
      } },
      // 4. La fenêtre « Résoudre la panne » (on ne clique pas sur « Marquer résolue »).
      { nom: 'resoudre', ecran: 'bureau', async jouer(c) {
        await pannesFictives(c);
        await c.ev("ouvrirResolutionPanne(UI.pannes.find((p) => p.status === 'prise_en_charge'), () => {}); true");
        await c.attendre('#resolution-heures');
        await c.dort(600);
        await c.repere('#resolution-heures', 4, { cote: 'gauche-centre', marge: 4 });
        await c.repere('#resolution-note', 4, { cote: 'gauche-centre', marge: 4 });
        await c.repere('#resolution-valider', 4, { cote: 'droite', marge: 4 });
        await toutDansLaZone(c, ['#resolution-heures', '#resolution-note', '#resolution-valider'], '.panne-modal');
        return c.zone('.panne-modal', 40);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Lire les statistiques de votre parc
  {
    id: 'mac-statistiques',
    etapes: [
      // 2 et 3. La période et les filtres, en haut de l'écran.
      { nom: 'filtres', ecran: 'bureau', async jouer(c) {
        await donneesStats(c);
        await c.ev("goTo('stats'); true");
        await c.attendre('.stat-kpis');
        await c.dort(900);
        await c.marquer('[data-stats-periode]', 'periode', 'div');
        await c.repere('[data-aide="periode"]', 2, { cote: 'gauche', marge: 5 });
        await c.repere('#stats-categorie', 3, { marge: 4 });
        await c.repere('#stats-machine', 3, { marge: 4 });
        await toutDansLaZone(c, ['[data-aide="periode"]', '#stats-categorie', '#stats-machine'], '#view-root');
        return zoneEntre(c, '[data-aide="periode"]', '[data-stats-onglet]', '#view-root', 44, 21);
      } },
      // 4. L'onglet Coûts : les tuiles de synthèse.
      { nom: 'couts', ecran: 'bureau', async jouer(c) {
        await donneesStats(c);
        await c.ev("goTo('stats'); true");
        await c.attendre('.stat-kpis');
        await c.dort(900);
        await c.ev("(() => { const o = document.querySelector('[data-stats-onglet=\"couts\"]'); if (o) o.click(); return true; })()");
        await c.dort(900);
        await c.repere('.stat-kpis', 4, { cote: 'gauche', marge: 5 });
        await toutDansLaZone(c, ['.stat-kpis'], '#view-root');
        return zoneEntre(c, '[data-stats-onglet]', '.stat-carte', '#view-root', 16);
      } },
      // 5. L'onglet Maintenance.
      { nom: 'maintenance', ecran: 'bureau', async jouer(c) {
        await donneesStats(c);
        await c.ev("goTo('stats'); true");
        await c.attendre('.stat-kpis');
        await c.dort(900);
        await c.ev("(() => { const o = document.querySelector('[data-stats-onglet=\"maintenance\"]'); if (o) o.click(); return true; })()");
        await c.dort(900);
        await c.repere('.stat-kpis', 5, { cote: 'gauche', marge: 5 });
        await toutDansLaZone(c, ['.stat-kpis'], '#view-root');
        return zoneEntre(c, '[data-stats-onglet]', '.stat-carte', '#view-root', 16);
      } },
    ],
  },
  // ─────────────────────────────────────────────── Comprendre le plan proposé après le dépôt d'un carnet
  {
    id: 'mac-plan-propose',
    etapes: [
      // 2. Les échéances détectées dans le manuel (le résultat de l'analyse est simulé : on ne dépose pas de vrai carnet).
      { nom: 'echeances', ecran: 'bureau', async jouer(c) {
        await ecranPlanPropose(c);
        await c.ev("document.querySelectorAll('.overlay.machine-modal, .overlay.machine-modal *').forEach((e) => { e.scrollTop = 0; }); true");
        await c.dort(300);
        await c.marquer('.pplan-table-wrap', 'tableau');
        await c.repere('[data-aide="tableau"]', 2, { cote: 'gauche-centre', marge: 5 });
        await toutDansLaZone(c, ['[data-aide="tableau"]'], '.overlay.machine-modal > div');
        return zoneEntre(c, '.pplan-resume', '.pplan-ajouter', '.overlay.machine-modal > div', 40, 66);
      } },
      // 3. Les trois choix : « Suivre ce plan », « Modifier ce plan », « Faire mon propre plan ».
      { nom: 'choix', ecran: 'bureau', async jouer(c) {
        await ecranPlanPropose(c);
        await c.voir('.pplan-choix', 'end');
        await c.dort(300);
        await c.repere('.pplan-choix', 3, { cote: 'gauche-centre', marge: 6 });
        await toutDansLaZone(c, ['.pplan-choix'], '.overlay.machine-modal > div');
        return zoneEntre(c, '.pplan-choix', '.pplan-choix', '.overlay.machine-modal > div', 40, 16);
      } },
    ],
  },
];

// Ouvre l'écran « Plan proposé » : l'analyse du carnet (appel serveur) est remplacée par un résultat fictif, on dépose un faux PDF.
async function ecranPlanPropose(c) {
  const en = c.langue === 'en';
  const items = en
    ? [['Engine oil change', 'Every 250 h'], ['Greasing', 'Every 50 h'], ['Air filter check', 'Every 500 h'], ['Hydraulic oil change', 'Every 1000 h']]
    : [['Vidange moteur', 'Toutes les 250 h'], ['Graissage', 'Toutes les 50 h'], ['Contrôle du filtre à air', 'Toutes les 500 h'], ['Vidange huile hydraulique', 'Toutes les 1000 h']];
  await c.ev("goTo('machines'); true");
  await c.dort(400);
  await c.ev(`(() => {
    const items = ${JSON.stringify(items)}.map(([label, frequency]) => ({ label, frequency }));
    window.brancherCarnetPdf = async (overlay, file, contexte, apresAnalyse) => {
      overlay._aiTrackingSuggestion = 'hours'; overlay._aiIntervalHours = 250;
      apresAnalyse({ items, notes: [], taches: items.map((i) => i.label).join(', ') });
    };
    openAddWizard(UI.companyId, UI.categories);
    return true; })()`);
  await c.attendre('#f-manual');
  await c.dort(700);
  await c.ev(`(() => {
    const dt = new DataTransfer(); dt.items.add(new File(['%PDF-1.4'], 'carnet.pdf', { type: 'application/pdf' }));
    const inp = document.getElementById('f-manual'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true; })()`);
  await c.attendre('.pplan-table-wrap');
  await c.dort(900);
}

// Remplace la lecture des tables : chaque table renvoie les lignes données (les filtres de la requête sont ignorés).
async function tables(c, lignesParTable) {
  await c.ev(`(() => {
    const T = ${JSON.stringify(lignesParTable)};
    const METHODES = ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'gt', 'lt', 'is', 'neq', 'not', 'range', 'or', 'ilike', 'like', 'contains', 'filter', 'match', 'insert', 'update', 'delete', 'upsert'];
    sb.from = (t) => { const lignes = T[t] || []; const b = {}; METHODES.forEach((k) => { b[k] = () => b; }); b.single = () => Promise.resolve({ data: lignes[0] || null, error: null }); b.maybeSingle = () => Promise.resolve({ data: lignes[0] || null, error: null }); b.then = (res) => res({ data: lignes, error: null, count: lignes.length }); return b; };
    return true; })()`);
}
// Trois pannes fictives : une ouverte à l'arrêt, une prise en charge à l'arrêt, une résolue.
async function pannesFictives(c) {
  const en = c.langue === 'en';
  const jour = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const lignes = [
    { id: 'b1', company_id: 'demo-societe', machine_id: 'm3', machine_name: en ? 'Dump truck' : 'Camion benne', description: en ? 'Hydraulic leak on the tipping ram' : 'Fuite hydraulique sur le vérin de benne', severity: 'bloquante', stopped: true, status: 'ouverte', reported_at: jour(1), reported_by_name: 'Alex Durand', downtime_hours: null, downtime_cost: null },
    { id: 'b2', company_id: 'demo-societe', machine_id: 'm1', machine_name: en ? 'Excavator 1.7 t' : 'Pelle 1,7 t', description: en ? 'Abnormal noise from the swing motor' : 'Bruit anormal du moteur de rotation', severity: 'importante', stopped: true, status: 'prise_en_charge', reported_at: jour(4), reported_by_name: 'Camille Martin', downtime_hours: null, downtime_cost: null },
    { id: 'b3', company_id: 'demo-societe', machine_id: 'm2', machine_name: en ? 'Wheel loader' : 'Chargeuse sur pneus', description: en ? 'Warning light on the dashboard' : 'Voyant allumé au tableau de bord', severity: 'mineure', stopped: false, status: 'resolue', reported_at: jour(20), reported_by_name: 'Alex Durand', downtime_hours: null, downtime_cost: null },
  ];
  await tables(c, { machine_breakdowns: lignes });
}
// Un an de données fictives pour les statistiques : entretiens, dépannages, coûts d'exploitation et pannes.
async function donneesStats(c) {
  await c.ev(`(() => {
    const ids = ['m1', 'm2', 'm3', 'm4'];
    const date = (m, j) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - m); d.setDate(j); return d.toISOString(); };
    const interventions = []; const couts = []; const pannes = [];
    for (let m = 0; m <= 11; m++) {
      ids.forEach((id, k) => {
        if ((m + k) % 2 === 0) interventions.push({ machine_id: id, kind: 'entretien', parts_cost: 180 + 40 * ((m * 3 + k) % 5), labor_cost: 120 + 30 * ((m + k) % 4), performed_at: date(m, 8 + k), was_late: (m + k) % 5 === 0 });
        if ((m * 2 + k) % 5 === 0) interventions.push({ machine_id: id, kind: 'depannage', parts_cost: 260 + 55 * (m % 4), labor_cost: 140 + 20 * (k % 3), performed_at: date(m, 15 + k), was_late: null });
        couts.push({ machine_id: id, amount: 90 + 25 * ((m + k) % 4), incurred_at: date(m, 20), kind: 'carburant' });
      });
      if (m % 3 === 1) pannes.push({ machine_id: ids[m % 4], status: 'resolue', stopped: true, reported_at: date(m, 10), resolved_at: date(m, 12), downtime_hours: 8 + (m % 3) * 4, downtime_cost: null });
    }
    const T = { interventions, operating_costs: couts, machine_breakdowns: pannes };
    const METHODES = ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'gt', 'lt', 'is', 'neq', 'not', 'range', 'or', 'ilike', 'like', 'contains', 'filter', 'match', 'insert', 'update', 'delete', 'upsert'];
    sb.from = (t) => { const lignes = T[t] || []; const b = {}; METHODES.forEach((k) => { b[k] = () => b; }); b.single = () => Promise.resolve({ data: lignes[0] || null, error: null }); b.maybeSingle = () => Promise.resolve({ data: lignes[0] || null, error: null }); b.then = (res) => res({ data: lignes, error: null, count: lignes.length }); return b; };
    return true; })()`);
}

// Chaque étape commence par traduire les données du parc fictif si l'image est en anglais.
for (const sc of SCENARIOS) for (const e of sc.etapes) { const jouer = e.jouer; e.jouer = async (c) => { await donneesLangue(c); return jouer(c); }; }
