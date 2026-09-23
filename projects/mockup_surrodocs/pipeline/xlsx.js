/* ============================================================
 * pipeline/xlsx.js — 의존성 없는 XLSX 쓰기/읽기
 *
 * xlsx 도 docx·hwpx 와 같은 "ZIP + XML" 이라 app.js 의 zip() 을 그대로 쓴다.
 * 문자열은 sharedStrings 대신 inlineStr 로 넣는다(파트 하나가 줄고 읽기도 단순하다).
 * 서식은 4가지만 둔다: 0 본문 · 1 머리행 · 2 라벨 · 3 가운데 정렬.
 * ============================================================ */
const { zip, xe, bytes } = require('./harness');
const zlib = require('zlib');

const S = { body: 0, head: 1, label: 2, center: 3 };

const col = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; };

function sheetXml(sheet) {
  const widths = (sheet.cols || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const rows = sheet.rows.map((row, r) => {
    const cells = row.map((cell, c) => {
      const v = cell && typeof cell === 'object' ? cell.v : cell;
      const st = cell && typeof cell === 'object' && cell.s !== undefined ? cell.s : S.body;
      if (v === undefined || v === null || v === '') return `<c r="${col(c)}${r + 1}" s="${st}"/>`;
      return `<c r="${col(c)}${r + 1}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xe(String(v))}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}"${sheet.heights && sheet.heights[r] ? ` ht="${sheet.heights[r]}" customHeight="1"` : ''}>${cells}</row>`;
  }).join('');
  const merges = (sheet.merges || []).length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="16"/>' +
    (widths ? `<cols>${widths}</cols>` : '') +
    `<sheetData>${rows}</sheetData>${merges}</worksheet>`;
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="3">' +
    '<font><sz val="10"/><name val="맑은 고딕"/></font>' +
    '<font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="맑은 고딕"/></font>' +
    '<font><b/><sz val="10"/><name val="맑은 고딕"/></font>' +
  '</fonts>' +
  '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF285BDF"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF4F6F9"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFD9E1E5"/></left><right style="thin"><color rgb="FFD9E1E5"/></right>' +
    '<top style="thin"><color rgb="FFD9E1E5"/></top><bottom style="thin"><color rgb="FFD9E1E5"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
    '<xf xfId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf xfId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf xfId="0" fontId="2" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf xfId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

/** sheets = [{ name, cols?, rows, merges? }] → Buffer(.xlsx) */
function writeXlsx(sheets) {
  const files = {};
  files['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  files['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  files['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map((s, i) => `<sheet name="${xe(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>';
  files['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  files['xl/styles.xml'] = STYLES;
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s); });
  return bytes(zip(files));
}

/* ---------- 읽기 ---------- */
// zip(stored/deflate) 을 직접 푼다. 3단계(문서 생성)가 실제로 엑셀을 다시 읽는지 확인하려면 필요하다.
function unzip(buf) {
  const out = {};
  let p = buf.length - 22;
  while (p >= 0 && buf.readUInt32LE(p) !== 0x06054b50) p--;
  if (p < 0) throw new Error('ZIP 끝 레코드를 찾지 못했습니다');
  const count = buf.readUInt16LE(p + 10);
  let off = buf.readUInt32LE(p + 16);
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(off + 28), extraLen = buf.readUInt16LE(off + 30), cmtLen = buf.readUInt16LE(off + 32);
    const method = buf.readUInt16LE(off + 10), size = buf.readUInt32LE(off + 20);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8');
    const local = buf.readUInt32LE(off + 42);
    const lNameLen = buf.readUInt16LE(local + 26), lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(start, start + size);
    out[name] = method === 8 ? zlib.inflateRawSync(raw) : raw;
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

const unxe = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#10;/g, '\n').replace(/&amp;/g, '&');

/** Buffer(.xlsx) → [{ name, rows: [[문자열, ...], ...] }] */
function readXlsx(buf) {
  const files = unzip(buf);
  const wb = files['xl/workbook.xml'].toString('utf8');
  const names = [...wb.matchAll(/<sheet name="([^"]*)"/g)].map(m => unxe(m[1]));
  const shared = files['xl/sharedStrings.xml']
    ? [...files['xl/sharedStrings.xml'].toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)]
        .map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => unxe(t[1])).join(''))
    : [];
  return names.map((name, i) => {
    const xml = files[`xl/worksheets/sheet${i + 1}.xml`].toString('utf8');
    const rows = [...xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map(m => {
      const cells = [];
      for (const c of m[2].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], inner = c[2] || '';
        const ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1] || '';
        const type = (attrs.match(/t="(\w+)"/) || [])[1] || '';
        let idx = 0; for (const ch of ref) idx = idx * 26 + (ch.charCodeAt(0) - 64);
        let v = '';
        if (type === 'inlineStr') v = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => unxe(t[1])).join('');
        else if (type === 's') v = shared[Number((inner.match(/<v>(\d+)<\/v>/) || [])[1] || 0)] || '';
        else v = unxe(((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1]) || '');
        cells[idx - 1] = v;
      }
      for (let k = 0; k < cells.length; k++) if (cells[k] === undefined) cells[k] = '';
      return cells;
    });
    return { name, rows };
  });
}

module.exports = { writeXlsx, readXlsx, unzip, S };
