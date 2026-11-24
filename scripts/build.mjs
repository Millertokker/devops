#!/usr/bin/env node
/**
 * Zero-dependency build step (Node >= 18).
 *
 *   node scripts/build.mjs        (or: npm run build)
 *
 * For every locale declared in assets/js/content/site.js it:
 *   - pre-renders each [data-render] section into the HTML page (SEO, no-JS visitors),
 *   - regenerates the <head> SEO block: title, description, canonical, hreflang,
 *     Open Graph, Twitter Card and JSON-LD (Person, WebSite, ProfilePage).
 * It then writes sitemap.xml, robots.txt and _headers (security headers + CSP whose
 * script hashes are computed from the inline scripts actually present in the pages).
 *
 * The script is idempotent: running it twice produces the same files.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import site from '../assets/js/content/site.js';
import { sections, esc, hashString } from '../assets/js/render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = site.url.replace(/\/+$/, '');
const abs = (p) => `${base}/${String(p).replace(/^\/+/, '')}`;
const today = new Date().toISOString().slice(0, 10);

const warnings = [];
if (/example\.com/.test(base)) warnings.push('site.url pointe encore vers example.com : renseignez le domaine dans assets/js/content/site.js.');
for (const key of ['email', 'github', 'linkedin']) {
  if (!site.contact[key]) warnings.push(`site.contact.${key} n'est pas configuré (élément masqué).`);
}

/* ------------------------------------------------------------ SEO block */

function seoBlock(content, locale) {
  const { seo } = content;
  const pageUrl = abs(locale.path);
  const image = abs(site.ogImage);
  const sameAs = [site.contact.github, site.contact.linkedin].filter(Boolean);
  const others = site.locales.filter((l) => l !== locale);
  const defaultLocale = site.locales.find((l) => l.default) ?? site.locales[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': `${base}/#person`,
        name: site.name,
        givenName: site.givenName,
        familyName: site.familyName,
        jobTitle: site.jobTitle,
        description: seo.description,
        url: `${base}/`,
        ...(sameAs.length && { sameAs }),
        knowsAbout: seo.knowsAbout,
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: `${base}/`,
        name: site.name,
        inLanguage: site.locales.map((l) => l.lang),
        publisher: { '@id': `${base}/#person` },
      },
      {
        '@type': 'ProfilePage',
        '@id': `${pageUrl}#profilepage`,
        url: pageUrl,
        name: seo.title,
        inLanguage: locale.lang,
        isPartOf: { '@id': `${base}/#website` },
        mainEntity: { '@id': `${base}/#person` },
      },
    ],
  };
  const ld = JSON.stringify(jsonLd, null, 2).replace(/</g, '\\u003c').replace(/\n/g, '\n  ');

  const lines = [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.description)}">`,
    `<meta name="author" content="${esc(site.name)}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<link rel="canonical" href="${esc(pageUrl)}">`,
    ...(site.locales.length > 1
      ? [
          ...site.locales.map((l) => `<link rel="alternate" hreflang="${esc(l.lang)}" href="${esc(abs(l.path))}">`),
          `<link rel="alternate" hreflang="x-default" href="${esc(abs(defaultLocale.path))}">`,
        ]
      : []),
    `<meta property="og:type" content="profile">`,
    `<meta property="og:site_name" content="${esc(site.name)}">`,
    `<meta property="og:title" content="${esc(seo.title)}">`,
    `<meta property="og:description" content="${esc(seo.description)}">`,
    `<meta property="og:url" content="${esc(pageUrl)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(seo.ogImageAlt)}">`,
    `<meta property="og:locale" content="${esc(locale.ogLocale)}">`,
    ...others.map((l) => `<meta property="og:locale:alternate" content="${esc(l.ogLocale)}">`),
    `<meta property="profile:first_name" content="${esc(site.givenName)}">`,
    `<meta property="profile:last_name" content="${esc(site.familyName)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(seo.title)}">`,
    `<meta name="twitter:description" content="${esc(seo.description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    `<meta name="twitter:image:alt" content="${esc(seo.ogImageAlt)}">`,
    `<script type="application/ld+json">\n  ${ld}\n  </script>`,
  ];
  return lines.join('\n  ');
}

/* --------------------------------------------------------------- Pages */

const inlineScriptHashes = new Set();
const formOrigin = site.contact.formEndpoint ? new URL(site.contact.formEndpoint).origin : '';

/**
 * Politique de sécurité. En <meta> (GitHub Pages ne permet pas d'en-têtes HTTP),
 * les directives frame-ancestors et report-* ne sont pas supportées : elles ne
 * figurent que dans la version en-tête (_headers).
 */
function cspFor(hashes, { meta = false } = {}) {
  return [
    "default-src 'self'",
    `script-src 'self' ${[...hashes].join(' ')}`.trim(),
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src 'self'${formOrigin ? ` ${formOrigin}` : ''}`,
    `form-action 'self'${formOrigin ? ` ${formOrigin}` : ''}`,
    ...(meta ? [] : ["frame-ancestors 'none'"]),
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

