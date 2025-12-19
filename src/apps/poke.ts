import Config from '@/config'
import _ from 'lodash'
import { Data, logger } from '@/utils'
import { FaceList, } from '@/data'
import { FacePoke } from '@/modules'

export class Poke extends plugin<'notice.*.poke'> {
  constructor () {
    super({
      name: 'DF:戳一戳',
      dsc: '戳一戳回复内容',
      event: 'notice.*.poke',
      priority: -114,
      rule: [{ fnc: 'poke', log: false }]
    })
  }

  private LogText = `${Array.isArray(Bot.uin) ? logger.blue('[ DF-Plugin ]') : ''}${logger.green('[戳一戳]')}`

  async poke () {
    let { chuo, mode } = Config.Poke
    if (!chuo) return false
    if (this.e.target_id !== this.e.self_id) return false
    if (mode === 'random') {
      mode = _.sample(['image', 'text', 'mix'])
      logger.debug(`${this.LogText} 随机选择 ${mode}`)
    }
    switch (mode) {
      case 'image': {
        logger.info(`${this.LogText} 图片模式`)
        const img = await this.Image()
        return img ? this.e.reply(img) : false
      }
      case 'text': {
        logger.info(`${this.LogText} 文本模式`)
        const text = this.Text()
        return text ? this.e.reply(text) : false
      }
      case 'mix': {
        logger.info(`${this.LogText} 混合模式`)
        const msg = []; const img = await this.Image(); const txt = this.Text()
        if (txt) msg.push(txt)
        if (img) msg.push(img)
        return _.isEmpty(msg) ? false : this.e.reply(msg)
      }
      default:
        logger.warn('不支持的戳一戳模式: ', mode)
        return false
    }
  }

  /**
   * 图片消息获取逻辑
   * @returns 图片消息段或nul
   */
  private async Image (): Promise<ReturnType<typeof segment['image']> | null> {
    const { imageType, imageBlack } = Config.Poke
    let name: string | undefined
    if (imageType === 'all') {
      let List: string[] = FaceList
      if (Array.isArray(imageBlack) && imageBlack.length > 0) {
        List = FaceList.filter(i => !imageBlack.includes(i))
      }
      name = _.sample(List)
      logger.mark(`${this.LogText} 表情随机选择 ${name}`)
    } else {
      name = FaceList[imageType]
    }
    if (!name) {
      logger.warn(`${this.LogText} 获取表情包属性失败`)
      return null
    }
    logger.debug(`${this.LogText} 获取 ${name} 图片`)
    const file = await FacePoke(name)
    if (!file) {
      logger.warn(`${this.LogText} 获取戳一戳图片失败，返回为空`)
      return null
    }
    return segment.image(file)
  }

  /**
   * 获取戳一戳文本
   * @returns 文本或Null
   */
  private Text (): string | null {
    const { textMode, textList } = Config.Poke
    if (textMode === 'hitokoto') {
      const data = Data.getJSON<Array<string>>('json/PokeText.json', 'res', true)
      if (!(Array.isArray(data) && data.length > 0)) {
        logger.warn(`${this.LogText} 获取一言文字失败，返回内容为空`)
        return null
      }
      const text = _.sample(data)
      logger.debug(`${this.LogText} 获取一言文字:`, text)
      return text || null
    } else if (textMode === 'list') {
      if (!(Array.isArray(textList) && textList.length > 0)) {
        logger.warn(`${this.LogText} 获取自定义戳一戳文本失败，返回为空`)
        return null
      }
      const text = _.sample(textList)
      logger.debug(`${this.LogText} 获取自定义文本:`, text)
      return text || null
    }
    return null
  }
}
