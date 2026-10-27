// ── FILE D'OPÉRATIONS (palier 3b du plan « hors-ligne », communication/plan-nouvelles-fonctionnalites-2026-10-27.md §5) ──────────────────────────────────
// Une action faite SANS RÉSEAU (enregistrer une intervention, signaler une panne) est gardée sur l'appareil, avec un identifiant unique, puis REJOUÉE dans
// l'ordre au retour du réseau. Rien n'est jamais perdu en silence, et rien n'est envoyé deux fois.
//
// COMMENT C'EST SANS DOUBLON
//   · chaque opération porte l'identifiant de la ligne qu'elle crée (intervention, panne) : le serveur le refuse ou le reconnaît au deuxième envoi ;
//   · une intervention est faite en ÉTAPES (intervention, pièces, compteurs, plan) ; l'avancement est écrit sur l'appareil après chaque étape : un rejeu reprend là où
//     la coupure a eu lieu ; les pièces ne sont ajoutées que si l'intervention n'en a pas déjà ;
//   · au rejeu, la machine est RELUE À NEUF sur le serveur : l'échéance du plan est recalculée sur son état réel d'aujourd'hui (jamais écrasée par une photo périmée),
//     et un compteur ne recule jamais (sauf relevé volontairement plus bas, confirmé à la saisie).
//
// POSSIBLE SANS RÉSEAU : intervention, panne, ordre de travail (démarrer, cocher, terminer), frais, mouvements de stock (sortie, entrée, transfert). Reste en ligne, et c'est dit :
// annuler / valider / refuser / modifier un ordre, un ajustement de stock, l'import CSV, les inventaires, la réception d'une commande.
// STOCK : jamais négatif. Si le stock ne suffit plus au retour du réseau, la fonction serveur refuse ; la sortie d'une intervention reste notée dans l'intervention (à régulariser à la main
// dans Stock, et la personne en est avertie), un mouvement seul reste « en erreur » dans « À envoyer ».
// ERREUR DÉFINITIVE (machine supprimée, droit retiré…) : l'opération passe « en erreur », reste visible, et l'utilisateur la relance ou l'abandonne. Jamais effacée seule.
// SANS INDEXEDDB : aucune opération hors-ligne n'est acceptée (une file en mémoire serait perdue à la fermeture : mieux vaut refuser que mentir).

function nouvelIdentifiant() {
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const h = () => Math.floor(Math.random() * 16).toString(16);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => (c === 'x' ? h() : ((Math.floor(Math.random() * 4)) + 8).toString(16)));
}

// Une erreur qui passera d'elle-même : réseau absent, serveur indisponible, session à renouveler. Elle ne marque JAMAIS une opération « en erreur ».
function estErreurTransitoire(erreur) {
  if (!erreur) return false;
  if (estErreurReseau(erreur)) return true;
  const texte = String(erreur.message || erreur || '') + ' ' + String(erreur.code || '') + ' ' + String(erreur.status || '');
  return /\b(502|503|504|429)\b|bad gateway|service unavailable|gateway time-?out|too many requests|jwt expired|jwt is expired/i.test(texte);
}

// ── Le magasin « file » (IndexedDB) ──
async function fileDisponible() { return Boolean(await copieBase()); }
async function fileToutes() {
  const r = await copieOperation('readonly', (st) => st.getAll(), FILE_MAGASIN);
  return (r && r.ok && Array.isArray(r.valeur)) ? r.valeur : [];
}
async function fileEcrire(op) {
  const r = await copieOperation('readwrite', (st) => st.put(op), FILE_MAGASIN);
  return Boolean(r && r.ok);
}
async function fileSupprimer(id) {
  await copieOperation('readwrite', (st) => st.delete(id), FILE_MAGASIN);
}
const fileEstMienne = (op) => op && op.companyId === UI.companyId && op.userId === UI.userId;
async function fileMiennes() {
  return (await fileToutes()).filter(fileEstMienne).sort((a, b) => a.creeA - b.creeA);
}

// Met une opération en file. Lance une erreur si l'appareil ne peut pas la garder durablement.
async function fileAjouter(type, payload, resume, etapes) {
  if (!(await fileDisponible())) throw new Error(trad('Ce navigateur ne peut pas garder l\'action sur l\'appareil : attends le réseau pour l\'enregistrer.'));
  const op = {
    id: nouvelIdentifiant(), type, companyId: UI.companyId, userId: UI.userId, creeA: Date.now(),
    payload, resume: resume || {}, etat: 'attente', etapes: { ...(etapes || {}) }, tentatives: 0, erreur: null,
  };
  if (!(await fileEcrire(op))) throw new Error(trad('L\'appareil n\'a pas pu garder l\'action (stockage plein ou refusé).'));
  await fileMajCompte();
  return op;
}

