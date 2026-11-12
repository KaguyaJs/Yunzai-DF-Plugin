import { ResPath } from '@/dir'
import { GuobaType } from '@/types/guoba'
import * as schemas from './schemas'
import Config from '@/config'
import { withPluginTask } from '@/utils/lifecycle'

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
      async setConfigData (data, { Result }) {
        return withPluginTask(async () => {
          for (const k in data) {
            const [name, ...keys] = k.split('.')
            await Config.modify(name, keys.join('.'), data[k])
          }
          return Result.ok({}, 'Ciallo～(∠・ω< )⌒☆')
        }, () => { throw new Error('DF插件正在维护，请稍后再保存配置') })
      },
    }
  }
}
