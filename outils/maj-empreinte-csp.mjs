// Met à jour l'empreinte SHA-256 du script en ligne de app.html dans sa CSP.
//
// POURQUOI : la balise <meta http-equiv="Content-Security-Policy"> de app.html
// n'autorise le <script> principal que par son empreinte (script-src 'sha256-…').
// Dès qu'on modifie une seule lettre de ce script, l'empreinte ne correspond
// plus, le navigateur bloque le script et la page reste sur « Chargement… ».
//
// QUAND : après TOUTE modification du JavaScript de app.html (pas du CSS ni du
// HTML hors <script>), avant de commiter.
//
// USAGE (depuis la racine du dépôt) :
//   node outils/maj-empreinte-csp.mjs            # met à jour app.html
//   node outils/maj-empreinte-csp.mjs --verifier # ne modifie rien ; code 1 si l'empreinte est périmée
//   node outils/maj-empreinte-csp.mjs autre.html # un autre fichier
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const verifierSeulement = args.includes('--verifier');
const cible = args.find((a) => !a.startsWith('--'))
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app.html');

let html = fs.readFileSync(cible, 'utf8');

// Le seul <script> en ligne (sans attribut) : son contenu exact est haché.
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) {
  console.error(`Attendu : 1 script en ligne, trouvé : ${scripts.length}. La CSP ne couvre qu'une empreinte.`);
  process.exit(1);
}

// Le navigateur normalise les fins de ligne (CRLF -> LF) AVANT de hacher :
// on fait pareil, sinon un fichier enregistré sous Windows donnerait une autre empreinte.
const contenu = scripts[0][1].replace(/\r\n?/g, '\n');
const empreinte = 'sha256-' + crypto.createHash('sha256').update(contenu, 'utf8').digest('base64');

const meta = html.match(/script-src 'self' '(sha256-[^']+)'/);
if (!meta) {
  console.error("Empreinte introuvable dans la CSP (motif : script-src 'self' 'sha256-…').");
  process.exit(1);
}

if (meta[1] === empreinte) {
  console.log('Empreinte CSP à jour :', empreinte);
  process.exit(0);
}
if (verifierSeulement) {
  console.error(`Empreinte CSP PÉRIMÉE.\n  dans la page : ${meta[1]}\n  attendue     : ${empreinte}`);
  process.exit(1);
}
fs.writeFileSync(cible, html.replace(meta[1], empreinte), 'utf8');
console.log(`Empreinte CSP mise à jour :\n  ${meta[1]}\n  -> ${empreinte}`);
