// ── ORDRES DE TRAVAIL ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// ÉTAPE 2 du plan « nouvelles fonctionnalités » (communication/plan-nouvelles-fonctionnalites-2026-10-27.md, §4).
// Une tâche de maintenance qui NAÎT (création à la main, échéance du plan, panne signalée), est ASSIGNÉE, SUIVIE (liste de tâches à cocher), TERMINÉE
// (avec l'intervention enregistrée par le formulaire existant), éventuellement VALIDÉE (étape facultative, éteinte par défaut), et TRACÉE.
//
// CÔTÉ SERVEUR (migrations/ordres-de-travail.sql) : table `work_orders` en LECTURE SEULE pour l'application ; toute écriture passe par les fonctions
// ordre_travail_creer / _modifier / _agir / _cocher / _terminer, qui vérifient les droits et les changements d'état. Les actions sont REJOUABLES.
//   · Gérant et droit de gestion : voient tout, créent, assignent, modifient, annulent, valident ;
//   · Droit de saisie (chauffeur) : ne voit que « ses » ordres (assignés à lui ou créés par lui), les démarre, coche la liste et les termine ;
//   · Droit d'achat : n'y a pas accès.
// OFFRE : Business et Enterprise (décision du 2026-10-27). SCHEMA.hasOrdres : tant que le SQL n'est pas passé, aucun menu, aucun bouton.
//
// CLÔTURE : « Terminer » ouvre le formulaire d'intervention EXISTANT, pré-rempli (tâches cochées, intervenant, remarque) ; une fois l'intervention
// enregistrée, l'ordre est terminé et lui est lié. Aucune logique d'intervention (compteur, pièces, stock, échéance du plan) n'est recopiée ici.

const OT_SOURCES = { manuel: 'Créé à la main', plan: 'Depuis un plan d\'entretien', panne: 'Depuis une panne', ronde: 'Ronde d\'inspection' };

function planCouvreOrdres() {
  return ['business', 'enterprise'].includes(offreDeLaGrille(UI.companyPlan || 'free').cle);
}
function ordresActif() {
  return Boolean(SCHEMA.hasOrdres) && planCouvreOrdres();
}
// Gérant et droit de gestion (même règle que la fonction du serveur peut_gerer_ordres()).
function peutGererOrdres() {
  return estGerant() || UI.role === 'mecanicien';
}

const otStatut = () => ({
  a_faire: [trad('À faire'), 'is-ciel'], en_cours: [trad('En cours'), 'is-bientot'], termine: [trad('Terminé'), 'is-ok'],
  valide: [trad('Validé'), 'is-ok'], annule: [trad('Annulé'), ''],
});
const otPriorite = () => ({
  basse: [trad('Basse'), ''], normale: [trad('Normale'), ''], haute: [trad('Haute'), 'is-indigo'], urgente: [trad('Urgente'), 'is-retard'],
});
const otEstOuvert = (o) => o.statut === 'a_faire' || o.statut === 'en_cours';

// Filtres de la liste (gardés tant que l'écran n'est pas quitté).
const OT_FILTRES = { q: '', statut: 'actifs', moi: false };

