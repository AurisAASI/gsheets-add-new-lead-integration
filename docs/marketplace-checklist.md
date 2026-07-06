# Checklist — Google Workspace Marketplace

Use este checklist antes de submeter o add-on para revisão no Google Workspace Marketplace.

## 1. Google Cloud Project

- [ ] Criar ou selecionar um Google Cloud Project
- [ ] Vincular o projeto Apps Script PROD ao Cloud Project:
  - Editor Apps Script → **Configurações do projeto** → **Projeto do Google Cloud**
- [ ] Habilitar **Google Workspace Marketplace SDK** no Cloud Console

## 2. OAuth Consent Screen

- [ ] Configurar em [Google Cloud Console → APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
- [ ] Tipo de usuário: **Internal** (apenas domínio) ou **External** (público)
- [ ] Nome do app: `Lead Control - Novo Lead`
- [ ] E-mail de suporte do desenvolvedor
- [ ] Logo do app (120×120 px)
- [ ] **URL da política de privacidade** (obrigatório)
- [ ] **URL dos termos de serviço** (recomendado)
- [ ] Scopes declarados:
  - `spreadsheets.currentonly`
  - `script.scriptapp`
  - `script.external_request`
  - `script.send_mail`

## 3. Verificação de scopes

- [ ] Submeter scopes para verificação do Google (pode levar dias/semanas)
- [ ] Preparar vídeo demonstrando o uso de cada scope solicitado
- [ ] Documentar justificativa de cada scope na submissão

## 4. Listing no Marketplace

- [ ] Acessar [Google Cloud Console → Marketplace SDK](https://console.cloud.google.com/marketplace)
- [ ] Preencher informações do listing:
  - [ ] Nome: `Lead Control - Novo Lead`
  - [ ] Descrição curta (até 200 caracteres)
  - [ ] Descrição detalhada
  - [ ] Categoria: Productivity ou Business Tools
  - [ ] Ícone (128×128 e 32×32 px)
  - [ ] Screenshots (mínimo 1, recomendado 3-5)
  - [ ] URL de suporte
  - [ ] URL de documentação (pode apontar para `docs/configuration.md` hospedado)
- [ ] Tipo de instalação: **Individual** + **Domain install**
- [ ] Definir visibilidade: público ou restrito por domínio

## 5. Manifest do add-on

- [ ] `logoUrl` em `appsscript.json` aponta para URL HTTPS pública
- [ ] `addOns.common.name` definido
- [ ] `addOns.sheets.homepageTrigger.runFunction` = `onSheetsHomepage`
- [ ] `runtimeVersion` = `V8`
- [ ] `exceptionLogging` = `STACKDRIVER`

## 6. Test deployment

- [ ] Criar test deployment no editor Apps Script PROD
- [ ] Instalar em contas de teste (mínimo 2-3 usuários)
- [ ] Validar fluxo completo:
  - [ ] Instalação e autorização de scopes
  - [ ] Configuração via painel do add-on
  - [ ] Envio automático ao adicionar linha
  - [ ] Desativação da integração
  - [ ] Reautorização após update

## 7. Segurança e compliance

- [ ] Nenhuma credencial hardcoded no código-fonte
- [ ] API keys rotacionadas se expostas anteriormente
- [ ] Política de privacidade publicada e acessível
- [ ] Documentar quais dados são coletados e enviados à API Lead Control
- [ ] `.gitignore` inclui `.clasp.*.json` e `.clasprc.json`

## 8. Deploy final

- [ ] `npm run verify` passa sem erros
- [ ] `npm run deploy:prod` executado com sucesso
- [ ] Versão deployada testada em planilha real
- [ ] Submeter listing para revisão do Google

## 9. Pós-publicação

- [ ] Monitorar logs no Stackdriver
- [ ] Responder a reviews no Marketplace
- [ ] Manter política de privacidade atualizada
- [ ] Processo de update: `npm run deploy:prod` + nova submissão se scopes mudarem

## Links úteis

- [Publicar um add-on](https://developers.google.com/workspace/marketplace/how-to-publish)
- [Requisitos de verificação OAuth](https://support.google.com/cloud/answer/9110914)
- [Editor add-on triggers](https://developers.google.com/workspace/add-ons/concepts/editor-triggers)
- [clasp deploy guide](https://developers.google.com/apps-script/guides/clasp)
