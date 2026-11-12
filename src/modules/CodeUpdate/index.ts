import config from '@/config'
import { logger } from '@/utils'
import type { icqq, MessageEvent } from 'trss-yunzai'
import { fetchUpdate } from './services'
import { pushTouser } from './services/push'
import { generateScreenshot } from './services/screenshot'
import { redisHeler, getRepoKey, getRepoType, getRepoRedisKey } from './utils'
import type { RepoConfig } from './utils/repo'
import { subscriptionSnapshot } from './services/subscriptions'
import { activityOptions, isActivityMethod } from './utils/activity'
import type { RepositoryUpdate } from './services/repo'
import { PluginPath } from '@/utils/GitRepo'
import { logGitRequestEstimate } from '@/utils/gitRequestEstimate'
import { withPluginTask } from '@/utils/lifecycle'

let checking = false

/** Serialize automatic and manual checks; always release the lock. */
export async function CodeUpdate (isAuto: boolean = true, e?: MessageEvent): Promise<number | false> {
  if (checking) {
    if (e) await e.reply('正在检查仓库更新，请稍后再试')
    return false
  }
  return withPluginTask(async () => {
    checking = true
    try {
      return await checkUpdates(isAuto, e)
    } finally {
      checking = false
    }
  }, async () => {
    if (e) await e.reply('DF插件正在维护，暂时无法检查仓库更新')
    return false as const
  })
}

async function checkUpdates (isAuto: boolean, e?: MessageEvent) {
  const { List } = config.CodeUpdate
  if (!List?.length) {
    logger.warn('未配置推送列表')
    if (e) await e.reply('请先配置需要监听的仓库')
    return false
  }
  if (e) await e.reply(`正在${isAuto ? '检查' : '推送'}仓库更新，请稍等`)
  logger.mark(logger.cyan('开始检查仓库更新'))
  const { repos, targets, subscriptions, complete } = await subscriptionSnapshot()
  if (!repos.length) {
    logGitRequestEstimate(config.CodeUpdate, PluginPath, logger, { resolved: complete ? repos : undefined })
    if (e) await e.reply(complete ? '当前没有可检查的仓库，请检查监听配置' : '获取仓库或分支列表失败，请稍后重试')
    return false
  }
  const updates = await fetchUpdate(repos, isAuto, targets, subscriptions)
  logGitRequestEstimate(config.CodeUpdate, PluginPath, logger, { resolved: complete ? repos : undefined })
  if (!updates.size) {
    logger.info(logger.yellow('未检测到仓库更新'))
    return 0
  }
  const repositoryCount = new Set(Array.from(updates.values(), update => JSON.stringify([update.info.name.source.toLowerCase(), update.info.name.repo]))).size
  logger.info(logger.green(`共获取到 ${repositoryCount} 个仓库的 ${updates.size} 条更新`))
  if (!isAuto && e) {
    const visible = groupUpdates(Array.from(updates.values())).map(group => group[0])
    const image = await generateScreenshot(visible.map(update => update.info), String(e.user_id)).catch(error => {
      logger.error('汇总仓库更新截图失败：', error)
      return false as const
    })
    if (!image || (Array.isArray(image) && !image.length)) {
      await e.reply('截图失败，请稍后再试')
      return false
    }
    await e.reply(withActivityLinks(image, visible))
    return repositoryCount
  }

  const images = new Map<string, icqq.ImageElem | icqq.ImageElem[]>()
  const failed = new Set<string>()
  for (const [targetKey, { type, id, repos }] of targets) {
    const assigned = Array.from(updates).filter(([, update]) => update.activity || update.commit
      ? (update.activity ?? update.commit)!.targets.includes(targetKey)
      : repos.has(update.repoKey)).map(([key]) => key)
    if (!assigned.length) continue
    try {
      const pending: string[] = []
      for (const key of assigned) {
        const update = updates.get(key)!
        const deliveryKey = redisHeler.getDeliveryKey(update.redisKey, targetKey)
        if (update.activity || update.commit || !isAuto || !await redisHeler.isUpdate(deliveryKey, update.sha)) pending.push(key)
      }
      if (!pending.length) continue
      for (const { visible, updates: batch } of updateBatches(pending.map(key => updates.get(key)!))) {
        const imageKey = JSON.stringify(visible.map(update => JSON.stringify([update.repoKey, update.sha])).sort())
        let image = images.get(imageKey)
        if (!image) {
          const result = await generateScreenshot(visible.map(update => update.info), id)
          if (!result || (Array.isArray(result) && !result.length)) throw new Error('截图失败')
          image = result
          images.set(imageKey, image)
        }
        if (!await pushTouser(type, id, withActivityLinks(image, visible))) throw new Error('消息发送失败')
        if (isAuto) {
          const activities = new Map<string, string[]>()
          const commits = new Map<string, RepositoryUpdate[]>()
          for (const update of batch) {
            if (update.activity) {
              const { journalKey, eventId } = update.activity
              const ids = activities.get(journalKey) ?? []
              ids.push(eventId)
              activities.set(journalKey, ids)
            } else if (update.commit) {
              const items = commits.get(update.commit.journalKey) ?? []
              items.push(update)
              commits.set(update.commit.journalKey, items)
            } else {
              await redisHeler.updatesSha(redisHeler.getDeliveryKey(update.redisKey, targetKey), update.sha)
            }
          }
          for (const [key, ids] of activities) await redisHeler.acknowledgeActivities(key, ids, targetKey)
          for (const [key, items] of commits) {
            const journal = await redisHeler.acknowledgeCommits(key, items.map(update => update.sha), targetKey)
            const last = items.at(-1)!
            await redisHeler.updatesSha(redisHeler.getDeliveryKey(last.redisKey, targetKey), last.sha)
            if (!Object.keys(journal.pending).length) await redisHeler.updatesSha(last.redisKey, journal.cursor)
          }
        }
      }
    } catch (error) {
      assigned.forEach(key => failed.add(key))
      logger.error(`推送仓库更新至 ${type} ${id} 失败: `, error)
    }
  }
  if (isAuto) {
    for (const [key, update] of updates) {
      if (!update.activity && !update.commit && !failed.has(key) && Array.from(targets.values()).some(target => target.repos.has(update.repoKey))) {
        await redisHeler.updatesSha(update.redisKey, update.sha)
      }
    }
  }
  return repositoryCount
}

