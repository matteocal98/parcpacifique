/* KALEA — application (app.html) : Télémétrie, carte GPS des machines, support (tickets) côté client.
 *
 * Fichier chargé par app.html, dans l'ordre des numéros (app-01 … app-14), PUIS le petit script de démarrage en ligne.
 * Tous partagent la même portée globale (constantes et fonctions visibles d'un fichier à l'autre), comme avant le découpage.
 * Découpage MÉCANIQUE de l'ancien script unique (étape 2 de l'allègement) : aucun code modifié, seulement coupé.
 * Après toute modification : node outils/maj-empreinte-csp.mjs
 *
 * Sections de ce fichier :
 *   · TÉLÉMÉTRIE — compteur automatique (phase 1)
 *   · GÉOLOCALISATION — carte des machines (phase 3)
 *   · Support côté client (tickets)
 */
// ───────────────────────── début du code ─────────────────────────
// ═══ TÉLÉMÉTRIE — compteur automatique (phase 1) ════════════════════════════
// Un boîtier, Flespi ou un système tiers envoie les heures / kilomètres d'une
// machine à la fonction serveur `telemetrie-ingest`, qui met à jour
// machines.counter_value. Les échéances et les rappels relisent ce compteur :
// rien d'autre ne change. Réservé à l'offre Enterprise, et
// OPTIONNEL : la saisie manuelle reste disponible partout.
//
// Même séparation que le TCO : SCHEMA.hasTelemetry (la migration est en place,
// sondé au boot) reste indépendant du palier ; telemetrieActif() décide si le
// module est ACCESSIBLE. Au boot, on lit SCHEMA.hasTelemetry — jamais
// telemetrieActif() — car UI.companyPlan n'est pas encore affecté à ce stade
// (même bug que le TCO, voir keeva-tco-boot-order-bug).
function planCouvreTelemetrie() {
  // Enterprise UNIQUEMENT (décision du 2026-10-04 — jusque-là Business aussi).
  // offreDeLaGrille() ramène déjà paid/unlimited sur 'enterprise'.
  return offreDeLaGrille(UI.companyPlan || 'free').cle === 'enterprise';
}
function telemetrieActif() {
  return SCHEMA.hasTelemetry && planCouvreTelemetrie();
}

// Pastille « Auto · il y a 2 h » posée à côté du compteur d'une machine reliée.
// Elle ne dit que ce que la base sait : le dernier relevé reçu. Une machine
// reliée qui ne reçoit plus rien depuis plus de 3 jours passe en « sans signal »
// (boîtier débranché, batterie vide…) au lieu de laisser croire que le compteur
// est à jour.
const TELEMETRIE_SILENCE_MS = 3 * 24 * 3600 * 1000;
function telemetrieBadgeHtml(m) {
  if (!m || m.counter_source !== 'telemetry') return '';
  if (!m.telemetry_last_at) {
    return `<span class="tele-badge is-attente" title="${esc(trad('Machine reliée à un boîtier : en attente du premier relevé.'))}">${trad('Auto · en attente')}</span>`;
  }
  const age = Date.now() - new Date(m.telemetry_last_at).getTime();
  if (age > TELEMETRIE_SILENCE_MS) {
    return `<span class="tele-badge is-silence" title="${esc(trad('Aucun relevé reçu depuis plus de 3 jours : vérifie le boîtier.'))}">${trad('Auto · sans signal')} (${esc(ilYaSupport(m.telemetry_last_at))})</span>`;
  }
  return `<span class="tele-badge">${trad('Auto')} · ${esc(ilYaSupport(m.telemetry_last_at))}</span>`;
}

// Mise à jour EN DIRECT des machines reliées. L'appli ne relit la base qu'au
// démarrage : sans ceci, un relevé reçu pendant que l'écran est ouvert
// n'apparaissait qu'après un rechargement de la page. Toutes les minutes (et au
// retour sur l'onglet), on relit SEULEMENT le compteur et le dernier signal des
// machines reliées — une requête légère, sans rien recharger d'autre.
//
// On ne redessine l'écran que si une valeur a réellement changé, et JAMAIS sous
// les doigts de quelqu'un : fenêtre ouverte ou champ en cours de saisie → la
// valeur est mise à jour en mémoire, l'écran la montrera au prochain rendu. Un
// relevé manuel encore en attente d'envoi n'est jamais écrasé.
const TELEMETRIE_RAFRAICHIR_MS = 60 * 1000;
let telemetrieRafraichissementEnCours = false;
async function rafraichirTelemetrie() {
  if (telemetrieRafraichissementEnCours) return;
  if (!SCHEMA.hasTelemetry || !UI.companyId || document.hidden) return;
  const reliees = (UI.machines || []).filter((m) => m.counter_source === 'telemetry');
  if (!reliees.length) return;
  telemetrieRafraichissementEnCours = true;
  try {
    const colonnes = ['id', 'counter_value', 'telemetry_last_at', ...(SCHEMA.hasCounter2 ? ['counter_value_2'] : []),
      ...(SCHEMA.hasGps ? ['last_lat', 'last_lon', 'last_position_at'] : [])].join(', ');
    const { data, error } = await sb.from('machines').select(colonnes)
      .eq('company_id', UI.companyId).eq('counter_source', 'telemetry');
    if (error || !Array.isArray(data)) return;
    let change = false;
    data.forEach((ligne) => {
      const m = reliees.find((x) => x.id === ligne.id);
      if (!m) return;
      if (typeof compteurEnAttenteDe === 'function' && compteurEnAttenteDe(m.id) != null) return;
      let modifiee = false;
      ['counter_value', 'counter_value_2', 'telemetry_last_at', 'last_lat', 'last_lon', 'last_position_at'].forEach((k) => {
        if (k in ligne && ligne[k] !== m[k]) { m[k] = ligne[k]; modifiee = true; }
      });
      if (modifiee) { change = true; majCacheCompteur(m); }
    });
    if (!change) return;
    // Sur le menu Télémétrie, la carte est vivante : on déplace les repères sans redessiner
    // l'écran (un rendu fermerait la fenêtre ouverte, effacerait le trajet et le zoom).
    if (UI.view === 'telemetrie' && carteGpsVivante()) { majMarqueursGps(); return; }
    const occupe = document.querySelector('.overlay')
      || (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
    if (occupe) return;
    const haut = window.scrollY;
    renderApp();
    window.scrollTo(0, haut);
  } catch (err) { /* hors connexion ou erreur passagère : on réessaiera à la prochaine minute */ }
  finally { telemetrieRafraichissementEnCours = false; }
}
setInterval(rafraichirTelemetrie, TELEMETRIE_RAFRAICHIR_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) rafraichirTelemetrie(); });

// ═══ GÉOLOCALISATION — carte des machines (phase 3) ═══════════════════════════
// Une grande carte dans le menu Télémétrie : un repère par machine que le gérant a
// cochée « Localiser », coloré par état d'entretien (le même code couleur que les
// badges), et le trajet des dernières 24 h / 7 j / 60 j au clic.
//
// RÈGLES DE PROTECTION DES DONNÉES (voir kalea-serveur/migrations/telemetrie-gps.sql) :
//   · rien n'est stocké tant que « Localiser » n'est pas coché sur la machine ;
//   · dernière position + historique de 60 jours maximum (purge horaire côté serveur) ;
//   · décocher « Localiser » SUPPRIME la dernière position et tout l'historique.
//
// FOND DE CARTE : tuiles OpenStreetMap (gratuites). Leur politique interdit le
// pré-téléchargement et le hors-ligne, exige l'attribution visible, et peut retirer
// l'accès à tout moment à un usage commercial : l'adresse est donc UNE constante, pour
// passer chez un fournisseur européen en changeant une seule ligne.
// Leaflet est EMBARQUÉ (vendor/leaflet.*), jamais chargé depuis un CDN, et seulement à
// l'ouverture du menu — il n'alourdit aucun autre écran.
const URL_TUILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION_TUILES = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
let carteGps = null;                       // instance Leaflet vivante (ou null)
const couchesGps = { marqueurs: new Map(), trajet: null };
// Mémoire de la vue entre deux rendus : sans elle, un rendu de l'écran remettrait la
// carte à zéro (zoom perdu, trajet effacé).
// `manuel` : le visiteur a lui-même déplacé ou zoomé la carte — seul cas où sa vue est conservée
// (sinon la carte se recadre sur les machines à chaque ouverture).
const etatCarteGps = { centre: null, zoom: null, trajet: null, manuel: false };
let promesseLeaflet = null;

function chargerLeaflet() {
  if (window.L && window.L.map) return Promise.resolve(window.L);
  if (promesseLeaflet) return promesseLeaflet;
  promesseLeaflet = new Promise((ok, ko) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'vendor/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'vendor/leaflet.js';
    js.onload = () => ((window.L && window.L.map) ? ok(window.L) : ko(new Error('Leaflet')));
    js.onerror = () => { promesseLeaflet = null; ko(new Error('Leaflet introuvable')); };
    document.head.appendChild(js);
  });
  return promesseLeaflet;
}

function machinesLocalisees() {
  return (UI.machines || []).filter((m) => m.position_enabled && m.last_lat != null && m.last_lon != null
    && Number.isFinite(Number(m.last_lat)) && Number.isFinite(Number(m.last_lon)));
}

function carteGpsHtml() {
  if (!telemetrieActif() || !SCHEMA.hasGps || UI.role !== 'gerant') return '';
  return `
    <section class="ui-section tele-carte-gps" id="tele-carte-gps">
      ${teteSectionKit('monde', trad('Carte des machines'), '', '<span class="ui-tag" id="tele-carte-compte"></span>')}
      <div class="ui-section-corps">
        <div class="tele-carte-zone" id="tele-carte-zone" role="application" aria-label="${esc(trad('Carte des machines localisées'))}"></div>
        <div class="ui-aide" id="tele-carte-msg" role="status" aria-live="polite"></div>
        <p class="ui-aide tele-carte-note">${trad('Seules les machines où « Localiser » est coché apparaissent ici. Leur position est conservée 60 jours puis supprimée ; la décocher supprime tout de suite la position et le trajet.')} <a href="./politique-confidentialite.html" target="_blank">${trad('Politique de confidentialité')}</a></p>
      </div>
    </section>`;
}

function detruireCarteGps() {
  effacerTrajetGps(false);
  couchesGps.marqueurs.clear();
  if (carteGps) { try { carteGps.remove(); } catch (err) { /* déjà retirée avec l'écran */ } }
  carteGps = null;
}

function carteGpsVivante() {
  return !!(carteGps && window.L && document.body.contains(carteGps.getContainer()));
}

function messageCarteGps(texte, erreur) {
  const msg = document.getElementById('tele-carte-msg');
  if (!msg) return null;
  msg.textContent = texte || '';
  msg.className = erreur ? 'ui-aide is-late' : 'ui-aide';
  return msg;
}

// La photo de la machine (celle de la carte du Parc) ; à défaut, le pictogramme d'une caisse.
// safeUrl() est la même garde que partout ailleurs : jamais une adresse non vérifiée dans un src.
function vignetteMachineGps(m) {
  const photo = safeUrl(m.image_url);
  return photo
    ? `<img class="tele-vignette" src="${esc(photo)}" alt="${esc(m.name)}" loading="lazy">`
    : `<span class="tele-vignette tele-vignette-vide">${picto('boite')}</span>`;
}

// Info-bulle FIXE au-dessus de chaque repère : la photo et le nom, rien de plus (le détail est
// dans la fenêtre du clic). Toujours affichée, sans survol ni clic — donc aussi sur téléphone.
function contenuInfobulleGps(machineId) {
  const m = (UI.machines || []).find((x) => x.id === machineId);
  const div = document.createElement('div');
  div.className = 'tele-infobulle-contenu';
  if (m) div.innerHTML = `${vignetteMachineGps(m)}<strong>${esc(m.name)}</strong>`;
  return div;
}

