import { useRef, useState } from 'react';
import { SUMMARY_KEYS } from '../../data/defaults.js';
import { useWorkbench } from '../../state/WorkbenchContext.jsx';
import MediaPlayer from '../../components/MediaPlayer.jsx';
import { renderMarkdown } from '../../utils/markdown.js';
import {
  formatCost,
  formatParameterSummary,
  formatReasoningTokens,
  formatSeconds,
  formatThinkingProgress,
  formatUsage,
} from '../../utils/format.js';

function answerStats(answer) {
  const characters = answer.text.length;
  if (answer.streaming) return `${characters.toLocaleString('ko-KR')}자 생성 중…`;
  if (!answer.run) return characters ? `${characters.toLocaleString('ko-KR')}자` : '';
  const seconds = (answer.run.latency_ms ?? 0) / 1000;
  const perSecond = seconds > 0 ? Math.round(characters / seconds) : 0;
  return [
    formatSeconds(answer.run.latency_ms),
    `${characters.toLocaleString('ko-KR')}자`,
    perSecond ? `${perSecond.toLocaleString('ko-KR')}자/초` : '',
    formatUsage(answer.run.usage) ? `토큰 ${answer.run.usage.total_tokens.toLocaleString('ko-KR')}` : '',
    formatReasoningTokens(answer.run.usage),
    formatCost(answer.run.usage),
  ].filter(Boolean).join(' · ');
}

function AnswerBody({ answer, raw }) {
  if (answer.error) return <p className="answer-error">{answer.error}</p>;
  if (answer.media) {
    return (
      <>
        <MediaPlayer media={answer.media} />
        <p className="side-note">{answer.text}</p>
      </>
    );
  }
  if (answer.streaming && answer.status) return <p className="thinking-progress">영상 생성 중… {answer.status}</p>;
  if (!answer.text) {
    // 본문보다 사고 토큰이 먼저 흐르는 모델에서는 진행 상황이라도 보여준다.
    if (answer.streaming && answer.reasoning) {
      return (
        <p className="thinking-progress">
          {formatThinkingProgress({
            characters: answer.reasoning.length,
            elapsedMs: Date.now() - (answer.startedAt ?? Date.now()),
          })}
        </p>
      );
    }
    return (
      <p className="answer-placeholder">
        {answer.streaming ? '응답을 생성하는 중입니다…' : '왼쪽에 질문을 입력하고 Enter를 누르면 결과가 여기에 표시됩니다.'}
      </p>
    );
  }
  if (raw) return <pre className="answer-raw">{answer.text}</pre>;
  // markdown.js가 모델 출력을 먼저 이스케이프하므로 마크업 주입은 일어나지 않는다.
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(answer.text) }} />
      {answer.streaming && <span className="caret" />}
    </>
  );
}

