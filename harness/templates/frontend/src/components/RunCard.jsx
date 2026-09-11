import { SUMMARY_KEYS } from '../data/defaults.js';
import MediaPlayer from './MediaPlayer.jsx';
import { formatCost, formatDateTime, formatParameterSummary, formatSeconds } from '../utils/format.js';
import { renderMarkdown } from '../utils/markdown.js';

export default function RunCard({ run, selected, onToggle, onHide, onContextMenu, bare = false }) {
  return (
    <article
      className={`result-card ${selected ? 'is-selected' : ''}`}
      onContextMenu={onContextMenu}
    >
      <div className="card-head">
        <label className="card-check">
          <input type="checkbox" checked={selected} aria-label="비교 대상 선택" onChange={() => onToggle(run.id)} />
          <strong>{run.model_id}</strong>
        </label>
        {!bare && (
          <button type="button" className="icon-btn icon-btn-plain" title="화면에서 숨기기" aria-label="화면에서 숨기기" onClick={() => onHide(run.id)}>×</button>
        )}
      </div>
      <small>{run.provider ?? 'local'} · {formatDateTime(run.created_at)}</small>
      <small className="card-metrics">
        {formatSeconds(run.latency_ms)}
        {run.usage ? ` · ${run.usage.total_tokens.toLocaleString('ko-KR')}토큰` : ''}
        {formatCost(run.usage) ? ` · ${formatCost(run.usage)}` : ''}
      </small>
      <p className="card-params">{formatParameterSummary(run.parameters ?? {}, SUMMARY_KEYS)}</p>
      <p className="prompt-label">PROMPT</p>
      <div className="prompt-box" title={run.prompt}>{run.prompt}</div>
      <p className="prompt-label">RESULT</p>
      <div className="card-result">
        {run.media && <MediaPlayer media={run.media} />}
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(run.preview ?? run.text ?? '') }} />
      </div>
    </article>
  );
}

