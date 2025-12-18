import Config from '@/config'
import _ from 'lodash'
import { Data, logger } from '@/utils'
import { FaceList, } from '@/data'
import { FacePoke } from '@/modules'

export class Poke extends plugin<'notice.group.poke'> {
  constructor () {
    super({
      name: 'DF:戳一戳',
      dsc: '戳一戳回复内容',
      // @ts-ignore
      event: 'notice.*.poke',
      priority: -114,
      rule: [{ fnc: 'poke', reg: '', log: false }]
    })
  }

  async poke () {
    let { chuo, mode } = Config.Poke
    if (!chuo) return false
    if (this.e.target_id !== this.e.self_id) return false
    if (mode === 'random') {
      mode = _.sample(['image', 'text', 'mix'])
      logger.debug(`${logger.blue('[ DF-Plugin ]')}${logger.green('[戳一戳]')} 随机选择 ${mode}`)
    }
    switch (mode) {
      case 'image' : {
        logger.info(`${logger.blue('[ DF-Plugin ]')}${logger.green('[戳一戳]')} 图片模式`)
        const img = await this.Image()
        return img ? this.e.reply(img) : false
      }
      case 'text': {
        logger.info(`${logger.blue('[ DF-Plugin ]')}${logger.green('[戳一戳]')} 文本模式`)
        const text = this.Text()
        return text ? this.e.reply(text) : false
      }
      case 'mix': {
        logger.info(`${logger.blue('[ DF-Plugin ]')}${logger.green('[戳一戳]')} 混合模式`)
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

  private async Image (): Promise<ReturnType<typeof segment['image']> | null> {
    const { imageType, imageBlack } = Config.Poke
    let name: string | undefined
    if (imageType !== 'all') {
      name = FaceList[imageType]
    } else {
      let List: string[] = FaceList
      if (Array.isArray(imageBlack) && imageBlack.length > 0) {
        List = FaceList.filter(i => !imageBlack.includes(i))
      }
      name = _.sample(List)
      logger.debug(`${logger.blue('[ DF-Plugin ]')}${logger.green('[戳一戳]')} 表情随机选择 ${name}`)
    }
    if (!name) {
      logger.warn(`${logger.blue('[ DF-Plugin ]')}${logger.green('[戳一戳]')} 获取表情包属性失败`)
      return null
    }
    logger.debug(`${logger.blue('[ DF-Plugin ]')}${logger.green('[戳一戳]')} 获取 ${name} 图片`)
    const file = await FacePoke(name)
    if (!file) return null
    return segment.image(file)
  }

  private Text (): string | null {
    const { textMode, textList } = Config.Poke
    if (textMode === 'hitokoto') {
      const data = Data.getJSON<Array<string>>('json/PokeText.json', 'res')
      if (data && Array.isArray(data) && data.length > 0) {
        const text = _.sample(data)
        logger.debug(`${logger.blue('[ DF-Plugin ]')}${logger.green('[戳一戳]')} 获取一言文字:`, text)
        return text || null
      }
    } else if (textMode === 'list') {
      if (_.isEmpty(textList)) return null
      const text = _.sample(textList)
      logger.debug(`${logger.blue('[ DF-Plugin ]')}${logger.green('[戳一戳]')} 获取自定义文本:`, text)
      return text || null
    }
    return null
  }
}
