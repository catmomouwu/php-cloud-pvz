// 存档对象存储：只依赖 S3 兼容 API（aws4fetch），R2 / MinIO / AWS S3 均可。

import { AwsClient } from 'aws4fetch'
import type { H3Event } from 'h3'

export interface SaveStore {
  put: (key: string, body: Uint8Array) => Promise<void>
  get: (key: string) => Promise<Uint8Array | null>
  delete: (key: string) => Promise<void>
}

export function useSaveStore(event: H3Event): SaveStore {
  const { s3 } = useRuntimeConfig(event)
  if (!s3.endpoint || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
    throw createError({ statusCode: 503, statusMessage: 'Storage not configured', data: { code: 'STORAGE_NOT_CONFIGURED' } })
  }
  const client = new AwsClient({
    accessKeyId: s3.accessKeyId,
    secretAccessKey: s3.secretAccessKey,
    service: 's3',
    region: s3.region || 'auto',
  })
  const base = `${s3.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(s3.bucket)}`
  const url = (key: string) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`

  async function check(response: Response, action: string) {
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw createError({ statusCode: 502, statusMessage: `Storage ${action} failed`, data: { code: 'STORAGE_ERROR', status: response.status, detail: detail.slice(0, 300) } })
    }
  }

  return {
    async put(key, body) {
      const response = await client.fetch(url(key), {
        method: 'PUT',
        body: body as BodyInit,
        headers: { 'content-type': 'application/zip' },
      })
      await check(response, 'put')
    },
    async get(key) {
      const response = await client.fetch(url(key))
      if (response.status === 404) return null
      await check(response, 'get')
      return new Uint8Array(await response.arrayBuffer())
    },
    async delete(key) {
      const response = await client.fetch(url(key), { method: 'DELETE' })
      if (response.status !== 404) await check(response, 'delete')
    },
  }
}
