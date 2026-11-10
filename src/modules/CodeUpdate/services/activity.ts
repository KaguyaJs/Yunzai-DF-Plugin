import config from '@/config'
import GitApi from '@/modules/GitApi'
import { logger } from '@/utils'
import type { ActivityEvent, ActivityJournal, ActivitySnapshot, GitActivityItem } from '@/types'
import type { RepoConfig, SubscriptionTarget } from '../utils/repo'
import { getRepoBranch, getRepoType } from '../utils/repo'
import { redisHeler } from '../utils/redis'
import { activityDate, activityEvents, activityExcerpt, activityHash, activityOptions, activitySnapshot, activityTargets, activityUser, detectActivityActions, isActivityMethod, makeActivityEvent, matchesActivity, normalizeActivityItem, safeActivityUrl } from '../utils/activity'
import { normalizePullRequestDiff, pullRequestDiffUrl } from '../utils/diff'

export interface PendingActivity {
  event: ActivityEvent
  journalKey: string
  targets: string[]
}

function newerComment (id: string, previous?: string) {
  if (!previous) return true
  try { return BigInt(id) > BigInt(previous) } catch { return id > previous }
}

async function hydrateItems<T, R> (items: T[], hydrate: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const result: R[] = []
  for (let offset = 0; offset < items.length; offset += 4) {
    const settled = await Promise.allSettled(items.slice(offset, offset + 4).map((item, index) => hydrate(item, offset + index)))
    const failed = settled.find(item => item.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
    for (const item of settled) if (item.status === 'fulfilled') result.push(item.value)
  }
  return result
}

/** Freeze optional diff with its event so retries cannot show code from a newer PR revision. */
async function enrichPullRequestDiff (event: ActivityEvent) {
  const options = activityOptions()
  if (!options.showDiff || event.method !== 'pulls' || event.comment) return
  try {
    const data = await GitApi.getPullRequestDiff(event.provider, event.repo, event.item.number, options.diffMaxFiles)
    if (data === false) throw new Error('暂时无法获取diff')
    // File endpoints expose the current PR revision. Verify it still matches the observed event.
    if (event.item.headSha) {
      const current = await GitApi.getActivityItem(event.provider, event.repo, 'pulls', event.item.number)
      if (current === false || current.head?.sha !== event.item.headSha) throw new Error('PR代码版本已变化或无法确认，请查看原文')
    }
    event.diff = normalizePullRequestDiff(data, event)
    if (!event.diff.files.length && event.diff.fileCount > 0) throw new Error('接口未提供文件diff，请查看原文')
  } catch (error) {
    logger.warn(`获取 ${event.provider} ${event.repo} PR #${event.item.number} diff 失败: `, error)
    event.diff = { url: pullRequestDiffUrl(event), fileCount: event.item.stats?.files ?? 0, hasMoreFiles: false, collapsed: true, files: [], unavailable: 'Diff暂不可用，请查看PR原文' }
  }
}

/** A complete scan and its outgoing payloads are committed with one Redis SET. */
export async function fetchActivity (
  rule: RepoConfig,
  isAuto: boolean,
  targets: Map<string, SubscriptionTarget>,
  rules: RepoConfig[]
): Promise<PendingActivity[]> {
  const method = getRepoType(rule.type)
  if (!isActivityMethod(method)) return []
  const options = activityOptions()
  const journalKey = redisHeler.getActivityKey(redisHeler.getRedisKey(rule.provider, method, rule.repo, getRepoBranch(rule)))
  const existing = isAuto ? await redisHeler.getActivityJournal(journalKey) : null
  const checkedAt = new Date().toISOString()
  let journal: ActivityJournal = existing ? structuredClone(existing) : { version: 1, checkedAt, items: {}, pending: {} }
  // Removed subscriptions and changed filters must not retain obsolete deliveries.
  for (const [id, pending] of Object.entries(journal.pending)) {
    const active = activityTargets(pending.event, targets)
    pending.targets = pending.targets.filter(target => active.includes(target))
    if (!pending.targets.length) delete journal.pending[id]
  }
  const rollback = structuredClone(journal)
  let scanned = false
  const previews: PendingActivity[] = []
  try {
    const since = existing ? new Date(Date.parse(existing.checkedAt) - options.overlapSeconds * 1000).toISOString() : undefined
    const data = await GitApi.getActivityItems(rule.provider, rule.repo, method, { ...options, since })
    if (data === false) throw new Error('列表获取未完成，保留上次检查进度')
    const unique = new Map<string, GitActivityItem>()
    for (const raw of data) {
      normalizeActivityItem(raw, method)
      const previous = unique.get(String(raw.number))
      if (!previous || Date.parse(raw.updated_at) > Date.parse(previous.updated_at)) unique.set(String(raw.number), raw)
    }
    const sorted = Array.from(unique.values()).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    const hydrated = await hydrateItems(sorted, async (raw, previewIndex) => {
      let item = normalizeActivityItem(raw, method)
      const previous = journal.items[item.number]
      const actions = existing ? detectActivityActions(item, previous) : ['snapshot'] as const
      const event = makeActivityEvent(rule, item, [...actions])
      const visible = rules.some(candidate => matchesActivity(event, candidate))
      const ambiguousMerge = method === 'pulls' && raw.state === 'closed' && raw.merged === undefined && raw.merged_at === undefined
      if (method === 'pulls' && (ambiguousMerge || (visible && (existing ? actions.length > 0 : (!isAuto || config.CodeUpdate.FirstAdd) && previewIndex < options.initialLimit)))) {
        const detail = await GitApi.getActivityItem(rule.provider, rule.repo, method, item.number)
        if (detail === false) {
          if (ambiguousMerge) throw new Error(`无法确定 PR #${item.number} 是否合并，保留检查进度`)
        } else {
          if (String(detail.number) !== item.number) throw new Error('PR 详情与请求编号不一致')
          item = normalizeActivityItem(detail, method)
        }
      }
      return { item, previous }
    })
    let initialCount = 0
    for (const { item, previous } of hydrated) {
      const snapshot = activitySnapshot(item, previous)
      if (!isAuto || (!existing && config.CodeUpdate.FirstAdd)) {
        const event = makeActivityEvent(rule, item, ['snapshot'])
        if (initialCount < options.initialLimit && rules.some(candidate => matchesActivity(event, candidate))) {
          initialCount++
          if (!isAuto) {
            await enrichPullRequestDiff(event)
            previews.push({ event, journalKey, targets: [] })
          } else {
            const recipients = activityTargets(event, targets)
            if (recipients.length) {
              await enrichPullRequestDiff(event)
              journal.pending[event.id] = { event, targets: recipients }
            }
          }
        }
      } else if (existing) {
        const actions = detectActivityActions(item, previous)
        if (actions.length) {
          const event = makeActivityEvent(rule, item, actions)
          event.previousLabels = previous?.labels
          const recipients = activityTargets(event, targets)
          if (recipients.length) {
            await enrichPullRequestDiff(event)
            journal.pending[event.id] = { event, targets: recipients }
          }
        }
      }
      if (isAuto && existing && item.comments !== 0 && rules.some(candidate => activityEvents(candidate).includes('commented'))) {
        const comments = await GitApi.getActivityComments(rule.provider, rule.repo, method, item.number, { ...options, since: since! })
        if (comments === false) throw new Error(`获取 #${item.number} 评论失败，保留检查进度`)
        for (const comment of comments) {
          if (!/^[\w-]+$/.test(String(comment.id ?? ''))) throw new Error('评论数据缺少有效编号')
          const createdAt = activityDate(comment.created_at)
          const id = String(comment.id)
          if (!newerComment(id, previous?.lastCommentId)) continue
          if (!previous?.lastCommentId && createdAt < existing.checkedAt) continue
          const event = makeActivityEvent(rule, item, ['commented'])
          event.id = activityHash([event.repoKey, 'comment', id])
          event.occurredAt = createdAt
          event.comment = { id, body: activityExcerpt(comment.body || ''), url: safeActivityUrl(comment.html_url) || item.url, ...activityUser(comment.user ?? comment.author) }
          const recipients = activityTargets(event, targets)
          if (recipients.length) journal.pending[event.id] = { event, targets: recipients }
          if (newerComment(id, snapshot.lastCommentId)) snapshot.lastCommentId = id
        }
      }
      journal.items[item.number] = snapshot satisfies ActivitySnapshot
    }
    journal.checkedAt = checkedAt
    scanned = true
  } catch (error) {
    logger.error(`获取 ${rule.provider} ${method} ${rule.repo} 活动失败: `, error)
    journal = rollback
  }
  if (!isAuto) return previews
  if (scanned || (existing && JSON.stringify(journal) !== JSON.stringify(existing))) await redisHeler.saveActivityJournal(journalKey, journal)
  return Object.values(journal.pending).map(pending => ({ ...pending, journalKey }))
    .sort((a, b) => a.event.occurredAt.localeCompare(b.event.occurredAt) || a.event.id.localeCompare(b.event.id))
}
