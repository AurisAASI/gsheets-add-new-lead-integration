# Lead Control — Google Sheets Add-on

Google Workspace Add-on para Planilhas que envia automaticamente novos leads para a API [Lead Control](https://github.com/AurisAASI/gsheets-add-new-lead-integration) quando linhas são adicionadas à planilha por integrações de tráfego pago (Meta Lead Ads, Google Ads, Zapier, Make, etc.).

## Funcionalidades

- Configuração via painel do add-on (API Endpoint, API Key, Company ID, nome da aba)
- Detecção automática de novas linhas via trigger `onChange` (compatível com integrações via API)
- Mapeamento de colunas da planilha para o payload da API Lead Control
- Ambientes de desenvolvimento e produção separados (clasp)
- Documentação completa em [`docs/`](docs/README.md)

## Início rápido

```bash
npm install
clasp login
cp .clasp.dev.json.example .clasp.dev.json   # preencher scriptId
npm run verify
npm run push:dev
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run build` | Compila TypeScript para `dist/` |
| `npm run verify` | Build + verificação de exports |
| `npm run push:dev` | Deploy para ambiente de desenvolvimento |
| `npm run push:prod` | Deploy para ambiente de produção |
| `npm run deploy:prod` | Push + versionamento para Marketplace |

## Documentação

- [Arquitetura](docs/architecture.md)
- [Desenvolvimento](docs/development.md)
- [Produção e Marketplace](docs/production.md)
- [Configuração (usuário final)](docs/configuration.md)
- [Contrato da API](docs/api-contract.md)
- [Contexto para IA](docs/ai-context.md)

## Estrutura

```
src/           → Código-fonte TypeScript
dist/          → Bundle compilado (enviado ao Apps Script via clasp)
docs/          → Documentação
scripts/       → Build, verificação e setup
```

## Licença

MIT — ver [LICENSE](LICENSE)
