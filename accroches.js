/* KALEA — page d'accueil : accroches tournantes, en « tourbillon » (swirl).
 *
 * Le HTML contient toutes les accroches, empilées dans la même cellule ; la première est le <h1> de la page (lu par les moteurs de recherche et par les visiteurs sans
 * JavaScript). Ce script découpe chaque titre en LETTRES et chaque sous-titre en MOTS, puis les fait basculer en 3D : l'ancien texte et le nouveau sont empilés au même endroit et
 * jouent EN MÊME TEMPS (la lettre n de l'ancien se retourne pendant que la lettre n du nouveau arrive, une lettre toutes les 40 ms) — même déroulé que le titre animé
 * d'Elementor « swirl », réécrit ici. Il ajoute aussi les commandes : un point par accroche et un bouton pause.
 *
 * Accessibilité :
 *   · un seul titre de niveau 1 est exposé aux lecteurs d'écran à la fois (les accroches masquées portent aria-hidden) ; les lettres découpées sont cachées aux lecteurs d'écran
 *     et le titre porte son texte complet dans aria-label (aucun « A-n-t-i-c-i-p-e-z » épelé) ;
 *   · le défilement s'arrête au survol, quand le clavier est dans la zone, quand l'onglet est caché, et à la demande (bouton pause : une animation automatique qui dure plus de
 *     5 secondes doit pouvoir être arrêtée) ;
 *   · si l'appareil demande moins d'animations (prefers-reduced-motion), rien ne défile tout seul et les changements sont instantanés.
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

  var ATTENTE = 6500;                 // temps de lecture, une fois l'accroche entièrement affichée
  var DEBUT = [0x18, 0x68, 0xDB];     // dégradé de marque (#1868DB → #20AFA1), appliqué lettre par lettre : un dégradé CSS ne suit pas les lettres qui basculent en 3D
  var FIN = [0x20, 0xAF, 0xA1];

  var reduit = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var courant = 0;
  var attente = null;                 // minuteur du temps de lecture
  var enCours = [];                   // minuteurs de l'animation en cours (pour pouvoir l'interrompre)
  var enPause = reduit;               // qui demande moins d'animations ne voit rien défiler tout seul
  var survol = false;
  var points = [];
  var boutonPause = null;

  var ICONE_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  var ICONE_LECTURE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';

  // ── Découpage : titre en lettres (groupées par mot, pour que les retours à la ligne se fassent entre les mots), sous-titre en mots ──
  function lettriser(noeud, cible, lettres, degrade) {
    Array.prototype.slice.call(noeud.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        n.nodeValue.split(/(\s+)/).forEach(function (morceau) {
          if (!morceau) return;
          if (/^\s+$/.test(morceau)) { cible.appendChild(document.createTextNode(' ')); return; }
          var mot = document.createElement('span');
          mot.className = 'mot';
          morceau.split('').forEach(function (c) {
            var l = document.createElement('span');
            l.className = 'lettre';
            l.textContent = c;
            mot.appendChild(l);
            lettres.push({ el: l, degrade: degrade });
          });
          cible.appendChild(mot);
        });
      } else if (n.nodeType === 1) {
        var copie = n.cloneNode(false);
        cible.appendChild(copie);
        lettriser(n, copie, lettres, degrade || n.classList.contains('brand-gradient-text'));
      }
    });
  }
  function colorer(lettres) {
    var cibles = lettres.filter(function (l) { return l.degrade; });
    cibles.forEach(function (l, i) {
      var t = cibles.length > 1 ? i / (cibles.length - 1) : 0;
      l.el.style.color = 'rgb(' + [0, 1, 2].map(function (k) { return Math.round(DEBUT[k] + (FIN[k] - DEBUT[k]) * t); }).join(',') + ')';
    });
  }
  function preparer(slide) {
    var titre = slide.querySelector('[data-titre]');
    var sous = titre && titre.nextElementSibling;
    var lettres = [];
    var plein = titre.textContent.replace(/\s+/g, ' ').trim();
    var visuel = document.createElement('span');
    visuel.className = 'acc-visuel';
    visuel.setAttribute('aria-hidden', 'true');
    lettriser(titre, visuel, lettres, false);
    titre.textContent = '';
    titre.appendChild(visuel);
    titre.setAttribute('data-plein', plein);   // le texte complet : donné aux lecteurs d'écran (aria-label) quand ce titre est celui qui s'affiche
    colorer(lettres);
    var mots = [];
    var texteSous = sous ? sous.textContent.replace(/\s+/g, ' ').trim() : '';
    if (sous) {
      sous.textContent = '';
      texteSous.split(' ').forEach(function (m, i) {
        if (i) sous.appendChild(document.createTextNode(' '));
        var e = document.createElement('span');
        e.className = 'mot-anim';
        e.textContent = m;
        sous.appendChild(e);
        mots.push(e);
      });
    }
    slide._lettres = lettres.map(function (l) { return l.el; });
    slide._mots = mots;
    slide.classList.add('lettrise');
  }

  // ── États, sans animation ──
  function etat(slide, visible) {
    slide._lettres.concat(slide._mots).forEach(function (e) {
      e.classList.remove('entre-anim', 'sort-anim');
      e.classList.toggle('entre', visible);
    });
  }
  function exposer(i) {
    slides.forEach(function (s, k) {
      var actif = k === i;
      s.classList.toggle('is-actif', actif);
      if (actif) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      var titre = s.querySelector('[data-titre]');
      if (!titre) return;
      // La 1re accroche est un vrai <h1> ; les autres sont des paragraphes qui ne deviennent « titre de niveau 1 » que le temps où elles sont affichées.
      if (k !== 0) {
        if (actif) { titre.setAttribute('role', 'heading'); titre.setAttribute('aria-level', '1'); }
        else { titre.removeAttribute('role'); titre.removeAttribute('aria-level'); }
      }
      if (actif) titre.setAttribute('aria-label', titre.getAttribute('data-plein') || ''); else titre.removeAttribute('aria-label');
    });
    points.forEach(function (p, k) { p.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    courant = i;
  }
  function toutStatique(i) {
    annuler();
    slides.forEach(function (s, k) { s.classList.remove('is-sortant'); etat(s, k === i); });
    exposer(i);
    planifier();
  }

  // ── Animation : les lettres, puis les mots, l'un après l'autre ──
  function plan(fn, ms) { enCours.push(setTimeout(fn, ms)); }
  function annuler() { enCours.forEach(clearTimeout); enCours = []; }
  // Même déroulé que le titre animé d'Elementor « swirl » (relevé dans son code) : l'ancien texte et le nouveau sont EMPILÉS au même endroit et jouent EN MÊME TEMPS.
  // Toutes les 40 ms, la lettre n de l'ancien se retourne et sort pendant que la lettre n du nouveau arrive ; chaque mouvement dure 0,4 s. Le titre ne dépasse pas ≈ 1,6 s.
  var PAS_LETTRE = 40, DUREE_TITRE_MAX = 1600, PAS_MOT = 30, DUREE_SOUSTITRE_MAX = 900, DECALAGE_SOUSTITRE = 200, DUREE_MOUVEMENT = 450;
  function jouer(slide, classe) {
    var L = slide._lettres, M = slide._mots;
    var pasL = Math.min(PAS_LETTRE, DUREE_TITRE_MAX / (L.length || 1));
    var pasM = Math.min(PAS_MOT, DUREE_SOUSTITRE_MAX / (M.length || 1));
    L.forEach(function (e, i) { plan(function () { e.classList.add(classe); }, i * pasL); });
    M.forEach(function (e, i) { plan(function () { e.classList.add(classe); }, DECALAGE_SOUSTITRE + i * pasM); });
    return Math.max(L.length * pasL, DECALAGE_SOUSTITRE + M.length * pasM) + DUREE_MOUVEMENT;
  }
  function aller(vers) {
    var enMouvement = enCours.length > 0;
    annuler();
    clearTimeout(attente); attente = null;
    var de = courant;
    if (reduit || de === vers || enMouvement) { toutStatique(vers); return; }   // un clic en plein mouvement : on va directement à l'arrivée
    var vieux = slides[de], neuf = slides[vers];
    vieux.classList.add('is-sortant');   // l'ancien reste affiché le temps de sa sortie, sous le nouveau
    exposer(vers);
    etat(neuf, false);
    var dureeSortie = jouer(vieux, 'sort-anim');
    var dureeEntree = jouer(neuf, 'entre-anim');
    plan(function () {
      vieux.classList.remove('is-sortant');
      etat(vieux, false);
      etat(neuf, true);
      planifier();
    }, Math.max(dureeSortie, dureeEntree));
  }

  // ── Défilement automatique (le temps de lecture ne démarre qu'une fois l'accroche entièrement affichée) ──
  function arreter() { if (attente) { clearTimeout(attente); attente = null; } }
  function planifier() {
    arreter();
    if (enPause || survol || document.hidden) return;
    attente = setTimeout(function () { aller((courant + 1) % slides.length); }, ATTENTE);
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
      b.addEventListener('click', function () { if (i !== courant) aller(i); });
      pilote.appendChild(b);
      points.push(b);
    });
    boutonPause = document.createElement('button');
    boutonPause.type = 'button';
    boutonPause.className = 'accroche-pause';
    boutonPause.addEventListener('click', function () { enPause = !enPause; majBoutonPause(); if (enPause) arreter(); else if (!enCours.length) planifier(); });
    pilote.appendChild(boutonPause);
    majBoutonPause();
  }

  // Pause au survol et quand le clavier est dans la zone ; reprise à la sortie (une animation déjà commencée va jusqu'au bout).
  var zone = conteneur.parentElement || conteneur;
  zone.addEventListener('mouseenter', function () { survol = true; arreter(); });
  zone.addEventListener('mouseleave', function () { survol = false; if (!enCours.length) planifier(); });
  zone.addEventListener('focusin', function () { survol = true; arreter(); });
  zone.addEventListener('focusout', function () { survol = false; if (!enCours.length) planifier(); });
  // Onglet caché : les animations du navigateur se figent ; au retour on repart d'un état propre plutôt que d'un texte à moitié retourné.
  document.addEventListener('visibilitychange', function () { if (document.hidden) { arreter(); } else { toutStatique(courant); } });

  slides.forEach(preparer);
  toutStatique(0);
}());
