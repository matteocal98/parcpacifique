# Prompt Stitch — Fenêtre « Les offres KALEA »

## Contexte

KALEA — logiciel de gestion de flotte et de maintenance prédictive pour
artisans et BTP. Cette fenêtre (`openUpgradeNotice`, modale `.offres-modal`)
s'ouvre dans 3 cas : quota de machines atteint, restriction précise (ex.
fonctionnalité hors offre), ou simple consultation volontaire depuis "Mon
compte". Elle affiche 4 cartes (Gratuit / Starter / Business / Enterprise)
et un bloc de service à part ("Établissement de ton plan d'entretien", 29 €
l'acte, inchangé par ce chantier).

## Le problème à corriger (retour direct de l'utilisateur)

La version actuelle met le plus de poids visuel sur les **quotas IA**
(nombre d'analyses de carnet, de recherches de photo, de lectures de
compteur par mois) — c'est aujourd'hui le seul bloc à puces avec coches
vertes, donc l'œil s'arrête dessus en premier. Ce n'est PAS ce qui vend
l'offre : ces quotas sont un détail technique, pas l'argument commercial.

Ce qui doit porter l'offre visuellement, par ordre de priorité :
1. **La capacité de flotte** (nombre de machines, utilisateurs) — déjà
   présente mais reléguée à un petit badge discret ; elle doit devenir un
   élément fort de chaque carte.
2. **Les modules/fonctionnalités inclus** — aujourd'hui noyés dans une
   phrase de texte gris pâle tout en bas de carte (`.offre-carte-ajoute`),
   à transformer en la liste à puces PRINCIPALE, à la place qu'occupent
   aujourd'hui les quotas IA.
3. Les quotas IA : gardés (ne jamais cacher une vraie limite), mais en
   position secondaire — plus petits, en bas de carte, pas la première
   chose qu'on lit.

## Design system — reprendre celui déjà en place, ne rien réinventer

- Police titres/prix : Space Grotesk. Police texte courant : Hanken
  Grotesk.
- Fond de la modale : blanc (`#FFFFFF`), cartes blanches avec bordure
  fine `rgba(..,.30)` teintée par palier et `box-shadow` douce — pas de
  fond gris/teinté sur les cartes.
- Couleur d'accent par palier (bordure, badge capacité, coches, prix) :
  **Starter** → bleu roi `#236FE0`. **Business** (recommandée) → indigo
  `#6366F1`/`#5B52DF`, dégradé léger de fond + ruban "RECOMMANDÉ" en
  haut de carte. **Enterprise** → teal `#24B5A8`. **Gratuit** → neutre,
  aucun accent.
- Rayons/ombres : cartes `border-radius` ~16px, boutons pleine largeur
  ~44px de haut, pilules pour les badges.
- Logo KALEA (le "K" sur fond bleu nuit rond) en en-tête si la maquette
  montre un en-tête de page — sinon la modale a déjà son propre bandeau
  ("CHOISIS TON OFFRE" + titre + sous-titre + croix de fermeture), à
  garder tel quel.

## Contenu RÉEL par palier (ne rien inventer, ne rien arrondir)

| | Gratuit | Starter | Business ⭐recommandée | Enterprise |
|---|---|---|---|---|
| Prix | 0 € | 12 €/mois | 39 €/mois | 49 €/mois + 1 €/machine au-delà de 20 |
| Machines | 2 machines | 5 machines | 20 machines | parc sur mesure |
| Utilisateurs | 1 utilisateur | 1 utilisateur | 3 utilisateurs | rôles d'équipe |
| **Modules/fonctionnalités** (à mettre en avant) | Consultation, rappels e-mail et notifications | + Export CSV | + Multi-utilisateurs, QR codes, préparation groupée, **module Coûts & TCO** | + Support dédié, **module Stocks & SAV** (magasins, mouvements, kits d'entretien) |
| Quotas IA (secondaire) | 10 analyses carnet, 10 recherches photo, 30 lectures compteur | 20 / 10 / 200 | 30 / 30 / 500 | 5 000 / 5 000 / 2 000 |

Chaque palier est **cumulatif** : Business = tout ce que Starter a, plus
multi-utilisateurs/QR codes/préparation groupée/TCO. Enterprise = tout ce
que Business a, plus Stocks & SAV. C'est ce qui doit se lire d'un coup
d'œil en comparant les cartes de gauche à droite — pas juste 4 cartes
indépendantes.

## Anatomie de carte proposée (du haut vers le bas)

1. Ruban "RECOMMANDÉ" (Business uniquement, inchangé).
2. Nom du palier + tag (ex. "BUSINESS" / "Flotte") + badge "Offre
   actuelle" si c'est le palier en cours.
3. Prix en gros caractères.
4. **Capacité flotte, mise en avant** (pas juste un petit badge gris) :
   nombre de machines en grand, + utilisateurs juste à côté. C'est un des
   deux arguments principaux, il doit avoir un vrai poids visuel —
   envisager un second bloc chiffré au même niveau que le prix, pas une
   ligne annexe.
5. **"Ce que cette offre ajoute" — la liste à puces principale**, avec
   coches, qui reprend les modules/fonctionnalités du tableau ci-dessus
   (jamais les quotas IA ici).
6. En bas de carte, en plus petit et plus discret qu'aujourd'hui (texte
   gris, pas de coches vertes) : les 3 quotas IA, en une ligne compacte
   plutôt qu'une liste à puces (ex. "30 analyses · 30 photos · 500
   lectures/mois").
7. Pied de carte : le bouton d'action (inchangé fonctionnellement —
   "Ton offre actuelle" / "Gérer mon abonnement" / lien de paiement
   Stripe / "Nous contacter" pour Enterprise).

## Hors périmètre de ce prompt Stitch

- Le bloc "Établissement de ton plan d'entretien" (29 €, sous les 4
  cartes) : inchangé, ne pas le retravailler.
- La logique des boutons (lien Stripe, portail de facturation, mailto
  Enterprise) : 100% existante, le nouveau design doit juste prévoir le
  même emplacement pour UN bouton par carte.
- Les textes français exacts peuvent être reformulés pour mieux respirer
  dans la nouvelle hiérarchie, mais aucun chiffre, aucune fonctionnalité
  ne doit être ajouté ou retiré par rapport au tableau ci-dessus.

## Livrable attendu

Un seul `code.html` autonome (Tailwind CDN), 4 cartes + l'en-tête de
modale, prêt à être recompilé avec la même méthode que les précédents
chantiers Stitch de ce projet (`outils/tw-modifier-machine/`,
`outils/tw-ajouter-machine/`).
