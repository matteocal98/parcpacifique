/* KALEA — application (app.html) : Fiche machine, interventions, choix de la fréquence d'une tâche.
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · TCO flotte (phase 2) — fetch en masse
 *   · Choix de la fréquence d'une tâche
 */
// ───────────────────────── début du code ─────────────────────────
// ── TCO flotte (phase 2) — fetch en masse ────────────────────────
// Jusqu'ici (fetchAllInterventions/fetchOperatingCosts ci-dessus)
// toujours UNE machine à la fois. Le classement flotte a besoin des coûts
// de TOUTES les machines de la société : deux nouvelles fonctions, même
// pagination (PostgREST plafonne à 1000 lignes), colonnes réduites au
// strict nécessaire à l'agrégat — pas description/items_done/notes, qui
// ne serviraient à rien ici et alourdiraient la requête pour rien.
// `performed_at`/`incurred_at` (phase 3) : nécessaires au filtre de
// période de la page Coûts & TCO — filtré ensuite entièrement en mémoire,
// jamais un second fetch par changement de filtre. `labor_hours` (phase 3)
// : somme réelle affichée dans la légende du donut (heures MO déclarées).
async function fetchToutesInterventionsFlotte(machineIds) {
  if (!machineIds || !machineIds.length) return [];
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb.from('interventions')
      .select('machine_id, parts_cost, labor_cost, labor_hours, performed_at')
      .in('machine_id', machineIds)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}
async function fetchTousCoutsExploitationFlotte(machineIds) {
  if (!machineIds || !machineIds.length) return [];
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    // `kind` est nécessaire pour ventiler le carburant dans le rapport TCO
    // (evolutionOpexParTrimestre) — sans lui, la série « Carburant » du
    // graphique trimestriel serait à zéro partout, un chiffre faux plutôt
    // qu'une absence de données.
    const { data, error } = await sb.from('operating_costs')
      .select('machine_id, amount, incurred_at, kind')
      .in('machine_id', machineIds)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}
// Regroupe une liste plate { machine_id, ... } en Map(machine_id -> [lignes])
// — même forme que ce qu'attendent tcoMachine()/coutsInterventionsMachine()
// pour une seule machine, réutilisable telle quelle par machine une fois
// regroupée.
function grouperParMachine(lignes) {
  const carte = new Map();
  (lignes || []).forEach((ligne) => {
    const id = ligne.machine_id;
    if (!carte.has(id)) carte.set(id, []);
    carte.get(id).push(ligne);
  });
  return carte;
}

// ── Choix de la fréquence d'une tâche ────────────────────────────
// Le carnet propose PLUSIEURS fréquences selon l'usage (« Professionnel :
// 3 mois / Partiel : 6 mois / Occasionnel : 1 an »), ou une fréquence exprimée
// dans une unité qui n'est pas celle du plan (« ou 2 ans » sur un compteur
// horaire). On demande à l'utilisateur au lieu de deviner : le choix part en
// base dans les éléments du plan, la tâche entre aussitôt dans le calcul de
// l'échéance, et l'échéance du plan est recalculée.
//
// Rien n'est inventé, et rien n'est perdu :
//   • une option DU CARNET hors de l'unité du plan reste un point de contrôle ;
//   • une valeur LIBRE est un vrai intervalle dans son unité : la tâche reçoit sa
//     propre échéance, même si cette unité n'est pas celle du plan (elle ne
//     compte alors pas dans l'échéance globale, et l'écran le dit).
// SECOND SUIVI AUTOMATIQUE. Choisir une fréquence dans une unité que la machine ne suit pas
// (20 000 km sur une machine suivie au calendrier…) laissait la tâche en simple point de
// contrôle, « Retenu : 20 000 km — non suivi automatiquement ». Désormais le second suivi
// qu'il faut est ajouté TOUT SEUL, et la tâche est suivie. Seule question : le relevé actuel
// d'un compteur (km ou heures), qu'on ne peut pas inventer ; un second suivi calendaire
// n'en demande aucune. Cas non couvert : la machine a déjà un second suivi d'une autre
// unité (pas de troisième) — la tâche reste alors un point de contrôle, et la carte le dit.
//   → 'km' | 'hours' | 'days' : le second suivi à ajouter, ou null s'il n'y a rien à ajouter.
function modeSecondaireRequis(unite, plan, machine) {
  if (!SCHEMA.hasCounter2 || modeSecondaireDe(machine)) return null;
  if (uniteCompatiblePlan(unite, plan, machine)) return null;
  const info = UNITES_INTERVALLE[unite];
  if (!info) return null;
  if (info.genre === 'date') return 'days';
  return (unite === 'km' || unite === trad('km')) ? 'km' : 'hours';
}

// Petite note sous une option de fréquence : dit ce qui va se passer si elle est choisie.
function noteFrequenceHorsPlan(unite, plan, machine, unitePlanTexte) {
  if (uniteCompatiblePlan(unite, plan, machine)) return '';
  if (uniteCompatibleCompteur2(unite, machine) || uniteCompatibleCalendaireSecondaire(unite, machine)) return '';
  const mode = modeSecondaireRequis(unite, plan, machine);
  if (mode) {
    const nom = mode === 'km' ? trad('kilométrique') : (mode === 'hours' ? trad('horaire') : trad('calendaire'));
    return `<div class="hint">${tR('Un suivi {nom} sera ajouté automatiquement à la machine.', { nom })}</div>`;
  }
  return `<div class="hint">${tR('Pas dans l\'unité de ce plan ({unitePlan}) : la tâche restera un point de contrôle, sans échéance automatique.', { unitePlan: unitePlanTexte })}</div>`;
}

