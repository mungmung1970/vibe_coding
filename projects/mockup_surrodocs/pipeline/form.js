/* ============================================================
 * pipeline/form.js — 3·4단계: 엑셀 → (XML 매핑) → DOCX / HWPX
 *
 * 데이터 출처는 doc.json 이 아니라 **엑셀**이다. 2단계 산출물을 그대로 다시 읽어
 * fieldmap.js 의 경로대로 XML 을 만든다.
 *
 * 표 폭은 24칸 격자로 잡는다 — hwpx.js 의 hwpTable 이 열 폭을 균등 분할하므로,
 * 칸 수를 늘리고 colSpan 으로 비율을 만들면 공용 빌더를 고치지 않고 비대칭 표를 만들 수 있다.
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const { readXlsx } = require('./xlsx');

const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(__dirname, '..', 'out');
const G = 24;                     // 격자 칸 수
const PAGE_W = 11906, MARGIN = 1200;
const DXA = Math.floor((PAGE_W - MARGIN * 2) / G);   // DOCX 격자 1칸(twip)

/* ============================================================
 * 엑셀 → 모델
 * ============================================================ */
function readModel(file) {
  const book = {};
  readXlsx(fs.readFileSync(file)).forEach(s => { book[s.name] = s.rows.slice(1); });
  const info = book['문서정보'] || [];
  const pick = (구분, 항목) => (info.find(r => r[0] === 구분 && r[1] === 항목) || [])[2] || '';
  const all = (구분) => info.filter(r => r[0] === 구분).map(r => r[2]);

  // 묶음 키가 행마다 반복되므로 순서를 지키며 접는다
  const group = (rows, keyIdx, valIdx, extra) => {
    const out = [], seen = new Map();
    rows.forEach(r => {
      const k = r[keyIdx];
      if (!seen.has(k)) { const o = { key: k, items: [], extra: extra ? extra(r) : null }; seen.set(k, o); out.push(o); }
      seen.get(k).items.push(r[valIdx]);
    });
    return out;
  };

  return {
    badge: pick('머리', '머리표지'),
    title: pick('머리', '문서 제목'),
    approval_cols: pick('머리', '결재란 열').split(' | ').filter(Boolean),
    meta: info.filter(r => r[0] === '기본정보').map(r => ({ label: r[1], value: r[2] })),
    purpose: all('목적'), method: all('방법'),
    section_label: pick('구역라벨', '2쪽 세로 라벨'),
    intro: all('상시평가 안내'),
    org_chart: (book['조직도'] || []).map(r => r[1]),
    roles: group(book['조직_역할'] || [], 0, 2).map(g => ({ role: g.key, duties: g.items })),
    procedure: group(book['평가절차'] || [], 0, 2).map(g => ({ step: g.key, details: g.items })),
    risk: { cols: (book['위험성수준'] || []).length ? ['위험성 수준', '판단 기준', '허용 가능 여부'] : [], rows: book['위험성수준'] || [] },
    periodic: group(book['상시평가'] || [], 0, 4, r => ({ participants: (r[1] || '').split('\n'), heading: r[2] }))
      .map(g => ({ cycle: g.key, participants: g.extra.participants, heading: g.extra.heading, details: g.items })),
    records: { label: ((book['기록_비고'] || []).find(r => r[0] !== '안내문') || [])[0] || '기록 보존',
               items: (book['기록_비고'] || []).filter(r => r[0] !== '안내문').map(r => r[1]) },
    notes: (book['기록_비고'] || []).filter(r => r[0] === '안내문').map(r => r[1])
  };
}

/* ============================================================
 * 표 정의 — 두 포맷이 같은 표 모델을 쓴다
 *   cell = { t, w(격자칸), rowSpan, head(진한 머리), soft(연한 라벨), lines[], table }
 * ============================================================ */
