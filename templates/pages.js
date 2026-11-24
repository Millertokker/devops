/**
 * Définition de chaque page du site : chemin, métadonnées SEO, données structurées et contenu.
 * buildPages(content) renvoie la liste des pages que le build écrit dans dist/.
 */
import { esc, join, safeUrl, icon, jsonBlock, projectUrl } from './lib.js';
import { breadcrumbs } from './layout.js';

/* ------------------------------------------------------------ Composants */

const checklist = (items) => `<ul class="checklist" role="list">${join(items, (s) => `<li>${esc(s)}</li>`)}</ul>`;

const statusBadge = (status, ui) =>
  `<span class="status status--${esc(status)}">${esc(ui.statusLabels[status] ?? status)}</span>`;

const stackList = (stack) =>
  `<ul class="project__stack" role="list" aria-label="Technologies">${join(stack, (t) => `<li>${esc(t)}</li>`)}</ul>`;

function pageHead(c, { crumbs, heading, lede, id = 'page-title' }) {
  return `
    <header class="page-head">
      <div class="container">
        ${crumbs ? breadcrumbs(crumbs) : ''}
        <h1 id="${id}">${esc(heading)}</h1>
        ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
      </div>
    </header>`;
}

function projectCard(item, ui, level) {
  const h = `h${level}`;
  return `
      <article class="project" aria-labelledby="card-${esc(item.id)}">
        <div class="project__top">
          <span class="icon-tile">${icon(item.icon)}</span>
          ${statusBadge(item.status, ui)}
        </div>
        <${h} class="project__title" id="card-${esc(item.id)}"><a class="project__link" href="${projectUrl(item)}">${esc(item.title)}</a></${h}>
        <p class="project__summary">${esc(item.summary)}</p>
        ${stackList(item.stack)}
        <span class="project__more" aria-hidden="true">${esc(ui.caseStudy)} ${icon('arrow', 'icon icon--sm')}</span>
      </article>`;
}

function contactActions(c, { withPageLink = false } = {}) {
  const { email, github, linkedin, cv } = c.site.contact;
  const L = c.ui.contactLabels;
  const out = [];
  if (email) out.push(`<a class="btn btn--light" href="mailto:${safeUrl(email)}">${icon('mail', 'icon icon--sm')}${esc(email)}</a>`);
  if (linkedin) out.push(`<a class="btn btn--ghost" href="${safeUrl(linkedin)}" rel="me noopener">${icon('linkedin', 'icon icon--sm')}${esc(L.linkedin)}</a>`);
  if (github) out.push(`<a class="btn btn--ghost" href="${safeUrl(github)}" rel="me noopener">${icon('github', 'icon icon--sm')}${esc(L.github)}</a>`);
  if (cv) out.push(`<a class="btn btn--ghost" href="${safeUrl(cv)}" download>${icon('download', 'icon icon--sm')}${esc(L.cvAction)}</a>`);
  if (withPageLink) out.push(`<a class="btn btn--ghost" href="/contact/">${esc(c.ui.contactPageLink)}</a>`);
  return out.join('');
}

/** LinkedIn, GitHub et CV sur fond clair (page contact). */
function otherChannels(c) {
  const { github, linkedin, cv } = c.site.contact;
  const L = c.ui.contactLabels;
  const out = [];
  if (linkedin) out.push(`<a class="btn btn--outline" href="${safeUrl(linkedin)}" rel="me noopener">${icon('linkedin', 'icon icon--sm')}${esc(L.linkedin)}</a>`);
  if (github) out.push(`<a class="btn btn--outline" href="${safeUrl(github)}" rel="me noopener">${icon('github', 'icon icon--sm')}${esc(L.github)}</a>`);
  if (cv) out.push(`<a class="btn btn--outline" href="${safeUrl(cv)}" download>${icon('download', 'icon icon--sm')}${esc(L.cvAction)}</a>`);
  return out.length ? `<div class="actions actions--secondary">${out.join('')}</div>` : '';
}

/** Bandeau de contact en bas des pages. */
function ctaBand(c) {
  return `
    <section class="section" aria-labelledby="cta-title">
      <div class="container">
        <div class="cta">
          <div class="cta__text">
            <span class="icon-tile icon-tile--dark">${icon('mail')}</span>
            <h2 id="cta-title">${esc(c.contact.title)}</h2>
            <p>${esc(c.contact.text)}</p>
            <div class="actions">${contactActions(c)}</div>
          </div>
        </div>
      </div>
    </section>`;
}

