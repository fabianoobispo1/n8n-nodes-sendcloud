import type {
  IExecuteFunctions,
  IHookFunctions,
  IHttpRequestMethods,
  IDataObject,
  ILoadOptionsFunctions,
  JsonObject,
} from 'n8n-workflow'
import { NodeApiError } from 'n8n-workflow'

export async function sendCloudApiRequest(
  this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
  method: IHttpRequestMethods,
  endpoint: string,
  body?: IDataObject,
  qs?: IDataObject,
): Promise<IDataObject> {
  const credentials = await this.getCredentials('sendCloudApi')
  const baseUrl = String(credentials.baseUrl ?? 'https://api.sendcloud.dev.br').replace(/\/$/, '')

  try {
    return (await this.helpers.httpRequestWithAuthentication.call(this, 'sendCloudApi', {
      method,
      url: `${baseUrl}${endpoint}`,
      body,
      qs,
      json: true,
    })) as IDataObject
  } catch (error) {
    throw new NodeApiError(this.getNode(), error as JsonObject)
  }
}

/** Aceita "a@b.com, c@d.com" e retorna string única ou array. */
export function parseToField(raw: string): string | string[] {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length === 1 ? parts[0] : parts
}

/** Parseia um parâmetro JSON do n8n (string ou objeto) com erro amigável. */
export function parseJsonParameter(value: unknown, fieldName: string): IDataObject {
  if (value === undefined || value === null || value === '') return {}
  if (typeof value === 'object') return value as IDataObject
  try {
    return JSON.parse(String(value)) as IDataObject
  } catch {
    throw new Error(`O campo "${fieldName}" não contém JSON válido`)
  }
}
