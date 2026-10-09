// Met à jour, dans une page (app.html, admin.html…), tout ce qui dépend du CONTENU de ses scripts.
//
// POURQUOI : trois mécanismes se basent sur le contenu exact des scripts, et se périment dès qu'on modifie
// une seule lettre :
//
//   1. LA CSP. La balise <meta http-equiv="Content-Security-Policy"> n'autorise le <script> en ligne que
//      par son empreinte (script-src 'sha256-…'). Empreinte périmée = script bloqué, page bloquée sur
//      « Chargement… ». Les fichiers .js de l'application sont autorisés par 'self' (pas d'empreinte).
//   2. LE CACHE. Chaque fichier .js local de l'application est appelé avec « ?v=<12 caractères de son
//      empreinte> » : quand le fichier change, l'adresse change, le navigateur ne peut pas servir l'ancien.
//   3. LA VERSION PUBLIÉE (app.html seulement). <meta name="kalea-empreinte"> et version.json portent
//      l'empreinte de la PAGE ENTIÈRE (script en ligne + fichiers .js dans l'ordre de la page) : c'est ce
//      qui permet à une page ouverte de s'apercevoir qu'une nouvelle version est publiée et de se recharger.
//
// QUAND : après TOUTE modification d'un <script> en ligne ou d'un fichier .js de l'application, avant de
// commiter (jamais nécessaire pour du CSS ou du HTML hors <script>).
//
// USAGE (depuis la racine du dépôt) :
//   node outils/maj-empreinte-csp.mjs            # met à jour app.html (et version.json)
//   node outils/maj-empreinte-csp.mjs --verifier # ne modifie rien ; code 1 si quelque chose est périmé
//   node outils/maj-empreinte-csp.mjs autre.html # une autre page (CSP seulement, si elle n'a pas de .js local)
//
// CONVENTION : les fichiers .js de l'application sont déclarés <script src="./nom.js?v=…"></script>
// (chemin relatif, sans sous-dossier). Les bibliothèques (vendor/…) et les CDN ne sont pas concernés.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const verifierSeulement = args.includes('--verifier');
const ICI = path.dirname(fileURLToPath(import.meta.url));
const cible = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(ICI, '..', 'app.html'));
const dossier = path.dirname(cible);

// Le navigateur normalise les fins de ligne (CRLF -> LF) AVANT de hacher : on fait pareil,
// sinon un fichier enregistré sous Windows donnerait une autre empreinte.
const normaliser = (t) => t.replace(/\r\n?/g, '\n');
const sha256b64 = (t) => 'sha256-' + crypto.createHash('sha256').update(t, 'utf8').digest('base64');
const sha256hex = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

let html = fs.readFileSync(cible, 'utf8');
const periment = []; // descriptions de ce qui est périmé

// Le seul <script> en ligne (sans attribut) : son contenu exact est haché.
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) {
  console.error(`Attendu : 1 script en ligne, trouvé : ${scripts.length}. La CSP ne couvre qu'une empreinte.`);
  process.exit(1);
}
const enLigne = normaliser(scripts[0][1]);
const empreinteCsp = sha256b64(enLigne);

// 1. CSP
const meta = html.match(/script-src 'self' '(sha256-[^']+)'/);
if (!meta) {
  console.error("Empreinte introuvable dans la CSP (motif : script-src 'self' 'sha256-…').");
  process.exit(1);
}
if (meta[1] !== empreinteCsp) {
  periment.push(`CSP : dans la page ${meta[1]} ; attendue ${empreinteCsp}`);
  html = html.replace(meta[1], empreinteCsp);
}

// 2. Fichiers .js de l'application (ordre de la page = ordre d'exécution)
const motifJs = /<script src="\.\/([A-Za-z0-9._-]+\.js)\?v=([^"]*)"><\/script>/g;
const fichiers = [];
html = html.replace(motifJs, (balise, nom, v) => {
  const chemin = path.join(dossier, nom);
  if (!fs.existsSync(chemin)) {
    console.error(`Fichier référencé par la page mais introuvable : ${nom}`);
    process.exit(1);
  }
  const contenu = normaliser(fs.readFileSync(chemin, 'utf8'));
  const jeton = sha256hex(contenu).slice(0, 12);
  fichiers.push({ nom, contenu });
  if (v !== jeton) periment.push(`${nom} : ?v=${v} ; attendu ?v=${jeton}`);
  return `<script src="./${nom}?v=${jeton}"></script>`;
});

// 3. Empreinte de la page entière (app.html : balise kalea-empreinte + version.json)
const balisePage = html.match(/<meta name="kalea-empreinte" content="([^"]*)">/);
if (balisePage) {
  const pageEntiere = [enLigne, ...fichiers.map((f) => `\n/* ${f.nom} */\n${f.contenu}`)].join('');
  const empreintePage = sha256b64(pageEntiere);
  if (balisePage[1] !== empreintePage) {
    periment.push(`kalea-empreinte : dans la page ${balisePage[1]} ; attendue ${empreintePage}`);
    html = html.replace(balisePage[0], `<meta name="kalea-empreinte" content="${empreintePage}">`);
  }
  const cheminVersion = path.join(dossier, 'version.json');
  if (fs.existsSync(cheminVersion)) {
    const version = JSON.parse(fs.readFileSync(cheminVersion, 'utf8'));
    if (version.empreinte !== empreintePage) {
      periment.push(`version.json : ${version.empreinte} ; attendue ${empreintePage}`);
      if (!verifierSeulement) {
        version.empreinte = empreintePage;
        fs.writeFileSync(cheminVersion, JSON.stringify(version, null, 2) + '\n', 'utf8');
      }
    }
  }
}

if (!periment.length) {
  console.log('Tout est à jour :', empreinteCsp);
  process.exit(0);
}
if (verifierSeulement) {
  console.error('PÉRIMÉ :\n  ' + periment.join('\n  '));
  process.exit(1);
}
fs.writeFileSync(cible, html, 'utf8');
console.log('Mis à jour :\n  ' + periment.join('\n  '));
