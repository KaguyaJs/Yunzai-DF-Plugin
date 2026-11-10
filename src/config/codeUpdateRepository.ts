import type { GitApiMethod } from '@/types'
import type { RepositoryConfig } from '../modules/CodeUpdate/utils/repo'

export type LegacyRepository = Omit<RepositoryConfig, 'type' | 'branch'> & {
  type?: string | string[]
  branch?: string | string[]
}

/** Pure normalization shared by migration, subscription expansion and request estimates. */
export function normalizeRepository (item: LegacyRepository): RepositoryConfig {
  const input = item.type === undefined ? ['commits'] : Array.isArray(item.type) ? item.type : [item.type]
  const type = [...new Set(input.map(value => value === 'commit' ? 'commits' : value))]
  if (type.some(value => !['commits', 'releases', 'pulls', 'issues'].includes(value))) {
    throw new Error(`仓库 ${item.repo} 包含不支持的监听类型`)
  }
  const raw = Array.isArray(item.branch) ? item.branch : item.branch?.trim() ? [item.branch] : []
  const branches = [...new Set(raw.flatMap(value => value.trim() ? value.trim().split(/[,，\s]+/) : ['']))]
  const branch = branches.some(value => value.toLowerCase() === 'all') ? ['all'] : branches
  return { ...item, type: type as GitApiMethod[], branch }
}
