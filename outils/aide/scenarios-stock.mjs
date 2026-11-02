// Scénarios de capture du lot « Stock & SAV, Coûts & TCO, Télémétrie, Support » (voir scenarios.mjs pour la mécanique).
// Le parc fictif de etat-fictif.js n'a ni pièces, ni stock, ni coûts, ni tickets : chaque scénario injecte ici, DANS LA PAGE, des données inventées
// (noms de pièces, magasins, fournisseurs, prix) et remplace sb.from() par une fausse base qui renvoie ces données.
// Les textes injectés suivent la langue de la capture (c.langue) : aucune image anglaise ne doit contenir de français.

async function toutDansLaZone(c, selecteurs, zone) {
  const dehors = await c.horsZone(selecteurs, zone);
  if (dehors.length) throw new Error('éléments repérés hors de la zone photographiée : ' + dehors.join(', '));
}

// Textes inventés, dans la langue de la capture.
function textes(langue) {
  const fr = langue === 'fr';
  return {
    magCentral: fr ? 'Magasin central' : 'Main store',
    magMobile: fr ? 'Fourgon Paul' : "Paul's van",
    pieces: fr
      ? ['Filtre à huile moteur', 'Filtre à air', 'Graisse multi-usage', 'Courroie d\'alternateur', 'Huile hydraulique 46']
      : ['Engine oil filter', 'Air filter', 'Multi-purpose grease', 'Alternator belt', 'Hydraulic oil 46'],
    fournisseurs: fr ? ['Motoculture Pacifique', 'Pièces Services'] : ['Pacific Parts Ltd', 'Parts Services'],
    conditionnement: fr ? 'Boîte de 12' : 'Box of 12',
    // Les machines et catégories fictives de etat-fictif.js sont en français : en anglais on les renomme (aucun français dans une image EN).
    nomsMachines: fr ? null : ['Excavator 1.7 t', 'Wheel loader', 'Dump truck', 'Generator 60 kVA'],
    nomsCategories: fr ? null : ['Excavators', 'Loaders', 'Trucks', 'Generators'],
    bl: fr ? 'BL 4471' : 'Delivery note 4471',
    entretiens: fr
      ? ['Vidange moteur et filtres', 'Graissage général', 'Remplacement flexibles hydrauliques', 'Contrôle freins']
      : ['Engine oil and filter change', 'General greasing', 'Hydraulic hose replacement', 'Brake check'],
    planItems: fr ? ['Vidange moteur', 'Remplacement du filtre à air', 'Graissage général'] : ['Engine oil change', 'Air filter replacement', 'General greasing'],
    tickets: fr
      ? [{ sujet: 'Question sur un plan d\'entretien', st: 'ouvert' }, { sujet: 'Compteur de la chargeuse', st: 'resolu' }]
      : [{ sujet: 'Question about a maintenance plan', st: 'ouvert' }, { sujet: 'Loader meter', st: 'resolu' }],
  };
}

