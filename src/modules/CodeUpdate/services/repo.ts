import GitApi from '@/modules/GitApi'
import type { Commit, Release, RepositoryInfo } from '@/types'
import { redisHeler, formatCommitInfo, formatReleaseInfo, repoPath, getRepoKey, getRepoType, getRepoRedisKey, resolveBranch } from '@CodeUpdate/utils'
import { releaseCursor, releaseIdentity } from '../utils/release'
import config from '@/config'
import { logger } from '@/utils'
import { fetchActivity } from './activity'
import { formatActivityInfo } from '../utils/formatActivity'
import { isActivityMethod } from '../utils/activity'
import type { RepoConfig, SubscriptionTarget } from '../utils/repo'

export type ReposListType = RepoConfig[]

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
  const previous = [...repoList, ...subscriptions]
    .map(item => ({ ...item }))
  const repos = new Map(repoList.map(item => [getRepoKey(item), { ...item }]))
  const releases = new Map<string, ReturnType<typeof GitApi.getRepositoryData<'releases'>>>()
  await Promise.all(Array.from(repos, async ([key, item]) => {
    const { provider, repo } = item
    if (!repo) return
    const type = getRepoType(item.type)
    const logRepo = repoPath(repo, item.branch)
    const redisKey = getRepoRedisKey(item)
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
      let result
      if (type === 'releases') {
        const requestKey = JSON.stringify([provider.toLowerCase(), repo])
        let pending = releases.get(requestKey)
        if (!pending) {
          pending = GitApi.getRepositoryData(provider, repo, 'releases')
          releases.set(requestKey, pending)
        }
        result = await pending
      } else result = await GitApi.getRepositoryData(provider, repo, type, branch)
      if (result === false) return
      const data = Array.isArray(result)
        ? type === 'releases' ? result.find(value => item.includeDrafts || !(value as Release).draft) : result[0]
        : result
      if (!data) {
        // An empty published list (including draft-only repositories) is still a
        // baseline, so its first future publication is treated as a new update.
        if (type === 'releases' && isAuto && await redisHeler.isUpdate(redisKey, 'release:empty') === null) {
          await redisHeler.updatesSha(redisKey, 'release:empty')
        }
        logger.warn(`[${logger.magenta(provider)}]: ${logger.cyan(logRepo)} 数据为空`)
        return
      }
      const sha = type === 'commits' ? data.sha : releaseCursor(data as Release)
      if (!sha) {
        logger.warn(`[${logger.magenta(provider)}]: ${logger.cyan(logRepo)} 缺少更新标识`)
        return
      }
      if (isAuto) {
        let current = await redisHeler.isUpdate(redisKey, sha)
        if (type === 'releases' && current !== true && !(data as Release).draft) {
          const legacyKeys = current === null && !item.includeDrafts
            ? previous.filter(candidate => getRepoKey(candidate) === key)
              .map(candidate => redisHeler.getLegacyRedisKey(candidate.provider, type, repo, candidate.branch))
            : []
          if (await migrateReleaseCursor(redisKey, sha, releaseIdentity(data as Release), key, targets, legacyKeys)) current = true
        }
        if (current === null && !(type === 'releases' && item.includeDrafts)) {
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

/** Upgrade ID-only records without replaying already acknowledged publications. */
async function migrateReleaseCursor (
  redisKey: string,
  sha: string,
  legacySha: string,
  repoKey: string,
  targets: Map<string, SubscriptionTarget>,
  legacyKeys: string[]
) {
  for (const source of new Set([redisKey, ...legacyKeys])) {
    if (!await redisHeler.isUpdate(source, legacySha)) continue
    for (const [target, { repos }] of targets) {
      if (!repos.has(repoKey)) continue
      const deliveryKey = redisHeler.getDeliveryKey(redisKey, target)
      const current = await redisHeler.isUpdate(deliveryKey, legacySha)
      if (current || (current === null && source !== redisKey && await redisHeler.isUpdate(redisHeler.getDeliveryKey(source, target), legacySha))) {
        await redisHeler.updatesSha(deliveryKey, sha)
      }
    }
    // Recipient records first; a failed upgrade can safely retry before advancing the baseline.
    await redisHeler.updatesSha(redisKey, sha)
    return true
  }
  return false
}
