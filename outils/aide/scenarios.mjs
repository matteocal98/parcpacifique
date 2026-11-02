// Les scénarios de capture du centre d'aide. Chaque ÉTAPE ouvre un écran de l'application avec le parc fictif, pose des repères rouges numérotés, et renvoie la zone à photographier.
// Les numéros des repères correspondent aux numéros des étapes écrites dans l'article (outils/aide/articles.mjs). Les libellés cités dans les articles sont vérifiés
// contre l'application par outils/aide/verifier-libelles.mjs.
// Règle : on défile UNE fois (voir), on pose TOUS les repères, puis on vérifie qu'ils sont bien dans la zone photographiée (sinon la capture échoue au lieu de tromper).

const MACHINE = "UI.machines.find((m) => m.id === 'm1')";
const OUVRIR_MODIFIER = `openMachineModal(UI.companyId, UI.categories, ${MACHINE})`;
const CARTE = 'article.mstrip:has([data-open="edit"][data-id="m1"])';

// Ouvre la fenêtre « Modifier une machine » sur la machine de démonstration, prête à photographier.
async function fenetreModifier(c) {
  await c.ev("goTo('machines'); true");
  await c.dort(500);
  await c.ev(OUVRIR_MODIFIER + '; true');
  await c.attendre('#f-serial');
  await c.dort(700);
}
// Échoue si un élément repéré sort de la zone photographiée.
async function toutDansLaZone(c, selecteurs, zone) {
  const dehors = await c.horsZone(selecteurs, zone);
  if (dehors.length) throw new Error('éléments repérés hors de la zone photographiée : ' + dehors.join(', '));
}

export const SCENARIOS = [
  {
    id: 'modifier-machine',
    etapes: [
      // 1. La carte de la machine et sa roue « Modifier la machine ».
      { nom: 'carte', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('machines'); true");
        await c.attendre('[data-open="edit"][data-id="m1"]');
        await c.dort(500);
        await c.repere('[data-open="edit"][data-id="m1"]', 1);
        return c.zone(CARTE, 16);
      } },
      // 2. La fenêtre « Modifier une machine » : le champ « N° de série » et « Enregistrer les modifications ».
      { nom: 'fenetre', ecran: 'bureau', async jouer(c) {
        await fenetreModifier(c);
        await c.voir('#f-serial');
        await c.repere('#f-serial', 1, { cote: 'gauche-centre' });
        await c.repere('#submit-add', 2, { cote: 'droite' });
        await toutDansLaZone(c, ['#f-serial', '#submit-add'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
    ],
  },
  {
    id: 'carnet-entretien',
    etapes: [
      // 1. Dans « Modifier la machine » : la zone de dépôt, « Photographier le carnet » et « Voir le carnet actuel (PDF) ».
      { nom: 'fenetre-carnet', ecran: 'bureau', async jouer(c) {
        await fenetreModifier(c);
        await c.voir('.overlay .dz-zone');
        await c.repere('.overlay .dz-zone', 1, { cote: 'gauche-centre' });
        await c.repere('#btn-camera', 2);
        await c.repere('#modal-view-manual', 3);
        await toutDansLaZone(c, ['.overlay .dz-zone', '#btn-camera', '#modal-view-manual'], '.overlay .modal');
        // On s'arrête sous « Photographier le carnet » : ce qui suit est un encadré commercial avec un prix, qui n'a rien à faire dans l'aide.
        return c.zoneJusqua('.overlay .modal', '#btn-camera', 26);
      } },
      // 2. L'écran « Plans d'entretien » : « Déposer » / « Remplacer » sur la ligne de la machine.
      { nom: 'plans', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('manuals'); true");
        await c.attendre('#view-root .ui-btn-teinte');
        await c.dort(900);
        await c.marquerTexte('#view-root button.ui-btn-teinte', '^(Remplacer|Replace)$', 'remplacer');
        await c.marquerTexte('#view-root button.ui-btn-teinte', '^(Déposer|Upload)', 'deposer');
        await c.repere('[data-aide="remplacer"]', 1);
        await c.repere('[data-aide="deposer"]', 2);
        await toutDansLaZone(c, ['[data-aide="remplacer"]', '[data-aide="deposer"]'], '#view-root');
        return c.zone('#view-root', 10);
      } },
    ],
  },
  {
    id: 'photo-machine',
    etapes: [
      // « Visuel & photo du matériel » : « Choisir une photo », « Prendre une photo », puis « Enregistrer les modifications ».
      { nom: 'fenetre-photo', ecran: 'bureau', async jouer(c) {
        await fenetreModifier(c);
        await c.marquerTexte('.overlay label, .overlay button', '(Choisir une photo|Choose a photo)', 'choisir');
        await c.marquerTexte('.overlay label, .overlay button', '(Prendre une photo|Take a photo)', 'prendre');
        await c.voir('[data-aide="choisir"]');
        await c.repere('[data-aide="choisir"]', 1);
        await c.repere('[data-aide="prendre"]', 2);
        await c.repere('#submit-add', 3, { cote: 'droite' });
        await toutDansLaZone(c, ['[data-aide="choisir"]', '[data-aide="prendre"]', '#submit-add'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
    ],
  },
  {
    id: 'corriger-compteur',
    etapes: [
      // Sur la carte : le champ « Compteur » (− / +) et le bouton « OK ».
      { nom: 'carte-compteur', ecran: 'bureau', async jouer(c) {
        await c.ev("goTo('machines'); true");
        await c.attendre('#compteur-strip-m1');
        await c.dort(500);
        await c.repere('#compteur-strip-m1', 1, { marge: 7 });
        await c.repere(CARTE + ' .compteur-strip-icone.is-valider', 2);
        return c.zone(CARTE, 16);
      } },
    ],
  },
  {
    id: 'second-compteur',
    etapes: [
      // « Mode de suivi & échéances d'entretien » : la case « Ajouter un second suivi », cochée pour montrer les champs qu'elle ouvre.
      { nom: 'fenetre-second', ecran: 'bureau', async jouer(c) {
        await fenetreModifier(c);
        await c.ev("(() => { const k = document.getElementById('f-secondaire-active'); if (k && !k.checked) k.click(); return true; })()");
        await c.dort(500);
        await c.marquer('#f-secondaire-active', 'case', 'parent');
        await c.voir('#f-secondaire-valeur');
        await c.repere('[data-aide="case"]', 1, { cote: 'gauche-centre' });
        await c.repere('#f-secondaire-valeur', 2);
        await toutDansLaZone(c, ['[data-aide="case"]', '#f-secondaire-valeur'], '.overlay .modal');
        return c.zone('.overlay .modal', 14);
      } },
    ],
  },
];
