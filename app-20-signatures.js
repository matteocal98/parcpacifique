// ── SIGNATURE NUMÉRIQUE DES INTERVENTIONS (étape 4 du plan « nouvelles fonctionnalités », §6) ───────────────────────────────────────────────────────────
// Une personne identifiée signe une intervention (tracé au doigt ou à la souris) ; le SERVEUR fige le contenu et en calcule l'empreinte SHA-256 (migrations/signatures-interventions.sql).
// Une intervention signée est VERROUILLÉE : une correction passe par un AVENANT tracé. Un rapport PDF reprend l'intervention, ses signatures et l'état de vérification.
//
// OFFRE : Enterprise (décision du 2026-10-28, à confirmer). SCHEMA.hasSignatures : tant que le SQL n'est pas passé, aucun bouton, aucune fenêtre.
// RÉGLAGE « exiger la signature de l'exécutant » (désactivé par défaut) : si actif, la fenêtre de signature s'ouvre juste après chaque intervention enregistrée (non fermable) ; sinon, on signe à la demande
//   depuis l'historique des entretiens ou depuis la fiche d'un ordre terminé.
// SANS RÉSEAU : la signature est mise dans la file d'opérations (type « signature »), rejouée APRÈS l'intervention qu'elle signe (même ordre de création) ; le serveur fige le contenu à ce moment-là.
// VALEUR : signature électronique SIMPLE (règlement européen eIDAS) — preuve de suivi interne ; elle ne remplace pas une signature qualifiée.

function planCouvreSignature() {
  return offreDeLaGrille(UI.companyPlan || 'free').cle === 'enterprise';
}
function signaturesActif() {
  return Boolean(SCHEMA.hasSignatures) && planCouvreSignature();
}

// Le réglage de la société (lu avec une copie de secours : il doit rester connu hors connexion).
async function chargerReglageSignature() {
  if (!signaturesActif()) { UI.signatureRequise = false; return false; }
  try {
    const lu = await lireAvecCopie('signature-reglage', async () => {
      const { data, error } = await sb.from('companies').select('signature_requise').eq('id', UI.companyId).maybeSingle();
      if (error) throw error;
      return Boolean(data && data.signature_requise);
    });
    UI.signatureRequise = lu.data === true;
  } catch (err) { UI.signatureRequise = false; }
  return UI.signatureRequise;
}

const SIG_ROLES = () => ({ executant: trad('Exécutant'), responsable: trad('Responsable / client') });
const sigAppareil = () => String((window.Capacitor ? 'Application KALEA (Android) · ' : '') + (navigator.userAgent || '')).slice(0, 190);