function otMachine(id) {
  return (UI.machines || []).find((m) => String(m.id) === String(id)) || (UI.machinesArchivees || []).find((m) => String(m.id) === String(id)) || null;
}
function otNomEquipe(id) {
  const m = (UI.equipeOrdres || []).find((x) => String(x.id) === String(id));
  return m ? m.nom_affiche : trad('Membre');
}
// Petits outils d'habillage des fenêtres d'ordre (reprise Stitch) : pictogramme Material Symbols, initiales d'une personne, icône d'une catégorie de machine.
const otSymbole = (nom) => `<span class="material-symbols-outlined" aria-hidden="true">${nom}</span>`;
function otInitiales(nom) {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return '?';
  return (mots[0][0] + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase();
}
const OT_ICONES_CATEGORIE = { ciseaux: 'yard', vehicule: 'local_shipping', scie: 'carpenter', herbe: 'grass', parcMachine: 'construction', reglages: 'settings', boite: 'inventory_2' };
function otIconeMachine(m) {
  return OT_ICONES_CATEGORIE[iconeCategorieMachine(m && m.category && m.category.name)] || 'inventory_2';
}
// État d'entretien d'une machine, avec les mots et la couleur déjà utilisés ailleurs (En retard / Bientôt / À jour / Plan à définir).
function otEtatMachine(m) {
  let info = null;
  try { info = m && m.plan ? infoMachine(m) : null; } catch (err) { info = null; }
  const etat = info && info.state ? info.state : '';
  if (['late', 'soon', 'ok'].includes(etat)) return { cle: etat, texte: badgeLabel(etat) };
  // Un plan existe mais son état est inconnu (ex. compteur jamais relevé) : on dit ce qui manque plutôt que « Plan à définir ».
  return { cle: 'none', texte: info && info.short ? info.short : badgeLabel('') };
}
function otMoi() { return UI.userId || null; }
function otEstAssigne(o) { return Boolean(o.assigne_a) && String(o.assigne_a) === String(otMoi()); }
function otPeutAgir(o) { return peutGererOrdres() || otEstAssigne(o); }   // démarrer, cocher, terminer

// Les personnes à qui on PEUT assigner un ordre (equipe_ordres : sans le droit d'achat, qui n'a pas accès aux ordres).
// Serveur pas encore à jour (fonction absente) : on retombe sur toute l'équipe, le serveur refusera de toute façon une mauvaise assignation.
async function equipeAssignableOrdres(toutes) {
  if (!peutGererOrdres()) return [];
  try {
    const { data, error } = await sb.rpc('equipe_ordres');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) { return toutes; }
}

async function chargerOrdres() {
  // Sans réseau : les derniers ordres vus (voir lireAvecCopie, app-18). Ordres, équipe, personnes assignables et réglage se rangent ensemble.
  const lu = await lireAvecCopie('ordres', async () => {
    const [ordres, equipe, societe] = await Promise.all([
      sb.from('work_orders').select('*').eq('company_id', UI.companyId).order('numero', { ascending: false }).limit(500),
      equipePourAttribution().catch(() => []),
      sb.from('companies').select('ot_validation_requise').eq('id', UI.companyId).maybeSingle(),
    ]);
    if (ordres.error) throw ordres.error;
    return {
      ordres: ordres.data || [],
      equipe,                                                              // tous les noms (pour AFFICHER « assigné à »)
      assignable: await equipeAssignableOrdres(equipe),                    // les personnes assignables (pour le CHOIX)
      validation: Boolean(societe.data && societe.data.ot_validation_requise),
    };
  });
  UI.ordres = lu.data.ordres;
  UI.equipeOrdres = lu.data.equipe;
  UI.equipeAssignable = lu.data.assignable;
  UI.validationOrdres = lu.data.validation;
}

function otFiltres() {
  const q = importNorm(OT_FILTRES.q);
  return (UI.ordres || []).filter((o) => {
    if (OT_FILTRES.moi && !otEstAssigne(o)) return false;
    const s = OT_FILTRES.statut;
    if (s === 'actifs' && !otEstOuvert(o)) return false;
    if ((s === 'a_faire' || s === 'en_cours') && o.statut !== s) return false;
    if (s === 'termines' && o.statut !== 'termine' && o.statut !== 'valide') return false;
    if (q) {
      const m = otMachine(o.machine_id);
      const meule = importNorm(`OT ${o.numero} ${o.titre} ${m ? m.name : ''} ${o.assigne_a ? otNomEquipe(o.assigne_a) : ''}`);
      if (!meule.includes(q)) return false;
    }
    return true;
  });
}

function otLigneHtml(o) {
  const [sl, sc] = otStatut()[o.statut] || [o.statut, ''];
  const [pl, pc] = otPriorite()[o.priorite] || [o.priorite, ''];
  const m = otMachine(o.machine_id);
  const liste = Array.isArray(o.checklist) ? o.checklist : [];
  const faites = liste.filter((t) => t.fait).length;
  const retard = Boolean(o.echeance) && otEstOuvert(o) && o.echeance < todayIso();
  const echeance = o.echeance ? (retard ? tR('en retard depuis le {d}', { d: formatShortDate(o.echeance) }) : tR('pour le {d}', { d: formatShortDate(o.echeance) })) : '';
  const sous = [o.titre, o.assigne_a ? otNomEquipe(o.assigne_a) : trad('Non assigné'), echeance, liste.length ? `${faites}/${liste.length}` : '']
    .filter(Boolean).join(' · ');
  return `<div class="ui-ligne is-deux${retard ? ' is-retard' : ''}" data-ot="${esc(o.id)}" role="button" tabindex="0">
    <div class="ui-ligne-id"><div class="ui-ligne-textes">
      <span class="ui-ligne-nom">OT-${o.numero} · ${esc(m ? m.name : trad('Machine'))}</span>
      <span class="ui-ligne-sous">${esc(sous)}</span>
    </div></div>
    <div class="ui-ligne-action">
      ${UI.fileOrdres && UI.fileOrdres.has(o.id) ? `<span class="ui-statut is-bientot">${trad('À envoyer')}</span>` : ''}
      ${o.priorite === 'haute' || o.priorite === 'urgente' ? `<span class="ui-statut ${pc}">${esc(pl)}</span>` : ''}
      <span class="ui-statut ${sc}">${esc(sl)}</span>
    </div>
  </div>`;
}

VIEWS.ordres = {
  fondBlanc: true,
  title: trad('Ordres de travail'),
  subtitle: () => UI.company.name || UI.companyName || trad('Société'),
  render() {
    return `
      <div class="ui-page">
        <section class="ui-section">
          ${teteSectionKit('coche', trad('Ordres de travail'), '',
            `<span class="ui-tag" id="ot-compte"></span>
             ${peutGererOrdres() ? `<button type="button" class="ui-btn ui-btn-plein" id="ot-nouveau" aria-label="${esc(trad('Nouvel ordre'))}">${picto('croix')}<span>${trad('Nouvel ordre')}</span></button>` : ''}`)}
          <div class="ui-section-corps">
            <div class="ui-barre">
              <input id="ot-recherche" class="ui-champ" type="search" value="${esc(OT_FILTRES.q)}" placeholder="${esc(trad('Rechercher un ordre, une machine, une personne…'))}" aria-label="${esc(trad('Rechercher un ordre de travail'))}">
            </div>
            <div class="ui-puces" id="ot-puces" role="group" aria-label="${esc(trad('Filtrer par état'))}"></div>
            <div id="ot-liste"><div class="ui-aide">${trad('Chargement…')}</div></div>
            ${estGerant() ? `<div class="ui-groupe ot-validation">
              <label class="check-row"><input type="checkbox" id="ot-validation" disabled> ${trad('Exiger une validation du gérant une fois l\'ordre terminé')}</label>
              <div class="ui-aide">${trad('Désactivé par défaut : un ordre terminé est alors clos tout de suite. Activé, il attend d\'être validé (ou refusé avec un motif) par le gérant ou le droit de gestion.')}</div>
              <div class="ui-aide" id="ot-validation-msg" role="status" aria-live="polite"></div>
            </div>` : ''}
            ${typeof blocReglageSignatureHtml === 'function' ? blocReglageSignatureHtml() : ''}
            ${typeof blocHabilitationsHtml === 'function' ? blocHabilitationsHtml() : ''}
          </div>
        </section>
      </div>`;
  },
  mount() {
    const root = document.getElementById('view-root');
    if (!root) return;
    const dessiner = () => {
      const tous = UI.ordres || [];
      const compte = (f) => tous.filter(f).length;
      const puces = [
        ['actifs', trad('En cours et à faire'), compte(otEstOuvert)],
        ['a_faire', trad('À faire'), compte((o) => o.statut === 'a_faire')],
        ['en_cours', trad('En cours'), compte((o) => o.statut === 'en_cours')],
        ['termines', trad('Terminés'), compte((o) => o.statut === 'termine' || o.statut === 'valide')],
        ['tous', trad('Tous'), tous.length],
      ];
      // Une teinte par filtre, les mêmes que les pastilles d'état de la fiche : à faire = bleu ciel, en cours = ambre, terminés = vert, en cours et à faire = indigo.
      const TEINTES = { actifs: 'indigo', a_faire: 'ciel', en_cours: 'ambre', termines: 'vert', tous: 'ardoise' };
      root.querySelector('#ot-puces').innerHTML = puces.map(([id, l, n]) => `<button type="button" class="ui-puce teinte-${TEINTES[id]}${OT_FILTRES.statut === id ? ' is-actif' : ''}" data-ot-statut="${id}"><span>${esc(l)}</span><span class="ui-compte">${n}</span></button>`).join('')
        + (peutGererOrdres() ? `<button type="button" class="ui-puce teinte-bleu${OT_FILTRES.moi ? ' is-actif' : ''}" data-ot-moi="1"><span>${trad('Mes ordres')}</span></button>` : '');
      const liste = otFiltres();
      root.querySelector('#ot-compte').textContent = tR('{n} ordre(s)', { n: tous.length });
      root.querySelector('#ot-liste').innerHTML = liste.length
        ? `<div class="ui-liste">${liste.map(otLigneHtml).join('')}</div>`
        : `<div class="ui-aide">${tous.length ? trad('Aucun ordre ne correspond à ce filtre.') : (peutGererOrdres() ? trad('Aucun ordre de travail pour l\'instant. Crée le premier avec « Nouvel ordre ».') : trad('Aucun ordre ne t\'est assigné pour l\'instant.'))}</div>`;
    };
    UI.redessinerOrdres = dessiner;
    root.querySelector('#ot-nouveau')?.addEventListener('click', () => ouvrirFormOrdre({}));
    root.querySelector('#ot-recherche').addEventListener('input', (e) => { OT_FILTRES.q = e.target.value; dessiner(); });
    root.addEventListener('click', (e) => {
      const s = e.target.closest('[data-ot-statut]');
      if (s) { OT_FILTRES.statut = s.getAttribute('data-ot-statut'); dessiner(); return; }
      if (e.target.closest('[data-ot-moi]')) { OT_FILTRES.moi = !OT_FILTRES.moi; dessiner(); return; }
      const l = e.target.closest('[data-ot]');
      if (l) ouvrirOrdre(l.getAttribute('data-ot'));
    });
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const l = e.target.closest && e.target.closest('[data-ot]');
      if (l) { e.preventDefault(); ouvrirOrdre(l.getAttribute('data-ot')); }
    });
    const caseValidation = root.querySelector('#ot-validation');
    if (caseValidation) {
      caseValidation.addEventListener('change', async () => {
        const voulu = caseValidation.checked;
        const msg = root.querySelector('#ot-validation-msg');
        caseValidation.disabled = true;
        const { error } = await sb.rpc('definir_validation_ordres', { p_actif: voulu });
        caseValidation.disabled = false;
        if (error) { caseValidation.checked = !voulu; msg.textContent = trad('Réglage impossible pour le moment.'); return; }
        UI.validationOrdres = voulu;
        msg.textContent = voulu ? trad('Validation activée : les ordres terminés attendent ta validation.') : trad('Validation désactivée : un ordre terminé est clos tout de suite.');
      });
    }
    if (typeof brancherReglageSignature === 'function') brancherReglageSignature(root);
    if (typeof brancherHabilitations === 'function') brancherHabilitations(root);
    if (UI.ordres) dessiner();   // dernière liste connue pendant le rechargement
    chargerOrdres().then(() => {
      dessiner();
      if (caseValidation) { caseValidation.checked = UI.validationOrdres === true; caseValidation.disabled = false; }
    }).catch(() => {
      root.querySelector('#ot-liste').innerHTML = `<div class="ui-aide">${trad('Ordres de travail indisponibles pour le moment.')}</div>`;
    });
  },
};

