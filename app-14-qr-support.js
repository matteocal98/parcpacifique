/* KALEA — application (app.html) : Liens profonds et scanner QR, QR code d'une machine, mode support « Se connecter en tant que ».
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · LIEN PROFOND QR CODE : deux chemins, UNE seule résolution
 *   · QR CODE D'UNE MACHINE : génération, téléchargement, impression
 *   · SCANNER QR : caméra en direct, décodage natif si possible
 *   · Mode support (« Se connecter en tant que » depuis admin.html)
 */
// ───────────────────────── début du code ─────────────────────────
// ── LIEN PROFOND QR CODE : deux chemins, UNE seule résolution ──────────
// Un QR imprimé encode une URL complète (`.../app.html?qr=<id>`). Elle peut
// être ouverte de deux façons, qui doivent aboutir EXACTEMENT au même
// résultat :
//   1. Scan par l'appareil photo natif du téléphone (hors appli) → l'URL est
//      chargée normalement → boot() → ouvrirFicheDepuisQrSiPresent().
//   2. Scan DEPUIS le scanner intégré (app ouverte) → ouvrirScannerQr()
//      décode le texte, en extrait le paramètre `qr`, et appelle directement
//      ouvrirFicheParId() — sans recharger la page.
// Les deux chemins passent donc par ouvrirFicheParId(), jamais dupliquée.
function ouvrirFicheParId(machineId) {
  const m = UI.machines.find((x) => x.id === machineId);
  if (m) { openPlanView(m, UI.companyId, UI.categories); return true; }
  // Silencieux et sans erreur brute : un id inconnu ou d'une AUTRE société
  // (donc absent de UI.machines, déjà filtré par société) ne doit jamais
  // afficher une erreur technique — juste dire qu'il n'y a rien à voir ici.
  showToast(trad('Machine introuvable ou non accessible.'));
  return false;
}

// Appelée une fois, après le rendu du parc dans boot() (UI.machines est
// alors chargé) — jamais avant, sinon la recherche échouerait à tort.
function ouvrirFicheDepuisQrSiPresent() {
  if (!__machineIdDepuisQr) return;
  // Nettoyage IMMÉDIAT de l'URL, même discipline qu'activerModeSupport() :
  // un id de machine qui traîne dans l'historique ne doit pas rouvrir la
  // fiche à chaque rafraîchissement de la page.
  history.replaceState(null, '', window.location.pathname);
  ouvrirFicheParId(__machineIdDepuisQr);
}

// Même rôle que ci-dessus, pour un tap sur une notification push arrivé
// avant que UI.machines soit chargé (voir wirePushEcouteurs) — appelée au
// même endroit dans boot(), juste après ouvrirFicheDepuisQrSiPresent().
function ouvrirFicheDepuisPushSiPresent() {
  if (!__machineIdDepuisPushEnAttente) return;
  const machineId = __machineIdDepuisPushEnAttente;
  __machineIdDepuisPushEnAttente = null;
  ouvrirFicheParId(machineId);
}

// ── QR CODE D'UNE MACHINE : génération, téléchargement, impression ─────
// Gated Business+ côté appelant (planCouvreQr(), voir le clic sur
// #plan-qr-code dans openPlanView) — cette fonction-ci ne revérifie pas le
// palier, elle suppose l'appelant déjà tranché, comme les autres actions de
// la fiche (ex. peutSupprimerMachine()).
async function ouvrirQrMachine(machine) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay qr-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;text-align:center;">
      <h2>${trad('QR code')}</h2>
      <p class="sub">${esc(machine.name)}</p>
      <div id="qr-zone" style="display:flex;justify-content:center;align-items:center;min-height:300px;margin:16px 0;">
        <span class="muted">${trad('Génération…')}</span>
      </div>
      <p class="hint">${trad('Colle ce QR code sur la machine : le scanner (menu Machines) ouvre directement cette fiche.')}</p>
      <div class="modal-actions">
        <button type="button" class="secondary" id="qr-imprimer" disabled>${trad('Imprimer')}</button>
        <button type="button" class="primary" id="qr-telecharger" disabled>${picto('export')}<span>${trad('Télécharger')}</span></button>
      </div>
    </div>`;

  try {
    const qrcodeLib = await loadQrCodeLib();
    // L'URL de CETTE page, jamais un domaine recopié à la main : marche donc
    // aussi bien en production (keeva.work) qu'en test local.
    const urlBase = window.location.origin + window.location.pathname;
    const urlQr = `${urlBase}?qr=${encodeURIComponent(machine.id)}`;
    // Correction d'erreur maximale ('H') : une étiquette imprimée en atelier
    // s'use, se salit, se plie — c'est elle qui tolère le mieux ces défauts.
    const qr = qrcodeLib(0, 'H');
    qr.addData(urlQr);
    qr.make();

    const taille = 300;
    const canvas = document.createElement('canvas');
    canvas.width = taille;
    canvas.height = taille;
    const ctx = canvas.getContext('2d');
    const nbModules = qr.getModuleCount();
    const cell = taille / nbModules;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, taille, taille);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < nbModules; r++) {
      for (let c = 0; c < nbModules; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, Math.ceil(cell) + 1, Math.ceil(cell) + 1);
      }
    }

    const zone = overlay.querySelector('#qr-zone');
    if (!zone) return; // la modale a été fermée pendant le chargement
    zone.innerHTML = '';
    canvas.style.maxWidth = '100%';
    zone.appendChild(canvas);

    const btnTelecharger = overlay.querySelector('#qr-telecharger');
    btnTelecharger.disabled = false;
    btnTelecharger.addEventListener('click', () => {
      canvas.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `qr_${(identifiantAffiche(machine) || machine.name || machine.id).replace(/[^\w-]+/g, '_')}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      }, 'image/png');
    });

    const btnImprimer = overlay.querySelector('#qr-imprimer');
    btnImprimer.disabled = false;
    btnImprimer.addEventListener('click', () => imprimerQr(canvas.toDataURL('image/png'), machine));
  } catch (err) {
    const zone = overlay.querySelector('#qr-zone');
    if (zone) zone.innerHTML = `<span class="muted">${esc(trad('Génération du QR code impossible.'))}</span>`;
  }
}

// Calque dédié imprimé seul (voir CSS #qr-impression / @media print) — créé
// juste avant window.print(), retiré juste après : jamais laissé dans le DOM.
function imprimerQr(dataUrl, machine) {
  const zone = document.createElement('div');
  zone.id = 'qr-impression';
  zone.innerHTML = `
    <img src="${dataUrl}" alt="QR code">
    <div class="qr-impression-nom">${esc(machine.name)}</div>
    ${identifiantAffiche(machine) ? `<div class="qr-impression-id">${esc(identifiantAffiche(machine))}</div>` : ''}
  `;
  document.body.appendChild(zone);
  window.print();
  zone.remove();
}

