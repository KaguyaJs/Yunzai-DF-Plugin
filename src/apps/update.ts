import { join } from 'node:path'
import { update as Update } from '../../../other/update.js'
import { Restart } from '../../../other/restart.js'
import PluginsLoader from '../../../../lib/plugins/loader.js'
import { FacePath, PluginName } from '@/dir'
import config from '@/config'
import Data from '@/utils/data'
import { CodeUpdateRedisKey, FaceRepoUrl } from '@/constants'
import { exec, Loading, logger } from '@/utils'
import { getAllRedisKey } from '@CodeUpdate'
import { stopPluginTasks, withMaintenance, withPluginTask } from '@/utils/lifecycle'
import { deletePluginRedis, formatBytes, inspectRedis, listPluginRedisKeys } from '@/modules/maintenance/redis'
import { deletePluginFiles, inspectGalleryFiles, inspectUninstallFiles } from '@/modules/maintenance/files'

let lock = false

type MaintenanceAction = 'invalid' | 'redis' | 'uninstall' | 'gallery' | 'galleryGit'
interface MaintenancePlan {
  action: MaintenanceAction
  scope: string
  expiresAt: number
  keys: string[]
}
type MaintenanceEvent = DFUpdate['e'] & { dfMaintenance?: MaintenancePlan }

const confirmations: Record<MaintenanceAction, string> = {
  invalid: '确认清理',
  redis: '确认清空Redis',
  uninstall: '确认卸载插件',
  gallery: '确认卸载图库',
  galleryGit: '确认精简图库'
}

function contextScope (e: DFUpdate['e']) {
  const chat = e.isGroup && 'group_id' in e && e.group_id ? `group:${e.group_id}` : 'private'
  return JSON.stringify([String(e.self_id ?? ''), String(e.user_id ?? ''), chat])
}

function redisUsageText (usage: Awaited<ReturnType<typeof inspectRedis>>) {
  const kind = usage.mode === 'memory' ? '内存占用' : '数据字节估算（非实际内存）'
  return `Redis：${usage.keys.length}个键，${kind} ${formatBytes(usage.bytes)}` +
    (usage.unknownKeys ? `，另有${usage.unknownKeys}个键无法测量大小` : '')
}

export class DFUpdate extends plugin<'message'> {
  constructor () {
    super({
      name: 'DF:插件维护',
      event: 'message',
      priority: 1000,
      rule: [
        {
          reg: /^#DF(插件)?(强制)?更新(日志)?$/i,
          fnc: 'update'
        },
        {
          reg: /^#?DF(安装|(强制)?更新)(戳一戳)?图库$/i,
          fnc: 'upImg'
        },
        {
          reg: /^#?DF(卸载|精简)(戳一戳)?图库$/i,
          fnc: 'removeImg',
          permission: 'master'
        },
        {
          reg: /^#?DF(?:Redis(?:统计|大小|占用)|数据统计)$/i,
          fnc: 'redisStats',
          permission: 'master'
        },
        {
          reg: /^#?DF清理无效数据$/i,
          fnc: 'clear',
          permission: 'master'
        },
        {
          reg: /^#?DF(?:清空|清除|清理)(?:所有|全部)?Redis(?:数据)?$/i,
          fnc: 'clearRedis',
          permission: 'master'
        },
        {
          reg: /^#?DF卸载(?:插件)?$/i,
          fnc: 'uninstall',
          permission: 'master'
        }
      ]
    })
  }

  async update (e = this.e) {
    const isLog = e.msg.includes('日志')
    if (!isLog && !e.isMaster) return false
    return withPluginTask(async () => {
      const Type = isLog ? '#更新日志' : (e.msg.includes('强制') ? '#强制更新' : '#更新')
      e.msg = Type + PluginName
      const up = new Update()
      up.e = e
      return await (isLog ? up.updateLog() : up.update())
    }, () => e.reply('DF插件正在维护，请稍后再试'))
  }

  async upImg (e = this.e) {
    if (!e.isMaster) return
    if (lock) return e.reply('已有图库任务正在进行中，请勿重复操作！')
    return withPluginTask(() => this.updateGallery(e), () => e.reply('DF插件正在维护，请稍后再试'))
  }

