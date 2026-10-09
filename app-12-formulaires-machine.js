/* KALEA — application (app.html) : Plan établi par nos soins, formulaires machine, coûts d'exploitation.
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · LE PLAN ÉTABLI PAR NOS SOINS (29 €)
 *   · LE FORMULAIRE : LISTE DÉROULANTE ET MAJUSCULES
 */
// ───────────────────────── début du code ─────────────────────────
// ── LE PLAN ÉTABLI PAR NOS SOINS (29 €) ──────────────────────────────
// On facture le PLAN, pas le manuel : on vend un travail (tâches, intervalles,
// périodicités établis à partir des informations disponibles), jamais la
// reproduction d'un document du constructeur. Le bouton n'automatise RIEN : il
// ouvre un e-mail pré-rempli, que l'utilisateur envoie lui-même. Aucune promesse
// de délai, aucun paiement en ligne, aucun formulaire serveur.
function lienPlanPayant(machine) {
  const m = machine || {};
  const designation = m.brand_model
    || [m.brand, m.model].filter(Boolean).join(' ').trim()
    || m.name || '—';
  const lignes = [
    trad('Bonjour, je souhaite que vous établissiez le plan d\'entretien de ma machine.'),
    '',
    trad('Informations sur la machine :'),
    // LES LIBELLÉS SONT CEUX DE LA MACHINE, pas ceux d'un formulaire de compte :
    // « Nom » seul est traduit par « Last name » en anglais (il sert au compte), ce
    // qui donnait un e-mail anglais absurde. « Nom de la machine » et « Année du
    // modèle » sont les libellés exacts, déjà traduits.
    `${trad('Nom de la machine')} : ${m.name || '—'}`,
    `${trad('Marque / modèle')} : ${designation}`,
    `${trad('Année du modèle')} : ${m.annee || m.model_year || '—'}`,
    `${trad('Catégorie')} : ${(m.category && m.category.name) || m.category || '—'}`,
    `${trad('N° de série')} : ${m.serial_number || '—'}`,
    '',
    trad('Je reste disponible pour tout renseignement complémentaire.'),
  ];
  const sujet = trad('Établissement d\'un plan d\'entretien (29 €)');
  return `mailto:support@kalea.pro?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(lignes.join('\n'))}`;
}

function brancherOffrePlan(overlay, machine) {
  const bouton = overlay.querySelector('#btn-plan-payant');
  if (!bouton) return;
  bouton.addEventListener('click', () => {
    window.location.href = lienPlanPayant(typeof machine === 'function' ? machine() : machine);
  });
}

// ── LE FORMULAIRE : LISTE DÉROULANTE ET MAJUSCULES ────────────────────
// Branche le menu déroulant des catégories : il est REMPLI LOCALEMENT (liste de
// départ + mémoire de l'appareil + ce que la base a renvoyé), il propose
// « Autre… », et la catégorie écrite à la main est retenue pour la prochaine fois.
function brancherCategorie(overlay, chargees, choisie) {
  const select = overlay.querySelector('#f-category');
  const autre = overlay.querySelector('#f-category-autre');
  if (!select || !autre) return;
  select.innerHTML = optionsCategorieListe(choisie, chargees);
  habillerSelect(select, trad('Catégorie'));
  const sentinelle = select.querySelector(`option[value="${CATEGORIE_AUTRE}"]`);
  // Une catégorie déjà enregistrée mais absente de la liste (ancienne saisie, ou
  // liste d'une autre entreprise) rouvre la saisie libre PRÉ-REMPLIE : on ne perd
  // jamais ce qui était saisi.
  const voulue = majuscules(choisie);
  const connue = categoriesUtiles(chargees).includes(voulue);
  if (voulue && !connue) autre.value = voulue;
  select.dataset.autre = ((voulue && !connue) || select.value === CATEGORIE_AUTRE) ? '1' : '0';
  const maj = () => {
    const actif = select.dataset.autre === '1';
    autre.hidden = !actif;
    if (!actif) { autre.value = ''; return; }
    // La valeur de l'option sentinelle DEVIENT le texte saisi : ainsi tous les
    // gestionnaires existants continuent de lire `#f-category.value` sans rien
    // changer, et la catégorie écrite part en base telle quelle.
    const texte = majuscules(autre.value);
    autre.value = texte;
    if (sentinelle) {
      sentinelle.value = texte || CATEGORIE_AUTRE;
      sentinelle.textContent = texte || trad('Autre…');
    }
  };
  select.addEventListener('change', () => {
    select.dataset.autre = select.value === CATEGORIE_AUTRE ? '1' : '0';
    maj();
    if (select.dataset.autre === '1' && typeof autre.focus === 'function') autre.focus();
  });
  autre.addEventListener('input', maj);
  maj();
}

// Les champs d'IDENTITÉ d'une machine sont saisis en majuscules. On les prépare
// par leur identifiant plutôt qu'un par un dans le balisage : cela couvre aussi
// les champs ajoutés par les correctifs précédents (marque, modèle, année), le
// contrôle à la frappe comme la classe d'affichage.
const CHAMPS_MAJUSCULES = ['#f-name', '#f-brand', '#f-model', '#f-serial', '#f-category-autre'];
function preparerChampsMajuscules(overlay) {
  CHAMPS_MAJUSCULES.forEach((selecteur) => {
    const champ = overlay.querySelector(selecteur);
    if (!champ) return;
    champ.classList.add('majuscules');
    champ.setAttribute('autocapitalize', 'characters');
    forcerMajuscules(champ);
  });
}

// Normalise la VALEUR des champs marqués `majuscules` au moment de l'envoi. Le
// contrôle est posé sur l'overlay, en phase de CAPTURE : il passe donc AVANT le
// gestionnaire du formulaire (les deux étant sur des éléments différents), et la
// valeur lue par l'application est déjà en majuscules. C'est ce qui garantit que
// la base ne contient pas « tondeuse » quand l'écran affiche « TONDEUSE ».
function normaliserMajusculesAEnregistrement(overlay) {
  overlay.addEventListener('submit', () => {
    overlay.querySelectorAll('input.majuscules').forEach((champ) => { champ.value = majuscules(champ.value); });
    const select = overlay.querySelector('#f-category');
    const autre = overlay.querySelector('#f-category-autre');
    if (select && autre && select.dataset.autre === '1') {
      const texte = majuscules(autre.value);
      autre.value = texte;
      const sentinelle = select.querySelector(`option[value="${CATEGORIE_AUTRE}"]`);
      if (sentinelle) { sentinelle.value = texte || CATEGORIE_AUTRE; sentinelle.textContent = texte || trad('Autre…'); }
    }
  }, true);
}