function contenuPopupGps(machineId) {
  const m = (UI.machines || []).find((x) => x.id === machineId);
  const div = document.createElement('div');
  div.className = 'tele-popup';
  if (!m) return div;
  div.innerHTML = `
    <span class="tele-popup-entete">${vignetteMachineGps(m)}<strong>${esc(m.name)}</strong></span>
    <span class="tele-popup-sous">${esc(tR('Position {quand}', { quand: m.last_position_at ? ilYaSupport(m.last_position_at) : '—' }))}</span>
    <span class="tele-popup-sous">${esc(formatCounter(machineCounter(m), counterUnitOf(m)))}</span>
    <span class="tele-popup-titre">${trad('Afficher le trajet')}</span>
    <span class="tele-popup-actions">
      <button type="button" data-jours="1">${trad('24 h')}</button>
      <button type="button" data-jours="7">${trad('7 jours')}</button>
      <button type="button" data-jours="60">${trad('60 jours')}</button>
    </span>`;
  div.querySelectorAll('button[data-jours]').forEach((b) => {
    b.addEventListener('click', () => afficherTrajetGps(m.id, Number(b.getAttribute('data-jours'))));
  });
  return div;
}

// Plusieurs machines au MÊME endroit (même chantier, même dépôt) : UN SEUL repère, qui porte le nombre de
// machines. Les écarter en petit cercle, comme on l'avait essayé, faisait croire à des lieux différents dès
// qu'on zoomait. La bulle liste les machines, et la fenêtre du clic donne à chacune ses boutons de trajet.
function contenuInfobulleGroupeGps(ids) {
  const div = document.createElement('div');
  div.className = 'tele-infobulle-groupe';
  ids.forEach((id) => div.appendChild(contenuInfobulleGps(id)));
  return div;
}
function contenuPopupGroupeGps(ids) {
  const div = document.createElement('div');
  div.className = 'tele-popup-groupe';
  const titre = document.createElement('strong');
  titre.className = 'tele-popup-groupe-titre';
  titre.textContent = tR('{n} machines à cet endroit', { n: ids.length });
  div.appendChild(titre);
  ids.forEach((id) => div.appendChild(contenuPopupGps(id)));
  return div;
}

function majMarqueursGps(ajuster) {
  if (!carteGpsVivante()) return;
  const L = window.L;
  const vus = new Set();
  const points = [];
  const groupes = new Map();
  machinesLocalisees().forEach((m) => {
    const lat = Number(m.last_lat);
    const lon = Number(m.last_lon);
    points.push([lat, lon]);
    const cle = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (!groupes.has(cle)) groupes.set(cle, { lat, lon, machines: [] });
    groupes.get(cle).machines.push(m);
  });
  const gravite = { late: 2, soon: 1, ok: 0 };
  groupes.forEach((groupe, cle) => {
    const { lat, lon } = groupe;
    const machines = groupe.machines.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const ids = machines.map((m) => m.id);
    const nombre = machines.length;
    const idMarqueur = nombre === 1 ? ids[0] : `groupe:${cle}`;
    vus.add(idMarqueur);
    // L'état du repère est celui de la machine la plus en retard du groupe.
    let etat = 'ok';
    machines.forEach((m) => {
      let e = 'ok';
      try { e = infoMachine(m).state; } catch (err) { /* état inconnu : repère neutre */ }
      if (e !== 'late' && e !== 'soon') e = 'ok';
      if ((gravite[e] || 0) > (gravite[etat] || 0)) etat = e;
    });
    const icone = L.divIcon({
      className: 'tele-marker',
      html: `<span class="tele-marker-pt is-${etat}">${nombre > 1 ? `<b class="tele-marker-nb">${nombre}</b>` : ''}</span>`,
      iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12],
    });
    let mk = couchesGps.marqueurs.get(idMarqueur);
    if (mk) {
      mk._ids = ids;
      mk.setLatLng([lat, lon]);
      mk.setIcon(icone);
      if (mk.getTooltip()) mk.setTooltipContent(mk._ids.length > 1 ? contenuInfobulleGroupeGps(mk._ids) : contenuInfobulleGps(mk._ids[0]));
    } else {
      mk = L.marker([lat, lon], { icon: icone, title: machines.map((m) => m.name).join(', ') }).addTo(carteGps);
      mk._ids = ids;
      mk.bindPopup(() => (mk._ids.length > 1 ? contenuPopupGroupeGps(mk._ids) : contenuPopupGps(mk._ids[0])), { maxHeight: 340 });
      // permanent : toujours visible. interactive : un clic sur la bulle ouvre la fenêtre du
      // repère, comme un clic sur le point.
      mk.bindTooltip(() => (mk._ids.length > 1 ? contenuInfobulleGroupeGps(mk._ids) : contenuInfobulleGps(mk._ids[0])), {
        permanent: true, interactive: true, direction: 'top', offset: [0, -14], opacity: 1, className: 'tele-infobulle',
      });
      // La fenêtre du clic contient déjà la photo et le nom : la bulle s'efface pendant qu'elle
      // est ouverte (sinon elle serait cachée derrière) et revient à sa fermeture.
      mk.on('popupopen', () => {
        mk.closeTooltip();
        // Une seule machine : son trajet s'affiche TOUT SEUL à l'ouverture (24 h par défaut, ou la période déjà
        // choisie). Un groupe : à chacune ses boutons, on ne devine pas laquelle l'utilisateur veut voir.
        if (mk._ids.length === 1) {
          const choisi = etatCarteGps.trajet && etatCarteGps.trajet.machineId === mk._ids[0] ? etatCarteGps.trajet.jours : 1;
          afficherTrajetGps(mk._ids[0], choisi);
        }
      });
      mk.on('popupclose', () => mk.openTooltip());
      couchesGps.marqueurs.set(idMarqueur, mk);
    }
  });
  couchesGps.marqueurs.forEach((mk, id) => {
    if (!vus.has(id)) { carteGps.removeLayer(mk); couchesGps.marqueurs.delete(id); }
  });

  const compte = document.getElementById('tele-carte-compte');
  if (compte) compte.textContent = tR('{n} machine(s) localisée(s)', { n: points.length });
  if (!etatCarteGps.trajet) {
    messageCarteGps(points.length ? '' : trad('Aucune machine localisée pour l\'instant : relie une machine à un boîtier puis coche « Localiser » dans le tableau ci-dessous.'));
  }
  if (ajuster) {
    if (etatCarteGps.manuel && etatCarteGps.centre) carteGps.setView(etatCarteGps.centre, etatCarteGps.zoom);
    else if (points.length === 1) carteGps.setView(points[0], 14);
    else if (points.length > 1) carteGps.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    else carteGps.setView([20, 0], 2);
  }
}

function effacerTrajetGps(oublier) {
  if (couchesGps.trajet && carteGps) { try { carteGps.removeLayer(couchesGps.trajet); } catch (err) { /* déjà retiré */ } }
  couchesGps.trajet = null;
  if (oublier !== false) etatCarteGps.trajet = null;
}

async function afficherTrajetGps(machineId, jours, options) {
  if (!carteGpsVivante()) return;
  const cadrer = !options || options.cadrer !== false;
  const L = window.L;
  const m = (UI.machines || []).find((x) => x.id === machineId);
  effacerTrajetGps(false);
  etatCarteGps.trajet = { machineId, jours };
  messageCarteGps(trad('Chargement du trajet…'));
  document.querySelectorAll('.tele-popup-actions button[data-jours]').forEach((b) => {
    b.classList.toggle('is-actif', Number(b.getAttribute('data-jours')) === jours);
  });
  const depuis = new Date(Date.now() - jours * 86400000).toISOString();
  // Les 2 000 points les PLUS RÉCENTS de la période (tri décroissant puis retournement) :
  // sur 60 jours l'historique peut dépasser cette limite, et ce sont les derniers
  // déplacements qui comptent.
  const { data, error } = await sb.from('telemetry_positions')
    .select('lat, lon, recorded_at').eq('machine_id', machineId).gte('recorded_at', depuis)
    .order('recorded_at', { ascending: false }).limit(2000);
  if (!carteGpsVivante() || !etatCarteGps.trajet || etatCarteGps.trajet.machineId !== machineId || etatCarteGps.trajet.jours !== jours) return;
  if (error) { etatCarteGps.trajet = null; messageCarteGps(tR('Trajet indisponible : {erreur}', { erreur: String((error && error.message) || error) }), true); return; }
  const pts = (data || []).reverse().map((p) => [Number(p.lat), Number(p.lon)]);
  if (pts.length < 2) { etatCarteGps.trajet = null; messageCarteGps(trad('Aucun trajet enregistré sur cette période.')); return; }
  couchesGps.trajet = L.layerGroup([
    L.polyline(pts, { color: '#6366F1', weight: 4, opacity: 0.85 }),
    L.circleMarker(pts[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#24B5A8', fillOpacity: 1 }),
    L.circleMarker(pts[pts.length - 1], { radius: 6, color: '#fff', weight: 2, fillColor: '#DE7A16', fillOpacity: 1 }),
  ]).addTo(carteGps);
  // La fenêtre reste ouverte : elle porte les boutons de période. Le recadrage, lui, n'a lieu
  // que sur un choix explicite de période.
  if (cadrer) carteGps.fitBounds(pts, { paddingTopLeft: [40, 190], paddingBottomRight: [40, 40] });
  const msg = messageCarteGps(tR('Trajet de {machine} sur {periode} : {n} points.', {
    machine: m ? m.name : '', periode: jours === 1 ? trad('24 h') : tR('{n} jours', { n: jours }), n: pts.length,
  }));
  if (msg) {
    const effacer = document.createElement('button');
    effacer.type = 'button';
    effacer.className = 'ui-btn ui-btn-teinte';
    effacer.textContent = ' ' + trad('Effacer le trajet');
    effacer.addEventListener('click', () => { effacerTrajetGps(); majMarqueursGps(); });
    msg.appendChild(effacer);
  }
}

async function preparerCarteGps(racine) {
  const zone = racine.querySelector('#tele-carte-zone');
  if (!zone) return;
  detruireCarteGps();
  let L;
  try { L = await chargerLeaflet(); }
  catch (err) { messageCarteGps(trad('La carte ne peut pas se charger (hors connexion ?). Les compteurs restent à jour.'), true); return; }
  if (!document.body.contains(zone)) return; // l'écran a changé pendant le chargement
  carteGps = L.map(zone, { worldCopyJump: true });
  L.tileLayer(URL_TUILES, { maxZoom: 19, attribution: ATTRIBUTION_TUILES }).addTo(carteGps);
  const geste = () => { etatCarteGps.manuel = true; };
  zone.addEventListener('pointerdown', geste);
  // La molette fait défiler la PAGE, pas la carte : sinon on ne peut plus descendre dès que la souris passe
  // dessus. Ctrl (ou Cmd, ou le pincement d'un pavé tactile) + molette zoome la carte ; un petit message le dit.
  const indice = document.createElement('div');
  indice.className = 'tele-carte-indice';
  indice.textContent = trad('Ctrl + molette pour zoomer la carte');
  zone.appendChild(indice);
  let minuteurIndice = null;
  zone.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) { geste(); return; }
    if (e.target.closest && e.target.closest('.leaflet-popup, .leaflet-tooltip')) return; // la fenêtre d'un groupe défile elle-même
    e.stopImmediatePropagation();
    indice.classList.add('is-visible');
    clearTimeout(minuteurIndice);
    minuteurIndice = setTimeout(() => indice.classList.remove('is-visible'), 1300);
  }, { capture: true, passive: true });
  carteGps.on('moveend', () => {
    if (!etatCarteGps.manuel) return;
    const c = carteGps.getCenter();
    etatCarteGps.centre = [c.lat, c.lng];
    etatCarteGps.zoom = carteGps.getZoom();
  });
  majMarqueursGps(true);
  if (etatCarteGps.trajet) afficherTrajetGps(etatCarteGps.trajet.machineId, etatCarteGps.trajet.jours);
}

