import { CommitInfo, ReleaseInfo } from '@/types'
import { screenshot } from '@/utils'

export async function generateScreenshot (content: (CommitInfo | ReleaseInfo)[], saveId: string) {
  return screenshot('CodeUpdate/index', {
    saveId,
    lifeData: content
  }, { send: false, scale: 2 })
}
