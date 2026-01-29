import { marked } from 'marked'
import { timeAgo, Data } from '@/utils'
import config from '@/config'
import { ResPath } from '@/dir'
import fs from 'node:fs'
import path from 'node:path'
import { FacePoke } from '@/modules'
import {
  GitCommitDataType,
  GitReleaseDataType,
  ReleaseInfo,
  CommitInfo
} from '@/types'

const COMMIT_TYPES = new Set([
  'pr', 'feat', 'fix', 'docs', 'style',
  'refactor', 'perf', 'test', 'build',
  'ci', 'chore', 'revert'
])
const EMOJI_MAP = Data.getJSON<Record<string, string>>('Emoji.json', 'json', false) || {}
const PROVIDER_ICON_MAP: Record<string, string> = config.CodeUpdate.repos
  .reduce((acc, item) => {
    acc[item.provider.toLowerCase()] = item.icon || ''
    return acc
  }, {} as Record<string, string>)
const ICON_DIR = path.resolve(`${ResPath}/CodeUpdate/icon`)
const ICON_FILES = fs.readdirSync(ICON_DIR)

export async function formatCommitInfo (
  data: GitCommitDataType[number],
  source: string,
  repo: string,
  branch?: string
): Promise<CommitInfo> {
  const { author, committer, commit, stats, files, sha } = data

  const authorName = (commit.author?.name && `<span>${commit.author.name}</span>`) ?? ''
  const committerName = (commit.committer?.name && `<span>${commit.committer.name}</span>`) ?? ''
  const authorTime = (commit.author?.date && `<span>${timeAgo(commit.author.date)}</span>`) ?? ''
  const committerTime = (commit.committer?.date && `<span>${timeAgo(commit.committer.date)}</span>`) ?? ''

  const timeInfo =
    authorName === committerName
      ? `${authorName} 提交于 ${authorTime}`
      : `${authorName} 编写于 ${authorTime}，并由 ${committerName} 提交于 ${committerTime}`

  return {
    avatar: {
      is: author?.avatar_url !== committer?.avatar_url,
      author: author?.avatar_url,
      committer: committer?.avatar_url,
    },
    name: {
      source,
      repo,
      branch,
      sha: sha.slice(0, 5).toUpperCase(),
      authorStart: commit.author?.name?.[0] ?? '?',
      committerStart: commit.committer?.name?.[0] ?? '?',
    },
    time_info: timeInfo,
    icon: await getIcon(source),
    text: formatMessage(commit.message),
    stats: stats && files
      ? { files: files.length, additions: stats.additions ?? NaN, deletions: stats.deletions ?? NaN }
      : false
  }
}

export function formatMessage (message?: string): string {
  if (!message) return '<span class="head">无提交信息</span>'

  message = replaceEmojiCodes(message)

  const lines = message.split('\n')
  if (config.CodeUpdate.badgeStyle) {
    const info = parseTitle(lines[0].trim())
    lines[0] = commitTitle(info)
  }

  const rest = lines.slice(1).join('\n').trim()
  if (!rest) return lines.join('<br>')

  let tokens
  try {
    tokens = marked.lexer(rest)
  } catch {
    return lines.join('<br>')
  }

  const isMarkdown = tokens.some(
    token => token.type !== 'paragraph' || token.raw.includes('\n')
  )

  return isMarkdown
    ? `${lines[0]}<br>${marked(rest)}`
    : lines.join('<br>')
}

function replaceEmojiCodes (text: string): string {
  for (const [code, emoji] of Object.entries(EMOJI_MAP)) {
    const reg = new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    text = text.replace(reg, emoji)
  }
  return text
}

interface ParsedTitle {
  type: string
  subject: string
  scope?: string
  emoji?: string
  prNum?: string
  isPr: boolean
}

function parseTitle (title: string): ParsedTitle {
  if (title.toLowerCase().startsWith('merge pull request')) {
    const prMatch = title.match(/#(\d+) from (\S+)/i)
    if (prMatch) {
      return {
        type: 'pr',
        subject: `合并 ${prMatch[2]}`,
        prNum: prMatch[1],
        isPr: true
      }
    }
  }

  const convRegex = /^(?:(\p{Emoji}))?\s*(\w+)(?:\(([^)]+)\))?:\s*(.+)$/iu
  const parts = title.match(convRegex)
  if (parts) {
    const [, emoji, type, scope, subject] = parts
    if (COMMIT_TYPES.has(type.toLowerCase())) {
      return {
        type: type.toLowerCase(),
        scope,
        subject,
        emoji,
        isPr: false
      }
    }
  }

  return {
    type: 'unknown',
    subject: title,
    isPr: false
  }
}

function commitTitle (info: ParsedTitle): string {
  let badge = ''
  let headContent = ''

  // === PR ===
  if (info.isPr) {
    const prNumHtml = info.prNum
      ? `<span class="pr-num">#${info.prNum}</span>`
      : ''

    badge = '<span class="commit-prefix prefix-pr">PR</span>'
    headContent = `<strong>${info.subject}</strong> ${prNumHtml}`
  } else if (info.type && info.type !== 'unknown') {
    const typeClass = `prefix-${info.type}`
    const emojiClass = info.emoji ? ' has-emoji' : ''
    const haveScope = info.scope ? ' haveScope' : ''

    badge = `<span class="commit-prefix ${typeClass}${emojiClass}${haveScope}">` +
      `${info.emoji || ''}${info.type}` +
      '</span>'

    if (info.scope) {
      badge += `<span class="scope commit-prefix">${info.scope}</span>`
    }

    headContent = info.subject
  } else {
    headContent = info.subject
  }

  return `${badge} <span class="head">${headContent}</span>`.trim()
}

export async function formatReleaseInfo (
  data: GitReleaseDataType[number],
  source: string,
  repo: string
): Promise<ReleaseInfo> {
  const { tag_name: tagName, name, body, author, published_at: publishedAt } = data

  const authorName = author?.login || author?.name || '?'
  const authorTime = publishedAt ? `<span>${timeAgo(publishedAt)}</span>` : '未知'

  return {
    release: true,
    avatar: author?.avatar_url,
    icon: await getIcon(source),
    name: {
      source,
      repo,
      tag: tagName,
      authorStart: authorName[0] ?? '?'
    },
    time_info: `<span>${authorName}</span> 发布于 ${authorTime}`,
    text: `<span class='head'>${name}</span><br/>${marked(body || '')}`
  }
}

async function getIcon (source: string): Promise<string> {
  const iconName = PROVIDER_ICON_MAP[source.toLowerCase()] || 'git'

  // find local file
  const found = ICON_FILES.find(file => path.parse(file).name.toLowerCase() === iconName.toLowerCase())
  if (found) {
    return path.join(ICON_DIR, found)
  }

  // absolute or url
  if (/^(https?:\/\/|file:\/\/\/|\/|\.\/|[a-zA-Z]:\\)/.test(iconName)) {
    return iconName
  }

  return FacePoke('从雨')
}
