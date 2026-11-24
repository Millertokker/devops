/**
 * Gabarit commun à toutes les pages : <head> (SEO, CSP), en-tête, pied de page.
 * Écrit une seule fois : modifier le menu ou le pied de page met à jour tout le site.
 */
import { esc, join, safeUrl, icon } from './lib.js';

/** Script inline unique du site (hash ajouté à la CSP par le build). */
export const INLINE_SCRIPT = "document.documentElement.classList.add('js')";

const NAV = [
  { key: 'about', href: '/a-propos/', label: 'À propos' },
  { key: 'skills', href: '/competences/', label: 'Compétences' },
  { key: 'projects', href: '/projets/', label: 'Projets' },
];

const FOOTER_NAV = [
  { href: '/', label: 'Accueil' },
  ...NAV,
  { href: '/contact/', label: 'Contact' },
];

function head(c, page, csp) {
  const { site } = c;
  const base = site.url.replace(/\/+$/, '');
  const url = base + page.path;
  const image = `${base}/${site.ogImage}`;
  const graph = { '@context': 'https://schema.org', '@graph': page.jsonld };
  const ld = JSON.stringify(graph).replace(/</g, '\\u003c');
  const scripts = ['/assets/js/ui.js', ...(page.scripts || [])];

  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${esc(csp)}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <script>${INLINE_SCRIPT}</script>
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}">
  <meta name="author" content="${esc(site.name)}">
  <meta name="robots" content="${page.noindex ? 'noindex' : 'index, follow, max-image-preview:large'}">
  ${page.noindex ? '' : `<link rel="canonical" href="${esc(url)}">`}
  <meta property="og:type" content="${esc(page.ogType || 'website')}">
  <meta property="og:site_name" content="${esc(site.name)}">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(page.description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(c.seo.ogImageAlt)}">
  <meta property="og:locale" content="fr_FR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(page.title)}">
  <meta name="twitter:description" content="${esc(page.description)}">
  <meta name="twitter:image" content="${esc(image)}">
  <script type="application/ld+json">${ld}</script>
  <meta name="theme-color" content="#FFFFFF">
  <meta name="color-scheme" content="light">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="preload" href="/assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/css/styles.css">
  ${join(scripts, (s) => `<script src="${esc(s)}" defer></script>`)}
</head>`;
}

function header(page) {
  const current = (key) => (page.nav === key ? ' aria-current="page"' : '');
  return `
  <a class="skip-link" href="#main">Aller au contenu</a>
  <header class="site-header" data-header>
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="NIAINA Andriharisoa, accueil"${page.nav === 'home' ? ' aria-current="page"' : ''}>
        <span class="brand__mark" aria-hidden="true">N</span>
        <span class="brand__name">NIAINA</span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
        <span class="nav-toggle__bars" aria-hidden="true"></span>
        <span>Menu</span>
      </button>
      <nav id="site-nav" class="site-nav" aria-label="Navigation principale" data-nav>
        <ul role="list">
          ${join(NAV, (n) => `<li><a href="${n.href}"${current(n.key)}>${esc(n.label)}</a></li>`)}
        </ul>
        <a class="btn btn--primary btn--sm" href="/contact/"${current('contact')}>Me contacter</a>
      </nav>
    </div>
  </header>`;
}

function footer(c) {
  const { github, linkedin } = c.site.contact;
  const social = [];
  if (linkedin) social.push(`<li><a href="${safeUrl(linkedin)}" rel="me noopener">LinkedIn</a></li>`);
  if (github) social.push(`<li><a href="${safeUrl(github)}" rel="me noopener">GitHub</a></li>`);
  return `
  <footer class="site-footer">
    <div class="container footer-inner">
      <p><strong>${esc(c.site.name)}</strong><span class="muted"> · ${esc(c.footer.tagline)}</span></p>
      <nav aria-label="${esc(c.ui.footerNav)}">
        <ul class="footer-links" role="list">
          ${join(FOOTER_NAV, (n) => `<li><a href="${n.href}">${esc(n.label)}</a></li>`)}${social.join('')}
        </ul>
      </nav>
      <p class="muted">© ${new Date().getFullYear()} ${esc(c.site.name)}</p>
    </div>
  </footer>
  <a class="to-top" href="#main" aria-label="${esc(c.ui.backToTop)}" data-to-top>${icon('arrowUp', 'icon to-top__icon')}</a>`;
}

/** Fil d'Ariane visible (le JSON-LD BreadcrumbList est produit par les pages). */
export function breadcrumbs(items) {
  return `<nav class="breadcrumb" aria-label="Fil d’Ariane"><ol role="list">${join(items, (b, i) =>
    i === items.length - 1
      ? `<li><span aria-current="page">${esc(b.label)}</span></li>`
      : `<li><a href="${b.href}">${esc(b.label)}</a></li>`,
  )}</ol></nav>`;
}

export function layout(c, page, csp) {
  return `<!doctype html>
<html lang="fr">
${head(c, page, csp)}
<body>${header(page)}
  <main id="main">
${page.body}
  </main>${footer(c)}
</body>
</html>
`;
}
