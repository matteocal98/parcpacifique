// Scénarios de capture du lot « entretien, agenda et rappels » (articles : outils/aide/articles-entretien.mjs).
// Même mécanique que scenarios.mjs. Tout ce qui manque au parc fictif (échéances datées, tâches détaillées, historique, drapeau Stock…) est posé ICI, dans le scénario,
// avec c.ev(...) : chaque scénario repart d'une page neuve, donc rien à nettoyer. Les libellés des fausses données suivent la langue (c.langue).

// Échoue si un élément repéré sort de la zone photographiée.
async function toutDansLaZone(c, selecteurs, zone) {
  const dehors = await c.horsZone(selecteurs, zone);
  if (dehors.length) throw new Error('éléments repérés hors de la zone photographiée : ' + dehors.join(', '));
}

// Tâches détaillées d'un plan (les plans du parc fictif n'en ont pas). Libellés dans la langue de la capture.
function tachesFictives(langue, compteur = 1250) {
  const en = langue === 'en';
  return [
    { label: en ? 'Engine oil change' : 'Vidange huile moteur', frequency: en ? 'Every 250 h' : 'Toutes les 250 h', spec: '15W-40', qty: '12 L', interval: 250, interval_unite: 'heures', frequence: { nature: 'periodique', interval: 250, unite: 'heures' }, due_counter: compteur + 20 },
    { label: en ? 'Air filter' : 'Filtre à air', frequency: en ? 'Every 500 h' : 'Toutes les 500 h', spec: en ? 'Cartridge' : 'Cartouche', qty: '1', interval: 500, interval_unite: 'heures', frequence: { nature: 'periodique', interval: 500, unite: 'heures' }, due_counter: compteur + 250 },
    { label: en ? 'Greasing of the arm' : 'Graissage du bras', frequency: en ? 'Every 50 h' : 'Toutes les 50 h', spec: en ? 'Grease' : 'Graisse', qty: '0,5 kg', interval: 50, interval_unite: 'heures', frequence: { nature: 'periodique', interval: 50, unite: 'heures' }, due_counter: compteur - 10 },
    { label: en ? 'Hydraulic filter' : 'Filtre hydraulique', frequency: en ? 'Every 1000 h' : 'Toutes les 1000 h', spec: '', qty: '1', interval: 1000, interval_unite: 'heures', frequence: { nature: 'periodique', interval: 1000, unite: 'heures' }, due_counter: compteur + 750 },
  ];
}
const POSER_TACHES = (langue) => `(() => { UI.machines.find((m) => m.id === 'm1').plan.items = ${JSON.stringify(tachesFictives(langue))}; return true; })()`;


// Anglais : les noms des machines et catégories du parc fictif sont en français ; on les traduit pour que l'image EN ne contienne pas de français.
const LOC = (langue) => (langue !== 'en' ? 'true' : `(() => {
  const cat = { c1: 'Excavators', c2: 'Loaders', c3: 'Trucks', c4: 'Generators' };
  const nom = { m1: 'Excavator 1.7 t', m2: 'Wheel loader', m3: 'Dump truck', m4: 'Generator 60 kVA' };
  UI.categories.forEach((k) => { k.name = cat[k.id] || k.name; });
  UI.machines.forEach((m) => { m.name = nom[m.id] || m.name; if (m.category) m.category.name = cat[m.category_id] || m.category.name; if (m.plan) m.plan.tasks = 'Oil change, greasing, filter check'; });
  return true;
})()`);
// Date relative (AAAA-MM-JJ, heure locale), calculée dans la page.
const JOUR_FN = `const jour = (n) => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };`;
// Machines à échéance DATÉE (celles du parc fictif sont toutes au compteur : le calendrier serait vide). m1 bientôt, m2 en retard, m3 à jour ; m4 reste au compteur.
const DATER_MACHINES = `(() => {
  ${JOUR_FN}
  const dater = (id, jours, intervalle) => { const m = UI.machines.find((x) => x.id === id); m.counter_value = null; m.plan.tracking_mode = 'days'; m.plan.interval_days = intervalle; m.plan.next_due_at = jour(jours); m.plan.next_due_counter = null; m.plan.reminder_days_before = 7; };
  dater('m1', 4, 90); dater('m2', -2, 180); dater('m3', 20, 365);
  return true;
})()`;

// Écran « Plan proposé par notre algorithme » : l'analyse est SIMULÉE (faux PDF, réponse de la fonction d'analyse remplacée), rien n'est envoyé nulle part.
const analyseSimulee = (langue) => {
  const en = langue === 'en';
  return {
    items: [
      { label: en ? 'Engine oil change' : 'Vidange huile moteur', frequency: en ? 'Every 250 h' : 'Toutes les 250 h', spec: '15W-40', qty: '12 L', interval: 250, interval_unite: 'heures' },
      { label: en ? 'Air filter' : 'Filtre à air', frequency: en ? 'Professional: 250 h / Occasional: 500 h' : 'Professionnel : 250 h / Occasionnel : 500 h' },
      { label: en ? 'Greasing' : 'Graissage', frequency: en ? 'Every 50 h' : 'Toutes les 50 h', interval: 50, interval_unite: 'heures' },
    ],
    tasks: en ? 'Oil change, air filter, greasing' : 'Vidange, filtre à air, graissage', notes: '', interval_hours: 250, interval_days: 90,
  };
};
const OUVRIR_PLAN_PROPOSE = (langue) => `(async () => {
  const base = sb.from;
  sb.from = (t) => { const x = base(t); ['update', 'insert', 'delete', 'upsert', 'range', 'or', 'ilike'].forEach((k) => { x[k] = () => x; }); return x; };
  Object.defineProperty(sb, 'functions', { configurable: true, value: { invoke: async () => ({ data: ${JSON.stringify(analyseSimulee(langue))}, error: null }) } });
  openManualUploadModal(UI.machines.find((m) => m.id === 'm1'), new File([new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])], 'carnet.pdf', { type: 'application/pdf' }));
  return true;
})()`;
async function planPropose(c) {
  await c.ev(LOC(c.langue));
  await c.ev("goTo('machines'); true");
  await c.dort(500);
  await c.ev(OUVRIR_PLAN_PROPOSE(c.langue));
  await c.attendre('#btn-analyser-tout', 15000);
  await c.dort(400);
  await c.ev("document.getElementById('btn-analyser-tout').click(); true");
  await c.attendre('#pc-suivre', 15000);
  await c.dort(900);
}