/* ------------------------------------------------------ Données structurées */

function graph(c, page, extra = []) {
  const base = c.site.url.replace(/\/+$/, '');
  const { site } = c;
  const sameAs = [site.contact.github, site.contact.linkedin].filter(Boolean);
  const nodes = [
    {
      '@type': 'Person',
      '@id': `${base}/#person`,
      name: site.name,
      givenName: site.givenName,
      familyName: site.familyName,
      jobTitle: site.jobTitle,
      description: c.seo.description,
      url: `${base}/`,
      ...(site.contact.email && { email: `mailto:${site.contact.email}` }),
      ...(sameAs.length && { sameAs }),
      knowsAbout: c.seo.knowsAbout,
    },
    {
      '@type': 'WebSite',
      '@id': `${base}/#website`,
      url: `${base}/`,
      name: site.name,
      inLanguage: 'fr',
      publisher: { '@id': `${base}/#person` },
    },
    ...extra,
  ];
  if (page.crumbs) {
    nodes.push({
      '@type': 'BreadcrumbList',
      itemListElement: page.crumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.label,
        item: base + (b.href || page.path),
      })),
    });
  }
  return nodes;
}

function webPage(c, type, page, more = {}) {
  const base = c.site.url.replace(/\/+$/, '');
  return {
    '@type': type,
    '@id': `${base}${page.path}#page`,
    url: base + page.path,
    name: page.title,
    description: page.description,
    inLanguage: 'fr',
    isPartOf: { '@id': `${base}/#website` },
    ...more,
  };
}

/* ------------------------------------------------------------------ Pages */

function home(c) {
  const h = c.hero;
  const q = c.quicklinks;
  const counts = { domains: c.expertise.domains.length, projects: c.projects.items.length };
  const fill = (t) => t.replace(/\{(\w+)\}/g, (_, k) => counts[k] ?? '');
  const featured = c.projects.items.filter((p) => p.featured);
  const page = { key: 'home', path: '/', nav: 'home', ogType: 'profile', ...c.pages.home };

  page.body = `
    <section class="hero" aria-labelledby="hero-title">
      <div class="container hero__grid">
        <div class="hero__copy">
          <p class="hero__role">${esc(h.role)}</p>
          <h1 id="hero-title">${esc(h.title)}</h1>
          <p class="hero__sub">${esc(h.sub)}</p>
          <div class="actions">
            <a class="btn btn--primary btn--lg" href="${h.primary.href}">${esc(h.primary.label)}</a>
            <a class="btn btn--outline btn--lg" href="${h.secondary.href}">${esc(h.secondary.label)}</a>
          </div>
          <ul class="hero__stack" role="list" aria-label="Technologies principales">${join(h.stack, (s) => `<li>${esc(s)}</li>`)}</ul>
        </div>
        <nav class="quick" aria-labelledby="quick-title">
          <h2 class="quick__title" id="quick-title">${esc(q.title)}</h2>
          <ul class="quick__list" role="list">
            ${join(q.items, (it) => `
            <li>
              <a class="quick__link" href="${it.href}">
                <span class="icon-tile">${icon(it.icon)}</span>
                <span class="quick__text"><strong>${esc(it.label)}</strong><span>${esc(fill(it.meta))}</span></span>
                ${icon('arrow', 'icon quick__arrow')}
              </a>
            </li>`)}
          </ul>
        </nav>
      </div>
    </section>

    <section class="section" aria-labelledby="featured-title">
      <div class="container">
        <header class="section-head section-head--row">
          <div>
            <h2 id="featured-title">${esc(c.home.featuredTitle)}</h2>
            <p class="lede">${esc(c.home.featuredLede)}</p>
          </div>
          <a class="link-more" href="/projets/">${esc(c.home.featuredLink)} ${icon('arrow', 'icon icon--sm')}</a>
        </header>
        <div class="projects">${join(featured, (p) => projectCard(p, c.ui, 3))}
        </div>
      </div>
    </section>

    <section class="section section--surface" aria-labelledby="domains-title">
      <div class="container">
        <header class="section-head section-head--row">
          <h2 id="domains-title">${esc(c.home.domainsTitle)}</h2>
          <a class="link-more" href="/competences/">${esc(c.home.domainsLink)} ${icon('arrow', 'icon icon--sm')}</a>
        </header>
        <ul class="domains" role="list">
          ${join(c.expertise.domains, (d) => `
          <li class="domain-card">
            <span class="icon-tile">${icon(d.icon)}</span>
            <div><h3>${esc(d.title)}</h3><p>${esc(d.items.slice(0, 4).join(' · '))}</p></div>
          </li>`)}
        </ul>
      </div>
    </section>
${ctaBand(c)}`;

  page.jsonld = graph(c, page, [webPage(c, 'ProfilePage', page, { mainEntity: { '@id': `${c.site.url}/#person` } })]);
  return page;
}

