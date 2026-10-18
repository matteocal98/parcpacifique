// Génère les corrections du THÈME SOMBRE pour les couleurs écrites EN DUR dans styles.css et kit.css.
//
// Les variables (--surface, --ink, --line, …) sont redéfinies à la main dans le bloc « THÈME SOMBRE » de kit.css. Mais ~800 couleurs sont
// écrites en dur (#fff, #E4E8F2, rgba(14,19,51,.08), …) : elles resteraient claires. Ce script lit les deux feuilles, repère chaque règle
// qui pose un fond, un texte, une bordure ou une ombre en couleur claire/sombre « en dur », et écrit la règle sombre équivalente, préfixée de
// html[data-theme="dark"] (même @media que l'original, même !important). Le résultat est écrit en fin de kit.css, entre deux marqueurs.
//
// Règles de conversion (par valeur, jamais par écran) :
//   fond blanc / gris clair neutre → --surface ; pastel coloré → la même teinte en transparence ; voile blanc → voile blanc léger ;
//   fond var(--ink) (bouton « plein ») → indigo de marque #5B52DF ; encre rgba(14,19,51,x) → blanc cassé translucide ;
//   texte sombre neutre → --ink ; texte coloré foncé → même teinte éclaircie ; bordures claires → --line ; ombres → noires.
// Usage : node outils/generer-theme-sombre.mjs   (à relancer après toute modification de styles.css / kit.css)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEBUT = '/* SOMBRE-GENERE:DEBUT — produit par outils/generer-theme-sombre.mjs : NE PAS MODIFIER À LA MAIN */';
const FIN = '/* SOMBRE-GENERE:FIN */';

