// Console d'administration (admin.html) : thème sombre.
//
// admin.html charge Tailwind depuis son CDN et déclare ses couleurs dans `tailwind.config` (jetons « Material » : surface,
// on-surface, outline-variant…). Ce script :
//   1. réécrit ces couleurs en `rgb(var(--c-<nom>) / <alpha-value>)` : la même classe (bg-surface, text-on-surface/80…) lit
//      alors une variable ; les modificateurs d'opacité de Tailwind continuent de fonctionner ;
//   2. écrit admin-sombre.css : les variables du thème clair (valeurs d'origine, inchangées) et celles du thème sombre
//      (html[data-theme="dark"], posé par theme.js), plus les quelques couleurs écrites en dur dans la page ;
//   3. resynchronise l'empreinte CSP d'admin.html (le script de configuration est « inline »).
// Relancer après toute modification des couleurs d'admin.html. Usage : node outils/generer-admin-sombre.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(RACINE, 'admin.html');

// Valeurs d'ORIGINE (thème clair). Ne pas les changer ici sans changer l'aspect clair de la console.
const CLAIR = {
  'background': '#fbf8ff', 'on-primary': '#ffffff', 'surface-container': '#edecff', 'tertiary': '#005952', 'primary': '#4236c6',
  'on-tertiary-fixed-variant': '#00504a', 'on-error-container': '#93000a', 'inverse-primary': '#c4c0ff', 'on-secondary-container': '#fefcff',
  'surface-container-high': '#e6e6ff', 'error-container': '#ffdad6', 'on-background': '#141939', 'on-surface-variant': '#464554',
  'surface-container-lowest': '#ffffff', 'secondary-fixed-dim': '#aec6ff', 'surface': '#fbf8ff', 'on-tertiary': '#ffffff',
  'on-primary-fixed': '#110068', 'primary-fixed-dim': '#c4c0ff', 'tertiary-fixed': '#78f7e8', 'inverse-surface': '#292e4f',
  'on-surface': '#141939', 'tertiary-container': '#00746b', 'error': '#ba1a1a', 'surface-variant': '#dfe0ff', 'on-primary-container': '#e7e4ff',
  'surface-tint': '#5248d6', 'secondary-fixed': '#d8e2ff', 'on-tertiary-fixed': '#00201d', 'primary-fixed': '#e3dfff', 'outline': '#777586',
  'on-primary-fixed-variant': '#392abd', 'on-secondary-fixed': '#001a42', 'tertiary-fixed-dim': '#58dacc', 'on-error': '#ffffff',
  'outline-variant': '#c8c4d7', 'secondary': '#0058be', 'on-tertiary-container': '#7cfbec', 'surface-container-highest': '#dfe0ff',
  'surface-dim': '#d4d7ff', 'on-secondary-fixed-variant': '#004395', 'surface-bright': '#fbf8ff', 'secondary-container': '#2671e2',
  'primary-container': '#5b52df', 'surface-container-low': '#f4f2ff', 'on-secondary': '#ffffff', 'inverse-on-surface': '#f0efff',
  'nuit': '#0D1424', 'encre': '#0E1333', 'signature-fr': '#24B5A8', 'signature-en': '#5B52DF', 'ardoise': '#94A3B8', 'ambre': '#DE7A16',
  'bleu-roi': '#236FE0', 'turquoise': '#14B8A6', 'olive': '#8B9B37', 'surface-light': '#FAF8FF', 'surface-card': '#FFFFFF', 'danger': '#BA1A1A',
};

// Thème SOMBRE (seulement ce qui change). Principe de l'application : page #0B0F22, éléments #141A33, sections teintées plus claires,
// textes presque blancs, accents éclaircis pour rester lisibles sur fond sombre, boutons pleins en indigo.
const SOMBRE = {
  'background': '#0B0F22', 'surface': '#0B0F22', 'surface-dim': '#080B1A', // surface-bright reste clair : sert de TEXTE clair sur la barre latérale sombre
  'surface-container-lowest': '#141A33', 'surface-container-low': '#181F3C', 'surface-container': '#1C2446',
  'surface-container-high': '#222B52', 'surface-container-highest': '#28325E', 'surface-variant': '#28325E',
  'on-background': '#F5F7FF', 'on-surface': '#F5F7FF', 'on-surface-variant': '#C9D0E6',
  'outline': '#8E98B8', 'outline-variant': '#3A4268',
  'primary': '#7067EE', 'on-primary': '#FFFFFF', 'primary-container': '#5B52DF', 'on-primary-container': '#FFFFFF',
  'inverse-primary': '#C4C0FF', 'surface-tint': '#7067EE',
  'secondary': '#6EA8FE', 'on-secondary': '#001A42', 'secondary-container': '#2671E2', 'on-secondary-container': '#FFFFFF',
  'tertiary': '#58DACC', 'on-tertiary': '#00201D', 'tertiary-container': '#00746B', 'on-tertiary-container': '#7CFBEC',
  'error': '#FF8A80', 'on-error': '#4C0000', 'error-container': '#5D1616', 'on-error-container': '#FFCDC8',
  // « inverse » = la barre latérale et les bulles sombres de la console : elles restent sombres (un cran plus que les cartes).
  'inverse-surface': '#10152C', 'inverse-on-surface': '#F0EFFF',
  // familles « fixed » : teintes claires en thème clair → teintes sombres, textes inversés
  'primary-fixed': '#2C286E', 'primary-fixed-dim': '#4A41C4', 'on-primary-fixed': '#E4E0FF', 'on-primary-fixed-variant': '#C4C0FF',
  'secondary-fixed': '#183060', 'secondary-fixed-dim': '#2F5FB3', 'on-secondary-fixed': '#D6E2FF', 'on-secondary-fixed-variant': '#AEC6FF',
  'tertiary-fixed': '#00504A', // tertiary-fixed-dim reste clair : texte d'accent sur la barre latérale
   'on-tertiary-fixed': '#78F7E8', 'on-tertiary-fixed-variant': '#58DACC',
  // couleurs de marque de la console
  'encre': '#F5F7FF', 'bleu-roi': '#6FA6FF', 'signature-en': '#9D97FF', 'surface-light': '#0B0F22', 'surface-card': '#141A33', 'danger': '#FF8A80',
};

