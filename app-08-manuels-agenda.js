/* KALEA — application (app.html) : Vues Manuels, Agenda et Rappels.
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · Vue : Manuels & carnets
 *   · Vue : Agenda
 *   · Préparation des entretiens
 *   · Chronologie : une carte par échéance, avec l'action qui va avec son état ──
 *   · Agenda : calendrier mensuel réel
 *   · Vue : Rappels
 */
// ───────────────────────── début du code ─────────────────────────
// ── Vue : Manuels & carnets ───────────────────────────────────
// État des filtres de l'écran Manuels : même forme que fleetFilters(), pour
// les mêmes raisons (persister entre deux rendus, sans toucher au reste de UI).
function manuelsFilters() {
  if (!UI.manuelsFiltres) UI.manuelsFiltres = { q: '', status: 'all' };
  return UI.manuelsFiltres;
}

// L'état d'un carnet, en TROIS mots, les mêmes partout sur cet écran :
//   analyse — un plan a été extrait (au moins une échéance) ;
//   valider — un carnet est déposé, mais rien n'en est encore sorti ;
//   aucun   — rien n'a été déposé pour cette machine.
function etatManuel(m) {
  const items = normalizeItems(m.plan?.items);
  if (items.length) return 'analyse';
  if (m.manual_url) return 'valider';
  return 'aucun';
}

