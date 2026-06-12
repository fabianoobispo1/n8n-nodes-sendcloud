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

/** Accepts "a@b.com, c@d.com" and returns a single string or an array. */
export function parseToField(raw: string): string | string[] {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length === 1 ? parts[0] : parts
}

/** Parses an n8n JSON parameter (string or object) with a friendly error. */
export function parseJsonParameter(value: unknown, fieldName: string): IDataObject {
  if (value === undefined || value === null || value === '') return {}
  if (typeof value === 'object') return value as IDataObject
  try {
    return JSON.parse(String(value)) as IDataObject
  } catch {
    throw new Error(`The "${fieldName}" field does not contain valid JSON`)
  }
}
