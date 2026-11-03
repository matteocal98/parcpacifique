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
    sourceNom: fr ? 'Boîtiers atelier' : 'Workshop trackers',
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
      ? [{ sujet: 'Question sur un plan d\'entretien', st: 'ouvert' }, { sujet: 'Compteur de la chargeuse', st: 'resolu' }, { sujet: 'Alerte de stock bas', st: 'en_cours' }, { sujet: 'Question sur un export', st: 'ouvert' }]
      : [{ sujet: 'Question about a maintenance plan', st: 'ouvert' }, { sujet: 'Loader meter', st: 'resolu' }, { sujet: 'Low stock alert', st: 'en_cours' }, { sujet: 'Question about an export', st: 'ouvert' }],
    messages: fr
      ? { q1: 'Bonjour, je voudrais savoir comment ajouter une tâche au plan de la chargeuse.', r1: 'Bonjour ! Ouvrez le plan de la machine : chaque tâche se modifie depuis le tableau de référence. Dites-nous si cela ne suffit pas.', q3: 'L\'alerte de stock bas ne s\'affiche pas pour mon filtre à air.', ia3: 'Bonjour, je suis l\'assistant automatique de KALEA. Vérifiez que le seuil bas est renseigné sur la pièce : sans seuil, aucune alerte ne se déclenche.', q4: 'Comment récupérer l\'état de mon stock dans un tableur ?', ia4: 'Dans Stocks & SAV, vue Stock par magasin, le bouton d\'export en CSV produit un fichier lisible dans un tableur.', h4: 'Je préfère parler à une personne, merci.' }
      : { q1: 'Hello, I would like to know how to add a task to the loader\'s plan.', r1: 'Hello! Open the machine\'s plan: each task can be edited from the reference table. Tell us if that is not enough.', q3: 'The low stock alert does not show for my air filter.', ia3: 'Hello, I am KALEA\'s automatic assistant. Check that the low-stock level is filled in on the part: with no level, no alert is triggered.', q4: 'How can I get my stock status into a spreadsheet?', ia4: 'In Stocks & SAV, Stock by warehouse view, the CSV export button produces a file a spreadsheet can read.', h4: 'I would rather talk to a person, thanks.' },
  };
}