// ── SCANNER QR : caméra en direct, décodage natif si possible ──────────
// Gating de plan dans le clic sur #fleet-scanner (planPermetScannerQr : dès Starter) ; la génération
// (§ ouvrirQrMachine) reste réservée Business+.
// Décodage à DEUX niveaux : `BarcodeDetector` natif (zéro octet, intégré au
// navigateur/WebView moderne) en priorité, repli sur la bibliothèque vendue
// jsQR (loadJsQrLib) si l'API native est absente — jamais un échec silencieux
// faute de support natif.
async function ouvrirScannerQr() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);

  let stream = null;
  let arret = false;
  // ★ LA CAMÉRA EST TOUJOURS COUPÉE À LA FERMETURE — quel que soit le chemin
  //   (bouton, clic hors modale, décodage réussi). Une caméra qui reste
  //   allumée en arrière-plan est le bug de ce genre de fonctionnalité.
  const fermer = () => {
    arret = true;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    overlay.remove();
  };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;text-align:center;">
      <h2>${trad('Scanner un QR code')}</h2>
      <div id="scan-zone" style="position:relative;background:#000;border-radius:var(--r-md);overflow:hidden;aspect-ratio:1;display:flex;align-items:center;justify-content:center;">
        <span class="muted" style="color:#fff;">${trad('Démarrage de la caméra…')}</span>
      </div>
      <p class="hint" id="scan-message"></p>
      <div class="modal-actions">
        <button type="button" class="secondary" id="scan-fermer">${trad('Fermer')}</button>
      </div>
    </div>`;
  overlay.querySelector('#scan-fermer').addEventListener('click', fermer);

  const zone = overlay.querySelector('#scan-zone');
  const message = overlay.querySelector('#scan-message');

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (err) {
    if (zone) zone.innerHTML = `<span class="muted" style="color:#fff;">${esc(trad('Accès à la caméra refusé. Vérifie les réglages de ton téléphone ou de ton navigateur.'))}</span>`;
    return;
  }
  // La modale a pu être fermée pendant qu'on attendait la permission : on ne
  // laisse jamais une caméra tourner pour une fenêtre déjà refermée.
  if (arret) { stream.getTracks().forEach((t) => t.stop()); return; }
  if (!zone) { fermer(); return; }

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  video.srcObject = stream;
  zone.innerHTML = '';
  zone.appendChild(video);

  let detecteurNatif = null;
  if ('BarcodeDetector' in window) {
    try { detecteurNatif = new window.BarcodeDetector({ formats: ['qr_code'] }); }
    catch (e) { detecteurNatif = null; }
  }
  let jsQrFn = null;
  if (!detecteurNatif) {
    try { jsQrFn = await loadJsQrLib(); }
    catch (e) { if (message) message.textContent = trad('Lecteur de QR code indisponible.'); }
  }

  const canvasDecode = document.createElement('canvas');
  const ctxDecode = canvasDecode.getContext('2d', { willReadFrequently: true });

  // Même résolution que le lien profond (§ ouvrirFicheParId) : un QR qui
  // n'est pas une URL KALEA valide, ou qui pointe vers une machine hors de
  // portée, le dit simplement — jamais une erreur technique.
  const traiterTexte = (texte) => {
    let id = null;
    try { id = new URL(texte).searchParams.get('qr'); } catch (e) { /* pas une URL : ignoré ci-dessous */ }
    if (!id) { if (message) message.textContent = trad('Ce QR code ne correspond pas à une machine KALEA.'); return; }
    fermer();
    ouvrirFicheParId(id);
  };

  async function boucleDecodage() {
    if (arret) return;
    if (video.readyState < 2) { requestAnimationFrame(boucleDecodage); return; }
    try {
      if (detecteurNatif) {
        const codes = await detecteurNatif.detect(video);
        if (codes.length) { traiterTexte(codes[0].rawValue); return; }
      } else if (jsQrFn) {
        canvasDecode.width = video.videoWidth;
        canvasDecode.height = video.videoHeight;
        ctxDecode.drawImage(video, 0, 0, canvasDecode.width, canvasDecode.height);
        const image = ctxDecode.getImageData(0, 0, canvasDecode.width, canvasDecode.height);
        const resultat = jsQrFn(image.data, image.width, image.height);
        if (resultat && resultat.data) { traiterTexte(resultat.data); return; }
      }
    } catch (e) { /* une frame ratée n'interrompt jamais la boucle */ }
    if (!arret) requestAnimationFrame(boucleDecodage);
  }
  requestAnimationFrame(boucleDecodage);
}

// QUI A LE DROIT D'EFFACER UNE MACHINE. Un mécanicien MODIFIE une machine, il ne
// la supprime pas : c'est la règle du serveur (migration-roles-equipe.sql : la
// suppression de `machines` est réservée au gérant), et elle vaut aussi pour un
// chauffeur. Cette fonction ne décide rien : elle DIT ce que le serveur
// appliquera, en lisant le rôle que `boot()` a lu dans `profiles`.
//   Sans rôle connu, on n'accorde rien : un écran qui refuse à tort se voit et
//   se corrige, un écran qui propose à tort fait cliquer dans le vide.
function peutSupprimerMachine() {
  return UI.role === 'gerant';
}

function openMachineModal(companyId, categories, existing) {
  if (!existing) { openAddWizard(companyId, categories); return; }
  // Machine non couverte par l'offre : la fiche reste consultable (openPlanView),
  // mais rien de ce qui ÉCRIT ne s'ouvre — fiche, plan, compteur, photo, carnets,
  // suppression comprise. Le renvoi vers les offres explique quoi faire.
  if (refuserSiNonCouverte(existing)) return;
  const isEdit = !!existing;
  const today = todayIso();
  const overlay = document.createElement('div');
  // SANS .machine-modal : cette modale ne réutilise plus aucune de ses
  // règles (elle a son propre CSS compilé depuis le mockup Stitch) — et
  // partager .machine-modal avec l'Assistant d'ajout (openAddWizard)
  // faisait fuiter ses champs teintés indigo dans CETTE modale, un bug
  // réel repéré par l'utilisateur (spécificité (0,5,2) de la règle
  // ".machine-modal form input:not(...)" contre (0,2,0) pour mes classes
  // Tailwind compilées). .machine-modal-edit seule suffit à tout scoper.
  overlay.className = 'overlay machine-modal-edit';
  // Valeurs de départ calculées une fois : le gabarit reste lisible et le mode
  // de suivi (jours / heures / km) pilote à la fois l'unité et l'intervalle.
  const editMode = isEdit ? (existing.plan?.tracking_mode || 'days') : 'days';
  const editUnit = isEdit ? counterUnitOf(existing) : 'hours';
  const editCounter = isEdit ? machineCounter(existing) : null;
  const editInterval = isEdit
    ? (planIsCounter(existing.plan)
        ? (planIntervalCounter(existing.plan) || FALLBACK_INTERVAL_HOURS)
        : (existing.plan?.interval_days || FALLBACK_INTERVAL_DAYS))
    : FALLBACK_INTERVAL_DAYS;
  const editReminder = isEdit
    ? (planIsCounter(existing.plan)
        ? planReminderCounter(existing.plan)
        : (existing.plan?.reminder_days_before ?? FALLBACK_REMINDER_DAYS))
    : FALLBACK_REMINDER_DAYS;
  // Second suivi, optionnel (voir SCHEMA.hasCounter2) : déjà actif si la
  // machine porte un second suivi — compteur (avec relevé) ou calendaire
  // (sans relevé, chaque tâche porte déjà sa propre date).
  const editSecondaryUnit = isEdit ? modeSecondaireDe(existing) : null;
  const editSecondaryValue = isEdit ? machineCounter2(existing) : null;
  const editSecondaryInterval = isEdit ? (planIntervalCounter2(existing.plan) || FALLBACK_INTERVAL_HOURS) : FALLBACK_INTERVAL_HOURS;
  const editSecondaryReminder = isEdit ? planReminderCounter2(existing.plan) : FALLBACK_REMINDER_HOURS;
  const editSecondaryIntervalDays = isEdit ? (planIntervalDays2(existing.plan) || FALLBACK_INTERVAL_DAYS) : FALLBACK_INTERVAL_DAYS;
  const editSecondaryReminderDays = isEdit ? planReminderDays2(existing.plan) : FALLBACK_REMINDER_DAYS;

  const kindActuel = isEdit ? machineKind(existing) : TYPE_MACHINE;
  overlay.innerHTML = `
    <div class="modal">
      <div class="px-space-xl pt-space-lg pb-space-md flex items-start justify-between">
        <div class="flex flex-col gap-space-xs">
          <h2 class="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">${isEdit ? trad('Modifier une machine') : trad('Ajouter une machine')}</h2>
          <div class="flex items-center gap-space-xs">
            ${isEdit ? `<span class="font-label-md text-label-md text-primary font-semibold">${esc(existing.name)}</span>` : ''}
            ${isEdit && machineIdentifiant(existing) ? `<span class="w-1 h-1 rounded-full bg-outline-variant inline-block"></span>` : ''}
            ${isEdit && machineIdentifiant(existing) ? `<span class="font-label-sm text-label-sm text-outline uppercase tracking-wider">${esc(machineIdentifiant(existing))}</span>` : ''}
            ${isEdit ? `<span class="ml-space-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">${existing.status === 'en_service' ? trad('En service') : esc(existing.status)}</span>` : ''}
          </div>
        </div>
        <button aria-label="${esc(trad('Fermer'))}" class="w-10 h-10 rounded-xl bg-surface-container-low text-on-surface flex items-center justify-center hover:bg-surface-container transition-colors" type="button" id="mform-close">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <form id="add-form">
        <div class="px-space-xl py-space-md flex flex-col gap-space-xl overflow-y-auto">

        <section class="flex flex-col gap-space-md">
          <div class="flex items-center gap-space-sm">
            <div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold font-headline-sm text-headline-sm">01</div>
            <div class="flex items-center gap-space-xs">
              <span class="material-symbols-outlined text-primary text-[20px]">badge</span>
              <h3 class="font-headline-sm text-headline-sm font-semibold text-on-surface">${trad('Identification du matériel')}</h3>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div class="flex flex-col gap-space-xs">
              <label class="font-label-md text-label-md text-on-surface-variant font-semibold" for="f-name">${trad('Nom de la machine')}</label>
              <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm majuscules" type="text" id="f-name" autocapitalize="characters" required placeholder="${trad('Ex. OREC 4X4 - ATELIER')}" value="${isEdit ? esc(existing.name) : ''}">
            </div>
            <div class="flex flex-col gap-space-xs">
              <label class="font-label-md text-label-md text-on-surface-variant font-semibold" for="f-category">${trad('Catégorie')}</label>
              <div class="relative">
                <select class="w-full h-10 px-space-md pr-10 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md appearance-none focus:outline-none focus:ring-2 focus:ring-primary shadow-sm cursor-pointer" id="f-category" required>${optionsCategorieListe(isEdit ? existing.category?.name || '' : '', categories)}</select>
              </div>
            </div>
          </div>
          <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm majuscules" id="f-category-autre" autocapitalize="characters" placeholder="${trad('Ex. DÉBROUSSAILLEUSE À DOS')}" hidden>

          ${SCHEMA.hasKind ? `
          <div class="flex flex-col gap-space-xs">
            <label class="font-label-md text-label-md text-on-surface-variant font-semibold">${trad('Type d\'unité de surveillance principale')}</label>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md mform-cards" id="f-kind-cards">
              <label class="p-space-md flex items-center justify-between cursor-pointer mform-card ${kindActuel === TYPE_MACHINE ? 'is-selected' : ''}">
                <div class="flex items-center gap-space-md">
                  <input type="radio" name="kind" value="machine" ${kindActuel === TYPE_MACHINE ? 'checked' : ''}>
                  <div class="mform-card-ico"><span class="material-symbols-outlined text-[24px]">hourglass_top</span></div>
                  <div class="flex flex-col mform-card-corps">
                    <span class="font-label-lg text-label-lg font-bold mform-card-titre">${trad('Machine / Engin de chantier')}</span>
                    <span class="font-body-sm text-body-sm mform-card-texte">${trad('Suivi périodique au compteur horaire (heures)')}</span>
                  </div>
                </div>
                <span class="material-symbols-outlined text-on-primary text-[22px] mform-check-on">check_circle</span>
                <span class="mform-check-off"></span>
              </label>
              <label class="p-space-md flex items-center justify-between cursor-pointer mform-card ${kindActuel === TYPE_VEHICULE ? 'is-selected' : ''}">
                <div class="flex items-center gap-space-md">
                  <input type="radio" name="kind" value="vehicle" ${kindActuel === TYPE_VEHICULE ? 'checked' : ''}>
                  <div class="mform-card-ico"><span class="material-symbols-outlined text-[24px]">local_shipping</span></div>
                  <div class="flex flex-col mform-card-corps">
                    <span class="font-label-lg text-label-lg font-bold mform-card-titre">${trad('Véhicule roulant / Fourgon')}</span>
                    <span class="font-body-sm text-body-sm mform-card-texte">${trad('Suivi périodique à l\'odomètre (kilomètres)')}</span>
                  </div>
                </div>
                <span class="material-symbols-outlined text-on-primary text-[22px] mform-check-on">check_circle</span>
                <span class="mform-check-off"></span>
              </label>
            </div>
          </div>` : ''}

          <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            <div class="flex flex-col gap-space-xs">
              <label class="font-label-md text-label-md text-on-surface-variant font-semibold" for="f-brand">${trad('Marque')}</label>
              <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm majuscules" type="text" id="f-brand" placeholder="${trad('Ex. KUBOTA')}" autocapitalize="characters" value="${isEdit ? esc(machineBrand(existing)) : ''}">
            </div>
            <div class="flex flex-col gap-space-xs">
              <label class="font-label-md text-label-md text-on-surface-variant font-semibold" for="f-model">${trad('Modèle')}</label>
              <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm majuscules" type="text" id="f-model" placeholder="${trad('Ex. U17-3')}" autocapitalize="characters" value="${isEdit ? esc(machineModel(existing)) : ''}">
            </div>
            <div class="flex flex-col gap-space-xs">
              <label class="font-label-md text-label-md text-on-surface-variant font-semibold" for="f-year">${trad('Année du modèle')}</label>
              <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="f-year" type="number" inputmode="numeric" min="1950" max="2100" placeholder="${trad('Ex. 2019')}" value="${isEdit && machineYear(existing) ? machineYear(existing) : ''}">
            </div>
          </div>
          <div class="hint">${trad('Précise l\'année : un même modèle change parfois beaucoup d\'une version à l\'autre — la fiche et la photo aussi.')}</div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div class="flex flex-col gap-space-xs">
              <label class="font-label-md text-label-md text-on-surface-variant font-semibold" for="f-serial" id="f-identifiant-label">${IDENTIFIANT_LIBELLE[kindActuel]}</label>
              <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md font-mono focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" type="text" id="f-serial" placeholder="${IDENTIFIANT_PLACEHOLDER[kindActuel]}" value="${isEdit ? esc(machineIdentifiant(existing)) : ''}">
            </div>
            <div class="flex flex-col gap-space-xs">
              <label class="font-label-md text-label-md text-on-surface-variant font-semibold" for="f-service-date">${trad('Date de mise en service')}</label>
              <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="f-service-date" type="date" value="${isEdit ? esc(existing.service_date || today) : today}" required>
            </div>
          </div>

          ${tcoActif() ? `
          <div class="p-space-md rounded-xl flex flex-col gap-space-md mmod-tco-panel">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-space-xs">
                <span class="material-symbols-outlined text-primary text-[18px]">price_change</span>
                <span class="font-label-lg text-label-lg font-bold text-on-surface">${trad('Acquisition & TCO (Facultatif)')}</span>
              </div>
              <span class="font-label-sm text-label-sm text-outline font-medium">${trad('Pour le calcul de rentabilité')}</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-space-sm">
              <div class="flex flex-col gap-space-xs">
                <label class="font-label-sm text-label-sm text-on-surface-variant font-semibold" for="f-prix-achat">${tR('Prix d\'achat ({unite})', { unite: deviseCourte() })}</label>
                <input class="h-10 px-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" type="text" id="f-prix-achat" inputmode="decimal" placeholder="${trad('Ex. 25000')}" value="${isEdit && existing.purchase_price != null ? esc(existing.purchase_price) : ''}">
              </div>
              <div class="flex flex-col gap-space-xs">
                <label class="font-label-sm text-label-sm text-on-surface-variant font-semibold" for="f-date-achat">${trad('Date d\'achat')}</label>
                <input class="h-10 px-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="f-date-achat" type="date" value="${isEdit && existing.purchase_date ? esc(existing.purchase_date) : ''}">
              </div>
              <div class="flex flex-col gap-space-xs">
                <label class="font-label-sm text-label-sm text-on-surface-variant font-semibold" for="f-revente-estimee">${tR('Revente estimée ({unite})', { unite: deviseCourte() })}</label>
                <input class="h-10 px-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" type="text" id="f-revente-estimee" inputmode="decimal" placeholder="${trad('Ex. 5000')}" value="${isEdit && existing.estimated_resale_value != null ? esc(existing.estimated_resale_value) : ''}">
              </div>
              <div class="flex flex-col gap-space-xs">
                <label class="font-label-sm text-label-sm text-on-surface-variant font-semibold" id="f-duree-vie-etiquette" for="f-duree-vie" title="${esc(trad('Combien d\'heures (ou de km) la machine doit durer en tout : sert à afficher la part de vie déjà consommée.'))}">${tR('Durée de vie ({unite})', { unite: counterUnitOf(isEdit ? existing : { counter_unit: 'hours' }) === 'km' ? trad('km') : trad('heures') })}</label>
                <input class="h-10 px-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" type="text" id="f-duree-vie" inputmode="numeric" placeholder="${trad('Ex. 10000')}" value="${isEdit && existing.expected_lifespan_counter != null ? esc(existing.expected_lifespan_counter) : ''}">
              </div>
              <div class="flex flex-col gap-space-xs col-span-2 md:col-span-1">
                <label class="font-label-sm text-label-sm text-on-surface-variant font-semibold" for="f-amortissement">${trad('Amortissement (ans)')}</label>
                <input class="h-10 px-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" type="text" id="f-amortissement" inputmode="numeric" placeholder="${trad('Ex. 5')}" value="${isEdit && existing.amortization_years != null ? esc(existing.amortization_years) : ''}">
              </div>
            </div>
            <div class="hint" id="f-duree-vie-note"></div>
            <div class="hint">${trad('L\'amortissement (en années) sert à comparer le coût d\'entretien à la dépréciation annuelle de la machine (jauge Garder/Remplacer) ; sans lui, la jauge se base sur le cumul entretien / prix d\'achat. La durée de vie (en heures ou en km) sert à afficher la part de vie déjà consommée de la machine.')}</div>
            <div class="hint">${trad('Sert au calcul du coût total de possession (TCO), visible sur la fiche de la machine — laisse vide ce que tu ne connais pas encore.')}</div>
          </div>` : ''}
        </section>

        <section class="flex flex-col gap-space-md">
          <div class="flex items-center gap-space-sm">
            <div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold font-headline-sm text-headline-sm">02</div>
            <div class="flex items-center gap-space-xs">
              <span class="material-symbols-outlined text-primary text-[20px]">photo_camera</span>
              <h3 class="font-headline-sm text-headline-sm font-semibold text-on-surface">${trad('Visuel & photo du matériel')}</h3>
            </div>
          </div>
          <div class="flex flex-col md:flex-row items-start md:items-center gap-space-lg p-space-md rounded-xl mmod-photo-panel">
            <div class="relative w-44 h-28 rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-surface-container" id="photo-preview">
              ${isEdit && safeUrl(existing.image_url) ? `<img class="machine-photo w-full h-full object-contain" src="${esc(safeUrl(existing.image_url))}" alt="${esc(existing.name)}">` : ''}
            </div>
            <div class="flex flex-col gap-space-sm flex-1">
              <div class="flex flex-wrap items-center gap-space-sm">
                <button class="px-space-md py-2.5 rounded-lg bg-surface-container text-on-surface font-label-sm text-label-sm font-bold flex items-center gap-space-xs hover:bg-surface-container-high transition-colors shadow-sm" type="button" id="pick-photo-btn"><span class="material-symbols-outlined text-[18px]">folder_open</span>${trad('Choisir une photo')}</button>
                <button class="px-space-md py-2.5 rounded-lg bg-surface-container text-on-surface font-label-sm text-label-sm font-bold flex items-center gap-space-xs hover:bg-surface-container-high transition-colors shadow-sm" type="button" id="shoot-photo-btn"><span class="material-symbols-outlined text-[18px]">photo_camera</span>${trad('Prendre une photo')}</button>
              </div>
              <p class="hint mform-quota" id="photo-manuelle-statut"></p>
            </div>
          </div>
          <input id="f-machine-photo" type="file" accept="image/*" hidden>
          <input id="f-machine-photo-camera" type="file" accept="image/*" capture="environment" hidden>
          <div class="hint" id="photo-status"></div>
        </section>

        <section class="flex flex-col gap-space-md">
          <div class="flex items-center gap-space-sm">
            <div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold font-headline-sm text-headline-sm">03</div>
            <div class="flex items-center gap-space-xs">
              <span class="material-symbols-outlined text-primary text-[20px]">menu_book</span>
              <h3 class="font-headline-sm text-headline-sm font-semibold text-on-surface">${trad('Carnet d\'entretien du constructeur')}</h3>
            </div>
          </div>
          <label class="font-label-md text-label-md text-on-surface-variant font-semibold" for="f-manual">${tR('Carnet d\'entretien (PDF{mode})', { mode: isEdit ? trad(' — laisser vide pour ne pas changer') : trad(', optionnel') })}</label>
          ${isEdit && existing.manual_url ? `
          <div class="flex flex-wrap items-center justify-between gap-space-sm p-space-md rounded-xl bg-surface-container-low">
            <div class="flex items-center gap-space-sm">
              <span class="material-symbols-outlined text-primary text-[24px]">verified</span>
              <span class="font-label-md text-label-md font-bold text-on-surface">${trad('Carnet déjà enregistré')}</span>
            </div>
            <div class="flex items-center gap-space-sm">
              <button class="px-space-md py-2 rounded-lg bg-surface-container text-on-surface font-label-sm text-label-sm font-bold flex items-center gap-space-xs hover:bg-surface-container-high transition-colors shadow-sm" type="button" id="modal-view-manual"><span class="material-symbols-outlined text-[18px]">picture_as_pdf</span>${trad('Voir le carnet actuel (PDF)')}</button>
            </div>
          </div>` : ''}
          <div class="mmod-carnet-row">
            ${dropzoneHtml('f-manual-drop')}
            <input id="f-manual" type="file" accept="application/pdf,image/*" multiple hidden>
            <div class="hint" id="f-manual-statut"></div>
            <button class="px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-bold hover:bg-surface-container transition-colors shadow-sm mmod-btn-camera-repli" type="button" id="btn-camera">${trad('Photographier le carnet')}</button>
          </div>
          <input id="f-camera" type="file" accept="image/*" capture="environment" hidden>
          <div class="pages-carnet" id="pages-carnet"></div>
          <div class="pages-utiles" id="pages-utiles"></div>
          <div class="hint" id="f-analysis">${trad('Le PDF du fabricant reste attaché à la fiche, consultable par n\'importe quel technicien. S\'il est fourni, notre algorithme propose un intervalle et des tâches à partir de son contenu.')}</div>
          <div id="plan-choix-zone"></div>
          <div class="p-space-md rounded-xl bg-tertiary-fixed/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md shadow-sm">
            <div class="flex items-center gap-space-md">
              <div class="w-10 h-10 rounded-lg bg-tertiary-container text-on-tertiary flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-[22px]">contact_support</span></div>
              <div class="flex flex-col">
                <span class="font-label-md text-label-md font-bold text-on-surface">${trad('Vous ne trouvez pas votre carnet ?')}</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">${trad('Pour 29 € (paiement unique), nous configurons votre plan d\'entretien modifiable directement dans l\'application (aucun manuel constructeur fourni). Si les données de la machine sont insuffisantes, nous vous avertissons avant tout paiement, sans rien inventer.')}</span>
              </div>
            </div>
            <button class="px-space-md py-2.5 rounded-lg bg-tertiary-container text-on-tertiary font-label-sm text-label-sm font-bold hover:opacity-95 transition-opacity shadow-sm flex items-center gap-space-xs flex-shrink-0" type="button" id="btn-plan-payant"><span class="material-symbols-outlined text-[18px]">verified_user</span>${trad('Demander l\'établissement de mon plan — 29 €')}</button>
          </div>
        </section>

        <section class="flex flex-col gap-space-md" id="bloc-mode-suivi" data-mode-defaut="${esc(editMode)}" data-interval-defaut="${isEdit ? esc(editInterval) : FALLBACK_INTERVAL_DAYS}">
          <div class="flex items-center gap-space-sm">
            <div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold font-headline-sm text-headline-sm">04</div>
            <div class="flex items-center gap-space-xs">
              <span class="material-symbols-outlined text-primary text-[20px]">more_time</span>
              <h3 class="font-headline-sm text-headline-sm font-semibold text-on-surface">${trad('Mode de suivi & échéances d\'entretien')}</h3>
            </div>
          </div>

          <div class="flex flex-col gap-space-xs">
            <label class="font-label-md text-label-md text-on-surface-variant font-semibold">${trad('Mode de suivi de la maintenance')}</label>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md mform-cards">
              <label class="p-space-md flex items-center gap-space-sm cursor-pointer shadow-sm mform-card ${editMode === 'days' ? 'is-selected' : ''}">
                <input type="radio" name="tm" value="days" ${editMode === 'days' ? 'checked' : ''}>
                <div class="mform-card-ico"><span class="material-symbols-outlined text-[22px]">calendar_month</span></div>
                <div class="flex flex-col mform-card-corps">
                  <span class="font-label-md text-label-md font-bold mform-card-titre">${trad('Calendaire')}</span>
                  <span class="font-body-sm text-body-sm mform-card-texte">${trad('Jours / semaines')}</span>
                </div>
                <span class="material-symbols-outlined text-on-primary text-[20px] mform-check-on">check_circle</span>
                <span class="mform-check-off"></span>
              </label>
              <label class="p-space-md flex items-center gap-space-sm cursor-pointer shadow-sm mform-card ${editMode === 'hours' ? 'is-selected' : ''}">
                <input type="radio" name="tm" value="hours" ${editMode === 'hours' ? 'checked' : ''}>
                <div class="mform-card-ico"><span class="material-symbols-outlined text-[22px]">timer</span></div>
                <div class="flex flex-col mform-card-corps">
                  <span class="font-label-md text-label-md font-bold mform-card-titre">${trad('Compteur horaire')}</span>
                  <span class="font-body-sm text-body-sm mform-card-texte">${trad('Heures')}</span>
                </div>
                <span class="material-symbols-outlined text-on-primary text-[20px] mform-check-on">check_circle</span>
                <span class="mform-check-off"></span>
              </label>
              ${SCHEMA.hasCounter ? `<label class="p-space-md flex items-center gap-space-sm cursor-pointer shadow-sm mform-card ${editMode === trad('km') ? 'is-selected' : ''}">
                <input type="radio" name="tm" value="km" ${editMode === trad('km') ? 'checked' : ''}>
                <div class="mform-card-ico"><span class="material-symbols-outlined text-[22px]">speed</span></div>
                <div class="flex flex-col mform-card-corps">
                  <span class="font-label-md text-label-md font-bold mform-card-titre">${trad('Kilométrage')}</span>
                  <span class="font-body-sm text-body-sm mform-card-texte">${trad('Kilomètres')}</span>
                </div>
                <span class="material-symbols-outlined text-on-primary text-[20px] mform-check-on">check_circle</span>
                <span class="mform-check-off"></span>
              </label>` : ''}
            </div>
          </div>
          <!-- Le compteur ne se relève plus ici : il a son champ SUR LA CARTE DE LA
               MACHINE, à l'endroit du geste quotidien. Deux endroits pour une même
               valeur finiraient par se contredire. -->

          <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div class="flex flex-col gap-space-xs">
              <label class="font-label-md text-label-md text-on-surface-variant font-semibold" for="f-interval" id="f-interval-label">${tR('Échéance {mode}', { mode: editMode === 'days' ? trad('toutes les (jours)') : tR('tous les ({unite})', { unite: COUNTER_UNITS[editUnit].word }) })}</label>
              <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="f-interval" type="number" min="1" value="${isEdit ? esc(editInterval) : FALLBACK_INTERVAL_DAYS}" required>
            </div>
            <div class="flex flex-col gap-space-xs">
              <label class="font-label-md text-label-md text-on-surface-variant font-semibold" for="f-reminder" id="f-reminder-label">${tR('Rappel avant ({unite})', { unite: editMode === 'days' ? trad('jours') : COUNTER_UNITS[editUnit].word })}</label>
              <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="f-reminder" type="number" min="0" value="${isEdit ? esc(editReminder) : FALLBACK_REMINDER_DAYS}" required>
            </div>
          </div>
          ${SCHEMA.hasCounter2 ? `
          <div class="flex items-center gap-space-sm p-space-sm rounded-lg bg-surface-container-low mform-photo-web">
            <input class="w-5 h-5 rounded text-primary focus:ring-primary focus:ring-offset-0 bg-surface-container cursor-pointer" id="f-secondaire-active" type="checkbox" ${editSecondaryUnit ? 'checked' : ''}>
            <label class="font-label-md text-label-md text-on-surface font-semibold cursor-pointer" for="f-secondaire-active">${trad('Ajouter un second suivi (le carnet mélange plusieurs unités, ex. heures ET km)')}</label>
          </div>
          <div class="p-space-md rounded-xl flex flex-col gap-space-md shadow-sm mmod-second-panel" id="secondaire-champs" style="display:${editSecondaryUnit ? 'flex' : 'none'};">
            <div class="flex items-center justify-between mmod-second-panel-head">
              <span class="font-label-md text-label-md font-bold text-on-surface">${trad('Configuration du second paramètre de surveillance')}</span>
              <span class="mmod-pill-actif">${trad('Actif')}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md mform-cards">
              <label class="p-space-sm flex items-center justify-between cursor-pointer shadow-sm mform-card ${editSecondaryUnit === 'hours' ? 'is-selected' : ''}" id="carte-secondaire-hours" style="display:${editMode === 'hours' ? 'none' : 'flex'};">
                <div class="flex items-center gap-space-xs">
                  <input type="radio" name="tm2" value="hours" ${editSecondaryUnit === 'hours' ? 'checked' : ''}>
                  <span class="material-symbols-outlined text-[18px]">timer</span>
                  <span class="font-label-sm text-label-sm font-bold mform-card-titre">${trad('Compteur horaire')}</span>
                </div>
                <span class="material-symbols-outlined text-[18px] mform-check-on">check</span>
              </label>
              <label class="p-space-sm flex items-center justify-between cursor-pointer mform-card ${editSecondaryUnit === 'km' ? 'is-selected' : ''}" id="carte-secondaire-km" style="display:${editMode === 'km' ? 'none' : 'flex'};">
                <div class="flex items-center gap-space-xs">
                  <input type="radio" name="tm2" value="km" ${editSecondaryUnit === 'km' ? 'checked' : ''}>
                  <span class="material-symbols-outlined text-[18px]">speed</span>
                  <span class="font-label-sm text-label-sm font-semibold mform-card-titre">${trad('Kilométrage')}</span>
                </div>
                <span class="material-symbols-outlined text-[18px] mform-check-on">check</span>
              </label>
              <label class="p-space-sm flex items-center justify-between cursor-pointer mform-card ${editSecondaryUnit === 'days' ? 'is-selected' : ''}" id="carte-secondaire-days" style="display:${editMode === 'days' ? 'none' : 'flex'};">
                <div class="flex items-center gap-space-xs">
                  <input type="radio" name="tm2" value="days" ${editSecondaryUnit === 'days' ? 'checked' : ''}>
                  <span class="material-symbols-outlined text-[18px]">calendar_today</span>
                  <span class="font-label-sm text-label-sm font-semibold mform-card-titre">${trad('Calendaire')}</span>
                </div>
                <span class="material-symbols-outlined text-[18px] mform-check-on">check</span>
              </label>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md" id="secondaire-valeur-row" style="display:${editSecondaryUnit === 'days' ? 'none' : 'flex'};">
              <div class="flex flex-col gap-space-xs">
                <label class="font-label-sm text-label-sm text-on-surface-variant font-semibold" for="f-secondaire-valeur">${trad('Relevé actuel')}</label>
                <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="f-secondaire-valeur" type="number" min="0" value="${editSecondaryValue ?? ''}">
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md">
              <div class="flex flex-col gap-space-xs">
                <label class="font-label-sm text-label-sm text-on-surface-variant font-semibold" for="f-secondaire-interval" id="f-secondaire-interval-label">${tR('Échéance tous les ({unite})', { unite: editSecondaryUnit === 'days' ? trad('jours') : (COUNTER_UNITS[editSecondaryUnit || 'hours'] || COUNTER_UNITS.hours).word })}</label>
                <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="f-secondaire-interval" type="number" min="1" value="${editSecondaryUnit === 'days' ? editSecondaryIntervalDays : editSecondaryInterval}">
              </div>
              <div class="flex flex-col gap-space-xs">
                <label class="font-label-sm text-label-sm text-on-surface-variant font-semibold" for="f-secondaire-reminder" id="f-secondaire-reminder-label">${tR('Rappel avant ({unite})', { unite: editSecondaryUnit === 'days' ? trad('jours') : (COUNTER_UNITS[editSecondaryUnit || 'hours'] || COUNTER_UNITS.hours).word })}</label>
                <input class="h-10 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="f-secondaire-reminder" type="number" min="0" value="${editSecondaryUnit === 'days' ? editSecondaryReminderDays : editSecondaryReminder}">
              </div>
            </div>
          </div>` : ''}

          <div class="flex flex-col gap-space-xs">
            <div class="flex items-center justify-between">
              <label class="font-label-md text-label-md text-on-surface-variant font-semibold" for="f-tasks">${trad('Tâches de maintenance')}</label>
            </div>
            <textarea class="w-full p-space-md rounded-xl bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm leading-relaxed" id="f-tasks" rows="3" placeholder="${trad('Ex. Vidange, contrôle lame, graissage')}">${isEdit ? esc(existing.plan?.tasks || '') : ''}</textarea>
          </div>
        </section>

        </div>

        <div class="px-space-xl py-space-md flex flex-col gap-space-sm shadow-[0_-4px_12px_rgba(14,19,51,0.03)]">
          <div class="hint" id="f-error"></div>
          <div class="flex items-center justify-between">
            <button class="px-space-lg py-2.5 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md font-bold hover:bg-surface-container transition-colors" type="button" id="cancel-add">${trad('Annuler')}</button>
            <button class="px-space-xl py-3 rounded-xl bg-inverse-surface text-inverse-on-surface font-label-lg text-label-lg font-bold hover:bg-on-background transition-colors shadow-md flex items-center gap-space-xs" type="submit" id="submit-add"><span class="material-symbols-outlined text-[20px]">save</span>${isEdit ? trad('Enregistrer les modifications') : trad('Enregistrer')}</button>
          </div>
          ${isEdit && peutSupprimerMachine() ? `
          <div class="flex justify-center pt-space-xs">
            <button class="text-error hover:text-on-error-container font-label-sm text-label-sm font-semibold transition-colors flex items-center gap-1 delete-link" type="button" id="delete-machine"><span class="material-symbols-outlined text-[16px]">delete</span><span>${trad('Supprimer cette machine')}</span></button>
          </div>` : ''}
          ${isEdit && !peutSupprimerMachine() ? `<div class="hint" id="machine-suppr-refus">${trad('Seul le gérant peut supprimer une machine : tu peux la modifier, pas l\'effacer.')}</div>` : ''}
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  // MAJUSCULES ET CATÉGORIE : mêmes règles que l'assistant de création — la
  // valeur enregistrée est en majuscules, et la catégorie se choisit dans la
  // liste (avec « Autre… » pour l'ajouter).
  preparerChampsMajuscules(overlay);
  normaliserMajusculesAEnregistrement(overlay);
  brancherCategorie(overlay, categories, isEdit ? (existing.category?.name || '') : '');
  habillerChampDate(overlay.querySelector('#f-service-date'), trad('Date de mise en service'));
  habillerChampDate(overlay.querySelector('#f-date-achat'), trad('Date d\'achat'));
  if (tcoActif()) {
    ['#f-prix-achat', '#f-revente-estimee', '#f-duree-vie'].forEach((sel) => {
      activerSeparateurMilliers(overlay.querySelector(sel));
    });
    brancherDureeVie(overlay, false);
  }

  overlay.querySelector('#cancel-add').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#mform-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  forcerMajuscules(overlay.querySelector('#f-brand'));
  forcerMajuscules(overlay.querySelector('#f-model'));

  // Cartes sélectionnables (type d'unité, mode de suivi) : la mise en
  // évidence est posée en JS plutôt que de dépendre seulement de
  // :has(input:checked) — ce sélecteur existe en CSS de secours, mais son
  // repaint s'est montré peu fiable ici sur un changement déclenché par
  // script plutôt qu'un vrai clic.
  const marquerCarteSelectionnee = (nomGroupe) => {
    overlay.querySelectorAll(`input[name=${nomGroupe}]`).forEach((radio) => {
      radio.closest('.mform-card')?.classList.toggle('is-selected', radio.checked);
    });
  };

  // Le type d'unité (machine / véhicule) est maintenant deux cartes
  // sélectionnables (input[name=kind]), pas un <select> — la maquette le
  // montre ainsi. Même logique qu'avant, juste lue sur le radio coché.
  const radiosKind = overlay.querySelectorAll('input[name=kind]');
  if (radiosKind.length) {
    marquerCarteSelectionnee('kind');
    const ancienType = overlay.querySelector('input[name=kind]:checked')?.value || TYPE_MACHINE;
    radiosKind.forEach((radio) => radio.addEventListener('change', () => {
      marquerCarteSelectionnee('kind');
      const kind = overlay.querySelector('input[name=kind]:checked').value;
      overlay.querySelector('#f-identifiant-label').textContent = IDENTIFIANT_LIBELLE[kind];
      overlay.querySelector('#f-serial').placeholder = IDENTIFIANT_PLACEHOLDER[kind];
      if (SCHEMA.hasCounter) {
        const mode = kind === TYPE_VEHICULE ? trad('km') : 'hours';
        const radioTm = overlay.querySelector(`input[name=tm][value=${mode}]`);
        if (radioTm) { radioTm.checked = true; radioTm.dispatchEvent(new Event('change')); }
      }
      const champIntervalle = overlay.querySelector('#f-interval');
      if (champIntervalle && Number(champIntervalle.value) === INTERVALLE_DEFAUT[ancienType]) {
        champIntervalle.value = INTERVALLE_DEFAUT[kind];
      }
    }));
  }

  marquerCarteSelectionnee('tm');
  overlay.querySelectorAll('input[name=tm]').forEach(r => {
    r.addEventListener('change', () => {
      marquerCarteSelectionnee('tm');
      const mode = overlay.querySelector('input[name=tm]:checked').value;
      const u = COUNTER_UNITS[counterUnitFromMode(mode)];
      const word = mode === 'days' ? trad('jours') : u.word;
      const champHeuresModal = overlay.querySelector('#hours-field');
      if (champHeuresModal) champHeuresModal.style.display = mode === 'days' ? 'none' : 'block';
      overlay.querySelector('#f-interval-label').textContent = tR('Échéance {mode} ({unite})', { mode: mode === 'days' ? trad('toutes les') : trad('tous les'), unite: word });
      overlay.querySelector('#f-reminder-label').textContent = tR('Rappel avant ({unite})', { unite: word });
      const counterLabelEl = overlay.querySelector('#f-current-hours-label');
      if (counterLabelEl) counterLabelEl.textContent = u.field;
      const counterInputEl = overlay.querySelector('#f-current-hours');
      if (counterInputEl) { counterInputEl.step = u.step; counterInputEl.placeholder = u.placeholder; }
      // Même règle qu'à la création : l'intervalle suit l'unité, et le repli de
      // l'autre unité ne peut plus être enregistré par inadvertance.
      const champIntervalle = overlay.querySelector('#f-interval');
      if (champIntervalle && !overlay._intervalTouche) {
        champIntervalle.value = intervallePropose(mode, intervallesIA(overlay));
      }
      // Le second suivi ne peut pas être la MÊME unité que le principal.
      const carteSecH = overlay.querySelector('#carte-secondaire-hours');
      const carteSecK = overlay.querySelector('#carte-secondaire-km');
      const carteSecJ = overlay.querySelector('#carte-secondaire-days');
      if (carteSecH) carteSecH.style.display = mode === 'hours' ? 'none' : 'flex';
      if (carteSecK) carteSecK.style.display = mode === 'km' ? 'none' : 'flex';
      if (carteSecJ) carteSecJ.style.display = mode === 'days' ? 'none' : 'flex';
      const radioDevenuInvalide = overlay.querySelector(`input[name=tm2][value="${mode}"]`);
      if (radioDevenuInvalide && radioDevenuInvalide.checked) {
        radioDevenuInvalide.checked = false;
        marquerCarteSelectionnee('tm2');
        if (typeof majLabelsSecondaire === 'function') majLabelsSecondaire();
      }
    });
  });
  const champIntervalleEdit = overlay.querySelector('#f-interval');
  if (champIntervalleEdit) {
    champIntervalleEdit.addEventListener('input', () => { overlay._intervalTouche = true; });
  }
  // Second suivi, optionnel : repliable, sans rien écrire tant qu'il n'est
  // pas coché (voir SCHEMA.hasCounter2). Une unité calendaire n'a pas de
  // relevé à saisir (chaque tâche porte déjà sa propre date) : la ligne
  // « Relevé actuel » se cache, et les libellés d'intervalle/rappel suivent
  // l'unité choisie (jours, ou l'unité du compteur).
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

  if (isEdit) {
    // ⚠️ MÊME RÈGLE : le bouton n'est rendu que pour un gérant. Sans le `?.`, un
    // mécanicien, un chauffeur — ou un rôle encore inconnu — faisait jeter cette
    // ligne, et l'enregistrement de la fiche ne répondait plus du tout.
    overlay.querySelector('#delete-machine')?.addEventListener('click', async (e) => {
      const ok = confirm(tR('Supprimer définitivement « {nom} » ? Son plan d\'entretien, son historique, ses relevés, son carnet et sa photo seront aussi supprimés. Cette action est irréversible.', { nom: existing.name }));
      if (!ok) return;
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = trad('Suppression…');
      try {
        // ★ LES DONNÉES LIÉES PARTENT AVEC LA MACHINE, ET C'EST FAIT ICI.
        //   Une cascade de base n'est PAS garantie (le schéma d'origine n'en
        //   déclare pas) : sans ces suppressions, le plan, les entretiens et les
        //   relevés restaient en base — invisibles dans l'application, donc
        //   conservés alors qu'on annonce leur suppression. Les plans sont lus
        //   AVANT d'être supprimés : les journaux de rappels s'y rattachent.
        const { data: plansLies, error: plansLusErr } = await sb
          .from('maintenance_plans').select('id').eq('machine_id', existing.id);
        if (plansLusErr) throw plansLusErr;
        const idsPlans = (plansLies || []).map((p) => p.id);
        const { error: interventionsErr } = await sb.from('interventions').delete().eq('machine_id', existing.id);
        if (interventionsErr) throw interventionsErr;
        const { error: plansErr } = await sb.from('maintenance_plans').delete().eq('machine_id', existing.id);
        if (plansErr) throw plansErr;
        for (const idPlan of idsPlans) {
          const { error: journalErr } = await sb.from('notifications_log').delete().eq('plan_id', idPlan);
          if (journalErr) console.warn('Journal de rappels non supprimé :', journalErr.message);
        }

        // Nettoyage des fichiers attachés : le carnet PDF et la photo.
        // Un échec ici ne doit pas empêcher la suppression de la fiche.
        if (existing.manual_url) {
          const { error: manualRmErr } = await sb.storage.from('manuals').remove([existing.manual_url]);
          if (manualRmErr) console.warn('Suppression du carnet impossible :', manualRmErr.message);
        }
        const { error: photoRmErr } = await sb.storage.from('machine-photos').remove([`${companyId}/${existing.id}.jpg`]);
        if (photoRmErr) console.warn('Suppression de la photo impossible :', photoRmErr.message);

        const { error: delErr } = await sb.from('machines').delete().eq('id', existing.id);
        if (delErr) throw delErr;
        synchroniserMachinesStripe();
        overlay.remove();
        boot(trad('Machine supprimée'));
      } catch (err) {
        overlay.querySelector('#f-error').textContent = trad('Erreur à la suppression :') + " " + err.message;
        btn.disabled = false;
        btn.textContent = trad('Supprimer cette machine');
      }
    });
  }

  if (isEdit && existing.manual_url) {
    // ⚠️ CES DEUX BOUTONS NE SONT RENDUS QUE si la machine a déjà un carnet
    // (`${isEdit && existing.manual_url ? … : ''}`). Le `?.` est donc obligatoire :
    // sans lui, ouvrir la fiche d'une machine SANS carnet — le cas le plus
    // courant — jetait ici même, et tout le câblage qui suit était perdu :
    // la photo, le champ du carnet, la caméra, et jusqu'à l'enregistrement.
    overlay.querySelector('#modal-view-manual')?.addEventListener('click', (e) => viewManual(existing.manual_url, e.target));
    // Pas de bouton « Analyser ce carnet » ici : chaque clic lançait une analyse payante (appel d'API). Pour refaire l'analyse,
    // le client redépose le carnet dans la zone prévue, ce qui est un geste volontaire.
  }

  brancherPhotoManuelle(overlay, { apercu: '#photo-preview', machineId: existing.id });
  // PHOTOS DU CARNET : le client a le carnet sous la main, pas toujours le PDF.
  const apresCarnetPhotos = (resultat) => {
    overlay._aiItems = resultat.items;
    overlay._aiNotes = resultat.notes;
    const champTaches = overlay.querySelector('#f-tasks');
    if (champTaches && resultat.taches) champTaches.value = resultat.taches;
    // L'analyse vient de finir : on demande ce que le client veut faire du
    // plan trouvé avant de laisser le bloc 04 « Mode de suivi » visible.
    presenterChoixPlanEditForm(overlay, resultat, existing);
  };
  const contexteCarnetPhotos = () => ({
    trackingMode: overlay.querySelector('input[name=tm]:checked')?.value || 'days',
    currentHours: parseFloat(overlay.querySelector('#f-current-hours')?.value) || machineCounter(existing) || null,
    serviceDate: overlay.querySelector('#f-service-date')?.value || existing.service_date || null,
  });
  // Extrait du gestionnaire de #f-manual pour être partagé avec la zone de
  // glisser-déposer (dropzoneHtml, la même que le Tableau de bord) : les deux
  // chemins déposent le même fichier, donc la même suite.
  const traiterFichiersCarnet = (choix) => {
    const images = choix.filter(f => /^image\//.test(f.type));
    if (images.length) {
      brancherCarnetPhotos(overlay, images, contexteCarnetPhotos, apresCarnetPhotos);
      return;
    }
    const file = choix[0];
    if (file) {
      const contexteModal = () => ({
        // `aiModeFrom` traduit le mode AFFICHÉ ('km') en mode d'ANALYSE ('hours') :
        // le repérage des pages envoie le même mode que l'appel direct, sans quoi
        // les deux chemins ne diraient pas la même chose au modèle.
        trackingMode: aiModeFrom(overlay.querySelector('input[name=tm]:checked').value),
        currentHours: parseFloat(overlay.querySelector('#f-current-hours')?.value) || machineCounter(existing) || null,
        serviceDate: overlay.querySelector('#f-service-date')?.value || existing.service_date || null,
      });
      // MÊME ARBITRAGE QUE DANS L'ASSISTANT : repérage local, confirmation du
      // client, puis envoi. `analyserTout` garde le comportement d'avant.
      brancherCarnetPdf(overlay, file, contexteModal(), apresCarnetPhotos,
        async () => {
          const resultatAnalyse = await analyzeManualAndFill(overlay, file, contexteModal().trackingMode, contexteModal());
          if (resultatAnalyse) presenterChoixPlanEditForm(overlay, resultatAnalyse, existing);
        });
      renderPdfFirstPageAsBlob(file).then(blob => {
        // La photo de la machine (déjà enregistrée) et celle choisie par le client gagnent sur la 1ère page du carnet.
        const photoDuClient = overlay._pendingPhotoBlob && overlay._pendingPhotoBlob !== overlay._carnetPhotoBlob;
        if (existing.image_url || photoDuClient) return;
        overlay._pendingPhotoBlob = blob;
        overlay._carnetPhotoBlob = blob;
        const previewUrl = URL.createObjectURL(blob);
        overlay.querySelector('#photo-preview').innerHTML = `<img class="machine-photo" src="${previewUrl}" alt="${esc(existing.name)}">`;
        overlay.querySelector('#photo-status').textContent = trad('Photo extraite de la 1ère page du carnet — elle sera enregistrée avec la fiche.');
      }).catch(err => {
        console.error('Extraction photo (1ère page du PDF) échouée :', err);
        overlay.querySelector('#photo-status').textContent = tR('Extraction de la photo impossible ({erreur}).', { erreur: (err?.message || err) });
      });
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
  // dropzoneHtml() est réutilisée pour le VISUEL (même bloc que le Tableau
  // de bord), mais pas pour son clic : attachDropzone() ouvre son propre
  // sélecteur, limité à un seul PDF — cette fiche accepte aussi plusieurs
  // photos de pages à la fois (#f-manual porte déjà `multiple` et
  // `accept="application/pdf,image/*"`). Le clic ouvre donc CE champ réel ;
  // seul le glisser-déposer est câblé à la main, ici, pour accepter
  // plusieurs fichiers déposés d'un coup (attachDropzone n'en garde qu'un).
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
    if (images.length) brancherCarnetPhotos(overlay, images, contexteCarnetPhotos, apresCarnetPhotos);
  });
  // L'offre « nous établissons votre plan » : e-mail pré-rempli, rien d'automatique.
  brancherOffrePlan(overlay, () => {
    // ICI LES CHAMPS SONT DANS LA PAGE (un seul écran, pas d'étapes) : on lit ce que
    // l'utilisateur voit et vient peut-être de corriger, et à défaut la machine
    // enregistrée. Une valeur vide reste vide : l'e-mail portera « — », jamais une
    // valeur inventée.
    const valeur = (selecteur, secours) => {
      const champ = overlay.querySelector(selecteur);
      const texte = champ ? String(champ.value || '').trim() : '';
      return texte || secours || '';
    };
    const categorie = existing && existing.category
      ? (typeof existing.category === 'string' ? existing.category : existing.category.name)
      : '';
    return {
      name: valeur('#f-name', existing && existing.name),
      brand_model: valeur('#f-brand', existing && existing.brand_model),
      annee: valeur('#f-year', existing ? (existing.annee || existing.model_year) : ''),
      category: valeur('#f-category', categorie),
      serial_number: valeur('#f-serial', existing && existing.serial_number),
    };
  });
  overlay.querySelector('#add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = overlay.querySelector('#f-error');
    const submitBtn = overlay.querySelector('#submit-add');
    // « Autre… » sans nom écrit : on le demande au lieu de créer une catégorie « AUTRE » ou vide.
    {
      const champAutre = overlay.querySelector('#f-category-autre');
      const choix = overlay.querySelector('#f-category').value.trim();
      if (!choix || (champAutre && !champAutre.hidden && !champAutre.value.trim())) {
        if (errorEl) errorEl.textContent = trad('Indique le nom de la catégorie.');
        if (champAutre && !champAutre.hidden && typeof champAutre.focus === 'function') champAutre.focus();
        return;
      }
    }
    submitBtn.disabled = true;
    submitBtn.textContent = trad('Enregistrement…');

    const name = overlay.querySelector('#f-name').value.trim();
    const categoryName = overlay.querySelector('#f-category').value.trim();
    const brand = overlay.querySelector('#f-brand').value.trim();
    const model = overlay.querySelector('#f-model').value.trim();
    const serial = overlay.querySelector('#f-serial').value.trim();
    const annee = overlay.querySelector('#f-year') ? overlay.querySelector('#f-year').value.trim() : '';
    const kind = overlay.querySelector('input[name=kind]:checked') ? overlay.querySelector('input[name=kind]:checked').value : machineKind(existing);
    const serviceDate = overlay.querySelector('#f-service-date').value;
    const trackingMode = overlay.querySelector('input[name=tm]:checked').value;
    const isCounterMode = trackingMode !== 'days';
    const counterUnit = counterUnitFromMode(trackingMode);
    // LE COMPTEUR NE SE SAISIT PLUS DANS CETTE FICHE : il a son champ sur la carte
    // de la machine. On CONSERVE donc la valeur connue — sinon un simple
    // « Modifier » l'effacerait (machineCounterPatch écrit null quand la valeur
    // est nulle), et le client perdrait son relevé sans le moindre message.
    const currentHours = isCounterMode ? (machineCounter(existing) ?? null) : null;
    // Second suivi, optionnel (voir SCHEMA.hasCounter2). Même règle que le
    // compteur principal : la VALEUR ne se ressaisit pas une fois le suivi
    // déjà actif (elle a son champ sur la carte) — seule l'ACTIVATION
    // initiale, ou un changement d'unité, capture une valeur de départ ici.
    const secondaireActiveMaintenant = SCHEMA.hasCounter2 && !!overlay.querySelector('#f-secondaire-active')?.checked;
    const secondaryUnit = secondaireActiveMaintenant
      ? (overlay.querySelector('input[name=tm2]:checked')?.value || null)
      : null;
    // Calendaire n'a pas de relevé (chaque tâche porte déjà sa propre date) :
    // seuls interval_days_2/reminder_days_before_2 sont renseignés.
    const secondaireCalendrier = secondaryUnit === 'days';
    const secondaryValue = (secondaryUnit && !secondaireCalendrier)
      ? (editSecondaryUnit === secondaryUnit
          ? (machineCounter2(existing) ?? 0)
          : (parseFloat(overlay.querySelector('#f-secondaire-valeur')?.value) || 0))
      : null;
    const secondaryIntervalCounter = (secondaryUnit && !secondaireCalendrier)
      ? (parseInt(overlay.querySelector('#f-secondaire-interval')?.value, 10) || FALLBACK_INTERVAL_HOURS)
      : null;
    const secondaryReminderCounter = (secondaryUnit && !secondaireCalendrier)
      ? (parseInt(overlay.querySelector('#f-secondaire-reminder')?.value, 10) || FALLBACK_REMINDER_HOURS)
      : null;
    const secondaryIntervalDays = secondaireCalendrier
      ? (parseInt(overlay.querySelector('#f-secondaire-interval')?.value, 10) || FALLBACK_INTERVAL_DAYS)
      : null;
    const secondaryReminderDays = secondaireCalendrier
      ? (parseInt(overlay.querySelector('#f-secondaire-reminder')?.value, 10) || FALLBACK_REMINDER_DAYS)
      : null;
    const intervalValue = parseInt(overlay.querySelector('#f-interval').value, 10);
    const reminderValue = parseInt(overlay.querySelector('#f-reminder').value, 10);
    // Les deux unités sont toujours renseignées : une machine suivie au compteur
    // garde un intervalle calendaire de repli, et inversement.
    const intervalDays = isCounterMode
      ? (overlay._aiIntervalDays || existing?.plan?.interval_days || FALLBACK_INTERVAL_DAYS)
      : intervalValue;
    const reminderDays = isCounterMode
      ? (existing?.plan?.reminder_days_before ?? FALLBACK_REMINDER_DAYS)
      : reminderValue;
    const intervalCounter = isCounterMode
      ? intervalValue
      : (overlay._aiIntervalHours || planIntervalCounter(existing?.plan) || FALLBACK_INTERVAL_HOURS);
    const reminderCounter = isCounterMode
      ? reminderValue
      : (existing?.plan ? planReminderCounter(existing.plan) : FALLBACK_REMINDER_HOURS);
    const tasks = overlay.querySelector('#f-tasks').value.trim();

    try {
      let categoryId;
      // La catégorie est retenue dès qu'elle est utilisée, en base comme sur
      // l'appareil : elle sera proposée la prochaine fois, même hors connexion.
      retenirCategorie(categoryName);
      const existingCat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const { data: newCat, error: catErr } = await sb
          .from('machine_categories')
          .insert({ company_id: companyId, name: categoryName, default_interval_days: intervalDays, default_tasks: tasks })
          .select('id, name')
          .single();
        if (catErr) throw catErr;
        categoryId = newCat.id;
        categories.push(newCat);
      }

      // openMachineModal n'est appelée que pour une machine existante :
      // la création passe par openAddWizard.
      let resolvedImageUrl = null;
      let photoMiseDeCote = false;
      let photoRefusee = '';
      if (overlay._pendingPhotoBlob) {
        try {
          resolvedImageUrl = await uploadMachinePhoto(companyId, existing.id, overlay._pendingPhotoBlob);
        } catch (e) {
          // ★ HORS CONNEXION, LA PHOTO N'EST PAS PERDUE. Le `catch` vide qui était
          //   ici avalait l'échec : la photo disparaissait sans un mot. Elle est
          //   maintenant gardée sur l'appareil (même file d'attente que le relevé
          //   de compteur) et part au retour du réseau.
          if (estErreurReseau(e)) {
            photoMiseDeCote = await retenirPhotoEnAttente(existing.id, overlay._pendingPhotoBlob);
          } else {
            photoRefusee = (e && e.message) || String(e);
          }
        }
      } else if (overlay._newImageUrl) {
        resolvedImageUrl = overlay._newImageUrl;
      }
      const updatePayload = {
        category_id: categoryId,
        name,
        ...identifiantPatch(kind, serial),
        ...kindPatch(kind),
        ...yearPatch(annee),
        service_date: serviceDate,
      };
      Object.assign(updatePayload, brandModelPatch(brand, model));
      Object.assign(updatePayload, machineCounterPatch(currentHours, { counter_unit: counterUnit }));
      if (SCHEMA.hasCounter2) {
        Object.assign(updatePayload, secondaryUnit
          ? machineCounter2Patch(secondaryValue, secondaryUnit)
          : { counter_value_2: null, counter_unit_2: null });
      }
      if (tcoActif()) {
        const dateAchat = overlay.querySelector('#f-date-achat')?.value || '';
        updatePayload.purchase_price = nombreDepuisTexte(overlay.querySelector('#f-prix-achat')?.value);
        updatePayload.purchase_date = dateAchat || null;
        updatePayload.estimated_resale_value = nombreDepuisTexte(overlay.querySelector('#f-revente-estimee')?.value);
        updatePayload.expected_lifespan_counter = nombreDepuisTexte(overlay.querySelector('#f-duree-vie')?.value);
        updatePayload.amortization_years = nombreDepuisTexte(overlay.querySelector('#f-amortissement')?.value);
      }
      if (resolvedImageUrl) updatePayload.image_url = resolvedImageUrl;
      const { error: updErr } = await sb
        .from('machines')
        .update(updatePayload)
        .eq('id', existing.id);
      if (updErr) throw updErr;
      const machineId = existing.id;

      const fileInput = overlay.querySelector('#f-manual');
      // Le champ accepte AUSSI des photos du carnet : seuls les PDF sont archives
      // comme manuel de la fiche (une photo n'est pas un document consultable).
      const file = Array.from(fileInput.files || []).find(f => f.type === 'application/pdf') || null;
      // MÊME ARBITRAGE QUE DANS L'ASSISTANT : au-delà de 8 Mo, le manuel est
      // analysé (envoi brut, analyse par référence, puis suppression) mais PAS
      // archivé — et l'application le dit au client.
      if (file && !manuelSansArchivage(file)) {
        // Le carnet précédent est remplacé, puis supprimé : la fiche pointe donc
        // toujours vers le document réellement déposé.
        await deposerManuel(companyId, machineId, file, existing.manual_url || null);
      }

      // Le plan peut ne pas exister encore pour cette machine : on le crée alors,
      // sinon les réglages saisis seraient perdus sans aucun message.
      if (existing.plan?.id) {
        const planUpdate = {
          tracking_mode: trackingMode,
          tasks: tasks || null,
          interval_days: intervalDays,
          reminder_days_before: reminderDays,
        };
        Object.assign(planUpdate, planCounterPatch(intervalCounter, reminderCounter));
        if (overlay._aiItems) { planUpdate.items = overlay._aiItems; planUpdate.notes = notesUtiles(overlay._aiNotes, machineCounter(existing)); }
        // Second suivi, optionnel : sa propre échéance de reprise, comme le
        // principal — voir machineVue2 et duePlanSecondaire plus bas. Change
        // de dimension (compteur <-> calendaire) : l'ancienne est nettoyée,
        // pas seulement remplacée, sinon des colonnes _2 périmées restent.
        const secondaireCalendrierActif = secondaryUnit === 'days';
        if (SCHEMA.hasCounter2) {
          Object.assign(planUpdate,
            secondaireCalendrierActif ? planJours2Patch(secondaryIntervalDays, secondaryReminderDays) : planJours2Patch(null, null),
            (secondaryUnit && !secondaireCalendrierActif) ? planCounter2Patch(secondaryIntervalCounter, secondaryReminderCounter) : planCounter2Patch(null, null));
        }
        const machineVue2 = { ...existing, counter_unit_2: secondaryUnit, counter_value_2: secondaryValue };
        const secondaireInchange = secondaryUnit && secondaryUnit === editSecondaryUnit;

        const aiJustRefreshed = !!(overlay._aiItems || overlay._aiIntervalHours || overlay._aiIntervalDays);
        const modeChanged = existing.plan.tracking_mode !== trackingMode;
        // A-t-on déjà un VRAI entretien enregistré pour cette machine ? C'est la
        // seule source fiable pour savoir si l'échéance a été avancée par un
        // geste réel (journalAvanceEcheance) : comparer l'échéance à la formule
        // « service_date + intervalle » pour le deviner s'est révélé fragile dès
        // qu'un plan porte déjà une dérive antérieure (l'échéance ne correspond
        // plus à la formule alors qu'aucun entretien n'a pourtant eu lieu) —
        // signalé le 23/09 sur un plan édité plusieurs fois de suite.
        const { data: interventionExistante } = await sb
          .from('interventions').select('id').eq('machine_id', existing.id).limit(1);
        const aDejaUnEntretienReel = !!(interventionExistante && interventionExistante.length);

        // Recalcul de l'échéance. On repart d'aujourd'hui si le mode de suivi
        // change (ou si l'analyse vient de fournir de nouvelles valeurs) ; sinon on
        // décale l'échéance du delta d'intervalle. Sans ça, modifier l'intervalle
        // ou la date de mise en service n'avait aucun effet sur la date affichée.
        // Les tâches qui HÉRITENT l'échéance du plan (même due_at/due_counter)
        // doivent suivre le même décalage que lui : preparerTaches() ne touche
        // JAMAIS un due_at/due_counter déjà posé (voir sa règle plus bas), donc
        // sans ce pré-décalage la tâche gardait sa date périmée, et
        // echeancePlanDepuisTaches() écrasait ensuite next_due_at avec cette
        // valeur périmée — c'est ce qui rendait tout décalage du plan (delta
        // d'intervalle COMME delta de date de mise en service) invisible à
        // l'écran dès qu'un plan avait des tâches détaillées (signalé le 23/09).
        let itemsSource = existing.plan.items;
        if (modeChanged || aiJustRefreshed) {
          if (isCounterMode) {
            Object.assign(planUpdate, planNextDueCounterPatch((currentHours || 0) + intervalCounter));
          } else {
            planUpdate.next_due_at = addDaysIso(serviceDate, intervalDays);
          }
        } else if (isCounterMode) {
          const oldNext = planNextDueCounter(existing.plan);
          const oldInterval = planIntervalCounter(existing.plan);
          if (oldNext != null && oldInterval != null) {
            const decalage = intervalCounter - oldInterval;
            Object.assign(planUpdate, planNextDueCounterPatch(oldNext + decalage));
            if (decalage) {
              itemsSource = normalizeItems(itemsSource).map(it =>
                Number(it.due_counter) === oldNext ? { ...it, due_counter: Number(it.due_counter) + decalage } : it);
            }
          } else if (currentHours != null) {
            Object.assign(planUpdate, planNextDueCounterPatch(currentHours + intervalCounter));
          }
        } else if (existing.plan.next_due_at && existing.plan.interval_days != null) {
          // Aucun entretien réel enregistré : l'échéance se RECALCULE
          // intégralement depuis la nouvelle date de mise en service —
          // déterministe, sans dérive possible quel que soit l'historique des
          // modifications précédentes (voir aDejaUnEntretienReel ci-dessus).
          // Un entretien réel existe : l'échéance est ancrée sur sa date, pas
          // sur service_date — on préserve cette avance en la décalant
          // proportionnellement plutôt qu'en l'effaçant.
          planUpdate.next_due_at = aDejaUnEntretienReel
            ? addDaysIso(existing.plan.next_due_at, (intervalDays - existing.plan.interval_days) + joursEntreIso(existing.service_date, serviceDate))
            : addDaysIso(serviceDate, intervalDays);
          if (planUpdate.next_due_at !== existing.plan.next_due_at) {
            itemsSource = normalizeItems(itemsSource).map(it =>
              it.due_at === existing.plan.next_due_at ? { ...it, due_at: planUpdate.next_due_at } : it);
          }
        } else {
          planUpdate.next_due_at = addDaysIso(serviceDate, intervalDays);
        }

        // Une échéance par tâche : même passe de classement pour la modification
        // d'un plan (les éléments qui ont déjà une échéance la gardent).
        const duePlanMaj = isCounterMode
          ? planNextDueCounter({ ...existing.plan, ...planUpdate })
          : (planUpdate.next_due_at || existing.plan.next_due_at);
        // Le SECOND suivi : reprise sur SON échéance actuelle s'il ne change
        // pas, ou toute nouvelle échéance (valeur + intervalle, ou date de
        // mise en service) s'il vient d'être activé ou changé d'unité. Pour
        // un suivi CALENDAIRE déjà actif, MÊME recalcul que le principal
        // quand la date de mise en service change (aDejaUnEntretienReel,
        // décalage des tâches qui héritaient l'ancienne échéance) — sans ça,
        // changer la date de mise en circulation n'avait aucun effet sur ce
        // second suivi (signalé le 23/09, après l'avoir déjà corrigé pour le
        // suivi principal).
        let duePlanSecondaire = null;
        if (secondaryUnit && secondaireCalendrierActif) {
          if (secondaireInchange && existing.plan.next_due_at_2 && existing.plan.interval_days_2 != null) {
            duePlanSecondaire = aDejaUnEntretienReel
              ? addDaysIso(existing.plan.next_due_at_2, (secondaryIntervalDays - existing.plan.interval_days_2) + joursEntreIso(existing.service_date, serviceDate))
              : addDaysIso(serviceDate, secondaryIntervalDays);
            if (duePlanSecondaire !== existing.plan.next_due_at_2) {
              itemsSource = normalizeItems(itemsSource).map(it =>
                it.due_at === existing.plan.next_due_at_2 ? { ...it, due_at: duePlanSecondaire } : it);
            }
          } else {
            duePlanSecondaire = addDaysIso(serviceDate, secondaryIntervalDays);
          }
        } else if (secondaryUnit) {
          duePlanSecondaire = secondaireInchange ? planNextDueCounter2(existing.plan) : (secondaryValue || 0) + secondaryIntervalCounter;
        }
        const itemsMaj = preparerTaches(overlay._aiItems || itemsSource,
          { ...existing.plan, ...planUpdate }, machineVue2, duePlanMaj, counterUnit, duePlanSecondaire);
        if (itemsMaj) {
          planUpdate.items = itemsMaj;
          // Même règle : l'échéance du plan suit le minimum de ses tâches
          // comparables, et disparaît quand plus aucune ne la porte.
          Object.assign(planUpdate, echeancePlanPatch(
            echeancePlanDepuisTaches(itemsMaj, { ...existing.plan, ...planUpdate }),
            { ...existing.plan, ...planUpdate }));
          // L'INTERVALLE AFFICHÉ (jauge, fiche) doit être celui de la tâche qui
          // gouverne réellement cette échéance, pas la valeur saisie à part
          // dans le formulaire — demandé le 23/09 après avoir constaté qu'un
          // plan à 90 j pouvait porter une tâche « tous les ans » sans que les
          // deux ne se rejoignent jamais (et, de la même façon, un compteur à
          // 100 km au lieu des 20 000 km réels de la tâche qui gouverne).
          {
            const intervalleReel = intervalleDepuisTacheGouvernante(
              tacheGouvernante(itemsMaj, { ...existing.plan, ...planUpdate }), isCounterMode);
            if (intervalleReel != null) {
              if (isCounterMode) Object.assign(planUpdate, SCHEMA.hasCounter ? { interval_counter: intervalleReel } : { interval_hours: intervalleReel });
              else planUpdate.interval_days = intervalleReel;
            }
          }
          if (secondaryUnit) {
            // Filet de sécurité : si AUCUNE tâche n'est encore rattachée à
            // l'unité du second suivi (carnet uniquement en heures, second
            // suivi calendaire ajouté à la main, par exemple), echeancePlan
            // DepuisTachesSecondaire ne trouve rien et renvoie null — sans ce
            // repli, le second suivi restait indéfiniment « Plan à définir »
            // malgré une cadence bien réglée (Cadence/Mode de suivi
            // l'affichaient déjà, mais aucune échéance concrète n'existait
            // jamais). `duePlanSecondaire`, calculé juste au-dessus, est
            // cette même valeur de repli déjà utilisée pour préparer les
            // tâches (preparerTaches) — pas une improvisation.
            Object.assign(planUpdate, echeancePlanPatch2(echeancePlanDepuisTachesSecondaire(itemsMaj, machineVue2) ?? duePlanSecondaire, machineVue2));
            const intervalleReelSec = intervalleDepuisTacheGouvernante(
              tacheGouvernanteSecondaire(itemsMaj, machineVue2), !secondaireCalendrierActif);
            if (intervalleReelSec != null) {
              Object.assign(planUpdate, secondaireCalendrierActif ? { interval_days_2: intervalleReelSec } : (SCHEMA.hasCounter2 ? { interval_counter_2: intervalleReelSec } : {}));
            }
          }
        }

        const { error: planErr } = await sb
          .from('maintenance_plans')
          .update(planUpdate)
          .eq('id', existing.plan.id);
        if (planErr) throw planErr;
      } else {
        const planPayload = {
          machine_id: machineId,
          tracking_mode: trackingMode,
          tasks: tasks || null,
          items: overlay._aiItems || null,
          notes: overlay._aiNotes || null,
          interval_days: intervalDays,
          reminder_days_before: reminderDays,
        };
        Object.assign(planPayload, planCounterPatch(intervalCounter, reminderCounter));
        const secondaireCalendrierNouveau = secondaryUnit === 'days';
        if (SCHEMA.hasCounter2 && secondaryUnit) {
          Object.assign(planPayload, secondaireCalendrierNouveau
            ? planJours2Patch(secondaryIntervalDays, secondaryReminderDays)
            : planCounter2Patch(secondaryIntervalCounter, secondaryReminderCounter));
        }
        const machineVue2Nouveau = { counter_unit_2: secondaryUnit, counter_value_2: secondaryValue };
        const duePlanNouveau = isCounterMode
          ? (currentHours || 0) + intervalCounter
          : addDaysIso(serviceDate, intervalDays);
        const duePlanSecondaireNouveau = !secondaryUnit ? null
          : secondaireCalendrierNouveau ? addDaysIso(serviceDate, secondaryIntervalDays)
          : (secondaryValue || 0) + secondaryIntervalCounter;
        if (isCounterMode) {
          Object.assign(planPayload, planNextDueCounterPatch(duePlanNouveau));
        } else {
          planPayload.next_due_at = duePlanNouveau;
        }
        // Une échéance par tâche : la passe CLASSE chaque fréquence et ne donne
        // l'échéance du plan qu'aux tâches qui ont un vrai rythme dans son unité
        // (ou dans celle du second suivi, s'il est actif).
        planPayload.items = preparerTaches(overlay._aiItems, planPayload,
          { counter_unit: counterUnit, counter_value: currentHours, ...machineVue2Nouveau },
          duePlanNouveau, counterUnit, duePlanSecondaireNouveau);
        // L'échéance du plan suit le minimum de ses tâches comparables — et
        // disparaît si aucune ne la porte (aucune tâche périodique dans l'unité).
        Object.assign(planPayload, echeancePlanPatch(echeancePlanDepuisTaches(planPayload.items, planPayload), planPayload));
        // Même règle que sur une modification : l'intervalle affiché suit la
        // tâche qui gouverne réellement l'échéance, pas la saisie à part.
        {
          const intervalleReel = intervalleDepuisTacheGouvernante(tacheGouvernante(planPayload.items, planPayload), isCounterMode);
          if (intervalleReel != null) {
            if (isCounterMode) Object.assign(planPayload, SCHEMA.hasCounter ? { interval_counter: intervalleReel } : { interval_hours: intervalleReel });
            else planPayload.interval_days = intervalleReel;
          }
        }
        if (secondaryUnit) {
          // Même filet de sécurité que sur la modification (voir son
          // commentaire) : sans lui, un second suivi ajouté sur une machine
          // dont aucune tâche n'est encore dans son unité (carnet 100%
          // heures, second suivi calendaire ajouté à la main) n'avait
          // JAMAIS d'échéance concrète, malgré une cadence bien réglée.
          Object.assign(planPayload, echeancePlanPatch2(echeancePlanDepuisTachesSecondaire(planPayload.items, machineVue2Nouveau) ?? duePlanSecondaireNouveau, machineVue2Nouveau));
          const intervalleReelSec = intervalleDepuisTacheGouvernante(
            tacheGouvernanteSecondaire(planPayload.items, machineVue2Nouveau), !secondaireCalendrierNouveau);
          if (intervalleReelSec != null) {
            Object.assign(planPayload, secondaireCalendrierNouveau ? { interval_days_2: intervalleReelSec } : (SCHEMA.hasCounter2 ? { interval_counter_2: intervalleReelSec } : {}));
          }
        }
        const { error: planErr } = await sb
          .from('maintenance_plans')
          .insert(planPayload);
        if (planErr) throw planErr;
      }

      if (photoRefusee) {
        // Un refus définitif (droits, format) se DIT, au lieu de laisser croire
        // que la photo a été enregistrée.
        console.warn('Photo refusée :', photoRefusee);
      }
      overlay.remove();
      boot(photoMiseDeCote
        ? trad('Modifications enregistrées — la photo partira au retour du réseau')
        : (photoRefusee
          ? tR('Modifications enregistrées — la photo n\'a pas pu être envoyée ({erreur})', { erreur: photoRefusee })
          : (isEdit ? trad('Modifications enregistrées') : trad('Machine ajoutée'))));
    } catch (err) {
      errorEl.textContent = trad('Erreur :') + " " + err.message;
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? trad('Enregistrer les modifications') : trad('Enregistrer');
    }
  });
}