function manuelsMatches() {
  const f = manuelsFilters();
  const q = (f.q || '').trim().toLowerCase();
  return UI.machines.filter((m) => {
    const etat = etatManuel(m);
    if (f.status === 'analyse' && etat !== 'analyse') return false;
    if (f.status === 'valider' && etat !== 'valider') return false;
    if (!q) return true;
    const hay = `${m.name} ${machineBrandModel(m) || ''} ${m.category?.name || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function manuelChipHtml(status, label, count) {
  const active = manuelsFilters().status === status;
  return `<button type="button" class="ui-puce${active ? ' is-actif' : ''}" data-manuel-chip data-status="${status}" aria-pressed="${active ? 'true' : 'false'}"><span>${esc(label)}</span><span class="ui-compte">${count}</span></button>`;
}

// Une carte par machine : vignette (photo, ou repère du carnet), état,
// nom du fichier déposé, nombre d'échéances extraites, et les actions déjà
// existantes (Voir le plan / Ouvrir le PDF / Déposer ou Remplacer).
function manuelCarteHtml(m) {
  const items = normalizeItems(m.plan?.items);
  const hasManual = !!m.manual_url;
  const etat = etatManuel(m);
  const classe = { analyse: 'is-ok', valider: 'is-bientot', aucun: '' }[etat];
  const label = { analyse: trad('ANALYSÉ'), valider: trad('À VALIDER'), aucun: trad('AUCUN') }[etat];
  const sub = hasManual
    ? (items.length ? tR('{n} échéance(s) extraite(s) du carnet', { n: items.length }) : trad('Carnet déposé, plan non encore extrait'))
    : trad('Aucun carnet déposé');
  const meta = [machineBrandModel(m), m.category?.name].filter(Boolean).join(' · ');
  const photo = safeUrl(m.image_url);
  return `
    <article class="ui-ligne is-deux ${classe}">
      <div class="ui-ligne-id">
        <div class="ui-ligne-icone" aria-hidden="true">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : picto('carnet')}</div>
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(m.name)}<span class="ui-statut ${classe}">${label}</span></span>
          ${meta ? `<span class="ui-ligne-sous">${esc(meta)}</span>` : ''}
          <span class="ui-ligne-sous">${esc(sub)}</span>
        </div>
      </div>
      <div class="ui-ligne-action is-etiquettes">
        ${items.length ? `<button type="button" class="ui-btn ui-btn-pastille" data-plan="${esc(m.id)}">${picto('plan')}<span>${trad('Voir le plan')}</span></button>` : ''}
        ${hasManual ? `<button type="button" class="ui-btn ui-btn-teinte view-manual" data-path="${esc(m.manual_url)}">${picto('photo')}<span>${trad('Ouvrir le PDF')}</span></button>` : ''}
        <button type="button" class="ui-btn ui-btn-teinte" data-manual="${esc(m.id)}">${picto('reglages')}<span>${hasManual ? trad('Remplacer') : trad('Déposer')}</span></button>
      </div>
    </article>`;
}

function manuelsListeHtml() {
  const matches = manuelsMatches();
  return matches.length ? matches.map(manuelCarteHtml).join('') : `<div class="ui-aide">${trad('Aucune machine ne correspond à ce filtre.')}</div>`;
}

// Même découpage que refreshFleetList() : seule la grille est réécrite, la
// recherche et les filtres restent en place — sinon chaque frappe ferait
// perdre le focus du champ.
function refreshManuelsListe() {
  const list = document.getElementById('manuels-list');
  if (!list) return;
  list.innerHTML = manuelsListeHtml();
  list.querySelectorAll('[data-manual]').forEach((btn) => btn.addEventListener('click', () => {
    const m = UI.machines.find((x) => x.id === btn.dataset.manual);
    if (m) openManualUploadModal(m);
  }));
  list.querySelectorAll('[data-plan]').forEach((btn) => btn.addEventListener('click', () => {
    const m = UI.machines.find((x) => x.id === btn.dataset.plan);
    if (m) openPlanView(m, UI.companyId, UI.categories);
  }));
  list.querySelectorAll('.view-manual').forEach((btn) => btn.addEventListener('click', () => viewManual(btn.dataset.path, btn)));
}

VIEWS.manuals = {
  fondBlanc: true,
  title: trad('Plan d\'entretien'),
  subtitle: () => tR('{n} plan(s) extrait(s) de vos carnets sur {total} machine(s)', { n: UI.counts.analysed, total: UI.machines.length }),
  render() {
    if (!UI.machines.length) {
      return `<div class="ui-page"><section class="ui-section"><div class="ui-aide">${trad('Ajoute une machine pour pouvoir déposer son carnet d\'entretien.')}</div></section></div>`;
    }
    const total = UI.machines.length;
    const analyse = UI.machines.filter((m) => etatManuel(m) === 'analyse').length;
    const aValider = UI.machines.filter((m) => etatManuel(m) === 'valider').length;
    const f = manuelsFilters();
    return `
      <div class="ui-page">
        <section class="ui-section">${dropzoneHtml('manuals-drop')}</section>
        <section class="ui-section">
          ${teteSectionKit('carnet', trad('Carnets d\'entretien'), '',
            `<span class="ui-tag">${tR('{n} indexé(s)', { n: analyse })}${aValider ? ` · ${tR('{n} à valider', { n: aValider })}` : ''}</span>`)}
          <div class="ui-section-corps">
            <div class="ui-barre">
              <input id="manuels-search" class="ui-champ" type="search" value="${esc(f.q)}" placeholder="${trad('Filtrer une machine…')}" aria-label="${trad('Filtrer une machine')}">
            </div>
            <div class="ui-puces" role="group" aria-label="${trad('Filtrer par état')}">
              ${manuelChipHtml('all', trad('Tous'), total)}
              ${manuelChipHtml('analyse', trad('Analysés'), analyse)}
              ${manuelChipHtml('valider', trad('À valider'), aValider)}
            </div>
            <div class="ui-liste" id="manuels-list"></div>
          </div>
        </section>
      </div>`;
  },
  mount() {
    const root = document.getElementById('view-root');
    if (!root) return;
    attachDropzone(root.querySelector('#manuals-drop'), (file) => openManualUploadModal(null, file));

    const search = root.querySelector('#manuels-search');
    if (search) {
      search.addEventListener('input', () => { manuelsFilters().q = search.value; refreshManuelsListe(); });
      search.addEventListener('search', () => { manuelsFilters().q = search.value; refreshManuelsListe(); });
    }

    root.querySelectorAll('[data-manuel-chip]').forEach((chip) => chip.addEventListener('click', () => {
      manuelsFilters().status = chip.dataset.status;
      root.querySelectorAll('[data-manuel-chip]').forEach((c) => {
        const active = c === chip;
        c.classList.toggle('is-actif', active);
        c.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      refreshManuelsListe();
    }));

    refreshManuelsListe();
  },
};

// ── Vue : Agenda ──────────────────────────────────────────────
// ── Préparation des entretiens ────────────────────────────────
// Ce que les entretiens à venir vont demander d'acheter, et pour quand.
//
// AUCUNE GESTION DE STOCK ICI, volontairement. La question du terrain est
// « qu'est-ce que je commande avant d'aller chez le fournisseur ? », et elle se
// répond avec ce que l'application sait déjà : les plans de maintenance et les
// « items » extraits du carnet constructeur (libellé, spécification,
// quantité). Tenir un stock demande une discipline de saisie que peu de clients
// auront ; prévoir les besoins, non.
const PREPARATION_HORIZON = [30, 90, 180];

function dateDansHorizon(iso, jours, base) {
  if (!iso) return false;
  const echeance = new Date(`${iso}T00:00:00`);
  if (isNaN(echeance.getTime())) return false;
  const limite = new Date(base.getTime() + jours * 86400000);
  return echeance <= limite;
}

// Lecture d'une quantité écrite en texte libre (« 6,5 L », « 2 », « 1 filtre »).
// Renvoie null dès que le texte n'est pas un nombre suivi d'une unité simple :
// on ne devine JAMAIS une quantité.
function lireQuantite(texte) {
  if (texte == null) return null;
  const propre = String(texte).trim().replace(',', '.');
  const trouve = propre.match(/^([0-9]+(?:\.[0-9]+)?)\s*([^\s0-9]*)$/);
  if (!trouve) return null;
  const nombre = Number(trouve[1]);
  if (!isFinite(nombre)) return null;
  return { nombre, unite: trouve[2].toLowerCase() };
}

// Total d'un ensemble de quantités — UNIQUEMENT si toutes sont lisibles et
// partagent la même unité. Sur une liste d'achat, un total faux coûte plus cher
// que pas de total du tout : dans le doute, on n'affiche rien.
function totalQuantites(quantites) {
  const lues = (quantites || []).map(lireQuantite);
  if (!lues.length || lues.some((q) => !q)) return null;
  const unite = lues[0].unite;
  if (lues.some((q) => q.unite !== unite)) return null;
  const total = lues.reduce((somme, q) => somme + q.nombre, 0);
  return { nombre: Math.round(total * 100) / 100, unite };
}

function formatteTotal(total) {
  if (!total && total !== 0) return '';
  // Deux formes possibles depuis le chantier Kits d'entretien (listePreparation
  // ligne ~16978) : un NOMBRE nu pour un besoin relié à un kit (quantité déjà
  // propre, sans unité texte à afficher), ou l'objet {nombre, unite} du parsing
  // texte libre historique (lireQuantite/totalQuantites). Sans cette
  // distinction, .nombre sur un nombre nu vaut undefined et plantait tout
  // l'écran d'Agenda/Préparation qui l'affiche (signalé par l'utilisateur).
  if (typeof total === 'number') return total.toLocaleString(localeActive());
  const nombre = total.nombre.toLocaleString(localeActive());
  return total.unite ? `${nombre} ${total.unite}` : nombre;
}

// Rassemble ce que les entretiens retenus vont consommer.
//
// Les machines suivies au compteur y figurent aussi : leur entretien n'a pas de
// date, donc rien à commander « pour le 12 octobre » — mais les pièces du
// prochain entretien se commandent, elles, dès maintenant.
function listePreparation(machines, jours, maintenant) {
  const base = maintenant ? new Date(maintenant) : new Date();
  const besoins = [];
  const sansItems = [];
  let entretiens = 0;
  let auCompteur = 0;

  for (const machine of machines || []) {
    const plan = machine && machine.plan;
    if (!plan) continue;
    const compteur = planIsCounter(plan);
    const date = compteur ? null : (plan.next_due_at || null);
    if (compteur) {
      auCompteur++;
    } else {
      if (!dateDansHorizon(date, jours, base)) continue;
      entretiens++;
    }

    const items = Array.isArray(plan.items) ? plan.items : [];
    if (!items.length) {
      // Plan sans liste de produits (carnet jamais analysé) : on rappellera ses
      // tâches, faute de mieux.
      if (!compteur) sansItems.push({ machine, date, taches: (plan.tasks || '').trim() });
      continue;
    }
    for (const item of items) {
      // Tâche reliée à un kit d'entretien réel (voir ouvrirChoixKitTache) :
      // une ligne de besoin PAR LIGNE DE KIT, clé sur part_id — jamais le
      // parsing texte libre lireQuantite/totalQuantites (une ligne de kit
      // porte déjà un nombre propre). Un kit_id qui ne résout plus (kit
      // supprimé/désactivé) retombe silencieusement sur le chemin texte
      // libre ci-dessous, comme avant ce chantier.
      const kit = item && item.kit_id
        ? (UI.maintenanceKits || []).find((k) => String(k.id) === String(item.kit_id) && k.active !== false)
        : null;
      if (kit) {
        const lignesDeKit = (UI.maintenanceKitLines || []).filter((l) => String(l.kit_id) === String(kit.id));
        for (const ligne of lignesDeKit) {
          const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(ligne.part_id));
          besoins.push({
            cle: `piece:${ligne.part_id}`,
            label: piece ? piece.designation : trad('Référence supprimée'),
            spec: piece && piece.reference ? piece.reference : '',
            machine,
            quantite: Number(ligne.quantity) || 0,
            date,
            estKit: true,
            partId: ligne.part_id,
            kitId: kit.id,
            kitNom: kit.name,
            tacheLabel: item.label ? String(item.label).trim() : '',
          });
        }
        continue;
      }
      const label = item && item.label ? String(item.label).trim() : '';
      if (!label) continue;
      const spec = item && item.spec ? String(item.spec).trim() : '';
      besoins.push({
        cle: `${label.toLowerCase()}|${spec.toLowerCase()}`,
        label, spec, machine,
        quantite: item && item.qty ? String(item.qty).trim() : '',
        date,
      });
    }
  }

  const parCle = new Map();
  for (const besoin of besoins) {
    if (!parCle.has(besoin.cle)) parCle.set(besoin.cle, { label: besoin.label, spec: besoin.spec, besoins: [] });
    parCle.get(besoin.cle).besoins.push(besoin);
  }
  const produits = [...parCle.values()].map((produit) => {
    const estKit = produit.besoins[0] && produit.besoins[0].estKit === true;
    const total = estKit
      ? produit.besoins.reduce((s, b) => s + (Number(b.quantite) || 0), 0)
      : totalQuantites(produit.besoins.map((b) => b.quantite));
    const premiereDate = produit.besoins.map((b) => b.date).filter(Boolean).sort()[0] || null;
    const resultat = { ...produit, total, premiereDate };
    if (estKit) {
      const ref = produit.besoins[0];
      resultat.partId = ref.partId;
      resultat.kitId = ref.kitId;
      resultat.kitNom = ref.kitNom;
      resultat.tacheLabel = ref.tacheLabel;
      // Couverture de stock : uniquement pour un besoin réellement relié à
      // une pièce du catalogue — jamais pour le texte libre, faute de
      // référence à comparer à un vrai stock.
      resultat.stockCouverture = calculerCouverturePiece(ref.partId, total, premiereDate);
    }
    return resultat;
  });
  produits.sort((a, b) => String(a.premiereDate || '9999').localeCompare(String(b.premiereDate || '9999')));

  return { entretiens, auCompteur, produits, groupes: grouperProduits(produits), sansItems };
}

// Compare le besoin projeté d'une pièce (issu d'un kit relié à une tâche) au
// stock réel, TOUS MAGASINS CONFONDUS — un signal d'approvisionnement pour la
// flotte entière, pas une vue par magasin (même périmètre que la KPI
// « valeur totale du stock », qui fait déjà cette même somme). RIEN N'EST
// INVENTÉ (même règle que dueInfo) : sans délai d'appro renseigné sur la
// pièce, ou sans échéance calendaire pour la porter, aucune date de
// commande n'est fabriquée — l'état devient 'inconnu', jamais une date au
// hasard.
function calculerCouverturePiece(partId, besoinTotal, premiereDateEcheance) {
  const piece = (UI.partsCatalog || []).find((p) => String(p.id) === String(partId));
  const stockDisponible = (UI.stockItems || [])
    .filter((it) => String(it.part_id) === String(partId))
    .reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const solde = stockDisponible - besoinTotal;
  let commanderAvantLe = null;
  if (premiereDateEcheance && piece && piece.avg_lead_time_days != null) {
    commanderAvantLe = addDaysIso(premiereDateEcheance, -Number(piece.avg_lead_time_days));
  }
  let state = 'ok';
  if (solde < 0) {
    if (commanderAvantLe == null) {
      state = 'inconnu';
    } else {
      const jours = daysUntil(commanderAvantLe);
      state = jours < 0 ? 'late' : (jours <= SOON_DAYS ? 'soon' : 'ok');
    }
  }
  return {
    partId,
    designation: piece ? piece.designation : trad('Référence supprimée'),
    reference: piece ? piece.reference : null,
    besoin: besoinTotal,
    stockDisponible,
    solde,
    commanderAvantLe,
    state,
  };
}
// Libellé de l'état de couverture — état 'inconnu' distinct de badgeLabel()
// (son repli « Plan à définir » n'a pas de sens pour une pièce en manque
// sans délai d'appro connu).
function libelleCouverturePiece(state) {
  if (state === 'inconnu') return trad('Délai d\'appro non renseigné');
  return badgeLabel(state);
}

// --- Familles de produits ---------------------------------------------------
//
// POURQUOI REGROUPER : la liste de préparation arrive en vrac — un filtre à
// huile, deux huiles, une graisse, une courroie — alors qu'une commande se passe
// famille par famille. Le carnet constructeur ne fournit pas de catégorie : on
// classe donc sur le LIBELLÉ, avec les mots des manuels réels. Ce qui n'est pas
// reconnu tombe dans « Autres » : jamais perdu, jamais mal rangé.
//
// L'ORDRE de cette table est celui du classement : « Filtre à huile » est un
// filtre, « Graisse à chaîne » est une graisse — le premier mot-clé reconnu
// l'emporte, donc l'ordre est une décision, pas un détail.
const CATEGORIES_PRODUIT = [
  { cle: 'filtres', libelle: 'Filtres', mots: /filtre|filter|tamis/i },
  { cle: 'huiles', libelle: 'Huiles et lubrifiants', mots: /huile|oil|lubrifiant|hydraulique|vidange/i },
  { cle: 'graisses', libelle: 'Graisses', mots: /graisse|graissage|grease/i },
  { cle: 'liquides', libelle: 'Liquides', mots: /liquide|refroidissement|coolant|antigel|adblue|frein|distill/i },
  { cle: 'usure', libelle: 'Pièces d\'usure', mots: /lame|courroie|cha[iî]ne|bougie|batterie|pneu|roue|dent|couteau|segment|joint|roulement|patin|disque|plaquette|masselotte|guide/i },
];

// Un pictogramme par famille, comme la maquette : le filtre (entonnoir) pour
// les filtres, la goutte pour ce qui se verse (huiles, liquides), le réglage
// pour les pièces d'usure, la boîte pour tout le reste.
const PICTO_CATEGORIE = { filtres: 'filtre', huiles: 'goutte', graisses: 'goutte', liquides: 'goutte', usure: 'reglages', autres: 'boite' };
// Même classement, pour l'intitulé qui précède la spec d'une tâche dans
// « Enregistrer un entretien » (reprise du mockup Stitch, qui varie ce
// libellé par tâche — « Spécification »/« Graisse »/« Contrôle »/« État » —
// mais sans donnée de catégorie réelle par tâche en base). Réutilise le
// classement par mots-clés déjà en place pour l'icône plutôt que d'inventer
// une catégorisation séparée : la valeur affichée (`it.spec`) reste
// TOUJOURS la vraie donnée, seul l'intitulé qui la précède s'adapte.
const PREFIXE_SPEC_CATEGORIE = { filtres: () => trad('État :'), huiles: () => trad('Spécification :'), graisses: () => trad('Graisse :'), liquides: () => trad('Spécification :'), usure: () => trad('Contrôle :'), autres: () => trad('Détail :') };

function categorieProduit(label) {
  const texte = String(label || '');
  for (const categorie of CATEGORIES_PRODUIT) {
    if (categorie.mots.test(texte)) return categorie.cle;
  }
  return 'autres';
}

function libelleCategorie(cle) {
  const trouvee = CATEGORIES_PRODUIT.find((categorie) => categorie.cle === cle);
  return trad(trouvee ? trouvee.libelle : 'Autres');
}

function grouperProduits(produits) {
  const parCategorie = new Map();
  for (const produit of produits) {
    const cle = categorieProduit(produit.label);
    if (!parCategorie.has(cle)) parCategorie.set(cle, []);
    parCategorie.get(cle).push(produit);
  }
  const ordre = [...CATEGORIES_PRODUIT.map((c) => c.cle), 'autres'];
  return ordre
    .filter((cle) => parCategorie.has(cle))
    .map((cle) => {
      const membres = parCategorie.get(cle);
      return {
        cle,
        nom: libelleCategorie(cle),
        produits: membres,
        premiereDate: membres.map((p) => p.premiereDate).filter(Boolean).sort()[0] || null,
      };
    })
    // La famille la plus urgente d'abord : c'est la date du produit le plus
    // proche qui commande l'ordre des sections, pas l'ordre du catalogue.
    .sort((a, b) => String(a.premiereDate || '9999').localeCompare(String(b.premiereDate || '9999')));
}

// L'état d'un besoin daté est celui de SA machine (dueInfo lit le même plan
// que l'écran Parc) : aucune urgence n'est recalculée ici, elle est reprise.
function etatBesoin(besoin) {
  if (!besoin.date) return { classe: 'neutral', mot: trad('Au compteur') };
  const info = dueInfo(besoin.machine.plan, besoin.machine);
  return { classe: badgeClass(info.state), mot: `${badgeLabel(info.state)} · ${info.short}` };
}

// Les familles au-delà des trois premières restent sur la page (le DOM les
// contient), seulement masquées par CSS : \"Voir plus\" ne relance donc aucune
// requête, et l'état ouvert/fermé n'a qu'un endroit où vivre (UI.prepGroupesTous).
const PREP_GROUPES_VISIBLES = 3;

function preparationHtml() {
  const jours = UI.preparationJours || 90;
  const liste = listePreparation(UI.machines, jours);
  const chips = PREPARATION_HORIZON
    .map((j) => `<button type="button" class="seg-btn${j === jours ? ' is-active' : ''}" data-horizon="${j}" aria-pressed="${j === jours}">${esc(tR('{n} j', { n: j }))}</button>`)
    .join('');

  const produitHtml = (produit) => {
    const besoins = produit.besoins.map((besoin) => {
      const etat = etatBesoin(besoin);
      return `<div class="prep-besoin">
        <span class="prep-besoin-machine">${esc(besoin.machine.name)}${besoin.quantite ? ` <span class="prep-besoin-qte">— ${esc(besoin.quantite)}</span>` : ''}</span>
        <span class="prep-besoin-etat ${etat.classe}">${esc(etat.mot)}</span>
      </div>`;
    }).join('');
    // La case cochée dit « inclus dans cette liste » : elle ne se décoche pas
    // (rien, dans le produit, ne retire une pièce une par une de la commande),
    // c'est donc un pictogramme et non un <input> — un vrai contrôle qui ne
    // changerait jamais rien serait le même défaut que les interrupteurs de
    // rappel déjà retirés ailleurs pour cette raison.
    return `<div class="prep-produit">
      <span class="card-ico prep-case">${picto('case')}</span>
      <div class="prep-produit-corps">
        <div class="prep-nom">${esc(produit.label)}${produit.spec ? ` <span class="prep-spec">${esc(produit.spec)}</span>` : ''}${produit.total ? `<span class="prep-total">${esc(formatteTotal(produit.total))}</span>` : ''}</div>
        <div class="prep-besoins">${besoins}</div>
      </div>
    </div>`;
  };

  const groupes = liste.groupes || [];
  // Le compte de PIÈCES (une ligne par besoin, machine par machine) complète le
  // compte de RÉFÉRENCES (une ligne par produit distinct) : les deux sont des
  // décomptes réels, aucun des deux n'est déduit de l'autre.
  const groupeHtml = (groupe) => {
    const nbBesoins = groupe.produits.reduce((total, p) => total + p.besoins.length, 0);
    return `
    <div class="prep-groupe">
      <div class="prep-groupe-tete">
        <span class="card-ico">${picto(PICTO_CATEGORIE[groupe.cle] || 'boite')}</span>
        <span class="prep-groupe-nom">${esc(groupe.nom)}</span>
        <span class="prep-groupe-meta">${tR('{n} référence(s) · {m} pièce(s)', { n: groupe.produits.length, m: nbBesoins })}${groupe.premiereDate ? ` · ${tR('dès le {date}', { date: formatShortDate(groupe.premiereDate) })}` : ''}</span>
      </div>
      <div class="prep-groupe-corps">${groupe.produits.map(produitHtml).join('')}</div>
    </div>`;
  };
  const visibles = groupes.slice(0, PREP_GROUPES_VISIBLES).map(groupeHtml).join('');
  const reste = groupes.slice(PREP_GROUPES_VISIBLES);
  const repli = reste.length ? `
    <div class="prep-groupes-plus${UI.prepGroupesTous ? ' is-ouvert' : ''}">${reste.map(groupeHtml).join('')}</div>
    <button type="button" class="link-inline prep-groupes-toggle" id="prep-groupes-toggle" aria-expanded="${UI.prepGroupesTous ? 'true' : 'false'}">
      <span class="card-ico prep-groupes-chevron">${picto('chevron')}</span>
      <span>${UI.prepGroupesTous ? trad('Réduire') : tR('Voir {n} famille(s) de plus', { n: reste.length })}</span>
    </button>` : '';
  const produits = visibles + repli;

  const sansItems = liste.sansItems.map((entree) => `<div class="prep-produit">
      <span class="card-ico prep-case">${picto('case')}</span>
      <div class="prep-produit-corps">
        <div class="prep-nom">${esc(entree.machine.name)}${entree.date ? ` <span class="prep-quand">— ${esc(formatShortDate(entree.date))}</span>` : ''}</div>
        <div class="prep-besoins">${entree.taches ? esc(entree.taches) : trad('Tâches non renseignées')}</div>
      </div>
    </div>`).join('');

  const rien = !liste.produits.length && !liste.sansItems.length;
  const resume = liste.entretiens
    ? tR('{n} entretien(s) daté(s) dans les {jours} prochains jours', { n: liste.entretiens, jours })
    : tR('Aucun entretien daté dans les {n} prochains jours', { n: jours });

  // Bannière d'alerte : seulement si au moins un besoin daté est EN RETARD —
  // le même état que la carte machine du Parc, jamais un second calcul.
  const besoinsRetard = liste.produits.flatMap((p) => p.besoins).filter((b) => b.date && dueInfo(b.machine.plan, b.machine).state === 'late');
  const machinesRetard = [...new Set(besoinsRetard.map((b) => b.machine.name))];
  const banniere = machinesRetard.length ? `
    <div class="prep-alerte">
      <span class="card-ico">${picto('alerte')}</span>
      <span class="prep-alerte-texte">${tR('{n} pièce(s) concernent {liste} déjà en retard.', { n: besoinsRetard.length, liste: machinesRetard.join(', ') })}</span>
      <span class="pill prep-alerte-pill">${trad('ACTION REQUISE')}</span>
    </div>` : '';

  return `
    <section class="card prep-card">
      <div class="card-head">
        <h2 class="card-title"><span class="card-ico">${picto('boite')}</span><span>${trad('Préparation des pièces et consommables')}</span></h2>
        <span class="spacer"></span>
        <div class="seg-horizon" role="group" aria-label="${trad('Période')}">${chips}</div>
      </div>
      <p class="muted-text">${esc(resume)}${liste.auCompteur ? ` · ${tR('{n} machine(s) au compteur, sans date d\'échéance', { n: liste.auCompteur })}` : ''}</p>
      ${banniere}
      ${rien
        ? `<p class="muted-text">${trad('Rien à prévoir sur cette période.')}</p>`
        : `${produits}${sansItems}`}
      ${(liste.produits.length || liste.sansItems.length) ? `<div class="ui-aide">${trad('Les quantités proviennent du carnet constructeur : vérifie-les avant de commander.')}</div>` : ''}
    </section>`;
}

// Version en clair, à coller dans un message au fournisseur : c'est l'usage
// réel de cette liste.
function preparationTexte() {
  const jours = UI.preparationJours || 90;
  const liste = listePreparation(UI.machines, jours);
  const lignes = [tR('Préparation des entretiens — {n} prochains jours', { n: jours }), ''];
  // Le texte copié suit le MÊME regroupement que l'écran : c'est ce message qui
  // part chez le fournisseur, et une commande se lit par famille.
  for (const groupe of (liste.groupes || [])) {
    lignes.push(`— ${groupe.nom} —`);
    for (const produit of groupe.produits) {
      const total = produit.total ? ` — total ${formatteTotal(produit.total)}` : '';
      lignes.push(`${produit.label}${produit.spec ? ` (${produit.spec})` : ''}${total}`);
      for (const besoin of produit.besoins) {
        const quand = besoin.date ? formatShortDate(besoin.date) : trad('au compteur');
        lignes.push(`   ${besoin.machine.name}${besoin.quantite ? ` : ${besoin.quantite}` : ''} — ${quand}`);
      }
    }
    lignes.push('');
  }
  for (const entree of liste.sansItems) {
    lignes.push(`${entree.machine.name}${entree.date ? ` — ${formatShortDate(entree.date)}` : ''}`);
    lignes.push(`   ${entree.taches || trad('Tâches non renseignées')}`);
  }
  if (!liste.produits.length && !liste.sansItems.length) lignes.push(trad('Rien à prévoir sur cette période.'));
  return lignes.join('\n');
}

// Même liste, au format CSV — une ligne par besoin (produit × machine) : le
// tableur d'un fournisseur ne lit pas des paragraphes.
function preparationCsv(jours) {
  const liste = listePreparation(UI.machines, jours);
  const header = [trad('Produit'), trad('Spécification'), trad('Machine'), trad('Quantité'), trad('Échéance')];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [];
  for (const produit of liste.produits) {
    for (const besoin of produit.besoins) {
      rows.push([
        produit.label, produit.spec || '', besoin.machine.name, besoin.quantite || '',
        besoin.date ? formatShortDate(besoin.date) : trad('au compteur'),
      ]);
    }
  }
  return [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
}

// UTF-16 avec BOM : Excel en français ouvre ce format proprement, sans
// demander d'encodage — la même recette que l'export d'historique machine.
function csvToUtf16Buffer(csvString) {
  const buf = new ArrayBuffer(2 + csvString.length * 2);
  const view = new DataView(buf);
  view.setUint16(0, 0xFEFF, true);
  for (let i = 0; i < csvString.length; i++) view.setUint16(2 + i * 2, csvString.charCodeAt(i), true);
  return buf;
}

function telechargerPreparationCsv() {
  const jours = UI.preparationJours || 90;
  const blob = new Blob([csvToUtf16Buffer(preparationCsv(jours))], { type: 'text/csv;charset=utf-16le;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `preparation_${jours}j.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Web Share quand le navigateur le permet (le fichier CSV, directement) ;
// sinon un e-mail pré-rempli avec le texte de la liste — jamais un bouton
// qui ne fait rien faute de connexion à un service tiers.
async function partagerPreparation() {
  const jours = UI.preparationJours || 90;
  const filename = `preparation_${jours}j.csv`;
  const file = new File([csvToUtf16Buffer(preparationCsv(jours))], filename, { type: 'text/csv' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: trad('Préparation des entretiens'), text: preparationTexte() });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  const subject = encodeURIComponent(trad('Préparation des entretiens'));
  const body = encodeURIComponent(preparationTexte());
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

// Le texte de preparationTexte(), présenté comme un message prêt à envoyer
// au fournisseur — aucune donnée nouvelle, seulement sa propre mise en page.
function bonCommandeHtml() {
  const jours = UI.preparationJours || 90;
  const liste = listePreparation(UI.machines, jours);
  const rien = !liste.produits.length && !liste.sansItems.length;
  return `
    <div class="ui-groupe bon-commande">
      <div class="ui-groupe-tete">${picto('carnet')}<span class="ui-groupe-titre">${trad('Bon de commande express')}</span></div>
      <p class="ui-aide">${trad('Le même texte que « Copier la liste », prêt à coller dans un message au fournisseur.')}</p>
      ${rien ? `<p class="ui-aide">${trad('Rien à commander pour l\'instant.')}</p>` : `
      <pre class="ui-code bon-commande-texte">${esc(preparationTexte())}</pre>
      <div class="ui-barre">
        <button type="button" class="ui-btn ui-btn-pastille" id="bon-copier">${picto('carnet')}<span>${trad('Copier')}</span></button>
        <button type="button" class="ui-btn ui-btn-pastille" id="bon-partager">${picto('partage')}<span>${trad('Partager')}</span></button>
      </div>
      <p class="ui-aide">${tR('{n} référence(s) au total', { n: liste.produits.length })}</p>`}
    </div>`;
}

// Version courte, pour le TABLEAU DE BORD.
//
// POURQUOI ELLE EXISTE : la liste complète vit dans l'Agenda, qui n'est même pas
// dans la barre d'onglets du téléphone (il faut passer par « Plus »). Une
// fonctionnalité que l'utilisateur ne trouve pas ne sert à rien — constat fait
// en usage réel, l'utilisateur ayant demandé où elle était. Cette carte annonce
// donc l'essentiel dès l'accueil, et renvoie à la liste détaillée.
// Reprise Stitch « Tableau de bord » (voir keeva-tco-feature) — le mockup
// groupe l'aperçu PAR FAMILLE (icône + badge « N machines ») plutôt que par
// produit isolé : réutilise `liste.groupes` (grouperProduits(), déjà calculé
// pour l'écran Préparation et le texte copié — aucun regroupement inventé
// ici, ni de nouvelle catégorisation). Les 3 familles de l'exemple du mockup
// (« Pièces d'usure & Allumage », « Alimentation & Carburation », « Filtres à
// air ») sont celles de LEUR jeu de données fictif — ici, ce sont les
// vraies familles présentes (CATEGORIES_PRODUIT), avec leur icône déjà
// établie (PICTO_CATEGORIE) plutôt qu'un nom/icône inventés pour coller au
// mockup à l'identique.
const TEINTES_FAMILLE = ['is-roi', 'is-amber', 'is-ok', 'is-indigo'];
function preparationResumeHtml() {
  const jours = UI.preparationJours || 90;
  const liste = listePreparation(UI.machines, jours);
  const nombre = liste.produits.length;
  if (!nombre && !liste.sansItems.length) return '';

  const groupes = (liste.groupes || []).slice(0, 3).map((groupe, i) => {
    const machinesDistinctes = new Set();
    groupe.produits.forEach((p) => (p.besoins || []).forEach((b) => machinesDistinctes.add(b.machine.id)));
    const produit = groupe.produits[0];
    const total = produit.total ? formatteTotal(produit.total) : '';
    const besoins = produit.besoins || [];
    const machines = besoins.slice(0, 2).map((b) => esc(b.machine.name)).join(', ');
    const autres = besoins.length > 2 ? tR(' + {n} autre(s)', { n: besoins.length - 2 }) : '';
    const teinte = { 'is-amber': 'is-ambre', 'is-indigo': '' }[TEINTES_FAMILLE[i % TEINTES_FAMILLE.length]] ?? TEINTES_FAMILLE[i % TEINTES_FAMILLE.length];
    return `
      <div class="ui-ligne is-deux">
        <div class="ui-ligne-id">
          <div class="ui-ligne-icone ${teinte}">${picto(PICTO_CATEGORIE[groupe.cle] || 'boite')}</div>
          <div class="ui-ligne-textes">
            <span class="ui-ligne-nom">${tR('Famille : {nom}', { nom: esc(groupe.nom) })}</span>
            <span class="ui-ligne-sous">${esc(produit.label)}${machines ? ` ${tR('· Pour {liste}', { liste: machines + autres })}` : ''}${total ? ` · ${esc(total)}` : ''}</span>
          </div>
        </div>
        <div class="ui-ligne-action"><span class="ui-tag">${tR('{n} machine(s)', { n: machinesDistinctes.size })}</span></div>
      </div>`;
  }).join('');
  const resume = nombre
    ? tR('{n} produit(s) à prévoir pour les {jours} prochains jours ({horizon}).', { n: nombre, jours, horizon: trad('consolidation automatique') })
    : tR('Rien à commander pour l\'instant, mais {n} plan(s) sans liste de produits.', { n: liste.sansItems.length });

  return `
    <section class="ui-section dash-preparation">
      ${teteSectionKit('boite', trad('Pièces & consommables'), esc(resume),
        `<div class="ui-segment" role="group" aria-label="${trad('Période')}">
          ${PREPARATION_HORIZON.map((j) => `<button type="button" class="${j === jours ? 'is-actif' : ''}" data-horizon="${j}" aria-pressed="${j === jours}">${esc(tR('{n} j', { n: j }))}</button>`).join('')}
        </div>`)}
      <div class="ui-section-corps">
        ${groupes ? `<div class="ui-liste">${groupes}</div>` : ''}
        <div class="ui-barre">
          <span class="ui-aide">${trad('Généré automatiquement d\'après les manuels constructeurs')}</span>
          <div class="ui-section-acces">
            <button type="button" class="ui-btn ui-btn-pastille" data-nav="agenda">${tR('Voir la liste complète ({n}) →', { n: nombre })}</button>
            <button type="button" class="ui-btn ui-btn-pastille" id="prep-copier">${picto('copier')}<span>${trad('Copier la liste commande')}</span></button>
          </div>
        </div>
      </div>
    </section>`;
}

// Reprise Stitch « Precision Field Matrix » (bloc Agenda « Préparation des
// pièces et consommables ») — remplace, POUR L'AGENDA UNIQUEMENT, le résumé à
// 3 familles / 1 produit de preparationResumeHtml() par la liste COMPLÈTE :
// chaque famille, chaque produit, chaque machine concernée. Mêmes données que
// partout ailleurs sur cet écran — listePreparation()/grouperProduits() pour
// le classement par famille (CATEGORIES_PRODUIT), etatBesoin() pour l'état de
// chaque besoin (aucun état recalculé) — seule la présentation change. Les
// « chips » de la maquette (« Premier besoin », « Stock tampon recommandé »…)
// étaient du texte fixe par famille dans le jeu de données fictif du mockup :
// ici, un seul chip réel par famille, dérivé de sa date la plus proche
// (premiereDate, déjà calculée) — jamais un statut inventé pour coller au
// mockup à l'identique.
function preparationCompleteAgendaHtml() {
  const jours = UI.preparationJours || 90;
  const liste = listePreparation(UI.machines, jours);
  const nombre = liste.produits.length;
  if (!nombre && !liste.sansItems.length) return '';

  const produitHtml = (produit) => {
    const machinesVues = new Set();
    const tags = produit.besoins.filter((b) => {
      if (machinesVues.has(b.machine.id)) return false;
      machinesVues.add(b.machine.id);
      return true;
    }).map((b) => `<span class="ui-tag">${esc(b.machine.name)}</span>`).join('');
    const besoinPrincipal = produit.besoins.find((b) => b.date === produit.premiereDate) || produit.besoins[0];
    const etat = etatBesoin(besoinPrincipal);
    const total = produit.total ? formatteTotal(produit.total) : '';
    // Couverture de stock (uniquement les produits reliés à un kit — voir
    // listePreparation) : un second repère, jamais à la place de l'état
    // d'échéance existant — ce sont deux informations distinctes.
    const couv = produit.stockCouverture;
    const repereCouverture = couv ? `<span class="ui-statut ${classeEtatKit(couv.state)}">${couv.solde < 0
      ? (couv.commanderAvantLe ? tR('Commander avant le {date}', { date: formatShortDate(couv.commanderAvantLe) }) : libelleCouverturePiece('inconnu'))
      : tR('Stock {n}/{b}', { n: texteAvecSeparateurs(couv.stockDisponible), b: texteAvecSeparateurs(couv.besoin) })
    }</span>` : '';
    const classeBesoin = classeEtatKit(String(etat.classe || '').replace('alert', 'late'));
    return `
      <div class="ui-ligne is-deux ${classeBesoin}">
        <div class="ui-ligne-id">
          <div class="ui-ligne-textes">
            <span class="ui-ligne-nom">${esc(produit.label)}${produit.spec ? `<span class="ui-tag">${esc(produit.spec)}</span>` : ''}</span>
            <span class="ui-ligne-sous">${tags}</span>
            <span class="ui-ligne-sous"><span class="ui-statut ${classeBesoin}">${esc(etat.mot)}</span>${repereCouverture}</span>
          </div>
        </div>
        ${total ? `<div class="ui-ligne-action"><span class="ui-chiffre-valeur">${esc(total)}</span></div>` : ''}
      </div>`;
  };

  // Une famille peut lister beaucoup de produits : seules les premières lignes
  // restent visibles par défaut, le reste est déplié PAR FAMILLE (état gardé
  // dans UI.prepFamillesOuvertes, indexé par groupe.cle).
  const PREP_PRODUITS_VISIBLES = 2;
  const groupeHtml = (groupe) => {
    const nbBesoins = groupe.produits.reduce((total, p) => total + p.besoins.length, 0);
    let chipTexte = trad('Suivi au compteur');
    let chipClasse = '';
    if (groupe.premiereDate) {
      const besoinProche = groupe.produits.flatMap((p) => p.besoins).find((b) => b.date === groupe.premiereDate);
      chipClasse = besoinProche ? classeEtatKit(String(etatBesoin(besoinProche).classe || '').replace('alert', 'late')) : '';
      chipTexte = tR('Premier besoin : dès le {date}', { date: formatShortDate(groupe.premiereDate) });
    }
    const ouvert = !!(UI.prepFamillesOuvertes && UI.prepFamillesOuvertes[groupe.cle]);
    const reste = groupe.produits.slice(PREP_PRODUITS_VISIBLES);
    const affiches = ouvert ? groupe.produits : groupe.produits.slice(0, PREP_PRODUITS_VISIBLES);
    const repli = reste.length ? `
        <div><button type="button" class="ui-btn ui-btn-teinte prep-detail-famille-toggle" data-famille="${esc(groupe.cle)}" aria-expanded="${ouvert ? 'true' : 'false'}">
          <span>${ouvert ? trad('Réduire') : tR('Voir {n} produit(s) de plus', { n: reste.length })}</span>
        </button></div>` : '';
    return `
      <div class="ui-champ-groupe">
        <span class="ui-etiquette">${esc(groupe.nom.toUpperCase())} <span class="ui-tag">${tR('{n} référence(s) · {m} pièce(s)', { n: groupe.produits.length, m: nbBesoins })}</span> <span class="ui-statut ${chipClasse}">${esc(chipTexte)}</span></span>
        <div class="ui-liste">${affiches.map(produitHtml).join('')}</div>
        ${repli}
      </div>`;
  };

  const groupesHtml = (liste.groupes || []).map(groupeHtml).join('');
  // Les plans sans carnet analysé (aucun item) n'ont pas de famille — perdus
  // par le résumé condensé du Tableau de bord, mais pas ici.
  const sansItemsHtml = liste.sansItems.length ? `
    <div class="ui-champ-groupe">
      <span class="ui-etiquette">${esc(trad('Entretiens sans liste de pièces').toUpperCase())} <span class="ui-tag">${tR('{n} machine(s)', { n: liste.sansItems.length })}</span></span>
      <div class="ui-liste">${liste.sansItems.map((entree) => `
        <div class="ui-ligne is-deux">
          <div class="ui-ligne-id"><div class="ui-ligne-textes">
            <span class="ui-ligne-nom">${esc(entree.machine.name)}${entree.date ? `<span class="ui-tag">${esc(formatShortDate(entree.date))}</span>` : ''}</span>
            <span class="ui-ligne-sous">${entree.taches ? esc(entree.taches) : esc(trad('Tâches non renseignées'))}</span>
          </div></div>
        </div>`).join('')}</div>
    </div>` : '';
  const resume = nombre
    ? tR('{n} produit(s) à prévoir pour les {jours} prochains jours ({horizon}).', { n: nombre, jours, horizon: trad('consolidation automatique') })
    : tR('Rien à commander pour l\'instant, mais {n} plan(s) sans liste de produits.', { n: liste.sansItems.length });

  return `
    <section class="ui-section dash-preparation prep-detail-carte">
      ${teteSectionKit('boite', trad('Préparation des pièces et consommables'), esc(resume),
        `<div class="ui-segment" role="group" aria-label="${trad('Période')}">
          ${PREPARATION_HORIZON.map((j) => `<button type="button" class="${j === jours ? 'is-actif' : ''}" data-horizon="${j}" aria-pressed="${j === jours}">${esc(tR('{n} j', { n: j }))}</button>`).join('')}
        </div>`)}
      <div class="ui-section-corps">
        <div class="ui-deux">${groupesHtml}${sansItemsHtml}</div>
        <div class="ui-barre">
          <span class="ui-aide">${trad('Généré automatiquement d\'après les manuels constructeurs')}</span>
          <div class="ui-section-acces"><button type="button" class="ui-btn ui-btn-pastille" id="prep-copier">${picto('copier')}<span>${trad('Copier la liste commande')}</span></button></div>
        </div>
        ${agendaPiecesDetailToggleHtml()}
      </div>
    </section>`;
}

function wirePreparation(root) {
  if (!root) return;
  root.querySelectorAll('[data-horizon]').forEach((bouton) => {
    bouton.addEventListener('click', () => {
      UI.preparationJours = Number(bouton.dataset.horizon) || 90;
      renderApp();
    });
  });
  const copierTexte = async () => {
    try {
      await navigator.clipboard.writeText(preparationTexte());
      showToast(trad('Liste copiée'));
    } catch (err) {
      // Presse-papiers refusé (permission, contexte non sécurisé) : on le dit
      // plutôt que de laisser croire que la copie a réussi.
      showToast(trad('Copie impossible — sélectionne la liste à la main'));
    }
  };
  root.querySelector('#prep-copier')?.addEventListener('click', copierTexte);
  root.querySelector('#bon-copier')?.addEventListener('click', copierTexte);
  root.querySelector('#prep-export')?.addEventListener('click', telechargerPreparationCsv);
  root.querySelector('#prep-partager')?.addEventListener('click', partagerPreparation);
  root.querySelector('#bon-partager')?.addEventListener('click', partagerPreparation);
  root.querySelector('#prep-groupes-toggle')?.addEventListener('click', () => {
    UI.prepGroupesTous = !UI.prepGroupesTous;
    renderApp();
  });
  root.querySelectorAll('.prep-detail-famille-toggle').forEach((bouton) => {
    bouton.addEventListener('click', () => {
      const cle = bouton.dataset.famille;
      UI.prepFamillesOuvertes = UI.prepFamillesOuvertes || {};
      UI.prepFamillesOuvertes[cle] = !UI.prepFamillesOuvertes[cle];
      renderApp();
    });
  });
}

// ── Chronologie : une carte par échéance, avec l'action qui va avec son état ──
// AUCUNE ACTION NOUVELLE : les trois boutons ouvrent les MÊMES fenêtres que le
// Parc (Enregistrer un entretien, Prochain entretien, Voir le plan) — seul le
// choix DE LAQUELLE proposer en avant suit l'état, comme sur la carte machine.
// `programme` (une ligne de scheduled_maintenances) quand cette carte vient
// d'une programmation manuelle plutôt que de l'échéance du plan — reprise de
// la distinction déjà faite par l'ancien agendaEvenementMiniHtml() : la tâche
// affichée devient celle programmée, mais l'état/la couleur restent TOUJOURS
// ceux, réels et actuels, de la machine (`info`), jamais figés à la date de
// programmation.
function chronologieCarteHtml(m, info, programme) {
  const tache = programme ? (programme.label || trad('Entretien programmé')) : nextTaskLabel(m);
  const meta = [machineBrandModel(m), identifiantAffiche(m)].filter(Boolean).join(' · ');
  const echeance = programme ? tR('Programmé le {date}', { date: formatShortDate(programme.scheduled_date) }) : info.label;
  const cta = info.state === 'late'
    ? { texte: trad('Enregistrer l\'entretien'), action: 'log', picto: 'entretien' }
    : info.state === 'soon'
      ? { texte: trad('Planifier'), action: 'next', picto: 'prochain' }
      : { texte: trad('Voir'), action: 'plan', picto: 'plan' };
  const classe = classeEtatKit(info.state);
  return `
    <article class="ui-ligne is-deux ${classe}${programme ? ' is-programme' : ''}" data-chrono-carte data-machine="${esc(m.id)}"${programme ? ` data-programme-id="${esc(programme.id)}"` : ''}>
      <div class="ui-ligne-id">
        <div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(m.name)}<span class="ui-statut ${classe}">${badgeLabel(info.state)}</span></span>
          ${meta ? `<span class="ui-ligne-sous">${esc(meta)}</span>` : ''}
          ${tache ? `<span class="ui-ligne-sous"><strong>${esc(tache)}</strong></span>` : ''}
          <span class="ui-ligne-sous">${esc(echeance)}</span>
        </div>
      </div>
      <div class="ui-ligne-action"><button type="button" class="ui-btn ui-btn-pastille" data-chrono="${cta.action}" data-machine-id="${esc(m.id)}">${picto(cta.picto)}<span>${cta.texte}</span></button></div>
    </article>`;
}

function wireChronologie(root) {
  if (!root) return;
  root.querySelectorAll('[data-chrono-carte]').forEach((carte) => {
    carte.addEventListener('click', (e) => {
      if (e.target.closest('[data-chrono]')) return;
      const m = UI.machines.find((x) => x.id === carte.dataset.machine);
      if (m) openPlanView(m, UI.companyId, UI.categories);
    });
  });
  root.querySelectorAll('[data-chrono]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const m = UI.machines.find((x) => x.id === btn.dataset.machineId);
    if (!m) return;
    const action = btn.dataset.chrono;
    if (action === 'log') openLogInterventionModal(m, nextTaskLabel(m));
    else if (action === 'next') openNextMaintenanceView(m);
    else openPlanView(m, UI.companyId, UI.categories);
  }));
}

