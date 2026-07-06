# Documentação — Lead Control Google Sheets Add-on

Índice da documentação do projeto.

## Visão geral

Add-on do Google Workspace para Planilhas que envia automaticamente novos leads para a API Lead Control quando linhas são adicionadas à planilha (via integrações de tráfego pago, Zapier, Make, etc.).

## Documentos

| Documento | Descrição |
|-----------|-----------|
| [architecture.md](./architecture.md) | Arquitetura, fluxo de dados e módulos |
| [development.md](./development.md) | Setup local, clasp, build e testes |
| [production.md](./production.md) | Deploy, versionamento, CI/CD e Marketplace |
| [configuration.md](./configuration.md) | Guia para o usuário final configurar o add-on |
| [api-contract.md](./api-contract.md) | Contrato da API Lead Control |
| [ai-context.md](./ai-context.md) | Contexto estruturado para assistentes de IA |
| [marketplace-checklist.md](./marketplace-checklist.md) | Checklist de publicação no Google Workspace Marketplace |

## Links rápidos

- Projeto DEV: `npm run open:dev`
- Projeto PROD: `npm run open:prod`
- Build + verificação: `npm run verify`
- Push dev: `npm run push:dev`
- Deploy prod: `npm run deploy:prod`
