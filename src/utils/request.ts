import config from '@/config'
import fetch, { type RequestInit, type Response } from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'
import logger from './logger'

interface OptionsType extends RequestInit {
  /**
   * 是否打印日志
   * @default true
   */
  log?: boolean
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
    const {
      log = true,
      ...fetchOptions
    } = options

    if (config.proxy.open && config.proxy.url) {
      fetchOptions.agent = new HttpsProxyAgent(config.proxy.url)
    }
    try {
      if (log) logger.debug(`GET请求URL: ${logger.green(url)}`)
      const response = await fetch(url, {
        method: 'GET',
        ...fetchOptions
      })
      if (!response.ok && responseType !== 'raw') {
        logger[log ? 'error' : 'debug'](`GET 请求失败：${response.status} ${response.statusText}`)
        return false
      }
      switch (responseType) {
        case 'raw':
          return response
        case 'text':
          return response.text()
        case 'json':
        default:
          return response.json() as T
      }
    } catch (error) {
      logger[log ? 'error' : 'debug']('GET请求失败:', error)
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
    options: OptionsType
  ): Promise<string | false>
  async post (
    url: Parameters<typeof fetch>[0],
    body: unknown,
    responseType: 'raw',
    options: OptionsType
  ): Promise<Response | false>
  async post<T = any> (
    url: Parameters<typeof fetch>[0],
    body: unknown,
    responseType: 'json' | 'text' | 'raw' = 'json',
    options: OptionsType = {}
  ): Promise<T | string | Response | false> {
    const { log = true, ...fetchOptions } = options

    if (config.proxy.open && config.proxy.url) {
      fetchOptions.agent = new HttpsProxyAgent(config.proxy.url)
    }

    try {
      if (log) logger.debug(`POST请求URL: ${logger.green(url)}`)
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        ...fetchOptions
      })
      if (!response.ok && responseType !== 'raw') {
        logger[log ? 'error' : 'debug'](`POST 请求失败：${response.status} ${response.statusText}`)
        return false
      }
      switch (responseType) {
        case 'raw':
          return response
        case 'text':
          return response.text()
        case 'json':
        default:
          return response.json() as T
      }
    } catch (error) {
      logger[log ? 'error' : 'debug']('POST请求失败:', error)
      return false
    }
  }
}

export const request = new Request()