// ── Agenda : calendrier mensuel réel ─────────────────────────────────────
// Reprise Stitch « WEB agenda » (grille mensuelle + colonne latérale) — voir
// keeva-tco-feature pour le détail. Base commune à la grille (Mois/Semaine)
// ET à la liste chronologique déjà en prod : `agendaEvenements()` reste
// l'unique calcul des échéances, jamais dupliqué entre les deux affichages.
// EXCLU DÉLIBÉRÉMENT (aucune donnée réelle derrière, comme documenté plus
// haut pour l'ancienne version de cet écran) : les machines AU COMPTEUR
// (heures/km) ne sont JAMAIS placées sur une case du calendrier — leur
// échéance n'a justement pas de date réelle à y afficher (le mockup le fait,
// en inventant une date de calendrier pour une échéance qui n'en a pas :
// pas repris) ; elles vivent uniquement dans la carte « Surveillance au
// compteur ». Pas de contrôle « VGP », pas de bandeau de rythme d'usage
// prédictif (aucun historique de relevé compteur n'est tracé pour le
// calculer honnêtement — voir le plan TCO phase 3, §2) : ni l'un ni l'autre
// n'existe dans le produit.
function agendaEvenements() {
  const dated = UI.machines
    .filter(m => m.plan && !planIsCounter(m.plan) && m.plan.next_due_at)
    .map(m => ({ m, info: dueInfo(m.plan, m) }));
  const counters = UI.machines
    .filter(m => m.plan && planIsCounter(m.plan))
    .map(m => ({ m, info: dueInfo(m.plan, m) }))
    .sort((a, b) => a.info.sortKey - b.info.sortKey);
  return { dated, counters };
}
function agendaVueActive() { return UI.agendaVue || 'mois'; }
function agendaStatutActif() { return UI.agendaStatut || 'tous'; }
function agendaRefIso() { return UI.agendaRefIso || todayIso(); }

