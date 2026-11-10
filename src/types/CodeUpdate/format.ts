import type { ActivityLabel, ActivityItem } from './activity'

export interface CommitInfo {
  url?: string
  avatar: {
    is: boolean
    author?: string
    committer?: string
  }
  name: {
    source: string
    repo: string
    branch?: string
    sha: string
    authorStart: string
    committerStart: string
  }
  time_info: string
  icon: string
  text: string
  translate?: false | {
    label: string
    title: string
  }
  stats: false | {
    files: number
    additions: number
    deletions: number
  }
}

export interface ReleaseInfo {
  url?: string
  release: true
  avatar: CommitInfo['avatar']
  icon: string
  name: {
    source: string
    repo: string
    tag?: string
    authorStart: string
  }
  time_info: string
  text: string
  translate?: false | {
    label: string
    title: string
  }
}

export interface ActivityInfo {
  activity: true
  url: string
  avatar: CommitInfo['avatar']
  icon: string
  name: {
    source: string
    repo: string
    authorStart: string
  }
  time_info: string
  text: string
  translate?: CommitInfo['translate']
  stats?: ActivityItem['stats']
  detail: {
    kind: 'PR' | 'Issue'
    number: string
    state: ActivityItem['state']
    stateLabel: string
    actions: string[]
    draft: boolean
    labels: ActivityLabel[]
    baseBranch: string
    headBranch: string
    comments?: number
    comment: boolean
  }
}

export type RepositoryInfo = CommitInfo | ReleaseInfo | ActivityInfo