export default function PromptPage() {
  const {
    selectedModel, answer, parameters, images, documents, audio, prompt, systemPrompt,
    setPrompt, clearAnswer, submitPrompt, cancelPrompt, saveAnswer,
    addImages, removeImage, addDocuments, removeDocument, addAudio, removeAudio, setNotice,
  } = useWorkbench();
  const [raw, setRaw] = useState(false);
  const fileInput = useRef(null);
  const docInput = useRef(null);
  const audioInput = useRef(null);

  const modality = selectedModel?.modality ?? 'LLM';
  const isVlm = modality === 'VLM';
  const isStt = modality === 'STT';
  const modelLabel = selectedModel?.label ?? '선택된 모델 없음';
  const showThinking = parameters.show_thinking !== false && Boolean(answer.reasoning);
  const inputHint = {
    STT: '오디오 파일을 첨부하고 실행(➤)을 누르면 텍스트로 전사합니다.',
    TTS: '읽을 문장을 입력하고 실행하면 음성 파일을 만듭니다.',
    VIDEO: '만들 장면을 설명하고 실행하세요. 분 단위로 걸립니다.',
  }[modality] ?? `Enter로 실행 · Shift + Enter로 줄바꿈 · 📎 엑셀/한글 첨부${isVlm ? ' · 이미지 첨부 가능' : ''}`;

  const copy = async () => {
    if (!answer.text) return;
    try {
      await navigator.clipboard.writeText(answer.text);
      setNotice('답변을 클립보드에 복사했습니다.');
    } catch {
      setNotice('클립보드 복사를 사용할 수 없는 브라우저입니다.');
    }
  };

  return (
    <div className="prompt-grid">
      <section className="panel input-panel">
        <div className="panel-title">
          <span>입력</span>
          <span className="panel-tools">
            {isVlm && (
              <button type="button" className="panel-icon" title="이미지 첨부" aria-label="이미지 첨부" onClick={() => fileInput.current?.click()}>🖼</button>
            )}
            {isStt ? (
              <button type="button" className="panel-icon" title="오디오 첨부" aria-label="오디오 첨부" onClick={() => audioInput.current?.click()}>🎤</button>
            ) : (
              <button
                type="button"
                className="panel-icon"
                title="문서 첨부 (엑셀 xlsx · 한글 hwp/hwpx · csv/txt)"
                aria-label="문서 첨부"
                onClick={() => docInput.current?.click()}
              >📎</button>
            )}
            {/* 실행 중에는 같은 자리에서 중단 버튼이 된다. */}
            {answer.streaming ? (
              <button type="button" className="panel-icon is-stop" title="중단" aria-label="중단" onClick={cancelPrompt}>■</button>
            ) : (
              <button type="button" className="panel-icon" title="실행 (Enter)" aria-label="실행" onClick={submitPrompt}>➤</button>
            )}
          </span>
        </div>
        <textarea
          id="prompt"
          aria-label="질문 입력"
          disabled={isStt}
          placeholder={{
            STT: '오디오 파일을 첨부하면 됩니다. 이 칸은 쓰지 않습니다.',
            TTS: '음성으로 만들 문장을 입력하세요.',
            VIDEO: '만들 영상의 장면을 설명하세요.',
          }[modality] ?? '질문을 입력하세요.'}
          value={isStt ? '' : prompt}
          onChange={(event) => { setPrompt(event.target.value); clearAnswer(); }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submitPrompt();
            }
          }}
        />
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          ref={fileInput}
          onChange={(event) => { if (event.target.files?.length) addImages(event.target.files); event.target.value = ''; }}
        />
        <input
          type="file"
          accept=".xlsx,.xlsm,.hwp,.hwpx,.csv,.txt,.md,.json"
          multiple
          hidden
          ref={docInput}
          onChange={(event) => { if (event.target.files?.length) addDocuments(event.target.files); event.target.value = ''; }}
        />
        <input
          type="file"
          accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.mp4,.mpga,.flac,.ogg"
          hidden
          ref={audioInput}
          onChange={(event) => { if (event.target.files?.length) addAudio(event.target.files); event.target.value = ''; }}
        />
        {(images.length > 0 || documents.length > 0 || audio) && (
          <div className="attachments">
            {audio && (
              <span className="chip chip-doc" key={audio.name}>
                🎤 {audio.name}
                <button type="button" title="첨부 제거" aria-label="첨부 제거" onClick={removeAudio}>×</button>
              </span>
            )}
            {images.map((image) => (
              <span className="chip" key={image.name}>
                {image.name}
                <button type="button" title="첨부 제거" aria-label="첨부 제거" onClick={() => removeImage(image.name)}>×</button>
              </span>
            ))}
            {documents.map((doc) => (
              <span className="chip chip-doc" key={doc.name} title={`${doc.kind} · ${doc.text.slice(0, 300)}`}>
                {doc.name} · {doc.chars.toLocaleString('ko-KR')}자{doc.truncated ? ' (잘림)' : ''}
                <button type="button" title="첨부 제거" aria-label="첨부 제거" onClick={() => removeDocument(doc.name)}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="panel-footer">
          <span>{inputHint}</span>
          <span className="footer-right">{answer.streaming ? '실행 중 · ■ 로 중단' : ''}</span>
        </div>
      </section>

      <section className="panel answer-panel">
        <div className="panel-title">
          <span>답변</span>
          <span className="panel-tools">
            <button type="button" className="btn-save" disabled={!answer.run || answer.streaming} onClick={saveAnswer}>
              {answer.saved ? '저장됨' : '저장'}
            </button>
            <button type="button" className="panel-icon" title="답변 복사" aria-label="답변 복사" onClick={copy}>⧉</button>
            <button type="button" className="panel-icon" title="원문/렌더 전환" aria-label="원문 보기 전환" onClick={() => setRaw(!raw)}>&lt;/&gt;</button>
          </span>
        </div>
        <div className="model-meta">
          <strong>{modelLabel}</strong>
          <span>{systemPrompt ? '시스템 프롬프트 적용' : '시스템 프롬프트 없음'}</span>
          <span className="meta-params">{formatParameterSummary(parameters, SUMMARY_KEYS)}</span>
        </div>
        {showThinking && (
          <div className="thinking">
            <span className="thinking-label">thinking</span>
            <p>{answer.reasoning}</p>
          </div>
        )}
        <article className="answer"><AnswerBody answer={answer} raw={raw} /></article>
        <div className="panel-footer answer-footer"><span>{answerStats(answer)}</span></div>
      </section>
    </div>
  );
}
