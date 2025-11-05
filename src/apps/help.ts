import { getThemeData } from '@/modules'
import { screenshot } from '@/utils'

export class Help extends plugin<'message'> {
  constructor () {
    super({
      name: 'DF:帮助',
      dsc: '喵喵喵',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: /^#?DF帮助/i,
          fnc: 'help',
        }
      ]
    })
  }

  async help (e = this.e) {
    const { helpList, helpCfg } = await import('@/data/help')
    const helpGroup: typeof helpList = []

    helpList.forEach((group) => {
      if (group.auth && group.auth === 'master' && !e.isMaster) return true
      group.list.forEach((help) => {
        const { icon } = help
        if (!icon) {
          help.css = 'display:none'
        } else {
          const x = (icon - 1) % 10
          const y = (icon - x - 1) / 10
          help.css = `background-position:-${x * 50}px -${y * 50}px`
        }
      })

      helpGroup.push(group)
    })

    const themeData = await getThemeData(helpCfg)

    return screenshot('help/index', {
      helpCfg,
      helpGroup,
      ...themeData
    }, {
      e,
      scale: 1.6,
      send: true
    })
  }
}
