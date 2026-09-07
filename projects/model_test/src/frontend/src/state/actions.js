/** Every state transition that involves the backend lives here. */
import * as api from '../services/api.js';

// A mock or already-warm engine is ready in well under a second, so poll fast at
// first and back off towards one second for real vLLM startups, which take minutes.
const POLL_START = 250;
const POLL_MAX = 1000;
const POLL_BACKOFF = 1.4;

export function createActions(store, { onAnswerChunk = () => {} } = {}) {
  let pollTimer = null;
  let pollDelay = POLL_START;
  let controller = null;

  const notice = (message) => store.set({ notice: message });

  const stopPolling = () => {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    pollDelay = POLL_START;
  };

  async function refreshServing({ poll = false } = {}) {
    try {
      const serving = await api.getServing();
      const previous = store.get().serving;
      const patch = { serving };
      if (serving.model_id && serving.model_id !== store.get().selectedModelId) {
        patch.selectedModelId = serving.model_id;
      }
      // Polling every second must not re-render the sidebar while nothing meaningful changed.
      const meaningful = ['status', 'model_id', 'message', 'pid'].some((key) => serving[key] !== previous[key]);
      if (meaningful || patch.selectedModelId) store.set(patch);
      else store.setQuiet(patch);
      if (serving.status === 'ready' && previous.status !== 'ready') {
        await loadParameters(serving.model_id);
      }
      if (serving.status === 'error' && previous.status !== 'error') {
        await refreshLogs();
      }
      if (poll && serving.status === 'starting') {
        pollTimer = setTimeout(() => refreshServing({ poll: true }), pollDelay);
        pollDelay = Math.min(POLL_MAX, Math.round(pollDelay * POLL_BACKOFF));
      } else {
        stopPolling();
      }
      return serving;
    } catch (error) {
      stopPolling();
      store.set({ serving: { ...store.get().serving, status: 'error', message: error.message } });
      return null;
    }
  }

  async function loadModels() {
    try {
      const { models, providers } = await api.listModels(store.get().modalityFilter);
      const state = store.get();
      const selectedProvider = state.selectedProvider || providers[0] || '';
      const inProvider = models.filter((model) => model.provider === selectedProvider);
      store.set({
        models,
        providers,
        selectedProvider,
        modelsError: models.length ? '' : 'models 디렉터리에서 모델을 찾지 못했습니다.',
        selectedModelId: state.selectedModelId || inProvider[0]?.id || '',
      });
    } catch (error) {
      store.set({ modelsError: error.message });
    }
    await refreshServing({ poll: true });
  }

  async function loadParameters(modelId) {
    try {
      const schema = await api.getParameters(modelId);
      const previous = store.get().parameters;
      const parameters = {};
      schema.parameters.forEach((spec) => {
        parameters[spec.key] = spec.key in previous ? previous[spec.key] : spec.default;
      });
      store.set({ schema, parameters });
    } catch (error) {
      notice(`파라미터 정의를 불러오지 못했습니다: ${error.message}`);
    }
  }

  async function selectProvider(provider) {
    const models = store.get().models.filter((model) => model.provider === provider);
    store.set({ selectedProvider: provider, selectedModelId: models[0]?.id ?? '' });
  }

  /** Selecting a model stops whatever is being served and serves this one instead. */
  async function selectModel(modelId) {
    if (!modelId) return;
    stopPolling();
    store.set({
      selectedModelId: modelId,
      notice: '',
      images: [],
      answer: { text: '', reasoning: '', run: null, streaming: false, error: '', saved: false },
      parameters: {},
      schema: { groups: [], parameters: [], defaults: {} },
      serving: { ...store.get().serving, status: 'starting', model_id: modelId, message: `'${modelId}' 서빙을 시작합니다.` },
    });
    try {
      store.set({ serving: await api.startServing(modelId) });
    } catch (error) {
      store.set({ serving: { ...store.get().serving, status: 'error', message: error.message } });
      return;
    }
    await refreshServing({ poll: true });
  }

  async function stopServing() {
    stopPolling();
    try {
      store.set({ serving: await api.stopServing(), schema: { groups: [], parameters: [], defaults: {} } });
    } catch (error) {
      notice(error.message);
    }
  }

  async function refreshLogs() {
    try {
      const { lines } = await api.getServingLogs();
      store.set({ servingLogs: lines });
    } catch (error) {
      store.set({ servingLogs: [error.message] });
    }
  }

  async function toggleLogs() {
    const showLogs = !store.get().showLogs;
    store.set({ showLogs });
    if (showLogs) await refreshLogs();
  }

  function setParameter(key, value) {
    store.setQuiet({ parameters: { ...store.get().parameters, [key]: value } });
  }

  function resetParameters() {
    store.set({ parameters: { ...store.get().schema.defaults } });
  }

  async function submitPrompt() {
    const state = store.get();
    if (state.serving.status !== 'ready') {
      notice('먼저 모델을 선택해 서빙을 시작해 주세요.');
      return;
    }
    if (!state.prompt.trim()) {
      notice('질문을 입력해 주세요.');
      return;
    }
    const payload = {
      model_id: state.serving.model_id,
      prompt: state.prompt,
      system_prompt: state.systemPrompt,
      parameters: state.parameters,
      images: state.images,
    };
    controller = new AbortController();
    store.set({
      notice: '',
      answer: { text: '', reasoning: '', run: null, streaming: true, error: '', saved: false },
    });

    const finish = (patch) => {
      controller = null;
      store.set({ answer: { ...store.get().answer, streaming: false, ...patch } });
    };

    try {
      if (state.parameters.stream === false) {
        const { run } = await api.generateOnce(payload, controller.signal);
        finish({ text: run.text, reasoning: run.reasoning, run });
      } else {
        await api.generateStream(payload, {
          delta: (event) => {
            const answer = store.get().answer;
            store.setQuiet({ answer: { ...answer, text: answer.text + event.text } });
            onAnswerChunk(store.get().answer);
          },
          reasoning: (event) => {
            const answer = store.get().answer;
            store.setQuiet({ answer: { ...answer, reasoning: answer.reasoning + event.text } });
            onAnswerChunk(store.get().answer);
          },
          done: (event) => finish({ run: event.run, text: event.run.text, reasoning: event.run.reasoning }),
          error: (event) => finish({ error: event.error.message }),
        }, controller.signal);
      }
    } catch (error) {
      if (error.name === 'AbortError') { finish({ error: '요청을 중단했습니다.' }); return; }
      finish({ error: error.message });
      return;
    }
    if (store.get().answer.streaming) finish({});
  }

  function cancelPrompt() {
    controller?.abort();
  }

  async function loadRuns() {
    try {
      const { runs } = await api.listRuns({ ...store.get().runsFilter, limit: 60 });
      store.set({ runs, runsError: '' });
    } catch (error) {
      store.set({ runsError: error.message });
    }
  }

  function setRunsFilter(patch) {
    store.setQuiet({ runsFilter: { ...store.get().runsFilter, ...patch } });
  }

  async function deleteRun(runId) {
    try {
      await api.deleteRun(runId);
      store.set({ selectedRunIds: store.get().selectedRunIds.filter((id) => id !== runId) });
      await loadRuns();
    } catch (error) {
      notice(error.message);
    }
  }

  function toggleRunSelection(runId) {
    const selected = store.get().selectedRunIds;
    store.set({
      selectedRunIds: selected.includes(runId) ? selected.filter((id) => id !== runId) : [...selected, runId],
    });
  }

  async function compareSelected() {
    const runIds = store.get().selectedRunIds;
    if (runIds.length < 2) {
      notice('비교할 결과를 두 개 이상 선택해 주세요.');
      return;
    }
    const { reference, judgeModelId } = store.get();
    try {
      store.set({ comparison: await api.compareRuns(runIds, { reference, judgeModelId }) });
    } catch (error) {
      notice(error.message);
    }
  }

  function closeComparison() {
    store.set({ comparison: null });
  }

  async function openCompareDialog() {
    if (store.get().selectedRunIds.length < 2) {
      notice('비교할 결과를 두 개 이상 선택해 주세요.');
      return;
    }
    await loadJudges();
    store.set({ comparison: { pending: true } });
  }

  async function setTab(tab) {
    store.set({ activeTab: tab, notice: '' });
    if (tab === 'history') await loadRuns();
  }

  /** 저장 버튼을 눌렀을 때만 기록에 남는다. */
  async function saveAnswer() {
    const { answer } = store.get();
    if (!answer.run || answer.streaming) {
      notice('저장할 완료된 답변이 없습니다.');
      return;
    }
    if (answer.saved) return;
    try {
      await api.saveRun(answer.run);
      store.set({ answer: { ...store.get().answer, saved: true }, notice: '답변을 저장했습니다.' });
    } catch (error) {
      notice(error.message);
    }
  }

  /** 입력이 바뀌면 이전 답변은 더 이상 그 입력의 결과가 아니다. */
  function clearAnswer() {
    const { answer } = store.get();
    if (!answer.text && !answer.reasoning && !answer.error) return;
    store.set({ answer: { text: '', reasoning: '', run: null, streaming: false, error: '', saved: false } });
  }

  async function setModalityFilter(modality) {
    store.set({ modalityFilter: modality });
    await loadModels();
  }

  function addImages(files) {
    const readers = Array.from(files).map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data_url: String(reader.result) });
      reader.onerror = () => reject(new Error(`${file.name}을(를) 읽지 못했습니다.`));
      reader.readAsDataURL(file);
    }));
    return Promise.all(readers)
      .then((images) => store.set({ images: [...store.get().images, ...images].slice(0, 4) }))
      .catch((error) => notice(error.message));
  }

  function removeImage(name) {
    store.set({ images: store.get().images.filter((image) => image.name !== name) });
  }

  async function loadJudges() {
    try {
      const { models } = await api.listJudges();
      store.set({ judges: models });
    } catch (error) {
      store.set({ judges: [] });
    }
  }

  function setReference(value) { store.setQuiet({ reference: value }); }
  function setJudgeModel(value) { store.setQuiet({ judgeModelId: value }); }

  /**
   * 탭 닫기. 선택해서 연 탭이면 선택에서 빼고, 선택 없이 기본으로 열린 탭이면 화면에서 감춘다.
   * 어느 쪽이든 기록은 지우지 않는다.
   */
  function closeTab(runId) {
    const { selectedRunIds, activeRunId } = store.get();
    const remaining = selectedRunIds.filter((id) => id !== runId);
    const patch = selectedRunIds.includes(runId)
      ? { selectedRunIds: remaining }
      : { hiddenRunIds: [...store.get().hiddenRunIds, runId] };
    if (activeRunId === runId) patch.activeRunId = remaining[0] ?? '';
    store.set(patch);
  }

  /** X 버튼은 삭제가 아니라 화면에서 감추기만 한다. */
  function hideRun(runId) {
    store.set({
      hiddenRunIds: [...store.get().hiddenRunIds, runId],
      selectedRunIds: store.get().selectedRunIds.filter((id) => id !== runId),
    });
  }

  function showAllRuns() { store.set({ hiddenRunIds: [] }); }

  function openContextMenu(menu) { store.set({ contextMenu: menu }); }
  function closeContextMenu() { if (store.get().contextMenu) store.set({ contextMenu: null }); }

  function setActiveRun(runId) { store.set({ activeRunId: runId }); }

  function toggleSection(id) {
    const collapsed = store.get().collapsed;
    store.set({ collapsed: { ...collapsed, [id]: !collapsed[id] } });
  }

  return {
    closeTab,
    saveAnswer,
    clearAnswer,
    setModalityFilter,
    addImages,
    removeImage,
    loadJudges,
    setReference,
    setJudgeModel,
    hideRun,
    showAllRuns,
    openContextMenu,
    closeContextMenu,
    setActiveRun,
    toggleSection,
    loadModels,
    loadParameters,
    refreshServing,
    refreshLogs,
    toggleLogs,
    selectProvider,
    selectModel,
    stopServing,
    setParameter,
    resetParameters,
    submitPrompt,
    cancelPrompt,
    loadRuns,
    setRunsFilter,
    deleteRun,
    toggleRunSelection,
    compareSelected,
    openCompareDialog,
    closeComparison,
    setTab,
    notice,
  };
}
