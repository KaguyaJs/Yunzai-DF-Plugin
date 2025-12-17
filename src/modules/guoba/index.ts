import { ResPath } from '@/dir'
import { GuobaType } from '@/types/guoba'
import * as schemas from './schemas'
import Config from '@/config'

export function supportGuoba (): GuobaType {
  return {
    pluginInfo: {
      name: 'Yunzai-DF-Plugin',
      title: 'Yunzai-DF-Plugin',
      link: 'https://github.com/KaguyaJs/Yunzai-DF-Plugin',
      description: '提供戳一戳、图片外显等功能。',
      author: ['@DenFenglai', '@KaguyaJs'],
      authorLink: ['https://github.com/DenFengLai', 'https://github.com/KaguyaJs'],
      isV3: true,
      isV2: false,
      showInMenu: 'auto',
      iconPath: `${ResPath}/img/icon.png`
    },
    configInfo: {
      // 手动合并以保证顺序
      schemas: [
        schemas.sendMaster,
        schemas.CodeUpdate,
        schemas.Poke,
        schemas.summary,
        schemas.Picture,
        schemas.proxy,
        schemas.other
      ].flat(),
      getConfigData () {
        return Config.config
      },
      setConfigData (data, { Result }) {
        for (const k in data) {
          const [name, key] = k.split('.')
          void Config.modify(name, key, data[k])
        }
        return Result.ok({}, 'Ciallo～(∠・ω< )⌒☆')
      },
    }
  }
}
