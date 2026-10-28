// ── QUALIFICATIONS ET HABILITATIONS PAR MACHINE (étape 5 du plan « nouvelles fonctionnalités », §7) ───────────────────────────────────────────────────────
// Le gérant tient le catalogue des qualifications de sa société, les habilitations de chaque personne (obtenue le, expire le) et les exigences par catégorie ou par machine.
// Chacun consulte SES habilitations. À l'assignation d'un ordre de travail, l'appli dit ce qui manque (le serveur refuse en plus si le réglage de la société est « bloquer »).
//
// OFFRE : Enterprise (comme la signature). SCHEMA.hasHabilitations : tant que habilitations.sql n'est pas passé, aucun bouton, aucune fenêtre.
// DONNÉES DE SALARIÉS : la lecture est limitée par le serveur (gérant + personne concernée) ; cet écran n'affiche donc rien d'autre.
// EN LIGNE SEULEMENT pour l'instant (gestion du gérant au bureau) ; le verdict d'assignation demande aussi le réseau et n'empêche jamais d'enregistrer s'il est injoignable.

function habilitationsActif() {
  return Boolean(SCHEMA.hasHabilitations) && typeof planCouvreSignature === 'function' && planCouvreSignature();
}

const HAB_MODES = () => ({
  aucun: [trad('Aucune règle'), trad('Les habilitations sont tenues à jour mais rien n\'est contrôlé.')],
  avertir: [trad('Avertir'), trad('L\'appli prévient à l\'assignation d\'un ordre, sans bloquer.')],
  bloquer: [trad('Bloquer'), trad('Le serveur refuse d\'assigner un ordre, ou de signer comme exécutant, sans l\'habilitation obligatoire.')],
});
const habDate = (iso) => (iso ? formatShortDateAvecAnnee(iso) : '');
const habJours = (iso) => Math.round((new Date(iso + 'T00:00:00') - new Date(todayIso() + 'T00:00:00')) / 86400000);
// État d'une habilitation : valide / bientôt (60 jours) / expirée / sans expiration.
function habEtat(h) {
  if (!h.expire_le) return ['is-ok', trad('Sans expiration')];
  const j = habJours(h.expire_le);
  if (j < 0) return ['is-retard', tR('Expirée depuis {n} j', { n: -j })];
  if (j <= 60) return ['is-bientot', tR('Expire dans {n} j', { n: j })];
  return ['is-ok', tR('Valable jusqu\'au {date}', { date: habDate(h.expire_le) })];
}