function about(c) {
  const m = c.pages.about;
  const a = c.about;
  const x = c.experience;
  const page = { key: 'about', path: '/a-propos/', nav: 'about', ...m };
  page.crumbs = [{ label: c.ui.home, href: '/' }, { label: m.heading }];

  page.body = `${pageHead(c, { crumbs: page.crumbs, heading: m.heading, lede: m.lede })}
    <section class="section" aria-labelledby="bio-title">
      <div class="container about">
        <div class="about__text">
          <h2 id="bio-title" class="visually-hidden">Présentation</h2>
          ${join(a.paragraphs, (p) => `<p>${esc(p)}</p>`)}
        </div>
        <div class="panel">
          <h2 class="panel__title">${esc(a.strengthsTitle)}</h2>
          ${checklist(a.strengths)}
        </div>
      </div>
    </section>

    <section class="section section--surface" aria-labelledby="experience-title">
      <div class="container">
        <header class="section-head"><h2 id="experience-title">${esc(x.title)}</h2></header>
        <div class="experience">
          ${x.entries.length ? `
          <div class="panel panel--wide">
            <h3 class="panel__title">${esc(x.rolesTitle)}</h3>
            <ol class="timeline" role="list">${join(x.entries, (e) => `
              <li><p class="timeline__dates">${esc(e.start)}${e.end ? ` ${esc(c.ui.dateTo)} ${esc(e.end)}` : ''}</p>
              <div><h4>${esc(e.role)}${e.organization ? `<span class="muted">, ${esc(e.organization)}</span>` : ''}</h4>${e.summary ? `<p>${esc(e.summary)}</p>` : ''}</div></li>`)}
            </ol>
          </div>` : ''}
          <div class="panel">
            <h3 class="panel__title">${esc(x.responsibilitiesTitle)}</h3>
            ${checklist(x.responsibilities)}
          </div>
          <div class="panel">
            <h3 class="panel__title">${esc(x.principlesTitle)}</h3>
            <ul class="principles" role="list">${join(x.principles, (p) => `<li><strong>${esc(p.title)}</strong><span>${esc(p.text)}</span></li>`)}</ul>
          </div>
        </div>
      </div>
    </section>
${ctaBand(c)}`;

  page.jsonld = graph(c, page, [webPage(c, 'AboutPage', page, { mainEntity: { '@id': `${c.site.url}/#person` } })]);
  return page;
}

function skills(c) {
  const m = c.pages.skills;
  const page = { key: 'skills', path: '/competences/', nav: 'skills', ...m };
  page.crumbs = [{ label: c.ui.home, href: '/' }, { label: m.heading }];

  page.body = `${pageHead(c, { crumbs: page.crumbs, heading: m.heading, lede: m.lede })}
    <section class="section section--tight" aria-label="${esc(m.heading)}">
      <div class="container">
        <ul class="skills" role="list">
          ${join(c.expertise.domains, (d) => `
          <li class="skills__row">
            <div class="skills__name">
              <span class="icon-tile">${icon(d.icon)}</span>
              <h2>${esc(d.title)}</h2>
            </div>
            <ul class="tags" role="list">${join(d.items, (t) => `<li>${esc(t)}</li>`)}</ul>
          </li>`)}
        </ul>
      </div>
    </section>
${ctaBand(c)}`;

  page.jsonld = graph(c, page, [webPage(c, 'WebPage', page)]);
  return page;
}

function projects(c) {
  const m = c.pages.projects;
  const page = { key: 'projects', path: '/projets/', nav: 'projects', ...m };
  page.crumbs = [{ label: c.ui.home, href: '/' }, { label: m.heading }];
  const base = c.site.url.replace(/\/+$/, '');

  page.body = `${pageHead(c, { crumbs: page.crumbs, heading: m.heading, lede: m.lede })}
    <section class="section section--tight" aria-label="${esc(m.heading)}">
      <div class="container">
        <div class="projects">${join(c.projects.items, (p) => projectCard(p, c.ui, 2))}
        </div>
      </div>
    </section>
${ctaBand(c)}`;

  page.jsonld = graph(c, page, [webPage(c, 'CollectionPage', page, {
    hasPart: c.projects.items.map((p) => ({ '@id': `${base}${projectUrl(p)}#article` })),
  })]);
  return page;
}

