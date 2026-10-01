# Prompt Stitch — Section "Tarifs" de la page publique decouvrir.html

## Contexte

KALEA — logiciel de gestion de flotte et de maintenance prédictive pour
artisans et BTP. `decouvrir.html` est la page marketing publique (site
vitrine, pas l'application). Sa section "Tarifs" (`#tarifs`) affiche 4
cartes d'offre, **bilingue FR/EN** (chaque texte existe en double, un
`<span class="fr">`/`<span class="en">`, bascule gérée par une classe sur
`<body>` — garder EXACTEMENT ce mécanisme, ne pas le remplacer).

On vient de refaire la fenêtre d'upgrade équivalente À L'INTÉRIEUR de
l'application (modale "Les offres KALEA") pour la même raison : cette
page-ci a le même défaut et doit être alignée sur la même logique.

## Le problème à corriger (même retour que pour la modale app)

Chaque carte liste aujourd'hui, DANS CET ORDRE :
1. Un quota IA (nombre d'analyses de carnet, de recherches de photo, de
   lectures de compteur) — premier et donc plus visible.
2. Une phrase résumant les modules/fonctionnalités — seconde, secondaire.

Ce n'est pas ce qui vend l'offre : le quota IA est un détail technique.
Ce qui doit porter la carte, dans l'ordre :
1. **La capacité de flotte** (déjà présente via `.limite`, mais à
   renforcer visuellement).
2. **Les modules/fonctionnalités**, en liste à puces claire (pas une
   phrase fondue), cumulatifs palier par palier.
3. Le quota IA : gardé, mais en dernier, en petit texte discret — jamais
   caché, juste plus modeste.

## Design system — reprendre celui déjà en place sur CETTE page (pas celui de l'app)

Cette page a son propre système, différent de l'application :
- Police : **Inter** (pas Space Grotesk/Hanken Grotesk, qui sont pour
  l'app).
- Couleurs : `--encre` #0E1333 (texte), `--texte-doux` #46464E (texte
  secondaire), `--fond` (blanc en clair, bascule sombre automatique via
  `prefers-color-scheme`). Un signal bilingue existant à CONSERVER : le
  français utilise l'accent `--signature-fr` #24B5A8 (turquoise), l'anglais
  `--signature-en` #5B52DF (indigo) — ce n'est PAS un code couleur par
  palier (contrairement à la modale app, où chaque palier a sa teinte :
  bleu/indigo/teal). Ne pas introduire de couleur par palier ici, garder
  le système actuel (toutes les cartes au même habillage, sauf la carte
  "recommandée" qui a un simple liseré `--encre`/blanc selon le mode).
- Rayon des cartes : 16px (`--r-lg`).
- Pas de fond teinté sur les cartes : fond `--fond` uni + ombre légère,
  comme aujourd'hui.

## Contenu RÉEL par palier (identique à la modale app, ne rien inventer)

| | Gratuit | Starter | Business ⭐recommandée | Enterprise |
|---|---|---|---|---|
| Prix | 0 €/mois | 12 €/mois | 39 €/mois | 49 €/mois + 1 €/machine au-delà de 20 |
| Machines | 2 machines, 1 utilisateur | 5 machines, 1 utilisateur | 20 machines, 3 utilisateurs | parc sur mesure, rôles d'équipe |
| **Modules/fonctionnalités** (à mettre en avant) | Consultation, rappels e-mail et notifications | + Export CSV | + Multi-utilisateurs, QR codes, préparation groupée, **module Coûts & TCO** | + Support dédié, **module Stocks & SAV** |
| Quotas IA (secondaire) | 10 analyses carnet, 10 recherches photo, 30 lectures compteur/mois | 20 / 10 / 200 | 30 / 30 / 500 | 5 000 / 5 000 / 2 000 |

Chaque palier est cumulatif (Business = Starter + multi-utilisateurs/QR
codes/préparation groupée/TCO ; Enterprise = Business + Stocks & SAV) —
à faire ressentir visuellement comme sur la modale app ("Tout ce qui est
dans Starter, plus :").

## Ce qui reste HORS périmètre de ce prompt

- Les 2 encarts sous les cartes (lectures de compteur / établissement de
  plan à 29 € ; changement d'offre sans engagement) : inchangés.
- La FAQ juste en dessous : inchangée.
- Les boutons d'action (liens vers `app.html?inscription=1`, mailto pour
  Enterprise) : mêmes cibles, juste la présentation peut changer.
- Le mécanisme bilingue `.fr`/`.en` : à conserver tel quel, chaque
  nouveau texte doit exister dans les deux langues comme aujourd'hui.

## Livrable attendu

Un seul `code.html` autonome (Tailwind CDN), les 4 cartes de la section
`#tarifs` uniquement — pas besoin de reproduire le reste de la page.
