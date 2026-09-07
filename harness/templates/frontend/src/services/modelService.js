export async function runModel(prompt, model) {
  if (!prompt.trim()) throw new Error('질문을 입력해 주세요.');
  // Replace with fetch('/api/models/run', { method: 'POST', body: ... }).
  await new Promise((resolve) => setTimeout(resolve, 250));
  return `${model} 모델의 답변입니다.\n\n${prompt}에 대한 결과를 여기에 표시합니다.`;
}
