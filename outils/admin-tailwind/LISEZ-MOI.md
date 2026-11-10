# Feuille de style de la console admin (admin-tailwind.css)

Jusqu'au 2026-11-11, admin.html chargeait le compilateur Tailwind depuis un CDN (code tiers exécuté dans la console des
superviseurs). La feuille de style est maintenant **compilée à l'avance** (Tailwind 3.4.17, la version que servait le CDN) et
hébergée avec le site : aucun script externe.

## Quand la refaire
À chaque fois que vous ajoutez ou changez une CLASSE Tailwind dans admin.html ou dans les fichiers marketing-*.js /
bouton-theme.js / theme.js (ou le thème de couleurs de tailwind.config.cjs). Une classe absente de la feuille = un style
qui ne s'applique plus, sans erreur.

## Comment (TOUJOURS depuis la racine du site : Tailwind lit les chemins du fichier de config depuis le dossier où l'on lance la commande)
    npx --yes tailwindcss@3.4.17 -c outils/admin-tailwind/tailwind.config.cjs -i outils/admin-tailwind/entree.css -o admin-tailwind.css --minify

`npx --yes` télécharge l'outil le temps de la commande : il n'est PAS une dépendance du projet. Puis, comme pour tout
changement de fichier du site : relancer `node outils/maj-empreinte-csp.mjs admin.html` si admin.html a changé.

## Piège connu
Tailwind ne repère que les classes écrites EN ENTIER dans le code. Une classe fabriquée par morceaux (`'bg-' + couleur`)
ne sera jamais compilée : écrire la classe complète quelque part (ex. dans un objet de correspondance).
