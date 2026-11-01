// Génère les versions NAVIGATEUR des modules marketing du serveur, à partir de leurs uniques sources :
//   kalea-serveur/supabase/functions/_shared/marketing-controle.ts → parcpacifique/marketing-controle.js  (window.marketingControle : contrôle de pertinence et de cohérence)
//   kalea-serveur/supabase/functions/_shared/marketing-tri.ts      → parcpacifique/marketing-tri.js       (window.marketingTri : tri des contacts par règles)
// La console (admin.html) charge ces fichiers : le serveur et la console appliquent donc LES MÊMES règles.
// Ne JAMAIS modifier les .js générés à la main : modifier le .ts puis relancer
//   node outils/generer-controle-marketing.mjs
// (des tests du dépôt kalea-serveur comparent les fichiers générés aux sources et échouent s'ils divergent).
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARTAGE = path.resolve(RACINE, '../kalea-serveur/supabase/functions/_shared/');

function generer(ts, nomTs, global, exportes, description) {
  const source = ts.replace(/\r\n/g, '\n');
  const js = stripTypeScriptTypes(source, { mode: 'strip' }).replace(/^export /gm, '');
  return `/* GÉNÉRÉ par outils/generer-controle-marketing.mjs à partir de kalea-serveur/supabase/functions/_shared/${nomTs} — NE PAS MODIFIER À LA MAIN.
   ${description} */
(function () {
'use strict';
${js}
window.${global} = { ${exportes.join(', ')} };
}());
`;
}

export function genererControleNavigateur(ts) {
  return generer(ts, 'marketing-controle.ts', 'marketingControle',
    ['FAITS', 'OFFRES', 'MONTANTS_AUTORISES', 'montantsDuTexte', 'controlerPublication', 'detecterLangue', 'fiche'],
    'Contrôle de pertinence et de cohérence des contenus marketing (base de faits vérifiés + règles), utilisé par la page Marketing de la console.');
}
export function genererTriNavigateur(ts) {
  return generer(ts, 'marketing-tri.ts', 'marketingTri', ['evaluerContact', 'meilleurParEntreprise', 'LIBELLES_NIVEAU'],
    'Tri des contacts de prospection par règles (taille, fonction, secteur), utilisé par la page Marketing de la console.');
}

export const SORTIES = [
  { source: path.join(PARTAGE, 'marketing-controle.ts'), sortie: path.join(RACINE, 'marketing-controle.js'), generer: genererControleNavigateur },
  { source: path.join(PARTAGE, 'marketing-tri.ts'), sortie: path.join(RACINE, 'marketing-tri.js'), generer: genererTriNavigateur },
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const { source, sortie, generer: gen } of SORTIES) {
    const contenu = gen(readFileSync(source, 'utf8'));
    writeFileSync(sortie, contenu);
    console.log(`écrit : ${path.basename(sortie)} (${contenu.length} caractères)`);
  }
}
