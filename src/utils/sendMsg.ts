import Config from '@/config'
import { MessageRet, Sendable } from 'trss-yunzai/icqq'
import common from '../../../../lib/common/common.js'

// export async function sendMasterMsg (
//   msg: Sendable,
//   botUin: number | string | typeof Bot.uin | undefined,
//   mode: 'one',
//   userId: string | number
// ): Promise<Record<string, Record<string, MessageRet>>>

// export async function sendMasterMsg (
//   msg: Sendable,
//   botUin: number | string | typeof Bot.uin | undefined,
//   mode?: 'first' | 'all',
//   userId?: undefined
// ): Promise<Record<string, Record<string, MessageRet>>>

export async function sendMasterMsg (
  msg: Sendable,
  botUin: number | string | typeof Bot.uin | undefined,
  mode?: 'first' | 'all' | 'one',
  userId?: string | number
): Promise<Record<string, Record<string, MessageRet>>> {
  let masterList = Config.masterQQ
  if (Config.master) {
    const master = Config.master[String(botUin)]
    if (master?.length) masterList = master
    else botUin = undefined
  }
  if (mode === 'all') {
    if (Bot.sendMasterMsg) {
      return Bot.sendMasterMsg(msg, Bot.uin)
    } else {
      const MsgRet: Record<string, Record<string, MessageRet>> = {}
      for (const master of masterList) {
        const bot = Number(botUin) || String(botUin)
        if (MsgRet[bot]) MsgRet[bot] = {}
        MsgRet[bot][master] = await common.relpyPrivate(master, msg, bot)
        await common.sleep(1000)
      }
      return MsgRet
    }
  } else if (mode === 'first') {
    const id = (masterList[0] === 'stdin' && masterList[1])
      ? masterList[1]
      : masterList[0]
    return {
      [String(botUin)]: {
        [id]: await common.relpyPrivate(id, msg, Number(botUin) || String(botUin))
      }
    }
  } else if (mode === 'one' && userId) {
    return {
      [String(botUin)]: {
        [userId]: await common.relpyPrivate(userId, msg, Number(botUin) || String(botUin))
      }
    }
  }
  return {}
}
