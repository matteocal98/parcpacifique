// KALEA — contrôle et mise à jour de la police d'icônes de l'application (Material Symbols, hébergée sur le site).
//
// POURQUOI : l'application n'embarque plus les 4 000 icônes de Google (4 Mo) mais un fichier réduit aux icônes utilisées (≈ 100 Ko) :
//   polices/material-symbols-app.woff2, dont la liste est polices/material-symbols-noms.txt.
// RISQUE : une icône utilisée dans le code mais absente du fichier s'affiche comme son NOM en toutes lettres (« workspace_premium »).
//
// USAGE (depuis la racine du dépôt, avec internet) :
//   node outils/icones-material.mjs --verifier   # ne modifie rien ; code 1 si une icône du code manque dans la liste
//   node outils/icones-material.mjs --maj        # recalcule la liste, retélécharge le fichier de police réduit, puis vérifie
//
// COMMENT ON TROUVE LES ICÔNES : tout mot (minuscules et _) écrit entre guillemets dans app-*.js, app.html ou theme.js qui est un nom
// d'icône Material Symbols connu de Google est retenu. C'est volontairement un peu large (quelques mots courants comme « add » ou « info »
// sont aussi des noms d'icônes) : mieux vaut une icône de trop (≈ 1 Ko) qu'une icône manquante. Les noms construits par concaténation
// (« 'arrow_' + sens ») ne peuvent PAS être devinés : à lister à la main dans la liste ci-dessous (EN_PLUS).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LISTE = path.join(RACINE, 'polices', 'material-symbols-noms.txt');
const POLICE = path.join(RACINE, 'polices', 'material-symbols-app.woff2');
const EN_PLUS = []; // noms d'icônes construits par concaténation, à ajouter à la main
// Mêmes axes que l'ancienne police variable de Google : taille optique 20-48, graisse 100-700, remplissage 0, grade 0.
const AXES = '20..48,100..700,0,0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const args = process.argv.slice(2);

async function noms_connus() {
  const rep = await fetch('https://fonts.google.com/metadata/icons?key=material_symbols&incomplete=true', { headers: { 'User-Agent': UA } });
  if (!rep.ok) throw new Error(`liste des icônes Google indisponible (HTTP ${rep.status})`);
  const texte = await rep.text();
  return new Set(JSON.parse(texte.slice(texte.indexOf('{'))).icons.map((i) => i.name));
}

function icones_du_code(connus) {
  const fichiers = fs.readdirSync(RACINE).filter((f) => /^app-.*\.js$/.test(f)).concat(['app.html', 'theme.js']);
  const texte = fichiers.map((f) => fs.readFileSync(path.join(RACINE, f), 'utf8')).join('\n');
  const mots = new Set(EN_PLUS);
  const chaines = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
  for (const m of texte.matchAll(chaines)) for (const w of m[0].match(/[a-z][a-z0-9]*(?:_[a-z0-9]+)*/g) || []) mots.add(w);
  for (const m of texte.matchAll(/>\s*([a-z][a-z0-9_]*)\s*</g)) mots.add(m[1]);
  return [...mots].filter((n) => connus.has(n) || EN_PLUS.includes(n)).sort();
}

const lire_liste = () => (fs.existsSync(LISTE) ? fs.readFileSync(LISTE, 'utf8').split(/[\s,]+/).filter(Boolean) : []);

async function telecharger_police(noms) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@${AXES}&icon_names=${noms.join(',')}&display=block`, { headers: { 'User-Agent': UA } })).text();
  const url = (css.match(/https:\/\/fonts\.gstatic\.com[^)]+/) || [])[0];
  if (!url) throw new Error('Google n\'a pas renvoyé de fichier de police');
  const octets = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  if (octets.subarray(0, 4).toString() !== 'wOF2') throw new Error('le fichier reçu n\'est pas une police woff2');
  fs.writeFileSync(POLICE, octets);
  return octets.length;
}

try {
  const connus = await noms_connus();
  const dans_le_code = icones_du_code(connus);
  if (args.includes('--maj')) {
    fs.writeFileSync(LISTE, dans_le_code.join('\n') + '\n', 'utf8');
    const taille = await telecharger_police(dans_le_code);
    console.log(`Liste mise à jour : ${dans_le_code.length} icônes. Police réduite : ${(taille / 1024).toFixed(0)} Ko.`);
    console.log('À faire ensuite : node outils/maj-empreinte-csp.mjs (si app.html a changé) puis vérifier un écran avec des icônes.');
  } else {
    const liste = new Set(lire_liste());
    const manquantes = dans_le_code.filter((n) => !liste.has(n));
    if (manquantes.length) {
      console.error(`Icônes utilisées dans le code mais absentes de la police réduite (${manquantes.length}) : ${manquantes.join(', ')}`);
      console.error('→ node outils/icones-material.mjs --maj');
      process.exit(1);
    }
    console.log(`Toutes les icônes du code (${dans_le_code.length} noms candidats) sont dans la police réduite (${liste.size} icônes).`);
  }
} catch (e) {
  console.error('Contrôle impossible : ' + e.message + ' (internet est nécessaire).');
  process.exit(2);
}
