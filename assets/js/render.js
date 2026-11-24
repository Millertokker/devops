/**
 * Fonctions de rendu pures : objet de contenu -> chaînes HTML.
 * Aucun accès au DOM : le même module tourne dans le navigateur et dans scripts/build.mjs.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Hash FNV-1a : permet au client de ne pas re-rendre un HTML déjà produit par le build. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const join = (items, fn) => items.map(fn).join('');

/** N'autorise que les URL http(s), mailto et relatives. */
const safeUrl = (url) => {
  const value = String(url ?? '').trim();
  if (/^(https?:|mailto:)/i.test(value)) return esc(value);
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return esc(value);
  return '#';
};

/* ---------------------------------------------------------------- Icônes */

const PATHS = {
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-.5 9.5H7z"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  container: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  pipeline: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 8v8M18 10v1a5 5 0 0 1-5 5H8"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
  server: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  external: '<path d="M7 17 17 7M8 7h9v9"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  github: '<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5a3 3 0 0 0-.9-2.3c3-.3 6-1.4 6-6.5a5 5 0 0 0-1.4-3.5 4.6 4.6 0 0 0-.1-3.5s-1.1-.3-3.6 1.4a12.4 12.4 0 0 0-6.5 0C6 1.4 4.9 1.7 4.9 1.7a4.6 4.6 0 0 0-.1 3.5A5 5 0 0 0 3.4 8.7c0 5.1 3 6.2 6 6.5a3 3 0 0 0-.9 2.3V21"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  commit: '<circle cx="12" cy="12" r="3.5"/><path d="M3 12h5.5M15.5 12H21"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
};

export const icon = (name, cls = 'icon') =>
  PATHS[name]
    ? `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`
    : '';

const sectionHead = (id, { title, lede }) => `
  <header class="section-head">
    <h2 id="${id}-title">${esc(title)}</h2>
    ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
  </header>`;

const checklist = (items) =>
  `<ul class="checklist" role="list">${join(items, (s) => `<li>${esc(s)}</li>`)}</ul>`;

/* ---------------------------------------------------------- Accès rapide */

export function renderQuicklinks(c) {
  const q = c.quicklinks;
  const counts = { domains: c.expertise.domains.length, projects: c.projects.items.length };
  const fill = (text) => text.replace(/\{(\w+)\}/g, (_, k) => counts[k] ?? '');
  return `
  <h2 class="quick__title" id="quick-title">${esc(q.title)}</h2>
  <ul class="quick__list" role="list">
    ${join(q.items, (item) => `
    <li>
      <a class="quick__link" href="${safeUrl(item.href)}">
        <span class="icon-tile">${icon(item.icon)}</span>
        <span class="quick__text"><strong>${esc(item.label)}</strong><span>${esc(fill(item.meta))}</span></span>
        ${icon('arrow', 'icon quick__arrow')}
      </a>
    </li>`)}
  </ul>`;
}

/* ------------------------------------------------------------ À propos */

export function renderAbout(c) {
  const a = c.about;
  return `
  <div class="about">
    <div>
      ${sectionHead('about', a)}
      <div class="about__text">${join(a.paragraphs, (p) => `<p>${esc(p)}</p>`)}</div>
    </div>
    <div class="panel">
      <h3 class="panel__title">${esc(a.strengthsTitle)}</h3>
      ${checklist(a.strengths)}
    </div>
  </div>`;
}

/* ---------------------------------------------------------- Compétences */

export function renderExpertise(c) {
  const x = c.expertise;
  return `
  ${sectionHead('expertise', x)}
  <ul class="skills" role="list">
    ${join(x.domains, (d) => `
    <li class="skills__row">
      <div class="skills__name">
        <span class="icon-tile">${icon(d.icon)}</span>
        <h3>${esc(d.title)}</h3>
      </div>
      <ul class="tags" role="list">${join(d.items, (t) => `<li>${esc(t)}</li>`)}</ul>
    </li>`)}
  </ul>`;
}

/* ------------------------------------------------------------ Simulation */