// Affiche les dernières données connues, avec le bandeau qui l'annonce.
// Le schéma est restauré lui aussi : sans cela, l'affichage retomberait sur les
// anciennes colonnes et le kilométrage, par exemple, disparaîtrait.
function afficherDepuisCache(cache) {
  if (cache.schema) Object.assign(SCHEMA, cache.schema);
  UI.companyId = cache.companyId;
  UI.companyName = cache.companyName;
  UI.companyPlan = cache.companyPlan;
  UI.company = cache.company || {};
  UI.contactName = cache.contactName || '';
  UI.email = cache.email || '';
  UI.categories = cache.categories || [];
  UI.components = cache.components || [];
  UI.partsCatalog = cache.partsCatalog || [];
  UI.referencesTypes = cache.referencesTypes || [];
  UI.warehouses = cache.warehouses || [];
  UI.stockItems = cache.stockItems || [];
  UI.stockCounts = calculerStockCounts(UI.stockItems, UI.partsCatalog);
  UI.maintenanceKits = cache.maintenanceKits || [];
  UI.maintenanceKitLines = cache.maintenanceKitLines || [];
  UI.machines = cache.machines || [];
  UI.scheduledMaintenances = cache.scheduledMaintenances || [];
  UI.reminders = loadReminders();
  UI.horsLigne = { depuis: cache.savedAt };
  renderApp();
}

