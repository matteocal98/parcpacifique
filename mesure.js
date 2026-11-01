/* Mesure d'audience de kalea.pro — SANS cookie, SANS rien écrire dans le navigateur (ni localStorage, ni sessionStorage).
   1. Une page vue = un appel à marketing_noter_visite (voir kalea-serveur/migrations/marketing-mesure-et-contacts.sql) : chemin de la page, origine
      (liens suivis utm_*, site d'où l'on vient), langue. L'adresse IP et le navigateur ne servent qu'à calculer, côté serveur, une empreinte du jour
      qui est effacée le lendemain ; rien d'identifiant n'est conservé.
   2. L'origine suit le visiteur SANS stockage : quand l'adresse contient utm_* (ou qu'on vient d'un autre site), on l'ajoute aux liens internes et aux
      liens vers l'appli. À l'inscription, l'appli lit ces paramètres et note l'origine de la société (marketing_noter_origine).
   Respecte « Ne pas me suivre ». Ne compte rien hors de kalea.pro (essais locaux), ni les navigateurs pilotés par un programme. */
(function () {
  'use strict';
  var URL_API = 'https://tiayvmnodsbygmuemeuy.supabase.co/rest/v1/rpc/marketing_noter_visite';
  var CLE = 'sb_publishable__D5hSUJPHa9BQVrKzN2oqA_SlmhqDRg';   // clé PUBLIQUE (la même que dans l'appli) : elle ne donne accès qu'à ce que les règles de sécurité autorisent
  var HOTES = { 'kalea.pro': 1, 'www.kalea.pro': 1 };
  var PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'ref'];

  try {
    if (!HOTES[location.hostname]) return;
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.webdriver === true) return;

    var courant = new URLSearchParams(location.search);
    var contexte = {};
    PARAMS.forEach(function (n) {
      var v = courant.get(n);
      if (v) contexte[n] = v.slice(0, 60);
    });

    // Le site d'où l'on vient (nom de domaine seul) ; un lien de notre propre site n'est pas une origine.
    var referent = '';
    try {
      if (document.referrer) {
        var h = new URL(document.referrer).hostname.replace(/^www\./, '');
        if (h && !HOTES[h] && !/\.kalea\.pro$/.test(h)) referent = h;
      }
    } catch (e) { /* adresse illisible : pas d'origine */ }
    if (!contexte.utm_source && !contexte.ref && referent) contexte.ref = referent;

    function envoyer() {
      var corps = JSON.stringify({
        p_page: location.pathname,
        p_source: contexte.utm_source || null,
        p_medium: contexte.utm_medium || null,
        p_campagne: contexte.utm_campaign || null,
        p_referent: contexte.ref || referent || null,
        p_langue: document.documentElement.lang === 'en' ? 'en' : 'fr'
      });
      fetch(URL_API, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CLE }, body: corps, keepalive: true, credentials: 'omit' })
        .catch(function () { /* la mesure ne doit JAMAIS gêner la page */ });
    }
    if (document.prerendering) document.addEventListener('prerenderingchange', envoyer, { once: true });
    else envoyer();

    // Faire suivre l'origine aux liens internes et vers l'appli (jamais de stockage : tout passe par l'adresse).
    if (!Object.keys(contexte).length) return;
    var FICHIERS = /\.(png|jpe?g|webp|svg|gif|ico|pdf|mp4|webm|xml|txt|css|js|json|woff2?)$/i;
    function decorer(a) {
      try {
        var href = a.getAttribute('href');
        if (!href || href.charAt(0) === '#' || a.hasAttribute('download')) return;
        var u = new URL(a.href, location.href);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
        if (u.origin !== location.origin && !HOTES[u.hostname]) return;
        if (FICHIERS.test(u.pathname)) return;
        var change = false;
        PARAMS.forEach(function (n) {
          if (contexte[n] && !u.searchParams.has(n)) { u.searchParams.set(n, contexte[n]); change = true; }
        });
        if (change) a.href = u.toString();
      } catch (e) { /* lien illisible : laissé tel quel */ }
    }
    function toutDecorer() { Array.prototype.forEach.call(document.querySelectorAll('a[href]'), decorer); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', toutDecorer); else toutDecorer();
    // Liens ajoutés plus tard (vidéos, sélecteurs) : on les prépare juste avant le clic.
    ['click', 'auxclick', 'contextmenu', 'touchstart', 'keydown'].forEach(function (nom) {
      document.addEventListener(nom, function (ev) {
        var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
        if (a) decorer(a);
      }, true);
    });
  } catch (e) { /* la mesure ne doit JAMAIS gêner la page */ }
}());
