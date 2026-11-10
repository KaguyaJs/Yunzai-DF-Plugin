import { request, logger } from '@/utils'
import config from '@/config'
import type { GitApiMethod, GitCommitDataType, GitReleaseDataType, GitActivityMethod, GitActivityItem, GitActivityComment } from '@/types'
type Provider = 'GitHub' | 'Gitee' | 'Gitcode' | 'CNB' | string

const DEFAULT_API: Record<string, string> = {
  github: 'https://api.github.com/repos',
  gitee: 'https://gitee.com/api/v5/repos',
  gitcode: 'https://api.gitcode.com/api/v5/repos',
  cnb: 'https://api.cnb.cool'
}

/**
 * 根据配置与 provider 名称返回 API 根地址和token
 */
function apiUrlFor (source: Provider): { apiUrl?: string; token?: string } {
  const cfg = config?.CodeUpdate?.repos ?? []
  const name = String(source || '').toLowerCase()
  const item = cfg.findLast(item => item.provider?.toLowerCase() === name)
  return { apiUrl: item?.ApiUrl || DEFAULT_API[name], token: item?.token }
}

function basePath (pathname: string) {
  return pathname.replace(/\/+$/, '')
}

function safeUrl (input: string | URL) {
  const url = new URL(input)
  url.username = ''
  url.password = ''
  for (const key of ['access_token', 'token']) {
    if (url.searchParams.has(key)) url.searchParams.set(key, 'REDACTED')
  }
  return url.toString()
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
    M extends Extract<GitApiMethod, 'commits' | 'releases'>
  > (
    source: Provider,
    repo: string,
    method: M,
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
        url.pathname = `${basePath(url.pathname)}/${repo}/commits`
        url.searchParams.set('page', '1')
        url.searchParams.set('sha', sha)
      } else if (isCNB) {
        // cnb: /{repo}/-/git/commits/{sha}
        url.pathname = `${basePath(url.pathname)}/${repo}/-/git/commits/${encodeURIComponent(sha)}`
      } else {
        // GitHub / Gitcode 等
        url.pathname = `${basePath(url.pathname)}/${repo}/commits/${encodeURIComponent(sha)}`
        // Gitcode 文件变更信息
        if (isGitcode) url.searchParams.set('show_diff', 'true')
      }
    } else {
      if (isCNB) {
        url.pathname = `${basePath(url.pathname)}/${repo}/-/git/${method}`
        url.searchParams.set('page', '1')
      } else {
        url.pathname = `${basePath(url.pathname)}/${repo}/${method}`
        isGitea ? url.searchParams.set('page', '1') : url.searchParams.set('per_page', '1')
      }
    }
    if (isGitee && token) {
      url.searchParams.set('access_token', token)
    }
    const headers = this.getHeaders(source, token)
    logger.trace('请求 URL:', safeUrl(url))
    return await this.fetchData<GitCommitDataType | GitReleaseDataType>(url, headers, repo, source) as any
  }

  supportsActivity (source: Provider) {
    return /github|gitee|gitcode|gitea/i.test(source)
  }

  /** Refresh every check; fail rather than accepting a truncated list of branches. */
  async getBranches (source: Provider, repo: string): Promise<string[] | false> {
    const { apiUrl, token } = apiUrlFor(source)
    if (!apiUrl) return false
    const url = new URL(apiUrl)
    const repoPath = repo.split('/').map(encodeURIComponent).join('/')
    url.pathname = `${basePath(url.pathname)}/${repoPath}${/cnb/i.test(source) ? '/-/git/branches' : '/branches'}`
    if (/gitee/i.test(source) && token) url.searchParams.set('access_token', token)
    url.searchParams.set(/gitea/i.test(source) ? 'limit' : /cnb/i.test(source) ? 'page_size' : 'per_page', '100')
    const result = new Set<string>()
    for (let page = 1; page <= 1000; page++) {
      url.searchParams.set('page', String(page))
      const pagination: { hasNext?: boolean } = {}
      const data = await this.fetchData<{ name: string }[]>(url, this.getHeaders(source, token), repo, source, pagination)
      if (data === false) return false
      if (!Array.isArray(data) || data.some(branch => typeof branch?.name !== 'string' || !branch.name)) {
        logger.error(`${source} ${repo} 的分支接口未返回有效列表`)
        return false
      }
      const count = result.size
      data.forEach(branch => result.add(branch.name))
      if (pagination.hasNext === false || !data.length) return Array.from(result)
      // Some providers cap page size below the requested 100; read until an empty page.
      if (result.size === count && pagination.hasNext === undefined) {
        logger.error(`${source} ${repo} 的分支分页未前进，无法确认完整列表`)
        return false
      }
    }
    logger.error(`${source} ${repo} 的分支数据超过分页上限，跳过本次提交检查`)
    return false
  }

  private activityUrl (source: Provider, repo: string, path: string) {
    if (!this.supportsActivity(source)) throw new Error(`${source} 暂不支持 PR/Issue 监听`)
    const { apiUrl, token } = apiUrlFor(source)
    if (!apiUrl) throw new Error(`未知数据源: ${source}`)
    const url = new URL(apiUrl)
    url.pathname = `${basePath(url.pathname)}/${repo.split('/').map(encodeURIComponent).join('/')}/${path}`
    if (/gitee/i.test(source) && token) url.searchParams.set('access_token', token)
    return { url, headers: this.getHeaders(source, token) }
  }

  /** Fully read the requested window; never advance a cursor after a partial/failed scan. */
  private async activityCollection<T extends { updated_at?: string, created_at?: string }> (
    source: Provider,
    repo: string,
    url: URL,
    headers: Record<string, string>,
    options: { pageSize: number, maxPages: number, stopBefore?: number }
  ): Promise<T[] | false> {
    const result: T[] = []
    const pageSize = Math.max(1, Math.min(100, options.pageSize))
    url.searchParams.set(/gitea/i.test(source) ? 'limit' : 'per_page', String(pageSize))
    for (let page = 1; page <= options.maxPages; page++) {
      url.searchParams.set('page', String(page))
      const pagination: { hasNext?: boolean } = {}
      const data = await this.fetchData<T[]>(url, headers, repo, source, pagination)
      if (data === false) return false
      if (!Array.isArray(data)) {
        logger.error(`${source} ${repo} 的 PR/Issue 接口未返回列表`)
        return false
      }
      result.push(...data)
      const reachedCursor = options.stopBefore !== undefined && data.some(item => Date.parse(item.updated_at || '') < options.stopBefore!)
      if (reachedCursor || pagination.hasNext === false || (!data.length) || (pagination.hasNext === undefined && data.length < pageSize)) return result
    }
    logger.error(`${source} ${repo} 的 PR/Issue 数据超过单次分页上限，未推进检查进度；请调高 CodeUpdate.Activity.MaxPages`)
    return false
  }

  async getActivityItems (
    source: Provider,
    repo: string,
    method: GitActivityMethod,
    options: { pageSize: number, maxPages: number, since?: string }
  ): Promise<GitActivityItem[] | false> {
    const { url, headers } = this.activityUrl(source, repo, method)
    url.searchParams.set('state', 'all')
    url.searchParams.set('sort', /gitea/i.test(source) ? 'recentupdate' : 'updated')
    url.searchParams.set('direction', 'desc')
    if (options.since && method === 'issues' && /github/i.test(source)) url.searchParams.set('since', options.since)
    const data = await this.activityCollection<GitActivityItem>(source, repo, url, headers, {
      ...options,
      stopBefore: options.since ? Date.parse(options.since) : undefined
    })
    if (data === false) return false
    if (data.some(item => !Number.isFinite(Date.parse(item.updated_at)))) throw new Error('PR/Issue 列表包含无效更新时间')
    return data.filter(item => (method !== 'issues' || !item.pull_request) && (!options.since || Date.parse(item.updated_at) >= Date.parse(options.since)))
  }

  async getActivityItem (source: Provider, repo: string, method: GitActivityMethod, number: string): Promise<GitActivityItem | false> {
    const { url, headers } = this.activityUrl(source, repo, `${method}/${encodeURIComponent(number)}`)
    return this.fetchData<GitActivityItem>(url, headers, repo, source)
  }

  async getActivityComments (
    source: Provider,
    repo: string,
    method: GitActivityMethod,
    number: string,
    options: { pageSize: number, maxPages: number, since: string }
  ): Promise<GitActivityComment[] | false> {
    const path = method === 'pulls' && /gitee|gitcode/i.test(source) ? 'pulls' : 'issues'
    const { url, headers } = this.activityUrl(source, repo, `${path}/${encodeURIComponent(number)}/comments`)
    if (/github|gitea/i.test(source)) url.searchParams.set('since', options.since)
    const data = await this.activityCollection<GitActivityComment>(source, repo, url, headers, options)
    if (data === false) return false
    if (data.some(item => !Number.isFinite(Date.parse(item.created_at)))) throw new Error('评论列表包含无效创建时间')
    return data.filter(item => Date.parse(item.created_at) >= Date.parse(options.since))
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

    const url = new URL(baseURL)
    url.pathname = `${basePath(url.pathname)}/${repo}${isCNB ? '/-/git/head' : ''}`
    if (/gitee/i.test(String(source || '')) && token) url.searchParams.set('access_token', token)

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
    const src = String(source || '').toLowerCase()
    // 根据 provider 设置 Accept header
    const accept = (() => {
      switch (src) {
        case 'github':
          return 'application/vnd.github+json'
        case 'gitee':
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
  async fetchData<T = any> (url: string | URL, headers: Record<string, string> = {}, repo?: string, source?: Provider, pagination?: { hasNext?: boolean }): Promise<T | false> {
    try {
      const response = await request.get(url, 'raw', {
        headers,
        log: false
      })
      if (!response) {
        logger.error(`请求 ${String(source)} 失败: ${String(repo)}，网络请求未成功或已超时`)
        return false
      }

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

      const link = response.headers?.get?.('link')
      if (pagination && link) pagination.hasNext = /rel="?next"?/i.test(link)

      const contentType = response.headers?.get?.('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        logger.error(`响应非 JSON 格式: ${safeUrl(url)}`)
        return false
      }

      return await response.json() as T
    } catch (error: any) {
      logger.error(`请求失败: ${safeUrl(url)}，错误类型: ${error?.name ?? 'Error'}`)
      return false
    }
  }
}()
