# Test Standard

## Required checks

- Backend: `python3 -m unittest discover -s tests -t .`
- Frontend: `sh tests/smoke.sh` and `npm run build` when dependencies are installed
- API adapters: test error mapping, network failures, SSE records split across chunks, and request cancellation behavior

## Contract coverage

Every non-trivial route or service branch needs a focused test. Model registries must cover modality and provider metadata. Generation tests must prove that results are not persisted until the save endpoint is called. Serving projects must cover start, ready, switch, stop, and failure states; provider-only projects must prove that no serving endpoint is exposed.

Document and media features are not considered complete until invalid type, size limit, provider failure, and successful response paths are covered without requiring a live external provider.

## Browser verification

After UI changes, verify keyboard submission, independent sidebar/content scrolling, accessible names for icon-only controls, modality filtering, streaming completion, save behavior, and comparison states in a real browser or the project's smoke harness.
