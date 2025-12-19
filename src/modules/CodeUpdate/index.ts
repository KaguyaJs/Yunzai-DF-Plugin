import config from '@/config'
import { logger, Data } from '@/utils'
import { icqq, MessageEvent } from 'trss-yunzai'
import { fetchUpdate } from './services'
import { pushTouser } from './services/push'
import { generateScreenshot } from './services/screenshot'
import GitRepo from '@/utils/GitRepo'
import { redisHeler, repoPath } from './utils'

/**
 * 检查仓库更新并推送
 * @param isAuto 是否为自动
 * @param e 消息事件
 * @returns 获取的仓库数据数量
 */
export async function CodeUpdate (isAuto: boolean = true, e?: MessageEvent): Promise<number | false> {
  const { List } = config.CodeUpdate
  if (!List?.length) {
    logger.warn('未配置推送列表')
    if (e) await e.reply('请先配置需要监听的仓库')
    return false
  }
  logger.mark(logger.cyan('开始检查仓库更新'))

  const repos = getRepos(true)
  if (!repos.length) return false
  const DataMap = await fetchUpdate(repos, isAuto)
  const num = DataMap.size
  if (num === 0) {
    logger.info(logger.yellow('未检测到仓库更新'))
    return num
  }
  const PashMap = getListMap(List)
  const imageCache = new Map<string, icqq.ImageElem>()
  if (!isAuto && e) {
    const img = await generateScreenshot(Array.from(DataMap.values()), String(e.user_id))
    if (img) await e.reply(img)
    return num
  }
  for (const [type, value] of Object.entries(PashMap)) {
    for (const [id, repo] of Object.entries(value)) {
      let img
      const Key = Data.getSetKey(repo)
      if (imageCache.get(Key)) {
        img = imageCache.get(Key)
      } else {
        img = await generateScreenshot((Array.from(repo).map(i => DataMap.get(i)).filter(i => i !== undefined)), String(id))
        if (img) imageCache.set(Key, img)
      }
      if (!img) {
        logger.warn('[CodeUpdate] 截图失败')
        continue
      }
      void pushTouser(type as 'QQ' | 'Group', id, img)
    }
  }
  return num
}

function getListMap (data: typeof config.CodeUpdate.List) {
  type Repo = typeof data[number]['repos'][number]
  return data.reduce((acc, item) => {
    const fill = (
      map: Record<string | number, Set<Repo>>,
      ids: (string | number)[]
    ) => {
      ids.forEach(id => {
        map[id] ||= new Set()
        item.repos.forEach(r => map[id].add(r))
        if (item.AutoPath) {
          GitRepo.PluginPath.forEach(r => {
            if (!item.Exclude.includes(repoPath(r.repo, r.branch))) map[id].add(r)
          })
        }
      })
    }
    fill(acc.Group, item.Group)
    fill(acc.QQ, item.QQ)
    return acc
  }, {
    Group: {} as Record<string | number, Set<Repo>>,
    QQ: {} as Record<string | number, Set<Repo>>,
  })
}

export function getRepos (toArray: true): Array<typeof config.CodeUpdate.List[number]['repos'][number]>
export function getRepos (toArray: false): Set<typeof config.CodeUpdate.List[number]['repos'][number]>
export function getRepos (toArray: boolean) {
  const { List } = config.CodeUpdate
  const repos = new Set(List.flatMap(i => i.repos))
  if (config.AutoPath) GitRepo.PluginPath.forEach(r => repos.add(r))
  return toArray ? Array.from(repos) : repos
}

export function getAllRedisKey () {
  const repos = getRepos(true)
  return repos.map(({ provider, repo, branch, type }) => redisHeler.getRedisKey(provider, type === 'commit' ? 'commits' : type, repo, branch))
}
