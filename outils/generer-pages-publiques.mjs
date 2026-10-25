// Génère les pages publiques de kalea.pro à partir de la page d'accueil FRANÇAISE (decouvrir.html = la source, éditée à la main) :
//   1. balises de référencement + sélecteur de langue + liens du pied de page, insérés dans decouvrir.html (entre marqueurs, idempotent) ;
//   2. index.html = copie exacte de decouvrir.html (règle des deux pages miroirs) ;
//   3. en/index.html = version anglaise, produite avec le dictionnaire de accueil-langue.js (une seule source de traductions) ;
//   4. les pages de contenu (outils/pages-contenu.mjs), en français et en anglais ;
//   5. sitemap.xml (avec les alternatives de langue).
// Usage : node outils/generer-pages-publiques.mjs   puis   npm --prefix outils/css-site run build   (recompile site.css).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SITE, RESEAUX, IMAGE_PARTAGE, ACCUEIL, ORGANISATION, OFFRES, APPLICATION } from './seo-config.mjs';
import { PAGES } from './pages-contenu.mjs';

const require = createRequire(import.meta.url);
const { parse, serialize } = require('./css-site/node_modules/parse5');
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const ecrire = (f, c) => { const p = path.join(RACINE, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); };
const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

// ───────────────────────────── adresses
const URL_ACCUEIL = { fr: SITE + '/', en: SITE + '/en/' };
const urlPage = (p, lg) => SITE + '/' + p[lg].fichier;
const cheminPage = (p, lg) => '/' + p[lg].fichier;
const LIB = {
  fr: { accueil: 'Accueil', essai: 'Essai gratuit', tarifs: 'Voir les tarifs', langue: 'Langue / Language', ressources: 'Guides', suivez: 'Suivez KALEA', fil: 'Fil d\'Ariane', liees: 'À lire aussi', faq: 'Questions fréquentes', bandeauTitre: 'Essayez KALEA gratuitement', bandeauTexte: 'Gratuit pour 2 machines, sans carte bancaire. Déposez un manuel et voyez le plan d\'entretien se construire.' },
  en: { accueil: 'Home', essai: 'Free trial', tarifs: 'See pricing', langue: 'Langue / Language', ressources: 'Guides', suivez: 'Follow KALEA', fil: 'Breadcrumb', liees: 'Read next', faq: 'Frequently asked questions', bandeauTitre: 'Try KALEA for free', bandeauTexte: 'Free for 2 machines, no credit card. Upload a manual and watch the maintenance plan build itself.' },
};

