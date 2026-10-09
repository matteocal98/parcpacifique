/* KALEA — application (app.html) : Accès à la base, pdf.js, QR codes, photos, inscription et invitations, offres.
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · Initialisation Supabase
 *   · pdf.js EMBARQUÉ, chargé en local
 *   · QR CODES (génération + scan) — mêmes bibliothèques VENDUES localement,
 *   · LA PHOTO CHOISIE PAR LE CLIENT
 *   · LA FILE D'ATTENTE DES PHOTOS (hors connexion)
 */
// ───────────────────────── début du code ─────────────────────────
// ── Initialisation Supabase ───────────────────────────────────
// Si le CDN est bloqué, on affiche une erreur claire au lieu de rester bloqué
// indéfiniment sur « Chargement… ».
let sb = null;
try {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error(trad('bibliothèque Supabase non chargée (CDN inaccessible)'));
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (err) {
  app.innerHTML = `
    <div class="empty">
      <strong>${trad('Impossible de charger l\'application.')}</strong><br>
      ${esc(err.message)}<br><br>
      ${trad('Vérifie ta connexion internet puis recharge la page.')}<br><br>
      <button type="button" class="primary" id="fatal-retry" style="max-width:220px;margin:0 auto;">${trad('Réessayer')}</button>
    </div>`;
  const retryBtn = document.getElementById('fatal-retry');
  if (retryBtn) retryBtn.addEventListener('click', () => window.location.reload());
}

// ── pdf.js EMBARQUÉ, chargé en local ──────────────────────────────────
// POURQUOI EN LOCAL : l'application promet de fonctionner HORS CONNEXION, et le
// repérage des pages d'un carnet en dépend. Chargée depuis un CDN, la
// bibliothèque manquait dès que le réseau manquait — et la panne était muette.
// Les deux fichiers vivent à côté de la page (`vendor/`), copiés tels quels
// depuis la version 3.11.174 (licence Apache 2.0, voir vendor/pdf.js.LICENSE.txt).
const PDFJS_URL = "vendor/pdf.min.js";
const PDFJS_WORKER_URL = "vendor/pdf.worker.min.js";

let pdfLibPromise = null;
function loadPdfLib() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfLibPromise) {
    pdfLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PDFJS_URL;
      s.onload = () => (window.pdfjsLib ? resolve(window.pdfjsLib) : reject(new Error("pdf.js indisponible")));
      s.onerror = () => reject(new Error(trad('téléchargement de pdf.js impossible')));
      document.head.appendChild(s);
    });
    pdfLibPromise.catch(() => { pdfLibPromise = null; });
  }
  return pdfLibPromise;
}

let pdfWorkerReady = null;
function ensurePdfWorker() {
  if (!pdfWorkerReady) {
    const p = loadPdfLib()
      .then(() => fetch(PDFJS_WORKER_URL))
      .then(resp => {
        if (!resp.ok) throw new Error(trad('worker pdf.js introuvable'));
        return resp.text();
      })
      .then(code => {
        const blob = new Blob([code], { type: 'application/javascript' });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      });
    // En cas d'échec on réarme, sinon le rejet resterait mémorisé pour toujours.
    pdfWorkerReady = p.catch(err => { pdfWorkerReady = null; throw err; });
  }
  return pdfWorkerReady;
}

async function renderPdfFirstPageAsBlob(file) {
  await ensurePdfWorker();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

// ── QR CODES (génération + scan) — mêmes bibliothèques VENDUES localement,
// chargées à la demande, même patron que loadPdfLib() ci-dessus : jamais un
// CDN, jamais chargé tant que personne n'ouvre la section QR d'une fiche ou
// le scanner. Deux bibliothèques distinctes et volontairement indépendantes :
// `qrcode` (génération, vendor/qrcode.min.js) et `jsQR` (décodage de secours,
// vendor/jsqr.min.js — utilisé seulement si `BarcodeDetector` natif est
// absent du navigateur/WebView, voir ouvrirScannerQr()).
const QRCODE_URL = "vendor/qrcode.min.js";
let qrCodeLibPromise = null;
function loadQrCodeLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (!qrCodeLibPromise) {
    qrCodeLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = QRCODE_URL;
      s.onload = () => (window.qrcode ? resolve(window.qrcode) : reject(new Error("qrcode.js indisponible")));
      s.onerror = () => reject(new Error(trad('Téléchargement du générateur de QR code impossible.')));
      document.head.appendChild(s);
    });
    qrCodeLibPromise.catch(() => { qrCodeLibPromise = null; });
  }
  return qrCodeLibPromise;
}

const JSQR_URL = "vendor/jsqr.min.js";
let jsQrLibPromise = null;
function loadJsQrLib() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (!jsQrLibPromise) {
    jsQrLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSQR_URL;
      s.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error("jsQR indisponible")));
      s.onerror = () => reject(new Error(trad('Téléchargement du lecteur de QR code impossible.')));
      document.head.appendChild(s);
    });
    jsQrLibPromise.catch(() => { jsQrLibPromise = null; });
  }
  return jsQrLibPromise;
}

// Générateur du rapport TCO (PDF) — vendorisé localement, chargé à la
// demande, même politique que pdf.js/jsQR ci-dessus : jamais au démarrage,
// seulement au clic sur « Rapport TCO (PDF) »/« Télécharger »/« Envoyer ».
const JSPDF_URL = "vendor/jspdf.umd.min.js";
let jsPdfLibPromise = null;
function loadJsPdfLib() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jsPdfLibPromise) {
    jsPdfLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSPDF_URL;
      s.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error("jsPDF indisponible")));
      s.onerror = () => reject(new Error(trad('Téléchargement du générateur de PDF impossible.')));
      document.head.appendChild(s);
    });
    jsPdfLibPromise.catch(() => { jsPdfLibPromise = null; });
  }
  return jsPdfLibPromise;
}

// ══════════════════════════════════════════════════════════════════════════
// ★ RAPPORT TCO — rendu PDF. Consomme uniquement `assemblerDonneesRapportTco`
// (calculs purs, voir plus haut) : aucun chiffre n'est recalculé ici.

// Les polices intégrées de jsPDF sont en WinAnsiEncoding. formatMontant()
// produit U+202F (espace fine insécable, séparateur de milliers en fr-FR),
// absente de cette table — sans cette normalisation, TOUS les montants du
// rapport sortent avec un caractère cassé. Un seul point de passage, pour
// qu'aucun appel à doc.text() ne puisse l'oublier.
function pdfTexteSain(v) {
  return String(v ?? '')
    .replace(/[    ]/g, ' ')
    .replace(/[‑‒–—−]/g, '-');
}

// Donut du parc → PNG, pour l'embarquer dans le PDF. Réutilise
// donutTcoSvgHtml() TELLE QUELLE (zéro divergence visuelle avec l'écran) :
// insérée hors-écran dans le DOM RÉEL (pas un document isolé) pour que les
// var(--bleu-roi)/var(--ok)/var(--late) se résolvent via getComputedStyle —
// un SVG sérialisé isolément n'hérite rien du :root de la page, les arcs
// seraient sinon invisibles.
async function donutTcoPngDataUri(repartition, taillePx = 400) {
  if (!repartition) return null;
  const hote = document.createElement('div');
  hote.style.cssText = 'position:fixed;left:-99999px;top:0;';
  hote.setAttribute('aria-hidden', 'true');
  hote.innerHTML = donutTcoSvgHtml(repartition, taillePx);
  document.body.appendChild(hote);
  try {
    const svg = hote.querySelector('svg');
    if (!svg) return null;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(taillePx));
    svg.setAttribute('height', String(taillePx));
    const racine = getComputedStyle(document.documentElement);
    svg.querySelectorAll('[stroke]').forEach((el) => {
      const val = el.getAttribute('stroke');
      const m = val && /^var\((--[a-z0-9-]+)\)$/i.exec(val.trim());
      if (m) {
        const resolu = racine.getPropertyValue(m[1]).trim();
        if (resolu) el.setAttribute('stroke', resolu);
      }
    });
    const source = new XMLSerializer().serializeToString(svg);
    // jamais btoa (limite Latin-1) : un data URI SVG encodé en URI, pas en base64.
    const uriSvg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Rendu du donut impossible.'));
      img.src = uriSvg;
    });
    const canvas = document.createElement('canvas');
    canvas.width = taillePx;
    canvas.height = taillePx;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, taillePx, taillePx);
    ctx.drawImage(image, 0, 0, taillePx, taillePx);
    return canvas.toDataURL('image/png');
  } finally {
    hote.remove();
  }
}

// Graphique à barres groupées — dessiné nativement (rect/line), aucun SVG.
// `series` : { carburant:[], pieces:[], mainOeuvreEtFrais:[] }, une valeur
// par trimestre. Mêmes 3 couleurs que le donut (bleu roi/sarcelle/ambre).
const PDF_COULEUR_PIECES = [35, 111, 224];
const PDF_COULEUR_MAIN_OEUVRE = [36, 181, 168];
const PDF_COULEUR_FIXES = [222, 122, 22];
function pdfBarresGroupees(doc, { x, y, largeur, hauteur, trimestres, series, T }) {
  const n = trimestres.length;
  const cles = ['carburant', 'pieces', 'mainOeuvreEtFrais'];
  const couleurs = [PDF_COULEUR_FIXES, PDF_COULEUR_PIECES, PDF_COULEUR_MAIN_OEUVRE];
  const max = Math.max(1, ...cles.flatMap((c) => series[c]));
  const largeurGroupe = largeur / n;
  const gap = largeurGroupe * 0.12;
  const largeurBarre = (largeurGroupe - gap * 2) / 3;

  doc.setDrawColor(225, 225, 230);
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 130);
  for (let g = 0; g <= 2; g++) {
    const valeur = (max / 2) * g;
    const gy = y + hauteur - (valeur / max) * hauteur;
    doc.line(x, gy, x + largeur, gy);
    T(doc, montantAbrege(valeur), x - 2, gy + 1, { align: 'right' });
  }

  trimestres.forEach((t, i) => {
    const gx = x + i * largeurGroupe + gap;
    cles.forEach((cle, ci) => {
      const valeur = series[cle][i] || 0;
      const h = (valeur / max) * hauteur;
      doc.setFillColor(...couleurs[ci]);
      if (h > 0) doc.rect(gx + ci * largeurBarre, y + hauteur - h, Math.max(largeurBarre - 0.6, 0.1), h, 'F');
    });
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 70);
    T(doc, t.label + (t.enCours ? ` (${trad('en cours')})` : ''), x + i * largeurGroupe + largeurGroupe / 2, y + hauteur + 5, { align: 'center' });
  });

  doc.setDrawColor(180, 180, 190);
  doc.line(x, y + hauteur, x + largeur, y + hauteur);

  const legendes = [
    [trad('Carburant'), PDF_COULEUR_FIXES],
    [trad('Pièces'), PDF_COULEUR_PIECES],
    [trad('Main d\'œuvre & frais fixes'), PDF_COULEUR_MAIN_OEUVRE],
  ];
  let lx = x;
  const ly = y + hauteur + 12;
  doc.setFontSize(7.5);
  legendes.forEach(([libelle, couleur]) => {
    doc.setFillColor(...couleur);
    doc.rect(lx, ly - 2.5, 3, 3, 'F');
    doc.setTextColor(60, 60, 70);
    T(doc, libelle, lx + 4.5, ly);
    lx += 4.5 + doc.getTextWidth(pdfTexteSain(libelle)) + 8;
  });
}

