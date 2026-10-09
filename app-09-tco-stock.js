/* KALEA — application (app.html) : Vue Coûts & TCO, Stock & SAV (magasins, inventaire, mouvements, kits, imports).
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · Vue : Coûts & TCO
 *   · IMPORT CSV DU CATALOGUE DE PIÈCES
 *   · Magasins ── CRUD réservé au gérant (peutGererParametresStock), même
 *   · Inventaire ── lecture pure de UI.stockItems (déjà chargé au boot,
 *   · Mouvements ── journal append-only, jamais chargé au boot (un
 *   · Kits d'entretien ── bundles nommés et réutilisables de pièces +
 *   · Besoins à risque ── le vrai bénéfice de configurer des kits : parmi
 *   · Modale « Nouveau mouvement » ── idiome .overlay/.modal habituel
 *   · IMPORT CSV DES MOUVEMENTS DE STOCK
 */
// ───────────────────────── début du code ─────────────────────────
// ── Vue : Coûts & TCO ─────────────────────────────────────────
// Page à part (bandeau vertical), pas une carte de plus dans « Mon compte » :
// les réglages financiers ne doivent pas se noyer dans les réglages
// d'identité de société. N'existe dans NAV_ITEMS/le menu mobile que si
// tcoActif() (voir navItemsVisibles) — même garde-fou que le reste de la
// fonctionnalité (voir keeva-tco-feature).
// Bandeau eyebrow + actions, au-dessus du h1 (déjà rendu par pageHeadHtml).
// « Journal d'audit » retiré (aucun journal n'existe). « Rapport TCO (PDF) »
// est maintenant réel : le bouton reste désactivé au premier rendu (données
// flotte pas encore chargées) et n'est activé qu'une fois VIEWS.tco.mount()
// a réellement calculé `flotte` — jamais cliquable sur des données absentes,
// voir le câblage dans mount().
function tcoEyebrowToolbarHtml() {
  return `
    <div class="ui-barre is-droite">
      <button type="button" class="ui-btn ui-btn-pastille" id="tco-rapport-pdf" disabled title="${esc(trad('Chargement des données du parc…'))}">${picto('export')}<span>${trad('Rapport TCO (PDF)')}</span></button>
    </div>`;
}
// KPI : uniquement des valeurs réelles — la tuile « TCO moyen flotte » du
// mockup (agrégat multi-machines + tendance) n'a pas été reprise, ce calcul
// n'existe pas encore (voir keeva-tco-feature, phase 2).
function tcoKpiGridHtml() {
  const c = UI.company || {};
  const zone = c.currency === 'XPF' ? trad('Calédonie, Polynésie, Wallis') : trad('Europe');
  const tauxActif = c.labor_hourly_rate != null;
  return `
    <section class="ui-section">
      ${tcoEyebrowToolbarHtml()}
      <div class="ui-grille is-3">
        <div class="ui-tuile">
          <span class="ui-tuile-etiquette">${trad('Devise d\'exploitation')}</span>
          <span class="ui-tuile-valeur" id="tco-kpi-devise-valeur">${esc(c.currency || 'EUR')}</span>
          <span class="ui-tuile-note" id="tco-kpi-devise-zone">${esc(zone)}</span>
        </div>
        <div class="ui-tuile">
          <span class="ui-tuile-etiquette">${trad('Taux main d\'œuvre')}</span>
          <span class="ui-tuile-valeur">${tauxActif ? texteAvecSeparateurs(c.labor_hourly_rate) : '—'}<small id="tco-kpi-taux-unite">${deviseCourte()}/h</small></span>
          <span class="ui-tuile-note">${tauxActif ? trad('Barème actif') : trad('Non renseigné')}</span>
        </div>
        <div class="ui-tuile">
          <span class="ui-tuile-etiquette">${trad('Catalogue pièces')}</span>
          <span class="ui-tuile-valeur">${(UI.partsCatalog || []).length}<small>${trad('référence(s)')}</small></span>
        </div>
      </div>
    </section>`;
}
function blocParametresTcoHtml() {
  const c = UI.company || {};
  const gerant = UI.role === 'gerant';
  const bloque = gerant ? '' : ' disabled';
  const dv = c.currency === 'XPF' ? 'XPF' : '€';
  const champ = (id, libelle, valeur, unite, uniteId, note) => `
          <div class="ui-champ-groupe">
            <label class="ui-etiquette" for="${id}">${libelle}</label>
            <div class="ui-champ-unite">
              <input id="${id}" class="ui-champ" type="text" inputmode="decimal" value="${valeur != null ? esc(valeur) : ''}"${bloque}>
              <span class="ui-unite" id="${uniteId}">${esc(unite)}</span>
            </div>
            <span class="ui-aide">${note}</span>
          </div>`;
  return `
    <section class="ui-section">
      <div class="ui-section-tete">
        <div class="ui-section-icone">${picto('reglages')}</div>
        <div class="ui-section-titres">
          <h2 class="ui-section-titre">${trad('Paramètres TCO & Barèmes suggérés')}</h2>
          <p class="ui-section-sous">${trad('Règles de calcul prédictif des coûts d\'intervention')}</p>
        </div>
      </div>
      <div class="ui-section-corps">
        <div class="ui-encadre">
          ${picto('info')}
          <p><strong>${trad('Règle de calcul :')}</strong> ${trad('Le taux horaire sert à pré-calculer le coût de main d\'œuvre sur un entretien. Les barèmes ci-dessous sont de simples valeurs')} <strong>${trad('SUGGÉRÉES')}</strong> ${trad('lors de l\'ajout d\'un coût d\'exploitation — ils ne sont jamais appliqués sans confirmation manuelle.')}</p>
        </div>
        ${!gerant ? `<div class="ui-aide">${trad('Réservé au gérant.')}</div>` : ''}
        <div class="ui-encadre">
          ${picto('info')}
          <div>
            <p><strong>${trad('Devise principale de la flotte :')}</strong> ${esc(libelleDevise(c.currency === 'XPF' ? 'XPF' : 'EUR'))}. ${trad('Elle se règle dans Mon compte, avec le pays.')}</p>
            <button type="button" class="ui-btn ui-btn-pastille" id="tco-devise-lien">${trad('Ouvrir Mon compte')}</button>
          </div>
        </div>
        <div class="ui-grille is-3">
          ${champ('tco-taux-horaire', trad('Taux horaire MO'), c.labor_hourly_rate, dv + '/h', 'tco-taux-horaire-unite', trad('Coût moyen atelier'))}
          ${champ('tco-assurance', trad('Assurance annuelle'), c.default_insurance_yearly, dv + '/an', 'tco-assurance-unite', trad('Primes RC & machine'))}
          ${champ('tco-stockage', trad('Stockage annuel'), c.default_storage_yearly, dv + '/an', 'tco-stockage-unite', trad('Hangar, parc fermé'))}
        </div>
        <div class="ui-aide" id="tco-parametres-msg" role="status" aria-live="polite"></div>
        <div><button type="button" class="ui-btn ui-btn-plein" id="tco-save-parametres"${bloque}>${picto('disquette')}<span>${trad('Enregistrer les paramètres')}</span></button></div>
      </div>
    </section>`;
}
// Montant avec décimales (les coûts PAR HEURE sont petits : 3,75 € ne doit pas devenir 4 €).
function formatMontantFin(valeur) {
  if (valeur == null || valeur === '' || !isFinite(Number(valeur))) return '—';
  const devise = (UI.company && UI.company.currency) || 'EUR';
  return Number(valeur).toLocaleString(localeActive(), { style: 'currency', currency: devise, maximumFractionDigits: 2 });
}
// Repère de seuil : ce que l'USURE seule coûte par heure (ou par km) pour les machines d'une catégorie,
// d'après leurs propres chiffres — (prix d'achat − revente estimée) ÷ durée de vie. Aucune donnée externe.
// `null` quand aucune machine de la catégorie a prix d'achat ET durée de vie renseignés.
function repereAmortissementCategorie(categorieId) {
  const lignes = [];
  let unite = null;
  let ignorees = 0;
  (UI.machines || []).filter((m) => m.category && m.category.id === categorieId).forEach((m) => {
    const achat = Number(m.purchase_price);
    const vie = Number(m.expected_lifespan_counter);
    const u = counterUnitOf(m);
    const revente = Number(m.estimated_resale_value) || 0;
    if (!(achat > 0) || !(vie > 0) || (u !== 'hours' && u !== 'km') || achat <= revente || (unite && u !== unite)) { ignorees++; return; }
    unite = u;
    lignes.push({ nom: m.name, achat, revente, vie, parUnite: (achat - revente) / vie });
  });
  if (!lignes.length) return null;
  return { lignes, unite, ignorees, moyenne: lignes.reduce((t, l) => t + l.parUnite, 0) / lignes.length };
}
// Seuils cibles de coût horaire, PAR CATÉGORIE (phase 3, §5) — pas un
// seuil unique pour toute la flotte : un parc hétérogène (mini-pelle vs
// débroussailleuse) n'a pas le même coût horaire "normal", un seul chiffre
// comparerait des choses incomparables. Une ligne par catégorie CONNUE
// (UI.categories, pas seulement celles déjà présentes dans le classement)
// : un gérant peut préparer un seuil avant même d'avoir ajouté de machine
// dans cette catégorie. Champ vide = aucun seuil = aucun badge d'écart nulle
// part (voir ligneClassementTcoHtml) — jamais un seuil inventé.
// Reprise Stitch (phase 3, re-skin, voir keeva-tco-feature) : le tag
// « Recommandé ~X » du mockup n'a aucune donnée réelle derrière (aucun
// barème par catégorie de machine à disposition) — remplacé par une
// « Moyenne actuelle » calculée sur les VRAIES machines de la catégorie,
// remplie en asynchrone une fois le classement chargé (voir mount(), même
// donnée que flotte.lignes, pas un second calcul). Le sous-titre
// descriptif du mockup (« Outillage à conducteur »…) n'existe pas non plus
// comme donnée réelle — remplacé par le nombre réel de machines suivies
// dans cette catégorie.
function blocSeuilsCategorieTcoHtml() {
  const gerant = UI.role === 'gerant';
  const bloque = gerant ? '' : ' disabled';
  // Les catégories du SUIVI : celles que portent réellement les machines du parc (pas les catégories restées en base
  // sans machine). Le nom et le seuil viennent de la liste des catégories quand elle la connaît, de la machine sinon.
  const parId = new Map();
  (UI.machines || []).forEach((m) => {
    if (!m.category || !m.category.id || !String(m.category.name || '').trim()) return;
    if (!parId.has(m.category.id)) parId.set(m.category.id, (UI.categories || []).find((c) => c.id === m.category.id) || m.category);
  });
  const categories = [...parId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'));
  if (!categories.length) return '';
  const TEINTES = ['is-roi', 'is-ok', 'is-amber', 'is-indigo'];
  return `
    <section class="ui-section">
      <div class="ui-section-tete">
        <div class="ui-section-icone">${picto('curseurs')}</div>
        <div class="ui-section-titres">
          <span class="ui-section-sur-titre">${trad('Paramétrage de rentabilité')}</span>
          <h2 class="ui-section-titre">${trad('Seuils cibles de coût horaire')}</h2>
          <p class="ui-section-sous">${trad('Par catégorie de machine — utilisé pour l\'écart affiché dans le classement TCO')}</p>
        </div>
      </div>
      <div class="ui-section-corps">
        <div class="ui-encadre is-conseil">
          ${picto('ampoule')}
          <div>
            <span class="ui-encadre-titre">${trad('Comment fixer un seuil cohérent ?')}</span>
            <p>${trad('C\'est le coût horaire au-delà duquel une machine de cette catégorie est signalée comme trop chère à l\'usage (classement TCO, tableau de bord). Vise un chiffre légèrement AU-DESSUS de ta moyenne actuelle plutôt qu\'égal à elle — sinon la moitié de ta flotte serait signalée en permanence. Les boutons sous chaque catégorie proposent un point de départ calculé sur tes propres machines.')}</p>
          </div>
        </div>
        ${!gerant ? `<div class="ui-aide">${trad('Réservé au gérant.')}</div>` : ''}
        <div class="ui-deux is-egal">
          ${categories.map((cat, i) => {
            const nbMachines = (UI.machines || []).filter((m) => m.category?.id === cat.id).length;
            const repere = repereAmortissementCategorie(cat.id);
            return `
            <div class="ui-liste"><div class="ui-ligne" data-seuil-ligne data-categorie-id="${esc(cat.id)}">
              <div class="ui-ligne-id">
                <div class="ui-ligne-icone ${TEINTES[i % TEINTES.length]}">${picto(iconeCategorieMachine(cat.name))}</div>
                <div class="ui-ligne-textes">
                  <span class="ui-ligne-nom">${esc(cat.name)}</span>
                  <span class="ui-ligne-sous">${tR('{n} machine(s) suivie(s)', { n: nbMachines })}</span>
                </div>
              </div>
              <div class="ui-ligne-info">
                <span class="ui-tag" data-seuil-moyenne-categorie="${esc(cat.id)}"></span>
                <div class="ui-puces tco-seuil-raccourcis" data-seuil-raccourcis-categorie="${esc(cat.id)}" hidden></div>
                ${repere ? `
                <span class="ui-tag">${tR('Amortissement indicatif : {m}/{unite}', { m: formatMontantFin(repere.moyenne), unite: counterShort(repere.unite) })}</span>
                ${gerant ? `<button type="button" class="ui-btn ui-btn-teinte" data-seuil-amort="${Math.round(repere.moyenne * 100) / 100}">${tR('= amortissement ({m})', { m: formatMontantFin(repere.moyenne) })}</button>` : ''}` : ''}
              </div>
              <div class="ui-ligne-action">
                <div class="ui-champ-unite">
                  <input type="text" inputmode="decimal" class="ui-champ" data-seuil-input value="${cat.target_hourly_cost != null ? esc(cat.target_hourly_cost) : ''}"${bloque}>
                  <span class="ui-unite">${deviseCourte()}/h</span>
                </div>
              </div>
              ${repere ? `
              <details class="ui-ligne-calcul">
                <summary>${trad('Comment est calculé ce repère ?')}</summary>
                <p>${tR('Amortissement par {mot} = (prix d\'achat − revente estimée) ÷ durée de vie. C\'est ce que la machine coûte par {mot} rien que par son usure, sans l\'entretien, le carburant ni la main-d\'œuvre : un seuil réaliste se place au-dessus.', { mot: repere.unite === 'km' ? trad('kilomètre') : trad('heure') })}</p>
                <ul>${repere.lignes.map((l) => `<li>${esc(l.nom)} : (${formatMontant(l.achat)} − ${formatMontant(l.revente)}) ÷ ${texteAvecSeparateurs(l.vie)} ${counterShort(repere.unite)} = <strong>${formatMontantFin(l.parUnite)}/${counterShort(repere.unite)}</strong></li>`).join('')}</ul>
                ${repere.lignes.length > 1 ? `<p>${tR('Moyenne des {n} machines : {m}/{unite}', { n: repere.lignes.length, m: formatMontantFin(repere.moyenne), unite: counterShort(repere.unite) })}</p>` : ''}
                ${repere.ignorees ? `<p>${tR('{n} machine(s) non comptée(s) : prix d\'achat, revente ou durée de vie à renseigner dans leur fiche.', { n: repere.ignorees })}</p>` : ''}
              </details>` : ''}
            </div></div>`;
          }).join('')}
        </div>
        <div class="ui-aide" id="tco-seuils-msg" role="status" aria-live="polite"></div>
        <div><button type="button" class="ui-btn ui-btn-plein" id="tco-save-seuils"${bloque}>${picto('coche')}<span>${trad('Enregistrer les seuils')}</span></button></div>
      </div>
    </section>`;
}
// Donut RÉEL (phase 2) — remplace l'illustration « MODÈLE KALEA » statique
// de la phase 1. Factorisé : réutilisé par la page Coûts & TCO (grand) ET
// la carte du tableau de bord (petit, voir tcoDashboardCarteHtml) — une
// seule trace SVG, jamais deux qui divergent. `centreHtml` (phase 3, re-skin
// Stitch) : contenu optionnel superposé au centre (ex. « Total TCO » +
// montant) — absent par défaut, donc tous les appels existants sans ce
// 3ᵉ argument gardent EXACTEMENT le même rendu qu'avant.
function donutTcoSvgHtml(repartition, taille, centreHtml) {
  if (!repartition) return '';
  const d = repartition;
  const offsetMo = -d.pctPieces;
  const offsetFixes = -(d.pctPieces + d.pctMainOeuvre);
  return `
    <div style="width:${taille}px;height:${taille}px;flex:0 0 auto;position:relative;display:flex;align-items:center;justify-content:center;">
      <svg viewBox="0 0 36 36" style="width:${taille}px;height:${taille}px;transform:rotate(-90deg);">
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--surface-soft)" stroke-width="4.5"/>
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bleu-roi)" stroke-width="4.5" stroke-dasharray="${d.pctPieces},100" stroke-linecap="round"/>
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--ok)" stroke-width="4.5" stroke-dasharray="${d.pctMainOeuvre},100" stroke-dashoffset="${offsetMo}" stroke-linecap="round"/>
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--late)" stroke-width="4.5" stroke-dasharray="${d.pctFixes},100" stroke-dashoffset="${offsetFixes}" stroke-linecap="round"/>
      </svg>
      ${centreHtml ? `<div class="tco-donut-centre">${centreHtml}</div>` : ''}
    </div>`;
}
// Une carte du classement flotte (phase 3 — remplace la ligne plate de la
// phase 2). Clic → fiche machine via wireAlertRows() (même délégation,
// [data-machine] sans [data-alerte], voir mount() de VIEWS.tco).
// `ventilation` : { pieces, mainOeuvre, heures } de ventilationCoutsInterventions()
// — sur la fenêtre affichée (lifetime si aucun filtre de période actif).
// `periodeInfo` : null si aucun filtre de période actif (comportement
// identique à la phase 2) ; sinon { depenses, decision } — `decision` peut
// être null si la machine n'a pas de durée d'amortissement, auquel cas on
// REPLIE sur le ratio lifetime et on le DIT explicitement (jamais un
// chiffre silencieux qui change de sens sans prévenir, voir
// ratioDecisionTcoSurPeriode).
// Reprise Stitch (phase 3, re-skin, voir keeva-tco-feature) : le bouton
// « Ajouter un coût » de la version précédente n'existe plus — le mockup
// utilise ce même emplacement (le cercle à droite) pour le badge d'état
// verified/attention/alerte, qui n'est PAS une donnée fabriquée (repli
// direct sur `etat`, déjà calculé pour la pastille). L'action reste
// accessible via le clic sur la carte → fiche machine → « Enregistrer un
// entretien ».
function ligneClassementTcoHtml(machine, tco, decision, ventilation, periodeInfo) {
  const decisionAffichee = periodeInfo ? (periodeInfo.decision || decision) : decision;
  const periodeRepliee = !!periodeInfo && !periodeInfo.decision;
  const base = decisionAffichee ? decisionAffichee.base : null;
  const etat = decisionAffichee ? etatTco(decisionAffichee.ratio, base) : 'ok';
  const classeEtat = { ok: 'is-ok', soon: 'is-bientot', late: 'is-retard' }[etat];
  const libelles = TCO_ETAT_LABEL[base] || TCO_ETAT_LABEL.achat;
  // La base du ratio est TOUJOURS affichée à côté du chiffre : « 62 % de la
  // dépréciation » et « 41 % du prix d'achat » ne mesurent pas la même
  // chose, jamais le pourcentage seul.
  const ratioTexte = decisionAffichee
    ? tR('{n} % {base}', { n: Math.round(decisionAffichee.ratio * 100), base: base === 'amortissement' ? trad('de la dépréciation') : trad('du prix d\'achat') })
    : '';
  const uniteCourte = counterShort(counterUnitOf(machine));
  const photo = safeUrl(machine.image_url);
  const heures = machineCounter(machine);
  const montantPrincipal = periodeInfo ? periodeInfo.depenses : tco.total;
  const libelleMontant = periodeInfo ? trad('Dépenses sur la période') : trad('TCO total');
  const totalVentile = ventilation ? ventilation.pieces + ventilation.mainOeuvre : 0;
  const pctPieces = totalVentile > 0 ? Math.round((ventilation.pieces / totalVentile) * 100) : null;
  // Seuil cible par catégorie (phase 3, §5) — jamais un écart affiché sans
  // seuil réellement défini pour CETTE catégorie précise.
  const seuil = machine.category?.target_hourly_cost;
  const ecart = (seuil != null && tco.coutParUnite != null) ? tco.coutParUnite - Number(seuil) : null;
  // Tendance affichée à côté du coût horaire : reformulation du MÊME état
  // ok/soon/late, jamais un jugement séparé.
  const TENDANCE = { ok: trad('Optimal'), soon: trad('À surveiller'), late: trad('Dérive') };
  const sousTitre = [
    machine.category?.name ? esc(machine.category.name) : '',
    heures != null ? tR('{n} {unite} cumulé(e)s', { n: esc(heures), unite: uniteCourte }) : '',
    machine.service_date ? tR('Mise en service : {date}', { date: esc(machine.service_date) }) : '',
    pctPieces != null ? tR('Pièces {n}%', { n: pctPieces }) : '',
    (() => { const vie = partDureeDeVie(machine); return vie ? tR('Durée de vie : {n} %', { n: vie.pct }) : ''; })(),
    periodeRepliee ? trad('(basé sur tout l\'historique)') : '',
  ].filter(Boolean).join(' · ');
  return `
    <div class="ui-ligne ${classeEtat}" data-machine="${esc(machine.id)}">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone">${photo ? `<img src="${esc(photo)}" alt="${esc(machine.name)}" loading="lazy">` : picto('boite')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(machine.name)}</span>
          <span class="ui-ligne-sous">${sousTitre}</span>
        </div>
      </div>
      <div class="ui-chiffres">
        <div class="ui-chiffre">
          <span class="ui-chiffre-etiquette">${libelleMontant}</span>
          <span class="ui-chiffre-valeur">${formatMontant(montantPrincipal)}</span>
        </div>
        <div class="ui-chiffre">
          <span class="ui-chiffre-etiquette">${trad('Coût horaire')}${periodeInfo ? ` · ${trad('depuis l\'achat')}` : ''}</span>
          <span class="ui-chiffre-valeur">${tco.coutParUnite != null ? `${formatMontant(tco.coutParUnite)}/${uniteCourte}` : '—'}</span>
        </div>
      </div>
      <div class="ui-ligne-action is-etiquettes">
        ${decisionAffichee ? `<span class="ui-statut ${classeEtat}" title="${esc(libelles[etat]())}">${TENDANCE[etat]}</span>` : ''}
        ${ratioTexte ? `<span class="ui-tag">${ratioTexte}</span>` : ''}
        ${ecart != null ? `<span class="ui-statut ${ecart > 0 ? 'is-retard' : 'is-ok'}">${ecart > 0 ? `+${formatMontant(Math.round(ecart))}/${uniteCourte}` : trad('Sous le seuil')}</span>` : ''}
      </div>
    </div>`;
}
// Export CSV du classement — réutilise EXACTEMENT csvToUtf16Buffer (déjà
// utilisée par l'historique d'une machine et la préparation), pas une 3ᵉ
// copie du motif BOM/UTF-16LE.
// Reprise Stitch « Parc Machines » (voir keeva-redesign-project) : le
// mockup montre un bouton « Exporter (CSV) » qui n'existait pas encore
// pour la liste du parc elle-même (seuls le classement TCO et l'historique
// d'une machine avaient un export) — rendu réel ici plutôt que retiré,
// même motif que exporterClassementTcoCsv juste en dessous (une seule
// fonction csvToUtf16Buffer, jamais réécrite). Exporte exactement les
// machines actuellement filtrées/triées (fleetSorted(fleetMatches())),
// pas systématiquement la flotte entière — l'export reflète ce que
// l'utilisateur regarde à l'instant du clic.
function exporterParcCsv() {
  const header = [trad('Machine'), trad('Catégorie'), trad('Marque / Modèle'), trad('Identifiant'), trad('État'), trad('Compteur'), trad('Échéance'), trad('Carnet PDF')];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const liste = fleetSorted(fleetMatches());
  const rows = liste.map((m) => {
    const info = infoMachine(m);
    const unite = planIsCounter(m.plan) ? counterUnitOf(m) : null;
    const compteur = unite ? formatCounter(machineCounter(m), unite) : '';
    return [
      m.name, m.category?.name || '', machineBrandModel(m) || '', identifiantAffiche(m) || '',
      badgeLabel(info.state), compteur, info.short, m.manual_url ? trad('Oui') : trad('Non'),
    ];
  });
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csvToUtf16Buffer(csv)], { type: 'text/csv;charset=utf-16le;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `parc_machines_${todayIso()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function exporterClassementTcoCsv(flotte) {
  const header = [trad('Machine'), trad('Prix d\'achat'), trad('Date d\'achat'), trad('Revente estimée'), trad('Coûts entretien'), trad('Coûts d\'exploitation'), trad('TCO total'), trad('Coût annualisé'), trad('Coût/unité'), trad('Ratio (%)'), trad('Base du ratio'), trad('État')];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = flotte.lignes.map(({ machine, tco, decision }) => [
    machine.name, machine.purchase_price ?? '', machine.purchase_date ?? '', machine.estimated_resale_value ?? '',
    Math.round(tco.parEntretien), Math.round(tco.parExploitation), Math.round(tco.total),
    tco.coutAnnuel != null ? Math.round(tco.coutAnnuel) : '', tco.coutParUnite != null ? Math.round(tco.coutParUnite) : '',
    decision ? Math.round(decision.ratio * 100) : '', decision ? (decision.base === 'amortissement' ? trad('Dépréciation') : trad('Prix d\'achat')) : '',
    decision ? etatTco(decision.ratio, decision.base) : '',
  ]);
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csvToUtf16Buffer(csv)], { type: 'text/csv;charset=utf-16le;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tco_flotte_${todayIso()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
// Section pleine largeur, placeholder synchrone rempli en asynchrone dans
// VIEWS.tco.mount() (même motif que la scorecard/coûts d'exploitation de
// openPlanView) : la flotte AVANT les réglages — c'est l'information
// actionnable, les réglages sont secondaires.
function tcoClassementFlotteHtml() {
  return `
    <section class="ui-section" id="tco-classement-section">
      <div class="ui-section-tete">
        <div class="ui-section-icone">${picto('graphique')}</div>
        <div class="ui-section-titres">
          <span class="ui-section-sur-titre">${trad('Analyse de flotte')}</span>
          <h2 class="ui-section-titre">${trad('Classement TCO du parc')}</h2>
          <p class="ui-section-sous">${trad('Comparaison analytique des machines, de la moins rentable à la plus optimisée')}</p>
        </div>
      </div>
      <div class="ui-section-corps" id="tco-classement-corps">
        <div class="ui-aide" data-chargement>${trad('Chargement…')}</div>
      </div>
    </section>`;
}
// Carte « Suivi TCO » du tableau de bord principal (phase 2, demandée
// explicitement — pas seulement sur la page Coûts & TCO). Même motif
// placeholder + remplissage asynchrone. Chargement séparé de celui de
// VIEWS.tco : chaque vue fait son propre fetch à son montage, pas de cache
// partagé entre pages (cohérent avec le reste de l'app, ex. l'historique
// d'une fiche machine est toujours rechargé à l'ouverture).
// Reprise Stitch « Tableau de bord » (voir keeva-tco-feature) — widget très
// enrichi par rapport à la carte précédente (donut + 2 chiffres). Chaque
// nouveau chiffre réutilise une fonction pure déjà écrite pour la page
// Coûts & TCO (tendanceRatioMoyenFlotte, machinesAuDessusSeuilCategorie,
// categorieTcoAMettreEnAvant) — jamais un calcul dupliqué qui pourrait
// diverger. Le mockup compare le coût horaire à UN seuil unique
// (« < Seuil 6 500 FCFP ») : impossible ici honnêtement, les seuils sont
// PAR CATÉGORIE (§5) — remplacé par le compte réel de machines au-dessus de
// LEUR seuil, et la carte « catégorie à surveiller » (bloc 3) porte le
// seuil concret d'UNE catégorie réelle, jamais une comparaison globale
// inventée.
function tcoDashboardCarteHtml() {
  const tauxActif = UI.company?.labor_hourly_rate != null;
  return `
    <section class="ui-section" id="tco-dashboard-carte">
      ${teteSectionKit('argent', trad('Suivi TCO & Rentabilité'), tauxActif ? trad('Basé sur le barème atelier actif') : trad('Taux horaire non renseigné'),
        `<span class="ui-tag">${trad('Temps réel')}</span><button type="button" class="ui-btn ui-btn-pastille" data-nav="tco">${trad('Détail')}</button>`)}
      <div class="ui-section-corps" id="tco-dashboard-corps">
        <div class="ui-aide" data-chargement>${trad('Chargement…')}</div>
      </div>
    </section>`;
}
async function chargerCarteTcoDashboard(root) {
  if (!tcoActif()) return;
  const carte = root?.querySelector('#tco-dashboard-carte');
  if (!carte) return;
  const valueEl = carte.querySelector('[data-chargement]');
  const corps = carte.querySelector('#tco-dashboard-corps');
  const machineIds = (UI.machines || []).map((m) => m.id);
  let flotte = null;
  let repartition = null;
  try {
    const [interventionsFlotte, coutsFlotte] = await Promise.all([
      fetchToutesInterventionsFlotte(machineIds),
      fetchTousCoutsExploitationFlotte(machineIds),
    ]);
    flotte = calculerFlotteTco(UI.machines || [], grouperParMachine(interventionsFlotte), grouperParMachine(coutsFlotte));
    repartition = repartitionFlotteTco(interventionsFlotte, coutsFlotte);
  } catch (err) {
    if (valueEl) valueEl.textContent = trad('Erreur de chargement :') + ' ' + err.message;
    return;
  }
  if (!root.isConnected || !carte.isConnected) return;
  if (!flotte) { carte.remove(); return; }
  if (valueEl) valueEl.remove();

  const tauxActif = UI.company?.labor_hourly_rate != null;
  const coutHoraireValeurs = flotte.lignes.map((l) => l.tco.coutParUnite).filter((v) => v != null);
  const coutHoraireMoyen = coutHoraireValeurs.length ? coutHoraireValeurs.reduce((s, v) => s + v, 0) / coutHoraireValeurs.length : null;
  const auDessusSeuil = machinesAuDessusSeuilCategorie(flotte);
  const coutHoraireEtat = auDessusSeuil.length > 0 ? 'late' : 'ok';
  const tendance = tendanceRatioMoyenFlotte(flotte);
  const spotlight = categorieTcoAMettreEnAvant(flotte);
  // Unité (h/km) : celle d'une vraie machine de cette catégorie — jamais
  // supposée, prise sur la première trouvée.
  const machineSpotlight = spotlight ? flotte.lignes.find((l) => l.machine.category?.id === spotlight.categorie.id)?.machine : null;
  const uniteCourteSpotlight = machineSpotlight ? counterShort(counterUnitOf(machineSpotlight)) : 'h';

  const etatPoint = (e) => classeEtatKit(e);
  corps.insertAdjacentHTML('beforeend', `
    <div class="ui-grille">
      <div class="ui-tuile">
        <span class="ui-tuile-etiquette">${trad('TCO Moyen Annuel')}</span>
        <span class="ui-tuile-valeur">${formatMontant(flotte.coutAnnuelMoyen)}</span>
        <span class="ui-tuile-note"><span class="ui-point ${etatPoint(tendance.etat)}"></span>${tendance.label}</span>
      </div>
      <div class="ui-tuile ${coutHoraireEtat === 'late' ? 'is-retard' : 'is-ok'}">
        <span class="ui-tuile-etiquette">${trad('Coût Horaire')}</span>
        <span class="ui-tuile-valeur">${coutHoraireMoyen != null ? formatMontant(Math.round(coutHoraireMoyen)) : '—'}</span>
        <span class="ui-tuile-note">${auDessusSeuil.length > 0 ? tR('{n} machine(s) au-dessus du seuil', { n: auDessusSeuil.length }) : trad('Aucune machine au-dessus du seuil')}</span>
      </div>
    </div>
    ${repartition ? `
    <div class="ui-tuile">
      <span class="ui-tuile-etiquette">${trad('Répartition réelle des charges')}</span>
      <span class="ui-tuile-note">${tR('{montant} cumulés', { montant: formatMontant(repartition.total) })}</span>
      <div class="tco-donut-barre">
        <span style="width:${repartition.pctPieces}%;background:var(--bleu-roi);"></span>
        <span style="width:${repartition.pctMainOeuvre}%;background:var(--ok);"></span>
        <span style="width:${repartition.pctFixes}%;background:var(--late);"></span>
      </div>
      <div class="tco-dash-legende">
        <span><span class="rond" style="background:var(--bleu-roi);"></span>${tR('Pièces {n}%', { n: Math.round(repartition.pctPieces) })}</span>
        <span><span class="rond" style="background:var(--ok);"></span>${tR('M.O. {n}% ({h}h)', { n: Math.round(repartition.pctMainOeuvre), h: Math.round(repartition.heures) })}</span>
        <span><span class="rond" style="background:var(--late);"></span>${tR('Fixes {n}%', { n: Math.round(repartition.pctFixes) })}</span>
      </div>
    </div>` : ''}
    ${spotlight ? `
    <div class="ui-liste">
      <div class="ui-ligne is-deux">
        <div class="ui-ligne-id">
          <div class="ui-ligne-icone">${picto(iconeCategorieMachine(spotlight.categorie.name))}</div>
          <div class="ui-ligne-textes">
            <span class="ui-ligne-nom">${esc(spotlight.categorie.name)}</span>
            <span class="ui-ligne-sous">${tR('Seuil cible max. : {seuil}/{unite}', { seuil: formatMontant(Number(spotlight.categorie.target_hourly_cost)), unite: uniteCourteSpotlight || 'h' })}</span>
          </div>
        </div>
        <div class="ui-ligne-action"><span class="ui-statut ${spotlight.ecart > 0 ? 'is-retard' : 'is-ok'}">${spotlight.ecart > 0 ? trad('À surveiller') : trad('Optimal')}</span></div>
      </div>
    </div>` : ''}
    <div class="ui-aide"><span class="ui-point ${auDessusSeuil.length > 0 ? 'is-retard' : 'is-ok'}"></span> ${tR('{n} machine(s) au-dessus du seuil cible', { n: auDessusSeuil.length })} · ${tauxActif ? tR('Taux M.O : {taux}/h', { taux: formatMontant(UI.company.labor_hourly_rate) }) : trad('Taux M.O. non renseigné')}</div>`);
}
// Une ligne = un item compact (icône + désignation/référence à gauche, prix
// + actions à droite) plutôt qu'un tableau à 4 colonnes : tient sur une
// seule ligne même dans la colonne étroite (38 %), sans défilement
// horizontal — c'est ce composant, pas juste la largeur, qui répond au
// « ligne entière visible » demandé.
// Icône unique pour toutes les pièces (pas de catégorie par pièce en base —
// contrairement au mockup qui varie l'icône par type de produit, aucune
// donnée réelle ne permet de deviner « huile »/« filtre »/« bougie » ici).
function ligneCatalogueTcoHtml(piece) {
  const refEtDelai = [
    piece.reference || trad('Sans référence'),
    [piece.supplier_name || '', piece.avg_lead_time_days != null ? tR('{n} j', { n: piece.avg_lead_time_days }) : ''].filter(Boolean).join(' - '),
  ].filter(Boolean).join(' · ');
  return `
    <div class="ui-ligne is-deux" data-piece-id="${esc(piece.id)}">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone">${picto('boite')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(piece.designation)}${piece.packaging ? `<span class="ui-tag">${esc(piece.packaging)}</span>` : ''}</span>
          <span class="ui-ligne-sous">${esc(refEtDelai)}</span>
          ${piece.default_reorder_point != null ? `<span class="ui-ligne-sous">${tR('Seuil bas : {n}', { n: texteAvecSeparateurs(piece.default_reorder_point) })}</span>` : ''}
        </div>
      </div>
      <div class="ui-ligne-action">
        <div class="ui-chiffre is-droite"><span class="ui-chiffre-valeur">${texteAvecSeparateurs(piece.unit_price)}</span><span class="ui-ligne-sous">${esc(deviseCourte())}</span></div>
        <button type="button" class="ui-btn ui-btn-icone" data-piece-modifier="${esc(piece.id)}" title="${esc(trad('Modifier'))}">${picto('crayon')}</button>
        <button type="button" class="ui-btn ui-btn-icone is-danger" data-piece-retirer="${esc(piece.id)}" title="${esc(trad('Supprimer'))}">${picto('corbeille')}</button>
      </div>
    </div>`;
}
// Reprise Stitch (voir keeva-tco-feature) — bloc élargi en pleine largeur
// (hors dash-grid, comme tcoClassementFlotteHtml) plutôt que confiné à une
// colonne : signalé par l'utilisateur, le catalogue devient difficile à
// lire dès qu'il contient beaucoup d'articles. Liste à gauche, formulaire
// d'ajout à droite (principe de positionnement d'une référence fournie par
// l'utilisateur — pas son design, juste les 2 sous-blocs côte à côte) :
// même id/structure interne qu'avant, seule l'ORGANISATION change, aucun
// câblage (wirePreparation-style) à toucher.
function blocCatalogueTcoHtml() {
  const pieces = UI.partsCatalog || [];
  return `
    <section class="ui-section" id="tco-catalogue-section">
      ${teteSectionKit('boite', trad('Catalogue de pièces'), trad('Sélectionnable sur chaque intervention (« Enregistrer un entretien ») pour calculer automatiquement le coût des pièces consommées.'),
        `<span class="ui-tag" id="tco-catalogue-badge">${tR('{n} référence(s) active(s)', { n: pieces.length })}</span><button type="button" class="ui-btn ui-btn-pastille" id="tco-catalogue-importer">${picto('televerser')}<span>${trad('Importer un CSV')}</span></button>`)}
      <div class="ui-section-corps">
        ${tcoTipCarteHtml()}
        <div class="ui-deux">
          <div class="ui-section-corps">
            <input id="tco-piece-filtre" class="ui-champ" placeholder="${trad('Rechercher par référence, désignation…')}">
            <div class="ui-liste is-defilant" id="tco-catalogue-liste">
              ${pieces.length ? pieces.map(ligneCatalogueTcoHtml).join('') : `<div class="ui-aide">${trad('Aucune pièce enregistrée pour l\'instant.')}</div>`}
            </div>
            <div class="ui-aide" id="tco-catalogue-msg" role="status" aria-live="polite"></div>
          </div>
          <div class="ui-groupe">
            <div class="ui-groupe-tete">${picto('plusCercle')}<span class="ui-groupe-titre" id="tco-piece-form-titre">${trad('Ajouter une pièce au catalogue')}</span></div>
            <div class="ui-grille">
              <div class="ui-champ-groupe">
                <label class="sr-only" for="tco-piece-reference">${trad('Référence')}</label>
                <input id="tco-piece-reference" class="ui-champ" placeholder="${trad('Réf (ex: FLT-0142)')}">
              </div>
              <div class="ui-champ-groupe">
                <label class="sr-only" for="tco-piece-prix">${trad('Prix unitaire')}</label>
                <div class="ui-champ-unite">
                  <input id="tco-piece-prix" class="ui-champ" type="text" inputmode="decimal" placeholder="${trad('Prix unitaire')}">
                  <span class="ui-unite" id="tco-piece-prix-unite">${esc(deviseCourte())}</span>
                </div>
              </div>
            </div>
            <div class="ui-champ-groupe">
              <label class="sr-only" for="tco-piece-designation">${trad('Désignation')}</label>
              <input id="tco-piece-designation" class="ui-champ" required placeholder="${trad('Désignation (ex: Filtre à huile moteur)')}">
            </div>
            <div class="ui-grille">
              <div class="ui-champ-groupe">
                <label class="sr-only" for="tco-piece-fournisseur">${trad('Fournisseur')}</label>
                <input id="tco-piece-fournisseur" class="ui-champ" placeholder="${trad('Fournisseur (optionnel)')}">
              </div>
              <div class="ui-champ-groupe">
                <label class="sr-only" for="tco-piece-delai">${trad('Délai moyen de disponibilité')}</label>
                <div class="ui-champ-unite">
                  <input id="tco-piece-delai" class="ui-champ" type="text" inputmode="numeric" placeholder="${trad('Délai moyen')}">
                  <span class="ui-unite">${trad('jours')}</span>
                </div>
              </div>
            </div>
            ${SCHEMA.hasStockPackaging || SCHEMA.hasStock ? `
            <div class="ui-grille">
              ${SCHEMA.hasStockPackaging ? `
              <div class="ui-champ-groupe">
                <label class="sr-only" for="tco-piece-conditionnement">${trad('Conditionnement')}</label>
                <input id="tco-piece-conditionnement" class="ui-champ" placeholder="${trad('Conditionnement (optionnel)')}">
              </div>` : ''}
              ${SCHEMA.hasStock ? `
              <div class="ui-champ-groupe">
                <label class="sr-only" for="tco-piece-seuil">${trad('Seuil de réapprovisionnement')}</label>
                <input id="tco-piece-seuil" class="ui-champ" type="text" inputmode="decimal" placeholder="${trad('Seuil bas (optionnel)')}">
              </div>` : ''}
            </div>` : ''}
            <div><button type="button" class="ui-btn ui-btn-plein" id="tco-piece-ajouter">${picto('plusCercle')}<span>${trad('Ajouter au catalogue')}</span></button></div>
            <div><button type="button" class="ui-btn ui-btn-pastille" id="tco-piece-annuler" hidden>${trad('Annuler la modification')}</button></div>
          </div>
        </div>
      </div>
    </section>`;
}

// ── IMPORT CSV DU CATALOGUE DE PIÈCES ──────────────────────────────────
// Format FIGÉ, documenté dans la modale et le modèle téléchargeable : en-tête
// EXACT, dans cet ordre précis (demande explicite de l'utilisateur — pas un
// mappage par nom de colonne, un ordre positionnel strict, plus simple et
// plus prévisible à documenter qu'un mapping flexible). Les 2 dernières
// colonnes sont AJOUTÉES À LA FIN seulement si leur migration est visible
// (SCHEMA.hasStockPackaging/hasStock) — jamais un en-tête qui réclame une
// colonne absente de la base au moment de l'import. Une seule base partagée
// (multi-tenant par company_id) : une fois la migration passée, elle est
// vue par TOUTES les sociétés en quelques secondes, jamais une variation
// durable d'une société à l'autre.
function enteteCsvPieces() {
  const entete = ['Référence', 'Désignation', 'Prix unitaire', 'Fournisseur', 'Délai moyen (jours)'];
  if (SCHEMA.hasStockPackaging) entete.push('Conditionnement');
  if (SCHEMA.hasStock) entete.push('Seuil de réapprovisionnement');
  return entete;
}

// Un seul champ par appel : gère les champs entre guillemets (avec `""`
// pour un guillemet littéral, RFC4180), mais PAS un retour à la ligne à
// l'intérieur d'un champ — un modèle/désignation ne devrait jamais en
// contenir, et ça garde ce parseur simple.
function analyserLigneCsv(ligne) {
  const champs = [];
  let courant = '';
  let dansGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (ligne[i + 1] === '"') { courant += '"'; i++; }
        else dansGuillemets = false;
      } else courant += c;
    } else if (c === '"') {
      dansGuillemets = true;
    } else if (c === ',') {
      champs.push(courant);
      courant = '';
    } else {
      courant += c;
    }
  }
  champs.push(courant);
  return champs;
}

