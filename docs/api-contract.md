# Contrato da API Lead Control

## Endpoint

```
POST {API_ENDPOINT}
```

Exemplo de produção:
```
https://w23kw2bfok.execute-api.us-east-1.amazonaws.com/prod/integrations/leads
```

O endpoint é configurável pelo usuário no painel do add-on.

## Headers

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/json` |
| `x-api-key` | API Key fornecida pelo Lead Control |

## Payload (JSON)

```json
{
  "fullName": "João Silva",
  "phone": "11999998888",
  "city": "São Paulo",
  "email": "joao@email.com",
  "source": "Planilha Funil",
  "companyID": "company-d1ef844d-d65e-4e3b-9b05-bb6fe8f8cd62",
  "statusLead": "Aguardando contato"
}
```

## Mapeamento planilha → API

| Campo API | Coluna planilha | Obrigatório | Default |
|-----------|----------------|-------------|---------|
| `fullName` | `nome` | Sim | — |
| `phone` | `telefone` | Sim | — |
| `city` | `cidade` | Sim | — |
| `email` | `email` | Não | `""` |
| `source` | `fonte` | Sim | `"Planilha Funil"` |
| `companyID` | — (vem da config) | Sim | — |
| `statusLead` | `status` | Não | `"Aguardando contato"` |

A comparação de nomes de colunas é case-insensitive e ignora espaços extras.

## Campos obrigatórios (validação)

A API retorna **400** se ausentes. O add-on valida localmente antes do POST:

- `fullName`
- `phone`
- `city`
- `companyID`
- `source`

Linhas com campos obrigatórios ausentes são **ignoradas** (não bloqueiam o processamento das demais).

## Respostas

| Código | Significado | Ação do add-on |
|--------|-------------|----------------|
| `200` | Sucesso | Toast de sucesso |
| `201` | Criado | Toast de sucesso |
| `400` | Payload inválido | Toast de erro com corpo da resposta |
| `401`/`403` | Autenticação | Toast de erro — verificar API Key |
| `5xx` | Erro servidor | Toast de erro — log no Stackdriver |

## Exemplo de implementação

Ver [`src/api/leadClient.ts`](../src/api/leadClient.ts) e [`src/mapping/leadMapper.ts`](../src/mapping/leadMapper.ts).
