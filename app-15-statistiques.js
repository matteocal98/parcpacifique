// ═══════════════════════════════════════════════════════════════════════════
// STATISTIQUES (Stock & achats › Statistiques) — maquette validée le 2026-10-14.
// Trois onglets : Coûts, Maintenance, Stock. Tout est calculé côté navigateur à partir de ce que la société a DÉJÀ
// enregistré (interventions, coûts d'exploitation, pannes, mouvements, commandes) : aucune donnée n'est inventée,
// et un graphique sans donnée affiche « aucune donnée » plutôt qu'une courbe vide.
// Les graphiques sont de simples SVG dessinés ici (aucune bibliothèque à charger : règle de sécurité de la page).
//
// Ce qui n'existe pas en base n'est pas affiché : l'historique mois par mois du « respect du plan » et de la
// disponibilité n'est pas conservé (seul l'état d'aujourd'hui l'est) ; la valeur du stock dans le temps est donc
// RECONSTITUÉE à partir des mouvements et annoncée comme estimée.
// ═══════════════════════════════════════════════════════════════════════════

const STATS_COULEURS = { pieces: '#6366F1', mo: '#24B5A8', expl: '#DE7A16', arret: '#0E1333', gris: '#C7CAD9', texte: 'rgba(14,19,51,.62)' };

function statsEtat() {
  if (!UI.stats) UI.stats = { periode: '12m', categorie: '', machine: '', onglet: 'couts', donnees: null, erreur: null, chargement: false };
  return UI.stats;
}
function statsOngletsDisponibles() {
  const liste = [];
  if (tcoActif()) liste.push({ id: 'couts', libelle: trad('Coûts') });
  liste.push({ id: 'maintenance', libelle: trad('Maintenance') });
  if (SCHEMA.hasStock && planCouvreStock() && vueAutoriseePourRole('stock')) liste.push({ id: 'stock', libelle: trad('Stock') });
  return liste;
}
function statsOngletActif() {
  const onglets = statsOngletsDisponibles();
  const voulu = statsEtat().onglet;
  return onglets.some((o) => o.id === voulu) ? voulu : onglets[0].id;
}
const statsEtroit = () => (typeof window !== 'undefined' && window.innerWidth < 900);

// ── Lecture des données (une fois par ouverture de la page ; les filtres recalculent en mémoire) ──────────────
async function statsLireTable(table, colonnes, appliquer, tri) {
  const taille = 1000;
  const tout = [];
  for (let de = 0; de < 30000; de += taille) {
    let req = sb.from(table).select(colonnes);
    if (appliquer) req = appliquer(req);
    if (tri) req = req.order(tri, { ascending: false });
    const { data, error } = await req.range(de, de + taille - 1);
    if (error) throw error;
    tout.push(...(data || []));
    if (!data || data.length < taille) break;
  }
  return tout;
}
async function statsChargerDonnees() {
  const ids = (UI.machines || []).map((m) => m.id);
  const depuis = new Date(Date.now() - 36 * 31 * 86400000).toISOString();
  const d = { interventions: [], couts: [], pannes: [], mouvements: [], commandes: [], receptions: [] };
  const taches = [];
  if (ids.length) {
    taches.push(statsLireTable('interventions', 'machine_id, kind, parts_cost, labor_cost, performed_at', (r) => r.in('machine_id', ids))
      .catch(() => statsLireTable('interventions', 'machine_id, parts_cost, labor_cost, performed_at', (r) => r.in('machine_id', ids)))
      .then((x) => { d.interventions = x; }));
    taches.push(statsLireTable('operating_costs', 'machine_id, amount, incurred_at, kind', (r) => r.in('machine_id', ids)).then((x) => { d.couts = x; }).catch(() => {}));
    if (SCHEMA.hasPannes) {
      const cols = SCHEMA.hasArretCout ? 'machine_id, status, stopped, reported_at, resolved_at, downtime_hours, downtime_cost' : 'machine_id, status, stopped, reported_at, resolved_at';
      taches.push(statsLireTable('machine_breakdowns', cols, (r) => r.eq('company_id', UI.companyId)).then((x) => { d.pannes = x; }).catch(() => {}));
    }
  }
  if (SCHEMA.hasStock && planCouvreStock()) {
    taches.push(statsLireTable('stock_movements', 'part_id, type, quantity, unit_cost, resulting_pump_cost, performed_at',
      (r) => r.eq('company_id', UI.companyId).gte('performed_at', depuis)).then((x) => { d.mouvements = x; }).catch(() => {}));
    taches.push(statsLireTable('purchase_orders', 'id, supplier_name, status, requested_delivery, total_estimated, created_at, sent_at, closed_at',
      (r) => r.eq('company_id', UI.companyId)).then((x) => { d.commandes = x; }).catch(() => {}));
    taches.push(statsLireTable('purchase_order_receipts', 'order_id, quantity, unit_cost, received_at',
      (r) => r.eq('company_id', UI.companyId)).then((x) => { d.receptions = x; }).catch(() => {}));
  }
  await Promise.all(taches);
  return d;
}

// ── Périodes ─────────────────────────────────────────────────────────────────────────────────────────────
const statsCle = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
function statsMois(periode, plusAncienne) {
  const maintenant = new Date();
  const fin = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  let debut = new Date(fin.getFullYear(), fin.getMonth() - 11, 1);
  if (periode === 'annee') debut = new Date(maintenant.getFullYear(), 0, 1);
  if (periode === 'tout') {
    debut = plusAncienne ? new Date(plusAncienne.getFullYear(), plusAncienne.getMonth(), 1) : debut;
    const plancher = new Date(fin.getFullYear(), fin.getMonth() - 35, 1);
    if (debut < plancher) debut = plancher;
  }
  const liste = [];
  for (let d = new Date(debut); d <= fin; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const annee = String(d.getFullYear()).slice(2);
    liste.push({ cle: statsCle(d), label: moisCourt(d.getMonth()) + (d.getMonth() === 0 || !liste.length ? ` ${annee}` : '') });
  }
  return liste;
}
function statsMoisPrecedents(mois) {
  if (!mois.length) return [];
  const [a, m] = mois[0].cle.split('-').map(Number);
  const liste = [];
  for (let i = mois.length; i >= 1; i--) liste.push(statsCle(new Date(a, m - 1 - i, 1)));
  return liste;
}

// ── Calculs ──────────────────────────────────────────────────────────────────────────────────────────────
const statsNombre = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const statsCleDe = (valeur) => String(valeur || '').slice(0, 7);
const statsSomme = (tab) => tab.reduce((s, x) => s + x, 0);

