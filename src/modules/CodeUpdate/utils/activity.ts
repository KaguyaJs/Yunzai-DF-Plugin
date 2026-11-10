import { createHash } from 'node:crypto'
import config from '@/config'
import type { ActivityEvent, ActivityItem, ActivitySnapshot, GitActivityAction, GitActivityItem, GitActivityMethod } from '@/types'
import type { RepoConfig, SubscriptionTarget } from './repo'
import { getRepoKey } from './repo'

export const ACTIVITY_ACTIONS: Record<GitActivityAction | 'snapshot', string> = {
  opened: '新建',
  closed: '关闭',
  reopened: '重新打开',
  merged: '合并',
  ready_for_review: '转为正式',
  converted_to_draft: '转为草稿',
  edited: '修改正文或标题',
  labeled: '添加标签',
  unlabeled: '移除标签',
  synchronize: '提交新代码',
  commented: '新评论',
  snapshot: '当前状态'
}

const DEFAULT_EVENTS: Record<GitActivityMethod, GitActivityAction[]> = {
  pulls: ['opened', 'closed', 'reopened', 'merged', 'ready_for_review'],
  issues: ['opened', 'closed', 'reopened']
}

function integerOption (value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.floor(number))) : fallback
}

export function activityOptions () {
  const options = config.CodeUpdate.Activity
  return {
    pageSize: integerOption(options?.PageSize, 100, 1, 100),
    maxPages: integerOption(options?.MaxPages, 20, 1, 1000),
    initialLimit: integerOption(options?.InitialLimit, 10, 1, 100),
    batchSize: integerOption(options?.BatchSize, 20, 1, 50),
    bodyLimit: integerOption(options?.BodyLimit, 600, 0, 10000),
    overlapSeconds: integerOption(options?.OverlapSeconds, 60, 1, 3600),
    sendLinks: options?.SendLinks !== false
  }
}

export function isActivityMethod (method: string): method is GitActivityMethod {
  return method === 'pulls' || method === 'issues'
}

export function activityEvents (rule: RepoConfig): GitActivityAction[] {
  return rule.events?.length ? rule.events : DEFAULT_EVENTS[rule.type === 'pulls' ? 'pulls' : 'issues']
}

