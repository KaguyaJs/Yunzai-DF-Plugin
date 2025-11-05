import { CodeUpdateRedisKey } from '@/constants'
import { GitApiMethod } from '@/types'

export const redisHeler = new class {
  /**
   * 检查sha值是否与redis一致
   * @param platform 平台
   * @param method 方法
   * @param repo 仓库路径
   * @param branch 分支
   * @param sha sha值
   * @returns 是否最新
   */
  async isUpdate (platform: string, method: GitApiMethod, repo: string, branch: string | undefined, sha: string) {
    const redisData = await redis.get(this.getRedisKey(platform, method, repo, branch))
    return redisData && JSON.parse(redisData)?.[0]?.shacode === sha
  }

  /**
   * 更新redis中的sha值
   * @param platform 平台
   * @param method  方法
   * @param repo 仓库路径
   * @param branch 分支
   * @param sha sha值
   */
  async updatesSha (platform: string, method: GitApiMethod, repo: string, branch: string | undefined, sha: string) {
    await redis.set(this.getRedisKey(platform, method, repo, branch), JSON.stringify([{ shacode: sha }]))
  }

  /**
   * 获取单个仓库对应的 redis key
   * @param platform 平台
   * @param method 方法
   * @param repoPath 仓库路径 (可选，不传则返回redis key前缀)
   * @param branch 分支
   * @returns 构造的 redis key
   */
  getRedisKey (platform: string, method: GitApiMethod, repoPath: string = '', branch?: string) {
    const prefix = method === 'commits'
      ? `${CodeUpdateRedisKey}:${platform}`
      : `${CodeUpdateRedisKey}:${platform}${method[0].toUpperCase()}${method.slice(1)}`
    return repoPath
      ? branch
        ? `${prefix}:${repoPath}:${branch}`
        : `${prefix}:${repoPath}`
      : prefix
  }
}()