// Tableau dessiné à la main — pas de plugin jspdf-autotable (dépendance
// évitée pour des tableaux de quelques lignes). Pagination automatique :
// `onNouvellePage(doc)` est appelé juste après doc.addPage(), pour que
// l'appelant réimprime l'en-tête DE PAGE (pdfEnTete) avant que le tableau ne
// réimprime son propre en-tête de colonnes.
function pdfTableau(doc, { x, y, largeurs, entetes, lignes, alignements = [], hauteurLigne = 6, zebra = true, sousLignes = null, margeBasse = 278, onNouvellePage, T }) {
  const largeurTotale = largeurs.reduce((a, b) => a + b, 0);
  let py = y;
  const dessinerEntete = () => {
    doc.setFillColor(240, 240, 245);
    doc.rect(x, py, largeurTotale, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(20, 19, 51);
    let cx = x;
    entetes.forEach((h, i) => {
      const align = alignements[i] || 'left';
      const tx = align === 'right' ? cx + largeurs[i] - 1.5 : cx + 1.5;
      T(doc, h, tx, py + 4.8, { align });
      cx += largeurs[i];
    });
    py += 7;
  };
  dessinerEntete();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  lignes.forEach((ligne, i) => {
    const sousLigne = sousLignes ? sousLignes[i] : null;
    const hLigne = hauteurLigne + (sousLigne ? 4 : 0);
    if (py + hLigne > margeBasse) {
      doc.addPage();
      py = 28;
      if (onNouvellePage) onNouvellePage(doc);
      dessinerEntete();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }
    if (zebra && i % 2 === 1) {
      doc.setFillColor(248, 248, 251);
      doc.rect(x, py, largeurTotale, hLigne, 'F');
    }
    let cx = x;
    doc.setTextColor(14, 19, 51);
    ligne.forEach((valeur, ci) => {
      const align = alignements[ci] || 'left';
      const tx = align === 'right' ? cx + largeurs[ci] - 1.5 : cx + 1.5;
      T(doc, String(valeur), tx, py + 4.2, { align });
      cx += largeurs[ci];
    });
    if (sousLigne) {
      doc.setFontSize(7);
      doc.setTextColor(...(sousLigne.couleur || [100, 100, 100]));
      const texte = doc.splitTextToSize(pdfTexteSain(sousLigne.texte), largeurTotale - 3);
      doc.text(texte[0] || '', x + 1.5, py + hauteurLigne + 2.2);
      doc.setFontSize(8);
      doc.setTextColor(14, 19, 51);
    }
    doc.setDrawColor(230, 230, 235);
    doc.line(x, py + hLigne, x + largeurTotale, py + hLigne);
    py += hLigne;
  });
  return py;
}

function pdfEnTete(doc, donnees, T) {
  doc.setFillColor(14, 19, 51);
  doc.rect(0, 0, 210, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  T(doc, donnees.societe, 15, 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  T(doc, tR('Rapport TCO — {periode} — {devise}', { periode: donnees.periodeLabel, devise: donnees.devise }), 195, 11.5, { align: 'right' });
  doc.setTextColor(14, 19, 51);
}
function pdfPiedDePage(doc, donnees, n, total, T) {
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 150);
  doc.setFont('helvetica', 'normal');
  T(doc, tR('Page {n}/{total}', { n, total }), 15, 292);
  T(doc, tR('Généré par KALEA le {date} — chiffres calculés sur les données enregistrées par {societe}.', { date: formatShortDateAvecAnnee(donnees.dateIso), societe: donnees.societe }), 195, 292, { align: 'right' });
}
function pdfCarteKpi(doc, x, y, l, h, { eyebrow, valeur, sub1, sub2 }, T) {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, l, h, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(100, 105, 120);
  doc.setFont('helvetica', 'bold');
  T(doc, String(eyebrow).toUpperCase(), x + 4, y + 6);
  doc.setFontSize(14);
  doc.setTextColor(14, 19, 51);
  doc.setFont('helvetica', 'bold');
  T(doc, valeur, x + 4, y + 15);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 95, 110);
  if (sub1) T(doc, sub1, x + 4, y + 21);
  if (sub2) T(doc, sub2, x + 4, y + 25.5);
}

// Le générateur — 3 pages A4 portrait. `donnees` = retour de
// assemblerDonneesRapportTco(). Explicitement ABSENT du rapport (aucune
// donnée ne le porte honnêtement) : le paragraphe « Analyse de la
// Direction », toute comparaison N-1, les causes de panne par machine, les
// recommandations pour un trimestre futur ou un montant d'économie chiffré,
// une courbe de tendance/prévision — voir keeva-tco-feature.
async function genererRapportTcoPdf(donnees) {
  const jsPDF = await loadJsPdfLib();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const T = (d, s, x, y, o) => d.text(pdfTexteSain(s), x, y, o);
  const MX = 15;
  const LARGEUR = 180;

  // ── PAGE 1 — SYNTHÈSE ──────────────────────────────────────────────
  pdfEnTete(doc, donnees, T);
  let y = 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(14, 19, 51);
  T(doc, trad('Synthèse exécutive du parc'), MX, y);
  y += 10;

  const largeurCarte = (LARGEUR - 10) / 3;
  const g = donnees.global;
  if (g) {
    const baseTexte = g.base === 'depreciation'
      ? trad('CAPEX = dépréciation annuelle au prorata')
      : trad('CAPEX = capital consommé depuis l\'achat');
    pdfCarteKpi(doc, MX, y, largeurCarte, 30, {
      eyebrow: tR('TCO global — {periode}', { periode: donnees.periodeLabel }),
      valeur: formatMontant(g.total, donnees.devise),
      sub1: tR('CAPEX {c} % · OPEX {o} %', { c: Math.round(g.pctCapex), o: Math.round(g.pctOpex) }),
      sub2: baseTexte,
    }, T);
  } else {
    pdfCarteKpi(doc, MX, y, largeurCarte, 30, { eyebrow: trad('TCO global'), valeur: '—', sub1: trad('Aucune dépense enregistrée sur la période.') }, T);
  }

  const cu = donnees.coutUsage.parUnite.get(donnees.coutUsage.uniteDominante);
  if (cu && cu.reel != null) {
    pdfCarteKpi(doc, MX + largeurCarte + 5, y, largeurCarte, 30, {
      eyebrow: trad('Coût réel moyen / usage'),
      valeur: `${formatMontant(cu.reel, donnees.devise)} /${cu.uniteCourte}`,
      sub1: cu.cible != null
        ? tR('Cible pondérée {c} — écart {s}{e} %', { c: formatMontant(cu.cible, donnees.devise), s: cu.ecart >= 0 ? '+' : '', e: Math.round(cu.ecartPct) })
        : trad('Aucun seuil cible défini sur les catégories concernées'),
    }, T);
  } else {
    pdfCarteKpi(doc, MX + largeurCarte + 5, y, largeurCarte, 30, { eyebrow: trad('Coût réel moyen / usage'), valeur: '—', sub1: trad('Aucun relevé de compteur disponible.') }, T);
  }

  const dep = donnees.depassements;
  pdfCarteKpi(doc, MX + (largeurCarte + 5) * 2, y, largeurCarte, 30, {
    eyebrow: trad('Machines hors cible'),
    valeur: String(dep.nb),
    sub1: dep.nb ? tR('Écart cumulé : {m}', { m: formatMontant(dep.ecartCumuleTotal, donnees.devise) }) : trad('Aucune machine au-dessus du seuil de sa catégorie.'),
    sub2: dep.nb ? trad('Coût mesuré depuis la mise en service') : '',
  }, T);

  y += 38;

  if (donnees.repartition) {
    const pngUri = await donutTcoPngDataUri(donnees.repartition, 400);
    if (pngUri) doc.addImage(pngUri, 'PNG', MX, y, 50, 50);
    const r = donnees.repartition;
    let ly = y + 6;
    const lx = MX + 58;
    const legendeLigne = (libelle, valeur, pct, couleur) => {
      doc.setFillColor(...couleur);
      doc.rect(lx, ly - 3, 3, 3, 'F');
      doc.setFontSize(8.5);
      doc.setTextColor(14, 19, 51);
      doc.setFont('helvetica', 'normal');
      T(doc, `${libelle} — ${formatMontant(valeur, donnees.devise)} (${Math.round(pct)} %)`, lx + 5, ly);
      ly += 7;
    };
    legendeLigne(trad('Pièces'), r.pieces, r.pctPieces, PDF_COULEUR_PIECES);
    legendeLigne(trad('Main d\'œuvre'), r.mainOeuvre, r.pctMainOeuvre, PDF_COULEUR_MAIN_OEUVRE);
    legendeLigne(trad('Frais fixes & carburant'), r.fixes, r.pctFixes, PDF_COULEUR_FIXES);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 130);
    T(doc, tR('Dépenses d\'exploitation (OPEX) — {periode}', { periode: donnees.periodeLabel }), lx, ly + 2);
    y += 56;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 130);
    T(doc, trad('Aucune dépense d\'exploitation enregistrée sur la période : pas de répartition à afficher.'), MX, y + 6);
    y += 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(14, 19, 51);
  T(doc, trad('Synthèse'), MX, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 40);
  const phrases = [];
  if (g) {
    phrases.push(tR('Sur {periode}, le coût total de possession du parc suivi s\'élève à {total}, dont {capex} de dépréciation/capital et {opex} de dépenses d\'exploitation.', { periode: donnees.periodeLabel.toLowerCase(), total: formatMontant(g.total, donnees.devise), capex: formatMontant(g.capex, donnees.devise), opex: formatMontant(g.opex, donnees.devise) }));
  }
  phrases.push(tR('{n} machine(s) sont suivies avec un prix d\'achat renseigné.', { n: donnees.extrait.length }));
  if (donnees.repartition) {
    const r = donnees.repartition;
    phrases.push(tR('Les dépenses d\'exploitation se répartissent en {p} % de pièces, {m} % de main d\'œuvre et {f} % de frais fixes, pour {h} h de main d\'œuvre déclarées.', { p: Math.round(r.pctPieces), m: Math.round(r.pctMainOeuvre), f: Math.round(r.pctFixes), h: Math.round(r.heures) }));
  }
  phrases.push(tR('{n} machine(s) dépassent le seuil de coût horaire fixé pour leur catégorie.', { n: dep.nb }));
  if (donnees.flotte) {
    phrases.push(tR('Ratio moyen entretien/dépréciation du parc : {label}.', { label: tendanceRatioMoyenFlotte(donnees.flotte).label }));
  }
  phrases.forEach((p) => {
    const lignes = doc.splitTextToSize(pdfTexteSain(p), LARGEUR - 4);
    lignes.forEach((l) => { doc.text(l, MX + 2, y); y += 4.5; });
    y += 1.5;
  });

  // ── PAGE 2 — ÉVOLUTION + MACHINES HORS CIBLE ────────────────────────
  doc.addPage();
  pdfEnTete(doc, donnees, T);
  y = 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(14, 19, 51);
  T(doc, trad('Évolution trimestrielle des dépenses d\'exploitation'), MX, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 130);
  T(doc, trad('Le dernier trimestre est en cours (partiel).'), MX, y);
  y += 6;

  if (donnees.trimestres.vide) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 130);
    T(doc, trad('Aucune dépense datée sur les 4 derniers trimestres.'), MX, y + 10);
    y += 20;
  } else {
    pdfBarresGroupees(doc, { x: MX, y, largeur: LARGEUR, hauteur: 55, trimestres: donnees.trimestres.trimestres, series: donnees.trimestres.series, T });
    y += 80;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(14, 19, 51);
  T(doc, tR('{n} machine(s) au-dessus du seuil cible de leur catégorie', { n: dep.nb }), MX, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 130);
  T(doc, trad('Coût horaire mesuré depuis la mise en service.'), MX, y);
  y += 6;

  if (dep.nb) {
    const largeursDep = [42, 26, 26, 24, 22, 30];
    const entetesDep = [trad('Machine'), trad('Catégorie'), trad('Coût réel'), trad('Seuil'), trad('Écart %'), trad('Écart cumulé')];
    const alignementsDep = ['left', 'left', 'right', 'right', 'right', 'right'];
    const lignesDep = dep.liste.map((l) => [
      l.machine.name,
      l.machine.category?.name || '—',
      `${formatMontant(l.coutReel, donnees.devise)}/${l.uniteCourte}`,
      `${formatMontant(l.seuil, donnees.devise)}/${l.uniteCourte}`,
      l.ecartPct != null ? `+${Math.round(l.ecartPct)} %` : '—',
      l.ecartCumule != null ? formatMontant(l.ecartCumule, donnees.devise) : '—',
    ]);
    const sousLignesDep = dep.liste.map((l) => ({
      texte: l.recommandation,
      couleur: l.severite === 'critique' ? [186, 26, 26] : l.severite === 'eleve' ? [222, 122, 22] : [36, 181, 168],
    }));
    y = pdfTableau(doc, { x: MX, y, largeurs: largeursDep, entetes: entetesDep, lignes: lignesDep, alignements: alignementsDep, sousLignes: sousLignesDep, onNouvellePage: (d) => pdfEnTete(d, donnees, T), T });
    if (dep.resteNonListe > 0) {
      y += 4;
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 130);
      T(doc, tR('{n} autre(s) machine(s) au-dessus du seuil, non listée(s) ici.', { n: dep.resteNonListe }), MX, y);
    }
  }

  // ── PAGE 3 — EXTRAIT PAR MACHINE + MÉTHODOLOGIE ─────────────────────
  doc.addPage();
  pdfEnTete(doc, donnees, T);
  y = 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(14, 19, 51);
  T(doc, trad('Extrait de données par machine'), MX, y);
  y += 7;

  const largeursE = [34, 22, 16, 20, 18, 18, 18, 18, 20];
  const entetesE = [trad('Machine'), trad('Achat'), trad('Amort.'), trad('Seuil'), trad('Pièces'), trad('MO'), trad('Frais fixes'), trad('Carburant'), trad('TCO/unité')];
  const alignementsE = ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'];
  const lignesE = donnees.extrait.map(({ machine, tco, pieces, mainOeuvre, fraisFixes, carburant }) => {
    const uc = counterShort(counterUnitOf(machine));
    return [
      machine.name,
      machine.purchase_price != null ? formatMontant(machine.purchase_price, donnees.devise) : '—',
      machine.amortization_years != null ? tR('{n} ans', { n: machine.amortization_years }) : '—',
      machine.category?.target_hourly_cost != null ? `${formatMontant(machine.category.target_hourly_cost, donnees.devise)}/${uc}` : '—',
      formatMontant(pieces, donnees.devise),
      formatMontant(mainOeuvre, donnees.devise),
      formatMontant(fraisFixes, donnees.devise),
      formatMontant(carburant, donnees.devise),
      tco.coutParUnite != null ? `${formatMontant(tco.coutParUnite, donnees.devise)}/${uc}` : '—',
    ];
  });
  y = pdfTableau(doc, { x: MX, y, largeurs: largeursE, entetes: entetesE, lignes: lignesE, alignements: alignementsE, onNouvellePage: (d) => pdfEnTete(d, donnees, T), T });
  y += 8;

  if (y > 250) { doc.addPage(); pdfEnTete(doc, donnees, T); y = 28; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(14, 19, 51);
  T(doc, trad('Méthodologie de calcul'), MX, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 70);
  const methodo = [
    trad('TCO total (machine) = prix d\'achat + entretien cumulé (pièces + main d\'œuvre) + coûts d\'exploitation − revente estimée.'),
    trad('Coût par unité d\'usage = TCO total / relevé du compteur (heures ou km).'),
    trad('Dépréciation annuelle = (prix d\'achat − revente estimée) / durée d\'amortissement.'),
    trad('Ratio garder/remplacer = entretien annualisé / dépréciation annuelle ; repli sur entretien cumulé / prix d\'achat quand la durée d\'amortissement n\'est pas renseignée (la base retenue est alors indiquée).'),
    trad('Seuils d\'alerte = 50 % puis 100 % de la dépréciation annuelle ; 30 % puis 50 % du prix d\'achat en mode repli.'),
    trad('Dépassement de seuil = coût par unité d\'usage supérieur au seuil cible de la catégorie de la machine.'),
    tR('CAPEX de la période = dépréciation annuelle × durée de la fenêtre ; capital consommé (achat − revente) pour « {label} ».', { label: trad('Depuis mise en service') }),
    tR('Devise = {devise}, parité fixe 1 EUR = {parite} XPF.', { devise: donnees.devise, parite: PARITE_EUR_XPF.toLocaleString(localeActive()) }),
  ];
  methodo.forEach((m) => {
    if (y > 278) { doc.addPage(); pdfEnTete(doc, donnees, T); y = 28; }
    const lignesM = doc.splitTextToSize(pdfTexteSain(m), LARGEUR - 4);
    lignesM.forEach((l) => { doc.text(l, MX + 2, y); y += 3.6; });
    y += 1;
  });

  y += 3;
  if (y > 270) { doc.addPage(); pdfEnTete(doc, donnees, T); y = 28; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(14, 19, 51);
  T(doc, trad('Exclusions'), MX, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 95, 110);
  const ex = donnees.exclusions;
  const exValeurs = [ex.sansPrixAchat, ex.sansDuree, ex.sansSeuil, ex.ignorees];
  const exPhrases = [
    tR('{n} machine(s) sans prix d\'achat renseigné, exclue(s) du rapport.', { n: ex.sansPrixAchat }),
    tR('{n} machine(s) sans durée d\'amortissement renseignée, exclue(s) du calcul du CAPEX de la période.', { n: ex.sansDuree }),
    tR('{n} catégorie(s) sans seuil de coût horaire cible.', { n: ex.sansSeuil }),
    tR('{n} ligne(s) de coût sans date, exclue(s) du graphique trimestriel.', { n: ex.ignorees }),
  ].filter((_, i) => exValeurs[i] > 0);
  if (!exPhrases.length) exPhrases.push(trad('Aucune exclusion : toutes les machines et lignes de coût ont pu être exploitées.'));
  exPhrases.forEach((p) => {
    if (y > 278) { doc.addPage(); pdfEnTete(doc, donnees, T); y = 28; }
    const l = doc.splitTextToSize(pdfTexteSain(p), LARGEUR - 4);
    l.forEach((ligne) => { doc.text(ligne, MX + 2, y); y += 3.6; });
  });

  // Pied de page, posé en dernier sur CHAQUE page une fois le nombre total
  // de pages connu (peut dépasser 3 avec un grand parc — jamais un total
  // figé à 3).
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    pdfPiedDePage(doc, donnees, p, totalPages, T);
  }

  const blob = doc.output('blob');
  const arrayBuffer = doc.output('arraybuffer');
  const nomFichier = `rapport_tco_${todayIso()}.pdf`;
  return { blob, arrayBuffer, nomFichier };
}

