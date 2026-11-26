// Ajoute « ?v=<empreinte> » à chaque lien vers site.css, dans toutes les pages du site.
//
// POURQUOI : sans cela, un navigateur qui a gardé l'ancienne feuille de style (cache, ou sw.js de l'application web)
// l'applique à la NOUVELLE page : les classes ajoutées manquent et la mise en page casse (vu le 2026-11-26 :
// capture du téléphone affichée en taille réelle sur l'accueil). Quand site.css change, son adresse change.
//
// QUAND : automatiquement à la fin de « npm run build » / « npm run pages » (outils/css-site).
//
// USAGE (depuis la racine du dépôt) : node outils/maj-version-css.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Fins de ligne normalisées : la même empreinte sur Windows et ailleurs.
const css = fs.readFileSync(path.join(RACINE, 'site.css'), 'utf8').replace(/\r\n/g, '\n');
const version = crypto.createHash('sha256').update(css).digest('hex').slice(0, 12);
const LIEN = /href="(\.?\/)site\.css(?:\?v=[0-9a-f]*)?"/g;
const IGNORES = new Set(['node_modules', '.git', 'outils', 'vendor']);

let modifiees = 0;
let total = 0;
(function parcourir(dossier) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) { if (!IGNORES.has(e.name)) parcourir(chemin); continue; }
    if (!e.name.endsWith('.html')) continue;
    const avant = fs.readFileSync(chemin, 'utf8');
    const apres = avant.replace(LIEN, (_, debut) => { total += 1; return `href="${debut}site.css?v=${version}"`; });
    if (apres !== avant) { fs.writeFileSync(chemin, apres); modifiees += 1; }
  }
})(RACINE);

console.log(`site.css?v=${version} : ${total} lien(s), ${modifiees} page(s) mise(s) à jour.`);
