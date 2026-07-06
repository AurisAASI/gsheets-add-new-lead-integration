# OAuth — Tela "App não verificado"

## Por que aparece esse aviso?

Durante o desenvolvimento (test deployment), o Google exibe:

> **O Google não verificou este app**  
> Continue apenas se você entender os riscos...

Isso **não é um bug do código**. Acontece porque o app usa scopes sensíveis (planilhas, triggers, requisições externas, e-mail) e ainda **não passou pela verificação OAuth do Google**.

No ambiente DEV isso é **normal e esperado**.

## É possível remover em produção?

**Sim**, mas exige processo no Google Cloud — não basta mudar código ou fazer `clasp deploy`.

| Cenário | Aviso "não verificado" |
|---------|------------------------|
| DEV / test deployment (hoje) | Aparece — clique em "Avançado" → "Acessar (não seguro)" |
| PROD sem verificação OAuth | Continua aparecendo para todos os usuários |
| PROD com verificação OAuth aprovada | **Não aparece** (instalação padrão) |
| App **Internal** (só seu domínio Google Workspace) | Não precisa verificação pública, mas só usuários do domínio |

## Caminho para produção sem o aviso

### 1. Migrar para GCP gerenciado pelo usuário

No projeto Apps Script **PROD**:

1. [Google Cloud Console](https://console.cloud.google.com/) → criar projeto (ex.: `lead-control-addon-prod`)
2. Apps Script → **Configurações do projeto** → **Projeto do Google Cloud** → **Mudar projeto**
3. Selecione o projeto GCP criado

> Sem este passo, não é possível publicar no Marketplace.

### 2. Configurar OAuth Consent Screen

[Console → APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)

- **User type:** External (público) ou Internal (apenas sua organização)
- **App name:** Lead Control - Novo Lead
- **User support email:** seu e-mail de suporte
- **Developer contact:** e-mail do desenvolvedor
- **Logo:** 120×120 px
- **Privacy policy URL:** obrigatório (página HTTPS pública)
- **Terms of service URL:** recomendado

### 3. Declarar e justificar os scopes

Scopes usados por este add-on:

| Scope | Motivo |
|-------|--------|
| `spreadsheets.currentonly` | Ler dados da planilha aberta para mapear leads |
| `script.scriptapp` | Criar trigger installable `onChange` |
| `script.external_request` | POST para API Lead Control |
| `script.send_mail` | E-mail de alerta quando reautorização é necessária |

### 4. Submeter para verificação OAuth

[Google Cloud → Verification Center](https://console.cloud.google.com/apis/credentials/consent)

Envie:

- Vídeo demonstrando cada permissão em uso
- Explicação do fluxo (planilha → add-on → API Lead Control)
- URL da política de privacidade
- Domínio verificado (se aplicável)

**Prazo:** dias a semanas, dependendo dos scopes.

### 5. Publicar no Google Workspace Marketplace

Após OAuth aprovado:

1. Habilitar **Google Workspace Marketplace SDK** no GCP
2. Criar listing no Marketplace
3. Vincular ao projeto Apps Script PROD
4. Submeter para revisão do Marketplace

Usuários que instalam pelo Marketplace verão o fluxo OAuth **sem** o aviso de app não verificado.

## Atalho durante o desenvolvimento (antes da verificação)

Enquanto o app está em modo **Testing** no OAuth Consent Screen:

1. GCP Console → OAuth consent screen → **Test users**
2. Adicione os e-mails que vão testar (ex.: `acsenrafilho@gmail.com`, colegas)
3. Usuários de teste autorizados veem fluxo simplificado (ainda pode haver aviso leve, mas sem bloqueio)

Limite: até **100 usuários de teste** antes da verificação formal.

## O que NÃO resolve o problema

| Ação | Resolve? |
|------|----------|
| `npm run push:prod` | Não |
| `clasp deploy` | Não |
| Mudar nome do add-on no manifest | Não |
| Usar HTTPS no endpoint da API | Não |
| Test deployment no projeto DEV | Não (sempre mostra aviso para não-test-users) |

## Checklist resumido

- [ ] Projeto PROD vinculado a GCP gerenciado pelo usuário
- [ ] OAuth Consent Screen completo (nome, logo, privacy policy)
- [ ] Scopes declarados e justificados
- [ ] Verificação OAuth submetida e **aprovada**
- [ ] Listing no Marketplace publicado
- [ ] `npm run deploy:prod` com versão final

## Links oficiais

- [OAuth verification FAQ](https://support.google.com/cloud/answer/9110914)
- [Publish a Google Workspace Marketplace app](https://developers.google.com/workspace/marketplace/how-to-publish)
- [OAuth consent screen configuration](https://developers.google.com/workspace/guides/configure-oauth-consent)
