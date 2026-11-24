# Portfolio de NIAINA Andriharisoa

Site statique **multipage** en HTML, CSS et JavaScript, sans framework ni dépendance.
Un petit générateur maison (`scripts/build.mjs`, Node.js, aucune dépendance) produit toutes les pages dans `dist/`.

## Pages

| URL | Contenu |
|---|---|
| `/` | Accueil : hero, accès rapide, 3 projets phares, domaines d'expertise |
| `/a-propos/` | Présentation, points forts, responsabilités, approche |
| `/competences/` | Les 7 domaines et leurs outils |
| `/competences/<id>/` | Une page par domaine : description, outils et pratiques, projets en production qui l'utilisent |
| `/projets/` | Les 6 études de cas |
| `/projets/<id>/` | Une page par projet : périmètre, stack, domaines, simulation intégrée, projet précédent et suivant |
| `/contact/` | Email (copie en un clic), puis LinkedIn, GitHub, CV ou formulaire s'ils sont configurés |
| `/404.html` | Page introuvable (non indexée) |

Chaque page a son titre, sa description, son URL canonique, son Open Graph, ses données structurées
(Person, WebSite, page typée, BreadcrumbList, TechArticle pour les projets) et sa CSP.

## Structure

```
content/
  site.js                   Configuration : domaine, email, GitHub, LinkedIn, CV, formulaire
  fr.js                     Tout le texte : hero, pages (titre, description), projets, compétences…
templates/
  lib.js                    Échappement, icônes, utilitaires
  layout.js                 <head> (SEO, CSP), en-tête, pied de page : communs à toutes les pages
  pages.js                  Une fonction par page (accueil, à propos, compétences, projets, projet, contact, 404)
assets/
  css/styles.css            Design system et composants
  fonts/inter-latin.woff2   Police Inter (licence OFL), hébergée localement
  js/ui.js                  Interactions communes : menu mobile, en-tête, copie de l'email, formulaire
  js/sim.js                 Moteur des simulations, chargé uniquement sur les pages projet
  img/                      Image de partage, icônes
scripts/
  build.mjs                 Génère dist/ : pages, sitemap, robots, _headers, CNAME
  dev.mjs                   Serveur de développement avec reconstruction automatique
  og-image.html             Source de l'image de partage (1200×630)
dist/                       Site généré (non versionné), publié par le workflow
```

## Développement

```bash
npm run dev        # http://localhost:8080, reconstruit à chaque modification
npm run build      # génère dist/
```

Node.js 20 ou plus. Le site se consulte via ce serveur (les liens entre pages ne fonctionnent pas en ouvrant un fichier par double-clic).

## Modifier le contenu

| Quoi | Où |
|---|---|
| Domaine, email, GitHub, LinkedIn, CV, formulaire | `content/site.js` |
| Textes, projets, compétences, expérience, titres et descriptions des pages | `content/fr.js` |
| Menu, en-tête, pied de page | `templates/layout.js` |
| Structure d'une page | `templates/pages.js` |

Une valeur à `null` n'est **pas affichée** : aucun lien vide.

- **Ajouter un projet** : ajouter un objet dans `projects.items` (`fr.js`). Sa page `/projets/<id>/`, sa carte,
  le plan du site et la navigation précédent / suivant sont générés automatiquement.
- **Projets phares de l'accueil** : `featured: true` sur le projet.
- **Domaines d'un projet** : liste `domains` du projet (identifiants des domaines de `expertise.domains`).
  Le projet apparaît alors sur la page de chacun de ces domaines, et ses domaines sur sa page.
- **Ajouter un domaine** : ajouter un objet dans `expertise.domains` avec `id`, `icon`, `title`, `summary` et `items`.
  Sa page `/competences/<id>/` est générée automatiquement.
- **Sous-groupes d'outils** : remplacer `items` par `groups: [{ label, items }]` (voir DevSecOps & Sécurité).
- **Encadré « Mise en pratique »** d'un domaine : champ `practice` (`title`, `intro`, `steps`, `result`, `tools`).
- **Statut d'un projet** : `production`, `implemented` ou `study`.
- **Champs optionnels d'un projet** : `context` (contexte), `outcome` (résultats) et `repo` (lien vers le code),
  affichés sur sa page s'ils sont renseignés.
- **Expérience** : ajouter les postes confirmés dans `experience.entries` (modèle en commentaire).
- **CV** : déposer le PDF dans `assets/files/` puis renseigner `contact.cv`.
- **Formulaire de contact** : géré par FormSubmit (`contact.formEndpoint` dans `content/site.js`).
  Le premier message déclenche un email d'activation à valider. Après activation, l'adresse peut être
  remplacée dans l'URL par l'identifiant aléatoire fourni par FormSubmit. La CSP est adaptée par le build.

