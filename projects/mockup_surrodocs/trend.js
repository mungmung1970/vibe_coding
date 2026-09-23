/* 최신 기술동향 문서: gpt-oss-120b 질의 → PPTX(OOXML) 생성 */

const deck = { template: 'aurora', trends: [] };
$('pptTemplateList').addEventListener('click', e => {
  const c = e.target.closest('.template-card'); if (!c) return;
  deck.template = c.dataset.ppt;
  document.querySelectorAll('#pptTemplateList .template-card').forEach(x => x.classList.toggle('selected', x === c));
});

/* ---------- LLM 질의: 슬라이드 XML 자리에 1:1로 꽂히는 필드만 받는다 ---------- */
const SLIDE_SCHEMA = `{
  "overview": "1.최신기술동향 개요 슬라이드 본문 (3~5문장)",
  "trends": [{
    "title": "슬라이드 상단 제목",
    "body": "왼쪽 본문 (3~4문장)",
    "visual": "왼쪽 이미지 영역에 들어갈 도식/그래프 설명 한 줄",
    "checkpoints": ["오른쪽 체크포인트 3~4개"],
    "apply": ["오른쪽 적용방안 2~3개"]
  }]
}`;
async function askTrends(topic, n) {
  const user = `주제: "${topic}"
최신 기술동향 ${n}건을 조사해 아래 JSON 스키마로만 답하라. 각 필드는 PPTX 슬라이드 XML의 <a:t> 텍스트로 그대로 들어가므로 마크다운 기호나 번호 접두사 없이 순수 문장만 쓴다. trends 는 정확히 ${n}개.

${SLIDE_SCHEMA}`;
  const parsed = await llmJSON('You produce content for PowerPoint slides.', user, 4096);
  parsed.trends = (parsed.trends || []).map(t => ({
    title: t.title || '', body: t.body || '', visual: t.visual || '',
    checkpoints: [].concat(t.checkpoints || []), apply: [].concat(t.apply || [])
  }));
  if (!parsed.trends.length) throw new Error('trends 가 비어 있습니다');
  return parsed;
}

function renderTrends() {
  $('trendEditor').innerHTML = deck.trends.map((t, i) => `<div class="trend-card"><p class="tnum">TREND ${String(i + 2).padStart(2, '0')}</p>
    <label>동향 제목<input value="${esc(t.title)}" data-t="${i}" data-f="title"></label>
    <label>본문 내용<textarea data-t="${i}" data-f="body">${esc(t.body)}</textarea></label>
    <label>이미지 / 도식 설명<input value="${esc(t.visual)}" data-t="${i}" data-f="visual"></label>
    <div class="cols"><label>체크포인트 (줄바꿈 구분)<textarea data-t="${i}" data-f="checkpoints">${esc(t.checkpoints.join('\n'))}</textarea></label>
    <label>적용방안 (줄바꿈 구분)<textarea data-t="${i}" data-f="apply">${esc(t.apply.join('\n'))}</textarea></label></div></div>`).join('');
  $('slideCount').textContent = (deck.trends.length ? deck.trends.length + 2 : 0) + '장';
}
$('trendEditor').addEventListener('input', e => {
  const { t, f } = e.target.dataset; if (t === undefined) return;
  deck.trends[+t][f] = (f === 'checkpoints' || f === 'apply') ? e.target.value.split('\n').filter(Boolean) : e.target.value;
});
$('askLLM').onclick = () => runLLM('askLLM', 'llmBadge', async () => {
  const r = await askTrends($('tTopic').value, +$('tCount').value);
  $('tOverview').value = r.overview || ''; deck.trends = r.trends; renderTrends();
});

/* ---------- PPTX (OOXML) 빌더 ---------- */
const SLD = { w: 12192000, h: 6858000 };

