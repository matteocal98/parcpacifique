/* KALEA — pages publiques : bouton de thème (Auto → Clair → Sombre), posé juste après le sélecteur de langue.
 * S'appuie sur theme.js (chargé dans l'en-tête) : window.kaleaTheme. Sans lui ou sans sélecteur de langue, ne fait rien.
 */
(function () {
  'use strict';
  function monter() {
    var T = window.kaleaTheme; if (!T) return;
    // Pages publiques : juste après le sélecteur FR/EN. Console d'administration (admin.html) : à l'endroit repéré par data-theme-ancre.
    var lien = document.querySelector('[data-langue]');
    var pointAdmin = document.querySelector('[data-theme-ancre]');
    if (!(lien && lien.parentNode) && !pointAdmin) return;
    var ancre = lien && lien.parentNode ? lien.parentNode : pointAdmin;
    var en = (document.documentElement.getAttribute('lang') || 'fr').indexOf('en') === 0;
    var ORDRE = ['auto', 'clair', 'sombre'];
    var ICONES = {
      auto: '<path d="M12 3a9 9 0 1 0 0 18V3z" fill="currentColor"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>',
      clair: '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      sombre: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    };
    var NOMS = { auto: en ? 'Auto' : 'Auto', clair: en ? 'Light' : 'Clair', sombre: en ? 'Dark' : 'Sombre' };
    var st = document.createElement('style');
    st.textContent = 'header a[href*="app.html"]{white-space:nowrap}@media(min-width:1024px) and (max-width:1439px){header nav.lg\\:flex{gap:1.1rem!important;font-size:13px}header nav.lg\\:flex a{white-space:nowrap}header a[aria-label]>span{font-size:2.25rem!important}header a[aria-label]>div{width:3.5rem!important;height:3.5rem!important}}@media(min-width:1024px) and (max-width:1179px){header a[href$="app.html"]{display:none!important}}@media(max-width:639px){.theme-bascule{width:30px!important;height:30px!important}header a[aria-label]>div{width:40px!important;height:40px!important}header a[aria-label]>span{font-size:24px!important}header a[aria-label]{gap:.4rem!important}header a[href*="app.html?inscription"]{padding:.5rem .7rem!important;font-size:13px!important}}';
    document.head.appendChild(st);
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'theme-bascule';
    b.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;margin-left:0;border-radius:10px;border:1px solid rgba(128,128,150,.35);background:transparent;color:inherit;cursor:pointer;padding:0;flex:none';
    function dessiner() {
      var c = T.lire();
      b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">' + ICONES[c] + '</svg>';
      var txt = (en ? 'Theme: ' : 'Thème : ') + NOMS[c] + (en ? ' (click to change)' : ' (cliquer pour changer)');
      b.title = txt; b.setAttribute('aria-label', txt);
    }
    b.addEventListener('click', function () { T.definir(ORDRE[(ORDRE.indexOf(T.lire()) + 1) % 3]); dessiner(); });
    dessiner();
    ancre.parentNode.insertBefore(b, ancre.nextSibling);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter); else monter();
})();
