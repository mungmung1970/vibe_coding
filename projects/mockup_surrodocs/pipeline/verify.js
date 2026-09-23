/* ============================================================
 * pipeline/verify.js — 산출물 구조 검증 (selfcheck.js 와 같은 성격)
 *
 * 열어보지 않고도 깨진 문서를 잡아낸다:
 *  1) 세 포맷의 필수 파트 존재    2) 모든 XML 파트의 적격성(well-formed)
 *  3) HWPX: mimetype 첫 엔트리·무압축, 참조 ID 가 header.xml 에 실재
 *  4) DOCX: 행마다 격자 칸 합이 같은지(gridSpan·vMerge 계산 오류 검출)
 *  5) 엑셀 → 모델 왕복이 원문 항목 수와 맞는지
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');
const { unzip, readXlsx } = require('./xlsx');
const { readModel } = require('./form');

const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(__dirname, '..', 'out');
const f = (n) => path.join(OUT, n);
let ok = 0;
const pass = (m) => { ok++; console.log('ok', m); };

/* 1·2) 파트 구성과 XML 적격성 */
const EXPECT = {
  'word/document.xml': ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels'],
  'Contents/section0.xml': ['mimetype', 'version.xml', 'META-INF/container.xml', 'META-INF/manifest.xml', 'Contents/content.hpf', 'Contents/header.xml', 'Contents/section0.xml'],
  'xl/workbook.xml': ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']
};
function xmlWellFormed(name, buf) {
  // 노드에는 XML 파서가 없다. 표준 라이브러리만 있는 파이썬으로 적격성만 확인한다.
  const tmp = path.join(require('os').tmpdir(), 'verify-part.xml');
  fs.writeFileSync(tmp, buf);
  execFileSync('python3', ['-c', 'import sys,xml.etree.ElementTree as E;E.parse(sys.argv[1])', tmp]);
}
for (const [marker, expect] of Object.entries(EXPECT)) {
  const file = marker.startsWith('word') ? '위험성평가_실시규정.docx'
             : marker.startsWith('Contents') ? '위험성평가_실시규정.hwpx' : '위험성평가_실시규정_파싱.xlsx';
  const zipped = unzip(fs.readFileSync(f(file)));
  expect.forEach(n => assert(zipped[n] !== undefined, `${file}: ${n} 누락`));
  Object.entries(zipped).forEach(([n, b]) => { if (n.endsWith('.xml') || n.endsWith('.rels') || n.endsWith('.hpf')) xmlWellFormed(n, b); });
  pass(`${file} — 파트 ${Object.keys(zipped).length}개, XML 적격`);
}

const SRC = JSON.parse(fs.readFileSync(f('doc.json'), 'utf8'));
const has = (k) => Array.isArray(SRC[k]) ? SRC[k].length > 0 : !!SRC[k];
const hasRisk = !!(SRC.risk_table && (SRC.risk_table.rows || []).length);

/* 3) HWPX 참조 무결성 */
{
  const z = unzip(fs.readFileSync(f('위험성평가_실시규정.hwpx')));
  const raw = fs.readFileSync(f('위험성평가_실시규정.hwpx'));
  assert.strictEqual(raw.slice(30, 38).toString(), 'mimetype', 'mimetype 이 첫 엔트리가 아님');
  assert.strictEqual(raw.readUInt16LE(8), 0, 'mimetype 이 압축되어 있음');
  assert.strictEqual(z['mimetype'].toString(), 'application/hwp+zip');
  const sec = z['Contents/section0.xml'].toString('utf8'), head = z['Contents/header.xml'].toString('utf8');
  for (const [attr, tag] of [['charPrIDRef', 'charPr'], ['paraPrIDRef', 'paraPr'], ['borderFillIDRef', 'borderFill']]) {
    const used = new Set([...sec.matchAll(new RegExp(attr + '="(\\d+)"', 'g'))].map(m => m[1]));
    const have = new Set([...head.matchAll(new RegExp(`<hh:${tag} id="(\\d+)"`, 'g'))].map(m => m[1]));
    [...used].forEach(id => assert(have.has(id), `header.xml 에 ${tag} id=${id} 없음`));
  }
  // 아래 두 가지는 판독 결과에 그 내용이 있을 때만 성립한다(모델이 놓치면 문서에도 없다)
  if (has('org_chart') || hasRisk)
    assert(/<hp:subList[^>]*>\s*<hp:p[^>]*><hp:run[^>]*><hp:tbl/.test(sec), '셀 안의 표(조직도·위험성수준)가 없음');
  const spans = [...sec.matchAll(/rowSpan="(\d+)"/g)].map(m => +m[1]).filter(v => v > 1);
  if (has('roles') || has('procedure')) assert(spans.length >= 3, `세로 병합이 ${spans.length}개뿐`);
  assert(sec.includes('<hp:secPr'), 'secPr 없음');
  pass(`hwpx — ID 참조 무결 · 세로 병합 ${spans.length}곳 · 중첩표 존재`);
}

