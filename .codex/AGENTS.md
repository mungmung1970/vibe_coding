# Global Development Harness

## Workflow

All non-trivial development follows:

PLAN -> EXECUTE -> VERIFY

For coding tasks, apply the loop described in `harness/docs/LOOP_ENGINEERING.md`:
repeat implementation and verification when checks fail, then commit and push
only after all required checks pass.

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

## Commit and push gate

- Do not commit or push while tests, build, lint, or security checks fail.
- Before committing, inspect `git diff`, `git status`, ignored files, and likely secrets.
- Push only the current branch's intended changes to its configured remote.
- Stop instead of pushing on authentication failure, merge conflict, unrelated changes,
  secrets, unexpected large files, destructive operations, or an unclear target.
- Web authentication may be completed once before the loop; never put credentials or
  tokens in source files, environment examples, commits, or logs.

Ponytail may simplify implementation, but must never remove:
- acceptance criteria
- required tests
- security validation
- data-integrity handling
- required error handling
