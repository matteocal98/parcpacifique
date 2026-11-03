// Scénarios de capture — lot « Démarrer et compte » (centre d'aide). Même mécanique que scenarios.mjs : chaque ÉTAPE ouvre un écran avec le parc fictif, pose des repères
// rouges numérotés et renvoie la zone à photographier. Les numéros des repères sont ceux des ÉTAPES de l'article quand l'image montre plusieurs étapes à la fois.
// Règles : aucun prix ni quota chiffré dans l'image ; les libellés sont cherchés par id / sélecteur (ou texte FR|EN), jamais par leur texte français seul.

// Échoue si un élément repéré sort de la zone photographiée.
async function toutDansLaZone(c, selecteurs, zone) {
  const dehors = await c.horsZone(selecteurs, zone);
  if (dehors.length) { const r = await c.ev('JSON.stringify([' + JSON.stringify(zone) + ', ' + JSON.stringify(dehors) + '].map((s) => Array.isArray(s) ? s.map((x) => { const e = document.querySelector(x); return e ? [x, e.getBoundingClientRect().toJSON()] : [x]; }) : (() => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; })()))'); throw new Error('éléments repérés hors de la zone photographiée : ' + dehors.join(', ') + ' ' + r); }
}
// Crée un cadre invisible qui englobe plusieurs éléments (du premier au dernier), pour pouvoir le repérer d'un seul trait rouge.
async function englober(c, selDebut, selFin, nom) {
  await c.ev(`(() => {
    const a = document.querySelector(${JSON.stringify(selDebut)}); const b = document.querySelector(${JSON.stringify(selFin)});
    if (!a || !b) throw new Error('à englober introuvable : ${selDebut} / ${selFin}');
    const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
    const g = Math.min(ra.left, rb.left); const h = Math.min(ra.top, rb.top); const d = Math.max(ra.right, rb.right); const bas = Math.max(ra.bottom, rb.bottom);
    const n = document.createElement('div'); n.setAttribute('data-aide', ${JSON.stringify(nom)});
    n.style.cssText = 'position:fixed;opacity:0;pointer-events:none;left:' + g + 'px;top:' + h + 'px;width:' + (d - g) + 'px;height:' + (bas - h) + 'px';
    document.body.appendChild(n); return true; })()`);
}
// La page « Mon compte » ; on attend qu'elle soit dessinée.
async function ouvrirCompte(c) {
  // Société fictive plus complète que le parc par défaut : pays, immatriculation, contact et téléphone d'exemple (sinon « Albanie » et des champs vides).
  const nom = c.langue === 'en' ? 'Demo Company' : 'Société Démo';
  await c.ev("UI.companyName = '" + nom + "'; UI.company = { ...UI.company, name: '" + nom + "', country: 'NC', registrationNumber: '1234567', activity: 'BTP / Travaux publics', contact_first_name: 'Camille', contact_last_name: 'MARTIN', phone: '+687 78 12 34' }; goTo('account'); true");
  await c.attendre('#view-root .compte-page .ui-section');
  await c.dort(700);
}
// Section « Données locales & Sécurité » : celle qui contient la langue et le thème.
const SECTION_LOCALE = '[data-aide="locale"]';
async function marquerSectionLocale(c) {
  await c.ev(`(() => { const s = [...document.querySelectorAll('#view-root .compte-page .ui-section')].find((x) => x.querySelector('.lang-btn')); if (!s) throw new Error('section locale absente'); s.setAttribute('data-aide', 'locale'); return true; })()`);
}

