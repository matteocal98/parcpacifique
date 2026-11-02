/* KALEA — page d'accueil : accroches tournantes (titre + sous-titre qui changent).
 *
 * Le HTML contient toutes les accroches, empilées dans la même cellule ; la première est le <h1> de la page (lu par les moteurs de recherche et par les visiteurs sans
 * JavaScript). Ce script fait défiler les autres, en fondu, et ajoute les commandes : un point par accroche, et un bouton pause.
 *
 * Accessibilité :
 *   · un seul titre de niveau 1 est exposé aux lecteurs d'écran à la fois (les accroches masquées portent aria-hidden) ;
 *   · le défilement s'arrête au survol, quand le clavier est dans la zone, quand l'onglet est caché, et à la demande (bouton pause : une animation automatique qui dure plus de
 *     5 secondes doit pouvoir être arrêtée) ;
 *   · si l'appareil demande moins d'animations (prefers-reduced-motion), rien ne défile tout seul : la première accroche reste, les points restent utilisables.
 * Les textes anglais ne sont pas ici : la page anglaise est générée avec les mêmes accroches traduites (outils/generer-pages-publiques.mjs).
 */
(function () {
  'use strict';

  var conteneur = document.querySelector('[data-accroches]');
  if (!conteneur) return;
  var slides = Array.prototype.slice.call(conteneur.querySelectorAll('[data-accroche]'));
  if (slides.length < 2) return;
  var pilote = document.querySelector('[data-accroches-pilote]');

  var anglais = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var T = anglais
    ? { groupe: 'Headlines', point: function (i, n) { return 'Headline ' + (i + 1) + ' of ' + n; }, pause: 'Pause the headlines', lecture: 'Resume the headlines' }
    : { groupe: 'Accroches', point: function (i, n) { return 'Accroche ' + (i + 1) + ' sur ' + n; }, pause: 'Mettre les accroches en pause', lecture: 'Relancer les accroches' };

  var DUREE = 7000;
  var reduit = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var courant = 0;
  var minuteur = null;
  var enPause = reduit;   // qui demande moins d'animations ne voit rien défiler tout seul
  var survol = false;
  var points = [];
  var boutonPause = null;

  var ICONE_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  var ICONE_LECTURE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';

  function afficher(i) {
    slides.forEach(function (s, k) {
      var actif = k === i;
      s.classList.toggle('is-actif', actif);
      if (actif) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      // La 1re accroche est un vrai <h1> ; les autres sont des paragraphes qui ne deviennent « titre de niveau 1 » que le temps où elles sont affichées.
      var titre = s.querySelector('[data-titre]');
      if (titre && k !== 0) {
        if (actif) { titre.setAttribute('role', 'heading'); titre.setAttribute('aria-level', '1'); }
        else { titre.removeAttribute('role'); titre.removeAttribute('aria-level'); }
      }
    });
    points.forEach(function (p, k) { p.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    courant = i;
  }

  function arreter() { if (minuteur) { clearTimeout(minuteur); minuteur = null; } }
  function planifier() {
    arreter();
    if (enPause || survol || document.hidden) return;
    minuteur = setTimeout(function () { afficher((courant + 1) % slides.length); planifier(); }, DUREE);
  }

  function majBoutonPause() {
    if (!boutonPause) return;
    boutonPause.innerHTML = enPause ? ICONE_LECTURE : ICONE_PAUSE;
    boutonPause.setAttribute('aria-label', enPause ? T.lecture : T.pause);
    boutonPause.setAttribute('aria-pressed', enPause ? 'true' : 'false');
  }

  // Les commandes : un point par accroche + pause.
  if (pilote) {
    pilote.setAttribute('aria-label', T.groupe);
    slides.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', T.point(i, slides.length));
      b.innerHTML = '<span class="accroche-point"></span>';
      b.addEventListener('click', function () { afficher(i); planifier(); });
      pilote.appendChild(b);
      points.push(b);
    });
    boutonPause = document.createElement('button');
    boutonPause.type = 'button';
    boutonPause.className = 'accroche-pause';
    boutonPause.addEventListener('click', function () { enPause = !enPause; majBoutonPause(); planifier(); });
    pilote.appendChild(boutonPause);
    majBoutonPause();
  }

  // Pause au survol et quand le clavier est dans la zone ; reprise à la sortie.
  var zone = conteneur.parentElement || conteneur;
  zone.addEventListener('mouseenter', function () { survol = true; arreter(); });
  zone.addEventListener('mouseleave', function () { survol = false; planifier(); });
  zone.addEventListener('focusin', function () { survol = true; arreter(); });
  zone.addEventListener('focusout', function () { survol = false; planifier(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) arreter(); else planifier(); });

  afficher(0);
  planifier();
}());