// Remplace un ordre dans la liste locale par la version renvoyée par le serveur, puis redessine.
function otMettreAJour(ligne) {
  if (!ligne || !ligne.id) return;
  const i = (UI.ordres || []).findIndex((o) => String(o.id) === String(ligne.id));
  if (i >= 0) UI.ordres[i] = ligne; else UI.ordres = [ligne, ...(UI.ordres || [])];
  if (typeof UI.redessinerOrdres === 'function' && document.getElementById('ot-liste')) UI.redessinerOrdres();
  majAccueilOrdres(document);   // « Mes ordres » et la tuile de vigilance de l'accueil : un ordre terminé n'y reste pas
}

// ── Accueil ──
// Terrain (droit de gestion et de saisie) : « Mes ordres » = les ordres ouverts qui leur sont assignés, en retard d'abord.
// Gérant : la tuile « Ordres » des points de vigilance (ouverts, en retard, à valider). Chargement APRÈS l'affichage : l'accueil n'attend jamais le réseau.
function otOrdresOuvertsTries(liste) {
  const aujourdhui = todayIso();
  const cle = (o) => [o.echeance && o.echeance < aujourdhui ? 0 : 1, o.echeance || '9999-12-31', o.numero];
  return liste.filter(otEstOuvert).sort((a, b) => {
    const x = cle(a); const y = cle(b);
    return x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0) || x[2] - y[2];
  });
}
async function chargerAccueilOrdres(root) {
  if (!ordresActif()) return;
  const zone = root.querySelector('#accueil-mes-ordres');
  const tuile = root.querySelector('#vig-ordres');
  if (!zone && !tuile) return;
  try { await chargerOrdres(); } catch (err) {
    if (tuile && typeof majLigneVigilance === 'function') majLigneVigilance(root, 'ordres', '—', 'ok', trad('Indisponible'));
    return;
  }
  majAccueilOrdres(root);
}
// Dessine « Mes ordres » et la tuile de vigilance à partir des ordres déjà en mémoire (aucun appel réseau) : sert au chargement ET à chaque changement d'ordre.
function majAccueilOrdres(root) {
  if (!ordresActif()) return;
  const zone = root.querySelector('#accueil-mes-ordres');
  const tuile = root.querySelector('#vig-ordres');
  if (!zone && !tuile) return;
  const tous = UI.ordres || [];
  if (tuile && typeof majLigneVigilance === 'function') {
    const ouverts = tous.filter(otEstOuvert);
    const retard = ouverts.filter((o) => o.echeance && o.echeance < todayIso()).length;
    const aValider = UI.validationOrdres === true ? tous.filter((o) => o.statut === 'termine').length : 0;
    majLigneVigilance(root, 'ordres', ouverts.length, retard ? 'late' : (aValider ? 'soon' : 'ok'),
      retard ? tR('{n} en retard', { n: retard }) : (aValider ? tR('{n} à valider', { n: aValider }) : (ouverts.length ? trad('Tout est dans les temps') : trad('Aucun ordre ouvert'))));
  }
  if (zone) {
    const miens = otOrdresOuvertsTries(tous.filter(otEstAssigne));
    if (!miens.length) { zone.hidden = true; zone.innerHTML = ''; return; }
    const montres = miens.slice(0, 4);
    zone.innerHTML = `
      ${teteSectionKit('coche', trad('Mes ordres'), '',
        `<span class="ui-tag">${miens.length}</span><button type="button" class="ui-btn ui-btn-pastille" data-ot-tout>${trad('Tout voir')} →</button>`)}
      <div class="ui-section-corps"><div class="ui-liste">${montres.map(otLigneHtml).join('')}</div></div>`;
    zone.hidden = false;
    zone.onclick = (e) => {
      if (e.target.closest('[data-ot-tout]')) { OT_FILTRES.moi = true; goTo('ordres'); return; }
      const l = e.target.closest('[data-ot]');
      if (l) ouvrirOrdre(l.getAttribute('data-ot'));
    };
  }
}

// Tap sur une notification d'ordre (push) : ouvre la fiche, en rechargeant la liste si l'ordre n'y est pas encore (lancement à froid, ordre tout neuf).
async function ouvrirOrdreParId(id) {
  if (!id || !ordresActif()) return;
  try {
    if (!(UI.ordres || []).some((o) => String(o.id) === String(id))) await chargerOrdres();
  } catch (err) { /* la liste reste vide : on tombe sur le message ci-dessous */ }
  if ((UI.ordres || []).some((o) => String(o.id) === String(id))) ouvrirOrdre(id);
  else showToast(trad('Ordre de travail introuvable ou non accessible.'));
}

