import Path from 'node:path'
import puppeteer from '../../../../lib/puppeteer/puppeteer'
import Data from './data'
import version from './version'
import config from '@/config'
import { YunzaiPath, PluginName, ResPath } from '@/dir'
import { CustomEvent, MessageRet } from 'trss-yunzai'

interface ScreenshotOptions {
  /**
   * 消息事件
   *
   * 需要直接发送时必传
   */
  e?: CustomEvent
  /**
   * 渲染精度初始值
   */
  scale?: number
  /**
   * 截图完成后是否直接发送
   */
  send?: boolean
  /**
   * 是否返回消息的返回值
   */
  retMsgId?: boolean
}

type Params = Omit<Parameters<typeof puppeteer['screenshot']>[1], 'tplFile'>

/**
 * 渲染HTML
 * @param path 文件路径
 * @param params 参数
 * @param cfg 配置
 * @param cfg.e 消息事件
 * @param cfg.scale 渲染精度
 * @param cfg.send 是否直接发送
 * @param cfg.retMsgId 是否返回消息id
 */
export async function screenshot (path: string, params: Params, cfg: ScreenshotOptions & { send: true, retMsgId: true }): Promise<MessageRet>
export async function screenshot (path: string, params: Params, cfg: ScreenshotOptions & { send: true, retMsgId?: false }): Promise<boolean>
export async function screenshot (path: string, params: Params, cfg?: ScreenshotOptions & { send?: false }): ReturnType<typeof puppeteer.screenshot>
export async function screenshot (path: string, params: Params, cfg: ScreenshotOptions = {}) {
  const [app, tpl] = path.split('/')
  const resPath = ResPath
  // const resPath = `../../../../../plugins/${PluginName}/resources`
  Data.createDir(`data/html/${PluginName}/${app}/${tpl}`, 'root')
  const data = {
    ...params,
    _plugin: PluginName,
    saveId: params.saveId || params.save_id || tpl,
    tplFile: Path.resolve(ResPath, app, tpl + '.html'),
    pluResPath: resPath,
    _res_path: resPath,
    pageGotoParams: {
      waitUntil: 'networkidle0'
    },
    sys: {
      scale: scale(cfg.scale || 1),
      copyright: `Created By ${version.yunzaiName}<span class="version">v${version.yunzaiVer}</span> & ${version.pluginName}<span class="version">v${version.pluginVer}</span>`
    },
    quality: 100
  }
  if (process.argv.includes('web-debug')) {
    // debug下保存当前页面的渲染数据，方便模板编写与调试
    // 由于只用于调试，开发者只关注自己当时开发的文件即可，暂不考虑app及plugin的命名冲突
    const saveDir = YunzaiPath + '/data/ViewData/'
    if (!await Data.exists(saveDir)) {
      Data.createDir(saveDir)
    }
    const file = saveDir + tpl + '.json'
    await Data.writeJSON(file, { ...data, _app: app })
  }
  const base64 = await puppeteer.screenshot(`${PluginName}/${app}/${tpl}`, data)

  if (cfg.send && base64 && cfg.e) {
    const ret = await cfg.e.reply(base64)
    return cfg.retMsgId ? ret : true
  }
  return base64
}

/**
 * 根据配置取得渲染精度
 * @param pct 渲染精度初始值
 * @returns 渲染精度值
 */
function scale (pct = 1) {
  let scale = config.other.renderScale
  scale = Math.min(2, Math.max(0.5, scale / 100))
  pct = pct * scale
  return `style='transform:scale(${pct})'`
}
