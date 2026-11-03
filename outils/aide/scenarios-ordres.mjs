// Scénarios de capture du lot « ordres de travail, équipe, sans réseau » (articles dans articles-ordres.mjs).
// Même mode d'emploi que scenarios.mjs. Les fausses données (ordres, équipe) sont installées PAR LE SCÉNARIO : chaque scénario démarre sur une page neuve.
// Personnes inventées uniquement (adresses en exemple.fr). On ne clique jamais sur un bouton qui enregistre : on photographie des états.

// Échoue si un élément repéré sort de la zone photographiée.
async function toutDansLaZone(c, selecteurs, zone) {
  const dehors = await c.horsZone(selecteurs, zone);
  if (dehors.length) throw new Error('éléments repérés hors de la zone photographiée : ' + dehors.join(', '));
}

// Faux ordres de travail + fausse équipe : l'écran lit la table work_orders et les fonctions equipe_pour_attribution / equipe_ordres / ordre_travail_historique.
// À appeler AVANT d'ouvrir l'écran (la fausse base de etat-fictif.js renvoie sinon des listes vides).
async function installerOrdres(c, extras = []) {
  await c.ev(`(() => {
    const en = ${JSON.stringify(c.langue === 'en')};
    const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    const equipe = [
      { id: 'demo-utilisateur', nom_affiche: 'Camille MARTIN' },
      { id: 'u1', nom_affiche: 'Jean DUPONT' },
      { id: 'u2', nom_affiche: 'Sophie LEROY' },
    ];
    const t = (liste) => liste.map(([label, fait]) => ({ label, fait }));
    const ordres = [
      { id: 'o14', numero: 14, machine_id: 'm3', statut: 'a_faire', priorite: 'urgente', titre: en ? 'Oil change, Brake check' : 'Vidange, Contrôle des freins', description: null, assigne_a: 'u2', echeance: jour(-3), duree_estimee_h: 3, source: 'manuel', checklist: t([[en ? 'Oil change' : 'Vidange', false], [en ? 'Brake check' : 'Contrôle des freins', false]]), version: 1, intervention_id: null, note_statut: null, cree_par: 'demo-utilisateur' },
      { id: 'o13', numero: 13, machine_id: 'm1', statut: 'en_cours', priorite: 'haute', titre: en ? 'Oil change, greasing, filter check' : 'Vidange, graissage, contrôle des filtres', description: null, assigne_a: 'u1', echeance: jour(4), duree_estimee_h: 2, source: 'plan', checklist: t([[en ? 'Oil change' : 'Vidange', true], [en ? 'greasing' : 'graissage', true], [en ? 'filter check' : 'contrôle des filtres', false]]), version: 2, intervention_id: null, note_statut: null, cree_par: 'demo-utilisateur' },
      { id: 'o12', numero: 12, machine_id: 'm2', statut: 'a_faire', priorite: 'normale', titre: en ? 'Greasing' : 'Graissage', description: null, assigne_a: null, echeance: jour(10), duree_estimee_h: null, source: 'manuel', checklist: t([[en ? 'Greasing' : 'Graissage', false]]), version: 1, intervention_id: null, note_statut: null, cree_par: 'demo-utilisateur' },
      { id: 'o11', numero: 11, machine_id: 'm4', statut: 'termine', priorite: 'normale', titre: en ? 'Filter check' : 'Contrôle des filtres', description: null, assigne_a: 'u1', echeance: jour(-8), duree_estimee_h: 1, source: 'manuel', checklist: t([[en ? 'Filter check' : 'Contrôle des filtres', true]]), version: 3, intervention_id: null, note_statut: null, cree_par: 'demo-utilisateur' },
      { id: 'o10', numero: 10, machine_id: 'm2', statut: 'valide', priorite: 'basse', titre: en ? 'Oil change' : 'Vidange', description: null, assigne_a: 'u2', echeance: jour(-15), duree_estimee_h: 2, source: 'manuel', checklist: t([[en ? 'Oil change' : 'Vidange', true]]), version: 4, intervention_id: null, note_statut: null, cree_par: 'demo-utilisateur' },
    ];
    ordres.push(...${JSON.stringify(extras)});
    const historique = [
      { action: 'ot_demarrer', personne: 'Jean DUPONT', details: {}, quand: new Date(Date.now() - 3 * 3600e3).toISOString() },
      { action: 'ot_assigne', personne: 'Camille MARTIN', details: { a: 'u1' }, quand: new Date(Date.now() - 26 * 3600e3).toISOString() },
      { action: 'ot_cree', personne: 'Camille MARTIN', details: {}, quand: new Date(Date.now() - 27 * 3600e3).toISOString() },
    ];
    const rendre = (donnees) => { const b = { select() { return b; }, eq() { return b; }, in() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, single() { return b; }, maybeSingle() { return b; }, then(res) { res({ data: donnees, error: null, count: donnees.length }); } }; return b; };
    const fromAvant = sb.from; const rpcAvant = sb.rpc;
    sb.from = (nom) => (nom === 'work_orders' ? rendre(ordres) : fromAvant(nom));
    sb.rpc = async (nom, args) => {
      if (nom === 'equipe_pour_attribution' || nom === 'equipe_ordres') return { data: equipe, error: null };
      if (nom === 'ordre_travail_historique') return { data: historique, error: null };
      return rpcAvant(nom, args);
    };
    return true;
  })()`);
}


// Fausse équipe pour « Mon compte > Gestion de l'équipe » (fonction membres_de_ma_societe) : un membre par droit, noms inventés.
async function installerEquipe(c) {
  await c.ev(`(() => {
    const en = ${JSON.stringify(c.langue === 'en')};
    const membres = [
      { id: 'demo-utilisateur', email: 'camille@exemple.fr', role: 'gerant', est_moi: true, prenom: 'Camille', nom: 'MARTIN', login: null, metier: null, invitation_en_attente: false },
      { id: 'u3', email: 'nadia.bertrand@exemple.fr', role: 'direction', est_moi: false, prenom: 'Nadia', nom: 'BERTRAND', login: null, metier: en ? 'Operations manager' : 'Responsable d’exploitation', invitation_en_attente: false },
      { id: 'u1', email: 'jean.dupont@membres.keeva.work', login: 'jean.dupont', role: 'mecanicien', est_moi: false, prenom: 'Jean', nom: 'DUPONT', metier: en ? 'Workshop manager' : 'Chef d’atelier', invitation_en_attente: false },
      { id: 'u2', email: 'hugo.moreau@membres.keeva.work', login: 'hugo.moreau', role: 'chauffeur', est_moi: false, prenom: 'Hugo', nom: 'MOREAU', metier: en ? 'Driver' : 'Chauffeur', invitation_en_attente: false },
      { id: 'u4', email: 'paul.garnier@exemple.fr', role: 'achats', est_moi: false, prenom: 'Paul', nom: 'GARNIER', metier: null, invitation_en_attente: false },
    ];
    const rpcAvant = sb.rpc;
    sb.rpc = async (nom, args) => (nom === 'membres_de_ma_societe' ? { data: membres, error: null } : rpcAvant(nom, args));
    return true;
  })()`);
}
// Ouvre « Mon compte » avec la fausse équipe, une fois la carte « Gestion de l'équipe » dessinée.
async function ouvrirEquipe(c) {
  await installerEquipe(c);
  await c.ev("goTo('account'); true");
  await c.attendre('#acc-equipe .equipe-ligne');
  await c.dort(700);
}

