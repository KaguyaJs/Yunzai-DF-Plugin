import fs from 'fs/promises'
import { Marked, Renderer, Tokens } from 'marked'
import type { ChangelogEntry, ParseOptions } from '@/types'

/**
 * 解析 CHANGELOG.md 并按指定的标题层级分段返回条目数组（最新在前）。
 *
 * 行为说明：
 * - 支持的 header 示例：
 * ```markdown
 *   ## [2.6.4](link) (2026-01-12)
 *   ## [2.6.4]
 *   ## 2.6.4 (2026-01-12)
 * ```
 * - 当 includeIntro 为 true 时，会将第一个 header 之前的内容作为一个 pseudo-entry（version 'intro'）。
 * - 每个条目包含解析出的 version、date、link、原始 raw 文本及用 marked 渲染的 html。
 * - limit 用于限制返回的最大条目数（包含 intro），超过则提前返回。
 *
 * @param filePath 要解析的 changelog 文件路径
 * @param opts 解析选项，见 ParseOptions 定义
 * @returns 解析后的 ChangelogEntry 数组，按文件顺序从上到下（最新在前）
 */
export async function parseChangelog (
  filePath: string,
  opts: ParseOptions = {}
): Promise<ChangelogEntry[]> {
  const { limit = Infinity, includeIntro = false, headingLevel = 2 } = opts

  const content = String(await fs.readFile(filePath, 'utf8'))
  const lines = content.replace(/\r\n/g, '\n').split('\n')

  // 支持几种 header 形式：
  // ## [2.6.4](link) (2026-01-12)
  // ## [2.6.4]
  // ## 2.6.4 (2026-01-12)
  const hPrefix = '#'.repeat(headingLevel)
  const headerRegex = new RegExp(
    `^${hPrefix}\\s*(?:\\[(?<ver1>[^\\]]+)\\](?:\\((?<link>[^)]+)\\))?|(?<ver2>[^\\s(]+))(?:\\s*\\((?<date>\\d{4}-\\d{2}-\\d{2})\\))?\\s*$`
  )

  const entries: ChangelogEntry[] = []
  let currentHeaderLine: string | null = null
  let currentMeta: { version?: string; link?: string; date?: string } = {}
  let bufferLines: string[] = []
  let seenCount = 0
  const introLines: string[] = []
  let foundFirstHeader = false
  const renderer: Partial<Renderer> = {
    strong (this: Renderer & { parser: any }, token: Tokens.Strong) {
      const content = this.parser.parseInline(token.tokens)
      const trimmedContent = content.replace(/\s+$/, '')
      if (trimmedContent.endsWith(':')) {
        const withoutColon = trimmedContent.replace(/:$/, '')
        return `<strong class="scope">${withoutColon}</strong>`
      }
      return `<strong>${content}</strong>`
    }
  }
  const marked = new Marked()
  marked.use({ renderer })

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const m = headerRegex.exec(line.trim())
    if (m && (m.groups?.ver1 || m.groups?.ver2)) {
      // 遇到一个新的版本 header
      if (!foundFirstHeader) {
        foundFirstHeader = true
        if (includeIntro && introLines.length > 0) {
          // 把 intro 当作一个伪 entry（version = 'intro'）
          const introRaw = introLines.join('\n').trim()
          if (introRaw) {
            entries.push({
              version: 'intro',
              header: `${hPrefix} intro`,
              raw: introRaw,
              html: marked.parse(introRaw),
            } as ChangelogEntry)
            seenCount++
            if (seenCount >= limit) return entries
          }
        }
      }

      // 保存上一个
      if (currentHeaderLine !== null) {
        const raw = bufferLines.join('\n').trim()
        entries.push({
          version: currentMeta.version ?? 'unknown',
          header: currentHeaderLine,
          date: currentMeta.date,
          link: currentMeta.link,
          raw,
          html: raw ? await marked.parse(raw) : '',
        })
        seenCount++
        if (seenCount >= limit) return entries
      }

      // start new
      currentHeaderLine = line.trim()
      currentMeta = {
        version: m.groups?.ver1 ?? m.groups?.ver2,
        link: m.groups?.link,
        date: m.groups?.date,
      }
      bufferLines = []
    } else {
      // 非 header：如果还没遇到任何 header，积累到 introLines
      if (!foundFirstHeader) {
        introLines.push(line)
      } else {
        bufferLines.push(line)
      }
    }
  }

  // 文件末尾，flush 最后一个
  if (currentHeaderLine !== null && seenCount < limit) {
    const raw = bufferLines.join('\n').trim()
    entries.push({
      version: currentMeta.version ?? 'unknown',
      header: currentHeaderLine,
      date: currentMeta.date,
      link: currentMeta.link,
      raw,
      html: raw ? await marked.parse(raw) : '',
    })
  }

  return entries
}

/**
 * 读取并返回前 n 个版本的 changelog 条目（默认 3 个）。
 *
 * 这是 parseChangelog 的便捷封装，使用默认 headingLevel=2 且不包含 intro。
 *
 * @param filePath changelog 文件路径
 * @param n 要返回的条目数量（默认 3）
 * @returns 限制数量的 ChangelogEntry 数组
 */
export async function getRecentChangelogEntries (
  filePath: string,
  n = 3
): Promise<ChangelogEntry[]> {
  return parseChangelog(filePath, { limit: n, includeIntro: false, headingLevel: 2 })
}
