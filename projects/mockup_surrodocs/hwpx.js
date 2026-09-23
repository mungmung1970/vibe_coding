/* ============================================================
 * hwpx.js — 한글 문서(HWPX / OWPML) 빌더
 *
 * HWPX 는 ZIP 컨테이너다. app.js 의 zip() 을 그대로 쓴다.
 * 파트 목록은 formats.js 의 PACKAGE_PARTS.hwpx, 태그 매핑은 FIELD_MAP 참고.
 *
 * 단위: 길이 HWPUNIT(7200 = 1inch), 글자 크기 1/100 pt.
 * 참조 ID 는 Contents/header.xml 의 refList 에 정의한 것만 쓸 수 있다.
 * ============================================================ */

/* ---------- 참조 ID 표 ---------- */
const HWP_CHAR = { body: 0, title: 1, h1: 2, h2: 3, h3: 4, thead: 5, small: 6, cap: 7 };
const HWP_PARA = { body: 0, title: 1, h1: 2, h2: 3, h3: 4, toc1: 5, toc2: 6, toc3: 7, cell: 8, cellL: 9 };
const HWP_BF   = { none: 1, box: 2, head: 3, soft: 4 };   // borderFill
const TEXT_W = 42520;                                      // A4 본문 폭(HWPUNIT)

const HNS = 'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2010/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version"';

/* ---------- header.xml ---------- */
const LANGS = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user'];
const langAttr = (v) => LANGS.map(l => `${l}="${v}"`).join(' ');

