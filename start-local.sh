#!/bin/sh
# Inicia o Card Campaign em http://localhost:4173 (runtime-offline-threejs.md §1.7).
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Este jogo precisa do Node.js 20 ou mais recente instalado."
  echo "Veja o arquivo LEIA-ME.txt para instruções. Nada será baixado automaticamente."
  echo ""
  exit 1
fi
cd "$(dirname "$0")" || exit 1
exec node runner/server.mjs "$@"
