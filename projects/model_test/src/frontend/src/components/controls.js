/** Renders sidebar controls straight from the backend parameter definition. */
import { el, escapeHtml } from '../utils/dom.js';

const displayValue = (spec, value) => {
  if (value === null || value === undefined || value === '') return spec.nullable ? '랜덤' : '';
  return Array.isArray(value) ? value.join(', ') : String(value);
};

const readNumber = (spec, raw) => {
  if (raw === '') return spec.nullable ? null : spec.default ?? null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? spec.default ?? null : parsed;
};

function rangeControl(spec, value, onChange) {
  const current = value ?? spec.default ?? spec.min ?? 0;
  const field = el(`
    <label class="field" title="${escapeHtml(spec.help ?? '')}">
      <span class="field-label">${escapeHtml(spec.label)}<b class="field-value">${escapeHtml(displayValue(spec, current))}</b></span>
      <input type="range" min="${spec.min}" max="${spec.max}" step="${spec.step ?? 1}" value="${current}" aria-label="${escapeHtml(spec.label)}" />
    </label>`);
  const input = field.querySelector('input');
  const label = field.querySelector('.field-value');
  input.addEventListener('input', () => {
    const next = readNumber(spec, input.value);
    label.textContent = displayValue(spec, next);
    onChange(spec.key, next);
  });
  return field;
}

function numberControl(spec, value, onChange) {
  const field = el(`
    <label class="field" title="${escapeHtml(spec.help ?? '')}">
      <span class="field-label">${escapeHtml(spec.label)}</span>
      <input type="number" ${spec.min !== undefined ? `min="${spec.min}"` : ''} ${spec.max !== undefined ? `max="${spec.max}"` : ''}
        step="${spec.step ?? 1}" value="${value ?? ''}" placeholder="${escapeHtml(spec.placeholder ?? '')}" aria-label="${escapeHtml(spec.label)}" />
    </label>`);
  const input = field.querySelector('input');
  input.addEventListener('change', () => onChange(spec.key, readNumber(spec, input.value)));
  return field;
}

function selectControl(spec, value, onChange) {
  const options = (spec.options ?? []).map((option) => (
    `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`
  )).join('');
  const field = el(`
    <label class="field" title="${escapeHtml(spec.help ?? '')}">
      <span class="field-label">${escapeHtml(spec.label)}</span>
      <select aria-label="${escapeHtml(spec.label)}">${options}</select>
    </label>`);
  const select = field.querySelector('select');
  select.addEventListener('change', () => onChange(spec.key, select.value));
  return field;
}

function checkboxControl(spec, value, onChange) {
  const field = el(`
    <label class="check" title="${escapeHtml(spec.help ?? '')}">
      <input type="checkbox" ${value ? 'checked' : ''} />
      <span>${escapeHtml(spec.label)}</span>
    </label>`);
  const input = field.querySelector('input');
  input.addEventListener('change', () => onChange(spec.key, input.checked));
  return field;
}

function tagsControl(spec, value, onChange) {
  const field = el(`
    <label class="field" title="${escapeHtml(spec.help ?? '')}">
      <span class="field-label">${escapeHtml(spec.label)}</span>
      <input type="text" value="${escapeHtml(Array.isArray(value) ? value.join(', ') : value ?? '')}"
        placeholder="쉼표로 구분" aria-label="${escapeHtml(spec.label)}" />
    </label>`);
  const input = field.querySelector('input');
  input.addEventListener('change', () => onChange(spec.key, input.value.split(',').map((item) => item.trim()).filter(Boolean)));
  return field;
}

const CONTROLS = {
  range: rangeControl,
  number: numberControl,
  select: selectControl,
  checkbox: checkboxControl,
  tags: tagsControl,
};

export function parameterControl(spec, value, onChange) {
  return (CONTROLS[spec.control] ?? numberControl)(spec, value, onChange);
}

/** One collapsible sidebar section per parameter group. */
export function parameterSection(group, specs, values, onChange, extraHeader = '') {
  const section = el(`
    <section class="side-section">
      <h2>${escapeHtml(group.label)}${extraHeader}</h2>
      <div class="side-body"></div>
    </section>`);
  const body = section.querySelector('.side-body');
  specs.forEach((spec) => body.append(parameterControl(spec, values[spec.key], onChange)));
  return section;
}
