/** 화면 표시용 순수 함수. DOM이나 API에 의존하지 않는다. */

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

export const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '기본값';
  if (Array.isArray(value)) return value.join(', ') || '없음';
  if (typeof value === 'boolean') return value ? '켜짐' : '꺼짐';
  return String(value);
};

/** 모델 이름 옆에 유형을 괄호로 붙인다. */
export const modelLabel = (model) => (model ? `${model.name} (${model.modality})` : '');

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
