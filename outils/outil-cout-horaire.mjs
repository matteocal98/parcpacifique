// Bloc « calculateur de coût horaire » inséré par le générateur dans la page calculateur (FR et EN).
// Maquette : Figma « KALEA - Calculateur de coût horaire ». Calcul : /calculateur-cout.js (aucune donnée envoyée).
// Toutes les classes sont écrites ici en toutes lettres : Tailwind les lit dans les pages produites.

const T = {
  fr: {
    unite: 'Unité du compteur', heures: 'Heures', km: 'Kilomètres', devise: 'Devise', cfp: 'F CFP',
    machine: 'La machine', achat: 'Prix d\'achat', revente: 'Revente estimée aujourd\'hui',
    compteur: 'Le compteur', cAchat: 'À l\'achat', cJour: 'Aujourd\'hui', neuf: '0 si la machine était neuve',
    depenses: 'Dépenses depuis l\'achat', entretien: 'Entretien et réparations', autres: 'Assurance, transport, taxes', carburant: 'Carburant (facultatif)',
    exemple: 'Remplir avec un exemple', effacer: 'Effacer',
    coutHeure: 'Coût à l\'heure', perte: 'Perte de valeur', lEntretien: 'Entretien et réparations', lAutres: 'Autres dépenses', lCarburant: 'Carburant',
    nonCompte: 'Non compté : salaire du conducteur, intérêts d\'emprunt, journées d\'arrêt.',
    imprimer: 'Imprimer le résultat',
    suiteTitre: 'Suivre ce coût machine par machine',
    suiteTexte: 'KALEA le recalcule à partir de vos interventions et dépenses enregistrées. Le suivi du coût (TCO) fait partie de l\'offre Business, à partir de 39 €/mois.',
    offres: 'Voir les offres', accueil: '/#tarifs',
    sansScript: 'Le calculateur a besoin de JavaScript. La formule est expliquée ci-dessous.',
  },
  en: {
    unite: 'Counter unit', heures: 'Hours', km: 'Kilometres', devise: 'Currency', cfp: 'XPF',
    machine: 'The machine', achat: 'Purchase price', revente: 'Estimated resale value today',
    compteur: 'The counter', cAchat: 'At purchase', cJour: 'Today', neuf: '0 if the machine was new',
    depenses: 'Spending since purchase', entretien: 'Maintenance and repairs', autres: 'Insurance, transport, taxes', carburant: 'Fuel (optional)',
    exemple: 'Fill in an example', effacer: 'Clear',
    coutHeure: 'Cost per hour', perte: 'Loss of value', lEntretien: 'Maintenance and repairs', lAutres: 'Other spending', lCarburant: 'Fuel',
    nonCompte: 'Not counted: operator wages, loan interest, days out of service.',
    imprimer: 'Print the result',
    suiteTitre: 'Track this cost machine by machine',
    suiteTexte: 'KALEA recalculates it from the maintenance and spending you record. Cost tracking (TCO) is part of the Business plan, from €39/month.',
    offres: 'See the plans', accueil: '/en/#tarifs',
    sansScript: 'The calculator needs JavaScript. The formula is explained below.',
  },
};

const champ = (id, libelle, suffixe, exemple, aide = '') => `<div>
<label class="block text-sm font-semibold text-brand-ink mb-1.5" for="cc-${id}">${libelle}</label>
<div class="relative">
<input id="cc-${id}" type="text" inputmode="decimal" autocomplete="off" placeholder="${exemple}" class="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-14 py-3 text-base font-semibold text-brand-ink focus:border-brand-primary focus:ring-2 focus:ring-brand-primary">
<span class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm font-medium text-slate-500" data-${suffixe}></span>
</div>${aide ? `\n<p class="mt-1 text-xs text-slate-500">${aide}</p>` : ''}
</div>`;

const choix = (groupe, legende, options) => `<div class="inline-flex gap-1 rounded-xl bg-brand-subtleBg p-1" role="group" aria-label="${legende}">
${options.map(([valeur, texte], i) => `<button type="button" data-choix="${groupe}" data-valeur="${valeur}" aria-pressed="${i === 0}" class="rounded-lg px-4 py-2 text-sm font-bold ${i === 0 ? 'bg-brand-ink text-white' : 'text-slate-600'}">${texte}</button>`).join('\n')}
</div>`;

const ligne = (cle, couleur, texte) => `<li class="flex items-center gap-2.5" data-ligne="${cle}"><span class="h-2.5 w-2.5 shrink-0 rounded-full ${couleur}"></span><span class="flex-1 text-slate-300">${texte}</span><span class="font-bold text-white" data-montant="${cle}">—</span></li>`;

