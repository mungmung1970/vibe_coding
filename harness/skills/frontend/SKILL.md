---
name: frontend
description: Build or extend the reusable React + Vite + Node.js frontend template for screens, authentication, administration, model workbenches, and API-backed UI.
---

# Frontend Development

Use `harness/templates/frontend` as the baseline. It is the React/Node
generalization of `projects/model_test/src/frontend`; preserve the existing
image-derived visual language unless the user supplies a new reference.

## Structure

- `src/main.jsx`, `src/App.jsx`: application entry and composition.
- `src/components/`: shared visual primitives and layout.
- `src/features/`: user-facing feature slices such as auth, admin, and workbench.
- `src/services/`: API/auth/model adapters; components do not call `fetch` directly.
- `src/data/`: mock data, navigation, and API-shaped defaults.
- `src/styles/`: design tokens and component styles.
- `server/`: small Node.js API placeholder; replace with the project's backend contract.

Keep feature state and behavior inside its feature or service boundary. Keep
mock data replaceable by putting it in `src/data`; do not bake it into UI
components. Add shared components only when they have more than one real
consumer.

## Visual and access rules

Use the established charcoal sidebar, warm orange accent, white panels, pale
gray page background, compact radii, dense layout, and existing button
variants. Reuse existing CSS tokens/classes before adding a new variant.
Every interactive control needs an accessible name; icon-only buttons need
`aria-label`, and keyboard submission/focus behavior must remain usable.

The demo auth includes roles and menu permissions only as UI examples. Client
checks may hide or disable menus, but the Node/backend endpoint must enforce
authorization. Never ship demo credentials or an in-memory policy to
production.

## Check

Run `sh tests/smoke.sh` and `npm run build` from the template after installing
dependencies. For API changes, update the service adapter and its error
handling first, then connect the feature UI. Do not add a state library or UI
dependency when React state, context, and CSS already cover the requirement.