// ── Mode support (« Se connecter en tant que » depuis admin.html) ───────
// Échange le jeton à usage unique reçu dans l'URL contre une VRAIE session
// (jamais un mode « lecture seule » simulé) — voir impersonate-tenant/
// index.ts pour la génération de ce jeton côté serveur, et
// keeva-redesign-project.md pour le contexte. Nettoie l'URL immédiatement,
// jeton ou pas : il ne doit jamais rester dans l'historique du navigateur.
async function activerModeSupport() {
  const token = __paramsSupport.get('support_token');
  history.replaceState(null, '', window.location.pathname);
  if (!token) return;
  // `admin.auth.admin.generateLink` (impersonate-tenant/index.ts) rend un
  // « hashed_token » (jeton long) — il se vérifie avec `token_hash`, PAS avec
  // `token`+`email` (ce dernier couple est pour un code à 6 chiffres reçu par
  // e-mail, un mécanisme différent). Confondre les deux rend le jeton
  // « invalide » même quand il est parfaitement correct.
  const { error } = await sb.auth.verifyOtp({ token_hash: token, type: 'magiclink' });
  if (error) {
    alert("Le lien d'accès support a expiré ou est invalide. Redemande un accès depuis la console superviseur.");
    return;
  }
  sessionStorage.setItem('mode_support', '1');
}

