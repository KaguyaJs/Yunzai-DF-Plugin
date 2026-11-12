import { CodeUpdate } from '@CodeUpdate'
import config from '@/config'

export class GitRepoUpdate extends plugin<'message'> {
  constructor () {
    super({
      name: 'DF:Git仓库更新推送',
      dsc: '监听Git仓库更新并推送至群或私聊',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#?(检查|推送)仓库更新$',
          fnc: 'check',
          permission: 'master'
        }
      ]
    })

    if (config.CodeUpdate.Auto) {
      this.task = {
        name: 'DF:Git仓库更新检查',
        cron: config.CodeUpdate.Cron,
        fnc: async () => {
          await CodeUpdate(true)
        }
      }
    }
  }

  async check (e = this.e) {
    const push = e.msg.includes('推送')
    const ret = await CodeUpdate(!push, e)
    if (ret === false) return false
    if (!push) {
      return e.reply(ret > 0
        ? `检查完成，共有${ret}个仓库有更新，正在按照你的配置进行推送哦~`
        : '检查完成，没有发现仓库有更新')
    }
  }
}
