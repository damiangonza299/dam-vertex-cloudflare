/* =========================================================
   DAM inSync V1 — Behavioral Analytics Client
   No PII. No shared state with DV.* namespace.
   ========================================================= */
(function () {
  'use strict';

  var SESSION_KEY = 'dv_insync_sid';
  var ENDPOINT    = '/api/insync';
  var FLUSH_MS    = 8000;
  var MAX_BATCH   = 30;

  /* ── Session ID (anonymous, no PII) ── */
  function getSession() {
    try {
      var id = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = 'is_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        try { sessionStorage.setItem(SESSION_KEY, id); } catch (_) {}
        try { localStorage.setItem(SESSION_KEY, id); } catch (_) {}
      }
      return id;
    } catch (_) {
      return 'is_' + Math.random().toString(36).slice(2, 10);
    }
  }

  var SID     = getSession();
  var LANDING = location.pathname;

  /* Expose for products.js to include in lead POST */
  window.DV_INSYNC_SESSION = SID;

  /* Expose push/flush for products.js to emit DAM Intelligence events */
  window.DV_INSYNC = { push: push, flush: flush };

  /* ── Event queue ── */
  var Q       = [];
  var timer   = null;
  var lastCta = null; /* last CTA type clicked, for modal attribution */

  function push(type, section, cta_type, meta) {
    Q.push({
      type:     type,
      section:  section  || null,
      cta_type: cta_type || null,
      meta:     meta ? JSON.stringify(meta) : null,
      ts:       Math.floor(Date.now() / 1000),
    });
    if (Q.length >= MAX_BATCH) {
      flush();
    } else if (!timer) {
      timer = setTimeout(flush, FLUSH_MS);
    }
  }

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!Q.length) return;
    var events  = Q.splice(0);
    var payload = JSON.stringify({ session_id: SID, landing: LANDING, events: events });
    try {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
    } catch (_) {
      try {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      } catch (_) {}
    }
  }

  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  /* ── Page view ── */
  push('page_view', null, null, {
    referrer: document.referrer ? (function () { try { return new URL(document.referrer).hostname; } catch (_) { return ''; } })() : '',
    mobile:   window.innerWidth < 768,
  });

  /* ── Scroll depth ── */
  var scrollHits = {};
  window.addEventListener('scroll', function () {
    var pct = Math.round(((window.scrollY + window.innerHeight) / Math.max(document.body.scrollHeight, 1)) * 100);
    [25, 50, 75, 90].forEach(function (m) {
      if (pct >= m && !scrollHits[m]) {
        scrollHits[m] = true;
        push('scroll_' + m, null, null, null);
      }
    });
  }, { passive: true });

  /* ── Section visibility (IntersectionObserver) ── */
  var secTimers = {};
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var name = (e.target.dataset && e.target.dataset.insyncSection) || e.target.id || null;
        if (!name) return;
        if (e.isIntersecting) {
          push('section_view', name, null, null);
          secTimers[name] = Date.now();
        } else if (secTimers[name]) {
          var dur = Math.round((Date.now() - secTimers[name]) / 1000);
          if (dur > 1) push('section_time', name, null, { duration_s: dur });
          delete secTimers[name];
        }
      });
    }, { threshold: 0.3 });

    /* Observe all <section> elements with an id, plus data-insync-section elements */
    document.querySelectorAll('section[id], [data-insync-section]').forEach(function (el) {
      io.observe(el);
    });
  }

  /* ── CTA clicks (data-insync-cta) — capture phase fires before openModal ── */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('[data-insync-cta]');
    if (!btn) return;
    lastCta = btn.dataset.insyncCta;
    var sec = (btn.closest && btn.closest('section[id]')) ? btn.closest('section[id]').id : null;
    push('cta_click', sec, lastCta, { label: btn.textContent.trim().slice(0, 40) });
  }, true);

  /* ── Modal events (MutationObserver on #order-modal) ── */
  var modal = document.getElementById('order-modal');
  if (modal) {
    var wasOpen = false;

    /* Modal open / close */
    new MutationObserver(function () {
      var open = modal.classList.contains('active');
      if (open && !wasOpen) push('modal_open', null, null, { trigger_cta: lastCta });
      if (!open && wasOpen) push('modal_close', null, null, null);
      wasOpen = open;
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });

    /* Form submit success (#modal-success.visible) */
    var successEl = document.getElementById('modal-success');
    if (successEl) {
      var wasVis = false;
      new MutationObserver(function () {
        var vis = successEl.classList.contains('visible');
        if (vis && !wasVis) push('form_submit', null, null, null);
        wasVis = vis;
      }).observe(successEl, { attributes: true, attributeFilter: ['class'] });
    }

    /* Stock errors — debounced to avoid double-fire on create+show */
    var stockDebounce = null;
    new MutationObserver(function (muts) {
      var fire = false;
      muts.forEach(function (m) {
        m.addedNodes && m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 && n.id === 'dv-stock-error') fire = true;
        });
        if (m.type === 'attributes' && m.target && m.target.id === 'dv-stock-error') fire = true;
      });
      if (fire) {
        clearTimeout(stockDebounce);
        stockDebounce = setTimeout(function () {
          var el = document.getElementById('dv-stock-error');
          if (el && el.style.display !== 'none' && el.textContent.trim()) {
            push('stock_error', null, null, { message: el.textContent.trim().slice(0, 80) });
          }
        }, 150);
      }
    }).observe(modal, {
      childList:       true,
      subtree:         true,
      attributes:      true,
      attributeFilter: ['style'],
    });
  }

})();
