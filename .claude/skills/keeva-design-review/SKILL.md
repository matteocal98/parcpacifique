---
name: keeva-design-review
description: Checklist de revue UI/UX pour app.html (keeva.work), à parcourir soi-même avant de considérer une modification de design terminée — contraste, structure de page, boutons, typographie. À utiliser chaque fois qu'un écran ou une modale de app.html est créé ou retouché visuellement, avant de répondre à l'utilisateur que c'est fait.
---

# Revue design KEEVA

Référence complète (couleurs, tokens exacts, composants) : l'artifact "Charte KEEVA"
(https://claude.ai/artifact/5WZFNc2nRPcfSsvY6s1L1A), section "Contraste et mise en
page — écran de référence : Machines". Ce skill est la version checklist,
opérationnelle, de ce document — à suivre soi-même plutôt que d'attendre que
l'utilisateur repère les écarts sur une capture d'écran.

**Pourquoi ce skill existe** : sur cette app, plusieurs passes de design ont laissé
passer des incohérences (fond blanc sur blanc, boutons de tailles différentes sur
une même page, un "contour noir" signalé comme réel alors qu'il s'agissait de CSS
mort jamais affiché). L'utilisateur a explicitement demandé d'arrêter de lui faire
jouer le rôle de contrôle qualité après coup. Ce skill formalise l'auto-contrôle à
faire AVANT de dire "c'est fait".

## Avant de commencer une modification

- Si le changement touche une page/modale qui n'a pas encore été passée en revue
  selon ces règles, le dire à l'utilisateur plutôt que de supposer qu'elle est déjà
  conforme.
- Ne jamais signaler un problème visuel ("j'ai repéré X") sans l'avoir vérifié en
  direct dans le navigateur (`document.querySelectorAll` sur la vraie classe, ou une
  capture) — un motif trouvé par recherche de texte dans le code n'est pas forcément
  du code qui s'affiche encore (cf. l'épisode `.machine`/`.m-actions`, CSS mort).

## Checklist à parcourir avant de répondre "c'est fait"

**1. Fond et contraste**
- [ ] Le fond de PAGE est teinté (`var(--surface-soft)`), jamais blanc pur.
- [ ] Chaque bloc qui doit se détacher est blanc (`var(--surface)`) avec une ombre
      (`box-shadow: var(--shadow-soft)`) — jamais de `border` sur un bloc/une carte
      flottante.
- [ ] Aucun élément n'a le même fond que son parent immédiat (pas de blanc sur
      blanc, pas de gris-teinté sur gris-teinté).
- [ ] Un sous-bloc à rôle propre (zone de saisie, encart actif) porte la teinte de
      SON rôle, pas un gris générique par défaut.
- [ ] Le statut (retard/bientôt/à jour) se lit par un accent localisé (liseré,
      point, badge), jamais en recolorant tout le bloc.
