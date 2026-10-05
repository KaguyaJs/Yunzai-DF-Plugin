import { CodeUpdateRedisKey } from '@/constants'
import type { GitApiMethod } from '@/types'

const PROVIDERS: Record<string, string> = { github: 'GitHub', gitee: 'Gitee', gitcode: 'Gitcode', cnb: 'CNB' }

function repoKey (platform: string, method: GitApiMethod, repo: string = '', branch?: string) {
  const prefix = method === 'commits'
    ? `${CodeUpdateRedisKey}:${platform}`
    : `${CodeUpdateRedisKey}:${platform}${method[0].toUpperCase()}${method.slice(1)}`
  return repo ? `${prefix}:${repo}${branch ? `:${branch}` : ''}` : prefix
}

export const redisHeler = {
  async isUpdate (key: string, sha: string): Promise<boolean | null> {
    const data = await redis.get(key)
    return data ? JSON.parse(data)?.[0]?.shacode === sha : null
  },

  async updatesSha (key: string, sha: string) {
    await redis.set(key, JSON.stringify([{ shacode: sha }]))
  },

  getRedisKey (platform: string, method: GitApiMethod, repo: string = '', branch?: string) {
    return repoKey(PROVIDERS[platform.toLowerCase()] || platform.toLowerCase(), method, repo, branch)
  },

  getLegacyRedisKey: repoKey,

  getDeliveryKey (key: string, target: string) {
    return `${key}:delivery:${target}`
  },
}