// ── La fenêtre de tracé ──
// Rend { image (PNG en data:), nom, fonction } ou null si la personne renonce. `obligatoire` : pas de bouton pour renoncer.
function ouvrirPadSignature({ role, titre, sousTitre, obligatoire = false, fonctionDefaut = '' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay otm-overlay';
    const nomSignataire = role === 'executant' ? (typeof otNomEquipe === 'function' && UI.userId ? otNomEquipe(UI.userId) : '') : '';
    overlay.innerHTML = `
      <div class="modal otm sig-modal" role="dialog" aria-modal="true" aria-labelledby="sig-titre">
        <header class="otm-tete">
          <div class="otm-tuile">${otSymbole('draw')}</div>
          <div class="otm-tete-textes">
            <div class="otm-tete-ligne"><span class="otm-etape">${trad('Signature')}</span><span class="otm-marque">${esc(SIG_ROLES()[role])}</span></div>
            <h2 id="sig-titre">${esc(titre)}</h2>
            ${sousTitre ? `<p>${esc(sousTitre)}</p>` : ''}
          </div>
          ${obligatoire ? '' : `<button type="button" class="otm-fermer" data-sig-annuler aria-label="${esc(trad('Fermer'))}">${otSymbole('close')}</button>`}
        </header>
        <div class="otm-form-corps">
          <section class="otm-bloc">
            ${role === 'responsable'
              ? `<div class="ui-champ-groupe"><label class="ui-etiquette" for="sig-nom">${trad('Nom du signataire')}</label><input id="sig-nom" class="ui-champ" maxlength="120" autocomplete="off"></div>`
              : `<p class="sig-signataire">${nomSignataire ? tR('Signataire : {nom}', { nom: esc(nomSignataire) }) : trad('Signataire : la personne connectée')}</p>`}
            <div class="ui-champ-groupe"><label class="ui-etiquette" for="sig-fonction">${trad('Fonction (facultatif)')}</label><input id="sig-fonction" class="ui-champ" maxlength="120" autocomplete="off" value="${esc(fonctionDefaut)}"></div>
            <div class="sig-zone" id="sig-zone"><canvas id="sig-canvas" aria-label="${esc(trad('Zone de signature'))}"></canvas><span class="sig-ligne">${trad('Signez ici')}</span></div>
            <p class="ui-aide">${trad('En signant, je confirme que les travaux décrits ont été réalisés. Signature électronique simple : preuve de suivi interne.')}</p>
            <div id="sig-msg" class="ui-aide" role="status" aria-live="polite" style="color:var(--danger,#c0392b)"></div>
          </section>
        </div>
        <footer class="otm-pied">
          <button type="button" class="otm-btn is-discret" id="sig-effacer">${otSymbole('ink_eraser')}<span>${trad('Effacer')}</span></button>
          <div class="otm-pied-actions">
            ${obligatoire ? '' : `<button type="button" class="otm-btn" data-sig-annuler>${trad('Plus tard')}</button>`}
            <button type="button" class="otm-btn is-plein" id="sig-valider" disabled><span>${trad('Valider la signature')}</span>${otSymbole('check')}</button>
          </div>
        </footer>
      </div>`;
    document.body.appendChild(overlay);
    const q = (s) => overlay.querySelector(s);
    const canvas = q('#sig-canvas');
    const ctx = canvas.getContext('2d');
    let dessin = false; let dernier = null; let longueur = 0; let traits = 0;
    const regler = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      canvas.width = Math.round((r.width || 320) * dpr); canvas.height = Math.round((r.height || 180) * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0E1333';
    };
    regler();
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const majBouton = () => { q('#sig-valider').disabled = longueur < 60 || traits < 1; };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sans conséquence */ }
      dessin = true; dernier = pos(e); traits++;
      ctx.beginPath(); ctx.arc(dernier.x, dernier.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#0E1333'; ctx.fill();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dessin) return;
      e.preventDefault();
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(dernier.x, dernier.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      longueur += Math.hypot(p.x - dernier.x, p.y - dernier.y); dernier = p; majBouton();
    });
    const fin = () => { dessin = false; majBouton(); };
    canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin); canvas.addEventListener('pointerleave', () => { if (dessin) fin(); });
    q('#sig-effacer').addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); longueur = 0; traits = 0; majBouton(); q('#sig-msg').textContent = ''; });
    overlay.querySelectorAll('[data-sig-annuler]').forEach((b) => b.addEventListener('click', () => { overlay.remove(); resolve(null); }));
    if (!obligatoire) overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    q('#sig-valider').addEventListener('click', () => {
      const nom = role === 'responsable' ? q('#sig-nom').value.trim() : '';
      if (role === 'responsable' && !nom) { q('#sig-msg').textContent = trad('Indique le nom du signataire.'); q('#sig-nom').focus(); return; }
      // Image réduite (largeur 560 px au plus) : légère à stocker, à envoyer et à intégrer au PDF.
      const largeur = Math.min(560, canvas.width); const hauteur = Math.round(canvas.height * (largeur / canvas.width));
      const reduit = document.createElement('canvas'); reduit.width = largeur; reduit.height = hauteur;
      reduit.getContext('2d').drawImage(canvas, 0, 0, largeur, hauteur);
      const image = reduit.toDataURL('image/png');
      if (image.length > 240000) { q('#sig-msg').textContent = trad('Signature trop volumineuse : efface et recommence plus simplement.'); return; }
      overlay.remove();
      resolve({ image, nom, fonction: q('#sig-fonction').value.trim() });
    });
    setTimeout(() => (role === 'responsable' ? q('#sig-nom') : canvas).focus && (role === 'responsable' ? q('#sig-nom') : canvas).focus(), 80);
  });
}