function telemetrieCarteHtml() {
  if (!telemetrieActif() || UI.role !== 'gerant') return '';
  return `
      <!-- ── TÉLÉMÉTRIE ───────────────────────────────────────────────
           Sources de relevés automatiques + liaison machine ↔ boîtier. Le jeton
           d'une source n'est montré qu'UNE fois (le serveur n'en garde que
           l'empreinte). L'écriture des relevés passe par la fonction serveur,
           jamais par cet écran. -->
      <div class="ui-colonnes" id="acc-telemetrie">
        <div class="ui-colonne">
          <section class="ui-section">
            ${teteSectionKit('compteur', trad('Compteur automatique (télémétrie)'), '', '<span class="ui-tag" id="acc-tele-compte"></span>')}
            <div class="ui-section-corps">
              <p class="ui-aide">${trad('Un boîtier, un système tiers ou le compte de ton constructeur fournit les heures ou les kilomètres de tes engins : le compteur, les échéances et les rappels se mettent à jour tout seuls. Ton abonnement donne la connexion et le suivi dans KALEA ; le matériel et son installation (boîtiers, cartes SIM, pose) restent à ta charge, ou font l\'objet d\'un devis de KALEA. C\'est optionnel — la saisie manuelle reste possible partout.')}</p>
              <div class="ui-aide" id="acc-tele-msg" role="status" aria-live="polite"></div>
              <div id="acc-tele-liste" class="ui-liste">${trad('Chargement…')}</div>
              <div id="acc-tele-jeton"></div>
              <div class="ui-groupe tele-creation">
                <span class="ui-etiquette">${trad('Nouvelle source')}</span>
                <div class="ui-grille">
                  <input id="acc-tele-nom" class="ui-champ" maxlength="80" placeholder="${esc(trad('Ex. : Boîtiers atelier'))}">
                  <div class="ui-select-wrap">
                    <select id="acc-tele-type" class="ui-champ" aria-label="${esc(trad('Type de source'))}">
                      <option value="flespi">${trad('Boîtiers via Flespi')}</option>
                      <option value="api">${trad('Autre système (API)')}</option>
                      <option value="aemp">${trad('Compte constructeur (ISO 15143-3)')}</option>
                    </select>
                    ${picto('chevronBas')}
                  </div>
                </div>
                <div class="ui-section-corps" id="acc-tele-aemp" hidden>
                  <p class="ui-aide">${trad('KALEA lit les heures moteur de tes machines directement chez leur constructeur (Caterpillar, Volvo CE, John Deere…), avec les identifiants API que ton constructeur te fournit. Ils sont chiffrés et ne sont jamais réaffichés.')}</p>
                  <div class="ui-champ-groupe">
                    <label class="ui-etiquette" for="acc-tele-aemp-url">${trad('Adresse de l\'API du constructeur')}</label>
                    <input id="acc-tele-aemp-url" class="ui-champ" type="url" maxlength="300" placeholder="https://" autocomplete="off">
                  </div>
                  <div class="ui-champ-groupe">
                    <label class="ui-etiquette" for="acc-tele-aemp-auth">${trad('Mode de connexion')}</label>
                    <div class="ui-select-wrap">
                      <select id="acc-tele-aemp-auth" class="ui-champ">
                        <option value="basic">${trad('Identifiant + secret (Basic)')}</option>
                        <option value="oauth2">${trad('OAuth2 (identifiant + secret)')}</option>
                        <option value="bearer">${trad('Jeton d\'accès')}</option>
                      </select>
                      ${picto('chevronBas')}
                    </div>
                  </div>
                  <div class="ui-champ-groupe" data-aemp-champ="oauth2" hidden>
                    <label class="ui-etiquette" for="acc-tele-aemp-token-url">${trad('Adresse de connexion OAuth2')}</label>
                    <input id="acc-tele-aemp-token-url" class="ui-champ" type="url" maxlength="300" placeholder="https://" autocomplete="off">
                  </div>
                  <div class="ui-grille" data-aemp-champ="basic oauth2">
                    <div class="ui-champ-groupe">
                      <label class="ui-etiquette" for="acc-tele-aemp-id">${trad('Identifiant')}</label>
                      <input id="acc-tele-aemp-id" class="ui-champ" maxlength="500" autocomplete="off">
                    </div>
                    <div class="ui-champ-groupe">
                      <label class="ui-etiquette" for="acc-tele-aemp-secret">${trad('Secret')}</label>
                      <input id="acc-tele-aemp-secret" class="ui-champ" type="password" maxlength="500" autocomplete="new-password">
                    </div>
                  </div>
                  <div class="ui-champ-groupe" data-aemp-champ="bearer" hidden>
                    <label class="ui-etiquette" for="acc-tele-aemp-jeton">${trad('Jeton d\'accès')}</label>
                    <input id="acc-tele-aemp-jeton" class="ui-champ" type="password" maxlength="2000" autocomplete="new-password">
                  </div>
                </div>
                <div><button type="button" class="ui-btn ui-btn-plein" data-tele-creer>${trad('Créer la source')}</button></div>
              </div>
            </div>
          </section>
        </div>
        <div class="ui-colonne">
          <section class="ui-section">
            ${teteSectionKit('boite', trad('Machines reliées'), trad('Choisis la source et l\'identifiant du boîtier (IMEI, VIN…) pour chaque machine à suivre automatiquement. Sans source, la machine reste en saisie manuelle.'))}
            <div class="ui-section-corps">
              <div id="acc-tele-machines" class="ui-liste"></div>
            </div>
          </section>
        </div>
      </div>`;
}