function hwpFontfaces(font) {
  return `<hh:fontfaces itemCnt="${LANGS.length}">` + LANGS.map(l =>
    `<hh:fontface lang="${l.toUpperCase()}" fontCnt="1"><hh:font id="0" face="${font}" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_GOTHIC" weight="0" proportion="0" contrast="0" strokeVariation="0" armStyle="0" letterform="0" midline="0" xHeight="0"/></hh:font></hh:fontface>`).join('') + '</hh:fontfaces>';
}
function hwpBorder(tag, type) { return `<hh:${tag} type="${type}" width="0.12 mm" color="#C4CBD3"/>`; }
function hwpBorderFill(id, boxed, fill) {
  const t = boxed ? 'SOLID' : 'NONE';
  return `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">` +
    '<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>' +
    hwpBorder('leftBorder', t) + hwpBorder('rightBorder', t) + hwpBorder('topBorder', t) + hwpBorder('bottomBorder', t) +
    '<hh:diagonal type="NONE" width="0.1 mm" color="#000000"/>' +
    (fill ? `<hc:fillBrush><hc:winBrush faceColor="${fill}" hatchColor="#333333" alpha="0"/></hc:fillBrush>` : '') +
    '</hh:borderFill>';
}
function hwpCharPr(id, height, color, bold) {
  return `<hh:charPr id="${id}" height="${height}" textColor="${color}" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="${HWP_BF.none}">` +
    `<hh:fontRef ${langAttr(0)}/><hh:ratio ${langAttr(100)}/><hh:spacing ${langAttr(0)}/><hh:relSz ${langAttr(100)}/><hh:offset ${langAttr(0)}/>` +
    (bold ? '<hh:bold/>' : '') + '</hh:charPr>';
}
function hwpParaPr(id, align, indent, before, after) {
  return `<hh:paraPr id="${id}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">` +
    `<hh:align horizontal="${align}" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/>` +
    '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="BREAK_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>' +
    '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>' +
    `<hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="${indent}" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="${before}" unit="HWPUNIT"/><hc:next value="${after}" unit="HWPUNIT"/></hh:margin>` +
    '<hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>' +
    `<hh:border borderFillIDRef="${HWP_BF.none}" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>`;
}
function hwpNumbering() {
  return '<hh:numbering id="1" start="0">' + [1, 2, 3, 4, 5, 6, 7].map(l =>
    `<hh:paraHead start="1" level="${l}" align="LEFT" useInstWidth="1" autoIndent="1" widthAdjust="0" textOffsetType="PERCENT" textOffset="50" numFormat="DIGIT" charPrIDRef="4294967295" checkable="0">^${l}.</hh:paraHead>`).join('') + '</hh:numbering>';
}
function hwpHeader(tpl) {
  const A = '#' + tpl.accent;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<hh:head ${HNS} version="1.4" secCnt="1">` +
    '<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>' +
    '<hh:refList>' +
      hwpFontfaces(tpl.font) +
      `<hh:borderFills itemCnt="4">${hwpBorderFill(HWP_BF.none, false)}${hwpBorderFill(HWP_BF.box, true)}${hwpBorderFill(HWP_BF.head, true, A)}${hwpBorderFill(HWP_BF.soft, true, '#F4F6F9')}</hh:borderFills>` +
      '<hh:charProperties itemCnt="8">' +
        hwpCharPr(HWP_CHAR.body, 1000, '#1A1A1A') + hwpCharPr(HWP_CHAR.title, 2000, A, true) +
        hwpCharPr(HWP_CHAR.h1, 1500, A, true) + hwpCharPr(HWP_CHAR.h2, 1200, '#1A1A1A', true) +
        hwpCharPr(HWP_CHAR.h3, 1100, '#333333', true) + hwpCharPr(HWP_CHAR.thead, 1000, '#FFFFFF', true) +
        hwpCharPr(HWP_CHAR.small, 900, '#777777') + hwpCharPr(HWP_CHAR.cap, 900, A, true) +
      '</hh:charProperties>' +
      '<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>' +
      `<hh:numberings itemCnt="1">${hwpNumbering()}</hh:numberings>` +
      '<hh:paraProperties itemCnt="10">' +
        hwpParaPr(HWP_PARA.body, 'JUSTIFY', 0, 0, 200) + hwpParaPr(HWP_PARA.title, 'CENTER', 0, 0, 900) +
        hwpParaPr(HWP_PARA.h1, 'LEFT', 0, 900, 300) + hwpParaPr(HWP_PARA.h2, 'LEFT', 600, 600, 200) +
        hwpParaPr(HWP_PARA.h3, 'LEFT', 1200, 400, 150) +
        hwpParaPr(HWP_PARA.toc1, 'LEFT', 0, 150, 100) + hwpParaPr(HWP_PARA.toc2, 'LEFT', 900, 60, 60) +
        hwpParaPr(HWP_PARA.toc3, 'LEFT', 1800, 40, 40) +
        hwpParaPr(HWP_PARA.cell, 'CENTER', 0, 0, 0) + hwpParaPr(HWP_PARA.cellL, 'LEFT', 0, 0, 0) +
      '</hh:paraProperties>' +
      '<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>' +
    '</hh:refList></hh:head>';
}

/* ---------- 본문 조립 ---------- */
let hwpId = 0;
const lineseg = (w) => `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="${w}" flags="393216"/></hp:linesegarray>`;

/** 문단 하나. inner 를 주면 텍스트 대신 컨트롤(표 등)을 넣는다. */
function hp(text, paraPr, charPr, inner, width) {
  return `<hp:p id="${hwpId++}" paraPrIDRef="${paraPr}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="${charPr}">${inner || ''}${text != null ? `<hp:t>${xe(text)}</hp:t>` : ''}</hp:run>` +
    lineseg(width || TEXT_W) + '</hp:p>';
}
/** 여러 줄 텍스트 → 문단 여러 개 */
const hpLines = (s, paraPr, charPr, width) => String(s || '').split('\n').map(x => x.trim()).filter(Boolean).map(l => hp(l, paraPr, charPr, null, width)).join('') || hp('', paraPr, charPr, null, width);

/**
 * 표. rows = [[cell, ...], ...], cell = { t, colSpan, rowSpan, head, table }
 * table 을 주면 셀 안에 표를 중첩한다(표 안의 표).
 */
