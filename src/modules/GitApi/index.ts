import { request, logger } from '@/utils'
import config from '@/config'
import type { Response } from 'node-fetch'
import type { Commit, GitApiMethod, GitCommitDataType, GitReleaseDataType, GitActivityMethod, GitActivityItem, GitActivityComment, GitPullRequestDiff, GitPullRequestFile } from '@/types'
import { releaseIdentity } from '../CodeUpdate/utils/release'
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

function validCommit (commit: Commit) {
  return typeof commit?.sha === 'string' && !!commit.sha && typeof commit.commit?.message === 'string' &&
    (commit.parents === undefined || (Array.isArray(commit.parents) && commit.parents.every(parent =>
      typeof parent?.sha === 'string' && !!parent.sha && parent.sha !== commit.sha)))
}

/** Inspect only known parent links; dates cannot identify a Git ancestry boundary. */
function commitRange (commits: Map<string, Commit>, base: string, head: string) {
  const old = new Set<string>()
  const oldFrontier = new Set<string>()
  let metadataMissing = false
  const ancestors = [base]
  while (ancestors.length) {
    const sha = ancestors.pop()!
    if (old.has(sha)) continue
    old.add(sha)
    const commit = commits.get(sha)
    if (!commit) oldFrontier.add(sha)
    else if (!commit.parents) metadataMissing = true
    else ancestors.push(...commit.parents.map(parent => parent.sha))
  }

  const added = new Set<string>()
  const newFrontier = new Set<string>()
  let reachedBase = false
  const pending = [head]
  while (pending.length) {
    const sha = pending.pop()!
    if (sha === base) reachedBase = true
    if (old.has(sha) || added.has(sha) || newFrontier.has(sha)) continue
    const commit = commits.get(sha)
    if (!commit) { newFrontier.add(sha); continue }
    added.add(sha)
    if (!commit.parents) metadataMissing = true
    else pending.push(...commit.parents.map(parent => parent.sha))
  }

  // A candidate must descend from every unresolved old frontier. Otherwise a
  // not-yet-read old parent could still lead to that candidate (e.g. an old merge).
  // Reverse edges let us prove this without recursively walking each candidate.
  let complete = !metadataMissing && !newFrontier.size && reachedBase
  if (complete && oldFrontier.size) {
    const children = new Map<string, string[]>()
    for (const commit of commits.values()) {
      for (const parent of commit.parents ?? []) {
        const values = children.get(parent.sha) ?? []
        values.push(commit.sha)
        children.set(parent.sha, values)
      }
    }
    for (const sha of oldFrontier) {
      const descendants = [sha]
      const seen = new Set<string>()
      let count = 0
      while (descendants.length && count < added.size) {
        const current = descendants.pop()!
        if (seen.has(current)) continue
        seen.add(current)
        if (added.has(current)) count++
        descendants.push(...children.get(current) ?? [])
      }
      if (count !== added.size) { complete = false; break }
    }
  }
  return { added, newFrontier, oldFrontier, reachedBase, metadataMissing, complete }
}

