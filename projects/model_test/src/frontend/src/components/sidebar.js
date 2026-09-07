/** Left control rail. Prompt tab shows model + parameters, history tab shows search. */
import { el, escapeHtml } from '../utils/dom.js';
import { STATUS_LABELS } from '../data/defaults.js';
import { formatDateTime } from '../utils/format.js';
import { parameterControl } from './controls.js';

/** 모든 좌측 상자는 헤더를 눌러 접고 펼 수 있다. */
function section(id, title, state, handlers, buildBody, headerExtra = '') {
  const collapsed = Boolean(state.collapsed[id]);
  const node = el(`
    <section class="side-section ${collapsed ? 'is-collapsed' : ''}">
      <h2>
        <button class="side-toggle" data-section="${escapeHtml(id)}" aria-expanded="${!collapsed}">
          <span class="chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>${escapeHtml(title)}
        </button>
        ${headerExtra}
      </h2>
      <div class="side-body" ${collapsed ? 'hidden' : ''}></div>
    </section>`);
  node.querySelector('.side-toggle').addEventListener('click', () => handlers.toggleSection(id));
  if (!collapsed) buildBody(node.querySelector('.side-body'));
  return node;
}

function modelBody(body, state, handlers) {
  const { models, providers, selectedProvider, selectedModelId, serving, modalityFilter } = state;
  const providerOptions = providers.map((provider) => (
    `<option value="${escapeHtml(provider)}" ${provider === selectedProvider ? 'selected' : ''}>${escapeHtml(provider)}</option>`
  )).join('');
  const modelOptions = models
    .filter((model) => !selectedProvider || model.provider === selectedProvider)
    .map((model) => `<option value="${escapeHtml(model.id)}" ${model.id === selectedModelId ? 'selected' : ''}>${escapeHtml(model.label)}</option>`)
    .join('');

  body.append(el(`
    <div>
      <label class="field">
        <span class="field-label">모델 유형</span>
        <select data-role="modality" aria-label="모델 유형 필터">
          <option value="" ${!modalityFilter ? 'selected' : ''}>전체</option>
          <option value="LLM" ${modalityFilter === 'LLM' ? 'selected' : ''}>LLM (텍스트)</option>
          <option value="VLM" ${modalityFilter === 'VLM' ? 'selected' : ''}>VLM (텍스트+이미지)</option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">제공자</span>
        <select data-role="provider" aria-label="제공자">${providerOptions || '<option value="">-</option>'}</select>
      </label>
      <label class="field">
        <span class="field-label">모델</span>
        <select data-role="model" aria-label="모델">${modelOptions || '<option value="">모델 없음</option>'}</select>
      </label>
      <div class="serving-status status-${escapeHtml(serving.status)}">
        <span class="status-dot" aria-hidden="true"></span>
        <span class="status-text">${escapeHtml(STATUS_LABELS[serving.status] ?? serving.status)}</span>
        ${serving.engine ? `<span class="status-engine">${escapeHtml(serving.engine)}</span>` : ''}
      </div>
      <p class="side-note">${escapeHtml(serving.message ?? '')}</p>
      ${state.modelsError ? `<p class="side-error">${escapeHtml(state.modelsError)}</p>` : ''}
      <div class="side-actions">
        ${serving.status === 'ready' || serving.status === 'starting'
          ? '<button class="mini-btn" data-role="stop">서빙 중단</button>'
          : `<button class="mini-btn" data-role="serve" ${selectedModelId ? '' : 'disabled'}>서빙 시작</button>`}
        <button class="mini-btn" data-role="logs">${state.showLogs ? '로그 숨기기' : '로그 보기'}</button>
      </div>
      ${state.showLogs ? `<pre class="side-log">${escapeHtml((state.servingLogs ?? []).slice(-40).join('\n') || '로그가 없습니다.')}</pre>` : ''}
    </div>`));

  body.querySelector('[data-role="modality"]').addEventListener('change', (event) => handlers.setModalityFilter(event.target.value));
  body.querySelector('[data-role="provider"]').addEventListener('change', (event) => handlers.selectProvider(event.target.value));
  body.querySelector('[data-role="model"]').addEventListener('change', (event) => handlers.selectModel(event.target.value));
  body.querySelector('[data-role="stop"]')?.addEventListener('click', handlers.stopServing);
  body.querySelector('[data-role="serve"]')?.addEventListener('click', () => handlers.selectModel(selectedModelId));
  body.querySelector('[data-role="logs"]').addEventListener('click', handlers.toggleLogs);
}

