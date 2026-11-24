/**
 * Outils communs aux gabarits : échappement, URL sûres, icônes.
 * Les gabarits sont des fonctions pures (données -> HTML), exécutées uniquement par le build.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const join = (items, fn) => items.map(fn).join('');

/** N'autorise que les URL http(s), mailto et relatives. */
export const safeUrl = (url) => {
  const value = String(url ?? '').trim();
  if (/^(https?:|mailto:)/i.test(value)) return esc(value);
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return esc(value);
  return '#';
};

/** Bloc de données JSON inerte, sûr à placer dans la page (jamais exécuté, compatible CSP). */
export const jsonBlock = (id, data) =>
  `<script type="application/json" id="${esc(id)}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

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
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  external: '<path d="M7 17 17 7M8 7h9v9"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  github: '<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5a3 3 0 0 0-.9-2.3c3-.3 6-1.4 6-6.5a5 5 0 0 0-1.4-3.5 4.6 4.6 0 0 0-.1-3.5s-1.1-.3-3.6 1.4a12.4 12.4 0 0 0-6.5 0C6 1.4 4.9 1.7 4.9 1.7a4.6 4.6 0 0 0-.1 3.5A5 5 0 0 0 3.4 8.7c0 5.1 3 6.2 6 6.5a3 3 0 0 0-.9 2.3V21"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
};

export const icon = (name, cls = 'icon') =>
  PATHS[name]
    ? `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`
    : '';

/** URL d'une page projet. */
export const projectUrl = (item) => `/projets/${item.id}/`;

/** URL d'une page domaine de compétence. */
export const domainUrl = (domain) => `/competences/${domain.id}/`;
