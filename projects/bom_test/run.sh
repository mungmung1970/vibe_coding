#!/bin/sh
# 서버 기동: http://127.0.0.1:8090
cd "$(dirname "$0")/src/backend" && exec python3 -m app.main "$@"
