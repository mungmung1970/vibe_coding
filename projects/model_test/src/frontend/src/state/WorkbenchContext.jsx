/**
 * 화면 전체가 공유하는 상태와 백엔드 연동을 한 곳에 모은다.
 * 컴포넌트는 여기서 받은 값과 동작만 쓰고 직접 fetch하지 않는다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../services/api.js';
import { emptyAnswer, emptySchema, initialFilters } from '../data/defaults.js';

const POLL_START = 250;
const POLL_MAX = 1000;
const POLL_BACKOFF = 1.4;
const STREAM_COMMIT_MS = 60;
const MAX_IMAGES = 4;

const WorkbenchContext = createContext(null);

export function WorkbenchProvider({ children }) {
  const [models, setModels] = useState([]);
  const [providers, setProviders] = useState([]);
  const [modalityFilter, setModalityFilter] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [modelsError, setModelsError] = useState('');

  const [serving, setServing] = useState({ status: 'idle', message: '모델을 선택하면 서빙이 시작됩니다.', model: null, model_id: null, engine: '' });
  const [servingLogs, setServingLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  const [schema, setSchema] = useState(emptySchema);
  const [parameters, setParameters] = useState({});
  const [systemPrompt, setSystemPrompt] = useState('');
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState([]);
  const [answer, setAnswer] = useState(emptyAnswer);

  const [runs, setRuns] = useState([]);
  const [runsFilter, setRunsFilter] = useState(initialFilters);
  const [runsError, setRunsError] = useState('');
  const [judges, setJudges] = useState([]);
  const [notice, setNotice] = useState('');

  const pollTimer = useRef(null);
  const pollDelay = useRef(POLL_START);
  const controller = useRef(null);
  const streamBuffer = useRef(emptyAnswer);
  const commitTimer = useRef(null);

  const stopPolling = useCallback(() => {
    clearTimeout(pollTimer.current);
    pollTimer.current = null;
    pollDelay.current = POLL_START;
  }, []);

  const refreshLogs = useCallback(async () => {
    try {
      const { lines } = await api.getServingLogs();
      setServingLogs(lines);
    } catch (error) {
      setServingLogs([error.message]);
    }
  }, []);

  const loadParameters = useCallback(async (modelId) => {
    try {
      const next = await api.getParameters(modelId);
      setSchema(next);
      setParameters((previous) => Object.fromEntries(
        next.parameters.map((spec) => [spec.key, spec.key in previous ? previous[spec.key] : spec.default]),
      ));
    } catch (error) {
      setNotice(`파라미터 정의를 불러오지 못했습니다: ${error.message}`);
    }
  }, []);

  const refreshServing = useCallback(async function poll({ keepPolling = false } = {}) {
    let next;
    try {
      next = await api.getServing();
    } catch (error) {
      stopPolling();
      setServing((current) => ({ ...current, status: 'error', message: error.message }));
      return null;
    }
    setServing((current) => {
      if (next.status === 'ready' && current.status !== 'ready') loadParameters(next.model_id);
      if (next.status === 'error' && current.status !== 'error') refreshLogs();
      return next;
    });
    if (next.model_id) setSelectedModelId((current) => next.model_id ?? current);
    if (keepPolling && next.status === 'starting') {
      pollTimer.current = setTimeout(() => poll({ keepPolling: true }), pollDelay.current);
      pollDelay.current = Math.min(POLL_MAX, Math.round(pollDelay.current * POLL_BACKOFF));
    } else {
      stopPolling();
    }
    return next;
  }, [loadParameters, refreshLogs, stopPolling]);

  const loadModels = useCallback(async (modality = modalityFilter) => {
    try {
      const listed = await api.listModels(modality);
      setModels(listed.models);
      setProviders(listed.providers);
      setModelsError(listed.models.length ? '' : 'models 디렉터리에서 모델을 찾지 못했습니다.');
      setSelectedProvider((current) => (current && listed.providers.includes(current) ? current : listed.providers[0] ?? ''));
      setSelectedModelId((current) => (listed.models.some((model) => model.id === current) ? current : listed.models[0]?.id ?? ''));
    } catch (error) {
      setModelsError(error.message);
    }
    await refreshServing({ keepPolling: true });
  }, [modalityFilter, refreshServing]);

  const clearAnswer = useCallback(() => {
    streamBuffer.current = emptyAnswer;
    setAnswer((current) => (current.text || current.reasoning || current.error ? emptyAnswer : current));
  }, []);

  /** 모델을 고르면 기존 서빙을 중단하고 그 모델만 서빙한다. */
  const selectModel = useCallback(async (modelId) => {
    if (!modelId) return;
    stopPolling();
    setSelectedModelId(modelId);
    setNotice('');
    setImages([]);
    setAnswer(emptyAnswer);
    setParameters({});
    setSchema(emptySchema);
    setServing((current) => ({ ...current, status: 'starting', model_id: modelId, message: `'${modelId}' 서빙을 시작합니다.` }));
    try {
      setServing(await api.startServing(modelId));
    } catch (error) {
      setServing((current) => ({ ...current, status: 'error', message: error.message }));
      return;
    }
    await refreshServing({ keepPolling: true });
  }, [refreshServing, stopPolling]);

  const stopServing = useCallback(async () => {
    stopPolling();
    try {
      setServing(await api.stopServing());
      setSchema(emptySchema);
    } catch (error) {
      setNotice(error.message);
    }
  }, [stopPolling]);

  const commitStream = useCallback(() => {
    // 항상 지금까지 누적된 값을 커밋한다. 예약된 커밋이 옛 스냅샷을 덮어쓰지 않도록.
    commitTimer.current = null;
    setAnswer({ ...streamBuffer.current });
  }, []);

  const scheduleCommit = useCallback(() => {
    if (commitTimer.current === null) commitTimer.current = setTimeout(commitStream, STREAM_COMMIT_MS);
  }, [commitStream]);

  const submitPrompt = useCallback(async () => {
    if (serving.status !== 'ready') { setNotice('먼저 모델을 선택해 서빙을 시작해 주세요.'); return; }
    if (!prompt.trim()) { setNotice('질문을 입력해 주세요.'); return; }

    const payload = { model_id: serving.model_id, prompt, system_prompt: systemPrompt, parameters, images };
    controller.current = new AbortController();
    streamBuffer.current = { ...emptyAnswer, streaming: true, startedAt: Date.now() };
    setNotice('');
    setAnswer(streamBuffer.current);

    const finish = (patch) => {
      controller.current = null;
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
      streamBuffer.current = { ...streamBuffer.current, streaming: false, ...patch };
      setAnswer({ ...streamBuffer.current });
    };

    try {
      if (parameters.stream === false) {
        const { run } = await api.generateOnce(payload, controller.current.signal);
        finish({ run, text: run.text, reasoning: run.reasoning });
        return;
      }
      await api.generateStream(payload, {
        delta: (event) => {
          streamBuffer.current = { ...streamBuffer.current, text: streamBuffer.current.text + event.text };
          scheduleCommit();
        },
        reasoning: (event) => {
          streamBuffer.current = { ...streamBuffer.current, reasoning: streamBuffer.current.reasoning + event.text };
          scheduleCommit();
        },
        done: (event) => finish({ run: event.run, text: event.run.text, reasoning: event.run.reasoning }),
        error: (event) => finish({ error: event.error.message }),
      }, controller.current.signal);
    } catch (error) {
      finish({ error: error.name === 'AbortError' ? '요청을 중단했습니다.' : error.message });
      return;
    }
    if (streamBuffer.current.streaming) finish({});
  }, [images, parameters, prompt, scheduleCommit, serving.model_id, serving.status, systemPrompt]);

  const cancelPrompt = useCallback(() => controller.current?.abort(), []);

  /** 저장 버튼을 눌렀을 때만 기록에 남는다. */
  const saveAnswer = useCallback(async () => {
    if (!answer.run || answer.streaming) { setNotice('저장할 완료된 답변이 없습니다.'); return; }
    if (answer.saved) return;
    try {
      await api.saveRun(answer.run);
      streamBuffer.current = { ...streamBuffer.current, saved: true };
      setAnswer((current) => ({ ...current, saved: true }));
      setNotice('답변을 저장했습니다.');
    } catch (error) {
      setNotice(error.message);
    }
  }, [answer.run, answer.saved, answer.streaming]);

  const addImages = useCallback(async (files) => {
    try {
      const added = await Promise.all(Array.from(files).map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, data_url: String(reader.result) });
        reader.onerror = () => reject(new Error(`${file.name}을(를) 읽지 못했습니다.`));
        reader.readAsDataURL(file);
      })));
      setImages((current) => [...current, ...added].slice(0, MAX_IMAGES));
    } catch (error) {
      setNotice(error.message);
    }
  }, []);

  const removeImage = useCallback((name) => setImages((current) => current.filter((image) => image.name !== name)), []);

  const loadRuns = useCallback(async (filters = runsFilter) => {
    try {
      const { runs: listed } = await api.listRuns({ ...filters, limit: 60 });
      setRuns(listed);
      setRunsError('');
    } catch (error) {
      setRunsError(error.message);
    }
  }, [runsFilter]);

  const deleteRun = useCallback(async (runId) => {
    try {
      await api.deleteRun(runId);
      await loadRuns();
    } catch (error) {
      setNotice(error.message);
    }
  }, [loadRuns]);

  const loadJudges = useCallback(async () => {
    try {
      const { models: candidates } = await api.listJudges();
      setJudges(candidates);
    } catch {
      setJudges([]);
    }
  }, []);

  useEffect(() => { loadModels(); return stopPolling; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const value = useMemo(() => ({
    models, providers, modalityFilter, selectedProvider, selectedModelId, modelsError,
    serving, servingLogs, showLogs, schema, parameters, systemPrompt, prompt, images, answer,
    runs, runsFilter, runsError, judges, notice,
    setModalityFilter: (modality) => { setModalityFilter(modality); loadModels(modality); },
    setSelectedProvider: (provider) => {
      setSelectedProvider(provider);
      setSelectedModelId(models.find((model) => model.provider === provider)?.id ?? '');
    },
    setParameter: (key, next) => setParameters((current) => ({ ...current, [key]: next })),
    resetParameters: () => setParameters({ ...schema.defaults }),
    setSystemPrompt, setPrompt, setNotice, setRunsFilter,
    toggleLogs: () => { setShowLogs((current) => { if (!current) refreshLogs(); return !current; }); },
    loadModels, selectModel, stopServing, submitPrompt, cancelPrompt, saveAnswer, clearAnswer,
    addImages, removeImage, loadRuns, deleteRun, loadJudges, refreshLogs,
  }), [models, providers, modalityFilter, selectedProvider, selectedModelId, modelsError, serving, servingLogs,
    showLogs, schema, parameters, systemPrompt, prompt, images, answer, runs, runsFilter, runsError, judges, notice,
    loadModels, selectModel, stopServing, submitPrompt, cancelPrompt, saveAnswer, clearAnswer, addImages,
    removeImage, loadRuns, deleteRun, loadJudges, refreshLogs]);

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench() {
  const value = useContext(WorkbenchContext);
  if (!value) throw new Error('useWorkbench must be used within WorkbenchProvider');
  return value;
}
