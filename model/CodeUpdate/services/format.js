import { marked } from "marked"
import { timeAgo } from "../utils/index.js"
import { Res_Path, Config } from "#components"
import fs from "node:fs"
import path from "node:path"
import { imagePoke } from "#model"

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
  const lines = message.split("\n")
  const firstLine = lines[0]

  const conventionalCommitRegex = /^([^\w\s]+(?:\s*))?(\w+)(?:\([^)]+\))?:\s*(.*)/
  const match = firstLine.match(conventionalCommitRegex)

  let formattedFirstLine

  if (match) {
    const emoji = match[1] || ""
    const type = match[2].toLowerCase()
    const subject = match[3]

    let badgeClass = "commit-prefix"
    if (emoji) {
      badgeClass += " has-emoji"
    }

    const badgeContent = `${emoji}${type}`

    const badge = `<span class="${badgeClass} prefix-${type}">${badgeContent}</span>`

    formattedFirstLine = `${badge} <span class='head'>${subject}</span>`
  } else {
    formattedFirstLine = `<span class='head'>${firstLine}</span>`
  }

  lines[0] = formattedFirstLine
  return lines.join("<br>")
}

export function formatReleaseInfo(data, source, repo) {
  const { tag_name, name, body, author, published_at } = data
  const authorName = `<span>${author?.login || author?.name}</span>`
  const authorAvatar = author?.avatar_url
  const authorTime = `<span>${timeAgo(published_at)}</span>`
  const timeInfo = authorName ? `${authorName} 发布于 ${authorTime}` : `${authorTime}`
  const icon = getIcon(source)

  return {
    release: true,
    avatar: authorAvatar,
    icon,
    name: {
      source,
      repo,
      tag: tag_name,
      authorStart: author?.login?.[0] || author?.name?.[0] || "?"
    },
    time_info: timeInfo,
    text: "<span class='head'>" + name + "</span>\n" + marked(body)
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
