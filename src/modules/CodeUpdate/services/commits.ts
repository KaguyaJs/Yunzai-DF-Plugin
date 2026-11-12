import config from '@/config'
import GitApi from '@/modules/GitApi'
import { logger } from '@/utils'
import type { Commit } from '@/types'
import type { RepoConfig, SubscriptionTarget } from '../utils/repo'
import { getRepoKey, getRepoRedisKey } from '../utils/repo'
import { resolveBranch } from '../utils/autoBranch'
import { activityOptions } from '../utils/activity'
import { redisHeler } from '../utils/redis'

export interface PendingCommit {
  commit: Commit
  branch: string
  journalKey: string
  targets: string[]
}

function commitPayload (commit: Commit) {
  if (typeof commit?.sha !== 'string' || !commit.sha || typeof commit.commit?.message !== 'string') {
    throw new Error('Commit 接口未返回有效提交内容，保留检查进度')
  }
  return commit
}

/** Capture every new commit before rendering; failed recipients retain the original payload. */
export async function fetchCommits (
  rule: RepoConfig,
  isAuto: boolean,
  targets: Map<string, SubscriptionTarget>,
  previousRules: RepoConfig[]
): Promise<PendingCommit[]> {
  const redisKey = getRepoRedisKey(rule)
  const journalKey = redisHeler.getCommitKey(redisKey)
  const repoKey = getRepoKey(rule)
  const recipients = Array.from(targets).filter(([, target]) => target.repos.has(repoKey)).map(([key]) => key)
  const existing = isAuto ? await redisHeler.getCommitJournal(journalKey) : null
  let journal = existing ? structuredClone(existing) : null
  if (journal) {
    for (const [sha, pending] of Object.entries(journal.pending)) {
      pending.targets = pending.targets.filter(target => recipients.includes(target))
      if (!pending.targets.length) delete journal.pending[sha]
    }
  }
  const rollback = journal ? structuredClone(journal) : null
  let scanned = false
  try {
    const branch = await resolveBranch(rule)
    const result = await GitApi.getRepositoryData(rule.provider, rule.repo, 'commits', branch)
    if (result === false) throw new Error('无法获取分支最新提交，保留检查进度')
    const head = Array.isArray(result) ? result[0] : result
    if (!head || typeof head.sha !== 'string' || !head.sha) throw new Error('分支未返回有效提交标识，保留检查进度')
    if (!isAuto) return [{ commit: commitPayload(head), branch, journalKey, targets: recipients }]

    const legacyKeys = Array.from(new Set([redisKey, ...previousRules.map(candidate =>
      redisHeler.getLegacyRedisKey(candidate.provider, 'commits', candidate.repo, candidate.branch))]))
    let sourceKey = redisKey
    if (!journal) {
      for (const key of legacyKeys) {
        const cursor = await redisHeler.getSha(key)
        if (!cursor) continue
        journal = { version: 1, cursor, branch, pending: {} }
        sourceKey = key
        break
      }
    }

    let commits: Commit[] = []
    if (!journal) {
      journal = { version: 1, cursor: head.sha, branch, pending: {} }
      if (config.CodeUpdate.FirstAdd) commits = [commitPayload(head)]
    } else if (journal.branch !== branch) {
      // Default-branch subscriptions keep their identity, while old retries keep their original branch label.
      logger.warn(`${rule.provider} ${rule.repo} 的默认分支由 ${journal.branch} 变为 ${branch}，从最新提交建立新基线`)
      commits = [commitPayload(head)]
    } else if (journal.cursor !== head.sha) {
      const options = activityOptions()
      const updates = await GitApi.getCommitUpdates(rule.provider, rule.repo, journal.cursor, head.sha, options)
      if (updates === false) throw new Error('新增提交获取未完成，保留上次检查进度')
      if (updates.reset) logger.warn(`${rule.provider} ${rule.repo}:${branch} 的旧提交已不在当前历史中，从最新提交建立新基线，保留未完成投递`)
      commits = updates.commits.map(commit => commitPayload(commit.sha === head.sha ? head : commit))
      if (!commits.some(commit => commit.sha === head.sha)) throw new Error('新增提交列表缺少本轮 HEAD，保留检查进度')
    }

    // Upgrade partially delivered legacy SHA records without replaying successful recipients.
    const delivered = new Map<string, number>()
    if (!existing && commits.length) {
      for (const target of recipients) {
        for (const key of new Set([redisKey, sourceKey, ...legacyKeys])) {
          const sha = await redisHeler.getSha(redisHeler.getDeliveryKey(key, target))
          if (!sha) continue
          delivered.set(target, commits.findIndex(commit => commit.sha === sha))
          break
        }
      }
    }
    for (const [index, commit] of commits.entries()) {
      if (journal.pending[commit.sha]) continue
      const assigned = recipients.filter(target => index > (delivered.get(target) ?? -1))
      if (assigned.length) journal.pending[commit.sha] = { commit, branch, targets: assigned }
    }
    scanned = !existing || journal.cursor !== head.sha || journal.branch !== branch
    journal.cursor = head.sha
    journal.branch = branch
  } catch (error) {
    logger.error(`获取 ${rule.provider} commits ${rule.repo} 数据失败: `, error)
    journal = rollback
  }
  if (!isAuto || !journal) return []
  if (scanned || (existing && JSON.stringify(journal) !== JSON.stringify(existing))) {
    // One SET commits the cursor and all outgoing payloads; an unsuccessful write prevents delivery.
    await redisHeler.saveCommitJournal(journalKey, journal)
  }
  if ((scanned || (existing && JSON.stringify(journal) !== JSON.stringify(existing))) && !Object.keys(journal.pending).length) {
    // Preserve the legacy baseline for existing installations and obsolete-key cleanup.
    await redisHeler.updatesSha(redisKey, journal.cursor)
  }
  return Object.values(journal.pending).map(pending => ({ ...pending, journalKey }))
}
