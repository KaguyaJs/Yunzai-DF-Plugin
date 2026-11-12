import YAML from 'yaml'
import cfg from '../../../../lib/config/config.js'
import makeConfig from '../../../../lib/plugins/config.js'
import path from 'node:path'
import fs from 'node:fs/promises'
import { PluginName, ResPath } from '@/dir'
import type { Config as config } from '@/types'
import { migrateCodeUpdateConfig } from './codeUpdateMigration'
import { withPluginTask } from '@/utils/lifecycle'

interface ConfigWatcher {
  close: () => Promise<unknown> | void
}

function configUnavailable (): never {
  throw new Error('DF插件正在维护，暂时无法保存配置')
}

class Config {
  plugin_name = PluginName
  config: config & Record<string, any> = {} as config
  configSave: () => Promise<void> = async () => { }
  private configWatcher?: ConfigWatcher

  /** 初始化配置 */
  async initCfg () {
    this.config = YAML.parse(await fs.readFile(path.join(ResPath, 'config', 'default_config.yaml'), 'utf8'))

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

    const managed = await makeConfig(this.plugin_name, this.config, keep, {
      replacer: (i: any) => i.replace(/(\n.+?Tips:)/g, '\n$1')
    })
    const { config, configSave } = managed
    this.config = config
    this.configWatcher = (managed as typeof managed & { watcher?: ConfigWatcher }).watcher
    this.configSave = () => withPluginTask(async () => { await configSave() }, configUnavailable)

    try {
      const migrated = await migrateCodeUpdateConfig(this.config.CodeUpdate, this.configSave, {
        get: key => redis.get(key),
        set: (key, value) => redis.set(key, value),
        copy: (key, value) => redis.set(key, value, { NX: true })
      })
      if (migrated) logger.mark('[DF] 仓库监听配置迁移完成')
    } catch (error) {
      logger.error('[DF] 仓库监听配置迁移未完成，下次启动将重试；本次继续兼容旧配置', error)
    }

    return this
  }

  /** 卸载前关闭配置监听；正在进行的配置保存由维护锁等待完成。 */
  async closeWatcher () {
    await this.configWatcher?.close()
    this.configWatcher = undefined
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
    return withPluginTask(async () => {
      const keys = [name, ...key.split('.')]
      // 拒绝可修改原型链的路径。
      if (keys.some(key => !key || ['__proto__', 'prototype', 'constructor'].includes(key))) {
        throw new Error('无效的配置路径')
      }
      let target = this.config
      for (const part of keys.slice(0, -1)) {
        if (!target[part] || typeof target[part] !== 'object') target[part] = {}
        target = target[part]
      }
      target[keys[keys.length - 1]] = value
      return this.configSave()
    }, configUnavailable)
  }

  /**
   * 修改配置数组
   * @param name 文件名
   * @param key key值
   * @param value value
   * @param category 类别 add or del
   */
  modifyarr (name: string, key: string | number, value: unknown, category: 'add' | 'del' = 'add') {
    return withPluginTask(async () => {
      if (typeof this.config[name] !== 'object') this.config[name] = {}
      if (!Array.isArray(this.config[name][key])) this.config[name][key] = []
      if (category === 'add') {
        if (!this.config[name][key].includes(value)) this.config[name][key].push(value)
      } else {
        this.config[name][key] = this.config[name][key].filter((item: any) => item !== value)
      }
      return this.configSave()
    }, configUnavailable)
  }
}

export default await new Config().initCfg()
