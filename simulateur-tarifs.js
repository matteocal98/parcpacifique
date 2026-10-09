/* KALEA — simulateur d'abonnement de la page « Découvrir ».
 *
 * Le visiteur indique son nombre de machines, le nombre de personnes qui utiliseront KALEA et ce dont il a besoin ;
 * on calcule le coût de CHAQUE offre et on recommande la moins chère qui convient.
 *
 * ⚠ Les prix et limites ci-dessous reprennent la grille de l'application (OFFRE_GRILLE, LIMITES_OFFRES dans app.html)
 *   et les cartes de la page. S'ils changent, les changer ICI aussi (et regénérer KALEA-grille-tarifaire.pdf).
 *
 * Deux langues (FR/EN) : les textes fixes de la section passent par accueil-langue.js ; les résultats, recalculés à
 * chaque saisie, sont écrits ici dans la langue de la page (attribut lang de <html>, posé par accueil-langue.js).
 */
(function (racine) {
  'use strict';

  // niveau = rang de l'offre dans la grille ; incluses = machines comprises dans le prix de base ;
  // max = plafond de machines ; extra = prix de chaque machine au-delà des incluses ; utilisateurs = nombre maximal.
  var OFFRES = [
    { cle: 'free', nom: { fr: 'Gratuit', en: 'Free' }, niveau: 0, base: 0, incluses: 2, max: 2, extra: 0, utilisateurs: 1 },
    { cle: 'starter', nom: { fr: 'Starter', en: 'Starter' }, niveau: 1, base: 12, incluses: 5, max: 10, extra: 2, utilisateurs: 1 },
    { cle: 'business', nom: { fr: 'Business', en: 'Business' }, niveau: 2, base: 39, incluses: 20, max: 40, extra: 1.5, utilisateurs: 3 },
    { cle: 'enterprise', nom: { fr: 'Enterprise', en: 'Enterprise' }, niveau: 3, base: 79, incluses: 40, max: 150, extra: 1, utilisateurs: 9999 },
  ];
  var PLAFOND_PUBLIC = 150; // au-delà : offre Grand compte, sur devis

  function prixDe(offre, machines) {
    return offre.base + Math.max(0, machines - offre.incluses) * offre.extra;
  }

  // besoin : 0 l'essentiel, 1 export CSV, 2 QR codes / préparation groupée / Coûts & TCO, 3 Stocks & SAV / télémétrie / support dédié.
  // utilisateurs : nombre de personnes (1, 3 pour « 2 à 3 », 99 pour « 4 ou plus »).
  function simuler(machines, besoin, utilisateurs) {
    var n = Math.max(1, Math.floor(Number(machines) || 1));
    var grandCompte = n > PLAFOND_PUBLIC;
    var lignes = OFFRES.map(function (o) {
      var raison = null;
      if (n > o.max) raison = 'machines';
      else if (o.niveau < besoin) raison = 'fonctions';
      else if (utilisateurs > o.utilisateurs) raison = 'utilisateurs';
      return { offre: o, prix: raison ? null : prixDe(o, n), raison: raison, supplement: Math.max(0, n - o.incluses) };
    });
    var reco = null;
    lignes.forEach(function (l) {
      if (l.prix === null) return;
      if (reco === null || l.prix < reco.prix) reco = l;
    });
    return { machines: n, grandCompte: grandCompte, lignes: lignes, reco: grandCompte ? null : reco };
  }

  var api = { OFFRES: OFFRES, PLAFOND_PUBLIC: PLAFOND_PUBLIC, prixDe: prixDe, simuler: simuler };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  racine.simulateurTarifs = api;

  if (typeof document === 'undefined') return;

  // ── Affichage ─────────────────────────────────────────────────────────────
  var TXT = {
    fr: {
      recommandee: 'Offre recommandée',
      mois: '/mois',
      gratuitJusqua: 'Gratuit jusqu\'à {n} machines.',
      inclus: '{base} pour {inc} machines incluses.',
      detail: '{base} pour {inc} machines incluses + {sup} machine{s} en plus × {extra} = {total}',
      raison: { machines: 'limité à {max} machines', fonctions: 'fonctions insuffisantes', utilisateurs: '{u} utilisateur{s} maximum' },
      gcTitre: 'Offre Grand compte',
      gcTexte: 'Au-delà de 150 machines, nous établissons un devis sur mesure (tarif dégressif, intégrations, accompagnement, contrat annuel).',
      gcBouton: 'Demander un devis',
      contacter: 'Contacter l\'équipe',
      aucune: 'Aucune offre ne couvre cette combinaison : écrivez-nous, nous trouverons une solution.',
      pasCher: 'Prix toutes taxes comprises, sans engagement.',
    },
    en: {
      recommandee: 'Recommended plan',
      mois: '/month',
      gratuitJusqua: 'Free up to {n} machines.',
      inclus: '{base} for {inc} machines included.',
      detail: '{base} for {inc} machines included + {sup} extra machine{s} × {extra} = {total}',
      raison: { machines: 'limited to {max} machines', fonctions: 'not enough features', utilisateurs: '{u} user{s} maximum' },
      gcTitre: 'Key Account plan',
      gcTexte: 'Beyond 150 machines, we draw up a tailored quote (sliding-scale pricing, integrations, onboarding, annual contract).',
      gcBouton: 'Request a quote',
      contacter: 'Contact the team',
      aucune: 'No plan covers this combination: write to us and we will find a solution.',
      pasCher: 'Prices include all taxes, no commitment.',
    },
  };
  var MAIL_ENT = 'mailto:support@kalea.pro?subject=Offre%20Enterprise%20%E2%80%94%20demande%20d%27informations';
  var MAIL_GC = 'mailto:support@kalea.pro?subject=Offre%20Grand%20compte%20%E2%80%94%20demande%20de%20devis';

  function langue() { return document.documentElement.lang === 'en' ? 'en' : 'fr'; }
  function montant(v, lg) {
    var entier = Math.abs(v - Math.round(v)) < 0.005;
    var txt = entier ? String(Math.round(v)) : (Math.round(v * 100) / 100).toFixed(2);
    if (lg === 'fr') return txt.replace('.', ',') + ' €';
    return '€' + txt;
  }
  function remplir(modele, valeurs) {
    return modele.replace(/\{(\w+)\}/g, function (_, k) { return valeurs[k] === undefined ? '' : valeurs[k]; });
  }
  function echapper(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function rendre() {
    var zone = document.getElementById('sim-resultat');
    var champN = document.getElementById('sim-machines-n');
    if (!zone || !champN) return;
    var lg = langue(); var t = TXT[lg];
    var n = Math.max(1, Math.floor(Number(champN.value) || 1));
    var besoin = Number(document.getElementById('sim-besoin').value) || 0;
    var users = Number(document.getElementById('sim-users').value) || 1;
    var r = simuler(n, besoin, users);

    // ── Grand compte ──
    if (r.grandCompte) {
      zone.innerHTML =
        '<div class="rounded-2xl bg-[#0E1333] text-white p-6 sm:p-8">' +
        '<div class="text-xs font-bold tracking-wider uppercase text-white/70 mb-2">' + t.recommandee + '</div>' +
        '<div class="text-3xl sm:text-4xl font-extrabold font-display">' + t.gcTitre + '</div>' +
        '<p class="mt-3 text-sm sm:text-base text-white/80 leading-relaxed">' + t.gcTexte + '</p>' +
        '<a href="' + MAIL_GC + '" class="mt-5 inline-flex items-center justify-center rounded-xl bg-white text-[#0E1333] font-bold px-5 py-3 text-sm hover:bg-slate-100 transition-colors">' + t.gcBouton + '</a>' +
        '</div>';
      return;
    }

    var reco = r.reco;
    var blocReco;
    if (!reco) {
      blocReco = '<div class="rounded-2xl bg-[#0E1333] text-white p-6 sm:p-8"><p class="text-base">' + t.aucune + '</p>' +
        '<a href="' + MAIL_ENT + '" class="mt-4 inline-flex rounded-xl bg-white text-[#0E1333] font-bold px-5 py-3 text-sm">' + t.contacter + '</a></div>';
    } else {
      var o = reco.offre; var nom = o.nom[lg];
      var detail;
      if (o.cle === 'free') detail = remplir(t.gratuitJusqua, { n: o.max });
      else if (reco.supplement === 0) detail = remplir(t.inclus, { base: montant(o.base, lg), inc: o.incluses });
      else detail = remplir(t.detail, { base: montant(o.base, lg), inc: o.incluses, sup: reco.supplement, s: reco.supplement > 1 ? 's' : '', extra: montant(o.extra, lg), total: montant(reco.prix, lg) });
      blocReco =
        '<div class="rounded-2xl bg-[#0E1333] text-white p-6 sm:p-8">' +
        '<p class="text-[13px] sm:text-sm text-white/80 leading-relaxed">' + detail + '</p>' +
        '<p class="mt-2 text-xs text-white/60">' + t.pasCher + '</p>' +
        '<div class="mt-6 pt-5 border-t border-white/15">' +
        '<div class="text-xs font-bold tracking-wider uppercase text-white/70 mb-2">' + t.recommandee + '</div>' +
        '<div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">' +
        '<span class="text-3xl sm:text-4xl font-extrabold font-display">' + echapper(nom) + '</span>' +
        '<span class="text-3xl sm:text-4xl font-extrabold font-display text-[#7DD3FC]">' + montant(reco.prix, lg) + '<span class="text-base font-semibold text-white/70"> ' + t.mois + '</span></span>' +
        '</div></div></div>';
    }

    // ── Les 4 offres côte à côte ──
    var puces = r.lignes.map(function (l) {
      var choisie = reco && l.offre.cle === reco.offre.cle;
      var corps;
      if (l.prix === null) {
        var u = l.offre.utilisateurs;
        corps = '<div class="text-lg font-bold text-slate-400">—</div>' +
          '<div class="text-[11px] leading-tight text-slate-500">' + remplir(t.raison[l.raison], { max: l.offre.max, u: u, s: u > 1 ? 's' : '' }) + '</div>';
      } else {
        corps = '<div class="text-lg font-extrabold ' + (choisie ? 'text-[#006591]' : 'text-[#0E1333]') + '">' + montant(l.prix, lg) + '<span class="text-xs font-semibold text-slate-500">' + t.mois + '</span></div>';
      }
      return '<div class="rounded-xl p-3 text-center flex flex-col items-center justify-center ' + (choisie ? 'bg-[#dcecf5]' : 'bg-[#f3f5fb]') + '">' +
        '<div class="text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">' + echapper(l.offre.nom[lg]) + '</div>' + corps + '</div>';
    }).join('');

    zone.innerHTML = blocReco + '<div class="mt-4 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3">' + puces + '</div>';
  }

  function brancher() {
    var champN = document.getElementById('sim-machines-n');
    var curseur = document.getElementById('sim-machines');
    if (!champN || !curseur) return;
    curseur.addEventListener('input', function () { champN.value = curseur.value; rendre(); });
    champN.addEventListener('input', function () {
      var v = Math.floor(Number(champN.value) || 0);
      if (v >= Number(curseur.min) && v <= Number(curseur.max)) curseur.value = v;
      else if (v > Number(curseur.max)) curseur.value = curseur.max;
      rendre();
    });
    champN.addEventListener('blur', function () { if (!(Number(champN.value) >= 1)) { champN.value = 1; curseur.value = 1; rendre(); } });
    ['sim-besoin', 'sim-users'].forEach(function (id) { document.getElementById(id).addEventListener('change', rendre); });
    // Changement de langue : accueil-langue.js modifie l'attribut lang de <html>.
    new MutationObserver(rendre).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    rendre();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher);
  else brancher();
})(typeof window !== 'undefined' ? window : globalThis);
