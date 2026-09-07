/** 결과 조회 화면: 카드/탭 목록과 답변 비교. */
import { el, escapeHtml } from '../utils/dom.js';
import { renderMarkdown } from '../utils/markdown.js';
import { SUMMARY_KEYS } from '../data/defaults.js';
import { formatDateTime, formatParameterSummary, formatSeconds, formatValue, rankJudgements } from '../utils/format.js';
import { button } from './button.js';

function runCard(run, selected) {
  return `
    <article class="result-card ${selected ? 'is-selected' : ''}">
      <div class="card-head">
        <label class="card-check">
          <input type="checkbox" data-select="${escapeHtml(run.id)}" ${selected ? 'checked' : ''} aria-label="비교 대상 선택" />
          <strong>${escapeHtml(run.model_id)}</strong>
        </label>
        <button class="icon-btn icon-btn-plain" data-hide="${escapeHtml(run.id)}" title="화면에서 숨기기" aria-label="화면에서 숨기기">×</button>
      </div>
      <small>${escapeHtml(run.provider ?? 'local')} · ${escapeHtml(formatDateTime(run.created_at))}</small>
      <small class="card-metrics">${escapeHtml(formatSeconds(run.latency_ms))}${run.usage ? ` · ${run.usage.total_tokens.toLocaleString('ko-KR')}토큰` : ''}</small>
      <p class="card-params">${escapeHtml(formatParameterSummary(run.parameters ?? {}, SUMMARY_KEYS))}</p>
      <p class="prompt-label">PROMPT</p>
      <div class="prompt-box">${escapeHtml(run.prompt)}</div>
      <p class="prompt-label">RESULT</p>
      <div class="card-result">${renderMarkdown(run.preview ?? run.text ?? '')}${run.truncated ? '<p class="answer-placeholder">… 이하 생략</p>' : ''}</div>
    </article>`;
}

/** 탭 보기: 선택한 답변을 탭으로 전환하며 본다. */
function tabView(runs, state, handlers) {
  const chosen = runs.filter((run) => state.selectedRunIds.includes(run.id));
  const shown = chosen.length ? chosen : runs.slice(0, 1);
  if (!shown.length) return el('<p class="answer-placeholder">표시할 결과가 없습니다.</p>');

  const activeId = shown.some((run) => run.id === state.activeRunId) ? state.activeRunId : shown[0].id;
  const active = shown.find((run) => run.id === activeId);
  const view = el(`
    <div class="run-tabs">
      <div class="run-tab-strip" role="tablist">
        ${shown.map((run) => `
          <div class="run-tab ${run.id === activeId ? 'is-active' : ''}" role="tab" aria-selected="${run.id === activeId}">
            <button class="run-tab-label" data-tab-run="${escapeHtml(run.id)}">
              <strong>${escapeHtml(run.model_id)}</strong>
              <small>${escapeHtml(formatDateTime(run.created_at))}</small>
            </button>
            <button class="run-tab-close" data-close-run="${escapeHtml(run.id)}" title="탭 닫기" aria-label="탭 닫기">×</button>
          </div>`).join('')}
      </div>
      <div class="run-tab-panel">${runCard(active, state.selectedRunIds.includes(active.id))}</div>
    </div>`);
  view.querySelectorAll('[data-tab-run]').forEach((tab) => {
    tab.addEventListener('click', () => handlers.setActiveRun(tab.dataset.tabRun));
  });
  view.querySelectorAll('[data-close-run]').forEach((close) => {
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      handlers.closeTab(close.dataset.closeRun);
    });
  });
  return view;
}

function judgementBlock(judgement, runs) {
  if (!judgement) return '';
  if (judgement.skipped) return `<p class="side-note">${escapeHtml(judgement.skipped)}</p>`;
  if (!judgement.rankings) {
    return `<p class="answer-placeholder">채점 결과를 해석하지 못했습니다.</p><pre class="answer-raw">${escapeHtml(judgement.raw ?? '')}</pre>`;
  }
  const ranked = rankJudgements(judgement.rankings, runs);
  return `
    <p class="side-note">심판: ${escapeHtml(judgement.judge_label ?? judgement.judge_model_id)} · 적절성 순위</p>
    <table class="compare-table rank-table">
      <thead><tr><th>순위</th><th>모델</th><th>답변</th><th>점수</th><th>근거</th></tr></thead>
      <tbody>${ranked.map((item) => `
        <tr class="${item.rank === 1 ? 'is-top' : ''}">
          <td class="rank-cell">${escapeHtml(item.rank)}위</td>
          <td>${escapeHtml(item.model_id || '-')}</td>
          <td>답변 ${escapeHtml(item.index)}</td>
          <td>${escapeHtml(item.score)}</td>
          <td>${escapeHtml(item.reason ?? '')}</td>
        </tr>`).join('')}</tbody>
    </table>
    ${judgement.summary ? `<p>${escapeHtml(judgement.summary)}</p>` : ''}`;
}

