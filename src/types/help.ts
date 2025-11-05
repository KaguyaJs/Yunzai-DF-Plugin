interface List {
  /** 图标id */
  icon: number
  /** 标题 */
  title: string
  /** 描述 */
  desc: string
  css?: string
}

export type HelpListType = {
  /** 分组名称 */
  group: string
  /** 是否仅主人展示 */
  // 暂时只支持了matser
  auth?: 'master'
  list: List[]
}[]

export interface HelpStyle {
  /** 主文字颜色 */
  fontColor: string
  /** 描述文字颜色 */
  descColor: string
  /**
   * 主文字阴影：横向距离 垂直距离 阴影大小 阴影颜色
   *
   * @example
   * fontShadow: '0px 0px 1px rgba(6, 21, 31,.9),
   * fontShadow: '0.5px 0.5px 8px rgba(0, 0, 0,1)',
  */
  fontShadow: string
  /**
   * 面板整体底色，会叠加在标题栏及帮助行之下，方便整体帮助有一个基础底色
   *
   * 若无需此项可将rgba最后一位置为0即为完全透明
   *
   * 注意若综合透明度较低，或颜色与主文字颜色过近或太透明可能导致阅读困难
  */
  contBgColor: string
  /** 面板底图毛玻璃效果，数字越大越模糊，0-10 ，可为小数 */
  contBgBlur: number
  /**
   * 是否启用背景模糊
   *
   * @default true
   */
  bgBlur?: boolean
  /** 板块标题栏底色 */
  headerBgColor: string
  /** 帮助奇数行底色 */
  rowBgColor1: string
  /** 帮助偶数行底色 */
  rowBgColor2: string
}

export interface HelpConfig {
  /** 标题 */
  title: string
  /** 副标题 */
  subTitle: string
  // columnCount: number
  /** 列数 */
  colCount: number
  /** 宽度 */
  colWidth: number
  style: HelpStyle
}