/** Parent-before-child order is stable even when author/committer dates are equal or old. */
function orderCommits (commits: Map<string, Commit>, added: Set<string>): Commit[] | false {
  const counts = new Map<string, number>()
  const children = new Map<string, string[]>()
  for (const sha of added) {
    const parents = new Set(commits.get(sha)!.parents?.map(parent => parent.sha).filter(parent => added.has(parent)))
    counts.set(sha, parents.size)
    for (const parent of parents) {
      const values = children.get(parent) ?? []
      values.push(sha)
      children.set(parent, values)
    }
  }
  const ready = Array.from(added).filter(sha => !counts.get(sha))
  const result: Commit[] = []
  for (let offset = 0; offset < ready.length; offset++) {
    const sha = ready[offset]
    result.push(commits.get(sha)!)
    for (const child of children.get(sha) ?? []) {
      const remaining = counts.get(child)! - 1
      counts.set(child, remaining)
      if (!remaining) ready.push(child)
    }
  }
  return result.length === added.size ? result : false
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
    if (method === 'releases') {
      // An authenticated list may start with drafts. Read until the first published
      // release so published-only subscriptions are never blocked by those drafts.
      url.searchParams.delete('per_page')
      url.searchParams.set(isGitea ? 'limit' : isCNB ? 'page_size' : 'per_page', '100')
      const result: GitReleaseDataType = []
      const seen = new Set<string>()
      for (let page = 1; page <= 100; page++) {
        url.searchParams.set('page', String(page))
        const pagination: { hasNext?: boolean } = {}
        const data = await this.fetchData<GitReleaseDataType>(url, headers, repo, source, pagination)
        if (data === false) return false as any
        if (!Array.isArray(data) || data.some(release => !release || !releaseIdentity(release))) {
          logger.error(`${source} ${repo} 的 Release 接口未返回有效列表`)
          return false as any
        }
        for (const release of data) {
          const id = releaseIdentity(release)
          if (seen.has(id)) {
            logger.error(`${source} ${repo} 的 Release 分页未前进，跳过本次检查`)
            return false as any
          }
          seen.add(id)
          result.push(release)
          if (!release.draft) return result as any
        }
        if (!data.length || pagination.hasNext === false) return result as any
      }
      logger.error(`${source} ${repo} 的 Release 草稿超过分页上限，跳过本次检查`)
      return false as any
    }
    logger.trace('请求 URL:', safeUrl(url))
    return await this.fetchData<GitCommitDataType | GitReleaseDataType>(url, headers, repo, source) as any
  }

  /** Freeze the tip for every page and return only a completely observed commit range. */
  async getCommitUpdates (
    source: Provider,
    repo: string,
    baseSha: string,
    headSha: string,
    options: { pageSize?: number, maxPages?: number } = {}
  ): Promise<{ commits: Commit[], reset: boolean } | false> {
    if (baseSha === headSha) return { commits: [], reset: false }
    const pageSize = Math.max(1, Math.min(100, Math.floor(options.pageSize || 100)))
    const maxPages = Math.max(1, Math.min(1000, Math.floor(options.maxPages || 20)))
    if (/cnb/i.test(source)) return this.getCNBCommitUpdates(source, repo, baseSha, headSha, pageSize * maxPages)
    const { apiUrl, token } = apiUrlFor(source)
    if (!apiUrl) return false
    const url = new URL(apiUrl)
    url.pathname = `${basePath(url.pathname)}/${repo.split('/').map(encodeURIComponent).join('/')}/commits`
    url.searchParams.set('sha', headSha)
    url.searchParams.set(/gitea/i.test(source) ? 'limit' : 'per_page', String(pageSize))
    if (/gitee/i.test(source) && token) url.searchParams.set('access_token', token)
    const commits = new Map<string, Commit>()
    let warnedParents = false
    for (let page = 1; page <= maxPages; page++) {
      url.searchParams.set('page', String(page))
      const pagination: { hasNext?: boolean } = {}
      const data = await this.fetchData<Commit[]>(url, this.getHeaders(source, token), repo, source, pagination)
      if (data === false) return false
      if (!Array.isArray(data) || data.some(commit => !validCommit(commit))) {
        logger.error(`${source} ${repo} 的 Commit 接口未返回有效列表，保留检查进度`)
        return false
      }
      const previous = commits.size
      for (const commit of data) if (!commits.has(commit.sha)) commits.set(commit.sha, commit)
      const range = commitRange(commits, baseSha, headSha)
      if (range.metadataMissing) {
        if (!warnedParents) {
          logger.warn(`${source} ${repo} 的 Commit 列表缺少父提交信息，按旧 SHA 的列表边界扫描`)
          warnedParents = true
        }
        const values = Array.from(commits.values())
        const boundary = values.findIndex(commit => commit.sha === baseSha)
        const head = values.findIndex(commit => commit.sha === headSha)
        if (head >= 0 && boundary > head && orderCommits(commits, new Set(commits.keys())) !== false) {
          return { commits: values.slice(0, boundary).reverse(), reset: false }
        }
      } else if (range.complete) {
        const ordered = orderCommits(commits, range.added)
        if (ordered !== false && orderCommits(commits, new Set(commits.keys())) !== false) return { commits: ordered, reset: false }
        logger.error(`${source} ${repo} 的 Commit 父链接形成循环，保留检查进度`)
        return false
      }
      if (!data.length || pagination.hasNext === false) {
        const head = commits.get(headSha)
        if (head && !range.reachedBase && (range.metadataMissing ? !commits.has(baseSha) : !range.newFrontier.size) &&
          orderCommits(commits, new Set(commits.keys())) !== false) {
          return { commits: [head], reset: true }
        }
        logger.error(`${source} ${repo} 的 Commit 列表未能证明完整新增范围，保留检查进度`)
        return false
      }
      if (commits.size === previous) {
        logger.error(`${source} ${repo} 的 Commit 分页未前进，保留检查进度`)
        return false
      }
      // A provider may cap page size below the request; a short page is not an end marker.
    }
    logger.error(`${source} ${repo} 的 Commit 数据超过单次分页上限，未推进检查进度；请调高 CodeUpdate.Activity.MaxPages`)
    return false
  }

  /** CNB's existing SHA-detail endpoint avoids assuming an undocumented list-ref parameter. */
  private async getCNBCommitUpdates (source: Provider, repo: string, base: string, head: string, budget: number): Promise<{ commits: Commit[], reset: boolean } | false> {
    const commits = new Map<string, Commit>()
    while (commits.size < budget) {
      const range = commitRange(commits, base, head)
      if (range.metadataMissing) {
        logger.error(`${source} ${repo} 的 Commit 详情缺少父提交信息，保留检查进度`)
        return false
      }
      if (range.complete) {
        const ordered = orderCommits(commits, range.added)
        return ordered === false || orderCommits(commits, new Set(commits.keys())) === false ? false : { commits: ordered, reset: false }
      }
      if (!range.newFrontier.size && !range.reachedBase && commits.has(head)) {
        if (orderCommits(commits, new Set(commits.keys())) === false) return false
        return { commits: [commits.get(head)!], reset: true }
      }
      const next = Array.from(range.newFrontier.size ? range.newFrontier : range.oldFrontier)
        .filter(sha => !commits.has(sha)).slice(0, Math.min(4, budget - commits.size))
      if (!next.length) return false
      const results = await Promise.all(next.map(sha => this.getRepositoryData(source, repo, 'commits', sha)))
      for (let index = 0; index < results.length; index++) {
        const commit = results[index]
        if (commit === false || Array.isArray(commit) || !validCommit(commit) || commit.sha !== next[index]) {
          logger.error(`${source} ${repo} 的 Commit 详情与固定 SHA 不一致或获取失败，保留检查进度`)
          return false
        }
        commits.set(commit.sha, commit)
      }
    }
    const range = commitRange(commits, base, head)
    if (range.complete) {
      const ordered = orderCommits(commits, range.added)
      if (ordered !== false && orderCommits(commits, new Set(commits.keys())) !== false) return { commits: ordered, reset: false }
    }
    if (!range.metadataMissing && !range.newFrontier.size && !range.reachedBase && commits.has(head) &&
      orderCommits(commits, new Set(commits.keys())) !== false) {
      return { commits: [commits.get(head)!], reset: true }
    }
    logger.error(`${source} ${repo} 的 Commit 父链超过单次扫描上限，未推进检查进度；请调高 CodeUpdate.Activity.MaxPages`)
    return false
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

  /** Optional enrichment: read only enough files to decide whether the image should collapse. */
  async getPullRequestDiff (source: Provider, repo: string, number: string, maxFiles: number): Promise<GitPullRequestDiff | false> {
    const { url, headers } = this.activityUrl(source, repo, /gitea/i.test(source)
      ? `pulls/${encodeURIComponent(number)}.diff`
      : `pulls/${encodeURIComponent(number)}/files`)
    if (/gitea/i.test(source)) {
      // Gitea's file-list API omits patches; its raw diff endpoint supplies the actual code.
      try {
        const response = await request.get(url, 'raw', { headers: { ...headers, Accept: 'text/plain' }, log: false })
        if (!response || !response.ok) return false
        const { text, truncated } = await this.readLimitedBody(response, 512 * 1024)
        if (text.trim() && !/^diff --git /m.test(text)) return false
        return { kind: 'unified', text, truncated }
      } catch (error: any) {
        logger.warn(`获取 ${source} ${repo} PR #${number} diff 失败: ${error?.name ?? 'Error'}`)
        return false
      }
    }
    const pageSize = Math.max(2, Math.min(21, maxFiles + 1))
    url.searchParams.set('per_page', String(pageSize))
    const files = new Map<string, GitPullRequestFile>()
    for (let page = 1; page <= pageSize + 1; page++) {
      url.searchParams.set('page', String(page))
      const pagination: { hasNext?: boolean } = {}
      const data = await this.fetchData<GitPullRequestFile[]>(url, headers, repo, source, pagination, 512 * 1024)
      if (data === false || !Array.isArray(data)) return false
      const size = files.size
      for (const file of data) {
        const filename = file?.filename || file?.new_path || file?.old_path
        if (typeof filename !== 'string' || !filename) return false
        files.set(filename, file)
      }
      if (files.size > maxFiles) return { kind: 'files', files: Array.from(files.values()).slice(0, pageSize), hasMore: true }
      if (!data.length || pagination.hasNext === false) return { kind: 'files', files: Array.from(files.values()), hasMore: false }
      if (files.size === size) return false
    }
    return false
  }

  private async readLimitedBody (response: Response, limit: number) {
    const chunks: Buffer[] = []
    let length = 0
    let truncated = false
    if (response.body) {
      for await (const chunk of response.body) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        const remaining = limit - length
        chunks.push(bytes.subarray(0, remaining))
        length += Math.min(bytes.length, remaining)
        if (bytes.length > remaining) { truncated = true; break }
      }
    }
    return { text: Buffer.concat(chunks).toString('utf8'), truncated }
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
  async fetchData<T = any> (url: string | URL, headers: Record<string, string> = {}, repo?: string, source?: Provider, pagination?: { hasNext?: boolean }, maxBytes?: number): Promise<T | false> {
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

      if (maxBytes && response.body) {
        const { text, truncated } = await this.readLimitedBody(response, maxBytes)
        if (truncated) {
          logger.warn(`${source} ${repo} diff响应过大，改用PR原文查看`)
          return false
        }
        return JSON.parse(text) as T
      }
      return await response.json() as T
    } catch (error: any) {
      logger.error(`请求失败: ${safeUrl(url)}，错误类型: ${error?.name ?? 'Error'}`)
      return false
    }
  }
}()