// ── Les traitements, un par type d'opération ──
// Rejeu d'une intervention : machine relue à neuf, mêmes étapes que l'enregistrement en ligne, avancement noté après chaque étape.
async function fileTraiterIntervention(op) {
  const machine = await chargerMachineFraiche(op.payload.machineId);
  if (!machine) throw new Error(trad('La machine n\'existe plus ou n\'est plus accessible.'));
  return executerIntervention(machine, op.payload.saisie, { etapes: op.etapes, sauver: () => fileEcrire(op) }, true);
}
// Rejeu d'une panne : l'identifiant évite le doublon (signaler_panne à 5 arguments) ; avant l'exécution de hors-ligne-idempotence.sql, repli sur l'ancien appel.
async function envoyerPanne(p) {
  const args = { p_machine_id: p.machineId, p_description: p.description, p_severity: p.severity, p_stopped: p.stopped };
  let { error } = await sb.rpc('signaler_panne', { ...args, p_id: p.id });
  if (error && (error.code === 'PGRST202' || /could not find the function|schema cache/i.test(String(error.message || '')))) {
    ({ error } = await sb.rpc('signaler_panne', args));
  }
  if (error) throw error;
}
async function fileTraiterPanne(op) { await envoyerPanne(op.payload); }
// Rejeu d'une action sur un ordre : démarrer, cocher une tâche, terminer SANS intervention (ou après une intervention déjà écrite). Les fonctions serveur sont rejouables
// (le même démarrage ou la même case cochée deux fois ne change rien). Cocher se fait par POSITION : on vérifie d'abord que la tâche est toujours à la même place.
async function fileTraiterOrdre(op) {
  const p = op.payload;
  if (p.action === 'cocher') {
    const { data, error } = await sb.from('work_orders').select('checklist').eq('id', p.ordreId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(trad('L\'ordre n\'existe plus ou n\'est plus accessible.'));
    const tache = (data.checklist || [])[p.index];
    if (!tache || tache.label !== p.label) throw new Error(tR('L\'ordre a été modifié entre-temps : la tâche « {t} » n\'est plus à la même place.', { t: p.label }));
    const { error: e1 } = await sb.rpc('ordre_travail_cocher', { p_id: p.ordreId, p_index: p.index, p_fait: p.fait });
    if (e1) throw e1;
  } else if (p.action === 'demarrer') {
    const { error } = await sb.rpc('ordre_travail_agir', { p_id: p.ordreId, p_action: 'demarrer', p_note: null });
    if (error) throw error;
  } else if (p.action === 'terminer') {
    const { error } = await sb.rpc('ordre_travail_terminer', { p_id: p.ordreId, p_intervention: p.interventionId || null });
    if (error) throw error;
  } else throw new Error(trad('Type d\'action inconnu (application plus ancienne ?)'));
}
// Frais (carburant, transport, contrôle…) : une ligne ajoutée à operating_costs. Identifiant fourni par l'appareil ; si la table ne l'accepte pas, repli sur l'insertion
// simple (sans protection contre un renvoi après réponse perdue).
async function envoyerFrais(ligne) {
  let { error } = await sb.from('operating_costs').insert(ligne);
  if (error && /generated|non-DEFAULT|428C9|22P02|invalid input syntax|PGRST204|could not find the .* column/i.test(String(error.message || '') + String(error.code || ''))) {
    const { id: _ignore, ...sansId } = ligne;
    ({ error } = await sb.from('operating_costs').insert(sansId));
  }
  if (error && error.code !== '23505') throw error;
}
async function fileTraiterFrais(op) { await envoyerFrais(op.payload.ligne); }

// Mouvement de stock : TOUJOURS par la fonction rejouable (hors-ligne-stock.sql) quand un identifiant est fourni — un renvoi ne sort jamais la pièce deux fois. Avant l'exécution
// de ce SQL, repli sur la fonction d'origine (le mouvement part, sans protection anti-doublon). Les règles (droits, stock suffisant…) sont celles de la fonction de production :
// un refus remonte tel quel.
async function envoyerMouvementStock(args, idOp) {
  if (!idOp) {
    const { error } = await sb.rpc('enregistrer_mouvement_stock', args);
    if (error) throw error;
    return;
  }
  let { error } = await sb.rpc('enregistrer_mouvement_stock_rejouable', { p_client_op_id: idOp, ...args });
  if (error && (error.code === 'PGRST202' || /could not find the function|schema cache/i.test(String(error.message || '')))) {
    ({ error } = await sb.rpc('enregistrer_mouvement_stock', args));
  }
  if (error) throw error;
}
async function fileTraiterStock(op) { await envoyerMouvementStock(op.payload.args, op.payload.idOp); }
const FILE_TRAITEMENTS = { intervention: fileTraiterIntervention, panne: fileTraiterPanne, ordre: fileTraiterOrdre, frais: fileTraiterFrais, stock: fileTraiterStock, signature: (op) => fileTraiterSignature(op) };   // app-20 est chargé après ce fichier : appel différé

// ── La synchronisation ──
let __fileEnCours = false;
// Rejoue les opérations de la personne connectée, dans l'ordre. S'arrête au premier souci de RÉSEAU (on réessaiera) ; une erreur DÉFINITIVE marque l'opération
// « en erreur » et passe à la suivante. Rend { envoyees, erreurs, interrompu }.
async function fileSynchroniser() {
  if (__fileEnCours) return { occupe: true, envoyees: 0, erreurs: 0 };
  __fileEnCours = true;
  let envoyees = 0; let erreurs = 0; let interrompu = false; let sortiesRefusees = 0;
  try {
    const { data } = await sb.auth.getSession();
    if (!data || !data.session) return { envoyees, erreurs, sansSession: true };
    for (const op of await fileMiennes()) {
      if (op.etat === 'erreur') continue;                       // attend la décision de l'utilisateur (Réessayer / Abandonner)
      const traitement = FILE_TRAITEMENTS[op.type];
      if (!traitement) { op.etat = 'erreur'; op.erreur = trad('Type d\'action inconnu (application plus ancienne ?)'); await fileEcrire(op); erreurs++; continue; }
      try {
        const resultat = await traitement(op);
        sortiesRefusees += (resultat && resultat.sortiesRefusees) || 0;
        await fileSupprimer(op.id);
        envoyees++;
      } catch (err) {
        if (estErreurTransitoire(err)) { op.tentatives = (op.tentatives || 0) + 1; await fileEcrire(op); interrompu = true; break; }
        op.etat = 'erreur';
        op.erreur = String((err && err.message) || err || trad('Erreur inconnue')).slice(0, 300);
        await fileEcrire(op);
        erreurs++;
      }
    }
  } finally {
    __fileEnCours = false;
    await fileMajCompte();
  }
  return { envoyees, erreurs, interrompu, sortiesRefusees };
}

// Synchronise puis, si quelque chose est parti, recharge les données (échéances, compteurs) et le dit.
async function fileSynchroniserEtRafraichir() {
  const r = await fileSynchroniser();
  // Une sortie de stock refusée à la synchronisation (stock devenu insuffisant) ne se perd JAMAIS en silence : la pièce reste notée dans l'intervention, et on le dit.
  const avertissement = r.sortiesRefusees ? ' — ' + tR('{n} sortie(s) de stock refusée(s) (stock insuffisant) : à enregistrer à la main dans Stock.', { n: r.sortiesRefusees }) : '';
  if (r.envoyees > 0) {
    boot(tR('{n} action(s) envoyée(s) au serveur', { n: r.envoyees }) + avertissement);
  } else if (r.erreurs > 0 && typeof showToast === 'function') {
    showToast(tR('{n} action(s) n\'ont pas pu être envoyées : voir « À envoyer »', { n: r.erreurs }));
  }
  return r;
}

// ── Le nombre d'opérations en attente, et le bandeau ──
async function fileMajCompte() {
  const miennes = await fileMiennes();
  UI.fileEnAttente = miennes.filter((o) => o.etat !== 'erreur').length;
  UI.fileEnErreur = miennes.filter((o) => o.etat === 'erreur').length;
  // Les ordres qui ont une action en attente d'envoi (affichés « À envoyer » dans la liste et la fiche).
  UI.fileOrdres = new Set(miennes.map((o) => (o.type === 'ordre' ? o.payload.ordreId : (o.type === 'intervention' ? (o.payload.saisie || {}).ordreId : null))).filter(Boolean));
  majBandeauFile();
}
function bandeauFileHtml() {
  const n = (UI.fileEnAttente || 0) + (UI.fileEnErreur || 0);
  if (!n) return '';
  const texte = UI.fileEnErreur
    ? tR('{n} action(s) à envoyer, dont {e} en erreur.', { n, e: UI.fileEnErreur })
    : tR('{n} action(s) enregistrée(s) sur l\'appareil, en attente d\'envoi.', { n });
  return `<div class="offline-banner file-banniere" id="bandeau-file" role="status">
    <span>${esc(texte)}</span>
    <span class="file-banniere-actions">
      ${UI.fileEnAttente && navigator.onLine !== false ? `<button type="button" class="link-inline" data-file-envoyer>${trad('Envoyer maintenant')}</button>` : ''}
      <button type="button" class="link-inline" data-file-voir>${trad('Voir')}</button>
    </span>
  </div>`;
}
// Remet le bandeau à jour sans refaire tout l'écran.
function majBandeauFile() {
  const vue = document.querySelector('.content .view');
  if (!vue) return;
  const ancien = vue.querySelector('#bandeau-file');
  if (ancien) ancien.remove();
  const html = bandeauFileHtml();
  if (!html) return;
  const hors = vue.querySelector('.offline-banner');
  if (hors) hors.insertAdjacentHTML('afterend', html); else vue.insertAdjacentHTML('afterbegin', html);
}

// ── L'écran « À envoyer » : ce qui attend, ce qui est en erreur, avec Réessayer / Abandonner ──
function fileLibelleOperation(op) {
  const r = op.resume || {};
  const quand = new Date(op.creeA).toLocaleString(localeActive(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const quoi = ({ panne: trad('Panne signalée'), ordre: trad('Ordre de travail'), frais: trad('Frais saisi'), stock: trad('Mouvement de stock'), signature: trad('Signature') })[op.type] || trad('Intervention enregistrée');
  return { titre: `${quoi} · ${r.machine || trad('Machine')}`, sous: quand + (r.detail ? ' · ' + r.detail : '') };
}
async function ouvrirFileOperations() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal export-modal file-modal" role="dialog" aria-modal="true" aria-labelledby="file-titre">
      <h2 id="file-titre">${trad('À envoyer')}</h2>
      <p class="sub">${trad('Ces actions ont été faites sans réseau. Elles partent toutes seules dès que la connexion revient.')}</p>
      <div id="file-liste"></div>
      <div class="modal-actions">
        <button type="button" class="ui-btn ui-btn-plein" id="file-envoyer">${trad('Envoyer maintenant')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  ajouterCroixModale(overlay);
  const liste = overlay.querySelector('#file-liste');
  const dessiner = async () => {
    const ops = await fileMiennes();
    liste.innerHTML = ops.length ? `<div class="ui-liste">${ops.map((op) => {
      const t = fileLibelleOperation(op);
      return `<div class="ui-ligne is-deux${op.etat === 'erreur' ? ' is-retard' : ''}">
        <div class="ui-ligne-id"><div class="ui-ligne-textes"><span class="ui-ligne-nom">${esc(t.titre)}</span><span class="ui-ligne-sous">${esc(t.sous)}</span>${op.etat === 'erreur' ? `<span class="ui-ligne-sous">${esc(op.erreur || '')}</span>` : ''}</div></div>
        <div class="ui-ligne-action">
          ${op.etat === 'erreur' ? `<button type="button" class="ui-btn ui-btn-pastille" data-file-reessayer="${esc(op.id)}">${trad('Réessayer')}</button>` : `<span class="ui-statut is-bientot">${trad('En attente')}</span>`}
          <button type="button" class="ui-btn ui-btn-pastille is-danger" data-file-abandonner="${esc(op.id)}">${trad('Abandonner')}</button>
        </div>
      </div>`;
    }).join('')}</div>` : `<p class="ui-aide">${trad('Rien en attente : tout est envoyé.')}</p>`;
    overlay.querySelector('#file-envoyer').disabled = !ops.some((o) => o.etat !== 'erreur');
  };
  await dessiner();
  overlay.addEventListener('click', async (e) => {
    const rejouer = e.target.closest('[data-file-reessayer]');
    const abandon = e.target.closest('[data-file-abandonner]');
    if (e.target.closest('#file-envoyer')) { overlay.remove(); fileSynchroniserEtRafraichir(); return; }
    if (rejouer) {
      const op = (await fileMiennes()).find((o) => o.id === rejouer.getAttribute('data-file-reessayer'));
      if (op) { op.etat = 'attente'; op.erreur = null; await fileEcrire(op); overlay.remove(); fileSynchroniserEtRafraichir(); }
      return;
    }
    if (abandon) {
      if (!window.confirm(trad('Abandonner cette action ? Elle ne sera jamais envoyée.'))) return;
      await fileSupprimer(abandon.getAttribute('data-file-abandonner'));
      await fileMajCompte();
      await dessiner();
    }
  });
}

// Déconnexion : ce qui attend d'être envoyé serait PERDU. On demande, jamais en silence.
async function fileConfirmerDeconnexion() {
  const restantes = await fileMiennes();
  if (!restantes.length) return true;
  if (!window.confirm(tR('{n} action(s) n\'ont pas encore été envoyées et seront PERDUES si tu te déconnectes. Te déconnecter quand même ?', { n: restantes.length }))) return false;
  for (const op of restantes) await fileSupprimer(op.id);
  UI.fileEnAttente = 0; UI.fileEnErreur = 0;
  return true;
}

// ── Mise en route : après le démarrage, et au retour du réseau ──
let __fileInitialisee = false;
async function fileInitialiser() {
  await fileMajCompte();
  if (!__fileInitialisee) {
    __fileInitialisee = true;
    window.addEventListener('online', () => { fileSynchroniserEtRafraichir(); });
    window.addEventListener('offline', () => majBandeauFile());
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-file-envoyer]')) fileSynchroniserEtRafraichir();
      else if (e.target.closest('[data-file-voir]')) ouvrirFileOperations();
    });
    setInterval(() => { if (navigator.onLine !== false && UI.fileEnAttente) fileSynchroniserEtRafraichir(); }, 60000);
  }
  if (UI.fileEnAttente && navigator.onLine !== false) fileSynchroniserEtRafraichir();
}

