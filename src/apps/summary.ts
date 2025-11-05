import config from '@/config'
import { summary } from '@/modules'

if (config.summary.sum) summary.init(true)

export class Summary extends plugin<'message'> {
  constructor () {
    super({
      name: 'DF:图片外显',
      dsc: '为图片添加外显，需要协议支持',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#(?:开启|关闭)图片外显',
          fnc: 'on_off',
        }
      ]
    })
  }

  async on_off (e = this.e) {
    if (!e.isMaster) return false
    const type = e.msg.includes('开启')
    const { sum } = config.summary
    if ((type && sum) || (!type && !sum)) return e.reply(`❎ 图片外显已处于${type ? '开启' : '关闭'}状态`)
    await config.modify('summary', 'sum', type)
    summary.init(type)
    return e.reply(`✅ 已${type ? '开启' : '关闭'}图片外显`)
  }
}
