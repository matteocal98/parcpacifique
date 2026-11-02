// Génère le centre d'aide : kalea.pro/aide/ (français) et kalea.pro/en/help/ (anglais), à partir de outils/aide/articles.mjs (textes) et aide/img/ (captures).
//   node outils/generer-aide.mjs
// À lancer APRÈS outils/generer-pages-publiques.mjs : les pages d'aide empruntent l'en-tête, le pied de page et les balises d'une page de contenu déjà générée (elles restent
// ainsi identiques au reste du site), puis npm --prefix outils/css-site run build (recompile site.css pour les nouvelles pages). Le plan du site (sitemap.xml) est complété ici.
// Refuse d'écrire quoi que ce soit si un nom de bouton cité n'existe plus dans l'application (outils/aide/verifier-libelles.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTICLES, HUB, SITE, THEMES } from './aide/articles.mjs';
import { dictionnaireAnglais, libelleAnglais } from './aide/libelles.mjs';
import { verifier } from './aide/verifier-libelles.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const ecrire = (f, c) => { const p = path.join(RACINE, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

// 1. Contrôle avant tout : l'aide ne décrit que des boutons qui existent.
const controle = verifier();
if (controle.manquants.length) { console.error('Libellés introuvables dans l\'application :\n  - ' + controle.manquants.join('\n  - ')); process.exit(1); }
const dico = dictionnaireAnglais();
const avertissements = controle.nonTraduits.map((t) => `libellé affiché en français dans l'interface anglaise : « ${t} »`);

// 2. Enveloppes : une page de contenu déjà générée par langue.
const COQUILLES = { fr: 'plan-entretien-automatique.html', en: 'en/automatic-maintenance-plan.html' };
const coquille = { fr: lire(COQUILLES.fr), en: lire(COQUILLES.en) };
const manifeste = JSON.parse(lire('aide/img/manifest.json'));

// 3. Adresses.
const chemin = (fichier) => (fichier.endsWith('/index.html') ? '/' + fichier.slice(0, -'index.html'.length) : '/' + fichier);
const urlAbs = (fichier) => SITE + chemin(fichier);
const parId = Object.fromEntries(ARTICLES.map((a) => [a.id, a]));
const lienVers = (id, lg) => { if (!parId[id]) throw new Error('{{lien:' + id + '}} : article inconnu'); return chemin(parId[id][lg].fichier); };

// 4. Texte : {{ui:…}} et {{lien:…}}.
function habiller(texte, lg) {
  return String(texte)
    .replace(/\{\{ui:([^}]+)\}\}/g, (m, fr) => {
      if (lg === 'fr') return `<strong>«&nbsp;${esc(fr)}&nbsp;»</strong>`;
      const en = libelleAnglais(dico, fr) ?? fr;   // comme l'application : sans traduction, elle affiche le français
      return `<strong>“${esc(en)}”</strong>`;
    })
    .replace(/\{\{lien:([^}]+)\}\}/g, (m, id) => lienVers(id, lg));
}
const sansBalises = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\{\{ui:([^}]+)\}\}/g, '$1').replace(/&amp;/g, '&');

