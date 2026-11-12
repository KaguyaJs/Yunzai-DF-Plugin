import { commonRedisKey } from '@/constants/Redis'

const PREFIX = `${commonRedisKey}:`
const BATCH_SIZE = 200

export interface RedisUsage {
  keys: string[]
  entries: { key: string, bytes: number }[]
  bytes: number
  mode: 'memory' | 'payload'
  unknownKeys: number
}

function pluginKeys (keys: string[]) {
  if (keys.some(key => typeof key !== 'string' || !key.startsWith(PREFIX))) {
    throw new Error('Redis 清理范围包含其他插件的数据，已取消操作')
  }
  return Array.from(new Set(keys))
}

function unavailable (error: unknown, command: string) {
  const message = error instanceof Error ? error.message : String(error)
  return /\bNOPERM\b/i.test(message) ||
    (new RegExp(`unknown (?:command|subcommand).*${command}`, 'i').test(message)) ||
    (command === 'memory' && /unknown subcommand.*usage/i.test(message))
}

function byteCount (value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('Redis 返回了无效的大小或数量')
  }
  return value
}

/** 使用游标逐页扫描插件命名空间，避免阻塞整个 Redis 实例。 */
export async function listPluginRedisKeys (): Promise<string[]> {
  const keys = new Set<string>()
  const cursors = new Set<number>()
  let cursor = 0
  do {
    const result = await redis.scan(cursor, { MATCH: `${PREFIX}*`, COUNT: BATCH_SIZE })
    for (const key of pluginKeys(result.keys)) keys.add(key)
    cursor = Number(result.cursor)
    if (!Number.isSafeInteger(cursor) || cursor < 0 || (cursor !== 0 && cursors.has(cursor))) {
      throw new Error('Redis 扫描游标无效或未前进，已取消操作')
    }
    cursors.add(cursor)
  } while (cursor !== 0)
  return Array.from(keys).sort()
}

async function memoryEntries (keys: string[]) {
  const entries: RedisUsage['entries'] = []
  for (let offset = 0; offset < keys.length; offset += 16) {
    const values = await Promise.allSettled(keys.slice(offset, offset + 16).map(async key => {
      const bytes = await redis.memoryUsage(key)
      return bytes === null ? null : { key, bytes: byteCount(bytes) }
    }))
    const fatal = values.find(value => value.status === 'rejected' && !unavailable(value.reason, 'memory'))
    if (fatal?.status === 'rejected') throw fatal.reason
    // Keep one measurement basis for the whole report instead of mixing memory and payload sizes.
    if (values.some(value => value.status === 'rejected')) return null
    for (const value of values) if (value.status === 'fulfilled' && value.value) entries.push(value.value)
  }
  return entries
}

async function payloadEntry (key: string) {
  try {
    const type = await redis.type(key)
    if (type === 'none') return null
    if (type !== 'string') return { key, bytes: 0, unknown: true }
    return { key, bytes: byteCount(await redis.strLen(key)), unknown: false }
  } catch (error) {
    // ACL-restricted or changed-type keys cannot safely be measured by reading their contents.
    if (unavailable(error, 'type') || unavailable(error, 'strlen') || /\bWRONGTYPE\b/i.test(String(error))) {
      return { key, bytes: 0, unknown: true }
    }
    throw error
  }
}

/** 优先统计 Redis 内存；服务器不支持或禁止 MEMORY 时统一改为字符串有效负载字节数。 */
export async function inspectRedis (requested?: string[]): Promise<RedisUsage> {
  const keys = requested === undefined ? await listPluginRedisKeys() : pluginKeys(requested)
  const memory = await memoryEntries(keys)
  if (memory !== null) {
    return { keys: memory.map(entry => entry.key), entries: memory, bytes: memory.reduce((sum, entry) => sum + entry.bytes, 0), mode: 'memory', unknownKeys: 0 }
  }
  const entries: RedisUsage['entries'] = []
  let unknownKeys = 0
  for (let offset = 0; offset < keys.length; offset += 16) {
    const values = await Promise.all(keys.slice(offset, offset + 16).map(payloadEntry))
    for (const value of values) {
      if (!value) continue
      entries.push({ key: value.key, bytes: value.bytes })
      if (value.unknown) unknownKeys++
    }
  }
  return { keys: entries.map(entry => entry.key), entries, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), mode: 'payload', unknownKeys }
}

/** 先校验全部键，再按批次异步释放；旧版服务器不支持 UNLINK 时退回 DEL。 */
export async function deletePluginRedis (requested: string[]): Promise<number> {
  const keys = pluginKeys(requested)
  let removed = 0
  let useDel = false
  for (let offset = 0; offset < keys.length; offset += BATCH_SIZE) {
    const batch = keys.slice(offset, offset + BATCH_SIZE)
    if (useDel) removed += byteCount(await redis.del(batch))
    else {
      try {
        removed += byteCount(await redis.unlink(batch))
      } catch (error) {
        if (!unavailable(error, 'unlink')) throw error
        useDel = true
        removed += byteCount(await redis.del(batch))
      }
    }
  }
  return removed
}

export function formatBytes (bytes: number): string {
  const value = Number.isFinite(bytes) ? Math.max(0, bytes) : 0
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const unit = value > 0 ? Math.max(0, Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))) : 0
  return `${unit ? (value / (1024 ** unit)).toFixed(2) : Math.trunc(value)} ${units[unit]}`
}