async function preparerCarteTelemetrie(racine) {
  const carte = racine.querySelector('#acc-telemetrie');
  if (!carte) return;
  const msg = carte.querySelector('#acc-tele-msg');
  const zoneListe = carte.querySelector('#acc-tele-liste');
  const zoneJeton = carte.querySelector('#acc-tele-jeton');
  const zoneMachines = carte.querySelector('#acc-tele-machines');
  const pastille = carte.querySelector('#acc-tele-compte');
  const dire = (texte, estErreur) => {
    msg.textContent = texte || '';
    msg.className = estErreur ? 'ui-aide is-late' : 'ui-aide';
  };
  const adresse = `${SUPABASE_URL}/functions/v1/telemetrie-ingest`;
  let sources = [];

  function dessiner() {
    pastille.textContent = tR('{n} source(s)', { n: sources.length });
    zoneListe.innerHTML = sources.length ? sources.map((s) => {
      const constructeur = s.kind === 'aemp';
      const detail = constructeur
        ? `${trad('Compte constructeur')} · ${s.last_poll_at ? tR('dernière relève {quand}', { quand: ilYaSupport(s.last_poll_at) }) : trad('pas encore relevé')}`
        : `${s.kind === 'flespi' ? trad('Boîtiers via Flespi') : trad('Autre système (API)')} · ${trad('jeton')} …${esc(s.token_hint)} · ${s.last_seen_at ? tR('dernier signal {quand}', { quand: ilYaSupport(s.last_seen_at) }) : trad('aucun signal reçu')}`;
      return `
      <div class="ui-ligne is-deux" data-source="${esc(s.id)}">
        <div class="ui-ligne-id"><div class="ui-ligne-textes">
          <span class="ui-ligne-nom">${esc(s.label)}</span>
          <span class="ui-ligne-sous">${detail}</span>
          ${constructeur && s.last_error ? `<span class="ui-ligne-sous is-late">${esc(tR('Dernière erreur : {erreur}', { erreur: s.last_error }))}</span>` : ''}
        </div></div>
        <div class="ui-ligne-action is-etiquettes">
          ${constructeur ? `<button type="button" class="ui-btn ui-btn-teinte" data-tele-tester="${esc(s.id)}">${trad('Tester')}</button>
          <button type="button" class="ui-btn ui-btn-teinte" data-tele-relier="${esc(s.id)}">${trad('Relier mes machines')}</button>` : ''}
          <button type="button" class="ui-btn ui-btn-teinte is-danger" data-tele-revoquer="${esc(s.id)}">${trad('Révoquer')}</button>
        </div>
      </div>`;
    }).join('') : `<p class="ui-aide">${trad('Aucune source pour le moment. Crée-en une pour recevoir des relevés.')}</p>`;

    const options = (choisie) => `<option value="">${trad('Saisie manuelle')}</option>` +
      sources.map((s) => `<option value="${esc(s.id)}"${s.id === choisie ? ' selected' : ''}>${esc(s.label)}</option>`).join('');
    zoneMachines.innerHTML = (UI.machines || []).length ? UI.machines.map((m) => `
      <div class="ui-ligne" data-machine="${esc(m.id)}">
        <div class="ui-ligne-id"><div class="ui-ligne-textes">
        <span class="ui-ligne-nom">${esc(m.name)}</span>
          <span class="ui-ligne-sous">${m.counter_source === 'telemetry' ? (m.telemetry_last_at ? tR('Dernier relevé automatique : {quand}', { quand: ilYaSupport(m.telemetry_last_at) }) : trad('En attente du premier relevé')) : trad('Saisie manuelle')}</span>
          ${SCHEMA.hasGps ? `<label class="ui-case"${m.counter_source === 'telemetry' ? '' : ` title="${esc(trad('Relie d\'abord la machine à un boîtier.'))}"`}>
            <input type="checkbox" data-tele-localiser${m.position_enabled ? ' checked' : ''}${m.counter_source === 'telemetry' ? '' : ' disabled'}>
            <span>${trad('Localiser')}</span>${m.position_enabled && m.last_position_at ? ` <span class="tele-sous">· ${esc(tR('position {quand}', { quand: ilYaSupport(m.last_position_at) }))}</span>` : ''}
          </label>` : ''}
        </div></div>
        <div class="ui-ligne-info is-champs"><div class="ui-select-wrap"><select class="ui-champ" data-tele-source aria-label="${esc(tR('Source de {machine}', { machine: m.name }))}"${sources.length ? '' : ' disabled'}>${options(m.telemetry_source_id)}</select>${picto('chevronBas')}</div>
        <input class="ui-champ" data-tele-ref maxlength="64" value="${esc(m.telemetry_ref || '')}" placeholder="${esc(trad('Identifiant du boîtier'))}" aria-label="${esc(tR('Identifiant du boîtier de {machine}', { machine: m.name }))}"${sources.length ? '' : ' disabled'}></div>
        <div class="ui-ligne-action"><button type="button" class="ui-btn ui-btn-teinte" data-tele-enregistrer${sources.length ? '' : ' disabled'}>${trad('Enregistrer')}</button></div>
      </div>`).join('') : `<p class="ui-aide">${trad('Aucune machine.')}</p>`;
  }

  async function charger() {
    const { data, error } = await sb.from('telemetry_sources')
      .select('id, kind, label, token_hint, created_at, last_seen_at, last_poll_at, last_error').order('created_at');
    if (error) {
      dire(tR('Impossible de charger les sources : {erreur}', { erreur: String((error && error.message) || error) }), true);
      zoneListe.innerHTML = '';
      return;
    }
    sources = data || [];
    dessiner();
  }

  function afficherJeton(jeton, type) {
    const consigne = type === 'flespi'
      ? trad('Dans Flespi, crée un « HTTP stream » vers l\'adresse ci-dessous, avec l\'en-tête personnalisé x-kalea-token. L\'identifiant de la machine est l\'« ident » du boîtier (souvent son IMEI).')
      : trad('Envoie une requête POST en JSON à l\'adresse ci-dessous, avec l\'en-tête x-kalea-token. Chaque relevé : ref (identifiant du boîtier), counter (valeur), unit (hours ou km), at (date ISO).');
    zoneJeton.innerHTML = `
      <div class="ui-groupe" role="status">
        <strong>${trad('Copie ce jeton maintenant : il ne sera plus jamais affiché.')}</strong>
        <p class="ui-aide">${consigne}</p>
        <div class="ui-champ-groupe"><span class="ui-etiquette">${trad('Adresse')}</span><code class="ui-code">${esc(adresse)}</code>
          <div><button type="button" class="ui-btn ui-btn-teinte" data-tele-copier="${esc(adresse)}">${trad('Copier')}</button></div></div>
        <div class="ui-champ-groupe"><span class="ui-etiquette">x-kalea-token</span><code class="ui-code">${esc(jeton)}</code>
          <div><button type="button" class="ui-btn ui-btn-teinte" data-tele-copier="${esc(jeton)}">${trad('Copier')}</button></div></div>
      </div>`;
  }

  // Appel de la fonction serveur (compte constructeur). Une erreur HTTP porte son
  // message utile dans le corps de la réponse : on le lit plutôt que d'afficher un
  // laconique « Edge Function returned a non-2xx status code ».
  async function appelerTelemetrie(corps) {
    const { data, error } = await sb.functions.invoke('telemetrie-ingest', { body: corps });
    if (error) {
      let detail = '';
      try { const j = await error.context.json(); detail = (j && (j.erreur || j.error)) || ''; } catch (e) { /* corps illisible */ }
      throw new Error(detail || String((error && error.message) || error));
    }
    return data;
  }

  // Les champs du formulaire constructeur suivent le type de source et le mode de connexion.
  function majFormulaire() {
    const constructeur = carte.querySelector('#acc-tele-type').value === 'aemp';
    carte.querySelector('#acc-tele-aemp').hidden = !constructeur;
    const mode = carte.querySelector('#acc-tele-aemp-auth').value;
    carte.querySelectorAll('[data-aemp-champ]').forEach((bloc) => {
      bloc.hidden = !bloc.getAttribute('data-aemp-champ').split(' ').includes(mode);
    });
  }
  // Case « Localiser » : passe par une fonction serveur, car décocher doit SUPPRIMER la dernière
  // position et tout l'historique de la machine (le client n'a aucun droit d'effacement).
  async function basculerLocalisation(caseEl) {
    const ligne = caseEl.closest('[data-machine]');
    const machine = ligne && (UI.machines || []).find((x) => x.id === ligne.getAttribute('data-machine'));
    if (!machine) return;
    const actif = caseEl.checked;
    if (!actif && !window.confirm(trad('Désactiver la localisation ? La dernière position et tout l\'historique de trajets de cette machine seront supprimés.'))) {
      caseEl.checked = true;
      return;
    }
    caseEl.disabled = true;
    try {
      const { error } = await sb.rpc('definir_localisation_machine', { p_machine: machine.id, p_actif: actif });
      if (error) throw error;
      machine.position_enabled = actif;
      if (!actif) Object.assign(machine, { last_lat: null, last_lon: null, last_position_at: null });
      if (!actif && etatCarteGps.trajet && etatCarteGps.trajet.machineId === machine.id) effacerTrajetGps();
      dire(actif
        ? tR('{machine} sera localisée dès le prochain relevé de position.', { machine: machine.name })
        : tR('Localisation de {machine} désactivée : positions supprimées.', { machine: machine.name }));
      majMarqueursGps();
    } catch (err) {
      caseEl.checked = !actif;
      dire(tR('Enregistrement impossible : {erreur}', { erreur: String((err && err.message) || err) }), true);
    } finally { caseEl.disabled = false; }
  }
  carte.addEventListener('change', (ev) => {
    if (ev.target.id === 'acc-tele-type' || ev.target.id === 'acc-tele-aemp-auth') majFormulaire();
    if (ev.target.hasAttribute && ev.target.hasAttribute('data-tele-localiser')) basculerLocalisation(ev.target);
  });

  async function creerCompteConstructeur(nom, bouton) {
    const val = (sel) => (carte.querySelector(sel).value || '').trim();
    dire(trad('Connexion au constructeur…'));
    try {
      const r = await appelerTelemetrie({
        action: 'aemp_enregistrer', label: nom, base_url: val('#acc-tele-aemp-url'), auth: val('#acc-tele-aemp-auth'),
        token_url: val('#acc-tele-aemp-token-url'), client_id: val('#acc-tele-aemp-id'),
        client_secret: carte.querySelector('#acc-tele-aemp-secret').value, token: carte.querySelector('#acc-tele-aemp-jeton').value,
      });
      if (!r || !r.ok) { dire(tR('Connexion impossible : {erreur}', { erreur: (r && r.erreur) || trad('Réponse inattendue du serveur.') }), true); return; }
      ['#acc-tele-nom', '#acc-tele-aemp-id', '#acc-tele-aemp-secret', '#acc-tele-aemp-jeton'].forEach((sel) => { carte.querySelector(sel).value = ''; });
      zoneJeton.innerHTML = `
        <div class="ui-groupe" role="status">
          <strong>${tR('Connexion réussie : {n} machine(s) trouvée(s) chez le constructeur.', { n: r.total })}</strong>
          <p class="ui-aide">${trad('Étape suivante : « Relier mes machines » rapproche tes machines KALEA de celles du constructeur par numéro de série. Le compteur de chaque machine reconnue sera remplacé par celui du constructeur.')}</p>
        </div>`;
      dire('');
      await charger();
    } catch (err) {
      dire(tR('Création impossible : {erreur}', { erreur: String((err && err.message) || err) }), true);
    } finally { bouton.disabled = false; }
  }

  // Relit les liaisons des machines après « Relier mes machines » (faites côté serveur).
  async function relireLiaisons() {
    const { data } = await sb.from('machines')
      .select('id, counter_value, counter_source, telemetry_source_id, telemetry_ref, telemetry_last_at')
      .eq('company_id', UI.companyId);
    (data || []).forEach((ligne) => {
      const m = (UI.machines || []).find((x) => x.id === ligne.id);
      if (m) Object.assign(m, ligne);
    });
  }

  carte.addEventListener('click', async (ev) => {
    const cible = ev.target.closest('button');
    if (!cible || !carte.contains(cible)) return;

    if (cible.hasAttribute('data-tele-tester')) {
      cible.disabled = true;
      dire(trad('Connexion au constructeur…'));
      try {
        const r = await appelerTelemetrie({ action: 'aemp_tester', source_id: cible.getAttribute('data-tele-tester') });
        dire(r && r.ok ? tR('Connexion réussie : {n} machine(s) trouvée(s) chez le constructeur.', { n: r.total })
          : tR('Connexion impossible : {erreur}', { erreur: (r && r.erreur) || trad('Réponse inattendue du serveur.') }), !(r && r.ok));
      } catch (err) {
        dire(tR('Connexion impossible : {erreur}', { erreur: String((err && err.message) || err) }), true);
      } finally { cible.disabled = false; }
      return;
    }

    if (cible.hasAttribute('data-tele-relier')) {
      if (!window.confirm(trad('Relier tes machines à ce compte ? Chaque machine dont le numéro de série correspond verra son compteur remplacé par celui du constructeur.'))) return;
      cible.disabled = true;
      dire(trad('Connexion au constructeur…'));
      try {
        const r = await appelerTelemetrie({ action: 'aemp_relier', source_id: cible.getAttribute('data-tele-relier') });
        if (!r || !r.ok) { dire(tR('Connexion impossible : {erreur}', { erreur: (r && r.erreur) || trad('Réponse inattendue du serveur.') }), true); return; }
        await relireLiaisons();
        dessiner();
        dire(r.relies.length
          ? tR('{n} machine(s) reliée(s) : {noms}', { n: r.relies.length, noms: r.relies.join(', ') })
          : trad('Aucune machine reconnue : le numéro de série de tes machines doit être identique à celui du constructeur (fiche machine).'), !r.relies.length);
      } catch (err) {
        dire(tR('Connexion impossible : {erreur}', { erreur: String((err && err.message) || err) }), true);
      } finally { cible.disabled = false; }
      return;
    }

    if (cible.hasAttribute('data-tele-copier')) {
      try {
        await navigator.clipboard.writeText(cible.getAttribute('data-tele-copier'));
        cible.textContent = trad('Copié');
      } catch (err) { dire(trad('Copie impossible : sélectionne le texte à la main.'), true); }
      return;
    }

    if (cible.hasAttribute('data-tele-creer')) {
      const champ = carte.querySelector('#acc-tele-nom');
      const type = carte.querySelector('#acc-tele-type').value;
      const nom = (champ.value || '').trim();
      if (!nom) { dire(trad('Donne un nom à la source.'), true); champ.focus(); return; }
      cible.disabled = true;
      dire('');
      if (type === 'aemp') { await creerCompteConstructeur(nom, cible); return; }
      try {
        const { data, error } = await sb.rpc('creer_source_telemetrie', { p_label: nom, p_kind: type });
        if (error) throw error;
        const ligne = Array.isArray(data) ? data[0] : data;
        if (!ligne || !ligne.token) throw new Error(trad('Réponse inattendue du serveur.'));
        champ.value = '';
        afficherJeton(ligne.token, type);
        await charger();
      } catch (err) {
        dire(tR('Création impossible : {erreur}', { erreur: String((err && err.message) || err) }), true);
      } finally { cible.disabled = false; }
      return;
    }

    if (cible.hasAttribute('data-tele-revoquer')) {
      const id = cible.getAttribute('data-tele-revoquer');
      if (!window.confirm(trad('Révoquer cette source ? Les machines reliées repasseront en saisie manuelle et le boîtier ne pourra plus envoyer de relevés.'))) return;
      cible.disabled = true;
      try {
        const { error } = await sb.rpc('revoquer_source_telemetrie', { p_id: id });
        if (error) throw error;
        (UI.machines || []).forEach((m) => {
          if (m.telemetry_source_id === id) Object.assign(m, { telemetry_source_id: null, telemetry_ref: null, counter_source: 'manual', telemetry_last_at: null });
        });
        zoneJeton.innerHTML = '';
        dire(trad('Source révoquée.'));
        await charger();
      } catch (err) {
        dire(tR('Révocation impossible : {erreur}', { erreur: String((err && err.message) || err) }), true);
        cible.disabled = false;
      }
      return;
    }

    if (cible.hasAttribute('data-tele-enregistrer')) {
      const ligne = cible.closest('[data-machine]');
      const machine = (UI.machines || []).find((m) => m.id === ligne.getAttribute('data-machine'));
      if (!machine) return;
      const source = ligne.querySelector('[data-tele-source]').value || null;
      const ref = (ligne.querySelector('[data-tele-ref]').value || '').trim() || null;
      if (source && !ref) { dire(trad('Indique l\'identifiant du boîtier de cette machine.'), true); return; }
      const auto = !!(source && ref);
      // Un changement de boîtier repart de zéro : l'ancien décalage et l'ancien
      // dernier signal ne valent plus rien pour le nouveau.
      const patch = {
        telemetry_source_id: auto ? source : null,
        telemetry_ref: auto ? ref : null,
        counter_source: auto ? 'telemetry' : 'manual',
        telemetry_offset: null,
        telemetry_last_at: null,
      };
      cible.disabled = true;
      try {
        const { error } = await sb.from('machines').update(patch).eq('id', machine.id);
        if (error) throw error;
        Object.assign(machine, patch);
        dire(auto ? tR('{machine} sera mise à jour automatiquement.', { machine: machine.name }) : tR('{machine} repasse en saisie manuelle.', { machine: machine.name }));
        dessiner();
      } catch (err) {
        dire((err && err.code === '23505')
          ? trad('Cet identifiant est déjà relié à une autre machine.')
          : tR('Enregistrement impossible : {erreur}', { erreur: String((err && err.message) || err) }), true);
        cible.disabled = false;
      }
    }
  });

  dessiner();
  await charger();
}

