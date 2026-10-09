/* KALEA — application (app.html) : Vues Tableau de bord et Parc (machines).
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · Vue : Tableau de bord
 *   · Les machines EN RETARD : UNE SEULE CARTE PAR MACHINE
 *   · LE COMPTEUR DU QUOTIDIEN, SUR LA CARTE DE LA MACHINE
 *   · SUR SMARTPHONE ?
 *   · Vue : Parc (machines)
 */
// ───────────────────────── début du code ─────────────────────────
// ── Vue : Tableau de bord ─────────────────────────────────────
const VIEWS = {};

VIEWS.dashboard = {
  fondBlanc: true,
  title: trad('Tableau de bord'),
  subtitle: () => tR('{societe} · {n} machine(s) suivie(s)', { societe: UI.companyName, n: UI.machines.length }),
  render() {
    const c = UI.counts;
    const alerts = openAlerts();
    const first = alerts[0];
    const retards = tachesEnRetard();
    // « ÉCHÉANCES À VENIR » NE RÉPÈTE PAS LA CARTE DU DESSUS : une machine en
    // retard est déjà nommée en grand, avec sa tâche la plus urgente. La même
    // machine n'apparaît donc qu'UNE fois sur le tableau de bord.
    // ★ LOT 8 — LA LISTE MONTRE TOUTES LES MACHINES SUIVIES, y compris celle que
    // le bandeau sombre porte déjà. Le filtre du lot 5 (« aucune machine ne doit
    // être écrite deux fois ») était TROP STRICT, et le client l'a tranché : le
    // bandeau RÉSUME l'urgence, la liste donne l'ENSEMBLE. Son effet mesuré était
    // double : un écran qui paraissait vide dès que le seul retardataire du parc
    // était dans le bandeau, ET une machine à jour qui n'y figurait pas du tout —
    // elle n'existait que dans un compteur.
    // `openAlerts()` ne change pas de sens pour autant : il reste « ce qui est à
    // TRAITER », et c'est lui qui porte le bandeau prioritaire et ses compteurs.
    // Ce qui reste interdit — le vrai défaut, corrigé au lot 5 — c'est deux
    // CARTES SOMBRES pour la même machine : `prioritiesHtml` n'en affiche qu'une,
    // par machine, et cela ne bouge pas.
    const alertsAVenir = echeancesListe();
    // ★ LOT 6 — QUATRE LIGNES D'EMBLÉE, ET LA LIGNE S'OUVRE SUR PLACE.
    // La maquette de bureau montre quatre échéances ; six lignes plus courtes
    // tenaient mal sous les quatre tuiles. Le dépli est piloté par
    // `UI.alerteOuverte` — un seul état, donc une seule ligne ouverte à la fois.
    const affichees = alertsAVenir.slice(0, 4);
    return `
      <div class="ui-page">
        ${retards.length
          ? prioritiesHtml(retards)
          : (first ? priorityCardHtml(first.machine, first.info) : emptyPriorityCardHtml())}

        <section class="ui-section">
          <div class="ui-grille is-3">
            <div class="ui-tuile is-retard">
              <span class="ui-tuile-etiquette">${trad('En retard')}</span>
              <span class="ui-tuile-valeur">${c.late}<small>${c.late > 1 ? trad('interventions') : trad('intervention')}</small></span>
              <span class="ui-tuile-note">${tR('{n} intervention(s) en retard', { n: c.late })}</span>
            </div>
            <div class="ui-tuile is-bientot">
              <span class="ui-tuile-etiquette">${tR('Sous {n} jours', { n: SOON_DAYS })}</span>
              <span class="ui-tuile-valeur">${c.soon}<small>${trad('à planifier')}</small></span>
              <span class="ui-tuile-note">${tR('{n} machine(s) proche échéance', { n: c.soon })}</span>
            </div>
            <div class="ui-tuile is-ok">
              <span class="ui-tuile-etiquette">${trad('À jour')}</span>
              <span class="ui-tuile-valeur">${c.ok}<small>${c.ok > 1 ? trad('machines') : trad('machine')}</small></span>
              <span class="ui-tuile-note">${UI.machines.length ? tR('{pct}% de la flotte opérationnelle', { pct: Math.round(100 * c.ok / UI.machines.length) }) : trad('Aucune machine suivie')}</span>
            </div>
            <div class="ui-tuile">
              <span class="ui-tuile-etiquette">${trad('Manuels analysés')}</span>
              <span class="ui-tuile-valeur">${c.analysed}<small>${trad('indexés')}</small></span>
              <span class="ui-tuile-note">${tR('{n} manuel(s) numérisé(s) par OCR', { n: c.analysed })}${UI.machines.length ? ` · ${tR('{n} % du parc', { n: Math.round(100 * c.analysed / UI.machines.length) })}` : ''}</span>
            </div>
          </div>
        </section>

        <div class="ui-colonnes">
          <div class="ui-colonne">
            <section class="ui-section">
              ${teteSectionKit('calendrier', trad('Échéances d\'entretien'), '',
                `${affichees.length ? `<span class="ui-tag">${tR('{n} échéance(s) prioritaire(s)', { n: affichees.length })}</span>` : ''}<button type="button" class="ui-btn ui-btn-pastille" data-nav="agenda">${trad('Tout voir')} →</button>`)}
              <div class="ui-section-corps">
                <div id="echeances-zone" class="ui-liste">
                ${affichees.length
                  ? affichees.map(x => chronologieCarteHtml(x.machine, x.info)).join('')
                  : `<div class="ui-aide echeances-vide">${trad('Aucune échéance dans les prochaines semaines.')}</div>`}
                </div>
              </div>
            </section>

            ${preparationResumeHtml()}

            ${aiCardHtml()}
          </div>

          <div class="ui-colonne">
            <section class="ui-section">${dropzoneHtml('dash-drop')}</section>
            ${remindersCardHtml()}
            ${tcoActif() ? tcoDashboardCarteHtml() : ''}
          </div>
        </div>
      </div>
    `;
  },
  mount() {
    const root = document.getElementById('view-root');
    wireReminderSwitches(root);
    // Reprise Stitch : la liste des échéances réutilise chronologieCarteHtml
    // (déjà en prod sur l'Agenda) au lieu de l'accordéon alertRowHtml/
    // monterAlertes — même câblage que l'Agenda, wireChronologie().
    wireChronologie(root);
    wirePreparation(root);
    root.querySelectorAll('[data-nav]').forEach(btn => btn.addEventListener('click', () => goTo(btn.dataset.nav)));
    attachDropzone(root.querySelector('#dash-drop'), (file) => openManualUploadModal(null, file));
    chargerCarteTcoDashboard(root);

    const favourite = openAlerts()[0];
    root.querySelector('#priority-done')?.addEventListener('click', () => {
      if (favourite) openLogInterventionModal(favourite.machine);
    });
    root.querySelector('#priority-details')?.addEventListener('click', () => {
      if (favourite) openPlanView(favourite.machine, UI.companyId, UI.categories);
    });
    root.querySelector('#priority-add')?.addEventListener('click', handleAddMachine);

    // Un bloc par TÂCHE en retard : le bouton retrouve SA machine par identifiant
    // (l'ordre d'affichage ne sert jamais d'indice) et coche d'avance SA tâche,
    // même quand deux blocs portent la même machine.
    const machineDe = (btn) => UI.machines.find(m => m.id === btn.dataset.priorityDone || m.id === btn.dataset.priorityDetails);
    root.querySelectorAll('[data-priority-done]').forEach(btn => btn.addEventListener('click', () => {
      const machine = machineDe(btn);
      if (machine) openLogInterventionModal(machine, btn.dataset.priorityTache || null);
    }));
    root.querySelectorAll('[data-priority-details]').forEach(btn => btn.addEventListener('click', () => {
      const machine = machineDe(btn);
      if (machine) openPlanView(machine, UI.companyId, UI.categories);
    }));

    const cta = root.querySelector('#ai-cta');
    if (cta) cta.addEventListener('click', () => {
      const target = aiTargetMachine();
      if (target) openPlanView(target, UI.companyId, UI.categories);
      else openManualUploadModal();
    });
  },
};

// ── Les machines EN RETARD : UNE SEULE CARTE PAR MACHINE ───────
// La maquette de bureau ne montre QU'UNE carte pour une machine, quelle que soit
// l'urgence de ses tâches. L'écran doit donc choisir : on garde LA PLUS URGENTE
// — le plus grand dépassement, c'est-à-dire la plus petite `sortKey` (négative
// quand l'échéance est dépassée). Les autres tâches ne disparaissent pas : elles
// sont dans le plan, que « Détails » ouvre.
//
// DEUX NATURES DE BLOCS, ET UNE SEULE PAR MACHINE :
//   • « tâche » : une tâche dont l'échéance propre est dépassée — c'est elle qui
//     est retenue dès qu'il y en a une ;
//   • « plan »  : la machine dont l'ÉCHÉANCE GÉNÉRALE est dépassée sans qu'aucune
//     tâche ne le soit (toutes conditionnelles, mensuelles à échéance future…).
//     Ce bloc ne NOMME AUCUNE TÂCHE : coller le dépassement du plan sur un
//     contrôle mensuel affirmerait quelque chose de faux — cas réel « Vehicule du
//     PDG », +1 470 km attribués aux pneumatiques qui n'étaient PAS en retard.
//     Il le dit donc au niveau du plan, et il n'apparaît que si AUCUNE tâche de
//     la machine n'est en retard.
function tachesEnRetard() {
  const entrees = [];
  (UI.machines || []).forEach(machine => {
    // Classement PROJETÉ au rendu : un plan jamais réenregistré est lu comme s'il
    // venait de l'être — même règle que l'enregistrement, rien d'écrit.
    const items = tachesAffichees(machine.plan, machine);
    const suivies = items
      .map(item => ({ item, info: infoTache(item, machine.plan, machine) }))
      .filter(x => x.info.state === 'late')
      // LA PLUS URGENTE DE LA MACHINE, ET UNE SEULE. On classe explicitement par
      // `sortKey` croissante — la plus dépassée d'abord, la même clé que le tri
      // des alertes — puis on ne garde que la première. Aucun ordre implicite :
      // `infoTache` ne trie rien.
      .sort((a, b) => a.info.sortKey - b.info.sortKey);
    if (suivies.length) {
      entrees.push({ machine, item: suivies[0].item, info: suivies[0].info, planEntier: false });
      return;
    }
    const info = dueInfo(machine.plan, machine);
    if (info.state !== 'late') return;
    entrees.push({ machine, item: null, info, planEntier: true });
  });
  // La plus dépassée d'abord, comme le tri des alertes.
  return entrees.sort((a, b) => a.info.sortKey - b.info.sortKey);
}

// Les machines des cartes sombres, par identifiant : la liste « Échéances à
// venir » s'en sert pour ne pas répéter, juste en dessous, ce qui est déjà écrit
// en grand au-dessus.
function machinesEnRetard() {
  return new Set(tachesEnRetard().map(e => e.machine.id));
}

