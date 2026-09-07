import { el, escapeHtml } from '../utils/dom.js';

export function button(label, { icon = '', variant = 'secondary', type = 'button', title = '', disabled = false, dataset = {} } = {}) {
  const node = el(`<button class="btn btn-${variant}" type="${type}" ${title ? `title="${escapeHtml(title)}"` : ''} ${disabled ? 'disabled' : ''}>${icon ? `<span class="icon" aria-hidden="true">${icon}</span>` : ''}<span>${escapeHtml(label)}</span></button>`);
  Object.entries(dataset).forEach(([key, value]) => { node.dataset[key] = value; });
  return node;
}

export function iconButton(icon, { title, variant = 'plain', dataset = {} } = {}) {
  const node = el(`<button class="icon-btn icon-btn-${variant}" type="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${icon}</button>`);
  Object.entries(dataset).forEach(([key, value]) => { node.dataset[key] = value; });
  return node;
}