// Envoi du rapport TCO par e-mail — même patron que envoyerGrosManuel() :
// corps BINAIRE (le PDF), jamais sb.functions.invoke (qui encapsule en JSON)
// — Edge Function côté serveur : envoyer-rapport-tco (non commitée dans ce
// dépôt, convention déjà établie pour toutes les Edge Functions du projet).
async function envoyerRapportTcoParEmail(arrayBuffer, destinataire, nomFichier, periodeLabel) {
  const { data: sessionData } = await sb.auth.getSession();
  const jeton = sessionData && sessionData.session ? sessionData.session.access_token : '';
  if (!jeton) throw new Error(trad('Session expirée : reconnecte-toi pour envoyer ce rapport.'));
  const reponse = await fetch(`${SUPABASE_URL}/functions/v1/envoyer-rapport-tco`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${jeton}`,
      // En-têtes HTTP = Latin-1 : on encode, comme envoyerGrosManuel() le
      // fait déjà pour son contexte JSON.
      'x-keeva-destinataire': encodeURIComponent(destinataire),
      'x-keeva-fichier': encodeURIComponent(nomFichier),
      'x-keeva-periode': encodeURIComponent(periodeLabel || ''),
      'x-keeva-langue': LANGUE,
    },
    body: arrayBuffer,
  });
  const texte = await reponse.text();
  let donnees = {};
  try { donnees = texte ? JSON.parse(texte) : {}; } catch { donnees = {}; }
  if (!reponse.ok || donnees.error) throw new Error(donnees.error || `envoi refusé (${reponse.status})`);
  return donnees;
}

// Modale « Rapport TCO (PDF) » — idiome maison exact (.overlay/.modal, voir
// openForgotPasswordModal) + accessibilité (role="dialog" aria-modal="true",
// voir afficherFenetreConfirmation). `contexte.donnees` est déjà assemblé
// (assemblerDonneesRapportTco) au moment de l'ouverture — le PDF n'est
// généré qu'au clic sur une des deux actions, jamais avant (pas de travail
// inutile si l'utilisateur ferme sans rien choisir).
function ouvrirRapportTcoModal(contexte) {
  const donnees = contexte.donnees;
  const overlay = document.createElement('div');
  overlay.className = 'overlay rapport-tco-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const emailDefaut = UI.company?.notification_email || '';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rapport-tco-titre">
      <h2 id="rapport-tco-titre">${trad('Rapport TCO (PDF)')}</h2>
      <p class="sub">${tR('Synthèse financière du parc sur la période affichée à l\'écran : {periode}.', { periode: esc(donnees.periodeLabel) })}</p>
      <label for="rapport-tco-email">${trad('Envoyer par e-mail à')}</label>
      <input id="rapport-tco-email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(trad('adresse@exemple.com'))}" value="${esc(emailDefaut)}">
      <div class="hint" id="rapport-tco-msg" role="status" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="secondary" id="rapport-tco-fermer">${trad('Fermer')}</button>
        <button type="button" class="secondary" id="rapport-tco-telecharger">${picto('export')}<span>${trad('Télécharger le rapport')}</span></button>
        <button type="button" class="primary" id="rapport-tco-envoyer">${picto('mail')}<span>${trad('Envoyer par e-mail')}</span></button>
      </div>
    </div>`;
  const msg = overlay.querySelector('#rapport-tco-msg');
  const btnFermer = overlay.querySelector('#rapport-tco-fermer');
  const btnTelecharger = overlay.querySelector('#rapport-tco-telecharger');
  const btnEnvoyer = overlay.querySelector('#rapport-tco-envoyer');
  const champEmail = overlay.querySelector('#rapport-tco-email');
  const dire = (texte, erreur) => {
    msg.textContent = texte;
    msg.style.color = erreur ? 'var(--late)' : 'var(--ok)';
  };
  const geler = (gele) => { btnTelecharger.disabled = gele; btnEnvoyer.disabled = gele; champEmail.disabled = gele; };

  btnFermer.addEventListener('click', () => overlay.remove());

  btnTelecharger.addEventListener('click', async () => {
    geler(true);
    dire(trad('Génération du rapport…'), false);
    try {
      const { blob, nomFichier } = await genererRapportTcoPdf(donnees);
      await telechargerFichierBinaire(blob, nomFichier, 'application/pdf');
      dire(trad('Téléchargement lancé.'), false);
    } catch (err) {
      dire(trad('Génération impossible : ') + (err?.message || err), true);
    } finally {
      geler(false);
    }
  });

  btnEnvoyer.addEventListener('click', async () => {
    const destinataire = champEmail.value.trim();
    if (!destinataire || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) {
      dire(trad('Adresse e-mail invalide.'), true);
      champEmail.focus();
      return;
    }
    geler(true);
    dire(trad('Génération du rapport…'), false);
    try {
      const { arrayBuffer, nomFichier } = await genererRapportTcoPdf(donnees);
      dire(trad('Envoi en cours…'), false);
      await envoyerRapportTcoParEmail(arrayBuffer, destinataire, nomFichier, donnees.periodeLabel);
      dire(tR('Rapport envoyé à {email}.', { email: destinataire }), false);
    } catch (err) {
      dire(trad('Envoi impossible : ') + (err?.message || err), true);
    } finally {
      geler(false);
    }
  });
}

// Les fiches de l'API qui ne sont pas disponibles hors connexion : une photo
// choisie pendant une coupure est gardée sur l'appareil, puis envoyée.
// (La recherche automatique de photo sur le web a été retirée le 2026-10-05 : trop chère pour des résultats
//  trop incertains. La photo vient du client — galerie, appareil photo — ou de la première page du carnet.)
const CLE_PHOTOS_ATTENTE = 'keeva.photos-en-attente.v1';

// ── LA PHOTO CHOISIE PAR LE CLIENT ────────────────────────────────────
// Deux boutons, et pas un seul : « Choisir une photo » ouvre la galerie ou le
// sélecteur de fichiers ; « Prendre une photo » ouvre l'appareil photo
// (capture="environment"). Les deux champs portent accept="image/*" : sur
// téléphone, le premier propose AUSSI l'appareil photo.
//
// Rien n'est envoyé depuis ici : la photo réduite va dans `_pendingPhotoBlob`
// (fiche machine) ou `state.pendingPhotoBlob` (assistant de création), et c'est
// l'enregistrement qui l'écrit — comme la première page du carnet.
function blocPhotoManuelle(options = {}) {
  const avecLabel = options.avecLabel !== false;
  const apercu = options.apercu || '#photo-manuelle-apercu';
  return `
    ${avecLabel ? `<label>${trad('Photo de la machine')}</label>` : ''}
    ${avecLabel ? `<div class="photo-apercu" id="photo-manuelle-apercu"></div>` : ''}
    <div class="photo-actions">
      <button type="button" class="secondary" id="pick-photo-btn">${trad('Choisir une photo')}</button>
      <button type="button" class="secondary" id="shoot-photo-btn">${trad('Prendre une photo')}</button>
    </div>
    <input id="f-machine-photo" type="file" accept="image/*" hidden>
    <input id="f-machine-photo-camera" type="file" accept="image/*" capture="environment" hidden>
    <div class="hint" id="photo-manuelle-statut"></div>`;
}

// Le câblage commun aux DEUX endroits (assistant de création et fiche machine).
// `surState` : l'objet à renseigner dans l'assistant ; sans lui, on écrit dans
// l'overlay (fiche machine), qui porte déjà `_pendingPhotoBlob`.
function brancherPhotoManuelle(overlay, options = {}) {
  const apercu = options.apercu || '#photo-manuelle-apercu';
  const statut = overlay.querySelector('#photo-manuelle-statut');
  const poserStatut = (texte) => { if (statut) statut.textContent = texte || ''; };

  const retenir = async (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      poserStatut(trad('Choisis une image : JPEG, PNG ou WebP.'));
      return;
    }
    poserStatut(trad('Préparation de la photo…'));
    try {
      // MÊME RÉDUCTION QUE LES PHOTOS DE CARNET (1600 px, JPEG) : une photo de
      // téléphone de 8 Mo n'a aucune raison d'être stockée telle quelle.
      const reduite = await reduirePhotoCarnet(file);
      overlay._pendingPhotoBlob = reduite.blob;
      // LA PHOTO CHOISIE REMPLACE CELLE DU WEB : une seule photo par machine, et
      // c'est le choix du client qui gagne. On efface donc l'URL trouvée, et on
      // décoche la recherche automatique de l'assistant.
      overlay._newImageUrl = null;
      if (options.surState) {
        options.surState.pendingPhotoBlob = reduite.blob;
        options.surState.photoManuelleUrl = reduite.url;
      }
      const zone = overlay.querySelector(apercu);
      if (zone) zone.innerHTML = `<img class="machine-photo" src="${reduite.url}" alt="">`;
      poserStatut(tR('Photo choisie : {largeur} px, {poids} Ko (au lieu de {origine} Ko). Elle remplacera la photo actuelle à l\'enregistrement.', {
        largeur: reduite.largeur,
        poids: Math.round(reduite.taille / 1024),
        origine: Math.round(reduite.tailleOrigine / 1024),
      }));
    } catch (err) {
      poserStatut(tR('Photo illisible ({erreur}). Essaie une autre image.', { erreur: (err && err.message) || err }));
    }
  };

  const champGalerie = overlay.querySelector('#f-machine-photo');
  const champCamera = overlay.querySelector('#f-machine-photo-camera');
  const boutonGalerie = overlay.querySelector('#pick-photo-btn');
  const boutonCamera = overlay.querySelector('#shoot-photo-btn');
  if (boutonGalerie && champGalerie) boutonGalerie.addEventListener('click', () => champGalerie.click());
  if (boutonCamera && champCamera) boutonCamera.addEventListener('click', () => champCamera.click());
  for (const champ of [champGalerie, champCamera]) {
    if (!champ) continue;
    champ.addEventListener('change', (e) => {
      const fichier = (e.target.files || [])[0] || null;
      e.target.value = '';
      retenir(fichier);
    });
  }
  // Une photo déjà choisie (retour en arrière dans l'assistant) reste affichée.
  const urlExistante = (options.surState && options.surState.photoManuelleUrl) || null;
  const zone = overlay.querySelector(apercu);
  if (urlExistante && zone && !zone.innerHTML.trim()) {
    zone.innerHTML = `<img class="machine-photo" src="${urlExistante}" alt="">`;
  }
  poserStatut(options.messageInitial || '');
  return { poserStatut };
}

// ── LA FILE D'ATTENTE DES PHOTOS (hors connexion) ─────────────────────
// MÊME PRINCIPE QUE LE RELEVÉ DE COMPTEUR : ce qui est fait sans réseau est
// gardé sur l'appareil, puis envoyé au retour du réseau. La photo est réduite
// (1600 px) AVANT d'être mise de côté : une photo brute de 8 Mo ne tient pas
// dans le stockage local.
function photosEnAttente() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_PHOTOS_ATTENTE) || '[]');
    return Array.isArray(brut) ? brut.filter((e) => e && e.machineId && e.dataUrl) : [];
  } catch (err) { return []; }
}

function ecrirePhotosEnAttente(liste) {
  try {
    localStorage.setItem(CLE_PHOTOS_ATTENTE, JSON.stringify(liste.slice(-5)));
    return true;
  } catch (err) {
    return false;
  }
}

function blobVersDataUrl(blob) {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result || ''));
    lecteur.onerror = () => rejeter(new Error(trad('lecture de la photo impossible')));
    lecteur.readAsDataURL(blob);
  });
}