// Fausse file « À envoyer » : on remplace fileMiennes (la lecture de la file) par une liste fabriquée, puis on remet le compte à jour. Rien n'est écrit dans la base locale
// du navigateur de capture, donc rien à nettoyer (et rien ne pollue les scénarios suivants). Par défaut : deux actions en attente ; avec erreur = true, une troisième, en erreur.
async function remplirFile(c, { erreur = false } = {}) {
  await c.ev(`(async () => {
    const en = ${JSON.stringify(c.langue === 'en')};
    const maintenant = Date.now();
    const op = (id, type, resume, etat, message) => ({ id, type, companyId: UI.companyId, userId: UI.userId, creeA: maintenant - id.length * 60000, payload: type === 'ordre' ? { ordreId: 'o13', action: 'cocher' } : {}, resume, etat, erreur: message || null, tentatives: 0, etapes: {} });
    const ops = [
      op('a', 'ordre', { machine: en ? 'Excavator 1.7 t' : 'Pelle 1,7 t', detail: 'OT-13 · ' + (en ? 'filter check' : 'contrôle des filtres') }, 'attente'),
      op('bb', 'panne', { machine: en ? 'Dump truck' : 'Camion benne', detail: en ? 'Warning light on' : 'Voyant allumé' }, 'attente'),
    ];
    if (${JSON.stringify(erreur)}) ops.push(op('ccc', 'intervention', { machine: en ? 'Wheel loader' : 'Chargeuse sur pneus', detail: en ? 'Oil change' : 'Vidange' }, 'erreur', trad("La machine n'existe plus ou n'est plus accessible.")));
    window.fileMiennes = async () => ops;
    await fileMajCompte();
    return true;
  })()`);
}

// Ouvre la liste « Ordres de travail » (rubrique Planning) avec les faux ordres, une fois dessinée.
async function ouvrirListeOrdres(c, extras = []) {
  await installerOrdres(c, extras);
  await c.ev("goTo('ordres'); true");
  await c.attendre('#ot-liste [data-ot]');
  await c.dort(700);
}

// Ouvre le formulaire « Nouvel ordre de travail » (étape 2/2) sur la pelle de démonstration, avec deux tâches du plan cochées et une « autre tâche » ajoutée.
async function formulaireOrdre(c) {
  await installerOrdres(c);
  await c.ev("goTo('ordres'); true");
  await c.attendre('#ot-nouveau');
  await c.dort(500);
  await c.ev("ouvrirFormOrdre({ machineId: 'm1', plan: true }); true");
  await c.attendre('#otf-enregistrer');
  await c.dort(700);
}

// Autres tables : fausses lignes par table (JSON). single / maybeSingle rendent la première ligne.
async function installerTables(c, tables) {
  await c.ev(`(() => {
    const tables = ${JSON.stringify(tables)};
    const rendre = (lignes) => { let un = false; const b = { select() { return b; }, eq() { return b; }, in() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, single() { un = true; return b; }, maybeSingle() { un = true; return b; }, then(res) { res({ data: un ? (lignes[0] || null) : lignes, error: null, count: lignes.length }); } }; return b; };
    const avant = sb.from;
    sb.from = (nom) => (Object.prototype.hasOwnProperty.call(tables, nom) ? rendre(tables[nom]) : avant(nom));
    return true;
  })()`);
}
const jourRelatif = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const instantRelatif = (h) => new Date(Date.now() + h * 3600e3).toISOString();
// Pastille numérotée posée à droite d'un élément, à mi-hauteur (même aspect que les repères de etat-fictif.js ; effacée avec eux).
async function badgeADroite(c, selecteur, numero) {
  await c.ev(`(() => { const r = document.querySelector(${JSON.stringify(selecteur)}).getBoundingClientRect(); const b = document.createElement('div'); b.setAttribute('data-repere-aide', '1'); b.textContent = ${JSON.stringify(String(numero))}; b.style.cssText = 'position:fixed;z-index:2147483001;pointer-events:none;left:' + (r.right + 12) + 'px;top:' + (r.top + r.height / 2 - 14) + 'px;width:28px;height:28px;border-radius:50%;background:#D92D20;color:#fff;font:800 15px/28px Figtree,system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff;'; document.body.appendChild(b); return true; })()`);
}
// Retire le focus du clavier (sinon une croix ou un champ s'affiche avec son anneau de focus sur la photo).
const FLOU = 'document.activeElement && document.activeElement.blur(); true';
// Ajoute à la liste chargée un ordre « En cours » dont toutes les tâches du plan de la pelle sont cochées (pour « Terminer » sans question).
async function ordreToutCoche(c) {
  await c.ev(`(() => {
    const m = UI.machines[0];
    const t = otTachesDuPlan(m).slice(0, 2).map((label) => ({ label, fait: true }));
    UI.ordres.push({ id: 'o9', numero: 9, machine_id: m.id, statut: 'en_cours', priorite: 'normale', titre: t.map((x) => x.label).join(', '), description: null, assigne_a: 'u1', echeance: null, duree_estimee_h: 2, source: 'plan', checklist: t, version: 2, intervention_id: null, note_statut: null, cree_par: 'demo-utilisateur' });
    return true;
  })()`);
}

