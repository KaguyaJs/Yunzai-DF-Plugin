import type { Config } from '@/types'

/** 仓库更新图片的内置主题；经典原版使用独立模板，其余名称对应 data-theme。 */
export const CODE_UPDATE_THEMES = [
  { name: 'classic', label: '经典原版', description: '保留主题改造前的原始深色布局' },
  { name: 'dark', label: '深空', description: '深色背景与冰蓝点缀' },
  { name: 'light', label: '晨光', description: '干净明亮的浅色卡片' },
  { name: 'ocean', label: '海盐蓝', description: '清透蓝色与海洋气息' },
  { name: 'forest', label: '松石绿', description: '柔和自然的绿色层次' },
  { name: 'sunset', label: '暖砂橙', description: '温暖的砂色与橙色点缀' },
  { name: 'lavender', label: '薰衣草', description: '轻盈柔和的紫色卡片' }
] as const satisfies readonly { name: Config['CodeUpdate']['Theme']['Name'], label: string, description: string }[]

const colorVariables = {
  Background: '--git-bg',
  Surface: '--git-surface',
  Text: '--git-text',
  Muted: '--git-muted',
  Accent: '--git-accent',
  Border: '--git-border'
} as const

function dimension (value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
}

/** 未配置或无效主题使用海盐蓝；新主题只输出校验后的颜色、尺寸变量。 */
export function resolveCodeUpdateTheme (value?: unknown) {
  const settings = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const name = typeof settings.Name === 'string' ? settings.Name.trim().toLowerCase() : 'ocean'
  const theme = CODE_UPDATE_THEMES.find(theme => theme.name === name) ?? CODE_UPDATE_THEMES.find(theme => theme.name === 'ocean')!
  // 切回原版时保留用户的新主题设置，但不将这些覆盖项应用到原始样式。
  if (theme.name === 'classic') return { ...theme, style: '' }
  const variables: string[] = []
  for (const [key, variable] of Object.entries(colorVariables)) {
    const color = settings[key]
    if (typeof color === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color.trim())) {
      variables.push(`${variable}:${color.trim().toLowerCase()}`)
    }
  }
  variables.push(`--git-width:${dimension(settings.Width, 640, 520, 1000)}px`)
  variables.push(`--git-radius:${dimension(settings.Radius, 16, 0, 28)}px`)
  return { ...theme, style: variables.join(';') }
}
