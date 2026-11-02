// Mini-serveur statique pour les captures : sert le dossier du site sur un port libre (aucun service d'arrière-plan à lancer à la main).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };

export function demarrerServeur(racine) {
  const serveur = http.createServer(async (req, res) => {
    try {
      let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (chemin.endsWith('/')) chemin += 'index.html';
      const complet = normalize(join(racine, chemin));
      if (!complet.startsWith(normalize(racine + sep)) && complet !== normalize(racine)) { res.writeHead(403).end(); return; }
      const donnees = await readFile(complet);
      res.writeHead(200, { 'Content-Type': TYPES[extname(complet).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(donnees);
    } catch (e) { res.writeHead(404).end('introuvable'); }
  });
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok({ port: serveur.address().port, fermer: () => serveur.close() })));
}
