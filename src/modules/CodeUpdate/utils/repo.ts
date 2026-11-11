import type { Config, GitApiMethod } from '@/types'
import { redisHeler } from './redis'

export type RepositoryConfig = Config['CodeUpdate']['List'][number]['repos'][number]
/** One expanded subscription. Its identity stays compatible with existing Redis records. */
export type RepoConfig = Omit<RepositoryConfig, 'type' | 'branch'> & { type: GitApiMethod | 'commit', branch?: string }
export type SubscriptionTarget = { type: 'Group' | 'QQ', id: string, repos: Map<string, RepoConfig[]> }

export function getRepoType (type: RepoConfig['type']) {
  return type === 'commit' ? 'commits' : type
}

export function getRepoBranch ({ type, branch }: RepoConfig) {
  return getRepoType(type) === 'commits' ? branch || '' : ''
}

/** Stable subscription identity; resolved default branches do not change it. */
export function getRepoKey (item: RepoConfig) {
  const key = [item.provider.toLowerCase(), getRepoType(item.type), item.repo, getRepoBranch(item)]
  if (getRepoType(item.type) === 'releases' && item.includeDrafts) key.push('drafts')
  return JSON.stringify(key)
}

/** Keep draft subscriptions separate from published-only cursors and deliveries. */
export function getRepoRedisKey (item: RepoConfig) {
  const key = redisHeler.getRedisKey(item.provider, getRepoType(item.type), item.repo, getRepoBranch(item))
  return getRepoType(item.type) === 'releases' && item.includeDrafts ? `${key}:drafts` : key
}

/**
 * 传入repo和branch返回仓库路径
 *
 * @example
 * repoPath('Le-niao/Yunzai-Bot', 'main') → 'Le-niao/Yunzai-Bot:main'
 */
export function repoPath (repo: string, branch?: string) {
  return branch
    ? `${repo}:${branch}`
    : repo
}
