/**
 * Rafraîchissement du contenu (module ES, chargé uniquement en http/https).
 *
 * Le build pré-rend déjà toutes les sections dans index.html. Ce module compare
 * le rendu actuel des données (content/<lang>.js) avec le HTML pré-rendu et ne
 * touche au DOM que si le contenu a été modifié sans relancer `npm run build`.
 * Les interactions de la page sont dans ui.js (indépendant de ce module).
 */
import { sections, hashString } from './render.js';

const lang = (document.documentElement.lang || 'fr').slice(0, 2);

async function loadContent() {
  try {
    return (await import(`./content/${lang}.js`)).default;
  } catch {
    return (await import('./content/fr.js')).default;
  }
}

const content = await loadContent();

document.querySelectorAll('[data-render]').forEach((el) => {
  const render = sections[el.dataset.render];
  if (!render) return;
  const html = render(content).trim();
  const hash = String(hashString(html));
  if (el.dataset.hash !== hash) {
    el.innerHTML = html;
    el.dataset.hash = hash;
  }
});

if (!content.site.url || content.site.url.includes('example.com')) {
  console.info('[portfolio] site.url n’est pas configuré : modifiez assets/js/content/site.js puis lancez `npm run build`.');
}