function compareDialog(state, handlers) {
  const comparison = state.comparison;
  const ready = !comparison.pending;
  const runs = comparison.runs ?? [];
  const differences = comparison.parameter_differences ?? [];
  const columns = runs.map((run) => `<th>${escapeHtml(run.model_id)}<br /><small>${escapeHtml(formatDateTime(run.created_at))}</small></th>`).join('');
  const rows = differences.length
    ? differences.map((item) => `<tr><th>${escapeHtml(item.key)}</th>${item.values.map((value) => `<td>${escapeHtml(formatValue(value))}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${runs.length + 1}">파라미터 값이 모두 동일합니다.</td></tr>`;

  const judgeOptions = ['<option value="">선택 안 함 (답변만 비교)</option>']
    .concat(state.judges.map((judge) => `<option value="${escapeHtml(judge.id)}" ${judge.id === state.judgeModelId ? 'selected' : ''}>${escapeHtml(judge.label)}</option>`))
    .join('');

  const modal = el(`
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-label="답변 비교" aria-modal="true">
        <header class="modal-head">
          <strong>답변비교</strong>
          <button class="icon-btn icon-btn-plain" data-role="close" title="닫기" aria-label="닫기">×</button>
        </header>
        <div class="modal-body">
          <div class="compare-form">
            <label class="form-row">
              <span>비교 모델</span>
              <select data-role="judge" aria-label="심판 모델">${judgeOptions}</select>
            </label>
            <label class="form-row">
              <span>모범답변</span>
              <textarea data-role="reference" rows="3" placeholder="비교 기준이 되는 정답 예시를 입력하세요. 비워두면 답변만 나란히 비교합니다.">${escapeHtml(state.reference)}</textarea>
            </label>
            <div class="form-actions"></div>
          </div>
          ${ready ? `
            ${comparison.judgement ? `<h3>비교 결과</h3>${judgementBlock(comparison.judgement, runs)}` : ''}
            <h3>파라미터 차이</h3>
            <table class="compare-table">
              <thead><tr><th>파라미터</th>${columns}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <h3>답변</h3>
            <div class="compare-answers">
              ${runs.map((run) => `
                <article class="compare-answer">
                  <header><strong>${escapeHtml(run.model_id)}</strong><small>${escapeHtml(formatSeconds(run.latency_ms))}</small></header>
                  <div class="prompt-box">${escapeHtml(run.prompt)}</div>
                  <div class="card-result">${renderMarkdown(run.text ?? '')}</div>
                </article>`).join('')}
            </div>` : '<p class="side-note">모범답변과 비교 모델을 정한 뒤 비교를 누르세요. 모범답변이 없으면 답변만 나란히 비교합니다.</p>'}
        </div>
      </section>
    </div>`);

  modal.querySelector('.form-actions').append(button('비교', { variant: 'primary' }));
  modal.querySelector('.form-actions button').addEventListener('click', handlers.compareSelected);
  modal.querySelector('[data-role="judge"]').addEventListener('change', (event) => handlers.setJudgeModel(event.target.value));
  modal.querySelector('[data-role="reference"]').addEventListener('input', (event) => handlers.setReference(event.target.value));
  modal.querySelector('[data-role="close"]').addEventListener('click', handlers.closeComparison);
  modal.addEventListener('click', (event) => { if (event.target === modal) handlers.closeComparison(); });
  return modal;
}

export function renderHistoryView(state, handlers) {
  const { selectedRunIds, comparison, hiddenRunIds } = state;
  const runs = state.runs.filter((run) => !hiddenRunIds.includes(run.id));
  const view = el(`
    <section class="compare-view">
      <div class="toolbar">
        <strong>결과 ${runs.length}건${selectedRunIds.length ? ` · 선택 ${selectedRunIds.length}건` : ''}${hiddenRunIds.length ? ` · 숨김 ${hiddenRunIds.length}건` : ''}</strong>
        <div class="toolbar-actions"></div>
      </div>
      ${state.runsError ? `<p class="side-error">${escapeHtml(state.runsError)}</p>` : ''}
      <div class="result-body"></div>
    </section>`);

  const actions = view.querySelector('.toolbar-actions');
  const tabs = button('탭 보기', { variant: state.historyView === 'tabs' ? 'primary' : 'secondary' });
  const grid = button('여러 개 보기', { variant: state.historyView === 'tabs' ? 'secondary' : 'primary' });
  const compare = button('답변 비교', { variant: 'secondary', disabled: selectedRunIds.length < 2 });
  tabs.addEventListener('click', () => handlers.setHistoryView('tabs'));
  grid.addEventListener('click', () => handlers.setHistoryView('grid'));
  compare.addEventListener('click', handlers.openCompareDialog);
  actions.append(tabs, grid, compare);

  const body = view.querySelector('.result-body');
  if (!runs.length) {
    body.append(el('<p class="answer-placeholder">저장된 실행 결과가 없습니다. 답변 패널의 저장 버튼을 누르면 여기에 쌓입니다.</p>'));
  } else if (state.historyView === 'tabs') {
    body.append(tabView(runs, state, handlers));
  } else {
    body.append(el(`<div class="result-cards">${runs.map((run) => runCard(run, selectedRunIds.includes(run.id))).join('')}</div>`));
  }

  body.querySelectorAll('[data-select]').forEach((input) => {
    input.addEventListener('change', () => handlers.toggleRunSelection(input.dataset.select));
  });
  body.querySelectorAll('[data-hide]').forEach((node) => {
    node.addEventListener('click', () => handlers.hideRun(node.dataset.hide));
  });
  body.querySelectorAll('.result-card').forEach((card) => {
    card.addEventListener('contextmenu', (event) => {
      const runId = card.querySelector('[data-select]')?.dataset.select;
      if (!runId) return;
      event.preventDefault();
      handlers.openContextMenu({ runId, x: event.clientX, y: event.clientY });
    });
  });

  if (comparison) view.append(compareDialog(state, handlers));
  return view;
}

/** 우클릭 메뉴. 지금은 삭제 하나만 둔다. */
export function renderContextMenu(state, handlers) {
  const { contextMenu } = state;
  if (!contextMenu) return null;
  const menu = el(`
    <div class="context-menu" style="left:${contextMenu.x}px; top:${contextMenu.y}px" role="menu">
      <button data-role="delete" role="menuitem">삭제</button>
    </div>`);
  menu.querySelector('[data-role="delete"]').addEventListener('click', () => {
    handlers.closeContextMenu();
    handlers.deleteRun(contextMenu.runId);
  });
  return menu;
}
