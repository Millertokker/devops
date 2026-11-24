/**
 * Moteur des simulations de projets (script classique, chargé à la demande par ui.js).
 *
 * Chaque type (`kind`) reproduit l'outil réel du projet :
 *   terraform   terminal Terraform + schéma d'architecture AWS qui se construit
 *   containers  `docker compose ps`, ressources en direct, logs, panne et dépannage
 *   pipeline    pipeline CI/CD façon GitLab avec journaux de jobs (Gitleaks, scans, Vault)
 *   monitoring  tableau de bord façon Grafana, disponibilité, alertes, logs et Wazuh
 *   access      WireGuard + Teleport (RBAC, MFA, audit) + flux du WAF Cloudflare
 *   cluster     cluster Proxmox VE, quorum, QDevice et bascule HA (étude théorique)
 *
 * Toutes les valeurs sont fictives et générées localement. Aucune requête réseau.
 * Interface : window.PortfolioSim.mount(dialog, payload, strings) -> { destroy() }
 */
(function () {
  'use strict';

  /* =========================================================== Utilitaires */

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hex(n) { var s = ''; while (s.length < n) s += Math.floor(Math.random() * 16).toString(16); return s; }
  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
  function clock(offsetSec) {
    var d = new Date(Date.now() + (offsetSec || 0) * 1000);
    return d.toTimeString().slice(0, 8);
  }
  var NB = ' ';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ICONS = {
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    skip: '<path d="M5 12h14"/>',
    dot: '<circle cx="12" cy="12" r="4"/>',
  };
  function svg(name, cls) {
    return '<svg class="' + (cls || 'icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
  }

  function button(act, label, opts) {
    opts = opts || {};
    return '<button type="button" class="btn btn--sm ' + (opts.primary ? 'btn--primary' : 'btn--outline') + (opts.danger ? ' btn--danger' : '') +
      '" data-act="' + act + '"' + (opts.disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
  }

  function segmented(name, legend, options, checked) {
    return '<fieldset class="sim__scenario"><legend>' + esc(legend) + '</legend>' +
      options.map(function (o) {
        return '<label><input type="radio" name="' + name + '" value="' + esc(o.value) + '"' + (o.value === checked ? ' checked' : '') +
          '><span>' + esc(o.label) + '</span></label>';
      }).join('') + '</fieldset>';
  }

  /* --------------------------------------------------- Contexte d'exécution */

  function Context(root) {
    this.root = root;
    this.timers = [];
    this.intervals = [];
  }
  Context.prototype.later = function (fn, ms) {
    var id = window.setTimeout(fn, reduced ? Math.min(ms, 400) : ms);
    this.timers.push(id);
    return id;
  };
  Context.prototype.every = function (fn, ms) {
    var id = window.setInterval(fn, ms);
    this.intervals.push(id);
    return id;
  };
  Context.prototype.stop = function () {
    this.timers.forEach(window.clearTimeout);
    this.intervals.forEach(window.clearInterval);
    this.timers = [];
    this.intervals = [];
  };
  /** Signale au guide que l'action en cours est terminée. */
  Context.prototype.done = function () {
    var fn = this.onDone;
    this.onDone = null;
    if (fn) fn();
  };
  Context.prototype.highlight = function (sel) {
    var el = sel && this.root.querySelector(sel);
    this.$$('.is-spot').forEach(function (x) { x.classList.remove('is-spot'); });
    if (!el) return;
    el.classList.add('is-spot');
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  };
  Context.prototype.$ = function (sel) { return this.root.querySelector(sel); };
  Context.prototype.$$ = function (sel) { return Array.prototype.slice.call(this.root.querySelectorAll(sel)); };
  Context.prototype.status = function (text, tone) {
    var el = this.$('[data-status]');
    el.textContent = text;
    el.className = 'sim__status' + (tone ? ' is-' + tone : '');
  };
  Context.prototype.enable = function (map) {
    var self = this;
    Object.keys(map).forEach(function (act) {
      var b = self.$('[data-act="' + act + '"]');
      if (b) b.disabled = !map[act];
    });
  };

  /* -------------------------------------------------------------- Terminal */

  function Terminal(ctx, el, prompt) {
    this.ctx = ctx;
    this.el = el;
    this.prompt = prompt || '$';
    this.queue = [];
    this.busy = false;
  }
  Terminal.prototype.line = function (text, cls) {
    var div = document.createElement('div');
    div.className = 't-line' + (cls ? ' ' + cls : '');
    div.textContent = text;
    this.el.appendChild(div);
    while (this.el.childElementCount > 400) this.el.removeChild(this.el.firstChild);
    this.el.scrollTop = this.el.scrollHeight;
    return div;
  };
  Terminal.prototype.clear = function () { this.el.textContent = ''; this.queue = []; this.busy = false; };
  /** items : chaînes ('$ commande' pour une commande tapée) ou { t, c, d } (texte, classe, délai). */
  Terminal.prototype.run = function (items, done) {
    var self = this;
    items.forEach(function (it) { self.queue.push(typeof it === 'string' ? { t: it } : it); });
    if (done) this.queue.push({ fn: done });
    if (!this.busy) this.next();
  };
  Terminal.prototype.next = function () {
    var self = this;
    var it = this.queue.shift();
    if (!it) { this.busy = false; return; }
    this.busy = true;
    if (it.fn) { it.fn(); this.next(); return; }
    if (it.t.indexOf('$ ') === 0) {
      var cmd = it.t.slice(2);
      var div = this.line('', 't-cmd');
      var pr = document.createElement('span');
      pr.className = 't-prompt';
      pr.textContent = (it.p || this.prompt) + ' ';
      var tx = document.createElement('span');
      div.appendChild(pr);
      div.appendChild(tx);
      if (reduced) { tx.textContent = cmd; this.ctx.later(function () { self.next(); }, 150); return; }
      var i = 0;
      (function type() {
        i += 2;
        tx.textContent = cmd.slice(0, i);
        self.el.scrollTop = self.el.scrollHeight;
        if (i < cmd.length) self.ctx.later(type, 22);
        else self.ctx.later(function () { self.next(); }, 280);
      })();
      return;
    }
    this.line(it.t, it.c);
    this.ctx.later(function () { self.next(); }, it.d == null ? 70 : it.d);
  };

  function termHtml(label, extraCls) {
    return '<div class="term' + (extraCls ? ' ' + extraCls : '') + '" role="log" aria-label="' + esc(label) + '" tabindex="0" data-term></div>';
  }

  /* ---------------------------------------------------------- Graphiques SVG */

  function Chart(el, opts) {
    this.el = el;
    this.max = opts.max;
    this.threshold = opts.threshold;
    this.series = opts.series.map(function (s) { return { name: s.name, cls: s.cls, data: [] }; });
    this.points = opts.points || 40;
    var w = 300, h = 110;
    var grid = '';
    for (var g = 0; g <= 4; g++) {
      var y = (h / 4) * g;
      grid += '<line x1="0" x2="' + w + '" y1="' + y + '" y2="' + y + '" class="c-grid"/>';
    }
    var th = '';
    if (this.threshold != null) {
      var ty = h - (this.threshold / this.max) * h;
      th = '<line x1="0" x2="' + w + '" y1="' + ty + '" y2="' + ty + '" class="c-threshold"/>';
    }
    el.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' + grid + th +
      this.series.map(function (s) { return '<polyline class="c-line ' + s.cls + '" points=""/>'; }).join('') + '</svg>';
    this.lines = el.querySelectorAll('polyline');
    this.w = w;
    this.h = h;
  }
  Chart.prototype.push = function (values) {
    var self = this;
    this.series.forEach(function (s, i) {
      s.data.push(values[i]);
      if (s.data.length > self.points) s.data.shift();
      var step = self.w / (self.points - 1);
      var offset = self.points - s.data.length;
      self.lines[i].setAttribute('points', s.data.map(function (v, j) {
        return ((j + offset) * step).toFixed(1) + ',' + (self.h - clamp(v / self.max, 0, 1) * self.h).toFixed(1);
      }).join(' '));
    });
  };

  /* ======================================================= 1. Terraform / AWS */

  var TF_WORKFLOW = [
    'name: terraform',
    '',
    'on:',
    '  pull_request:',
    '    paths: ["infra/**"]',
    '  push:',
    '    branches: [main]',
    '    paths: ["infra/**"]',
    '',
    'permissions:',
    '  id-token: write        # OIDC vers AWS, aucune clé stockée',
    '  contents: read',
    '  pull-requests: write   # publication du plan en commentaire',
    '',
    'concurrency: terraform-prod   # un seul run à la fois sur le state',
    '',
    'jobs:',
    '  plan:',
    '    runs-on: ubuntu-latest',
    '    defaults: { run: { working-directory: infra } }',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: hashicorp/setup-terraform@v3',
    '      - uses: aws-actions/configure-aws-credentials@v4',
    '        with:',
    '          role-to-assume: arn:aws:iam::<compte>:role/github-terraform-plan  # lecture seule',
    '          aws-region: eu-west-3',
    '      - run: terraform init -input=false        # backend S3 chiffré',
    '      - run: terraform fmt -check -recursive',
    '      - run: terraform validate',
    '      - run: ../ci/iac-scan.sh                  # règles de sécurité IaC',
    '      - run: terraform plan -input=false -lock-timeout=5m -out=tfplan',
    '      - uses: actions/upload-artifact@v4',
    '        with: { name: tfplan, path: infra/tfplan }',
    '',
    '  apply:',
    '    if: github.event_name == \'push\'',
    '    needs: plan',
    '    environment: production   # approbation obligatoire',
    '    runs-on: ubuntu-latest',
    '    defaults: { run: { working-directory: infra } }',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: hashicorp/setup-terraform@v3',
    '      - uses: aws-actions/configure-aws-credentials@v4',
    '        with:',
    '          role-to-assume: arn:aws:iam::<compte>:role/github-terraform-apply',
    '          aws-region: eu-west-3',
    '      - uses: actions/download-artifact@v4',
    '        with: { name: tfplan, path: infra }',
    '      - run: terraform init -input=false',
    '      - run: terraform apply -input=false -lock-timeout=5m tfplan',
  ].join('\n');

  var terraform = {
    guide: {
      intro: 'Une infrastructure AWS gérée comme en entreprise : chaque changement passe par une Pull Request et le pipeline, le state est chiffré et verrouillé dans S3, et les suppressions dangereuses sont bloquées.',
      end: 'Vous avez vu le pipeline d’Infrastructure as Code de bout en bout : vérifications, plan relu dans la PR, approbation, apply par le pipeline avec OIDC, state S3 chiffré et verrouillé, évolution sans recréation et garde-fou contre la destruction de la base.',
      tip: 'Le fichier complet du pipeline est consultable sous le graphe des jobs.',
      steps: [
        { act: 'pr', btn: 'Ouvrir la Pull Request', title: 'Le pipeline vérifie la Pull Request', text: 'Le code est proposé dans une PR. Le pipeline enchaîne fmt, validate, l’analyse de sécurité de l’IaC, puis calcule le plan avec un rôle en lecture seule. Rien n’est modifié sur AWS.', spot: '.tfpipe' },
        { act: 'review', btn: 'Relire et approuver', title: 'Revue par un pair', text: 'Un relecteur lit le plan publié dans la PR. La branche main est protégée : pas de fusion sans checks verts ni approbation.', spot: '.tfpipe' },
        { act: 'apply', btn: 'Fusionner dans main', title: 'Le pipeline applique sur main', text: 'La fusion relance le pipeline sur main. Après l’approbation de l’environnement production, le job apply applique le plan avec un rôle dédié. Regardez le schéma AWS se construire.', spot: '.tfpipe' },
        { act: 'deploy', btn: 'Déployer l’application', title: 'Déployer l’application', text: 'Un autre pipeline publie l’application sur Kubernetes (EKS), puis vérifie qu’elle répond.', spot: '.aws-node--eks' },
        { act: 'change', btn: 'Passer à 3 nœuds', title: 'Faire évoluer l’infrastructure', text: 'Une nouvelle PR passe le groupe de nœuds EKS de 2 à 3. Tout le pipeline se rejoue : le plan montre une modification sur place, rien n’est recréé.', spot: '.tfpipe' },
        { act: 'guard', btn: 'Tester le garde-fou', title: 'Une destruction est bloquée', text: 'Une PR modifie l’identifiant de la base, ce qui forcerait sa recréation. Le job plan échoue sur prevent_destroy : approbation et apply n’ont jamais lieu.', spot: '.tfpipe' },
      ],
    },
    html: function (p) {
      var node = function (id, label, sub) {
        return '<div class="aws-node is-planned" data-node="' + id + '"><strong>' + esc(label) + '</strong><span>' + esc(sub) + '</span></div>';
      };
      var kv = function (label, value) { return '<li><span>' + esc(label) + '</span>' + value + '</li>'; };
      var stages = [
        { name: 'Vérifier', jobs: ['fmt', 'validate', 'iac-scan'] },
        { name: 'Planifier', jobs: ['plan'] },
        { name: 'Approuver', jobs: ['approbation'] },
        { name: 'Appliquer', jobs: ['apply'] },
      ];
      return {
        toolbar: '',
        body:
          '<section class="tfpipe" aria-label="Pipeline Terraform">' +
            '<div class="pipe-head"><span class="pstatus pstatus--idle" data-tfstatus>aucun run</span>' +
              '<span class="mono">.github/workflows/terraform.yml</span><span data-tfrun class="muted">en attente d’une Pull Request</span></div>' +
            '<div class="pipe pipe--tf" role="list">' + stages.map(function (st) {
              return '<div class="pipe__stage" role="listitem"><p class="pipe__name">' + esc(st.name) + '</p>' + st.jobs.map(function (j) {
                return '<div class="job job--idle" data-tfjob="' + j + '"><span class="job__icon" data-jicon></span><span>' + esc(j) + '</span></div>';
              }).join('') + '</div>';
            }).join('') + '</div>' +
            '<details class="workflow"><summary>Voir le fichier du pipeline</summary>' +
              '<pre class="code" tabindex="0" aria-label="Fichier .github/workflows/terraform.yml">' + esc(TF_WORKFLOW) + '</pre></details>' +
          '</section>' +
          '<div class="sim__split">' +
            '<div class="panel-dark"><div class="panel-dark__bar"><span></span><span></span><span></span><em>GitHub Actions · journal du run</em></div>' + termHtml('Journal du pipeline Terraform') + '</div>' +
            '<div class="side">' +
              '<div class="infocards">' +
                '<section class="card-sm" data-prcard><h3>Pull Request <small data-prnum>aucune</small></h3><p class="pr__title" data-prtitle>Aucune PR ouverte</p><ul class="kv" role="list">' +
                  kv('Checks', '<span class="state state--off" data-pr-checks>-</span>') +
                  kv('Revue', '<span class="state state--off" data-pr-review>-</span>') +
                  kv('Statut', '<span class="state state--off" data-pr-state>-</span>') + '</ul></section>' +
                '<section class="card-sm"><h3>State Terraform <small>backend S3</small></h3><ul class="kv" role="list">' +
                  kv('Bucket', '<span class="mono">tfstate-example</span>') +
                  kv('Clé', '<span class="mono">prod/terraform.tfstate</span>') +
                  kv('Chiffrement', '<span>SSE-KMS</span>') +
                  kv('Versioning', '<span>activé</span>') +
                  kv('Verrou', '<span class="state state--off" data-lock>libre</span>') +
                  kv('Version', '<span class="mono" data-stver>vide</span>') + '</ul></section>' +
              '</div>' +
              '<div class="aws" aria-label="Architecture AWS">' +
                '<p class="aws__title">Architecture AWS <span data-count>0/' + p.resources.length + ' ressources</span></p>' +
                '<div class="aws__edge">' + node('route53', 'Route 53', p.domain) + '<i></i>' + node('cloudfront', 'CloudFront', 'CDN') + '<i></i>' + node('alb', 'ALB', 'Load balancer') + '</div>' +
                '<div class="aws-vpc is-planned" data-node="vpc"><span class="aws-vpc__label">VPC · 2 sous-réseaux privés</span>' +
                  '<div class="aws-node is-planned aws-node--eks" data-node="eks"><strong>EKS</strong><span>Kubernetes · <span data-nodes>2 nœuds</span></span><div class="pods" data-pods></div></div>' +
                  node('rds', 'RDS', 'PostgreSQL · prevent_destroy') +
                '</div>' +
                '<div class="aws__side">' + node('s3', 'S3', 'Assets') + node('iam', 'IAM', 'Rôles') + '</div>' +
              '</div>' +
            '</div>' +
          '</div>',
      };
    },
    init: function (ctx, p) {
      var term = new Terminal(ctx, ctx.$('[data-term]'));
      var total = p.resources.length;
      var created = 0;
      var version = 0;
      var count = ctx.$('[data-count]');
      var JOBS = ['fmt', 'validate', 'iac-scan', 'plan', 'approbation', 'apply'];
      var JOB_ICON = { idle: '', pending: 'dot', running: 'dot', passed: 'check', failed: 'x', skipped: 'skip' };
      var JOB_LABEL = { idle: 'pas encore lancé', pending: 'en attente', running: 'en cours', passed: 'réussi', failed: 'échec', skipped: 'ignoré' };

      function setNode(id, state) {
        var el = ctx.$('[data-node="' + id + '"]');
        if (el) el.className = el.className.replace(/is-\w+/, 'is-' + state);
      }
      function pill(sel, tone, text) {
        var el = ctx.$(sel);
        el.className = 'state state--' + tone;
        el.textContent = text;
      }
      function job(name, st) {
        var el = ctx.$('[data-tfjob="' + name + '"]');
        el.className = 'job job--' + st;
        el.querySelector('[data-jicon]').innerHTML = JOB_ICON[st] ? svg(JOB_ICON[st], 'icon icon--xs') : '';
        el.setAttribute('aria-label', name + ' : ' + JOB_LABEL[st]);
      }
      function J(name, st) { return { fn: function () { job(name, st); } }; }
      function runHead(st, label, text) {
        return { fn: function () {
          var el = ctx.$('[data-tfstatus]');
          el.className = 'pstatus pstatus--' + st;
          el.textContent = label;
          ctx.$('[data-tfrun]').textContent = text;
        } };
      }
      function newRun(text, applyToo) {
        return { fn: function () {
          JOBS.forEach(function (j) { job(j, 'pending'); });
          if (!applyToo) job('apply', 'idle');
          var el = ctx.$('[data-tfstatus]');
          el.className = 'pstatus pstatus--running';
          el.textContent = 'en cours';
          ctx.$('[data-tfrun]').textContent = text;
        } };
      }
      function openPr(num, title) {
        ctx.$('[data-prnum]').textContent = '#' + num;
        ctx.$('[data-prtitle]').textContent = title;
        pill('[data-pr-checks]', 'warn', 'en cours');
        pill('[data-pr-review]', 'off', 'en attente');
        pill('[data-pr-state]', 'off', 'ouverte');
      }
      function lock(on) { pill('[data-lock]', on ? 'warn' : 'off', on ? 'verrouillé' : 'libre'); }
      function saveState() { version++; ctx.$('[data-stver]').textContent = 'v' + version; }
      function prefix(addr) { return addr.split('.')[0].replace('aws_', '').split('_')[0]; }

      var INIT = [
        '$ terraform init -input=false',
        { t: 'Initializing the backend...', c: 't-muted' },
        { t: 'Successfully configured the backend "s3"! Terraform will automatically', c: 't-ok' },
        { t: 'use this backend unless the backend configuration changes.', c: 't-ok' },
        { t: '- Reusing previous version of hashicorp/aws from the dependency lock file', c: 't-muted' },
        { t: 'Terraform has been successfully initialized!', c: 't-ok', d: 200 },
      ];
      var LOCK = [{ t: 'Acquiring state lock. This may take a few moments...', c: 't-muted', d: 300 }, { fn: function () { lock(true); } }];
      var UNLOCK = [{ t: 'Releasing state lock. This may take a few moments...', c: 't-muted', d: 250 }, { fn: function () { lock(false); } }];
      var PLAN = '$ terraform plan -input=false -lock-timeout=5m -out=tfplan';
      var APPLY = '$ terraform apply -input=false -lock-timeout=5m tfplan';

      /** Job plan complet : OIDC lecture seule, init, fmt, validate, scan IaC, plan. */
      function planJob(header, planBody, opts) {
        opts = opts || {};
        var lines = [{ t: '', d: 0 }, { t: header, c: 't-strong', d: 200 },
          { t: '# OIDC : rôle github-terraform-plan (lecture seule)', c: 't-muted' }].concat(INIT, [
          J('fmt', 'running'), '$ terraform fmt -check -recursive', J('fmt', 'passed'),
          J('validate', 'running'), '$ terraform validate', { t: 'Success! The configuration is valid.', c: 't-ok' }, J('validate', 'passed'),
          J('iac-scan', 'running'), '$ ../ci/iac-scan.sh',
          { t: 'Contrôles : chiffrement S3 et RDS, buckets non publics, groupes de sécurité, journaux activés', c: 't-muted' },
          { t: 'Passed checks: ' + randInt(40, 60) + ', Failed checks: 0', c: 't-ok' }, J('iac-scan', 'passed'),
          J('plan', 'running'), PLAN,
        ], LOCK, planBody);
        if (!opts.fails) lines = lines.concat(UNLOCK, [J('plan', 'passed')]);
        return lines;
      }

      term.run([
        { t: '# Le code Terraform est dans Git. Le state est dans S3 (chiffré, versionné, verrouillé).', c: 't-muted', d: 0 },
        { t: '# Aucun apply depuis un poste : tout passe par une Pull Request et le pipeline.', c: 't-muted', d: 0 },
      ]);

      function applyRun(header, applyBody, done) {
        var lines = [{ t: '', d: 0 }, { t: '# PR fusionnée : le pipeline se relance sur main.', c: 't-muted' }, newRun('push main · environnement production', true)]
          .concat(planJob(header + ' · job plan', [{ t: 'Plan identique à celui relu dans la PR.', c: 't-muted', d: 200 }]), [
            J('approbation', 'running'),
            { t: '⏸ En attente d’approbation : environnement « production »', c: 't-muted', d: 700 },
            { t: '✓ Déploiement en production approuvé', c: 't-ok' },
            J('approbation', 'passed'),
            J('apply', 'running'),
            { t: header + ' · job apply', c: 't-strong', d: 200 },
            { t: '# OIDC : rôle github-terraform-apply', c: 't-muted' },
            '$ aws sts get-caller-identity --query Arn',
            '"arn:aws:sts::************:assumed-role/github-terraform-apply/GitHubActions"',
            { t: '# tfplan : artefact du job plan, exactement ce qui a été relu', c: 't-muted' },
            APPLY,
          ], LOCK);
        term.run(lines, function () { applyBody(function (tail) {
          term.run(tail.concat([{ fn: saveState }], UNLOCK, [J('apply', 'passed'), runHead('passed', 'réussi', 'push main · environnement production')]), done);
        }); });
      }

      return {
        action: function (act) {
          if (act === 'pr') {
            openPr(42, 'feat: socle AWS de production (VPC, EKS, RDS)');
            ctx.status('Le pipeline vérifie la Pull Request…');
            var body = [{ t: 'Terraform will perform the following actions:', d: 200 }];
            p.resources.forEach(function (r) { body.push({ t: '  + ' + r.addr, c: 't-add', d: 45 }); });
            body.push({ t: 'Plan: ' + total + ' to add, 0 to change, 0 to destroy.', c: 't-strong', d: 200 });
            term.run([newRun('pull_request #42', false)].concat(planJob('▶ terraform.yml · pull_request #42 · job plan', body), [
              { t: '✓ Plan publié en commentaire de la PR #42', c: 't-ok' },
              runHead('passed', 'checks verts', 'pull_request #42 · en attente de revue'),
            ]), function () {
              pill('[data-pr-checks]', 'ok', 'réussis');
              ctx.status('Checks verts et plan publié dans la PR : ' + total + ' créations, aucune suppression. Rien n’a été modifié sur AWS.', 'ok');
              ctx.done();
            });
          }

          if (act === 'review') {
            ctx.status('Revue en cours…');
            term.run([
              { t: '', d: 0 },
              J('approbation', 'running'),
              { t: '# Revue : le relecteur lit le plan publié dans la PR.', c: 't-muted', d: 700 },
              { t: '✓ Approuvée par un relecteur (règle : 1 approbation minimum)', c: 't-ok', d: 500 },
              J('approbation', 'passed'),
              { t: '✓ main protégée : checks verts et approbation présents, fusion autorisée', c: 't-ok', d: 300 },
              runHead('passed', 'approuvée', 'pull_request #42 · prête à fusionner'),
            ], function () {
              pill('[data-pr-review]', 'ok', 'approuvée');
              ctx.status('PR approuvée. La fusion dans main déclenchera l’apply par le pipeline, jamais depuis un poste.', 'ok');
              ctx.done();
            });
          }

          if (act === 'apply') {
            pill('[data-pr-state]', 'ok', 'fusionnée');
            ctx.status('Pipeline sur main : vérifications, plan, approbation puis apply…');
            applyRun('▶ terraform.yml · push main', function (finish) {
              var i = 0;
              (function nextRes() {
                if (i >= p.resources.length) {
                  finish([
                    { t: 'Apply complete! Resources: ' + total + ' added, 0 changed, 0 destroyed.', c: 't-ok t-strong', d: 200 },
                    { t: '# State enregistré dans S3 : chiffré (SSE-KMS), ancienne version conservée', c: 't-muted' },
                    { t: 'app_url = "https://' + p.domain + '"', d: 60 },
                  ]);
                  return;
                }
                var r = p.resources[i++];
                setNode(r.node, 'creating');
                var items = [{ t: r.addr + ': Creating...', d: r.slow ? 400 : 180 }];
                if (r.slow) items.push({ t: r.addr + ': Still creating... [10s elapsed]', c: 't-muted', d: 400 });
                items.push({ t: r.addr + ': Creation complete after ' + (r.slow ? randInt(14, 29) : randInt(1, 4)) + 's [id=' + prefix(r.addr) + '-' + hex(8) + ']', c: 't-ok', d: 90 });
                term.run(items, function () {
                  created++;
                  count.textContent = created + '/' + total + ' ressources';
                  var remaining = p.resources.slice(i).some(function (x) { return x.node === r.node; });
                  setNode(r.node, remaining ? 'creating' : 'ready');
                  nextRes();
                });
              })();
            }, function () {
              ctx.status('Infrastructure créée par le pipeline. State v1 enregistré dans S3, verrou libéré.', 'ok');
              ctx.done();
            });
          }

          if (act === 'deploy') {
            ctx.status('Le pipeline de l’application publie la nouvelle version…');
            var pods = ctx.$('[data-pods]');
            term.run([
              { t: '', d: 0 },
              { t: '▶ deploy.yml · push main · job deploy (pipeline de l’application)', c: 't-strong', d: 200 },
              { t: '✓ image construite et poussée (tag = SHA du commit)', c: 't-ok', d: 250 },
              '$ aws eks update-kubeconfig --name main',
              { t: 'Updated context arn:aws:eks:…:cluster/main', c: 't-muted' },
              '$ kubectl apply -f k8s/',
              { t: 'deployment.apps/api configured', d: 120 },
              '$ kubectl rollout status deployment/api --timeout=5m',
            ], function () {
              var n = 0;
              (function addPod() {
                if (n >= 3) {
                  term.run([
                    { t: 'deployment "api" successfully rolled out', c: 't-ok', d: 200 },
                    '$ curl -sI https://' + p.domain,
                    { t: 'HTTP/2 200', c: 't-ok t-strong', d: 80 },
                  ], function () {
                    ctx.status('Application en ligne sur https://' + p.domain + ' (exemple), mise à jour progressive sans coupure.', 'ok');
                    ctx.done();
                  });
                  return;
                }
                n++;
                var pod = document.createElement('span');
                pod.className = 'pod';
                pods.appendChild(pod);
                term.run([{ t: 'Waiting for deployment "api" rollout to finish: ' + n + ' of 3 updated replicas are available...', c: 't-muted', d: 300 }], addPod);
              })();
            });
          }

          if (act === 'change') {
            openPr(43, 'feat: groupe de nœuds EKS de 2 à 3');
            setNode('eks', 'creating');
            ctx.status('Nouvelle PR : tout le pipeline se rejoue.');
            var diff = [
              { t: '', d: 0 },
              '$ git diff main -- eks.tf',
              { t: '   scaling_config {', c: 't-muted' },
              { t: '-    desired_size = 2', c: 't-bad' },
              { t: '+    desired_size = 3', c: 't-add' },
              { t: '   }', c: 't-muted' },
            ];
            var body43 = [
              { t: '  # aws_eks_node_group.default will be updated in-place', d: 150 },
              { t: '  ~ resource "aws_eks_node_group" "default" {', c: 't-strong' },
              { t: '      ~ scaling_config {' },
              { t: '          ~ desired_size = 2 -> 3', c: 't-strong' },
              { t: '        }' },
              { t: 'Plan: 0 to add, 1 to change, 0 to destroy.', c: 't-strong', d: 200 },
            ];
            term.run(diff.concat([newRun('pull_request #43', false)], planJob('▶ terraform.yml · pull_request #43 · job plan', body43), [
              { t: '✓ Plan publié en commentaire de la PR #43', c: 't-ok' },
              { fn: function () { pill('[data-pr-checks]', 'ok', 'réussis'); } },
              J('approbation', 'running'),
              { t: '✓ Plan relu et approuvé', c: 't-ok', d: 500 },
              J('approbation', 'passed'),
              { fn: function () { pill('[data-pr-review]', 'ok', 'approuvée'); pill('[data-pr-state]', 'ok', 'fusionnée'); } },
            ]), function () {
              applyRun('▶ terraform.yml · push main', function (finish) {
                finish([
                  { t: 'aws_eks_node_group.default: Modifying... [id=main:default]', d: 450 },
                  { t: 'aws_eks_node_group.default: Still modifying... [10s elapsed]', c: 't-muted', d: 450 },
                  { t: 'aws_eks_node_group.default: Modifications complete after ' + randInt(40, 70) + 's [id=main:default]', c: 't-ok', d: 150 },
                  { t: 'Apply complete! Resources: 0 added, 1 changed, 0 destroyed.', c: 't-ok t-strong', d: 200 },
                ]);
              }, function () {
                ctx.$('[data-nodes]').textContent = '3 nœuds';
                setNode('eks', 'ready');
                ctx.status('Modification appliquée sur place par le pipeline : 3 nœuds, aucune ressource recréée, state v' + version + '.', 'ok');
                ctx.done();
              });
            });
          }

          if (act === 'guard') {
            openPr(44, 'chore: renommer l’instance RDS');
            setNode('rds', 'danger');
            ctx.status('Une PR modifie l’identifiant de la base de production…');
            var errorBody = [
              { t: '╷', c: 't-bad' },
              { t: '│ Error: Instance cannot be destroyed', c: 't-bad t-strong' },
              { t: '│', c: 't-bad' },
              { t: '│   on rds.tf line 1:', c: 't-bad' },
              { t: '│    1: resource "aws_db_instance" "postgres" {', c: 't-bad' },
              { t: '│', c: 't-bad' },
              { t: '│ Resource aws_db_instance.postgres has lifecycle.prevent_destroy set,', c: 't-bad' },
              { t: '│ but the plan calls for this resource to be destroyed.', c: 't-bad' },
              { t: '╵', c: 't-bad', d: 200 },
            ];
            term.run([
              { t: '', d: 0 },
              '$ git diff main -- rds.tf',
              { t: '-  identifier = "app-prod"', c: 't-bad' },
              { t: '+  identifier = "app-production"', c: 't-add' },
              newRun('pull_request #44', false),
            ].concat(planJob('▶ terraform.yml · pull_request #44 · job plan', errorBody, { fails: true }), UNLOCK, [
              J('plan', 'failed'),
              J('approbation', 'skipped'),
              J('apply', 'skipped'),
              runHead('failed', 'échec', 'pull_request #44 · fusion bloquée'),
              { t: '✗ Check « terraform / plan » en échec : fusion de la PR #44 bloquée', c: 't-bad t-strong' },
              { t: '# Changer l’identifiant forcerait la recréation de la base : refusé.', c: 't-muted' },
              { t: '# Une migration de base se planifie (sauvegarde, fenêtre, bascule), pas par un simple renommage.', c: 't-muted' },
            ]), function () {
              pill('[data-pr-checks]', 'bad', 'échec');
              pill('[data-pr-state]', 'bad', 'bloquée');
              setNode('rds', 'ready');
              ctx.status('Garde-fou déclenché : le job plan échoue, approbation et apply n’ont jamais lieu. La base de production est intacte.', 'ok');
              ctx.done();
            });
          }
        },
      };
    },
  };

  /* ================================================ 2. Conteneurs (Compose) */

  var containers = {
    guide: {
      intro: 'Un incident de production très courant : le disque du serveur se remplit. Vous allez voir la panne, la diagnostiquer, rétablir le service sans toucher aux données, puis empêcher qu’elle se reproduise.',
      end: 'Vous avez vu un incident traité de bout en bout : détection, diagnostic, remise en service sans perte de données, puis correction de la cause racine.',
      steps: [
        { act: 'deploy', btn: 'Déployer la version 1.4.2', title: 'Déployer une version', text: 'Le pipeline récupère les images versionnées et démarre les services dans l’ordre : la base, le cache et la file de messages doivent être prêts avant l’API.', spot: '.table-wrap' },
        { act: 'incident', btn: 'Laisser tourner', title: 'Le disque se remplit', text: 'Les logs du worker grossissent sans limite. Regardez la jauge du disque : à 100 %, PostgreSQL ne peut plus écrire et l’API renvoie des erreurs.', spot: '.host' },
        { act: 'diagnose', btn: 'Diagnostiquer', title: 'Trouver la cause', text: 'On lit les logs de la base, on mesure l’espace disque et on cherche ce qui l’occupe.', spot: '.panel-dark' },
        { act: 'fix', btn: 'Libérer de l’espace', title: 'Rétablir le service', text: 'On supprime les anciennes images et on vide le fichier de logs en cause. Les volumes de données ne sont jamais touchés. PostgreSQL redémarre et se rétablit seul.', spot: '.table-wrap' },
        { act: 'prevent', btn: 'Corriger la cause', title: 'Empêcher que ça recommence', text: 'Une PR ajoute la rotation des logs, et une alerte disque est créée pour être prévenu bien avant la panne.', spot: '.panel-dark' },
      ],
    },
    html: function (p) {
      return {
        toolbar: '',
        body: '<div class="host">' +
            ['CPU', 'Mémoire', 'Disque /'].map(function (k, i) {
              return '<div class="gauge" data-gauge="' + i + '"><span>' + k + ' de l’hôte</span><strong data-host="' + i + '">0 %</strong><div class="bar"><i data-hostbar="' + i + '"></i></div></div>';
            }).join('') +
          '</div>' +
          '<div class="table-wrap" tabindex="0" role="region" aria-label="Conteneurs"><table class="ctable"><thead><tr><th scope="col">Service</th><th scope="col">Image</th><th scope="col">État</th><th scope="col">CPU</th><th scope="col">Mémoire</th></tr></thead><tbody>' +
            p.services.map(function (s) {
              return '<tr data-svc="' + esc(s.name) + '"><td><strong>' + esc(s.name) + '</strong></td><td class="mono">' + esc(s.image) + '</td>' +
                '<td><span class="state state--off" data-state>absent</span></td><td class="mono" data-cpu>-</td><td class="mono" data-mem>-</td></tr>';
            }).join('') +
          '</tbody></table></div>' +
          '<div class="panel-dark"><div class="panel-dark__bar"><span></span><span></span><span></span><em>srv-prod-01 · docker compose logs -f</em></div>' + termHtml('Logs et commandes', 'term--logs') + '</div>',
      };
    },
    init: function (ctx, p) {
      var term = new Terminal(ctx, ctx.$('[data-term]'));
      var state = {};
      var running = false;
      var pgDown = false;
      var noisy = true;
      var paused = false;
      var disk = 61;
      var MEM = { postgres: 180, redis: 12, rabbitmq: 140, api: 210, worker: 160, caddy: 35 };
      p.services.forEach(function (s) { state[s.name] = 'absent'; });

      function setState(name, st) {
        state[name] = st;
        var row = ctx.$('tr[data-svc="' + name + '"]');
        var map = {
          absent: ['off', 'absent'], starting: ['warn', 'starting'], healthy: ['ok', 'Up (healthy)'], up: ['ok', 'Up'],
          unhealthy: ['bad', 'Up (unhealthy)'], restarting: ['bad', 'Restarting (1)'],
        };
        var m = map[st];
        var cell = row.querySelector('[data-state]');
        cell.className = 'state state--' + m[0];
        cell.textContent = m[1];
        row.classList.toggle('is-bad', m[0] === 'bad');
        if (st === 'absent' || st === 'restarting') { row.querySelector('[data-cpu]').textContent = '-'; row.querySelector('[data-mem]').textContent = '-'; }
      }
      function log(svc, text, cls) { if (!paused) term.line(pad(svc + '-1', 11) + '| ' + text, cls || 't-svc-' + svc); }
      function setDisk(v) {
        disk = v;
        ctx.$('[data-gauge="2"]').classList.toggle('is-bad', v >= 95);
      }

      function tick() {
        var total = 0;
        p.services.forEach(function (s) {
          var st = state[s.name];
          if (st === 'absent' || st === 'restarting') return;
          var cpu = s.name === 'api' ? (pgDown ? rand(1, 4) : rand(8, 22)) : s.name === 'worker' ? rand(3, 12) : s.name === 'postgres' ? rand(4, 15) : rand(0.3, 3);
          total += cpu;
          var row = ctx.$('tr[data-svc="' + s.name + '"]');
          row.querySelector('[data-cpu]').textContent = cpu.toFixed(1) + ' %';
          row.querySelector('[data-mem]').textContent = Math.round(MEM[s.name] * rand(0.95, 1.08)) + ' Mo';
        });
        var vals = [clamp(total / 2 + rand(3, 6), 0, 100), running ? rand(38, 46) : 12, disk];
        vals.forEach(function (v, i) {
          ctx.$('[data-host="' + i + '"]').textContent = Math.round(v) + ' %';
          ctx.$('[data-hostbar="' + i + '"]').style.width = v + '%';
        });
      }

      var PATHS = ['/api/orders', '/api/products', '/api/health', '/api/cart'];
      function traffic() {
        if (!running || paused) return;
        var path = pick(PATHS);
        if (pgDown) {
          log('caddy', '{"level":"error","status":500,"method":"GET","uri":"' + path + '"}', 't-bad');
          if (Math.random() < 0.5) log('api', 'ERROR could not connect to server: Connection refused (postgres:5432)', 't-bad');
          if (Math.random() < 0.3) log('postgres', 'PANIC:  could not write to file "pg_wal/xlogtemp.' + randInt(80, 99) + '": No space left on device', 't-bad');
          return;
        }
        var ms = randInt(4, 38);
        log('caddy', '{"level":"info","status":200,"method":"GET","uri":"' + path + '","duration":' + (ms / 1000).toFixed(3) + '}');
        var r = Math.random();
        if (r < 0.3) log('api', 'INFO  request completed method=GET path=' + path + ' status=200 duration=' + ms + 'ms');
        else if (r < 0.55) log('worker', 'INFO  job processed queue=' + pick(['emails', 'invoices', 'notifications']) + ' duration=' + randInt(20, 180) + 'ms');
        else if (r < 0.6) log('redis', '* ' + randInt(10, 99) + ' changes in 60 seconds. Saving...');
        if (noisy && Math.random() < 0.7) log('worker', 'DEBUG payload=' + hex(24) + '… headers={…} retries=0', 't-muted');
      }

      ctx.every(tick, 1000);
      ctx.every(traffic, 650);
      term.run([{ t: '# Serveur de production. Les déploiements passent par le pipeline, pas à la main.', c: 't-muted', d: 0 }]);

      function run(lines, cb) { paused = true; term.run(lines, function () { paused = false; if (cb) cb(); }); }

      return {
        action: function (act) {
          if (act === 'deploy') {
            ctx.status('Déploiement de la version 1.4.2…');
            run([
              { t: '▶ deploy.yml · job deploy · production · v1.4.2', c: 't-strong', d: 200 },
              '$ docker compose pull',
              { t: ' ✔ api Pulled', c: 't-ok' }, { t: ' ✔ worker Pulled', c: 't-ok' },
              '$ docker compose up -d --remove-orphans',
            ], function () {
              var order = [['postgres', 'redis', 'rabbitmq'], ['api', 'worker'], ['caddy']];
              var g = 0;
              (function startGroup() {
                if (g >= order.length) {
                  running = true;
                  log('api', 'INFO  connected to PostgreSQL, Redis and RabbitMQ', 't-ok');
                  ctx.status('Version 1.4.2 en production : 6 conteneurs sains, trafic en cours.', 'ok');
                  ctx.done();
                  return;
                }
                var group = order[g++];
                group.forEach(function (n) { setState(n, 'starting'); term.line(' ✔ Container app-' + n + '-1  Started', 't-ok'); });
                ctx.later(function () {
                  group.forEach(function (n) {
                    var svc = p.services.filter(function (s) { return s.name === n; })[0];
                    setState(n, svc.health ? 'healthy' : 'up');
                    if (svc.health) term.line(' ✔ Container app-' + n + '-1  Healthy', 't-ok');
                  });
                  startGroup();
                }, 800);
              })();
            });
          }

          if (act === 'incident') {
            ctx.status('Le disque se remplit avec les logs du worker…', 'warn');
            (function grow() {
              if (disk >= 100) {
                setDisk(100);
                pgDown = true;
                setState('postgres', 'restarting');
                log('postgres', 'PANIC:  could not write to file "pg_wal/xlogtemp.84": No space left on device', 't-bad');
                log('postgres', 'LOG:  server process (PID 112) was terminated by signal 6: Aborted', 't-bad');
                ctx.later(function () {
                  setState('api', 'unhealthy');
                  ctx.status('Disque plein : PostgreSQL redémarre en boucle et l’API renvoie des erreurs 500.', 'bad');
                  ctx.done();
                }, 1500);
                return;
              }
              setDisk(Math.min(100, disk + randInt(3, 6)));
              ctx.later(grow, 450);
            })();
          }

          if (act === 'diagnose') {
            ctx.status('Diagnostic en cours…');
            run([
              { t: '', d: 0 },
              '$ docker compose ps postgres',
              { t: 'NAME             IMAGE         STATUS', c: 't-strong' },
              { t: 'app-postgres-1   postgres:16   Restarting (1) 4 seconds ago', c: 't-bad' },
              '$ docker compose logs --tail=1 postgres',
              { t: 'postgres-1 | PANIC:  could not write to file "pg_wal/xlogtemp.84": No space left on device', c: 't-bad' },
              '$ df -h /',
              { t: 'Filesystem      Size  Used Avail Use% Mounted on', c: 't-strong' },
              { t: '/dev/sda1        80G   80G     0 100% /', c: 't-bad' },
              '$ docker system df',
              { t: 'TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE', c: 't-strong' },
              'Images          41        6         27.9GB    22.6GB (81%)',
              'Containers      6         6         1.2GB     0B (0%)',
              'Local Volumes   3         3         9.4GB     0B (0%)',
              '$ sudo du -sh /var/lib/docker/containers/*/*-json.log | sort -h | tail -1',
              { t: '19G   /var/lib/docker/containers/7f3c' + hex(6) + '…/7f3c…-json.log', c: 't-bad' },
              '$ docker ps --filter id=7f3c --format "{{.Names}}"',
              'app-worker-1',
              { t: '# Cause : logs du worker sans rotation (19 Go) + anciennes images (22,6 Go récupérables).', c: 't-warn t-strong', d: 0 },
            ], function () {
              ctx.status('Cause trouvée : 19 Go de logs du worker sans rotation et 22,6 Go d’anciennes images.', 'warn');
              ctx.done();
            });
          }

          if (act === 'fix') {
            ctx.status('Libération d’espace…');
            run([
              { t: '', d: 0 },
              { t: '# On ne purge jamais les volumes : ils contiennent les données PostgreSQL.', c: 't-muted' },
              '$ docker image prune -a -f --filter "until=168h"',
              { t: 'Total reclaimed space: 22.6GB', c: 't-ok' },
              { fn: function () { setDisk(72); } },
              '$ sudo truncate -s 0 "$(docker inspect --format \'{{.LogPath}}\' app-worker-1)"',
              { fn: function () { setDisk(48); } },
              '$ df -h /',
              { t: 'Filesystem      Size  Used Avail Use% Mounted on', c: 't-strong' },
              { t: '/dev/sda1        80G   38G   42G  48% /', c: 't-ok' },
            ], function () {
              setState('postgres', 'starting');
              log('postgres', 'LOG:  database system was interrupted; last known up at ' + clock(-120), 't-muted');
              log('postgres', 'LOG:  database system was not properly shut down; automatic recovery in progress', 't-muted');
              ctx.later(function () {
                log('postgres', 'LOG:  redo done at 0/3A2F1C8', 't-muted');
                log('postgres', 'LOG:  database system is ready to accept connections', 't-ok');
                setState('postgres', 'healthy');
                ctx.later(function () {
                  pgDown = false;
                  setState('api', 'healthy');
                  log('api', 'INFO  reconnected to PostgreSQL', 't-ok');
                  ctx.status('Service rétabli sans perte de données : PostgreSQL a rejoué son journal et l’API répond de nouveau.', 'ok');
                  ctx.done();
                }, 1000);
              }, 1400);
            });
          }

          if (act === 'prevent') {
            ctx.status('Correction de la cause racine…');
            run([
              { t: '', d: 0 },
              { t: '▶ PR #57 · rotation des logs Docker', c: 't-strong' },
              '$ git diff docker-compose.yml',
              { t: '   worker:', c: 't-muted' },
              { t: '+    logging:', c: 't-add' },
              { t: '+      driver: json-file', c: 't-add' },
              { t: '+      options:', c: 't-add' },
              { t: '+        max-size: "10m"', c: 't-add' },
              { t: '+        max-file: "3"', c: 't-add' },
              { t: '✓ Revue, fusion et déploiement par le pipeline', c: 't-ok', d: 400 },
              '$ docker compose up -d worker',
              { t: ' ✔ Container app-worker-1  Started', c: 't-ok' },
              { t: '# Logs du worker repassés en niveau INFO (plus de DEBUG en production).', c: 't-muted' },
              { t: '# Supervision : alerte si disque > 85 % pendant 10 min, pour agir avant la panne.', c: 't-muted' },
            ], function () {
              noisy = false;
              ctx.status('Rotation des logs en place et alerte disque créée : cet incident ne peut plus se reproduire de la même façon.', 'ok');
              ctx.done();
            });
          }
        },
      };
    },
  };

  /* ================================================= 3. Pipeline DevSecOps */

  var JOB_LOGS = {
    'build-image': function () {
      return ['$ docker build -t registry.example.com/app/api:$CI_COMMIT_SHORT_SHA .',
        'Step 1/9 : FROM node:20-alpine', 'Step 4/9 : RUN npm ci --omit=dev', 'Step 9/9 : CMD ["node", "server.js"]',
        { t: 'Successfully built ' + hex(12), c: 't-ok' }, '$ docker push registry.example.com/app/api:' + hex(8),
        { t: 'Job succeeded', c: 't-ok t-strong' }];
    },
    'unit-tests': function () {
      var n = randInt(120, 180);
      return ['$ npm ci', 'added ' + randInt(500, 800) + ' packages in ' + randInt(8, 15) + 's', '$ npm test',
        { t: 'Test Suites: ' + randInt(20, 30) + ' passed', c: 't-ok' }, { t: 'Tests:       ' + n + ' passed, ' + n + ' total', c: 't-ok' },
        { t: 'Job succeeded', c: 't-ok t-strong' }];
    },
    gitleaks: function (sc) {
      var head = ['$ gitleaks detect --source . --redact -v', { t: '    ○', c: 't-muted' }, { t: '    │╲', c: 't-muted' }, { t: '    │ ○', c: 't-muted' },
        { t: '    ○ ░', c: 't-muted' }, { t: '    ░    gitleaks', c: 't-muted' }];
      if (sc === 'secret') {
        return head.concat([
          { t: 'Finding:     aws_secret_access_key = "REDACTED"', c: 't-bad' },
          { t: 'Secret:      REDACTED', c: 't-bad' },
          'RuleID:      aws-access-token', 'Entropy:     4.82', 'File:        config/settings.py', 'Line:        12',
          'Commit:      ' + hex(7), 'Author:      dev',
          { t: randInt(1100, 1400) + ' commits scanned.', c: 't-muted' },
          { t: 'WRN leaks found: 1', c: 't-bad t-strong' },
          { t: 'ERROR: Job failed: exit code 1', c: 't-bad t-strong' }]);
      }
      return head.concat([{ t: randInt(1100, 1400) + ' commits scanned.', c: 't-muted' }, 'scan completed in ' + rand(0.8, 2).toFixed(1) + 's',
        { t: 'INF no leaks found', c: 't-ok' }, { t: 'Job succeeded', c: 't-ok t-strong' }]);
    },
    'dependency-scan': function (sc) {
      var head = ['$ ./ci/scan-dependencies.sh package-lock.json', 'Analyse de ' + randInt(600, 900) + ' dépendances…', 'Politique : échec si sévérité >= HIGH'];
      if (sc === 'vuln') {
        return head.concat([
          { t: 'HIGH      CVE-2021-23337  lodash  4.17.20  (corrigé en 4.17.21)', c: 't-bad' },
          { t: '          Command injection via template()', c: 't-muted' },
          { t: 'Total : 1 (HIGH: 1, CRITICAL: 0)', c: 't-bad' },
          { t: 'ERROR: Job failed: exit code 1', c: 't-bad t-strong' }]);
      }
      return head.concat([{ t: 'Total : 0 (HIGH: 0, CRITICAL: 0)', c: 't-ok' }, { t: 'Job succeeded', c: 't-ok t-strong' }]);
    },
    'container-scan': function () {
      return ['$ ./ci/scan-image.sh registry.example.com/app/api:' + hex(8), 'Analyse des couches de l’image…', 'OS : alpine 3.19',
        { t: 'Total : 0 (HIGH: 0, CRITICAL: 0)', c: 't-ok' }, { t: 'Job succeeded', c: 't-ok t-strong' }];
    },
    'deploy-production': function () {
      return [{ t: '✓ Déploiement approuvé (environnement production protégé)', c: 't-ok' },
        '$ vault login -method=jwt role=ci-deploy jwt=$VAULT_ID_TOKEN', { t: 'Success! You are now authenticated.', c: 't-ok' },
        '$ export DATABASE_URL=$(vault kv get -field=url secret/app/prod/db)', { t: 'Secret chargé en mémoire, jamais écrit dans le dépôt.', c: 't-muted' },
        '$ aws sts assume-role-with-web-identity --role-arn arn:aws:iam::************:role/deploy --web-identity-token $AWS_ID_TOKEN …',
        { t: 'Identifiants temporaires obtenus par OIDC (expiration : 1 h), aucune clé stockée', c: 't-muted' },
        '$ kubectl set image deployment/api api=registry.example.com/app/api:' + hex(8),
        '$ kubectl rollout status deployment/api', { t: 'deployment "api" successfully rolled out', c: 't-ok' },
        { t: 'Job succeeded', c: 't-ok t-strong' }];
    },
  };

  var pipeline = {
    guide: {
      intro: 'Un pipeline CI/CD avec des contrôles de sécurité. Vous allez voir un code sain passer, puis deux problèmes bloqués avant la production, et surtout comment on les corrige.',
      end: 'Vous avez vu les contrôles bloquer un secret exposé et une dépendance vulnérable, puis la remédiation complète : révocation, Vault, mise à jour et pipeline vert.',
      tip: 'Astuce : cliquez sur un job pour lire son journal.',
      steps: [
        { act: 'run', set: { scenario: 'normal' }, btn: 'Lancer le pipeline', title: 'Un code sain', text: 'Toutes les étapes passent, y compris les contrôles de sécurité : la version est déployée.', spot: '.pipe' },
        { act: 'run', set: { scenario: 'secret' }, btn: 'Relancer avec le secret', title: 'Un secret oublié dans le code', text: 'Une clé AWS a été laissée dans un fichier. Gitleaks la détecte et le déploiement est bloqué.', spot: '.pipe' },
        { act: 'rotate', set: { scenario: 'normal' }, btn: 'Révoquer et corriger', title: 'Remédier au secret exposé', text: 'Bloquer ne suffit pas : la clé est considérée comme compromise. On la révoque, on la remplace via Vault, on corrige le code, et le pipeline repasse au vert.', spot: '[data-remed]' },
        { act: 'run', set: { scenario: 'vuln' }, btn: 'Lancer avec la faille', title: 'Une dépendance vulnérable', text: 'Une bibliothèque contient une faille connue. Le scan la détecte et le déploiement n’a pas lieu.', spot: '.pipe' },
        { act: 'upgrade', set: { scenario: 'normal' }, btn: 'Mettre à jour la dépendance', title: 'Corriger la faille', text: 'On passe à la version corrigée de la bibliothèque, les tests repassent et la version est déployée.', spot: '[data-remed]' },
      ],
    },
    html: function (p) {
      return {
        toolbar: segmented('scenario', 'Scénario', [
          { value: 'normal', label: 'Commit sain' },
          { value: 'secret', label: 'Secret dans le code' },
          { value: 'vuln', label: 'Dépendance vulnérable' },
        ], 'normal') + '<div class="sim__actions">' + button('run', 'Lancer le pipeline', { primary: true }) + '</div>',
        body: '<div class="pipe-head"><span class="pstatus pstatus--idle" data-pstatus>en attente</span>' +
            '<span class="mono">#<span data-pid>' + randInt(1200, 1400) + '</span></span><span data-commit>feat: ajout du webhook de paiement</span><span class="muted mono">main · ' + hex(7) + '</span></div>' +
          '<section class="card-sm remed" data-remed hidden><h3>Remédiation <small data-remedtitle></small></h3><ol class="remed__list" role="list" data-remedlist></ol></section>' +
          '<div class="pipe" role="list">' + p.stages.map(function (st) {
            return '<div class="pipe__stage" role="listitem"><p class="pipe__name">' + esc(st.name) + '</p>' + st.jobs.map(function (j) {
              return '<button type="button" class="job job--idle" data-job="' + esc(j) + '"><span class="job__icon" data-jicon></span><span>' + esc(j) + '</span></button>';
            }).join('') + '</div>';
          }).join('') + '</div>' +
          '<div class="panel-dark"><div class="panel-dark__bar"><span></span><span></span><span></span><em data-jobtitle>Journal du job</em></div>' + termHtml('Journal du job sélectionné') + '</div>',
      };
    },
    init: function (ctx, p) {
      var term = new Terminal(ctx, ctx.$('[data-term]'));
      var logs = {};
      var states = {};
      var selected = null;
      var follow = true;
      var STATUS_ICON = { idle: '', pending: 'dot', running: 'dot', passed: 'check', failed: 'x', skipped: 'skip' };

      function setJob(name, st) {
        states[name] = st;
        var b = ctx.$('[data-job="' + name + '"]');
        b.className = 'job job--' + st;
        b.querySelector('[data-jicon]').innerHTML = STATUS_ICON[st] ? svg(STATUS_ICON[st], 'icon icon--xs') : '';
        b.setAttribute('aria-label', name + ' : ' + ({ idle: 'en attente', pending: 'en attente', running: 'en cours', passed: 'réussi', failed: 'échec', skipped: 'ignoré' })[st]);
      }
      function show(name) {
        selected = name;
        ctx.$$('.job').forEach(function (b) { b.classList.toggle('is-selected', b.dataset.job === name); });
        ctx.$('[data-jobtitle]').textContent = 'Journal : ' + name;
        term.clear();
        (logs[name] || [{ t: 'En attente des étapes précédentes…', c: 't-muted' }]).forEach(function (l) { term.line(l.t, l.c); });
      }
      function pstatus(st, label) {
        var el = ctx.$('[data-pstatus]');
        el.className = 'pstatus pstatus--' + st;
        el.textContent = label;
      }
      function reset() {
        ctx.stop();
        logs = {};
        p.stages.forEach(function (st) { st.jobs.forEach(function (j) { setJob(j, 'idle'); }); });
        pstatus('idle', 'en attente');
        term.clear();
        ctx.$('[data-jobtitle]').textContent = 'Journal du job';
      }

      function runJob(name, scenario, done) {
        setJob(name, 'running');
        logs[name] = [];
        if (follow) show(name);
        var lines = JOB_LOGS[name](scenario).map(function (l) { return typeof l === 'string' ? { t: l.indexOf('$ ') === 0 ? l : l, c: l.indexOf('$ ') === 0 ? 't-cmdline' : '' } : l; });
        var failed = lines.some(function (l) { return /Job failed/.test(l.t); });
        var i = 0;
        (function nextLine() {
          if (i >= lines.length) { setJob(name, failed ? 'failed' : 'passed'); done(!failed); return; }
          var l = lines[i++];
          logs[name].push(l);
          if (selected === name) term.line(l.t, l.c);
          ctx.later(nextLine, rand(140, 320));
        })();
      }

      var COMMITS = {
        normal: 'feat: ajout du webhook de paiement',
        secret: 'feat: lecture des factures depuis S3',
        vuln: 'chore: ajout de la génération de PDF',
      };
      function remed(title, items) {
        var box = ctx.$('[data-remed]');
        ctx.$('[data-remedtitle]').textContent = title;
        ctx.$('[data-remedlist]').innerHTML = items.map(function (x) { return '<li>' + svg('check', 'icon icon--xs') + '<span>' + esc(x) + '</span></li>'; }).join('');
        box.hidden = false;
      }
      function run(scenario, msg, okText) {
        reset();
        scenario = scenario || ctx.$('input[name="scenario"]:checked').value;
        ctx.$('[data-commit]').textContent = msg || COMMITS[scenario];
        ctx.$('[data-pid]').textContent = randInt(1200, 1400);
        p.stages.forEach(function (st) { st.jobs.forEach(function (j) { setJob(j, 'pending'); }); });
        pstatus('running', 'en cours');
        ctx.status('Pipeline en cours…');
        follow = true;
        var s = 0;
        (function nextStage() {
          if (s >= p.stages.length) {
            pstatus('passed', 'réussi');
            ctx.status(okText || 'Pipeline réussi : tous les contrôles sont passés, la version est en production.', 'ok');
            ctx.done();
            return;
          }
          var stage = p.stages[s++];
          var left = stage.jobs.length;
          var ok = true;
          stage.jobs.forEach(function (j, k) {
            ctx.later(function () {
              runJob(j, scenario, function (passed) {
                ok = ok && passed;
                if (--left === 0) {
                  if (!ok) {
                    p.stages.slice(s).forEach(function (rest) { rest.jobs.forEach(function (x) { setJob(x, 'skipped'); }); });
                    pstatus('failed', 'échec');
                    var failedJob = stage.jobs.filter(function (x) { return states[x] === 'failed'; })[0];
                    show(failedJob);
                    ctx.status(failedJob === 'gitleaks'
                      ? 'Pipeline bloqué : Gitleaks a détecté un secret. Le déploiement n’a pas eu lieu.'
                      : 'Pipeline bloqué : une dépendance vulnérable (HIGH) doit être mise à jour avant le déploiement.', 'bad');
                    ctx.done();
                    return;
                  }
                  nextStage();
                }
              });
            }, k * 250);
          });
        })();
      }

      reset();
      show('build-image');
      ctx.status('Choisissez un scénario puis lancez le pipeline. Cliquez sur un job pour lire son journal.');

      return {
        action: function (act) {
          if (act === 'run') { ctx.$('[data-remed]').hidden = true; run(); }
          if (act === 'rotate') {
            remed('secret exposé', [
              'Clé désactivée immédiatement dans AWS IAM (aws iam update-access-key --status Inactive)',
              'Utilisation de la clé vérifiée dans les journaux AWS',
              'Nouvelle clé stockée dans Vault, jamais dans le dépôt',
              'Code corrigé pour lire le secret depuis Vault, historique Git nettoyé',
            ]);
            run('normal', 'fix: retrait de la clé AWS, lecture depuis Vault',
              'Pipeline vert : la clé exposée est révoquée et le secret vient désormais de Vault.');
          }
          if (act === 'upgrade') {
            remed('dépendance vulnérable', [
              'lodash mis à jour en 4.17.21, version corrigée (npm install lodash@4.17.21)',
              'Lockfile régénéré et tests relancés par le pipeline',
            ]);
            run('normal', 'fix(deps): lodash 4.17.21 (CVE-2021-23337)',
              'Pipeline vert : la faille est corrigée, la version est déployée.');
          }
        },
        click: function (e) {
          var b = e.target.closest('[data-job]');
          if (b) { follow = false; show(b.dataset.job); }
        },
        change: function () { reset(); ctx.$('[data-remed]').hidden = true; show('build-image'); ctx.status(''); },
      };
    },
  };

  /* ===================================================== 4. Supervision */

  var monitoring = {
    guide: {
      intro: 'Le tableau de bord tourne en direct. Deux incidents vont survenir : vous verrez comment ils sont détectés, signalés, diagnostiqués dans les logs, puis corrigés.',
      end: 'Vous avez vu la chaîne complète d’un incident : détection, alerte, diagnostic dans les logs, correction et retour à la normale.',
      steps: [
        { act: 'observe', btn: 'Continuer', title: 'Observer l’état normal', text: 'Tous les services sont en ligne, la latence est basse et aucune alerte n’est active.', spot: '.dash__stats' },
        { act: 'down', btn: 'Continuer', title: 'Le service api tombe', text: 'Le service api ne répond plus. Regardez la disponibilité passer au rouge et l’alerte passer de PENDING à FIRING.', spot: '.dash__row' },
        { act: 'diagnose', btn: 'Chercher dans les logs', title: 'Diagnostiquer', text: 'On interroge les logs centralisés pour comprendre pourquoi le service est tombé.', spot: '.panel-dark' },
        { act: 'fix', btn: 'Revenir à la version précédente', title: 'Corriger', text: 'On revient à la version précédente de l’API, puis on suit la correction dans un ticket. Les alertes se résolvent.', spot: '.dash__row' },
        { act: 'cpu', btn: 'Continuer', title: 'Surcharge d’un serveur', text: 'Plus tard, le processeur de srv-app-01 sature. Regardez la courbe CPU et l’alerte HighCPU.', spot: '.dash__charts' },
        { act: 'cpufix', btn: 'Identifier et corriger', title: 'Trouver le processus en cause', text: 'On identifie le processus qui consomme le CPU, on l’arrête et on le replanifie en heures creuses.', spot: '.panel-dark' },
      ],
    },
    html: function (p) {
      var stat = function (key, label) { return '<div class="stat"><span>' + esc(label) + '</span><strong data-stat="' + key + '">-</strong></div>'; };
      return {
        toolbar: '<div class="sim__actions">' +
          button('down', 'Panne du service api', { danger: true }) +
          button('cpu', 'Saturation CPU (' + p.servers[0] + ')', { danger: true }) +
          button('recover', 'Rétablir', { disabled: true }) + '</div>',
        body: '<div class="dash">' +
          '<div class="dash__stats">' + stat('up', 'Services en ligne') + stat('alerts', 'Alertes actives') + stat('rps', 'Requêtes / s') + stat('p95', 'Latence p95') + '</div>' +
          '<div class="dash__charts">' +
            '<figure class="chart"><figcaption>CPU par serveur (%) <span class="legend">' + p.servers.map(function (s, i) { return '<i class="s' + i + '"></i>' + esc(s); }).join(' ') + '</span></figcaption><div data-chart="cpu"></div></figure>' +
            '<figure class="chart"><figcaption>Latence p95 (ms) <span class="legend"><i class="s0"></i>web <i class="th"></i>seuil 500 ms</span></figcaption><div data-chart="lat"></div></figure>' +
          '</div>' +
          '<div class="dash__row">' +
            '<section class="card-sm"><h3>Disponibilité <small>Uptime Kuma</small></h3><ul class="uptime" role="list">' +
              p.services.map(function (s) { return '<li data-up="' + esc(s) + '"><span class="uptime__name">' + esc(s) + '</span><span class="beats" data-beats></span><span class="mono" data-pct>100 %</span></li>'; }).join('') +
            '</ul></section>' +
            '<section class="card-sm"><h3>Alertes <small>Alertmanager</small></h3><ul class="alerts" role="list" data-alerts><li class="alerts__empty">Aucune alerte</li></ul></section>' +
          '</div>' +
          '<div class="panel-dark"><div class="panel-dark__bar"><span></span><span></span><span></span><em>Logs centralisés · ELK · Wazuh</em></div>' + termHtml('Logs centralisés', 'term--logs term--short') + '</div>' +
          '<div class="toast" role="alert" data-toast hidden></div>' +
        '</div>',
      };
    },
    init: function (ctx, p) {
      var term = new Terminal(ctx, ctx.$('[data-term]'));
      var cpuChart = new Chart(ctx.$('[data-chart="cpu"]'), { max: 100, threshold: 90, series: p.servers.map(function (s, i) { return { name: s, cls: 's' + i }; }) });
      var latChart = new Chart(ctx.$('[data-chart="lat"]'), { max: 1200, threshold: 500, series: [{ name: 'web', cls: 's0' }] });
      var apiDown = false;
      var cpuHot = false;
      var cpu = p.servers.map(function () { return rand(20, 35); });
      var beats = {};
      var counts = {};
      var waitFor = null;
      var paused = false;
      var alerts = {};
      var RULES = {
        ServiceDown: { cond: function () { return apiDown; }, after: 2, sev: 'critical', text: 'Le service api ne répond plus à la sonde HTTP.' },
        HighLatency: { cond: function (m) { return m.p95 > 500; }, after: 3, sev: 'warning', text: 'Latence p95 au-dessus de 500 ms.' },
        HighCPU: { cond: function () { return cpu[0] > 90; }, after: 3, sev: 'warning', text: 'CPU au-dessus de 90 % sur ' + p.servers[0] + '.' },
      };
      p.services.forEach(function (s) { beats[s] = []; counts[s] = { ok: 0, total: 0 }; });

      // Historique initial pour que les graphiques ne démarrent pas vides.
      for (var k = 0; k < 40; k++) {
        cpuChart.push(cpu.map(function (c) { return c + rand(-4, 4); }));
        latChart.push([rand(90, 160)]);
      }

      function toast(text, tone) {
        var t = ctx.$('[data-toast]');
        t.className = 'toast toast--' + tone;
        t.innerHTML = svg('bell', 'icon icon--sm') + '<span>' + esc(text) + '</span>';
        t.hidden = false;
        ctx.later(function () { t.hidden = true; }, 3500);
      }

      function renderAlerts() {
        var ul = ctx.$('[data-alerts]');
        var keys = Object.keys(alerts);
        if (!keys.length) { ul.innerHTML = '<li class="alerts__empty">Aucune alerte</li>'; return; }
        ul.innerHTML = keys.map(function (k) {
          var a = alerts[k];
          return '<li class="alert alert--' + a.state.toLowerCase() + '"><span class="alert__state">' + a.state + '</span><strong>' + k + '</strong><span>' + esc(RULES[k].text) + '</span></li>';
        }).join('');
      }

      function evaluate(m) {
        Object.keys(RULES).forEach(function (name) {
          var r = RULES[name];
          var a = alerts[name];
          if (r.cond(m)) {
            if (!a) { alerts[name] = { state: 'PENDING', n: 1 }; term.line(clock() + '  alertmanager  ' + name + ' pending', 't-warn'); }
            else if (a.state === 'PENDING' && ++a.n >= r.after) {
              a.state = 'FIRING';
              term.line(clock() + '  alertmanager  [FIRING] ' + name + ' severity=' + r.sev, 't-bad');
              toast('[FIRING] ' + name + ' : ' + r.text, 'bad');
            }
          } else if (a) {
            if (a.state === 'FIRING') {
              term.line(clock() + '  alertmanager  [RESOLVED] ' + name, 't-ok');
              toast('[RESOLVED] ' + name, 'ok');
            }
            delete alerts[name];
          }
        });
        renderAlerts();
        if (waitFor) {
          var w = waitFor;
          if ((w.type === 'firing' && alerts[w.name] && alerts[w.name].state === 'FIRING') || (w.type === 'clear' && !Object.keys(alerts).length)) {
            waitFor = null;
            ctx.later(function () { ctx.done(); }, 600);
          }
        }
        var firing = Object.keys(alerts).filter(function (k) { return alerts[k].state === 'FIRING'; }).length;
        ctx.$('[data-stat="alerts"]').textContent = firing;
        ctx.$('[data-stat="alerts"]').className = firing ? 'is-bad' : '';
      }

      function tick() {
        cpu = cpu.map(function (c, i) {
          var target = i === 0 && cpuHot ? 96 : i === 2 ? 30 : 28;
          return clamp(c + (target - c) * (target > 90 ? 0.5 : 0.3) + rand(-3, 3), 2, 100);
        });
        cpuChart.push(cpu);
        var p95 = apiDown ? rand(900, 1150) : cpuHot ? rand(420, 680) : rand(95, 170);
        latChart.push([p95]);
        var rps = apiDown ? randInt(40, 70) : randInt(160, 230);
        ctx.$('[data-stat="rps"]').textContent = rps;
        var lat = ctx.$('[data-stat="p95"]');
        lat.textContent = Math.round(p95) + ' ms';
        lat.className = p95 > 500 ? 'is-bad' : '';

        var up = 0;
        p.services.forEach(function (s) {
          var ok = !(apiDown && s === 'api');
          if (ok) up++;
          beats[s].push(ok);
          if (beats[s].length > 24) beats[s].shift();
          counts[s].total++;
          if (ok) counts[s].ok++;
          var li = ctx.$('[data-up="' + s + '"]');
          li.querySelector('[data-beats]').innerHTML = beats[s].map(function (b) { return '<i class="' + (b ? 'ok' : 'bad') + '"></i>'; }).join('');
          li.querySelector('[data-pct]').textContent = (100 * counts[s].ok / counts[s].total).toFixed(1) + ' %';
          li.classList.toggle('is-bad', !ok);
        });
        var upEl = ctx.$('[data-stat="up"]');
        upEl.textContent = up + '/' + p.services.length;
        upEl.className = up < p.services.length ? 'is-bad' : 'is-ok';

        // Logs
        if (paused) {
          // une commande est en cours d'affichage
        } else if (apiDown) {
          term.line(clock() + '  web     ERROR  upstream api unavailable status=502', 't-bad');
        } else {
          term.line(clock() + '  ' + pad(pick(['web', 'api', 'worker']), 7) + ' INFO   ' + pick(['GET /api/orders 200', 'GET /api/products 200', 'job processed queue=emails', 'GET /health 200']), 't-muted');
        }
        if (!paused && Math.random() < 0.12) term.line(clock() + '  wazuh   rule=5710 level=5  sshd: attempt to login using a non-existent user', 't-warn');
        evaluate({ p95: p95 });
      }

      ctx.every(tick, 1000);
      tick();
      ctx.status('Tout est nominal. Déclenchez une panne pour voir la détection et l’alerte.');

      return {
        action: function (act) {
          if (act === 'observe') { ctx.status('Situation normale : tous les indicateurs sont au vert.', 'ok'); ctx.later(function () { ctx.done(); }, 2500); return; }
          if (act === 'diagnose') {
            paused = true;
            ctx.status('Recherche de la cause dans les logs centralisés…');
            term.run([
              { t: '', d: 0 },
              '$ (Kibana) service:api AND level:(error OR fatal)  · 15 dernières minutes',
              { t: clock(-40) + '  api      FATAL  JavaScript heap out of memory', c: 't-bad' },
              { t: clock(-40) + '  kernel   Out of memory: Killed process 23817 (node) anon-rss:1048576kB', c: 't-bad' },
              { t: clock(-39) + '  systemd  api.service: Failed with result \'oom-kill\'.', c: 't-bad' },
              { t: '# Cause : la mémoire de l’API augmente sans cesse depuis le déploiement de 14 h (fuite mémoire).', c: 't-warn t-strong', d: 0 },
            ], function () {
              paused = false;
              ctx.status('Cause trouvée : fuite mémoire introduite par le dernier déploiement, le processus est tué par le système.', 'warn');
              ctx.done();
            });
            return;
          }
          if (act === 'fix') {
            paused = true;
            ctx.status('Retour à la version précédente…');
            term.run([
              { t: '', d: 0 },
              { t: '# Rollback vers la version précédente de l’API (sans la fuite mémoire)', c: 't-muted' },
              '$ sudo systemctl restart api',
              { t: 'api.service: Started API service (version précédente).', c: 't-ok' },
              { t: '# Ticket de suivi ouvert : analyser la fuite (heap dump) avant de redéployer.', c: 't-muted', d: 0 },
            ], function () {
              paused = false;
              waitFor = { type: 'clear' };
              apiDown = false;
              ctx.status('Service rétabli par rollback : les alertes passent en RESOLVED.', 'ok');
              ctx.enable({ down: true, cpu: true, recover: false });
            });
            return;
          }
          if (act === 'cpufix') {
            paused = true;
            ctx.status('Recherche du processus en cause…');
            term.run([
              { t: '', d: 0 },
              '$ ssh ' + p.servers[0] + ' top -b -n1 -o %CPU | head -8 | tail -2',
              { t: '    PID USER      %CPU  %MEM COMMAND', c: 't-strong' },
              { t: '  41022 app      389.0   6.2 node reindex-job.js', c: 't-bad' },
              { t: '# Cause : le job de réindexation tourne en heures pleines et sature le serveur.', c: 't-warn t-strong' },
              '$ sudo systemctl stop reindex.service',
              { t: '# Job replanifié à 3 h du matin (reindex.timer), plafonné à CPUQuota=50 %.', c: 't-muted', d: 0 },
            ], function () {
              paused = false;
              waitFor = { type: 'clear' };
              cpuHot = false;
              ctx.status('Job arrêté et replanifié la nuit : la charge redescend et l’alerte se résout.', 'ok');
            });
            return;
          }
          if (act === 'down') {
            term.line(clock() + '  kernel  Out of memory: Killed process 23817 (node)', 't-bad');
            term.line(clock() + '  systemd api.service: Failed with result \'oom-kill\'.', 't-bad');
          }
          if (act === 'down') { waitFor = { type: 'firing', name: 'ServiceDown' }; apiDown = true; ctx.status('Le service api vient de tomber : la sonde échoue, l’alerte va se déclencher.', 'bad'); }
          if (act === 'cpu') { waitFor = { type: 'firing', name: 'HighCPU' }; cpuHot = true; ctx.status('Le CPU de ' + p.servers[0] + ' monte : surveillez la courbe et l’alerte.', 'warn'); }
          if (act === 'recover') { waitFor = { type: 'clear' }; apiDown = false; cpuHot = false; ctx.status('Service rétabli : les alertes passent en RESOLVED.', 'ok'); }
          ctx.enable({ down: !apiDown, cpu: !cpuHot, recover: apiDown || cpuHot });
        },
      };
    },
  };

  /* ================================================= 5. Accès sécurisé */

  var access = {
    guide: {
      intro: 'Vous allez suivre un administrateur jusqu’à un serveur de production, puis voir ce qui arrive à un développeur qui n’a pas les droits.',
      end: 'Vous avez vu un accès d’administration sécurisé de bout en bout : VPN, identité avec MFA, droits par rôle, accès temporaire approuvé et audit de chaque action.',
      steps: [
        { act: 'vpn', set: { user: 'ops' }, ctx: 'Utilisateur : admin (rôle ops)', btn: 'Se connecter au VPN', title: 'Ouvrir le tunnel VPN', text: 'Le poste ouvre un tunnel WireGuard chiffré vers l’infrastructure.', spot: '.path' },
        { act: 'login', ctx: 'Utilisateur : admin (rôle ops)', btn: 'S’identifier (tsh login)', title: 'Prouver son identité', text: 'Mot de passe et code MFA. Teleport délivre un certificat valable 8 heures.', spot: '.audit' },
        { act: 'ls', ctx: 'Utilisateur : admin (rôle ops)', btn: 'Lister les serveurs', title: 'Voir ses serveurs', text: 'On ne voit que les serveurs autorisés pour son rôle.', spot: '.panel-dark' },
        { act: 'ssh', ctx: 'Utilisateur : admin (rôle ops)', btn: 'Se connecter à prod-api', title: 'Ouvrir une session', text: 'L’accès est accordé et la session est enregistrée pour l’audit.', spot: '.audit' },
        { act: 'devattempt', ctx: 'Utilisateur : dev (rôle dev)', btn: 'Essayer avec le rôle dev', title: 'Un développeur sans droits', text: 'Même parcours avec le rôle dev : Teleport refuse l’accès à la production et journalise la tentative.', spot: '.audit' },
        { act: 'request', ctx: 'Utilisateur : dev (rôle dev)', btn: 'Demander un accès temporaire', title: 'Accès temporaire justifié', text: 'Pour analyser un incident, le développeur demande un accès en lecture seule avec un motif. Un administrateur approuve, l’accès expire au bout d’une heure.', spot: '.audit' },
      ],
    },
    html: function (p) {
      return {
        toolbar: segmented('user', 'Utilisateur', [
          { value: 'ops', label: 'admin (rôle ops)' },
          { value: 'dev', label: 'dev (rôle dev)' },
        ], 'ops') + '<div class="sim__actions">' +
          button('vpn', '1. Connexion VPN', { primary: true }) +
          button('login', '2. tsh login', { disabled: true }) +
          button('ls', '3. tsh ls', { disabled: true }) +
          button('ssh', '4. tsh ssh prod-api', { disabled: true }) +
          button('reset', 'Recommencer') + '</div>',
        body: '<div class="sim__split">' +
          '<div class="panel-dark"><div class="panel-dark__bar"><span></span><span></span><span></span><em>poste administrateur</em></div>' + termHtml('Terminal administrateur') + '</div>' +
          '<div class="side">' +
            '<ol class="path" role="list" aria-label="Chemin d’accès">' +
              ['Poste', 'WireGuard', 'Teleport', 'prod-api'].map(function (n, i) { return '<li class="path__hop" data-hop="' + i + '"><span></span>' + esc(n) + '</li>'; }).join('') +
            '</ol>' +
            '<section class="card-sm"><h3>Journal d’audit <small>Teleport</small></h3><ul class="audit" role="list" data-audit><li class="alerts__empty">Aucun événement</li></ul></section>' +
            '<section class="card-sm"><h3>Cloudflare WAF <small>trafic web public</small></h3><p class="waf-count"><span>Autorisées <strong data-allow>0</strong></span><span>Bloquées <strong class="is-bad" data-block>0</strong></span></p><ul class="waf" role="list" data-waf></ul></section>' +
          '</div>' +
        '</div>',
      };
    },
    init: function (ctx, p) {
      var term = new Terminal(ctx, ctx.$('[data-term]'));
      var allow = 0;
      var block = 0;
      var ROLES = { ops: ['prod', 'staging'], dev: ['staging'] };

      function user() { return ctx.$('input[name="user"]:checked').value === 'ops' ? { name: 'admin', role: 'ops' } : { name: 'dev', role: 'dev' }; }
      function hop(i, st) { ctx.$$('[data-hop]').forEach(function (h) { if (Number(h.dataset.hop) <= i) h.className = 'path__hop is-' + st; }); }
      function audit(text, tone) {
        var ul = ctx.$('[data-audit]');
        var empty = ul.querySelector('.alerts__empty');
        if (empty) empty.remove();
        var li = document.createElement('li');
        li.className = 'audit__item' + (tone ? ' is-' + tone : '');
        li.innerHTML = '<span class="mono">' + clock() + '</span> ' + esc(text);
        ul.insertBefore(li, ul.firstChild);
      }

      var REQS = [
        { a: 'ALLOW', r: 'GET /' }, { a: 'ALLOW', r: 'GET /api/products' }, { a: 'ALLOW', r: 'POST /api/cart' }, { a: 'ALLOW', r: 'GET /assets/app.js' },
        { a: 'BLOCK', r: 'GET /products?id=1\' OR \'1\'=\'1', why: 'SQLi' },
        { a: 'BLOCK', r: 'GET /search?q=<script>alert(1)</script>', why: 'XSS' },
        { a: 'BLOCK', r: 'POST /wp-login.php', why: 'bot' },
        { a: 'BLOCK', r: 'GET /../../etc/passwd', why: 'path traversal' },
        { a: 'CHALLENGE', r: 'POST /api/login', why: 'rate limit' },
      ];
      function waf() {
        var q = Math.random() < 0.7 ? REQS[randInt(0, 3)] : REQS[randInt(4, REQS.length - 1)];
        if (q.a === 'ALLOW') allow++; else block++;
        ctx.$('[data-allow]').textContent = allow;
        ctx.$('[data-block]').textContent = block;
        var ul = ctx.$('[data-waf]');
        var li = document.createElement('li');
        li.className = 'waf__item is-' + q.a.toLowerCase();
        li.innerHTML = '<span class="waf__act">' + q.a + '</span><span class="mono">' + esc(q.r) + '</span>' + (q.why ? '<em>' + esc(q.why) + '</em>' : '');
        ul.insertBefore(li, ul.firstChild);
        while (ul.childElementCount > 5) ul.removeChild(ul.lastChild);
      }

      function reset() {
        term.clear();
        ctx.$$('[data-hop]').forEach(function (h) { h.className = 'path__hop'; });
        term.run([{ t: '# Accès d’administration : VPN, puis identité et rôle vérifiés par Teleport.', c: 't-muted', d: 0 }]);
        ctx.enable({ vpn: true, login: false, ls: false, ssh: false });
      }

      ctx.every(waf, 1300);
      reset();
      ctx.status('Choisissez un utilisateur puis suivez les étapes 1 à 4.');

      var api = {
        change: function () { reset(); ctx.status('Utilisateur changé : recommencez à l’étape 1.'); },
        action: function (act) {
          if (act === 'devattempt') {
            ctx.$('input[name="user"][value="dev"]').checked = true;
            reset();
            var chain = ['vpn', 'login', 'ls', 'ssh'];
            var guideDone = ctx.onDone;
            (function nextLink() {
              var a = chain.shift();
              if (!a) return;
              ctx.onDone = chain.length ? nextLink : guideDone;
              api.action(a);
            })();
            return;
          }
          var u = user();
          if (act === 'reset') { reset(); ctx.status('Session réinitialisée. Recommencez à l’étape 1.'); return; }
          if (act === 'request') {
            ctx.status('Demande d’accès temporaire…');
            term.run([
              { t: '', d: 0 },
              '$ tsh request create --roles=prod-readonly --reason="Analyse de l’incident INC-2031"',
              'Creating request...',
              { t: 'Request ID: ' + hex(8) + '-' + hex(4) + '-…', c: 't-muted' },
              { t: 'Waiting for request approval...', c: 't-muted', d: 300 },
            ], function () {
              audit('access_request.create · dev → rôle prod-readonly · motif : INC-2031');
              ctx.later(function () {
                audit('access_request.review · admin a approuvé · durée : 1 h', 'ok');
                term.run([
                  { t: 'Approval received, getting updated certificates...', c: 't-ok' },
                  '$ tsh ssh dev@prod-api',
                  { t: 'Session enregistrée par Teleport (lecture seule, expire dans 1 h).', c: 't-muted' },
                  { t: '$ tail -n 1 /var/log/app/api.log', p: 'dev@prod-api:~' },
                  { t: clock() + ' ERROR timeout calling payment provider after 30000ms', c: 't-bad' },
                  { t: '$ exit', p: 'dev@prod-api:~' },
                  { t: 'logout', c: 't-muted' },
                ], function () {
                  hop(3, 'ok');
                  audit('session.start · dev → prod-api · accès temporaire', 'ok');
                  ctx.status('Accès accordé après approbation : lecture seule, limité à 1 h, session enregistrée. Il expire tout seul.', 'ok');
                  ctx.done();
                });
              }, 1500);
            });
            return;
          }
          if (act === 'vpn') {
            ctx.enable({ vpn: false });
            term.run(['$ sudo wg-quick up wg0', { t: '[#] ip link add wg0 type wireguard', c: 't-muted' }, { t: '[#] wg setconf wg0 /dev/fd/63', c: 't-muted' },
              { t: '[#] ip link set mtu 1420 up dev wg0', c: 't-muted' }, '$ sudo wg show wg0 latest-handshakes', { t: 'peer ' + hex(10) + '…   il y a 2 secondes', c: 't-ok' }], function () {
              hop(1, 'ok');
              ctx.status('Tunnel WireGuard établi et chiffré.', 'ok');
              ctx.enable({ login: true });
              ctx.done();
            });
          }
          if (act === 'login') {
            ctx.enable({ login: false });
            term.run(['$ tsh login --proxy=' + p.proxy + ' --user=' + u.name, 'Enter password for Teleport user ' + u.name + ':', { t: '****************', c: 't-muted' },
              'Enter an OTP code from a device:', { t: '******', c: 't-muted', d: 400 },
              '> Profile URL:        https://' + p.proxy + ':443', '  Logged in as:       ' + u.name, '  Cluster:            ' + p.proxy, '  Roles:              ' + u.role,
              '  Logins:             ' + u.role, { t: '  Valid until:        ' + clock(8 * 3600) + ' [valid for 8h0m0s]', c: 't-muted' }], function () {
              hop(2, 'ok');
              audit('user.login · ' + u.name + ' · succès (mot de passe + MFA)', 'ok');
              ctx.status('Identité vérifiée avec MFA. Certificat court délivré (8 h).', 'ok');
              ctx.enable({ ls: true });
              ctx.done();
            });
          }
          if (act === 'ls') {
            ctx.enable({ ls: false });
            var visible = p.nodes.filter(function (n) { return ROLES[u.role].indexOf(n.env) !== -1; });
            var out = ['$ tsh ls', { t: pad('Node Name', 14) + 'Labels', c: 't-strong' }, { t: pad('-----------', 14) + '------------', c: 't-muted' }];
            visible.forEach(function (n) { out.push(pad(n.name, 14) + 'env=' + n.env); });
            if (visible.length < p.nodes.length) out.push({ t: '# Le rôle « ' + u.role + ' » ne voit que les serveurs autorisés (RBAC).', c: 't-muted' });
            term.run(out, function () { ctx.enable({ ssh: true }); ctx.status('Seuls les serveurs autorisés pour le rôle « ' + u.role + ' » sont listés.'); ctx.done(); });
          }
          if (act === 'ssh') {
            ctx.enable({ ssh: false });
            if (u.role !== 'ops') {
              term.run(['$ tsh ssh ' + u.role + '@prod-api', { t: 'ERROR: access denied to ' + u.role + ' connecting to prod-api on cluster ' + p.proxy, c: 't-bad t-strong' }], function () {
                hop(3, 'bad');
                audit('auth.denied · ' + u.name + ' → prod-api · rôle insuffisant (RBAC)', 'bad');
                ctx.status('Accès refusé : le rôle « dev » n’a pas accès à la production. La tentative est journalisée.', 'bad');
                ctx.enable({ vpn: false });
                ctx.done();
              });
              return;
            }
            term.run(['$ tsh ssh ops@prod-api', { t: 'Session enregistrée par Teleport.', c: 't-muted' },
              { t: '$ uptime', p: 'ops@prod-api:~' }, ' ' + clock() + ' up ' + randInt(10, 90) + ' days,  1 user,  load average: 0.21, 0.18, 0.15',
              { t: '$ exit', p: 'ops@prod-api:~' }, { t: 'logout', c: 't-muted' }], function () {
              hop(3, 'ok');
              audit('session.start · ' + u.name + ' → prod-api', 'ok');
              audit('session.end · ' + u.name + ' → prod-api · enregistrement disponible', 'ok');
              ctx.status('Accès accordé, session SSH enregistrée et auditée de bout en bout.', 'ok');
              ctx.done();
            });
          }
        },
      };
      return api;
    },
  };

  /* ============================================ 6. Cluster Proxmox (étude) */

  var cluster = {
    guide: {
      intro: 'Un cluster Proxmox de production : 2 nœuds et un QDevice. Vous allez simuler la panne d’un nœud, puis comparer avec deux autres configurations (sans QDevice, réplication ZFS).',
      end: 'Vous avez vu pourquoi le QDevice est indispensable à 2 nœuds, et ce que change le choix du stockage.',
      steps: [
        { act: 'fail', set: { qdevice: 'on', storage: 'shared' }, ctx: 'Avec QDevice · stockage partagé', btn: 'Faire tomber pve1', title: 'Panne d’un nœud', text: 'Grâce au QDevice, le quorum est conservé : pve1 est isolé, puis ses VM redémarrent sur pve2.', spot: '.pves' },
        { act: 'restore', ctx: 'Avec QDevice · stockage partagé', btn: 'Réparer et rétablir pve1', title: 'Retour de pve1', text: 'pve1 est réparé et revient dans le cluster. Les VM regagnent leur nœud d’origine par migration à chaud, sans coupure.', spot: '.pves' },
        { act: 'fail', set: { qdevice: 'off', storage: 'shared' }, ctx: 'Sans QDevice · stockage partagé', btn: 'Faire tomber pve1', title: 'Comparaison : sans QDevice', text: 'Pour comparer : avec seulement 2 votes, pve2 seul n’a pas la majorité : le cluster se bloque par sécurité.', spot: '.quorum' },
        { act: 'restore', ctx: 'Sans QDevice · stockage partagé', btn: 'Rétablir pve1', title: 'Retour de pve1', text: 'Le quorum est rétabli.', spot: '.quorum' },
        { act: 'fail', set: { qdevice: 'on', storage: 'zfs' }, ctx: 'Avec QDevice · réplication ZFS', btn: 'Faire tomber pve1', title: 'Comparaison : réplication ZFS', text: 'Pour comparer, avec un stockage local répliqué : les VM redémarrent, mais depuis la dernière copie répliquée : les écritures les plus récentes sont perdues.', spot: '.pves' },
      ],
    },
    html: function (p) {
      var nodeCard = function (n) {
        return '<div class="pve" data-pve="' + n + '"><p class="pve__head"><strong>' + n + '</strong><span class="state state--ok" data-pvestate>online</span></p>' +
          '<p class="pve__meta">1 vote</p><ul class="vms" role="list" data-vms></ul></div>';
      };
      return {
        toolbar: segmented('qdevice', 'QDevice', [{ value: 'on', label: 'Avec QDevice' }, { value: 'off', label: 'Sans QDevice' }], 'on') +
          segmented('storage', 'Stockage', [{ value: 'shared', label: 'Stockage partagé' }, { value: 'zfs', label: 'Local + réplication ZFS' }], 'shared') +
          '<div class="sim__actions">' + button('fail', 'Panne de pve1', { danger: true }) + button('restore', 'Rétablir pve1', { disabled: true }) + '</div>',
        body: '<div class="sim__split sim__split--cluster">' +
          '<div>' +
            '<div class="quorum" data-quorum></div>' +
            '<div class="pves">' + nodeCard('pve1') + nodeCard('pve2') +
              '<div class="pve pve--qdev" data-pve="qdevice"><p class="pve__head"><strong>QDevice</strong><span class="state state--ok" data-pvestate>actif</span></p><p class="pve__meta">1 vote · arbitre externe, aucune VM</p></div>' +
            '</div>' +
          '</div>' +
          '<div class="panel-dark"><div class="panel-dark__bar"><span></span><span></span><span></span><em>journalctl -u pve-ha-crm -u corosync</em></div>' + termHtml('Journal du cluster', 'term--logs') + '</div>' +
        '</div>',
      };
    },
    init: function (ctx, p) {
      var term = new Terminal(ctx, ctx.$('[data-term]'));
      var vms = [];
      var down = false;

      function opt(name) { return ctx.$('input[name="' + name + '"]:checked').value; }
      function log(src, text, cls) { term.line(clock() + ' ' + pad(src, 11) + text, cls); }

      function renderVms() {
        ['pve1', 'pve2'].forEach(function (n) {
          ctx.$('[data-pve="' + n + '"] [data-vms]').innerHTML = vms.filter(function (v) { return v.node === n; }).map(function (v) {
            return '<li class="vm vm--' + v.state + '"><span class="mono">vm:' + v.id + '</span> ' + esc(v.name) + '<em>' + v.state + '</em></li>';
          }).join('') || '<li class="vm vm--empty">aucune VM</li>';
        });
      }
      function quorum() {
        var q = opt('qdevice') === 'on';
        var expected = q ? 3 : 2;
        var present = (down ? 0 : 1) + 1 + (q ? 1 : 0);
        var needed = Math.floor(expected / 2) + 1;
        var ok = present >= needed;
        ctx.$('[data-quorum]').innerHTML = '<span>Votes attendus <strong>' + expected + '</strong></span><span>Présents <strong>' + present + '</strong></span>' +
          '<span>Requis <strong>' + needed + '</strong></span><span class="state state--' + (ok ? 'ok' : 'bad') + '">' + (ok ? 'Quorum OK' : 'Quorum perdu') + '</span>';
        ctx.$('[data-pve="qdevice"]').classList.toggle('is-off', !q);
        return ok;
      }
      function setNode(n, st) {
        var el = ctx.$('[data-pve="' + n + '"]');
        var s = el.querySelector('[data-pvestate]');
        s.textContent = st;
        s.className = 'state state--' + (st === 'online' ? 'ok' : st === 'fence' ? 'warn' : 'bad');
        el.classList.toggle('is-down', st !== 'online');
      }
      function reset() {
        ctx.stop();
        down = false;
        vms = p.vms.map(function (v) { return { id: v.id, name: v.name, node: v.node, state: 'started' }; });
        setNode('pve1', 'online');
        setNode('pve2', 'online');
        renderVms();
        quorum();
        term.clear();
        log('corosync', '[QUORUM] Members[2]: 1 2', 't-muted');
        log('corosync', opt('qdevice') === 'on' ? '[VOTEQ] QDevice enregistré, 3 votes attendus' : '[VOTEQ] 2 votes attendus, aucun QDevice', 't-muted');
        ctx.enable({ fail: true, restore: false });
        ctx.$$('input').forEach(function (i) { i.disabled = false; });
      }

      reset();
      ctx.status('Cluster sain. Choisissez la configuration puis simulez la panne de pve1.');

      return {
        change: function () { reset(); ctx.status('Configuration changée. Simulez la panne de pve1.'); },
        action: function (act) {
          if (act === 'fail') {
            ctx.enable({ fail: false });
            ctx.$$('input').forEach(function (i) { i.disabled = true; });
            down = true;
            setNode('pve1', 'unknown');
            vms.forEach(function (v) { if (v.node === 'pve1') v.state = 'error'; });
            renderVms();
            log('corosync', '[TOTEM] A processor failed, forming new configuration.', 't-warn');
            var ok = quorum();
            log('corosync', ok ? '[QUORUM] Members[1]: 2 · quorum conservé (2 votes sur 3 avec le QDevice)' : '[QUORUM] This node is within the non-primary component and will NOT provide any services.', ok ? 't-ok' : 't-bad');

            if (!ok) {
              ctx.later(function () {
                log('pve-ha-crm', 'cluster not quorate - HA recovery impossible', 't-bad');
                log('pmxcfs', '/etc/pve en lecture seule (pas de quorum)', 't-bad');
                ctx.status('Sans QDevice, pve2 seul n’a pas la majorité : le cluster se protège et les VM de pve1 ne redémarrent pas.', 'bad');
                ctx.enable({ restore: true }); ctx.done();
              }, 1200);
              return;
            }

            ctx.later(function () {
              log('pve-ha-crm', 'node \'pve1\': state changed from \'online\' => \'unknown\'', 't-warn');
              vms.forEach(function (v) { if (v.node === 'pve1') { v.state = 'fence'; log('pve-ha-crm', 'service \'vm:' + v.id + '\': state changed from \'started\' to \'fence\'', 't-warn'); } });
              setNode('pve1', 'fence');
              renderVms();
              ctx.status('pve1 ne répond plus : il est isolé (fencing) avant toute reprise, pour éviter que la VM tourne deux fois.', 'warn');
            }, 1400);
            ctx.later(function () {
              log('pve-ha-crm', 'fencing: acknowledged - got agent lock for node \'pve1\'', 't-warn');
              setNode('pve1', 'offline');
            }, 3200);
            ctx.later(function () {
              vms.forEach(function (v) {
                if (v.node === 'pve1') {
                  log('pve-ha-crm', 'recover service \'vm:' + v.id + '\' from fenced node \'pve1\' to node \'pve2\'', 't-strong');
                  v.node = 'pve2';
                  v.state = 'recovery';
                }
              });
              renderVms();
            }, 4300);
            ctx.later(function () {
              vms.forEach(function (v) {
                if (v.state === 'recovery') {
                  v.state = 'started';
                  log('pve-ha-crm', 'service \'vm:' + v.id + '\': state changed from \'recovery\' to \'started\'  (node = pve2)', 't-ok');
                }
              });
              renderVms();
              if (opt('storage') === 'zfs') {
                log('pvesr', 'VM redémarrées depuis le dernier instantané répliqué', 't-warn');
                ctx.status('VM redémarrées sur pve2. Avec la réplication ZFS, les écritures postérieures au dernier instantané sont perdues.', 'warn');
              } else {
                ctx.status('VM redémarrées sur pve2 depuis le stockage partagé, sans perte de données.', 'ok');
              }
              ctx.enable({ restore: true }); ctx.done();
            }, 5600);
          }

          if (act === 'restore') {
            ctx.enable({ restore: false });
            down = false;
            setNode('pve1', 'online');
            quorum();
            log('corosync', '[QUORUM] Members[2]: 1 2 · quorum rétabli', 't-ok');
            log('pve-ha-crm', 'node \'pve1\': state changed from \'offline\' => \'online\'', 't-ok');
            vms.forEach(function (v) { if (v.state === 'error') v.state = 'started'; });
            renderVms();
            ctx.$$('input').forEach(function (i) { i.disabled = false; });
            ctx.enable({ fail: true });
            var back = vms.filter(function (v) {
              var orig = p.vms.filter(function (o) { return o.id === v.id; })[0];
              return orig.node === 'pve1' && v.node === 'pve2';
            });
            if (!back.length || opt('storage') !== 'shared') {
              ctx.status('pve1 est de retour dans le cluster, le quorum est complet.', 'ok');
              ctx.done();
              return;
            }
            ctx.status('pve1 est de retour : les VM regagnent leur nœud par migration à chaud…');
            var k = 0;
            (function migrate() {
              if (k >= back.length) {
                ctx.status('Les VM ont retrouvé pve1 par migration à chaud, sans coupure de service.', 'ok');
                ctx.done();
                return;
              }
              var v = back[k++];
              log('ha-manager', 'crm-command migrate vm:' + v.id + ' pve1', 't-strong');
              v.state = 'migrate';
              renderVms();
              ctx.later(function () {
                log('pve-ha-lrm', 'vm:' + v.id + ': migration finished successfully (duration 00:00:' + randInt(10, 25) + ')', 't-ok');
                v.node = 'pve1';
                v.state = 'started';
                renderVms();
                migrate();
              }, 1400);
            })();
          }
        },
      };
    },
  };

  /* ================================================================ Guide */

  /**
   * Le guide pilote la simulation : une seule action proposée à la fois,
   * expliquée en une phrase, avec la zone à regarder mise en évidence.
   */
  function Guide(ctx, conf, ctrl, restart) {
    this.ctx = ctx;
    this.conf = conf;
    this.ctrl = ctrl;
    this.restart = restart;
    this.i = -1;
    this.auto = false;
    this.running = false;
    this.el = ctx.$('[data-guide]');
    var self = this;
    this.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]');
      if (!b || b.disabled) return;
      var g = b.dataset.g;
      if (g === 'auto') { self.auto = true; self.run(); }
      else if (g === 'manual') { self.auto = false; self.i = 0; self.render(); }
      else if (g === 'step') { self.auto = false; self.run(); }
      else if (g === 'pause') { self.auto = false; self.render(); }
      else if (g === 'resume') { self.auto = true; if (!self.running) self.run(); else self.render(); }
      else if (g === 'restart') { self.restart(); }
    });
    this.render();
  }

  Guide.prototype.applySet = function (set) {
    var ctx = this.ctx;
    var changed = false;
    Object.keys(set || {}).forEach(function (name) {
      var input = ctx.$('input[name="' + name + '"][value="' + set[name] + '"]');
      if (input && !input.checked) { input.checked = true; changed = true; }
    });
    if (changed && this.ctrl.change) this.ctrl.change();
  };

  Guide.prototype.run = function () {
    var self = this;
    var steps = this.conf.steps;
    if (this.running) return;
    if (this.i < 0) this.i = 0;
    if (this.i >= steps.length) return;
    var step = steps[this.i];
    this.running = true;
    this.applySet(step.set);
    this.render();
    this.ctx.highlight(step.spot);
    this.ctx.onDone = function () {
      self.running = false;
      self.i++;
      self.render();
      if (self.auto && self.i < steps.length) self.ctx.later(function () { if (self.auto && !self.running) self.run(); }, 2200);
    };
    this.ctrl.action(step.act);
  };

  Guide.prototype.render = function () {
    var steps = this.conf.steps;
    var n = steps.length;
    var html;
    var focusWasInside = this.el.contains(document.activeElement);
    var dots = '<ol class="guide__dots" role="list" aria-hidden="true">' + steps.map(function (st, k) {
      return '<li class="' + (k < this.i ? 'is-done' : k === this.i ? 'is-current' : '') + '"></li>';
    }, this).join('') + '</ol>';

    if (this.i < 0) {
      html = '<div class="guide__top"><span class="guide__count">Ce que montre cette simulation</span>' + dots + '</div>' +
        '<p class="guide__intro">' + esc(this.conf.intro) + '</p>' +
        '<div class="guide__actions">' +
          '<button type="button" class="btn btn--primary guide__main" data-g="auto">' + svg('play', 'icon icon--sm icon--fill') + 'Regarder la démo</button>' +
          '<button type="button" class="btn btn--outline" data-g="manual">Avancer pas à pas</button>' +
        '</div>';
    } else if (this.i >= n) {
      this.ctx.highlight(null);
      html = '<div class="guide__top"><span class="guide__count is-ok">' + svg('check', 'icon icon--xs') + 'Démo terminée</span>' + dots + '</div>' +
        '<p class="guide__intro">' + esc(this.conf.end) + '</p>' +
        '<div class="guide__actions"><button type="button" class="btn btn--primary guide__main" data-g="restart">Recommencer</button></div>';
    } else {
      var st = steps[this.i];
      var main = this.running
        ? '<button type="button" class="btn btn--primary guide__main" disabled><span class="spinner" aria-hidden="true"></span>En cours…</button>'
        : '<button type="button" class="btn btn--primary guide__main is-pulse" data-g="' + (this.auto ? 'resume' : 'step') + '">' + svg('play', 'icon icon--sm icon--fill') + esc(st.btn) + '</button>';
      var side = this.auto
        ? '<button type="button" class="btn btn--outline" data-g="pause">Mettre en pause</button>'
        : '<button type="button" class="btn btn--outline" data-g="resume">Lecture automatique</button>';
      if (this.auto && !this.running) main = '<button type="button" class="btn btn--primary guide__main" disabled><span class="spinner" aria-hidden="true"></span>Étape suivante…</button>';
      html = '<div class="guide__top"><span class="guide__count">Étape ' + (this.i + 1) + ' sur ' + n + '</span>' + dots + '</div>' +
        '<h3 class="guide__title">' + esc(st.title) + '</h3>' +
        '<p class="guide__text">' + esc(st.text) + '</p>' +
        (st.ctx ? '<p class="guide__ctx">' + esc(st.ctx) + '</p>' : '') +
        '<div class="guide__actions">' + main + side + '</div>' +
        (this.conf.tip ? '<p class="guide__tip">' + esc(this.conf.tip) + '</p>' : '');
    }
    this.el.querySelector('[data-guide-body]').innerHTML = html;
    if (focusWasInside || this.i < 0) {
      var target = this.el.querySelector('.guide__main:not([disabled])') || this.el.querySelector('[data-g]');
      if (target && this.i >= 0) target.focus({ preventScroll: true });
    }
  };

  /* ================================================================ Montage */

  var KINDS = { terraform: terraform, containers: containers, pipeline: pipeline, monitoring: monitoring, access: access, cluster: cluster };

  function mount(dialog, payload, strings) {
    var kind = KINDS[payload.kind];
    if (!kind) return { destroy: function () {} };
    var ctx;
    var root;

    function onClick(e) {
      var b = e.target.closest('[data-act]');
      if (b && !b.disabled && current.action) { current.action(b.dataset.act); return; }
      if (current.click) current.click(e);
    }
    var current = {};

    function build() {
      var parts = kind.html(payload);
      dialog.innerHTML =
        '<div class="sim sim--' + esc(payload.kind) + '">' +
          '<header class="sim__head"><div>' +
            '<span class="sim__badge">' + svg('play', 'icon icon--xs icon--fill') + esc(strings.badge) + '</span>' +
            '<h2 id="sim-title">' + esc(payload.title) + '</h2>' +
            '<p class="sim__note">' + esc(payload.status === 'study' ? strings.studyNote : strings.note) + '</p>' +
          '</div><button class="sim__close" type="button" data-sim-close aria-label="' + esc(strings.close) + '">' + svg('close') + '</button></header>' +
          '<section class="guide" data-guide aria-label="Guide de la simulation"><div data-guide-body></div>' +
            '<p class="sim__status" role="status" data-status></p></section>' +
          '<div class="sim__toolbar" hidden>' + parts.toolbar + '</div>' +
          '<div class="sim__body">' + parts.body + '</div>' +
        '</div>';
      root = dialog.querySelector('.sim');
      ctx = new Context(root);
      current = kind.init(ctx, payload) || {};
      ctx.status('');
      root.addEventListener('click', onClick);
      new Guide(ctx, kind.guide, current, function () { ctx.stop(); build(); });
      var first = root.querySelector('[data-g="auto"]');
      if (first) first.focus();
    }

    build();

    return {
      destroy: function () { if (ctx) ctx.stop(); },
    };
  }

  window.PortfolioSim = { mount: mount };
})();
