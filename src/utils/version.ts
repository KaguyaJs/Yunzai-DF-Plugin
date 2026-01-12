import Data from './data.js'

const yunzaiPackage = await Data.readJSON<{ name: string; version: string }>('package.json', 'yunzai')
const pluginPackage = await Data.readJSON<{ name: string; version: string }>('package.json', 'plugin')

const yunzaiVer: string = yunzaiPackage.version
const pluginVer: string = pluginPackage.version

let pluginName = pluginPackage.name

if (pluginName === 'df-plugin' || pluginName === 'yunzai-df-plugin') {
  pluginName = 'Yunzai-DF-Plugin'
}

let yunzaiName: string = 'Yunzai'
let isTRSS: boolean = false
let isMiao: boolean = false

if (Array.isArray(Bot.uin)) {
  yunzaiName = 'TRSS-Yunzai'
  isTRSS = true
} else if (yunzaiPackage.name === 'miao-yunzai') {
  yunzaiName = 'Miao-Yunzai'
  isMiao = true
} else {
  yunzaiName = yunzaiPackage.name
  throw new Error(`不支持的Yunzai版本: ${yunzaiName}`)
}

export default {
  yunzaiName,
  pluginName,
  yunzaiVer,
  pluginVer,
  get ver () {
    return pluginVer
  },
  isMiao,
  isTRSS,
  yunzaiPackage,
  pluginPackage
}