// Installe, DANS LA PAGE : drapeaux de schéma, magasins, catalogue, lignes de stock, fournisseurs ; selon les options, les coûts du parc (prix d'achat, interventions,
// frais d'exploitation, pannes) et des tickets ; puis remplace sb.from() par une fausse base qui sert ces tables en respectant les filtres eq()/in().
async function injecter(c, { mouvements = false, tco = false, tickets = false, achats = false, telemetrie = false } = {}) {
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
    if (${tickets}) {
      const ID = ['aa11bb22-0000-4000-8000-000000000001', 'cc33dd44-0000-4000-8000-000000000002', 'ee55ff66-0000-4000-8000-000000000003', 'abcd1234-0000-4000-8000-000000000004'];
      base.support_tickets = [
        { id: ID[0], subject: T.tickets[0].sujet, status: T.tickets[0].st, machine_id: 'm2', created_at: il(1), humain_demande: false },
        { id: ID[1], subject: T.tickets[1].sujet, status: T.tickets[1].st, machine_id: null, created_at: il(9), humain_demande: false },
        { id: ID[2], subject: T.tickets[2].sujet, status: T.tickets[2].st, machine_id: null, created_at: il(2), humain_demande: false },
        { id: ID[3], subject: T.tickets[3].sujet, status: T.tickets[3].st, machine_id: null, created_at: il(3), humain_demande: true },
      ];
      const me = 'demo-utilisateur';
      base.support_ticket_messages = [
        { id: 'k1', ticket_id: ID[0], body: T.messages.q1, created_at: il(1.2), author_id: me, ia: false, profiles: null },
        { id: 'k2', ticket_id: ID[0], body: T.messages.r1, created_at: il(0.1), author_id: 'equipe-support', ia: false, profiles: null },
        { id: 'k3', ticket_id: ID[2], body: T.messages.q3, created_at: il(2), author_id: me, ia: false, profiles: null },
        { id: 'k4', ticket_id: ID[2], body: T.messages.ia3, created_at: il(1.9), author_id: 'equipe-support', ia: true, profiles: null },
        { id: 'k5', ticket_id: ID[3], body: T.messages.q4, created_at: il(3), author_id: me, ia: false, profiles: null },
        { id: 'k6', ticket_id: ID[3], body: T.messages.ia4, created_at: il(2.9), author_id: 'equipe-support', ia: true, profiles: null },
        { id: 'k7', ticket_id: ID[3], body: T.messages.h4, created_at: il(2.8), author_id: me, ia: false, profiles: null },
      ];
      // Une réponse du support à lire sur le premier ticket.
      sb.rpc = async (nom) => (nom === 'support_non_lus' ? { data: [{ ticket_id: ID[0], nouveaux: 1 }], error: null } : { data: [], error: null });
    }
    if (${telemetrie}) {
      base.telemetry_sources = [{ id: 't1', kind: 'flespi', label: T.sourceNom, token_hint: 'a1b2', created_at: il(30), last_seen_at: il(0.01), last_poll_at: null, last_error: null }];
      Object.assign(UI.machines[0], { counter_source: 'telemetry', telemetry_source_id: 't1', telemetry_ref: '352093081234501', telemetry_last_at: il(0.02), position_enabled: false });
      Object.assign(UI.machines[1], { counter_source: 'telemetry', telemetry_source_id: 't1', telemetry_ref: '352093081234502', telemetry_last_at: null, position_enabled: false });
    }
    if (${achats}) {
      // Achats : peu de stock sur trois pièces (seuil bas, une pièce en quarantaine), des sorties récentes (rythme de consommation), une commande brouillon déjà enregistrée.
      UI.stockItems[3].quantity = 1;
      UI.stockCounts = calculerStockCounts(UI.stockItems, UI.partsCatalog);
      base.stock_movements = (base.stock_movements || []).concat([
        { id: 'y1', part_id: 'p2', warehouse_id: 'w1', destination_warehouse_id: null, type: 'sortie', quantity: 30, unit_cost: null, reason: '', performed_at: il(10) },
        { id: 'y2', part_id: 'p4', warehouse_id: 'w2', destination_warehouse_id: null, type: 'sortie', quantity: 20, unit_cost: null, reason: '', performed_at: il(12) },
      ]);
      base.purchase_orders = [{ id: 'o1', reference: 'CMD-2026-001', status: 'brouillon', supplier_id: 's1', supplier_name: T.fournisseurs[0], total_estimated: 570, created_at: il(1), requested_delivery: jour(-10), default_warehouse_id: 'w1', note: '' }];
      base.purchase_order_lines = [
        { id: 'l1', order_id: 'o1', part_id: 'p1', designation: T.pieces[0], reference: 'FLT-0142', quantity_ordered: 12, quantity_received: 0, unit_price: 24.9 },
        { id: 'l2', order_id: 'o1', part_id: 'p3', designation: T.pieces[2], reference: 'GRS-0030', quantity_ordered: 20, quantity_received: 0, unit_price: 8.2 },
      ];
    }
    const faux = (table) => {
      const filtres = [];
      let seule = false;
      const b = {
        select() { return b; }, order() { return b; }, single() { seule = true; return b; }, maybeSingle() { seule = true; return b; }, limit() { return b; }, range() { return b; },
        gte() { return b; }, lte() { return b; }, is() { return b; }, neq() { return b; }, not() { return b; },
        eq(col, val) { filtres.push((r) => r[col] === undefined || String(r[col]) === String(val)); return b; },
        in(col, vals) { filtres.push((r) => r[col] === undefined || vals.map(String).includes(String(r[col]))); return b; },
        then(res) { const lignes = (base[table] || []).filter((r) => filtres.every((f) => f(r))); res({ data: seule ? (lignes[0] || null) : lignes, error: null, count: 0 }); },
      };
      return b;
    };
    sb.from = faux;
    return true;
  })()`);
}

// Ouvre Stocks & SAV sur un onglet (vue « Stock par magasin » pour Pièces), avec le stock fictif injecté ; l'emplacement et le statut de quelques lignes sont renseignés.
async function vueStock(c, onglet, opts) {
  await injecter(c, opts);
  const lieu = c.langue === 'fr' ? 'Allée B, rayon 3' : 'Aisle B, shelf 3';
  await c.ev("UI.stockItems[0].location = " + JSON.stringify(lieu) + "; UI.stockItems[4].status = 'quarantaine'; UI.stockOnglet = '" + onglet + "'; UI.stockPiecesVue = 'stock'; goTo('stock'); true");
  await c.attendre('.stock-onglets');
  await c.dort(900);
}

// Ouvre « Enregistrer une intervention » sur la pelle (coûts et TCO actifs, stock injecté).
async function ouvrirIntervention(c) {
  await injecter(c, { tco: true });
  await c.ev("openLogInterventionModal(UI.machines[0]); true");
  await c.attendre('#log-couts-section');
  await c.dort(900);
}
// Ajoute une ligne de pièce du catalogue dans la fenêtre d'intervention SANS ouvrir le sélecteur : le bouton « + Ajouter une pièce » crée une ligne libre quand le catalogue est vide,
// puis on remplit la liste de choix et on la règle comme le ferait le choix d'une pièce (le prix se propose, la sortie de stock se coche d'office).
async function ajouterPieceIntervention(c, partId, quantite) {
  await c.ev(`(() => {
    const cat = UI.partsCatalog; UI.partsCatalog = [];
    document.getElementById('log-piece-ajouter').click();
    UI.partsCatalog = cat;
    const lignes = document.querySelectorAll('.log-piece-ligne');
    const ligne = lignes[lignes.length - 1];
    const sel = ligne.querySelector('.log-piece-select');
    sel.innerHTML = '<option value="">' + trad('— Choisir une pièce du catalogue —') + '</option>' + cat.map((p) => '<option value="' + p.id + '" data-prix="' + p.unit_price + '">' + p.designation + (p.reference ? ' — ' + p.reference : '') + '</option>').join('');
    sel.value = '${partId}';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof sel.__majBouton === 'function') sel.__majBouton();
    ligne.querySelector('.log-piece-qte').value = '${quantite}';
    ligne.querySelector('.log-piece-qte').dispatchEvent(new Event('change', { bubbles: true }));
    majStockLigneLog(ligne, null, true);
    return true;
  })()`);
  await c.dort(300);
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
  // ───────────────────────── Deuxième série ─────────────────────────
  {
    id: 'stk-seuil-alertes',
    etapes: [
      // 2, 4, 5. Pièces › Stock par magasin : tuile « Références en alerte » et ligne « Seuil bas » (2), « Commander » (4), « Exporter en CSV » (5).
      { nom: 'stock', ecran: 'bureau', async jouer(c) {
        await vueStock(c, 'pieces');
        await c.attendre('[data-stock-commander]');
        await c.ev("(() => { const l = document.getElementById('stock-inventaire-liste'); l.style.maxHeight = 'none'; l.style.overflow = 'visible'; [...l.children].slice(3).forEach((e) => { e.style.display = 'none'; }); return true; })()");
        await c.marquer('[data-stock-commander]', 'alerte', '.ui-ligne');
        await c.repere('.stock-tuile-lien.is-retard', 2);
        await c.repere('[data-aide="alerte"]', 2);
        await c.repere('[data-stock-commander]', 4, { cote: 'droite', marge: 4 });
        await c.repere('#stock-inventaire-export', 5);
        await toutDansLaZone(c, ['.stock-tuile-lien.is-retard', '[data-aide="alerte"]', '[data-stock-commander]', '#stock-inventaire-export'], '#view-root');
        const z = await c.zoneJusqua('#view-root .ui-page .ui-section', '#stock-inventaire-liste', 24);
        return { ...z, x: z.x + 16, largeur: z.largeur - 32, y: z.y + 6, hauteur: z.hauteur + 12 };
      } },
    ],
  },
  {
    id: 'stk-emplacement-statut',
    etapes: [
      // 1. Pièces › Stock par magasin : « Emplacement » (en haut) et le crayon d'une ligne.
      { nom: 'stock', ecran: 'bureau', async jouer(c) {
        await vueStock(c, 'pieces');
        await c.attendre('[data-stock-emplacement]');
        await c.ev("(() => { const l = document.getElementById('stock-inventaire-liste'); l.style.maxHeight = 'none'; l.style.overflow = 'visible'; [...l.children].slice(3).forEach((e) => { e.style.display = 'none'; }); return true; })()");
        await c.repere('#stock-emplacement-ajouter', 1);
        await c.repere('[data-stock-emplacement]', 1, { cote: 'droite', marge: 4 });
        await toutDansLaZone(c, ['#stock-emplacement-ajouter', '[data-stock-emplacement]'], '#view-root');
        const z = await c.zoneJusqua('#stock-inventaire-section', '#stock-inventaire-liste', 18);
        return { ...z, x: z.x + 12, largeur: z.largeur - 24 };
      } },
      // 2-5. La fenêtre : article et magasin (2), emplacement (3), statut (4), « Enregistrer » (5).
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await injecter(c);
        await c.ev("ouvrirModaleEmplacementStock('p1', 'w1'); true");
        await c.attendre('#emplacement-go');
        await c.dort(600);
        const lieu = c.langue === 'fr' ? 'Allée B, rayon 3, casier 12' : 'Aisle B, shelf 3, bin 12';
        await c.ev("document.getElementById('emplacement-texte').value = " + JSON.stringify(lieu) + "; true");
        await c.repere('#emplacement-piece', 2);
        await c.repere('#emplacement-magasin', null);
        await c.repere('#emplacement-texte', 3);
        await c.repere('#emplacement-statut', 4);
        await c.repere('#emplacement-go', 5, { cote: 'droite' });
        await toutDansLaZone(c, ['#emplacement-piece', '#emplacement-magasin', '#emplacement-texte', '#emplacement-statut', '#emplacement-go'], '.overlay .modal');
        return c.zone('.overlay .modal', 10);
      } },
    ],
  },
  {
    id: 'stk-inventaire',
    etapes: [
      // 1. L'onglet Inventaire (1) et « Nouvel inventaire » (1).
      { nom: 'onglet', ecran: 'bureau', async jouer(c) {
        await vueStock(c, 'inventaire');
        await c.attendre('#invphys-nouveau');
        await c.marquer('#invphys-nouveau', 'bloc', 'section');
        await c.repere('[data-stock-onglet="inventaire"]', 1);
        await c.repere('#invphys-nouveau', 1);
        await toutDansLaZone(c, ['[data-stock-onglet="inventaire"]', '#invphys-nouveau'], '#view-root');
        const z = await c.zoneJusqua('.stock-onglets', '[data-aide="bloc"]', 24);
        return { ...z, x: z.x + 14, largeur: z.largeur - 28 };
      } },
      // 2-3. La fenêtre « Nouvel inventaire » : magasin, nom, zone, comptage en aveugle (2), « Ouvrir l'inventaire » (3).
      { nom: 'nouveau', ecran: 'bureau', async jouer(c) {
        await injecter(c);
        await c.ev("ouvrirNouvelInventaire(() => {}); true");
        await c.attendre('#invnew-go');
        await c.dort(600);
        await c.repere('#invnew-magasin', 2);
        await c.repere('#invnew-label', null);
        await c.repere('#invnew-zone', null);
        await c.repere('#invnew-aveugle', null, { marge: 8 });
        await c.repere('#invnew-go', 3, { cote: 'droite' });
        await toutDansLaZone(c, ['#invnew-magasin', '#invnew-label', '#invnew-zone', '#invnew-aveugle', '#invnew-go'], '.overlay .modal');
        return c.zone('.overlay .modal', 10);
      } },
    ],
  },
  {
    id: 'stk-creer-magasin',
    etapes: [
      // 1-3. Stocks & SAV › Réglages : l'onglet (1), le nom et le type du magasin (2), « Ajouter le magasin » (3).
      { nom: 'reglages', ecran: 'bureau', async jouer(c) {
        await vueStock(c, 'organisation');
        await c.attendre('#stock-magasin-nom');
        const nom = c.langue === 'fr' ? 'Magasin annexe' : 'Annex store';
        await c.ev("document.getElementById('stock-magasin-nom').value = " + JSON.stringify(nom) + "; true");
        await c.marquer('#stock-magasin-nom', 'mag', 'section');
        await c.repere('[data-stock-onglet="organisation"]', 1);
        await c.repere('#stock-magasin-nom', 2);
        await c.repere('#stock-magasin-kind', null);
        await c.repere('#stock-magasin-ajouter', 3);
        await toutDansLaZone(c, ['[data-stock-onglet="organisation"]', '#stock-magasin-nom', '#stock-magasin-kind', '#stock-magasin-ajouter'], '#view-root');
        const z = await c.zoneJusqua('.stock-onglets', '[data-aide="mag"]', 24);
        return { ...z, x: z.x + 10, largeur: z.largeur - 20 };
      } },
    ],
  },
  {
    id: 'stk-importer-catalogue',
    etapes: [
      // 1. Le bouton « Importer des pièces (CSV) » en tête du catalogue.
      { nom: 'bouton', ecran: 'bureau', async jouer(c) {
        await injecter(c);
        await c.ev("UI.stockOnglet = 'pieces'; UI.stockPiecesVue = 'catalogue'; goTo('stock'); true");
        await c.attendre('#tco-catalogue-importer');
        await c.dort(700);
        await c.repere('#tco-catalogue-importer', 1);
        await toutDansLaZone(c, ['#tco-catalogue-importer'], '#view-root');
        return c.zone('#tco-catalogue-section .ui-section-tete', 22);
      } },
      // 2-4. La fenêtre : « Télécharger un modèle » et « Copier » (2), le choix du fichier (4) puis « Importer » (4).
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await injecter(c);
        await c.ev("ouvrirImportCatalogue(); true");
        await c.attendre('#import-modele');
        await c.dort(600);
        await c.repere('#import-modele', 2);
        await c.repere('#import-copier', null);
        await c.repere('#import-zone', 4);
        await c.repere('#import-go', null);
        await toutDansLaZone(c, ['#import-modele', '#import-copier', '#import-zone', '#import-go'], '.overlay .modal');
        return c.zone('.overlay .modal', 10);
      } },
    ],
  },
  {
    id: 'stk-etiquettes-qr',
    etapes: [
      // 1. Le bouton « Étiquettes » de la vue « Stock par magasin ».
      { nom: 'bouton', ecran: 'bureau', async jouer(c) {
        await vueStock(c, 'pieces');
        await c.attendre('#stock-etiquettes-ouvrir');
        await c.repere('#stock-etiquettes-ouvrir', 1);
        await toutDansLaZone(c, ['#stock-etiquettes-ouvrir'], '#view-root');
        const z = await c.zoneJusqua('#stock-inventaire-section', '#stock-inventaire-liste', 24);
        return { ...z, x: z.x + 16, largeur: z.largeur - 32 };
      } },
      // 2-4. La fenêtre : format (2), ce qu'on étiquette (3), exemplaires (4) et « Imprimer » (4).
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await injecter(c);
        await c.ev("ouvrirModaleEtiquettes(); true");
        await c.attendre('#etiquettes-go');
        await c.dort(700);
        await c.repere('.etiquettes-haut > .ui-champ-groupe:nth-child(1)', 2, { marge: 12 });
        await c.repere('.etiquettes-haut > .ui-champ-groupe:nth-child(2)', 3, { marge: 12 });
        await c.repere('#etiquettes-copies', 4, { cote: 'droite' });
        await c.repere('#etiquettes-go', 4, { cote: 'droite' });
        await toutDansLaZone(c, ['.etiquettes-haut > .ui-champ-groupe:nth-child(1)', '.etiquettes-haut > .ui-champ-groupe:nth-child(2)', '#etiquettes-copies', '#etiquettes-go'], '.overlay .modal');
        return c.zone('.overlay .modal', 10);
      } },
    ],
  },
  {
    id: 'stk-fournisseur',
    etapes: [
      // 1. Réglages › Fournisseurs : « Nouveau fournisseur ».
      { nom: 'liste', ecran: 'bureau', async jouer(c) {
        await vueStock(c, 'organisation');
        await c.attendre('#stock-fournisseur-nouveau');
        await c.marquer('#stock-fournisseur-nouveau', 'four', 'section');
        await c.repere('#stock-fournisseur-nouveau', 1);
        await toutDansLaZone(c, ['#stock-fournisseur-nouveau'], '#view-root');
        return c.zone('[data-aide="four"]', 22);
      } },
      // 2-4. La fiche : nom (2), « Enregistrer » (4) ; les champs de l'étape 3 sont dans des cartes repliées.
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await injecter(c);
        await c.ev("ouvrirEditionFournisseur(null); true");
        await c.attendre('#fo-name');
        await c.dort(900);
        // La fiche est longue (cartes dépliées : plus de 2 700 px) : on garde ouverte la carte Identité, les autres restent repliées sur leur titre.
        await c.ev("document.querySelectorAll('details.fo-carte').forEach((d, i) => { if (i > 0) d.open = false; }); document.getElementById('fo-name').value = " + JSON.stringify(c.langue === 'fr' ? 'Pièces Services' : 'Parts Services') + "; true");
        await c.dort(500);
        await c.repere('#fo-name', 2, { cote: 'droite' });
        await c.repere('#fo-go', 4, { cote: 'droite' });
        await toutDansLaZone(c, ['#fo-name', '#fo-go'], '.overlay .modal');
        return c.zone('.overlay .modal', 10);
      } },
    ],
  },
  {
    id: 'stk-commande-reception',
    etapes: [
      // 1-3. Commandes : l'onglet (1), les réglages du calcul (2), « Préparer le bon » (3).
      { nom: 'suggestions', ecran: 'bureau', async jouer(c) {
        await vueStock(c, 'achats', { achats: true });
        await c.attendre('[data-achats-bon]');
        await c.dort(700);
        await c.marquer('[data-achats-bon]', 'groupe', '.achats-groupe');
        await c.repere('[data-stock-onglet="achats"]', 1);
        await c.repere('.achats-params', 2);
        await c.repere('[data-achats-bon]', 3);
        await toutDansLaZone(c, ['[data-stock-onglet="achats"]', '.achats-params', '[data-achats-bon]'], '#view-root');
        const z = await c.zoneJusqua('.stock-onglets', '[data-aide="groupe"]', 24);
        return { ...z, x: z.x + 12, largeur: z.largeur - 24 };
      } },
      // 3-4. Le bon de commande : livraison et adresse (3), « Enregistrer la commande » et les autres sorties (4).
      { nom: 'bon', ecran: 'bureau', async jouer(c) {
        await vueStock(c, 'achats', { achats: true });
        await c.attendre('[data-achats-bon]');
        await c.dort(500);
        await c.ev("document.querySelector('[data-achats-bon]').click(); true");
        await c.attendre('#bon-enregistrer');
        await c.dort(700);
        await c.repere('#bon-livraison', 3, { cote: 'droite' });
        await c.repere('#bon-adresse', null);
        await c.repere('#bon-enregistrer', 4);
        await c.repere('#bon-imprimer', null);
        await toutDansLaZone(c, ['#bon-livraison', '#bon-adresse', '#bon-enregistrer', '#bon-imprimer'], '.overlay .modal');
        return c.zone('.overlay .modal', 12);
      } },
      // 5-6. La commande enregistrée : « Marquer envoyée » (5) et « Réceptionner » (6).
      { nom: 'commande', ecran: 'bureau', async jouer(c) {
        await vueStock(c, 'achats', { achats: true });
        await c.attendre('[data-commande-ouvrir]');
        await c.ev("document.querySelector('[data-commande-ouvrir]').click(); true");
        await c.attendre('#cmd-recevoir');
        await c.dort(700);
        await c.repere('#cmd-envoyee', 5);
        await c.repere('#cmd-recevoir', 6, { cote: 'droite' });
        await toutDansLaZone(c, ['#cmd-envoyee', '#cmd-recevoir'], '.overlay .modal');
        return c.zone('.overlay .modal', 12);
      } },
      // 6. La réception : magasin de réception (6), quantités et prix reçus, « Valider la réception » (6).
      { nom: 'reception', ecran: 'bureau', async jouer(c) {
        await vueStock(c, 'achats', { achats: true });
        await c.attendre('[data-commande-ouvrir]');
        await c.ev("document.querySelector('[data-commande-ouvrir]').click(); true");
        await c.attendre('#cmd-recevoir');
        await c.ev("document.getElementById('cmd-recevoir').click(); true");
        await c.attendre('#rec-go');
        await c.dort(700);
        await c.repere('#rec-magasin', 6);
        await c.repere('[data-rec-qte]', null);
        await c.repere('#rec-go', 6, { cote: 'droite' });
        await toutDansLaZone(c, ['#rec-magasin', '[data-rec-qte]', '#rec-go'], '.overlay .modal');
        return c.zone('.overlay .modal', 12);
      } },
    ],
  },
  {
    id: 'cout-prix-achat',
    etapes: [
      // 2-3. « Modifier la machine » : l'encadré « Acquisition & TCO (Facultatif) » (2) et ses champs (3).
      { nom: 'encadre', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tco: true });
        await c.ev("openMachineModal(UI.companyId, UI.categories, UI.machines.find((m) => m.id === 'm1')); true");
        await c.attendre('#f-prix-achat');
        await c.dort(900);
        await c.voir('.mmod-tco-panel', 'center');
        await c.repere('.mmod-tco-panel', 2, { marge: 8 });
        await c.repere('.mmod-tco-panel .grid', 3, { cote: 'droite' });
        await toutDansLaZone(c, ['.mmod-tco-panel', '.mmod-tco-panel .grid'], '.overlay .modal');
        return c.zone('.mmod-tco-panel', 26);
      } },
    ],
  },
  {
    id: 'cout-seuils',
    etapes: [
      // 1-4. Coûts & TCO › Seuils de coût : l'onglet (1), « Moy. actuelle » (2), « +10 % au-dessus » (3), « Enregistrer les seuils » (4).
      { nom: 'seuils', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tco: true });
        // Les seuils fictifs sont retirés : l'écran montre des champs à remplir, comme chez un client qui débute.
        await c.ev("UI.categories.forEach((k) => { k.target_hourly_cost = null; }); UI.machines.forEach((m) => { m.category.target_hourly_cost = null; }); UI.tcoOnglet = 'seuils'; goTo('tco'); true");
        await c.attendre('[data-raccourci]');
        await c.dort(900);
        await c.marquer('#tco-save-seuils', 'bloc', 'section');
        await c.marquer('[data-tco-onglet="seuils"]', 'onglets', '[role="tablist"]');
        // Deux catégories en heures à l'écran (Chargeuses, Pelles ; les autres ont la même forme) : l'image tient en hauteur.
        await c.ev("[...document.querySelectorAll('[data-seuil-ligne]')].filter((e) => !['c1', 'c2'].includes(e.dataset.categorieId)).forEach((e) => { e.parentElement.style.display = 'none'; }); true");
        await c.repere('[data-tco-onglet="seuils"]', 1);
        await c.repere('[data-seuil-moyenne-categorie="c2"]', 2);
        await c.repere('[data-categorie-id="c2"] [data-raccourci="1"]', 3);
        await c.repere('#tco-save-seuils', 4);
        await toutDansLaZone(c, ['[data-tco-onglet="seuils"]', '[data-seuil-moyenne-categorie="c2"]', '[data-categorie-id="c2"] [data-raccourci="1"]', '#tco-save-seuils'], '#view-root');
        const z = await c.zoneJusqua('[data-aide="onglets"]', '[data-aide="bloc"]', 24);
        return { ...z, x: z.x + 14, largeur: z.largeur - 28 };
      } },
    ],
  },
  {
    id: 'cout-rapport',
    etapes: [
      // 2. En haut de Coûts & TCO : « Rapport TCO (PDF) ».
      { nom: 'bouton', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tco: true });
        await c.ev("UI.tcoOnglet = 'classement'; goTo('tco'); true");
        await c.attendre('#tco-rapport-pdf:not([disabled])', 12000).catch(() => null);
        await c.attendre('.ui-ligne[data-machine]');
        await c.dort(900);
        await c.repere('#tco-rapport-pdf', 2);
        await toutDansLaZone(c, ['#tco-rapport-pdf'], '#view-root');
        const z = await c.zone('#tco-rapport-pdf', 14);
        const haut = await c.zone('#view-root .ui-page', 0);
        return { x: haut.x + 6, y: haut.y + 4, largeur: haut.largeur - 12, hauteur: z.y + z.hauteur - haut.y - 4 + 10 };
      } },
      // 3-4. La fenêtre : « Télécharger le rapport » (3), l'adresse e-mail et « Envoyer par e-mail » (4).
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tco: true });
        const periode = c.langue === 'fr' ? 'Depuis mise en service' : 'Since commissioning';
        await c.ev("ouvrirRapportTcoModal({ donnees: { periodeLabel: " + JSON.stringify(periode) + " } }); true");
        await c.attendre('#rapport-tco-telecharger');
        await c.dort(600);
        await c.ev("document.getElementById('rapport-tco-email').value = 'camille@exemple.fr'; true");
        await c.repere('#rapport-tco-telecharger', 3);
        await c.repere('#rapport-tco-email', 4, { cote: 'droite' });
        await c.repere('#rapport-tco-envoyer', null, { cote: 'droite' });
        await toutDansLaZone(c, ['#rapport-tco-telecharger', '#rapport-tco-email', '#rapport-tco-envoyer'], '.overlay .modal');
        return c.zone('.overlay .modal', 12);
      } },
    ],
  },
  {
    id: 'stk-sortie-intervention',
    etapes: [
      // 1-4. Le bloc de coûts d'une intervention : « + Ajouter une pièce » (1), « Scanner une pièce » (2), quantité et prix (3), case « Sortir du stock » (4).
      { nom: 'pieces', ecran: 'bureau', async jouer(c) {
        await ouvrirIntervention(c);
        await ajouterPieceIntervention(c, 'p1', 2);
        await ajouterPieceIntervention(c, 'p4', 1);
        await c.voir('#log-couts-section', 'start');
        await c.repere('#log-piece-ajouter', 1);
        await c.repere('#log-piece-scanner', 2);
        await c.repere('.log-piece-ligne .log-piece-qte', 3);
        await c.repere('.log-piece-ligne .log-piece-stock', 4);
        await toutDansLaZone(c, ['#log-piece-ajouter', '#log-piece-scanner', '.log-piece-ligne .log-piece-qte', '.log-piece-ligne .log-piece-stock'], '.overlay .modal');
        return c.zone('#log-couts-section', 20);
      } },
    ],
  },
  {
    id: 'cout-intervention',
    etapes: [
      // 1. Les types d'intervention : « Entretien planifié » et « Dépannage / Curatif » (1).
      { nom: 'type', ecran: 'bureau', async jouer(c) {
        await ouvrirIntervention(c);
        await c.voir('[data-kind="entretien"]', 'center');
        await c.repere('[data-kind="entretien"]', 1);
        await c.repere('[data-kind="depannage"]', 1);
        await toutDansLaZone(c, ['[data-kind="entretien"]', '[data-kind="depannage"]'], '.overlay .modal');
        await c.marquer('[data-kind="entretien"]', 'types', 'parent');
        return c.zone('[data-aide="types"]', 50);
      } },
      // 2-5. Le bloc « Coûts d'intervention & TCO » : main d'œuvre (2), « + Ajouter une pièce » (3), « Scanner une facture » (4), total des pièces (5).
      { nom: 'couts', ecran: 'bureau', async jouer(c) {
        await ouvrirIntervention(c);
        await ajouterPieceIntervention(c, 'p1', 2);
        await c.voir('#log-couts-section', 'start');
        await c.repere('#log-heures-mo', null);
        await c.repere('#log-cout-mo', null);
        await c.repere('#log-mo-ajouter', 2, { cote: 'droite' });
        await c.repere('#log-piece-ajouter', 3);
        await c.repere('#log-facture-photo-btn', 4);
        await c.repere('#log-pieces-total', 5);
        await toutDansLaZone(c, ['#log-heures-mo', '#log-cout-mo', '#log-mo-ajouter', '#log-piece-ajouter', '#log-facture-photo-btn', '#log-pieces-total'], '.overlay .modal');
        return c.zone('#log-couts-section', 20);
      } },
    ],
  },
  {
    id: 'cout-frais-carburant',
    etapes: [
      // 2-4. « Frais & Carburant » (2), nature du frais (3), quantité et prix (4).
      { nom: 'frais', ecran: 'bureau', async jouer(c) {
        await ouvrirIntervention(c);
        await c.ev("document.querySelector('[data-kind=\"frais\"]').click(); true");
        await c.attendre('#log-frais-nature-bouton');
        await c.dort(600);
        await c.repere('[data-kind="frais"]', 2);
        await c.repere('#log-frais-nature-bouton', 3, { cote: 'gauche-centre' });
        await c.repere('#log-frais-qte', 4, { cote: 'droite' });
        await c.repere('#log-frais-prix', null);
        await c.repere('#log-submit-btn', 5);
        await toutDansLaZone(c, ['[data-kind="frais"]', '#log-frais-nature-bouton', '#log-frais-qte', '#log-frais-prix', '#log-submit-btn'], '.overlay .modal');
        return c.zone('.overlay .modal', 10);
      } },
    ],
  },
  {
    id: 'sup-suivre-reponse',
    etapes: [
      // 1-3. La pastille du menu (1), la liste « Mes demandes » avec l'étiquette « Nouveau » et les puces de filtre (2), le statut d'un ticket (3).
      { nom: 'liste', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tickets: true });
        await c.ev("goTo('support'); true");
        await c.attendre('.support-liste-nouveau');
        await c.dort(900);
        await c.repere('.sidebar [data-support-pastille]', 1);
        await c.repere('#support-page-filtres', 2);
        await c.repere('.support-liste-nouveau', null);
        await c.repere('.support-liste-ligne .support-statut', 3);
        await toutDansLaZone(c, ['.sidebar [data-support-pastille]', '#support-page-filtres', '.support-liste-nouveau', '.support-liste-ligne .support-statut'], 'body');
        const bas = await c.zone('#support-page-liste', 24);
        return { x: 0, y: 0, largeur: bas.x + bas.largeur, hauteur: bas.y + bas.hauteur };
      } },
      // 4-5. Le fil d'un ticket : les messages et leurs auteurs (4), « Répondre » et « Envoyer » (5).
      { nom: 'fil', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tickets: true });
        await c.ev("ouvrirTicketDepuisPage('aa11bb22-0000-4000-8000-000000000001'); true");
        await c.attendre('.support-bulle');
        await c.dort(800);
        await c.ev('document.activeElement && document.activeElement.blur(); true');
        await c.repere('#support-fil', 4);
        await c.repere('#support-reponse', 5);
        await c.repere('#support-repondre', null, { cote: 'droite' });
        await toutDansLaZone(c, ['#support-fil', '#support-reponse', '#support-repondre'], '.overlay .modal');
        return c.zone('.overlay .modal', 12);
      } },
    ],
  },
  {
    id: 'sup-assistant-humain',
    etapes: [
      // 1-2. Le message de l'assistant « Assistant IA KALEA » (1) et le bouton « Parler à un humain » (2).
      { nom: 'fil', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tickets: true });
        await c.ev("ouvrirTicketDepuisPage('ee55ff66-0000-4000-8000-000000000003'); true");
        await c.attendre('.support-bulle-ligne.is-ia');
        await c.dort(800);
        await c.ev('document.activeElement && document.activeElement.blur(); true');
        await c.repere('.support-bulle-ligne.is-ia .support-bulle-auteur', 1);
        await c.repere('#support-humain', 2);
        await toutDansLaZone(c, ['.support-bulle-ligne.is-ia .support-bulle-auteur', '#support-humain'], '.overlay .modal');
        return c.zone('.overlay .modal', 12);
      } },
      // 3. Après la demande : le message de confirmation sous le champ de réponse.
      { nom: 'confirmation', ecran: 'bureau', async jouer(c) {
        await injecter(c, { tickets: true });
        await c.ev("ouvrirTicketDepuisPage('abcd1234-0000-4000-8000-000000000004'); true");
        await c.attendre('.support-bulle-ligne.is-ia');
        await c.dort(800);
        await c.ev('document.activeElement && document.activeElement.blur(); true');
        await c.repere('#support-fil-msg', 3, { cote: 'droite' });
        await toutDansLaZone(c, ['#support-fil-msg'], '.overlay .modal');
        return c.zone('.overlay .modal', 12);
      } },
    ],
  },
  {
    id: 'tele-relier-machine',
    etapes: [
      // 1-5. Machines reliées : la ligne d'une machine (1), la source (2), l'identifiant du boîtier (3), « Enregistrer » (4), « Localiser » (5).
      { nom: 'machines', ecran: 'bureau', async jouer(c) {
        await injecter(c, { telemetrie: true });
        const L = '#acc-tele-machines [data-machine="m3"]';
        await c.ev("goTo('telemetrie'); true"); 
        await c.attendre(L + ' [data-tele-source]'); 
        await c.dort(900);
        // La machine 3 est en cours de réglage : source choisie et identifiant saisi (rien n'est enregistré).
        await c.ev(`(() => {
          const l = document.querySelector('${L}');
          const sel = l.querySelector('[data-tele-source]'); sel.value = 't1'; sel.dispatchEvent(new Event('change', { bubbles: true }));
          const r = l.querySelector('[data-tele-ref]'); r.value = '352093081234503'; r.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        })()`);
        await c.marquer('#acc-tele-machines', 'reliees', 'section');
        
        
        await c.voir('[data-aide="reliees"]', 'start');
        await c.repere(L, 1, { marge: 3 });
        await c.repere(L + ' [data-tele-source]', 2);
        await c.repere(L + ' [data-tele-ref]', 3);
        await c.repere(L + ' [data-tele-enregistrer]', 4);
        await c.repere(L + ' .ui-case', 5, { marge: 6, cote: 'droite' });
        await toutDansLaZone(c, [L, L + ' [data-tele-source]', L + ' [data-tele-ref]', L + ' [data-tele-enregistrer]', L + ' .ui-case'], '[data-aide="reliees"]');
        return c.zone('[data-aide="reliees"]', 20);
      } },
    ],
  },
];

