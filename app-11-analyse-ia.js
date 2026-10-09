/* KALEA — application (app.html) : Analyse IA des manuels, photos du carnet, repérage des pages d'un PDF.
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · BARRE DE PROGRESSION PENDANT L'ANALYSE IA
 *   · CHOIX DU PLAN APRÈS ANALYSE — fiche « Modifier une machine »
 *   · Dépôt d'un manuel → analyse → validation du plan
 *   · MANUELS VOLUMINEUX : ANALYSER SANS ARCHIVER
 *   · PHOTOS DU CARNET D'ENTRETIEN
 *   · REPÉRAGE DES PAGES UTILES D'UN CARNET PDF
 *   · CE QUE « CRÉDIT » VEUT DIRE, DIT CLAIREMENT
 *   · LES LIGNES D'ENTRETIEN D'UNE PAGE, EXTRAITES LOCALEMENT
 *   · LE LECTEUR : GRAND NE SUFFIT PAS, IL FAUT OUVRIR AU BON ZOOM
 */
// ───────────────────────── début du code ─────────────────────────
// ── BARRE DE PROGRESSION PENDANT L'ANALYSE IA ──────────────────────────
// L'appel à `extract-maintenance-plan` (pages repérées, document entier ou
// gros document par référence) est un SEUL `await` réseau, sans le moindre
// signal intermédiaire renvoyé par le serveur (pas de flux, pas de
// pourcentage). Afficher une progression qui « avance avec les pages »
// serait donc une donnée inventée — interdit ici. La barre est donc
// délibérément INDÉTERMINÉE (un segment qui défile en boucle), posée et
// retirée juste autour de l'appel, à côté du message déjà présent dans
// `#f-analysis` (elle ne le remplace pas, elle le renforce visuellement).
function demarrerBarreAnalyse(overlay) {
  if (!overlay) return;
  const analyse = overlay.querySelector('#f-analysis');
  if (!analyse) return;
  // Même carte centrale que l'écran 3 du mockup (icône + double anneau qui
  // tourne), mais SANS pourcentage ni étapes chiffrées — voir la barre
  // juste en dessous, déjà indéterminée pour la même raison réelle (aucun
  // signal intermédiaire de l'appel réseau).
  let spin = overlay.querySelector('.pplan-analyse-spin');
  if (!spin) {
    spin = document.createElement('div');
    spin.className = 'pplan-analyse-spin';
    spin.innerHTML = '<span class="material-symbols-outlined">document_scanner</span>';
    analyse.insertAdjacentElement('beforebegin', spin);
  }
  spin.hidden = false;
  let barre = overlay.querySelector('.analyse-progress');
  if (!barre) {
    barre = document.createElement('div');
    barre.className = 'analyse-progress';
    barre.innerHTML = '<div class="analyse-progress-remplissage"></div>';
    analyse.insertAdjacentElement('afterend', barre);
  }
  barre.hidden = false;
}
function arreterBarreAnalyse(overlay) {
  const spin = overlay && overlay.querySelector('.pplan-analyse-spin');
  if (spin) spin.hidden = true;
  const barre = overlay && overlay.querySelector('.analyse-progress');
  if (barre) barre.hidden = true;
}

// ── CHOIX DU PLAN APRÈS ANALYSE — fiche « Modifier une machine » ───────
// Dans ce formulaire (une seule page, PAS d'étapes — voir openMachineModal),
// le bloc 04 « Mode de suivi & échéances d'entretien » suit directement le
// bloc 03 « Carnet ». Il reste visible par défaut (une fiche déjà pourvue
// d'un plan continue de s'éditer normalement) ; ce n'est QU'après une
// analyse FRAÎCHE, réussie dans CETTE session d'édition, que ce choix
// apparaît et pilote sa visibilité : Suivre/Faire mon propre plan le
// masquent (les champs gardent une valeur valide, donc le formulaire reste
// soumettable sans changement ailleurs), Modifier le réaffiche.
function presenterChoixPlanEditForm(overlay, resultat, machine) {
  const zone = overlay.querySelector('#plan-choix-zone');
  const bloc = overlay.querySelector('#bloc-mode-suivi');
  if (!zone || !bloc) return;
  // `let`, pas `const` : le bouton crayon (voir plus bas) réassigne une
  // ligne en place via appliquerChoixSurTache, « Ajouter une ligne » en
  // pousse une nouvelle — `items` est la seule source de vérité de cet
  // écran, jamais relue depuis le DOM.
  let items = normalizeItems(resultat?.items);
  // Contexte minimal pour la modale de fréquence (MÊME fonction que sur un
  // plan déjà enregistré, voir ouvrirChoixFrequenceApercu) : le mode de
  // suivi est lu sur le radio DU FORMULAIRE (celui que l'utilisateur a sous
  // les yeux ici), pas sur `machine.plan`, qui peut être différent tant que
  // rien n'est encore enregistré.
  const modeFp = overlay.querySelector('input[name=tm]:checked')?.value || 'days';
  const planCtxFp = { tracking_mode: modeFp === 'days' ? 'days' : 'hours' };
  const machineCtxFp = { ...machine, counter_unit: modeFp === 'km' ? 'km' : 'hours' };
  const filaItemFp = (it, i) => `
    <tr data-item-index="${i}">
      <td class="pplan-elt">${it._nouveau
        ? `<input type="text" class="pplan-elt-input fp-item-label-neuf" data-index="${i}" placeholder="${esc(trad('Élément à entretenir'))}" value="${esc(it.label || '')}">`
        : `<span class="pplan-elt-dot" style="background:${pplanDotColor(i)}"></span>${esc(it.label || '—')}`}</td>
      <td class="pplan-freq-valeur">${esc(it.interval_choisi || it.frequency || trad('À définir'))}</td>
      <td><div class="pplan-actions-cell">
        <button type="button" class="pplan-btn-modifier" data-index="${i}" title="${esc(trad('Modifier la fréquence'))}"><span class="material-symbols-outlined">edit</span><span>${trad('Modifier l\'étape')}</span></button>
        <button type="button" class="pplan-btn-supprimer" data-index="${i}" title="${esc(trad('Retirer cette ligne'))}"><span class="material-symbols-outlined">delete</span></button>
      </div></td>
    </tr>`;
  const tableauItemsFpHtml = () => items.map(filaItemFp).join('');
  zone.innerHTML = `
    <div class="pplan-resume is-inset">
      <div class="pplan-resume-gauche">
        <span class="pplan-resume-dot"></span>
        <strong>${items.length
          ? esc(tR('{n} échéance(s) détectée(s) dans le manuel.', { n: items.length }))
          : esc(trad('Analyse terminée : vérifie le mode de suivi ci-dessous si besoin.'))}</strong>
      </div>
    </div>
    ${items.length ? `
    <div style="margin-top:16px;">
      <div class="pplan-section-tete">
        <div>
          <h3><span class="material-symbols-outlined">checklist</span>${trad('Échéances détectées dans le manuel')}</h3>
          <p>${trad('Ajuste la fréquence de chaque ligne, retire une ligne détectée par erreur, ou ajoute les tâches manquantes.')}</p>
        </div>
      </div>
      <div class="pplan-table-wrap" style="margin-top:8px;"><div class="pplan-table-scroll">
        <table class="pplan-table">
          <thead><tr><th>${trad('Élément')}</th><th>${trad('Fréquence')}</th><th class="is-actions">${trad('Actions')}</th></tr></thead>
          <tbody id="fp-items-tbody">${tableauItemsFpHtml()}</tbody>
        </table>
      </div></div>
      <button type="button" class="pplan-ajouter" id="fp-item-ajouter" style="margin-top:10px;"><span class="material-symbols-outlined">add_circle</span><span>${trad('Ajouter une ligne')}</span></button>
    </div>` : ''}
    <div class="pplan-choix" style="margin-top:18px;">
      <button type="button" class="pplan-choix-item is-recommande" id="pc-suivre">
        <div class="pplan-choix-gauche">
          <div class="pplan-choix-ico"><span class="material-symbols-outlined">check</span></div>
          <div>
            <div class="pplan-choix-titre-ligne"><h4>${trad('Suivre ce plan')}</h4><span class="pplan-choix-reco">${trad('Recommandé')}</span></div>
            <p>${trad('Le mode de suivi et l\'intervalle déjà proposés sont conservés tels quels.')}</p>
          </div>
        </div>
        <span class="material-symbols-outlined pplan-choix-fleche">arrow_forward</span>
      </button>
      <button type="button" class="pplan-choix-item" id="pc-modifier">
        <div class="pplan-choix-gauche">
          <div class="pplan-choix-ico"><span class="material-symbols-outlined">edit_note</span></div>
          <div><h4>${trad('Modifier ce plan')}</h4><p>${trad('Ajuster le mode de suivi ou l\'intervalle ci-dessous.')}</p></div>
        </div>
        <span class="material-symbols-outlined pplan-choix-fleche">chevron_right</span>
      </button>
      <button type="button" class="pplan-choix-item" id="pc-propre">
        <div class="pplan-choix-gauche">
          <div class="pplan-choix-ico"><span class="material-symbols-outlined">add_circle</span></div>
          <div><h4>${trad('Faire mon propre plan')}</h4><p>${trad('Ignorer cette proposition ; le carnet reste attaché à la fiche.')}</p></div>
        </div>
        <span class="material-symbols-outlined pplan-choix-fleche">chevron_right</span>
      </button>
    </div>`;
  bloc.hidden = true;
  const fpTbody = zone.querySelector('#fp-items-tbody');
  const rafraichirItemsFp = () => { if (fpTbody) fpTbody.innerHTML = tableauItemsFpHtml(); };
  fpTbody?.addEventListener('click', (e) => {
    const retirer = e.target.closest('.pplan-btn-supprimer');
    if (retirer) { items.splice(Number(retirer.dataset.index), 1); rafraichirItemsFp(); return; }
    const modifier = e.target.closest('.pplan-btn-modifier');
    if (modifier) {
      const i = Number(modifier.dataset.index);
      ouvrirChoixFrequenceApercuAuto(items[i], planCtxFp, { ...machineCtxFp, ...secondaireDuFormulaire(overlay) },
        (modeAjoute, valeur) => activerSecondSuiviFormulaire(overlay, modeAjoute, valeur),
        (choix, machineVue) => {
          items[i] = appliquerChoixSurTache(items[i], choix, planCtxFp, machineVue);
          rafraichirItemsFp();
        });
    }
  });
  // « Modifier ce plan » ne veut pas dire renommer les tâches détectées —
  // seule leur fréquence est éditable (bouton crayon, voir ci-dessus).
  // Ajouter une tâche manquante EST possible : une ligne neuve, avec son
  // propre libellé à saisir.
  fpTbody?.addEventListener('input', (e) => {
    const champ = e.target.closest('.fp-item-label-neuf');
    if (champ) items[Number(champ.dataset.index)].label = champ.value;
  });
  zone.querySelector('#fp-item-ajouter')?.addEventListener('click', () => {
    items.push({ label: '', frequency: '', _nouveau: true });
    rafraichirItemsFp();
    fpTbody.querySelector('tr:last-child .fp-item-label-neuf')?.focus();
  });
  // overlay._aiItems : la variable que le formulaire lit déjà au moment
  // d'enregistrer (voir #pc-propre juste en dessous, qui la remet à null).
  // Une ligne ajoutée à la main jamais complétée (libellé resté vide) est
  // ignorée ; la marque `_nouveau`, propre à cet écran, n'est jamais
  // enregistrée telle quelle.
  const appliquerItemsEdites = () => {
    overlay._aiItems = items.filter((it) => (it.label || '').trim())
      .map(({ _nouveau, ...reste }) => reste);
  };
  zone.querySelector('#pc-suivre').addEventListener('click', () => { appliquerItemsEdites(); bloc.hidden = true; });
  zone.querySelector('#pc-modifier').addEventListener('click', () => {
    appliquerItemsEdites();
    bloc.hidden = false;
    bloc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  zone.querySelector('#pc-propre').addEventListener('click', () => {
    // On ignore la proposition de l'IA : les champs reviennent à ce qu'ils
    // étaient AVANT cette analyse (le fichier, lui, reste attaché à la fiche).
    const champTaches = overlay.querySelector('#f-tasks');
    if (champTaches) champTaches.value = '';
    overlay._aiItems = null;
    overlay._aiNotes = '';
    const champInterval = overlay.querySelector('#f-interval');
    if (champInterval && bloc.dataset.intervalDefaut) champInterval.value = bloc.dataset.intervalDefaut;
    if (bloc.dataset.modeDefaut) {
      const radioDefaut = overlay.querySelector(`input[name=tm][value="${bloc.dataset.modeDefaut}"]`);
      if (radioDefaut) { radioDefaut.checked = true; radioDefaut.dispatchEvent(new Event('change')); }
    }
    bloc.hidden = true;
  });
}

// ── Dépôt d'un manuel → analyse → validation du plan ──────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error(trad('lecture du fichier impossible')));
    reader.readAsDataURL(file);
  });
}

