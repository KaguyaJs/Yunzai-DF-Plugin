import { request } from '@/utils'
import type { Sendable } from 'trss-yunzai/icqq'

type HandlersType = {
  /** 正则或命令匹配 */
  reg: string | RegExp,
  /** api处理方法，返回消息段 */
  fnc: () => Sendable | Promise<Sendable>
}[]

/**
 * api方法合集
 */
export const apiHandlers: HandlersType = [
  {
    reg: 'jk(?:制服)?',
    fnc: () => segment.image('https://api.suyanw.cn/api/jk.php')
  },
  {
    reg: '黑丝',
    fnc: () => [
      '唉嗨害，黑丝来咯',
      segment.image('https://api.suyanw.cn/api/hs.php')
    ]
  },
  {
    reg: '白丝',
    fnc: async () => {
      const res = (await request.get<{ data: string }>('https://v2.api-m.com/api/baisi'))
      if (!res) return ''
      return [
        '白丝来咯~',
        segment.image(res.data)
      ]
    }
  },
  {
    reg: 'cos',
    fnc: async () => {
      const res = (await request.get<{ text: string }>('https://api.suyanw.cn/api/cos.php?type=json'))
      if (!res) return ''
      return [
        'cos来咯~',
        segment.image(res.text.replace(/\\/g, '/'))
      ]
    }
  },
  {
    reg: '腿子?',
    fnc: async () => {
      const res = (await request.get<{ text: string }>('https://api.suyanw.cn/api/meitui.php?type=json'))
      if (!res) return ''
      return [
        '看吧涩批！',
        segment.image(res.text.replace(/\\/g, '/'))
      ]
    }
  }
]