// ── Envoyer une signature (ou la mettre en file sans réseau) ──
async function envoyerSignature(p) {
  const { error } = await sb.rpc('signer_intervention', {
    p_id: p.id, p_intervention: p.interventionId, p_role: p.role, p_nom: p.nom || null, p_fonction: p.fonction || null, p_image: p.image, p_appareil: p.appareil || null,
  });
  if (error) throw error;
}
async function fileTraiterSignature(op) { await envoyerSignature(op.payload); }

// Rend { envoyee: true } ou { enFile: true } ; lance l'erreur du serveur si elle est DÉFINITIVE (déjà signée, pas le droit…).
// `differe` : l'intervention elle-même attend dans la file (pas encore sur le serveur) → la signature la suit dans la file, jamais devant.
async function poserSignature({ machine, interventionId, role, nom, fonction, image, differe }) {
  const payload = { id: nouvelIdentifiant(), interventionId, role, nom: nom || null, fonction: fonction || null, image, appareil: sigAppareil() };
  try {
    if (differe || navigator.onLine === false) throw new Error('hors connexion');
    await envoyerSignature(payload);
    return { envoyee: true };
  } catch (err) {
    if (!estErreurTransitoire(err)) throw err;
    await fileAjouter('signature', payload, { machine: machine ? machine.name : '', detail: SIG_ROLES()[role] });
    return { enFile: true };
  }
}

// Juste après l'enregistrement d'une intervention : si la société exige la signature de l'exécutant, on la demande (non fermable), puis on propose celle d'un responsable.
async function proposerSignaturesApresIntervention(machine, interventionId, differe) {
  if (!signaturesActif()) return;
  if (!(await chargerReglageSignature())) return;   // relu à chaque fois (copie de secours hors connexion) : aucun ordre de démarrage à respecter
  try {
    const exe = await ouvrirPadSignature({ role: 'executant', obligatoire: true, titre: trad('Signer l\'intervention'), sousTitre: machine ? machine.name : '' });
    const r1 = await poserSignature({ machine, interventionId, role: 'executant', fonction: exe.fonction, image: exe.image, differe });
    if (r1.enFile) showToast(trad('Signature enregistrée sur l\'appareil : elle partira avec l\'intervention.'));
    if (window.confirm(trad('Faire signer aussi un responsable ou le client ?'))) {
      const resp = await ouvrirPadSignature({ role: 'responsable', titre: trad('Signature du responsable'), sousTitre: machine ? machine.name : '' });
      if (resp) await poserSignature({ machine, interventionId, role: 'responsable', nom: resp.nom, fonction: resp.fonction, image: resp.image, differe });
    }
  } catch (err) {
    showToast(trad('Signature non enregistrée : ') + ((err && err.message) || err) + ' — ' + trad('tu peux signer depuis l\'historique de la machine.'));
  }
}