/** Description pour les moteurs de recherche : résumé + technologies principales, 160 caractères au plus. */
function describe(item) {
  let text = item.summary;
  for (let n = Math.min(5, item.stack.length); n >= 2; n--) {
    const candidate = `${item.summary} Stack : ${item.stack.slice(0, n).join(', ')}.`;
    if (candidate.length <= 160) { text = candidate; break; }
  }
  return text.length > 160 ? `${text.slice(0, 157).replace(/\s+\S*$/, '')}…` : text;
}

function project(c, item, index) {
  const ui = c.ui;
  const items = c.projects.items;
  const prev = items[(index - 1 + items.length) % items.length];
  const next = items[(index + 1) % items.length];
  const base = c.site.url.replace(/\/+$/, '');
  const page = {
    key: `project:${item.id}`,
    path: projectUrl(item),
    nav: 'projects',
    ogType: 'article',
    title: `${item.title} | Projet DevOps de NIAINA Andriharisoa`,
    description: describe(item),
    scripts: item.simulation ? ['/assets/js/sim.js'] : [],
  };
  page.crumbs = [{ label: ui.home, href: '/' }, { label: c.pages.projects.heading, href: '/projets/' }, { label: item.title }];

  const block = (title, text, id) => (text ? `<h2 id="${id}">${esc(title)}</h2><p class="case__text">${esc(text)}</p>` : '');

  page.body = `
    <header class="page-head page-head--project">
      <div class="container">
        ${breadcrumbs(page.crumbs)}
        <div class="project__top project__top--hero">
          <span class="icon-tile icon-tile--lg">${icon(item.icon)}</span>
          ${statusBadge(item.status, ui)}
        </div>
        <h1 id="page-title">${esc(item.title)}</h1>
        <p class="lede">${esc(item.summary)}</p>
      </div>
    </header>

    <section class="section section--tight" aria-labelledby="scope-title">
      <div class="container case">
        <div class="case__main">
          ${block(ui.contextTitle, item.context, 'context-title')}
          <h2 id="scope-title">${esc(ui.scopeTitle)}</h2>
          ${checklist(item.scope)}
          ${block(ui.outcomeTitle, item.outcome, 'outcome-title')}
          ${item.simulation ? `<p class="case__jump"><a class="btn btn--primary" href="#simulation">${icon('play', 'icon icon--sm icon--fill')}${esc(ui.sim.open)}</a></p>` : ''}
        </div>
        <aside class="panel case__aside" aria-label="${esc(ui.stackTitle)}">
          <h2 class="panel__title">${esc(ui.stackTitle)}</h2>
          <ul class="tags" role="list">${join(item.stack, (t) => `<li>${esc(t)}</li>`)}</ul>
          <h2 class="panel__title panel__title--spaced">${esc(ui.statusTitle)}</h2>
          ${statusBadge(item.status, ui)}
          ${item.repo ? `<p><a class="link" href="${safeUrl(item.repo)}" rel="noopener">${esc(ui.repoLabel)} ${icon('external', 'icon icon--sm')}</a></p>` : ''}
        </aside>
      </div>
    </section>

    ${item.simulation ? `
    <section class="section section--surface" id="simulation" aria-labelledby="sim-heading">
      <div class="container">
        <header class="section-head">
          <h2 id="sim-heading">${esc(ui.simTitle)}</h2>
          <p class="lede">${esc(ui.simLede)}</p>
        </header>
        <div class="sim-host" data-sim-inline="sim-data-${esc(item.id)}"><noscript><p class="sim-host__noscript">${esc(ui.simNoscript)}</p></noscript></div>
        ${jsonBlock(`sim-data-${item.id}`, { title: item.title, status: item.status, ...item.simulation })}
        ${jsonBlock('sim-ui', ui.sim)}
      </div>
    </section>` : ''}

    <nav class="section section--tight" aria-label="Autres projets">
      <div class="container pager">
        <a class="pager__link" href="${projectUrl(prev)}" rel="prev">
          ${icon('arrowLeft', 'icon')}<span><small>${esc(ui.prevProject)}</small><strong>${esc(prev.title)}</strong></span>
        </a>
        <a class="pager__all" href="/projets/">${esc(ui.allProjects)}</a>
        <a class="pager__link pager__link--next" href="${projectUrl(next)}" rel="next">
          <span><small>${esc(ui.nextProject)}</small><strong>${esc(next.title)}</strong></span>${icon('arrow', 'icon')}
        </a>
      </div>
    </nav>
${ctaBand(c)}`;

  page.jsonld = graph(c, page, [{
    '@type': 'TechArticle',
    '@id': `${base}${page.path}#article`,
    url: base + page.path,
    headline: item.title,
    description: item.summary,
    inLanguage: 'fr',
    keywords: item.stack.join(', '),
    author: { '@id': `${base}/#person` },
    isPartOf: { '@id': `${base}/#website` },
  }]);
  return page;
}