// ── Une petite fenêtre de saisie générique : champs [{id, etiquette, type: 'texte'|'nombre'|'date'|'liste'|'case', valeur, options: [[valeur, libellé]], aide, obligatoire}] ──
// Rend les valeurs saisies, ou null si on renonce. `valider(valeurs)` peut rendre un message d'erreur (la fenêtre reste ouverte) ou rien (elle se ferme).
function habMiniFormulaire({ titre, sousTitre, symbole = 'workspace_premium', etape, champs, bouton, valider }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay otm-overlay';
    const html = champs.map((c) => {
      if (c.type === 'case') return `<label class="check-row"><input type="checkbox" id="hab-${c.id}" ${c.valeur ? 'checked' : ''}> ${esc(c.etiquette)}</label>`;
      const champ = c.type === 'liste'
        ? `<select id="hab-${c.id}" class="ui-selecteur is-plein">${c.options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(c.valeur ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`
        : `<input id="hab-${c.id}" class="ui-champ" type="${c.type === 'nombre' ? 'number' : (c.type === 'date' ? 'date' : 'text')}" ${c.type === 'nombre' ? 'min="1" max="240" step="1"' : ''} maxlength="${c.max || 120}" value="${esc(c.valeur ?? '')}" autocomplete="off">`;
      return `<div class="ui-champ-groupe"><label class="ui-etiquette" for="hab-${c.id}">${esc(c.etiquette)}</label>${champ}${c.aide ? `<p class="ui-aide">${esc(c.aide)}</p>` : ''}</div>`;
    }).join('');
    overlay.innerHTML = `
      <div class="modal otm sig-modal" role="dialog" aria-modal="true" aria-labelledby="hab-titre">
        <header class="otm-tete">
          <div class="otm-tuile">${otSymbole(symbole)}</div>
          <div class="otm-tete-textes"><div class="otm-tete-ligne"><span class="otm-etape">${esc(etape || trad('Habilitations'))}</span><span class="otm-marque">GMAO KALEA</span></div>
            <h2 id="hab-titre">${esc(titre)}</h2>${sousTitre ? `<p>${esc(sousTitre)}</p>` : ''}</div>
          <button type="button" class="otm-fermer" data-hab-annuler aria-label="${esc(trad('Fermer'))}">${otSymbole('close')}</button>
        </header>
        <div class="otm-form-corps"><section class="otm-bloc">${html}<div id="hab-msg" class="ui-aide" role="status" aria-live="polite" style="color:var(--danger,#c0392b)"></div></section></div>
        <footer class="otm-pied"><span></span><div class="otm-pied-actions"><button type="button" class="otm-btn" data-hab-annuler>${trad('Annuler')}</button><button type="button" class="otm-btn is-plein" id="hab-valider"><span>${esc(bouton || trad('Enregistrer'))}</span></button></div></footer>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('select.ui-selecteur').forEach((s) => { if (typeof habillerSelect === 'function') habillerSelect(s, s.closest('.ui-champ-groupe')?.querySelector('label')?.textContent || ''); });
    overlay.querySelectorAll('input[type=date]').forEach((d) => { if (typeof habillerChampDate === 'function') habillerChampDate(d, d.closest('.ui-champ-groupe')?.querySelector('label')?.textContent || ''); });
    const fin = (v) => { overlay.remove(); resolve(v); };
    // Champs conditionnels (`visibleSi: [champ, valeur]`) : un champ qui ne s'applique pas au choix fait est caché (et n'est ni exigé, ni lu).
    const estVisible = (c) => !c.visibleSi || (overlay.querySelector('#hab-' + c.visibleSi[0]) || {}).value === c.visibleSi[1];
    const majVisibilite = () => champs.forEach((c) => { if (!c.visibleSi) return; const g = overlay.querySelector('#hab-' + c.id).closest('.ui-champ-groupe'); if (g) g.hidden = !estVisible(c); });
    overlay.addEventListener('change', majVisibilite);
    majVisibilite();
    overlay.querySelectorAll('[data-hab-annuler]').forEach((b) => b.addEventListener('click', () => fin(null)));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fin(null); });
    overlay.querySelector('#hab-valider').addEventListener('click', async () => {
      const valeurs = {};
      champs.forEach((c) => { const el = overlay.querySelector('#hab-' + c.id); valeurs[c.id] = c.type === 'case' ? el.checked : el.value.trim(); });
      const manque = champs.find((c) => c.obligatoire && estVisible(c) && !valeurs[c.id]);
      const msg = overlay.querySelector('#hab-msg');
      if (manque) { msg.textContent = tR('« {champ} » est obligatoire.', { champ: manque.etiquette }); return; }
      const bouton2 = overlay.querySelector('#hab-valider');
      bouton2.disabled = true;
      let erreur = null;
      try { erreur = valider ? await valider(valeurs) : null; } catch (err) { erreur = (err && err.message) || String(err); }
      if (erreur) { bouton2.disabled = false; msg.textContent = erreur; return; }
      fin(valeurs);
    });
    const premier = overlay.querySelector('input:not([type=checkbox]),select');
    if (premier) setTimeout(() => premier.focus && premier.focus(), 80);
  });
}

// ── Les données de la fenêtre de gestion (gérant) ──
async function habChargerGestion() {
  const [qs, hs, es, soc, equipe, exp] = await Promise.all([
    sb.from('qualifications').select('id, nom, duree_validite_mois, description, actif').order('nom'),
    sb.from('habilitations').select('id, profil_id, qualification_id, obtenue_le, expire_le, justificatif, verifie_par, verifie_a').order('expire_le', { ascending: true, nullsFirst: false }),
    sb.from('exigences_qualification').select('id, qualification_id, machine_id, category_id, niveau'),
    sb.from('companies').select('habilitations_mode').eq('id', UI.companyId).maybeSingle(),
    equipePourAttribution().catch(() => []),
    sb.rpc('habilitations_expirantes', { p_jours: 60 }),
  ]);
  for (const r of [qs, hs, es, soc]) if (r.error) throw r.error;
  return {
    qualifications: qs.data || [], habilitations: hs.data || [], exigences: es.data || [], mode: (soc.data && soc.data.habilitations_mode) || 'avertir',
    equipe: (equipe || []).map((m) => ({ id: m.id, nom: m.nom_affiche })), expirantes: exp.error ? [] : (exp.data || []),
  };
}

// ── La fenêtre « Qualifications et habilitations » (gérant) ──
async function ouvrirGestionHabilitations(ongletInitial = 'personnes') {
  if (!habilitationsActif() || !estGerant()) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay otm-overlay';
  overlay.innerHTML = `
    <div class="modal otm sig-modal hab-modal" role="dialog" aria-modal="true" aria-labelledby="hab-g-titre">
      <header class="otm-tete">
        <div class="otm-tuile">${otSymbole('workspace_premium')}</div>
        <div class="otm-tete-textes"><div class="otm-tete-ligne"><span class="otm-etape">${trad('Habilitations')}</span><span class="otm-marque">GMAO KALEA</span></div>
          <h2 id="hab-g-titre">${trad('Qualifications et habilitations')}</h2><p>${trad('Qui peut intervenir sur quelle machine.')}</p></div>
        <button type="button" class="otm-fermer" data-hab-fermer aria-label="${esc(trad('Fermer'))}">${otSymbole('close')}</button>
      </header>
      <div class="otm-form-corps">
        <div class="ui-puces hab-onglets" role="tablist" id="hab-onglets"></div>
        <div id="hab-corps"><p class="ui-aide">${trad('Chargement…')}</p></div>
        <div id="hab-g-msg" class="ui-aide" role="status" aria-live="polite" style="color:var(--danger,#c0392b)"></div>
      </div>
      <footer class="otm-pied" id="hab-pied"></footer>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-hab-fermer]')) overlay.remove(); });
  let d = null; let onglet = ongletInitial;
  const dire = (t) => { const m = overlay.querySelector('#hab-g-msg'); if (m) m.textContent = t || ''; };
  const nomQual = (id) => (d.qualifications.find((q) => q.id === id) || {}).nom || '—';
  const nomPers = (id) => (d.equipe.find((m) => m.id === id) || {}).nom || trad('Membre');
  const nomCible = (e) => e.machine_id
    ? ((UI.machines || []).find((m) => String(m.id) === String(e.machine_id)) || {}).name || trad('Machine')
    : tR('Catégorie « {nom} »', { nom: ((UI.categories || []).find((c) => String(c.id) === String(e.category_id)) || {}).name || '—' });

  const vuePersonnes = () => {
    const exp = d.expirantes.length ? `<section class="otm-bloc"><h3 class="otm-bloc-titre">${otSymbole('alarm')}<span>${trad('À renouveler bientôt')}</span></h3>
      ${d.expirantes.map((e) => { const [cl, tx] = habEtat({ expire_le: e.expire_le }); return `<div class="hab-ligne"><div><strong>${esc(e.nom_affiche)}</strong><span class="sig-meta">${esc(e.qualification)}</span></div><span class="ui-statut ${cl}">${esc(tx)}</span></div>`; }).join('')}</section>` : '';
    if (!d.qualifications.length) return exp + `<div class="ui-encadre">${otSymbole('info')}<p>${trad('Commence par le catalogue : ajoute les qualifications utiles à ta société, puis reviens saisir les habilitations des personnes.')}</p></div>`;
    return exp + d.equipe.map((m) => {
      const lignes = d.habilitations.filter((h) => h.profil_id === m.id);
      // Une personne sans habilitation tient sur UNE ligne (nom, mention discrète, bouton) ; avec des habilitations, le nom puis une ligne par habilitation.
      return `<section class="otm-bloc hab-personne${lignes.length ? '' : ' is-vide'}"><div class="hab-tete"><h3 class="otm-bloc-titre">${otSymbole('person')}<span>${esc(m.nom)}</span></h3>
        ${lignes.length ? '' : `<span class="sig-meta hab-vide">${trad('Aucune habilitation enregistrée.')}</span>`}
        <button type="button" class="ui-btn ui-btn-pastille" data-hab-ajout="${esc(m.id)}">${trad('Ajouter')}</button></div>
        ${lignes.length ? lignes.map((h) => { const [cl, tx] = habEtat(h); return `
          <div class="hab-ligne"><div><strong>${esc(nomQual(h.qualification_id))}</strong><span class="sig-meta">${tR('Obtenue le {date}', { date: habDate(h.obtenue_le) })}${h.verifie_a ? ' · ' + trad('Vérifiée') : ''}</span></div>
            <div class="hab-actions"><span class="ui-statut ${cl}">${esc(tx)}</span>
              ${h.verifie_a ? '' : `<button type="button" class="ui-btn ui-btn-pastille" data-hab-verifier="${esc(h.id)}">${trad('Vérifier')}</button>`}
              <button type="button" class="ui-btn ui-btn-pastille" data-hab-modifier="${esc(h.id)}">${trad('Modifier')}</button>
              <button type="button" class="ui-btn ui-btn-pastille" data-hab-suppr="${esc(h.id)}">${trad('Retirer')}</button></div></div>`; }).join('')
          : ''}</section>`;
    }).join('');
  };
  const vueCatalogue = () => `<section class="otm-bloc"><div class="hab-tete"><h3 class="otm-bloc-titre">${otSymbole('list_alt')}<span>${trad('Catalogue de la société')}</span></h3>
      <button type="button" class="ui-btn ui-btn-pastille" data-hab-nouvelle-qual>${trad('Ajouter')}</button></div>
      ${d.qualifications.length ? d.qualifications.map((q) => `<div class="hab-ligne"><div><strong>${esc(q.nom)}${q.actif ? '' : ` <span class="sig-meta">(${trad('désactivée')})</span>`}</strong>
        <span class="sig-meta">${q.duree_validite_mois ? tR('Valable {n} mois', { n: q.duree_validite_mois }) : trad('Sans expiration par défaut')}</span></div>
        <div class="hab-actions"><button type="button" class="ui-btn ui-btn-pastille" data-hab-edit-qual="${esc(q.id)}">${trad('Modifier')}</button>
        <button type="button" class="ui-btn ui-btn-pastille" data-hab-suppr-qual="${esc(q.id)}">${trad('Supprimer')}</button></div></div>`).join('')
      : `<p class="ui-aide">${trad('Aucune qualification pour l\'instant. Ajoute celles dont ta société a besoin (nom, durée de validité).')}</p>`}</section>`;
  const vueExigences = () => `<section class="otm-bloc"><div class="hab-tete"><h3 class="otm-bloc-titre">${otSymbole('rule')}<span>${trad('Exigences par catégorie ou machine')}</span></h3>
      <button type="button" class="ui-btn ui-btn-pastille" data-hab-nouvelle-exig ${d.qualifications.length ? '' : 'disabled'}>${trad('Ajouter')}</button></div>
      ${d.exigences.length ? d.exigences.map((e) => `<div class="hab-ligne"><div><strong>${esc(nomQual(e.qualification_id))}</strong><span class="sig-meta">${esc(nomCible(e))}</span></div>
        <div class="hab-actions"><span class="ui-statut ${e.niveau === 'obligatoire' ? 'is-retard' : 'is-bientot'}">${e.niveau === 'obligatoire' ? trad('Obligatoire') : trad('Recommandée')}</span>
        <button type="button" class="ui-btn ui-btn-pastille" data-hab-retirer-exig="${esc(e.id)}">${trad('Retirer')}</button></div></div>`).join('')
      : `<p class="ui-aide">${d.qualifications.length ? trad('Aucune exigence : personne n\'est contrôlé pour l\'instant.') : trad('Ajoute d\'abord des qualifications au catalogue.')}</p>`}</section>`;

  const dessiner = () => {
    const onglets = [['personnes', trad('Personnes')], ['catalogue', trad('Catalogue')], ['exigences', trad('Exigences')]];
    overlay.querySelector('#hab-onglets').innerHTML = onglets.map(([id, l]) => `<button type="button" class="ui-puce${onglet === id ? ' is-actif' : ''}" data-hab-onglet="${id}">${esc(l)}</button>`).join('');
    overlay.querySelector('#hab-corps').innerHTML = onglet === 'personnes' ? vuePersonnes() : (onglet === 'catalogue' ? vueCatalogue() : vueExigences());
    overlay.querySelector('#hab-pied').innerHTML = `<div class="hab-mode"><label class="ui-etiquette" for="hab-mode">${trad('Règle de la société')}</label>
      <select id="hab-mode" class="ui-selecteur">${Object.entries(HAB_MODES()).map(([k, [l]]) => `<option value="${k}"${d.mode === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
    overlay.querySelector('#hab-mode-aide')?.remove();
    overlay.querySelector('#hab-pied').insertAdjacentHTML('beforeend', `<p class="ui-aide hab-mode-aide" id="hab-mode-aide">${esc(HAB_MODES()[d.mode][1])}</p>`);
  };
  const recharger = async () => { try { d = await habChargerGestion(); dessiner(); } catch (err) { overlay.querySelector('#hab-corps').innerHTML = `<p class="ui-aide" style="color:var(--danger,#c0392b)">${esc((err && err.message) || trad('Chargement impossible.'))}</p>`; } };
  await recharger();
  const rpc = async (nom, args) => { dire(''); const { data, error } = await sb.rpc(nom, args); if (error) { dire(error.message || trad('Action impossible pour le moment.')); return null; } return data === undefined ? true : (data === null ? true : data); };
  const optsQual = (avecInactives) => d.qualifications.filter((q) => avecInactives || q.actif).map((q) => [q.id, q.nom]);

  const formHabilitation = async (profilId, existante) => {
    const qual0 = existante ? existante.qualification_id : (optsQual()[0] || [''])[0];
    const r = await habMiniFormulaire({
      titre: existante ? trad('Modifier l\'habilitation') : trad('Ajouter une habilitation'), sousTitre: nomPers(profilId), bouton: trad('Enregistrer'),
      champs: [
        { id: 'qual', etiquette: trad('Qualification'), type: 'liste', options: optsQual(true), valeur: qual0, obligatoire: true },
        { id: 'obt', etiquette: trad('Obtenue le'), type: 'date', valeur: existante ? existante.obtenue_le : todayIso(), obligatoire: true },
        { id: 'exp', etiquette: trad('Expire le (facultatif)'), type: 'date', valeur: existante && existante.expire_le ? existante.expire_le : '', aide: trad('Laisse vide pour calculer la date avec la durée de validité de la qualification.') },
      ],
      valider: async (v) => {
        const { error } = await sb.rpc('habilitation_enregistrer', { p_id: existante ? existante.id : nouvelIdentifiant(), p_profil: profilId, p_qualification: v.qual, p_obtenue_le: v.obt, p_expire_le: v.exp || null, p_justificatif: existante ? existante.justificatif : null });
        return error ? (error.message || trad('Enregistrement impossible. Réessaie.')) : null;
      },
    });
    if (r) await recharger();
  };
  const formQualification = async (existante) => {
    const r = await habMiniFormulaire({
      titre: existante ? trad('Modifier la qualification') : trad('Nouvelle qualification'), symbole: 'list_alt', bouton: trad('Enregistrer'),
      champs: [
        { id: 'nom', etiquette: trad('Nom'), type: 'texte', valeur: existante ? existante.nom : '', obligatoire: true },
        { id: 'duree', etiquette: trad('Durée de validité en mois (facultatif)'), type: 'nombre', valeur: existante && existante.duree_validite_mois ? existante.duree_validite_mois : '', aide: trad('Vide = sans expiration. Sert à calculer la date d\'expiration d\'une habilitation.') },
        { id: 'actif', etiquette: trad('Active (proposée à la saisie et contrôlée)'), type: 'case', valeur: existante ? existante.actif : true },
      ],
      valider: async (v) => {
        const { error } = await sb.rpc('qualification_enregistrer', { p_id: existante ? existante.id : nouvelIdentifiant(), p_nom: v.nom, p_duree_mois: v.duree ? Number(v.duree) : null, p_description: existante ? existante.description : null, p_actif: v.actif });
        return error ? (error.message || trad('Enregistrement impossible. Réessaie.')) : null;
      },
    });
    if (r) await recharger();
  };
  const formExigence = async () => {
    const parNom = (a, b) => String(a[1]).localeCompare(String(b[1]), undefined, { sensitivity: 'base' });
    const cats = (UI.categories || []).map((c) => [c.id, c.name]).sort(parNom);
    const machines = (UI.machines || []).map((m) => [m.id, m.name]).sort(parNom);
    // Seuls les choix possibles sont proposés : sans catégorie, on ne propose que « une machine » ; sans machine, que « une catégorie ».
    const cibles = [...(cats.length ? [['categorie', trad('Une catégorie de machines')]] : []), ...(machines.length ? [['machine', trad('Une machine')]] : [])];
    if (!cibles.length) { dire(trad('Aucune machine ni catégorie : ajoute d\'abord une machine.')); return; }
    const r = await habMiniFormulaire({
      titre: trad('Nouvelle exigence'), symbole: 'rule', bouton: trad('Ajouter'),
      champs: [
        { id: 'qual', etiquette: trad('Qualification'), type: 'liste', options: optsQual(), valeur: (optsQual()[0] || [''])[0], obligatoire: true },
        { id: 'type', etiquette: trad('S\'applique à'), type: 'liste', options: cibles, valeur: cibles[0][0] },
        // Un seul des deux choix s'affiche, selon « S'applique à » : les catégories OU les machines, jamais les deux.
        { id: 'cat', etiquette: trad('Catégorie'), type: 'liste', options: cats.length ? cats : [['', '']], valeur: (cats[0] || [''])[0], visibleSi: ['type', 'categorie'], obligatoire: true },
        { id: 'machine', etiquette: trad('Machine'), type: 'liste', options: machines.length ? machines : [['', '']], valeur: (machines[0] || [''])[0], visibleSi: ['type', 'machine'], obligatoire: true },
        { id: 'niveau', etiquette: trad('Niveau'), type: 'liste', options: [['obligatoire', trad('Obligatoire')], ['recommandee', trad('Recommandée')]], valeur: 'obligatoire' },
      ],
      valider: async (v) => {
        const cible = v.type === 'machine' ? { p_machine: v.machine || null, p_categorie: null } : { p_machine: null, p_categorie: v.cat || null };
        if (!cible.p_machine && !cible.p_categorie) return trad('Choisis une catégorie ou une machine.');
        const { error } = await sb.rpc('exigence_definir', { p_id: nouvelIdentifiant(), p_qualification: v.qual, ...cible, p_niveau: v.niveau });
        return error ? (error.message || trad('Enregistrement impossible. Réessaie.')) : null;
      },
    });
    if (r) await recharger();
  };

  overlay.addEventListener('change', async (e) => {
    if (e.target.id !== 'hab-mode') return;
    const voulu = e.target.value;
    if (voulu === 'bloquer' && !window.confirm(trad('Bloquer : le serveur refusera d\'assigner un ordre, ou de signer comme exécutant, à toute personne sans l\'habilitation obligatoire en cours de validité. Continuer ?'))) { e.target.value = d.mode; return; }
    if (await rpc('definir_habilitations_mode', { p_mode: voulu })) { d.mode = voulu; dessiner(); } else e.target.value = d.mode;
  });
  overlay.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || !d) return;
    const a = (n) => b.getAttribute(n);
    if (a('data-hab-onglet')) { onglet = a('data-hab-onglet'); dire(''); dessiner(); return; }
    if (a('data-hab-ajout')) { await formHabilitation(a('data-hab-ajout'), null); return; }
    if (a('data-hab-modifier')) { const h = d.habilitations.find((x) => x.id === a('data-hab-modifier')); if (h) await formHabilitation(h.profil_id, h); return; }
    if (a('data-hab-verifier')) { if (await rpc('habilitation_verifier', { p_id: a('data-hab-verifier') })) await recharger(); return; }
    if (a('data-hab-suppr')) { if (window.confirm(trad('Retirer cette habilitation ?')) && await rpc('habilitation_supprimer', { p_id: a('data-hab-suppr') })) await recharger(); return; }
    if (b.hasAttribute('data-hab-nouvelle-qual')) { await formQualification(null); return; }
    if (a('data-hab-edit-qual')) { const q = d.qualifications.find((x) => x.id === a('data-hab-edit-qual')); if (q) await formQualification(q); return; }
    if (a('data-hab-suppr-qual')) { if (window.confirm(trad('Supprimer cette qualification ?')) && await rpc('qualification_supprimer', { p_id: a('data-hab-suppr-qual') })) await recharger(); return; }
    if (b.hasAttribute('data-hab-nouvelle-exig')) { await formExigence(); return; }
    if (a('data-hab-retirer-exig')) { if (await rpc('exigence_retirer', { p_id: a('data-hab-retirer-exig') })) await recharger(); return; }
  });
}