function tx(lines, sz, color, bold, bullet) {
  return '<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>' +
    (lines.length ? lines : ['']).map(l =>
      `<a:p><a:pPr${bullet ? ' marL="216000" indent="-216000"' : ''}><a:lnSpc><a:spcPct val="135000"/></a:lnSpc><a:spcBef><a:spcPts val="500"/></a:spcBef>${bullet ? '<a:buChar char="•"/>' : '<a:buNone/>'}</a:pPr>` +
      `<a:r><a:rPr lang="ko-KR" sz="${sz}"${bold ? ' b="1"' : ''} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/></a:rPr><a:t>${xe(l)}</a:t></a:r></a:p>`
    ).join('') + '</p:txBody>';
}
function sp(id, x, y, cx, cy, fill, body, line) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="sp${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>` +
    `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    (fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>') +
    (line ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>') +
    `</p:spPr>${body || tx([''], 1200, '000000')}</p:sp>`;
}
const PNS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
function slide(shapes, bg) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${PNS}><p:cSld>` +
    (bg ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` : '') +
    '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    shapes + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
}
const lines = (s) => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);

function deckSlides() {
  const t = PPT_TEMPLATES[deck.template], today = new Date().toISOString().slice(0, 10), out = [];

  // 1장: 제목 페이지
  out.push(slide(
    sp(2, 838200, 1900000, 10515600, 300000, null, tx(['TECHNOLOGY TREND REPORT'], 1100, t.accent, true)) +
    sp(3, 838200, 2350000, 10515600, 1300000, null, tx([$('tTitle').value], 4000, 'FFFFFF', true)) +
    sp(4, 838200, 3900000, 2400000, 90000, t.accent, tx([''], 100, 'FFFFFF')) +
    sp(5, 838200, 4300000, 10515600, 800000, null, tx([`주제 · ${$('tTopic').value}`, `${$('tAuthor').value}   |   ${today}   |   gpt-oss-120b 생성`], 1200, t.sub)),
    t.bg));

  // 2장: 1. 최신기술동향 개요
  out.push(slide(
    sp(2, 0, 0, SLD.w, 1050000, t.bg, null) +
    sp(3, 838200, 350000, 10515600, 420000, null, tx(['1. 최신기술동향 개요'], 2200, 'FFFFFF', true)) +
    sp(4, 838200, 1600000, 10515600, 3600000, null, tx(lines($('tOverview').value), 1400, t.ink)) +
    sp(5, 838200, 6150000, 6000000, 260000, null, tx([`수록 동향 ${deck.trends.length}건`], 1000, '8895A6'))));

  // 3장~: 동향별 1장 — 상단 제목 / 좌 이미지·내용 / 우 체크포인트·적용방안
  deck.trends.forEach((tr, i) => {
    const n = i + 2, L = 640000, LW = 6100000, R = 7100000, RW = 4450000;
    out.push(slide(
      sp(2, 0, 0, SLD.w, 1050000, t.bg, null) +
      sp(3, L, 350000, 9600000, 420000, null, tx([`${n}. ${tr.title}`], 2000, 'FFFFFF', true)) +
      sp(4, L, 1400000, LW, 2150000, 'EDF1F5', tx([''], 100, '000000'), t.sideLine) +
      sp(5, L + 300000, 2330000, LW - 600000, 400000, null, tx([`[ 이미지 ] ${tr.visual}`], 1100, '73808F', true)) +
      sp(6, L, 3750000, LW, 2450000, null, tx(lines(tr.body), 1200, t.ink)) +
      sp(7, R, 1400000, RW, 4800000, t.side, tx([''], 100, '000000'), t.sideLine) +
      sp(8, R + 280000, 1650000, RW - 560000, 300000, null, tx(['✔  체크포인트'], 1300, t.accent, true)) +
      sp(9, R + 280000, 2080000, RW - 560000, 1900000, null, tx(tr.checkpoints, 1100, t.ink, false, true)) +
      sp(10, R + 280000, 4200000, RW - 560000, 300000, null, tx(['▶  적용방안'], 1300, t.accent, true)) +
      sp(11, R + 280000, 4630000, RW - 560000, 1450000, null, tx(tr.apply, 1100, t.ink, false, true))));
  });
  return out;
}

const THEME_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="surrodocs"><a:themeElements><a:clrScheme name="s"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="16233A"/></a:dk2><a:lt2><a:srgbClr val="F2F6FD"/></a:lt2><a:accent1><a:srgbClr val="3E7BD6"/></a:accent1><a:accent2><a:srgbClr val="D9862A"/></a:accent2><a:accent3><a:srgbClr val="38A77B"/></a:accent3><a:accent4><a:srgbClr val="DF5857"/></a:accent4><a:accent5><a:srgbClr val="7C8C92"/></a:accent5><a:accent6><a:srgbClr val="285BDF"/></a:accent6><a:hlink><a:srgbClr val="285BDF"/></a:hlink><a:folHlink><a:srgbClr val="7C8C92"/></a:folHlink></a:clrScheme><a:fontScheme name="s"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="맑은 고딕"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="맑은 고딕"/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="s"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
const CLRMAP = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';
const EMPTY_TREE = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>';
const RELS_OPEN = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';

function pptx() {
  const slides = deckSlides(), files = {};
  files['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('') + '</Types>';
  files['_rels/.rels'] = RELS_OPEN + `<Relationship Id="rId1" Type="${REL}officeDocument" Target="ppt/presentation.xml"/></Relationships>`;
  files['ppt/presentation.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ${PNS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>` +
    slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('') +
    `</p:sldIdLst><p:sldSz cx="${SLD.w}" cy="${SLD.h}"/><p:notesSz cx="${SLD.h}" cy="${SLD.w}"/></p:presentation>`;
  files['ppt/_rels/presentation.xml.rels'] = RELS_OPEN + `<Relationship Id="rId1" Type="${REL}slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
    slides.map((_, i) => `<Relationship Id="rId${i + 2}" Type="${REL}slide" Target="slides/slide${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${slides.length + 2}" Type="${REL}theme" Target="theme/theme1.xml"/></Relationships>`;
  files['ppt/theme/theme1.xml'] = THEME_XML;
  files['ppt/slideMasters/slideMaster1.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster ${PNS}><p:cSld>${EMPTY_TREE}</p:cSld>${CLRMAP}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`;
  files['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = RELS_OPEN + `<Relationship Id="rId1" Type="${REL}slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${REL}theme" Target="../theme/theme1.xml"/></Relationships>`;
  files['ppt/slideLayouts/slideLayout1.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout ${PNS} type="blank" preserve="1"><p:cSld name="빈 화면">${EMPTY_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  files['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = RELS_OPEN + `<Relationship Id="rId1" Type="${REL}slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
  slides.forEach((s, i) => {
    files[`ppt/slides/slide${i + 1}.xml`] = s;
    files[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = RELS_OPEN + `<Relationship Id="rId1" Type="${REL}slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
  });
  return new Blob([zip(files)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

function requireDeck() { if (!deck.trends.length) { alert('먼저 LLM으로 기술동향을 생성하세요.'); return false; } return true; }
$('pptxButton').onclick = () => { if (requireDeck()) download(pptx(), `surrodocs-${deck.template}-tech-trend.pptx`); };
$('pptXmlButton').onclick = () => { if (requireDeck()) download(new Blob([deckSlides().join('\n\n')], { type: 'application/xml' }), 'surrodocs-tech-trend-slides.xml'); };