// Historique fictif : l'historique lit la base par pages (range), absente du faux client ; on remplace la lecture par quelques entretiens inventés.
const HISTORIQUE = (langue) => {
  const en = langue === 'en';
  const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  return [
    { id: 'i1', performed_at: jour(-21), hours_at_intervention: 79800, description: en ? 'Oil leak checked, nothing to report' : 'Fuite d\'huile contrôlée, RAS', items_done: en ? ['Engine oil change', 'Fuel filter'] : ['Vidange huile moteur', 'Filtre à carburant'], performed_by: null, parts_cost: 120, labor_cost: 60 },
    { id: 'i2', performed_at: jour(-95), hours_at_intervention: 74500, description: '', items_done: en ? ['Axle greasing'] : ['Graissage des essieux'], performed_by: null, parts_cost: 15, labor_cost: 30 },
    { id: 'i3', performed_at: jour(-190), hours_at_intervention: 69600, description: en ? 'Air filter replaced' : 'Filtre à air remplacé', items_done: en ? ['Air filter', 'Engine oil change'] : ['Filtre à air', 'Vidange huile moteur'], performed_by: null, parts_cost: 150, labor_cost: 90 },
  ];
};
const POSER_HISTORIQUE = (langue) => `(() => { window.fetchAllInterventions = async () => ${JSON.stringify(HISTORIQUE(langue))}; return true; })()`;

// Fiche « Plan d'entretien & historique » du camion (suivi au kilomètre) : tâches détaillées (une en retard, une bientôt, une à trancher entre deux fréquences) et historique fictif.
// Le camion et non la pelle : en anglais, l'application ne reconnaît pas l'unité « heures » d'une tâche (elle compare avec sa traduction « hours ») et refait alors les échéances ; « km » ne change pas de langue.
const TACHES_CAMION = (langue) => {
  const en = langue === 'en';
  const per = (n, u) => ({ nature: 'periodique', interval: n, unite: u });
  const opt = [{ libelle: en ? 'Professional' : 'Professionnel', interval: 15000, unite: 'km' }, { libelle: en ? 'Occasional' : 'Occasionnel', interval: 30000, unite: 'km' }];
  return [
    { label: en ? 'Engine oil change' : 'Vidange huile moteur', frequency: en ? 'Every 15,000 km' : 'Tous les 15 000 km', spec: '10W-40', qty: '24 L', interval: 15000, interval_unite: 'km', frequence: per(15000, 'km'), due_counter: 84520 },
    { label: en ? 'Fuel filter' : 'Filtre à carburant', frequency: en ? 'Professional: 15,000 km / Occasional: 30,000 km' : 'Professionnel : 15 000 km / Occasionnel : 30 000 km', spec: en ? 'Cartridge' : 'Cartouche', qty: '1', frequence: { nature: 'a_choisir', options: opt }, interval_choices: opt },
    { label: en ? 'Axle greasing' : 'Graissage des essieux', frequency: en ? 'Every 5,000 km' : 'Tous les 5 000 km', spec: en ? 'Grease' : 'Graisse', qty: '0,5 kg', interval: 5000, interval_unite: 'km', frequence: per(5000, 'km'), due_counter: 84490 },
    { label: en ? 'Air filter' : 'Filtre à air', frequency: en ? 'Every 60,000 km' : 'Tous les 60 000 km', spec: '', qty: '1', interval: 60000, interval_unite: 'km', frequence: per(60000, 'km'), due_counter: 120000 },
  ];
};
async function ouvrirFiche(c, echeancePlan = 84520) {
  await c.ev(LOC(c.langue));
  await c.ev(`(() => { const m3 = UI.machines.find((m) => m.id === 'm3'); m3.plan.items = ${JSON.stringify(TACHES_CAMION(c.langue))}; m3.plan.next_due_counter = ${echeancePlan}; return true; })()`);
  await c.ev(POSER_HISTORIQUE(c.langue));
  await c.ev("goTo('machines'); true");
  await c.dort(500);
  await c.ev("openPlanView(UI.machines.find((m) => m.id === 'm3'), UI.companyId, UI.categories); true");
  await c.attendre('#log-from-plan');
  await c.dort(1200);
}

// Module Stock : drapeaux de schéma absents du parc fictif, plus un petit catalogue de pièces et un kit inventés.
const POSER_STOCK = (langue) => {
  const en = langue === 'en';
  const pieces = [
    { id: 'pc1', designation: en ? 'Engine oil filter' : 'Filtre à huile moteur', reference: 'FH-210', unit_price: 12 },
    { id: 'pc2', designation: en ? 'Engine oil 10W-40 (litre)' : 'Huile moteur 10W-40 (litre)', reference: 'HM-1040', unit_price: 6 },
    { id: 'pc3', designation: en ? 'Fuel filter' : 'Filtre à carburant', reference: 'FC-118', unit_price: 18 },
  ];
  return `(() => {
    SCHEMA.hasStock = true; SCHEMA.hasKits = true;
    UI.partsCatalog = ${JSON.stringify(pieces)};
    UI.maintenanceKits = [{ id: 'k1', name: ${JSON.stringify(en ? 'Oil change kit' : 'Kit vidange')}, note: null, active: true }];
    UI.maintenanceKitLines = [{ id: 'l1', kit_id: 'k1', part_id: 'pc1', quantity: 1 }, { id: 'l2', kit_id: 'k1', part_id: 'pc2', quantity: 24 }];
    return true;
  })()`;
};

