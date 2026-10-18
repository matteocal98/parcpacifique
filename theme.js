/* KALEA — thème de l'interface : Auto (suit le téléphone / l'ordinateur), Clair ou Sombre.
 *
 * Chargé dans l'EN-TÊTE de app.html, avant le premier affichage : le thème est posé sur <html> avant que la page ne se
 * dessine (sinon un éclair blanc précède le thème sombre). Le CSS ne regarde QU'UN attribut : html[data-theme="dark"] ou
 * "light" — jamais le réglage « auto », déjà résolu ici. Le choix est mémorisé (localStorage « kalea.theme ») :
 * 'auto' (défaut), 'clair' ou 'sombre'. La palette sombre est en fin de kit.css (bloc « THÈME SOMBRE »).
 */
(function () {
  'use strict';
  var CLE = 'kalea.theme';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function lire() {
    try { var v = localStorage.getItem(CLE); return v === 'clair' || v === 'sombre' ? v : 'auto'; } catch (e) { return 'auto'; }
  }
  function resolu(choix) {
    return choix === 'sombre' || (choix === 'auto' && mq && mq.matches) ? 'dark' : 'light';
  }
  function appliquer() {
    var r = resolu(lire());
    var h = document.documentElement;
    h.setAttribute('data-theme', r);
    h.style.colorScheme = r;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', r === 'dark' ? '#080B1A' : '#0D1424');
    try { document.dispatchEvent(new CustomEvent('kalea-theme', { detail: { theme: r } })); } catch (e) { /* ancien navigateur */ }
  }
  window.kaleaTheme = {
    lire: lire,
    resolu: function () { return resolu(lire()); },
    definir: function (choix) {
      try { if (choix === 'auto') localStorage.removeItem(CLE); else localStorage.setItem(CLE, choix); } catch (e) { /* stockage indisponible */ }
      appliquer();
    },
  };
  if (mq) { var suivre = function () { if (lire() === 'auto') appliquer(); }; if (mq.addEventListener) mq.addEventListener('change', suivre); else if (mq.addListener) mq.addListener(suivre); }
  appliquer();
})();
