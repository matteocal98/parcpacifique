# Régénérer le CSS Tailwind de la modale "Modifier une machine"

Le bloc CSS scopé `.machine-modal-edit` dans `app.html` (juste après le
commentaire "MODALE MODIFIER UNE MACHINE") n'est pas écrit à la main — c'est
le vrai CSS compilé par Tailwind à partir de `mockup.html` (copie du
code.html livré par Stitch) et de `tailwind.config.js`.

Version actuelle : AUCUN remap. Couleurs Material 3 et police Plus Jakarta
Sans reprises telles quelles (décision explicite de l'utilisateur après
plusieurs passes de remap KEEVA jugées trop différentes de la maquette).
Les icônes utilisent aussi les vraies Material Symbols (police chargée dans
app.html, deux instances : une fixe déjà utilisée par les écrans pplan-*,
une variable ajoutée pour cette modale, même plage que code.html), pas les
pictos SVG tracés à la main du reste de l'app.

Pourquoi compiler plutôt qu'écrire à la main : traduire les classes
Tailwind à la main (une passe manuelle par valeur) a laissé passer des
erreurs à plusieurs reprises. Faire compiler Tailwind lui-même supprime
cette étape de traduction.

Pour régénérer après une modification de mockup.html ou du config :

```bash
npx tailwindcss@3 -i input.css -o output.css
```

Puis coller le contenu de `output.css` dans app.html, à la place du bloc
existant (repérable par le commentaire "MODALE MODIFIER UNE MACHINE").

Le scope est fait via `important: '.machine-modal-edit'` (PAS `prefix` —
`prefix` casse la détection de classes dans le contenu avec Tailwind
3.4.19, cause non identifiée). Preflight est désactivé
(`corePlugins: { preflight: false }`) pour ne pas resitrer les
éléments (h1-h6, button, input...) de TOUTE l'app — seul un petit
reset scopé sous `.machine-modal-edit` dans app.html couvre button/
input/select/textarea (border, margin, appearance).

Les cartes sélectionnables (type d'unité, mode de suivi, second suivi)
restent un petit composant CSS écrit à la main (`.mform-card`/
`.is-selected`), PAS du Tailwind compilé : la maquette statique ne montre
qu'un instantané par état, alors que l'app doit basculer l'un vers l'autre
en direct au clic (JS existant : marquerCarteSelectionnee). Ses couleurs
sont recopiées à la main depuis les mêmes hex que le config (pas de var()
KEEVA non plus, pour rester cohérent avec le reste de la modale).
