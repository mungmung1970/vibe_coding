#!/usr/bin/env sh
# 구성 확인 + DOM 없는 단위 테스트 + 프로덕션 빌드.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

test -f package.json
test -f vite.config.js
test -f index.html
test -f src/main.jsx
test -f src/styles/index.css
test -f src/features/auth/AuthContext.jsx
test -f src/features/auth/LoginPage.jsx
test -f src/features/admin/AdminPage.jsx
test -f src/services/authService.js
test -f server/index.js
node -e "const p=require('./package.json'); if(!p.dependencies.react||!p.devDependencies.vite) process.exit(1)"
node --check server/index.js
node --check src/services/authService.js

find src -name '*.js' -print0 | xargs -0 -n1 node --check
node --test tests/*.test.js

if [ -d node_modules ]; then
  npm run build >/dev/null
  test -f dist/index.html
  echo 'react frontend smoke test: ok (build 포함)'
else
  echo 'react frontend smoke test: ok (npm install 후 build 확인 필요)'
fi