// Stock & SAV : réservé au palier Enterprise UNIQUEMENT (demande explicite
// de l'utilisateur — contrairement aux QR codes ci-dessus, pas de palier
// intermédiaire). `offreDeLaGrille()` gère déjà le grandfathering
// (`paid`/`unlimited` → 'enterprise', voir OFFRES_HISTORIQUES) — même
// fonction que celle qui décide de l'écran des offres, aucune chance de
// diverger.
function planCouvreStock() {
  return offreDeLaGrille(UI.companyPlan || 'free').cle === 'enterprise';
}

// Rôles autorisés sur le module Stock (décidé avec l'utilisateur) : les
// mouvements du quotidien (entrée/sortie/transfert) sont ouverts au
// mécanicien — cohérent avec `peut_ecrire()` côté serveur (RLS/RPC), qui
// vaut exactement gérant+mécanicien. Les magasins, l'ajustement d'inventaire
// et la valorisation financière (PUMP, valeur du stock) restent réservés au
// gérant — ces fonctions ne sont qu'un REFLET côté client : la vraie
// barrière est côté serveur (RPC enregistrer_mouvement_stock + RLS), comme
// peutSupprimerMachine()/peutGererEquipe() ailleurs dans ce fichier.
function peutGererMouvementsStock() {
  return UI.role === 'gerant' || UI.role === 'mecanicien';
}
function peutGererParametresStock() {
  return UI.role === 'gerant';
}

// La ligne affichée pour une offre payante : son nom puis son parc. Le prix est
// lu dans la grille ci-dessus, jamais réécrit ici.
function ligneOffrePayante(cle) {
  const o = offreDeLaGrille(cle);
  return `${o.offre} — ${o.prix}, ${o.machines} suivie${o.cle === 'free' ? '' : 's'}`;
}

// Ce que la fenêtre des offres affiche. Les libellés sont EXACTEMENT ceux de la
// rubrique « Mon compte » : une grille tarifaire qui change de vocabulaire d'un
// écran à l'autre ne se comprend plus. `changement` sert au client DÉJÀ abonné :
// il ne doit jamais souscrire une seconde fois.
const OFFRES_PAYANTES = [
  {
    cle: 'eco',
    ligne: ligneOffrePayante('eco'),
    bouton: 'Passer à Starter',
    changement: "Pour passer à l'offre Starter, change d'offre depuis ton abonnement : le montant est ajusté au prorata.",
  },
  {
    cle: 'pro',
    ligne: ligneOffrePayante('pro'),
    bouton: 'Passer à Business',
    changement: "Pour passer à l'offre Business, change d'offre depuis ton abonnement : le montant est ajusté au prorata.",
  },
  {
    cle: 'paid',
    ligne: ligneOffrePayante('paid'),
    bouton: 'Passer à Enterprise',
    changement: "Pour passer à l'offre Enterprise, change d'offre depuis ton abonnement : le montant est ajusté au prorata.",
  },
];

// Ce qu'un e-mail de contact doit contenir pour être utile : quelle offre, ce
// qu'elle coûte, ce qu'elle comprend. Le corps est PRÉ-REMPLI : le client n'a
// plus qu'à l'envoyer, et nous n'avons pas à lui redemander son contexte.
function corpsContactOffre(offre, companyId) {
  return [
    trad('Bonjour, je souhaite des informations sur cette offre.'),
    '',
    trad('Offre :') + ' ' + trad(offre.offre) + ' — ' + trad(offre.prix),
    trad('Parc et utilisateurs :') + ' ' + trad(offre.machines) + ', ' + trad(offre.utilisateurs),
    trad('Compris :') + ' ' + trad(offre.analyses) + ', ' + trad(offre.lectures),
    '',
    trad('Société :') + ' ' + (companyId || '—'),
  ].join('\n');
}

// L'adresse de contact d'une offre SANS lien de paiement (Enterprise). On ne
// fabrique aucune adresse Stripe : un mailto, et rien qui parte ailleurs.
function contactEnterprise(companyId) {
  const offre = offreDeLaGrille('enterprise');
  const sujet = trad('Offre') + ' ' + trad(offre.offre) + ' — ' + trad('demande d\'informations');
  return 'mailto:support@kalea.pro?subject=' + encodeURIComponent(sujet)
    + '&body=' + encodeURIComponent(corpsContactOffre(offre, companyId));
}

// Une INSTITUTION (mairie, province…) ne paie pas par carte : elle demande la facturation mensuelle sur facture. La demande
// part par e-mail pré-rempli ; l'offre est ensuite activée par nos soins.
function estInstitution() {
  return !!(UI.company && UI.company.structure_type === 'institution');
}
function contactFacturationInstitution(offre, companyId) {
  const sujet = trad('Facturation mensuelle sur facture') + ' — ' + trad('Offre') + ' ' + trad(offre.offre);
  const corps = [
    trad('Bonjour, nous sommes une institution et souhaitons être facturés chaque mois sur facture pour cette offre.'),
    '',
    trad('Offre :') + ' ' + trad(offre.offre) + ' — ' + trad(offre.prix),
    trad('Parc et utilisateurs :') + ' ' + trad(offre.machines) + ', ' + trad(offre.utilisateurs),
    '',
    trad('Nom de la structure :') + ' ' + ((UI.company && UI.company.name) || '—'),
    trad('Société :') + ' ' + (companyId || '—'),
  ].join('\n');
  return 'mailto:support@kalea.pro?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);
}

// La cinquième classe (« Grand compte ») n'a pas de lien de paiement : un e-mail pré-rempli demande un devis.
function contactGrandCompte(companyId) {
  const sujet = trad('Offre Grand compte') + ' — ' + trad('demande de devis');
  const corps = [
    trad('Bonjour, je souhaite un devis pour un parc de plus de 150 machines.'),
    '',
    trad('Nombre de machines (environ) :'),
    trad('Types d\'engins ou de véhicules :'),
    trad('Besoins particuliers (télémétrie, intégrations, accompagnement) :'),
    '',
    trad('Société :') + ' ' + (companyId || '—'),
  ].join('\n');
  return 'mailto:support@kalea.pro?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);
}

// La bande « Grand compte » sous les quatre cartes : même présentation que la bande « Établissement du plan ».
function blocGrandCompteHtml(companyId) {
  return `
    <div class="offre-service">
      <div class="offre-service-icone">${picto('parcMachine')}</div>
      <div class="offre-service-corps">
        <div class="offre-service-titre-ligne">
          <h3>${trad('Grand compte')}</h3>
          <span class="offre-service-prix">${trad('sur devis')}</span>
        </div>
        <p>${trad('Au-delà de 150 machines : tarif dégressif, intégrations sur mesure, accompagnement et contrat annuel. Nous établissons un devis adapté à ton parc.')}</p>
      </div>
      <a href="${contactGrandCompte(companyId)}" class="offre-bouton is-secondaire">${trad('Demander un devis')}${picto('mail')}</a>
    </div>`;
}

// Le tableau « Ce que chaque classe apporte », lu depuis COMPARATIF_OFFRES. La colonne de l'offre actuelle est mise en évidence.
function comparatifOffresHtml(cleActuelle) {
  const noms = { free: trad('Gratuit'), starter: trad('Starter'), business: trad('Business'), enterprise: trad('Enterprise'), grand_compte: trad('Grand compte') };
  const cellule = (v) => {
    if (v === true) return `<span class="coche" aria-label="${esc(trad('Inclus'))}">${picto('coche')}</span>`;
    if (v === false) return `<span class="tiret" aria-label="${esc(trad('Non inclus'))}">—</span>`;
    return esc(v);
  };
  const entete = COMPARATIF_OFFRES.colonnes.map((c) => `<th scope="col"${c === cleActuelle ? ' class="is-actuelle"' : ''}>${esc(noms[c])}</th>`).join('');
  const corps = COMPARATIF_OFFRES.lignes.map((l) => `
        <tr>
          <th scope="row">${esc(l.etiquette)}</th>
          ${l.valeurs.map((v, i) => `<td${COMPARATIF_OFFRES.colonnes[i] === cleActuelle ? ' class="is-actuelle"' : ''}>${cellule(v)}</td>`).join('')}
        </tr>`).join('');
  return `
    <section class="offres-comparatif" aria-labelledby="offres-comparatif-titre">
      <h3 id="offres-comparatif-titre">${trad('Ce que chaque classe apporte')}</h3>
      <div class="offres-comparatif-defile">
        <table class="offres-comparatif-table">
          <thead><tr><th scope="col"><span class="sr-only">${trad('Fonctionnalité')}</span></th>${entete}</tr></thead>
          <tbody>${corps}
          </tbody>
        </table>
      </div>
    </section>`;
}

// Même service, même prix (29 €), même sujet d'e-mail que le bouton de la
// fiche machine (voir « Nous établissons votre plan d'entretien… », plus
// bas dans ce fichier) — mais SANS machine précise en contexte ici (la
// fenêtre des offres n'en porte aucune) : le corps invite à préciser
// laquelle, plutôt que de fabriquer une référence.
function contactPlanEtabli(companyId) {
  const sujet = trad('Établissement d\'un plan d\'entretien (29 €)');
  const corps = [
    trad('Bonjour, je souhaite faire établir le plan d\'entretien d\'une de mes machines (29 €, réglés une fois).'),
    '',
    trad('Machine concernée :') + ' ',
    '',
    trad('Société :') + ' ' + (companyId || '—'),
  ].join('\n');
  return 'mailto:support@kalea.pro?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);
}

// ── Support côté client (tickets) ────────────────────────────────────────
// Remplace le seul contact possible jusqu'ici (un lien mailto:) par un vrai
// fil de discussion, lu et répondu depuis la console superviseur
// (admin.html) — voir support_tickets/support_ticket_messages,
// keeva-redesign-project.md. Redesign : reprise Stitch « stitch_refonte_
// zone_change_ticketing » (voir bloc CSS .support-* / ★ SUPPORT CLIENT).
function ilYaSupport(iso) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return trad('à l\'instant');
  if (diffMin < 60) return tR('il y a {n} min', { n: diffMin });
  const h = Math.round(diffMin / 60);
  if (h < 24) return tR('il y a {n} h', { n: h });
  return tR('il y a {n} j', { n: Math.round(h / 24) });
}
// Même formule que refTicket() côté admin.html — une référence courte et
// lisible à l'oral, jamais l'UUID complet.
function refTicket(id) {
  return '#TK-' + String(id || '').replace(/-/g, '').slice(0, 6).toUpperCase();
}
const LIBELLE_STATUT_TICKET = {
  ouvert: () => trad('Ouvert'),
  en_cours: () => trad('En cours'),
  resolu: () => trad('Résolu'),
};
// Icônes/couleurs de la maquette : violet qui pulse (en_cours), ambre uni
// (ouvert — équivalent de son « En attente »), vert d'eau + coche (résolu).
function statutSupportHtml(status) {
  const libelle = LIBELLE_STATUT_TICKET[status]?.() || status;
  if (status === 'resolu') {
    return `<span class="support-statut is-resolu">${picto('coche')}${esc(libelle)}</span>`;
  }
  return `<span class="support-statut is-${esc(status)}"><span class="dot"></span>${esc(libelle)}</span>`;
}
// Le libellé machine d'un ticket, résolu CÔTÉ CLIENT depuis UI.machines
// (déjà chargé, scopé à la société) — aucune jointure supplémentaire.
function machineDuTicket(machineId) {
  return machineId ? UI.machines.find((m) => m.id === machineId) : null;
}
function libelleMachineCourt(m) {
  if (!m) return '';
  return m.name || [m.brand, m.model].filter(Boolean).join(' ') || '';
}
// Deux initiales à partir d'un nom/identifiant, pour l'avatar d'un message
// d'un·e collègue (pas soi-même, pas le support KALEA) — même esprit que
// initiales() côté admin.html.
function initialesSupport(nom) {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return '?';
  return (mots[0][0] + (mots[1]?.[0] || '')).toUpperCase();
}