for (const locale of site.locales) {
  const file = path.join(root, locale.page);
  const content = (await import(pathToFileURL(path.join(root, 'assets/js/content', `${locale.lang}.js`)).href)).default;
  let html = await readFile(file, 'utf8');

  html = html.replace(
    /<!-- build:seo -->[\s\S]*?<!-- \/build:seo -->/,
    `<!-- build:seo -->\n  ${seoBlock(content, locale)}\n  <!-- /build:seo -->`,
  );

  let count = 0;
  html = html.replace(
    /(<[a-z]+\b[^>]*?data-render="(\w+)"[^>]*?)(?: data-hash="\d+")?>\s*<!-- render:\2 -->[\s\S]*?<!-- \/render:\2 -->/g,
    (_, open, key) => {
      const fn = sections[key];
      if (!fn) throw new Error(`Unknown render key "${key}" in ${locale.page}`);
      const out = fn(content).trim();
      count++;
      return `${open} data-hash="${hashString(out)}"><!-- render:${key} -->${out}<!-- /render:${key} -->`;
    },
  );

  const pageHashes = new Set();
  for (const m of html.matchAll(/<script(?![^>]*(?:\ssrc=|type="application\/(?:ld\+)?json"))[^>]*>([\s\S]*?)<\/script>/g)) {
    const h = `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`;
    pageHashes.add(h);
    inlineScriptHashes.add(h);
  }
  html = html.replace(
    /<!-- build:csp -->[\s\S]*?<!-- \/build:csp -->/,
    `<!-- build:csp -->\n  <meta http-equiv="Content-Security-Policy" content="${esc(cspFor(pageHashes, { meta: true }))}">\n  <meta name="referrer" content="strict-origin-when-cross-origin">\n  <!-- /build:csp -->`,
  );

  await writeFile(file, html);
  console.log(`✔ ${locale.page}: ${count} sections rendered, SEO block updated`);
}

/* ------------------------------------------- police embarquée (file://) */

// Ouvert par double-clic (file://), Chrome bloque le chargement des polices.
// Le script inline de la page charge alors cette copie encodée en base64.
const font = await readFile(path.join(root, 'assets/fonts/inter-latin.woff2'));
await writeFile(
  path.join(root, 'assets/css/font-inline.css'),
  `/* Généré par scripts/build.mjs : utilisé uniquement en file://. */\n@font-face{font-family:"Inter";src:url(data:font/woff2;base64,${font.toString('base64')}) format("woff2");font-weight:400 700;font-style:normal;font-display:swap}\n`,
);
console.log('✔ assets/css/font-inline.css');

/* ------------------------------------------------- sitemap / robots */

const multi = site.locales.length > 1;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${multi ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''}>
${site.locales
  .map(
    (l) => `  <url>
    <loc>${esc(abs(l.path))}</loc>
    <lastmod>${today}</lastmod>
${multi ? site.locales.map((a) => `    <xhtml:link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(abs(a.path))}"/>\n`).join('') : ''}  </url>`,
  )
  .join('\n')}
</urlset>
`;
await writeFile(path.join(root, 'sitemap.xml'), sitemap);

await writeFile(
  path.join(root, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`,
);
console.log('✔ sitemap.xml, robots.txt');

/* ---------------------------------------------------- security headers */

const csp = cspFor(inlineScriptHashes);

const headers = `# Généré par scripts/build.mjs, ne pas modifier à la main.
# Format: Netlify / Cloudflare Pages. See README.md for an Nginx equivalent.
/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin

/*.html
  Cache-Control: no-cache

/
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=3600, must-revalidate
`;
await writeFile(path.join(root, '_headers'), headers);
console.log('✔ _headers (CSP script hashes:', [...inlineScriptHashes].length, ')');

/* ------------------------------------------------------- GitHub Pages */

// CNAME : domaine personnalisé. .nojekyll : fichiers servis tels quels (pas de Jekyll).
await writeFile(path.join(root, 'CNAME'), `${new URL(base).host}\n`);
await writeFile(path.join(root, '.nojekyll'), '');
console.log('✔ CNAME (' + new URL(base).host + '), .nojekyll');

for (const w of warnings) console.warn(`⚠ ${w}`);
