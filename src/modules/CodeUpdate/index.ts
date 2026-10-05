import config from '@/config'
import { logger } from '@/utils'
import type { icqq, MessageEvent } from 'trss-yunzai'
import { fetchUpdate } from './services'
import { pushTouser } from './services/push'
import { generateScreenshot } from './services/screenshot'
import GitRepo from '@/utils/GitRepo'
import { redisHeler, repoPath, getRepoKey, getRepoType, getRepoBranch } from './utils'
import type { RepoConfig } from './utils/repo'

type Target = { type: 'Group' | 'QQ', id: string, repos: Set<string> }
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
  const updates = await fetchUpdate(repos, isAuto)
  if (!updates.size) {
    logger.info(logger.yellow('未检测到仓库更新'))
    return 0
  }
  logger.info(logger.green(`共获取到 ${updates.size} 个仓库更新`))
  if (!isAuto && e) {
    const image = await generateScreenshot(Array.from(updates.values(), update => update.info), String(e.user_id))
    if (!image) {
      await e.reply('截图失败，请稍后再试')
      return false
    }
    await e.reply(image)
    return updates.size
  }

  const targets = getTargets(List)
  const images = new Map<string, icqq.ImageElem | icqq.ImageElem[]>()
  const failed = new Set<string>()
  for (const [targetKey, { type, id, repos }] of targets) {
    const assigned = Array.from(repos).filter(key => updates.has(key))
    if (!assigned.length) continue
    try {
      const pending: string[] = []
      for (const key of assigned) {
        const update = updates.get(key)!
        const deliveryKey = redisHeler.getDeliveryKey(update.redisKey, targetKey)
        if (!isAuto || !await redisHeler.isUpdate(deliveryKey, update.sha)) pending.push(key)
      }
      if (!pending.length) continue
      const imageKey = JSON.stringify(pending.sort())
      let image = images.get(imageKey)
      if (!image) {
        const content = pending.map(key => updates.get(key)!.info)
        const result = await generateScreenshot(content, id)
        if (!result || (Array.isArray(result) && !result.length)) throw new Error('截图失败')
        image = result
        images.set(imageKey, image)
      }
      if (!await pushTouser(type, id, image)) throw new Error('消息发送失败')
      if (isAuto) {
        for (const key of pending) {
          const update = updates.get(key)!
          await redisHeler.updatesSha(redisHeler.getDeliveryKey(update.redisKey, targetKey), update.sha)
        }
      }
    } catch (error) {
      assigned.forEach(key => failed.add(key))
      logger.error(`推送仓库更新至 ${type} ${id} 失败: `, error)
    }
  }
  if (isAuto) {
    for (const [key, update] of updates) {
      if (!failed.has(key) && Array.from(targets.values()).some(target => target.repos.has(key))) {
        await redisHeler.updatesSha(update.redisKey, update.sha)
      }
    }
  }
  return updates.size
}

/** Merge recipient subscriptions by stable repository identity. */
function getTargets (list: typeof config.CodeUpdate.List) {
  const targets = new Map<string, Target>()
  for (const item of list) {
    const repos = getStrategyRepos(item)
    for (const type of ['Group', 'QQ'] as const) {
      for (const id of item[type] ?? []) {
        const key = `${type}:${id}`
        let target = targets.get(key)
        if (!target) {
          target = { type, id: String(id), repos: new Set() }
          targets.set(key, target)
        }
        repos.forEach(repo => target.repos.add(getRepoKey(repo)))
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
  for (const repo of getSubscriptions()) {
    result.add(redisHeler.getLegacyRedisKey(repo.provider, getRepoType(repo.type), repo.repo, repo.branch))
  }
  for (const [target, { repos }] of getTargets(config.CodeUpdate.List)) {
    for (const repo of repos) result.add(redisHeler.getDeliveryKey(keys.get(repo)!, target))
  }
  return Array.from(result)
}