// Bandeau permanent, posé une seule fois après le premier rendu réussi —
// jamais discret : quiconque utilise l'appli en mode support doit toujours
// voir qu'il agit pour le compte d'un client, et pouvoir en sortir en un clic.
function afficherBandeauSupportSiActif() {
  if (sessionStorage.getItem('mode_support') !== '1' || document.getElementById('bandeau-mode-support')) return;
  const bandeau = document.createElement('div');
  bandeau.id = 'bandeau-mode-support';
  bandeau.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ba1a1a;color:#fff;padding:9px 14px;font:600 13px/1.3 "Hanken Grotesk",sans-serif;display:flex;align-items:center;justify-content:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.25);';
  bandeau.innerHTML = `<span>${trad('Mode support')} — ${esc(UI.companyName || '')}</span><button type="button" id="quitter-mode-support" style="background:#fff;color:#ba1a1a;border:none;border-radius:4px;padding:5px 12px;font-weight:700;cursor:pointer;font:inherit;">${trad('Quitter')}</button>`;
  document.body.prepend(bandeau);
  document.body.style.paddingTop = bandeau.offsetHeight + 'px';
  document.getElementById('quitter-mode-support').addEventListener('click', async () => {
    sessionStorage.removeItem('mode_support');
    await sb.auth.signOut();
    window.close();
    setTimeout(() => { location.href = 'about:blank'; }, 200);
  });
}

