import { initialState } from './data/defaults.js';
import { createStore } from './state/store.js';
import { createActions } from './state/actions.js';
import { renderShell } from './components/layout.js';
import { renderPromptSidebar, renderHistorySidebar } from './components/sidebar.js';
import { renderPromptView } from './components/prompt-view.js';
import { renderHistoryView, renderContextMenu } from './components/history-view.js';
import { throttle } from './utils/dom.js';

const app = document.querySelector('#app');
const requestedTab = new URLSearchParams(window.location.search).get('tab');
const store = createStore({
  ...initialState,
  activeTab: requestedTab === 'history' ? 'history' : initialState.activeTab,
});

let promptView = null;
// Always paint the answer that is in the store right now, never the one captured
// when the throttled call was queued: a late flush must not undo the final state.
const pushAnswer = throttle(() => promptView?.updateAnswer(store.get().answer), 60);
const actions = createActions(store, { onAnswerChunk: pushAnswer });

let noticeTimer = null;

const handlers = {
  ...actions,
  getState: () => store.get(),
  setPrompt: (value) => store.setQuiet({ prompt: value }),
  setSystemPrompt: (value) => store.setQuiet({ systemPrompt: value }),
  setHistoryView: (view) => store.set({ historyView: view }),
  copy: async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      actions.notice('답변을 클립보드에 복사했습니다.');
    } catch {
      actions.notice('클립보드 복사를 사용할 수 없는 브라우저입니다.');
    }
  },
};

/** Keep the caret where the user left it when a state change forces a re-render. */
function captureFocus() {
  const active = document.activeElement;
  if (!active || !('selectionStart' in active)) return null;
  const key = active.id || active.dataset.role || active.dataset.filter;
  return key ? { key, start: active.selectionStart, end: active.selectionEnd } : null;
}

function restoreFocus(snapshot) {
  if (!snapshot) return;
  const node = app.querySelector(`#${CSS.escape(snapshot.key)}, [data-role="${snapshot.key}"], [data-filter="${snapshot.key}"]`);
  if (!node) return;
  node.focus();
  if ('setSelectionRange' in node && snapshot.start !== null) {
    try { node.setSelectionRange(snapshot.start, snapshot.end); } catch { /* not a text input */ }
  }
}

function render(state) {
  pushAnswer.cancel();
  const snapshot = captureFocus();
  const shell = renderShell(state, handlers);
  const sidebar = shell.querySelector('#sidebar');
  const content = shell.querySelector('#content');

  if (state.activeTab === 'prompt') {
    sidebar.append(renderPromptSidebar(state, handlers));
    promptView = renderPromptView(state, handlers);
    content.append(promptView.node);
  } else {
    promptView = null;
    sidebar.append(renderHistorySidebar(state, handlers));
    content.append(renderHistoryView(state, handlers));
  }

  const menu = renderContextMenu(state, handlers);
  if (menu) shell.append(menu);

  app.replaceChildren(shell);
  restoreFocus(snapshot);

  clearTimeout(noticeTimer);
  if (state.notice) noticeTimer = setTimeout(() => store.set({ notice: '' }), 4000);
}

// 컨텍스트 메뉴는 바깥을 누르면 닫힌다.
document.addEventListener('click', () => actions.closeContextMenu());
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') actions.closeContextMenu(); });

store.subscribe(render);
render(store.get());
actions.loadModels();
if (store.get().activeTab === 'history') actions.loadRuns();
