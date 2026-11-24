/**
 * Contenu en français : source unique de toutes les sections sous le hero.
 * (Le texte du hero est dans index.html pour s'afficher sans attendre le JavaScript.)
 *
 * Règles :
 *  - Uniquement des faits vrais et vérifiables.
 *  - `status` d'un projet : 'production' | 'implemented' | 'study'.
 *  - `icon` : cloud | code | container | pipeline | activity | shield | server | lock | layers
 *  - Jamais de nom de client, de nom d'hôte, d'adresse IP ni de détail interne.
 */
import site from './site.js';

const fr = {
  site,
  lang: 'fr',

  seo: {
    title: 'NIAINA Andriharisoa | Ingénieur DevOps & Cloud, SRE, DevSecOps',
    description:
      'Ingénieur DevOps & Cloud (SRE, DevSecOps) : automatisation et sécurisation d’infrastructures fiables avec AWS, Terraform, Kubernetes, CI/CD et observabilité.',
    ogImageAlt: 'NIAINA Andriharisoa, Ingénieur DevOps & Cloud, SRE, DevSecOps',
    knowsAbout: [
      'DevOps', 'Site Reliability Engineering', 'DevSecOps', 'Cloud Infrastructure',
      'Amazon Web Services', 'Terraform', 'Ansible', 'Kubernetes', 'Docker',
      'CI/CD', 'GitOps', 'Observability', 'Linux', 'Infrastructure as Code',
    ],
  },

  ui: {
    statusLabels: {
      production: 'En production',
      implemented: 'Réalisé',
      study: 'Étude d’architecture',
    },
    details: 'Périmètre',
    sim: {
      open: 'Voir la simulation',
      badge: 'Simulation',
      note: 'Données fictives générées pour illustrer le fonctionnement, temps accéléré.',
      studyNote: 'Étude d’architecture\u00a0: scénario théorique, non déployé en production. Données fictives.',
      close: 'Fermer',
    },
    repoLabel: 'Code source',
    since: 'Depuis',
    dateTo: 'à',
    contactLabels: {
      email: 'Email',
      github: 'GitHub',
      linkedin: 'LinkedIn',
      cv: 'CV',
      cvAction: 'Télécharger mon CV',
    },
    form: {
      title: 'Envoyer un message',
      name: 'Nom',
      email: 'Email',
      message: 'Message',
      submit: 'Envoyer',
      sending: 'Envoi…',
      success: 'Merci, votre message a bien été envoyé.',
      error: 'L’envoi a échoué. Réessayez ou écrivez-moi directement par email.',
      invalid: 'Merci de remplir tous les champs avec une adresse email valide.',
    },
    backToTop: 'Haut de page',
    footerNav: 'Liens',
  },

  /** Raccourcis du hero : `count` est calculé à partir des données. */
  quicklinks: {
    title: 'Accès rapide',
    items: [
      { href: '#expertise', icon: 'grid', label: 'Compétences', meta: '{domains} domaines techniques' },
      { href: '#projects', icon: 'folder', label: 'Projets', meta: '{projects} études de cas' },
      { href: '#experience', icon: 'briefcase', label: 'Expérience', meta: 'Responsabilités et approche' },
      { href: '#contact', icon: 'mail', label: 'Contact', meta: 'Parlons de votre projet' },
    ],
  },

  about: {
    title: 'À propos',
    paragraphs: [
      'Ingénieur DevOps et Cloud autodidacte, je conçois, automatise et maintiens des infrastructures de production depuis plusieurs années.',
      'J’interviens sur tout le cycle de vie : architecture, provisionnement, déploiement, sécurité, supervision et maintenance. Mon approche est pragmatique : comprendre le besoin, concevoir simple, automatiser, puis améliorer en continu.',
    ],
    strengthsTitle: 'Points forts',
    strengths: [
      'Prise en charge de bout en bout',
      'Résolution de problèmes',
      'Exploitation en production',
      'Automatisation',
      'Sécurité dès la conception',
      'Documentation technique',
    ],
  },

  expertise: {
    title: 'Compétences',
    lede: 'Les outils que j’utilise, regroupés par domaine.',
    domains: [
      { icon: 'cloud', title: 'Cloud & Infrastructure', items: ['AWS', 'Scaleway', 'Vultr', 'Proxmox VE', 'EC2', 'RDS', 'S3', 'IAM', 'Route 53', 'CloudFront', 'VPC'] },
      { icon: 'code', title: 'Infrastructure as Code', items: ['Terraform', 'Ansible', 'Bash', 'Python', 'Provisionnement', 'Gestion de configuration'] },
      { icon: 'container', title: 'Conteneurs & Orchestration', items: ['Docker', 'Docker Compose', 'Kubernetes', 'Amazon EKS', 'ArgoCD', 'Registres de conteneurs'] },
      { icon: 'pipeline', title: 'CI/CD & GitOps', items: ['GitLab CI/CD', 'GitHub Actions', 'Jenkins', 'GitLab Runner', 'GitOps', 'Blue/Green'] },
      { icon: 'activity', title: 'Supervision & Observabilité', items: ['Prometheus', 'Grafana', 'ELK Stack', 'Uptime Kuma', 'Beszel', 'Wazuh', 'Logs centralisés', 'Alertes'] },
      { icon: 'shield', title: 'DevSecOps & Sécurité', items: ['Cloudflare WAF', 'Gitleaks', 'Vault', 'AWS Secrets Manager', 'Teleport', 'WireGuard', 'Scan de vulnérabilités', 'Durcissement Linux et TLS', 'IAM et RBAC'] },
      { icon: 'server', title: 'Réseau & Systèmes', items: ['Linux', 'Ubuntu', 'Nginx', 'Apache', 'Traefik', 'Caddy', 'PostgreSQL', 'Redis', 'RabbitMQ', 'VPN', 'DNS', 'Pare-feu'] },
    ],
  },

  projects: {
    title: 'Projets',
    lede: 'Chaque projet indique son statut. Une étude d’architecture est une conception évaluée, pas un déploiement en production.',
    /*
     * Champs optionnels par projet, affichés s'ils sont renseignés :
     *   outcome: 'Résultat obtenu', repo: 'https://github.com/…'
     */
    items: [
      {
        id: 'infrastructure-aws-terraform',
        icon: 'cloud',
        title: 'Infrastructure AWS en code',
        status: 'implemented',
        summary: 'Conception et déploiement d’une infrastructure AWS entièrement automatisée avec Terraform.',
        scope: [
          'Provisionnement avec Terraform',
          'Configuration des ressources AWS',
          'Déploiement de l’infrastructure Kubernetes',
          'Intégration CI/CD',
          'Déploiement applicatif automatisé',
          'Infrastructure reproductible',
        ],
        stack: ['Terraform', 'AWS', 'EKS', 'ALB', 'RDS', 'S3', 'IAM', 'Route 53', 'CloudFront', 'GitHub Actions'],
        simulation: {
          kind: 'terraform',
          domain: 'app.example.com',
          resources: [
            { addr: 'aws_vpc.main', node: 'vpc' },
            { addr: 'aws_subnet.private["a"]', node: 'vpc' },
            { addr: 'aws_subnet.private["b"]', node: 'vpc' },
            { addr: 'aws_iam_role.eks_cluster', node: 'iam' },
            { addr: 'aws_iam_role.eks_nodes', node: 'iam' },
            { addr: 'aws_eks_cluster.main', node: 'eks', slow: true },
            { addr: 'aws_eks_node_group.default', node: 'eks', slow: true },
            { addr: 'aws_db_instance.postgres', node: 'rds', slow: true },
            { addr: 'aws_s3_bucket.assets', node: 's3' },
            { addr: 'aws_lb.app', node: 'alb' },
            { addr: 'aws_cloudfront_distribution.cdn', node: 'cloudfront' },
            { addr: 'aws_route53_record.app', node: 'route53' },
          ],
        },
      },
      {
        id: 'production-conteneurs',
        icon: 'container',
        title: 'Infrastructure de production et conteneurs',
        status: 'production',
        summary: 'Gestion et optimisation d’environnements de production hébergeant des applications conteneurisées et des services distribués.',
        scope: [
          'Gestion des environnements de production',
          'Déploiement d’applications conteneurisées',
          'Configuration et maintenance des services',
          'Suivi des ressources',
          'Connectivité et dépannage des bases de données',
          'Fiabilisation des déploiements',
        ],
        stack: ['Docker', 'Docker Compose', 'Linux', 'PostgreSQL', 'Redis', 'RabbitMQ', 'Caddy', 'Scaleway', 'AWS'],
        simulation: {
          kind: 'containers',
          services: [
            { name: 'postgres', image: 'postgres:16', health: true },
            { name: 'redis', image: 'redis:7', health: true },
            { name: 'rabbitmq', image: 'rabbitmq:3-management', health: true },
            { name: 'api', image: 'registry.example.com/app/api:1.4.2', health: true },
            { name: 'worker', image: 'registry.example.com/app/worker:1.4.2' },
            { name: 'caddy', image: 'caddy:2' },
          ],
        },
      },
      {
        id: 'pipeline-devsecops',
        icon: 'shield',
        title: 'Pipeline DevSecOps',
        status: 'implemented',
        summary: 'Contrôles de sécurité intégrés à la CI/CD pour détecter vulnérabilités, secrets exposés et configurations à risque avant la production.',
        scope: [
          'Détection de secrets',
          'Analyse de sécurité dans la CI/CD',
          'Gestion des vulnérabilités',
          'Déploiements sécurisés',
          'Gestion des secrets',
          'Contrôles intégrés aux pipelines',
        ],
        stack: ['GitLab CI', 'GitHub Actions', 'Gitleaks', 'Scanners de vulnérabilités', 'Vault', 'AWS IAM'],
        simulation: {
          kind: 'pipeline',
          stages: [
            { name: 'build', jobs: ['build-image'] },
            { name: 'test', jobs: ['unit-tests'] },
            { name: 'security', jobs: ['gitleaks', 'dependency-scan', 'container-scan'] },
            { name: 'deploy', jobs: ['deploy-production'] },
          ],
        },
      },
      {
        id: 'supervision-observabilite',
        icon: 'activity',
        title: 'Supervision et observabilité',
        status: 'implemented',
        summary: 'Mise en place de la supervision pour améliorer la visibilité, la détection d’incidents et la fiabilité.',
        scope: [
          'Collecte de métriques',
          'Tableaux de bord',
          'Surveillance de disponibilité',
          'Centralisation des logs',
          'Alertes',
          'Suivi de l’utilisation des ressources',
        ],
        stack: ['Prometheus', 'Grafana', 'ELK', 'Uptime Kuma', 'Beszel', 'Wazuh'],
        simulation: {
          kind: 'monitoring',
          servers: ['srv-app-01', 'srv-app-02', 'srv-db-01'],
          services: ['web', 'api', 'worker', 'postgres'],
        },
      },
      {
        id: 'acces-securise-reseau',
        icon: 'lock',
        title: 'Accès sécurisé et architecture réseau',
        status: 'implemented',
        summary: 'Mise en place d’accès sécurisés à l’infrastructure et de mécanismes de protection réseau.',
        scope: [
          'Accès par VPN',
          'Administration SSH sécurisée',
          'Segmentation réseau',
          'Contrôle d’accès',
          'Audit des sessions',
          'Configuration WAF',
          'Durcissement TLS',
        ],
        stack: ['WireGuard', 'Cloudflare', 'WAF', 'Teleport', 'RBAC', 'Linux', 'TLS'],
        simulation: {
          kind: 'access',
          proxy: 'teleport.example.com',
          nodes: [
            { name: 'prod-api', env: 'prod' },
            { name: 'prod-db', env: 'prod' },
            { name: 'staging-api', env: 'staging' },
          ],
        },
      },
      {
        id: 'virtualisation-haute-disponibilite',
        icon: 'layers',
        title: 'Virtualisation et haute disponibilité',
        status: 'study',
        summary: 'Conception et évaluation d’architectures de virtualisation résilientes avec Proxmox VE en cluster.',
        scope: [
          'Architecture de virtualisation',
          'Conception de cluster',
          'Haute disponibilité',
          'Stockage partagé ou indépendant',
          'Architecture réseau',
          'Résilience de l’infrastructure',
        ],
        stack: ['Proxmox VE', 'Linux', 'QDevice', 'Réseau', 'PostgreSQL', 'Scaleway'],
        simulation: {
          kind: 'cluster',
          vms: [
            { id: 101, name: 'web', node: 'pve1' },
            { id: 102, name: 'api', node: 'pve1' },
            { id: 103, name: 'db', node: 'pve2' },
          ],
        },
      },
    ],
  },

  experience: {
    title: 'Expérience',
    responsibilitiesTitle: 'Domaines de responsabilité',
    responsibilities: [
      'Maintien en condition opérationnelle',
      'Serveurs Linux et production',
      'Bases de données et déploiements',
      'Automatisation des opérations',
      'Pipelines CI/CD',
      'Sécurisation des environnements',
      'Supervision et alertes',
      'Gestion des incidents',
      'Documentation technique',
    ],
    principlesTitle: 'Mon approche',
    principles: [
      { title: 'Automatiser d’abord', text: 'Moins d’opérations manuelles.' },
      { title: 'Sécurité dès la conception', text: 'À chaque étape du cycle de vie.' },
      { title: 'Fiabilité', text: 'Des systèmes observables, résilients et maintenables.' },
      { title: 'Infrastructure as Code', text: 'Reproductible et versionnée.' },
      { title: 'Amélioration continue', text: 'Mesurer, documenter, améliorer.' },
    ],
    rolesTitle: 'Parcours',
    historyNote: {
      cv: 'Le détail de mon parcours est dans mon CV.',
      linkedin: 'Le détail de mon parcours est sur LinkedIn.',
    },
    /*
     * Ajouter ici les postes confirmés (le plus récent en premier).
     * {
     *   role: 'Ingénieur DevOps',
     *   organization: 'Entreprise',     // ou 'Freelance'
     *   start: '2023-01',               // AAAA-MM
     *   end: null,                      // null = poste actuel
     *   summary: 'Une phrase sur le périmètre du poste.',
     * },
     */
    entries: [],
  },

  contact: {
    title: 'Un projet d’infrastructure ? Parlons-en.',
    text: 'Cloud, pipelines de déploiement, sécurité ou fiabilité : je serais ravi d’échanger sur votre projet.',
  },

  footer: {
    tagline: 'Ingénieur DevOps & Cloud',
  },
};

export default fr;
