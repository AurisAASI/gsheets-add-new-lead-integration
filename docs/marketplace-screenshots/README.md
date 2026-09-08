# Screenshots — Google Workspace Marketplace

Artefatos para o Store Listing (1280×800), alinhados à UI real do add-on.

## Gerar as imagens

```bash
node docs/marketplace-screenshots/render.mjs
```

Saída em `docs/marketplace-screenshots/out/`:

| Arquivo | Conteúdo |
|---------|----------|
| `01-painel-inativo.png` | Painel inativo + planilha com cabeçalhos |
| `02-credenciais-e-mapeamento.png` | Credenciais e mapeamento preenchidos |
| `03-integracao-ativa.png` | Status integração ativa |
| `04-teste-envio.png` | Toast de teste de envio |
| `05-nova-linha-enviada.png` | Nova linha destacada + confirmação |

## Importante para a revisão

Estas imagens são **mockups fiéis** da UI (sidebar CardService + grade estilo Sheets), sem artes de marketing.

Para maximizar a chance de aprovação, o ideal é **substituir por capturas reais** no Google Sheets™ após instalar o test deployment / versão PROD:

1. Abra uma planilha com aba `Base Dados` e cabeçalhos (`nome`, `telefone`, `cidade`, `fonte`, `email`, `status`)
2. Extensões → **Lead Control - Adicionar novo lead**
3. Capture só a área da planilha + painel (sem barra do SO / janela do Chrome se possível)
4. Exporte ou recorte em **1280×800**
5. Repita para os 4–5 estados acima

## Pré-visualizar no navegador

```text
docs/marketplace-screenshots/addon-ui.html?scene=inactive
docs/marketplace-screenshots/addon-ui.html?scene=mapping
docs/marketplace-screenshots/addon-ui.html?scene=active
docs/marketplace-screenshots/addon-ui.html?scene=toast
docs/marketplace-screenshots/addon-ui.html?scene=newrow
```