// ── L'INTERVENTION, EN ÉTAPES REJOUABLES ──
// `s` (la saisie) ne contient que des VALEURS, jamais le formulaire : c'est ce qui est gardé sur l'appareil. `suivi.etapes` note ce qui est déjà fait ;
// `suivi.sauver()` (facultatif) l'écrit après chaque étape. `differe` = rejeu après coup (compteurs prudents).
// Les étapes sont celles de l'enregistrement d'origine, dans le même ordre ; seules deux choses sont nouvelles : l'identifiant fourni par l'appareil, et la reprise.
function calculerMajPlan(machine, s) {
  const planUpdate = {};
  if (!machine.plan || !machine.plan.id) return planUpdate;
  const isCounter = planIsCounter(machine.plan);
  const planItems = tachesAffichees(machine.plan, machine);
  const items = planItems.length
    ? planItems.map((it) => it.label).filter(Boolean)
    : (machine.plan.tasks || '').split(',').map((t) => t.trim()).filter(Boolean);
  // UNE ÉCHÉANCE PAR TÂCHE : seules les tâches cochées avancent, et l'échéance du plan est le minimum de ses tâches comparables (voir l'historique de ce code).
  const suivi = tachesApresEntretien(planItems, machine.plan, machine, s.checkedItems, s.hoursValue, s.performedAt, s.hoursValue2);
  if (suivi) {
    planUpdate.items = suivi.items;
    Object.assign(planUpdate, echeancePlanPatch(suivi.echeance, machine.plan));
    if (modeSecondaireDe(machine)) Object.assign(planUpdate, echeancePlanPatch2(suivi.echeanceSecondaire, machine));
  } else if (journalAvanceEcheance(items, s.checkedItems)) {
    // Plan sans élément détaillé : comportement d'avant, inchangé.
    if (isCounter) {
      const interval = planIntervalCounter(machine.plan) || FALLBACK_INTERVAL_HOURS;
      Object.assign(planUpdate, planNextDueCounterPatch((s.hoursValue || 0) + interval));
    } else {
      planUpdate.next_due_at = addDaysIso(s.performedAt, machine.plan.interval_days || FALLBACK_INTERVAL_DAYS);
    }
  }
  return planUpdate;
}