// Demande LE relevé actuel du compteur qu'on ajoute, rien d'autre. `confirmer(valeur)` fait le
// travail (écriture ou simple prise en compte) ; une erreur s'affiche ici et on peut réessayer.
function demanderReleveSecondSuivi(mode, confirmer, valeurInitiale) {
  const km = mode === 'km';
  const overlay = document.createElement('div');
  overlay.className = 'overlay choix-modal second-compteur-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal">
      <div class="mform-tete">
        <div class="mform-tete-titre"><h2>${km ? trad('Ajouter un suivi kilométrique') : trad('Ajouter un compteur horaire')}</h2></div>
        <button type="button" class="mform-close" id="second-compteur-close-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
      </div>
      <p class="sub">${km
        ? trad('Cette fréquence est en kilomètres, mais la machine n\'est pas encore suivie en kilomètres. KALEA ajoute ce suivi automatiquement : indique le kilométrage actuel.')
        : trad('Cette fréquence est en heures, mais la machine n\'est pas encore suivie en heures. KALEA ajoute ce compteur automatiquement : indique le relevé actuel.')}</p>
      <div class="field-row">
        <div>
          <label for="second-compteur-valeur">${km ? trad('Kilométrage actuel') : trad('Relevé actuel')}</label>
          <input id="second-compteur-valeur" type="number" min="0" inputmode="decimal" value="${valeurInitiale != null ? esc(String(valeurInitiale)) : ''}">
        </div>
      </div>
      <div class="hint" id="second-compteur-erreur"></div>
      <div class="modal-actions">
        <button type="button" class="secondary" id="second-compteur-annuler">${trad('Annuler')}</button>
        <button type="button" class="primary" id="second-compteur-confirmer">${trad('Ajouter ce suivi')}</button>
      </div>
    </div>
  `;
  const champ = overlay.querySelector('#second-compteur-valeur');
  const erreur = overlay.querySelector('#second-compteur-erreur');
  const bouton = overlay.querySelector('#second-compteur-confirmer');
  const fermer = () => overlay.remove();
  overlay.querySelector('#second-compteur-close-x').addEventListener('click', fermer);
  overlay.querySelector('#second-compteur-annuler').addEventListener('click', fermer);
  const valider = async () => {
    const valeur = nombreDepuisTexte(champ.value);
    if (valeur == null || valeur < 0) { erreur.textContent = trad('Indique le relevé actuel (0 si la machine est neuve).'); return; }
    erreur.textContent = '';
    bouton.disabled = true;
    bouton.textContent = trad('Enregistrement…');
    try {
      await confirmer(valeur);
      overlay.remove();
    } catch (err) {
      erreur.textContent = trad('Erreur :') + ' ' + err.message;
      bouton.disabled = false;
      bouton.textContent = trad('Ajouter ce suivi');
    }
  };
  bouton.addEventListener('click', valider);
  champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); } });
  champ.focus();
}

// Machine DÉJÀ ENREGISTRÉE : écrit le second suivi (machine + plan) avec les mêmes fonctions que
// « Modifier la machine » (machineCounter2Patch / planJours2Patch / planCounter2Patch).
async function ecrireSecondSuivi(machine, mode, valeur, choix) {
  const enCalendrier = mode === 'days';
  const machinePatch = machineCounter2Patch(enCalendrier ? null : valeur, mode);
  if (Object.keys(machinePatch).length) {
    const { error } = await sb.from('machines').update(machinePatch).eq('id', machine.id);
    if (error) throw error;
  }
  // Cadence du second suivi : la fréquence qui vient d'être choisie pour CETTE tâche ; rappel par
  // défaut, comme tout nouveau suivi.
  const intervalle = Math.max(1, Number(choix?.interval) || (enCalendrier ? 30 : 250));
  const planPatch = enCalendrier
    ? { ...planJours2Patch(intervalle, FALLBACK_REMINDER_DAYS), ...planNextDueAt2Patch(addDaysIso(todayIso(), intervalle)) }
    : { ...planCounter2Patch(intervalle, FALLBACK_REMINDER_HOURS), ...planNextDueCounter2Patch((valeur || 0) + intervalle) };
  if (machine.plan?.id && Object.keys(planPatch).length) {
    const { error } = await sb.from('maintenance_plans').update(planPatch).eq('id', machine.plan.id);
    if (error) throw error;
    Object.assign(machine.plan, planPatch);
  }
  Object.assign(machine, machinePatch);
}

// Plan DÉJÀ ENREGISTRÉ (fiche d'une machine) : ajoute le second suivi puis appelle onConfigure.
function ajouterSecondSuiviAutomatique(machine, mode, choix, onConfigure, surErreur) {
  if (mode === 'days') {
    ecrireSecondSuivi(machine, mode, null, choix).then(onConfigure).catch((err) => surErreur(trad('Erreur :') + ' ' + err.message));
    return;
  }
  // Le relevé déjà gardé sur la machine dans cette unité (saisi à l'ajout, même si le suivi principal est calendaire)
  // est proposé tel quel.
  const releveConnu = (machine.counter_unit === mode && machineCounter(machine) != null) ? machineCounter(machine) : null;
  demanderReleveSecondSuivi(mode, async (valeur) => {
    await ecrireSecondSuivi(machine, mode, valeur, choix);
    onConfigure();
  }, releveConnu);
}

// Plan PAS ENCORE enregistré (assistant d'ajout, « Modifier la machine », fiche après lecture d'un
// carnet) : même modale de fréquence, mais le second suivi est ajouté dans le FORMULAIRE
// (`activer`), rien n'est écrit tant que la machine n'est pas enregistrée. `onChoix` reçoit le choix
// et la machine « vue » avec son second suivi, pour calculer la tâche contre le bon compteur.
function ouvrirChoixFrequenceApercuAuto(item, planCtx, machineCtx, activer, onChoix, relevePropose) {
  ouvrirChoixFrequenceApercu(item, planCtx, machineCtx, (choix) => {
    const mode = choix.unite ? modeSecondaireRequis(choix.unite, planCtx, machineCtx) : null;
    if (!mode) { onChoix(choix, machineCtx); return; }
    const terminer = (valeur) => {
      activer(mode, valeur);
      onChoix(choix, { ...machineCtx, counter_unit_2: mode, counter_value_2: valeur });
    };
    if (mode === 'days') terminer(null);
    else demanderReleveSecondSuivi(mode, async (valeur) => terminer(valeur), relevePropose ? relevePropose(mode) : null);
  });
}

// Le second suivi tel qu'il est RÉGLÉ dans le formulaire affiché (case cochée, unité, relevé) —
// peut différer de ce qui est enregistré tant qu'on n'a pas validé.
function secondaireDuFormulaire(overlay) {
  const caseSec = overlay.querySelector('#f-secondaire-active');
  if (!caseSec) return {};
  const unite = caseSec.checked ? (overlay.querySelector('input[name=tm2]:checked')?.value || null) : null;
  const valeur = (unite && unite !== 'days') ? nombreDepuisTexte(overlay.querySelector('#f-secondaire-valeur')?.value) : null;
  return { counter_unit_2: unite, counter_value_2: valeur };
}
// Coche la section « second suivi » du formulaire, choisit l'unité et remplit le relevé.
function activerSecondSuiviFormulaire(overlay, mode, valeur) {
  const caseSec = overlay.querySelector('#f-secondaire-active');
  if (!caseSec) return;
  if (!caseSec.checked) { caseSec.checked = true; caseSec.dispatchEvent(new Event('change')); }
  const radio = overlay.querySelector(`input[name=tm2][value="${mode}"]`);
  if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
  const champ = overlay.querySelector('#f-secondaire-valeur');
  if (champ && valeur != null) champ.value = valeur;
}

function openChoixFrequence(machine, item, companyId, categories, planScrollTop) {
  if (refuserSiNonCouverte(machine)) return;
  const plan = machine.plan || {};
  const options = optionsTache(item, plan, machine);
  const unitePlan = uniteIntervalleDuPlan(plan, machine);
  const uniteMot = (u) => trad((UNITES_INTERVALLE[u] || {}).libelle || u);
  const uniteMinuscule = (u) => trad((UNITES_INTERVALLE[u] || {}).mot || u);
  const overlay = document.createElement('div');
  overlay.className = 'overlay choix-modal choix-frequence-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Les cartes reprennent EXACTEMENT ce que le carnet propose (libelleOption) —
  // aucun profil d'usage, aucune sévérité inventée : le carnet ne dit que
  // « Professionnel », « Partiel », etc. quand il le dit, et l'ordre est le
  // sien, pas un classement du plus intensif au plus occasionnel.
  const cartesOptions = options.map((o, i) => {
    const compatible = uniteCompatiblePlan(o.unite, plan, machine);
    const libelle = libelleOption(o);
    const estActuel = !!item.interval_choisi && item.interval_choisi === libelle;
    const note = noteFrequenceHorsPlan(o.unite, plan, machine, uniteMinuscule(unitePlan));
    return `
      <div class="choix-carte${estActuel ? ' is-actuel' : ''}">
        <span class="choix-carte-ico">${picto('prochain')}</span>
        <div class="choix-carte-corps">
          <span class="choix-carte-valeur">${esc(libelle)}</span>
          ${note}
        </div>
        ${estActuel
          ? `<span class="badge ok">${picto('ajuste')}<span>${trad('Actuellement retenu')}</span></span>`
          : `<button type="button" class="view-manual choix-option" data-choix="${i}">${trad('Choisir cette option')}</button>`}
      </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal">
      <div class="mform-tete">
        <div class="mform-tete-titre"><h2>${esc(item.label || '')}</h2></div>
        <button type="button" class="mform-close" id="choix-close-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
      </div>
      <p class="sub">${trad('Fréquence d\'entretien : à toi de choisir selon ton usage.')}</p>
      ${item.interval_choisi ? `<div class="choix-retenu"><span class="card-ico">${picto('ajuste')}</span>${esc(tR('Actuellement retenu : {choix}', { choix: trad(item.interval_choisi) }))}</div>` : ''}

      ${options.length ? `
      <div class="choix-bloc choix-bloc-carnet">
        <div class="mform-head">
          <div class="mform-head-gauche"><span class="mform-section-ico">${picto('carnet')}</span><h3>${trad('Options extraites du carnet constructeur')}</h3></div>
          <span class="badge neutral">${tR('{n} cycle(s) proposé(s)', { n: options.length })}</span>
        </div>
        ${cartesOptions}
      </div>` : ''}

      <div class="choix-bloc choix-bloc-libre">
        <div class="mform-head">
          <div class="mform-head-gauche"><span class="mform-section-ico">${picto('crayon')}</span><h3>${trad('Personnalisation libre')}</h3></div>
          <span class="mform-eyebrow">${trad('Option sur mesure')}</span>
        </div>
        <p class="muted-text">${trad('Si tes conditions d\'usage demandent une périodicité différente de ce que propose le carnet.')}</p>
        <div class="field-row">
          <div>
            <label for="choix-valeur">${trad('Valeur')}</label>
            <input id="choix-valeur" type="number" min="1" step="1" value="">
          </div>
          <div>
            <label for="choix-unite">${trad('Unité')}</label>
            <select id="choix-unite">
              ${[trad('heures'), trad('km'), trad('jours'), trad('mois')].map(u => `<option value="${u}"${u === unitePlan ? ' selected' : ''}>${esc(uniteMot(u))}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="hint">${trad('Valeur dans son unité : la tâche aura sa propre échéance, dans cette unité. Elle ne compte pas dans l\'échéance du plan si l\'unité diffère.')}</div>
        <div class="modal-actions" style="margin-top:10px;">
          <button type="button" class="primary" id="choix-enregistrer">${picto('ajuste')}<span>${trad('Appliquer cette valeur')}</span></button>
        </div>
      </div>

      <div class="choix-bloc choix-bloc-controle">
        <button type="button" class="view-manual" id="choix-controle"><span class="card-ico">${picto('case')}</span><span>${trad('Garder comme point de contrôle (sans échéance)')}</span></button>
        <p class="muted-text">${trad('La tâche reste visible et à cocher lors d\'un entretien, mais son échéance n\'est plus calculée automatiquement.')}</p>
      </div>

      <div class="choix-info-box">
        <span class="card-ico">${picto('info')}</span>
        <p>${trad('Ce choix recalcule l\'échéance du plan, et donc son rang parmi les priorités affichées dans l\'Agenda et le Tableau de bord.')}</p>
      </div>

      <div class="hint" id="choix-erreur"></div>
      <div class="modal-actions">
        <button type="button" class="secondary" id="choix-annuler">${trad('Annuler')}</button>
      </div>
    </div>
  `;
  // VERROU pendant l'enregistrement : signalé sur un vrai téléphone (4G) —
  // aucun bouton n'était désactivé pendant l'écriture, et fermer la fenêtre
  // (X / Annuler) PENDANT que la requête était encore en vol rouvrait la
  // fiche AVANT que l'écriture n'ait eu le temps d'aboutir, donnant
  // l'impression que le choix « ne s'enregistre pas » — alors que
  // appliquerChoixTache() elle-même est correcte (vérifié isolément). Tant
  // que enregistrementEnCours est vrai, fermer/annuler REND la fenêtre au
  // lieu de fermer dans le vide : la prochaine fermeture, une fois
  // l'écriture terminée, rouvre alors la fiche à jour.
  let enregistrementEnCours = false;
  let fermetureDemandee = false;
  const fermerEtRouvrir = () => {
    if (enregistrementEnCours) { fermetureDemandee = true; return; }
    // Idempotent : si l'écriture a déjà réussi entre-temps (voir `finally`
    // dans appliquer()), l'overlay est déjà détaché — un second appel ne
    // doit pas rouvrir une DEUXIÈME fiche par-dessus.
    if (!overlay.isConnected) return;
    overlay.remove();
    openPlanView(machine, companyId, categories, { scrollTop: planScrollTop });
  };
  overlay.querySelector('#choix-close-x')?.addEventListener('click', fermerEtRouvrir);
  overlay.querySelector('#choix-annuler').addEventListener('click', fermerEtRouvrir);

  const boutonsActionnables = () => [
    ...overlay.querySelectorAll('.choix-option'),
    overlay.querySelector('#choix-enregistrer'),
    overlay.querySelector('#choix-controle'),
  ].filter(Boolean);

  const appliquer = async (choix, boutonClique) => {
    const erreur = overlay.querySelector('#choix-erreur');
    if (!choix.pointDeControle && !(Number(choix.interval) > 0)) {
      erreur.textContent = trad('Renseigne une valeur supérieure à zéro.');
      return;
    }
    const items = appliquerChoixTache(plan.items, item.label, choix, plan, machine);
    const maj = { items };
    const echeance = echeancePlanDepuisTaches(items, plan);
    if (echeance != null) Object.assign(maj, echeancePlanPatch(echeance, plan));
    erreur.textContent = '';
    enregistrementEnCours = true;
    const texteInitial = boutonClique ? boutonClique.textContent : null;
    boutonsActionnables().forEach((b) => { b.disabled = true; });
    if (boutonClique) boutonClique.textContent = trad('Enregistrement…');
    try {
      if (plan.id) {
        const { error } = await sb.from('maintenance_plans').update(maj).eq('id', plan.id);
        if (error) throw error;
      }
      // La fiche se rafraîchit avec ce qui vient d'être enregistré : l'échéance
      // du plan est recalculée, et le choix reste modifiable.
      Object.assign(plan, maj);
      overlay.remove();
      openPlanView(machine, companyId, categories, { scrollTop: planScrollTop });
    } catch (err) {
      erreur.textContent = trad('Erreur :') + ' ' + err.message;
      boutonsActionnables().forEach((b) => { b.disabled = false; });
      if (boutonClique && texteInitial != null) boutonClique.textContent = texteInitial;
    } finally {
      enregistrementEnCours = false;
      // Fermeture demandée PENDANT l'écriture (X ou Annuler tapés entre-temps) :
      // honorée maintenant. Si l'écriture a réussi, le chemin ci-dessus a déjà
      // retiré l'overlay et rouvert la fiche à jour — fermerEtRouvrir() sur un
      // overlay déjà détaché ne fait alors plus rien d'utile mais ne casse rien.
      if (fermetureDemandee) fermerEtRouvrir();
    }
  };

  // Signalé par l'utilisateur : choisir une fréquence hors de l'unité du plan
  // ET hors de tout second suivi déjà actif ne disait jusqu'ici rien de plus
  // qu'un petit texte grisé sur la carte — la tâche retombait en simple point
  // de contrôle sans que ce soit visible nulle part ailleurs. On l'annonce
  // maintenant AVANT d'enregistrer, avec le geste pour l'activer tout de
  // suite plutôt que de renvoyer vers « Modifier la machine ».
  const appliquerAvecGardeSecondCompteur = (choix, bouton) => {
    const modeRequis = choix.unite ? modeSecondaireRequis(choix.unite, plan, machine) : null;
    if (modeRequis) {
      ajouterSecondSuiviAutomatique(machine, modeRequis, choix, () => appliquer(choix, bouton),
        (message) => { overlay.querySelector('#choix-erreur').textContent = message; });
      return;
    }
    appliquer(choix, bouton);
  };
  overlay.querySelectorAll('.choix-option').forEach(btn => {
    btn.addEventListener('click', () => appliquerAvecGardeSecondCompteur(options[Number(btn.dataset.choix)], btn));
  });
  habillerSelect(overlay.querySelector('#choix-unite'), trad('Unité'));
  overlay.querySelector('#choix-enregistrer').addEventListener('click', () => {
    const valeur = parseFloat(overlay.querySelector('#choix-valeur').value);
    const unite = overlay.querySelector('#choix-unite').value;
    // `libre: true` : c'est un intervalle exprimé par l'utilisateur, avec son
    // unité — il est accepté même si l'unité n'est pas celle du plan, et la tâche
    // reçoit sa propre échéance dans cette unité.
    appliquerAvecGardeSecondCompteur({ interval: valeur, unite, libelle: null, libre: true }, overlay.querySelector('#choix-enregistrer'));
  });
  overlay.querySelector('#choix-controle').addEventListener('click', (e) => appliquer({ pointDeControle: true }, e.currentTarget));
}

// Même modale que ci-dessus (openChoixFrequence), même présentation — options
// extraites du carnet, valeur libre, point de contrôle —, mais pour un item
// PAS ENCORE enregistré : les écrans « Plan proposé par notre algorithme »
// (dépôt de manuel, assistant d'ajout, fiche machine), avant que le plan
// existe. Demandé explicitement par l'utilisateur plutôt qu'un simple champ
// texte : la même modale que celle qui pilote déjà une tâche sur un plan
// réel, pas un second éditeur divergent. Différences avec la version
// « live » : pas d'écriture Supabase (le résultat de appliquerChoixSurTache
// est rendu au consommateur via callback, qui l'applique à son tableau
// local), pas de verrou d'enregistrement (rien n'est en vol), pas d'encart
// « recalcule le rang dans l'Agenda » (le plan n'existe pas encore).
function ouvrirChoixFrequenceApercu(item, plan, machine, onChoix) {
  const options = optionsTache(item, plan, machine);
  const uniteMot = (u) => trad((UNITES_INTERVALLE[u] || {}).libelle || u);
  const unitePlan = uniteIntervalleDuPlan(plan, machine);
  const overlay = document.createElement('div');
  overlay.className = 'overlay choix-modal choix-frequence-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const cartesOptions = options.map((o, i) => {
    const compatible = uniteCompatiblePlan(o.unite, plan, machine);
    const libelle = libelleOption(o);
    const estActuel = !!item.interval_choisi && item.interval_choisi === libelle;
    const note = noteFrequenceHorsPlan(o.unite, plan, machine, uniteMot(unitePlan));
    return `
      <div class="choix-carte${estActuel ? ' is-actuel' : ''}">
        <span class="choix-carte-ico">${picto('prochain')}</span>
        <div class="choix-carte-corps">
          <span class="choix-carte-valeur">${esc(libelle)}</span>
          ${note}
        </div>
        ${estActuel
          ? `<span class="badge ok">${picto('ajuste')}<span>${trad('Actuellement retenu')}</span></span>`
          : `<button type="button" class="view-manual choix-option" data-choix="${i}">${trad('Choisir cette option')}</button>`}
      </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal">
      <div class="mform-tete">
        <div class="mform-tete-titre"><h2>${esc(item.label || trad('Nouvelle tâche'))}</h2></div>
        <button type="button" class="mform-close" id="choix-close-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
      </div>
      <p class="sub">${trad('Fréquence d\'entretien : à toi de choisir selon ton usage.')}</p>
      ${item.interval_choisi ? `<div class="choix-retenu"><span class="card-ico">${picto('ajuste')}</span>${esc(tR('Actuellement retenu : {choix}', { choix: trad(item.interval_choisi) }))}</div>` : ''}

      ${options.length ? `
      <div class="choix-bloc choix-bloc-carnet">
        <div class="mform-head">
          <div class="mform-head-gauche"><span class="mform-section-ico">${picto('carnet')}</span><h3>${trad('Options extraites du carnet constructeur')}</h3></div>
          <span class="badge neutral">${tR('{n} cycle(s) proposé(s)', { n: options.length })}</span>
        </div>
        ${cartesOptions}
      </div>` : ''}

      <div class="choix-bloc choix-bloc-libre">
        <div class="mform-head">
          <div class="mform-head-gauche"><span class="mform-section-ico">${picto('crayon')}</span><h3>${trad('Personnalisation libre')}</h3></div>
          <span class="mform-eyebrow">${trad('Option sur mesure')}</span>
        </div>
        <p class="muted-text">${trad('Si tes conditions d\'usage demandent une périodicité différente de ce que propose le carnet.')}</p>
        <div class="field-row">
          <div>
            <label for="choix-valeur">${trad('Valeur')}</label>
            <input id="choix-valeur" type="number" min="1" step="1" value="">
          </div>
          <div>
            <label for="choix-unite">${trad('Unité')}</label>
            <select id="choix-unite">
              ${[trad('heures'), trad('km'), trad('jours'), trad('mois')].map(u => `<option value="${u}"${u === unitePlan ? ' selected' : ''}>${esc(uniteMot(u))}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="hint">${trad('Valeur dans son unité : la tâche aura sa propre échéance, dans cette unité. Elle ne compte pas dans l\'échéance du plan si l\'unité diffère.')}</div>
        <div class="modal-actions" style="margin-top:10px;">
          <button type="button" class="primary" id="choix-enregistrer">${picto('ajuste')}<span>${trad('Appliquer cette valeur')}</span></button>
        </div>
      </div>

      <div class="choix-bloc choix-bloc-controle">
        <button type="button" class="view-manual" id="choix-controle"><span class="card-ico">${picto('case')}</span><span>${trad('Garder comme point de contrôle (sans échéance)')}</span></button>
        <p class="muted-text">${trad('La tâche reste visible et à cocher lors d\'un entretien, mais son échéance n\'est plus calculée automatiquement.')}</p>
      </div>

      <div class="hint" id="choix-erreur"></div>
      <div class="modal-actions">
        <button type="button" class="secondary" id="choix-annuler">${trad('Annuler')}</button>
      </div>
    </div>
  `;
  const fermer = () => overlay.remove();
  overlay.querySelector('#choix-close-x')?.addEventListener('click', fermer);
  overlay.querySelector('#choix-annuler').addEventListener('click', fermer);
  const appliquer = (choix) => {
    const erreur = overlay.querySelector('#choix-erreur');
    if (!choix.pointDeControle && !(Number(choix.interval) > 0)) {
      erreur.textContent = trad('Renseigne une valeur supérieure à zéro.');
      return;
    }
    fermer();
    onChoix(choix);
  };
  overlay.querySelectorAll('.choix-option').forEach(btn => {
    btn.addEventListener('click', () => appliquer(options[Number(btn.dataset.choix)]));
  });
  habillerSelect(overlay.querySelector('#choix-unite'), trad('Unité'));
  overlay.querySelector('#choix-enregistrer').addEventListener('click', () => {
    const valeur = parseFloat(overlay.querySelector('#choix-valeur').value);
    const unite = overlay.querySelector('#choix-unite').value;
    appliquer({ interval: valeur, unite, libelle: null, libre: true });
  });
  overlay.querySelector('#choix-controle').addEventListener('click', () => appliquer({ pointDeControle: true }));
}

// Les « points d'attention » viennent de l'analyse du carnet : ils ont été écrits
// au moment où le compteur était vide. Une fois le compteur renseigné, une phrase
// comme « La machine ayant 0 heure » contredit le haut de la fiche, qui affiche
// « compteur 22 h ». On retire donc les phrases qui AFFIRMENT l'état du compteur
// ou son unité — l'application les affiche déjà, et mieux — en gardant tout ce
// qui vient du manuel : jalons, pages, opérations. Rien n'est inventé.
function notesUtiles(notes, compteur) {
  if (notes == null) return notes;
  const texte = String(notes).trim();
  // Sans compteur connu, l'affirmation n'est pas contredite : on garde le texte.
  if (compteur == null || !(Number(compteur) > 0)) return texte;
  const AFFIRME_L_ETAT = [
    /^(la|le)\s+(machine|v[ée]hicule|tracteur|engin|chariot|v[ée]lo)\b[^.]*\b(0\s?h|neuf|neuve|affiche|indique|compteur|heures?|km|kilom[èe]tres)/i,
    /^(comme|lorsque|puisque|[ée]tant donn[ée] que)\b[^.]*\b(\d[\d\s]*\s?(h|heures?|km|kilom[èe]tres)|compteur)/i,
    /\b(le suivi doit se faire|suivi par compteur|compteur horaire|compteur kilom[ée]trique)\b/i,
    /^(the|as|since)\b[^.]*\b(0\s?h(ours?)?|new|shows|reads|counter|hours?|km)\b/i,
  ];
  const phrases = texte.match(/[^.!?]+[.!?]?/g) || [texte];
  // L'application calcule elle-même la prochaine échéance : une phrase qui décrit
  // ce calcul vieillit avec le compteur, même une fois la prémisse retirée.
  const CALCUL = /(échéance|echeance|prochaine|jalon)[^.]*\b(fix[ée]e?|calcul[ée]e?|de plus)\b/i;
  const nettoyer = (phrase) => {
    let reste = phrase;
    // Une phrase peut commencer par la prémisse fausse puis donner du manuel :
    // « La machine ayant 0 heure, le premier jalon obligatoire est l'entretien
    // des 20 premières heures (page 17). » On retire la prémisse, on garde le
    // reste — c'est là qu'est l'information utile.
    const coupe = phrase.match(/^([^,]{0,140}?),\s*([\s\S]+)$/);
    if (coupe && AFFIRME_L_ETAT.some((motif) => motif.test(coupe[1]))) reste = coupe[2].trim();
    else if (AFFIRME_L_ETAT.some((motif) => motif.test(phrase))) return '';
    if (CALCUL.test(reste)) return '';
    if (reste !== phrase) {
      if (reste.length < 30) return '';
      return reste.charAt(0).toUpperCase() + reste.slice(1);
    }
    return phrase;
  };
  const gardees = phrases
    .map((phrase) => phrase.trim())
    .map(nettoyer)
    .filter((phrase) => phrase && phrase.length > 2);
  const resultat = gardees.join(' ').trim();
  // Si tout a été retiré, mieux vaut le texte d'origine que rien du tout.
  return resultat.length >= 40 ? resultat : texte;
}

// Relie (ou retire) un kit d'entretien à une tâche précise — même plomberie
// que openChoixFrequence juste au-dessus (verrou pendant l'écriture, même
// bug de fermeture prématurée déjà corrigé une fois pour cette famille de
// modales, voir son commentaire), mais un choix distinct et non fusionné :
// fréquence et kit sont deux décisions indépendantes, les mélanger dans une
// seule modale brouillerait ce que l'utilisateur est en train de choisir.
// Marqueur posé sur `maintenance_kits.note` pour un kit auto-créé par
// résoudreKitPourPieceDirecte() — jamais affiché tel quel (nomKit/l'écran de
// gestion des kits montrent son `name`, une vraie désignation de pièce, pas
// ce marqueur), il sert seulement à retrouver un kit à 1 pièce déjà créé
// pour ne pas en semer un nouveau à chaque association identique.
const MARQUEUR_KIT_PIECE_DIRECTE = '__piece_directe__';

// Associer une pièce du catalogue SANS passer par la création manuelle d'un
// kit — signalé par l'utilisateur : « associer un kit » n'avait de sens que
// pour un vrai ensemble de pièces, pas pour une tâche qui n'a besoin que
// d'UNE pièce. Le concept de kit réutilisable reste inchangé (décision
// d'origine du chantier Kits d'entretien) : on crée ici, discrètement, un
// kit à une seule ligne — appliquerKitTache/listePreparation/
// calculerCouverturePiece n'ont donc rien à changer, ils continuent de ne
// connaître que des kit_id. Réutilise un kit à 1 pièce déjà créé pour EXACTEMENT
// la même pièce et la même quantité (jamais une correspondance approximative :
// une quantité différente doit rester une association séparée).
async function resoudreKitPourPieceDirecte(partId, quantity) {
  const existant = (UI.maintenanceKits || []).find((k) => k.note === MARQUEUR_KIT_PIECE_DIRECTE
    && (UI.maintenanceKitLines || []).some((l) => String(l.kit_id) === String(k.id)
      && String(l.part_id) === String(partId) && Number(l.quantity) === Number(quantity)));
  if (existant) return existant.id;
  const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(partId));
  const nom = piece ? piece.designation : trad('Pièce');
  const { data: kitData, error: kitErr } = await sb.from('maintenance_kits')
    .insert({ company_id: UI.companyId, name: nom, note: MARQUEUR_KIT_PIECE_DIRECTE })
    .select('id, name, note, active')
    .single();
  if (kitErr) throw kitErr;
  UI.maintenanceKits = [...(UI.maintenanceKits || []), kitData];
  const { data: ligneData, error: ligneErr } = await sb.from('maintenance_kit_lines')
    .insert({ company_id: UI.companyId, kit_id: kitData.id, part_id: partId, quantity })
    .select('id, kit_id, part_id, quantity, note');
  if (ligneErr) throw ligneErr;
  UI.maintenanceKitLines = [...(UI.maintenanceKitLines || []), ...(ligneData || [])];
  return kitData.id;
}

function ouvrirChoixKitTache(machine, item, index, companyId, categories, planScrollTop) {
  const plan = machine.plan || {};
  const kits = (UI.maintenanceKits || []).filter((k) => k.active !== false && k.note !== MARQUEUR_KIT_PIECE_DIRECTE);
  const pieces = (UI.partsCatalog || []).slice().sort((a, b) => a.designation.localeCompare(b.designation));
  // Le kit actuellement relié peut être un kit à 1 pièce auto-créé (voir
  // resoudreKitPourPieceDirecte) — il n'apparaît pas dans le <select> de kit
  // ci-dessus (filtré), donc sans ça la fiche semblait n'avoir plus rien
  // d'associé en rouvrant cette modale alors qu'une pièce l'est bien.
  const kitActuel = item.kit_id ? (UI.maintenanceKits || []).find((k) => String(k.id) === String(item.kit_id)) : null;
  const ligneActuelle = (kitActuel && kitActuel.note === MARQUEUR_KIT_PIECE_DIRECTE) ? lignesKit(kitActuel.id)[0] : null;
  const optionsPieces = pieces.map((p) => `<option value="${esc(p.id)}"${ligneActuelle && String(ligneActuelle.part_id) === String(p.id) ? ' selected' : ''}>${esc(p.designation)}${p.reference ? ' — ' + esc(p.reference) : ''}</option>`).join('');
  const overlay = document.createElement('div');
  overlay.className = 'overlay choix-modal kit-tache-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal">
      <div class="mform-tete">
        <div class="mform-tete-titre"><h2>${trad('Pièces de maintenance associées à cette tâche')}</h2></div>
        <button type="button" class="mform-close" id="kit-tache-close-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
      </div>
      <p class="sub">${esc(item.label || '')}</p>
      <label for="kit-tache-select">${trad('Kit d\'entretien')}</label>
      <select id="kit-tache-select">
        <option value="">${trad('— Aucun kit —')}</option>
        ${kits.map((k) => `<option value="${esc(k.id)}"${item.kit_id === k.id ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}
      </select>
      ${!kits.length ? `<p class="hint">${trad('Aucun kit actif pour l\'instant — tu peux quand même associer une pièce seule ci-dessous, ou en créer un depuis Stocks & SAV.')}</p>` : ''}
      <div class="hint" style="margin:10px 0;">${trad('— ou —')}</div>
      <label for="kit-tache-piece-select">${trad('Pièce seule du catalogue (sans créer de kit)')}</label>
      <select id="kit-tache-piece-select">
        <option value="">${trad('— Aucune —')}</option>
        ${optionsPieces}
      </select>
      <div class="field-row" id="kit-tache-piece-qte-row" style="display:${ligneActuelle ? 'flex' : 'none'};margin-top:8px;">
        <div>
          <label for="kit-tache-piece-qte">${trad('Quantité')}</label>
          <input id="kit-tache-piece-qte" type="text" inputmode="decimal" value="${ligneActuelle ? esc(texteAvecSeparateurs(ligneActuelle.quantity)) : '1'}">
        </div>
      </div>
      ${!pieces.length ? `<p class="hint">${trad('Aucune pièce dans le catalogue pour l\'instant — ajoute-la depuis Stocks & SAV.')}</p>` : ''}
      <div class="hint" id="kit-tache-erreur"></div>
      <div class="modal-actions">
        <button type="button" class="secondary" id="kit-tache-annuler">${trad('Annuler')}</button>
        <button type="button" class="primary" id="kit-tache-enregistrer"><span>${trad('Enregistrer')}</span></button>
      </div>
    </div>`;

  const selectKit = overlay.querySelector('#kit-tache-select');
  const selectPiece = overlay.querySelector('#kit-tache-piece-select');
  const ligneQte = overlay.querySelector('#kit-tache-piece-qte-row');
  habillerSelectPieceCatalogue(selectPiece);
  // Mutuellement exclusifs : choisir l'un remet l'autre à vide, pour ne
  // jamais se demander lequel des deux sera réellement enregistré.
  selectKit.addEventListener('change', () => { if (selectKit.value) { selectPiece.value = ''; selectPiece.dispatchEvent(new Event('change', { bubbles: true })); } });
  selectPiece.addEventListener('change', () => {
    ligneQte.style.display = selectPiece.value ? 'flex' : 'none';
    if (selectPiece.value) selectKit.value = '';
  });

  let enregistrementEnCours = false;
  let fermetureDemandee = false;
  const fermerEtRouvrir = () => {
    if (enregistrementEnCours) { fermetureDemandee = true; return; }
    if (!overlay.isConnected) return;
    overlay.remove();
    openPlanView(machine, companyId, categories, { scrollTop: planScrollTop });
  };
  overlay.querySelector('#kit-tache-close-x').addEventListener('click', fermerEtRouvrir);
  overlay.querySelector('#kit-tache-annuler').addEventListener('click', fermerEtRouvrir);

  overlay.querySelector('#kit-tache-enregistrer').addEventListener('click', async () => {
    const erreur = overlay.querySelector('#kit-tache-erreur');
    const bouton = overlay.querySelector('#kit-tache-enregistrer');
    const label = bouton.querySelector('span');
    const pieceId = selectPiece.value || null;
    const qte = pieceId ? nombreDepuisTexte(overlay.querySelector('#kit-tache-piece-qte').value) : null;
    if (pieceId && !(qte > 0)) {
      erreur.textContent = trad('Renseigne une quantité supérieure à zéro.');
      return;
    }
    erreur.textContent = '';
    enregistrementEnCours = true;
    const texteInitial = label.textContent;
    bouton.disabled = true;
    label.textContent = trad('Enregistrement…');
    try {
      // La pièce seule prend le pas sur le kit sélectionné (déjà mutuellement
      // exclusifs à la saisie, cette priorité ne sert que de filet).
      const kitId = pieceId ? await resoudreKitPourPieceDirecte(pieceId, qte) : (selectKit.value || null);
      const items = appliquerKitTache(plan.items, index, item.item_id || null, kitId);
      const maj = { items };
      if (plan.id) {
        const { error } = await sb.from('maintenance_plans').update(maj).eq('id', plan.id);
        if (error) throw error;
      }
      // Aucun recalcul d'échéance de plan ici (contrairement à
      // openChoixFrequence) : relier un kit ne touche à aucun champ
      // d'intervalle/échéance de la tâche, echeancePlanDepuisTaches
      // produirait donc exactement le même résultat qu'avant cet écrit.
      Object.assign(plan, maj);
      overlay.remove();
      openPlanView(machine, companyId, categories, { scrollTop: planScrollTop });
    } catch (err) {
      erreur.textContent = trad('Erreur :') + ' ' + err.message;
      bouton.disabled = false;
      label.textContent = texteInitial;
    } finally {
      enregistrementEnCours = false;
      if (fermetureDemandee) fermerEtRouvrir();
    }
  });
}

// ============================================================
// BANDEAU FICHE MACHINE — reprise à l'octet du mockup Stitch fourni par
// l'utilisateur (stitch_refonte_ui_ux_keeva (2), 2 déclinaisons : 1
// intervalle / 2 intervalles). Directive explicite : aucune modification du
// design, structure et valeurs Tailwind traduites telles quelles en CSS.
// Seul le contenu change : chaque nombre/texte du mockup est un exemple,
// remplacé ici par la vraie donnée équivalente (jamais une valeur inventée
// quand le mockup montre un exemple qui n'a pas d'équivalent réel — voir
// commentaires ciblés plus bas, notamment l'estimation en jours d'un
// intervalle horaire, qu'aucun modèle de rythme d'usage ne permet de
// calculer honnêtement dans ce produit).
// ------------------------------------------------------------
const FM2_SVG_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
const FM2_SVG_SABLIER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 22h14M5 2h14m-2 20v-5a7 7 0 0 0-14 0v5m14-20v5a7 7 0 0 1-14 0V2"></path></svg>';
const FM2_SVG_CLOCHE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"></path></svg>';
const FM2_SVG_MODE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M16 12l-4-4-4 4"></path></svg>';
// Palette d'état du badge d'échéance : le mockup ne montre que l'état
// « imminent » (ambre, #F58220, littéralement sa couleur). Les 2 autres
// états réels de ce produit (à jour / en retard) reprennent les couleurs
// « Operational/OK » et « Critical » déjà documentées dans le DESIGN.md
// fourni avec ce même mockup — jamais de rouge (règle KALEA constante,
// remplacé par le même ambre qu'« imminent », un simple dépassement de la
// même urgence).
const FM2_ETAT_COULEUR = {
  late: { bg: '#FFFBEB', fg: '#F58220' },
  soon: { bg: '#FFFBEB', fg: '#F58220' },
  ok: { bg: '#ECFDF5', fg: '#047857' },
  unknown: { bg: '#F1F5F9', fg: '#64748B' },
};
// Reprend EXACTEMENT les mêmes valeurs que jaugeIntervalleHtml (même
// garde-fou : intervalle/reste absents → null, rien n'est affiché) — juste
// exposées en données brutes plutôt qu'en HTML, pour les poser dans le
// balisage exact du mockup plutôt que dans .machine-jauge.
function detailsIntervalleReel(info, m) {
  if (!m || !m.plan) return null;
  const enCompteur = planIsCounter(m.plan);
  const intervalle = enCompteur ? planIntervalCounter(m.plan) : (m.plan.interval_days ?? null);
  const reste = info.sortKey;
  if (!Number.isFinite(intervalle) || intervalle <= 0 || !Number.isFinite(reste)) return null;
  const part = pourcentageIntervalle(info, m) ?? 0;
  const unite = enCompteur ? counterUnitOf(m) : null;
  const echeance = enCompteur ? formatCounter(planNextDueCounter(m.plan), unite) : formatShortDate(m.plan.next_due_at);
  const debut = enCompteur ? formatCounter(0, unite) : formatShortDate(addDaysIso(m.plan.next_due_at, -intervalle));
  const objectif = enCompteur ? formatCounter(intervalle, unite) : tR('{n} j', { n: intervalle });
  const enRetard = reste < 0;
  const resteValeur = enCompteur ? formatCounter(Math.abs(reste), unite) : tR('{n} j', { n: Math.round(Math.abs(reste)) });
  return { part, echeance, debut, objectif, enRetard, resteValeur, state: info.state };
}
// Texte de la puce « Reste »/« Dépassement » d'un bloc d'intervalle — même
// mot que le reste de l'app (jaugeIntervalleHtml), jamais « en retard de »
// dupliqué avec un vocabulaire différent selon l'écran.
function fm2ResteTexte(detail) {
  return detail.enRetard
    ? tR('Dépassement +{valeur}', { valeur: detail.resteValeur })
    : tR('Reste {valeur}', { valeur: detail.resteValeur });
}
// Mini-carte Cadence/Rappel/Mode de suivi — déclinaison 1 : icône nue à
// côté du libellé, sur la même ligne (structure exacte de l'Option 1).
function fm2MiniCarteO1(label, valeur, svg, couleurIco) {
  return `<div class="fm2-mini-carte-o1">
      <div class="fm2-mini-tete-o1"><span>${esc(label)}</span><span class="fm2-mini-ico-o1" style="color:${couleurIco};">${svg}</span></div>
      <div class="fm2-mini-valeur-o1">${esc(valeur)}</div>
    </div>`;
}
// Même pastille, déclinaison 2 : icône dans un carré teinté à droite,
// libellé + valeur à gauche (structure exacte de l'Option 2, LIGNE 3).
function fm2MiniCarteO2(label, valeur, svg, bgIco, fgIco) {
  return `<div class="fm2-mini-carte-o2">
      <div>
        <div class="fm2-mini-label-o2">${esc(label)}</div>
        <div class="fm2-mini-valeur-o2">${esc(valeur)}</div>
      </div>
      <div class="fm2-mini-ico-o2" style="background:${bgIco};color:${fgIco};">${svg}</div>
    </div>`;
}

// Déclinaison « 1 seul intervalle » (aucun second suivi actif sur la
// machine) — reprise à l'octet de la section « Option 1 » du mockup.
function fm2BandeauSimpleHtml(machine, info, unit, isCounterMode, releveCompteur, seuilCompteur, cadenceTexte, rappelTexte, modeTexte, photoFiche, sousTitre) {
  const detail = detailsIntervalleReel(info, machine);
  const couleur = FM2_ETAT_COULEUR[info.state] || FM2_ETAT_COULEUR.unknown;
  const idAffiche = identifiantAffiche(machine);
  return `
    <div class="fm2-hero">
      <div class="fm2-grid">
        <div class="fm2-o1-photo">
          <div class="fm2-o1-photo-box">
            ${photoFiche ? `<img src="${esc(photoFiche)}" alt="${esc(machine.name)}" loading="lazy">` : ''}
            ${idAffiche ? `<div class="fm2-vin fm2-vin-o1">${esc(idAffiche)}</div>` : ''}
          </div>
        </div>
        <div class="fm2-o1-body">
          <div class="fm2-o1-head">
            <div class="fm2-o1-badges">
              <span class="fm2-badge-echeance fm2-badge-echeance-o1" style="background:${couleur.bg};color:${couleur.fg};">${FM2_SVG_CLOCK}<span>${esc(info.label.toUpperCase())}</span></span>
              ${machine.category?.name ? `<span class="fm2-chip-cat-o1">${esc(machine.category.name.toUpperCase())}</span>` : ''}
              ${idAffiche ? `<span class="fm2-meta-o1">${esc(idAffiche)}</span>` : ''}
            </div>
            <div class="fm2-o1-titre-row">
              <h1 class="fm2-titre-o1">${esc(machine.name.toUpperCase())}</h1>
              ${sousTitre ? `<span class="fm2-sous-titre-o1">${esc(sousTitre)}</span>` : ''}
            </div>
          </div>
          <div class="fm2-o1-cartes">
            ${fm2MiniCarteO1(trad('Cadence'), cadenceTexte, FM2_SVG_SABLIER, '#6366F1')}
            ${fm2MiniCarteO1(trad('Rappel anticipé'), rappelTexte, FM2_SVG_CLOCHE, '#F59E0B')}
            ${fm2MiniCarteO1(trad('Mode de suivi'), modeTexte, FM2_SVG_MODE, '#00B4D8')}
          </div>
        </div>
        <div class="fm2-o1-side">
          ${isCounterMode ? `
          <div class="fm2-releve-row-o1">
            <div>
              <div class="fm2-label-o1">${trad('Relevé actuel')}</div>
              <div class="fm2-releve-valeur-o1">${esc(releveCompteur)}</div>
            </div>
            <div style="text-align:right;">
              <div class="fm2-label-o1">${trad('Seuil d\'alerte')}</div>
              <div class="fm2-seuil-valeur-o1">${esc(seuilCompteur)}</div>
            </div>
          </div>` : ''}
          ${detail ? `
          <div class="fm2-intervalle-o1">
            <div class="fm2-intervalle-o1-row1">
              <span>${esc(tR('Dernier cycle ({valeur})', { valeur: detail.debut }))}</span>
              <span class="fm2-fort-o1">${esc(tR('Objectif {valeur}', { valeur: detail.objectif }))}</span>
            </div>
            <div>
              <div class="fm2-intervalle-o1-label">${trad('INTERVALLE')}</div>
              <div class="fm2-intervalle-o1-row2">
                <span>${esc(tR('Échéance {valeur}', { valeur: detail.echeance }))}</span>
                <span class="fm2-reste-o1">${esc(fm2ResteTexte(detail))}</span>
              </div>
            </div>
            <div class="fm2-piste-o1"><div class="fm2-fill-o1" style="width:${detail.part}%;"></div></div>
            <div class="fm2-pied-o1">
              <span>${esc(tR('Cycle standard {valeur}', { valeur: detail.objectif }))}</span>
              <span class="fm2-pct-o1">${tR('{n}% réalisé', { n: detail.part })}</span>
            </div>
          </div>` : ''}
        </div>
      </div>
    </div>`;
}

// Déclinaison « 2 intervalles » (second suivi actif) — reprise à l'octet de
// la section « Option 2 (Demandée) » du mockup.
// `infoBadge` : le PIRE des deux suivis (infoMachine), pour le badge du
// haut — cohérent avec le reste de l'app (carte machine, tri, compteurs).
// `infoPrincipal` : le suivi PRINCIPAL seul (dueInfo(machine.plan, machine)),
// jamais celui d'infoBadge quand il a basculé sur le secondaire — sinon le
// bloc « INTERVALLE HORAIRE » afficherait par erreur les chiffres du suivi
// calendaire dès que celui-ci est le plus urgent des deux.
function fm2BandeauDoubleHtml(machine, infoBadge, infoPrincipal, v2, unit, isCounterMode, releveCompteur, seuilCompteur, cadenceTexte, rappelTexte, modeTexte, photoFiche, sousTitre) {
  const detailPrincipal = detailsIntervalleReel(infoPrincipal, machine);
  const detailSecondaire = detailsIntervalleReel(v2.info, v2.machineVue);
  const couleur = FM2_ETAT_COULEUR[infoBadge.state] || FM2_ETAT_COULEUR.unknown;
  const idAffiche = identifiantAffiche(machine);
  const statutTexte = machine.status === 'en_service' ? trad('Actif') : esc(machine.status || '');
  // Puce « Reste » de chaque bloc : ambre partagé si cette échéance précise
  // est en retard/imminente (même sémantique que le badge du haut), sinon
  // la couleur d'identité de SON intervalle (indigo horaire / turquoise
  // calendaire) — exactement ce que montre le mockup (bloc calendaire à
  // échéance confortable resté dans sa propre teinte, bloc horaire proche
  // de l'échéance basculé en ambre partagé).
  const resteStyle = (d, bgOk, fgOk) => (d.state === 'late' || d.state === 'soon')
    ? 'background:rgba(245,158,11,.15);color:#D97706;'
    : `background:${bgOk};color:${fgOk};`;
  return `
    <div class="fm2-hero fm2-hero-o2">
      <div class="fm2-grid">
        <div class="fm2-o2-photo">
          <div class="fm2-o2-photo-box">
            ${photoFiche ? `<img src="${esc(photoFiche)}" alt="${esc(machine.name)}" loading="lazy">` : ''}
            ${idAffiche ? `<div class="fm2-vin fm2-vin-o2">${esc(idAffiche)}</div>` : ''}
            ${statutTexte ? `<div class="fm2-statut-o2">${esc(statutTexte.toUpperCase())}</div>` : ''}
          </div>
        </div>
        <div class="fm2-o2-main">

          <div class="fm2-o2-ligne1">
            <div class="fm2-o2-titre-bloc">
              <div class="fm2-o2-badges">
                <span class="fm2-badge-echeance fm2-badge-echeance-o2" style="background:${couleur.bg};color:${couleur.fg};">${FM2_SVG_CLOCK}<span>${esc(infoBadge.label.toUpperCase())}</span></span>
                ${machine.category?.name ? `<span class="fm2-chip-cat-o2">${esc(machine.category.name.toUpperCase())}</span>` : ''}
                ${(idAffiche || sousTitre) ? `<span class="fm2-meta-o2">${esc([idAffiche, sousTitre].filter(Boolean).join(' • '))}</span>` : ''}
              </div>
              <h1 class="fm2-titre-o2">${esc(machine.name.toUpperCase())}</h1>
            </div>
            ${isCounterMode ? `
            <div class="fm2-compteur-entete-o2">
              <div>
                <div class="fm2-label-o2">${trad('Relevé Horamètre')}</div>
                <div class="fm2-releve-valeur-o2">${esc(releveCompteur)}</div>
              </div>
              <div class="fm2-divider-o2"></div>
              <div>
                <div class="fm2-label-o2">${trad('Seuil d\'Alerte')}</div>
                <div class="fm2-seuil-valeur-o2">${esc(seuilCompteur)}</div>
              </div>
            </div>` : ''}
          </div>

          <div class="fm2-o2-ligne2">
            <div class="fm2-o2-ligne2-tete">
              <span class="fm2-o2-suivi-label">${trad('Suivi des 2 intervalles de révision (compteur & calendrier)')}</span>
              <span class="fm2-o2-suivi-hint">${trad('1ère échéance atteinte déclenche l\'entretien')}</span>
            </div>
            <div class="fm2-o2-intervalles">
              ${detailPrincipal ? `
              <div class="fm2-bloc-intervalle fm2-bloc-horaire">
                <div class="fm2-bloc-row1">
                  <span>${esc(tR('Dernier cycle ({valeur})', { valeur: detailPrincipal.debut }))}</span>
                  <span class="fm2-fort-o2">${esc(tR('Objectif {valeur}', { valeur: detailPrincipal.objectif }))}</span>
                </div>
                <div>
                  <div class="fm2-bloc-label fm2-bloc-label-horaire">${trad('INTERVALLE HORAIRE')}</div>
                  <div class="fm2-bloc-row2">
                    <span>${esc(tR('Échéance : {valeur}', { valeur: detailPrincipal.echeance }))}</span>
                    <span class="fm2-bloc-reste" style="${resteStyle(detailPrincipal, '#EEF2FF', '#4338CA')}">${esc(fm2ResteTexte(detailPrincipal))}</span>
                  </div>
                </div>
                <div class="fm2-bloc-piste"><div class="fm2-bloc-fill fm2-bloc-fill-horaire" style="width:${detailPrincipal.part}%;"></div></div>
                <div class="fm2-bloc-pied">
                  <span>${esc(tR('Cycle standard {valeur}', { valeur: detailPrincipal.objectif }))}</span>
                  <span class="fm2-bloc-pct fm2-bloc-pct-horaire">${tR('{n}% atteint', { n: detailPrincipal.part })}</span>
                </div>
              </div>` : ''}
              ${detailSecondaire ? `
              <div class="fm2-bloc-intervalle fm2-bloc-calendaire">
                <div class="fm2-bloc-row1">
                  <span>${esc(tR('Dernier cycle ({valeur})', { valeur: detailSecondaire.debut }))}</span>
                  <span class="fm2-fort-o2">${esc(tR('Objectif {valeur}', { valeur: detailSecondaire.objectif }))}</span>
                </div>
                <div>
                  <div class="fm2-bloc-label fm2-bloc-label-calendaire">${trad('INTERVALLE CALENDAIRE')}</div>
                  <div class="fm2-bloc-row2">
                    <span>${esc(tR('Échéance : {valeur}', { valeur: detailSecondaire.echeance }))}</span>
                    <span class="fm2-bloc-reste" style="${resteStyle(detailSecondaire, '#F0FDFA', '#0F766E')}">${esc(fm2ResteTexte(detailSecondaire))}</span>
                  </div>
                </div>
                <div class="fm2-bloc-piste"><div class="fm2-bloc-fill fm2-bloc-fill-calendaire" style="width:${detailSecondaire.part}%;"></div></div>
                <div class="fm2-bloc-pied">
                  <span>${esc(tR('Cycle standard {valeur}', { valeur: detailSecondaire.objectif }))}</span>
                  <span class="fm2-bloc-pct fm2-bloc-pct-calendaire">${tR('{n}% atteint', { n: detailSecondaire.part })}</span>
                </div>
              </div>` : ''}
            </div>
          </div>

          <div class="fm2-o2-ligne3">
            ${fm2MiniCarteO2(trad('Cadence'), cadenceTexte, FM2_SVG_SABLIER, '#EEF2FF', '#4F46E5')}
            ${fm2MiniCarteO2(trad('Rappel anticipé'), rappelTexte, FM2_SVG_CLOCHE, '#FFFBEB', '#D97706')}
            ${fm2MiniCarteO2(trad('Mode de suivi'), modeTexte, FM2_SVG_MODE, '#F0FDFA', '#0D9488')}
          </div>

        </div>
      </div>
    </div>`;
}

function openPlanView(machine, companyId, categories, options = {}) {
  // L'état GLOBAL (voir infoMachine), pour rester cohérent avec la carte :
  // les deux jauges plus bas détaillent ensuite CHAQUE suivi séparément.
  const info = infoMachine(machine);
  const isCounterMode = planIsCounter(machine.plan);
  const unit = counterUnitOf(machine);
  const overlay = document.createElement('div');
  overlay.className = 'overlay plan-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Les items peuvent être des objets (extraction automatique) ou de simples libellés
  // (anciens enregistrements) : on n'affiche le tableau détaillé que s'il y a
  // réellement des colonnes à remplir.
  // Ils sont CLASSÉS AU RENDU (même règle que l'enregistrement, voir
  // tachesAffichees) : un plan jamais réenregistré montre ici ce qu'il montrera
  // après enregistrement — et cette consultation n'écrit rien en base.
  const items = tachesAffichees(machine.plan, machine);
  const hasItemDetail = items.some(it => it.frequency || it.spec || it.qty || it.note);
  const taskItems = (machine.plan?.tasks || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  const simpleItems = items.length ? items.map(it => it.label).filter(Boolean) : taskItems;
  const cell = (v) => (v || v === 0) ? esc(v) : '<span class="muted">—</span>';
  // Tâches dont le carnet laisse un choix (ou qui attendent encore leur
  // intervalle) : elles sont présentées à part, pour que l'utilisateur tranche.
  const tachesAChoisir = items.filter(it => tacheAttendUnChoix(it, machine.plan, machine));

  // Deux présentations des mêmes données, une seule source :
  //   • un tableau sur écran large (colonnes côte à côte) ;
  //   • une CARTE par tâche sur écran étroit : un tableau à six colonnes ne tient
  //     pas dans un téléphone, et la dernière colonne finissait rognée par la
  //     bordure. Dans une carte, chaque information a sa ligne et son libellé,
  //     et la pastille d'échéance se pose sur SA ligne, à gauche du texte.
  // Colonne « Kit associé » : gated comme le reste du module Stock (le kit
  // n'a de sens que pour une société Enterprise qui a la migration). Position
  // dans `items` = identifiant sûr pour appliquerKitTache (voir son
  // commentaire) — jamais le label seul.
  const avecKits = SCHEMA.hasKits && planCouvreStock();
  const celluleKit = (it, index) => {
    if (!avecKits) return '';
    const gerant = peutGererParametresStock();
    const nomAssocie = it.kit_id ? nomKit(it.kit_id) : null;
    if (!gerant) return nomAssocie ? esc(nomAssocie) : '<span class="muted">—</span>';
    const libelleBouton = nomAssocie ? trad('Modifier') : trad('Associer des pièces de maintenance');
    return `${nomAssocie ? esc(nomAssocie) + ' ' : ''}<button type="button" class="view-manual choisir-kit" data-tache-kit="${index}">${esc(libelleBouton)}</button>`;
  };
  const ligneTableau = (it, index) => {
    const state = infoTache(it, machine.plan, machine).state;
    return `
          <tr class="${state === 'late' ? 'is-late-row' : ''}" data-etat-tache="${state}">
            <td class="item-label"><span class="item-label-ligne"><span class="item-ico">${picto(PICTO_CATEGORIE[categorieProduit(it.label)] || 'boite')}</span>${cell(it.label)}</span></td>
            <td>${cell(it.frequency)}</td>
            <td>${etatTacheHtml(it, machine.plan, machine, 'colonne')}</td>
            <td>${cell(it.spec)}</td>
            <td>${cell(it.qty)}</td>
            <td>${cell(it.note)}</td>
            ${avecKits ? `<td>${celluleKit(it, index)}</td>` : ''}
          </tr>`;
  };
  const carteTache = (it, index) => {
    const state = infoTache(it, machine.plan, machine).state;
    return `
        <div class="tache-carte${state === 'late' ? ' is-late-row' : ''}" data-etat-tache="${state}">
          <div class="tache-titre"><span class="item-ico">${picto(PICTO_CATEGORIE[categorieProduit(it.label)] || 'boite')}</span>${cell(it.label)}</div>
          <div class="tache-ligne"><span class="tache-libelle">${trad('Fréquence')}</span><span class="tache-valeur">${cell(it.frequency)}</span></div>
          <div class="tache-ligne"><span class="tache-libelle">${trad('Échéance')}</span><span class="tache-valeur">${etatTacheHtml(it, machine.plan, machine, 'ligne')}</span></div>
          <div class="tache-ligne"><span class="tache-libelle">${trad('Huile / graisse / pièce')}</span><span class="tache-valeur">${cell(it.spec)}</span></div>
          <div class="tache-ligne"><span class="tache-libelle">${trad('Quantité')}</span><span class="tache-valeur">${cell(it.qty)}</span></div>
          <div class="tache-ligne"><span class="tache-libelle">${trad('Remarque')}</span><span class="tache-valeur">${cell(it.note)}</span></div>
          ${avecKits ? `<div class="tache-ligne"><span class="tache-libelle">${trad('Pièces associées')}</span><span class="tache-valeur">${celluleKit(it, index)}</span></div>` : ''}
        </div>`;
  };

  const tableHtml = hasItemDetail ? `
    <div class="ref-scroll ref-scroll-plan"><table class="ref-table">
      <thead><tr><th>${trad('Élément')}</th><th>${trad('Fréquence')}</th><th>${trad('Échéance')}</th><th>${trad('Huile / graisse / pièce')}</th><th>${trad('Quantité')}</th><th>${trad('Remarque')}</th>${avecKits ? `<th>${trad('Pièces associées')}</th>` : ''}</tr></thead>
      <tbody>${items.map(ligneTableau).join('')}</tbody>
    </table></div>
    <div class="taches-cartes">${items.map(carteTache).join('')}</div>
  ` : (simpleItems.length
      ? `<ul class="plan-tasks">${simpleItems.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
      : `<div class="value" style="color:var(--ink-soft);">${trad('Aucune tâche détaillée')}</div>`);

  // Puces de filtre (comme la maquette « Tous / À venir / Réalisés ») —
  // mais sur les VRAIS 3 états déjà utilisés partout dans l'app
  // (retard/bientôt/à jour), pas une notion de tâche « réalisée » que ce
  // produit ne modélise pas (un plan d'entretien est récurrent, pas une
  // liste de tâches cochées). Une puce par état RÉELLEMENT présent parmi
  // les tâches, jamais une puce à 0 pour un état absent.
  const ETATS_FILTRE = { late: trad('En retard'), soon: trad('Bientôt'), ok: trad('À jour') };
  const comptesEtats = hasItemDetail ? items.reduce((acc, it) => {
    const s = infoTache(it, machine.plan, machine).state;
    if (ETATS_FILTRE[s]) acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {}) : {};
  const etatsPresents = Object.keys(ETATS_FILTRE).filter(s => comptesEtats[s]);
  const filtreTachesHtml = etatsPresents.length > 1 ? `
    <div class="fm-filtres" role="group" aria-label="${esc(trad('Filtrer les tâches par état'))}">
      <button type="button" class="fm-filtre-chip is-active" data-filtre-etat="">${trad('Tous')} (${items.length})</button>
      ${etatsPresents.map(s => `<button type="button" class="fm-filtre-chip is-${s}" data-filtre-etat="${s}">${ETATS_FILTRE[s]} (${comptesEtats[s]})</button>`).join('')}
    </div>` : '';

  const photoFiche = safeUrl(machine.image_url);
  // Tête de la carte compteur : le relevé actuel et le seuil d'alerte, les
  // deux VRAIES valeurs déjà lues plus haut (machineCounter / planNextDueCounter) —
  // simplement mises en avant, en grand, comme la maquette.
  const seuilCompteur = machine.plan ? formatCounter(planNextDueCounter(machine.plan), unit) : null;
  const releveCompteur = machine.plan ? formatCounter(machineCounter(machine), unit) : null;

  // Bandeau du haut (mockup Stitch, reprise à l'octet — voir fm2BandeauSimpleHtml/
  // fm2BandeauDoubleHtml). Déclinaison choisie par la VRAIE présence d'un
  // second suivi (vueCompteurSecondaire), jamais par préférence esthétique.
  const v2ForBandeau = machine.plan ? vueCompteurSecondaire(machine) : null;
  const cadenceTexte = machine.plan ? (() => {
    const p = isCounterMode ? tR('Tous les {n}', { n: formatCounter(planIntervalCounter(machine.plan), unit) }) : tR('Tous les {n} jours', { n: machine.plan.interval_days });
    if (!v2ForBandeau) return p;
    const mode2 = modeSecondaireDe(machine);
    const s = mode2 === 'days' ? tR('{n} j', { n: planIntervalDays2(machine.plan) }) : formatCounter(planIntervalCounter2(machine.plan), mode2);
    return `${p} / ${s}`;
  })() : '';
  const rappelTexte = machine.plan ? (() => {
    const pVal = isCounterMode ? formatCounter(planReminderCounter(machine.plan), unit) : tR('{n} j', { n: machine.plan.reminder_days_before });
    if (!v2ForBandeau) return tR('{val} avant', { val: pVal });
    const mode2 = modeSecondaireDe(machine);
    const sVal = mode2 === 'days' ? tR('{n} j', { n: planReminderDays2(machine.plan) }) : formatCounter(planReminderCounter2(machine.plan), mode2);
    return tR('{pVal} ou {sVal} avant', { pVal, sVal });
  })() : '';
  const modeTexte = machine.plan ? (() => {
    const principal = machine.plan.tracking_mode === 'days' ? trad('Calendaire (jours)') : (unit === 'km' ? trad('Kilométrage') : trad('Compteur horaire'));
    const mode2 = modeSecondaireDe(machine);
    const libelleMode2 = { km: trad('Kilométrage'), hours: trad('Compteur horaire'), days: trad('Calendaire') };
    return mode2 ? tR('{principal} + {second}', { principal, second: libelleMode2[mode2] }) : principal;
  })() : '';
  const miseEnServiceTexte = (() => {
    const [y, m] = String(machine.service_date || '').split('-').map(Number);
    return (y && m) ? tR('Mise en service {mois} {annee}', { mois: moisLong(m - 1), annee: y }) : '';
  })();
  const sousTitreBandeau = [machine.brand_model, miseEnServiceTexte].filter(Boolean).join(' • ');
  const bandeauHtml = machine.plan
    ? (v2ForBandeau
        ? fm2BandeauDoubleHtml(machine, info, dueInfo(machine.plan, machine), v2ForBandeau, unit, isCounterMode, releveCompteur, seuilCompteur, cadenceTexte, rappelTexte, modeTexte, photoFiche, sousTitreBandeau)
        : fm2BandeauSimpleHtml(machine, info, unit, isCounterMode, releveCompteur, seuilCompteur, cadenceTexte, rappelTexte, modeTexte, photoFiche, sousTitreBandeau))
    : fm2BandeauSimpleHtml(machine, info, unit, isCounterMode, releveCompteur, seuilCompteur, '', '', '', photoFiche, sousTitreBandeau);

  overlay.innerHTML = `
    <div class="modal">
      <nav class="plan-fil-ariane" aria-label="${esc(trad('Fil d\'Ariane'))}">
        <button type="button" class="plan-fil-retour" id="plan-fil-retour">${picto('flecheGauche')}<span>${trad('Retour au parc')}</span></button>
        <span class="plan-fil-sep">/</span>
        <span>${trad('Machines (Parc)')}</span>
        <span class="plan-fil-sep">/</span>
        <span>${esc(machine.name)}</span>
        <span class="plan-fil-sep">/</span>
        <span class="plan-fil-courant">${trad('Plan d\'entretien & historique')}</span>
      </nav>
      <div class="fm-toolbar">
        <button type="button" class="fm-btn" id="edit-from-plan"><span class="fm-btn-ico-primary">${picto('crayon')}</span><span>${trad('Modifier la machine')}</span></button>
        ${machine.manual_url ? `<button type="button" class="fm-btn" id="plan-view-manual"><span class="fm-btn-ico-accent">${picto('carnet')}</span><span>${trad('Voir le carnet d\'entretien (PDF)')}</span></button>` : ''}
        <button type="button" class="fm-btn" id="plan-qr-code">${picto('qrcode')}<span>${trad('QR code')}</span></button>
        <button type="button" class="fm-btn fm-btn-primary" id="log-from-plan"><span class="fm-btn-ico-ok">${picto('entretien')}</span><span>${trad('Enregistrer une intervention')}</span></button>
      </div>
      ${bandeauHtml}

      ${tcoActif() ? `
      <section class="fm-card" id="tco-scorecard-section">
        <div class="fm-card-head">
          <div class="fm-card-title-row">
            <h3 class="fm-card-title">${trad('Scorecard TCO')}</h3>
            ${machine.purchase_price != null && machine.purchase_price !== '' ? `<span class="fm-chip fm-chip-accent">${tR('Prix d\'achat initial : {valeur}', { valeur: formatMontant(machine.purchase_price) })}</span>` : ''}
          </div>
        </div>
        <div class="fm-card-sub">${trad('Chargement…')}</div>
      </section>` : ''}

      ${machine.plan ? `
        <section class="fm-card">
          <div class="fm-card-head">
            <div class="fm-card-title-row">
              <h3 class="fm-card-title">${hasItemDetail ? trad('Tableau de référence entretien') : trad('Tâches de maintenance')}</h3>
            </div>
            ${filtreTachesHtml}
          </div>
          ${tableHtml}
        </section>
        ${tachesAChoisir.length ? `
          <section class="fm-card">
            <div class="fm-card-head">
              <div class="fm-card-title-row">
                <h3 class="fm-card-title">${trad('Fréquences à préciser')}</h3>
              </div>
            </div>
            ${tachesAChoisir.map(it => blocChoixTache(it, machine.plan, machine)).join('')}
          </section>
        ` : ''}
        ${machine.plan.notes ? `
          <section class="fm-card">
            <div class="fm-card-head">
              <div class="fm-card-title-row">
                <span class="fm-card-ico is-warn">${picto('alerte')}</span>
                <h3 class="fm-card-title">${trad('Points d\'attention')}</h3>
              </div>
            </div>
            <div class="fm-notebox">${esc(notesUtiles(machine.plan.notes, machineCounter(machine)))}</div>
          </section>
        ` : ''}
      ` : `<section class="fm-card"><div class="fm-card-sub">${trad('Aucun plan de maintenance défini pour cette machine.')}</div></section>`}

      ${tcoActif() ? `
      <section class="fm-card" id="operating-costs-section">
        <div class="fm-card-head">
          <div class="fm-card-title-row">
            <h3 class="fm-card-title">${trad('Coûts d\'exploitation')}</h3>
            <span class="fm-chip">${trad('Lecture seule atelier')}</span>
          </div>
          <span class="fm-card-sub" id="operating-costs-total"></span>
        </div>
        <p class="fm-card-sub" style="margin-bottom:10px;">${trad('Carburant, assurance, taxe, stockage… Pour en ajouter un, utilise « Enregistrer un entretien » sur la carte de cette machine.')}</p>
        <div class="fm-card-sub" id="operating-costs-liste">${trad('Chargement…')}</div>
      </section>` : ''}

      <section class="fm-card" id="history-section">
        <div class="fm-card-head">
          <div class="fm-card-title-row">
            <h3 class="fm-card-title">${trad('Historique des entretiens')}</h3>
          </div>
          <div class="history-actions">
            <button type="button" class="fm-btn" id="export-history-csv" disabled>${picto('export')}<span>${trad('Exporter en CSV')}</span></button>
            <button type="button" class="fm-btn" id="share-history-email" disabled>${picto('partage')}<span>${trad('Partager par email')}</span></button>
          </div>
        </div>
        <div class="fm-card-sub value">${trad('Chargement…')}</div>
      </section>

      <div class="modal-actions">
        <button type="button" class="secondary" id="close-plan">${trad('Fermer')}</button>
      </div>
    </div>
  `;

  overlay.querySelector('#close-plan').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#plan-fil-retour').addEventListener('click', () => overlay.remove());
  // Module incrémental tactile (version smartphone du compteur) — no-op
  // silencieux si la machine n'a pas de compteur numérique (calendaire,
  // ou non couverte par l'offre) : initCompteurRouleaux n'y trouve pas sa
  // cible et ressort aussitôt.
  // Le compteur compact (tap → rouleaux) est câblé par délégation au
  // document (voir ouvrirRouleauxCompteur, plus bas) — rien à faire ici.
  overlay.querySelector('#edit-from-plan').addEventListener('click', () => {
    overlay.remove();
    openMachineModal(companyId, categories, machine);
  });
  overlay.querySelector('#log-from-plan').addEventListener('click', () => {
    overlay.remove();
    openLogInterventionModal(machine);
  });
  overlay.querySelector('#plan-qr-code').addEventListener('click', () => {
    if (!planCouvreQr()) {
      openUpgradeNotice(companyId, trad('Les QR codes sont inclus à partir de l\'offre Business.'));
      return;
    }
    ouvrirQrMachine(machine);
  });
  // L'ajout d'un coût d'exploitation se fait maintenant exclusivement via
  // l'onglet « Frais & Carburant » de openLogInterventionModal (bouton
  // « Enregistrer une intervention » de la carte machine) — la fiche
  // n'affiche plus que l'historique en lecture seule (renderOperatingCosts,
  // plus bas), il n'y a donc plus de formulaire ni d'écouteurs à câbler ici.
  // Une tâche dont le carnet laisse un choix : on DEMANDE, on ne devine pas.
  overlay.querySelectorAll('.choisir-frequence').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = items.find(it => it.label === btn.dataset.tache);
      if (!item) return;
      // Capturée AVANT de retirer cette fiche : openChoixFrequence la
      // rendra à openPlanView quand elle se referme, pour rouvrir la fiche
      // là où on l'avait laissée plutôt que tout en haut.
      const planScrollTop = overlay.scrollTop;
      overlay.remove();
      openChoixFrequence(machine, item, companyId, categories, planScrollTop);
    });
  });
  // Kit d'entretien associé à une tâche — même idiome que .choisir-frequence
  // ci-dessus, position dans `items` plutôt que label (voir appliquerKitTache).
  overlay.querySelectorAll('.choisir-kit').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.tacheKit);
      const item = items[index];
      if (!item) return;
      const planScrollTop = overlay.scrollTop;
      overlay.remove();
      ouvrirChoixKitTache(machine, item, index, companyId, categories, planScrollTop);
    });
  });
  // Puces de filtre des tâches (voir filtreTachesHtml) : masque/affiche les
  // lignes déjà rendues plutôt que de reconstruire le tableau — les données
  // sont déjà toutes là, filtrer côté DOM suffit et reste instantané.
  overlay.querySelectorAll('.fm-filtre-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      overlay.querySelectorAll('.fm-filtre-chip').forEach(c => c.classList.toggle('is-active', c === chip));
      const etat = chip.dataset.filtreEtat;
      overlay.querySelectorAll('[data-etat-tache]').forEach(row => {
        row.style.display = (!etat || row.dataset.etatTache === etat) ? '' : 'none';
      });
    });
  });
  if (machine.manual_url) {
    // ⚠️ `?.` N'EST PAS UNE PRÉCAUTION DE STYLE. Ce bouton n'est rendu QUE si la
    // machine a un carnet (`${machine.manual_url ? … : ''}`) : sans le `?.`, la
    // ligne jette sur un `null` pour toute machine sans carnet, et l'exception
    // interrompt la fonction — donc TOUT ce qui est câblé plus bas ne l'est
    // jamais. C'est le même défaut que sur la fiche de modification, et il est
    // invisible tant qu'on n'ouvre que des machines qui ont un carnet.
    overlay.querySelector('#plan-view-manual')?.addEventListener('click', (e) => viewManual(machine.manual_url, e.target));
  }

  let historyData = [];
  // id -> nom affiché, rempli une fois avec l'historique (voir plus bas) :
  // une seule requête équipe pour tout l'écran (table, CSV, email).
  let nomsEquipe = new Map();
  // Coûts d'exploitation (voir tcoActif()) : chargés en même temps que
  // l'historique, réutilisés par la scorecard TCO ci-dessous.
  let operatingCosts = [];
  const OC_LABELS = { fuel: trad('Carburant'), insurance: trad('Assurance'), tax: trad('Taxe'), storage: trad('Stockage'), other: trad('Autre') };
  const renderOperatingCosts = () => {
    const liste = overlay.querySelector('#operating-costs-liste');
    if (!liste) return;
    // Total glissant sur 12 mois, comme la maquette — recalculé sur les VRAIS
    // coûts chargés, jamais un chiffre à part.
    const totalEl = overlay.querySelector('#operating-costs-total');
    if (totalEl) {
      const ilYA365j = addDaysIso(todayIso(), -365);
      const total12mois = operatingCosts
        .filter(c => c.incurred_at && c.incurred_at >= ilYA365j)
        .reduce((s, c) => s + (Number(c.amount) || 0), 0);
      totalEl.textContent = tR('Total cumulé 12 derniers mois : {valeur}', { valeur: formatMontant(total12mois) });
    }
    if (!operatingCosts.length) { liste.textContent = trad('Aucun coût d\'exploitation enregistré pour l\'instant.'); return; }
    liste.innerHTML = `<div class="ref-scroll"><table class="ref-table">
        <thead><tr><th>${trad('Date')}</th><th>${trad('Type')}</th><th>${trad('Montant')}</th><th>${trad('Note')}</th></tr></thead>
        <tbody>${operatingCosts.map(c => `<tr>
            <td class="item-label">${esc(c.incurred_at)}</td>
            <td>${esc(OC_LABELS[c.kind] || c.kind)}</td>
            <td>${formatMontant(c.amount)}</td>
            <td>${c.notes ? esc(c.notes) : '<span class="muted">—</span>'}</td>
          </tr>`).join('')}</tbody>
      </table></div>`;
  };
  // Scorecard TCO : `null` sans prix d'achat renseigné, et la section entière
  // disparaît alors — jamais un calcul affiché sur une base à moitié connue
  // (même garde-fou que vueCompteurSecondaire sans second suivi).
  const renderScorecardTco = () => {
    const section = overlay.querySelector('#tco-scorecard-section');
    if (!section) return;
    const tco = tcoMachine(machine, historyData, operatingCosts);
    if (!tco) { section.remove(); return; }
    const kpi = (label, valeur, unite, alerte) => `
      <div class="fm-kpi-card">
        <span class="fm-kpi-label">${label}</span>
        <div class="fm-kpi-value"><span class="num">${valeur}</span>${unite ? `<span class="unit">${unite}</span>` : ''}${alerte ? ` <span class="pill" style="background:var(--late-bg);color:var(--late-ink);">${trad('Alerte')}</span>` : ''}</div>
      </div>`;
    // Même recommandation « Garder / Remplacer » que jaugeTcoHtml (même
    // fonction réelle : ratioDecisionTco/etatTco/TCO_ETAT_LABEL), présentée
    // en pastille dans l'en-tête plutôt qu'en barre de progression — comme
    // la maquette (« Recommandation KALEA : Garder la machine »).
    const decision = ratioDecisionTco(tco);
    const etat = decision ? etatTco(decision.ratio, decision.base) : null;
    const libelleReco = decision ? (TCO_ETAT_LABEL[decision.base] || TCO_ETAT_LABEL.achat)[etat]() : null;
    section.innerHTML = `
      <div class="fm-card-head">
        <div class="fm-card-title-row">
          <h3 class="fm-card-title">${trad('Scorecard TCO')}</h3>
          ${machine.purchase_price != null && machine.purchase_price !== '' ? `<span class="fm-chip fm-chip-accent">${tR('Prix d\'achat initial : {valeur}', { valeur: formatMontant(machine.purchase_price) })}</span>` : ''}
        </div>
        ${libelleReco ? `<span class="badge ${badgeClass(etat)}">${pictoEtat(etat)}<span>${tR('Recommandation KALEA : {libelle}', { libelle: libelleReco })}</span></span>` : ''}
      </div>
      <div class="fm-kpi-row">
        ${kpi(trad('Coût de revient effectif'), tco.coutParUnite != null ? formatMontant(tco.coutParUnite) : '—', tco.coutParUnite != null ? tR('/ {unite}', { unite: counterShort(counterUnitOf(machine)) }) : '')}
        ${kpi(trad('Dépenses totales cumulées'), formatMontant(tco.parEntretien + tco.parExploitation))}
        ${(() => {
          const vie = partDureeDeVie(machine);
          return vie ? kpi(trad('Durée de vie consommée'), tR('{n} %', { n: vie.pct }), tR('reste {valeur}', { valeur: formatCounter(vie.restant, vie.unite) }), vie.pct >= 90) : '';
        })()}
        ${kpi(trad('Valeur résiduelle estimée'), formatMontant(tco.revente))}
        ${kpi(trad('Ratio entretien / achat'), tco.ratioMaintenanceAchat != null ? tR('{n} %', { n: Math.round(tco.ratioMaintenanceAchat * 100) }) : '—', '', tco.ratioMaintenanceAchat != null && tco.ratioMaintenanceAchat >= 0.5)}
      </div>
    `;
  };
  const nomOperateurTexte = (h) => (h.performed_by && nomsEquipe.has(h.performed_by)) ? nomsEquipe.get(h.performed_by) : '';
  const buildHistoryCsv = () => {
    const header = [trad('Date'), trad('Compteur (h)'), trad('Elements traites'), trad('Operateur'), trad('Remarques')];
    if (tcoActif()) header.push(trad('Cout total'));
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = historyData.map(h => {
      const row = [
        h.performed_at,
        h.hours_at_intervention ?? '',
        Array.isArray(h.items_done) ? h.items_done.join('; ') : '',
        nomOperateurTexte(h),
        h.description ?? '',
      ];
      if (tcoActif()) {
        row.push((h.parts_cost != null || h.labor_cost != null) ? (Number(h.parts_cost) || 0) + (Number(h.labor_cost) || 0) : '');
      }
      return row;
    });
    return [header, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  };

  const csvToUtf16Buffer = (csvString) => {
    const buf = new ArrayBuffer(2 + csvString.length * 2);
    const view = new DataView(buf);
    view.setUint16(0, 0xFEFF, true);
    for (let i = 0; i < csvString.length; i++) {
      view.setUint16(2 + i * 2, csvString.charCodeAt(i), true);
    }
    return buf;
  };

  overlay.querySelector('#export-history-csv').addEventListener('click', () => {
    const blob = new Blob([csvToUtf16Buffer(buildHistoryCsv())], { type: 'text/csv;charset=utf-16le;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historique_${machine.name.replace(/[^a-z0-9]+/gi, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  overlay.querySelector('#share-history-email').addEventListener('click', async () => {
    const filename = `historique_${machine.name.replace(/[^a-z0-9]+/gi, '_')}.csv`;
    const file = new File([csvToUtf16Buffer(buildHistoryCsv())], filename, { type: 'text/csv' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `tR('Historique entretien — {machine}', { machine: machine.name })`, text: `tR('Historique des entretiens pour {machine}', { machine: machine.name })` });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    const subject = encodeURIComponent(`tR('Historique entretien — {machine}', { machine: machine.name })`);
    const bodyLines = historyData.slice(0, 20).map(h => `${h.performed_at} — ${h.hours_at_intervention != null ? h.hours_at_intervention + trad('h') : ''} — ${(h.items_done || []).join(', ')}${nomOperateurTexte(h) ? ' — ' + nomOperateurTexte(h) : ''} — ${h.description || ''}`);
    const body = encodeURIComponent(`tR('Historique des entretiens pour {machine}', { machine: machine.name }) :\n\n${bodyLines.join('\n')}\n\n${trad('(Le fichier CSV complet est disponible via « Exporter en CSV » si tu veux le joindre en pièce jointe.)')}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  });

  // Restaure la position de défilement d'AVANT la fermeture — signalé par
  // l'utilisateur : valider le compteur (rouleaux) ou un choix de fréquence
  // de tâche ferme cette même fiche puis la rouvre pour refléter ce qui
  // vient d'être enregistré, et elle se rouvrait toujours tout en haut,
  // perdant l'endroit où on était. `options.scrollTop` est capturé par
  // l'appelant sur l'ANCIEN overlay, juste avant de le retirer.
  if (options.scrollTop) overlay.scrollTop = options.scrollTop;

  (async () => {
    const section = overlay.querySelector('#history-section');
    if (!section) return;
    const valueEl = section.querySelector('.value');
    try {
      // Historique COMPLET : l'export CSV ne doit jamais être tronqué. L'équipe
      // se charge EN MÊME TEMPS : si elle échoue (hors connexion, etc.), la
      // colonne « Opérateur » reste vide — l'historique lui-même s'affiche
      // quand même, jamais bloqué par un souci qui lui est étranger.
      const [interventions, equipe, coutsExploitation] = await Promise.all([
        fetchAllInterventions(machine.id),
        equipePourAttribution().catch(() => []),
        // La scorecard TCO ne doit pas attendre un second aller-retour : elle
        // se calcule dès que l'historique (déjà nécessaire à l'écran) est là.
        tcoActif() ? fetchOperatingCosts(machine.id).catch(() => []) : Promise.resolve([]),
      ]);
      historyData = interventions;
      nomsEquipe = new Map(equipe.map(m => [m.id, m.nom_affiche]));
      operatingCosts = coutsExploitation;
    } catch (error) {
      if (valueEl) valueEl.textContent = trad('Erreur de chargement de l\'historique :') + " " + error.message;
      return;
    }
    if (!overlay.isConnected || !section.isConnected) return;
    renderOperatingCosts();
    renderScorecardTco();
    if (!historyData.length) { if (valueEl) valueEl.textContent = trad('Aucun entretien enregistré pour l\'instant.'); return; }

    overlay.querySelector('#export-history-csv').disabled = false;
    overlay.querySelector('#share-history-email').disabled = false;
    if (valueEl) valueEl.remove();

    const shown = historyData.slice(0, HISTORY_ROWS_IN_MODAL);
    const hidden = historyData.length - shown.length;
    section.insertAdjacentHTML('beforeend', `
      <div class="ref-scroll"><table class="ref-table">
        <thead><tr><th>${trad('Date')}</th>${isCounterMode ? `<th>${trad('Compteur')}</th>` : ''}<th>${trad('Éléments traités')}</th><th>${trad('Opérateur / Atelier')}</th><th>${trad('Remarques')}</th>${tcoActif() ? `<th>${trad('Coût total')}</th>` : ''}</tr></thead>
        <tbody>
          ${shown.map(h => `
            <tr>
              <td class="item-label">${esc(h.performed_at)}</td>
              ${isCounterMode ? `<td>${h.hours_at_intervention != null ? esc(h.hours_at_intervention) + ' ' + counterShort(unit) : '<span class="muted">—</span>'}</td>` : ''}
              <td>${Array.isArray(h.items_done) && h.items_done.length ? esc(h.items_done.join(', ')) : '<span class="muted">—</span>'}</td>
              <td>${nomOperateurTexte(h) ? esc(nomOperateurTexte(h)) : '<span class="muted">—</span>'}</td>
              <td>${h.description ? esc(h.description) : '<span class="muted">—</span>'}</td>
              ${tcoActif() ? `<td>${(h.parts_cost != null || h.labor_cost != null) ? esc(formatMontant((Number(h.parts_cost) || 0) + (Number(h.labor_cost) || 0))) : '<span class="muted">—</span>'}</td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table></div>
      ${hidden > 0 ? `<div class="hint">tR('{caches} entretien(s) plus ancien(s) non affiché(s) ici — l\'export CSV contient bien les {total} entretiens.', { caches: hidden, total: historyData.length })</div>` : ''}
      <div class="hint">${tR('{n} entretien(s) enregistré(s).', { n: historyData.length })}</div>`);
  })();
}