// Fausses données pour « Qualifications et habilitations » (fonction habChargerGestion remplacée), puis ouverture de la fenêtre sur l'onglet voulu.
async function ouvrirHabilitations(c, onglet) {
  await activerSignaturesHabilitations(c);
  const en = c.langue === 'en';
  const noms = en ? ['Heavy plant licence', 'Electrical certification', 'Working at height'] : ['CACES R482', 'Habilitation électrique', 'Travail en hauteur'];
  const donnees = {
    qualifications: [
      { id: 'q1', nom: noms[0], duree_validite_mois: 60, description: null, actif: true },
      { id: 'q2', nom: noms[1], duree_validite_mois: 36, description: null, actif: true },
      { id: 'q3', nom: noms[2], duree_validite_mois: null, description: null, actif: true },
    ],
    habilitations: [
      { id: 'h1', profil_id: 'u1', qualification_id: 'q1', obtenue_le: jourRelatif(-1700), expire_le: jourRelatif(40), justificatif: null, verifie_par: null, verifie_a: null },
      { id: 'h2', profil_id: 'u1', qualification_id: 'q2', obtenue_le: jourRelatif(-900), expire_le: jourRelatif(-10), justificatif: null, verifie_par: 'demo-utilisateur', verifie_a: jourRelatif(-800) },
    ],
    exigences: [
      { id: 'e1', qualification_id: 'q1', machine_id: null, category_id: 'c1', niveau: 'obligatoire' },
      { id: 'e2', qualification_id: 'q2', machine_id: 'm4', category_id: null, niveau: 'recommandee' },
    ],
    mode: 'avertir',
    equipe: [{ id: 'u1', nom: 'Jean DUPONT' }, { id: 'u2', nom: 'Hugo MOREAU' }, { id: 'u3', nom: 'Nadia BERTRAND' }],
    expirantes: [{ nom_affiche: 'Jean DUPONT', qualification: noms[0], expire_le: jourRelatif(40) }],
  };
  await installerOrdres(c);
  await c.ev(`window.habChargerGestion = async () => (${JSON.stringify(donnees)}); true`);
  await c.ev(`ouvrirGestionHabilitations(${JSON.stringify(onglet)}); true`);
  await c.attendre('#hab-mode');
  await c.dort(800);
  await c.ev(FLOU);
}
// Offre Enterprise installée côté serveur : les blocs « signature » et « habilitations » de la page des ordres, et leurs fenêtres, apparaissent.
async function activerSignaturesHabilitations(c) {
  await c.ev('SCHEMA.hasSignatures = true; SCHEMA.hasHabilitations = true; true');
}
// Dossier d'une intervention (fonction chargerDossierIntervention remplacée) : sans signature par défaut, donc « Non signée ».
async function dossierIntervention(c, signatures) {
  const en = c.langue === 'en';
  await c.ev(`window.chargerDossierIntervention = async () => ({ intervention: { id: 'i1', machine_id: 'm1', performed_at: ${JSON.stringify(jourRelatif(-1))}, hours_at_intervention: 1250, performed_by: 'u1', items_done: ${JSON.stringify(en ? ['Oil change', 'greasing'] : ['Vidange', 'graissage'])}, description: 'OT-13' }, pieces: [], signatures: ${JSON.stringify(signatures)}, avenants: [], machine: UI.machines[0], verification: null, noms: new Map() }); true`);
}