// Lundi de la semaine contenant `iso` — même convention que la grille
// (Lun→Dim), affichée dans le mockup fourni.
function agendaDebutSemaine(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return addDaysIso(iso, -((jsDay + 6) % 7));
}
// 42 jours (6 semaines) : une grille de hauteur CONSTANTE d'un mois à
// l'autre, que le mois commence un lundi ou compte 5 vs 6 semaines visibles.
function agendaMoisGrille(refIso) {
  const cible = String(refIso).slice(0, 7);
  const debut = agendaDebutSemaine(`${cible}-01`);
  return Array.from({ length: 42 }, (_, i) => {
    const iso = addDaysIso(debut, i);
    return { iso, dansLeMois: iso.slice(0, 7) === cible, weekend: i % 7 >= 5 };
  });
}
function agendaSemaineGrille(refIso) {
  const debut = agendaDebutSemaine(refIso);
  return Array.from({ length: 7 }, (_, i) => ({ iso: addDaysIso(debut, i), dansLeMois: true, weekend: i >= 5 }));
}
// Échéances datées, groupées par jour ISO exact — une seule passe, réutilisée
// par la grille mensuelle et la grille hebdomadaire.
function agendaParJour(datedFiltres) {
  const map = new Map();
  datedFiltres.forEach((entree) => {
    const iso = entree.m.plan.next_due_at;
    if (!map.has(iso)) map.set(iso, []);
    map.get(iso).push(entree);
  });
  return map;
}

// Nom/tâche/badge de chaque échéance ne tenaient plus dans une case de
// calendrier sur téléphone (débordement, illisible — constaté en usage
// réel) : la case ne montre plus qu'une pastille de couleur par échéance ;
// le détail (même carte que la Liste chronologique) s'ouvre au clic sur la
// case, dans ouvrirJourAgenda(). AGENDA_JOUR_DOTS_MAX limite le nombre de
// pastilles avant de résumer le reste en « +N ».
const AGENDA_JOUR_DOTS_MAX = 4;
// La case ENTIÈRE est le seul et unique élément cliquable — UN SEUL
// comportement au clic, toujours ouvrirJourAgenda() (wireAgenda), qui
// contient elle-même « Planifier un entretien ». Il y avait auparavant un
// second bouton « + » dans le coin de la case pour programmer un entretien
// séparément : sur une case de ~48px sur téléphone, ce bouton (même agrandi)
// restait un second petit repère à viser tout près du numéro du jour, et
// captait au clic une partie des tapotis destinés à la case elle-même
// (stopPropagation) — l'utilisateur a remonté une ouverture peu fiable
// « 1 fois sur 2 » selon l'endroit exact du doigt. Un seul grand repère,
// toute la case, ne laisse plus cette ambiguïté. `data-jour` seulement sur
// les jours du mois affiché : cliquer un jour grisé (mois voisin) ne fait
// rien de surprenant.
function agendaJourHtml(jour, evenements) {
  const jourNum = jour.iso.slice(8, 10);
  const classes = ['agenda-jour'];
  if (!jour.dansLeMois) classes.push('is-hors-mois');
  else {
    classes.push('is-cliquable');
    if (jour.weekend) classes.push('is-weekend');
  }
  if (jour.iso === todayIso()) classes.push('is-aujourdhui');
  if (evenements.length) classes.push(`is-${evenements[0].info.state}`);
  const visibles = evenements.slice(0, AGENDA_JOUR_DOTS_MAX);
  const reste = evenements.length - visibles.length;
  const dotsHtml = evenements.length ? `
      <div class="agenda-jour-dots">
        ${visibles.map(({ info }) => `<span class="agenda-jour-dot is-${info.state}"></span>`).join('')}
        ${reste > 0 ? `<span class="agenda-jour-plus">+${reste}</span>` : ''}
      </div>` : '';
  return `
    <div class="${classes.join(' ')}"${jour.dansLeMois ? ` data-jour="${esc(jour.iso)}"` : ''}>
      <div class="agenda-jour-tete">
        <span class="agenda-jour-num">${jourNum}</span>
      </div>
      ${dotsHtml}
    </div>`;
}
function agendaGrilleHtml(jours, parJour) {
  const noms = [trad('Lun'), trad('Mar'), trad('Mer'), trad('Jeu'), trad('Ven'), trad('Sam'), trad('Dim')];
  return `
    <div class="agenda-semaine-noms">${noms.map((n) => `<span>${esc(n)}</span>`).join('')}</div>
    <div class="agenda-grille">${jours.map((j) => agendaJourHtml(j, parJour.get(j.iso) || [])).join('')}</div>`;
}
function agendaLegendeHtml() {
  return `
    <div class="agenda-legende">
      <div class="agenda-legende-item"><span class="dot" style="background:var(--late);"></span>${trad('En retard')}</div>
      <div class="agenda-legende-item"><span class="dot" style="background:var(--soon);"></span>${trad('Échéance sous 15 jours')}</div>
      <div class="agenda-legende-item"><span class="dot" style="background:var(--ok);"></span>${trad('À jour')}</div>
    </div>`;
}
function agendaPillsHtml() {
  const { dated, counters } = agendaEvenements();
  const tous = [...dated, ...counters];
  const compte = (statut) => (statut === 'tous' ? tous.length : tous.filter((e) => e.info.state === statut).length);
  const actif = agendaStatutActif();
  const pill = (statut, label) => {
    const point = statut === 'tous' ? '' : `<span class="ui-point ${classeEtatKit(statut)}"></span>`;
    return `<button type="button" class="ui-puce${actif === statut ? ' is-actif' : ''}" data-agenda-statut="${statut}" aria-pressed="${actif === statut}">${point}<span>${esc(label)}</span><span class="ui-compte">${compte(statut)}</span></button>`;
  };
  return `
    <div class="ui-puces agenda-pills">
      ${pill('tous', trad('Tous'))}${pill('late', trad('En retard'))}${pill('soon', trad('Bientôt'))}${pill('ok', trad('À jour'))}
    </div>`;
}
function agendaNavHtml() {
  const ref = agendaRefIso();
  const vue = agendaVueActive();
  const [y, m] = ref.split('-').map(Number);
  const labelMois = `${moisLong(m - 1)} ${y}`;
  const debutSemaine = agendaDebutSemaine(ref);
  const labelSemaine = `${formatShortDate(debutSemaine)} – ${formatShortDate(addDaysIso(debutSemaine, 6))}`;
  return `
    <div class="ui-barre agenda-outils">
      <div class="ui-segment agenda-vues" role="group" aria-label="${trad('Affichage')}">
        <button type="button" class="${vue === 'mois' ? 'is-actif' : ''}" data-agenda-vue="mois">${trad('Mois')}</button>
        <button type="button" class="${vue === 'semaine' ? 'is-actif' : ''}" data-agenda-vue="semaine">${trad('Semaine')}</button>
        <button type="button" class="${vue === 'liste' ? 'is-actif' : ''}" data-agenda-vue="liste">${trad('Liste chronologique')}</button>
      </div>
      ${vue !== 'liste' ? `
      <div class="agenda-nav">
        <button type="button" class="ui-btn ui-btn-icone is-gauche" id="agenda-prev" aria-label="${esc(trad(vue === 'mois' ? 'Mois précédent' : 'Semaine précédente'))}">${picto('chevron')}</button>
        <span class="ui-valeur agenda-nav-label">${esc(vue === 'mois' ? labelMois : labelSemaine)}</span>
        <button type="button" class="ui-btn ui-btn-icone is-droite" id="agenda-next" aria-label="${esc(trad(vue === 'mois' ? 'Mois suivant' : 'Semaine suivante'))}">${picto('chevron')}</button>
        <button type="button" class="ui-btn ui-btn-pastille" id="agenda-today">${trad('Aujourd\'hui')}</button>
      </div>` : ''}
    </div>
    ${agendaPillsHtml()}`;
}
// Liste chronologique : la vue d'origine (une carte par échéance, groupées
// par mois), désormais aussi filtrable par statut — elle ne l'était pas.
function agendaListeHtml(datedFiltres, countersFiltres) {
  if (!datedFiltres.length && !countersFiltres.length) {
    return `<div class="ui-aide">${trad('Aucune échéance ne correspond à ce filtre.')}</div>`;
  }
  const moisMois = (iso) => {
    const mi = Number(String(iso).slice(5, 7)) - 1;
    return moisLong(mi) ? `${moisLong(mi)} ${String(iso).slice(0, 4)}` : trad('Date inconnue');
  };
  const sorted = [...datedFiltres].sort((a, b) => (a.m.plan.next_due_at < b.m.plan.next_due_at ? -1 : 1));
  const moisComptes = new Map();
  sorted.forEach(({ m }) => {
    const mois = moisMois(m.plan.next_due_at);
    moisComptes.set(mois, (moisComptes.get(mois) || 0) + 1);
  });
  let currentMonth = '';
  const datedHtml = sorted.map(({ m, info }) => {
    const mois = moisMois(m.plan.next_due_at);
    const header = mois !== currentMonth
      ? `<span class="ui-etiquette agenda-month">${esc(mois)} <span class="ui-tag">${tR('{n} intervention(s)', { n: moisComptes.get(mois) })}</span></span>`
      : '';
    currentMonth = mois;
    return header + chronologieCarteHtml(m, info);
  }).join('');
  return `
    <div class="ui-liste">
    ${datedHtml}
    ${countersFiltres.length ? `
    ${sorted.length ? `<span class="ui-etiquette agenda-souscompteur">${trad('Suivi au compteur')}</span>` : ''}
    ${countersFiltres.map(({ m, info }) => chronologieCarteHtml(m, info)).join('')}` : ''}
    </div>`;
}
// Entretiens PROGRAMMÉS (table scheduled_maintenances, saisie manuelle par
// jour de calendrier) — groupés par jour comme agendaParJour(), mais depuis
// une source distincte : ils n'ont pas d'échéance de plan, juste une date
// choisie à la main. La couleur/état reste TOUJOURS celui, réel et actuel,
// de la machine (infoMachine) — jamais calculé depuis la date programmée.
function agendaProgrammesParJour(statutFiltre) {
  const map = new Map();
  (UI.scheduledMaintenances || []).forEach((p) => {
    if (p.status === 'annule') return;
    const m = UI.machines.find((x) => x.id === p.machine_id);
    if (!m) return;
    const info = infoMachine(m);
    if (statutFiltre !== 'tous' && info.state !== statutFiltre) return;
    if (!map.has(p.scheduled_date)) map.set(p.scheduled_date, []);
    map.get(p.scheduled_date).push({ m, info, programme: p });
  });
  return map;
}
function agendaContenuHtml() {
  const vue = agendaVueActive();
  const statut = agendaStatutActif();
  const { dated, counters } = agendaEvenements();
  const passe = (info) => statut === 'tous' || info.state === statut;
  const datedFiltres = dated.filter(({ info }) => passe(info));
  const countersFiltres = counters.filter(({ info }) => passe(info));
  if (vue === 'liste') return agendaListeHtml(datedFiltres, countersFiltres);
  const ref = agendaRefIso();
  const jours = vue === 'semaine' ? agendaSemaineGrille(ref) : agendaMoisGrille(ref);
  const parJourEcheances = agendaParJour(datedFiltres);
  const parJourProgrammes = agendaProgrammesParJour(statut);
  const parJour = new Map();
  jours.forEach((j) => parJour.set(j.iso, [...(parJourEcheances.get(j.iso) || []), ...(parJourProgrammes.get(j.iso) || [])]));
  return agendaGrilleHtml(jours, parJour) + agendaLegendeHtml();
}