async function openSupportModal() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay support-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const { data: sessionCourante } = await sb.auth.getUser();
  const moi = sessionCourante?.user?.id || null;
  await afficherListeTickets(overlay, moi);
}

async function afficherListeTickets(overlay, moi) {
  overlay.innerHTML = `<div class="modal">
    <div class="support-tete">
      <div><h2>${trad('Support')}</h2><p class="sub">${trad('Tes demandes précédentes, et une nouvelle si besoin.')}</p></div>
      <button type="button" class="mform-close" id="support-fermer-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
    </div>
    <div class="support-liste" id="support-liste">${trad('Chargement…')}</div>
    <div class="modal-actions">
      <button type="button" class="primary" id="support-nouveau"><span class="card-ico">${picto('croix')}</span><span>${trad('Nouveau ticket')}</span></button>
      <button type="button" class="secondary" id="support-fermer">${trad('Fermer')}</button>
    </div>
  </div>`;
  overlay.querySelector('#support-fermer').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#support-fermer-x').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#support-nouveau').addEventListener('click', () => afficherNouveauTicket(overlay, moi));

  const { data: tickets, error } = await sb
    .from('support_tickets')
    .select('id, subject, status, machine_id, created_at')
    .eq('company_id', UI.companyId)
    .order('created_at', { ascending: false });
  const zone = overlay.querySelector('#support-liste');
  if (!zone) return;
  if (error) {
    zone.innerHTML = `<div class="hint is-late">${trad('Impossible de charger tes demandes pour le moment.')}</div>`;
    return;
  }
  if (!tickets || !tickets.length) {
    zone.innerHTML = `<div class="ui-aide">${trad('Aucune demande pour l\'instant.')}</div>`;
    return;
  }
  // Dernier message par ticket, en un seul aller-retour (jamais une requête
  // par ticket) — sert de sous-titre réel (« Dernier message il y a… »),
  // avec repli sur la date d'ouverture si le ticket n'a encore aucune
  // réponse (juste créé, un seul message initial pas encore chargé ici).
  const { data: dernierMessages } = await sb
    .from('support_ticket_messages')
    .select('ticket_id, created_at')
    .in('ticket_id', tickets.map((t) => t.id))
    .order('created_at', { ascending: false });
  const dernierParTicket = {};
  (dernierMessages || []).forEach((m) => { if (!dernierParTicket[m.ticket_id]) dernierParTicket[m.ticket_id] = m.created_at; });

  zone.innerHTML = tickets.map((t) => {
    const m = machineDuTicket(t.machine_id);
    const sousTitre = [libelleMachineCourt(m), tR('Dernier message {quand}', { quand: ilYaSupport(dernierParTicket[t.id] || t.created_at) })].filter(Boolean).join(' · ');
    return `<button type="button" class="support-liste-ligne" data-id="${esc(t.id)}">
      <span class="support-liste-corps">
        <span class="support-liste-titre-ligne">
          <span class="support-liste-sujet">${esc(t.subject)}</span>
          <span class="support-liste-ref">${refTicket(t.id)}</span>
        </span>
        <span class="support-liste-sub">${esc(sousTitre)}</span>
      </span>
      ${statutSupportHtml(t.status)}
    </button>`;
  }).join('');
  zone.querySelectorAll('.support-liste-ligne').forEach((btn) => {
    btn.addEventListener('click', () => afficherFilTicket(overlay, moi, btn.dataset.id));
  });
}

// Sous-titre réel d'une machine dans le sélecteur (jamais une donnée
// inventée comme la « Prioritaire »/zone de la maquette) : sa catégorie si
// elle en a une, sinon marque+modèle (si différent du nom déjà affiché en
// titre), sinon sa référence.
function sousTitreMachinePicker(m) {
  if (m.category?.name) return m.category.name;
  const bm = [m.brand, m.model].filter(Boolean).join(' ');
  if (bm && bm !== libelleMachineCourt(m)) return bm;
  return m.plate || (m.serial_number ? tR('Réf : {ref}', { ref: m.serial_number }) : '');
}

// Sélecteur de machine (reprise Stitch, 2e modale « Composant Déployé »),
// déployé PAR-DESSUS la modale « Nouveau ticket » (un second .overlay
// empilé) plutôt qu'en remplacement — ainsi le sujet/message déjà saisis
// ne sont jamais perdus en ouvrant/fermant le sélecteur. `actuelId` : la
// sélection en cours ; `onConfirm(id)` : appelé seulement sur « Confirmer
// la sélection », jamais sur un simple clic dans la liste.
function ouvrirSelecteurMachine(actuelId, onConfirm) {
  const overlay2 = document.createElement('div');
  overlay2.className = 'overlay support-modal';
  document.body.appendChild(overlay2);
  let choisieId = actuelId || null;

  const rendreListe = (filtre) => {
    const f = (filtre || '').trim().toLowerCase();
    const correspond = (m) => !f || [libelleMachineCourt(m), m.brand, m.model, m.serial_number, m.plate].filter(Boolean).some((v) => String(v).toLowerCase().includes(f));
    const machinesFiltrees = UI.machines.filter(correspond);
    const zone = overlay2.querySelector('#support-picker-liste');
    const lignes = [`<button type="button" class="support-picker-ligne${!choisieId ? ' is-choisie' : ''}" data-id="">
        <span class="support-picker-ligne-gauche">
          <span class="support-picker-ico">${picto('aideCercle')}</span>
          <span><span class="support-picker-nom">${trad('Aucune en particulier')}</span><span class="support-picker-sub">${trad('Demande générale ou administrative')}</span></span>
        </span>
        <span class="support-picker-radio"><span class="point"></span></span>
      </button>`];
    // L'option « aucune » reste toujours visible, filtre ou pas — seules
    // les vraies machines sont filtrées par la recherche.
    machinesFiltrees.forEach((m) => {
      lignes.push(`<button type="button" class="support-picker-ligne${choisieId === m.id ? ' is-choisie' : ''}" data-id="${esc(m.id)}">
        <span class="support-picker-ligne-gauche">
          <span class="support-picker-ico">${picto('vehicule')}</span>
          <span><span class="support-picker-nom">${esc(libelleMachineCourt(m) || m.id)}</span>${sousTitreMachinePicker(m) ? `<span class="support-picker-sub">${esc(sousTitreMachinePicker(m))}</span>` : ''}</span>
        </span>
        <span class="support-picker-radio"><span class="point"></span></span>
      </button>`);
    });
    zone.innerHTML = lignes.join('');
    zone.querySelectorAll('.support-picker-ligne').forEach((btn) => {
      btn.addEventListener('click', () => {
        choisieId = btn.dataset.id || null;
        zone.querySelectorAll('.support-picker-ligne').forEach((l) => l.classList.toggle('is-choisie', l === btn));
      });
    });
    const compteur = overlay2.querySelector('#support-picker-compte');
    if (compteur) compteur.textContent = tR('{n} matériel(s) disponible(s)', { n: machinesFiltrees.length });
  };

  overlay2.innerHTML = `<div class="modal">
    <div class="support-tete">
      <div><h2>${trad('Machine concernée')} <span class="support-badge-optionnel">${trad('optionnel')}</span></h2><p class="sub">${trad('Sélectionne un matériel pour assigner la fiche atelier immédiatement.')}</p></div>
      <button type="button" class="mform-close" id="support-picker-fermer-x" aria-label="${esc(trad('Fermer la liste'))}">${picto('fermer')}</button>
    </div>
    <div class="support-picker-recherche">
      <span class="card-ico">${picto('recherche')}</span>
      <input type="text" id="support-picker-recherche" placeholder="${esc(trad('Rechercher par nom, modèle ou immatriculation…'))}">
    </div>
    <div class="support-picker-liste" id="support-picker-liste"></div>
    <div class="support-picker-pied">
      <span class="ui-aide" id="support-picker-compte" style="margin:0;"></span>
      <div class="support-picker-pied-droite">
        <button type="button" class="secondary" id="support-picker-effacer">${trad('Effacer')}</button>
        <button type="button" class="primary" id="support-picker-confirmer">${trad('Confirmer la sélection')}</button>
      </div>
    </div>
  </div>`;
  overlay2.addEventListener('click', (e) => { if (e.target === overlay2) overlay2.remove(); });
  overlay2.querySelector('#support-picker-fermer-x').addEventListener('click', () => overlay2.remove());
  overlay2.querySelector('#support-picker-recherche').addEventListener('input', (e) => rendreListe(e.target.value));
  overlay2.querySelector('#support-picker-effacer').addEventListener('click', () => {
    choisieId = null;
    rendreListe(overlay2.querySelector('#support-picker-recherche').value);
  });
  overlay2.querySelector('#support-picker-confirmer').addEventListener('click', () => {
    onConfirm(choisieId);
    overlay2.remove();
  });
  rendreListe('');
}

function afficherNouveauTicket(overlay, moi) {
  let machineChoisieId = null;
  overlay.innerHTML = `<div class="modal">
    <div class="support-tete">
      <div><h2>${trad('Nouveau ticket')}</h2><p class="sub">${trad('Décris ta demande : nous te répondons ici.')}</p></div>
      <button type="button" class="mform-close" id="support-fermer-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
    </div>
    <div class="plan-field">
      <label for="support-sujet">${trad('Sujet')}</label>
      <input id="support-sujet" required maxlength="140">
    </div>
    ${UI.machines.length ? `<div class="plan-field">
      <div class="support-champ-tete">
        <label for="support-machine-trigger">${trad('Machine concernée')} <span class="muted-text">(${trad('optionnel')})</span></label>
        <span class="support-badge-interactif">${trad('Menu interactif')}</span>
      </div>
      <button type="button" class="support-machine-trigger" id="support-machine-trigger">
        <span class="support-machine-trigger-gauche"><span class="dot"></span><span id="support-machine-trigger-label">${trad('Aucune en particulier')}</span></span>
        <span class="card-ico">${picto('chevronBas')}</span>
      </button>
    </div>` : ''}
    <div class="plan-field">
      <label for="support-message">${trad('Message')}</label>
      <textarea id="support-message" rows="4" required></textarea>
    </div>
    <div class="ui-aide" id="support-nouveau-msg" role="status" aria-live="polite"></div>
    <div class="modal-actions">
      <button type="button" class="primary" id="support-envoyer"><span class="card-ico">${picto('envoyer')}</span><span>${trad('Envoyer')}</span></button>
      <button type="button" class="secondary" id="support-annuler">${trad('Annuler')}</button>
    </div>
  </div>`;
  overlay.querySelector('#support-fermer-x').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#support-annuler').addEventListener('click', () => afficherListeTickets(overlay, moi));
  overlay.querySelector('#support-machine-trigger')?.addEventListener('click', () => {
    ouvrirSelecteurMachine(machineChoisieId, (id) => {
      machineChoisieId = id;
      const m = id ? UI.machines.find((x) => x.id === id) : null;
      overlay.querySelector('#support-machine-trigger-label').textContent = m ? (libelleMachineCourt(m) || m.id) : trad('Aucune en particulier');
    });
  });
  overlay.querySelector('#support-envoyer').addEventListener('click', async () => {
    const sujet = overlay.querySelector('#support-sujet').value.trim();
    const message = overlay.querySelector('#support-message').value.trim();
    const machineId = machineChoisieId || null;
    const annonce = overlay.querySelector('#support-nouveau-msg');
    if (!sujet || !message) {
      annonce.textContent = trad('Le sujet et le message sont nécessaires.');
      annonce.className = 'hint is-late';
      return;
    }
    const bouton = overlay.querySelector('#support-envoyer');
    bouton.disabled = true;
    const { data: ticket, error: erreurTicket } = await sb
      .from('support_tickets')
      .insert({ company_id: UI.companyId, created_by: moi, machine_id: machineId, subject: sujet })
      .select('id').single();
    if (erreurTicket || !ticket) {
      annonce.textContent = trad('L\'envoi a échoué. Réessaie dans un instant.');
      annonce.className = 'hint is-late';
      bouton.disabled = false;
      return;
    }
    const { error: erreurMessage } = await sb
      .from('support_ticket_messages')
      .insert({ ticket_id: ticket.id, author_id: moi, body: message });
    if (erreurMessage) {
      annonce.textContent = trad('Le ticket a été créé, mais le message n\'a pas pu être envoyé. Rouvre-le pour réessayer.');
      annonce.className = 'hint is-late';
      bouton.disabled = false;
      return;
    }
    afficherFilTicket(overlay, moi, ticket.id);
  });
}

