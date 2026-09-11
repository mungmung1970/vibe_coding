import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMarkdown } from '../src/utils/markdown.js';
import {
  formatCost,
  formatParameterSummary,
  formatReasoningTokens,
  formatSeconds,
  formatThinkingProgress,
  formatValue,
  rankJudgements,
} from '../src/utils/format.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('markdown renders headings, tables and lists', () => {
  const html = renderMarkdown('# 제목\n\n본문\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n- 하나\n- 둘\n');

  assert.match(html, /<h2>제목<\/h2>/);
  assert.match(html, /<table>.*<th>a<\/th>.*<td>1<\/td>/s);
  assert.match(html, /<ul><li>하나<\/li><li>둘<\/li><\/ul>/);
});

test('markdown escapes model output before styling it', () => {
  const html = renderMarkdown('<script>alert(1)</script> **굵게**');

  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<strong>굵게<\/strong>/);
});

test('markdown keeps a table that follows a paragraph without a blank line', () => {
  const html = renderMarkdown('설명\n| a | b |\n| --- | --- |\n| 1 | 2 |');

  assert.match(html, /<p>설명<\/p>/);
  assert.match(html, /<table>/);
});

test('parameter summary keeps requested order and drops empty values', () => {
  const summary = formatParameterSummary(
    { temperature: 0.3, top_p: 1, seed: null, stop: [] },
    ['temperature', 'top_p', 'seed'],
  );

  assert.equal(summary, 'temperature=0.3 · top_p=1');
});

test('thinking progress reports elapsed time and accumulated characters', () => {
  assert.equal(formatThinkingProgress({ characters: 1234, elapsedMs: 12622 }), '사고 중… 12.6초 · 1,234자');
  assert.equal(formatThinkingProgress({ characters: 0, elapsedMs: 0 }), '사고 중… 0.0초 · 0자');
  assert.equal(formatThinkingProgress(), '사고 중… 0.0초 · 0자');
});

test('reasoning tokens are shown only when the engine reports them', () => {
  assert.equal(formatReasoningTokens({ completion_tokens_details: { reasoning_tokens: 171 } }), '사고 171토큰');
  assert.equal(formatReasoningTokens({ completion_tokens_details: { reasoning_tokens: 0 } }), '');
  assert.equal(formatReasoningTokens({ total_tokens: 42 }), '');
  assert.equal(formatReasoningTokens(null), '');
});

test('judgement ranking sorts by score and names the model', () => {
  const ranked = rankJudgements(
    [{ index: 1, score: 40, reason: 'a' }, { index: 2, score: 92, reason: 'b' }],
    [{ model_id: 'qwen3.8-27b' }, { model_id: 'claude-sonnet-5' }],
  );

  assert.deepEqual(ranked.map((item) => [item.rank, item.model_id, item.score]), [
    [1, 'claude-sonnet-5', 92],
    [2, 'qwen3.8-27b', 40],
  ]);
});

test('tied scores share a rank and skip the next one', () => {
  const ranked = rankJudgements(
    [{ index: 1, score: 80 }, { index: 2, score: 80 }, { index: 3, score: 50 }],
    [{ model_id: 'a' }, { model_id: 'b' }, { model_id: 'c' }],
  );

  assert.deepEqual(ranked.map((item) => item.rank), [1, 1, 3]);
});

test('cost is shown only when the provider reports it', () => {
  assert.equal(formatCost({ estimated_cost: 0.0002336 }), '$0.00023');
  assert.equal(formatCost({ estimated_cost: 0.125 }), '$0.125');
  assert.equal(formatCost({ total_tokens: 100 }), '');   // 보고하지 않는 공급자
  assert.equal(formatCost({ estimated_cost: 0 }), '');
  assert.equal(formatCost(null), '');
});

test('value and duration formatting', () => {
  assert.equal(formatValue(null), '기본값');
  assert.equal(formatValue(true), '켜짐');
  assert.equal(formatValue(['a', 'b']), 'a, b');
  assert.equal(formatSeconds(9060), '9.06초');
  assert.equal(formatSeconds(undefined), '-');
});

