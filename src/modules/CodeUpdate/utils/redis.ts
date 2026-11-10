import { CodeUpdateRedisKey } from '@/constants'
import type { GitApiMethod, ActivityJournal } from '@/types'

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

  getActivityKey (key: string) {
    return `${key}:activity`
  },

  async getActivityJournal (key: string): Promise<ActivityJournal | null> {
    const value = await redis.get(key)
    if (!value) return null
    const journal: ActivityJournal = JSON.parse(value)
    if (journal.version !== 1 || typeof journal.checkedAt !== 'string' || !Number.isFinite(Date.parse(journal.checkedAt)) ||
      !journal.items || typeof journal.items !== 'object' || Array.isArray(journal.items) ||
      !journal.pending || typeof journal.pending !== 'object' || Array.isArray(journal.pending)) {
      throw new Error('PR/Issue 推送记录格式错误，请检查对应 Redis 数据')
    }
    return journal
  },

  async saveActivityJournal (key: string, journal: ActivityJournal) {
    await redis.set(key, JSON.stringify(journal))
  },

  async acknowledgeActivities (key: string, ids: string[], target: string) {
    const journal = await this.getActivityJournal(key)
    if (!journal) return
    for (const id of ids) {
      const pending = journal.pending[id]
      if (!pending) continue
      pending.targets = pending.targets.filter(value => value !== target)
      if (!pending.targets.length) delete journal.pending[id]
    }
    await this.saveActivityJournal(key, journal)
  },
}