function contact(c) {
  const m = c.pages.contact;
  const { email, formEndpoint } = c.site.contact;
  const f = c.ui.form;
  const page = { key: 'contact', path: '/contact/', nav: 'contact', ...m };
  page.crumbs = [{ label: c.ui.home, href: '/' }, { label: m.heading }];

  const form = formEndpoint ? `
          <form class="panel contact-form contact-form--light" action="${safeUrl(formEndpoint)}" method="post" novalidate data-contact-form>
            <h2 class="panel__title">${esc(f.title)}</h2>
            <div class="field"><label for="cf-name">${esc(f.name)}</label><input id="cf-name" name="name" type="text" autocomplete="name" required maxlength="120"></div>
            <div class="field"><label for="cf-email">${esc(f.email)}</label><input id="cf-email" name="email" type="email" autocomplete="email" required maxlength="200"></div>
            <div class="field"><label for="cf-message">${esc(f.message)}</label><textarea id="cf-message" name="message" rows="5" required maxlength="5000"></textarea></div>
            <div class="hp" aria-hidden="true"><label for="cf-company">Société</label><input id="cf-company" name="_gotcha" type="text" tabindex="-1" autocomplete="off"></div>
            <button class="btn btn--primary" type="submit" data-label="${esc(f.submit)}" data-sending="${esc(f.sending)}"
              data-success="${esc(f.success)}" data-error="${esc(f.error)}" data-invalid="${esc(f.invalid)}">${esc(f.submit)}</button>
            <p class="form-status" role="status" aria-live="polite"></p>
          </form>` : '';

  page.body = `${pageHead(c, { crumbs: page.crumbs, heading: m.heading, lede: m.lede })}
    <section class="section section--tight" aria-label="${esc(m.heading)}">
      <div class="container contact-page${form ? ' contact-page--form' : ''}">
        <div class="panel contact-card">
          ${email ? `
          <h2 class="panel__title">${esc(c.ui.contactLabels.email)}</h2>
          <p class="contact-card__email">${esc(email)}</p>
          <div class="actions">
            <a class="btn btn--primary" href="mailto:${safeUrl(email)}">${icon('mail', 'icon icon--sm')}Écrire un email</a>
            <button class="btn btn--outline" type="button" data-copy="${esc(email)}" data-copied="${esc(c.ui.copied)}">${icon('copy', 'icon icon--sm')}<span>${esc(c.ui.copyEmail)}</span></button>
          </div>
          <p class="copy-status" role="status" aria-live="polite"></p>` : ''}
          ${otherChannels(c)}
        </div>
        ${form}
      </div>
    </section>`;

  page.jsonld = graph(c, page, [webPage(c, 'ContactPage', page, { mainEntity: { '@id': `${c.site.url}/#person` } })]);
  return page;
}

function notFound(c) {
  const m = c.pages.notFound;
  const page = { key: '404', path: '/404.html', file: '404.html', nav: null, noindex: true, ...m };
  page.body = `${pageHead(c, { heading: m.heading, lede: m.lede })}
    <section class="section section--tight" aria-label="Liens utiles">
      <div class="container actions">
        <a class="btn btn--primary" href="/">Retour à l’accueil</a>
        <a class="btn btn--outline" href="/projets/">Voir les projets</a>
      </div>
    </section>`;
  page.jsonld = graph(c, page, [webPage(c, 'WebPage', page)]);
  return page;
}

/** Toutes les pages du site, dans l'ordre du plan du site. */
export function buildPages(c) {
  return [
    home(c),
    about(c),
    skills(c),
    projects(c),
    ...c.projects.items.map((item, i) => project(c, item, i)),
    contact(c),
    notFound(c),
  ];
}