function statsCalculer(d, f) {
  const machines = (UI.machines || []).filter((m) => (!f.categorie || (m.category && m.category.id === f.categorie)) && (!f.machine || m.id === f.machine));
  const ids = new Set(machines.map((m) => m.id));
  const filtre = !!(f.categorie || f.machine);
  const garde = (r) => !filtre || ids.has(r.machine_id);
  const nomMachine = new Map((UI.machines || []).map((m) => [m.id, m.name]));

  const datees = [];
  d.interventions.forEach((r) => datees.push(r.performed_at));
  d.couts.forEach((r) => datees.push(r.incurred_at));
  d.pannes.forEach((r) => datees.push(r.resolved_at || r.reported_at));
  const plusAncienne = datees.filter(Boolean).map((x) => new Date(x)).filter((x) => !isNaN(x)).sort((a, b) => a - b)[0] || null;
  const mois = statsMois(f.periode, plusAncienne);
  const cles = mois.map((m) => m.cle);
  const rang = new Map(cles.map((c, i) => [c, i]));
  const precedents = f.periode === 'tout' ? [] : statsMoisPrecedents(mois);
  const rangPrec = new Set(precedents);
  const n = mois.length;
  const zero = () => Array(n).fill(0);

  const pieces = zero(); const mo = zero(); const expl = zero(); const arret = zero();
  const interv = { entretien: zero(), depannage: zero(), frais: zero() };
  const pannesMois = zero();
  const parMachine = new Map();           // machine_id -> { pieces, mo, expl, arret, interv, prec }
  const ligne = (id) => { if (!parMachine.has(id)) parMachine.set(id, { pieces: 0, mo: 0, expl: 0, arret: 0, interv: 0, prec: 0 }); return parMachine.get(id); };
  let totalPrec = 0;

  d.interventions.filter(garde).forEach((r) => {
    const cle = statsCleDe(r.performed_at); const i = rang.get(cle);
    const p = statsNombre(r.parts_cost); const l = statsNombre(r.labor_cost);
    if (i != null) {
      pieces[i] += p; mo[i] += l;
      const type = r.kind === 'depannage' ? 'depannage' : (r.kind === 'frais' ? 'frais' : 'entretien');
      interv[type][i] += 1;
      const lg = ligne(r.machine_id); lg.pieces += p; lg.mo += l; lg.interv += 1;
    } else if (rangPrec.has(cle)) { totalPrec += p + l; ligne(r.machine_id).prec += p + l; }
  });
  d.couts.filter(garde).forEach((r) => {
    const cle = statsCleDe(r.incurred_at); const i = rang.get(cle); const a = statsNombre(r.amount);
    if (i != null) { expl[i] += a; ligne(r.machine_id).expl += a; }
    else if (rangPrec.has(cle)) { totalPrec += a; ligne(r.machine_id).prec += a; }
  });
  let heuresArret = 0; let nbPannes = 0; let nbBloquantes = 0; let delaiTotal = 0; let delaiN = 0;
  const heuresParMachine = new Map();
  d.pannes.filter(garde).forEach((r) => {
    const iRep = rang.get(statsCleDe(r.reported_at));
    if (iRep != null) { pannesMois[iRep] += 1; nbPannes += 1; }
    if (r.status !== 'resolue') return;
    const iRes = rang.get(statsCleDe(r.resolved_at));
    const cle = statsCleDe(r.resolved_at);
    const cout = statsNombre(r.downtime_cost);
    if (iRes != null) {
      if (r.stopped) {
        arret[iRes] += cout;
        const h = statsNombre(r.downtime_hours);
        heuresArret += h;
        heuresParMachine.set(r.machine_id, (heuresParMachine.get(r.machine_id) || 0) + h);
        ligne(r.machine_id).arret += cout;
      }
      if (r.reported_at && r.resolved_at) {
        const h = (new Date(r.resolved_at) - new Date(r.reported_at)) / 3600000;
        if (Number.isFinite(h) && h >= 0) { delaiTotal += h; delaiN += 1; }
      }
    } else if (rangPrec.has(cle)) { totalPrec += cout; ligne(r.machine_id).prec += cout; }
  });
  void nbBloquantes;

  const totalPieces = statsSomme(pieces); const totalMo = statsSomme(mo); const totalExpl = statsSomme(expl); const totalArret = statsSomme(arret);
  const total = totalPieces + totalMo + totalExpl + totalArret;

  // Coût par unité d'usage de chaque machine, depuis la mise en service (même calcul que Coûts & TCO), comparé au seuil de sa catégorie.
  const interParMachine = grouperParMachine(d.interventions);
  const coutsParMachine = grouperParMachine(d.couts);
  const arretsParMachine = grouperParMachine(d.pannes.filter((p) => p.status === 'resolue' && p.stopped && p.downtime_hours != null));
  const horaire = machines.map((m) => {
    const tco = tcoMachine(m, interParMachine.get(m.id) || [], coutsParMachine.get(m.id) || [], arretsParMachine.get(m.id) || []);
    if (!tco || tco.coutParUnite == null) return null;
    const seuil = m.category && m.category.target_hourly_cost != null ? Number(m.category.target_hourly_cost) : null;
    return { n: m.name, v: tco.coutParUnite, s: seuil, u: m.counter_unit === 'km' ? 'km' : 'h' };
  }).filter(Boolean).sort((a, b) => b.v - a.v).slice(0, 8);
  const auDessusSeuil = horaire.filter((x) => x.s != null && x.v > x.s).length;
  const avecSeuil = horaire.filter((x) => x.s != null).length;

  const top = [...parMachine.entries()].map(([id, l]) => ({ id, nom: nomMachine.get(id) || '—', ...l, total: l.pieces + l.mo + l.expl + l.arret }))
    .filter((l) => l.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
  const cumul = []; let acc = 0; for (let i = 0; i < n; i++) { acc += pieces[i] + mo[i] + expl[i] + arret[i]; cumul.push(acc); }

  const nbInterv = statsSomme(interv.entretien) + statsSomme(interv.depannage) + statsSomme(interv.frais);
  const heuresMachine = [...heuresParMachine.entries()].map(([id, v]) => ({ n: nomMachine.get(id) || '—', v })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 7);
  const intervMachine = top.length || nbInterv
    ? [...parMachine.entries()].map(([id, l]) => ({ n: nomMachine.get(id) || '—', v: l.interv })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 8) : [];
  const etatParc = machineCounts(machines);

  const stock = (SCHEMA.hasStock && planCouvreStock()) ? statsCalculerStock(d, cles, rang, mois, f) : null;

  return {
    mois, n, machines, total, totalPieces, totalMo, totalExpl, totalArret, totalPrec, pieces, mo, expl, arret, cumul, horaire, auDessusSeuil, avecSeuil, top,
    interv, nbInterv, pannesMois, nbPannes, heuresArret, delaiMoyen: delaiN ? delaiTotal / delaiN : null, delaiN, heuresMachine, intervMachine, etatParc, stock,
    comparaison: f.periode !== 'tout',
  };
}

function statsCalculerStock(d, cles, rang, mois, f) {
  const parts = new Map((UI.partsCatalog || []).map((p) => [p.id, p]));
  const pump = new Map();            // part_id -> coût moyen pondéré actuel
  const valeurPiece = new Map();     // part_id -> valeur en stock
  let valeur = 0;
  (UI.stockItems || []).forEach((s) => {
    const v = statsNombre(s.quantity) * statsNombre(s.pump_unit_cost);
    valeur += v;
    valeurPiece.set(s.part_id, (valeurPiece.get(s.part_id) || 0) + v);
    if (s.pump_unit_cost != null) pump.set(s.part_id, statsNombre(s.pump_unit_cost));
  });
  const coutMvt = (m) => statsNombre(m.unit_cost != null ? m.unit_cost : (m.resulting_pump_cost != null ? m.resulting_pump_cost : pump.get(m.part_id)));
  const impact = (m) => {
    const q = statsNombre(m.quantity);
    if (m.type === 'entree') return Math.abs(q) * coutMvt(m);
    if (m.type === 'sortie') return -Math.abs(q) * coutMvt(m);
    if (m.type === 'ajustement') return q * coutMvt(m);
    return 0;
  };
  const entrees = Array(mois.length).fill(0); const sorties = Array(mois.length).fill(0);
  const consommation = new Map();
  const il12 = new Date(Date.now() - 365 * 86400000);
  let sorties12 = 0;
  d.mouvements.forEach((m) => {
    const i = rang.get(statsCleDe(m.performed_at));
    if (i != null) {
      if (m.type === 'entree') entrees[i] += 1;
      if (m.type === 'sortie') { sorties[i] += 1; consommation.set(m.part_id, (consommation.get(m.part_id) || 0) + Math.abs(statsNombre(m.quantity))); }
    }
    if (m.type === 'sortie' && new Date(m.performed_at) >= il12) sorties12 += Math.abs(statsNombre(m.quantity)) * coutMvt(m);
  });
  // Valeur à la fin de chaque mois = valeur actuelle moins l'effet des mouvements survenus après.
  const valeurs = mois.map((mm) => {
    const [a, mo] = mm.cle.split('-').map(Number);
    const limite = new Date(a, mo, 1);           // 1er jour du mois suivant
    if (limite > new Date()) return valeur;
    return valeur - d.mouvements.filter((m) => new Date(m.performed_at) >= limite).reduce((s, m) => s + impact(m), 0);
  });
  const topConso = [...consommation.entries()].map(([id, v]) => ({ n: (parts.get(id) || {}).designation || '—', v })).sort((a, b) => b.v - a.v).slice(0, 7);
  const abcBrut = [...valeurPiece.entries()].filter(([, v]) => v > 0).map(([id, v]) => ({ n: (parts.get(id) || {}).designation || '—', v })).sort((a, b) => b.v - a.v);
  const abc = abcBrut.slice(0, 10);
  const reste = statsSomme(abcBrut.slice(10).map((x) => x.v));
  if (reste > 0) abc.push({ n: trad('Autres'), v: reste });
  const famille = new Map();
  valeurPiece.forEach((v, id) => {
    const cle = categorieProduit((parts.get(id) || {}).designation);
    famille.set(cle, (famille.get(cle) || 0) + v);
  });
  const libelleFamille = (cle) => { const c = CATEGORIES_PRODUIT.find((x) => x.cle === cle); return c ? trad(c.libelle) : trad('Autres'); };
  const familles = [...famille.entries()].filter(([, v]) => v > 0).map(([cle, v]) => ({ n: libelleFamille(cle), v })).sort((a, b) => b.v - a.v);

  const commande = new Map(d.commandes.map((c) => [c.id, c]));
  const achatFournisseur = new Map();
  const periodeCles = new Set(cles);
  d.receptions.forEach((r) => {
    if (!periodeCles.has(statsCleDe(r.received_at))) return;
    const nom = (commande.get(r.order_id) || {}).supplier_name || '—';
    achatFournisseur.set(nom, (achatFournisseur.get(nom) || 0) + statsNombre(r.quantity) * statsNombre(r.unit_cost));
  });
  const achats = [...achatFournisseur.entries()].map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v).slice(0, 6);
  const delais = new Map();
  d.commandes.filter((c) => c.status === 'recue' && c.sent_at && c.closed_at).forEach((c) => {
    const constate = (new Date(c.closed_at) - new Date(c.sent_at)) / 86400000;
    const promis = c.requested_delivery ? (new Date(c.requested_delivery) - new Date(c.sent_at)) / 86400000 : null;
    if (!delais.has(c.supplier_name)) delais.set(c.supplier_name, { c: 0, p: 0, np: 0, n: 0 });
    const x = delais.get(c.supplier_name); x.c += constate; x.n += 1; if (promis != null && promis >= 0) { x.p += promis; x.np += 1; }
  });
  const delaisListe = [...delais.entries()].map(([n, x]) => ({ n, constate: x.c / x.n, promis: x.np ? x.p / x.np : null, nb: x.n })).sort((a, b) => b.nb - a.nb).slice(0, 5);
  const enCours = d.commandes.filter((c) => c.status === 'envoyee' || c.status === 'partielle');
  const rotation = valeur > 0 ? sorties12 / valeur : null;
  const couverture = sorties12 > 0 ? valeur / (sorties12 / 365) : null;
  return {
    valeur, valeurs, entrees, sorties, topConso, abc, familles, achats, delaisListe, rotation, couverture, sorties12,
    alertes: (UI.stockCounts && UI.stockCounts.seuilBas) || 0, nbEnCours: enCours.length, montantEnCours: statsSomme(enCours.map((c) => statsNombre(c.total_estimated))),
  };
}

