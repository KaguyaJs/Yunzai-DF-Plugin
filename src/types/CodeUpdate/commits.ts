import type { Commit } from './Git'
import type { CodeDiff } from './activity'

/** The observed branch tip and its undelivered commits are saved atomically. */
export interface CommitJournal {
  version: 1
  cursor: string
  branch: string
  pending: Record<string, { commit: Commit, branch: string, targets: string[], diff?: CodeDiff }>
}