// L'en-tête doit correspondre EXACTEMENT (nom ET ordre) — un mauvais fichier
// est rejeté d'un coup ici, avant de lire une seule ligne de données, plutôt
// que de deviner une correspondance approximative.
function analyserCsvCatalogue(texte) {
  const lignesBrutes = String(texte || '').split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
  if (!lignesBrutes.length) return { lignes: [], erreurs: [trad('Fichier vide.')] };
  const entete = analyserLigneCsv(lignesBrutes[0]).map((c) => c.trim());
  const enteteAttendu = enteteCsvPieces();
  const enteteOk = entete.length === enteteAttendu.length
    && entete.every((c, i) => c.toLowerCase() === enteteAttendu[i].toLowerCase());
  if (!enteteOk) {
    return {
      lignes: [],
      erreurs: [tR('En-tête invalide. Attendu : {attendu} — reçu : {recu}', {
        attendu: enteteAttendu.join(','), recu: entete.join(',') || trad('(vide)'),
      })],
    };
  }
  const lignes = [];
  const erreurs = [];
  for (let i = 1; i < lignesBrutes.length; i++) {
    const champs = analyserLigneCsv(lignesBrutes[i]).map((c) => (c || '').trim());
    const numero = i + 1; // numéro de ligne humain (1 = en-tête)
    // Les 2 dernières colonnes sont positionnelles, DANS L'ORDRE de
    // enteteCsvPieces() (Conditionnement avant Seuil si les deux sont
    // présentes) — jamais lues si leur migration n'est pas visible, comme
    // pour l'en-tête lui-même.
    const [reference, designation, prixTexte, fournisseur, delaiTexte, ...reste] = champs;
    if (!designation) { erreurs.push(tR('Ligne {n} : désignation manquante, ignorée.', { n: numero })); continue; }
    const prix = nombreDepuisTexte(prixTexte);
    if (prix == null) { erreurs.push(tR('Ligne {n} : prix unitaire invalide, ignorée.', { n: numero })); continue; }
    const delai = delaiTexte ? nombreDepuisTexte(delaiTexte) : null;
    const ligne = {
      reference: reference || null,
      designation,
      unit_price: prix,
      supplier_name: fournisseur || null,
      avg_lead_time_days: delai != null ? Math.round(delai) : null,
    };
    let idxReste = 0;
    if (SCHEMA.hasStockPackaging) {
      const conditionnement = reste[idxReste++];
      ligne.packaging = conditionnement ? conditionnement : null;
    }
    if (SCHEMA.hasStock) {
      const seuilTexte = reste[idxReste++];
      const seuil = seuilTexte ? nombreDepuisTexte(seuilTexte) : null;
      ligne.default_reorder_point = seuil != null ? seuil : null;
    }
    lignes.push(ligne);
  }
  return { lignes, erreurs };
}

