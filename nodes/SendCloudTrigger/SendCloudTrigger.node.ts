import { createHmac, timingSafeEqual } from 'node:crypto'

import type {
  IDataObject,
  IHookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow'
import { NodeConnectionTypes } from 'n8n-workflow'

import { sendCloudApiRequest } from '../SendCloud/GenericFunctions'

export class SendCloudTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SendCloud Trigger',
    name: 'sendCloudTrigger',
    icon: 'file:sendcloud.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["events"].join(", ")}}',
    description: 'Dispara quando o SendCloud envia um evento de email (entrega, bounce, abertura, clique…)',
    defaults: { name: 'SendCloud Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'sendCloudApi', required: true }],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        required: true,
        options: [
          { name: 'Bounced', value: 'bounced', description: 'Email rejeitado permanentemente' },
          { name: 'Clicked', value: 'clicked', description: 'Link do email clicado' },
          { name: 'Delivered', value: 'delivered', description: 'Email entregue ao servidor de destino' },
          { name: 'Failed', value: 'failed', description: 'Falha no envio' },
          { name: 'Opened', value: 'opened', description: 'Email aberto (pixel de tracking)' },
          { name: 'Quota Warning', value: 'quota.warning', description: 'Quota do plano em 80% ou 100%' },
          { name: 'Sent', value: 'sent', description: 'Email aceito pelo SMTP' },
          { name: 'Unsubscribed', value: 'unsubscribed', description: 'Destinatário cancelou inscrição' },
        ],
        default: ['delivered', 'bounced'],
      },
      {
        displayName: 'Verify Signature',
        name: 'verifySignature',
        type: 'boolean',
        default: true,
        description: 'Whether to validate the X-SendCloud-Signature HMAC header before accepting the event',
      },
    ],
  }

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default')
        const staticData = this.getWorkflowStaticData('node')

        const response = await sendCloudApiRequest.call(this, 'GET', '/v1/webhooks')
        const webhooks = (response.data as IDataObject[] | undefined) ?? []
        for (const webhook of webhooks) {
          if (webhook.url === webhookUrl) {
            staticData.webhookId = webhook.id
            return true
          }
        }
        return false
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default')
        const events = this.getNodeParameter('events') as string[]
        const staticData = this.getWorkflowStaticData('node')

        const response = await sendCloudApiRequest.call(this, 'POST', '/v1/webhooks', {
          url: webhookUrl,
          events,
        })

        staticData.webhookId = response.id
        // O secret só é retornado na criação — guardado para validar a assinatura HMAC
        staticData.webhookSecret = response.secret
        return true
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const staticData = this.getWorkflowStaticData('node')
        if (staticData.webhookId) {
          try {
            await sendCloudApiRequest.call(this, 'DELETE', `/v1/webhooks/${staticData.webhookId}`)
          } catch {
            // webhook já removido no servidor — segue a desativação local
          }
          delete staticData.webhookId
          delete staticData.webhookSecret
        }
        return true
      },
    },
  }

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData()
    const verifySignature = this.getNodeParameter('verifySignature') as boolean
    const staticData = this.getWorkflowStaticData('node')

    if (verifySignature && staticData.webhookSecret) {
      const req = this.getRequestObject()
      const signature = String(this.getHeaderData()['x-sendcloud-signature'] ?? '')
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(body))
      const expected = createHmac('sha256', String(staticData.webhookSecret)).update(rawBody).digest('hex')

      const signatureBuffer = Buffer.from(signature)
      const expectedBuffer = Buffer.from(expected)
      const valid =
        signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer)

      if (!valid) {
        const res = this.getResponseObject()
        res.status(401).json({ error: 'invalid_signature' })
        return { noWebhookResponse: true }
      }
    }

    return {
      workflowData: [this.helpers.returnJsonArray(body as IDataObject)],
    }
  }
}
