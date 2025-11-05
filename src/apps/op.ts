import Config from '@/config'
import { ResPath } from '@/dir'
import path from 'node:path'

const ys: Record<string, true | undefined> = {}

export class OP extends plugin<'message.group'> {
  constructor () {
    super({
      name: 'DF:原神关键词发图',
      dsc: '本来聊得好好的，突然有人聊起了原神，搞得大家都不高兴',
      event: 'message.group',
      priority: 5001,
      rule: [
        {
          reg: '原神',
          fnc: 'ys'
        }
      ]
    })
  }

  ys () {
    if (ys[this.e.group_id] || !Config.other.ys) return false
    void this.reply(segment.image(path.join(ResPath, 'img', 'ys.png')))
    ys[this.e.group_id] = true
    return false
  }
}