// Lit un fichier texte en reconnaissant son BOM : nos propres exports
// (csvToUtf16Buffer) sont en UTF-16LE, mais un fichier préparé à la main
// (Excel, Google Sheets) est le plus souvent en UTF-8 (avec ou sans BOM) —
// les deux doivent être acceptés sans que l'utilisateur ait à s'en soucier.
async function lireTexteFichier(file) {
  const buffer = await file.arrayBuffer();
  const octets = new Uint8Array(buffer);
  if (octets[0] === 0xFF && octets[1] === 0xFE) return new TextDecoder('utf-16le').decode(buffer.slice(2));
  if (octets[0] === 0xFE && octets[1] === 0xFF) return new TextDecoder('utf-16be').decode(buffer.slice(2));
  if (octets[0] === 0xEF && octets[1] === 0xBB && octets[2] === 0xBF) return new TextDecoder('utf-8').decode(buffer.slice(3));
  return new TextDecoder('utf-8').decode(buffer);
}

function modeleCsvCatalogue() {
  const exemple = ['FLT-0142', 'Filtre à huile moteur', '24.90', 'Motoculture Pacifique', '5'];
  if (SCHEMA.hasStockPackaging) exemple.push('Boîte de 12');
  if (SCHEMA.hasStock) exemple.push('3');
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [enteteCsvPieces(), exemple].map((r) => r.map(escape).join(',')).join('\r\n');
}
function telechargerModeleCsvCatalogue() {
  const blob = new Blob([csvToUtf16Buffer(modeleCsvCatalogue())], { type: 'text/csv;charset=utf-16le;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modele_catalogue_pieces.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Import : un « Référence » déjà présente dans le catalogue de la société
// est MISE À JOUR (upsert sur company_id+reference, voir la contrainte
// unique posée en base), pas dupliquée ; une ligne sans référence est
// toujours ajoutée en neuf (NULL ne matche jamais NULL en SQL — comportement
// voulu, pas de clé naturelle fiable sans référence).
function ouvrirImportCatalogue() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay import-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const REGLES = [
    { icone: 'info', teinte: 'is-bleu', titre: trad('Référence et Fournisseur :'), texte: trad('facultatifs, peuvent rester vides.') },
    { icone: 'devise', teinte: 'is-vert', titre: trad('Prix unitaire :'), texte: trad('nombre (virgule ou point décimal accepté).') },
    { icone: 'bientot', teinte: 'is-ambre', titre: trad('Délai moyen (jours) :'), texte: trad('nombre entier, facultatif.') },
    ...(SCHEMA.hasStockPackaging ? [{ icone: 'boite', teinte: 'is-bleu', titre: trad('Conditionnement :'), texte: trad('texte libre (ex : « Boîte de 12 »), facultatif.') }] : []),
    ...(SCHEMA.hasStock ? [{ icone: 'alerte', teinte: 'is-ambre', titre: trad('Seuil de réapprovisionnement :'), texte: trad('quantité en dessous de laquelle une alerte se déclenche, facultatif.') }] : []),
  ];

  overlay.innerHTML = `
    <div class="modal import-csv-modal">
      <div class="import-csv-barre"></div>
      <div class="import-csv-corps">
        <div class="import-csv-entete">
          <div class="import-csv-entete-gauche">
            <div class="import-csv-icone">${picto('boite')}</div>
            <div>
              <h2>${trad('Importer le catalogue depuis un CSV')}</h2>
              <p class="import-csv-sous-titre">${trad('Mets à jour tes pièces et tarifs en un clic')}</p>
            </div>
          </div>
          <button type="button" class="log-close2" id="import-fermer-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
        </div>

        <div class="import-csv-section">
          <p class="import-csv-libelle">${trad('Fichier CSV avec un en-tête')} <strong class="import-csv-badge">${trad('EXACTEMENT')}</strong> ${trad('dans cet ordre :')}</p>
          <div class="import-csv-terminal">
            <div class="import-csv-terminal-tete">
              <span><span class="dot"></span>${tR('En-tête requis (colonnes 1 à {n})', { n: enteteCsvPieces().length })}</span>
              <button type="button" id="import-copier">${picto('copier')}<span>${trad('Copier')}</span></button>
            </div>
            <div class="import-csv-terminal-code">${esc(enteteCsvPieces().join(','))}</div>
          </div>
        </div>

        <div class="import-csv-section">
          <span class="import-csv-eyebrow">${trad('Règles & conditions de traitement')}</span>
          <div class="import-csv-regles">
            ${REGLES.map((r) => `
              <div class="import-csv-regle">
                <div class="import-csv-regle-icone ${r.teinte}">${picto(r.icone)}</div>
                <div><strong>${esc(r.titre)}</strong> ${esc(r.texte)}</div>
              </div>`).join('')}
            <div class="import-csv-regle is-accent">
              <div class="import-csv-regle-icone is-primaire">${picto('rafraichir')}</div>
              <div><strong>${trad('Mise à jour intelligente :')}</strong> ${trad('une pièce dont la Référence existe déjà dans ton catalogue est')} <span class="import-csv-souligne">${trad('mise à jour')}</span>${trad(', pas dupliquée.')}</div>
            </div>
          </div>
        </div>

        <div class="import-csv-section">
          <button type="button" class="import-csv-bouton-modele" id="import-modele">${picto('export')}<span>${trad('Télécharger un modèle')}</span></button>
          <input id="import-fichier" type="file" accept=".csv,text/csv" hidden>
          <div class="import-csv-zone" id="import-zone">
            <div class="import-csv-zone-icone">${picto('televerser')}</div>
            <span class="import-csv-zone-nom" id="import-choisir-label">${trad('Choisir un fichier…')}</span>
            <span class="import-csv-zone-aide">${trad('(ou glisser le .csv ici)')}</span>
          </div>
        </div>

        <div id="import-msg" role="status" aria-live="polite"></div>
      </div>
      <div class="import-csv-pied">
        <button type="button" class="secondary" id="import-fermer">${trad('Fermer')}</button>
        <button type="button" class="primary" id="import-go" disabled>${picto('coche')}<span>${trad('Importer')}</span></button>
      </div>
    </div>`;

  overlay.querySelector('#import-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#import-fermer-x').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#import-modele').addEventListener('click', telechargerModeleCsvCatalogue);

  // Copier l'en-tête : un confort, jamais bloquant si le presse-papiers est
  // indisponible (permission refusée, contexte non sécurisé) — le bouton
  // reste alors simplement sans effet visible, rien ne casse.
  const boutonCopier = overlay.querySelector('#import-copier');
  boutonCopier?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(enteteCsvPieces().join(','));
      const texteBtn = boutonCopier.querySelector('span');
      const avant = texteBtn.textContent;
      boutonCopier.classList.add('is-copie');
      texteBtn.textContent = trad('Copié !');
      setTimeout(() => { boutonCopier.classList.remove('is-copie'); texteBtn.textContent = avant; }, 2000);
    } catch (err) { /* presse-papiers indisponible : sans conséquence */ }
  });

  const inputFichier = overlay.querySelector('#import-fichier');
  const zone = overlay.querySelector('#import-zone');
  const labelChoisir = overlay.querySelector('#import-choisir-label');
  const boutonGo = overlay.querySelector('#import-go');
  const msg = overlay.querySelector('#import-msg');
  let fichierChoisi = null;

  const definirFichier = (fichier) => {
    fichierChoisi = fichier || null;
    labelChoisir.textContent = fichierChoisi ? fichierChoisi.name : trad('Choisir un fichier…');
    zone.classList.toggle('is-rempli', !!fichierChoisi);
    boutonGo.disabled = !fichierChoisi;
    msg.textContent = '';
  };

  zone.addEventListener('click', () => inputFichier.click());
  inputFichier.addEventListener('change', () => definirFichier(inputFichier.files?.[0] || null));
  // Glisser-déposer réel (pas juste le texte d'invite) : le fichier déposé
  // passe par le MÊME chemin que la sélection au clic.
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-survol'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-survol'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-survol');
    const depose = e.dataTransfer?.files?.[0];
    if (depose) definirFichier(depose);
  });

  const labelGo = boutonGo.querySelector('span');
  boutonGo.addEventListener('click', async () => {
    if (!fichierChoisi) return;
    boutonGo.disabled = true;
    labelGo.textContent = trad('Import en cours…');
    msg.textContent = '';
    try {
      const texte = await lireTexteFichier(fichierChoisi);
      const { lignes, erreurs } = analyserCsvCatalogue(texte);
      if (!lignes.length) {
        msg.style.color = 'var(--danger, #c0392b)';
        msg.textContent = erreurs.length ? erreurs.join(' ') : trad('Aucune ligne valide trouvée dans ce fichier.');
        boutonGo.disabled = false;
        labelGo.textContent = trad('Importer');
        return;
      }
      const { data, error } = await sb.from('parts_catalog')
        .upsert(
          lignes.map((l) => ({ ...l, company_id: UI.companyId })),
          { onConflict: 'company_id,reference' },
        )
        .select(colonnesCatalogueePiece());
      if (error) throw error;
      // Fusion dans UI.partsCatalog par id (remplace les pièces déjà connues,
      // ajoute les nouvelles) — même esprit que le reste de la vue TCO.
      const parId = new Map((UI.partsCatalog || []).map((p) => [String(p.id), p]));
      (data || []).forEach((p) => parId.set(String(p.id), p));
      UI.partsCatalog = [...parId.values()].sort((a, b) => a.designation.localeCompare(b.designation));
      renderApp();
      const succes = tR('{n} pièce(s) importée(s)/mise(s) à jour.', { n: lignes.length });
      if (erreurs.length) {
        // Erreurs partielles : la modale reste ouverte pour que le détail
        // soit lu, pas juste un toast qui disparaît.
        msg.style.color = '';
        msg.innerHTML = `<div>${esc(succes)}</div>`
          + `<div style="margin-top:6px;color:var(--danger, #c0392b);">${esc(tR('{m} ligne(s) ignorée(s) :', { m: erreurs.length }))}</div>`
          + `<ul style="margin:4px 0 0 18px;padding:0;">${erreurs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
        boutonGo.disabled = false;
        labelGo.textContent = trad('Importer');
      } else {
        showToast(succes);
        overlay.remove();
      }
    } catch (err) {
      msg.style.color = 'var(--danger, #c0392b)';
      msg.textContent = trad('Erreur :') + ' ' + (err.message || err);
      boutonGo.disabled = false;
      labelGo.textContent = trad('Importer');
    }
  });
}

// Astuce honnête : le mockup promettait un scan QR Code inexistant côté web
// — remplacé par un comportement RÉEL déjà construit (sélection catalogue →
// prix proposé, quantité décimale acceptée).
function tcoTipCarteHtml() {
  return `
      <div class="ui-encadre is-conseil">
        ${picto('ampoule')}
        <div>
          <span class="ui-encadre-titre">${trad('Astuce Gestionnaire')}</span>
          <p>${trad('Les pièces enregistrées ici sont proposées automatiquement dans « Enregistrer un entretien » : sélectionner une pièce remplit son prix, et la quantité accepte les décimales (0,5 pour un demi-bidon, par exemple).')}</p>
        </div>
      </div>`;
}
// Câblage du bloc « Catalogue de pièces » (recherche, ajout/édition/
// suppression, import CSV) — extrait pour être appelé aussi bien depuis
// VIEWS.tco.mount() (sociétés non-Enterprise : le catalogue reste dans
// Coûts & TCO, seul palier qu'elles voient) que depuis VIEWS.stock.mount()
// (sociétés Enterprise : déplacé dans Stocks & SAV, sa place naturelle
// maintenant que ce module existe — demande explicite de l'utilisateur).
// LE MÊME bloc HTML (blocCatalogueTcoHtml) n'est rendu qu'À UN SEUL des
// deux endroits selon planCouvreStock() (voir chaque render()), jamais
// dupliqué pour une même société — cette fonction ne fait que câbler
// l'endroit où il se trouve réellement dans le DOM à cet instant.
function cablerCatalogueTco(root) {
  const message = (el, texte, erreur) => {
    if (!el) return;
    el.textContent = texte;
    el.style.color = erreur ? 'var(--late)' : 'var(--ok)';
  };
  activerSeparateurMilliers(root.querySelector('#tco-piece-prix'));
  activerSeparateurMilliers(root.querySelector('#tco-piece-seuil'));

  // Recherche du catalogue : filtre client, comme le mockup — sur la
  // référence ET la désignation.
  root.querySelector('#tco-piece-filtre')?.addEventListener('input', (e) => {
    const terme = e.target.value.trim().toLowerCase();
    root.querySelectorAll('#tco-catalogue-liste [data-piece-id]').forEach((ligne) => {
      ligne.style.display = ligne.textContent.toLowerCase().includes(terme) ? '' : 'none';
    });
  });

  // Ajout ET modification d'une pièce partagent le même petit formulaire
  // (pas de deuxième formulaire, pas de modale à part) : `pieceEnEdition`
  // porte l'id de la pièce en cours de modification, ou `null` en mode
  // ajout — c'est lui qui décide si le bouton fait un insert ou un update.
  let pieceEnEdition = null;
  const champRef = root.querySelector('#tco-piece-reference');
  const champDesignation = root.querySelector('#tco-piece-designation');
  const champPrix = root.querySelector('#tco-piece-prix');
  const champFournisseur = root.querySelector('#tco-piece-fournisseur');
  const champDelai = root.querySelector('#tco-piece-delai');
  const champConditionnement = root.querySelector('#tco-piece-conditionnement');
  const champSeuil = root.querySelector('#tco-piece-seuil');
  const titreForm = root.querySelector('#tco-piece-form-titre');
  const boutonAjouter = root.querySelector('#tco-piece-ajouter');
  const boutonAjouterLabel = boutonAjouter?.querySelector('span');
  const boutonAnnuler = root.querySelector('#tco-piece-annuler');
  const COLONNES_PIECE = colonnesCatalogueePiece();
  const sortirDuModeEdition = () => {
    pieceEnEdition = null;
    if (champRef) champRef.value = '';
    if (champDesignation) champDesignation.value = '';
    if (champPrix) champPrix.value = '';
    if (champFournisseur) champFournisseur.value = '';
    if (champDelai) champDelai.value = '';
    if (champConditionnement) champConditionnement.value = '';
    if (champSeuil) champSeuil.value = '';
    if (titreForm) titreForm.textContent = trad('Ajouter une pièce au catalogue');
    if (boutonAjouterLabel) boutonAjouterLabel.textContent = trad('Ajouter au catalogue');
    if (boutonAnnuler) boutonAnnuler.hidden = true;
  };
  boutonAnnuler?.addEventListener('click', sortirDuModeEdition);
  root.querySelector('#tco-catalogue-importer')?.addEventListener('click', ouvrirImportCatalogue);

  boutonAjouter?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const msg = root.querySelector('#tco-catalogue-msg');
    const reference = champRef.value.trim();
    const designation = champDesignation.value.trim();
    const prix = nombreDepuisTexte(champPrix.value) ?? 0;
    const fournisseur = champFournisseur.value.trim();
    const delai = nombreDepuisTexte(champDelai.value);
    const conditionnement = champConditionnement ? champConditionnement.value.trim() : '';
    const seuil = champSeuil ? nombreDepuisTexte(champSeuil.value) : null;
    if (!designation) { message(msg, trad('La désignation est obligatoire.'), true); return; }
    btn.disabled = true;
    if (boutonAjouterLabel) boutonAjouterLabel.textContent = pieceEnEdition ? trad('Enregistrement…') : trad('Ajout…');
    const champsOptionnels = {
      ...(SCHEMA.hasStockPackaging ? { packaging: conditionnement || null } : {}),
      ...(SCHEMA.hasStock ? { default_reorder_point: seuil } : {}),
    };
    try {
      if (pieceEnEdition) {
        const { data, error } = await sb.from('parts_catalog')
          .update({
            reference: reference || null, designation, unit_price: prix,
            supplier_name: fournisseur || null, avg_lead_time_days: delai != null ? Math.round(delai) : null,
            ...champsOptionnels,
          })
          .eq('id', pieceEnEdition)
          .select(COLONNES_PIECE)
          .single();
        if (error) throw error;
        UI.partsCatalog = (UI.partsCatalog || [])
          .map((p) => (String(p.id) === String(pieceEnEdition) ? data : p))
          .sort((a, b) => a.designation.localeCompare(b.designation));
        showToast(trad('Pièce modifiée'));
      } else {
        const { data, error } = await sb.from('parts_catalog')
          .insert({
            company_id: UI.companyId, reference: reference || null, designation, unit_price: prix,
            supplier_name: fournisseur || null, avg_lead_time_days: delai != null ? Math.round(delai) : null,
            ...champsOptionnels,
          })
          .select(COLONNES_PIECE)
          .single();
        if (error) throw error;
        UI.partsCatalog = [...(UI.partsCatalog || []), data].sort((a, b) => a.designation.localeCompare(b.designation));
        showToast(trad('Pièce ajoutée au catalogue'));
      }
      sortirDuModeEdition();
      renderApp();
    } catch (err) {
      message(msg, trad('Erreur :') + ' ' + (err.message || err), true);
      btn.disabled = false;
      if (boutonAjouterLabel) boutonAjouterLabel.textContent = pieceEnEdition ? trad('Enregistrer les modifications') : trad('Ajouter au catalogue');
    }
  });

  root.querySelector('#tco-catalogue-liste')?.addEventListener('click', async (e) => {
    const modifier = e.target.closest('[data-piece-modifier]');
    if (modifier) {
      const id = modifier.getAttribute('data-piece-modifier');
      const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(id));
      if (!piece) return;
      pieceEnEdition = id;
      if (champRef) champRef.value = piece.reference || '';
      if (champDesignation) champDesignation.value = piece.designation || '';
      if (champPrix) { champPrix.value = texteAvecSeparateurs(piece.unit_price); }
      if (champFournisseur) champFournisseur.value = piece.supplier_name || '';
      if (champDelai) champDelai.value = piece.avg_lead_time_days != null ? String(piece.avg_lead_time_days) : '';
      if (champConditionnement) champConditionnement.value = piece.packaging || '';
      if (champSeuil) champSeuil.value = piece.default_reorder_point != null ? texteAvecSeparateurs(piece.default_reorder_point) : '';
      if (titreForm) titreForm.textContent = trad('Modifier une pièce');
      if (boutonAjouterLabel) boutonAjouterLabel.textContent = trad('Enregistrer les modifications');
      if (boutonAnnuler) boutonAnnuler.hidden = false;
      champDesignation?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const bouton = e.target.closest('[data-piece-retirer]');
    if (!bouton) return;
    const id = bouton.getAttribute('data-piece-retirer');
    if (!window.confirm(trad('Retirer cette pièce du catalogue ?'))) return;
    bouton.disabled = true;
    try {
      const { error } = await sb.from('parts_catalog').delete().eq('id', id);
      if (error) throw error;
      UI.partsCatalog = (UI.partsCatalog || []).filter((p) => String(p.id) !== String(id));
      if (pieceEnEdition === id) sortirDuModeEdition();
      renderApp();
    } catch (err) {
      message(root.querySelector('#tco-catalogue-msg'), trad('Erreur :') + ' ' + (err.message || err), true);
      bouton.disabled = false;
    }
  });
}

VIEWS.tco = {
  fondBlanc: true,
  title: trad('Paramètres TCO & Coûts d\'exploitation'),
  subtitle: () => trad('Configurez les barèmes de calcul automatique du TCO (main-d\'œuvre, assurance, stockage) et enrichissez le catalogue de pièces pour pré-remplir instantanément vos fiches d\'entretien.'),
  render() {
    return `
      <div class="ui-page">
        ${tcoKpiGridHtml()}
        ${tcoActif() ? tcoClassementFlotteHtml() : ''}
        ${blocParametresTcoHtml()}
        ${blocSeuilsCategorieTcoHtml()}
        ${(SCHEMA.hasStock && planCouvreStock()) ? '' : blocCatalogueTcoHtml()}
      </div>`;
  },
  mount() {
    const root = document.getElementById('view-root');
    if (!root) return;
    const message = (el, texte, erreur) => {
      if (!el) return;
      el.textContent = texte;
      el.style.color = erreur ? 'var(--late)' : 'var(--ok)';
    };

    // ── Classement TCO du parc — chargé en asynchrone : un fetch en masse
    // sur toute la flotte (§1), jamais fait ailleurs sur cette page, jamais
    // refait au changement d'un filtre (tout se recalcule en mémoire à
    // partir des deux tableaux flotte-entière déjà chargés). Section
    // absente si tcoActif() est faux (voir render()).
    if (tcoActif()) {
      (async () => {
        const section = root.querySelector('#tco-classement-section');
        if (!section) return;
        const valueEl = section.querySelector('[data-chargement]');
        const corps = section.querySelector('#tco-classement-corps');
        const machineIds = (UI.machines || []).map((m) => m.id);
        const TCO_CLASSEMENT_PAGE_SIZE = 10;
        let flotte = null;
        let interventionsFlotte = [];
        let coutsFlotte = [];
        try {
          [interventionsFlotte, coutsFlotte] = await Promise.all([
            fetchToutesInterventionsFlotte(machineIds),
            fetchTousCoutsExploitationFlotte(machineIds),
          ]);
          const interventionsParMachine = grouperParMachine(interventionsFlotte);
          const coutsParMachine = grouperParMachine(coutsFlotte);
          flotte = calculerFlotteTco(UI.machines || [], interventionsParMachine, coutsParMachine);
        } catch (err) {
          if (valueEl) valueEl.textContent = trad('Erreur de chargement :') + ' ' + err.message;
          return;
        }
        if (!root.isConnected || !section.isConnected) return;
        if (!flotte) {
          if (valueEl) valueEl.textContent = trad('Aucune machine avec un prix d\'achat renseigné pour l\'instant — ajoute-le sur la fiche d\'une machine pour la voir apparaître ici.');
          return;
        }
        if (valueEl) valueEl.remove();

        // Moyenne actuelle de coût horaire par catégorie (reprise Stitch,
        // §5) — remplit les tags du bloc « Seuils cibles », rendu ailleurs
        // sur la page (root, pas section) au même montage. Mêmes données
        // que flotte.lignes, toujours lifetime (un seuil cible est une
        // référence stable, pas une valeur qui bouge avec le filtre
        // d'affichage) — jamais un second calcul, jamais un chiffre sans
        // machine réelle derrière.
        root.querySelectorAll('[data-seuil-moyenne-categorie]').forEach((tag) => {
          const valeurs = flotte.lignes
            .filter((l) => l.machine.category?.id === tag.dataset.seuilMoyenneCategorie && l.tco.coutParUnite != null)
            .map((l) => l.tco.coutParUnite);
          if (!valeurs.length) return;
          const moyenne = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
          tag.textContent = tR('Moy. actuelle {m}', { m: formatMontant(Math.round(moyenne)) });

          // Raccourcis de pré-remplissage — un point de départ chiffré sur
          // les VRAIES machines de la catégorie, pour quelqu'un qui ne sait
          // pas quel montant taper à la main (voir la carte d'astuce
          // ci-dessus). Réservé au gérant : si le champ est verrouillé pour
          // ce rôle, inutile de proposer un raccourci qui ne servirait à rien.
          const carte = tag.closest('[data-seuil-ligne]');
          const input = carte?.querySelector('[data-seuil-input]');
          const raccourcis = carte?.querySelector('[data-seuil-raccourcis-categorie]');
          if (!input || !raccourcis || input.disabled) return;
          const propositions = [
            { label: tR('= moyenne ({m})', { m: formatMontant(Math.round(moyenne)) }), valeur: moyenne },
            { label: trad('+10 % au-dessus'), valeur: moyenne * 1.1 },
          ];
          raccourcis.innerHTML = propositions.map((p, i) =>
            `<button type="button" class="ui-btn ui-btn-teinte" data-raccourci="${i}">${esc(p.label)}</button>`).join('');
          raccourcis.hidden = false;
          raccourcis.querySelectorAll('button[data-raccourci]').forEach((btn, i) => {
            btn.addEventListener('click', () => {
              input.value = texteAvecSeparateurs(Math.round(propositions[i].valeur));
              input.focus();
            });
          });
        });

        // Regroupement PAR MACHINE des tableaux flotte-entière — pour le
        // filtre de période (recalcul en mémoire, jamais un second fetch).
        const interventionsParMachineTout = grouperParMachine(interventionsFlotte);
        const coutsParMachineTout = grouperParMachine(coutsFlotte);
        // Catégories réellement présentes dans le classement (pas
        // UI.categories : un filtre sur une catégorie sans machine ici ne
        // servirait à rien — voir §5 pour la liste complète des seuils).
        const categoriesPresentes = [...new Set(flotte.lignes.map((l) => l.machine.category?.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));

        // Bornes de la fenêtre temporelle — calculées une fois par rendu,
        // jamais un fetch réseau. 'total' = aucune borne (comportement
        // identique à avant ce chantier).
        const borneDepuis = (cle) => {
          if (cle === '12m') { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); }
          if (cle === 'annee') return `${new Date().getFullYear()}-01-01`;
          return null;
        };
        const anneesFenetre = (cle) => {
          if (cle === '12m') return 1;
          if (cle === 'annee') {
            const debut = new Date(new Date().getFullYear(), 0, 1).getTime();
            return Math.max((Date.now() - debut) / (365.25 * 24 * 3600 * 1000), 1 / 12);
          }
          return null;
        };

        let periode = 'total';
        let categorie = 'toutes';
        let tri = 'ratio';
        let limite = TCO_CLASSEMENT_PAGE_SIZE;
        // Assigné après l'insertAdjacentHTML plus bas, qui crée l'élément —
        // rendreDynamique() n'est appelée qu'ensuite, la fermeture le
        // capture correctement au moment de l'appel.
        let dynamique;

        const rendreDynamique = () => {
          const borne = borneDepuis(periode);
          const annees = anneesFenetre(periode);
          const interventionsFlat = borne ? interventionsFlotte.filter((it) => it.performed_at >= borne) : interventionsFlotte;
          const coutsFlat = borne ? coutsFlotte.filter((c) => c.incurred_at >= borne) : coutsFlotte;
          const repartition = repartitionFlotteTco(interventionsFlat, coutsFlat);

          let lignes = flotte.lignes.map((ligne) => {
            const interventionsMachine = interventionsParMachineTout.get(ligne.machine.id) || [];
            const coutsMachine = coutsParMachineTout.get(ligne.machine.id) || [];
            const interventionsPeriode = borne ? interventionsMachine.filter((it) => it.performed_at >= borne) : interventionsMachine;
            const coutsPeriode = borne ? coutsMachine.filter((c) => c.incurred_at >= borne) : coutsMachine;
            const ventilation = ventilationCoutsInterventions(interventionsPeriode);
            const periodeInfo = borne ? {
              depenses: depensesSurPeriode(interventionsPeriode, coutsPeriode),
              decision: ratioDecisionTcoSurPeriode(ligne.machine, interventionsPeriode, annees),
            } : null;
            return { ...ligne, ventilation, periodeInfo };
          });

          if (categorie !== 'toutes') lignes = lignes.filter((l) => (l.machine.category?.name || '') === categorie);

          const cleTri = (l) => {
            if (tri === 'coutHoraire') return l.tco.coutParUnite ?? -Infinity;
            if (tri === 'tcoTotal') return l.tco.total ?? -Infinity;
            if (tri === 'heures') return machineCounter(l.machine) ?? -Infinity;
            return l.periodeInfo?.decision?.ratio ?? l.decision?.ratio ?? -Infinity;
          };
          lignes = lignes.slice().sort((a, b) => cleTri(b) - cleTri(a));

          const lignesAffichees = lignes.slice(0, limite);
          const reste = lignes.length - lignesAffichees.length;

          const centreDonut = repartition ? `
            <span class="tco-donut-centre-eyebrow">${trad('Dépenses parc')}</span>
            <span class="tco-donut-centre-valeur">${montantAbrege(repartition.total)}</span>
            <span class="tco-donut-centre-note">${trad('100% Déclaré')}</span>
          ` : '';

          dynamique.innerHTML = `
            ${repartition ? `
            <div class="ui-tuile tco-donut-bloc">
              <div class="tco-donut-bloc-tete">
                <div class="tco-donut-bloc-titre">
                  <h3>${trad('Répartition des charges du parc')}</h3>
                  <p>${trad('Ventilation par nature de dépense enregistrée sur la flotte')}</p>
                </div>
                <span class="ui-tag">${tR('{montant} cumulés', { montant: formatMontant(repartition.total) })}</span>
              </div>
              <div class="tco-donut-corps">
                ${donutTcoSvgHtml(repartition, 128, centreDonut)}
                <div class="tco-donut-details">
                  <div class="tco-donut-barre">
                    <span style="width:${repartition.pctPieces}%;background:var(--bleu-roi);"></span>
                    <span style="width:${repartition.pctMainOeuvre}%;background:var(--ok);"></span>
                    <span style="width:${repartition.pctFixes}%;background:var(--late);"></span>
                  </div>
                  <div class="tco-donut-legende-grille">
                    <div class="tco-donut-legende-carte">
                      <span class="gauche"><span class="rond" style="background:var(--bleu-roi);"></span>${trad('Pièces')}</span>
                      <span class="badge" style="color:var(--bleu-roi);background:rgba(35,111,224,.1);">${Math.round(repartition.pctPieces)}%</span>
                    </div>
                    <div class="tco-donut-legende-carte">
                      <span class="gauche"><span class="rond" style="background:var(--ok);"></span>${trad('MO Atelier')}</span>
                      <span class="droite"><span class="heures">${Math.round(repartition.heures)} h</span><span class="badge" style="color:var(--ok);background:var(--ok-bg);">${Math.round(repartition.pctMainOeuvre)}%</span></span>
                    </div>
                    <div class="tco-donut-legende-carte">
                      <span class="gauche"><span class="rond" style="background:var(--late);"></span>${trad('Frais Fixes')}</span>
                      <span class="badge" style="color:var(--late);background:var(--late-bg);">${Math.round(repartition.pctFixes)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>` : `<div class="ui-aide">${trad('Aucune dépense enregistrée sur cette période.')}</div>`}
            ${lignes.length ? `
            <div class="ui-liste">${lignesAffichees.map(({ machine, tco, decision, ventilation, periodeInfo }) => ligneClassementTcoHtml(machine, tco, decision, ventilation, periodeInfo)).join('')}</div>
            ${reste > 0 ? `<div class="ui-barre is-centre"><button type="button" class="ui-btn ui-btn-teinte" id="tco-classement-plus">${tR('Afficher {n} machine(s) de plus', { n: Math.min(reste, TCO_CLASSEMENT_PAGE_SIZE) })}</button></div>` : ''}
            ` : `<div class="ui-aide">${trad('Aucune machine dans cette catégorie.')}</div>`}
          `;
          wireAlertRows(dynamique);
          dynamique.querySelectorAll('.ui-ligne[data-machine]').forEach((carte) => {
            carte.setAttribute('tabindex', '0');
            carte.setAttribute('role', 'button');
            carte.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); carte.click(); } });
          });
          dynamique.querySelector('#tco-classement-plus')?.addEventListener('click', () => {
            limite += TCO_CLASSEMENT_PAGE_SIZE;
            rendreDynamique();
          });
        };

        // Sous-ligne du KPI 1 : reformule le MÊME ratio moyen déjà calculé
        // (flotte.ratioMoyen), jamais un jugement inventé séparé — le
        // mockup affiche un texte qualitatif fixe, ici c'est un vrai signal.
        // Factorisée (tendanceRatioMoyenFlotte) : réutilisée telle quelle par
        // le widget TCO du tableau de bord, jamais deux libellés divergents.
        const tendanceRatio = tendanceRatioMoyenFlotte(flotte);

        const classeEtatUi = (e) => ({ ok: 'is-ok', soon: 'is-bientot', late: 'is-retard' }[e] || '');

        corps.insertAdjacentHTML('beforeend', `
          <div class="ui-grille is-3">
            <div class="ui-tuile">
              <span class="ui-tuile-etiquette">${trad('TCO Moyen Annualisé')}</span>
              <span class="ui-tuile-valeur">${formatMontant(flotte.coutAnnuelMoyen)}</span>
              <span class="ui-tuile-note"><span class="ui-point ${classeEtatUi(tendanceRatio.etat)}"></span>${tendanceRatio.label}</span>
            </div>
            <div class="ui-tuile">
              <span class="ui-tuile-etiquette">${trad('Machines Suivies')}</span>
              <span class="ui-tuile-valeur">${flotte.lignes.length}<small>${tR('/ {n} machines totales', { n: (UI.machines || []).length })}</small></span>
              <span class="ui-tuile-note">${tR('{n} actif(s) calculé(s) avec données d\'achat', { n: flotte.lignes.length })}</span>
            </div>
            <div class="ui-tuile ${flotte.nbAlertes ? 'is-retard' : 'is-ok'}">
              <span class="ui-tuile-etiquette">${trad('En Alerte')}</span>
              <span class="ui-tuile-valeur">${flotte.nbAlertes}</span>
              <span class="ui-tuile-note">${flotte.nbAlertes ? tR('{n} machine(s) dépassent leur seuil', { n: flotte.nbAlertes }) : trad('Sous les seuils opérationnels')}</span>
            </div>
          </div>
          <div class="ui-barre">
            <div class="ui-segment" id="tco-filtre-periode" role="group" aria-label="${esc(trad('Période'))}">
              <button type="button" class="is-actif" data-periode="total">${trad('Depuis mise en service')}</button>
              <button type="button" data-periode="12m">${trad('12 derniers mois')}</button>
              <button type="button" data-periode="annee">${trad('Année en cours')}</button>
            </div>
            ${categoriesPresentes.length ? `
            <select id="tco-filtre-categorie" class="ui-selecteur">
              <option value="toutes">${trad('Toutes catégories')}</option>
              ${categoriesPresentes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>` : ''}
            <select id="tco-filtre-tri" class="ui-selecteur">
              <option value="ratio">${trad('Ratio de dépréciation')}</option>
              <option value="tcoTotal">${trad('Coût total décroissant')}</option>
              <option value="coutHoraire">${trad('Coût horaire décroissant')}</option>
              <option value="heures">${trad('Heures moteur')}</option>
            </select>
          </div>
          <div class="ui-section-corps" id="tco-classement-dynamique"></div>
          ${flotte.exclues.length ? `
          <div class="ui-encadre is-attention">
            ${picto('info')}
            <p><strong>${tR('{n} machine(s) sans prix d\'achat', { n: flotte.exclues.length })}</strong>, ${trad('non incluses dans ce classement analytique.')}</p>
            <button type="button" class="ui-btn ui-btn-teinte" data-nav="machines"><span>${trad('Régulariser les prix')}</span></button>
          </div>` : ''}
          <div><button type="button" class="ui-btn ui-btn-pastille" id="tco-export-classement">${picto('export')}<span>${trad('Exporter en CSV')}</span></button></div>
        `);
        dynamique = section.querySelector('#tco-classement-dynamique');

        section.querySelectorAll('[data-periode]').forEach((btn) => {
          btn.addEventListener('click', () => {
            periode = btn.dataset.periode;
            limite = TCO_CLASSEMENT_PAGE_SIZE;
            section.querySelectorAll('[data-periode]').forEach((b) => b.classList.toggle('is-actif', b === btn));
            rendreDynamique();
          });
        });
        habillerSelect(section.querySelector('#tco-filtre-categorie'), trad('Catégorie'));
        section.querySelector('#tco-filtre-categorie')?.addEventListener('change', (e) => {
          categorie = e.currentTarget.value;
          limite = TCO_CLASSEMENT_PAGE_SIZE;
          rendreDynamique();
        });
        habillerSelect(section.querySelector('#tco-filtre-tri'), trad('Trier par'));
        section.querySelector('#tco-filtre-tri')?.addEventListener('change', (e) => {
          tri = e.currentTarget.value;
          limite = TCO_CLASSEMENT_PAGE_SIZE;
          rendreDynamique();
        });
        section.querySelectorAll('[data-nav]').forEach((btn) => btn.addEventListener('click', () => goTo(btn.dataset.nav)));
        section.querySelector('#tco-export-classement')?.addEventListener('click', () => exporterClassementTcoCsv(flotte));

        rendreDynamique();

        // Rapport TCO (PDF) : `flotte`/`interventionsFlotte`/`coutsFlotte`
        // sont déjà en mémoire dans cette même fermeture — jamais un second
        // fetch flotte-entière. Le bouton reste désactivé si ce point n'est
        // jamais atteint (échec de fetch ou !flotte, les deux `return` plus
        // haut) : il n'est activé qu'ICI, une fois les données réellement
        // disponibles.
        const boutonRapport = root.querySelector('#tco-rapport-pdf');
        if (boutonRapport) {
          boutonRapport.disabled = false;
          boutonRapport.title = '';
          boutonRapport.addEventListener('click', () => {
            // `periode` relue AU CLIC (variable mutable de cette fermeture) :
            // le rapport suit le filtre affiché à cet instant, jamais celui
            // qui était actif au premier chargement de la page.
            const borneRapport = borneDepuis(periode);
            const anneesRapport = anneesFenetre(periode);
            const donneesRapport = assemblerDonneesRapportTco({
              flotte, interventionsFlotte, coutsFlotte, periode, borne: borneRapport, annees: anneesRapport,
            });
            ouvrirRapportTcoModal({ donnees: donneesRapport });
          });
        }
      })();
    }

    // La devise ne se choisit plus ici (elle est dans Mon compte, avec le pays) : ce bloc la rappelle seulement.
    root.querySelector('#tco-devise-lien')?.addEventListener('click', () => goTo('account'));

    // Séparateurs de milliers : ces champs sont passés en type="text" (un
    // type="number" refuse tout espace) — voir activerSeparateurMilliers.
    // #tco-piece-prix/#tco-piece-seuil ne sont PAS ici : câblés par
    // cablerCatalogueTco() ci-dessous, seulement quand le catalogue est
    // effectivement rendu sur CETTE page (sociétés non-Enterprise).
    ['#tco-taux-horaire', '#tco-assurance', '#tco-stockage'].forEach((sel) => {
      activerSeparateurMilliers(root.querySelector(sel));
    });
    root.querySelectorAll('[data-seuil-input]').forEach((input) => activerSeparateurMilliers(input));
    root.querySelectorAll('[data-seuil-amort]').forEach((btn) => btn.addEventListener('click', () => {
      const champ = btn.closest('[data-seuil-ligne]')?.querySelector('[data-seuil-input]');
      if (!champ || champ.disabled) return;
      champ.value = texteAvecSeparateurs(btn.dataset.seuilAmort);
      champ.focus();
    }));

    // Catalogue de pièces : déplacé dans Stocks & SAV pour une société
    // Enterprise (voir render() ci-dessus) — reste ici, câblé normalement,
    // pour toutes les autres. Jamais les deux à la fois.
    if (!(SCHEMA.hasStock && planCouvreStock())) cablerCatalogueTco(root);

    // Ce bouton n'enregistre QUE les trois barèmes, dans la devise déjà en vigueur : changer de devise convertit tous les
    // montants et se fait dans Mon compte (convert_my_tco_currency), jamais en même temps qu'une frappe ici.
    root.querySelector('#tco-save-parametres')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const label = btn.querySelector('span');
      const msg = root.querySelector('#tco-parametres-msg');
      const devise = (UI.company && UI.company.currency) || 'EUR';

            const taux = nombreDepuisTexte(root.querySelector('#tco-taux-horaire').value);
      const assurance = nombreDepuisTexte(root.querySelector('#tco-assurance').value);
      const stockage = nombreDepuisTexte(root.querySelector('#tco-stockage').value);
      btn.disabled = true;
      if (label) label.textContent = trad('Enregistrement…');
      try {
        const { error } = await sb.rpc('update_my_tco_settings', {
          p_labor_hourly_rate: taux,
          p_default_insurance_yearly: assurance,
          p_default_storage_yearly: stockage,
          p_currency: devise,
        });
        if (error) throw error;
        UI.company.labor_hourly_rate = taux;
        UI.company.default_insurance_yearly = assurance;
        UI.company.default_storage_yearly = stockage;
        UI.company.currency = devise;
        showToast(trad('Paramètres TCO enregistrés'));
        message(msg, trad('Enregistré.'), false);
        renderApp();
      } catch (err) {
        message(msg, trad('Erreur :') + ' ' + (err.message || err), true);
        btn.disabled = false;
        if (label) label.textContent = trad('Enregistrer les paramètres');
      }
    });

    // Seuils cibles par catégorie (phase 3, §5) — écrit directement sur
    // machine_categories (même motif que sa création, plus haut dans le
    // fichier : pas de RPC dédiée, la policy UPDATE de la table suffit),
    // un update par catégorie MODIFIÉE seulement (pas toutes, pour ne pas
    // écraser une valeur qu'un autre onglet aurait changée entre-temps).
    root.querySelector('#tco-save-seuils')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const label = btn.querySelector('span');
      const msg = root.querySelector('#tco-seuils-msg');
      const lignes = [...root.querySelectorAll('[data-seuil-ligne]')];
      const modifiees = lignes.map((ligne) => {
        const id = ligne.dataset.categorieId;
        const valeur = nombreDepuisTexte(ligne.querySelector('[data-seuil-input]').value);
        const categorie = (UI.categories || []).find((c) => c.id === id);
        return { id, valeur, changed: categorie && categorie.target_hourly_cost !== valeur };
      }).filter((l) => l.changed);
      if (!modifiees.length) { message(msg, trad('Aucun changement.'), false); return; }
      btn.disabled = true;
      if (label) label.textContent = trad('Enregistrement…');
      try {
        const resultats = await Promise.all(modifiees.map(({ id, valeur }) =>
          sb.from('machine_categories').update({ target_hourly_cost: valeur }).eq('id', id)));
        const erreur = resultats.find((r) => r.error);
        if (erreur) throw erreur.error;
        modifiees.forEach(({ id, valeur }) => {
          const categorie = (UI.categories || []).find((c) => c.id === id);
          if (categorie) categorie.target_hourly_cost = valeur;
          // UI.machines[*].category est une copie séparée (jointure Supabase) :
          // la mettre à jour aussi, sinon le badge d'écart du classement TCO
          // resterait sur l'ancien seuil jusqu'au prochain rechargement complet.
          (UI.machines || []).forEach((m) => { if (m.category && m.category.id === id) m.category.target_hourly_cost = valeur; });
        });
        showToast(trad('Seuils enregistrés'));
        message(msg, trad('Enregistré.'), false);
        renderApp();
      } catch (err) {
        message(msg, trad('Erreur :') + ' ' + (err.message || err), true);
        btn.disabled = false;
        if (label) label.textContent = trad('Enregistrer les seuils');
      }
    });

  },
};

// Sous-bloc teinté « e-mail de notification des rappels », reposé dans la
// carte « Contact & Alertes » : reprend TEL QUEL le réglage de l'écran
// « Rappels » (mêmes id, donc wireReglagesRappelsEmail() suffit aux deux).
function sousBlocEmailRappelsHtml() {
  const dispo = SCHEMA.hasReminders !== false;
  const bloque = dispo ? '' : ' disabled';
  const actif = rappelsEmailActifs();
  return `
    <div class="ui-groupe">
      <div class="ui-groupe-tete">
        ${picto('mail')}
        <span class="ui-groupe-titre">${trad('E-mail de notification des rappels')}</span>
        <span class="ui-statut ${actif ? 'is-ok' : ''}">${actif ? trad('Canal actif') : trad('Canal inactif')}</span>
      </div>
      <input id="rap-email" class="ui-champ" type="email" inputmode="email" autocomplete="email" value="${esc(adresseRappels())}"${bloque}>
      <label class="check-row" for="rap-par-email"><input type="checkbox" id="rap-par-email"${rappelsEmailCoches() ? ' checked' : ''}${bloque}> ${trad('Recevoir les rappels par e-mail')}</label>
      <div class="ui-aide" id="rap-msg" role="status" aria-live="polite"></div>
      <div><button type="button" class="ui-btn ui-btn-pastille" id="rap-save"${bloque}>${trad('Enregistrer les préférences e-mail')}</button></div>
    </div>`;
}

// Même patron que sousBlocEmailRappelsHtml juste au-dessus : reprend
// blocPushHtml (interrupteur personnel) tel quel dans « Mon compte », mêmes
// id, donc wirePush() suffit aux deux points de montage.
function sousBlocPushHtml() {
  const actif = !!monTokenPushConnu();
  return `
    <div class="ui-groupe">
      <div class="ui-groupe-tete">
        ${picto('cloche')}
        <span class="ui-groupe-titre">${trad('Notification push sur ce téléphone')}</span>
        <span class="ui-statut ${actif ? 'is-ok' : ''}">${actif ? trad('Canal actif') : trad('Canal inactif')}</span>
      </div>
      ${blocPushHtml()}
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════
// STOCK & SAV — Phase 1 « Fondations » (cahier des charges fourni par
// l'utilisateur : voir le plan de session pour le détail des décisions —
// palier Enterprise strict, gérant+mécanicien pour les mouvements du
// quotidien, gérant seul pour les magasins/l'ajustement/la valorisation).
// Aucun mockup Stitch fourni pour ce module : réutilise largement le
// langage visuel déjà posé pour Coûts & TCO (.tco-kpi-grid, .card/
// .tco-card-tete, .tco-parts-liste/.tco-part-ligne, .tco-quick-add,
// .tco-recherche, .tco-btn-outil) plutôt que d'inventer un design.
// Toute écriture réelle (mouvement) passe PAR LA RPC
// enregistrer_mouvement_stock — jamais un insert/update direct sur
// stock_items/stock_movements côté client, RLS le refuserait de toute
// façon (voir la migration : aucune policy insert/update/delete pour
// authenticated sur ces deux tables).
// ════════════════════════════════════════════════════════════════════════

function nomMagasin(id) {
  const w = (UI.warehouses || []).find((x) => String(x.id) === String(id));
  return w ? w.name : trad('Magasin supprimé');
}
function designationPiece(id) {
  const p = (UI.partsCatalog || []).find((x) => String(x.id) === String(id));
  return p ? p.designation : trad('Référence supprimée');
}
function nomKit(id) {
  const k = (UI.maintenanceKits || []).find((x) => String(x.id) === String(id));
  return k ? k.name : trad('Kit supprimé');
}
function lignesKit(kitId) {
  return (UI.maintenanceKitLines || []).filter((l) => String(l.kit_id) === String(kitId));
}
function badgeTypeMouvement(type) {
  const map = {
    entree: { texte: trad('Entrée'), classe: 'ok' },
    sortie: { texte: trad('Sortie'), classe: 'alert' },
    transfert: { texte: trad('Transfert'), classe: 'soon' },
    ajustement: { texte: trad('Ajustement'), classe: 'neutral' },
  };
  return map[type] || { texte: type, classe: 'neutral' };
}
// stock_movements.performed_at est un timestamptz (contrairement à
// interventions.performed_at, une simple date) — un journal de mouvements a
// besoin de l'heure, pas seulement du jour, pour distinguer deux mouvements
// le même jour. formatShortDate*/formatLongDate (qui découpent une chaîne
// "AAAA-MM-JJ") ne conviennent donc pas ici ; réutilise moisCourt() pour
// rester cohérent avec l'i18n existante plutôt que toLocaleString (qui
// suivrait la locale du NAVIGATEUR, pas la langue choisie dans l'app).
function formatDateHeureMouvement(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const heure = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${moisCourt(d.getMonth())} ${d.getFullYear()} · ${heure}`;
}

// Bandeau eyebrow + bouton d'aide — reprise Stitch, même patron que
// tcoEyebrowToolbarHtml(). Le bouton « Principe de valorisation PUMP »
// ouvre une explication RÉELLE de la méthode déjà implémentée par la RPC
// enregistrer_mouvement_stock (voir le plan de session), jamais un lien
// mort — seul le paragraphe « Analyse » d'un mockup fabriquerait un texte
// sans réalité derrière ; une explication de méthodologie déjà en place
// n'en est pas une.
function stockEyebrowToolbarHtml() {
  return `
    <div class="ui-barre is-droite">
      <button type="button" class="ui-btn ui-btn-pastille" id="stock-pump-info">${picto('info')}<span>${trad('Principe de valorisation PUMP')}</span></button>
    </div>`;
}
function ouvrirExplicationPump() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="pump-titre">
      <h2 id="pump-titre">${trad('Principe de valorisation PUMP')}</h2>
      <p class="sub">${trad('Prix Unitaire Moyen Pondéré — la méthode utilisée par ce module pour donner une valeur réelle à ton stock.')}</p>
      <div class="ui-aide" style="margin-top:10px;line-height:1.6;">
        <p>${trad('À chaque entrée de stock, le coût moyen d\'une référence est recalculé en pondérant l\'ancien stock par son ancien coût, et la quantité entrante par son coût d\'achat réel :')}</p>
        <p style="margin-top:8px;font-family:'Space Grotesk',monospace;background:var(--surface);padding:10px 12px;border-radius:var(--r-md);">${trad('nouveau coût = (stock × ancien coût + entrée × prix d\'achat) / (stock + entrée)')}</p>
        <p style="margin-top:8px;">${trad('Une sortie ou un transfert ne modifie jamais ce coût moyen — seule une nouvelle entrée le fait évoluer. C\'est ce coût qui sert à calculer la valeur totale du stock (quantité × coût moyen) affichée en haut de cette page.')}</p>
      </div>
      <div class="modal-actions">
        <button type="button" class="primary" id="pump-fermer">${trad('Compris')}</button>
      </div>
    </div>`;
  overlay.querySelector('#pump-fermer').addEventListener('click', () => overlay.remove());
}

// KPI : valeur totale (gérant seulement — même trust model que
// interventions.parts_cost, jamais de privilège de colonne côté RLS, voir
// le plan §2), alertes de seuil bas (UI.stockCounts, calculé au boot ET
// après chaque mouvement), mouvements du mois (rempli en asynchrone par
// VIEWS.stock.mount(), pas au boot — voir le commentaire sur la section
// Mouvements plus bas).
function stockKpiGridHtml() {
  const gerant = peutGererParametresStock();
  const items = UI.stockItems || [];
  const valeurTotale = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.pump_unit_cost) || 0), 0);
  const nbAlertes = UI.stockCounts?.seuilBas || 0;
  const nbMagasins = (UI.warehouses || []).filter((w) => w.active !== false).length;
  return `
    <section class="ui-section">
      ${stockEyebrowToolbarHtml()}
      <div class="ui-grille is-3">
        <div class="ui-tuile">
          <span class="ui-tuile-etiquette">${trad('Valeur totale du stock')}</span>
          <span class="ui-tuile-valeur">${gerant ? `${texteAvecSeparateurs(valeurTotale)}<small>${esc(deviseCourte())}</small>` : '—'}</span>
          <span class="ui-tuile-note">${gerant ? trad('Valorisation PUMP, tous magasins') : trad('Réservé au gérant')}</span>
        </div>
        <div class="ui-tuile ${nbAlertes ? 'is-retard' : 'is-ok'}">
          <span class="ui-tuile-etiquette">${trad('Références en alerte')}</span>
          <span class="ui-tuile-valeur">${nbAlertes}</span>
          <span class="ui-tuile-note">${nbAlertes ? trad('Sous le seuil de sécurité') : trad('Aucune alerte')}</span>
        </div>
        <div class="ui-tuile">
          <span class="ui-tuile-etiquette">${trad('Mouvements ce mois-ci')}</span>
          <span class="ui-tuile-valeur" id="stock-kpi-mouvements">…</span>
          <span class="ui-tuile-note">${tR('{n} magasin(s) actif(s)', { n: nbMagasins })}</span>
        </div>
      </div>
    </section>`;
}

// ── Magasins ── CRUD réservé au gérant (peutGererParametresStock), même
// patron que le catalogue de pièces TCO (même formulaire pour ajout ET
// édition, ligne SERVEUR fusionnée dans le cache local, jamais la valeur
// locale tapée — voir blocCatalogueTcoHtml/ses handlers). Le mécanicien
// voit la liste (il en a besoin pour choisir un magasin dans un mouvement)
// mais sans les actions de gestion.
function ligneMagasinHtml(w) {
  const gerant = peutGererParametresStock();
  return `
    <div class="ui-ligne is-deux" data-magasin-id="${esc(w.id)}">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone is-ambre">${picto(w.kind === 'mobile' ? 'vehicule' : 'batiment')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(w.name)}${w.active === false ? `<span class="ui-tag">${trad('Inactif')}</span>` : ''}</span>
          <span class="ui-ligne-sous">${w.kind === 'mobile' ? trad('Magasin mobile') : trad('Magasin central')}${w.note ? ' · ' + esc(w.note) : ''}</span>
        </div>
      </div>
      ${gerant ? `
      <div class="ui-ligne-action">
        <button type="button" class="ui-btn ui-btn-icone" data-magasin-modifier="${esc(w.id)}" title="${esc(trad('Modifier'))}" aria-label="${esc(tR('Modifier {nom}', { nom: w.name }))}">${picto('crayon')}</button>
        <button type="button" class="ui-btn ui-btn-icone is-danger" data-magasin-retirer="${esc(w.id)}" title="${esc(trad('Supprimer'))}" aria-label="${esc(tR('Supprimer {nom}', { nom: w.name }))}">${picto('corbeille')}</button>
      </div>` : ''}
    </div>`;
}
function blocMagasinsStockHtml() {
  const magasins = UI.warehouses || [];
  const gerant = peutGererParametresStock();
  const liste = magasins.length ? magasins.map(ligneMagasinHtml).join('') : `<div class="ui-aide">${trad('Aucun magasin pour l\'instant — crée le magasin central pour commencer.')}</div>`;
  return `
    <section class="ui-section" id="stock-magasins-section">
      ${teteSectionKit('batiment', trad('Magasins'), trad('Magasin central ou magasin mobile (fourgon d\'un technicien) — chaque référence du catalogue peut avoir un stock différent dans chacun.'),
        `<span class="ui-tag">${tR('{n} magasin(s)', { n: magasins.length })}</span>`)}
      <div class="ui-section-corps">
        ${gerant ? '' : `<div class="ui-aide">${trad('Réservé au gérant.')}</div>`}
        <div class="ui-liste" id="stock-magasins-liste">${liste}</div>
        ${gerant ? `
        <div class="ui-groupe">
          <div class="ui-groupe-tete">${picto('plusCercle')}<span class="ui-groupe-titre" id="stock-magasin-form-titre">${trad('Ajouter un magasin')}</span></div>
          <div class="ui-champ-groupe">
            <label class="sr-only" for="stock-magasin-nom">${trad('Nom')}</label>
            <input id="stock-magasin-nom" class="ui-champ" required placeholder="${trad('Nom (ex : Magasin central, Fourgon Paul…)')}">
          </div>
          <div class="ui-grille">
            <div class="ui-champ-groupe">
              <label class="sr-only" for="stock-magasin-kind">${trad('Type')}</label>
              <div class="ui-select-wrap">
                <select id="stock-magasin-kind" class="ui-champ">
                  <option value="central">${trad('Magasin central')}</option>
                  <option value="mobile">${trad('Magasin mobile (fourgon)')}</option>
                </select>
                ${picto('chevronBas')}
              </div>
            </div>
            <div class="ui-champ-groupe">
              <label class="sr-only" for="stock-magasin-note">${trad('Note')}</label>
              <input id="stock-magasin-note" class="ui-champ" placeholder="${trad('Note (optionnel)')}">
            </div>
          </div>
          <div><button type="button" class="ui-btn ui-btn-plein" id="stock-magasin-ajouter">${picto('plusCercle')}<span>${trad('Ajouter le magasin')}</span></button></div>
          <div><button type="button" class="ui-btn ui-btn-pastille" id="stock-magasin-annuler" hidden>${trad('Annuler la modification')}</button></div>
          <div class="ui-aide" id="stock-magasin-msg" role="status" aria-live="polite"></div>
        </div>` : ''}
      </div>
    </section>`;
}

// ── Inventaire ── lecture pure de UI.stockItems (déjà chargé au boot,
// jamais un second fetch flotte-entière ici) — filtre magasin + recherche
// en mémoire, comme le classement TCO (rendreDynamique). Quantité visible
// à tous ; coût PUMP/valeur réservés au gérant (peutGererParametresStock).
function ligneInventaireStockHtml(it) {
  const gerant = peutGererParametresStock();
  const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(it.part_id));
  const seuil = it.reorder_point ?? piece?.default_reorder_point ?? null;
  const enAlerte = seuil != null && Number(it.quantity) <= Number(seuil);
  return `
    <div class="ui-ligne is-deux${enAlerte ? ' is-retard' : ''}">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone">${picto('boite')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(piece ? piece.designation : designationPiece(it.part_id))}${piece?.packaging ? `<span class="ui-tag">${esc(piece.packaging)}</span>` : ''}${enAlerte ? `<span class="ui-statut is-retard">${trad('Seuil bas')}</span>` : ''}</span>
          <span class="ui-ligne-sous">${esc(nomMagasin(it.warehouse_id))}${piece?.reference ? ' · ' + esc(piece.reference) : ''}</span>
        </div>
      </div>
      <div class="ui-ligne-action">
        <div class="ui-chiffre is-droite">
          <span class="ui-chiffre-valeur">${texteAvecSeparateurs(it.quantity)}</span>
          ${gerant ? `<span class="ui-ligne-sous">${texteAvecSeparateurs(Number(it.quantity) * Number(it.pump_unit_cost))} ${esc(deviseCourte())}</span>` : ''}
        </div>
      </div>
    </div>`;
}
function blocInventaireStockHtml() {
  const magasins = UI.warehouses || [];
  return `
    <section class="ui-section" id="stock-inventaire-section">
      ${teteSectionKit('boite', trad('Inventaire'), trad('Quantités physiques en stock par référence et valorisation unitaire'),
        `<span class="ui-tag" id="stock-inventaire-badge"></span><button type="button" class="ui-btn ui-btn-pastille" id="stock-inventaire-export">${picto('export')}<span>${trad('Exporter en CSV')}</span></button>`)}
      <div class="ui-section-corps">
        <div class="ui-barre">
          <input id="stock-inventaire-filtre" class="ui-champ" placeholder="${trad('Rechercher par référence, désignation, magasin…')}">
          <div class="ui-select-wrap">
            <select id="stock-inventaire-magasin" class="ui-champ">
              <option value="">${trad('Tous les magasins')}</option>
              ${magasins.map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}
            </select>
            ${picto('chevronBas')}
          </div>
        </div>
        <div class="ui-liste is-defilant" id="stock-inventaire-liste"></div>
        <div class="ui-aide" id="stock-inventaire-vide"></div>
      </div>
    </section>`;
}

