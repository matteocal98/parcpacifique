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
// Quand aucune machine d'une catégorie ne permet de calculer le repère d'amortissement, on dit POURQUOI (jamais un silence) :
// on prend la machine à qui il manque le moins d'informations et on liste ce qui lui manque.
function repereIndisponibleTexte(categorieId) {
  const machines = (UI.machines || []).filter((m) => m.category && m.category.id === categorieId);
  if (!machines.length) return '';
  let meilleur = null;
  machines.forEach((m) => {
    const achat = Number(m.purchase_price);
    const vie = Number(m.expected_lifespan_counter);
    const u = counterUnitOf(m);
    const revente = Number(m.estimated_resale_value) || 0;
    const manque = [];
    if (!(achat > 0)) manque.push(trad("prix d'achat"));
    if (!(vie > 0)) manque.push(trad('durée de vie'));
    if (u !== 'hours' && u !== 'km') manque.push(trad('compteur en heures ou km'));
    if (achat > 0 && achat <= revente) manque.push(trad("revente estimée inférieure au prix d'achat"));
    if (!meilleur || manque.length < meilleur.length) meilleur = manque;
  });
  if (!meilleur || !meilleur.length) return '';
  return tR("Repère d'amortissement indisponible : {manque} à renseigner dans la fiche de la machine.", { manque: meilleur.join(', ') });
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
                ${repere ? '' : (() => { const t = repereIndisponibleTexte(cat.id); return t ? `<span class="ui-ligne-sous ui-repere-indispo">${esc(t)}</span>` : ''; })()}
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
                <button type="button" class="ui-btn ui-btn-pastille tco-seuil-plus" data-seuil-plus aria-expanded="false" aria-label="${esc(trad('Afficher l\'aide de saisie'))}" title="${esc(trad('Aide de saisie : moyenne actuelle, amortissement…'))}">+</button>
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
// ── Coût d'arrêt (panne-cout-arret.sql) ──────────────────────────────────────────────────────────────────────
// Coût par heure d'arrêt d'une machine, par catégorie (surchargeable machine par machine dans sa fiche) + heures d'une
// journée ouvrée de la société. Le coût d'une panne « à l'arrêt » est calculé et figé à sa résolution.
function blocCoutArretTcoHtml() {
  const gerant = UI.role === 'gerant';
  const bloque = gerant ? '' : ' disabled';
  const parId = new Map();
  (UI.machines || []).forEach((m) => {
    if (!m.category || !m.category.id || !String(m.category.name || '').trim()) return;
    if (!parId.has(m.category.id)) parId.set(m.category.id, (UI.categories || []).find((c) => c.id === m.category.id) || m.category);
  });
  const categories = [...parId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'));
  if (!categories.length) return '';
  const TEINTES = ['is-roi', 'is-ok', 'is-amber', 'is-indigo'];
  return `
    <section class="ui-section" id="tco-arret-section">
      <div class="ui-section-tete">
        <div class="ui-section-icone">${picto('retard')}</div>
        <div class="ui-section-titres">
          <span class="ui-section-sur-titre">${trad('Paramétrage de rentabilité')}</span>
          <h2 class="ui-section-titre">${trad('Coût d\'arrêt des machines')}</h2>
          <p class="ui-section-sous">${trad('Ce que coûte une heure de machine à l\'arrêt (location de remplacement, production perdue…)')}</p>
        </div>
      </div>
      <div class="ui-section-corps">
        ${!gerant ? `<div class="ui-aide">${trad('Réservé au gérant.')}</div>` : ''}
        <div class="ui-champ-groupe">
          <label class="ui-etiquette" for="tco-arret-heures-jour">${trad('Heures d\'une journée de travail')}</label>
          <div class="ui-champ-unite">
            <input id="tco-arret-heures-jour" class="ui-champ" type="text" inputmode="decimal" value="8"${bloque}>
            <span class="ui-unite">h</span>
          </div>
          <span class="ui-aide">${trad('Sert à estimer les heures d\'arrêt d\'une panne : jours ouvrés (lundi à vendredi) × ces heures.')}</span>
        </div>
        <div class="ui-deux is-egal">
          ${categories.map((cat, i) => `
          <div class="ui-liste"><div class="ui-ligne" data-arret-ligne data-categorie-id="${esc(cat.id)}">
            <div class="ui-ligne-id">
              <div class="ui-ligne-icone ${TEINTES[i % TEINTES.length]}">${picto(iconeCategorieMachine(cat.name))}</div>
              <div class="ui-ligne-textes">
                <span class="ui-ligne-nom">${esc(cat.name)}</span>
                <span class="ui-ligne-sous">${tR('{n} machine(s) suivie(s)', { n: (UI.machines || []).filter((m) => m.category?.id === cat.id).length })}</span>
              </div>
            </div>
            <div class="ui-ligne-action">
              <div class="ui-champ-unite">
                <input type="text" inputmode="decimal" class="ui-champ" data-arret-input value="${cat.downtime_hourly_cost != null ? esc(cat.downtime_hourly_cost) : ''}"${bloque}>
                <span class="ui-unite">${deviseCourte()}/h</span>
              </div>
            </div>
          </div></div>`).join('')}
        </div>
        <label class="ui-case"><input type="checkbox" id="tco-arret-inclus"${tcoArretInclus() ? ' checked' : ''}> ${trad('Inclure le coût d\'arrêt dans le TCO total')}</label>
        <div class="ui-aide">${trad('Laisse vide une catégorie dont l\'arrêt n\'a pas de coût : ses pannes ne seront pas chiffrées. Une machine peut avoir son propre coût horaire dans sa fiche (Modifier la machine).')}</div>
        <div class="ui-aide" id="tco-arret-msg" role="status" aria-live="polite"></div>
        <div><button type="button" class="ui-btn ui-btn-plein" id="tco-save-arret"${bloque}>${picto('coche')}<span>${trad('Enregistrer le coût d\'arrêt')}</span></button></div>
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
        ${tco.nbArret ? `<span class="ui-tag">${tR('Arrêt : {c} · {h} h', { c: tco.parArret ? formatMontant(tco.parArret) : '—', h: String(Math.round(tco.heuresArret * 10) / 10).replace('.', ',') })}${!periodeInfo && !tco.arretInclus ? ' · ' + trad('hors TCO') : ''}</span>` : ''}
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
// Colonnes de l'export du parc. Les 8 PREMIÈRES (texte lisible) sont inchangées pour ne pas casser les
// tableurs déjà construits dessus ; les suivantes sont faites pour être lues par un PROGRAMME (identifiant
// technique stable, valeurs numériques brutes, dates AAAA-MM-JJ) — voir docs/note-cadrage-integrations.md §8.
// options.toutLeParc : vrai = toute la flotte (ignore les filtres de l'écran) ; sinon = les machines affichées.
function exporterParcCsv(options) {
  const toutLeParc = !!(options && options.toutLeParc);
  const header = [
    trad('Machine'), trad('Catégorie'), trad('Marque / Modèle'), trad('Identifiant'), trad('État'), trad('Compteur'), trad('Échéance'), trad('Carnet PDF'),
    trad('ID technique'), trad('N° de série'), trad('Plaque'), trad('Année'), trad('Date d\'achat'),
    trad('Unité du compteur'), trad('Valeur du compteur'), trad('Source du compteur'),
    trad('Prochaine échéance (date)'), trad('Prochaine échéance (compteur)'),
  ];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const liste = toutLeParc ? fleetSorted((UI.machines || []).slice()) : fleetSorted(fleetMatches());
  const rows = liste.map((m) => {
    const info = infoMachine(m);
    const enCompteur = planIsCounter(m.plan);
    const unite = enCompteur ? counterUnitOf(m) : null;
    const compteur = unite ? formatCounter(machineCounter(m), unite) : '';
    const brut = machineCounter(m);
    const echeanceDate = !enCompteur && m.plan?.next_due_at ? String(m.plan.next_due_at).slice(0, 10) : '';
    const echeanceCompteur = enCompteur ? (planNextDueCounter(m.plan) ?? '') : '';
    const source = SCHEMA.hasTelemetry ? (m.counter_source === 'telemetry' ? trad('Automatique') : trad('Manuelle')) : '';
    return [
      m.name, m.category?.name || '', machineBrandModel(m) || '', identifiantAffiche(m) || '',
      badgeLabel(info.state), compteur, info.short, m.manual_url ? trad('Oui') : trad('Non'),
      m.id, m.serial_number || '', m.plate || '', m.model_year ?? '', m.purchase_date ? String(m.purchase_date).slice(0, 10) : '',
      unite || '', unite && brut != null ? brut : '', source,
      echeanceDate, echeanceCompteur,
    ];
  });
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  telechargerCsv(`parc_machines_${todayIso()}.csv`, csv);
}

// Interventions de TOUT le parc sur une période (jours = nombre de jours en arrière ; 0 = tout l'historique).
// Lecture par tranches de machines puis par pages de 1000 : jamais tronquée, jamais une URL démesurée.
async function exporterInterventionsCsv(jours) {
  const machines = UI.machines || [];
  const noms = new Map(machines.map((m) => [m.id, m.name]));
  const ids = machines.map((m) => m.id);
  const avecCouts = tcoActif();
  const colonnes = `id, machine_id, performed_at, hours_at_intervention, description, items_done, performed_by${avecCouts ? ', parts_cost, labor_cost, labor_hours' : ''}`;
  let depuis = null;
  if (jours > 0) {
    const d = new Date();
    d.setDate(d.getDate() - jours);
    depuis = d.toISOString().slice(0, 10);
  }
  const toutes = [];
  for (let i = 0; i < ids.length; i += 40) {
    const tranche = ids.slice(i, i + 40);
    for (let from = 0; ; from += 1000) {
      let req = sb.from('interventions').select(colonnes).in('machine_id', tranche)
        .order('performed_at', { ascending: false }).order('id', { ascending: false });
      if (depuis) req = req.gte('performed_at', depuis);
      const { data, error } = await req.range(from, from + 999);
      if (error) throw error;
      toutes.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
  }
  toutes.sort((a, b) => String(b.performed_at).localeCompare(String(a.performed_at)));
  let equipe = new Map();
  try { equipe = new Map((await equipePourAttribution()).map((m) => [m.id, m.nom_affiche])); } catch (e) { /* colonne Opérateur laissée vide */ }
  const header = [
    trad('ID intervention'), trad('ID technique machine'), trad('Machine'), trad('Date'), trad('Compteur à l\'intervention'),
    trad('Éléments traités'), trad('Remarques'), trad('Opérateur'),
  ];
  if (avecCouts) header.push(trad('Coût pièces'), trad('Coût main-d\'œuvre'), trad('Heures main-d\'œuvre'));
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = toutes.map((h) => {
    const ligne = [
      h.id, h.machine_id, noms.get(h.machine_id) || '', h.performed_at, h.hours_at_intervention ?? '',
      Array.isArray(h.items_done) ? h.items_done.join('; ') : '', h.description ?? '', equipe.get(h.performed_by) || '',
    ];
    if (avecCouts) ligne.push(h.parts_cost ?? '', h.labor_cost ?? '', h.labor_hours ?? '');
    return ligne;
  });
  if (rows.length === 0) return 0;
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  telechargerCsv(`interventions_${todayIso()}.csv`, csv);
  return rows.length;
}

// Fenêtre « Exporter » : choix du contenu (machines affichées / tout le parc / interventions + période)
// et du format de fichier (Excel UTF-16 / universel UTF-8, mémorisé par appareil).
function ouvrirModaleExport() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const nbAffichees = fleetMatches().length;
  const nbTotal = (UI.machines || []).length;
  const utf8 = encodageCsv() === 'utf8';
  overlay.innerHTML = `
    <div class="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-titre">
      <h2 id="export-titre">${trad('Exporter (CSV)')}</h2>
      <div class="ui-champ-groupe">
        <strong>${trad('Contenu')}</strong>
        <label class="ui-case"><input type="radio" name="export-contenu" value="affichees" checked> ${tR('Les machines affichées ({n})', { n: nbAffichees })}</label>
        <label class="ui-case"><input type="radio" name="export-contenu" value="tout"> ${tR('Tout le parc ({n})', { n: nbTotal })}</label>
        <label class="ui-case"><input type="radio" name="export-contenu" value="interventions"> ${trad('Les interventions de tout le parc')}</label>
        <div id="export-periode-bloc" hidden>
          <label class="sr-only" for="export-periode">${trad('Période')}</label>
          <select id="export-periode" class="ui-champ">
            <option value="30">${trad('30 derniers jours')}</option>
            <option value="90">${trad('90 derniers jours')}</option>
            <option value="365" selected>${trad('12 derniers mois')}</option>
            <option value="0">${trad('Tout l\'historique')}</option>
          </select>
        </div>
      </div>
      <div class="ui-champ-groupe">
        <strong>${trad('Format du fichier')}</strong>
        <label class="ui-case"><input type="radio" name="export-format" value="utf16" ${utf8 ? '' : 'checked'}> ${trad('Excel (UTF-16) — s\'ouvre directement dans Excel')}</label>
        <label class="ui-case"><input type="radio" name="export-format" value="utf8" ${utf8 ? 'checked' : ''}> ${trad('Universel (UTF-8) — pour un autre logiciel ou un programme')}</label>
      </div>
      <div id="export-msg" role="status" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="ui-btn ui-btn-pastille" id="export-fermer">${trad('Annuler')}</button>
        <button type="button" class="ui-btn ui-btn-plein" id="export-go">${picto('export')}<span>${trad('Télécharger')}</span></button>
      </div>
    </div>`;
  const contenu = () => overlay.querySelector('input[name="export-contenu"]:checked').value;
  overlay.querySelectorAll('input[name="export-contenu"]').forEach((r) => r.addEventListener('change', () => {
    overlay.querySelector('#export-periode-bloc').hidden = contenu() !== 'interventions';
  }));
  overlay.querySelector('#export-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#export-go').addEventListener('click', async () => {
    const bouton = overlay.querySelector('#export-go');
    const msg = overlay.querySelector('#export-msg');
    definirEncodageCsv(overlay.querySelector('input[name="export-format"]:checked').value);
    bouton.disabled = true;
    try {
      if (contenu() === 'interventions') {
        msg.textContent = trad('Préparation du fichier…');
        const n = await exporterInterventionsCsv(Number(overlay.querySelector('#export-periode').value));
        if (n === 0) { msg.textContent = trad('Aucune intervention sur cette période.'); bouton.disabled = false; return; }
      } else {
        exporterParcCsv({ toutLeParc: contenu() === 'tout' });
      }
      overlay.remove();
    } catch (err) {
      msg.textContent = trad('Erreur :') + ' ' + (err.message || err);
      bouton.disabled = false;
    }
  });
}
function exporterClassementTcoCsv(flotte) {
  const header = [trad('Machine'), trad('Prix d\'achat'), trad('Date d\'achat'), trad('Revente estimée'), trad('Coûts entretien'), trad('Coûts d\'exploitation'), trad('Coût d\'arrêt'), trad('Heures d\'arrêt'), trad('TCO total'), trad('Coût annualisé'), trad('Coût/unité'), trad('Ratio (%)'), trad('Base du ratio'), trad('État')];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = flotte.lignes.map(({ machine, tco, decision }) => [
    machine.name, machine.purchase_price ?? '', machine.purchase_date ?? '', machine.estimated_resale_value ?? '',
    Math.round(tco.parEntretien), Math.round(tco.parExploitation), Math.round(tco.parArret || 0), Math.round((tco.heuresArret || 0) * 10) / 10, Math.round(tco.total),
    tco.coutAnnuel != null ? Math.round(tco.coutAnnuel) : '', tco.coutParUnite != null ? Math.round(tco.coutParUnite) : '',
    decision ? Math.round(decision.ratio * 100) : '', decision ? (decision.base === 'amortissement' ? trad('Dépréciation') : trad('Prix d\'achat')) : '',
    decision ? etatTco(decision.ratio, decision.base) : '',
  ]);
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  telechargerCsv(`tco_flotte_${todayIso()}.csv`, csv);
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
    const [interventionsFlotte, coutsFlotte, arretsFlotte] = await Promise.all([
      fetchToutesInterventionsFlotte(machineIds),
      fetchTousCoutsExploitationFlotte(machineIds),
      fetchArretsResolus(machineIds).catch(() => []),
    ]);
    flotte = calculerFlotteTco(UI.machines || [], grouperParMachine(interventionsFlotte), grouperParMachine(coutsFlotte), grouperParMachine(arretsFlotte));
    repartition = repartitionFlotteTco(interventionsFlotte, coutsFlotte);
  } catch (err) {
    if (valueEl) valueEl.textContent = trad('Erreur de chargement :') + ' ' + err.message;
    majLigneVigilance(root, 'couts', '—', 'ok', trad('Indisponible'));
    return;
  }
  if (!root.isConnected || !carte.isConnected) return;
  if (!flotte) { majLigneVigilance(root, 'couts', '—', 'ok', trad('Indisponible')); carte.remove(); return; }
  if (valueEl) valueEl.remove();

  const tauxActif = UI.company?.labor_hourly_rate != null;
  const coutHoraireValeurs = flotte.lignes.map((l) => l.tco.coutParUnite).filter((v) => v != null);
  const coutHoraireMoyen = coutHoraireValeurs.length ? coutHoraireValeurs.reduce((s, v) => s + v, 0) / coutHoraireValeurs.length : null;
  const auDessusSeuil = machinesAuDessusSeuilCategorie(flotte);
  const coutHoraireEtat = auDessusSeuil.length > 0 ? 'late' : 'ok';
  majLigneVigilance(root, 'couts', auDessusSeuil.length, coutHoraireEtat, auDessusSeuil.length ? trad('À examiner dans Coûts & TCO') : trad('Aucune machine au-dessus du seuil'));
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
// Les étiquettes (QR code) du catalogue ne servent que si le module Stock est actif : le QR ouvre la fiche de stock.
function etiquettesCataloguePossibles() {
  return !!(SCHEMA.hasStockChamps && SCHEMA.hasStock && typeof planCouvreStock === 'function' && planCouvreStock());
}
function ligneCatalogueTcoHtml(piece) {
  const refEtDelai = [
    piece.reference || trad('Sans référence'),
    piece.ean ? `EAN ${piece.ean}` : '',
    [piece.supplier_name || '', piece.avg_lead_time_days != null ? tR('{n} j', { n: piece.avg_lead_time_days }) : ''].filter(Boolean).join(' - '),
  ].filter(Boolean).join(' · ');
  return `
    <div class="ui-ligne is-deux" data-piece-id="${esc(piece.id)}">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone">${picto('boite')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(piece.designation)}${piece.packaging ? `<span class="ui-tag">${esc(piece.packaging)}</span>` : ''}${piece.unit_of_measure && piece.unit_of_measure !== 'piece' ? `<span class="ui-tag">${esc(libelleUniteMesure(piece.unit_of_measure))}</span>` : ''}</span>
          <span class="ui-ligne-sous">${esc(refEtDelai)}</span>
          ${piece.default_reorder_point != null ? `<span class="ui-ligne-sous">${tR('Seuil bas : {n}', { n: texteAvecSeparateurs(piece.default_reorder_point) })}</span>` : ''}
        </div>
      </div>
      <div class="ui-ligne-action">
        <div class="ui-chiffre is-droite"><span class="ui-chiffre-valeur">${texteAvecSeparateurs(piece.unit_price)}</span><span class="ui-ligne-sous">${esc(deviseCourte())}</span></div>
        ${etiquettesCataloguePossibles() ? `<button type="button" class="ui-btn ui-btn-icone" data-piece-etiquette="${esc(piece.id)}" title="${esc(trad('Étiquette de cette pièce'))}" aria-label="${esc(trad('Étiquette de cette pièce'))}">${picto('qrcode')}</button>` : ''}
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
        `<span class="ui-tag" id="tco-catalogue-badge">${tR('{n} référence(s) active(s)', { n: pieces.length })}</span>${etiquettesCataloguePossibles() ? `<button type="button" class="ui-btn ui-btn-pastille" id="tco-catalogue-etiquettes">${picto('qrcode')}<span>${trad('Étiquettes')}</span></button>` : ''}<button type="button" class="ui-btn ui-btn-pastille" id="tco-catalogue-importer">${picto('televerser')}<span>${trad('Importer des pièces (CSV)')}</span></button>`)}
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
                ${fournisseursActifs()
                  ? `<div class="ui-select-wrap"><select id="tco-piece-fournisseur" class="ui-champ">${optionsFournisseursHtml(null, '')}</select>${picto('chevronBas')}</div>`
                  : `<input id="tco-piece-fournisseur" class="ui-champ" placeholder="${trad('Fournisseur (optionnel)')}">`}
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
            ${SCHEMA.hasStockChamps ? `
            <div class="ui-grille">
              <div class="ui-champ-groupe">
                <label class="sr-only" for="tco-piece-ean">${trad('Code-barres EAN')}</label>
                <input id="tco-piece-ean" class="ui-champ" inputmode="numeric" maxlength="64" placeholder="${trad('Code-barres EAN (optionnel)')}">
              </div>
              <div class="ui-champ-groupe">
                <label class="sr-only" for="tco-piece-unite">${trad('Unité de mesure')}</label>
                <div class="ui-select-wrap">
                  <select id="tco-piece-unite" class="ui-champ">
                    ${UNITES_MESURE.map(([code]) => `<option value="${code}">${esc(libelleUniteMesure(code))}</option>`).join('')}
                  </select>
                  ${picto('chevronBas')}
                </div>
              </div>
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
  if (SCHEMA.hasStockChamps) entete.push('EAN', 'Unité de mesure');
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
  // Un fichier de l'ANCIEN modèle (sans les colonnes EAN / Unité de mesure) reste accepté tel quel.
  const enteteAncien = SCHEMA.hasStockChamps ? enteteAttendu.slice(0, -2) : enteteAttendu;
  const memeEntete = (attendu) => entete.length === attendu.length
    && entete.every((c, i) => c.toLowerCase() === attendu[i].toLowerCase());
  const avecChamps = SCHEMA.hasStockChamps && memeEntete(enteteAttendu);
  const enteteOk = avecChamps || memeEntete(enteteAncien);
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
    if (avecChamps) {
      const eanTexte = (reste[idxReste++] || '').replace(/\s+/g, '');
      const uniteTexte = reste[idxReste++] || '';
      ligne.ean = eanTexte || null;
      if (uniteTexte) {
        const norm = (v) => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const trouvee = UNITES_MESURE.find(([code, fr]) => norm(code) === norm(uniteTexte) || norm(fr) === norm(uniteTexte) || norm(libelleUniteMesure(code)) === norm(uniteTexte));
        if (!trouvee) { erreurs.push(tR('Ligne {n} : unité de mesure inconnue (« {u} »), ignorée.', { n: numero, u: uniteTexte })); continue; }
        ligne.unit_of_measure = trouvee[0];
      } else {
        ligne.unit_of_measure = 'piece';
      }
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
  if (SCHEMA.hasStockChamps) exemple.push('3760123456789', 'Pièce');
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [enteteCsvPieces(), exemple].map((r) => r.map(escape).join(',')).join('\r\n');
}
function telechargerModeleCsvCatalogue() {
  telechargerCsv('modele_catalogue_pieces.csv', modeleCsvCatalogue());
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
        <button type="button" class="ui-btn ui-btn-pastille" id="import-fermer">${trad('Annuler')}</button>
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
      if (fournisseursActifs()) await rattacherFournisseursImport(lignes);
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
  const champEan = root.querySelector('#tco-piece-ean');
  const champUnite = root.querySelector('#tco-piece-unite');
  const titreForm = root.querySelector('#tco-piece-form-titre');
  const boutonAjouter = root.querySelector('#tco-piece-ajouter');
  const boutonAjouterLabel = boutonAjouter?.querySelector('span');
  const boutonAnnuler = root.querySelector('#tco-piece-annuler');
  const COLONNES_PIECE = colonnesCatalogueePiece();
  // Fournisseur : liste de fiches (module Stock) ou texte libre (autres offres).
  const fournisseurEstListe = !!champFournisseur && champFournisseur.tagName === 'SELECT';
  let texteHeriteEnCours = '';
  const fixerFournisseur = (piece) => {
    if (!champFournisseur) return;
    if (!fournisseurEstListe) { champFournisseur.value = piece ? (piece.supplier_name || '') : ''; return; }
    const id = piece ? (piece.supplier_id || fournisseurParNom(piece.supplier_name)?.id || '') : '';
    texteHeriteEnCours = (!id && piece && piece.supplier_name) ? piece.supplier_name : '';
    champFournisseur.innerHTML = optionsFournisseursHtml(id, texteHeriteEnCours);
    champFournisseur.value = id || (texteHeriteEnCours ? VALEUR_FOURNISSEUR_TEXTE : '');
  };
  const lireFournisseur = () => {
    if (!champFournisseur) return {};
    if (!fournisseurEstListe) return { supplier_name: champFournisseur.value.trim() || null };
    const v = champFournisseur.value;
    if (!v || v === VALEUR_FOURNISSEUR_NOUVEAU) return { supplier_id: null, supplier_name: null };
    if (v === VALEUR_FOURNISSEUR_TEXTE) return { supplier_id: null, supplier_name: texteHeriteEnCours || null };
    const f = fournisseurParId(v);
    return { supplier_id: v, supplier_name: f ? f.name : null };
  };
  if (fournisseurEstListe) {
    champFournisseur.addEventListener('change', () => {
      if (champFournisseur.value !== VALEUR_FOURNISSEUR_NOUVEAU) return;
      champFournisseur.value = '';
      ouvrirEditionFournisseur(null, (nouveau) => {
        champFournisseur.innerHTML = optionsFournisseursHtml(nouveau.id, '');
        champFournisseur.value = nouveau.id;
      });
    });
  }
  const sortirDuModeEdition = () => {
    pieceEnEdition = null;
    if (champRef) champRef.value = '';
    if (champDesignation) champDesignation.value = '';
    if (champPrix) champPrix.value = '';
    fixerFournisseur(null);
    if (champDelai) champDelai.value = '';
    if (champConditionnement) champConditionnement.value = '';
    if (champSeuil) champSeuil.value = '';
    if (champEan) champEan.value = '';
    if (champUnite) champUnite.value = 'piece';
    if (titreForm) titreForm.textContent = trad('Ajouter une pièce au catalogue');
    if (boutonAjouterLabel) boutonAjouterLabel.textContent = trad('Ajouter au catalogue');
    if (boutonAnnuler) boutonAnnuler.hidden = true;
  };
  boutonAnnuler?.addEventListener('click', sortirDuModeEdition);
  root.querySelector('#tco-catalogue-importer')?.addEventListener('click', ouvrirImportCatalogue);
  root.querySelector('#tco-catalogue-etiquettes')?.addEventListener('click', () => ouvrirModaleEtiquettes({ source: 'catalogue' }));

  boutonAjouter?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const msg = root.querySelector('#tco-catalogue-msg');
    const reference = champRef.value.trim();
    const designation = champDesignation.value.trim();
    const prix = nombreDepuisTexte(champPrix.value) ?? 0;
    const fournisseurChamps = lireFournisseur();
    const delai = nombreDepuisTexte(champDelai.value);
    const conditionnement = champConditionnement ? champConditionnement.value.trim() : '';
    const seuil = champSeuil ? nombreDepuisTexte(champSeuil.value) : null;
    const ean = champEan ? champEan.value.replace(/\s+/g, '') : '';
    const unite = champUnite ? champUnite.value : 'piece';
    if (!designation) { message(msg, trad('La désignation est obligatoire.'), true); return; }
    btn.disabled = true;
    if (boutonAjouterLabel) boutonAjouterLabel.textContent = pieceEnEdition ? trad('Enregistrement…') : trad('Ajout…');
    const champsOptionnels = {
      ...(SCHEMA.hasStockPackaging ? { packaging: conditionnement || null } : {}),
      ...(SCHEMA.hasStock ? { default_reorder_point: seuil } : {}),
      ...(SCHEMA.hasStockChamps ? { ean: ean || null, unit_of_measure: unite || 'piece' } : {}),
    };
    try {
      if (pieceEnEdition) {
        const { data, error } = await sb.from('parts_catalog')
          .update({
            reference: reference || null, designation, unit_price: prix,
            avg_lead_time_days: delai != null ? Math.round(delai) : null, ...fournisseurChamps,
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
            avg_lead_time_days: delai != null ? Math.round(delai) : null, ...fournisseurChamps,
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
    const etiquette = e.target.closest('[data-piece-etiquette]');
    if (etiquette) { ouvrirModaleEtiquettes({ source: 'catalogue', pieceId: etiquette.getAttribute('data-piece-etiquette') }); return; }
    const modifier = e.target.closest('[data-piece-modifier]');
    if (modifier) {
      const id = modifier.getAttribute('data-piece-modifier');
      const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(id));
      if (!piece) return;
      pieceEnEdition = id;
      if (champRef) champRef.value = piece.reference || '';
      if (champDesignation) champDesignation.value = piece.designation || '';
      if (champPrix) { champPrix.value = texteAvecSeparateurs(piece.unit_price); }
      fixerFournisseur(piece);
      if (champDelai) champDelai.value = piece.avg_lead_time_days != null ? String(piece.avg_lead_time_days) : '';
      if (champConditionnement) champConditionnement.value = piece.packaging || '';
      if (champSeuil) champSeuil.value = piece.default_reorder_point != null ? texteAvecSeparateurs(piece.default_reorder_point) : '';
      if (champEan) champEan.value = piece.ean || '';
      if (champUnite) champUnite.value = piece.unit_of_measure || 'piece';
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

// ── Onglets de la page Coûts & TCO (bureau) ──
function tcoOngletsDisponibles() {
  const liste = [];
  if (tcoActif()) liste.push({ id: 'classement', libelle: trad('Classement') });
  liste.push({ id: 'baremes', libelle: trad('Barèmes') });
  liste.push({ id: 'seuils', libelle: trad('Seuils de coût') });
  if (SCHEMA.hasArretCout) liste.push({ id: 'arret', libelle: trad('Coût d\'arrêt') });
  return liste;
}
function tcoOngletActif(onglets) {
  return onglets.some((o) => o.id === UI.tcoOnglet) ? UI.tcoOnglet : onglets[0].id;
}
function tcoAllerOnglet(root, id) {
  const bouton = root.querySelector(`[data-tco-onglet="${id}"]`);
  if (!bouton) return;
  UI.tcoOnglet = id;
  root.querySelectorAll('[data-tco-onglet]').forEach((b) => {
    const actif = b === bouton;
    b.classList.toggle('is-actif', actif);
    b.setAttribute('aria-selected', String(actif));
  });
  root.querySelectorAll('.tco-panneau').forEach((p) => { p.hidden = p.id !== `tco-panneau-${id}`; });
}

VIEWS.tco = {
  fondBlanc: true,
  title: trad('Coûts & TCO'),
  subtitle: () => trad('Classement de rentabilité du parc, barèmes de calcul et seuils de coût'),
  render() {
    // Bureau : la page est découpée en onglets (un seul bloc visible à la fois, bandeau de chiffres toujours en haut) ;
    // téléphone : les onglets sont masqués et les blocs restent empilés, repliables (voir kit.css). L'onglet choisi
    // est gardé dans UI.tcoOnglet pour survivre aux renderApp().
    const onglets = tcoOngletsDisponibles();
    const actif = tcoOngletActif(onglets);
    const panneau = (id, contenu) => (onglets.some((o) => o.id === id)
      ? `<div class="tco-panneau" role="tabpanel" id="tco-panneau-${id}" aria-labelledby="tco-onglet-${id}"${id === actif ? '' : ' hidden'}>${contenu}</div>`
      : '');
    return `
      <div class="ui-page tco-page">
        ${tcoKpiGridHtml()}
        <div class="stock-onglets tco-onglets" role="tablist" aria-label="${esc(trad('Sections des coûts'))}">
          ${onglets.map((o) => `<button type="button" class="stock-onglet tco-onglet${o.id === actif ? ' is-actif' : ''}" role="tab" id="tco-onglet-${o.id}" aria-selected="${o.id === actif}" aria-controls="tco-panneau-${o.id}" data-tco-onglet="${o.id}">${esc(o.libelle)}</button>`).join('')}
        </div>
        ${panneau('classement', tcoActif() ? tcoClassementFlotteHtml() : '')}
        ${panneau('baremes', `${blocParametresTcoHtml()}${(SCHEMA.hasStock && planCouvreStock()) ? '' : blocCatalogueTcoHtml()}`)}
        ${panneau('seuils', blocSeuilsCategorieTcoHtml())}
        ${panneau('arret', SCHEMA.hasArretCout ? blocCoutArretTcoHtml() : '')}
      </div>`;
  },
  mount() {
    // Seuils (téléphone) : le « + » d'une ligne déroule son aide de saisie (moyenne, amortissement, raccourcis).
    document.getElementById('view-root')?.addEventListener('click', (e) => {
      const plus = e.target.closest('[data-seuil-plus]');
      if (!plus) return;
      const ligne = plus.closest('[data-seuil-ligne]');
      const ouvert = ligne.classList.toggle('is-aide-ouverte');
      plus.setAttribute('aria-expanded', String(ouvert));
      plus.textContent = ouvert ? '−' : '+';
    });
    const root = document.getElementById('view-root');
    if (!root) return;
    // Onglets (bureau) : clic et flèches gauche/droite.
    root.addEventListener('click', (e) => {
      const onglet = e.target.closest('[data-tco-onglet]');
      if (onglet) tcoAllerOnglet(root, onglet.getAttribute('data-tco-onglet'));
    });
    root.querySelector('.tco-onglets')?.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const boutons = [...root.querySelectorAll('[data-tco-onglet]')];
      const i = boutons.indexOf(document.activeElement);
      if (i < 0) return;
      const suivant = boutons[(i + (e.key === 'ArrowRight' ? 1 : boutons.length - 1)) % boutons.length];
      suivant.focus();
      tcoAllerOnglet(root, suivant.getAttribute('data-tco-onglet'));
    });
    const message = (el, texte, erreur) => {
      if (!el) return;
      el.textContent = texte;
      el.style.color = erreur ? 'var(--late)' : 'var(--ok)';
    };
    // Téléphone : les blocs de réglage (paramètres, seuils, catalogue) sont repliés sur leur titre ; l'analyse du parc reste ouverte.
    root.querySelectorAll('.tco-page .ui-section').forEach((sec, i) => {
      if (i < 2) return;
      const tete = sec.querySelector(':scope > .ui-section-tete');
      if (!tete) return;
      sec.classList.add('rappels-bloc');
      tete.setAttribute('role', 'button');
      tete.setAttribute('tabindex', '0');
      tete.setAttribute('aria-expanded', 'false');
      const basculer = () => { const ouvert = sec.classList.toggle('is-ouvert'); tete.setAttribute('aria-expanded', String(ouvert)); };
      tete.addEventListener('click', (e) => { if (e.target.closest('button,a,input,select,textarea,.ui-info-btn')) return; basculer(); });
      tete.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); basculer(); } });
    });

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
          let arretsFlotte = [];
          [interventionsFlotte, coutsFlotte, arretsFlotte] = await Promise.all([
            fetchToutesInterventionsFlotte(machineIds),
            fetchTousCoutsExploitationFlotte(machineIds),
            fetchArretsResolus(machineIds).catch(() => []),
          ]);
          const interventionsParMachine = grouperParMachine(interventionsFlotte);
          const coutsParMachine = grouperParMachine(coutsFlotte);
          flotte = calculerFlotteTco(UI.machines || [], interventionsParMachine, coutsParMachine, grouperParMachine(arretsFlotte));
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

    // Coût d'arrêt (panne-cout-arret.sql) : heures ouvrées de la société (fonction réservée au gérant) + coût horaire
    // par catégorie (même motif que les seuils : un update par catégorie MODIFIÉE).
    const champHeuresJour = root.querySelector('#tco-arret-heures-jour');
    if (champHeuresJour) {
      sb.from('companies').select('workday_hours').eq('id', UI.companyId).maybeSingle().then(({ data }) => {
        if (data && Number(data.workday_hours) > 0) { champHeuresJour.value = String(data.workday_hours).replace('.', ','); champHeuresJour.dataset.initial = String(Number(data.workday_hours)); }
        else champHeuresJour.dataset.initial = '8';
      });
    }
    root.querySelector('#tco-arret-inclus')?.addEventListener('change', (e) => {
      UI.tcoAvecArret = e.currentTarget.checked;
      try { localStorage.setItem('kalea.tcoAvecArret', UI.tcoAvecArret ? '1' : '0'); } catch (err) { /* sans stockage : réglage valable pour cette session */ }
      renderApp();
    });
    root.querySelector('#tco-save-arret')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const label = btn.querySelector('span');
      const msg = root.querySelector('#tco-arret-msg');
      const heures = nombreDepuisTexte(champHeuresJour ? champHeuresJour.value : '8');
      if (heures == null || heures < 1 || heures > 24) { message(msg, trad('Les heures d\'une journée doivent être comprises entre 1 et 24.'), true); return; }
      const lignes = [...root.querySelectorAll('[data-arret-ligne]')];
      const modifiees = lignes.map((ligne) => {
        const id = ligne.dataset.categorieId;
        const valeur = nombreDepuisTexte(ligne.querySelector('[data-arret-input]').value);
        const categorie = (UI.categories || []).find((c) => c.id === id);
        const ancien = categorie && categorie.downtime_hourly_cost != null ? Number(categorie.downtime_hourly_cost) : null;
        return { id, valeur, changed: !!categorie && ancien !== valeur };
      }).filter((l) => l.changed);
      const heuresChangees = champHeuresJour && Number(champHeuresJour.dataset.initial || 8) !== heures;
      if (!modifiees.length && !heuresChangees) { message(msg, trad('Aucun changement.'), false); return; }
      btn.disabled = true;
      if (label) label.textContent = trad('Enregistrement…');
      try {
        if (heuresChangees) {
          const { error } = await sb.rpc('definir_heures_ouvrees', { p_heures: heures });
          if (error) throw error;
          champHeuresJour.dataset.initial = String(heures);
        }
        const resultats = await Promise.all(modifiees.map(({ id, valeur }) =>
          sb.from('machine_categories').update({ downtime_hourly_cost: valeur }).eq('id', id)));
        const erreur = resultats.find((r) => r.error);
        if (erreur) throw erreur.error;
        modifiees.forEach(({ id, valeur }) => {
          const categorie = (UI.categories || []).find((c) => c.id === id);
          if (categorie) categorie.downtime_hourly_cost = valeur;
          (UI.machines || []).forEach((m) => { if (m.category && m.category.id === id) m.category.downtime_hourly_cost = valeur; });
        });
        showToast(trad('Coût d\'arrêt enregistré'));
        message(msg, trad('Enregistré.'), false);
        btn.disabled = false;
        if (label) label.textContent = trad('Enregistrer le coût d\'arrêt');
      } catch (err) {
        message(msg, trad('Erreur :') + ' ' + (err.message || err), true);
        btn.disabled = false;
        if (label) label.textContent = trad('Enregistrer le coût d\'arrêt');
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
// Croix de fermeture commune à toutes les fenêtres du Stock (en haut à droite,
// zone tactile de 44 px) : la même sortie évidente, au pouce, sur chaque fenêtre.
function ajouterCroixModale(overlay) {
  const modal = overlay.querySelector('.modal');
  if (!modal || modal.querySelector('.modal-croix')) return;
  modal.classList.add('a-croix');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'modal-croix';
  b.setAttribute('aria-label', trad('Fermer'));
  b.innerHTML = picto('fermer');
  b.addEventListener('click', () => overlay.remove());
  modal.prepend(b);
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
        <button type="button" class="ui-btn ui-btn-plein" id="pump-fermer">${trad('Compris')}</button>
      </div>
    </div>`;
  ajouterCroixModale(overlay);
  overlay.querySelector('#pump-fermer').addEventListener('click', () => overlay.remove());
}

// KPI : valeur totale (gérant seulement — même trust model que
// interventions.parts_cost, jamais de privilège de colonne côté RLS, voir
// le plan §2), alertes de seuil bas (UI.stockCounts, calculé au boot ET
// après chaque mouvement), mouvements du mois (rempli en asynchrone par
// VIEWS.stock.mount(), pas au boot — voir le commentaire sur la section
// Mouvements plus bas).
function stockKpiGridHtml() {
  const gerant = peutVoirValeursStock();
  const items = UI.stockItems || [];
  const valeurTotale = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.pump_unit_cost) || 0), 0);
  const nbAlertes = UI.stockCounts?.seuilBas || 0;
  const nbMagasins = (UI.warehouses || []).filter((w) => w.active !== false).length;
  return `
    <section class="ui-section">
      ${stockEyebrowToolbarHtml()}
      <div class="ui-grille is-3">
        <div class="ui-tuile stock-tuile-lien" role="button" tabindex="0" data-stock-aller="pieces">
          <span class="ui-tuile-etiquette">${trad('Valeur totale du stock')}</span>
          <span class="ui-tuile-valeur">${gerant ? `${texteAvecSeparateurs(valeurTotale)}<small>${esc(deviseCourte())}</small>` : '—'}</span>
          <span class="ui-tuile-note">${gerant ? trad('Valorisation PUMP, tous magasins') : trad('Réservé au gérant')}</span>
        </div>
        <div class="ui-tuile stock-tuile-lien ${nbAlertes ? 'is-retard' : 'is-ok'}" role="button" tabindex="0" data-stock-aller="pieces">
          <span class="ui-tuile-etiquette">${trad('Références en alerte')}</span>
          <span class="ui-tuile-valeur">${nbAlertes}</span>
          <span class="ui-tuile-note">${nbAlertes ? trad('Sous le seuil de sécurité') : trad('Aucune alerte')}</span>
        </div>
        <div class="ui-tuile stock-tuile-lien" role="button" tabindex="0" data-stock-aller="mouvements">
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
        <div class="ui-liste is-defilant" id="stock-magasins-liste">${liste}</div>
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
  const gerant = peutVoirValeursStock();
  const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(it.part_id));
  const seuil = it.reorder_point ?? piece?.default_reorder_point ?? null;
  const enAlerte = seuil != null && Number(it.quantity) <= Number(seuil);
  return `
    <div class="ui-ligne is-deux${enAlerte ? ' is-retard' : ''}">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone">${picto('boite')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(piece ? piece.designation : designationPiece(it.part_id))}${piece?.packaging ? `<span class="ui-tag">${esc(piece.packaging)}</span>` : ''}${enAlerte ? `<span class="ui-statut is-retard">${trad('Seuil bas')}</span>` : ''}</span>
          <span class="ui-ligne-sous">${esc(nomMagasin(it.warehouse_id))}${piece?.reference ? ' · ' + esc(piece.reference) : ''}${it.location ? ' · ' + esc(it.location) : ''}</span>
          ${SCHEMA.hasStockChamps && statutLigneStock(it) !== 'libere' ? `<span class="ui-statut is-retard">${esc(libelleStatutStock(statutLigneStock(it)))}</span>` : ''}
        </div>
      </div>
      <div class="ui-ligne-action">
        <div class="ui-chiffre is-droite">
          <span class="ui-chiffre-valeur">${texteAvecSeparateurs(it.quantity)}${SCHEMA.hasStockChamps && piece?.unit_of_measure && piece.unit_of_measure !== 'piece' ? ` <span class="ui-ligne-sous">${esc(libelleUniteMesure(piece.unit_of_measure))}</span>` : ''}</span>
          ${gerant ? `<span class="ui-ligne-sous">${texteAvecSeparateurs(Number(it.quantity) * Number(it.pump_unit_cost))} ${esc(deviseCourte())}</span>` : ''}
        </div>
        ${enAlerte && SCHEMA.hasStock && (peutGererMouvementsStock() || peutAcheter()) ? `<button type="button" class="ui-btn ui-btn-teinte" data-stock-commander="${esc(it.part_id)}" title="${esc(trad('Préparer un bon de commande pour cette pièce'))}">${picto('export')}<span>${trad('Commander')}</span></button>` : ''}
        ${SCHEMA.hasStockChamps && peutGererMouvementsStock() ? `<button type="button" class="ui-btn ui-btn-icone" data-stock-emplacement="${esc(it.part_id)}|${esc(it.warehouse_id)}" title="${esc(trad('Emplacement et statut'))}" aria-label="${esc(trad('Emplacement et statut'))}">${picto('crayon')}</button>` : ''}
      </div>
    </div>`;
}
function blocInventaireStockHtml() {
  const magasins = UI.warehouses || [];
  return `
    <section class="ui-section" id="stock-inventaire-section">
      ${teteSectionKit('boite', trad('État du stock'), trad('Quantités physiques en stock par référence et valorisation unitaire'),
        `<span class="ui-tag" id="stock-inventaire-badge"></span>${SCHEMA.hasStockChamps ? `<button type="button" class="ui-btn ui-btn-pastille" id="stock-etiquettes-ouvrir">${picto('qrcode')}<span>${trad('Étiquettes')}</span></button>` : ''}${SCHEMA.hasStockChamps && peutGererMouvementsStock() ? `<button type="button" class="ui-btn ui-btn-pastille" id="stock-emplacement-ajouter">${picto('plusCercle')}<span>${trad('Emplacement')}</span></button>` : ''}<button type="button" class="ui-btn ui-btn-pastille" id="stock-inventaire-export">${picto('export')}<span>${trad('Exporter en CSV')}</span></button>`)}
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
        peut ? `<button type="button" class="ui-btn ui-btn-pastille" id="stock-mouvements-importer">${picto('televerser')}<span>${trad('Importer des mouvements (CSV)')}</span></button><button type="button" class="ui-btn ui-btn-pastille" id="stock-mouvements-nouveau">${picto('plusCercle')}<span>${trad('Nouveau mouvement')}</span></button>` : '')}
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
      <select data-kit-ligne-piece aria-label="${esc(trad('Pièce'))}">${optionsPieces}</select>
      <input type="text" inputmode="decimal" data-kit-ligne-qte aria-label="${esc(trad('Quantité'))}" placeholder="${trad('Quantité')}">
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
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;">
        <input type="checkbox" id="kit-actif" ${kit.active !== false ? 'checked' : ''} style="width:16px;height:16px;">
        ${trad('Kit actif (proposable sur une fiche machine)')}
      </label>` : ''}
      <div style="margin-top:14px;">
        <div style="font-weight:600;font-size:13px;color:var(--ink);margin-bottom:8px;">${trad('Pièces du kit')}</div>
        <div id="kit-lignes" style="display:flex;flex-direction:column;gap:8px;">
          ${lignesExistantes.length ? lignesExistantes.map(() => ligneEditHtml()).join('') : ligneEditHtml()}
        </div>
        <button type="button" class="stock-btn-outline" id="kit-ligne-ajouter" style="margin-top:10px;">${picto('plusCercle')}<span>${trad('Ajouter une ligne')}</span></button>
      </div>
      <div class="ui-aide" id="kit-msg" role="status" aria-live="polite" style="margin-top:10px;"></div>
      <div class="modal-actions">
        <button type="button" class="ui-btn ui-btn-pastille" id="kit-fermer">${trad('Annuler')}</button>
        <button type="button" class="ui-btn ui-btn-plein" id="kit-enregistrer"><span>${trad('Enregistrer le kit')}</span></button>
      </div>
    </div>`;
  ajouterCroixModale(overlay);

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
    ? tR('Commander avant le {date}', { date: formatShortDate(couv.commanderAvantLe) }) + (couv.estimee ? ' ' + trad('(estimé)') : '')
    : libelleCouverturePiece(couv.state, couv.raisonInconnue);
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