/** 相同内容只渲染一次；保留每个订阅记录，以便自动推送成功后分别确认。 */
function groupUpdates (updates: RepositoryUpdate[]) {
  const groups = new Map<string, RepositoryUpdate[]>()
  for (const update of updates) {
    const key = 'release' in update.info
      ? JSON.stringify(['release', update.info.name.source.toLowerCase(), update.info.name.repo, update.sha])
      : JSON.stringify([update.repoKey, update.sha])
    const group = groups.get(key) ?? []
    group.push(update)
    groups.set(key, group)
  }
  return Array.from(groups.values())
}

function updateBatches (updates: RepositoryUpdate[]) {
  const values = groupUpdates(updates)
  const size = updates.some(update => update.activity || update.commit) ? activityOptions().batchSize : values.length || 1
  const batches: { visible: RepositoryUpdate[], updates: RepositoryUpdate[] }[] = []
  for (let offset = 0; offset < values.length; offset += size) {
    const batch = values.slice(offset, offset + size)
    batches.push({ visible: batch.map(group => group[0]), updates: batch.flat() })
  }
  return batches
}

function withActivityLinks (image: icqq.ImageElem | icqq.ImageElem[], updates: RepositoryUpdate[]): icqq.Sendable {
  const links = activityOptions().sendLinks
    ? Array.from(new Set(updates.flatMap(update => 'activity' in update.info
      ? [update.info.url, update.info.diff?.url].filter((url): url is string => !!url)
      : [])))
    : []
  return links.length ? [...(Array.isArray(image) ? image : [image]), `\n${links.join('\n')}`] : image
}

export function getRepos (toArray: true): Promise<RepoConfig[]>
export function getRepos (toArray: false): Promise<Set<RepoConfig>>
export async function getRepos (toArray: boolean) {
  const { repos } = await subscriptionSnapshot()
  return toArray ? repos : new Set(repos)
}

/** Include active recipient cursors when cleaning obsolete Redis keys. */
export async function getAllRedisKey () {
  const { repos, subscriptions, targets, complete } = await subscriptionSnapshot()
  if (!complete) throw new Error('仓库或分支列表获取未完成，无法确认哪些记录有效；本次不清理')
  const keys = new Map(repos.map(repo => [
    getRepoKey(repo), getRepoRedisKey(repo)
  ]))
  const result = new Set(keys.values())
  for (const repo of repos) {
    if (isActivityMethod(getRepoType(repo.type))) result.add(redisHeler.getActivityKey(keys.get(getRepoKey(repo))!))
    if (getRepoType(repo.type) === 'commits') result.add(redisHeler.getCommitKey(keys.get(getRepoKey(repo))!))
  }
  for (const repo of subscriptions) {
    result.add(redisHeler.getLegacyRedisKey(repo.provider, getRepoType(repo.type), repo.repo, repo.branch))
  }
  for (const [target, { repos }] of targets) {
    for (const repo of repos.keys()) result.add(redisHeler.getDeliveryKey(keys.get(repo)!, target))
  }
  return Array.from(result)
}