// Installe, DANS LA PAGE : drapeaux de schéma, magasins, catalogue, lignes de stock, fournisseurs ; selon les options, les coûts du parc (prix d'achat, interventions,
// frais d'exploitation, pannes) et des tickets ; puis remplace sb.from() par une fausse base qui sert ces tables en respectant les filtres eq()/in().
async function injecter(c, { mouvements = false, tco = false, tickets = false } = {}) {
  const t = textes(c.langue);
  await c.ev(`(() => {
    // Beaucoup de drapeaux n'existent pas encore dans SCHEMA tant que le serveur n'a pas répondu : on les pose tous (module Stock, TCO, télémétrie, support…).
    Object.keys(SCHEMA).forEach((k) => { if (typeof SCHEMA[k] === 'boolean') SCHEMA[k] = true; });
    ['hasStock', 'hasStockChamps', 'hasStockPackaging', 'hasStockInventaire', 'hasKits', 'hasSuppliers', 'hasSuppliersFull', 'hasSupplierDocs', 'hasCommandes', 'hasTco', 'hasArretCout', 'hasTelemetry', 'hasGps', 'hasPannes'].forEach((k) => { SCHEMA[k] = true; });
    UI.companyPlan = 'enterprise'; UI.role = 'gerant';
    const T = ${JSON.stringify(t)};
    if (T.nomsCategories) {
      UI.categories.forEach((k, i) => { k.name = T.nomsCategories[i]; });
      UI.machines.forEach((m, i) => { m.name = T.nomsMachines[i]; m.category = Object.assign({}, UI.categories.find((k) => k.id === m.category_id)); });
    }
    const il = (j) => new Date(Date.now() - j * 864e5).toISOString();
    const jour = (j) => il(j).slice(0, 10);
    UI.warehouses = [
      { id: 'w1', name: T.magCentral, kind: 'central', note: '', active: true },
      { id: 'w2', name: T.magMobile, kind: 'mobile', note: '', active: true },
    ];
    UI.suppliers = [
      { id: 's1', name: T.fournisseurs[0], active: true },
      { id: 's2', name: T.fournisseurs[1], active: true },
    ];
    UI.partsCatalog = [
      { id: 'p1', reference: 'FLT-0142', designation: T.pieces[0], unit_price: 24.9, supplier_name: T.fournisseurs[0], avg_lead_time_days: 5, packaging: T.conditionnement, default_reorder_point: 6, ean: '3760000014214', unit_of_measure: 'piece' },
      { id: 'p2', reference: 'FLT-0208', designation: T.pieces[1], unit_price: 31.5, supplier_name: T.fournisseurs[0], avg_lead_time_days: 5, packaging: null, default_reorder_point: 4, ean: null, unit_of_measure: 'piece' },
      { id: 'p3', reference: 'GRS-0030', designation: T.pieces[2], unit_price: 8.2, supplier_name: T.fournisseurs[1], avg_lead_time_days: 3, packaging: null, default_reorder_point: 10, ean: null, unit_of_measure: 'piece' },
      { id: 'p4', reference: 'CRR-0075', designation: T.pieces[3], unit_price: 42, supplier_name: T.fournisseurs[1], avg_lead_time_days: 12, packaging: null, default_reorder_point: 2, ean: null, unit_of_measure: 'piece' },
      { id: 'p5', reference: 'HUI-0046', designation: T.pieces[4], unit_price: 96, supplier_name: T.fournisseurs[0], avg_lead_time_days: 7, packaging: null, default_reorder_point: 1, ean: null, unit_of_measure: 'piece' },
    ];
    UI.stockItems = [
      { id: 'i1', part_id: 'p1', warehouse_id: 'w1', quantity: 18, pump_unit_cost: 22.4, reorder_point: null, location: '', status: 'libere' },
      { id: 'i2', part_id: 'p2', warehouse_id: 'w1', quantity: 3, pump_unit_cost: 29, reorder_point: null, location: '', status: 'libere' },
      { id: 'i3', part_id: 'p3', warehouse_id: 'w1', quantity: 24, pump_unit_cost: 7.6, reorder_point: null, location: '', status: 'libere' },
      { id: 'i4', part_id: 'p4', warehouse_id: 'w2', quantity: 4, pump_unit_cost: 40, reorder_point: null, location: '', status: 'libere' },
      { id: 'i5', part_id: 'p5', warehouse_id: 'w1', quantity: 2, pump_unit_cost: 92, reorder_point: null, location: '', status: 'libere' },
    ];
    UI.stockCounts = calculerStockCounts(UI.stockItems, UI.partsCatalog);
    const base = {};
    if (${mouvements}) base.stock_movements = [
      { id: 'x1', part_id: 'p1', warehouse_id: 'w1', destination_warehouse_id: null, type: 'entree', quantity: 12, unit_cost: 22.4, reason: T.bl, performed_at: il(1) },
      { id: 'x2', part_id: 'p2', warehouse_id: 'w1', destination_warehouse_id: null, type: 'sortie', quantity: 2, unit_cost: null, reason: '', performed_at: il(2) },
      { id: 'x3', part_id: 'p4', warehouse_id: 'w1', destination_warehouse_id: 'w2', type: 'transfert', quantity: 2, unit_cost: null, reason: '', performed_at: il(4) },
    ];
    if (${tco}) {
      // Prix d'achat et paramètres d'amortissement (valeurs inventées, devise de la société fictive).
      const fiche = {
        m1: { purchase_price: 38000, purchase_date: jour(1000), estimated_resale_value: 18000, expected_lifespan_counter: 9000, amortization_years: 8, counter_value: 3100 },
        m2: { purchase_price: 120000, purchase_date: jour(1900), estimated_resale_value: 45000, expected_lifespan_counter: 12000, amortization_years: 10, counter_value: 6400 },
        m3: { purchase_price: 85000, purchase_date: jour(1100), estimated_resale_value: 30000, expected_lifespan_counter: 600000, amortization_years: 7, counter_value: 84500 },
        m4: { purchase_price: 22000, purchase_date: jour(1500), estimated_resale_value: 9000, expected_lifespan_counter: 15000, amortization_years: 10, counter_value: 1800 },
      };
      UI.machines.forEach((m) => Object.assign(m, fiche[m.id]));
      UI.machines[1].plan.items = T.planItems.map((l) => ({ label: l }));
      UI.categories.forEach((k, i) => { k.target_hourly_cost = [12, 22, 1.5, 8][i]; });
      UI.company.labor_hourly_rate = 45;
      UI.machines.forEach((m) => { m.category = Object.assign({}, UI.categories.find((k) => k.id === m.category_id)); });
      const inter = (m, j, h, pieces, mo, heures, d) => ({ id: m + '-' + j, machine_id: m, performed_at: il(j), hours_at_intervention: h, description: d, items_done: [d], performed_by: null, parts_cost: pieces, labor_cost: mo, labor_hours: heures });
      base.interventions = [
        inter('m1', 40, 3000, 420, 360, 6, T.entretiens[0]), inter('m1', 210, 2750, 380, 300, 5, T.entretiens[0]), inter('m1', 380, 2500, 120, 180, 3, T.entretiens[1]),
        inter('m2', 25, 6300, 2800, 1200, 20, T.entretiens[2]), inter('m2', 150, 5900, 1600, 900, 15, T.entretiens[0]), inter('m2', 300, 5500, 3400, 1500, 25, T.entretiens[3]), inter('m2', 520, 5000, 5200, 2400, 40, T.entretiens[2]),
        inter('m3', 60, 82000, 1100, 700, 12, T.entretiens[3]), inter('m3', 250, 70000, 900, 650, 10, T.entretiens[0]),
        inter('m4', 90, 1700, 180, 120, 2, T.entretiens[0]),
      ];
      const frais = (m, j, k, a) => ({ id: m + 'f' + j, machine_id: m, kind: k, amount: a, incurred_at: jour(j), notes: null });
      base.operating_costs = [
        frais('m1', 20, 'carburant', 2100), frais('m1', 120, 'carburant', 1900), frais('m1', 300, 'assurance', 900),
        frais('m2', 15, 'carburant', 5200), frais('m2', 140, 'carburant', 4800), frais('m2', 260, 'assurance', 2100), frais('m2', 400, 'carburant', 5600),
        frais('m3', 30, 'carburant', 3800), frais('m3', 200, 'carburant', 3500), frais('m3', 320, 'taxe', 1200),
        frais('m4', 80, 'carburant', 500),
      ];
      base.machine_breakdowns = [
        { id: 'b1', machine_id: 'm2', downtime_hours: 16, downtime_cost: 1900, stopped: true, status: 'resolue' },
        { id: 'b2', machine_id: 'm2', downtime_hours: 8, downtime_cost: 950, stopped: true, status: 'resolue' },
      ];
    }
    if (${tickets}) base.support_tickets = [
      { id: 'aa11bb22-0000-4000-8000-000000000001', subject: T.tickets[0].sujet, status: T.tickets[0].st, machine_id: 'm2', created_at: il(1) },
      { id: 'cc33dd44-0000-4000-8000-000000000002', subject: T.tickets[1].sujet, status: T.tickets[1].st, machine_id: null, created_at: il(9) },
    ];
    const faux = (table) => {
      const filtres = [];
      const b = {
        select() { return b; }, order() { return b; }, single() { return b; }, maybeSingle() { return b; }, limit() { return b; }, range() { return b; },
        gte() { return b; }, lte() { return b; }, is() { return b; }, neq() { return b; }, not() { return b; },
        eq(col, val) { filtres.push((r) => r[col] === undefined || String(r[col]) === String(val)); return b; },
        in(col, vals) { filtres.push((r) => r[col] === undefined || vals.map(String).includes(String(r[col]))); return b; },
        then(res) { res({ data: (base[table] || []).filter((r) => filtres.every((f) => f(r))), error: null, count: 0 }); },
      };
      return b;
    };
    sb.from = faux;
    return true;
  })()`);
}