// ── Le dossier d'une intervention : ses données, ses signatures, ses avenants et l'état de vérification ──
async function chargerDossierIntervention(id) {
  const [inter, pieces, sigs, avs, verif, equipe] = await Promise.all([
    sb.from('interventions').select('*').eq('id', id).maybeSingle(),
    sb.from('intervention_parts').select('designation, quantity, part_id').eq('intervention_id', id),
    sb.from('intervention_signatures').select('id, role, nom, fonction, signe_a, empreinte, appareil, image').eq('intervention_id', id).order('signe_a'),
    sb.from('intervention_avenants').select('id, auteur_nom, motif, correction, cree_a').eq('intervention_id', id).order('cree_a'),
    sb.rpc('verifier_signatures_intervention', { p_intervention: id }),
    equipePourAttribution().catch(() => []),
  ]);
  for (const r of [inter, pieces, sigs, avs]) if (r.error) throw r.error;
  if (!inter.data) throw new Error(trad('Intervention introuvable ou non accessible.'));
  const machine = [...(UI.machines || []), ...(UI.machinesArchivees || [])].find((m) => String(m.id) === String(inter.data.machine_id)) || null;
  return {
    intervention: inter.data, pieces: pieces.data || [], signatures: sigs.data || [], avenants: avs.data || [], machine,
    verification: verif.error ? null : verif.data, noms: new Map((equipe || []).map((m) => [m.id, m.nom_affiche])),
  };
}
const sigDate = (iso) => { const t = new Date(iso); return isNaN(t) ? '' : t.toLocaleString(localeActive(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

// Peut-on signer cette intervention comme exécutant ? (la fonction serveur tranche vraiment ; ceci évite d'afficher un bouton inutile)
function sigPeutSignerExecutant(d) {
  if (d.signatures.some((s) => s.role === 'executant')) return false;
  const faitPar = d.intervention.performed_by;
  return !faitPar || String(faitPar) === String(UI.userId) || (typeof peutGererOrdres === 'function' && peutGererOrdres());
}

// ── La fenêtre « Rapport et signatures » ──
async function ouvrirRapportIntervention(interventionId) {
  if (!signaturesActif()) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay otm-overlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal otm sig-modal" role="dialog" aria-modal="true" aria-labelledby="rap-titre">
      <header class="otm-tete">
        <div class="otm-tuile">${otSymbole('verified')}</div>
        <div class="otm-tete-textes">
          <div class="otm-tete-ligne"><span class="otm-etape">${trad('Rapport')}</span><span class="otm-marque">GMAO KALEA</span></div>
          <h2 id="rap-titre">${trad('Rapport et signatures')}</h2>
          <p id="rap-sous">${trad('Chargement…')}</p>
        </div>
        <button type="button" class="otm-fermer" data-otm-fermer aria-label="${esc(trad('Fermer'))}">${otSymbole('close')}</button>
      </header>
      <div class="otm-form-corps" id="rap-corps"><p class="ui-aide">${trad('Chargement…')}</p></div>
      <footer class="otm-pied" id="rap-pied"></footer>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target.closest('[data-otm-fermer]')) overlay.remove(); });
  let dossier = null;

  const dessiner = () => {
    const d = dossier; const i = d.intervention;
    overlay.querySelector('#rap-sous').textContent = [d.machine ? d.machine.name : '', formatShortDateAvecAnnee(i.performed_at)].filter(Boolean).join(' · ');
    const v = d.verification;
    const signee = d.signatures.length > 0;
    let etat;
    if (!signee) etat = `<div class="sig-etat is-aucune">${otSymbole('edit_off')}<div><strong>${trad('Non signée')}</strong><span>${trad('Cette intervention peut encore être modifiée.')}</span></div></div>`;
    else if (!v) etat = `<div class="sig-etat is-inconnu">${otSymbole('help')}<div><strong>${trad('Signée')}</strong><span>${trad('Vérification d\'intégrité indisponible pour le moment.')}</span></div></div>`;
    else if (v.integre) etat = `<div class="sig-etat is-ok">${otSymbole('verified')}<div><strong>${trad('Signée — intègre')}</strong><span>${trad('Le contenu est identique à celui qui a été signé.')}</span></div></div>`;
    else etat = `<div class="sig-etat is-alerte">${otSymbole('warning')}<div><strong>${trad('Modifiée depuis la signature')}</strong><span>${trad('Le contenu actuel diffère de celui qui a été signé : voir les avenants et contacter la gestion.')}</span></div></div>`;
    const lignesSig = d.signatures.map((s) => `
      <div class="sig-carte">
        <img class="sig-image" src="${esc(s.image)}" alt="${esc(trad('Signature de') + ' ' + s.nom)}">
        <div class="sig-carte-textes">
          <strong>${esc(s.nom)}</strong><span>${esc(SIG_ROLES()[s.role] || s.role)}${s.fonction ? ' · ' + esc(s.fonction) : ''}</span>
          <span class="sig-meta">${esc(sigDate(s.signe_a))}</span>
          <span class="sig-meta sig-hash" title="${esc(s.empreinte)}">SHA-256 ${esc(s.empreinte.slice(0, 16))}…</span>
        </div>
      </div>`).join('');
    const lignesAv = d.avenants.map((a) => `
      <div class="sig-avenant"><span class="sig-meta">${esc(sigDate(a.cree_a))} · ${esc(a.auteur_nom)}</span><strong>${esc(a.motif)}</strong><p>${esc(a.correction)}</p></div>`).join('');
    overlay.querySelector('#rap-corps').innerHTML = `
      ${etat}
      <section class="otm-bloc"><h3 class="otm-bloc-titre">${otSymbole('draw')}<span>${trad('Signatures')}</span></h3>${lignesSig || `<p class="ui-aide">${trad('Aucune signature pour l\'instant.')}</p>`}</section>
      ${d.avenants.length ? `<section class="otm-bloc"><h3 class="otm-bloc-titre">${otSymbole('edit_note')}<span>${tR('Avenants ({n})', { n: d.avenants.length })}</span></h3>${lignesAv}</section>` : ''}
      <div id="rap-msg" class="ui-aide" role="status" aria-live="polite" style="color:var(--danger,#c0392b)"></div>`;
    const boutons = [];
    if (sigPeutSignerExecutant(d)) boutons.push(`<button type="button" class="otm-btn is-plein" data-rap="signer-executant">${otSymbole('draw')}<span>${trad('Signer (exécutant)')}</span></button>`);
    if (!d.signatures.some((s) => s.role === 'responsable')) boutons.push(`<button type="button" class="otm-btn" data-rap="signer-responsable">${otSymbole('person_add')}<span>${trad('Faire signer un responsable')}</span></button>`);
    if (signee && typeof peutGererOrdres === 'function' && peutGererOrdres()) boutons.push(`<button type="button" class="otm-btn" data-rap="avenant">${otSymbole('edit_note')}<span>${trad('Ajouter un avenant')}</span></button>`);
    boutons.push(`<button type="button" class="otm-btn ${signee && !boutons.length ? 'is-plein' : ''}" data-rap="pdf">${otSymbole('picture_as_pdf')}<span>${trad('Rapport PDF')}</span></button>`);
    overlay.querySelector('#rap-pied').innerHTML = `<span></span><div class="otm-pied-actions">${boutons.join('')}</div>`;
  };
  const dire = (t) => { const m = overlay.querySelector('#rap-msg'); if (m) m.textContent = t || ''; };
  const recharger = async () => {
    try { dossier = await chargerDossierIntervention(interventionId); dessiner(); }
    catch (err) { overlay.querySelector('#rap-corps').innerHTML = `<p class="ui-aide" style="color:var(--danger,#c0392b)">${esc((err && err.message) || trad('Chargement impossible.'))}</p>`; }
  };
  await recharger();

  overlay.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rap]');
    if (!b || !dossier) return;
    const act = b.getAttribute('data-rap');
    dire('');
    try {
      if (act === 'signer-executant' || act === 'signer-responsable') {
        const role = act === 'signer-executant' ? 'executant' : 'responsable';
        const r = await ouvrirPadSignature({ role, titre: role === 'executant' ? trad('Signer l\'intervention') : trad('Signature du responsable'), sousTitre: dossier.machine ? dossier.machine.name : '' });
        if (!r) return;
        b.disabled = true;
        const res = await poserSignature({ machine: dossier.machine, interventionId, role, nom: r.nom, fonction: r.fonction, image: r.image });
        if (res.enFile) { showToast(trad('Signature enregistrée sur l\'appareil : elle partira dès que le réseau revient.')); overlay.remove(); return; }
        await recharger();
      } else if (act === 'avenant') {
        const fait = await ouvrirAvenant(interventionId);
        if (fait) await recharger();
      } else if (act === 'pdf') {
        b.disabled = true;
        const { blob, nomFichier } = await genererRapportInterventionPdf(dossier);
        await telechargerFichierBinaire(blob, nomFichier, 'application/pdf');
        b.disabled = false;
      }
    } catch (err) { dire((err && err.message) || String(err)); if (b) b.disabled = false; }
  });
}

