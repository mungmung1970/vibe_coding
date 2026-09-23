/* ============================================================
 * llm.js — 사내 gpt-oss-120b (OpenAI 호환) 질의 클라이언트
 * 문서 유형별 프롬프트는 각 화면 스크립트가 갖고, 여기는 호출만 한다.
 * ============================================================ */

// ponytail: 정적 목업이라 백엔드가 없다. 키는 하드코딩하지 않고 입력값을 localStorage 에만 둔다.
const LLM = {
  base: () => $('llmBase').value.trim().replace(/\/+$/, ''),
  model: () => $('llmModel').value.trim(),
  key: () => $('llmKey').value.trim()
};
['llmBase', 'llmModel', 'llmKey'].forEach(id => {
  const el = $(id), saved = localStorage.getItem('surrodocs.' + id);
  if (saved) el.value = saved;
  el.addEventListener('change', () => localStorage.setItem('surrodocs.' + id, el.value));
});

async function llmChat(system, user, maxTokens) {
  const headers = { 'Content-Type': 'application/json' };
  if (LLM.key()) headers.Authorization = 'Bearer ' + LLM.key();
  const res = await fetch(LLM.base() + '/chat/completions', {
    method: 'POST', headers,
    body: JSON.stringify({
      model: LLM.model(), stream: false, temperature: 0.4, max_tokens: maxTokens || 4096,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    })
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.slice(0, 200));
  return (await res.json()).choices?.[0]?.message?.content ?? '';
}

// 모델이 코드펜스나 사족을 붙여도 최외곽 { } 만 잘라서 파싱한다.
async function llmJSON(system, user, maxTokens) {
  const raw = await llmChat(system + ' Reply with JSON only. No markdown fence, no commentary. All text in Korean.', user, maxTokens);
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0 || e < s) throw new Error('JSON 을 찾지 못했습니다: ' + raw.slice(0, 120));
  return JSON.parse(raw.slice(s, e + 1));
}

// 화면 공통: 버튼 잠그고 배지 갱신
async function runLLM(btnId, badgeId, fn) {
  const btn = $(btnId), badge = $(badgeId);
  btn.disabled = true; badge.textContent = '질의 중';
  try { await fn(); badge.textContent = 'gpt-oss 생성 완료'; }
  catch (err) {
    badge.textContent = '실패';
    alert('LLM 질의 실패: ' + err.message + '\n\n엔드포인트 주소 / 키 / CORS 허용 여부를 확인하세요.');
  } finally { btn.disabled = false; }
}
