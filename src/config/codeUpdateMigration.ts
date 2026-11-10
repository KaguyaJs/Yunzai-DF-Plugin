import type { Config, GitApiMethod } from '@/types'
import type { RepositoryConfig } from '../modules/CodeUpdate/utils/repo'
import { redisHeler } from '../modules/CodeUpdate/utils/redis'
import { commonRedisKey } from '@/constants/Redis'

// Outside CodeUpdate:* so obsolete-subscription cleanup cannot remove the marker.
export const CODE_UPDATE_MIGRATION_KEY = `${commonRedisKey}:ConfigMigration:CodeUpdate:v2`

type LegacyRepository = Omit<RepositoryConfig, 'type' | 'branch'> & {
  type?: string | string[]
  branch?: string | string[]
}

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

function stable (value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${JSON.stringify(key)}:${stable(value)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** Merge only entries with identical filters/extra settings, within their original strategy. */
export function migrateRepositoryList (items: LegacyRepository[]): RepositoryConfig[] {
  const result = new Map<string, RepositoryConfig>()
  for (const raw of items) {
    const item = normalizeRepository(raw)
    const { type, branch, ...settings } = item
    const key = stable(settings)
    const previous = result.get(key)
    if (!previous) {
      result.set(key, item)
      continue
    }
    const previousCommits = previous.type.includes('commits')
    const currentCommits = type.includes('commits')
    if (previousCommits && currentCommits) {
      // An empty selector is a default-branch subscription, including when combined with names.
      previous.branch = [...new Set([...(previous.branch?.length ? previous.branch : ['']), ...(branch?.length ? branch : [''])])]
      if (previous.branch.includes('all')) previous.branch = ['all']
    } else if (currentCommits) previous.branch = branch
    else if (!previousCommits) previous.branch = []
    previous.type = [...new Set([...previous.type, ...type])]
  }
  return Array.from(result.values())
}

interface MigrationStorage {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<unknown>
  copy: (key: string, value: string) => Promise<unknown>
}

/** Copy old scalar cursors before dropping irrelevant release/PR/Issue branch fields. */
async function preserveLegacyCursors (config: Config['CodeUpdate'], storage: MigrationStorage) {
  for (const strategy of config.List ?? []) {
    for (const raw of strategy.repos ?? []) {
      const item = normalizeRepository(raw)
      for (const type of item.type) {
        if (type !== 'commits' && type !== 'releases') continue
        for (const branch of item.branch?.length ? item.branch : ['']) {
          if (branch === 'all') continue
          const source = redisHeler.getLegacyRedisKey(item.provider, type, item.repo, branch)
          const target = redisHeler.getRedisKey(item.provider, type, item.repo, type === 'commits' ? branch : '')
          if (source === target) continue
          const aliases = [[source, target]]
          for (const kind of ['Group', 'QQ'] as const) {
            for (const id of strategy[kind] ?? []) {
              aliases.push([
                redisHeler.getDeliveryKey(source, `${kind}:${id}`), redisHeler.getDeliveryKey(target, `${kind}:${id}`)
              ])
            }
          }
          for (const [from, to] of aliases) {
            const value = await storage.get(from)
            if (value !== null) await storage.copy(to, value)
          }
        }
      }
    }
  }
}

/** Idempotent startup migration; a failed read, copy, save or marker write can be retried. */
export async function migrateCodeUpdateConfig (
  config: Config['CodeUpdate'] & { AutoBranch?: boolean, AutoBranchTips?: string },
  save: () => Promise<void>,
  storage: MigrationStorage
): Promise<boolean> {
  if (await storage.get(CODE_UPDATE_MIGRATION_KEY)) return false
  const list = (config.List ?? []).map(strategy => ({ ...strategy, repos: migrateRepositoryList(strategy.repos ?? []) }))
  await preserveLegacyCursors(config, storage)
  config.List = list
  delete config.AutoBranch
  delete config.AutoBranchTips
  await save()
  // Plain SET, deliberately without EX/PX/expiration.
  const saved = await storage.set(CODE_UPDATE_MIGRATION_KEY, 'done')
  if (saved !== 'OK') throw new Error('配置迁移标记未保存成功')
  return true
}
