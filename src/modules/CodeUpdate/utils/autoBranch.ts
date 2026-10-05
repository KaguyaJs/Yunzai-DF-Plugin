import type { Config } from '@/types'
import GitApi from '@/modules/GitApi'
import { defaultBranchMap } from '@CodeUpdate/data'
import { logger } from '@/utils'
import config from '@/config'

/** 解析请求分支，保留用户配置及其缓存标识。 */
export async function resolveBranch (cfg: Config['CodeUpdate']['List'][number]['repos'][number]): Promise<string> {
  const { provider, repo, branch, type } = cfg
  if (branch || !config.CodeUpdate.AutoBranch || (type !== 'commits' && type !== 'commit')) return branch ?? ''

  const key = `${provider.toLowerCase()}:${repo}`
  let pending = defaultBranchMap.get(key)
  if (!pending) {
    pending = GitApi.getDefaultBranch(provider, repo)
      .then(defaultBranch => {
        if (!defaultBranch) defaultBranchMap.delete(key)
        return defaultBranch || ''
      })
      .catch((error: any) => {
        defaultBranchMap.delete(key)
        logger.warn(`获取 ${provider} 的默认分支失败 ${repo}: ${error?.name ?? 'Error'}`)
        return ''
      })
    defaultBranchMap.set(key, pending)
  }
  return pending
}
