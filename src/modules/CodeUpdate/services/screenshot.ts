import type { RepositoryInfo } from '@/types'
import { screenshot } from '@/utils'
import { ImageElem } from 'trss-yunzai/icqq'
import config from '@/config'
import { resolveCodeUpdateTheme } from '../utils/theme'

/**
 * 按所选主题渲染仓库更新；自动推送与手动汇总均按配置决定是否分片
 * @param content 获取到的数据
 * @param saveId 模板存储id
 * @returns 返回截图或false
 */
export async function generateScreenshot (content: RepositoryInfo[], saveId: string): Promise<false | ImageElem | ImageElem[]> {
  const theme = resolveCodeUpdateTheme(config.CodeUpdate.Theme)
  return screenshot(theme.name === 'classic' ? 'CodeUpdate/classic' : 'CodeUpdate/index', {
    saveId,
    lifeData: content,
    theme,
    renderInfo: {
      repositories: new Set(content.map(item => JSON.stringify([item.name.source.toLowerCase(), item.name.repo]))).size,
      updates: content.length
    }
  }, { send: false, scale: 2, multiPage: (content.length >= config.CodeUpdate.multiPage) && config.CodeUpdate.multiPage > -1 })
}
