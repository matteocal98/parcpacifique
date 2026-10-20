# Pages publiques de kalea.pro : génération et CSS

**La source à éditer à la main : `decouvrir.html`** (français). Tout le reste est produit.

```
cd outils/css-site
npm install          # une seule fois
npm run pages        # génère les pages puis recompile site.css
```

`npm run pages` (= `node outils/generer-pages-publiques.mjs` puis `npm run build`) :

- met à jour dans `decouvrir.html` les blocs entre marqueurs (`SEO`, `LANGUE`, `RESSOURCES`, `RESEAUX`) : balises de référencement, sélecteur FR/EN, liens du pied de page ;
- recopie `decouvrir.html` dans `index.html` (les deux pages doivent rester identiques) ;
- produit `en/index.html` (version anglaise) avec le dictionnaire de `accueil-langue.js` : **toute nouvelle phrase de l'accueil doit y être ajoutée** (le générateur affiche les textes français restés sans traduction) ;
- produit les pages de contenu (`outils/pages-contenu.mjs`), en français et en anglais ;
- écrit `sitemap.xml` ;
- recompile `site.css` (Tailwind, 40-50 Ko) à partir de toutes les pages et de `videos-accueil.js`, `simulateur-tarifs.js`, `selecteur-langue.js`. Une classe Tailwind ajoutée par JavaScript doit être écrite en toutes lettres dans l'un de ces fichiers.

Titres, descriptions, réseaux sociaux et image d'aperçu : `outils/seo-config.mjs`. Images d'aperçu : `partage-og.jpg` (FR) et `partage-og-en.jpg` (EN), 1200 × 630.

Pas encore compilé (il charge encore Tailwind depuis Internet) : `admin.html`.