// Même filtre/fusion que agendaContenuHtml() (échéances datées + entretiens
// programmés, filtrés par le statut actif) mais pour UN SEUL jour — le rendu
// de la grille ne garde pas les événements de chaque case après coup, donc
// ouvrirJourAgenda() (déclenché au clic, pas au rendu) les recalcule ici.
function agendaEvenementsDuJour(iso) {
  const statut = agendaStatutActif();
  const { dated } = agendaEvenements();
  const passe = (info) => statut === 'tous' || info.state === statut;
  const datedFiltres = dated.filter(({ info }) => passe(info));
  const echeances = agendaParJour(datedFiltres).get(iso) || [];
  const programmes = agendaProgrammesParJour(statut).get(iso) || [];
  return [...echeances, ...programmes];
}
// Reprise Stitch « modale_agenda_v_nements_du_jour_keeva » — même contenu
// que chronologieCarteHtml (nom, état, tâche, échéance) mais dans ce format
// à bandeau latéral + bloc tâche + bloc télémétrie. La télémétrie ne
// s'affiche QUE si cette machine a un second suivi au compteur
// (vueCompteurSecondaire) avec une vraie lecture — jamais un « max » inventé
// comme le 140h/145h fictif de la maquette (aucune donnée réelle derrière).
function agendaJourCarteHtml(m, info, programme) {
  const tache = programme ? (programme.label || trad('Entretien programmé')) : nextTaskLabel(m);
  const meta = [machineBrandModel(m), identifiantAffiche(m)].filter(Boolean).join(' · ');
  const labelTache = programme ? trad('Contrôle programmé') : info.state === 'late' ? trad('Opération requise') : trad('Prochaine intervention');
  const echeanceCourte = programme
    ? tR('Prévu le {date}', { date: formatShortDate(programme.scheduled_date) })
    : tR('Échéance {date}', { date: formatShortDate(m.plan.next_due_at) });
  const suffixe = (!programme && info.state === 'late' && info.short) ? ` (${info.short})` : '';
  const cta = info.state === 'late'
    ? { texte: trad('Enregistrer l\'entretien'), action: 'log', picto: 'entretien' }
    : info.state === 'soon'
      ? { texte: trad('Planifier'), action: 'next', picto: 'prochain' }
      : { texte: trad('Voir'), action: 'plan', picto: 'plan' };
  const v2 = vueCompteurSecondaire(m);
  const compteurValeur = (v2 && v2.machineVue.counter_unit !== 'days') ? machineCounter(v2.machineVue) : null;
  const telemetrieHtml = compteurValeur != null ? `
    <div class="jm-carte-telemetrie">
      <span class="jm-carte-telemetrie-gauche">${picto('compteur')}<span>${esc(tR('Relevé {unite}', { unite: v2.machineVue.counter_unit === 'km' ? trad('kilométrique') : trad('horaire') }))}</span></span>
      <span class="jm-carte-telemetrie-valeur">${esc(formatCounter(compteurValeur, v2.machineVue.counter_unit))}</span>
    </div>` : '';
  return `
    <article class="jm-carte is-${info.state}${programme ? ' is-programme' : ''}" data-machine="${esc(m.id)}"${programme ? ` data-programme-id="${esc(programme.id)}"` : ''}>
      <span class="jm-carte-bar" aria-hidden="true"></span>
      <div class="jm-carte-corps">
        <div class="jm-carte-tete">
          <div class="jm-carte-tete-nom">
            <div class="jm-carte-nom">${esc(m.name)}</div>
            ${meta ? `<div class="jm-carte-meta">${esc(meta)}</div>` : ''}
          </div>
          <span class="badge ${badgeClass(info.state)}">${badgeLabel(info.state)}${esc(suffixe)}</span>
        </div>
        <div class="jm-carte-tache-bloc">
          <div class="jm-carte-tache-tete">
            <span>${esc(labelTache)}</span>
            <span class="jm-carte-echeance">${esc(echeanceCourte)}</span>
          </div>
          ${tache ? `<div class="jm-carte-tache">${esc(tache)}</div>` : ''}
        </div>
        ${telemetrieHtml}
        <button type="button" class="jm-carte-cta" data-chrono="${cta.action}" data-machine-id="${esc(m.id)}">${picto(cta.picto)}<span>${cta.texte}</span></button>
      </div>
    </article>`;
}
// Infobulle au survol d'une case (desktop/souris uniquement — voir
// wireAgenda, un survol n'existe pas au doigt). Reprend EXACTEMENT la même
// liste filtrée que la case (agendaEvenementsDuJour), jamais recalculée
// différemment : ce qu'annoncent les pastilles est ce que montre l'infobulle.
const AGENDA_TOOLTIP_MAX = 6;
function agendaTooltipHtml(iso, evenements) {
  const visibles = evenements.slice(0, AGENDA_TOOLTIP_MAX);
  const reste = evenements.length - visibles.length;
  const lignes = visibles.map(({ m, info, programme }) => {
    const tache = programme ? (programme.label || trad('Entretien programmé')) : nextTaskLabel(m);
    return `
      <div class="agenda-tooltip-ligne">
        <span class="agenda-tooltip-dot is-${info.state}"></span>
        <span class="agenda-tooltip-nom">${esc(m.name)}</span>
        <span class="agenda-tooltip-tache">${esc(tache)}</span>
      </div>`;
  }).join('');
  return `
    <div class="agenda-tooltip-date">${esc(formatLongDate(iso))}</div>
    <div class="agenda-tooltip-liste">${lignes}</div>
    ${reste > 0 ? `<div class="agenda-tooltip-reste">${esc(tR('+{n} autre(s)', { n: reste }))}</div>` : ''}`;
}
// Nœud UNIQUE réutilisé à chaque survol (créé une fois, déplacé/rempli à
// chaque case) plutôt qu'un élément par case : une seule infobulle peut être
// visible à la fois, pas besoin d'en garder 42 dans le DOM.
function agendaTooltipElement() {
  let el = document.getElementById('agenda-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'agenda-tooltip';
    el.className = 'agenda-tooltip';
    el.setAttribute('role', 'tooltip');
    document.body.appendChild(el);
  }
  return el;
}
function agendaTooltipCacher() {
  document.getElementById('agenda-tooltip')?.classList.remove('is-visible');
}
function agendaTooltipAfficher(cell) {
  const iso = cell.dataset.jour;
  if (!iso) return;
  const evenements = agendaEvenementsDuJour(iso);
  if (!evenements.length) return;
  const el = agendaTooltipElement();
  el.innerHTML = agendaTooltipHtml(iso, evenements);
  el.classList.add('is-visible');
  // Position sous la case, centrée sur sa largeur, puis ramenée dans la
  // fenêtre si elle en sortirait (bas → au-dessus, côtés → butée à 8px).
  const rc = cell.getBoundingClientRect();
  const marge = 8;
  const tw = el.offsetWidth, th = el.offsetHeight;
  let left = rc.left + rc.width / 2 - tw / 2;
  left = Math.max(marge, Math.min(left, window.innerWidth - tw - marge));
  let top = rc.bottom + marge;
  if (top + th > window.innerHeight - marge) top = rc.top - th - marge;
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}
// Clic sur une case du calendrier : liste chaque machine concernée (ou
// « aucune échéance » sur un jour vide — dans les deux cas la même fenêtre,
// avec toujours un bouton « Planifier un entretien » : un seul comportement
// au clic sur la case, quel que soit son contenu, plutôt qu'un second petit
// bouton « + » à viser séparément dans un coin de case déjà minuscule au
// doigt (ouverture peu fiable, remontée par l'utilisateur — voir
// agendaJourHtml). Câblage dédié (pas wireChronologie telle quelle) : une
// carte « programmée » doit rouvrir ouvrirProgrammeActions (voir/annuler
// CETTE programmation), comme le faisait l'ancien clic sur .agenda-evt.
function ouvrirJourAgenda(iso) {
  const evenements = agendaEvenementsDuJour(iso);
  const overlay = document.createElement('div');
  overlay.className = 'overlay agenda-jour-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const cartesHtml = evenements.map(({ m, info, programme }) => agendaJourCarteHtml(m, info, programme)).join('');
  const parEtat = { late: 0, soon: 0, ok: 0 };
  evenements.forEach(({ info }) => { if (parEtat[info.state] != null) parEtat[info.state]++; });
  const legendeHtml = ['late', 'soon', 'ok']
    .filter((s) => parEtat[s])
    .map((s) => `<span class="dot" style="background:var(--${s});"></span><span>${tR('{n} {label}', { n: parEtat[s], label: badgeLabel(s).toLowerCase() })}</span>`)
    .join('<span>·</span>');
  const veille = addDaysIso(iso, -1);
  const lendemain = addDaysIso(iso, 1);
  overlay.innerHTML = `
    <div class="modal">
      <div class="jm-tete">
        <div>
          <div class="jm-badge-ligne">
            <span class="jm-icone">${picto('calendrier')}</span>
            <span class="jm-eyebrow">${trad('Agenda atelier')}</span>
            <span class="jm-compte">${tR('{n} acte(s)', { n: evenements.length })}</span>
          </div>
          <h2>${esc(formatLongDate(iso))}</h2>
          <p class="sub" style="margin-bottom:0;">${evenements.length ? tR('{n} intervention(s) d\'entretien planifiée(s)', { n: evenements.length }) : trad('Aucune échéance ce jour.')}</p>
        </div>
        <button type="button" class="jm-fermer" id="agenda-jour-fermer-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
      </div>
      <div class="jm-liste">${cartesHtml || `<p class="jm-vide">${trad('Aucune échéance ce jour — planifie un entretien ci-dessous si besoin.')}</p>`}</div>
      <div class="jm-pied">
        <button type="button" class="pe-confirmer" id="agenda-jour-planifier" style="cursor:pointer;background:var(--primary-dark);color:#fff;">${picto('croix')}<span>${trad('Planifier un entretien')}</span></button>
        <button type="button" class="pe-fermer" id="agenda-jour-fermer">${trad('Fermer')}</button>
      </div>
      <div class="jm-nav">
        <button type="button" class="jm-nav-btn" data-jour-nav="${esc(veille)}">${picto('flecheGauche')}<span>${esc(formatShortDate(veille))} (${agendaEvenementsDuJour(veille).length})</span></button>
        ${legendeHtml ? `<span class="jm-nav-legende">${legendeHtml}</span>` : ''}
        <button type="button" class="jm-nav-btn" data-jour-nav="${esc(lendemain)}"><span>${esc(formatShortDate(lendemain))} (${agendaEvenementsDuJour(lendemain).length})</span>${picto('flecheDroite')}</button>
      </div>
    </div>`;
  overlay.querySelector('#agenda-jour-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#agenda-jour-fermer-x').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#agenda-jour-planifier').addEventListener('click', () => { overlay.remove(); ouvrirProgrammerEntretien(iso); });
  overlay.querySelectorAll('[data-jour-nav]').forEach((btn) => btn.addEventListener('click', () => {
    overlay.remove();
    ouvrirJourAgenda(btn.dataset.jourNav);
  }));
  overlay.querySelectorAll('.jm-carte').forEach((carte) => carte.addEventListener('click', (e) => {
    if (e.target.closest('[data-chrono]')) return;
    const m = UI.machines.find((x) => x.id === carte.dataset.machine);
    if (!m) return;
    if (carte.dataset.programmeId) {
      const programme = (UI.scheduledMaintenances || []).find((p) => p.id === carte.dataset.programmeId);
      if (programme) { overlay.remove(); ouvrirProgrammeActions(programme, m); return; }
    }
    overlay.remove();
    openPlanView(m, UI.companyId, UI.categories);
  }));
  overlay.querySelectorAll('[data-chrono]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const m = UI.machines.find((x) => x.id === btn.dataset.machineId);
    if (!m) return;
    overlay.remove();
    const action = btn.dataset.chrono;
    if (action === 'log') openLogInterventionModal(m, nextTaskLabel(m));
    else if (action === 'next') openNextMaintenanceView(m);
    else openPlanView(m, UI.companyId, UI.categories);
  }));
}

// Carte « Surveillance au compteur » : les échéances SANS date (heures/km),
// séparées du calendrier pour la raison expliquée plus haut. Même jauge que
// le bandeau Parc (pourcentageIntervalle, déjà réel et vérifié) — jamais un
// second calcul de pourcentage.
// Export CSV et bon de commande, repliés par défaut sous la carte de
// préparation — celle-ci montre déjà chaque famille et chaque produit
// (preparationCompleteAgendaHtml), donc plus besoin de reproduire la liste
// ici : seules les deux actions qui n'ont pas leur place dans la carte
// elle-même restent derrière ce bouton.
function agendaPiecesDetailToggleHtml() {
  const ouvert = !!UI.agendaPiecesDetail;
  return `
    <div><button type="button" class="ui-btn ui-btn-teinte agenda-pieces-detail-toggle" id="agenda-pieces-detail-toggle" aria-expanded="${ouvert}">
      <span>${ouvert ? trad('Réduire') : trad('Export et bon de commande')}</span>
    </button></div>
    ${ouvert ? `<div class="ui-section-corps agenda-pieces-detail">
      <div><button type="button" class="ui-btn ui-btn-pastille" id="prep-export">${picto('export')}<span>${trad('Exporter la liste (CSV)')}</span></button></div>
      ${bonCommandeHtml()}
    </div>` : ''}`;
}

