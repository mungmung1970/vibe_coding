---
name: backend
description: Build or extend the reusable Python backend template when API routing, service boundaries, model serving, persistence, or frontend delivery are involved.
---

# Backend Development

Use `harness/templates/backend` as the baseline for new projects. It mirrors
`projects/model_test/src/backend` and intentionally uses the Python standard
library so the starter runs before a dependency manager is introduced.

## Structure

- `app/main.py`: composition root, process lifecycle, and server startup.
- `app/api/`: HTTP routes only; validate input and delegate work.
- `app/core/`: transport primitives and shared error mapping.
- `app/services/`: model registry, inference, serving lifecycle, history, and secrets.
- `app/data/`: static, versioned catalogs such as parameter definitions.
- `tests/`: API and service-level regression tests.

Keep domain logic out of route handlers. Add a service only when behavior has
more than one caller or has its own lifecycle/state. Keep persistence and
external integrations behind a service boundary so they can later be replaced
without changing the API contract.

## Runtime

`run.sh` starts `python3 -m app.main`. Configuration is read from `APP_*`
environment variables; secrets belong in an ignored `var/secrets.env` file.
The default paths assume the project layout `src/backend`, `src/frontend`,
`models`, and `var`. Override paths with environment variables rather than
hard-coding project-specific locations.

The HTTP layer supports JSON, static frontend files, and SSE. Preserve the
existing JSON error shape and `/api/v1` versioning when extending routes.
Validate request bodies at the trust boundary and never log API keys or raw
provider errors. Add one focused test for each non-trivial branch or service
change; run the project's existing test command before handoff.

For database, cache, search, or observability integrations, add a focused
adapter/service and read `harness/infra` connection examples. Do not couple
the template directly to Docker, a provider SDK, or a model engine unless the
project explicitly requires it.
