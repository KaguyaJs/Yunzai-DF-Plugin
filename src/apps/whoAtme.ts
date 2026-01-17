import config from '@/config'
import type { MessageElem } from 'trss-yunzai/icqq'
import {
  getSourceMessage,
  isExpired
} from '@/utils'
// import common from '../../../../lib/common/common'

interface MessageDataType {
  user_id: number | string
  nickname: string
  time: number
  message: MessageElem[]
}

type RedisDataType = MessageDataType[]

/** Redis Key 前缀 */
const REDIS_KEY = 'DF:whoAtme'

export class whoAtme extends plugin<'message.group'> {
  constructor () {
    super({
      name: 'DF:谁艾特我',
      dsc: '谁艾特我',
      event: 'message.group',
      priority: 5000,
      rule: [
        {
          reg: /^#?(?:谁|哪个叼毛)(?:艾特|at|@)我$/i,
          fnc: 'who',
        }
      ]
    })
  }

  async accept (e = this.e) {
    if (!config.whoAtme.enable) return false
    const qqList = Array.from(new Set(e.message.filter(i => i.type === 'at').map(i => i.qq)))
    if (!qqList.length) return false
    const message = e.message.filter(i => i.type !== 'long_msg')
    const reply = await getSourceMessage(e)
    if (reply && reply.message_id) {
      message.unshift(segment.reply(reply.message_id))
      const index = message.findIndex(i => i.type === 'at' && i.qq === reply.sender.user_id)
      if (index !== -1) message.splice(index, 1)
    }
    const MessageInfo: MessageDataType = {
      user_id: e.user_id,
      nickname: e.sender.nickname,
      time: e.time,
      message
    }
    const { expireTime } = config.whoAtme

    const set = async (id: string | number) => {
      const key = `${REDIS_KEY}:${e.group_id}:${id}`
      const redisData = await redis.get(key)
      if (redisData) {
        const data = JSON.parse(redisData) as RedisDataType
        // 删除过期的消息
        data.forEach((v, index) => {
          if (isExpired(v.time, expireTime)) data.splice(index, 1)
        })
        data.push(MessageInfo)
        await redis.set(key, JSON.stringify(data), { EX: expireTime })
      } else {
        await redis.set(key, JSON.stringify([MessageInfo]), { EX: expireTime })
      }
    }

    const tasks = []
    for (const qq of qqList) {
      if (qq === 'all') {
        if (!config.whoAtme.atAll) continue
        const memberMap = await e.group.getMemberMap()
        Array.from(memberMap.keys())
          .filter(id => !qqList.includes(id))
          .forEach(mid => tasks.push(set(mid)))
      } else {
        tasks.push(set(qq))
      }
    }

    await Promise.all(tasks)
    return false
  }

  async who (e = this.e) {
    if (!config.whoAtme.enable) return false
    const key = `${REDIS_KEY}:${e.group_id}:${e.user_id}`
    const res = await redis.get(key)
    if (!res) return this.reply('还没有人艾特你哦')
    const data = JSON.parse(res) as RedisDataType
    if (!data?.length) return this.reply('没有，嘿嘿')
    let msg
    const member = e.member as typeof e.member & { raw: typeof e.member }
    if (!data.some(i => i.message.some(o => o.type === 'image' || o.type === 'video'))) {
      if (member.raw.makeForwardMsg) {
        msg = await member.raw.makeForwardMsg(data)
      } else if (member.makeForwardMsg) {
        msg = await member.makeForwardMsg(data)
      } else {
        msg = Bot.makeForwardMsg(data)
      }
    } else {
      msg = Bot.makeForwardMsg(data)
    }
    return e.reply(msg)
  }
}
