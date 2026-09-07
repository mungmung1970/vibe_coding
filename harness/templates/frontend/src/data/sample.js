export const sampleState = {
  model: 'local / gpt-oss-120b',
  prompt: 'LCA 리포트는 무엇인가요?',
  result: 'LCA (Life Cycle Assessment) 리포트는 제품·공정·서비스가 전체 생애주기에서 환경에 미치는 영향을 체계적으로 평가하고 정리한 보고서입니다.',
};

export const demoUsers = [
  { email: 'admin@example.com', password: 'admin', name: '관리자', role: 'admin' },
  { email: 'operator@example.com', password: 'operator', name: '운영자', role: 'operator' },
  { email: 'viewer@example.com', password: 'viewer', name: '조회자', role: 'viewer' },
];

/** 모델 목록. `modality`는 화면에 (LLM)/(VLM)으로 표시되고 유형 필터의 기준이 된다. */
export const demoModels = [
  { id: 'gpt-oss-120b', name: 'gpt-oss-120b', provider: 'Local', modality: 'LLM' },
  { id: 'qwen3-vl-27b', name: 'Qwen3-VL-27B', provider: 'Local', modality: 'VLM' },
  { id: 'openai-chat-latest', name: 'chat-latest', provider: 'OpenAI', modality: 'VLM' },
  { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'Anthropic', modality: 'VLM' },
];

/** 저장된 실행 기록 목업. 실제 API 연동 시 통째로 제거한다. */
export const demoRuns = [
  {
    id: 'run-1', model_id: 'gpt-oss-120b', provider: 'Local', created_at: '2026-07-14T10:56:00+09:00',
    latency_ms: 9060, prompt: 'LCA 리포트는 무엇인가요?', parameters: { temperature: 0.3, max_tokens: 8192 },
    text: 'LCA 리포트는 제품의 전 생애주기 환경 영향을 정량적으로 평가한 보고서입니다.',
  },
  {
    id: 'run-2', model_id: 'openai-chat-latest', provider: 'OpenAI', created_at: '2026-07-14T10:42:00+09:00',
    latency_ms: 2140, prompt: 'LCA 리포트는 무엇인가요?', parameters: { temperature: 0.7, max_tokens: 4096 },
    text: '제품·서비스가 원료 채취부터 폐기까지 환경에 미치는 영향을 분석한 문서입니다.',
  },
  {
    id: 'run-3', model_id: 'qwen3-vl-27b', provider: 'Local', created_at: '2026-07-14T10:31:00+09:00',
    latency_ms: 4820, prompt: '탄소 배출량 계산 방법', parameters: { temperature: 0.3, max_tokens: 8192 },
    text: '활동량에 배출계수를 곱해 산정하며, 범위(Scope) 1·2·3으로 구분합니다.',
  },
];

/** 답변 비교에서 심판으로 고를 수 있는 모델. */
export const demoJudges = [
  { id: 'openai-chat-latest', label: 'chat-latest (VLM)' },
  { id: 'claude-sonnet', label: 'Claude Sonnet (VLM)' },
];