// Renvoie true quand la photo a bien été mise de côté pour plus tard.
async function retenirPhotoEnAttente(machineId, blob) {
  try {
    const dataUrl = await blobVersDataUrl(blob);
    const liste = photosEnAttente().filter((e) => e.machineId !== machineId);
    liste.push({ machineId, dataUrl, quand: Date.now() });
    return ecrirePhotosEnAttente(liste);
  } catch (err) {
    return false;
  }
}

async function envoyerPhotoEnAttente(entree) {
  try {
    const blob = await (await fetch(entree.dataUrl)).blob();
    const url = await uploadMachinePhoto(entree.companyId, entree.machineId, blob);
    const { error } = await sb.from('machines').update({ image_url: url }).eq('id', entree.machineId);
    if (error) throw error;
    return true;
  } catch (err) {
    if (estErreurReseau(err)) return false;   // on réessaiera
    console.warn('Photo en attente refusée :', err && err.message);
    return true;                              // refus définitif : on n'insiste pas
  }
}

let photosAttenteEnCours = false;
async function viderPhotosEnAttente() {
  if (photosAttenteEnCours) return;
  const liste = photosEnAttente();
  if (!liste.length || !UI.companyId) return;
  photosAttenteEnCours = true;
  let restantes = [];
  let envoyees = 0;
  for (const entree of liste) {
    const partie = await envoyerPhotoEnAttente({ ...entree, companyId: UI.companyId });
    if (partie) envoyees++;
    else restantes.push(entree);
  }
  ecrirePhotosEnAttente(restantes);
  photosAttenteEnCours = false;
  if (envoyees) {
    console.warn(`${envoyees} photo(s) en attente envoyée(s).`);
    if (typeof boot === 'function') boot();
  }
}

// Appelée au rendu : une seule tentative par session, sans boucle (le vidage
// rappelle boot(), qui rend à nouveau).
let photosAttenteTentee = false;
function tenterViderPhotosEnAttente() {
  if (photosAttenteTentee) return;
  if (!photosEnAttente().length) return;
  photosAttenteTentee = true;
  viderPhotosEnAttente();
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('online', () => { photosAttenteTentee = false; viderPhotosEnAttente(); });
}

async function uploadMachinePhoto(companyId, machineId, blob) {
  const path = `${companyId}/${machineId}.jpg`;
  const { error } = await sb.storage.from('machine-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  const { data } = sb.storage.from('machine-photos').getPublicUrl(path);
  // Le chemin de stockage est stable (companyId/machineId.jpg) et `upsert`
  // écrase le même objet : l'URL publique ne change donc jamais d'un envoi à
  // l'autre, et le navigateur (voire le CDN) continue de servir l'ancienne
  // image en cache après un remplacement de photo. Le paramètre `v` force une
  // URL différente à chaque envoi pour que la nouvelle photo soit bien rechargée.
  return `${data.publicUrl}?v=${Date.now()}`;
}

// Le lien de réinitialisation arrive ici AVEC l'erreur dans l'adresse quand il a
// expiré ou déjà servi. Sans ce contrôle, on affichait l'écran de connexion sans
// rien expliquer — l'utilisateur ne pouvait pas savoir que son lien était mort.
function renderLienExpire() {
  app.innerHTML = `
    <div class="login-box">
      <h1>KALEA</h1>
      <p>${trad('Ce lien de réinitialisation a expiré ou a déjà servi.')}</p>
      <div class="modal-actions">
        <button type="button" class="secondary" id="lien-login">${trad('Se connecter')}</button>
        <button type="button" class="primary" id="lien-nouveau">${trad('Recevoir un nouveau code')}</button>
      </div>
    </div>`;
  document.getElementById('lien-login').addEventListener('click', () => renderLogin());
  document.getElementById('lien-nouveau').addEventListener('click', () => openForgotPasswordModal());
}

// Vrai pendant une réinitialisation par code : l'événement PASSWORD_RECOVERY
// émis par Supabase à la vérification ne doit pas réafficher l'écran de choix du
// mot de passe alors qu'il vient d'être enregistré.
let reinitialisationParCode = false;

function renderSetNewPassword() {
  app.innerHTML = `
    <div class="login-box">
      <h1>KALEA</h1>
      <p>${trad('Choisis un nouveau mot de passe.')}</p>
      <form id="reset-form">
        <label for="new-password">${trad('Nouveau mot de passe')}</label>
        <div class="password-wrap" style="margin-bottom:16px;">
          <input id="new-password" type="password" minlength="6" required>
          <button type="button" class="toggle-pw-btn" aria-pressed="false">${trad('Afficher')}</button>
        </div>
        <button class="primary" type="submit">${trad('Enregistrer le mot de passe')}</button>
        <div class="error" id="reset-error"></div>
      </form>
    </div>
  `;

  document.getElementById('reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('reset-error');
    const submitBtn = e.target.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = trad('Enregistrement…');
    const password = document.getElementById('new-password').value;
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      errorEl.textContent = trad('Erreur :') + " " + error.message;
      submitBtn.disabled = false;
      submitBtn.textContent = trad('Enregistrer le mot de passe');
      return;
    }
    boot(trad('Mot de passe mis à jour'));
  });
}

if (sb) {
  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY' && !reinitialisationParCode) { renderSetNewPassword(); }
  });
}

