import test from 'node:test';
import assert from 'node:assert/strict';

import { generateStream, listModels } from '../src/services/api.js';

const sseResponse = (chunks) => ({
  ok: true,
  status: 200,
  body: {
    getReader() {
      const encoder = new TextEncoder();
      let index = 0;
      return {
        read: async () => (index < chunks.length
          ? { done: false, value: encoder.encode(chunks[index++]) }
          : { done: true, value: undefined }),
      };
    },
  },
});

test('generateStream reassembles events split across network chunks', async () => {
  globalThis.fetch = async () => sseResponse([
    'event: start\ndata: {"type":"start","run":{"id":"abc"}}\n\ne',
    'vent: delta\ndata: {"type":"delta","text":"안녕"}\n\nevent: delta\ndata: {"type":"delta","text":"하세요"}\n\n',
    'event: done\ndata: {"type":"done","run":{"id":"abc","text":"안녕하세요"}}\n\n',
  ]);

  const seen = { text: '', ids: [] };
  await generateStream({ prompt: 'hi' }, {
    start: (event) => seen.ids.push(event.run.id),
    delta: (event) => { seen.text += event.text; },
    done: (event) => { seen.final = event.run.text; },
  });

  assert.deepEqual(seen.ids, ['abc']);
  assert.equal(seen.text, '안녕하세요');
  assert.equal(seen.final, '안녕하세요');
});

test('api errors surface the backend message and code', async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 409,
    json: async () => ({ error: { code: 'model_not_ready', message: '서빙이 준비되지 않았습니다.' } }),
  });

  await assert.rejects(listModels(), (error) => {
    assert.equal(error.code, 'model_not_ready');
    assert.equal(error.status, 409);
    assert.equal(error.message, '서빙이 준비되지 않았습니다.');
    return true;
  });
});

test('network failures are reported in Korean rather than as TypeError', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };

  await assert.rejects(listModels(), (error) => error.code === 'network_error');
});

