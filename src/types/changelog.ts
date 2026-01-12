export interface ChangelogEntry {
  /** 解析的版本号 */
  version: string
  /** 原始 header 文本
   *
   * @example
   * "## [2.6.4](...) (2026-01-12)"）
   */
  header: string
  /**
   * 发版日期
   *
   * 如果能解析到 yyyy-mm-dd 会填
   */
  date?: string
  /**
   * header 中的 link（如果有）
   */
  link?: string
  /** 原始 markdown 内容（不包含 header 行） */
  raw: string
  /** 使用 marked 渲染后的 HTML */
  html: string
}

export interface ParseOptions {
  /** 最多取多少个版本（从上往下），默认全部 */
  limit?: number
  /**
   * 是否把 header 之前的内容作为 intro（第一个 entry 的 raw 前缀）
   * @default false
   */
  includeIntro?: boolean
  /** 以哪个层级作为版本边界，默认 2 (##) */
  headingLevel?: number
}