// ── Avenant : une correction tracée d'une intervention signée (réseau requis) ──
function ouvrirAvenant(interventionId) {
  return new Promise((resolve) => {
    const idAvenant = nouvelIdentifiant();   // fixé à l'ouverture : un renvoi ne crée jamais un deuxième avenant
    const overlay = document.createElement('div');
    overlay.className = 'overlay otm-overlay';
    overlay.innerHTML = `
      <div class="modal otm sig-modal" role="dialog" aria-modal="true" aria-labelledby="av-titre">
        <header class="otm-tete">
          <div class="otm-tuile">${otSymbole('edit_note')}</div>
          <div class="otm-tete-textes"><div class="otm-tete-ligne"><span class="otm-etape">${trad('Avenant')}</span><span class="otm-marque">GMAO KALEA</span></div>
            <h2 id="av-titre">${trad('Ajouter un avenant')}</h2><p>${trad('L\'intervention signée n\'est pas modifiée : l\'avenant s\'ajoute à son rapport, avec ton nom et la date.')}</p></div>
          <button type="button" class="otm-fermer" data-av-annuler aria-label="${esc(trad('Fermer'))}">${otSymbole('close')}</button>
        </header>
        <div class="otm-form-corps"><section class="otm-bloc">
          <div class="ui-champ-groupe"><label class="ui-etiquette" for="av-motif">${trad('Motif de la correction')}</label><input id="av-motif" class="ui-champ" maxlength="500" placeholder="${esc(trad('Ex. : erreur de saisie du compteur'))}"></div>
          <div class="ui-champ-groupe"><label class="ui-etiquette" for="av-corr">${trad('Correction')}</label><textarea id="av-corr" class="ui-champ" rows="4" maxlength="1500" placeholder="${esc(trad('Ex. : le compteur était de 1 250 h et non de 1 205 h.'))}"></textarea></div>
          <div id="av-msg" class="ui-aide" role="status" aria-live="polite" style="color:var(--danger,#c0392b)"></div>
        </section></div>
        <footer class="otm-pied"><span></span><div class="otm-pied-actions"><button type="button" class="otm-btn" data-av-annuler>${trad('Annuler')}</button><button type="button" class="otm-btn is-plein" id="av-valider"><span>${trad('Enregistrer l\'avenant')}</span></button></div></footer>
      </div>`;
    document.body.appendChild(overlay);
    const q = (s) => overlay.querySelector(s);
    overlay.querySelectorAll('[data-av-annuler]').forEach((b) => b.addEventListener('click', () => { overlay.remove(); resolve(false); }));
    q('#av-valider').addEventListener('click', async () => {
      const motif = q('#av-motif').value.trim(); const correction = q('#av-corr').value.trim();
      if (!motif || !correction) { q('#av-msg').textContent = trad('Le motif et la correction sont obligatoires.'); return; }
      if (navigator.onLine === false) { q('#av-msg').textContent = trad('Un avenant demande le réseau pour l\'instant.'); return; }
      q('#av-valider').disabled = true;
      const { error } = await sb.rpc('ajouter_avenant_intervention', { p_id: idAvenant, p_intervention: interventionId, p_motif: motif, p_correction: correction });
      if (error) { q('#av-valider').disabled = false; q('#av-msg').textContent = error.message || trad('Enregistrement impossible. Réessaie.'); return; }
      overlay.remove(); showToast(trad('Avenant enregistré')); resolve(true);
    });
    setTimeout(() => q('#av-motif').focus(), 80);
  });
}