// ── L'historique d'un ordre : une phrase par ligne du journal (« Gérant G a assigné l'ordre à Méca M »), la plus récente d'abord ──
function otPhraseHistorique(h) {
  const p = h.personne && h.personne !== '—' ? h.personne : trad('Quelqu\'un');
  const d = h.details || {};
  switch (h.action) {
    case 'ot_cree': return tR('{p} a créé l\'ordre', { p });
    case 'ot_modifie': return tR('{p} a modifié l\'ordre', { p });
    case 'ot_assigne': return d.a ? tR('{p} a assigné l\'ordre à {n}', { p, n: otNomEquipe(d.a) }) : tR('{p} a retiré l\'assignation', { p });
    case 'ot_demarrer': return tR('{p} a démarré l\'ordre', { p });
    case 'ot_reouvrir': return tR('{p} a remis l\'ordre à faire', { p });
    case 'ot_annuler': return tR('{p} a annulé l\'ordre', { p });
    case 'ot_valider': return tR('{p} a validé l\'ordre', { p });
    case 'ot_refuser': return tR('{p} a refusé l\'ordre', { p });
    case 'ot_termine': return d.taches_total != null
      ? tR('{p} a terminé l\'ordre ({f}/{t} tâches faites)', { p, f: d.taches_faites ?? 0, t: d.taches_total })
      : tR('{p} a terminé l\'ordre', { p });
    default: return tR('{p} : {a}', { p, a: String(h.action || '').replace(/^ot_/, '') });
  }
}
function otHistoriqueHtml(histo) {
  if (histo === 'chargement' || histo === null) return `<p class="ui-aide">${trad('Chargement…')}</p>`;
  if (histo === 'indisponible') return `<p class="ui-aide">${trad('Historique indisponible pour le moment.')}</p>`;
  if (!histo.length) return `<p class="ui-aide">${trad('Aucun événement enregistré.')}</p>`;
  return `<ul class="otm-histo-liste">${histo.map((h) => {
    const t = new Date(h.quand);
    const quand = isNaN(t) ? '' : t.toLocaleString(localeActive(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<li><span>${esc(otPhraseHistorique(h))}</span><time datetime="${esc(h.quand)}">${esc(quand)}</time></li>`;
  }).join('')}</ul>`;
}

// ── La fiche d'un ordre ──
function ouvrirOrdre(id) {
  const ordre = () => (UI.ordres || []).find((o) => String(o.id) === String(id));
  if (!ordre()) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  // Historique : chargé SEULEMENT quand on l'ouvre (null = pas encore lu, 'chargement', 'indisponible', ou la liste).
  let histo = null;
  let histoOuvert = false;
  const chargerHisto = async () => {
    histo = 'chargement';
    dessiner();
    try {
      const { data, error } = await sb.rpc('ordre_travail_historique', { p_id: id });
      histo = error ? 'indisponible' : (Array.isArray(data) ? data : []);
    } catch (err) { histo = 'indisponible'; }
    if (overlay.isConnected) dessiner();
  };

  // Ce qui peut se faire SANS réseau : démarrer, cocher une tâche, terminer sans intervention (voir app-19). Le reste (annuler, valider, refuser, remettre à faire,
  // modifier) demande le réseau, et le dit.
  const versAction = (nom, args) => {
    if (nom === 'ordre_travail_cocher') { const t = (ordre().checklist || [])[args.p_index]; return { action: 'cocher', index: args.p_index, fait: args.p_fait, label: t ? t.label : '' }; }
    if (nom === 'ordre_travail_agir' && args.p_action === 'demarrer') return { action: 'demarrer' };
    if (nom === 'ordre_travail_terminer' && !args.p_intervention) return { action: 'terminer', interventionId: null };
    return null;
  };
  const appeler = async (nom, args, bouton) => {
    if (bouton) bouton.disabled = true;
    const action = versAction(nom, args);
    let data = null;
    let error = null;
    if (navigator.onLine === false) error = action ? { message: 'hors connexion' } : { message: trad('Cette action demande le réseau pour l\'instant.') };
    else ({ data, error } = await sb.rpc(nom, args));
    if (error && action && estErreurTransitoire(error)) {
      try {
        data = await mettreOrdreEnFile(ordre(), action);
        error = null;
        if (action.action !== 'cocher') showToast(trad('Enregistré sur l\'appareil : l\'action partira dès que le réseau revient.'));
        if (bouton) bouton.disabled = false;
        return data;
      } catch (errFile) { error = errFile; }
    }
    if (error) {
      if (bouton) bouton.disabled = false;
      const msg = overlay.querySelector('#ot-msg');
      if (msg) { msg.style.color = 'var(--danger,#c0392b)'; msg.textContent = error.message || trad('Action impossible pour le moment.'); }
      return null;
    }
    otMettreAJour(data);
    histo = null;                       // l'action vient d'ajouter une ligne au journal : on relira l'historique
    if (histoOuvert) setTimeout(() => { if (overlay.isConnected) chargerHisto(); }, 0);
    return data;
  };

  const dessiner = () => {
    const o = ordre();
    if (!o) { overlay.remove(); return; }
    const [sl, sc] = otStatut()[o.statut] || [o.statut, ''];
    const [pl, pc] = otPriorite()[o.priorite] || [o.priorite, ''];
    const m = otMachine(o.machine_id);
    const liste = Array.isArray(o.checklist) ? o.checklist : [];
    const cochable = otEstOuvert(o) && otPeutAgir(o);
    const retard = Boolean(o.echeance) && otEstOuvert(o) && o.echeance < todayIso();
    const gestion = peutGererOrdres();
    const exigeValidation = UI.validationOrdres === true;

    const boutons = [];
    if (o.statut === 'a_faire' && otPeutAgir(o)) boutons.push(`<button type="button" class="otm-btn is-plein" data-ot-act="demarrer">${trad('Démarrer')}</button>`);
    if (otEstOuvert(o) && otPeutAgir(o)) boutons.push(`<button type="button" class="otm-btn ${o.statut === 'en_cours' ? 'is-plein' : ''}" data-ot-act="terminer">${trad('Terminer')}</button>`);
    if (o.statut === 'termine' && gestion && exigeValidation) {
      boutons.push(`<button type="button" class="otm-btn is-plein" data-ot-act="valider">${trad('Valider')}</button>`);
      boutons.push(`<button type="button" class="otm-btn" data-ot-act="refuser">${trad('Refuser')}</button>`);
    }
    if (otEstOuvert(o) && gestion) boutons.push(`<button type="button" class="otm-btn" data-ot-act="modifier">${trad('Modifier')}</button>`);
    if (o.statut === 'en_cours' && gestion) boutons.push(`<button type="button" class="otm-btn" data-ot-act="reouvrir">${trad('Remettre à faire')}</button>`);
    if (otEstOuvert(o) && gestion) boutons.push(`<button type="button" class="otm-btn is-ambre" data-ot-act="annuler">${trad('Annuler l\'ordre')}</button>`);
    // Signature numérique (étape 4) : l'intervention de l'ordre terminé se signe et se télécharge en rapport PDF.
    if (o.intervention_id && typeof signaturesActif === 'function' && signaturesActif()) boutons.push(`<button type="button" class="otm-btn" data-ot-act="rapport">${trad('Rapport et signatures')}</button>`);

    const faitesN = liste.filter((t) => t.fait).length;
    const pct = liste.length ? Math.round((faitesN / liste.length) * 100) : 0;
    const echeanceTxt = o.echeance ? formatShortDateAvecAnnee(o.echeance) : trad('Aucune');
    const nomAssigne = o.assigne_a ? otNomEquipe(o.assigne_a) : '';
    const sousTitre = [m ? identifiantAffiche(m) : '', m && m.category && m.category.name ? m.category.name : (m && m.brand_model) || ''].filter(Boolean).join(' · ');
    overlay.className = 'overlay otm-overlay';
    overlay.innerHTML = `
      <div class="modal otm otm-fiche" role="dialog" aria-modal="true" aria-labelledby="ot-titre">
        <div class="otm-corps otm-fiche-corps">
          <header class="otm-fiche-tete">
            <div class="otm-pastilles">
              <span class="otm-pastille is-id">OT-${o.numero}</span>
              <span class="otm-pastille is-statut-${esc(o.statut)}"><i class="otm-point"></i>${esc(sl)}</span>
              <span class="otm-pastille is-prio-${esc(o.priorite)}"><i class="otm-point"></i>${esc(pl)}</span>
              ${UI.fileOrdres && UI.fileOrdres.has(o.id) ? `<span class="otm-pastille is-attente"><i class="otm-point"></i>${trad('À envoyer')}</span>` : ''}
            </div>
            <button type="button" class="otm-fermer" data-otm-fermer aria-label="${esc(trad('Fermer'))}">${otSymbole('close')}</button>
          </header>
          <div>
            <h2 id="ot-titre" class="otm-nom">${esc(m ? m.name : trad('Machine'))}</h2>
            ${sousTitre ? `<p class="otm-sous">${esc(sousTitre)}</p>` : ''}
          </div>
          <section class="otm-cartes" aria-label="${esc(trad('Informations générales'))}">
            <article class="otm-carte">
              <span class="otm-carte-label">${trad('Assigné à')}</span>
              <div class="otm-carte-valeur">
                ${nomAssigne ? `<span class="otm-avatar">${esc(otInitiales(nomAssigne))}</span>` : `<span class="otm-rond">${otSymbole('person')}</span>`}
                <strong title="${esc(nomAssigne || trad('Non assigné'))}">${esc(nomAssigne || trad('Non assigné'))}</strong>
              </div>
            </article>
            <article class="otm-carte${retard ? ' is-retard' : ''}">
              <span class="otm-carte-label">${trad('Échéance')}</span>
              <div class="otm-carte-valeur"><span class="otm-rond">${otSymbole('calendar_today')}</span><strong>${esc(echeanceTxt)}</strong></div>
              ${retard ? `<span class="otm-carte-note">${trad('en retard')}</span>` : ''}
            </article>
            <article class="otm-carte">
              <span class="otm-carte-label">${trad('Durée estimée')}</span>
              <div class="otm-carte-valeur"><span class="otm-rond">${otSymbole('schedule')}</span><strong>${o.duree_estimee_h != null ? esc(tR('{n} h', { n: o.duree_estimee_h })) : trad('Non précisée')}</strong></div>
            </article>
            <article class="otm-carte">
              <span class="otm-carte-label">${trad('Origine')}</span>
              <div class="otm-carte-valeur"><span class="otm-rond">${otSymbole('edit')}</span><strong>${esc(trad(OT_SOURCES[o.source] || o.source))}</strong></div>
            </article>
          </section>
          ${o.description ? `<p class="ot-description">${esc(o.description)}</p>` : ''}
          ${o.note_statut ? `<div class="ui-encadre is-attention">${picto('alerte')}<p>${o.statut === 'annule' ? trad('Motif d\'annulation :') : trad('Motif du refus :')} ${esc(o.note_statut)}</p></div>` : ''}
          ${liste.length ? `
          <section class="otm-taches" aria-label="${esc(trad('Tâches à réaliser'))}">
            <div class="otm-taches-tete">
              <span>${trad('Tâches à réaliser')}</span>
              <span class="otm-compteur">${esc(tR('{f} / {n} terminées', { f: faitesN, n: liste.length }))}</span>
            </div>
            <div class="otm-progres" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div style="width:${pct}%"></div></div>
            <div class="otm-taches-liste">${liste.map((t, i) => `
              <label class="otm-tache${t.fait ? ' is-fait' : ''}">
                <input type="checkbox" data-ot-tache="${i}" ${t.fait ? 'checked' : ''} ${cochable ? '' : 'disabled'}>
                <span>${esc(t.label)}</span>
              </label>`).join('')}</div>
          </section>` : ''}
          ${o.statut === 'termine' || o.statut === 'valide' ? `<div class="ui-encadre">${picto('coche')}<p>${o.statut === 'valide' ? trad('Ordre terminé et validé.') : (exigeValidation ? trad('Ordre terminé : en attente de validation.') : trad('Ordre terminé.'))}${o.intervention_id ? ' ' + trad('L\'intervention est enregistrée dans l\'historique de la machine.') : ''}</p></div>` : ''}
          <section class="otm-histo">
            <button type="button" class="otm-histo-bouton" data-ot-histo aria-expanded="${histoOuvert}">${otSymbole('history')}<span>${trad('Historique')}</span>${otSymbole(histoOuvert ? 'expand_less' : 'expand_more')}</button>
            ${histoOuvert ? otHistoriqueHtml(histo) : ''}
          </section>
          <div id="ot-msg" class="ui-aide" role="status" aria-live="polite"></div>
          ${boutons.length ? `<footer class="otm-actions">${boutons.join('')}</footer>` : ''}
        </div>
      </div>`;
  };
  dessiner();

  overlay.addEventListener('change', async (e) => {
    const c = e.target.closest('[data-ot-tache]');
    if (!c) return;
    const o = ordre();
    c.disabled = true;
    const r = await appeler('ordre_travail_cocher', { p_id: o.id, p_index: Number(c.getAttribute('data-ot-tache')), p_fait: c.checked });
    if (!r) c.checked = !c.checked;
    dessiner();
  });
  overlay.addEventListener('click', async (e) => {
    if (e.target.closest('[data-otm-fermer]')) { overlay.remove(); return; }
    if (e.target.closest('[data-ot-histo]')) {
      histoOuvert = !histoOuvert;
      if (histoOuvert && histo === null) chargerHisto(); else dessiner();
      return;
    }
    const b = e.target.closest('[data-ot-act]');
    if (!b) return;
    const o = ordre();
    const act = b.getAttribute('data-ot-act');
    if (act === 'rapport') { ouvrirRapportIntervention(o.intervention_id); return; }
    if (act === 'demarrer') { if (await appeler('ordre_travail_agir', { p_id: o.id, p_action: 'demarrer', p_note: null }, b)) dessiner(); return; }
    if (act === 'reouvrir') { if (await appeler('ordre_travail_agir', { p_id: o.id, p_action: 'reouvrir', p_note: null }, b)) dessiner(); return; }
    if (act === 'valider') { if (await appeler('ordre_travail_agir', { p_id: o.id, p_action: 'valider', p_note: null }, b)) dessiner(); return; }
    if (act === 'annuler') {
      if (!window.confirm(trad('Annuler cet ordre de travail ?'))) return;
      const motif = window.prompt(trad('Motif de l\'annulation (facultatif) :'), '');
      if (motif === null) return;
      if (await appeler('ordre_travail_agir', { p_id: o.id, p_action: 'annuler', p_note: motif.trim() || null }, b)) dessiner();
      return;
    }
    if (act === 'refuser') {
      const motif = window.prompt(trad('Motif du refus (obligatoire) :'), '');
      if (motif === null) return;
      if (!motif.trim()) { const msg = overlay.querySelector('#ot-msg'); msg.style.color = 'var(--danger,#c0392b)'; msg.textContent = trad('Indique le motif du refus.'); return; }
      if (await appeler('ordre_travail_agir', { p_id: o.id, p_action: 'refuser', p_note: motif.trim() }, b)) dessiner();
      return;
    }
    if (act === 'modifier') { overlay.remove(); ouvrirFormOrdre({ ordre: o }); return; }
    if (act === 'terminer') { terminerOrdre(o, overlay, appeler); }
  });
}

// ── Terminer : le formulaire d'intervention existant, pré-rempli, puis l'ordre est lié à l'intervention créée ──
function terminerOrdre(o, overlay, appeler) {
  const machine = otMachine(o.machine_id);
  const liste = Array.isArray(o.checklist) ? o.checklist : [];
  const aFaire = liste.filter((t) => !t.fait).length;
  const sansIntervention = async () => {
    if (!window.confirm(trad('Terminer cet ordre sans enregistrer d\'intervention ? Aucun historique ni échéance de plan ne sera mis à jour.'))) return;
    const r = await appeler('ordre_travail_terminer', { p_id: o.id, p_intervention: null });
    if (r) { overlay.remove(); showToast(trad('Ordre terminé')); }
  };
  if (!machine || (typeof machineCouverte === 'function' && !machineCouverte(machine))) { sansIntervention(); return; }
  if (aFaire && !window.confirm(tR('{n} tâche(s) ne sont pas cochées. Terminer quand même et enregistrer l\'intervention ?', { n: aFaire }))) return;
  const faites = liste.filter((t) => t.fait).map((t) => t.label);
  const libellesPlan = new Set(otTachesDuPlan(machine));
  const horsPlan = faites.filter((l) => !libellesPlan.has(l));
  const remarque = [`OT-${o.numero}`, ...(horsPlan.length ? [tR('Tâches de l\'ordre : {liste}', { liste: horsPlan.join(', ') })] : [])].join('\n');
  overlay.remove();
  openLogInterventionModal(machine, faites, {
    ordre: { id: o.id, numero: o.numero, assigneId: o.assigne_a || null, remarque },
    onSaved: async (interventionId) => {
      const { data, error } = await sb.rpc('ordre_travail_terminer', { p_id: o.id, p_intervention: interventionId || null });
      if (error && estErreurTransitoire(error)) {
        // L'intervention est écrite, mais le réseau a lâché avant la clôture : la clôture part avec le reste, à son tour.
        try { await mettreOrdreEnFile(o, { action: 'terminer', interventionId: interventionId || null }); showToast(trad('Enregistré sur l\'appareil : l\'action partira dès que le réseau revient.')); return; } catch (errFile) { /* message ci-dessous */ }
      }
      if (error) { showToast(tR('Intervention enregistrée, mais l\'ordre OT-{n} n\'a pas pu être terminé : {e}', { n: o.numero, e: error.message || '' })); return false; }
      otMettreAJour(data);
    },
    // Intervention mise en file (sans réseau) : la clôture de l'ordre est INCLUSE dans cette opération ; on montre déjà l'ordre terminé.
    apresMiseEnFile: (interventionId) => ordreAppliquerLocalement(o, { action: 'terminer', interventionId }),
  });
}

// ── Création et modification ──
// Un ordre n'a PAS de titre à saisir : il est défini par ses TÂCHES (celles du plan d'entretien de la machine, cochées, et/ou une ou plusieurs tâches
// « autres »). Le champ `titre` du serveur reçoit simplement la liste des tâches (« Vidange, Filtre à huile ») : un RÉSUMÉ pour la liste et la recherche.

// Les tâches du plan d'une machine, EXACTEMENT comme la fenêtre d'intervention les propose (éléments détaillés du plan, sinon la liste « tâches »).
function otTachesDuPlan(machine) {
  if (!machine || !machine.plan) return [];
  const items = typeof tachesAffichees === 'function' ? tachesAffichees(machine.plan, machine) : [];
  const libelles = items.length ? items.map((t) => t.label) : String(machine.plan.tasks || '').split(',').map((t) => t.trim());
  return libelles.filter(Boolean);
}
// Les mêmes tâches avec leur ÉTAT d'échéance (en retard, bientôt, à jour) quand le plan le sait : { label, info }.
function otElementsPlan(machine) {
  if (!machine || !machine.plan) return [];
  const items = typeof tachesAffichees === 'function' ? tachesAffichees(machine.plan, machine) : [];
  if (items.length) {
    return items.filter((it) => it && it.label).map((it) => {
      let info = null;
      try { info = typeof infoTache === 'function' ? infoTache(it, machine.plan, machine) : null; } catch (err) { info = null; }
      return { label: it.label, info };
    });
  }
  return otTachesDuPlan(machine).map((label) => ({ label, info: null }));
}
function otTitreAuto(libelles) {
  const texte = libelles.join(', ');
  return texte.length <= 200 ? texte : texte.slice(0, 199) + '…';
}

// ── Étape 1/2 : choisir la machine (reprise Stitch « modale sélection machine ») ──
function otMachinesChoisissables() {
  return (UI.machines || []).filter((m) => !m.archived && (typeof machineCouverte !== 'function' || machineCouverte(m)));
}
// Le contenu d'une ligne de machine : nom, genre, identifiant, état d'entretien. Partagé par la liste de l'étape 1 et le résumé de l'étape 2.
function otMachineTextesHtml(m) {
  const cat = (m.category && m.category.name) || m.brand_model || '';
  const idTxt = identifiantAffiche(m);
  const e = otEtatMachine(m);
  return `
    <div class="otm-machine-textes">
      <div class="otm-machine-ligne"><strong>${esc(m.name)}</strong>${cat ? `<span class="otm-genre">${esc(cat)}</span>` : ''}</div>
      <div class="otm-machine-meta">
        ${idTxt ? `<span class="otm-id">${otSymbole(isVehicle(m) ? 'badge' : 'tag')}${esc(idTxt)}</span>` : ''}
        <span class="otm-etat is-${e.cle}"><i class="otm-point"></i>${esc(e.texte)}</span>
      </div>
    </div>`;
}

function ouvrirChoixMachineOrdre({ machineId = null } = {}) {
  if (!peutGererOrdres()) return;
  const machines = otMachinesChoisissables();
  if (!machines.length) { showToast(trad('Aucune machine disponible pour créer un ordre.')); return; }
  const nomCat = (m) => (m.category && m.category.name) || '';
  const categories = [...new Set(machines.map(nomCat))].sort((a, b) => a.localeCompare(b, 'fr'));
  const etat = { q: '', cat: null, choix: machines.some((m) => String(m.id) === String(machineId)) ? String(machineId) : null };

  const overlay = document.createElement('div');
  overlay.className = 'overlay otm-overlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal otm otm-choix" role="dialog" aria-modal="true" aria-labelledby="otc-titre">
      <header class="otm-tete">
        <div class="otm-tuile">${otSymbole('handyman')}</div>
        <div class="otm-tete-textes">
          <div class="otm-tete-ligne"><span class="otm-etape">${trad('Étape 1/2')}</span><span class="otm-marque">GMAO KALEA</span></div>
          <h2 id="otc-titre">${trad('Créer un ordre de travail')}</h2>
          <p>${trad('Sélectionne l\'équipement de la flotte nécessitant l\'intervention technique')}</p>
        </div>
        <button type="button" class="otm-fermer" data-otm-fermer aria-label="${esc(trad('Fermer'))}">${otSymbole('close')}</button>
      </header>
      <div class="otm-recherche">
        ${otSymbole('search')}
        <input id="otc-recherche" type="search" autocomplete="off" placeholder="${esc(trad('Rechercher par nom, marque, immatriculation ou n° de série…'))}" aria-label="${esc(trad('Rechercher une machine'))}">
      </div>
      <div class="otm-puces" id="otc-puces" role="group" aria-label="${esc(trad('Filtrer par catégorie'))}"></div>
      <div class="otm-liste" id="otc-liste" role="radiogroup" aria-label="${esc(trad('Machine concernée'))}"></div>
      <footer class="otm-pied">
        <span class="otm-info">${otSymbole('info')}<span id="otc-info"></span></span>
        <div class="otm-pied-actions">
          <button type="button" class="otm-btn" data-otm-fermer>${trad('Annuler')}</button>
          <button type="button" class="otm-btn is-plein" id="otc-continuer" disabled><span>${trad('Continuer vers les tâches de l\'OT')}</span>${otSymbole('arrow_forward')}</button>
        </div>
      </footer>
    </div>`;
  document.body.appendChild(overlay);
  const q = (s) => overlay.querySelector(s);

  const dessiner = () => {
    const mot = importNorm(etat.q);
    const visibles = machines.filter((m) => (etat.cat === null || nomCat(m) === etat.cat)
      && (!mot || importNorm([m.name, m.brand_model, m.brand, m.model, m.serial_number, m.plate, nomCat(m)].filter(Boolean).join(' ')).includes(mot)));
    const puce = (cle, libelle, n) => `<button type="button" class="otm-puce${(etat.cat === cle) ? ' is-actif' : ''}" data-otc-cat="${esc(cle === null ? '*' : cle)}">${esc(libelle)} (${n})</button>`;
    q('#otc-puces').innerHTML = puce(null, trad('Tous'), machines.length)
      + categories.map((c) => puce(c, c || trad('Sans catégorie'), machines.filter((m) => nomCat(m) === c).length)).join('');
    q('#otc-liste').innerHTML = visibles.length ? visibles.map((m) => {
      const choisi = etat.choix === String(m.id);
      return `<div class="otm-machine${choisi ? ' is-choisi' : ''}" data-otc="${esc(m.id)}" role="radio" aria-checked="${choisi}" tabindex="0">
        <div class="otm-machine-icone is-${otEtatMachine(m).cle}">${otSymbole(otIconeMachine(m))}</div>
        ${otMachineTextesHtml(m)}
        <span class="otm-radio">${otSymbole('check')}</span>
      </div>`;
    }).join('') : `<p class="ui-aide otm-vide">${trad('Aucune machine ne correspond à cette recherche.')}</p>`;
    q('#otc-info').textContent = etat.choix ? trad('1 équipement sélectionné') : trad('Aucun équipement sélectionné');
    q('#otc-continuer').disabled = !etat.choix;
  };
  dessiner();

  const continuer = () => {
    if (!etat.choix) return;
    overlay.remove();
    ouvrirFormOrdre({ machineId: etat.choix, retour: () => ouvrirChoixMachineOrdre({ machineId: etat.choix }) });
  };
  q('#otc-recherche').addEventListener('input', (e) => { etat.q = e.target.value; dessiner(); });
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-otm-fermer]')) { overlay.remove(); return; }
    const p = e.target.closest('[data-otc-cat]');
    if (p) { const v = p.getAttribute('data-otc-cat'); etat.cat = v === '*' ? null : v; dessiner(); return; }
    const c = e.target.closest('[data-otc]');
    if (c) { etat.choix = c.getAttribute('data-otc'); dessiner(); }
  });
  overlay.addEventListener('dblclick', (e) => { if (e.target.closest('[data-otc]')) continuer(); });
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const c = e.target.closest && e.target.closest('[data-otc]');
    if (c) { e.preventDefault(); etat.choix = c.getAttribute('data-otc'); dessiner(); const r = overlay.querySelector(`[data-otc="${CSS.escape(etat.choix)}"]`); if (r) r.focus(); }
  });
  q('#otc-continuer').addEventListener('click', continuer);
  q('#otc-recherche').focus();
}

