import config from '@/config'
import { logger } from '@/utils'
import type { icqq, MessageEvent } from 'trss-yunzai'
import { fetchUpdate } from './services'
import { pushTouser } from './services/push'
import { generateScreenshot } from './services/screenshot'
import GitRepo from '@/utils/GitRepo'
import { redisHeler, repoPath, getRepoKey, getRepoType, getRepoBranch } from './utils'
import type { RepoConfig, SubscriptionTarget } from './utils/repo'
import { activityOptions, isActivityMethod } from './utils/activity'
import type { RepositoryUpdate } from './services/repo'

let checking = false

/** Serialize automatic and manual checks; always release the lock. */
export async function CodeUpdate (isAuto: boolean = true, e?: MessageEvent): Promise<number | false> {
  if (checking) {
    if (e) await e.reply('正在检查仓库更新，请稍后再试')
    return false
  }
  checking = true
  try {
    return await checkUpdates(isAuto, e)
  } finally {
    checking = false
  }
}

async function checkUpdates (isAuto: boolean, e?: MessageEvent) {
  const { List } = config.CodeUpdate
  if (!List?.length) {
    logger.warn('未配置推送列表')
    if (e) await e.reply('请先配置需要监听的仓库')
    return false
  }
  const repos = getRepos(true)
  if (!repos.length) return false
  if (e) await e.reply(`正在${isAuto ? '检查' : '推送'}仓库更新，请稍等`)
  logger.mark(logger.cyan('开始检查仓库更新'))
  const targets = getTargets(List)
  const updates = await fetchUpdate(repos, isAuto, targets, getSubscriptions())
  if (!updates.size) {
    logger.info(logger.yellow('未检测到仓库更新'))
    return 0
  }
  const repositoryCount = new Set(Array.from(updates.values(), update => JSON.stringify([update.info.name.source.toLowerCase(), update.info.name.repo]))).size
  logger.info(logger.green(`共获取到 ${repositoryCount} 个仓库的 ${updates.size} 条更新`))
  if (!isAuto && e) {
    for (const batch of updateBatches(Array.from(updates.values()))) {
      const image = await generateScreenshot(batch.map(update => update.info), String(e.user_id))
      if (!image || (Array.isArray(image) && !image.length)) {
        await e.reply('截图失败，请稍后再试')
        return false
      }
      await e.reply(withActivityLinks(image, batch))
    }
    return repositoryCount
  }

  const images = new Map<string, icqq.ImageElem | icqq.ImageElem[]>()
  const failed = new Set<string>()
  for (const [targetKey, { type, id, repos }] of targets) {
    const assigned = Array.from(updates).filter(([, update]) => update.activity
      ? update.activity.targets.includes(targetKey)
      : repos.has(update.repoKey)).map(([key]) => key)
    if (!assigned.length) continue
    try {
      const pending: string[] = []
      for (const key of assigned) {
        const update = updates.get(key)!
        const deliveryKey = redisHeler.getDeliveryKey(update.redisKey, targetKey)
        if (update.activity || !isAuto || !await redisHeler.isUpdate(deliveryKey, update.sha)) pending.push(key)
      }
      if (!pending.length) continue
      for (const batch of updateBatches(pending.map(key => updates.get(key)!))) {
        const imageKey = JSON.stringify(batch.map(update => JSON.stringify([update.repoKey, update.sha])).sort())
        let image = images.get(imageKey)
        if (!image) {
          const result = await generateScreenshot(batch.map(update => update.info), id)
          if (!result || (Array.isArray(result) && !result.length)) throw new Error('截图失败')
          image = result
          images.set(imageKey, image)
        }
        if (!await pushTouser(type, id, withActivityLinks(image, batch))) throw new Error('消息发送失败')
        if (isAuto) {
          const activities = new Map<string, string[]>()
          for (const update of batch) {
            if (update.activity) {
              const { journalKey, eventId } = update.activity
              const ids = activities.get(journalKey) ?? []
              ids.push(eventId)
              activities.set(journalKey, ids)
            } else {
              await redisHeler.updatesSha(redisHeler.getDeliveryKey(update.redisKey, targetKey), update.sha)
            }
          }
          for (const [key, ids] of activities) await redisHeler.acknowledgeActivities(key, ids, targetKey)
        }
      }
    } catch (error) {
      assigned.forEach(key => failed.add(key))
      logger.error(`推送仓库更新至 ${type} ${id} 失败: `, error)
    }
  }
  if (isAuto) {
    for (const [key, update] of updates) {
      if (!update.activity && !failed.has(key) && Array.from(targets.values()).some(target => target.repos.has(update.repoKey))) {
        await redisHeler.updatesSha(update.redisKey, update.sha)
      }
    }
  }
  return repositoryCount
}

function updateBatches (updates: RepositoryUpdate[]) {
  const size = updates.some(update => update.activity) ? activityOptions().batchSize : updates.length || 1
  const batches: RepositoryUpdate[][] = []
  for (let offset = 0; offset < updates.length; offset += size) batches.push(updates.slice(offset, offset + size))
  return batches
}

function withActivityLinks (image: icqq.ImageElem | icqq.ImageElem[], updates: RepositoryUpdate[]): icqq.Sendable {
  const links = activityOptions().sendLinks
    ? Array.from(new Set(updates.flatMap(update => 'activity' in update.info && update.info.url ? [update.info.url] : [])))
    : []
  return links.length ? [...(Array.isArray(image) ? image : [image]), `\n${links.join('\n')}`] : image
}

/** Merge recipient subscriptions by stable repository identity. */
function getTargets (list: typeof config.CodeUpdate.List) {
  const targets = new Map<string, SubscriptionTarget>()
  for (const item of list) {
    const repos = getStrategyRepos(item)
    for (const type of ['Group', 'QQ'] as const) {
      for (const id of item[type] ?? []) {
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
  return targets
}

function getStrategyRepos (item: typeof config.CodeUpdate.List[number]): RepoConfig[] {
  const repos = [...item.repos ?? []]
  if (item.AutoPath) repos.push(...GitRepo.PluginPath.filter(repo => !item.Exclude?.includes(repoPath(repo.repo, repo.branch))))
  return repos
}

function getSubscriptions () {
  return config.CodeUpdate.List.flatMap(getStrategyRepos).filter(Boolean)
}

export function getRepos (toArray: true): RepoConfig[]
export function getRepos (toArray: false): Set<RepoConfig>
export function getRepos (toArray: boolean) {
  const repos = getSubscriptions()
  const unique = Array.from(new Map(repos.map(repo => [getRepoKey(repo), repo])).values())
  return toArray ? unique : new Set(unique)
}

/** Include active recipient cursors when cleaning obsolete Redis keys. */
export function getAllRedisKey () {
  const keys = new Map(getRepos(true).map(repo => [
    getRepoKey(repo), redisHeler.getRedisKey(repo.provider, getRepoType(repo.type), repo.repo, getRepoBranch(repo))
  ]))
  const result = new Set(keys.values())
  for (const repo of getRepos(true)) {
    if (isActivityMethod(getRepoType(repo.type))) result.add(redisHeler.getActivityKey(keys.get(getRepoKey(repo))!))
  }
  for (const repo of getSubscriptions()) {
    result.add(redisHeler.getLegacyRedisKey(repo.provider, getRepoType(repo.type), repo.repo, repo.branch))
  }
  for (const [target, { repos }] of getTargets(config.CodeUpdate.List)) {
    for (const repo of repos.keys()) result.add(redisHeler.getDeliveryKey(keys.get(repo)!, target))
  }
  return Array.from(result)
}