// ───────────────────────────── balises SEO
function jsonLdAccueil(lg, faq = []) {
  const org = SITE + '/#organisation';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', '@id': org, name: ORGANISATION.nom, url: SITE + '/', logo: SITE + ORGANISATION.logo, email: ORGANISATION.email,
        description: ORGANISATION.description[lg], sameAs: [RESEAUX.facebook, RESEAUX.linkedin, APPLICATION.googlePlay],
        areaServed: APPLICATION.zones,
        contactPoint: { '@type': 'ContactPoint', contactType: lg === 'fr' ? 'assistance' : 'customer support', email: ORGANISATION.email, availableLanguage: ['fr', 'en'] },
        address: { '@type': 'PostalAddress', addressLocality: ORGANISATION.adresse.ville, postalCode: ORGANISATION.adresse.codePostal, addressCountry: ORGANISATION.adresse.pays },
      },
      { '@type': 'WebSite', '@id': SITE + '/#site', url: SITE + '/', name: 'KALEA', publisher: { '@id': org }, inLanguage: ['fr', 'en'] },
      {
        '@type': 'SoftwareApplication', name: 'KALEA', url: URL_ACCUEIL[lg], applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android',
        description: ACCUEIL[lg].description, inLanguage: lg, publisher: { '@id': org },
        downloadUrl: APPLICATION.googlePlay, installUrl: APPLICATION.googlePlay, screenshot: APPLICATION.captures.map((c) => SITE + c), featureList: APPLICATION.fonctions[lg],
        offers: OFFRES.map((o) => ({ '@type': 'Offer', name: o.nom, price: String(o.prix), priceCurrency: 'EUR', description: lg === 'fr' ? 'Prix par mois, toutes taxes comprises' : 'Price per month, taxes included', url: URL_ACCUEIL[lg] + '#tarifs', availability: 'https://schema.org/InStock' })),
      },
      ...(faq.length ? [{
        '@type': 'FAQPage', '@id': URL_ACCUEIL[lg] + '#faq', inLanguage: lg,
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
      }] : []),
    ],
  };
}
function jsonLdPage(p, lg) {
  const org = SITE + '/#organisation';
  const l = p[lg];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': urlPage(p, lg) + '#page', url: urlPage(p, lg), name: l.titre, description: l.description, inLanguage: lg, isPartOf: { '@id': SITE + '/#site' }, publisher: { '@id': org } },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: LIB[lg].accueil, item: URL_ACCUEIL[lg] },
          { '@type': 'ListItem', position: 2, name: l.fil, item: urlPage(p, lg) },
        ],
      },
    ],
  };
}
function balisesSeo({ lg, titre, description, canonique, alternates, jsonld }) {
  const img = SITE + IMAGE_PARTAGE.chemin[lg];
  const alt = IMAGE_PARTAGE.alt[lg];
  return [
    '<!-- SEO:DEBUT (généré par outils/generer-pages-publiques.mjs : ne pas modifier à la main) -->',
    `<meta name="description" content="${echapper(description)}">`,
    `<link rel="canonical" href="${canonique}">`,
    ...Object.entries(alternates).map(([code, url]) => `<link rel="alternate" hreflang="${code}" href="${url}">`),
    '<meta name="robots" content="index, follow, max-image-preview:large">',
    '<meta name="theme-color" content="#0E1333">',
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/icones/apple-touch-icon.png">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="KALEA">',
    `<meta property="og:locale" content="${lg === 'fr' ? 'fr_FR' : 'en_US'}">`,
    `<meta property="og:title" content="${echapper(titre)}">`,
    `<meta property="og:description" content="${echapper(description)}">`,
    `<meta property="og:url" content="${canonique}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="${IMAGE_PARTAGE.largeur}">`,
    `<meta property="og:image:height" content="${IMAGE_PARTAGE.hauteur}">`,
    `<meta property="og:image:alt" content="${echapper(alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${echapper(titre)}">`,
    `<meta name="twitter:description" content="${echapper(description)}">`,
    `<meta name="twitter:image" content="${img}">`,
    `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`,
    '<!-- SEO:FIN -->',
  ].join('\n');
}

// Questions/réponses VISIBLES de la page (section #faq) : Google exige que le contenu du FAQPage soit affiché.
function texteDe(n) { let s = ''; parcourir(n, (x) => { if (x.nodeName === '#text' && !/^(script|style)$/.test(x.parentNode.nodeName)) s += x.value; }); return norm(s); }
function faqDepuisHtml(html) {
  const doc = parse(html); const sortie = [];
  parcourir(doc, (n) => {
    if (n.nodeName !== 'section' || (attr(n, 'id') || {}).value !== 'faq') return;
    parcourir(n, (d) => {
      if (d.nodeName !== 'details') return;
      const resume = d.childNodes.find((c) => c.nodeName === 'summary'); const rep = d.childNodes.find((c) => c.nodeName === 'p');
      if (!resume || !rep) return;
      const q = texteDe({ childNodes: resume.childNodes }); const r = texteDe({ childNodes: rep.childNodes });
      if (q && r) sortie.push({ q, r });
    });
  });
  return sortie;
}

