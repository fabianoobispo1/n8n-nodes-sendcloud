import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow'
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow'

import { parseJsonParameter, parseToField, sendCloudApiRequest } from './GenericFunctions'

export class SendCloud implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SendCloud',
    name: 'sendCloud',
    icon: 'file:sendcloud.svg',
    group: ['output'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Envia emails transacionais via SendCloud (sendcloud.dev.br)',
    usableAsTool: true,
    defaults: { name: 'SendCloud' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'sendCloudApi', required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Email', value: 'email' },
          { name: 'Template', value: 'template' },
        ],
        default: 'email',
      },

      // ── Email operations ────────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['email'] } },
        options: [
          { name: 'Send', value: 'send', description: 'Enviar um email', action: 'Send an email' },
          { name: 'Send Batch', value: 'sendBatch', description: 'Enviar template para vários destinatários (máx 500)', action: 'Send a batch of emails' },
          { name: 'Get', value: 'get', description: 'Buscar um email pelo ID', action: 'Get an email' },
          { name: 'Get Many', value: 'getMany', description: 'Listar emails', action: 'Get many emails' },
          { name: 'Cancel', value: 'cancel', description: 'Cancelar email agendado', action: 'Cancel a scheduled email' },
          { name: 'Resend', value: 'resend', description: 'Reenviar um email', action: 'Resend an email' },
        ],
        default: 'send',
      },

      // ── Email: Send ─────────────────────────────────────────────────────
      {
        displayName: 'From',
        name: 'from',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'Nome <noreply@seudominio.com.br>',
        description: 'Remetente — o domínio precisa estar verificado no workspace',
        displayOptions: { show: { resource: ['email'], operation: ['send', 'sendBatch'] } },
      },
      {
        displayName: 'To',
        name: 'to',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'cliente@exemplo.com',
        description: 'Destinatário(s). Separe múltiplos com vírgula (máx 50).',
        displayOptions: { show: { resource: ['email'], operation: ['send'] } },
      },
      {
        displayName: 'Subject',
        name: 'subject',
        type: 'string',
        default: '',
        description: 'Assunto. Obrigatório quando não usar template.',
        displayOptions: { show: { resource: ['email'], operation: ['send'] } },
      },
      {
        displayName: 'Email Type',
        name: 'emailType',
        type: 'options',
        options: [
          { name: 'HTML', value: 'html' },
          { name: 'Text', value: 'text' },
          { name: 'Template', value: 'template' },
        ],
        default: 'html',
        displayOptions: { show: { resource: ['email'], operation: ['send'] } },
      },
      {
        displayName: 'HTML',
        name: 'html',
        type: 'string',
        typeOptions: { rows: 5 },
        default: '',
        displayOptions: { show: { resource: ['email'], operation: ['send'], emailType: ['html'] } },
      },
      {
        displayName: 'Text',
        name: 'text',
        type: 'string',
        typeOptions: { rows: 5 },
        default: '',
        displayOptions: { show: { resource: ['email'], operation: ['send'], emailType: ['text'] } },
      },
      {
        displayName: 'Template Name or ID',
        name: 'templateId',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getTemplates' },
        default: '',
        description: 'Template Handlebars do workspace. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
        displayOptions: { show: { resource: ['email'], operation: ['send'], emailType: ['template'] } },
      },
      {
        displayName: 'Template Data',
        name: 'templateData',
        type: 'json',
        default: '{}',
        description: 'Variáveis do template, ex: {"nome": "Maria"}',
        displayOptions: { show: { resource: ['email'], operation: ['send'], emailType: ['template'] } },
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['email'], operation: ['send'] } },
        options: [
          { displayName: 'Attachments (Binary Properties)', name: 'attachments', type: 'string', default: '', description: 'Nomes das propriedades binárias do item, separados por vírgula (ex: data,arquivo2). Máx 10 arquivos / 10 MB.' },
          { displayName: 'BCC', name: 'bcc', type: 'string', default: '', description: 'Separar múltiplos com vírgula' },
          { displayName: 'CC', name: 'cc', type: 'string', default: '', description: 'Separar múltiplos com vírgula' },
          { displayName: 'Idempotency Key', name: 'idempotencyKey', type: 'string', default: '', description: 'Evita envio duplicado em retentativas' },
          { displayName: 'Metadata', name: 'metadata', type: 'json', default: '{}' },
          { displayName: 'Reply To', name: 'replyTo', type: 'string', default: '' },
          { displayName: 'Scheduled For', name: 'scheduledFor', type: 'dateTime', default: '', description: 'Agendar envio (máx 30 dias no futuro)' },
          { displayName: 'Tags', name: 'tags', type: 'string', default: '', description: 'Separar múltiplas com vírgula' },
        ],
      },

      // ── Email: Send Batch ───────────────────────────────────────────────
      {
        displayName: 'Template Name or ID',
        name: 'templateId',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getTemplates' },
        required: true,
        default: '',
        description: 'Template enviado a todos os destinatários. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
        displayOptions: { show: { resource: ['email'], operation: ['sendBatch'] } },
      },
      {
        displayName: 'Recipients',
        name: 'recipients',
        type: 'json',
        required: true,
        default: '[\n  { "to": "a@exemplo.com", "templateData": { "nome": "Ana" } }\n]',
        description: 'Array de destinatários (máx 500), cada um com templateData opcional',
        displayOptions: { show: { resource: ['email'], operation: ['sendBatch'] } },
      },

      // ── Email: Get / Cancel / Resend ────────────────────────────────────
      {
        displayName: 'Email ID',
        name: 'emailId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: { show: { resource: ['email'], operation: ['get', 'cancel', 'resend'] } },
      },

      // ── Email: Get Many ─────────────────────────────────────────────────
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        description: 'Whether to return all results or only up to a given limit',
        displayOptions: { show: { resource: ['email'], operation: ['getMany'] } },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 50,
        description: 'Max number of results to return',
        displayOptions: { show: { resource: ['email'], operation: ['getMany'], returnAll: [false] } },
      },
      {
        displayName: 'Filters',
        name: 'filters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['email'], operation: ['getMany'] } },
        options: [
          { displayName: 'Created After', name: 'from', type: 'dateTime', default: '' },
          { displayName: 'Created Before', name: 'to', type: 'dateTime', default: '' },
          { displayName: 'Search', name: 'search', type: 'string', default: '', description: 'Busca por destinatário ou assunto' },
          {
            displayName: 'Status',
            name: 'status',
            type: 'options',
            options: [
              { name: 'Bounced', value: 'bounced' },
              { name: 'Cancelled', value: 'cancelled' },
              { name: 'Clicked', value: 'clicked' },
              { name: 'Delivered', value: 'delivered' },
              { name: 'Failed', value: 'failed' },
              { name: 'Opened', value: 'opened' },
              { name: 'Queued', value: 'queued' },
              { name: 'Scheduled', value: 'scheduled' },
              { name: 'Sent', value: 'sent' },
            ],
            default: 'delivered',
          },
        ],
      },

      // ── Template operations ─────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['template'] } },
        options: [
          { name: 'Get', value: 'get', description: 'Buscar um template pelo ID', action: 'Get a template' },
          { name: 'Get Many', value: 'getMany', description: 'Listar templates do workspace', action: 'Get many templates' },
          { name: 'Render', value: 'render', description: 'Renderizar template com dados de teste (não envia)', action: 'Render a template' },
        ],
        default: 'getMany',
      },
      {
        displayName: 'Template Name or ID',
        name: 'templateId',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getTemplates' },
        required: true,
        default: '',
        description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
        displayOptions: { show: { resource: ['template'], operation: ['get', 'render'] } },
      },
      {
        displayName: 'Data',
        name: 'renderData',
        type: 'json',
        default: '{}',
        description: 'Variáveis para renderização, ex: {"nome": "Maria"}',
        displayOptions: { show: { resource: ['template'], operation: ['render'] } },
      },
    ],
  }

  methods = {
    loadOptions: {
      async getTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const response = await sendCloudApiRequest.call(this, 'GET', '/v1/templates')
        const templates = (response.data as IDataObject[] | undefined) ?? []
        return templates.map((template) => ({
          name: String(template.name ?? template.id),
          value: String(template.id),
        }))
      },
    },
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData()
    const returnData: INodeExecutionData[] = []

    const resource = this.getNodeParameter('resource', 0) as string
    const operation = this.getNodeParameter('operation', 0) as string

    for (let i = 0; i < items.length; i++) {
      try {
        let responseData: IDataObject | IDataObject[]

        if (resource === 'email' && operation === 'send') {
          const body: IDataObject = {
            from: this.getNodeParameter('from', i) as string,
            to: parseToField(this.getNodeParameter('to', i) as string),
          }

          const subject = this.getNodeParameter('subject', i) as string
          if (subject) body.subject = subject

          const emailType = this.getNodeParameter('emailType', i) as string
          if (emailType === 'html') {
            body.html = this.getNodeParameter('html', i) as string
          } else if (emailType === 'text') {
            body.text = this.getNodeParameter('text', i) as string
          } else {
            body.templateId = this.getNodeParameter('templateId', i) as string
            body.templateData = parseJsonParameter(
              this.getNodeParameter('templateData', i),
              'Template Data',
            )
          }

          const additional = this.getNodeParameter('additionalFields', i) as IDataObject
          if (additional.replyTo) body.replyTo = additional.replyTo
          if (additional.cc) body.cc = String(additional.cc).split(',').map((s) => s.trim()).filter(Boolean)
          if (additional.bcc) body.bcc = String(additional.bcc).split(',').map((s) => s.trim()).filter(Boolean)
          if (additional.tags) body.tags = String(additional.tags).split(',').map((s) => s.trim()).filter(Boolean)
          if (additional.metadata) {
            const metadata = parseJsonParameter(additional.metadata, 'Metadata')
            if (Object.keys(metadata).length > 0) body.metadata = metadata
          }
          if (additional.scheduledFor) body.scheduledFor = new Date(String(additional.scheduledFor)).toISOString()
          if (additional.idempotencyKey) body.idempotencyKey = additional.idempotencyKey

          if (additional.attachments) {
            const propertyNames = String(additional.attachments).split(',').map((s) => s.trim()).filter(Boolean)
            const attachments: IDataObject[] = []
            for (const propertyName of propertyNames) {
              const binaryData = this.helpers.assertBinaryData(i, propertyName)
              const buffer = await this.helpers.getBinaryDataBuffer(i, propertyName)
              attachments.push({
                filename: binaryData.fileName ?? propertyName,
                content: buffer.toString('base64'),
                contentType: binaryData.mimeType,
              })
            }
            body.attachments = attachments
          }

          responseData = await sendCloudApiRequest.call(this, 'POST', '/v1/emails/send', body)
        } else if (resource === 'email' && operation === 'sendBatch') {
          const recipients = parseJsonParameter(this.getNodeParameter('recipients', i), 'Recipients')
          if (!Array.isArray(recipients)) {
            throw new NodeOperationError(this.getNode(), 'O campo "Recipients" precisa ser um array JSON', { itemIndex: i })
          }
          responseData = await sendCloudApiRequest.call(this, 'POST', '/v1/emails/batch', {
            from: this.getNodeParameter('from', i) as string,
            templateId: this.getNodeParameter('templateId', i) as string,
            recipients,
          })
        } else if (resource === 'email' && operation === 'get') {
          const id = this.getNodeParameter('emailId', i) as string
          responseData = await sendCloudApiRequest.call(this, 'GET', `/v1/emails/${id}`)
        } else if (resource === 'email' && operation === 'getMany') {
          const returnAll = this.getNodeParameter('returnAll', i) as boolean
          const filters = this.getNodeParameter('filters', i) as IDataObject
          const qs: IDataObject = { ...filters }
          if (qs.from) qs.from = new Date(String(qs.from)).toISOString()
          if (qs.to) qs.to = new Date(String(qs.to)).toISOString()

          if (returnAll) {
            const all: IDataObject[] = []
            let page = 1
            for (;;) {
              const response = await sendCloudApiRequest.call(this, 'GET', '/v1/emails', undefined, { ...qs, page, limit: 100 })
              const data = (response.data as IDataObject[] | undefined) ?? []
              all.push(...data)
              if (all.length >= Number(response.total ?? 0) || data.length === 0) break
              page++
            }
            responseData = all
          } else {
            const limit = this.getNodeParameter('limit', i) as number
            const response = await sendCloudApiRequest.call(this, 'GET', '/v1/emails', undefined, { ...qs, page: 1, limit })
            responseData = (response.data as IDataObject[] | undefined) ?? []
          }
        } else if (resource === 'email' && operation === 'cancel') {
          const id = this.getNodeParameter('emailId', i) as string
          responseData = await sendCloudApiRequest.call(this, 'DELETE', `/v1/emails/${id}`)
        } else if (resource === 'email' && operation === 'resend') {
          const id = this.getNodeParameter('emailId', i) as string
          responseData = await sendCloudApiRequest.call(this, 'POST', `/v1/emails/${id}/resend`)
        } else if (resource === 'template' && operation === 'getMany') {
          const response = await sendCloudApiRequest.call(this, 'GET', '/v1/templates')
          responseData = (response.data as IDataObject[] | undefined) ?? []
        } else if (resource === 'template' && operation === 'get') {
          const id = this.getNodeParameter('templateId', i) as string
          responseData = await sendCloudApiRequest.call(this, 'GET', `/v1/templates/${id}`)
        } else if (resource === 'template' && operation === 'render') {
          const id = this.getNodeParameter('templateId', i) as string
          const data = parseJsonParameter(this.getNodeParameter('renderData', i), 'Data')
          responseData = await sendCloudApiRequest.call(this, 'POST', `/v1/templates/${id}/preview`, { data })
        } else {
          throw new NodeOperationError(this.getNode(), `Operação não suportada: ${resource}.${operation}`, { itemIndex: i })
        }

        const executionData = this.helpers.constructExecutionMetaData(
          this.helpers.returnJsonArray(responseData),
          { itemData: { item: i } },
        )
        returnData.push(...executionData)
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } })
          continue
        }
        throw error
      }
    }

    return [returnData]
  }
}
