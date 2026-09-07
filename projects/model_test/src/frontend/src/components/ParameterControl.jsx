/** 백엔드 파라미터 정의(JSON)를 그대로 컨트롤로 그린다. */

const displayValue = (spec, value) => {
  if (value === null || value === undefined || value === '') return spec.nullable ? '랜덤' : '';
  return Array.isArray(value) ? value.join(', ') : String(value);
};

const readNumber = (spec, raw) => {
  if (raw === '') return spec.nullable ? null : spec.default ?? null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? spec.default ?? null : parsed;
};

export default function ParameterControl({ spec, value, onChange }) {
  const label = <span className="field-label">{spec.label}</span>;

  if (spec.control === 'checkbox') {
    return (
      <label className="check" title={spec.help ?? ''}>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(spec.key, event.target.checked)} />
        <span>{spec.label}</span>
      </label>
    );
  }

  if (spec.control === 'select') {
    return (
      <label className="field" title={spec.help ?? ''}>
        {label}
        <select value={value ?? ''} aria-label={spec.label} onChange={(event) => onChange(spec.key, event.target.value)}>
          {(spec.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  if (spec.control === 'range') {
    const current = value ?? spec.default ?? spec.min ?? 0;
    return (
      <label className="field" title={spec.help ?? ''}>
        <span className="field-label">
          {spec.label}<b className="field-value">{displayValue(spec, current)}</b>
        </span>
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step ?? 1}
          value={current}
          aria-label={spec.label}
          onChange={(event) => onChange(spec.key, readNumber(spec, event.target.value))}
        />
      </label>
    );
  }

  if (spec.control === 'tags') {
    return (
      <label className="field" title={spec.help ?? ''}>
        {label}
        <input
          type="text"
          value={Array.isArray(value) ? value.join(', ') : value ?? ''}
          placeholder="쉼표로 구분"
          aria-label={spec.label}
          onChange={(event) => onChange(spec.key, event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
        />
      </label>
    );
  }

  return (
    <label className="field" title={spec.help ?? ''}>
      {label}
      <input
        type="number"
        min={spec.min}
        max={spec.max}
        step={spec.step ?? 1}
        value={value ?? ''}
        placeholder={spec.placeholder ?? ''}
        aria-label={spec.label}
        onChange={(event) => onChange(spec.key, readNumber(spec, event.target.value))}
      />
    </label>
  );
}
