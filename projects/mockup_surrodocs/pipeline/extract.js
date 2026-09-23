/* ============================================================
 * pipeline/extract.js — 1단계: PDF → 페이지 이미지 → qwen3.8(VLM) → doc.json
 *
 * 이 PDF 는 텍스트 레이어가 없는 스캔본(페이지당 JPEG)이다. pdftotext 로는
 * 한 글자도 나오지 않으므로, 페이지를 렌더링해 VLM 에 읽힌다.
 * 모델 호출은 OpenAI 호환 엔드포인트 하나만 쓴다(llm.js 와 같은 규약).
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ocr = require('./ocr');

const ROOT = path.join(__dirname, '..');
const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(ROOT, 'out');
const BASE = process.env.LLM_BASE || 'http://127.0.0.1:8000/v1';
const MODEL = process.env.LLM_MODEL || 'qwen3.8-27b';
const KEY = process.env.LLM_KEY || '';
// vlm: 페이지 이미지를 모델이 직접 본다 · text: tesseract 로 글자를 뽑아 텍스트만 넘긴다(텍스트 전용 모델용)
const MODE = process.env.EXTRACT_MODE || 'vlm';

/* ---------- PDF → PNG ---------- */
function renderPages(pdf, dir, dpi = Number(process.env.PDF_DPI || 200)) {
  fs.mkdirSync(dir, { recursive: true });
  fs.readdirSync(dir).filter(f => f.endsWith('.png')).forEach(f => fs.unlinkSync(path.join(dir, f)));
  execFileSync('pdftoppm', ['-r', String(dpi), '-png', pdf, path.join(dir, 'page')]);
  return fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort()
    .map(f => path.join(dir, f));
}

/* ---------- LLM ---------- */
function chat(content, maxTokens) {
  const headers = { 'Content-Type': 'application/json' };
  if (KEY) headers.Authorization = 'Bearer ' + KEY;
  return fetch(BASE + '/chat/completions', {
    method: 'POST', headers,
    body: JSON.stringify({
      model: MODEL, stream: false, temperature: Number(process.env.LLM_TEMP || 0), max_tokens: maxTokens,
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: '너는 한국어 문서 OCR·구조화 도구다. 보이는 내용만 옮기고 없는 내용을 지어내지 않는다. JSON 만 출력한다.' },
        { role: 'user', content }
      ]
    })
  });
}

/** 텍스트 전용 모델: OCR 결과를 주고 구조화만 시킨다 */
async function askText(pageText, instruction, maxTokens = 6000) {
  const res = await chat([{ type: 'text', text: instruction + '\n\n--- OCR 텍스트 ---\n' + pageText }], maxTokens);
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return { text: j.choices?.[0]?.message?.content ?? '', usage: j.usage };
}
async function ask(imagePath, instruction, maxTokens = 6000) {
  const b64 = fs.readFileSync(imagePath).toString('base64');
  const headers = { 'Content-Type': 'application/json' };
  if (KEY) headers.Authorization = 'Bearer ' + KEY;
  const res = await fetch(BASE + '/chat/completions', {
    method: 'POST', headers,
    body: JSON.stringify({
      model: MODEL, stream: false, temperature: Number(process.env.LLM_TEMP || 0), max_tokens: maxTokens,
      // 추출 단계는 사고 과정이 필요 없다. 토큰을 본문에 쓰게 끈다.
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: '너는 한국어 문서 OCR·구조화 도구다. 보이는 내용만 옮기고 없는 내용을 지어내지 않는다. JSON 만 출력한다.' },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64 } },
          { type: 'text', text: instruction }
        ] }
      ]
    })
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return { text: j.choices?.[0]?.message?.content ?? '', usage: j.usage };
}

function parseJSON(raw) {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0 || e < s) throw new Error('JSON 을 찾지 못했습니다: ' + raw.slice(0, 200));
  const body = raw.slice(s, e + 1);
  try { return JSON.parse(body); }
  catch (err) {
    // 모델이 흔히 내는 깨짐만 되돌린다: 제어문자, 항목 사이 빠진 쉼표, 꼬리 쉼표
    const repaired = body.replace(/[\u0000-\u001f]+/g, ' ').replace(/"\s*\n?\s*"/g, '", "').replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(repaired);
  }
}

async function askJSON(image, instruction, tries = 3, maxTokens = 6000) {
  let last;
  for (let i = 0; i < tries; i++) {
    const { text, usage } = MODE === 'text' ? await askText(image, instruction, maxTokens) : await ask(image, instruction, maxTokens);
    fs.writeFileSync(path.join(OUT, 'last-response.txt'), text);
    try { return { data: parseJSON(text), usage }; }
    catch (err) { last = err; console.error(`  재시도 ${i + 1}/${tries}: ${err.message.slice(0, 120)}`); }
  }
  throw last;
}

