/** 백엔드와 대화하는 유일한 모듈. 컴포넌트는 직접 fetch하지 않는다.
 * 이 프로젝트는 모델 서빙이 없어 /serving 계열 호출이 존재하지 않는다.
 */

const BASE = (globalThis.MODEL_TEST_API_BASE ?? '/api/v1').replace(/\/$/, '');

async function toError(response) {
  let message = `요청이 실패했습니다. (HTTP ${response.status})`;
  let code = 'http_error';
  try {
    const payload = await response.json();
    if (payload?.error) { message = payload.error.message ?? message; code = payload.error.code ?? code; }
  } catch { /* non-JSON error body */ }
  const error = new Error(message);
  error.code = code;
  error.status = response.status;
  return error;
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      signal,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    if (cause.name === 'AbortError') throw cause;
    const error = new Error('백엔드에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.');
    error.code = 'network_error';
    throw error;
  }
  if (!response.ok) throw await toError(response);
  if (response.status === 204) return null;
  return response.json();
}

const query = (params) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString();
  return search ? `?${search}` : '';
};

export const listModels = (modality) => request(`/models${query({ modality })}`);
export const listJudges = () => request('/judges');
export const getParameters = (modelId) => request(`/parameters${query({ model_id: modelId })}`);
export const listRuns = (filters = {}) => request(`/runs${query(filters)}`);
export const getRun = (runId) => request(`/runs/${encodeURIComponent(runId)}`);
export const deleteRun = (runId) => request(`/runs/${encodeURIComponent(runId)}`, { method: 'DELETE' });
export const saveRun = (run) => request('/runs', { method: 'POST', body: { run } });
export const compareRuns = (runIds, { reference = '', judgeModelId = '' } = {}) => request('/runs/compare', {
  method: 'POST',
  body: { run_ids: runIds, reference, judge_model_id: judgeModelId },
});

/** Non-streaming generation: one request, one finished run. */
export const generateOnce = (payload, signal) => request('/generate', {
  method: 'POST',
  body: { ...payload, stream: false },
  signal,
});

/**
 * Streaming generation over SSE.
 * `handlers` receives start/reasoning/delta/done/error events as they arrive.
 */
export async function generateStream(payload, handlers = {}, signal) {
  let response;
  try {
    response = await fetch(`${BASE}/generate`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ ...payload, stream: true }),
    });
  } catch (cause) {
    if (cause.name === 'AbortError') throw cause;
    const error = new Error('백엔드에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.');
    error.code = 'network_error';
    throw error;
  }
  if (!response.ok) throw await toError(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (block) => {
    const dataLines = block.split('\n').filter((line) => line.startsWith('data:'));
    if (!dataLines.length) return;
    let event;
    try {
      event = JSON.parse(dataLines.map((line) => line.slice(5).trim()).join('\n'));
    } catch {
      return;
    }
    handlers[event.type]?.(event);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      dispatch(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
    }
  }
  if (buffer.trim()) dispatch(buffer);
}