function openForgotPasswordModal() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal">
      <h2>${trad('Mot de passe oublié')}</h2>
      <p class="sub">${trad('Indique ton email de connexion : on t\'envoie un code à 6 chiffres pour définir un nouveau mot de passe.')}</p>
      <form id="forgot-form">
        <label for="forgot-email">${trad('Email')}</label>
        <input id="forgot-email" type="email" required>
        <div class="hint" id="forgot-error"></div>
        <div class="modal-actions">
          <button type="button" class="secondary" id="forgot-cancel">${trad('Annuler')}</button>
          <button type="submit" class="primary">${trad('Envoyer le lien')}</button>
        </div>
      </form>
    </div>
  `;
  overlay.querySelector('#forgot-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = overlay.querySelector('#forgot-error');
    const submitBtn = e.target.querySelector('button[type=submit]');
    const email = overlay.querySelector('#forgot-email').value.trim();
    submitBtn.disabled = true;
    submitBtn.textContent = trad('Envoi…');
    try {
      const redirectTo = window.location.href.split('?')[0].split('#')[0];
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      // On demande le CODE reçu, pas seulement le lien : un lien à usage unique
      // est fréquemment consommé par le scanneur de liens du webmail, et
      // l'utilisateur se retrouve avec un lien mort sans comprendre pourquoi.
      overlay.innerHTML = `
        <div class="modal">
          <h2>${trad('Vérifie ton email')}</h2>
          <p class="sub">${tR('Un code à 6 chiffres a été envoyé à {email}. Saisis-le avec ton nouveau mot de passe. Chaque demande remplace la précédente : utilise le dernier code reçu.', { email: esc(email) })}</p>
          <form id="reset-code-form">
            <label for="reset-code">${trad('Code reçu par e-mail')}</label>
            <input id="reset-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" required>
            <label for="reset-password">${trad('Nouveau mot de passe')}</label>
            <div class="password-wrap">
              <input id="reset-password" type="password" minlength="6" required>
              <button type="button" class="toggle-pw-btn" aria-pressed="false">${trad('Afficher')}</button>
            </div>
            <div class="hint" id="reset-code-error"></div>
            <div class="resend-row">
              <button type="button" class="link-inline" id="reset-resend">${trad('Renvoyer un code')}</button>
              <span class="hint" id="reset-resend-msg" role="status" aria-live="polite"></span>
            </div>
            <div class="modal-actions">
              <button type="button" class="secondary" id="reset-code-cancel">${trad('Annuler')}</button>
              <button type="submit" class="primary">${trad('Enregistrer le mot de passe')}</button>
            </div>
          </form>
        </div>`;
      overlay.querySelector('#reset-code-cancel').addEventListener('click', () => overlay.remove());
      overlay.querySelector('#reset-code-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const codeEl = overlay.querySelector('#reset-code-error');
        const valider = ev.target.querySelector('button[type=submit]');
        const code = overlay.querySelector('#reset-code').value.trim();
        const motDePasse = overlay.querySelector('#reset-password').value;
        valider.disabled = true;
        valider.textContent = trad('Vérification…');
        try {
          // Le parcours par code doit être le SEUL à consommer le jeton : on
          // prévient l'écouteur d'état, sinon l'événement PASSWORD_RECOVERY
          // réafficherait « choisis un nouveau mot de passe » après coup.
          reinitialisationParCode = true;
          const { error: errCode } = await sb.auth.verifyOtp({ email, token: code, type: 'recovery' });
          if (errCode) throw errCode;
          const { error: errMaj } = await sb.auth.updateUser({ password: motDePasse });
          if (errMaj) throw errMaj;
          overlay.remove();
          boot(trad('Mot de passe mis à jour'));
        } catch (err) {
          reinitialisationParCode = false;
          const brut = String(err.message || '');
          // Le message brut de Supabase est en anglais et technique. Dans le cas
          // le plus courant — un code d'une demande précédente, remplacé depuis —
          // on dit quoi faire, et le bouton juste en dessous le fait.
          codeEl.textContent = /expired or is invalid/i.test(brut)
            ? trad('Ce code a expiré ou a déjà servi. Demande un nouveau code.')
            : trad('Erreur :') + " " + brut;
          valider.disabled = false;
          valider.textContent = trad('Enregistrer le mot de passe');
        }
      });
      const renvoi = overlay.querySelector('#reset-resend');
      const renvoiMsg = overlay.querySelector('#reset-resend-msg');
      let attente = 0;
      renvoi.addEventListener('click', async () => {
        if (attente > 0) return;
        renvoi.disabled = true;
        renvoiMsg.textContent = trad('Envoi…');
        try {
          const redirectTo = window.location.href.split('?')[0].split('#')[0];
          const { error: errEnvoi } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
          if (errEnvoi) throw errEnvoi;
          // Chaque demande remplace la précédente : l'ancien code ne vaut plus
          // rien, c'est justement pourquoi on propose ce bouton.
          renvoiMsg.textContent = trad('Nouveau code envoyé.');
        } catch (err) {
          renvoiMsg.textContent = trad('Envoi impossible :') + " " + err.message;
        }
        attente = 30;
        const tic = () => {
          if (attente <= 0) { renvoi.disabled = false; renvoi.textContent = trad('Renvoyer un code'); clearInterval(minuteur); return; }
          renvoi.textContent = tR('Renvoyer dans {n} s', { n: attente });
          attente--;
        };
        const minuteur = setInterval(tic, 1000);
        tic();
      });
    } catch (err) {
      errorEl.textContent = trad('Erreur :') + " " + err.message;
      submitBtn.disabled = false;
      submitBtn.textContent = trad('Envoyer le lien');
    }
  });
}

// Un compte peut exister sans société : l'inscription a bien créé l'utilisateur,
// mais l'enregistrement de la société a échoué, ou le parcours date d'une version
// antérieure. L'application s'arrêtait sur « Vérifie la table profiles » — un
// message pour développeur, sans issue. On propose de créer la société : c'est la
// seule chose qui manque, et un nom suffit (colonnes obligatoires : id et name).
// LA FONCTION DE CRÉATION EXISTE-T-ELLE SUR CETTE BASE ? Le parcours fonctionne
// AVANT comme APRÈS la migration : on reconnaît le refus de PostgREST — la
// fonction n'existe pas encore — pour retomber sur l'ancien chemin. Tout autre
// refus (plafond, droits, doublon) est un VRAI refus : il est affiché tel quel.
function fonctionAbsente(err) {
  if (!err) return false;
  const texte = String(err.message || '') + ' ' + String(err.details || '') + ' ' + String(err.hint || '');
  return err.code === 'PGRST202' || err.code === '42883'
    || /could not find the function|function .* does not exist/i.test(texte);
}

// LE CHEMIN DE REPLI, POUR UNE BASE NON ENCORE MIGRÉE. Il rattache le profil au
// lieu de le recréer — un `insert` sec était exactement le défaut d'origine. Sur
// une telle base, l'écriture reste cependant bornée par la politique de mise à
// jour du profil, qui exige une société : c'est la migration qui débloque le cas
// « profil déjà présent », et ce repli ne fait que préserver le cas normal.
async function creerSocieteEtProfil(nom, activite, user) {
  const companyId = crypto.randomUUID();
  const { error: errSociete } = await sb.from('companies').insert({
    id: companyId, name: nom, activity: activite || null, plan: 'free',
  });
  if (errSociete) throw errSociete;
  const { error: errInsert } = await sb.from('profiles').insert({ id: user.id, company_id: companyId });
  if (!errInsert) return companyId;
  const { error: errUpdate } = await sb.from('profiles').update({ company_id: companyId }).eq('id', user.id);
  if (errUpdate) throw errUpdate;
  return companyId;
}

// `motif` : la raison pour laquelle cet écran s'affiche, quand la lecture du
// compte a ÉCHOUÉ (et non « rien trouvé »). On la montre discrètement : elle ne
// bloque rien, mais elle évite de faire croire à un compte neuf quand ce n'est
// qu'une lecture ratée.
function renderSocieteManquante(user, motif) {
  app.innerHTML = `
    <div class="login-box">
      <h1>KALEA</h1>
      <p>${trad('Ton compte est confirmé, mais il n\'est rattaché à aucune société. Indique son nom pour commencer.')}</p>
      <form id="societe-form">
        <label for="societe-nom">${trad('Nom de la société')}</label>
        <input id="societe-nom" required autocomplete="organization">
        <label for="societe-activite">${trad('Activité')}</label>
        <select id="societe-activite">
          ${SIGNUP_ACTIVITIES.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}
        </select>
        ${motif ? `<div class="hint">${esc(trad('Erreur :') + ' ' + motif)}</div>` : ''}
        <div class="hint" id="societe-error"></div>
        <div class="modal-actions">
          <button type="button" class="secondary" id="societe-deconnexion">${trad('Se déconnecter')}</button>
          <button type="submit" class="primary">${trad('Créer ma société')}</button>
        </div>
      </form>
    </div>`;

  habillerSelect(document.getElementById('societe-activite'), trad('Activité'));
  document.getElementById('societe-deconnexion').addEventListener('click', async () => {
    await sb.auth.signOut();
    renderLogin();
  });

  document.getElementById('societe-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('societe-error');
    const bouton = e.target.querySelector('button[type=submit]');
    const nom = document.getElementById('societe-nom').value.trim();
    const activite = document.getElementById('societe-activite').value;
    bouton.disabled = true;
    bouton.textContent = trad('Création…');
    try {
      if (!nom) throw new Error(trad('Indique le nom de la société.'));
      // ★ UNE SEULE ÉCRITURE, CÔTÉ SERVEUR, ET ELLE EST IDEMPOTENTE.
      //   Avant : `companies.insert` PUIS `profiles.insert`, deux écritures
      //   séparées. La seconde échouait avec « duplicate key value violates
      //   unique constraint "profiles_pkey" » dès que le profil existait déjà,
      //   et la première laissait derrière elle une société SANS AUCUN MEMBRE :
      //   quatre sociétés fantômes sont nées comme ça (KALEA AGRI deux fois,
      //   lakshmi deux fois). Un profil existant ne se recrée pas, il se
      //   RATTACHE — et un second essai ne doit RIEN créer de plus.
      //   La fonction fait les deux écritures dans la même transaction et
      //   RÉUTILISE la société du compte si elle existe déjà.
      const { error } = await sb.rpc('creer_ma_societe', { p_nom: nom, p_activite: activite || null });
      if (error) {
        // Base pas encore migrée : on le DIT, et on retombe sur l'ancien chemin.
        if (!fonctionAbsente(error)) throw error;
        await creerSocieteEtProfil(nom, activite, user);
      }
      // Les colonnes prénom/nom du contact n'existent qu'après migration : on ne
      // les envoie que si elles sont là, comme à l'inscription.
      const { error: sonde } = await sb.from('companies').select('contact_first_name').limit(1);
      if (!sonde) {
        const plein = (user && user.user_metadata && user.user_metadata.full_name) || '';
        const morceaux = String(plein).trim().split(/\s+/);
        if (morceaux.length > 1) {
          await sb.rpc('update_my_company', {
            p_contact_first_name: morceaux[0],
            p_contact_last_name: morceaux.slice(1).join(' '),
          });
          await enregistrerNomDuProfil(plein);
        }
      }
      boot(trad('Société créée'));
    } catch (err) {
      // ★ DEUX NIVEAUX DE LECTURE. Un client n'a que faire de « permission denied
      //   for function ma_societe » : on lui dit ce qui est utile, et à qui
      //   s'adresser. La cause technique n'est PAS perdue pour autant — elle part
      //   à la console, où le support la retrouve. La masquer SANS la garder serait
      //   pire que le jargon : c'est ainsi qu'un défaut devient invisible.
      //   Un refus qui parle déjà au client (« Indique le nom… », plafond atteint)
      //   reste affiché tel quel : il est dans sa langue, et il lui dit quoi faire.
      const technique = /permission denied|does not exist|schema cache|row-level security|duplicate key/i
        .test(String((err && err.message) || ''));
      console.error('Création de société :', err);
      errorEl.textContent = technique
        ? trad('La création n\'a pas pu aboutir. Réessaie dans un instant — si cela recommence, écris à support@kalea.pro.')
        : trad('Erreur :') + ' ' + err.message;
      bouton.disabled = false;
      bouton.textContent = trad('Créer ma société');
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// L'ADRESSE TECHNIQUE DES MEMBRES D'ATELIER
// ════════════════════════════════════════════════════════════════════════════
// Le gérant crée un mécanicien sans e-mail : le serveur fabrique un compte à
// adresse interne `<login>@membres.keeva.work`, qui ne sert JAMAIS à du
// courrier. Ce domaine est donc ajouté ici, à la saisie, pour que la personne
// n'ait qu'un login court à retenir — et il l'est d'un seul endroit : l'écran de
// connexion, la ré-authentification de « Mon compte » et le verrou s'en servent.
const DOMAINE_MEMBRES = 'membres.keeva.work';

function emailDeConnexion(saisie) {
  const valeur = String(saisie == null ? '' : saisie).trim().toLowerCase();
  // Une adresse complète reste une adresse : on n'y touche pas.
  if (!valeur || valeur.includes('@')) return valeur;
  return valeur + '@' + DOMAINE_MEMBRES;
}

function renderLogin(errorMsg, horsLigne) {
  // Retour de paiement sans session : l'écran de connexion annonce la nouvelle.
  // Le paramètre reste dans l'adresse : la confirmation viendra après la connexion.
  const avisForfait = messageForfaitConnexion();
  // Sur le web, la langue et le retour à la vitrine vivent dans un en-tête de
  // page ; dans l'application native, pas d'en-tête : la langue reste dans la carte.
  const enTeteWeb = !dansApplication();
  // Sur le web, le pied légal se place sous la carte ; dans l'application, dedans.
  const piedLegal = `<div class="legal-footer">
        <a href="./mentions-legales.html" target="_blank" rel="noopener">${trad('Mentions légales')}</a> ·
        <a href="./cgu.html" target="_blank" rel="noopener">${trad('CGU')}</a> ·
        <a href="./politique-confidentialite.html" target="_blank" rel="noopener">${trad('Confidentialité')}</a>
        <p class="version-app">${trad('Version de l\'application')} ${esc(versionAffichee())}</p>
      </div>`;
  app.innerHTML = `
    ${enTeteWeb ? `<header class="entete-connexion">
      <a class="entete-marque" href="./decouvrir.html">
        <span class="entete-logo" aria-hidden="true">
          <svg viewBox="338 248 1228 1228" focusable="false"><circle cx="952" cy="862" r="598" fill="#18183A" stroke="#8F8FCB" stroke-width="31"/><rect x="694" y="528" width="92" height="700" rx="46" fill="#FFFFFF"/><path d="M742,872 C850,780 1000,660 1130,625 C1190,610 1225,630 1205,662 C1185,700 1140,725 1080,732 C960,745 850,800 742,872 Z" fill="#16B2CB"/><path d="M742,872 C860,940 1000,1010 1110,1025 C1180,1035 1235,1055 1233,1080 C1230,1110 1170,1118 1120,1105 C1000,1075 870,960 742,872 Z" fill="#E78B20"/><circle cx="946" cy="878" r="73" fill="#8F8FCB"/></svg>
        </span>
        <span>KALEA</span>
      </a>
      <div class="entete-outils">
        ${basculeLangueHtml()}
        <a class="entete-lien" href="./decouvrir.html">${trad('Site public')}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </a>
      </div>
    </header>` : ''}
    <div class="login-box${dansApplication() ? ' dans-app' : ''}">
      ${enTeteWeb ? '' : basculeLangueHtml()}
      <div class="marque-connexion" aria-hidden="true">
        <svg viewBox="338 248 1228 1228" width="68" height="68" focusable="false"><circle cx="952" cy="862" r="598" fill="#FFFFFF" stroke="#6864DF" stroke-width="31"/><rect x="694" y="528" width="92" height="700" rx="46" fill="#18183A"/><path d="M742,872 C850,780 1000,660 1130,625 C1190,610 1225,630 1205,662 C1185,700 1140,725 1080,732 C960,745 850,800 742,872 Z" fill="#16B2CB"/><path d="M742,872 C860,940 1000,1010 1110,1025 C1180,1035 1235,1055 1233,1080 C1230,1110 1170,1118 1120,1105 C1000,1075 870,960 742,872 Z" fill="#E78B20"/><circle cx="946" cy="878" r="73" fill="#6864DF"/></svg>
      </div>
      <h1>KALEA</h1>
      <p>${trad('Connectez-vous pour accéder à votre parc et vos carnets')}</p>
      ${avisForfait ? '<div class="hint" role="status">' + esc(avisForfait) + '</div>' : ''}
      <form id="login-form">
        <label for="email">${trad('E-mail ou identifiant atelier')}</label>
        <div class="champ-icone">
          <input id="email" type="text" autocomplete="username" required placeholder="${trad('jean.dupont')}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        </div>
        <p class="hint">${trad('Adresse e-mail, ou identifiant court attribué aux membres de l\'équipe sans e-mail.')}</p>
        <div class="champ-entete">
          <label for="password">${trad('Mot de passe')}</label>
          <button type="button" class="link-inline" id="open-forgot">${trad('Mot de passe oublié ?')}</button>
        </div>
        <div class="password-wrap">
          <input id="password" type="password" autocomplete="current-password" required>
          <button type="button" class="toggle-pw-btn" aria-pressed="false">${trad('Afficher')}</button>
        </div>
        ${dansApplication() ? `<div class="acces-local">
          <p class="acces-local-titre">${trad('Déverrouillage biométrique')}</p>
          <div class="bio-connexion" id="login-bio" hidden></div>
        </div>` : ''}
        <div class="login-actions">
          <button class="primary" type="submit"><span>${trad('Se connecter')}</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg></button>
          <button type="button" class="secondary" id="open-signup">${trad('Créer un compte')}</button>
        </div>
        ${errorMsg ? `<div class="error">${esc(errorMsg)}</div>` : ''}
      </form>
      ${dansApplication() ? '' : `
      <div class="presentation-publique">
        <p class="pres-promesse"><strong>KALEA</strong> ${trad('automatise le plan d\'entretien à partir du carnet constructeur : alertes en dates ou horamètres, rappels préventifs et commandes de pièces.')}</p>
        <div class="pres-pied">
          <span class="pres-gratuit">${trad('Gratuit pour 2 machines')}</span>
          <a class="pres-lien" href="./decouvrir.html">${trad('Découvrir KALEA')} →</a>
        </div>
      </div>`}
      ${horsLigne && horsLigne.copieDu ? `
      <section class="access-local" aria-labelledby="acces-local-titre">
        <div class="card-head"><h2 class="card-title" id="acces-local-titre">${trad('Zone blanche ou hors réseau ?')}</h2></div>
        <p class="muted-text">${trad('Les machines et les carnets déjà reçus sur cet appareil restent consultables sans réseau : ouvre la copie locale, sans ressaisir ton mot de passe.')}</p>
        <p class="texte-attenue">${tR('Copie du {date} — sept jours, puis elle expire.', { date: formatShortDate(new Date(horsLigne.copieDu).toISOString().slice(0, 10)) })}</p>
        <button type="button" class="secondary" id="voir-copie">${trad('Afficher les dernières données hors connexion')}</button>
        <p class="texte-attenue">${trad('À ne faire que sur un appareil personnel : l\'affichage ne demande aucune vérification.')}</p>
      </section>` : ''}
      ${enTeteWeb ? '' : piedLegal}
    </div>
    ${enTeteWeb ? piedLegal.replace('class="legal-footer"', 'class="legal-footer hors-carte"') : ''}
  `;
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    // ★ SOIT UNE ADRESSE, SOIT UN LOGIN COURT : le mécanicien tape
    //   `jean.dupont`, jamais `<login>@membres.keeva.work`. Pas d'arobase → on
    //   complète avec le domaine interne. Le serveur, lui, ne voit qu'une
    //   adresse : rien à changer dans Supabase.
    const email = emailDeConnexion(document.getElementById('email').value);
    const password = document.getElementById('password').value;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { renderLogin(error.message); return; }
    // L'utilisateur vient de saisir son mot de passe : le verrou de ce lancement
    // est donc levé — redemander une empreinte juste après serait absurde.
    verrouLeve = true;
    // Enregistrement de l'accès sans mot de passe si la case a été cochée (geste
    // explicite). Le résultat n'est PAS annoncé ici : l'échec d'une option ne doit
    // pas accueillir l'utilisateur par un message sur son tableau de bord. La
    // raison et le code restent dans « Mon compte ».
    await proposerAccesSansMotDePasse(email);
    boot();
    // Une nouvelle version a-t-elle été publiée pendant que cette page était
    // ouverte ? Le contrôle est DISCRET et ne recharge rien tout seul.
    verifierVersionPubliee();
  });

  // L'invite et le bouton n'apparaissent que dans l'application native, et
  // seulement si l'appareil annonce une vérification utilisable : ailleurs, ce
  // bloc reste vide.
  preparerBiometrieConnexion();
  document.getElementById('open-signup').addEventListener('click', () => openSignupWizard());
  document.getElementById('open-forgot').addEventListener('click', () => openForgotPasswordModal());

  // Retour d'un lien de réinitialisation refusé par Supabase : l'adresse porte
  // error_code=otp_expired (ou access_denied). On le dit, et on nettoie
  // l'adresse pour qu'un rechargement ne réaffiche pas l'erreur.
  if (/[?#&]error_code=/.test(location.hash) || /[?&]error_code=/.test(location.search)) {
    try { history.replaceState(null, '', location.pathname); } catch (err) { /* sans conséquence */ }
    renderLienExpire();
    return;
  }

  // Lien direct depuis la page publique : « Essai gratuit » et « Commencer
  // gratuitement » doivent ouvrir le FORMULAIRE DE CRÉATION DE COMPTE, et non
  // l'écran de connexion. On accepte ?inscription, ?inscription=1 et
  // #inscription. Le paramètre est consommé (retiré de l'adresse) : sans cela,
  // une erreur de connexion relancerait le formulaire à chaque nouvel essai.
  if (/[?&]inscription\b/.test(location.search) || location.hash === '#inscription') {
    try { history.replaceState(null, '', location.pathname); } catch (err) { /* sans conséquence */ }
    openSignupWizard();
  }

  // ── INVITATION À REJOINDRE UNE SOCIÉTÉ (?invitation=CODE) ──────────────────
  // Le code N'EST PAS retiré de l'adresse tant que l'invitation n'est pas
  // acceptée : l'invité n'a souvent pas encore de compte, il s'inscrit, Supabase
  // le renvoie sur la page, et il faut que le code soit TOUJOURS LÀ — c'est ce
  // qui rend le parcours « je crée mon compte en conservant le code » possible
  // sans rien stocker dans le navigateur.
  const invitation = invitationDemandee();
  if (invitation) afficherBlocInvitation(invitation);
  // Déverrouillage local EXPLICITE : rien n'est affiché avant ce clic.
  const voirCopie = document.getElementById('voir-copie');
  if (voirCopie) {
    voirCopie.addEventListener('click', () => {
      const copie = lireCache();
      if (copie) afficherDepuisCache(copie);
      else renderLogin(trad('La copie locale a expiré ou a été effacée.'));
    });
  }
}

const SIGNUP_ACTIVITIES = [trad('BTP / Travaux publics'), trad('Agriculture / Élevage'), trad('Espaces verts / Paysagisme'), trad('Transport / Logistique'), trad('Location de matériel'), trad('Industrie / Production'), trad('Collectivité / Secteur public'), trad('Autre')];

// Ce que l'adresse demande, quand elle porte une invitation. Le format est
// vérifié : 32 caractères hexadécimaux, ce que produit `nouveau_code_invitation`
// côté base. Un code d'une autre forme n'est pas une invitation.
function invitationDemandee() {
  const trouve = /[?&]invitation=([^&#]*)/.exec(location.search || '');
  if (!trouve) return '';
  const code = decodeURIComponent(trouve[1]).trim();
  return /^[a-f0-9]{32}$/i.test(code) ? code : '';
}

// Le code est retiré de l'adresse UNE FOIS L'INVITATION ACCEPTÉE, et seulement
// là : un rechargement ne doit pas reproposer ce qui est déjà fait.
function oublierInvitation() {
  try {
    const parametres = new URLSearchParams(location.search || '');
    parametres.delete('invitation');
    const reste = parametres.toString();
    history.replaceState(null, '', location.pathname + (reste ? '?' + reste : '') + (location.hash || ''));
  } catch (err) { /* sans conséquence : au pire l'invitation sera reproposée */ }
}

// Le bloc affiché sur l'écran de connexion, et le chemin de l'acceptation.
// Quatre issues, toutes DITES : acceptée, expirée, déjà membre, adresse qui ne
// correspond pas — le message d'échec vient du SERVEUR, on ne le réécrit pas.
// ════════════════════════════════════════════════════════════════════════════
// UNE INVITATION DÉJÀ CONNECTÉ : LE BLOC SE POSE SUR L'APPLICATION
// ════════════════════════════════════════════════════════════════════════════
// POURQUOI. Le bloc d'invitation était FABRIQUÉ POUR L'ÉCRAN DE CONNEXION : sa
// zone s'ajoutait à `.login-box`, qui n'existe que là. Un utilisateur DÉJÀ
// CONNECTÉ qui ouvrait un lien `?invitation=CODE` arrivait donc sur son tableau
// de bord, la zone ne pouvait pas s'attacher… et RIEN n'était dit. C'est le
// défaut signalé : « j'ai cliqué, rien ne s'est passé ».
//
// Le bloc se pose maintenant là où l'application s'affiche, et il dit sur quel
// compte on est connecté. La DÉCISION, elle, reste au SERVEUR : `accepter_invitation`
// refuse une invitation destinée à une autre adresse, et refuse de DÉPLACER un
// compte déjà rattaché à une autre société (migration-invitations.sql). L'écran
// ne fait que rapprocher les deux adresses pour que la personne comprenne.
function invitationConnecteeHtml(code, options = {}) {
  const ici = String(options.email || '').trim();
  const invite = String(options.invite || '').trim();
  const memeAdresse = !!ici && !!invite && ici.toLowerCase() === invite.toLowerCase();
  const ligne = (libelle, valeur, classe) =>
    `<div class="${classe || 'hint'}" style="font-size:13px;">${esc(libelle)} <strong>${esc(valeur || '—')}</strong></div>`;
  return `
    <div class="label">${trad('Invitation à rejoindre une société')}</div>
    ${ligne(trad('Connecté en tant que'), ici)}
    ${options.invite ? ligne(trad('Invitation destinée à'), invite,
      memeAdresse ? 'hint' : 'hint is-late') : ''}
    ${memeAdresse
      ? `<div class="hint">${trad('Accepte pour rejoindre la société de cette invitation.')}</div>`
      : ''}
    <div class="modal-actions" style="margin-top:8px;">
      <button type="button" class="primary" id="invitation-accepter">${trad('Accepter l\'invitation')}</button>
    </div>
    <div class="hint" id="invitation-msg" role="status" aria-live="polite"></div>`;
}

// Ce que fait le clic, dans les deux situations (connecté ou non) : on appelle le
// SERVEUR, et c'est SON message qui s'affiche — refus compris.
function brancherAcceptationInvitation(code, racine) {
  const msg = racine.querySelector('#invitation-msg');
  const bouton = racine.querySelector('#invitation-accepter');
  if (!bouton) return;
  bouton.addEventListener('click', async () => {
    if (msg) msg.textContent = trad('Vérification de l\'invitation…');
    try {
      const { data, error } = await sb.rpc('accepter_invitation', { p_code: code });
      if (error) throw error;
      const ligne = Array.isArray(data) ? data[0] : data;
      oublierInvitation();
      if (msg) msg.textContent = tR('Invitation acceptée : tu rejoins {societe} comme {role}.', { societe: ligne && ligne.societe ? ligne.societe : '', role: ligne && ligne.role ? ligne.role : '' });
      setTimeout(() => boot(), 1200);
    } catch (err) {
      if (msg) msg.textContent = String((err && err.message) || err);
    }
  });
}

// La zone d'invitation SUR L'APPLICATION CONNECTÉE. Elle est créée ici, au
// moment où on en a besoin, et posée sur la vue : aucun gabarit d'écran n'est
// touché (c'est ce qui avait cassé l'ancre d'un autre correctif).
function afficherInvitationConnectee(code) {
  const racine = document.getElementById('view-root') || document.getElementById('app');
  if (!racine) return;
  if (document.getElementById('invitation-connectee')) return;
  const zone = document.createElement('section');
  zone.className = 'card';
  zone.id = 'invitation-connectee';
  zone.innerHTML = invitationConnecteeHtml(code, { email: UI.email || '' });
  racine.insertBefore(zone, racine.firstChild || null);
  brancherAcceptationInvitation(code, zone);
}

// ★ LE CONTRÔLE D'UNE INVITATION QUAND ON EST CONNECTÉ. Il est défini ici (et non
//   dans boot()) pour que le harnais puisse l'éprouver, et il ne fait que des
//   lectures refusées proprement : si la table n'est pas lisible, on n'affiche
//   simplement rien de plus que l'adresse connectée.
async function verifierInvitationConnectee() {
  const code = invitationDemandee();
  // Sans code dans l'adresse, ou sur l'écran de connexion (son bloc existe), rien.
  if (!code || !sb || !sb.auth || !sb.auth.getSession) return;
  let session = null;
  try {
    ({ data: { session } } = await sb.auth.getSession());
  } catch (err) {
    session = null;
  }
  if (!session) return;
  let invite = '';
  try {
    const { data, error } = await sb
      .from('invitations')
      .select('email')
      .eq('code', code)
      .maybeSingle();
    if (!error && data && data.email) invite = data.email;
  } catch (err) {
    invite = '';
  }
  afficherInvitationConnectee(code);
  const zone = document.getElementById('invitation-connectee');
  if (zone) {
    zone.innerHTML = invitationConnecteeHtml(code, { email: session.user?.email || '', invite });
    brancherAcceptationInvitation(code, zone);
  }
}

function afficherBlocInvitation(code) {
  // La zone est CRÉÉE ici, et non dans le gabarit de l'écran de connexion : ce
  // gabarit est touché par d'autres correctifs (la marque, les actions de
  // connexion), et y insérer un bloc de plus casse leur ancre — c'est arrivé.
  // On l'ajoute à la BOÎTE DE CONNEXION, qui existe à ce moment-là.
  const boite = document.querySelector('.login-box') || document.getElementById('app');
  if (!boite) return;
  let zone = document.getElementById('invitation-zone');
  if (!zone) {
    zone = document.createElement('div');
    // `card` est la classe de bloc DÉJÀ définie par la charte : fond, rayon,
    // ombre, espacement. Inventer un nom de plus aurait ajouté une classe sans
    // style — ce que `check-classes.mjs` refuse, à raison.
    zone.className = 'card';
    zone.id = 'invitation-zone';
    boite.appendChild(zone);
  }
  zone.hidden = false;
  zone.innerHTML = `
    <div class="hint" role="status" aria-live="polite" id="invitation-msg">${trad('Invitation à rejoindre une société. Connecte-toi avec l\'adresse invitée, ou crée ton compte : le code est conservé.')}</div>
    <div class="modal-actions">
      <button type="button" class="primary" id="invitation-accepter">${trad('Accepter l\'invitation')}</button>
      <button type="button" class="secondary" id="invitation-inscrire">${trad('Créer mon compte')}</button>
    </div>`;
  const msg = document.getElementById('invitation-msg');
  document.getElementById('invitation-inscrire')?.addEventListener('click', () => openSignupWizard());
  document.getElementById('invitation-accepter')?.addEventListener('click', async () => {
    if (msg) msg.textContent = trad('Vérification de l\'invitation…');
    try {
      const { data, error } = await sb.rpc('accepter_invitation', { p_code: code });
      if (error) throw error;
      const ligne = Array.isArray(data) ? data[0] : data;
      oublierInvitation();
      if (msg) msg.textContent = tR('Invitation acceptée : tu rejoins {societe} comme {role}.', { societe: ligne && ligne.societe ? ligne.societe : '', role: ligne && ligne.role ? ligne.role : '' });
      setTimeout(() => boot(), 1200);
    } catch (err) {
      if (msg) msg.textContent = String((err && err.message) || err);
    }
  });
}

// Le nom de la personne connectée est AUSSI écrit sur sa fiche (profiles.full_name) : c'est lui que la console
// d'administration affiche pour le gérant. Fonction update_my_full_name (migration nom-profil-gerant.sql) ; tant qu'elle
// n'existe pas, on n'écrit rien et on ne bloque rien.
async function enregistrerNomDuProfil(nomComplet) {
  const nom = String(nomComplet || '').trim();
  if (!nom) return;
  try {
    const { error } = await sb.rpc('update_my_full_name', { p_full_name: nom });
    if (error && !fonctionAbsente(error)) console.warn('Nom du profil non enregistré :', error.message);
  } catch (err) { console.warn('Nom du profil non enregistré :', err && err.message); }
}

function openSignupWizard() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const state = {
    structureType: 'company', name: '', activity: SIGNUP_ACTIVITIES[0],
    registrationNumber: '', country: PAYS_DEFAUT_SOCIETE, phone: '', email: '', password: '',
    contactName: '', contactFirstName: '', contactLastName: '',
  };

  function shell(inner) { overlay.innerHTML = `<div class="modal">${inner}</div>`; }

  function stepForm() {
    overlay.className = 'overlay signup-modal';
    shell(`
      <div class="mform-tete">
        <div class="mform-tete-titre"><span class="card-ico card-ico-plein">${picto('ajoutPersonne')}</span><h2>${trad('Créer un compte')}</h2></div>
        <button type="button" class="mform-close" id="su-close-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
      </div>
      <div class="callout">
        <span class="card-ico">${picto('info')}</span>
        <span>${trad('Offre Gratuit : 2 machines. Offre Starter / Artisan : 12 €/mois, 5 machines, puis 2 € par machine jusqu\'à 10. Offre Business / Flotte : 39 €/mois, 20 machines et 3 utilisateurs, puis 1,50 € par machine jusqu\'à 40. Offre Enterprise / Parc : 79 €/mois, 40 machines, puis 1 € par machine jusqu\'à 150. Au-delà : offre Grand compte, sur devis.')}</span>
      </div>
      <form id="signup-form">
        <label>${trad('Type de structure')} <span class="requis">*</span></label>
        <div class="mform-cards" id="su-type-cards">
          <label class="mform-card">
            <input type="radio" name="stype" value="company" ${state.structureType === 'company' ? 'checked' : ''}>
            <span class="mform-card-ico">${picto('batiment')}</span>
            <span class="mform-card-corps"><span class="mform-card-titre">${trad('Société')}</span></span>
          </label>
          <label class="mform-card">
            <input type="radio" name="stype" value="individual" ${state.structureType === 'individual' ? 'checked' : ''}>
            <span class="mform-card-ico">${picto('mallette')}</span>
            <span class="mform-card-corps"><span class="mform-card-titre">${trad('Indépendant / Patenté')}</span></span>
          </label>
          <label class="mform-card">
            <input type="radio" name="stype" value="institution" ${state.structureType === 'institution' ? 'checked' : ''}>
            <span class="mform-card-ico">${picto('institution')}</span>
            <span class="mform-card-corps"><span class="mform-card-titre">${trad('Institution')}</span></span>
          </label>
        </div>
        <div class="hint" id="su-institution-note"${state.structureType === 'institution' ? '' : ' hidden'}>${trad('Mairie, province, établissement public… : la facturation mensuelle sur facture est possible. La demande se fait depuis l\'application, après l\'inscription.')}</div>

        <div class="field-row">
          <div id="su-name-groupe"${state.structureType === 'individual' ? ' hidden' : ''}>
            <label for="su-name" class="label-avec-note"><span>${trad('Nom de la structure')} <span class="requis">*</span></span><span class="label-annotation">${trad('Majuscules')}</span></label>
            <input id="su-name" class="majuscules" autocomplete="off" autocapitalize="characters"${state.structureType === 'individual' ? '' : ' required'} value="${esc(state.name)}">
          </div>
          <div>
            <label for="su-activity">${trad('Activité')} <span class="requis">*</span></label>
            <select id="su-activity">
              ${SIGNUP_ACTIVITIES.map(a => `<option value="${a}" ${a === state.activity ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="field-row">
          <div>
            <label for="su-pays">${trad('Pays')} <span class="requis">*</span></label>
            <select id="su-pays">${optionsPaysSocieteHtml(state.country)}</select>
          </div>
          <div>
            <label for="su-reg" id="su-reg-etiquette">${libelleRegistre(state.country)}</label>
            <input id="su-reg" autocomplete="off" value="${esc(state.registrationNumber)}">
          </div>
        </div>
        <div class="hint" id="su-devise-indice">${tR('Devise : {devise}', { devise: libelleDevise(deviseDuPays(state.country)) })}</div>
        <div class="field-row">
          <div>
            ${champTelephoneHtml('su-phone', state.phone, { labelHtml: `${esc(trad('Numéro de téléphone'))} <span class="requis">*</span>`, required: true, indicatifSeul: true })}
          </div>
        </div>
        <div class="hint">${trad('Coordonnée de contact de la société.')}</div>

        <div class="field-row">
          <div>
            <label for="su-contact-first">${trad('Prénom du contact')} <span class="requis">*</span></label>
            <input id="su-contact-first" autocomplete="given-name" autocapitalize="words" required value="${esc(state.contactFirstName)}">
          </div>
          <div>
            <label for="su-contact-last" class="label-avec-note"><span>${trad('Nom du contact')} <span class="requis">*</span></span><span class="label-annotation">${trad('Majuscules')}</span></label>
            <input id="su-contact-last" class="majuscules" autocomplete="family-name" autocapitalize="characters" required value="${esc(state.contactLastName)}">
          </div>
        </div>

        <div class="field-row">
          <div>
            <label for="su-email">${trad('Email de connexion')} <span class="requis">*</span></label>
            <input id="su-email" type="email" autocomplete="username" required value="${esc(state.email)}">
          </div>
          <div>
            <label for="su-password" class="label-avec-note"><span>${trad('Mot de passe')} <span class="requis">*</span></span><span class="label-annotation">${trad('Min. 6 car.')}</span></label>
            <div class="password-wrap">
              <input id="su-password" type="password" autocomplete="new-password" required minlength="6">
              <button type="button" class="toggle-pw-btn" aria-pressed="false">${trad('Afficher')}</button>
            </div>
          </div>
        </div>
        <div class="hint" id="su-error"></div>

        <div class="callout">
          <span class="card-ico">${picto('mail')}</span>
          <span>${trad('Un code de vérification à 6 chiffres te sera envoyé par e-mail après validation.')}</span>
        </div>

        <div class="modal-actions">
          <button type="button" class="secondary" id="su-cancel">${trad('Annuler')}</button>
          <button type="submit" class="primary">${trad('Créer le compte')}</button>
        </div>
        <p class="signup-login-line">${trad('Déjà un compte ?')} <button type="button" class="link-inline" id="su-goto-login">${trad('Se connecter')}</button></p>
      </form>
    `);

    habillerSelect(overlay.querySelector('#su-activity'), trad('Activité'));
    habillerSelect(overlay.querySelector('#su-pays'), trad('Pays'));
    overlay.querySelector('#su-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#su-close-x').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#su-goto-login').addEventListener('click', () => { overlay.remove(); renderLogin(); });
    const marquerTypeSelectionne = () => {
      overlay.querySelectorAll('input[name=stype]').forEach((radio) => {
        radio.closest('.mform-card')?.classList.toggle('is-selected', radio.checked);
      });
    };
    marquerTypeSelectionne();
    // « Indépendant / Patenté » n'a pas de raison sociale distincte de son nom
    // propre : le champ « Nom de la structure » disparaît (il ferait doublon
    // avec Prénom/Nom du contact juste en dessous), et l'activité reprend
    // toute la largeur de la ligne. À la soumission, le nom envoyé au serveur
    // est alors le nom complet du contact — voir plus bas.
    const groupeNom = overlay.querySelector('#su-name-groupe');
    const champNom = overlay.querySelector('#su-name');
    overlay.querySelectorAll('input[name=stype]').forEach(r => {
      r.addEventListener('change', () => {
        marquerTypeSelectionne();
        state.structureType = overlay.querySelector('input[name=stype]:checked').value;
        const estIndependant = state.structureType === 'individual';
        groupeNom.hidden = estIndependant;
        champNom.required = !estIndependant;
        const noteInstitution = overlay.querySelector('#su-institution-note');
        if (noteInstitution) noteInstitution.hidden = state.structureType !== 'institution';
        // Une institution relève du secteur public : l'activité est proposée d'office (elle reste modifiable).
        if (state.structureType === 'institution') {
          const selectActivite = overlay.querySelector('#su-activity');
          const secteurPublic = Array.from(selectActivite.options).find((o) => o.value === trad('Collectivité / Secteur public'));
          if (secteurPublic) {
            selectActivite.value = secteurPublic.value;
            const libelleBouton = overlay.querySelector('#su-activity-bouton span');
            if (libelleBouton) libelleBouton.textContent = secteurPublic.textContent;
          }
        }
      });
    });

    wireChampTelephone(overlay, 'su-phone');

    // L'INDICATIF SUIT LE PAYS CHOISI (France par défaut → +33), tant que la personne ne l'a pas réglé elle-même :
    // dès qu'elle touche à l'indicatif, il ne bouge plus. Un pays sans indicatif dans la liste laisse l'indicatif tel quel.
    let indicatifChoisiAMain = false;
    let alignement = false;
    const selectIndicatif = overlay.querySelector('#su-phone-pays');
    selectIndicatif?.addEventListener('change', () => { if (!alignement) indicatifChoisiAMain = true; });
    const alignerIndicatifSurPays = (codePays) => {
      const p = PAYS_TEL.find((x) => x.code === codePays);
      if (!p || !selectIndicatif || selectIndicatif.value === p.code) return;
      alignement = true;
      selectIndicatif.value = p.code;
      const libelle = overlay.querySelector('#su-phone-pays-bouton span');
      if (libelle) libelle.textContent = '+' + p.indicatif;
      overlay.querySelector('#su-phone')?.dispatchEvent(new Event('input')); // redécoupe les chiffres déjà saisis, sans prendre le focus
      alignement = false;
    };
    alignerIndicatifSurPays(state.country);

    // Le nom de la structure et le nom de famille se saisissent en majuscules,
    // comme la marque et le modèle d'une machine : forcerMajuscules transforme
    // la VALEUR, pas seulement l'affichage — sinon « de niro » resterait tel
    // quel en base.
    forcerMajuscules(champNom);
    forcerMajuscules(overlay.querySelector('#su-contact-last'));
    // Le prénom commence toujours par une majuscule (la valeur est corrigée, pas seulement l'affichage).
    forcerPremiereMajuscule(overlay.querySelector('#su-contact-first'));

    // Le pays choisi décide du nom du numéro d'immatriculation (SIRET, RIDET, KvK…).
    brancherLibelleRegistre(overlay.querySelector('#su-pays'), overlay.querySelector('#su-reg-etiquette'));
    overlay.querySelector('#su-pays')?.addEventListener('change', (e) => {
      state.country = e.target.value;
      if (!indicatifChoisiAMain) alignerIndicatifSurPays(state.country);
      const indice = overlay.querySelector('#su-devise-indice');
      if (indice) indice.textContent = tR('Devise : {devise}', { devise: libelleDevise(deviseDuPays(state.country)) });
    });
    overlay.querySelector('#signup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = overlay.querySelector('#su-error');
      const submitBtn = e.target.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      submitBtn.textContent = trad('Envoi du code…');

      state.activity = overlay.querySelector('#su-activity').value;
      state.registrationNumber = overlay.querySelector('#su-reg').value.trim();
      state.country = overlay.querySelector('#su-pays').value || PAYS_DEFAUT_SOCIETE;
      const telSaisi = lireChampTelephone(overlay, 'su-phone');
      state.phone = telSaisi ? telSaisi.e164 : '';
      state.contactFirstName = premiereMajuscule(overlay.querySelector('#su-contact-first').value.trim());
      state.contactLastName = overlay.querySelector('#su-contact-last').value.trim();
      state.contactName = contactFullName(state.contactFirstName, state.contactLastName);
      // Indépendant : pas de champ « Nom de la structure », le nom envoyé au
      // serveur est donc celui du contact — la seule identité saisie.
      state.name = state.structureType === 'individual' ? state.contactName : overlay.querySelector('#su-name').value.trim();
      state.email = overlay.querySelector('#su-email').value.trim();
      state.password = overlay.querySelector('#su-password').value;

      try {
        const { data, error } = await sb.auth.signUp({ email: state.email, password: state.password, options: { data: { langue: LANGUE } } });
        if (error) throw error;
        // Supabase ne dit pas « cette adresse a déjà un compte » (protection contre
        // l'énumération) : il renvoie un utilisateur SANS identité et n'envoie
        // aucun e-mail. Sans ce contrôle, l'écran annonçait un code qui
        // n'arriverait jamais.
        if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          stepDejaInscrit();
          return;
        }
        stepVerify();
      } catch (err) {
        errorEl.textContent = trad('Erreur :') + " " + err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = trad('Créer le compte');
      }
    });
  }

  // Un compte existe déjà avec cette adresse : l'écran de vérification n'a plus
  // de sens, puisqu'aucun code ne sera envoyé (Supabase ne révèle pas qu'une
  // adresse est déjà prise, et n'écrit donc rien). On propose les deux chemins
  // utiles au lieu de laisser attendre un code qui n'arrivera pas.
  function stepDejaInscrit() {
    shell(`
      <h2>${trad('Cette adresse a déjà un compte')}</h2>
      <p class="sub">${trad('Un compte existe déjà avec cette adresse. Connecte-toi avec ton mot de passe, ou demandes-en un nouveau.')}</p>
      <div class="modal-actions">
        <button type="button" class="secondary" id="deja-forgot">${trad('Mot de passe oublié ?')}</button>
        <button type="button" class="primary" id="deja-login">${trad('Se connecter')}</button>
      </div>
    `);
    overlay.querySelector('#deja-forgot').addEventListener('click', () => { overlay.remove(); openForgotPasswordModal(); });
    overlay.querySelector('#deja-login').addEventListener('click', () => { overlay.remove(); renderLogin(); });
  }

  function stepVerify() {
    shell(`
      <h2>${trad('Vérifie ton email')}</h2>
      <p class="sub">${tR('Un code à 6 chiffres a été envoyé à {email}. Saisis-le ci-dessous pour activer ton compte.', { email: esc(state.email) })}</p>
      <form id="verify-form">
        <label for="su-code">${trad('Code de vérification')}</label>
        <input id="su-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" required autofocus style="letter-spacing:6px;font-size:20px;text-align:center;">
        <div class="hint" id="verify-error"></div>
        <div class="resend-row">
          <button type="button" class="link-inline" id="verify-resend">${trad('Renvoyer le code')}</button>
          <span class="hint" id="verify-resend-msg" role="status" aria-live="polite"></span>
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary" id="verify-cancel">${trad('Annuler')}</button>
          <button type="submit" class="primary">${trad('Valider')}</button>
        </div>
      </form>
    `);
    overlay.querySelector('#verify-cancel').addEventListener('click', () => overlay.remove());

    // Sans renvoi possible, un code non reçu condamnait l'inscription.
    const resendBtn = overlay.querySelector('#verify-resend');
    const resendMsg = overlay.querySelector('#verify-resend-msg');
    let cooldown = 0;
    let cooldownTimer = null;
    resendBtn.addEventListener('click', async () => {
      if (cooldown > 0) return;
      resendBtn.disabled = true;
      resendMsg.textContent = trad('Envoi…');
      try {
        const { error } = await sb.auth.resend({ type: 'signup', email: state.email });
        if (error) throw error;
        resendMsg.textContent = trad('Nouveau code envoyé.');
      } catch (err) {
        // « déjà confirmé » n'est pas une panne d'envoi : c'est un compte qui
        // existe. On le dit, au lieu d'afficher un message technique.
        if (/already confirmed|already registered|déjà/i.test(String(err.message))) {
          stepDejaInscrit();
          return;
        }
        resendMsg.textContent = trad('Envoi impossible :') + " " + err.message;
      }
      cooldown = 30;
      const tick = () => {
        if (cooldown <= 0) {
          resendBtn.disabled = false;
          resendBtn.textContent = trad('Renvoyer le code');
          clearInterval(cooldownTimer);
          return;
        }
        resendBtn.textContent = tR('Renvoyer dans {n} s', { n: cooldown });
        cooldown--;
      };
      tick();
      cooldownTimer = setInterval(tick, 1000);
    });
    overlay.querySelector('#verify-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = overlay.querySelector('#verify-error');
      const submitBtn = e.target.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      submitBtn.textContent = trad('Vérification…');
      const code = overlay.querySelector('#su-code').value.trim();
      try {
        const { data, error } = await sb.auth.verifyOtp({ email: state.email, token: code, type: 'signup' });
        if (error) throw error;

        // Les colonnes prénom/nom n'existent qu'après migration-compte.sql :
        // on les ajoute à l'insertion seulement si elles sont là.
        const { error: sondeContact } = await sb.from('companies').select('contact_first_name').limit(1);
        const colonnesContact = sondeContact
          ? {}
          : { contact_first_name: state.contactFirstName || null, contact_last_name: state.contactLastName || null };

        // ★ MÊME RÈGLE QU'À L'ÉCRAN « CRÉER MA SOCIÉTÉ » : une seule écriture,
        //   côté serveur, atomique et idempotente. Le second `insert` d'origine
        //   produisait la même collision de clé dès que le profil existait déjà,
        //   et la société créée juste avant restait sans membre.
        const { error: creationErr } = await sb.rpc('creer_ma_societe', {
          p_nom: state.name,
          p_activite: state.activity || null,
        });
        if (creationErr && !fonctionAbsente(creationErr)) throw creationErr;
        if (creationErr) await creerSocieteEtProfil(state.name, state.activity, data.user);

        // Les informations qui ne servent PAS à créer la société (registre,
        // téléphone, contact) passent par le chemin d'écriture déjà sanctionné —
        // c'est lui qui tient `contact_name` à jour pour l'accueil.
        const { error: infosErr } = await sb.rpc('update_my_company', {
          p_registration_number: state.registrationNumber || null,
          p_phone: state.phone || null,
          ...(colonnesContact.contact_first_name ? { p_contact_first_name: colonnesContact.contact_first_name } : {}),
          ...(colonnesContact.contact_last_name ? { p_contact_last_name: colonnesContact.contact_last_name } : {}),
        });
        await enregistrerNomDuProfil(state.contactName);
        // Le type de structure (société, indépendant, institution) : fonction dédiée, tolérée absente tant que la
        // migration structure-societe.sql n'est pas passée. « société » est la valeur par défaut en base : rien à écrire.
        if (state.structureType !== 'company') {
          const { error: typeErr } = await sb.rpc('update_my_structure_type', { p_type: state.structureType });
          if (typeErr && !fonctionAbsente(typeErr)) console.warn('Type de structure non enregistré :', typeErr.message);
        }
        // Le pays d'exploitation : fonction dédiée (sans elle, la base n'a pas encore la colonne — on l'ignore).
        const { error: paysErr } = await sb.rpc('update_my_country', { p_country: state.country });
        if (paysErr && !fonctionAbsente(paysErr)) console.warn('Pays non enregistré :', paysErr.message);
        // La devise suit le pays. La société vient d'être créée : aucun montant à convertir, on enregistre donc la
        // devise directement. L'euro est la valeur par défaut, seul le franc Pacifique demande une écriture. Un échec
        // ne bloque pas l'inscription : la devise se change ensuite dans Mon compte.
        if (deviseDuPays(state.country) === 'XPF') {
          const { error: deviseErr } = await sb.rpc('update_my_tco_settings', {
            p_labor_hourly_rate: null, p_default_insurance_yearly: null, p_default_storage_yearly: null, p_currency: 'XPF',
          });
          if (deviseErr && !fonctionAbsente(deviseErr)) console.warn('Devise non enregistrée :', deviseErr.message);
        }
        // Un échec ici ne remet pas en cause la société : on ne bloque pas
        // l'inscription pour des coordonnées, mais on ne le tait pas non plus.
        if (infosErr && !fonctionAbsente(infosErr)) {
          console.warn('Coordonnées de société non enregistrées :', infosErr.message);
        }

        overlay.remove();
        boot();
      } catch (err) {
        errorEl.textContent = trad('Erreur :') + " " + err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = trad('Valider');
      }
    });
  }

  stepForm();
}

