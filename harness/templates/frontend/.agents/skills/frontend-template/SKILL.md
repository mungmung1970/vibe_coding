---
name: frontend-template
description: Build React + Node.js frontend screens using the repository's image-referenced LLM Lab visual system, authentication, and menu permissions.
---

# Frontend template

Use the template as a React + Vite browser baseline with a small Node.js API placeholder. Keep presentation in `src/styles`, reusable UI in `src/components`, auth/admin/workbench behavior in `src/features`, sample or API-shaped data in `src/data`, and external calls in `src/services`.

## Visual language

- Use the image-derived tokens: charcoal sidebar (`#191a1f`), orange-brown accent (`#d65d39`), warm accent border (`#8d402b`), white panels, pale gray page background, and compact 4–6px radii.
- Keep the layout dense: 44px top bar, narrow left control rail, bordered white work panels, orange panel headers, tab-style navigation, and small outlined utility buttons.
- Prefer existing `.btn`, `.btn-primary`, `.btn-secondary`, and `.btn-danger` classes. Add a new variant only when its semantic state cannot use these.

## Architecture

Use React state/context for local UI state. Replace `src/services/modelService.js` and `src/services/authService.js` with Node API adapters when the backend exists; do not mix fetch logic into components. Keep mock data in `src/data` so it can be removed without changing UI structure.

The auth example has `admin`, `operator`, and `viewer` roles with per-menu `read/manage` permissions. Client-side checks only hide or disable UI; every Node API route must enforce the same permission server-side. Never ship the demo credentials or in-memory policy to production.

## Check

Run `sh tests/smoke.sh` from this directory after non-trivial changes, then `npm run build` after dependencies are installed. Add accessibility labels to icon-only controls and preserve keyboard submission behavior.