function openManualUploadModal(presetMachine, presetFile) {
  // Dépôt ou remplacement d'un carnet = une ÉCRITURE sur la machine : refusée si
  // elle n'est pas couverte par l'offre (le carnet reste consultable, lui).
  if (presetMachine && refuserSiNonCouverte(presetMachine)) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay manual-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  let machine = presetMachine || (UI.machines.length === 1 ? UI.machines[0] : null);
  let file = presetFile || null;
  let analysis = null;

  const close = () => overlay.remove();
  const shell = (inner) => { overlay.innerHTML = `<div class="modal">${inner}</div>`; };

  function stepPick() {
    if (!UI.machines.length) {
      shell(`
        <h2>${trad('Déposer un manuel')}</h2>
        <p class="sub">${trad('Ajoute d\'abord une machine : le carnet d\'entretien vient compléter sa fiche.')}</p>
        <div class="modal-actions">
          <button type="button" class="secondary" id="mu-close">${trad('Fermer')}</button>
          <button type="button" class="primary" id="mu-add">${trad('Ajouter une machine')}</button>
        </div>`);
      overlay.querySelector('#mu-close').addEventListener('click', close);
      overlay.querySelector('#mu-add').addEventListener('click', () => { close(); handleAddMachine(); });
      return;
    }
    // Carte du fichier une fois choisi (icône, nom, taille), ou l'invite à
    // glisser/parcourir tant qu'aucun fichier n'est sélectionné — jamais
    // « Manuel constructeur vérifié » comme le mockup (rien n'a encore été
    // vérifié à ce stade, l'analyse n'a même pas commencé : ce serait une
    // affirmation fabriquée, contraire à l'éthique du reste de l'app).
    const contenuDropzone = () => file ? `
        <div class="pplan-file-card">
          <div class="pplan-file-gauche">
            <div class="pplan-file-ico"><span class="material-symbols-outlined">auto_stories</span></div>
            <div class="pplan-file-corps">
              <span class="pplan-file-nom">${esc(file.name)}</span>
              <div class="pplan-file-meta">
                <span>${(file.size / (1024 * 1024)).toFixed(1)} ${trad('Mo')}</span>
                <span>·</span>
                <span class="pplan-file-verifie"><span class="material-symbols-outlined">description</span>${trad('Fichier PDF sélectionné')}</span>
              </div>
            </div>
          </div>
          <button type="button" class="pplan-file-remplacer" title="${esc(trad('Remplacer le fichier'))}"><span class="material-symbols-outlined">cached</span></button>
        </div>
        <div class="pplan-file-rappel"><span class="material-symbols-outlined">cloud_done</span><span>${trad('Fichier prêt pour l\'analyse. Glissez un autre fichier pour remplacer.')}</span></div>`
      : `
        <span class="pplan-drop-icon"><span class="material-symbols-outlined">cloud_upload</span></span>
        <span class="pplan-drop-titre">${trad('Glissez votre PDF ici ou parcourez')}</span>
        <span class="pplan-drop-formats">${trad('Format accepté : PDF')}</span>`;
    shell(`
      <div class="modal pplan-modal">
        <div class="pplan-head">
          <div class="pplan-head-titre">
            <div class="pplan-head-ligne">
              <h2>${trad('Déposer un manuel constructeur')}</h2>
              <span class="pplan-badge"><span class="material-symbols-outlined" style="font-size:14px;">verified_user</span>${trad('Analyse locale')}</span>
            </div>
            <p class="sub" style="white-space:normal;max-width:none;">${trad('Notre algorithme repère localement les pages du tableau d\'entretien, puis propose le plan. Tu valides avant activation.')}</p>
          </div>
          <button type="button" class="pplan-close" id="mu-close-x" aria-label="${esc(trad('Fermer'))}"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="pplan-body" style="max-height:none;">
          <div class="pplan-champ">
            <label class="pplan-champ-label" for="mu-machine"><span class="material-symbols-outlined">precision_manufacturing</span>${trad('Machine concernée')}</label>
            <select id="mu-machine" class="pplan-select">
              ${UI.machines.map(m => `<option value="${esc(m.id)}"${machine && m.id === machine.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}
            </select>
          </div>
          <div class="pplan-champ">
            <div class="pplan-champ-ligne">
              <label class="pplan-champ-label"><span class="material-symbols-outlined">picture_as_pdf</span>${trad('Fichier PDF source')}</label>
              <span class="pplan-champ-note">${trad('Format PDF (max. 45 Mo)')}</span>
            </div>
            <div class="pplan-dropzone" id="mu-drop">${contenuDropzone()}</div>
          </div>
          <div class="pplan-note"><span class="material-symbols-outlined">manage_search</span><span>${trad('Extraction assistée : reconnaissance automatique des fréquences horaires, tableau de bord d\'entretien et préconisations d\'huiles.')}</span></div>
          <div class="hint" id="mu-status"></div>
        </div>
        <div class="pplan-foot">
          <button type="button" class="pplan-btn-annuler" id="mu-cancel">${trad('Annuler')}</button>
          <button type="button" class="pplan-btn-activer" id="mu-start"><span class="material-symbols-outlined">search</span><span>${trad('Analyser le PDF')}</span><span class="material-symbols-outlined">arrow_forward</span></button>
        </div>
      </div>`);
    overlay.querySelector('#mu-close-x')?.addEventListener('click', close);
    const statusEl = overlay.querySelector('#mu-status');
    const dropEl = overlay.querySelector('#mu-drop');
    attachDropzone(dropEl, (f) => {
      file = f;
      dropEl.className = 'pplan-dropzone';
      dropEl.innerHTML = contenuDropzone();
      statusEl.textContent = '';
    });
    habillerSelect(overlay.querySelector('#mu-machine'), trad('Machine concernée'));
    overlay.querySelector('#mu-machine').addEventListener('change', (e) => {
      machine = UI.machines.find(m => m.id === e.target.value) || null;
    });
    overlay.querySelector('#mu-cancel').addEventListener('click', close);
    overlay.querySelector('#mu-start').addEventListener('click', () => {
      if (!file) { statusEl.textContent = trad('Choisis d\'abord un fichier PDF (glisser-déposer ou clic sur la zone).'); return; }
      if (!machine) { statusEl.textContent = trad('Choisis la machine concernée.'); return; }
      run();
    });
  }

  async function run() {
    // La machine est choisie DANS la fenêtre : on revérifie ici, sinon un choix
    // non couvert passerait par ce chemin.
    if (refuserSiNonCouverte(machine)) { close(); return; }
    shell(`
      <h2>${trad('Dépôt du carnet…')}</h2>
      <p class="sub">${esc(file.name)} · ${esc(machine.name)}</p>
      <div class="hint" id="mu-progress">${trad('Téléversement du carnet…')}</div>
      <div class="modal-actions">
        <button type="button" class="secondary" id="mu-cancel">${trad('Fermer')}</button>
      </div>`);
    overlay.querySelector('#mu-cancel').addEventListener('click', close);
    const progress = () => overlay.querySelector('#mu-progress');

    try {
      if (file.size > 15 * 1024 * 1024) throw new Error(trad('Le PDF dépasse 15 Mo, réduis sa taille avant de réessayer.'));

      const path = `${UI.companyId}/${machine.id}.pdf`;
      const { error: upErr } = await sb.storage.from('manuals').upload(path, file, { upsert: true, contentType: 'application/pdf' });
      if (upErr) throw upErr;
      const { error: linkErr } = await sb.from('machines').update({ manual_url: path }).eq('id', machine.id);
      if (linkErr) throw linkErr;

      // Le carnet est attaché à la fiche quoi qu'il arrive ensuite (repérage
      // ou non) : un échec de l'analyse ne doit jamais faire perdre le fichier
      // déjà déposé. Place maintenant au repérage LOCAL des pages utiles —
      // la même fonction déjà réelle que sur la fiche machine (brancherCarnetPdf) :
      // gratuit, avant tout envoi payant, et le client choisit les pages.
      stepReperage();
    } catch (err) {
      shell(`
        <h2>${trad('Analyse interrompue')}</h2>
        <p class="sub">${esc(err.message)}</p>
        <div class="hint">${trad('Le carnet n\'a peut-être pas été enregistré. Tu peux réessayer, ou renseigner le plan à la main depuis la fiche de la machine.')}</div>
        <div class="modal-actions">
          <button type="button" class="secondary" id="mu-close">${trad('Fermer')}</button>
          <button type="button" class="primary" id="mu-retry">${trad('Réessayer')}</button>
        </div>`);
      overlay.querySelector('#mu-close').addEventListener('click', close);
      overlay.querySelector('#mu-retry').addEventListener('click', () => { analysis = null; stepPick(); });
    }
  }

  // ── REPÉRAGE LOCAL DES PAGES UTILES ──────────────────────────────────
  // Reprend TEL QUEL le repérage déjà réel de la fiche machine
  // (brancherCarnetPdf / afficherReperage / analyserPagesCarnet, plus haut
  // dans ce fichier) : lecture locale du PDF, pages proposées avec leur
  // aperçu, quota affiché AVANT tout envoi, et c'est le client qui coche.
  // Aucune nouvelle logique — seulement un nouvel écran qui l'appelle.
  function stepReperage() {
    const mode = planIsCounter(machine.plan) ? (counterUnitOf(machine) === 'km' ? trad('km') : 'hours') : 'days';
    shell(`
      <div class="modal pplan-modal is-large">
        <div class="pplan-head">
          <div class="pplan-head-titre">
            <div class="pplan-head-ligne">
              <h2>${trad('Déposer un manuel constructeur')}</h2>
              <span class="pplan-badge"><span class="material-symbols-outlined" style="font-size:14px;">verified_user</span>${trad('Analyse locale')}</span>
            </div>
            <p class="sub" style="white-space:normal;max-width:none;">${trad('Notre algorithme repère localement les pages du tableau d\'entretien, puis propose le plan. Tu valides avant activation.')}</p>
          </div>
          <button type="button" class="pplan-close" id="mu-close-x" aria-label="${esc(trad('Fermer'))}"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="pplan-fichier-bandeau">
          <div class="pplan-fichier-bandeau-gauche">
            <span class="material-symbols-outlined">description</span>
            <span class="pplan-fichier-bandeau-nom">${esc(file.name)}</span>
            <span class="pplan-fichier-bandeau-detail">(${(file.size / (1024 * 1024)).toFixed(1)} ${trad('Mo')} · ${esc(machine.name)})</span>
          </div>
          <span class="pplan-badge">${trad('Fichier chargé')}</span>
        </div>
        <div class="pplan-body" style="max-height:none;">
          <div class="pages-carnet" id="pages-carnet"></div>
          <div class="pages-utiles" id="pages-utiles"></div>
          <div class="hint" id="f-analysis"></div>
        </div>
        <div class="pplan-foot">
          <button type="button" class="pplan-btn-annuler" id="mu-manuel">${trad('Saisir le plan manuellement')}</button>
          <button type="button" class="pplan-btn-annuler" id="mu-cancel">${trad('Annuler')}</button>
        </div>
      </div>`);
    overlay.querySelector('#mu-close-x')?.addEventListener('click', close);
    overlay.querySelector('#mu-cancel').addEventListener('click', close);
    overlay.querySelector('#mu-manuel').addEventListener('click', () => stepReview(null));

    const contexte = {
      trackingMode: aiModeFrom(mode),
      currentHours: machineCounter(machine) ?? null,
      serviceDate: machine.service_date ?? null,
    };
    // apresAnalyse() reçoit {items, notes, taches} (le vocabulaire interne
    // du repérage) : on le remet au format que stepReview() attend déjà
    // ({items, tasks, interval_days, interval_hours}), sans dupliquer la
    // moindre logique de calcul.
    const apresAnalyse = (resultat) => {
      analysis = {
        items: resultat.items,
        tasks: resultat.taches,
        notes: resultat.notes,
        interval_days: overlay._aiIntervalDays,
        interval_hours: overlay._aiIntervalHours,
      };
      stepReview(analysis);
    };
    brancherCarnetPdf(overlay, file, contexte, apresAnalyse, () => analyserDocumentEntier(contexte));
  }

  // ── SECOURS : le document entier, quand le repérage local est impossible
  // (PDF scanné sans texte, ou pdf.js indisponible). Envoie tout le fichier
  // en une fois — le même appel que l'ancien chemin unique de cette modale,
  // conservé pour ce seul cas. `brancherCarnetPdf` prévient déjà le client
  // du coût avant d'appeler cette fonction.
  async function analyserDocumentEntier(contexte) {
    const analyse = overlay.querySelector('#f-analysis');
    if (analyse) { analyse.style.color = 'var(--ok)'; analyse.textContent = trad('Analyse automatique du carnet… (jusqu\'à 20 secondes, ne ferme pas cette fenêtre)'); }
    demarrerBarreAnalyse(overlay);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await sb.functions.invoke('extract-maintenance-plan', {
        body: {
          fileBase64: base64,
          trackingMode: contexte.trackingMode,
          currentHours: contexte.currentHours,
          serviceDate: contexte.serviceDate,
        },
      });
      if (error) throw new Error(await functionErrorMessage(error, trad('analyse impossible')));
      if (data?.error) throw new Error(data.error);
      analysis = data;
      stepReview(analysis);
    } catch (err) {
      if (analyse) { analyse.style.color = 'var(--alert)'; analyse.textContent = messageErreurAnalyse(err, overlay); }
    } finally {
      arreterBarreAnalyse(overlay);
    }
  }

  // `choix` distingue les 3 écrans possibles UNE FOIS l'analyse terminée :
  //   · null (avec un résultat)   → la nouvelle modale de choix (item 3) ;
  //   · 'modifier'                → les champs éditables d'avant (intervalle,
  //     tâches, tableau des échéances), avec le bouton d'activation ;
  //   · 'suivre'                  → active directement le plan suggéré, sans
  //     ré-afficher ces champs — c'est tout l'intérêt du choix « tel quel ».
  // `stepReview(null)` (sans 2ᵉ argument) reste le chemin déjà existant
  // « pas d'analyse / plan à la main », choisi aussi par « Faire mon propre
  // plan » : on n'invente pas un 4ᵉ écran pour ce cas, celui-là existait déjà.
  function stepReview(result, choix) {
    const mode = planIsCounter(machine.plan) ? (counterUnitOf(machine) === 'km' ? trad('km') : 'hours') : 'days';
    // `let`, pas `const` : sur l'écran « Modifier ce plan », chaque ligne
    // devient éditable (voir plus bas) — ce tableau est réassigné avec l'état
    // du formulaire juste avant l'enregistrement, jamais un second tableau
    // séparé à tenir synchronisé.
    let items = normalizeItems(result?.items);
    const unit = counterUnitFromMode(mode);
    const suggested = mode === 'days'
      ? (result?.interval_days || machine.plan?.interval_days || FALLBACK_INTERVAL_DAYS)
      : (result?.interval_hours || planIntervalCounter(machine.plan) || FALLBACK_INTERVAL_HOURS);
    const uniteMot = mode === 'days' ? trad('jours') : COUNTER_UNITS[unit].word;
    const montrerChoix = !!result && !choix;
    const montrerChamps = !result || choix === 'modifier';

    // Ligne du tableau des échéances, régénérée à chaque mutation de `items`
    // (choix de fréquence, ajout, retrait) — `items` est la seule source de
    // vérité de cet écran, jamais relue depuis le DOM au moment d'enregistrer.
    const filaItemMu = (it, i) => `
      <tr data-item-index="${i}">
        <td class="pplan-elt">${it._nouveau
          ? `<input type="text" class="pplan-elt-input mu-item-label-neuf" data-index="${i}" placeholder="${esc(trad('Élément à entretenir'))}" value="${esc(it.label || '')}">`
          : `<span class="pplan-elt-dot" style="background:${pplanDotColor(i)}"></span>${esc(it.label || '—')}`}</td>
        <td class="pplan-freq-valeur">${esc(it.interval_choisi || it.frequency || trad('À définir'))}</td>
        <td><div class="pplan-actions-cell">
          <button type="button" class="pplan-btn-modifier" data-index="${i}" title="${esc(trad('Modifier la fréquence'))}"><span class="material-symbols-outlined">edit</span><span>${trad('Modifier l\'étape')}</span></button>
          <button type="button" class="pplan-btn-supprimer" data-index="${i}" title="${esc(trad('Retirer cette ligne'))}"><span class="material-symbols-outlined">delete</span></button>
        </div></td>
      </tr>`;
    const tableauItemsMuHtml = () => items.map(filaItemMu).join('');

    // Factorisée pour être appelée SOIT par le bouton « Activer le plan »
    // (après modification), SOIT directement par « Suivre ce plan » — même
    // écriture, seule la source de l'intervalle/des tâches change.
    async function activerPlan(interval, tasks, btn, errEl) {
      if (btn) { btn.disabled = true; btn.textContent = trad('Enregistrement…'); }
      try {
        const payload = {
          tracking_mode: mode,
          tasks: tasks || null,
          items: items.length ? items : (machine.plan?.items ?? null),
          notes: result.notes || machine.plan?.notes || null,
          interval_days: mode === 'days' ? interval : (machine.plan?.interval_days || FALLBACK_INTERVAL_DAYS),
          reminder_days_before: machine.plan?.reminder_days_before ?? FALLBACK_REMINDER_DAYS,
        };
        if (mode === 'days') {
          payload.next_due_at = addDaysIso(machine.service_date || todayIso(), payload.interval_days);
        } else {
          Object.assign(payload,
            planCounterPatch(interval, machine.plan ? planReminderCounter(machine.plan) : FALLBACK_REMINDER_HOURS),
            planNextDueCounterPatch((machineCounter(machine) || 0) + interval));
        }
        let planId = machine.plan?.id;
        if (planId) {
          const { error } = await sb.from('maintenance_plans').update(payload).eq('id', planId);
          if (error) throw error;
        } else {
          const { data, error } = await sb.from('maintenance_plans').insert({ ...payload, machine_id: machine.id }).select('id').single();
          if (error) throw error;
          planId = data.id;
        }
        close();
        // « Modifier ce plan » amène sur la fiche du plan après activation :
        // la fréquence de chaque tâche se règle déjà SUR CET ÉCRAN (bouton
        // crayon, voir ouvrirChoixFrequenceApercu), mais un kit ou un point
        // de contrôle affiné, eux, se règlent sur la fiche du plan — pas de
        // raison de dupliquer aussi cet écran-là ici. Suivre/Faire mon propre
        // plan gardent le comportement d'avant (reboot + retour à l'écran de
        // départ) : rien à ajuster tout de suite dans ces 2 cas.
        if (choix === 'modifier') {
          machine.plan = { ...(machine.plan || {}), ...payload, id: planId };
          showToast(trad('Plan activé'));
          openPlanView(machine, UI.companyId, UI.categories);
        } else {
          boot(trad('Plan activé'));
        }
      } catch (err) {
        if (errEl) errEl.textContent = trad('Erreur :') + " " + err.message;
        if (btn) { btn.disabled = false; btn.textContent = trad('Activer le plan'); }
      }
    }

    shell(`
      <div class="modal pplan-modal${montrerChamps ? ' is-large' : ''}">
        <div class="pplan-head">
          <div class="pplan-head-titre">
            <div class="pplan-head-ligne">
              <h2>${result ? trad('Plan proposé par notre algorithme') : trad('Carnet attaché')}</h2>
              ${result ? `<span class="pplan-badge">${montrerChamps ? trad('Édition active') : trad('Prêt')}</span>` : ''}
            </div>
            <p class="sub">${esc(machine.name)} · ${esc(file.name)}</p>
          </div>
          <button type="button" class="pplan-close" id="mu-close-x" aria-label="${esc(trad('Fermer'))}"><span class="material-symbols-outlined">close</span></button>
        </div>
        ${result ? `
        <div class="pplan-resume">
          <div class="pplan-resume-gauche">
            <span class="pplan-resume-dot"></span>
            <strong>${tR('Échéance proposée : tous les {n} {unite}', { n: suggested, unite: uniteMot })}</strong>
            ${items.length ? `<span class="muted">— ${esc(tR('{n} échéance(s) détectée(s) dans le manuel', { n: items.length }))}</span>` : ''}
          </div>
          <span class="pplan-resume-pill">${trad('Recommandé')}</span>
        </div>` : ''}
        ${montrerChamps && result ? `
        <div class="pplan-warning">
          <div class="pplan-warning-ico"><span class="material-symbols-outlined">warning</span></div>
          <div class="pplan-warning-texte"><strong>${trad('Information requise :')}</strong> ${trad('Vous devez renseigner et valider chacune des étapes ci-dessous afin de configurer précisément les périodicités et le déclenchement des alertes d\'entretien.')}</div>
        </div>` : ''}
        <div class="pplan-body">
          ${montrerChoix && items.length ? `
          <div>
            <div class="pplan-section-tete">
              <h3><span class="material-symbols-outlined">checklist</span>${trad('Échéances détectées dans le manuel')}</h3>
              <span style="font-size:11px;color:var(--ink-4)">${esc(tR('{n} tâches identifiées', { n: items.length }))}</span>
            </div>
            <div class="pplan-table-wrap" style="margin-top:8px;"><div class="pplan-table-scroll">
              <table class="pplan-table">
                <thead><tr><th>${trad('Élément')}</th><th>${trad('Fréquence')}</th><th class="is-actions">${trad('Statut')}</th></tr></thead>
                <tbody>${items.map((it, i) => { const s = statutPplan(it); return `
                  <tr>
                    <td class="pplan-elt"><span class="pplan-elt-dot" style="background:${pplanDotColor(i)}"></span>${esc(it.label || '—')}</td>
                    <td class="pplan-freq-valeur">${esc(it.frequency || '—')}</td>
                    <td style="text-align:right"><span class="pplan-statut ${s.classe}">${esc(s.libelle)}</span></td>
                  </tr>`; }).join('')}</tbody>
              </table>
            </div></div>
          </div>` : ''}
          ${montrerChoix ? `
          <div class="pplan-choix">
            <button type="button" class="pplan-choix-item is-recommande" id="pc-suivre">
              <div class="pplan-choix-gauche">
                <div class="pplan-choix-ico"><span class="material-symbols-outlined">check</span></div>
                <div>
                  <div class="pplan-choix-titre-ligne"><h4>${trad('Suivre ce plan')}</h4><span class="pplan-choix-reco">${trad('Recommandé')}</span></div>
                  <p>${trad('On active tel quel l\'intervalle et les tâches proposés.')}</p>
                </div>
              </div>
              <span class="material-symbols-outlined pplan-choix-fleche">arrow_forward</span>
            </button>
            <button type="button" class="pplan-choix-item" id="pc-modifier">
              <div class="pplan-choix-gauche">
                <div class="pplan-choix-ico"><span class="material-symbols-outlined">edit_note</span></div>
                <div><h4>${trad('Modifier ce plan')}</h4><p>${trad('Ajuster l\'intervalle ou les tâches avant d\'activer.')}</p></div>
              </div>
              <span class="material-symbols-outlined pplan-choix-fleche">chevron_right</span>
            </button>
            <button type="button" class="pplan-choix-item" id="pc-propre">
              <div class="pplan-choix-gauche">
                <div class="pplan-choix-ico"><span class="material-symbols-outlined">add_circle</span></div>
                <div><h4>${trad('Faire mon propre plan')}</h4><p>${trad('Ignorer cette proposition et renseigner le plan à la main.')}</p></div>
              </div>
              <span class="material-symbols-outlined pplan-choix-fleche">chevron_right</span>
            </button>
          </div>` : ''}
          ${montrerChamps ? (result ? `
          <div class="pplan-champ-carte">
            <div>
              <label><span class="material-symbols-outlined">schedule</span>${tR('Échéance {mode}', { mode: mode === 'days' ? trad('toutes les (jours)') : tR('tous les ({unite})', { unite: COUNTER_UNITS[unit].word }) })}</label>
              <p>${trad('Fréquence d\'entretien récurrente recommandée d\'après l\'analyse du document.')}</p>
            </div>
            <div class="pplan-champ-valeur">
              <input id="mu-interval" type="number" min="1" value="${esc(suggested)}">
              <span class="unite">${mode === 'days' ? trad('jours') : COUNTER_UNITS[unit].word}</span>
            </div>
          </div>
          ${items.length ? `
          <div>
            <div class="pplan-section-tete">
              <div>
                <h3><span class="material-symbols-outlined">checklist</span>${trad('Échéances détectées dans le manuel')}</h3>
                <p>${trad('Ajuste la fréquence de chaque ligne, retire une ligne détectée par erreur, ou ajoute les tâches manquantes.')}</p>
              </div>
              <button type="button" class="pplan-filtrer" id="mu-filtrer-btn"><span class="material-symbols-outlined">filter_list</span>${trad('Filtrer')}</button>
            </div>
            <div class="pplan-filtre-champ" id="mu-filtre-zone" hidden><input type="text" id="mu-filtre-input" placeholder="${esc(trad('Filtrer par élément…'))}"></div>
            <div class="pplan-table-wrap" style="margin-top:8px;"><div class="pplan-table-scroll">
              <table class="pplan-table">
                <thead><tr><th>${trad('Élément')}</th><th>${trad('Fréquence')}</th><th class="is-actions">${trad('Actions')}</th></tr></thead>
                <tbody id="mu-items-tbody">${tableauItemsMuHtml()}</tbody>
              </table>
            </div></div>
            <button type="button" class="pplan-ajouter" id="mu-item-ajouter" style="margin-top:10px;"><span class="material-symbols-outlined">add_circle</span><span>${trad('Ajouter une ligne')}</span></button>
          </div>` : ''}
          <div class="pplan-taches">
            <label><span class="material-symbols-outlined">notes</span>${trad('Tâches de maintenance')}</label>
            <textarea id="mu-tasks" rows="2">${esc(result.tasks || machine.plan?.tasks || '')}</textarea>
            ${result.notes ? `<div class="pplan-note"><span class="material-symbols-outlined">info</span><span>${esc(result.notes)}</span></div>` : ''}
          </div>
          ` : `
          <div class="hint">${trad('Le PDF est attaché à la fiche. L\'analyse automatique n\'a pas été lancée (fichier volumineux ou service indisponible) : le plan reste à renseigner à la main.')}</div>
          `) : ''}
          <div class="hint" id="mu-error"></div>
        </div>
        <div class="pplan-foot">
          <button type="button" class="pplan-btn-annuler" id="mu-cancel">${trad('Annuler')}</button>
          ${montrerChoix ? '' : `<button type="button" class="pplan-btn-activer" id="mu-activate"><span class="material-symbols-outlined">verified</span><span>${result ? trad('Activer le plan') : trad('Terminer')}</span></button>`}
        </div>
      </div>`);

    overlay.querySelector('#mu-close-x')?.addEventListener('click', close);
    overlay.querySelector('#mu-cancel').addEventListener('click', close);
    if (montrerChoix) {
      overlay.querySelector('#pc-suivre').addEventListener('click', () => {
        activerPlan(suggested, result.tasks || machine.plan?.tasks || '', overlay.querySelector('#pc-suivre'), overlay.querySelector('#mu-error'));
      });
      overlay.querySelector('#pc-modifier').addEventListener('click', () => stepReview(result, 'modifier'));
      overlay.querySelector('#pc-propre').addEventListener('click', () => stepReview(null));
      return;
    }
    // `items` est réaffiché à chaque mutation — retirer, ajouter, ou changer
    // la fréquence d'une ligne modifient `items` puis régénèrent le tbody,
    // jamais l'inverse (jamais de lecture du DOM pour reconstruire `items`).
    const muTbody = overlay.querySelector('#mu-items-tbody');
    const rafraichirItemsMu = () => { if (muTbody) muTbody.innerHTML = tableauItemsMuHtml(); };
    // Contexte minimal (mode + machine réelle) pour la modale de fréquence :
    // MÊME fonction que sur un plan déjà enregistré (openChoixFrequence),
    // demandé explicitement par l'utilisateur plutôt qu'un second éditeur —
    // seule différence, aucune écriture Supabase tant que le plan n'existe
    // pas encore (voir ouvrirChoixFrequenceApercu).
    const planCtxMu = { tracking_mode: mode === 'days' ? 'days' : 'hours' };
    muTbody?.addEventListener('click', (e) => {
      const retirer = e.target.closest('.pplan-btn-supprimer');
      if (retirer) { items.splice(Number(retirer.dataset.index), 1); rafraichirItemsMu(); return; }
      const modifier = e.target.closest('.pplan-btn-modifier');
      if (modifier) {
        const i = Number(modifier.dataset.index);
        ouvrirChoixFrequenceApercuAuto(items[i], planCtxMu, { ...machine, ...secondaireDuFormulaire(overlay) },
          (modeAjoute, valeur) => activerSecondSuiviFormulaire(overlay, modeAjoute, valeur),
          (choix, machineVue) => {
            items[i] = appliquerChoixSurTache(items[i], choix, planCtxMu, machineVue);
            rafraichirItemsMu();
          });
      }
    });
    // « Filtrer » : simple filtre d'AFFICHAGE sur le libellé (masque des
    // lignes du tbody), jamais une modification de `items` — désactivé, le
    // tableau réapparaît intact au prochain rafraîchissement.
    const filtreBtnMu = overlay.querySelector('#mu-filtrer-btn');
    const filtreZoneMu = overlay.querySelector('#mu-filtre-zone');
    filtreBtnMu?.addEventListener('click', () => {
      filtreZoneMu.hidden = !filtreZoneMu.hidden;
      if (!filtreZoneMu.hidden) overlay.querySelector('#mu-filtre-input')?.focus();
    });
    overlay.querySelector('#mu-filtre-input')?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      muTbody?.querySelectorAll('tr').forEach((tr) => {
        const label = (tr.querySelector('.pplan-elt')?.textContent || '').toLowerCase();
        tr.style.display = !q || label.includes(q) ? '' : 'none';
      });
    });
    // « Modifier ce plan » ne veut pas dire renommer les tâches détectées —
    // seule leur fréquence est éditable (voir ci-dessus). Ajouter une tâche
    // manquante EST en revanche possible : une ligne neuve, avec son propre
    // libellé à saisir (elle n'a pas de libellé déjà connu), sa fréquence se
    // réglant ensuite par le même bouton crayon.
    muTbody?.addEventListener('input', (e) => {
      const champ = e.target.closest('.mu-item-label-neuf');
      if (champ) items[Number(champ.dataset.index)].label = champ.value;
    });
    overlay.querySelector('#mu-item-ajouter')?.addEventListener('click', () => {
      items.push({ label: '', frequency: '', _nouveau: true });
      rafraichirItemsMu();
      muTbody.querySelector('tr:last-child .mu-item-label-neuf')?.focus();
    });
    overlay.querySelector('#mu-activate').addEventListener('click', () => {
      if (!result) { close(); boot(trad('Carnet attaché')); return; }
      const interval = parseInt(overlay.querySelector('#mu-interval').value, 10) || suggested;
      const tasks = overlay.querySelector('#mu-tasks').value.trim();
      // Une ligne ajoutée à la main jamais complétée (libellé resté vide) est
      // ignorée ; la marque `_nouveau`, propre à cet écran, n'est jamais
      // enregistrée telle quelle.
      items = items.filter((it) => (it.label || '').trim())
        .map(({ _nouveau, ...reste }) => reste);
      activerPlan(interval, tasks, overlay.querySelector('#mu-activate'), overlay.querySelector('#mu-error'));
    });
  }

  if (machine && file) run();
  else stepPick();
}

async function viewManual(path, btn) {
  const original = btn.textContent;
  btn.textContent = trad('Ouverture…');
  const { data, error } = await sb.storage.from('manuals').createSignedUrl(path, 300);
  if (error) { btn.textContent = trad('Erreur d\'ouverture'); return; }
  window.open(data.signedUrl, '_blank');
  btn.textContent = original;
}

// Nom du carnet dans le stockage : VERSIONNÉ à chaque dépôt.
//
// Réutiliser `${companyId}/${machineId}.pdf` posait deux problèmes réels :
//   • le document remplacé n'apparaissait pas tout de suite — le navigateur et le
//     CDN de Supabase continuaient de servir l'ancien fichier, mis en cache sous
//     la même adresse pendant une heure ;
//   • l'écrasement (upsert) exige un droit de MISE À JOUR sur le stockage, alors
//     qu'un nouveau nom n'exige qu'un droit d'ajout.
// Un nom horodaté règle les deux : l'adresse change, donc le document aussi.
function cheminManuel(companyId, machineId) {
  const horodatage = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  return `${companyId}/${machineId}-${horodatage}.pdf`;
}

// Dépose le PDF, met la fiche à jour, puis supprime l'ancien carnet. L'ordre
// compte : si le dépôt échoue, la fiche garde son carnet actuel — on ne perd
// jamais le document en place.
async function deposerManuel(companyId, machineId, file, ancienChemin) {
  const chemin = cheminManuel(companyId, machineId);
  const { error: uploadErr } = await sb.storage
    .from('manuals')
    .upload(chemin, file, { contentType: 'application/pdf' });
  if (uploadErr) throw uploadErr;
  const { error: lienErr } = await sb.from('machines').update({ manual_url: chemin }).eq('id', machineId);
  if (lienErr) throw lienErr;
  if (ancienChemin && ancienChemin !== chemin) {
    const { error: supErr } = await sb.storage.from('manuals').remove([ancienChemin]);
    // Un ancien fichier qui reste n'empêche pas d'utiliser le nouveau : on le
    // signale sans interrompre l'enregistrement.
    if (supErr) console.warn('Suppression du carnet précédent impossible :', supErr.message);
  }
  return chemin;
}

// ── MANUELS VOLUMINEUX : ANALYSER SANS ARCHIVER ───────────────────────
// Un manuel constructeur fait couramment 10 à 20 Mo (la notice d'une Tesla Model 3
// pèse 16 Mo). Jusqu'ici, au-delà de 8 Mo, l'application renonçait à l'analyse tout
// en gardant le PDF : l'inverse de ce qui a de la valeur. C'est l'ANALYSE qui
// apporte le plan ; le stockage n'est qu'un confort. Donc :
//   · le document part BRUT (pas de base64 : 16 Mo deviennent 21 Mo encodés, au-delà
//     de ce qu'une requête « en ligne » accepte) ;
//   · la fonction le téléverse chez le fournisseur, l'analyse PAR RÉFÉRENCE, puis
//     le SUPPRIME — le temps de l'analyse, et rien de plus ;
//   · RIEN n'est archivé dans la fiche, et on le dit honnêtement.
const MANUEL_ANALYSE_MAX = 8 * 1024 * 1024;
const MANUEL_ENVOI_MAX = 30 * 1024 * 1024;
function manuelSansArchivage(file) { return !!file && file.size > MANUEL_ANALYSE_MAX; }

// Envoi direct des OCTETS (application/pdf) : le contexte voyage dans un en-tête,
// petit et sûr. On n'emploie pas `functions.invoke` ici — le corps doit rester
// binaire, et c'est le seul moyen de le garantir quelle que soit la version du
// client. La fonction répond la même chose que le chemin habituel.
async function envoyerGrosManuel(file, mode, context) {
  const { data: sessionData } = await sb.auth.getSession();
  const jeton = sessionData && sessionData.session ? sessionData.session.access_token : '';
  if (!jeton) throw new Error(trad('Session expirée : reconnecte-toi pour analyser ce manuel.'));
  const contexte = encodeURIComponent(JSON.stringify({
    trackingMode: mode,
    currentHours: context.currentHours ?? null,
    serviceDate: context.serviceDate ?? null,
  }));
  const reponse = await fetch(`${SUPABASE_URL}/functions/v1/extract-maintenance-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${jeton}`,
      'x-keeva-contexte': contexte,
    },
    body: file,
  });
  const texte = await reponse.text();
  let donnees = {};
  try { donnees = texte ? JSON.parse(texte) : {}; } catch { donnees = {}; }
  if (!reponse.ok || donnees.error) throw new Error(donnees.error || `envoi refusé (${reponse.status})`);
  return donnees;
}

async function analyzeManualAndFill(overlay, fileOrBlob, mode = 'days', context = {}) {
  const analysisEl = overlay.querySelector('#f-analysis');
  const fileInput = overlay.querySelector('#f-manual');
  const submitBtn = overlay.querySelector('button[type=submit]');

  const grosDocument = manuelSansArchivage(fileOrBlob);
  const nonConserve = trad('Manuel volumineux : il a été analysé, mais il n\'est pas conservé dans la fiche. Dépose-le à nouveau si tu veux le consulter plus tard.');
  if (grosDocument && fileOrBlob.size > MANUEL_ENVOI_MAX) {
    analysisEl.style.color = 'var(--alert)';
    analysisEl.textContent = trad('Manuel trop volumineux pour être analysé (30 Mo maximum).') + " " + nonConserve;
    return;
  }

  if (fileInput) fileInput.disabled = true;
  if (submitBtn) submitBtn.disabled = true;
  analysisEl.style.color = 'var(--ok)';
  analysisEl.style.fontWeight = '600';
  analysisEl.textContent = grosDocument
    ? trad('Manuel volumineux : envoi du document pour analyse… (cela peut prendre une minute, ne ferme pas cette fenêtre)')
    : trad('Analyse automatique du carnet d\'entretien… (jusqu\'à 15-20 secondes, ne ferme pas cette fenêtre)');
  demarrerBarreAnalyse(overlay);

  try {
    let data;
    if (grosDocument) {
      data = await envoyerGrosManuel(fileOrBlob, mode, context);
    } else {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(fileOrBlob);
      });
      const reponse = await sb.functions.invoke('extract-maintenance-plan', {
        body: { fileBase64: base64, trackingMode: mode, currentHours: context.currentHours ?? null, serviceDate: context.serviceDate ?? null },
      });
      if (reponse.error) throw new Error(reponse.error.message || trad('appel d\'analyse impossible'));
      data = reponse.data;
    }
    if (data?.error) throw new Error(data.error);

    overlay._aiIntervalDays = data.interval_days || null;
    overlay._aiIntervalHours = data.interval_hours || null;
    overlay._aiTrackingSuggestion = data.tracking_mode_suggestion === 'hours' ? 'hours' : 'days';

    // LE MODE EST PROPOSÉ, PAS IMPOSÉ. L'étape suivante (le mode de suivi vient
    // après le carnet) le pré-sélectionne d'après cette recommandation, et
    // l'utilisateur confirme ou corrige. Avant, l'analyse basculait le mode
    // toute seule alors que l'utilisateur venait de le choisir : il voyait son
    // choix changé sous ses yeux sans comprendre pourquoi.
    const modeRecommande = overlay._aiTrackingSuggestion;
    overlay._modeToucheForce = false;

    // Le champ intervalle n'existe pas encore à cette étape (il vit dans l'étape
    // « Mode de suivi ») : on mémorise donc la proposition, elle y sera proposée.
    const intervalField = overlay.querySelector('#f-interval');
    if (intervalField) {
      overlay._intervalTouche = false;
      intervalField.value = intervallePropose(modeRecommande, intervallesIA(overlay));
    }
    if (data.tasks) overlay.querySelector('#f-tasks').value = data.tasks;
    overlay._aiItems = Array.isArray(data.items) && data.items.length ? data.items : null;
    overlay._aiNotes = data.notes || '';
    // LE CARNET MÉLANGE-T-IL UNE SECONDE UNITÉ DE COMPTEUR ? Pur calcul sur ce
    // que l'analyse a déjà classé tâche par tâche — proposé, pas imposé (même
    // principe que le mode principal) : l'étape « Mode de suivi » pré-coche
    // la section « Second suivi » d'après cette détection, sans empêcher
    // l'utilisateur de la décocher ou de choisir une autre unité.
    overlay._aiUniteSecondaire = SCHEMA.hasCounter2 ? detecterUniteSecondaire(overlay._aiItems, modeRecommande) : null;
    overlay._secondaireToucheForce = false;
    // Si la section existe déjà à l'écran (fiche « Modifier la machine », qui
    // permet de relancer une analyse sans changer d'écran), on l'applique
    // directement — le wizard, lui, ne l'affiche qu'à l'étape suivante et la
    // lira depuis overlay._aiUniteSecondaire à ce moment-là.
    const caseSecondaireExistante = overlay.querySelector('#f-secondaire-active');
    if (overlay._aiUniteSecondaire && caseSecondaireExistante && !caseSecondaireExistante.checked) {
      caseSecondaireExistante.checked = true;
      caseSecondaireExistante.dispatchEvent(new Event('change'));
      const radioUnite = overlay.querySelector(`input[name=tm2][value="${overlay._aiUniteSecondaire}"]`);
      if (radioUnite) { radioUnite.checked = true; radioUnite.dispatchEvent(new Event('change')); }
    }
    const detailMsg = overlay._aiItems ? ` ${tR('{n} élément(s) détaillé(s) extrait(s), consultables via « Voir le plan » une fois enregistré.', { n: overlay._aiItems.length })}` : '';
    const modeMsg = ` ℹ️ ${tR('Le carnet exprime ses échéances en {mode} : ce mode de suivi te sera proposé à l\'étape suivante, et tu pourras le corriger.', { mode: modeRecommande === 'hours' ? trad('heures') : trad('jours') })}`;
    const secondaireMsg = overlay._aiUniteSecondaire
      ? ` ℹ️ ${tR('Le carnet mélange aussi une échéance en {unite} : un second suivi te sera proposé, tu pourras le retirer.', { unite: overlay._aiUniteSecondaire === 'km' ? trad('kilomètres') : trad('heures') })}`
      : '';
    analysisEl.textContent = `✅ ${tR('Suggestion de notre algorithme appliquée (confiance {valeur})', { valeur: data.confidence || '—' })}${data.notes ? ' — ' + data.notes : ''}.${detailMsg}${modeMsg}${secondaireMsg} ${trad('Vérifie les champs ci-dessus avant d\'enregistrer.')}`;
    // LE MANUEL VOLUMINEUX N'EST PAS GARDÉ — et on le dit sans détour : le client
    // doit savoir qu'il devra le redéposer pour le consulter plus tard.
    if (grosDocument) analysisEl.textContent += ' ' + nonConserve;
    // Valeur de retour AJOUTÉE (item 3, évolution manuel & analyse IA) : les
    // appelants qui veulent proposer le choix « Suivre / Modifier / Faire mon
    // propre plan » juste après doivent savoir si l'analyse a réussi — cette
    // fonction ne le disait auparavant qu'en écrivant dans le DOM.
    return data;
  } catch (err) {
    analysisEl.style.color = 'var(--alert)';
    analysisEl.textContent = tR('Analyse automatique indisponible ({erreur}) — renseigne le plan manuellement.', { erreur: err.message });
    if (grosDocument) analysisEl.textContent += ' ' + trad('Il n\'a pas été conservé dans la fiche.');
    return null;
  } finally {
    if (fileInput) fileInput.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
    arreterBarreAnalyse(overlay);
  }
}
// ── PHOTOS DU CARNET D'ENTRETIEN ─────────────────────────────────────
// POURQUOI : le carnet est souvent introuvable en ligne (un Kubota B1121D n'a pas
// de notice gratuite), alors que le client l'a sous la main. Photographier le
// tableau d'entretien doit suffire. Trois contraintes dictent ce code :
//   · une photo de téléphone pèse 5 à 10 Mo — on la RÉDUIT à 1600 px de large
//     avant l'envoi, sinon la requête devient lourde et lente ;
//   · un tableau est souvent à cheval sur deux pages — on accepte plusieurs
//     photos, on les MONTRE, et on peut en retirer une ;
//   · les iPhone produisent parfois du HEIC, que le modèle ne lit pas — on le DIT
//     au lieu d'envoyer quelque chose qui échouera en silence.
const CARNET_PAGES_MAX = 6;
const CARNET_PHOTO_LARGEUR = 1600;
const CARNET_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

function pagesCarnet(overlay) { return (overlay && overlay._pagesCarnet) || []; }

// Réduction par canevas : mêmes proportions, JPEG de qualité correcte. Le gain
// est affiché page par page (avant → après), pour que l'utilisateur le voie.
async function reduirePhotoCarnet(file) {
  const bitmap = await createImageBitmap(file);
  const facteur = Math.min(1, CARNET_PHOTO_LARGEUR / bitmap.width);
  const largeur = Math.max(1, Math.round(bitmap.width * facteur));
  const hauteur = Math.max(1, Math.round(bitmap.height * facteur));
  const canevas = document.createElement('canvas');
  canevas.width = largeur;
  canevas.height = hauteur;
  canevas.getContext('2d').drawImage(bitmap, 0, 0, largeur, hauteur);
  if (bitmap.close) bitmap.close();
  const blob = await new Promise((resoudre) => canevas.toBlob(resoudre, 'image/jpeg', 0.82));
  if (!blob) throw new Error(trad('réduction impossible'));
  return { blob, url: URL.createObjectURL(blob), nom: file.name || 'photo.jpg', taille: blob.size, tailleOrigine: file.size, largeur };
}

function dessinerPagesCarnet(overlay, messages) {
  const zone = overlay.querySelector('#pages-carnet');
  if (!zone) return;
  const pages = pagesCarnet(overlay);
  zone.innerHTML = pages.length
    ? pages.map((p, i) => `
        <div class="page-carnet">
          <img src="${p.url}" alt="">
          <span class="page-nom">${esc(p.nom)}</span>
          <span class="muted">${p.largeur} px · ${Math.round(p.taille / 1024)} Ko (photo ${Math.round(p.tailleOrigine / 1024)} Ko)</span>
          <button type="button" class="retirer-page" data-index="${i}" aria-label="${esc(trad('Retirer cette page'))}">✕</button>
        </div>`).join('')
    : '';
  zone.querySelectorAll('.retirer-page').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.index);
    const pages2 = pagesCarnet(overlay);
    if (pages2[i] && pages2[i].url) URL.revokeObjectURL(pages2[i].url);
    pages2.splice(i, 1);
    dessinerPagesCarnet(overlay, []);
  }));
  if (messages && messages.length) {
    const analyse = overlay.querySelector('#f-analysis');
    if (analyse) analyse.textContent = messages.join(' ');
  }
}

// Retient les photos (réduites), puis lance UNE analyse pour l'ensemble.
async function brancherCarnetPhotos(overlay, fichiers, contexte, apresAnalyse) {
  const analyse = overlay.querySelector('#f-analysis');
  overlay._pagesCarnet = pagesCarnet(overlay);
  const messages = [];
  for (const fichier of fichiers) {
    if (pagesCarnet(overlay).length >= CARNET_PAGES_MAX) {
      messages.push(tR('{n} pages au maximum : les suivantes ont été ignorées.', { n: CARNET_PAGES_MAX }));
      break;
    }
    if (!CARNET_MIMES.includes(String(fichier.type || '').toLowerCase())) {
      messages.push(tR('{nom} : format non pris en charge ({format}). Les photos HEIC ne sont pas lisibles — règle l\'appareil photo sur « Le plus compatible ».', {
        nom: fichier.name || 'photo', format: fichier.type || 'inconnu',
      }));
      continue;
    }
    try {
      overlay._pagesCarnet.push(await reduirePhotoCarnet(fichier));
    } catch (err) {
      messages.push(tR('{nom} : photo illisible ({erreur}).', { nom: fichier.name || 'photo', erreur: (err && err.message) || trad('erreur') }));
    }
  }
  dessinerPagesCarnet(overlay, messages);
  if (!pagesCarnet(overlay).length) return null;
  return analyserPagesCarnet(overlay, contexte, apresAnalyse);
}

// UNE SEULE requête pour toutes les pages — donc UN SEUL crédit, rendu si rien
// n'est extrait (la fonction s'en charge, on ne touche pas à cette règle).
async function analyserPagesCarnet(overlay, contexte, apresAnalyse) {
  const analyse = overlay.querySelector('#f-analysis');
  const pages = pagesCarnet(overlay);
  if (!pages.length) return null;
  if (analyse) { analyse.style.color = 'var(--ok)'; analyse.textContent = tR('Analyse de {n} page(s)…', { n: pages.length }); }
  demarrerBarreAnalyse(overlay);
  try {
    const envoyees = await Promise.all(pages.map(async (p) => ({
      mimeType: 'image/jpeg',
      data: await blobEnBase64(p.blob),
    })));
    const { data, error } = await sb.functions.invoke('extract-maintenance-plan', {
      body: {
        pages: envoyees,
        trackingMode: (contexte && contexte.trackingMode) || 'days',
        currentHours: (contexte && contexte.currentHours) ?? null,
        serviceDate: (contexte && contexte.serviceDate) ?? null,
      },
    });
    if (error) throw new Error(await functionErrorMessage(error, trad('analyse impossible')));
    if (data?.error) throw new Error(data.error);
    const items = Array.isArray(data?.items) ? data.items : [];
    overlay._aiItems = items.length ? items : null;
    overlay._aiNotes = data?.notes || '';
    if (data?.interval_days || data?.interval_hours) {
      overlay._aiIntervalDays = data.interval_days || null;
      overlay._aiIntervalHours = data.interval_hours || null;
      overlay._aiTrackingSuggestion = data.tracking_mode_suggestion === 'hours' ? 'hours' : 'days';
    }
    // Même détection que pour un PDF (voir analyzeManualAndFill) : une
    // seconde unité de compteur mélangée dans ces pages photographiées.
    overlay._aiUniteSecondaire = SCHEMA.hasCounter2
      ? detecterUniteSecondaire(items, overlay._aiTrackingSuggestion || (contexte && contexte.trackingMode) || 'days')
      : null;
    overlay._secondaireToucheForce = false;
    const caseSecondaireExistante = overlay.querySelector('#f-secondaire-active');
    if (overlay._aiUniteSecondaire && caseSecondaireExistante && !caseSecondaireExistante.checked) {
      caseSecondaireExistante.checked = true;
      caseSecondaireExistante.dispatchEvent(new Event('change'));
      const radioUnite = overlay.querySelector(`input[name=tm2][value="${overlay._aiUniteSecondaire}"]`);
      if (radioUnite) { radioUnite.checked = true; radioUnite.dispatchEvent(new Event('change')); }
    }
    const resultat = { items: overlay._aiItems, notes: overlay._aiNotes, taches: data?.tasks || '' };
    // ON RETIENT LE DÉCOMPTE renvoyé par la fonction : c'est lui qui permet de
    // dire, AVANT le prochain envoi, où en est le client dans son offre.
    retenirQuotaAnalyses(data || {});
    if (analyse) {
      // MESSAGE HONNÊTE : on dit combien de pages ont été analysées et combien
      // d'échéances en sont sorties. Zéro échéance est une réponse acceptable —
      // « reprends la photo » vaut mieux qu'un plan inventé.
      analyse.style.color = items.length ? 'var(--ok)' : 'var(--alert)';
      analyse.textContent = items.length
        ? tR('{pages} page(s) analysée(s) : {n} échéance(s) extraite(s). Vérifie les champs ci-dessus avant d\'enregistrer.', { pages: pages.length, n: items.length })
        : tR('{pages} page(s) analysée(s) : aucune échéance lisible. Reprends la photo de plus près, bien à plat, et réessaie.', { pages: pages.length });
    }
    if (typeof apresAnalyse === 'function') apresAnalyse(resultat);
    return resultat;
  } catch (err) {
    if (analyse) {
      analyse.style.color = 'var(--alert)';
      // QUOTA ATTEINT : on ne dit pas « erreur », on dit ce qui se passe et quand
      // ça reprend — jamais un blocage muet, jamais une facture surprise.
      analyse.textContent = messageErreurAnalyse(err, overlay);
    }
    return null;
  } finally {
    arreterBarreAnalyse(overlay);
  }
}

function blobEnBase64(blob) {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result).split(',')[1] || '');
    lecteur.onerror = () => rejeter(new Error(trad('lecture du fichier impossible')));
    lecteur.readAsDataURL(blob);
  });
}

// ── REPÉRAGE DES PAGES UTILES D'UN CARNET PDF ────────────────────────
// POURQUOI : un manuel constructeur fait 100 à 400 pages, et le tableau
// d'entretien en occupe deux ou trois. Analyser tout le document coûte cher (le
// fournisseur facture au volume) et noie le modèle dans du bruit. On REPÈRE donc
// les pages utiles LOCALEMENT, gratuitement, et c'est le client qui CONFIRME :
// « automatiser puis faire confirmer », jamais décider à sa place.
//
// pdf.js est la bibliothèque DÉJÀ employée par l'application (aperçu de la
// première page d'un carnet) : aucune dépendance ajoutée, aucune adresse nouvelle
// dans la politique de sécurité. Elle vient de la même source qu'aujourd'hui.
const REPERAGE_PAGES_MAX = 200;      // au-delà : on lit les 200 premières, et on le dit
const REPERAGE_PAGES_RETENUES = 6;   // le plafond du chemin photo : 6 pages, 1 crédit
// Un vrai tableau d'entretien, c'est une FORME, pas un mot : plusieurs périodicités
// alignées. On exige donc les deux à la fois — plusieurs nombres avec unité, ET au
// moins un mot SPÉCIFIQUE d'entretien. Sans ces deux conditions, aucune page n'est
// proposée : mieux vaut « aucune page repérée » que six pages hors sujet.
const REPERAGE_MIN_NOMBRES = 2;      // « plusieurs » : un seul nombre n'est pas un tableau
const REPERAGE_SEUIL = 6;

// MOTS SPÉCIFIQUES (poids 3) : ils n'apparaissent pas par hasard dans un manuel.
// Un paragraphe sur les ceintures de sécurité dit « every », « interval » et même
// « belt » (« seat belt ») — d'où des formes précises plutôt que des mots nus.
const REPERAGE_MOTS_FORTS = [
  'vidange', 'oil change', 'engine oil', 'huile moteur', 'graissage', 'graisser', 'grease', 'greasing',
  'lubrification', 'lubrication', 'courroie', 'drive belt', 'v-belt', 'belt tension', 'belt replacement',
  'filtre a air', 'filtre à air', 'air filter', 'filtre a huile', 'filtre à huile', 'oil filter',
  'filtre hydraulique', 'hydraulic filter', 'bougie', 'spark plug', 'plan de maintenance',
  'tableau d\'entretien', 'carnet d\'entretien', 'maintenance schedule', 'maintenance table',
  'service interval', 'service schedule', 'heures de service', 'service hours', 'périodicité',
  'periodicite', 'periodicity',
];
// MOTS BANALS (poids 1) : utiles comme indice, jamais suffisants à eux seuls.
// « every », « toutes les », « interval », « check », « replace » sont VOLONTAIREMENT
// absents : on les trouve dans n'importe quel mode d'emploi.
const REPERAGE_MOTS_FAIBLES = [
  'entretien', 'maintenance', 'intervalle', 'interval', 'contrôle', 'controle', 'inspection',
  'filtre', 'filter', 'hydraulique', 'hydraulic', 'huile', 'oil',
];
// LA FORME D'UN TABLEAU : un nombre associé à une unité (heures, km, mois, ans…).
const REPERAGE_UNITES = /\b\d[\d\s.,]*\s*(h|hrs?|heures?|hours?|km|kilom[èe]tres?|miles?|mois|months?|ans?|ann[ée]es?|years?|jours?|days?|semaines?|weeks?)\b/gi;
// LA FORME D'UN TABLEAU SE DIT AUSSI EN MOTS : un manuel réel (STIHL) écrit ses
// périodicités en toutes lettres — « avant de commencer le travail », « tous les
// jours », « une fois par semaine », « une fois par mois », « une fois par an » —
// et n'a parfois AUCUNE durée chiffrée. Ne compter que les nombres suivis d'une
// unité revenait à ne retenir aucune page d'un manuel parfaitement lisible.
const REPERAGE_PERIODES_MOTS = /(?:toutes?|tous)\s+les\s+(?:heures?|jours?|semaines?|mois|ans?|ann[ée]es?)|(?:une|deux|trois|quatre|cinq|six)\s+fois\s+par\s+(?:jour|semaine|mois|an|ann[ée]e)|(?:après|apres)\s+chaque\s+\w+|chaque\s+(?:jour|semaine|mois|an|ann[ée]e|ravitaillement|plein)/gi;

function occurrencesDe(texte, motif) {
  let position = texte.indexOf(motif);
  let occurrences = 0;
  while (position >= 0 && occurrences < 5) {
    occurrences++;
    position = texte.indexOf(motif, position + motif.length);
  }
  return occurrences;
}

function scorePageCarnet(texte) {
  const normalise = String(texte || '').toLowerCase();
  let score = 0;
  const trouves = [];
  for (const mot of REPERAGE_MOTS_FORTS) {
    const occurrences = occurrencesDe(normalise, mot);
    if (occurrences) { score += occurrences * 3; trouves.push(mot); }
  }
  for (const mot of REPERAGE_MOTS_FAIBLES) {
    const occurrences = occurrencesDe(normalise, mot);
    if (occurrences) { score += occurrences; trouves.push(mot); }
  }
  const nombresChiffres = (normalise.match(REPERAGE_UNITES) || []).length;
  const periodesEnMots = (normalise.match(REPERAGE_PERIODES_MOTS) || []).length;
  const nombres = nombresChiffres + periodesEnMots;
  score += nombres * 2;
  // LES DEUX CONDITIONS QUI FONT LA DIFFÉRENCE : la forme (plusieurs périodicités)
  // ET un mot spécifique. Une page qui n'a que des mots banals, ou un seul nombre,
  // n'est PAS un tableau d'entretien. Les deux écritures comptent pareil : « toutes
  // les 100 heures » et « une fois par mois » sont la MÊME preuve de forme.
  const motsForts = trouves.filter((m) => REPERAGE_MOTS_FORTS.includes(m)).length;
  const tableau = nombres >= REPERAGE_MIN_NOMBRES && motsForts >= 1 && score >= REPERAGE_SEUIL;
  return { score, trouves, nombres, nombresChiffres, periodesEnMots, motsForts, tableau };
}

// Aperçu COURT et lisible : on part du premier mot-clé (ou du premier nombre avec
// unité) pour montrer au client POURQUOI cette page est proposée.
function apercuPageCarnet(texte, trouves) {
  const propre = String(texte || '').replace(/\s+/g, ' ').trim();
  if (!propre) return '';
  let position = -1;
  for (const mot of trouves) {
    const p = propre.toLowerCase().indexOf(String(mot).toLowerCase());
    if (p >= 0 && (position < 0 || p < position)) position = p;
  }
  const unite = propre.match(REPERAGE_UNITES);
  if (unite && typeof unite.index === 'number' && (position < 0 || unite.index < position)) position = unite.index;
  if (position < 0) position = 0;
  const debut = Math.max(0, position - 30);
  return (debut > 0 ? '… ' : '') + propre.slice(debut, debut + 110) + (propre.length > debut + 110 ? ' …' : '');
}

// Lit le TEXTE, page par page. Un PDF scanné n'en a AUCUN : c'est le cas qu'on
// annonce honnêtement, sans jamais inventer une page.
async function repererPagesCarnet(file, surProgres) {
  await ensurePdfWorker();
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const total = pdf.numPages;
  const aLire = Math.min(total, REPERAGE_PAGES_MAX);
  const lues = [];
  for (let numero = 1; numero <= aLire; numero++) {
    let texte = '';
    try {
      const page = await pdf.getPage(numero);
      const contenu = await page.getTextContent();
      texte = (contenu.items || []).map((it) => it.str || '').join(' ');
    } catch (err) { texte = ''; }
    const caracteres = texte.replace(/\s+/g, '').length;
    if (caracteres) {
      const resultat = scorePageCarnet(texte);
      lues.push({
        numero, score: resultat.score, nombres: resultat.nombres, motsForts: resultat.motsForts,
        nombresChiffres: resultat.nombresChiffres, periodesEnMots: resultat.periodesEnMots,
        tableau: resultat.tableau, trouves: resultat.trouves,
        // Le TEXTE est gardé (borné) : c'est lui qui permet d'extraire les lignes
        // d'entretien affichées sous la vignette — sans rien redemander au serveur.
        texte: texte.slice(0, 4000),
        apercu: apercuPageCarnet(texte, resultat.trouves),
      });
    }
    if (typeof surProgres === 'function') surProgres(numero, aLire);
  }
  // SEULES LES PAGES QUI ONT LA FORME D'UN TABLEAU sont proposées. Si aucune ne
  // l'a, on ne retient RIEN : « aucune page repérée » est une réponse honnête, six
  // pages hors sujet n'en sont pas une.
  const retenues = lues.filter((p) => p.tableau)
    .sort((a, b) => b.score - a.score)
    .slice(0, REPERAGE_PAGES_RETENUES)
    .sort((a, b) => a.numero - b.numero);
  return { total, lues: aLire, avecTexte: lues.length, retenues, texteTrouve: lues.length > 0, pdf };
}

// Rend UNE page en JPEG de la même largeur que les photos du carnet (1600 px) :
// le chemin photo existant fait ensuite tout le travail — une requête, un crédit.
async function rendrePageCarnet(pdf, numero) {
  const page = await pdf.getPage(numero);
  const base = page.getViewport({ scale: 1 });
  const facteur = Math.min(2.5, Math.max(1, CARNET_PHOTO_LARGEUR / base.width));
  const viewport = page.getViewport({ scale: facteur });
  const canevas = document.createElement('canvas');
  canevas.width = Math.round(viewport.width);
  canevas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canevas.getContext('2d'), viewport }).promise;
  const blob = await new Promise((r) => canevas.toBlob(r, 'image/jpeg', 0.82));
  if (!blob) throw new Error(tR('Page {n} illisible.', { n: numero }));
  return {
    blob, url: URL.createObjectURL(blob), nom: tR('Page {n}', { n: numero }),
    taille: blob.size, tailleOrigine: blob.size, largeur: canevas.width,
  };
}

function listeCourte(numeros) {
  if (numeros.length <= 1) return String(numeros[0] ?? '');
  return numeros.slice(0, -1).join(', ') + ' ' + trad('et') + ' ' + numeros[numeros.length - 1];
}

// ── CE QUE « CRÉDIT » VEUT DIRE, DIT CLAIREMENT ──────────────────────
// Le client lisait « 3 pages seront analysées — 1 crédit » et croyait qu'on allait
// lui FACTURER quelque chose. Or l'analyse est INCLUSE dans son offre, dans la
// limite mensuelle. On dit donc : ce qui est compris, le plafond RÉEL de son
// offre, où il en est, et qu'aucun paiement ne lui sera demandé ici.
//
// LES PLAFONDS SONT CEUX DE LA BASE (signal/migration-plafonds-usages.sql) :
// 10 / 20 / 30 / 5 000 analyses par mois, offre par offre. Ce ne sont que des
// valeurs d'AFFICHAGE avant le premier appel — ensuite, c'est le décompte
// renvoyé par le serveur qui fait foi. Un repli faux annoncerait « 500 » à un
// client Starter : c'est exactement ce qu'il ne faut pas.
//   · eco / pro / paid restent à 500 : offres vendues avant, grandfathering.
const QUOTAS_ANALYSES = {
  free: 10, starter: 20, business: 30, enterprise: 5000,
  eco: 500, pro: 500, paid: 500, unlimited: 5000,
};

const CLE_QUOTA_ANALYSES = 'keeva-analyses-restantes';

function etatQuotaAnalyses() {
  const plan = (typeof UI !== 'undefined' && UI.companyPlan) || 'free';
  const plafond = QUOTAS_ANALYSES[plan] || QUOTAS_ANALYSES.free;
  let restant = null;
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_QUOTA_ANALYSES) || 'null');
    if (brut && brut.plan === plan && Number.isFinite(Number(brut.restant))) {
      restant = Math.max(0, Math.min(plafond, Number(brut.restant)));
    }
  } catch (err) { restant = null; }
  return { plan, plafond, restant, offre: OFFRES_LIBELLES[plan] || OFFRES_LIBELLES.free };
}

// Retient le décompte renvoyé par la fonction, pour l'ANNONCER AVANT l'envoi
// suivant. Sans ce chiffre, on dit le plafond et on l'explique — jamais un vide.
function retenirQuotaAnalyses(reponse) {
  try {
    const etat = etatQuotaAnalyses();
    const plafond = Number(reponse && reponse.quota_plafond) || etat.plafond;
    if (!Number.isFinite(Number(reponse && reponse.quota_restant))) return;
    localStorage.setItem(CLE_QUOTA_ANALYSES, JSON.stringify({
      plan: etat.plan, plafond, restant: Math.max(0, Number(reponse.quota_restant)), maj: Date.now(),
    }));
  } catch (err) { /* stockage indisponible : on n'affiche simplement pas le décompte */ }
}

// REND UNE PAGE EN LOCAL (canevas → JPEG). `largeur` est une largeur RÉELLE en
// pixels, et pour le lecteur elle DÉPASSE l'échelle 1 : une page A4 ne fait que
// 595 px de large à l'échelle 1, et un `Math.min(1, …)` qui traînait ici bridait
// donc le lecteur à 595 px — c'est LUI qui rendait la page illisible, malgré un
// lecteur plein écran et une demande de 1 600 px. On rend large (2 600 px) et on
// renvoie aussi la largeur de la page, dont dépend le zoom effectif.
async function rendrePage(pdf, numero, largeur) {
  const page = await pdf.getPage(numero);
  const base = page.getViewport({ scale: 1 });
  const facteur = Math.max(0.05, Number(largeur || 180) / base.width);
  const viewport = page.getViewport({ scale: facteur });
  const canevas = document.createElement('canvas');
  canevas.width = Math.max(1, Math.round(viewport.width));
  canevas.height = Math.max(1, Math.round(viewport.height));
  await page.render({ canvasContext: canevas.getContext('2d'), viewport }).promise;
  const blob = await new Promise((r) => canevas.toBlob(r, 'image/jpeg', 0.7));
  if (!blob) throw new Error(tR('Page {n} illisible.', { n: numero }));
  return { url: URL.createObjectURL(blob), largeurPage: base.width };
}

// VIGNETTE D'UNE PAGE : rendue EN LOCAL, en petit, pour qu'on VOIE la page avant
// de la valider. Rien n'est envoyé au serveur pour l'aperçu.
async function rendreVignettePage(pdf, numero, largeur = 180) {
  return (await rendrePage(pdf, numero, largeur)).url;
}

// Remplit les vignettes UNE PAR UNE, en rendant la main entre chaque : l'écran
// reste utilisable, et six pages au maximum suffisent (le plafond du chemin photo).
async function remplirVignettes(overlay, zone, reperage) {
  overlay._vignettes = overlay._vignettes || new Map();
  const boutons = zone.querySelectorAll('.vignette-bouton');
  for (const bouton of boutons) {
    const numero = Number(bouton.dataset.page);
    try {
      if (!overlay._vignettes.has(numero)) {
        overlay._vignettes.set(numero, await rendreVignettePage(reperage.pdf, numero));
      }
      const url = overlay._vignettes.get(numero);
      bouton.innerHTML = `<img src="${url}" alt="${esc(tR('Aperçu de la page {n}', { n: numero }))}">`;
      bouton.classList.add('prete');
    } catch (err) {
      bouton.classList.add('echec');
      bouton.textContent = tR('Aperçu indisponible', {});
    }
    // LES LIGNES D'ENTRETIEN, sous la vignette : c'est CELLE-CI qu'on lit pour
    // valider d'un coup d'œil, sans zoom. Si rien n'est extractible, on le dit.
    const zoneLignes = zone.querySelector(`.page-lignes[data-page="${numero}"]`);
    if (zoneLignes) {
      const page = (reperage.retenues || []).find((p) => p.numero === numero) || {};
      const lignes = lignesEntretienPage(page.texte || '');
      zoneLignes.innerHTML = lignes.length
        ? `<span class="page-lignes-titre">${esc(trad('Lignes d\'entretien repérées :'))}</span>`
          + '<ul>' + lignes.map((l) => `<li>${esc(l.tache)} — ${esc(l.periodicite)}</li>`).join('') + '</ul>'
        : `<span class="page-lignes-vide">${esc(trad('Le texte de cette page n\'est pas extractible ligne par ligne : ouvre-la pour vérifier.'))}</span>`;
    }
    // On rend la main : le rendu d'une page ne doit pas figer l'écran.
    await new Promise((r) => setTimeout(r, 0));
  }
}

// ── LES LIGNES D'ENTRETIEN D'UNE PAGE, EXTRAITES LOCALEMENT ──────────
// POURQUOI : on ne valide pas une page en la LISANT en entier, on valide en
// reconnaissant SON tableau. Le score a déjà vu les périodicités ; on les
// APPARIE avec la tâche la plus proche, et on rend des couples lisibles sans
// zoom : « Vidange moteur — toutes les 100 heures ». C'est gratuit : tout est
// calculé ici, sur le texte déjà lu.
const VOCABULAIRE_TACHES = [
  { mot: 'vidange', libelle: trad('Vidange') }, { mot: 'huile moteur', libelle: trad('Huile moteur') },
  { mot: 'oil change', libelle: trad('Vidange') }, { mot: 'engine oil', libelle: trad('Huile moteur') },
  { mot: 'filtre a air', libelle: trad('Filtre à air') }, { mot: 'filtre à air', libelle: trad('Filtre à air') },
  { mot: 'air filter', libelle: trad('Filtre à air') },
  { mot: 'filtre a huile', libelle: trad('Filtre à huile') }, { mot: 'filtre à huile', libelle: trad('Filtre à huile') },
  { mot: 'oil filter', libelle: trad('Filtre à huile') },
  { mot: 'filtre habitacle', libelle: trad('Filtre habitacle') }, { mot: 'cabin filter', libelle: trad('Filtre habitacle') },
  { mot: 'filtre hepa', libelle: trad('Filtre HEPA') }, { mot: 'hepa filter', libelle: trad('Filtre HEPA') },
  { mot: 'courroie', libelle: trad('Courroie') }, { mot: 'drive belt', libelle: trad('Courroie') },
  { mot: 'bougie', libelle: trad('Bougie') }, { mot: 'spark plug', libelle: trad('Bougie') },
  { mot: 'graissage', libelle: trad('Graissage') }, { mot: 'grease', libelle: trad('Graissage') },
  { mot: 'liquide de frein', libelle: trad('Liquide de frein') }, { mot: 'brake fluid', libelle: trad('Liquide de frein') },
  { mot: 'frein', libelle: trad('Frein') }, { mot: 'brake', libelle: trad('Frein') },
  { mot: 'pneu', libelle: trad('Pneus') }, { mot: 'tire', libelle: trad('Pneus') }, { mot: 'tyre', libelle: trad('Pneus') },
  { mot: 'batterie', libelle: trad('Batterie') }, { mot: 'battery', libelle: trad('Batterie') },
  { mot: 'refroidissement', libelle: trad('Refroidissement') }, { mot: 'coolant', libelle: trad('Refroidissement') },
  { mot: 'climatisation', libelle: trad('Climatisation') }, { mot: 'air conditioning', libelle: trad('Climatisation') },
  { mot: 'essuie-glace', libelle: trad('Essuie-glaces') }, { mot: 'wiper', libelle: trad('Essuie-glaces') },
  { mot: 'controle', libelle: trad('Contrôle') }, { mot: 'inspection', libelle: trad('Contrôle') },
  { mot: 'remplacement', libelle: trad('Remplacement') }, { mot: 'remplacer', libelle: trad('Remplacement') },
];

// LES UNITÉS, DITES EN FRANÇAIS : un tableau anglais écrit « 2 years » ; la ligne
// lisible devient « tous les 2 ans ».
const UNITES_LISIBLES = {
  year: trad('an'), years: trad('ans'), month: trad('mois'), months: trad('mois'), day: trad('jour'), days: trad('jours'),
  week: trad('semaine'), weeks: trad('semaines'), hour: trad('heure'), hours: trad('heures'), hr: trad('h'), hrs: trad('h'),
  h: trad('h'), km: trad('km'), kilometre: trad('km'), kilometres: trad('km'), kilometer: trad('km'), kilometers: trad('km'),
  mile: trad('mile'), miles: trad('miles'),
};

// Renvoie les couples { tache, periodicite } d'une page, dans l'ordre du texte.
function lignesEntretienPage(texte) {
  const propre = String(texte || '').replace(/\s+/g, ' ').trim();
  if (!propre) return [];
  const lignes = [];
  const vus = new Set();
  for (const trouve of propre.matchAll(REPERAGE_UNITES)) {
    const position = trouve.index || 0;
    // LA TÂCHE LA PLUS PROCHE, et de préférence AVANT l'intervalle : un tableau
    // s'écrit « tâche … périodicité ». Prendre le premier mot du vocabulaire dans
    // une large fenêtre donnait « Filtre à air » pour TOUTES les lignes.
    const debut = Math.max(0, position - 120);
    const fenetre = propre.slice(debut, Math.min(propre.length, position + 40)).toLowerCase();
    let tache = null;
    let meilleurScore = -1;
    for (const entree of VOCABULAIRE_TACHES) {
      let place = fenetre.lastIndexOf(entree.mot);
      if (place < 0) place = fenetre.indexOf(entree.mot);
      if (place < 0) continue;
      const avantLeNombre = (debut + place) <= position;
      const score = (avantLeNombre ? 10000 : 0) + place;
      if (score > meilleurScore) { meilleurScore = score; tache = entree.libelle; }
    }
    if (!tache) continue;
    const morceaux = /^([\d\s.,]+)\s*(.+)$/.exec(trouve[0].trim());
    const nombre = morceaux ? morceaux[1].trim() : trouve[0].trim();
    const uniteBrute = morceaux ? morceaux[2].trim().toLowerCase() : '';
    const unite = UNITES_LISIBLES[uniteBrute] || uniteBrute;
    const avant = propre.slice(Math.max(0, position - 24), position).toLowerCase();
    const avecMotCle = /(tous les|toutes les|every|each|chaque)\s*$/.test(avant.trim());
    const periodicite = (avecMotCle ? trad('tous les') + ' ' : '') + nombre + (unite ? ' ' + unite : '');
    const cle = (tache + '|' + periodicite).toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    lignes.push({ tache, periodicite });
    if (lignes.length >= 8) break;
  }
  return lignes;
}

// ── LE LECTEUR : GRAND NE SUFFIT PAS, IL FAUT OUVRIR AU BON ZOOM ──────
// POURQUOI CES CONSTANTES. Une page A4 mesure 595 px de large à l'échelle 1.
// Affichée « ajustée à la largeur » dans un téléphone de 390 px, elle est donc
// RÉDUITE à 0,66× : un texte de 9 pt y fait 6 px de haut — illisible, même avec
// un lecteur plein écran et une image de 1 600 px. Ce qui rend lisible, c'est le
// ZOOM EFFECTIF (largeur affichée ÷ largeur de la page), pas la taille du rendu :
//   2 600 px de rendu → l'image reste nette jusqu'à 4,3× sur une A4 ;
//   2×               → un texte de 9 pt fait 18 px de haut à l'écran.
const LECTEUR_LARGEUR_RENDU = 2600;
const LECTEUR_ZOOM_LISIBLE = 2;
const LECTEUR_ZOOM_MINI = 0.5;
const LECTEUR_ZOOM_MAXI = 8;

// LE ZOOM D'OUVERTURE, CALCULÉ — et éprouvé par un test. « Lisible » prime sur
// « page entière » ; mais si l'écran est assez large pour tout montrer au-delà du
// seuil (bureau), l'ouverture reste ajustée à la largeur : c'est le même résultat.
function zoomLecture({ largeurPage, largeurVue, mode = 'lire' }) {
  const page = Number(largeurPage) || 0;
  const vue = Number(largeurVue) || 0;
  if (page <= 0 || vue <= 0) return LECTEUR_ZOOM_LISIBLE;
  const ajuste = vue / page;
  const voulu = mode === 'ajuster' ? ajuste : Math.max(LECTEUR_ZOOM_LISIBLE, ajuste);
  return Math.min(LECTEUR_ZOOM_MAXI, Math.max(LECTEUR_ZOOM_MINI, voulu));
}

// Applique un zoom à la page ouverte : largeur affichée = largeur de page × zoom.
// La vue défile alors dans LES DEUX SENS, et le point regardé reste au centre —
// au pincement comme au zoom, l'œil ne doit pas perdre l'endroit qu'il lisait.
function poserZoom(lecteur, valeur) {
  const image = lecteur.querySelector('#lecteur-image');
  const vue = lecteur.querySelector('#lecteur-vue');
  if (!image || !vue) return 0;
  const largeurPage = Number(image.dataset.largeurPage) || 0;
  if (!largeurPage) return 0;
  const zoom = Math.min(LECTEUR_ZOOM_MAXI, Math.max(LECTEUR_ZOOM_MINI, Number(valeur) || LECTEUR_ZOOM_LISIBLE));
  image.dataset.zoom = zoom.toFixed(3);
  image.style.width = Math.round(largeurPage * zoom) + 'px';
  const temoin = lecteur.querySelector('#lecteur-zoom');
  if (temoin) temoin.textContent = zoom.toFixed(1).replace('.', ',') + '×';
  const centreX = (vue.scrollLeft + vue.clientWidth / 2) / (vue.scrollWidth || 1);
  const centreY = (vue.scrollTop + vue.clientHeight / 2) / (vue.scrollHeight || 1);
  const recentrer = () => {
    vue.scrollLeft = Math.max(0, centreX * vue.scrollWidth - vue.clientWidth / 2);
    vue.scrollTop = Math.max(0, centreY * vue.scrollHeight - vue.clientHeight / 2);
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(recentrer); else recentrer();
  return zoom;
}

// Les quatre commandes de zoom : deux choix explicites (« Ajuster à la largeur »
// pour voir la page entière, « Lire » pour le zoom lisible) et les deux pas.
function zoomerLecteur(lecteur, mode) {
  const image = lecteur.querySelector('#lecteur-image');
  const vue = lecteur.querySelector('#lecteur-vue');
  if (!image || !vue) return;
  const largeurPage = Number(image.dataset.largeurPage) || 0;
  const courant = Number(image.dataset.zoom) || LECTEUR_ZOOM_LISIBLE;
  if (mode === 'plus') return void poserZoom(lecteur, courant * 1.25);
  if (mode === 'moins') return void poserZoom(lecteur, courant * 0.8);
  poserZoom(lecteur, zoomLecture({ largeurPage, largeurVue: vue.clientWidth, mode }));
}

function distanceDoigts(touches) {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

// LE LECTEUR : la page RE-RENDUE en haute résolution, PLEIN ÉCRAN, ouverte à un
// ZOOM LISIBLE, défilable dans les deux sens, avec pincement pour ajuster.
async function ouvrirLecteurPage(overlay, reperage, numero) {
  let lecteur = overlay.querySelector('#lecteur-page');
  if (!lecteur) {
    lecteur = document.createElement('div');
    lecteur.className = 'lecteur-page';
    lecteur.id = 'lecteur-page';
    lecteur.innerHTML = `
      <div class="lecteur-barre">
        <span class="lecteur-titre" id="lecteur-titre"></span>
        <span class="lecteur-outils">
          <button type="button" class="secondary" id="lecteur-ajuster">${esc(trad('Ajuster à la largeur'))}</button>
          <button type="button" class="secondary" id="lecteur-lire">${esc(trad('Lire'))}</button>
          <button type="button" class="secondary" id="lecteur-moins" aria-label="${esc(trad('Dézoomer'))}">−</button>
          <button type="button" class="secondary" id="lecteur-plus" aria-label="${esc(trad('Agrandir'))}">+</button>
          <span class="lecteur-zoom" id="lecteur-zoom" aria-live="polite"></span>
          <button type="button" class="secondary" id="lecteur-fermer">${esc(trad('Fermer'))}</button>
        </span>
      </div>
      <div class="lecteur-vue" id="lecteur-vue">
        <div class="lecteur-attente" id="lecteur-attente">${esc(trad('Rendu de la page en haute résolution…'))}</div>
        <img id="lecteur-image" alt="">
      </div>`;
    overlay.appendChild(lecteur);
    lecteur.querySelector('#lecteur-fermer').addEventListener('click', () => fermerLecteurPage(overlay));
    lecteur.querySelector('#lecteur-ajuster').addEventListener('click', () => zoomerLecteur(lecteur, 'ajuster'));
    lecteur.querySelector('#lecteur-lire').addEventListener('click', () => zoomerLecteur(lecteur, 'lire'));
    lecteur.querySelector('#lecteur-plus').addEventListener('click', () => zoomerLecteur(lecteur, 'plus'));
    lecteur.querySelector('#lecteur-moins').addEventListener('click', () => zoomerLecteur(lecteur, 'moins'));
    const vue = lecteur.querySelector('#lecteur-vue');
    // Molette + Ctrl : le geste de zoom des navigateurs de bureau.
    vue.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomerLecteur(lecteur, e.deltaY < 0 ? 'plus' : 'moins');
    }, { passive: false });
    // PINCEMENT À DEUX DOIGTS, implémenté ici : la vue garde le défilement natif
    // à un doigt (`touch-action: pan-x pan-y` dans la feuille de style), et un
    // pincement à deux doigts n'est donc plus pris pour un zoom de page.
    let pincement = null;
    vue.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pincement = {
          distance: distanceDoigts(e.touches) || 1,
          zoom: Number(lecteur.querySelector('#lecteur-image').dataset.zoom) || LECTEUR_ZOOM_LISIBLE,
        };
      }
    }, { passive: true });
    vue.addEventListener('touchmove', (e) => {
      if (!pincement || e.touches.length !== 2) return;
      e.preventDefault();
      poserZoom(lecteur, pincement.zoom * (distanceDoigts(e.touches) / pincement.distance));
    }, { passive: false });
    const finPincement = () => { pincement = null; };
    vue.addEventListener('touchend', finPincement);
    vue.addEventListener('touchcancel', finPincement);
    lecteur.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerLecteurPage(overlay); });
    document.addEventListener('keydown', function surEchap(e) {
      if (e.key === 'Escape' && overlay.querySelector('#lecteur-page')) {
        fermerLecteurPage(overlay);
        document.removeEventListener('keydown', surEchap);
      }
    });
  }
  const titre = lecteur.querySelector('#lecteur-titre');
  const image = lecteur.querySelector('#lecteur-image');
  const attente = lecteur.querySelector('#lecteur-attente');
  const vue = lecteur.querySelector('#lecteur-vue');
  if (titre) titre.textContent = tR('Page {n} — lecture', { n: numero });
  if (attente) { attente.style.display = 'block'; attente.textContent = trad('Rendu de la page en haute résolution…'); }
  if (image) {
    image.removeAttribute('src');
    image.style.width = '';
    delete image.dataset.largeurPage;
    delete image.dataset.zoom;
  }
  if (vue) vue.scrollTop = 0;
  lecteur.classList.add('ouvert');
  try {
    // RÉSOLUTION RÉELLE : 2 600 px de large, soit 4,3× une page A4 — c'est ce qui
    // garde l'image NETTE une fois zoomée. Le rendu est local, donc gratuit, et
    // l'image est libérée à la fermeture (voir fermerLecteurPage).
    const rendu = await rendrePage(reperage.pdf, numero, LECTEUR_LARGEUR_RENDU);
    if (image) {
      image.dataset.largeurPage = String(rendu.largeurPage);
      image.src = rendu.url;
    }
    if (attente) attente.style.display = 'none';
    // ON OUVRE AU ZOOM LISIBLE, et surtout pas « ajusté à la largeur » : c'est
    // tout l'objet de ce lecteur.
    poserZoom(lecteur, zoomLecture({
      largeurPage: rendu.largeurPage,
      largeurVue: (vue && vue.clientWidth) || 0,
    }));
    if (vue) vue.scrollTop = 0;
  } catch (err) {
    if (attente) attente.textContent = tR('Page {n} illisible.', { n: numero });
  }
}

function fermerLecteurPage(overlay) {
  const lecteur = overlay.querySelector('#lecteur-page');
  if (!lecteur) return;
  lecteur.classList.remove('ouvert');
  const image = lecteur.querySelector('#lecteur-image');
  // On libère l'image de lecture : la vignette, elle, reste affichée.
  if (image && image.src && image.src.startsWith('blob:')) URL.revokeObjectURL(image.src);
  if (image) { image.removeAttribute('src'); image.style.width = ''; }
}

// AFFICHE LE REPÉRAGE — et laisse le client décider. Trois cas, tous dits :
//   · des pages repérées  → pré-cochées, avec VIGNETTE et aperçu, retrait, ajout,
//     et un état de quota qui explique ce qui est compris dans l'offre ;
//   · aucun texte (scanné) → on le dit, et on propose les deux issues honnêtes ;
//   · pdf.js indisponible → on le dit aussi, et on propose le document entier.
function afficherReperage(overlay, reperage, contexte, apresAnalyse) {
  const zone = overlay.querySelector('#pages-utiles');
  if (!zone) return;
  const choisies = new Set(reperage.retenues.map((p) => p.numero));
  overlay._reperage = { ...reperage, choisies };
  const rendu = () => {
    const numeros = [...choisies].sort((a, b) => a - b);
    const lignes = reperage.retenues.map((p) => `
      <label class="page-utile">
        <input type="checkbox" data-page="${p.numero}"${choisies.has(p.numero) ? ' checked' : ''}>
        <span class="page-empilement">
          <span class="page-num">${esc(tR('Page {n}', { n: p.numero }))}</span>
          <span class="page-contenu">
            <button type="button" class="vignette-bouton" data-page="${p.numero}"
              aria-label="${esc(tR('Ouvrir la page {n} en grand pour la lire', { n: p.numero }))}"><span class="vignette-attente">${esc(trad('Aperçu…'))}</span></button>
            <span class="page-lignes" data-page="${p.numero}"></span>
            <span class="page-apercu">${esc(p.apercu || '')}</span>
          </span>
        </span>
      </label>`).join('');
    const trouvees = reperage.retenues.length
      ? tR('{n} pages du tableau d\'entretien trouvées — pages {liste}', { n: reperage.retenues.length, liste: listeCourte(reperage.retenues.map((p) => p.numero)) })
      : trad('Aucune page de tableau d\'entretien repérée dans ce document.');
    const plafond = reperage.total > reperage.lues
      ? ' ' + tR('{n} pages au maximum : les suivantes ont été ignorées.', { n: reperage.lues })
      : '';
    // ★ LE CRÉDIT, SANS AMBIGUÏTÉ : ce qui est compris, le plafond de l'offre, où
    //   l'on en est, ce qui se passe si c'est épuisé, et l'absence de paiement ici.
    const quota = etatQuotaAnalyses();
    const epuise = quota.restant === 0;
    const creditTitre = epuise
      ? tR('Vos {plafond} analyses du mois sont utilisées.', { plafond: quota.plafond })
      : tR('{n} page(s) seront analysées — compris dans votre offre.', { n: numeros.length });
    const creditDetail = quota.restant === null
      ? tR('Votre offre {offre} comprend {plafond} analyses par mois. Le décompte exact s\'affiche après chaque analyse.', { offre: quota.offre, plafond: quota.plafond })
      : tR('Votre offre {offre} comprend {plafond} analyses par mois. Il vous en reste {restant}.', { offre: quota.offre, plafond: quota.plafond, restant: quota.restant });
    const creditSuite = epuise
      ? ' ' + trad('L\'analyse reprendra le 1er du mois prochain, ou passez à une offre supérieure depuis votre abonnement.')
      : '';
    zone.innerHTML = `
      <div class="reperage-titre"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px;color:var(--ok);">menu_book</span> ${esc(trouvees)}</div>
      ${lignes}
      <div class="credit-clair${epuise ? ' epuise' : ''}">
        <div class="credit-titre">${esc(creditTitre)}</div>
        <div class="credit-detail">${esc(creditDetail)}${esc(creditSuite)}</div>
        <div class="credit-rassurance">${esc(trad('Aucun paiement supplémentaire ne vous sera demandé depuis cet écran.'))}</div>
        <div class="credit-plafond">${esc(tR('{n} pages au maximum par analyse.', { n: REPERAGE_PAGES_RETENUES }))}${esc(plafond)}</div>
      </div>
      <div class="ajout-page">
        <label for="f-page-ajout">${esc(trad('Ajouter une page'))}</label>
        <input id="f-page-ajout" type="number" min="1" max="${reperage.total}" placeholder="${esc(trad('N° de page'))}">
        <button type="button" class="pplan-btn-annuler" id="btn-page-ajout">${esc(trad('Ajouter d\'autres pages'))}</button>
      </div>
      <div class="modal-actions" style="margin-top:16px;">
        <button type="button" class="pplan-btn-activer" id="btn-analyser-pages"${numeros.length && !epuise ? '' : ' disabled'}><span class="material-symbols-outlined">play_arrow</span><span>${esc(tR('Analyser ces {n} pages', { n: numeros.length }))}</span></button>
      </div>`;
    remplirVignettes(overlay, zone, reperage);
    // LE LECTEUR : au clic, la page est RE-RENDUE en haute résolution et ouverte
    // en grand. Agrandir une vignette de 180 px ne ferait que flouter — lire un
    // tableau dense demande un rendu neuf (local, donc gratuit).
    zone.querySelectorAll('.vignette-bouton').forEach((b) => b.addEventListener('click', () => {
      ouvrirLecteurPage(overlay, reperage, Number(b.dataset.page));
    }));
    zone.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', () => {
      const numero = Number(c.dataset.page);
      if (c.checked) {
        if (choisies.size >= REPERAGE_PAGES_RETENUES) {
          c.checked = false;
          const analyse = overlay.querySelector('#f-analysis');
          if (analyse) analyse.textContent = tR('{n} pages au maximum.', { n: REPERAGE_PAGES_RETENUES });
          return;
        }
        choisies.add(numero);
      } else {
        choisies.delete(numero);
      }
      rendu();
    }));
    const ajout = zone.querySelector('#btn-page-ajout');
    if (ajout) ajout.addEventListener('click', async () => {
      const champ = zone.querySelector('#f-page-ajout');
      const numero = Number(champ && champ.value);
      const analyse = overlay.querySelector('#f-analysis');
      if (!Number.isFinite(numero) || numero < 1 || numero > reperage.total) {
        if (analyse) analyse.textContent = tR('Numéro de page invalide (1 à {total}).', { total: reperage.total });
        return;
      }
      if (choisies.has(numero)) return;
      if (choisies.size >= REPERAGE_PAGES_RETENUES) {
        if (analyse) analyse.textContent = tR('{n} pages au maximum.', { n: REPERAGE_PAGES_RETENUES });
        return;
      }
      choisies.add(numero);
      // Une page ajoutée à la main n'était pas dans la liste : on la montre avec
      // son aperçu (lu maintenant), pour que le client voie ce qu'il envoie.
      if (!reperage.retenues.some((p) => p.numero === numero)) {
        let apercu = '';
        try {
          const page = await reperage.pdf.getPage(numero);
          const contenu = await page.getTextContent();
          const texte = (contenu.items || []).map((it) => it.str || '').join(' ');
          apercu = apercuPageCarnet(texte, scorePageCarnet(texte).trouves);
        } catch (err) { apercu = ''; }
        reperage.retenues.push({ numero, score: 0, trouves: [], nombres: 0, apercu });
        reperage.retenues.sort((a, b) => a.numero - b.numero);
      }
      rendu();
    });
    const lancer = zone.querySelector('#btn-analyser-pages');
    if (lancer) lancer.addEventListener('click', async () => {
      const numeros2 = [...choisies].sort((a, b) => a - b);
      if (!numeros2.length) return;
      lancer.disabled = true;
      const analyse = overlay.querySelector('#f-analysis');
      if (analyse) { analyse.style.color = 'var(--ok)'; analyse.textContent = tR('Préparation de {n} page(s)…', { n: numeros2.length }); }
      try {
        overlay._pagesCarnet = [];
        for (const numero of numeros2) overlay._pagesCarnet.push(await rendrePageCarnet(reperage.pdf, numero));
        dessinerPagesCarnet(overlay, []);
        await analyserPagesCarnet(overlay, contexte, apresAnalyse);
      } catch (err) {
        if (analyse) {
          analyse.style.color = 'var(--alert)';
          analyse.textContent = messageErreurAnalyse(err, overlay);
        }
      } finally {
        lancer.disabled = false;
      }
    });
  };
  rendu();
}

// LE QUOTA ATTEINT SE DIT, IL NE SE SUBIT PAS : jamais un blocage muet, jamais une
// facture surprise. Le message nomme l'offre, le plafond, la date de reprise.
function messageErreurAnalyse(err, overlay) {
  const brut = (err && err.message) || trad('erreur');
  if (/Quota mensuel/i.test(brut)) {
    const quota = etatQuotaAnalyses();
    return tR('Votre offre {offre} a utilisé ses {plafond} analyses de ce mois. L\'analyse reprendra le 1er du mois prochain, ou passez à une offre supérieure depuis votre abonnement. Aucun paiement supplémentaire ne vous sera demandé ici.',
      { offre: quota.offre, plafond: quota.plafond });
  }
  return tR('Analyse indisponible ({erreur}) — renseigne le plan à la main.', { erreur: brut });
}

// Branche un PDF de carnet : repérage local, puis confirmation par le client.
// `analyserTout` reste le chemin d'avant (le document entier) — jamais silencieux.
async function brancherCarnetPdf(overlay, file, contexte, apresAnalyse, analyserTout) {
  const zone = overlay.querySelector('#pages-utiles');
  const analyse = overlay.querySelector('#f-analysis');
  if (analyse) {
    analyse.style.color = 'var(--ok)';
    analyse.style.fontWeight = '600';
    analyse.textContent = trad('Repérage des pages du tableau d\'entretien…');
  }
  let reperage = null;
  try {
    reperage = await repererPagesCarnet(file, (faites, total) => {
      if (analyse && faites % 10 === 0) {
        analyse.textContent = tR('Repérage des pages du tableau d\'entretien… ({faites}/{total})', { faites, total });
      }
    });
  } catch (err) {
    // pdf.js indisponible (hors connexion) : on ne fait pas semblant. Le client
    // garde la main, et rien ne part sans son accord.
    if (zone) {
      zone.innerHTML = `
        <div class="reperage-titre">${esc(trad('Repérage impossible : je ne peux pas lire ce document.'))}</div>
        <div class="hint">${esc(trad('Tu peux analyser le document entier — le coût est annoncé avant l\'envoi.'))}</div>
        <div class="modal-actions">
          <button type="button" class="pplan-btn-activer" id="btn-analyser-tout"><span>${esc(trad('Analyser tout le document'))}</span></button>
        </div>`;
      const bouton = zone.querySelector('#btn-analyser-tout');
      if (bouton) bouton.addEventListener('click', () => analyserTout());
    }
    if (analyse) analyse.textContent = tR('Repérage impossible ({erreur}).', { erreur: (err && err.message) || trad('erreur') });
    return;
  }
  if (reperage.texteTrouve) {
    afficherReperage(overlay, reperage, contexte, apresAnalyse);
    if (analyse) {
      analyse.style.color = 'var(--ok)';
      analyse.textContent = reperage.retenues.length
        ? tR('{n} pages du tableau d\'entretien trouvées — vérifie et confirme ci-dessous.', { n: reperage.retenues.length })
        : trad('Aucune page de tableau d\'entretien repérée : choisis les pages toi-même, ou analyse tout le document.');
    }
    return;
  }
  // DOCUMENT SANS TEXTE (scan) : on le dit, et on propose les DEUX issues.
  if (zone) {
    zone.innerHTML = `
      <div class="reperage-titre">${esc(trad('Ce document est une image : je ne peux pas repérer les bonnes pages.'))}</div>
      <div class="hint">${esc(trad('Choisis les pages toi-même (gratuit), ou analyse tout le document.'))}</div>
      <div class="modal-actions">
        <button type="button" class="pplan-btn-annuler" id="btn-choisir-pages">${esc(trad('Choisir les pages moi-même'))}</button>
        <button type="button" class="pplan-btn-activer" id="btn-analyser-tout"><span>${esc(tR('Analyser tout le document ({n} pages — coût élevé)', { n: reperage.total }))}</span></button>
      </div>`;
    const choisir = zone.querySelector('#btn-choisir-pages');
    if (choisir) choisir.addEventListener('click', () => {
      afficherReperage(overlay, reperage, contexte, apresAnalyse);
      if (analyse) analyse.textContent = trad('Indique les numéros de page du tableau d\'entretien.');
    });
    const tout = zone.querySelector('#btn-analyser-tout');
    if (tout) tout.addEventListener('click', () => analyserTout());
  }
  if (analyse) {
    analyse.style.color = 'var(--alert)';
    analyse.textContent = trad('Ce document est une image : aucune page n\'a pu être repérée.');
  }
}