function openAddWizard(companyId, categories) {
  const today = todayIso();
  const overlay = document.createElement('div');
  // Même classe que la fiche machine (largeur 900px, jetons .mform-*) : c'est
  // le même formulaire, juste réparti sur plusieurs écrans plutôt qu'un long
  // défilement — il n'y a pas de raison qu'il ait un autre habillage.
  overlay.className = 'overlay machine-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  // Évite de demander deux fois d'affilée « chercher une photo sur le web » :
  // stepMode() la pose déjà quand il n'y a pas de carnet, et mène ensuite à
  // stepChecklist() — qui ne doit alors pas la reposer. Seul le chemin direct
  // stepUpload() → « Je n'ai pas de carnet » → stepChecklist() (sans passer
  // par stepMode) doit encore l'afficher.
  let demandePhotoWebFaite = false;

  // Dernier plan proposé par l'IA (pour le bouton « Retour » de la dernière étape)
  let dernierResultatPlan = null;

  const state = {
    name: '', category: '', brand: '', serial: '', serviceDate: today, kind: TYPE_MACHINE, annee: '',
    intervalDays: 90, reminderDays: 7, tasks: '', pendingFile: null, pendingPhotoBlob: null,
    items: null, notes: '',
    trackingMode: 'days', currentHours: null, releve: null, dernierEntretien: { mode: 'inconnu', releve: null }, modeCalendaireVoulu: false, intervalHours: 100, reminderHoursBefore: 10,
    // Second suivi, optionnel (voir SCHEMA.hasCounter2) : null tant qu'il
    // n'est pas activé, ni proposé par l'analyse ni choisi à la main.
    secondaryUnit: null, secondaryValue: null, secondaryIntervalCounter: 100, secondaryReminderCounter: 10,
    secondaryIntervalDays: FALLBACK_INTERVAL_DAYS, secondaryReminderDays: FALLBACK_REMINDER_DAYS,
    model: '',
    // TCO, facultatif (voir tcoActif()) : strict minimum à la création,
    // le reste (revente estimée, durée de vie) se règle plus tard sur la
    // fiche machine — pas de formulaire interminable ici.
    purchasePrice: '', purchaseDate: '',
  };

  function shell(inner) { overlay.innerHTML = `<div class="modal">${inner}</div>`; }

  // En-tête commun à tous les écrans de l'assistant : le picto + le nom de
  // l'écran (jamais un « étape X sur Y » — le nombre total varie selon le
  // chemin pris, promettre un total fixe serait faux), une croix qui ferme
  // tout l'assistant, et une flèche de retour optionnelle vers l'écran
  // précédent. Même croix que la fiche machine (.mform-close), même rôle.
  function enteteEtape(titre, opts = {}) {
    return `
      <div class="mform-tete">
        <div class="mform-tete-titre">
          ${opts.retour ? `<button type="button" class="mform-retour" id="wiz-back" aria-label="${esc(trad('Retour'))}">${picto('flecheGauche')}</button>` : ''}
          <h2>${titre}</h2>
        </div>
        <button type="button" class="mform-close" id="wiz-close" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
      </div>
      ${opts.sous ? `<p class="sub">${opts.sous}</p>` : ''}`;
  }
  // Cartes sélectionnables (type d'unité, mode de suivi) : même logique que la
  // fiche machine — la mise en évidence est posée en JS, :has(input:checked)
  // ne servant que de secours CSS (repaint peu fiable sur un changement
  // déclenché par script plutôt qu'un vrai clic).
  function marquerCarteSelectionnee(nomGroupe) {
    overlay.querySelectorAll(`input[name=${nomGroupe}]`).forEach((radio) => {
      radio.closest('.mform-card')?.classList.toggle('is-selected', radio.checked);
    });
  }
  // La croix ferme depuis N'IMPORTE QUEL écran : posée une fois ici plutôt que
  // recâblée à chaque `shell()`, en écoutant la zone (comme les boutons de
  // l'équipe) puisque le contenu de l'overlay est entièrement réécrit à
  // chaque étape.
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('#wiz-close')) overlay.remove();
  });

  // ★ FORMULAIRE UNIQUE — reprise Stitch (voir outils/tw-ajouter-machine/ et
  // prompt-stitch-ajouter-machine.md) : remplace les 4 écrans successifs
  // stepIdentification/stepChoice/stepUpload/stepMode + la variante
  // stepChecklist (tâches à cocher, sans carnet) par UNE page qui défile,
  // même principe que openMachineModal. Seul stepPlanChoice (l'écran
  // « Plan proposé par notre algorithme », .pplan-*) reste un écran à part
  // — volontairement, voir son commentaire plus bas : l'utilisateur doit le
  // voir et le valider explicitement, jamais un remplissage silencieux des
  // champs. `depuisPlanChoice` (bool) : cette page peut être ouverte deux
  // fois — au début (vide) et depuis « Modifier ce plan » (state déjà
  // rempli par l'analyse) ; le rendu lit `state` dans les deux cas, jamais
  // de valeur écrite en dur.
  function marquerChoixRing(nomGroupe) {
    overlay.querySelectorAll(`input[name=${nomGroupe}]`).forEach((radio) => {
      const label = radio.closest('label');
      if (!label) return;
      const on = radio.checked;
      label.classList.toggle('ring-2', on);
      label.classList.toggle('ring-primary', on);
      const ico = label.querySelector('[data-ring-ico]');
      if (ico) {
        ico.classList.toggle('bg-primary/10', on);
        ico.classList.toggle('text-primary', on);
        ico.classList.toggle('bg-slate-100', !on);
        ico.classList.toggle('text-slate-600', !on);
      }
      const check = label.querySelector('[data-ring-check]');
      if (check) {
        check.classList.toggle('bg-primary', on);
        check.classList.toggle('text-white', on);
        check.classList.toggle('border', !on);
        check.classList.toggle('border-slate-300', !on);
        check.innerHTML = on ? '<span class="material-symbols-outlined text-xs font-bold">check</span>' : '';
      }
    });
  }
  // Bloc « photo du matériel » : le même dans le formulaire (05) et dans la dernière étape.
  function photoBlocHtml(numero) {
    return `
        <section class="space-y-4">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-md">${numero}</span>
            <h2 class="text-base font-bold text-on-surface tracking-tight">${trad('Visuel & photo du matériel')}</h2>
          </div>
          <div class="bg-surface-container-low/70 rounded-xl p-5 shadow-sm">
            <div class="flex flex-col sm:flex-row items-center gap-5">
              <div class="w-32 h-32 sm:w-36 sm:h-36 rounded-xl bg-surface-container-lowest shadow-card flex flex-col items-center justify-center text-slate-400 shrink-0 border border-slate-100 overflow-hidden relative" id="photo-preview">
                <span class="material-symbols-outlined text-4xl mb-1 text-slate-300">image</span>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center px-2">${trad('Aucune photo')}</span>
              </div>
              <div class="space-y-2.5 text-center sm:text-left flex-1">
                <div class="text-xs font-bold text-slate-700">${trad('Personnaliser la photo de l\'équipement')}</div>
                <p class="text-xs text-slate-500 leading-relaxed">${trad('Une photo claire facilite l\'identification immédiate sur le terrain et sur le tableau de bord de la flotte.')}</p>
                <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <button type="button" id="pick-photo-btn" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest hover:bg-white text-on-surface text-xs font-bold shadow-subtle transition-colors"><span class="material-symbols-outlined text-base text-primary">photo_library</span><span>${trad('Choisir une photo')}</span></button>
                  <button type="button" id="shoot-photo-btn" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest hover:bg-white text-on-surface text-xs font-bold shadow-subtle transition-colors"><span class="material-symbols-outlined text-base text-primary">photo_camera</span><span>${trad('Prendre une photo')}</span></button>
                </div>
                <div class="text-xs text-slate-500 pt-0.5">
                  <a id="lien-photo-web" href="https://www.google.com/search?tbm=isch&q=" target="_blank" rel="noopener" class="text-primary font-semibold hover:underline">${trad('Chercher une photo sur Google Images →')}</a>
                  <span class="block mt-0.5">${trad('Enregistre l\'image (appui long sur téléphone), puis clique sur « Choisir une photo ». La recherche demande un fond blanc pour garder des photos homogènes.')}</span>
                </div>
                <input id="f-machine-photo" type="file" accept="image/*" hidden>
                <input id="f-machine-photo-camera" type="file" accept="image/*" capture="environment" hidden>
                <div class="hint" id="photo-status"></div>
              </div>
            </div>
          </div>
        </section>
    `;
  }

  // La requête Google Images d'une photo de machine : « fond blanc » pour que toutes les photos du parc se
  // ressemblent. Année et motorisation sont gardées (la carrosserie change d'une génération à l'autre) ; l'unité
  // de puissance (« ch ») est retirée. Rien n'est téléchargé par KALEA : le client choisit et enregistre l'image.
  function adresseGoogleImages(vehicule, annee, motorisation) {
    const moteur = String(motorisation || '').replace(/\b(ch|cv|hp|chevaux)\b\.?/gi, '').replace(/\s+/g, ' ').trim();
    const termes = [vehicule, annee, moteur, LANGUE === 'en' ? 'white background' : 'fond blanc'].filter(Boolean).join(' ');
    return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(termes);
  }

  // ── DERNIÈRE ÉTAPE — après « Suivre ce plan » / « Faire mon propre plan » ────────────────────
  // Ces deux choix enregistraient la machine AU CLIC : la photo (en bas du formulaire) et le relevé du compteur
  // (caché tant que le suivi était « calendaire », le choix par défaut) n'avaient jamais l'occasion d'être
  // renseignés. On passe maintenant par cet écran court, puis seulement on enregistre.
  function stepDerniereEtape() {
    // Même habillage que le formulaire (classes Tailwind compilées sous .machine-modal-add).
    overlay.className = 'overlay machine-modal-add';
    const compteur = state.trackingMode !== 'days';
    // Suivi calendaire : le relevé n'est redemandé que s'il n'a pas été saisi plus tôt (il est quand même gardé sur la machine).
    const demanderReleve = compteur || (state.releve == null && !state.modeCalendaireVoulu);
    const unite = COUNTER_UNITS[compteur ? counterUnitFromMode(state.trackingMode) : (state.kind === TYPE_VEHICULE ? 'km' : 'hours')];
    const releveHtml = demanderReleve ? `
        <section class="space-y-4">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-md">01</span>
            <h2 class="text-base font-bold text-on-surface tracking-tight">${trad('Relevé actuel du compteur')}</h2>
          </div>
          <div class="bg-surface-container-low/70 rounded-xl p-5 shadow-sm">
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-current-hours">${unite.field} <span class="text-primary">*</span></label>
            <input id="f-current-hours" type="number" min="0" step="${unite.step}" inputmode="decimal" required class="w-full sm:w-1/3 h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm text-on-surface font-semibold shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow" value="${state.releve ?? ''}" placeholder="${unite.placeholder}">
            <div class="text-xs text-slate-500 mt-1.5">${trad('Obligatoire : sert à calculer les premières échéances. Mets 0 si la machine est neuve.')}</div>
          </div>
        </section>` : '';
    overlay.innerHTML = `
      <div class="w-full max-w-4xl bg-modal-bg rounded-2xl shadow-modal flex flex-col max-h-[92vh] overflow-hidden border-0">
        <header class="bg-modal-bg px-6 sm:px-8 py-5 flex items-center justify-between border-b border-slate-200/70 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-2xl">flag</span>
            </div>
            <div>
              <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-on-surface">${trad('Dernière étape')}</h1>
              <p class="text-xs sm:text-sm text-slate-500 font-medium">${esc(state.name || '')} — ${demanderReleve ? trad('Une photo et le relevé actuel, puis la machine est ajoutée.') : trad('Une photo, puis la machine est ajoutée.')}</p>
            </div>
          </div>
          <button type="button" id="wiz-close" class="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-on-surface hover:bg-slate-200/80 transition-colors" aria-label="${esc(trad('Fermer'))}">
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        <form id="step-final" class="flex-1 flex flex-col min-h-0">
        <main class="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-7">
        ${releveHtml}
        ${photoBlocHtml(demanderReleve ? '02' : '01')}
        <div class="hint" id="f-error"></div>
        <div class="hint" id="f-manque"></div>
        </main>

        <footer class="bg-modal-bg px-6 sm:px-8 py-4 flex items-center justify-between border-t border-slate-200/70 shrink-0">
          <button type="button" id="final-retour" class="px-5 py-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold transition-colors">${trad('Retour')}</button>
          <button type="submit" class="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-tertiary-container hover:bg-tertiary-container-hover text-white text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.99]">
            <span class="material-symbols-outlined text-base">add_circle</span><span>${trad('Enregistrer la machine')}</span>
          </button>
        </footer>
        </form>
      </div>
    `;
    overlay.querySelector('#final-retour').addEventListener('click', () => stepPlanChoice(dernierResultatPlan || { items: state.items }));
    // Photo : mêmes boutons et même envoi que dans le formulaire ; l'aperçu reprend une photo déjà choisie.
    brancherPhotoManuelle(overlay, { apercu: '#photo-preview', surState: state });
    const apercu = overlay.querySelector('#photo-preview');
    if (apercu && state.pendingPhotoBlob && !apercu.querySelector('img')) {
      apercu.innerHTML = `<img class="machine-photo" src="${URL.createObjectURL(state.pendingPhotoBlob)}" alt="">`;
    }
    const lienPhoto = overlay.querySelector('#lien-photo-web');
    if (lienPhoto) {
      ['pointerdown', 'mouseenter', 'focus', 'touchstart'].forEach((ev) => lienPhoto.addEventListener(ev, () => {
        lienPhoto.href = adresseGoogleImages(designation(state.brand, state.model, state.name), state.annee, state.motorisation);
      }, { passive: true }));
    }
    // Photo obligatoire : « Enregistrer la machine » reste grisé tant qu'aucune photo n'est choisie.
    const boutonFinal = overlay.querySelector('#step-final button[type=submit]');
    const majBoutonFinal = () => {
      const ok = !!state.pendingPhotoBlob;
      if (boutonFinal) boutonFinal.disabled = !ok;
      const aide = overlay.querySelector('#f-manque');
      if (aide) aide.textContent = ok ? '' : trad('Pour enregistrer, il manque : la photo de la machine.');
    };
    if (apercu) new MutationObserver(majBoutonFinal).observe(apercu, { childList: true, subtree: true });
    majBoutonFinal();
    overlay.querySelector('#step-final').addEventListener('submit', (e) => {
      e.preventDefault();
      const erreur = overlay.querySelector('#f-error');
      if (!state.pendingPhotoBlob) { majBoutonFinal(); return; }
      if (demanderReleve) {
        const valeur = nombreDepuisTexte(overlay.querySelector('#f-current-hours').value);
        if (valeur == null || valeur < 0) { erreur.textContent = trad('Indique le relevé actuel (0 si la machine est neuve).'); return; }
        state.releve = valeur;
      }
      state.currentHours = compteur ? state.releve : null;
      erreur.textContent = '';
      saveMachine(e.currentTarget.querySelector('button[type=submit]'), erreur);
    });
  }

  function stepFormUnique() {
    overlay.className = 'overlay machine-modal-add';
    const mode = state.trackingMode;
    const unit = COUNTER_UNITS[counterUnitFromMode(mode)];
    const isCounter = mode !== 'days';
    // Le relevé se demande dès l'identification : en km pour un véhicule, en heures pour une machine (puis suit le mode choisi).
    const uniteReleve = COUNTER_UNITS[mode !== 'days' ? counterUnitFromMode(mode) : (state.kind === TYPE_VEHICULE ? 'km' : 'hours')];
    // Le lien « Chercher le manuel sur le web » est recalculé AU CLIC (voir adresseRechercheManuel) : à ce stade le
    // formulaire vient d'être dessiné, la marque et le modèle ne sont pas encore saisis.
    const query = encodeURIComponent("operator's manual maintenance schedule filetype:pdf");
    const queryAtelier = encodeURIComponent('service manual workshop manual filetype:pdf');
    // Pas shell() ici : elle enveloppe déjà dans <div class="modal"> (480px,
    // la modale générique de l'app) — cette page porte son PROPRE conteneur
    // Tailwind compilé (w-full max-w-4xl…), un second wrapper l'aurait
    // piégée dans les 480px de l'autre.
    overlay.innerHTML = `
      <div class="w-full max-w-4xl bg-modal-bg rounded-2xl shadow-modal flex flex-col max-h-[92vh] overflow-hidden border-0">
        <header class="bg-modal-bg px-6 sm:px-8 py-5 flex items-center justify-between border-b border-slate-200/70 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-2xl">add_circle</span>
            </div>
            <div>
              <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-on-surface">${trad('Ajouter une machine')}</h1>
              <p class="text-xs sm:text-sm text-slate-500 font-medium">${trad('Elle apparaîtra immédiatement dans la liste, avec son plan de maintenance.')}</p>
            </div>
          </div>
          <button type="button" id="wiz-close" class="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-on-surface hover:bg-slate-200/80 transition-colors" aria-label="${esc(trad('Fermer'))}">
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        <form id="step-form" class="flex-1 flex flex-col min-h-0">
        <main class="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-7">

        <section class="space-y-4">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-md">01</span>
            <h2 class="text-base font-bold text-on-surface tracking-tight">${trad('Identification du matériel')}</h2>
          </div>
          <div class="bg-surface-container-low/70 rounded-xl p-5 shadow-sm space-y-5">
            ${SCHEMA.hasKind ? `
            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">${trad('Type d\'unité de surveillance principale')}</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="f-kind-cards">
                <label class="relative flex items-center p-3.5 bg-surface-container-lowest rounded-xl shadow-subtle cursor-pointer transition-all">
                  <input type="radio" name="kind" value="${TYPE_MACHINE}" class="sr-only" ${state.kind === TYPE_MACHINE ? 'checked' : ''}>
                  <div class="w-9 h-9 rounded-lg flex items-center justify-center mr-3 shrink-0" data-ring-ico>
                    <span class="material-symbols-outlined">agriculture</span>
                  </div>
                  <div class="flex-1">
                    <div class="text-sm font-bold text-on-surface">${trad('Machine / Engin de chantier')}</div>
                    <div class="text-xs text-slate-500">${trad('Compteur horaire (horamètre)')}</div>
                  </div>
                  <div class="w-5 h-5 rounded-full ml-2 flex items-center justify-center" data-ring-check></div>
                </label>
                <label class="relative flex items-center p-3.5 bg-surface-container-lowest rounded-xl shadow-subtle cursor-pointer transition-all">
                  <input type="radio" name="kind" value="${TYPE_VEHICULE}" class="sr-only" ${state.kind === TYPE_VEHICULE ? 'checked' : ''}>
                  <div class="w-9 h-9 rounded-lg flex items-center justify-center mr-3 shrink-0" data-ring-ico>
                    <span class="material-symbols-outlined">local_shipping</span>
                  </div>
                  <div class="flex-1">
                    <div class="text-sm font-bold text-on-surface">${trad('Véhicule roulant / Fourgon')}</div>
                    <div class="text-xs text-slate-500">${trad('Odomètre kilométrique (km)')}</div>
                  </div>
                  <div class="w-5 h-5 rounded-full ml-2 flex items-center justify-center" data-ring-check></div>
                </label>
              </div>
            </div>` : ''}

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-name">${trad('Nom de la machine')} <span class="text-primary">*</span></label>
                <input type="text" id="f-name" class="majuscules w-full h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow placeholder:text-slate-400 font-medium" autocapitalize="characters" required placeholder="${trad('Ex. OREC 4X4 - ATELIER')}" value="${esc(state.name)}">
              </div>
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-category">${trad('Catégorie')} <span class="text-primary">*</span></label>
                <select id="f-category" class="w-full h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow font-medium" required>${optionsCategorieListe(state.category, categories)}</select>
              </div>
            </div>
            <input id="f-category-autre" class="majuscules w-full h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow placeholder:text-slate-400 font-medium" autocapitalize="characters" placeholder="${trad('Ex. DÉBROUSSAILLEUSE À DOS')}" hidden>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-brand">${trad('Marque')}</label>
                <input type="text" id="f-brand" class="majuscules w-full h-11 px-3 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow placeholder:text-slate-400 font-medium" placeholder="${trad('Ex. KUBOTA')}" autocapitalize="characters" value="${esc(state.brand)}">
              </div>
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-model">${trad('Modèle')}</label>
                <input type="text" id="f-model" class="majuscules w-full h-11 px-3 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow placeholder:text-slate-400 font-medium" placeholder="${trad('Ex. U17-3')}" autocapitalize="characters" value="${esc(state.model)}">
              </div>
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-year">${trad('Année du modèle')}</label>
                <input type="number" id="f-year" inputmode="numeric" min="1950" max="2100" class="w-full h-11 px-3 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow placeholder:text-slate-400 font-medium" placeholder="${trad('Ex. 2019')}" value="${esc(state.annee)}">
              </div>
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-service-date">${trad('Date de mise en service')}</label>
                <input id="f-service-date" type="date" class="w-full h-11 px-3 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow font-medium" value="${esc(state.serviceDate)}" required>
              </div>
            </div>
            <div class="text-xs text-slate-500 -mt-2">${trad('Précise l\'année : un même modèle change parfois beaucoup d\'une version à l\'autre — la fiche et la photo aussi.')}</div>

            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-motorisation">${trad('Motorisation (facultatif)')}</label>
              <input id="f-motorisation" type="text" autocomplete="off" class="w-full h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow placeholder:text-slate-400 font-medium" placeholder="${trad('Ex. PureTech 100, BlueHDi 130, 2.0 TDI')}" value="${esc(state.motorisation || '')}">
              <div class="text-xs text-slate-500 mt-1.5">${trad('Sert à trouver le bon plan d\'entretien sur le web (il change selon le moteur). Non enregistré.')}</div>
            </div>

            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-serial" id="f-identifiant-label">${IDENTIFIANT_LIBELLE[state.kind]}</label>
              <input id="f-serial" class="w-full h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow placeholder:text-slate-400 font-medium" placeholder="${IDENTIFIANT_PLACEHOLDER[state.kind]}" value="${esc(state.serial)}">
            </div>

            <div id="hours-field">
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-current-hours"><span id="f-current-hours-label">${uniteReleve.field}</span> <span class="text-primary">*</span></label>
              <input id="f-current-hours" type="number" min="0" step="${uniteReleve.step}" inputmode="decimal" class="w-full sm:w-1/3 h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm text-on-surface font-semibold shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow" value="${state.releve ?? ''}" placeholder="${uniteReleve.placeholder}" ${state.modeCalendaireVoulu ? '' : 'required'}>
              <div class="text-xs text-slate-500 mt-1.5">${trad('Obligatoire : sert à calculer les premières échéances. Mets 0 si la machine est neuve.')}</div>
            </div>

            <div id="dernier-entretien-bloc"${state.modeCalendaireVoulu ? ' style="display:none"' : ''}>
              <div class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">${trad('Dernier entretien (facultatif)')}</div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3" id="f-dernier-cartes">
                ${[['inconnu', 'Je ne sais pas', 'Départ du relevé actuel'], ['jamais', 'Jamais fait', 'Échéance au premier intervalle'], ['fait', 'Déjà fait', 'Départ du relevé indiqué']].map(([v, titre, sous]) => `
                <label class="relative flex flex-col p-3 bg-surface-container-lowest rounded-xl shadow-subtle cursor-pointer transition-all">
                  <input type="radio" name="dern" value="${v}" class="sr-only" ${((state.dernierEntretien && state.dernierEntretien.mode) || 'inconnu') === v ? 'checked' : ''}>
                  <div class="text-sm font-bold text-on-surface">${trad(titre)}</div>
                  <div class="text-[11px] text-slate-500">${trad(sous)}</div>
                </label>`).join('')}
              </div>
              <div id="f-dernier-releve-ligne" class="mt-3" style="display:${state.dernierEntretien && state.dernierEntretien.mode === 'fait' ? 'block' : 'none'};">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-dernier-releve">${trad('Relevé lors du dernier entretien')}</label>
                <input id="f-dernier-releve" type="number" min="0" step="any" inputmode="decimal" class="w-full sm:w-1/3 h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm text-on-surface font-semibold shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow" value="${state.dernierEntretien && state.dernierEntretien.releve != null ? state.dernierEntretien.releve : ''}">
              </div>
              <div class="text-xs text-slate-500 mt-1.5">${trad('Sert à calculer la prochaine échéance : sans cette information, KALEA part du relevé actuel.')}</div>
            </div>

            ${tcoActif() ? `
            <div class="pt-2 border-t border-slate-200/60">
              <details class="group">
                <summary class="flex items-center justify-between cursor-pointer py-1.5 text-xs font-bold text-slate-600 hover:text-primary list-none select-none">
                  <span class="flex items-center gap-2"><span class="material-symbols-outlined text-base">payments</span>${trad('Acquisition & TCO (facultatif)')}</span>
                  <span class="material-symbols-outlined text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                </summary>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-1">
                  <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" for="f-prix-achat">${tR('Prix d\'achat ({unite})', { unite: deviseCourte() })}</label>
                    <input id="f-prix-achat" type="text" inputmode="decimal" class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow font-medium" placeholder="${trad('Ex. 25000')}" value="${esc(state.purchasePrice)}">
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" for="f-date-achat">${trad('Date d\'achat')}</label>
                    <input id="f-date-achat" type="date" class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow font-medium" value="${esc(state.purchaseDate || state.serviceDate)}">
                  </div>
                  <div>
                    <label id="f-duree-vie-etiquette" class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" for="f-duree-vie">${tR('Durée de vie ({unite})', { unite: trad('heures') })}</label>
                    <input id="f-duree-vie" type="text" inputmode="numeric" class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow font-medium" placeholder="${trad('Ex. 10000')}" value="${state.lifespan != null ? texteAvecSeparateurs(state.lifespan) : ''}">
                  </div>
                </div>
                <div class="text-[11px] text-slate-500 pt-2" id="f-duree-vie-note"></div>
                <div class="text-[11px] text-slate-500 pt-2">${trad('Sert à calculer le coût total de possession (TCO) de la machine — laisse vide si tu ne le sais pas, tu pourras le renseigner plus tard.')}</div>
              </details>
            </div>` : ''}
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-md">02</span>
              <h2 class="text-base font-bold text-on-surface tracking-tight">${trad('Carnet d\'entretien du constructeur')}</h2>
            </div>
            <span class="text-xs font-semibold text-slate-500 bg-slate-200/60 px-2.5 py-0.5 rounded-full">${trad('Recommandé')}</span>
          </div>
          <div class="bg-surface-container-low/70 rounded-xl p-5 shadow-sm space-y-4">
            <div class="mform-carnet-ligne">
              <div class="mform-carnet-zone">
                ${dropzoneHtml('f-manual-drop')}
                <input id="f-manual" type="file" accept="application/pdf,image/*" multiple hidden>
                <div class="hint" id="f-manual-statut"></div>
              </div>
              <button type="button" id="btn-camera" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container text-slate-700 hover:bg-slate-200 transition-colors text-xs font-bold shadow-subtle shrink-0">
                <span class="material-symbols-outlined text-base">photo_camera</span><span>${trad('Photographier le carnet')}</span>
              </button>
            </div>
            <input id="f-camera" type="file" accept="image/*" capture="environment" hidden>
            <div class="pages-carnet" id="pages-carnet"></div>
            <div class="pages-utiles" id="pages-utiles"></div>
            <div class="hint" id="f-analysis"></div>

            <div class="bg-tertiary-light rounded-xl p-4 sm:p-5 shadow-card border-l-4 border-tertiary-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-tertiary-container/15 text-tertiary-container flex items-center justify-center shrink-0 mt-0.5">
                  <span class="material-symbols-outlined text-xl">contact_support</span>
                </div>
                <div class="space-y-1">
                  <div class="text-sm font-bold text-on-surface">${trad('Vous ne trouvez pas votre carnet ?')}</div>
                  <p class="text-xs text-slate-600 leading-relaxed max-w-xl">${trad('Pour 29 € (paiement unique), nous configurons votre plan d\'entretien modifiable directement dans l\'application (aucun manuel constructeur fourni). Si les données de la machine sont insuffisantes, nous vous avertissons avant tout paiement, sans rien inventer.')}</p>
                </div>
              </div>
              <button type="button" id="btn-plan-payant" class="shrink-0 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-tertiary-container hover:bg-tertiary-container-hover text-white text-xs font-bold transition-all shadow-subtle">
                <span>${trad('Demander l\'établissement de mon plan — 29 €')}</span><span class="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
            <div class="text-xs text-slate-500"><a id="lien-manuel-web" href="https://www.google.com/search?q=${query}" target="_blank" rel="noopener" class="text-primary font-semibold hover:underline">${trad('Chercher le manuel du fabricant sur le web →')}</a>
              <div class="mt-1"><a id="lien-manuel-atelier" href="https://www.google.com/search?q=${queryAtelier}" target="_blank" rel="noopener" class="text-slate-500 font-semibold hover:underline" title="${trad("Plus détaillé (réparations, couples de serrage), mais souvent plus long et parfois payant. Le manuel d'utilisation suffit en général pour le planning d'entretien.")}">${trad("Manuel d'atelier (service manual) →")}</a></div></div>
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-md">03</span>
            <h2 class="text-base font-bold text-on-surface tracking-tight">${trad('Mode de suivi & échéances d\'entretien')}</h2>
          </div>
          <div class="bg-surface-container-low/70 rounded-xl p-5 shadow-sm space-y-5">
            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">${trad('Mode de suivi de la maintenance')}</label>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label class="relative flex flex-col p-3.5 bg-surface-container-lowest rounded-xl shadow-subtle cursor-pointer transition-all">
                  <input type="radio" name="tm" value="days" class="sr-only" ${mode === 'days' ? 'checked' : ''}>
                  <div class="flex items-center justify-between mb-2">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center" data-ring-ico><span class="material-symbols-outlined text-lg">calendar_month</span></div>
                    <div class="w-4 h-4 rounded-full" data-ring-check></div>
                  </div>
                  <div class="text-sm font-bold text-on-surface">${trad('Calendaire')}</div>
                  <div class="text-[11px] text-slate-500">${trad('Jours / semaines')}</div>
                </label>
                <label class="relative flex flex-col p-3.5 bg-surface-container-lowest rounded-xl shadow-subtle cursor-pointer transition-all">
                  <input type="radio" name="tm" value="hours" class="sr-only" ${mode === 'hours' ? 'checked' : ''}>
                  <div class="flex items-center justify-between mb-2">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center" data-ring-ico><span class="material-symbols-outlined text-lg">hourglass_top</span></div>
                    <div class="w-4 h-4 rounded-full" data-ring-check></div>
                  </div>
                  <div class="text-sm font-bold text-on-surface">${trad('Compteur horaire')}</div>
                  <div class="text-[11px] text-slate-500">${trad('Horamètre en heures (h)')}</div>
                </label>
                ${SCHEMA.hasCounter ? `<label class="relative flex flex-col p-3.5 bg-surface-container-lowest rounded-xl shadow-subtle cursor-pointer transition-all">
                  <input type="radio" name="tm" value="km" class="sr-only" ${mode === trad('km') ? 'checked' : ''}>
                  <div class="flex items-center justify-between mb-2">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center" data-ring-ico><span class="material-symbols-outlined text-lg">speed</span></div>
                    <div class="w-4 h-4 rounded-full" data-ring-check></div>
                  </div>
                  <div class="text-sm font-bold text-on-surface">${trad('Kilométrage')}</div>
                  <div class="text-[11px] text-slate-500">${trad('Odomètre en kilomètres (km)')}</div>
                </label>` : ''}
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-interval" id="f-interval-label">${tR('Échéance {mode}', { mode: isCounter ? tR('tous les ({unite})', { unite: unit.word }) : trad('toutes les (jours)') })}</label>
                <input id="f-interval" type="number" min="1" class="w-full h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm text-on-surface font-semibold shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow" value="${isCounter ? state.intervalHours : state.intervalDays}" required>
              </div>
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" for="f-reminder" id="f-reminder-label">${tR('Rappel avant ({unite})', { unite: isCounter ? unit.word : trad('jours') })}</label>
                <input id="f-reminder" type="number" min="0" class="w-full h-11 px-3.5 rounded-xl bg-surface-container-lowest text-sm text-on-surface font-semibold shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow" value="${isCounter ? state.reminderHoursBefore : state.reminderDays}" required>
              </div>
            </div>

            ${SCHEMA.hasCounter2 ? `
            <div class="pt-3 border-t border-slate-200/60">
              <label class="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" id="f-secondaire-active" class="w-4 h-4 rounded text-primary focus:ring-primary focus:ring-offset-0 border-slate-300" ${state.secondaryUnit ? 'checked' : ''}>
                <span class="text-xs font-bold text-slate-700">${trad('Ajouter un second suivi (le carnet mélange plusieurs unités, ex. heures ET km)')}</span>
              </label>
              <div id="secondaire-champs" class="mt-3 p-4 bg-surface-container-lowest rounded-xl shadow-subtle space-y-3" style="display:${state.secondaryUnit ? 'flex' : 'none'};flex-direction:column;">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label class="p-2.5 flex items-center gap-2 rounded-lg bg-surface-container-low cursor-pointer" id="carte-secondaire-hours" style="display:${mode === 'hours' ? 'none' : 'flex'};">
                    <input type="radio" name="tm2" value="hours" ${state.secondaryUnit === 'hours' ? 'checked' : ''}>
                    <span class="material-symbols-outlined text-base text-primary">hourglass_top</span>
                    <span class="text-xs font-bold text-on-surface">${trad('Compteur horaire')}</span>
                  </label>
                  <label class="p-2.5 flex items-center gap-2 rounded-lg bg-surface-container-low cursor-pointer" id="carte-secondaire-km" style="display:${mode === 'km' ? 'none' : 'flex'};">
                    <input type="radio" name="tm2" value="km" ${state.secondaryUnit === 'km' ? 'checked' : ''}>
                    <span class="material-symbols-outlined text-base text-primary">speed</span>
                    <span class="text-xs font-bold text-on-surface">${trad('Kilométrage')}</span>
                  </label>
                  <label class="p-2.5 flex items-center gap-2 rounded-lg bg-surface-container-low cursor-pointer" id="carte-secondaire-days" style="display:${mode === 'days' ? 'none' : 'flex'};">
                    <input type="radio" name="tm2" value="days" ${state.secondaryUnit === 'days' ? 'checked' : ''}>
                    <span class="material-symbols-outlined text-base text-primary">calendar_month</span>
                    <span class="text-xs font-bold text-on-surface">${trad('Calendaire')}</span>
                  </label>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3" id="secondaire-valeur-row" style="display:${state.secondaryUnit === 'days' ? 'none' : 'flex'};">
                  <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" for="f-secondaire-valeur">${trad('Relevé actuel')}</label>
                    <input id="f-secondaire-valeur" type="number" min="0" class="w-full h-10 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface font-semibold border-0" value="${state.secondaryValue ?? ''}">
                  </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" for="f-secondaire-interval" id="f-secondaire-interval-label">${tR('Échéance tous les ({unite})', { unite: state.secondaryUnit === 'days' ? trad('jours') : (COUNTER_UNITS[state.secondaryUnit || 'hours'] || COUNTER_UNITS.hours).word })}</label>
                    <input id="f-secondaire-interval" type="number" min="1" class="w-full h-10 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface font-semibold border-0" value="${state.secondaryUnit === 'days' ? state.secondaryIntervalDays : state.secondaryIntervalCounter}">
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" for="f-secondaire-reminder" id="f-secondaire-reminder-label">${tR('Rappel avant ({unite})', { unite: state.secondaryUnit === 'days' ? trad('jours') : (COUNTER_UNITS[state.secondaryUnit || 'hours'] || COUNTER_UNITS.hours).word })}</label>
                    <input id="f-secondaire-reminder" type="number" min="0" class="w-full h-10 px-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface font-semibold border-0" value="${state.secondaryUnit === 'days' ? state.secondaryReminderDays : state.secondaryReminderCounter}">
                  </div>
                </div>
              </div>
            </div>` : ''}
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-md">04</span>
              <h2 class="text-base font-bold text-on-surface tracking-tight">${trad('Tâches de maintenance')}</h2>
            </div>
          </div>
          <div class="bg-surface-container-low/70 rounded-xl p-5 shadow-sm space-y-2">
            <textarea id="f-tasks" rows="3" class="w-full p-3.5 rounded-xl bg-surface-container-lowest text-sm text-on-surface shadow-subtle focus:outline-none focus:ring-2 focus:ring-primary border-0 transition-shadow placeholder:text-slate-400 font-medium" placeholder="${trad('Ex. Vidange, contrôle lame, graissage')}">${esc(state.tasks)}</textarea>
          </div>
        </section>

        ${photoBlocHtml('05')}

        <div class="hint" id="f-error"></div>
        <div class="hint" id="f-manque"></div>
        </main>

        <footer class="bg-modal-bg px-6 sm:px-8 py-4 flex items-center justify-between border-t border-slate-200/70 shrink-0">
          <button type="button" id="cancel" class="px-5 py-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold transition-colors">${trad('Annuler')}</button>
          <button type="submit" class="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-tertiary-container hover:bg-tertiary-container-hover text-white text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.99]">
            <span class="material-symbols-outlined text-base">add_circle</span><span>${trad('Ajouter la machine')}</span>
          </button>
        </footer>
        </form>
      </div>
    `;
    overlay.querySelector('#cancel').addEventListener('click', () => overlay.remove());
    habillerChampDate(overlay.querySelector('#f-service-date'), trad('Date de mise en service'));
    habillerChampDate(overlay.querySelector('#f-date-achat'), trad('Date d\'achat'));
    forcerMajuscules(overlay.querySelector('#f-brand'));
    forcerMajuscules(overlay.querySelector('#f-model'));

    // ── 01 — Identification ────────────────────────────────────────────
    const radiosKind = overlay.querySelectorAll('input[name=kind]');
    if (radiosKind.length) {
      marquerChoixRing('kind');
      const ancienType = overlay.querySelector('input[name=kind]:checked')?.value || TYPE_MACHINE;
      radiosKind.forEach((radio) => radio.addEventListener('change', () => {
        marquerChoixRing('kind');
        const kind = overlay.querySelector('input[name=kind]:checked').value;
        const label = overlay.querySelector('#f-identifiant-label');
        if (label) label.textContent = IDENTIFIANT_LIBELLE[kind];
        majLibelleReleve();
        const champ = overlay.querySelector('#f-serial');
        if (champ) champ.placeholder = IDENTIFIANT_PLACEHOLDER[kind];
        if (Number(state.intervalHours) === INTERVALLE_DEFAUT[ancienType]) {
          state.intervalHours = INTERVALLE_DEFAUT[kind];
        }
      }));
    }
    preparerChampsMajuscules(overlay);
    normaliserMajusculesAEnregistrement(overlay);
    brancherCategorie(overlay, categories, state.category);
    if (tcoActif()) {
      activerSeparateurMilliers(overlay.querySelector('#f-prix-achat'));
      activerSeparateurMilliers(overlay.querySelector('#f-duree-vie'));
      brancherDureeVie(overlay, true);
    }

    // ★ Lit TOUS les champs du formulaire unique dans `state` — factorisé
    // car il y a désormais DEUX façons de quitter cette page, pas une
    // seule : le vrai submit (bouton « Ajouter la machine »), MAIS AUSSI
    // le dépôt d'un carnet, qui déclenche l'analyse puis saute directement
    // vers stepPlanChoice (apresCarnet, plus bas) SANS jamais passer par le
    // submit. Avant ce correctif, stepPlanChoice appelait saveMachine avec
    // un `state` resté aux valeurs par défaut du formulaire — nom, catégorie,
    // marque… jamais lus — d'où des machines créées sans aucune donnée,
    // signalé par l'utilisateur avec capture à l'appui.
    // L'adresse de la recherche du manuel, d'après ce qui est SAISI maintenant : « Peugeot 208 2026 manuel entretien
    // filetype:pdf » plutôt que le « manuel entretien » tout court qui partait avant, sans véhicule.
    // Les termes dépendent du type d'unité : un ENGIN (heures) a son tableau d'entretien dans la notice d'utilisation
    // (« operator's manual », en anglais chez presque tous les constructeurs) ; un VÉHICULE (km) l'a dans le plan
    // d'entretien — la notice d'une voiture (ex. « MY PEUGEOT 208 », 276 pages) ne donne que les contrôles de base et
    // arrivait en tête des résultats. Pour un véhicule : expression EXACTE « plan d'entretien » (ce que portent les PDF
    // des constructeurs) et PAS d'année, car ces documents sont classés par génération et par moteur (testé 2026-10-06).
    function adresseRechercheManuel(atelier) {
      const champ = (sel) => (overlay.querySelector(sel)?.value || '').trim();
      const vehicule = designation(champ('#f-brand'), champ('#f-model'), champ('#f-name'));
      const roulant = (overlay.querySelector('input[name="kind"]:checked')?.value || state.kind) === TYPE_VEHICULE;
      // « PureTech 100 ch » : l'unité de puissance n'est jamais dans le titre des documents et fausse la recherche
      const moteur = champ('#f-motorisation').replace(/\b(ch|cv|hp|chevaux)\b\.?/gi, '').replace(/\s+/g, ' ').trim();
      let termes;
      if (atelier) termes = [vehicule, moteur, champ('#f-year'), 'service manual workshop manual', 'filetype:pdf'];
      else if (roulant) termes = [vehicule, moteur, LANGUE === 'en' ? '"service schedule"' : '"plan d\'entretien"', 'filetype:pdf'];
      else termes = [vehicule, champ('#f-year'), "operator's manual maintenance schedule", 'filetype:pdf'];
      return 'https://www.google.com/search?q=' + encodeURIComponent(termes.filter(Boolean).join(' '));
    }
    // Photo : même principe, sur Google Images, avec « fond blanc » pour que toutes les photos du parc se ressemblent.
    // Année et motorisation sont gardées ici (contrairement au plan d'entretien) : la carrosserie change d'une
    // génération à l'autre. Rien n'est téléchargé par KALEA : le client choisit et enregistre lui-même l'image.
    function adresseRecherchePhoto() {
      const champ = (sel) => (overlay.querySelector(sel)?.value || '').trim();
      return adresseGoogleImages(designation(champ('#f-brand'), champ('#f-model'), champ('#f-name')), champ('#f-year'), champ('#f-motorisation'));
    }
    // Mis à jour dès qu'on s'en approche (survol, focus, appui) : le clic, le clic du milieu et l'appui long suivent
    // tous l'adresse à jour.
    [['#lien-manuel-web', () => adresseRechercheManuel(false)], ['#lien-manuel-atelier', () => adresseRechercheManuel(true)], ['#lien-photo-web', adresseRecherchePhoto]].forEach(([sel, adresse]) => {
      const lien = overlay.querySelector(sel);
      if (!lien) return;
      ['pointerdown', 'mouseenter', 'focus', 'touchstart'].forEach((ev) => lien.addEventListener(ev, () => { lien.href = adresse(); }, { passive: true }));
    });
    function lireFormulaireDansState() {
      state.name = majuscules(overlay.querySelector('#f-name').value);
      state.category = majuscules(overlay.querySelector('#f-category').value);
      // « Autre… » choisi mais aucun nom écrit : la valeur de la liste vaut alors le mot « AUTRE »,
      // qui partirait en base comme une vraie catégorie. On le détecte ici et on demandera le nom.
      const champAutre = overlay.querySelector('#f-category-autre');
      state.categorieManquante = !state.category || (!!champAutre && !champAutre.hidden && !champAutre.value.trim());
      if (state.categorieManquante) state.category = '';
      if (state.category) retenirCategorie(state.category);
      state.brand = overlay.querySelector('#f-brand').value.trim();
      state.model = overlay.querySelector('#f-model').value.trim();
      state.annee = overlay.querySelector('#f-year') ? overlay.querySelector('#f-year').value.trim() : '';
      state.serial = overlay.querySelector('#f-serial').value.trim();
      state.motorisation = overlay.querySelector('#f-motorisation') ? overlay.querySelector('#f-motorisation').value.trim() : '';
      state.kind = radiosKind.length ? (overlay.querySelector('input[name=kind]:checked')?.value || TYPE_MACHINE) : TYPE_MACHINE;
      state.serviceDate = overlay.querySelector('#f-service-date').value;
      if (tcoActif()) {
        const prix = nombreDepuisTexte(overlay.querySelector('#f-prix-achat')?.value);
        state.purchasePrice = prix == null ? '' : prix;
        state.purchaseDate = overlay.querySelector('#f-date-achat')?.value || '';
        state.lifespan = nombreDepuisTexte(overlay.querySelector('#f-duree-vie')?.value);
      }
      state.tasks = overlay.querySelector('#f-tasks').value.trim();
      state.items = overlay._aiItems || state.items || null;
      state.notes = overlay._aiNotes || state.notes || '';
      state.trackingMode = overlay.querySelector('input[name=tm]:checked').value;
      state.releve = nombreDepuisTexte(overlay.querySelector('#f-current-hours')?.value);
      const modeDernier = overlay.querySelector('input[name=dern]:checked')?.value || 'inconnu';
      state.dernierEntretien = { mode: modeDernier, releve: modeDernier === 'fait' ? nombreDepuisTexte(overlay.querySelector('#f-dernier-releve')?.value) : null };
      state.currentHours = state.trackingMode !== 'days' ? (state.releve ?? 0) : null;
      const intervalValue = parseInt(overlay.querySelector('#f-interval').value, 10);
      const reminderValue = parseInt(overlay.querySelector('#f-reminder').value, 10);
      if (state.trackingMode !== 'days') {
        state.intervalHours = intervalValue;
        state.reminderHoursBefore = reminderValue;
        state.intervalDays = overlay._aiIntervalDays || state.intervalDays;
      } else {
        state.intervalDays = intervalValue;
        state.reminderDays = reminderValue;
        state.intervalHours = overlay._aiIntervalHours || state.intervalHours;
      }
      const caseSecondaireActive = overlay.querySelector('#f-secondaire-active');
      if (caseSecondaireActive?.checked) {
        const radioSecondaire = overlay.querySelector('input[name=tm2]:checked');
        state.secondaryUnit = radioSecondaire ? radioSecondaire.value : null;
        const enCalendrier = state.secondaryUnit === 'days';
        state.secondaryValue = (state.secondaryUnit && !enCalendrier)
          ? (parseFloat(overlay.querySelector('#f-secondaire-valeur').value) || 0) : null;
        if (enCalendrier) {
          state.secondaryIntervalDays = parseInt(overlay.querySelector('#f-secondaire-interval').value, 10) || FALLBACK_INTERVAL_DAYS;
          state.secondaryReminderDays = parseInt(overlay.querySelector('#f-secondaire-reminder').value, 10) || FALLBACK_REMINDER_DAYS;
        } else if (state.secondaryUnit) {
          state.secondaryIntervalCounter = parseInt(overlay.querySelector('#f-secondaire-interval').value, 10) || FALLBACK_INTERVAL_HOURS;
          state.secondaryReminderCounter = parseInt(overlay.querySelector('#f-secondaire-reminder').value, 10) || FALLBACK_REMINDER_HOURS;
        }
      } else {
        state.secondaryUnit = null;
        state.secondaryValue = null;
      }
    }

    // ── 02 — Carnet d'entretien ─────────────────────────────────────────
    const apresCarnet = (resultat) => {
      // Capture l'identification/le TCO/le mode AVANT de sauter à
      // stepPlanChoice (voir lireFormulaireDansState ci-dessus) — puis
      // seulement, les valeurs propres au résultat de l'analyse.
      lireFormulaireDansState();
      state.items = resultat.items;
      state.notes = resultat.notes;
      state.tasks = resultat.taches;
      overlay.querySelector('#f-tasks').value = resultat.taches || '';
      // L'analyse vient de finir : l'utilisateur voit et valide ce qui a été
      // détecté AVANT que ça devienne le plan réel (écran à part, .pplan-*,
      // volontairement — voir prompt-stitch-ajouter-machine.md).
      stepPlanChoice(resultat);
    };
    const contexteCarnet = () => ({
      trackingMode: state.trackingMode, currentHours: state.currentHours, serviceDate: state.serviceDate,
    });
    const traiterFichiersCarnet = (choix) => {
      const images = choix.filter(f => /^image\//.test(f.type));
      const file = choix.find(f => f.type === 'application/pdf') || null;
      if (images.length) {
        state.pendingFile = null;
        brancherCarnetPhotos(overlay, images, contexteCarnet, apresCarnet);
        return;
      }
      state.pendingFile = file || null;
      if (file) {
        brancherCarnetPdf(overlay, file, contexteCarnet(), apresCarnet,
          () => analyzeManualAndFill(overlay, file, state.trackingMode, { currentHours: state.currentHours, serviceDate: state.serviceDate }));
        // LA PHOTO CHOISIE PAR LE CLIENT GAGNE TOUJOURS. La 1ère page du carnet ne sert que s'il n'a pas déjà
        // choisi sa photo (galerie ou appareil photo) à l'étape précédente. Contrôle refait ICI, à l'arrivée du
        // résultat : il a pu choisir une photo pendant que la page se préparait.
        renderPdfFirstPageAsBlob(file)
          .then(blob => {
            const photoDuClient = state.pendingPhotoBlob && state.pendingPhotoBlob !== state._carnetPhotoBlob;
            if (photoDuClient) return;
            state.pendingPhotoBlob = blob;
            state._carnetPhotoBlob = blob;
            const zone = overlay.querySelector('#photo-preview');
            if (zone && !zone.querySelector('img')) zone.innerHTML = `<img class="machine-photo" src="${URL.createObjectURL(blob)}" alt="">`;
          })
          .catch(err => console.error('Extraction photo (1ère page du PDF) échouée :', err));
      }
    };
    const champManualReel = overlay.querySelector('#f-manual');
    const statutDepotCarnet = overlay.querySelector('#f-manual-statut');
    const annoncerFichiersCarnet = (fichiers) => {
      if (!statutDepotCarnet || !fichiers.length) return;
      statutDepotCarnet.textContent = fichiers.length > 1
        ? tR('{n} fichier(s) sélectionné(s).', { n: fichiers.length })
        : tR('Fichier sélectionné : {nom}', { nom: fichiers[0].name });
    };
    champManualReel.addEventListener('change', (e) => {
      const fichiers = Array.from(e.target.files || []);
      annoncerFichiersCarnet(fichiers);
      traiterFichiersCarnet(fichiers);
    });
    const zoneDepotCarnet = overlay.querySelector('#f-manual-drop');
    if (zoneDepotCarnet) {
      zoneDepotCarnet.addEventListener('click', () => champManualReel.click());
      ['dragenter', 'dragover'].forEach((ev) => zoneDepotCarnet.addEventListener(ev, (e) => { e.preventDefault(); zoneDepotCarnet.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach((ev) => zoneDepotCarnet.addEventListener(ev, (e) => { e.preventDefault(); zoneDepotCarnet.classList.remove('is-over'); }));
      zoneDepotCarnet.addEventListener('drop', (e) => {
        const fichiers = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
        if (!fichiers.length) return;
        annoncerFichiersCarnet(fichiers);
        traiterFichiersCarnet(fichiers);
      });
    }
    overlay.querySelector('#btn-camera').addEventListener('click', () => overlay.querySelector('#f-camera').click());
    overlay.querySelector('#f-camera').addEventListener('change', (e) => {
      const images = Array.from(e.target.files || []).filter(f => /^image\//.test(f.type));
      e.target.value = '';
      if (images.length) brancherCarnetPhotos(overlay, images, contexteCarnet, apresCarnet);
    });
    brancherOffrePlan(overlay, () => ({
      name: state.name, brand: state.brand, model: state.model, annee: state.annee,
      category: state.category, serial_number: state.serial,
    }));

    // ── Dernier entretien (bloc 01) ─────────────────────────────────────
    marquerChoixRing('dern');
    overlay.querySelectorAll('input[name=dern]').forEach((r) => r.addEventListener('change', () => {
      marquerChoixRing('dern');
      const m = overlay.querySelector('input[name=dern]:checked')?.value;
      const ligne = overlay.querySelector('#f-dernier-releve-ligne');
      if (ligne) ligne.style.display = m === 'fait' ? 'block' : 'none';
    }));
    // ── 03 — Mode de suivi & échéances ──────────────────────────────────
    marquerChoixRing('tm');
    overlay.querySelectorAll('input[name=tm]').forEach(r => {
      r.addEventListener('change', (e) => {
        marquerChoixRing('tm');
        const choix = overlay.querySelector('input[name=tm]:checked').value;
        const u = COUNTER_UNITS[counterUnitFromMode(choix)];
        // Un vrai clic sur « Calendaire » = machine sans compteur : le relevé n'est plus obligatoire.
        if (e.isTrusted) state.modeCalendaireVoulu = choix === 'days';
        const champReleve = overlay.querySelector('#f-current-hours');
        if (champReleve) champReleve.required = !state.modeCalendaireVoulu;
        const blocDernier = overlay.querySelector('#dernier-entretien-bloc');
        if (blocDernier) blocDernier.style.display = state.modeCalendaireVoulu ? 'none' : '';
        majLibelleReleve();
        const intervalLabel = overlay.querySelector('#f-interval-label');
        const reminderLabel = overlay.querySelector('#f-reminder-label');
        const mot = choix === 'days' ? trad('jours') : u.word;
        if (intervalLabel) {
          intervalLabel.textContent = tR('Échéance {mode}', {
            mode: choix === 'days' ? trad('toutes les (jours)') : tR('tous les ({unite})', { unite: mot }),
          });
        }
        if (reminderLabel) reminderLabel.textContent = tR('Rappel avant ({unite})', { unite: mot });
        const champIntervalle = overlay.querySelector('#f-interval');
        if (champIntervalle && !overlay._intervalTouche) {
          champIntervalle.value = intervallePropose(choix, intervallesIA(overlay));
        }
        const carteSecH = overlay.querySelector('#carte-secondaire-hours');
        const carteSecK = overlay.querySelector('#carte-secondaire-km');
        const carteSecJ = overlay.querySelector('#carte-secondaire-days');
        if (carteSecH) carteSecH.style.display = choix === 'hours' ? 'none' : 'flex';
        if (carteSecK) carteSecK.style.display = choix === 'km' ? 'none' : 'flex';
        if (carteSecJ) carteSecJ.style.display = choix === 'days' ? 'none' : 'flex';
        const radioDevenuInvalide = overlay.querySelector(`input[name=tm2][value="${choix}"]`);
        if (radioDevenuInvalide && radioDevenuInvalide.checked) {
          radioDevenuInvalide.checked = false;
          marquerCarteSelectionnee('tm2');
          if (typeof majLabelsSecondaire === 'function') majLabelsSecondaire();
        }
      });
    });
    function majLibelleReleve() {
      const mode = overlay.querySelector('input[name=tm]:checked')?.value || 'days';
      const kind = overlay.querySelector('input[name=kind]:checked')?.value || state.kind;
      const u = COUNTER_UNITS[mode !== 'days' ? counterUnitFromMode(mode) : (kind === TYPE_VEHICULE ? 'km' : 'hours')];
      const libelle = overlay.querySelector('#f-current-hours-label');
      if (libelle) libelle.textContent = u.field;
      const champ = overlay.querySelector('#f-current-hours');
      if (champ) { champ.step = u.step; champ.placeholder = u.placeholder; }
    }
    function majLabelsSecondaire() {
      const uniteChoisie = overlay.querySelector('input[name=tm2]:checked')?.value || null;
      const ligneValeur = overlay.querySelector('#secondaire-valeur-row');
      if (ligneValeur) ligneValeur.style.display = uniteChoisie === 'days' ? 'none' : 'flex';
      const mot = uniteChoisie === 'days' ? trad('jours') : (COUNTER_UNITS[uniteChoisie || 'hours'] || COUNTER_UNITS.hours).word;
      const labelInterval = overlay.querySelector('#f-secondaire-interval-label');
      const labelReminder = overlay.querySelector('#f-secondaire-reminder-label');
      if (labelInterval) labelInterval.textContent = tR('Échéance tous les ({unite})', { unite: mot });
      if (labelReminder) labelReminder.textContent = tR('Rappel avant ({unite})', { unite: mot });
    }
    if (SCHEMA.hasCounter2) {
      const caseSecondaire = overlay.querySelector('#f-secondaire-active');
      const champsSecondaire = overlay.querySelector('#secondaire-champs');
      caseSecondaire?.addEventListener('change', () => {
        overlay._secondaireToucheForce = true;
        if (champsSecondaire) champsSecondaire.style.display = caseSecondaire.checked ? 'flex' : 'none';
        if (!caseSecondaire.checked) overlay.querySelectorAll('input[name=tm2]').forEach(r => { r.checked = false; });
      });
      overlay.querySelectorAll('input[name=tm2]').forEach(r => r.addEventListener('change', () => {
        overlay._secondaireToucheForce = true;
        marquerCarteSelectionnee('tm2');
        majLabelsSecondaire();
      }));
      marquerCarteSelectionnee('tm2');
      majLabelsSecondaire();
    }
    const champIntervalleWizard = overlay.querySelector('#f-interval');
    if (champIntervalleWizard) champIntervalleWizard.addEventListener('input', () => { overlay._intervalTouche = true; });

    // ── 05 — Photo ────────────────────────────────────────────────────
    brancherPhotoManuelle(overlay, { apercu: '#photo-preview', surState: state });
    const photoPreview = overlay.querySelector('#photo-preview');
    if (photoPreview && state.pendingPhotoBlob && !photoPreview.querySelector('img')) {
      photoPreview.innerHTML = `<img class="machine-photo" src="${URL.createObjectURL(state.pendingPhotoBlob)}" alt="">`;
    }
    // Retour sur ce formulaire après « Modifier ce plan » : le plan proposé est bien conservé (state.items) mais rien ne le
    // montrait, le formulaire semblait « sans plan ». On l'écrit en clair, avec un lien pour le revoir.
    if (state.items && state.items.length) {
      const zonePlan = overlay.querySelector('#f-analysis');
      if (zonePlan) {
        zonePlan.innerHTML = `✅ ${esc(tR('Plan d\'entretien retenu : {n} tâche(s) détectée(s) dans le carnet.', { n: state.items.length }))} <a href="#" id="revoir-plan" class="text-primary font-semibold hover:underline">${esc(trad('Revoir le plan'))}</a>`;
        zonePlan.querySelector('#revoir-plan').addEventListener('click', (e) => {
          e.preventDefault();
          lireFormulaireDansState();
          stepPlanChoice(dernierResultatPlan || { items: state.items });
        });
      }
    }
    // ── Garde-fou : pas de machine vide ─────────────────────────────────
    // Enregistrer AVANT d'avoir déposé le carnet créait une machine sans plan ni photo. Le bouton reste grisé
    // tant qu'il n'y a ni plan d'entretien (carnet analysé, ou tâches saisies à la main) ni photo.
    const boutonEnregistrer = overlay.querySelector('#step-form button[type=submit]');
    const elementsManquants = () => {
      const manques = [];
      const tacheSaisie = !!(overlay.querySelector('#f-tasks')?.value || '').trim();
      const planPret = !!((overlay._aiItems && overlay._aiItems.length) || (state.items && state.items.length) || tacheSaisie);
      if (!planPret) manques.push(trad('le plan d\'entretien (dépose le carnet ou saisis des tâches)'));
      if (!state.pendingPhotoBlob) manques.push(trad('la photo de la machine'));
      return manques;
    };
    const majBoutonEnregistrer = () => {
      const manques = elementsManquants();
      if (boutonEnregistrer) boutonEnregistrer.disabled = manques.length > 0;
      const aide = overlay.querySelector('#f-manque');
      if (aide) aide.textContent = manques.length ? tR('Pour enregistrer, il manque : {liste}.', { liste: manques.join(' ' + trad('et') + ' ') }) : '';
    };
    overlay.querySelector('#f-tasks')?.addEventListener('input', majBoutonEnregistrer);
    if (photoPreview) new MutationObserver(majBoutonEnregistrer).observe(photoPreview, { childList: true, subtree: true });
    majBoutonEnregistrer();
    // ── Envoi ────────────────────────────────────────────────────────
    overlay.querySelector('#step-form').addEventListener('submit', (e) => {
      e.preventDefault();
      lireFormulaireDansState();
      if (elementsManquants().length) { majBoutonEnregistrer(); return; }
      const dernier = state.dernierEntretien;
      if (!state.modeCalendaireVoulu && dernier && dernier.mode === 'fait') {
        const erreurDernier = dernier.releve == null ? trad('Indique le relevé du dernier entretien, ou choisis « Je ne sais pas ».')
          : (state.releve != null && dernier.releve > state.releve ? trad('Le dernier entretien ne peut pas être au-delà du relevé actuel.') : '');
        if (erreurDernier) { overlay.querySelector('#f-error').textContent = erreurDernier; overlay.querySelector('#f-dernier-releve')?.focus(); return; }
      }
      overlay.querySelector('#f-error').textContent = '';
      if (!state.modeCalendaireVoulu && state.releve == null) {
        overlay.querySelector('#f-error').textContent = trad('Indique le relevé actuel (0 si la machine est neuve).');
        overlay.querySelector('#f-current-hours')?.focus();
        return;
      }
      // Le formulaire est désormais unique (plus de stepMode/stepChecklist) :
      // on enregistre directement, qu'il y ait eu un carnet ou non.
      saveMachine(e.target.querySelector('button[type=submit]'), overlay.querySelector('#f-error'));
    });
  }
  // ── ÉTAPE « CHOIX DU PLAN » — juste après l'analyse du carnet ──────────
  // Nouvelle étape : avant de proposer la suite (mode de suivi + photo), on
  // demande explicitement ce que le client veut faire du plan que l'IA
  // vient de proposer.
  //   · Suivre ce plan        → active tel quel (mode/intervalle recommandés
  //     par l'analyse), enregistre directement — SANS repasser par l'étape
  //     « Mode de suivi » : c'est tout l'intérêt du choix « tel quel » ;
  //   · Modifier ce plan      → ouvre l'étape « Mode de suivi » comme avant
  //     cette évolution, rien ne change sur ce chemin ;
  //   · Faire mon propre plan → ignore la proposition de l'IA (le PDF reste
  //     attaché à la fiche, lui) et enregistre avec un plan vierge.
  function stepPlanChoice(resultat) {
    // Écran .pplan-* hors du scope Tailwind compilé de stepFormUnique : le
    // reset ".machine-modal-add input{border:0;padding:0;…}" (spécificité
    // plus haute que les classes .pplan-* elles-mêmes) écraserait sinon la
    // bordure/le padding de .pplan-elt-input. .machine-modal (l'ancienne
    // classe du wizard, inchangée) porte déjà le .modal{max-width:900px}
    // dont cet écran a besoin — stepFormUnique() restaure sa propre classe
    // au retour (« Modifier ce plan »).
    overlay.className = 'overlay machine-modal';
    // `let`, pas `const` : le bouton crayon (voir plus bas) réassigne une
    // ligne en place via appliquerChoixSurTache, « Ajouter une ligne » en
    // pousse une nouvelle — `items` est la seule source de vérité de cet
    // écran, jamais relue depuis le DOM.
    let items = normalizeItems(resultat?.items);
    const mode = overlay._aiTrackingSuggestion === 'hours' ? 'hours' : 'days';
    const unit = COUNTER_UNITS[counterUnitFromMode(mode)];
    const suggested = mode === 'hours' ? (overlay._aiIntervalHours || state.intervalHours) : (overlay._aiIntervalDays || state.intervalDays);
    // Contexte minimal pour la modale de fréquence (MÊME fonction que sur un
    // plan déjà enregistré, voir ouvrirChoixFrequenceApercu) : la machine
    // n'existe pas encore à ce stade de l'assistant, donc un objet
    // synthétique construit à partir de `state` — même motif que celui déjà
    // utilisé plus loin pour preparerTaches() au moment d'enregistrer.
    const planCtxWiz = { tracking_mode: mode === 'days' ? 'days' : 'hours' };
    const machineCtxWiz = { counter_unit: counterUnitFromMode(mode), counter_value: departEntretien(state, counterUnitFromMode(mode), state.currentHours), current_hours: state.currentHours, service_date: state.serviceDate, counter_unit_2: state.secondaryUnit || null, counter_value_2: state.secondaryUnit === 'days' ? null : departEntretien(state, state.secondaryUnit, state.secondaryValue ?? null) };
    const filaItemWiz = (it, i) => `
      <tr data-item-index="${i}">
        <td class="pplan-elt">${it._nouveau
          ? `<input type="text" class="pplan-elt-input wiz-item-label-neuf" data-index="${i}" placeholder="${esc(trad('Élément à entretenir'))}" value="${esc(it.label || '')}">`
          : `<span class="pplan-elt-dot" style="background:${pplanDotColor(i)}"></span>${esc(it.label || '—')}`}</td>
        <td class="pplan-freq-valeur">${esc(it.interval_choisi || it.frequency || trad('À définir'))}</td>
        <td><div class="pplan-actions-cell">
          <button type="button" class="pplan-btn-modifier" data-index="${i}" title="${esc(trad('Modifier la fréquence'))}"><span class="material-symbols-outlined">edit</span><span>${trad('Modifier l\'étape')}</span></button>
          <button type="button" class="pplan-btn-supprimer" data-index="${i}" title="${esc(trad('Retirer cette ligne'))}"><span class="material-symbols-outlined">delete</span></button>
        </div></td>
      </tr>`;
    const tableauItemsWizHtml = () => items.map(filaItemWiz).join('');
    shell(`
      ${enteteEtape(trad('Plan proposé par notre algorithme'), { retour: true })}
      <div class="pplan-resume is-inset">
        <div class="pplan-resume-gauche">
          <span class="pplan-resume-dot"></span>
          <strong>${tR('Échéance proposée : tous les {n} {unite}', { n: suggested, unite: mode === 'hours' ? unit.word : trad('jours') })}</strong>
          ${items.length ? `<span class="muted">— ${esc(tR('{n} échéance(s) détectée(s) dans le manuel', { n: items.length }))}</span>` : ''}
        </div>
        <span class="pplan-resume-pill">${trad('Recommandé')}</span>
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
            <tbody id="wiz-items-tbody">${tableauItemsWizHtml()}</tbody>
          </table>
        </div></div>
        <button type="button" class="pplan-ajouter" id="wiz-item-ajouter" style="margin-top:10px;"><span class="material-symbols-outlined">add_circle</span><span>${trad('Ajouter une ligne')}</span></button>
      </div>` : ''}
      <div class="pplan-choix" style="margin-top:18px;">
        <button type="button" class="pplan-choix-item is-recommande" id="pc-suivre">
          <div class="pplan-choix-gauche">
            <div class="pplan-choix-ico"><span class="material-symbols-outlined">check</span></div>
            <div>
              <div class="pplan-choix-titre-ligne"><h4>${trad('Suivre ce plan')}</h4><span class="pplan-choix-reco">${trad('Recommandé')}</span></div>
              <p>${trad('On active tel quel le mode de suivi et l\'intervalle proposés.')}</p>
            </div>
          </div>
          <span class="material-symbols-outlined pplan-choix-fleche">arrow_forward</span>
        </button>
        <button type="button" class="pplan-choix-item" id="pc-modifier">
          <div class="pplan-choix-gauche">
            <div class="pplan-choix-ico"><span class="material-symbols-outlined">edit_note</span></div>
            <div><h4>${trad('Modifier ce plan')}</h4><p>${trad('Ajuster le mode de suivi, l\'intervalle ou la photo avant d\'enregistrer.')}</p></div>
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
      </div>
      <div class="hint" id="f-error"></div>
    `);
    overlay.querySelector('#wiz-back').addEventListener('click', () => stepFormUnique());
    const errEl = overlay.querySelector('#f-error');
    const wizTbody = overlay.querySelector('#wiz-items-tbody');
    const rafraichirItemsWiz = () => { if (wizTbody) wizTbody.innerHTML = tableauItemsWizHtml(); };
    wizTbody?.addEventListener('click', (e) => {
      const retirer = e.target.closest('.pplan-btn-supprimer');
      if (retirer) { items.splice(Number(retirer.dataset.index), 1); rafraichirItemsWiz(); return; }
      const modifier = e.target.closest('.pplan-btn-modifier');
      if (modifier) {
        const i = Number(modifier.dataset.index);
        ouvrirChoixFrequenceApercuAuto(items[i], planCtxWiz, machineCtxWiz, (modeAjoute, valeur) => {
          state.secondaryUnit = modeAjoute;
          state.secondaryValue = valeur;
          Object.assign(machineCtxWiz, { counter_unit_2: modeAjoute, counter_value_2: departEntretien(state, modeAjoute, valeur) });
        }, (choix) => {
          items[i] = appliquerChoixSurTache(items[i], choix, planCtxWiz, machineCtxWiz);
          rafraichirItemsWiz();
        // Le relevé saisi à l'identification vaut pour l'unité du type (km pour un véhicule, heures pour une machine)
        }, (modeAjoute) => (modeAjoute === (state.kind === TYPE_VEHICULE ? 'km' : 'hours') ? state.releve : null));
      }
    });
    // « Modifier ce plan » ne veut pas dire renommer les tâches détectées —
    // seule leur fréquence est éditable (bouton crayon, voir ci-dessus).
    // Ajouter une tâche manquante EST possible : une ligne neuve, avec son
    // propre libellé à saisir.
    wizTbody?.addEventListener('input', (e) => {
      const champ = e.target.closest('.wiz-item-label-neuf');
      if (champ) items[Number(champ.dataset.index)].label = champ.value;
    });
    overlay.querySelector('#wiz-item-ajouter')?.addEventListener('click', () => {
      items.push({ label: '', frequency: '', _nouveau: true });
      rafraichirItemsWiz();
      wizTbody.querySelector('tr:last-child .wiz-item-label-neuf')?.focus();
    });
    // Une ligne ajoutée à la main jamais complétée (libellé resté vide) est
    // ignorée ; la marque `_nouveau`, propre à cet écran, n'est jamais
    // enregistrée telle quelle.
    const itemsFinaux = () => items.filter((it) => (it.label || '').trim())
      .map(({ _nouveau, ...reste }) => reste);
    // Même petite logique que stepMode() (recommandation IA → state), reprise
    // ici pour les deux choix qui n'ouvrent PAS cette étape : dupliquée plutôt
    // que sur-abstraite, comme le reste de cet assistant (voir traiterFichiersCarnet).
    function appliquerRecommandationIA() {
      const reco = overlay._aiTrackingSuggestion || null;
      const recoRetenue = (reco === 'hours' && state.kind === TYPE_VEHICULE && SCHEMA.hasCounter) ? trad('km') : reco;
      state.trackingMode = recoRetenue || ((state.kind === TYPE_VEHICULE && SCHEMA.hasCounter) ? trad('km') : 'days');
      state.intervalDays = overlay._aiIntervalDays || state.intervalDays;
      state.intervalHours = overlay._aiIntervalHours || state.intervalHours;
    }
    overlay.querySelector('#pc-suivre').addEventListener('click', () => {
      dernierResultatPlan = { ...resultat, items: itemsFinaux() };
      state.items = itemsFinaux();
      appliquerRecommandationIA();
      stepDerniereEtape();
    });
    overlay.querySelector('#pc-modifier').addEventListener('click', () => {
      state.items = itemsFinaux();
      stepFormUnique();
    });
    overlay.querySelector('#pc-propre').addEventListener('click', () => {
      dernierResultatPlan = { ...resultat, items: itemsFinaux() };
      state.items = null;
      state.tasks = '';
      state.notes = '';
      appliquerRecommandationIA();
      stepDerniereEtape();
    });
  }

  async function saveMachine(submitBtn, errorEl) {
    // Un second compteur dans l'unité du type (km pour un véhicule) EST le même compteur que celui saisi à l'identification : on reprend
    // ce relevé au lieu du 0 par défaut du champ « second suivi ».
    if (state.secondaryUnit && state.secondaryUnit !== 'days' && state.releve != null && state.secondaryUnit === (state.kind === TYPE_VEHICULE ? 'km' : 'hours')) state.secondaryValue = state.releve;
    // Pas de catégorie sans nom : on revient au formulaire (si l'écran du plan est affiché) et on le demande.
    if (state.categorieManquante || !state.category) {
      if (!overlay.querySelector('#f-category')) stepFormUnique();
      const erreur = overlay.querySelector('#f-error');
      if (erreur) erreur.textContent = trad('Indique le nom de la catégorie.');
      const champAutre = overlay.querySelector('#f-category-autre');
      if (champAutre && !champAutre.hidden && typeof champAutre.focus === 'function') champAutre.focus();
      return;
    }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = trad('Enregistrement…'); }
    try {
      let categoryId;
      const existingCat = categories.find(c => c.name.toLowerCase() === state.category.toLowerCase());
      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const { data: newCat, error: catErr } = await sb
          .from('machine_categories')
          .insert({ company_id: companyId, name: state.category, default_interval_days: state.intervalDays, default_tasks: state.tasks })
          .select('id, name')
          .single();
        if (catErr) throw catErr;
        categoryId = newCat.id;
        categories.push(newCat);
      }

      const { data: machine, error: machineErr } = await sb
        .from('machines')
        .insert({
          company_id: companyId, category_id: categoryId, name: state.name,
          ...identifiantPatch(state.kind, state.serial),
          ...kindPatch(state.kind),
          service_date: state.serviceDate, status: 'en_service',
          ...brandModelPatch(state.brand, state.model),
          ...yearPatch(state.annee),
          // Suivi calendaire : le relevé saisi est quand même gardé (dans l'unité du type : km / heures), il servira si un suivi
          // par compteur est ajouté plus tard ; il n'entre dans aucune échéance du plan calendaire.
          ...machineCounterPatch(
            state.trackingMode !== 'days' ? state.currentHours : (state.releve ?? null),
            { counter_unit: state.trackingMode !== 'days' ? counterUnitFromMode(state.trackingMode) : (state.kind === TYPE_VEHICULE ? trad('km') : 'hours') }
          ),
          ...(state.secondaryUnit ? machineCounter2Patch(state.secondaryValue, state.secondaryUnit) : {}),
          ...(tcoActif() && state.purchasePrice !== '' ? {
            purchase_price: Number(state.purchasePrice),
            purchase_date: state.purchaseDate || state.serviceDate,
          } : {}),
          ...(tcoActif() && state.trackingMode !== 'days' && state.lifespan != null && state.lifespan > 0 ? { expected_lifespan_counter: state.lifespan } : {}),
        })
        .select('id')
        .single();
      if (machineErr) throw machineErr;
      synchroniserMachinesStripe();

      try {
        if (state.pendingPhotoBlob) {
          const url = await uploadMachinePhoto(companyId, machine.id, state.pendingPhotoBlob);
          await sb.from('machines').update({ image_url: url }).eq('id', machine.id);
        }
      } catch (imgErr) { console.warn('Photo de la machine :', imgErr); }

      // AU-DELÀ DE 8 Mo, ON N'ARCHIVE PAS. Ce manuel a été ANALYSÉ — envoyé brut,
      // analysé par référence chez le fournisseur puis supprimé — et c'est
      // l'analyse qui a de la valeur. Le garder occuperait de la place pour un
      // document que le client peut redéposer, et l'application le lui dit.
      if (state.pendingFile && !manuelSansArchivage(state.pendingFile)) {
        await deposerManuel(companyId, machine.id, state.pendingFile, null);
      }

      const planPayload = {
        machine_id: machine.id,
        tracking_mode: state.trackingMode,
        tasks: state.tasks || null,
        items: state.items,
        // Ce texte est écrit ici, avec le compteur que l'utilisateur
        // vient de saisir : on le filtre tout de suite, pour que la base ne
        // contienne jamais une affirmation qui vieillira.
        notes: notesUtiles(state.notes, state.currentHours),
      };
      // Second suivi, optionnel : vu par le moteur d'échéances comme des
      // champs supplémentaires sur une machine « synthétique » (la vraie
      // machine n'existe pas encore comme objet complet à ce stade).
      // Calendaire n'a pas de relevé (marqueur counter_unit_2:'days' seul).
      const secondaireActif = !!state.secondaryUnit;
      const secondaireCalendrier = state.secondaryUnit === 'days';
      // Point de départ des échéances du second compteur (relevé du dernier entretien si le client l'a donné)
      const departSecond = secondaireCalendrier ? null : departEntretien(state, state.secondaryUnit, state.secondaryValue ?? null);
      const machineVue2 = { counter_unit_2: state.secondaryUnit || null, counter_value_2: departSecond };
      if (secondaireActif) {
        Object.assign(planPayload, secondaireCalendrier
          ? planJours2Patch(state.secondaryIntervalDays || FALLBACK_INTERVAL_DAYS, state.secondaryReminderDays ?? FALLBACK_REMINDER_DAYS)
          : planCounter2Patch(state.secondaryIntervalCounter || FALLBACK_INTERVAL_HOURS, state.secondaryReminderCounter ?? FALLBACK_REMINDER_HOURS));
      }
      const duePlanSecondaire = !secondaireActif ? null
        : secondaireCalendrier ? addDaysIso(state.serviceDate, state.secondaryIntervalDays || FALLBACK_INTERVAL_DAYS)
        : (departSecond || 0) + (intervalleDesTachesEnUnite(state.items, state.secondaryUnit === 'km' ? trad('km') : trad('heures')) ?? (state.secondaryIntervalCounter || FALLBACK_INTERVAL_HOURS));
      if (state.trackingMode !== 'days') {
        const intervalCounter = state.intervalHours || FALLBACK_INTERVAL_HOURS;
        const reminderCounter = state.reminderHoursBefore ?? FALLBACK_REMINDER_HOURS;
        const departPrincipal = departEntretien(state, counterUnitFromMode(state.trackingMode), state.currentHours) || 0;
        const dueCounter = departPrincipal + intervalCounter;
        Object.assign(planPayload,
          planCounterPatch(intervalCounter, reminderCounter),
          planNextDueCounterPatch(dueCounter));
        // Une échéance par tâche : la passe CLASSE chaque fréquence (conditionnelle,
        // périodique, à choisir) et ne donne l'échéance du plan qu'aux tâches qui
        // ont un vrai rythme dans l'unité du plan (ou dans celle du second suivi).
        planPayload.items = preparerTaches(state.items, planPayload,
          { counter_unit: counterUnitFromMode(state.trackingMode), counter_value: departPrincipal, ...machineVue2 },
          dueCounter, counterUnitFromMode(state.trackingMode), duePlanSecondaire);
        // L'échéance du plan est le MINIMUM de ses tâches comparables, et RIEN
        // quand aucune ne la porte (toutes conditionnelles, ou dans une autre
        // unité) : l'intervalle général du carnet ne doit pas rester en vestige.
        Object.assign(planPayload, echeancePlanPatch(echeancePlanDepuisTaches(planPayload.items, planPayload), planPayload));
        // L'intervalle affiché (jauge, fiche) suit la tâche qui gouverne
        // réellement cette échéance, pas la saisie du formulaire à part —
        // même règle que pour le calendaire (voir plus bas), appliquée ici
        // au compteur (signalé le 23/09 : 100 km en formulaire vs 20 000 km
        // pour la tâche qui gouverne vraiment l'échéance).
        {
          const intervalleReel = intervalleDepuisTacheGouvernante(tacheGouvernante(planPayload.items, planPayload), true);
          if (intervalleReel != null) Object.assign(planPayload, SCHEMA.hasCounter ? { interval_counter: intervalleReel } : { interval_hours: intervalleReel });
        }
        if (secondaireActif) {
          // Filet de sécurité : si aucune tâche n'est encore rattachée à
          // l'unité du second suivi (carnet 100% heures, second suivi
          // calendaire ajouté à la main, par exemple), echeancePlanDepuis
          // TachesSecondaire ne trouve rien et renvoie null — sans repli, le
          // second suivi restait indéfiniment sans échéance concrète malgré
          // une cadence bien réglée (visible en Cadence/Mode de suivi, mais
          // aucun bloc d'intervalle à afficher). `duePlanSecondaire`, calculé
          // plus haut, est cette même valeur déjà utilisée pour préparer les
          // tâches (preparerTaches) — pas une improvisation.
          Object.assign(planPayload, echeancePlanPatch2(echeancePlanDepuisTachesSecondaire(planPayload.items, machineVue2) ?? duePlanSecondaire, machineVue2));
          const intervalleReelSec = intervalleDepuisTacheGouvernante(tacheGouvernanteSecondaire(planPayload.items, machineVue2), !secondaireCalendrier);
          if (intervalleReelSec != null) {
            Object.assign(planPayload, secondaireCalendrier ? { interval_days_2: intervalleReelSec } : (SCHEMA.hasCounter2 ? { interval_counter_2: intervalleReelSec } : {}));
          }
        }
        // On conserve aussi un intervalle calendaire cohérent : il servira si la
        // machine bascule plus tard en suivi calendaire.
        planPayload.interval_days = state.intervalDays || FALLBACK_INTERVAL_DAYS;
        planPayload.reminder_days_before = state.reminderDays ?? FALLBACK_REMINDER_DAYS;
      } else {
        planPayload.interval_days = state.intervalDays || FALLBACK_INTERVAL_DAYS;
        planPayload.reminder_days_before = state.reminderDays ?? FALLBACK_REMINDER_DAYS;
        planPayload.next_due_at = addDaysIso(state.serviceDate, planPayload.interval_days);
        // Une échéance par tâche : même passe, même classement (mode calendaire).
        planPayload.items = preparerTaches(state.items, planPayload,
          { counter_unit: 'hours', counter_value: null, ...machineVue2 }, planPayload.next_due_at, 'days', duePlanSecondaire);
        // Même règle en mode calendaire : le plan suit le minimum de ses tâches.
        Object.assign(planPayload, echeancePlanPatch(echeancePlanDepuisTaches(planPayload.items, planPayload), planPayload));
        // L'intervalle affiché (jauge, fiche) suit la tâche qui gouverne
        // réellement cette échéance, pas la saisie du formulaire à part.
        {
          const intervalleReel = intervalleDepuisTacheGouvernante(tacheGouvernante(planPayload.items, planPayload), false);
          if (intervalleReel != null) planPayload.interval_days = intervalleReel;
        }
        if (secondaireActif) {
          // Même filet de sécurité que dans la branche compteur ci-dessus
          // (voir son commentaire).
          Object.assign(planPayload, echeancePlanPatch2(echeancePlanDepuisTachesSecondaire(planPayload.items, machineVue2) ?? duePlanSecondaire, machineVue2));
          const intervalleReelSec = intervalleDepuisTacheGouvernante(tacheGouvernanteSecondaire(planPayload.items, machineVue2), !secondaireCalendrier);
          if (intervalleReelSec != null) {
            Object.assign(planPayload, secondaireCalendrier ? { interval_days_2: intervalleReelSec } : (SCHEMA.hasCounter2 ? { interval_counter_2: intervalleReelSec } : {}));
          }
        }
        planPayload.interval_hours = state.intervalHours || FALLBACK_INTERVAL_HOURS;
        planPayload.reminder_hours_before = state.reminderHoursBefore ?? FALLBACK_REMINDER_HOURS;
      }
      const { error: planErr } = await sb.from('maintenance_plans').insert(planPayload);
      if (planErr) throw planErr;

      overlay.remove();
      boot(trad('Machine ajoutée'));
    } catch (err) {
      if (isQuotaError(err)) {
        overlay.remove();
        openUpgradeNotice(companyId);
        return;
      }
      if (errorEl) errorEl.textContent = trad('Erreur :') + " " + err.message;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = trad('Enregistrer'); }
    }
  }

  stepFormUnique();
}
function openNextMaintenanceView(machine) {
  // « Prochain entretien » fixe une échéance : c'est une écriture sur le plan.
  if (refuserSiNonCouverte(machine)) return;
  const info = dueInfo(machine.plan, machine);
  const isCounter = planIsCounter(machine.plan);
  const unit = counterUnitOf(machine);
  const overlay = document.createElement('div');
  overlay.className = 'overlay next-entretien-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Les tâches sont classées AU RENDU, par la même règle que l'enregistrement :
  // un plan jamais réenregistré se lit donc comme s'il venait de l'être, et cette
  // consultation n'écrit rien.
  const planItems = tachesAffichees(machine.plan, machine);
  const items = planItems.length
    ? planItems
    : (machine.plan?.tasks || '').split(',').map(t => t.trim()).filter(Boolean).map(label => ({ label }));

  overlay.innerHTML = `
    <div class="modal">
      <h2>${esc(tR('Prochain entretien — {machine}', { machine: machine.name }))}</h2>
      ${[machine.brand_model, machine.category?.name].filter(Boolean).length
        ? `<p class="sub">${esc([machine.brand_model, machine.category?.name].filter(Boolean).join(' · '))}</p>`
        : ''}

      <div class="due-hero ${heroClass(info.state)}">${esc(info.label)}</div>

      <div class="plan-field">
        <div class="label">${trad('À faire')}</div>
        ${items.length
          ? `<ul class="plan-tasks">${items.map(it => `<li><strong>${esc(it.label)}</strong>${it.frequency ? ` — ${esc(it.frequency)}` : ''}</li>`).join('')}</ul>`
          : `<div class="value" style="color:var(--ink-soft);">${trad('Aucune tâche détaillée dans le plan.')}</div>`}
      </div>

      <div class="plan-field" id="last-intervention-section">
        <div class="label">${trad('Dernier entretien réalisé')}</div>
        <div class="value" style="color:var(--ink-soft);">${trad('Chargement…')}</div>
      </div>

      <div class="modal-actions">
        <button type="button" class="secondary" id="close-next">${trad('Fermer')}</button>
        <button type="button" class="primary" id="log-from-next">${trad('Enregistrer une intervention')}</button>
      </div>
    </div>
  `;

  overlay.querySelector('#close-next').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#log-from-next').addEventListener('click', () => {
    overlay.remove();
    openLogInterventionModal(machine);
  });

  // Nom de TABLE Supabase littéral : jamais trad() ici (un `.from()` prend le
  // nom réel de la table SQL, pas un libellé d'affichage — trad('interventions')
  // vaut "services" en anglais, ce qui cassait silencieusement toute requête
  // en mode EN, table "services" introuvable). Bug pré-existant, trouvé et
  // corrigé aux 6 occurrences en auditant les traductions manquantes.
  sb.from('interventions')
    .select('performed_at, hours_at_intervention, description, items_done')
    .eq('machine_id', machine.id)
    .order('performed_at', { ascending: false })
    .limit(1)
    .then(({ data, error }) => {
      const section = overlay.querySelector('#last-intervention-section');
      if (!overlay.isConnected || !section) return;
      const valueEl = section.querySelector('.value');
      if (error) { if (valueEl) valueEl.textContent = trad('Erreur de chargement.'); return; }
      const last = (data || [])[0];
      if (!last) {
        if (valueEl) valueEl.textContent = trad('Aucun entretien enregistré pour l\'instant — le plan initial s\'applique.');
        return;
      }
      const doneItems = Array.isArray(last.items_done) && last.items_done.length ? esc(last.items_done.join(', ')) : null;
      if (valueEl) valueEl.outerHTML = `
        <div class="value">
          ${tR('Le {date}', { date: esc(last.performed_at) })}${isCounter && last.hours_at_intervention != null ? ` ${tR('(compteur : {valeur} {unite})', { valeur: esc(last.hours_at_intervention), unite: counterShort(unit) })}` : ''}
          ${doneItems ? `<br>${tR('Éléments traités : {liste}', { liste: doneItems })}` : ''}
          ${last.description ? `<br>${tR('Remarques : {texte}', { texte: esc(last.description) })}` : ''}
        </div>`;
    });
}

// L'ÉQUIPE, POUR ATTRIBUER UN ENTRETIEN — PAS POUR LA GÉRER. equipe_pour_
// attribution() (côté serveur) est délibérément OUVERTE À TOUTE LA SOCIÉTÉ,
// contrairement à membres_de_ma_societe() (réservée au gérant, avec un
// commentaire serveur qui le dit explicitement) : n'importe quel opérateur
// peut enregistrer un entretien et doit pouvoir dire qui l'a fait, y
// compris lui-même. Elle ne renvoie QUE id + un nom affiché déjà composé
// côté serveur (jamais l'email, le rôle ou le métier) — le strict
// nécessaire pour un menu déroulant, rien de plus.
async function equipePourAttribution() {
  const { data, error } = await sb.rpc('equipe_pour_attribution');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
// Trois lettres dérivées du nom réel du fournisseur (jamais un code
// inventé) : sert juste de pastille visuelle dans le sélecteur de pièce.
function abrevFournisseur(nom) {
  const lettres = String(nom || '').replace(/[^A-Za-zÀ-ÿ]/g, '');
  return lettres ? lettres.slice(0, 3).toUpperCase() : '';
}

// Sélecteur de pièce du catalogue (reprise Stitch « stitch_refonte_zone_
// change_ticketing », modale « Pièce du catalogue ») — remplace le <select>
// habillé générique (ouvrirListeChoix) pour CE select précis, dans
// « Enregistrer un entretien ». `valeurActuelle` : l'id de pièce déjà
// choisi (ou '') ; `onChoisi(piece|null)` appelé UNIQUEMENT sur
// « Valider », jamais sur un simple clic dans la liste — piece est `null`
// pour l'option « Aucune pièce spécifique ».
function ouvrirChoixPieceCatalogue(valeurActuelle, onChoisi) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay piece-modal';
  document.body.appendChild(overlay);
  const pieces = UI.partsCatalog || [];
  let choisiId = valeurActuelle || '';
  let filtreFournisseur = 'all';
  let tri = 'pertinence';

  const fournisseurs = [...new Set(pieces.map((p) => p.supplier_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const piecesTriees = () => {
    const f = overlay.querySelector('#piece-recherche')?.value.trim().toLowerCase() || '';
    let liste = pieces.filter((p) => {
      const matchFournisseur = filtreFournisseur === 'all' || p.supplier_name === filtreFournisseur;
      const matchTexte = !f || [p.designation, p.reference, p.supplier_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(f));
      return matchFournisseur && matchTexte;
    });
    if (tri === 'prix-asc') liste = liste.slice().sort((a, b) => (Number(a.unit_price) || 0) - (Number(b.unit_price) || 0));
    if (tri === 'prix-desc') liste = liste.slice().sort((a, b) => (Number(b.unit_price) || 0) - (Number(a.unit_price) || 0));
    return liste;
  };

  const rendreResume = (piece) => {
    const resume = overlay.querySelector('#piece-resume');
    if (!piece) {
      resume.innerHTML = `<div class="piece-resume-gauche">
          <span class="piece-resume-icone">${picto('coche')}</span>
          <div><div class="piece-resume-titre">${trad('Sélection')}</div><div class="piece-resume-nom">${trad('Aucune pièce spécifique')}</div></div>
        </div>
        <div class="piece-resume-droite"><span class="piece-resume-mot">${trad('Prix')}</span><div class="piece-resume-prix">—</div></div>`;
      return;
    }
    resume.innerHTML = `<div class="piece-resume-gauche">
        <span class="piece-resume-icone">${picto('coche')}</span>
        <div><div class="piece-resume-titre">${trad('Pièce sélectionnée')}</div><div class="piece-resume-nom">${esc(piece.designation)}</div></div>
      </div>
      <div class="piece-resume-droite"><span class="piece-resume-mot">${trad('Prix')}</span><div class="piece-resume-prix">${texteAvecSeparateurs(piece.unit_price)} <span style="font-size:11px;color:var(--ink-3);">${esc(deviseCourte())}</span></div></div>`;
  };

  const rendreListe = () => {
    const liste = piecesTriees();
    const zone = overlay.querySelector('#piece-liste');
    const boutonValider = overlay.querySelector('#piece-valider');
    const ligneAucune = `<button type="button" class="piece-ligne-catalogue${!choisiId ? ' is-choisie' : ''}" data-id="">
        <span class="piece-ligne-gauche">
          <span class="piece-ligne-icone">${picto('fermer')}</span>
          <span><span class="piece-ligne-titre"><span class="piece-ligne-nom">${trad('— Choisir une pièce du catalogue —')}</span></span>
          <div class="piece-ligne-meta">${trad('Hors catalogue, ou main-d\'œuvre seule')}</div></span>
        </span>
        <span class="piece-radio"><span class="point"></span></span>
      </button>`;
    if (!liste.length) {
      zone.innerHTML = ligneAucune + `<div class="piece-vide">
        <span class="card-ico">${picto('recherche')}</span>
        <p>${trad('Aucune pièce ne correspond')}</p>
        <p class="muted-text">${trad('Vérifie l\'orthographe, ou choisis un autre fournisseur.')}</p>
      </div>`;
    } else {
      zone.innerHTML = ligneAucune + liste.map((p) => {
        const meta = [p.supplier_name ? tR('Fournisseur : {nom}', { nom: p.supplier_name }) : '', p.reference ? tR('Réf : {ref}', { ref: p.reference }) : ''].filter(Boolean).join(' · ');
        const delai = p.avg_lead_time_days != null ? `<span class="piece-ligne-delai">${picto('sablier')}${tR('Délai moyen : {n} j', { n: p.avg_lead_time_days })}</span>` : '';
        return `<button type="button" class="piece-ligne-catalogue${choisiId === String(p.id) ? ' is-choisie' : ''}" data-id="${esc(p.id)}">
          <span class="piece-ligne-gauche">
            <span class="piece-ligne-icone">${abrevFournisseur(p.supplier_name) || picto('boite')}</span>
            <span>
              <span class="piece-ligne-titre"><span class="piece-ligne-nom">${esc(p.designation)}</span>${delai}</span>
              ${meta ? `<div class="piece-ligne-meta">${esc(meta)}</div>` : ''}
            </span>
          </span>
          <span class="piece-ligne-droite">
            <span class="piece-ligne-prix"><span class="montant">${texteAvecSeparateurs(p.unit_price)}</span><span class="devise">${esc(deviseCourte())}</span></span>
            <span class="piece-radio"><span class="point"></span></span>
          </span>
        </button>`;
      }).join('');
    }
    zone.querySelectorAll('.piece-ligne-catalogue').forEach((ligne) => {
      ligne.addEventListener('click', () => {
        choisiId = ligne.dataset.id || '';
        zone.querySelectorAll('.piece-ligne-catalogue').forEach((l) => l.classList.toggle('is-choisie', l === ligne));
        const piece = choisiId ? pieces.find((p) => String(p.id) === choisiId) : null;
        rendreResume(piece);
        if (boutonValider) boutonValider.querySelector('span').textContent = piece
          ? tR('Valider la pièce sélectionnée ({prix} {devise})', { prix: texteAvecSeparateurs(piece.unit_price), devise: deviseCourte() })
          : trad('Continuer sans pièce catalogue');
      });
    });
  };

  overlay.innerHTML = `<div class="modal">
    <div class="support-tete">
      <div class="piece-tete-gauche">
        <div><h2>${trad('Pièce du catalogue')}</h2><p class="sub">${trad('Sélectionne une pièce pour cette intervention.')}</p></div>
      </div>
      <button type="button" class="mform-close" id="piece-fermer-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
    </div>
    <span class="piece-badge-compte"><span class="dot"></span>${tR('Catalogue atelier · {n} référence(s)', { n: pieces.length })}</span>
    <div class="piece-outils">
      <div class="piece-recherche">
        <span class="card-ico">${picto('recherche')}</span>
        <input type="text" id="piece-recherche" placeholder="${esc(trad('Rechercher par référence, désignation, fournisseur…'))}">
      </div>
      <div class="piece-tri">
        <select id="piece-tri-select">
          <option value="pertinence">${trad('Trier : Pertinence')}</option>
          <option value="prix-asc">${trad('Prix croissant')}</option>
          <option value="prix-desc">${trad('Prix décroissant')}</option>
        </select>
      </div>
    </div>
    ${fournisseurs.length ? `<div class="piece-fournisseurs" id="piece-fournisseurs">
      <button type="button" class="piece-fournisseur-chip is-actif" data-fournisseur="all">${tR('Tous les fournisseurs ({n})', { n: pieces.length })}</button>
      ${fournisseurs.map((f) => `<button type="button" class="piece-fournisseur-chip" data-fournisseur="${esc(f)}">${esc(f)}</button>`).join('')}
    </div>` : ''}
    <div class="piece-liste" id="piece-liste"></div>
    <div class="piece-resume" id="piece-resume"></div>
    <div class="modal-actions">
      <button type="button" class="primary" id="piece-valider"><span>${trad('Valider la pièce sélectionnée')}</span></button>
      <button type="button" class="secondary" id="piece-annuler">${trad('Annuler')}</button>
    </div>
  </div>`;

  habillerSelect(overlay.querySelector('#piece-tri-select'), trad('Trier'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#piece-fermer-x').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#piece-annuler').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#piece-recherche').addEventListener('input', rendreListe);
  overlay.querySelector('#piece-tri-select').addEventListener('change', (e) => { tri = e.target.value; rendreListe(); });
  overlay.querySelectorAll('.piece-fournisseur-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      filtreFournisseur = chip.dataset.fournisseur;
      overlay.querySelectorAll('.piece-fournisseur-chip').forEach((c) => c.classList.toggle('is-actif', c === chip));
      rendreListe();
    });
  });
  overlay.querySelector('#piece-valider').addEventListener('click', () => {
    const piece = choisiId ? pieces.find((p) => String(p.id) === choisiId) : null;
    overlay.remove();
    onChoisi(piece);
  });

  rendreListe();
  rendreResume(valeurActuelle ? pieces.find((p) => String(p.id) === String(valeurActuelle)) : null);
}

// Habillage dédié au select de pièce catalogue (même mécanique que
// habillerSelectIndicatif) — ouvre ouvrirChoixPieceCatalogue() au lieu du
// choix générique ouvrirListeChoix(), pour ce select précis seulement.
function habillerSelectPieceCatalogue(select) {
  if (!select || select.dataset.habille) return;
  select.dataset.habille = '1';
  select.style.display = 'none';
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = `champ-select ${select.className}`.trim();
  if (select.id) bouton.id = `${select.id}-bouton`;
  select.insertAdjacentElement('afterend', bouton);

  const majBouton = () => {
    const opt = select.options[select.selectedIndex];
    const libelle = (opt ? opt.textContent : '') || trad('— Choisir une pièce du catalogue —');
    bouton.innerHTML = `<span>${esc(libelle)}</span>${picto('chevronBas')}`;
    bouton.disabled = select.disabled;
  };
  majBouton();

  bouton.addEventListener('click', () => {
    // Même seuil que .compteur-mobile/.compteur-bureau : la modale centrée
    // (.piece-modal) reste illisible sur téléphone (lignes trop
    // compactes) — reprise Stitch dédiée, plein écran, au-dessous.
    const ouvrir = window.innerWidth < 900 ? ouvrirChoixPieceCatalogueMobile : ouvrirChoixPieceCatalogue;
    ouvrir(select.value, (piece) => {
      select.value = piece ? String(piece.id) : '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      majBouton();
    });
  });

  new MutationObserver(majBouton).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
}

// Version SMARTPHONE du sélecteur de pièce (reprise Stitch « stitch_
// refonte_zone_change_ticketing », 5e passe) — plein écran plutôt qu'une
// modale centrée, voir le bloc CSS ★ PIÈCE DU CATALOGUE — VERSION
// SMARTPHONE pour ce qui n'a délibérément pas été repris. Même contrat
// `onChoisi(piece|null)` que la version bureau (ouvrirChoixPieceCatalogue).
function ouvrirChoixPieceCatalogueMobile(valeurActuelle, onChoisi) {
  const overlay = document.createElement('div');
  overlay.className = 'piece-mobile-overlay';
  document.body.appendChild(overlay);
  const pieces = UI.partsCatalog || [];
  let choisiId = valeurActuelle || '';
  let filtreFournisseur = 'all';
  let tri = 'pertinence';

  const fournisseurs = [...new Set(pieces.map((p) => p.supplier_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const piecesTriees = () => {
    const f = overlay.querySelector('#piece-m-recherche')?.value.trim().toLowerCase() || '';
    let liste = pieces.filter((p) => {
      const matchFournisseur = filtreFournisseur === 'all' || p.supplier_name === filtreFournisseur;
      const matchTexte = !f || [p.designation, p.reference, p.supplier_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(f));
      return matchFournisseur && matchTexte;
    });
    if (tri === 'prix-asc') liste = liste.slice().sort((a, b) => (Number(a.unit_price) || 0) - (Number(b.unit_price) || 0));
    if (tri === 'prix-desc') liste = liste.slice().sort((a, b) => (Number(b.unit_price) || 0) - (Number(a.unit_price) || 0));
    return liste;
  };

  const rendreResume = (piece) => {
    const resume = overlay.querySelector('#piece-m-resume');
    const bouton = overlay.querySelector('#piece-m-valider');
    if (!piece) {
      resume.innerHTML = `<div class="piece-mobile-resume-titre-ligne"><span class="dot"></span><span class="piece-mobile-resume-nom">${trad('Aucune pièce spécifique')}</span></div>`;
      bouton.querySelector('span:last-child').textContent = trad('Continuer sans pièce catalogue');
      return;
    }
    resume.innerHTML = `<div class="piece-mobile-resume-titre-ligne"><span class="dot"></span><span class="piece-mobile-resume-nom">${esc(piece.designation)}</span></div>`;
    bouton.querySelector('span:last-child').textContent = tR('Valider la pièce ({prix} {devise})', { prix: texteAvecSeparateurs(piece.unit_price), devise: deviseCourte() });
  };

  const rendreListe = () => {
    const liste = piecesTriees();
    const zone = overlay.querySelector('#piece-m-liste');
    const carteAucune = `<label class="piece-mobile-carte${!choisiId ? ' is-choisie' : ''}" data-id="">
        <div class="piece-mobile-carte-ligne">
          <span class="piece-mobile-radio"><span class="point"></span></span>
          <div class="piece-mobile-carte-corps">
            <span class="piece-mobile-abrev">${trad('Direct')}</span>
            <div class="piece-mobile-carte-nom" style="margin-top:4px;">${trad('Intervention main-d\'œuvre seule')}</div>
            <p class="muted-text" style="margin:2px 0 0;font-size:12.5px;">${trad('Aucune pièce du catalogue rattachée.')}</p>
          </div>
        </div>
      </label>`;
    if (!liste.length) {
      zone.innerHTML = carteAucune + `<div class="piece-mobile-vide">
        <span class="card-ico">${picto('recherche')}</span>
        <p>${trad('Aucune pièce ne correspond')}</p>
        <p class="muted-text">${trad('Vérifie l\'orthographe, ou choisis un autre fournisseur.')}</p>
      </div>`;
    } else {
      zone.innerHTML = carteAucune + liste.map((p) => {
        const delai = p.avg_lead_time_days != null ? `<span class="piece-mobile-delai">${picto('sablier')}${tR('{n} j', { n: p.avg_lead_time_days })}</span>` : '';
        return `<label class="piece-mobile-carte${choisiId === String(p.id) ? ' is-choisie' : ''}" data-id="${esc(p.id)}">
          <div class="piece-mobile-carte-ligne">
            <span class="piece-mobile-radio"><span class="point"></span></span>
            <div class="piece-mobile-carte-corps">
              <div class="piece-mobile-carte-tete">
                <span class="piece-mobile-carte-badges">
                  <span class="piece-mobile-abrev">${esc(abrevFournisseur(p.supplier_name)) || trad('—')}</span>
                  ${delai}
                </span>
                <span class="piece-mobile-prix"><span class="montant">${texteAvecSeparateurs(p.unit_price)}</span><span class="devise">${esc(deviseCourte())} HT</span></span>
              </div>
              <div class="piece-mobile-carte-nom">${esc(p.designation)}</div>
              ${(p.reference || p.supplier_name) ? `<div class="piece-mobile-carte-meta">
                ${p.reference ? `<div class="piece-mobile-carte-meta-ligne"><span class="mot">${trad('Référence :')}</span><span class="val">${esc(p.reference)}</span></div>` : ''}
                ${p.supplier_name ? `<div class="piece-mobile-carte-meta-ligne"><span class="mot">${trad('Fournisseur :')}</span><span class="val">${esc(p.supplier_name)}</span></div>` : ''}
              </div>` : ''}
            </div>
          </div>
        </label>`;
      }).join('');
    }
    zone.querySelectorAll('.piece-mobile-carte').forEach((carte) => {
      carte.addEventListener('click', () => {
        choisiId = carte.dataset.id || '';
        zone.querySelectorAll('.piece-mobile-carte').forEach((c) => c.classList.toggle('is-choisie', c === carte));
        rendreResume(choisiId ? pieces.find((p) => String(p.id) === choisiId) : null);
        if (navigator.vibrate) { try { navigator.vibrate(15); } catch (err) { /* vibration indisponible, sans conséquence */ } }
      });
    });
  };

  overlay.innerHTML = `
    <div class="piece-mobile-tete">
      <button type="button" class="piece-mobile-fermer" id="piece-m-fermer" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
      <div class="piece-mobile-titre-bloc"><h2>${trad('Pièce du catalogue')}</h2><p>${trad('Atelier & chantier')}</p></div>
      <span style="width:44px;flex:0 0 auto;" aria-hidden="true"></span>
    </div>
    <div class="piece-mobile-corps">
      <div class="piece-mobile-souscontexte">
        <div class="piece-mobile-compte-ligne">
          <span class="dot"></span><h3>${trad('Catalogue pièces')}</h3>
          <span class="piece-mobile-compte-badge">${tR('{n} RÉF(S)', { n: pieces.length })}</span>
        </div>
        <div class="piece-mobile-recherche">
          <span class="card-ico">${picto('recherche')}</span>
          <input type="text" id="piece-m-recherche" placeholder="${esc(trad('Référence, désignation, fournisseur…'))}">
          <div class="piece-mobile-recherche-actions">
            <button type="button" id="piece-m-tri" aria-label="${esc(trad('Trier'))}">${picto('filtre')}</button>
          </div>
        </div>
      </div>
      ${fournisseurs.length ? `<div class="piece-mobile-fournisseurs" id="piece-m-fournisseurs">
        <button type="button" class="piece-fournisseur-chip is-actif" data-fournisseur="all">${tR('Tous {n}', { n: pieces.length })}</button>
        ${fournisseurs.map((f) => `<button type="button" class="piece-fournisseur-chip" data-fournisseur="${esc(f)}">${esc(f)}</button>`).join('')}
      </div>` : ''}
      <div class="piece-mobile-liste" id="piece-m-liste"></div>
    </div>
    <div class="piece-mobile-pied">
      <div class="piece-mobile-resume" id="piece-m-resume"></div>
      <div class="piece-mobile-actions">
        <button type="button" class="piece-mobile-annuler" id="piece-m-annuler">${trad('Annuler')}</button>
        <button type="button" class="primary piece-mobile-valider" id="piece-m-valider"><span class="card-ico">${picto('coche')}</span><span>${trad('Valider la pièce sélectionnée')}</span></button>
      </div>
    </div>`;

  overlay.querySelector('#piece-m-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#piece-m-annuler').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#piece-m-recherche').addEventListener('input', rendreListe);
  overlay.querySelector('#piece-m-tri').addEventListener('click', () => {
    ouvrirListeChoix(trad('Trier'), [
      { id: 'pertinence', nom_affiche: trad('Pertinence') },
      { id: 'prix-asc', nom_affiche: trad('Prix croissant') },
      { id: 'prix-desc', nom_affiche: trad('Prix décroissant') },
    ], tri, (choisi) => { tri = choisi.id; rendreListe(); });
  });
  overlay.querySelectorAll('.piece-fournisseur-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      filtreFournisseur = chip.dataset.fournisseur;
      overlay.querySelectorAll('.piece-fournisseur-chip').forEach((c) => c.classList.toggle('is-actif', c === chip));
      rendreListe();
    });
  });
  overlay.querySelector('#piece-m-valider').addEventListener('click', () => {
    const piece = choisiId ? pieces.find((p) => String(p.id) === choisiId) : null;
    overlay.remove();
    onChoisi(piece);
  });

  rendreListe();
  rendreResume(valeurActuelle ? pieces.find((p) => String(p.id) === String(valeurActuelle)) : null);
}

// Une ligne de pièce dans « Enregistrer un entretien » : sélection dans le
// catalogue (le prix se propose, reste modifiable — une remise ponctuelle ou
// une pièce hors catalogue ne doit pas être bloquée), quantité, sous-total.
function ligneLogPieceHtml(idx) {
  const options = (UI.partsCatalog || []).map((p) =>
    `<option value="${esc(p.id)}" data-prix="${Number(p.unit_price) || 0}">${esc(p.designation)}${p.reference ? ' — ' + esc(p.reference) : ''}</option>`
  ).join('');
  return `<div class="log-piece-ligne" data-piece-ligne="${idx}">
      <div class="log-piece-icone">${picto('boite')}</div>
      <select class="log-piece-select" aria-label="${esc(trad('Pièce du catalogue'))}">
        <option value="">${trad('— Choisir une pièce du catalogue —')}</option>
        ${options}
      </select>
      <input type="number" class="log-piece-qte" min="0" step="0.01" value="1" aria-label="${esc(trad('Quantité'))}" title="${esc(trad('Quantité'))}">
      <input type="text" inputmode="decimal" class="log-piece-prix" value="0" aria-label="${esc(tR('Prix unitaire ({devise})', { devise: deviseCourte() }))}" title="${esc(tR('Prix unitaire ({devise})', { devise: deviseCourte() }))}">
      <button type="button" class="log-piece-retirer" aria-label="${esc(trad('Retirer cette pièce'))}" title="${esc(trad('Retirer cette pièce'))}">${picto('corbeille')}</button>
    </div>`;
}

// Reprise Stitch « Enregistrer une intervention » (voir keeva-tco-feature) :
// un seul point d'entrée depuis la carte machine (data-open="log"), avec un
// choix de TYPE en tête — Entretien planifié / Dépannage curatif / Frais &
// Carburant — au lieu de l'ancienne modale de choix séparée
// (ouvrirChoixEnregistrement, retirée). Les 3 types restent des ÉCRITURES
// DISTINCTES : Entretien et Dépannage écrivent tous les deux dans
// `interventions` (même impact TCO, même historique — Dépannage ajoute
// juste kind/component/severity et n'a pas de checklist), Frais écrit dans
// `operating_costs` (fond ici l'ancien openLogOperatingCostModal). Fusionner
// les DONNÉES aurait mélangé deux historiques que le TCO ventile séparément
// (Pièces/MO/Frais Fixes) ; seule la PORTE D'ENTRÉE et le formulaire sont
// communs. Le sélecteur de type n'apparaît que si tcoActif() (Dépannage/
// Frais dépendent tous les deux du chantier TCO) — sans lui, la modale se
// comporte exactement comme avant (entretien seul).
// MENU DE CHOIX MAISON, GÉNÉRIQUE. Remplace le rendu d'un <select> natif dont
// la liste système peut être habillée par le constructeur/la ROM du
// téléphone (logo en fond répété derrière chaque ligne, constaté en test
// réel sur un Android — aucun contrôle possible depuis la page ni depuis
// l'appli sur ce rendu système). `options` : liste de { id, nom_affiche }.
// `valeurActuelle` : id déjà choisi (coche la ligne correspondante).
// `onChoisi(option)` : appelé à la sélection, juste avant la fermeture.
function ouvrirListeChoix(titre, options, valeurActuelle, onChoisi) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  // Une longue liste (pays, pièces…) se cherche plutôt qu'elle ne se parcourt : le champ de recherche
  // apparaît dès que les choix sont nombreux, sans accent ni majuscule à respecter.
  const AVEC_RECHERCHE = 8;
  const recherche = options.length >= AVEC_RECHERCHE;
  const norme = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <h2>${esc(titre)}</h2>
      ${recherche ? `
      <div class="liste-choix-recherche">
        <span class="card-ico">${picto('recherche')}</span>
        <input type="search" id="liste-choix-recherche" autocomplete="off" placeholder="${esc(trad('Rechercher…'))}" aria-label="${esc(trad('Rechercher…'))}">
      </div>` : ''}
      <div class="liste-choix"></div>
    </div>`;
  const zone = overlay.querySelector('.liste-choix');
  const dessiner = (texte) => {
    const t = norme(texte).trim();
    const liste = t ? options.filter((o) => norme(o.nom_affiche).includes(t)) : options;
    zone.innerHTML = liste.length ? liste.map((o) => `
          <button type="button" class="ligne-choix${o.id === (valeurActuelle || '') ? ' is-choisie' : ''}" data-id="${esc(o.id)}">
            <span>${esc(o.nom_affiche)}</span>
            <span class="ligne-choix-pastille" aria-hidden="true"></span>
          </button>`).join('') : `<div class="liste-choix-vide">${trad('Aucun résultat')}</div>`;
    zone.querySelectorAll('.ligne-choix').forEach((ligne) => {
      ligne.addEventListener('click', () => {
        const choisi = options.find((o) => o.id === ligne.dataset.id);
        overlay.remove();
        if (choisi) onChoisi(choisi);
      });
    });
  };
  dessiner('');
  if (recherche) {
    const champ = overlay.querySelector('#liste-choix-recherche');
    champ.addEventListener('input', () => dessiner(champ.value));
    // Au clavier d'ordinateur, on tape tout de suite ; sur téléphone on évite d'ouvrir le clavier d'office.
    if (!window.matchMedia('(pointer: coarse)').matches) champ.focus();
    // La ligne cochée est ramenée dans la vue (une liste de pays est longue).
    zone.querySelector('.is-choisie')?.scrollIntoView({ block: 'center' });
  }
}

// HABILLAGE D'UN <select> EXISTANT. Le <select> original reste dans le DOM —
// masqué, mais fonctionnel : son .value, ses écouteurs `change`, tout code
// qui le lit déjà (au submit, ailleurs) continue de marcher SANS AUCUN AUTRE
// CHANGEMENT. Un bouton visuel prend sa place, ouvre ouvrirListeChoix() avec
// ses <option> COURANTES. Un MutationObserver garde le bouton synchronisé si
// le select est repeuplé plus tard (ex. liste chargée après une requête
// réseau, ou `disabled` levé après coup) — habillerSelect() se pose donc en
// UN SEUL appel, juste après le rendu du <select>, même si son contenu
// définitif arrive après coup. Idempotent (un select déjà habillé ne l'est
// pas deux fois) : peut être rappelé sans risque sur toute une liste.
function habillerSelect(select, titre) {
  if (!select || select.dataset.habille) return;
  select.dataset.habille = '1';
  select.style.display = 'none';
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;

  const bouton = document.createElement('button');
  bouton.type = 'button';
  // Hérite des classes du select d'origine (ex. .tel-pays-etroit pour le
  // sélecteur d'indicatif téléphonique) : certains selects vivent dans une
  // mise en page compacte/flex précise que .champ-select seul ne connaît pas.
  bouton.className = `champ-select ${select.className}`.trim();
  if (select.id) bouton.id = `${select.id}-bouton`;
  select.insertAdjacentElement('afterend', bouton);

  const majBouton = () => {
    const opt = select.options[select.selectedIndex];
    const libelle = opt ? (opt.textContent || '').trim() : '';
    bouton.innerHTML = `<span>${esc(libelle || trad('Choisir…'))}</span>${picto('chevronBas')}`;
    bouton.disabled = select.disabled;
  };
  majBouton();

  bouton.addEventListener('click', () => {
    const optsListe = Array.from(select.options).map((o) => ({ id: o.value, nom_affiche: o.textContent }));
    const titreReel = titre || document.querySelector(`label[for="${select.id}"]`)?.textContent?.trim() || trad('Choisir');
    ouvrirListeChoix(titreReel, optsListe, select.value, (choisi) => {
      select.value = choisi.id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      majBouton();
    });
  });

  // subtree:true est nécessaire pour le cas « catégorie personnalisée » : le
  // texte d'une <option> déjà là est réécrit en direct (brancherCategorie),
  // ce qui ne remonte comme mutation qu'au niveau de l'option, pas du select.
  new MutationObserver(majBouton).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
}

// SÉLECTEUR DE DATE MAISON — même raison que ouvrirListeChoix/habillerSelect
// côté <select> : le calendrier natif Android (<input type="date">) montre
// LUI AUSSI le logo KALEA en fond (habillage système/ROM, constaté en test
// réel sur un vrai téléphone) — deux essais de réglage de thème natif
// (alertDialogTheme, puis datePickerDialogTheme) n'ont RIEN changé,
// confirmant que c'est hors de portée de l'appli, comme pour les listes
// déroulantes. Réutilise les mêmes fonctions de date que l'Agenda
// (agendaMoisGrille/agendaDebutSemaine/addDaysIso/addMonthsIso/todayIso/
// moisLong) — aucun nouveau calcul de calendrier, juste un nouvel habillage.
function ouvrirChoixDate(titre, valeurActuelle, onChoisi) {
  let refIso = /^\d{4}-\d{2}-\d{2}$/.test(valeurActuelle || '') ? valeurActuelle : todayIso();
  // Cliquer sur l'année bascule vers une liste déroulante d'années (évite
  // de remonter mois après mois pour une vieille machine) — même liste
  // que ouvrirListeChoix (.liste-choix/.ligne-choix), juste imbriquée dans
  // ce même overlay plutôt qu'un second overlay empilé.
  let modeAnnee = false;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const rendre = () => {
    const [an, mois] = refIso.split('-').map(Number);

    if (modeAnnee) {
      const anneeCourante = Number(todayIso().slice(0, 4));
      // Large marge vers le passé (équipements anciens) et petite marge
      // vers le futur (achats/mises en service planifiés à l'avance).
      const premiereAnnee = Math.min(an, anneeCourante) - 60;
      const derniereAnnee = Math.max(an, anneeCourante) + 5;
      const annees = [];
      for (let a = derniereAnnee; a >= premiereAnnee; a--) annees.push(a);
      overlay.innerHTML = `
        <div class="modal" style="max-width:360px;">
          <h2>${esc(titre)}</h2>
          <div class="choix-date-nav">
            <button type="button" class="icon-btn" id="choix-date-retour" aria-label="${esc(trad('Retour au calendrier'))}">${picto('flecheGauche')}</button>
            <span class="choix-date-mois">${esc(trad('Choisir une année'))}</span>
            <span style="width:20px;"></span>
          </div>
          <div class="liste-choix">
            ${annees.map((a) => `
              <button type="button" class="ligne-choix${a === an ? ' is-choisie' : ''}" data-annee="${a}">
                <span>${a}</span>
                <span class="ligne-choix-pastille" aria-hidden="true"></span>
              </button>`).join('')}
          </div>
        </div>`;
      overlay.querySelector('#choix-date-retour').addEventListener('click', () => { modeAnnee = false; rendre(); });
      overlay.querySelectorAll('.ligne-choix').forEach((ligne) => {
        ligne.addEventListener('click', () => {
          const a = Number(ligne.dataset.annee);
          refIso = `${a}-${String(mois).padStart(2, '0')}-01`; // jour clampé à 1 : évite les dates invalides (ex. 30 fév.)
          modeAnnee = false;
          rendre();
        });
      });
      overlay.querySelector('.ligne-choix.is-choisie')?.scrollIntoView({ block: 'center' });
      return;
    }

    const jours = agendaMoisGrille(refIso);
    // Initiales lundi→dimanche, par langue : « M » apparaît deux fois (mardi,
    // mercredi) et « S » deux fois en anglais, donc une clé trad() par lettre
    // ne peut pas les distinguer — même principe que MOIS_COURT.
    const noms = LANGUE === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    overlay.innerHTML = `
      <div class="modal" style="max-width:360px;">
        <h2>${esc(titre)}</h2>
        <div class="choix-date-nav">
          <button type="button" class="icon-btn" id="choix-date-prev" aria-label="${esc(trad('Mois précédent'))}">${picto('flecheGauche')}</button>
          <button type="button" class="choix-date-mois-bouton" id="choix-date-annee-toggle">${esc(moisLong(mois - 1))} ${an}</button>
          <button type="button" class="icon-btn" id="choix-date-next" aria-label="${esc(trad('Mois suivant'))}">${picto('flecheDroite')}</button>
        </div>
        <div class="choix-date-noms">${noms.map((n) => `<span>${esc(n)}</span>`).join('')}</div>
        <div class="choix-date-grille">
          ${jours.map((j) => `
            <button type="button" class="choix-date-jour${!j.dansLeMois ? ' is-hors-mois' : ''}${j.iso === todayIso() ? ' is-aujourdhui' : ''}${j.iso === valeurActuelle ? ' is-choisi' : ''}" data-iso="${esc(j.iso)}">${Number(j.iso.slice(8, 10))}</button>`).join('')}
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary" id="choix-date-today">${trad('Aujourd\'hui')}</button>
          ${valeurActuelle ? `<button type="button" class="secondary" id="choix-date-effacer">${trad('Effacer')}</button>` : ''}
        </div>
      </div>`;
    overlay.querySelector('#choix-date-prev').addEventListener('click', () => { refIso = addMonthsIso(refIso, -1); rendre(); });
    overlay.querySelector('#choix-date-next').addEventListener('click', () => { refIso = addMonthsIso(refIso, 1); rendre(); });
    overlay.querySelector('#choix-date-annee-toggle').addEventListener('click', () => { modeAnnee = true; rendre(); });
    overlay.querySelector('#choix-date-today').addEventListener('click', () => { overlay.remove(); onChoisi(todayIso()); });
    overlay.querySelector('#choix-date-effacer')?.addEventListener('click', () => { overlay.remove(); onChoisi(''); });
    overlay.querySelectorAll('.choix-date-jour').forEach((btn) => {
      btn.addEventListener('click', () => { overlay.remove(); onChoisi(btn.dataset.iso); });
    });
  };
  rendre();
}

// HABILLAGE D'UN <input type="date"> EXISTANT — même patron que
// habillerSelect() : l'input original reste dans le DOM (masqué, jamais
// retiré), son .value/ses écouteurs `input`/`change` continuent de marcher
// partout ailleurs SANS AUCUN CHANGEMENT (au submit, dans les aperçus
// live…). Idempotent.
function habillerChampDate(input, titre) {
  if (!input || input.dataset.habille) return;
  input.dataset.habille = '1';
  input.style.display = 'none';
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = `champ-select ${input.className}`.trim();
  if (input.id) bouton.id = `${input.id}-bouton`;
  input.insertAdjacentElement('afterend', bouton);

  const majBouton = () => {
    bouton.innerHTML = `<span>${esc(input.value ? formatShortDateAvecAnnee(input.value) : trad('Choisir une date…'))}</span>${picto('agenda')}`;
    bouton.disabled = input.disabled;
  };
  majBouton();

  bouton.addEventListener('click', () => {
    const titreReel = titre || document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim() || trad('Choisir une date');
    ouvrirChoixDate(titreReel, input.value, (iso) => {
      input.value = iso;
      // Deux évènements : certains écouteurs de ce projet réagissent à
      // `input` (aperçu en direct), d'autres à `change` (recalcul au
      // changement) — les deux existent déjà ailleurs dans ce fichier.
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      majBouton();
    });
  });

  new MutationObserver(majBouton).observe(input, { attributes: true, attributeFilter: ['disabled'] });
}

function openLogInterventionModal(machine, tache) {
  // « Marquer fait » pré-coche la ligne du bandeau cliqué, toujours sur
  // l'onglet Entretien planifié (seul onglet avec une checklist).
  if (refuserSiNonCouverte(machine)) return;
  const today = todayIso();
  const isCounter = planIsCounter(machine.plan);
  const unit = counterUnitOf(machine);
  // Second compteur : n'existe que si la machine en a un (voir
  // SCHEMA.hasCounter2) — sinon aucun champ, aucune question en plus.
  const unit2 = counterUnit2Of(machine);
  const overlay = document.createElement('div');
  overlay.className = 'overlay log-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Idem ici : le classement est projeté au rendu (même règle que l'écriture),
  // sans rien enregistrer. Les libellés cochés restent ceux du plan.
  const planItems = tachesAffichees(machine.plan, machine);
  const items = planItems.length
    ? planItems.map(it => it.label).filter(Boolean)
    : (machine.plan?.tasks || '').split(',').map(t => t.trim()).filter(Boolean);
  // Pour l'affichage en carte (spécification + cycle réels du plan) : les
  // mêmes objets que le tableau de référence de la fiche « Plan d'entretien »
  // quand ils existent, sinon un simple libellé.
  const itemsRiches = planItems.length ? planItems : items.map(label => ({ label }));

  const identifiant = identifiantAffiche(machine);
  const compteurActuel = machineCounter(machine);
  const avecTypes = tcoActif();

  // Organe mécanique défaillant (Dépannage) : référentiel configurable —
  // voir COMPOSANTS_DEPART/composantsUtiles/brancherComposant, écrit dans
  // interventions.component (texte libre, pas de clé interne).
  // Nature du frais (Frais & Carburant) : chaque option pointe vers l'un
  // des 5 genres RÉELS déjà utilisés par operating_costs.kind (voir
  // blocCatalogueTcoHtml/openLogOperatingCostModal d'origine) — jamais un
  // genre inventé, le libellé précis reste dans la note.
  const NATURES_FRAIS = {
    gazole: { libelle: trad('Plein Gazole de chantier'), kind: 'fuel' },
    transport: { libelle: trad('Transport engin (Porte-char)'), kind: 'other' },
    vgp: { libelle: trad('Contrôle périodique VGP'), kind: 'tax' },
    fluides: { libelle: trad('Appoint huiles hydrauliques'), kind: 'other' },
  };

  overlay.innerHTML = `
    <div class="modal">
      <div class="log-topband"></div>
      <div class="log-header2">
        <div>
          <div class="log-header2-eyebrow">
            <span class="log-header2-eyebrow-texte">${trad('Intervention atelier & chantier')}</span>
            ${machine.category?.name ? `<span class="log-header2-cat-badge">${esc(machine.category.name)}</span>` : ''}
          </div>
          <div class="log-header2-titre-ligne">
            <h2>${trad('Enregistrer une intervention')}</h2>
            <span class="log-chip-machine"><span class="dot"></span>${esc(machine.name)}</span>
            ${identifiant ? `<span class="log-chip-serial">${picto('compteur')}${esc(identifiant)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex:0 0 auto;">
          ${isCounter && compteurActuel != null ? `
          <div class="log-header2-compteur">
            <span class="lbl">${trad('Compteur certifié')}</span>
            <span class="val">${formatCounter(compteurActuel, unit)}</span>
          </div>` : ''}
          <button type="button" class="log-close2" id="cancel-log-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
        </div>
      </div>
      <form id="log-form">
      <div class="log-body2">

        ${avecTypes ? `
        <div>
          <div class="log-num-tete">
            <label class="log-num-label"><span class="log-num-dot" style="background:var(--ok);"></span>${trad('1. Type d\'intervention')}</label>
            <span class="log-num-hint">${trad('Sélectionnez la catégorie opérationnelle')}</span>
          </div>
          <div class="log-type-grid">
            <button type="button" class="log-type-carte is-active" data-kind="entretien">
              <div class="log-type-tete">
                <span class="log-type-icone">${picto('entretien')}</span>
                <span class="log-type-dot"><span class="log-type-dot-inner"></span></span>
              </div>
              <span><span class="log-type-titre">${trad('Entretien planifié')}</span><span class="log-type-texte">${trad('Périodique constructeur (checklist du plan)')}</span></span>
            </button>
            <button type="button" class="log-type-carte" data-kind="depannage">
              <div class="log-type-tete">
                <span class="log-type-icone">${picto('alerte')}</span>
                <span class="log-type-dot"><span class="log-type-dot-inner"></span></span>
              </div>
              <span><span class="log-type-titre">${trad('Dépannage / Curatif')}</span><span class="log-type-texte">${trad('Panne, casse d\'organe, arrêt non programmé')}</span></span>
            </button>
            <button type="button" class="log-type-carte" data-kind="frais">
              <div class="log-type-tete">
                <span class="log-type-icone">${picto('essence')}</span>
                <span class="log-type-dot"><span class="log-type-dot-inner"></span></span>
              </div>
              <span><span class="log-type-titre">${trad('Frais & Carburant')}</span><span class="log-type-texte">${trad('Carburant, transport, contrôle réglementaire')}</span></span>
            </button>
          </div>
        </div>` : ''}

        <div class="log-bloc log-bloc-quand">
          ${avecTypes ? `
          <div class="log-num-tete" style="margin-bottom:2px;">
            <label class="log-num-label"><span class="log-num-dot" style="background:var(--ink);"></span>${trad('2. Informations générales')}</label>
          </div>` : `
          <div class="log-section-tete" style="margin-bottom:2px;">
            <span class="log-section-tete-gauche"><span class="log-section-icone">${picto('calendrier')}</span><span style="font-weight:600;color:var(--ink);">${trad('Paramètres du relevé sur site')}</span></span>
          </div>`}
          <div class="field-row">
            <div>
              <label for="log-date">${picto('calendrier')}${trad('Date de l\'intervention')}</label>
              <input id="log-date" type="date" value="${today}" required>
              <div class="hint">${trad('Date d\'intervention sur site')}</div>
            </div>
            ${isCounter ? `
            <div id="log-compteur-bloc">
              <label for="log-hours">${picto('compteur')}${trad('Compteur relevé')}</label>
              <div class="log-compteur-ligne">
                <input id="log-hours" type="number" min="0" step="${COUNTER_UNITS[unit].step}" value="${esc(compteurActuel ?? '')}" required>
                <span class="log-compteur-unite">${esc(COUNTER_UNITS[unit].short)}</span>
              </div>
              ${compteurActuel != null ? `<div class="hint">${tR('Dernière valeur relevée : {valeur}', { valeur: formatCounter(compteurActuel, unit) })}</div>` : ''}
            </div>` : ''}
            <div>
              <label for="log-operateur">${picto('personne')}${trad('Intervenant assigné')}</label>
              <select id="log-operateur" disabled>
                <option value="">${trad('Chargement de l\'équipe…')}</option>
              </select>
              <div class="hint">${trad('Attribution de la fiche d\'intervention')}</div>
            </div>
          </div>
          ${unit2 ? `
          <div class="field-row" id="log-compteur2-bloc">
            <div>
              <label for="log-hours-2">${picto('compteur')}${tR('Second compteur ({unite})', { unite: trad((COUNTER_UNITS[unit2] || {}).word || unit2) })}</label>
              <div class="log-compteur-ligne">
                <input id="log-hours-2" type="number" min="0" step="${COUNTER_UNITS[unit2].step}" value="${esc(machineCounter2(machine) ?? '')}" required>
                <span class="log-compteur-unite">${esc(COUNTER_UNITS[unit2].short)}</span>
              </div>
              ${machineCounter2(machine) != null ? `<div class="hint">${tR('Dernière valeur relevée : {valeur}', { valeur: formatCounter(machineCounter2(machine), unit2) })}</div>` : ''}
            </div>
          </div>` : ''}
        </div>

        <div>
          ${avecTypes ? `
          <div class="log-num-tete">
            <label class="log-num-label"><span class="log-num-dot" style="background:var(--primary-dark);"></span>${trad('3. Détail opérationnel & consommables')}</label>
            <span class="log-num-hint" id="log-detail-subtitle">${trad('Checklist de maintenance cycle constructeur')}</span>
          </div>` : ''}

          <div class="log-panel" id="log-panel-entretien">
            ${items.length ? `
            <div class="log-bloc-elements" style="background:var(--surface-soft);box-shadow:var(--shadow-soft);border-radius:var(--r-card);padding:16px 20px;margin-top:${avecTypes ? '10px' : '0'};">
              <div class="log-elements-tete">
                <span class="log-section-tete-gauche">
                  <span class="log-section-icone is-indigo">${picto('case')}</span>
                  <span><span class="log-section-titre" style="display:block;">${trad('Éléments traités & opérations')}</span><span class="log-section-soustitre">${trad('Sélectionnez chaque poste vérifié ou remplacé')}</span></span>
                </span>
                <span style="display:flex;align-items:center;gap:12px;">
                  <span class="log-progress-capsule">
                    <span class="log-progress-piste"><span class="log-progress-remplie" id="log-progress-bar" style="width:0%;"></span></span>
                    <span id="log-coches-compte"></span>
                  </span>
                  <button type="button" class="log-tout-cocher" id="log-tout-cocher">${trad('Tout cocher')}</button>
                </span>
              </div>
              <div class="checklist log-checklist" id="log-checklist">
                ${itemsRiches.map((it) => {
                  const prefixe = PREFIXE_SPEC_CATEGORIE[categorieProduit(it.label)] || PREFIXE_SPEC_CATEGORIE.autres;
                  // L'état de CETTE tâche (le même calcul que partout ailleurs) teinte
                  // sa carte : orange si elle est en retard, indigo si elle approche.
                  // Seulement quand le plan détaille réellement ses tâches : un simple
                  // libellé n'a ni échéance ni état à montrer. Une tâche cochée repasse
                  // en vert (« traitée ») : la teinte d'état ne parle que de ce qui reste à faire.
                  let etatTache = null;
                  if (planItems.length) {
                    try { etatTache = infoTache(it, machine.plan, machine); } catch (err) { etatTache = null; }
                  }
                  const teinte = etatTache && (etatTache.state === 'late' || etatTache.state === 'soon') ? etatTache.state : '';
                  return `
                  <label class="log-item-carte${teinte ? ' is-' + teinte : ''}"${teinte ? ` title="${esc(etatTache.label || etatTache.short || '')}"` : ''}>
                    <input type="checkbox" value="${esc(it.label)}"${it.label === tache ? ' checked' : ''}>
                    <span class="log-item-check">${picto('coche')}</span>
                    <span class="${it.frequency ? 'log-item-colonnes' : 'log-item-corps-pleine'}">
                      <span class="log-item-titre-ligne">
                        <span class="log-item-titre">${esc(it.label)}</span>
                        ${it.frequency ? `<span class="log-item-cycle">${esc(it.frequency)}</span>` : ''}
                      </span>
                      ${it.spec ? `<span class="log-item-spec-ligne"><span class="log-item-spec-prefixe">${esc(prefixe())}</span><span class="log-item-spec">${esc(it.spec)}</span></span>` : ''}
                    </span>
                  </label>`;
                }).join('')}
              </div>
            </div>
            ` : `<div class="hint" style="margin-top:${avecTypes ? '10px' : '0'};">${trad('Aucune tâche détaillée sur le plan de cette machine.')}</div>`}
          </div>

          ${avecTypes ? `
          <div class="log-panel log-bloc log-bloc-depannage" id="log-panel-depannage" hidden style="margin-top:10px;">
            <div>
              <label for="log-organe">${trad('Organe mécanique défaillant')}</label>
              <select id="log-organe" required>${optionsComposantListe('', UI.components)}</select>
              <input id="log-organe-autre" placeholder="${trad('Ex. Réservoir de carburant')}" hidden>
            </div>
            <div>
              <label>${trad('Gravité sur le chantier')}</label>
              <div class="log-gravite-grid">
                <label class="log-gravite-carte is-immobilisant">
                  <input type="radio" name="log-gravite" value="immobilisant" required>
                  <span>${trad('Immobilisant (Arrêt)')}</span>
                </label>
                <label class="log-gravite-carte">
                  <input type="radio" name="log-gravite" value="partiel" required>
                  <span>${trad('Partiel / Dégradé')}</span>
                </label>
              </div>
            </div>
            <div>
              <label for="log-diagnostic">${picto('crayon')}${trad('Diagnostic de la panne & action corrective')}</label>
              <textarea id="log-diagnostic" required placeholder="${trad('Décrivez l\'incident rencontré, la pièce remplacée ou la réparation effectuée…')}"></textarea>
            </div>
          </div>

          <div class="log-panel log-bloc log-bloc-frais" id="log-panel-frais" hidden style="margin-top:10px;">
            <div class="field-row">
              <div>
                <label for="log-frais-nature">${trad('Nature du frais')}</label>
                <select id="log-frais-nature" required>
                  ${Object.entries(NATURES_FRAIS).map(([v, o]) => `<option value="${v}">${esc(o.libelle)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label for="log-frais-qte">${trad('Quantité / Litres')}</label>
                <input id="log-frais-qte" type="number" inputmode="decimal" min="0.01" step="any" placeholder="${trad('Ex. 50')}" required>
              </div>
              <div>
                <label for="log-frais-prix">${tR('Prix unitaire ({devise})', { devise: deviseCourte() })}</label>
                <input id="log-frais-prix" type="number" inputmode="decimal" min="0.01" step="any" placeholder="${trad('Ex. 170')}" required>
              </div>
            </div>
          </div>` : ''}
        </div>

        ${tcoActif() ? `
        <div class="log-bloc log-bloc-cout" id="log-couts-section">
          <div class="log-elements-tete">
            <span class="log-section-tete-gauche">
              <span class="log-section-icone is-indigo">${picto('paiement')}</span>
              <span><span class="log-section-titre" style="display:block;">${trad('Coûts d\'intervention & TCO')}<span class="log-optionnel" style="margin-left:8px;">${trad('Optionnel')}</span></span><span class="log-section-soustitre">${trad('Renseignez la main d\'œuvre et les consommables pour le suivi comptable')}</span></span>
            </span>
            <span class="log-step-tag">STEP 02</span>
          </div>
          <div class="field-row">
            <div>
              <label for="log-heures-mo">${picto('bientot')}${trad('Heures de main d\'œuvre')}</label>
              <div class="log-cout-champ-icone">
                <input id="log-heures-mo" type="number" inputmode="decimal" min="0" step="0.25" placeholder="${trad('Ex. 1.5')}">
                <span class="unite">${trad('heures')}</span>
              </div>
            </div>
            <div>
              <label for="log-cout-mo">${picto('calculatrice')}${tR('Coût main d\'œuvre ({devise})', { devise: deviseCourte() })}</label>
              <div class="log-cout-champ-icone">
                <input id="log-cout-mo" type="text" inputmode="decimal" placeholder="${trad('Ex. 67.50')}">
                <span class="unite">${deviseCourte()}</span>
              </div>
            </div>
            <div class="log-mo-ajouter-zone">
              <button type="button" class="log-mo-ajouter" id="log-mo-ajouter" title="${esc(trad('Ajoute ce montant au total pièces & consommables ci-dessous, et remet ces deux champs à zéro'))}">${picto('croix')}<span>${trad('Ajouter')}</span></button>
            </div>
          </div>
          <label class="log-pieces-label">${picto('boite')}${trad('Pièces détachées & consommables')}</label>
          <div class="log-bento-grid">
            <button type="button" class="log-bento-btn" id="log-piece-ajouter">
              <span class="log-bento-icone">${picto('croix')}</span>
              <span><span class="log-bento-titre">${trad('+ Ajouter une pièce')}</span><br><span class="log-bento-sub">${trad('Catalogue ou référence libre')}</span></span>
            </button>
            <button type="button" class="log-bento-btn" id="log-facture-photo-btn">
              <span class="log-bento-icone">${picto('photo')}</span>
              <span><span class="log-bento-titre">${trad('Scanner une facture')}</span><span class="log-bento-badge">${trad('OCR IA')}</span><br><span class="log-bento-sub">${trad('Lecture automatique du montant')}</span></span>
            </button>
          </div>
          <input id="log-facture-photo" type="file" accept="image/*" capture="environment" hidden>
          <div class="hint" id="log-facture-statut" role="status" aria-live="polite"></div>
          <div class="log-pieces-liste" id="log-pieces-liste"></div>
          <div class="log-pieces-total-ligne">
            <label style="margin:0;" for="log-pieces-total">${trad('Total pièces & consommables')} <span style="font-weight:400;color:var(--ink-2);">(${deviseCourte()})</span></label>
            <input id="log-pieces-total" class="montant" type="text" inputmode="decimal" value="0" style="width:110px;text-align:right;border:none;background:transparent;">
          </div>
        </div>` : ''}

        <div class="log-bloc log-bloc-remarques" id="log-remarques-section">
          <label for="log-notes">${picto('crayon')}${trad('Remarques')}<span class="log-optionnel" style="margin-left:8px;">${trad('Optionnel')}</span></label>
          <textarea id="log-notes" placeholder="${trad('Ex. Pièce X remplacée, RAS sinon')}"></textarea>
        </div>
        <div class="hint" id="log-error"></div>

        ${planItems.length && machine.plan ? `
        <div class="log-info-box" id="log-info-echeance">
          <span class="card-ico">${picto('etincelle')}</span>
          <div>
            <div class="log-info-titre">${trad('Calcul automatique du plan d\'entretien')}</div>
            <p id="log-preview-texte"></p>
          </div>
        </div>` : ''}
      </div>

        <div class="log-footer2">
          <button type="button" class="secondary" id="cancel-log">${trad('Annuler')}</button>
          <button type="submit" class="primary" id="log-submit-btn">${picto('ajuste')}<span><span id="log-submit-verbe">${tcoActif() ? trad('Valider et intégrer au TCO') : trad('Enregistrer l\'intervention')}</span>${tcoActif() ? ` (<span id="log-total-badge">0 ${deviseCourte()}</span>)` : ''}</span></button>
        </div>
      </form>
    </div>
  `;

  overlay.querySelector('#cancel-log').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#cancel-log-x').addEventListener('click', () => overlay.remove());

  habillerSelect(overlay.querySelector('#log-operateur'), trad('Intervenant assigné'));
  habillerChampDate(overlay.querySelector('#log-date'), trad('Date de l\'intervention'));
  habillerSelect(overlay.querySelector('#log-organe'), trad('Organe mécanique défaillant'));
  brancherComposant(overlay);
  habillerSelect(overlay.querySelector('#log-frais-nature'), trad('Nature du frais'));
  (async () => {
    const select = overlay.querySelector('#log-operateur');
    if (!select) return;
    try {
      const equipe = await equipePourAttribution();
      if (!overlay.isConnected) return;
      select.innerHTML = `<option value="">${trad('Non précisé')}</option>`
        + equipe.map(m => `<option value="${esc(m.id)}">${esc(m.nom_affiche)}</option>`).join('');
      select.disabled = false;
    } catch (err) {
      select.innerHTML = `<option value="">${trad('Équipe indisponible')}</option>`;
    }
  })();

  // ── Choix du type (Entretien / Dépannage / Frais) — voir le commentaire
  // en tête de fonction. Absent quand !tcoActif() : kindActif reste
  // 'entretien' pour toujours, comportement identique à avant ce chantier.
  let kindActif = 'entretien';
  const panelEls = {
    entretien: overlay.querySelector('#log-panel-entretien'),
    depannage: overlay.querySelector('#log-panel-depannage'),
    frais: overlay.querySelector('#log-panel-frais'),
  };
  const SOUS_TITRES = {
    entretien: trad('Checklist de maintenance cycle constructeur'),
    depannage: trad('Diagnostic d\'avarie & réparation mécanique'),
    frais: trad('Approvisionnement énergie & logistique'),
  };
  const detailSubtitleEl = overlay.querySelector('#log-detail-subtitle');
  const coutsSectionEl = overlay.querySelector('#log-couts-section');
  const remarquesSectionEl = overlay.querySelector('#log-remarques-section');
  const compteurBlocEl = overlay.querySelector('#log-compteur-bloc');
  const compteur2BlocEl = overlay.querySelector('#log-compteur2-bloc');
  const infoEcheanceEl = overlay.querySelector('#log-info-echeance');
  const totalBadgeEl = overlay.querySelector('#log-total-badge');

  const majTotalFooter = () => {
    if (!totalBadgeEl) return;
    let total = 0;
    if (kindActif === 'frais') {
      const qte = Number(overlay.querySelector('#log-frais-qte')?.value) || 0;
      const prix = Number(overlay.querySelector('#log-frais-prix')?.value) || 0;
      total = qte * prix;
    } else if (tcoActif()) {
      total = (nombreDepuisTexte(overlay.querySelector('#log-cout-mo')?.value) || 0)
        + (nombreDepuisTexte(overlay.querySelector('#log-pieces-total')?.value) || 0);
    }
    totalBadgeEl.textContent = `${texteAvecSeparateurs(total)} ${deviseCourte()}`;
  };

  // ⚠️ `hidden` (attribut ou propriété) NE DISPENSE PAS un champ `required`
  // de la validation native du formulaire dans ce navigateur — vérifié en
  // testant : un radio « Gravité » resté required mais masqué (Frais actif)
  // bloquait quand même la soumission avec « Veuillez sélectionner l'une de
  // ces options. », alors que l'élément n'était ni affiché ni dans le flux
  // (offsetParent null, display:none confirmé). Il faut donc BASCULER
  // `required` explicitement à chaque changement d'onglet, jamais compter
  // sur le masquage seul pour exempter un champ de la validation.
  const champsDepannage = [
    overlay.querySelector('#log-organe'),
    ...overlay.querySelectorAll('input[name="log-gravite"]'),
    overlay.querySelector('#log-diagnostic'),
  ].filter(Boolean);
  const champsFrais = [
    overlay.querySelector('#log-frais-nature'),
    overlay.querySelector('#log-frais-qte'),
    overlay.querySelector('#log-frais-prix'),
  ].filter(Boolean);
  const champCompteur = overlay.querySelector('#log-hours');
  const champCompteur2 = overlay.querySelector('#log-hours-2');

  const selectKind = (kind) => {
    kindActif = kind;
    overlay.querySelectorAll('.log-type-carte').forEach((c) => c.classList.toggle('is-active', c.dataset.kind === kind));
    Object.entries(panelEls).forEach(([k, el]) => { if (el) el.hidden = k !== kind; });
    if (detailSubtitleEl) detailSubtitleEl.textContent = SOUS_TITRES[kind];
    if (coutsSectionEl) coutsSectionEl.hidden = kind === 'frais';
    if (remarquesSectionEl) remarquesSectionEl.hidden = kind === 'depannage';
    if (compteurBlocEl) compteurBlocEl.hidden = kind === 'frais';
    if (compteur2BlocEl) compteur2BlocEl.hidden = kind === 'frais';
    if (infoEcheanceEl) infoEcheanceEl.hidden = kind !== 'entretien';
    champsDepannage.forEach((el) => { el.required = kind === 'depannage'; });
    champsFrais.forEach((el) => { el.required = kind === 'frais'; });
    if (champCompteur) champCompteur.required = isCounter && kind !== 'frais';
    if (champCompteur2) champCompteur2.required = kind !== 'frais';
    majTotalFooter();
    majApercu();
  };
  overlay.querySelectorAll('.log-type-carte').forEach((carte) => {
    carte.addEventListener('click', () => selectKind(carte.dataset.kind));
  });
  overlay.querySelector('#log-frais-qte')?.addEventListener('input', majTotalFooter);
  overlay.querySelector('#log-frais-prix')?.addEventListener('input', majTotalFooter);

  // Compteur de cases cochées + prévision de la prochaine échéance : une
  // VRAIE prévision, calculée par la même fonction pure que l'enregistrement
  // (tachesApresEntretien) — jamais un nombre deviné à l'écran. Ne s'applique
  // qu'à l'onglet Entretien planifié (seul à porter une checklist).
  const majApercu = () => {
    if (kindActif !== 'entretien') return;
    overlay.querySelectorAll('.log-item-carte').forEach((carte) => {
      carte.classList.toggle('is-checked', !!carte.querySelector('input')?.checked);
    });
    const checkedNow = overlay.querySelectorAll('.log-checklist input:checked').length;
    const compteEl = overlay.querySelector('#log-coches-compte');
    if (compteEl) compteEl.textContent = tR('{n} / {total} cochés', { n: checkedNow, total: items.length });
    const barreEl = overlay.querySelector('#log-progress-bar');
    if (barreEl) barreEl.style.width = `${items.length ? Math.round((checkedNow / items.length) * 100) : 0}%`;
    const toutCocherBtn = overlay.querySelector('#log-tout-cocher');
    if (toutCocherBtn) toutCocherBtn.textContent = checkedNow === items.length && items.length > 0 ? trad('Tout décocher') : trad('Tout cocher');

    const previewEl = overlay.querySelector('#log-preview-texte');
    if (!previewEl) return;
    const checkedItems = Array.from(overlay.querySelectorAll('.log-checklist input:checked')).map(c => c.value);
    const dateVal = overlay.querySelector('#log-date')?.value || today;
    const hoursVal = isCounter ? parseFloat(overlay.querySelector('#log-hours')?.value) : null;
    if (isCounter && !Number.isFinite(hoursVal)) {
      previewEl.textContent = trad('Indique le relevé du compteur pour voir la prochaine échéance.');
      return;
    }
    const hoursVal2 = unit2 ? parseFloat(overlay.querySelector('#log-hours-2')?.value) : null;
    if (unit2 && !Number.isFinite(hoursVal2)) {
      previewEl.textContent = trad('Indique le relevé du second compteur pour voir la prochaine échéance.');
      return;
    }
    const suivi = tachesApresEntretien(planItems, machine.plan, machine, checkedItems, hoursVal, dateVal, hoursVal2);
    const echeance = suivi ? suivi.echeance : null;
    if (echeance == null) {
      previewEl.textContent = checkedItems.length
        ? trad('Aucun des éléments cochés ne porte d\'échéance chiffrée : la prochaine alerte du plan ne changera pas.')
        : trad('Coche au moins un élément pour recalculer la prochaine échéance.');
      return;
    }
    previewEl.textContent = isCounter
      ? tR('L\'enregistrement met à jour le plan pour une prochaine alerte à {valeur}.', { valeur: formatCounter(echeance, unit) })
      : tR('L\'enregistrement met à jour le plan pour une prochaine alerte le {valeur}.', { valeur: formatShortDate(echeance) });
  };
  overlay.querySelectorAll('.log-checklist input').forEach((c) => c.addEventListener('change', majApercu));
  overlay.querySelector('#log-date')?.addEventListener('input', majApercu);
  overlay.querySelector('#log-hours')?.addEventListener('input', majApercu);
  overlay.querySelector('#log-hours-2')?.addEventListener('input', majApercu);
  // Initialise l'état `required` réel dès l'ouverture (voir le commentaire
  // au-dessus de selectKind) : le HTML statique pose `required` sur les
  // champs Dépannage/Frais, nécessaire quand CET onglet est actif, mais
  // l'onglet par défaut est Entretien — sans cet appel, ces champs
  // resteraient `required` alors qu'ils sont masqués. Doit s'exécuter
  // APRÈS la définition de majApercu (appelée par selectKind).
  if (avecTypes) selectKind('entretien'); else majApercu();

  // « Tout cocher » / « Tout décocher » — bascule selon l'état actuel (le
  // libellé du bouton, mis à jour par majApercu, dit déjà lequel des deux
  // s'applique).
  overlay.querySelector('#log-tout-cocher')?.addEventListener('click', () => {
    const cases = overlay.querySelectorAll('.log-checklist input[type=checkbox]');
    const toutCoche = Array.from(cases).every((c) => c.checked);
    cases.forEach((c) => { c.checked = !toutCoche; });
    majApercu();
  });

  // ── Coûts (optionnel, voir tcoActif()) ──────────────────────
  if (tcoActif()) {
    let pieceIdx = 0;
    const piecesListe = overlay.querySelector('#log-pieces-liste');
    const totalPiecesChamp = overlay.querySelector('#log-pieces-total');
    activerSeparateurMilliers(overlay.querySelector('#log-cout-mo'));
    activerSeparateurMilliers(totalPiecesChamp);
    // Le total est RECALCULÉ depuis les lignes à chaque changement, mais reste
    // un champ éditable : une facture globale sans détail pièce par pièce, ou
    // le montant proposé par la lecture de photo, doivent pouvoir s'y écrire
    // directement sans passer par une ligne.
    // Part du total qui ne vient PAS d'une ligne de pièce — la main d'œuvre
    // « Ajoutée » (bouton #log-mo-ajouter) et les montants lus par photo de
    // facture. Sans ce suivi séparé, ajouter/retirer une pièce ensuite
    // RECALCULE le total depuis les seules lignes et efface silencieusement
    // ce qui avait été ajouté par ailleurs — bug réel constaté en testant.
    let montantHorsPieces = 0;
    const recalcTotalPieces = () => {
      if (!piecesListe || !totalPiecesChamp) return;
      let total = montantHorsPieces;
      piecesListe.querySelectorAll('.log-piece-ligne').forEach((ligne) => {
        const qte = Number(ligne.querySelector('.log-piece-qte')?.value) || 0;
        const prix = nombreDepuisTexte(ligne.querySelector('.log-piece-prix')?.value) || 0;
        total += qte * prix;
      });
      totalPiecesChamp.value = texteAvecSeparateurs(total || 0);
      majTotalFooter();
    };
    overlay.querySelector('#log-piece-ajouter')?.addEventListener('click', () => {
      if (!piecesListe) return;
      pieceIdx += 1;
      piecesListe.insertAdjacentHTML('beforeend', ligneLogPieceHtml(pieceIdx));
      const nouvelleLigne = piecesListe.querySelector(`[data-piece-ligne="${pieceIdx}"]`);
      activerSeparateurMilliers(nouvelleLigne?.querySelector('.log-piece-prix'));
      habillerSelectPieceCatalogue(nouvelleLigne?.querySelector('.log-piece-select'));
    });
    piecesListe?.addEventListener('change', (e) => {
      if (e.target.classList.contains('log-piece-select')) {
        const ligne = e.target.closest('.log-piece-ligne');
        const option = e.target.selectedOptions[0];
        const prixChamp = ligne?.querySelector('.log-piece-prix');
        // Le prix du catalogue se PROPOSE dans la ligne — il reste un champ
        // normal, modifiable ensuite (remise, prix négocié ce jour-là…).
        if (prixChamp && option && option.dataset.prix !== undefined) prixChamp.value = texteAvecSeparateurs(option.dataset.prix);
      }
      recalcTotalPieces();
    });
    piecesListe?.addEventListener('input', recalcTotalPieces);
    piecesListe?.addEventListener('click', (e) => {
      const retirer = e.target.closest('.log-piece-retirer');
      if (!retirer) return;
      retirer.closest('.log-piece-ligne')?.remove();
      recalcTotalPieces();
    });

    // Coût main d'œuvre : proposé depuis heures × taux horaire de la société
    // (Coûts & TCO), mais reste modifiable — le taux peut être absent, ou ne
    // pas convenir ce jour-là (heures supplémentaires, sous-traitant…).
    overlay.querySelector('#log-heures-mo')?.addEventListener('input', () => {
      const heures = Number(overlay.querySelector('#log-heures-mo').value) || 0;
      const taux = Number(UI.company?.labor_hourly_rate) || 0;
      const coutChamp = overlay.querySelector('#log-cout-mo');
      if (coutChamp && taux > 0) coutChamp.value = texteAvecSeparateurs(heures * taux);
      majTotalFooter();
    });
    overlay.querySelector('#log-cout-mo')?.addEventListener('input', majTotalFooter);

    // « Ajouter » (main d'œuvre → total pièces & consommables) : DÉPLACE le
    // montant, ne le copie pas — il s'ajoute au total affiché puis les deux
    // champs main d'œuvre repassent à vide. C'est ce qui évite un double
    // compte à l'enregistrement (labor_cost est lu directement de ces deux
    // champs, voir plus bas ; s'ils sont vides, labor_cost est null et
    // seul le total pièces porte le montant). Permet aussi plusieurs
    // passages de main d'œuvre dans la même intervention (deux
    // techniciens, deux tarifs) : chaque clic ajoute au même total.
    overlay.querySelector('#log-mo-ajouter')?.addEventListener('click', () => {
      const heuresChamp = overlay.querySelector('#log-heures-mo');
      const coutChamp = overlay.querySelector('#log-cout-mo');
      const montant = nombreDepuisTexte(coutChamp?.value);
      if (!montant || montant <= 0) return;
      montantHorsPieces += montant;
      // Les deux champs sont vidés AVANT le recalcul : le total du bas (« Valider… ») additionne
      // main d'œuvre + pièces, il compterait sinon le montant deux fois (une fois dans chaque).
      if (coutChamp) coutChamp.value = '';
      if (heuresChamp) heuresChamp.value = '';
      recalcTotalPieces();
    });

    // Lecture d'une facture par photo : propose un montant, ne l'enregistre
    // jamais sans que l'utilisateur ait vu et pu corriger (la lecture de
    // compteur par photo suivait la même règle, avant d'être retirée —
    // fiabilité insuffisante en usage réel, demande explicite).
    // ⚠️ Dépendance : suppose une Edge Function `lire-facture` déployée
    // séparément (voir keeva-tco-feature) ; message d'erreur clair et saisie
    // manuelle disponible tant qu'elle ne l'est pas.
    overlay.querySelector('#log-facture-photo-btn')?.addEventListener('click', () => {
      overlay.querySelector('#log-facture-photo')?.click();
    });
    overlay.querySelector('#log-facture-photo')?.addEventListener('change', async (e) => {
      const fichier = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!fichier) return;
      const statut = overlay.querySelector('#log-facture-statut');
      const dire = (texte) => { if (statut) statut.textContent = texte || ''; };
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        dire(trad('La lecture d\'une photo nécessite une connexion — saisis le montant à la main.'));
        return;
      }
      dire(trad('Lecture de la photo…'));
      let base64 = '';
      try {
        const reduite = await reduirePhotoCarnet(fichier);
        const dataUrl = await blobVersDataUrl(reduite.blob);
        base64 = String(dataUrl).split(',')[1] || '';
      } catch (err) {
        dire(tR('Photo illisible ({erreur}) — saisis le montant à la main.', { erreur: (err && err.message) || err }));
        return;
      }
      if (!base64) { dire(trad('Photo illisible — saisis le montant à la main.')); return; }
      let reponse = null;
      try {
        const { data, error } = await sb.functions.invoke('lire-facture', { body: { imageBase64: base64, mimeType: 'image/jpeg' } });
        if (error) throw new Error(await functionErrorMessage(error, trad('lecture impossible')));
        reponse = data;
      } catch (err) {
        dire(tR('Lecture impossible ({erreur}) — saisis le montant à la main.', { erreur: (err && err.message) || err }));
        return;
      }
      if (!reponse || reponse.lisible === false || reponse.montant_ttc == null) {
        dire(trad('Je n\'ai pas réussi à lire la facture — saisis le montant à la main.'));
        return;
      }
      // Ajouté au total (comme le bouton « Ajouter » de la main d'œuvre),
      // pas écrasé — une pièce ajoutée ensuite ne doit pas faire disparaître
      // ce montant lu (même correctif que #log-mo-ajouter, voir plus haut).
      montantHorsPieces += Number(reponse.montant_ttc) || 0;
      recalcTotalPieces();
      dire(tR('Montant lu : {valeur} — vérifie avant d\'enregistrer.', { valeur: formatMontant(reponse.montant_ttc) }));
    });
  }

  overlay.querySelector('#log-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = overlay.querySelector('#log-submit-btn');
    const submitVerbeEl = overlay.querySelector('#log-submit-verbe');
    const verbeRepos = tcoActif() ? trad('Valider et intégrer au TCO') : trad('Enregistrer l\'intervention');
    const errorEl = overlay.querySelector('#log-error');
    submitBtn.disabled = true;
    if (submitVerbeEl) submitVerbeEl.textContent = trad('Enregistrement…');

    // ── Frais & Carburant : écrit dans operating_costs, jamais dans
    // interventions — aucune tâche, aucun relevé de compteur, aucun impact
    // sur l'échéance du plan (voir le commentaire en tête de fonction).
    if (kindActif === 'frais') {
      const nature = overlay.querySelector('#log-frais-nature').value;
      const infoNature = NATURES_FRAIS[nature];
      const qte = Number(overlay.querySelector('#log-frais-qte').value) || 0;
      const prix = Number(overlay.querySelector('#log-frais-prix').value) || 0;
      const montant = Math.round(qte * prix);
      const noteLibre = overlay.querySelector('#log-notes').value.trim();
      const incurredAt = overlay.querySelector('#log-date').value;
      if (!montant || montant <= 0) {
        errorEl.textContent = trad('Le montant doit être supérieur à 0.');
        submitBtn.disabled = false;
        if (submitVerbeEl) submitVerbeEl.textContent = verbeRepos;
        return;
      }
      try {
        const note = [infoNature?.libelle, noteLibre].filter(Boolean).join(' — ');
        const { error } = await sb.from('operating_costs').insert({
          machine_id: machine.id,
          kind: infoNature?.kind || 'other',
          amount: montant,
          incurred_at: incurredAt || todayIso(),
          notes: note || null,
        });
        if (error) throw error;
        overlay.remove();
        boot(trad('Frais enregistré'));
      } catch (err) {
        errorEl.textContent = trad('Erreur :') + " " + err.message;
        submitBtn.disabled = false;
        if (submitVerbeEl) submitVerbeEl.textContent = verbeRepos;
      }
      return;
    }

    // ── Entretien planifié / Dépannage curatif : écrivent tous les deux
    // dans interventions (même impact TCO). Seul « Entretien » porte une
    // checklist qui fait avancer l'échéance du plan ; « Dépannage » garde
    // kind/component/severity mais checkedItems reste vide (aucune
    // checklist rendue pour cet onglet), donc l'échéance du plan ne bouge
    // pas — un dépannage sur un organe hors-plan ne doit pas remettre à
    // zéro le compteur d'entretien préventif.
    const performedAt = overlay.querySelector('#log-date').value;
    const hoursValue = isCounter ? parseFloat(overlay.querySelector('#log-hours').value) : null;
    const hoursValue2 = unit2 ? parseFloat(overlay.querySelector('#log-hours-2').value) : null;
    const checkedItems = kindActif === 'entretien' && items.length
      ? Array.from(overlay.querySelectorAll('.log-checklist input:checked')).map(c => c.value)
      : [];
    const operateur = overlay.querySelector('#log-operateur')?.value || null;
    const notes = kindActif === 'depannage'
      ? overlay.querySelector('#log-diagnostic')?.value.trim() || ''
      : overlay.querySelector('#log-notes').value.trim();
    const componentVal = kindActif === 'depannage' ? (overlay.querySelector('#log-organe')?.value || null) : null;
    const severiteVal = kindActif === 'depannage' ? (overlay.querySelector('input[name="log-gravite"]:checked')?.value || null) : null;
    // Coûts (optionnel, voir tcoActif()) : le total pièces vient du champ
    // (recalculé depuis les lignes, mais éditable — voir le câblage
    // ci-dessus), les lignes elles-mêmes de intervention_parts pour le détail.
    const laborHours = tcoActif() ? (parseFloat(overlay.querySelector('#log-heures-mo')?.value) || null) : null;
    const laborCost = tcoActif() ? nombreDepuisTexte(overlay.querySelector('#log-cout-mo')?.value) : null;
    const partsCost = tcoActif() ? nombreDepuisTexte(overlay.querySelector('#log-pieces-total')?.value) : null;
    const pieceLignes = tcoActif()
      ? Array.from(overlay.querySelectorAll('.log-piece-ligne'))
          .map((ligne) => ({
            partId: ligne.querySelector('.log-piece-select')?.value || null,
            designation: ligne.querySelector('.log-piece-select')?.selectedOptions[0]?.textContent || '',
            quantity: Number(ligne.querySelector('.log-piece-qte')?.value) || 0,
            unitPrice: nombreDepuisTexte(ligne.querySelector('.log-piece-prix')?.value) || 0,
          }))
          // Une ligne sans pièce choisie (option vide encore sélectionnée)
          // n'est pas une pièce utilisée : `partId` est vide tant que rien
          // n'a été choisi, c'est le seul signal fiable ici.
          .filter((l) => l.partId && l.quantity > 0)
      : [];

    // Nouvel organe tapé via « Autre… » : enregistré dans le référentiel de
    // la société AVANT l'intervention, pour qu'il réapparaisse pour toute
    // l'équipe dès la prochaine ouverture — jamais bloquant : une erreur ici
    // (ex. conflit d'unicité si deux personnes l'ajoutent en même temps)
    // n'empêche pas l'enregistrement de l'intervention elle-même.
    if (componentVal && !composantsUtiles(UI.components).some((c) => c.toLowerCase() === componentVal.toLowerCase())) {
      try {
        const { data: newComp } = await sb
          .from('intervention_components')
          .insert({ company_id: UI.companyId, name: componentVal })
          .select('id, name')
          .single();
        if (newComp) UI.components.push(newComp);
        retenirComposant(componentVal);
      } catch (err) { /* référentiel non critique */ }
    }

    try {
      const { data: intervention, error: logErr } = await sb.from('interventions').insert({
        machine_id: machine.id,
        plan_id: machine.plan?.id || null,
        performed_at: performedAt,
        hours_at_intervention: hoursValue,
        ...(unit2 ? { hours_at_intervention_2: hoursValue2 } : {}),
        description: notes || null,
        items_done: checkedItems.length ? checkedItems : null,
        performed_by: operateur,
        ...(avecTypes ? { kind: kindActif, component: componentVal, severity: severiteVal } : {}),
        ...(tcoActif() ? { parts_cost: partsCost, labor_cost: laborCost, labor_hours: laborHours } : {}),
      }).select('id').single();
      if (logErr) throw logErr;

      if (tcoActif() && pieceLignes.length && intervention?.id) {
        // Détail des pièces : jamais bloquant pour l'enregistrement de
        // l'intervention elle-même — une erreur ici est signalée, pas fatale.
        const { error: piecesErr } = await sb.from('intervention_parts').insert(
          pieceLignes.map((l) => ({
            intervention_id: intervention.id,
            part_id: l.partId,
            designation: l.designation,
            quantity: l.quantity,
            unit_price: l.unitPrice,
          }))
        );
        if (piecesErr) console.warn('Détail des pièces non enregistré :', piecesErr.message);
      }

      if (isCounter && hoursValue != null) {
        const { error: machErr } = await sb.from('machines').update(machineCounterPatch(hoursValue, machine)).eq('id', machine.id);
        if (machErr) throw machErr;
      }
      if (unit2 && hoursValue2 != null) {
        const { error: mach2Err } = await sb.from('machines').update(machineCounter2Patch(hoursValue2, unit2)).eq('id', machine.id);
        if (mach2Err) throw mach2Err;
      }

      if (machine.plan?.id) {
        const planUpdate = {};
        // UNE ÉCHÉANCE PAR TÂCHE. Cas réel : l'huile était due à 20 h et le
        // compteur est à 22 h (donc « en retard de 2 h ») ; un graissage saisi à
        // 25 h effaçait ce retard alors que la vidange n'avait jamais été faite.
        // Désormais seules les tâches cochées avancent, et l'échéance du plan est
        // le MINIMUM de ses tâches comparables — y compris quand ce minimum vaut
        // « aucune » : un plan dont toutes les tâches sont des points de contrôle
        // ou des échéances d'une autre unité n'a plus d'échéance générale, et
        // garder l'ancienne valeur en ferait un vestige qui rend la machine « en
        // retard » à tort (cas réel : « Vehicule du PDG », 1 470 km fantômes).
        const suivi = tachesApresEntretien(planItems, machine.plan, machine, checkedItems, hoursValue, performedAt, hoursValue2);
        if (suivi) {
          planUpdate.items = suivi.items;
          Object.assign(planUpdate, echeancePlanPatch(suivi.echeance, machine.plan));
          // Même règle pour le second suivi, s'il existe : son échéance suit
          // aussi le minimum de SES tâches, et disparaît si aucune ne la porte.
          // echeancePlanPatch2 écrit la bonne colonne selon son genre (date ou
          // compteur) — planNextDueCounter2Patch écrivait TOUJOURS dans la
          // colonne compteur, même pour un second suivi calendaire, qui ne
          // se mettait donc jamais à jour après un entretien (signalé le
          // 23/09, sur la Peugeot 208 après un entretien complet). ⚠️ `unit2`
          // (utilisé plus haut pour LE CHAMP DE RELEVÉ) est volontairement
          // restreint au compteur — il vaut null pour un second suivi
          // calendaire, ce qui empêchait CE correctif même de s'exécuter :
          // c'est modeSecondaireDe(machine) qu'il faut lire ici.
          if (modeSecondaireDe(machine)) Object.assign(planUpdate, echeancePlanPatch2(suivi.echeanceSecondaire, machine));
        } else if (journalAvanceEcheance(items, checkedItems)) {
          // Plan sans élément détaillé : comportement d'avant, inchangé.
          if (isCounter) {
            const interval = planIntervalCounter(machine.plan) || FALLBACK_INTERVAL_HOURS;
            Object.assign(planUpdate, planNextDueCounterPatch((hoursValue || 0) + interval));
          } else {
            planUpdate.next_due_at = addDaysIso(performedAt, machine.plan.interval_days || FALLBACK_INTERVAL_DAYS);
          }
        }
        if (Object.keys(planUpdate).length) {
          const { error: planErr } = await sb.from('maintenance_plans').update(planUpdate).eq('id', machine.plan.id);
          if (planErr) throw planErr;
        }
      }

      overlay.remove();
      boot(kindActif === 'depannage' ? trad('Dépannage enregistré') : trad('Entretien enregistré'));
    } catch (err) {
      errorEl.textContent = trad('Erreur :') + " " + err.message;
      submitBtn.disabled = false;
      if (submitVerbeEl) submitVerbeEl.textContent = verbeRepos;
    }
  });
}

// Coûts d'exploitation d'une machine (carburant, assurance, taxes…) — une
// ligne par événement réel, jamais un total recalculé silencieusement (voir
// keeva-tco-feature). Absent tant que tcoActif() est faux.
async function fetchOperatingCosts(machineId) {
  const { data, error } = await sb.from('operating_costs')
    .select('id, kind, amount, incurred_at, notes')
    .eq('machine_id', machineId)
    .order('incurred_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Récupère l'historique complet d'une machine : l'export CSV ne doit jamais
// être tronqué (PostgREST plafonne à 1000 lignes par requête).
async function fetchAllInterventions(machineId) {
  const pageSize = 1000;
  const all = [];
  const colonnesCout = tcoActif() ? ', parts_cost, labor_cost, labor_hours' : '';
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb.from('interventions')
      .select(`id, performed_at, hours_at_intervention, description, items_done, performed_by${colonnesCout}`)
      .eq('machine_id', machineId)
      .order('performed_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}