async function afficherFilTicket(overlay, moi, ticketId) {
  const { data: ticket } = await sb
    .from('support_tickets')
    .select('id, subject, status, machine_id, created_at')
    .eq('id', ticketId).single();
  const m = machineDuTicket(ticket?.machine_id);
  const sousTitre = [ticket?.subject, libelleMachineCourt(m)].filter(Boolean).join(' · ');

  overlay.innerHTML = `<div class="modal">
    <div class="support-echange-tete">
      <div class="support-echange-tete-gauche">
        <button type="button" class="support-retour-fil" id="support-retour" title="${esc(trad('Retour aux tickets'))}">${picto('flecheGauche')}</button>
        <div>
          <div class="support-echange-titre">
            <h2>${trad('Ticket')}</h2>
            <span class="support-echange-ref">${refTicket(ticketId)}</span>
          </div>
          ${sousTitre ? `<div class="support-echange-sub">${esc(sousTitre)}</div>` : ''}
        </div>
      </div>
      ${ticket ? statutSupportHtml(ticket.status) : ''}
    </div>
    <div class="support-fil" id="support-fil">${trad('Chargement…')}</div>
    <form class="support-compositeur" id="support-form">
      <div class="support-compositeur-label">
        <label for="support-reponse">${trad('Répondre')}</label>
        <span class="support-compositeur-hint">${trad('Entrée pour envoyer, Maj+Entrée pour un saut de ligne')}</span>
      </div>
      <textarea id="support-reponse" rows="2"></textarea>
      <div class="ui-aide" id="support-fil-msg" role="status" aria-live="polite"></div>
      <div class="support-compositeur-actions">
        <button type="button" class="secondary" id="support-retour-bas">${trad('Retour')}</button>
        <button type="submit" class="primary" id="support-repondre"><span>${trad('Envoyer')}</span><span class="card-ico">${picto('envoyer')}</span></button>
      </div>
    </form>
  </div>`;
  overlay.querySelector('#support-retour').addEventListener('click', () => afficherListeTickets(overlay, moi));
  overlay.querySelector('#support-retour-bas').addEventListener('click', () => afficherListeTickets(overlay, moi));

  const { data: messages, error } = await sb
    .from('support_ticket_messages')
    .select('id, body, created_at, author_id, profiles(full_name, login, is_staff)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  const fil = overlay.querySelector('#support-fil');
  if (error || !fil) {
    if (fil) fil.innerHTML = `<div class="hint is-late">${trad('Impossible de charger ce ticket.')}</div>`;
  } else {
    fil.innerHTML = (messages || []).map((m2) => {
      const deMoi = m2.author_id === moi;
      // « Toi » l'emporte TOUJOURS sur « Support KALEA » : un compte staff qui
      // écrit depuis SON PROPRE espace client (cas réel sur ce compte, gérant
      // ET superviseur à la fois) doit se voir lui-même, pas son autre rôle.
      const estStaff = !!m2.profiles?.is_staff;
      const auteur = deMoi ? trad('Toi') : (estStaff ? trad('Support KALEA') : (m2.profiles?.full_name || m2.profiles?.login || '?'));
      const avatar = deMoi ? '' : `<span class="avatar">${estStaff ? 'KV' : esc(initialesSupport(auteur))}</span>`;
      return `<div class="support-bulle-ligne ${deMoi ? 'is-moi' : 'is-autre'}">
        <span class="support-bulle-auteur">${avatar}<span class="nom">${esc(auteur)}</span><span>· ${ilYaSupport(m2.created_at)}</span></span>
        <div class="support-bulle">${esc(m2.body)}</div>
      </div>`;
    }).join('') || `<div class="ui-aide">${trad('Aucun message.')}</div>`;
    fil.scrollTop = fil.scrollHeight;
  }

  const envoyerReponseClient = async () => {
    const champ = overlay.querySelector('#support-reponse');
    const texte = champ.value.trim();
    const annonce = overlay.querySelector('#support-fil-msg');
    if (!texte) return;
    const bouton = overlay.querySelector('#support-repondre');
    bouton.disabled = true;
    const { error: erreurReponse } = await sb
      .from('support_ticket_messages')
      .insert({ ticket_id: ticketId, author_id: moi, body: texte });
    bouton.disabled = false;
    if (erreurReponse) {
      annonce.textContent = trad('L\'envoi a échoué. Réessaie dans un instant.');
      annonce.className = 'hint is-late';
      return;
    }
    afficherFilTicket(overlay, moi, ticketId);
  };
  overlay.querySelector('#support-form').addEventListener('submit', (ev) => { ev.preventDefault(); envoyerReponseClient(); });
  // Entrée envoie, Maj+Entrée passe à la ligne — annoncé sous le champ, donc
  // le comportement réel doit correspondre exactement à ce qui est écrit
  // (même geste que côté admin.html, ouvrirTicket()).
  overlay.querySelector('#support-reponse').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); envoyerReponseClient(); }
  });
}

