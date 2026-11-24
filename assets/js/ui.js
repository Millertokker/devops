/**
 * Interactions de la page (script classique, chargé en `defer`).
 * Pas de module ES : fonctionne aussi quand index.html est ouvert directement (file://).
 *
 *  - menu mobile (clic, Échap, fermeture au clic sur un lien ou à la perte du focus)
 *  - bordure de l'en-tête et bouton « haut de page » au défilement
 *  - lien de navigation actif selon la section visible
 *  - formulaire de contact (si présent), via délégation d'événements
 */
(function () {
  'use strict';

  var header = document.querySelector('[data-header]');
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');
  var desktop = window.matchMedia('(min-width: 900px)');

  /* ------------------------------------------------------- Menu mobile */

  function isOpen() {
    return toggle.getAttribute('aria-expanded') === 'true';
  }

  function setOpen(open, returnFocus) {
    toggle.setAttribute('aria-expanded', String(open));
    header.classList.toggle('is-open', open);
    if (!open && returnFocus) toggle.focus();
  }

  if (header && toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = !isOpen();
      setOpen(open, false);
      if (open) {
        var first = nav.querySelector('a');
        if (first) first.focus();
      }
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && !desktop.matches) setOpen(false, false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) setOpen(false, true);
    });

    header.addEventListener('focusout', function (e) {
      if (!desktop.matches && isOpen() && !header.contains(e.relatedTarget)) setOpen(false, false);
    });

    // Clic en dehors du menu : on le ferme.
    document.addEventListener('click', function (e) {
      if (isOpen() && !header.contains(e.target)) setOpen(false, false);
    });

    desktop.addEventListener('change', function () { setOpen(false, false); });
  }

  /* ------------------------------- En-tête + lien actif (au défilement) */

  var toTop = document.querySelector('[data-to-top]');
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav-link]'));
  var targets = links
    .map(function (a) { return document.getElementById(a.hash.slice(1)); })
    .filter(Boolean);

  function update() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 4);
    if (toTop) toTop.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.8);

    var active = null;
    var line = window.innerHeight * 0.35;
    targets.forEach(function (section) {
      var rect = section.getBoundingClientRect();
      if (rect.top <= line && rect.bottom > line) active = section;
    });

    links.forEach(function (a) {
      if (active && a.hash === '#' + active.id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      update();
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();

  /* ----------------------------------------------- Formulaire de contact */

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-contact-form]');
    if (!form) return;
    e.preventDefault();

    var button = form.querySelector('button[type="submit"]');
    var status = form.querySelector('.form-status');
    var msg = button.dataset;
    status.className = 'form-status';

    if (!form.checkValidity()) {
      status.textContent = msg.invalid;
      status.classList.add('is-error');
      var invalid = form.querySelector(':invalid');
      if (invalid) {
        invalid.setAttribute('aria-invalid', 'true');
        invalid.focus();
      }
      return;
    }

    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (el) {
      el.removeAttribute('aria-invalid');
    });
    button.disabled = true;
    button.textContent = msg.sending;
    status.textContent = '';

    fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        status.textContent = msg.success;
        status.classList.add('is-success');
      })
      .catch(function () {
        status.textContent = msg.error;
        status.classList.add('is-error');
      })
      .then(function () {
        button.disabled = false;
        button.textContent = msg.label;
      });
  });

  document.addEventListener('input', function (e) {
    if (e.target.validity && e.target.validity.valid) e.target.removeAttribute('aria-invalid');
  });

  /* ------------------------------------------------ Simulations de projets */
  // Le moteur (sim.js) n'est chargé qu'au premier clic : la page reste légère.

  var dialog = document.querySelector('[data-sim-dialog]');
  var simSrc = document.currentScript ? new URL('sim.js', document.currentScript.src).href : 'assets/js/sim.js';
  var simLoading = null;
  var controller = null;
  var opener = null;

  function loadSim() {
    if (window.PortfolioSim) return Promise.resolve();
    if (!simLoading) {
      simLoading = new Promise(function (resolve, reject) {
        var tag = document.createElement('script');
        tag.src = simSrc;
        tag.onload = resolve;
        tag.onerror = reject;
        document.head.appendChild(tag);
      });
    }
    return simLoading;
  }

  function readJson(id) {
    var el = document.getElementById(id);
    return el ? JSON.parse(el.textContent) : null;
  }

  if (dialog && typeof dialog.showModal === 'function') {
    document.addEventListener('click', function (e) {
      var openBtn = e.target.closest('[data-sim-open]');
      if (openBtn) {
        var payload = readJson('sim-data-' + openBtn.dataset.simOpen);
        var strings = readJson('sim-ui');
        if (!payload || !strings) return;
        opener = openBtn;
        openBtn.setAttribute('aria-busy', 'true');
        loadSim().then(function () {
          openBtn.removeAttribute('aria-busy');
          dialog.className = 'sim-dialog sim-dialog--' + payload.kind;
          dialog.showModal();
          document.documentElement.classList.add('has-dialog');
          controller = window.PortfolioSim.mount(dialog, payload, strings);
        }).catch(function () { openBtn.removeAttribute('aria-busy'); });
        return;
      }
      if (!dialog.open) return;
      if (e.target.closest('[data-sim-close]')) { dialog.close(); return; }
      if (e.target === dialog) dialog.close(); // clic sur le fond
    });

    dialog.addEventListener('close', function () {
      if (controller) controller.destroy();
      controller = null;
      document.documentElement.classList.remove('has-dialog');
      dialog.replaceChildren();
      if (opener) opener.focus();
    });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll('[data-sim-open]'), function (b) { b.hidden = true; });
  }
})();
