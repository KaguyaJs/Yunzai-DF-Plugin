import { createRequire } from 'node:module'
import path from 'node:path'
import type { Config, GitApiMethod } from '@/types'
import { YunzaiPath } from '@/dir'
import { normalizeRepository } from '../config/codeUpdateRepository'
import type { RepoConfig } from '../modules/CodeUpdate/utils/repo'
import { getRepoBranch, getRepoKey, getRepoType, repoPath } from '../modules/CodeUpdate/utils/repo'
import type { PluginItem } from './GitRepo'

type CodeConfig = Config['CodeUpdate']
type Log = {
  info: (message: string) => unknown
  warn: (message: string) => unknown
  cyan?: (message: string) => string
  green?: (message: string) => string
  yellow?: (message: string) => string
}
type CronExpression = {
  fields: { second: readonly number[], minute: readonly number[], hour: readonly number[] }
  next: () => { toDate: () => Date }
  reset: (date: Date) => void
  hasNext: () => boolean
}
let cachedRates: { cron: string, start: number, rates: { checksPerHour: number, defaultChecksPerHour: number } } | undefined

/** Reuse Yunzai's scheduler parser; enumerate days rather than every second of a dense cron. */
export function cronRequestRates (cron: string, now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (cachedRates?.cron === cron && cachedRates.start === start.getTime()) return { ...cachedRates.rates }
  const requireYunzai = createRequire(path.join(YunzaiPath, 'package.json'))
  const parser = createRequire(requireYunzai.resolve('node-schedule'))('cron-parser') as {
    parseExpression: (cron: string, options: { currentDate: Date, endDate: Date }) => CronExpression
  }
  const end = new Date(start)
  end.setDate(end.getDate() + 366)
  const expression = parser.parseExpression(cron, { currentDate: new Date(start.getTime() - 1), endDate: new Date(end.getTime() - 1) })
  const perDay = expression.fields.second.length * expression.fields.minute.length * expression.fields.hour.length
  const days: number[] = []
  while (expression.hasNext()) {
    const next = expression.next().toDate()
    const midnight = new Date(next)
    midnight.setHours(0, 0, 0, 0)
    days.push(midnight.getTime())
    next.setHours(24, 0, 0, 0)
    if (next >= end) break
    expression.reset(new Date(next.getTime() - 1))
  }
  const times = expression.fields.hour.flatMap(hour => expression.fields.minute.flatMap(minute => expression.fields.second.map(second => hour * 3600 + minute * 60 + second))).sort((a, b) => a - b)
  function nextIndex (target: number) {
    let low = 0
    let high = times.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (times[middle] < target) low = middle + 1
      else high = middle
    }
    return low
  }
  let expires = -Infinity
  let defaults = 0
  for (const day of days) {
    let index = nextIndex((expires - day) / 1000)
    while (index < times.length) {
      defaults++
      expires = day + times[index] * 1000 + 5 * 60 * 1000
      index = nextIndex((expires - day) / 1000)
    }
  }
  const rates = { checksPerHour: days.length * perDay / (366 * 24), defaultChecksPerHour: defaults / (366 * 24) }
  cachedRates = { cron, start: start.getTime(), rates }
  return { ...rates }
}

export function cronChecksPerHour (cron: string, now = new Date()): number {
  return cronRequestRates(cron, now).checksPerHour
}

export interface PlatformRequestEstimate {
  provider: string
  repositories: number
  methods: Record<GitApiMethod, number>
  allBranches: number
  unresolvedAllBranches: number
  defaultBranches: number
  perCheck: number
  defaultPerHour: number
  perHour: number
}