// ── « Qui est habilité » pour UNE machine (gérant) : ce que la machine exige, puis chaque membre avec son verdict ──
async function ouvrirHabilitesMachine(machine) {
  if (!habilitationsActif() || !estGerant() || !machine) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay otm-overlay';
  overlay.innerHTML = `
    <div class="modal otm sig-modal" role="dialog" aria-modal="true" aria-labelledby="hab-q-titre">
      <header class="otm-tete"><div class="otm-tuile">${otSymbole('workspace_premium')}</div>
        <div class="otm-tete-textes"><div class="otm-tete-ligne"><span class="otm-etape">${trad('Habilitations')}</span><span class="otm-marque">GMAO KALEA</span></div>
          <h2 id="hab-q-titre">${trad('Qui est habilité')}</h2><p>${esc(machine.name)}</p></div>
        <button type="button" class="otm-fermer" data-hab-fermer aria-label="${esc(trad('Fermer'))}">${otSymbole('close')}</button></header>
      <div class="otm-form-corps" id="hab-q-corps"><p class="ui-aide">${trad('Chargement…')}</p></div>
      <footer class="otm-pied"><span></span><div class="otm-pied-actions"><button type="button" class="otm-btn" data-hab-gerer>${trad('Gérer les habilitations')}</button></div></footer>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-hab-fermer]')) overlay.remove();
    else if (e.target.closest('[data-hab-gerer]')) { overlay.remove(); ouvrirGestionHabilitations(); }
  });
  try {
    const [eq, ex, qs] = await Promise.all([
      sb.rpc('habilitations_equipe_machine', { p_machine: machine.id }),
      sb.from('exigences_qualification').select('qualification_id, machine_id, category_id, niveau'),
      sb.from('qualifications').select('id, nom'),
    ]);
    if (eq.error) throw eq.error;
    const noms = new Map((qs.data || []).map((q) => [q.id, q.nom]));
    // Les exigences qui s'appliquent à CETTE machine : la sienne, ou celle de sa catégorie.
    const catId = machine.category_id || (machine.category && machine.category.id) || null;
    const exigences = (ex.data || []).filter((e) => e.machine_id === machine.id || (catId && e.category_id === catId));
    const equipe = eq.data || [];
    const exigHtml = exigences.length
      ? `<section class="otm-bloc"><h3 class="otm-bloc-titre">${otSymbole('rule')}<span>${trad('Exigences de cette machine')}</span></h3>
          ${exigences.map((e) => `<div class="hab-ligne"><div><strong>${esc(noms.get(e.qualification_id) || '—')}</strong><span class="sig-meta">${e.machine_id ? trad('Cette machine') : trad('Sa catégorie')}</span></div>
            <span class="ui-statut ${e.niveau === 'obligatoire' ? 'is-retard' : 'is-bientot'}">${e.niveau === 'obligatoire' ? trad('Obligatoire') : trad('Recommandée')}</span></div>`).join('')}</section>`
      : `<div class="ui-encadre">${otSymbole('info')}<p>${trad('Aucune exigence pour cette machine : tout le monde peut intervenir. Ajoute-en depuis « Qualifications et habilitations ».')}</p></div>`;
    const lignes = equipe.map((m) => {
      const manquantes = Array.isArray(m.manquantes) ? m.manquantes : [];
      const detail = manquantes.length
        ? manquantes.map((x) => `${x.nom} (${x.etat === 'expiree' ? tR('expirée le {date}', { date: habDate(x.expire_le) }) : trad('absente')})`).join(', ')
        : '';
      return `<div class="hab-ligne"><div><strong>${esc(m.nom_affiche)}</strong>${detail ? `<span class="sig-meta">${esc(detail)}</span>` : ''}</div>
        <span class="ui-statut ${m.ok ? (manquantes.length ? 'is-bientot' : 'is-ok') : 'is-retard'}">${m.ok ? (manquantes.length ? trad('Habilité (recommandée manquante)') : trad('Habilité')) : trad('Non habilité')}</span></div>`;
    }).join('');
    overlay.querySelector('#hab-q-corps').innerHTML = `${exigHtml}
      <section class="otm-bloc"><h3 class="otm-bloc-titre">${otSymbole('groups')}<span>${trad('Équipe')}</span></h3>${lignes || `<p class="ui-aide">${trad('Aucun membre.')}</p>`}</section>`;
  } catch (err) { overlay.querySelector('#hab-q-corps').innerHTML = `<p class="ui-aide" style="color:var(--danger,#c0392b)">${esc((err && err.message) || trad('Chargement impossible.'))}</p>`; }
}

// ── « Mes habilitations » : chacun consulte les siennes (la politique du serveur ne lui montre rien d'autre) ──
async function ouvrirMesHabilitations() {
  if (!habilitationsActif()) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay otm-overlay';
  overlay.innerHTML = `
    <div class="modal otm sig-modal" role="dialog" aria-modal="true" aria-labelledby="hab-m-titre">
      <header class="otm-tete"><div class="otm-tuile">${otSymbole('workspace_premium')}</div>
        <div class="otm-tete-textes"><div class="otm-tete-ligne"><span class="otm-etape">${trad('Habilitations')}</span><span class="otm-marque">GMAO KALEA</span></div><h2 id="hab-m-titre">${trad('Mes habilitations')}</h2></div>
        <button type="button" class="otm-fermer" data-hab-fermer aria-label="${esc(trad('Fermer'))}">${otSymbole('close')}</button></header>
      <div class="otm-form-corps" id="hab-m-corps"><p class="ui-aide">${trad('Chargement…')}</p></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-hab-fermer]')) overlay.remove(); });
  try {
    const [hs, qs] = await Promise.all([
      sb.from('habilitations').select('id, qualification_id, obtenue_le, expire_le, verifie_a').eq('profil_id', UI.userId).order('expire_le', { ascending: true, nullsFirst: false }),
      sb.from('qualifications').select('id, nom'),
    ]);
    if (hs.error) throw hs.error;
    const noms = new Map((qs.data || []).map((q) => [q.id, q.nom]));
    const lignes = hs.data || [];
    overlay.querySelector('#hab-m-corps').innerHTML = lignes.length ? `<section class="otm-bloc">${lignes.map((h) => { const [cl, tx] = habEtat(h); return `
      <div class="hab-ligne"><div><strong>${esc(noms.get(h.qualification_id) || '—')}</strong><span class="sig-meta">${tR('Obtenue le {date}', { date: habDate(h.obtenue_le) })}${h.verifie_a ? ' · ' + trad('Vérifiée') : ''}</span></div><span class="ui-statut ${cl}">${esc(tx)}</span></div>`; }).join('')}</section>`
      : `<div class="ui-encadre">${otSymbole('info')}<p>${trad('Aucune habilitation enregistrée pour toi. Ton gérant les saisit.')}</p></div>`;
  } catch (err) { overlay.querySelector('#hab-m-corps').innerHTML = `<p class="ui-aide" style="color:var(--danger,#c0392b)">${esc((err && err.message) || trad('Chargement impossible.'))}</p>`; }
}