// Fenêtre « Emplacement et statut » d'une ligne de stock (article × magasin). Sans argument : l'utilisateur
// choisit l'article et le magasin (utile pour fixer l'emplacement AVANT la première entrée). Écriture par la
// fonction serveur definir_emplacement_statut_stock (stock_items n'est jamais écrit directement).
function ouvrirModaleEmplacementStock(partIdInitial, magasinIdInitial) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const pieces = (UI.partsCatalog || []).slice().sort((a, b) => a.designation.localeCompare(b.designation));
  const magasins = (UI.warehouses || []).filter((w) => w.active !== false);
  const figee = !!(partIdInitial && magasinIdInitial);
  const ligneExistante = (partId, magasinId) => (UI.stockItems || []).find((it) => String(it.part_id) === String(partId) && String(it.warehouse_id) === String(magasinId));
  const optionsPieces = pieces.map((p) => `<option value="${esc(p.id)}">${esc(p.designation)}${p.reference ? ' (' + esc(p.reference) + ')' : ''}</option>`).join('');
  const optionsMagasins = magasins.map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('');
  overlay.innerHTML = `
    <div class="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="emplacement-titre">
      <h2 id="emplacement-titre">${trad('Emplacement et statut')}</h2>
      <div class="ui-champ-groupe">
        <label for="emplacement-piece"><strong>${trad('Article')}</strong></label>
        <div class="ui-select-wrap"><select id="emplacement-piece" class="ui-champ" ${figee ? 'disabled' : ''}>${optionsPieces}</select>${picto('chevronBas')}</div>
        <label for="emplacement-magasin"><strong>${trad('Magasin')}</strong></label>
        <div class="ui-select-wrap"><select id="emplacement-magasin" class="ui-champ" ${figee ? 'disabled' : ''}>${optionsMagasins}</select>${picto('chevronBas')}</div>
      </div>
      <div class="ui-champ-groupe">
        <label for="emplacement-texte"><strong>${trad('Emplacement')}</strong></label>
        <input id="emplacement-texte" class="ui-champ" maxlength="60" placeholder="${trad('Ex : Allée B, rayon 3, casier 12')}">
        <label for="emplacement-statut"><strong>${trad('Statut du stock')}</strong></label>
        <div class="ui-select-wrap">
          <select id="emplacement-statut" class="ui-champ">${STATUTS_STOCK.map(([code]) => `<option value="${code}">${esc(libelleStatutStock(code))}</option>`).join('')}</select>
          ${picto('chevronBas')}
        </div>
        <div class="ui-aide">${trad('En quarantaine ou en rebut, le stock de cette ligne ne peut plus être sorti ni transféré, et n\'est plus compté comme disponible pour les kits.')}</div>
      </div>
      <div id="emplacement-msg" role="status" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="ui-btn ui-btn-pastille" id="emplacement-fermer">${trad('Annuler')}</button>
        <button type="button" class="ui-btn ui-btn-plein" id="emplacement-go">${picto('coche')}<span>${trad('Enregistrer')}</span></button>
      </div>
    </div>`;
  ajouterCroixModale(overlay);
  const selPiece = overlay.querySelector('#emplacement-piece');
  const selMagasin = overlay.querySelector('#emplacement-magasin');
  const champTexte = overlay.querySelector('#emplacement-texte');
  const selStatut = overlay.querySelector('#emplacement-statut');
  const msg = overlay.querySelector('#emplacement-msg');
  if (partIdInitial) selPiece.value = partIdInitial;
  if (magasinIdInitial) selMagasin.value = magasinIdInitial;
  const remplirDepuisLigne = () => {
    const it = ligneExistante(selPiece.value, selMagasin.value);
    champTexte.value = it?.location || '';
    selStatut.value = statutLigneStock(it);
  };
  remplirDepuisLigne();
  selPiece.addEventListener('change', remplirDepuisLigne);
  selMagasin.addEventListener('change', remplirDepuisLigne);
  overlay.querySelector('#emplacement-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#emplacement-go').addEventListener('click', async () => {
    const bouton = overlay.querySelector('#emplacement-go');
    if (!selPiece.value || !selMagasin.value) { msg.textContent = trad('Choisis un article et un magasin.'); return; }
    bouton.disabled = true;
    msg.textContent = '';
    try {
      const { data, error } = await sb.rpc('definir_emplacement_statut_stock', {
        p_part_id: selPiece.value, p_warehouse_id: selMagasin.value, p_location: champTexte.value.trim(), p_status: selStatut.value,
      });
      if (error) throw error;
      const ligne = Array.isArray(data) ? data[0] : data;
      if (ligne) {
        const autres = (UI.stockItems || []).filter((it) => String(it.id) !== String(ligne.id));
        UI.stockItems = [...autres, ligne];
        UI.stockCounts = calculerStockCounts(UI.stockItems, UI.partsCatalog);
      }
      showToast(trad('Emplacement enregistré'));
      overlay.remove();
      renderApp();
    } catch (err) {
      msg.textContent = trad('Erreur :') + ' ' + (err.message || err);
      bouton.disabled = false;
    }
  });
}