  private async updateGallery (e: typeof this.e) {
    lock = true
    try {
      let command = ''; let msg = ''; let type: 'update' | 'install'
      if (await Data.isDirectory(FacePath)) {
        if (!await Data.isDirectory(join(FacePath, '.git'))) {
          return e.reply('本地图库缺少 .git 文件夹，图片仍可正常使用。如需更新，请先发送 #DF卸载图库，再发送 #DF安装图库 重新安装。')
        }
        const isForce = e.msg.includes('强制')
        command = 'git pull --rebase'
        if (isForce) command = `git reset --hard origin/HEAD && ${command}`
        msg = `开始${isForce ? '强制' : ''}更新图库啦，请主人稍安勿躁~`
        type = 'update'
      } else {
        command = `git clone --depth=1 ${FaceRepoUrl} ${FacePath}`
        msg = '开始安装戳一戳图库,可能需要一段时间,请主人稍安勿躁~'
        type = 'install'
      }
      await e.reply(msg)
      await exec(command, type === 'update' ? FacePath : undefined)
        .then(async (stdout) => {
          if (type === 'update') {
            if (/Already up to date/.test(stdout) || stdout.includes('最新')) {
              await e.reply('目前所有图片都已经是最新了~')
            } else {
              const numRet = /(\d*) files changed,/.exec(stdout)
              if (numRet && numRet[1]) {
                await e.reply(`更新成功，共更新了${numRet[1]}张图片~`)
              } else {
                await e.reply('戳一戳图片资源更新完毕')
              }
            }
          } else {
            await e.reply('戳一戳图库安装成功！您后续也可以通过 #DF更新图库 命令来更新图片')
          }
        })
        .catch(error => {
          void e.reply(`图片资源${type === 'update' ? '更新' : '安装'}失败！\nError code: ${error?.code}\n${error?.stack}\n 请尝试${type === 'update' ? '使用 #DF强制更新图库 或' : ''}稍后重试。`)
        })
    } finally {
      lock = false
    }
  }

  async removeImg (e = this.e) {
    if (!e.isMaster) return false
    if (lock) return e.reply('已有图库任务正在进行中，请勿重复操作！')
    const isUninstall = e.msg.includes('卸载')
    const action = isUninstall ? '卸载' : '精简'
    try {
      const files = await inspectGalleryFiles(isUninstall)
      if (!await Data.isDirectory(isUninstall ? FacePath : join(FacePath, '.git'))) return e.reply(`没有可${action}的图库数据`)
      return await this.requestConfirmation(e, isUninstall ? 'gallery' : 'galleryGit',
        `即将${action}戳一戳图库，本地文件占用 ${formatBytes(files.bytes)}。\n${isUninstall ? '将删除本地图库，后续使用在线图片。' : '将删除图库的.git目录，保留全部图片；再次更新需重新安装图库。'}`)
    } catch (error) {
      logger.error('查询图库数据失败：', error)
      return e.reply(`查询图库数据失败，本次${action}已取消：${this.errorMessage(error)}`)
    }
  }

  /** 查看插件全部Redis记录的数量、占用与最大的几条记录。 */
  async redisStats (e = this.e) {
    if (!e.isMaster) return false
    try {
      const usage = await inspectRedis()
      const largest = [...usage.entries].sort((a, b) => b.bytes - a.bytes).slice(0, 5)
      return await e.reply([
        `${PluginName} 数据统计`,
        redisUsageText(usage),
        ...largest.map(entry => `${formatBytes(entry.bytes)}  ${entry.key}`),
        '提交待补发记录在对应接收者发送成功后清除；长期发送失败会产生积压。',
        '清理入口：#DF清理无效数据 / #DF清空Redis'
      ].join('\n'))
    } catch (error) {
      logger.error('统计插件Redis数据失败：', error)
      return e.reply(`统计失败：${this.errorMessage(error)}`)
    }
  }

  /** 保留原清理命令；只清除已不属于当前仓库订阅的记录。 */
  async clear (e = this.e) {
    if (!e.isMaster) return false
    if (Loading) return e.reply('请等待本地仓库载入完成后再清理')
    try {
      const active = new Set(await getAllRedisKey())
      const keys = (await listPluginRedisKeys()).filter(key => key.startsWith(`${CodeUpdateRedisKey}:`) && !active.has(key))
      const usage = await inspectRedis(keys)
      if (!usage.keys.length) return e.reply('没有需要清理的无效仓库数据')
      return await this.requestConfirmation(e, 'invalid',
        `待清理的无效仓库数据\n${redisUsageText(usage)}\n确认时会重新核对订阅，保留当前有效记录。`, usage.keys)
    } catch (error) {
      logger.error('查询无效仓库记录失败：', error)
      return e.reply(`查询失败，本次清理已取消：${this.errorMessage(error)}`)
    }
  }

  /** 清空本插件的Redis命名空间，先显示大小，再由上下文确认。 */
  async clearRedis (e = this.e) {
    if (!e.isMaster) return false
    try {
      const usage = await inspectRedis()
      if (!usage.keys.length) return e.reply('本插件没有可清除的Redis数据')
      return await this.requestConfirmation(e, 'redis',
        `即将清空本插件全部Redis数据\n${redisUsageText(usage)}\n将清除仓库推送进度、待补发内容、联系主人记录及配置迁移标记。订阅配置保留，下次检查会重新建立基线；未发送的积压消息将丢失。`)
    } catch (error) {
      logger.error('查询插件Redis数据失败：', error)
      return e.reply(`查询失败，本次清空已取消：${this.errorMessage(error)}`)
    }
  }

