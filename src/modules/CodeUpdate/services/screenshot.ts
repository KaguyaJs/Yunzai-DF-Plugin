import { CommitInfo, ReleaseInfo } from '@/types'
import { screenshot } from '@/utils'
import { ImageElem } from 'trss-yunzai/icqq'
import config from '@/config'

/**
 * 截图渲染数据，根据配置达到某一数量时且不是配置 -1 则分片截图
 * @param content 获取到的数据
 * @param saveId 模板存储id
 * @returns 返回截图或false
 */
export async function generateScreenshot (content: (CommitInfo | ReleaseInfo)[], saveId: string): Promise<false | ImageElem | ImageElem[]> {
  return screenshot('CodeUpdate/index', {
    saveId,
    lifeData: content
  }, { send: false, scale: 2, multiPage: (content.length >= config.CodeUpdate.multiPage) && config.CodeUpdate.multiPage > -1 })
}
