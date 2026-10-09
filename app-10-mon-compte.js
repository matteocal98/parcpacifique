/* KALEA — application (app.html) : Vue Mon compte, suppression du compte, feuille « Plus » (mobile).
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · Vue : Mon compte
 *   · SUPPRIMER MON COMPTE
 *   · Feuille « Plus » (mobile)
 */
// ───────────────────────── début du code ─────────────────────────
// ── Vue : Mon compte ──────────────────────────────────────────
// ★ TÉLÉMÉTRIE — menu à part (sorti de « Mon compte » le 2026-10-04 pour ne pas le
// surcharger, et pour accueillir la carte GPS des machines — phase 3). Réservé à
// l'offre Enterprise et au gérant ; la logique vit dans telemetrieCarteHtml() /
// preparerCarteTelemetrie() (voir plus haut).
VIEWS.telemetrie = {
  fondBlanc: true,
  title: trad('Télémétrie'),
  subtitle: () => trad('Compteurs automatiques de tes machines'),
  render() {
    const carte = telemetrieCarteHtml();
    const blocCarte = carteGpsHtml();
    return `
      <div class="ui-page">
        ${blocCarte}
        ${carte || `<section class="ui-section"><p class="ui-aide">${trad('La télémétrie est réservée au gérant, sur l\'offre Enterprise.')}</p></section>`}
      </div>`;
  },
  mount() {
    const root = document.getElementById('view-root');
    if (!root) return;
    preparerCarteTelemetrie(root);
    preparerCarteGps(root);
  },
};