// ── Étape 2/2 (ou modification) : les tâches, la priorité, l'assignation ──
async function ouvrirFormOrdre({ ordre = null, machineId = null, panne = null, plan = false, retour = null } = {}) {
  if (!peutGererOrdres()) return;
  // Création sans machine connue (bouton « Nouvel ordre ») : on commence par l'étape 1, le choix de la machine.
  if (!ordre && !machineId) { ouvrirChoixMachineOrdre(); return; }
  if (!UI.equipeOrdres) { try { UI.equipeOrdres = await equipePourAttribution(); } catch (err) { UI.equipeOrdres = []; } }
  if (!UI.equipeAssignable) UI.equipeAssignable = await equipeAssignableOrdres(UI.equipeOrdres);
  const assignables = UI.equipeAssignable;
  // Ordre déjà assigné à quelqu'un qui n'est plus assignable (ex. droit d'achat) : on le dit, et on propose de choisir quelqu'un d'autre.
  const assigneInvalide = Boolean(ordre && ordre.assigne_a && !assignables.some((m) => String(m.id) === String(ordre.assigne_a)));
  const edition = Boolean(ordre);
  const machineInitiale = ordre ? ordre.machine_id : machineId;
  const machineDeLOrdre = otMachine(machineInitiale);
  if (!machineDeLOrdre) { showToast(trad('Aucune machine disponible pour créer un ordre.')); return; }
  const priorites = otPriorite();
  const existantes = new Map(((ordre && ordre.checklist) || []).map((t) => [t.label, t]));   // une tâche gardée conserve son état (faite ou non)

  // L'état du formulaire : les tâches du plan COCHÉES (par libellé) et les tâches « autres » (dans l'ordre d'ajout).
  const etat = { cochees: new Set(), autres: [] };
  if (ordre) {
    const dansPlan = new Set(otElementsPlan(otMachine(ordre.machine_id)).map((x) => x.label));
    for (const t of ordre.checklist || []) { if (dansPlan.has(t.label)) etat.cochees.add(t.label); else etat.autres.push(t.label); }
  } else if (panne) {
    etat.autres.push(tR('Réparer : {p}', { p: String(panne.description || '').slice(0, 120) }));
  } else if (plan) {
    // « Créer un ordre » depuis la fiche d'une machine : on coche d'avance les tâches du plan EN RETARD ou BIENTÔT dues.
    otElementsPlan(otMachine(machineInitiale)).forEach((x) => { if (x.info && (x.info.state === 'late' || x.info.state === 'soon')) etat.cochees.add(x.label); });
  }

  const overlay = document.createElement('div');
  overlay.className = 'overlay otm-overlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal otm otm-form" role="dialog" aria-modal="true" aria-labelledby="otf-titre">
      <header class="otm-tete">
        <div class="otm-tuile">${otSymbole(edition ? 'edit_note' : 'handyman')}</div>
        <div class="otm-tete-textes">
          <div class="otm-tete-ligne"><span class="otm-etape">${edition ? 'OT-' + ordre.numero : trad('Étape 2/2')}</span><span class="otm-marque">GMAO KALEA</span></div>
          <h2 id="otf-titre">${edition ? tR('Modifier l\'ordre OT-{n}', { n: ordre.numero }).replace('OT-', 'OT‑') : trad('Nouvel ordre de travail')}</h2>
          <p>${trad('Définis les tâches à faire, la priorité et la personne assignée')}</p>
        </div>
        <button type="button" class="otm-fermer" data-otm-fermer aria-label="${esc(trad('Fermer'))}">${otSymbole('close')}</button>
      </header>
      <div class="otm-corps otm-form-corps">
        <input type="hidden" id="otf-machine" value="${esc(machineInitiale)}">
        <div class="otm-machine-resume">
          <div class="otm-machine-icone is-${otEtatMachine(machineDeLOrdre).cle}">${otSymbole(otIconeMachine(machineDeLOrdre))}</div>
          ${otMachineTextesHtml(machineDeLOrdre)}
        </div>
        <section class="otm-bloc">
          <h3 class="otm-bloc-titre">${otSymbole('checklist')}<span>${trad('Type de tâche')}</span></h3>
          <p class="ui-aide">${trad('Coche les tâches du plan d\'entretien à faire, ou ajoute une autre tâche.')}</p>
          <div id="otf-plan-liste"></div>
          <div id="otf-autres-liste"></div>
          <div class="ot-ajout">
            <input id="otf-autre" class="ui-champ" maxlength="200" placeholder="${esc(trad('Autre tâche (ex. : contrôler les freins)'))}" aria-label="${esc(trad('Autre tâche'))}">
            <button type="button" class="otm-btn" id="otf-ajouter">${trad('Ajouter')}</button>
          </div>
        </section>
        <section class="otm-bloc">
          <h3 class="otm-bloc-titre">${otSymbole('event_available')}<span>${trad('Planification')}</span></h3>
          <div class="ui-grille">
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="otf-priorite">${trad('Priorité')}</label>
              <select id="otf-priorite" class="ui-selecteur is-plein">${Object.entries(priorites).map(([k, [l]]) => `<option value="${k}"${(ordre ? ordre.priorite : 'normale') === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
            </div>
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="otf-assigne">${trad('Assigné à')}</label>
              <select id="otf-assigne" class="ui-selecteur is-plein"><option value="">${trad('Non assigné')}</option>${assignables.map((m) => `<option value="${esc(m.id)}"${ordre && String(ordre.assigne_a) === String(m.id) ? ' selected' : ''}>${esc(m.nom_affiche)}</option>`).join('')}</select>
              <p class="ui-aide" id="otf-habilitation" role="status" aria-live="polite" hidden></p>
              ${assigneInvalide ? `<p class="ui-aide" id="otf-assigne-alerte" style="color:var(--danger,#c0392b)">${tR('{n} n\'a pas accès aux ordres de travail (droit d\'achat) : choisis quelqu\'un d\'autre.', { n: esc(otNomEquipe(ordre.assigne_a)) })}</p>` : ''}
            </div>
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="otf-echeance">${trad('Échéance (facultatif)')}</label>
              <input id="otf-echeance" class="ui-champ" type="date" value="${esc(ordre && ordre.echeance ? ordre.echeance : '')}">
            </div>
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="otf-duree">${trad('Durée estimée en heures (facultatif)')}</label>
              <input id="otf-duree" class="ui-champ" type="number" min="0" max="9999" step="0.5" value="${ordre && ordre.duree_estimee_h != null ? esc(ordre.duree_estimee_h) : ''}">
            </div>
          </div>
        </section>
        <div id="otf-msg" class="ui-aide" role="status" aria-live="polite" style="color:var(--danger,#c0392b)"></div>
      </div>
      <footer class="otm-pied">
        ${retour ? `<button type="button" class="otm-btn is-discret" id="otf-retour">${otSymbole('arrow_back')}<span>${trad('Retour')}</span></button>` : '<span></span>'}
        <div class="otm-pied-actions">
          <button type="button" class="otm-btn" id="otf-annuler">${trad('Annuler')}</button>
          <button type="button" class="otm-btn is-plein" id="otf-enregistrer"><span>${edition ? trad('Enregistrer') : trad('Créer l\'ordre')}</span>${edition ? '' : otSymbole('arrow_forward')}</button>
        </div>
      </footer>
    </div>`;
  document.body.appendChild(overlay);
  const q = (s) => overlay.querySelector(s);
  overlay.addEventListener('click', (e) => { if (e.target.closest('[data-otm-fermer]')) overlay.remove(); });
  if (retour) q('#otf-retour').addEventListener('click', () => { overlay.remove(); retour(); });
  habillerSelect(q('#otf-priorite'), trad('Priorité'));
  habillerSelect(q('#otf-assigne'), trad('Assigné à'));
  habillerChampDate(q('#otf-echeance'), trad('Échéance'));
  // Habilitations (étape 5) : ce qui manque à la personne choisie pour cette machine, dit tout de suite (le serveur refuse en plus en mode « bloquer »).
  const verifierHabilitation = async () => {
    const zone = q('#otf-habilitation');
    const profil = q('#otf-assigne').value;
    if (!zone) return;
    zone.hidden = true; zone.textContent = '';
    if (!profil || typeof controleHabilitationAssignation !== 'function') return;
    const c = await controleHabilitationAssignation(profil, q('#otf-machine').value);
    if (profil !== q('#otf-assigne').value) return;          // une autre personne a été choisie entre-temps
    const m = messageHabilitationAssignation(c, otNomEquipe(profil));
    if (!m) return;
    zone.textContent = m.texte;
    zone.style.color = m.bloquant ? 'var(--danger,#c0392b)' : 'var(--late,#B45309)';
    zone.hidden = false;
  };
  q('#otf-assigne').addEventListener('change', verifierHabilitation);
  if (q('#otf-assigne').value) verifierHabilitation();

  const machineChoisie = () => otMachine(q('#otf-machine').value);
  let elementsCourants = [];
  const dessinerPlan = () => {
    elementsCourants = otElementsPlan(machineChoisie());
    const classes = { late: 'is-retard', soon: 'is-bientot', ok: 'is-ok' };
    q('#otf-plan-liste').innerHTML = elementsCourants.length
      ? `<div class="ot-choix-liste">${elementsCourants.map((x, i) => `
          <label class="check-row ot-choix">
            <input type="checkbox" data-otf-plan="${i}" ${etat.cochees.has(x.label) ? 'checked' : ''}>
            <span class="ot-choix-texte">${esc(x.label)}</span>
            ${x.info && classes[x.info.state] ? `<span class="ui-statut ${classes[x.info.state]}">${esc(x.info.short || '')}</span>` : ''}
          </label>`).join('')}</div>`
      : `<p class="ui-aide">${trad('Cette machine n\'a pas de plan d\'entretien : ajoute les tâches ci-dessous.')}</p>`;
  };
  const dessinerAutres = () => {
    q('#otf-autres-liste').innerHTML = etat.autres.length
      ? `<div class="ot-choix-liste">${etat.autres.map((t, i) => `
          <div class="ot-choix ot-autre"><span class="ot-choix-texte">${esc(t)}</span>
            <button type="button" class="ui-btn ui-btn-pastille" data-otf-retirer="${i}" aria-label="${esc(tR('Retirer « {t} »', { t }))}">${trad('Retirer')}</button></div>`).join('')}</div>`
      : '';
  };
  dessinerPlan();
  dessinerAutres();

  const ajouterAutre = () => {
    const champ = q('#otf-autre');
    const texte = champ.value.trim();
    if (!texte) { champ.focus(); return; }
    if (!etat.autres.includes(texte)) etat.autres.push(texte);
    champ.value = '';
    dessinerAutres();
    champ.focus();
  };
  q('#otf-ajouter').addEventListener('click', ajouterAutre);
  q('#otf-autre').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ajouterAutre(); } });
  overlay.addEventListener('change', (e) => {
    const c = e.target.closest('[data-otf-plan]');
    if (!c) return;
    const x = elementsCourants[Number(c.getAttribute('data-otf-plan'))];
    if (!x) return;
    if (c.checked) etat.cochees.add(x.label); else etat.cochees.delete(x.label);
  });
  overlay.addEventListener('click', (e) => {
    const r = e.target.closest('[data-otf-retirer]');
    if (!r) return;
    etat.autres.splice(Number(r.getAttribute('data-otf-retirer')), 1);
    dessinerAutres();
  });
  q('#otf-annuler').addEventListener('click', () => overlay.remove());
  q('#otf-enregistrer').addEventListener('click', async () => {
    const msg = q('#otf-msg');
    msg.textContent = '';
    // une « autre tâche » tapée mais pas encore ajoutée compte aussi (on ne perd pas la saisie)
    const enAttente = q('#otf-autre').value.trim();
    if (enAttente && !etat.autres.includes(enAttente)) { etat.autres.push(enAttente); q('#otf-autre').value = ''; dessinerAutres(); }
    const libelles = [...new Set([...elementsCourants.map((x) => x.label).filter((l) => etat.cochees.has(l)), ...etat.autres])];
    if (!libelles.length) { msg.textContent = trad('Coche au moins une tâche du plan ou ajoute une autre tâche.'); return; }
    const checklist = libelles.map((l) => (existantes.has(l) ? existantes.get(l) : { label: l, fait: false }));
    const titre = otTitreAuto(libelles);
    const duree = q('#otf-duree').value;
    const bouton = q('#otf-enregistrer');
    bouton.disabled = true;
    let reponse;
    if (edition) {
      reponse = await sb.rpc('ordre_travail_modifier', { p_id: ordre.id, p_version: ordre.version, p_champs: {
        titre, priorite: q('#otf-priorite').value, assigne_a: q('#otf-assigne').value || null,
        echeance: q('#otf-echeance').value || null, duree_estimee_h: duree === '' ? null : Number(duree), checklist,
      } });
    } else {
      reponse = await sb.rpc('ordre_travail_creer', {
        p_id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : null,
        p_machine: q('#otf-machine').value, p_titre: titre, p_description: panne ? String(panne.description || '').slice(0, 500) : null,
        p_priorite: q('#otf-priorite').value, p_assigne: q('#otf-assigne').value || null, p_echeance: q('#otf-echeance').value || null,
        p_duree: duree === '' ? null : Number(duree), p_checklist: checklist, p_source: panne ? 'panne' : (plan ? 'plan' : 'manuel'),
        p_plan: plan && machineChoisie() && machineChoisie().plan ? machineChoisie().plan.id : null, p_panne: panne ? panne.id : null,
      });
    }
    if (reponse.error) { bouton.disabled = false; msg.textContent = reponse.error.message || trad('Enregistrement impossible. Réessaie.'); return; }
    otMettreAJour(reponse.data);
    overlay.remove();
    showToast(edition ? trad('Ordre modifié') : tR('Ordre OT-{n} créé', { n: reponse.data.numero }));
    // Après une création : on montre la liste des ordres, SANS ouvrir la fiche (elle prêtait à confusion et on la fermait à chaque fois).
    if (!edition && UI.view !== 'ordres') goTo('ordres');
  });
  // Priorité proposée pour une panne : une panne bloquante est urgente.
  if (panne && !edition) {
    q('#otf-priorite').value = panne.severity === 'bloquante' ? 'urgente' : (panne.severity === 'importante' ? 'haute' : 'normale');
    q('#otf-priorite').dispatchEvent(new Event('change'));
  }
}
