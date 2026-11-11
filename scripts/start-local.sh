#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo 'Docker non è installato in WSL.' >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo 'Avvio Docker in WSL (potrebbe essere richiesta la password sudo)...'
  sudo service docker start
fi

if ! command -v npm >/dev/null 2>&1; then
  echo 'Node.js e npm non sono installati in WSL.' >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi

exec npm run dev:full