VIEWS.account = {
  fondBlanc: true,
  title: trad('Mon compte'),
  subtitle: () => UI.company.name || UI.companyName || trad('Société'),
  render() {
    const c = UI.company;
    const modifiable = SCHEMA.hasContactNames;
    const bloque = modifiable ? '' : ' disabled';
    // Le palier vient de la société quand elle le porte, sinon de celui que le
    // chargement a déjà retenu : afficher « undefined » à un client qui paie
    // serait le pire des deux mondes.
    const plan = c.plan || UI.companyPlan || 'free';
    // En-tête commun des sections : icône + titre + sous-titre (+ un repère à droite).
    const tete = (icone, titre, sous, acces) => `
        <div class="ui-section-tete">
          <div class="ui-section-icone">${picto(icone)}</div>
          <div class="ui-section-titres"><h2 class="ui-section-titre">${titre}</h2><p class="ui-section-sous">${sous}</p></div>
          ${acces ? `<div class="ui-section-acces">${acces}</div>` : ''}
        </div>`;
    return `
      <div class="ui-page"><div class="ui-colonnes"><div class="ui-colonne">
      <section class="ui-section">
        ${tete('batiment', trad('Société & Identité légale'), trad('Renseignements légaux d\'exploitation et de facturation.'),
          c.registrationNumber ? `<span class="ui-statut is-ok">${tR('{registre} renseigné', { registre: libelleRegistre(c.country) })}</span>` : '')}
        <div class="ui-section-corps">
          <div class="ui-grille is-3">
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="acc-name">${trad('Raison sociale')}</label>
              <input id="acc-name" class="ui-champ" required value="${esc(c.name || UI.companyName || '')}"${bloque}>
            </div>
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="acc-activity">${trad('Activité principale')}</label>
              <select id="acc-activity" class="ui-selecteur is-plein"${bloque}>
                ${[...new Set([c.activity, ...SIGNUP_ACTIVITIES].filter(Boolean))]
                  .map((a) => `<option value="${esc(a)}"${a === c.activity ? ' selected' : ''}>${esc(a)}</option>`)
                  .join('')}
              </select>
            </div>
            ${SCHEMA.hasCountry ? `
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="acc-pays">${trad('Pays')}</label>
              <select id="acc-pays" class="ui-selecteur is-plein"${bloque}>${optionsPaysSocieteHtml(c.country)}</select>
            </div>` : ''}
            ${SCHEMA.hasTco ? `
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="acc-devise">${trad('Devise')}</label>
              <select id="acc-devise" class="ui-selecteur is-plein"${bloque}>
                <option value="XPF"${c.currency === 'XPF' ? ' selected' : ''}>${esc(libelleDevise('XPF'))}</option>
                <option value="EUR"${c.currency !== 'XPF' ? ' selected' : ''}>${esc(libelleDevise('EUR'))}</option>
              </select>
            </div>` : ''}
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="acc-reg" id="acc-reg-etiquette">${libelleRegistre(c.country)}</label>
              <input id="acc-reg" class="ui-champ" value="${esc(c.registrationNumber || '')}"${bloque}>
            </div>
          </div>
          ${SCHEMA.hasTco ? `
          <div class="ui-encadre is-attention" id="acc-devise-bloc" hidden>
            ${picto('alerte')}
            <div>
              <p><strong>${trad('Devise non appliquée.')}</strong> ${trad('Changer de devise convertit TOUS les montants déjà enregistrés (coûts, seuils, prix des machines, catalogue de pièces), au taux fixe 1 € = 119,3317 XPF. Ce n\'est pas annulable d\'un clic : l\'enregistrement du pays ci-dessus ne la change jamais.')}</p>
              <button type="button" class="ui-btn ui-btn-pastille" id="acc-devise-appliquer"${bloque}>${trad('Convertir les montants')}</button>
            </div>
          </div>` : ''}
          <div class="ui-encadre">
            ${picto('case')}
            <p>${trad('Version KALEA déployée :')} <strong id="version-application" title="${esc(empreinteCourte())}">${esc(versionAffichee())}</strong> — ${trad('système à jour.')}</p>
          </div>
          <div class="ui-aide" id="acc-societe-msg" role="status" aria-live="polite"></div>
          <div><button type="button" class="ui-btn ui-btn-plein" id="acc-save-societe"${bloque}>${trad('Enregistrer les modifications')}</button></div>
          <div class="ui-liste">
          <div class="ui-ligne is-deux">
            <div class="ui-ligne-id">
              <div class="ui-ligne-icone">${picto('reglages')}</div>
              <div class="ui-ligne-textes">
                <span class="ui-ligne-nom">${esc(libellePalier(plan))}</span>
                <span class="ui-ligne-sous"><span class="ui-statut is-ok">${trad('ACTIF')}</span></span>
                ${phraseMachinesEnPlus() ? `<span class="ui-aide">${esc(phraseMachinesEnPlus())}</span>` : ''}
              </div>
            </div>
            <div class="ui-ligne-action"><button type="button" class="ui-btn ui-btn-pastille" id="account-upgrade">${trad('Changer d\'offre')}</button></div>
          </div>
          ${estInstitution() ? `
          <div class="ui-ligne is-deux">
            <div class="ui-ligne-id">
              <div class="ui-ligne-textes">
                <span class="ui-ligne-nom">${trad('Facturation')}</span>
                <span class="ui-ligne-sous">${trad('Institution : facturation mensuelle sur facture. Pour changer d\'offre ou de facturation, écris à support@kalea.pro.')}</span>
              </div>
            </div>
          </div>` : ''}
          ${(PALIERS_PAYANTS.indexOf(plan) !== -1 && !estInstitution()) ? `
          <div class="ui-ligne is-deux">
            <div class="ui-ligne-id">
              <div class="ui-ligne-textes">
                <span class="ui-ligne-nom">${trad('Abonnement')}</span>
                <span class="ui-ligne-sous">${trad('Résilier (à la fin de la période déjà payée), changer de carte, télécharger les factures : tout se fait dans le portail de facturation.')}</span>
                <span class="ui-aide" id="acc-portail-msg" role="status" aria-live="polite"></span>
              </div>
            </div>
            <div class="ui-ligne-action"><button type="button" class="ui-btn ui-btn-pastille" id="acc-portail">${picto('export')}<span>${trad('Gérer mon abonnement')}</span></button></div>
          </div>` : ''}
          </div>
        </div>
      </section>

      <section class="ui-section">
        ${tete('cadenas', trad('Identifiants & Connexion'), trad('Modification de l\'accès principal administrateur.'))}
        <div class="ui-section-corps">
          <div class="ui-champ-groupe">
            <span class="ui-etiquette">${trad('E-mail de connexion actuel')}</span>
            <div class="ui-valeur">${esc(UI.email || '—')}</div>
          </div>
          <div class="ui-grille">
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="acc-email">${trad('Nouvel e-mail de connexion')}</label>
              <input id="acc-email" class="ui-champ" type="email" autocomplete="off" name="nouvel-email-connexion" placeholder="${trad('nouvelle@adresse.nc')}">
            </div>
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="acc-password">${trad('Confirmer par mot de passe actuel')}</label>
              <div class="password-wrap">
                <input id="acc-password" class="ui-champ" type="password" autocomplete="off" name="mot-de-passe-actuel-confirmation">
                <button type="button" class="toggle-pw-btn" aria-pressed="false">${trad('Afficher')}</button>
              </div>
            </div>
          </div>
          <div class="ui-aide">${trad('Le changement est confirmé par email : la nouvelle adresse ne devient active qu\'après validation. Le mot de passe est demandé pour qu\'une session ouverte ne suffise pas à détourner le compte.')}</div>
          <div class="ui-aide" id="acc-email-msg" role="status" aria-live="polite"></div>
          <div><button type="button" class="ui-btn ui-btn-plein" id="acc-save-email">${trad('Mettre à jour l\'e-mail')}</button></div>
        </div>
      </section>

      <section class="ui-section">
        ${tete('telephone', trad('Contact & Alertes'), trad('Coordonnées de contact de la société ; l\'adresse e-mail ci-dessous reçoit les rappels automatiques de maintenance.'))}
        <div class="ui-section-corps">
          <div class="ui-grille">
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="acc-first">${trad('Prénom')}</label>
              <input id="acc-first" class="ui-champ" value="${esc(companyFirstName(c))}"${bloque}>
            </div>
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="acc-last">${trad('Nom')}</label>
              <input id="acc-last" class="ui-champ" value="${esc(companyLastName(c))}"${bloque}>
            </div>
          </div>
          <div class="ui-champ-groupe">
            ${champTelephoneHtml('acc-phone', c.phone || '', {
              label: trad('Téléphone'),
              disabled: !modifiable,
              aide: trad('Coordonnée de contact de la société.'),
              indicatifSeul: true,
              kit: true,
            })}
          </div>
          ${sousBlocEmailRappelsHtml()}
          ${sousBlocPushHtml()}
          <div class="ui-aide" id="acc-contact-msg" role="status" aria-live="polite"></div>
          <div><button type="button" class="ui-btn ui-btn-plein" id="acc-save-contact"${bloque}>${trad('Enregistrer les coordonnées')}</button></div>
          ${modifiable ? '' : `<div class="ui-aide">${trad('Mise à jour indisponible : exécute')} <strong>migration-compte.sql</strong> ${trad('dans le SQL Editor de Supabase.')}</div>`}
        </div>
      </section>

      <section class="ui-section">
        ${tete('aideCercle', trad('Support'), trad('Une question, un blocage sur un manuel ou une machine ? Écris-nous : notre équipe te répond directement ici.'))}
        <div class="ui-section-corps">
          <div><button type="button" class="ui-btn ui-btn-plein" id="acc-support-ouvrir">${picto('message')}<span>${trad('Contacter le support')}</span></button></div>
          <div class="ui-aide">${trad('Données atelier sécurisées')}</div>
        </div>
      </section>
      </div>
      <div class="ui-colonne">

      <!-- ── ÉQUIPE ────────────────────────────────────────────────
           Qui peut quoi, et ce que l'écran a le droit de proposer. Les rôles et
           leurs droits sont EXACTEMENT ceux que le serveur applique
           (migration-roles-equipe.sql) : l'écran masque les actions interdites
           pour ne pas tenter l'utilisateur, mais c'est le SERVEUR qui refuse. -->
      <section class="ui-section" id="acc-equipe">
        ${tete('equipe', trad('Gestion de l\'équipe'), trad('Attribution des accès terrain et des autorisations d\'atelier.'), '<span class="ui-tag" id="acc-equipe-compte"></span>')}
        <div class="ui-section-corps">
          <div class="ui-aide" id="acc-equipe-msg" role="status" aria-live="polite"></div>
          <div id="acc-equipe-liste" class="ui-section-corps">${trad('Chargement de l\'équipe…')}</div>
          <div id="acc-equipe-creation" class="ui-section-corps"></div>
          <details id="acc-equipe-invitation-bloc" class="ui-groupe">
            <summary>${trad('Inviter par e-mail')}</summary>
            <p class="ui-aide">${trad('Pour quelqu\'un qui a une adresse : il reçoit un lien et crée son compte lui-même. Un membre d\'atelier n\'en a souvent pas — utilise plutôt « Ajouter un membre ».')}</p>
            <div id="acc-equipe-invitation" class="ui-section-corps"></div>
          </details>
        </div>
      </section>

      <section class="ui-section">
        ${tete('bouclier', trad('Données locales & Sécurité'), trad('Mode hors-ligne chantier et langue de l\'interface.'))}
        <div class="ui-section-corps">
          <div class="ui-groupe">
            <label class="check-row">
              <input type="checkbox" id="acc-hors-ligne" ${copieHorsLigneActive() ? 'checked' : ''}>
              ${trad('Garder une copie pour la consultation hors connexion')}
            </label>
            <div class="ui-aide">${trad('Sans cette copie, l\'application demandera le réseau à chaque ouverture. Sur un appareil partagé, mieux vaut la désactiver : elle n\'est jamais affichée sans ton accord explicite, mais elle reste lisible dans le stockage du navigateur.')}</div>
            <div class="ui-aide" id="acc-hors-ligne-msg" role="status" aria-live="polite"></div>
          </div>
          <div class="ui-groupe">
            <span class="ui-etiquette">${trad('Langue de l\'interface')}</span>
            ${basculeLangueHtml()}
          </div>
          ${dansApplication() ? `
          <div class="ui-groupe">
            <span class="ui-etiquette">${trad('Verrouillage et reconnexion')}</span>
            <p class="ui-aide" id="acc-bio-etat">${trad('Vérification de ce que ce téléphone sait faire…')}</p>
            <div id="acc-bio-corps"></div>
            <p class="ui-aide" id="acc-acces-etat"></p>
            <div id="acc-acces-corps"></div>
            <div class="ui-aide" id="acc-bio-msg" role="status" aria-live="polite"></div>
            <details class="bio-detail">
              <summary>${trad('Détail technique')}</summary>
              <p class="ui-aide" id="acc-bio-detail"></p>
            </details>
          </div>` : ''}
        </div>
      </section>


      <section class="ui-section">
        ${tete('alerte', trad('Zone sensible'), trad('Clôture d\'entreprise et suppression.'))}
        <div class="ui-section-corps">
          <div class="ui-encadre is-attention">
            ${picto('alerte')}
            <p><strong>${trad('Action irréversible')}</strong><br>${trad('La suppression du compte est définitive : machines, plans d\'entretien, entretiens, relevés, photos, carnets, catégories et rappels sont effacés.')}</p>
          </div>
          <div><button type="button" class="ui-btn ui-btn-pastille is-danger" id="acc-supprimer">${picto('corbeille')}<span>${trad('Supprimer mon compte')}</span></button></div>
          <div class="ui-aide" id="acc-supprimer-msg" role="status" aria-live="polite"></div>
        </div>
      </section>
      </div></div></div>`;
  },
  mount() {
    const root = document.getElementById('view-root');
    if (!root) return;

    root.querySelector('#account-upgrade')?.addEventListener('click', () => openUpgradeNotice(UI.companyId));
    wireReglagesRappelsEmail(root);
    wirePush(root);
  const basculeCopie = document.getElementById('acc-hors-ligne');
  if (basculeCopie) {
    basculeCopie.addEventListener('change', () => {
      reglerCopieHorsLigne(basculeCopie.checked);
      const msg = document.getElementById('acc-hors-ligne-msg');
      if (msg) {
        msg.textContent = basculeCopie.checked
          ? trad('Copie locale activée : elle sera refaite à la prochaine connexion.')
          : trad('Copie locale effacée de cet appareil.');
      }
    });
  }
    root.querySelector('#acc-portail')?.addEventListener('click', () => ouvrirPortailAbonnement());
    root.querySelector('#acc-support-ouvrir')?.addEventListener('click', () => openSupportModal());
    habillerSelect(root.querySelector('#acc-activity'), trad('Activité principale'));
    // ★ LE NAVIGATEUR NE DOIT PAS REMPLIR CES DEUX CHAMPS À LA PLACE DE L'UTILISATEUR. Chrome reconnaît « un champ
    //   e-mail + un champ mot de passe » comme un formulaire de connexion et y recopie l'identifiant enregistré : le
    //   « nouvel e-mail » apparaissait déjà rempli avec l'ADRESSE ACTUELLE d'un autre compte, à un clic d'un changement
    //   d'adresse involontaire. Un champ en lecture seule n'est jamais rempli automatiquement : on le libère dès
    //   que l'utilisateur le touche ou le sélectionne.
    ['#acc-email', '#acc-password'].forEach((sel) => {
      const champ = root.querySelector(sel);
      if (!champ) return;
      champ.readOnly = true;
      const liberer = () => { champ.readOnly = false; };
      champ.addEventListener('focus', liberer, { once: true });
      champ.addEventListener('pointerdown', liberer, { once: true });
    });
    habillerSelect(root.querySelector('#acc-pays'), trad('Pays'));
    habillerSelect(root.querySelector('#acc-devise'), trad('Devise'));
    brancherLibelleRegistre(root.querySelector('#acc-pays'), root.querySelector('#acc-reg-etiquette'));
    habillerSelect(root.querySelector('#acc-membre-role'), trad('Ce qu\'il peut faire dans l\'application'));
    habillerSelect(root.querySelector('#acc-invite-role'), trad('Droit d\'accès'));
    preparerCarteEquipe(root);

    // ── CE QUE CHAQUE RÔLE PEUT FAIRE, ET CE QU'ON EN DIT ────────────────────
    // Les droits sont ceux de `migration-roles-equipe.sql` : ce tableau n'est
    // qu'un REFLET. Si le serveur et lui divergent, c'est le serveur qui gagne —
    // et le message d'erreur affiché est le SIEN, jamais une phrase inventée ici.
    const ROLE_DROITS = {
      gerant: { libelle: 'Gérant', invite: true, change: true, retire: true, nouveauMotDePasse: true },
      mecanicien: { libelle: 'Droit de gestion', invite: false, change: false, retire: false },
      chauffeur: { libelle: 'Droit de saisie', invite: false, change: false, retire: false },
    };
    const monDroit = () => ROLE_DROITS[UI.role] || ROLE_DROITS.mecanicien;
    // Le rôle se lit dans `profiles` avec le reste du profil : s'il manque, on ne
    // suppose RIEN — on dit seulement ce qu'on sait faire.
    const peutGererEquipe = () => monDroit().invite === true;

    async function preparerCarteEquipe(racine) {
      const liste = racine.querySelector('#acc-equipe-liste');
      const zoneInvitation = racine.querySelector('#acc-equipe-invitation');
      const annonce = racine.querySelector('#acc-equipe-msg');
      if (!liste) return;
      const dire = (texte, estErreur) => {
        if (!annonce) return;
        annonce.textContent = texte;
        annonce.className = estErreur ? 'ui-aide is-late' : 'ui-aide';
      };

      // ★ L'ÉTAT SERVEUR EST RELU À CHAQUE OUVERTURE DE CETTE CARTE. Le rôle et
      //   l'offre peuvent avoir changé côté serveur — une mise à niveau, un
      //   changement de rôle par un autre gérant — et afficher un plafond ou un
      //   rôle PÉRIMÉS masque une action légitime. On ne fait donc pas confiance à
      //   l'état du démarrage : on relit ce qu'on s'apprête à afficher. Si la
      //   relecture échoue (hors connexion), on garde l'état connu — mieux que
      //   rien, et l'écran ne ment pas sur le reste.
      if (sb.auth && sb.auth.getUser) {
        try {
          const { data: sessionCourante } = await sb.auth.getUser();
          const moi = sessionCourante && sessionCourante.user ? sessionCourante.user.id : null;
          if (moi) {
            const { data: frais } = await sb.from('profiles').select('role, companies(plan)').eq('id', moi).single();
            if (frais) {
              if (frais.role) UI.role = frais.role;
              const societe = Array.isArray(frais.companies) ? frais.companies[0] : frais.companies;
              if (societe && societe.plan) UI.companyPlan = societe.plan;
            }
          }
        } catch (err) { /* hors connexion : on garde l'état du démarrage */ }
      }

  let membres = [];
      try {
        const { data, error } = await sb.rpc('membres_de_ma_societe');
        if (error) throw error;
        membres = Array.isArray(data) ? data : [];
        // Le compte de la pastille d'en-tête : le SEUL endroit où ce nombre est
        // calculé, repris tel quel de la même liste que le reste de la carte.
        const pastilleCompte = racine.querySelector('#acc-equipe-compte');
        if (pastilleCompte) pastilleCompte.textContent = tR('{n} opérateur(s)', { n: membres.length });
      } catch (err) {
        dire(tR('Impossible de charger l\'équipe : {erreur}', { erreur: String((err && err.message) || err) }), true);
        liste.innerHTML = '';
        return;
      }

      const nomAffiche = (m) => (m.email ? String(m.email).split('@')[0] : trad('Membre'));

      // ★ LA VUE DE L'ENSEMBLE DE L'ÉQUIPE EST RÉSERVÉE AU GÉRANT.
      //
      //   Demandé mot pour mot : « seul le gérant a cette vue de l'ensemble de son
      //   équipe ». Ce n'est PAS qu'une politesse d'écran : le serveur refuse
      //   désormais la liste à tout autre rôle (migration-gerant-membres.sql), et
      //   un écran qui appellerait quand même afficherait une ERREUR au milieu de
      //   la carte — une panne apparente, pour une interdiction voulue. On ne
      //   demande donc RIEN, et on écrit la raison : jamais un écran muet.
      //
      //   Ce garde est placé APRÈS la relecture du rôle (juste au-dessus) : c'est
      //   le rôle FRAIS qui décide, jamais celui du démarrage.
      if (!peutGererEquipe()) {
        if (zoneInvitation) {
          zoneInvitation.innerHTML = `<p class="ui-aide">${trad('L\'équipe, ses accès et ses invitations ne sont visibles que du gérant.')}</p>`;
        }
        // ⚠️ La zone de création est écrite PLUS BAS dans cette fonction : on la
        //    vide par le DOM, pas par une `const` déclarée après ce point — la
        //    lire ici jetterait (« Cannot access before initialization »).
        const zoneCreationInterdite = racine.querySelector('#acc-equipe-creation');
        if (zoneCreationInterdite) zoneCreationInterdite.innerHTML = '';
        const blocInvitation = racine.querySelector('#acc-equipe-invitation-bloc');
        if (blocInvitation) blocInvitation.hidden = true;
        // Ce que la personne PEUT faire, elle, reste dit : son propre droit.
        // ⚠️ ON NE LIT ICI NI `roleDe` NI `ceQuIlPeutFaire` : ces `const` sont
        //   déclarées PLUS BAS dans cette fonction, et les lire avant leur ligne
        //   jetait « Cannot access 'roleDe' before initialization ». `ROLE_DROITS`,
        //   lui, est déclaré avant la fonction — on s'en sert directement.
        const monLibelle = trad((ROLE_DROITS[UI.role] || {}).libelle || UI.role || '');
        const mesDroits = UI.role === 'gerant'
          ? trad('Tout, y compris l\'équipe et l\'abonnement')
          : (UI.role === 'mecanicien' ? trad('Le parc et les compteurs') : trad('Les compteurs'));
        liste.innerHTML = `<p class="ui-aide">${tR('Ton accès : {role}. {droits}', {
          role: esc(monLibelle),
          droits: esc(mesDroits),
        })}</p>`;
        return;
      }
      // Pas de classe de plus pour la liste ni pour chaque membre : les enfants
      // (`value`, `hint`, `modal-actions`) portent DÉJÀ la mise en forme de la
      // charte. Une classe sans style est refusée par `check-classes.mjs`, et à
      // juste titre : elle ne dit rien et vieillit toute seule.


      // ── LE PLAFOND EST DIT, ET IL COMPTE LES INVITATIONS EN ATTENTE ─────────
      //    Le serveur applique EXACTEMENT la même règle (déclencheur
      //    `profiles_plafond` + fonction Edge `creer-membre`) : l'écran ne fait
      //    que dire ce que le serveur refusera. Un écran qui masquerait le bouton
      //    ne prouverait rien ; un écran qui proposerait une création impossible
      //    ferait perdre du temps au gérant.
      const plafond = plafondUtilisateurs(UI.companyPlan || 'free');
      const placesRestantes = plafond == null ? null : Math.max(0, plafond - membres.length);
      // Les invitations en attente occupent une place : le décompte doit le dire,
      // sinon l'écran annonce de la place alors que le serveur refusera.
      const invitationsVivantes = membres.filter((m) => m.invitation_en_attente).length;
      const placesOccupees = membres.filter((m) => !m.invitation_en_attente).length + invitationsVivantes;
      if (placesRestantes !== null && placesRestantes <= 0) {
        dire(tR('Ton offre permet {plafond} utilisateur(s), et l\'équipe en occupe déjà {occupees}. Passe à une offre supérieure pour ajouter quelqu\'un.', { plafond, occupees: placesOccupees }));
      }

      // ── QUI FAIT QUOI, EN UNE LIGNE, ET SOUS QUEL NOM ON LE MONTRE ─────────
      //    Le gérant a demandé « qui fait quoi » : chaque membre porte donc, sous
      //    son rôle, ce que le rôle autorise. Ce sont les droits que le SERVEUR
      //    applique (`migration-roles-equipe.sql`), pas une promesse d'écran.
      //
      //    ⚠️ CES TABLES SONT DÉCLARÉES AVANT LA LISTE DE L'ÉQUIPE, qui les LIT
      //    juste en dessous : une `const` lue avant sa ligne jetterait
      //    (« Cannot access 'identiteDe' before initialization »), et l'équipe
      //    s'afficherait vide pour tout le monde.
      const ROLE_DESCRIPTIONS = {
        gerant: trad('Tout : le parc, les plans, l\'équipe et l\'abonnement.'),
        mecanicien: trad('Le parc et les entretiens : il ajoute, modifie et marque fait. Il ne gère pas l\'équipe.'),
        chauffeur: trad('Il consulte le parc, relève le compteur et prend la photo de sa machine. Il ne modifie rien d\'autre.'),
      };
      const roleDe = (role) => trad((ROLE_DROITS[role] || {}).libelle || role || '');
      const ceQuIlPeutFaire = (role) => ROLE_DESCRIPTIONS[role] || trad('Aucun droit connu : demande au gérant de vérifier son rôle.');
      // Ce qui s'affiche comme identité : le login court quand il existe,
      // l'adresse sinon. L'adresse TECHNIQUE n'est jamais montrée au gérant —
      // elle ne veut rien dire pour lui.
      const estMembreCree = (m) => !!m.login || /@membres\.keeva\.work$/i.test(String(m.email || ''));
      const identiteDe = (m) => m.login || (m.email ? String(m.email).split('@')[0] : trad('Membre'));

      // ── ★ L'ÉQUIPE, GROUPÉE PAR RÔLE : gérant → mécanicien → chauffeur ─────
      //
      //    Demandé mot pour mot : « séparer pour plus de clarté les membres de
      //    l'équipe ». Chaque groupe porte donc un EN-TÊTE, et sous chaque
      //    personne : son nom en titre, ses droits en une ligne, et — pour ceux
      //    qui ont un accès créé par le gérant — son login.
      //
      //    ⚠️ LE MOT DE PASSE N'EST PAS AFFICHÉ, ET C'EST UN CHOIX. La base n'en
      //    garde qu'une EMPREINTE : personne — pas même le gérant, pas même nous —
      //    ne peut le relire. Afficher un champ masqué ferait croire le contraire
      //    et ferait perdre du temps à tout le monde. On écrit donc la vérité
      //    (« non conservé ») et on propose le seul geste qui existe : en générer
      //    un nouveau, qui s'affiche alors UNE fois, dans la zone « Accès ».
      const LIBELLES = {
        gerant: trad('Gérant'),
        mecanicien: trad('Droit de gestion'),
        chauffeur: trad('Droit de saisie'),
        autre: trad('Autre'),
      };
      const ORDRE = ['gerant', 'mecanicien', 'chauffeur', 'autre'];
      const libelleDe = (role) => LIBELLES[role] || roleDe(role);
      // Le nom affiché : `prenom`/`nom` quand la base les porte, le login ou
      // l'adresse sinon. Les sièges créés AVANT la migration n'ont pas encore
      // leur prénom et leur nom : on ne les invente pas, on montre ce qu'on a.
      const morceauxDe = (m) => ({
        prenom: String(m.prenom || '').trim(),
        nom: String(m.nom || '').trim(),
      });
      const estInvitation = (m) => m.invitation_en_attente === true;
      const droitsResumes = (role) => {
        if (role === 'mecanicien') return trad('Le parc et les compteurs');
        if (role === 'chauffeur') return trad('Les compteurs');
        if (role === 'gerant') return trad('Tout, y compris l\'équipe et l\'abonnement');
        return trad('À confirmer');
      };
      const ligneMembre = (m) => {
        const { prenom, nom } = morceauxDe(m);
        // LE NOM DE FAMILLE EN MAJUSCULES — demandé, et appliqué ici AUSSI : la
        // valeur stockée l'est à la création, mais un siège plus ancien peut
        // encore porter un nom en minuscules. L'affichage ne le laisse pas passer.
        // ⚠️ LA LANGUE SE LIT DANS LE DOCUMENT, PAS DANS LA VARIABLE `LANGUE` :
        //   les harnais extraient `preparerCarteEquipe` seule et n'emportent pas
        //   cette variable. `documentElement.lang` est posé par `changerLangue()`,
        //   il vaut « fr » par défaut, et il ne dépend de rien.
        const langueCourante = (document.documentElement && document.documentElement.lang) || 'fr';
        const titre = [prenom, nom.toLocaleUpperCase(langueCourante === 'en' ? 'en' : 'fr')].filter(Boolean).join(' ')
          || nomAffiche(m);
        const role = m.role || '';
        const acces = estMembreCree(m) ? identiteDe(m) : String(m.email || trad('Invitation en attente'));
        const metier = String(m.metier || '').trim();
        const actions = peutGererEquipe() && !m.est_moi && role !== 'gerant' ? `
              <button type="button" class="ui-btn ui-btn-teinte" data-pw-reset="${esc(m.id)}">${trad('Générer un nouveau mot de passe')}</button>
              <button type="button" class="ui-btn ui-btn-teinte" data-equipe-role="${esc(m.id)}" data-role-actuel="${esc(role)}">${trad('Changer le droit')}</button>
              <button type="button" class="ui-btn ui-btn-teinte" data-equipe-retirer="${esc(m.id)}">${trad('Retirer')}</button>` : '';
        // Personne n'a de bouton sur SA PROPRE ligne : on ne se rétrograde pas
        // soi-même, et le retrait de son propre compte est un autre sujet.
        const motDePasse = peutGererEquipe() && !m.est_moi && role !== 'gerant' ? `<span class="ui-ligne-sous">${trad('Mot de passe : non conservé — il n\'est affiché qu\'une fois, à sa création.')}</span>` : '';
        // Une couleur par rôle, reprise des teintes déjà en usage ailleurs sur
        // cet écran (encre pour le gérant, indigo pour le mécanicien, teal pour
        // le chauffeur) — aucune couleur nouvelle.
        const teinteRole = role === 'gerant' ? 'gerant' : (role === 'chauffeur' ? 'chauffeur' : 'mecanicien');
        return `
            <div class="ui-ligne is-texte-long" data-membre="${esc(m.id)}">
              <div class="ui-ligne-id">
                <div class="ui-ligne-icone is-initiales is-${teinteRole}" aria-hidden="true">${esc(initialsFrom(titre))}</div>
                <div class="ui-ligne-textes">
                  <span class="ui-ligne-nom">${esc(titre)}</span>
                  <span class="ui-ligne-sous">${trad('Ce qu\'il a le droit de faire :')} ${esc(droitsResumes(role))}</span>
                  <span class="ui-ligne-sous">${trad('Login :')} ${esc(acces)}</span>
                  ${metier ? `<span class="ui-ligne-sous">${trad('Métier :')} ${esc(metier)}</span>` : ''}
                  ${estInvitation(m) ? `<span class="ui-ligne-sous">${trad('Invitation en attente : cette personne n\'a pas encore créé son compte.')}</span>` : ''}
                  ${motDePasse}
                </div>
              </div>
              <div class="ui-ligne-info">
                ${m.est_moi ? `<span class="ui-tag">${trad('Toi')}</span>` : ''}
                ${role ? `<span class="ui-tag">${esc(roleDe(role))}</span>` : ''}
              </div>
              <div class="ui-ligne-action is-etiquettes">${actions}</div>
            </div>`;
      };
      const sections = ORDRE
        .map((role) => {
          const duGroupe = membres.filter((m) => (m.role || 'autre') === role);
          if (!duGroupe.length) return '';
          const titre = role === 'autre'
            ? tR('Autre rôle ({n})', { n: duGroupe.length })
            : tR('{role} ({n})', { role: libelleDe(role), n: duGroupe.length });
          return `
        <div class="ui-champ-groupe" data-groupe="${esc(role)}">
          <span class="ui-etiquette">${esc(titre)}</span>
          <div class="ui-liste">${duGroupe.map(ligneMembre).join('')}</div>
        </div>`;
        })
        .join('');
      liste.innerHTML = sections || `<p class="ui-aide">${trad('Personne pour l\'instant : ajoute un membre ci-dessous, ou invite-le par e-mail.')}</p>`;

      // ★ LES BOUTONS SONT ÉCOUTÉS SUR LEUR ZONE, JAMAIS UN PAR UN.
      //
      //   LE DÉFAUT QUE CELA CORRIGE, ET QUI ÉTAIT RÉEL. La liste des membres est
      //   réécrite EN ENTIER (`liste.innerHTML = …`) à chaque relecture, et une
      //   relecture suit chaque création, chaque changement de rôle, chaque
      //   retrait. Les boutons étaient câblés un par un, juste après la relecture
      //   qui les avait fabriqués : les boutons nés d'une relecture ULTÉRIEURE
      //   n'avaient donc AUCUN écouteur —
      //
      //     · « Générer un nouveau mot de passe » ne faisait plus rien ;
      //     · le second clic sur « Créer le membre » ne rappelait plus le serveur
      //       (le bouton avait été remplacé, avec son écouteur).
      //
      //   Un écouteur posé sur la ZONE survit à toutes les réécritures de son
      //   contenu : le clic remonte du bouton vers la zone, qui regarde ce qui a
      //   été touché. On ne câble donc plus des boutons, mais les trois zones que
      //   la carte ne remplace pas (elles sont écrites une seule fois).
      const boutonTouche = (evenement, selecteur) => {
        const cible = evenement && evenement.target;
        if (!cible || typeof cible.closest !== 'function') return null;
        const bouton = cible.closest(selecteur);
        return bouton && racine.contains(bouton) ? bouton : null;
      };
      // `type` vaut « click » par défaut. Le formulaire en a besoin d'un autre :
      // « change », pour le choix « Autre » qui dévoile ses deux options. On
      // RETIRE le type qu'on avait posé, pas « click » en dur — sinon un écouteur
      // « change » resterait accroché à une zone réécrite, à chaque relecture.
      const cabler = (zone, cle, selecteur, action, type = 'click') => {
        if (!zone) return;
        const ancien = racine[cle];
        if (ancien && ancien.gestionnaire) ancien.zone.removeEventListener(ancien.type || 'click', ancien.gestionnaire);
        const gestionnaire = (evenement) => {
          const bouton = boutonTouche(evenement, selecteur);
          // APPEL PROTÉGÉ : un écouteur qui survit ne doit jamais jeter — une
          // exception ici emporterait tout le câblage qui suit.
          if (bouton) action?.(bouton, evenement);
        };
        zone.addEventListener(type, gestionnaire);
        racine[cle] = { zone, gestionnaire, type };
      };
      // ⚠️ LE SÉLECTEUR EST « button », ET RIEN DE PLUS. Un sélecteur de
      //   DESCENDANCE (« [data-membre] button ») désignerait la même chose dans un
      //   navigateur, mais le DOM simulé des tests ne remonte la chaîne que
      //   lorsque les éléments sont DIRECTEMENT imbriqués : avec la `div`
      //   `modal-actions` interposée par le gabarit, le bouton n'était pas
      //   reconnu, et le clic ne faisait rien — un défaut du harnais, pas de la
      //   page, mais qui masquait le vrai. Ce sont les attributs `data-…` du
      //   bouton lui-même qui disent lequel des trois gestes a été touché.
      // La garde de rôle est relue À CHAQUE CLIC : un écouteur survivant ne doit
      // jamais laisser passer une action que l'écran vient de retirer.
      cabler(liste, '_equipeListeCablee', 'button', (bouton) => {
        if (!peutGererEquipe()) return;
        if (bouton.hasAttribute('data-pw-reset')) relancerLeMotDePasse.call(bouton);
        else if (bouton.hasAttribute('data-equipe-role')) changerLeRole.call(bouton);
        else if (bouton.hasAttribute('data-equipe-retirer')) retirerLeMembre.call(bouton);
      });

      // ── LA CRÉATION DIRECTE, EN PREMIER ───────────────────────────────────
      //    Un mécanicien d'atelier n'a pas d'e-mail : l'invitation par lien est
      //    un fonctionnement de bureau. Le gérant remplit donc un prénom, un nom
      //    et un rôle, et le SERVEUR fabrique le login et le mot de passe.
      //    Aucun identifiant n'est demandé au gérant : il en inventerait un avec
      //    un accent, ou en double.
      //
      //    Le formulaire n'est écrit QUE pour un gérant, et l'écouteur qui suit
      //    est PROTÉGÉ (`?.`) : `verifier-ecouteurs-orphelins.mjs` refuse un
      //    écouteur nu sur un élément rendu conditionnellement, et il a raison —
      //    l'écran d'un mécanicien doit rester câblé de bout en bout.
      const zoneCreation = racine.querySelector('#acc-equipe-creation');
      if (zoneCreation) {
        zoneCreation.innerHTML = peutGererEquipe() ? `
          <div class="ui-groupe">
            <div class="ui-groupe-tete">
              ${picto('ajoutPersonne')}
              <span class="ui-groupe-titre">${trad('Ajouter un membre direct')}</span>
              <span class="ui-tag">${trad('Identifiant auto')}</span>
            </div>
            <p class="ui-aide">${trad('Pour un membre de l\'équipe qui n\'a pas d\'e-mail : indique son prénom et son nom, le serveur crée son accès et te donne son login et son mot de passe.')}</p>
            <div class="ui-grille">
              <div class="ui-champ-groupe">
                <label class="ui-etiquette" for="acc-membre-prenom">${trad('Prénom')}</label>
                <input id="acc-membre-prenom" class="ui-champ" autocomplete="off" placeholder="${trad('Jean')}">
              </div>
              <div class="ui-champ-groupe">
                <label class="ui-etiquette" for="acc-membre-nom">${trad('Nom')}</label>
                <input id="acc-membre-nom" class="ui-champ majuscules" autocapitalize="characters" autocomplete="off" placeholder="${trad('DUPONT')}">
              </div>
            </div>
            <div class="ui-aide">${trad('Le nom de famille est écrit en MAJUSCULES sur la fiche. Le login, lui, reste en minuscules : c\'est un identifiant.')}</div>
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="acc-membre-metier">${trad('Métier (facultatif)')}</label>
              <input id="acc-membre-metier" class="ui-champ" autocomplete="off" placeholder="${trad('Chef d\'atelier, soudeur, comptable…')}">
              <span class="ui-aide">${trad('Le métier est un libellé libre : il s\'affiche sur la fiche, et il ne change AUCUN droit.')}</span>
            </div>
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="acc-membre-role">${trad('Ce qu\'il peut faire dans l\'application')}</label>
              <select id="acc-membre-role" class="ui-selecteur is-plein" data-equipe-role-select>
                <option value="mecanicien">${trad('Droit de gestion')}</option>
                <option value="chauffeur">${trad('Droit de saisie')}</option>
              </select>
            </div>
            <div class="ui-aide">${trad('Droit de gestion : tient le parc et les entretiens. Droit de saisie : consulte le parc, relève le compteur et prend la photo de sa machine. Ni l\'un ni l\'autre ne gère l\'équipe.')}</div>
            <div><button type="button" class="ui-btn ui-btn-plein" id="acc-membre-creer">${trad('Créer le membre')}</button></div>
          </div>
          <div id="acc-membre-acces"></div>` : '';
      }

      if (!peutGererEquipe()) {
        // Le rôle et l'offre ont été relus juste avant : on ne dit donc la raison
        // que si elle est vraie. Le refus, lui, viendra du serveur de toute façon.
        //
        // ⚠️ LA RAISON DE L'INTERDICTION EST ÉCRITE, pas seulement le bouton
        // masqué : « Seul le gérant… ». Un écran muet laisse croire à une panne.
        // ?. : la carte de l'équipe existait avant ce correctif (un DOM simulé
        // peut ne pas porter la zone de création) ; un écran sans cette zone doit
        // rester câblé de bout en bout, pas jeter.
        if (zoneCreation) zoneCreation.innerHTML = '';
        zoneInvitation.innerHTML = `<p class="ui-aide">${trad('Seul le gérant peut inviter quelqu\'un, changer un rôle ou retirer un membre.')}</p>`;
        return;
      }

      zoneInvitation.innerHTML = `
        <div class="ui-champ-groupe">
          <span class="ui-etiquette">${trad('Inviter quelqu\'un par e-mail')}</span>
          <p class="ui-aide">${trad('Pour un chef d\'équipe, un comptable ou quelqu\'un qui a une adresse : la personne reçoit un lien et crée son compte elle-même.')}</p>
          ${placesRestantes === 0 ? `<p class="ui-aide">${tR('Ton offre permet {plafond} utilisateur(s), et l\'équipe les occupe déjà. Passe à une offre supérieure pour inviter.', { plafond }) }</p>` : ''}
        </div>
        <div class="ui-grille">
          <div class="ui-champ-groupe">
            <label class="ui-etiquette" for="acc-invite-email">${trad('E-mail de la personne')}</label>
            <input id="acc-invite-email" class="ui-champ" type="email" autocomplete="off">
          </div>
          <div class="ui-champ-groupe">
            <label class="ui-etiquette" for="acc-invite-role">${trad('Droit d\'accès')}</label>
            <select id="acc-invite-role" class="ui-selecteur is-plein">
              <option value="mecanicien">${trad('Droit de gestion')}</option>
              <option value="chauffeur">${trad('Droit de saisie')}</option>
            </select>
          </div>
        </div>
        <div><button type="button" class="ui-btn ui-btn-pastille" id="acc-invite-envoyer">${trad('Créer l\'invitation')}</button></div>
        <div id="acc-invite-resultat"></div>`;

      // ── CRÉER LE MEMBRE : c'est le SERVEUR qui fabrique le login ───────────
      //    L'écran n'envoie que le prénom, le nom et le rôle. Le login et le mot
      //    de passe reviennent UNE SEULE FOIS : ils ne sont ni stockés, ni
      //    relisibles ensuite. La liste est ensuite RELUE DEPUIS LE SERVEUR —
      //    jamais recomposée à la main à partir de ce qu'on croit avoir créé.
      async function creerLeMembre() {
        const prenom = (racine.querySelector('#acc-membre-prenom')?.value || '').trim();
        // LE NOM DE FAMILLE PART EN MAJUSCULES. Le champ les affiche déjà
        // (`class="majuscules"`), mais une valeur COLLÉE dans le champ ne passe
        // par aucune frappe : la normalisation se fait donc ici, à l'envoi, comme
        // pour la marque et le modèle d'une machine. Le serveur, lui, la refait —
        // c'est lui qui a le dernier mot.
        const nom = (racine.querySelector('#acc-membre-nom')?.value || '').trim().toUpperCase();
        const metier = (racine.querySelector('#acc-membre-metier')?.value || '').trim();
        // ★ LES DROITS, ET EUX SEULS, DÉCIDENT DU RÔLE ENREGISTRÉ. L'application
        //   n'a que DEUX niveaux de droits (`mecanicien`, `chauffeur`) : le choix
        //   « Autre » n'invente donc pas un troisième rôle — il demande lequel des
        //   deux, en clair, et c'est celui-là qui part. Le MÉTIER, lui, est un
        //   libellé noté à part, qui ne change rien aux droits.
        const choix = racine.querySelector('#acc-membre-role')?.value || 'mecanicien';
        const droitsAutre = racine.querySelector('input[name="acc-membre-droits"]:checked');
        const role = choix === 'autre'
          ? ((droitsAutre && droitsAutre.value) || 'mecanicien')
          : choix;
        // La zone des identifiants est HORS du formulaire de création : la relecture
        // de la carte ne l'efface donc pas, et le mot de passe — qui n'existe
        // qu'à cet instant — reste lisible par le gérant.
        const zone = racine.querySelector('#acc-membre-acces');
        dire('');
        if (!prenom || !nom) { dire(trad('Indique le prénom ET le nom.'), true); return; }
        if (zone) zone.innerHTML = `<p class="ui-aide">${trad('Création du compte…')}</p>`;
        try {
          const { data, error } = await sb.functions.invoke('creer-membre', {
            method: 'POST',
            body: { prenom, nom, metier, role },
          });
          if (error) throw new Error(await functionErrorMessage(error, trad('création impossible')));
          if (!data || data.ok !== true) throw new Error((data && data.error) || trad('création impossible'));
          // ⚠️ L'ORDRE COMPTE : la carte est RELUE d'abord (la liste doit montrer le
          // nouveau membre), et les identifiants s'affichent ENSUITE dans la zone
          // FRAÎCHE. Les afficher avant la relecture ne servait à rien : la
          // relecture réécrit le formulaire, donc le noeud qui portait le mot de
          // passe était détaché — le gérant ne voyait RIEN, et le mot de passe
          // était perdu (c'est le seul moment où il existe).
          dire(trad('Membre créé.'));
          await preparerCarteEquipe(racine);
          afficherIdentifiants(
            racine.querySelector('#acc-membre-acces'),
            data,
            tR('Accès de {nom}', { nom: prenom + ' ' + nom }),
          );
        } catch (err) {
          // Le refus du SERVEUR est affiché tel quel : plafond atteint, rôle
          // refusé, session expirée. On ne le réécrit pas.
          if (zone) zone.innerHTML = '';
          dire(String((err && err.message) || err), true);
        }
      }

      // ── GÉNÉRER UN NOUVEAU MOT DE PASSE ───────────────────────────────────
      //    Indispensable : un mécanicien n'a pas d'e-mail, donc pas de « mot de
      //    passe oublié ». Le gérant lit le nouveau mot de passe à la personne,
      //    devant l'atelier : il doit donc l'avoir SOUS LES YEUX.
      //
      //    ⚠️ L'ORDRE COMPTE, ET C'EST LE MÊME DÉFAUT QUE POUR LA CRÉATION. La
      //    liste des membres est réécrite EN ENTIER à chaque relecture : écrire
      //    le mot de passe dans une ligne AVANT `preparerCarteEquipe` le faisait
      //    disparaître avec la ligne remplacée — le gérant ne voyait rien, alors
      //    que le mot de passe venait d'être changé et n'existe plus nulle part.
      //    Un gérant qui ne l'a pas lu doit donc en régénérer un autre, sans
      //    jamais savoir pourquoi. On relit D'ABORD, on affiche ENSUITE — dans la
      //    zone des identifiants, qui est HORS de la liste et survit à la
      //    relecture. La ligne du membre garde, elle, un rappel visible pour que
      //    le gérant sache OÙ le mot de passe a été régénéré.
      async function relancerLeMotDePasse() {
        const bouton = this;
        const membre = bouton.getAttribute('data-pw-reset');
        const ligne = bouton.closest('[data-membre]');
        dire('');
        if (ligne) ligne.innerHTML = `<p class="ui-aide">${trad('Nouveau mot de passe…')}</p>`;
        try {
          const { data, error } = await sb.functions.invoke('creer-membre', {
            method: 'POST',
            body: { mode: 'reinitialiser', membre },
          });
          if (error) throw new Error(await functionErrorMessage(error, trad('réinitialisation impossible')));
          if (!data || data.ok !== true) throw new Error((data && data.error) || trad('réinitialisation impossible'));
          await preparerCarteEquipe(racine);
          // ★ ON PARLE APRÈS LA RELECTURE, ET PAS AVANT. `preparerCarteEquipe`
          //   annonce lui-même le plafond atteint, et ce message ÉCRASE celui
          //   qu'on venait de poser : le gérant lisait « ton offre est pleine »
          //   au lieu de « nouveau mot de passe généré ». C'est la même règle que
          //   pour l'affichage — relire d'abord, parler ensuite.
          dire(trad('Nouveau mot de passe généré.'));
          // La zone des identifiants est RELUE après le re-rendu (le noeud d'avant
          // a pu être remplacé) : on écrit donc dans le noeud VIVANT.
          const zone = racine.querySelector('#acc-membre-acces');
          if (zone) {
            afficherIdentifiants(zone, data, tR('Nouveau mot de passe de {login}', { login: data.login || '' }));
          }
          // Le rappel, DANS la ligne du membre : le gérant voit tout de suite de
          // qui l'on parle. Il ne contient PAS le mot de passe — celui-ci n'est
          // écrit qu'une fois, dans la zone ci-dessus.
          const ligneVive = racine.querySelector(`[data-membre="${membre}"]`);
          if (ligneVive) {
            ligneVive.innerHTML = `<p class="ui-aide">${tR('Nouveau mot de passe généré pour {login} : il est affiché dans « Accès » ci-dessus.', { login: esc(identiteDe({ login: data.login })) })}</p>`;
          }
        } catch (err) {
          await preparerCarteEquipe(racine);
          // Même raison que ci-dessus : le refus du SERVEUR est dit APRÈS la
          // relecture, sinon il serait recouvert par le message du plafond.
          dire(String((err && err.message) || err), true);
        }
      }

      // ── LES IDENTIFIANTS, EN GROS, UNE SEULE FOIS ──────────────────────────
      //    Le mot de passe est dans un champ de mot de passe : il ne s'affiche
      //    pas à l'épaule de quelqu'un qui passe, et le bouton « Afficher » (déjà
      //    posé pour toute la page sur `.toggle-pw-btn`) le montre au gérant au
      //    moment où il le lit. Le bouton de copie est LÀ AUSSI : c'est le geste
      //    réel — on colle l'identifiant dans un message ou un carnet.
      function identifiantsMembre(data, titre) {
        const login = String((data && data.login) || '');
        const motDePasse = String((data && data.mot_de_passe) || '');
        const texte = tR('KALEA — {titre}\nLogin : {login}\nMot de passe : {motDePasse}\nConnexion : https://kalea.pro', {
          titre: titre || trad('Accès'),
          login,
          motDePasse,
        });
        return `
          <div class="ui-groupe">
            <span class="ui-etiquette">${esc(titre || trad('Accès'))}</span>
            <div class="ui-champ-groupe">
              <span class="ui-aide">${trad('Identifiant de connexion')}</span>
              <div class="ui-valeur">${esc(login)}</div>
            </div>
            <div class="ui-champ-groupe">
              <span class="ui-aide">${trad('Mot de passe')}</span>
              <div class="password-wrap">
                <input class="ui-champ" type="password" value="${esc(motDePasse)}" readonly aria-label="${trad('Mot de passe')}">
                <button type="button" class="toggle-pw-btn" aria-pressed="false">${trad('Afficher')}</button>
              </div>
            </div>
            <p class="ui-aide">${trad('Note-les maintenant : le mot de passe ne sera plus affiché. Tu peux en générer un nouveau à tout moment.')}</p>
            <div><button type="button" class="ui-btn ui-btn-pastille" data-copier-access="${esc(texte)}">${trad('Copier le login et le mot de passe')}</button></div>
          </div>`;
      }

      function afficherIdentifiants(zone, data, titre) {
        if (!zone) return;
        zone.innerHTML = identifiantsMembre(data, titre);
      }

      // ── L'INVITATION PAR E-MAIL reste, en second ──────────────────────────
      async function creerLInvitation() {
        const email = (racine.querySelector('#acc-invite-email')?.value || '').trim();
        const role = racine.querySelector('#acc-invite-role')?.value || 'mecanicien';
        const resultat = racine.querySelector('#acc-invite-resultat');
        dire('');
        if (resultat) resultat.innerHTML = `<p class="ui-aide">${trad('Création de l\'invitation…')}</p>`;
        try {
          const { data, error } = await sb.rpc('inviter_membre', { p_email: email, p_role: role });
          if (error) throw error;
          const ligne = Array.isArray(data) ? data[0] : data;
          const code = ligne && ligne.code ? ligne.code : '';
          const lien = lienInvitation(code);
          const sujet = tR('Invitation à rejoindre {societe} sur KALEA', { societe: UI.company?.name || UI.companyName || '' });
          if (resultat) {
            resultat.innerHTML = `
              <div class="ui-champ-groupe">
                <span class="ui-etiquette">${trad('Lien à transmettre')}</span>
                <div class="ui-valeur" id="acc-invite-lien" style="word-break:break-all;font-size:13px;">${esc(lien)}</div>
                <p class="ui-aide">${tR('Valable jusqu\'au {date}. La personne crée son compte en le conservant : elle rejoindra la société automatiquement.', { date: esc(String((ligne && ligne.expire_le) || '').slice(0, 10)) })}</p>
              </div>
              <div><a class="ui-btn ui-btn-pastille" id="acc-invite-mailto" href="mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corpsInvitation(lien))}" style="text-decoration:none;">${trad('Envoyer l\'invitation par e-mail')}</a></div>`;
          }
          dire(trad('Invitation créée.'));
        } catch (err) {
          // Le refus du SERVEUR est affiché tel quel : plafond atteint, adresse
          // déjà membre, rôle inconnu. On ne le réécrit pas.
          if (resultat) resultat.innerHTML = '';
          dire(String((err && err.message) || err), true);
        }
      }

      // Changer un rôle : on demande le nouveau rôle, on appelle le serveur, on redit la liste.
      async function changerLeRole() {
        const bouton = this;
        const profil = bouton.getAttribute('data-equipe-role');
        const actuel = bouton.getAttribute('data-role-actuel');
        const nouveau = actuel === 'mecanicien' ? 'chauffeur' : 'mecanicien';
        dire(trad('Enregistrement…'));
        try {
          const { error } = await sb.rpc('changer_role_membre', { p_profil: profil, p_role: nouveau });
          if (error) throw error;
          dire(trad('Droit modifié.'));
          await preparerCarteEquipe(racine);
        } catch (err) { dire(String((err && err.message) || err), true); }
      }

      // Retirer : DEUX confirmations, comme la suppression d'une machine — et on
      // dit ce qui va se passer, pas seulement « êtes-vous sûr ».
      async function retirerLeMembre() {
        const bouton = this;
        const profil = bouton.getAttribute('data-equipe-retirer');
        if (!window.confirm(trad('Retirer cette personne de la société ? Elle perd l\'accès au parc, mais garde son compte et son mot de passe.'))) return;
        dire(trad('Retrait…'));
        try {
          const { error } = await sb.rpc('retirer_membre', { p_profil: profil });
          if (error) throw error;
          dire(trad('Personne retirée de la société.'));
          await preparerCarteEquipe(racine);
        } catch (err) { dire(String((err && err.message) || err), true); }
      }

      // ── LE CÂBLAGE, À LA FIN, SUR LES ÉLÉMENTS QUI VIENNENT D'ÊTRE ÉCRITS ──
      //    Le formulaire de création n'existe QUE pour un gérant (garde ci-dessus
      //    avec retour) : son écouteur est donc PROTÉGÉ. Les autres boutons
      //    existent à cette ligne, dans le même gabarit que leurs données.
      // Le formulaire est réécrit à chaque relecture : on écoute donc sa ZONE, pas
      // le bouton. `cabler` sort sans rien faire si la zone est absente : elle
      // n'existe QUE pour un gérant (garde ci-dessus, avec retour), et
      // `verifier-ecouteurs-orphelins` refuse un écouteur nu sur un élément rendu
      // conditionnellement.
      cabler(zoneCreation, '_equipeCreationCablee', '#acc-membre-creer', () => {
        if (peutGererEquipe()) creerLeMembre();
      });
      // ★ LE CHOIX « AUTRE » MONTRE SES DEUX OPTIONS, ET RIEN D'AUTRE. Le
      //   formulaire est réécrit à chaque relecture : on écoute donc la ZONE (le
      //   `change` remonte du `select` vers elle), jamais le `select` lui-même —
      //   c'est la même règle que pour les boutons de la liste.
      cabler(zoneCreation, '_equipeCreationCableeChange', '#acc-membre-role', () => {
        const choix = racine.querySelector('#acc-membre-role');
        const blocAutre = racine.querySelector('#acc-membre-droits-autre');
        if (!choix || !blocAutre) return;
        blocAutre.hidden = choix.value !== 'autre';
      }, 'change');
      // L'invitation par e-mail : la zone est réécrite à chaque relecture, et
      // vidée pour un non-gérant — même traitement.
      cabler(zoneInvitation, '_equipeInvitationCablee', '#acc-invite-envoyer', () => {
        if (peutGererEquipe()) creerLInvitation();
      });
    }

    // Les plafonds d'utilisateurs de la grille : 1 / 1 / 3 / illimité. Ce n'est
    // qu'un AFFICHAGE : le serveur applique la même règle par déclencheur
    // (`verifier_plafond_utilisateurs`), et c'est lui qui a le dernier mot.
    function plafondUtilisateurs(plan) {
      if (plan === 'business' || plan === 'pro' || plan === 'paid') return 3;
      if (plan === 'enterprise' || plan === 'unlimited') return null;
      return 1;
    }

    // L'adresse d'invitation : celle que l'invité ouvre. Le chemin servi de
    // l'application est `app.html` (voir signal/README.md) ; en local, le fichier
    // s'appelle index.html — on prend le nom réellement servi.
    function lienInvitation(code) {
      // ⚠️ LE REPLI NE SUPPOSE PLUS « index.html ». L'adresse servie est
      //   `app.html` (voir signal/README.md) : annoncer « index.html » à un gérant
      //   qui copie le lien lui ferait envoyer une adresse qui n'existe pas sur le
      //   site publié. Le nom réellement servi reste prioritaire ; à défaut de
      //   pouvoir le lire, on retombe sur `app.html`.
      const chemin = (location && location.pathname) || '';
      const fichier = /app\.html$/.test(chemin) ? 'app.html' : (/(^|\/)index\.html$/.test(chemin) ? 'index.html' : 'app.html');
      return new URL(fichier + '?invitation=' + encodeURIComponent(code), location.href).href;
    }

    // Ce que dit l'e-mail : le lien, et quoi en faire. Rien d'autre — pas de
    // promesse, pas de délai inventé.
    function corpsInvitation(lien) {
      return [
        trad('Bonjour,'),
        '',
        trad('Voici le lien pour rejoindre notre société sur KALEA :'),
        lien,
        '',
        trad('Ouvre-le : si tu n\'as pas encore de compte, tu peux le créer — le lien est conservé.'),
      ].join('\n');
    }

    wireChampTelephone(root, 'acc-phone');

    // Connexion sans mot de passe : la carte n'existe que dans l'application
    // native, et son contenu (ce que le téléphone annonce) demande une
    // vérification asynchrone du greffon. Elle se remplit donc après l'affichage.
    preparerCarteBiometrie(root);

    // Verrouillage et reconnexion : la carte n'existe que dans l'application
    // native, et son contenu (ce que le téléphone accepte) demande une
    // vérification asynchrone du greffon. Elle se remplit donc après l'affichage.
    preparerCarteBiometrie(root);

    const message = (el, texte, erreur) => {
      if (!el) return;
      el.textContent = texte;
      el.style.color = erreur ? 'var(--late)' : 'var(--ok)';
    };

    // Les informations de la société se modifient ici. La fonction SQL ne touche
    // QUE les champs envoyés (NULL = ne pas toucher, chaîne vide = effacer) :
    // cet appel n'efface donc ni le téléphone ni le contact.
    root.querySelector('#acc-save-societe')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const msg = root.querySelector('#acc-societe-msg');
      const nom = root.querySelector('#acc-name').value.trim();
      const activite = root.querySelector('#acc-activity').value;
      const rcs = root.querySelector('#acc-reg').value.trim();
      btn.disabled = true;
      btn.textContent = trad('Enregistrement…');
      try {
        if (!nom) throw new Error(trad('Le nom de la société ne peut pas être vide.'));
        const { error } = await sb.rpc('update_my_company', {
          p_name: nom,
          p_activity: activite || '',
          p_registration_number: rcs || '',
        });
        if (error) throw error;
        const pays = root.querySelector('#acc-pays')?.value;
        if (pays && SCHEMA.hasCountry) {
          const { error: errPays } = await sb.rpc('update_my_country', { p_country: pays });
          if (errPays) throw errPays;
          UI.company.country = pays;
        }

        UI.company.name = nom;
        UI.company.activity = activite || null;
        UI.company.registrationNumber = rcs || null;
        UI.companyName = nom;
        showToast(trad('Société mise à jour'));
        renderApp();
      } catch (err) {
        message(msg, trad('Erreur :') + ' ' + (err.message || err), true);
        btn.disabled = false;
        btn.textContent = trad('Enregistrer');
      }
    });

    // La devise a SON bouton, jamais celui du pays : la changer convertit tous les montants (voir convert_my_tco_currency).
    const selectDevise = root.querySelector('#acc-devise');
    if (selectDevise) {
      const blocDevise = root.querySelector('#acc-devise-bloc');
      const boutonDevise = root.querySelector('#acc-devise-appliquer');
      const deviseActuelle = () => (UI.company && UI.company.currency) || 'EUR';
      const majBlocDevise = () => { if (blocDevise) blocDevise.hidden = selectDevise.value === deviseActuelle(); };
      selectDevise.addEventListener('change', majBlocDevise);
      majBlocDevise();
      boutonDevise?.addEventListener('click', async () => {
        const msg = root.querySelector('#acc-societe-msg');
        const nouvelle = selectDevise.value;
        const ok = window.confirm(tR(
          'Passer de {ancienne} à {nouvelle} va convertir TOUS les montants TCO déjà enregistrés (taux horaire, assurance, stockage, seuils par catégorie, prix d\'achat et revente des machines, catalogue de pièces, interventions et coûts d\'exploitation) au taux fixe 1 EUR = 119,3317 XPF. Continuer ?',
          { ancienne: deviseActuelle(), nouvelle }
        ));
        if (!ok) return;
        boutonDevise.disabled = true;
        boutonDevise.textContent = trad('Conversion…');
        try {
          const { error } = await sb.rpc('convert_my_tco_currency', { p_new_currency: nouvelle });
          if (error) throw error;
          // Toutes les tables viennent de changer côté serveur : seul un rechargement complet remet tout en cohérence.
          showToast(trad('Devise et montants convertis — rechargement…'));
          setTimeout(() => window.location.reload(), 900);
        } catch (err) {
          message(msg, trad('Erreur :') + ' ' + (err.message || err), true);
          boutonDevise.disabled = false;
          boutonDevise.textContent = trad('Convertir les montants');
        }
      });
    }

    root.querySelector('#acc-save-contact')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const msg = root.querySelector('#acc-contact-msg');
      const prenom = root.querySelector('#acc-first').value.trim();
      const nom = root.querySelector('#acc-last').value.trim();
      const telSaisi = lireChampTelephone(root, 'acc-phone');
      const telephone = telSaisi ? telSaisi.e164 : '';
      btn.disabled = true;
      btn.textContent = trad('Enregistrement…');
      try {
        // Passe par une fonction dédiée plutôt que par un UPDATE direct : une
        // politique RLS de mise à jour sur companies laisserait aussi modifier
        // la colonne « plan », donc contourner la limite du plan gratuit.
        const { error } = await sb.rpc('update_my_company', {
          p_phone: telephone || null,
          p_contact_first_name: prenom || null,
          p_contact_last_name: nom || null,
        });
        if (error) throw error;

        enregistrerNomDuProfil(contactFullName(prenom, nom, ''));
        UI.company.phone = telephone;
        UI.company.contact_first_name = prenom || null;
        UI.company.contact_last_name = nom || null;
        UI.contactFirstName = prenom;
        UI.contactName = contactFullName(prenom, nom, UI.contactName);
        showToast(trad('Coordonnées enregistrées'));
        renderApp();
      } catch (err) {
        message(msg, trad('Erreur :') + ' ' + (err.message || err), true);
        btn.disabled = false;
        btn.textContent = trad('Enregistrer');
      }
    });

    root.querySelector('#acc-save-email')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const msg = root.querySelector('#acc-email-msg');
      const champEmail = root.querySelector('#acc-email');
      const champMotDePasse = root.querySelector('#acc-password');
      const nouvelEmail = champEmail.value.trim();
      const motDePasse = champMotDePasse.value;

      if (!emailValide(nouvelEmail)) {
        message(msg, 'Adresse email invalide.', true);
        return;
      }
      if (nouvelEmail.toLowerCase() === String(UI.email).toLowerCase()) {
        message(msg, trad('C\'est déjà l\'adresse actuelle.'), true);
        return;
      }
      if (!motDePasse) {
        message(msg, trad('Saisis ton mot de passe actuel pour confirmer.'), true);
        return;
      }

      btn.disabled = true;
      btn.textContent = trad('Vérification…');
      try {
        // Ré-authentification obligatoire avant un changement sensible.
        // ★ L'ADRESSE TECHNIQUE EST COMPLÈTE ICI. UI.email peut être le login
        //   court d'un membre créé par le gérant (`jean.dupont`) : le renvoyer
        //   tel quel ferait échouer la ré-authentification, alors que l'écran
        //   affiche « jean.dupont ». Même fonction que l'écran de connexion.
        const { error: authErr } = await sb.auth.signInWithPassword({ email: emailDeConnexion(UI.email), password: motDePasse });
        if (authErr) throw new Error(trad('Mot de passe incorrect.'));

        btn.textContent = trad('Envoi du lien…');
        const { error } = await sb.auth.updateUser({ email: nouvelEmail });
        if (error) throw error;

        message(msg, trad('Demande envoyée. Ouvre le lien de confirmation reçu par email : la nouvelle adresse ne sera active qu\'après validation.'), false);
        champEmail.value = '';
        champMotDePasse.value = '';
      } catch (err) {
        message(msg, trad('Erreur :') + ' ' + (err.message || err), true);
      }
      btn.disabled = false;
      btn.textContent = trad('Changer l\'email');
    });

    // LE BOUTON DE SUPPRESSION vit dans « Mon compte », en bas, dans une zone à
    // part : visible, mais jamais à côté d'une action courante.
    brancherSuppressionCompte(root);
  },
};