// 격자 칸을 n개로 나눈다. 나머지는 마지막 칸이 흡수해야 행마다 합이 정확히 맞는다.
const spread = (total, n) => { const base = Math.floor(total / n); return Array.from({ length: n }, (_, i) => i === n - 1 ? total - base * (n - 1) : base); };

function tables(m) {
  const T = {};
  T.head = { cols: G, rows: [[{ t: m.badge, w: 3, head: true }, { t: m.title, w: G - 3, title: true }]] };

  const cols = m.approval_cols.length ? m.approval_cols : ['담당자', '검토자', '근로자대표', '승인자'];
  const avW = spread(G - 12, cols.length);
  T.meta = { cols: G, rows: [
    [{ t: m.meta[0] ? m.meta[0].label : '', w: 4, soft: true }, { t: m.meta[0] ? m.meta[0].value : '', w: 8 },
      ...cols.map((c, i) => ({ t: c, w: avW[i], soft: true }))],
    [{ t: m.meta[1] ? m.meta[1].label : '', w: 4, soft: true }, { t: m.meta[1] ? m.meta[1].value : '', w: 8 },
      ...cols.map((_, i) => ({ t: '', w: avW[i] }))]
  ] };

  T.purpose = { cols: G, rows: [[
    { t: '목적', w: 3, soft: true }, { lines: m.purpose, w: 9 },
    { t: '방법', w: 3, soft: true }, { lines: m.method, w: 9 }]] };

  const chart = { cols: 1, rows: m.org_chart.map(t => [{ t, w: 1, soft: true }]) };
  T.roles = { cols: G, rows: m.roles.map((r, i) => {
    const row = [];
    if (i === 0) row.push({ t: '조직 및\n역할', w: 2, soft: true, rowSpan: m.roles.length },
                           { table: chart, w: 9, rowSpan: m.roles.length });
    row.push({ t: r.role, w: 4, soft: true }, { lines: r.duties, w: 9 });
    return row;
  }) };

  // 빈 칸이 이어지면 위 칸과 세로 병합한다(원본의 '허용 불가능' 칸)
  const RW = (m.risk.cols.length === 3 || !m.risk.cols.length) ? [2, 8, 3] : spread(13, m.risk.cols.length);
  const riskBody = [];
  const openCell = [];
  m.risk.rows.forEach((r, ri) => {
    const row = [];
    r.forEach((c, i) => {
      if (c === '' && openCell[i]) { openCell[i].rowSpan = (openCell[i].rowSpan || 1) + 1; return; }
      const cell = { t: c, w: RW[i] || 1 };
      openCell[i] = cell; row.push(cell);
    });
    riskBody.push(row);
  });
  const risk = { cols: RW.reduce((a, b) => a + b, 0), rows: [m.risk.cols.map((c, i) => ({ t: c, w: RW[i] || 1, head: true }))].concat(riskBody) };
  T.procedure = { cols: G, rows: m.procedure.map((p, i) => {
    const row = [];
    if (i === 0) row.push({ t: '평가 절차\n및 방법', w: 2, soft: true, rowSpan: m.procedure.length });
    row.push({ t: p.step, w: 5, head: true });
    // ③ 위험성 결정 칸에는 3단계 판단 기준표를 셀 안의 표로 넣는다
    row.push(p.step.includes('위험성 결정') ? { lines: p.details, w: 17, table: risk } : { lines: p.details, w: 17 });
    return row;
  }) };

  const rows = [];
  rows.push([{ t: (m.section_label || '상시평가\n시기별\n활동'), w: 2, soft: true, rowSpan: m.periodic.length + 2 },
             { lines: m.intro, w: G - 2 }]);
  rows.push([{ t: '실시 주기', w: 3, head: true }, { t: '참여자', w: 4, head: true }, { t: '세부 내용', w: 15, head: true }]);
  m.periodic.forEach(p => rows.push([
    { t: p.cycle, w: 3 }, { lines: p.participants.map(x => '• ' + x), w: 4 },
    { heading: p.heading, lines: p.details, w: 15 }]));
  T.periodic = { cols: G, rows };

  T.records = { cols: G, rows: [[{ t: m.records.label.replace(/\n/g, ' '), w: 2, soft: true }, { lines: m.records.items.map(x => '• ' + x.replace(/^•\s*/, '')), w: G - 2 }]] };
  return T;
}

