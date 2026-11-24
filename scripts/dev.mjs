#!/usr/bin/env node
/**
 * Serveur de développement (aucune dépendance) :
 *   npm run dev            -> http://localhost:8080
 *
 * Construit le site, sert dist/ comme GitHub Pages (URL propres, page 404),
 * puis reconstruit à chaque modification de content/, templates/, assets/ ou scripts/build.mjs.
 * Rechargez la page du navigateur après une modification.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

function build() {
  const t = Date.now();
  // Processus séparé : les modules de contenu sont relus à chaque build.
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr || r.stdout); return; }
  console.log(`[dev] build ok (${Date.now() - t} ms)`);
}

async function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  let file = path.normalize(path.join(dist, clean));
  if (!file.startsWith(dist)) return null; // pas de sortie du dossier dist/
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = path.join(file, 'index.html');
    await stat(file);
    return file;
  } catch {
    return null;
  }
}

build();

createServer(async (req, res) => {
  const pathname = req.url.split('?')[0];
  // Comme GitHub Pages : /projets -> /projets/
  if (!path.extname(pathname) && !pathname.endsWith('/')) {
    const dir = await resolve(pathname + '/');
    if (dir) { res.writeHead(301, { Location: pathname + '/' }); res.end(); return; }
  }
  const file = await resolve(pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    res.end(await readFile(path.join(dist, '404.html')).catch(() => 'Not found'));
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(await readFile(file));
}).listen(port, () => console.log(`[dev] http://localhost:${port}`));

let timer = null;
for (const dir of ['content', 'templates', 'assets', 'scripts']) {
  watch(path.join(root, dir), { recursive: true }, (_, name) => {
    if (name && name.endsWith('dev.mjs')) return;
    clearTimeout(timer);
    timer = setTimeout(build, 150);
  });
}
