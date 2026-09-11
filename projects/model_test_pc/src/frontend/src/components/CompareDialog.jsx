import { formatDateTime, formatSeconds, formatValue, rankJudgements } from '../utils/format.js';
import { renderMarkdown } from '../utils/markdown.js';
import { useWorkbench } from '../state/WorkbenchContext.jsx';
import { useHistory } from '../features/workbench/HistoryContext.jsx';

function Judgement({ judgement, runs }) {
  if (!judgement) return null;
  if (judgement.skipped) return <p className="side-note">{judgement.skipped}</p>;
  if (!judgement.rankings) {
    return (
      <>
        <p className="answer-placeholder">채점 결과를 해석하지 못했습니다.</p>
        <pre className="answer-raw">{judgement.raw ?? ''}</pre>
      </>
    );
  }
  const ranked = rankJudgements(judgement.rankings, runs);
  return (
    <>
      <p className="side-note">심판: {judgement.judge_label ?? judgement.judge_model_id} · 적절성 순위</p>
      <table className="compare-table rank-table">
        <thead><tr><th>순위</th><th>모델</th><th>답변</th><th>점수</th><th>근거</th></tr></thead>
        <tbody>
          {ranked.map((item) => (
            <tr key={item.index} className={item.rank === 1 ? 'is-top' : ''}>
              <td className="rank-cell">{item.rank}위</td>
              <td>{item.model_id || '-'}</td>
              <td>답변 {item.index}</td>
              <td>{item.score}</td>
              <td>{item.reason ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {judgement.summary && <p>{judgement.summary}</p>}
    </>
  );
}

export default function CompareDialog() {
  const { judges } = useWorkbench();
  const {
    comparison, reference, judgeModelId, comparing, compareError,
    setReference, setJudgeModelId, runCompare, closeComparison,
  } = useHistory();

  const runs = comparison.runs ?? [];
  const differences = comparison.parameter_differences ?? [];
  const ready = !comparison.pending;

  return (
    <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) closeComparison(); }}>
      <section className="modal" role="dialog" aria-label="답변 비교" aria-modal="true">
        <header className="modal-head">
          <strong>답변비교</strong>
          <button type="button" className="icon-btn icon-btn-plain" title="닫기" aria-label="닫기" onClick={closeComparison}>×</button>
        </header>
        <div className="modal-body">
          <div className="compare-form">
            <label className="form-row">
              <span>비교 모델</span>
              <select value={judgeModelId} aria-label="심판 모델" onChange={(event) => setJudgeModelId(event.target.value)}>
                <option value="">선택 안 함 (답변만 나란히)</option>
                {judges.map((judge) => (
                  <option key={judge.id} value={judge.id}>{judge.label} · {judge.provider}</option>
                ))}
              </select>
            </label>
            <label className="form-row">
              <span>모범답변</span>
              <textarea
                rows="3"
                value={reference}
                placeholder="선택 사항. 비워두면 비교 모델이 질문 기준으로 채점합니다."
                onChange={(event) => setReference(event.target.value)}
              />
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" disabled={comparing} onClick={runCompare}>
                {comparing ? '비교 중…' : '비교'}
              </button>
            </div>
            {!judges.length && <p className="side-note">비교 모델 목록을 불러오지 못했습니다. 답변만 나란히 비교합니다.</p>}
            {compareError && <p className="side-error">{compareError}</p>}
          </div>

          {ready ? (
            <>
              {comparison.judgement && <><h3>비교 결과</h3><Judgement judgement={comparison.judgement} runs={runs} /></>}
              <h3>파라미터 차이</h3>
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>파라미터</th>
                    {runs.map((run) => (
                      <th key={run.id}>{run.model_id}<br /><small>{formatDateTime(run.created_at)}</small></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {differences.length ? differences.map((item) => (
                    <tr key={item.key}>
                      <th>{item.key}</th>
                      {item.values.map((value, index) => <td key={index}>{formatValue(value)}</td>)}
                    </tr>
                  )) : (
                    <tr><td colSpan={runs.length + 1}>파라미터 값이 모두 동일합니다.</td></tr>
                  )}
                </tbody>
              </table>
              <h3>답변</h3>
              <div className="compare-answers">
                {runs.map((run) => (
                  <article className="compare-answer" key={run.id}>
                    <header><strong>{run.model_id}</strong><small>{formatSeconds(run.latency_ms)}</small></header>
                    <div className="prompt-box">{run.prompt}</div>
                    <div className="card-result" dangerouslySetInnerHTML={{ __html: renderMarkdown(run.text ?? '') }} />
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="side-note">모범답변과 비교 모델을 정한 뒤 비교를 누르세요. 모범답변이 없으면 답변만 나란히 비교합니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
