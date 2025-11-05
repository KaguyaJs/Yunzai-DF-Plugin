export interface CommitInfo {
  avatar: {
    is: boolean
    author?: string
    committer?: string
  }
  name: {
    source: string
    repo: string
    branch: string
    sha: string
    authorStart: string
    committerStart: string
  }
  time_info: string
  icon: string
  text: string
  stats: false | {
    files: number
    additions: number
    deletions: number
  }
}

export interface ReleaseInfo {
  release: true
  avatar?: string
  icon: string
  name: {
    source: string
    repo: string
    tag: string
    authorStart: string
  }
  time_info: string
  text: string
}
