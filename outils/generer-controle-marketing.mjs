// Génère parcpacifique/marketing-controle.js (version NAVIGATEUR du contrôleur de pertinence et de cohérence) à partir de l'unique source :
//   kalea-serveur/supabase/functions/_shared/marketing-controle.ts
// La console (admin.html) charge ce fichier pour contrôler un texte avant validation ; le serveur et la console appliquent donc LES MÊMES règles.
// Ne JAMAIS modifier marketing-controle.js à la main : modifier le .ts puis relancer
//   node outils/generer-controle-marketing.mjs
// (un test du dépôt kalea-serveur compare le fichier généré à la source et échoue s'ils divergent).
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.resolve(RACINE, '../kalea-serveur/supabase/functions/_shared/marketing-controle.ts');
const SORTIE = path.join(RACINE, 'marketing-controle.js');

export function genererControleNavigateur(ts) {
  const source = ts.replace(/\r\n/g, '\n');
  const js = stripTypeScriptTypes(source, { mode: 'strip' }).replace(/^export /gm, '');
  return `/* GÉNÉRÉ par outils/generer-controle-marketing.mjs à partir de kalea-serveur/supabase/functions/_shared/marketing-controle.ts — NE PAS MODIFIER À LA MAIN.
   Contrôle de pertinence et de cohérence des contenus marketing (base de faits vérifiés + règles), utilisé par la page Marketing de la console. */
(function () {
'use strict';
${js}
window.marketingControle = { FAITS, OFFRES, MONTANTS_AUTORISES, montantsDuTexte, controlerPublication, detecterLangue, fiche };
}());
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sortie = genererControleNavigateur(readFileSync(SOURCE, 'utf8'));
  writeFileSync(SORTIE, sortie);
  console.log(`écrit : marketing-controle.js (${sortie.length} caractères)`);
}
