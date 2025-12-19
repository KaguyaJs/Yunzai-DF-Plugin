export type GitCommitDataType = Commit[]

/**
 * Commit
 */
export interface Commit {
  url: string
  sha: string
  node_id: string
  html_url: string
  comments_url: string
  commit: {
    url: string
    author: null | GitUser
    committer: null | GitUser1
    message: string
    comment_count: number
    tree: {
      sha: string
      url: string
      [k: string]: unknown
    }
    verification?: Verification
    [k: string]: unknown
  }
  author: SimpleUser | null
  committer: SimpleUser | null
  parents: {
    sha: string
    url: string
    html_url?: string
    [k: string]: unknown
  }[]
  stats?: {
    additions?: number
    deletions?: number
    total?: number
    [k: string]: unknown
  }
  files?: DiffEntry[]
  [k: string]: unknown
}

/**
 * Metaproperties for Git author/committer information.
 */
export interface GitUser {
  name?: string
  email?: string
  date?: string
  [k: string]: unknown
}

/**
 * Metaproperties for Git author/committer information.
 */
export interface GitUser1 {
  name?: string
  email?: string
  date?: string
  [k: string]: unknown
}

export interface Verification {
  verified: boolean
  reason: string
  payload: string | null
  signature: string | null
  verified_at: string | null
  [k: string]: unknown
}

/**
 * A GitHub user.
 */
export interface SimpleUser {
  name?: string | null
  email?: string | null
  login: string
  id: number
  node_id: string
  avatar_url: string
  gravatar_id: string | null
  url: string
  html_url: string
  followers_url: string
  following_url: string
  gists_url: string
  starred_url: string
  subscriptions_url: string
  organizations_url: string
  repos_url: string
  events_url: string
  received_events_url: string
  type: string
  site_admin: boolean
  starred_at?: string
  user_view_type?: string
  [k: string]: unknown
}

/**
 * Diff Entry
 */
export interface DiffEntry {
  sha: string | null
  filename: string
  status:
  | 'added'
  | 'removed'
  | 'modified'
  | 'renamed'
  | 'copied'
  | 'changed'
  | 'unchanged'
  additions: number
  deletions: number
  changes: number
  blob_url: string
  raw_url: string
  contents_url: string
  patch?: string
  previous_filename?: string
  [k: string]: unknown
}

export type GitReleaseDataType = Release[]

/**
 * A release.
 */
export interface Release {
  url: string
  html_url: string
  assets_url: string
  upload_url: string
  tarball_url: string | null
  zipball_url: string | null
  id: number
  sha: null
  node_id: string
  /**
   * The name of the tag.
   */
  tag_name: string
  /**
   * Specifies the commitish value that determines where the Git tag is created from.
   */
  target_commitish: string
  name: string | null
  body?: string | null
  /**
   * true to create a draft (unpublished) release, false to create a published one.
   */
  draft: boolean
  /**
   * Whether to identify the release as a prerelease or a full release.
   */
  prerelease: boolean
  /**
   * Whether or not the release is immutable.
   */
  immutable?: boolean
  created_at: string
  published_at: string | null
  updated_at?: string | null
  author: SimpleUser
  assets: ReleaseAsset[]
  body_html?: string
  body_text?: string
  mentions_count?: number
  /**
   * The URL of the release discussion.
   */
  discussion_url?: string
  reactions?: ReactionRollup
  [k: string]: unknown
}
/**
 * Data related to a release.
 */
export interface ReleaseAsset {
  url: string
  browser_download_url: string
  id: number
  node_id: string
  /**
   * The file name of the asset.
   */
  name: string
  label: string | null
  /**
   * State of the release asset.
   */
  state: 'uploaded' | 'open'
  content_type: string
  size: number
  digest: string | null
  download_count: number
  created_at: string
  updated_at: string
  uploader: null | SimpleUser
  [k: string]: unknown
}

export interface ReactionRollup {
  url: string
  total_count: number
  '+1': number
  '-1': number
  laugh: number
  confused: number
  heart: number
  hooray: number
  eyes: number
  rocket: number
  [k: string]: unknown
}
