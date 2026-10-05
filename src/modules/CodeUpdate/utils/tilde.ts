/** 行首围栏标记（``` 或 ~~~），与 marked 的识别保持一致 */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/
/** 反引号串，用于定位行内代码 */
const BACKTICKS_RE = /`+/
/** 单独出现（不与相邻波浪号连成一串）的波浪号 */
const SINGLE_TILDE_RE = /(?<!~)~(?!~)/g

/**
 * 转义正文中的单个波浪号，避免被 marked 当成删除线定界符
 *
 * marked 遵循 GFM 规范，单个 `~` 同样是删除线定界符。commit 正文里的
 * 区间写法（如 `18~27 次`、`3~6 轮`）会和正文中另一个 `~` 配成一对，
 * 导致波浪号被吞掉、中间整段文字被划上删除线（`重推 3~6 轮` 变成了
 * 带删除线的 `重推 36 轮`）。
 *
 * 这里只转义单个 `~`：`~~删除线~~` 与 `~~~` 围栏仍然可用；
 * 围栏代码块与行内代码内的波浪号保持原样，避免多出反斜杠。
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
  let fence: string | undefined

  return text
    .split('\n')
    .map(line => {
      const fenceMatch = FENCE_RE.exec(line)
      if (fenceMatch) {
        const marker = fenceMatch[1][0]
        if (!fence) fence = marker
        else if (fence === marker) fence = undefined
        return line
      }
      return fence ? line : escapeLine(line)
    })
    .join('\n')
}

/**
 * 转义单行文本里的单个波浪号，跳过行内代码
 * @param line markdown 单行文本
 * @returns 转义后的单行文本
 */
function escapeLine (line: string): string {
  let result = ''
  let rest = line

  for (;;) {
    const code = BACKTICKS_RE.exec(rest)
    if (!code) break
    const ticks = code[0]
    const close = rest.indexOf(ticks, code.index + ticks.length)
    if (close === -1) break
    const end = close + ticks.length
    result += escapeTildes(rest.slice(0, code.index)) + rest.slice(code.index, end)
    rest = rest.slice(end)
  }

  return result + escapeTildes(rest)
}

/**
 * 转义文本里的单个波浪号
 * @param text 文本片段
 * @returns 转义后的文本片段
 */
function escapeTildes (text: string): string {
  return text.replace(SINGLE_TILDE_RE, '\\~')
}
