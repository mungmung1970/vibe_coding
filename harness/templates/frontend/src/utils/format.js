export const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatSeconds = (milliseconds) => (
  typeof milliseconds === 'number' ? `${(milliseconds / 1000).toFixed(2)}초` : '-'
);

export const formatUsage = (usage) => {
  if (!usage) return '';
  const total = usage.total_tokens ?? 0;
  return `${total.toLocaleString('ko-KR')}자`;
};

/** 사고 토큰이 흐르는 동안 답변 영역에 띄우는 진행 문구. */
export const formatThinkingProgress = ({ characters = 0, elapsedMs = 0 } = {}) => (
  `사고 중… ${(Math.max(0, elapsedMs) / 1000).toFixed(1)}초 · ${Number(characters).toLocaleString('ko-KR')}자`
);

/** 완료 통계에 덧붙이는 사고 토큰 수. 엔진이 보고하지 않으면 빈 문자열. */
export const formatReasoningTokens = (usage) => {
  const tokens = usage?.completion_tokens_details?.reasoning_tokens;
  return typeof tokens === 'number' && tokens > 0 ? `사고 ${tokens.toLocaleString('ko-KR')}토큰` : '';
};

/**
 * 심판 점수를 내림차순으로 정렬해 순위를 매긴다.
 * 순위는 점수에서 계산한다 — 모델이 말한 순서는 점수와 어긋날 수 있다.
 * 동점은 같은 순위를 주고 다음 순위를 건너뛴다(1, 1, 3).
 */
export const rankJudgements = (rankings = [], runs = []) => {
  const scored = rankings.map((item) => ({
    ...item,
    score: Number(item.score) || 0,
    model_id: runs[Number(item.index) - 1]?.model_id ?? '',
  }));
  scored.sort((a, b) => b.score - a.score);
  let rank = 0;
  let previous = null;
  return scored.map((item, position) => {
    if (item.score !== previous) { rank = position + 1; previous = item.score; }
    return { ...item, rank };
  });
};

/**
 * 공급자가 보고한 예상 비용. 보고하지 않는 공급자도 있어 값이 있을 때만 표시한다.
 * 한 번 호출에 1센트도 안 되는 경우가 많아 소수점을 넉넉히 남긴다.
 */
export const formatCost = (usage) => {
  const cost = usage?.estimated_cost;
  if (typeof cost !== 'number' || cost <= 0) return '';
  return cost < 0.01 ? `$${cost.toFixed(5)}` : `$${cost.toFixed(3)}`;
};

export const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '기본값';
  if (Array.isArray(value)) return value.join(', ') || '없음';
  if (typeof value === 'boolean') return value ? '켜짐' : '꺼짐';
  return String(value);
};

/** Compact "key=value" line shown under each result card, as in the reference screens. */
export const formatParameterSummary = (parameters = {}, keys = []) => (
  keys
    .filter((key) => parameters[key] !== undefined && parameters[key] !== null && parameters[key] !== '')
    .map((key) => `${key}=${Array.isArray(parameters[key]) ? parameters[key].join('|') : parameters[key]}`)
    .join(' · ')
);

