import config from '@/config'
import GitApi from '@/modules/GitApi'
import GitRepo from '@/utils/GitRepo'
import { logger } from '@/utils'
import { normalizeRepository } from '../../../config/codeUpdateMigration'
import { getRepoKey, repoPath } from '../utils/repo'
import type { RepoConfig, SubscriptionTarget } from '../utils/repo'

/** One expansion shared by fetching, recipient routing and key cleanup. */
export async function subscriptionSnapshot () {
  const branches = new Map<string, Promise<string[] | false>>()
  let complete = true
  const strategies = await Promise.all((config.CodeUpdate.List ?? []).map(async strategy => {
    const raw: Parameters<typeof normalizeRepository>[0][] = [...strategy.repos ?? []]
    if (strategy.AutoPath) {
      raw.push(...GitRepo.PluginPath.filter(repo => !strategy.Exclude?.includes(repoPath(repo.repo, repo.branch))))
    }
    const expanded = await Promise.all(raw.map(async item => {
      try {
        const repo = normalizeRepository(item)
        const result: RepoConfig[] = []
        for (const type of repo.type) {
          if (type !== 'commits') {
            result.push({ ...repo, type, branch: '' })
            continue
          }
          let names = repo.branch?.length ? repo.branch : ['']
          if (names.includes('all')) {
            const key = JSON.stringify([repo.provider.toLowerCase(), repo.repo])
            let pending = branches.get(key)
            if (!pending) {
              pending = GitApi.getBranches(repo.provider, repo.repo)
              branches.set(key, pending)
            }
            const remote = await pending
            if (remote === false) {
              complete = false
              logger.warn(`获取 ${repo.provider} ${repo.repo} 的全部分支失败，跳过本次提交检查`)
              continue
            }
            names = remote
          }
          result.push(...names.map(branch => ({ ...repo, type, branch })))
        }
        return result
      } catch (error) {
        complete = false
        logger.error('展开仓库监听配置失败: ', error)
        return []
      }
    }))
    return { strategy, repos: expanded.flat() }
  }))
  const subscriptions = strategies.flatMap(item => item.repos)
  const repos = Array.from(new Map(subscriptions.map(repo => [getRepoKey(repo), repo])).values())
  const targets = new Map<string, SubscriptionTarget>()
  for (const { strategy, repos } of strategies) {
    for (const type of ['Group', 'QQ'] as const) {
      for (const id of strategy[type] ?? []) {
        const key = `${type}:${id}`
        let target = targets.get(key)
        if (!target) {
          target = { type, id: String(id), repos: new Map() }
          targets.set(key, target)
        }
        for (const repo of repos) {
          const repoKey = getRepoKey(repo)
          const rules = target.repos.get(repoKey) ?? []
          rules.push(repo)
          target.repos.set(repoKey, rules)
        }
      }
    }
  }
  return { repos, subscriptions, targets, complete }
}