/* ============================================================
 * HWPX — hwpx.js 의 빌더를 그대로 쓴다
 * ============================================================ */
function toHwpCells(row) {
  return row.map(c => {
    const cell = { colSpan: c.w, rowSpan: c.rowSpan || 1, head: !!(c.head || c.title), soft: !!c.soft };
    if (c.table) {
      cell.table = { cols: c.table.cols, rows: c.table.rows.map(toHwpCells) };
      if (c.lines) cell.t = c.lines.join('\n');       // 표 앞에 본문이 있는 칸
    } else {
      cell.t = c.lines ? c.lines.join('\n') : (c.heading ? c.heading + '\n' + (c.lines || []).join('\n') : c.t);
      if (c.heading) cell.t = [c.heading].concat(c.lines || []).join('\n');
    }
    return cell;
  });
}
function hwpxForm(m, tplKey) {
  const T = tables(m), tpl = H.DOC_TEMPLATES[tplKey];
  H.resetHwpIds();
  const tbl = (t) => H.hpTable(t.rows.map(toHwpCells), t.cols);
  const paras = tbl(T.head) + tbl(T.meta) + tbl(T.purpose) + tbl(T.roles) + tbl(T.procedure) +
    tbl(T.periodic) + tbl(T.records) +
    m.notes.map(n => H.hp(n, H.HWP_PARA.body, H.HWP_CHAR.small)).join('');
  return H.bytes(H.hwpxPackage(m.title, H.hwpHeader(tpl), H.hwpSection(paras)));
}

/* ============================================================
 * DOCX — 세로 병합(w:vMerge)·가로 병합(w:gridSpan)·셀 안의 표를 직접 만든다
 * ============================================================ */
const xe = H.xe;
const wp = (text, opt = {}) => `<w:p><w:pPr>${opt.align ? `<w:jc w:val="${opt.align}"/>` : ''}` +
  `<w:spacing w:before="20" w:after="20" w:line="264" w:lineRule="auto"/></w:pPr>` +
  (text === '' ? '' : `<w:r><w:rPr><w:rFonts w:ascii="맑은 고딕" w:hAnsi="맑은 고딕" w:eastAsia="맑은 고딕"/>` +
    `<w:sz w:val="${opt.sz || 18}"/>${opt.b ? '<w:b/>' : ''}${opt.color ? `<w:color w:val="${opt.color}"/>` : ''}</w:rPr>` +
    `<w:t xml:space="preserve">${xe(text)}</w:t></w:r>`) + '</w:p>';

