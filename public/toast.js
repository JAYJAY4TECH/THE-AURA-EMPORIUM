/* Shared toast notification — single source of truth.
 * Usage: showToast(msg, type) where type is 'success' | 'error' | 'info'.
 * Slides in, auto-dismisses after ~3.2s, dismissible via close button.
 * Safe to include on any page; no dependencies.
 */
(function () {
  var WRAP_ID = 'auraToastWrap';
  var DEFAULT_MS = 3200;
  var ICONS = {
    success: '\u2713',
    error: '\u2715',
    info: 'i'
  };

  function getWrap() {
    var wrap = document.getElementById(WRAP_ID);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = WRAP_ID;
      wrap.className = 'aura-toast-wrap';
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function normalizeType(type) {
    type = String(type || 'info').toLowerCase();
    if (type === 'warn' || type === 'warning') return 'error';
    if (type !== 'success' && type !== 'error' && type !== 'info') return 'info';
    return type;
  }

  window.showToast = function (msg, type) {
    var kind = normalizeType(type);
    var text = (msg === undefined || msg === null || msg === '') ? 'Done.' : String(msg);

    var wrap = getWrap();
    var el = document.createElement('div');
    el.className = 'aura-toast aura-toast-' + kind;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');

    var icon = document.createElement('span');
    icon.className = 'aura-toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ICONS[kind] || ICONS.info;

    var body = document.createElement('span');
    body.className = 'aura-toast-msg';
    body.textContent = text;

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'aura-toast-close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = '\u00D7';

    el.appendChild(icon);
    el.appendChild(body);
    el.appendChild(close);
    wrap.appendChild(el);

    // Slide in on next frame so the transition runs.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('aura-toast-in');
      });
    });

    var done = false;
    function dismiss() {
      if (done) return;
      done = true;
      el.classList.remove('aura-toast-in');
      el.classList.add('aura-toast-out');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (wrap.childNodes.length === 0 && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }, 380);
    }

    close.addEventListener('click', dismiss);
    setTimeout(dismiss, DEFAULT_MS);
    return dismiss;
  };
})();
