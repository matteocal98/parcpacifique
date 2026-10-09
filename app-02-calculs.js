/* KALEA — application (app.html) : Calculs purs : TCO, échéances par tâche, classement des fréquences.
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · TCO (coût total de possession), optionnel
 *   · Séparateurs de milliers sur les champs de saisie
 *   · TCO flotte (phase 2) — agrégation pure, pas d'accès réseau ici ──
 *   · UNE ÉCHÉANCE PAR TÂCHE
 *   · AMBIGUÏTÉ DU CARNET : ON DEMANDE, ON NE DEVINE PAS
 *   · CLASSEMENT D'UNE FRÉQUENCE : UNE SEULE RÈGLE
 *   · LE CLASSEMENT PROJETÉ POUR L'AFFICHAGE
 */
// ───────────────────────── début du code ─────────────────────────
// ── TCO (coût total de possession), optionnel ────────────────────
// Rien de tout ça ne s'affiche ni ne se calcule tant que tcoActif() est
// faux (colonnes absentes) OU que machine.purchase_price n'est pas renseigné
// — une machine sans donnée d'acquisition ne montre AUCUN bloc TCO nulle
// part, même philosophie que vueCompteurSecondaire sans second suivi
// (voir keeva-tco-feature).
// Devise définie une fois par société (carte « Paramètres TCO »), jamais par
// machine ni par visiteur — voir UI.company.currency. `currency` en second
// paramètre permet de forcer une devise précise (rare), sinon celle de la
// société active. XPF n'a pas de sous-unité : Intl le sait déjà nativement,
// `maximumFractionDigits: 0` aligne simplement l'EUR sur la même convention
// d'affichage déjà en place dans le reste de l'app (jamais de centimes).
// ── Séparateurs de milliers sur les champs de saisie ─────────────
// `<input type="number">` ne peut PAS afficher « 20 300 » (le navigateur
// refuse tout caractère qui n'est pas un chiffre/point) : les champs
// concernés passent donc en `type="text" inputmode="decimal"`, formatés au
// blur et remis en brut au focus (pour rester éditables sans se battre avec
// la position du curseur pendant la frappe).
//
// Distinct de formatMontant : ceci n'affiche jamais de symbole monétaire, et
// sert la SAISIE, pas l'affichage d'une valeur déjà enregistrée.
function separateursLocale(locale) {
  const parts = new Intl.NumberFormat(locale || localeActive()).formatToParts(1234.5);
  return {
    groupe: parts.find(p => p.type === 'group')?.value || ' ',
    decimal: parts.find(p => p.type === 'decimal')?.value || '.',
  };
}
// Lit un texte saisi (avec ou sans séparateurs) et rend un nombre JS, ou
// `null` si vide/illisible — jamais NaN, pour que l'appelant garde le même
// réflexe « valeur vide = pas de coût » qu'avec un champ number.
//
// ⚠️ Ne dépend PAS des séparateurs exacts de la locale, à dessein :
// `toLocaleString('fr-FR')` groupe avec une espace fine INSÉCABLE (U+202F),
// invisible à l'œil et différente d'une espace normale — si l'utilisateur
// tape lui-même une espace normale pour se relire (réflexe naturel sur un
// gros montant), ou un point décimal (clavier numérique, habitude perso, un
// « . » au lieu d'une « , »), une lecture stricte fondée sur la locale
// rejetait toute la saisie. Heuristique retenue : la DERNIÈRE virgule ou le
// DERNIER point rencontré est LE séparateur décimal (0 à 2 chiffres après,
// en pratique) ; tout le reste (espace de toute nature, virgule/point
// antérieurs) est un séparateur de milliers, ignoré.
// EXCEPTION : exactement TROIS chiffres après le dernier séparateur, derrière une partie entière non nulle
// (« 1,400 » en anglais, « 1.400 » au clavier), c'est un séparateur de milliers. Les montants n'ont jamais plus de
// deux décimales, et lire « 1,400 » comme 1,4 divisait par mille tout montant affiché en anglais puis réenregistré.
// « 0,125 » reste un décimal (partie entière nulle).
function nombreDepuisTexte(texte) {
  if (texte == null || texte === '') return null;
  const s = String(texte).trim();
  if (s === '') return null;
  const negatif = s.charAt(0) === '-';
  let dernierSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (dernierSep !== -1) {
    const avant = s.slice(0, dernierSep).replace(/[^0-9]/g, '');
    const apres = s.slice(dernierSep + 1);
    if (/^[0-9]{3}$/.test(apres) && /[1-9]/.test(avant)) dernierSep = -1;
  }
  const partieEntiere = (dernierSep === -1 ? s : s.slice(0, dernierSep)).replace(/[^0-9]/g, '');
  const partieDecimale = (dernierSep === -1 ? '' : s.slice(dernierSep + 1)).replace(/[^0-9]/g, '');
  if (partieEntiere === '' && partieDecimale === '') return null;
  const n = Number(`${partieEntiere || '0'}.${partieDecimale || '0'}`) * (negatif ? -1 : 1);
  return isFinite(n) ? n : null;
}
// L'inverse : un nombre → un texte avec séparateurs de milliers, pour
// affichage dans un champ de saisie (jamais de devise ici, voir formatMontant).
function texteAvecSeparateurs(valeur, locale) {
  if (valeur == null || valeur === '') return '';
  const n = Number(valeur);
  if (!isFinite(n)) return '';
  return n.toLocaleString(locale || localeActive(), { maximumFractionDigits: 2 });
}
// Câble un champ texte : brut (sans séparateur) au focus pour une édition
// simple, reformaté avec séparateurs au blur. Suppose `type="text"
// inputmode="decimal"` — jamais `type="number"`, qui rejette les espaces.
function activerSeparateurMilliers(input) {
  if (!input) return;
  input.addEventListener('focus', () => {
    const n = nombreDepuisTexte(input.value);
    input.value = n == null ? '' : String(n);
  });
  input.addEventListener('blur', () => {
    input.value = texteAvecSeparateurs(nombreDepuisTexte(input.value));
  });
  input.value = texteAvecSeparateurs(nombreDepuisTexte(input.value));
}
// Court libellé de la devise active (pour un intitulé de champ, ex. « Prix
// unitaire (XPF) ») — même source que formatMontant (UI.company.currency).
function deviseCourte() {
  return (typeof UI !== 'undefined' && UI.company && UI.company.currency === 'XPF') ? 'XPF' : '€';
}
function formatMontant(valeur, currency) {
  if (valeur == null || valeur === '') return '—';
  const n = Number(valeur);
  if (!isFinite(n)) return '—';
  const devise = currency || (typeof UI !== 'undefined' && UI.company && UI.company.currency) || 'EUR';
  return n.toLocaleString(localeActive(), { style: 'currency', currency: devise, maximumFractionDigits: 0 });
}
// Version compacte (« 878k », « 1,2M ») pour un affichage décoratif très
// contraint en espace (centre du donut, reprise Stitch phase 3) — jamais
// utilisée pour un montant qu'on veut exact, formatMontant reste la seule
// référence pour ça partout ailleurs.
function montantAbrege(valeur) {
  const n = Number(valeur);
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toLocaleString(localeActive(), { maximumFractionDigits: 1 })}M`;
  if (abs >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}
// Parité FIXE (jamais un taux de marché, jamais mise à jour) du franc
// Pacifique : 1 EUR = 119,3317 XPF — la conversion des montants TCO déjà
// saisis, demandée explicitement par l'utilisateur au changement de devise
// (voir keeva-tco-feature). Arrondi à l'unité en XPF (pas de sous-unité
// dans cette devise), à 2 décimales en EUR (centimes).
const PARITE_EUR_XPF = 119.3317;
function convertirDevise(valeur, deviseSource, deviseCible) {
  if (valeur == null || valeur === '') return valeur;
  const n = Number(valeur);
  if (!isFinite(n) || deviseSource === deviseCible) return valeur;
  const converti = deviseCible === 'EUR' ? n / PARITE_EUR_XPF : n * PARITE_EUR_XPF;
  const decimales = deviseCible === 'EUR' ? 2 : 0;
  return Number(converti.toFixed(decimales));
}
// Somme des coûts d'ENTRETIEN (pièces + main d'œuvre) d'une machine, à partir
// de la liste d'interventions déjà chargée pour l'historique — aucune requête
// supplémentaire.
function coutsInterventionsMachine(interventions) {
  return (interventions || []).reduce((total, it) => total + (Number(it.parts_cost) || 0) + (Number(it.labor_cost) || 0), 0);
}
// Somme des coûts d'EXPLOITATION (carburant, assurance, taxes…) d'une
// machine, à partir des lignes déjà chargées pour la fiche.
function coutsExploitationMachine(operatingCosts) {
  return (operatingCosts || []).reduce((total, c) => total + (Number(c.amount) || 0), 0);
}
// Durée écoulée depuis l'achat, en années — plancher 1 mois pour ne pas
// extrapoler follement une machine achetée la semaine dernière.
// joursEntreIso existe déjà (calcul de dates, voir plus haut dans le fichier).
function anneesDepuisAchat(machine) {
  if (!machine || !machine.purchase_date) return null;
  const jours = joursEntreIso(machine.purchase_date, todayIso());
  return Math.max(jours / 365.25, 1 / 12);
}
// Dépréciation comptable ANNUELLE : (achat − revente estimée) / durée
// d'amortissement (nouveau champ, en années — distinct de
// expected_lifespan_counter qui est une durée de vie D'USAGE en heures/km,
// pas une notion comptable). `null` tant que la durée n'est pas renseignée
// — jamais un chiffre inventé à partir d'un barème par catégorie qu'on n'a
// pas (voir keeva-tco-feature phase 2).
function depreciationAnnuelle(machine) {
  if (!machine || machine.amortization_years == null || Number(machine.amortization_years) <= 0) return null;
  const achat = Number(machine.purchase_price) || 0;
  const revente = Number(machine.estimated_resale_value) || 0;
  return Math.max(achat - revente, 0) / Number(machine.amortization_years);
}
// Part de la durée de vie D'USAGE déjà consommée : compteur actuel / durée de vie prévue (en heures ou en km,
// l'unité du compteur de la machine). `null` sans durée de vie renseignée, sans compteur lisible, ou pour une
// machine suivie seulement au calendrier — jamais un pourcentage deviné.
function partDureeDeVie(machine) {
  if (!machine) return null;
  const vie = Number(machine.expected_lifespan_counter);
  if (!(vie > 0)) return null;
  const unite = counterUnitOf(machine);
  if (unite !== 'hours' && unite !== 'km') return null;
  const compteur = machineCounter(machine);
  if (compteur == null || !isFinite(Number(compteur))) return null;
  const consomme = Number(compteur);
  return {
    pct: Math.round((consomme / vie) * 100),
    restant: Math.max(vie - consomme, 0),
    unite,
    depassee: consomme > vie,
  };
}
// Le TCO d'une machine. Retourne `null` sans prix d'achat : c'est ce `null`
// qui décide, partout, si un bloc TCO s'affiche — jamais un calcul sur une
// base à moitié connue.
function tcoMachine(machine, interventions, operatingCosts) {
  if (!machine || machine.purchase_price == null || machine.purchase_price === '') return null;
  const achat = Number(machine.purchase_price) || 0;
  const revente = Number(machine.estimated_resale_value) || 0;
  const parEntretien = coutsInterventionsMachine(interventions);
  const parExploitation = coutsExploitationMachine(operatingCosts);
  const total = achat + parEntretien + parExploitation - revente;
  const usage = machineCounter(machine);
  const coutParUnite = usage ? total / usage : null;
  const ratioMaintenanceAchat = achat > 0 ? parEntretien / achat : null;
  // Phase 2 : dépréciation annuelle — le signal que le brief d'origine décrit
  // réellement pour Garder/Remplacer (« l'entretien coûte plus cher que la
  // dépréciation »), distinct du cumul entretien/achat ci-dessus (une autre
  // statistique, utile mais différente — voir ratioDecisionTco).
  const annees = anneesDepuisAchat(machine);
  const coutEntretienAnnuel = annees ? parEntretien / annees : null;
  const depreciation = depreciationAnnuelle(machine);
  const ratioAmortissement = (depreciation && coutEntretienAnnuel != null) ? coutEntretienAnnuel / depreciation : null;
  return {
    total, parAcquisition: achat, parEntretien, parExploitation, revente, coutParUnite, ratioMaintenanceAchat,
    coutAnnuel: annees ? total / annees : null, coutEntretienAnnuel, depreciationAnnuelle: depreciation, ratioAmortissement,
  };
}
// Le ratio qui pilote VRAIMENT la jauge : priorité à la dépréciation (le
// plus proche du brief) quand elle est calculable, repli sur le cumul
// entretien/achat sinon — jamais bloquant, une machine sans durée
// d'amortissement garde son indicateur (phase 1 inchangée pour elle).
function ratioDecisionTco(tco) {
  if (!tco) return null;
  if (tco.ratioAmortissement != null) return { ratio: tco.ratioAmortissement, base: 'amortissement' };
  if (tco.ratioMaintenanceAchat != null) return { ratio: tco.ratioMaintenanceAchat, base: 'achat' };
  return null;
}
// Phase 3 — filtre de période de la page Coûts & TCO : ratio Garder/
// Remplacer sur une FENÊTRE (12 derniers mois / année en cours) plutôt que
// sur toute la vie de la machine. Même dénominateur que ratioDecisionTco
// (depreciationAnnuelle, un taux comptable CONSTANT, indépendant de la
// période affichée) — seul le numérateur change : l'entretien de la
// fenêtre choisie, ramené à un rythme annuel par nbAnnees (1 pour
// « 12 derniers mois », fraction de l'année écoulée pour « Année en
// cours »). Pas de repli sur le cumul entretien/achat ici : ce cumul est
// intrinsèquement lifetime (« quelle part de sa valeur ai-je dépensée en
// tout »), une variante « période » de cette statistique-là ne voudrait
// rien dire — l'appelant garde alors le ratio lifetime (voir VIEWS.tco).
function ratioDecisionTcoSurPeriode(machine, interventionsPeriode, nbAnnees) {
  const depreciation = depreciationAnnuelle(machine);
  if (!depreciation || !nbAnnees) return null;
  const entretienAnnualise = coutsInterventionsMachine(interventionsPeriode) / nbAnnees;
  return { ratio: entretienAnnualise / depreciation, base: 'amortissement' };
}
// Dépenses d'entretien + exploitation sur une fenêtre temporelle — JAMAIS
// le prix d'achat, qui n'a de sens que sur la durée de vie complète. Ce
// N'EST PAS un TCO (tco.total inclut toujours achat − revente) : juste
// « ce qui a été dépensé pendant cette période », affiché sous un libellé
// différent pour ne jamais confondre les deux notions à l'écran.
function depensesSurPeriode(interventionsPeriode, coutsPeriode) {
  return coutsInterventionsMachine(interventionsPeriode) + coutsExploitationMachine(coutsPeriode);
}
// Seuils : 30 %/50 % du prix d'achat cumulés en entretien (repli, inchangé
// depuis la phase 1) ; 50 %/100 % de la dépréciation ANNUELLE quand elle
// est calculable — 100 % y est le point exact où l'entretien coûte déjà
// aussi cher que la dépréciation, ce que le brief appelle le
// « point d'inflexion ». Vocabulaire d'état déjà en place (ok/soon/late —
// vert/orange/rouge, mêmes variables CSS que la jauge d'intervalle).
function etatTco(ratio, base) {
  if (ratio == null || !isFinite(ratio)) return 'ok';
  if (base === 'amortissement') {
    if (ratio >= 1) return 'late';
    if (ratio >= 0.5) return 'soon';
    return 'ok';
  }
  if (ratio >= 0.5) return 'late';
  if (ratio >= 0.3) return 'soon';
  return 'ok';
}
// Libellés distincts par base : l'utilisateur doit TOUJOURS savoir sur quoi
// le voyant se base, jamais un chiffre silencieux qui change de sens.
const TCO_ETAT_LABEL = {
  achat: {
    ok: () => trad('Rentable'),
    soon: () => trad('Point d\'inflexion'),
    late: () => trad('Pensez au remplacement'),
  },
  amortissement: {
    ok: () => trad('Rentable'),
    soon: () => trad('Entretien proche de la dépréciation annuelle'),
    late: () => trad('Entretien dépasse la dépréciation — envisager le remplacement'),
  },
};
// Jauge « Garder / Remplacer » — même idiome que jaugeIntervalleHtml
// (.machine-jauge, .is-ok/.is-soon/.is-late déjà stylées), jamais de
// pourcentage brut affiché.
function jaugeTcoHtml(tco) {
  const decision = ratioDecisionTco(tco);
  if (!decision) return '';
  const etat = etatTco(decision.ratio, decision.base);
  const part = Math.max(4, Math.min(100, Math.round(decision.ratio * 100)));
  const libelles = TCO_ETAT_LABEL[decision.base] || TCO_ETAT_LABEL.achat;
  return `<div class="machine-jauge" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${part}" aria-label="${esc(libelles[etat]())}">
      <span class="machine-jauge-tete"><span class="machine-jauge-mot">${trad('Garder / Remplacer')}</span><span class="machine-jauge-valeur">${libelles[etat]()}</span></span>
      <span class="machine-jauge-piste"><span class="machine-jauge-part is-${etat}" style="width:${part}%"></span></span>
    </div>`;
}

// ── TCO flotte (phase 2) — agrégation pure, pas d'accès réseau ici ──
// Sépare pièces/main d'œuvre — nécessaire pour le donut réel de la flotte ;
// tcoMachine()/coutsInterventionsMachine() les somment ENSEMBLE dans
// parEntretien, à dessein pour le ratio d'une machine (pas touché, cette
// fonction est un ajout à part).
function ventilationCoutsInterventions(interventions) {
  return (interventions || []).reduce((acc, it) => {
    acc.pieces += Number(it.parts_cost) || 0;
    acc.mainOeuvre += Number(it.labor_cost) || 0;
    // Phase 3 : heures MO réellement déclarées — affichées telles quelles
    // dans la légende du donut (remplace un décompte "factures vérifiées"
    // qu'on ne trace pas par un chiffre qu'on trace vraiment).
    acc.heures += Number(it.labor_hours) || 0;
    return acc;
  }, { pieces: 0, mainOeuvre: 0, heures: 0 });
}
// Classe les machines de la flotte par TCO — pire ratio d'abord (le ratio
// de dépréciation quand il existe, sinon le repli cumul/achat, jamais les
// deux mélangés dans un même tri : `decision.base` dit lequel, voir
// ratioDecisionTco). Une machine sans purchase_price est EXCLUE (tcoMachine
// retourne null) et comptée séparément — jamais cachée en silence.
// `interventionsParMachine`/`coutsParMachine` : Map(machine_id -> lignes),
// voir grouperParMachine().
function calculerFlotteTco(machines, interventionsParMachine, coutsParMachine) {
  const exclues = [];
  const lignes = (machines || [])
    .map((m) => {
      const tco = tcoMachine(m, interventionsParMachine.get(m.id) || [], coutsParMachine.get(m.id) || []);
      if (!tco) { exclues.push(m); return null; }
      return { machine: m, tco, decision: ratioDecisionTco(tco) };
    })
    .filter(Boolean)
    .sort((a, b) => (b.decision?.ratio ?? -Infinity) - (a.decision?.ratio ?? -Infinity));
  if (!lignes.length) return null;
  const moyenne = (sel) => lignes.reduce((s, l) => s + (sel(l) ?? 0), 0) / lignes.length;
  return {
    lignes,
    exclues,
    coutAnnuelMoyen: moyenne((l) => l.tco.coutAnnuel),
    ratioMoyen: moyenne((l) => l.decision?.ratio),
    nbAlertes: lignes.filter((l) => l.decision && etatTco(l.decision.ratio, l.decision.base) === 'late').length,
  };
}
// Tendance du ratio moyen de la flotte (mockup Stitch « Ratio moyen sain ») —
// reformule le MÊME flotte.ratioMoyen déjà calculé, jamais un jugement séparé.
// Factorisée : utilisée par la page Coûts & TCO (KPI) ET le widget TCO du
// tableau de bord, pour ne jamais avoir deux libellés qui divergent sur le
// même chiffre.
function tendanceRatioMoyenFlotte(flotte) {
  const etat = flotte.ratioMoyen != null ? etatTco(flotte.ratioMoyen) : 'ok';
  const LABEL = { ok: trad('Ratio moyen sain'), soon: trad('Ratio à surveiller'), late: trad('Ratio élevé') };
  const ICONE = { ok: 'flecheBas', soon: 'chevron', late: 'flecheHaut' };
  return { etat, label: LABEL[etat], icone: ICONE[etat] };
}
// Machines de la flotte dont le coût horaire dépasse le seuil cible de LEUR
// PROPRE catégorie (phase 3, §5) — jamais comparées à un seuil unique flotte
// (les catégories sont hétérogènes, voir keeva-tco-feature). `[]` si aucune
// catégorie n'a de seuil défini : jamais un compte fabriqué.
function machinesAuDessusSeuilCategorie(flotte) {
  return flotte.lignes.filter(({ machine, tco }) => {
    const seuil = machine.category?.target_hourly_cost;
    return seuil != null && tco.coutParUnite != null && tco.coutParUnite > Number(seuil);
  });
}
// La catégorie à mettre en avant sur le widget TCO du tableau de bord
// (mockup : une carte « Motoculture & Espaces verts · Seuil cible… »). Choisit
// la catégorie réelle la PLUS EN ÉCART par rapport à SON seuil (positif =
// au-dessus, à surveiller en premier) parmi celles qui ont À LA FOIS un seuil
// défini ET au moins une machine avec un coût horaire calculable — jamais une
// catégorie choisie au hasard ou sans donnée réelle derrière. `null` si
// aucune catégorie ne remplit ces deux conditions (le sous-bloc ne s'affiche
// alors pas du tout, voir tcoDashboardCarteHtml).
function categorieTcoAMettreEnAvant(flotte) {
  const parCategorie = new Map();
  flotte.lignes.forEach(({ machine, tco }) => {
    const cat = machine.category;
    if (!cat || cat.target_hourly_cost == null || tco.coutParUnite == null) return;
    if (!parCategorie.has(cat.id)) parCategorie.set(cat.id, { categorie: cat, valeurs: [] });
    parCategorie.get(cat.id).valeurs.push(tco.coutParUnite);
  });
  let meilleure = null;
  parCategorie.forEach(({ categorie, valeurs }) => {
    const moyenne = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
    const ecart = moyenne - Number(categorie.target_hourly_cost);
    if (!meilleure || ecart > meilleure.ecart) meilleure = { categorie, moyenne, ecart };
  });
  return meilleure;
}
// Répartition RÉELLE pièces / main d'œuvre / coûts d'exploitation sur toute
// la flotte, en pourcentages — remplace le donut « MODÈLE KALEA » (statique,
// phase 1) par un calcul sur les coûts effectivement enregistrés. `null`
// si rien n'a encore été saisi (jamais 0/0/0 présenté comme un vrai zéro).
function repartitionFlotteTco(interventionsToutes, coutsToutes) {
  const { pieces, mainOeuvre, heures } = ventilationCoutsInterventions(interventionsToutes);
  const fixes = (coutsToutes || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const total = pieces + mainOeuvre + fixes;
  if (!total) return null;
  return { pieces, mainOeuvre, fixes, heures, total, pctPieces: (pieces / total) * 100, pctMainOeuvre: (mainOeuvre / total) * 100, pctFixes: (fixes / total) * 100 };
}

// ══════════════════════════════════════════════════════════════════════════
// ★ RAPPORT TCO (PDF) — calculs purs, aucun accès réseau. Tout part de
// `flotte`/`interventionsFlotte`/`coutsFlotte` déjà chargés par
// VIEWS.tco.mount() — jamais un second fetch flotte-entière pour le rapport.

// CAPEX de la fenêtre affichée. Deux régimes, JAMAIS mélangés :
//  · nbAnnees != null (12 derniers mois / année en cours) : la dépréciation
//    comptable annuelle au prorata — Σ depreciationAnnuelle(m) × nbAnnees.
//    Les machines sans amortization_years sont EXCLUES et COMPTÉES
//    (depreciationAnnuelle renvoie null) — jamais une durée supposée.
//  · nbAnnees == null (« Depuis mise en service ») : le capital RÉELLEMENT
//    consommé, Σ (parAcquisition − revente) — exactement la part achat déjà
//    incluse dans tco.total. Une dépréciation « annuelle » n'aurait aucun
//    sens sur une fenêtre sans durée propre.
function capexFlotteSurPeriode(flotte, nbAnnees) {
  let total = 0;
  let nbRetenues = 0;
  let nbSansDuree = 0;
  (flotte?.lignes || []).forEach(({ machine, tco }) => {
    if (nbAnnees != null) {
      const dep = depreciationAnnuelle(machine);
      if (dep == null) { nbSansDuree++; return; }
      total += dep * nbAnnees;
      nbRetenues++;
    } else {
      total += Math.max((tco.parAcquisition || 0) - (tco.revente || 0), 0);
      nbRetenues++;
    }
  });
  return { total, base: nbAnnees != null ? 'depreciation' : 'cumul', nbRetenues, nbSansDuree };
}
// TCO global de la période = CAPEX (ci-dessus) + OPEX (repartitionFlotteTco,
// déjà calculé par rendreDynamique() sur la MÊME fenêtre — jamais recalculé
// ici). `null` si les deux composantes sont nulles : rien à dire, la carte
// disparaît plutôt que d'afficher un zéro.
function tcoGlobalPeriode(capex, repartition) {
  const opex = repartition?.total || 0;
  const total = (capex?.total || 0) + opex;
  if (!total) return null;
  return {
    total, capex: capex.total, opex,
    pctCapex: (capex.total / total) * 100, pctOpex: (opex / total) * 100,
    base: capex.base, nbSansDuree: capex.nbSansDuree,
  };
}
// Coût réel moyen par unité d'usage vs cible pondérée — GROUPÉ PAR UNITÉ DE
// COMPTEUR (heures/km, counterUnitOf) : additionner des heures et des
// kilomètres dans un même quotient produirait un nombre qui ne veut rien
// dire. Moyenne PONDÉRÉE PAR L'USAGE (Σcoûts/Σusage), pas une moyenne de
// moyennes — une machine à 40 h ne doit pas peser autant qu'une à 4 000 h.
// Cible pondérée = Σ(seuil_i × usage_i) / Σusage_i, sur le SOUS-ENSEMBLE des
// machines dont la catégorie a un seuil — `cible: null` si aucune n'en a,
// jamais un seuil inventé.
function coutUsageMoyenVsCible(flotte) {
  const parUnite = new Map();
  (flotte?.lignes || []).forEach(({ machine, tco }) => {
    if (tco.coutParUnite == null) return;
    const usage = machineCounter(machine);
    if (!usage) return;
    const unit = counterUnitOf(machine);
    if (!parUnite.has(unit)) {
      parUnite.set(unit, { unite: unit, uniteCourte: counterShort(unit), usageCumule: 0, coutCumule: 0, seuilCumule: 0, usageAvecSeuil: 0, nbRetenues: 0, nbSansSeuil: 0 });
    }
    const bucket = parUnite.get(unit);
    bucket.usageCumule += usage;
    bucket.coutCumule += tco.coutParUnite * usage;
    bucket.nbRetenues++;
    const seuil = machine.category?.target_hourly_cost;
    if (seuil != null) {
      bucket.seuilCumule += Number(seuil) * usage;
      bucket.usageAvecSeuil += usage;
    } else {
      bucket.nbSansSeuil++;
    }
  });
  let uniteDominante = null;
  let usageMax = -1;
  const resultat = new Map();
  parUnite.forEach((b, unit) => {
    const reel = b.usageCumule ? b.coutCumule / b.usageCumule : null;
    const cible = b.usageAvecSeuil ? b.seuilCumule / b.usageAvecSeuil : null;
    resultat.set(unit, {
      unite: b.unite, uniteCourte: b.uniteCourte, reel, cible,
      ecart: (reel != null && cible != null) ? reel - cible : null,
      ecartPct: (reel != null && cible) ? ((reel - cible) / cible) * 100 : null,
      nbRetenues: b.nbRetenues, nbSansSeuil: b.nbSansSeuil, usageCumule: b.usageCumule,
    });
    if (b.usageCumule > usageMax) { usageMax = b.usageCumule; uniteDominante = unit; }
  });
  return { parUnite: resultat, uniteDominante };
}
// Construite SUR machinesAuDessusSeuilCategorie() (jamais un second filtre),
// avec l'écart chiffré (unitaire et cumulé sur l'usage total de la machine).
// ⚠ Périmètre LIFETIME (tco.coutParUnite inclut l'achat depuis toujours, pas
// depuis le début de la période affichée à l'écran) — à étiqueter
// explicitement « depuis la mise en service » partout où ces chiffres sont
// montrés, jamais sous l'en-tête de la période choisie.
function depassementsSeuilAvecEcart(flotte) {
  const au = machinesAuDessusSeuilCategorie(flotte);
  let ecartCumuleTotal = 0;
  let nbEcartIncalculable = 0;
  const liste = au.map(({ machine, tco, decision }) => {
    const seuil = Number(machine.category.target_hourly_cost);
    const coutReel = tco.coutParUnite;
    const usage = machineCounter(machine);
    const uniteCourte = counterShort(counterUnitOf(machine));
    const ecartUnitaire = coutReel - seuil;
    const ecartPct = seuil ? (ecartUnitaire / seuil) * 100 : null;
    const ecartCumule = usage ? ecartUnitaire * usage : null;
    if (ecartCumule != null) ecartCumuleTotal += ecartCumule; else nbEcartIncalculable++;
    return {
      machine, tco, decision, seuil, coutReel, uniteCourte, ecartUnitaire, ecartPct, usage, ecartCumule,
      severite: severiteEcartSeuil(ecartPct != null ? ecartPct / 100 : null),
    };
  }).sort((a, b) => (b.ecartCumule ?? -Infinity) - (a.ecartCumule ?? -Infinity));
  return { liste, nb: liste.length, ecartCumuleTotal, nbEcartIncalculable };
}
// Seuils de PRÉSENTATION, nouveaux et assumés comme tels — etatTco() mesure
// entretien/dépréciation, une autre grandeur, pas réutilisable ici. Le
// pourcentage RÉEL reste toujours imprimé à côté du mot, même discipline que
// ligneClassementTcoHtml : le lecteur ne dépend jamais de l'étiquette seule.
// `ecartFraction` : 0,5 = 50 % au-dessus du seuil.
function severiteEcartSeuil(ecartFraction) {
  if (ecartFraction == null) return null;
  if (ecartFraction >= 0.5) return 'critique';
  if (ecartFraction >= 0.25) return 'eleve';
  if (ecartFraction > 0) return 'modere';
  return null;
}
// UNE phrase factuelle par machine hors cible. RÈGLE ABSOLUE : chaque
// branche ne cite que (a) des nombres calculés de CETTE machine, (b) le
// seuil que la société a elle-même saisi, (c) une notion qui existe déjà
// dans l'application. Aucune cause de panne, aucune pièce, aucune date
// future, aucun fournisseur, aucun pourcentage vs N-1 — voir keeva-tco-feature
// (le paragraphe « Analyse de la Direction » du rapport de référence n'est
// PAS repris pour cette raison : aucune donnée ne le porte honnêtement).
function recommandationSeuilTco(ligne, ventilationPeriode) {
  const { decision, machine } = ligne;
  if (decision && decision.base === 'amortissement') {
    const pct = Math.round(decision.ratio * 100);
    if (decision.ratio >= 1) {
      return tR('Entretien annualisé à {n} % de la dépréciation annuelle : le remplacement se justifie chiffres en main.', { n: pct });
    }
    if (decision.ratio >= 0.5) {
      return tR('Entretien annualisé à {n} % de la dépréciation annuelle — point d\'inflexion approché, à revoir au prochain entretien.', { n: pct });
    }
    // Sous 50 % : ce ratio-là n'est pas le signal le plus parlant ici — on
    // regarde plutôt la composition de l'entretien de la période, ci-dessous.
  } else {
    // ratioAmortissement (tcoMachine) exige DEUX champs à la fois
    // (amortization_years ET purchase_date, via anneesDepuisAchat) — nommer
    // celui qui manque réellement, jamais toujours le même mot par défaut.
    if (machine.amortization_years == null) {
      return trad('Durée d\'amortissement non renseignée : dépassement mesuré, arbitrage garder/remplacer impossible à chiffrer précisément.');
    }
    if (!machine.purchase_date) {
      return trad('Date d\'achat non renseignée : dépassement mesuré, arbitrage garder/remplacer impossible à chiffrer précisément.');
    }
    return trad('Dépassement mesuré, arbitrage garder/remplacer impossible à chiffrer précisément avec les données disponibles.');
  }
  const v = ventilationPeriode;
  if (v && (v.pieces || v.mainOeuvre)) {
    const totalV = v.pieces + v.mainOeuvre;
    if (v.pieces >= v.mainOeuvre) {
      return tR('Dépassement porté surtout par les pièces ({n} % de l\'entretien de la période).', { n: Math.round((v.pieces / totalV) * 100) });
    }
    return tR('Dépassement porté surtout par la main d\'œuvre ({n} % de l\'entretien de la période).', { n: Math.round((v.mainOeuvre / totalV) * 100) });
  }
  return trad('Aucun entretien enregistré sur la période : le dépassement vient des coûts d\'exploitation et de l\'achat.');
}
// Les N derniers trimestres CIVILS, du plus ancien au plus récent, le
// dernier étant celui EN COURS (partiel — à le dire dans la légende, un
// trimestre incomplet à côté de pleins se lirait sinon comme une baisse).
function trimestresRecents(n = 4, ref) {
  const base = ref ? new Date(ref) : new Date();
  const trimCourant = Math.floor(base.getMonth() / 3);
  const resultat = [];
  for (let i = n - 1; i >= 0; i--) {
    const offset = trimCourant - i;
    const annee = base.getFullYear() + Math.floor(offset / 4);
    const trim = ((offset % 4) + 4) % 4;
    const moisDebut = trim * 3;
    const debut = new Date(annee, moisDebut, 1);
    const fin = new Date(annee, moisDebut + 3, 1);
    resultat.push({
      cle: `${annee}-T${trim + 1}`,
      label: tR('T{n} {annee}', { n: trim + 1, annee }),
      debutIso: debut.toISOString().slice(0, 10),
      finIso: fin.toISOString().slice(0, 10),
      enCours: i === 0,
    });
  }
  return resultat;
}
// Bucketing par comparaison de CHAÎNES ISO ('YYYY-MM-DD'), exactement
// l'idiome déjà utilisé par le filtre de période (it.performed_at >= borne,
// voir VIEWS.tco.mount()) — aucun parsing de Date, aucun décalage de fuseau
// possible. Lignes sans date : ignorées et COMPTÉES (`ignorees`), jamais
// silencieusement versées dans le premier trimestre. Lignes datées mais hors
// des n derniers trimestres : simplement hors fenêtre, pas une anomalie.
// Regroupement à 3 séries — choix de présentation assumé : Carburant
// (kind==='fuel'), Pièces (parts_cost des interventions), et « Main d'œuvre
// & frais fixes » qui fusionne labor_cost + tout coût d'exploitation dont le
// genre n'est PAS 'fuel' (donc other + tax + insurance + storage, les 5
// genres réels de operating_costs.kind moins le carburant déjà à part) — la
// légende doit nommer ce contenu réel, ne jamais reprendre un libellé du
// rapport de référence qui ne nommerait qu'un seul des quatre genres fusionnés.
function evolutionOpexParTrimestre(interventionsFlotte, coutsFlotte, n = 4) {
  const trimestres = trimestresRecents(n);
  const carburant = new Array(n).fill(0);
  const pieces = new Array(n).fill(0);
  const mainOeuvreEtFrais = new Array(n).fill(0);
  let ignorees = 0;
  const trouverIndex = (iso) => trimestres.findIndex((t) => iso >= t.debutIso && iso < t.finIso);
  (interventionsFlotte || []).forEach((it) => {
    if (!it.performed_at) { ignorees++; return; }
    const idx = trouverIndex(it.performed_at);
    if (idx === -1) return;
    pieces[idx] += Number(it.parts_cost) || 0;
    mainOeuvreEtFrais[idx] += Number(it.labor_cost) || 0;
  });
  (coutsFlotte || []).forEach((c) => {
    if (!c.incurred_at) { ignorees++; return; }
    const idx = trouverIndex(c.incurred_at);
    if (idx === -1) return;
    const montant = Number(c.amount) || 0;
    if (c.kind === 'fuel') carburant[idx] += montant; else mainOeuvreEtFrais[idx] += montant;
  });
  const totaux = trimestres.map((_, i) => carburant[i] + pieces[i] + mainOeuvreEtFrais[i]);
  const max = Math.max(0, ...totaux);
  return { trimestres, series: { carburant, pieces, mainOeuvreEtFrais }, totaux, max, ignorees, vide: max === 0 };
}
// Assemble tout ce qui précède pour le rapport TCO — une seule fonction
// pure, testable sans jsPDF. `periode` est l'une des clés déjà utilisées par
// le filtre de l'écran ('total'|'12m'|'annee'), `borne`/`annees` ses bornes
// déjà calculées par borneDepuis()/anneesFenetre() (VIEWS.tco.mount()) —
// jamais un second calcul de fenêtre temporelle.
function assemblerDonneesRapportTco({ flotte, interventionsFlotte, coutsFlotte, periode, borne, annees, topN = 8 }) {
  const interventionsFlat = borne ? interventionsFlotte.filter((it) => it.performed_at >= borne) : interventionsFlotte;
  const coutsFlat = borne ? coutsFlotte.filter((c) => c.incurred_at >= borne) : coutsFlotte;
  const repartition = repartitionFlotteTco(interventionsFlat, coutsFlat);
  const capex = capexFlotteSurPeriode(flotte, annees);
  const global = tcoGlobalPeriode(capex, repartition);
  const coutUsage = coutUsageMoyenVsCible(flotte);
  const depassementsToutes = depassementsSeuilAvecEcart(flotte);
  // Recommandation par ligne : composition de l'entretien de LA MACHINE sur
  // LA MÊME fenêtre que le reste du rapport (jamais lifetime pour cette part).
  const interventionsParMachine = grouperParMachine(interventionsFlat);
  const depassements = {
    ...depassementsToutes,
    liste: depassementsToutes.liste.slice(0, topN).map((ligne) => ({
      ...ligne,
      recommandation: recommandationSeuilTco(ligne, ventilationCoutsInterventions(interventionsParMachine.get(ligne.machine.id) || [])),
    })),
    resteNonListe: Math.max(0, depassementsToutes.liste.length - topN),
  };
  const trimestres = evolutionOpexParTrimestre(interventionsFlotte, coutsFlotte, 4);
  const PERIODE_LABEL = { total: trad('Depuis mise en service'), '12m': trad('12 derniers mois'), annee: trad('Année en cours') };
  // Extrait par machine (page 3) : ventilation pièces/main d'œuvre/frais
  // fixes/carburant LIFETIME (mêmes lignes que tco.total, jamais bornées à la
  // période affichée — l'extrait décrit la machine, pas la fenêtre choisie),
  // même découpage par `kind` que le graphique trimestriel (carburant à
  // part, le reste des genres fusionné en « frais fixes »).
  const interventionsParMachineTout = grouperParMachine(interventionsFlotte);
  const coutsParMachineTout = grouperParMachine(coutsFlotte);
  const extrait = flotte.lignes.map(({ machine, tco }) => {
    const vent = ventilationCoutsInterventions(interventionsParMachineTout.get(machine.id) || []);
    const coutsMachine = coutsParMachineTout.get(machine.id) || [];
    const carburant = coutsMachine.filter((c) => c.kind === 'fuel').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const fraisFixes = coutsMachine.filter((c) => c.kind !== 'fuel').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return { machine, tco, pieces: vent.pieces, mainOeuvre: vent.mainOeuvre, fraisFixes, carburant };
  });
  // Catégories réellement présentes dans la flotte, sans seuil défini — un
  // comptage honnête, jamais fabriqué.
  const categoriesSansSeuil = new Set();
  flotte.lignes.forEach(({ machine }) => {
    if (machine.category && machine.category.target_hourly_cost == null) categoriesSansSeuil.add(machine.category.id);
  });
  return {
    societe: UI.companyName || trad('Ta société'),
    devise: UI.company?.currency || 'EUR',
    dateIso: todayIso(),
    periodeLabel: PERIODE_LABEL[periode] || PERIODE_LABEL.total,
    periode, borne, annees, topN,
    flotte, global, coutUsage, depassements, repartition, trimestres, extrait,
    exclusions: {
      sansPrixAchat: flotte.exclues.length,
      sansDuree: capex.nbSansDuree,
      sansSeuil: categoriesSansSeuil.size,
      ignorees: trimestres.ignorees,
    },
  };
}

// SECOND SUIVI (optionnel) — mêmes principes que le principal, mais SANS
// repli historique : la fonctionnalité n'existe qu'après la migration
// dédiée, donc rien à lire ni à écrire tant que SCHEMA.hasCounter2 est faux
// (les patches renvoient {} : ils s'assemblent sans effet dans un payload
// d'écriture). Trois formes possibles, comme le suivi principal :
// 'hours' | 'km' (un second COMPTEUR, avec son propre relevé) ou 'days' (un
// second suivi CALENDAIRE — pas de relevé, chaque tâche porte sa propre date
// comme le fait déjà le calendaire principal). counter_unit_2 sert de
// marqueur pour les trois cas ; counter_value_2 ne compte que pour les deux
// premiers.
function modeSecondaireDe(machine) {
  const m = machine && machine.counter_unit_2;
  return (m === 'km' || m === 'hours' || m === 'days') ? m : null;
}
// Restreint au cas COMPTEUR (jamais 'days') : c'est ce que veulent la plupart
// des appelants existants (relevé à afficher/saisir, compatibilité d'unité).
function counterUnit2Of(machine) {
  const m = modeSecondaireDe(machine);
  return (m === 'km' || m === 'hours') ? m : null;
}
function machineCounter2(machine) {
  if (!machine || !SCHEMA.hasCounter2) return null;
  const v = machine.counter_value_2;
  return v == null ? null : Number(v);
}
function machineCounter2Patch(value, unit) {
  if (!SCHEMA.hasCounter2) return {};
  return { counter_value_2: value, counter_unit_2: unit };
}
function planIntervalCounter2(plan) {
  if (!plan || !SCHEMA.hasCounter2) return null;
  return plan.interval_counter_2 ?? null;
}
function planNextDueCounter2(plan) {
  if (!plan || !SCHEMA.hasCounter2) return null;
  return plan.next_due_counter_2 ?? null;
}
function planReminderCounter2(plan) {
  if (!plan || !SCHEMA.hasCounter2) return FALLBACK_REMINDER_HOURS;
  return plan.reminder_counter_before_2 ?? FALLBACK_REMINDER_HOURS;
}
function planCounter2Patch(interval, reminder) {
  if (!SCHEMA.hasCounter2) return {};
  return { interval_counter_2: interval, reminder_counter_before_2: reminder };
}
function planNextDueCounter2Patch(nextDue) {
  if (!SCHEMA.hasCounter2) return {};
  return { next_due_counter_2: nextDue };
}
// Le pendant CALENDAIRE des mêmes accesseurs, colonnes _2 dédiées.
function planIntervalDays2(plan) {
  if (!plan || !SCHEMA.hasCounter2) return null;
  return plan.interval_days_2 ?? null;
}
function planNextDueAt2(plan) {
  if (!plan || !SCHEMA.hasCounter2) return null;
  return plan.next_due_at_2 ?? null;
}
function planReminderDays2(plan) {
  if (!plan || !SCHEMA.hasCounter2) return FALLBACK_REMINDER_DAYS;
  return plan.reminder_days_before_2 ?? FALLBACK_REMINDER_DAYS;
}
function planJours2Patch(interval, reminder) {
  if (!SCHEMA.hasCounter2) return {};
  return { interval_days_2: interval, reminder_days_before_2: reminder };
}
function planNextDueAt2Patch(nextDue) {
  if (!SCHEMA.hasCounter2) return {};
  return { next_due_at_2: nextDue };
}
// Compatibilité d'une unité de TÂCHE (jours/semaines/mois/ans) avec un second
// suivi CALENDAIRE : seulement si ce second suivi est bien réglé sur 'days'.
function uniteCompatibleCalendaireSecondaire(unite, machine) {
  const info = UNITES_INTERVALLE[unite];
  return !!info && info.genre === 'date' && modeSecondaireDe(machine) === 'days';
}
// L'échéance du plan n'avance QUE si au moins un élément de CE plan a réellement
// été coché. Règle volontairement prudente : enregistrer un entretien sans rien
// cocher (graissage, réparation, autre travail) ne doit pas effacer une échéance
// déjà dépassée qu'on n'a pas faite. Un plan sans aucun élément détaillé garde
// le comportement d'avant : on ne peut rien cocher, l'entretien porte donc sur
// le plan et l'échéance avance.
//
// Depuis le chantier « une échéance par tâche », ce garde-fou ne sert plus qu'aux
// plans SANS élément détaillé : dès qu'un plan a des éléments, chacune de ses
// tâches porte sa propre échéance (voir tachesApresEntretien ci-dessous).
function journalAvanceEcheance(items, checked) {
  if (!items.length) return true;
  return checked.length > 0;
}
// Classe d'habillage du bandeau d'échéance selon l'état.
function heroClass(state) { return state === 'late' ? 'alert' : (state === 'soon' ? 'soon' : 'ok'); }

// Le trigger d'application des offres (côté base) renvoie ce message lorsque la
// limite est franchie — typiquement quand deux postes ajoutent une machine en
// même temps, cas que le contrôle du navigateur ne peut pas voir. L'ancienne
// formulation (« limite du plan gratuit ») reste reconnue : la base peut encore
// porter l'ancien message tant que la migration des paliers n'est pas exécutée.
function isQuotaError(err) {
  const message = String(err && err.message ? err.message : err || '');
  return /limite (du plan gratuit|de ton offre)/i.test(message);
}

// supabase-js ne remonte qu'un « Edge Function returned a non-2xx status code »
// quand une fonction Edge répond 401, 403, 429… Or c'est justement là que se
// trouve le message utile (quota atteint, session expirée). Le corps de la
// réponse est accessible via error.context.
async function functionErrorMessage(error, defaut = trad('appel impossible')) {
  if (error && error.context && typeof error.context.json === 'function') {
    try {
      const corps = await error.context.clone().json();
      if (corps && corps.error) return String(corps.error);
    } catch (e) { /* corps absent, déjà consommé ou non JSON */ }
  }
  return (error && error.message) || defaut;
}

// ── UNE ÉCHÉANCE PAR TÂCHE ────────────────────────────────────
// Chaque élément d'un plan (maintenance_plans.items, JSONB, qui porte déjà
// label / frequency / spec / qty / note) peut porter en plus :
//   interval                            l'intervalle propre à la tâche, dans l'unité du plan
//   last_done_counter / last_done_at    le relevé (compteur) ou la date du dernier entretien DE CETTE TÂCHE
//   due_counter / due_at                sa prochaine échéance
//
// RÈGLE D'OR : l'échéance du plan (next_due_counter / next_due_hours /
// next_due_at) est LA PLUS PROCHE des échéances de ses tâches, recalculée à
// chaque écriture concernée. Rappels, alertes et tris continuent donc de
// fonctionner sans rien changer — c'est déjà la valeur que lit la fonction de
// rappels (send-maintenance-reminders).
//
// RÈGLE DE REPRISE (plans existants) : un élément qui n'a pas encore d'échéance
// reçoit celle du plan au moment de l'enregistrement. L'affichage ne change donc
// PAS avant le premier enregistrement (les plans déjà extraits de carnets gardent
// exactement leur état actuel) ; ensuite les tâches divergent au fur et à mesure
// qu'on les coche.
//
// RIEN N'EST INVENTÉ : un intervalle qui ne se déduit pas de « frequency »
// (« à chaque utilisation », « tous les 6 mois », texte libre…) reste absent. La
// tâche s'affiche, reste cochable, mais sort du calcul de la plus proche — et
// l'interface écrit « Intervalle à préciser » au lieu de laisser croire qu'elle
// est suivie. Les mois et les années ne sont PAS convertis en jours (un mois ne
// fait pas un nombre de jours fixe) : ils restent à préciser à la main.
function uniteSuivi(plan, machine) {
  if (!planIsCounter(plan)) return 'days';
  if (machine) return counterUnitOf(machine);
  return (plan && plan.tracking_mode === 'km') ? trad('km') : 'hours';
}

// Intervalle lu dans le texte de « frequency », dans l'unité du plan. Renvoie
// null quand il n'est pas déductible sans l'inventer.
function intervalleDepuisTexte(frequency, unite) {
  const texte = sansSeparateursDeMilliers(frequency)
    .toLowerCase()
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/,/g, '.');
  if (!texte.trim()) return null;
  // L'extraction écrit souvent « Vidange initiale à 20 h puis toutes les
  // 100 heures » : c'est l'intervalle RÉCURRENT qui compte, donc ce qui suit
  // « puis ». On essaie d'abord cette portion, puis le texte entier.
  const morceaux = texte.split(/\b(?:puis|ensuite|par la suite|then|à partir de)\b/);
  const portion = morceaux.length > 1 ? morceaux.slice(1).join(' ') : null;
  const candidats = portion ? [portion, texte] : [texte];
  const nombre = (motif) => {
    const m = texte.match(motif);
    if (!m) return null;
    const n = parseFloat(String(m[1]).replace(/\s/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const cherche = (motif) => {
    for (const candidat of candidats) {
      const m = candidat.match(motif);
      if (!m) continue;
      const n = parseFloat(String(m[1]).replace(/\s/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };
  if (unite === 'days') {
    const jours = cherche(/(\d+(?:\.\d+)?)\s*(?:jours?|journee?s?|days?|day|j\b|d\b)/);
    if (jours != null) return jours;
    const semaines = cherche(/(\d+(?:\.\d+)?)\s*(?:semaines?|weeks?|sem\b)/);
    if (semaines != null) return Math.round(semaines * 7);
    return null;
  }
  if (unite === 'km') return cherche(/([\d\s]*\d+(?:\.\d+)?)\s*(?:km|kilom)/);
  return cherche(/(\d+(?:\.\d+)?)\s*(?:heures?|hrs?\b|hours?|h\b)/);
}

// Intervalle d'une tâche : celui déjà mémorisé, sinon celui déduit du texte.
function intervalleTacheDepuis(item, unite) {
  if (!item) return null;
  const memorise = Number(item.interval);
  if (Number.isFinite(memorise) && memorise > 0) return memorise;
  return intervalleDepuisTexte(item.frequency, unite);
}
function intervalleTache(item, plan, machine) {
  const resolu = resolutionIntervalle(item, plan, machine);
  return resolu ? resolu.interval : null;
}

// ── AMBIGUÏTÉ DU CARNET : ON DEMANDE, ON NE DEVINE PAS ────────
// Beaucoup de carnets donnent PLUSIEURS fréquences selon l'usage :
//   « Frein de chaîne — Professionnel : 3 mois / Partiel : 6 mois / Occasionnel : 1 an »
//   « Extincteur — contrôle tous les 1 à 2 ans »
//   « Porte-couteaux — 100 heures ou 2 ans »
// Dans ce cas on mémorise les OPTIONS extraites et AUCUN intervalle unique :
// c'est l'utilisateur qui tranche.
//   interval_choices: [{ libelle: 'Professionnel', interval: 3, unite: 'mois' }, …]
// Une fois le choix fait :
//   interval: 3, interval_unite: 'mois', interval_choisi: 'Professionnel'
// Aucune option n'est inventée : chacune vient du texte du carnet.
//
// Les tâches de CONTRÔLE (« chaque utilisation », « au besoin », « selon le
// manuel moteur ») ne sont ni ambiguës ni planifiables : elles restent des
// points de contrôle, sans échéance, et AUCUN choix ne leur est proposé.
const UNITES_INTERVALLE = {
  heures: { mot: trad('heures'), libelle: trad('Heures'), court: trad('h'), genre: 'compteur' },
  km: { mot: trad('km'), libelle: trad('Km'), court: trad('km'), genre: 'compteur' },
  jours: { mot: trad('jours'), libelle: trad('Jours'), court: 'j', genre: 'date' },
  semaines: { mot: trad('semaines'), libelle: trad('Semaines'), court: 'sem', genre: 'date' },
  mois: { mot: trad('mois'), libelle: trad('Mois'), court: trad('mois'), genre: 'date' },
  ans: { mot: trad('ans'), libelle: trad('Ans'), court: trad('an'), genre: 'date' },
};
const MOTIFS_CONTROLE = [
  /chaque (utilisation|usage|plein|d[ée]marrage|intervention|fois|saison|journ[ée]e)/,
  /[àa] chaque/,
  /au besoin/, /si besoin/, /si n[ée]cessaire/, /quand n[ée]cessaire/, /en cas de besoin/,
  /selon (le|la|les|l'|ton|ta|tes|votre|vos|manuel|usage|utilisation|conditions)/,
  /r[ée]guli[èe]rement/, /p[ée]riodiquement/, /au coup par coup/,
  /contr[ôo]le visuel/, /v[ée]rification visuelle/, /inspection visuelle/,
  /avant chaque/, /apr[èe]s chaque/, /au moindre/,
];
function estPointDeControle(frequency) {
  const texte = String(frequency || '').toLowerCase();
  return MOTIFS_CONTROLE.some(m => m.test(texte));
}
function uniteIntervalleDepuisMot(mot) {
  const m = String(mot || '').toLowerCase();
  if (/^(heures?|hrs?|hours?|h)$/.test(m)) return trad('heures');
  if (/^(km|kilom)/.test(m)) return trad('km');
  if (/^(jours?|journee?s?|days?|day|j|d)$/.test(m)) return trad('jours');
  if (/^semaines?$|^weeks?$|^sem$/.test(m)) return trad('semaines');
  if (/^mois$|^months?$/.test(m)) return trad('mois');
  if (/^(ans?|ann[ée]es?|years?)$/.test(m)) return trad('ans');
  return null;
}
function uniteIntervalleDuPlan(plan, machine) {
  if (!planIsCounter(plan)) return trad('jours');
  return (machine && counterUnitOf(machine) === 'km') ? trad('km') : trad('heures');
}
function uniteCompatiblePlan(unite, plan, machine) {
  const info = UNITES_INTERVALLE[unite];
  if (!info) return false;
  if (planIsCounter(plan)) return unite === uniteIntervalleDuPlan(plan, machine);
  return info.genre === 'date';
}
// L'unité du SECOND compteur de la machine (voir SCHEMA.hasCounter2) : une
// tâche de genre compteur qui n'est PAS dans l'unité du suivi principal peut
// quand même être réellement suivie si elle correspond à ce second relevé.
function uniteCompatibleCompteur2(unite, machine) {
  const u2 = counterUnit2Of(machine);
  return !!u2 && unite === u2;
}
// « 20 000 km » (espace, espace insécable ou fine comme séparateur de milliers) se lisait « 20 km » : le « 000 » était pris
// pour un autre nombre, et l'option en km disparaissait des choix. On retire ces séparateurs AVANT toute lecture.
// POINT DE DÉPART DES ÉCHÉANCES À COMPTEUR. Par défaut, KALEA part du relevé actuel : la machine est supposée entretenue « maintenant ».
// Un véhicule à 23 000 km dont la révision à 20 000 km n'a jamais été faite n'a pourtant pas son échéance à 43 000 km. Le client peut donc
// dire « jamais fait » (départ à 0 : premier entretien à l'intervalle) ou « fait à X » (départ à X) ; sinon, le relevé actuel.
// Le relevé de la machine, lui, reste toujours le relevé réel. La valeur s'exprime dans l'unité du TYPE (km pour un véhicule, heures sinon).
// L'intervalle (le plus court) des tâches périodiques exprimées dans cette unité : c'est lui, et non le « 100 » par défaut du champ du
// second suivi, qui donne la première échéance d'un compteur ajouté avec le carnet.
function intervalleDesTachesEnUnite(items, unite) {
  let mini = null;
  normalizeItems(items).forEach((it) => {
    const c = classerFrequence(it);
    if (c && c.nature === 'periodique' && c.unite === unite && Number(c.interval) > 0) mini = mini == null ? Number(c.interval) : Math.min(mini, Number(c.interval));
  });
  return mini;
}
function departEntretien(etat, unite, releveActuel) {
  const d = etat && etat.dernierEntretien;
  const uniteType = etat && etat.kind === TYPE_VEHICULE ? 'km' : 'hours';
  if (d && (unite === uniteType || (uniteType === 'km' && unite === trad('km')))) {
    if (d.mode === 'jamais') return 0;
    // Un « dernier entretien » plus récent que le relevé actuel n'a pas de sens : on l'ignore.
    if (d.mode === 'fait' && d.releve != null && !(releveActuel != null && d.releve > releveActuel)) return d.releve;
  }
  return releveActuel;
}
function sansSeparateursDeMilliers(texte) {
  return String(texte || '').replace(/(\d)[ \u00a0\u202f](?=\d{3}(?!\d))/g, '$1');
}
// Découpe une fréquence en morceaux candidats : « a : 3 mois / b : 6 mois ».
function morceauxFrequence(frequency) {
  return sansSeparateursDeMilliers(frequency)
    .split(/\s*(?:\/|\bou\b|\bsoit\b|;|\|)\s*/i)
    .map(m => m.trim())
    .filter(Boolean);
}
// Libellé porté par un morceau (« Professionnel : 3 mois » → « Professionnel »).
function libelleDepuisMorceau(morceau) {
  const parts = String(morceau).split(':');
  if (parts.length < 2) return null;
  let candidat = parts[0].trim();
  // « Frein de chaîne — Professionnel : 3 mois » : le libellé d'usage est ce qui
  // suit le tiret, pas le nom de la tâche.
  const apresTiret = candidat.split(/\s*[—–]\s*|\s+-\s+/).filter(Boolean);
  if (apresTiret.length > 1) candidat = apresTiret[apresTiret.length - 1].trim();
  candidat = candidat.replace(/[-–—\s]+$/, '').trim();
  if (!candidat || candidat.length > 30 || /\d/.test(candidat)) return null;
  return candidat;
}
// Toutes les options d'un morceau : « 1 à 2 ans » en donne deux.
function optionsDepuisMorceau(morceau) {
  const texte = String(morceau || '').toLowerCase().replace(/[\u00a0\u202f]/g, ' ').replace(/,/g, '.');
  const libelle = libelleDepuisMorceau(morceau);
  const options = [];
  const motif = /(\d+(?:\.\d+)?)\s*(?:à|a|-|–|et)?\s*(\d+(?:\.\d+)?)?\s*(heures?|hrs?|hours?|h|km|kilom\w*|jours?|journee?s?|days?|day|j|semaines?|weeks?|sem|mois|months?|ans?|ann[ée]es?|years?)\b/g;
  let m;
  while ((m = motif.exec(texte)) !== null) {
    const unite = uniteIntervalleDepuisMot(m[3]);
    if (!unite) continue;
    const premier = parseFloat(m[1]);
    const second = m[2] ? parseFloat(m[2]) : null;
    if (Number.isFinite(premier) && premier > 0) options.push({ libelle, interval: premier, unite });
    if (second != null && Number.isFinite(second) && second > 0) options.push({ libelle: null, interval: second, unite });
  }
  return options;
}
// Options extraites d'une fréquence, toutes unités confondues. null quand le
// texte n'est pas ambigu (un seul intervalle, sans « ou », « / », « 1 à 2 »).
function choixDepuisTexte(frequency) {
  if (!frequency || estPointDeControle(frequency)) return null;
  const morceaux = morceauxFrequence(frequency);
  let options = [];
  morceaux.forEach(m => { options = options.concat(optionsDepuisMorceau(m)); });
  options = options.filter((o, i) => options.findIndex(x => x.interval === o.interval && x.unite === o.unite) === i);
  if (!options.length) return null;
  if (options.length < 2 && morceaux.length < 2) return null;
  return options;
}
// Options d'une tâche : celles déjà mémorisées, sinon celles déduites du texte.
function optionsTache(item, plan, machine) {
  if (!item) return [];
  const depuisTexte = choixDepuisTexte(item.frequency) || [];
  if (Array.isArray(item.interval_choices) && item.interval_choices.length) {
    return item.interval_choices.length < depuisTexte.length ? depuisTexte : item.interval_choices;
  }
  return depuisTexte;
}
// Compatibilité d'une unité avec un plan, sans avoir le plan sous la main.
function uniteCompatibleAvecPlanSuivi(contreur, unite, uniteOption) {
  const info = UNITES_INTERVALLE[uniteOption];
  if (!info) return false;
  if (!contreur) return info.genre === 'date';
  return info.genre === 'compteur' && uniteOption === uniteIntervalleDepuisSuivi(unite);
}
function uniteIntervalleDepuisSuivi(unite) {
  return unite === 'days' ? trad('jours') : (unite === 'hours' ? trad('heures') : (unite || trad('jours')));
}
// Un intervalle lu dans le texte, DANS L'UNITÉ DU PLAN : « tous les 6 mois » et
// « tous les 2 ans » n'ont de sens que sur un plan calendaire.
function resolutionIntervalleDepuisTexte(frequency, uniteIntervalle) {
  const suivi = uniteIntervalle === 'jours' ? 'days' : uniteIntervalle;
  const nombre = intervalleDepuisTexte(frequency, suivi);
  if (nombre != null) return { interval: nombre, unite: uniteIntervalle };
  if (uniteIntervalle === 'jours') {
    const enMois = intervalleEnMoisDepuisTexte(frequency);
    if (enMois != null) return enMois;
  }
  return null;
}
// Résolution : { interval, unite } ou null.
//  1) un intervalle déjà mémorisé gagne (avec son unité) ;
//  2) un texte AMBIGU ne donne AUCUN intervalle : c'est l'utilisateur qui
//     tranchera parmi les options extraites du carnet ;
//  3) sinon on lit le texte dans l'unité du plan.
function resolutionIntervalle(item, plan, machine) {
  if (!item) return null;
  const memorise = Number(item.interval);
  if (Number.isFinite(memorise) && memorise > 0) {
    return { interval: memorise, unite: item.interval_unite || uniteIntervalleDuPlan(plan, machine) };
  }
  if (item.point_de_controle) return null;
  const options = (Array.isArray(item.interval_choices) && item.interval_choices.length)
    ? item.interval_choices
    : choixDepuisTexte(item.frequency);
  if (options && options.length) {
    const compatibles = options.filter(o => uniteCompatiblePlan(o.unite, plan, machine));
    if (options.length > 1 || compatibles.length === 0) return null;
  }
  return resolutionIntervalleDepuisTexte(item.frequency, uniteIntervalleDuPlan(plan, machine));
}
// « tous les 6 mois », « tous les 2 ans » : réservé aux plans calendaires.
function intervalleEnMoisDepuisTexte(frequency) {
  const texte = String(frequency || '').toLowerCase()
    .replace(/[\u00a0\u202f]/g, ' ').replace(/,/g, '.');
  if (!texte.trim()) return null;
  const morceaux = texte.split(/\b(?:puis|ensuite|par la suite|then|à partir de)\b/);
  const portions = morceaux.length > 1 ? [morceaux.slice(1).join(' '), texte] : [texte];
  const lire = (motif) => {
    for (const portion of portions) {
      const m = portion.match(motif);
      if (m) {
        const n = parseFloat(String(m[1]).replace(/\s/g, ''));
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
    return null;
  };
  const mois = lire(/(\d+(?:\.\d+)?)\s*(?:mois|months?)\b/);
  if (mois != null) return { interval: mois, unite: trad('mois') };
  const ans = lire(/(\d+(?:\.\d+)?)\s*(?:ans?|ann[ée]es?|years?)\b/);
  if (ans != null) return { interval: ans, unite: trad('ans') };
  return null;
}
// Une tâche attend un choix quand son intervalle n'est pas résolu et que le
// carnet propose des options — soit plusieurs, soit une seule mais dans une
// autre unité que celle du plan (il faut alors trancher : valeur en unité du
// plan, ou point de contrôle).
function tacheAttendUnChoix(item, plan, machine) {
  if (!item) return false;
  if (resolutionIntervalle(item, plan, machine)) return false;
  if (item.point_de_controle) return false;
  if (estPointDeControle(item.frequency)) return false;
  const options = optionsTache(item, plan, machine);
  if (!options.length) return false;
  const compatibles = options.filter(o => uniteCompatiblePlan(o.unite, plan, machine));
  return options.length > 1 || compatibles.length === 0;
}
// Libellé lisible d'une option : « Professionnel — tous les 3 mois ». L'unité
// reste en minuscules DANS la phrase (la majuscule ne sert que d'étiquette).
function libelleOption(option) {
  const info = UNITES_INTERVALLE[option.unite] || { mot: String(option.unite || '') };
  const valeur = tR('Tous les {valeur} {unite}', { valeur: String(option.interval), unite: trad(info.mot) });
  return option.libelle ? `${option.libelle} — ${valeur}` : valeur;
}

// Échéance d'une tâche LUE DANS LA DIMENSION DU PLAN :
// { genre: 'compteur' | 'jours' | null, valeur }.
function echeanceTache(item, plan) {
  if (!item) return { genre: null, valeur: null };
  if (planIsCounter(plan)) {
    const v = Number(item.due_counter);
    return Number.isFinite(v) ? { genre: 'compteur', valeur: v } : { genre: null, valeur: null };
  }
  return item.due_at ? { genre: trad('jours'), valeur: item.due_at } : { genre: null, valeur: null };
}

// Échéance PROPRE d'une tâche : celle de SON unité, quand cette unité n'est pas
// celle du plan — « 10 jours » saisi librement sur un plan au compteur horaire.
// Le champ de l'AUTRE dimension porte alors cette échéance : `due_at` pour une
// unité calendaire, `due_counter` pour une unité de compteur, quelle que soit la
// dimension du plan. Renvoie null quand la tâche n'a pas d'échéance propre.
//
// POURQUOI CE N'EST PAS UN POINT DE CONTRÔLE : une valeur libre est un vrai
// intervalle exprimé par l'utilisateur. Elle ne compte pas dans l'échéance du
// plan (des jours ne se comparent pas à des heures), mais elle n'est pas perdue :
// la ligne de la tâche porte sa propre échéance, et le dit.
function echeancePropreTache(item, plan) {
  if (!item) return null;
  const aDate = !!item.due_at;
  const aCompteur = Number.isFinite(Number(item.due_counter));
  if (planIsCounter(plan)) return (aDate && !aCompteur) ? { genre: trad('jours'), valeur: item.due_at } : null;
  return (aCompteur && !aDate) ? { genre: 'compteur', valeur: Number(item.due_counter) } : null;
}

// Échéance propre, écrite dans SON unité : une date pour les unités calendaires,
// un relevé de compteur sinon. C'est le texte affiché sur la ligne de la tâche.
// `uniteReelle` (l'unité PROPRE de la tâche, ex. « km ») prime sur celle de la
// machine : sans ça, un relevé km s'affichait étiqueté « h » (l'unité de la
// machine), un nombre juste sous une unité fausse — trouvé le 23/09.
function echeancePropreTexte(propre, machine, uniteReelle) {
  if (!propre) return '';
  if (propre.genre === 'jours') return formatShortDate(propre.valeur);
  return formatCounter(propre.valeur, uniteReelle || counterUnitOf(machine));
}

// État d'une tâche : on présente à dueInfo un plan « vu par la tâche » (même
// mode de suivi, même fenêtre de rappel, mais SON échéance). Aucune règle
// d'état n'est réécrite ici.
function infoTache(item, plan, machine) {
  const inconnu = {
    state: 'unknown', label: trad('Intervalle à préciser'), short: trad('Intervalle à préciser'),
    sortKey: Number.POSITIVE_INFINITY, urgency: Number.POSITIVE_INFINITY,
    unit: uniteSuivi(plan, machine),
  };
  // D'abord le CHOIX : une échéance héritée du plan (règle de reprise) ne doit
  // pas faire croire que la tâche est suivie alors que le carnet laisse
  // l'intervalle en suspens. Le choix est demandé avant tout le reste.
  if (tacheAttendUnChoix(item, plan, machine)) {
    return { ...inconnu, state: 'choix', label: trad('Fréquence à choisir'), short: trad('Fréquence à choisir') };
  }
  if (item && item.point_de_controle) {
    return { ...inconnu, state: 'controle', label: trad('Point de contrôle'), short: trad('Point de contrôle') };
  }
  if (item && estPointDeControle(item.frequency)) {
    return { ...inconnu, state: 'controle', label: trad('Point de contrôle'), short: trad('Point de contrôle') };
  }
  // SUIVIE PAR LE SECOND COMPTEUR : l'unité de la tâche ne correspond pas au
  // suivi principal, mais correspond au second relevé de la machine — elle
  // EST réellement suivie (voir preparerTaches), pas seulement « hors plan ».
  if (item && item.interval_unite && Number.isFinite(Number(item.due_counter))
      && uniteCompatibleCompteur2(item.interval_unite, machine)) {
    const planVuParLeSecond = { tracking_mode: item.interval_unite, next_due_at: null, ...planNextDueCounterPatch(Number(item.due_counter)) };
    const machineVueParLeSecond = { ...machine, counter_unit: item.interval_unite, counter_value: machineCounter2(machine) };
    return { ...dueInfo(planVuParLeSecond, machineVueParLeSecond), secondaire: true };
  }
  // SUIVIE PAR LE SECOND SUIVI CALENDAIRE : même principe, sans relevé à
  // synthétiser — dueInfo() n'a besoin que de l'échéance de LA tâche.
  if (item && item.interval_unite && item.due_at
      && uniteCompatibleCalendaireSecondaire(item.interval_unite, machine)) {
    return { ...dueInfo({ tracking_mode: 'days', next_due_at: item.due_at }, machine), secondaire: true };
  }
  // Échéance dans une AUTRE unité que celle du plan (et pas davantage suivie
  // par le second suivi) : elle est lue dans SON unité, marquée horsPlan
  // (l'écran le dit) et n'entre pas dans le minimum.
  const propre = echeancePropreTache(item, plan);
  if (propre) {
    const uniteReelle = item && item.interval_unite;
    const vuParLaTache = propre.genre === 'jours'
      ? { ...plan, tracking_mode: 'days', next_due_at: propre.valeur }
      : { ...plan, tracking_mode: uniteReelle || 'hours', next_due_at: null, ...planNextDueCounterPatch(propre.valeur) };
    const machineVue = (propre.genre === 'jours' || !uniteReelle) ? machine : { ...machine, counter_unit: uniteReelle };
    return { ...dueInfo(vuParLaTache, machineVue), horsPlan: true, propre };
  }
  const echeance = echeanceTache(item, plan);
  if (echeance.genre === 'compteur') {
    return dueInfo({ ...plan, ...planNextDueCounterPatch(echeance.valeur) }, machine);
  }
  if (echeance.genre === 'jours') {
    return dueInfo({ ...plan, next_due_at: echeance.valeur }, machine);
  }
  return inconnu;
}

// « Retenu : … » : un choix mémorisé doit TOUJOURS se voir, y compris quand il
// aboutit à un point de contrôle. C'est exactement ce qui manquait sur « Vis du
// pied du cylindre » : le choix était en base, mais la branche « point de
// contrôle » ne l'affichait pas — l'utilisateur croyait l'avoir perdu.
function retenuTache(item) {
  const choix = item && item.interval_choisi;
  if (!choix) return '';
  // Un choix resté « point de contrôle » n'apprend rien de plus que la ligne
  // elle-même : on ne l'écrit que s'il porte une vraie fréquence.
  if (choix === 'Point de contrôle' || choix === trad('Point de contrôle')) return '';
  return `<span class="muted">${esc(tR('Retenu : {choix}', { choix: trad(choix) }))}</span>`;
}

// Échéance d'une tâche, prête à afficher. Deux dispositions, une seule source :
//   • 'colonne' (défaut) : le tableau, sur écran large — tout empilé à gauche ;
//   • 'ligne' : les cartes du téléphone — la pastille se pose SUR la ligne de
//     l'échéance, à gauche du texte, et aucun conflit d'alignement n'est possible.
function etatTacheHtml(item, plan, machine, disposition) {
  const info = infoTache(item, plan, machine);
  const bouton = (texte, classe) =>
    `<button type="button" class="${classe}" data-tache="${esc(item.label || '')}">${esc(texte)}</button>`;
  const classe = disposition === 'ligne' ? 'cell-echeance-ligne' : 'cell-echeance';
  const cellule = (contenu) => `<div class="${classe}">${contenu}</div>`;
  const retenu = retenuTache(item);
  if (info.state === 'choix') {
    return cellule(`<span class="muted">${esc(info.short)}</span>${retenu}${bouton(trad('Choisir'), 'choisir-frequence')}`);
  }
  if (info.state === 'controle') {
    // Un point de contrôle peut être revenu en arrière : si le carnet proposait
    // des options (ou si l'utilisateur en avait choisi une), on laisse modifier.
    const peutModifier = item && (item.interval_choisi || optionsTache(item, plan, machine).length);
    const mention = retenu ? `<span class="muted">${trad('— non suivi automatiquement')}</span>` : '';
    return cellule(`<span class="muted">${esc(info.short)}</span>${retenu}${mention}`
      + (peutModifier ? bouton(trad('Modifier'), 'choisir-frequence') : ''));
  }
  if (info.state === 'unknown') return cellule(`<span class="muted">${esc(info.short)}</span>${retenu}${bouton(trad('Préciser'), 'choisir-frequence')}`);
  // « Modifier » aussi quand le carnet donnait plusieurs possibilités (« 100 000 km / 6 ans ») et que l'une a été prise par défaut :
  // sinon on ne pouvait plus préciser l'intervalle après l'enregistrement.
  const modifier = item && (item.interval_choisi || item.point_de_controle || optionsTache(item, plan, machine).length > 1)
    ? bouton(trad('Modifier'), 'choisir-frequence')
    : '';
  // Échéance propre (unité différente de celle du plan) : écrite dans SON unité,
  // suivie de la phrase qui dit qu'elle ne compte pas dans l'échéance du plan.
  const echeanceHtml = info.horsPlan
    ? `<span class="muted">${esc(tR('Échéance : {echeance}', { echeance: echeancePropreTexte(info.propre, machine, item && item.interval_unite) }))}</span>`
      + `<span class="muted">${trad('ne compte pas dans l\'échéance du plan')}</span>`
    : `<span class="${info.state === 'late' ? 'echeance-retard' : 'muted'}">${esc(info.short)}</span>`;
  return cellule(`<span class="badge ${badgeClass(info.state)}">${esc(badgeLabel(info.state))}</span>`
    + echeanceHtml + retenu + modifier);
}

// Bloc de choix d'une tâche ambiguë : la phrase, les options du carnet (une par
// ligne, avec leur valeur lisible) et l'accès au choix libre.
function blocChoixTache(item, plan, machine) {
  const options = optionsTache(item, plan, machine);
  const lignes = options.map(o => {
    // Une option qui n'est pas dans l'unité du plan n'est PAS forcément un
    // point de contrôle : si elle correspond au second compteur de la
    // machine, elle sera réellement suivie (voir preparerTaches) — le dire
    // au lieu de décourager un choix qui serait pourtant suivi.
    if (uniteCompatiblePlan(o.unite, plan, machine)) return `<li>${esc(libelleOption(o))}</li>`;
    if (uniteCompatibleCompteur2(o.unite, machine)) {
      const note = ` <span class="muted">(${esc(tR('suivie par le second compteur ({unite})', { unite: trad((UNITES_INTERVALLE[o.unite] || {}).mot || '') }))})</span>`;
      return `<li>${esc(libelleOption(o))}${note}</li>`;
    }
    if (uniteCompatibleCalendaireSecondaire(o.unite, machine)) {
      const note = ` <span class="muted">(${esc(trad('suivie par le second suivi calendaire'))})</span>`;
      return `<li>${esc(libelleOption(o))}${note}</li>`;
    }
    const note = ` <span class="muted">(${esc(tR('pas dans l\'unité de ce plan ({unite}) : la tâche resterait un point de contrôle', { unite: trad((UNITES_INTERVALLE[o.unite] || {}).mot || '') }))})</span>`;
    return `<li>${esc(libelleOption(o))}${note}</li>`;
  }).join('');
  return `
    <div class="plan-field choix-frequence-bloc" data-tache="${esc(item.label || '')}">
      <div class="nom">${esc(item.label || '')}</div>
      <div class="value">${trad('Fréquence d\'entretien : à toi de choisir selon ton usage.')}</div>
      ${lignes ? `<ul class="choix-options">${lignes}</ul>` : ''}
      <button type="button" class="view-manual choisir-frequence" data-tache="${esc(item.label || '')}">${trad('Choisir la fréquence')}</button>
    </div>`;
}

// Comme uniteCompatiblePlan, mais sans avoir besoin de la machine : le
// tracking_mode du plan DIT déjà l'unité de compteur (hours/km) quand le plan
// en est un — inutile de redemander à la machine, et ça évite de la faire
// circuler jusque dans des fonctions qui ne l'ont pas sous la main.
function uniteCompatiblePlanTM(unite, plan) {
  const info = UNITES_INTERVALLE[unite];
  if (!info) return false;
  if (!planIsCounter(plan)) return info.genre === 'date';
  return unite === (plan.tracking_mode === 'km' ? 'km' : 'heures');
}
// Tâches dont l'échéance est exploitable : ce sont les seules qui entrent dans
// le calcul de la plus proche (et donc dans l'état de la machine). LA MÊME
// DIMENSION QUE LE PLAN, VRAIMENT : sans le filtre d'unité, une tâche « hors
// plan » de genre compteur (ex. km sur un plan en heures) avait bien un
// due_counter — et se retrouvait comptée dans le minimum du plan aux côtés de
// due_counter en heures, deux unités mélangées dans le même Math.min. Un item
// SANS interval_unite (données d'avant ce classement) n'est pas filtré : il
// se comportait déjà ainsi, on ne régresse pas des plans anciens pour un
// souci qui ne les concernait pas.
function tachesSuivies(items, plan) {
  const liste = normalizeItems(items);
  const compatibleUnite = (it) => !it.interval_unite || uniteCompatiblePlanTM(it.interval_unite, plan);
  if (planIsCounter(plan)) return liste.filter(it => Number.isFinite(Number(it.due_counter)) && compatibleUnite(it));
  return liste.filter(it => it.due_at && compatibleUnite(it));
}

// Tâche la plus urgente : c'est elle qui porte l'état affiché pour la
// machine — PRINCIPALE ou SECONDAIRE, la première tâche vraiment suivie qui
// arrive. Sans ça, une machine dont seul le second suivi est en retard
// affichait quand même la tâche (à jour) du suivi principal — signalé le
// 23/09, en même temps que la carte/le tri qui ne remontaient pas la
// machine (voir infoMachine()).
function tacheLaPlusUrgente(items, plan, machine) {
  // Les tâches sont PROJETÉES avant d'être classées : l'état de la machine vient
  // donc du même classement que celui qu'un enregistrement écrirait (voir
  // projectionTaches), et une consultation ne peut pas raconter autre chose.
  const projetees = projectionTaches(items, plan, machine);
  let meilleure = null;
  let meilleureInfo = null;
  projetees.forEach(it => {
    const info = infoTache(it, plan, machine);
    // Exploitable = une vraie échéance, principale OU secondaire — jamais un
    // point de contrôle, un choix en attente, une tâche inconnue, ou une
    // tâche vraiment hors plan (aucun suivi, ni principal ni secondaire) :
    // celle-là ne doit pas se faire passer pour LA tâche prévue.
    if (info.state !== 'late' && info.state !== 'soon' && info.state !== 'ok') return;
    if (info.horsPlan) return;
    // `urgency`, pas `sortKey` : la seule mesure comparable entre deux
    // dimensions différentes (heures, km, jours) — la même que dueInfo()
    // documente pour classer ensemble compteur et calendrier.
    if (!meilleureInfo || info.urgency < meilleureInfo.urgency) { meilleure = it; meilleureInfo = info; }
  });
  return meilleure ? { item: meilleure, info: meilleureInfo } : null;
}

// L'échéance du plan = la plus proche de ses tâches COMPARABLES (même dimension
// que le plan). null quand aucune ne la porte : un plan dont toutes les tâches
// sont des points de contrôle, des choix en attente ou des échéances d'une autre
// unité n'a aucune échéance générale. Les appelants ÉCRIVENT donc aussi la valeur
// nulle : garder l'ancienne en ferait un vestige qui rend la machine « en
// retard » à tort (cas réel : « Vehicule du PDG », 1 470 km fantômes).
function echeancePlanDepuisTaches(items, plan) {
  const suivies = tachesSuivies(items, plan);
  if (!suivies.length) return null;
  if (planIsCounter(plan)) {
    return suivies.reduce((min, it) => Math.min(min, Number(it.due_counter)), Number.POSITIVE_INFINITY);
  }
  return suivies.reduce((min, it) => (String(it.due_at) < min ? String(it.due_at) : min), String(suivies[0].due_at));
}
// La même règle, mais pour le SECOND suivi de la machine (voir
// SCHEMA.hasCounter2) : le minimum des échéances des tâches dont l'unité
// correspond à CE second suivi — jamais à celui du plan principal. Compteur
// (heures/km) ou calendaire (jours/semaines/mois/ans), selon ce que
// modeSecondaireDe() renvoie.
function echeancePlanDepuisTachesSecondaire(items, machine) {
  const mode2 = modeSecondaireDe(machine);
  if (!mode2) return null;
  if (mode2 === 'days') {
    const suivies = normalizeItems(items).filter(it =>
      it.due_at && UNITES_INTERVALLE[it.interval_unite]?.genre === 'date');
    if (!suivies.length) return null;
    return suivies.reduce((min, it) => (String(it.due_at) < min ? String(it.due_at) : min), String(suivies[0].due_at));
  }
  const suivies = normalizeItems(items).filter(it => it.interval_unite === mode2 && Number.isFinite(Number(it.due_counter)));
  if (!suivies.length) return null;
  return suivies.reduce((min, it) => Math.min(min, Number(it.due_counter)), Number.POSITIVE_INFINITY);
}
// Le patch à écrire pour cette échéance secondaire, selon son genre.
function echeancePlanPatch2(valeur, machine) {
  return modeSecondaireDe(machine) === 'days' ? planNextDueAt2Patch(valeur) : planNextDueCounter2Patch(valeur);
}
function echeancePlanPatch(valeur, plan) {
  return planIsCounter(plan) ? planNextDueCounterPatch(valeur) : { next_due_at: valeur };
}
// La TÂCHE qui gouverne réellement l'échéance du plan : celle qui porte
// l'échéance la plus proche parmi les tâches comparables — la même que
// echeancePlanDepuisTaches() retient (calendaire OU compteur). C'est SON
// intervalle propre qui doit se refléter dans le champ « Intervalle » du
// plan, pas une valeur saisie à part qui n'a jamais de lien garanti avec ce
// que les tâches disent vraiment (constaté en base : un plan à 90 j portant
// une tâche « tous les ans », ou un plan à 100 km portant une tâche « tous
// les 20 000 km »).
function tacheGouvernante(items, plan) {
  const suivies = tachesSuivies(items, plan);
  if (!suivies.length) return null;
  if (planIsCounter(plan)) {
    return suivies.reduce((min, it) => (Number(it.due_counter) < Number(min.due_counter) ? it : min), suivies[0]);
  }
  return suivies.reduce((min, it) => (String(it.due_at) < String(min.due_at) ? it : min), suivies[0]);
}
// La même règle, mais pour le SECOND suivi de la machine — miroir de
// echeancePlanDepuisTachesSecondaire, pour trouver QUELLE tâche porte cette
// échéance secondaire (et donc quel est son vrai cycle).
function tacheGouvernanteSecondaire(items, machine) {
  const mode2 = modeSecondaireDe(machine);
  if (!mode2) return null;
  const liste = normalizeItems(items);
  if (mode2 === 'days') {
    const suivies = liste.filter(it => it.due_at && UNITES_INTERVALLE[it.interval_unite]?.genre === 'date');
    if (!suivies.length) return null;
    return suivies.reduce((min, it) => (String(it.due_at) < String(min.due_at) ? it : min), suivies[0]);
  }
  const suivies = liste.filter(it => it.interval_unite === mode2 && Number.isFinite(Number(it.due_counter)));
  if (!suivies.length) return null;
  return suivies.reduce((min, it) => (Number(it.due_counter) < Number(min.due_counter) ? it : min), suivies[0]);
}
// Convertit l'intervalle PROPRE d'une tâche (mois/ans compris, en vraie
// arithmétique de calendrier via ajouterIntervalleIso) en nombre de jours :
// seule façon fiable de comparer un cycle « 1 an » à un champ stocké en jours.
function intervalleEnJoursDepuisTache(t) {
  if (!t || !t.due_at || !Number.isFinite(Number(t.interval)) || !t.interval_unite) return null;
  const debut = ajouterIntervalleIso(t.due_at, -Number(t.interval), t.interval_unite);
  const jours = joursEntreIso(debut, t.due_at);
  return jours > 0 ? jours : null;
}
// La même conversion, mais pour une DIMENSION quelconque (calendaire ou
// compteur) : en compteur, t.interval EST déjà l'intervalle dans la bonne
// unité (garanti par tachesSuivies()/uniteCompatiblePlan()) — pas de
// conversion nécessaire, contrairement au calendaire (mois/ans).
function intervalleDepuisTacheGouvernante(t, genreCompteur) {
  if (!t) return null;
  if (genreCompteur) {
    const v = Number(t.interval);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  return intervalleEnJoursDepuisTache(t);
}

// ── CLASSEMENT D'UNE FRÉQUENCE : UNE SEULE RÈGLE ─────────────
// L'utilisateur a constaté dix tâches « en retard » de +970 km ou +125 h alors
// que la plupart n'ont AUCUN rythme propre : elles héritaient l'échéance du plan.
// Un « contrôle à chaque utilisation » n'a rien à faire en retard de 970 km.
//
// Trois natures, décidées ICI et nulle part ailleurs :
//   'conditionnelle'  la fréquence dépend d'un ÉVÉNEMENT, pas du temps ni de
//                     l'usage (« à chaque utilisation », « avant chaque long
//                     trajet », « au besoin », « selon le manuel », « si
//                     contamination ») → point de contrôle, JAMAIS d'échéance ;
//   'periodique'      un rythme explicite et unique, même dans une unité qui
//                     n'est pas celle du plan (« toutes les 250 heures », « tous
//                     les 90 jours », « chaque mois ») → intervalle propre ;
//   'a_choisir'       PLUSIEURS possibilités incompatibles (« 3 mois / 6 mois /
//                     1 an », « 1 à 2 ans », « 100 heures ou 2 ans ») → c'est
//                     l'utilisateur qui tranche.
// Un texte qui mêle rythme et condition (« chaque mois ou avant chaque long
// trajet ») est PÉRIODIQUE : le rythme existe, on ne le perd pas.
//
// DEUX ENTRÉES, UNE SEULE RÈGLE :
//   · les champs STRUCTURÉS renvoyés par l'analyse du carnet (extract-maintenance-plan) :
//     la fonction a lu le PDF, elle sait de quoi elle parle — l'application ne
//     devine plus rien à partir d'une phrase française ;
//   · le TEXTE, pour les plans déjà en base : c'est le repli déterministe, et le
//     seul dont dispose la passe de rattrapage.
// Les deux chemins appellent `classerFrequence`, donc ils ne peuvent pas diverger.
const NATURES_FREQUENCE = ['conditionnelle', 'periodique', 'a_choisir', 'inconnue'];

function classementVide(nature) {
  return { nature, interval: null, unite: null, options: [] };
}

function classerDepuisStructure(frequence) {
  if (!frequence || typeof frequence !== 'object') return null;
  const nature = String(frequence.nature || '').toLowerCase();
  if (nature === 'conditionnelle') return classementVide('conditionnelle');
  if (nature === 'periodique') {
    const interval = Number(frequence.interval);
    const unite = frequence.unite ? String(frequence.unite) : null;
    if (!Number.isFinite(interval) || interval <= 0) return null;
    if (!unite || !UNITES_INTERVALLE[unite]) return null;
    return { nature: 'periodique', interval, unite, options: [] };
  }
  if (nature === 'a_choisir') {
    const options = (Array.isArray(frequence.options) ? frequence.options : [])
      .map(o => ({
        libelle: o && o.libelle ? String(o.libelle) : null,
        interval: Number(o && o.interval),
        unite: o && o.unite ? String(o.unite) : null,
      }))
      .filter(o => Number.isFinite(o.interval) && o.interval > 0 && UNITES_INTERVALLE[o.unite]);
    if (!options.length) return null;
    return { nature: 'a_choisir', interval: null, unite: null, options };
  }
  return null;
}

// « chaque mois », « tous les ans » : le rythme EXISTE, même sans nombre écrit.
// Sans cela, « chaque mois ou avant chaque long trajet » passerait pour un
// contrôle purement conditionnel et perdrait son rythme mensuel.
function intervalleUnitaireDepuisTexte(texte) {
  const t = String(texte || '').toLowerCase();
  if (/\b(chaque|tous les|toutes les|par)\s+mois\b|\bmensuel/.test(t)) return { interval: 1, unite: trad('mois') };
  if (/\b(chaque|tous les|toutes les|par)\s+semaines?\b|\bhebdomadaire/.test(t)) return { interval: 1, unite: trad('semaines') };
  if (/\b(chaque|tous les|toutes les|par)\s+(ans?|ann[ée]es?)\b|\bannuel/.test(t)) return { interval: 1, unite: trad('ans') };
  if (/\b(chaque|tous les|toutes les|par)\s+jours?\b|\bquotidien/.test(t)) return { interval: 1, unite: trad('jours') };
  if (/\b(chaque|tous les|toutes les|par)\s+heures?\b/.test(t)) return { interval: 1, unite: trad('heures') };
  return null;
}

function classerDepuisTexte(frequency) {
  const texte = sansSeparateursDeMilliers(frequency).trim();
  if (!texte) return classementVide('inconnue');
  // 1. Plusieurs possibilités : on demande, on ne devine pas.
  const options = choixDepuisTexte(texte);
  if (options && options.length) return { nature: 'a_choisir', interval: null, unite: null, options };
  // 2. Purement conditionnelle : un motif de contrôle ET aucun rythme lisible.
  const enMois = intervalleEnMoisDepuisTexte(texte);
  const enHeures = intervalleDepuisTexte(texte, 'hours');
  const enKm = intervalleDepuisTexte(texte, trad('km'));
  const enJours = intervalleDepuisTexte(texte, 'days');
  const unitaire = intervalleUnitaireDepuisTexte(texte);
  if (estPointDeControle(texte) && enMois == null && enHeures == null && enKm == null
    && enJours == null && !unitaire) {
    return classementVide('conditionnelle');
  }
  // 3. Rythme explicite : l'unité écrite dans le carnet fait foi.
  if (enMois) return { nature: 'periodique', interval: enMois.interval, unite: enMois.unite, options: [] };
  if (enHeures) return { nature: 'periodique', interval: enHeures, unite: trad('heures'), options: [] };
  if (enKm) return { nature: 'periodique', interval: enKm, unite: trad('km'), options: [] };
  if (enJours) return { nature: 'periodique', interval: enJours, unite: trad('jours'), options: [] };
  if (unitaire) return { nature: 'periodique', interval: unitaire.interval, unite: unitaire.unite, options: [] };
  // 4. Rien d'exploitable : ni rythme, ni choix à proposer.
  return classementVide('inconnue');
}

// L'ENTRÉE UNIQUE : les champs structurés s'ils sont exploitables, sinon le texte.
function classerFrequence(item) {
  return classerDepuisStructure(item && item.frequence)
    || classerDepuisTexte(item && item.frequency);
}

// Statut affiché sur les écrans « Plan proposé par notre algorithme » (colonne
// Statut de l'arbitrage, avant que le plan existe) — VRAI, jamais un badge
// décoratif : un choix déjà fait (interval_choisi/interval, posé par
// ouvrirChoixFrequenceApercu) est "Optimal" au même titre qu'une fréquence non
// ambiguë ; une fréquence à plusieurs cycles ("100h ou 2 ans") est "À choisir" ;
// le reste (conditionnelle, ou texte non reconnu) est "Point de contrôle" —
// jamais un statut inventé pour une tâche dont on ne sait rien de plus.
function statutPplan(it) {
  if (!it) return { libelle: trad('Point de contrôle'), classe: 'is-neutre' };
  if (it.point_de_controle) return { libelle: trad('Point de contrôle'), classe: 'is-neutre' };
  if (it.interval_choisi || it.interval) return { libelle: trad('Optimal'), classe: 'is-ok' };
  const classement = classerFrequence(it);
  if (!classement) return { libelle: trad('Point de contrôle'), classe: 'is-neutre' };
  if (classement.nature === 'periodique') return { libelle: trad('Optimal'), classe: 'is-ok' };
  if (classement.nature === 'a_choisir') return { libelle: trad('À choisir'), classe: 'is-attn' };
  return { libelle: trad('Point de contrôle'), classe: 'is-neutre' };
}
// Couleur d'accent purement décorative devant chaque libellé de tâche (comme
// la maquette Stitch) : une rotation fixe, pas une catégorisation réelle —
// aucune donnée de l'app ne classe les tâches par "type", ce serait une
// distinction fabriquée. Sert seulement à scinder visuellement une longue
// liste, comme les puces de couleur d'un calendrier.
const PPLAN_DOT_ROTATION = ['var(--bleu-roi)', 'var(--late)', 'var(--primary)', 'var(--ok)'];
function pplanDotColor(i) { return PPLAN_DOT_ROTATION[i % PPLAN_DOT_ROTATION.length]; }

// Le carnet mélange-t-il un SECOND suivi (une seconde unité de compteur, ou
// une unité calendaire quand le principal est un compteur — cas fréquent
// d'un véhicule : kilométrage ET échéances en années) ? Pur calcul, sans
// toucher l'Edge Function déployée : elle classe déjà chaque tâche dans SA
// propre unité (classerFrequence, structuré ou texte) — on regarde juste si
// une unité AUTRE que le mode principal apparaît. Une seule candidate
// distincte : on la propose. Plusieurs : cas ambigu, on ne devine pas — null,
// l'utilisateur choisira lui-même dans la section « Second suivi ».
function detecterUniteSecondaire(items, modePrincipal) {
  if (!Array.isArray(items) || !items.length) return null;
  const enCode = (uniteInterne) => {
    if (uniteInterne === 'heures') return 'hours';
    if (uniteInterne === 'km') return 'km';
    return UNITES_INTERVALLE[uniteInterne]?.genre === 'date' ? 'days' : null;
  };
  const vues = new Set();
  const noter = (unite) => { const c = enCode(unite); if (c) vues.add(c); };
  for (const item of items) {
    // Un choix DÉJÀ résolu (repris d'un plan existant) prime sur une
    // reclassification à chaud — sinon un « X km / Y ans » déjà tranché en
    // km ferait croire à un mélange à cause de sa forme a_choisir d'origine.
    if (item && item.interval_unite) { noter(item.interval_unite); continue; }
    const classement = classerFrequence(item);
    // 'a_choisir' est une ambiguïté PROPRE à cette tâche (une seule
    // s'appliquera) : pas un signal de plan mélangé tant que rien n'est
    // choisi, on ne la compte donc pas.
    if (classement && classement.nature === 'periodique') noter(classement.unite);
  }
  if (modePrincipal === 'hours' || modePrincipal === 'km') vues.delete(modePrincipal);
  else vues.delete('days');
  return vues.size === 1 ? [...vues][0] : null;
}

// Échéance PROPRE d'une tâche, calculée dans SON unité : une date pour les unités
// calendaires, un relevé de compteur sinon. Une seule implémentation, employée
// par la passe de préparation ET par le choix de l'utilisateur.
function echeancePropreTacheAppliquee(t, machine) {
  const info = UNITES_INTERVALLE[t.interval_unite] || {};
  if (info.genre === 'date') {
    const depart = t.last_done_at || todayIso();
    t.due_at = ajouterIntervalleIso(depart, t.interval, t.interval_unite);
    delete t.due_counter;
  } else {
    // Le SECOND compteur de la machine, si l'unité de la tâche y correspond :
    // c'est SON relevé qui sert de point de départ — pas celui du suivi
    // principal (une autre unité), et pas 0 par défaut. Sans ça, une tâche en
    // km sur une machine suivie en heures repartait du relevé horaire comme
    // s'il s'agissait de kilomètres (constaté le 23/09).
    const relevePropre = uniteCompatibleCompteur2(t.interval_unite, machine)
      ? machineCounter2(machine)
      : machineCounter(machine);
    const depart = Number.isFinite(Number(t.last_done_counter))
      ? Number(t.last_done_counter)
      : (Number(relevePropre) || 0);
    t.due_counter = depart + Number(t.interval);
    delete t.due_at;
  }
  return t;
}

// LA PASSE, sur les éléments déjà en base comme sur ceux qui arrivent d'une
// analyse. Idempotente, et elle ne touche JAMAIS un choix déjà fait.
// `duePlanSecondaire` : l'échéance ACTUELLE du second compteur du plan (voir
// echeancePlanDepuisTachesSecondaire) — sert de reprise pour une tâche déjà
// suivie par ce second compteur, exactement comme `duePlan` pour le principal.
function preparerTaches(items, plan, machine, duePlan, unite, duePlanSecondaire) {
  const liste = normalizeItems(items);
  if (!liste.length) return null;
  const contreur = planIsCounter(plan);
  return liste.map(it => {
    const t = { ...it };
    // Un choix de l'utilisateur est sa parole : on n'y touche pas.
    if (t.interval_choisi) return t;
    const classement = classerFrequence(t);
    if (classement.nature === 'conditionnelle') {
      // Un rythme conditionnel n'a AUCUNE échéance : il ne doit plus hériter de
      // celle du plan (c'était toute la cause des alertes à +970 km).
      delete t.interval; delete t.interval_unite; delete t.interval_choices;
      delete t.due_at; delete t.due_counter;
      t.point_de_controle = true;
      return t;
    }
    if (classement.nature === 'a_choisir') {
      delete t.interval; delete t.interval_unite;
      delete t.due_at; delete t.due_counter; delete t.point_de_controle;
      t.interval_choices = classement.options;
      return t;
    }
    if (classement.nature === 'periodique') {
      t.interval = classement.interval;
      t.interval_unite = classement.unite;
      delete t.interval_choices; delete t.point_de_controle;
      if (uniteCompatiblePlan(classement.unite, plan, machine)) {
        // Même unité que le plan : l'échéance de reprise porte le retard réel.
        if (contreur) {
          if (!Number.isFinite(Number(t.due_counter)) && duePlan != null) t.due_counter = duePlan;
        } else if (!t.due_at && duePlan) {
          t.due_at = duePlan;
        }
        return t;
      }
      // Le SECOND compteur de la machine : une unité différente de celle du
      // plan, mais réellement suivie via ce second relevé — même règle de
      // reprise que le principal, sur SON échéance à lui.
      if (uniteCompatibleCompteur2(classement.unite, machine)) {
        if (!Number.isFinite(Number(t.due_counter)) && duePlanSecondaire != null) {
          t.due_counter = duePlanSecondaire;
          return t;
        }
        if (Number.isFinite(Number(t.due_counter))) return t;
        return echeancePropreTacheAppliquee(t, machine);
      }
      // Le SECOND suivi CALENDAIRE de la machine : même principe, mais sans
      // relevé à porter — chaque tâche calendaire garde déjà sa propre date
      // (echeancePropreTacheAppliquee repart de last_done_at/aujourd'hui,
      // exactement comme le calendaire principal, sans rien devoir à la
      // machine). La reprise ne sert qu'à hériter l'échéance DU PLAN
      // secondaire si la tâche n'a encore rien de son côté.
      if (uniteCompatibleCalendaireSecondaire(classement.unite, machine)) {
        if (!t.due_at && duePlanSecondaire != null) {
          t.due_at = duePlanSecondaire;
          return t;
        }
        if (t.due_at) return t;
        return echeancePropreTacheAppliquee(t, machine);
      }
      // Autre unité : sa propre échéance, dans son unité, hors du minimum du plan.
      delete t.due_at; delete t.due_counter;
      return echeancePropreTacheAppliquee(t, machine);
    }
    // 'inconnue' : aucun rythme établi, donc aucune échéance — surtout pas celle
    // du plan, qui faisait passer une tâche sans rythme pour en retard.
    delete t.interval; delete t.interval_unite; delete t.interval_choices;
    delete t.point_de_controle; delete t.due_at; delete t.due_counter;
    return t;
  });
}

// ── LE CLASSEMENT PROJETÉ POUR L'AFFICHAGE ────────────────────
// Une consultation ne doit JAMAIS montrer une information périmée : un plan
// jamais réenregistré se lit donc COMME S'IL VENAIT d'être enregistré. Le
// classement d'une fréquence est une fonction pure de son texte (et de sa
// structure) : il n'a aucune raison d'attendre une écriture en base.
//
// `projectionTaches` réemploie `preparerTaches` — EXACTEMENT la passe de
// l'écriture. Il n'existe donc pas de seconde règle côté affichage : ce que
// l'utilisateur voit et ce qui sera enregistré ne peuvent pas diverger.
// Elle ne MODIFIE rien : les éléments rendus sont des copies, et la base n'est
// touchée que sur une action de l'utilisateur (enregistrement, choix, entretien).
function projectionTaches(items, plan, machine) {
  const liste = normalizeItems(items);
  if (!liste.length) return liste;
  const duePlan = planIsCounter(plan) ? planNextDueCounter(plan) : (plan ? plan.next_due_at : null);
  return preparerTaches(liste, plan, machine, duePlan, uniteSuivi(plan, machine), planNextDueCounter2(plan)) || liste;
}

// Le même classement, à partir du plan : c'est LA fonction qu'emploient les
// écrans qui affichent des échéances (fiche du plan, prochain entretien,
// journal d'intervention, bandeau des retards, tâche la plus urgente).
function tachesAffichees(plan, machine) {
  return projectionTaches(plan && plan.items, plan, machine);
}

// Entretien enregistré : SEULES les tâches cochées avancent (leur échéance = le
// relevé saisi + leur intervalle). Les autres ne bougent pas — une tâche en
// retard le reste tant qu'elle n'a pas été cochée. Renvoie null quand le plan
// n'a aucun élément détaillé : le comportement d'avant s'applique alors.
// `releve2` : le relevé du SECOND compteur, saisi au même moment (voir
// SCHEMA.hasCounter2) — sert aux tâches dont l'unité correspond à ce second
// compteur, jamais au principal.
function tachesApresEntretien(items, plan, machine, cochees, releve, dateEntretien, releve2) {
  const unite = uniteSuivi(plan, machine);
  const contreur = planIsCounter(plan);
  const duePlan = contreur ? planNextDueCounter(plan) : (plan ? plan.next_due_at : null);
  const taches = preparerTaches(items, plan, machine, duePlan, unite, planNextDueCounter2(plan));
  if (!taches) return null;
  const faites = Array.isArray(cochees) ? cochees : [];
  const apres = taches.map(t => {
    if (!faites.includes(t.label)) return t;          // non cochée : NE BOUGE PAS
    const resolu = resolutionIntervalle(t, plan, machine);
    const tache = { ...t };
    if (!resolu) {
      // Pas d'intervalle (ambigu, point de contrôle, ou inconnu) : on note que
      // c'est fait, on n'invente pas d'échéance. L'échéance héritée est retirée
      // (elle ne veut plus rien dire) et l'interface dit pourquoi.
      if (contreur) { tache.last_done_counter = releve; delete tache.due_counter; }
      else { tache.last_done_at = dateEntretien; delete tache.due_at; }
      return tache;
    }
    if (UNITES_INTERVALLE[resolu.unite] && UNITES_INTERVALLE[resolu.unite].genre === 'date') {
      tache.last_done_at = dateEntretien;
      tache.due_at = ajouterIntervalleIso(dateEntretien, resolu.interval, resolu.unite);
      delete tache.due_counter;
      return tache;
    }
    // LEQUEL des deux relevés de la machine correspond à l'unité réelle de
    // cette tâche ? Sans cette distinction, une tâche en km avançait avec le
    // relevé saisi pour le suivi principal, même quand il était en heures —
    // même bug que la lecture de l'échéance, constaté le 23/09.
    const releveApplicable = uniteCompatibleCompteur2(resolu.unite, machine) ? releve2 : releve;
    tache.last_done_counter = releveApplicable;
    tache.due_counter = Number(releveApplicable) + Number(resolu.interval);
    delete tache.due_at;
    return tache;
  });
  return { items: apres, echeance: echeancePlanDepuisTaches(apres, plan), echeanceSecondaire: echeancePlanDepuisTachesSecondaire(apres, machine) };
}

// Le choix de l'utilisateur sur une tâche ambiguë. `choix` :
//   { interval, unite, libelle, libre }  une valeur (issue du carnet, ou libre)
//   { pointDeControle: true }            garder la tâche comme point de contrôle
//
// DEUX CAS BIEN DISTINCTS :
//   • une OPTION DU CARNET dans une autre unité que le plan (« ou 2 ans » sur un
//     compteur horaire) reste un point de contrôle : on ne fabrique pas une
//     échéance à partir d'une phrase du carnet ;
//   • une VALEUR LIBRE (`libre: true`) est un intervalle que l'utilisateur vient
//     d'exprimer, avec son unité : elle est acceptée TELLE QUELLE et reçoit sa
//     propre échéance, dans cette unité. Si l'unité diffère de celle du plan,
//     cette échéance ne compte pas dans l'échéance globale — mais la tâche garde
//     la sienne, et l'écran le dit.
// Le choix appliqué à UNE tâche déjà identifiée (extrait de
// appliquerChoixTache pour être réutilisable par item/index — voir
// ouvrirChoixFrequenceApercu, la même modale utilisée AVANT qu'un plan
// existe, où identifier une tâche par son label n'a pas de sens pour une
// ligne tout juste ajoutée à la main).
function appliquerChoixSurTache(it, choix, plan, machine) {
  const t = { ...it };
  // Compatible avec le plan PRINCIPAL, ou avec le SECOND suivi (compteur ou
  // calendaire) : les trois comptent comme « suivi », pas seulement le
  // principal — sinon un choix résolu avant l'existence du second suivi
  // (ou simplement dans son unité) restait figé en point de contrôle,
  // même une fois ce second suivi actif. Signalé le 23/09 sur « Filtre
  // d'habitacle » (Peugeot 208, 20 000 km / 1 an, résolu en années).
  const compatible = choix.pointDeControle ? false : (
    uniteCompatiblePlan(choix.unite, plan, machine)
    || uniteCompatibleCompteur2(choix.unite, machine)
    || uniteCompatibleCalendaireSecondaire(choix.unite, machine)
  );
  if (choix.pointDeControle || (!compatible && !choix.libre)) {
    delete t.interval;
    delete t.interval_unite;
    delete t.due_counter;
    delete t.due_at;
    t.point_de_controle = true;
    t.interval_choisi = choix.pointDeControle
      ? trad('Point de contrôle')
      : (choix.libelle || libelleOption(choix));
    return t;
  }
  t.interval = Number(choix.interval);
  t.interval_unite = choix.unite;
  t.interval_choisi = choix.libelle || libelleOption({ interval: choix.interval, unite: choix.unite });
  delete t.point_de_controle;
  delete t.interval_choices;
  // MÊME calcul d'échéance propre que la passe de préparation : une seule
  // implémentation, donc un choix de l'utilisateur et une fréquence lue dans un
  // carnet ne peuvent pas produire deux échéances différentes.
  return echeancePropreTacheAppliquee(t, machine);
}
function appliquerChoixTache(items, label, choix, plan, machine) {
  return normalizeItems(items).map(it => it.label === label ? appliquerChoixSurTache(it, choix, plan, machine) : it);
}

// Relie (ou retire) un kit d'entretien à UNE tâche précise d'un plan. Écrit
// TOUT le tableau items (même motif que appliquerChoixTache ci-dessus —
// aucune RPC de patch JSONB n'existe pour ces plans). Identifie la tâche par
// `item_id` quand elle en a déjà un ; sinon par SA POSITION dans le tableau
// (jamais par `label` seul, qui peut être dupliqué entre deux tâches — voir
// appliquerChoixTache, qui a encore cette faille, non corrigée ici pour
// rester un diff séparé et facile à relire). La position est un identifiant
// sûr ici : tachesAffichees/projectionTaches/preparerTaches ne font que des
// `.map()` sur `items`, jamais de tri ni de filtre — l'ordre affiché à
// l'écran est TOUJOURS celui de `plan.items` en base, vérifié en lisant ces
// trois fonctions avant d'écrire ce code.
function appliquerKitTache(items, index, itemId, kitId) {
  return normalizeItems(items).map((it, i) => {
    const estLaTache = itemId ? it.item_id === itemId : i === index;
    if (!estLaTache) return it;
    const t = { ...it };
    if (!t.item_id) t.item_id = crypto.randomUUID();
    if (kitId) t.kit_id = kitId; else delete t.kit_id;
    return t;
  });
}