export function safeActivityUrl (value: string | undefined) {
  try {
    const url = new URL(value || '')
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
}

export function activityDate (value: string) {
  const date = new Date(value)
  if (!value || !Number.isFinite(date.getTime())) throw new Error('PR/Issue 数据包含无效时间')
  return date.toISOString()
}

export function activityHash (value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function activityExcerpt (body: string) {
  const limit = activityOptions().bodyLimit
  if (!limit) return ''
  const excerpt = body.slice(0, limit).split('\n').slice(0, 24).join('\n')
  return excerpt.length < body.length ? `${excerpt}\n\n……` : excerpt
}

export function activityUser (user: GitActivityItem['user']) {
  const author = user?.login || user?.name || '未知作者'
  return {
    author,
    avatar: safeActivityUrl(user?.avatar_url) || undefined,
    bot: user?.type?.toLowerCase() === 'bot' || /\[bot\]$/i.test(author)
  }
}

export function normalizeActivityItem (data: GitActivityItem, method: GitActivityMethod): ActivityItem {
  if (!data || !/^[\w-]+$/.test(String(data.number ?? '')) || typeof data.title !== 'string') {
    throw new Error('PR/Issue 数据缺少编号或标题')
  }
  const state = data.merged || data.merged_at || data.state === 'merged'
    ? 'merged'
    : data.state === 'closed' ? 'closed' : data.state === 'open' ? 'open' : undefined
  if (!state || (method === 'issues' && state === 'merged')) throw new Error('PR/Issue 数据包含未知状态')
  const body = typeof data.body === 'string' ? data.body : ''
  const labels = new Map<string, { name: string, color: string }>()
  for (const label of data.labels ?? []) {
    const name = typeof label === 'string' ? label : label.name
    if (!name) continue
    const color = typeof label === 'string' ? '' : label.color?.replace(/^#/, '') || ''
    labels.set(name.toLowerCase(), { name, color: /^[\da-f]{6}$/i.test(color) ? color : '64748b' })
  }
  const stats = method === 'pulls' && [data.changed_files, data.additions, data.deletions]
    .every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    ? { files: data.changed_files!, additions: data.additions!, deletions: data.deletions! }
    : undefined
  return {
    number: String(data.number),
    title: data.title,
    body: activityExcerpt(body),
    bodyHash: activityHash(body),
    url: safeActivityUrl(data.html_url),
    state,
    draft: method === 'pulls' && data.draft === true,
    ...activityUser(data.user ?? data.author),
    labels: Array.from(labels.values()).sort((a, b) => a.name.localeCompare(b.name)),
    baseBranch: method === 'pulls' ? data.base?.ref || '' : '',
    headBranch: method === 'pulls' ? data.head?.label || data.head?.ref || '' : '',
    headSha: method === 'pulls' ? data.head?.sha || '' : '',
    createdAt: activityDate(data.created_at),
    updatedAt: activityDate(data.updated_at),
    closedAt: data.closed_at ? activityDate(data.closed_at) : undefined,
    mergedAt: data.merged_at ? activityDate(data.merged_at) : undefined,
    comments: data.comments ?? data.comments_count,
    stats
  }
}

export function activitySnapshot (item: ActivityItem, previous?: ActivitySnapshot): ActivitySnapshot {
  return {
    state: item.state,
    draft: item.draft,
    title: item.title,
    bodyHash: item.bodyHash,
    labels: item.labels.map(label => label.name.toLowerCase()).sort(),
    baseBranch: item.baseBranch,
    headSha: item.headSha,
    updatedAt: item.updatedAt,
    lastCommentId: previous?.lastCommentId
  }
}

export function detectActivityActions (item: ActivityItem, previous?: ActivitySnapshot): GitActivityAction[] {
  const actions: GitActivityAction[] = []
  if (!previous) {
    actions.push('opened')
    if (item.state !== 'open') actions.push(item.state === 'merged' ? 'merged' : 'closed')
    return actions
  }
  if (item.state !== previous.state) actions.push(item.state === 'open' ? 'reopened' : item.state === 'merged' ? 'merged' : 'closed')
  if (item.draft !== previous.draft) actions.push(item.draft ? 'converted_to_draft' : 'ready_for_review')
  if (item.title !== previous.title || item.bodyHash !== previous.bodyHash) actions.push('edited')
  const labels = item.labels.map(label => label.name.toLowerCase())
  if (labels.some(label => !previous.labels.includes(label))) actions.push('labeled')
  if (previous.labels.some(label => !labels.includes(label))) actions.push('unlabeled')
  if (item.headSha && previous.headSha && item.headSha !== previous.headSha) actions.push('synchronize')
  return actions
}

export function makeActivityEvent (rule: RepoConfig, item: ActivityItem, actions: ActivityEvent['actions']): ActivityEvent {
  const repoKey = getRepoKey(rule)
  let occurredAt = item.updatedAt
  if (actions.includes('merged')) occurredAt = item.mergedAt || item.updatedAt
  else if (actions.includes('closed')) occurredAt = item.closedAt || item.updatedAt
  else if (actions.length === 1 && actions[0] === 'opened') occurredAt = item.createdAt
  return {
    id: activityHash([repoKey, item.number, actions, activitySnapshot(item)]),
    repoKey,
    provider: rule.provider,
    repo: rule.repo,
    method: rule.type === 'pulls' ? 'pulls' : 'issues',
    item,
    actions,
    occurredAt
  }
}

export function matchesActivity (event: ActivityEvent, rule: RepoConfig) {
  const { item, comment } = event
  const actions = event.actions.includes('snapshot')
    ? [item.state === 'merged' ? 'merged' : item.state === 'closed' ? 'closed' : 'opened']
    : event.actions
  if (!actions.some(action => activityEvents(rule).includes(action as GitActivityAction))) return false
  if (rule.excludeBots !== false && (comment ? comment.bot : item.bot)) return false
  if (item.draft && rule.includeDrafts !== true) return false
  const labels = item.labels.map(label => label.name.toLowerCase())
  const includedLabels = event.actions.includes('unlabeled') ? [...labels, ...(event.previousLabels ?? [])] : labels
  if (rule.labels?.length && !rule.labels.some(label => includedLabels.includes(label.toLowerCase()))) return false
  if (rule.excludeLabels?.some(label => labels.includes(label.toLowerCase()))) return false
  const author = (comment?.author ?? item.author).toLowerCase()
  if (rule.authors?.length && !rule.authors.some(value => value.toLowerCase() === author)) return false
  if (rule.excludeAuthors?.some(value => value.toLowerCase() === author)) return false
  return event.method !== 'pulls' || !rule.baseBranches?.length || rule.baseBranches.includes(item.baseBranch)
}

export function activityTargets (event: ActivityEvent, targets: Map<string, SubscriptionTarget>) {
  return Array.from(targets).filter(([, target]) => target.repos.get(event.repoKey)?.some(rule => matchesActivity(event, rule)))
    .map(([key]) => key)
}