// ───────────────────────────── blocs insérés dans la page (entre marqueurs)
function selecteurLangue(actif, urlFr, urlEn) {
  const classe = (on) => 'text-[11px] sm:text-xs font-bold px-1.5 sm:px-2 py-1 rounded-md transition-colors ' + (on ? 'bg-brand-ink text-white' : 'text-slate-600 hover:text-brand-primary');
  return [
    '<!-- LANGUE:DEBUT -->',
    `<div role="group" aria-label="Langue / Language" data-sans-traduction class="flex items-center gap-0.5 sm:gap-1 rounded-lg border border-slate-200 bg-white p-0.5 ml-2 shrink-0">`,
    `<a href="${urlFr}" data-langue="fr" lang="fr" hreflang="fr" title="Français"${actif === 'fr' ? ' aria-current="true"' : ''} class="${classe(actif === 'fr')}">FR</a>`,
    `<a href="${urlEn}" data-langue="en" lang="en" hreflang="en" title="English"${actif === 'en' ? ' aria-current="true"' : ''} class="${classe(actif === 'en')}">EN</a>`,
    '</div>',
    '<!-- LANGUE:FIN -->',
  ].join('\n');
}
function liensRessources(lg) {
  const li = (p) => `<li class=""><a class="hover:text-white transition-colors" href="${cheminPage(p, lg)}" data-sans-traduction>${echapper(p[lg].fil)}</a></li>`;
  return ['<!-- RESSOURCES:DEBUT -->', ...PAGES.map(li), '<!-- RESSOURCES:FIN -->'].join('\n');
}
function liensReseaux() {
  const a = (url, nom) => `<a class="hover:text-white transition-colors" href="${url}" rel="me noopener" target="_blank" data-sans-traduction>${nom}</a>`;
  return ['<!-- RESEAUX:DEBUT -->', `<p class="text-xs text-slate-400 flex items-center gap-4">${a(RESEAUX.linkedin, 'LinkedIn')}${a(RESEAUX.facebook, 'Facebook')}</p>`, '<!-- RESEAUX:FIN -->'].join('\n');
}
function remplacerEntreMarqueurs(html, nom, bloc) {
  const re = new RegExp(`<!-- ${nom}:DEBUT[^>]*-->[\\s\\S]*?<!-- ${nom}:FIN -->`);
  if (!re.test(html)) throw new Error('marqueur absent : ' + nom);
  return html.replace(re, () => bloc);
}