// ── QR CODE D'UNE LIGNE DE STOCK (article × magasin) ─────────────────────────────────────────────────────
// Le QR contient un lien `<adresse de l'appli>?stock=<id article + id magasin, en base64 court>`. Il s'ouvre :
//   · avec l'appareil photo du téléphone → l'appli s'ouvre (connexion demandée si besoin) sur la fiche de la ligne ;
//   · avec le scanner de l'appli (Parc › Scanner un QR) → même fiche ;
//   · avec le scanner « Scanner une pièce » d'une intervention → la pièce est ajoutée à l'intervention.
// Un QR ne révèle rien à un inconnu : sans connexion à la bonne société, la fiche reste introuvable.
function urlBaseApp() {
  const l = window.location;
  // Dans l'appli Android (adresse locale « localhost » sans port, ou schéma capacitor/file), l'adresse de la page
  // n'est PAS joignable depuis un autre téléphone : on imprime l'adresse publique.
  const local = (l.hostname === 'localhost' || l.hostname === '127.0.0.1') && !l.port;
  if (local || /^(capacitor|file|ionic)/.test(l.protocol)) return 'https://kalea.pro/app.html';
  return l.origin + l.pathname;
}
// Les deux identifiants (2 × 16 octets) sont écrits en base64 « URL-safe » : 43 caractères au lieu de 73, donc un QR
// beaucoup moins dense (modules plus gros, lecture plus facile au téléphone, même sur une étiquette abîmée).
// Sans magasin (étiquette de CATALOGUE : référence même absente du stock) : un seul identifiant, 22 caractères.
function identifiantsVersCompact(partId, warehouseId) {
  const hex = (String(partId) + (warehouseId ? String(warehouseId) : '')).replace(/-/g, '');
  let binaire = '';
  for (let i = 0; i < hex.length / 2; i++) binaire += String.fromCharCode(parseInt(hex.substr(i * 2, 2), 16));
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function compactVersIdentifiants(texte) {
  try {
    const binaire = atob(String(texte).replace(/-/g, '+').replace(/_/g, '/'));
    if (binaire.length !== 32 && binaire.length !== 16) return null;
    let hex = '';
    for (let i = 0; i < binaire.length; i++) hex += binaire.charCodeAt(i).toString(16).padStart(2, '0');
    const uuid = (h) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    return { partId: uuid(hex.slice(0, 32)), warehouseId: binaire.length === 32 ? uuid(hex.slice(32)) : null };
  } catch (e) { return null; }
}
function urlQrLigneStock(partId, warehouseId) {
  return `${urlBaseApp()}?stock=${identifiantsVersCompact(partId, warehouseId)}`;
}
// Lit le texte d'un QR scanné ; renvoie { partId, warehouseId (null pour une étiquette de catalogue) } ou null si ce n'est pas une étiquette de stock KALEA.
function lireQrLigneStock(texte) {
  let valeur = null;
  try { valeur = new URL(texte).searchParams.get('stock'); } catch (e) { /* pas une URL */ }
  if (!valeur) return null;
  if (/^[A-Za-z0-9_-]{43}$/.test(valeur) || /^[A-Za-z0-9_-]{22}$/.test(valeur)) return compactVersIdentifiants(valeur);
  const m = /^([0-9a-f-]{36})\.([0-9a-f-]{36})$/i.exec(valeur); // forme longue (tolérée)
  return m ? { partId: m[1], warehouseId: m[2] } : null;
}
// SVG du QR (zone de silence de 2 modules comprise). Correction d'erreur « Q » (25 %) : une étiquette collée sur un
// rayon se salit et se plie ; c'est un bon compromis entre robustesse et densité (le lien est long).
async function qrSvgPourTexte(texte) {
  const lib = await loadQrCodeLib();
  const qr = lib(0, 'Q');
  qr.addData(texte);
  qr.make();
  const n = qr.getModuleCount();
  const marge = 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c + marge} ${r + marge}h1v1h-1z`;
    }
  }
  const t = n + marge * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// ── FICHE D'UNE RÉFÉRENCE DU CATALOGUE (QR d'une étiquette de catalogue, sans magasin) ───────────────────────
// Une seule ligne de stock → on ouvre directement sa fiche. Aucune ligne (référence épuisée ou plus stockée) ou
// plusieurs → petit récapitulatif : stock par magasin (chaque ligne ouvre sa fiche) et accès au mouvement de stock.
function ouvrirFichePieceStock(partId) {
  const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(partId));
  if (!piece) { showToast(trad('Article introuvable ou non accessible.')); return false; }
  const lignes = (UI.stockItems || []).filter((it) => String(it.part_id) === String(partId));
  if (lignes.length === 1) return ouvrirFicheLigneStock(partId, lignes[0].warehouse_id);
  const unite = piece.unit_of_measure && piece.unit_of_measure !== 'piece' ? ' ' + libelleUniteMesure(piece.unit_of_measure) : '';
  const total = lignes.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal export-modal fiche-ligne-stock" role="dialog" aria-modal="true" aria-labelledby="fiche-piece-titre">
      <h2 id="fiche-piece-titre">${esc(piece.designation)}</h2>
      <div class="ui-aide">${esc([piece.reference, piece.ean ? 'EAN ' + piece.ean : ''].filter(Boolean).join(' · '))}</div>
      <div class="fiche-stock-infos">
        <div class="ligne-info"><span>${trad('Stock total')}</span><strong>${esc(texteAvecSeparateurs(total))}${esc(unite)}</strong></div>
      </div>
      ${lignes.length
        ? `<div class="ui-champ-groupe"><strong>${trad('Choisis le magasin à ouvrir')}</strong>${lignes.map((it) => `<button type="button" class="ui-btn ui-btn-pastille" data-fiche-magasin="${esc(it.warehouse_id)}">${esc(nomMagasin(it.warehouse_id))}${it.location ? ' · ' + esc(it.location) : ''} — ${esc(texteAvecSeparateurs(it.quantity))}</button>`).join('')}</div>`
        : `<div class="ui-aide">${trad('Cette référence n\'est plus en stock : aucune ligne dans les magasins. Fais une entrée pour la remettre en stock.')}</div>`}
      <div class="modal-actions">
        <button type="button" class="ui-btn ui-btn-pastille" id="fiche-piece-fermer">${trad('Fermer')}</button>
        ${peutGererMouvementsStock() ? `<button type="button" class="ui-btn ui-btn-plein" id="fiche-piece-mouvement">${picto('plusCercle')}<span>${trad('Nouveau mouvement de stock')}</span></button>` : ''}
      </div>
    </div>`;
  ajouterCroixModale(overlay);
  overlay.querySelector('#fiche-piece-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelectorAll('[data-fiche-magasin]').forEach((b) => b.addEventListener('click', () => {
    const magasinId = b.getAttribute('data-fiche-magasin');
    overlay.remove();
    ouvrirFicheLigneStock(partId, magasinId);
  }));
  overlay.querySelector('#fiche-piece-mouvement')?.addEventListener('click', () => {
    overlay.remove();
    ouvrirNouveauMouvementModal();
    const sel = document.getElementById('mvt-piece');
    if (sel) sel.value = String(partId);
  });
  return true;
}

// ── FICHE D'UNE LIGNE DE STOCK (ouverte par le QR) : état de la ligne + sortie / entrée en deux gestes ──────
function ouvrirFicheLigneStock(partId, warehouseId) {
  if (!(SCHEMA.hasStock && planCouvreStock())) {
    showToast(trad('Le module Stock n\'est pas disponible sur cette offre.'));
    return false;
  }
  if (!warehouseId) return ouvrirFichePieceStock(partId);
  const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(partId));
  const magasin = (UI.warehouses || []).find((w) => String(w.id) === String(warehouseId));
  if (!piece || !magasin) {
    // Silencieux et sans erreur technique : un id inconnu ou d'une AUTRE société est simplement « introuvable ».
    showToast(trad('Article ou magasin introuvable ou non accessible.'));
    return false;
  }
  const trouverLigne = () => (UI.stockItems || []).find((it) => String(it.part_id) === String(partId) && String(it.warehouse_id) === String(warehouseId));
  const ligne = trouverLigne();
  const peut = peutGererMouvementsStock();
  const gerant = peutVoirValeursStock();
  const statut = statutLigneStock(ligne);
  const unite = piece.unit_of_measure && piece.unit_of_measure !== 'piece' ? libelleUniteMesure(piece.unit_of_measure) : '';
  const ailleurs = (UI.stockItems || [])
    .filter((it) => String(it.part_id) === String(partId) && String(it.warehouse_id) !== String(warehouseId) && Number(it.quantity) > 0)
    .map((it) => `${esc(nomMagasin(it.warehouse_id))} : ${esc(texteAvecSeparateurs(it.quantity))}`)
    .join(' · ');
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const sortieBloquee = statut !== 'libere';
  overlay.innerHTML = `
    <div class="modal export-modal fiche-ligne-stock" role="dialog" aria-modal="true" aria-labelledby="fiche-stock-titre">
      <h2 id="fiche-stock-titre">${esc(piece.designation)}</h2>
      <div class="ui-aide">${esc([piece.reference, piece.ean ? 'EAN ' + piece.ean : ''].filter(Boolean).join(' · '))}</div>
      <div class="fiche-stock-infos">
        <div class="ligne-info"><span>${trad('Magasin')}</span><strong>${esc(magasin.name)}</strong></div>
        <div class="ligne-info"><span>${trad('Emplacement')}</span><strong>${ligne?.location ? esc(ligne.location) : '—'}</strong></div>
        <div class="ligne-info"><span>${trad('Statut du stock')}</span><strong>${esc(libelleStatutStock(statut))}</strong></div>
        <div class="ligne-info"><span>${trad('En stock')}</span><strong>${esc(texteAvecSeparateurs(ligne ? ligne.quantity : 0))}${unite ? ' ' + esc(unite) : ''}</strong></div>
        ${gerant && ligne ? `<div class="ligne-info"><span>${trad('Coût moyen (PUMP)')}</span><strong>${esc(texteAvecSeparateurs(ligne.pump_unit_cost))} ${esc(deviseCourte())}</strong></div>` : ''}
        ${ailleurs ? `<div class="ligne-info"><span>${trad('Ailleurs')}</span><strong>${ailleurs}</strong></div>` : ''}
      </div>
      ${peut ? `
      <div class="ui-champ-groupe">
        <strong>${trad('Mouvement rapide')}</strong>
        <label class="ui-case"><input type="radio" name="fiche-type" value="sortie" ${sortieBloquee ? 'disabled' : 'checked'}> ${trad('Sortie')}</label>
        <label class="ui-case"><input type="radio" name="fiche-type" value="entree" ${sortieBloquee ? 'checked' : ''}> ${trad('Entrée')}</label>
        ${sortieBloquee ? `<div class="ui-aide">${trad('Cette ligne n\'est pas libérée : la sortie est impossible.')}</div>` : ''}
        <label for="fiche-quantite">${trad('Quantité')}</label>
        <input id="fiche-quantite" class="ui-champ" type="number" min="0" step="any" value="1" inputmode="decimal">
        <div id="fiche-cout-bloc" ${sortieBloquee ? '' : 'hidden'}>
          <label for="fiche-cout">${trad('Coût unitaire')} (${esc(deviseCourte())})</label>
          <input id="fiche-cout" class="ui-champ" type="text" inputmode="decimal" value="${esc(texteAvecSeparateurs(piece.unit_price))}">
        </div>
        <label for="fiche-motif">${trad('Motif (optionnel)')}</label>
        <input id="fiche-motif" class="ui-champ" maxlength="120">
      </div>` : ''}
      <div id="fiche-stock-msg" role="status" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="ui-btn ui-btn-pastille" id="fiche-stock-fermer">${trad('Fermer')}</button>
        ${peut && SCHEMA.hasStockChamps ? `<button type="button" class="ui-btn ui-btn-pastille" id="fiche-stock-emplacement">${picto('crayon')}<span>${trad('Emplacement et statut')}</span></button>` : ''}
        ${peut ? `<button type="button" class="ui-btn ui-btn-plein" id="fiche-stock-valider">${picto('coche')}<span>${trad('Valider')}</span></button>` : ''}
      </div>
    </div>`;
  ajouterCroixModale(overlay);
  const msg = overlay.querySelector('#fiche-stock-msg');
  overlay.querySelector('#fiche-stock-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#fiche-stock-emplacement')?.addEventListener('click', () => { overlay.remove(); ouvrirModaleEmplacementStock(partId, warehouseId); });
  const typeChoisi = () => overlay.querySelector('input[name="fiche-type"]:checked')?.value || 'sortie';
  overlay.querySelectorAll('input[name="fiche-type"]').forEach((r) => r.addEventListener('change', () => {
    const blocCout = overlay.querySelector('#fiche-cout-bloc');
    if (blocCout) blocCout.hidden = typeChoisi() !== 'entree';
  }));
  overlay.querySelector('#fiche-stock-valider')?.addEventListener('click', async () => {
    const bouton = overlay.querySelector('#fiche-stock-valider');
    const type = typeChoisi();
    const qte = nombreDepuisTexte(overlay.querySelector('#fiche-quantite').value);
    const cout = type === 'entree' ? nombreDepuisTexte(overlay.querySelector('#fiche-cout').value) : null;
    if (!qte || qte <= 0) { msg.textContent = trad('Quantité invalide.'); return; }
    if (type === 'entree' && (cout == null || cout < 0)) { msg.textContent = trad('Coût unitaire requis pour une entrée.'); return; }
    bouton.disabled = true;
    msg.textContent = trad('Enregistrement…');
    try {
      const { error } = await sb.rpc('enregistrer_mouvement_stock', {
        p_type: type, p_part_id: partId, p_warehouse_id: warehouseId, p_destination_warehouse_id: null,
        p_quantity: qte, p_unit_cost: cout, p_intervention_id: null,
        p_reason: overlay.querySelector('#fiche-motif').value.trim() || null,
      });
      if (error) throw error;
      const { data: soldes } = await sb.from('stock_items')
        .select('id, part_id, warehouse_id, quantity, pump_unit_cost, reorder_point, updated_at' + colonnesLigneStockEnPlus())
        .eq('company_id', UI.companyId);
      UI.stockItems = soldes || [];
      UI.stockCounts = calculerStockCounts(UI.stockItems, UI.partsCatalog);
      showToast(trad('Mouvement enregistré'));
      overlay.remove();
      renderApp();
    } catch (err) {
      msg.textContent = trad('Erreur :') + ' ' + (err.message || err);
      bouton.disabled = false;
    }
  });
  return true;
}

// ── ÉTIQUETTES DE STOCK : une par ligne de stock (article × magasin × emplacement) ──────────────────────────
// Deux formats, choisis à l'impression :
//   · feuille A4 d'étiquettes autocollantes, grille 3 × 8 (70 × 37 mm, 24 par feuille — format très courant) ;
//   · étiquette unitaire 62 × 29 mm (imprimante d'étiquettes).
// Le document est construit à part (iframe masquée) : son @page ne touche jamais à l'impression du reste de l'appli.
// La zone « qr » porte le QR code de la ligne (voir qrSvgPourTexte / urlQrLigneStock).
const FORMATS_ETIQUETTE = {
  a4: { libelle: 'Feuille A4 — 24 étiquettes (3 × 8, 70 × 37 mm)', l: 70, h: 37, colonnes: 3, rangees: 8 },
  unitaire: { libelle: 'Étiquette unitaire (62 × 29 mm)', l: 62, h: 29 },
};

function htmlUneEtiquette(it, qrSvg) {
  const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(it.part_id));
  const designation = piece ? piece.designation : designationPiece(it.part_id);
  const unite = piece?.unit_of_measure && piece.unit_of_measure !== 'piece' ? libelleUniteMesure(piece.unit_of_measure) : '';
  const lieu = it.warehouse_id ? [nomMagasin(it.warehouse_id), it.location].filter(Boolean).join(' · ') : '';
  return `<div class="et"><div class="txt">`
    + `<div class="des">${esc(designation)}</div>`
    + (piece?.reference ? `<div class="ref">${esc(piece.reference)}</div>` : '')
    + (piece?.ean ? `<div class="ean">EAN ${esc(piece.ean)}</div>` : '')
    + (lieu ? `<div class="lieu">${esc(lieu)}</div>` : '')
    + (unite ? `<div class="unite">${esc(unite)}</div>` : '')
    + `</div><div class="qr">${qrSvg || ''}</div></div>`;
}

// lignes : lignes de stock à imprimer (déjà répétées selon le nombre d'exemplaires) ; premiere : n° (1…24) de la
// première case libre de la 1re feuille A4 (réutiliser une feuille entamée).
function documentEtiquettes(lignes, formatCle, premiere, qrParCle) {
  const qrDe = (it) => (qrParCle || {})[`${it.part_id}.${it.warehouse_id || ''}`];
  const f = FORMATS_ETIQUETTE[formatCle];
  const a4 = formatCle === 'a4';
  const css = `
    @page { size: ${a4 ? 'A4' : `${f.l}mm ${f.h}mm`}; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
    .feuille { width: 210mm; height: 297mm; display: grid; grid-template-columns: repeat(${f.colonnes || 1}, ${f.l}mm); grid-template-rows: repeat(${f.rangees || 1}, ${f.h}mm); break-after: page; page-break-after: always; }
    .feuille:last-child { break-after: auto; page-break-after: auto; }
    .page { width: ${f.l}mm; height: ${f.h}mm; break-after: page; page-break-after: always; overflow: hidden; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    .et { width: ${f.l}mm; height: ${f.h}mm; padding: ${a4 ? 3 : 2}mm; display: flex; gap: ${a4 ? 2 : 1.5}mm; overflow: hidden; }
    .vide { width: ${f.l}mm; height: ${f.h}mm; }
    .txt { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: .6mm; }
    .des { font-weight: 700; font-size: ${a4 ? 9.5 : 8}pt; line-height: 1.12; max-height: 2.3em; overflow: hidden; }
    .ref { font-family: "Courier New", monospace; font-weight: 700; font-size: ${a4 ? 8.5 : 7.5}pt; }
    .ean { font-size: ${a4 ? 7 : 6.5}pt; }
    .lieu { font-size: ${a4 ? 8 : 7}pt; font-weight: 700; margin-top: auto; line-height: 1.12; max-height: 2.3em; overflow: hidden; }
    .unite { font-size: ${a4 ? 7 : 6.5}pt; }
    .qr { flex: 0 0 ${a4 ? 22 : 17}mm; width: ${a4 ? 22 : 17}mm; height: ${a4 ? 22 : 17}mm; align-self: center; }
    .qr svg, .qr img { width: 100%; height: 100%; display: block; }
  `;
  let corps = '';
  if (a4) {
    const cases = [...Array(Math.max(0, (premiere || 1) - 1)).fill(null), ...lignes];
    const parFeuille = f.colonnes * f.rangees;
    for (let i = 0; i < cases.length; i += parFeuille) {
      corps += `<div class="feuille">${cases.slice(i, i + parFeuille).map((c) => (c ? htmlUneEtiquette(c, qrDe(c)) : '<div class="vide"></div>')).join('')}</div>`;
    }
  } else {
    corps = lignes.map((c) => `<div class="page">${htmlUneEtiquette(c, qrDe(c))}</div>`).join('');
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(trad('Étiquettes de stock'))}</title><style>${css}</style></head><body>${corps}</body></html>`;
}

// Imprime un document HTML complet via une iframe masquée (retirée après l'impression).
function imprimerDocumentHtml(html) {
  const cadre = document.createElement('iframe');
  cadre.setAttribute('aria-hidden', 'true');
  cadre.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(cadre);
  const doc = cadre.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  const lancer = () => {
    try { cadre.contentWindow.focus(); cadre.contentWindow.print(); } catch (e) { /* impression indisponible */ }
    setTimeout(() => cadre.remove(), 60000);
  };
  // laisse le temps aux images éventuelles (QR) de se charger avant l'impression
  setTimeout(lancer, 350);
}

// Options : { source: 'stock' | 'catalogue', pieceId } — « catalogue » = une étiquette par RÉFÉRENCE du catalogue, même
// celles qui ne sont plus en stock (le QR ne porte alors que l'article : il ouvre sa fiche de stock, vide ou non).
function ouvrirModaleEtiquettes(options = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const magasins = (UI.warehouses || []).filter((w) => w.active !== false);
  const pieceDe = new Map((UI.partsCatalog || []).map((p) => [String(p.id), p]));
  const lignesStock = (UI.stockItems || []).slice().sort((a, b) =>
    nomMagasin(a.warehouse_id).localeCompare(nomMagasin(b.warehouse_id))
    || String(a.location || '').localeCompare(String(b.location || ''))
    || designationPiece(a.part_id).localeCompare(designationPiece(b.part_id)));
  const lignesCatalogue = (UI.partsCatalog || []).slice()
    .sort((a, b) => String(a.designation).localeCompare(String(b.designation)))
    .map((p) => ({ part_id: p.id, warehouse_id: null, location: null }));
  let source = options.source === 'catalogue' ? 'catalogue' : 'stock';
  const cle = (it) => `${it.part_id}.${it.warehouse_id || ''}`;
  let selection = new Set();
  const selectionInitiale = () => {
    selection = new Set();
    if (source === 'stock') lignesStock.forEach((it) => selection.add(cle(it)));
    else if (options.pieceId) selection.add(`${options.pieceId}.`);
  };
  selectionInitiale();
  overlay.innerHTML = `
    <div class="modal export-modal etiquettes-modal" role="dialog" aria-modal="true" aria-labelledby="etiquettes-titre">
      <h2 id="etiquettes-titre">${trad('Imprimer des étiquettes')}</h2>
      <div class="etiquettes-haut">
        <div class="ui-champ-groupe">
          <strong>${trad('Format')}</strong>
          ${Object.entries(FORMATS_ETIQUETTE).map(([cleFormat, f], i) => `<label class="ui-case"><input type="radio" name="etiquettes-format" value="${cleFormat}" ${i === 0 ? 'checked' : ''}> ${esc(trad(f.libelle))}</label>`).join('')}
        </div>
        <div class="ui-champ-groupe">
          <strong>${trad('Étiqueter')}</strong>
          <label class="ui-case"><input type="radio" name="etiquettes-source" value="stock" ${source === 'stock' ? 'checked' : ''}> ${trad('Des lignes de stock (article × magasin × emplacement)')}</label>
          <label class="ui-case"><input type="radio" name="etiquettes-source" value="catalogue" ${source === 'catalogue' ? 'checked' : ''}> ${trad('Des références du catalogue — même celles qui ne sont plus en stock')}</label>
        </div>
      </div>
      <div class="etiquettes-nombres">
        <div id="etiquettes-debut-bloc">
          <label for="etiquettes-debut">${trad('Commencer à l\'étiquette n°')}</label>
          <input id="etiquettes-debut" class="ui-champ" type="number" min="1" max="24" value="1" inputmode="numeric">
        </div>
        <div>
          <label for="etiquettes-copies">${trad('Exemplaires par ligne')}</label>
          <input id="etiquettes-copies" class="ui-champ" type="number" min="1" max="10" value="1" inputmode="numeric">
        </div>
      </div>
      <div class="ui-champ-groupe">
        <strong id="etiquettes-titre-liste"></strong>
        <div class="etiquettes-filtres">
          <input id="etiquettes-recherche" class="ui-champ" aria-label="${esc(trad('Rechercher une pièce'))}" placeholder="${trad('Rechercher par désignation, référence, EAN…')}">
          <div class="ui-select-wrap" id="etiquettes-magasin-bloc">
            <select id="etiquettes-magasin" class="ui-champ" aria-label="${esc(trad('Magasin'))}">
              <option value="">${trad('Tous les magasins')}</option>
              ${magasins.map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}
            </select>
            ${picto('chevronBas')}
          </div>
        </div>
        <label class="ui-case"><input type="checkbox" id="etiquettes-tout"> <span id="etiquettes-compte"></span></label>
        <div class="etiquettes-liste" id="etiquettes-liste"></div>
      </div>
      <div id="etiquettes-msg" role="status" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="ui-btn ui-btn-pastille" id="etiquettes-fermer">${trad('Annuler')}</button>
        <button type="button" class="ui-btn ui-btn-plein" id="etiquettes-go">${picto('export')}<span>${trad('Imprimer')}</span></button>
      </div>
    </div>`;
  ajouterCroixModale(overlay);
  const liste = overlay.querySelector('#etiquettes-liste');
  const msg = overlay.querySelector('#etiquettes-msg');
  const caseTout = overlay.querySelector('#etiquettes-tout');
  const compte = overlay.querySelector('#etiquettes-compte');
  const visibles = () => {
    const mag = overlay.querySelector('#etiquettes-magasin').value;
    const terme = overlay.querySelector('#etiquettes-recherche').value.trim().toLowerCase();
    const base = source === 'catalogue' ? lignesCatalogue : lignesStock.filter((it) => !mag || String(it.warehouse_id) === String(mag));
    if (!terme) return base;
    return base.filter((it) => {
      const p = pieceDe.get(String(it.part_id));
      const texte = [p?.designation, p?.reference, p?.ean, it.warehouse_id ? nomMagasin(it.warehouse_id) : '', it.location].filter(Boolean).join(' ').toLowerCase();
      return texte.includes(terme);
    });
  };
  const coches = () => visibles().filter((it) => selection.has(cle(it)));
  const majCompte = () => {
    const n = coches().length;
    compte.textContent = source === 'catalogue' ? tR('{n} référence(s) sélectionnée(s)', { n }) : tR('{n} ligne(s) sélectionnée(s)', { n });
    const nbVisibles = visibles().length;
    caseTout.checked = nbVisibles > 0 && n === nbVisibles;
  };
  const libelleLigne = (it) => {
    const p = pieceDe.get(String(it.part_id));
    if (source === 'catalogue') return `<span>${esc(p ? p.designation : designationPiece(it.part_id))} <small>— ${esc(p?.reference || trad('Sans référence'))}</small></span>`;
    return `<span>${esc(designationPiece(it.part_id))} <small>— ${esc([nomMagasin(it.warehouse_id), it.location].filter(Boolean).join(' · '))}</small></span>`;
  };
  const rendre = () => {
    overlay.querySelector('#etiquettes-magasin-bloc').hidden = source === 'catalogue';
    overlay.querySelector('#etiquettes-titre-liste').textContent = source === 'catalogue' ? trad('Références du catalogue à étiqueter') : trad('Lignes de stock à étiqueter');
    const lignes = visibles();
    liste.innerHTML = lignes.length
      ? lignes.map((it) => `<label class="ui-case"><input type="checkbox" data-cle="${esc(cle(it))}" ${selection.has(cle(it)) ? 'checked' : ''}> ${libelleLigne(it)}</label>`).join('')
      : `<div class="ui-aide">${source === 'catalogue' ? trad('Aucune référence dans le catalogue.') : trad('Aucune ligne de stock.')}</div>`;
    liste.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', () => {
      const k = c.getAttribute('data-cle');
      if (c.checked) selection.add(k); else selection.delete(k);
      majCompte();
    }));
    majCompte();
  };
  rendre();
  overlay.querySelector('#etiquettes-magasin').addEventListener('change', rendre);
  overlay.querySelector('#etiquettes-recherche').addEventListener('input', rendre);
  overlay.querySelectorAll('input[name="etiquettes-source"]').forEach((r) => r.addEventListener('change', () => {
    source = overlay.querySelector('input[name="etiquettes-source"]:checked').value;
    selectionInitiale();
    overlay.querySelector('#etiquettes-recherche').value = '';
    rendre();
  }));
  caseTout.addEventListener('change', () => {
    visibles().forEach((it) => { if (caseTout.checked) selection.add(cle(it)); else selection.delete(cle(it)); });
    rendre();
  });
  const formatChoisi = () => overlay.querySelector('input[name="etiquettes-format"]:checked').value;
  overlay.querySelectorAll('input[name="etiquettes-format"]').forEach((r) => r.addEventListener('change', () => {
    overlay.querySelector('#etiquettes-debut-bloc').hidden = formatChoisi() !== 'a4';
  }));
  overlay.querySelector('#etiquettes-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#etiquettes-go').addEventListener('click', async () => {
    const boutonGo = overlay.querySelector('#etiquettes-go');
    const choisies = coches();
    if (!choisies.length) { msg.textContent = source === 'catalogue' ? trad('Coche au moins une référence.') : trad('Coche au moins une ligne.'); return; }
    const copies = Math.max(1, Math.min(10, Math.round(Number(overlay.querySelector('#etiquettes-copies').value) || 1)));
    const debut = Math.max(1, Math.min(24, Math.round(Number(overlay.querySelector('#etiquettes-debut').value) || 1)));
    const lignes = choisies.flatMap((it) => Array(copies).fill(it));
    // Un QR par ligne distincte (les exemplaires réutilisent le même). Si le générateur est indisponible, les
    // étiquettes s'impriment quand même, sans QR : jamais un blocage.
    boutonGo.disabled = true;
    msg.textContent = trad('Préparation des étiquettes…');
    const qrParCle = {};
    try {
      for (const it of choisies) {
        const k = cle(it);
        if (!qrParCle[k]) qrParCle[k] = await qrSvgPourTexte(urlQrLigneStock(it.part_id, it.warehouse_id));
      }
    } catch (err) {
      msg.textContent = trad('QR code indisponible : les étiquettes sont imprimées sans QR.');
    }
    imprimerDocumentHtml(documentEtiquettes(lignes, formatChoisi(), formatChoisi() === 'a4' ? debut : 1, qrParCle));
    overlay.remove();
  });
}

function exporterInventaireStockCsv() {
  const gerant = peutVoirValeursStock();
  const header = gerant
    ? [trad('Référence'), trad('Désignation'), trad('Magasin'), trad('Quantité'), trad('Coût PUMP'), trad('Valeur')]
    : [trad('Référence'), trad('Désignation'), trad('Magasin'), trad('Quantité')];
  if (SCHEMA.hasStockChamps) header.push(trad('EAN'), trad('Unité de mesure'), trad('Emplacement'), trad('Statut'));
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const items = (UI.stockItems || []).slice().sort((a, b) => designationPiece(a.part_id).localeCompare(designationPiece(b.part_id)));
  const rows = items.map((it) => {
    const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(it.part_id));
    const base = [piece?.reference || '', piece?.designation || designationPiece(it.part_id), nomMagasin(it.warehouse_id), it.quantity];
    const ligne = gerant ? [...base, it.pump_unit_cost, Number(it.quantity) * Number(it.pump_unit_cost)] : base;
    if (SCHEMA.hasStockChamps) {
      ligne.push(piece?.ean || '', libelleUniteMesure(piece?.unit_of_measure || 'piece'), it.location || '', libelleStatutStock(statutLigneStock(it)));
    }
    return ligne;
  });
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  telechargerCsv(`stock_${todayIso()}.csv`, csv);
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
      <div class="mvt-types" role="radiogroup" aria-label="${esc(trad('Type de mouvement'))}" style="--n:${gerant ? 4 : 3};">
        <label class="mvt-type"><input type="radio" name="mvt-type" value="entree" checked><span>${trad('Entrée')}</span></label>
        <label class="mvt-type"><input type="radio" name="mvt-type" value="sortie"><span>${trad('Sortie')}</span></label>
        <label class="mvt-type"><input type="radio" name="mvt-type" value="transfert"><span>${trad('Transfert')}</span></label>
        ${gerant ? `<label class="mvt-type"><input type="radio" name="mvt-type" value="ajustement"><span>${trad('Ajustement')}</span></label>` : ''}
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
        <button type="button" class="ui-btn ui-btn-pastille" id="mvt-fermer">${trad('Annuler')}</button>
        <button type="button" class="ui-btn ui-btn-plein" id="mvt-valider"><span>${trad('Enregistrer le mouvement')}</span></button>
      </div>
    </div>`;
  ajouterCroixModale(overlay);

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
        .select('id, part_id, warehouse_id, quantity, pump_unit_cost, reorder_point, updated_at' + colonnesLigneStockEnPlus())
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
  telechargerCsv('modele_mouvements_stock.csv', modeleCsvMouvements());
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
          <select id="import-mvt-magasin" aria-label="${esc(trad('Magasin'))}">
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
        <button type="button" class="ui-btn ui-btn-pastille" id="import-mvt-fermer">${trad('Annuler')}</button>
        <button type="button" class="ui-btn ui-btn-plein" id="import-mvt-go" disabled>${picto('coche')}<span>${trad('Importer')}</span></button>
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
        .select('id, part_id, warehouse_id, quantity, pump_unit_cost, reorder_point, updated_at' + colonnesLigneStockEnPlus())
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

// ═══════════════════════ INVENTAIRE PHYSIQUE (comptage du stock réel) ═══════════════════════
// SQL : kalea-serveur/migrations/stock-inventaire.sql (tables stock_counts / stock_count_lines + 5 fonctions).
// Principe : une session par magasin (zone en option) fige le stock théorique ; on compte ; le gérant valide ; chaque
// écart devient un ajustement de stock (moteur enregistrer_mouvement_stock). Les lignes ne se lisent QUE par la
// fonction lignes_inventaire() : en mode « aveugle », elle masque le théorique (NULL) à tous sauf au gérant.
function inventairePhysiquePossible() {
  return !!(SCHEMA.hasStockInventaire && SCHEMA.hasStock && typeof planCouvreStock === 'function' && planCouvreStock());
}
const STATUTS_INVENTAIRE = { en_cours: ['En cours', 'is-bientot'], valide: ['Validé', 'is-ok'], annule: ['Annulé', ''] };
function statutInventaireHtml(c) {
  const [texte, classe] = STATUTS_INVENTAIRE[c.status] || STATUTS_INVENTAIRE.en_cours;
  return `<span class="ui-statut ${classe}">${esc(trad(texte))}</span>`;
}
function titreInventaire(c) {
  return tR('Inventaire n°{n}', { n: c.numero }) + (c.label ? ' — ' + c.label : '');
}
function sousTitreInventaire(c) {
  return [nomMagasin(c.warehouse_id), c.zone ? tR('zone « {z} »', { z: c.zone }) : '', c.blind ? trad('en aveugle') : '', formatDateHeureMouvement(c.opened_at)]
    .filter(Boolean).join(' · ');
}
async function chargerInventairesPhysiques() {
  const { data, error } = await sb.from('stock_counts').select('*').eq('company_id', UI.companyId)
    .order('opened_at', { ascending: false }).limit(50);
  if (error) throw error;
  UI.inventairesPhysiques = data || [];
  return UI.inventairesPhysiques;
}
// Après une validation : les ajustements ont changé les quantités, on relit les soldes comme après un mouvement.
async function rechargerSoldesStock() {
  const { data: soldes } = await sb.from('stock_items')
    .select('id, part_id, warehouse_id, quantity, pump_unit_cost, reorder_point, updated_at' + colonnesLigneStockEnPlus())
    .eq('company_id', UI.companyId);
  UI.stockItems = soldes || [];
  UI.stockCounts = calculerStockCounts(UI.stockItems, UI.partsCatalog);
}

function ligneInventairePhysiqueHtml(c) {
  const bilan = c.status === 'valide'
    ? tR('{n} ligne(s) comptée(s) · {e} écart(s)', { n: c.lines_counted ?? 0, e: c.lines_with_variation ?? 0 })
      + (peutVoirValeursStock() && c.lines_with_variation ? ` · ${texteAvecSeparateurs(c.net_value || 0)} ${deviseCourte()}` : '')
    : '';
  const reprise = c.status === 'en_cours' && peutGererMouvementsStock();
  return `
    <div class="ui-ligne is-deux">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone">${picto('coche')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(titreInventaire(c))}${statutInventaireHtml(c)}</span>
          <span class="ui-ligne-sous">${esc(sousTitreInventaire(c))}${bilan ? ' · ' + esc(bilan) : ''}</span>
        </div>
      </div>
      <div class="ui-ligne-action">
        <button type="button" class="ui-btn ui-btn-pastille" data-invphys-ouvrir="${esc(c.id)}">${reprise ? trad('Reprendre') : trad('Consulter')}</button>
      </div>
    </div>`;
}
function blocInventairePhysiqueHtml() {
  const peut = peutGererMouvementsStock();
  return `
    <section class="ui-section" id="stock-invphys-section">
      ${teteSectionKit('coche', trad('Inventaire'), trad('Compter le stock réel, voir les écarts et les régulariser'),
        peut ? `<button type="button" class="ui-btn ui-btn-pastille" id="invphys-nouveau">${picto('plusCercle')}<span>${trad('Nouvel inventaire')}</span></button>` : '')}
      <div class="ui-section-corps">
        <div class="ui-liste is-defilant" id="invphys-liste"><div class="ui-aide">${trad('Chargement…')}</div></div>
      </div>
    </section>`;
}

// ── Fenêtre « Nouvel inventaire » ──
function ouvrirNouvelInventaire(surCree) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const magasins = (UI.warehouses || []).filter((w) => w.active !== false);
  overlay.innerHTML = `
    <div class="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="invnew-titre">
      <h2 id="invnew-titre">${trad('Nouvel inventaire')}</h2>
      <div class="ui-champ-groupe">
        <label for="invnew-magasin"><strong>${trad('Magasin')}</strong></label>
        <div class="ui-select-wrap"><select id="invnew-magasin" class="ui-champ">${magasins.map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select>${picto('chevronBas')}</div>
        <label for="invnew-label"><strong>${trad('Nom (optionnel)')}</strong></label>
        <input id="invnew-label" class="ui-champ" maxlength="80" placeholder="${trad('Ex : Inventaire annuel')}">
        <label for="invnew-zone"><strong>${trad('Zone (optionnel)')}</strong></label>
        <input id="invnew-zone" class="ui-champ" maxlength="60" placeholder="${trad('Ex : A-')}">
        <div class="ui-aide">${trad('Une zone limite l\'inventaire aux emplacements qui commencent par ce texte. Laisse vide pour compter tout le magasin.')}</div>
        <label class="ui-case"><input type="checkbox" id="invnew-aveugle"> ${trad('Comptage en aveugle (les quantités théoriques sont cachées à ceux qui comptent)')}</label>
      </div>
      <div id="invnew-msg" role="status" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="ui-btn ui-btn-pastille" id="invnew-fermer">${trad('Annuler')}</button>
        <button type="button" class="ui-btn ui-btn-plein" id="invnew-go">${picto('coche')}<span>${trad('Ouvrir l\'inventaire')}</span></button>
      </div>
    </div>`;
  ajouterCroixModale(overlay);
  overlay.querySelector('#invnew-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#invnew-go').addEventListener('click', async () => {
    const bouton = overlay.querySelector('#invnew-go');
    const msg = overlay.querySelector('#invnew-msg');
    const magasinId = overlay.querySelector('#invnew-magasin').value;
    if (!magasinId) { msg.textContent = trad('Choisis un magasin.'); return; }
    bouton.disabled = true;
    msg.textContent = '';
    try {
      const { data, error } = await sb.rpc('ouvrir_inventaire', {
        p_warehouse_id: magasinId,
        p_label: overlay.querySelector('#invnew-label').value.trim(),
        p_blind: overlay.querySelector('#invnew-aveugle').checked,
        p_zone: overlay.querySelector('#invnew-zone').value.trim(),
      });
      if (error) throw error;
      const c = Array.isArray(data) ? data[0] : data;
      UI.inventairesPhysiques = [c, ...(UI.inventairesPhysiques || [])];
      overlay.remove();
      surCree(c);
    } catch (err) {
      msg.textContent = trad('Erreur :') + ' ' + (err.message || err);
      bouton.disabled = false;
    }
  });
}

