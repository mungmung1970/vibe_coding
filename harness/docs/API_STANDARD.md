# API Standard

## Boundary

- Browser components never call `fetch` directly. All HTTP and SSE traffic goes through a service adapter (`src/services/api.js`).
- Version routes under `/api/v1` and keep errors in the shape `{"error": {"code", "message", "details"}}`.
- Validate request bodies at the HTTP boundary and do not expose API keys, provider headers, or raw provider error payloads.

## Model workbench contract

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/models?modality=` | Models, providers, and discovered modalities |
| `GET` | `/api/v1/parameters?model_id=` | Provider/model-specific parameter schema |
| `POST` | `/api/v1/generate` | JSON or SSE generation; clients send an explicit `model_id` |
| `GET` | `/api/v1/runs` | Saved result history and filters |
| `POST` | `/api/v1/runs` | Save a completed result; generation does not auto-save |
| `POST` | `/api/v1/runs/compare` | Compare runs and optionally request judge scoring |

The local-serving project also exposes `/serving` and `/serving/logs`. Those routes are an implementation boundary for vLLM and must not be added to the PC provider-only project.

## Streaming

SSE events are JSON records in `data:` lines. The normal order is `start`, zero or more `reasoning`/`delta`, then `done`; failures use `error`. The client must tolerate records split across network chunks and must support cancellation with `AbortController`.

## Optional capabilities

Document parsing (`POST /documents/parse`) and media routes (`/media/transcribe`, `/media/speak`, `/media/video`) are opt-in application capabilities. They require matching registry metadata, backend services, frontend controls, and focused tests; do not advertise them from a template that has not implemented the routes.