- [ ] **Règle « flottant partout » (décidée avec l'utilisateur le 2026-10-04 ;
      référence : Parc Machines, Plan d'entretien)** : AUCUNE grande carte blanche
      qui contient d'autres choses. Le titre d'un bloc, ses champs et ses lignes
      reposent DIRECTEMENT sur le fond de page teinté. Les éléments sont blancs avec
      `var(--shadow-soft)` et sans bordure : champs de saisie, pastilles de filtre,
      lignes de liste, cartes de machine/de manuel, zones de dépôt. Une barre de
      filtres n'est donc PAS un bloc blanc : c'est un champ de recherche blanc +
      des puces blanches posées sur le fond. Un champ placé DANS un élément déjà
      blanc (une ligne de liste) garde le fond par défaut des champs
      (`--surface-soft` = `rgba(14,19,51,.04)`, la seule teinte de contraste). Les
      fenêtres (modales) ont leur propre fond teinté et des champs blancs. Exceptions
      acceptées : les cartes qui sont elles-mêmes UN élément (carte de chiffre clé,
      alerte, machine). Au 2026-10-04 TOUS les menus suivent la règle (Machines,
      Plan d'entretien, Télémétrie, Mon compte, Rappels, Coûts & TCO, Stock & SAV,
      Tableau de bord, Agenda) ; le CSS correspondant est regroupé en fin de
      styles.css (blocs « CHARTE FLOTTANT PARTOUT »), ciblé par
      `#view-root[data-view="…"]`. Tout NOUVEAU menu doit être ajouté à ces listes.

      ★ LE KIT (2026-10-04) : les composants vivent dans `kit.css` (préfixe `ui-` :
      ui-section, ui-tuile, ui-liste/ui-ligne, ui-champ, ui-btn-plein/pastille/teinte,
      ui-puce, ui-encadre, ui-statut, ui-grille, ui-barre) et sont montrés avec leur code
      dans `charte.html`. UN NOUVEL ÉCRAN SE CONSTRUIT AVEC CES CLASSES, sans CSS propre.
      Migrer un menu = remplacer ses classes par celles du kit, retirer son ancien CSS
      de styles.css, et accrocher le JavaScript à des attributs `data-*` (pas aux classes
      de style). Déjà migré : les seuils cibles du TCO.

**2. Structure de page**
- [ ] Pas de grande carte-mère blanche qui enveloppe toolbar + filtres + liste —
      chaque bloc logique flotte indépendamment sur le fond de page (motif Machines/
      Plan d'entretien), sauf raison contraire déjà actée avec l'utilisateur.
- [ ] Les cartes d'une même liste ont un espacement visible entre elles (pas
      collées), et le fond de page reste visible entre elles.

**3. Boutons**
- [ ] Bouton à fond plein (noir/indigo foncé, texte blanc) → 16px / 700, quelle que
      soit la taille de la carte qui le contient.
- [ ] Bouton à fond clair/teinté (action secondaire compacte) → 13px / 700.
- [ ] Petite puce de raccourci (pas un filtre/statut) → 12px / 700.
- [ ] Aucun bouton n'a de contour épais (`border: 2px solid var(--ink)` ou
      équivalent) — remplacer par un fond teinté sans bordure.
- [ ] Sur UNE MÊME page, deux boutons à fond plein n'ont jamais des tailles
      différentes (vérifier explicitement, c'est le piège le plus fréquent).
- [ ] Le namespace `.pplan-*` (écrans "Plan proposé par notre algorithme") reste à
      part, jamais mélangé à ces règles — Space Grotesk, ses propres tailles.

**4. Typographie**
- [ ] Titre de page (`<h1>` injecté par `pageHeadHtml()`/`.head-title h1`, ou son
      équivalent par écran) : Space Grotesk, 31px / 38px / 800 / -0.02em.
- [ ] Space Grotesk réservé aux titres et chiffres techniques ; Figtree pour le
      texte courant — jamais l'inverse sur un nouvel élément.

**5. Alignement des champs**
- [ ] Dans une même rangée de champs (`.field-row` ou équivalent), vérifier que
      tous les champs ont la MÊME hauteur rendue — pas seulement au coup d'œil,
      mesurer (`getBoundingClientRect().height`). Un champ avec une police plus
      grande (ex. un compteur en gros chiffres Space Grotesk 21px) déborde
      facilement de quelques pixels par rapport à ses voisins en police
      standard, même avec `align-items:flex-end`/`stretch` sur le conteneur —
      repéré sur "Enregistrer une intervention" (Date / Compteur relevé /
      Intervenant assigné). Corriger avec une hauteur explicite sur le
      conteneur du champ en cause plutôt qu'en ajustant le padding au jugé
      (plus fiable, moins d'aller-retours).

**6. Avant de livrer**
- [ ] Testé en direct dans le navigateur (`javascript_tool` + `renderApp()`), pas
      seulement relu dans le code — écran cible ET, si le changement est dans une
      classe/fonction partagée, au moins un autre écran qui la réutilise.
- [ ] Testé à une largeur desktop ET mobile si le composant a un comportement
      responsive.
- [ ] Zéro erreur console nouvelle (le 401 d'auth Supabase en environnement de test
      local est attendu et sans rapport).
- [ ] CSP/`version.json` resynchronisés si un `<script>` (y compris un
      `style="..."` À L'INTÉRIEUR d'un template JS) a changé — jamais pour du CSS
      pur dans la balise `<style>`.

## Ce qui n'est volontairement pas dans cette checklist

Chips/pills/badges de filtre/statut, et la structure "carte flottante" des pages
Agenda/Rappels/Coûts & TCO/Stock : décisions encore ouvertes au 29 sept. 2026, à
trancher avec l'utilisateur avant de les ajouter ici — ne pas les uniformiser de sa
propre initiative tant que ce n'est pas acté.
