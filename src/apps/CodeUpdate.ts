import { CodeUpdate, getAllRedisKey } from '@CodeUpdate'
import { Loading } from '@/utils'
import common from '../../../../lib/common/common'
import { CodeUpdateRedisKey } from '@/constants'

export class Code extends plugin<'message'> {
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
        },
        {
          reg: /^#?DF清理无效数据$/i,
          fnc: 'clear',
          permission: 'master'
        }
      ]
    })
  }

  async check (e = this.e) {
    const push = e.msg.includes('推送')
    await e.reply(`正在${push ? '推送' : '检查'}仓库更新，请稍等`)
    const ret = await CodeUpdate(!push, e)
    if (ret === false) return false
    if (!push) {
      return e.reply(ret > 0
        ? `检查完成，共有${ret}个仓库有更新，正在按照你的配置进行推送哦~`
        : '检查完成，没有发现仓库有更新')
    }
  }

  async clear (e: typeof this.e & { redisInvalidKeys: string[] }) {
    if (Loading) return e.reply('❎ 请等待本地仓库载入完成哦~')
    const ConfigKeys = getAllRedisKey()
    const RedisKeys = await redis.keys(`${CodeUpdateRedisKey}:*`)

    const invalidKeys = RedisKeys.filter(i => !ConfigKeys.includes(i))
    const { length } = invalidKeys
    if (length > 0) {
      await e.reply(`⚠️ 本次需清理${length}个key, 如需清理请发送 #确认清理`)
      e.redisInvalidKeys = invalidKeys
      await e.reply(await common.makeForwardMsg(e, ['无效键名列表', ...invalidKeys]))
      this.setContext('startClear')
    } else {
      return e.reply('✅ 你的设备很干净，无需清理')
    }
  }

  async startClear (_: Parameters<typeof this.clear>[0]) {
    const e = this.e
    if (/^#?确认清理$/i.test(e.msg)) {
      const num = await redis.del(_.redisInvalidKeys)
      await e.reply(`✅ 成功清理${num}个无效数据`)
    } else {
      await e.reply('❎ 已取消')
    }
    this.finish('startClear')
  }
}
