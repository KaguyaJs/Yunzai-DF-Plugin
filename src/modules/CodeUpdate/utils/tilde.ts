/** 行首围栏标记：3 个及以上连续的反引号或波浪号（含 info string） */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/
/** 围栏闭合行：只有标记字符与尾随空白 */
const FENCE_END_RE = /^ {0,3}(`{3,}|~{3,})\s*$/
/** 单独出现（不与相邻波浪号连成一串）的波浪号 */
const SINGLE_TILDE_RE = /(?<!~)~(?!~)/g

interface Line {
  /** 该行在原文中的起始偏移 */
  start: number
  content: string
}

interface Range {
  start: number
  end: number
}

/**
 * 转义正文中的单个波浪号，避免被 marked 当成删除线定界符
 *
 * marked 遵循 GFM 规范，单个 `~` 同样是删除线定界符。commit 正文里的
 * 区间写法（如 `18~27 次`、`3~6 轮`）会和正文中另一个 `~` 配成一对，
 * 导致波浪号被吞掉、中间整段文字被划上删除线（`重推 3~6 轮` 实际
 * 渲染成带删除线的「重推 36 轮」）。
 *
 * 处理规则：
 * - 只转义单个 `~`，`~~删除线~~` 与 `~~~` 围栏仍然可用；
 * - 围栏代码块（含未闭合围栏）与行内代码跨度内的波浪号保持原样，
 *   避免代码内容被插入多余的反斜杠；行内代码可跨行；
 * - 已被反斜杠转义的 `\~` 不会重复转义（函数幂等）；
 * - 4 空格缩进的代码块不做特殊处理，仍按普通文本转义。
 *
 * @param text markdown 源文本
 * @returns 转义后的 markdown 源文本
 *
 * @example
 * ```ts
 * escapeSingleTildes('超时 18~27 次') // '超时 18\\~27 次'
 * escapeSingleTildes('~~删除~~') // '~~删除~~'
 * escapeSingleTildes('`a~b`') // '`a~b`'
 * ```
 */
export function escapeSingleTildes (text: string): string {
  const ranges = collectCodeRanges(text)
  if (!ranges.length) return escapeTildes(text)

  let result = ''
  let cursor = 0
  for (const { start, end } of ranges) {
    if (start < cursor) continue
    result += escapeTildes(text.slice(cursor, start)) + text.slice(start, end)
    cursor = end
  }
  return result + escapeTildes(text.slice(cursor))
}

/**
 * 收集不应被转义的代码区域（围栏代码块与行内代码）
 * @param text markdown 源文本
 * @returns 按出现顺序排列的区间列表
 */
function collectCodeRanges (text: string): Range[] {
  const lines = splitLines(text)
  const ranges: Range[] = []
  const plainLines: Line[] = []

  let index = 0
  while (index < lines.length) {
    const fence = FENCE_RE.exec(lines[index].content)
    const marker = fence?.[1]
    // info string 里出现同种字符时不是围栏（CommonMark）
    if (fence && marker && !fence[2].includes(marker[0])) {
      const closeIndex = findFenceEnd(lines, index + 1, marker)
      ranges.push({
        start: lines[index].start,
        end: closeIndex === -1
          ? text.length
          : lines[closeIndex].start + lines[closeIndex].content.length
      })
      // 围栏未闭合时，后面的内容都在代码块内
      if (closeIndex === -1) return ranges
      index = closeIndex + 1
      continue
    }
    plainLines.push(lines[index])
    index++
  }

  ranges.push(...collectInlineRanges(plainLines))
  return ranges
}

/**
 * 查找围栏结束行
 * @param lines 全部行
 * @param from 起始行下标（围栏开行之后）
 * @param fence 开围栏标记
 * @returns 闭合行下标，未闭合返回 -1
 */
function findFenceEnd (lines: Line[], from: number, fence: string): number {
  const marker = fence[0]
  for (let i = from; i < lines.length; i++) {
    const match = FENCE_END_RE.exec(lines[i].content)
    // 闭合标记必须同种字符且不短于开围栏
    if (match && match[1][0] === marker && match[1].length >= fence.length) return i
  }
  return -1
}

/**
 * 按行拆分文本，并记录每行在原文中的偏移
 * @param text markdown 源文本
 * @returns 行列表
 */
function splitLines (text: string): Line[] {
  const lines: Line[] = []
  let start = 0
  for (;;) {
    const end = text.indexOf('\n', start)
    if (end === -1) {
      lines.push({ start, content: text.slice(start) })
      return lines
    }
    lines.push({ start, content: text.slice(start, end) })
    start = end + 1
  }
}

/**
 * 收集行内代码跨度（长度相等的反引号串配对，可跨行）
 * @param lines 不在围栏代码块内的行
 * @returns 区间列表
 */
function collectInlineRanges (lines: Line[]): Range[] {
  const ranges: Range[] = []
  let open: { ticks: number, start: number } | undefined

  for (const line of lines) {
    let i = 0
    while (i < line.content.length) {
      if (line.content[i] !== '`') {
        i++
        continue
      }
      let ticks = 0
      while (line.content[i + ticks] === '`') ticks++
      if (!open) {
        open = { ticks, start: line.start + i }
      } else if (open.ticks === ticks) {
        ranges.push({ start: open.start, end: line.start + i + ticks })
        open = undefined
      }
      i += ticks
    }
  }

  return ranges
}

/**
 * 转义文本中的单个波浪号，已经转义过的不再重复转义
 * @param text 文本片段
 * @returns 转义后的文本片段
 */
function escapeTildes (text: string): string {
  return text.replace(SINGLE_TILDE_RE, (match: string, offset: number, source: string) => {
    let backslashes = 0
    for (let i = offset - 1; i >= 0 && source[i] === '\\'; i--) backslashes++
    return backslashes % 2 ? match : '\\~'
  })
}
