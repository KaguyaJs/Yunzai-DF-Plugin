import GitApi from '@/modules/GitApi'
import { Commit, CommitInfo, Config, Release, ReleaseInfo } from '@/types'
import { defaultBranchMap } from '../data'
import { redisHeler, formatCommitInfo, formatReleaseInfo, repoPath } from '@CodeUpdate/utils'
import config from '@/config'
import { logger } from '@/utils'

export type ReposListType = Config['CodeUpdate']['List'][number]['repos']

/**
 * 获取仓库更新
 * @param repoList 仓库列表
 * @param isAuto 是否自动
 * @returns 请求结果 Map
 */
export async function fetchUpdate (repoList: ReposListType, isAuto: boolean) {
  const content = new Map<ReposListType[number], CommitInfo | ReleaseInfo>()
  await Promise.all(repoList.map(async (item) => {
    let { provider, repo, branch, type } = item
    if (!repo) return
    const logRepo = repoPath(repo, branch)
    try {
      const path: string = repo
      if (type === 'commits' || type === 'commit') {
        type = 'commits'
        branch ||= defaultBranchMap.get(repo) ?? ''
      }
      logger.debug(`请求 ${logger.magenta(provider)} ${type}: ${logger.cyan(logRepo)}`)
      let data = await GitApi.getRepositoryData(provider, repo, type, branch)
      if (data === false) return
      if (!Array.isArray(data)) data = [data]
      if (data.length === 0 || (type === 'releases' && !data[0]?.tag_name)) {
        logger.warn(`${logger.magenta(provider)}: ${logger.cyan(logRepo)} 数据为空`)
        return
      }
      if (isAuto) {
        const sha = (type === 'commits' && data[0]?.sha)
          ? data[0]?.sha
          : data[0]?.node_id
        const isUpdate = await redisHeler.isUpdate(provider, type, repo, branch, sha)
        if (isUpdate) {
          logger.debug(`${logger.cyan(logRepo)} 暂无更新`)
          return
        }
        await redisHeler.updatesSha(provider, type, repo, branch, sha)
        if (isUpdate === null && !config.CodeUpdate.FirstAdd) return
        logger.mark(`${logger.cyan(logRepo)} 检测到更新`)
      }
      const info = await (type === 'commits'
        ? formatCommitInfo(data[0] as Commit, provider, path, branch)
        : formatReleaseInfo(data[0] as Release, provider, repo))
      content.set(item, info)
    } catch (err) {
      logger.error(`获取 ${logger.magenta(provider)} ${type} ${logger.cyan(logRepo)} 数据出错: `, err)
    }
  }))
  return content
}