/** No network access: resolved subscriptions are supplied by an already completed check. */
export function estimateGitRequests (config: CodeConfig, local: PluginItem[], checksPerHour: number, resolved?: RepoConfig[], defaultChecksPerHour = checksPerHour / Math.max(1, Math.ceil(checksPerHour / 12))): PlatformRequestEstimate[] {
  const subscriptions = new Map<string, RepoConfig>()
  const allBranches = new Map<string, { provider: string, repo: string }>()
  for (const strategy of config.List ?? []) {
    const raw = [...strategy.repos ?? []]
    const candidates = [...raw, ...(strategy.AutoPath ? local.filter(item => !strategy.Exclude?.includes(repoPath(item.repo, item.branch))) : [])]
    for (const candidate of candidates) {
      const item = normalizeRepository(candidate)
      if (!item.repo) continue
      for (const type of item.type) {
        if (type === 'commits' && item.branch?.includes('all')) {
          allBranches.set(JSON.stringify([item.provider.toLowerCase(), item.repo]), item)
          continue
        }
        for (const branch of type === 'commits' ? item.branch?.length ? item.branch : [''] : ['']) {
          const subscription = { ...item, type, branch }
          subscriptions.set(getRepoKey({ ...subscription, includeDrafts: false }), subscription)
        }
      }
    }
  }
  if (resolved) {
    subscriptions.clear()
    for (const item of resolved) subscriptions.set(getRepoKey({ ...item, includeDrafts: false }), item)
  }
  const platforms = new Map<string, PlatformRequestEstimate & { repos: Set<string> }>()
  function platform (provider: string) {
    const key = provider.toLowerCase()
    let value = platforms.get(key)
    if (!value) {
      value = { provider, repositories: 0, methods: { commits: 0, releases: 0, pulls: 0, issues: 0 }, allBranches: 0, unresolvedAllBranches: 0, defaultBranches: 0, perCheck: 0, defaultPerHour: 0, perHour: 0, repos: new Set() }
      platforms.set(key, value)
    }
    return value
  }
  for (const item of subscriptions.values()) {
    const value = platform(item.provider)
    value.repos.add(item.repo)
    value.methods[getRepoType(item.type)]++
    if (getRepoType(item.type) === 'commits' && !getRepoBranch(item)) value.defaultBranches++
  }
  for (const item of allBranches.values()) {
    const value = platform(item.provider)
    value.repos.add(item.repo)
    value.allBranches++
    if (!resolved) value.unresolvedAllBranches++
  }
  const rate = config.Auto ? checksPerHour : 0
  return Array.from(platforms.values(), ({ repos, ...value }) => {
    value.repositories = repos.size
    value.perCheck = Object.values(value.methods).reduce((sum, count) => sum + count, 0) + value.allBranches
    // Default branch names share a five-minute cache across recipients/types.
    value.defaultPerHour = config.Auto ? value.defaultBranches * defaultChecksPerHour : 0
    value.perHour = value.perCheck * rate + value.defaultPerHour
    return value
  }).sort((a, b) => a.provider.toLowerCase().localeCompare(b.provider.toLowerCase()))
}

let lastReport = ''
const number = (value: number) => Number(value > 0 && value < 0.01 ? value.toPrecision(2) : value.toFixed(2)).toString()

/** Pad before applying colors so ANSI escapes do not affect column alignment. */
function requestTable (estimates: PlatformRequestEstimate[], total: PlatformRequestEstimate, auto: boolean) {
  const rows = [
    ['平台', '仓库', '提交', '发布', 'PR', 'Issue', '基础/轮', '默认分支/时', '自动/时'],
    ...[...estimates, total].map(value => [
      value.provider,
      String(value.repositories),
      String(value.methods.commits),
      String(value.methods.releases),
      String(value.methods.pulls),
      String(value.methods.issues),
      `${value.unresolvedAllBranches ? '≥' : ''}${value.perCheck}`,
      number(value.defaultPerHour),
      `${value.unresolvedAllBranches && auto ? '≥' : ''}${number(value.perHour)}`
    ])
  ]
  const width = (text: string) => [...text].reduce((size, char) => size + (/[\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6]/.test(char) ? 2 : 1), 0)
  const widths = rows[0].map((_, column) => Math.max(...rows.map(row => width(row[column]))))
  const separator = widths.map(size => '─'.repeat(size)).join('  ')
  const lines = rows.map(row => row.map((cell, column) => {
    const padding = ' '.repeat(widths[column] - width(cell))
    return column ? padding + cell : cell + padding
  }).join('  '))
  return [lines[0], separator, ...lines.slice(1, -1), separator, lines[lines.length - 1]]
}

