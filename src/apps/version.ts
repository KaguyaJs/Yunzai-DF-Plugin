import { screenshot, Version } from '@/utils'

export class version extends plugin<'message'> {
  constructor () {
    super({
      name: 'DF:版本',
      dsc: 'DF版本信息',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: /^#?DF版本$/i,
          fnc: 'logs',
        }
      ]
    })
  }

  async logs (e = this.e) {
    return screenshot('version-info/index', {
      changelogs: Version.logs
    },
    { e, send: true, scale: 2.5 })
  }
}
