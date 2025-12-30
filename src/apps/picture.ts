import config from '@/config'
import { apiHandlers, FacePoke } from '@/modules'
import { FaceList, FaceAliasIndex, FaceNames } from '@/data'

const apiRegList = apiHandlers.map(i => `(?:${i.reg instanceof RegExp ? i.reg.source : i.reg})$`)
// Api表情正则
const apiPictureRegx = new RegExp(`^#?(?:来张|看看|随机)(${apiRegList.join('|')})`, 'i')
// DF表情正则
const facePictureRegx = new RegExp(`^#?(?:来张|看看|随机)(${FaceNames.map(i => `(?:${i})`).join('|')})$`, 'i')

export class RandomPictures extends plugin<'message'> {
  constructor () {
    super({
      name: 'DF:随机图片',
      dsc: '随机图片小功能',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: apiPictureRegx,
          fnc: 'apiPicture',
        },
        {
          reg: facePictureRegx,
          fnc: 'facePicture',
        },
        {
          reg: /^#?DF(?:随机)?(?:表情|图片)列表$/i,
          fnc: 'pictureList'
        }
      ]
    })
  }

  async apiPicture (e = this.e) {
    if (!(config.Picture.open && config.Picture.apiPicture)) {
      logger.mark('随机api图片已禁用')
      return false
    }
    const type = apiPictureRegx.exec(e.msg)?.[1]?.toLowerCase()
    if (!type) return false
    const { fnc, name } = apiHandlers.find(i => (i.reg instanceof RegExp ? i.reg : new RegExp(i.reg, 'i')).test(type)) ?? {}
    if (!fnc) return false
    if (name && config.Picture.apiDisable.includes(name)) {
      logger.mark(`随机图片 ${name} 已被禁用`)
      return false
    }
    const msg = await fnc()
    if (!msg) return false
    await e.reply(msg, true)
    return true
  }

  async facePicture (e = this.e) {
    if (!(config.Picture.open && config.Picture.facePicture)) {
      logger.mark('随机表情已禁用')
      return false
    }
    const type = facePictureRegx.exec(e.msg)?.[1]
    if (!type) return false
    const name = FaceList.includes(type) ? type : FaceAliasIndex[type] ?? ''
    if (!name) return false
    if (config.Picture.faceDisable.includes(name)) {
      logger.mark(`随机表情 ${name} 已禁用`)
      return false
    }
    await e.reply(segment.image(await FacePoke(name)), true)
    return true
  }

  pictureList (e = this.e) {
    return e.reply(
      `支持的表情:\n\n${[
        ...apiRegList,
        ...FaceNames
      ].join('、')
      }\n\n使用 #来张 + 表情名称 使用`,
      true
    )
  }
}
