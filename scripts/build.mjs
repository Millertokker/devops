#!/usr/bin/env node
/**
 * Générateur du site statique (Node >= 18, aucune dépendance).
 *
 *   node scripts/build.mjs        (ou : npm run build)
 *
 * Lit content/ et templates/, puis écrit le site complet dans dist/ :
 *   - une page HTML par route (accueil, à propos, compétences, projets, un dossier par projet, contact, 404),
 *     avec SEO, données structurées et CSP propres à chaque page,
 *   - les ressources statiques (assets/, favicon, manifest),
 *   - sitemap.xml, robots.txt, _headers, CNAME et .nojekyll.
 *
 * dist/ est entièrement régénéré à chaque build. Il n'est pas versionné : le workflow GitHub Pages le publie.
 */
import { mkdir, writeFile, rm, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import content from '../content/fr.js';
import { layout, INLINE_SCRIPT } from '../templates/layout.js';
import { buildPages } from '../templates/pages.js';
import { esc } from '../templates/lib.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const { site } = content;
const base = site.url.replace(/\/+$/, '');
const abs = (p) => `${base}/${String(p).replace(/^\/+/, '')}`;
const today = new Date().toISOString().slice(0, 10);
const started = Date.now();

const warnings = [];
for (const key of ['email', 'github', 'linkedin']) {
  if (!site.contact[key]) warnings.push(`site.contact.${key} n'est pas configuré (élément masqué).`);
}

/* ------------------------------------------------------------------ CSP */

const formOrigin = site.contact.formEndpoint ? new URL(site.contact.formEndpoint).origin : '';
const scriptHash = `'sha256-${createHash('sha256').update(INLINE_SCRIPT).digest('base64')}'`;

/**
 * Politique de sécurité. En <meta> (GitHub Pages n'autorise pas d'en-têtes HTTP),
 * frame-ancestors n'est pas supporté, et upgrade-insecure-requests casserait le site
 * tant qu'un certificat HTTPS n'est pas émis : ces directives ne vont que dans _headers.
 */
function csp({ meta }) {
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHash}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${formOrigin ? ` ${formOrigin}` : ''}`,
    `form-action 'self'${formOrigin ? ` ${formOrigin}` : ''}`,
    ...(meta ? [] : ["frame-ancestors 'none'"]),
    "base-uri 'self'",
    "object-src 'none'",
    ...(meta ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

/* --------------------------------------------------------------- Pages */

// Sécurité : on ne supprime que le dossier dist/ du projet.
if (path.basename(dist) !== 'dist' || path.dirname(dist) !== root) throw new Error(`Chemin de sortie inattendu : ${dist}`);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const pages = buildPages(content);
const metaCsp = csp({ meta: true });
for (const page of pages) {
  const file = page.file || path.join(page.path.replace(/^\/+/, ''), 'index.html');
  const target = path.join(dist, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, layout(content, page, metaCsp));
}
console.log(`✔ ${pages.length} pages générées`);

/* ---------------------------------------------------- Fichiers statiques */

await cp(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
for (const f of ['favicon.svg', 'favicon.ico', 'site.webmanifest']) {
  await cp(path.join(root, f), path.join(dist, f));
}
console.log('✔ assets, favicon, manifest');

/* ------------------------------------------------- sitemap / robots */

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .filter((p) => !p.noindex)
  .map((p) => `  <url>\n    <loc>${esc(base + p.path)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
  .join('\n')}
</urlset>
`;
await writeFile(path.join(dist, 'sitemap.xml'), sitemap);
await writeFile(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`);
console.log(`✔ sitemap.xml (${pages.filter((p) => !p.noindex).length} URL), robots.txt`);

/* ---------------------------------------------------- en-têtes HTTP */

await writeFile(path.join(dist, '_headers'), `# Généré par scripts/build.mjs. Utilisé par Netlify ou Cloudflare Pages (ignoré par GitHub Pages).
/*
  Content-Security-Policy: ${csp({ meta: false })}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin

/assets/*
  Cache-Control: public, max-age=3600, must-revalidate
`);

/* ------------------------------------------------------- GitHub Pages */

await writeFile(path.join(dist, 'CNAME'), `${new URL(base).host}\n`);
await writeFile(path.join(dist, '.nojekyll'), '');
console.log(`✔ _headers, CNAME (${new URL(base).host}), .nojekyll`);

console.log(`Terminé en ${Date.now() - started} ms → dist/`);
for (const w of warnings) console.warn(`⚠ ${w}`);