// ── SUPPRIMER MON COMPTE ──────────────────────────────────────────────
//
// POURQUOI CE BLOC EXISTE : Google Play exige un chemin de suppression DANS
// l'application dès lors qu'on peut y créer un compte. La page publique
// (suppression-compte.html) décrit la même chose, et sert de secours si l'accès
// est perdu.
//
// DEUX CONFIRMATIONS, ET C'EST VOLONTAIRE. Un compte qui disparaît emporte les
// machines, les plans, l'historique, les photos et les carnets : on liste donc
// D'ABORD ce qui sera perdu, et on demande ENSUITE un mot à taper. Une simple
// case à cocher se clique par réflexe ; écrire le mot oblige à lire.
//
// L'ABONNEMENT EST LE PIÈGE, et il est dit AVANT : la suppression résilie
// l'abonnement, sans remboursement au prorata (CGU §12). Personne ne doit
// découvrir après coup qu'il a perdu un mois payé — ni continuer d'être débité
// pour un compte qui n'existe plus. C'est le serveur qui résilie, et s'il
// n'y arrive pas, RIEN n'est supprimé.
function brancherSuppressionCompte(root) {
  const bouton = root.querySelector('#acc-supprimer');
  const message = root.querySelector('#acc-supprimer-msg');
  if (!bouton) return;
  bouton.addEventListener('click', () => ouvrirSuppressionCompte(message));
}

