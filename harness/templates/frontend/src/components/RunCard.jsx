import { formatDateTime, formatSeconds } from '../utils/format.js';

const summarize = (parameters = {}) => Object.entries(parameters)
  .map(([key, value]) => `${key}=${value}`)
  .join(' · ');

export default function RunCard({ run, selected, onToggle, onHide, onContextMenu, bare = false }) {
  return (
    <article className={`result-card ${selected ? 'is-selected' : ''}`} onContextMenu={onContextMenu}>
      <div className="card-head">
        <label className="card-check">
          <input type="checkbox" checked={selected} aria-label="비교 대상 선택" onChange={() => onToggle(run.id)} />
          <strong>{run.model_id}</strong>
        </label>
        {/* X는 삭제가 아니라 화면에서 감추기만 한다. 삭제는 우클릭 메뉴에서. */}
        {!bare && (
          <button type="button" className="icon-btn" title="화면에서 숨기기" aria-label="화면에서 숨기기" onClick={() => onHide(run.id)}>×</button>
        )}
      </div>
      <small>{run.provider ?? 'local'} · {formatDateTime(run.created_at)}</small>
      <small className="card-metrics">{formatSeconds(run.latency_ms)}</small>
      <p className="card-params">{summarize(run.parameters)}</p>
      <p className="prompt-label">PROMPT</p>
      <div className="prompt-box">{run.prompt}</div>
      <p className="prompt-label">RESULT</p>
      <p className="card-result">{run.text}</p>
    </article>
  );
}
