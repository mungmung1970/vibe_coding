/* ============================================================
 * pipeline/harness.js — 브라우저용 소스(app.js / formats.js / hwpx.js)를 Node 에서 쓴다.
 * selfcheck.js 와 같은 방식으로 DOM 전역만 흉내내고, 빌더 함수를 그대로 가져온다.
 * Blob 은 실제 바이트를 뽑을 수 있게 만든다(파일로 저장해야 하므로).
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const mk = (id) => ({ id, value: '', textContent: '', innerHTML: '', firstElementChild: { textContent: '' },
  dataset: {}, hidden: false, disabled: false, classList: { toggle() {} }, addEventListener() {}, onclick: null });
const cache = {};
global.$ = id => cache[id] || (cache[id] = mk(id));
global.document = { getElementById: id => global.$(id), querySelectorAll: () => [], addEventListener() {} };
global.localStorage = { getItem: () => null, setItem() {} };
global.alert = m => { throw new Error('alert: ' + m); };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.Blob = class Blob { constructor(parts, opt) { this.parts = parts; this.type = opt && opt.type; } };

/** Blob(중첩 가능) → Buffer */
function bytes(blob) {
  const acc = [];
  (function walk(x) {
    if (x instanceof Uint8Array) acc.push(Buffer.from(x));
    else if (Buffer.isBuffer(x)) acc.push(x);
    else if (typeof x === 'string') acc.push(Buffer.from(x, 'utf8'));
    else if (x && Array.isArray(x.parts)) x.parts.forEach(walk);
    else if (Array.isArray(x)) x.forEach(walk);
    else throw new Error('알 수 없는 Blob 조각: ' + typeof x);
  })(blob);
  return Buffer.concat(acc);
}

const FILES = ['app.js', 'formats.js', 'hwpx.js'];
const epilogue = `globalThis.__api = { zip, xe, esc, crc32, hp, hpLines, hpTable, hwpTable,
  hwpHeader, hwpSection, hwpxPackage, DOC_TEMPLATES, HWP_CHAR, HWP_PARA, HWP_BF, TEXT_W,
  parts: () => LAST_PARTS, resetHwpIds: () => { hwpId = 0; } };`;
(0, eval)(FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).concat(epilogue).join('\n'));

module.exports = Object.assign({ bytes, ROOT }, globalThis.__api);