async function executerIntervention(machine, s, suivi, differe) {
  const fait = (nom) => suivi.etapes[nom] === true;
  const sauver = async () => { if (typeof suivi.sauver === 'function') await suivi.sauver(); };
  const marquer = async (nom) => { suivi.etapes[nom] = true; await sauver(); };
  const isCounter = planIsCounter(machine.plan);
  let sortiesRefusees = 0;

  // 1. L'intervention. Identifiant fourni par l'appareil : un deuxième envoi (23505) veut dire « déjà écrite » — on continue avec les étapes suivantes.
  if (!fait('intervention')) {
    const ligne = {
      id: s.idIntervention,
      machine_id: machine.id,
      plan_id: (machine.plan && machine.plan.id) || null,
      performed_at: s.performedAt,
      hours_at_intervention: s.hoursValue,
      ...(s.avecCompteur2 ? { hours_at_intervention_2: s.hoursValue2 } : {}),
      description: s.notes || null,
      items_done: s.checkedItems.length ? s.checkedItems : null,
      performed_by: s.operateur,
      ...(s.avecTypes ? { kind: s.kind, component: s.composant, severity: s.severite } : {}),
      // Respect du plan : l'état de la machine AVANT cette saisie, relevé au moment de la saisie.
      ...(s.wasLate === true || s.wasLate === false ? { was_late: s.wasLate } : {}),
      ...(s.avecCouts ? { parts_cost: s.partsCost, labor_cost: s.laborCost, labor_hours: s.laborHours } : {}),
    };
    let { error } = await sb.from('interventions').insert(ligne);
    // Colonne d'identifiant « générée toujours » (peu probable) : on retombe sur l'ancien comportement, sans identifiant fourni.
    if (error && /generated|non-DEFAULT|428C9/i.test(String(error.message || '') + String(error.code || ''))) {
      const { id: _ignore, ...sansId } = ligne;
      ({ error } = await sb.from('interventions').insert(sansId));
    }
    if (error && error.code !== '23505') throw error;
    await marquer('intervention');
  }

  // 2. Détail des pièces (hors sorties de stock) : jamais bloquant, mais jamais en double — on n'ajoute que si l'intervention n'en a pas encore.
  if (s.avecCouts && s.lignesLibres.length && !fait('pieces')) {
    const { data: deja, error: errLire } = await sb.from('intervention_parts').select('id').eq('intervention_id', s.idIntervention).limit(1);
    if (errLire && estErreurTransitoire(errLire)) throw errLire;
    if (!errLire && !(deja && deja.length)) {
      const { error: piecesErr } = await sb.from('intervention_parts').insert(s.lignesLibres.map((l) => ({
        intervention_id: s.idIntervention, part_id: l.partId, designation: l.designation, quantity: l.quantity, unit_price: l.unitPrice,
      })));
      if (piecesErr) {
        if (estErreurTransitoire(piecesErr)) throw piecesErr;
        console.warn('Détail des pièces non enregistré :', piecesErr.message);
      }
    }
    await marquer('pieces');
  }

  // 3. Sorties de stock liées à l'intervention (rejouables : identifiant par ligne, voir hors-ligne-stock.sql). La fonction serveur écrit la ligne de pièce ET ajoute son coût (PUMP).
  // Une sortie refusée (stock épuisé entre-temps…) ne fait JAMAIS perdre la pièce : elle est remise dans l'intervention à son prix saisi.
  if (s.lignesSortie.length) {
    const echouees = [];
    for (let i = 0; i < s.lignesSortie.length; i++) {
      const l = s.lignesSortie[i];
      const cle = 'sortie' + i;
      if (suivi.etapes[cle] === true) continue;
      if (suivi.etapes[cle] === 'refusee') { echouees.push(l); continue; }
      let sortieErr = null;
      try {
        await envoyerMouvementStock({
          p_type: 'sortie', p_part_id: l.partId, p_warehouse_id: l.magasinId, p_destination_warehouse_id: null,
          p_quantity: l.quantity, p_unit_cost: null, p_intervention_id: s.idIntervention,
          p_reason: tR('Intervention sur {machine}', { machine: s.nomMachine }),
        }, l.idOp || null);
      } catch (err) { sortieErr = err; }
      if (sortieErr) {
        if (estErreurTransitoire(sortieErr)) throw sortieErr;
        echouees.push(l); suivi.etapes[cle] = 'refusee'; console.warn('Sortie de stock refusée :', sortieErr.message);
      } else suivi.etapes[cle] = true;
      await sauver();
    }
    sortiesRefusees = echouees.length;
    if (echouees.length && !fait('sorties-refusees-reportees')) {
      await sb.from('intervention_parts').insert(echouees.map((l) => ({
        intervention_id: s.idIntervention, part_id: l.partId, designation: l.designation, quantity: l.quantity, unit_price: l.unitPrice,
      })));
      const { data: courant } = await sb.from('interventions').select('parts_cost').eq('id', s.idIntervention).single();
      const supplement = echouees.reduce((somme, l) => somme + l.quantity * l.unitPrice, 0);
      await sb.from('interventions').update({ parts_cost: (Number(courant && courant.parts_cost) || 0) + supplement }).eq('id', s.idIntervention);
      await marquer('sorties-refusees-reportees');
    }
  }

  // 4. Compteurs. En rejeu après coup, un compteur ne RECULE jamais (un relevé plus récent a pu être fait depuis) — sauf relevé volontairement plus bas, confirmé à la saisie.
  if (isCounter && s.hoursValue != null && !fait('compteur')) {
    let req = sb.from('machines').update(machineCounterPatch(s.hoursValue, machine)).eq('id', machine.id);
    if (differe && !s.releveRecule) {
      const col = SCHEMA.hasCounter ? 'counter_value' : 'current_hours';
      req = req.or(`${col}.is.null,${col}.lt.${s.hoursValue}`);
    }
    const { error: machErr } = await req;
    if (machErr) throw machErr;
    await marquer('compteur');
  }
  if (s.avecCompteur2 && s.hoursValue2 != null && !fait('compteur2')) {
    let req = sb.from('machines').update(machineCounter2Patch(s.hoursValue2, s.unite2)).eq('id', machine.id);
    if (differe && !s.releveRecule) req = req.or(`counter_value_2.is.null,counter_value_2.lt.${s.hoursValue2}`);
    const { error: mach2Err } = await req;
    if (mach2Err) throw mach2Err;
    await marquer('compteur2');
  }

  // 5. L'échéance du plan, recalculée sur la machine telle qu'elle est (en rejeu : relue à neuf).
  if (machine.plan && machine.plan.id && !fait('plan')) {
    const planUpdate = calculerMajPlan(machine, s);
    if (Object.keys(planUpdate).length) {
      const { error: planErr } = await sb.from('maintenance_plans').update(planUpdate).eq('id', machine.plan.id);
      if (planErr) throw planErr;
    }
    await marquer('plan');
  }
  // 6. Clôture de l'ordre de travail, SEULEMENT pour une intervention mise en file (saisie.ordreId) : en ligne, c'est la fenêtre de l'ordre qui s'en charge (onSaved).
  if (s.ordreId && !fait('ordre')) {
    const { error: ordreErr } = await sb.rpc('ordre_travail_terminer', { p_id: s.ordreId, p_intervention: s.idIntervention });
    if (ordreErr) throw ordreErr;
    await marquer('ordre');
  }
  return { sortiesRefusees };
}