// ── Export CSV d'une session ──
function exporterSessionInventaireCsv(c, lignes) {
  const gerant = peutVoirValeursStock();
  const entete = [trad('Référence'), trad('Désignation'), trad('Emplacement'), trad('Unité de mesure'), trad('Quantité théorique'), trad('Quantité comptée'), trad('Écart')];
  if (c.status === 'valide') entete.push(trad('Écart appliqué'));
  if (gerant) entete.push(trad('Coût PUMP'), trad('Valeur de l\'écart'));
  const echapper = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = lignes.map((l) => {
    const theo = l.theoretical_at_count ?? l.expected_qty;
    const ecart = l.variation_qty != null ? l.variation_qty : (l.counted_qty != null && theo != null ? Number(l.counted_qty) - Number(theo) : '');
    const r = [l.reference || '', l.designation || '', l.location || '', libelleUniteMesure(l.unit_of_measure || 'piece'), theo ?? '', l.counted_qty ?? '', ecart];
    if (c.status === 'valide') r.push(l.applied_qty ?? '');
    if (gerant) r.push(l.pump_unit_cost ?? '', ecart === '' ? '' : Number(ecart) * Number(l.pump_unit_cost || 0));
    return r;
  });
  const csv = [entete, ...rows].map((r) => r.map(echapper).join(',')).join('\r\n');
  telechargerCsv(`inventaire_${c.numero}_${todayIso()}.csv`, csv);
}

// ── Fenêtre de comptage (session en cours) ou de consultation (session close) ──
async function ouvrirSessionInventaire(countId) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  let modifie = false;
  const fermer = () => { overlay.remove(); if (modifie) renderApp(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
  overlay.innerHTML = `<div class="modal export-modal inventaire-modal"><div class="ui-aide">${trad('Chargement…')}</div></div>`;

  let c = (UI.inventairesPhysiques || []).find((x) => String(x.id) === String(countId));
  let lignes = [];
  const gerant = peutGererParametresStock();
  const peut = peutGererMouvementsStock();
  const chargerLignes = async () => {
    const { data, error } = await sb.rpc('lignes_inventaire', { p_count_id: countId });
    if (error) throw error;
    lignes = (data || []).map((l) => ({
      ...l,
      expected_qty: l.expected_qty == null ? null : Number(l.expected_qty),
      counted_qty: l.counted_qty == null ? null : Number(l.counted_qty),
      variation_qty: l.variation_qty == null ? null : Number(l.variation_qty),
      applied_qty: l.applied_qty == null ? null : Number(l.applied_qty),
      theoretical_at_count: l.theoretical_at_count == null ? null : Number(l.theoretical_at_count),
    }));
  };
  try {
    if (!c) {
      const { data, error } = await sb.from('stock_counts').select('*').eq('id', countId).single();
      if (error) throw error;
      c = data;
    }
    await chargerLignes();
  } catch (err) {
    overlay.querySelector('.modal').innerHTML = `<div class="ui-aide">${esc(trad('Erreur :') + ' ' + (err.message || err))}</div>
      <div class="modal-actions"><button type="button" class="ui-btn ui-btn-pastille" id="inv-fermer">${trad('Fermer')}</button></div>`;
    overlay.querySelector('#inv-fermer').addEventListener('click', fermer);
    return;
  }

  const ouvert = c.status === 'en_cours';
  const peutCompter = ouvert && peut;
  const nombreOuNull = (v) => (v == null || Number.isNaN(v) ? null : v);
  // Écart affiché : session close → écart calculé par le serveur ; session ouverte → compté − théorique figé (indicatif).
  const ecartDe = (l) => {
    if (l.counted_qty == null) return null;
    if (!ouvert) return nombreOuNull(l.variation_qty);
    return l.expected_qty == null ? null : l.counted_qty - l.expected_qty;
  };
  const ecartHtml = (l) => {
    if (l.counted_qty == null) return '';
    const e = ecartDe(l);
    if (e == null) return `<span class="ui-statut is-ok">${trad('Compté')}</span>`;
    if (e === 0) return `<span class="ui-statut is-ok">${trad('OK')}</span>`;
    return `<span class="ui-statut is-retard">${e > 0 ? '+' : '−'}${texteAvecSeparateurs(Math.abs(e))}</span>`;
  };
  const unite = (l) => (l.unit_of_measure && l.unit_of_measure !== 'piece' ? ' ' + libelleUniteMesure(l.unit_of_measure) : '');
  const ligneHtml = (l) => {
    const theo = ouvert ? l.expected_qty : (l.theoretical_at_count ?? l.expected_qty);
    const sous = [
      l.reference, l.location,
      theo != null ? tR('Théorique : {q}', { q: texteAvecSeparateurs(theo) + unite(l) }) : '',
      !ouvert && l.applied_qty != null && l.variation_qty != null && l.applied_qty !== l.variation_qty ? tR('Appliqué : {q}', { q: texteAvecSeparateurs(l.applied_qty) }) : '',
      l.line_status && l.line_status !== 'libere' ? libelleStatutStock(l.line_status) : '',
    ].filter(Boolean).join(' · ');
    return `
      <div class="ui-ligne is-deux inv-ligne" data-inv-part="${esc(l.part_id)}">
        <div class="ui-ligne-id">
          <div class="ui-ligne-textes">
            <span class="ui-ligne-nom">${esc(l.designation || trad('Référence supprimée'))}</span>
            <span class="ui-ligne-sous">${esc(sous)}</span>
          </div>
        </div>
        <div class="ui-ligne-action">
          ${peutCompter
            ? `<input type="number" class="ui-champ inv-qte" step="any" min="0" inputmode="decimal" value="${l.counted_qty == null ? '' : esc(l.counted_qty)}" aria-label="${esc(tR('Quantité comptée : {nom}', { nom: l.designation }))}" placeholder="${esc(trad('Qté'))}">`
            : `<span class="ui-chiffre-valeur">${l.counted_qty == null ? '—' : texteAvecSeparateurs(l.counted_qty)}</span>`}
          <span class="inv-ecart">${ecartHtml(l)}</span>
        </div>
      </div>`;
  };

  overlay.querySelector('.modal').outerHTML = `
    <div class="modal export-modal inventaire-modal" role="dialog" aria-modal="true" aria-labelledby="inv-titre">
      <h2 id="inv-titre">${esc(titreInventaire(c))} ${statutInventaireHtml(c)}</h2>
      <p class="sub">${esc(sousTitreInventaire(c))}</p>
      ${c.blind && ouvert && !gerant ? `<div class="ui-aide">${trad('Comptage en aveugle : les quantités théoriques sont cachées.')}</div>` : ''}
      <div class="ui-barre inv-outils">
        <span class="ui-tag" id="inv-progres"></span>
        ${peutCompter ? `<button type="button" class="ui-btn ui-btn-pastille" id="inv-scan" title="${esc(trad('Scanner une étiquette'))}">${picto('qrcode')}<span>${trad('Scanner')}</span></button>` : ''}
        <button type="button" class="ui-btn ui-btn-pastille" id="inv-export" title="${esc(trad('Exporter en CSV'))}">${picto('export')}<span>CSV</span></button>
        <input id="inv-filtre" class="ui-champ" placeholder="${trad('Rechercher par référence, désignation, emplacement…')}">
        <div class="ui-select-wrap">
          <select id="inv-vue" class="ui-champ" aria-label="${esc(trad('Afficher'))}">
            <option value="">${trad('Toutes les lignes')}</option>
            <option value="acompter">${trad('À compter')}</option>
            <option value="comptees">${trad('Comptées')}</option>
            <option value="ecarts">${trad('Avec écart')}</option>
          </select>${picto('chevronBas')}
        </div>
        ${peutCompter ? `<div class="ui-select-wrap"><select id="inv-ajout" class="ui-champ" aria-label="${esc(trad('Ajouter un article non prévu'))}"></select>${picto('chevronBas')}</div>` : ''}
      </div>
      <div class="ui-liste is-defilant" id="inv-liste"></div>
      <div class="ui-aide" id="inv-vide"></div>
      <div id="inv-confirm" hidden></div>
      <div id="inv-msg" role="status" aria-live="polite"></div>
      <div class="modal-actions" id="inv-actions">
        <button type="button" class="ui-btn ui-btn-pastille" id="inv-fermer">${trad('Fermer')}</button>
        ${ouvert && gerant ? `<button type="button" class="ui-btn ui-btn-pastille is-danger" id="inv-annuler" title="${esc(trad('Annuler l\'inventaire'))}">${trad('Abandonner')}</button>
        <button type="button" class="ui-btn ui-btn-plein" id="inv-valider" title="${esc(trad('Valider l\'inventaire'))}">${picto('coche')}<span>${trad('Valider')}</span></button>` : ''}
      </div>
    </div>`;

  const q = (sel) => overlay.querySelector(sel);
  const msg = q('#inv-msg');
  const liste = q('#inv-liste');
  const dire = (texte, erreur) => { msg.textContent = texte; msg.style.color = erreur ? 'var(--late)' : 'var(--ok)'; };
  q('#inv-fermer').addEventListener('click', fermer);
  q('#inv-export').addEventListener('click', () => exporterSessionInventaireCsv(c, lignes));

  const majProgres = () => {
    const comptees = lignes.filter((l) => l.counted_qty != null).length;
    q('#inv-progres').textContent = tR('Comptées : {n}/{t}', { n: comptees, t: lignes.length });
  };
  const majListeAjout = () => {
    const sel = q('#inv-ajout');
    if (!sel) return;
    const presentes = new Set(lignes.map((l) => String(l.part_id)));
    const dispo = (UI.partsCatalog || []).filter((p) => !presentes.has(String(p.id))).sort((a, b) => a.designation.localeCompare(b.designation));
    sel.innerHTML = `<option value="">${esc(trad('+ Article non prévu…'))}</option>`
      + dispo.map((p) => `<option value="${esc(p.id)}">${esc(p.designation)}${p.reference ? ' (' + esc(p.reference) + ')' : ''}</option>`).join('');
  };
  const dessiner = () => {
    const terme = (q('#inv-filtre').value || '').trim().toLowerCase();
    const vue = q('#inv-vue').value;
    let vues = lignes.filter((l) => {
      if (terme && ![l.designation, l.reference, l.location].filter(Boolean).join(' ').toLowerCase().includes(terme)) return false;
      if (vue === 'acompter') return l.counted_qty == null;
      if (vue === 'comptees') return l.counted_qty != null;
      if (vue === 'ecarts') { const e = ecartDe(l); return e != null && e !== 0; }
      return true;
    });
    liste.innerHTML = vues.map(ligneHtml).join('');
    q('#inv-vide').textContent = vues.length ? '' : trad('Aucune ligne pour ce filtre.');
    majProgres();
  };
  majListeAjout();
  dessiner();
  q('#inv-filtre').addEventListener('input', dessiner);
  q('#inv-vue').addEventListener('change', dessiner);

  // Ajout d'un article trouvé sur place alors qu'il n'était pas prévu : ligne locale, créée côté serveur au premier comptage.
  const ajouterLigneLocale = (partId) => {
    const p = (UI.partsCatalog || []).find((x) => String(x.id) === String(partId));
    if (!p) return null;
    let l = lignes.find((x) => String(x.part_id) === String(partId));
    if (!l) {
      l = { id: null, part_id: p.id, reference: p.reference || '', designation: p.designation, unit_of_measure: p.unit_of_measure || 'piece',
        location: null, line_status: 'libere', expected_qty: null, pump_unit_cost: 0, counted_qty: null, nouvelle: true };
      lignes.push(l);
      lignes.sort((a, b) => String(a.location || '').localeCompare(String(b.location || '')) || a.designation.localeCompare(b.designation));
      majListeAjout();
    }
    return l;
  };
  const aller = (partId) => {
    q('#inv-filtre').value = '';
    q('#inv-vue').value = '';
    dessiner();
    const ligneDom = Array.from(liste.querySelectorAll('.inv-ligne')).find((el) => el.getAttribute('data-inv-part') === String(partId));
    if (!ligneDom) return;
    ligneDom.scrollIntoView({ block: 'center' });
    ligneDom.querySelector('.inv-qte')?.focus();
  };
  q('#inv-ajout')?.addEventListener('change', (e) => {
    const l = ajouterLigneLocale(e.target.value);
    if (l) aller(l.part_id);
  });
  q('#inv-scan')?.addEventListener('click', () => {
    ouvrirScannerQr({
      titre: trad('Scanner une étiquette'),
      surTexte: (texte) => {
        const lue = lireQrLigneStock(texte);
        if (!lue) return trad('Ce QR code n\'est pas une étiquette de stock KALEA.');
        const l = ajouterLigneLocale(lue.partId);
        if (!l) return trad('Pièce introuvable dans le catalogue.');
        setTimeout(() => aller(l.part_id), 50);
        return true;
      },
    });
  });

  // Enregistrement d'un comptage dès que la case est quittée (ou Entrée) ; Entrée passe à la ligne suivante.
  liste.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.classList.contains('inv-qte')) return;
    e.preventDefault();
    const champs = Array.from(liste.querySelectorAll('.inv-qte'));
    const suivant = champs[champs.indexOf(e.target) + 1];
    e.target.blur();
    if (suivant) suivant.focus();
  });
  liste.addEventListener('change', async (e) => {
    const champ = e.target.closest('.inv-qte');
    if (!champ) return;
    const ligneDom = champ.closest('.inv-ligne');
    const l = lignes.find((x) => String(x.part_id) === ligneDom.getAttribute('data-inv-part'));
    if (!l) return;
    const brut = champ.value.trim();
    const qte = brut === '' ? null : Number(brut.replace(',', '.'));
    if (qte !== null && (!Number.isFinite(qte) || qte < 0)) {
      dire(trad('La quantité doit être un nombre positif.'), true);
      champ.value = l.counted_qty == null ? '' : l.counted_qty;
      return;
    }
    champ.disabled = true;
    try {
      const { error } = await sb.rpc('enregistrer_comptage', { p_count_id: countId, p_part_id: l.part_id, p_quantity: qte, p_note: null });
      if (error) throw error;
      const etaitNouvelle = !!l.nouvelle;
      l.counted_qty = qte;
      modifie = true;
      if (etaitNouvelle) {
        // La ligne existe maintenant côté serveur : on la relit (théorique, emplacement…).
        await chargerLignes();
        majListeAjout();
        dessiner();
      } else {
        ligneDom.querySelector('.inv-ecart').innerHTML = ecartHtml(l);
        majProgres();
      }
      dire('');
    } catch (err) {
      dire(trad('Erreur :') + ' ' + (err.message || err), true);
      champ.value = l.counted_qty == null ? '' : l.counted_qty;
    } finally {
      champ.disabled = false;
    }
  });

  // ── Annulation et validation (gérant) ──
  q('#inv-annuler')?.addEventListener('click', async () => {
    if (!window.confirm(trad('Annuler cet inventaire ? Aucune quantité de stock ne sera modifiée.'))) return;
    try {
      const { error } = await sb.rpc('annuler_inventaire', { p_count_id: countId });
      if (error) throw error;
      await chargerInventairesPhysiques();
      showToast(trad('Inventaire annulé'));
      modifie = true;
      fermer();
    } catch (err) {
      dire(trad('Erreur :') + ' ' + (err.message || err), true);
    }
  });
  q('#inv-valider')?.addEventListener('click', () => {
    const comptees = lignes.filter((l) => l.counted_qty != null);
    const nonComptees = lignes.length - comptees.length;
    const ecarts = comptees.filter((l) => { const e = ecartDe(l); return e != null && e !== 0; }).length;
    const zone = q('#inv-confirm');
    zone.hidden = false;
    q('#inv-actions').hidden = true;
    zone.innerHTML = `
      <div class="ui-groupe">
        <div class="ui-aide"><strong>${trad('Valider cet inventaire ?')}</strong><br>
          ${tR('{n} ligne(s) comptée(s), dont {e} avec un écart par rapport au théorique figé.', { n: comptees.length, e: ecarts })}
          ${trad('Chaque écart devient un ajustement de stock, définitif et visible dans les mouvements. Les mouvements saisis pendant le comptage sont pris en compte.')}</div>
        ${nonComptees ? `<label class="ui-case"><input type="checkbox" id="inv-zero"> ${tR('Traiter les {n} ligne(s) non comptée(s) comme vides (quantité 0)', { n: nonComptees })}</label>` : ''}
        <div class="modal-actions">
          <button type="button" class="ui-btn ui-btn-pastille" id="inv-retour">${trad('Retour')}</button>
          <button type="button" class="ui-btn ui-btn-plein" id="inv-confirmer">${picto('coche')}<span>${trad('Confirmer la validation')}</span></button>
        </div>
      </div>`;
    q('#inv-retour').addEventListener('click', () => { zone.hidden = true; zone.innerHTML = ''; q('#inv-actions').hidden = false; });
    q('#inv-confirmer').addEventListener('click', async () => {
      const bouton = q('#inv-confirmer');
      bouton.disabled = true;
      try {
        const { data, error } = await sb.rpc('valider_inventaire', { p_count_id: countId, p_non_comptees_a_zero: !!q('#inv-zero')?.checked });
        if (error) throw error;
        await Promise.all([chargerInventairesPhysiques(), rechargerSoldesStock()]);
        const bilan = Array.isArray(data) ? data[0] : data;
        showToast(tR('Inventaire validé : {e} ajustement(s)', { e: bilan?.lignes_avec_ecart ?? 0 }));
        modifie = true;
        fermer();
      } catch (err) {
        dire(trad('Erreur :') + ' ' + (err.message || err), true);
        bouton.disabled = false;
      }
    });
  });
}

// ═══════════════════════ FOURNISSEURS (fiches) ═══════════════════════
// SQL : kalea-serveur/migrations/stock-fournisseurs.sql (table suppliers + parts_catalog.supplier_id). Le texte
// parts_catalog.supplier_name reste la copie lisible du nom (utilisée partout) : on l'écrit toujours avec supplier_id,
// et la base le tient à jour quand une fiche est renommée. Réservé au module Stock (offre Enterprise), comme les kits.
function fournisseursActifs() {
  return !!(SCHEMA.hasSuppliers && SCHEMA.hasStock && typeof planCouvreStock === 'function' && planCouvreStock());
}
function fournisseurParId(id) {
  return (UI.suppliers || []).find((s) => String(s.id) === String(id)) || null;
}
function fournisseurParNom(nom) {
  const cle = String(nom || '').trim().toLowerCase();
  return cle ? (UI.suppliers || []).find((s) => String(s.name).trim().toLowerCase() === cle) || null : null;
}
function piecesDuFournisseur(id) {
  return (UI.partsCatalog || []).filter((p) => String(p.supplier_id) === String(id));
}
function trierFournisseurs() {
  UI.suppliers = (UI.suppliers || []).slice().sort((a, b) => a.name.localeCompare(b.name));
}

