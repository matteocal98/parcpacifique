// Pilote d'Edge SANS FENÊTRE (protocole DevTools, aucune dépendance) pour fabriquer les captures du centre d'aide.
// Un profil NEUF et jetable à chaque lancement : aucune session, aucun cookie, aucune donnée réelle — l'application affiche seulement le parc fictif
// que lui injecte etat-fictif.js. Dérivé de l'outil des vidéos de démonstration (Video/outils-montage/cdp.mjs).
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const dort = (ms) => new Promise((r) => setTimeout(r, ms));
const EDGE = process.env.EDGE_EXE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

export async function ouvrir({ largeur = 1440, hauteur = 900, echelle = 2, mobile = false, port = 9461 } = {}) {
  const profil = join(tmpdir(), 'kalea-aide-' + Date.now());
  mkdirSync(profil, { recursive: true });
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run', '--hide-scrollbars', '--disable-extensions', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 60 && !page; i++) {
    await dort(400);
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch (e) { /* pas encore prêt */ }
  }
  if (!page) { edge.kill(); throw new Error("Edge ne répond pas (chemin : " + EDGE + ")"); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const attente = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && attente.has(d.id)) { attente.get(d.id)(d); attente.delete(d.id); } });
  const envoie = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id;
    attente.set(n, (d) => (d.error ? rej(new Error(method + ' : ' + d.error.message)) : res(d.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const ev = async (expression) => {
    const r = await envoie('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result.value;
  };
  await envoie('Page.enable');
  await envoie('Emulation.setDeviceMetricsOverride', { width: largeur, height: hauteur, deviceScaleFactor: echelle, mobile });
  if (mobile) await envoie('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }).catch(() => {});
  const aller = async (url) => { await envoie('Page.navigate', { url }); await dort(600); };
  const fermer = async () => {
    try { ws.close(); } catch (e) { /* ignoré */ }
    edge.kill();
    await dort(600);
    try { rmSync(profil, { recursive: true, force: true }); } catch (e) { /* ignoré */ }
  };
  return { envoie, ev, aller, fermer };
}

// Capture d'un rectangle (en pixels CSS de la page) ; webp : léger et accepté par tous les navigateurs actuels.
export async function photoZone(b, chemin, zone) {
  const r = await b.envoie('Page.captureScreenshot', { format: 'webp', quality: 88, captureBeyondViewport: false, clip: { x: zone.x, y: zone.y, width: zone.largeur, height: zone.hauteur, scale: 1 } });
  writeFileSync(chemin, Buffer.from(r.data, 'base64'));
  return zone;
}
