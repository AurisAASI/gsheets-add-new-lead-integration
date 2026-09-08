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
| **Aba para sincronizar** | Dropdown com as abas da planilha. Padrão: `Base Dados` se existir; senão a primeira aba |

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

Se você alterar os cabeçalhos da planilha ou trocar a aba no dropdown, o mapeamento recarrega automaticamente ao mudar a aba; use **Atualizar colunas** se tiver editado só os cabeçalhos.

Clique em **Salvar e ativar**.

Ao salvar pela primeira vez, o add-on:
- Marca a integração como ativa
- Configura o monitoramento automático de novas linhas
- **Não reenvia** leads que já existiam na planilha antes da ativação
- Cria automaticamente a aba **Lead Control - Histórico** (você **não** precisa criar essa aba)

### Compatibilidade

Planilhas já configuradas antes desta versão continuam funcionando com o mapeamento padrão (`nome`, `telefone`, `cidade`, `fonte`, `email`, `status`) até que o usuário salve uma nova configuração.

## Estrutura da planilha

A primeira linha da aba de leads deve conter cabeçalhos (nomes das colunas). Os nomes podem ser quaisquer — o que importa é o mapeamento feito no painel do add-on. A comparação de cabeçalhos não diferencia maiúsculas/minúsculas.

### Histórico de envios (automático)

O add-on cria e mantém a aba **Lead Control - Histórico**. Não é necessário criá-la manualmente; se for apagada, ela é recriada no próximo envio ou ao clicar em **Abrir histórico**.

Essa aba **não** aparece no dropdown de “Aba para sincronizar” e **não** deve ser usada como fonte de leads.

Cada tentativa de envio gera uma linha com:

| Coluna | Conteúdo |
|--------|----------|
| Data/hora | Momento do envio |
| Origem | Automático, Teste ou Reprocessar |
| Linha | Número da linha na aba de leads |
| Nome | Nome do lead |
| Resultado | Sucesso, Duplicado, Erro ou Ignorado |
| HTTP | Código de resposta (quando houver) |
| Mensagem | Detalhe resumido da API ou validação |
| Endpoint | Host do endpoint (sem chave de API) |

O painel do add-on mostra um resumo do **último envio** na seção Status. Use **Abrir histórico** para ir direto à aba.

## Como funciona o envio automático

1. Uma integração externa (Meta Lead Ads, Google Ads, Zapier, etc.) adiciona uma nova linha na planilha
2. O add-on detecta a nova linha automaticamente
3. Os dados são validados e enviados para o Lead Control
4. O resultado é registrado na aba **Lead Control - Histórico**
5. Uma notificação aparece na planilha confirmando o envio ou informando erros

## Ações disponíveis

| Botão | Função |
|-------|--------|
| **Salvar e ativar** | Salva credenciais, mapeamento, ativa o monitoramento e cria a aba de histórico |
| **Atualizar colunas** | Recarrega os cabeçalhos da planilha nos dropdowns |
| **Desativar integração** | Para o envio automático |
| **Testar envio (última linha)** | Envia manualmente a última linha (útil para teste) |
| **Reprocessar última linha** | Reenvia a última linha mesmo que já tenha sido processada |
| **Abrir histórico** | Cria (se necessário) e ativa a aba Lead Control - Histórico |

## Solução de problemas

| Sintoma | Possível causa | Ação |
|---------|---------------|------|
| Leads não são enviados | Integração desativada | Abra o add-on e clique em Salvar e ativar |
| Erro de campos ausentes | Mapeamento incorreto ou dados vazios | Verifique mapeamento e conteúdo da linha; confira a aba de histórico |
| Dropdowns vazios | Aba sem cabeçalhos na linha 1 | Confira a aba selecionada e a linha 1; clique em Atualizar colunas |
| Erro 401/403 na API | Chave de API incorreta | Veja a aba **Lead Control - Histórico** e confira credenciais no [Lead Control](https://app.leadcontrol.ia.br) |
| Não sei se o envio funcionou | Toast sumiu / planilha estava fechada | Abra a aba **Lead Control - Histórico** ou use **Abrir histórico** no painel |
| Add-on pede reautorização / leads param após update | Atualização do add-on ou permissões alteradas | Abra Extensões → Lead Control e autorize novamente |

## Suporte

Para credenciais de integração ou problemas com a API Lead Control, contate o suporte Lead Control.
