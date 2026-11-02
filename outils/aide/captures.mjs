// Fabrique les captures du centre d'aide (kalea.pro/aide), en français ET en anglais, à partir de l'application locale et du parc fictif de etat-fictif.js.
//   node outils/aide/captures.mjs               # tous les scénarios
//   node outils/aide/captures.mjs modifier-machine   # un seul
// Sortie : aide/img/<scénario>/<étape>-<fr|en>.webp  (à relancer à chaque version : les captures suivent l'interface, elles ne vieillissent pas).
//   node outils/aide/captures.mjs a,b,c         # plusieurs scénarios (identifiants séparés par des virgules)
// Les scénarios sont lus dans scenarios.mjs ET dans tous les fichiers scenarios-*.mjs de ce dossier (un par lot d'articles) : chacun exporte `SCENARIOS`.
// Variables d'environnement (pour travailler à plusieurs en parallèle sans se gêner) :
//   AIDE_PORT_CDP  port de débogage d'Edge (défaut 9461) — un port par exécution simultanée
//   AIDE_SORTIE    dossier de sortie des images ET du manifest.json (défaut aide/img) — pour les essais, un dossier à part
// Chaque scénario repart d'une page NEUVE (rechargée, parc fictif réinjecté) : ce qu'un scénario installe (fausses données, fonctions remplacées) ne contamine pas le suivant.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dort, ouvrir, photoZone } from './cdp.mjs';
import { demarrerServeur } from './serveur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..', '..');
const SORTIE = process.env.AIDE_SORTIE ? path.resolve(process.env.AIDE_SORTIE) : path.join(RACINE, 'aide', 'img');
const PORT_CDP = Number(process.env.AIDE_PORT_CDP) || 9461;
const SCENARIOS = [];
// AIDE_LOT=<nom> : ne charge que scenarios.mjs et scenarios-<nom>.mjs (un rédacteur ne dépend pas du fichier, peut-être inachevé, d'un autre).
const LOT = process.env.AIDE_LOT || '';
for (const f of readdirSync(ICI).filter((n) => /^scenarios(-.+)?\.mjs$/.test(n) && (!LOT || n === 'scenarios.mjs' || n === `scenarios-${LOT}.mjs`)).sort()) {
  const m = await import(pathToFileURL(path.join(ICI, f)).href);
  SCENARIOS.push(...(m.SCENARIOS || []));
}
const LANGUES = ['fr', 'en'];
const ECRANS = { bureau: { largeur: 1440, hauteur: 1100, echelle: 2, mobile: false }, mobile: { largeur: 390, hauteur: 844, echelle: 3, mobile: true } };
const filtres = process.argv[2] ? process.argv[2].split(',').map((x) => x.trim()).filter(Boolean) : null;

const scenarios = SCENARIOS.filter((s) => !filtres || filtres.includes(s.id));
if (!scenarios.length) { console.error('Aucun scénario « ' + filtres + ' ». Disponibles : ' + SCENARIOS.map((s) => s.id).join(', ')); process.exit(2); }
const doublons = SCENARIOS.map((s) => s.id).filter((id, i, t) => t.indexOf(id) !== i);
if (doublons.length) { console.error('Identifiants de scénario en double : ' + [...new Set(doublons)].join(', ')); process.exit(2); }

