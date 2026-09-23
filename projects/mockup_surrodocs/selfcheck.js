const fs = require('fs');
const dir = __dirname + '/';


const vals = {
  title: '2025년 6월 결제 API 장애 보고서', severity: '높음 · P2', date: '2025-06-18', author: '플랫폼개발팀 김서준',
  summary: '결제 API 응답 지연.\n커넥션 풀 고갈.', result: '커넥션 풀 상향.',
  tTitle: '2026 하반기 최신 기술 동향', tAuthor: '기술전략팀', tTopic: '생성형 AI 인프라', tCount: '2',
  tOverview: '개요 첫째 줄.\n둘째 줄.', cxTopic: '사내 AI 플랫폼', cxCount: '3',
  llmBase: 'http://10.10.20.20:8001/v1', llmModel: 'gpt-oss-120b', llmKey: ''
};
const mk = (id) => ({ id, value: vals[id] !== undefined ? vals[id] : '', textContent: '', innerHTML: '',
  firstElementChild: { textContent: '' }, dataset: {}, hidden: false, disabled: false,
  classList: { toggle() {} }, addEventListener() {}, onclick: null });
const cache = {};
global.$ = id => cache[id] || (cache[id] = mk(id));
global.document = { getElementById: id => global.$(id), querySelectorAll: () => [], addEventListener() {} };
global.localStorage = { getItem: () => null, setItem() {} };
global.Blob = class { constructor(p, o) { this.parts = p; this.type = o && o.type; } };
global.alert = m => { throw new Error('alert: ' + m); };
const saved = {};
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };

const files = ['app.js', 'formats.js', 'llm.js', 'hwpx.js', 'trend.js', 'complex.js', 'main.js'];
const test = `
deck.trends=[{title:'추론 가속기 확산',body:'본문 A.',visual:'그래프 & <도식>',checkpoints:['TCO 재계산','락인 점검'],apply:['PoC']},
             {title:'SLM 온프레미스',body:'본문 B.',visual:'비교표',checkpoints:['데이터 경계'],apply:['파일럿']}];
cdoc.data = normalize({
  title:'사내 생성형 AI 플랫폼 기술 검토', subtitle:'TECHNICAL REVIEW',
  sections:[
   {no:'1',title:'추진 배경',body:'배경 본문.',subs:[
     {no:'1.1',title:'현황',body:'현황 본문.',subs:[
       {no:'1.1.1',title:'인프라 현황',body:'인프라 본문.',
        table:{caption:'인프라 비교',cols:4,rows:[
          [{t:'구분',head:true,rowSpan:2},{t:'사양',head:true,colSpan:3}],
          [{t:'CPU',head:true},{t:'GPU',head:true},{t:'메모리',head:true}],
          [{t:'현행'},{t:'32c'},{t:'A100 x2'},{t:'256GB'}],
          [{t:'중첩 예시'},{t:'',colSpan:3,table:{cols:2,rows:[[{t:'내부1',head:true},{t:'내부2',head:true}],[{t:'값1'},{t:'값2'}]]}}]
        ]}}]}]},
   {no:'2',title:'기술 검토',body:'검토 본문.',
    table:{caption:'후보 비교',cols:3,rows:[[{t:'항목',head:true},{t:'A',head:true},{t:'B',head:true}],[{t:'비용'},{t:'중'},{t:'상'}]]},
    subs:[{no:'2.1',title:'모델',body:'모델 본문.',subs:[{no:'2.1.1',title:'SLM',body:'SLM 본문.'}]}]}
]});
globalThis.OUT = {
  docx: docx(data()),
  hwpxIncident: hwpxIncident(data(), 'ops'),
  pptx: pptx(),
  hwpxComplex: hwpxComplex(cdoc.data, 'executive'),
  features: countFeatures(cdoc.data)
};
`;

