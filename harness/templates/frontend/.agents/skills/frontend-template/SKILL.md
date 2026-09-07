---
name: frontend-template
description: Build React + Node.js frontend screens using the repository's image-referenced LLM Lab visual system, authentication, menu permissions, and the proven screen rules.
---

# Frontend template

Use the template as a React + Vite browser baseline with a small Node.js API placeholder. Keep presentation in `src/styles`, reusable UI in `src/components`, auth/admin/workbench behavior in `src/features`, sample or API-shaped data in `src/data`, external calls in `src/services`, and display-only pure functions in `src/utils`.

## Visual language

- Use the image-derived tokens: charcoal sidebar (`#191a1f`), orange-brown accent (`#d65d39`), warm accent border (`#8d402b`), white panels, pale gray page background, and compact 4–6px radii.
- Keep the layout dense: 44px top bar, narrow left control rail, bordered white work panels, orange panel headers.
- Prefer existing `.btn`, `.btn-primary`, `.btn-secondary`, and `.btn-danger` classes. Add a new variant only when its semantic state cannot use these.

## Screen rules (already implemented — keep them)

These came from production use; do not undo them without a reason.

- Top-right shows the **login ID** (`anonymous` before sign-in), not just a name.
- Top tabs are **rectangles with rounded corners and equal width**; command buttons share one width (116px).
- Every sidebar box collapses via `SideSection`.
- Sidebar and content scroll **independently**; the window itself does not scroll.
- Sliders are 3px tall; scrollbars are 7px.
- Results open as **Chrome-style tabs with a close ×**.
- A card's **× hides** it; **right-click deletes**. Never make × destructive.
- Answers are saved **only when the save button is pressed**.
- Changing the prompt **clears the previous answer**.
- Model names carry `(LLM)`/`(VLM)` and the sidebar filters by that type.
- Answer comparison takes a **reference answer** and a **judge model**, and shows a **rank table**. Compute rank from the judge's scores in the UI — a model's own ordering can contradict its scores.

## Architecture

Use React state/context for local UI state. Replace `src/services/modelService.js` and `authService.js` with real API adapters; do not mix fetch logic into components. Keep mock data in `src/data` so it can be deleted without touching UI structure.

The auth example has `admin`, `operator`, and `viewer` roles with per-menu `read/manage` permissions. Client-side checks only hide or disable UI; every Node API route must enforce the same permission server-side. Never ship the demo credentials or in-memory policy to production.

`@vitejs/plugin-react` must stay in `devDependencies` and in `vite.config.js` — without it the JSX build fails at runtime with `React is not defined`.

## Check

Run `sh tests/smoke.sh` from this directory after non-trivial changes; it builds when `node_modules` exists. Add accessibility labels to icon-only controls and preserve keyboard submission behavior.
