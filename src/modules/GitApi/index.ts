import { request, logger } from '@/utils'
import config from '@/config'
import type { GitApiMethod, GitCommitDataType, GitReleaseDataType } from '@/types'
type Provider = 'GitHub' | 'Gitee' | 'Gitcode' | 'CNB' | string

const DEFAULT_API: Record<string, string> = {
  GitHub: 'https://api.github.com/repos',
  Gitee: 'https://gitee.com/api/v5/repos',
  Gitcode: 'https://api.gitcode.com/api/v5/repos',
  CNB: 'https://api.cnb.cool'
}

/**
 * 根据配置与 provider 名称返回 API 根地址和token
 */
function apiUrlFor (source: Provider): { apiUrl?: string; token?: string } {
  const cfg = config?.CodeUpdate?.repos ?? []
  const custom: Record<string, { apiUrl: string; token?: string }> = cfg.reduce((acc, item) => {
    if (item.provider && item.ApiUrl) acc[item.provider.toLowerCase()] = { apiUrl: item.ApiUrl, token: item.token ?? '' }
    return acc
  }, {} as Record<string, { apiUrl: string; token: string }>)
  const name = String(source || '').toLowerCase()
  const result = custom[name] || (DEFAULT_API[name] ? { apiUrl: DEFAULT_API[name] } : {})
  return result
}

/**
 * Repo service - 提供获取仓库提交/发布、默认分支等方法
 */
export default new class RepoService {
  /**
   * 获取仓库提交或 release 等数据
   * @param source 数据源（例如 "GitHub"|"Gitee"|"Gitcode"|"CNB"）
   * @param repo 仓库路径 "owner/name"
   * @param type 请求类型，默认 "commits"（commits | releases 等）
   * @param sha 可选：提交 SHA 或分支名（用于从特定 sha/分支读取）
   * @returns 成功返回数据，失败返回 false
   */
  async getRepositoryData<
    M extends GitApiMethod
  > (
    source: Provider,
    repo: string,
    method: M,
    // token?: string,
    sha?: string
  ): Promise<
    M extends 'commits' ? GitCommitDataType | GitCommitDataType[number] | false : GitReleaseDataType | false
  > {
    const src = String(source || '')
    /** 区分各平台 */
    const isGitea = /gitea/i.test(src)
    const isGitee = /gitee/i.test(src)
    const isGitcode = /gitcode/i.test(src)
    const isCNB = /cnb/i.test(src)

    const { apiUrl, token } = apiUrlFor(source)
    if (!apiUrl) {
      logger.error(`未知数据源: ${source}`)
      return false
    }

    const url = new URL(apiUrl)

    /** 拼接 pathname */
    if (method === 'commits' && sha) {
      if (isGitea) {
        // Gitea: /{repo}/commits?sha={sha}&page=1
        url.pathname = `${url.pathname}/${repo}/commits`
        url.searchParams.set('page', '1')
        url.searchParams.set('sha', sha)
      } else if (isCNB) {
        // cnb: /{repo}/-/git/commits/{sha}
        url.pathname = `${url.pathname}${url.pathname.endsWith('/') ? '' : '/'}${repo}/-/git/commits/${sha}`
      } else {
        // GitHub / Gitcode 等
        url.pathname = `${url.pathname}/${repo}/commits/${sha}`
        // Gitcode 文件变更信息
        if (isGitcode) url.searchParams.set('show_diff', 'true')
      }
    } else {
      if (isCNB) {
        url.pathname = `${url.pathname}/${repo}/-/git/${method}`
        url.searchParams.set('page', '1')
      } else {
        url.pathname = `${url.pathname}/${repo}/${method}`
        isGitea ? url.searchParams.set('page', '1') : url.searchParams.set('per_page', '1')
      }
    }
    if (isGitee && token) {
      url.searchParams.set('access_token', token)
    }
    const headers = this.getHeaders(source, token)
    try {
      logger.debug('请求 URL:', url.toString())
      const data = await this.fetchData<GitCommitDataType | GitReleaseDataType>(
        url,
        headers,
        repo,
        source
      )
      return data as any
    } catch (err) {
      logger.error('获取仓库数据失败', {
        url: url.toString(),
        err
      })
      return false
    }
  }

  /**
   * 获取仓库默认分支
   * @param source 数据源
   * @param repo 仓库路径 "owner/name"
   * @returns 默认分支名（string）或 false（失败）
   */
  async getDefaultBranch (source: Provider, repo: string): Promise<string | false> {
    const { apiUrl: baseURL, token } = apiUrlFor(source)
    if (!baseURL) {
      logger.error(`未知数据源: ${source}`)
      return false
    }
    // 对cnb特殊处理
    const isCNB = /cnb/i.test(String(source || ''))

    let url = `${baseURL}/${repo}`
    if (isCNB) url = `${baseURL}/${repo}/-/git/head`

    const headers = this.getHeaders(source, token)
    const data = await this.fetchData<{ default_branch?: string, name?: string }>(url, headers, repo, source)
    if (!data) return false
    return isCNB ? (data.name ?? '') : (data.default_branch ?? '')
  }

  /**
   * 根据 token 与 source 生成请求头
   * @param source 平台名称
   * @param token 认证token，会自动添加至请求头
   */
  getHeaders (source?: Provider, token?: string) {
    const src = String(source || '')
    // 根据 provider 设置 Accept header（优先使用 provider 精确值）
    const accept = (() => {
      switch (src) {
        case 'GitHub':
          return 'application/vnd.github+json'
        case 'Gitee':
          return 'application/vnd.gitee+json'
        default:
          return 'application/json'
      }
    })()

    const headers: Record<string, string> = {
      'User-Agent': 'request',
      Accept: accept
    }
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  /**
   * 通用 JSON 请求：包装底层 request 并做常见错误处理
   * @param url 请求地址
   * @param headers 可选请求头
   * @param repo 仅用于日志
   * @param source 仅用于日志
   * @returns 解析后的 JSON（泛型）或 false（失败）
   */
  async fetchData<T = any> (url: Parameters<typeof request['get']>[0], headers: Record<string, string> = {}, repo?: string, source?: Provider): Promise<T | false> {
    try {
      const response = await request.get(url, 'raw', {
        headers
      })
      if (!response) return false

      if (!response.ok) {
        let msg = `状态码：${response.status} ${response?.statusText || ''}`
        switch (response.status) {
          case 400:
            msg = '参数错误 (code: 400)'
            break
          case 401:
            msg = '访问令牌无效或已过期 (code: 401)'
            break
          case 403:
            msg = '请求达到Api速率限制或无权限，请尝试填写token或降低请求频率后重试 (code: 403)'
            break
          case 404:
            msg = '未找到仓库 (code: 404)'
            break
          case 500:
            msg = '服务器错误 (code: 500)'
            break
        }
        logger.error(`请求 ${logger.magenta(String(source))} 失败: ${logger.cyan(String(repo))}, ${msg}`)
        return false
      }

      const contentType = response.headers?.get?.('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        logger.error(`响应非 JSON 格式: ${url} , 内容：${await response.text()}`)
        return false
      }

      return await response.json() as T
    } catch (error: any) {
      logger.error(`请求失败: ${url}，错误信息: ${error?.stack ?? error}`)
      return false
    }
  }
}()