// ── couleurs
function analyser(v) {
  v = v.trim().toLowerCase();
  if (v === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (v === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = v.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?|var\([^)]*\)))?\s*\)$/);
  if (m) { let a = (m[4] === undefined || m[4].startsWith('var')) ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return { r: +m[1], g: +m[2], b: +m[3], a }; }
  return null;
}
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const sature = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
const arrondi = (x) => Math.round(x * 100) / 100;
const rgba = (r, g, b, a) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${arrondi(a)})`;
const eclaircir = (c, k) => ({ r: c.r + (255 - c.r) * k, g: c.g + (255 - c.g) * k, b: c.b + (255 - c.b) * k });
const estEncre = (c) => Math.abs(c.r - 14) < 8 && Math.abs(c.g - 19) < 8 && Math.abs(c.b - 51) < 14; // encre de la charte

function fond(valeur) {
  if (/var\(--ink\)/.test(valeur) && valeur.trim().replace(/!important/, '').trim() === 'var(--ink)') return '#5B52DF';
  const c = analyser(valeur);
  if (!c) return null;
  if (c.a === 0) return null;
  if (estEncre(c) && c.a < 0.5) return rgba(255, 255, 255, Math.min(0.2, c.a * 1.6)); // teinte d'encre translucide → voile clair
  const l = lum(c);
  if (c.a < 1) {
    if (c.r > 245 && c.g > 245 && c.b > 245) return c.a >= 0.9 ? 'var(--surface)' : rgba(255, 255, 255, Math.min(0.1, c.a * 0.14)); // voile blanc
    if (c.a >= 0.5 && l > 0.6 && sature(c) <= 40) return 'var(--surface-soft)'; // gris clair translucide (piste de barre…)
    return null; // autre translucide coloré : déjà lisible sur fond sombre
  }
  if (estEncre(c) || l < 0.12) return null; // fond déjà sombre
  if (l > 0.55 && sature(c) <= 28) return l > 0.9 ? 'var(--surface)' : 'var(--surface-soft)';
  if (l > 0.55) return rgba(c.r, c.g, c.b, 0.2); // pastel coloré : même teinte, en transparence
  return null;
}
function texte(valeur) {
  const c = analyser(valeur);
  if (!c) return null;
  if (c.a === 0) return null;
  if (estEncre(c)) return c.a >= 0.95 ? 'var(--ink)' : rgba(255, 255, 255, Math.min(0.92, c.a + 0.1));
  const l = lum(c);
  if (l < 0.1 && sature(c) <= 40) return c.a >= 0.95 ? 'var(--ink)' : rgba(255, 255, 255, Math.min(0.92, c.a + 0.1));
  if (l < 0.25 && sature(c) > 40) { const e = eclaircir(c, 0.55); return rgba(e.r, e.g, e.b, c.a); }
  return null;
}
function bordure(valeur) {
  const c = analyser(valeur);
  if (!c || c.a === 0) return null;
  if (estEncre(c)) return c.a >= 0.95 ? 'var(--ink)' : rgba(255, 255, 255, Math.min(0.5, c.a));
  const l = lum(c);
  if (c.a < 1 && c.r > 245) return rgba(255, 255, 255, Math.min(0.2, c.a));
  if (c.a === 1 && l > 0.6 && sature(c) <= 40) return 'var(--line)';
  if (c.a === 1 && l > 0.6) return rgba(c.r, c.g, c.b, 0.4);
  return null;
}
function ombre(valeur) {
  return valeur.replace(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g, (m) => {
    const c = analyser(m); if (!c) return m;
    return rgba(0, 0, 0, Math.min(0.65, Math.max(0.3, c.a * 2.2)));
  });
}
const SEPARE = /(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b|\bwhite\b|\bblack\b)/g;

// ── lecture des feuilles (pile des @media / @supports)
function lireRegles(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regles = []; const pile = []; let i = 0; let tampon = '';
  while (i < css.length) {
    const c = css[i];
    if (c === '{') {
      const prelude = tampon.trim(); tampon = '';
      if (/^@(media|supports|layer)/i.test(prelude)) { pile.push(prelude); i++; continue; }
      if (/^@/.test(prelude)) { // @font-face, @keyframes… : on saute le bloc entier
        let prof = 1; i++;
        while (i < css.length && prof) { if (css[i] === '{') prof++; else if (css[i] === '}') prof--; i++; }
        continue;
      }
      let j = i + 1, prof = 1;
      while (j < css.length && prof) { if (css[j] === '{') prof++; else if (css[j] === '}') prof--; j++; }
      regles.push({ selecteur: prelude, corps: css.slice(i + 1, j - 1), contexte: pile.slice() });
      i = j; continue;
    }
    if (c === '}') { pile.pop(); tampon = ''; i++; continue; }
    tampon += c; i++;
  }
  return regles;
}
function separerSelecteurs(s) {
  const out = []; let prof = 0, cur = '';
  for (const c of s) { if (c === '(' || c === '[') prof++; if (c === ')' || c === ']') prof--; if (c === ',' && !prof) { out.push(cur.trim()); cur = ''; } else cur += c; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function corrections(regle) {
  const decls = [];
  for (const brut of regle.corps.split(/;(?![^(]*\))/)) {
    const m = brut.match(/^\s*([a-z-]+)\s*:\s*([\s\S]+?)\s*$/i); if (!m) continue;
    const prop = m[1].toLowerCase(); let val = m[2]; const important = /!important/.test(val); val = val.replace(/\s*!important/, '').trim();
    let nouveau = null;
    if (prop === 'background' || prop === 'background-color') {
      if (!/gradient|url\(/.test(val)) nouveau = fond(val);
    } else if (prop === 'color') nouveau = texte(val);
    else if (prop === 'font-weight') nouveau = ({ normal: '500', 400: '500', 500: '600', 600: '700' })[val] || null; // graisse +1 cran en sombre (texte clair sur fond sombre : paraît plus fin)
    else if (/^(border|outline)(-(top|right|bottom|left))?-color$/.test(prop)) nouveau = bordure(val);
    else if (/^(border|outline)(-(top|right|bottom|left))?$/.test(prop) && !/var\(--/.test(val)) {
      const parts = val.split(SEPARE); let change = false;
      const rec = parts.map((p) => { if (!SEPARE.test(p)) { SEPARE.lastIndex = 0; return p; } SEPARE.lastIndex = 0; const b = bordure(p); if (b) { change = true; return b; } return p; });
      if (change) nouveau = rec.join('');
    } else if (prop === 'box-shadow' && /rgba?\(|#/.test(val)) {
      const o = ombre(val); if (o !== val) nouveau = o;
    }
    if (nouveau) decls.push(`${prop}:${nouveau}${important ? ' !important' : ''}`);
  }
  return decls;
}

const sources = ['styles.css', 'kit.css'];
const sortie = [];
for (const f of sources) {
  let css = fs.readFileSync(path.join(RACINE, f), 'utf8');
  const a = css.indexOf(DEBUT); if (a >= 0) css = css.slice(0, a);
  for (const r of lireRegles(css)) {
    if (!r.selecteur || /^(html|:root)/.test(r.selecteur.trim()) && !r.selecteur.includes(',')) continue;
    const d = corrections(r); if (!d.length) continue;
    const sels = separerSelecteurs(r.selecteur).filter((s) => !/^(:root|html)\b/.test(s)).map((s) => `html[data-theme="dark"] ${s}`);
    if (!sels.length) continue;
    let regle = `${sels.join(',')}{${d.join(';')}}`;
    for (let k = r.contexte.length - 1; k >= 0; k--) regle = `${r.contexte[k]}{${regle}}`;
    sortie.push(regle);
  }
}
// Couleurs écrites EN DUR dans les gabarits JavaScript (style="background:#EEF2FF…", ou passées en paramètre puis écrites en style en ligne) :
// une règle CSS ne peut battre un style en ligne qu'avec !important et un sélecteur d'attribut. On relève tous les codes hexadécimaux des
// fichiers app-*.js et on écrit, pour chacun, la correction sombre correspondante (fond ou texte).
const hexJs = new Set();
for (const f of fs.readdirSync(RACINE).filter((n) => /^app-.*.js$/.test(n))) {
  for (const m of fs.readFileSync(path.join(RACINE, f), 'utf8').matchAll(/#[0-9a-fA-F]{6}(?![0-9a-fA-F])|#[0-9a-fA-F]{3}(?![0-9a-fA-F])/g)) hexJs.add(m[0].toUpperCase());
}
console.log("hex JS relevés :", hexJs.size);
for (const hex of [...hexJs].sort()) {
  const fd = fond(hex);
  if (fd) sortie.push(`html[data-theme="dark"] [style*="background:${hex}" i],html[data-theme="dark"] [style*="background: ${hex}" i],html[data-theme="dark"] [style*="background-color:${hex}" i]{background:${fd} !important}`);
  const tx = texte(hex);
  if (tx) sortie.push(`html[data-theme="dark"] [style*="color:${hex}" i]:not([style*="background-color:${hex}" i]),html[data-theme="dark"] [style*="color: ${hex}" i]:not([style*="background-color: ${hex}" i]){color:${tx} !important}`);
}
// kit.css : retirer l'ancien bloc généré puis écrire le nouveau
const chemin = path.join(RACINE, 'kit.css');
let kit = fs.readFileSync(chemin, 'utf8');
const a = kit.indexOf(DEBUT);
if (a >= 0) kit = kit.slice(0, a).replace(/\s+$/, '') + '\n';
kit += `\n${DEBUT}\n${sortie.join('\n')}\n${FIN}\n`;
fs.writeFileSync(chemin, kit);
console.log(`${sortie.length} règles sombres générées (${(sortie.join('\n').length / 1024).toFixed(0)} Ko)`);
