import Config from '@/config'
import * as utils from '@/utils'
import { ulid } from 'ulid'
import { FacePoke } from '@/modules'
import moment from 'moment'
import { icqq } from 'trss-yunzai'
import { sendMasterRedisKey } from '@/constants'

/** 是否在发送中 */
let Sending = false
/** Redis key */
const REDISKEY = sendMasterRedisKey
const REPLYREG = /^#?回复(\S+)?\s?(.*)?$/

interface RedisDataType {
  bot: string | number
  gid: string | number | null
  uid: string | number
  mid: string
}

export class sendMasterMsg extends plugin {
  constructor () {
    super({
      name: 'DF:联系主人',
      dsc: '给主人带话',
      event: 'message',
      priority: 400,
      rule: [
        {
          reg: '^#?联系主人',
          fnc: 'sendMaster',
        },
        {
          reg: REPLYREG,
          fnc: 'Replys',
          event: 'message.private'
        }
      ]
    })
  }

  async sendMaster (e = this.e) {
    if (Sending) return e.reply('❎ 已有发送任务正在进行中，请等待上一条完成后重试')
    const { open, cd, BotId, banWords, banUser, banGroup, MsgTemplate, successMsgTemplate, failsMsgTemplate, Master } = Config.sendMaster
    const REDISCDKEY = `${REDISKEY}:cd`
    if (!e.isMaster) {
      if (!open) return e.reply('❎ 该功能暂未开启，请先让主人开启才能用哦', true)
      if (cd !== 0 && await redis.get(REDISCDKEY)) return e.reply('❎ 操作频繁，请稍后再试', true)
      if (banWords.some(item => e.msg.includes(item))) return e.reply('❎ 消息包含违禁词，请检查后重试', true)
      if (banUser.includes(e.user_id)) return e.reply('❎ 对不起，您不可用', true)
      if (e.isGroup && banGroup.includes(e.group_id)) return e.reply('❎ 该群暂不可用该功能', true)
    }

    Sending = true

    try {
      const message = utils.ReplaceMessage(e, /#联系主人/)
      if (message.length === 0) return e.reply('❎ 消息不能为空')
      const msgId = ulid().slice(-5)
      const data = {
        platform: e.bot?.version?.id || e.adapter_id || '未知',
        avatar: segment.image((e.isGroup ? e.member.getAvatarUrl() : e.friend?.getAvatarUrl?.()) || await FacePoke('all')),
        user: `${e.sender.nickname}(${e.user_id})`,
        group: e.isGroup ? `${e.group.name || '未知群名'}(${e.group_id})` : '私聊',
        bot: `${e.bot.nickname}(${e.bot.uin})`,
        time: moment().format('YYYY-MM-DD HH:mm:ss'),
        key: `联系主人消息(${msgId})`,
        msg: message as any
      }
      const msg = utils.parseTemplate(MsgTemplate, data)

      const redisData: RedisDataType = {
        bot: e.bot.uin || Number(Bot.uin) || String(Bot.uin),
        gid: e.isGroup ? e.group_id : null,
        uid: e.user_id,
        mid: e.message_id
      }
      const mode: 'first' | 'all' | 'one' = (['first', 'all'] as const)[Number(Master)] || 'one'
      const Ret = await utils.sendMasterMsg(msg, Bot[BotId]?.uin || e.self_id, mode, Master)
      const successMsg = utils.parseTemplate(successMsgTemplate, { masterQQ: Object.values(Ret).flatMap(group => Object.keys(group)).toString() })
      await e.reply(successMsg)
      if (REDISCDKEY) await redis.set(REDISCDKEY, '1')
      await redis.set(`${REDISKEY}:${msgId}`, JSON.stringify(redisData), { EX: 86400 })
    } catch (err) {
      const msg = utils.parseTemplate(failsMsgTemplate, { masterQQ: String(Config.masterQQ[0]) })
      await e.reply(msg)
      logger.error(err)
    } finally {
      Sending = false
    }
  }

  async Replys (e = this.e) {
    if (!e.isMaster) return false
    try {
      const source = await utils.getSourceMessage(e)
      let MsgID: string; let isInput = false
      if (source && (/联系主人消息/.test(source.raw_message))) {
        MsgID = utils.extractMessageId(source.raw_message) || ''
      } else {
        const regRet = REPLYREG.exec(e.msg)
        if (!regRet?.[1]) {
          logger.warn('未找到消息ID')
          return false
        } else {
          MsgID = regRet[1].trim()
          isInput = true
        }
      }
      if (!MsgID) return false
      const data = await redis.get(`${REDISKEY}:${MsgID}`)
      if (!data) return isInput ? false : e.reply('❎ 消息已失效或不存在')
      const { bot: botId, gid, uid, mid } = JSON.parse(data) as RedisDataType
      const Message = utils.ReplaceMessage(e, isInput ? /#?回复(\S+)\s?/ : /#?回复/g)
      const msg = utils.parseTemplate(Config.sendMaster.replyMsgTemplate, {
        nickname: e.nickname || e.sender?.nickname || '未知',
        id: String(e.user_id),
        msg: Message as icqq.Sendable
      })
      msg.unshift(segment.reply(mid))

      const bot = Bot[botId] ?? Bot
      gid
        ? await bot.pickGroup(gid).sendMsg(msg)
        : await bot.pickFriend(uid).sendMsg(msg)
      await e.reply('✅ 消息已送达')
    } catch (err) {
      void e.reply('❎ 发生错误，请查看控制台日志')
      logger.error('回复消息时发生错误：', err)
      return false
    }
  }
}