// ───────────────────────────── 1. page d'accueil française (source)
function preparerSourceFrancaise() {
  let h = lire('decouvrir.html');
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${echapper(ACCUEIL.fr.titre)}</title>`);
  // marqueurs posés une seule fois
  if (!h.includes('<!-- SEO:DEBUT')) h = h.replace('</title>', '</title>\n<!-- SEO:DEBUT -->\n<!-- SEO:FIN -->');
  if (!h.includes('<!-- LANGUE:DEBUT')) h = h.replace('<!-- Interactive Language Toggle -->', '<!-- LANGUE:DEBUT -->\n<!-- LANGUE:FIN -->');
  if (!h.includes('<!-- RESSOURCES:DEBUT')) {
    const ancre = '<li class=""><a class="hover:text-white transition-colors" href="./app.html">Se connecter</a></li>';
    if (!h.includes(ancre)) throw new Error('ancre du pied de page introuvable (Se connecter)');
    h = h.replace(ancre, ancre + '\n<!-- RESSOURCES:DEBUT -->\n<!-- RESSOURCES:FIN -->');
  }
  if (!h.includes('<!-- RESEAUX:DEBUT')) {
    const ancre = '<p class="text-xs">support@kalea.pro</p>';
    if (!h.includes(ancre)) throw new Error('ancre du pied de page introuvable (contact)');
    h = h.replace(ancre, ancre + '\n<!-- RESEAUX:DEBUT -->\n<!-- RESEAUX:FIN -->');
  }
  h = h.replace('<script src="./accueil-langue.js"></script>', '<script src="./selecteur-langue.js"></script>');
  h = h.replace('href="./decouvrir.html"', 'href="./"');   // le logo mène à la racine, pas à la copie decouvrir.html
  h = remplacerEntreMarqueurs(h, 'SEO', balisesSeo({
    lg: 'fr', titre: ACCUEIL.fr.titre, description: ACCUEIL.fr.description, canonique: URL_ACCUEIL.fr,
    alternates: { fr: URL_ACCUEIL.fr, en: URL_ACCUEIL.en, 'x-default': URL_ACCUEIL.fr }, jsonld: jsonLdAccueil('fr', faqDepuisHtml(h)),
  }));
  h = remplacerEntreMarqueurs(h, 'LANGUE', selecteurLangue('fr', '/', '/en/'));
  h = remplacerEntreMarqueurs(h, 'RESSOURCES', liensRessources('fr'));
  h = remplacerEntreMarqueurs(h, 'RESEAUX', liensReseaux());
  return h;
}

// ───────────────────────────── 3. traduction anglaise (même dictionnaire que accueil-langue.js)
function chargerDictionnaire() {
  const src = lire('accueil-langue.js');
  const debut = src.indexOf('var TEXTES = [');
  const fin = src.indexOf('var TITRE');
  const mails = src.match(/var OBJETS_MAIL = (\{[\s\S]*?\});/);
  if (debut < 0 || fin < 0 || !mails) throw new Error('dictionnaire introuvable dans accueil-langue.js');
  const f = new Function(src.slice(debut, fin) + `; var OBJETS_MAIL = ${mails[1]}; return { TEXTES: TEXTES, ATTRIBUTS: ATTRIBUTS, OBJETS_MAIL: OBJETS_MAIL };`);
  return f();
}
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
function parcourir(noeud, fn) { fn(noeud); (noeud.childNodes || []).forEach((n) => parcourir(n, fn)); if (noeud.content) parcourir(noeud.content, fn); }
const attr = (n, nom) => (n.attrs || []).find((a) => a.name === nom);
function dansSansTraduction(n) { for (let p = n; p; p = p.parentNode) if (attr(p, 'data-sans-traduction')) return true; return false; }

function versAnglais(htmlFr, rapport) {
  const dico = chargerDictionnaire();
  const T = Object.create(null); dico.TEXTES.forEach((p) => { T[norm(p[0])] = p[1]; });
  const A = Object.create(null); dico.ATTRIBUTS.forEach((p) => { A[norm(p[0])] = p[1]; });
  const doc = parse(htmlFr);
  const restes = new Set();
  parcourir(doc, (n) => {
    if (n.nodeName === '#text') {
      const parent = n.parentNode;
      if (!parent || /^(script|style|noscript|title)$/.test(parent.nodeName) || dansSansTraduction(n)) return;
      const cle = norm(n.value);
      if (!cle) return;
      const en = T[cle];
      if (en === undefined) { if (/[a-zàâçéèêëîïôûùüœ]{3,}/i.test(cle) && /[àâçéèêëîïôûùüœ]| (le|la|les|des|de|du|et|vos|votre|une?|pour|avec|sans|dans) /i.test(' ' + cle + ' ')) restes.add(cle.slice(0, 90)); return; }
      n.value = n.value.match(/^\s*/)[0] + en + n.value.match(/\s*$/)[0];
      return;
    }
    if (!n.attrs) return;
    for (const a of n.attrs) {
      if (['alt', 'title', 'aria-label', 'placeholder'].includes(a.name) && !dansSansTraduction(n) && A[norm(a.value)] !== undefined) a.value = A[norm(a.value)];
      if (a.name === 'href' && a.value.startsWith('mailto:')) {
        const [base, objet] = a.value.split('?subject=');
        if (objet && dico.OBJETS_MAIL[objet]) a.value = base + '?subject=' + dico.OBJETS_MAIL[objet];
      }
      // adresses relatives de la racine → absolues (la page est dans /en/)
      // idem pour les listes d'images (srcset) : « ./images/a.webp 720w, ./images/b.webp 1280w » → adresses absolues
      if (a.name === 'srcset') a.value = a.value.replace(/(^|,\s*)\.\//g, '$1/');
      if ((a.name === 'href' || a.name === 'src') && a.value.startsWith('./')) a.value = (a.value === './decouvrir.html' || a.value === './') ? '/en/' : '/' + a.value.slice(2);
    }
  });
  parcourir(doc, (n) => {
    if (n.nodeName === 'html') {
      n.attrs = n.attrs.filter((a) => a.name !== 'data-lang');
      const lang = attr(n, 'lang'); if (lang) lang.value = 'en'; else n.attrs.push({ name: 'lang', value: 'en' });
    }
  });
  rapport.restesFrancais = [...restes];
  return serialize(doc);
}

function sourceAnglaise(htmlFr, rapport) {
  let h = htmlFr.replace(/<title>[\s\S]*?<\/title>/, `<title>${echapper(ACCUEIL.en.titre)}</title>`);
  const seoEn = (faq) => balisesSeo({
    lg: 'en', titre: ACCUEIL.en.titre, description: ACCUEIL.en.description, canonique: URL_ACCUEIL.en,
    alternates: { fr: URL_ACCUEIL.fr, en: URL_ACCUEIL.en, 'x-default': URL_ACCUEIL.fr }, jsonld: jsonLdAccueil('en', faq),
  });
  h = remplacerEntreMarqueurs(h, 'SEO', seoEn([]));
  h = remplacerEntreMarqueurs(h, 'LANGUE', selecteurLangue('en', '/', '/en/'));
  h = remplacerEntreMarqueurs(h, 'RESSOURCES', liensRessources('en'));
  // 1re passe : traduction ; on lit les questions anglaises de la page traduite, puis on les met dans les données structurées
  const faqEn = faqDepuisHtml(versAnglais(h, {}));
  h = remplacerEntreMarqueurs(h, 'SEO', seoEn(faqEn));
  return versAnglais(h, rapport);
}

// ───────────────────────────── 4. pages de contenu
function extraire(html, re, nom) { const m = html.match(re); if (!m) throw new Error('bloc introuvable : ' + nom); return m[0]; }
function enveloppes(htmlPage, lg) {
  // en-tête, pied de page et symboles du logo, pris tels quels sur la page d'accueil de la même langue
  const doc = parse(htmlPage); const out = {};
  parcourir(doc, (n) => {
    if (n.nodeName === 'header' && !out.header) out.header = serialize({ nodeName: '#document-fragment', childNodes: [n] });
    if (n.nodeName === 'footer' && !out.footer) out.footer = serialize({ nodeName: '#document-fragment', childNodes: [n] });
    if (n.nodeName === 'svg' && !out.sprite && (attr(n, 'height') || {}).value === '0') out.sprite = serialize({ nodeName: '#document-fragment', childNodes: [n] });
  });
  const base = lg === 'fr' ? '/' : '/en/';
  const relier = (s) => s.replace(/href="#(?!picto-)/g, `href="${base}#`)   // les symboles du logo (#picto-…) restent internes à la page.replace(/href="\.\/"/g, 'href="/"').replace(/href="\.\//g, 'href="/');
  return { header: relier(out.header), footer: relier(out.footer), sprite: out.sprite };
}
function resoudre(texte, lg, courant) {
  return texte
    .replace(/\{\{lien:(\w+)\}\}/g, (_, id) => { const p = PAGES.find((x) => x.id === id); if (!p) throw new Error('page inconnue : ' + id); return cheminPage(p, lg); })
    .replace(/\{\{accueil\}\}/g, lg === 'fr' ? '/' : '/en/');
}
function pageContenu(p, lg, parties, htmlFrSource) {
  const l = p[lg]; const L = LIB[lg]; const autre = lg === 'fr' ? 'en' : 'fr';
  const alt = { [lg]: urlPage(p, lg), [autre]: urlPage(p, autre), 'x-default': urlPage(p, 'fr') };
  const seo = balisesSeo({ lg, titre: l.titre, description: l.description, canonique: urlPage(p, lg), alternates: alt, jsonld: jsonLdPage(p, lg) });
  const header = remplacerEntreMarqueurs(parties.header, 'LANGUE', selecteurLangue(lg, lg === 'fr' ? cheminPage(p, 'fr') : cheminPage(p, 'fr'), cheminPage(p, 'en')));
  const style = extraire(htmlFrSource, /<style data-purpose="custom-typography-and-helpers">[\s\S]*?<\/style>/, 'style');
  const polices = (htmlFrSource.match(/<link[^>]*(fonts\.(googleapis|gstatic)\.com|\/polices\/)[^>]*>/g) || []).join('\n');
  const base = lg === 'fr' ? '/' : '/en/';
  const p1 = (t) => resoudre(t, lg);
  const sections = l.sections.map((s) => `<section class="mt-12 [&_a]:text-brand-primary [&_a]:font-semibold [&_a]:underline [&_strong]:text-brand-ink">
<h2 class="font-display font-bold text-2xl text-brand-ink tracking-tight">${s.h2}</h2>
${(s.paras || []).map((t) => `<p class="mt-3 text-slate-600 leading-relaxed">${p1(t)}</p>`).join('\n')}
${s.liste ? `<ul class="mt-4 space-y-3 text-slate-600 leading-relaxed list-disc pl-5 marker:text-brand-teal">${s.liste.map((t) => `<li>${p1(t)}</li>`).join('')}</ul>` : ''}
</section>`).join('\n');
  const faq = `<section class="mt-14">
<h2 class="font-display font-bold text-2xl text-brand-ink tracking-tight">${L.faq}</h2>
<div class="mt-4 divide-y divide-brand-borderMuted rounded-2xl border border-brand-borderMuted bg-white">
${l.faq.map((f) => `<details class="p-5"><summary class="cursor-pointer font-semibold text-brand-ink">${f.q}</summary><p class="mt-3 text-slate-600 leading-relaxed">${p1(f.r)}</p></details>`).join('\n')}
</div></section>`;
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: l.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.r.replace(/<[^>]+>/g, '') } })) };
  const liees = PAGES.filter((x) => x.id !== p.id).map((x) => `<li><a class="font-semibold text-brand-primary hover:underline" href="${cheminPage(x, lg)}">${x[lg].fil}</a></li>`).join('');
  return `<!DOCTYPE html>
<html lang="${lg}" class="scroll-smooth">
<head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>${echapper(l.titre)}</title>
${seo}
${polices}
${style}
<link rel="stylesheet" href="/site.css">
<link rel="stylesheet" href="/site-sombre.css">
<script src="/theme.js"></script>
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
</head>
<body class="antialiased min-h-screen flex flex-col justify-between selection:bg-brand-teal selection:text-white">
${parties.sprite}
${header}
<main class="flex-1">
<article class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
<nav aria-label="${L.fil}" class="text-xs text-slate-500 mb-6"><a href="${base}" class="hover:text-brand-primary">${L.accueil}</a> <span aria-hidden="true">›</span> <span>${l.fil}</span></nav>
<h1 class="font-display font-extrabold text-3xl sm:text-4xl text-brand-ink tracking-tight leading-tight">${l.h1}</h1>
<p class="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed [&_strong]:text-brand-ink">${p1(l.intro)}</p>
<div class="mt-8 flex flex-wrap gap-3">
<a class="bg-brand-ink hover:bg-slate-900 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-sm" href="/app.html?inscription=1">${L.essai}</a>
<a class="border border-brand-borderMuted bg-white text-brand-ink text-sm font-bold px-5 py-3 rounded-xl hover:border-brand-primary" href="${base}#tarifs">${L.tarifs}</a>
</div>
${sections}
${faq}
<section class="mt-14 rounded-3xl bg-brand-ink text-white p-8 sm:p-10">
<h2 class="font-display font-bold text-2xl tracking-tight">${L.bandeauTitre}</h2>
<p class="mt-2 text-slate-300 leading-relaxed">${L.bandeauTexte}</p>
<a class="mt-5 inline-block bg-white text-brand-ink text-sm font-bold px-5 py-3 rounded-xl" href="/app.html?inscription=1">${L.essai}</a>
</section>
<nav aria-label="${L.liees}" class="mt-12"><h2 class="font-display font-bold text-lg text-brand-ink">${L.liees}</h2><ul class="mt-3 space-y-2">${liees}</ul></nav>
</article>
</main>
${parties.footer}
<script src="/selecteur-langue.js"></script>
<script src="/bouton-theme.js"></script>
</body>
</html>
`;
}

