import config from '@/config'
import fetch, { type RequestInit, type Response } from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'
import type { Readable } from 'node:stream'
import logger from './logger'

export interface DownloadResult {
  data: Buffer
  contentType: string
}

interface OptionsType extends RequestInit {
  /**
   * 是否打印日志，默认打印 debug
   * @default true
   */
  log?: boolean | 'trace' | 'debug' | 'info' | 'mark' | 'warn' | 'error'
}

export class Request {
  /**
   * GET请求
   * @param url 请求URL
   * @param responseType 返回数据类型
   * @param options 请求参数
   */
  async get<T = any> (url: Parameters<typeof fetch>[0], responseType?: 'json', options?: OptionsType): Promise<T | false>
  async get (url: Parameters<typeof fetch>[0], responseType?: 'text', options?: OptionsType): Promise<string | false>
  async get (url: Parameters<typeof fetch>[0], responseType?: 'raw', options?: OptionsType): Promise<Response | false>
  async get<T = any> (
    url: Parameters<typeof fetch>[0],
    responseType: 'json' | 'text' | 'raw' = 'json',
    options: OptionsType = {}
  ): Promise<T | string | Response | false> {
    return this.request<T>('GET', url, responseType, options)
  }

  /**
   * 下载二进制资源，沿用项目代理与超时设置。
   * @param url 资源URL
   * @param options 请求参数，size 可限制最大下载字节数
   * @returns 内容及媒体类型；可保存为文件或转换为 data URL，失败返回 false
   */
  async download (url: Parameters<typeof fetch>[0], options: OptionsType = {}): Promise<DownloadResult | false> {
    const response = await this.get(url, 'raw', options)
    if (!response) return false
    const { log = true } = options
    try {
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
      return {
        data: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || 'application/octet-stream'
      }
    } catch (error) {
      (response.body as Readable | null)?.destroy()
      if (log) logger[typeof log === 'boolean' ? 'error' : log]('资源下载失败:', error)
      return false
    }
  }

  /**
   * POST请求
   * @param url 请求URL
   * @param body 请求体
   * @param responseType 返回数据类型
   * @param options 请求参数
   */
  async post<T = any> (
    url: Parameters<typeof fetch>[0],
    body: unknown,
    responseType?: 'json',
    options?: OptionsType
  ): Promise<T | false>
  async post (
    url: Parameters<typeof fetch>[0],
    body: unknown,
    responseType: 'text',
    options?: OptionsType
  ): Promise<string | false>
  async post (
    url: Parameters<typeof fetch>[0],
    body: unknown,
    responseType: 'raw',
    options?: OptionsType
  ): Promise<Response | false>
  async post<T = any> (
    url: Parameters<typeof fetch>[0],
    body: unknown,
    responseType: 'json' | 'text' | 'raw' = 'json',
    options: OptionsType = {}
  ): Promise<T | string | Response | false> {
    return this.request<T>('POST', url, responseType, options, body)
  }

  private async request<T> (
    method: 'GET' | 'POST',
    url: Parameters<typeof fetch>[0],
    responseType: 'json' | 'text' | 'raw',
    options: OptionsType,
    body?: unknown
  ): Promise<T | string | Response | false> {
    const { log = true, ...fetchOptions } = options
    try {
      if (fetchOptions.signal === undefined) fetchOptions.signal = AbortSignal.timeout(30_000)
      if (config.proxy.open && config.proxy.url) fetchOptions.agent = new HttpsProxyAgent(config.proxy.url)
      if (log) logger[typeof log === 'boolean' ? 'debug' : log](`${method}请求URL: ${logger.green(url)}`)
      const response = await fetch(url, {
        method,
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
        ...fetchOptions
      })
      if (!response.ok && responseType !== 'raw') {
        if (log) logger[typeof log === 'boolean' ? (method === 'GET' ? 'debug' : 'error') : log](`${method} 请求失败：${response.status} ${response.statusText}`)
        return false
      }
      switch (responseType) {
        case 'raw':
          return response
        case 'text':
          return await response.text()
        case 'json':
        default:
          return await response.json() as T
      }
    } catch (error) {
      logger[typeof log === 'boolean' ? 'error' : log](`${method}请求失败:`, error)
      return false
    }
  }
}

export const request = new Request()
