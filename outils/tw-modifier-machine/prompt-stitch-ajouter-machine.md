# Prompt Stitch — Modale « Ajouter une machine »

## Contexte

KEEVA — logiciel de gestion de flotte et de maintenance prédictive pour
artisans et BTP. Cette modale existe déjà en tant qu'assistant multi-écrans
(6 étapes successives) ; l'objectif est de la refondre en **un seul
formulaire qui défile**, sur le modèle de la modale « Modifier une
machine » déjà livrée (même famille de modale, mêmes champs pour l'essentiel
— seule la présence d'un carnet à analyser change vraiment la donne).

## Design system — IMPÉRATIF : reprendre exactement celui de « Modifier une machine »

Ne pas réinventer une palette. Reprendre à l'identique le design system déjà
approuvé et en production sur la modale sœur :
- Police : Plus Jakarta Sans (textes), icônes Material Symbols Outlined.
- Couleurs : `primary` #006591, `on-surface` #0b1c30, `surface` #f8f9ff,
  `surface-container-lowest` #ffffff (fond des CHAMPS DE SAISIE),
  `surface-container-low` #eff4ff, `surface-container` #e5eeff,
  `tertiary-container` #ee7d1a (orange — carte "29€"), `outline` #6e7881.
- Fond de la modale entière (hors champs) : **#F2F4F8** (pas blanc — c'est
  la dernière retouche demandée par l'utilisateur sur "Modifier", à
  reprendre ici dès le départ).
