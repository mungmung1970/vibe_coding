import { useEffect, useState } from 'react';
import { compareRuns, listJudges } from '../services/modelService.js';
import { formatDateTime, formatSeconds, formatValue, rankJudgements } from '../utils/format.js';

/** 모범답변이 있으면 심판 모델이 매긴 점수를 순위로 정렬해 보여준다. */
function Judgement({ judgement, runs }) {
  if (!judgement) return null;
  const ranked = rankJudgements(judgement.rankings, runs);
  return (
    <>
      <h3>비교 결과</h3>
      <p className="side-note">심판: {judgement.judgeLabel} · 적절성 순위</p>
      <table className="compare-table rank-table">
        <thead><tr><th>순위</th><th>모델</th><th>답변</th><th>점수</th><th>근거</th></tr></thead>
        <tbody>
          {ranked.map((item) => (
            <tr key={item.index} className={item.rank === 1 ? 'is-top' : ''}>
              <td className="rank-cell">{item.rank}위</td>
              <td>{item.model_id || '-'}</td>
              <td>답변 {item.index}</td>
              <td>{item.score}</td>
              <td>{item.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {judgement.summary && <p>{judgement.summary}</p>}
    </>
  );
}

export default function CompareDialog({ runs, onClose }) {
  const [judges, setJudges] = useState([]);
  const [judgeModelId, setJudgeModelId] = useState('');
  const [reference, setReference] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { listJudges().then(setJudges); }, []);

  const compare = async () => {
    setBusy(true);
    try {
      setResult(await compareRuns(runs, { reference: reference.trim(), judgeModelId }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-label="답변 비교" aria-modal="true">
        <header className="modal-head">
          <strong>답변비교</strong>
          <button type="button" className="icon-btn" title="닫기" aria-label="닫기" onClick={onClose}>×</button>
        </header>
        <div className="modal-body">
          <div className="compare-form">
            <label className="form-row">
              <span>비교 모델</span>
              <select value={judgeModelId} aria-label="심판 모델" onChange={(event) => setJudgeModelId(event.target.value)}>
                <option value="">선택 안 함 (답변만 비교)</option>
                {judges.map((judge) => <option key={judge.id} value={judge.id}>{judge.label}</option>)}
              </select>
            </label>
            <label className="form-row">
              <span>모범답변</span>
              <textarea rows="3" value={reference} placeholder="비교 기준이 되는 정답 예시. 비워두면 답변만 나란히 비교합니다."
                onChange={(event) => setReference(event.target.value)} />
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={compare}>{busy ? '비교 중…' : '비교'}</button>
            </div>
          </div>

          {result ? (
            <>
              <Judgement judgement={result.judgement} runs={result.runs} />
              <h3>파라미터 차이</h3>
              <table className="compare-table">
                <thead>
                  <tr><th>파라미터</th>{result.runs.map((run) => <th key={run.id}>{run.model_id}<br /><small>{formatDateTime(run.created_at)}</small></th>)}</tr>
                </thead>
                <tbody>
                  {result.parameterDifferences.length ? result.parameterDifferences.map((item) => (
                    <tr key={item.key}><th>{item.key}</th>{item.values.map((value, index) => <td key={index}>{formatValue(value)}</td>)}</tr>
                  )) : <tr><td colSpan={result.runs.length + 1}>파라미터 값이 모두 동일합니다.</td></tr>}
                </tbody>
              </table>
              <h3>답변</h3>
              <div className="compare-answers">
                {result.runs.map((run) => (
                  <article className="compare-answer" key={run.id}>
                    <header><strong>{run.model_id}</strong><small>{formatSeconds(run.latency_ms)}</small></header>
                    <div className="prompt-box">{run.prompt}</div>
                    <p className="card-result">{run.text}</p>
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