function hwpTable(rows, cols, width) {
  const colW = Math.floor(width / cols), rowH = 1400;
  const taken = new Set();   // rowSpan 으로 이미 채워진 칸 — cellAddr 는 이 칸을 건너뛴다
  let body = '';
  rows.forEach((row, r) => {
    let colAddr = 0;
    body += '<hp:tr>' + row.map(c => {
      while (taken.has(r + ',' + colAddr)) colAddr++;
      const cs = c.colSpan || 1, rs = c.rowSpan || 1, w = colW * cs, addr = colAddr;
      for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) taken.add((r + dr) + ',' + (addr + dc));
      colAddr += cs;
      const bf = c.head ? HWP_BF.head : (c.soft ? HWP_BF.soft : HWP_BF.box);
      const inner = c.table
        ? hp(null, HWP_PARA.cellL, HWP_CHAR.body, hwpTable(c.table.rows, c.table.cols, w - 1200), w - 1200)
        : hpLines(c.t, c.head ? HWP_PARA.cell : HWP_PARA.cellL, c.head ? HWP_CHAR.thead : HWP_CHAR.body, w - 1020);
      return `<hp:tc name="" header="${c.head ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${bf}">` +
        `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="${w - 1020}" textHeight="0" hasTextRef="0" hasNumRef="0">${inner}</hp:subList>` +
        `<hp:cellAddr colAddr="${addr}" rowAddr="${r}"/><hp:cellSpan colSpan="${cs}" rowSpan="${rs}"/>` +
        `<hp:cellSz width="${w}" height="${rowH * rs}"/>` +
        '<hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>';
    }).join('') + '</hp:tr>';
  });
  return `<hp:tbl id="${hwpId++}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${rows.length}" colCnt="${cols}" cellSpacing="0" borderFillIDRef="${HWP_BF.box}" noAdjust="0">` +
    `<hp:sz width="${width}" widthRelTo="ABSOLUTE" height="${rowH * rows.length}" heightRelTo="ABSOLUTE" protect="0"/>` +
    '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
    '<hp:outMargin left="0" right="0" top="0" bottom="200"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>' +
    body + '</hp:tbl>';
}
/** 표를 본문에 놓는 문단 */
const hpTable = (rows, cols, width) => hp(null, HWP_PARA.body, HWP_CHAR.body, hwpTable(rows, cols, width || TEXT_W));

const SEC_PR = '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">' +
  '<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0" strtnum="0"/>' +
  '<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>' +
  '<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>' +
  '<hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">' +
  '<hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr>' +
  '<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="850" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>' +
  '<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>' +
  '<hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>' +
  '</hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>';

/** 첫 문단에는 반드시 secPr 이 들어가야 한다. */
function hwpSection(paras) {
  const first = `<hp:p id="${hwpId++}" paraPrIDRef="${HWP_PARA.body}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${HWP_CHAR.body}">${SEC_PR}</hp:run>${lineseg(TEXT_W)}</hp:p>`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + `<hs:sec ${HNS}>` + first + paras + '</hs:sec>';
}

