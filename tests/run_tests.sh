#!/usr/bin/env bash
# Tests de "¿Cómo llego al Teatro?": lógica JS + sintaxis + humo HTTP.
# Uso: bash tests/run_tests.sh   (desde cualquier lado)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

FALLA=0

echo "== 1/3 Sintaxis JS =="
node --check app.js && echo "ok - app.js" || FALLA=1
node --check config.js && echo "ok - config.js" || FALLA=1

echo "== 2/3 Tests de lógica =="
node tests/test_app.js || FALLA=1

echo "== 3/3 Humo HTTP (assets servibles) =="
PUERTO=8123
python3 -m http.server "$PUERTO" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
sleep 0.7
for archivo in index.html app.js config.js style.css; do
  codigo=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PUERTO/$archivo")
  if [ "$codigo" = "200" ]; then
    echo "ok - GET /$archivo -> 200"
  else
    echo "FALLA - GET /$archivo -> $codigo"
    FALLA=1
  fi
done
kill $SERVER_PID 2>/dev/null || true
trap - EXIT

if [ "$FALLA" = "0" ]; then
  echo "== TODO VERDE =="
else
  echo "== HAY FALLAS =="
fi
exit "$FALLA"
