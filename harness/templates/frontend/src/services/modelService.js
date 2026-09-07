import { demoJudges, demoModels, demoRuns } from '../data/sample.js';

export async function runModel(prompt, model) {
  if (!prompt.trim()) throw new Error('질문을 입력해 주세요.');
  // Replace with fetch('/api/models/run', { method: 'POST', body: ... }).
  await new Promise((resolve) => setTimeout(resolve, 250));
  return {
    id: `run-${Date.now()}`,
    model_id: model,
    created_at: new Date().toISOString(),
    latency_ms: 250,
    prompt,
    parameters: {},
    text: `${model} 모델의 답변입니다.\n\n${prompt}에 대한 결과를 여기에 표시합니다.`,
  };
}

export async function listModels(modality = '') {
  // Replace with fetch('/api/models').
  return modality ? demoModels.filter((model) => model.modality === modality) : demoModels;
}

export async function listRuns() {
  // Replace with fetch('/api/runs').
  return demoRuns;
}

/** 저장 버튼을 눌렀을 때만 호출된다. 생성만으로는 아무것도 남지 않는다. */
export async function saveRun(run) {
  // Replace with fetch('/api/runs', { method: 'POST', body: JSON.stringify({ run }) }).
  await new Promise((resolve) => setTimeout(resolve, 120));
  return { saved: run.id };
}

export async function listJudges() {
  // Replace with fetch('/api/judges').
  return demoJudges;
}

/**
 * 답변 비교. 모범답변이 없으면 파라미터 차이만 계산하고,
 * 모범답변과 심판 모델이 모두 있으면 채점 결과를 함께 돌려준다.
 */
export async function compareRuns(runs, { reference = '', judgeModelId = '' } = {}) {
  const keys = [...new Set(runs.flatMap((run) => Object.keys(run.parameters ?? {})))];
  const parameterDifferences = keys
    .map((key) => ({ key, values: runs.map((run) => run.parameters?.[key]) }))
    .filter((item) => new Set(item.values.map((value) => JSON.stringify(value))).size > 1);

  if (!reference || !judgeModelId) return { runs, parameterDifferences, judgement: null };

  // Replace with fetch('/api/runs/compare'); 실제 채점은 백엔드가 심판 모델에 요청한다.
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    runs,
    parameterDifferences,
    judgement: {
      judgeLabel: demoJudges.find((judge) => judge.id === judgeModelId)?.label ?? judgeModelId,
      rankings: runs.map((run, index) => ({
        index: index + 1,
        score: Math.max(0, 95 - index * 25),
        reason: '모범답변과의 일치도를 기준으로 한 예시 점수입니다.',
      })),
      summary: '데모 채점 결과입니다. 실제 값은 백엔드 채점 API가 채웁니다.',
    },
  };
}
