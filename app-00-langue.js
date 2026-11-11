// KALEA — chargement CONDITIONNEL des dictionnaires de traduction (2026-11-11).
//
// POURQUOI : traductions-en.js pèse 288 Ko (97 Ko transférés) et ne sert qu'aux utilisateurs en anglais. Un francophone n'a aucune raison
// de le télécharger ni de l'analyser à chaque ouverture.
//
// COMMENT : app.html garde la balise <script src="./traductions-en.js?v=…"> telle quelle (les outils, l'empreinte, le service worker, les
// constructions Android/iOS et les tests continuent de la voir), mais l'enferme dans un <template id="dictionnaires"> : un élément inerte,
// que le navigateur ne télécharge pas et n'exécute pas. Ce fichier-ci, exécuté AVANT app-01-base.js, ré-active la balise seulement si la
// langue de départ a un dictionnaire. Le chargement reste SYNCHRONE (document.write pendant l'analyse de la page) : le dictionnaire est donc
// défini avant app-01-base.js, qui appelle déjà trad() à son chargement (libellés de navigation, unités…).
//
// LA RÈGLE DE LANGUE est celle de langueInitiale() (app-01-base.js) : la langue mémorisée, sinon celle de l'appareil. Elle est reprise ici,
// en plus court, parce que ce fichier s'exécute avant que app-01-base.js existe. Si les deux divergeaient un jour, rien ne casserait :
// langueDisponible() (app-01-base.js) exige que le dictionnaire soit présent et retombe sur le français sinon.
//
// POUR AJOUTER UNE LANGUE : une balise <script src="./traductions-XX.js?v=…"> dans le <template id="dictionnaires"> (le code de langue à deux
// lettres est lu dans le nom du fichier) — rien à changer ici.
(function () {
  var codes = [];
  try { codes.push(localStorage.getItem('parcpacific.langue')); } catch (err) { /* stockage indisponible */ }
  codes.push(String(navigator.language || '').slice(0, 2).toLowerCase());

  var ecrit = false;
  var modele = document.getElementById('dictionnaires');
  if (modele && modele.content) {
    var balises = modele.content.querySelectorAll('script[src]');
    for (var i = 0; i < balises.length; i++) {
      var src = balises[i].getAttribute('src');
      var m = /traductions-([a-z]{2})\.js/.exec(src);
      if (m && codes.indexOf(m[1]) !== -1) {
        document.write('<script src="' + src + '"><\/script>');
        ecrit = true;
      }
    }
  }
  // Aucun dictionnaire chargé (français) : TEXTES doit tout de même exister, vide. trad() renvoie alors le texte français tel quel.
  if (!ecrit) window.TEXTES = {};
})();