export const SCENARIOS = [
  {
    id: 'ord-creer-ordre-travail',
    etapes: [
      // 1. La liste des ordres et le bouton « Nouvel ordre ».
      { nom: 'liste', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.repere('#ot-nouveau', 1);
        return c.zoneJusqua('#view-root .ui-section', '[data-ot="o12"]', 10);
      } },
      // 2. Étape 1/2 : la recherche, la machine touchée et « Continuer vers les tâches de l'OT ».
      { nom: 'machine', ecran: 'bureau', async jouer(c) {
        await installerOrdres(c);
        await c.ev("goTo('ordres'); true");
        await c.attendre('#ot-nouveau');
        await c.dort(500);
        await c.ev("ouvrirChoixMachineOrdre(); true");
        await c.attendre('[data-otc="m1"]');
        await c.ev("document.querySelector('[data-otc=\"m1\"]').click(); true");
        await c.dort(600);
        await c.repere('#otc-recherche', 1);
        await c.repere('[data-otc="m1"]', 2);
        await c.repere('#otc-continuer', 3, { cote: 'droite' });
        await toutDansLaZone(c, ['#otc-recherche', '[data-otc="m1"]', '#otc-continuer'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
      // 3. Étape 2/2 : « Type de tâche », champ « Autre tâche » et « Ajouter ».
      { nom: 'taches', ecran: 'bureau', async jouer(c) {
        await formulaireOrdre(c);
        const autre = c.langue === 'en' ? 'Check the brakes' : 'Contrôler les freins';
        await c.ev(`(() => { const ch = document.querySelector('[data-otf-plan="0"]'); if (ch && !ch.checked) ch.click(); const i = document.getElementById('otf-autre'); i.value = ${JSON.stringify(autre)}; document.getElementById('otf-ajouter').click(); return true; })()`);
        await c.dort(500);
        await c.voir('#otf-autre', 'center');
        await c.repere('#otf-plan-liste', 1, { marge: 6 });
        await c.repere('#otf-autre', 2);
        await c.repere('#otf-ajouter', 3, { cote: 'droite' });
        await toutDansLaZone(c, ['#otf-plan-liste', '#otf-autre', '#otf-ajouter'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
      // 4. Étape 2/2 : « Planification » (priorité, assigné à, échéance et durée), remplie pour montrer le résultat.
      { nom: 'planification', ecran: 'bureau', async jouer(c) {
        await formulaireOrdre(c);
        // Les listes et la date sont « habillées » (un bouton remplace le champ) : on règle le champ, puis on remet à jour le texte du bouton.
        await c.ev(`(() => {
          const regler = (id, valeur) => { const ch = document.getElementById(id); ch.value = valeur; ch.dispatchEvent(new Event('change', { bubbles: true })); const b = document.getElementById(id + '-bouton'); const o = ch.options ? ch.options[ch.selectedIndex] : null; if (b && b.firstElementChild) b.firstElementChild.textContent = o ? o.textContent : formatShortDateAvecAnnee(valeur); };
          regler('otf-priorite', 'haute');
          regler('otf-assigne', 'u1');
          regler('otf-echeance', new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
          document.getElementById('otf-duree').value = '2';
          return true;
        })()`);
        await c.dort(500);
        await c.voir('#otf-duree', 'center');
        await c.repere('#otf-priorite-bouton', 1, { marge: 4, cote: 'droite' });
        await c.repere('#otf-assigne-bouton', 2, { marge: 4, cote: 'droite' });
        await c.repere('#otf-echeance-bouton', 3, { marge: 4, cote: 'droite' });
        await c.repere('#otf-duree', 4, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['#otf-priorite-bouton', '#otf-assigne-bouton', '#otf-echeance-bouton', '#otf-duree'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
    ],
  },
  {
    id: 'ord-suivre-ordres-travail',
    etapes: [
      // 1 à 4. La liste : le nombre d'ordres (1), les filtres d'état (2), la recherche (3) et une ligne d'ordre (4).
      { nom: 'liste', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.repere('#ot-compte', 1, { marge: 6 });
        await c.repere('#ot-puces', 2, { marge: 3 });
        await c.repere('#ot-recherche', 3, { marge: 3 });
        await c.repere('[data-ot="o13"]', 4, { marge: 2 });
        await toutDansLaZone(c, ['#ot-compte', '#ot-puces', '#ot-recherche', '[data-ot="o13"]'], '#view-root');
        return c.zoneJusqua('#view-root .ui-section', '[data-ot="o12"]', 10);
      } },
      // 5. La fiche d'un ordre, avec l'historique déplié.
      { nom: 'fiche', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.ev("ouvrirOrdre('o13'); true");
        await c.attendre('[data-ot-histo]');
        await c.ev("document.querySelector('[data-ot-histo]').click(); true");
        await c.attendre('.otm-histo-liste');
        await c.dort(600);
        await c.ev('document.activeElement && document.activeElement.blur(); true');
        await c.voir('.otm-histo-liste', 'end');
        await c.repere('[data-ot-histo]', 1, { marge: 4 });
        await toutDansLaZone(c, ['[data-ot-histo]'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
    ],
  },
  {
    id: 'ord-droits-acces',
    etapes: [
      // « Mon compte » > « Gestion de l'équipe » : la liste de l'équipe avec le droit de chacun (1), et le détail « Peut faire » d'une personne (2).
      { nom: 'equipe', ecran: 'bureau', async jouer(c) {
        await ouvrirEquipe(c);
        await c.ev("document.querySelector('[data-equipe-ouvrir=\"u1\"]').click(); true");
        await c.dort(500);
        await c.voir('#acc-equipe', 'start');
        await c.repere('#acc-equipe-liste .equipe-liste', 1, { marge: 6 });
        await c.repere('[data-membre="u1"] .equipe-fiche', 2, { marge: 4 });
        await toutDansLaZone(c, ['#acc-equipe-liste .equipe-liste', '[data-membre="u1"] .equipe-fiche'], '#acc-equipe');
        return c.zone('#acc-equipe', 14);
      } },
    ],
  },
  {
    id: 'ord-a-envoyer',
    etapes: [
      // 2. Le bandeau « n action(s) enregistrée(s)… » en haut de l'écran (1), la pastille « À envoyer » sur l'ordre (2), le lien « Voir » (3).
      { nom: 'bandeau', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await remplirFile(c);
        await c.ev('UI.redessinerOrdres && UI.redessinerOrdres(); true');
        await c.attendre('#bandeau-file');
        await c.dort(500);
        await c.marquerTexte('[data-ot="o13"] .ui-statut', '^(À envoyer|To send)$', 'pastille');
        await c.repere('#bandeau-file', 1, { marge: 2 });
        await c.repere('[data-aide="pastille"]', 2, { marge: 4 });
        await c.repere('#bandeau-file .file-banniere-actions', 3, { marge: 4, cote: 'gauche-centre' });
        await toutDansLaZone(c, ['#bandeau-file', '[data-aide="pastille"]', '#bandeau-file .file-banniere-actions'], '.content .view');
        return c.zoneJusqua('#bandeau-file', '[data-ot="o13"]', 16);
      } },
      // 3 à 5. La fenêtre « À envoyer » : une action en attente (1), « Envoyer maintenant » (2), « Réessayer » (3) et « Abandonner » (4) sur l'action en erreur.
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await remplirFile(c, { erreur: true });
        await c.ev('ouvrirFileOperations(); true');
        await c.attendre('#file-liste .ui-ligne');
        await c.dort(600);
        await c.marquerTexte('.file-modal .ui-statut', '^(En attente|Waiting|Pending)$', 'attente');
        await c.repere('[data-aide="attente"]', 1, { marge: 4 });
        await c.repere('#file-envoyer', 2, { marge: 4 });
        await c.repere('[data-file-reessayer]', 3, { marge: 4 });
        await c.repere('[data-file-abandonner]', 4, { marge: 4 });
        await toutDansLaZone(c, ['[data-aide="attente"]', '#file-envoyer', '[data-file-reessayer]', '[data-file-abandonner]'], '.file-modal');
        return c.zone('.file-modal', 14);
      } },
    ],
  },
  {
    id: 'ord-valider-refuser-ordre',
    etapes: [
      // 1. En bas de la liste : la case « Exiger une validation du gérant… » cochée, avec la confirmation de KALEA.
      { nom: 'reglage', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.attendre('#ot-validation:not([disabled])');
        await c.ev("document.getElementById('ot-validation').click(); true");
        await c.dort(600);
        await c.voir('#ot-validation', 'center');
        await c.repere('.ot-validation .check-row', 1, { marge: 6 });
        await toutDansLaZone(c, ['.ot-validation .check-row'], '.ot-validation');
        return c.zone('.ot-validation', 14);
      } },
      // 4. La fiche d'un ordre terminé quand la validation est exigée : l'encadré « en attente de validation » (1), « Valider » (2), « Refuser » (3).
      { nom: 'fiche', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.ev("UI.validationOrdres = true; ouvrirOrdre('o11'); true");
        await c.attendre('[data-ot-act="valider"]');
        await c.dort(600);
        await c.ev('document.activeElement && document.activeElement.blur(); true');
        await c.repere('.otm-fiche .ui-encadre', 1, { marge: 4 });
        await c.repere('[data-ot-act="valider"]', 2, { marge: 4 });
        await c.repere('[data-ot-act="refuser"]', 3, { marge: 4 });
        await toutDansLaZone(c, ['.otm-fiche .ui-encadre', '[data-ot-act="valider"]', '[data-ot-act="refuser"]'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
    ],
  },
  {
    id: 'ord-inviter-email',
    etapes: [
      // 1. La carte « Gestion de l'équipe » et son bouton « Ajouter ».
      { nom: 'ajouter', ecran: 'bureau', async jouer(c) {
        await ouvrirEquipe(c);
        await c.voir('#acc-equipe', 'start');
        await c.repere('#acc-equipe-ajouter', 1, { marge: 5 });
        await toutDansLaZone(c, ['#acc-equipe-ajouter'], '#acc-equipe');
        return c.zoneJusqua('#acc-equipe', '#acc-equipe-ajouter', 22);
      } },
      // 2 et 3. Le formulaire « Inviter par e-mail » déroulé dans la fenêtre « Ajouter un membre » : le titre qui se déroule (1), l'adresse (2), le droit d'accès (3) et « Créer l'invitation » (4).
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await ouvrirEquipe(c);
        await c.ev("document.querySelector('#acc-equipe-ajouter').click(); document.querySelector('#acc-equipe-invitation-bloc').open = true; true");
        await c.attendre('#acc-invite-envoyer');
        await c.dort(700);
        await c.voir('#acc-invite-envoyer', 'end');
        await c.ev('document.activeElement && document.activeElement.blur(); true');
        await c.repere('#acc-equipe-invitation-bloc > summary', 1, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#acc-invite-email', 2, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#acc-invite-role', 3, { marge: 4, cote: 'droite' });
        await c.repere('#acc-invite-envoyer', 4, { marge: 4, cote: 'gauche-centre' });
        await toutDansLaZone(c, ['#acc-equipe-invitation-bloc > summary', '#acc-invite-email', '#acc-invite-role', '#acc-invite-envoyer'], '#acc-equipe-invitation-bloc');
        return c.zone('#acc-equipe-invitation-bloc', 40);
      } },
    ],
  },
  {
    id: 'ord-membre-direct',
    etapes: [
      // 2. « Ajouter un membre direct » : Prénom (1), Nom (2) et Métier (3).
      { nom: 'identite', ecran: 'bureau', async jouer(c) {
        await ouvrirEquipe(c);
        await c.ev("document.querySelector('#acc-equipe-ajouter').click(); true");
        await c.attendre('#acc-membre-prenom');
        await c.dort(700);
        await c.ev('document.activeElement && document.activeElement.blur(); true');
        await c.repere('#acc-membre-prenom', 1, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#acc-membre-nom', 2, { marge: 4, cote: 'droite' });
        await c.repere('#acc-membre-metier', 3, { marge: 4, cote: 'gauche-centre' });
        await toutDansLaZone(c, ['#acc-membre-prenom', '#acc-membre-nom', '#acc-membre-metier'], '#acc-equipe-ajout .modal');
        return c.zoneJusqua('#acc-equipe-creation .ui-groupe', '#acc-membre-metier', 44);
      } },
      // 3 et 4. Le droit (1) et « Créer le membre » (2).
      { nom: 'droit', ecran: 'bureau', async jouer(c) {
        await ouvrirEquipe(c);
        await c.ev("document.querySelector('#acc-equipe-ajouter').click(); true");
        await c.attendre('#acc-membre-role');
        await c.dort(700);
        await c.ev('document.activeElement && document.activeElement.blur(); true');
        await c.marquer('#acc-membre-role', 'role', '.ui-champ-groupe');
        await c.repere('#acc-membre-role', 1, { marge: 4, cote: 'droite' });
        await c.repere('#acc-membre-creer', 2, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['#acc-membre-role', '#acc-membre-creer'], '#acc-equipe-ajout .modal');
        return c.zoneJusqua('[data-aide="role"]', '#acc-membre-creer', 22);
      } },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────── Lot 2
  {
    id: 'ord-realiser-ordre-travail',
    etapes: [
      // 2. La fiche d'un ordre « À faire » : le bouton « Démarrer ».
      { nom: 'demarrer', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.ev("ouvrirOrdre('o12'); true");
        await c.attendre('[data-ot-act="demarrer"]');
        await c.dort(600);
        await c.ev(FLOU);
        await c.repere('[data-ot-act="demarrer"]', 1, { marge: 4 });
        await toutDansLaZone(c, ['[data-ot-act="demarrer"]'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
      // 3 et 4. La fiche d'un ordre « En cours » : la liste des tâches à cocher avec son compteur (1) et « Terminer » (2).
      { nom: 'taches', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.ev("ouvrirOrdre('o13'); true");
        await c.attendre('[data-ot-act="terminer"]');
        await c.dort(600);
        await c.ev(FLOU);
        await c.repere('.otm-taches', 1, { marge: 6, cote: 'gauche-centre' });
        await c.repere('[data-ot-act="terminer"]', 2, { marge: 4 });
        await toutDansLaZone(c, ['.otm-taches', '[data-ot-act="terminer"]'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
      // 5. La fenêtre « Enregistrer une intervention » ouverte par « Terminer », déjà remplie : l'intervenant assigné (1) et les tâches cochées (2).
      { nom: 'intervention', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await ordreToutCoche(c);
        await c.ev("ouvrirOrdre('o9'); true");
        await c.attendre('[data-ot-act="terminer"]');
        await c.ev("document.querySelector('[data-ot-act=\"terminer\"]').click(); true");
        await c.attendre('#log-operateur:not([disabled])');
        await c.dort(900);
        await c.ev(FLOU);
        await c.repere('#log-operateur-bouton', 1, { marge: 4 });
        await c.repere('#log-checklist', 2, { marge: 6 });
        const z = await c.ev(`(() => { const m = document.querySelector('.overlay.log-modal .modal').getBoundingClientRect(); const a = document.querySelector('#log-operateur').closest('.field-row').getBoundingClientRect(); const b = document.querySelector('#log-checklist').getBoundingClientRect(); const y = Math.max(0, a.top - 36); return { x: m.left + 6, y, largeur: m.width - 12, hauteur: b.bottom + 24 - y }; })()`);
        await toutDansLaZone(c, ['#log-operateur-bouton', '#log-checklist'], '.overlay.log-modal .modal');
        return z;
      } },
    ],
  },
  {
    id: 'ord-modifier-annuler-ordre',
    etapes: [
      // 1. La fiche d'un ordre ouvert : « Modifier » (1), « Remettre à faire » (2) et « Annuler l'ordre » (3), en bas.
      { nom: 'fiche', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.ev("ouvrirOrdre('o13'); true");
        await c.attendre('[data-ot-act="modifier"]');
        await c.dort(600);
        await c.ev(FLOU);
        await c.repere('[data-ot-act="modifier"]', 1, { marge: 4 });
        await c.repere('[data-ot-act="reouvrir"]', 2, { marge: 4 });
        await c.repere('[data-ot-act="annuler"]', 3, { marge: 4 });
        await toutDansLaZone(c, ['[data-ot-act="modifier"]', '[data-ot-act="reouvrir"]', '[data-ot-act="annuler"]'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
      // 2. La fenêtre de modification : priorité (1), assigné à (2) et « Enregistrer » (3).
      { nom: 'modification', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.ev("ouvrirFormOrdre({ ordre: UI.ordres.find((o) => o.id === 'o13') }); true");
        await c.attendre('#otf-enregistrer');
        await c.dort(700);
        await c.ev(FLOU);
        await c.repere('#otf-priorite-bouton', 1, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#otf-assigne-bouton', 2, { marge: 4, cote: 'droite' });
        await c.repere('#otf-enregistrer', 3, { marge: 4 });
        await toutDansLaZone(c, ['#otf-priorite-bouton', '#otf-assigne-bouton', '#otf-enregistrer'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
      // 4. La fiche d'un ordre annulé : l'encadré « Motif d'annulation ».
      { nom: 'annule', ecran: 'bureau', async jouer(c) {
        const en = c.langue === 'en';
        await ouvrirListeOrdres(c, [{ id: 'o8', numero: 8, machine_id: 'm3', statut: 'annule', priorite: 'normale', titre: en ? 'Brake check' : 'Contrôle des freins', description: null, assigne_a: 'u2', echeance: jourRelatif(-20), duree_estimee_h: 1, source: 'manuel', checklist: [{ label: en ? 'Brake check' : 'Contrôle des freins', fait: false }], version: 2, intervention_id: null, note_statut: en ? 'Done with the annual inspection instead' : 'Fait lors du contrôle annuel', cree_par: 'demo-utilisateur' }]);
        await c.ev("ouvrirOrdre('o8'); true");
        await c.attendre('.otm-fiche .ui-encadre');
        await c.dort(600);
        await c.ev(FLOU);
        await c.repere('.otm-fiche .ui-encadre', 1, { marge: 4 });
        await toutDansLaZone(c, ['.otm-fiche .ui-encadre'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
    ],
  },
  {
    id: 'ord-ordre-depuis-panne-fiche',
    etapes: [
      // 1. La fiche d'une machine : le bouton « Créer un ordre » de la barre d'actions.
      { nom: 'fiche', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.ev("openPlanView(UI.machines[2], UI.companyId, UI.categories); true");
        await c.attendre('#ordre-from-plan');
        await c.dort(900);
        await c.ev(FLOU);
        await c.repere('#ordre-from-plan', 1, { marge: 2, cote: 'droite' });
        await toutDansLaZone(c, ['#ordre-from-plan'], '.fm-toolbar');
        return c.ev(`(() => { const n = document.querySelector('.plan-fil-courant').closest('nav').getBoundingClientRect(); const b = document.querySelector('.fm-toolbar').getBoundingClientRect(); const x = Math.max(0, Math.min(n.left, b.left) - 14); const y = Math.max(0, n.top - 14); return { x, y, largeur: Math.max(n.right, b.right) + 14 - x, hauteur: b.bottom + 18 - y }; })()`);
      } },
      // 2. La fenêtre ouverte depuis la fiche : les tâches en retard déjà cochées (1), la priorité (2) et « Assigné à » (3).
      { nom: 'ordre', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.ev("ouvrirFormOrdre({ machineId: 'm3', plan: true }); true");
        await c.attendre('#otf-enregistrer');
        await c.dort(700);
        await c.ev(FLOU);
        await c.repere('#otf-plan-liste', 1, { marge: 6 });
        await c.repere('#otf-priorite-bouton', 2, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#otf-assigne-bouton', 3, { marge: 4, cote: 'droite' });
        await toutDansLaZone(c, ['#otf-plan-liste', '#otf-priorite-bouton', '#otf-assigne-bouton'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
      // 3. La liste « Pannes signalées » : le bouton « Créer un ordre de travail » d'une panne ouverte.
      { nom: 'pannes', ecran: 'bureau', async jouer(c) {
        const en = c.langue === 'en';
        await ouvrirListeOrdres(c);
        const nomM3 = await c.ev("UI.machines.find((m) => m.id === 'm3').name");
        const nomM1 = await c.ev("UI.machines.find((m) => m.id === 'm1').name");
        await installerTables(c, { machine_breakdowns: [
          { id: 'p1', machine_id: 'm3', machine_name: nomM3, description: en ? 'Hydraulic leak, the tipper no longer lifts' : 'Fuite hydraulique, la benne ne se lève plus', severity: 'bloquante', status: 'ouverte', stopped: true, reported_at: instantRelatif(-5), reported_by_name: 'Hugo MOREAU', downtime_hours: null, downtime_cost: null },
          { id: 'p2', machine_id: 'm1', machine_name: nomM1, description: en ? 'Warning light on the dashboard' : 'Voyant allumé sur le tableau de bord', severity: 'mineure', status: 'ouverte', stopped: false, reported_at: instantRelatif(-30), reported_by_name: 'Jean DUPONT', downtime_hours: null, downtime_cost: null },
        ] });
        await c.ev('ouvrirListePannes(); true');
        await c.attendre('[data-panne-ordre]');
        await c.dort(600);
        await c.ev(FLOU);
        await c.repere('[data-panne-ordre="p1"]', 1, { marge: 4 });
        await toutDansLaZone(c, ['[data-panne-ordre="p1"]'], '.panne-liste-modal');
        return c.zone('.panne-liste-modal', 14);
      } },
      // 4. La fenêtre ouverte depuis une panne : la tâche « Réparer : … » (1). La priorité n'est pas photographiée : le bouton de priorité n'affiche pas la valeur proposée (voir le rapport).
      { nom: 'ordre-panne', ecran: 'bureau', async jouer(c) {
        const en = c.langue === 'en';
        await ouvrirListeOrdres(c);
        await c.ev(`ouvrirFormOrdre({ machineId: 'm3', panne: { id: 'p1', machine_id: 'm3', description: ${JSON.stringify(en ? 'Hydraulic leak, the tipper no longer lifts' : 'Fuite hydraulique, la benne ne se lève plus')}, severity: 'bloquante' } }); true`);
        await c.attendre('#otf-enregistrer');
        await c.dort(700);
        await c.ev(FLOU);
        await c.repere('#otf-autres-liste', 1, { marge: 4 });
        await toutDansLaZone(c, ['#otf-autres-liste'], '.overlay .modal');
        return c.zoneJusqua('.overlay .modal', '#otf-ajouter', 16);
      } },
    ],
  },
  {
    id: 'ord-changer-retirer-membre',
    etapes: [
      // 1 à 4. La ligne d'une personne dépliée : « Nouveau mot de passe » (1), « Changer le droit » (2) et « Retirer » (3).
      { nom: 'ligne', ecran: 'bureau', async jouer(c) {
        await ouvrirEquipe(c);
        await c.ev("document.querySelector('[data-equipe-ouvrir=\"u1\"]').click(); true");
        await c.attendre('[data-equipe-role="u1"]');
        await c.dort(500);
        await c.ev(FLOU);
        await c.repere('[data-pw-reset="u1"]', 1, { marge: 4 });
        await c.repere('[data-equipe-role="u1"]', 2, { marge: 4 });
        await c.repere('[data-equipe-retirer="u1"]', 3, { marge: 4 });
        await toutDansLaZone(c, ['[data-equipe-role="u1"]', '[data-pw-reset="u1"]', '[data-equipe-retirer="u1"]'], '[data-membre="u1"]');
        return c.zone('[data-membre="u1"]', 16);
      } },
      // 2. La fenêtre « Changer le droit » : la liste « Droit d'accès » (1) et « Enregistrer » (2).
      { nom: 'droit', ecran: 'bureau', async jouer(c) {
        await ouvrirEquipe(c);
        await c.ev("document.querySelector('[data-equipe-ouvrir=\"u1\"]').click(); true");
        await c.attendre('[data-equipe-role="u1"]');
        await c.ev("document.querySelector('[data-equipe-role=\"u1\"]').click(); true");
        await c.attendre('#hab-valider');
        await c.dort(700);
        await c.ev(FLOU);
        await c.repere('#hab-droit-bouton', 1, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#hab-valider', 2, { marge: 4 });
        await toutDansLaZone(c, ['#hab-droit-bouton', '#hab-valider'], '.overlay.otm-overlay .modal');
        return c.zone('.overlay.otm-overlay .modal', 14);
      } },
    ],
  },
  {
    id: 'ord-intervenant-assigne',
    etapes: [
      // 2. La fenêtre « Enregistrer une intervention » : le champ « Intervenant assigné » (1), avec une personne choisie.
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await installerOrdres(c);
        await c.ev("goTo('machines'); true");
        await c.dort(600);
        await c.ev('openLogInterventionModal(UI.machines[0]); true');
        await c.attendre('#log-operateur:not([disabled])');
        await c.dort(700);
        await c.ev(`(() => { const s = document.getElementById('log-operateur'); s.value = 'u1'; s.dispatchEvent(new Event('change', { bubbles: true })); const b = document.getElementById('log-operateur-bouton'); if (b && b.firstElementChild) b.firstElementChild.textContent = s.options[s.selectedIndex].textContent; return true; })()`);
        await c.ev(FLOU);
        await c.dort(300);
        await c.repere('#log-operateur-bouton', 1, { marge: 4 });
        const z = await c.ev(`(() => { const m = document.querySelector('.overlay.log-modal .modal').getBoundingClientRect(); const a = document.querySelector('#log-operateur').closest('.field-row').getBoundingClientRect(); const y = Math.max(0, a.top - 36); return { x: m.left + 6, y, largeur: m.width - 12, hauteur: a.bottom + 30 - y }; })()`);
        await toutDansLaZone(c, ['#log-operateur-bouton'], '.overlay.log-modal .modal');
        return z;
      } },
      // 3. L'historique des entretiens de la machine : la colonne « Opérateur / Atelier » (1) avec le nom de l'intervenant.
      { nom: 'historique', ecran: 'bureau', async jouer(c) {
        const en = c.langue === 'en';
        await installerOrdres(c);
        await installerTables(c, { interventions: [
          { id: 'i1', performed_at: jourRelatif(-12), hours_at_intervention: 1180, description: en ? 'Nothing to report' : 'RAS', items_done: en ? ['Oil change', 'greasing'] : ['Vidange', 'graissage'], performed_by: 'u1' },
          { id: 'i2', performed_at: jourRelatif(-130), hours_at_intervention: 1010, description: '', items_done: en ? ['filter check'] : ['contrôle des filtres'], performed_by: 'u2' },
        ] });
        await c.ev("openPlanView(UI.machines[0], UI.companyId, UI.categories); true");
        await c.attendre('.ref-table');
        await c.dort(900);
        await c.ev(FLOU);
        await c.marquerTexte('.ref-table th', '(Opérateur|Operator)', 'colonne');
        await c.voir('.ref-table', 'center');
        await c.repere('[data-aide="colonne"]', 1, { marge: 4 });
        await toutDansLaZone(c, ['[data-aide="colonne"]'], '#history-section');
        return c.zone('#history-section', 14);
      } },
    ],
  },
  {
    id: 'ord-habilitations',
    etapes: [
      // 1. En bas de la page des ordres : le bouton « Qualifications et habilitations ».
      { nom: 'bouton', ecran: 'bureau', async jouer(c) {
        await activerSignaturesHabilitations(c);
        await ouvrirListeOrdres(c);
        await c.voir('#hab-entree', 'center');
        await c.repere('[data-hab-ouvrir]', 1, { marge: 4 });
        await toutDansLaZone(c, ['[data-hab-ouvrir]'], '#hab-entree');
        return c.zone('#hab-entree', 16);
      } },
      // 2. L'onglet « Catalogue » : les qualifications de la société et « Ajouter ».
      { nom: 'catalogue', ecran: 'bureau', async jouer(c) {
        await ouvrirHabilitations(c, 'catalogue');
        await c.repere('[data-hab-onglet="catalogue"]', 1, { marge: 3 });
        await c.repere('[data-hab-nouvelle-qual]', 2, { marge: 4 });
        await toutDansLaZone(c, ['[data-hab-onglet="catalogue"]', '[data-hab-nouvelle-qual]'], '.hab-modal');
        return c.zone('.hab-modal', 14);
      } },
      // 3. L'onglet « Personnes » : les habilitations à renouveler bientôt (1) et « Ajouter » sur la ligne d'une personne (2).
      { nom: 'personnes', ecran: 'bureau', async jouer(c) {
        await ouvrirHabilitations(c, 'personnes');
        await c.repere('#hab-corps .otm-bloc:first-child', 1, { marge: 5 });
        await c.repere('[data-hab-ajout="u2"]', 2, { marge: 4 });
        await toutDansLaZone(c, ['#hab-corps .otm-bloc:first-child', '[data-hab-ajout="u2"]'], '.hab-modal');
        return c.zone('.hab-modal', 14);
      } },
      // 4 et 5. L'onglet « Exigences » : « Ajouter » (1) et la liste « Règle de la société » en bas de la fenêtre (2).
      { nom: 'exigences', ecran: 'bureau', async jouer(c) {
        await ouvrirHabilitations(c, 'exigences');
        await c.repere('[data-hab-nouvelle-exig]', 1, { marge: 4 });
        await c.repere('#hab-mode-bouton, #hab-mode', 2, { marge: 4 });
        await toutDansLaZone(c, ['[data-hab-nouvelle-exig]', '#hab-mode-bouton, #hab-mode'], '.hab-modal');
        return c.zone('.hab-modal', 14);
      } },
    ],
  },
  {
    id: 'ord-hors-reseau',
    etapes: [
      // 1. « Mon compte » : la case « Garder une copie pour la consultation hors connexion ».
      { nom: 'copie', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('account'); true");
        await c.attendre('#acc-hors-ligne');
        await c.dort(700);
        await c.marquer('#acc-hors-ligne', 'copie', '.check-row');
        await c.voir('#acc-hors-ligne', 'center');
        await c.repere('[data-aide="copie"]', 1, { marge: 6 });
        await c.ev(`(() => { const g = document.querySelector('#acc-hors-ligne').closest('.ui-groupe'); g.setAttribute('data-aide', 'groupe-copie'); return true; })()`);
        await toutDansLaZone(c, ['[data-aide="copie"]'], '[data-aide="groupe-copie"]');
        return c.zone('[data-aide="groupe-copie"]', 16);
      } },
      // 2. Le bandeau « Hors connexion » et son bouton « Réessayer ».
      { nom: 'bandeau', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.ev('UI.horsLigne = { depuis: Date.now() - 2 * 3600e3 }; renderApp(); true');
        await c.attendre('.offline-banner');
        await c.dort(700);
        await c.ev(FLOU);
        await c.repere('.offline-banner', 1, { marge: 3 });
        // Le bandeau est très bas : la pastille numérotée de « Réessayer » se pose à DROITE du lien (là où il n'y a que du vide), pas au-dessus du texte.
        await c.repere('#offline-retry', null, { marge: 3 });
        await badgeADroite(c, '#offline-retry', 2);
        await toutDansLaZone(c, ['.offline-banner', '#offline-retry'], '.content .view');
        return c.zoneJusqua('.offline-banner', '.offline-banner', 18);
      } },
    ],
  },
  {
    id: 'ord-signature-rapport',
    etapes: [
      // 1. En bas de la page des ordres : la case « Exiger la signature de l'exécutant après chaque intervention ».
      { nom: 'reglage', ecran: 'bureau', async jouer(c) {
        await activerSignaturesHabilitations(c);
        await ouvrirListeOrdres(c);
        await c.attendre('#sig-requise:not([disabled])');
        await c.ev("document.getElementById('sig-requise').click(); true");
        await c.dort(600);
        await c.voir('#sig-requise', 'center');
        await c.repere('#sig-reglage .check-row', 1, { marge: 6 });
        await toutDansLaZone(c, ['#sig-reglage .check-row'], '#sig-reglage');
        return c.zone('#sig-reglage', 14);
      } },
      // 2. La fenêtre « Rapport et signatures » d'une intervention non signée : « Signer (exécutant) » (1), « Faire signer un responsable » (2) et « Rapport PDF » (3).
      { nom: 'rapport', ecran: 'bureau', async jouer(c) {
        await activerSignaturesHabilitations(c);
        await ouvrirListeOrdres(c);
        await dossierIntervention(c, []);
        await c.ev("ouvrirRapportIntervention('i1'); true");
        await c.attendre('[data-rap="pdf"]');
        await c.dort(700);
        await c.ev(FLOU);
        await c.repere('[data-rap="signer-executant"]', 1, { marge: 4 });
        await c.repere('[data-rap="signer-responsable"]', 2, { marge: 4 });
        await c.repere('[data-rap="pdf"]', 3, { marge: 4 });
        await toutDansLaZone(c, ['[data-rap="signer-executant"]', '[data-rap="signer-responsable"]', '[data-rap="pdf"]'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
      // 3. La fenêtre de signature : la fonction (1), la zone « Signez ici » avec un tracé (2) et « Valider la signature » (3).
      { nom: 'signature', ecran: 'bureau', async jouer(c) {
        const en = c.langue === 'en';
        await ouvrirListeOrdres(c);
        await c.ev(`ouvrirPadSignature({ role: 'executant', titre: trad("Signer l'intervention"), sousTitre: UI.machines[0].name }); true`);
        await c.attendre('#sig-canvas');
        await c.dort(500);
        await c.ev(`(() => {
          document.getElementById('sig-fonction').value = ${JSON.stringify(en ? 'Workshop manager' : 'Chef d’atelier')};
          const cv = document.getElementById('sig-canvas'); const r = cv.getBoundingClientRect();
          const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: r.left + x, clientY: r.top + y }));
          ev('pointerdown', r.width * 0.18, r.height * 0.6);
          for (let i = 1; i <= 60; i++) ev('pointermove', r.width * (0.18 + 0.64 * i / 60), r.height * (0.55 + 0.22 * Math.sin(i / 4.5)) - (i % 13 === 0 ? 14 : 0));
          ev('pointerup', r.width * 0.82, r.height * 0.6);
          return true;
        })()`);
        await c.dort(400);
        await c.ev(FLOU);
        await c.repere('#sig-fonction', 1, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#sig-zone', 2, { marge: 4, cote: 'gauche-centre' });
        await c.repere('#sig-valider', 3, { marge: 4 });
        await toutDansLaZone(c, ['#sig-fonction', '#sig-zone', '#sig-valider'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
    ],
  },
  {
    id: 'ord-menu-introuvable',
    etapes: [
      // 1. Sur ordinateur : la rubrique « Planning » du menu (1) et l'onglet « Ordres de travail » (2).
      { nom: 'planning', ecran: 'bureau', async jouer(c) {
        await ouvrirListeOrdres(c);
        await c.ev(FLOU);
        await c.marquerTexte('.sidebar .nav-item', '^(Planning|Schedule)$', 'rubrique');
        await c.marquerTexte('.content .view button', '^(Ordres de travail|Work orders)', 'onglet');
        await c.repere('[data-aide="rubrique"]', 1, { marge: 3 });
        await c.repere('[data-aide="onglet"]', 2, { marge: 4 });
        return { x: 0, y: 0, largeur: 900, hauteur: 420 };
      } },
    ],
  },
];
