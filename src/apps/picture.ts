import config from '@/config'
import { apiHandlers, FacePoke } from '@/modules'
import { FaceAlias, FaceList, FaceAliasIndex } from '@/data'

const apiPictureRegx = new RegExp(`^#?(?:来张|看看|随机)(${apiHandlers.map(i => `(?:${i.reg instanceof RegExp ? i.reg.source : i.reg})$`).join('|')})`, 'i')
const facePictureRegx = new RegExp(`^#?(?:来张|看看|随机)(${Object.entries(FaceAlias).flatMap(([key, arr]) => [key, ...arr]).map(i => `(?:${i})`).join('|')})$`, 'i')

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
        }
      ]
    })
  }

  async apiPicture (e = this.e) {
    if (!config.Picture.open) return false
    const type = apiPictureRegx.exec(e.msg)?.[1]?.toLowerCase()
    if (!type) return false
    const apiFnc = (apiHandlers.find(i => (i.reg instanceof RegExp ? i.reg : new RegExp(i.reg, 'i')).test(type)))?.fnc
    if (!apiFnc) return false
    const msg = await apiFnc()
    if (!msg) return false
    await e.reply(msg)
    return true
  }

  async facePicture (e = this.e) {
    if (!config.Picture.open) return false
    const type = facePictureRegx.exec(e.msg)?.[1]
    if (!type) return false
    const name = FaceList.includes(type) ? type : FaceAliasIndex[type] ?? ''
    if (!name) return false
    await e.reply(segment.image(await FacePoke(name)))
    return true
  }
}
