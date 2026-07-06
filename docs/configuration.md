# Configuração — Guia do usuário

Este guia é destinado ao usuário final que instala o add-on Lead Control na planilha.

## Instalação

1. Instale o add-on pelo [Google Workspace Marketplace](https://workspace.google.com/marketplace) (ou via link de test deployment fornecido pela equipe Lead Control)
2. Abra a planilha onde os leads serão recebidos
3. Vá em **Extensões** → **Lead Control - Novo Lead**

## Configuração inicial

No painel do add-on, preencha:

| Campo | Onde obter |
|-------|-----------|
| **API Endpoint** | Painel Lead Control → Integrações → Google Planilhas |
| **API Key** | Painel Lead Control → Integrações → Google Planilhas |
| **Company ID** | Painel Lead Control → Integrações → Google Planilhas |
| **Nome da aba** | Nome da aba da planilha que recebe os leads (padrão: `Base Dados`) |

Clique em **Salvar e ativar**.

Ao salvar pela primeira vez, o add-on:
- Marca a integração como ativa
- Configura o monitoramento automático de novas linhas
- **Não reenvia** leads que já existiam na planilha antes da ativação

## Estrutura da planilha

A primeira linha da aba deve conter os cabeçalhos (nomes das colunas):

| Coluna | Obrigatório | Descrição |
|--------|-------------|-----------|
| `nome` | Sim | Nome completo do lead |
| `telefone` | Sim | Telefone de contato |
| `cidade` | Sim | Cidade |
| `email` | Não | E-mail |
| `fonte` | Não | Origem do lead (padrão: `Planilha Funil`) |
| `status` | Não | Status inicial (padrão: `Aguardando contato`) |

Os nomes das colunas não diferenciam maiúsculas/minúsculas.

## Como funciona o envio automático

1. Uma integração externa (Meta Lead Ads, Google Ads, Zapier, etc.) adiciona uma nova linha na planilha
2. O add-on detecta a nova linha automaticamente
3. Os dados são validados e enviados para o Lead Control
4. Uma notificação aparece na planilha confirmando o envio ou informando erros

## Ações disponíveis

| Botão | Função |
|-------|--------|
| **Salvar e ativar** | Salva credenciais e ativa o monitoramento |
| **Desativar integração** | Para o envio automático |
| **Testar envio (última linha)** | Envia manualmente a última linha (útil para teste) |
| **Reprocessar última linha** | Reenvia a última linha mesmo que já tenha sido processada |

## Solução de problemas

| Sintoma | Possível causa | Ação |
|---------|---------------|------|
| Leads não são enviados | Integração desativada | Abra o add-on e clique em Salvar e ativar |
| Erro de campos ausentes | Colunas com nomes diferentes | Verifique cabeçalhos da planilha |
| Erro 401/403 na API | API Key incorreta | Verifique credenciais no painel Lead Control |
| Add-on pede reautorização | Atualização do add-on | Autorize novamente pelo menu Extensões |

## Suporte

Para credenciais de integração ou problemas com a API Lead Control, contate o suporte Lead Control.