// Ce que la suppression va emporter, en clair, avec les chiffres que l'écran
// connaît déjà (aucune requête supplémentaire pour compter).
function resumeDeCeQuiSeraPerdu() {
  const machines = (UI.machines || []).length;
  const categories = (UI.categories || []).length;
  return {
    machines,
    categories,
    lignes: [
      tR('{n} machine(s), leurs plans d\'entretien, et tout l\'historique des entretiens et des relevés de compteur.', { n: machines }),
      trad('Les photos des machines et les carnets d\'entretien (PDF).'),
      tR('Les {n} catégorie(s) de machines et les rappels programmés.', { n: categories }),
      trad('Ton compte et ton adresse de connexion.'),
    ],
  };
}

async function ouvrirSuppressionCompte(messageEcran) {
  const resume = resumeDeCeQuiSeraPerdu();
  // L'abonnement : on lit la société (la colonne n'existe que si Stripe est
  // branché). À défaut, le palier suffit à savoir qu'une offre est payante.
  let abonnementId = '';
  let offre = UI.companyPlan || 'free';
  try {
    const { data } = await sb.from('companies').select('plan, stripe_subscription_id').eq('id', UI.companyId).maybeSingle();
    if (data) {
      abonnementId = data.stripe_subscription_id || '';
      offre = data.plan || offre;
    }
  } catch (err) {
    // Colonne absente sur une base plus ancienne : le palier fait foi.
    abonnementId = '';
  }
  const payant = !!abonnementId || (offre && offre !== 'free');
  const motConfirmation = trad('SUPPRIMER');

  const overlay = document.createElement('div');
  overlay.className = 'overlay suppr-compte-modal';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="suppr-titre">
      <h2 id="suppr-titre">${trad('Supprimer mon compte')}</h2>
      <p class="sub">${trad('Cette action est irréversible. Voici ce qui sera définitivement effacé :')}</p>
      <ul class="suppr-liste">
        ${resume.lignes.map((l) => `<li>${esc(l)}</li>`).join('')}
      </ul>
      ${payant ? `
        <div class="suppr-alerte" role="alert">
          <strong>${trad('Ton abonnement en cours sera résilié immédiatement, sans remboursement au prorata (CGU §12) : la période déjà payée est perdue.')}</strong>
        </div>` : ''}
      <p class="hint">${trad('Si d\'autres membres utilisent cette société, elle n\'est PAS supprimée : seul ton compte disparaît.')}</p>
      <label for="suppr-mot">${tR('Pour confirmer, tape {mot} ci-dessous.', { mot: motConfirmation })}</label>
      <input id="suppr-mot" autocomplete="off" placeholder="${esc(motConfirmation)}">
      <div class="hint" id="suppr-erreur" role="status" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="secondary" id="suppr-annuler">${trad('Annuler')}</button>
        <button type="button" class="primary" id="suppr-confirmer" disabled>${trad('Supprimer définitivement')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const champMot = overlay.querySelector('#suppr-mot');
  const boutonConfirmer = overlay.querySelector('#suppr-confirmer');
  const erreur = overlay.querySelector('#suppr-erreur');
  const fermer = () => overlay.remove();

  // Deux sorties, comme les autres fenêtres de l'application : le bouton
  // « Annuler », et un clic sur le fond (Échap est déjà global).
  overlay.querySelector('#suppr-annuler').addEventListener('click', fermer);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
  // LE MOT À TAPER EST LA SECONDE CONFIRMATION : le bouton reste inerte tant
  // qu'il n'est pas exact (on tolère les espaces et la casse).
  champMot.addEventListener('input', () => {
    const saisi = String(champMot.value || '').trim().toUpperCase();
    boutonConfirmer.disabled = saisi !== motConfirmation.toUpperCase();
  });

  boutonConfirmer.addEventListener('click', async () => {
    boutonConfirmer.disabled = true;
    boutonConfirmer.textContent = trad('Suppression en cours…');
    erreur.textContent = '';
    try {
      const { data, error } = await sb.functions.invoke('supprimer-compte', { method: 'POST' });
      if (error) throw new Error(await functionErrorMessage(error, trad('suppression impossible')));
      if (!data || data.supprime !== true) {
        throw new Error(data && data.error ? data.error : trad('suppression impossible'));
      }
      // LA TRACE LOCALE PART AVEC LE COMPTE : copie hors connexion, relevés en
      // attente, photos en attente, décomptes. Rien ne doit rester sur
      // l'appareil après une suppression demandée.
      for (const cle of ['parcpacific.derniere-donnees.v1', 'keeva.compteurs-en-attente.v1',
        'keeva.photos-en-attente.v1', 'keeva-lectures-compteur-restantes',
        'keeva-recherches-image.v1', 'keeva-analyses-restantes']) {
        try { localStorage.removeItem(cle); } catch (err) { /* stockage indisponible */ }
      }
      try { await sb.auth.signOut(); } catch (err) { /* la session est de toute façon morte */ }
      fermer();
      // Le message dit CE QUI a été supprimé : « profil » signifie que la
      // société et ses machines sont restées (d'autres membres y travaillent).
      boot(data.portee === 'profil'
        ? trad('Compte supprimé. Ta société et ses machines restent en place : d\'autres membres y ont accès.')
        : trad('Compte supprimé.'));
    } catch (err) {
      // UN REFUS SE DIT, ET RIEN N'EST PERDU : on laisse la fenêtre ouverte pour
      // que le client puisse réessayer, ou écrire au support.
      erreur.textContent = tR('La suppression n\'a pas abouti ({erreur}). Rien n\'a été supprimé.', { erreur: (err && err.message) || err });
      boutonConfirmer.disabled = false;
      boutonConfirmer.textContent = trad('Supprimer définitivement');
      if (messageEcran) messageEcran.textContent = '';
    }
  });
}

// ── Feuille « Plus » (mobile) ─────────────────────────────────
// Étiquette d'offre courte, pour le badge de la feuille « Plus » — même
// repli que limiteOffre() (une offre absente de LIMITES_OFFRES = illimitée =
// Pro), jamais un libellé à part inventé pour ce badge.
function badgeOffreCourt() {
  const offre = String(UI.companyPlan || 'free').toLowerCase();
  if (offre === 'free') return { texte: trad('Gratuit'), classe: 'neutral' };
  if (offre === 'eco') return { texte: trad('Éco'), classe: 'soon' };
  return { texte: trad('Pro'), classe: 'ok' };
}
// Reprise Stitch « Navigation Plus » — feuille ouverte par le bouton central
// de la barre mobile (barreMobileHtml, id="open-plus") ET par le raccourci
// « Plus » de la barre d'onglets (tabbarHtml). Mêmes destinations que
// l'ancienne .sheet minimale, présentées comme la maquette : icône teintée +
// sous-titre par ligne, badge/pastille/chevron à droite. Données réelles
// uniquement — pas de « v2.4.1 » de la maquette (fictif) : la vraie version
// publiée (version.json), pas de compte de documents inventé : UI.counts,
// déjà calculé par machineCounts() à chaque rendu.
function openPlusSheet() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.style.alignItems = 'flex-end';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const nom = UI.contactName || UI.companyName || trad('Mon compte');
  const offre = badgeOffreCourt();
  const nbMachines = (UI.machines || []).filter((m) => !m.archived).length;
  const nbDocs = UI.counts?.manuals || 0;
  const alerteRappels = (UI.counts?.late || 0) > 0;
  const itemHtml = (nav, icone, teinte, titre, sousTitre, droiteHtml) => `
    <button type="button" class="plus-sheet-item" data-nav="${nav}">
      <span class="plus-sheet-item-gauche">
        <span class="plus-sheet-item-icone ${teinte}">${navIcone(icone)}</span>
        <span class="plus-sheet-item-texte">
          <span class="plus-sheet-item-titre">${esc(titre)}</span>
          <span class="plus-sheet-item-sous">${esc(sousTitre)}</span>
        </span>
      </span>
      <span class="plus-sheet-item-droite">${droiteHtml || ''}${picto('flecheDroite')}</span>
    </button>`;
  overlay.innerHTML = `
    <div class="plus-sheet">
      <div class="plus-sheet-poignee"><span></span></div>
      <div class="plus-sheet-entete">
        <div class="plus-sheet-identite">
          <div class="plus-sheet-avatar">${initialsFrom(nom)}<span class="plus-sheet-avatar-pastille"></span></div>
          <div>
            <div class="plus-sheet-nom-ligne">
              <span class="plus-sheet-nom">${esc(nom)}</span>
              <span class="badge ${offre.classe}">${offre.texte}</span>
            </div>
            <p class="plus-sheet-sous-titre">${esc(tR('{societe} • {n} machine(s) suivie(s)', { societe: UI.companyName || trad('Ta société'), n: nbMachines }))}</p>
          </div>
        </div>
        <button type="button" class="plus-sheet-fermer" id="plus-sheet-fermer-x" aria-label="${esc(trad('Fermer le menu'))}">${picto('fermer')}</button>
      </div>
      <div class="plus-sheet-corps">
        <div class="plus-sheet-section">
          <div class="plus-sheet-section-tete">
            <span class="plus-sheet-section-titre">${trad('Navigation parc')}</span>
            <span class="plus-sheet-section-accessoire">${trad('Accès rapide')}</span>
          </div>
          ${itemHtml('manuals', 'manuels', 'is-indigo', trad('Plan d\'entretien'), trad('Revues techniques, éclatés & atelier'), nbDocs ? `<span class="plus-sheet-item-compte">${esc(tR('{n} doc(s)', { n: nbDocs }))}</span>` : '')}
          ${itemHtml('agenda', 'agenda', 'is-signature', trad('Agenda & Échéances'), trad('Planning vidanges, contrôles et visites'), '')}
          ${itemHtml('reminders', 'rappels', 'is-amber', trad('Rappels & Alertes'), trad('Notifications push et périodicités'), alerteRappels ? `<span class="plus-sheet-item-pastille"><span></span><span></span></span>` : '')}
          ${tcoActif() ? itemHtml('tco', 'couts', 'is-royal', trad('Coûts & TCO'), trad('Dépenses carburant, pièces & rentabilité'), '') : ''}
          ${(telemetrieActif() && UI.role === 'gerant') ? itemHtml('telemetrie', 'telemetrie', 'is-indigo', trad('Télémétrie'), trad('Compteurs automatiques des machines'), '') : ''}
          ${(SCHEMA.hasStock && planCouvreStock()) ? itemHtml('stock', 'stock', 'is-olive', trad('Stocks & SAV'), trad('Magasins, mouvements & alertes de seuil'), (UI.stockCounts?.seuilBas || 0) > 0 ? `<span class="plus-sheet-item-pastille"><span></span><span></span></span>` : '') : ''}
        </div>
        <div class="plus-sheet-separateur"></div>
        <div class="plus-sheet-section">
          <div class="plus-sheet-section-tete"><span class="plus-sheet-section-titre">${trad('Compte & organisation')}</span></div>
          ${itemHtml('account', 'compte', 'is-neutre', trad('Mon compte'), trad('Société, équipe et licences matérielles'), '')}
          <button type="button" class="plus-sheet-item is-deconnexion" id="plus-sheet-logout">
            <span class="plus-sheet-item-gauche">
              <span class="plus-sheet-item-icone is-neutre"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg></span>
              <span class="plus-sheet-item-texte">
                <span class="plus-sheet-item-titre">${trad('Se déconnecter')}</span>
                <span class="plus-sheet-item-sous">${trad('Terminer la session actuelle')}</span>
              </span>
            </span>
            <span class="plus-sheet-item-version">v${esc(APP_VERSION)}</span>
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#plus-sheet-fermer-x').addEventListener('click', () => overlay.remove());
  overlay.querySelectorAll('[data-nav]').forEach(btn => btn.addEventListener('click', () => {
    overlay.remove();
    goTo(btn.dataset.nav);
  }));
  overlay.querySelector('#plus-sheet-logout').addEventListener('click', () => { overlay.remove(); doLogout(); });
}
