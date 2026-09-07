/** 프롬프트 테스트 화면: 왼쪽 입력, 오른쪽 답변. */
import { el, escapeHtml } from '../utils/dom.js';
import { renderMarkdown } from '../utils/markdown.js';
import { SUMMARY_KEYS } from '../data/defaults.js';
import {
  formatParameterSummary,
  formatReasoningTokens,
  formatSeconds,
  formatThinkingProgress,
  formatUsage,
} from '../utils/format.js';

const stats = (answer) => {
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
  ].filter(Boolean).join(' · ');
};

export function renderPromptView(state, handlers) {
  const { serving, answer, parameters, images } = state;
  const model = serving.model;
  const isVlm = model?.modality === 'VLM';
  const modelLabel = model?.label ?? serving.model_id ?? '선택된 모델 없음';
  const summary = formatParameterSummary(parameters, SUMMARY_KEYS);

  const node = el(`
    <div class="prompt-grid">
      <section class="panel input-panel">
        <div class="panel-title">
          <span>입력</span>
          <span class="panel-tools">
            ${isVlm ? '<button class="panel-icon" data-role="attach" title="이미지 첨부" aria-label="이미지 첨부">🖼</button>' : ''}
            <button class="panel-icon" data-role="send" title="실행 (Enter)" aria-label="실행">➤</button>
          </span>
        </div>
        <textarea id="prompt" aria-label="질문 입력" placeholder="질문을 입력하세요.">${escapeHtml(state.prompt)}</textarea>
        <input type="file" data-role="file" accept="image/*" multiple hidden />
        <div class="attachments" ${images.length ? '' : 'hidden'}>
          ${images.map((image) => `
            <span class="chip">${escapeHtml(image.name)}
              <button data-remove="${escapeHtml(image.name)}" title="첨부 제거" aria-label="첨부 제거">×</button>
            </span>`).join('')}
        </div>
        <div class="panel-footer">
          <span>Enter로 실행 · Shift + Enter로 줄바꿈${isVlm ? ' · 이미지 첨부 가능' : ''}</span>
          <span class="footer-right">${answer.streaming ? '<button class="mini-btn" data-role="cancel">중단</button>' : ''}</span>
        </div>
      </section>

      <section class="panel answer-panel">
        <div class="panel-title">
          <span>답변</span>
          <span class="panel-tools">
            <button class="btn-save" data-role="save" ${answer.run && !answer.streaming ? '' : 'disabled'}>
              ${answer.saved ? '저장됨' : '저장'}
            </button>
            <button class="panel-icon" data-role="copy" title="답변 복사" aria-label="답변 복사">⧉</button>
            <button class="panel-icon" data-role="raw" title="원문/렌더 전환" aria-label="원문 보기 전환">&lt;/&gt;</button>
          </span>
        </div>
        <div class="model-meta">
          <strong>${escapeHtml(modelLabel)}</strong>
          <span>${escapeHtml(state.systemPrompt ? '시스템 프롬프트 적용' : '시스템 프롬프트 없음')}</span>
          <span class="meta-params">${escapeHtml(summary)}</span>
        </div>
        <div class="thinking" data-role="thinking" hidden></div>
        <article class="answer" data-role="answer"></article>
        <div class="panel-footer answer-footer"><span data-role="stats"></span></div>
      </section>
    </div>`);

  const input = node.querySelector('#prompt');
  const answerNode = node.querySelector('[data-role="answer"]');
  const thinkingNode = node.querySelector('[data-role="thinking"]');
  const statsNode = node.querySelector('[data-role="stats"]');
  const fileInput = node.querySelector('[data-role="file"]');
  let raw = false;
  let latest = answer;
  let streamStartedAt = answer.streaming ? Date.now() : null;

  const updateAnswer = (current) => {
    latest = current;
    if (current.streaming && streamStartedAt === null) streamStartedAt = Date.now();
    if (!current.streaming) streamStartedAt = null;
    const showThinking = handlers.getState().parameters.show_thinking !== false && Boolean(current.reasoning);
    thinkingNode.hidden = !showThinking;
    if (showThinking) {
      thinkingNode.innerHTML = `<span class="thinking-label">thinking</span><p>${escapeHtml(current.reasoning)}</p>`;
    }
    if (current.error) {
      answerNode.innerHTML = `<p class="answer-error">${escapeHtml(current.error)}</p>`;
    } else if (!current.text) {
      // 본문보다 사고 토큰이 먼저 흐르는 모델에서는 진행 상황이라도 보여준다.
      const progress = current.streaming && current.reasoning
        ? formatThinkingProgress({
          characters: current.reasoning.length,
          elapsedMs: Date.now() - (streamStartedAt ?? Date.now()),
        })
        : '';
      if (progress) {
        answerNode.innerHTML = `<p class="thinking-progress">${escapeHtml(progress)}</p>`;
      } else {
        answerNode.innerHTML = current.streaming
          ? '<p class="answer-placeholder">응답을 생성하는 중입니다…</p>'
          : '<p class="answer-placeholder">왼쪽에 질문을 입력하고 Enter를 누르면 결과가 여기에 표시됩니다.</p>';
      }
    } else if (raw) {
      answerNode.innerHTML = `<pre class="answer-raw">${escapeHtml(current.text)}</pre>`;
    } else {
      answerNode.innerHTML = renderMarkdown(current.text) + (current.streaming ? '<span class="caret"></span>' : '');
    }
    statsNode.textContent = stats(current);
  };

  input.addEventListener('input', (event) => {
    handlers.setPrompt(event.target.value);
    handlers.clearAnswer();  // 입력이 바뀌면 이전 답변은 지운다
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      handlers.submitPrompt();
    }
  });
  node.querySelector('[data-role="send"]').addEventListener('click', handlers.submitPrompt);
  node.querySelector('[data-role="cancel"]')?.addEventListener('click', handlers.cancelPrompt);
  node.querySelector('[data-role="save"]').addEventListener('click', handlers.saveAnswer);
  node.querySelector('[data-role="copy"]').addEventListener('click', () => handlers.copy(latest.text));
  node.querySelector('[data-role="raw"]').addEventListener('click', () => {
    raw = !raw;
    updateAnswer(latest);
  });
  node.querySelector('[data-role="attach"]')?.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (event) => {
    if (event.target.files?.length) handlers.addImages(event.target.files);
    event.target.value = '';
  });
  node.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => handlers.removeImage(button.dataset.remove));
  });

  updateAnswer(answer);
  return { node, updateAnswer };
}
