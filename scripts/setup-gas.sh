#!/usr/bin/env bash
# Cria ou reconfigura os projetos Apps Script dev e prod.
# Pré-requisitos: clasp login, npm install, npm run build
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build

if [[ ! -f .clasp.dev.json ]]; then
  echo "Criando projeto DEV..."
  clasp create --title "Lead Control Add-on [DEV]" --rootDir dist
  cp .clasp.json .clasp.dev.json
  npm run build
fi

if [[ ! -f .clasp.prod.json ]]; then
  echo "Criando projeto PROD..."
  rm -f .clasp.json
  clasp create --title "Lead Control Add-on [PROD]" --rootDir dist
  cp .clasp.json .clasp.prod.json
  npm run build
fi

echo "Projetos configurados:"
echo "  DEV:  $(jq -r .scriptId .clasp.dev.json)"
echo "  PROD: $(jq -r .scriptId .clasp.prod.json)"
echo ""
echo "Próximos passos:"
echo "  npm run push:dev"
echo "  npm run push:prod"
