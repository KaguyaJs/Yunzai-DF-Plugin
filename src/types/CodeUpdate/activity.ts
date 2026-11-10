import type { GitActivityAction, GitActivityMethod } from './support'

export interface ActivityUser {
  login?: string
  name?: string | null
  avatar_url?: string
  type?: string
}

export interface ActivityLabel {
  name: string
  color?: string
}

/** Fields shared by GitHub, Gitee, Gitcode and Gitea issue/pull APIs. */
export interface GitActivityItem {
  id?: number | string
  number: number | string
  title: string
  body?: string | null
  state: string
  html_url?: string
  created_at: string
  updated_at: string
  closed_at?: string | null
  merged_at?: string | null
  merged?: boolean
  draft?: boolean
  user?: ActivityUser
  author?: ActivityUser
  labels?: (ActivityLabel | string)[]
  base?: { ref?: string }
  head?: { ref?: string, sha?: string, label?: string }
  pull_request?: unknown
  comments?: number
  comments_count?: number
  additions?: number
  deletions?: number
  changed_files?: number
}

export interface GitActivityComment {
  id: number | string
  body?: string | null
  html_url?: string
  created_at: string
  user?: ActivityUser
  author?: ActivityUser
}

export interface ActivityItem {
  number: string
  title: string
  body: string
  bodyHash: string
  url: string
  state: 'open' | 'closed' | 'merged'
  draft: boolean
  author: string
  avatar?: string
  bot: boolean
  labels: ActivityLabel[]
  baseBranch: string
  headBranch: string
  headSha: string
  createdAt: string
  updatedAt: string
  closedAt?: string
  mergedAt?: string
  comments?: number
  stats?: { files: number, additions: number, deletions: number }
}

export interface ActivitySnapshot {
  state: ActivityItem['state']
  draft: boolean
  title: string
  bodyHash: string
  labels: string[]
  baseBranch: string
  headSha: string
  updatedAt: string
  lastCommentId?: string
}

export interface ActivityEvent {
  id: string
  repoKey: string
  provider: string
  repo: string
  method: GitActivityMethod
  actions: (GitActivityAction | 'snapshot')[]
  previousLabels?: string[]
  item: ActivityItem
  occurredAt: string
  comment?: {
    id: string
    body: string
    url: string
    author: string
    avatar?: string
    bot: boolean
  }
}

/** Observation state and undelivered payloads are persisted together. */
export interface ActivityJournal {
  version: 1
  checkedAt: string
  items: Record<string, ActivitySnapshot>
  pending: Record<string, { event: ActivityEvent, targets: string[] }>
}