- Rayons : `rounded-2xl` sur la modale, `rounded-xl` sur les cartes/inputs.
- Zéro bordure dure sur les cartes : élévation par fond teinté + `shadow-sm`.
- Largeur de la modale : 56rem (`max-w-4xl`), comme "Modifier une machine".
- Header : titre "Ajouter une machine" + sous-titre court ("Elle apparaîtra
  immédiatement dans la liste, avec son plan de maintenance.") + croix de
  fermeture. **Pas de badge de statut, pas de nom de machine à côté du
  titre** (elle n'existe pas encore) — contrairement à "Modifier".
- Pied de page : bouton secondaire "Annuler" à gauche, CTA principal à
  droite **"Ajouter la machine"** (fond `tertiary-container` #ee7d1a,
  texte blanc — pas "Enregistrer les modifications"). **Pas de lien
  "Supprimer" en bas** (rien à supprimer).

## Sections du formulaire (dans cet ordre, un seul scroll)

### 01 — Identification du matériel
Identique à "Modifier une machine" section 01 :
- Cartes sélectionnables "Machine / Engin de chantier" (compteur horaire)
  vs "Véhicule roulant / Fourgon" (odomètre km).
- Nom de la machine, Catégorie (select).
- Marque, Modèle, Année du modèle, Date de mise en service.
- N° de série / immatriculation (le libellé dépend du type choisi
  au-dessus).
- Prix d'achat + Date d'achat (bloc "Acquisition & TCO", facultatif).
Tous ces champs sont VIDES par défaut (pas de valeur pré-remplie).

### 02 — Carnet d'entretien du constructeur (nouveau contenu, pas dans "Modifier")
C'est la vraie différence avec "Modifier" : ici on n'a pas encore de plan.
- Zone de dépôt PDF (glisser-déposer) + bouton "Photographier le carnet"
  (le composant `dropzoneHtml` existant peut être repris tel quel dans
  l'esprit — pointillés, icône, "Glissez votre PDF ici ou parcourez").
- Une ligne d'aide : "Notre algorithme extrait les échéances (heures,
  mois) et crée le plan d'entretien. Tu valides avant activation."
- Carte "Vous ne trouvez pas votre carnet ?" (fond `tertiary-container`
  léger, icône `contact_support`) — texte court et CTA "Demander
  l'établissement de mon plan — 29 €" : **reprendre le texte déjà raccourci
  sur "Modifier"** : "Pour 29 € (paiement unique), nous configurons votre
  plan d'entretien modifiable directement dans l'application (aucun manuel
  constructeur fourni). Si les données de la machine sont insuffisantes,
  nous vous avertissons avant tout paiement, sans rien inventer."
- **Important, corrigé après relecture par l'utilisateur** : l'écran
  « Plan proposé par notre algorithme » (tableau des échéances détectées,
  éditables ligne par ligne, + 3 choix "Suivre ce plan" (recommandé) /
  "Modifier ce plan" / "Faire mon propre plan") **reste un écran à part,
  affiché juste après une analyse réussie — il ne disparaît PAS.** C'est
  une étape de confirmation volontairement mise en avant : l'utilisateur
  doit voir et valider ce que l'IA a compris avant que ça devienne le plan
  réel de la machine. Voir plus bas, "Hors périmètre de ce prompt Stitch"
  — cet écran est déjà conçu et ne doit pas être redemandé à Stitch.

### 03 — Mode de suivi & échéances d'entretien
Identique à "Modifier une machine" section correspondante :
- Cartes "Calendaire" / "Compteur horaire" / "Kilométrage".
- Champ "Relevé actuel" si mode compteur/km.
- Échéance + Rappel (unité dépend du mode choisi).
- Bloc optionnel "Ajouter un second suivi" (case à cocher qui déplie un
  panneau : mode secondaire, relevé, échéance, rappel) — même
  comportement que "Modifier".

### 04 — Tâches de maintenance
Un `<textarea>` libre, comme sur "Modifier" (pré-rempli par l'analyse du
carnet si elle a abouti, sinon vide — placeholder "Ex. Vidange, contrôle
lame, graissage").

### 05 — Visuel & photo du matériel
Identique à "Modifier une machine" : cadre photo (fond BLANC, pas teinté —
dernière retouche faite sur "Modifier", à reprendre dès le départ), boutons
"Choisir une photo" / "Prendre une photo" / "Chercher une photo sur le web".

## Ce qui disparaît par rapport à l'assistant actuel (assumé, à confirmer si besoin)

- L'écran de choix binaire "As-tu le carnet ?" (3 grandes tuiles) : remplacé
  par la simple zone de dépôt de la section 02, toujours visible, avec la
  carte "29 €" juste en dessous pour qui n'a pas de carnet.
- La checklist de tâches courantes à cocher (variante "pas de carnet") :
  remplacée par le même champ libre que "Modifier", pour cohérence — si tu
  préfères garder des cases à cocher rapides (Graissage, Vidange,
  Nettoyage, Contrôle des niveaux…) au-dessus du champ libre, dis-le et on
  les rajoute.

## Hors périmètre de ce prompt Stitch — écran déjà conçu, à NE PAS refaire

L'écran « Plan proposé par notre algorithme » (`stepPlanChoice`, app.html)
a déjà eu son propre chantier Stitch (reskin `.pplan-*`, police Space
Grotesk, accent bleu) — un design system volontairement à part du reste de
l'app (même les chantiers d'uniformisation des couleurs/boutons l'ont
explicitement laissé de côté). Il continue à s'afficher tel quel, comme
aujourd'hui, entre l'upload du carnet et l'enregistrement final :

1. Le nouveau formulaire unique (sections 01 → 05 ci-dessus) reste la page
   de base.
2. Si un carnet est déposé ET que l'analyse trouve des échéances, l'écran
   `.pplan-*` existant s'affiche par-dessus (comme aujourd'hui) :
   - « Suivre ce plan » ou « Faire mon propre plan » → enregistre direct.
   - « Modifier ce plan » → revient au formulaire unique, sections 03/04
     déjà pré-remplies par l'analyse, pour ajustement avant d'enregistrer.
3. Sans carnet (ou analyse infructueuse), le formulaire unique s'enregistre
   directement via son propre bouton "Ajouter la machine" — l'écran
   `.pplan-*` n'apparaît jamais dans ce cas.

Ne pas demander à Stitch de redessiner cet écran : il ne fait pas partie
de ce prompt.

## Livrable attendu

Un seul `code.html` autonome (Tailwind CDN + config identique à celle de
"Modifier une machine"), même structure de modale (header fixe, corps qui
défile, pied de page fixe), prêt à être recompilé avec la même méthode
(`outils/tw-modifier-machine/`).
