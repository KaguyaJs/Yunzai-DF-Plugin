import YAML from 'yaml'
import cfg from '../../../../lib/config/config.js'
import makeConfig from '../../../../lib/plugins/config.js'
import path from 'node:path'
import fs from 'node:fs/promises'
import { PluginName, ResPath } from '@/dir'
import type { Config as config } from '@/types'

class Config {
  plugin_name = PluginName
  config: config & Record<string, any> = {} as config
  configSave: () => Promise<void> = async () => { }

  /** 初始化配置 */
  async initCfg () {
    this.config = YAML.parse(await fs.readFile(path.join(ResPath, 'config', 'config.yaml'), 'utf8'))

    /** 保留注释 */
    const keep: Record<string, Record<string, any>> = {}
    for (const i in this.config) {
      keep[i] = {}
      for (const j in this.config[i]) {
        if (j.endsWith('Tips')) {
          keep[i][j] = this.config[i][j]
        }
      }
    }

    // FIXME 启动时将配置的commit转成commits
    const { config, configSave } = await makeConfig(this.plugin_name, this.config, keep, {
      replacer: (i: any) => i.replace(/(\n.+?Tips:)/g, '\n$1')
    })
    this.config = config
    this.configSave = configSave

    return this
  }

  /** 主人列表 */
  get masterQQ () {
    return cfg.masterQQ
  }

  /** TRSS的主人列表 */
  get master () {
    return cfg.master
  }

  get AutoPath () {
    return this.config.CodeUpdate.List.some(i => !!i?.AutoPath)
  }

  /** 联系主人 */
  get sendMaster () {
    return this.config.sendMaster
  }

  /** 戳一戳配置 */
  get Poke () {
    return this.config.Poke
  }

  /** 其他配置 */
  get other () {
    return this.config.other
  }

  /** Git推送 */
  get CodeUpdate () {
    return this.config.CodeUpdate
  }

  /** 图片外显 */
  get summary () {
    return this.config.summary
  }

  /** 随机图片配置 */
  get Picture () {
    return this.config.Picture
  }

  /** 代理配置 */
  get proxy () {
    return this.config.proxy
  }

  /**
   * 群配置
   * @param groupId 群号
   * @param botId 机器人账号
   */
  getGroup (groupId: string = '', botId: string = '') {
    return Array.isArray(Bot.uin) ? cfg.getGroup(botId, groupId) : cfg.getGroup(groupId)
  }

  /**
   * 修改设置
   * @param name 配置名
   * @param key 修改的key值
   * @param value 修改的value值
   */
  modify (name: string, key: string, value: unknown) {
    if (typeof this.config[name] !== 'object') { this.config[name] = {} }
    this.config[name][key] = value
    return this.configSave()
  }

  /**
   * 修改配置数组
   * @param name 文件名
   * @param key key值
   * @param value value
   * @param category 类别 add or del
   */
  modifyarr (name: string, key: string | number, value: unknown, category: 'add' | 'del' = 'add') {
    if (typeof this.config[name] !== 'object') this.config[name] = {}
    if (!Array.isArray(this.config[name][key])) this.config[name][key] = []
    if (category === 'add') {
      if (!this.config[name][key].includes(value)) this.config[name][key].push(value)
    } else {
      this.config[name][key] = this.config[name][key].filter((item: any) => item !== value)
    }
    return this.configSave()
  }
}

export default await new Config().initCfg()
