import type { RepoConfig } from './repo'
import GitApi from '@/modules/GitApi'
import { defaultBranchMap } from '@CodeUpdate/data'

/** 解析请求分支，保留用户配置及其缓存标识。 */
export async function resolveBranch (cfg: RepoConfig): Promise<string> {
  const { provider, repo, branch, type } = cfg
  if (type !== 'commits' && type !== 'commit') return ''
  if (branch) return branch

  const key = `${provider.toLowerCase()}:${repo}`
  let cached = defaultBranchMap.get(key)
  if (!cached || cached.expires <= Date.now()) {
    const pending = GitApi.getDefaultBranch(provider, repo)
      .then(defaultBranch => {
        if (!defaultBranch) throw new Error(`获取 ${provider} ${repo} 的默认分支失败，跳过本次提交检查`)
        return defaultBranch
      })
      .catch(error => {
        defaultBranchMap.delete(key)
        throw error
      })
    cached = { pending, expires: Date.now() + 5 * 60 * 1000 }
    defaultBranchMap.set(key, cached)
  }
  return cached.pending
}
