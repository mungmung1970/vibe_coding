/* ============================================================
 * formats.js — 문서 필드 ↔ XML 태그 ↔ 서식 매핑의 단일 출처
 *
 * 빌더(app.js=DOCX / trend.js=PPTX / hwpx.js=HWPX)는 여기의 템플릿 값을 읽어 쓴다.
 * 화면의 "XML 구조 보기"도 이 표를 그대로 렌더링한다.
 * {accent} {head} {bg} {side} {ink} 는 선택된 템플릿 값으로 치환된다.
 * ============================================================ */

/* ---------- 1. 템플릿 정의 ---------- */
// 장애보고서 · 복합문서 공용 (DOCX / HWPX)
const DOC_TEMPLATES = {
  executive: { name: 'Executive Blue', accent: '285BDF', head: '285BDF', kicker: 'INCIDENT REPORT · EXECUTIVE', font: '맑은 고딕', soft: 'F4F6F9' },
  ops:       { name: 'Operations Red', accent: 'C13C48', head: 'C13C48', kicker: '장애보고서 · OPERATIONS LOG', font: '맑은 고딕', soft: 'FBF3F4' }
};
// 기술동향 (PPTX)
const PPT_TEMPLATES = {
  aurora: { name: 'Aurora Navy', bg: '0F1B36', accent: '3E7BD6', side: 'F2F6FD', sideLine: 'C9D9F4', ink: '16233A', sub: 'C9D4E8' },
  solar:  { name: 'Solar Amber', bg: '3A2008', accent: 'D9862A', side: 'FDF6EC', sideLine: 'F0D6AE', ink: '2E2214', sub: 'E8D2B4' }
};

/* ---------- 2. 단위 ---------- */
const UNITS = {
  docx: '글자 w:sz = half-point (32 → 16pt) · 길이 = twip (1440 = 1inch) · 색 = w:color/w:shd @w:fill (RRGGBB)',
  pptx: '글자 sz = 1/100 pt (1200 → 12pt) · 길이 = EMU (914400 = 1inch) · 색 = a:srgbClr @val',
  hwpx: '글자 height = 1/100 pt · 길이 = HWPUNIT (7200 = 1inch) · 색 = #RRGGBB · 참조는 header.xml 의 ID 만 사용'
};

/* ---------- 3. 패키지 파트 ---------- */
const PACKAGE_PARTS = {
  docx: ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels'],
  pptx: ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels', 'ppt/theme/theme1.xml', 'ppt/slideMasters/slideMaster1.xml', 'ppt/slideLayouts/slideLayout1.xml', 'ppt/slides/slide1..N.xml'],
  hwpx: ['mimetype', 'version.xml', 'META-INF/container.xml', 'META-INF/manifest.xml', 'Contents/content.hpf', 'Contents/header.xml', 'Contents/section0.xml']
};

