# Projet KALEA (kalea.pro)

## Contexte
- Application web **kalea.pro** (anciennement keeva.work — renommée fin septembre 2026 car la marque « KEEVA » était déjà déposée par un tiers) + application **Android** associée (en cours d'examen sur Google Play).
- Propriétaire : Matthieu Courtois, basé en Nouvelle-Calédonie (fuseau Pacific/Noumea, UTC+11).

## Stack technique
- Code du site (public) : ce dépôt (`parcpacifique`), hébergé sur GitHub Pages. Branche de travail `redesign-stitch`, fusionnée dans `main` (fast-forward) après validation.
- Code serveur (Edge Functions Supabase) : dépôt **privé séparé** `kalea-serveur`.
- Base de données et authentification : **Supabase** (projet `tiayvmnodsbygmuemeuy`).
- Console d'administration (staff only, `profiles.is_staff`) : `admin.html`.
- Paiement : Stripe aujourd'hui ; bascule vers **Stancer** envisagée (Stripe ne couvre pas la Nouvelle-Calédonie comme pays d'activité).
- Application mobile : Android/Capacitor, build hors de ce dépôt git (`Appli mobile/`).

## État d'avancement
- Application fonctionnelle, bêta-tests pas encore lancés.
- Application Android soumise, en attente de validation par Google.
- Redesign Stitch (menus + 12 modales cataloguées) terminé.
- Rebranding KEEVA → KALEA terminé (nom affiché, logo, domaine) ; la palette de couleurs de l'app n'a volontairement pas été alignée sur la nouvelle charte graphique (écart jugé imperceptible en usage normal).

## Points ouverts
- `support@kalea.pro` n'est pas encore une boîte mail active — les adresses de réponse et de destinataire interne restent sur `support@keeva.work` en attendant.
- Noms des produits Stripe toujours "KEEVA Éco/Pro" — en suspens tant que la bascule vers Stancer n'est pas tranchée.
- Modèles d'e-mails Supabase (connexion, mot de passe oublié) rédigés mais pas confirmé installés côté Dashboard.
- Modale "Fenêtre d'upgrade" volontairement pas retouchée, en attendant des ajustements sur la grille d'offres.

## Comment travailler avec moi
- Je ne suis **pas développeur**. Explique chaque modification simplement, en français.
- **Demande-moi avant** tout changement important : schéma Supabase, suppression de fichiers, dépendances, déploiement.
- Travaille par petites étapes testables et dis-moi comment vérifier le résultat (quelle page ouvrir, quoi regarder).
- Fais un commit Git clair après chaque étape validée, pour pouvoir revenir en arrière. Ne pousse jamais sans me le demander explicitement.
- Ne jamais committer de clés ou de secrets (clés Supabase, etc.) : ils vont dans `.env` ou dans les secrets Supabase, jamais en dur dans le code.

## Commandes utiles
- `node outils/maj-empreinte-csp.mjs [fichier.html]` — à lancer après TOUTE modification du `<script>` inline de `app.html` ou `admin.html` (jamais pour du CSS seul), sinon la CSP bloque le chargement de la page.
- Déploiement d'une fonction serveur (depuis le dépôt `kalea-serveur`) :
  `npx supabase functions deploy <nom-de-la-fonction> --project-ref tiayvmnodsbygmuemeuy`
  (nécessite un token de compte `sbp_...`, généré sur supabase.com/dashboard/account/tokens — jamais la clé publique du projet).
