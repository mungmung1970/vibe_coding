/** 화면이 시작할 때의 빈 값들과 표시 상수. */

export const emptyAnswer = {
  text: '',
  reasoning: '',
  run: null,
  streaming: false,
  error: '',
  saved: false,
  startedAt: null,
};

export const emptySchema = { groups: [], parameters: [], defaults: {} };

export const initialFilters = { model_id: '', q: '', from: '', to: '' };

/** 인증 기능이 아직 없다. 로그인이 붙으면 실제 사용자 ID가 들어간다. */
export const ANONYMOUS_USER = 'anonymous';

/** 결과 카드에 요약해 보여줄 파라미터와 순서. */
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

export const NAVIGATION = [
  { id: 'prompt', label: '프롬프트 테스트' },
  { id: 'history', label: '결과 조회' },
];
