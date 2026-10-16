/* KALEA — pages publiques : sélecteur de langue FR / EN.
 *
 * Les deux langues sont deux pages distinctes (/ et /en/), avec des liens ordinaires que Google peut suivre.
 * Ce script ne fait qu'une chose : mémoriser le choix du visiteur quand il clique sur FR ou EN, avec la même clé que
 * l'application (parcpacific.langue), pour que l'appli s'ouvre ensuite dans la langue choisie.
 */
(function () {
  'use strict';
  document.addEventListener('click', function (ev) {
    var lien = ev.target.closest && ev.target.closest('a[data-langue]');
    if (!lien) return;
    try { localStorage.setItem('parcpacific.langue', lien.getAttribute('data-langue')); } catch (err) { /* stockage indisponible : sans conséquence */ }
  });
})();