/* ---------- 패키지 ---------- */
function hwpxPackage(title, header, section) {
  const files = {};
  files['mimetype'] = 'application/hwp+zip';           // ponytail: 반드시 첫 엔트리 · 무압축(zip() 이 전부 stored)
  files['version.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="0" micro="5" buildNumber="0" os="1" xmlVersion="1.4" application="surrodocs" appVersion="1.0"/>';
  files['META-INF/container.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>';
  files['META-INF/manifest.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" version="1.2"><odf:file-entry odf:full-path="/" odf:media-type="application/hwp+zip"/><odf:file-entry odf:full-path="Contents/content.hpf" odf:media-type="application/xml"/><odf:file-entry odf:full-path="Contents/header.xml" odf:media-type="application/xml"/><odf:file-entry odf:full-path="Contents/section0.xml" odf:media-type="application/xml"/></odf:manifest>';
  files['Contents/content.hpf'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><opf:package xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" version="" unique-identifier="" id="">' +
    `<opf:metadata><opf:title>${xe(title)}</opf:title><opf:language>ko</opf:language><opf:meta name="creator" content="surrodocs"/></opf:metadata>` +
    '<opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml" isEmbeded="0"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml" isEmbeded="0"/></opf:manifest>' +
    '<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>';
  files['Contents/header.xml'] = header;
  files['Contents/section0.xml'] = section;
  return new Blob([zip(files)], { type: 'application/hwp+zip' });
}

/* ---------- 문서 1: 장애보고서 HWPX ---------- */
function hwpxIncident(d, tplKey) {
  hwpId = 0;
  const tpl = DOC_TEMPLATES[tplKey];
  // 셀 병합 예시: 머리행은 '일시 | 현상 / 조치 내용' 2열, 메타행은 1행 3열 병합
  const rows = [[{ t: '일시', head: true }, { t: '현상 / 조치 내용', head: true, colSpan: 2 }]]
    .concat(d.rows.map(r => [{ t: r[0] }, { t: r[1], colSpan: 2 }]));
  const paras =
    hp(tpl.kicker, HWP_PARA.body, HWP_CHAR.cap) +
    hp(d.title, HWP_PARA.title, HWP_CHAR.title) +
    hpTable([[{ t: '발생일자', head: true }, { t: d.date }, { t: '장애 등급', head: true }, { t: d.severity }],
             [{ t: '작성자', head: true }, { t: d.author, colSpan: 3 }]], 4) +
    hp('1. 장애 내용', HWP_PARA.h1, HWP_CHAR.h1) + hpLines(d.summary, HWP_PARA.body, HWP_CHAR.body) +
    hp('2. 시간대별 장애 현상', HWP_PARA.h1, HWP_CHAR.h1) + hpTable(rows, 3) +
    hp('3. 조치 결과', HWP_PARA.h1, HWP_CHAR.h1) + hpLines(d.result, HWP_PARA.body, HWP_CHAR.body);
  return hwpxPackage(d.title, hwpHeader(tpl), hwpSection(paras));
}

/* ---------- 문서 2: 복합 구조 문서 HWPX (3단계 목차 · 셀병합 · 중첩표) ---------- */
function hwpxComplex(doc, tplKey) {
  hwpId = 0;
  const tpl = DOC_TEMPLATES[tplKey];
  let paras = hp(doc.subtitle || 'TECHNICAL DOCUMENT', HWP_PARA.body, HWP_CHAR.cap) +
              hp(doc.title, HWP_PARA.title, HWP_CHAR.title);

  // 목차 3단계
  paras += hp('목  차', HWP_PARA.h1, HWP_CHAR.h1);
  doc.sections.forEach(s => {
    paras += hp(`${s.no}. ${s.title}`, HWP_PARA.toc1, HWP_CHAR.h2);
    (s.subs || []).forEach(s2 => {
      paras += hp(`${s2.no} ${s2.title}`, HWP_PARA.toc2, HWP_CHAR.body);
      (s2.subs || []).forEach(s3 => { paras += hp(`${s3.no} ${s3.title}`, HWP_PARA.toc3, HWP_CHAR.small); });
    });
  });

  // 본문 3단계
  doc.sections.forEach(s => {
    paras += hp(`${s.no}. ${s.title}`, HWP_PARA.h1, HWP_CHAR.h1) + hpLines(s.body, HWP_PARA.body, HWP_CHAR.body);
    if (s.table) paras += tableWithCaption(s.table);
    (s.subs || []).forEach(s2 => {
      paras += hp(`${s2.no} ${s2.title}`, HWP_PARA.h2, HWP_CHAR.h2) + hpLines(s2.body, HWP_PARA.body, HWP_CHAR.body);
      if (s2.table) paras += tableWithCaption(s2.table);
      (s2.subs || []).forEach(s3 => {
        paras += hp(`${s3.no} ${s3.title}`, HWP_PARA.h3, HWP_CHAR.h3) + hpLines(s3.body, HWP_PARA.body, HWP_CHAR.body);
        if (s3.table) paras += tableWithCaption(s3.table);
      });
    });
  });
  return hwpxPackage(doc.title, hwpHeader(tpl), hwpSection(paras));
}
function tableWithCaption(t) {
  return (t.caption ? hp('〈표〉 ' + t.caption, HWP_PARA.body, HWP_CHAR.cap) : '') + hpTable(t.rows, t.cols);
}
