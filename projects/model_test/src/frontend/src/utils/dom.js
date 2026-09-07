export const el = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};

export const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export const on = (root, selector, event, handler) => {
  root.querySelectorAll(selector).forEach((node) => node.addEventListener(event, handler));
};

/**
 * Rate-limits `fn`, which must read whatever it needs at call time: a trailing
 * call carries no arguments, so it can never repaint a stale snapshot over a
 * newer one. `cancel()` drops a pending trailing call.
 */
export const throttle = (fn, wait) => {
  let last = 0;
  let timer = null;
  const run = () => { timer = null; last = Date.now(); fn(); };
  const throttled = () => {
    const remaining = wait - (Date.now() - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      run();
    } else if (timer === null) {
      timer = setTimeout(run, remaining);
    }
  };
  throttled.cancel = () => { clearTimeout(timer); timer = null; };
  return throttled;
};
