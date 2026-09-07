import { useState } from 'react';
import { sampleState } from '../../data/sample.js';
import { runModel, saveRun } from '../../services/modelService.js';
import { formatSeconds } from '../../utils/format.js';

const EMPTY = { run: null, text: '', saved: false, error: '' };

export default function PromptPage() {
  const [prompt, setPrompt] = useState(sampleState.prompt);
  const [answer, setAnswer] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event?.preventDefault();
    setBusy(true);
    try {
      const run = await runModel(prompt, sampleState.model);
      setAnswer({ run, text: run.text, saved: false, error: '' });
    } catch (reason) {
      setAnswer({ ...EMPTY, error: reason.message });
    } finally {
      setBusy(false);
    }
  };

  /** 저장 버튼을 눌렀을 때만 기록에 남긴다. */
  const save = async () => {
    if (!answer.run || answer.saved) return;
    await saveRun(answer.run);
    setAnswer((current) => ({ ...current, saved: true }));
  };

  return (
    <div className="prompt-grid">
      <section className="panel input-panel">
        <div className="panel-title">
          <span>입력</span>
          <span className="panel-tools">
            <button type="button" className="panel-icon" onClick={submit} aria-label="질문 실행" title="실행 (Enter)">➤</button>
          </span>
        </div>
        <textarea
          value={prompt}
          aria-label="질문 입력"
          onChange={(event) => {
            setPrompt(event.target.value);
            // 입력이 바뀌면 이전 답변은 더 이상 그 질문의 결과가 아니다.
            setAnswer((current) => (current.text || current.error ? EMPTY : current));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="panel-footer">
          <span>{answer.error || 'Enter로 실행 · Shift + Enter로 줄바꿈'}</span>
          <span className="footer-right">{busy ? '생성 중…' : ''}</span>
        </div>
      </section>

      <section className="panel answer-panel">
        <div className="panel-title">
          <span>답변</span>
          <span className="panel-tools">
            <button type="button" className="btn-save" disabled={!answer.run || busy} onClick={save}>
              {answer.saved ? '저장됨' : '저장'}
            </button>
            <button type="button" className="panel-icon" title="답변 복사" aria-label="답변 복사"
              onClick={() => answer.text && navigator.clipboard?.writeText(answer.text)}>⧉</button>
          </span>
        </div>
        <div className="model-meta">
          <strong>{sampleState.model}</strong>
          <span>{answer.run ? formatSeconds(answer.run.latency_ms) : '실행 전'}</span>
        </div>
        <article className="answer">
          {answer.text
            ? <p>{answer.text}</p>
            : <p className="answer-placeholder">왼쪽에 질문을 입력하고 Enter를 누르면 결과가 여기에 표시됩니다.</p>}
        </article>
        <div className="panel-footer answer-footer">
          <span>{answer.text ? `${answer.text.length.toLocaleString('ko-KR')}자` : ''}</span>
        </div>
      </section>
    </div>
  );
}