export function blocCalculateur(lg) {
  const t = T[lg];
  const ex = lg === 'fr' ? ['30 000', '12 000', '3 000', '5 400', '4 500', '3 000', '0'] : ['30,000', '12,000', '3,000', '5,400', '4,500', '3,000', '0'];
  return `<style>@media print{@page{size:A4 portrait;margin:10mm}main>article:not(#_){display:block!important;padding:0}header,footer,.sans-impression,article>section:not(#_),article>nav:not(#_){display:none!important}#calculateur{zoom:.85;margin-top:12px}.carte-resultat,.carte-resultat *{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
<noscript><p class="mt-8 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-brand-ink">${t.sansScript}</p></noscript>
<div id="calculateur" class="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 lg:items-start">
<form class="rounded-3xl border border-brand-borderMuted bg-white p-5 sm:p-7 space-y-6" novalidate onsubmit="return false">
<div class="sans-impression flex flex-wrap gap-3">
${choix('unite', t.unite, [['h', t.heures], ['km', t.km]])}
${choix('devise', t.devise, [['EUR', '€'], ['XPF', t.cfp]])}
</div>
<fieldset><legend class="font-display font-bold text-lg text-brand-ink mb-3">${t.machine}</legend>
<div class="grid gap-3 sm:grid-cols-2">
${champ('achat', t.achat, 'devise', ex[0])}
${champ('revente', t.revente, 'devise', ex[1])}
</div></fieldset>
<fieldset><legend class="font-display font-bold text-lg text-brand-ink mb-3">${t.compteur}</legend>
<div class="grid gap-3 sm:grid-cols-2">
${champ('compteur-achat', t.cAchat, 'unite', ex[2], t.neuf)}
${champ('compteur-jour', t.cJour, 'unite', ex[3])}
</div></fieldset>
<fieldset><legend class="font-display font-bold text-lg text-brand-ink mb-3">${t.depenses}</legend>
<div class="grid gap-3 sm:grid-cols-2">
${champ('entretien', t.entretien, 'devise', ex[4])}
${champ('autres', t.autres, 'devise', ex[5])}
${champ('carburant', t.carburant, 'devise', ex[6])}
</div></fieldset>
<div class="flex flex-wrap gap-3 sans-impression">
<button type="button" id="cc-exemple" class="rounded-xl border border-brand-borderMuted bg-white px-4 py-2.5 text-sm font-bold text-brand-ink hover:border-brand-primary">${t.exemple}</button>
<button type="button" id="cc-effacer" class="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50">${t.effacer}</button>
</div>
</form>
<div class="carte-resultat rounded-3xl bg-brand-ink p-5 sm:p-7 text-white lg:sticky lg:top-24">
<p class="text-sm font-semibold text-slate-300" id="cc-titre">${t.coutHeure}</p>
<p class="mt-2 flex flex-wrap items-baseline gap-2" aria-live="polite"><span class="font-display font-bold text-5xl" id="cc-resultat">—</span><span class="text-lg font-medium text-slate-400" id="cc-par">/ h</span></p>
<p class="mt-3 text-sm text-slate-300" id="cc-phrase"></p>
<div class="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true"><span class="bg-brand-teal" data-part="perte"></span><span class="bg-brand-amber" data-part="entretien"></span><span class="bg-brand-indigo" data-part="autres"></span><span class="bg-brand-primary" data-part="carburant"></span></div>
<ul class="mt-4 space-y-2.5 text-sm">
${ligne('perte', 'bg-brand-teal', t.perte)}
${ligne('entretien', 'bg-brand-amber', t.lEntretien)}
${ligne('autres', 'bg-brand-indigo', t.lAutres)}
${ligne('carburant', 'bg-brand-primary', t.lCarburant)}
</ul>
<p class="mt-4 text-xs text-slate-400">${t.nonCompte}</p>
<button type="button" id="cc-imprimer" class="sans-impression mt-4 rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">${t.imprimer}</button>
<div class="sans-impression mt-5 rounded-2xl bg-white/10 p-5">
<p class="font-display font-bold text-lg">${t.suiteTitre}</p>
<p class="mt-2 text-sm text-slate-300">${t.suiteTexte}</p>
<a class="mt-3 inline-block rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white" href="${t.accueil}">${t.offres}</a>
</div>
</div>
</div>
<script src="/calculateur-cout.js" defer></script>`;
}