// « Planifier un entretien » : choisit une date (préremplie si on vient d'un
// clic sur un jour du calendrier, sinon aujourd'hui) puis une machine — écrit
// une ligne dans scheduled_maintenances. Distinct de l'échéance du plan
// (plan.next_due_at, qui se déplace toute seule quand un entretien est
// enregistré) : ceci est une programmation manuelle, annulable indépendamment,
// affichée dans la case du jour choisi avec la couleur d'état RÉELLE et
// ACTUELLE de la machine (jamais figée à la programmation).
// Reprise Stitch « modale_agenda_planifier_un_entretien_keeva » — recherche +
// filtre par statut + sélection en deux temps (choisir puis confirmer,
// jamais un clic unique qui programme immédiatement — un tapotis
// malencontreux ne doit pas créer une programmation sur la mauvaise
// machine). La date reste un vrai <input type="date"> habillé
// (habillerChampDate, déjà établi) : jamais une liste de dates fictives à
// faire défiler comme la maquette, qui n'a pas de vrai calendrier derrière.
function ouvrirProgrammerEntretien(dateInitiale) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay agenda-planifier-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const machines = [...UI.machines].sort((a, b) => a.name.localeCompare(b.name));
  const dateDefaut = dateInitiale || todayIso();
  const machinesInfo = machines.map((m) => ({ m, info: infoMachine(m) }));
  const compteStatut = (statut) => statut === 'tous'
    ? machinesInfo.length
    : machinesInfo.filter((x) => x.info.state === statut).length;

  const ligneHtml = ({ m, info }) => `
    <button type="button" class="pe-machine" data-machine-id="${esc(m.id)}" data-statut="${esc(info.state)}" data-nom="${esc(m.name.toLowerCase())}">
      <span class="pe-machine-gauche">
        <span class="pe-machine-icone">${picto(iconeCategorieMachine(m.name))}</span>
        <span class="pe-machine-corps">
          <span class="pe-machine-nom">${esc(m.name)}</span>
          <span class="pe-machine-meta">${esc([machineBrandModel(m), identifiantAffiche(m)].filter(Boolean).join(' · '))}</span>
        </span>
      </span>
      <span class="pe-machine-droite">
        <span class="badge ${badgeClass(info.state)}">${badgeLabel(info.state)}</span>
        <span class="pe-machine-check">${picto('coche')}</span>
      </span>
    </button>`;
  const pillHtml = (statut, label, teinte) => `
    <button type="button" class="pe-pill${statut === 'tous' ? ' is-active' : ''}" data-pe-statut="${statut}">
      ${teinte ? `<span class="dot" style="background:var(--${teinte});"></span>` : ''}
      <span>${esc(label)}</span><span>${compteStatut(statut)}</span>
    </button>`;

  overlay.innerHTML = `
    <div class="modal">
      <div class="pe-tete">
        <div>
          <h2>${trad('Planifier un entretien')}</h2>
          <p class="sub" style="margin-bottom:0;">${trad('Choisis la date puis la machine : la programmation apparaît dans le calendrier, colorée selon l\'état réel de la machine.')}</p>
        </div>
        <span class="pe-tete-icone">${picto('calendrier')}</span>
      </div>
      <div class="pe-date-bloc">
        <span class="pe-date-label">${trad('Date sélectionnée')}</span>
        <input id="prog-date" type="date" value="${esc(dateDefaut)}">
      </div>
      <div class="pe-recherche">
        ${picto('recherche')}
        <input type="search" id="pe-recherche" autocomplete="off" placeholder="${esc(trad('Rechercher une machine…'))}">
      </div>
      <div class="pe-pills">
        ${pillHtml('tous', trad('Tous'), null)}
        ${pillHtml('late', trad('En retard'), 'late')}
        ${pillHtml('soon', trad('Bientôt'), 'soon')}
        ${pillHtml('ok', trad('À jour'), 'ok')}
      </div>
      <div class="pe-liste" id="pe-liste">
        ${machinesInfo.length ? machinesInfo.map(ligneHtml).join('') : ''}
        <div class="pe-vide" id="pe-vide" style="display:none;">${picto('recherche')}<p>${trad('Aucune machine trouvée.')}</p></div>
      </div>
      <div class="pe-bandeau" id="pe-bandeau" style="display:none;">${picto('coche')}<span id="pe-bandeau-nom"></span></div>
      <div class="pe-pied">
        <button type="button" class="pe-confirmer" id="pe-confirmer" disabled>${picto('calendrier')}<span>${trad('Programmer à cette date')}</span></button>
        <button type="button" class="pe-fermer" id="agenda-choix-fermer">${trad('Fermer')}</button>
      </div>
    </div>`;
  if (!machinesInfo.length) overlay.querySelector('#pe-liste').insertAdjacentHTML('afterbegin', `<p class="muted-text">${trad('Aucune machine enregistrée.')}</p>`);
  habillerChampDate(overlay.querySelector('#prog-date'), trad('Date'));
  overlay.querySelector('#agenda-choix-fermer').addEventListener('click', () => overlay.remove());

  let statutActif = 'tous';
  let choisiId = null;
  const recherche = overlay.querySelector('#pe-recherche');
  const vide = overlay.querySelector('#pe-vide');
  const confirmer = overlay.querySelector('#pe-confirmer');
  const bandeau = overlay.querySelector('#pe-bandeau');
  const bandeauNom = overlay.querySelector('#pe-bandeau-nom');

  const appliquerFiltres = () => {
    const q = recherche.value.trim().toLowerCase();
    let visibles = 0;
    overlay.querySelectorAll('.pe-machine').forEach((ligne) => {
      const correspond = (statutActif === 'tous' || ligne.dataset.statut === statutActif) && ligne.dataset.nom.includes(q);
      ligne.style.display = correspond ? '' : 'none';
      if (correspond) visibles++;
    });
    vide.style.display = visibles ? 'none' : 'flex';
  };
  recherche.addEventListener('input', appliquerFiltres);
  overlay.querySelectorAll('[data-pe-statut]').forEach((pill) => pill.addEventListener('click', () => {
    statutActif = pill.dataset.peStatut;
    overlay.querySelectorAll('[data-pe-statut]').forEach((p) => p.classList.toggle('is-active', p === pill));
    appliquerFiltres();
  }));

  overlay.querySelectorAll('.pe-machine').forEach((ligne) => ligne.addEventListener('click', () => {
    const id = ligne.dataset.machineId;
    choisiId = choisiId === id ? null : id;
    overlay.querySelectorAll('.pe-machine').forEach((l) => l.classList.toggle('is-choisie', l.dataset.machineId === choisiId));
    if (choisiId) {
      bandeau.style.display = 'flex';
      bandeauNom.textContent = ligne.querySelector('.pe-machine-nom').textContent;
      confirmer.disabled = false;
    } else {
      bandeau.style.display = 'none';
      confirmer.disabled = true;
    }
  }));

  confirmer.addEventListener('click', async () => {
    if (!choisiId) return;
    const m = UI.machines.find((x) => x.id === choisiId);
    if (!m) return;
    const dateChoisie = overlay.querySelector('#prog-date').value || dateDefaut;
    confirmer.disabled = true;
    const { data, error } = await sb.from('scheduled_maintenances')
      .insert({ machine_id: m.id, scheduled_date: dateChoisie })
      .select('id, machine_id, scheduled_date, label, status, created_at')
      .single();
    if (error) {
      showToast(trad('Programmation impossible : ') + error.message);
      confirmer.disabled = false;
      return;
    }
    UI.scheduledMaintenances = [...(UI.scheduledMaintenances || []), data];
    overlay.remove();
    renderApp();
    showToast(trad('Entretien programmé'));
  });
}
// Clic sur une carte « programmée » dans une case du calendrier : voir la
// fiche ou annuler CETTE programmation (jamais l'échéance du plan lui-même,
// qui n'a pas d'équivalent « annuler » — elle se déplace en enregistrant
// l'entretien, pas en la supprimant).
function ouvrirProgrammeActions(programme, m) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay programme-actions-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal">
      <h2>${esc(m.name)}</h2>
      <p class="sub">${esc(tR('Entretien programmé le {date}{label}', { date: formatShortDate(programme.scheduled_date), label: programme.label ? ` — ${programme.label}` : '' }))}</p>
      <div class="modal-actions">
        <button type="button" class="secondary" id="prog-annuler">${trad('Annuler cette programmation')}</button>
        <button type="button" class="primary" id="prog-fiche">${trad('Voir la fiche')}</button>
      </div>
    </div>`;
  overlay.querySelector('#prog-fiche').addEventListener('click', () => {
    overlay.remove();
    openPlanView(m, UI.companyId, UI.categories);
  });
  overlay.querySelector('#prog-annuler').addEventListener('click', async () => {
    const btn = overlay.querySelector('#prog-annuler');
    btn.disabled = true;
    const { error } = await sb.from('scheduled_maintenances').delete().eq('id', programme.id);
    if (error) { showToast(trad('Suppression impossible : ') + error.message); btn.disabled = false; return; }
    UI.scheduledMaintenances = (UI.scheduledMaintenances || []).filter((p) => p.id !== programme.id);
    overlay.remove();
    renderApp();
    showToast(trad('Programmation annulée'));
  });
}

// Entretiens PROGRAMMÉS à exporter : ceux saisis à la main (« Planifier un entretien »), pas annulés, à partir
// d'aujourd'hui (le passé n'a rien à faire dans un agenda). Ils n'étaient pas exportés : seules les échéances des
// plans l'étaient (signalé le 2026-10-07).
function programmesAExporter() {
  const aujourdhui = todayIso();
  return (UI.scheduledMaintenances || [])
    .filter((p) => p && p.status !== 'annule' && p.scheduled_date && p.scheduled_date >= aujourdhui)
    .map((p) => ({ p, m: UI.machines.find((x) => x.id === p.machine_id) }))
    .filter((x) => x.m);
}

// Export .ics : un événement par échéance DATÉE (jamais les machines au
// compteur, qui n'ont justement pas de date à exporter) PLUS un par entretien programmé — même esprit que
// l'export CSV de préparation déjà en place, aucune dépendance externe.
function planningIcsTexte() {
  const { dated } = agendaEvenements();
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  const horodatage = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const echapper = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KALEA//Agenda//FR', 'CALSCALE:GREGORIAN'];
  dated.forEach(({ m, info }) => {
    const iso = m.plan.next_due_at;
    const dateEvt = iso.replace(/-/g, '');
    const dateFin = addDaysIso(iso, 1).replace(/-/g, '');
    lignes.push(
      'BEGIN:VEVENT',
      `UID:${m.id}-${dateEvt}@keeva.work`,
      `DTSTAMP:${horodatage}`,
      `DTSTART;VALUE=DATE:${dateEvt}`,
      `DTEND;VALUE=DATE:${dateFin}`,
      `SUMMARY:${echapper(`${m.name} — ${nextTaskLabel(m)}`)}`,
      `DESCRIPTION:${echapper(info.label)}`,
      'END:VEVENT',
    );
  });
  programmesAExporter().forEach(({ p, m }) => {
    const dateEvt = p.scheduled_date.replace(/-/g, '');
    const dateFin = addDaysIso(p.scheduled_date, 1).replace(/-/g, '');
    lignes.push(
      'BEGIN:VEVENT',
      `UID:programme-${p.id}@keeva.work`,
      `DTSTAMP:${horodatage}`,
      `DTSTART;VALUE=DATE:${dateEvt}`,
      `DTEND;VALUE=DATE:${dateFin}`,
      `SUMMARY:${echapper(`${m.name} — ${p.label || trad('Entretien programmé')}`)}`,
      `DESCRIPTION:${echapper(trad('Entretien programmé dans KALEA'))}`,
      'END:VEVENT',
    );
  });
  lignes.push('END:VCALENDAR');
  return lignes.join('\r\n');
}
// Généralise la passerelle native éprouvée par l'export ICS ci-dessous (voir
// son commentaire) pour un fichier BINAIRE (le rapport TCO en PDF, entre
// autres) : dans l'appli installée, <a download> ne déclenche souvent RIEN
// de visible (les WebView Android n'ont pas de gestionnaire de
// téléchargements par défaut) — écrire dans le cache (Filesystem) puis
// OUVRIR (FileOpener, ACTION_VIEW) reste le seul chemin qui fonctionne
// réellement, constaté sur appareil. ⚠ BINAIRE : `encoding` n'est PAS posé
// (contrairement à l'ICS, qui est du texte et passe `encoding:'utf8'') —
// sans `encoding`, @capacitor/filesystem écrit l'octet brut et interprète
// `data` comme du base64 ; avec `encoding:'utf8'` un PDF serait corrompu.
async function telechargerFichierBinaire(blob, nomFichier, typeMime) {
  const cap = window.Capacitor;
  const filesystem = cap?.Plugins?.Filesystem;
  const fileOpener = cap?.Plugins?.FileOpener;
  if (cap?.isNativePlatform?.() && filesystem && fileOpener) {
    try {
      const base64 = await new Promise((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onloadend = () => resolve(String(lecteur.result).split(',')[1] || '');
        lecteur.onerror = () => reject(new Error(trad('Lecture du fichier impossible.')));
        lecteur.readAsDataURL(blob);
      });
      const { uri } = await filesystem.writeFile({ path: nomFichier, data: base64, directory: 'CACHE' });
      await fileOpener.open({ filePath: uri, contentType: typeMime, openWithDefault: false });
    } catch (err) {
      // L'utilisateur qui ferme le sélecteur sans choisir n'a rien à se
      // reprocher : ce n'est pas une erreur, jamais annoncée comme telle.
      if (err?.message && !/cancel/i.test(err.message)) {
        showToast(trad('Ouverture impossible :') + ' ' + err.message);
      }
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
// Dans l'appli installée, <a download> (voir le repli tout en bas) ne
// déclenche souvent RIEN de visible : les WebView Android n'ont pas de
// gestionnaire de téléchargements par défaut, contrairement à un vrai
// navigateur — constaté en test réel, bouton resté sans effet apparent.
// Passerelle native : écrire le fichier dans le cache (Filesystem), puis
// l'OUVRIR (FileOpener) — testé en réel : le PARTAGE (Share, ACTION_SEND
// côté Android) n'a jamais proposé les applis calendrier, celles-ci ne
// s'enregistrant que pour « Ouvrir avec » (ACTION_VIEW), un mécanisme
// différent — @capacitor-community/file-opener déclenche précisément
// celui-là, avec le bon type MIME (text/calendar), et Android y présente
// les applis calendrier installées.
async function telechargerPlanningIcs() {
  const { dated } = agendaEvenements();
  if (!dated.length && !programmesAExporter().length) { showToast(trad('Aucune échéance datée à exporter.')); return; }
  const texte = planningIcsTexte();
  const cap = window.Capacitor;
  const filesystem = cap?.Plugins?.Filesystem;
  const fileOpener = cap?.Plugins?.FileOpener;
  if (cap?.isNativePlatform?.() && filesystem && fileOpener) {
    try {
      const { uri } = await filesystem.writeFile({
        path: 'planning-kalea.ics',
        data: texte,
        directory: 'CACHE',
        encoding: 'utf8',
      });
      await fileOpener.open({
        filePath: uri,
        contentType: 'text/calendar',
        openWithDefault: false, // affiche toujours le choix, jamais une ouverture silencieuse avec une appli déjà choisie par défaut
      });
    } catch (err) {
      // L'utilisateur qui ferme le sélecteur sans choisir n'a rien à se
      // reprocher : ce n'est pas une erreur, jamais annoncée comme telle.
      if (err?.message && !/cancel/i.test(err.message)) {
        showToast(trad('Ouverture impossible :') + ' ' + err.message);
      }
    }
    return;
  }
  // Web/bureau : le téléchargement direct fonctionne réellement (double-clic
  // sur le fichier ouvre le calendrier par défaut) — la passerelle native
  // ci-dessus ne sert qu'à contourner la limite propre à l'appli installée.
  const blob = new Blob([texte], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'planning-kalea.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function wireAgenda(root) {
  if (!root) return;
  // Un re-rendu (changement de mois, de filtre…) peut survenir pendant
  // qu'une infobulle est affichée — elle vit hors de `root` (sur
  // document.body), donc rien ne la ferme automatiquement sans ceci.
  agendaTooltipCacher();
  root.querySelectorAll('[data-agenda-vue]').forEach((btn) => btn.addEventListener('click', () => {
    UI.agendaVue = btn.dataset.agendaVue;
    renderApp();
  }));
  root.querySelectorAll('[data-agenda-statut]').forEach((btn) => btn.addEventListener('click', () => {
    UI.agendaStatut = btn.dataset.agendaStatut;
    renderApp();
  }));
  root.querySelector('#agenda-prev')?.addEventListener('click', () => {
    UI.agendaRefIso = agendaVueActive() === 'semaine' ? addDaysIso(agendaRefIso(), -7) : addMonthsIso(agendaRefIso(), -1);
    renderApp();
  });
  root.querySelector('#agenda-next')?.addEventListener('click', () => {
    UI.agendaRefIso = agendaVueActive() === 'semaine' ? addDaysIso(agendaRefIso(), 7) : addMonthsIso(agendaRefIso(), 1);
    renderApp();
  });
  root.querySelector('#agenda-today')?.addEventListener('click', () => {
    UI.agendaRefIso = todayIso();
    renderApp();
  });
  // Toute la case ouvre la même fenêtre (ouvrirJourAgenda), qu'il y ait ou
  // non une échéance — elle contient déjà « Planifier un entretien ». Un
  // seul repère par case, pas un second petit bouton à viser séparément
  // (voir le commentaire d'agendaJourHtml).
  root.querySelectorAll('.agenda-jour[data-jour]').forEach((cell) => cell.addEventListener('click', () => {
    ouvrirJourAgenda(cell.dataset.jour);
  }));
  // Infobulle au survol — DESKTOP UNIQUEMENT (matchMedia hover:hover) : au
  // doigt, aucun survol n'existe, et le tap ouvre déjà directement la même
  // information via ouvrirJourAgenda() ci-dessus — rien à câbler là pour le
  // tactile, pas même en repli dégradé.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    root.querySelectorAll('.agenda-jour[data-jour]').forEach((cell) => {
      cell.addEventListener('mouseenter', () => agendaTooltipAfficher(cell));
      cell.addEventListener('mouseleave', agendaTooltipCacher);
    });
  }
  root.querySelector('#agenda-planifier')?.addEventListener('click', () => ouvrirProgrammerEntretien());
  root.querySelector('#agenda-export-ics')?.addEventListener('click', telechargerPlanningIcs);
  root.querySelector('#agenda-pieces-detail-toggle')?.addEventListener('click', () => {
    UI.agendaPiecesDetail = !UI.agendaPiecesDetail;
    renderApp();
  });
}

VIEWS.agenda = {
  fondBlanc: true,
  title: trad('Agenda'),
  subtitle: () => trad('Échéances datées et compteurs à surveiller'),
  render() {
    // Vide seulement quand il n'y a AUCUNE machine : le calendrier reste
    // utile même sans échéance de plan, puisqu'on peut y programmer un
    // entretien à la main (scheduled_maintenances) — une raison de plus de
    // ne jamais bloquer l'écran tant qu'au moins une machine existe.
    if (!UI.machines.length) {
      return `<div class="ui-page"><section class="ui-section"><div class="ui-aide">${trad('Aucune machine enregistrée. Ajoute une machine pour commencer.')}</div></section></div>`;
    }
    const piecesHtml = preparationCompleteAgendaHtml();
    const calendrier = `
        <section class="ui-section vue-agenda">
          ${teteSectionKit('calendrier', trad('Agenda'), trad('Échéances datées et compteurs à surveiller'),
            `<button type="button" class="ui-btn ui-btn-pastille" id="agenda-export-ics">${picto('export')}<span>${dansApplication() ? trad('Intégrer à l\'agenda du téléphone') : trad('Intégrer à l\'agenda de cet ordinateur')}</span></button><button type="button" class="ui-btn ui-btn-plein" id="agenda-planifier">${picto('croix')}<span>${trad('Planifier un entretien')}</span></button>`)}
          <div class="ui-section-corps">
            ${agendaNavHtml()}
            <div class="agenda-calendrier">${agendaContenuHtml()}</div>
          </div>
        </section>`;
    return `
      <div class="ui-page">
        ${calendrier}
        ${piecesHtml}
      </div>`;
  },
  mount() {
    const racine = document.getElementById('view-root');
    wireChronologie(racine);
    wirePreparation(racine);
    wireReminderSwitches(racine);
    wireAgenda(racine);
  },
};

// ── Vue : Rappels ─────────────────────────────────────────────
// Réglages RÉELS : ils partent en base par update_my_reminders, et c'est le
// serveur qui s'en sert pour envoyer l'e-mail. Rien n'est gardé sur l'appareil :
// un réglage local ne pourrait pas déclencher un envoi quand l'application est
// fermée — c'est-à-dire dans le cas le plus utile.
// État d'une échéance (late / soon / ok) -> classe de statut du kit (liseré, point, étiquette).
function classeEtatKit(etat) {
  return { late: 'is-retard', soon: 'is-bientot', ok: 'is-ok' }[etat] || '';
}

// En-tête de section du kit (icône + titre + sous-titre, repère optionnel à droite) :
// partagé par les écrans migrés vers kit.css. Les textes arrivent déjà traduits.
function teteSectionKit(icone, titre, sous, acces) {
  return `
        <div class="ui-section-tete">
          <div class="ui-section-icone">${picto(icone)}</div>
          <div class="ui-section-titres"><h2 class="ui-section-titre">${titre}</h2>${sous ? `<p class="ui-section-sous">${sous}</p>` : ''}</div>
          ${acces ? `<div class="ui-section-acces">${acces}</div>` : ''}
        </div>`;
}

function blocReglagesRappelsHtml() {
  // Colonnes absentes en base (migration-rappels-email.sql non exécutée) : le
  // formulaire est montré, mais désactivé et accompagné de la marche à suivre.
  // Un bouton qui échoue en silence vaut moins qu'un bouton grisé expliqué.
  const dispo = SCHEMA.hasReminders !== false;
  const bloque = dispo ? '' : ' disabled';
  const actif = rappelsEmailActifs();
  return `
    <section class="ui-section">
      ${teteSectionKit('mail', trad('Recevoir les rappels par e-mail'), '', `<span class="ui-statut ${actif ? 'is-ok' : ''}">${actif ? trad('Canal actif') : trad('Canal inactif')}</span>`)}
      <div class="ui-section-corps">
        <div class="ui-encadre">
          ${picto('case')}
          <p>${trad('L\'e-mail est envoyé directement par le serveur KALEA : il part même si l\'application n\'est pas ouverte, sur le téléphone comme au poste d\'atelier.')}</p>
        </div>
        <div class="ui-champ-groupe">
          <label class="ui-etiquette" for="rap-email">${trad('Adresse de destination des alertes')}</label>
          <input id="rap-email" class="ui-champ" type="email" inputmode="email" autocomplete="email" value="${esc(adresseRappels())}"${bloque}>
        </div>
        <label class="check-row" for="rap-par-email"><input type="checkbox" id="rap-par-email"${rappelsEmailCoches() ? ' checked' : ''}${bloque}> ${trad('Recevoir les rappels par e-mail')}</label>
        <div class="ui-aide">${trad('Laisse l\'adresse vide pour ne plus recevoir de rappel par e-mail. Tant qu\'aucune adresse propre n\'est enregistrée, celle du compte est proposée.')}</div>
        <div class="ui-aide" id="rap-msg" role="status" aria-live="polite"></div>
        <div><button type="button" class="ui-btn ui-btn-plein" id="rap-save"${bloque}>${picto('case')}<span>${trad('Enregistrer les préférences e-mail')}</span></button></div>
        ${dispo ? '' : `<div class="ui-aide">${trad('Mise à jour indisponible : exécute')} <strong>migration-rappels-email.sql</strong> ${trad('dans le SQL Editor de Supabase.')}</div>`}
      </div>
    </section>`;
}

// Interrupteur PERSONNEL de réception des rappels push — même gabarit que
// blocRappelsHtml (dégradation propre si le greffon est absent, permission
// jamais réclamée avant le clic explicite).
function blocPushHtml() {
  if (!pushDisponible()) {
    return `<p class="ui-aide">${trad('Les notifications push nécessitent l\'application Android : installe-la sur ton téléphone pour les recevoir.')}</p>`;
  }
  const actif = !!monTokenPushConnu();
  return `
    <div class="switch-row rappel-switch-row">
      <span class="switch-label">
        <span class="rappel-switch-titre">${trad('Recevoir les rappels d\'échéance par notification push')}</span>
        <span class="rappel-switch-sous">${trad('Envoyée par le serveur, même application fermée — nécessite ton autorisation Android')}</span>
      </span>
      <button type="button" class="switch${actif ? ' on' : ''}" id="acc-push" role="switch" aria-checked="${actif ? 'true' : 'false'}" aria-label="${trad('Recevoir les rappels d\'échéance par notification push')}"><span></span></button>
    </div>
    <div class="ui-aide" id="acc-push-msg" role="status" aria-live="polite"></div>`;
}

// Ciblage par rôle, réservé au gérant — même idiome que blocParametresTcoHtml
// (UI.role === 'gerant') : visible à tous pour que chacun sache que le
// réglage existe, contrôles désactivés pour un non-gérant (la vraie barrière
// est côté serveur, dans update_reminder_roles, comme peutGererEquipe()
// ailleurs). Un délai d'anticipation par rôle, EN PLUS de celui déjà réglé
// sur chaque plan de maintenance — jamais à la place.
// Remet à jour, après un enregistrement, la pastille du bloc et la tuile du haut (version navigateur).
function majIndicateursPushSociete(root) {
  const actif = !!(UI.company && UI.company.reminders_push);
  const bouton = root && root.querySelector('#push-cible-save');
  const pastille = bouton ? bouton.closest('.ui-section, .ui-groupe')?.querySelector('.ui-statut') : null;
  if (pastille) {
    pastille.classList.toggle('is-ok', actif);
    pastille.textContent = actif ? trad('Canal actif') : trad('Canal inactif');
  }
  const tuile = document.querySelector('[data-tuile="push-societe"]');
  if (tuile) {
    tuile.classList.toggle('is-ok', actif);
    const valeur = tuile.querySelector('.ui-tuile-valeur');
    if (valeur) valeur.textContent = actif ? trad('Activé pour la société') : trad('Désactivé');
  }
}
function blocCiblagePushHtml() {
  const c = UI.company || {};
  const dispo = SCHEMA.hasPushRoles !== false;
  const gerant = UI.role === 'gerant';
  const bloque = (gerant && dispo) ? '' : ' disabled';
  const roles = (c.reminders_push_roles && typeof c.reminders_push_roles === 'object') ? c.reminders_push_roles : {};
  const actif = !!c.reminders_push;
  const ROLES_CIBLE = [
    { id: 'gerant', label: trad('Gérant') },
    { id: 'mecanicien', label: trad('Droit de gestion') },
    { id: 'chauffeur', label: trad('Droit de saisie') },
  ];
  const multi = planMultiUtilisateurs();
  const rolesAffiches = multi ? ROLES_CIBLE : ROLES_CIBLE.filter((r) => r.id === 'gerant');
  const ligneRole = (r) => {
    const reglage = roles[r.id] || null;
    const coche = !!reglage;
    return `
        <div class="ui-groupe">
          <label class="check-row" for="push-role-${r.id}"><input type="checkbox" id="push-role-${r.id}" data-role="${r.id}"${coche ? ' checked' : ''}${bloque}> <strong>${esc(r.label)}</strong></label>
          <div class="ui-grille">
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="push-role-${r.id}-jours">${trad('Jours avant (machines datées)')}</label>
              <input type="number" class="ui-champ" min="0" inputmode="numeric" id="push-role-${r.id}-jours" value="${reglage && reglage.jours != null ? esc(reglage.jours) : ''}" placeholder="${FALLBACK_REMINDER_DAYS}"${bloque}>
            </div>
            <div class="ui-champ-groupe">
              <label class="ui-etiquette" for="push-role-${r.id}-compteur">${trad('Avant l\'échéance du compteur (h ou km)')}</label>
              <input type="number" class="ui-champ" min="0" inputmode="numeric" id="push-role-${r.id}-compteur" value="${reglage && reglage.compteur != null ? esc(reglage.compteur) : ''}" placeholder="${FALLBACK_REMINDER_HOURS}"${bloque}>
            </div>
          </div>
        </div>`;
  };
  return `
    <section class="ui-section">
      ${teteSectionKit('cloche', trad('Notifications push — qui est prévenu'), '', `<span class="ui-statut ${actif ? 'is-ok' : ''}">${actif ? trad('Canal actif') : trad('Canal inactif')}</span>`)}
      <div class="ui-section-corps">
        <p class="ui-aide">${trad('Choisis quels rôles reçoivent les rappels d\'échéance par notification, et à quel délai d\'anticipation chacun. Ce délai s\'ajoute à celui déjà réglé sur chaque plan de maintenance, il ne le remplace pas. Seuls les membres ayant eux-mêmes activé le push sur leur téléphone les recevront réellement — ce réglage choisit QUI est ciblé, pas d\'activer le push à leur place.')}</p>
        <label class="check-row" for="push-cible-actif"><input type="checkbox" id="push-cible-actif"${actif ? ' checked' : ''}${bloque}> ${trad('Activer les notifications push pour cette société')}</label>
        ${rolesAffiches.map(ligneRole).join('')}
        ${multi ? '' : `<div class="ui-aide">${trad('Ciblage par rôle : disponible avec plusieurs utilisateurs (offre Business).')}</div>`}
        ${!dispo ? `<div class="ui-aide">${trad('Mise à jour indisponible : exécute')} <strong>migration-push-notifications.sql</strong> ${trad('dans le SQL Editor de Supabase.')}</div>` : (!gerant ? `<div class="ui-aide">${trad('Réservé au gérant.')}</div>` : '')}
        <div class="ui-aide" id="push-cible-msg" role="status" aria-live="polite"></div>
        <div><button type="button" class="ui-btn ui-btn-plein" id="push-cible-save"${bloque}>${picto('case')}<span>${trad('Enregistrer le ciblage')}</span></button></div>
      </div>
    </section>`;
}

function wirePush(root) {
  if (!root) return;
  const bouton = root.querySelector('#acc-push');
  const msg = root.querySelector('#acc-push-msg');
  bouton?.addEventListener('click', async () => {
    const actif = !bouton.classList.contains('on');
    bouton.disabled = true;
    if (msg) msg.textContent = actif ? trad('Activation…') : trad('Désactivation…');
    if (actif) {
      const resultat = await activerPush();
      if (resultat.refuse) {
        if (msg) msg.textContent = trad('Autorisation refusée : Android n\'affichera aucune notification. Tu peux l\'accorder dans les réglages de l\'application.');
      } else if (resultat.erreur) {
        if (msg) msg.textContent = tR('Activation impossible : {erreur}', { erreur: resultat.erreur });
      } else {
        bouton.classList.add('on');
        bouton.setAttribute('aria-checked', 'true');
        if (msg) msg.textContent = trad('Notifications activées.');
      }
    } else {
      await desactiverPush();
      bouton.classList.remove('on');
      bouton.setAttribute('aria-checked', 'false');
      if (msg) msg.textContent = trad('Notifications désactivées sur cet appareil.');
    }
    bouton.disabled = false;
  });
}

function wireCiblagePush(root) {
  if (!root) return;
  root.querySelector('#push-cible-save')?.addEventListener('click', async () => {
    const bouton = root.querySelector('#push-cible-save');
    const msg = root.querySelector('#push-cible-msg');
    const actif = !!root.querySelector('#push-cible-actif')?.checked;
    const roles = {};
    const existants = (UI.company && UI.company.reminders_push_roles && typeof UI.company.reminders_push_roles === 'object') ? UI.company.reminders_push_roles : {};
    ['gerant', 'mecanicien', 'chauffeur'].forEach((id) => {
      const caseRole = root.querySelector(`#push-role-${id}`);
      // Ligne non affichée (offre à un seul utilisateur) : on ne touche pas à ce qui était déjà enregistré.
      if (!caseRole) { if (existants[id]) roles[id] = existants[id]; return; }
      const coche = caseRole.checked;
      if (!coche) return;
      const joursVal = root.querySelector(`#push-role-${id}-jours`)?.value;
      const compteurVal = root.querySelector(`#push-role-${id}-compteur`)?.value;
      const jours = joursVal !== '' && joursVal != null ? parseInt(joursVal, 10) : null;
      const compteur = compteurVal !== '' && compteurVal != null ? parseInt(compteurVal, 10) : null;
      if (jours == null && compteur == null) return; // coché mais sans seuil : ne cible rien de réel, on n'enregistre pas ce rôle
      roles[id] = { jours, compteur };
    });
    bouton.disabled = true;
    try {
      const { error } = await sb.rpc('update_reminder_roles', { p_actif: actif, p_roles: roles });
      if (error) throw error;
      UI.company.reminders_push = actif;
      UI.company.reminders_push_roles = roles;
      majIndicateursPushSociete(root);
      if (msg) { msg.style.color = 'var(--ok)'; msg.textContent = trad('Ciblage enregistré.'); }
    } catch (err) {
      if (msg) { msg.style.color = 'var(--late)'; msg.textContent = trad('Enregistrement impossible.') + ' ' + ((err && err.message) || ''); }
    }
    bouton.disabled = false;
  });
}

// La carte des rappels locaux : c'était le contenu de « Mon compte », déménagé
// tel quel (mêmes identifiants, mêmes fonctions de câblage) — seul l'habillage
// change. Sur le web, sans le greffon Android, elle le dit et s'arrête là.
function carteRappelsTelephoneHtml() {
  const disponible = rappelsDisponibles();
  return `
    <section class="ui-section">
      ${teteSectionKit('telephone', trad('Rappels sur le téléphone & tablettes d\'atelier'), trad('Notifications natives Android (Alarm Manager) : elles sont gérées directement par le terminal, sans dépendre de la couverture réseau ni d\'un compte cloud tiers.'), `<span class="ui-statut ${disponible ? 'is-ok' : ''}">${disponible ? trad('Appareil local') : trad('Application requise')}</span>`)}
      <div class="ui-section-corps">
        ${blocRappelsHtml()}
      </div>
    </section>`;
}

// Ce qui marche vraiment, et quand. Un texte qui décrit le produit est une
// promesse : il ne doit annoncer que ce que le serveur fait déjà. Même trois
// phrases qu'avant, réparties sur trois tuiles au lieu d'un paragraphe unique.
function blocFonctionnementRappelsHtml() {
  const tuiles = [
    { titre: trad('Anticipation mesurée'), texte: trad('KALEA envoie un e-mail avant chaque échéance, puis rien de plus le même jour : un rappel qui arrive au bon moment se lit, une série de messages finit par être ignorée.') },
    { titre: trad('Délai réglable par machine'), texte: trad('Le délai se règle sur le plan de maintenance de chaque machine : 7 jours avant l\'échéance par défaut quand elle est datée, et la fenêtre de rappel du compteur pour un engin suivi en heures ou en kilomètres — ces machines-là n\'ont pas de date à annoncer.') },
    { titre: trad('Indépendance réseau'), texte: trad('L\'envoi est fait par le serveur : le rappel part même si l\'application n\'est pas ouverte. Sur le téléphone, l\'application Android programme en plus ses propres notifications, sans réseau ni compte tiers. Les notifications push suivent le même principe, avec en plus un délai d\'anticipation réglable par rôle.') },
  ];
  return `
    <section class="ui-section">
      ${teteSectionKit('cloche', trad('Comment ça fonctionne en détail'), '')}
      <div class="ui-grille is-3">
        ${tuiles.map((t) => `
        <div class="ui-tuile">
          <span class="ui-tuile-etiquette">${t.titre}</span>
          <span class="ui-tuile-note">${t.texte}</span>
        </div>`).join('')}
      </div>
    </section>`;
}

// Le résumé du haut : trois canaux, leur état réel — jamais un taux de
// délivrabilité ou un statut serveur que rien ne mesure ici.
// Trois tuiles verticales, comme la maquette — une valeur réelle chacune,
// jamais un taux de délivrabilité ou un statut serveur que rien ne mesure ici.
// La 2e tuile affiche le compte RÉEL de la file locale ; comme il ne se lit
// qu'en interrogeant le greffon (async), elle démarre vide et se remplit dans
// majRappelsLocaux(), au même moment que le reste de la carte « téléphone ».
function apercuRappelsHtml() {
  chargerAppareilsPush();
  const pushSociete = !!(UI.company && UI.company.reminders_push);
  const parEmail = rappelsEmailActifs();
  const surTelephone = rappelsDisponibles();
  const parPush = !!monTokenPushConnu();
  const tuile = (etat, label, valeur, texte, idValeur, attr) => `
        <div class="ui-tuile${etat ? ' is-ok' : ''}"${attr ? ' ' + attr : ''}>
          <span class="ui-tuile-etiquette">${label}</span>
          <span class="ui-tuile-valeur"${idValeur ? ` id="${idValeur}"` : ''}>${valeur}</span>
          <span class="ui-tuile-note">${texte}</span>
        </div>`;
  return `
    <section class="ui-section">
      <div class="ui-grille is-3">
        ${tuile(parEmail, trad('Canal d\'alerte e-mail'), parEmail ? trad('Actif') : trad('Inactif'), trad('Avant chaque échéance datée'), null, 'data-tuile="email"')}
        ${surTelephone
          ? tuile(true, trad('App mobile Android'), trad('Actif'), trad('Service d\'arrière-plan · indépendant du réseau'), 'rappel-tuile-file')
          : tuile(UI.appareilsPush > 0, trad('App mobile Android'), UI.appareilsPush > 0 ? trad('Actif') : trad('À installer'), trad('Service d\'arrière-plan · indépendant du réseau'), null, 'data-tuile="telephone"')}
        ${pushDisponible()
          ? tuile(parPush, trad('Notifications push'), parPush ? trad('Actif sur ce téléphone') : trad('Inactif sur ce téléphone'), trad('Ciblage et délai réglables par droit d\'accès'))
          : tuile(pushSociete, trad('Notifications push'), pushSociete ? trad('Activé pour la société') : trad('Désactivé'), trad('Reçues sur l\'application Android'), null, 'data-tuile="push-societe"')}
        ${tuile(false, trad('Anticipation d\'atelier'), tR('{n} jours', { n: FALLBACK_REMINDER_DAYS }), trad('Réglable individuellement sur chaque machine'))}
      </div>
    </section>`;
}

// Câblage du champ e-mail de rappels : partagé par la vue « Rappels » et la
// carte « Contact & Alertes » de « Mon compte » — les deux rendent EXACTEMENT
// les mêmes id (#rap-email / #rap-par-email / #rap-save / #rap-msg), donc une
// seule fonction suffit ; il ne peut jamais y en avoir deux montées ensemble.
// Remet à jour les deux indicateurs de l'état du canal e-mail APRÈS un enregistrement : la pastille « Canal actif / inactif » du bloc
// et la tuile « Canal d'alerte e-mail » en haut de la vue. Ils étaient dessinés une fois, à l'ouverture, et restaient figés.
function majIndicateursRappelsEmail(root) {
  const actif = rappelsEmailActifs();
  const bouton = root && root.querySelector('#rap-save');
  const bloc = bouton ? bouton.closest('.ui-groupe, .ui-section') : null;
  const pastille = bloc ? bloc.querySelector('.ui-statut') : null;
  if (pastille) {
    pastille.classList.toggle('is-ok', actif);
    pastille.textContent = actif ? trad('Canal actif') : trad('Canal inactif');
  }
  const tuile = document.querySelector('[data-tuile="email"]');
  if (tuile) {
    tuile.classList.toggle('is-ok', actif);
    const valeur = tuile.querySelector('.ui-tuile-valeur');
    if (valeur) valeur.textContent = actif ? trad('Actif') : trad('Inactif');
  }
}
function wireReglagesRappelsEmail(root) {
  if (!root) return;
  const msg = root.querySelector('#rap-msg');
  const champ = root.querySelector('#rap-email');
  const caseEmail = root.querySelector('#rap-par-email');
  const bouton = root.querySelector('#rap-save');

  bouton?.addEventListener('click', async () => {
    const adresse = (champ && champ.value ? champ.value : '').trim();
    const parEmail = !!(caseEmail && caseEmail.checked);
    // Une adresse manifestement fausse ne part pas en base : le serveur
    // écrirait dans le vide, et l'utilisateur croirait être prévenu.
    if (adresse && !emailValide(adresse)) {
      champ?.setAttribute('aria-invalid', 'true');
      if (msg) {
        msg.style.color = 'var(--late)';
        msg.textContent = trad('Cette adresse e-mail n\'est pas valide : aucun rappel ne pourrait partir.');
      }
      return;
    }
    champ?.removeAttribute('aria-invalid');
    bouton.disabled = true;
    bouton.textContent = trad('Enregistrement…');
    try {
      // Convention de la fonction SQL : null = ne pas toucher, chaîne vide =
      // effacer. WhatsApp reste donc à null — le serveur garde sa valeur, et
      // rien ici ne laisse croire qu'un réglage WhatsApp existe.
      const { error } = await sb.rpc('update_my_reminders', {
        p_notification_email: adresse,
        p_by_email: parEmail,
        p_by_whatsapp: null,
      });
      if (error) throw error;

      UI.company.notification_email = adresse || null;
      UI.company.reminders_email = parEmail;
      majIndicateursRappelsEmail(root);
      if (msg) {
        msg.style.color = 'var(--ok)';
        if (!adresse) msg.textContent = trad('Aucune adresse enregistrée : aucun rappel par e-mail ne partira.');
        else if (parEmail) msg.textContent = trad('Réglages enregistrés : les rappels partiront à cette adresse.');
        else msg.textContent = trad('Adresse enregistrée, mais les rappels par e-mail sont désactivés.');
      }
    } catch (err) {
      // Le détail vient du serveur (« Aucune société rattachée à ce compte »,
      // panne réseau…) : sans lui, l'utilisateur ne peut rien corriger.
      const detail = err && err.message ? err.message : '';
      if (msg) {
        msg.style.color = 'var(--late)';
        msg.textContent = trad('Enregistrement impossible.') + " " + detail;
      }
    }
    bouton.disabled = false;
    bouton.textContent = trad('Enregistrer');
  });
}

VIEWS.reminders = {
  fondBlanc: true,
  title: trad('Rappels & Notifications d\'échéance'),
  subtitle: () => trad('Gestion des alertes préventives envoyées par le serveur, sur terminal mobile Android et par e-mail avant chaque seuil d\'entretien critique.'),
  render() {
    return `
      <div class="ui-page">
        ${apercuRappelsHtml()}
        <div class="ui-colonnes">
          <div class="ui-colonne">
            ${blocReglagesRappelsHtml()}
            <section class="ui-section">
              ${teteSectionKit('telephone', trad('Notifications push (application mobile)'), '')}
              <div class="ui-section-corps"><div class="ui-groupe">${blocPushHtml()}</div></div>
            </section>
            ${carteRappelsTelephoneHtml()}
          </div>
          <div class="ui-colonne">
            ${blocCiblagePushHtml()}
          </div>
        </div>
        ${blocFonctionnementRappelsHtml()}
      </div>`;
  },
  mount() {
    // L'état de l'autorisation et ce qui attend, à l'ouverture de la rubrique :
    // on ne fait pas attendre l'utilisateur qu'une notification arrive (ou
    // n'arrive pas) pour savoir où il en est. Même câblage que « Mon compte »
    // avant elle, simplement rapatrié avec la carte.
    majRappelsLocaux(document.getElementById('view-root'));

    document.getElementById('view-root')?.querySelector('#acc-rappels-test')?.addEventListener('click', async () => {
      const root = document.getElementById('view-root');
      const bouton = root.querySelector('#acc-rappels-test');
      if (bouton) { bouton.disabled = true; bouton.textContent = trad('Programmation du test…'); }
      await testerRappelLocal(root);
      if (bouton) { bouton.disabled = false; bouton.textContent = trad('Tester la notification'); }
      await majRappelsLocaux(root);
    });

    document.getElementById('view-root')?.querySelector('#acc-rappels')?.addEventListener('click', async (e) => {
      const root = document.getElementById('view-root');
      const bouton = e.currentTarget;
      const msg = root.querySelector('#acc-rappels-msg');
      // Bouton-interrupteur (role="switch"), pas une case à cocher : l'état
      // qui compte est celui qu'on VA prendre, l'inverse de celui affiché.
      const actif = !bouton.classList.contains('on');
      bouton.classList.toggle('on', actif);
      bouton.setAttribute('aria-checked', actif ? 'true' : 'false');
      activerRappels(actif);
      if (msg) msg.textContent = actif ? 'Programmation…' : '';
      // Désactiver n'appelle pas programmerRappels : celui-ci se contenterait
      // d'annuler, mais autant le dire explicitement ici.
      const resultat = actif ? await programmerRappels({ demander: true })
        : await (async () => { await annulerRappels(); return { desactives: true }; })();
      await majRappelsLocaux(root);
      if (!msg) return;
      if (resultat.erreur) {
        msg.textContent = tR('Rappels non programmés : {erreur}', { erreur: resultat.erreur });
      } else if (resultat.refuse) {
        msg.textContent = trad('Autorisation refusée : Android n\'affichera aucun rappel. Tu peux l\'accorder dans les réglages de l\'application.');
        bouton.classList.remove('on');
        bouton.setAttribute('aria-checked', 'false');
        activerRappels(false);
      } else if (resultat.programmees === 0) {
        msg.textContent = trad('Aucune échéance datée à annoncer pour le moment.');
      } else if (resultat.programmees) {
        msg.textContent = tR('{n} rappel(s) programmé(s).', { n: resultat.programmees });
      } else {
        msg.textContent = trad('Rappels désactivés.');
      }
    });

    // Conservé, et il ne câble plus rien : plus aucun interrupteur
    // `data-reminder` n'existe, donc querySelectorAll renvoie une liste vide.
    // C'est voulu — un interrupteur sans effet ne doit pas revenir par
    // inadvertance sans que ce test cesse de passer.
    wireReminderSwitches(document.getElementById('view-root'));

    wireReglagesRappelsEmail(document.getElementById('view-root'));
    wirePush(document.getElementById('view-root'));
    wireCiblagePush(document.getElementById('view-root'));
  },
};
