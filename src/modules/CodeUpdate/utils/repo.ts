import type { Config } from '@/types'

export type RepoConfig = Config['CodeUpdate']['List'][number]['repos'][number]

export function getRepoType (type: RepoConfig['type']) {
  return type === 'commit' ? 'commits' : type
}

export function getRepoBranch ({ type, branch }: RepoConfig) {
  return getRepoType(type) === 'commits' ? branch || '' : ''
}

/** Stable subscription identity; resolved default branches do not change it. */
export function getRepoKey (item: RepoConfig) {
  return JSON.stringify([item.provider.toLowerCase(), getRepoType(item.type), item.repo, getRepoBranch(item)])
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
