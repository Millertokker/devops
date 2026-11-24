/**
 * Interactions communes à toutes les pages (script classique, chargé en `defer`).
 *
 *  - menu mobile (clic, Échap, clic en dehors, perte du focus)
 *  - bordure de l'en-tête et bouton « haut de page » au défilement
 *  - copie de l'adresse email (page contact)
 *  - formulaire de contact, s'il est configuré
 */
(function () {
  'use strict';

  var header = document.querySelector('[data-header]');
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');
  var toTop = document.querySelector('[data-to-top]');
  var desktop = window.matchMedia('(min-width: 900px)');

  /* ------------------------------------------------------- Menu mobile */

  function isOpen() { return toggle.getAttribute('aria-expanded') === 'true'; }

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
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) setOpen(false, true);
    });
    header.addEventListener('focusout', function (e) {
      if (!desktop.matches && isOpen() && !header.contains(e.relatedTarget)) setOpen(false, false);
    });
    document.addEventListener('click', function (e) {
      if (isOpen() && !header.contains(e.target)) setOpen(false, false);
    });
    desktop.addEventListener('change', function () { setOpen(false, false); });
  }

  /* ------------------------------------------------- État au défilement */

  var ticking = false;
  function update() {
    ticking = false;
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 4);
    if (toTop) toTop.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.8);
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }, { passive: true });
  update();

  /* ------------------------------------------------- Copier l'adresse */

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var status = btn.closest('.contact-card') && btn.closest('.contact-card').querySelector('.copy-status');
    var text = btn.dataset.copy;
    var done = function () { if (status) status.textContent = btn.dataset.copied + '\u00a0: ' + text; };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { if (status) status.textContent = text; });
    } else if (status) {
      status.textContent = text;
    }
  });

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
      if (invalid) { invalid.setAttribute('aria-invalid', 'true'); invalid.focus(); }
      return;
    }
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (el) { el.removeAttribute('aria-invalid'); });
    button.disabled = true;
    button.textContent = msg.sending;
    status.textContent = '';

    // Envoi en arrière-plan. Le service peut répondre 200 avec un échec dans le JSON
    // (ex. formulaire pas encore activé) : on lit la réponse avant d'annoncer un succès.
    fetch(form.dataset.endpoint || form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          var failed = !res.ok || data.success === false || data.success === 'false' || data.ok === false || data.errors;
          if (failed) throw new Error(data.message || String(res.status));
        });
      })
      .then(function () {
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
})();
