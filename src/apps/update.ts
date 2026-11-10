import fs from 'node:fs/promises'
import { join } from 'node:path'
import { update as Update } from '../../../other/update.js'
import { FacePath, PluginName } from '@/dir'
import Data from '@/utils/data'
import { FaceRepoUrl } from '@/constants'
import { exec, logger } from '@/utils'

let lock = false

export class DFUpdate extends plugin<'message'> {
  constructor () {
    super({
      name: 'DF:更新插件',
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
        }
      ]
    })
  }

  async update (e = this.e) {
    const isLog = e.msg.includes('日志')
    const Type = isLog ? '#更新日志' : (e.msg.includes('强制') ? '#强制更新' : '#更新')
    e.msg = Type + PluginName
    const up = new Update()
    up.e = e
    return isLog ? up.updateLog() : up.update()
  }

  async upImg (e = this.e) {
    if (!e.isMaster) return
    if (lock) return e.reply('已有图库任务正在进行中，请勿重复操作！')
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
    if (!e.isMaster) return
    if (lock) return e.reply('已有图库任务正在进行中，请勿重复操作！')
    lock = true
    const isUninstall = e.msg.includes('卸载')
    const action = isUninstall ? '卸载' : '精简'
    try {
      if (!await Data.isDirectory(FacePath)) {
        return e.reply(`尚未安装戳一戳图库，无需${action}~`)
      }
      if ((await fs.lstat(FacePath)).isSymbolicLink()) {
        return e.reply('图库目录是符号链接，请手动处理，以免误删其他位置的文件。')
      }
      const target = isUninstall ? FacePath : join(FacePath, '.git')
      if (!isUninstall && !await Data.isDirectory(target)) {
        return e.reply('图库中没有 .git 文件夹，无需精简，图片仍可正常使用~')
      }
      await e.reply(`开始${action}戳一戳图库，请主人稍安勿躁~`)
      await fs.rm(target, { recursive: true, force: true, maxRetries: 3 })
      return e.reply(isUninstall
        ? '戳一戳图库已卸载，将使用在线图片。需要时可发送 #DF安装图库 重新安装。'
        : '图库精简完成，已删除 .git 文件夹，图片仍可正常使用。如需更新，请先发送 #DF卸载图库，再发送 #DF安装图库 重新安装。')
    } catch (error) {
      logger.error(`${action}图库失败：`, error)
      return e.reply(`${action}图库失败，请检查文件权限或稍后重试。`)
    } finally {
      lock = false
    }
  }
}