// 5. Balises de tête, à partir de la coquille.
function remplacerTete(html, { lg, titre, description, fichier, fichierFr, fichierEn, json }) {
  const url = urlAbs(fichier);
  const unique = (re, nouveau, nom) => { if (!re.test(html)) throw new Error('balise introuvable dans la coquille : ' + nom); html = html.replace(re, () => nouveau); };
  unique(/<title>[^<]*<\/title>/, `<title>${esc(titre)}</title>`, 'title');
  unique(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`, 'description');
  unique(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`, 'canonical');
  unique(/<link rel="alternate" hreflang="fr" href="[^"]*">/, `<link rel="alternate" hreflang="fr" href="${urlAbs(fichierFr)}">`, 'hreflang fr');
  unique(/<link rel="alternate" hreflang="en" href="[^"]*">/, `<link rel="alternate" hreflang="en" href="${urlAbs(fichierEn)}">`, 'hreflang en');
  unique(/<link rel="alternate" hreflang="x-default" href="[^"]*">/, `<link rel="alternate" hreflang="x-default" href="${urlAbs(fichierFr)}">`, 'hreflang x-default');
  unique(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(titre)}">`, 'og:title');
  unique(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`, 'og:description');
  unique(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`, 'og:url');
  unique(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(titre)}">`, 'twitter:title');
  unique(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(description)}">`, 'twitter:description');
  // Les données structurées de la coquille décrivent SA page : on les remplace toutes par celles de la page d'aide.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '');
  return html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(json)}</script>\n</head>`);
}
function jsonLd({ lg, titre, description, fichier, fil, hub }) {
  const url = urlAbs(fichier); const accueil = lg === 'fr' ? SITE + '/' : SITE + '/en/';
  const fils = [{ '@type': 'ListItem', position: 1, name: lg === 'fr' ? 'Accueil' : 'Home', item: accueil }, { '@type': 'ListItem', position: 2, name: HUB[lg].fil, item: urlAbs(HUB[lg].fichier) }];
  if (!hub) fils.push({ '@type': 'ListItem', position: 3, name: fil, item: url });
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': hub ? 'CollectionPage' : 'TechArticle', '@id': url + '#page', url, name: titre, description, inLanguage: lg, datePublished: AUJOURDHUI, dateModified: AUJOURDHUI,
      isPartOf: { '@id': SITE + '/#site' }, publisher: { '@id': SITE + '/#organisation' } },
    { '@type': 'BreadcrumbList', itemListElement: fils },
  ] };
}

// 6. Corps des pages.
const T = { fr: { fil: 'Fil d\'Ariane', accueil: 'Accueil', liees: 'À lire aussi', contact: 'Une question ?', etape: 'Étape', bon: 'Bon à savoir', lireTout: 'Toute l\'aide' },
            en: { fil: 'Breadcrumb', accueil: 'Home', liees: 'Read next', contact: 'A question?', etape: 'Step', bon: 'Good to know', lireTout: 'All help' } };
const URL_ACCUEIL = { fr: '/', en: '/en/' };
const fil = (lg, dernier) => `<nav aria-label="${T[lg].fil}" class="text-xs text-slate-500 mb-6"><a href="${URL_ACCUEIL[lg]}" class="hover:text-brand-primary">${T[lg].accueil}</a> <span aria-hidden="true">›</span> ${dernier ? `<a href="${chemin(HUB[lg].fichier)}" class="hover:text-brand-primary">${esc(HUB[lg].fil)}</a> <span aria-hidden="true">›</span> <span>${esc(dernier)}</span>` : `<span>${esc(HUB[lg].fil)}</span>`}</nav>`;

function figure(sc, image, lg, premiere) {
  const cle = `${sc}/${image.nom}-${lg}`; const dim = manifeste[cle];
  if (!dim) throw new Error('capture absente du manifeste : ' + cle + ' (relancer outils/aide/captures.mjs)');
  return `<figure class="mt-4"><img src="/aide/img/${sc}/${image.nom}-${lg}.webp" width="${dim.largeur}" height="${dim.hauteur}" alt="${esc(image.alt)}" ${premiere ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" class="w-full h-auto rounded-2xl border border-brand-borderMuted shadow-sm bg-white"></figure>`;
}
const blocContact = (lg) => `<section class="mt-14 rounded-3xl bg-brand-ink text-white p-8 sm:p-10 [&_a]:underline [&_a]:font-semibold"><h2 class="font-display font-bold text-2xl tracking-tight">${T[lg].contact}</h2><p class="mt-2 text-slate-300 leading-relaxed">${habiller(HUB[lg].contact, lg)}</p></section>`;

