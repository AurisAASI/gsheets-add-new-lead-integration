# Configuração — Guia do usuário

Este guia é destinado ao usuário final que instala o add-on Lead Control na planilha.

## Instalação

1. Instale o add-on pelo [Google Workspace Marketplace](https://workspace.google.com/marketplace) (ou via link de test deployment fornecido pela equipe Lead Control)
2. Abra a planilha onde os leads serão recebidos
3. Vá em **Extensões** → **Lead Control - Novo Lead**

## O que o add-on faz

O add-on faz a ponte entre sua planilha Google e o Lead Control: ele monitora a aba configurada e envia cada nova linha como lead para o sistema, linha a linha, assim que ela é adicionada.

## Configuração inicial

No painel do add-on, as credenciais de integração estão disponíveis em **Configurações → Integração** no [Lead Control](https://app.leadcontrol.ia.br).

Preencha:

| Campo | Onde obter |
|-------|-----------|
| **URL do endpoint** | Lead Control → Configurações → Integração |
| **Chave de API** | Lead Control → Configurações → Integração |
| **ID da empresa** | Lead Control → Configurações → Integração |
| **Nome da aba** | Nome da aba da planilha que recebe os leads (padrão: `Base Dados`) |

### Mapeamento de colunas

Na seção **Mapeamento de colunas**, selecione para cada informação do lead qual coluna da planilha corresponde a ela. Os dropdowns listam os cabeçalhos da linha 1 da aba configurada.

| Informação | Obrigatório | Descrição |
|------------|-------------|-----------|
| Nome completo | Sim | Nome completo do lead |
| Telefone | Sim | Telefone de contato |
| Cidade | Sim | Cidade |
| Fonte | Sim | Origem do lead |
| E-mail | Não | E-mail (pode ficar sem mapear) |
| Status do lead | Não | Status inicial (padrão: `Aguardando contato` se não mapear) |

Se você alterar os cabeçalhos da planilha ou o nome da aba, clique em **Atualizar colunas** para recarregar as opções.

Clique em **Salvar e ativar**.

Ao salvar pela primeira vez, o add-on:
- Marca a integração como ativa
- Configura o monitoramento automático de novas linhas
- **Não reenvia** leads que já existiam na planilha antes da ativação

### Compatibilidade

Planilhas já configuradas antes desta versão continuam funcionando com o mapeamento padrão (`nome`, `telefone`, `cidade`, `fonte`, `email`, `status`) até que o usuário salve uma nova configuração.

## Estrutura da planilha

A primeira linha da aba deve conter cabeçalhos (nomes das colunas). Os nomes podem ser quaisquer — o que importa é o mapeamento feito no painel do add-on. A comparação de cabeçalhos não diferencia maiúsculas/minúsculas.

## Como funciona o envio automático

1. Uma integração externa (Meta Lead Ads, Google Ads, Zapier, etc.) adiciona uma nova linha na planilha
2. O add-on detecta a nova linha automaticamente
3. Os dados são validados e enviados para o Lead Control
4. Uma notificação aparece na planilha confirmando o envio ou informando erros

## Ações disponíveis

| Botão | Função |
|-------|--------|
| **Salvar e ativar** | Salva credenciais, mapeamento e ativa o monitoramento |
| **Atualizar colunas** | Recarrega os cabeçalhos da planilha nos dropdowns |
| **Desativar integração** | Para o envio automático |
| **Testar envio (última linha)** | Envia manualmente a última linha (útil para teste) |
| **Reprocessar última linha** | Reenvia a última linha mesmo que já tenha sido processada |

## Solução de problemas

| Sintoma | Possível causa | Ação |
|---------|---------------|------|
| Leads não são enviados | Integração desativada | Abra o add-on e clique em Salvar e ativar |
| Erro de campos ausentes | Mapeamento incorreto ou dados vazios | Verifique mapeamento e conteúdo da linha |
| Dropdowns vazios | Aba inexistente ou sem cabeçalhos | Confira nome da aba e linha 1; clique em Atualizar colunas |
| Erro 401/403 na API | Chave de API incorreta | Verifique credenciais no [Lead Control](https://app.leadcontrol.ia.br) |
| Add-on pede reautorização | Atualização do add-on | Autorize novamente pelo menu Extensões |

## Suporte

Para credenciais de integração ou problemas com a API Lead Control, contate o suporte Lead Control.
