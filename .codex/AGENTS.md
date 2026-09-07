# Global Development Harness

## Workflow

All non-trivial development follows:

PLAN -> EXECUTE -> VERIFY

Before making changes:
1. Read the project AGENTS.md.
2. Read docs/sot/SOT.md.
3. Read the relevant SPEC.
4. Read docs/handoff/HANDOFF.md if present.

## Rules

Only the execution phase may modify product source code.

Planning must identify:
- scope
- impacted files
- acceptance criteria
- tests
- risks

Execution must:
- follow SPEC
- use TDD when behavior changes
- make the smallest defensible change
- avoid unrelated refactoring

Verification must be independent from implementation and check:
- SPEC compliance
- tests
- lint/type checks
- build
- regression risk
- security impact when applicable

Do not treat agent memory as source of truth.

The repository SOT, SPEC, tests and Git history are authoritative.

Never commit secrets.

Ponytail may simplify implementation, but must never remove:
- acceptance criteria
- required tests
- security validation
- data-integrity handling
- required error handling