// Plans à échéance DATÉE avec liste de pièces (pour la préparation des pièces) : la pelle (m1) et la chargeuse (m2), plus le camion au km (m3) pour montrer « Au compteur ».
const POSER_PIECES = (langue) => {
  const en = langue === 'en';
  const t = (label, freq, spec, qty, n, unite, jours) => ({ label, frequency: freq, spec, qty, interval: n, interval_unite: unite, frequence: { nature: 'periodique', interval: n, unite }, __jours: jours });
  const m1 = [
    t(en ? 'Engine oil change' : 'Vidange huile moteur', en ? 'Every 6 months' : 'Tous les 6 mois', '15W-40', '12 L', 6, 'mois', 4),
    t(en ? 'Oil filter' : 'Filtre à huile', en ? 'Every 6 months' : 'Tous les 6 mois', en ? 'Filter' : 'Filtre', '1', 6, 'mois', 4),
    t(en ? 'Greasing of the arm' : 'Graissage du bras', en ? 'Every month' : 'Tous les mois', en ? 'Grease' : 'Graisse', '0,5 kg', 1, 'mois', 20),
  ];
  const m2 = [
    t(en ? 'Hydraulic oil' : 'Huile hydraulique', en ? 'Every year' : 'Tous les ans', 'HV 46', '40 L', 12, 'mois', 25),
    t(en ? 'Air filter' : 'Filtre à air', en ? 'Every 6 months' : 'Tous les 6 mois', en ? 'Cartridge' : 'Cartouche', '2', 6, 'mois', 25),
    t(en ? 'Brake pads' : 'Plaquettes de frein', en ? 'Every year' : 'Tous les ans', en ? 'Pads' : 'Plaquettes', '4', 12, 'mois', 60),
  ];
  return `(() => {
    ${JOUR_FN}
    const poser = (id, items, jours) => { const m = UI.machines.find((x) => x.id === id); m.counter_value = null; m.plan.tracking_mode = 'days'; m.plan.interval_days = 180; m.plan.next_due_counter = null; m.plan.next_due_at = jour(jours); m.plan.items = items.map((it) => { const { __jours, ...r } = it; return { ...r, due_at: jour(__jours) }; }); };
    poser('m1', ${JSON.stringify(m1)}, 4); poser('m2', ${JSON.stringify(m2)}, 25);
    UI.machines.find((m) => m.id === 'm3').plan.items = ${JSON.stringify(TACHES_CAMION(langue))};
    return true;
  })()`;
};

// Ouvre la fenêtre « Enregistrer une intervention » de la pelle (cartes de type visibles : offre Enterprise).
async function ouvrirFenetreIntervention(c) {
  await c.ev(POSER_TACHES(c.langue));
  await c.ev("goTo('machines'); true");
  await c.dort(500);
  await c.ev("openLogInterventionModal(UI.machines.find((m) => m.id === 'm1')); true");
  await c.attendre('#log-submit-btn');
  await c.dort(900);
}

// Machine suivie au calendrier dont les tâches sont en heures et qui n'a aucun compteur : la fenêtre d'intervention affiche l'encadré « Compteur manquant ».
async function ouvrirFenetreSansCompteur(c) {
  const en = c.langue === 'en';
  const items = [
    { label: en ? 'Engine oil change' : 'Vidange huile moteur', frequency: en ? 'Every 500 h' : 'Toutes les 500 h', spec: '15W-40', qty: '40 L', interval: 500, interval_unite: 'heures', frequence: { nature: 'periodique', interval: 500, unite: 'heures' } },
    { label: en ? 'Hydraulic filter' : 'Filtre hydraulique', frequency: en ? 'Every 1000 h' : 'Toutes les 1000 h', spec: '', qty: '1', interval: 1000, interval_unite: 'heures', frequence: { nature: 'periodique', interval: 1000, unite: 'heures' } },
  ];
  await c.ev(`(() => { const m = UI.machines.find((x) => x.id === 'm2'); m.plan.tracking_mode = 'days'; m.plan.interval_days = 180; m.counter_value = null; m.plan.next_due_counter = null; m.plan.items = ${JSON.stringify(items)}; return true; })()`);
  await c.ev("goTo('machines'); true");
  await c.dort(500);
  await c.ev("openLogInterventionModal(UI.machines.find((m) => m.id === 'm2')); true");
  await c.attendre('.log-alerte-compteur');
  await c.dort(800);
}

