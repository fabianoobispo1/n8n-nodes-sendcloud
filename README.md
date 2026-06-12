# n8n-nodes-sendcloud

[n8n](https://n8n.io) community node for [SendCloud](https://sendcloud.dev.br) — a Brazilian transactional email API.

## Installation

In n8n: **Settings → Community Nodes → Install** and enter `n8n-nodes-sendcloud`.

Self-hosted via CLI:

```bash
npm install n8n-nodes-sendcloud
```

## Credentials

1. Create an account at [sendcloud.dev.br](https://sendcloud.dev.br) and verify your sending domain
2. Generate an API key in **Dashboard → API Keys**
3. In n8n, create a **SendCloud API** credential with the key

## Nodes

### SendCloud

| Resource | Operations |
|---|---|
| Email | Send, Send Batch (template to up to 500 recipients), Get, Get Many, Cancel (scheduled), Resend |
| Template | Get, Get Many, Render (preview with test data) |

Sending supports HTML, plain text, or Handlebars templates with variables, plus cc/bcc, reply-to, tags, metadata, scheduling (`scheduledFor`), idempotency keys, and attachments from workflow binary data.

### SendCloud Trigger

Receives email events via webhook, with automatic endpoint registration/removal when the workflow is activated:

`sent` · `delivered` · `bounced` · `opened` · `clicked` · `failed` · `unsubscribed` · `quota.warning`

The HMAC-SHA256 signature (`X-SendCloud-Signature` header) is validated by default.

## Example

Typical workflow: **Webhook (your app) → SendCloud: Send (template `welcome`) → SendCloud Trigger (bounced) → Slack**.

## Development

```bash
npm install
npm run build
```

Publishing to npm is done by the [`publish.yml`](.github/workflows/publish.yml) workflow (GitHub Actions) with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) via trusted publishing.

## License

MIT
