import Config from '@/config'
import { MessageEvent, icqq } from 'trss-yunzai'

export function ReplaceMessage (e: MessageEvent, Reg?: RegExp): icqq.MessageElem[] {
  let alias: string[] = []

  if (e.hasAlias && e.isGroup) {
    const groupCfg = Config.getGroup(String(e.group_id), String(e.self_id))
    alias = Array.isArray(groupCfg.botAlias)
      ? groupCfg.botAlias
      : [groupCfg.botAlias]
  }

  const message = e.message
    .filter(item => item.type !== 'at')
    .map(item => ({ ...item }))
    .filter(item => {
      if (item.type === 'text') {
        if (Reg && item.text) item.text = item.text.replace(Reg, '').trim()
        if (!item.text) return false
        for (const name of alias) {
          if (item.text.startsWith(name)) {
            item.text = item.text.slice(name.length).trim()
            break
          }
        }
      } else if ('url' in item && item.url) {
        (item as any).file = item.url
      }
      return true
    })

  return message
}

/**
 * 获取引用消息
 * @param e 消息事件对象
 * @returns 引用的原始消息
 */
export async function getSourceMessage (e: MessageEvent): Promise<icqq.PrivateMessage | icqq.GroupMessage | null> {
  if (e.getReply) {
    return await e.getReply()
  } else if (e.source) {
    if (e.isGroup) {
      return (await e.group.getChatHistory(e.source.seq, 1)).pop() || null
    } else {
      return (await e.friend.getChatHistory(e.source.time, 1)).pop() || null
    }
  }
  return null
}

/**
 * 提取消息ID
 * @param rawMessage - 原始消息
 * @returns 消息ID
 */
export function extractMessageId (rawMessage: string) {
  const regex = /\(([^)]+)\)/
  const match = rawMessage.match(regex)
  return match ? match[1] : null
}
