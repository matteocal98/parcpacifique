// Libellés de l'application : de quoi vérifier qu'un nom de bouton cité dans l'aide existe vraiment, et de quoi le traduire EXACTEMENT comme l'application le fait.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Tout le texte de l'application, normalisé : les apostrophes protégées par une barre (\') des chaînes JavaScript redeviennent des apostrophes, et « &amp; » redevient « & ».
export function sourceApplication() {
  const fichiers = ['app.html', ...readdirSync(RACINE).filter((f) => /^app-\d+-.*\.js$/.test(f))];
  return fichiers.map((f) => readFileSync(path.join(RACINE, f), 'utf8')).join('\n').split("\\'").join("'").split('&amp;').join('&').replace(/\s+/g, ' ');
}

// TEXTES.en de traductions-en.js : clé = le texte français, valeur = ce que l'application affiche en anglais.
export function dictionnaireAnglais() {
  const src = readFileSync(path.join(RACINE, 'traductions-en.js'), 'utf8');
  return new Function(src + '\n;return TEXTES;')().en;
}

export const libelleExiste = (source, fr) => source.includes(fr.replace(/\s+/g, ' '));
export const libelleAnglais = (dico, fr) => (Object.prototype.hasOwnProperty.call(dico, fr) ? dico[fr] : null);

// Tous les {{ui:…}} d'une valeur (texte, liste, objet) : [libellé…]
export function libellesCites(valeur, sortie = []) {
  if (typeof valeur === 'string') { for (const m of valeur.matchAll(/\{\{ui:([^}]+)\}\}/g)) sortie.push(m[1]); }
  else if (Array.isArray(valeur)) valeur.forEach((v) => libellesCites(v, sortie));
  else if (valeur && typeof valeur === 'object') Object.values(valeur).forEach((v) => libellesCites(v, sortie));
  return sortie;
}