const serveur = await demarrerServeur(RACINE);
const fabriquees = [];
const echecs = [];
const manifeste = {};
try {
  for (const langue of LANGUES) {
    const b = await ouvrir({ ...ECRANS.bureau, port: PORT_CDP });
    try {
      // Langue de l'interface = celle que l'application lit au démarrage ; profil neuf, donc rien à effacer.
      await b.aller(`http://127.0.0.1:${serveur.port}/app.html`);
      await b.ev(`localStorage.setItem('parcpacific.langue', '${langue}')`);
      // Page NEUVE + parc fictif : appelé avant chaque scénario (ce qu'un scénario installe ne doit pas se retrouver dans le suivant).
      const demarrerPage = async () => {
        // La mémoire du navigateur (choix d'affichage des machines, thème sombre…) survit au rechargement : on l'efface pour qu'un scénario ne laisse rien au suivant, sauf la langue.
        await b.ev(`try { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('parcpacific.langue', '${langue}'); } catch (e) {} true`);
        await b.aller(`http://127.0.0.1:${serveur.port}/app.html`);
        await b.ev(readFileSync(path.join(ICI, 'etat-fictif.js'), 'utf8'));
        await b.ev('window.__aide.preparer()');
      };
      const ctx = {
        langue, ev: b.ev, dort,
        repere: (sel, n, opts) => b.ev(`window.__aide.repere(${JSON.stringify(sel)}, ${n == null ? 'null' : n}, ${JSON.stringify(opts || {})})`),
        zone: (sel, marge) => b.ev(`window.__aide.zone(${JSON.stringify(sel)}, ${marge == null ? 18 : marge})`),
        zoneJusqua: (sel, fin, marge) => b.ev(`window.__aide.zoneJusqua(${JSON.stringify(sel)}, ${JSON.stringify(fin)}, ${marge == null ? 18 : marge})`),
        voir: (sel, bloc) => b.ev(`window.__aide.voir(${JSON.stringify(sel)}, ${JSON.stringify(bloc || 'center')})`),
        horsZone: (sels, zone) => b.ev(`window.__aide.horsZone(${JSON.stringify(sels)}, ${JSON.stringify(zone)})`),
        marquer: (sel, nom, parent) => b.ev(`window.__aide.marquer(${JSON.stringify(sel)}, ${JSON.stringify(nom)}, ${JSON.stringify(parent || null)})`),
        marquerTexte: (portee, motif, nom, rang) => b.ev(`window.__aide.marquerTexte(${JSON.stringify(portee)}, ${JSON.stringify(motif)}, ${JSON.stringify(nom)}, ${rang || 0})`),
        attendre: async (sel, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await b.ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true; await dort(150); } throw new Error('élément absent : ' + sel); },
      };
      for (const sc of scenarios) {
        const dossier = path.join(SORTIE, sc.id);
        mkdirSync(dossier, { recursive: true });
        try {
        await demarrerPage();
        for (const etape of sc.etapes) {
          const ecran = ECRANS[etape.ecran || 'bureau'];
          await b.envoie('Emulation.setDeviceMetricsOverride', { width: ecran.largeur, height: ecran.hauteur, deviceScaleFactor: ecran.echelle, mobile: ecran.mobile });
          if (ecran.mobile) await b.envoie('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }).catch(() => {});
          else await b.envoie('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {});
          await b.ev("document.querySelectorAll('.overlay').forEach((o) => o.remove()); window.__aide.effacer(); window.scrollTo(0, 0); true");
          await dort(250);
          const zone = await etape.jouer(ctx);
          await dort(350);
          const fichier = path.join(dossier, `${etape.nom}-${langue}.webp`);
          await photoZone(b, fichier, zone);
          fabriquees.push(path.relative(RACINE, fichier).replace(/\\/g, '/'));
          // Dimensions RÉELLES de l'image (pixels CSS × échelle) : la page d'aide les déclare pour que rien ne bouge pendant le chargement.
          manifeste[`${sc.id}/${etape.nom}-${langue}`] = { largeur: Math.round(zone.largeur * ecran.echelle), hauteur: Math.round(zone.hauteur * ecran.echelle) };
          console.log(`  ✔ ${sc.id}/${etape.nom}-${langue}  (${Math.round(zone.largeur)}×${Math.round(zone.hauteur)} px CSS)`);
          await b.ev('window.__aide.effacer()');
        }
        } catch (erreur) {
          // Un scénario en échec ne bloque pas les autres : on le signale, on le retire du manifeste, et la commande se termine en erreur.
          echecs.push(`${sc.id} (${langue}) : ${erreur.message}`);
          console.log(`  ✘ ${sc.id} (${langue}) : ${erreur.message}`);
        }
      }
    } finally { await b.fermer(); }
  }
} finally { serveur.fermer(); }
// Le manifeste (taille de chaque image) est fusionné avec l'existant : relancer UN scénario ne doit pas effacer les autres.
{
  const chemin = path.join(SORTIE, 'manifest.json');
  let ancien = {};
  try { ancien = JSON.parse(readFileSync(chemin, 'utf8')); } catch (e) { /* premier passage */ }
  writeFileSync(chemin, JSON.stringify({ ...ancien, ...manifeste }, null, 1) + '\n');
}
console.log(`\n${fabriquees.length} capture(s) écrite(s) dans ${path.relative(RACINE, SORTIE).replace(/\\/g, '/') || SORTIE}/`);
if (echecs.length) { console.log(`\n${echecs.length} scénario(s) en échec :\n  - ` + echecs.join('\n  - ')); process.exit(1); }