// ── Le rapport PDF ──
// Aucune donnée de coût (rapport destiné à être remis au client). Texte nettoyé pour les polices intégrées de jsPDF (voir pdfTexteSain).
async function genererRapportInterventionPdf(d) {
  const jsPDF = await loadJsPdfLib();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const T = (s, x, y, o) => doc.text(pdfTexteSain(s), x, y, o);
  const MX = 15; const L = 180; const BAS = 280;
  const i = d.intervention;
  let y = 0;
  const nouvellePage = () => { doc.addPage(); y = 20; };
  const besoin = (h) => { if (y + h > BAS) nouvellePage(); };
  const titreSection = (txt) => { besoin(14); y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(14, 19, 51); T(txt.toUpperCase(), MX, y); y += 1.5; doc.setDrawColor(14, 19, 51); doc.setLineWidth(0.3); doc.line(MX, y, MX + L, y); y += 5; };
  const ligne = (cle, valeur) => { if (valeur == null || valeur === '') return; besoin(6); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100, 108, 130); T(cle, MX, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(14, 19, 51); const lignes = doc.splitTextToSize(pdfTexteSain(String(valeur)), L - 48); doc.text(lignes, MX + 48, y); y += Math.max(5.5, lignes.length * 4.8); };

  // bandeau
  doc.setFillColor(14, 19, 51); doc.rect(0, 0, 210, 24, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); T('KALEA', MX, 15);
  doc.setFontSize(11); T(trad('Rapport d\'intervention'), 195, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); T(UI.companyName || '', 195, 17, { align: 'right' });
  y = 36;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(14, 19, 51);
  T(tR('Intervention du {date}', { date: formatShortDateAvecAnnee(i.performed_at) }), MX, y); y += 8;

  titreSection(trad('Machine'));
  ligne(trad('Machine'), d.machine ? d.machine.name : '');
  ligne(trad('Identifiant'), d.machine && typeof identifiantAffiche === 'function' ? identifiantAffiche(d.machine) : '');
  ligne(trad('Catégorie'), d.machine && d.machine.category ? d.machine.category.name : '');

  titreSection(trad('Intervention'));
  ligne(trad('Date'), formatShortDateAvecAnnee(i.performed_at));
  if (i.hours_at_intervention != null) ligne(trad('Compteur'), String(i.hours_at_intervention) + (d.machine && typeof counterUnitOf === 'function' ? ' ' + counterShort(counterUnitOf(d.machine)) : ''));
  ligne(trad('Intervenant'), i.performed_by && d.noms.has(i.performed_by) ? d.noms.get(i.performed_by) : '');
  ligne(trad('Travaux réalisés'), Array.isArray(i.items_done) && i.items_done.length ? i.items_done.join(', ') : '');
  ligne(trad('Remarques'), i.description);

  if (d.pieces.length) {
    titreSection(trad('Pièces'));
    d.pieces.forEach((p) => { besoin(6); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(14, 19, 51); T(pdfTexteSain(p.designation || ''), MX, y); T('x ' + String(p.quantity), MX + L, y, { align: 'right' }); y += 5.5; });
  }

  titreSection(trad('Signatures'));
  if (!d.signatures.length) { doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(100, 108, 130); T(trad('Cette intervention n\'a pas été signée.'), MX, y); y += 6; }
  d.signatures.forEach((s) => {
    besoin(44);
    doc.setDrawColor(200, 205, 220); doc.setLineWidth(0.3); doc.roundedRect(MX, y, L, 38, 2, 2);
    try { doc.addImage(s.image, 'PNG', MX + 4, y + 4, 62, 24); } catch (err) { doc.setFontSize(8); T(trad('(image de signature illisible)'), MX + 4, y + 14); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 19, 51); T(s.nom, MX + 72, y + 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 66, 90);
    T((SIG_ROLES()[s.role] || s.role) + (s.fonction ? ' - ' + s.fonction : ''), MX + 72, y + 15);
    T(sigDate(s.signe_a), MX + 72, y + 21);
    doc.setFontSize(7); doc.setTextColor(120, 126, 150); T('SHA-256 ' + s.empreinte.slice(0, 32), MX + 72, y + 28); T(s.empreinte.slice(32), MX + 72, y + 32);
    y += 43;
  });

  if (d.avenants.length) {
    titreSection(tR('Avenants ({n})', { n: d.avenants.length }));
    d.avenants.forEach((a) => {
      besoin(22); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100, 108, 130); T(sigDate(a.cree_a) + ' - ' + a.auteur_nom, MX, y); y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 19, 51); T(a.motif, MX, y); y += 5;
      doc.setFont('helvetica', 'normal'); const l = doc.splitTextToSize(pdfTexteSain(a.correction), L); doc.text(l, MX, y); y += l.length * 4.8 + 3;
    });
  }

  if (d.signatures.length) {
    titreSection(trad('Intégrité'));
    const v = d.verification;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    if (v && v.integre) { doc.setTextColor(4, 120, 87); T(trad('Vérifié : le contenu est identique à celui qui a été signé.'), MX, y); }
    else if (v) { doc.setTextColor(185, 28, 28); T(trad('ATTENTION : le contenu a été modifié depuis la signature (voir les avenants).'), MX, y); }
    else { doc.setTextColor(100, 108, 130); T(trad('Vérification non disponible au moment de la génération.'), MX, y); }
    y += 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 108, 130); T(tR('Rapport généré le {date}.', { date: sigDate(new Date().toISOString()) }), MX, y); y += 5;
  }

  // pied de page : mention + pagination
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 126, 150);
    const mention = doc.splitTextToSize(pdfTexteSain(trad('Signature électronique simple (règlement européen eIDAS) : preuve de suivi interne, qui ne remplace pas une signature qualifiée.')), L - 25);
    doc.text(mention, MX, 288);
    T(tR('Page {p} / {n}', { p, n: pages }), MX + L, 288, { align: 'right' });
  }
  const nomMachine = (d.machine ? d.machine.name : 'machine').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
  return { blob: doc.output('blob'), nomFichier: `rapport_intervention_${nomMachine}_${String(i.performed_at).slice(0, 10)}.pdf` };
}

