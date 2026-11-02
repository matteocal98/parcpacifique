/* KALEA — page d'accueil du centre d'aide : filtre les articles pendant la frappe.
 * Chaque article porte son texte de recherche (titre + description, sans accents ni majuscules) dans data-recherche ; chaque thème est une <section data-theme-aide>.
 * Sans JavaScript la page reste complète : le champ de recherche est simplement masqué (il porte l'attribut hidden tant que ce script ne l'a pas affiché). */
(function () {
  'use strict';
  var champ = document.getElementById('aide-recherche');
  if (!champ) return;
  var boite = document.getElementById('aide-recherche-boite');
  var etat = document.getElementById('aide-recherche-etat');
  var vide = document.getElementById('aide-recherche-vide');
  var articles = Array.prototype.slice.call(document.querySelectorAll('[data-recherche]'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-theme-aide]'));
  var anglais = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;

  function normaliser(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function compter(n) {
    if (anglais) return n + (n === 1 ? ' article found' : ' articles found');
    return n + (n > 1 ? ' articles trouvés' : ' article trouvé');
  }
  function filtrer() {
    var mots = normaliser(champ.value).split(' ').filter(Boolean);
    var trouves = 0;
    articles.forEach(function (a) {
      var texte = a.getAttribute('data-recherche');
      var ok = mots.every(function (m) { return texte.indexOf(m) !== -1; });
      a.hidden = !ok;
      if (ok) trouves++;
    });
    sections.forEach(function (s) {
      s.hidden = !s.querySelector('[data-recherche]:not([hidden])');
    });
    if (vide) vide.hidden = !(mots.length && !trouves);
    if (etat) etat.textContent = mots.length ? compter(trouves) : '';
  }
  champ.addEventListener('input', filtrer);
  champ.addEventListener('keydown', function (e) { if (e.key === 'Escape') { champ.value = ''; filtrer(); } });
  if (boite) boite.hidden = false;
  filtrer();
}());