// Un bloc de retard : tâche, machine, compteur et dépassement, puis les deux
// actions. Mêmes classes que la carte prioritaire d'origine, donc même style.
// `data-priority-tache` porte la TÂCHE visée : deux blocs de la même machine
// restent distincts, et « Marquer fait » coche d'avance la bonne ligne. Il reste
// VIDE pour un bloc au niveau du plan — il n'y a aucune tâche à désigner.
// Le relevé qui correspond au suivi dont parle `info` : le SECOND compteur quand l'échéance vient du second suivi, le principal sinon.
// Avant, ces cartes affichaient toujours le compteur principal : une tâche en retard suivie par le second compteur (23 000 km) montrait
// le relevé du principal resté à 1 650 km.
function releveSuiviDe(machine, info) {
  const surSecond = !!(info && info.secondaire) && !!counterUnit2Of(machine);
  return surSecond
    ? { valeur: machineCounter2(machine), unite: counterUnit2Of(machine), second: true }
    : { valeur: machineCounter(machine), unite: counterUnitOf(machine), second: false };
}

function priorityTaskCardHtml(machine, item, info, planEntier) {
  const enCompteur = info.unit === 'hours' || info.unit === 'km';
  const releve = releveSuiviDe(machine, info);
  const depart = enCompteur
    ? formatCounter(releve.valeur, releve.unite)
    : formatShortDate((item && item.due_at) || machine.plan?.next_due_at);
  const titre = planEntier
    ? tR('Échéance générale du plan dépassée de {valeur}', { valeur: info.short })
    : ((item && item.label) ? item.label : nextTaskLabel(machine));
  const tache = planEntier ? '' : titre;
  const mention = planEntier
    ? `<span class="ui-ligne-sous">${trad('Aucune tâche périodique n\'est en retard.')}</span>`
    : '';
  // Le GENRE D'ENGIN vient de la catégorie saisie par le client (jamais d'une
  // marque), et l'ÉCHÉANCE CONTRACTUELLE est la fréquence écrite dans le carnet
  // (« 250 h ») — la même valeur que le tableau de référence du plan.
  const genre = machine.category?.name ? esc(machine.category.name) : '';
  const seuil = (item && item.frequency) ? String(item.frequency).trim() : '';
  const echeance = seuil ? tR('Échéance contractuelle : {valeur}', { valeur: esc(seuil) }) : '';
  return `
    <div class="ui-ligne is-texte-long is-retard">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone is-ambre">${picto('alerte')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(machine.name)}${genre ? `<span class="ui-tag">${genre}</span>` : ''}</span>
          <span class="ui-ligne-sous"><strong>${esc(titre)}</strong></span>
          ${mention}
          ${echeance ? `<span class="ui-ligne-sous">${echeance}</span>` : ''}
        </div>
      </div>
      <div class="ui-chiffres">
        <div class="ui-chiffre"><span class="ui-chiffre-valeur">${esc(depart)}</span></div>
        <div class="ui-chiffre"><span class="ui-chiffre-valeur is-retard">${esc(info.short)}</span></div>
      </div>
      <div class="ui-ligne-action is-etiquettes">
        <button type="button" class="ui-btn ui-btn-pastille" data-priority-done="${esc(machine.id)}" data-priority-tache="${esc(tache)}">${picto('ajuste')}<span>${trad('Marquer fait')}</span></button>
        <button type="button" class="ui-btn ui-btn-teinte" data-priority-details="${esc(machine.id)}" data-priority-tache="${esc(tache)}"><span>${trad('Détails')}</span></button>
      </div>
    </div>`;
}

// Les blocs vont par PAIRES ; un bloc seul sur sa ligne prend toute la largeur.
function prioritiesHtml(retards) {
  return `
    <section class="ui-section">
      ${teteSectionKit('alerte', trad('À traiter en priorité'), '', `<span class="ui-statut is-retard">${trad('EN RETARD')}</span><span class="ui-tag">${retards.length}</span>`)}
      <div class="ui-section-corps">
        <div class="ui-liste">${retards.map(({ machine, item, info, planEntier }) => priorityTaskCardHtml(machine, item, info, planEntier)).join('')}</div>
      </div>
    </section>`;
}

