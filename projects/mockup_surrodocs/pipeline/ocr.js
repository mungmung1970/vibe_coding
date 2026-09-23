/* ============================================================
 * pipeline/ocr.js — 스캔 페이지 → 텍스트 (tesseract)
 *
 * 텍스트 전용 모델(gpt-oss-120b 등)에 스캔 PDF 를 먹이려면 글자를 먼저 뽑아야 한다.
 * 단순 텍스트 출력은 여러 단(段)을 가로질러 읽어 줄이 뒤섞이므로,
 * TSV(단어별 block/par/line 번호와 좌표)를 받아 블록 단위로 다시 묶는다.
 *
 * tesseract 는 시스템 설치(/usr/bin)를 먼저 쓰고, 없으면 TESS_HOME(기본 ~/opt/tess)에
 * deb 를 풀어 둔 것을 쓴다. 한국어는 tessdata_best 의 kor(=kor_best)이 기본 kor 보다 낫다.
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const TESS_HOME = process.env.TESS_HOME || path.join(os.homedir(), 'opt/tess');
const SYSTEM_BIN = '/usr/bin/tesseract';
const LOCAL_BIN = path.join(TESS_HOME, 'usr/bin/tesseract');
const useSystem = fs.existsSync(SYSTEM_BIN);
const BIN = useSystem ? SYSTEM_BIN : LOCAL_BIN;
const ENV = useSystem ? { ...process.env } : {
  ...process.env,
  LD_LIBRARY_PATH: path.join(TESS_HOME, 'usr/lib/x86_64-linux-gnu') + ':' + (process.env.LD_LIBRARY_PATH || ''),
  TESSDATA_PREFIX: process.env.TESSDATA_PREFIX || path.join(TESS_HOME, 'usr/share/tesseract-ocr/5/tessdata')
};
const LANG = process.env.OCR_LANG || 'kor_best';

function available() { return fs.existsSync(BIN); }

/** 페이지 이미지 → 블록별로 묶은 텍스트 */
function pageText(image, psm = Number(process.env.OCR_PSM || 3)) {
  const base = path.join(os.tmpdir(), 'ocr-' + path.basename(image, '.png'));
  execFileSync(BIN, [image, base, '-l', LANG, '--psm', String(psm), 'tsv'], { env: ENV });
  const tsv = fs.readFileSync(base + '.tsv', 'utf8').split('\n').slice(1);
  const lines = new Map();      // block/par/line → { y, x, words[] }
  tsv.forEach(r => {
    const c = r.split('\t');
    if (c.length < 12 || c[0] !== '5') return;                 // level 5 = 단어
    const conf = Number(c[10]), text = c[11];
    if (!text || !text.trim() || conf < 30) return;
    const key = `${c[2]}/${c[3]}/${c[4]}`;
    if (!lines.has(key)) lines.set(key, { block: +c[2], y: +c[7], x: +c[6], words: [] });
    lines.get(key).words.push(text);
  });
  const byBlock = new Map();
  [...lines.values()].forEach(l => {
    if (!byBlock.has(l.block)) byBlock.set(l.block, { y: l.y, x: l.x, lines: [] });
    const b = byBlock.get(l.block);
    b.y = Math.min(b.y, l.y); b.x = Math.min(b.x, l.x);
    b.lines.push(l);
  });
  return [...byBlock.entries()]
    .sort((a, b) => (a[1].y - b[1].y) || (a[1].x - b[1].x))
    .map(([, b]) => b.lines.sort((p, q) => p.y - q.y).map(l => l.words.join(' ')).join('\n'))
    .filter(t => t.trim())
    .join('\n\n--- 블록 ---\n');
}

module.exports = { available, pageText, BIN, LANG };

if (require.main === module) {
  const img = process.argv[2];
  if (!img) { console.error('사용법: node pipeline/ocr.js <페이지.png>'); process.exit(1); }
  console.log(pageText(img));
}
