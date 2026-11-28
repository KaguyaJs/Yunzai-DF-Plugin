import config from '@/config'
import type { ActivityEvent, CodeDiff, DiffStats, GitDiff, GitDiffFile, GitPullRequestDiff, PullRequestDiff } from '@/types'
import { activityOptions, integerOption, safeActivityUrl } from './activity'

interface DiffLimits {
  diffMaxFiles: number
  diffMaxLines: number
}

export function commitDiffOptions () {
  const options = config.CodeUpdate.Commit
  return {
    showDiff: options?.ShowDiff === true,
    diffMaxFiles: integerOption(options?.DiffMaxFiles, 3, 1, 20),
    diffMaxLines: integerOption(options?.DiffMaxLines, 40, 1, 200)
  }
}

const STATUS: Record<string, string> = {
  added: '新增', removed: '删除', deleted: '删除', renamed: '重命名', copied: '复制', modified: '修改', changed: '修改'
}

export function pullRequestDiffUrl (event: ActivityEvent) {
  const value = safeActivityUrl(event.item.url)
  if (!value) return ''
  const url = new URL(value)
  if (/\/pulls?\/\d+\/?$/.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/$/, '')}/files`
  else if (/\/merge_requests\/\d+\/?$/.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/$/, '')}/diffs`
  url.hash = ''
  return url.href
}

function count (value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

function gitPath (value: string) {
  let path = value
  if (path.startsWith('"') && path.endsWith('"')) {
    path = path.slice(1, -1).replace(/(?:\\[0-7]{3})+/g, octals => Buffer.from([...octals.matchAll(/\\([0-7]{3})/g)].map(match => parseInt(match[1], 8))).toString('utf8'))
      .replace(/\\([\\"nt])/g, (_, escaped: string) => ({ n: '\n', t: '\t' })[escaped] ?? escaped)
  }
  return path.replace(/^[ab]\//, '')
}

/** Gitea exposes patches as unified text, including quoted Unicode/space-containing paths. */
export function parseUnifiedDiff (text: string, maxFiles: number): GitDiffFile[] {
  const sections = text.replace(/\r\n/g, '\n').split(/(?=^diff --git )/m)
  const files: GitDiffFile[] = []
  for (const section of sections) {
    if (!section.startsWith('diff --git ')) continue
    const header = section.match(/^diff --git ("(?:\\.|[^"])*"|a\/.*?) ("(?:\\.|[^"])*"|b\/.*)$/m)
    const old = section.match(/^--- (.+)$/m)?.[1] ?? header?.[1]
    const next = section.match(/^\+\+\+ (.+)$/m)?.[1] ?? header?.[2]
    const filename = next && next !== '/dev/null' ? gitPath(next) : old ? gitPath(old) : ''
    if (!filename) continue
    const start = section.search(/^@@ /m)
    const patch = start >= 0 ? section.slice(start).replace(/\n$/, '') : undefined
    const lines = patch?.split('\n') ?? []
    files.push({
      filename,
      previous_filename: old && old !== '/dev/null' && gitPath(old) !== filename ? gitPath(old) : undefined,
      status: /^new file mode /m.test(section) ? 'added' : /^deleted file mode /m.test(section) ? 'removed' : /^rename from /m.test(section) ? 'renamed' : 'modified',
      additions: lines.filter(line => line.startsWith('+')).length,
      deletions: lines.filter(line => line.startsWith('-')).length,
      patch
    })
    if (files.length >= maxFiles) break
  }
  return files
}

/** Persist bounded, escaped-at-template-time data; code is never passed through Markdown/translation. */
export function normalizePullRequestDiff (data: GitPullRequestDiff, event: ActivityEvent): PullRequestDiff {
  return normalizeCodeDiff(data, pullRequestDiffUrl(event), activityOptions(), event.item.stats)
}

export function normalizeCodeDiff (data: GitDiff, url: string, { diffMaxFiles, diffMaxLines }: DiffLimits, stats: DiffStats | undefined = data.stats): CodeDiff {
  const raw = data.kind === 'files' ? data.files : parseUnifiedDiff(data.text, diffMaxFiles + 1)
  const hasMore = data.kind === 'files' ? data.hasMore : data.truncated
  const fileCount = Math.max(count(stats?.files), raw.length)
  let collapsed = hasMore || fileCount > diffMaxFiles || count(stats?.additions) + count(stats?.deletions) > diffMaxLines
  let remaining = diffMaxLines
  const files: CodeDiff['files'] = raw.slice(0, diffMaxFiles).map(file => {
    const original = typeof file.patch === 'string' ? file.patch : typeof file.diff === 'string' ? file.diff : ''
    // Keep a single huge patch or code line from growing Redis payloads and screenshots indefinitely.
    const patch = original.slice(0, 200_000).replace(/\r\n?/g, '\n').replace(/\n$/, '')
    const rawLines = patch ? patch.split('\n') : []
    const actualAdditions = rawLines.filter(line => line.startsWith('+')).length
    const actualDeletions = rawLines.filter(line => line.startsWith('-')).length
    if (patch && (count(file.additions) > actualAdditions || count(file.deletions) > actualDeletions)) collapsed = true
    if (rawLines.length > remaining || original.length > 200_000) collapsed = true
    let oldNumber = 0
    let newNumber = 0
    const lines: CodeDiff['files'][number]['lines'] = []
    for (const line of rawLines.slice(0, remaining)) {
      const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      const kind = hunk ? 'hunk' : line.startsWith('+') ? 'add' : line.startsWith('-') ? 'delete' : 'context'
      if (hunk) { oldNumber = Number(hunk[1]); newNumber = Number(hunk[2]) }
      const numbered = kind !== 'hunk' && !line.startsWith('\\')
      const text = line.length > 160 ? `${line.slice(0, 160)}…` : line
      if (text !== line) collapsed = true
      lines.push({
        kind,
        text,
        oldNumber: numbered && kind !== 'add' && oldNumber > 0 ? oldNumber++ : undefined,
        newNumber: numbered && kind !== 'delete' && newNumber > 0 ? newNumber++ : undefined
      })
    }
    remaining -= lines.length
    const status = file.status || (file.new_file ? 'added' : file.deleted_file ? 'removed' : file.renamed_file ? 'renamed' : 'modified')
    const filename = file.filename || file.new_path || file.old_path || '未知文件'
    return {
      filename: filename.slice(0, 300),
      previousFilename: (file.previous_filename || (file.old_path !== filename ? file.old_path : undefined))?.slice(0, 300),
      status: STATUS[status] || '修改',
      additions: count(file.additions) || actualAdditions,
      deletions: count(file.deletions) || actualDeletions,
      missingPatch: !patch,
      lines
    }
  })
  if (raw.length && !files.length) collapsed = true
  return { url: safeActivityUrl(url), fileCount, hasMoreFiles: hasMore || fileCount > files.length, collapsed, files }
}

/** Apply current display limits to payloads queued under an earlier configuration. */
export function displayPullRequestDiff (diff: PullRequestDiff): PullRequestDiff {
  return displayCodeDiff(diff, activityOptions())
}

export function displayCodeDiff (diff: CodeDiff, { diffMaxFiles, diffMaxLines }: DiffLimits): CodeDiff {
  const collapsed = diff.collapsed || diff.fileCount > diffMaxFiles || diff.files.reduce((total, file) => total + file.lines.length, 0) > diffMaxLines
  return { ...diff, collapsed, files: diff.files.slice(0, diffMaxFiles).map(file => ({ ...file, lines: collapsed ? [] : file.lines })), hasMoreFiles: diff.hasMoreFiles || diff.files.length > diffMaxFiles }
}
