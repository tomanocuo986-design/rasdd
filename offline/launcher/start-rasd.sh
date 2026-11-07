#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required. Install the LTS from https://nodejs.org"
  exit 1
fi
exec node start.mjs "$@"