// ── Mouvements ── journal append-only, jamais chargé au boot (un
// historique peut grossir sans borne — voir VIEWS.stock.mount()) : chargé
// en asynchrone au montage, comme le classement TCO. Bouton « Nouveau
// mouvement » réservé à peutGererMouvementsStock() (gérant+mécanicien).
function ligneMouvementStockHtml(m) {
  const badge = badgeTypeMouvement(m.type);
  const classeStatut = { ok: 'is-ok', alert: 'is-retard', soon: 'is-bientot' }[badge.classe] || '';
  const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(m.part_id));
  const lieu = m.type === 'transfert'
    ? `${nomMagasin(m.warehouse_id)} → ${nomMagasin(m.destination_warehouse_id)}`
    : nomMagasin(m.warehouse_id);
  const negatif = m.type === 'sortie' || (m.type === 'ajustement' && Number(m.quantity) < 0);
  return `
    <div class="ui-ligne is-deux">
      <div class="ui-ligne-id">
        <span class="ui-statut ${classeStatut}">${badge.texte}</span>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(piece ? piece.designation : designationPiece(m.part_id))}${piece?.packaging ? `<span class="ui-tag">${esc(piece.packaging)}</span>` : ''}</span>
          <span class="ui-ligne-sous">${esc(lieu)} · ${formatDateHeureMouvement(m.performed_at)}${m.reason ? ' · ' + esc(m.reason) : ''}</span>
        </div>
      </div>
      <div class="ui-ligne-action"><span class="ui-chiffre-valeur ${classeStatut}">${negatif ? '−' : '+'}${texteAvecSeparateurs(Math.abs(Number(m.quantity)))}</span></div>
    </div>`;
}
function blocMouvementsStockHtml() {
  const peut = peutGererMouvementsStock();
  return `
    <section class="ui-section" id="stock-mouvements-section">
      ${teteSectionKit('calendrier', trad('Mouvements'), trad('Entrées, sorties, transferts et ajustements'),
        peut ? `<button type="button" class="ui-btn ui-btn-pastille" id="stock-mouvements-importer">${picto('televerser')}<span>${trad('Importer un CSV')}</span></button><button type="button" class="ui-btn ui-btn-pastille" id="stock-mouvements-nouveau">${picto('plusCercle')}<span>${trad('Nouveau mouvement')}</span></button>` : '')}
      <div class="ui-section-corps">
        <div class="ui-liste is-defilant" id="stock-mouvements-liste"><div class="ui-aide">${trad('Chargement…')}</div></div>
        <div class="ui-barre is-centre"><button type="button" class="ui-btn ui-btn-teinte" id="stock-mouvements-plus" hidden>${trad('Voir plus')}</button></div>
      </div>
    </section>`;
}

