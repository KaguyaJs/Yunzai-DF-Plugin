import fs from 'node:fs/promises'
import path from 'node:path'
import { YunzaiPath } from '@/dir'
import Config from '@/config'
import { createTimer } from './time'
import { logger } from './logger'
import { exec } from './exec'

/**
 * 单个插件仓库项
 */
export interface PluginItem {
  provider: string // 平台：github / gitee / ... (小写)
  repo: string // owner/repo
  branch: string
  type: 'commit'
}

/** PluginPath */
export const PluginPath: PluginItem[] = []

/** 当前是否正在加载 */
export let Loading = false

/** 默认忽略目录 (可覆盖) */
const DEFAULT_IGNORE = ['data', 'node_modules', 'temp', 'logs', 'cache', 'dist']
let IGNORE = new Set(DEFAULT_IGNORE)

/** host 列表 */
export type Host = {
  key: string
  pattern: RegExp
}

const hosts: Host[] = []

/** 内置 host 映射 */
const HostList: Record<string, string> = {
  GitHub: 'github.com',
  Gitee: 'gitee.com',
  Gitcode: 'gitcode.com',
  CNB: 'cnb.cool'
}

/** 仓库映射：provider(lowercase) => [{repo, branch}, ...] */
export type RepoMap = Record<string, { repo: string; branch: string }[]>

/** 简单的 escapeRegExp，替换 lodash 依赖 */
function escapeRegExp (s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 注册平台 */
export function registerHost (key: string, pattern: RegExp) {
  hosts.push({ key: String(key), pattern })
}

// 初始化内置 hosts（只生成一次）
Object.entries(HostList).forEach(([key, host]) => {
  const pattern = new RegExp(`${escapeRegExp(host)}[:/](?<repo>[^/]+\\/[^/]+?)(?:\\.git)?$`, 'i')
  registerHost(key, pattern)
})

/** 覆盖忽略 */
export function setIgnore (list: string[]) {
  IGNORE = new Set(list)
}

/** 追加忽略 */
export function addIgnore (list: string[]) {
  for (const item of list) IGNORE.add(item)
}

/** 是否为 Git 仓库 */
export async function isGitRepo (dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, '.git'))
    return true
  } catch {
    return false
  }
}

/** 执行命令，返回输出字符串 */
export async function execCmd (cwd: string, cmd: string): Promise<string> {
  try {
    const out = await exec(cmd, cwd, true)
    return (typeof out === 'string' ? out : String(out)).trim()
  } catch (err: any) {
    throw new Error(err?.message || String(err))
  }
}

/** 加载本地插件 */
export async function loadLocalPlugins (root: string = YunzaiPath): Promise<void> {
  Loading = true
  const timer = createTimer()
  logger.mark('正在载入本地Git仓库列表')
  timer.start()

  PluginPath.length = 0

  try {
    const found = await findRepos(path.resolve(root))

    // 合并到 PluginPath（保持 provider 小写，和原来兼容）
    for (const provider of Object.keys(found)) {
      const list = found[provider]
      for (const item of list) {
        PluginPath.push({ provider, repo: item.repo, branch: item.branch, type: 'commit' })
      }
    }
  } catch (err) {
    logger.error('加载本地Git仓库时出错:', err)
    throw err
  } finally {
    Loading = false
    logger.mark(`本地Git仓库载入完成, 耗时: ${timer.end()}`)
  }
}

/** 扫描根目录，返回 RepoMap */
export async function findRepos (rootDir: string): Promise<RepoMap> {
  // 预先构造结果结构，避免后续判断
  const result: RepoMap = {}
  for (const h of hosts) result[h.key] = []

  await traverse(rootDir, result)
  return result
}

/** 递归遍历目录（忽略非目录与 IGNORE 列表） */
export async function traverse (dir: string, result: RepoMap): Promise<void> {
  try {
    if (await isGitRepo(dir)) {
      await collectRepoInfo(dir, result)
    }

    const dirents = await fs.readdir(dir, { withFileTypes: true })
    for (const d of dirents) {
      if (!d.isDirectory()) continue
      if (IGNORE.has(d.name)) continue

      const sub = path.join(dir, d.name)
      try {
        await traverse(sub, result)
      } catch (err) {
        logger.warn(`无法扫描子文件夹: ${sub} -> ${err}`)
      }
    }
  } catch (err) {
    logger.warn(`无法扫描文件夹: ${dir} -> ${err}`)
  }
}

/** 收集单个仓库信息（branch + remote url），尽量简单可靠 */
export async function collectRepoInfo (repoDir: string, result: RepoMap): Promise<void> {
  try {
    let branch = 'HEAD'
    try {
      const out = await execCmd(repoDir, 'git rev-parse --abbrev-ref HEAD')
      if (out) branch = out.split(/\r?\n/)[0].trim()
    } catch {
      try {
        const o = await execCmd(repoDir, 'git branch --show-current')
        if (o) branch = o.split(/\r?\n/)[0].trim()
      } catch { /* 忽略 */ }
    }

    let remoteName = 'origin'
    try {
      const configured = await execCmd(repoDir, `git config branch.${branch}.remote`)
      if (configured) remoteName = configured
    } catch {
    }

    let url = ''
    try {
      url = (await execCmd(repoDir, `git remote get-url ${remoteName}`)).trim()
    } catch {
      try {
        const remotes = await execCmd(repoDir, 'git remote -v')
        for (const l of remotes.split(/\r?\n/)) {
          const m = l.match(/\s*(\S+)\s+(\S+)\s+\(fetch\)/)
          if (m) { url = m[2]; break }
        }
      } catch {
      }
    }

    if (!url) {
      logger.warn(`仓库未发现远程地址: ${repoDir}`)
      return
    }

    classify(url.trim(), branch, result)
  } catch (err: any) {
    logger.warn(`Git仓库信息收集失败: ${repoDir} -> ${err}`)
  }
}

/** 分类：从 URL 中识别 provider 与 repo，push 到 result 相应数组中 */
export function classify (url: string, branch: string, result: RepoMap): void {
  for (const { key, pattern } of hosts) {
    const m = url.match(pattern)
    if (m && m.groups?.repo) {
      const provider = key
      // 容错：如果 result 中没有该 provider（理论上不该发生），先创建
      if (!result[provider]) result[provider] = []

      result[provider].push({ repo: m.groups.repo, branch })
      return
    }
  }
  // 未匹配任何已知 host 不报错，仅记录
  logger.debug && logger.debug(`无法识别远程地址平台: ${url}`)
}

if (Config.AutoPath) {
  loadLocalPlugins().catch(err => logger.warn('载入本地Git仓库失败', err))
}

export default {
  registerHost,
  loadLocalPlugins,
  setIgnore,
  addIgnore,
  PluginPath,
  hosts
}
