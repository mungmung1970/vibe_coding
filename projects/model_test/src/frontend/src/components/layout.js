import { el, escapeHtml } from '../utils/dom.js';

const TABS = [
  { id: 'prompt', label: '프롬프트 테스트' },
  { id: 'history', label: '결과 조회' },
];

export function renderShell(state, handlers) {
  const root = el(`
    <div class="shell">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">●</span><strong>LLM Lab</strong></div>
        <nav class="tabs" aria-label="주요 메뉴">
          ${TABS.map((tab) => `<button class="tab ${state.activeTab === tab.id ? 'is-active' : ''}" data-tab="${tab.id}">${escapeHtml(tab.label)}</button>`).join('')}
        </nav>
        <div class="topbar-right">
          <span class="user-badge" title="로그인 사용자">
            <span class="user-icon" aria-hidden="true">●</span>${escapeHtml(state.user || 'anonymous')}
          </span>
        </div>
      </header>
      <div class="workspace">
        <aside class="sidebar" id="sidebar"></aside>
        <main class="content" id="content"></main>
      </div>
      ${state.notice ? `<div class="notice" role="status">${escapeHtml(state.notice)}</div>` : ''}
    </div>`);

  root.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => handlers.setTab(tab.dataset.tab));
  });
  return root;
}