// ── Sans réseau : mise en file + effet immédiat sur l'écran ──
// La copie du démarrage suit aussi, pour qu'un rechargement hors connexion montre la même chose.
function memoriserMachineDansCopie(machine) {
  const cache = lireCache();
  if (!cache) return;
  const i = (cache.machines || []).findIndex((m) => m && m.id === machine.id);
  if (i < 0) return;
  cache.machines[i] = machine;
  ecrireInstantane({ ...cache, schema: { ...SCHEMA } });     // savedAt conservé : la copie n'est pas plus fraîche
}
function appliquerInterventionLocalement(machine, s) {
  const majPlan = calculerMajPlan(machine, s);                // calculé AVANT de toucher la machine, comme en ligne
  if (planIsCounter(machine.plan) && s.hoursValue != null) Object.assign(machine, machineCounterPatch(s.hoursValue, machine));
  if (s.avecCompteur2 && s.hoursValue2 != null) Object.assign(machine, machineCounter2Patch(s.hoursValue2, s.unite2));
  if (machine.plan && Object.keys(majPlan).length) Object.assign(machine.plan, majPlan);
  memoriserMachineDansCopie(machine);
}
async function mettreInterventionEnFile(machine, saisie, etapes) {
  const op = await fileAjouter('intervention', { machineId: machine.id, saisie }, { machine: machine.name, detail: saisie.kind === 'depannage' ? trad('Dépannage') : trad('Entretien') }, etapes);
  appliquerInterventionLocalement(machine, saisie);
  appliquerSortiesLocalement(saisie.lignesSortie);
  return op;
}
// ── Le stock, sans réseau ──
// Ce que l'écran (et la copie hors connexion) montre tout de suite : le solde bouge, pour qu'on ne puisse pas sortir deux fois la même pièce en local. Le coût moyen n'est
// recalculé que par le serveur ; les lignes de stock affichent le solde réel dès la prochaine lecture.
function stockAppliquerLocalement(args) {
  const q = Number(args.p_quantity) || 0;
  const lignes = UI.stockItems || (UI.stockItems = []);
  const bouger = (pieceId, magasinId, delta) => {
    let it = lignes.find((x) => String(x.part_id) === String(pieceId) && String(x.warehouse_id) === String(magasinId));
    if (!it) {
      if (delta <= 0) return;
      it = { id: null, part_id: pieceId, warehouse_id: magasinId, quantity: 0, pump_unit_cost: Number(args.p_unit_cost) || 0, reorder_point: null, updated_at: new Date().toISOString() };
      lignes.push(it);
    }
    it.quantity = (Number(it.quantity) || 0) + delta;
  };
  if (args.p_type === 'sortie') bouger(args.p_part_id, args.p_warehouse_id, -q);
  else if (args.p_type === 'entree') bouger(args.p_part_id, args.p_warehouse_id, q);
  else if (args.p_type === 'transfert') { bouger(args.p_part_id, args.p_warehouse_id, -q); bouger(args.p_part_id, args.p_destination_warehouse_id, q); }
  else if (args.p_type === 'ajustement') bouger(args.p_part_id, args.p_warehouse_id, q);
  if (typeof calculerStockCounts === 'function') UI.stockCounts = calculerStockCounts(lignes, UI.partsCatalog);
  const cache = lireCache();
  if (cache) ecrireInstantane({ ...cache, stockItems: lignes, schema: { ...SCHEMA } });   // savedAt conservé
}
async function mettreMouvementStockEnFile(args, idOp) {
  const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(args.p_part_id));
  const op = await fileAjouter('stock', { args, idOp }, {
    machine: piece ? (piece.designation || piece.reference || '') : '',
    detail: ({ sortie: trad('Sortie'), entree: trad('Entrée'), transfert: trad('Transfert'), ajustement: trad('Ajustement') })[args.p_type] + ' × ' + args.p_quantity,
  });
  stockAppliquerLocalement(args);
  return op;
}
function appliquerSortiesLocalement(lignesSortie) {
  (lignesSortie || []).forEach((l) => stockAppliquerLocalement({ p_type: 'sortie', p_part_id: l.partId, p_warehouse_id: l.magasinId, p_quantity: l.quantity }));
}