/* ---------- 페이지별 추출 지시 ---------- */
const WRAP_RULE = `규칙:
- 칸 너비 때문에 줄이 접힌 것은 한 항목이다. 글머리표(•, -, ①②③④, →, ※, *)로 시작하는 자리에서만 새 항목을 시작하고, 접힌 줄은 공백 하나로 이어 붙인다.
- 글머리표 기호는 그대로 남기되 기호와 글자 사이는 공백 하나로 둔다.
- 라벨처럼 원래 여러 줄로 배치된 것(표 머리·왼쪽 라벨)은 \\n 으로 유지한다.
- 세로로 병합된 칸은 첫 행에만 값을 쓰고 이어지는 행은 "" 로 둔다.
- 보이지 않는 내용은 지어내지 않는다.

`;
const PAGE1 = WRAP_RULE + `이 페이지는 건설현장 "위험성평가 실시 규정" 양식이다. 보이는 모든 글자를 아래 JSON 스키마로 옮겨라.
표의 칸 구조와 글머리표(•, ①②③, -)를 살려서 문자열 배열로 담는다. 줄바꿈으로 나뉜 라벨은 \\n 으로 유지한다.

{
  "badge": "왼쪽 위 작은 라벨",
  "title": "문서 제목",
  "approval_cols": ["결재란 열 제목(부제 포함, 줄바꿈은 \\n)", ...],
  "meta": [{"label": "행 라벨(줄바꿈 \\n 유지)", "value": "값"}, ...],
  "purpose": ["목적 칸의 항목", ...],
  "method": ["방법 칸의 항목", ...],
  "org_chart": ["조직도 상자에 적힌 글자를 위에서 아래 순서로", ...],
  "roles": [{"role": "역할명(줄바꿈 \\n 유지)", "duties": ["책임사항", ...]}, ...],
  "procedure": [{"step": "① 단계명", "details": ["세부 내용", ...]}, ...],
  "risk_table": {"cols": ["열 제목", ...], "rows": [["칸", ...], ...]}
}`;

const PAGE2 = WRAP_RULE + `이 페이지는 같은 "위험성평가 실시 규정" 양식의 둘째 장이다. 보이는 모든 글자를 아래 JSON 스키마로 옮겨라.

{
  "section_label": "왼쪽 세로 라벨(줄바꿈 \\n 유지)",
  "intro": ["표 위 안내 문단", ...],
  "periodic_cols": ["표 머리행 열 제목", ...],
  "periodic": [{"cycle": "실시 주기 칸 전체(줄바꿈 \\n 유지)", "participants": ["참여자", ...], "heading": "세부 내용 칸의 진한 제목줄", "details": ["세부 내용 항목", ...]}, ...],
  "records": {"label": "기록 보존 라벨(줄바꿈 \\n 유지)", "items": ["항목", ...]},
  "notes": ["표 아래 ※ 또는 * 로 시작하는 안내문", ...]
}`;



/* ---------- 후처리 1: 접힌 줄 합치기 (규칙 기반) ---------- */
// 글머리표로 시작하지 않는 항목은 앞 항목이 이어진 것이다. 모델이 매번 지키지 못하므로 여기서 확정한다.
const BULLET = /^\s*(•|·|▪|-|–|→|※|\*|①|②|③|④|⑤|⑥|⑦|⑧|⑨|\(\d+\)|\d+[.)])/;
function joinWrapped(v) {
  if (Array.isArray(v)) {
    if (v.every(x => typeof x === 'string')) {
      if (!v.some(x => BULLET.test(x))) return v;           // 글머리표가 아예 없는 배열은 손대지 않는다
      const out = [];
      v.forEach(x => {
        if (out.length && !BULLET.test(x)) out[out.length - 1] += ' ' + x.trim();
        else out.push(x.trim());
      });
      return out;
    }
    return v.map(joinWrapped);
  }
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = joinWrapped(v[k]); return o; }
  return v;
}

/* ---------- 후처리 2: 원본 이미지와 대조 교정 ---------- */
const VERIFY = `위 이미지가 원본이다. 아래 JSON 은 이 페이지에서 뽑은 것인데 글자를 잘못 읽은 곳이 있을 수 있다.
이미지와 한 글자씩 대조해서 **다른 글자만** 고치고, 구조·키·항목 수는 그대로 둔 채 같은 형태의 JSON 만 출력하라.
고칠 곳이 없으면 받은 JSON 을 그대로 출력한다. 새 내용을 지어내거나 항목을 늘리고 줄이지 않는다.

JSON:
`;

