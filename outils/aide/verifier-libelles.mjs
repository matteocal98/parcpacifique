// Vérifie que chaque nom de bouton cité dans le centre d'aide ({{ui:…}}) existe encore dans l'application, et dit lesquels ne sont pas traduits en anglais.
//   node outils/aide/verifier-libelles.mjs        (code de sortie 1 si un libellé a disparu : l'aide ne doit jamais décrire un bouton qui n'existe plus)
// Appelé aussi par outils/generer-aide.mjs avant d'écrire la moindre page.
import { pathToFileURL } from 'node:url';
import { ARTICLES, HUB } from './articles.mjs';
import { dictionnaireAnglais, libelleAnglais, libelleExiste, libellesCites, sourceApplication } from './libelles.mjs';

export function verifier() {
  const source = sourceApplication();
  const dico = dictionnaireAnglais();
  const manquants = []; const nonTraduits = new Set(); let total = 0;
  const examiner = (contexte, valeur) => {
    for (const fr of libellesCites(valeur)) {
      total++;
      if (!libelleExiste(source, fr)) manquants.push(`${contexte} : « ${fr} »`);
      if (libelleAnglais(dico, fr) === null) nonTraduits.add(fr);
    }
  };
  for (const lg of ['fr', 'en']) examiner(`aide ${lg}`, HUB[lg]);
  for (const a of ARTICLES) for (const lg of ['fr', 'en']) examiner(`${a.id} (${lg})`, a[lg]);
  return { total, manquants, nonTraduits: [...nonTraduits] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = verifier();
  console.log(`${r.total} libellé(s) cité(s) dans l'aide.`);
  if (r.nonTraduits.length) console.log(`Affichés tels quels en anglais (aucune traduction dans l'application) : ${r.nonTraduits.map((t) => '« ' + t + ' »').join(', ')}`);
  if (r.manquants.length) { console.error('\nLIBELLÉS INTROUVABLES DANS L\'APPLICATION :\n  - ' + r.manquants.join('\n  - ')); process.exit(1); }
  console.log('Tous les libellés existent dans l\'application.');
}