// Liens de paiement Stripe, UN PAR OFFRE — et UN PRODUIT PAR OFFRE côté Stripe,
// sans quoi le portail ne peut pas proposer le changement d'offre. Les clés sont
// celles des plans en base ('free', 'eco', 'pro') : la refonte tarifaire ne les
// renomme pas — elle change ce que le client LIT (Starter, Business), pas la clé
// technique, donc aucun client existant n'est migré.
//   eco  → Starter / Artisan — 12 €/mois
//   pro  → Business / Flotte — 39 €/mois
// `enterprise` n'a JAMAIS de lien ici, contrairement à eco/pro : le tarif
// ⚠️ 2026-10-06 : la grille AFFICHÉE passe à Enterprise 79 €/mois, 40 machines incluses, puis 1 €/machine jusqu'à 150 (Starter +2 €, Business
// +1,50 €, classe « Grand compte » sur devis). La FACTURATION n'a pas suivi : adapter le prix à l'usage (Stripe/Stancer), les limites
// (LIMITES_OFFRES, déclencheur de la base, fonction de rappels) et décider du sort des clients actuels AVANT toute mise en ligne.
// Ancien tarif : réel est "49 €/mois + 1 €/machine au-delà de 20" (revu à la baisse le
// 2026-09-26 — l'écart avec Business à 39 €/20 machines était trop brutal
// pour un client à 21 machines, voir keeva-tco-feature), un lien de
// paiement Stripe classique ne peut représenter qu'un montant FIXE.
// L'ancien lien "89 €/mois fixe" (jamais branché en UI non plus) a été
// archivé côté Stripe. Le vrai palier Enterprise vit dans un prix à
// l'usage (paliers gradués + compteur, voir signaler-usage-entreprise et
// creer-checkout-entreprise) : une session Checkout créée à la demande,
// pas un lien statique — Stripe n'accepte pas les prix à l'usage dans un
// lien de paiement classique (vérifié en test avant de construire quoi
// que ce soit). contactEnterprise() (mailto) reste le repli si la session
// ne peut pas être créée.
// ⚠️ MISE À JOUR 2026-10-08 (nouvelle grille) : Enterprise est de nouveau un forfait FIXE (79 €/mois, 40 machines incluses)
// avec des machines en plus à 1 € — comme Starter et Business. Un lien de paiement classique convient donc (le paragraphe
// ci-dessus décrit l'ancienne grille graduée, abandonnée le 2026-10-06). Les machines en plus sont facturées par la fonction
// `stripe-sync-machines`, jamais par le lien lui-même.
const STRIPE_LIENS = {
  eco: "https://buy.stripe.com/7sYdR8ctfc2Q82LbBwf3a06",   // KALEA Starter / Artisan — 12 €/mois (lien recréé 2026-09-25, l'ancien tarif à 5 € a été archivé)
  pro: "https://buy.stripe.com/7sYeVc8cZ0k84Qz9tof3a07",   // KALEA Business / Flotte — 39 €/mois (lien recréé 2026-09-25, l'ancien tarif à 20 € a été archivé)
  paid: "https://buy.stripe.com/9B628q9h3gj64Qz6hcf3a0a",  // KALEA Enterprise / Parc — 79 €/mois (créé 2026-10-08, métadonnée plan=paid)
};

