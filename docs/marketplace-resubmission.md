# Resubmissão — Google Workspace Marketplace

Checklist objetivo após a rejeição (trademarks, screenshots, funcionalidade).

## Já resolvido no projeto

- [x] Logo próprio em `logoUrl` (GitHub raw, sem ícone do Sheets)
- [x] Nome alinhado: `Lead Control - Adicionar novo lead`
- [x] Screenshots 1280×800 em `docs/marketplace-screenshots/out/`
- [x] Hardening contra *"Something went wrong when executing the add-on"*
  (`try/catch` na homepage/handlers, null-checks, trigger sem crash)

## O que você precisa fazer agora

### 1. Commit + deploy PROD

```bash
npm run verify
npm run deploy:prod
```

Se o deploy falhar com `urlFetchWhitelist is required`, o manifesto precisa de `urlFetchWhitelist` (e `openLinkUrlPrefixes` para links do painel). Isso já está em `src/appsscript.json`.

Confirme no Apps Script PROD que a versão deployada inclui logo, nome e whitelist.

No **Marketplace SDK → App Configuration**, o deployment ID deve apontar para a versão Marketplace (ex.: `@8`).

### 2. Store Listing — textos

Corrija se ainda estiver assim:

| Campo | Ajuste |
|-------|--------|
| Nome EN | `Lead Control - Add new lead` (não `Lead Contro`) |
| Corpo EN/PT | `Google Ads™` (com ™) em todas as menções |
| EN Requirements | `Google Sheets™` |
| PT-BR | `Google Planilhas™` ou `Google Sheets™` |
| Passos “Como funciona” | Usar o nome oficial do listing (não “Novo Lead” / “New Lead”) |
| Footnote | Manter: `Google Sheets™, Google Ads™ e Google Workspace™ são marcas…` |

### 3. Store Listing — imagens

1. Remova as 8 artes de marketing antigas
2. Envie os PNGs de `docs/marketplace-screenshots/out/` (01–05)
3. Confirme ícones 128×128 e 32×32 com o logo Lead Control

### 4. Reteste antes de republicar (obrigatório)

Em conta de teste / planilha limpa:

1. Instalar/abrir Extensões → **Lead Control - Adicionar novo lead**
2. Painel abre **sem** “Something went wrong”
3. Preencher credenciais + mapeamento → **Salvar e ativar**
4. **Testar envio (última linha)**
5. **Desativar integração**
6. Conferir Execuções no Apps Script (sem falhas não tratadas)

### 5. Republicar

Marketplace SDK → Store Listing / App Configuration → **Publish** / resubmit.

Opcional: e-mail curto a `gwm-review@google.com` citando:

1. Atribuição de marcas com ™ + footnote  
2. Screenshots reais da UX do add-on (1280×800)  
3. Correção do erro de execução do add-on + nova versão deployada  

## Ordem recomendada

1. `npm run verify` + `npm run deploy:prod`  
2. Atualizar listing (textos + screenshots + ícones)  
3. Reteste em planilha limpa  
4. Resubmit  
