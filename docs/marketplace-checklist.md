# Checklist — Google Workspace Marketplace

Use este checklist antes de submeter o add-on para revisão no Google Workspace Marketplace.

## 1. Google Cloud Project

- [ ] Criar ou selecionar um Google Cloud Project
- [ ] Vincular o projeto Apps Script PROD ao Cloud Project:
  - Editor Apps Script → **Configurações do projeto** → **Projeto do Google Cloud**
- [ ] Habilitar **Google Workspace Marketplace SDK** no Cloud Console

## 2. OAuth Consent Screen

> **Aviso "App não verificado":** normal no DEV. Para produção sem esse aviso, veja [oauth-verification.md](./oauth-verification.md).

- [ ] Configurar em [Google Cloud Console → APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
- [ ] Tipo de usuário: **Internal** (apenas domínio) ou **External** (público)
- [ ] Nome do app: `Lead Control - Adicionar novo lead`
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
  - [ ] Nome: `Lead Control - Adicionar novo lead` (EN: `Lead Control - Add new lead`)
  - [ ] Descrição curta (até 200 caracteres)
  - [ ] Descrição detalhada
  - [ ] Categoria: Productivity ou Business Tools
  - [ ] Ícone (128×128 e 32×32 px)
  - [ ] Screenshots (mínimo 1, recomendado 3-5) — ver requisitos abaixo
  - [ ] URL de suporte
  - [ ] URL de documentação (pode apontar para `docs/configuration.md` hospedado)
- [ ] Tipo de instalação: **Individual** + **Domain install**
- [ ] Definir visibilidade: público ou restrito por domínio

### Screenshots — requisitos do Marketplace (rejeição comum)

Use capturas **reais** do add-on no Google Sheets™ (sidebar CardService + planilha), não artes de marketing.

- [ ] Tamanho: **1280×800** (ou 640×400 / 2560×1600)
- [ ] Texto legível (sem blur, glow ou UI em perspectiva 3D)
- [ ] Sem fundo de escritório, partículas, ícones flutuantes (+22.8%, etc.)
- [ ] Sem janela do Chrome/SO; foque na planilha + painel do add-on
- [ ] Mostrar o **add-on**, não só o CRM web (login/configurações do Lead Control)
- [ ] Sequência sugerida:
  1. Painel aberto (status inativo) + aba com cabeçalhos
  2. Credenciais preenchidas + mapeamento de colunas
  3. Após **Salvar e ativar** (integração ativa)
  4. Toast/resultado de **Testar envio**
  5. (Opcional) Linha nova na planilha após envio automático
- [ ] Idioma da UI nas imagens alinhado ao listing (PT-BR e/ou EN)
- [ ] Nome visível nas capturas = nome do listing/manifesto
  (`Lead Control - Adicionar novo lead` / EN: `Lead Control - Add new lead`)

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

> Após uma rejeição, use também [marketplace-resubmission.md](./marketplace-resubmission.md).

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