// `message` (facultatif) : la raison de l'ouverture, quand la fenêtre s'ouvre
// parce qu'une écriture a été refusée sur une machine non couverte. Le message
// s'affiche dans la zone d'annonce de la fenêtre — même texte partout.
function openUpgradeNotice(companyId, message) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay offres-modal';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Cette fenêtre s'ouvre dans 3 cas bien différents — jamais annoncer un
  // « quota atteint » qui ne serait pas vrai :
  //  1. une restriction PRÉCISE est en cause (QR codes hors offre, machine
  //     hors couverture après résiliation…) : `message` la décrit, affiché
  //     en sous-titre — plus visible qu'avant (seulement dans #forfait-msg,
  //     en bas de la fenêtre, où personne ne le voyait sans faire défiler).
  //  2. le quota RÉEL de machines est atteint (limiteOffre(), même fonction
  //     que handleAddMachine/refuserSiNonCouverte) : bandeau « quota atteint ».
  //  3. simple consultation volontaire (bouton « Changer d'offre » de Mon
  //     compte) : aucune restriction à annoncer, ton neutre.
  const offreCourante = () => offreDeLaGrille(UI.companyPlan || 'free');
  function phraseLimite() {
    const o = offreCourante();
    // Le PLAFOND réel (limiteOffre), pas les machines incluses dans le prix : c'est lui qui bloque l'ajout.
    return tR('Ton offre {offre} couvre {machines}. Pour en suivre davantage, choisis une offre ci-dessous.',
      { offre: `<strong>${esc(trad(o.offre))}</strong>`, machines: tR('{n} machines', { n: limiteOffre() }) });
  }
  const quotaAtteint = limiteOffre() != null && UI.machines.length >= limiteOffre();
  const restreint = Boolean(message) || quotaAtteint;
  const titre = restreint ? trad('Limite de ton offre atteinte') : trad('Les offres KALEA');
  const eyebrowTexte = restreint ? trad('Accès limité par ton offre') : trad('Choisis ton offre');
  const sousTitre = message ? esc(message) : (quotaAtteint ? phraseLimite() : trad('Compare les offres ci-dessous et choisis celle qui correspond à ton activité.'));

  // Reskin Stitch « modale_les_offres_kalea » (2026-10-01) : l'argument de
  // vente visuel passe des quotas IA (ci-dessous, désormais secondaires)
  // aux modules/fonctionnalités, cumulatifs palier par palier — demande
  // explicite de l'utilisateur, qui trouvait l'ancienne hiérarchie trop
  // centrée sur un détail technique plutôt que sur ce qui vend l'offre.
  // Chaque item reste une fonctionnalité RÉELLEMENT distincte par palier
  // (vérifié contre les planCouvre*() existants) — par ex. une première
  // passe Stitch avait proposé « rappels personnalisés » comme avantage
  // Starter : retiré, aucun planCouvre*() ne distingue les rappels par
  // palier, ils sont strictement identiques à tous les niveaux.
  function eyebrowFonctionnalites(o) {
    if (o.cle === 'free') return trad('Fonctionnalités');
    if (o.cle === 'starter') return trad('Tout ce qui est dans Gratuit, plus :');
    if (o.cle === 'business') return trad('Tout ce qui est dans Starter, plus :');
    return trad('Tout ce qui est dans Business, plus :');
  }
  function fonctionnalites(o) {
    if (o.cle === 'free') {
      return [trad('Consultation du parc'), trad('Rappels e-mail'), trad('Notifications d\'échéances')];
    }
    if (o.cle === 'starter') {
      return [trad('5 machines (jusqu\'à 10 avec supplément)'), trad('Export CSV des données')];
    }
    if (o.cle === 'business') {
      return [
        trad('20 machines (jusqu\'à 40 avec supplément)'),
        trad('Multi-utilisateurs (3 accès)'),
        trad('QR codes équipements'),
        trad('Préparation groupée d\'atelier'),
        trad('Module Coûts & TCO'),
      ];
    }
    return [
      trad('40 machines (jusqu\'à 150 avec supplément)'),
      trad('Rôles d\'équipe'),
      trad('Support dédié'),
      trad('Module Stocks & SAV (magasins, mouvements, kits)'),
      trad('Télémétrie : connexion et suivi (matériel en sus)'),
    ];
  }
  // Les TROIS enveloppes IA, désormais une ligne compacte plutôt qu'une
  // liste à puces — même valeurs OFFRE_GRILLE, juste moins mises en avant.
  function ligneQuotasIA(o) {
    return [o.analyses, o.lectures].map((ligne) => trad(ligne)).join(' · ');
  }

  // « Business / Flotte » → { nom:'BUSINESS', tag:'Flotte' } ; « Gratuit » →
  // { nom:'GRATUIT', tag:null } — un découpage du VRAI nom d'offre déjà
  // utilisé partout ailleurs (OFFRE_GRILLE.offre), jamais un sous-titre
  // inventé pour ressembler à la maquette.
  function decoupeNomOffre(offre) {
    const [nom, tag] = trad(offre).split(' / ');
    return { nom: nom.toUpperCase(), tag: tag || null };
  }
  // « 39 €/mois » → { nombre:'39', reste:'/mois' } — un découpage du VRAI
  // prix. Repli sûr si le format ne matche pas (traduction future, etc.) :
  // le prix entier s'affiche quand même, juste sans la mise en forme « gros
  // chiffre ».
  function decoupePrix(prix) {
    const texte = trad(prix);
    const m = /^(\d+)\s*€\s*(.*)$/.exec(texte);
    return m ? { nombre: m[1], reste: m[2] } : { nombre: texte, reste: '' };
  }

  // ⚠️ CLIENT DÉJÀ ABONNÉ : jamais de lien de paiement pour une autre offre. Il
  // souscrirait un SECOND abonnement et paierait les deux. Le changement d'offre
  // passe par le portail de facturation, qui l'ajuste au prorata.
  const dejaAbonne = Boolean(UI.companyPlan && UI.companyPlan !== 'free');
  // Adresse de paiement retenue par offre : gardée de côté pour que le clic
  // puisse ouvrir exactement le lien affiché, après relecture du palier.
  const urlPaiement = {};
  function offrePayanteVisantCle(cle) {
    return OFFRES_PAYANTES.find((op) => offreDeLaGrille(op.cle).cle === cle) || null;
  }

  // Le PIED de chaque carte : UN SEUL bouton, celui qui mène quelque part —
  // jamais un bouton qui ne fait rien. Avant ce chantier, les boutons de
  // paiement vivaient dans une section À PART, sous les 4 cartes (dédoublé,
  // décalé de l'offre qu'il concernait) : chaque carte porte désormais son
  // propre bouton.
  function piedCarte(o, estActuelle) {
    // Institution : jamais de paiement par carte ni de portail Stripe, seulement la demande de facturation sur facture.
    if (estInstitution()) {
      if (estActuelle) return `<button type="button" class="offre-bouton is-neutre" disabled>${trad('Ton offre actuelle')}</button>`;
      if (o.cle === 'free') return '';
      const classeInst = o.recommandee ? 'offre-bouton is-primaire' : 'offre-bouton is-accent';
      return `<a href="${contactFacturationInstitution(o, companyId)}" class="${classeInst}">${trad('Demander la facturation mensuelle')}${picto('mail')}</a>`;
    }
    if (estActuelle) {
      // Sur SA PROPRE carte : un vrai accès au portail plutôt qu'un bouton
      // désactivé — plus intuitif que d'aller le chercher sur une autre
      // carte (le portail Stripe est générique, pas propre à une offre).
      // Le plan Gratuit n'a rien à gérer (aucun abonnement réel).
      if (!dejaAbonne) {
        return `<button type="button" class="offre-bouton is-neutre" disabled>${trad('Ton offre actuelle')}</button>`;
      }
      return `<button type="button" class="offre-bouton is-secondaire js-forfait-changer" id="forfait-changer-${o.cle}">${trad('Gérer mon abonnement')}</button>`;
    }
    // Enterprise : lien de paiement depuis le 2026-10-08. Le contact par e-mail ne reste que le REPLI si le lien manquait.
    if (o.cle === 'enterprise' && !STRIPE_LIENS.paid) {
      return `<a href="${contactEnterprise(companyId)}" class="offre-bouton is-secondaire">${trad('Nous contacter pour cette offre')}${picto('mail')}</a>`;
    }
    if (o.cle === 'free') return ''; // pas de « retour au gratuit » depuis cette fenêtre
    const correspondante = offrePayanteVisantCle(o.cle);
    if (!correspondante) return '';
    if (dejaAbonne) {
      // Client DÉJÀ abonné : le changement d'offre se fait ici, par le serveur (fonction `stripe-sync-machines`, action
      // `changer_offre`), et NON par le portail Stripe — qui ne propose pas « changer d'offre » dès que l'abonnement porte
      // des machines en plus (constaté en test le 2026-10-08). Le serveur change le tarif de base ET le supplément en une
      // seule opération, au prorata sur la prochaine facture.
      const classeChangement = o.recommandee ? 'offre-bouton is-primaire' : 'offre-bouton is-accent';
      return `<button type="button" class="${classeChangement} js-offre-changer" id="forfait-changer-offre-${correspondante.cle}" data-offre="${correspondante.cle}">${trad(correspondante.bouton)}</button>`;
    }
    const lien = STRIPE_LIENS[correspondante.cle];
    if (!lien) return `<div class="ui-aide">${trad('Le lien de cette offre est indisponible pour le moment. Écris-nous à support@kalea.pro.')}</div>`;
    const url = lien + '?client_reference_id=' + encodeURIComponent(companyId);
    urlPaiement[correspondante.cle] = url;
    const classe = o.recommandee ? 'offre-bouton is-primaire' : 'offre-bouton is-accent';
    return `<a id="forfait-payer-${correspondante.cle}" href="${url}" target="_blank" rel="noopener" class="${classe}">${trad(correspondante.bouton)}${picto(o.recommandee ? 'eclair' : 'flecheDroite')}</a>`;
  }

  const carteCleActuelle = OFFRES_HISTORIQUES[UI.companyPlan] || UI.companyPlan;
  const cartes = OFFRE_GRILLE.map((o) => {
    const { nom, tag } = decoupeNomOffre(o.offre);
    const { nombre, reste } = decoupePrix(o.prix);
    const estActuelle = o.cle === carteCleActuelle;
    return `
      <div class="offre-carte offre-carte--${o.cle}${o.recommandee ? ' is-recommandee' : ''}">
        ${o.recommandee ? `<div class="offre-ruban">${picto('etincelle')}<span>${trad('RECOMMANDÉ')}</span></div>` : ''}
        <div class="offre-carte-corps">
          <div class="offre-carte-entete">
            <span class="offre-carte-nom">${nom}</span>
            <span class="offre-carte-tag${estActuelle ? ' is-actuelle' : ''}">${estActuelle ? `<span class="dot"></span>${trad('Offre actuelle')}` : esc(tag || '')}</span>
          </div>
          <div class="offre-carte-prix">
            <span class="nombre">${esc(nombre)}</span><span class="devise">€</span>${reste ? `<span class="reste">${esc(reste)}</span>` : ''}
          </div>
          <div class="offre-carte-capacite">${picto('parcMachine')}<span>${trad('Capacité flotte')}</span><strong>${trad(o.machines)}</strong></div>
          ${o.supplement ? `<div class="offre-carte-hint">${trad(o.supplement)}</div>` : ''}
          <div class="offre-carte-inclus">
            <span class="eyebrow">${eyebrowFonctionnalites(o)}</span>
            <ul>${fonctionnalites(o).map((item) => `<li>${picto('coche')}<span>${item}</span></li>`).join('')}</ul>
          </div>
          <div class="offre-carte-ajoute">
            <strong>${trad('Inclus IA :')}</strong> ${ligneQuotasIA(o)}
            <div class="offre-carte-hint">${trad('Les lectures de compteur ne consomment pas tes analyses.')}</div>
          </div>
        </div>
        <div class="offre-carte-pied">${piedCarte(o, estActuelle)}</div>
      </div>`;
  }).join('');

  // L'ÉTABLISSEMENT DU PLAN : 29 € l'acte, toujours proposé (même service
  // quelle que soit l'offre) — la demande part par e-mail pré-rempli, comme
  // partout ailleurs où ce service est proposé (voir contactPlanEtabli).
  const blocPlan = `
    <div class="offre-service">
      <div class="offre-service-icone">${picto('carnet')}</div>
      <div class="offre-service-corps">
        <div class="offre-service-titre-ligne">
          <h3>${trad('Établissement de ton plan d\'entretien')}</h3>
          <span class="offre-service-prix">${trad('29 € l\'acte')}</span>
        </div>
        <p>${trad('Le processus ne change pas : tu nous écris depuis la fiche de la machine, l\'e-mail part pré-rempli.')}</p>
      </div>
      <a href="${contactPlanEtabli(companyId)}" class="offre-bouton is-secondaire">${trad('Demander un plan')}${picto('flecheDroite')}</a>
    </div>`;

  overlay.innerHTML = `
    <div class="modal">
      <div class="offres-entete">
        <div class="offres-eyebrow-ligne">
          <span class="offres-eyebrow${restreint ? ' is-restreint' : ''}">${picto('cadenas')}${eyebrowTexte}</span>
          <button type="button" class="log-close2" id="close-upgrade-x" aria-label="${esc(trad('Fermer'))}">${picto('fermer')}</button>
        </div>
        <h2>${titre}</h2>
        <p class="sub">${sousTitre}</p>
      </div>
      <div class="offres-grille">${cartes}</div>
      ${comparatifOffresHtml(carteCleActuelle)}
      ${blocGrandCompteHtml(companyId)}
      ${blocPlan}
      <div class="ui-aide" id="forfait-msg" role="status" aria-live="polite"></div>
      <div class="offres-pied">
        <div class="offres-confiance">
          <span>${picto('paiement')}${estInstitution() ? trad('Facturation mensuelle sur facture') : trad('Paiement sécurisé')}</span>
          <span>${picto('reglages')}${trad('Résiliable à tout moment')}</span>
        </div>
        <button type="button" class="secondary" id="close-upgrade">${trad('Fermer')}</button>
      </div>
    </div>`;
  overlay.querySelector('#close-upgrade').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#close-upgrade-x').addEventListener('click', () => overlay.remove());

  // Le changement d'offre d'un client abonné passe par le portail : la fenêtre
  // reste ouverte pour pouvoir dire ce qui s'est mal passé, le cas échéant.
  // Plusieurs boutons possibles (ex. client Enterprise : Starter ET Business
  // affichent tous deux « Gérer mon abonnement »), chacun avec son propre id
  // — ouvrirPortailAbonnement désactive LE bouton cliqué pendant l'appel.
  overlay.querySelectorAll('.js-forfait-changer').forEach((bouton) => {
    bouton.addEventListener('click', async () => {
      await ouvrirPortailAbonnement('forfait-msg', bouton.id);
      // Signalé par l'utilisateur : un message bref en petit texte gris, en
      // bas d'une fenêtre déjà longue, passe facilement pour « rien ne s'est
      // passé » — surtout quand le portail réussit à s'ouvrir dans un nouvel
      // onglet et que le message n'a de toute façon plus grand-chose à dire
      // (mais reste utile si ça a échoué). On le fait défiler jusqu'à
      // l'écran ; la mise en forme « alerte » ci-dessous (CSS) fait le reste.
      document.getElementById('forfait-msg')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
  overlay.querySelectorAll('.js-offre-changer').forEach((bouton) => {
    bouton.addEventListener('click', async () => {
      await changerOffreAbonnement(bouton.dataset.offre, bouton, 'forfait-msg', overlay);
      document.getElementById('forfait-msg')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
  // DERNIER REMPART CONTRE LE DOUBLE ABONNEMENT : un compte vu « gratuit » peut
  // être devenu payant dans l'intervalle (le webhook Stripe écrit quelques
  // secondes après le paiement). On RELIT donc le palier en base au moment du
  // clic — une seule requête — avant d'ouvrir un lien de paiement. S'il est
  // payant, on ouvre le portail à la place : le client changera d'offre au
  // prorata au lieu de souscrire un second abonnement.
  OFFRES_PAYANTES.forEach((offre) => {
    const lien = document.getElementById('forfait-payer-' + offre.cle);
    if (!lien || !urlPaiement[offre.cle]) return;
    lien.addEventListener('click', async (evenement) => {
      evenement.preventDefault();
      let palier = null;
      try { palier = await relirePalier(); } catch (err) { /* réseau : on laisse payer */ }
      if (palier && palier !== 'free') {
        overlay.remove();
        openUpgradeNotice(companyId);
        ouvrirPortailAbonnement('forfait-msg', 'forfait-changer-' + offreDeLaGrille(offre.cle).cle);
        return;
      }
      ouvrirLienExterne(urlPaiement[offre.cle]);
    });
  });
}

// ============================================================
// KALEA — couche de présentation « Signal »
// Remplace dueInfo() + renderMachines() de la version précédente.
// Toute la logique Supabase (modales d'édition, journal d'entretien,
// suppression, assistant d'ajout) est réutilisée telle quelle.
// ============================================================

// Horizon du compteur « Sous 15 jours » du tableau de bord (copie du handoff).
// Pour un suivi au compteur horaire, il n'existe pas d'équivalent en jours :
// on utilise alors la fenêtre de rappel du plan.
const SOON_DAYS = 15;