// ── Le bouton d'entrée, dans la page des ordres de travail ──
function blocHabilitationsHtml() {
  if (!habilitationsActif()) return '';
  return `<div class="ui-groupe ot-validation" id="hab-entree">
    <button type="button" class="ui-btn ui-btn-pastille" data-hab-ouvrir>${estGerant() ? trad('Qualifications et habilitations') : trad('Mes habilitations')}</button>
    <div class="ui-aide">${estGerant() ? trad('Qui est habilité à intervenir sur quelle machine : catalogue, habilitations des personnes, exigences par machine.') : trad('Tes qualifications et leur date de validité.')}</div>
  </div>`;
}
function brancherHabilitations(root) {
  const b = root && root.querySelector('[data-hab-ouvrir]');
  if (b) b.addEventListener('click', () => { if (estGerant()) ouvrirGestionHabilitations(); else ouvrirMesHabilitations(); });
}

// ── À l'assignation d'un ordre : ce qui manque à la personne choisie pour cette machine ──
// Rend { mode, ok, obligatoires: [...], recommandees: [...] } ou null (pas de règle, pas de réseau, pas de droit : l'enregistrement n'est jamais empêché par le contrôle lui-même).
async function controleHabilitationAssignation(profilId, machineId) {
  if (!habilitationsActif() || !profilId || !machineId) return null;
  try {
    const { data, error } = await sb.rpc('habilitations_controle', { p_profil: profilId, p_machine: machineId, p_date: null, p_qualifications: [] });
    if (error || !data || data.mode === 'aucun') return null;
    return data;
  } catch (err) { return null; }
}
// Le texte à afficher sous le champ « Assigné à » : { texte, bloquant, attention } ou null.
function messageHabilitationAssignation(c, nomPersonne) {
  if (!c) return null;
  const liste = (a) => a.map((x) => `${x.nom} (${x.etat === 'expiree' ? tR('expirée le {date}', { date: habDate(x.expire_le) }) : trad('absente')})`).join(', ');
  if (c.obligatoires.length) {
    return { bloquant: c.mode === 'bloquer', texte: tR('{nom} n\'a pas l\'habilitation obligatoire : {liste}.', { nom: nomPersonne, liste: liste(c.obligatoires) }) + (c.mode === 'bloquer' ? ' ' + trad('L\'ordre ne pourra pas lui être assigné.') : '') };
  }
  if (c.recommandees.length) return { bloquant: false, texte: tR('{nom} n\'a pas l\'habilitation recommandée : {liste}.', { nom: nomPersonne, liste: liste(c.recommandees) }) };
  return null;
}