### Simulations de projets

Chaque page projet intègre une simulation qui reproduit l'outil réel du projet.
Le moteur est dans `assets/js/sim.js`, chargé uniquement sur les pages projet. Le type est choisi par `kind` dans `fr.js` :

| `kind` | Ce qui est simulé | Données dans `fr.js` |
|---|---|---|
| `terraform` | Graphe du pipeline IaC (fmt, validate, iac-scan, plan, approbation, apply) et fichier `terraform.yml` consultable, PR (plan publié), revue, apply par le pipeline via OIDC, state S3 chiffré et verrouillé, évolution sur place, garde-fou `prevent_destroy` | `domain`, `resources` (adresse + bloc du schéma) |
| `containers` | Déploiement par le pipeline, disque plein (logs sans rotation), diagnostic, remise en service sans toucher aux volumes, rotation des logs | `services` (nom, image) |
| `pipeline` | Pipeline façon GitLab, secret détecté puis révoqué et remplacé via Vault, dépendance vulnérable puis mise à jour | `stages` (étapes et jobs) |
| `monitoring` | Tableau de bord, alertes, diagnostic dans les logs (oom-kill), rollback, processus CPU identifié et replanifié | `servers`, `services` |
| `access` | WireGuard, `tsh login` avec MFA, RBAC Teleport, refus journalisé, accès temporaire approuvé et limité à 1 h | `proxy`, `nodes` (nom + env) |
| `cluster` | Quorum et QDevice, isolement puis reprise HA, migration à chaud au retour du nœud, stockage partagé ou ZFS | `vms` (id, nom, nœud) |

Chaque simulation est pilotée par un **guide** (propriété `guide` de chaque type dans `sim.js`) :
une phrase d'introduction, puis une seule action à la fois avec son explication et la zone à regarder
mise en évidence. Le visiteur choisit « Regarder la démo » (tout s'enchaîne seul) ou « Avancer pas à pas ».
Pour modifier le déroulé, éditez la liste `steps` du guide : `act` (action), `btn` (texte du bouton),
`title`, `text`, `spot` (zone à mettre en évidence) et `set` (scénario à sélectionner avant l'action).

Les valeurs affichées (CPU, identifiants, durées) sont générées aléatoirement, et la page l'indique.
Les domaines utilisent `example.com` : n'y mettez jamais de vrai nom d'hôte, d'IP ou d'identifiant.

## Déploiement sur GitHub Pages (andriharisoa.xyz)

Le workflow `.github/workflows/pages.yml` lance le build, vérifie les pages générées et publie `dist/`
à chaque push sur `main`.
GitHub Pages ne permet pas d'en-têtes HTTP : la politique de sécurité (CSP) est donc injectée
dans la page par le build, en balise `<meta>`. Le fichier `_headers` ne sert que sur Netlify ou Cloudflare Pages.

### 1. Créer le dépôt et pousser

```bash
gh repo create devops --public --source=. --remote=origin --push
```

### 2. Activer Pages et le domaine

```bash
gh api -X POST repos/{owner}/devops/pages -f build_type=workflow
gh api -X PUT  repos/{owner}/devops/pages -f cname=andriharisoa.xyz
gh workflow run pages.yml   # ou attendre le premier push
```

### 3. DNS chez le registrar du domaine

| Type | Nom | Valeur |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | `<compte>.github.io` |

Supprimer les anciens enregistrements A, CNAME ou de redirection (« parking ») sur `@` et `www`.
Vérifier la propagation : `dig +short andriharisoa.xyz A`.

### 4. HTTPS et sécurité du domaine

- Une fois le DNS propagé, cocher **Enforce HTTPS** dans *Settings > Pages*
  (ou `gh api -X PUT repos/{owner}/devops/pages -F https_enforced=true`).
- Vérifier le domaine dans *Settings > Pages > Verified domains* du compte : cela empêche
  qu'un autre dépôt GitHub s'approprie `andriharisoa.xyz`.

### Autres hébergeurs

Site entièrement statique : Netlify et Cloudflare Pages lisent `_headers`. Avec Nginx, reprendre
ces en-têtes et activer la compression :

```nginx
gzip on;
gzip_types text/css application/javascript image/svg+xml application/json;
error_page 404 /404.html;
```

Régénérer l'image de partage après modification du hero :

```bash
# servir la racine du dépôt (le fichier source n'est pas copié dans dist/)
python3 -m http.server 8090
google-chrome --headless=new --hide-scrollbars --window-size=1200,630 \
  --screenshot=assets/img/og-image.png http://localhost:8090/scripts/og-image.html
```
