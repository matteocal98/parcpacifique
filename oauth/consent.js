// KALEA — page « Autoriser une connexion » (OAuth 2.1, Supabase Auth). ESSAI DE FAISABILITÉ du connecteur Claude / ChatGPT (2026-10-25).
//
// Supabase redirige ici avec ?authorization_id=… quand un outil (Claude, ChatGPT) demande l'accès à un compte KALEA. La personne :
//   1. se connecte si elle ne l'est pas déjà (même session que l'application : même origine, même client Supabase) ;
//   2. voit QUI demande l'accès et CE QUE cela permet ;
//   3. accepte ou refuse. Elle pourra révoquer plus tard (écran « Mon compte », à venir).
// Sécurité : tout texte venant de la demande (nom du client, adresse de retour) est affiché avec textContent, jamais en HTML ; la redirection
// finale n'accepte que http(s). Cette page ne stocke rien et n'appelle que les trois méthodes OAuth de Supabase.

(function () {
  const SUPABASE_URL = 'https://tiayvmnodsbygmuemeuy.supabase.co';
  const SUPABASE_KEY = 'sb_publishable__D5hSUJPHa9BQVrKzN2oqA_SlmhqDRg';
  const DOMAINE_MEMBRES = 'membres.keeva.work'; // identifiant atelier sans arobase → adresse interne (comme l'application)

  const EN = /^en/i.test(navigator.language || '');
  const T = (fr, en) => (EN ? en : fr);
  const carte = document.getElementById('carte');
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const authorizationId = new URLSearchParams(location.search).get('authorization_id');

  function vider() { while (carte.firstChild) carte.removeChild(carte.firstChild); }
  function el(tag, props, enfants) {
    const n = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v); });
    (enfants || []).forEach((c) => n.appendChild(c));
    return n;
  }
  function entete(titre) {
    vider();
    carte.appendChild(el('div', { class: 'marque', text: 'KALEA' }));
    carte.appendChild(el('h1', { text: titre }));
  }
  function message(texte, erreur) {
    let m = document.getElementById('msg');
    if (!m) { m = el('div', { class: 'msg', id: 'msg', role: 'status' }); carte.appendChild(m); }
    m.className = 'msg' + (erreur ? ' err' : '');
    m.textContent = texte || '';
  }
  function erreurFatale(texte) {
    entete(T('Connexion impossible', 'Connection not possible'));
    carte.appendChild(el('p', { text: texte }));
  }
  function suivre(url) {
    let cible;
    try { cible = new URL(url); } catch (e) { return erreurFatale(T('Adresse de retour invalide.', 'Invalid return address.')); }
    if (cible.protocol !== 'https:' && cible.protocol !== 'http:') return erreurFatale(T('Adresse de retour refusée.', 'Return address refused.'));
    window.location.href = cible.href;
  }

  // ── 1. connexion (si la personne n'est pas déjà connectée dans KALEA) ──
  function ecranConnexion() {
    entete(T('Connectez-vous à KALEA', 'Sign in to KALEA'));
    carte.appendChild(el('p', { text: T('Pour autoriser cette connexion, identifiez-vous d\'abord.', 'To authorize this connection, sign in first.') }));
    const id = el('input', { id: 'id', type: 'text', autocomplete: 'username', autocapitalize: 'none' });
    const mdp = el('input', { id: 'mdp', type: 'password', autocomplete: 'current-password' });
    const ok = el('button', { class: 'oui', type: 'button', text: T('Se connecter', 'Sign in') });
    carte.appendChild(el('label', { for: 'id', text: T('E-mail ou identifiant atelier', 'E-mail or workshop login') }));
    carte.appendChild(id);
    carte.appendChild(el('label', { for: 'mdp', text: T('Mot de passe', 'Password') }));
    carte.appendChild(mdp);
    carte.appendChild(el('div', { class: 'boutons' }, [ok]));
    message('');
    const envoyer = async () => {
      const saisie = id.value.trim().toLowerCase();
      if (!saisie || !mdp.value) { message(T('Saisissez votre identifiant et votre mot de passe.', 'Enter your login and password.'), true); return; }
      ok.disabled = true;
      const email = saisie.includes('@') ? saisie : saisie + '@' + DOMAINE_MEMBRES;
      const { error } = await sb.auth.signInWithPassword({ email, password: mdp.value });
      if (error) { ok.disabled = false; message(T('Identifiants incorrects.', 'Incorrect login or password.'), true); return; }
      demarrer();
    };
    ok.addEventListener('click', envoyer);
    mdp.addEventListener('keydown', (e) => { if (e.key === 'Enter') envoyer(); });
  }

  // ── 2. consentement ──
  function ecranConsentement(details) {
    entete(T('Autoriser cette connexion ?', 'Authorize this connection?'));
    const nomClient = (details.client && details.client.name) || T('Une application', 'An application');
    let hote = '';
    try { hote = new URL(details.redirect_uri).host; } catch (e) { hote = ''; }
    carte.appendChild(el('p', { text: T('Cette application demande l\'accès à votre compte KALEA :', 'This application is requesting access to your KALEA account:') }));
    carte.appendChild(el('div', { class: 'client' }, [el('strong', { text: nomClient }), el('small', { text: hote ? T('Retour vers : ', 'Returns to: ') + hote : '' })]));
    carte.appendChild(el('p', { text: T('Elle pourra, en lecture seule et avec VOS droits (votre rôle et l\'offre de votre société) :', 'It will be able to, read-only and with YOUR rights (your role and your company plan):') }));
    const liste = el('ul', {}, [
      el('li', { text: T('consulter vos machines, échéances d\'entretien et interventions ;', 'view your machines, maintenance due dates and interventions;') }),
      el('li', { text: T('consulter le stock sous le seuil, si votre rôle et votre offre le permettent ;', 'view low stock, if your role and plan allow it;') }),
      el('li', { text: T('consulter les coûts, uniquement si vous y avez droit dans KALEA.', 'view costs, only if you have the right to in KALEA.') }),
    ]);
    carte.appendChild(liste);
    carte.appendChild(el('div', { class: 'avert', text: T('Elle ne pourra rien modifier, ni créer, ni supprimer. Vous pourrez retirer cet accès à tout moment.', 'It will not be able to change, create or delete anything. You can remove this access at any time.') }));
    const oui = el('button', { class: 'oui', type: 'button', text: T('Autoriser', 'Authorize') });
    const non = el('button', { class: 'non', type: 'button', text: T('Refuser', 'Deny') });
    carte.appendChild(el('div', { class: 'boutons' }, [non, oui]));
    message('');
    const decider = async (accepter) => {
      oui.disabled = true; non.disabled = true;
      const { data, error } = accepter
        ? await sb.auth.oauth.approveAuthorization(authorizationId)
        : await sb.auth.oauth.denyAuthorization(authorizationId);
      if (error || !data || !data.redirect_url) { oui.disabled = false; non.disabled = false; message(T('Une erreur est survenue. Réessayez.', 'An error occurred. Please try again.'), true); return; }
      suivre(data.redirect_url);
    };
    oui.addEventListener('click', () => decider(true));
    non.addEventListener('click', () => decider(false));
  }

  // ── 3. déroulement ──
  async function demarrer() {
    if (!authorizationId) return erreurFatale(T('Demande d\'autorisation introuvable. Relancez la connexion depuis votre outil.', 'Authorization request not found. Restart the connection from your tool.'));
    const { data: session } = await sb.auth.getSession();
    if (!session || !session.session) return ecranConnexion();

    // Offre : le connecteur est réservé à Business et Enterprise (le serveur le vérifie aussi à chaque appel).
    try {
      const { data: profil } = await sb.rpc('connecteur_profil');
      const offre = profil && profil[0] && profil[0].offre;
      if (offre && !['business', 'enterprise'].includes(offre)) {
        const { data: refus } = await sb.auth.oauth.denyAuthorization(authorizationId);
        entete(T('Connecteur non disponible', 'Connector not available'));
        carte.appendChild(el('p', { text: T('Le connecteur est disponible à partir de l\'offre Business. Votre offre actuelle ne le permet pas.', 'The connector is available from the Business plan. Your current plan does not include it.') }));
        if (refus && refus.redirect_url) carte.appendChild(el('p', { text: T('Vous pouvez fermer cette page.', 'You can close this page.') }));
        return;
      }
    } catch (e) { /* la fonction n'existe pas encore : on laisse la personne décider, le serveur filtrera */ }

    const { data, error } = await sb.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || !data) return erreurFatale(T('Cette demande n\'est plus valable. Relancez la connexion depuis votre outil.', 'This request is no longer valid. Restart the connection from your tool.'));
    // Déjà autorisée auparavant : retour direct.
    if (!data.authorization_id && data.redirect_url) return suivre(data.redirect_url);
    ecranConsentement(data);
  }

  demarrer().catch(() => erreurFatale(T('Une erreur est survenue.', 'An error occurred.')));
})();
