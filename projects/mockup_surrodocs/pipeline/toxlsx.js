/* ============================================================
 * pipeline/toxlsx.js — 2단계: doc.json → 엑셀(.xlsx)
 *
 * 추출 결과를 시트로 펼친다. 3단계(form.js)는 이 엑셀을 **다시 읽어서** 문서를 만든다.
 * 그래서 시트 모양이 곧 계약이다: 머리행 1줄 + 데이터 행, 묶음 키(역할·단계·주기)는 행마다 반복한다.
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { writeXlsx, S } = require('./xlsx');
const { FORM_MAP } = require('./fieldmap');

/* 모델마다 스키마를 조금씩 벗어난다(배열 자리에 문자열 등). doc.json 은 모델이 준 그대로 두고,
   여기서 형태만 맞춘다 — 그래야 이후 단계가 모델에 상관없이 똑같이 돈다. */
const arr = (v) => Array.isArray(v) ? v.filter(x => x != null).map(x => typeof x === 'string' ? x : (x && x.t) || String(x))
  : (v == null || v === '' ? [] : String(v).split('\n').map(x => x.trim()).filter(Boolean));
const str = (v) => v == null ? '' : (typeof v === 'string' ? v : String(v));
function normalize(d) {
  const o = { ...d };
  ['purpose', 'method', 'org_chart', 'intro', 'notes', 'approval_cols'].forEach(k => { o[k] = arr(o[k]); });
  o.title = str(o.title); o.badge = str(o.badge); o.section_label = str(o.section_label);
  o.meta = (Array.isArray(o.meta) ? o.meta : []).map(m => ({ label: str(m && m.label), value: str(m && m.value) }));
  o.roles = (Array.isArray(o.roles) ? o.roles : []).map(r => ({ role: str(r && r.role), duties: arr(r && r.duties) }));
  o.procedure = (Array.isArray(o.procedure) ? o.procedure : []).map(p => ({ step: str(p && p.step), details: arr(p && p.details) }));
  o.periodic = (Array.isArray(o.periodic) ? o.periodic : []).map(p => ({
    cycle: str(p && p.cycle), participants: arr(p && p.participants), heading: str(p && p.heading), details: arr(p && p.details) }));
  const rt = o.risk_table || {};
  o.risk_table = { cols: arr(rt.cols), rows: (Array.isArray(rt.rows) ? rt.rows : []).map(r => arr(r)) };
  const rec = o.records || {};
  o.records = { label: str(rec.label) || '기록 보존', items: arr(rec.items) };
  return o;
}

const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(__dirname, '..', 'out');
const head = (arr) => arr.map(v => ({ v, s: S.head }));
const label = (v) => ({ v, s: S.label });

function sheets(d) {
  const 문서정보 = {
    name: '문서정보', cols: [16, 26, 62],
    rows: [head(['구분', '항목', '값']),
      ['머리', '머리표지', d.badge],
      ['머리', '문서 제목', d.title],
      ['머리', '결재란 열', (d.approval_cols || []).join(' | ')],
      ...(d.meta || []).map(m => ['기본정보', m.label, m.value]),
      ...(d.purpose || []).map((v, i) => ['목적', `목적 ${i + 1}`, v]),
      ...(d.method || []).map((v, i) => ['방법', `방법 ${i + 1}`, v]),
      ['구역라벨', '2쪽 세로 라벨', d.section_label || ''],
      ...(d.intro || []).map((v, i) => ['상시평가 안내', `안내 ${i + 1}`, v])
    ].map(r => Array.isArray(r) && r[0] && r[0].s === undefined && typeof r[0] === 'string' ? [label(r[0]), r[1], r[2]] : r)
  };
  const 조직도 = { name: '조직도', cols: [8, 46], rows: [head(['순번', '상자 텍스트']), ...(d.org_chart || []).map((t, i) => [{ v: i + 1, s: S.center }, t])] };
  const 조직_역할 = { name: '조직_역할', cols: [22, 8, 70], rows: [head(['역할', '순번', '책임사항'])] };
  (d.roles || []).forEach(r => (r.duties || []).forEach((t, i) => 조직_역할.rows.push([label(r.role), { v: i + 1, s: S.center }, t])));
  const 평가절차 = { name: '평가절차', cols: [24, 8, 76], rows: [head(['단계', '순번', '세부 내용'])] };
  (d.procedure || []).forEach(p => (p.details || []).forEach((t, i) => 평가절차.rows.push([label(p.step), { v: i + 1, s: S.center }, t])));
  const 위험성수준 = { name: '위험성수준', cols: [14, 60, 16],
    rows: [head((d.risk_table || {}).cols || []), ...(((d.risk_table || {}).rows) || []).map(r => [{ v: r[0], s: S.center }, r[1], { v: r[2], s: S.center }])] };
  const 상시평가 = { name: '상시평가', cols: [18, 20, 34, 8, 76], rows: [head(['실시 주기', '참여자', '세부 내용 제목', '순번', '세부 내용'])] };
  (d.periodic || []).forEach(p => (p.details || []).forEach((t, i) =>
    상시평가.rows.push([label(p.cycle), (p.participants || []).join('\n'), p.heading, { v: i + 1, s: S.center }, t])));
  const 기록_비고 = { name: '기록_비고', cols: [18, 96],
    rows: [head(['구분', '내용']),
      ...(((d.records || {}).items) || []).map(t => [label((d.records.label || '기록 보존').replace(/\n/g, ' ')), t]),
      ...((d.notes) || []).map(t => [label('안내문'), t])] };
  const XML매핑 = { name: 'XML매핑', cols: [14, 34, 62, 62, 52],
    rows: [head(['엑셀 시트', '항목', 'DOCX XML 경로', 'HWPX XML 경로', '적용 서식']), ...FORM_MAP.rows.map(r => [label(r[0]), r[1], r[2], r[3], r[4]])] };

  return [문서정보, 조직도, 조직_역할, 평가절차, 위험성수준, 상시평가, 기록_비고, XML매핑];
}

const doc = normalize(JSON.parse(fs.readFileSync(path.join(OUT, 'doc.json'), 'utf8')));
const book = sheets(doc);
const file = path.join(OUT, '위험성평가_실시규정_파싱.xlsx');
fs.writeFileSync(file, writeXlsx(book));
console.log(`→ out/${path.basename(file)}  (${book.length}시트 / ${book.reduce((a, s) => a + s.rows.length - 1, 0)}행)`);
book.forEach(s => console.log(`   ${s.name.padEnd(12)} ${s.rows.length - 1}행`));