// LA GRILLE TARIFAIRE, ÉCRITE UNE SEULE FOIS. Quatre offres, et pour chacune
// les TROIS enveloppes séparées : analyses de carnet, recherches de photo,
// lectures de compteur. Les trois chiffres ne sont pas décoratifs : la lecture
// de compteur a son PROPRE compteur, elle ne consomme pas les analyses du
// carnet (voir consume_ai_quota, migration-plafonds-usages.sql).
//
// ⚠️ LES CLÉS DE PAIEMENT RESTENT 'eco' ET 'pro' : ce sont les clés des plans
// en base et des liens Stripe déjà ouverts. On change ce que le CLIENT LIT, pas
// la clé technique — aucune migration n'est faite ici.
//
// Les plafonds ne sont pas réinventés : ce sont ceux de migration-plafonds-usages.sql.
const OFFRE_GRILLE = [
  {
    cle: 'free',
    offre: trad('Gratuit'),
    machines: trad('2 machines'),
    supplement: '',
    utilisateurs: trad('1 utilisateur'),
    prix: trad('0 €'),
    analyses: trad('10 analyses de carnet'),
    lectures: trad('30 lectures de compteur'),
    inclus: trad('consultation, rappels e-mail et notifications'),
    recommandee: false,
  },
  {
    cle: 'starter',
    offre: trad('Starter / Artisan'),
    machines: trad('5 machines'),
    supplement: trad('+ 2 € / machine en plus, jusqu\'à 10'),
    utilisateurs: trad('1 utilisateur'),
    prix: trad('12 €/mois'),
    analyses: trad('20 analyses de carnet'),
    lectures: trad('200 lectures de compteur'),
    inclus: trad('export CSV'),
    recommandee: false,
  },
  {
    cle: 'business',
    offre: trad('Business / Flotte'),
    machines: trad('20 machines'),
    supplement: trad('+ 1,50 € / machine en plus, jusqu\'à 40'),
    utilisateurs: trad('3 utilisateurs'),
    prix: trad('39 €/mois'),
    analyses: trad('30 analyses de carnet'),
    lectures: trad('500 lectures de compteur'),
    inclus: trad('multi-utilisateurs (3), QR codes, préparation groupée, module Coûts & TCO'),
    recommandee: true,
  },
  {
    cle: 'enterprise',
    offre: trad('Enterprise / Parc'),
    machines: trad('40 machines'),
    supplement: trad('+ 1 € / machine en plus, jusqu\'à 150'),
    utilisateurs: trad('rôles d\'équipe'),
    prix: trad('79 €/mois'),
    analyses: trad('5 000 analyses de carnet'),
    lectures: trad('2 000 lectures de compteur'),
    inclus: trad('support dédié, module Stocks & SAV, télémétrie (connexion et suivi)'),
    recommandee: false,
  },
];

