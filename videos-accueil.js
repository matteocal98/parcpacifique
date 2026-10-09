/* KALEA — section « KALEA en action » (vidéos YouTube) des pages publiques.
 *
 * Partagé par index.html et decouvrir.html (deux copies identiques de la page).
 *
 * Respect de la vie privée : aucune connexion à YouTube tant que le visiteur n'a pas cliqué
 * sur « Lire ». Avant le clic, seule une image d'aperçu hébergée sur kalea.pro est chargée ;
 * au clic, le lecteur est chargé depuis youtube-nocookie.com (mode sans cookie publicitaire).
 *
 * Langue : on suit la langue de la page (attribut lang de <html>, posé par accueil-langue.js)
 * et on affiche la version française ou anglaise de chaque vidéo.
 *
 * Une vidéo dont l'identifiant est null n'est tout simplement pas affichée.
 */
(function () {
  'use strict';

  var CHAINE = 'https://www.youtube.com/channel/UCSUtMFa_jGNuR5MXUb9Lmqg';

  // Identifiants YouTube (voir Video/YouTube/identifiants-youtube.json). L'ordre = l'ordre d'affichage ;
  // la première vidéo est mise en avant (grande).
  var VIDEOS = [
    { cle: 'pub-gerant', fr: null, en: null,
      titre: { fr: "Plus jamais de chantier à l'arrêt", en: 'No more stopped job sites' } },
    { cle: 'creer-un-compte', fr: null /* _IQxOjrFtGQ : encore privée (2026-10-09), à remettre quand elle sera publique */, en: 'YulRg_u4uV4',
      titre: { fr: 'Créer son compte en 1 minute', en: 'Create your account in 1 minute' } },
    { cle: 'enregistrer-une-machine', fr: null /* SZ6NosEhJ1M : encore privée (2026-10-09), à remettre quand elle sera publique */, en: '3AkB5HeQSos',
      titre: { fr: "Ajouter une machine et son plan d'entretien", en: 'Add a machine and its maintenance plan' } },
    { cle: 'intervention', fr: 'Y6zv1zTR0ts', en: '_IgtVKW0nq4',
      titre: { fr: 'Noter une intervention en quelques secondes', en: 'Log a service job in seconds' } },
    { cle: 'agenda', fr: 'NIiJqQnQ1Wg', en: 'YqubT0W2vxw',
      titre: { fr: "L'agenda d'entretien de votre parc", en: "Your fleet's maintenance agenda" } },
    { cle: 'stock', fr: '0STKCKnD_L0', en: '-SMH-XD-bYo',
      titre: { fr: 'Stock de pièces et SAV', en: 'Parts stock & service' } }
  ];

  var LIBELLES = {
    fr: { lire: 'Lire la vidéo', lecteur: 'Vidéo KALEA', hl: 'fr' },
    en: { lire: 'Play video', lecteur: 'KALEA video', hl: 'en' }
  };

  function langue() {
    return (document.documentElement.lang || '').slice(0, 2).toLowerCase() === 'en' ? 'en' : 'fr';
  }

  function carte(video, l, grande) {
    var id = video[l];
    var lib = LIBELLES[l];
    var figure = document.createElement('figure');
    figure.className = 'm-0' + (grande ? ' lg:col-span-2 lg:row-span-2' : '');

    var cadre = document.createElement('div');
    cadre.className = 'relative w-full aspect-video rounded-2xl overflow-hidden bg-brand-ink shadow-lg ring-1 ring-slate-200';

    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'group absolute inset-0 w-full h-full cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary';
    bouton.setAttribute('aria-label', lib.lire + ' : ' + video.titre[l]);

    var image = document.createElement('img');
    image.src = './videos/' + video.cle + '-' + l + '.jpg';
    image.alt = video.titre[l];
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = 800; image.height = 450;
    image.className = 'w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]';

    var rond = document.createElement('span');
    rond.className = 'absolute inset-0 flex items-center justify-center pointer-events-none';
    rond.innerHTML = '<span class="flex items-center justify-center rounded-full bg-white/95 text-brand-ink shadow-xl ' +
      (grande ? 'w-20 h-20' : 'w-14 h-14') + ' transition-transform group-hover:scale-110">' +
      '<svg viewBox="0 0 24 24" class="' + (grande ? 'w-9 h-9' : 'w-6 h-6') + ' ml-1" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>';

    bouton.appendChild(image);
    bouton.appendChild(rond);
    bouton.addEventListener('click', function () {
      var lecteur = document.createElement('iframe');
      lecteur.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&hl=' + lib.hl;
      lecteur.title = lib.lecteur + ' : ' + video.titre[l];
      lecteur.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      lecteur.setAttribute('allowfullscreen', '');
      lecteur.referrerPolicy = 'strict-origin-when-cross-origin';
      lecteur.className = 'absolute inset-0 w-full h-full border-0';
      cadre.replaceChild(lecteur, bouton);
    });
    cadre.appendChild(bouton);

    var legende = document.createElement('figcaption');
    legende.className = 'mt-3 font-display font-bold text-brand-ink ' + (grande ? 'text-lg sm:text-xl' : 'text-base');
    legende.textContent = video.titre[l];

    figure.appendChild(cadre);
    figure.appendChild(legende);
    return figure;
  }

  function rendre() {
    var conteneur = document.getElementById('videos-kalea-grille');
    var section = document.getElementById('kalea-en-action');
    if (!conteneur || !section) return;
    var l = langue();
    var visibles = VIDEOS.filter(function (v) { return !!v[l]; });
    conteneur.textContent = '';
    visibles.forEach(function (v, i) {
      conteneur.appendChild(carte(v, l, i === 0 && v.cle === 'pub-gerant'));
    });
    section.hidden = visibles.length === 0;
    var lien = document.getElementById('videos-kalea-chaine');
    if (lien) lien.href = CHAINE;
  }

  function demarrer() {
    rendre();
    // accueil-langue.js change l'attribut lang de <html> quand le visiteur bascule FR/EN.
    new MutationObserver(rendre).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
