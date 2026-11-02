/* Injecté dans l'application locale par outils/aide/captures.mjs (jamais publié, jamais chargé par le site).
   Il remplace la base par un PARC FICTIF : l'application n'appelle plus le serveur, elle dessine seulement ce qu'on lui donne. Aucune donnée réelle n'existe dans ce
   navigateur (profil neuf, aucune session). Les marques et immatriculations sont inventées. Il fournit aussi les repères rouges numérotés des captures. */
(function () {
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const dans = (jours) => new Date(Date.now() + jours * 864e5).toISOString();

  async function preparer() {
    // L'application doit avoir fini de démarrer (écran de connexion affiché, faute de session) AVANT qu'on lui remplace son état.
    for (let i = 0; i < 150 && !(typeof renderApp === 'function' && typeof UI !== 'undefined' && typeof sb !== 'undefined' && document.querySelector('#email, .shell')); i++) await attendre(100);
    await attendre(400);
    Object.keys(SCHEMA).forEach((k) => { if (typeof SCHEMA[k] === 'boolean') SCHEMA[k] = true; });
    // Plus aucun appel serveur : tout renvoie « rien », sans erreur.
    const vide = (t) => { const b = { select() { return b; }, eq() { return b; }, in() { return b; }, order() { return b; }, single() { return b; }, maybeSingle() { return b; }, limit() { return b; }, gte() { return b; }, lte() { return b; }, is() { return b; }, neq() { return b; }, not() { return b; }, then(res) { res({ data: [], error: null, count: 0 }); } }; return b; };
    sb.from = vide;
    sb.rpc = async () => ({ data: [], error: null });
    sb.auth.getUser = async () => ({ data: { user: { id: 'demo-utilisateur', email: 'camille@exemple.fr' } } });
    sb.auth.getSession = async () => ({ data: { session: null } });
    try { sb.storage.from = () => ({ createSignedUrl: async () => ({ data: null, error: new Error('hors démonstration') }), getPublicUrl: () => ({ data: { publicUrl: '' } }), upload: async () => ({ error: null }), remove: async () => ({ error: null }) }); } catch (e) { /* sans importance */ }

    UI.companyId = 'demo-societe'; UI.companyName = 'Société Démo'; UI.contactName = 'Camille Martin'; UI.contactFirstName = 'Camille';
    UI.userId = 'demo-utilisateur'; UI.email = 'camille@exemple.fr'; UI.role = 'gerant'; UI.companyPlan = 'enterprise';
    UI.company = { name: 'Société Démo', plan: 'enterprise', currency: 'EUR', contact_name: 'Camille Martin', structure_type: 'company' };
    UI.categories = [{ id: 'c1', name: 'Pelles' }, { id: 'c2', name: 'Chargeuses' }, { id: 'c3', name: 'Camions' }, { id: 'c4', name: 'Groupes électrogènes' }];
    const plan = (id, mode, intervalle, prochain, jours, extra = {}) => ({ id, tracking_mode: mode, interval_counter: intervalle, next_due_counter: prochain, next_due_at: dans(jours), reminder_days_before: 7, reminder_counter_before: 25, tasks: 'Vidange, graissage, contrôle des filtres', items: [], ...extra });
    UI.machines = [
      { id: 'm1', name: 'Pelle 1,7 t', brand: 'TERRAX', model: 'T17-3', model_year: 2019, serial_number: 'DEMO-T17-0417', kind: 'machine', category_id: 'c1', category: { id: 'c1', name: 'Pelles' }, counter_value: 1250, counter_unit: 'h', archived: false, manual_url: 'demo/carnet.pdf', created_at: dans(-300), plan: plan('p1', 'hours', 250, 1350, 40) },
      { id: 'm2', name: 'Chargeuse sur pneus', brand: 'BOREAL', model: 'B950', model_year: 2016, serial_number: 'DEMO-B950-0033', kind: 'machine', category_id: 'c2', category: { id: 'c2', name: 'Chargeuses' }, counter_value: 5400, counter_unit: 'h', archived: false, created_at: dans(-500), plan: plan('p2', 'hours', 500, 5500, 12) },
      { id: 'm3', name: 'Camion benne', brand: 'ROUTIER', model: 'D-8', model_year: 2021, serial_number: 'AB-123-CD', kind: 'vehicle', category_id: 'c3', category: { id: 'c3', name: 'Camions' }, counter_value: 84500, counter_unit: 'km', archived: false, created_at: dans(-200), plan: plan('p3', 'km', 15000, 90000, -5) },
      { id: 'm4', name: 'Groupe électrogène 60 kVA', brand: 'VOLTA', model: 'G60', model_year: 2018, serial_number: 'DEMO-G60-2210', kind: 'machine', category_id: 'c4', category: { id: 'c4', name: 'Groupes électrogènes' }, counter_value: 820, counter_unit: 'h', archived: false, created_at: dans(-400), plan: plan('p4', 'hours', 250, 1000, 60) },
    ];
    UI.machinesArchivees = [];
    // Interface en anglais : les données fictives (société, catégories, machines, tâches) le sont aussi, sinon les captures EN montrent du français dans les données.
    if (typeof LANGUE !== 'undefined' && LANGUE === 'en') {
      const cats = { c1: 'Excavators', c2: 'Loaders', c3: 'Trucks', c4: 'Generators' };
      const noms = { m1: 'Excavator 1.7 t', m2: 'Wheel loader', m3: 'Dump truck', m4: 'Generator 60 kVA' };
      UI.companyName = 'Demo Company'; UI.company.name = 'Demo Company';
      UI.categories.forEach((k) => { if (cats[k.id]) k.name = cats[k.id]; });
      UI.machines.forEach((m) => {
        if (noms[m.id]) m.name = noms[m.id];
        if (m.category && cats[m.category.id]) m.category.name = cats[m.category.id];
        if (m.plan) m.plan.tasks = 'Oil change, greasing, filter check';
      });
    }
    document.documentElement.removeAttribute('data-theme');
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    return true;
  }

  // ── Repères rouges numérotés (dessinés par-dessus la page avant la capture, retirés après) ──
  function repere(selecteur, numero, options = {}) {
    const el = typeof selecteur === 'string' ? document.querySelector(selecteur) : selecteur;
    if (!el) throw new Error('repère introuvable : ' + selecteur);
    // PAS de défilement ici : les cadres sont fixes à l'écran, un défilement entre deux repères désalignerait les précédents. On défile UNE fois avant (voir()).
    const r = el.getBoundingClientRect(); const m = options.marge == null ? 5 : options.marge;
    if (r.width === 0 || r.height === 0) throw new Error('repère invisible (hors écran ou masqué) : ' + selecteur);
    const cadre = document.createElement('div'); cadre.setAttribute('data-repere-aide', '1');
    cadre.style.cssText = `position:fixed;z-index:2147483000;pointer-events:none;left:${r.left - m}px;top:${r.top - m}px;width:${r.width + 2 * m}px;height:${r.height + 2 * m}px;border:3px solid #D92D20;border-radius:12px;box-shadow:0 0 0 2px rgba(255,255,255,.85);`;
    document.body.appendChild(cadre);
    if (numero) {
      const b = document.createElement('div'); b.setAttribute('data-repere-aide', '1'); b.textContent = String(numero);
      const cote = options.cote || 'gauche';
      let x = cote === 'droite' ? r.right + m - 8 : r.left - m - 14; let y = r.top - m - 14;
      if (cote === 'gauche-centre') { x = r.left - m - 34; y = r.top + r.height / 2 - 14; }   // à gauche du cadre, à mi-hauteur : ne masque aucun libellé
      b.style.cssText = `position:fixed;z-index:2147483001;pointer-events:none;left:${Math.max(4, x)}px;top:${Math.max(4, y)}px;width:28px;height:28px;border-radius:50%;background:#D92D20;color:#fff;font:800 15px/28px 'Figtree',system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff;`;
      document.body.appendChild(b);
    }
    return true;
  }
  const effacer = () => { document.querySelectorAll('[data-repere-aide]').forEach((n) => n.remove()); return true; };
  // Rectangle à photographier : l'élément + une marge, borné à l'écran.
  function zone(selecteur, marge = 18) {
    const el = typeof selecteur === 'string' ? document.querySelector(selecteur) : selecteur;
    if (!el) throw new Error('zone introuvable : ' + selecteur);
    const r = el.getBoundingClientRect();
    const ox = window.pageXOffset || 0; const oy = window.pageYOffset || 0;
    const gx = Math.max(0, r.left - marge); const gy = Math.max(0, r.top - marge);
    return { x: gx + ox, y: gy + oy, largeur: Math.min(innerWidth - gx, r.width + 2 * marge), hauteur: Math.min(innerHeight - gy, r.height + 2 * marge) };
  }
  // Rectangle qui part du HAUT d'un élément (la fenêtre) et s'arrête SOUS un autre : pour ne pas photographier ce qui suit (un encadré avec un prix, par exemple).
  function zoneJusqua(selecteur, selFin, marge = 18) {
    const el = document.querySelector(selecteur); const fin = document.querySelector(selFin);
    if (!el || !fin) throw new Error('zone introuvable : ' + selecteur + ' / ' + selFin);
    const r = el.getBoundingClientRect(); const f = fin.getBoundingClientRect();
    const ox = window.pageXOffset || 0; const oy = window.pageYOffset || 0;
    const gx = Math.max(0, r.left - marge); const gy = Math.max(0, r.top - marge);
    return { x: gx + ox, y: gy + oy, largeur: Math.min(innerWidth - gx, r.width + 2 * marge), hauteur: Math.max(40, f.bottom + marge - gy) };
  }
  // Étiquette un élément (data-aide) pour le retrouver sans dépendre de la langue : par sélecteur (et son ancêtre « parent »), ou par texte (français OU anglais).
  function marquer(selecteur, nom, parent) {
    const el = document.querySelector(selecteur);
    if (!el) throw new Error('à marquer introuvable : ' + selecteur);
    (parent === 'parent' ? el.parentElement : (parent ? el.closest(parent) : el)).setAttribute('data-aide', nom);
    return true;
  }
  function marquerTexte(portee, motif, nom, rang = 0) {
    const re = new RegExp(motif, 'i');
    const net = (e) => (e.textContent || '').trim().replace(/\s+/g, ' ');
    const trouves = [...document.querySelectorAll(portee)].filter((e) => re.test(net(e)));
    if (!trouves[rang]) throw new Error('texte introuvable : ' + motif + ' dans ' + portee + ' — présents : ' + JSON.stringify([...document.querySelectorAll(portee)].map((e) => net(e).slice(0, 30))));
    trouves[rang].setAttribute('data-aide', nom);
    return true;
  }
  // Fait défiler (une seule fois) pour que l'élément soit au milieu de la fenêtre ou de l'écran qui le contient.
  function voir(selecteur, bloc = 'center') {
    const el = document.querySelector(selecteur);
    if (!el) throw new Error('à montrer introuvable : ' + selecteur);
    el.scrollIntoView({ block: bloc, inline: 'nearest' });
    return true;
  }
  // Vérifie que chaque élément repéré est bien DANS la zone photographiée (sinon la capture serait trompeuse) ; renvoie les éléments qui en sortent.
  function horsZone(selecteurs, selZone) {
    const z = document.querySelector(selZone).getBoundingClientRect();
    return selecteurs.filter((s) => { const e = document.querySelector(s); if (!e) return true; const r = e.getBoundingClientRect(); return r.top < z.top - 2 || r.bottom > z.bottom + 2 || r.left < z.left - 2 || r.right > z.right + 2; });
  }
  window.__aide = { preparer, repere, effacer, zone, zoneJusqua, marquer, marquerTexte, voir, horsZone };
})();
