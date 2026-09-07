/** Shape of the whole UI state, and the empty values it starts from. */
export const initialState = {
  activeTab: 'prompt',

  // 인증 기능이 아직 없다. 로그인이 붙으면 이 값이 실제 사용자 ID가 된다.
  user: 'anonymous',

  models: [],
  providers: [],
  modalityFilter: '',
  selectedProvider: '',
  selectedModelId: '',
  modelsError: '',

  serving: { status: 'idle', message: '모델을 선택하면 서빙이 시작됩니다.', model: null, model_id: null, engine: '' },
  servingLogs: [],
  showLogs: false,
  collapsed: {},

  schema: { groups: [], parameters: [], defaults: {} },
  parameters: {},
  systemPrompt: '',

  prompt: '',
  images: [],
  answer: { text: '', reasoning: '', run: null, streaming: false, error: '', saved: false },

  runs: [],
  historyView: 'grid',
  activeRunId: '',
  hiddenRunIds: [],
  runsFilter: { model_id: '', q: '', from: '', to: '' },
  selectedRunIds: [],
  comparison: null,
  judges: [],
  reference: '',
  judgeModelId: '',
  contextMenu: null,
  runsError: '',

  notice: '',
};

/** Parameter keys summarised on result cards, in the order the reference screens show them. */
export const SUMMARY_KEYS = [
  'reasoning_effort',
  'max_tokens',
  'temperature',
  'top_p',
  'top_k',
  'min_p',
  'frequency_penalty',
  'presence_penalty',
  'repetition_penalty',
  'seed',
];

export const STATUS_LABELS = {
  idle: '대기',
  starting: '서빙 준비 중',
  ready: '서빙 중',
  stopping: '중단 중',
  error: '오류',
};