// ── Kits d'entretien ── bundles nommés et réutilisables de pièces +
// quantités, reliables à une étape de plan d'entretien (voir openPlanView /
// ouvrirChoixKitTache). CRUD réservé au gérant (peutGererParametresStock),
// même palier que la gestion des magasins.
function ligneKitHtml(kit) {
  const gerant = peutGererParametresStock();
  const nbLignes = lignesKit(kit.id).length;
  return `
    <div class="ui-ligne is-deux" data-kit-id="${esc(kit.id)}">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone is-ambre">${picto('mallette')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(kit.name)}${kit.active === false ? `<span class="ui-tag">${trad('Inactif')}</span>` : ''}</span>
          <span class="ui-ligne-sous">${tR('{n} pièce(s)', { n: nbLignes })}${kit.note ? ' · ' + esc(kit.note) : ''}</span>
        </div>
      </div>
      ${gerant ? `
      <div class="ui-ligne-action">
        <button type="button" class="ui-btn ui-btn-icone" data-kit-modifier="${esc(kit.id)}" title="${esc(trad('Modifier'))}">${picto('crayon')}</button>
        <button type="button" class="ui-btn ui-btn-icone is-danger" data-kit-retirer="${esc(kit.id)}" title="${esc(trad('Supprimer'))}">${picto('corbeille')}</button>
      </div>` : ''}
    </div>`;
}
function blocKitsEntretienStockHtml() {
  const kits = UI.maintenanceKits || [];
  const peut = peutGererParametresStock();
  const liste = kits.length ? kits.map(ligneKitHtml).join('') : `<div class="ui-aide">${trad('Aucun kit pour l\'instant — un kit regroupe les pièces nécessaires à une étape d\'entretien.')}</div>`;
  return `
    <section class="ui-section" id="stock-kits-section">
      ${teteSectionKit('mallette', trad('Kits d\'entretien'), trad('Un kit regroupe les pièces nécessaires à une étape d\'entretien — à relier depuis la fiche d\'une machine pour anticiper les besoins.'),
        `<span class="ui-tag">${tR('{n} kit(s)', { n: kits.length })}</span>${peut ? `<button type="button" class="ui-btn ui-btn-pastille" id="stock-kit-nouveau">${picto('plusCercle')}<span>${trad('Nouveau kit')}</span></button>` : ''}`)}
      <div class="ui-section-corps">
        <div class="ui-liste is-defilant" id="stock-kits-liste">${liste}</div>
      </div>
    </section>`;
}