// Reprise Stitch « Tableau de bord » (voir keeva-tco-feature) — même bandeau
// prioritaire, sur le fond signature-en (violet) du mockup au lieu du fond
// sombre précédent : choix confirmé par l'utilisateur (le contraste blanc/
// signature-en mesuré à 5,65:1 reste conforme, seule la teinte change).
// Phrase enrichie ("Échéance à 135 h (Compteur relevé à 130.0 h · 5.0 h
// restant)") construite à partir des MÊMES valeurs que `info`/`machineCounter`
// — aucune donnée nouvelle, juste assemblées en une seule phrase au lieu de
// deux chiffres séparés.
function priorityCardHtml(machine, info) {
  const late = info.state === 'late';
  const isCounterInfo = info.unit === 'hours' || info.unit === 'km';
  const identifiant = identifiantAffiche(machine);
  const secondLabel = late ? trad('de dépassement') : trad('restant');
  const tacheForte = `<strong>${esc(nextTaskLabel(machine))}</strong>`;
  let phrase;
  if (isCounterInfo) {
    const releve = releveSuiviDe(machine, info);
    const nextDue = releve.second ? planNextDueCounter2(machine.plan) : planNextDueCounter(machine.plan);
    const current = releve.valeur;
    phrase = tR('Tâche requise : {tache} · Échéance à {seuil} (Compteur relevé à {actuel} · {delai} {mot})', {
      tache: tacheForte,
      seuil: nextDue != null ? esc(formatCounter(nextDue, info.unit)) : '—',
      actuel: current != null ? esc(formatCounter(current, info.unit)) : '—',
      delai: esc(info.short),
      mot: secondLabel,
    });
  } else {
    phrase = tR('Tâche requise : {tache} · Échéance le {date} ({delai} {mot})', {
      tache: tacheForte,
      date: esc(formatShortDate(machine.plan?.next_due_at)),
      delai: esc(info.short),
      mot: secondLabel,
    });
  }
  return `
    <section class="ui-section">
      ${teteSectionKit('sablier', trad('Prochain entretien'), '', `<span class="ui-statut ${classeEtatKit(info.state)}">${late ? trad('EN RETARD') : trad('BIENTÔT')}</span>`)}
      <div class="ui-section-corps">
        <div class="ui-liste">
          <div class="ui-ligne is-deux ${classeEtatKit(info.state)}">
            <div class="ui-ligne-id">
              <div class="ui-ligne-textes">
                <span class="ui-ligne-nom">${esc(machine.name)}${identifiant ? `<span class="ui-tag">${esc(identifiant)}</span>` : ''}</span>
                <span class="ui-ligne-sous">${phrase}</span>
              </div>
            </div>
            <div class="ui-ligne-action is-etiquettes">
              <button type="button" class="ui-btn ui-btn-pastille" id="priority-done">${picto('ajuste')}<span>${trad('Marquer fait')}</span></button>
              <button type="button" class="ui-btn ui-btn-teinte" id="priority-details"><span>${trad('Détails')}</span></button>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}

function emptyPriorityCardHtml() {
  return `
    <section class="ui-section">
      ${teteSectionKit('sablier', trad('Prochain entretien'), '')}
      <div class="ui-section-corps">
        <div class="ui-encadre is-conseil">
          ${picto('info')}
          <p><strong>${trad('Rien à signaler')}</strong> — ${UI.machines.length ? trad('Aucune échéance dans les prochaines semaines.') : trad('Aucune machine suivie pour l\'instant.')}</p>
        </div>
        <div><button type="button" class="ui-btn ui-btn-plein" id="priority-add">${trad('Ajouter une machine')}</button></div>
      </div>
    </section>`;
}

function aiTargetMachine() {
  const analysed = UI.machines.filter(m => normalizeItems(m.plan?.items).length);
  return analysed[0] || UI.machines.filter(m => m.manual_url)[0] || null;
}

function aiCardHtml() {
  const target = aiTargetMachine();
  if (!target) {
    return `
      <div class="mobile-only">
        <section class="ui-section">
          ${teteSectionKit('carnet', trad('Manuel & carnet'), trad('Aucun carnet déposé. Dépose le PDF du fabricant : notre algorithme en extrait les échéances et propose le plan d\'entretien.'))}
          <div class="ui-section-corps"><div><button type="button" class="ui-btn ui-btn-pastille" id="ai-cta">${trad('Déposer un manuel PDF')}</button></div></div>
        </section>
      </div>`;
  }
  const items = normalizeItems(target.plan?.items);
  return `
    <div class="mobile-only">
      <section class="ui-section">
        ${teteSectionKit('carnet', trad('Manuel analysé'), `${tR('{nom} · carnet d\'entretien', { nom: esc(target.name) })}${items.length ? ` · ${tR('{n} échéance(s) détectée(s)', { n: items.length })}` : ''}`,
          `<span class="ui-statut ${items.length ? 'is-ok' : 'is-bientot'}">${items.length ? trad('PRÊT') : trad('À VALIDER')}</span>`)}
        <div class="ui-section-corps">
          ${items.length ? `<div class="ui-liste">${items.slice(0, 2).map(it => `
            <div class="ui-ligne is-deux">
              <div class="ui-ligne-id"><div class="ui-ligne-textes"><span class="ui-ligne-nom">${esc(it.label || '—')}</span></div></div>
              <div class="ui-ligne-action"><span class="ui-tag">${esc(it.frequency || '—')}</span></div>
            </div>`).join('')}</div>` : ''}
          <div><button type="button" class="ui-btn ui-btn-pastille" id="ai-cta">${trad('Valider le plan →')}</button></div>
        </div>
      </section>
    </div>`;
}

// ── LE COMPTEUR DU QUOTIDIEN, SUR LA CARTE DE LA MACHINE ──────
// POURQUOI ICI : l'application ne vaut que si les compteurs d'heures et de
// kilomètres sont à jour — or il fallait ouvrir la fiche machine pour les saisir.
// Le calendaire, lui, est automatique. Le seul geste vraiment quotidien est donc
// ce relevé, et il se fait là où l'on agit : sur la carte, SOUS les boutons sur
// ordinateur, SOUS la photo sur téléphone.
//
// DEUX EMPLACEMENTS, UN SEUL VISIBLE : la feuille de style montre l'un ou l'autre
// selon la largeur. Un seul nœud ne peut pas être à la fois dans la colonne des
// boutons (bureau) et sous la photo (téléphone) sans être déplacé dans le DOM au
// redimensionnement — ce qui serait fragile et invisible pour un test.
const CLE_COMPTEURS_ATTENTE = 'keeva.compteurs-en-attente.v1';

function compteursEnAttente() {
  try {
    const liste = JSON.parse(localStorage.getItem(CLE_COMPTEURS_ATTENTE) || '[]');
    return Array.isArray(liste) ? liste : [];
  } catch (err) {
    return [];
  }
}

function compteurEnAttenteDe(machineId) {
  const item = compteursEnAttente().find((x) => x && x.id === machineId);
  return item ? item.valeur : null;
}

// On garde UNE valeur par machine : la dernière saisie remplace la précédente.
function retenirCompteurEnAttente(machine, valeur) {
  const liste = compteursEnAttente().filter((x) => x && x.id !== machine.id);
  liste.push({ id: machine.id, valeur, unite: counterUnitOf(machine), quand: Date.now() });
  try { localStorage.setItem(CLE_COMPTEURS_ATTENTE, JSON.stringify(liste)); } catch (err) { /* stockage plein : la valeur reste à l'écran */ }
}

// La copie hors connexion suit la saisie : un rechargement sans réseau doit
// afficher la valeur relevée, pas l'ancienne. On CONSERVE `savedAt` : la copie
// n'est pas plus fraîche qu'avant, et le bandeau doit continuer de dire son âge.
function majCacheCompteur(machine) {
  if (typeof lireCache !== 'function' || typeof copieHorsLigneActive !== 'function') return;
  if (!copieHorsLigneActive()) return;
  const cache = lireCache();
  if (!cache) return;
  const cible = (cache.machines || []).find((m) => m && m.id === machine.id);
  if (!cible) return;
  Object.assign(cible, machineCounterPatch(machineCounter(machine), machine));
  try { localStorage.setItem(CACHE_CLE, JSON.stringify({ ...cache, schema: { ...SCHEMA } })); } catch (err) { /* confort */ }
}

// LE RELEVÉ EST ENREGISTRÉ MÊME HORS CONNEXION. Il part en base quand le réseau
// est là ; sinon il est mis en attente sur l'appareil, l'écran montre tout de
// suite la nouvelle valeur et le nouvel état, et l'envoi se fait au retour du
// réseau (ou à la prochaine ouverture du parc). Une valeur n'est jamais perdue
// en silence, et rien n'est annoncé comme envoyé avant de l'être.
async function envoyerCompteurEnAttente(machine, valeur) {
  const patch = machineCounterPatch(valeur, machine || { counter_unit: 'hours' });
  try {
    const { error } = await sb.from('machines').update(patch).eq('id', machine ? machine.id : null);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    if (typeof estErreurReseau === 'function' && estErreurReseau(err)) {
      retenirCompteurEnAttente(machine || { id: null, counter_unit: 'hours' }, valeur);
      return { ok: false, horsLigne: true };
    }
    return { ok: false, message: (err && err.message) || trad('erreur') };
  }
}

async function viderCompteursEnAttente() {
  const liste = compteursEnAttente();
  if (!liste.length) return 0;
  const restants = [];
  let envoyes = 0;
  for (const item of liste) {
    if (!item || !item.id) continue;
    const machine = UI.machines.find((m) => m.id === item.id) || { id: item.id, counter_unit: item.unite };
    const resultat = await envoyerCompteurEnAttente(machine, item.valeur);
    if (resultat.ok) { envoyes++; continue; }
    // Un refus RÉEL (règle d'accès, colonne absente) ne doit pas boucler sans fin :
    // on le signale, et la valeur reste à l'écran (elle est dans l'état local).
    if (resultat.horsLigne) restants.push(item);
    else console.warn('Compteur en attente refusé :', resultat.message);
  }
  try { localStorage.setItem(CLE_COMPTEURS_ATTENTE, JSON.stringify(restants)); } catch (err) { /* sans conséquence */ }
  return envoyes;
}

// L'ÉTAT D'ABORD, L'ENVOI ENSUITE. Le client voit immédiatement la nouvelle
// échéance — un compteur mis à jour qui laisserait l'ancien statut à l'écran
// serait pire que pas de champ du tout.
async function enregistrerCompteur(machine, valeurBrute) {
  if (!machine) return false;
  if (typeof refuserSiNonCouverte === 'function' && refuserSiNonCouverte(machine)) return false;
  // nombreDepuisTexte (pas Number+replace) : le champ desktop affiche
  // désormais un séparateur de milliers en kilométrique (stepper tactile
  // Stitch), "300 000" doit se lire correctement, pas juste "300 000" → NaN.
  const valeur = nombreDepuisTexte(valeurBrute);
  if (valeur == null) { annoncerCompteur(machine.id, trad('Saisis un relevé.'), 'late'); return false; }
  if (valeur < 0) {
    annoncerCompteur(machine.id, trad('Relevé invalide : un nombre positif est attendu.'), 'late');
    return false;
  }
  const avant = machineCounter(machine);
  Object.assign(machine, machineCounterPatch(valeur, machine));
  majCacheCompteur(machine);
  const resultat = await envoyerCompteurEnAttente(machine, valeur);
  if (!resultat.ok && !resultat.horsLigne) {
    // Refus réel : on remet la valeur d'avant plutôt que d'afficher une valeur
    // qui n'existe nulle part.
    Object.assign(machine, machineCounterPatch(avant, machine));
    majCacheCompteur(machine);
    renderApp();
    annoncerCompteur(machine.id, tR('Enregistrement impossible ({erreur}).', { erreur: resultat.message }), 'late');
    return false;
  }
  renderApp();
  annoncerCompteur(machine.id, resultat.horsLigne
    ? trad('Relevé enregistré sur l\'appareil : il partira au retour du réseau.')
    : trad('Relevé enregistré.'), resultat.horsLigne ? '' : 'ok');
  return true;
}

// SECOND COMPTEUR : même idée que enregistrerCompteur (l'écran montre la nouvelle valeur tout de suite), mais SANS
// file d'attente hors connexion — c'est un relevé rare, et un envoi différé pourrait écraser un relevé plus récent.
// Hors connexion ou refus : la valeur d'avant revient et le client en est prévenu (jamais d'échec silencieux).
async function enregistrerCompteur2(machine, valeurBrute) {
  if (!machine) return false;
  if (typeof refuserSiNonCouverte === 'function' && refuserSiNonCouverte(machine)) return false;
  const unite2 = counterUnit2Of(machine);
  if (!unite2) return false;
  const valeur = nombreDepuisTexte(valeurBrute);
  if (valeur == null || valeur < 0) { showToast(trad('Relevé invalide : un nombre positif est attendu.')); return false; }
  const avant = machine.counter_value_2;
  machine.counter_value_2 = valeur;
  let echec = null;
  try {
    const { error } = await sb.from('machines').update({ counter_value_2: valeur }).eq('id', machine.id);
    if (error) throw error;
  } catch (err) {
    echec = err;
  }
  if (echec) {
    machine.counter_value_2 = avant;
    renderApp();
    showToast(estErreurReseau(echec)
      ? trad('Pas de connexion : le relevé n\'a pas été enregistré. Réessaie quand le réseau est de retour.')
      : tR('Enregistrement impossible ({erreur}).', { erreur: (echec && echec.message) || trad('erreur') }));
    return false;
  }
  majCacheCompteur2(machine);
  renderApp();
  showToast(trad('Relevé enregistré.'));
  return true;
}
// La copie hors connexion suit la saisie (même raison que majCacheCompteur).
function majCacheCompteur2(machine) {
  if (typeof lireCache !== 'function' || typeof copieHorsLigneActive !== 'function') return;
  if (!copieHorsLigneActive()) return;
  const cache = lireCache();
  if (!cache) return;
  const cible = (cache.machines || []).find((m) => m && m.id === machine.id);
  if (!cible) return;
  cible.counter_value_2 = machine.counter_value_2;
  try { localStorage.setItem(CACHE_CLE, JSON.stringify({ ...cache, schema: { ...SCHEMA } })); } catch (err) { /* confort */ }
}

// Le message est posé APRÈS le rendu : re-rendre remplace le DOM, et un message
// écrit avant disparaîtrait aussitôt.
function annoncerCompteur(machineId, texte, ton) {
  const cible = String(machineId);
  document.querySelectorAll('.compteur').forEach((bloc) => {
    if (bloc.dataset.compteur !== cible) return;
    const note = bloc.querySelector('.compteur-note');
    if (!note) return;
    note.textContent = texte || '';
    note.classList.remove('is-ok', 'is-late');
    if (ton === 'ok') note.classList.add('is-ok');
    if (ton === 'late') note.classList.add('is-late');
  });
}

// ── SUR SMARTPHONE ? ───────────────────────────────────────────────────
// Utilisé pour décider quelle variante du compteur compact afficher sur le
// bandeau du Parc (emplacement 'strip', qui n'a pas de séparation CSS
// bureau/mobile comme la fiche machine). Même détection que celle qui
// servait autrefois à choisir « appareil photo » vs « galerie » :
//   · l'application Android (Capacitor natif) est toujours « téléphone » ;
//   · dans un navigateur, sous 900 px — la MÊME frontière que celle qui
//     fait apparaître la barre d'onglets (styles.css) et que
//     .compteur-mobile/.compteur-bureau sur la fiche machine.
function environnementTelephone() {
  try {
    const cap = typeof window !== 'undefined' ? window.Capacitor : null;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
  } catch (err) { /* on retombe sur la largeur */ }
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 899px)').matches;
  } catch (err) {
    return false;
  }
}

// Un bloc de compteur. `emplacement` vaut 'bureau' (fiche machine, large
// écran), 'mobile' (fiche machine, téléphone) ou 'strip' (bandeau du Parc).
function compteurHtml(m, emplacement, libelle, libelleBouton) {
  const id = esc(m.id);
  const enCompteur = planIsCounter(m.plan);
  if (!enCompteur) {
    // CALENDAIRE : c'est une information, pas une saisie. On affiche la date du
    // jour, en lecture seule : le suivi calendaire n'a pas de compteur à relever.
    return `
      <div class="compteur compteur-${emplacement} compteur-jour" data-compteur="${id}">
        <span class="compteur-titre" id="compteur-titre-${emplacement}-${id}">${trad('Date du jour')}</span>
        <span class="compteur-jour-valeur" aria-labelledby="compteur-titre-${emplacement}-${id}">${esc(formatLongDate(todayIso()))}</span>
        <span class="compteur-note">${trad('Suivi calendaire : rien à relever.')}</span>
      </div>`;
  }
  const unite = counterUnitOf(m);
  const u = COUNTER_UNITS[unite] || COUNTER_UNITS.hours;
  const valeur = machineCounter(m);
  const attente = compteurEnAttenteDe(m.id);
  const champId = `compteur-${emplacement}-${id}`;
  const montre = attente != null ? attente : valeur;
  // ★ MACHINE NON COUVERTE PAR L'OFFRE : on NE montre PAS un champ modifiable.
  //   L'écriture est refusée (refuserSiNonCouverte, comme partout ailleurs) — mais
  //   un champ qui a l'air modifiable et qui n'enregistre rien est exactement le
  //   piège à éviter : le client tape son relevé, rien ne se passe, et il ne sait
  //   pas pourquoi. On affiche donc la valeur en LECTURE SEULE et la raison.
  if (typeof machineCouverte === 'function' && !machineCouverte(m)) {
    return `
      <div class="compteur compteur-${emplacement} compteur-lecture" data-compteur="${id}">
        <span class="compteur-titre">${trad('Compteur')}</span>
        <span class="compteur-jour-valeur">${esc(valeur == null ? '—' : formatCounter(valeur, unite))}</span>
        <span class="compteur-note">${trad('Non couverte par ton offre : le relevé n\'est pas enregistré.')}</span>
      </div>`;
  }
  // MOBILE (fiche machine) ET STRIP SUR TÉLÉPHONE (bandeau du Parc) :
  // ★ CARTE COMPTEUR FUSIONNÉE — reprise Stitch « stitch_refonte_zone_
  // change_ticketing (2) », 6e passe. Remplace l'ancien .compteur-apparent
  // (texte blanc translucide — lisible sur la carte SOMBRE de la fiche
  // machine, mais devenu illisible une fois le même widget posé sur le fond
  // CLAIR de la carte du Parc, signalé par l'utilisateur avec capture à
  // l'appui) ET fusionne dans la MÊME carte ce que .mstrip-jauge / la jauge
  // détaillée de la fiche affichaient juste à côté (échéance, delta, état) —
  // un seul bloc, comme la maquette, plutôt que deux qui répètent la même
  // information (voir .desktop-only sur .mstrip-jauge / .phc-desktop : ces
  // éléments restent affichés tels quels sur ordinateur, où le compteur
  // garde sa simple saisie clavier sans badge ni jauge). AUCUNE DONNÉE
  // NOUVELLE : mêmes fonctions déjà utilisées ailleurs (infoMachine,
  // pourcentageIntervalle, deltaTexteDe, echeanceTexteDe, etatNoteTexte).
  // Un tap ouvre les rouleaux (ouvrirRouleauxCompteur, câblée au document),
  // qui enregistrent directement au clic sur « Valider le relevé ». Aucun
  // <input> ici — volontairement : la version précédente (roue tactile sur
  // un vrai <input>) avait un défaut résiduel de sélection de texte native
  // malgré toutes les protections CSS/JS ; un <span>/<button> n'a tout
  // simplement rien à sélectionner ni à focaliser, donc rien à supprimer.
  if (emplacement === 'mobile' || (emplacement === 'strip' && environnementTelephone())) {
    const info = infoMachine(m);
    const etat = info.state === 'late' ? 'late' : (info.state === 'soon' ? 'soon' : 'ok');
    const part = pourcentageIntervalle(info, m);
    const delta = deltaTexteDe(info);
    const note = etatNoteTexte(info.state);
    const carteEtat = part != null ? `
      <span class="compteur-carte-piste" aria-hidden="true"><span class="compteur-carte-part is-${etat}" style="width:${part}%"></span></span>
      <div class="compteur-carte-echeance">
        <span>${tR('Échéance requise : {valeur}', { valeur: esc(echeanceTexteDe(info, m)) })}</span>
        ${delta ? `<span class="compteur-carte-delta is-${etat}">${esc(delta)}${info.state === 'late' ? ' ' + trad('de retard') : ''}</span>` : ''}
      </div>` : (info.short ? `<span class="compteur-carte-echeance"><span>${esc(info.short)}</span></span>` : '');
    return `
    <div class="compteur compteur-${emplacement} compteur-carte" data-compteur="${id}" data-unite="${esc(u.short)}">
      <button type="button" id="${champId}" class="compteur-carte-tap" data-tactile-cible data-valeur="${montre == null ? '' : esc(montre)}" aria-label="${esc(tR('Relevé du compteur de {machine} — toucher pour ajuster', { machine: m.name }))}">
        <span class="compteur-carte-tete">
          <span class="compteur-carte-mot">${picto('compteur')}${esc(u.label)}</span>
          <span class="compteur-carte-ajuster">${picto('crayon')}${trad('Ajuster')}</span>
        </span>
        <span class="compteur-carte-ligne">
          <span class="compteur-carte-valeur-bloc"><span class="compteur-carte-valeur" data-tactile-valeur>${esc(formatCounterNombre(montre, unite))}</span><span class="compteur-carte-unite">${esc(u.short)}</span></span>
          ${note ? `<span class="compteur-carte-badge is-${etat}">${esc(note)}</span>` : ''}
        </span>
      </button>
      ${carteEtat}
      <span class="compteur-note${attente != null ? ' is-late' : ''}" role="status">${attente != null ? trad('En attente d\'envoi') : ''}</span>${telemetrieBadgeHtml(m)}
    </div>`;
  }
  // BUREAU (fiche machine ET bandeau du Parc sur grand écran) : stepper
  // tactile -/+ — reprise Stitch « composant horamètre — option 2 : segmenté
  // tactile » (3 fichiers fournis par l'utilisateur : horamètre/km/
  // calendaire — ce dernier reste .compteur-jour plus haut, sans stepper,
  // fidèle à l'export Stitch qui ne lui donne ni -/+ ni OK). type="text"
  // inputmode="decimal" (pas type=number) : le kilométrique affiche un
  // séparateur de milliers au repos (activerSeparateurMilliers, voir
  // wireMachineCards) — un <input type=number> refuse tout caractère qui
  // n'est pas un chiffre, donc refuserait l'espace du séparateur.
  if (emplacement === 'strip') {
    return `
    <div class="compteur compteur-${emplacement}" data-compteur="${id}" data-unite="${esc(u.short)}">
      <span class="compteur-titre">${picto('compteur')}${esc(u.label)}</span>
      <div class="compteur-strip-ligne">
        <div class="compteur-strip-saisie">
          <button type="button" class="compteur-strip-pas is-moins" data-compteur-moins aria-label="${esc(trad('Diminuer'))}">−</button>
          <div class="compteur-strip-valeur-bloc">
            <input id="${champId}" class="compteur-champ" type="text" inputmode="decimal"${unite === 'km' ? ' data-milliers' : ''}
              value="${montre == null ? '' : esc(montre)}" placeholder="—"
              aria-label="${esc(tR('Relevé du compteur de {machine}', { machine: m.name }))}">
            <span class="compteur-strip-unite" aria-hidden="true">${esc(u.short)}</span>
          </div>
          <button type="button" class="compteur-strip-pas is-plus" data-compteur-plus aria-label="${esc(trad('Augmenter'))}">+</button>
        </div>
        <button type="button" class="compteur-strip-icone is-valider" data-compteur-enregistrer="${id}" title="${esc(trad(libelleBouton || 'Enregistrer'))}" aria-label="${esc(trad(libelleBouton || 'Enregistrer'))}">${picto('coche')}<span>${trad('OK')}</span></button>
      </div>
      <span class="compteur-note${attente != null ? ' is-late' : ''}" role="status">${attente != null ? trad('En attente d\'envoi') : ''}</span>${telemetrieBadgeHtml(m)}
    </div>`;
  }
  return `
    <div class="compteur compteur-${emplacement}" data-compteur="${id}" data-unite="${esc(u.short)}">
      <label class="compteur-titre" for="${champId}">${picto('compteur')}${trad(libelle || 'Compteur')}</label>
      <div class="compteur-saisie">
        <input id="${champId}" class="compteur-champ" type="number" inputmode="decimal" min="0" step="${esc(u.step)}"
          value="${montre == null ? '' : esc(montre)}" placeholder="—"
          aria-label="${esc(tR('Relevé du compteur de {machine}', { machine: m.name }))}">
        <span class="compteur-unite" aria-hidden="true">${esc(u.short)}</span>
        <button type="button" class="compteur-enregistrer" data-compteur-enregistrer="${id}">${trad(libelleBouton || 'Enregistrer')}</button>
      </div>
      <span class="compteur-note${attente != null ? ' is-late' : ''}" role="status">${attente != null ? trad('En attente d\'envoi') : ''}</span>${telemetrieBadgeHtml(m)}
    </div>`;
}

// Le SECOND compteur (voir SCHEMA.hasCounter2) : UNE ligne « 2nd compteur … 23 000 km ✎ ». Un tap ouvre les mêmes
// rouleaux que le premier compteur (ouvrirRouleauxCompteur) ; l'enregistrement passe par enregistrerCompteur2.
// Il se met aussi à jour via « Enregistrer un entretien » (openLogInterventionModal), qui écrit counter_value_2.
// Ne s'affiche que si la machine a réellement ce suivi. Une machine non couverte par l'offre reste en lecture seule.
function compteur2Html(m, emplacement) {
  const unite2 = counterUnit2Of(m);
  if (!unite2) return '';
  const id = esc(m.id);
  const u2 = COUNTER_UNITS[unite2] || COUNTER_UNITS.hours;
  const valeur2 = machineCounter2(m);
  const texteValeur = esc(valeur2 == null ? '—' : formatCounter(valeur2, unite2));
  const modifiable = typeof machineCouverte !== 'function' || machineCouverte(m);
  if (!modifiable) {
    return `
    <div class="compteur compteur-${emplacement} compteur-lecture compteur-secondaire compteur2-ligne" data-compteur2="${id}">
      <span class="compteur2-lib">${trad('2nd compteur')}</span>
      <span class="compteur2-val">${texteValeur}</span>
    </div>`;
  }
  return `
    <div class="compteur compteur-${emplacement} compteur-secondaire" data-compteur2="${id}">
      <button type="button" class="compteur2-ligne" data-tactile-cible-2 data-valeur="${valeur2 == null ? '' : esc(valeur2)}" aria-label="${esc(tR('Relevé du second compteur de {machine} — toucher pour ajuster', { machine: m.name }))}">
        <span class="compteur2-lib">${picto('compteur')}${trad('2nd compteur')}</span>
        <span class="compteur2-val">${texteValeur}</span>
        <span class="compteur2-edit" aria-hidden="true">${picto('crayon')}</span>
      </button>
    </div>`;
}

// Configuration des rouleaux par unité — reprise Stitch : compteur_pur_3_
// roulettes_bleu_orange_keeva_mobile (heures, 3 rouleaux 00-99) +
// compteur_odom_tre_kilom_trique_2_roulettes_000_999_keeva_mobile (km, 2
// rouleaux 000-999). Les rouleaux n'éditent QUE la partie ENTIÈRE : le km
// n'a pas de décimale (COUNTER_UNITS.km.step=1), et pour les heures
// (step=0,1) la décimale réelle du relevé est préservée telle quelle par
// initCompteurRouleaux, jamais éditée ni perdue — ni la maquette « heures »
// ni la maquette « km » ne montrent de virgule.
function configRouleauxCompteur(unite) {
  return unite === 'km'
    ? { nbRouleaux: 2, chiffres: 3, max: 999 }
    : { nbRouleaux: 3, chiffres: 2, max: 99 };
}
// Éclate un entier positif en indices de rouleaux (le plus significatif en
// premier), plafonné à ce que le nombre de rouleaux peut représenter
// (999999 dans les deux configs — largement au-delà de tout relevé réel).
function entierVersRouleaux(entier, config) {
  const base = config.max + 1;
  const maxTotal = Math.pow(base, config.nbRouleaux) - 1;
  let v = Math.max(0, Math.min(maxTotal, Math.round(entier)));
  const indices = new Array(config.nbRouleaux).fill(0);
  for (let i = config.nbRouleaux - 1; i >= 0; i--) {
    indices[i] = v % base;
    v = Math.floor(v / base);
  }
  return indices;
}
function rouleauxVersEntier(indices, config) {
  const base = config.max + 1;
  return indices.reduce((acc, v) => acc * base + v, 0);
}
// Les `max+1` lignes d'un rouleau (00 à 99, ou 000 à 999).
function rouleauChiffresHtml(config) {
  let s = '';
  for (let i = 0; i <= config.max; i++) {
    s += `<div class="compteur-rouleau-chiffre" data-valeur="${i}">${String(i).padStart(config.chiffres, '0')}</div>`;
  }
  return s;
}

// Ouvre les rouleaux plein écran pour AJUSTER le relevé d'une machine
// (reprise Stitch, 5e passe, voir le bloc CSS ★ RELEVÉ DE COMPTEUR).
// Appelée par le câblage délégué au document (voir plus bas, [data-
// tactile-cible]) — jamais directement sur un <input> : le compteur
// compact est un <button>, rien à focaliser ni à sélectionner, donc rien
// du défaut de sélection de texte natif de la roue de la passe
// précédente. Positionnée par défaut sur le VRAI relevé actuel ; chaque
// rouleau se glisse INDÉPENDAMMENT à la verticale (pointer events +
// capture PAR rouleau — glisser l'un ne touche jamais les autres, demande
// explicite de l'utilisateur) ; « Valider le relevé » enregistre
// directement (enregistrerCompteur, la même fonction que le bouton
// Enregistrer de la version bureau, mêmes garde-fous) puis appelle
// `refraichir()`, fourni par l'appelant — la fiche machine et le bandeau
// du Parc n'ont pas le même geste de rafraîchissement.
function ouvrirRouleauxCompteur(cible, unite, machine, refraichir, options) {
  const opts = options || {};
  const u = COUNTER_UNITS[unite] || COUNTER_UNITS.hours;
  const config = configRouleauxCompteur(unite);
  const ITEM_HEIGHT = 44;
  const VISIBLE_OFFSET = 2; // 5 lignes visibles par rouleau, la 3e est centrale

  const vibrer = () => { if (navigator.vibrate) { try { navigator.vibrate(10); } catch (err) { /* sans conséquence */ } } };

  {
    const valeurBrute = parseFloat(cible.dataset.valeur) || 0;
    const partieEntiere = Math.floor(valeurBrute);
    const decimale = unite === 'km' ? 0 : Math.round((valeurBrute - partieEntiere) * 10) / 10;
    const indices = entierVersRouleaux(partieEntiere, config);
    let rouleauActif = config.nbRouleaux - 1; // dernier rouleau par défaut, comme les 2 maquettes

    const formaterAffichage = () => {
      const entierAffiche = rouleauxVersEntier(indices, config);
      const val = unite === 'km' ? entierAffiche : Math.round((entierAffiche + decimale) * 10) / 10;
      return formatCounter(val, unite);
    };

    const overlay = document.createElement('div');
    overlay.className = 'compteur-rouleaux-overlay';
    const etiquettes = unite === 'km' ? [trad('Milliers'), trad('Unités')] : [trad('Centaines'), trad('Dizaines'), trad('Unités')];

    overlay.innerHTML = `<div class="compteur-rouleaux-tete">
        <button type="button" class="compteur-rouleaux-fermer" id="rouleaux-fermer" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
        <div class="compteur-rouleaux-titre-bloc"><h2>${trad('Relevé de compteur')}</h2><p>${esc((machine.name || '') + (opts.sousTitre ? ' — ' + opts.sousTitre : ''))}</p></div>
        <span style="width:44px;flex:0 0 auto;" aria-hidden="true"></span>
      </div>
      <div class="compteur-rouleaux-corps">
        <div class="compteur-rouleaux-index">
          <span class="compteur-rouleaux-index-badge"><span class="dot"></span>${trad('Index actuel')}</span>
          <div class="compteur-rouleaux-index-valeur"><span id="rouleaux-affichage">${esc(formaterAffichage())}</span></div>
          <span class="compteur-rouleaux-index-sous">${unite === 'km' ? trad('Kilométrage total') : trad('Heures de fonctionnement moteur')}</span>
        </div>
        <div class="compteur-rouleaux-module">
          <div class="compteur-rouleaux-tambours" id="rouleaux-tambours">
            <div class="compteur-rouleaux-bande"></div>
            ${indices.map((v, i) => `
              <div class="compteur-rouleau">
                <div class="compteur-rouleau-vue" data-rouleau="${i}">
                  <div class="compteur-rouleau-ombre-haut"></div>
                  <div class="compteur-rouleau-bande" id="rouleaux-bande-${i}">${rouleauChiffresHtml(config)}</div>
                  <div class="compteur-rouleau-ombre-bas"></div>
                </div>
                <span class="compteur-rouleau-etiquette">${esc(etiquettes[i])}</span>
              </div>`).join('')}
            <div class="compteur-rouleaux-loupe" id="rouleaux-loupe">
              <span class="compteur-rouleaux-loupe-valeur" id="rouleaux-loupe-valeur">${String(indices[rouleauActif]).padStart(config.chiffres, '0')}</span>
              <span class="compteur-rouleaux-loupe-mot">${trad('Sélection')}</span>
            </div>
          </div>
          <div class="compteur-rouleaux-astuce">${picto('rafraichir')}<span>${tR('Faites glisser les rouleaux de {min} à {max}', { min: '0'.padStart(config.chiffres, '0'), max: String(config.max) })}</span></div>
        </div>
      </div>
      <div class="compteur-rouleaux-pied">
        <button type="button" class="primary compteur-rouleaux-valider" id="rouleaux-valider"><span>${trad('Valider le relevé')}</span></button>
      </div>`;
    document.body.appendChild(overlay);

    const affichage = overlay.querySelector('#rouleaux-affichage');
    const loupe = overlay.querySelector('#rouleaux-loupe');
    const loupeValeur = overlay.querySelector('#rouleaux-loupe-valeur');
    const positionsLoupe = config.nbRouleaux === 2 ? ['26%', '74%'] : ['18%', '50%', '82%'];

    const majLoupe = (idx) => {
      rouleauActif = idx;
      loupe.style.left = positionsLoupe[idx];
      loupeValeur.textContent = String(indices[idx]).padStart(config.chiffres, '0');
    };
    const majBande = (idx, animer) => {
      const bande = overlay.querySelector(`#rouleaux-bande-${idx}`);
      bande.style.transition = animer ? 'transform .18s cubic-bezier(.2,.9,.3,1)' : 'none';
      bande.style.transform = `translateY(${(VISIBLE_OFFSET - indices[idx]) * ITEM_HEIGHT}px)`;
      bande.querySelectorAll('.compteur-rouleau-chiffre').forEach((el, i) => el.classList.toggle('is-central', i === indices[idx]));
    };
    const fixerIndex = (idx, valeur, animer) => {
      indices[idx] = Math.max(0, Math.min(config.max, valeur));
      majBande(idx, animer);
      majLoupe(idx);
      affichage.textContent = formaterAffichage();
    };
    indices.forEach((_, i) => majBande(i, false));
    majLoupe(rouleauActif);

    // Chaque rouleau capture SON PROPRE pointeur.
    overlay.querySelectorAll('.compteur-rouleau-vue').forEach((vue) => {
      const idx = Number(vue.dataset.rouleau);
      let enCours = false, yDepart = 0, indexDepart = 0, dernierVibre = 0;
      vue.addEventListener('pointerdown', (e) => {
        enCours = true; yDepart = e.clientY; indexDepart = indices[idx]; dernierVibre = indexDepart;
        majLoupe(idx);
        try { vue.setPointerCapture(e.pointerId); } catch (err) { /* sans conséquence */ }
        vibrer();
      });
      vue.addEventListener('pointermove', (e) => {
        if (!enCours) return;
        e.preventDefault();
        const cibleIdx = Math.max(0, Math.min(config.max, indexDepart - Math.round((e.clientY - yDepart) / ITEM_HEIGHT)));
        if (cibleIdx !== indices[idx]) {
          fixerIndex(idx, cibleIdx, false);
          if (cibleIdx !== dernierVibre) { vibrer(); dernierVibre = cibleIdx; }
        }
      });
      const relacher = (e) => {
        if (!enCours) return;
        enCours = false;
        try { vue.releasePointerCapture(e.pointerId); } catch (err) { /* sans conséquence */ }
        majBande(idx, true);
      };
      vue.addEventListener('pointerup', relacher);
      vue.addEventListener('pointercancel', relacher);
      vue.addEventListener('contextmenu', (e) => e.preventDefault());
      // Tap en haut/bas du rouleau (hors glissement) : ±1 cran.
      vue.addEventListener('click', (e) => {
        const rect = vue.getBoundingClientRect();
        const y = e.clientY - rect.top;
        if (y < rect.height / 2 - 24) { fixerIndex(idx, indices[idx] - 1, true); vibrer(); }
        else if (y > rect.height / 2 + 24) { fixerIndex(idx, indices[idx] + 1, true); vibrer(); }
      });
    });

    overlay.querySelector('#rouleaux-fermer').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#rouleaux-valider').addEventListener('click', () => {
      const entierFinal = rouleauxVersEntier(indices, config);
      const valeurFinale = unite === 'km' ? entierFinal : Math.round((entierFinal + decimale) * 10) / 10;
      overlay.remove();
      (opts.enregistrer || ((v) => enregistrerCompteur(machine, v)))(String(valeurFinale)).then(() => refraichir());
    });
  }
}