// ───────────────────────────── 5. sitemap
function sitemap() {
  const alt = (fr, en) => `<xhtml:link rel="alternate" hreflang="fr" href="${fr}"/><xhtml:link rel="alternate" hreflang="en" href="${en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${fr}"/>`;
  const url = (loc, freq, prio, extra = '') => `  <url><loc>${loc}</loc><lastmod>${AUJOURDHUI}</lastmod><changefreq>${freq}</changefreq><priority>${prio}</priority>${extra}</url>`;
  const lignes = [
    url(URL_ACCUEIL.fr, 'monthly', '1.0', alt(URL_ACCUEIL.fr, URL_ACCUEIL.en)),
    url(URL_ACCUEIL.en, 'monthly', '0.9', alt(URL_ACCUEIL.fr, URL_ACCUEIL.en)),
    ...PAGES.flatMap((p) => ['fr', 'en'].map((lg) => url(urlPage(p, lg), 'monthly', '0.8', alt(urlPage(p, 'fr'), urlPage(p, 'en'))))),
    ...['cgu', 'mentions-legales', 'politique-confidentialite'].map((n) => url(`${SITE}/${n}.html`, 'yearly', '0.3')),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${lignes.join('\n')}\n</urlset>\n`;
}

// ───────────────────────────── exécution
const rapport = {};
const fr = preparerSourceFrancaise();
ecrire('decouvrir.html', fr);
ecrire('index.html', fr);
const en = sourceAnglaise(fr, rapport);
ecrire('en/index.html', en);
const partiesFr = enveloppes(fr, 'fr');
const partiesEn = enveloppes(en, 'en');
for (const p of PAGES) {
  ecrire(p.fr.fichier, pageContenu(p, 'fr', partiesFr, fr));
  ecrire(p.en.fichier, pageContenu(p, 'en', partiesEn, fr));
}
ecrire('sitemap.xml', sitemap());
console.log('Pages écrites : decouvrir.html, index.html, en/index.html, ' + PAGES.length * 2 + ' pages de contenu, sitemap.xml');
console.log('Textes français restés non traduits dans en/index.html : ' + rapport.restesFrancais.length);
rapport.restesFrancais.slice(0, 40).forEach((t) => console.log('  - ' + t));