/** Called after local scanning, and refined after all remote branch lists have been resolved. */
export function logGitRequestEstimate (config: CodeConfig, local: PluginItem[], log: Log, options: { resolved?: RepoConfig[], force?: boolean } = {}) {
  if (config.RequestEstimateLog === false) {
    lastReport = ''
    return
  }
  try {
    const rates = config.Auto ? cronRequestRates(config.Cron) : { checksPerHour: 0, defaultChecksPerHour: 0 }
    const rate = rates.checksPerHour
    const estimates = estimateGitRequests(config, local, rate, options.resolved, rates.defaultChecksPerHour)
    const signature = JSON.stringify([config.Auto, config.Cron, estimates])
    if (!options.force && signature === lastReport) return
    const color = (name: 'cyan' | 'green' | 'yellow', text: string) => log[name]?.(text) ?? text
    const total: PlatformRequestEstimate = {
      provider: '合计',
      repositories: 0,
      methods: { commits: 0, releases: 0, pulls: 0, issues: 0 },
      allBranches: 0,
      unresolvedAllBranches: 0,
      defaultBranches: 0,
      perCheck: 0,
      defaultPerHour: 0,
      perHour: 0
    }
    for (const value of estimates) {
      for (const field of ['repositories', 'allBranches', 'unresolvedAllBranches', 'defaultBranches', 'perCheck', 'defaultPerHour', 'perHour'] as const) total[field] += value[field]
      for (const method of ['commits', 'releases', 'pulls', 'issues'] as const) total.methods[method] += value.methods[method]
    }
    const partial = total.unresolvedAllBranches > 0
    const lines = [color('cyan', '[DF:仓库请求估算]')]
    if (config.Auto) {
      lines.push(`  自动检查：已开启 | Cron：${config.Cron}`)
      lines.push(`  检查频率：${number(rate)} 轮/小时${rate ? `（平均间隔约 ${number(60 / rate)} 分钟）` : ''}`)
      lines.push(`  ${color(partial ? 'yellow' : 'green', `预计自动访问：${partial ? '至少 ' : ''}${number(total.perHour)} 次/小时`)}`)
    } else {
      lines.push(`  ${color('yellow', '自动检查已关闭（CodeUpdate.Auto=false）')}`)
      lines.push(`  计划 Cron：${config.Cron}（开启自动检查后生效）`)
      lines.push('  预计自动访问：0 次/小时；每轮请求量见下表')
    }
    if (estimates.length) {
      const table = requestTable(estimates, total, config.Auto)
      lines.push('', ...table.map((line, index) => `  ${index === 0 ? color('cyan', line) : index === table.length - 1 ? color(config.Auto ? 'green' : 'yellow', line) : line}`))
    } else {
      lines.push('', '  当前没有需要监听的仓库，预计自动访问 0 次/小时')
    }
    if (total.allBranches) {
      lines.push('', ...estimates.filter(value => value.allBranches).map(value => `  all 分支列表：${value.provider} ${value.allBranches} 次/轮（已计入基础/轮）`))
    }
    if (partial) {
      for (const value of estimates.filter(value => value.unresolvedAllBranches)) {
        lines.push(`  ${color('yellow', `${value.provider}: ${value.unresolvedAllBranches} 个 all 仓库的分支数待远程检查，≥ 表示已知下限`)}`)
      }
      lines.push(`  检查完成后补充分支用量${config.Auto ? `；每个新增监听分支约增加 ${number(rate)} 次/小时` : ''}`)
    }
    lines.push('',
      '  单位：基础/轮为每次检查的请求数；默认分支/时已计入自动/时（次/小时）。',
      '  口径：按去重监听项估算，默认分支查询按 5 分钟缓存；统计本身不发起请求。',
      '  不含：额外分页、PR/Issue 详情、评论、diff 和手动检查。',
      '  非每日 Cron 按未来 366 天平均，实际访问量随活动和分支数量变化。'
    )
    log.info(lines.join('\n'))
    lastReport = signature
  } catch (error) {
    log.warn(`[DF:仓库请求估算] 无法计算请求量（Cron或监听配置无效、定时解析器不可用）: ${error instanceof Error ? error.message : String(error)}`)
  }
}
