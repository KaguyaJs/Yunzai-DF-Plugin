import config from '@/config'
import { logger, request } from '@/utils'
import _ from 'lodash'
import type { segment } from 'trss-yunzai/segment'

let rawFnc: (...args: any[]) => ReturnType<segment['image']>
let SummaryText: string
let lock = false
let status: 'on' | 'off' = 'off'

export default new class {
  init (v: boolean) {
    if (v && status === 'off') {
      status = 'on'
      rawFnc = segment.image
      SummaryText = this.getSummaryText('ciallo')
      if (config.summary.type === 2) this.getSummaryText(config.summary.type)
      segment.image = ((...args: any[]) => {
        const imgseg = rawFnc(...args)
        imgseg.summary ??= this.getSummaryText(config.summary.type)
        return imgseg
      }) as any
    } else {
      if (typeof rawFnc === 'function' && status === 'on') {
        status = 'off'
        segment.image = rawFnc as any
      }
    }
  }

  /**
   * 返回图片外显文本
   * @param mode 模式选择
   * @returns 外显文本
   */
  getSummaryText (mode: 1 | 2 | 3 | 'ciallo'): string {
    switch (mode) {
      case 1:
        return config.summary.text
      case 2: {
        const data = SummaryText
        void this.upHitokotoText()
        return data
      }
      case 3:
        return _.sample(config.summary.list) ?? this.getSummaryText('ciallo')
      case 'ciallo':
      default:
        return 'Ciallo ~ (∠・ω< )⌒★'
    }
  }

  /**
   * 更新一言
   */
  async upHitokotoText () {
    if (lock) return
    lock = true
    try {
      const data = await request.get(config.summary.api,
        'text',
        { log: false })
      if (!data) {
        logger.debug('一言外显更新失败')
        return
      }
      SummaryText = data
    } catch (error) {
      logger.error(`获取一言接口时发生错误：${error}`)
    } finally {
      lock = false
    }
  }
}()