function corpsArticle(a, lg) {
  const c = a[lg]; let premiere = true;
  const etapes = c.etapes.map((e, i) => {
    const img = e.image ? figure(a.scenario, e.image, lg, premiere) : ''; if (e.image) premiere = false;
    return `<li class="flex gap-4"><span class="flex-none w-9 h-9 rounded-full bg-brand-ink text-white font-display font-bold flex items-center justify-center" aria-hidden="true">${i + 1}</span><div class="min-w-0 flex-1"><h2 class="font-display font-bold text-xl text-brand-ink tracking-tight"><span class="sr-only">${T[lg].etape} ${i + 1} : </span>${esc(e.titre)}</h2><p class="mt-2 text-slate-600 leading-relaxed [&_strong]:text-brand-ink [&_a]:text-brand-primary [&_a]:font-semibold [&_a]:underline">${habiller(e.texte, lg)}</p>${img}</div></li>`;
  }).join('');
  const variante = c.variante ? `<section class="mt-12 [&_a]:text-brand-primary [&_a]:font-semibold [&_a]:underline [&_strong]:text-brand-ink"><h2 class="font-display font-bold text-2xl text-brand-ink tracking-tight">${esc(c.variante.titre)}</h2><p class="mt-3 text-slate-600 leading-relaxed">${habiller(c.variante.texte, lg)}</p>${c.variante.image ? figure(a.scenario, c.variante.image, lg, false) : ''}</section>` : '';
  const notes = `<section class="mt-12 [&_a]:text-brand-primary [&_a]:font-semibold [&_a]:underline [&_strong]:text-brand-ink"><h2 class="font-display font-bold text-2xl text-brand-ink tracking-tight">${T[lg].bon}</h2><ul class="mt-4 space-y-3 text-slate-600 leading-relaxed list-disc pl-5 marker:text-brand-teal">${c.notes.map((n) => `<li>${habiller(n, lg)}</li>`).join('')}</ul></section>`;
  const liees = c.liees.length ? `<nav aria-label="${T[lg].liees}" class="mt-12"><h2 class="font-display font-bold text-lg text-brand-ink">${T[lg].liees}</h2><ul class="mt-3 space-y-2">${c.liees.map((id) => `<li><a class="font-semibold text-brand-primary hover:underline" href="${lienVers(id, lg)}">${esc(parId[id][lg].fil)}</a></li>`).join('')}</ul></nav>` : '';
  return `<main class="flex-1">
<article class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
${fil(lg, c.fil)}
<h1 class="font-display font-extrabold text-3xl sm:text-4xl text-brand-ink tracking-tight leading-tight">${esc(c.h1)}</h1>
<p class="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed [&_strong]:text-brand-ink">${habiller(c.intro, lg)}</p>
<ol class="mt-10 space-y-10">${etapes}</ol>
${variante}
${notes}
${blocContact(lg)}
${liees}
</article>
</main>`;
}