export const SCENARIOS = [
  {
    id: 'stk-ajouter-piece',
    etapes: [
      // 1. Stocks & SAV › Pièces › Catalogue de pièces.
      { nom: 'catalogue', ecran: 'bureau', async jouer(c) {
        await injecter(c);
        await c.ev("UI.stockOnglet = 'pieces'; UI.stockPiecesVue = 'catalogue'; goTo('stock'); true");
        await c.attendre('#tco-catalogue-section');
        await c.dort(900);
        // Liste raccourcie à trois lignes, sans défilement interne : aucune ligne coupée au bord de l'image.
        await c.ev("(() => { const l = document.getElementById('tco-catalogue-liste'); l.style.maxHeight = 'none'; l.style.overflow = 'visible'; [...l.children].slice(3).forEach((e) => { e.style.display = 'none'; }); return true; })()");
        await c.repere('[data-stock-onglet="pieces"]', 1);
        await c.repere('[data-stock-pieces-vue="catalogue"]', 1);
        await toutDansLaZone(c, ['[data-stock-onglet="pieces"]', '[data-stock-pieces-vue="catalogue"]'], '#view-root');
        const z = await c.zoneJusqua('.stock-onglets', '#tco-catalogue-liste', 26);
        // Resserrée sur les côtés (bord de la barre latérale) et en haut, rallongée en bas pour ne pas couper le bouton du formulaire.
        return { ...z, x: z.x + 14, largeur: z.largeur - 28, y: z.y + 10, hauteur: z.hauteur + 20 };
      } },
      // 2-4. Le formulaire : désignation (2), seuil bas (3), « Ajouter au catalogue » (4).
      { nom: 'formulaire', ecran: 'bureau', async jouer(c) {
        await injecter(c);
        await c.ev("UI.stockOnglet = 'pieces'; UI.stockPiecesVue = 'catalogue'; goTo('stock'); true");
        await c.attendre('#tco-piece-designation');
        await c.dort(900);
        await c.voir('#tco-piece-form-titre', 'center');
        await c.repere('#tco-piece-designation', 2);
        await c.repere('#tco-piece-seuil', 3);
        await c.repere('#tco-piece-ajouter', 4);
        await toutDansLaZone(c, ['#tco-piece-designation', '#tco-piece-seuil', '#tco-piece-ajouter'], '#tco-catalogue-section .ui-groupe');
        return c.zone('#tco-catalogue-section .ui-groupe', 12);
      } },
    ],
  },
  {
    id: 'stk-mouvement',
    etapes: [
      // 1. Stocks & SAV › Mouvements › « Nouveau mouvement ».
      { nom: 'mouvements', ecran: 'bureau', async jouer(c) {
        await injecter(c, { mouvements: true });
        await c.ev("UI.stockOnglet = 'mouvements'; goTo('stock'); true");
        await c.attendre('#stock-mouvements-liste .ui-ligne');
        await c.dort(700);
        await c.repere('[data-stock-onglet="mouvements"]', 1);
        await c.repere('#stock-mouvements-nouveau', 1);
        await toutDansLaZone(c, ['[data-stock-onglet="mouvements"]', '#stock-mouvements-nouveau'], '#view-root');
        const z = await c.zoneJusqua('.stock-onglets', '#stock-mouvements-liste', 26);
        return { ...z, x: z.x + 14, largeur: z.largeur - 28, y: z.y + 10, hauteur: z.hauteur + 16 };
      } },
      // 2-5. La fenêtre : type (2), pièce / magasin / quantité (3), coût unitaire (4), « Enregistrer le mouvement » (5).
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await injecter(c);
        await c.ev("ouvrirNouveauMouvementModal(); true");
        await c.attendre('#mvt-valider');
        await c.dort(600);
        // Exemple de saisie (rien n'est enregistré) : une entrée de 12 filtres à 22,40.
        await c.ev("(() => { document.getElementById('mvt-piece').value = 'p1'; document.getElementById('mvt-quantite').value = '12'; document.getElementById('mvt-cout').value = '" + (c.langue === 'fr' ? '22,4' : '22.4') + "'; return true; })()");
        await c.repere('.overlay .mvt-types', 2);
        await c.repere('#mvt-piece', 3);
        await c.repere('#mvt-magasin', null);
        await c.repere('#mvt-quantite', null);
        await c.repere('#mvt-cout', 4, { cote: 'droite' });
        await c.repere('#mvt-valider', 5, { cote: 'droite' });
        await toutDansLaZone(c, ['.overlay .mvt-types', '#mvt-piece', '#mvt-magasin', '#mvt-quantite', '#mvt-cout', '#mvt-valider'], '.overlay .modal');
        return c.zone('.overlay .modal', 10);
      } },
    ],
  },
  {
    id: 'tele-source',
    etapes: [
      // 1-3. Machines › Télémétrie : l'onglet (1), le nom et le type de la nouvelle source (2), « Créer la source » (3). Le cadre du jeton (étape 4) n'apparaît qu'après la création : non photographié.
      { nom: 'source', ecran: 'bureau', async jouer(c) {
        await injecter(c);
        await c.ev("goTo('telemetrie'); true");
        await c.attendre('#acc-tele-nom');
        await c.dort(900);
        const nom = c.langue === 'fr' ? 'Boîtiers atelier' : 'Workshop trackers';
        await c.ev("(() => { document.getElementById('acc-tele-nom').value = " + JSON.stringify(nom) + "; return true; })()");
        await c.marquer('#acc-tele-nom', 'creation', '.tele-creation');
        await c.voir('[data-aide="creation"]', 'center');
        await c.repere('#acc-tele-nom', 2);
        await c.repere('#acc-tele-type', null);
        await c.repere('[data-tele-creer]', 3);
        await toutDansLaZone(c, ['#acc-tele-nom', '#acc-tele-type', '[data-tele-creer]'], '[data-aide="creation"]');
        return c.zone('[data-aide="creation"]', 22);
      } },
    ],
  },
  {
    id: 'sup-nouveau-ticket',
    etapes: [
      // 1-2. Le menu « Aide & support » (1) et, dans « Mes demandes », « Nouveau ticket » (2).
      { nom: 'page', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tickets: true });
        await c.ev("goTo('support'); true");
        await c.attendre('#support-page-liste .support-liste-ligne');
        await c.dort(900);
        await c.repere('.sidebar [data-nav="support"]', 1, { cote: 'droite' });
        await c.repere('#support-page-nouveau', 2);
        await toutDansLaZone(c, ['.sidebar [data-nav="support"]', '#support-page-nouveau'], 'body');
        const bas = await c.zone('#support-page-liste', 24);
        const haut = await c.zone('.sidebar', 0);
        return { x: 0, y: 0, largeur: bas.x + bas.largeur, hauteur: bas.y + bas.hauteur };
      } },
      // 3-4. La fenêtre « Nouveau ticket » : sujet (3), machine concernée, message, « Envoyer » (4).
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tickets: true });
        await c.ev("nouveauTicketDepuisPage(); true");
        await c.attendre('#support-sujet');
        await c.dort(700);
        const exemple = c.langue === 'fr'
          ? { sujet: 'Question sur un plan d\'entretien', message: 'Bonjour, je voudrais savoir comment ajouter une tâche au plan de la chargeuse.' }
          : { sujet: 'Question about a maintenance plan', message: 'Hello, I would like to know how to add a task to the loader\'s plan.' };
        await c.ev("(() => { document.getElementById('support-sujet').value = " + JSON.stringify(exemple.sujet) + "; document.getElementById('support-message').value = " + JSON.stringify(exemple.message) + "; const m = UI.machines[1]; document.getElementById('support-machine-trigger-label').textContent = libelleMachineCourt(m) || m.name; return true; })()");
        await c.ev('document.activeElement && document.activeElement.blur(); true');
        await c.repere('#support-sujet', 3, { cote: 'droite' });
        await c.repere('#support-machine-trigger', null);
        await c.repere('#support-message', null);
        await c.repere('#support-envoyer', 4, { cote: 'droite' });
        await toutDansLaZone(c, ['#support-sujet', '#support-machine-trigger', '#support-message', '#support-envoyer'], '.overlay .modal');
        return c.zone('.overlay .modal', 12);
      } },
    ],
  },
  {
    id: 'cout-scorecard',
    etapes: [
      // 1. Machines › Plans d'entretien : « Voir le plan » sur la ligne de la machine.
      { nom: 'plans', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tco: true });
        // Un carnet déposé et un plan extrait (sinon « Voir le plan » n'apparaît pas et la ligne se contredit).
        await c.ev("UI.machines.find((m) => m.id === 'm2').manual_url = 'demo/carnet.pdf'; goTo('manuals'); true");
        await c.attendre('[data-plan="m2"]');
        await c.dort(700);
        await c.marquer('[data-plan="m2"]', 'carte', 'article');
        await c.repere('[data-plan="m2"]', 1);
        await toutDansLaZone(c, ['[data-plan="m2"]'], '[data-aide="carte"]');
        return c.zone('[data-aide="carte"]', 22);
      } },
      // 2-4. La carte « Scorecard TCO » : prix d'achat (2), chiffres (3), recommandation (4).
      { nom: 'scorecard', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tco: true });
        await c.ev("openPlanView(UI.machines.find((m) => m.id === 'm2'), UI.companyId, UI.categories); true");
        await c.attendre('#tco-scorecard-section .fm-kpi-row');
        await c.dort(900);
        await c.voir('#tco-scorecard-section', 'center');
        await c.repere('#tco-scorecard-section .fm-chip-accent', 2, { cote: 'droite' });
        await c.repere('#tco-scorecard-section .fm-kpi-row', 3);
        await c.repere('#tco-scorecard-section .badge', 4);
        await toutDansLaZone(c, ['#tco-scorecard-section .fm-chip-accent', '#tco-scorecard-section .fm-kpi-row', '#tco-scorecard-section .badge'], '#tco-scorecard-section');
        return c.zone('#tco-scorecard-section', 20);
      } },
    ],
  },
  {
    id: 'cout-classement',
    etapes: [
      // 1-5. Coûts & TCO › Classement : onglet (1), période (2), filtre et tri (3), une ligne (4), export (5).
      { nom: 'classement', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tco: true });
        await c.ev("UI.tcoOnglet = 'classement'; goTo('tco'); true");
        await c.attendre('.ui-ligne[data-machine]');
        await c.dort(900);
        await c.marquer('[data-tco-onglet="classement"]', 'onglets', '[role="tablist"]');
        await c.repere('[data-tco-onglet="classement"]', 1, { cote: 'droite' });
        await c.repere('#tco-filtre-periode', 2);
        await c.repere('#tco-filtre-categorie-bouton', 3);
        await c.repere('#tco-filtre-tri-bouton', null);
        await c.repere('.ui-ligne[data-machine]', 4);
        await toutDansLaZone(c, ['[data-tco-onglet="classement"]', '#tco-filtre-periode', '#tco-filtre-categorie-bouton', '#tco-filtre-tri-bouton', '.ui-ligne[data-machine]'], '#view-root');
        const z = await c.zoneJusqua('[data-aide="onglets"]', '.ui-ligne[data-machine]', 24);
        return { ...z, x: z.x + 16, largeur: z.largeur - 32 };
      } },
      // 5. Le bas du classement : « Exporter en CSV ».
      { nom: 'export', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tco: true });
        await c.ev("UI.tcoOnglet = 'classement'; goTo('tco'); true");
        await c.attendre('.ui-ligne[data-machine]');
        await c.dort(900);
        await c.ev("(() => { const l = [...document.querySelectorAll('.ui-ligne[data-machine]')]; l[l.length - 2].setAttribute('data-aide', 'avantderniere'); return true; })()");
        await c.voir('#tco-export-classement', 'center');
        await c.repere('#tco-export-classement', 5, { cote: 'droite' });
        await toutDansLaZone(c, ['#tco-export-classement'], '#view-root');
        return c.zoneJusqua('[data-aide="avantderniere"]', '#tco-export-classement', 24);
      } },
    ],
  },
];
