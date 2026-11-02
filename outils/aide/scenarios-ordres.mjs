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
async function installerOrdres(c) {
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
    const historique = [
      { action: 'ot_demarrer', personne: 'Jean DUPONT', details: {}, quand: new Date(Date.now() - 3 * 3600e3).toISOString() },
      { action: 'ot_assigne', personne: 'Camille MARTIN', details: { a: 'u1' }, quand: new Date(Date.now() - 26 * 3600e3).toISOString() },
      { action: 'ot_cree', personne: 'Camille MARTIN', details: {}, quand: new Date(Date.now() - 27 * 3600e3).toISOString() },
    ];
    const rendre = (donnees) => { const b = { select() { return b; }, eq() { return b; }, in() { return b; }, order() { return b; }, limit() { return b; }, single() { return b; }, maybeSingle() { return b; }, then(res) { res({ data: donnees, error: null, count: donnees.length }); } }; return b; };
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
async function ouvrirListeOrdres(c) {
  await installerOrdres(c);
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
];