function ligneFournisseurHtml(f) {
  const gerant = peutAcheter();
  const nbPieces = piecesDuFournisseur(f.id).length;
  const sous = [
    f.contact_name, f.phone,
    f.lead_time_days != null ? tR('Délai : {n} j', { n: f.lead_time_days }) : '',
    tR('{n} pièce(s)', { n: nbPieces }),
  ].filter(Boolean).join(' · ');
  return `
    <div class="ui-ligne is-deux" data-fournisseur-id="${esc(f.id)}">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone is-ambre">${picto('mallette')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(f.name)}${f.active === false ? `<span class="ui-tag">${trad('Inactif')}</span>` : ''}${kbisAExpirer(f) ? `<span class="ui-statut is-bientot">${trad('Kbis > 3 mois')}</span>` : ''}</span>
          <span class="ui-ligne-sous">${esc(sous)}</span>
        </div>
      </div>
      ${gerant ? `
      <div class="ui-ligne-action">
        <button type="button" class="ui-btn ui-btn-icone" data-fournisseur-modifier="${esc(f.id)}" title="${esc(trad('Modifier'))}" aria-label="${esc(tR('Modifier {nom}', { nom: f.name }))}">${picto('crayon')}</button>
        <button type="button" class="ui-btn ui-btn-icone is-danger" data-fournisseur-retirer="${esc(f.id)}" title="${esc(trad('Supprimer'))}" aria-label="${esc(tR('Supprimer {nom}', { nom: f.name }))}">${picto('corbeille')}</button>
      </div>` : ''}
    </div>`;
}
// Normalise pour la recherche : sans accents ni majuscules.
function formeRecherche(texte) { return String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function fournisseursFiltres() {
  const terme = formeRecherche(UI.stockRechercheFournisseurs).trim();
  const liste = UI.suppliers || [];
  if (!terme) return liste;
  const mots = terme.split(/\s+/).filter(Boolean);
  return liste.filter((f) => {
    const botte = formeRecherche([
      f.name, f.legal_name, f.contact_name, f.phone, f.email, f.po_email, f.city, f.company_number, f.note,
      ...piecesDuFournisseur(f.id).map((p) => [p.designation, p.reference].filter(Boolean).join(' ')),
    ].filter(Boolean).join(' '));
    return mots.every((m) => botte.includes(m));
  });
}
function listeFournisseursHtml() {
  const liste = fournisseursFiltres();
  if (!(UI.suppliers || []).length) return `<div class="ui-aide">${trad('Aucun fournisseur pour l\'instant.')}</div>`;
  return liste.length
    ? liste.map(ligneFournisseurHtml).join('')
    : `<div class="ui-aide">${trad('Aucun fournisseur ne correspond à cette recherche.')}</div>`;
}
function blocFournisseursStockHtml() {
  const gerant = peutAcheter();
  return `
    <section class="ui-section" id="stock-fournisseurs-section">
      ${teteSectionKit('mallette', trad('Fournisseurs'), trad('Contacts, délais et conditions de tes fournisseurs de pièces'),
        `<span class="ui-tag" id="stock-fournisseurs-badge">${tR('{n} fournisseur(s)', { n: (UI.suppliers || []).length })}</span>${gerant ? `<button type="button" class="ui-btn ui-btn-pastille" id="stock-fournisseur-nouveau">${picto('plusCercle')}<span>${trad('Nouveau fournisseur')}</span></button>` : ''}`)}
      <div class="ui-section-corps">
        ${gerant ? '' : `<div class="ui-aide">${trad('Réservé au gérant et au droit d\'achat.')}</div>`}
        <div class="ui-barre"><input id="stock-fournisseur-recherche" class="ui-champ" type="search" value="${esc(UI.stockRechercheFournisseurs || '')}" placeholder="${esc(trad('Rechercher un fournisseur (nom, contact, ville, pièce…)'))}" aria-label="${esc(trad('Rechercher un fournisseur'))}"></div>
        <div class="ui-liste is-defilant" id="stock-fournisseurs-liste">${listeFournisseursHtml()}</div>
      </div>
    </section>`;
}
// Met à jour la liste affichée (si la page Stock est à l'écran) sans reconstruire la page.
function rafraichirListeFournisseurs() {
  const liste = document.getElementById('stock-fournisseurs-liste');
  if (liste) liste.innerHTML = listeFournisseursHtml();
  const badge = document.getElementById('stock-fournisseurs-badge');
  if (badge) badge.textContent = tR('{n} fournisseur(s)', { n: (UI.suppliers || []).length });
}

// Fiche fournisseur COMPLÈTE (kalea-serveur/migrations/stock-fournisseurs-complet.sql). Tant que cette seconde migration n'est
// pas visible (SCHEMA.hasSuppliersFull), seuls les champs de base sont lus et écrits : l'appli marche avant ET après.
const COLONNES_FOURNISSEUR_BASE = 'id, name, contact_name, email, phone, address, lead_time_days, payment_terms, min_order_amount, note, active';
const COLONNES_FOURNISSEUR_PLUS = ', legal_name, legal_form, company_number, vat_number, activity_code, postal_code, city, country, shipping_address, billing_address, website, sales_contact_phone, po_email, accounting_contact_name, accounting_contact_phone, accounting_contact_email, logistics_contact_name, logistics_contact_phone, logistics_contact_email, payment_method, currency, franco_amount, min_order_quantity, incoterm, kbis_received_at, rib_received_at';
function colonnesFournisseur() {
  return COLONNES_FOURNISSEUR_BASE + (SCHEMA.hasSuppliersFull ? COLONNES_FOURNISSEUR_PLUS : '');
}
const FORMES_JURIDIQUES = ['SAS', 'SASU', 'SARL', 'EURL', 'SA', 'SNC', 'EI', 'Micro-entreprise', 'Association', 'Autre'];
const MODES_PAIEMENT_FOURNISSEUR = [['virement', 'Virement bancaire'], ['prelevement', 'Prélèvement'], ['cheque', 'Chèque'], ['traite', 'Traite'], ['comptant', 'Comptant'], ['carte', 'Carte bancaire'], ['autre', 'Autre']];
const DEVISES_FOURNISSEUR = ['EUR', 'XPF', 'USD', 'AUD', 'NZD', 'GBP', 'CHF', 'CAD', 'JPY', 'CNY'];
const INCOTERMS_FOURNISSEUR = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const CONDITIONS_PAIEMENT_USUELLES = ['Comptant', '30 jours net', '45 jours fin de mois', '60 jours net'];
// Pièces jointes (kalea-serveur/migrations/stock-fournisseurs-documents.sql) : espace de stockage privé, gérant seul.
const BUCKET_DOCS_FOURNISSEUR = 'supplier-docs';
const TAILLE_MAX_DOC_FOURNISSEUR = 5 * 1024 * 1024;
const TYPES_MIME_DOC_FOURNISSEUR = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
function typesDocFournisseur() {
  return [
    { kind: 'kbis', libelle: trad('Extrait Kbis / RIDET'), aide: trad('Datant de moins de 3 mois'), icone: 'carnet', colonneDate: 'kbis_received_at' },
    { kind: 'rib', libelle: trad('RIB'), aide: trad('Sur papier à en-tête de la banque ou de l\'entreprise'), icone: 'institution', colonneDate: 'rib_received_at' },
  ];
}
function docsFournisseurActifs() {
  return !!(SCHEMA.hasSuppliersFull && SCHEMA.hasSupplierDocs && typeof peutAcheter === 'function' && peutAcheter());
}

// Description des champs, par carte colorée. t : text | tel | email | select | num | int ; i : pictogramme dans le champ ;
// full : toute la largeur ; ext : champ de la seconde migration. L'identifiant HTML est « fo-<k> ».
function sectionsFournisseur() {
  return [
    { cle: 'identite', titre: trad('Identité'), sous: trad('Qui est ce fournisseur'), icone: 'institution', accent: 'indigo', colonne: 0, champs: [
      { k: 'name', l: trad('Nom usuel (affiché dans l\'application)'), t: 'text', max: 120, full: true, i: 'mallette' },
      { k: 'legal_name', l: trad('Raison sociale'), t: 'text', max: 160, ext: true, i: 'institution' },
      { k: 'legal_form', l: trad('Forme juridique'), t: 'text', max: 60, ext: true, liste: FORMES_JURIDIQUES },
      { k: 'company_number', l: trad('N° SIRET / RIDET / RCS'), t: 'text', max: 40, ext: true, i: 'carnet' },
      { k: 'vat_number', l: trad('N° de TVA / numéro fiscal'), t: 'text', max: 40, ext: true, i: 'carnet' },
      { k: 'activity_code', l: trad('Code APE / NAF'), t: 'text', max: 20, ext: true },
    ] },
    { cle: 'coordonnees', titre: trad('Coordonnées'), sous: trad('Adresses, téléphone, site'), icone: 'monde', accent: 'bleu', colonne: 0, champs: [
      { k: 'address', l: trad('Adresse du siège'), t: 'text', max: 300, full: true, i: 'batiment' },
      { k: 'postal_code', l: trad('Code postal'), t: 'text', max: 20, ext: true },
      { k: 'city', l: trad('Ville'), t: 'text', max: 100, ext: true },
      { k: 'country', l: trad('Pays'), t: 'text', max: 60, ext: true, i: 'monde' },
      { k: 'phone', l: trad('Téléphone standard'), t: 'tel', max: 60, i: 'telephone' },
      { k: 'website', l: trad('Site web'), t: 'text', max: 200, ext: true, full: true, i: 'monde' },
      { k: 'shipping_address', l: trad('Adresse d\'expédition ou d\'enlèvement (si différente)'), t: 'text', max: 300, ext: true, full: true, i: 'boite' },
      { k: 'billing_address', l: trad('Adresse de facturation (si différente)'), t: 'text', max: 300, ext: true, full: true, i: 'paiement' },
    ] },
    { cle: 'contacts', titre: trad('Contacts'), sous: trad('Commercial, comptabilité, logistique'), icone: 'equipe', accent: 'teal', colonne: 0, champs: [
      { k: 'contact_name', l: trad('Contact commercial'), t: 'text', max: 120, i: 'personne' },
      { k: 'sales_contact_phone', l: trad('Ligne directe'), t: 'tel', max: 60, ext: true, i: 'telephone' },
      { k: 'email', l: trad('E-mail du contact commercial'), t: 'email', max: 200, i: 'mail' },
      { k: 'po_email', l: trad('E-mail pour les bons de commande'), t: 'email', max: 200, ext: true, i: 'envoyer' },
      { k: 'accounting_contact_name', l: trad('Contact comptabilité'), t: 'text', max: 120, ext: true, i: 'personne' },
      { k: 'accounting_contact_phone', l: trad('Téléphone comptabilité'), t: 'tel', max: 60, ext: true, i: 'telephone' },
      { k: 'accounting_contact_email', l: trad('E-mail comptabilité'), t: 'email', max: 200, ext: true, full: true, i: 'mail' },
      { k: 'logistics_contact_name', l: trad('Contact logistique / SAV'), t: 'text', max: 120, ext: true, i: 'personne' },
      { k: 'logistics_contact_phone', l: trad('Téléphone logistique / SAV'), t: 'tel', max: 60, ext: true, i: 'telephone' },
      { k: 'logistics_contact_email', l: trad('E-mail logistique / SAV'), t: 'email', max: 200, ext: true, full: true, i: 'mail' },
    ] },
    { cle: 'finance', titre: trad('Paiement et banque'), sous: trad('Règlement et coordonnées bancaires'), icone: 'paiement', accent: 'orange', colonne: 1, banque: true, champs: [
      { k: 'payment_terms', l: trad('Conditions de paiement'), t: 'text', max: 120, liste: CONDITIONS_PAIEMENT_USUELLES.map((c) => trad(c)), i: 'calendrier' },
      { k: 'payment_method', l: trad('Mode de paiement'), t: 'select', ext: true, options: MODES_PAIEMENT_FOURNISSEUR.map(([c, l]) => [c, trad(l)]) },
      { k: 'currency', l: trad('Devise'), t: 'select', ext: true, options: DEVISES_FOURNISSEUR.map((c) => [c, c]) },
    ] },
    { cle: 'conditions', titre: trad('Conditions commerciales'), sous: trad('Délais, minimums, franco'), icone: 'boite', accent: 'prune', colonne: 1, champs: [
      { k: 'lead_time_days', l: trad('Délai de livraison standard (jours)'), t: 'int', i: 'sablier' },
      { k: 'min_order_amount', l: trad('Minimum de commande (montant)'), t: 'num', unite: true },
      { k: 'min_order_quantity', l: trad('Minimum de commande (quantité)'), t: 'num', ext: true },
      { k: 'franco_amount', l: trad('Franco de port (montant)'), t: 'num', ext: true, unite: true },
      { k: 'incoterm', l: trad('Incoterm (fournisseurs étrangers)'), t: 'select', ext: true, options: INCOTERMS_FOURNISSEUR.map((c) => [c, c]), full: true },
    ] },
    { cle: 'documents', titre: trad('Documents et notes'), sous: trad('Kbis, RIB et remarques'), icone: 'bouclier', accent: 'ardoise', colonne: 1, docs: true, champs: [
      { k: 'note', l: trad('Note'), t: 'text', max: 500, full: true, i: 'crayon' },
    ] },
  ];
}
function champsBanque() {
  return [
    { k: 'account_holder', l: trad('Titulaire du compte'), max: 160, full: true, i: 'personne' },
    { k: 'iban', l: 'IBAN', max: 40, full: true, i: 'institution' },
    { k: 'bic', l: 'BIC / SWIFT', max: 20 },
    { k: 'bank_name', l: trad('Banque'), max: 120 },
    { k: 'bank_address', l: trad('Adresse de la banque'), max: 300, full: true, i: 'batiment' },
    { k: 'account_number', l: trad('Autre numéro de compte (hors IBAN)'), max: 60, full: true },
  ];
}
// Contrôle d'un IBAN : forme + clé modulo 97 (la saisie d'un IBAN faux est refusée plutôt qu'enregistrée en silence).
function ibanValide(iban) {
  const s = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const rearrange = s.slice(4) + s.slice(0, 4);
  let reste = 0;
  for (const c of rearrange) {
    const v = c >= 'A' ? String(c.charCodeAt(0) - 55) : c;
    for (const d of v) reste = (reste * 10 + Number(d)) % 97;
  }
  return reste === 1;
}
function bicValide(bic) {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(bic || '').replace(/\s+/g, '').toUpperCase());
}
// Extrait Kbis déposé depuis plus de 3 mois (la date de dépôt sert de repère : kbis_received_at est rempli au dépôt du fichier).
function kbisAExpirer(f) {
  if (!f || !f.kbis_received_at) return false;
  const d = new Date(f.kbis_received_at + 'T00:00:00');
  return !isNaN(d.getTime()) && (Date.now() - d.getTime()) / 86400000 > 92;
}
function initialesFournisseur(nom) {
  return String(nom || '').split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';
}