async function mettreFraisEnFile(machine, ligne) {
  return fileAjouter('frais', { machineId: machine.id, ligne }, { machine: machine.name, detail: typeof formatMontant === 'function' ? formatMontant(ligne.amount) : String(ligne.amount) });
}

// ── Les ordres de travail, sans réseau ──
// L'ordre tel qu'il est APRÈS l'action (ce que l'écran montre tout de suite, et ce que la copie hors connexion montrera).
function ordreApresActionLocale(o, a) {
  const maintenant = new Date().toISOString();
  const demarre = o.statut === 'a_faire' ? { statut: 'en_cours', demarre_a: o.demarre_a || maintenant } : {};
  if (a.action === 'demarrer') return { ...o, ...demarre };
  if (a.action === 'cocher') return { ...o, ...demarre, checklist: (o.checklist || []).map((t, i) => (i === a.index ? { ...t, fait: a.fait } : t)) };
  if (a.action === 'terminer') return { ...o, statut: 'termine', termine_a: maintenant, intervention_id: a.interventionId || o.intervention_id || null };
  return o;
}
function ordreAppliquerLocalement(o, a) {
  const neuf = ordreApresActionLocale(o, a);
  if (typeof otMettreAJour === 'function') otMettreAJour(neuf);
  copieModifierLecture('ordres', (d) => { const i = (d.ordres || []).findIndex((x) => x.id === neuf.id); if (i >= 0) d.ordres[i] = neuf; });
  return neuf;
}
// Met l'action en file ; renvoie l'ordre mis à jour localement. Cocher : une seule opération par tâche (le dernier clic gagne), pas dix lignes pour dix clics.
async function mettreOrdreEnFile(o, a) {
  const memes = (await fileMiennes()).filter((op) => op.type === 'ordre' && op.etat === 'attente' && op.payload.ordreId === o.id);
  const doublon = memes.find((op) => op.payload.action === a.action && (a.action !== 'cocher' || op.payload.index === a.index));
  if (doublon && a.action === 'cocher') { doublon.payload.fait = a.fait; await fileEcrire(doublon); await fileMajCompte(); }
  else if (!doublon) {
    const m = (UI.machines || []).find((x) => String(x.id) === String(o.machine_id));
    const detail = { demarrer: trad('Démarrer'), cocher: trad('Tâche cochée'), terminer: trad('Terminer') }[a.action] || a.action;
    await fileAjouter('ordre', { ordreId: o.id, ...a }, { machine: m ? m.name : '', detail: `OT-${o.numero} · ${detail}` });
  }
  return ordreAppliquerLocalement(o, a);
}

async function mettrePanneEnFile(machine, panne) {
  return fileAjouter('panne', { machineId: machine.id, ...panne }, { machine: machine.name, detail: panne.description.slice(0, 60) });
}