// Au retour du réseau, ce qui attend part tout seul.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('online', () => { viderCompteursEnAttente(); });
}

// LE CÂBLAGE EST DÉLÉGUÉ AU DOCUMENT, ET C'EST VOULU : la liste du parc est
// réaffichée à chaque filtre, tri, recherche ou « voir plus ». Un branchement
// posé à l'ouverture de la vue serait perdu dès le premier re-rendu, et le champ
// cesserait silencieusement de fonctionner. Ici, un seul écouteur couvre toutes
// les cartes, présentes et à venir.
function compteurMachineVisee(noeud, genre) {
  if (!noeud || !noeud.closest) return null;
  let ref = null;
  if (genre === 'bouton') {
    const bouton = noeud.closest('[data-compteur-enregistrer]');
    ref = bouton && bouton.dataset.compteurEnregistrer;
  } else {
    const bloc = noeud.closest('.compteur');
    ref = bloc && bloc.dataset.compteur;
  }
  return ref ? (UI.machines.find((m) => m.id === ref) || null) : null;
}

// Les boutons -/+ du stepper tactile (compteurHtml, branche 'strip') : un tap
// = ±1 unité entière, jamais le pas fin u.step (pensé pour le spinner natif
// du <input type=number> qu'on n'utilise plus ici). C'est aussi le
// comportement des 2 fichiers Stitch fournis (script identique sur les
// variantes horamètre/km : val±1, sans décimale).
function ajusterCompteurChamp(champ, unite, sens) {
  if (!champ) return;
  const actuel = nombreDepuisTexte(champ.value) ?? 0;
  let val = actuel + sens;
  if (val < 0) val = 0;
  val = unite === 'km' ? Math.round(val) : Math.round(val * 10) / 10;
  champ.value = unite === 'km' ? texteAvecSeparateurs(val) : String(val);
}