// Modale d'édition d'un kit (création ou modification) — nom/note/actif +
// lignes (pièce du catalogue + quantité). Enregistrement : upsert du kit,
// puis suppression totale + réinsertion des lignes — fenêtre non atomique
// acceptée pour le petit nombre de lignes qu'un kit porte réellement,
// éditées rarement par un gérant (contrairement aux mouvements de stock,
// qui eux exigent l'atomicité du calcul PUMP via une RPC dédiée).
function ouvrirEditionKit(kit) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay stock-kit-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const pieces = (UI.partsCatalog || []).slice().sort((a, b) => a.designation.localeCompare(b.designation));
  const optionsPieces = pieces.map((p) => `<option value="${esc(p.id)}">${esc(p.designation)}${p.reference ? ' — ' + esc(p.reference) : ''}</option>`).join('');
  const lignesExistantes = kit ? lignesKit(kit.id) : [];

  const ligneEditHtml = () => `
    <div class="stock-field-row" data-kit-ligne style="grid-template-columns:2fr 1fr auto;align-items:center;">
      <select data-kit-ligne-piece>${optionsPieces}</select>
      <input type="text" inputmode="decimal" data-kit-ligne-qte placeholder="${trad('Quantité')}">
      <button type="button" class="stock-row-actions is-danger" data-kit-ligne-retirer title="${esc(trad('Retirer cette ligne'))}" style="padding:7px;">${picto('corbeille')}</button>
    </div>`;

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="kit-titre">
      <h2 id="kit-titre">${kit ? trad('Modifier le kit') : trad('Nouveau kit d\'entretien')}</h2>
      <label for="kit-nom">${trad('Nom du kit')}</label>
      <input id="kit-nom" required placeholder="${trad('Ex : Kit vidange 500h')}" value="${kit ? esc(kit.name) : ''}">
      <label for="kit-note" style="margin-top:8px;display:block;">${trad('Note (optionnel)')}</label>
      <input id="kit-note" placeholder="${trad('Note (optionnel)')}" value="${kit && kit.note ? esc(kit.note) : ''}">
      ${kit ? `
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13.5px;">
        <input type="checkbox" id="kit-actif" ${kit.active !== false ? 'checked' : ''} style="width:16px;height:16px;">
        ${trad('Kit actif (proposable sur une fiche machine)')}
      </label>` : ''}
      <div style="margin-top:14px;">
        <div style="font-weight:600;font-size:13.5px;color:var(--ink);margin-bottom:8px;">${trad('Pièces du kit')}</div>
        <div id="kit-lignes" style="display:flex;flex-direction:column;gap:8px;">
          ${lignesExistantes.length ? lignesExistantes.map(() => ligneEditHtml()).join('') : ligneEditHtml()}
        </div>
        <button type="button" class="stock-btn-outline" id="kit-ligne-ajouter" style="margin-top:10px;">${picto('plusCercle')}<span>${trad('Ajouter une ligne')}</span></button>
      </div>
      <div class="ui-aide" id="kit-msg" role="status" aria-live="polite" style="margin-top:10px;"></div>
      <div class="modal-actions">
        <button type="button" class="secondary" id="kit-fermer">${trad('Fermer')}</button>
        <button type="button" class="primary" id="kit-enregistrer"><span>${trad('Enregistrer le kit')}</span></button>
      </div>
    </div>`;

  // Pré-remplit chaque ligne existante (pièce + quantité) puis habille tous
  // les sélecteurs de pièce (recherche cherchable, même composant que
  // partout ailleurs dans le module Stock).
  const lignesDom = () => [...overlay.querySelectorAll('[data-kit-ligne]')];
  lignesExistantes.forEach((ligne, i) => {
    const ligneEl = lignesDom()[i];
    if (!ligneEl) return;
    ligneEl.querySelector('[data-kit-ligne-piece]').value = String(ligne.part_id);
    ligneEl.querySelector('[data-kit-ligne-qte]').value = texteAvecSeparateurs(ligne.quantity);
  });
  overlay.querySelectorAll('[data-kit-ligne-piece]').forEach((sel) => habillerSelectPieceCatalogue(sel));

  const dire = (texte, erreur) => {
    const el = overlay.querySelector('#kit-msg');
    if (!el) return;
    el.textContent = texte;
    el.style.color = erreur ? 'var(--late)' : 'var(--ok)';
  };
  const geler = (g) => { overlay.querySelectorAll('button,input,select').forEach((el) => { el.disabled = g; }); };

  overlay.querySelector('#kit-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#kit-ligne-ajouter').addEventListener('click', () => {
    const conteneur = overlay.querySelector('#kit-lignes');
    conteneur.insertAdjacentHTML('beforeend', ligneEditHtml());
    const selects = conteneur.querySelectorAll('[data-kit-ligne-piece]');
    habillerSelectPieceCatalogue(selects[selects.length - 1]);
  });
  overlay.querySelector('#kit-lignes').addEventListener('click', (e) => {
    const retirer = e.target.closest('[data-kit-ligne-retirer]');
    if (!retirer) return;
    const ligneEl = retirer.closest('[data-kit-ligne]');
    // Toujours garder au moins une ligne à l'écran, jamais un formulaire vide
    // sans aucune action possible.
    if (lignesDom().length <= 1) {
      const sel = ligneEl.querySelector('[data-kit-ligne-piece]');
      if (sel) sel.selectedIndex = 0;
      const qte = ligneEl.querySelector('[data-kit-ligne-qte]');
      if (qte) qte.value = '';
      return;
    }
    ligneEl.remove();
  });

  overlay.querySelector('#kit-enregistrer').addEventListener('click', async () => {
    const nom = overlay.querySelector('#kit-nom').value.trim();
    if (!nom) { dire(trad('Le nom du kit est obligatoire.'), true); return; }
    const actifEl = overlay.querySelector('#kit-actif');
    const actif = actifEl ? actifEl.checked : true;
    const note = overlay.querySelector('#kit-note').value.trim();
    const lignesSaisies = lignesDom().map((ligneEl) => {
      const partId = ligneEl.querySelector('[data-kit-ligne-piece]').value;
      const qte = nombreDepuisTexte(ligneEl.querySelector('[data-kit-ligne-qte]').value);
      return partId && qte > 0 ? { part_id: partId, quantity: qte } : null;
    }).filter(Boolean);
    if (!lignesSaisies.length) { dire(trad('Ajoute au moins une pièce avec une quantité.'), true); return; }

    geler(true);
    dire(trad('Enregistrement…'), false);
    try {
      let kitId = kit ? kit.id : null;
      if (kitId) {
        const { data, error } = await sb.from('maintenance_kits')
          .update({ name: nom, note: note || null, active: actif })
          .eq('id', kitId)
          .select('id, name, note, active')
          .single();
        if (error) throw error;
        UI.maintenanceKits = (UI.maintenanceKits || []).map((k) => (String(k.id) === String(kitId) ? data : k));
      } else {
        const { data, error } = await sb.from('maintenance_kits')
          .insert({ company_id: UI.companyId, name: nom, note: note || null })
          .select('id, name, note, active')
          .single();
        if (error) throw error;
        kitId = data.id;
        UI.maintenanceKits = [...(UI.maintenanceKits || []), data];
      }
      const { error: delErr } = await sb.from('maintenance_kit_lines').delete().eq('kit_id', kitId);
      if (delErr) throw delErr;
      const { data: nouvellesLignes, error: insErr } = await sb.from('maintenance_kit_lines')
        .insert(lignesSaisies.map((l) => ({ company_id: UI.companyId, kit_id: kitId, part_id: l.part_id, quantity: l.quantity })))
        .select('id, kit_id, part_id, quantity, note');
      if (insErr) throw insErr;
      UI.maintenanceKitLines = [...(UI.maintenanceKitLines || []).filter((l) => String(l.kit_id) !== String(kitId)), ...(nouvellesLignes || [])];
      showToast(kit ? trad('Kit modifié') : trad('Kit créé'));
      overlay.remove();
      renderApp();
    } catch (err) {
      dire(trad('Erreur :') + ' ' + (err.message || err), true);
      geler(false);
    }
  });
}

// ── Besoins à risque ── le vrai bénéfice de configurer des kits : parmi
// TOUTES les pièces reliées à un kit sur une tâche à venir, celles dont le
// stock ne couvrira pas le besoin projeté. Réutilise listePreparation (même
// fonction que le Tableau de bord/Agenda, jamais un second calcul) avec le
// plus grand horizon existant (un délai d'appro peut dépasser la fenêtre
// courte du tableau de bord).
function ligneBesoinRisqueHtml(produit) {
  const couv = produit.stockCouverture;
  const texteEtat = couv.commanderAvantLe
    ? tR('Commander avant le {date}', { date: formatShortDate(couv.commanderAvantLe) })
    : libelleCouverturePiece(couv.state);
  const classeEtat = { late: 'is-retard', soon: 'is-bientot', ok: 'is-ok' }[couv.state] || '';
  return `
    <div class="ui-ligne is-deux ${classeEtat}">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone">${picto('boite')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(produit.label)}<span class="ui-statut ${classeEtat}">${esc(texteEtat)}</span></span>
          <span class="ui-ligne-sous">${produit.kitNom ? esc(produit.kitNom) : ''}${produit.tacheLabel ? ' · ' + esc(produit.tacheLabel) : ''}</span>
        </div>
      </div>
      <div class="ui-ligne-action">
        <div class="ui-chiffre is-droite">
          <span class="ui-chiffre-valeur">${texteAvecSeparateurs(couv.stockDisponible)}/${texteAvecSeparateurs(couv.besoin)}</span>
          <span class="ui-ligne-sous">${trad('dispo/besoin')}</span>
        </div>
      </div>
    </div>`;
}
function blocBesoinsRisqueStockHtml() {
  const horizon = Math.max(...PREPARATION_HORIZON);
  const liste = listePreparation(UI.machines, horizon);
  const ordreGravite = { late: 0, soon: 1, inconnu: 2, ok: 3 };
  const aRisque = (liste.produits || [])
    .filter((p) => p.stockCouverture && p.stockCouverture.solde < 0)
    .sort((a, b) => (ordreGravite[a.stockCouverture.state] ?? 9) - (ordreGravite[b.stockCouverture.state] ?? 9));
  return `
    <section class="ui-section" id="stock-besoins-risque-section">
      ${teteSectionKit('alerte', trad('Besoins à risque'), tR('Pièces reliées à un kit dont le stock ne couvrira pas les entretiens des {n} prochains jours.', { n: horizon }),
        `<span class="ui-tag">${tR('{n} pièce(s)', { n: aRisque.length })}</span>`)}
      <div class="ui-section-corps">
        <div class="ui-liste is-defilant">
          ${aRisque.length ? aRisque.map(ligneBesoinRisqueHtml).join('') : `<div class="ui-aide">${trad('Aucune pièce à risque pour l\'instant.')}</div>`}
        </div>
      </div>
    </section>`;
}

function exporterInventaireStockCsv() {
  const gerant = peutGererParametresStock();
  const header = gerant
    ? [trad('Référence'), trad('Désignation'), trad('Magasin'), trad('Quantité'), trad('Coût PUMP'), trad('Valeur')]
    : [trad('Référence'), trad('Désignation'), trad('Magasin'), trad('Quantité')];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const items = (UI.stockItems || []).slice().sort((a, b) => designationPiece(a.part_id).localeCompare(designationPiece(b.part_id)));
  const rows = items.map((it) => {
    const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(it.part_id));
    const base = [piece?.reference || '', piece?.designation || designationPiece(it.part_id), nomMagasin(it.warehouse_id), it.quantity];
    return gerant ? [...base, it.pump_unit_cost, Number(it.quantity) * Number(it.pump_unit_cost)] : base;
  });
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csvToUtf16Buffer(csv)], { type: 'text/csv;charset=utf-16le;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock_${todayIso()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Modale « Nouveau mouvement » ── idiome .overlay/.modal habituel
// (geler()/dire(), fermeture désactivée pendant l'écriture — voir le bug
// de course déjà rencontré et corrigé ailleurs dans ce fichier :
// keeva-redesign-project, « choix de fréquence parfois jamais enregistré »).
// TOUTE la logique PUMP/verrouillage vit dans la RPC enregistrer_mouvement_stock
// — ce code ne fait que collecter les champs et interpréter l'erreur.
function ouvrirNouveauMouvementModal() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay stock-mouvement-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const magasins = (UI.warehouses || []).filter((w) => w.active !== false);
  const pieces = (UI.partsCatalog || []).slice().sort((a, b) => a.designation.localeCompare(b.designation));
  const gerant = peutGererParametresStock();
  const optionsMagasins = magasins.map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('');
  const optionsPieces = pieces.map((p) => `<option value="${esc(p.id)}">${esc(p.designation)}${p.packaging ? ` (${esc(p.packaging)})` : ''}${p.reference ? ' — ' + esc(p.reference) : ''}</option>`).join('');

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mvt-titre">
      <h2 id="mvt-titre">${trad('Nouveau mouvement de stock')}</h2>
      <div class="field-row" style="grid-template-columns:repeat(${gerant ? 4 : 3},1fr);gap:8px;margin-bottom:4px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:13.5px;"><input type="radio" name="mvt-type" value="entree" checked style="width:16px;height:16px;">${trad('Entrée')}</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13.5px;"><input type="radio" name="mvt-type" value="sortie" style="width:16px;height:16px;">${trad('Sortie')}</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13.5px;"><input type="radio" name="mvt-type" value="transfert" style="width:16px;height:16px;">${trad('Transfert')}</label>
        ${gerant ? `<label style="display:flex;align-items:center;gap:6px;font-size:13.5px;"><input type="radio" name="mvt-type" value="ajustement" style="width:16px;height:16px;">${trad('Ajustement')}</label>` : ''}
      </div>
      <label class="sr-only" for="mvt-piece">${trad('Pièce')}</label>
      <select id="mvt-piece">${optionsPieces}</select>
      <div class="field-row" style="margin-top:8px;">
        <div>
          <label id="mvt-magasin-label" for="mvt-magasin">${trad('Magasin')}</label>
          <select id="mvt-magasin">${optionsMagasins}</select>
        </div>
        <div id="mvt-destination-bloc" hidden>
          <label for="mvt-destination">${trad('Magasin de destination')}</label>
          <select id="mvt-destination">${optionsMagasins}</select>
        </div>
      </div>
      <div class="field-row" style="margin-top:8px;">
        <div>
          <label for="mvt-quantite">${trad('Quantité')}</label>
          <input id="mvt-quantite" type="text" inputmode="decimal" placeholder="0">
        </div>
        <div id="mvt-cout-bloc">
          <label for="mvt-cout">${trad('Coût unitaire')}</label>
          <div class="tco-champ-unite">
            <input id="mvt-cout" type="text" inputmode="decimal" placeholder="0">
            <span class="tco-unite-tag">${esc(deviseCourte())}</span>
          </div>
        </div>
      </div>
      <div id="mvt-intervention-bloc" hidden style="margin-top:8px;">
        <label for="mvt-machine">${trad('Machine (optionnel)')}</label>
        <select id="mvt-machine">
          <option value="">${trad('— Aucune —')}</option>
          ${(UI.machines || []).filter((m) => !m.archived).map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}
        </select>
        <label for="mvt-intervention" style="margin-top:6px;display:block;">${trad('Intervention liée (optionnel)')}</label>
        <select id="mvt-intervention" disabled>
          <option value="">${trad('Choisir une machine d\'abord')}</option>
        </select>
        <p class="ui-aide">${trad('Si cette sortie a déjà été saisie via « Enregistrer une intervention », ne la lie pas ici aussi — le coût serait compté deux fois.')}</p>
      </div>
      <label for="mvt-motif" style="margin-top:8px;display:block;">${trad('Motif / note (optionnel)')}</label>
      <input id="mvt-motif" placeholder="${trad('Ex : bon de livraison, casse, inventaire…')}">
      <div class="ui-aide" id="mvt-msg" role="status" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="secondary" id="mvt-fermer">${trad('Fermer')}</button>
        <button type="button" class="primary" id="mvt-valider"><span>${trad('Enregistrer le mouvement')}</span></button>
      </div>
    </div>`;

  activerSeparateurMilliers(overlay.querySelector('#mvt-quantite'));
  activerSeparateurMilliers(overlay.querySelector('#mvt-cout'));

  const dire = (texte, erreur) => {
    const el = overlay.querySelector('#mvt-msg');
    if (!el) return;
    el.textContent = texte;
    el.style.color = erreur ? 'var(--late)' : 'var(--ok)';
  };
  const geler = (g) => { overlay.querySelectorAll('button,input,select').forEach((el) => { el.disabled = g; }); };

  const majSelonType = () => {
    const type = overlay.querySelector('input[name="mvt-type"]:checked')?.value || 'entree';
    overlay.querySelector('#mvt-destination-bloc').hidden = type !== 'transfert';
    overlay.querySelector('#mvt-cout-bloc').style.display = type === 'entree' ? '' : 'none';
    overlay.querySelector('#mvt-intervention-bloc').hidden = type !== 'sortie';
    overlay.querySelector('#mvt-magasin-label').textContent = type === 'transfert' ? trad('Magasin source') : trad('Magasin');
  };
  overlay.querySelectorAll('input[name="mvt-type"]').forEach((r) => r.addEventListener('change', majSelonType));
  majSelonType();

  overlay.querySelector('#mvt-fermer').addEventListener('click', () => overlay.remove());

  // Interventions de la machine choisie — chargées À LA DEMANDE, jamais au
  // montage de la modale (la plupart des sorties n'utiliseront jamais ce
  // champ optionnel, pas de fetch gratuit pour ça).
  overlay.querySelector('#mvt-machine')?.addEventListener('change', async (e) => {
    const selInter = overlay.querySelector('#mvt-intervention');
    const machineId = e.target.value;
    if (!machineId) { selInter.innerHTML = `<option value="">${trad('— Aucune —')}</option>`; selInter.disabled = true; return; }
    selInter.disabled = true;
    selInter.innerHTML = `<option value="">${trad('Chargement…')}</option>`;
    try {
      const interventions = await fetchAllInterventions(machineId);
      selInter.innerHTML = `<option value="">${trad('— Aucune —')}</option>` +
        interventions.slice(0, 30).map((it) => `<option value="${esc(it.id)}">${esc(formatShortDateAvecAnnee(it.performed_at))}${it.description ? ' — ' + esc(String(it.description).slice(0, 40)) : ''}</option>`).join('');
      selInter.disabled = false;
    } catch (err) {
      selInter.innerHTML = `<option value="">${trad('Erreur de chargement')}</option>`;
    }
  });

  overlay.querySelector('#mvt-valider').addEventListener('click', async () => {
    const type = overlay.querySelector('input[name="mvt-type"]:checked')?.value || 'entree';
    const partId = overlay.querySelector('#mvt-piece').value;
    const warehouseId = overlay.querySelector('#mvt-magasin').value;
    const destId = type === 'transfert' ? overlay.querySelector('#mvt-destination').value : null;
    const qty = nombreDepuisTexte(overlay.querySelector('#mvt-quantite').value);
    const coutBrut = overlay.querySelector('#mvt-cout').value;
    const cout = type === 'entree' ? nombreDepuisTexte(coutBrut) : (coutBrut ? nombreDepuisTexte(coutBrut) : null);
    const interventionId = (type === 'sortie' && overlay.querySelector('#mvt-intervention')?.value) || null;
    const motif = overlay.querySelector('#mvt-motif').value.trim() || null;

    if (!partId) { dire(trad('Choisis une pièce.'), true); return; }
    if (!warehouseId) { dire(trad('Choisis un magasin.'), true); return; }
    if (type === 'transfert' && (!destId || destId === warehouseId)) { dire(trad('Choisis un magasin de destination différent du magasin source.'), true); return; }
    if (!qty || qty <= 0) { dire(trad('Quantité invalide.'), true); return; }
    if (type === 'entree' && (cout == null || cout < 0)) { dire(trad('Coût unitaire requis pour une entrée.'), true); return; }

    geler(true);
    dire(trad('Enregistrement…'), false);
    try {
      const { error } = await sb.rpc('enregistrer_mouvement_stock', {
        p_type: type,
        p_part_id: partId,
        p_warehouse_id: warehouseId,
        p_destination_warehouse_id: destId,
        p_quantity: qty,
        p_unit_cost: cout,
        p_intervention_id: interventionId,
        p_reason: motif,
      });
      if (error) throw error;
      // Le solde réel fait foi côté serveur (calcul PUMP/verrouillage dans
      // la RPC) — on le relit plutôt que de reconstruire le calcul en JS,
      // jamais deux implémentations du même calcul qui pourraient diverger.
      const { data: soldes } = await sb.from('stock_items')
        .select('id, part_id, warehouse_id, quantity, pump_unit_cost, reorder_point, updated_at')
        .eq('company_id', UI.companyId);
      UI.stockItems = soldes || [];
      UI.stockCounts = calculerStockCounts(UI.stockItems, UI.partsCatalog);
      showToast(trad('Mouvement enregistré'));
      overlay.remove();
      renderApp();
    } catch (err) {
      dire(trad('Erreur :') + ' ' + (err.message || err), true);
      geler(false);
    }
  });
}

