#!/usr/bin/env sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test -f "$root/package.json"
test -f "$root/src/main.jsx"
test -f "$root/src/features/auth/AuthContext.jsx"
test -f "$root/src/features/admin/AdminPage.jsx"
test -f "$root/src/features/workbench/ComparePage.jsx"
node --check "$root/server/index.js"
node -e "const p=JSON.parse(require('fs').readFileSync(process.argv[1])); if(!p.dependencies.react || !p.devDependencies.vite) process.exit(1)" "$root/package.json"
echo 'react/node frontend template smoke test: ok'