if (typeof document !== 'undefined' && document.addEventListener) {
  // Le bouton « Enregistrer » de chaque carte.
  document.addEventListener('click', (e) => {
    const bouton = e.target && e.target.closest ? e.target.closest('[data-compteur-enregistrer]') : null;
    if (!bouton) return;
    const machine = compteurMachineVisee(bouton, 'bouton');
    if (!machine) return;
    const bloc = bouton.closest('.compteur');
    const champ = bloc ? bloc.querySelector('.compteur-champ') : null;
    enregistrerCompteur(machine, champ ? champ.value : '');
  });
  // Les boutons -/+ du stepper : même délégation, pour survivre aux
  // re-rendus de la liste (refreshFleetList).
  document.addEventListener('click', (e) => {
    const bouton = e.target && e.target.closest ? e.target.closest('[data-compteur-moins],[data-compteur-plus]') : null;
    if (!bouton) return;
    const machine = compteurMachineVisee(bouton, 'champ');
    if (!machine) return;
    const bloc = bouton.closest('.compteur');
    const champ = bloc ? bloc.querySelector('.compteur-champ') : null;
    ajusterCompteurChamp(champ, counterUnitOf(machine), bouton.hasAttribute('data-compteur-moins') ? -1 : 1);
  });
  // La touche Entrée dans le champ : la saisie rapide, sans quitter le clavier.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const champ = e.target && e.target.classList && e.target.classList.contains('compteur-champ') ? e.target : null;
    if (!champ) return;
    const machine = compteurMachineVisee(champ, 'champ');
    if (!machine) return;
    e.preventDefault();
    enregistrerCompteur(machine, champ.value);
  });
  // Le compteur COMPACT (fiche machine sur téléphone, bandeau du Parc sur
  // téléphone) : un tap ouvre les rouleaux. Délégué comme le reste de ce
  // bloc — la liste du Parc se réaffiche à chaque filtre/tri/recherche, un
  // câblage posé à l'ouverture de la vue serait perdu au premier re-rendu.
  // Deux gestes de rafraîchissement différents selon d'où vient le tap :
  // dans la fiche machine (.plan-modal), on referme et rouvre la fiche
  // pour que l'échéance/la jauge au-dessus restent cohérentes ; dans le
  // bandeau du Parc, un renderApp() simple suffit (pas de fiche ouverte).
  // Le SECOND compteur : mêmes rouleaux, enregistrement dédié (enregistrerCompteur2).
  document.addEventListener('click', (e) => {
    const cible2 = e.target && e.target.closest ? e.target.closest('[data-tactile-cible-2]') : null;
    if (!cible2) return;
    const bloc2 = cible2.closest('[data-compteur2]');
    const machine2 = bloc2 ? UI.machines.find((m) => m.id === bloc2.dataset.compteur2) : null;
    const unite2 = machine2 ? counterUnit2Of(machine2) : null;
    if (!machine2 || !unite2) return;
    ouvrirRouleauxCompteur(cible2, unite2, machine2, () => renderApp(), {
      sousTitre: trad('2nd compteur'),
      enregistrer: (valeur) => enregistrerCompteur2(machine2, valeur),
    });
  });
  document.addEventListener('click', (e) => {
    const cible = e.target && e.target.closest ? e.target.closest('[data-tactile-cible]') : null;
    if (!cible) return;
    const machine = compteurMachineVisee(cible, 'champ');
    if (!machine) return;
    const ficheOverlay = cible.closest('.plan-modal');
    const refraichir = ficheOverlay
      ? () => { const scrollTop = ficheOverlay.scrollTop; ficheOverlay.remove(); openPlanView(machine, UI.companyId, UI.categories, { scrollTop }); }
      : () => renderApp();
    ouvrirRouleauxCompteur(cible, counterUnitOf(machine), machine, refraichir);
  });
}