/* 4) DOCX 격자 합 */
{
  const doc = unzip(fs.readFileSync(f('위험성평가_실시규정.docx')))['word/document.xml'].toString('utf8');
  // <w:tbl> 은 중첩되므로 깊이를 세어 가장 바깥 표만 잘라낸다
  function topLevelTables(xml) {
    const out = [];
    const re = /<w:tbl>|<\/w:tbl>/g;
    let depth = 0, start = 0, m;
    while ((m = re.exec(xml))) {
      if (m[0] === '<w:tbl>') { if (depth === 0) start = m.index + m[0].length; depth++; }
      else { depth--; if (depth === 0) out.push(xml.slice(start, m.index)); }
    }
    return out;
  }
  const tbls = topLevelTables(doc);
  let checked = 0;
  tbls.forEach((t, ti) => {
    const grid = (t.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/) || [''])[0];
    const cols = [...grid.matchAll(/<w:gridCol /g)].length;
    const body = t.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, '');   // 중첩표 제거
    [...body.matchAll(/<w:tr>([\s\S]*?)<\/w:tr>/g)].forEach((tr, ri) => {
      const sum = [...tr[1].matchAll(/<w:tc>([\s\S]*?)(?=<w:tc>|$)/g)]
        .reduce((a, c) => a + (+((c[1].match(/<w:gridSpan w:val="(\d+)"/) || [])[1]) || 1), 0);
      assert.strictEqual(sum, cols, `DOCX 표 ${ti + 1} ${ri + 1}행: 칸 합 ${sum} ≠ 격자 ${cols}`);
      checked++;
    });
  });
  const vm = [...doc.matchAll(/<w:vMerge/g)].length;
  if (has('roles') || has('procedure')) assert(vm >= 6, `세로 병합이 ${vm}개뿐`);
  pass(`docx — 표 ${tbls.length}개 / ${checked}행 격자 합 일치 · vMerge ${vm}곳`);
}

/* 5) 엑셀 왕복 */
{
  const src = SRC;
  const m = readModel(f('위험성평가_실시규정_파싱.xlsx'));
  assert.strictEqual(m.roles.length, src.roles.length, '역할 수 불일치');
  assert.strictEqual(m.procedure.length, src.procedure.length, '절차 단계 수 불일치');
  assert.strictEqual(m.periodic.length, src.periodic.length, '상시평가 주기 수 불일치');
  assert.strictEqual(m.title, src.title, '제목 불일치');
  const duties = m.roles.reduce((a, r) => a + r.duties.length, 0);
  assert.strictEqual(duties, src.roles.reduce((a, r) => a + r.duties.length, 0), '책임사항 수 불일치');
  const sheets = readXlsx(fs.readFileSync(f('위험성평가_실시규정_파싱.xlsx')));
  assert(sheets.find(s => s.name === 'XML매핑').rows.length > 1, 'XML매핑 시트가 비었음');
  pass(`엑셀 왕복 — 역할 ${m.roles.length} · 책임사항 ${duties} · 절차 ${m.procedure.length} · 주기 ${m.periodic.length}`);
}

/* 6) 판독 충실도 — 검사가 아니라 보고다. 모델별 비교용 */
{
  const want = { meta: 2, purpose: 1, method: 1, org_chart: 10, roles: 5, procedure: 6, periodic: 3, intro: 3, notes: 2 };
  const got = Object.entries(want).map(([k, n]) => {
    const c = Array.isArray(SRC[k]) ? SRC[k].length : 0;
    return `${k} ${c}/${n}${c < n ? ' ←' : ''}`;
  });
  const riskRows = (SRC.risk_table && (SRC.risk_table.rows || []).length) || 0;
  console.log(`\n판독 충실도 (원본 기준)\n  ${got.join(' · ')} · risk_table ${riskRows}/3${riskRows < 3 ? ' ←' : ''}`);
}

console.log(`\nALL PASS (${ok}개 검사)`);