/* ---------- 4. 필드 → XML 태그 → 서식 ---------- */
// rows: [화면 항목, XML 경로, 적용 서식]
const FIELD_MAP = {
  incident: {
    docx: {
      part: 'word/document.xml',
      rows: [
        ['템플릿 머리말', 'w:body > w:p > w:pPr/w:pStyle[@w:val="Title"] > w:r/w:t', 'styles.xml Title: w:sz 18(9pt), w:b, w:color {accent}'],
        ['보고서 제목',   'w:body > w:p > w:pPr/w:pStyle[@w:val="Heading1"] > w:r/w:t', 'styles.xml Heading1: w:sz 32(16pt), w:b'],
        ['발생일자·작성자·등급', 'w:body > w:p[Normal] > w:r/w:t (한 줄로 결합)', 'Normal: w:sz 20(10pt), w:rFonts @w:eastAsia="맑은 고딕"'],
        ['장애 내용',     'w:body > w:p[Heading2] + w:p[Normal] > w:r/w:t', 'Heading2: w:b, w:color {accent}, w:spacing before 240'],
        ['시간대별 현상', 'w:tbl > w:tr > w:tc > w:p > w:r/w:t', '머리행 w:tcPr/w:shd @w:fill="{head}" · 본문행 w:gridSpan 2 (셀 병합)'],
        ['조치 결과',     'w:body > w:p[Heading2] + w:p[Normal] > w:r/w:t', 'Heading2 + Normal'],
        ['용지',          'w:body > w:sectPr > w:pgSz / w:pgMar', 'A4 11906×16838 twip · 여백 상하 1100 좌우 1200']
      ]
    },
    hwpx: {
      part: 'Contents/section0.xml (+ Contents/header.xml 의 refList)',
      rows: [
        ['템플릿 머리말', 'hs:sec > hp:p[@paraPrIDRef=0] > hp:run[@charPrIDRef=7]/hp:t', 'charPr 7: height 900(9pt), bold, textColor #{accent}'],
        ['보고서 제목',   'hs:sec > hp:p[@paraPrIDRef=1] > hp:run[@charPrIDRef=1]/hp:t', 'paraPr 1: align CENTER · charPr 1: height 2000(20pt), bold, #{accent}'],
        ['발생일자/등급/작성자', 'hp:tbl > hp:tr > hp:tc > hp:subList > hp:p/hp:run/hp:t', '4열 표 · 작성자 행은 hp:cellSpan @colSpan="3" 병합'],
        ['장애 내용',     'hp:p[@paraPrIDRef=2] (제목) + hp:p[@paraPrIDRef=0] (본문)', 'charPr 2: 1500(15pt) bold #{accent} · 본문 charPr 0: 1000(10pt)'],
        ['시간대별 현상', 'hp:tbl > hp:tr > hp:tc[@borderFillIDRef=3] > hp:subList/…', '머리셀 borderFill 3 = winBrush @faceColor="#{head}" · 본문 colSpan 2'],
        ['조치 결과',     'hp:p[@paraPrIDRef=2] + hp:p[@paraPrIDRef=0]', '동일'],
        ['용지',          'hp:p > hp:run > hp:secPr > hp:pagePr / hp:margin', 'A4 59528×84188 HWPUNIT · 좌우 8504, 상 5668, 하 4252']
      ]
    }
  },

  trend: {
    pptx: {
      part: 'ppt/slides/slideN.xml',
      rows: [
        ['문서 제목',   'slide1 > p:sp[id=3] > p:txBody/a:p/a:r/a:t', 'sz 4000(40pt), b=1, a:srgbClr FFFFFF · 배경 p:bg {bg}'],
        ['주제·작성자', 'slide1 > p:sp[id=5] > p:txBody/a:p/a:r/a:t', 'sz 1200(12pt), 색 {sub}'],
        ['개요 본문',   'slide2 > p:sp[id=4] > p:txBody/a:p/a:r/a:t', 'sz 1400(14pt), 색 {ink} · 줄간 a:lnSpc 135%'],
        ['동향 제목',   'slideN > p:sp[id=3] (상단 바 p:sp[id=2] 위)', 'sz 2000(20pt) b=1 FFFFFF · 바 채움 {bg}, 높이 1050000 EMU'],
        ['이미지 설명', 'slideN > p:sp[id=5] · 자리 도형 p:sp[id=4]', 'sz 1100 색 73808F · 자리 도형 채움 EDF1F5, a:ln {sideLine}'],
        ['본문',        'slideN > p:sp[id=6] > p:txBody/a:p/a:r/a:t', 'sz 1200(12pt) 색 {ink} · 좌측 x=640000 w=6100000 EMU'],
        ['체크포인트',  'slideN > p:sp[id=9] > a:p/a:pPr/a:buChar + a:r/a:t', 'sz 1100 불릿 • · marL 216000 indent -216000'],
        ['적용방안',    'slideN > p:sp[id=11] > a:p/a:pPr/a:buChar + a:r/a:t', '동일 · 우측 패널 p:sp[id=7] 채움 {side}'],
        ['슬라이드 크기', 'ppt/presentation.xml > p:sldSz', '12192000×6858000 EMU (16:9)']
      ]
    }
  },

  complex: {
    hwpx: {
      part: 'Contents/section0.xml',
      rows: [
        ['문서 제목',     'hp:p[@paraPrIDRef=1] > hp:run[@charPrIDRef=1]/hp:t', 'CENTER · 2000(20pt) bold #{accent}'],
        ['목차 1단계',    'hp:p[@paraPrIDRef=5] > hp:run[@charPrIDRef=3]/hp:t', 'hh:margin/hc:left = 0'],
        ['목차 2단계',    'hp:p[@paraPrIDRef=6] > hp:run[@charPrIDRef=0]/hp:t', 'hc:left = 900 HWPUNIT 들여쓰기'],
        ['목차 3단계',    'hp:p[@paraPrIDRef=7] > hp:run[@charPrIDRef=6]/hp:t', 'hc:left = 1800 HWPUNIT · 900(9pt) 회색'],
        ['본문 1/2/3단계', 'hp:p[@paraPrIDRef=2 / 3 / 4]', 'charPr 2(15pt #{accent}) / 3(12pt) / 4(11pt) · 들여쓰기 0 / 600 / 1200'],
        ['표',            'hp:p > hp:run > hp:tbl > hp:tr > hp:tc', 'hp:pos @treatAsChar="1" · hp:sz @width 42520'],
        ['셀 병합',       'hp:tc > hp:cellSpan @colSpan / @rowSpan', 'hp:cellAddr 는 병합된 칸을 건너뛴 실제 좌표'],
        ['표 안의 표',    'hp:tc > hp:subList > hp:p > hp:run > hp:tbl (재귀)', '안쪽 표 폭 = 바깥 셀 폭 − 1200 HWPUNIT'],
        ['머리 셀 음영',  'hp:tc @borderFillIDRef="3"', 'header.xml borderFill 3 > hc:fillBrush/hc:winBrush @faceColor="#{head}"']
      ]
    }
  }
};

