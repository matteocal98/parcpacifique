/* KALEA — calculateur de coût à l'heure ou au km (pages calculateur-cout-horaire.html et en/hourly-cost-calculator.html).
 *
 *   coût total = (prix d'achat − revente estimée) + entretien + autres dépenses + carburant
 *   coût à l'unité = coût total ÷ (compteur aujourd'hui − compteur à l'achat)
 *
 * Même principe que le TCO de l'application (app-02-calculs.js, tcoMachine). Tout est calculé dans le navigateur :
 * rien n'est envoyé ni enregistré.
 */
(function (racine) {
  'use strict';

  // « 30 000 », « 30.000 », « 30,000 » = trente mille ; « 12,5 » = douze et demi. Un seul séparateur suivi de
  // trois chiffres est un séparateur de milliers (les montants et compteurs n'ont pas trois décimales).
  function lireNombre(texte) {
    var s = String(texte == null ? '' : texte).replace(/[^0-9.,-]/g, '');
    if (!/[0-9]/.test(s) || s.indexOf('-') !== -1) return null;
    var seps = s.match(/[.,]/g) || [];
    var dernier = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    var decimal = dernier !== -1;
    if (decimal) {
      var apres = s.length - dernier - 1;
      var memes = seps.every(function (c) { return c === s[dernier]; });
      if (memes && (seps.length > 1 || (apres === 3 && !/^0[.,]/.test(s)))) decimal = false;
    }
    var n = decimal
      ? Number(s.slice(0, dernier).replace(/[.,]/g, '') + '.' + s.slice(dernier + 1))
      : Number(s.replace(/[.,]/g, ''));
    return isFinite(n) ? n : null;
  }

  function calculer(v) {
    if (v.achat == null) return { manque: 'achat' };
    if (v.compteurJour == null) return { manque: 'compteur' };
    var usage = v.compteurJour - (v.compteurAchat || 0);
    if (!(usage > 0)) return { manque: 'usage' };
    var parts = { perte: v.achat - (v.revente || 0), entretien: v.entretien || 0, autres: v.autres || 0, carburant: v.carburant || 0 };
    var total = parts.perte + parts.entretien + parts.autres + parts.carburant;
    if (!(total > 0)) return { manque: 'total' };
    return { total: total, usage: usage, parUnite: total / usage, parts: parts, sansRevente: v.revente == null };
  }

  racine.KaleaCoutHoraire = { lireNombre: lireNombre, calculer: calculer };
  if (typeof document === 'undefined') return;
  var zone = document.getElementById('calculateur');
  if (!zone) return;

  var EN = document.documentElement.lang === 'en';
  var LOCALE = EN ? 'en-GB' : 'fr-FR';
  var MOTS = EN ? {
    heure: 'Cost per hour', km: 'Cost per kilometre',
    manque: { achat: 'Enter the purchase price and today’s counter reading.', compteur: 'Enter today’s counter reading.', usage: 'Today’s reading must be higher than the reading at purchase.', total: 'The resale value is higher than everything spent: please check the amounts.' },
    phrase: function (total, usage) { return total + ' spent over ' + usage + ' since purchase'; },
    sansRevente: ' (no resale value entered: the whole purchase price is counted)',
  } : {
    heure: 'Coût à l’heure', km: 'Coût au kilomètre',
    manque: { achat: 'Indiquez le prix d’achat et le compteur d’aujourd’hui.', compteur: 'Indiquez le compteur d’aujourd’hui.', usage: 'Le compteur d’aujourd’hui doit dépasser celui à l’achat.', total: 'La revente estimée dépasse tout ce qui a été dépensé : vérifiez les montants.' },
    phrase: function (total, usage) { return total + ' dépensés pour ' + usage + ' depuis l’achat'; },
    sansRevente: ' (revente non renseignée : tout le prix d’achat est compté)',
  };
  var EXEMPLE = { achat: 30000, revente: 12000, 'compteur-achat': 3000, 'compteur-jour': 5400, entretien: 4500, autres: 3000, carburant: 0 };
  var etat = { unite: 'h', devise: 'EUR' };
  var $ = function (id) { return document.getElementById('cc-' + id); };

  function montant(n, fin) {
    var xpf = etat.devise === 'XPF';
    var texte = n.toLocaleString(LOCALE, {
      minimumFractionDigits: fin && !xpf ? 2 : 0,
      maximumFractionDigits: fin ? 2 : 0,
    });
    if (xpf) return texte + (EN ? ' XPF' : ' F CFP');
    return EN ? '€' + texte : texte + ' €';
  }

  function maj() {
    var xpf = etat.devise === 'XPF';
    zone.querySelectorAll('[data-devise]').forEach(function (n) { n.textContent = xpf ? 'XPF' : '€'; });
    zone.querySelectorAll('[data-unite]').forEach(function (n) { n.textContent = etat.unite; });
    $('titre').textContent = etat.unite === 'km' ? MOTS.km : MOTS.heure;
    $('par').textContent = '/ ' + etat.unite;
    var lire = function (id) { return lireNombre($(id).value); };
    var r = calculer({
      achat: lire('achat'), revente: lire('revente'), compteurAchat: lire('compteur-achat'), compteurJour: lire('compteur-jour'),
      entretien: lire('entretien'), autres: lire('autres'), carburant: lire('carburant'),
    });
    var ok = !r.manque;
    $('resultat').textContent = ok ? montant(r.parUnite, true) : '—';
    $('phrase').textContent = ok
      ? MOTS.phrase(montant(r.total, false), r.usage.toLocaleString(LOCALE) + ' ' + etat.unite) + (r.sansRevente ? MOTS.sansRevente : '')
      : MOTS.manque[r.manque];
    ['perte', 'entretien', 'autres', 'carburant'].forEach(function (cle) {
      zone.querySelector('[data-montant="' + cle + '"]').textContent = ok ? montant(r.parts[cle], false) : '—';
      var part = zone.querySelector('[data-part="' + cle + '"]');
      part.style.width = ok ? (Math.max(r.parts[cle], 0) / r.total * 100) + '%' : '0';
    });
    zone.querySelector('[data-ligne="carburant"]').style.display = ok && r.parts.carburant > 0 ? '' : 'none';
  }

  zone.querySelectorAll('button[data-choix]').forEach(function (b) {
    b.addEventListener('click', function () {
      etat[b.getAttribute('data-choix')] = b.getAttribute('data-valeur');
      zone.querySelectorAll('button[data-choix="' + b.getAttribute('data-choix') + '"]').forEach(function (a) {
        var actif = a === b;
        a.setAttribute('aria-pressed', String(actif));
        a.classList.toggle('bg-brand-ink', actif);
        a.classList.toggle('text-white', actif);
        a.classList.toggle('text-slate-600', !actif);
      });
      maj();
    });
  });
  zone.addEventListener('input', maj);
  // Entrée dans un champ ne doit pas recharger la page (et effacer la saisie).
  zone.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); });
  $('exemple').addEventListener('click', function () {
    Object.keys(EXEMPLE).forEach(function (id) { $(id).value = EXEMPLE[id].toLocaleString(LOCALE); });
    maj();
  });
  $('effacer').addEventListener('click', function () {
    Object.keys(EXEMPLE).forEach(function (id) { $(id).value = ''; });
    maj();
  });
  $('imprimer').addEventListener('click', function () { window.print(); });
  maj();
})(typeof globalThis !== 'undefined' ? globalThis : this);
