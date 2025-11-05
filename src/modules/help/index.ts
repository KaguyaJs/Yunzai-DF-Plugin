import { Data } from '@/utils'
import { ResPath } from '@/dir'
import type { HelpConfig } from '@/types'

export async function getThemeData (styleConfig: HelpConfig) {
  const helpConfig = styleConfig || {}
  const colCount = Math.min(5, Math.max(helpConfig?.colCount || 3, 2))
  const colWidth = Math.min(500, Math.max(100, helpConfig?.colWidth || 265))
  const width = Math.min(2500, Math.max(800, colCount * colWidth + 30))
  const theme = {
    main: `${ResPath}/help/imgs/main.jpg`,
    bg: `${ResPath}/help/imgs/bg.jpg`,
    style: styleConfig.style
  }
  const themeStyle = theme.style || {}

  const ret = [
    `
    .container{background:url("${theme.main.replaceAll('\\', '/')}") center top / cover no-repeat;width:${width}px;}
    .help-table .td,.help-table .th{width:${100 / colCount}%}
    `
  ]

  const css = <T> (sel: string, cssProp: string, key: string, def: T, fn?: (val: T) => void) => {
    let val = Data.def((themeStyle as any)[key], (helpConfig as any)[key], def)
    if (fn) val = fn(val)
    ret.push(`${sel}{${cssProp}:${val}}`)
  }

  css('.help-title,.help-group', 'color', 'fontColor', '#ceb78b')
  css('.help-title,.help-group', 'text-shadow', 'fontShadow', 'none')
  css('.help-desc', 'color', 'descColor', '#eee')
  css('.cont-box', 'background', 'contBgColor', 'rgba(43, 52, 61, 0.8)')
  css('.cont-box', 'backdrop-filter', 'contBgBlur', 3, (n) => styleConfig.style?.bgBlur === false ? 'none' : `blur(${n}px)`)
  css('.help-group', 'background', 'headerBgColor', 'rgba(34, 41, 51, .4)')
  css('.help-table .tr:nth-child(odd)', 'background', 'rowBgColor1', 'rgba(34, 41, 51, .2)')
  css('.help-table .tr:nth-child(even)', 'background', 'rowBgColor2', 'rgba(34, 41, 51, .4)')

  return {
    style: `<style>${ret.join('\n')}</style>`,
    colCount
  }
}