// ── Vue : Parc (machines) ─────────────────────────────────────
// Recherche, filtre par état, tri et affichage progressif : indispensable dès
// qu'un parc dépasse quelques dizaines de machines.
const FLEET_PAGE_SIZE = 30;

function fleetFilters() {
  if (!UI.filters) UI.filters = { q: '', status: 'all', sort: 'urgence', limit: FLEET_PAGE_SIZE };
  return UI.filters;
}

function fleetMatches() {
  const f = fleetFilters();
  const q = (f.q || '').trim().toLowerCase();
  return UI.machines.filter(m => {
    // L'état GLOBAL (le pire des deux suivis) : un filtre « En retard » ne
    // doit pas cacher une machine dont seul le second suivi est en retard.
    const state = infoMachine(m).state;
    if (f.status === 'late' && state !== 'late') return false;
    if (f.status === 'soon' && state !== 'soon') return false;
    if (f.status === 'ok' && (state === 'late' || state === 'soon')) return false;
    if (!q) return true;
    const hay = [m.name, m.brand_model, m.brand, m.model, m.serial_number, m.plate, m.category?.name]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function fleetSorted(list) {
  const f = fleetFilters();
  const rankOf = (m) => {
    const s = infoMachine(m).state;
    return s === 'late' ? 0 : (s === 'soon' ? 1 : 2);
  };
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr');
  const copy = list.slice();
  if (f.sort === 'nom') return copy.sort(byName);
  if (f.sort === 'compteur') {
    return copy.sort((a, b) => {
      const va = machineCounter(a);
      const vb = machineCounter(b);
      if (va == null && vb == null) return byName(a, b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return vb - va;
    });
  }
  return copy.sort((a, b) => {
    const ra = rankOf(a);
    const rb = rankOf(b);
    if (ra !== rb) return ra - rb;
    // `urgency`, comparable même quand une machine est classée sur son
    // second suivi (une autre dimension que l'autre machine comparée).
    if (ra !== 2) return infoMachine(a).urgency - infoMachine(b).urgency;
    return byName(a, b);
  });
}

// ★ LOT 7 — LE FILTRE PORTE LA COULEUR DE SON ÉTAT, ET LA PASTILLE RESTE À
// L'ENCRE SUR SON VOILE (ambre 3,04:1 et indigo 4,47 : sous la barre, ces teintes
// ne portent jamais de texte ici). Le filtre ACTIF garde la Signature FR en aplat
// — blanc dessus = 5,65:1 — et son compteur.
function chipHtml(status, label, count) {
  const active = fleetFilters().status === status;
  return `<button type="button" class="chip chip-${status}${active ? ' is-active' : ''}" data-status="${status}" aria-pressed="${active ? 'true' : 'false'}"><span class="chip-mot">${esc(label)}</span><span class="chip-count">${count}</span></button>`;
}
// Reprise Stitch « Parc Machines » (voir keeva-redesign-project) : même
// logique/état que chipHtml (fleetFilters().status), nouvelle présentation
// en pilule avec pastille de couleur — `teinte` (null pour « Toutes ») fixe
// la couleur du point, réutilisant les mêmes classes d'état que le reste
// de l'app (late/soon/ok), jamais une nouvelle couleur.
function parcPillHtml(status, label, count, teinte) {
  const active = fleetFilters().status === status;
  const couleurDot = teinte === 'late' ? 'var(--late)' : teinte === 'soon' ? 'var(--primary)' : teinte === 'ok' ? 'var(--ok)' : 'var(--dark-ink)';
  return `<button type="button" class="ui-puce parc-pill${active ? ' is-actif' : ''}" data-status="${status}" aria-pressed="${active ? 'true' : 'false'}">${teinte ? `<span class="ui-point ${classeEtatKit(teinte)}"></span>` : ''}<span>${esc(label)}</span><span class="ui-compte">${count}</span></button>`;
}

function fleetListHtml() {
  const matches = fleetSorted(fleetMatches());
  if (!matches.length) {
    return `<div class="ui-aide">${trad('Aucune machine ne correspond à cette recherche.')}</div>
      <div><button type="button" class="ui-btn ui-btn-teinte" id="fleet-reset">${trad('Réinitialiser les filtres')}</button></div>`;
  }
  const limit = fleetFilters().limit;
  const shown = matches.slice(0, limit);
  const rest = matches.length - shown.length;
  const total = UI.machines.length;
  const filtered = matches.length !== total;
  return `
    <div class="fleet-count">${tR('{n} machine(s)', { n: matches.length })}${filtered ? ` ${tR('sur {total}', { total })}` : ''}</div>
    ${shown.map(machineCardHtml).join('')}
    ${rest > 0 ? `<button type="button" class="btn-tint" id="fleet-more" style="align-self:center;">${tR('Afficher {n} machine(s) de plus', { n: Math.min(rest, FLEET_PAGE_SIZE) })}</button>` : ''}`;
}

function wireMachineCards(root) {
  // Séparateur de milliers du stepper kilométrique (voir compteurHtml,
  // branche 'strip', attribut data-milliers) : même helper que les champs de
  // prix TCO/Stock, brut au focus, formaté au blur.
  root.querySelectorAll('.compteur-champ[data-milliers]').forEach((input) => activerSeparateurMilliers(input));
  root.querySelectorAll('.view-manual').forEach(btn => {
    btn.addEventListener('click', () => viewManual(btn.dataset.path, btn));
  });
  root.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => {
    const m = UI.machines.find(x => x.id === btn.dataset.id);
    if (!m) return;
    const kind = btn.dataset.open;
    if (kind === 'plan') openPlanView(m, UI.companyId, UI.categories);
    else if (kind === 'log') openLogInterventionModal(m);
    else if (kind === 'next') openNextMaintenanceView(m);
    else if (kind === 'edit') openMachineModal(UI.companyId, UI.categories, m);
  }));
  // Reprise Stitch « bandeau horizontal » (voir machineCardHtml) : la
  // maquette ne montre plus de bouton dédié « Voir le plan »/« Prochain
  // entretien » (3 actions seulement : entretien, carnet, réglages) — pour
  // ne pas perdre cet accès réel, le bandeau lui-même (identité de la
  // machine) reste cliquable vers la fiche, comme .chrono-carte déjà
  // utilisée sur l'Agenda. stopPropagation sur les boutons/champs internes
  // (compteur, actions) évite qu'un clic dessus ouvre aussi la fiche.
  root.querySelectorAll('.mstrip-identite').forEach(zone => zone.addEventListener('click', () => {
    const carte = zone.closest('.mstrip');
    const m = carte && UI.machines.find(x => x.id === carte.dataset.machineId);
    if (m) openPlanView(m, UI.companyId, UI.categories);
  }));
  // ★ LOT 3 — LE PLI D'UNE CARTE DU PARC.
  //   L'état du pli vit dans le DOM de la carte, et NULLE PART AILLEURS, pour
  //   une raison de fond : le parc se redessine à chaque recherche, filtre et
  //   tri (« refreshFleetList »), et un pli mémorisé survivrait au changement
  //   qui vient de changer l'urgence du jour. Chaque venue sur le parc rouvre
  //   donc ce qui est en retard et replie le reste — c'est l'urgence qui décide
  //   de ce qui est visible, et elle est relue à chaque affichage.
  //   Le plieur n'existe qu'au téléphone (au-dessus de 900 px, la feuille le
  //   masque) : sur un ordinateur, tout est déjà déplié. */
  root.querySelectorAll('[data-plier]').forEach(btn => btn.addEventListener('click', () => {
    const carte = btn.closest('.machine');
    if (!carte) return;
    const replie = carte.classList.toggle('is-replie');
    btn.setAttribute('aria-expanded', replie ? 'false' : 'true');
    const chevron = btn.querySelector('.machine-chevron');
    if (chevron) chevron.textContent = replie ? '▸' : '▾';
  }));
}

// Ne redessine que la liste : le champ de recherche garde le focus et sa saisie.
function refreshFleetList() {
  const list = document.getElementById('fleet-list');
  if (!list) return;
  list.innerHTML = fleetListHtml();
  wireMachineCards(list);
  list.querySelector('#fleet-more')?.addEventListener('click', () => {
    fleetFilters().limit += FLEET_PAGE_SIZE;
    refreshFleetList();
  });
  list.querySelector('#fleet-reset')?.addEventListener('click', () => {
    UI.filters = { q: '', status: 'all', sort: 'urgence', limit: FLEET_PAGE_SIZE };
    const input = document.getElementById('fleet-search');
    if (input) input.value = '';
    const select = document.getElementById('fleet-sort');
    if (select) select.value = 'urgence';
    document.querySelectorAll('#view-root .parc-pill').forEach(c => {
      const active = c.dataset.status === 'all';
      c.classList.toggle('is-actif', active);
      c.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    refreshFleetList();
  });
}

VIEWS.machines = {
  fondBlanc: true,
  title: trad('Machines'),
  subtitle: () => `${UI.machines.length} machine${UI.machines.length > 1 ? 's' : ''} · ${UI.companyName}`,
  render() {
    if (!UI.machines.length) {
      return `<div class="ui-page"><section class="ui-section"><div class="ui-aide">${trad('Aucune machine enregistrée pour l\'instant. Clique sur « Ajouter une machine » pour créer la première.')}</div></section></div>`;
    }
    const c = UI.counts;
    const f = fleetFilters();
    // Reprise Stitch « Parc Machines » (voir keeva-redesign-project) : même
    // logique de filtres/tri/recherche qu'avant (fleetFilters/chipHtml),
    // seule la présentation change. Depuis la charte du 2026-10-04, la page est
    // construite avec le kit (kit.css) : une section = un bloc teinté, les
    // machines sont des lignes blanches posées dedans.
    return `
      <div class="ui-page">
        <section class="ui-section">
          ${teteSectionKit('parcMachine', trad('Parc Machines'), '',
            `<span class="ui-tag">${tR('{n} machine(s) enregistrée(s)', { n: UI.machines.length })}</span>
            ${planPermetScannerQr() ? `<button type="button" class="ui-btn ui-btn-pastille" id="fleet-scanner" aria-label="${esc(trad('Scanner un QR'))}" title="${esc(trad('Scanner un QR'))}">${picto('qrcode')}<span>${trad('Scanner un QR')}</span></button>` : ''}
            <button type="button" class="ui-btn ui-btn-pastille" id="fleet-export" aria-label="${esc(trad('Exporter (CSV)'))}" title="${esc(trad('Exporter (CSV)'))}">${picto('export')}<span>${trad('Exporter (CSV)')}</span></button>
            <button type="button" class="ui-btn ui-btn-plein fleet-ajouter" id="fleet-add" aria-label="${trad('Ajouter une machine')}">${picto('croix')}<span class="fa-long">${trad('Ajouter une machine')}</span><span class="fa-court">${trad('Ajouter')}</span></button>`)}
          <div class="ui-section-corps">
            <div class="ui-barre">
              <input id="fleet-search" class="ui-champ" type="search" value="${esc(f.q)}"
                     placeholder="${trad('Rechercher un nom, une marque, un n° de série…')}"
                     aria-label="${trad('Rechercher dans le parc')}">
              <label class="sr-only sort-label" for="fleet-sort">${trad('Trier par')}</label>
              <select id="fleet-sort" class="ui-selecteur">
                <option value="urgence"${f.sort === 'urgence' ? ' selected' : ''}>${trad('Urgence opérationnelle')}</option>
                <option value="nom"${f.sort === 'nom' ? ' selected' : ''}>${trad('Nom (A → Z)')}</option>
                <option value="compteur"${f.sort === 'compteur' ? ' selected' : ''}>${trad('Compteur décroissant')}</option>
              </select>
            </div>
            <div class="ui-puces" role="group" aria-label="${trad('Filtrer par état')}">
              ${parcPillHtml('all', trad('Toutes'), UI.machines.length, null)}
              ${parcPillHtml('late', trad('En retard'), c.late, 'late')}
              ${parcPillHtml('soon', trad('Bientôt'), c.soon, 'soon')}
              ${parcPillHtml('ok', trad('À jour'), c.ok, 'ok')}
            </div>
            <div id="fleet-list" class="mstrip-liste"></div>
            <div class="ui-tuile is-ok">
              <span class="ui-tuile-etiquette">${trad('Disponibilité du parc :')}</span>
              <span class="ui-tuile-valeur">${UI.machines.length ? Math.round(((UI.machines.length - c.late) / UI.machines.length) * 100) : 100}%</span>
              <span class="ui-tuile-note">${trad('Part de la flotte sans entretien en retard')}</span>
            </div>
          </div>
        </section>
      </div>`;
  },
  mount() {
    const root = document.getElementById('view-root');
    if (!root) return;
    // Un relevé de compteur saisi hors connexion attend son envoi : on réessaie
    // en arrivant sur le parc (le retour du réseau, lui, est traité par
    // l'écouteur « online » posé dans views.js).
    viderCompteursEnAttente();
    // Chaque branchement est tolérant : un élément absent ne doit pas empêcher
    // l'affichage de la liste, qui est l'essentiel de cette vue.
    root.querySelector('#fleet-add')?.addEventListener('click', handleAddMachine);
    root.querySelector('#fleet-export')?.addEventListener('click', exporterParcCsv);
    // Le scanner n'existe plus en offre Gratuit (bouton absent) ; la garde ci-dessous couvre un changement d'offre en
    // cours de session. Un QR d'une société tierce scanné ici résout silencieusement à rien.
    root.querySelector('#fleet-scanner')?.addEventListener('click', () => {
      if (!planPermetScannerQr()) {
        openUpgradeNotice(UI.companyId, trad('Le scanner de QR codes est inclus à partir de l\'offre Starter.'));
        return;
      }
      ouvrirScannerQr();
    });

    const search = root.querySelector('#fleet-search');
    if (search) {
      search.addEventListener('input', () => {
        fleetFilters().q = search.value;
        fleetFilters().limit = FLEET_PAGE_SIZE;
        refreshFleetList();
      });
      // La croix native du champ ne déclenche pas toujours « input ».
      search.addEventListener('search', () => {
        fleetFilters().q = search.value;
        refreshFleetList();
      });
    }

    root.querySelectorAll('.parc-pill').forEach(pill => pill.addEventListener('click', () => {
      fleetFilters().status = pill.dataset.status;
      fleetFilters().limit = FLEET_PAGE_SIZE;
      root.querySelectorAll('.parc-pill').forEach(c => {
        const active = c === pill;
        c.classList.toggle('is-actif', active);
        c.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      refreshFleetList();
    }));

    habillerSelect(root.querySelector('#fleet-sort'), trad('Trier par'));
    root.querySelector('#fleet-sort')?.addEventListener('change', (e) => {
      fleetFilters().sort = e.target.value;
      fleetFilters().limit = FLEET_PAGE_SIZE;
      refreshFleetList();
    });

    refreshFleetList();
  },
};

// ★ LOT 3 — LA JAUGE DE L'INTERVALLE, ET ELLE EST CALCULÉE.
// POURQUOI ELLE DESCEND DE LA DONNÉE, ET NE PORTE AUCUN POURCENTAGE AFFICHÉ :
// l'audit a relevé que les maquettes annoncent des taux que personne ne mesure
// (« 100 % d'extraction », « 99,4 % de confiance »). Ici, tout vient de ce que
// la base contient déjà : le compteur relevé, l'intervalle du plan et la
// prochaine échéance — les trois mêmes valeurs que dueInfo(). La barre ne dit
// donc rien qu'elle ne puisse prouver, et le dépassement s'écrit en UNITÉ
// RÉELLE (« +18 h ») dans la phrase d'échéance, jamais en « 101,2 % ».
// LE CALENDAIRE A LA MÊME PREUVE, EN JOURS : la base contient déjà
// `next_due_at` et `interval_days` (les mêmes valeurs que dueInfo()) ; le
// début de cycle se déduit sans nouvelle donnée : next_due_at − interval_days.
// Le SECOND compteur (voir SCHEMA.hasCounter2), vu comme dueInfo() et
// jaugeIntervalleHtml() voient le principal : un couple {info, machineVue}
// synthétique qui réutilise telles quelles les mêmes fonctions — aucune
// duplication de la logique d'échéance ni de son affichage. null si la
// machine n'a pas ce second suivi : rien ne s'affiche alors.
function vueCompteurSecondaire(m) {
  const mode2 = modeSecondaireDe(m);
  if (!mode2 || !m.plan) return null;
  if (mode2 === 'days') {
    // Calendaire : pas de relevé à synthétiser, juste l'échéance du plan
    // secondaire (interval_days_2 / next_due_at_2), comme le calendaire
    // principal.
    const machineVue = { ...m, plan: { tracking_mode: 'days', next_due_at: planNextDueAt2(m.plan), interval_days: planIntervalDays2(m.plan), reminder_days_before: planReminderDays2(m.plan) } };
    return { info: dueInfo(machineVue.plan, machineVue), machineVue };
  }
  const machineVue = {
    ...m, counter_unit: mode2, counter_value: machineCounter2(m),
    plan: {
      tracking_mode: mode2, next_due_at: null,
      ...planNextDueCounterPatch(planNextDueCounter2(m.plan)),
      interval_counter: planIntervalCounter2(m.plan),
      reminder_counter_before: planReminderCounter2(m.plan),
    },
  };
  return { info: dueInfo(machineVue.plan, machineVue), machineVue };
}
// L'ÉTAT GLOBAL D'UNE MACHINE : le PIRE de ses DEUX suivis quand elle en a
// deux — un retard sur le second suivi doit colorer la carte, la remonter
// dans le tri et compter dans le bandeau/les compteurs, même si le suivi
// principal est à jour. Sans ça, l'appli ferait justement manquer
// l'entretien qu'un second suivi existe pour ne plus manquer (signalé le
// 23/09). `urgency` est la seule mesure comparable entre deux dimensions
// différentes (heures, km, jours) — documentée dans dueInfo() pour ça.
function infoMachine(m) {
  const principale = dueInfo(m.plan, m);
  const v2 = vueCompteurSecondaire(m);
  if (!v2) return principale;
  return v2.info.urgency < principale.urgency ? { ...v2.info, secondaire: true } : principale;
}
// Factorisée hors de jaugeIntervalleHtml (reprise Stitch « Machines (Parc)
// horizontal », voir keeva-redesign-project) : la nouvelle carte machine
// compacte a besoin de la MÊME part consommée réelle pour sa propre barre,
// sans reprendre tout le balisage détaillé de jaugeIntervalleHtml — jamais
// un second calcul divergent. `null` si aucune part n'est calculable
// (mêmes gardes que jaugeIntervalleHtml).
function pourcentageIntervalle(info, m) {
  if (!m || !m.plan) return null;
  const enCompteur = planIsCounter(m.plan);
  const intervalle = enCompteur ? planIntervalCounter(m.plan) : (m.plan.interval_days ?? null);
  const reste = info.sortKey;
  if (!Number.isFinite(intervalle) || intervalle <= 0 || !Number.isFinite(reste)) return null;
  const fait = intervalle - reste;
  return Math.max(0, Math.min(100, Math.round((fait / intervalle) * 100)));
}
// Delta signé réel (« -3 h »/« +100 h », « -3 j »/« +12 j ») et texte d'état,
// factorisés hors de machineCardHtml : la carte compteur fusionnée
// (compteurHtml, branche téléphone) affiche EXACTEMENT les mêmes valeurs,
// jamais un second calcul qui pourrait diverger.
function deltaTexteDe(info) {
  if (!(info.unit && Number.isFinite(info.sortKey) && Math.abs(info.sortKey) !== Infinity)) return null;
  return `${info.sortKey < 0 ? '-' : '+'}${info.unit === 'days' ? tR('{n} j', { n: Math.round(Math.abs(info.sortKey)) }) : formatCounter(Math.abs(info.sortKey), info.unit)}`;
}
function echeanceTexteDe(info, m) {
  if (info.state === 'unknown' || !m.plan) return info.short;
  return info.unit === 'days' ? formatShortDate(m.plan.next_due_at) : formatCounter(planNextDueCounter(m.plan), info.unit);
}
function etatNoteTexte(state) {
  if (state === 'late') return trad('Dépassement critique');
  if (state === 'soon') return trad('Intervention imminente');
  if (state === 'ok') return trad('Conforme au plan préventif');
  return '';
}
// Répartition de la jauge en 2 segments quand l'échéance est dépassée —
// reprise Stitch (liste Machines, vue bureau) : au lieu de plafonner le
// remplissage à 100% en perdant le dépassement (pourcentageIntervalle),
// la barre répartit le total RÉELLEMENT consommé (intervalle + dépassement)
// entre les deux segments. Vérifié cohérent avec les proportions de la
// maquette (255/(255+65)=80 % ≈ ses 78 % affichés) — un vrai calcul, pas
// une approximation visuelle. `null` si pas d'état en retard : un seul
// segment (déjà donné par pourcentageIntervalle) suffit alors.
function segmentsJaugeDepassement(info, m) {
  if (info.state !== 'late') return null;
  const enCompteur = planIsCounter(m.plan);
  const intervalle = enCompteur ? planIntervalCounter(m.plan) : (m.plan.interval_days ?? null);
  const depassement = -info.sortKey;
  if (!Number.isFinite(intervalle) || intervalle <= 0 || !Number.isFinite(depassement) || depassement <= 0) return null;
  const total = intervalle + depassement;
  const normal = Math.max(0, Math.min(100, Math.round((intervalle / total) * 100)));
  return { normal, depassement: 100 - normal };
}
function jaugeIntervalleHtml(info, m, detaille) {
  if (!m || !m.plan) return '';
  const enCompteur = planIsCounter(m.plan);
  const intervalle = enCompteur ? planIntervalCounter(m.plan) : (m.plan.interval_days ?? null);
  const reste = info.sortKey;
  if (!Number.isFinite(intervalle) || intervalle <= 0 || !Number.isFinite(reste)) return '';
  const part = pourcentageIntervalle(info, m);
  // ★ LOT 7 — LA CONSOMMATION DE L'INTERVALLE, EN CLAIR.
  // Le bloc PORTE la valeur de l'échéance (« Échéance 250 h » / « Échéance 23 sept. »)
  // et laisse voir la consommation par le remplissage coloré. Il n'écrit AUCUN
  // pourcentage : le travers systématique des maquettes est d'annoncer un taux
  // que personne ne mesure (« 100 % d'extraction », « 99,4 % de confiance »,
  // §5.2 de l'audit), et une barre déjà pleine pour une échéance dépassée
  // dirait « 100 % » là où la vérité est « +18 h » (ou « +3 j »). Le libellé
  // accessible reste la phrase du produit.
  const unite = enCompteur ? counterUnitOf(m) : null;
  const echeance = enCompteur ? formatCounter(planNextDueCounter(m.plan), unite) : formatShortDate(m.plan.next_due_at);
  // Mode détaillé (fiche du plan) : les mêmes trois repères que la maquette,
  // tous réels (début de cycle à 0, dépassement s'il existe, objectif) —
  // jamais le taux qu'elle affiche en plus, pour la même raison qu'au-dessus.
  const debut = enCompteur ? formatCounter(0, unite) : formatShortDate(addDaysIso(m.plan.next_due_at, -intervalle));
  const objectif = enCompteur ? formatCounter(intervalle, unite) : tR('{n} j', { n: intervalle });
  const depassement = enCompteur ? formatCounter(-reste, unite) : tR('{n} j', { n: -reste });
  const detailTete = detaille ? `<span class="machine-jauge-reperes">
      <span>${tR('Dernier cycle ({valeur})', { valeur: debut })}</span>
      ${reste < 0 ? `<span class="is-late">${tR('Dépassement +{valeur}', { valeur: depassement })}</span>` : ''}
      <span>${tR('Objectif {valeur}', { valeur: objectif })}</span>
    </span>` : '';
  const detailPied = detaille ? `<span class="machine-jauge-pied">${tR('Cycle standard {valeur}', { valeur: objectif })}</span>` : '';
  return `<div class="machine-jauge${detaille ? ' machine-jauge-detaillee' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${part}" aria-label="${esc(info.label)}">
      ${detailTete}
      <span class="machine-jauge-tete"><span class="machine-jauge-mot">${trad('Intervalle')}</span><span class="machine-jauge-valeur">${tR('Échéance {valeur}', { valeur: echeance })}</span></span>
      <span class="machine-jauge-piste"><span class="machine-jauge-part is-${info.state}" style="width:${part}%"></span></span>
      ${detailPied}
    </div>`;
}

// ★ LOT 7 — LA CARTE STRUCTURÉE DU PARC.
// CE QUI CHANGE, ET RIEN D'AUTRE : l'ordre et la hiérarchie. Au-dessus, la carte
// était une grande ligne plate — titre, méta, échéance, photo, jauge, compteur et
// quatre boutons étalés sur la largeur, sans colonne. Elle suit maintenant la
// maquette : photo et identité dans la colonne de contenu, encart de la TÂCHE,
// puis une COLONNE DE DROITE qui porte l'ÉTAT OPÉRATIONNEL, l'ÉCHÉANCE EN GRAND,
// la CONSOMMATION DE L'INTERVALLE, les QUATRE ACTIONS et le COMPTEUR.
// AUCUNE DONNÉE NOUVELLE : l'état vient de `dueInfo()`, la tâche de
// `nextTaskLabel()`, la jauge de l'intervalle du plan et du compteur relevé — les
// mêmes valeurs qu'avant, rangées autrement. Aucun taux, aucune télémétrie,
// aucune marque, aucun chantier.
// Reprise Stitch « Machines (Parc) — bandeau horizontal compact » (voir
// keeva-redesign-project) : remplace l'ancienne carte pliable verticale.
// AUCUNE DONNÉE NOUVELLE — mêmes fonctions pures qu'avant (infoMachine,
// nextTaskLabel, dueInfo, pourcentageIntervalle), seule la mise en page
// change. « La partie télémétrie » de la maquette (badge « Sync
// télématique active », widget « Système Télémétrie » de la barre
// latérale) n'est pas reprise, sur demande explicite — l'app n'a aucune
// télémétrie réelle (règle du chantier depuis le début).
function machineCardHtml(m) {
  const info = infoMachine(m);
  const identifiant = identifiantAffiche(m);
  const brandModel = machineBrandModel(m);
  const annee = machineYear(m);
  const metaLigne = [brandModel, annee ? String(annee) : null].filter(Boolean).join(' · ');
  const cat = m.category?.name || trad('Sans catégorie');
  const photo = safeUrl(m.image_url);
  const horsOffre = !machineCouverte(m);
  const tache = nextTaskLabel(m);

  // Delta réel signé (voir dueInfo) : « -3 h »/« +100 h » pour un suivi au
  // compteur, « -3 j »/« +12 j » pour un suivi calendaire — jamais un taux,
  // toujours la même unité que la grandeur suivie. Factorisé (deltaTexteDe/
  // etatNoteTexte) : la carte compteur fusionnée de compteurHtml affiche
  // exactement les mêmes valeurs sur téléphone, jamais un second calcul.
  const deltaTexte = deltaTexteDe(info);
  const part = pourcentageIntervalle(info, m);
  const etat = info.state === 'late' ? 'late' : (info.state === 'soon' ? 'soon' : 'ok');
  // Répartition à 2 segments de la jauge (dépassement visible au-delà de
  // 100 %, voir segmentsJaugeDepassement) — reprise Stitch, vue bureau.
  const segments = segmentsJaugeDepassement(info, m);

  return `
    <article class="mstrip" data-machine-id="${esc(m.id)}">
      <span class="mstrip-accent is-${etat}" aria-hidden="true"></span>
      <div class="mstrip-corps">
        <div class="mstrip-identite">
          <div class="mstrip-photo">
            ${photo ? `<img src="${esc(photo)}" alt="${esc(m.name)}" loading="lazy">` : `<span class="mstrip-photo-vide">${picto('boite')}</span>`}
            <span class="mstrip-photo-tag">${esc(cat)}</span>
          </div>
          <div class="mstrip-info">
            <div class="mstrip-nom-ligne">
              <span class="mstrip-nom">${esc(m.name)}</span>
              <span class="badge mstrip-badge ${badgeClass(info.state)}"><span class="dot"></span><span>${badgeLabel(info.state)}${(info.state === 'late' || info.state === 'soon') && deltaTexte ? ` (${deltaTexte.replace(/^[+-]/, '')})` : ''}</span></span>
            </div>
            ${metaLigne || identifiant ? `<div class="mstrip-meta">${[metaLigne, identifiant ? `<span class="id">${esc(identifiant)}</span>` : null].filter(Boolean).join(' &bull; ')}</div>` : ''}
            ${horsOffre ? `<div class="ui-aide">${trad('Non couverte par ton offre')}</div>` : ''}
            ${tache ? `
            <div class="mstrip-tache is-${info.state === 'late' ? 'late' : (info.state === 'soon' ? 'soon' : 'ok')}">
              ${info.state === 'late' ? picto('alerte') : (info.state === 'soon' ? picto('bientot') : pictoEtat('ok'))}
              <span>${trad('Tâche :')} ${esc(tache)}</span>
            </div>` : ''}
          </div>
        </div>

        <div class="mstrip-compteur-bloc">
          ${compteurHtml(m, 'strip')}
          ${compteur2Html(m, 'strip')}
        </div>

        ${m.plan && part != null ? `
        <div class="mstrip-jauge desktop-only">
          <div class="mstrip-jauge-tete">
            <span>${tR('Échéance {valeur}', { valeur: esc(echeanceTexteDe(info, m)) })}</span>
            ${deltaTexte ? `<span class="mstrip-jauge-delta is-${etat}">${deltaTexte}</span>` : ''}
          </div>
          <span class="mstrip-jauge-piste">
            <span class="mstrip-jauge-part is-${etat}" style="width:${segments ? segments.normal : part}%"></span>
            ${segments ? `<span class="mstrip-jauge-part is-depassement" style="width:${segments.depassement}%"></span>` : ''}
          </span>
          ${etatNoteTexte(info.state) ? `<span class="mstrip-jauge-note is-${info.state}">${info.state === 'late' ? picto('alerte') : ''}${etatNoteTexte(info.state)}</span>` : ''}
        </div>` : `<div class="mstrip-jauge desktop-only">${m.plan ? `<span class="mstrip-jauge-note">${esc(info.short)}</span>` : `<div class="mstrip-jauge-vide"><span class="card-ico">${picto('plan')}</span><div><p>${trad('Plan d\'entretien à définir')}</p><p>${trad('Configure une périodicité pour activer la jauge.')}</p></div></div>`}</div>`}

        <div class="mstrip-actions">
          <button class="mstrip-btn-principal log-intervention-btn" data-open="log" data-id="${esc(m.id)}">${picto('entretien')}<span>${trad('Enregistrer une intervention')}</span></button>
          ${m.manual_url ? `<button type="button" class="view-manual mstrip-btn-icone" data-path="${esc(m.manual_url)}" title="${esc(trad('Consulter le carnet numérique (PDF)'))}">${picto('carnet')}</button>` : ''}
          <button type="button" class="mstrip-btn-icone" data-open="edit" data-id="${esc(m.id)}" title="${esc(trad('Modifier la machine'))}">${picto('reglages')}</button>
        </div>
      </div>
    </article>`;
}