/* ---------- 보정: 잔글씨 표는 그 영역만 300dpi 로 잘라 다시 읽는다 ---------- */
const REFINE = [{
  key: 'risk_table', page: 1, dpi: 600, box: [3160, 4720, 1560, 680],   // 잔글씨는 600dpi 라야 '허용 불가능' 을 온전히 읽는다
  prompt: `잘라낸 이 표만 읽어라. 3열(위험성 수준 / 판단 기준 / 허용 가능 여부) 표다.
접힌 줄은 한 문장으로 이어 붙이고, 세로 병합된 칸은 첫 행에만 값을 쓰고 이어지는 행은 "" 로 둔다.
{"cols": ["...", "...", "..."], "rows": [["...", "...", "..."], ...]}`
}];

function cropPage(pdf, dir, spec) {
  const out = path.join(dir, `crop-${spec.key}`);
  execFileSync('pdftoppm', ['-r', String(spec.dpi), '-png', '-f', String(spec.page), '-l', String(spec.page),
    '-x', String(spec.box[0]), '-y', String(spec.box[1]), '-W', String(spec.box[2]), '-H', String(spec.box[3]), pdf, out]);
  return fs.readdirSync(dir).filter(f => f.startsWith(`crop-${spec.key}`)).map(f => path.join(dir, f))[0];
}

/* ---------- 실행 ---------- */
(async () => {
  const pdf = process.argv[2] || path.join(ROOT, 'test', '위험성평가_실시규정(예시)_A4.pdf');
  fs.mkdirSync(OUT, { recursive: true });
  const pages = renderPages(pdf, path.join(OUT, 'pages'));
  console.log(`PDF ${path.basename(pdf)} → ${pages.length}쪽 렌더링`);

  const OCR_NOTE = `아래 텍스트는 스캔 문서를 OCR 한 것이라 글자가 깨지거나 칸이 뒤섞여 있을 수 있다.
알아볼 수 있는 부분만 담고, 확실하지 않으면 그 항목을 비운다. 없는 내용을 지어내지 않는다.
`;
  const inputs = MODE === 'text'
    ? pages.map(p => { const t = ocr.pageText(p); console.log(`  OCR ${path.basename(p)} — ${t.length}자`); return t; })
    : pages;
  const prompts = MODE === 'text' ? [OCR_NOTE + PAGE1, OCR_NOTE + PAGE2] : [PAGE1, PAGE2];
  console.log(`판독 방식: ${MODE === 'text' ? 'OCR(tesseract) + 텍스트 모델' : 'VLM 직접 판독'} · 모델 ${MODEL}`);
  const out = { source: path.basename(pdf), pages: pages.length, usage: [] };
  for (let i = 0; i < pages.length; i++) {
    const t0 = Date.now();
    const { data, usage } = await askJSON(inputs[i], prompts[i] || prompts[prompts.length - 1]);
    Object.assign(out, data);
    out.usage.push({ page: i + 1, ...usage, seconds: +((Date.now() - t0) / 1000).toFixed(1) });
    console.log(`  ${i + 1}쪽 추출 완료 — ${usage.completion_tokens} 토큰 / ${out.usage[i].seconds}초`);
  }
  // 접힌 줄을 합친 뒤, 페이지 이미지와 대조해 오독을 교정한다
  const keysOf = [['badge','title','approval_cols','meta','purpose','method','org_chart','roles','procedure'],
                  ['section_label','intro','periodic_cols','periodic','records','notes']];
  Object.assign(out, joinWrapped(out));
  for (let i = 0; MODE !== 'text' && i < pages.length; i++) {
    const subset = {};
    keysOf[i].forEach(k => { if (out[k] !== undefined) subset[k] = out[k]; });
    try {
      const { data } = await askJSON(pages[i], VERIFY + JSON.stringify(subset, null, 1), 2, 9000);
      let fixed = 0;
      keysOf[i].forEach(k => {
        if (data[k] === undefined) return;
        if (JSON.stringify(data[k]) !== JSON.stringify(out[k])) fixed++;
        out[k] = data[k];
      });
      console.log(`  ${i + 1}쪽 대조 교정 — 바뀐 항목 ${fixed}개`);
    } catch (err) { console.error(`  ${i + 1}쪽 대조 교정 건너뜀: ${err.message.slice(0, 80)}`); }
  }
  Object.assign(out, joinWrapped(out));

  for (const spec of (MODE === 'text' ? [] : REFINE)) {
    const img = cropPage(pdf, path.join(OUT, 'pages'), spec);
    const { data } = await askJSON(img, spec.prompt);
    out[spec.key] = data;
    console.log(`  보정: ${spec.key} (${spec.dpi}dpi 부분 확대)`);
  }
  fs.writeFileSync(path.join(OUT, 'doc.json'), JSON.stringify(out, null, 2));
  console.log('→ out/doc.json');
})().catch(err => { console.error('실패:', err.message); process.exit(1); });
