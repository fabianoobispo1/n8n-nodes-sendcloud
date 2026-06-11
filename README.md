# n8n-nodes-sendcloud

Node comunitário do [n8n](https://n8n.io) para o [SendCloud](https://sendcloud.dev.br) — API brasileira de email transacional.

## Instalação

No n8n: **Settings → Community Nodes → Install** e digite `n8n-nodes-sendcloud`.

Self-hosted via CLI:

```bash
npm install n8n-nodes-sendcloud
```

## Credencial

1. Crie uma conta em [sendcloud.dev.br](https://sendcloud.dev.br) e verifique seu domínio de envio
2. Gere uma API key em **Dashboard → API Keys**
3. No n8n, crie a credencial **SendCloud API** com a chave

## Nodes

### SendCloud

| Resource | Operações |
|---|---|
| Email | Send, Send Batch (template para até 500 destinatários), Get, Get Many, Cancel (agendados), Resend |
| Template | Get, Get Many, Render (preview com dados de teste) |

O envio suporta HTML, texto puro ou template Handlebars com variáveis, além de cc/bcc, reply-to, tags, metadata, agendamento (`scheduledFor`), chave de idempotência e anexos a partir de dados binários do workflow.

### SendCloud Trigger

Recebe eventos de email via webhook, com registro/remoção automática do endpoint na ativação do workflow:

`sent` · `delivered` · `bounced` · `opened` · `clicked` · `failed` · `unsubscribed` · `quota.warning`

A assinatura HMAC-SHA256 (header `X-SendCloud-Signature`) é validada por padrão.

## Exemplo

Workflow típico: **Webhook (seu app) → SendCloud: Send (template `boas_vindas`) → SendCloud Trigger (bounced) → Slack**.

## Desenvolvimento

```bash
npm install
npm run build
```

A publicação no npm é feita pelo workflow [`publish.yml`](.github/workflows/publish.yml) (GitHub Actions) com [npm provenance](https://docs.npmjs.com/generating-provenance-statements) via trusted publishing.

## Licença

MIT
