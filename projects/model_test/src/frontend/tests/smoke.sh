#!/usr/bin/env sh
# Parses every module and runs the DOM-free unit tests.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

test -f "$root/index.html"
test -f "$root/src/main.js"
test -f "$root/src/styles/index.css"

find "$root/src" -name '*.js' -print0 | xargs -0 -n1 node --check
node --test "$root/tests/"*.test.js

echo 'frontend smoke test: ok'