// ── IMPORT CSV DES MOUVEMENTS DE STOCK ─────────────────────────────────
// Réservé aux ENTRÉES (demande explicite de l'utilisateur — cas d'usage :
// grosses arrivées de stock, coûts unitaires différents d'une ligne à
// l'autre). Un seul magasin pour tout le fichier, choisi dans la modale —
// pas de colonne Magasin dans le CSV. Même silhouette que ouvrirImportCatalogue
// (terminal d'en-tête, règles, zone de dépôt) mais PAS un upsert : chaque
// ligne appelle la RPC enregistrer_mouvement_stock, dans l'ordre du fichier
// et JAMAIS en parallèle — le coût moyen pondéré (PUMP) de chaque ligne
// dépend du solde que la ligne précédente vient d'écrire ; un Promise.all()
// donnerait un résultat qui dépend de l'ordre d'arrivée réseau, pas de
// l'ordre du fichier. Voir ouvrirExplicationPump() pour la formule.
function enteteCsvMouvements() {
  return ['Référence', 'Quantité', 'Coût unitaire', 'Motif'];
}
// Format identique à enteteCsvPieces()/modeleCsvCatalogue : en-tête EXACT,
// ordre positionnel strict. La Référence doit déjà exister dans le
// catalogue (colonnesCatalogueePiece()/UI.partsCatalog) — pas de création
// de pièce à la volée depuis ce fichier, jamais deux formats d'import qui
// créent des pièces différemment.
function analyserCsvMouvements(texte) {
  const lignesBrutes = String(texte || '').split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
  if (!lignesBrutes.length) return { lignes: [], erreurs: [trad('Fichier vide.')] };
  const entete = analyserLigneCsv(lignesBrutes[0]).map((c) => c.trim());
  const enteteAttendu = enteteCsvMouvements();
  const enteteOk = entete.length === enteteAttendu.length
    && entete.every((c, i) => c.toLowerCase() === enteteAttendu[i].toLowerCase());
  if (!enteteOk) {
    return {
      lignes: [],
      erreurs: [tR('En-tête invalide. Attendu : {attendu} — reçu : {recu}', {
        attendu: enteteAttendu.join(','), recu: entete.join(',') || trad('(vide)'),
      })],
    };
  }
  const lignes = [];
  const erreurs = [];
  for (let i = 1; i < lignesBrutes.length; i++) {
    const champs = analyserLigneCsv(lignesBrutes[i]).map((c) => (c || '').trim());
    const numero = i + 1;
    const [referenceTexte, qteTexte, coutTexte, motif] = champs;
    if (!referenceTexte) { erreurs.push(tR('Ligne {n} : référence manquante, ignorée.', { n: numero })); continue; }
    const piece = (UI.partsCatalog || []).find((p) => (p.reference || '').trim().toLowerCase() === referenceTexte.toLowerCase());
    if (!piece) { erreurs.push(tR('Ligne {n} : référence « {ref} » introuvable dans le catalogue, ignorée.', { n: numero, ref: referenceTexte })); continue; }
    const qte = nombreDepuisTexte(qteTexte);
    if (qte == null || qte <= 0) { erreurs.push(tR('Ligne {n} : quantité invalide, ignorée.', { n: numero })); continue; }
    const cout = nombreDepuisTexte(coutTexte);
    if (cout == null || cout < 0) { erreurs.push(tR('Ligne {n} : coût unitaire invalide, ignorée.', { n: numero })); continue; }
    lignes.push({
      numero, part_id: piece.id, reference: piece.reference || piece.designation,
      quantity: qte, unit_cost: cout, reason: motif || null,
    });
  }
  return { lignes, erreurs };
}
function modeleCsvMouvements() {
  const exemple = ['FLT-0142', '50', '24.90', trad('Livraison BL-2026-0142')];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [enteteCsvMouvements(), exemple].map((r) => r.map(escape).join(',')).join('\r\n');
}
function telechargerModeleCsvMouvements() {
  const blob = new Blob([csvToUtf16Buffer(modeleCsvMouvements())], { type: 'text/csv;charset=utf-16le;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modele_mouvements_stock.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function ouvrirImportMouvementsStock() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay import-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const magasins = (UI.warehouses || []).filter((w) => w.active !== false);
  const optionsMagasins = magasins.map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('');

  const REGLES = [
    { icone: 'boite', teinte: 'is-bleu', titre: trad('Référence :'), texte: trad('doit correspondre à une pièce déjà présente dans le catalogue.') },
    { icone: 'devise', teinte: 'is-vert', titre: trad('Coût unitaire :'), texte: trad('nombre (virgule ou point décimal accepté), obligatoire.') },
    { icone: 'info', teinte: 'is-bleu', titre: trad('Motif :'), texte: trad('texte libre (ex : n° de bon de livraison), facultatif.') },
  ];

  overlay.innerHTML = `
    <div class="modal import-csv-modal">
      <div class="import-csv-barre"></div>
      <div class="import-csv-corps">
        <div class="import-csv-entete">
          <div class="import-csv-entete-gauche">
            <div class="import-csv-icone">${picto('televerser')}</div>
            <div>
              <h2>${trad('Importer des mouvements depuis un CSV')}</h2>
              <p class="import-csv-sous-titre">${trad('Enregistre plusieurs entrées de stock en une fois')}</p>
            </div>
          </div>
          <button type="button" class="log-close2" id="import-mvt-fermer-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
        </div>

        <div class="import-csv-section">
          <p class="import-csv-libelle">${trad('Magasin de destination')} <strong class="import-csv-badge">${trad('OBLIGATOIRE')}</strong></p>
          <select id="import-mvt-magasin">
            <option value="">${trad('Choisir un magasin…')}</option>
            ${optionsMagasins}
          </select>
          <p class="ui-aide">${trad('Toutes les lignes du fichier seront enregistrées comme des ENTRÉES dans ce magasin — une colonne « Magasin » séparée n\'est pas prise en charge.')}</p>
        </div>

        <div class="import-csv-section">
          <p class="import-csv-libelle">${trad('Fichier CSV avec un en-tête')} <strong class="import-csv-badge">${trad('EXACTEMENT')}</strong> ${trad('dans cet ordre :')}</p>
          <div class="import-csv-terminal">
            <div class="import-csv-terminal-tete">
              <span><span class="dot"></span>${tR('En-tête requis (colonnes 1 à {n})', { n: enteteCsvMouvements().length })}</span>
              <button type="button" id="import-mvt-copier">${picto('copier')}<span>${trad('Copier')}</span></button>
            </div>
            <div class="import-csv-terminal-code">${esc(enteteCsvMouvements().join(','))}</div>
          </div>
        </div>

        <div class="import-csv-section">
          <span class="import-csv-eyebrow">${trad('Règles & conditions de traitement')}</span>
          <div class="import-csv-regles">
            ${REGLES.map((r) => `
              <div class="import-csv-regle">
                <div class="import-csv-regle-icone ${r.teinte}">${picto(r.icone)}</div>
                <div><strong>${esc(r.titre)}</strong> ${esc(r.texte)}</div>
              </div>`).join('')}
            <div class="import-csv-regle is-accent">
              <div class="import-csv-regle-icone is-primaire">${picto('rafraichir')}</div>
              <div><strong>${trad('Chaque ligne = une entrée distincte :')}</strong> ${trad('si une même référence apparaît plusieurs fois, chaque ligne recalcule le coût moyen pondéré à son tour, dans l\'ordre du fichier — jamais un import groupé.')}</div>
            </div>
          </div>
        </div>

        <div class="import-csv-section">
          <button type="button" class="import-csv-bouton-modele" id="import-mvt-modele">${picto('export')}<span>${trad('Télécharger un modèle')}</span></button>
          <input id="import-mvt-fichier" type="file" accept=".csv,text/csv" hidden>
          <div class="import-csv-zone" id="import-mvt-zone">
            <div class="import-csv-zone-icone">${picto('televerser')}</div>
            <span class="import-csv-zone-nom" id="import-mvt-choisir-label">${trad('Choisir un fichier…')}</span>
            <span class="import-csv-zone-aide">${trad('(ou glisser le .csv ici)')}</span>
          </div>
        </div>

        <div id="import-mvt-msg" role="status" aria-live="polite"></div>
      </div>
      <div class="import-csv-pied">
        <button type="button" class="secondary" id="import-mvt-fermer">${trad('Fermer')}</button>
        <button type="button" class="primary" id="import-mvt-go" disabled>${picto('coche')}<span>${trad('Importer')}</span></button>
      </div>
    </div>`;

  overlay.querySelector('#import-mvt-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#import-mvt-fermer-x').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#import-mvt-modele').addEventListener('click', telechargerModeleCsvMouvements);

  const boutonCopier = overlay.querySelector('#import-mvt-copier');
  boutonCopier?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(enteteCsvMouvements().join(','));
      const texteBtn = boutonCopier.querySelector('span');
      const avant = texteBtn.textContent;
      boutonCopier.classList.add('is-copie');
      texteBtn.textContent = trad('Copié !');
      setTimeout(() => { boutonCopier.classList.remove('is-copie'); texteBtn.textContent = avant; }, 2000);
    } catch (err) { /* presse-papiers indisponible : sans conséquence */ }
  });

  const inputFichier = overlay.querySelector('#import-mvt-fichier');
  const zone = overlay.querySelector('#import-mvt-zone');
  const labelChoisir = overlay.querySelector('#import-mvt-choisir-label');
  const boutonGo = overlay.querySelector('#import-mvt-go');
  const selMagasin = overlay.querySelector('#import-mvt-magasin');
  const msg = overlay.querySelector('#import-mvt-msg');
  let fichierChoisi = null;

  const majBoutonGo = () => { boutonGo.disabled = !fichierChoisi || !selMagasin.value; };
  selMagasin.addEventListener('change', majBoutonGo);

  const definirFichier = (fichier) => {
    fichierChoisi = fichier || null;
    labelChoisir.textContent = fichierChoisi ? fichierChoisi.name : trad('Choisir un fichier…');
    zone.classList.toggle('is-rempli', !!fichierChoisi);
    majBoutonGo();
    msg.textContent = '';
  };

  zone.addEventListener('click', () => inputFichier.click());
  inputFichier.addEventListener('change', () => definirFichier(inputFichier.files?.[0] || null));
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-survol'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-survol'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-survol');
    const depose = e.dataTransfer?.files?.[0];
    if (depose) definirFichier(depose);
  });

  const labelGo = boutonGo.querySelector('span');
  boutonGo.addEventListener('click', async () => {
    if (!fichierChoisi || !selMagasin.value) return;
    boutonGo.disabled = true;
    selMagasin.disabled = true;
    msg.textContent = '';
    msg.style.color = '';
    try {
      const texte = await lireTexteFichier(fichierChoisi);
      const { lignes, erreurs } = analyserCsvMouvements(texte);
      if (!lignes.length) {
        msg.style.color = 'var(--danger, #c0392b)';
        msg.textContent = erreurs.length ? erreurs.join(' ') : trad('Aucune ligne valide trouvée dans ce fichier.');
        boutonGo.disabled = false;
        selMagasin.disabled = false;
        return;
      }
      // SÉQUENTIEL, JAMAIS EN PARALLÈLE (voir le commentaire en tête de
      // fichier de cette section) : le résultat de chaque appel dépend de
      // l'état que le précédent vient d'écrire.
      const erreursEnvoi = [];
      let reussies = 0;
      for (const ligne of lignes) {
        labelGo.textContent = tR('Import en cours… ({n}/{total})', { n: reussies + erreursEnvoi.length + 1, total: lignes.length });
        try {
          const { error } = await sb.rpc('enregistrer_mouvement_stock', {
            p_type: 'entree',
            p_part_id: ligne.part_id,
            p_warehouse_id: selMagasin.value,
            p_destination_warehouse_id: null,
            p_quantity: ligne.quantity,
            p_unit_cost: ligne.unit_cost,
            p_intervention_id: null,
            p_reason: ligne.reason,
          });
          if (error) throw error;
          reussies++;
        } catch (err) {
          erreursEnvoi.push(tR('Ligne {n} ({ref}) : {erreur}', { n: ligne.numero, ref: ligne.reference, erreur: err.message || String(err) }));
        }
      }
      const { data: soldes } = await sb.from('stock_items')
        .select('id, part_id, warehouse_id, quantity, pump_unit_cost, reorder_point, updated_at')
        .eq('company_id', UI.companyId);
      UI.stockItems = soldes || [];
      UI.stockCounts = calculerStockCounts(UI.stockItems, UI.partsCatalog);
      renderApp();

      const toutesErreurs = [...erreurs, ...erreursEnvoi];
      const succes = tR('{n} mouvement(s) enregistré(s).', { n: reussies });
      if (toutesErreurs.length) {
        msg.style.color = '';
        msg.innerHTML = `<div>${esc(succes)}</div>`
          + `<div style="margin-top:6px;color:var(--danger, #c0392b);">${esc(tR('{m} ligne(s) ignorée(s) :', { m: toutesErreurs.length }))}</div>`
          + `<ul style="margin:4px 0 0 18px;padding:0;">${toutesErreurs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
        boutonGo.disabled = false;
        selMagasin.disabled = false;
        labelGo.textContent = trad('Importer');
      } else {
        showToast(succes);
        overlay.remove();
      }
    } catch (err) {
      msg.style.color = 'var(--danger, #c0392b)';
      msg.textContent = trad('Erreur :') + ' ' + (err.message || err);
      boutonGo.disabled = false;
      selMagasin.disabled = false;
      labelGo.textContent = trad('Importer');
    }
  });
}

VIEWS.stock = {
  fondBlanc: true,
  title: trad('Stocks & SAV'),
  subtitle: () => trad('Magasins, mouvements et valorisation du stock'),
  render() {
    return `
      <div class="ui-page">
        ${stockKpiGridHtml()}
        <div class="ui-colonnes">
          <div class="ui-colonne">
            ${blocMagasinsStockHtml()}
            ${SCHEMA.hasKits ? blocKitsEntretienStockHtml() : ''}
            ${SCHEMA.hasKits ? blocBesoinsRisqueStockHtml() : ''}
          </div>
          <div class="ui-colonne">
            ${blocInventaireStockHtml()}
            ${blocMouvementsStockHtml()}
          </div>
        </div>
        ${blocCatalogueTcoHtml()}
      </div>`;
  },
  mount() {
    const root = document.getElementById('view-root');
    if (!root) return;
    const message = (el, texte, erreur) => {
      if (!el) return;
      el.textContent = texte;
      el.style.color = erreur ? 'var(--late)' : 'var(--ok)';
    };

    root.querySelector('#stock-pump-info')?.addEventListener('click', ouvrirExplicationPump);

    // ── Kits d'entretien : CRUD réservé au gérant. ──
    if (SCHEMA.hasKits) {
      root.querySelector('#stock-kit-nouveau')?.addEventListener('click', () => ouvrirEditionKit(null));
      root.querySelector('#stock-kits-liste')?.addEventListener('click', (e) => {
        const modifier = e.target.closest('[data-kit-modifier]');
        if (modifier) {
          const kitVise = (UI.maintenanceKits || []).find((k) => String(k.id) === modifier.getAttribute('data-kit-modifier'));
          if (kitVise) ouvrirEditionKit(kitVise);
          return;
        }
        const retirer = e.target.closest('[data-kit-retirer]');
        if (!retirer) return;
        const id = retirer.getAttribute('data-kit-retirer');
        if (!window.confirm(trad('Supprimer ce kit ? Les tâches de plan qui le référencent afficheront « Kit supprimé ».'))) return;
        (async () => {
          try {
            const { error: errLignes } = await sb.from('maintenance_kit_lines').delete().eq('kit_id', id);
            if (errLignes) throw errLignes;
            const { error: errKit } = await sb.from('maintenance_kits').delete().eq('id', id);
            if (errKit) throw errKit;
            UI.maintenanceKits = (UI.maintenanceKits || []).filter((k) => String(k.id) !== String(id));
            UI.maintenanceKitLines = (UI.maintenanceKitLines || []).filter((l) => String(l.kit_id) !== String(id));
            showToast(trad('Kit supprimé'));
            renderApp();
          } catch (err) {
            window.alert(trad('Erreur :') + ' ' + (err.message || err));
          }
        })();
      });
    }

    // Catalogue de pièces : déplacé ici depuis Coûts & TCO pour les
    // sociétés Enterprise (demande explicite de l'utilisateur — sa place
    // naturelle maintenant que le module Stock existe). Même fonction de
    // câblage que sur la page TCO pour les autres paliers — voir
    // cablerCatalogueTco() et VIEWS.tco.mount().
    cablerCatalogueTco(root);

    // ── Inventaire : filtre magasin + recherche, entièrement en mémoire
    // (UI.stockItems déjà chargé au boot — jamais un second fetch ici). ──
    const rafraichirInventaire = () => {
      const liste = root.querySelector('#stock-inventaire-liste');
      const badge = root.querySelector('#stock-inventaire-badge');
      const vide = root.querySelector('#stock-inventaire-vide');
      if (!liste) return;
      const terme = (root.querySelector('#stock-inventaire-filtre')?.value || '').trim().toLowerCase();
      const magasinId = root.querySelector('#stock-inventaire-magasin')?.value || '';
      let items = UI.stockItems || [];
      if (magasinId) items = items.filter((it) => String(it.warehouse_id) === String(magasinId));
      if (terme) {
        items = items.filter((it) => {
          const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(it.part_id));
          const texte = [piece?.designation, piece?.reference, nomMagasin(it.warehouse_id)].filter(Boolean).join(' ').toLowerCase();
          return texte.includes(terme);
        });
      }
      items = items.slice().sort((a, b) => designationPiece(a.part_id).localeCompare(designationPiece(b.part_id)));
      liste.innerHTML = items.map(ligneInventaireStockHtml).join('');
      if (badge) badge.textContent = tR('{n} ligne(s)', { n: items.length });
      if (vide) vide.textContent = items.length ? '' : trad('Aucune ligne de stock pour ce filtre.');
    };
    rafraichirInventaire();
    root.querySelector('#stock-inventaire-filtre')?.addEventListener('input', rafraichirInventaire);
    root.querySelector('#stock-inventaire-magasin')?.addEventListener('change', rafraichirInventaire);
    root.querySelector('#stock-inventaire-export')?.addEventListener('click', () => exporterInventaireStockCsv());

    // ── Magasins : CRUD réservé au gérant, même patron que le catalogue
    // de pièces TCO (formulaire unique ajout/édition). ──
    if (peutGererParametresStock()) {
      let magasinEnEdition = null;
      const formTitre = root.querySelector('#stock-magasin-form-titre');
      const btnAjouter = root.querySelector('#stock-magasin-ajouter');
      const btnAnnuler = root.querySelector('#stock-magasin-annuler');
      const msg = root.querySelector('#stock-magasin-msg');
      const sortirEdition = () => {
        magasinEnEdition = null;
        const champNom = root.querySelector('#stock-magasin-nom');
        const champKind = root.querySelector('#stock-magasin-kind');
        const champNote = root.querySelector('#stock-magasin-note');
        if (champNom) champNom.value = '';
        if (champKind) champKind.value = 'central';
        if (champNote) champNote.value = '';
        if (formTitre) formTitre.textContent = trad('Ajouter un magasin');
        if (btnAjouter) btnAjouter.querySelector('span').textContent = trad('Ajouter le magasin');
        if (btnAnnuler) btnAnnuler.hidden = true;
      };
      root.querySelector('#stock-magasins-liste')?.addEventListener('click', (e) => {
        const modifier = e.target.closest('[data-magasin-modifier]');
        const retirer = e.target.closest('[data-magasin-retirer]');
        if (modifier) {
          const w = (UI.warehouses || []).find((x) => String(x.id) === modifier.getAttribute('data-magasin-modifier'));
          if (!w) return;
          magasinEnEdition = w.id;
          root.querySelector('#stock-magasin-nom').value = w.name || '';
          root.querySelector('#stock-magasin-kind').value = w.kind || 'central';
          root.querySelector('#stock-magasin-note').value = w.note || '';
          if (formTitre) formTitre.textContent = trad('Modifier le magasin');
          if (btnAjouter) btnAjouter.querySelector('span').textContent = trad('Enregistrer les modifications');
          if (btnAnnuler) btnAnnuler.hidden = false;
        } else if (retirer) {
          const id = retirer.getAttribute('data-magasin-retirer');
          if (!window.confirm(trad('Supprimer ce magasin ?'))) return;
          (async () => {
            const { error } = await sb.from('warehouses').delete().eq('id', id);
            if (error) {
              // ON DELETE RESTRICT côté stock_movements : un magasin avec un
              // historique de mouvements ne peut pas être supprimé — on
              // propose de le désactiver plutôt qu'une erreur technique brute.
              if (String(error.code) === '23503' || /foreign key/i.test(error.message || '')) {
                if (window.confirm(trad('Ce magasin a un historique de mouvements et ne peut pas être supprimé. Le désactiver à la place (il n\'apparaîtra plus dans les nouveaux mouvements) ?'))) {
                  const { error: err2 } = await sb.from('warehouses').update({ active: false }).eq('id', id);
                  if (!err2) {
                    UI.warehouses = (UI.warehouses || []).map((w) => (String(w.id) === String(id) ? { ...w, active: false } : w));
                    showToast(trad('Magasin désactivé'));
                    renderApp();
                  }
                }
                return;
              }
              message(msg, trad('Erreur :') + ' ' + error.message, true);
              return;
            }
            UI.warehouses = (UI.warehouses || []).filter((w) => String(w.id) !== String(id));
            showToast(trad('Magasin supprimé'));
            renderApp();
          })();
        }
      });
      btnAnnuler?.addEventListener('click', sortirEdition);
      btnAjouter?.addEventListener('click', async () => {
        const nom = root.querySelector('#stock-magasin-nom').value.trim();
        const kind = root.querySelector('#stock-magasin-kind').value;
        const note = root.querySelector('#stock-magasin-note').value.trim();
        if (!nom) { message(msg, trad('Le nom est obligatoire.'), true); return; }
        btnAjouter.disabled = true;
        try {
          if (magasinEnEdition) {
            const { data, error } = await sb.from('warehouses')
              .update({ name: nom, kind, note: note || null })
              .eq('id', magasinEnEdition)
              .select('id, name, kind, assigned_to, note, active')
              .single();
            if (error) throw error;
            UI.warehouses = (UI.warehouses || []).map((w) => (String(w.id) === String(magasinEnEdition) ? data : w));
            showToast(trad('Magasin modifié'));
          } else {
            const { data, error } = await sb.from('warehouses')
              .insert({ company_id: UI.companyId, name: nom, kind, note: note || null })
              .select('id, name, kind, assigned_to, note, active')
              .single();
            if (error) throw error;
            UI.warehouses = [...(UI.warehouses || []), data];
            showToast(trad('Magasin ajouté'));
          }
          sortirEdition();
          renderApp();
        } catch (err) {
          message(msg, trad('Erreur :') + ' ' + err.message, true);
          btnAjouter.disabled = false;
        }
      });
    }

    // ── Mouvements : journal chargé en asynchrone (jamais au boot — un
    // historique peut grossir sans borne), pagination « voir plus » comme
    // le reste de l'app. Alimente aussi la tuile KPI « Mouvements ce
    // mois-ci » une fois chargé — jamais un second calcul séparé. ──
    const MOUVEMENTS_PAGE_SIZE = 20;
    let limiteMouvements = MOUVEMENTS_PAGE_SIZE;
    let mouvementsCharges = [];
    const rafraichirMouvements = () => {
      const liste = root.querySelector('#stock-mouvements-liste');
      if (!liste) return;
      const visibles = mouvementsCharges.slice(0, limiteMouvements);
      liste.innerHTML = visibles.length
        ? visibles.map(ligneMouvementStockHtml).join('')
        : `<div class="ui-aide">${trad('Aucun mouvement enregistré pour l\'instant.')}</div>`;
      const plus = root.querySelector('#stock-mouvements-plus');
      if (plus) plus.hidden = limiteMouvements >= mouvementsCharges.length;
    };
    (async () => {
      const section = root.querySelector('#stock-mouvements-section');
      if (!section) return;
      try {
        const { data, error } = await sb.from('stock_movements')
          .select('id, part_id, warehouse_id, destination_warehouse_id, type, quantity, unit_cost, resulting_pump_cost, intervention_id, reason, performed_by, performed_at')
          .eq('company_id', UI.companyId)
          .order('performed_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        mouvementsCharges = data || [];
        if (!root.isConnected || !section.isConnected) return;
        rafraichirMouvements();
        const kpi = root.querySelector('#stock-kpi-mouvements');
        if (kpi) {
          const debutMois = new Date();
          debutMois.setDate(1);
          debutMois.setHours(0, 0, 0, 0);
          const n = mouvementsCharges.filter((m) => new Date(m.performed_at) >= debutMois).length;
          kpi.textContent = String(n);
        }
      } catch (err) {
        const liste = root.querySelector('#stock-mouvements-liste');
        if (liste) liste.innerHTML = `<div class="ui-aide">${trad('Erreur de chargement :')} ${esc(err.message)}</div>`;
      }
    })();
    root.querySelector('#stock-mouvements-plus')?.addEventListener('click', () => {
      limiteMouvements += MOUVEMENTS_PAGE_SIZE;
      rafraichirMouvements();
    });
    root.querySelector('#stock-mouvements-nouveau')?.addEventListener('click', () => ouvrirNouveauMouvementModal());
    root.querySelector('#stock-mouvements-importer')?.addEventListener('click', () => ouvrirImportMouvementsStock());
  },
};