export const SCENARIOS = [
  // ───────────────────────────────────────── Se repérer : le menu et les rubriques
  {
    id: 'dem-menu-rubriques',
    etapes: [
      // Étapes 1 et 5 : la barre de gauche (liste des rubriques) et, en bas, « Se déconnecter ».
      { nom: 'barre', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('dashboard'); true");
        await c.attendre('.sidebar .nav-item');
        await c.dort(700);
        // La barre occupe toute la hauteur de l'écran : on la raccourcit pour que « Se déconnecter » reste près de la liste sur l'image.
        await c.ev("(() => { const s = document.querySelector('.sidebar'); const cs = getComputedStyle(s); s.style.height = '600px'; s.style.minHeight = '0'; s.style.maxHeight = '600px'; const f = s.firstElementChild; return cs.position + '/' + s.getBoundingClientRect().height; })()");
        await c.dort(300);
        await englober(c, '.sidebar .nav-item:first-of-type', '.sidebar .nav-item:last-of-type', 'rubriques');
        await c.repere('[data-aide="rubriques"]', 1, { marge: 6 });
        await c.repere('#logout-btn', 5, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['[data-aide="rubriques"]', '#logout-btn'], '.sidebar');
        const z = await c.zone('.sidebar', 0);
        return { ...z, largeur: z.largeur + 18 };
      } },
      // Étape 2 : les onglets sous le titre d'une rubrique (ici « Machines »).
      { nom: 'onglets', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('machines'); true");
        await c.attendre('.sous-nav .sous-nav-lien');
        await c.dort(700);
        await c.repere('.sous-nav', 2, { marge: 6 });
        return c.zone('.sous-nav', 40);
      } },
      // Étapes 3 et 4 : sur téléphone, la barre du bas (3) et les deux icônes du haut (4).
      { nom: 'telephone', ecran: 'mobile', async jouer(c) {
        await c.ev("goTo('machines'); true");
        await c.attendre('#open-plus');
        await c.dort(700);
        await englober(c, '#bm-aide', '#bm-compte', 'icones');
        await c.repere('.tabbar', 3, { marge: 2 });
        await c.repere('[data-aide="icones"]', 4, { marge: 4 });
        return { x: 0, y: 0, largeur: 390, hauteur: 844 };
      } },
    ],
  },

  // ───────────────────────────────────────── Le bouton « Plus » du téléphone
  {
    id: 'dem-bouton-plus',
    etapes: [
      // Étape 1 : « Plus », tout à droite de la barre du bas.
      { nom: 'barre', ecran: 'mobile', async jouer(c) {
        await c.ev("goTo('dashboard'); true");
        await c.attendre('#open-plus');
        await c.dort(700);
        await c.repere('#open-plus', 1, { marge: 4, cote: 'gauche' });
        return c.zone('.tabbar', 10);
      } },
      // Étapes 2, 3 et 5 : la feuille ouverte — en-tête (2), « Navigation parc » (3), croix « Fermer le menu » (5).
      { nom: 'feuille', ecran: 'mobile', async jouer(c) {
        await ouvrirFeuillePlus(c);
        await c.repere('.plus-sheet-entete', 2, { marge: 2 });
        await c.repere('[data-aide="parc"]', 3, { marge: 2 });
        await c.repere('#plus-sheet-fermer-x', 5, { marge: 3, cote: 'gauche-centre' });
        return { x: 0, y: 0, largeur: 390, hauteur: 844 };
      } },
      // Étape 4 : la même feuille, défilée jusqu'en bas — « Compte & organisation » (4), jusqu'à « Se déconnecter ».
      { nom: 'feuille-compte', ecran: 'mobile', async jouer(c) {
        await ouvrirFeuillePlus(c);
        await c.ev("(() => { const k = document.querySelector('.plus-sheet-corps'); k.scrollTop = k.scrollHeight; return true; })()");
        await c.dort(500);
        await c.repere('[data-aide="compte"]', 4, { marge: 2 });
        await toutDansLaZone(c, ['[data-aide="compte"]'], '.plus-sheet-corps');
        return { x: 0, y: 0, largeur: 390, hauteur: 844 };
      } },
    ],
  },

  // ───────────────────────────────────────── Changer la langue
  {
    id: 'dem-changer-langue',
    etapes: [
      // Étapes 1 et 2 : la section « Données locales & Sécurité » (1) et, dedans, « Langue de l'interface » avec Français / English (2).
      { nom: 'langue', ecran: 'bureau', async jouer(c) {
        await ouvrirCompte(c);
        await marquerSectionLocale(c);
        await c.marquer('.compte-page .lang-btn', 'langues', 'parent');
        await c.voir(SECTION_LOCALE, 'start');
        await c.dort(300);
        await c.repere(SECTION_LOCALE + ' .ui-section-tete', 1, { marge: 4 });
        await c.repere('[data-aide="langues"]', 2, { marge: 6 });
        await toutDansLaZone(c, [SECTION_LOCALE + ' .ui-section-tete', '[data-aide="langues"]'], SECTION_LOCALE);
        return c.zone(SECTION_LOCALE, 16);
      } },
    ],
  },

  // ───────────────────────────────────────── Informations de la société
  {
    id: 'dem-infos-societe',
    etapes: [
      // Étapes 2 et 3 : les champs de « Société & Identité légale » (2), puis « Enregistrer les modifications » (3). On s'arrête sous ce bouton : la ligne d'offre qui suit contient un prix.
      { nom: 'identite', ecran: 'bureau', async jouer(c) {
        await ouvrirCompte(c);
        await c.ev("document.querySelector('#view-root .compte-page .ui-section').setAttribute('data-aide', 'societe'); true");
        await c.ev("document.querySelector('#acc-name').closest('.ui-grille').setAttribute('data-aide', 'champs-societe'); true");
        await c.repere('[data-aide="champs-societe"]', 2, { marge: 6, cote: 'gauche-centre' });
        await c.repere('#acc-save-societe', 3, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['[data-aide="champs-societe"]', '#acc-save-societe'], '[data-aide="societe"]');
        return c.zoneJusqua('[data-aide="societe"]', '#acc-save-societe', 22);
      } },
      // Étapes 4 et 5 : « Prénom », « Nom », « Téléphone » de « Contact & Alertes » (4), puis « Enregistrer » (5).
      { nom: 'contact', ecran: 'bureau', async jouer(c) {
        await ouvrirCompte(c);
        await c.ev("document.querySelector('#acc-first').closest('.ui-section').setAttribute('data-aide', 'contact'); true");
        await c.voir('[data-aide="contact"]', 'start');
        await c.dort(300);
        await c.marquer('#acc-first', 'prenom', '.ui-champ-groupe');
        await c.marquer('#acc-phone', 'tel', '.ui-champ-groupe');
        await englober(c, '[data-aide="prenom"]', '[data-aide="tel"]', 'champs-contact');
        await c.repere('[data-aide="champs-contact"]', 4, { marge: 8, cote: 'gauche-centre' });
        await c.repere('#acc-save-contact', 5, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['[data-aide="champs-contact"]', '#acc-save-contact'], '[data-aide="contact"]');
        return c.zone('[data-aide="contact"]', 34);
      } },
    ],
  },

  // ───────────────────────────────────────── Se connecter
  {
    id: 'dem-se-connecter',
    etapes: [
      // Étapes 2 à 4 : « E-mail ou identifiant atelier » (2), « Mot de passe » avec « Afficher » (3), « Se connecter » (4). On s'arrête sous les boutons : le bloc de présentation qui suit annonce un nombre de machines gratuites.
      { nom: 'connexion', ecran: 'bureau', async jouer(c) {
        await fondClair(c);
        await c.ev('renderLogin(); true');
        await c.attendre('#email');
        await c.dort(600);
        await c.ev("(() => { document.getElementById('email').value = 'camille@exemple.fr'; document.getElementById('password').value = 'exemple-mot-de-passe'; return true; })()");
        await c.marquer('#email', 'identifiant', '.champ-icone');
        await c.marquer('#password', 'mdp', '.password-wrap');
        await c.marquer('#login-form button.primary', 'valider');
        await c.repere('[data-aide="identifiant"]', 2, { marge: 5, cote: 'gauche-centre' });
        await c.repere('[data-aide="mdp"]', 3, { marge: 5, cote: 'gauche-centre' });
        await c.repere('[data-aide="valider"]', 4, { marge: 5, cote: 'droite' });
        await toutDansLaZone(c, ['[data-aide="identifiant"]', '[data-aide="mdp"]', '[data-aide="valider"]'], '.login-box');
        return c.zoneJusqua('.login-box', '.login-actions', 12);
      } },
    ],
  },

  // ───────────────────────────────────────── Créer un compte
  {
    id: 'dem-creer-compte',
    etapes: [
      // Étape 1 : « Créer un compte » sur l'écran de connexion.
      { nom: 'bouton', ecran: 'bureau', async jouer(c) {
        await fondClair(c);
        await c.ev('renderLogin(); true');
        await c.attendre('#open-signup');
        await c.dort(600);
        await c.repere('#open-signup', 1, { marge: 5, cote: 'droite' });
        return c.zoneJusqua('.login-box', '.login-actions', 24);
      } },
      // Étapes 2 à 4 : le type de structure (2), la description de la structure (3), le contact + identifiants (4) et « Créer le compte » (4). L'encadré des offres, en haut de la fenêtre, contient des prix : on le masque.
      { nom: 'formulaire', ecran: 'bureau', async jouer(c) {
        await ouvrirInscription(c);
        await c.marquer('#su-phone', 'tel', '.field-row');
        await c.ev("document.querySelector('[data-aide=\"tel\"]').nextElementSibling.setAttribute('data-aide', 'tel-aide'); true");
        await c.marquer('#su-contact-first', 'prenom-contact', '.field-row');
        await c.marquer('#su-password', 'mdp-inscription', '.field-row');
        await englober(c, '#su-name-groupe', '[data-aide="tel-aide"]', 'structure');
        await englober(c, '[data-aide="prenom-contact"]', '[data-aide="mdp-inscription"]', 'contact-id');
        await c.voir('.overlay .modal', 'start');
        await c.repere('#su-type-cards', 2, { marge: 3, cote: 'gauche-centre' });
        await c.repere('[data-aide="structure"]', 3, { marge: 1, cote: 'gauche-centre' });
        await c.repere('[data-aide="contact-id"]', 4, { marge: 1, cote: 'gauche-centre' });
        await c.repere('.signup-modal .modal-actions .primary', 4, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['#su-type-cards', '[data-aide="structure"]', '[data-aide="contact-id"]', '.signup-modal .modal-actions .primary'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
      // Étape 5 : « Vérifie ton email » — le serveur n'est pas joignable, on simule la réponse « code envoyé » avant de valider le formulaire.
      { nom: 'code', ecran: 'bureau', async jouer(c) {
        await ouvrirInscription(c);
        await c.ev("(() => { sb.auth.signUp = async () => ({ data: { user: { identities: [{}] } }, error: null }); document.getElementById('signup-form').requestSubmit(); return true; })()");
        await c.attendre('#su-code');
        await c.dort(700);
        await c.ev("(() => { const k = document.getElementById('su-code'); k.value = '482915'; k.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
        await c.repere('#su-code', 5, { marge: 5, cote: 'gauche-centre' });
        await c.repere('.overlay .modal button[type="submit"]', 5, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['#su-code', '.overlay .modal button[type="submit"]'], '.overlay .modal');
        return c.zone('.overlay .modal', 34);
      } },
    ],
  },

  // ───────────────────────────────────────── Changer d'offre — SANS aucun prix ni quota chiffré dans les images
  {
    id: 'dem-changer-offre',
    etapes: [
      // Étapes 1 et 2 : la ligne de l'offre actuelle (1) et « Changer d'offre » (2). Le texte de la ligne contient prix et capacité : on le remplace par le seul nom de l'offre.
      { nom: 'ligne-offre', ecran: 'bureau', async jouer(c) {
        await ouvrirCompte(c);
        await c.attendre('#account-upgrade');
        await c.ev("(() => { const l = document.getElementById('account-upgrade').closest('.ui-ligne'); l.querySelector('.ui-ligne-nom').textContent = OFFRES_LIBELLES.enterprise; l.setAttribute('data-aide', 'ligne'); l.closest('.ui-liste').setAttribute('data-aide', 'liste-offre'); const aide = l.querySelector('.ui-aide'); if (aide) aide.remove(); return true; })()");
        await c.voir('[data-aide="liste-offre"]', 'center');
        await c.dort(300);
        await c.repere('[data-aide="ligne"]', 1, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#account-upgrade', 2, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['[data-aide="ligne"]', '#account-upgrade'], '[data-aide="liste-offre"]');
        const z = await c.zone('[data-aide="liste-offre"]', 8);
        return { ...z, x: Math.max(0, z.x - 30), largeur: z.largeur + 30 };
      } },
      // Étape 2 : le haut de la fenêtre « Les offres KALEA » — on s'arrête sous le nom des offres, avant leur prix.
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await ouvrirOffres(c);
        await c.repere('.offres-eyebrow', 2, { marge: 5 });
        await c.repere('.offre-carte-tag.is-actuelle', 2, { marge: 5 });
        const z = await c.zoneJusqua('.overlay .modal', '.offre-carte-entete', 4);
        return z;
      } },
      // Étape 3 : seulement la rangée des boutons « Passer à … » (pied des cartes) : ni prix ni quota.
      { nom: 'boutons', ecran: 'bureau', async jouer(c) {
        await ouvrirOffres(c);
        await c.voir('.offre-carte-pied', 'center');
        await c.dort(300);
        await englober(c, '.offre-carte:first-child .offre-carte-pied', '.offre-carte:last-child .offre-carte-pied', 'pieds');
        await c.repere('[data-aide="pieds"]', 3, { marge: 6, cote: 'gauche' });
        return c.ev(`(() => { const r = [...document.querySelectorAll('.offre-carte-pied')].map((e) => e.getBoundingClientRect()); const g = Math.min(...r.map((x) => x.left)) - 22; const h = Math.min(...r.map((x) => x.top)) - 30; const d = Math.max(...r.map((x) => x.right)) + 22; const b = Math.max(...r.map((x) => x.bottom)) + 18; return { x: g + (window.pageXOffset || 0), y: h + (window.pageYOffset || 0), largeur: d - g, hauteur: b - h }; })()`);
      } },
    ],
  },
  // ───────────────────────────────────────── Thème clair / sombre
  {
    id: 'dem-theme-sombre',
    etapes: [
      // Étapes 2 et 3 : la section « Données locales & Sécurité » (2) et les trois boutons Auto / Clair / Sombre (3), thème sombre appliqué.
      { nom: 'theme', ecran: 'bureau', async jouer(c) {
        await ouvrirCompte(c);
        await marquerSectionLocale(c);
        await c.ev("document.querySelector('[data-theme-choix=\"sombre\"]').click(); true");
        await c.dort(600);
        await c.voir(SECTION_LOCALE, 'start');
        await c.dort(300);
        await c.repere(SECTION_LOCALE + ' .ui-section-tete', 2, { marge: 4 });
        await c.repere('.theme-segment', 3, { marge: 6 });
        await toutDansLaZone(c, [SECTION_LOCALE + ' .ui-section-tete', '.theme-segment'], SECTION_LOCALE);
        return c.zone(SECTION_LOCALE, 16);
      } },
    ],
  },

  // ═════════════════════════════════════ SECONDE SÉRIE ═════════════════════════════════════

  // ───────────────────────────────────────── Mot de passe oublié
  {
    id: 'dem-mot-de-passe-oublie',
    etapes: [
      // Étape 1 : le lien « Mot de passe oublié ? » de l'écran de connexion.
      { nom: 'lien', ecran: 'bureau', async jouer(c) {
        await fondClair(c);
        await c.ev('renderLogin(); true');
        await c.attendre('#open-forgot');
        await c.dort(600);
        await c.repere('#open-forgot', 1, { marge: 4, cote: 'gauche-centre' });
        return c.zoneJusqua('.login-box', '.login-actions', 12);
      } },
      // Étape 2 : la fenêtre « Mot de passe oublié » — le champ Email et le bouton « Envoyer le code ».
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await ouvrirOubli(c);
        await c.repere('#forgot-email', 2, { marge: 5, cote: 'gauche-centre' });
        await c.repere('#forgot-form button[type="submit"]', 2, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['#forgot-email', '#forgot-form button[type="submit"]'], '.overlay .modal');
        return c.zone('.overlay .modal', 34);
      } },
      // Étapes 3 à 5 : l'écran « Vérifie ton email » — l'adresse confirmée (3), le code et le nouveau mot de passe (4), « Enregistrer le mot de passe » (5).
      { nom: 'code', ecran: 'bureau', async jouer(c) {
        await ouvrirOubli(c);
        await c.ev("(() => { sb.auth.resetPasswordForEmail = async () => ({ error: null }); document.getElementById('forgot-form').requestSubmit(); return true; })()");
        await c.attendre('#reset-code');
        await c.dort(600);
        await c.ev("(() => { const f = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; f('reset-code', '482915'); f('reset-password', 'exemple-mot-de-passe'); document.activeElement && document.activeElement.blur(); return true; })()");
        await englober(c, 'label[for="reset-code"]', '#reset-password', 'champs');
        await c.repere('.overlay .modal .sub', 3, { marge: 4, cote: 'gauche-centre' });
        await c.repere('[data-aide="champs"]', 4, { marge: 6, cote: 'gauche-centre' });
        await c.repere('.overlay .modal button[type="submit"]', 5, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['.overlay .modal .sub', '[data-aide="champs"]', '.overlay .modal button[type="submit"]'], '.overlay .modal');
        return c.zone('.overlay .modal', 34);
      } },
    ],
  },

  // ───────────────────────────────────────── Code de vérification non reçu
  {
    id: 'dem-code-non-recu',
    etapes: [
      // Étapes 1 à 3 : l'écran « Vérifie ton email » — l'adresse affichée (1), « Renvoyer le code » (2), le champ du code (3).
      { nom: 'verification', ecran: 'bureau', async jouer(c) {
        await ouvrirCodeInscription(c);
        await c.repere('.overlay .modal .sub', 1, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#verify-resend', 2, { marge: 5, cote: 'gauche-centre' });
        await c.repere('#su-code', 3, { marge: 5, cote: 'gauche-centre' });
        await toutDansLaZone(c, ['.overlay .modal .sub', '#verify-resend', '#su-code'], '.overlay .modal');
        return c.zone('.overlay .modal', 34);
      } },
      // Étape 2 : après « Renvoyer le code » — « Nouveau code envoyé. » puis le compte à rebours.
      { nom: 'renvoi', ecran: 'bureau', async jouer(c) {
        await ouvrirCodeInscription(c);
        await c.ev("(() => { sb.auth.resend = async () => ({ error: null }); document.getElementById('verify-resend').click(); return true; })()");
        await c.dort(700);
        await englober(c, '#verify-resend', '#verify-resend-msg', 'renvoi');
        await c.repere('[data-aide="renvoi"]', 2, { marge: 6, cote: 'gauche-centre' });
        await toutDansLaZone(c, ['[data-aide="renvoi"]'], '.overlay .modal');
        return c.zone('.overlay .modal', 34);
      } },
      // Étape 4 : « Cette adresse a déjà un compte » — « Mot de passe oublié ? » et « Se connecter ».
      { nom: 'deja-compte', ecran: 'bureau', async jouer(c) {
        await ouvrirInscription(c);
        await c.ev("(() => { sb.auth.signUp = async () => ({ data: { user: { identities: [] } }, error: null }); document.getElementById('signup-form').requestSubmit(); return true; })()");
        await c.attendre('#deja-login');
        await c.dort(600);
        await c.repere('#deja-forgot', 4, { marge: 4, cote: 'gauche' });
        await c.repere('#deja-login', 4, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['#deja-forgot', '#deja-login'], '.overlay .modal');
        return c.zone('.overlay .modal', 34);
      } },
    ],
  },

  // ───────────────────────────────────────── Compte sans société
  {
    id: 'dem-societe-manquante',
    etapes: [
      // Étapes 1 à 3 : le message (1), « Nom de la société » et « Activité » (2), « Créer ma société » (3).
      { nom: 'ecran', ecran: 'bureau', async jouer(c) {
        await fondClair(c);
        await c.ev("renderSocieteManquante({ id: 'demo', user_metadata: {} }); true");
        await c.attendre('#societe-nom');
        await c.dort(600);
        await c.ev("(() => { const e = document.getElementById('societe-nom'); e.value = 'ATELIER DU LAGON'; document.activeElement && document.activeElement.blur(); return true; })()");
        await c.ev("(() => { const s = document.getElementById('societe-activite'); let f = s; if (s.getBoundingClientRect().height === 0) { f = s.nextElementSibling; while (f && f.getBoundingClientRect().height === 0) f = f.nextElementSibling; } f.setAttribute('data-aide', 'activite-fin'); return true; })()");
        await englober(c, 'label[for="societe-nom"]', '[data-aide="activite-fin"]', 'champs');
        await c.repere('.login-box > p', 1, { marge: 4, cote: 'gauche-centre' });
        await c.repere('[data-aide="champs"]', 2, { marge: 6, cote: 'gauche-centre' });
        await c.repere('#societe-form button[type="submit"]', 3, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['.login-box > p', '[data-aide="champs"]', '#societe-form button[type="submit"]'], '.login-box');
        return c.zone('.login-box', 34);
      } },
    ],
  },

  // ───────────────────────────────────────── Accepter une invitation
  {
    id: 'dem-accepter-invitation',
    etapes: [
      // Étapes 1 et 2 : l'encadré « Invitation à rejoindre une société » de l'écran de connexion (1) et « Créer mon compte » (2).
      { nom: 'invitation', ecran: 'bureau', async jouer(c) {
        await fondClair(c);
        await c.ev('renderLogin(); true');
        await c.attendre('#email');
        await c.ev("afficherBlocInvitation('0123456789abcdef0123456789abcdef'); document.querySelectorAll('.presentation-publique .pres-pied').forEach((n) => { n.style.visibility = 'hidden'; }); true");
        await c.attendre('#invitation-zone');
        await c.dort(600);
        await c.voir('#invitation-zone', 'end');
        await c.dort(300);
        await c.repere('#invitation-zone', 1, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#invitation-inscrire', 2, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['#invitation-zone', '#invitation-inscrire'], '.login-box');
        return c.zoneJusqua('.login-box', '#invitation-zone', 16);
      } },
      // Étape 3 : une fois connecté, l'encadré rappelle l'adresse connectée et l'adresse invitée, avec « Accepter l'invitation ».
      { nom: 'invitation-connecte', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('dashboard'); true");
        await c.attendre('#view-root');
        await c.dort(500);
        await c.ev("(() => { const code = '0123456789abcdef0123456789abcdef'; afficherInvitationConnectee(code); const z = document.getElementById('invitation-connectee'); z.innerHTML = invitationConnecteeHtml(code, { email: 'camille@exemple.fr', invite: 'camille@exemple.fr' }); brancherAcceptationInvitation(code, z); return true; })()");
        await c.attendre('#invitation-accepter');
        await c.dort(500);
        await c.repere('#invitation-accepter', 3, { marge: 5, cote: 'droite' });
        await toutDansLaZone(c, ['#invitation-accepter'], '#invitation-connectee');
        return c.zone('#invitation-connectee', 34);
      } },
    ],
  },

  // ───────────────────────────────────────── Première machine : écran sans machine
  {
    id: 'dem-premiere-machine',
    etapes: [
      // Étape 1 : le tableau de bord d'un compte sans machine — « Ajouter une machine » (carte « Prochain entretien », et en haut de l'écran sur ordinateur).
      { nom: 'tableau', ecran: 'bureau', async jouer(c) {
        await ouvrirParcVide(c, 'dashboard');
        await c.attendre('#priority-add');
        await c.repere('#priority-add', 1, { marge: 5, cote: 'gauche-centre' });
        await c.repere('#dash-add', 1, { marge: 5, cote: 'gauche-centre' });
        await c.marquer('.dz-zone', 'depot', '.ui-section');
        await c.repere('.dz-zone', 4, { marge: 5, cote: 'gauche-centre' });
        return c.ev("(() => { const a = document.getElementById('dash-add').getBoundingClientRect(); const b = document.querySelector('.dz-zone').getBoundingClientRect(); const r = document.getElementById('view-root').getBoundingClientRect(); const g = Math.max(0, r.left - 44); const h = Math.max(0, a.top - 20); const d = Math.min(innerWidth, r.right + 10); const bas = b.bottom + 60; return { x: g, y: h, largeur: d - g, hauteur: bas - h }; })()");
      } },
      // Étape 3 : l'écran « Machines » vide — « Importer des machines ».
      { nom: 'machines-vide', ecran: 'bureau', async jouer(c) {
        await ouvrirParcVide(c, 'machines');
        await c.attendre('#fleet-import');
        await c.marquer('#fleet-import', 'import', '.ui-section');
        await c.repere('#fleet-import', 3, { marge: 5, cote: 'gauche-centre' });
        return c.zone('[data-aide="import"]', 34);
      } },
    ],
  },

  // ───────────────────────────────────────── Le bouton « + » : les actions rapides (téléphone)
  {
    id: 'dem-actions-rapides',
    etapes: [
      // Étape 1 : le bouton rond « + » au centre de la barre du bas.
      { nom: 'bouton', ecran: 'mobile', async jouer(c) {
        await c.ev("goTo('dashboard'); true");
        await c.attendre('#fab-add');
        await c.dort(700);
        await c.repere('#fab-add', 1, { marge: 6, cote: 'gauche' });
        return c.zone('.tabbar', 12);
      } },
      // Étape 2 : la feuille ouverte — la liste des actions (2).
      { nom: 'feuille', ecran: 'mobile', async jouer(c) {
        await c.ev("goTo('dashboard'); true");
        await c.attendre('#fab-add');
        await c.dort(500);
        await c.ev("document.getElementById('fab-add').click(); true");
        await c.attendre('.plus-sheet-item');
        await c.dort(900);
        await c.ev('document.activeElement && document.activeElement.blur(); true');
        await c.repere('.plus-sheet-corps .plus-sheet-section', 2, { marge: 2 });
        await toutDansLaZone(c, ['.plus-sheet-corps .plus-sheet-section'], '.plus-sheet-corps');
        return { x: 0, y: 0, largeur: 390, hauteur: 844 };
      } },
      // Étape 3 : le choix de la machine dans une liste, avec la recherche (3).
      { nom: 'choix-machine', ecran: 'mobile', async jouer(c) {
        await c.ev("goTo('dashboard'); true");
        await c.attendre('#fab-add');
        await c.dort(500);
        await c.ev("choisirMachineRapide(trad('Relever un compteur'), () => {}); true");
        await c.attendre('#picker-recherche');
        await c.dort(700);
        await c.ev('document.activeElement && document.activeElement.blur(); true');
        await c.repere('#picker-recherche', 3, { marge: 3, cote: 'gauche-centre' });
        await c.repere('#picker-liste', null, { marge: 2 });
        await toutDansLaZone(c, ['#picker-recherche', '#picker-liste'], '.overlay .modal');
        return c.zone('.overlay .modal', 20);
      } },
    ],
  },

  // ───────────────────────────────────────── Changer la devise
  {
    id: 'dem-changer-devise',
    etapes: [
      // Étapes 2 à 4 : la liste « Devise » (2), l'encadré « Devise non appliquée. » qui apparaît (3) et « Convertir les montants » (4).
      { nom: 'devise', ecran: 'bureau', async jouer(c) {
        await ouvrirCompte(c);
        await c.ev("(() => { const s = document.getElementById('acc-devise'); s.value = 'XPF'; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('#view-root .compte-page .ui-section').setAttribute('data-aide', 'societe'); return true; })()");
        await c.dort(500);
        await c.attendre('#acc-devise-appliquer');
        await c.marquer('#acc-devise', 'devise', '.ui-champ-groupe');
        await c.repere('[data-aide="devise"]', 2, { marge: 6, cote: 'gauche-centre' });
        await c.repere('#acc-devise-bloc', 3, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#acc-devise-appliquer', 4, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['[data-aide="devise"]', '#acc-devise-bloc', '#acc-devise-appliquer'], '[data-aide="societe"]');
        return c.zoneJusqua('[data-aide="societe"]', '#acc-devise-appliquer', 30);
      } },
    ],
  },

  // ───────────────────────────────────────── Changer son adresse e-mail de connexion
  {
    id: 'dem-changer-email',
    etapes: [
      // Étapes 1 à 4 : l'adresse actuelle (1), « Nouvel e-mail de connexion » (2), « Confirmer par mot de passe actuel » (3), « Mettre à jour l'e-mail » (4).
      { nom: 'identifiants', ecran: 'bureau', async jouer(c) {
        await ouvrirCompte(c);
        await c.ev("(() => { const e = document.getElementById('acc-email'); e.value = 'nouvelle.adresse@exemple.fr'; const p = document.getElementById('acc-password'); p.value = 'exemple-mot-de-passe'; e.closest('.ui-section').setAttribute('data-aide', 'identifiants'); e.closest('.ui-section').querySelector('.ui-champ-groupe').setAttribute('data-aide', 'actuel'); return true; })()");
        await c.marquer('#acc-email', 'nouvel', '.ui-champ-groupe');
        await c.marquer('#acc-password', 'mdp', '.ui-champ-groupe');
        await c.voir('[data-aide="identifiants"]', 'start');
        await c.dort(300);
        await c.repere('[data-aide="actuel"]', 1, { marge: 6, cote: 'gauche-centre' });
        await c.repere('[data-aide="nouvel"]', 2, { marge: 6, cote: 'gauche-centre' });
        await c.repere('[data-aide="mdp"]', 3, { marge: 6, cote: 'droite' });
        await c.repere('#acc-save-email', 4, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['[data-aide="actuel"]', '[data-aide="nouvel"]', '[data-aide="mdp"]', '#acc-save-email'], '[data-aide="identifiants"]');
        return c.zone('[data-aide="identifiants"]', 34);
      } },
    ],
  },

  // ───────────────────────────────────────── Supprimer mon compte
  {
    id: 'dem-supprimer-compte',
    etapes: [
      // Étapes 1 et 2 : la section « Zone sensible » (1) et « Supprimer mon compte » (2).
      { nom: 'zone-sensible', ecran: 'bureau', async jouer(c) {
        await ouvrirCompte(c);
        await c.ev("document.getElementById('acc-supprimer').closest('.ui-section').setAttribute('data-aide', 'zone'); true");
        await c.voir('[data-aide="zone"]', 'center');
        await c.dort(300);
        await c.repere('[data-aide="zone"] .ui-section-tete', 1, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#acc-supprimer', 2, { marge: 5, cote: 'droite' });
        await toutDansLaZone(c, ['[data-aide="zone"] .ui-section-tete', '#acc-supprimer'], '[data-aide="zone"]');
        return c.zone('[data-aide="zone"]', 34);
      } },
      // Étape 3 : la fenêtre quand vous êtes seul dans la société — ce qui sera effacé et l'avertissement sur l'abonnement.
      { nom: 'fenetre-seul', ecran: 'bureau', async jouer(c) {
        await ouvrirSuppression(c, false);
        await englober(c, '.suppr-liste', '.suppr-alerte', 'liste');
        await c.repere('[data-aide="liste"]', 3, { marge: 6, cote: 'gauche-centre' });
        await toutDansLaZone(c, ['[data-aide="liste"]'], '.suppr-compte-modal .modal');
        return c.zone('.suppr-compte-modal .modal', 34);
      } },
      // Étapes 3 à 5 : quand d'autres membres utilisent la société — seul le compte est supprimé, pas d'avertissement d'abonnement ; le mot SUPPRIMER est tapé (4), le bouton s'active (5).
      { nom: 'fenetre-membres', ecran: 'bureau', async jouer(c) {
        await ouvrirSuppression(c, true);
        await c.ev("(() => { const m = document.getElementById('suppr-mot'); m.value = m.placeholder; m.dispatchEvent(new Event('input', { bubbles: true })); document.activeElement && document.activeElement.blur(); return true; })()");
        await c.dort(300);
        await c.repere('.suppr-liste', 3, { marge: 6, cote: 'gauche-centre' });
        await c.repere('#suppr-mot', 4, { marge: 5, cote: 'gauche-centre' });
        await c.repere('#suppr-confirmer', 5, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['.suppr-liste', '#suppr-mot', '#suppr-confirmer'], '.suppr-compte-modal .modal');
        return c.zone('.suppr-compte-modal .modal', 34);
      } },
    ],
  },

  // ───────────────────────────────────────── Notifications push : qui est prévenu
  {
    id: 'dem-push-qui-est-prevenu',
    etapes: [
      // Étapes 2 à 4 : la case « Activer les notifications push pour cette société » (2), une ligne par droit (3) et « Enregistrer le ciblage » (4). On part sous le texte d'introduction de la section.
      { nom: 'ciblage', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('reminders'); true");
        await c.attendre('#push-cible-actif');
        await c.dort(900);
        await c.ev("document.getElementById('push-cible-actif').closest('.ui-section').setAttribute('data-aide', 'push'); true");
        await c.marquer('#push-cible-actif', 'case', '.check-row');
        await c.marquer('#push-role-gerant', 'role-debut', '.ui-groupe');
        await c.marquer('#push-cible-save', 'enregistrer');
        await c.ev("(() => { const g = [...document.querySelectorAll('[data-aide=\"push\"] .ui-groupe')]; g[g.length - 1].setAttribute('data-aide', 'role-fin'); return true; })()");
        await c.voir('[data-aide="case"]', 'start');
        await c.ev('window.scrollBy(0, -70); true');
        await c.dort(300);
        await englober(c, '[data-aide="role-debut"]', '[data-aide="role-fin"]', 'roles');
        await c.repere('[data-aide="case"]', 2, { marge: 6, cote: 'gauche-centre' });
        await c.repere('[data-aide="roles"]', 3, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#push-cible-save', 4, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['[data-aide="case"]', '[data-aide="roles"]', '#push-cible-save'], '[data-aide="push"]');
        return c.zoneJusqua('[data-aide="case"]', '#push-cible-save', 44);
      } },
    ],
  },

  // ───────────────────────────────────────── Je ne vois pas un écran ou un bouton
  {
    id: 'dem-je-ne-vois-pas',
    etapes: [
      // Étape 1 : la phrase « Ton accès : … » de la carte « Gestion de l'équipe », telle que la voit un droit de gestion.
      { nom: 'acces', ecran: 'bureau', async jouer(c) {
        await c.ev("UI.role = 'mecanicien'; goTo('account'); true");
        await c.attendre('#view-root .compte-page .ui-section');
        await c.dort(900);
        await c.ev("(() => { const re = /Ton accès|Your access/i; const f = [...document.querySelectorAll('#view-root .compte-page *')].filter((e) => !e.children.length && re.test(e.textContent)); if (!f.length) throw new Error('phrase « Ton accès » absente'); f[0].setAttribute('data-aide', 'acces'); f[0].closest('.ui-section').setAttribute('data-aide', 'equipe'); return true; })()");
        await c.voir('[data-aide="equipe"]', 'center');
        await c.dort(300);
        await c.repere('[data-aide="acces"]', 1, { marge: 6, cote: 'gauche-centre' });
        await toutDansLaZone(c, ['[data-aide="acces"]'], '[data-aide="equipe"]');
        return c.zone('[data-aide="equipe"]', 34);
      } },
    ],
  },
];

// Compte sans aucune machine : l'écran demandé s'affiche vide.
async function ouvrirParcVide(c, vue) {
  await c.ev("UI.machines = []; UI.machinesArchivees = []; goTo('" + vue + "'); true");
  await c.dort(900);
}
// Ouvre la fenêtre « Supprimer mon compte » — seul dans la société (offre payante : avertissement sur l'abonnement) ou avec d'autres membres.
async function ouvrirSuppression(c, avecMembres) {
  await ouvrirCompte(c);
  // Le flou de l'arrière-plan laisse deviner la ligne d'offre (prix) : on la remplace par le seul nom de l'offre.
  await c.ev("(() => { const b = document.getElementById('account-upgrade'); if (b) { const l = b.closest('.ui-ligne'); l.querySelector('.ui-ligne-nom').textContent = OFFRES_LIBELLES.enterprise; l.querySelectorAll('.ui-aide').forEach((n) => n.remove()); } return true; })()");
  if (avecMembres) await c.ev("sb.rpc = async (nom) => (nom === 'equipe_pour_attribution' ? { data: [{ id: 'demo-utilisateur' }, { id: 'autre-membre' }], error: null } : { data: [], error: null }); true");
  await c.ev("document.getElementById('acc-supprimer').click(); true");
  await c.attendre('#suppr-mot');
  await c.dort(700);
  await c.ev('document.activeElement && document.activeElement.blur(); true');
}

// Ouvre la fenêtre « Mot de passe oublié » depuis l'écran de connexion, avec une adresse d'exemple.
async function ouvrirOubli(c) {
  await fondClair(c);
  await c.ev('renderLogin(); true');
  await c.attendre('#open-forgot');
  await c.ev("document.getElementById('open-forgot').click(); true");
  await c.attendre('#forgot-form');
  await c.dort(600);
  await c.ev("(() => { const e = document.getElementById('forgot-email'); e.value = 'camille@exemple.fr'; document.activeElement && document.activeElement.blur(); return true; })()");
  await c.dort(200);
}
// Affiche l'écran « Vérifie ton email » de l'inscription (le serveur est simulé : « code envoyé »).
async function ouvrirCodeInscription(c) {
  await ouvrirInscription(c);
  await c.ev("(() => { sb.auth.signUp = async () => ({ data: { user: { identities: [{}] } }, error: null }); document.getElementById('signup-form').requestSubmit(); return true; })()");
  await c.attendre('#su-code');
  await c.dort(700);
  await c.ev('document.activeElement && document.activeElement.blur(); true');
}

// Ouvre la fenêtre « Les offres KALEA » pour une société sur l'offre gratuite (ses cartes montrent donc « Ton offre actuelle » et des boutons « Passer à … »).
async function ouvrirOffres(c) {
  // Une seule machine : sous le plafond de l'offre gratuite, la fenêtre s'ouvre en simple consultation (« Choisis ton offre »), sans annoncer de limite chiffrée.
  await c.ev("UI.companyPlan = 'free'; UI.company.plan = 'free'; UI.machines = UI.machines.slice(0, 1); goTo('dashboard'); true");
  await c.dort(500);
  await c.ev("openUpgradeNotice(UI.companyId); true");
  await c.attendre('.offres-grille .offre-carte-pied');
  await c.ev('document.activeElement && document.activeElement.blur(); true');
  await c.dort(900);
}
// Écran de connexion et inscription : toujours en thème clair, quel que soit le réglage mémorisé par un autre scénario.
async function fondClair(c) {
  await c.ev("try { localStorage.removeItem('kalea.theme'); } catch (e) {} document.documentElement.removeAttribute('data-theme'); true");
}
// Ouvre la feuille « Plus » (le parc fictif n'ayant pas le Stock au démarrage, on l'active : la ligne « Stocks & SAV » existe pour un compte qui le possède).
async function ouvrirFeuillePlus(c) {
  await c.ev("SCHEMA.hasStock = true; UI.companyName = '" + (c.langue === 'en' ? 'Demo Company' : 'Société Démo') + "'; goTo('dashboard'); true");
  await c.attendre('#open-plus');
  await c.dort(500);
  await c.ev("document.getElementById('open-plus').click(); true");
  await c.attendre('.plus-sheet');
  await c.dort(900);
  await c.ev("(() => { const s = [...document.querySelectorAll('.plus-sheet-section')]; s[0].setAttribute('data-aide', 'parc'); s[1].setAttribute('data-aide', 'compte'); return true; })()");
}
// Ouvre la fenêtre « Créer un compte » depuis l'écran de connexion, remplie avec des données d'exemple ; l'encadré des offres (prix) est masqué.
async function ouvrirInscription(c) {
  await fondClair(c);
  await c.ev('renderLogin(); true');
  await c.attendre('#open-signup');
  await c.ev("document.getElementById('open-signup').click(); true");
  await c.attendre('#signup-form');
  await c.dort(700);
  await c.ev("document.querySelectorAll('.signup-modal .callout').forEach((n, i) => { if (/€|machine/i.test(n.textContent)) n.style.display = 'none'; }); true");
  await c.ev("(() => { const f = (id, v) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } }; f('su-name', 'ATELIER DU LAGON'); f('su-contact-first', 'Camille'); f('su-contact-last', 'MARTIN'); f('su-email', 'camille@exemple.fr'); f('su-password', 'exemple-mot-de-passe'); f('su-phone', '0612345678'); return true; })()");
  await c.ev('document.activeElement && document.activeElement.blur(); true');
  await c.dort(300);
}