/* ---------- 5. 화면 렌더링 ---------- */
function fillTpl(s, tpl) { return String(s).replace(/\{(\w+)\}/g, (m, k) => tpl[k] !== undefined ? tpl[k] : m); }

function renderMapping(kind, fmt, tpl) {
  const spec = FIELD_MAP[kind][fmt];
  return `<p class="map-meta"><b>${fmt.toUpperCase()}</b> · 템플릿 <b>${tpl.name}</b> · 주 파트 <code>${spec.part}</code></p>` +
    `<p class="map-unit">${UNITS[fmt]}</p>` +
    '<table class="map-table"><thead><tr><th>화면 항목</th><th>XML 태그 경로</th><th>적용 서식</th></tr></thead><tbody>' +
    spec.rows.map(r => `<tr><td>${esc(r[0])}</td><td><code>${esc(fillTpl(r[1], tpl))}</code></td><td>${esc(fillTpl(r[2], tpl))}</td></tr>`).join('') +
    '</tbody></table>' +
    `<p class="map-parts"><b>패키지 파트</b><br>${PACKAGE_PARTS[fmt].map(p => `<code>${esc(p)}</code>`).join(' ')}</p>`;
}

/* ---------- 6. 생성된 XML 파트 내려받기 ----------
 * 모든 포맷이 app.js 의 zip() 을 거치므로, 직전 생성물의 파트가 LAST_PARTS 에 남는다.
 * build() 를 한 번 돌린 뒤 파트를 사람이 읽을 수 있게 합쳐 저장한다. */
function downloadXmlParts(build, name) {
  build();
  const text = Object.entries(LAST_PARTS)
    .filter(([n]) => n.endsWith('.xml') || n.endsWith('.rels') || n.endsWith('.hpf'))
    .map(([n, c]) => `<!-- ======== ${n} ======== -->\n${prettyXml(String(c))}`)
    .join('\n\n');
  download(new Blob([text], { type: 'application/xml' }), name);
}
// 한 줄짜리 XML 을 태그 단위로 들여쓰기 (읽기용, 파서에 다시 넣을 용도는 아님)
function prettyXml(x) {
  let d = 0;
  return x.replace(/>\s*</g, '>\n<').split('\n').map(l => {
    if (/^<\/.+/.test(l)) d--;
    const out = '  '.repeat(Math.max(0, d)) + l;
    if (/^<[^!?/][^>]*[^/]>$/.test(l) && !/^<\w+[^>]*\/>/.test(l)) d++;
    return out;
  }).join('\n');
}
