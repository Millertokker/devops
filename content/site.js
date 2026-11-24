/**
 * Configuration partagée du site (indépendante de la langue).
 *
 * Toute valeur à `null` n'est pas configurée : l'élément correspondant
 * (lien, bouton, formulaire) n'est simplement pas affiché.
 * Ce fichier est public : n'y mettez jamais de secret.
 */
const site = {
  // Domaine de production (sans slash final). Après modification : `npm run build`.
  url: 'https://andriharisoa.xyz',

  name: 'NIAINA Andriharisoa',
  shortName: 'NIAINA',
  givenName: 'Andriharisoa',
  familyName: 'NIAINA',
  jobTitle: 'Ingénieur DevOps & Cloud',

  /** Image de partage (1200×630), relative à la racine du site. */
  ogImage: 'assets/img/og-image.png',

  /**
   * Langues disponibles. Pour ajouter l'anglais :
   *   1. copier index.html vers en/index.html (lang="en", chemins relatifs en ../),
   *   2. créer assets/js/content/en.js (même structure que fr.js),
   *   3. ajouter { lang: 'en', ogLocale: 'en_US', path: '/en/', page: 'en/index.html' },
   *   4. lancer `npm run build` : balises hreflang et sitemap générés.
   */
  locales: [
    { lang: 'fr', ogLocale: 'fr_FR', path: '/', page: 'index.html', default: true },
  ],

  contact: {
    email: 'andriharisoaniaina@gmail.com',
    github: null,         // ex. 'https://github.com/<utilisateur>'
    linkedin: null,       // ex. 'https://www.linkedin.com/in/<profil>'
    cv: null,             // ex. 'assets/files/cv-niaina-andriharisoa.pdf'
    /**
     * Formulaire de contact, via FormSubmit (formsubmit.co) : les messages arrivent par email.
     * - Le premier message envoyé déclenche un email d'activation : cliquer sur le lien pour activer.
     * - Après activation, FormSubmit fournit un identifiant aléatoire qui peut remplacer l'adresse
     *   dans cette URL (https://formsubmit.co/ajax/<identifiant>).
     * Envoi en arrière-plan sur l'URL « /ajax/ » ; sans JavaScript, envoi classique sur l'URL sans « /ajax ».
     * Si null, pas de formulaire.
     */
    formEndpoint: 'https://formsubmit.co/ajax/andriharisoaniaina@gmail.com',
  },
};

export default site;