/** JSON sûr à placer dans un <script type="application/json"> (bloc de données, jamais exécuté). */
const jsonBlock = (id, data) =>
  `<script type="application/json" id="${esc(id)}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

/* --------------------------------------------------------------- Projets */

const statusBadge = (status, ui) =>
  `<span class="status status--${esc(status)}">${esc(ui.statusLabels[status] ?? status)}</span>`;

export function renderProjects(c) {
  const p = c.projects;
  const ui = c.ui;
  return `
  ${sectionHead('projects', p)}
  ${jsonBlock('sim-ui', ui.sim)}
  <div class="projects">
    ${join(p.items, (item) => `
    <article class="project" id="projet-${esc(item.id)}" aria-labelledby="projet-${esc(item.id)}-title">
      <div class="project__top">
        <span class="icon-tile">${icon(item.icon)}</span>
        ${statusBadge(item.status, ui)}
      </div>
      <h3 id="projet-${esc(item.id)}-title">${esc(item.title)}</h3>
      <p class="project__summary">${esc(item.summary)}</p>
      ${item.outcome ? `<p class="project__outcome">${esc(item.outcome)}</p>` : ''}
      <ul class="project__stack" role="list" aria-label="Technologies">${join(item.stack, (t) => `<li>${esc(t)}</li>`)}</ul>
      ${item.simulation ? `<button class="sim-open" type="button" data-sim-open="${esc(item.id)}" aria-haspopup="dialog">${icon('play', 'icon icon--sm')}${esc(ui.sim.open)}</button>${jsonBlock(`sim-data-${item.id}`, { title: item.title, status: item.status, ...item.simulation })}` : ''}
      <details class="project__details">
        <summary>${esc(ui.details)}</summary>
        ${checklist(item.scope)}
      </details>
      ${item.repo ? `<a class="link" href="${safeUrl(item.repo)}" rel="noopener">${esc(ui.repoLabel)} ${icon('external', 'icon icon--sm')}</a>` : ''}
    </article>`)}
  </div>`;
}

/* ------------------------------------------------------------ Expérience */

const formatMonth = (ym, lang) => {
  const [y, m] = String(ym).split('-').map(Number);
  if (!y) return '';
  if (!m) return String(y);
  return new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 1)));
};

export function renderExperience(c) {
  const x = c.experience;
  const { cv, linkedin } = c.site.contact;
  const L = c.ui.contactLabels;

  const note = cv
    ? `<p class="note">${esc(x.historyNote.cv)} <a class="link" href="${safeUrl(cv)}" download>${esc(L.cvAction)}</a></p>`
    : linkedin
      ? `<p class="note">${esc(x.historyNote.linkedin)} <a class="link" href="${safeUrl(linkedin)}" rel="me noopener">${esc(L.linkedin)}</a></p>`
      : '';

  const roles = x.entries.length
    ? `
    <div class="panel panel--wide">
      <h3 class="panel__title">${esc(x.rolesTitle)}</h3>
      <ol class="timeline" role="list">
        ${join(x.entries, (e) => `
        <li>
          <p class="timeline__dates">${e.end
            ? `<time datetime="${esc(e.start)}">${esc(formatMonth(e.start, c.lang))}</time> ${esc(c.ui.dateTo)} <time datetime="${esc(e.end)}">${esc(formatMonth(e.end, c.lang))}</time>`
            : `${esc(c.ui.since)} <time datetime="${esc(e.start)}">${esc(formatMonth(e.start, c.lang))}</time>`}</p>
          <div>
            <h4>${esc(e.role)}${e.organization ? `<span class="muted">, ${esc(e.organization)}</span>` : ''}</h4>
            ${e.summary ? `<p>${esc(e.summary)}</p>` : ''}
          </div>
        </li>`)}
      </ol>
    </div>`
    : '';

  return `
  ${sectionHead('experience', x)}
  <div class="experience">
    ${roles}
    <div class="panel">
      <h3 class="panel__title">${esc(x.responsibilitiesTitle)}</h3>
      ${checklist(x.responsibilities)}
    </div>
    <div class="panel">
      <h3 class="panel__title">${esc(x.principlesTitle)}</h3>
      <ul class="principles" role="list">
        ${join(x.principles, (p) => `<li><strong>${esc(p.title)}</strong><span>${esc(p.text)}</span></li>`)}
      </ul>
    </div>
  </div>
  ${note}`;
}

/* --------------------------------------------------------------- Contact */

const contactActions = (c) => {
  const { email, github, linkedin, cv } = c.site.contact;
  const L = c.ui.contactLabels;
  const out = [];
  if (email) out.push(`<a class="btn btn--light" href="mailto:${safeUrl(email)}">${icon('mail', 'icon icon--sm')}${esc(email)}</a>`);
  if (linkedin) out.push(`<a class="btn btn--ghost" href="${safeUrl(linkedin)}" rel="me noopener">${icon('linkedin', 'icon icon--sm')}${esc(L.linkedin)}</a>`);
  if (github) out.push(`<a class="btn btn--ghost" href="${safeUrl(github)}" rel="me noopener">${icon('github', 'icon icon--sm')}${esc(L.github)}</a>`);
  if (cv) out.push(`<a class="btn btn--ghost" href="${safeUrl(cv)}" download>${icon('download', 'icon icon--sm')}${esc(L.cvAction)}</a>`);
  return out;
};

export function renderContact(c) {
  const k = c.contact;
  const f = c.ui.form;
  const actions = contactActions(c);
  const endpoint = c.site.contact.formEndpoint;

  const form = endpoint
    ? `
    <form class="contact-form" action="${safeUrl(endpoint)}" method="post" novalidate data-contact-form>
      <div class="field">
        <label for="cf-name">${esc(f.name)}</label>
        <input id="cf-name" name="name" type="text" autocomplete="name" required maxlength="120">
      </div>
      <div class="field">
        <label for="cf-email">${esc(f.email)}</label>
        <input id="cf-email" name="email" type="email" autocomplete="email" required maxlength="200">
      </div>
      <div class="field">
        <label for="cf-message">${esc(f.message)}</label>
        <textarea id="cf-message" name="message" rows="4" required maxlength="5000"></textarea>
      </div>
      <div class="hp" aria-hidden="true">
        <label for="cf-company">Société</label>
        <input id="cf-company" name="_gotcha" type="text" tabindex="-1" autocomplete="off">
      </div>
      <button class="btn btn--light" type="submit"
        data-label="${esc(f.submit)}" data-sending="${esc(f.sending)}"
        data-success="${esc(f.success)}" data-error="${esc(f.error)}" data-invalid="${esc(f.invalid)}">${esc(f.submit)}</button>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>`
    : '';

  return `
  <div class="cta${form ? ' cta--form' : ''}">
    <div class="cta__text">
      <span class="icon-tile icon-tile--dark">${icon('mail')}</span>
      <h2 id="contact-title">${esc(k.title)}</h2>
      <p>${esc(k.text)}</p>
      ${actions.length ? `<div class="actions">${actions.join('')}</div>` : ''}
    </div>
    ${form}
  </div>`;
}

/* ---------------------------------------------------------------- Footer */

export function renderFooter(c, year = new Date().getFullYear()) {
  const { github, linkedin } = c.site.contact;
  const links = [];
  if (linkedin) links.push(`<li><a href="${safeUrl(linkedin)}" rel="me noopener">LinkedIn</a></li>`);
  if (github) links.push(`<li><a href="${safeUrl(github)}" rel="me noopener">GitHub</a></li>`);
  return `
  <p><strong>${esc(c.site.name)}</strong><span class="muted"> · ${esc(c.footer.tagline)}</span></p>
  ${links.length ? `<nav aria-label="${esc(c.ui.footerNav)}"><ul class="footer-links" role="list">${links.join('')}</ul></nav>` : ''}
  <p class="muted">© <span data-year>${year}</span> ${esc(c.site.name)}</p>`;
}

/** Clés data-render -> fonctions de rendu. */
export const sections = {
  quicklinks: renderQuicklinks,
  about: renderAbout,
  expertise: renderExpertise,
  projects: renderProjects,
  experience: renderExperience,
  contact: renderContact,
  footer: renderFooter,
};