function cellParas(c, tpl, cellWidth) {
  const opt = c.head ? { b: true, color: 'FFFFFF', align: 'center' }
            : c.title ? { b: true, sz: 28, color: tpl.accent }
            : c.soft ? { b: true, align: 'center' } : {};
  let out = '';
  if (c.heading) out += wp(c.heading, { b: true, color: tpl.accent });
  const lines = c.lines || String(c.t == null ? '' : c.t).split('\n');
  out += lines.map(l => wp(l, opt)).join('') || wp('', opt);
  if (c.table) out += docxTable(c.table, tpl, { nested: true, width: cellWidth - 200 });
  return out || wp('');
}
function docxTable(t, tpl, opt = {}) {
  const nested = !!opt.nested;
  const total = opt.width || (PAGE_W - MARGIN * 2);
  const unit = Math.max(120, Math.floor(total / t.cols));
  const grid = Array.from({ length: t.cols }, () => `<w:gridCol w:w="${unit}"/>`).join('');
  const taken = new Set();
  const trs = t.rows.map((row, r) => {
    let at = 0, cells = '';
    // 위 행에서 세로 병합으로 내려온 칸을 먼저 채운다
    const emitContinuation = () => {
      while (taken.has(r + ',' + at)) {
        const info = CONT.get(r + ',' + at);
        cells += `<w:tc><w:tcPr><w:tcW w:w="${unit * info.w}" w:type="dxa"/>` +
          (info.w > 1 ? `<w:gridSpan w:val="${info.w}"/>` : '') +
          `<w:vMerge/>${info.fill ? `<w:shd w:val="clear" w:fill="${info.fill}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${wp('')}</w:tc>`;
        at += info.w;
      }
    };
    emitContinuation();
    row.forEach(c => {
      const w = c.w || 1, rs = c.rowSpan || 1;
      const fill = c.head || c.title && false ? tpl.head : (c.soft ? tpl.soft : '');
      for (let dr = 1; dr < rs; dr++) { taken.add((r + dr) + ',' + at); CONT.set((r + dr) + ',' + at, { w, fill }); }
      cells += `<w:tc><w:tcPr><w:tcW w:w="${unit * w}" w:type="dxa"/>` +
        (w > 1 ? `<w:gridSpan w:val="${w}"/>` : '') +
        (rs > 1 ? '<w:vMerge w:val="restart"/>' : '') +
        (fill ? `<w:shd w:val="clear" w:fill="${fill}"/>` : '') +
        '<w:vAlign w:val="center"/></w:tcPr>' + cellParas(c, tpl, unit * w) + '</w:tc>';
      at += w;
      emitContinuation();
    });
    return `<w:tr>${cells}</w:tr>`;
  }).join('');
  const border = (tag) => `<w:${tag} w:val="single" w:sz="4" w:space="0" w:color="C4CBD3"/>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${nested ? unit * t.cols : 5000}" w:type="${nested ? 'dxa' : 'pct'}"/>` +
    `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders>` +
    '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar>' +
    `<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${trs}</w:tbl>` + (nested ? wp('') : wp(''));
}
let CONT = new Map();

function docxForm(m, tplKey) {
  const T = tables(m), tpl = H.DOC_TEMPLATES[tplKey];
  CONT = new Map();
  const body = [T.head, T.meta, T.purpose, T.roles, T.procedure, T.periodic, T.records]
    .map(t => { CONT = new Map(); return docxTable(t, tpl, {}); }).join('') +
    m.notes.map(n => wp(n, { sz: 16, color: '777777' })).join('');
  const document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body +
    `<w:sectPr><w:pgSz w:w="${PAGE_W}" w:h="16838"/><w:pgMar w:top="900" w:right="${MARGIN}" w:bottom="900" w:left="${MARGIN}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>` +
    '</w:body></w:document>';
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="맑은 고딕" w:hAnsi="맑은 고딕" w:eastAsia="맑은 고딕"/><w:sz w:val="18"/></w:rPr></w:rPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/></w:style></w:styles>';
  return H.bytes(H.zip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'word/document.xml': document, 'word/styles.xml': styles
  }));
}

module.exports = { readModel, tables, hwpxForm, docxForm };

if (require.main === module) {
  const tplKey = process.env.TEMPLATE || 'executive';
  const xlsx = path.join(OUT, '위험성평가_실시규정_파싱.xlsx');
  const m = readModel(xlsx);
  fs.writeFileSync(path.join(OUT, '위험성평가_실시규정.docx'), docxForm(m, tplKey));
  fs.writeFileSync(path.join(OUT, '위험성평가_실시규정.hwpx'), hwpxForm(m, tplKey));
  console.log(`엑셀 → 문서: 역할 ${m.roles.length} · 절차 ${m.procedure.length} · 주기 ${m.periodic.length} · 안내문 ${m.notes.length}`);
  ['docx', 'hwpx'].forEach(ext => console.log(`→ ${path.relative(path.join(__dirname, '..'), path.join(OUT, '위험성평가_실시규정.' + ext))}`));
}
