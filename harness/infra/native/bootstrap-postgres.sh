#!/usr/bin/env bash
set -euo pipefail

PG_BIN=/opt/surromind/postgresql/18/bin
PGPASSWORD_FILE=/opt/surromind/etc/postgres.password
exec su -s /bin/bash surrodb -c "PGPASSWORD=\$(cat '$PGPASSWORD_FILE') $PG_BIN/psql -h 127.0.0.1 -U surrodb -d postgres -v ON_ERROR_STOP=1 -c \"CREATE EXTENSION IF NOT EXISTS vector; SELECT extversion FROM pg_extension WHERE extname = 'vector';\""