export const SCENARIOS = [
  // ───────────────────────────────────────────────────────────── Enregistrer une intervention
  {
    id: 'ent-enregistrer-intervention',
    etapes: [
      // 1. La carte de la machine et son bouton « Enregistrer une intervention ».
      { nom: 'carte', ecran: 'bureau', async jouer(c) {
        await c.ev(LOC(c.langue));
        await c.ev("goTo('machines'); true");
        await c.attendre('[data-open="log"][data-id="m1"]');
        await c.dort(500);
        await c.repere('[data-open="log"][data-id="m1"]', 1);
        return c.zone('article.mstrip:has([data-open="log"][data-id="m1"])', 16);
      } },
      // 2 à 5. La fenêtre : date et compteur, éléments cochés, intervenant et remarques, bouton de validation.
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await c.ev(LOC(c.langue));
        await c.ev("goTo('machines'); true");
        await c.dort(500);
        await c.ev(POSER_TACHES(c.langue));
        await c.ev("openLogInterventionModal(UI.machines.find((m) => m.id === 'm1')); true");
        await c.attendre('#log-submit-btn');
        await c.dort(900);
        // Deux éléments cochés d'avance : on montre l'état « en cours de saisie ».
        await c.ev("(() => { document.querySelectorAll('.overlay .log-checklist input').forEach((k, i) => { if (i < 2 && !k.checked) k.click(); }); return true; })()");
        await c.dort(400);
        // Le bloc « Coûts d'intervention » n'est pas décrit dans l'article et allongerait la fenêtre au-delà de l'écran : on le masque pour la photo.
        await c.ev("(() => { const b = document.getElementById('log-couts-section'); if (b) b.style.display = 'none'; return true; })()");
        await c.marquer('#log-date', 'date', 'parent');
        await c.marquer('#log-operateur', 'intervenant', 'parent');
        await c.dort(300);
        await c.repere('[data-aide="date"]', 2, { cote: 'gauche-centre', marge: 2 });
        await c.repere('#log-compteur-bloc', null, { marge: 2 });
        await c.repere('#log-checklist', 3, { cote: 'gauche-centre' });
        await c.repere('[data-aide="intervenant"]', 4, { cote: 'droite', marge: 2 });
        await c.repere('#log-remarques-section', 4, { marge: 2 });
        await c.repere('#log-submit-btn', 5, { cote: 'droite' });
        await toutDansLaZone(c, ['[data-aide="date"]', '#log-compteur-bloc', '#log-checklist', '[data-aide="intervenant"]', '#log-remarques-section', '#log-submit-btn'], '.overlay .modal');
        return c.zone('.overlay .modal', 8);
      } },
    ],
  },

  // ───────────────────────────────────────────────────────────── Comprendre l'agenda
  {
    id: 'ent-comprendre-agenda',
    etapes: [
      // 2 à 4 : le calendrier du mois avec ses pastilles, l'affichage, les filtres par état.
      { nom: 'calendrier', ecran: 'bureau', async jouer(c) {
        await c.ev(LOC(c.langue));
        await c.ev(DATER_MACHINES);
        await c.ev("goTo('agenda'); true");
        await c.attendre('.agenda-grille');
        await c.dort(900);
        // Repères posés sur des éléments trouvés par structure (aucun texte) : identiques en français et en anglais.
        await c.ev("(() => { const m = (e, n) => e && e.setAttribute('data-aide', n); m(document.querySelector('[data-agenda-vue]').parentElement, 'affichage'); m(document.querySelector('[data-agenda-statut]').parentElement, 'filtres'); const pt = document.querySelector('.agenda-jour-dot.is-soon'); m(pt && pt.closest('.agenda-jour'), 'jour'); return true; })()");
        await c.voir('.agenda-legende', 'nearest');
        await c.repere('[data-aide="affichage"]', 2);
        await c.repere('[data-aide="filtres"]', 3);
        await c.repere('.agenda-legende', null, { marge: 4 });
        await c.repere('[data-aide="jour"]', 4, { marge: 2 });
        await toutDansLaZone(c, ['[data-aide="affichage"]', '[data-aide="filtres"]', '.agenda-legende', '[data-aide="jour"]'], 'section.vue-agenda');
        return c.zone('section.vue-agenda', 14);
      } },
      // 5. La liste chronologique : entretiens datés par mois, puis les machines « Suivi au compteur ».
      { nom: 'liste', ecran: 'bureau', async jouer(c) {
        await c.ev(LOC(c.langue));
        await c.ev(DATER_MACHINES);
        await c.ev("goTo('agenda'); UI.agendaVue = 'liste'; renderApp(); true");
        await c.attendre('.agenda-souscompteur');
        await c.dort(900);
        await c.repere('.agenda-souscompteur', 5, { marge: 6 });
        await toutDansLaZone(c, ['.agenda-souscompteur'], 'section.vue-agenda');
        return c.zone('section.vue-agenda', 14);
      } },
    ],
  },

  // ───────────────────────────────────────────────────────────── Valider le plan proposé
  {
    id: 'ent-valider-plan-propose',
    etapes: [
      // 2 et 3 : la proposition (échéance, tableau et statuts) et les trois voies.
      { nom: 'proposition', ecran: 'bureau', async jouer(c) {
        await planPropose(c);
        await c.repere('.pplan-resume', 2, { marge: 3 });
        await c.repere('.pplan-table', 2, { marge: 3 });
        await c.repere('.pplan-choix', 3, { marge: 4 });
        await toutDansLaZone(c, ['.pplan-resume', '.pplan-table', '.pplan-choix'], '.pplan-modal');
        return c.zone('.pplan-modal', 30);
      } },
      // 4 et 5 : l'écran « Modifier ce plan » (crayon, corbeille, ajouter une ligne, filtrer) et « Activer le plan ».
      { nom: 'modifier', ecran: 'bureau', async jouer(c) {
        await planPropose(c);
        await c.ev("document.getElementById('pc-modifier').click(); true");
        await c.attendre('#mu-activate', 15000);
        await c.dort(900);
        await c.repere('.pplan-btn-modifier', 4, { marge: 3 });
        await c.repere('.pplan-btn-supprimer', null, { marge: 3 });
        await c.repere('#mu-item-ajouter', 4, { marge: 3 });
        await c.repere('#mu-filtrer-btn', null, { marge: 3 });
        await c.repere('#mu-activate', 5, { cote: 'droite', marge: 3 });
        await toutDansLaZone(c, ['.pplan-btn-modifier', '.pplan-btn-supprimer', '#mu-item-ajouter', '#mu-filtrer-btn', '#mu-activate'], '.pplan-modal');
        return c.zone('.pplan-modal', 30);
      } },
    ],
  },

  // ───────────────────────────────────────────────────────────── Rappels par e-mail
  {
    id: 'ent-rappels-email',
    etapes: [
      // 1 à 4 : le bloc « Recevoir les rappels par e-mail » — adresse, case à cocher, bouton d'enregistrement.
      { nom: 'bloc-email', ecran: 'bureau', async jouer(c) {
        await c.ev(LOC(c.langue));
        await c.ev("goTo('reminders'); true");
        await c.attendre('#rap-save');
        await c.dort(900);
        await c.marquer('#rap-email', 'bloc', 'section');
        await c.marquer('#rap-par-email', 'case', 'label');
        await c.repere('#rap-email', 2, { cote: 'gauche-centre', marge: 3 });
        await c.repere('[data-aide="case"]', 3, { cote: 'gauche-centre', marge: 4 });
        await c.repere('#rap-save', 4, { cote: 'gauche-centre', marge: 3 });
        await toutDansLaZone(c, ['#rap-email', '[data-aide="case"]', '#rap-save'], '[data-aide="bloc"]');
        return c.zone('[data-aide="bloc"]', 20);
      } },
    ],
  },

  // ───────────────────────────────────────────────────────────── Lire le plan d'entretien
  {
    id: 'ent-lire-plan-entretien',
    etapes: [
      // 2 et 5 : le haut de la fiche — bandeau d'état avec ses trois cartes, barre d'outils.
      { nom: 'bandeau', ecran: 'bureau', async jouer(c) {
        await ouvrirFiche(c);
        await c.repere('.fm2-hero', 2, { marge: 3 });
        await c.repere('.fm-toolbar', 5, { marge: 3 });
        await toutDansLaZone(c, ['.fm2-hero', '.fm-toolbar'], '.overlay .modal');
        return c.zoneJusqua('.overlay .modal', '.fm2-hero', 14);
      } },
      // 3 et 4 : le tableau de référence, les puces de filtre et le bouton « Choisir » d'une tâche à trancher.
      { nom: 'tableau', ecran: 'bureau', async jouer(c) {
        await ouvrirFiche(c);
        await c.marquer('.ref-table', 'tableau', 'section');
        await c.repere('.ref-scroll-plan', 3, { cote: 'gauche', marge: 3 });
        await c.repere('.fm-filtres', 4, { marge: 4 });
        await c.repere('.choisir-frequence', 4, { marge: 3 });
        await toutDansLaZone(c, ['.ref-scroll-plan', '.fm-filtres', '.choisir-frequence'], '[data-aide="tableau"]');
        return c.zone('[data-aide="tableau"]', 14);
      } },
    ],
  },

  // ───────────────────────────────────────────────────────────── Historique des interventions
  {
    id: 'ent-historique-interventions',
    etapes: [
      // 2 à 4 : la carte « Historique des entretiens » au bas de la fiche, son tableau et le bouton d'export.
      { nom: 'historique', ecran: 'bureau', async jouer(c) {
        await ouvrirFiche(c);
        await c.attendre('#export-history-csv');
        await c.dort(600);
        await c.voir('#history-section', 'center');
        await c.dort(400);
        await c.repere('#history-section', 2, { marge: 4 });
        await c.repere('#history-section table', 3, { cote: 'gauche', marge: 3 });
        await c.repere('#export-history-csv', 4, { marge: 3 });
        await toutDansLaZone(c, ['#history-section table', '#export-history-csv'], '#history-section');
        return c.zone('#history-section', 20);
      } },
    ],
  },

  // ───────────────────────────────────────────────────────────── Kits d'entretien
  {
    id: 'ent-kits-entretien',
    etapes: [
      // 2. La fenêtre « Nouveau kit d'entretien » (nom, pièces du kit, enregistrer).
      { nom: 'nouveau-kit', ecran: 'bureau', async jouer(c) {
        await c.ev(LOC(c.langue));
        await c.ev(POSER_STOCK(c.langue));
        await c.ev("goTo('machines'); true");
        await c.dort(500);
        await c.ev("ouvrirEditionKit(null); true");
        await c.attendre('#kit-enregistrer');
        await c.dort(700);
        await c.ev(`(() => { const n = document.getElementById('kit-nom'); n.value = ${JSON.stringify(c.langue === 'en' ? 'Oil change kit' : 'Kit vidange')}; const q = document.querySelector('[data-kit-ligne-qte]'); if (q) q.value = '1'; return true; })()`);
        await c.repere('#kit-nom', 2, { cote: 'gauche-centre', marge: 3 });
        await c.repere('#kit-lignes', 2, { cote: 'gauche-centre', marge: 4 });
        await c.repere('#kit-enregistrer', 2, { marge: 3 });
        await toutDansLaZone(c, ['#kit-nom', '#kit-lignes', '#kit-enregistrer'], '.stock-kit-modal .modal');
        return c.zone('.stock-kit-modal .modal', 30);
      } },
      // 3. La fiche du plan : colonne « Pièces associées » et un bouton par tâche.
      { nom: 'colonne', ecran: 'bureau', async jouer(c) {
        await c.ev(POSER_STOCK(c.langue));
        await ouvrirFiche(c);
        await c.marquer('.ref-table', 'tableau', 'section');
        await c.repere('.ref-table th:nth-child(7)', 3, { marge: 3 });
        await c.repere('.ref-table .choisir-kit', 4, { marge: 3 });
        await toutDansLaZone(c, ['.ref-table th:nth-child(7)', '.ref-table .choisir-kit'], '[data-aide="tableau"]');
        return c.zone('[data-aide="tableau"]', 14);
      } },
      // 4. La fenêtre « Pièces de maintenance associées à cette tâche » : kit d'entretien ou pièce seule, puis Enregistrer.
      { nom: 'association', ecran: 'bureau', async jouer(c) {
        await c.ev(POSER_STOCK(c.langue));
        await ouvrirFiche(c);
        await c.ev("document.querySelector('.ref-table .choisir-kit').click(); true");
        await c.attendre('#kit-tache-enregistrer');
        await c.dort(700);
        await c.repere('#kit-tache-select', 4, { cote: 'gauche-centre', marge: 3 });
        await c.ev("(() => { const e = document.getElementById('kit-tache-piece-select').nextElementSibling; e.setAttribute('data-aide', 'piece'); return true; })()");
        await c.repere('[data-aide="piece"]', 4, { cote: 'gauche-centre', marge: 3 });
        await c.repere('#kit-tache-enregistrer', 4, { marge: 3 });
        await toutDansLaZone(c, ['#kit-tache-select', '[data-aide="piece"]', '#kit-tache-enregistrer'], '.kit-tache-modal .modal');
        return c.zone('.kit-tache-modal .modal', 30);
      } },
    ],
  },

  // ───────────────────────────────────────────────────────────── Dépannage et frais
  {
    id: 'ent-intervention-depannage-frais',
    etapes: [
      // 2. Les trois cartes de type d'intervention.
      { nom: 'types', ecran: 'bureau', async jouer(c) {
        await ouvrirFenetreIntervention(c);
        await c.repere('.log-type-grid', 2, { cote: 'gauche', marge: 4 });
        await toutDansLaZone(c, ['.log-type-grid'], '.overlay .modal');
        return c.zoneJusqua('.overlay .modal', '.log-type-grid', 20);
      } },
      // 3. Le type « Dépannage » : organe, gravité, diagnostic.
      { nom: 'depannage', ecran: 'bureau', async jouer(c) {
        await ouvrirFenetreIntervention(c);
        await c.ev("document.querySelector('.log-type-carte[data-kind=\"depannage\"]').click(); true");
        await c.dort(700);
        await c.marquer('#log-organe', 'organe', 'parent');
        await c.repere('.log-type-carte[data-kind="depannage"]', 2, { marge: 3 });
        await c.repere('#log-panel-depannage', 3, { cote: 'gauche', marge: 4 });
        await toutDansLaZone(c, ['.log-type-carte[data-kind="depannage"]', '#log-panel-depannage'], '.overlay .modal');
        return c.zoneJusqua('.overlay .modal', '#log-panel-depannage', 20);
      } },
      // 4. Le type « Frais & Carburant » : nature du frais, quantité, prix unitaire.
      { nom: 'frais', ecran: 'bureau', async jouer(c) {
        await ouvrirFenetreIntervention(c);
        await c.ev("document.querySelector('.log-type-carte[data-kind=\"frais\"]').click(); true");
        await c.dort(700);
        await c.repere('.log-type-carte[data-kind="frais"]', 2, { marge: 3 });
        await c.repere('#log-panel-frais', 4, { cote: 'gauche', marge: 4 });
        await toutDansLaZone(c, ['.log-type-carte[data-kind="frais"]', '#log-panel-frais'], '.overlay .modal');
        return c.zoneJusqua('.overlay .modal', '#log-panel-frais', 20);
      } },
    ],
  },
  // ───────────────────────────────────────────────────────────── Planifier un entretien
  {
    id: 'ent-planifier-entretien',
    etapes: [
      // 2. La fenêtre d'un jour du calendrier, avec « Planifier un entretien ».
      { nom: 'jour', ecran: 'bureau', async jouer(c) {
        await c.ev(DATER_MACHINES);
        await c.ev("goTo('agenda'); true");
        await c.attendre('.agenda-jour-dot.is-soon');
        await c.dort(600);
        await c.ev("document.querySelector('.agenda-jour-dot.is-soon').click(); true");
        await c.attendre('#agenda-jour-planifier');
        await c.dort(700);
        await c.repere('#agenda-jour-planifier', 2, { marge: 3 });
        await toutDansLaZone(c, ['#agenda-jour-planifier'], '.agenda-jour-modal .modal');
        return c.zone('.agenda-jour-modal .modal', 24);
      } },
      // 3 et 4. La fenêtre « Planifier un entretien » : date, recherche, liste, bouton de confirmation.
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await c.ev(DATER_MACHINES);
        await c.ev("goTo('agenda'); true");
        await c.attendre('.agenda-jour-dot.is-soon');
        await c.dort(600);
        await c.ev("document.querySelector('.agenda-jour-dot.is-soon').click(); true");
        await c.attendre('#agenda-jour-planifier');
        await c.dort(500);
        await c.ev("document.getElementById('agenda-jour-planifier').click(); true");
        await c.attendre('#pe-confirmer');
        await c.dort(700);
        await c.ev("document.querySelector('.pe-machine').click(); true");
        await c.dort(500);
        await c.marquer('#prog-date', 'date', 'parent');
        await c.repere('[data-aide="date"]', null, { marge: 3 });
        await c.repere('#pe-recherche', 3, { marge: 3 });
        await c.repere('#pe-confirmer', 4, { marge: 3 });
        await toutDansLaZone(c, ['[data-aide="date"]', '#pe-recherche', '#pe-confirmer'], '.agenda-planifier-modal .modal');
        return c.zone('.agenda-planifier-modal .modal', 24);
      } },
    ],
  },

  // ───────────────────────────────────────────────────────────── Choisir la fréquence d'une tâche
  {
    id: 'ent-choisir-frequence',
    etapes: [
      // 1. La fiche : bouton « Choisir » dans la colonne Échéance et carte « Fréquences à préciser ».
      { nom: 'fiche', ecran: 'bureau', async jouer(c) {
        await ouvrirFiche(c);
        await c.marquer('.ref-table', 'tableau', 'section');
        await c.marquer('.view-manual.choisir-frequence', 'carte', 'section');
        await c.repere('.ref-table .choisir-frequence', 1, { marge: 3 });
        await c.repere('.view-manual.choisir-frequence', 1, { marge: 3 });
        await toutDansLaZone(c, ['.ref-table .choisir-frequence', '.view-manual.choisir-frequence'], '.overlay .modal');
        return c.zoneJusqua('[data-aide="tableau"]', '[data-aide="carte"]', 14);
      } },
      // 2 à 4. La fenêtre de choix : options du carnet, personnalisation libre, point de contrôle.
      { nom: 'choix', ecran: 'bureau', async jouer(c) {
        await ouvrirFiche(c);
        await c.ev("document.querySelector('.ref-table .choisir-frequence').click(); true");
        await c.attendre('#choix-annuler');
        await c.dort(800);
        await c.repere('.choix-bloc-carnet', 2, { cote: 'gauche', marge: 3 });
        await c.repere('.choix-bloc-libre', 3, { cote: 'gauche', marge: 3 });
        await c.repere('.choix-bloc-controle', 4, { cote: 'gauche', marge: 3 });
        await toutDansLaZone(c, ['.choix-bloc-carnet', '.choix-bloc-libre', '.choix-bloc-controle'], '.choix-frequence-modal .modal');
        return c.zone('.choix-frequence-modal .modal', 30);
      } },
    ],
  },

  // ───────────────────────────────────────────────────────────── Intégrer l'agenda à son calendrier
  {
    id: 'ent-exporter-agenda',
    etapes: [
      // 2. L'en-tête de la carte Agenda : le bouton d'intégration au calendrier.
      { nom: 'bouton', ecran: 'bureau', async jouer(c) {
        await c.ev(DATER_MACHINES);
        await c.ev("goTo('agenda'); true");
        await c.attendre('#agenda-export-ics');
        await c.dort(800);
        await c.marquer('[data-agenda-vue]', 'affichage', 'parent');
        await c.repere('#agenda-export-ics', 2, { marge: 4 });
        await toutDansLaZone(c, ['#agenda-export-ics'], 'section.vue-agenda');
        return c.zoneJusqua('section.vue-agenda', '[data-aide="affichage"]', 14);
      } },
    ],
  },
  // ───────────────────────────────────────────────────────────── Préparation des pièces
  {
    id: 'ent-preparation-pieces',
    etapes: [
      // 2 à 4. La carte : boutons de période, familles de produits, copier la liste et export.
      { nom: 'carte', ecran: 'bureau', async jouer(c) {
        await c.ev(POSER_PIECES(c.langue));
        await c.ev("UI.agendaPiecesDetail = false; goTo('agenda'); true");
        await c.attendre('.prep-detail-carte');
        await c.dort(900);
        await c.voir('.prep-detail-carte', 'start');
        await c.dort(400);
        await c.repere('.prep-detail-carte .ui-segment', 2, { marge: 4 });
        await c.repere('.prep-detail-carte .ui-deux', 3, { cote: 'gauche', marge: 4 });
        await c.repere('#prep-copier', 4, { marge: 4 });
        await c.repere('#agenda-pieces-detail-toggle', 4, { marge: 4 });
        await toutDansLaZone(c, ['.prep-detail-carte .ui-segment', '.prep-detail-carte .ui-deux', '#prep-copier', '#agenda-pieces-detail-toggle'], '.prep-detail-carte');
        return c.zone('.prep-detail-carte', 20);
      } },
      // 4. « Export et bon de commande » déplié : export CSV et bon de commande express.
      { nom: 'export', ecran: 'bureau', async jouer(c) {
        await c.ev(POSER_PIECES(c.langue));
        await c.ev("UI.agendaPiecesDetail = true; goTo('agenda'); true");
        await c.attendre('#prep-export');
        await c.dort(900);
        await c.voir('#agenda-pieces-detail-toggle', 'start');
        await c.dort(400);
        await c.repere('#agenda-pieces-detail-toggle', 4, { marge: 4 });
        await c.repere('#prep-export', 4, { marge: 4 });
        await c.repere('.agenda-pieces-detail .bon-commande, .agenda-pieces-detail > div:last-child', null, { marge: 4 });
        return c.ev("(() => { const a = document.getElementById('agenda-pieces-detail-toggle').getBoundingClientRect(); const b = document.querySelector('.agenda-pieces-detail').getBoundingClientRect(); const m = 24; return { x: Math.max(0, b.left - m) + (window.pageXOffset || 0), y: Math.max(0, a.top - m) + (window.pageYOffset || 0), largeur: Math.min(innerWidth, b.width + 2 * m), hauteur: Math.min(innerHeight, b.bottom - a.top + 2 * m) }; })()");
      } },
    ],
  },

  // ───────────────────────────────────────────────────────────── Alerte « Compteur manquant »
  {
    id: 'ent-alerte-compteur-manquant',
    etapes: [
      // 1 et 2. La fenêtre d'intervention d'une machine suivie au calendrier dont les tâches sont en heures, sans compteur : l'encadré et son bouton.
      { nom: 'encadre', ecran: 'bureau', async jouer(c) {
        await ouvrirFenetreSansCompteur(c);
        await c.repere('.log-alerte-compteur', 1, { cote: 'gauche', marge: 3 });
        await c.repere('[data-log-renseigner-compteur]', 2, { cote: 'gauche-centre', marge: 3 });
        await toutDansLaZone(c, ['.log-alerte-compteur', '[data-log-renseigner-compteur]'], '.overlay .modal');
        return c.zoneJusqua('.overlay .modal', '.log-alerte-compteur', 24);
      } },
      // 3. « Modifier une machine » ouverte par le bouton : la case « Ajouter un second suivi ».
      { nom: 'second-suivi', ecran: 'bureau', async jouer(c) {
        await ouvrirFenetreSansCompteur(c);
        await c.ev("document.querySelector('[data-log-renseigner-compteur]').click(); true");
        await c.attendre('#f-secondaire-active');
        await c.dort(900);
        await c.ev("(() => { const k = document.getElementById('f-secondaire-active'); if (k && !k.checked) k.click(); return true; })()");
        await c.dort(500);
        await c.marquer('#f-secondaire-active', 'case', 'parent');
        await c.voir('#f-secondaire-valeur');
        await c.repere('[data-aide="case"]', 3, { cote: 'gauche-centre' });
        await c.repere('#f-secondaire-valeur', 3, { cote: 'gauche-centre' });
        await toutDansLaZone(c, ['[data-aide="case"]', '#f-secondaire-valeur'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
    ],
  },
  // ───────────────────────────────────────────────────────────── Utilisation moyenne et dates estimées
  {
    id: 'ent-rythme-utilisation',
    etapes: [
      // 2 et 3. La ligne « Utilisation moyenne » sous les trois cartes, avec la période des relevés et la mention d'estimation fragile.
      { nom: 'utilisation', ecran: 'bureau', async jouer(c) {
        await c.ev("(() => { UI.rythmes = { 'm3|1': 160 }; UI.rythmesDetail = { 'm3|1': { nb: 2, premier: '2026-10-22', dernier: '2026-11-01' } }; return true; })()");
        await ouvrirFiche(c);
        await c.repere('.fm2-usage', 2, { cote: 'gauche-centre', marge: 4 });
        await toutDansLaZone(c, ['.fm2-usage'], '.fm2-hero');
        return c.zone('.fm2-hero', 14);
      } },
      // 5. Les alertes d'usage du tableau de bord : la fenêtre « Relevés en retard », avec « Ouvrir la fiche » et « Reporter ».
      { nom: 'alertes', ecran: 'bureau', async jouer(c) {
        await c.ev("(() => { UI.alertesUsage = [{ machine_id: 'm1', type: 'releve_oublie', counter_index: 1, detail: { jours_depuis: 18, mediane_jours: 7 } }, { machine_id: 'm4', type: 'releve_oublie', counter_index: 1, detail: { jours_depuis: 12 } }]; return true; })()");
        await c.ev("goTo('dashboard'); true");
        await c.dort(900);
        await c.ev("ouvrirAlertesUsage('releve_oublie'); true");
        await c.attendre('[data-alerte-ouvrir]');
        await c.dort(700);
        await c.repere('[data-alerte-ouvrir="0"]', 5, { cote: 'gauche-centre', marge: 3 });
        await c.repere('[data-alerte-reporter="0"]', 5, { cote: 'droite', marge: 3 });
        await toutDansLaZone(c, ['[data-alerte-ouvrir="0"]', '[data-alerte-reporter="0"]'], '.panne-liste-modal');
        return c.zone('.panne-liste-modal', 30);
      } },
    ],
  },
  // ───────────────────────────────────────────────────────────── Pourquoi mon échéance a changé
  {
    id: 'ent-pourquoi-echeance',
    etapes: [
      // 2. La colonne « Échéance » : la tâche la plus proche (ici en retard) est celle qui commande l'échéance du plan.
      { nom: 'echeances', ecran: 'bureau', async jouer(c) {
        await ouvrirFiche(c, 84490);
        await c.marquer('.ref-table', 'tableau', 'section');
        await c.repere('.ref-table th:nth-child(3)', 2, { marge: 3 });
        await c.repere('.ref-table tbody tr:nth-child(3)', 2, { cote: 'gauche', marge: 2 });
        await toutDansLaZone(c, ['.ref-table th:nth-child(3)', '.ref-table tbody tr:nth-child(3)'], '[data-aide="tableau"]');
        return c.zone('[data-aide="tableau"]', 14);
      } },
    ],
  },
  // ───────────────────────────────────────────────────────────── Je ne reçois pas mes rappels
  {
    id: 'ent-rappels-non-recus',
    etapes: [
      // 1 et 2. La tuile « Canal d'alerte e-mail » et la pastille du bloc e-mail (canal inactif tant que rien n'est enregistré), puis le bouton d'enregistrement.
      { nom: 'canal', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('reminders'); true");
        await c.attendre('#rap-save');
        await c.dort(900);
        await c.marquerTexte('section.rappels-bloc span', '^(Canal inactif|Channel inactive)$', 'pastille');
        await c.repere('.ui-tuile', 1, { marge: 4 });
        await c.repere('[data-aide="pastille"]', 1, { marge: 4 });
        await c.repere('#rap-save', 2, { marge: 4 });
        return c.ev("(() => { const a = document.querySelector('.ui-tuile').getBoundingClientRect(); const b = document.getElementById('rap-save').getBoundingClientRect(); const m = 26; return { x: Math.max(0, a.left - m) + (window.pageXOffset || 0), y: Math.max(0, a.top - m) + (window.pageYOffset || 0), largeur: Math.min(innerWidth, 1128 + 2 * m), hauteur: Math.min(innerHeight, b.bottom - a.top + 2 * m) }; })()");
      } },
    ],
  },
];
