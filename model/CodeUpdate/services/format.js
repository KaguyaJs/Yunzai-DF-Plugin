import { marked } from "marked"
import { timeAgo } from "../utils/index.js"
import { Res_Path, Config, Data } from "#components"
import fs from "node:fs"
import path from "node:path"
import { imagePoke } from "#model"

const COMMIT_TYPES = new Set([
  "pr", "feat", "fix", "docs", "style",
  "refactor", "perf", "test", "build",
  "ci", "chore", "revert"
])

const EMOJI_MAP = Data.getJSON("Emoji.json", "json") || {}

export function formatCommitInfo(data, source, repo, branch) {
  const { author, committer, commit, stats, files, sha } = data
  const authorName = `<span>${commit.author.name}</span>`
  const committerName = `<span>${commit.committer.name}</span>`
  const authorTime = `<span>${timeAgo(commit.author.date)}</span>`
  const committerTime = `<span>${timeAgo(commit.committer.date)}</span>`
  const timeInfo = authorName === committerName
    ? `${authorName} 提交于 ${authorTime}`
    : `${authorName} 编写于 ${authorTime}，并由 ${committerName} 提交于 ${committerTime}`

  const icon = getIcon(source)

  return {
    avatar: {
      is: author?.avatar_url !== committer?.avatar_url,
      author: author?.avatar_url,
      committer: committer?.avatar_url
    },
    name: {
      source,
      repo,
      branch,
      sha: sha.slice(0, 5).toUpperCase(),
      authorStart: commit.author.name?.[0] ?? "?",
      committerStart: commit.committer.name?.[0] ?? "?"
    },
    time_info: timeInfo,
    icon,
    text: formatMessage(commit.message),
    stats: stats && files ? { files: files.length, additions: stats.additions, deletions: stats.deletions } : false
  }
}

export function formatMessage(message) {
  if (!message) return "<span class=\"head\">无提交信息</span>"

  const lines = message.split("\n")
  const parsedInfo = parseTitle(lines[0].trim())
  lines[0] = commitTitle(parsedInfo)

  return lines.join("<br>")
}

function parseTitle(title) {
  if (title.toLowerCase().startsWith("merge pull request")) {
    const prMatch = title.match(/#(\d+) from (\S+)/i)
    if (prMatch) {
      return {
        type: "pr",
        subject: `合并 ${prMatch[2]}`,
        prNum: prMatch[1],
        isPr: true
      }
    }
  }

  const convRegex = /^(?:(\p{Emoji}|:[a-zA-Z0-9_]+:))?\s*(\w+)(?:\(([^)]+)\))?:\s*(.+)$/iu
  const parts = title.match(convRegex)
  if (parts) {
    const [ , rawEmoji, type, scope, subject ] = parts
    const emoji = EMOJI_MAP[rawEmoji] || rawEmoji
    if (COMMIT_TYPES.has(type.toLowerCase())) {
      return {
        type: type.toLowerCase(),
        scope: scope || undefined,
        subject,
        emoji,
        isPr: false
      }
    }
  }

  return {
    type: "unknown",
    subject: title,
    isPr: false
  }
}

function commitTitle(info) {
  let badge = ""
  let headContent = ""

  if (info.isPr) {
    const prNumHtml = info.prNum ? `<span class="pr-num">#${info.prNum}</span>` : ""
    badge = "<span class=\"commit-prefix prefix-pr\">PR</span>"
    headContent = `<strong>${info.subject}</strong> ${prNumHtml}`
  } else if (info.type && info.type !== "unknown") {
    const typeClass = `prefix-${info.type}`
    const emojiClass = info.emoji ? " has-emoji" : ""
    badge = `<span class="commit-prefix ${typeClass}${emojiClass}">${info.emoji || ""}${info.type}</span>`
    const scopeText = info.scope ? `(${info.scope}) ` : ""
    headContent = `${scopeText}${info.subject}`
  } else {
    headContent = info.subject
  }

  return `${badge} <span class="head">${headContent}</span>`.trim()
}

export function formatReleaseInfo(data, source, repo) {
  const { tag_name, name, body, author, published_at } = data
  const authorName = `<span>${author?.login || author?.name}</span>`
  const authorTime = `<span>${timeAgo(published_at)}</span>`
  const timeInfo = authorName ? `${authorName} 发布于 ${authorTime}` : `${authorTime}`
  const icon = getIcon(source)

  return {
    release: true,
    avatar: author?.avatar_url,
    icon,
    name: {
      source,
      repo,
      tag: tag_name,
      authorStart: author?.login?.[0] || author?.name?.[0] || "?"
    },
    time_info: timeInfo,
    text: `<span class='head'>${name}</span><br/>${marked(body)}`
  }
}

function getIcon(source) {
  const a = Config.CodeUpdate.repos.reduce((acc, item) => {
    acc[item.provider] = item.icon
    return acc
  }, {})
  const icon = a[source] || "git"
  const ICON_DIR = path.resolve(`${Res_Path}/CodeUpdate/icon`)

  const files = fs.readdirSync(ICON_DIR)
  const found = files.find(file => path.parse(file).name === icon)
  if (found) {
    return path.join(ICON_DIR, found)
  }

  if (/^(https?:\/\/|file:\/\/\/|\/|\.\/|[a-zA-Z]:\\)/.test(icon)) {
    return icon
  }

  return imagePoke("从雨")
}
