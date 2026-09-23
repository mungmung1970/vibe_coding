/* ============================================================
 * pipeline/run.js — PDF → 엑셀 → DOCX/HWPX 전체 실행
 *
 *   node pipeline/run.js [PDF경로]
 *   node pipeline/run.js --skip-extract     이미 뽑아 둔 out/doc.json 을 다시 쓴다
 *
 * 환경변수: LLM_BASE(기본 http://127.0.0.1:8000/v1) · LLM_MODEL(기본 qwen3.8-27b)
 *          TEMPLATE(executive|ops) · PDF_DPI(기본 200)
 * ============================================================ */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const HERE = __dirname;
const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(HERE, '..', 'out');
const args = process.argv.slice(2);
const skip = args.includes('--skip-extract');
const pdf = args.find(a => !a.startsWith('--'));

const STEPS = [
  ['1. PDF 판독 (qwen3.8 VLM)', 'extract.js', pdf ? [pdf] : []],
  ['2. 엑셀 저장', 'toxlsx.js', []],
  ['3·4. XML 매핑 → DOCX / HWPX', 'form.js', []],
  ['5. 구조 검증', 'verify.js', []]
];

let t0 = Date.now();
STEPS.forEach(([label, script, extra], i) => {
  if (skip && script === 'extract.js') { console.log(`\n■ ${label} — 건너뜀(--skip-extract)`); return; }
  console.log(`\n■ ${label}`);
  const t = Date.now();
  execFileSync('node', [path.join(HERE, script), ...extra], { stdio: 'inherit' });
  console.log(`   (${((Date.now() - t) / 1000).toFixed(1)}초)`);
});

console.log(`\n전체 ${((Date.now() - t0) / 1000).toFixed(1)}초`);
console.log(`\n산출물 (${OUT})`);
fs.readdirSync(OUT).filter(n => /\.(xlsx|docx|hwpx|json)$/.test(n)).sort()
  .forEach(n => console.log(`  ${n.padEnd(34)} ${(fs.statSync(path.join(OUT, n)).size / 1024).toFixed(1)} KB`));
