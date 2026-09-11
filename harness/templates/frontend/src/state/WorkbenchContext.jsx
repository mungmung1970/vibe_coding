/**
 * 화면 전체가 공유하는 상태와 백엔드 연동.
 * 이 프로젝트는 모델을 서빙하지 않는다 — 모델을 고르면 곧바로 사용할 수 있다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../services/api.js';
import { emptyAnswer, emptySchema, initialFilters } from '../data/defaults.js';

const STREAM_COMMIT_MS = 60;
const MAX_IMAGES = 4;
const MAX_DOCUMENTS = 4;

const readDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error(`${file.name}을(를) 읽지 못했습니다.`));
  reader.readAsDataURL(file);
});

/** 첨부 문서의 파싱 결과를 질문 앞에 붙인다. 모델에는 평문만 전달된다. */
const withDocuments = (prompt, documents) => (documents.length
  ? `${documents.map((doc) => `[첨부 문서: ${doc.name}]\n${doc.text}`).join('\n\n')}\n\n---\n${prompt}`
  : prompt);

const WorkbenchContext = createContext(null);

export function WorkbenchProvider({ children }) {
  const [models, setModels] = useState([]);
  const [providers, setProviders] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [modalityFilter, setModalityFilter] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [modelsError, setModelsError] = useState('');

  const [schema, setSchema] = useState(emptySchema);
  const [parameters, setParameters] = useState({});
  const [systemPrompt, setSystemPrompt] = useState('');
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [audio, setAudio] = useState(null); // STT 입력 파일 하나
  const [answer, setAnswer] = useState(emptyAnswer);

  const [runs, setRuns] = useState([]);
  const [runsFilter, setRunsFilter] = useState(initialFilters);
  const [runsError, setRunsError] = useState('');
  const [judges, setJudges] = useState([]);
  const [notice, setNotice] = useState('');

  const controller = useRef(null);
  const streamBuffer = useRef(emptyAnswer);
  const commitTimer = useRef(null);

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null;

  const loadParameters = useCallback(async (modelId) => {
    if (!modelId) { setSchema(emptySchema); return; }
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

  const loadModels = useCallback(async (modality = modalityFilter) => {
    try {
      const listed = await api.listModels(modality);
      setModels(listed.models);
      setProviders(listed.providers);
      // 유형 목록은 서버가 등록된 모델에서 뽑아준다. 필터를 걸어도 전체 목록은 유지한다.
      if (!modality) setModalities(listed.modalities ?? []);
      setModelsError(listed.models.length ? '' : 'models 디렉터리에서 모델을 찾지 못했습니다.');
      setSelectedProvider((current) => (current && listed.providers.includes(current) ? current : listed.providers[0] ?? ''));
      setSelectedModelId((current) => {
        const next = listed.models.some((model) => model.id === current) ? current : listed.models[0]?.id ?? '';
        loadParameters(next);
        return next;
      });
    } catch (error) {
      setModelsError(error.message);
    }
  }, [modalityFilter, loadParameters]);

  const clearAnswer = useCallback(() => {
    streamBuffer.current = emptyAnswer;
    setAnswer((current) => (current.text || current.reasoning || current.error ? emptyAnswer : current));
  }, []);

  /** 모델 선택은 즉시 반영된다. 기동 대기가 없다. */
  const selectModel = useCallback((modelId) => {
    if (!modelId) return;
    setSelectedModelId(modelId);
    setNotice('');
    setImages([]);
    setAudio(null);
    setAnswer(emptyAnswer);
    setParameters({});
    loadParameters(modelId);
  }, [loadParameters]);

  const commitStream = useCallback(() => {
    commitTimer.current = null;
    setAnswer({ ...streamBuffer.current });
  }, []);

  const scheduleCommit = useCallback(() => {
    if (commitTimer.current === null) commitTimer.current = setTimeout(commitStream, STREAM_COMMIT_MS);
  }, [commitStream]);

  const submitPrompt = useCallback(async () => {
    if (!selectedModelId) { setNotice('먼저 모델을 선택해 주세요.'); return; }
    const modality = selectedModel?.modality ?? 'LLM';
    if (modality === 'STT' && !audio) { setNotice('전사할 오디오 파일을 첨부해 주세요.'); return; }
    if (modality !== 'STT' && !prompt.trim()) {
      setNotice(modality === 'VIDEO' ? '만들 장면을 설명해 주세요.' : '질문을 입력해 주세요.');
      return;
    }
    if (selectedModel && !selectedModel.key_ready) {
      setNotice(`'${selectedModel.label}'에 필요한 API 키(${selectedModel.api_key_env})가 설정되어 있지 않습니다.`);
      return;
    }

    const payload = {
      model_id: selectedModelId,
      prompt: withDocuments(prompt, documents),
      system_prompt: systemPrompt,
      parameters,
      images,
    };
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
      // 음성·영상 모델은 채팅과 엔드포인트 규격이 다르다.
      if (modality === 'STT') {
        const { run } = await api.transcribeAudio(
          { model_id: selectedModelId, file: audio, parameters }, controller.current.signal,
        );
        finish({ run, text: run.text });
        return;
      }
      if (modality === 'TTS') {
        const { run } = await api.synthesizeSpeech(
          { model_id: selectedModelId, prompt, parameters }, controller.current.signal,
        );
        finish({ run, text: run.text, media: run.media });
        return;
      }
      if (modality === 'VIDEO') {
        await api.generateVideo({ model_id: selectedModelId, prompt, parameters }, {
          status: (event) => {
            const percent = Math.round((event.progress ?? 0) * (event.progress > 1 ? 1 : 100));
            streamBuffer.current = { ...streamBuffer.current, status: `${event.status} ${percent}%` };
            setAnswer({ ...streamBuffer.current });
          },
          done: (event) => finish({ run: event.run, text: event.run.text, media: event.run.media, status: '' }),
          error: (event) => finish({ error: event.error.message, status: '' }),
        }, controller.current.signal);
        if (streamBuffer.current.streaming) finish({});
        return;
      }
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
  }, [audio, documents, images, parameters, prompt, scheduleCommit, selectedModel, selectedModelId, systemPrompt]);

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
      const added = await Promise.all(Array.from(files).map(async (file) => ({
        name: file.name,
        data_url: await readDataUrl(file),
      })));
      setImages((current) => [...current, ...added].slice(0, MAX_IMAGES));
    } catch (error) {
      setNotice(error.message);
    }
  }, []);

  const removeImage = useCallback((name) => setImages((current) => current.filter((image) => image.name !== name)), []);

  /** 엑셀·한글 첨부: 고르는 즉시 서버에서 평문으로 파싱해 들고 있는다. */
  const addDocuments = useCallback(async (files) => {
    const chosen = Array.from(files).slice(0, MAX_DOCUMENTS);
    const parsed = [];
    for (const file of chosen) {
      try {
        parsed.push(await api.parseDocument(file.name, await readDataUrl(file)));
      } catch (error) {
        setNotice(`${file.name}: ${error.message}`);
      }
    }
    if (!parsed.length) return;
    setDocuments((current) => [
      ...current.filter((doc) => !parsed.some((next) => next.name === doc.name)),
      ...parsed,
    ].slice(0, MAX_DOCUMENTS));
    setNotice(parsed.map((doc) => `${doc.name} 파싱 완료 (${doc.chars.toLocaleString('ko-KR')}자)`).join(' · '));
  }, []);

  const removeDocument = useCallback(
    (name) => setDocuments((current) => current.filter((doc) => doc.name !== name)),
    [],
  );

  /** STT 입력. 한 번에 한 파일만 전사한다. */
  const addAudio = useCallback(async (files) => {
    const file = Array.from(files)[0];
    if (!file) return;
    try {
      setAudio({ name: file.name, data_url: await readDataUrl(file) });
    } catch (error) {
      setNotice(error.message);
    }
  }, []);

  const removeAudio = useCallback(() => setAudio(null), []);

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

  useEffect(() => { loadModels(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const value = useMemo(() => ({
    models, providers, modalities, modalityFilter, selectedProvider, selectedModelId, selectedModel, modelsError,
    schema, parameters, systemPrompt, prompt, images, documents, audio, answer,
    runs, runsFilter, runsError, judges, notice,
    setModalityFilter: (modality) => { setModalityFilter(modality); loadModels(modality); },
    setSelectedProvider: (provider) => {
      setSelectedProvider(provider);
      const first = models.find((model) => model.provider === provider);
      if (first) selectModel(first.id);
    },
    setParameter: (key, next) => setParameters((current) => ({ ...current, [key]: next })),
    resetParameters: () => setParameters({ ...schema.defaults }),
    setSystemPrompt, setPrompt, setNotice, setRunsFilter,
    loadModels, selectModel, submitPrompt, cancelPrompt, saveAnswer, clearAnswer,
    addImages, removeImage, addDocuments, removeDocument, addAudio, removeAudio,
    loadRuns, deleteRun, loadJudges,
  }), [models, providers, modalities, modalityFilter, selectedProvider, selectedModelId, selectedModel, modelsError, schema,
    parameters, systemPrompt, prompt, images, documents, audio, answer, runs, runsFilter, runsError, judges, notice,
    loadModels, selectModel, submitPrompt, cancelPrompt, saveAnswer, clearAnswer, addImages, removeImage,
    addDocuments, removeDocument, addAudio, removeAudio, loadRuns, deleteRun, loadJudges]);

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench() {
  const value = useContext(WorkbenchContext);
  if (!value) throw new Error('useWorkbench must be used within WorkbenchProvider');
  return value;
}

