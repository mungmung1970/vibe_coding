#!/usr/bin/env sh
# 구성 확인 + (의존성이 설치되어 있으면) 프로덕션 빌드까지.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

test -f package.json
test -f vite.config.js
test -f src/main.jsx
test -f src/features/auth/AuthContext.jsx
test -f src/features/admin/AdminPage.jsx
test -f src/features/workbench/ComparePage.jsx
test -f src/components/SideSection.jsx
test -f src/components/CompareDialog.jsx
node --check server/index.js
node --check src/utils/format.js
node --check src/services/modelService.js

# JSX 자동 런타임 플러그인이 없으면 빌드 산출물이 'React is not defined'로 죽는다.
node -e "const p=require('./package.json');
  if(!p.dependencies.react || !p.devDependencies.vite) process.exit(1);
  if(!p.devDependencies['@vitejs/plugin-react']) { console.error('missing @vitejs/plugin-react'); process.exit(1); }"
grep -q "plugins: \[react()\]" vite.config.js

if [ -d node_modules ]; then
  npm run build >/dev/null
  test -f dist/index.html
  echo 'react/node frontend template smoke test: ok (build 포함)'
else
  echo 'react/node frontend template smoke test: ok (npm install 후 build 확인 필요)'
fi