const canaux = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
};

// 1. tailwind.config : couleurs → variables
let html = readFileSync(PAGE, 'utf8');
const crlf = html.includes('\r\n');
if (crlf) html = html.replace(/\r\n/g, '\n');
const debut = html.indexOf('"colors": {');
if (debut < 0) throw new Error('bloc "colors" introuvable dans tailwind.config');
const fin = html.indexOf('}', debut);
let bloc = html.slice(debut, fin + 1);
let nb = 0;
for (const nom of Object.keys(CLAIR)) {
  const re = new RegExp(`"${nom}": "(#[0-9a-fA-F]{6}|rgb\\(var\\(--c-${nom}\\) / <alpha-value>\\))"`);
  if (!re.test(bloc)) throw new Error(`couleur absente de la configuration : ${nom}`);
  bloc = bloc.replace(re, `"${nom}": "rgb(var(--c-${nom}) / <alpha-value>)"`);
  nb++;
}
html = html.slice(0, debut) + bloc + html.slice(fin + 1);

// 2. theme.js (en-tête, avant tout affichage) + feuille de style
const LIEN = '<link rel="stylesheet" href="./admin-sombre.css">\n<script src="./theme.js"></script>';
if (!html.includes('admin-sombre.css')) {
  if (!html.includes('<link href="https://fonts.googleapis.com" rel="preconnect"/>')) throw new Error('point d\'insertion de l\'en-tête introuvable');
  html = html.replace('<link href="https://fonts.googleapis.com" rel="preconnect"/>', LIEN + '\n<link href="https://fonts.googleapis.com" rel="preconnect"/>');
}
writeFileSync(PAGE, crlf ? html.replace(/\n/g, '\r\n') : html, 'utf8');

// 3. admin-sombre.css
const L = [];
L.push('/* KALEA — console d\'administration : variables de couleur des deux thèmes. GÉNÉRÉ par outils/generer-admin-sombre.mjs : ne pas modifier à la main. */');
L.push(':root {');
for (const [n, h] of Object.entries(CLAIR)) L.push(`  --c-${n}: ${canaux(h)};`);
L.push('}');
L.push('html[data-theme="dark"] {');
for (const [n, h] of Object.entries(SOMBRE)) L.push(`  --c-${n}: ${canaux(h)};`);
L.push('  color-scheme: dark;');
L.push('}');
L.push(`
/* Couleurs écrites en dur dans admin.html (hors configuration) */
html[data-theme="dark"] body { background-color: #0B0F22; color: #F5F7FF; }
html[data-theme="dark"] .bg-background { background-color: #0B0F22 !important; }
html[data-theme="dark"] .ticket-nouveau { background: rgba(91,82,223,.22) !important; box-shadow: inset 5px 0 0 #7067EE, 0 1px 3px rgba(0,0,0,.4); }
@media (hover:hover) { html[data-theme="dark"] .carte-ticket:hover { background: rgba(255,255,255,.06); } }
html[data-theme="dark"] .bloc-repertoire > div:first-child,
html[data-theme="dark"] .bloc-repertoire > div:last-child { background: #141A33; }
html[data-theme="dark"] .table-clients tbody tr { background: #141A33 !important; box-shadow: 0 1px 3px rgba(0,0,0,.4); }
html[data-theme="dark"] .table-clients tbody td:nth-child(3)::before,
html[data-theme="dark"] .table-clients tbody td:nth-child(4)::before { color: #C9D0E6; }
html[data-theme="dark"] input, html[data-theme="dark"] select, html[data-theme="dark"] textarea { color-scheme: dark; }
/* pastille ambre (avertissement) : fond clair d'origine → teinte sombre, texte éclairci */
html[data-theme="dark"] .bg-\\[\\#FFF3E0\\] { background-color: rgba(222,122,22,.18) !important; }
html[data-theme="dark"] .text-\\[\\#9A5A0A\\], html[data-theme="dark"] .text-\\[\\#7A4A08\\] { color: #FBBF77 !important; }
html[data-theme="dark"] .to-\\[\\#4c42d6\\] { --tw-gradient-to: #5B52DF var(--tw-gradient-to-position) !important; }
html[data-theme="dark"] .theme-bascule { color: #F5F7FF; }
`);
writeFileSync(join(RACINE, 'admin-sombre.css'), L.join('\n') + '\n', 'utf8');
console.log(`${nb} couleurs en variables ; admin-sombre.css écrit (${Object.keys(CLAIR).length} variables clair, ${Object.keys(SOMBRE).length} sombre)`);

// 4. empreinte CSP
execFileSync(process.execPath, [join(RACINE, 'outils', 'maj-empreinte-csp.mjs'), 'admin.html'], { cwd: RACINE, stdio: 'inherit' });
