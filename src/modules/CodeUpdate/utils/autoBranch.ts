import type { Config } from '@/types'
import GitApi from '@/modules/GitApi'
import { defaultBranchMap } from '@CodeUpdate/data'
import { logger } from '@/utils'
import config from '@/config'

async function getDefaultBranch (cfg: Config['CodeUpdate']['List'][number]['repos'][number]) {
  const { provider, repo, branch, type } = cfg
  if (type !== 'commits' || branch) return false
  try {
    const defaultBranch = await GitApi.getDefaultBranch(provider, repo)
    if (defaultBranch === false) return false
    if (!defaultBranch) throw new Error(`接口无效返回: ${defaultBranch}`)

    defaultBranchMap.set(repo, branch)
    cfg.branch = defaultBranch
    return true
  } catch (error: any) {
    logger.warn(`获取 ${provider} 的默认分支失败 ${repo}: ${(error && error.message) || error}`)
    return false
  }
}

export async function autoFillDefaultBranches () {
  if (!config.CodeUpdate.AutoBranch) return

  const allRepos = (config.CodeUpdate.List || [])
    .flatMap(item => item.repos || [])

  const results = await Promise.all(allRepos.map(getDefaultBranch))
  const num = results.filter(Boolean).length

  if (num > 0) {
    logger.info(`已自动获取到 ${logger.blue(num)} 个仓库的默认分支`)
  }
}
