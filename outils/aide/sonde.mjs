// Sonde de mise au point : ouvre l'application avec le parc fictif et affiche ce que contient la page (sélecteurs, ancêtres d'un élément…).
// Usage : node outils/aide/sonde.mjs "<expression JavaScript évaluée dans la page après goTo>"   (ex. : "goTo('machines')")
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrir } from './cdp.mjs';
import { demarrerServeur } from './serveur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..', '..');
const serveur = await demarrerServeur(RACINE);
const b = await ouvrir({ largeur: 1440, hauteur: 900, echelle: 1 });
try {
  await b.aller(`http://127.0.0.1:${serveur.port}/app.html`);
  await b.ev(readFileSync(path.join(ICI, 'etat-fictif.js'), 'utf8'));
  await b.ev('window.__aide.preparer()');
  const sortie = await b.ev(process.argv[2] || "goTo('machines'), document.title");
  console.log(typeof sortie === 'string' ? sortie : JSON.stringify(sortie, null, 1));
} finally { await b.fermer(); serveur.fermer(); }