function champFournisseurHtml(c, f) {
  const id = 'fo-' + c.k;
  const brut = f ? f[c.k] : null;
  const valeur = brut == null ? '' : (c.t === 'num' ? texteAvecSeparateurs(brut) : String(brut));
  let champ;
  if (c.t === 'select') {
    const options = [['', '—'], ...c.options];
    champ = `<div class="ui-select-wrap"><select id="${id}" class="ui-champ">${options.map(([v, l]) => `<option value="${esc(v)}"${String(brut ?? '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${picto('chevronBas')}</div>`;
  } else if (c.t === 'num' || c.t === 'int') {
    champ = `<div class="ui-champ-unite"><input id="${id}" class="ui-champ" type="text" inputmode="${c.t === 'int' ? 'numeric' : 'decimal'}" value="${esc(valeur)}">${c.unite ? `<span class="ui-unite">${esc(deviseCourte())}</span>` : ''}</div>`;
  } else {
    champ = `<div class="fo-saisie${c.i ? ' a-icone' : ''}">${c.i ? picto(c.i) : ''}<input id="${id}" class="ui-champ" type="${c.t === 'tel' ? 'tel' : c.t === 'email' ? 'email' : 'text'}" maxlength="${c.max || 200}" value="${esc(valeur)}"${c.liste ? ` list="${id}-liste"` : ''}></div>`
      + (c.liste ? `<datalist id="${id}-liste">${c.liste.map((o) => `<option value="${esc(o)}"></option>`).join('')}</datalist>` : '');
  }
  return `<div class="ui-champ-groupe fo-champ${c.full ? ' is-large' : ''}"><label for="${id}"><strong>${c.l}</strong></label>${champ}</div>`;
}
function valeurChampFournisseur(overlay, c) {
  const el = overlay.querySelector('#fo-' + c.k);
  if (!el) return undefined;
  const v = el.value.trim();
  if (c.t === 'num') { const n = nombreDepuisTexte(v); return n != null && n >= 0 ? n : null; }
  if (c.t === 'int') { const n = nombreDepuisTexte(v); return n != null && n >= 0 ? Math.round(n) : null; }
  return v || null;
}
function formaterTailleFichier(octets) {
  return octets >= 1048576 ? (octets / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(octets / 1024)) + ' Ko';
}
async function telechargerDocFournisseur(doc) {
  const { data, error } = await sb.storage.from(BUCKET_DOCS_FOURNISSEUR).download(doc.storage_path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.file_name || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Création (f = null) ou modification d'une fiche. surEnregistre(fiche) : appelé après l'enregistrement
// (le catalogue s'en sert pour sélectionner le fournisseur qui vient d'être créé).
function ouvrirEditionFournisseur(f, surEnregistre) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  let modifie = false;
  overlay.addEventListener('click', (e) => { if (e.target === overlay && !modifie) overlay.remove(); });
  const complet = !!SCHEMA.hasSuppliersFull;
  const gerant = peutAcheter();
  const avecDocs = docsFournisseurActifs();
  const types = typesDocFournisseur();
  const sections = sectionsFournisseur()
    .map((s) => ({ ...s, champs: s.champs.filter((c) => complet || !c.ext) }))
    .filter((s) => s.champs.length || (s.banque && complet && gerant) || (s.docs && avecDocs));
  // Nouvelle fiche : la devise de la société est proposée.
  const valeursInitiales = f || { currency: complet ? (UI.company?.currency || '') : '' };
  // État des pièces jointes : { existant (ligne en base), fichier (à envoyer à l'enregistrement), retire }
  const docs = {};
  types.forEach((t) => { docs[t.kind] = { existant: null, fichier: null, retire: false }; });

  const carteHtml = (s) => `
    <details class="fo-carte" data-accent="${s.accent}" open>
      <summary>
        <span class="fo-puce">${picto(s.icone)}</span>
        <span class="fo-carte-titres"><span class="fo-carte-titre">${s.titre}</span><span class="fo-carte-sous">${s.sous}</span></span>
        <span class="fo-carte-bascule" aria-hidden="true"></span>
      </summary>
      <div class="fo-grille">
        ${s.champs.map((c) => champFournisseurHtml(c, valeursInitiales)).join('')}
        ${s.banque && complet && gerant ? `
        <div class="fo-sous-bloc is-large">
          <div class="fo-sous-titre">${picto('cadenas')}<span>${trad('Coordonnées bancaires')}</span><em>${trad('visibles du gérant seul')}</em></div>
          <div class="fo-grille" id="fo-banque-grille">${champsBanque().map((c) => champFournisseurHtml({ ...c, t: 'text', k: 'bk_' + c.k }, null)).join('')}</div>
          <div class="ui-aide" id="fo-banque-etat">${trad('Chargement…')}</div>
        </div>` : ''}
        ${s.docs && avecDocs ? `
        <div class="fo-sous-bloc is-large">
          <div class="fo-sous-titre">${picto('cadenas')}<span>${trad('Pièces jointes')}</span><em>${trad('visibles du gérant seul · PDF, JPG ou PNG, 5 Mo max')}</em></div>
          ${types.map((t) => `
          <div class="fo-doc" data-doc="${t.kind}">
            <span class="fo-doc-icone">${picto(t.icone)}</span>
            <span class="fo-doc-textes"><strong>${t.libelle}</strong><span class="fo-doc-etat" data-doc-etat="${t.kind}"></span></span>
            <span class="fo-doc-actions">
              <button type="button" class="ui-btn ui-btn-pastille" data-doc-voir="${t.kind}">${picto('export')}<span>${trad('Voir')}</span></button>
              <button type="button" class="ui-btn ui-btn-pastille" data-doc-choisir="${t.kind}">${picto('televerser')}<span data-doc-choisir-texte="${t.kind}">${trad('Ajouter')}</span></button>
              <button type="button" class="ui-btn ui-btn-icone is-danger" data-doc-retirer="${t.kind}" title="${esc(trad('Retirer'))}" aria-label="${esc(trad('Retirer') + ' ' + t.libelle)}">${picto('corbeille')}</button>
            </span>
            <input type="file" hidden data-doc-fichier="${t.kind}" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp">
          </div>`).join('')}
        </div>` : ''}
      </div>
    </details>`;
  const colonnes = [0, 1].map((n) => sections.filter((s) => s.colonne === n));
  overlay.innerHTML = `
    <div class="modal export-modal fournisseur-modal a-croix" role="dialog" aria-modal="true" aria-labelledby="fo-titre">
      <header class="fo-entete">
        <h2 id="fo-titre">${f ? esc(f.name) : trad('Nouveau fournisseur')}</h2>
        <p class="sub" id="fo-hero-sous">${f ? esc([f.legal_name, f.city].filter(Boolean).join(' · ')) : trad('Remplis ce que tu connais : le reste peut venir plus tard.')}</p>
        <div class="fo-completude" title="${esc(trad('Part des informations utiles pour passer commande'))}">
          <span class="fo-completude-texte" id="fo-completude-texte"></span>
          <span class="fo-completude-barre"><span id="fo-completude-remplie"></span></span>
        </div>
        <button type="button" class="modal-croix fo-fermer-x" id="fo-fermer-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
      </header>
      <div class="fo-corps">
        <div class="fo-colonnes">
          ${colonnes.map((cartes) => `<div class="fo-colonne">${cartes.map(carteHtml).join('')}</div>`).join('')}
        </div>
      </div>
      <footer class="fo-pied modal-actions">
        <label class="ui-case fo-actif"><input type="checkbox" id="fo-actif" ${f && f.active === false ? '' : 'checked'}> ${trad('Fournisseur actif')}</label>
        <div id="fo-msg" role="status" aria-live="polite"></div>
        <button type="button" class="ui-btn ui-btn-pastille" id="fo-annuler">${trad('Annuler')}</button>
        <button type="button" class="ui-btn ui-btn-plein" id="fo-go">${picto('coche')}<span>${trad('Enregistrer')}</span></button>
      </footer>
    </div>`;
  overlay.querySelectorAll('#fo-min_order_amount, #fo-franco_amount, #fo-min_order_quantity').forEach((el) => activerSeparateurMilliers(el));
  const q = (sel) => overlay.querySelector(sel);
  const msg = q('#fo-msg');
  // Ordinateur : toutes les cartes ouvertes ; téléphone : seule la première, les autres se déplient au toucher.
  const telephone = window.matchMedia && window.matchMedia('(max-width:700px)').matches;
  overlay.querySelectorAll('.fo-carte').forEach((d, i) => { d.open = !telephone || i === 0; });
  const fermer = () => overlay.remove();
  q('#fo-annuler').addEventListener('click', fermer);
  q('#fo-fermer-x').addEventListener('click', () => { if (!modifie || window.confirm(trad('Fermer sans enregistrer les modifications ?'))) fermer(); });

  // ── Coordonnées bancaires : table à part (gérant seul). Lues à l'ouverture ; on n'y touche à l'enregistrement que si la
  // lecture a réussi (jamais d'écrasement à l'aveugle). ──
  let banqueLue = null; // null = pas (encore) lue ; objet = ligne existante ; false = aucune ligne
  const banque = complet && gerant && q('#fo-banque-grille');
  if (banque) {
    const etat = q('#fo-banque-etat');
    if (!f) { banqueLue = false; etat.textContent = ''; }
    else {
      sb.from('supplier_bank_details').select('*').eq('supplier_id', f.id).maybeSingle().then(({ data, error }) => {
        if (error) { etat.textContent = trad('Erreur :') + ' ' + error.message; return; }
        banqueLue = data || false;
        etat.textContent = '';
        if (data) champsBanque().forEach((c) => { const el = q('#fo-bk_' + c.k); if (el) el.value = data[c.k] || ''; });
        majCompletude();
      });
    }
  }

  // ── Pièces jointes : choix du fichier ici, envoi à l'enregistrement. ──
  const majDoc = (kind) => {
    const d = docs[kind];
    const etat = q(`[data-doc-etat="${kind}"]`);
    if (!etat) return;
    const dateTexte = d.existant && d.existant.uploaded_at ? formatDateHeureMouvement(d.existant.uploaded_at) : '';
    let texte;
    let classe = '';
    if (d.fichier) { texte = tR('{nom} ({taille}) — sera envoyé à l\'enregistrement', { nom: d.fichier.name, taille: formaterTailleFichier(d.fichier.size) }); classe = 'is-nouveau'; }
    else if (d.existant && d.retire) { texte = trad('Sera retiré à l\'enregistrement'); classe = 'is-retire'; }
    else if (d.existant) { texte = `${d.existant.file_name}${dateTexte ? ' · ' + tR('ajouté le {d}', { d: dateTexte }) : ''}`; classe = 'is-present'; }
    else { texte = trad('Aucun fichier'); }
    etat.textContent = texte;
    etat.className = 'fo-doc-etat ' + classe;
    const aFichierActif = !!d.fichier || (!!d.existant && !d.retire);
    q(`[data-doc-voir="${kind}"]`).hidden = !(d.existant && !d.retire && !d.fichier);
    q(`[data-doc-retirer="${kind}"]`).hidden = !aFichierActif && !(d.existant && d.retire);
    const texteChoisir = q(`[data-doc-choisir-texte="${kind}"]`);
    if (texteChoisir) texteChoisir.textContent = aFichierActif ? trad('Remplacer') : trad('Ajouter');
    const retirer = q(`[data-doc-retirer="${kind}"]`);
    if (retirer) retirer.title = d.existant && d.retire ? trad('Annuler le retrait') : trad('Retirer');
    q(`[data-doc="${kind}"]`).classList.toggle('est-rempli', aFichierActif);
    majCompletude();
  };
  if (avecDocs) {
    types.forEach((t) => majDoc(t.kind));
    if (f) {
      sb.from('supplier_documents').select('*').eq('supplier_id', f.id).then(({ data }) => {
        (data || []).forEach((ligne) => { if (docs[ligne.kind]) docs[ligne.kind].existant = ligne; });
        types.forEach((t) => majDoc(t.kind));
      });
    }
    overlay.addEventListener('click', async (e) => {
      const voir = e.target.closest('[data-doc-voir]');
      if (voir) {
        const d = docs[voir.getAttribute('data-doc-voir')];
        try { await telechargerDocFournisseur(d.existant); } catch (err) { msg.textContent = trad('Erreur :') + ' ' + (err.message || err); }
        return;
      }
      const choisir = e.target.closest('[data-doc-choisir]');
      if (choisir) { q(`[data-doc-fichier="${choisir.getAttribute('data-doc-choisir')}"]`).click(); return; }
      const retirer = e.target.closest('[data-doc-retirer]');
      if (retirer) {
        const kind = retirer.getAttribute('data-doc-retirer');
        const d = docs[kind];
        if (d.fichier) d.fichier = null;
        else if (d.existant) d.retire = !d.retire;
        modifie = true;
        majDoc(kind);
      }
    });
    overlay.addEventListener('change', (e) => {
      const input = e.target.closest('[data-doc-fichier]');
      if (!input) return;
      const kind = input.getAttribute('data-doc-fichier');
      const fichier = input.files && input.files[0];
      input.value = '';
      if (!fichier) return;
      if (fichier.size > TAILLE_MAX_DOC_FOURNISSEUR) { msg.textContent = trad('Fichier trop lourd (5 Mo maximum).'); return; }
      if (!TYPES_MIME_DOC_FOURNISSEUR.includes(fichier.type)) { msg.textContent = trad('Format non accepté : PDF, JPG, PNG ou WebP.'); return; }
      msg.textContent = '';
      docs[kind].fichier = fichier;
      docs[kind].retire = false;
      modifie = true;
      majDoc(kind);
    });
  }

  // ── En-tête vivant : nom, sous-titre, pastille d'initiales, et jauge de complétude. ──
  function majCompletude() {
    const rempli = (id) => { const el = overlay.querySelector(id); return el ? el.value.trim() !== '' : null; };
    const criteres = [
      rempli('#fo-name'), rempli('#fo-legal_name'), rempli('#fo-company_number'), rempli('#fo-address'),
      (rempli('#fo-po_email') ?? null) !== null ? (rempli('#fo-po_email') || rempli('#fo-email')) : rempli('#fo-email'),
      (rempli('#fo-phone') || rempli('#fo-contact_name')), rempli('#fo-payment_terms'), rempli('#fo-lead_time_days'),
    ];
    if (banque) criteres.push(rempli('#fo-bk_iban'));
    if (avecDocs) types.forEach((t) => { const d = docs[t.kind]; criteres.push(!!d.fichier || (!!d.existant && !d.retire)); });
    const valides = criteres.filter((c) => c !== null && c !== undefined);
    const part = valides.length ? Math.round((valides.filter(Boolean).length / valides.length) * 100) : 0;
    const texte = q('#fo-completude-texte');
    if (texte) texte.textContent = tR('Fiche complète à {n} %', { n: part });
    const barre = q('#fo-completude-remplie');
    if (barre) { barre.style.width = part + '%'; barre.dataset.niveau = part >= 100 ? 'complet' : part >= 50 ? 'moyen' : 'faible'; }
  }
  overlay.addEventListener('input', (e) => {
    modifie = true;
    if (e.target.id === 'fo-name') {
      q('#fo-titre').textContent = e.target.value.trim() || (f ? f.name : trad('Nouveau fournisseur'));
    }
    if (e.target.id === 'fo-legal_name' || e.target.id === 'fo-city') {
      const sous = [q('#fo-legal_name')?.value.trim(), q('#fo-city')?.value.trim()].filter(Boolean).join(' · ');
      q('#fo-hero-sous').textContent = sous || trad('Remplis ce que tu connais : le reste peut venir plus tard.');
    }
    majCompletude();
  });
  overlay.addEventListener('change', () => { modifie = true; majCompletude(); });
  majCompletude();

  // ── Enregistrement ──
  const appliquerDocs = async (fournisseurId) => {
    const erreurs = [];
    for (const t of types) {
      const d = docs[t.kind];
      try {
        if (d.existant && d.retire) {
          await sb.storage.from(BUCKET_DOCS_FOURNISSEUR).remove([d.existant.storage_path]);
          const { error } = await sb.from('supplier_documents').delete().eq('id', d.existant.id);
          if (error) throw error;
        }
        if (d.fichier) {
          const extension = (d.fichier.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
          const chemin = `${UI.companyId}/${fournisseurId}/${t.kind}-${Date.now()}.${extension}`;
          const { error: errEnvoi } = await sb.storage.from(BUCKET_DOCS_FOURNISSEUR).upload(chemin, d.fichier, { contentType: d.fichier.type, upsert: false });
          if (errEnvoi) throw errEnvoi;
          const { error: errLigne } = await sb.from('supplier_documents').upsert({
            supplier_id: fournisseurId, company_id: UI.companyId, kind: t.kind, storage_path: chemin,
            file_name: d.fichier.name.slice(0, 200), mime_type: d.fichier.type, size_bytes: d.fichier.size,
          }, { onConflict: 'supplier_id,kind' });
          if (errLigne) throw errLigne;
          // L'ancien fichier (remplacé) n'est plus référencé : on le supprime.
          if (d.existant && !d.retire) await sb.storage.from(BUCKET_DOCS_FOURNISSEUR).remove([d.existant.storage_path]);
        }
      } catch (err) { erreurs.push(`${t.libelle} : ${err.message || err}`); }
    }
    return erreurs;
  };
  q('#fo-go').addEventListener('click', async () => {
    const bouton = q('#fo-go');
    const fiche = {};
    sections.forEach((s) => s.champs.forEach((c) => { fiche[c.k] = valeurChampFournisseur(overlay, c); }));
    fiche.active = q('#fo-actif').checked;
    if (!fiche.name) { msg.textContent = trad('Le nom est obligatoire.'); q('#fo-name')?.focus(); return; }
    // Date de dépôt des pièces (repère « Kbis de plus de 3 mois ») : posée au dépôt, effacée au retrait.
    if (avecDocs) {
      types.forEach((t) => {
        const d = docs[t.kind];
        if (d.fichier) fiche[t.colonneDate] = todayIso();
        else if (d.existant && d.retire) fiche[t.colonneDate] = null;
      });
    }
    // Banque : validation avant tout enregistrement.
    let valeursBanque = null;
    if (banque && banqueLue !== null) {
      valeursBanque = {};
      champsBanque().forEach((c) => { valeursBanque[c.k] = (q('#fo-bk_' + c.k).value || '').trim() || null; });
      if (valeursBanque.iban) valeursBanque.iban = valeursBanque.iban.replace(/\s+/g, '').toUpperCase();
      if (valeursBanque.bic) valeursBanque.bic = valeursBanque.bic.replace(/\s+/g, '').toUpperCase();
      if (valeursBanque.iban && !ibanValide(valeursBanque.iban)) { msg.textContent = trad('IBAN invalide : vérifie les caractères et la clé de contrôle.'); q('#fo-bk_iban').closest('details').open = true; q('#fo-bk_iban').focus(); return; }
      if (valeursBanque.bic && !bicValide(valeursBanque.bic)) { msg.textContent = trad('BIC invalide (8 ou 11 caractères).'); q('#fo-bk_bic').focus(); return; }
    }
    bouton.disabled = true;
    msg.textContent = '';
    try {
      const requete = f
        ? sb.from('suppliers').update(fiche).eq('id', f.id)
        : sb.from('suppliers').insert({ company_id: UI.companyId, ...fiche });
      const { data, error } = await requete.select(colonnesFournisseur()).single();
      if (error) throw error;
      UI.suppliers = [...(UI.suppliers || []).filter((s) => String(s.id) !== String(data.id)), data];
      trierFournisseurs();
      // Renommé : la base a renommé le texte des pièces rattachées, on reflète la même chose ici.
      if (f && f.name !== data.name) {
        UI.partsCatalog = (UI.partsCatalog || []).map((p) => (String(p.supplier_id) === String(data.id) ? { ...p, supplier_name: data.name } : p));
      }
      const erreursSecondaires = [];
      if (valeursBanque) {
        const vide = Object.values(valeursBanque).every((v) => !v);
        try {
          if (vide) {
            if (banqueLue) { const { error: e1 } = await sb.from('supplier_bank_details').delete().eq('supplier_id', data.id); if (e1) throw e1; }
          } else {
            const { error: e2 } = await sb.from('supplier_bank_details').upsert({ supplier_id: data.id, company_id: UI.companyId, ...valeursBanque }, { onConflict: 'supplier_id' });
            if (e2) throw e2;
          }
        } catch (err) { erreursSecondaires.push(`${trad('Coordonnées bancaires')} : ${err.message || err}`); }
      }
      if (avecDocs) erreursSecondaires.push(...await appliquerDocs(data.id));
      showToast(f ? trad('Fournisseur modifié') : trad('Fournisseur ajouté'));
      overlay.remove();
      rafraichirListeFournisseurs();
      if (erreursSecondaires.length) window.alert(trad('La fiche est enregistrée, mais :') + '\n' + erreursSecondaires.join('\n'));
      if (typeof surEnregistre === 'function') surEnregistre(data);
    } catch (err) {
      msg.textContent = String(err.code) === '23505'
        ? trad('Un fournisseur porte déjà ce nom.')
        : trad('Erreur :') + ' ' + (err.message || err);
      bouton.disabled = false;
    }
  });
}

async function supprimerFournisseur(id) {
  const f = fournisseurParId(id);
  if (!f) return;
  const n = piecesDuFournisseur(id).length;
  const question = n
    ? tR('Supprimer « {nom} » ? Ses {n} pièce(s) gardent son nom en texte mais ne sont plus rattachées à une fiche.', { nom: f.name, n })
    : tR('Supprimer « {nom} » ?', { nom: f.name });
  if (!window.confirm(question)) return;
  try {
    if (docsFournisseurActifs()) {
      const { data: pieces } = await sb.from('supplier_documents').select('storage_path').eq('supplier_id', id);
      const chemins = (pieces || []).map((p) => p.storage_path).filter(Boolean);
      if (chemins.length) await sb.storage.from(BUCKET_DOCS_FOURNISSEUR).remove(chemins);
    }
    const { error } = await sb.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    UI.suppliers = (UI.suppliers || []).filter((s) => String(s.id) !== String(id));
    UI.partsCatalog = (UI.partsCatalog || []).map((p) => (String(p.supplier_id) === String(id) ? { ...p, supplier_id: null } : p));
    showToast(trad('Fournisseur supprimé'));
    rafraichirListeFournisseurs();
  } catch (err) {
    window.alert(trad('Erreur :') + ' ' + (err.message || err));
  }
}

// Liste déroulante « Fournisseur » du formulaire du catalogue : fiches actives (+ celle déjà choisie si elle est
// devenue inactive), une valeur spéciale pour un nom non référencé hérité d'avant les fiches, et « + Nouveau ».
const VALEUR_FOURNISSEUR_NOUVEAU = '__nouveau__';
const VALEUR_FOURNISSEUR_TEXTE = '__texte__';
function optionsFournisseursHtml(idChoisi, texteHerite) {
  const actifs = (UI.suppliers || []).filter((s) => s.active !== false || String(s.id) === String(idChoisi));
  return `<option value="">${esc(trad('Fournisseur (optionnel)'))}</option>`
    + (texteHerite ? `<option value="${VALEUR_FOURNISSEUR_TEXTE}">${esc(texteHerite)} ${esc(trad('(non référencé)'))}</option>` : '')
    + actifs.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')
    + (peutAcheter() ? `<option value="${VALEUR_FOURNISSEUR_NOUVEAU}">${esc(trad('+ Nouveau fournisseur…'))}</option>` : '');
}

// Import CSV : rattache chaque nom de fournisseur à une fiche (la crée si elle manque et si c'est le gérant qui importe).
async function rattacherFournisseursImport(lignes) {
  const manquants = new Map();
  lignes.forEach((l) => {
    const nom = (l.supplier_name || '').trim();
    if (nom && !fournisseurParNom(nom)) manquants.set(nom.toLowerCase(), nom);
  });
  if (manquants.size && peutAcheter()) {
    const { data, error } = await sb.from('suppliers')
      .insert([...manquants.values()].map((name) => ({ company_id: UI.companyId, name })))
      .select(colonnesFournisseur());
    if (error) throw error;
    UI.suppliers = [...(UI.suppliers || []), ...(data || [])];
    trierFournisseurs();
  }
  lignes.forEach((l) => {
    const f = fournisseurParNom(l.supplier_name);
    l.supplier_id = f ? f.id : null;
    if (f) l.supplier_name = f.name;
  });
}

// ── Achats : bon de commande suggéré ──────────────────────────────────────────
// Rien n'est enregistré en base à ce stade : l'écran CALCULE ce qu'il faut commander (aucune donnée inventée) et
// prépare un bon par fournisseur, à imprimer / envoyer. Le suivi des commandes et leur réception viendront ensuite.
//
// Règle de calcul, par pièce du catalogue (tous magasins confondus, stock « libéré » seulement) :
//   demande prévue  = la plus grande de deux estimations (jamais leur somme : les sorties passées contiennent déjà
//                      la consommation des entretiens, on ne compte pas deux fois)
//                       · besoin des entretiens à venir (kits reliés aux plans, sur l'horizon choisi)
//                       · rythme de sortie observé (sorties de stock — ventes de pièces comprises — sur la fenêtre
//                         choisie, ramené à l'horizon)
//   à commander     = demande prévue + seuil de réapprovisionnement − stock disponible (arrondi à l'unité supérieure)
//   urgence         = jours de couverture du stock comparés au délai d'appro (+ marge de sécurité), ou état de
//                     couverture des entretiens (même logique que « Besoins à risque »).
const PARAMS_ACHATS_DEFAUT = { horizon: 60, fenetre: 90, securite: 7, rythme: true };
function paramsAchats() {
  UI.achatsParams = { ...PARAMS_ACHATS_DEFAUT, ...(UI.achatsParams || {}) };
  return UI.achatsParams;
}
function nombrePositif(valeur, defaut) {
  const n = Number(String(valeur ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : defaut;
}
// Sorties de stock des N derniers jours, cumulées par pièce (chargées à la demande, jamais au démarrage).
let sortiesAchats = { fenetre: null, donnees: null, erreur: null };
async function chargerSortiesAchats(fenetre) {
  if (sortiesAchats.donnees && sortiesAchats.fenetre === fenetre) return sortiesAchats.donnees;
  const depuis = new Date(Date.now() - fenetre * 86400000).toISOString();
  const { data, error } = await sb.from('stock_movements')
    .select('part_id, quantity, type, performed_at')
    .eq('company_id', UI.companyId)
    .eq('type', 'sortie')
    .gte('performed_at', depuis)
    .limit(5000);
  if (error) { sortiesAchats = { fenetre: null, donnees: null, erreur: error.message }; throw error; }
  const parPiece = new Map();
  (data || []).forEach((m) => {
    const id = String(m.part_id);
    parPiece.set(id, (parPiece.get(id) || 0) + Math.abs(Number(m.quantity) || 0));
  });
  sortiesAchats = { fenetre, donnees: parPiece, erreur: null };
  return parPiece;
}
function calculerSuggestionsAchat(params, sorties) {
  const { horizon, fenetre, securite } = params;
  const entretiens = new Map();
  const enCommande = SCHEMA.hasCommandes ? quantitesEnCommande() : new Map();
  if (SCHEMA.hasKits) {
    const prep = listePreparation(UI.machines, horizon);
    (prep.produits || []).forEach((p) => {
      if (!p.partId || !p.stockCouverture) return;
      const id = String(p.partId);
      const avant = entretiens.get(id) || { besoin: 0, etat: 'ok', date: null };
      const gravite = { late: 0, soon: 1, inconnu: 2, ok: 3 };
      entretiens.set(id, {
        besoin: avant.besoin + (Number(p.total) || 0),
        etat: (gravite[p.stockCouverture.state] ?? 9) < (gravite[avant.etat] ?? 9) ? p.stockCouverture.state : avant.etat,
        date: [avant.date, p.premiereDate].filter(Boolean).sort()[0] || null,
      });
    });
  }
  const lignes = [];
  (UI.partsCatalog || []).forEach((piece) => {
    const id = String(piece.id);
    const stock = (UI.stockItems || [])
      .filter((it) => String(it.part_id) === id && statutLigneStock(it) === 'libere')
      .reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const e = entretiens.get(id) || { besoin: 0, etat: 'ok', date: null };
    const taux = params.rythme && sorties ? (sorties.get(id) || 0) / fenetre : 0;
    const demandeRythme = taux * horizon;
    const demande = Math.max(e.besoin, demandeRythme);
    const seuil = Number(piece.default_reorder_point) || 0;
    const commande = enCommande.get(id) || 0;
    const manque = demande + seuil - stock - commande;
    let aCommander = manque > 0 ? Math.ceil(manque) : 0;
    // Pièce AU seuil (stock = seuil : « seuil bas » à l'écran, mais manque = 0) dont la commande a été demandée depuis l'état du stock
    // (commanderPieceDepuisStock) : on la propose pour remonter le stock au double du seuil. La ligne disparaît dès qu'une commande est
    // enregistrée (enCommande > 0) ou que le stock repasse au-dessus du seuil.
    const force = (UI.achatsForces || new Map()).get(id);
    if (!aCommander && force != null && !commande) {
      const seuilLignes = Math.max(seuil, ...(UI.stockItems || []).filter((it) => String(it.part_id) === id).map((it) => Number(it.reorder_point) || 0));
      if (stock <= seuilLignes) aCommander = force;
    }
    if (!aCommander) return;
    const fournisseur = piece.supplier_id ? fournisseurParId(piece.supplier_id) : (piece.supplier_name ? fournisseurParNom(piece.supplier_name) : null);
    const delai = piece.avg_lead_time_days != null ? Number(piece.avg_lead_time_days) : (fournisseur && fournisseur.lead_time_days != null ? Number(fournisseur.lead_time_days) : null);
    const jours = taux > 0 ? stock / taux : null;
    const raisons = [];
    if (e.besoin > stock) raisons.push('entretien');
    if (taux > 0 && demandeRythme > stock) raisons.push('rythme');
    if (seuil > 0 && stock <= seuil) raisons.push('seuil');
    if (!raisons.length) raisons.push('seuil');
    let urgence = 'ok';
    if (jours != null) {
      if (delai != null) urgence = jours <= delai ? 'late' : (jours <= delai + securite ? 'soon' : 'ok');
      else if (jours <= securite) urgence = 'soon';
    }
    if (e.etat === 'late') urgence = 'late';
    else if (e.etat === 'soon' && urgence !== 'late') urgence = 'soon';
    if (stock <= 0 && demande > 0) urgence = 'late';
    lignes.push({
      id, piece, fournisseur, delai, stock, taux, jours, seuil, enCommande: commande,
      besoinEntretien: e.besoin, dateEntretien: e.date, demande, aCommander, raisons, urgence,
    });
  });
  const gravite = { late: 0, soon: 1, ok: 2 };
  lignes.sort((a, b) => gravite[a.urgence] - gravite[b.urgence] || a.piece.designation.localeCompare(b.piece.designation));
  return lignes;
}
const LIBELLE_URGENCE_ACHAT = () => ({ late: trad('Urgent'), soon: trad('Bientôt'), ok: trad('À prévoir') });
const LIBELLE_RAISON_ACHAT = () => ({ entretien: trad('Entretiens'), rythme: trad('Rythme de sortie'), seuil: trad('Sous le seuil') });
function quantiteAchat(ligne) {
  const saisie = (UI.achatsQuantites || {})[ligne.id];
  return saisie != null ? saisie : ligne.aCommander;
}
function ligneEstInclue(ligne) { return !(UI.achatsExclus || new Set()).has(ligne.id); }
function groupesAchat(lignes) {
  const groupes = new Map();
  lignes.forEach((l) => {
    const cle = l.fournisseur ? String(l.fournisseur.id) : (l.piece.supplier_name ? 'nom:' + l.piece.supplier_name : 'aucun');
    if (!groupes.has(cle)) groupes.set(cle, { cle, fournisseur: l.fournisseur, nom: l.fournisseur ? l.fournisseur.name : (l.piece.supplier_name || trad('Sans fournisseur')), lignes: [] });
    groupes.get(cle).lignes.push(l);
  });
  const gravite = { late: 0, soon: 1, ok: 2 };
  return [...groupes.values()].sort((a, b) => {
    const ga = Math.min(...a.lignes.map((l) => gravite[l.urgence]));
    const gb = Math.min(...b.lignes.map((l) => gravite[l.urgence]));
    return ga - gb || a.nom.localeCompare(b.nom);
  });
}
function totalLigneAchat(ligne) {
  return nombrePositif(quantiteAchat(ligne), 0) * (Number(ligne.piece.unit_price) || 0);
}
function ligneAchatHtml(l) {
  const urg = LIBELLE_URGENCE_ACHAT();
  const rai = LIBELLE_RAISON_ACHAT();
  const classe = { late: 'is-retard', soon: 'is-bientot', ok: 'is-ok' }[l.urgence];
  const faits = [
    tR('Stock : {n}', { n: texteAvecSeparateurs(l.stock) }),
    l.enCommande ? tR('En commande : {n}', { n: texteAvecSeparateurs(l.enCommande) }) : '',
    l.besoinEntretien ? tR('Entretiens : {n}', { n: texteAvecSeparateurs(l.besoinEntretien) }) : '',
    l.taux > 0 ? tR('Sorties : {n}/j', { n: texteAvecSeparateurs(Math.round(l.taux * 100) / 100) }) : '',
    l.jours != null ? tR('Couverture : {n} j', { n: Math.round(l.jours) }) : '',
    l.delai != null ? tR('Délai : {n} j', { n: l.delai }) : '',
  ].filter(Boolean).join(' · ');
  const inclus = ligneEstInclue(l);
  return `
    <div class="achats-ligne ${classe}${inclus ? '' : ' is-exclue'}" data-achats-ligne="${esc(l.id)}">
      <label class="achats-case"><input type="checkbox" data-achats-inclure="${esc(l.id)}"${inclus ? ' checked' : ''} aria-label="${esc(tR('Inclure {nom} dans le bon', { nom: l.piece.designation }))}"></label>
      <div class="achats-textes">
        <span class="ui-ligne-nom">${esc(l.piece.designation)}${l.piece.packaging ? `<span class="ui-tag">${esc(l.piece.packaging)}</span>` : ''}</span>
        <span class="ui-ligne-sous">${esc([l.piece.reference || trad('Sans référence'), l.piece.ean ? 'EAN ' + l.piece.ean : ''].filter(Boolean).join(' · '))}</span>
        <span class="ui-ligne-sous">${esc(faits)}</span>
        <span class="achats-badges"><span class="ui-statut ${classe}">${esc(urg[l.urgence])}</span>${l.raisons.map((r) => `<span class="ui-tag">${esc(rai[r])}</span>`).join('')}</span>
      </div>
      <div class="achats-qte">
        <label class="sr-only" for="achats-qte-${esc(l.id)}">${trad('Quantité à commander')}</label>
        <input id="achats-qte-${esc(l.id)}" class="ui-champ" type="text" inputmode="decimal" data-achats-qte="${esc(l.id)}" value="${esc(String(quantiteAchat(l)))}">
        <span class="ui-ligne-sous" data-achats-total="${esc(l.id)}">${l.piece.unit_price ? esc(texteAvecSeparateurs(totalLigneAchat(l)) + ' ' + deviseCourte()) : '—'}</span>
      </div>
    </div>`;
}
function groupeAchatHtml(g) {
  const delaiMax = Math.max(0, ...g.lignes.map((l) => l.delai || 0));
  return `
    <div class="achats-groupe" data-achats-groupe="${esc(g.cle)}">
      <div class="achats-groupe-tete">
        <div class="achats-groupe-titre">
          <span class="ui-section-icone">${picto('mallette')}</span>
          <span><strong>${esc(g.nom)}</strong>${delaiMax ? `<span class="ui-ligne-sous">${tR('Délai habituel : {n} j', { n: delaiMax })}</span>` : ''}</span>
        </div>
        <span class="achats-groupe-total ui-chiffre-valeur" data-achats-groupe-total="${esc(g.cle)}"></span>
        <button type="button" class="ui-btn ui-btn-plein" data-achats-bon="${esc(g.cle)}">${picto('export')}<span>${trad('Préparer le bon')}</span></button>
      </div>
      <div class="achats-lignes">${g.lignes.map(ligneAchatHtml).join('')}</div>
    </div>`;
}
function blocAchatsHtml() {
  const p = paramsAchats();
  return `
    <section class="ui-section" id="achats-section">
      ${teteSectionKit('boite', trad('Bon de commande suggéré'), trad('Pièces à commander d\'après les échéances d\'entretien à venir et le rythme de sortie du stock (ventes de pièces comprises).'),
        `<span class="ui-tag" id="achats-badge"></span>`)}
      <div class="ui-section-corps">
        <div class="achats-params">
          <div class="ui-champ-groupe"><label for="achats-horizon">${trad('Prévoir sur (jours)')}</label><input id="achats-horizon" class="ui-champ" type="text" inputmode="numeric" value="${p.horizon}"></div>
          <div class="ui-champ-groupe"><label for="achats-fenetre">${trad('Rythme observé sur (jours)')}</label><input id="achats-fenetre" class="ui-champ" type="text" inputmode="numeric" value="${p.fenetre}"></div>
          <div class="ui-champ-groupe"><label for="achats-securite">${trad('Marge de sécurité (jours)')}</label><input id="achats-securite" class="ui-champ" type="text" inputmode="numeric" value="${p.securite}"></div>
        </div>
        <label class="ui-case achats-rythme"><input type="checkbox" id="achats-rythme"${p.rythme ? ' checked' : ''}> ${trad('Tenir compte du rythme de sortie du stock (ventes de pièces détachées comprises)')}</label>
        <div class="ui-aide">${trad('La quantité proposée couvre la plus grande des deux estimations (entretiens à venir ou rythme de sortie), plus le seuil de réapprovisionnement, moins le stock disponible. Chaque quantité reste modifiable.')}</div>
        <div id="achats-resume" class="ui-aide" role="status" aria-live="polite"></div>
        <div id="achats-contenu"><div class="ui-aide">${trad('Chargement…')}</div></div>
      </div>
    </section>${SCHEMA.hasCommandes ? blocCommandesHtml() : ''}`;
}
function resumeAchats(lignes) {
  const incluses = lignes.filter(ligneEstInclue);
  const total = incluses.reduce((s, l) => s + totalLigneAchat(l), 0);
  // « Sans fournisseur » n'est pas un fournisseur : on compte les vrais, et on signale à part les pièces sans fournisseur.
  const cles = incluses.map((l) => (l.fournisseur ? l.fournisseur.id : l.piece.supplier_name || null));
  const nbFourn = new Set(cles.filter((c) => c !== null)).size;
  const nbSans = cles.filter((c) => c === null).length;
  const morceaux = [tR('{n} pièce(s) à commander · total estimé {t}', { n: incluses.length, t: texteAvecSeparateurs(total) + ' ' + deviseCourte() })];
  if (nbFourn) morceaux.push(tR('{f} fournisseur(s)', { f: nbFourn }));
  if (nbSans) morceaux.push(tR('{n} pièce(s) sans fournisseur', { n: nbSans }));
  return incluses.length ? morceaux.join(' · ') : trad('Rien à commander avec ces réglages.');
}
function majTotauxAchats(root, lignes) {
  lignes.forEach((l) => {
    const el = root.querySelector(`[data-achats-total="${CSS.escape(l.id)}"]`);
    if (el) el.textContent = l.piece.unit_price ? texteAvecSeparateurs(totalLigneAchat(l)) + ' ' + deviseCourte() : '—';
  });
  groupesAchat(lignes).forEach((g) => {
    const el = root.querySelector(`[data-achats-groupe-total="${CSS.escape(g.cle)}"]`);
    const total = g.lignes.filter(ligneEstInclue).reduce((s, l) => s + totalLigneAchat(l), 0);
    if (el) el.textContent = total ? texteAvecSeparateurs(total) + ' ' + deviseCourte() : '';
  });
  const resume = root.querySelector('#achats-resume');
  if (resume) resume.textContent = resumeAchats(lignes);
}
async function rafraichirAchats(root) {
  const zone = root.querySelector('#achats-contenu');
  if (!zone) return;
  const p = paramsAchats();
  let sorties = null;
  let avertissement = '';
  if (p.rythme) {
    try { sorties = await chargerSortiesAchats(p.fenetre); } catch (err) { avertissement = trad('Rythme de sortie indisponible (lecture des mouvements impossible) : seuls les entretiens et les seuils sont pris en compte.'); }
  }
  if (!root.isConnected || !zone.isConnected) return;
  const lignes = calculerSuggestionsAchat(p, sorties);
  root._lignesAchats = lignes;
  const badge = root.querySelector('#achats-badge');
  if (badge) badge.textContent = tR('{n} pièce(s)', { n: lignes.length });
  zone.innerHTML = (avertissement ? `<div class="ui-aide is-late">${esc(avertissement)}</div>` : '')
    + (lignes.length ? groupesAchat(lignes).map(groupeAchatHtml).join('') : `<div class="ui-aide">${trad('Rien à commander avec ces réglages.')}</div>`);
  majTotauxAchats(root, lignes);
}
// « Commander » depuis l'état du stock (pièce en seuil bas) : bascule sur l'onglet Commandes, repère la pièce dans le bon suggéré, l'inclut,
// puis ouvre le bon de commande de SON fournisseur pour CETTE pièce (quantité suggérée par le calcul des achats). Si le calcul ne propose rien
// (stock total tous magasins suffisant, ou quantité déjà en commande), on l'explique plutôt que d'ouvrir un bon vide.
async function commanderPieceDepuisStock(root, partId) {
  if (!root.querySelector('#achats-section')) return;
  stockAllerOnglet(root, 'achats');
  if (!root._lignesAchats) await rafraichirAchats(root); // le calcul est asynchrone (rythme de sortie) : on attend qu'il soit prêt
  let lignes = root._lignesAchats || [];
  let ligne = lignes.find((l) => String(l.piece.id) === String(partId));
  if (!ligne) {
    // Seuil atteint mais pas franchi (stock = seuil), ou seuil propre à la ligne de stock : le calcul des achats ne propose rien, alors que
    // l'écran dit « seuil bas ». On propose de remonter le stock au double du seuil (quantité modifiable dans l'onglet Commandes).
    const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(partId));
    const libres = (UI.stockItems || []).filter((it) => String(it.part_id) === String(partId) && statutLigneStock(it) === 'libere');
    const stock = libres.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const seuil = Math.max(Number(piece && piece.default_reorder_point) || 0, ...libres.map((it) => Number(it.reorder_point) || 0));
    const dejaEnCommande = SCHEMA.hasCommandes ? (quantitesEnCommande().get(String(partId)) || 0) : 0;
    if (piece && seuil > 0 && stock <= seuil && !dejaEnCommande) {
      UI.achatsForces = UI.achatsForces || new Map();
      UI.achatsForces.set(String(partId), Math.max(1, Math.ceil(2 * seuil - stock)));
      await rafraichirAchats(root);
      lignes = root._lignesAchats || [];
      ligne = lignes.find((l) => String(l.piece.id) === String(partId));
    }
    if (!ligne) {
      showToast(dejaEnCommande ? trad('Cette pièce est déjà en commande (voir la liste des commandes).') : trad('Rien à commander pour cette pièce : le stock total (tous magasins) est suffisant.'));
      return;
    }
  }
  if (UI.achatsExclus) UI.achatsExclus.delete(ligne.id); // un clic sur « Commander » vaut intention de la commander
  const caseEl = root.querySelector(`[data-achats-inclure="${CSS.escape(ligne.id)}"]`);
  const ligneEl = root.querySelector(`[data-achats-ligne="${CSS.escape(ligne.id)}"]`);
  if (caseEl) caseEl.checked = true;
  if (ligneEl) { ligneEl.classList.remove('is-exclue'); ligneEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  majTotauxAchats(root, lignes);
  const groupe = groupesAchat(lignes).find((x) => x.lignes.includes(ligne));
  if (groupe) ouvrirBonDeCommande({ ...groupe, lignes: [ligne] });
}
function cablerAchats(root) {
  if (!root.querySelector('#achats-section')) return;
  const relire = () => {
    const p = paramsAchats();
    p.horizon = Math.max(1, Math.round(nombrePositif(root.querySelector('#achats-horizon').value, p.horizon)));
    p.fenetre = Math.max(1, Math.round(nombrePositif(root.querySelector('#achats-fenetre').value, p.fenetre)));
    p.securite = Math.round(nombrePositif(root.querySelector('#achats-securite').value, p.securite));
    p.rythme = root.querySelector('#achats-rythme').checked;
    rafraichirAchats(root);
  };
  let minuterie = null;
  ['#achats-horizon', '#achats-fenetre', '#achats-securite'].forEach((sel) => {
    root.querySelector(sel).addEventListener('input', () => { clearTimeout(minuterie); minuterie = setTimeout(relire, 500); });
  });
  root.querySelector('#achats-rythme').addEventListener('change', relire);
  const zone = root.querySelector('#achats-contenu');
  zone.addEventListener('input', (e) => {
    const champ = e.target.closest('[data-achats-qte]');
    if (!champ) return;
    (UI.achatsQuantites = UI.achatsQuantites || {})[champ.getAttribute('data-achats-qte')] = champ.value;
    majTotauxAchats(root, root._lignesAchats || []);
  });
  zone.addEventListener('change', (e) => {
    const case_ = e.target.closest('[data-achats-inclure]');
    if (!case_) return;
    UI.achatsExclus = UI.achatsExclus || new Set();
    const id = case_.getAttribute('data-achats-inclure');
    if (case_.checked) UI.achatsExclus.delete(id); else UI.achatsExclus.add(id);
    case_.closest('.achats-ligne')?.classList.toggle('is-exclue', !case_.checked);
    majTotauxAchats(root, root._lignesAchats || []);
  });
  zone.addEventListener('click', (e) => {
    const bon = e.target.closest('[data-achats-bon]');
    if (!bon) return;
    const g = groupesAchat(root._lignesAchats || []).find((x) => x.cle === bon.getAttribute('data-achats-bon'));
    if (g) ouvrirBonDeCommande(g);
  });
  root.querySelector('#commandes-liste')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-commande-ouvrir]');
    if (b) ouvrirCommande(b.getAttribute('data-commande-ouvrir'), () => { dessinerCommandes(root); rafraichirAchats(root); });
  });
  (async () => {
    if (SCHEMA.hasCommandes) await rafraichirCommandes(root);
    rafraichirAchats(root);
  })();
}
// ── Bon de commande : aperçu, impression / PDF, copie, e-mail ──
function lignesDuBon(g) {
  return g.lignes.filter(ligneEstInclue)
    .map((l) => ({ l, qte: nombrePositif(quantiteAchat(l), 0) }))
    .filter((x) => x.qte > 0);
}
function referenceBon(g) {
  const d = new Date();
  const jour = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const sigle = String(g.nom || 'X').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'X';
  return `BC-${jour}-${sigle}`;
}
function texteBonDeCommande(g, infos) {
  const f = g.fournisseur;
  const lignes = g._lignesFigees || lignesDuBon(g);
  const total = lignes.reduce((s, x) => s + x.qte * (Number(x.l.piece.unit_price) || 0), 0);
  const devise = deviseCourte();
  return [
    `${trad('BON DE COMMANDE')} ${infos.reference}`,
    `${trad('Date')} : ${formatShortDate(todayIso())}`,
    `${trad('De')} : ${UI.companyName || ''}`,
    `${trad('À')} : ${g.nom}${f && f.contact_name ? ' — ' + f.contact_name : ''}`,
    infos.livraison ? `${trad('Livraison souhaitée')} : ${formatShortDate(infos.livraison)}` : '',
    infos.adresse ? `${trad('Adresse de livraison')} : ${infos.adresse}` : '',
    '',
    ...lignes.map((x) => `- ${x.qte} × ${x.l.piece.designation}${x.l.piece.reference ? ' (' + x.l.piece.reference + ')' : ''}${x.l.piece.packaging ? ' [' + x.l.piece.packaging + ']' : ''}${x.l.piece.unit_price ? ' — ' + texteAvecSeparateurs(Number(x.l.piece.unit_price)) + ' ' + devise : ''}`),
    '',
    total ? `${trad('Total estimé')} : ${texteAvecSeparateurs(total)} ${devise}` : '',
    infos.note ? `${trad('Note')} : ${infos.note}` : '',
  ].filter((ligne, i, tab) => ligne !== '' || (tab[i - 1] !== '' && i > 0)).join('\n');
}
function documentBonDeCommandeHtml(g, infos) {
  const f = g.fournisseur;
  const lignes = g._lignesFigees || lignesDuBon(g);
  const devise = deviseCourte();
  const total = lignes.reduce((s, x) => s + x.qte * (Number(x.l.piece.unit_price) || 0), 0);
  const adresseFourn = f ? [f.legal_name && f.legal_name !== f.name ? f.legal_name : '', f.address, [f.postal_code, f.city].filter(Boolean).join(' '), f.country].filter(Boolean) : [];
  const contact = f ? [f.contact_name, f.phone, f.po_email || f.email].filter(Boolean) : [];
  const css = `body{font-family:Arial,Helvetica,sans-serif;color:#18181B;margin:28px;font-size:13px}h1{margin:0 0 4px;font-size:22px}.sous{color:#555;margin-bottom:18px}.cartes{display:flex;gap:24px;margin-bottom:18px}.carte{flex:1;border:1px solid #ccc;border-radius:4px;padding:10px 12px;line-height:1.5}.carte b{display:block;margin-bottom:4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#555}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:7px 6px;text-align:left}th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#555}td.n,th.n{text-align:right;white-space:nowrap}.total{margin-top:14px;text-align:right;font-size:15px;font-weight:700}.note{margin-top:16px;line-height:1.5}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(trad('Bon de commande'))} ${esc(infos.reference)}</title><style>${css}</style></head><body>
    <h1>${esc(trad('Bon de commande'))} ${esc(infos.reference)}</h1>
    <div class="sous">${esc(trad('Date'))} : ${esc(formatShortDate(todayIso()))}${infos.livraison ? ' · ' + esc(trad('Livraison souhaitée')) + ' : ' + esc(formatShortDate(infos.livraison)) : ''}</div>
    <div class="cartes">
      <div class="carte"><b>${esc(trad('Commandé par'))}</b>${esc(UI.companyName || '')}${infos.adresse ? '<br>' + esc(infos.adresse) : ''}</div>
      <div class="carte"><b>${esc(trad('Fournisseur'))}</b>${esc(g.nom)}${adresseFourn.map((l) => '<br>' + esc(l)).join('')}${contact.map((l) => '<br>' + esc(l)).join('')}</div>
    </div>
    <table><thead><tr><th>${esc(trad('Référence'))}</th><th>${esc(trad('Désignation'))}</th><th class="n">${esc(trad('Qté'))}</th><th class="n">${esc(trad('Prix unitaire'))}</th><th class="n">${esc(trad('Total'))}</th></tr></thead><tbody>
      ${lignes.map((x) => `<tr><td>${esc(x.l.piece.reference || '—')}</td><td>${esc(x.l.piece.designation)}${x.l.piece.packaging ? ' <small>(' + esc(x.l.piece.packaging) + ')</small>' : ''}</td><td class="n">${esc(texteAvecSeparateurs(x.qte))}</td><td class="n">${x.l.piece.unit_price ? esc(texteAvecSeparateurs(Number(x.l.piece.unit_price)) + ' ' + devise) : '—'}</td><td class="n">${x.l.piece.unit_price ? esc(texteAvecSeparateurs(x.qte * Number(x.l.piece.unit_price)) + ' ' + devise) : '—'}</td></tr>`).join('')}
    </tbody></table>
    ${total ? `<div class="total">${esc(trad('Total estimé'))} : ${esc(texteAvecSeparateurs(total))} ${esc(devise)}</div>` : ''}
    ${infos.note ? `<div class="note"><b>${esc(trad('Note'))} :</b> ${esc(infos.note)}</div>` : ''}
    ${f && f.payment_terms ? `<div class="note"><b>${esc(trad('Conditions de paiement'))} :</b> ${esc(f.payment_terms)}</div>` : ''}
  </body></html>`;
}
// ── Bon de commande : PDF (jsPDF) et brouillon de message .eml (ordinateur) ──
// Un lien mailto: ne peut JAMAIS joindre un fichier. Sur ordinateur, on fabrique donc un message complet (destinataire, sujet, texte,
// bon en PDF joint) au format .eml : un double-clic l'ouvre en brouillon dans Outlook (classique), Thunderbird ou Mail ; l'en-tête
// « X-Unsent: 1 » le fait ouvrir en rédaction plutôt qu'en lecture. Sur téléphone, on garde le lien mailto (texte seulement).
function estOrdinateurPourEml() {
  try {
    const cap = window.Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return false;
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return false; // iPad en mode « ordinateur »
    return true;
  } catch (err) { return false; }
}
async function genererBonDeCommandePdf(g, infos) {
  const jsPDF = await loadJsPdfLib();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const T = (d, s, x, y, o) => d.text(pdfTexteSain(s), x, y, o);
  const f = g.fournisseur;
  const lignes = g._lignesFigees || lignesDuBon(g);
  const devise = deviseCourte();
  const total = lignes.reduce((s, x) => s + x.qte * (Number(x.l.piece.unit_price) || 0), 0);
  const MX = 15;
  // coupe un texte trop long pour sa colonne (le tableau dessiné à la main ne passe pas à la ligne)
  const tenir = (texte, largeur) => {
    let s = pdfTexteSain(texte);
    if (doc.getTextWidth(s) <= largeur) return s;
    while (s.length > 1 && doc.getTextWidth(s + '...') > largeur) s = s.slice(0, -1);
    return s.trimEnd() + '...';
  };
  const enTete = () => {
    doc.setFillColor(14, 19, 51);
    doc.rect(0, 0, 210, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    T(doc, UI.companyName || 'KALEA', MX, 11.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    T(doc, `${trad('Bon de commande')} ${infos.reference}`, 195, 11.5, { align: 'right' });
    doc.setTextColor(14, 19, 51);
  };
  enTete();
  let y = 28;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 100);
  T(doc, `${trad('Date')} : ${formatShortDate(todayIso())}${infos.livraison ? '  -  ' + trad('Livraison souhaitée') + ' : ' + formatShortDate(infos.livraison) : ''}`, MX, y);
  y += 8;
  const adresseFourn = f ? [f.legal_name && f.legal_name !== f.name ? f.legal_name : '', f.address, [f.postal_code, f.city].filter(Boolean).join(' '), f.country].filter(Boolean) : [];
  const contact = f ? [f.contact_name, f.phone, f.po_email || f.email].filter(Boolean) : [];
  const carte = (x, titre, textes) => {
    doc.setDrawColor(210, 210, 218);
    doc.roundedRect(x, y, 87, 38, 2, 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 100);
    T(doc, String(titre).toUpperCase(), x + 3, y + 5.5);
    doc.setFontSize(9);
    doc.setTextColor(14, 19, 51);
    // chaque texte peut passer sur plusieurs lignes (adresse de livraison longue) ; le premier (le nom) est en gras ; 6 lignes au plus
    const lignesCarte = [];
    textes.forEach((t, k) => {
      doc.setFont('helvetica', k === 0 ? 'bold' : 'normal');
      doc.splitTextToSize(pdfTexteSain(t), 81).forEach((l) => lignesCarte.push([l, k === 0]));
    });
    lignesCarte.slice(0, 6).forEach(([l, gras], k) => {
      doc.setFont('helvetica', gras ? 'bold' : 'normal');
      T(doc, l, x + 3, y + 11.5 + k * 4.8);
    });
  };
  carte(MX, trad('Commandé par'), [UI.companyName || '', infos.adresse ? `${trad('Adresse de livraison')} : ${infos.adresse}` : ''].filter(Boolean));
  carte(MX + 93, trad('Fournisseur'), [g.nom, ...adresseFourn, ...contact]);
  y += 46;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const LARGEURS = [30, 78, 16, 28, 28];
  const lignesTableau = lignes.map((x) => {
    const p = x.l.piece;
    const prix = Number(p.unit_price) || 0;
    return [
      tenir(p.reference || '-', LARGEURS[0] - 3),
      tenir(`${p.designation}${p.packaging ? ' (' + p.packaging + ')' : ''}`, LARGEURS[1] - 3),
      texteAvecSeparateurs(x.qte),
      prix ? texteAvecSeparateurs(prix) : '-',
      prix ? texteAvecSeparateurs(x.qte * prix) : '-',
    ];
  });
  let py = pdfTableau(doc, {
    x: MX, y, largeurs: LARGEURS,
    entetes: [trad('Référence'), trad('Désignation'), trad('Qté'), trad('Prix unitaire'), trad('Total')],
    alignements: ['left', 'left', 'right', 'right', 'right'], hauteurLigne: 6.5, lignes: lignesTableau, T, onNouvellePage: enTete,
  });
  const place = (hauteur) => { if (py + hauteur > 272) { doc.addPage(); enTete(); py = 28; } };
  py += 7;
  if (total) {
    place(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(14, 19, 51);
    T(doc, `${trad('Total estimé')} : ${texteAvecSeparateurs(total)} ${devise}`, 195, py, { align: 'right' });
    py += 9;
  }
  const paragraphe = (titre, texte) => {
    if (!texte) return;
    const parties = doc.splitTextToSize(pdfTexteSain(`${titre} : ${texte}`), 180);
    place(parties.length * 4.6 + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 70);
    doc.text(parties, MX, py);
    py += parties.length * 4.6 + 3;
  };
  paragraphe(trad('Note'), infos.note);
  paragraphe(trad('Conditions de paiement'), f && f.payment_terms);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 150);
    T(doc, tR('Page {n}/{total}', { n: p, total: pages }), MX, 292);
    T(doc, `KALEA - ${formatShortDate(todayIso())}`, 195, 292, { align: 'right' });
  }
  return doc;
}
// En-tête de message encodé (RFC 2047, UTF-8 en base64) : accents du sujet corrects dans tous les logiciels, mots courts pour ne pas dépasser 76 caractères.
function enteteMimeEncodee(texte) {
  const propre = String(texte || '').replace(/[\r\n]+/g, ' ').trim();
  if (/^[\x20-\x7e]*$/.test(propre)) return propre;
  const encodeur = new TextEncoder();
  const mots = [];
  let courant = '';
  for (const car of propre) {
    if (encodeur.encode(courant + car).length > 42) { mots.push(courant); courant = ''; }
    courant += car;
  }
  if (courant) mots.push(courant);
  return mots.map((m) => '=?UTF-8?B?' + base64DOctets(encodeur.encode(m)) + '?=').join('\r\n ');
}
function base64DOctets(octets) {
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}
function coupeBase64(b64) { return b64.replace(/.{1,76}/g, '$&\r\n').trimEnd(); }
function construireEml({ to, sujet, corps, pj }) {
  const frontiere = '----=_KALEA_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  // adresses : une ou plusieurs (séparées par , ou ;), seulement celles qui ont une forme valide ; aucun retour à la ligne possible
  const destinataires = String(to || '').split(/[;,]/).map((s) => s.trim()).filter((s) => /^[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+$/.test(s));
  const entetes = ['X-Unsent: 1'];
  if (destinataires.length) entetes.push('To: ' + destinataires.join(', '));
  entetes.push('Subject: ' + enteteMimeEncodee(sujet), 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${frontiere}"`);
  const nomPj = String(pj.nom).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
  const corpsOctets = new TextEncoder().encode(String(corps || '').replace(/\r?\n/g, '\r\n'));
  return [
    ...entetes, '',
    `--${frontiere}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', coupeBase64(base64DOctets(corpsOctets)), '',
    `--${frontiere}`, `Content-Type: application/pdf; name="${nomPj}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${nomPj}"`, '', coupeBase64(base64DOctets(pj.octets)), '',
    `--${frontiere}--`, '',
  ].join('\r\n');
}
function ouvrirBonDeCommande(g) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const f = g.fournisseur;
  const emailDest = f ? (f.po_email || f.email || '') : '';
  const peutEnregistrer = !!(SCHEMA.hasCommandes && peutAcheter() && f);
  overlay.innerHTML = `
    <div class="modal export-modal achats-bon-modal" role="dialog" aria-modal="true" aria-labelledby="bon-titre">
      <h2 id="bon-titre">${trad('Bon de commande')} — ${esc(g.nom)}</h2>
      <p class="sub">${trad('Vérifie le bon, puis imprime-le (ou enregistre-le en PDF), copie-le ou envoie-le par e-mail. Il n\'est pas encore enregistré dans l\'application.')}</p>
      <div class="achats-bon-apercu" id="bon-apercu"></div>
      <div class="ui-champ-groupe">
        <label for="bon-ref"><strong>${trad('Référence du bon')}</strong></label>
        <input id="bon-ref" class="ui-champ" maxlength="40" value="${esc(referenceBon(g))}">
        <label for="bon-livraison"><strong>${trad('Livraison souhaitée')}</strong></label>
        <input id="bon-livraison" class="ui-champ" type="date">
        <label for="bon-adresse"><strong>${trad('Adresse de livraison')}</strong></label>
        <input id="bon-adresse" class="ui-champ" maxlength="160" placeholder="${esc(trad('Facultatif'))}">
        <label for="bon-note"><strong>${trad('Note pour le fournisseur')}</strong></label>
        <input id="bon-note" class="ui-champ" maxlength="200" placeholder="${esc(trad('Facultatif'))}">
      </div>
      <div id="bon-msg" class="ui-aide" role="status" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="ui-btn ui-btn-pastille" id="bon-annuler">${trad('Annuler')}</button>
        <button type="button" class="ui-btn ui-btn-pastille" id="bon-copier">${picto('copier')}<span>${trad('Copier')}</span></button>
        <button type="button" class="ui-btn ui-btn-pastille" id="bon-email">${picto('mail')}<span>${trad('Envoyer par e-mail')}</span></button>
        ${peutEnregistrer ? `<button type="button" class="ui-btn ui-btn-plein" id="bon-enregistrer">${picto('coche')}<span>${trad('Enregistrer la commande')}</span></button>` : ''}
        <button type="button" class="ui-btn ${peutEnregistrer ? 'ui-btn-pastille' : 'ui-btn-plein'}" id="bon-imprimer">${picto('export')}<span>${trad('Imprimer / PDF')}</span></button>
      </div>
    </div>`;
  ajouterCroixModale(overlay);
  const q = (s) => overlay.querySelector(s);
  const infos = () => ({ reference: q('#bon-ref').value.trim() || referenceBon(g), livraison: q('#bon-livraison').value, adresse: q('#bon-adresse').value.trim(), note: q('#bon-note').value.trim() });
  // Aperçu du bon : les QUANTITÉS sont modifiables ici (champ par ligne). Elles sont mémorisées dans UI.achatsQuantites, la même réserve que les
  // champs de l'onglet Commandes : les deux restent d'accord. 0 ou vide = ligne ignorée. Les lignes ne sont redessinées qu'à l'ouverture
  // (pas à chaque frappe, pour ne pas perdre le curseur) ; seuls le total et l'état des boutons suivent la saisie.
  const majTotalBon = () => {
    const lignes = lignesDuBon(g);
    const total = lignes.reduce((s, x) => s + x.qte * (Number(x.l.piece.unit_price) || 0), 0);
    const zoneTotal = q('#bon-total');
    if (zoneTotal) zoneTotal.textContent = total ? `${trad('Total estimé')} : ${texteAvecSeparateurs(total)} ${deviseCourte()}` : '';
    ['#bon-imprimer', '#bon-copier', '#bon-email'].forEach((s) => { const b = q(s); if (b) b.disabled = !lignes.length; });
    const aide = q('#bon-aide-vide');
    if (aide) aide.hidden = !!lignes.length;
  };
  const apercu = () => {
    const lignes = g.lignes.filter(ligneEstInclue);
    q('#bon-apercu').innerHTML = lignes.length
      ? `<table class="achats-bon-table"><tbody>${lignes.map((l) => `<tr><td>${esc(l.piece.designation)}${l.piece.reference ? `<span class="ui-ligne-sous">${esc(l.piece.reference)}</span>` : ''}</td><td class="n"><input class="ui-champ achats-bon-qte" type="text" inputmode="decimal" data-bon-qte="${esc(l.id)}" value="${esc(String(quantiteAchat(l)))}" aria-label="${esc(tR('Quantité de {nom}', { nom: l.piece.designation }))}"></td></tr>`).join('')}</tbody></table><div class="achats-bon-total" id="bon-total"></div><div class="ui-aide is-late" id="bon-aide-vide" hidden>${trad('Aucune ligne à commander : mets une quantité sur au moins une pièce.')}</div>`
      : `<div class="ui-aide is-late">${trad('Aucune ligne à commander : coche au moins une pièce avec une quantité.')}</div>`;
    majTotalBon();
  };
  apercu();
  q('#bon-apercu').addEventListener('input', (e) => {
    const champ = e.target.closest('[data-bon-qte]');
    if (!champ) return;
    const id = champ.getAttribute('data-bon-qte');
    (UI.achatsQuantites = UI.achatsQuantites || {})[id] = champ.value;
    majTotalBon();
    // même quantité dans la liste de l'onglet Commandes (derrière la fenêtre)
    const racine = document.getElementById('view-root');
    const champListe = racine && racine.querySelector(`[data-achats-qte="${CSS.escape(id)}"]`);
    if (champListe) { champListe.value = champ.value; majTotauxAchats(racine, racine._lignesAchats || []); }
  });
  q('#bon-annuler').addEventListener('click', () => overlay.remove());
  q('#bon-enregistrer')?.addEventListener('click', async (e) => {
    const bouton = e.currentTarget;
    const lignes = lignesDuBon(g);
    if (!lignes.length) return;
    const i = infos();
    bouton.disabled = true;
    q('#bon-msg').textContent = trad('Enregistrement…');
    const { data, error } = await sb.rpc('creer_commande', {
      p_supplier_id: f.id,
      p_lines: lignes.map((x) => ({ part_id: x.l.piece.id, quantity: x.qte, unit_price: Number(x.l.piece.unit_price) || 0, suggested_qty: x.l.aCommander, reason: x.l.raisons.join(',') })),
      p_requested_delivery: i.livraison || null,
      p_address: i.adresse || null,
      p_note: i.note || null,
      p_warehouse_id: null,
    });
    if (error) { q('#bon-msg').textContent = trad('Erreur :') + ' ' + error.message; bouton.disabled = false; return; }
    q('#bon-ref').value = data.reference;
    q('#bon-ref').readOnly = true;
    bouton.hidden = true;
    overlay.querySelectorAll('[data-bon-qte]').forEach((c) => { c.readOnly = true; }); // la commande est enregistrée avec ces quantités : plus de modification
    q('#bon-msg').textContent = tR('Commande {ref} enregistrée (brouillon). Imprime-la ou envoie-la, puis marque-la envoyée depuis la liste des commandes.', { ref: data.reference });
    showToast(trad('Commande enregistrée'));
    const racine = document.getElementById('view-root');
    if (racine) { await rafraichirCommandes(racine); rafraichirAchats(racine); }
  });
  q('#bon-imprimer').addEventListener('click', () => imprimerDocumentHtml(documentBonDeCommandeHtml(g, infos())));
  q('#bon-copier').addEventListener('click', async () => {
    const texte = texteBonDeCommande(g, infos());
    try { await navigator.clipboard.writeText(texte); q('#bon-msg').textContent = trad('Bon copié dans le presse-papiers.'); }
    catch (e) { q('#bon-msg').textContent = trad('Copie impossible sur cet appareil : utilise « Imprimer / PDF ».'); }
  });
  q('#bon-email')?.addEventListener('click', async (e) => {
    const bouton = e.currentTarget;
    const i = infos();
    const sujet = `${trad('Bon de commande')} ${i.reference} — ${UI.companyName || ''}`;
    // Téléphone : lien mailto (le bon en texte dans le message, sans pièce jointe — un lien mailto ne peut pas en joindre).
    if (!estOrdinateurPourEml()) {
      window.location.href = `mailto:${encodeURIComponent(emailDest)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(texteBonDeCommande(g, i))}`;
      return;
    }
    // Ordinateur : brouillon .eml (destinataire + texte + bon en PDF joint), ouvert par double-clic dans le logiciel de messagerie.
    bouton.disabled = true;
    q('#bon-msg').textContent = trad('Préparation du message…');
    try {
      const doc = await genererBonDeCommandePdf(g, i);
      const corps = `${trad('Bonjour,')}\n\n${tR('Veuillez trouver ci-joint notre bon de commande {ref}.', { ref: i.reference })}\n\n${trad('Cordialement,')}\n${UI.companyName || ''}\n\n—\n${texteBonDeCommande(g, i)}`;
      const eml = construireEml({ to: emailDest, sujet, corps, pj: { nom: `${i.reference}.pdf`, octets: new Uint8Array(doc.output('arraybuffer')) } });
      const nom = `${i.reference}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
      await telechargerFichierBinaire(new Blob([eml], { type: 'message/rfc822' }), `${nom}.eml`, 'message/rfc822');
      q('#bon-msg').textContent = emailDest
        ? trad('Brouillon téléchargé : ouvre le fichier .eml (double-clic) pour l\'écrire dans ton logiciel de messagerie, avec le fournisseur en destinataire et le bon en PDF joint. Rien ne s\'ouvre ? Utilise « Copier » ou « Imprimer / PDF ».')
        : trad('Brouillon téléchargé : ouvre le fichier .eml (double-clic), le bon est en PDF joint. Ce fournisseur n\'a pas d\'adresse e-mail : renseigne-la dans sa fiche pour qu\'elle soit préremplie.');
    } catch (err) {
      q('#bon-msg').textContent = trad('Préparation impossible :') + ' ' + ((err && err.message) || trad('erreur inconnue')) + ' — ' + trad('utilise « Copier » ou « Imprimer / PDF ».');
    } finally {
      bouton.disabled = !lignesDuBon(g).length;
    }
  });
}

// ── Commandes enregistrées : suivi et réception (kalea-serveur/migrations/stock-commandes.sql) ──────────────
const STATUTS_COMMANDE_OUVERTS = ['brouillon', 'envoyee', 'partielle'];
function libelleStatutCommande(statut) {
  return ({ brouillon: trad('Brouillon'), envoyee: trad('Envoyée'), partielle: trad('Partielle'), recue: trad('Reçue'), annulee: trad('Annulée') })[statut] || statut;
}
function classeStatutCommande(statut) {
  return ({ brouillon: '', envoyee: 'is-bientot', partielle: 'is-bientot', recue: 'is-ok', annulee: 'is-retard' })[statut] || '';
}
async function chargerCommandes() {
  const { data, error } = await sb.from('purchase_orders').select('*').eq('company_id', UI.companyId)
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  UI.commandes = data || [];
  const ouvertes = UI.commandes.filter((c) => STATUTS_COMMANDE_OUVERTS.includes(c.status)).map((c) => c.id);
  UI.commandesLignes = [];
  if (ouvertes.length) {
    const { data: lignes, error: err2 } = await sb.from('purchase_order_lines').select('*').in('order_id', ouvertes).eq('company_id', UI.companyId);
    if (err2) throw err2;
    UI.commandesLignes = lignes || [];
  }
}
// Reste à recevoir par pièce, sur les commandes ouvertes : sert à ne pas re-proposer ce qui est déjà commandé.
function quantitesEnCommande() {
  const parPiece = new Map();
  (UI.commandesLignes || []).forEach((l) => {
    if (!l.part_id) return;
    const reste = Math.max(0, (Number(l.quantity_ordered) || 0) - (Number(l.quantity_received) || 0));
    if (reste > 0) parPiece.set(String(l.part_id), (parPiece.get(String(l.part_id)) || 0) + reste);
  });
  return parPiece;
}
function blocCommandesHtml() {
  return `
    <section class="ui-section" id="commandes-section">
      ${teteSectionKit('calendrier', trad('Commandes fournisseurs'), trad('Commandes enregistrées : à envoyer, en attente de livraison, reçues.'),
        `<span class="ui-tag" id="commandes-badge"></span>`)}
      <div class="ui-section-corps">
        <div class="ui-liste is-defilant" id="commandes-liste"><div class="ui-aide">${trad('Chargement…')}</div></div>
      </div>
    </section>`;
}
function ligneCommandeHtml(c) {
  const classe = classeStatutCommande(c.status);
  const sous = [
    c.supplier_name,
    // le nombre de pièces n'est connu que pour les commandes en cours (leurs lignes sont déjà chargées) : sinon, le total seul
    lignesDeCommande(c.id).length
      ? tR('{n} pièce(s) · {t}', { n: lignesDeCommande(c.id).length, t: texteAvecSeparateurs(Number(c.total_estimated) || 0) + ' ' + deviseCourte() })
      : texteAvecSeparateurs(Number(c.total_estimated) || 0) + ' ' + deviseCourte(),
    formatShortDate(String(c.created_at).slice(0, 10)),
    c.requested_delivery ? tR('Livraison souhaitée {d}', { d: formatShortDate(c.requested_delivery) }) : '',
  ].filter(Boolean).join(' · ');
  return `
    <div class="ui-ligne is-deux ${classe}" data-commande-id="${esc(c.id)}">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone">${picto('export')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(c.reference)}<span class="ui-statut ${classe}">${esc(libelleStatutCommande(c.status))}</span></span>
          <span class="ui-ligne-sous" data-essentiel="1">${esc(sous)}</span>
        </div>
      </div>
      <div class="ui-ligne-action">
        <button type="button" class="ui-btn ui-btn-pastille" data-commande-ouvrir="${esc(c.id)}">${trad('Ouvrir')}</button>
      </div>
    </div>`;
}
function lignesDeCommande(id) { return (UI.commandesLignes || []).filter((l) => String(l.order_id) === String(id)); }
function dessinerCommandes(root) {
  const zone = root.querySelector('#commandes-liste');
  if (!zone) return;
  const liste = UI.commandes || [];
  const ouvertes = liste.filter((c) => STATUTS_COMMANDE_OUVERTS.includes(c.status));
  const closes = liste.filter((c) => !STATUTS_COMMANDE_OUVERTS.includes(c.status));
  const badge = root.querySelector('#commandes-badge');
  if (badge) badge.textContent = tR('{n} en cours', { n: ouvertes.length });
  // « Aucune commande en cours » se lit AVANT l'historique (et non en dessous, où il semblait dire que l'historique est vide).
  zone.innerHTML = liste.length
    ? (ouvertes.length ? '' : `<div class="ui-aide">${trad('Aucune commande en cours.')}</div>`)
      + ouvertes.map(ligneCommandeHtml).join('')
      + (closes.length ? `<details class="commandes-historique"><summary>${tR('Historique ({n})', { n: closes.length })}</summary><div class="ui-liste">${closes.slice(0, 30).map(ligneCommandeHtml).join('')}</div></details>` : '')
    : `<div class="ui-aide">${trad('Aucune commande enregistrée. Prépare un bon ci-dessus puis enregistre-le.')}</div>`;
}
async function rafraichirCommandes(root) {
  const zone = root.querySelector('#commandes-liste');
  if (!zone) return;
  try { await chargerCommandes(); } catch (err) {
    zone.innerHTML = `<div class="ui-aide is-late">${esc(trad('Erreur de chargement :') + ' ' + (err.message || err))}</div>`;
    return;
  }
  if (!root.isConnected) return;
  dessinerCommandes(root);
}
// Une commande enregistrée, sous la forme attendue par le document et le texte du bon.
function groupeDepuisCommande(c, lignes) {
  const f = c.supplier_id ? fournisseurParId(c.supplier_id) : null;
  return {
    cle: 'commande:' + c.id, fournisseur: f, nom: c.supplier_name,
    _lignesFigees: lignes.map((l) => ({
      l: { piece: { reference: l.reference, designation: l.designation, packaging: l.packaging, unit_price: l.unit_price } },
      qte: Number(l.quantity_ordered) || 0,
    })),
  };
}
async function ouvrirCommande(orderId, rafraichir) {
  const c = (UI.commandes || []).find((x) => String(x.id) === String(orderId));
  if (!c) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `<div class="modal export-modal achats-bon-modal"><div class="ui-aide">${trad('Chargement…')}</div></div>`;
  let lignes = [];
  try {
    const { data, error } = await sb.from('purchase_order_lines').select('*').eq('order_id', c.id).order('designation', { ascending: true });
    if (error) throw error;
    lignes = data || [];
  } catch (err) {
    overlay.querySelector('.modal').innerHTML = `<div class="ui-aide is-late">${esc(trad('Erreur de chargement :') + ' ' + (err.message || err))}</div>`;
    return;
  }
  const gerant = peutAcheter();
  const peutRecevoir = (peutGererMouvementsStock() || peutAcheter());
  const ouverte = STATUTS_COMMANDE_OUVERTS.includes(c.status);
  const classe = classeStatutCommande(c.status);
  overlay.innerHTML = `
    <div class="modal export-modal achats-bon-modal" role="dialog" aria-modal="true" aria-labelledby="cmd-titre">
      <h2 id="cmd-titre">${esc(c.reference)} <span class="ui-statut ${classe}">${esc(libelleStatutCommande(c.status))}</span></h2>
      <p class="sub" data-essentiel="1">${esc([c.supplier_name, formatShortDate(String(c.created_at).slice(0, 10)), c.requested_delivery ? tR('Livraison souhaitée {d}', { d: formatShortDate(c.requested_delivery) }) : ''].filter(Boolean).join(' · '))}</p>
      <div class="achats-bon-apercu">
        <table class="achats-bon-table"><tbody>
          ${lignes.map((l) => {
            const reste = (Number(l.quantity_ordered) || 0) - (Number(l.quantity_received) || 0);
            return `<tr><td>${esc(l.designation)}${l.reference ? `<span class="ui-ligne-sous">${esc(l.reference)}</span>` : ''}</td><td class="n">${esc(texteAvecSeparateurs(Number(l.quantity_received) || 0))} / ${esc(texteAvecSeparateurs(Number(l.quantity_ordered) || 0))}${reste > 0 && ouverte && Number(l.quantity_received) > 0 ? `<span class="ui-ligne-sous">${tR('reste {n}', { n: texteAvecSeparateurs(reste) })}</span>` : ''}</td></tr>`;
          }).join('')}
        </tbody></table>
        <div class="achats-bon-total">${trad('Total estimé')} : ${esc(texteAvecSeparateurs(Number(c.total_estimated) || 0))} ${esc(deviseCourte())}</div>
      </div>
      ${c.note ? `<p class="ui-aide">${trad('Note')} : ${esc(c.note)}</p>` : ''}
      ${c.close_note ? `<p class="ui-aide">${esc(c.close_note)}</p>` : ''}
      <div id="cmd-msg" class="ui-aide" role="status" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="ui-btn ui-btn-pastille" id="cmd-fermer">${trad('Fermer')}</button>
        <button type="button" class="ui-btn ui-btn-pastille" id="cmd-imprimer">${picto('export')}<span>${trad('Imprimer / PDF')}</span></button>
        ${gerant && c.status === 'brouillon' ? `<button type="button" class="ui-btn ui-btn-pastille" id="cmd-envoyee">${trad('Marquer envoyée')}</button>` : ''}
        ${gerant && ['brouillon', 'envoyee'].includes(c.status) ? `<button type="button" class="ui-btn ui-btn-pastille is-danger" id="cmd-annuler">${trad('Annuler la commande')}</button>` : ''}
        ${gerant && c.status === 'partielle' ? `<button type="button" class="ui-btn ui-btn-pastille" id="cmd-cloturer">${trad('Clôturer (solde abandonné)')}</button>` : ''}
        ${peutRecevoir && ouverte ? `<button type="button" class="ui-btn ui-btn-plein" id="cmd-recevoir">${picto('coche')}<span>${trad('Réceptionner')}</span></button>` : ''}
      </div>
    </div>`;
  ajouterCroixModale(overlay);
  const q = (s) => overlay.querySelector(s);
  const msg = q('#cmd-msg');
  const apres = async () => { overlay.remove(); await chargerCommandes(); if (rafraichir) rafraichir(); };
  q('#cmd-fermer').addEventListener('click', () => overlay.remove());
  q('#cmd-imprimer').addEventListener('click', () => imprimerDocumentHtml(documentBonDeCommandeHtml(groupeDepuisCommande(c, lignes), { reference: c.reference, livraison: c.requested_delivery || '', adresse: c.delivery_address || '', note: c.note || '' })));
  const action = (sel, nomRpc, args, texteOk, confirmation) => q(sel)?.addEventListener('click', async (e) => {
    if (confirmation && !window.confirm(confirmation)) return;
    e.currentTarget.disabled = true;
    msg.textContent = trad('Enregistrement…');
    const { error } = await sb.rpc(nomRpc, args);
    if (error) { msg.textContent = trad('Erreur :') + ' ' + error.message; e.currentTarget.disabled = false; return; }
    showToast(texteOk);
    await apres();
  });
  action('#cmd-envoyee', 'marquer_commande_envoyee', { p_order_id: c.id }, trad('Commande marquée envoyée'));
  action('#cmd-annuler', 'annuler_commande', { p_order_id: c.id, p_reason: null }, trad('Commande annulée'), trad('Annuler cette commande ?'));
  action('#cmd-cloturer', 'cloturer_commande', { p_order_id: c.id }, trad('Commande clôturée'), trad('Clôturer : le solde non livré sera abandonné. Continuer ?'));
  q('#cmd-recevoir')?.addEventListener('click', () => { overlay.remove(); ouvrirReceptionCommande(c, lignes, rafraichir); });
}
function ouvrirReceptionCommande(c, lignes, rafraichir) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const magasins = (UI.warehouses || []).filter((w) => w.active !== false);
  const defaut = c.default_warehouse_id && magasins.some((w) => String(w.id) === String(c.default_warehouse_id)) ? c.default_warehouse_id : (magasins[0] && magasins[0].id);
  const aRecevoir = lignes.filter((l) => (Number(l.quantity_ordered) || 0) - (Number(l.quantity_received) || 0) > 0);
  overlay.innerHTML = `
    <div class="modal export-modal achats-bon-modal" role="dialog" aria-modal="true" aria-labelledby="rec-titre">
      <h2 id="rec-titre">${trad('Réceptionner')} ${esc(c.reference)}</h2>
      <p class="sub">${trad('Indique ce qui est réellement arrivé. Chaque quantité reçue entre en stock dans le magasin choisi, au prix indiqué (il alimente le coût moyen du stock).')}</p>
      <div class="ui-champ-groupe">
        <label for="rec-magasin"><strong>${trad('Magasin de réception')}</strong></label>
        <div class="ui-select-wrap"><select id="rec-magasin" class="ui-champ">${magasins.map((w) => `<option value="${esc(w.id)}"${String(w.id) === String(defaut) ? ' selected' : ''}>${esc(w.name)}</option>`).join('')}</select>${picto('chevronBas')}</div>
      </div>
      <div class="achats-lignes" id="rec-lignes">
        ${aRecevoir.map((l) => {
          const reste = (Number(l.quantity_ordered) || 0) - (Number(l.quantity_received) || 0);
          return `<div class="achats-ligne is-ok" data-rec-ligne="${esc(l.id)}">
            <span></span>
            <div class="achats-textes"><span class="ui-ligne-nom">${esc(l.designation)}</span><span class="ui-ligne-sous">${esc([l.reference, tR('Reste à recevoir : {n}', { n: texteAvecSeparateurs(reste) })].filter(Boolean).join(' · '))}</span></div>
            <div class="achats-qte">
              <label class="sr-only" for="rec-qte-${esc(l.id)}">${trad('Quantité reçue')}</label>
              <input id="rec-qte-${esc(l.id)}" class="ui-champ" type="text" inputmode="decimal" data-rec-qte="${esc(l.id)}" value="${esc(String(reste))}">
              <label class="sr-only" for="rec-cout-${esc(l.id)}">${trad('Prix unitaire reçu')}</label>
              <input id="rec-cout-${esc(l.id)}" class="ui-champ" type="text" inputmode="decimal" data-rec-cout="${esc(l.id)}" value="${esc(String(Number(l.unit_price) || 0))}" title="${esc(trad('Prix unitaire'))}">
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="ui-champ-groupe">
        <label for="rec-note"><strong>${trad('Note (bon de livraison…)')}</strong></label>
        <input id="rec-note" class="ui-champ" maxlength="200" placeholder="${esc(trad('Facultatif'))}">
      </div>
      <div id="rec-msg" class="ui-aide" role="status" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="ui-btn ui-btn-pastille" id="rec-annuler">${trad('Annuler')}</button>
        <button type="button" class="ui-btn ui-btn-plein" id="rec-go">${picto('coche')}<span>${trad('Valider la réception')}</span></button>
      </div>
    </div>`;
  ajouterCroixModale(overlay);
  const q = (s) => overlay.querySelector(s);
  q('#rec-annuler').addEventListener('click', () => overlay.remove());
  q('#rec-go').addEventListener('click', async (e) => {
    const bouton = e.currentTarget;
    const msg = q('#rec-msg');
    const recues = [...overlay.querySelectorAll('[data-rec-ligne]')].map((el) => {
      const id = el.getAttribute('data-rec-ligne');
      return { line_id: id, quantity: nombrePositif(q(`[data-rec-qte="${CSS.escape(id)}"]`).value, 0), unit_cost: nombrePositif(q(`[data-rec-cout="${CSS.escape(id)}"]`).value, 0) };
    }).filter((x) => x.quantity > 0);
    if (!recues.length) { msg.textContent = trad('Indique au moins une quantité reçue.'); return; }
    bouton.disabled = true;
    msg.textContent = trad('Enregistrement…');
    const { error } = await sb.rpc('receptionner_commande', { p_order_id: c.id, p_warehouse_id: q('#rec-magasin').value, p_lines: recues, p_note: q('#rec-note').value.trim() || null });
    if (error) { msg.textContent = trad('Erreur :') + ' ' + error.message; bouton.disabled = false; return; }
    try { await rechargerSoldesStock(); } catch (err) { /* les soldes se mettront à jour au prochain chargement */ }
    showToast(trad('Réception enregistrée : le stock est à jour'));
    overlay.remove();
    await chargerCommandes();
    renderApp();
  });
}

// ── Onglets du menu Stock ── la page regroupait 9 blocs sur 4 écrans : on la
// découpe par USAGE (consulter / bouger / compter / régler). L'onglet choisi
// est gardé dans UI.stockOnglet pour survivre aux renderApp().
function stockOngletsDisponibles() {
  const liste = [];
  if (SCHEMA.hasKits) liste.push({ id: 'apercu', libelle: trad('Aperçu'), picto: 'alerte', aide: trad('Les pièces à commander avant les prochains entretiens.') });
  liste.push({ id: 'pieces', libelle: trad('Pièces'), picto: 'boite', aide: trad('Ce qu\'il y a en stock, magasin par magasin, et le catalogue des références.') });
  liste.push({ id: 'mouvements', libelle: trad('Mouvements'), picto: 'calendrier', aide: trad('Entrées, sorties, transferts et ajustements.') });
  if (SCHEMA.hasStock && (peutGererMouvementsStock() || peutAcheter())) liste.push({ id: 'achats', libelle: trad('Commandes'), picto: 'export', aide: trad('Bon de commande suggéré : les pièces à commander avant la rupture.') });
  if (inventairePhysiquePossible()) liste.push({ id: 'inventaire', libelle: trad('Inventaire'), picto: 'coche', aide: trad('Compter le stock réel et régulariser les écarts.') });
  liste.push({ id: 'organisation', libelle: trad('Réglages'), picto: 'reglages', aide: trad('Magasins, fournisseurs et kits d\'entretien (réglages rarement modifiés).') });
  return liste;
}
function stockOngletActif(onglets) {
  const voulu = UI.stockOnglet;
  if (onglets.some((o) => o.id === voulu)) return voulu;
  return onglets.some((o) => o.id === 'pieces') ? (onglets[0].id === 'apercu' ? 'apercu' : 'pieces') : onglets[0].id;
}
function stockGuideHtml(onglets) {
  const cartes = onglets.filter((o) => o.id !== 'apercu');
  return `
    <section class="ui-section">
      ${teteSectionKit('info', trad('Où trouver quoi ?'), '')}
      <div class="ui-section-corps">
        <div class="stock-guide">
          ${cartes.map((o) => `<button type="button" class="stock-guide-carte" data-stock-aller="${o.id}">${picto(o.picto)}<span class="stock-guide-texte"><strong>${esc(o.libelle)}</strong><span>${esc(o.aide)}</span></span></button>`).join('')}
        </div>
      </div>
    </section>`;
}
// Bascule d'onglet : sans renderApp() (les blocs sont déjà dans la page).
function stockAllerOnglet(root, id) {
  const bouton = root.querySelector(`[data-stock-onglet="${id}"]`);
  if (!bouton) return;
  UI.stockOnglet = id;
  root.querySelectorAll('[data-stock-onglet]').forEach((b) => {
    const actif = b === bouton;
    b.classList.toggle('is-actif', actif);
    b.setAttribute('aria-selected', String(actif));
  });
  root.querySelectorAll('.stock-panneau').forEach((p) => { p.hidden = p.id !== `stock-panneau-${id}`; });
}

VIEWS.stock = {
  fondBlanc: true,
  title: trad('Stocks & SAV'),
  subtitle: () => trad('Magasins, mouvements et valorisation du stock'),
  render() {
    // Le menu Stock est découpé en onglets (tous les blocs restent dans la page,
    // seul l'onglet actif est visible) : les branchements de mount() retrouvent
    // donc leurs éléments par identifiant, où qu'ils soient rangés.
    const onglets = stockOngletsDisponibles();
    const actif = stockOngletActif(onglets);
    const panneau = (id, contenu) => `<div class="stock-panneau" role="tabpanel" id="stock-panneau-${id}" aria-labelledby="stock-onglet-${id}"${id === actif ? '' : ' hidden'}>${contenu}</div>`;
    const piecesActives = UI.stockPiecesVue === 'catalogue' ? 'catalogue' : 'stock';
    return `
      <div class="ui-page">
        ${stockKpiGridHtml()}
        <div class="stock-onglets" role="tablist" aria-label="${esc(trad('Sections du stock'))}">
          ${onglets.map((o) => `<button type="button" class="stock-onglet${o.id === actif ? ' is-actif' : ''}" role="tab" id="stock-onglet-${o.id}" aria-selected="${o.id === actif}" aria-controls="stock-panneau-${o.id}" data-stock-onglet="${o.id}">${picto(o.picto)}<span>${esc(o.libelle)}</span></button>`).join('')}
        </div>
        ${onglets.some((o) => o.id === 'apercu') ? panneau('apercu', `
          ${blocBesoinsRisqueStockHtml()}
          ${stockGuideHtml(onglets)}`) : ''}
        ${panneau('pieces', `
          <div class="ui-segment stock-pieces-vues" role="group" aria-label="${esc(trad('Affichage des pièces'))}">
            <button type="button" data-stock-pieces-vue="stock" class="${piecesActives === 'stock' ? 'is-actif' : ''}">${trad('Stock par magasin')}</button>
            <button type="button" data-stock-pieces-vue="catalogue" class="${piecesActives === 'catalogue' ? 'is-actif' : ''}">${trad('Catalogue de pièces')}</button>
          </div>
          <div class="stock-pieces-vue" data-stock-pieces-bloc="stock"${piecesActives === 'stock' ? '' : ' hidden'}>${blocInventaireStockHtml()}</div>
          <div class="stock-pieces-vue" data-stock-pieces-bloc="catalogue"${piecesActives === 'catalogue' ? '' : ' hidden'}>${blocCatalogueTcoHtml()}</div>`)}
        ${panneau('mouvements', blocMouvementsStockHtml())}
        ${onglets.some((o) => o.id === 'achats') ? panneau('achats', blocAchatsHtml()) : ''}
        ${inventairePhysiquePossible() ? panneau('inventaire', blocInventairePhysiqueHtml()) : ''}
        ${panneau('organisation', `
          ${blocMagasinsStockHtml()}
          ${fournisseursActifs() ? blocFournisseursStockHtml() : ''}
          ${SCHEMA.hasKits ? blocKitsEntretienStockHtml() : ''}`)}
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

    // ── Onglets, guide « Où trouver quoi ? » et tuiles de chiffres cliquables. ──
    root.addEventListener('click', (e) => {
      const onglet = e.target.closest('[data-stock-onglet]');
      if (onglet) { stockAllerOnglet(root, onglet.getAttribute('data-stock-onglet')); return; }
      const aller = e.target.closest('[data-stock-aller]');
      if (aller) { stockAllerOnglet(root, aller.getAttribute('data-stock-aller')); window.scrollTo({ top: 0 }); return; }
      const vue = e.target.closest('[data-stock-pieces-vue]');
      if (vue) {
        const choix = vue.getAttribute('data-stock-pieces-vue');
        UI.stockPiecesVue = choix;
        root.querySelectorAll('[data-stock-pieces-vue]').forEach((b) => b.classList.toggle('is-actif', b === vue));
        root.querySelectorAll('[data-stock-pieces-bloc]').forEach((b) => { b.hidden = b.getAttribute('data-stock-pieces-bloc') !== choix; });
      }
    });
    root.querySelectorAll('.stock-tuile-lien').forEach((t) => t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); }
    }));
    root.querySelector('[role="tablist"]')?.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const boutons = [...root.querySelectorAll('[data-stock-onglet]')];
      const i = boutons.indexOf(document.activeElement);
      if (i < 0) return;
      const suivant = boutons[(i + (e.key === 'ArrowRight' ? 1 : boutons.length - 1)) % boutons.length];
      suivant.focus();
      stockAllerOnglet(root, suivant.getAttribute('data-stock-onglet'));
    });

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
    cablerAchats(root);

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
    root.querySelector('#stock-emplacement-ajouter')?.addEventListener('click', () => ouvrirModaleEmplacementStock());
    root.querySelector('#stock-etiquettes-ouvrir')?.addEventListener('click', ouvrirModaleEtiquettes);
    root.querySelector('#stock-inventaire-liste')?.addEventListener('click', (e) => {
      const commander = e.target.closest('[data-stock-commander]');
      if (commander) { commanderPieceDepuisStock(root, commander.getAttribute('data-stock-commander')); return; }
      const bouton = e.target.closest('[data-stock-emplacement]');
      if (!bouton) return;
      const [partId, magasinId] = bouton.getAttribute('data-stock-emplacement').split('|');
      ouvrirModaleEmplacementStock(partId, magasinId);
    });

    // ── Fournisseurs : création / modification / suppression (gérant). ──
    if (fournisseursActifs()) {
      root.querySelector('#stock-fournisseur-recherche')?.addEventListener('input', (e) => {
        UI.stockRechercheFournisseurs = e.target.value;
        const zone = root.querySelector('#stock-fournisseurs-liste');
        if (zone) zone.innerHTML = listeFournisseursHtml();
        const badge = root.querySelector('#stock-fournisseurs-badge');
        if (badge) badge.textContent = UI.stockRechercheFournisseurs ? tR('{a} / {n} fournisseur(s)', { a: fournisseursFiltres().length, n: (UI.suppliers || []).length }) : tR('{n} fournisseur(s)', { n: (UI.suppliers || []).length });
      });
      root.querySelector('#stock-fournisseur-nouveau')?.addEventListener('click', () => ouvrirEditionFournisseur(null));
      root.querySelector('#stock-fournisseurs-liste')?.addEventListener('click', (e) => {
        const modifier = e.target.closest('[data-fournisseur-modifier]');
        if (modifier) {
          const f = fournisseurParId(modifier.getAttribute('data-fournisseur-modifier'));
          if (f) ouvrirEditionFournisseur(f);
          return;
        }
        const retirer = e.target.closest('[data-fournisseur-retirer]');
        if (retirer) supprimerFournisseur(retirer.getAttribute('data-fournisseur-retirer'));
      });
    }

    // ── Inventaire physique : liste des sessions chargée en asynchrone (jamais au boot). ──
    if (inventairePhysiquePossible()) {
      const listeInv = root.querySelector('#invphys-liste');
      const dessinerInv = () => {
        if (!listeInv) return;
        const sessions = UI.inventairesPhysiques || [];
        listeInv.innerHTML = sessions.length
          ? sessions.map(ligneInventairePhysiqueHtml).join('')
          : `<div class="ui-aide">${trad('Aucun inventaire pour l\'instant.')}</div>`;
      };
      chargerInventairesPhysiques().then(dessinerInv).catch((err) => {
        if (listeInv) listeInv.innerHTML = `<div class="ui-aide">${esc(trad('Erreur :') + ' ' + (err.message || err))}</div>`;
      });
      root.querySelector('#invphys-nouveau')?.addEventListener('click', () => {
        ouvrirNouvelInventaire((c) => { renderApp(); ouvrirSessionInventaire(c.id); });
      });
      listeInv?.addEventListener('click', (e) => {
        const bouton = e.target.closest('[data-invphys-ouvrir]');
        if (bouton) ouvrirSessionInventaire(bouton.getAttribute('data-invphys-ouvrir'));
      });
    }

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