const CHECKS = String.raw`/* ---- 검증 ---- */
const flat = (blob) => { const b = []; (function w(x) { if (x instanceof Uint8Array) b.push(Buffer.from(x)); else if (x && x.parts) x.parts.forEach(w); })(blob); return Buffer.concat(b); };

// 생성된 파트를 LAST_PARTS 에서 직접 검사한다 (zip 바이트는 크기만 확인)
function parts(build) { build(); return { ...LAST_PARTS }; }

// 1) 각 포맷이 예상 파트를 모두 낸다
for (const [fmt, build] of [['docx', () => docx(data())], ['pptx', () => pptx()], ['hwpx', () => hwpxIncident(data(), 'ops')]]) {
  const p = parts(build);
  PACKAGE_PARTS[fmt].filter(n => !n.includes('..')).forEach(n => assert(p[n] !== undefined, \`$\{fmt}: $\{n} 누락\`));
  Object.entries(p).forEach(([n, c]) => { if (n !== 'mimetype') assert(/^<\?xml|^<!/.test(String(c).trim()), \`$\{fmt}/$\{n}: XML 선언 없음\`); });
  console.log('ok', fmt, Object.keys(p).length + ' parts');
}

// 2) HWPX: mimetype 이 첫 엔트리, 참조 ID 가 header 에 모두 존재
{
  const p = parts(() => hwpxComplex(cdoc.data, 'executive'));
  assert.strictEqual(Object.keys(p)[0], 'mimetype');
  assert.strictEqual(p['mimetype'], 'application/hwp+zip');
  const sec = p['Contents/section0.xml'], head = p['Contents/header.xml'];
  for (const [attr, tag] of [['charPrIDRef', 'charPr'], ['paraPrIDRef', 'paraPr'], ['borderFillIDRef', 'borderFill']]) {
    const used = new Set([...sec.matchAll(new RegExp(attr + '="(\d+)"', 'g'))].map(m => m[1]));
    const have = new Set([...head.matchAll(new RegExp(\`<hh:$\{tag} id="(\d+)"\`, 'g'))].map(m => m[1]));
    [...used].forEach(id => assert(have.has(id), \`header.xml 에 $\{tag} id=$\{id} 없음\`));
  }
  // 3) 셀 병합: rowSpan 으로 가려진 칸을 cellAddr 가 건너뛴다
  const first = sec.slice(sec.indexOf('<hp:tbl'));
  assert(/colAddr="1" rowAddr="1"/.test(first), 'rowSpan 아래 행의 cellAddr 가 0 에서 시작함 (병합 칸 미반영)');
  // 4) 표 안의 표
  assert(/<hp:subList[^>]*>\s*<hp:p[^>]*><hp:run[^>]*><hp:tbl/.test(sec), '중첩 표가 hp:subList 안에 없음');
  // 5) 목차 3단계
  [5, 6, 7].forEach(i => assert(sec.includes(\`paraPrIDRef="$\{i}"\`), \`목차 $\{i - 4}단계 문단 없음\`));
  console.log('ok hwpx 구조 (병합 · 중첩표 · 3단 목차)');
}

// 6) PPTX 슬라이드 수 = 제목 + 개요 + 동향수
{
  const n = deckSlides().length;
  assert.strictEqual(n, deck.trends.length + 2, 'PPTX 슬라이드 수 불일치');
  console.log('ok pptx 슬라이드', n);
}

const f = countFeatures(cdoc.data);
assert(f.merges > 0 && f.nested > 0, '병합/중첩표 없음');
console.log('ok 구조 통계', JSON.stringify(f));
console.log('');
console.log('ALL PASS');
`;

global.assert = require('assert');
// String.raw 가 남긴 이스케이프를 되돌린다
const checks = CHECKS.replace(/\\`/g, '`').replace(/\$\\\{/g, '${');
(0, eval)([...files.map(f => fs.readFileSync(dir + f, 'utf8')), test, checks].join('\n'));