async function boot(toastMessage) {
  // VERROU : avant toute lecture et tout rendu. Ni le parc, ni la copie hors
  // connexion ne doivent apparaître avant une vérification réussie.
  if (!verrouLeve && verrouNecessaire()) {
    await verrouiller();
    return;
  }
  verrouEcouterArrierePlan();
  ecouterBoutonRetour();

  // La copie locale est lue AVANT tout appel réseau : si le réseau manque, on
  // veut pouvoir l'afficher sans attendre l'expiration des délais.
  const cache = lireCache();
  UI.horsLigne = null;

  let session = null;
  try {
    ({ data: { session } } = await sb.auth.getSession());
  } catch (err) {
    session = null;
  }
  if (!session) {
    // ⚠️ JAMAIS de données métier sans session.
    // Les afficher ici laissait lire le parc — noms de machines, plans,
    // coordonnées — sur un appareil partagé, perdu ou revendu, sans le moindre
    // mot de passe : c'est le défaut de confidentialité relevé par l'audit.
    // La copie n'est donc proposée que derrière un geste EXPLICITE, depuis
    // l'écran de connexion, et elle expire au bout de quelques jours.
    renderLogin(null, cache ? { copieDu: cache.savedAt } : null);
    return;
  }

  app.innerHTML = `<div class="loading">${trad('Chargement des machines…')}</div>`;

  // Sondes de schéma : colonnes/tables optionnelles, présentes seulement après leur migration.
  // sonderColonne() reprend une fois sur une erreur RÉSEAU (pas sur une vraie absence de colonne) — voir sa note,
  // trouvée en testant sur un vrai téléphone en 4G.
  // ⚠️ Elles partent TOUTES ENSEMBLE (Promise.all) : lancées l'une après l'autre, ces 13 requêtes minuscules
  //   s'additionnaient (≈ 0,5 s chacune sur un téléphone) et le démarrage dépassait 7 s — le panneau de diagnostic
  //   de l'application Android s'affichait alors à chaque ouverture (signalé le 2026-10-07).
  // SCHEMA.*, jamais tcoActif()/telemetrieActif() ici : UI.companyPlan n'est pas encore affecté à ce stade du boot
  // (bug de l'ordre de démarrage du TCO, 1er oct. 2026). Même discipline pour Stock, kits et télémétrie :
  //   - hasTco : une seule sonde (labor_hourly_rate) suffit, toute la migration TCO a été ajoutée ensemble ;
  //   - hasStock : table warehouses (schéma et RPC ajoutés ensemble), indépendant du palier d'offre
  //     (planCouvreStock()) — seul le palier décide si le module reste ACCESSIBLE (voir navItemsVisibles()) ;
  //   - hasStockPackaging et hasKits : migrations ajoutées APRÈS coup, sonde dédiée chacune ;
  //   - hasTelemetry / hasGps : une sonde sur les colonnes ajoutées à machines suffit.
  const [
    aNomsContact, aRappels, aPushRoles, aPays, aReferences, aTco, aStock, aConditionnement, aKits, aTelemetrie, aGps,
    roleExiste, aStructure,
  ] = await Promise.all([
    sonderColonne('companies', 'contact_first_name'),
    sonderColonne('companies', 'notification_email'),
    sonderColonne('companies', 'reminders_push'),
    sonderColonne('companies', 'country'),
    sonderColonne('machine_type_references', 'cle'),
    sonderColonne('companies', 'labor_hourly_rate'),
    sonderColonne('warehouses', 'id'),
    sonderColonne('parts_catalog', 'packaging'),
    sonderColonne('maintenance_kits', 'id'),
    sonderColonne('machines', 'telemetry_ref, counter_source, telemetry_last_at'),
    sonderColonne('machines', 'position_enabled, last_lat, last_lon, last_position_at'),
    sonderColonne('profiles', 'role'),
    sonderColonne('companies', 'structure_type'),
  ]);
  SCHEMA.hasContactNames = aNomsContact;
  SCHEMA.hasReminders = aRappels;
  SCHEMA.hasPushRoles = aPushRoles;
  SCHEMA.hasCountry = aPays;
  SCHEMA.hasReferences = aReferences;
  SCHEMA.hasTco = aTco;
  SCHEMA.hasStock = aStock;
  SCHEMA.hasStockPackaging = aConditionnement;
  SCHEMA.hasKits = aKits;
  SCHEMA.hasTelemetry = aTelemetrie;
  SCHEMA.hasGps = aGps;
  SCHEMA.hasStructureType = aStructure;

  // Chargement de la société, avec repli en cascade si des colonnes
  // optionnelles manquent sur une base plus ancienne. L'ordre va du plus riche
  // au plus pauvre : la première tentative qui passe gagne, et les suivantes ne
  // coûtent une requête que sur une base incomplète.
  const colonnesBase = ['name', 'plan', 'contact_name', ...(SCHEMA.hasStructureType ? ['structure_type'] : [])];
  const colonnesEtendues = [...colonnesBase, 'activity', 'registration_number', 'phone'];
  const colonnesContact = SCHEMA.hasContactNames ? ['contact_first_name', 'contact_last_name'] : [];
  const colonnesRappels = SCHEMA.hasReminders
    ? ['notification_email', 'reminders_email', 'reminders_whatsapp'] : [];
  // SCHEMA.hasTco (pas tcoActif()) : à cet instant du boot, UI.companyPlan
  // n'est pas encore affecté (voir plus bas, après le chargement des
  // machines) — tcoActif() y lirait toujours 'free' et viderait news
  // colonnes même pour une société qui a bien le palier requis. Même bug
  // que celui déjà documenté plus haut (SCHEMA.* sondé une fois, jamais
  // dépendant d'un état pas encore prêt) — trouvé en direct le 1er oct.
  // 2026 : le classement TCO et le barème horaire disparaissaient alors
  // que les données existaient bien en base.
  const colonnesTco = SCHEMA.hasTco
    ? ['labor_hourly_rate', 'default_insurance_yearly', 'default_storage_yearly', 'currency'] : [];
  // Colonnes de ciblage du push par rôle — ajoutées seulement à la tentative
  // la plus riche : c'est la plus récente des migrations optionnelles, donc
  // la plus probable d'être absente sur un environnement pas encore à jour ;
  // toute la cascade existante en dessous reste inchangée en repli.
  const colonnesPush = SCHEMA.hasPushRoles
    ? ['reminders_push', 'reminders_push_roles'] : [];
  const colonnesPays = SCHEMA.hasCountry ? ['country'] : [];
  const tentatives = [
    [...colonnesEtendues, ...colonnesContact, ...colonnesRappels, ...colonnesTco, ...colonnesPush, ...colonnesPays],
    [...colonnesEtendues, ...colonnesContact, ...colonnesRappels, ...colonnesTco, ...colonnesPush],
    [...colonnesEtendues, ...colonnesContact, ...colonnesRappels, ...colonnesTco],
    [...colonnesEtendues, ...colonnesContact, ...colonnesRappels],
    [...colonnesEtendues, ...colonnesContact],
    [...colonnesEtendues, ...colonnesRappels],
    colonnesEtendues,
    colonnesBase,
    ['name', 'plan'],
  ];

  // ★ LE RÔLE SE LIT ICI, AVEC LE RESTE DU PROFIL. C'est lui qui commande ce que
  //   l'écran propose ou masque : inviter, changer un rôle, retirer un membre,
  //   supprimer une machine. Il n'était PAS sélectionné : `UI.role` restait vide,
  //   `ROLE_DROITS[vide]` retombait sur le droit le plus faible — et l'écran
  //   annonçait « Seul le gérant peut inviter » À UN GÉRANT, sans bouton.
  //   La colonne n'existe qu'après migration-roles-equipe : on la SONDE, comme les
  //   autres, pour ne pas casser une base plus ancienne. La sonde RÉUSSIT quand la
  //   colonne existe — c'est ce cas, et lui seul, qui l'ajoute au `select`.
  const colonnesProfil = roleExiste ? 'company_id, role' : 'company_id';

  let profile = null;
  let profileErr = null;
  for (const colonnes of tentatives) {
    ({ data: profile, error: profileErr } = await sb
      .from('profiles')
      .select(`${colonnesProfil}, companies(${colonnes.join(', ')})`)
      .eq('id', session.user.id)
      .single());
    if (!profileErr) break;
  }

  // ★ « PAS DE LIGNE » N'EST PAS « ERREUR », ET LES DEUX MÈNENT ICI.
  //   Un profil absent (`.single()` répond PGRST116) et un profil PRÉSENT mais
  //   SANS société aboutissent au même écran : c'est la fonction de création qui
  //   rattache dans les deux cas. Quant à une lecture qui ÉCHOUE (schéma, droits,
  //   réseau), on ne peut pas en conclure « ce compte n'a pas de société » — mais
  //   on garde quand même le chemin vers la création, parce que c'est la seule
  //   issue d'un compte neuf, et qu'elle est devenue SANS DANGER : si une société
  //   existe, elle est réutilisée, jamais dupliquée. Le motif est affiché.
  const pasDeLigne = !!profileErr
    && (profileErr.code === 'PGRST116' || /no rows|0 rows/i.test(String(profileErr.message || '')));
  if (!profile || !profile.company_id) {
    // Un réseau absent ne doit pas ressembler à un compte mal rattaché.
    if (cache && estErreurReseau(profileErr)) { afficherDepuisCache(cache); return; }
    renderSocieteManquante(session.user, profileErr && !pasDeLigne ? profileErr.message : '');
    return;
  }

  const company = Array.isArray(profile.companies) ? profile.companies[0] : profile.companies;

  // Capacités du schéma, détectées par deux requêtes minuscules (une ligne,
  // aucune donnée lue). Cela remplace l'ancienne cascade de repli, qui devenait
  // ingérable à mesure que des colonnes optionnelles s'ajoutaient.
  // sonderColonne() (voir sa note plus haut) : chacune de ces 6 sondes reprend
  // une fois sur une erreur RÉSEAU avant de conclure à une colonne absente —
  // sans ça, une seule requête 4G ratée pouvait éteindre le suivi au
  // compteur (hasCounter) ou le second compteur pour toute la session,
  // jusqu'au prochain démarrage. Constaté en direct sur un vrai téléphone
  // (c'est la même faille qui faisait disparaître le TCO du tableau de
  // bord — voir keeva-redesign-project).
  const [hasCounter, hasCounter2, hasBrandModel, hasKindPlate, hasModelYear, hasCreatedAt] = await Promise.all([
    sonderColonne('machines', 'counter_unit'),
    // Second compteur : sondé séparément, la migration peut être appliquée
    // sans que l'autre le soit (voir SCHEMA.hasCounter2).
    sonderColonne('machines', 'counter_value_2'),
    sonderColonne('machines', 'brand, model'),
    sonderColonne('machines', 'kind, plate'),
    sonderColonne('machines', 'model_year'),
    // created_at sert à savoir QUELLES machines une offre couvre (les plus
    // anciennes restent actives). Sondée comme les autres : une base qui ne
    // l'aurait pas continue de fonctionner, l'ordre se faisant alors par id.
    sonderColonne('machines', 'created_at'),
  ]);
  SCHEMA.hasCounter = hasCounter;
  SCHEMA.hasCounter2 = hasCounter2;
  SCHEMA.hasBrandModel = hasBrandModel;
  SCHEMA.hasKind = hasKindPlate;
  SCHEMA.hasPlate = hasKindPlate;
  SCHEMA.hasModelYear = hasModelYear;
  SCHEMA.hasCreatedAt = hasCreatedAt;

  const colonnesMachine = [
    'id', 'name', 'brand_model', 'serial_number', 'status', 'manual_url',
    'service_date', 'image_url',
    SCHEMA.hasCounter ? 'counter_unit' : 'current_hours',
    ...(SCHEMA.hasCounter ? ['counter_value'] : []),
    ...(SCHEMA.hasCounter2 ? ['counter_value_2', 'counter_unit_2'] : []),
    ...(SCHEMA.hasBrandModel ? ['brand', 'model'] : []),
    ...(SCHEMA.hasKind ? ['kind'] : []),
    ...(SCHEMA.hasPlate ? ['plate'] : []),
    ...(SCHEMA.hasModelYear ? ['model_year'] : []),
    // L'ordre de création : c'est lui qui décide quelles machines une offre
    // couvre quand le compte repasse en gratuit.
    ...(SCHEMA.hasCreatedAt ? ['created_at'] : []),
    ...(SCHEMA.hasTelemetry ? ['telemetry_source_id', 'telemetry_ref', 'counter_source', 'telemetry_last_at'] : []),
    ...(SCHEMA.hasGps ? ['position_enabled', 'last_lat', 'last_lon', 'last_position_at'] : []),
    // SCHEMA.hasTco, pas tcoActif() : même raison que colonnesTco ci-dessus
    // (UI.companyPlan pas encore prêt à ce stade du boot).
    ...(SCHEMA.hasTco
      ? ['purchase_price', 'purchase_date', 'estimated_resale_value', 'expected_lifespan_counter', 'amortization_years']
      : []),
  ].join(', ');
  const colonnesPlan = [
    'id', 'interval_days', 'tasks', 'items', 'notes', 'reminder_days_before',
    'next_due_at', 'tracking_mode',
    ...(SCHEMA.hasCounter
      ? ['interval_counter', 'next_due_counter', 'reminder_counter_before']
      : ['interval_hours', 'next_due_hours', 'reminder_hours_before']),
    ...(SCHEMA.hasCounter2
      ? ['interval_counter_2', 'next_due_counter_2', 'reminder_counter_before_2',
         'interval_days_2', 'next_due_at_2', 'reminder_days_before_2']
      : []),
  ].join(', ');

  // category:machine_categories(...) — target_hourly_cost (phase 3, §5) est
  // SCHEMA.hasTco, pas tcoActif() : même raison que colonnesTco plus haut
  // (UI.companyPlan pas encore prêt à ce stade du boot).
  const colonnesCategorie = SCHEMA.hasTco ? 'id, name, target_hourly_cost' : 'id, name';
  const { data: machines, error: machinesErr } = await sb
    .from('machines')
    .select(`${colonnesMachine}, category:machine_categories(${colonnesCategorie}), plan:maintenance_plans(${colonnesPlan})`)
    .eq('company_id', profile.company_id)
    .order('name');

  if (machinesErr) {
    // Le cas le plus fréquent de très loin : plus de réseau. On montre la
    // dernière liste connue plutôt qu'un message d'erreur.
    if (cache && estErreurReseau(machinesErr)) { afficherDepuisCache(cache); return; }
    app.innerHTML = `<div class="empty">${tR('Erreur de chargement : {erreur}', { erreur: esc(machinesErr.message) })}</div>`;
    return;
  }

  const { data: categories } = await sb
    .from('machine_categories')
    .select(colonnesCategorie)
    .eq('company_id', profile.company_id);

  // Catalogue de pièces : chargé une fois ici (même endroit que les
  // catégories), réutilisé partout où une pièce se sélectionne (voir
  // keeva-tco-feature). Absent tant que la migration TCO n'est pas visible.
  let partsCatalog = [];
  // SCHEMA.hasTco, pas tcoActif() : même raison que colonnesTco plus haut
  // (UI.companyPlan pas encore prêt à ce stade du boot).
  if (SCHEMA.hasTco) {
    const { data: pieces } = await sb
      .from('parts_catalog')
      .select(colonnesCatalogueePiece())
      .eq('company_id', profile.company_id)
      .order('designation');
    partsCatalog = pieces || [];
  }

  // Durées de vie moyennes par type de machine : une petite table partagée, lue une fois.
  let referencesTypes = [];
  if (SCHEMA.hasReferences) {
    const { data: refs } = await sb.from('machine_type_references').select('cle, libelle, unite, duree_vie, source, annee, confiance');
    referencesTypes = refs || [];
  }

  // Stock & SAV (Phase 1) : magasins + solde vivant par (pièce, magasin),
  // chargés une fois ici comme le catalogue de pièces — jamais un fetch
  // flotte-entière séparé par écran. Absent tant que la migration n'est pas
  // visible. `stock_items` n'est jamais écrit directement par le client
  // (voir enregistrer_mouvement_stock) : ce chargement est un simple
  // reflet, toujours réconciliable en relisant la table.
  let warehouses = [];
  let stockItems = [];
  if (SCHEMA.hasStock) {
    const [{ data: mags }, { data: soldes }] = await Promise.all([
      sb.from('warehouses')
        .select('id, name, kind, assigned_to, note, active')
        .eq('company_id', profile.company_id)
        .order('name'),
      sb.from('stock_items')
        .select('id, part_id, warehouse_id, quantity, pump_unit_cost, reorder_point, updated_at')
        .eq('company_id', profile.company_id),
    ]);
    warehouses = mags || [];
    stockItems = soldes || [];
  }

  // Kits d'entretien : bundles de pièces réutilisables, reliables à une
  // étape de plan (maintenance_plans.items[].kit_id) — chargés une fois ici
  // comme le reste du module Stock. Absent tant que la migration n'est pas
  // visible.
  let maintenanceKits = [];
  let maintenanceKitLines = [];
  if (SCHEMA.hasKits) {
    const [{ data: kits }, { data: lignes }] = await Promise.all([
      sb.from('maintenance_kits')
        .select('id, name, note, active')
        .eq('company_id', profile.company_id)
        .order('name'),
      sb.from('maintenance_kit_lines')
        .select('id, kit_id, part_id, quantity, note')
        .eq('company_id', profile.company_id),
    ]);
    maintenanceKits = kits || [];
    maintenanceKitLines = lignes || [];
  }

  // Référentiel des organes défaillants (Dépannage curatif) : même endroit
  // que les catégories/le catalogue pièces — chargé une fois, réutilisé
  // partout où openLogInterventionModal est appelée (voir composantsUtiles).
  const { data: composants } = await sb
    .from('intervention_components')
    .select('id, name')
    .eq('company_id', profile.company_id)
    .order('name');

  UI.companyId = profile.company_id;
  UI.companyName = company?.name || trad('Ta société');
  UI.companyPlan = company?.plan || 'free';
  // Le rôle vient de `profiles.role`. Vide = rôle INCONNU, et c'est un cas à part
  // entière : l'écran ne suppose alors rien et dit pourquoi (voir la carte Équipe).
  UI.role = profile.role || '';
  UI.company = {
    name: company?.name || '',
    activity: company?.activity || '',
    // « company » | « individual » | « institution » : une institution est facturée sur facture, pas par carte.
    structure_type: company?.structure_type || 'company',
    registrationNumber: company?.registration_number || '',
    // Sans colonne en base (ou valeur vide), on garde la Nouvelle-Calédonie : c'est le libellé que l'écran avait jusqu'ici.
    country: company?.country || 'NC',
    // Conservé tel quel : la mise en forme se fait à l'affichage, ce qui permet
    // de lire aussi bien un ancien numéro libre qu'un E.164.
    phone: company?.phone || '',
    plan: company?.plan || 'free',
    contact_name: company?.contact_name || '',
    contact_first_name: company?.contact_first_name || null,
    contact_last_name: company?.contact_last_name || null,
    // Rappels d'échéance : l'adresse qui reçoit l'e-mail (NULL en base = aucun
    // envoi) et l'accord d'envoi. Sur une base antérieure à la migration, les
    // colonnes sont absentes : la case reste alors cochée par défaut, comme la
    // base elle-même (reminders_email boolean not null default true).
    notification_email: company?.notification_email || '',
    reminders_email: company?.reminders_email !== false,
    reminders_whatsapp: company?.reminders_whatsapp === true,
    // Ciblage des rappels push par rôle : { role: { jours, compteur } }.
    // Absent/vide tant que le gérant n'a rien réglé — jamais supposé actif.
    reminders_push: company?.reminders_push === true,
    reminders_push_roles: (company?.reminders_push_roles && typeof company.reminders_push_roles === 'object') ? company.reminders_push_roles : {},
    // TCO : taux horaire main d'œuvre + barèmes suggérés (jamais imposés —
    // voir keeva-tco-feature). Nuls tant qu'aucun réglage n'a été enregistré.
    labor_hourly_rate: company?.labor_hourly_rate ?? null,
    default_insurance_yearly: company?.default_insurance_yearly ?? null,
    default_storage_yearly: company?.default_storage_yearly ?? null,
    // Devise des montants TCO (EUR ou XPF, parité fixe) : un seul réglage
    // par société, défini dans la carte « Paramètres TCO » — jamais par
    // machine ni par visiteur. 'EUR' par défaut (colonne not null en base).
    currency: company?.currency || 'EUR',
  };
  UI.contactName = company?.contact_name || '';
  initialiserLangueServeur(session); // sans await : ne retarde jamais l'affichage
  UI.contactFirstName = companyFirstName(UI.company);
  UI.email = session.user.email || '';
  UI.categories = categories || [];
  UI.components = composants || [];
  UI.partsCatalog = partsCatalog;
  UI.referencesTypes = referencesTypes;
  UI.warehouses = warehouses;
  UI.stockItems = stockItems;
  UI.stockCounts = calculerStockCounts(stockItems, partsCatalog);
  UI.maintenanceKits = maintenanceKits;
  UI.maintenanceKitLines = maintenanceKitLines;
  UI.machines = (machines || []).map(m => ({
    ...m,
    plan: Array.isArray(m.plan) ? m.plan[0] : m.plan,
    category: Array.isArray(m.category) ? m.category[0] : m.category,
  }));
  // À partir d'ici, UI.machines reflète les VRAIES données de la société
  // connectée — voir __appPretePourPush, lu par wirePushEcouteurs().
  __appPretePourPush = true;

  // Entretiens programmés (calendrier Agenda) : un jeu de données léger par
  // société, chargé une fois ici comme le catalogue de pièces — jamais
  // rechargé à chaque clic sur un jour du calendrier.
  let scheduledMaintenances = [];
  if (UI.machines.length) {
    const { data: programmes } = await sb
      .from('scheduled_maintenances')
      .select('id, machine_id, scheduled_date, label, status, created_at')
      .in('machine_id', UI.machines.map((m) => m.id))
      .order('scheduled_date');
    scheduledMaintenances = programmes || [];
  }
  UI.scheduledMaintenances = scheduledMaintenances;
  UI.reminders = loadReminders();
  UI.horsLigne = null;

  // Copie des données fraîches : c'est elle qui servira hors connexion.
  enregistrerCache({
    companyId: UI.companyId,
    companyName: UI.companyName,
    companyPlan: UI.companyPlan,
    company: UI.company,
    contactName: UI.contactName,
    email: UI.email,
    categories: UI.categories,
    components: UI.components,
    partsCatalog: UI.partsCatalog,
    referencesTypes: UI.referencesTypes,
    warehouses: UI.warehouses,
    stockItems: UI.stockItems,
    maintenanceKits: UI.maintenanceKits,
    maintenanceKitLines: UI.maintenanceKitLines,
    machines: UI.machines,
    scheduledMaintenances: UI.scheduledMaintenances,
  });

  renderApp();
  afficherBandeauSupportSiActif();
  if (toastMessage) showToast(toastMessage);

  // Retour de paiement Stripe : la confirmation vient APRÈS le rendu du parc,
  // donc derrière une fenêtre que l'on peut fermer — l'accès au parc n'est
  // jamais bloqué. Le palier est relu avant de l'annoncer.
  annoncerForfait();

  // ★ UNE INVITATION DÉJÀ CONNECTÉ : le bloc se pose sur l'application. Sans ce
  //   contrôle, un lien d'invitation ouvert par une personne connectée ne
  //   produisait RIEN — le bloc n'existait que sur l'écran de connexion.
  verifierInvitationConnectee();

  // ★ LIEN PROFOND QR CODE : UI.machines est chargé, on peut résoudre. Sans
  //   effet si aucun paramètre `?qr=` n'est présent (cas normal).
  ouvrirFicheDepuisQrSiPresent();

  // ★ TAP SUR UNE NOTIFICATION PUSH arrivé avant que UI.machines soit chargé
  //   (lancement à froid) : résolu ici, même emplacement que le lien QR.
  ouvrirFicheDepuisPushSiPresent();

  // Le téléphone ré-annonce son jeton de notification au serveur (voir resynchroniserJetonPush) — sans bloquer l'ouverture.
  resynchroniserJetonPush();

  // Reprogrammation des rappels à chaque ouverture, sans réclamer
  // l'autorisation : celle-ci n'est demandée que sur action de l'utilisateur.
  // Hors connexion, l'appel échoue sans conséquence — les rappels déjà
  // programmés restent valides.
  programmerRappels({ demander: false });
}