export function renderPromptSidebar(state, handlers) {
  const sidebar = el('<div class="sidebar-inner"></div>');

  sidebar.append(section('model', '모델', state, handlers, (body) => modelBody(body, state, handlers)));

  sidebar.append(section('system', '시스템 프롬프트', state, handlers, (body) => {
    const field = el(`<textarea data-role="system-prompt" aria-label="시스템 프롬프트" placeholder="예: 나는 친절한 한국어 비서다.">${escapeHtml(state.systemPrompt)}</textarea>`);
    field.addEventListener('input', (event) => handlers.setSystemPrompt(event.target.value));
    body.append(field);
  }));

  const { schema, parameters, serving } = state;
  if (serving.status !== 'ready' || !schema.parameters.length) {
    sidebar.append(section('parameters', '파라미터', state, handlers, (body) => {
      body.append(el('<p class="side-note">모델이 서빙되면 파라미터가 표시됩니다.</p>'));
    }));
    return sidebar;
  }

  schema.groups.forEach((group, index) => {
    const extra = index === 0 ? '<button class="head-btn" data-role="reset" title="기본값으로 되돌리기">초기화</button>' : '';
    sidebar.append(section(`group-${group.id}`, group.label, state, handlers, (body) => {
      schema.parameters
        .filter((spec) => spec.group === group.id)
        .forEach((spec) => body.append(parameterControl(spec, parameters[spec.key], handlers.setParameter)));
    }, extra));
  });
  sidebar.querySelector('[data-role="reset"]')?.addEventListener('click', handlers.resetParameters);
  return sidebar;
}

export function renderHistorySidebar(state, handlers) {
  const { runsFilter, models, runs, hiddenRunIds } = state;
  const visible = runs.filter((run) => !hiddenRunIds.includes(run.id));
  const modelOptions = ['<option value="">전체</option>']
    .concat(models.map((model) => `<option value="${escapeHtml(model.id)}" ${model.id === runsFilter.model_id ? 'selected' : ''}>${escapeHtml(model.label)}</option>`))
    .join('');

  const sidebar = el('<div class="sidebar-inner"></div>');

  sidebar.append(section('search', '검색', state, handlers, (body) => {
    body.append(el(`
      <div>
        <label class="field"><span class="field-label">모델</span><select data-filter="model_id" aria-label="모델 필터">${modelOptions}</select></label>
        <label class="field"><span class="field-label">prompt</span><input type="search" data-filter="q" value="${escapeHtml(runsFilter.q)}" placeholder="질문/답변 검색" /></label>
        <label class="field"><span class="field-label">일자범위</span><input type="date" data-filter="from" value="${escapeHtml(runsFilter.from)}" aria-label="시작일" /></label>
        <label class="field"><span class="field-label">&nbsp;</span><input type="date" data-filter="to" value="${escapeHtml(runsFilter.to)}" aria-label="종료일" /></label>
        <div class="side-actions">
          <button class="mini-btn" data-role="search">조회</button>
          ${hiddenRunIds.length ? '<button class="mini-btn" data-role="show-all">숨긴 항목 표시</button>' : ''}
        </div>
      </div>`));
    body.querySelectorAll('[data-filter]').forEach((input) => {
      input.addEventListener('change', (event) => handlers.setRunsFilter({ [input.dataset.filter]: event.target.value }));
    });
    body.querySelector('[data-role="search"]').addEventListener('click', handlers.loadRuns);
    body.querySelector('[data-role="show-all"]')?.addEventListener('click', handlers.showAllRuns);
  }));

  sidebar.append(section('list', '리스트', state, handlers, (body) => {
    body.classList.add('side-list');
    if (!visible.length) {
      body.append(el('<p class="side-note">조회된 결과가 없습니다.</p>'));
      return;
    }
    visible.forEach((run) => {
      const item = el(`
        <button class="list-item ${state.selectedRunIds.includes(run.id) ? 'is-selected' : ''}" data-run="${escapeHtml(run.id)}">
          <strong>${escapeHtml(run.model_id)}</strong>
          <span>${escapeHtml(formatDateTime(run.created_at))}</span>
          <em>${escapeHtml(run.prompt)}</em>
        </button>`);
      item.addEventListener('click', () => handlers.toggleRunSelection(run.id));
      // 우클릭하면 삭제 메뉴가 뜬다.
      item.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        handlers.openContextMenu({ runId: run.id, x: event.clientX, y: event.clientY });
      });
      body.append(item);
    });
  }));

  return sidebar;
}
