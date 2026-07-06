# Desenvolvimento

## Pré-requisitos

- Node.js 20+
- [clasp](https://github.com/google/clasp) 3.x (`npm install -g @google/clasp` ou use o do projeto)
- Conta Google com Apps Script API habilitada em [script.google.com/home/usersettings](https://script.google.com/home/usersettings)
- `clasp login` executado na máquina local

## Setup inicial

```bash
git clone <repo-url>
cd gsheets-add-new-lead-integration
npm install
clasp login
```

### Criar projetos Apps Script (primeira vez)

Os arquivos `.clasp.dev.json` e `.clasp.prod.json` são locais (gitignored). Use os templates:

```bash
cp .clasp.dev.json.example .clasp.dev.json
cp .clasp.prod.json.example .clasp.prod.json
```

Ou execute o script de setup (cria projetos se ainda não existirem):

```bash
chmod +x scripts/setup-gas.sh
./scripts/setup-gas.sh
```

Preencha os `scriptId` nos arquivos `.clasp.*.json` com os IDs dos projetos criados.

## Comandos npm

| Comando | Descrição |
|---------|-----------|
| `npm run build` | Compila TypeScript → `dist/Code.js` + copia manifest |
| `npm run typecheck` | Verificação de tipos sem emitir arquivos |
| `npm run lint` | ESLint nos arquivos `src/` |
| `npm run verify` | Build + verifica funções exportadas no bundle |
| `npm run push:dev` | Build + push para projeto DEV |
| `npm run push:prod` | Build + push para projeto PROD |
| `npm run deploy:prod` | Push prod + `clasp deploy` (versão publicável) |
| `npm run open:dev` | Abre o editor Apps Script DEV no navegador (`clasp open-script`) |
| `npm run open:prod` | Abre o editor Apps Script PROD no navegador (`clasp open-script`) |
| `npm run logs:dev` | Logs em tempo real do projeto DEV |

## Ciclo de desenvolvimento

### Local (antes do merge)

1. Edite arquivos em `src/`
2. `npm run verify` — valida build localmente
3. `npm run push:dev` — envia para o projeto DEV (opcional; o CI também faz deploy em `develop`)
4. Teste na planilha vinculada ao projeto DEV

### Via CI (recomendado)

1. Abra PR da feature branch para `develop`
2. Após merge em `develop`, o CI publica automaticamente no Apps Script DEV
3. Teste na planilha DEV (`npm run logs:dev` para acompanhar logs)
4. Quando estável, abra PR de `develop` → `main`
5. Após merge em `main` e aprovação no GitHub Environment `production`, o CI publica em PROD

## Planilha de teste

Crie uma planilha Google com a aba `Base Dados` (ou o nome configurado) e os cabeçalhos:

| nome | telefone | cidade | email | fonte | status |
|------|----------|--------|-------|-------|--------|

### Instalar o add-on em modo teste

1. Abra o projeto DEV: `npm run open:dev`
2. Em **Implantar** → **Testar implantações**, crie uma implantação de teste
3. Instale o add-on na planilha de teste via link de test deployment
4. Abra o painel do add-on (Extensões → Lead Control)
5. Preencha API Endpoint, API Key e Company ID
6. Clique em **Salvar e ativar**

### Simular integração automática

O trigger `onChange` dispara com append via API. Para testar sem integração real:

- **Opção A:** Adicione uma nova linha manualmente na última posição (simula append)
- **Opção B:** Use Zapier/Make em modo teste apontando para a planilha dev
- **Opção C:** Use o botão **Testar envio (última linha)** no painel do add-on

### Checklist de testes manuais

- [ ] Salvar configuração ativa o trigger
- [ ] Linhas históricas não são reenviadas ao ativar
- [ ] Nova linha com dados completos dispara POST
- [ ] Linha com campos obrigatórios ausentes é ignorada (log + toast de aviso)
- [ ] Desativar integração para o envio
- [ ] Reprocessar última linha funciona para debug
- [ ] Logs visíveis via `npm run logs:dev`

## Debugging

### Logs

O add-on registra mensagens padronizadas via `console.log` / `console.warn` / `console.error`, visíveis no Stackdriver e no histórico de execuções do Apps Script.

**Formato:**

```
[LeadControl][contexto] mensagem
```

**Contextos:**

| Contexto | Onde aparece |
|----------|--------------|
| `onChange` | Trigger automático — início, processamento de linhas, resumo do lote |
| `api` | Envio HTTP para o Lead Control (sucesso, HTTP erro, falha de rede) |
| `trigger` | Criação/remoção de triggers e reautorização |
| `config` | Problemas na configuração persistida (ex.: JSON corrompido) |
| `ui` | Ações manuais no painel (salvar, desativar, testar, reprocessar) |
| `install` | Instalação do add-on (`onInstall`) |

**Onde ver:**

```bash
npm run logs:dev
```

Ou no editor Apps Script: **Execuções** → selecione uma execução → abra os logs.

**Exemplos:**

Execução bem-sucedida:

```
[LeadControl][onChange] Iniciado | changeType=INSERT_ROW | enabled=true | aba=Base Dados
[LeadControl][onChange] Processando linhas | aba=Base Dados | startRow=5 | lastRow=5 | lastProcessedRow=4
[LeadControl][api] Enviando lead | linha=5 | nome=João Silva | endpoint=api.leadcontrol.ia.br
[LeadControl][api] Lead enviado | linha=5 | status=201
[LeadControl][onChange] Lote concluído | enviados=1 | ignorados=0 | erros=0 | atéLinha=5
[LeadControl][onChange] Concluído | enviados=1 | ignorados=0 | erros=0 | atéLinha=5
```

Execução com erro de API:

```
[LeadControl][api] Falha HTTP | linha=7 | status=401 | Unauthorized
[LeadControl][onChange] Erros no lote | Linha 7: Erro 401: Unauthorized
[LeadControl][onChange] Concluído | enviados=0 | ignorados=0 | erros=1 | atéLinha=7
```

**Segurança:** credenciais (`apiKey`) e payload completo nunca são logados. O endpoint aparece apenas como host.

### Problemas comuns

| Problema | Solução |
|----------|---------|
| `Skipping push` no clasp | Use `clasp -P .clasp.dev.json push --force` |
| Trigger não dispara | Verifique se integração está ativa e trigger existe em **Acionadores** |
| onEdit não funciona com Zapier | Esperado — use onChange (já implementado) |
| 401 na API | Verifique API Key e endpoint |
| Reautorização necessária | Abra o add-on pelo menu Extensões e autorize novamente |

## Estrutura de branches

- `develop` — integração de features; push dispara deploy automático para DEV
- `main` — código estável; push dispara deploy para PROD (com aprovação no Environment `production`)
- feature branches — `feature/nome-da-feature` → PR para `develop`