function corpsHub(lg) {
  const h = HUB[lg];
  const groupes = Object.entries(THEMES).map(([cle, t]) => {
    const liste = ARTICLES.filter((a) => a.theme === cle);
    if (!liste.length) return '';
    // data-recherche : titre + description sans accents ni majuscules, lu par aide-recherche.js (le filtre de la page).
    const recherche = (a) => `${a[lg].h1} ${a[lg].description} ${a[lg].fil}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return `<section id="theme-${cle}" data-theme-aide class="mt-12 scroll-mt-24"><h2 class="font-display font-bold text-2xl text-brand-ink tracking-tight">${esc(t[lg])}</h2><ul class="mt-4 grid gap-3 sm:grid-cols-2">${liste.map((a) => `<li data-recherche="${esc(recherche(a))}"><a href="${chemin(a[lg].fichier)}" class="block h-full rounded-2xl border border-brand-borderMuted bg-white p-5 hover:border-brand-primary"><span class="block font-display font-bold text-brand-ink">${esc(a[lg].h1)}</span><span class="mt-2 block text-sm text-slate-600 leading-relaxed">${esc(a[lg].description)}</span></a></li>`).join('')}</ul></section>`;
  }).join('\n');
  // Raccourcis vers chaque thème (sans JavaScript) et champ de recherche (affiché par aide-recherche.js).
  const themes = Object.entries(THEMES).filter(([cle]) => ARTICLES.some((a) => a.theme === cle));
  const puces = themes.map(([cle, t]) => `<li><a href="#theme-${cle}" class="inline-block rounded-full border border-brand-borderMuted bg-white px-3 py-1.5 text-sm font-semibold text-brand-ink hover:border-brand-primary">${esc(t[lg])}</a></li>`).join('');
  const R = lg === 'fr'
    ? { etiquette: 'Rechercher dans l\'aide', exemple: 'Ex. : compteur, rappel, droits, import…', vide: 'Aucun article ne correspond. Essayez un autre mot, ou écrivez-nous depuis Aide & support.', themes: 'Par thème' }
    : { etiquette: 'Search the help', exemple: 'E.g. meter, reminder, permissions, import…', vide: 'No article matches. Try another word, or write to us from Aide & support.', themes: 'By topic' };
  const outils = `<div id="aide-recherche-boite" hidden class="mt-8"><label for="aide-recherche" class="block text-sm font-semibold text-brand-ink">${R.etiquette}</label><input id="aide-recherche" type="search" autocomplete="off" placeholder="${esc(R.exemple)}" class="mt-2 w-full rounded-2xl border border-brand-borderMuted bg-white px-4 py-3 text-base text-brand-ink focus:border-brand-primary focus:outline-none"><p id="aide-recherche-etat" role="status" aria-live="polite" class="mt-2 text-sm text-slate-500"></p><p id="aide-recherche-vide" hidden class="mt-4 rounded-2xl bg-slate-50 p-5 text-slate-600">${esc(R.vide)}</p></div>
<nav aria-label="${R.themes}" class="mt-8"><h2 class="sr-only">${R.themes}</h2><ul class="flex flex-wrap gap-2">${puces}</ul></nav>`;
  return `<main class="flex-1">
<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
${fil(lg, null)}
<h1 class="font-display font-extrabold text-3xl sm:text-4xl text-brand-ink tracking-tight leading-tight">${esc(h.h1)}</h1>
<p class="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed">${esc(h.intro)}</p>
${outils}
${groupes}
${blocContact(lg)}
</div>
<script src="/aide-recherche.js" defer></script>
</main>`;
}

// 7. Écriture des pages.
function page(lg, { fichier, fichierFr, fichierEn, titre, description, corps, json }) {
  let html = remplacerTete(coquille[lg], { lg, titre, description, fichier, fichierFr, fichierEn, json });
  const debut = html.indexOf('<main class="flex-1">'); const fin = html.indexOf('</main>') + '</main>'.length;
  if (debut < 0 || fin < debut) throw new Error('<main> introuvable dans la coquille ' + lg);
  html = html.slice(0, debut) + corps + html.slice(fin);
  ecrire(fichier, html);
}
const ecrites = [];
for (const lg of ['fr', 'en']) {
  const h = HUB[lg];
  page(lg, { fichier: h.fichier, fichierFr: HUB.fr.fichier, fichierEn: HUB.en.fichier, titre: h.titre, description: h.description, corps: corpsHub(lg), json: jsonLd({ lg, titre: h.titre, description: h.description, fichier: h.fichier, hub: true }) });
  ecrites.push(h.fichier);
  for (const a of ARTICLES) {
    const c = a[lg];
    page(lg, { fichier: c.fichier, fichierFr: a.fr.fichier, fichierEn: a.en.fichier, titre: c.titre, description: c.description, corps: corpsArticle(a, lg), json: jsonLd({ lg, titre: c.titre, description: c.description, fichier: c.fichier, fil: c.fil }) });
    ecrites.push(c.fichier);
  }
}

// 8. Plan du site : un bloc balisé, remplacé à chaque passage (le plan lui-même est réécrit par generer-pages-publiques.mjs, qui ne connaît pas l'aide).
{
  let plan = lire('sitemap.xml').replace(/\s*<!-- aide -->[\s\S]*?<!-- \/aide -->/g, '');
  const alt = (fr, en) => `<xhtml:link rel="alternate" hreflang="fr" href="${urlAbs(fr)}"/><xhtml:link rel="alternate" hreflang="en" href="${urlAbs(en)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${urlAbs(fr)}"/>`;
  const url = (f, prio, extra) => `  <url><loc>${urlAbs(f)}</loc><lastmod>${AUJOURDHUI}</lastmod><changefreq>monthly</changefreq><priority>${prio}</priority>${extra}</url>`;
  const lignes = [
    ...['fr', 'en'].map((lg) => url(HUB[lg].fichier, '0.6', alt(HUB.fr.fichier, HUB.en.fichier))),
    ...ARTICLES.flatMap((a) => ['fr', 'en'].map((lg) => url(a[lg].fichier, '0.5', alt(a.fr.fichier, a.en.fichier)))),
  ];
  plan = plan.replace('</urlset>', `<!-- aide -->\n${lignes.join('\n')}\n<!-- /aide -->\n</urlset>`);
  fs.writeFileSync(path.join(RACINE, 'sitemap.xml'), plan);
}

console.log(`${ecrites.length} pages d'aide écrites : ${ecrites.join(', ')}`);
console.log(`${controle.total} libellés vérifiés contre l'application.`);
avertissements.forEach((w) => console.log('  ⚠ ' + w));