// ── Dessin des graphiques (SVG) ──────────────────────────────────────────────────────────────────────────
const statsFmt = (v) => Math.round(v).toLocaleString(localeActive());
function statsAxe(max, n = 4, entier = false) {
  const brut = (max || 1) / n; const mag = Math.pow(10, Math.floor(Math.log10(brut || 1))); const f = brut / mag;
  let pas = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  if (entier) pas = Math.max(1, Math.ceil(pas));       // des comptes (pannes, interventions) : jamais de graduation décimale
  const nb = entier ? Math.max(1, Math.ceil((max || 1) / pas)) : n;
  return Array.from({ length: nb + 1 }, (_, i) => i * pas);
}
function statsVide() { return `<p class="ui-aide">${esc(trad('Aucune donnée sur cette période.'))}</p>`; }
function statsSvgBarresEmpilees(labels, series, W, H) {
  const m = { l: 46, r: 8, t: 10, b: 26 }; const w = W - m.l - m.r; const h = H - m.t - m.b;
  const tot = labels.map((_, i) => series.reduce((s, x) => s + x.data[i], 0));
  if (!Math.max(...tot)) return statsVide();
  const ticks = statsAxe(Math.max(...tot), 4, series.every((x) => x.argent === false)); const max = ticks[ticks.length - 1] || 1;
  const bw = w / labels.length * 0.62; const saut = labels.length > 14 ? Math.ceil(labels.length / 12) : (W < 500 ? 2 : 1);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(trad('Graphique en barres'))}">`;
  ticks.forEach((t) => { const y = m.t + h - t / max * h; s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="rgba(14,19,51,.08)"/><text x="${m.l - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${STATS_COULEURS.texte}">${statsFmt(t)}</text>`; });
  labels.forEach((lb, i) => {
    const x = m.l + w / labels.length * i + (w / labels.length - bw) / 2; let y = m.t + h;
    series.forEach((se, k) => { const hh = se.data[i] / max * h; if (hh <= 0) return; y -= hh; s += `<rect x="${x}" y="${y}" width="${bw}" height="${hh}" fill="${se.color}"${k === series.length - 1 ? ' rx="3"' : ''}><title>${esc(lb)} — ${esc(se.name)} : ${esc(formatMontantOuNombre(se.data[i], se.argent))}</title></rect>`; });
    if (i % saut === 0) s += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${STATS_COULEURS.texte}">${esc(lb)}</text>`;
  });
  return `${s}</svg>`;
}
function formatMontantOuNombre(v, argent) { return argent === false ? statsFmt(v) : formatMontant(v); }
function statsSvgAnneau(parts, taille, centre, sous) {
  const total = statsSomme(parts.map((p) => p.v));
  if (!total) return statsVide();
  const r = taille / 2 - 14; const c = taille / 2; let a0 = -Math.PI / 2;
  let s = `<svg viewBox="0 0 ${taille} ${taille}" width="${taille}" height="${taille}" role="img" aria-label="${esc(trad('Graphique en anneau'))}">`;
  parts.filter((p) => p.v > 0).forEach((p) => {
    const part = p.v / total; const a1 = a0 + Math.min(part, 0.9999) * 2 * Math.PI; const grand = a1 - a0 > Math.PI ? 1 : 0;
    s += `<path d="M${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A${r} ${r} 0 ${grand} 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)}" fill="none" stroke="${p.color}" stroke-width="22"><title>${esc(p.n)} : ${Math.round(part * 100)} %</title></path>`;
    a0 = a1;
  });
  s += `<text x="${c}" y="${c + (sous ? 0 : 5)}" text-anchor="middle" font-size="19" font-weight="800" fill="#0E1333">${esc(centre)}</text>`;
  if (sous) s += `<text x="${c}" y="${c + 16}" text-anchor="middle" font-size="11" fill="${STATS_COULEURS.texte}">${esc(sous)}</text>`;
  return `${s}</svg>`;
}
function statsSvgBarresH(items, opt) {
  const o = Object.assign({ W: 520, rowH: 34, fmtv: (v) => statsFmt(v), couleur: STATS_COULEURS.pieces, seuil: false }, opt || {});
  if (!items.length) return statsVide();
  const lab = Math.min(176, o.W * 0.4); const max = Math.max(...items.map((i) => Math.max(i.v, i.s || 0))) * 1.08 || 1;
  const w = o.W - lab - 74; const H = items.length * o.rowH + 8; const maxCar = Math.max(10, Math.floor((lab - 14) / 6.8));
  let s = `<svg viewBox="0 0 ${o.W} ${H}" width="100%" role="img" aria-label="${esc(trad('Graphique en barres horizontales'))}">`;
  items.forEach((it, i) => {
    const y = 4 + i * o.rowH; const bw = it.v / max * w; const depasse = o.seuil && it.s != null && it.v > it.s;
    const nom = String(it.n).length > maxCar ? `${String(it.n).slice(0, maxCar - 1)}…` : String(it.n);
    s += `<text x="${lab - 10}" y="${y + o.rowH / 2 + 3}" text-anchor="end" font-size="12" fill="#0E1333" font-weight="600">${esc(nom)}</text>`;
    s += `<rect x="${lab}" y="${y + 6}" width="${w}" height="${o.rowH - 14}" rx="5" fill="rgba(14,19,51,.05)"/>`;
    s += `<rect x="${lab}" y="${y + 6}" width="${Math.max(bw, 2)}" height="${o.rowH - 14}" rx="5" fill="${depasse ? STATS_COULEURS.expl : o.couleur}"><title>${esc(it.n)} : ${esc(o.fmtv(it.v, it))}</title></rect>`;
    s += `<text x="${o.W - 6}" y="${y + o.rowH / 2 + 3}" text-anchor="end" font-size="12" font-weight="700" fill="#0E1333">${esc(o.fmtv(it.v, it))}</text>`;
    if (o.seuil && it.s != null) { const xs = lab + it.s / max * w; s += `<line x1="${xs}" x2="${xs}" y1="${y + 2}" y2="${y + o.rowH - 4}" stroke="#0E1333" stroke-width="2"/>`; }
  });
  return `${s}</svg>`;
}
function statsSvgCourbe(labels, data, opt) {
  const o = Object.assign({ W: 620, H: 210, couleur: STATS_COULEURS.pieces, fmty: (v) => statsFmt(v), min: 0 }, opt || {});
  if (!data.length || !Math.max(...data)) return statsVide();
  const m = { l: 50, r: 14, t: 12, b: 26 }; const w = o.W - m.l - m.r; const h = o.H - m.t - m.b;
  const ticks = statsAxe(Math.max(...data)); const hi = ticks[ticks.length - 1] || 1;
  const px = (i) => m.l + (labels.length > 1 ? w * i / (labels.length - 1) : w / 2); const py = (v) => m.t + h - v / hi * h;
  const saut = labels.length > 14 ? Math.ceil(labels.length / 12) : (o.W < 500 ? 2 : 1);
  let s = `<svg viewBox="0 0 ${o.W} ${o.H}" width="100%" role="img" aria-label="${esc(trad('Courbe'))}">`;
  ticks.forEach((t) => { const y = py(t); s += `<line x1="${m.l}" x2="${o.W - m.r}" y1="${y}" y2="${y}" stroke="rgba(14,19,51,.08)"/><text x="${m.l - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${STATS_COULEURS.texte}">${esc(o.fmty(t))}</text>`; });
  const pts = data.map((v, i) => `${px(i)},${py(v)}`).join(' ');
  s += `<polygon points="${m.l},${m.t + h} ${pts} ${px(data.length - 1)},${m.t + h}" fill="${o.couleur}" opacity=".12"/>`;
  s += `<polyline points="${pts}" fill="none" stroke="${o.couleur}" stroke-width="2.5" stroke-linejoin="round"/>`;
  data.forEach((v, i) => { s += `<circle cx="${px(i)}" cy="${py(v)}" r="3.5" fill="#fff" stroke="${o.couleur}" stroke-width="2"><title>${esc(labels[i])} : ${esc(o.fmty(v))}</title></circle>`; });
  labels.forEach((lb, i) => { if (i % saut === 0) s += `<text x="${px(i)}" y="${o.H - 8}" text-anchor="middle" font-size="11" fill="${STATS_COULEURS.texte}">${esc(lb)}</text>`; });
  return `${s}</svg>`;
}
function statsSvgDivergentes(labels, haut, bas, W, H) {
  if (!Math.max(...haut, ...bas)) return statsVide();
  const m = { l: 8, r: 8, t: 8, b: 24 }; const w = W - m.l - m.r; const h = H - m.t - m.b;
  const max = Math.max(...haut, ...bas) + 1; const y0 = m.t + h / 2; const bw = w / labels.length * 0.62; const saut = labels.length > 14 ? Math.ceil(labels.length / 12) : (W < 500 ? 2 : 1);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(trad('Graphique en barres'))}"><line x1="${m.l}" x2="${W - m.r}" y1="${y0}" y2="${y0}" stroke="rgba(14,19,51,.25)"/>`;
  labels.forEach((lb, i) => {
    const x = m.l + w / labels.length * i + (w / labels.length - bw) / 2; const hh = haut[i] / max * (h / 2); const bb = bas[i] / max * (h / 2);
    s += `<rect x="${x}" y="${y0 - hh}" width="${bw}" height="${hh}" fill="${STATS_COULEURS.mo}" rx="2"><title>${esc(lb)} — ${esc(trad('Entrées'))} : ${haut[i]}</title></rect>`;
    s += `<rect x="${x}" y="${y0}" width="${bw}" height="${bb}" fill="${STATS_COULEURS.expl}" rx="2"><title>${esc(lb)} — ${esc(trad('Sorties'))} : ${bas[i]}</title></rect>`;
    if (i % saut === 0) s += `<text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle" font-size="10" fill="${STATS_COULEURS.texte}">${esc(lb.split(' ')[0])}</text>`;
  });
  return `${s}</svg>`;
}
function statsSvgPareto(items, W, H) {
  const total = statsSomme(items.map((i) => i.v));
  if (!total) return statsVide();
  const m = { l: 34, r: 40, t: 10, b: 62 }; const w = W - m.l - m.r; const h = H - m.t - m.b;
  const max = Math.max(...items.map((i) => i.v)) * 1.1; const bw = w / items.length * 0.62; let cum = 0; let pts = '';
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(trad('Analyse ABC'))}">`;
  [0, 25, 50, 75, 100].forEach((p) => { const y = m.t + h - p / 100 * h; s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="rgba(14,19,51,.08)"/><text x="${W - m.r + 6}" y="${y + 4}" font-size="11" fill="${STATS_COULEURS.texte}">${p} %</text>`; });
  items.forEach((it, i) => {
    const x = m.l + w / items.length * i + (w / items.length - bw) / 2; const hh = it.v / max * h; cum += it.v; const cy = m.t + h - cum / total * h;
    const classe = cum / total <= 0.8 ? STATS_COULEURS.pieces : (cum / total <= 0.95 ? STATS_COULEURS.mo : STATS_COULEURS.gris);
    const nom = String(it.n).length > 16 ? `${String(it.n).slice(0, 15)}…` : String(it.n);
    s += `<rect x="${x}" y="${m.t + h - hh}" width="${bw}" height="${hh}" rx="3" fill="${classe}"><title>${esc(it.n)} : ${esc(formatMontant(it.v))}</title></rect>`;
    s += `<text x="${x + bw / 2}" y="${m.t + h + 12}" text-anchor="end" font-size="10" fill="${STATS_COULEURS.texte}" transform="rotate(-35 ${x + bw / 2} ${m.t + h + 12})">${esc(nom)}</text>`;
    pts += `${x + bw / 2},${cy} `;
  });
  return `${s}<polyline points="${pts}" fill="none" stroke="#0E1333" stroke-width="2"/></svg>`;
}

// ── Pièces d'interface ───────────────────────────────────────────────────────────────────────────────────
function statsTendance(courant, precedent, opt) {
  const o = Object.assign({ moinsEstBien: true, seuil: 0.01 }, opt || {});
  if (!precedent || precedent <= 0) return '';
  const ecart = (courant - precedent) / precedent;
  if (Math.abs(ecart) < o.seuil) return `<span class="stat-tendance t-neutre">0 %</span>`;
  const bon = o.moinsEstBien ? ecart < 0 : ecart > 0;
  return `<span class="stat-tendance ${bon ? 't-bien' : 't-mal'}">${ecart > 0 ? '+' : '−'}${Math.round(Math.abs(ecart) * 100)} %</span>`;
}
function statsTuile(e, v, note, opt) {
  const o = opt || {};
  return `<div class="ui-tuile${o.classe ? ` ${o.classe}` : ''}"><span class="ui-tuile-etiquette">${esc(e)}</span><span class="ui-tuile-valeur">${v}${o.unite ? `<small>${esc(o.unite)}</small>` : ''}${o.tendance || ''}</span><span class="ui-tuile-note">${esc(note || '')}</span></div>`;
}
function statsCarte(span, titre, sous, corps, legende) {
  const leg = legende && legende.length ? `<div class="stat-legende">${legende.map(([n, c, v]) => `<span><i style="background:${c}"></i>${esc(n)}${v ? ` <b>${esc(v)}</b>` : ''}</span>`).join('')}</div>` : '';
  return `<div class="stat-carte ${span}"><h3>${esc(titre)}</h3><div class="sous">${esc(sous)}</div>${corps}${leg}</div>`;
}
const statsPct = (v, tot) => (tot > 0 ? `${Math.round(v / tot * 100)} %` : '0 %');
function statsHeures(h) { return `${(Math.round(h * 10) / 10).toLocaleString(localeActive())}`; }

function statsPanneauCouts(m) {
  const etroit = statsEtroit();
  const moyenne = m.machines.length ? m.total / m.machines.length : 0;
  const tuiles = [
    statsTuile(trad('Dépenses sur la période'), esc(formatMontant(m.total)), (m.comparaison && m.totalPrec > 0) ? trad('vs période précédente') : (m.comparaison ? trad('sur la période') : trad('depuis la mise en service')), { tendance: m.comparaison ? statsTendance(m.total, m.totalPrec) : '' }),
    statsTuile(trad('Coût moyen / machine'), esc(formatMontant(moyenne)), tR('{n} machine(s) suivie(s)', { n: m.machines.length })),
    statsTuile(trad('Machines au-dessus du seuil'), `${m.auDessusSeuil}`, m.avecSeuil ? tR('sur {n} avec un seuil cible', { n: m.avecSeuil }) : trad('Aucun seuil cible défini'), { classe: m.auDessusSeuil ? 'is-retard' : '' }),
    statsTuile(trad('Coût d\'arrêt'), esc(formatMontant(m.totalArret)), m.heuresArret ? tR('{h} h d\'arrêt', { h: statsHeures(m.heuresArret) }) : trad('Aucun arrêt chiffré')),
    statsTuile(trad('Part des pièces'), m.total ? statsPct(m.totalPieces, m.total) : '—', m.total ? tR('main-d\'œuvre {p}', { p: statsPct(m.totalMo, m.total) }) : ''),
  ].join('');
  const series = [
    { name: trad('Pièces'), color: STATS_COULEURS.pieces, data: m.pieces }, { name: trad('Main-d\'œuvre'), color: STATS_COULEURS.mo, data: m.mo },
    { name: trad('Exploitation'), color: STATS_COULEURS.expl, data: m.expl }, { name: trad('Arrêts'), color: STATS_COULEURS.arret, data: m.arret },
  ];
  const labels = m.mois.map((x) => x.label);
  const leg = [[trad('Pièces'), STATS_COULEURS.pieces], [trad('Main-d\'œuvre'), STATS_COULEURS.mo], [trad('Exploitation'), STATS_COULEURS.expl], [trad('Arrêts'), STATS_COULEURS.arret]];
  const nature = [{ n: trad('Pièces'), v: m.totalPieces, color: STATS_COULEURS.pieces }, { n: trad('Main-d\'œuvre'), v: m.totalMo, color: STATS_COULEURS.mo }, { n: trad('Exploitation'), v: m.totalExpl, color: STATS_COULEURS.expl }, { n: trad('Arrêts'), v: m.totalArret, color: STATS_COULEURS.arret }];
  const legNature = nature.map((p) => [p.n, p.color, statsPct(p.v, m.total)]);
  const lignesTop = m.top.map((l) => `<tr><td><b>${esc(l.nom)}</b></td><td class="n">${esc(formatMontant(l.pieces))}</td><td class="n">${esc(formatMontant(l.mo))}</td><td class="n">${esc(formatMontant(l.expl))}</td><td class="n">${esc(formatMontant(l.total))}</td><td>${m.comparaison ? (statsTendance(l.total, l.prec) || '<span class="stat-tendance t-neutre">—</span>') : ''}</td></tr>`).join('');
  const unite = (x) => (x.u === 'km' ? `${deviseCourte()}/km` : `${deviseCourte()}/h`);
  return `
    <section class="ui-section">
      <div class="stat-kpis">${tuiles}</div>
      <div class="stat-grille">
        ${statsCarte('c8', trad('Dépenses par mois'), trad('Pièces, main-d\'œuvre, exploitation et arrêts'), statsSvgBarresEmpilees(labels, series, etroit ? 360 : 720, etroit ? 230 : 250), leg)}
        ${statsCarte('c4', trad('Répartition par nature'), trad('Part de chaque poste dans les dépenses'), `<div class="stat-centre">${statsSvgAnneau(nature, 180, formatMontant(m.total), trad('sur la période'))}</div>`, legNature)}
        ${statsCarte('c6', trad('Coût par unité d\'usage'), trad('Depuis la mise en service, comparé au seuil cible de la catégorie (trait vertical)'), statsSvgBarresH(m.horaire, { W: etroit ? 360 : 520, seuil: true, fmtv: (v, it) => `${(Math.round(v * 10) / 10).toLocaleString(localeActive())} ${unite(it)}` }))}
        ${statsCarte('c6', trad('Dépenses cumulées'), trad('Cumul des dépenses sur la période'), statsSvgCourbe(labels, m.cumul, { W: etroit ? 360 : 620, H: etroit ? 200 : 210, fmty: (v) => formatMontant(v) }))}
        ${statsCarte('c12', trad('Les 5 machines les plus coûteuses'), trad('Dépenses cumulées sur la période (hors achat)'), m.top.length ? `<div class="stat-tableau-defile"><table class="stat-table"><tr><th>${esc(trad('Machine'))}</th><th class="n">${esc(trad('Pièces'))}</th><th class="n">${esc(trad('M.O.'))}</th><th class="n">${esc(trad('Exploitation'))}</th><th class="n">${esc(trad('Total'))}</th><th>${esc(trad('Tendance'))}</th></tr>${lignesTop}</table></div>` : statsVide())}
      </div>
    </section>`;
}

function statsPanneauMaintenance(m) {
  const etroit = statsEtroit();
  const labels = m.mois.map((x) => x.label);
  const totalDep = statsSomme(m.interv.depannage); const totalEnt = statsSomme(m.interv.entretien); const totalFrais = statsSomme(m.interv.frais);
  const dispo = m.machines.length ? Math.round((m.machines.length - m.etatParc.late) / m.machines.length * 100) : null;
  const tuiles = [
    statsTuile(trad('Interventions'), `${m.nbInterv}`, m.nbInterv ? tR('dont {p} de dépannage', { p: statsPct(totalDep, m.nbInterv) }) : trad('Aucune intervention')),
    statsTuile(trad('Pannes signalées'), `${m.nbPannes}`, SCHEMA.hasPannes ? trad('sur la période') : trad('Suivi des pannes non activé')),
    statsTuile(trad('Heures d\'arrêt'), statsHeures(m.heuresArret), m.heuresArret ? trad('pannes résolues, machine à l\'arrêt') : trad('Aucun arrêt enregistré'), { unite: 'h' }),
    statsTuile(trad('Délai moyen de résolution'), m.delaiMoyen != null ? statsHeures(m.delaiMoyen) : '—', m.delaiN ? tR('{n} panne(s) résolue(s)', { n: m.delaiN }) : trad('Aucune panne résolue'), { unite: m.delaiMoyen != null ? 'h' : '' }),
    statsTuile(trad('Disponibilité du parc'), dispo != null ? `${dispo}` : '—', tR('{n} machine(s) en retard aujourd\'hui', { n: m.etatParc.late }), { unite: dispo != null ? '%' : '', classe: m.etatParc.late ? 'is-retard' : '' }),
  ].join('');
  const series = [
    { name: trad('Entretien planifié'), color: STATS_COULEURS.mo, data: m.interv.entretien, argent: false },
    { name: trad('Dépannage'), color: STATS_COULEURS.expl, data: m.interv.depannage, argent: false },
    { name: trad('Frais'), color: STATS_COULEURS.pieces, data: m.interv.frais, argent: false },
  ];
  const nature = [{ n: trad('Entretien planifié'), v: totalEnt, color: STATS_COULEURS.mo }, { n: trad('Dépannage'), v: totalDep, color: STATS_COULEURS.expl }, { n: trad('Frais'), v: totalFrais, color: STATS_COULEURS.pieces }];
  const etat = [{ n: trad('En retard'), v: m.etatParc.late, color: STATS_COULEURS.expl }, { n: trad('Bientôt'), v: m.etatParc.soon, color: STATS_COULEURS.pieces }, { n: trad('À jour'), v: m.etatParc.ok, color: STATS_COULEURS.mo }];
  const pannes = m.pannesMois.map((v) => v);
  return `
    <section class="ui-section">
      <div class="stat-kpis">${tuiles}</div>
      <div class="stat-grille">
        ${statsCarte('c8', trad('Interventions par mois'), trad('Entretiens planifiés, dépannages et frais'), statsSvgBarresEmpilees(labels, series, etroit ? 360 : 720, etroit ? 220 : 240), [[trad('Entretien planifié'), STATS_COULEURS.mo], [trad('Dépannage'), STATS_COULEURS.expl], [trad('Frais'), STATS_COULEURS.pieces]])}
        ${statsCarte('c4', trad('Nature des interventions'), trad('Entretien planifié, dépannage, frais'), `<div class="stat-centre">${statsSvgAnneau(nature, 180, `${m.nbInterv}`, trad('interventions'))}</div>`, nature.map((p) => [p.n, p.color, statsPct(p.v, m.nbInterv)]))}
        ${statsCarte('c6', trad('Pannes signalées par mois'), trad('Nombre de pannes déclarées'), statsSvgBarresEmpilees(labels, [{ name: trad('Pannes'), color: STATS_COULEURS.arret, data: pannes, argent: false }], etroit ? 360 : 520, 210))}
        ${statsCarte('c6', trad('Heures d\'arrêt par machine'), trad('Pannes résolues avec arrêt de la machine'), statsSvgBarresH(m.heuresMachine, { W: etroit ? 360 : 520, couleur: STATS_COULEURS.arret, fmtv: (v) => `${statsHeures(v)} h` }))}
        ${statsCarte('c4', trad('État du parc aujourd\'hui'), trad('Machines en retard, bientôt à échéance ou à jour'), `<div class="stat-centre">${statsSvgAnneau(etat, 170, `${m.machines.length}`, trad('machines'))}</div>`, etat.map((p) => [p.n, p.color, `${p.v}`]))}
        ${statsCarte('c8', trad('Interventions par machine'), trad('Les machines les plus entretenues sur la période'), statsSvgBarresH(m.intervMachine, { W: etroit ? 360 : 640, couleur: STATS_COULEURS.mo, fmtv: (v) => `${v}` }))}
      </div>
    </section>`;
}

function statsPanneauStock(m) {
  const s = m.stock; const etroit = statsEtroit();
  if (!s) return `<section class="ui-section"><p class="ui-aide">${esc(trad('Le module Stock n\'est pas activé pour cette société.'))}</p></section>`;
  const labels = m.mois.map((x) => x.label);
  const fmtJours = (j) => `${Math.round(j).toLocaleString(localeActive())}`;
  const tuiles = [
    statsTuile(trad('Valeur du stock'), esc(formatMontant(s.valeur)), trad('valorisation au coût moyen pondéré')),
    statsTuile(trad('Rotation annuelle'), s.rotation != null ? (Math.round(s.rotation * (s.rotation < 1 ? 100 : 10)) / (s.rotation < 1 ? 100 : 10)).toLocaleString(localeActive()) : '—', trad('sorties valorisées / valeur du stock'), { unite: s.rotation != null ? '×' : '' }),
    statsTuile(trad('Couverture'), s.couverture != null ? (s.couverture > 999 ? '> 999' : fmtJours(s.couverture)) : '—', trad('au rythme actuel de consommation'), { unite: s.couverture != null ? trad('jours') : '' }),
    statsTuile(trad('Références en alerte'), `${s.alertes}`, trad('sous le seuil de sécurité'), { classe: s.alertes ? 'is-retard' : '' }),
    statsTuile(trad('Commandes en cours'), `${s.nbEnCours}`, s.nbEnCours ? tR('{m} estimés', { m: formatMontant(s.montantEnCours) }) : trad('Aucune commande en cours')),
  ].join('');
  const lignesDelais = s.delaisListe.map((x) => {
    const ecart = x.promis != null ? x.constate - x.promis : null;
    const classe = ecart == null ? 't-neutre' : (ecart > 0.5 ? 't-mal' : 't-bien');
    const texte = ecart == null ? '—' : (Math.abs(ecart) < 0.5 ? trad('à l\'heure') : `${ecart > 0 ? '+' : '−'}${Math.round(Math.abs(ecart))} ${trad('j')}`);
    return `<tr><td><b>${esc(x.n)}</b></td><td class="n">${x.promis != null ? `${Math.round(x.promis)} ${esc(trad('j'))}` : '—'}</td><td class="n">${Math.round(x.constate)} ${esc(trad('j'))}</td><td><span class="stat-puce ${classe}">${esc(texte)}</span></td></tr>`;
  }).join('');
  const couleursFam = [STATS_COULEURS.pieces, STATS_COULEURS.mo, STATS_COULEURS.expl, STATS_COULEURS.arret, STATS_COULEURS.gris, '#8F8FCB'];
  const fam = s.familles.map((f, i) => ({ n: f.n, v: f.v, color: couleursFam[i % couleursFam.length] }));
  return `
    <section class="ui-section">
      <div class="stat-kpis">${tuiles}</div>
      <div class="stat-grille">
        ${statsCarte('c7', trad('Valeur du stock'), trad('Estimée à partir des mouvements enregistrés'), statsSvgCourbe(labels, s.valeurs.map((v) => Math.max(v, 0)), { W: etroit ? 360 : 700, H: etroit ? 210 : 240, fmty: (v) => formatMontant(v) }))}
        ${statsCarte('c5', trad('Mouvements par mois'), trad('Entrées au-dessus de l\'axe, sorties en dessous'), statsSvgDivergentes(labels, s.entrees, s.sorties, etroit ? 360 : 420, 230), [[trad('Entrées'), STATS_COULEURS.mo], [trad('Sorties'), STATS_COULEURS.expl]])}
        ${statsCarte('c6', trad('Pièces les plus consommées'), trad('Quantités sorties sur la période'), statsSvgBarresH(s.topConso, { W: etroit ? 360 : 560, rowH: 32, fmtv: (v) => `${statsFmt(v)} u.` }))}
        ${statsCarte('c6', trad('Analyse ABC des références'), trad('Les premières références concentrent l\'essentiel de la valeur (courbe cumulée)'), statsSvgPareto(s.abc, etroit ? 360 : 600, 250))}
        ${statsCarte('c4', trad('Valeur par famille'), trad('Répartition du stock actuel'), `<div class="stat-centre">${statsSvgAnneau(fam, 170, formatMontant(s.valeur), trad('en stock'))}</div>`, fam.map((p) => [p.n, p.color]))}
        ${statsCarte('c4', trad('Achats par fournisseur'), trad('Marchandises reçues sur la période'), statsSvgBarresH(s.achats, { W: etroit ? 360 : 380, rowH: 34, couleur: STATS_COULEURS.mo, fmtv: (v) => formatMontant(v) }))}
        ${statsCarte('c4', trad('Délais de réception'), trad('Délai moyen constaté vs promis'), s.delaisListe.length ? `<table class="stat-table"><tr><th>${esc(trad('Fournisseur'))}</th><th class="n">${esc(trad('Promis'))}</th><th class="n">${esc(trad('Constaté'))}</th><th>${esc(trad('État'))}</th></tr>${lignesDelais}</table>` : statsVide())}
      </div>
    </section>`;
}

// ── Page ─────────────────────────────────────────────────────────────────────────────────────────────────
function statsZoneHtml() {
  const e = statsEtat();
  if (e.erreur) return `<section class="ui-section"><p class="ui-aide">${esc(trad('Impossible de charger les statistiques.'))} ${esc(e.erreur)}</p></section>`;
  if (!e.donnees) return `<section class="ui-section"><p class="ui-aide" data-chargement>${esc(trad('Chargement des statistiques…'))}</p></section>`;
  const modele = statsCalculer(e.donnees, e);
  const onglet = statsOngletActif();
  if (onglet === 'couts') return statsPanneauCouts(modele);
  if (onglet === 'maintenance') return statsPanneauMaintenance(modele);
  return statsPanneauStock(modele);
}
function statsRafraichir() {
  const zone = document.getElementById('stats-zone');
  if (zone) zone.innerHTML = statsZoneHtml();
}

VIEWS.stats = {
  fondBlanc: true,
  title: trad('Statistiques'),
  subtitle: () => trad('Dépenses, maintenance et stock de votre parc, sur la période de votre choix'),
  render() {
    const e = statsEtat();
    const onglets = statsOngletsDisponibles();
    const actif = statsOngletActif();
    const periodes = [['12m', trad('12 derniers mois')], ['annee', trad('Année en cours')], ['tout', trad('Depuis la mise en service')]];
    const categories = (UI.categories || []).filter((c) => c.name);
    return `
      <div class="ui-page stats-page">
        <div class="stat-filtres">
          <div class="ui-segment" role="group" aria-label="${esc(trad('Période'))}">
            ${periodes.map(([id, lib]) => `<button type="button" data-stats-periode="${id}" class="${e.periode === id ? 'is-actif' : ''}" aria-pressed="${e.periode === id}">${esc(lib)}</button>`).join('')}
          </div>
          <select class="ui-selecteur" id="stats-categorie" aria-label="${esc(trad('Catégorie'))}">
            <option value="">${esc(trad('Toutes catégories'))}</option>
            ${categories.map((c) => `<option value="${esc(c.id)}"${e.categorie === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
          <select class="ui-selecteur" id="stats-machine" aria-label="${esc(trad('Machine'))}">
            <option value="">${esc(trad('Toutes les machines'))}</option>
            ${(UI.machines || []).map((m) => `<option value="${esc(m.id)}"${e.machine === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}
          </select>
        </div>
        <div class="stock-onglets stats-onglets" role="tablist" aria-label="${esc(trad('Sections des statistiques'))}">
          ${onglets.map((o) => `<button type="button" class="stock-onglet${o.id === actif ? ' is-actif' : ''}" role="tab" aria-selected="${o.id === actif}" data-stats-onglet="${o.id}">${esc(o.libelle)}</button>`).join('')}
        </div>
        <div id="stats-zone">${statsZoneHtml()}</div>
      </div>`;
  },
  mount() {
    const root = document.getElementById('view-root');
    if (!root) return;
    const e = statsEtat();
    root.addEventListener('click', (ev) => {
      const periode = ev.target.closest('[data-stats-periode]');
      if (periode) {
        e.periode = periode.getAttribute('data-stats-periode');
        root.querySelectorAll('[data-stats-periode]').forEach((b) => { const a = b === periode; b.classList.toggle('is-actif', a); b.setAttribute('aria-pressed', String(a)); });
        statsRafraichir();
        return;
      }
      const onglet = ev.target.closest('[data-stats-onglet]');
      if (onglet) {
        e.onglet = onglet.getAttribute('data-stats-onglet');
        root.querySelectorAll('[data-stats-onglet]').forEach((b) => { const a = b === onglet; b.classList.toggle('is-actif', a); b.setAttribute('aria-selected', String(a)); });
        statsRafraichir();
      }
    });
    const cat = root.querySelector('#stats-categorie');
    const mach = root.querySelector('#stats-machine');
    cat?.addEventListener('change', () => {
      e.categorie = cat.value;
      if (e.machine && e.categorie) { const m = (UI.machines || []).find((x) => x.id === e.machine); if (!m || !m.category || m.category.id !== e.categorie) { e.machine = ''; if (mach) mach.value = ''; } }
      statsRafraichir();
    });
    mach?.addEventListener('change', () => { e.machine = mach.value; statsRafraichir(); });
    // Les données sont relues à chaque ouverture de la page ; changer de filtre ou d'onglet recalcule en mémoire.
    e.donnees = null; e.erreur = null;
    statsRafraichir();
    statsChargerDonnees().then((d) => {
      if (!root.isConnected) return;
      e.donnees = d; e.erreur = null; statsRafraichir();
    }).catch((err) => {
      if (!root.isConnected) return;
      e.erreur = (err && err.message) || String(err); statsRafraichir();
    });
  },
};
