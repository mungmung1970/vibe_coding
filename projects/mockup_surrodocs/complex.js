/* ============================================================
 * complex.js — 복합 구조 문서 (3단계 목차 · 셀 병합 · 표 안의 표)
 * LLM 질의 → 구조 JSON → hwpx.js 로 OWPML 변환 → .hwpx 저장
 * ============================================================ */

const cdoc = { template: 'executive', data: null };
$('cxTemplateList').addEventListener('click', e => {
  const c = e.target.closest('.template-card'); if (!c) return;
  cdoc.template = c.dataset.doc;
  document.querySelectorAll('#cxTemplateList .template-card').forEach(x => x.classList.toggle('selected', x === c));
});

const CX_SCHEMA = `{
  "title": "문서 제목",
  "subtitle": "부제 한 줄",
  "sections": [{
    "no": "1", "title": "대제목", "body": "본문 2~3문장",
    "table": <표 또는 생략>,
    "subs": [{
      "no": "1.1", "title": "중제목", "body": "본문 2~3문장",
      "table": <표 또는 생략>,
      "subs": [{ "no": "1.1.1", "title": "소제목", "body": "본문 2~3문장", "table": <표 또는 생략> }]
    }]
  }]
}
표 = {
  "caption": "표 제목",
  "cols": 4,
  "rows": [
    [ {"t":"구분","head":true,"rowSpan":2}, {"t":"항목","head":true,"colSpan":3} ],
    [ {"t":"A"}, {"t":"B"}, {"t":"C"} ],
    [ {"t":"세부","rowSpan":1}, {"t":"", "colSpan":3, "table": {"cols":2,"rows":[[{"t":"내부열1","head":true},{"t":"내부열2","head":true}],[{"t":"값1"},{"t":"값2"}]]}} ]
  ]
}
셀 = {"t":텍스트, "head":머리셀 여부, "colSpan":가로병합, "rowSpan":세로병합, "table":셀 안에 넣을 표}`;

async function askComplex(topic, n) {
  const user = `주제: "${topic}"\n한국어 기술 보고서 구조를 아래 JSON 스키마로만 만들어라.\n\n` +
    `요구사항\n` +
    `- 1단계 대제목 ${n}개, 각 대제목마다 2단계 2개, 각 2단계마다 3단계 1~2개 (목차 3단계).\n` +
    `- 표를 최소 3개 포함하고, 그 중 최소 2개는 colSpan 또는 rowSpan 으로 셀을 병합한다.\n` +
    `- 최소 1개 표의 셀 안에 "table" 로 표를 한 번 더 중첩한다 (표 안의 표).\n` +
    `- 각 행의 셀 colSpan 합계는 반드시 cols 값과 같아야 한다. rowSpan 으로 위 행이 차지한 칸은 아래 행에서 다시 쓰지 않는다.\n` +
    `- 마크다운 기호나 번호 접두사를 본문에 넣지 않는다. no 필드에만 번호를 쓴다.\n\n${CX_SCHEMA}`;
  return llmJSON('You design structured Korean technical documents for Hangul(HWPX).', user, 8192);
}

/* 스키마 방어: 빠진 필드 채우고 행별 colSpan 합을 cols 에 맞춘다. */
function normalize(doc) {
  const cell = (c) => ({ t: String(c.t ?? ''), head: !!c.head, colSpan: Math.max(1, c.colSpan | 0 || 1), rowSpan: Math.max(1, c.rowSpan | 0 || 1), table: c.table ? table(c.table) : null });
  const table = (t) => {
    const rows = (t.rows || []).map(r => (r || []).map(cell)).filter(r => r.length);
    const cols = Math.max(1, t.cols | 0 || Math.max(...rows.map(r => r.reduce((a, c) => a + c.colSpan, 0)), 1));
    return { caption: t.caption || '', cols, rows };
  };
  const node = (s, depth, i, parentNo) => {
    const no = s.no || (parentNo ? `${parentNo}.${i + 1}` : String(i + 1));
    return { no, title: s.title || '(제목 없음)', body: s.body || '', table: s.table ? table(s.table) : null,
             subs: depth < 2 ? (s.subs || []).map((x, j) => node(x, depth + 1, j, no)) : [] };
  };
  const sections = (doc.sections || []).map((s, i) => node(s, 0, i, ''));
  if (!sections.length) throw new Error('sections 가 비어 있습니다');
  return { title: doc.title || '기술 보고서', subtitle: doc.subtitle || '', sections };
}

function countFeatures(doc) {
  let tables = 0, merges = 0, nested = 0;
  const scanTable = (t, inner) => {
    tables++; if (inner) nested++;
    t.rows.forEach(r => r.forEach(c => { if (c.colSpan > 1 || c.rowSpan > 1) merges++; if (c.table) scanTable(c.table, true); }));
  };
  const walk = (s) => { if (s.table) scanTable(s.table, false); (s.subs || []).forEach(walk); };
  doc.sections.forEach(walk);
  return { tables, merges, nested };
}

function renderOutline() {
  const d = cdoc.data;
  if (!d) { $('cxOutline').innerHTML = '<p class="empty">LLM 생성 버튼을 누르면 구조가 표시됩니다.</p>'; $('cxStats').textContent = '-'; return; }
  const tag = (t) => t ? `<em>표 ${t.cols}열${t.rows.some(r => r.some(c => c.colSpan > 1 || c.rowSpan > 1)) ? ' · 병합' : ''}${t.rows.some(r => r.some(c => c.table)) ? ' · 중첩' : ''}</em>` : '';
  $('cxOutline').innerHTML = d.sections.map(s =>
    `<div class="cx-l1">${esc(s.no)}. ${esc(s.title)} ${tag(s.table)}</div>` +
    s.subs.map(s2 => `<div class="cx-l2">${esc(s2.no)} ${esc(s2.title)} ${tag(s2.table)}</div>` +
      s2.subs.map(s3 => `<div class="cx-l3">${esc(s3.no)} ${esc(s3.title)} ${tag(s3.table)}</div>`).join('')).join('')).join('');
  const f = countFeatures(d);
  $('cxStats').textContent = `표 ${f.tables} · 병합셀 ${f.merges} · 중첩표 ${f.nested}`;
  $('cxJson').value = JSON.stringify(d, null, 2);
}
renderOutline();

$('cxAsk').onclick = () => runLLM('cxAsk', 'cxBadge', async () => {
  cdoc.data = normalize(await askComplex($('cxTopic').value, +$('cxCount').value));
  renderOutline();
});
$('cxJson').addEventListener('change', () => {
  try { cdoc.data = normalize(JSON.parse($('cxJson').value)); renderOutline(); }
  catch (e) { alert('JSON 오류: ' + e.message); }
});

function requireCx() { if (!cdoc.data) { alert('먼저 LLM으로 문서 구조를 생성하세요.'); return false; } return true; }
$('cxHwpxButton').onclick = () => { if (requireCx()) download(hwpxComplex(cdoc.data, cdoc.template), `surrodocs-${cdoc.template}-structured.hwpx`); };
$('cxXmlButton').onclick = () => { if (requireCx()) downloadXmlParts(() => hwpxComplex(cdoc.data, cdoc.template), 'surrodocs-structured-owpml.xml'); };
$('cxMapButton').onclick = () => showMapping('complex', 'hwpx', DOC_TEMPLATES[cdoc.template]);
