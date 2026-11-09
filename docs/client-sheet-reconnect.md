# Religação — planilha meta-leads-ph

Sheet ID: `1r6aA8ADSxLhoRKgwGPQzqwue2CdWkgECwrQnnAqFcxU`  
Nome: `meta-leads-ph`  
Abas: `meta-leads` (fonte, ~520 linhas) · `Lead Control - Histórico`

## Status (2026-11-09)

| Etapa | Estado |
|-------|--------|
| Código robusto no repo | Feito |
| `npm run push:dev` | Feito (9:50) — pull de volta confirma `OTHER`, `settledThrough`, `onHourlySweep`, `handleReprocessUnsent` |
| Histórico na planilha | Ainda **1** linha (origem **Teste**, HTTP 201, endpoint **prod**) — automático não rodou com o código novo |
| Abrir add-on / Salvar e ativar / Reprocessar 50 | **Pendente** — exige sessão de **editor logado** na planilha |

O agente abriu a planilha no browser sem login (`Fazer login` visível; “Ver complementos do documento” desabilitado). Não dá para clicar no painel Lead Control daqui.

## DEV vs Marketplace (importante)

- `push:dev` atualiza só o projeto Apps Script **DEV** (`scriptId` em `.clasp.dev.json`).
- Clientes com o add-on do **Marketplace** continuam na versão **PROD** até merge em `main` + `clasp deploy` / CI com aprovação.
- Endpoint `w23kw2bfok.../prod` no histórico só diz que a **API key/URL** são de produção; **não** prova qual implantação do add-on está instalada.

Para validar o código novo **agora** nesta planilha:

1. `npm run open:dev` → no editor Apps Script: **Implantar → Implantações de teste → Instalar** (conta de teste).
2. Abrir a planilha **logado** com essa conta.
3. Abrir o add-on pela **barra lateral** (Workspace Add-on; não é o menu Complementos clássico).

Para a planilha do cliente em produção de verdade: PR `develop` → `main` + aprovação do environment prod (não contornar).

## Mapeamento obrigatório nesta planilha

Cabeçalhos Meta (não são `nome`/`telefone`/`fonte`):

| Campo Lead Control | Coluna |
|--------------------|--------|
| Nome completo | `full name` |
| Telefone | `phone` |
| Cidade | `cidade` |
| Fonte | `campaign_name` (ou `form_name` / `ad_name`) |
| E-mail | `email` (opcional) |
| Status | **não mapear** (`lead_status` da Meta não é canônico) |

Aba para sincronizar: **`meta-leads`**.

## Depois que o painel abrir (conta com a versão nova)

1. Conferir URL/API key/company ID (já devem estar; **não** colar a key em chat).
2. Aplicar o mapeamento acima → **Salvar e ativar** (recria `onChangeHandler` + `onHourlySweep`).
3. Em Apps Script → Triggers: devem existir `onChangeHandler` e `onHourlySweep`.
4. **Reprocessar não enviados (50)** → Sucesso/Duplicado no histórico; telefone já no LC não cria segundo lead.
5. Critério: nova linha completa via API entra em &lt; ~30s; nas Execuções deve aparecer `changeType=OTHER`.

**Não** copiar nem colar a API key em issues, chats ou commits.
