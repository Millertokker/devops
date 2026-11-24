# Portfolio de NIAINA Andriharisoa

Site statique en HTML, CSS et JavaScript (modules ES), sans framework ni dépendance.
Node.js sert uniquement à l'étape de build optionnelle (pré-rendu et fichiers SEO), elle aussi sans dépendance.

## Structure

```
index.html                  Page : <head>, en-tête, hero (statique) et conteneurs de sections
404.html                    Page d'erreur (noindex)
assets/
  css/styles.css            Design system et composants
  css/font-inline.css       Police embarquée pour l'ouverture en file:// (générée par le build)
  fonts/inter-latin.woff2   Police Inter (licence OFL), hébergée localement
  js/
    content/site.js         Configuration : domaine, liens, email, CV, formulaire
    content/fr.js           Tous les textes (à propos, compétences, projets, expérience)
    render.js               Fonctions pures : données vers HTML (navigateur et build)
    ui.js                   Interactions : menu mobile, lien actif, formulaire (fonctionne aussi en file://)
    main.js                 Rafraîchit le contenu si fr.js a changé sans rebuild (http uniquement)
  img/                      Image de partage, icônes
scripts/
  build.mjs                 Pré-rendu, SEO, sitemap, robots, _headers
  og-image.html             Source de l'image de partage (1200×630)
```

## Modifier le contenu

| Quoi | Où |
|---|---|
| Domaine, email, GitHub, LinkedIn, CV, formulaire | `assets/js/content/site.js` |
| Sections, projets, compétences, expérience, titre et description SEO | `assets/js/content/fr.js` |
| Texte du hero et navigation | `index.html` |

Une valeur à `null` n'est **pas affichée** : aucun lien vide.

- **Statut d'un projet** : `production`, `implemented` ou `study`. Une étude n'est jamais marquée `production`.
- **Champs optionnels d'un projet** : `outcome` (résultat) et `repo` (lien vers le code).
- **Expérience** : ajouter les postes confirmés dans `experience.entries` (modèle en commentaire).
- **CV** : déposer le PDF dans `assets/files/` puis renseigner `contact.cv`.
- **Formulaire** : renseigner `contact.formEndpoint` (Formspree par exemple). La CSP est adaptée par le build.

### Simulations de projets

Chaque projet a un bouton « Voir la simulation » qui reproduit l'outil réel du projet.
Le moteur est dans `assets/js/sim.js`, chargé seulement au premier clic. Le type est choisi par `kind` dans `fr.js` :

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

Les valeurs affichées (CPU, identifiants, durées) sont générées aléatoirement et la fenêtre l'indique.
Les domaines utilisent `example.com` : n'y mettez jamais de vrai nom d'hôte, d'IP ou d'identifiant.

Après chaque modification :

```bash
npm run build
```

## Développement local

```bash
npm run serve      # http://localhost:8080
```

Ouvrir `index.html` par double-clic fonctionne aussi, mais les modifications de `fr.js` n'apparaissent qu'après `npm run build`.

## Déploiement sur GitHub Pages (andriharisoa.xyz)

Le workflow `.github/workflows/pages.yml` construit et publie le site à chaque push sur `main`.
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
npm run serve   # dans un autre terminal
google-chrome --headless=new --hide-scrollbars --window-size=1200,630 \
  --screenshot=assets/img/og-image.png http://localhost:8080/scripts/og-image.html
```
