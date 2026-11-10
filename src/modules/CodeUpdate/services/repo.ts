import GitApi from '@/modules/GitApi'
import type { Commit, Config, Release, RepositoryInfo } from '@/types'
import { redisHeler, formatCommitInfo, formatReleaseInfo, repoPath, getRepoKey, getRepoType, getRepoBranch, resolveBranch } from '@CodeUpdate/utils'
import config from '@/config'
import { logger } from '@/utils'
import { fetchActivity } from './activity'
import { formatActivityInfo } from '../utils/formatActivity'
import { isActivityMethod } from '../utils/activity'
import type { RepoConfig, SubscriptionTarget } from '../utils/repo'

export type ReposListType = Config['CodeUpdate']['List'][number]['repos']

export interface RepositoryUpdate {
  info: RepositoryInfo
  sha: string
  redisKey: string
  repoKey: string
  activity?: { journalKey: string, eventId: string, targets: string[] }
}

/** Fetch each subscription once without acknowledging undelivered updates. */
export async function fetchUpdate (repoList: ReposListType, isAuto: boolean, targets = new Map<string, SubscriptionTarget>(), subscriptions: RepoConfig[] = repoList) {
  const content = new Map<string, RepositoryUpdate>()
  const previous = [...repoList, ...config.CodeUpdate.List.flatMap(strategy => strategy.repos ?? [])]
    .map(item => ({ ...item }))
  const repos = new Map(repoList.map(item => [getRepoKey(item), { ...item }]))
  await Promise.all(Array.from(repos, async ([key, item]) => {
    const { provider, repo } = item
    if (!repo) return
    const type = getRepoType(item.type)
    const logRepo = repoPath(repo, item.branch)
    const redisKey = redisHeler.getRedisKey(provider, type, repo, getRepoBranch(item))
    try {
      if (isActivityMethod(type)) {
        const activities = await fetchActivity(item, isAuto, targets, subscriptions.filter(candidate => getRepoKey(candidate) === key))
        for (const { event, journalKey, targets } of activities) {
          try {
            const info = await formatActivityInfo(event)
            content.set(event.id, { info, sha: event.id, redisKey, repoKey: key, activity: { journalKey, eventId: event.id, targets } })
          } catch (error) {
            logger.error(`渲染 ${provider} ${repo} #${event.item.number} 数据失败: `, error)
          }
        }
        return
      }
      const branch = await resolveBranch(item)
      logger.debug(`请求 ${logger.magenta(provider)} ${type}: ${logger.cyan(logRepo)}`)
      const result = await GitApi.getRepositoryData(provider, repo, type, branch)
      if (result === false) return
      const data = Array.isArray(result) ? result[0] : result
      if (!data || (type === 'releases' && !data.tag_name)) {
        logger.warn(`[${logger.magenta(provider)}]: ${logger.cyan(logRepo)} 数据为空`)
        return
      }
      const sha = type === 'commits' ? data.sha : data.node_id || String(data.id ?? data.tag_name ?? '')
      if (!sha) {
        logger.warn(`[${logger.magenta(provider)}]: ${logger.cyan(logRepo)} 缺少更新标识`)
        return
      }
      if (isAuto) {
        let current = await redisHeler.isUpdate(redisKey, sha)
        if (current === null) {
          for (const candidate of previous.filter(candidate => getRepoKey(candidate) === key)) {
            const legacyKey = redisHeler.getLegacyRedisKey(candidate.provider, type, repo, candidate.branch)
            if (legacyKey === redisKey) continue
            current = await redisHeler.isUpdate(legacyKey, sha)
            if (current !== null) break
          }
          if (current) await redisHeler.updatesSha(redisKey, sha)
        }
        if (current) return
        if (current === null && !config.CodeUpdate.FirstAdd) {
          await redisHeler.updatesSha(redisKey, sha)
          return
        }
        logger.mark(`[${logger.magenta(provider)}]: ${logger.cyan(logRepo)} 检测到更新`)
      }
      const info = await (type === 'commits'
        ? formatCommitInfo(data as Commit, provider, repo, branch)
        : formatReleaseInfo(data as Release, provider, repo))
      content.set(key, { info, sha, redisKey, repoKey: key })
    } catch (error) {
      logger.error(`获取 ${logger.magenta(provider)} ${type} ${logger.cyan(logRepo)} 数据出错: `, error)
    }
  }))
  return content
}
