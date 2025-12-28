import { update as Update } from '../../../other/update.js'
import { FacePath, PluginName } from '@/dir'
import Data from '@/utils/data'
import { FaceRepoUrl } from '@/constants'
import { exec } from '@/utils'

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
    if (lock) return e.reply('已有更新任务正在进行中，请勿重复操作！')
    lock = true
    try {
      let command = ''; let msg = ''; let type: 'update' | 'install'
      if (await Data.isDirectory(FacePath)) {
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
}