// ── L'historique des entretiens (fiche machine) : colonne « Signature » et bouton « Rapport » ──
async function brancherSignaturesHistorique(section, interventions) {
  if (!signaturesActif() || !section || !interventions || !interventions.length) return;
  const ids = interventions.map((h) => h.id).filter(Boolean);
  let parInter = new Map();
  try {
    const { data, error } = await sb.from('intervention_signatures').select('intervention_id, role').in('intervention_id', ids);
    if (error) throw error;
    (data || []).forEach((s) => { if (!parInter.has(s.intervention_id)) parInter.set(s.intervention_id, []); parInter.get(s.intervention_id).push(s.role); });
  } catch (err) { /* hors connexion : on affiche seulement le bouton « Rapport » */ }
  section.querySelectorAll('[data-sig-cellule]').forEach((cellule) => {
    const id = cellule.getAttribute('data-sig-cellule');
    const roles = parInter.get(id) || [];
    const etat = roles.length ? `<span class="ui-statut is-ok">${roles.length > 1 ? trad('Signée ×2') : trad('Signée')}</span>` : `<span class="ui-statut">${trad('Non signée')}</span>`;
    cellule.innerHTML = `<div class="sig-cellule">${etat}<button type="button" class="ui-btn ui-btn-pastille" data-sig-rapport="${esc(id)}">${trad('Rapport')}</button></div>`;
  });
  if (!section.__sigBranche) {
    section.__sigBranche = true;
    section.addEventListener('click', (e) => { const b = e.target.closest('[data-sig-rapport]'); if (b) ouvrirRapportIntervention(b.getAttribute('data-sig-rapport')); });
  }
}

