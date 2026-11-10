import { createRequire } from 'node:module'
import path from 'node:path'
import type { Config, GitApiMethod } from '@/types'
import { YunzaiPath } from '@/dir'
import { normalizeRepository } from '../config/codeUpdateRepository'
import type { RepoConfig } from '../modules/CodeUpdate/utils/repo'
import { getRepoBranch, getRepoKey, getRepoType, repoPath } from '../modules/CodeUpdate/utils/repo'
import type { PluginItem } from './GitRepo'

type CodeConfig = Config['CodeUpdate']
type Log = { info: (message: string) => unknown, warn: (message: string) => unknown }
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
          subscriptions.set(getRepoKey(subscription), subscription)
        }
      }
    }
  }
  if (resolved) {
    subscriptions.clear()
    for (const item of resolved) subscriptions.set(getRepoKey(item), item)
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
const number = (value: number) => Number(value.toFixed(2)).toString()

/** Called after local scanning, and refined after all remote branch lists have been resolved. */
export function logGitRequestEstimate (config: CodeConfig, local: PluginItem[], log: Log, options: { resolved?: RepoConfig[], force?: boolean } = {}) {
  try {
    const rates = config.Auto ? cronRequestRates(config.Cron) : { checksPerHour: 0, defaultChecksPerHour: 0 }
    const rate = rates.checksPerHour
    const estimates = estimateGitRequests(config, local, rate, options.resolved, rates.defaultChecksPerHour)
    const signature = JSON.stringify([config.Auto, config.Cron, estimates])
    if (!options.force && signature === lastReport) return
    lastReport = signature
    const prefix = '[DF:仓库请求估算]'
    log.info(`${prefix} ${config.Auto ? `Cron=${config.Cron}，平均每小时检查 ${number(rate)} 轮${rate ? `，平均间隔约 ${number(60 / rate)} 分钟` : ''}` : '自动检查已关闭，预计自动访问 0 次/小时'}`)
    if (!estimates.length) log.info(`${prefix} 当前没有需要监听的仓库，预计访问 0 次/小时`)
    for (const value of estimates) {
      const { methods } = value
      log.info(`${prefix} ${value.provider}: ${value.repositories} 个仓库，提交 ${methods.commits} / 发布 ${methods.releases} / PR ${methods.pulls} / Issue ${methods.issues} 项；基础 ${value.perCheck} 次/轮（含 ${value.allBranches} 个all分支列表），默认分支查询约 ${number(value.defaultPerHour)} 次/小时；${value.unresolvedAllBranches && config.Auto ? '已知部分至少约' : '基础访问约'} ${number(value.perHour)} 次/小时`)
      if (value.unresolvedAllBranches) log.info(`${prefix} ${value.provider}: ${value.unresolvedAllBranches} 个all仓库的分支数待远程检查，将在检查后补充；每个新增监听分支约增加 ${number(rate)} 次/小时`)
    }
    log.info(`${prefix} 按去重监听项计算，不含额外分页、PR/Issue详情、评论、diff及手动检查；默认分支按5分钟缓存估算。非每日Cron按未来366天平均，实际访问量随活动和分支数量变化`)
  } catch (error) {
    log.warn(`[DF:仓库请求估算] 无法计算请求量（Cron或监听配置无效、定时解析器不可用）: ${error instanceof Error ? error.message : String(error)}`)
  }
}