  /** 卸载预览不修改文件；确认后删除插件数据及目录，再调用框架重启。 */
  async uninstall (e = this.e) {
    if (!e.isMaster) return false
    try {
      const [usage, files] = await Promise.all([inspectRedis(), inspectUninstallFiles()])
      return await this.requestConfirmation(e, 'uninstall', [
        `即将卸载 ${PluginName}`,
        redisUsageText(usage),
        `本地文件占用 ${formatBytes(files.bytes)}`,
        ...files.targets.map(target => `${target.label}：${target.path}`),
        '将清除本插件的Redis数据、配置、缓存、图库及插件目录（含本地修改），完成后自动重启Yunzai。此操作不可恢复。'
      ].join('\n'))
    } catch (error) {
      logger.error('查询插件卸载数据失败：', error)
      return e.reply(`无法准备卸载，本次操作已取消：${this.errorMessage(error)}`)
    }
  }

  private async requestConfirmation (e: typeof this.e, action: MaintenanceAction, description: string, keys: string[] = []) {
    await e.reply(`${description}\n请在120秒内由本人在当前会话发送 #${confirmations[action]}，发送其他内容取消。大小为当前快照，执行前会重新统计。`)
    this.e = e
    const context = this.setContext('confirmMaintenance', false, 120) as MaintenanceEvent
    context.dfMaintenance = { action, scope: contextScope(e), expiresAt: Date.now() + 120_000, keys }
    return true
  }

  async confirmMaintenance (original: MaintenanceEvent) {
    const e = this.e
    const plan = original?.dfMaintenance
    if (!plan || plan.scope !== contextScope(e)) return false
    // 在首次等待前消费原上下文，防止并发确认重复执行删除。
    delete original.dfMaintenance
    this.finish('confirmMaintenance')
    if (!e.isMaster) return e.reply('仅主人可执行数据维护，本次操作已取消')
    if (Date.now() > plan.expiresAt) return e.reply('确认已超时，本次操作已取消')
    if (e.msg.trim().replace(/^#/, '').toLowerCase() !== confirmations[plan.action].toLowerCase()) return e.reply('已取消操作')

    let uninstallStarted = false
    let uninstalled = false
    let completedMessage: string | undefined
    try {
      return await withMaintenance(async () => {
        if (plan.action === 'invalid') {
          if (Loading) throw new Error('本地仓库正在载入，请完成后再清理')
          const active = new Set(await getAllRedisKey())
          const keys = plan.keys.filter(key => key.startsWith(`${CodeUpdateRedisKey}:`) && !active.has(key))
          const usage = await inspectRedis(keys)
          const count = await deletePluginRedis(usage.keys)
          completedMessage = `成功清理${count}个无效数据，清理前统计大小 ${formatBytes(usage.bytes)}`
          return e.reply(completedMessage)
        }
        if (plan.action === 'redis') {
          const usage = await inspectRedis()
          const count = await deletePluginRedis(usage.keys)
          const remaining = await listPluginRedisKeys()
          if (remaining.length) throw new Error(`已删除${count}个Redis键，但仍有${remaining.length}个插件键，请检查是否有其他运行实例正在写入`)
          completedMessage = `已清空本插件${count}个Redis键，清理前统计大小 ${formatBytes(usage.bytes)}。仓库推送将在下次检查时重新建立基线。`
          return e.reply(completedMessage)
        }
        if (plan.action === 'gallery' || plan.action === 'galleryGit') {
          const files = await inspectGalleryFiles(plan.action === 'gallery')
          await deletePluginFiles(files.targets)
          completedMessage = plan.action === 'gallery'
            ? `图库已卸载，清理前占用 ${formatBytes(files.bytes)}，后续使用在线图片。`
            : `图库精简完成，清理前占用 ${formatBytes(files.bytes)}，全部图片仍可正常使用。`
          return e.reply(completedMessage)
        }

        const [usage, files] = await Promise.all([inspectRedis(), inspectUninstallFiles()])
        await config.closeWatcher()
        stopPluginTasks()
        uninstallStarted = true
        await deletePluginRedis(usage.keys)
        if ((await listPluginRedisKeys()).length) throw new Error('仍有插件Redis记录，请检查其他运行实例后重试卸载')
        await deletePluginFiles(files.targets)
        uninstalled = true
        try {
          await PluginsLoader.unloadPlugin?.(PluginName, true)
        } catch (error) {
          logger.warn('撤销插件注册失败，继续通过重启完成卸载：', error)
        }
        try {
          await e.reply(`已卸载 ${PluginName}，清理${usage.keys.length}个Redis键和 ${formatBytes(files.bytes)} 本地文件，正在重启Yunzai。`)
        } catch (error) {
          logger.warn('卸载完成提示发送失败，继续重启：', error)
        }
        const restart = new Restart(e)
        await restart.restart()
        return true
      })
    } catch (error) {
      logger.error(completedMessage ? '插件数据维护结果通知失败：' : '插件数据维护失败：', error)
      if (completedMessage) return e.reply(completedMessage)
      return e.reply(uninstalled
        ? `插件已卸载，但自动重启失败：${this.errorMessage(error)}。请使用 #重启 完成重启。`
        : `操作失败：${this.errorMessage(error)}。${uninstallStarted ? '卸载尚未完成，插件任务已暂停，可重新发送 #DF卸载插件 重试。' : '请检查后重试。'}`)
    }
  }

  private errorMessage (error: unknown) {
    return error instanceof Error ? error.message : '未知错误，请查看控制台日志'
  }
}