// ── Le réglage « Exiger la signature » (page Ordres de travail, gérant, Enterprise) ──
function blocReglageSignatureHtml() {
  if (!signaturesActif() || UI.role !== 'gerant') return '';
  return `<div class="ui-groupe ot-validation" id="sig-reglage">
    <label class="check-row"><input type="checkbox" id="sig-requise" ${UI.signatureRequise ? 'checked' : ''} disabled> ${trad('Exiger la signature de l\'exécutant après chaque intervention')}</label>
    <div class="ui-aide">${trad('Désactivé par défaut. Activé, la fenêtre de signature s\'ouvre juste après chaque intervention enregistrée ; sinon on signe à la demande depuis l\'historique de la machine.')}</div>
    <div class="ui-aide" id="sig-requise-msg" role="status" aria-live="polite"></div>
  </div>`;
}
async function brancherReglageSignature(root) {
  const c = root && root.querySelector('#sig-requise');
  if (!c) return;
  await chargerReglageSignature();
  c.checked = UI.signatureRequise === true; c.disabled = false;
  c.addEventListener('change', async () => {
    const voulu = c.checked; const msg = root.querySelector('#sig-requise-msg');
    c.disabled = true;
    const { error } = await sb.rpc('definir_signature_requise', { p_actif: voulu });
    c.disabled = false;
    if (error) { c.checked = !voulu; msg.textContent = trad('Réglage impossible pour le moment.'); return; }
    UI.signatureRequise = voulu;
    msg.textContent = voulu ? trad('Signature exigée : elle sera demandée après chaque intervention.') : trad('Signature non exigée : on signe à la demande.');
  });
}
