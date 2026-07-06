# Produção

## Ambientes

| Ambiente | Arquivo clasp | Projeto Apps Script |
|----------|---------------|---------------------|
| DEV | `.clasp.dev.json` | Lead Control Add-on [DEV] |
| PROD | `.clasp.prod.json` | Lead Control Add-on [PROD] |

Os `scriptId` ficam nos arquivos locais `.clasp.*.json` (não commitados). Os templates `.clasp.*.json.example` documentam o formato.

## Deploy para produção

```bash
npm run deploy:prod
```

Este comando:
1. Compila o código (`npm run build`)
2. Faz push para o projeto PROD (`clasp push`)
3. Cria uma nova versão implantada (`clasp deploy`)

**Importante:** `clasp push` atualiza apenas `@HEAD`. Usuários do Marketplace veem a versão de um **`clasp deploy`**. Sempre execute deploy após push em produção.

### Versionamento manual

```bash
npm run push:prod
clasp -P .clasp.prod.json version "Descrição da versão"
clasp -P .clasp.prod.json deploy --description "v1.0.0 - descrição"
```

## CI/CD com GitHub Actions

O workflow em [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) separa deploy por branch:

| Branch | Job | Ação |
|--------|-----|------|
| `develop` | `deploy-dev` | `clasp push` no projeto DEV |
| `main` | `deploy-prod` | `clasp push` + `clasp deploy` no projeto PROD |

Fluxo recomendado: feature → PR para `develop` → testes em DEV → PR `develop` → `main` → aprovação → PROD.

### Secrets necessários

| Secret | Descrição |
|--------|-----------|
| `CLASPRC_JSON` | Conteúdo de `~/.clasprc.json` (credenciais OAuth do clasp) |
| `CLASP_JSON_DEV` | Conteúdo de `.clasp.dev.json` (scriptId do projeto DEV) |
| `CLASP_JSON_PROD` | Conteúdo de `.clasp.prod.json` (scriptId do projeto PROD) |

### Configurar secrets

```bash
# Gerar CLASPRC_JSON (na máquina com clasp login)
cat ~/.clasprc.json

# Gerar CLASP_JSON_DEV
cat .clasp.dev.json

# Gerar CLASP_JSON_PROD
cat .clasp.prod.json
```

Cole os valores em **GitHub → Settings → Secrets and variables → Actions**.

### Environment de produção (aprovação manual)

Para evitar deploy acidental em PROD, configure um GitHub Environment:

1. **GitHub → Settings → Environments → New environment** → nome: `production`
2. Ative **Required reviewers** (pelo menos 1 pessoa da equipa)
3. Opcional: restrinja deploys apenas à branch `main`

O job `deploy-prod` usa `environment: production`. Após merge em `main`, o workflow pausa até um revisor aprovar no GitHub Actions.

## Google Workspace Marketplace

Consulte [marketplace-checklist.md](./marketplace-checklist.md) para o checklist completo de publicação.

### Tela "App não verificado" no OAuth

Durante o DEV, o Google exibe *"O Google não verificou este app"*. Isso é esperado.

Para **remover o aviso em produção**, é necessário passar pela **verificação OAuth do Google** e publicar via Marketplace — não é corrigível apenas com deploy de código.

Guia completo: [oauth-verification.md](./oauth-verification.md)

### Resumo do processo

1. Vincular projeto Apps Script PROD a um Google Cloud Project
2. Configurar OAuth Consent Screen
3. Criar listing no Marketplace SDK
4. Submeter para revisão do Google
5. Após aprovação, publicar

### Test deployment

Antes da revisão oficial, use **Test deployments** no editor Apps Script para instalar o add-on em contas de teste sem publicar no Marketplace.

## Segurança em produção

- **Nunca** commitar `.clasp.dev.json`, `.clasp.prod.json` ou `.clasprc.json`
- **Nunca** hardcodar API keys no código — apenas DocumentProperties
- Rotacionar API keys expostas acidentalmente
- Usar endpoint de produção apenas no ambiente PROD

## Rollback

```bash
# Listar implantações
clasp -P .clasp.prod.json deployments

# Reimplantar versão anterior
clasp -P .clasp.prod.json redeploy <deploymentId> <versionNumber> "Rollback"
```

## Monitoramento

- **Stackdriver**: logs automáticos via `exceptionLogging: STACKDRIVER` no manifest
- **Execuções**: editor Apps Script → Execuções
- **Toasts**: feedback visual na planilha para o usuário final
