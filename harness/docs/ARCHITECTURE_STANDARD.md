# Architecture Standard

## Layers

Use one direction of dependency:

```text
HTTP routes -> domain services -> integrations/storage
React features/components -> state/context -> service adapters -> API
```

Routes validate and translate requests. Services own domain behavior and external integrations. The frontend keeps rendering in components, feature workflows in `features`, shared state in `state`, and all network calls in `services`.

## Two supported model modes

- **Provider mode (`model_test_pc`)** calls registered OpenAI-compatible or Anthropic endpoints. It does not start a model process or require GPU/vLLM.
- **Serving mode (`model_test`)** keeps the single-model vLLM lifecycle in `ServingManager` and `engines.py`. Remote provider support is additive and must still pass through the manager's explicit active-model contract.

Shared UI contracts include model metadata, modality filtering, parameter schemas, SSE events, saved runs, and comparison. Serving state, provider credentials, and media/document services remain product-specific boundaries.

## Templates

The frontend template starts with mock data but contains the same API/SSE adapter boundary as the PC project. Set `MODEL_TEST_API_BASE` to enable the real adapter; remove `src/data/sample.js` only after the target backend and auth contract are ready. The backend template remains standard-library based and must not gain provider SDK or vLLM dependencies by default.