// LA CINQUIÈME CLASSE : « Grand compte », au-delà de 150 machines. Pas de carte ni de lien de paiement : un devis, par e-mail.
const OFFRE_GRAND_COMPTE = {
  cle: 'grand_compte',
  offre: trad('Grand compte'),
  machines: trad('plus de 150 machines'),
  utilisateurs: trad('sur mesure'),
  prix: trad('sur devis'),
  analyses: trad('quota sur devis'),
  lectures: trad('quota sur devis'),
};

// Le tableau « Ce que chaque classe apporte » : une seule source, lue par la fenêtre des offres. Colonnes dans l'ordre
// Gratuit, Starter, Business, Enterprise, Grand compte. `true` = inclus (coche), `false` = non inclus (tiret), texte = valeur.
const COMPARATIF_OFFRES = {
  colonnes: ['free', 'starter', 'business', 'enterprise', 'grand_compte'],
  lignes: [
    { etiquette: trad('Prix par mois'), valeurs: [trad('0 €'), trad('12 €'), trad('39 €'), trad('79 €'), trad('sur devis')] },
    { etiquette: trad('Machines incluses'), valeurs: ['2', '5', '20', '40', trad('plus de 150')] },
    { etiquette: trad('Machines en plus'), valeurs: [false, trad('+ 2 € (jusqu\'à 10)'), trad('+ 1,50 € (jusqu\'à 40)'), trad('+ 1 € (jusqu\'à 150)'), trad('tarif dégressif')] },
    { etiquette: trad('Utilisateurs'), valeurs: ['1', '1', '3', trad('rôles d\'équipe'), trad('sur mesure')] },
    { etiquette: trad('Consultation, rappels e-mail et notifications'), valeurs: [true, true, true, true, true] },
    { etiquette: trad('Export CSV'), valeurs: [false, true, true, true, true] },
    { etiquette: trad('QR codes, préparation groupée, Coûts & TCO'), valeurs: [false, false, true, true, true] },
    { etiquette: trad('Stocks & SAV, support dédié'), valeurs: [false, false, false, true, true] },
    { etiquette: trad('Télémétrie (connexion et suivi)'), valeurs: [false, false, false, true, true] },
    { etiquette: trad('Intégrations sur mesure, accompagnement, contrat annuel'), valeurs: [false, false, false, false, true] },
    { etiquette: trad('Analyses de carnet par mois'), valeurs: ['10', '20', '30', '5 000', trad('sur devis')] },
    { etiquette: trad('Lectures de compteur par mois'), valeurs: ['30', '200', '500', '2 000', trad('sur devis')] },
  ],
};

// Les clés en base qui n'ont pas de carte à elles : elles sont MONTRÉES avec le
// nom de l'offre qui les remplace, sans rien migrer (grandfathering).
const OFFRES_HISTORIQUES = { eco: 'starter', pro: 'business', paid: 'enterprise', unlimited: 'enterprise' };

function offreDeLaGrille(cle) {
  const visee = OFFRES_HISTORIQUES[cle] || cle;
  return OFFRE_GRILLE.find((o) => o.cle === visee) || OFFRE_GRILLE[0];
}

// Les QR codes sont annoncés dans l'offre Business (voir `inclus` de
// OFFRE_GRILLE ci-dessus). On réutilise offreDeLaGrille() plutôt que de
// dupliquer une liste de clés de plan à la main : elle gère déjà le
// grandfathering (OFFRES_HISTORIQUES) et c'est la MÊME fonction qui décide
// quel palier afficher sur l'écran des offres — aucune chance de diverger.
function planCouvreQr() {
  return ['business', 'enterprise'].includes(offreDeLaGrille(UI.companyPlan || 'free').cle);
}

// Le SCANNER de QR codes est retiré de l'offre Gratuit (décision du 2026-10-07) ; il reste disponible dès Starter.
// La GÉNÉRATION des QR codes, elle, reste réservée à Business et Enterprise (planCouvreQr).
function planPermetScannerQr() {
  return offreDeLaGrille(UI.companyPlan || 'free').cle !== 'free';
}

// Plusieurs utilisateurs (rôles Droit de gestion / Droit de saisie) : à partir de Business. Gratuit et Starter n'ont qu'un
// utilisateur — le gérant — d'après la grille des offres ; personne ne peut donc occuper les autres rôles.
function planMultiUtilisateurs() {
  return ['business', 'enterprise'].includes(offreDeLaGrille(UI.companyPlan || 'free').cle);
}

// TCO : réservé aux paliers Business et Enterprise (demande explicite de
// l'utilisateur — dissocié du Starter). Même principe que planCouvreQr()
// juste au-dessus : offreDeLaGrille() gère le grandfathering, même
// fonction que l'écran des offres. `SCHEMA.hasTco` (le VRAI indicateur de
// schéma, sondé au boot) reste volontairement indépendant du palier — une
// société qui rétrograde continue de savoir que sa base a la migration,
// seul `tcoActif()` décide si le module reste ACCESSIBLE. Tous les points
// d'affichage/écriture du fichier lisent `tcoActif()`, jamais `SCHEMA.hasTco`
// seul, pour ce calcul.
function planCouvreTco() {
  return ['business', 'enterprise'].includes(offreDeLaGrille(UI.companyPlan || 'free').cle);
}
function tcoActif() {
  return SCHEMA.hasTco && planCouvreTco();
}
