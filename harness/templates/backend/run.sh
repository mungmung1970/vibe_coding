#!/usr/bin/env sh
# Starts the console (API + frontend) on http://127.0.0.1:8080 by default.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$root"
exec python3 -m app.main "$@"
