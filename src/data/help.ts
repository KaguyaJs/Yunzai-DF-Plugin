import { FaceList } from './Face'
import { HelpListType, HelpConfig } from '@/types'

const FacePictureHelp = FaceList.map((i) => {
  return {
    icon: Math.floor(Math.random() * 55) + 1,
    title: `#随机${i}`,
    desc: i
  }
})

export const helpCfg: HelpConfig = {
  title: 'DF帮助',
  subTitle: '[DF插件] Yunzai-Bot & DF-Plugin',
  colCount: 4,
  colWidth: 300,
  // theme: 'all',
  // themeExclude: ['default'],
  style: {
    fontColor: '#3fe4e4ff',
    descColor: '#ffffff',
    contBgColor: 'rgba(6, 21, 31, 0)',
    contBgBlur: 1.9,
    headerBgColor: 'rgba(172, 229, 209, .4)',
    rowBgColor1: 'rgba(6, 21, 31, .1)',
    rowBgColor2: 'rgba(6, 21, 31, .1)',
    fontShadow: '-1px 0 black,0 1px black,1px 0 black,0 -1px black',
  }
}

// {
//     fontColor: '#ceb78b',
//     descColor: '#eee',
//     fontShadow: '-1px 0 black,0 1px black,1px 0 black,0 -1px black',
//     contBgColor: 'rgba(6, 21, 31, .5)',
//     contBgBlur: 0,
//     headerBgColor: 'rgba(255, 222, 142, 0.44)',
//     rowBgColor1: 'rgba(255, 166, 99, 0.23)',
//     rowBgColor2: 'rgba(251, 113, 107, 0.35)'
//   }

// export const style = {
//   fontColor: '#00ffff',
//   descColor: '#ffffff',
//   contBgColor: 'rgba(6, 21, 31, 0)',
//   contBgBlur: 1.9,
//   headerBgColor: 'rgba(172, 229, 209, .4)',
//   rowBgColor1: 'rgba(6, 21, 31, .1)',
//   rowBgColor2: 'rgba(6, 21, 31, .1)'
// }

export const helpList: HelpListType = [
  {
    group: '功能类',
    list: [
      {
        icon: 2,
        title: '戳一戳',
        desc: '打开锅巴查看配置'
      },
      {
        icon: 4,
        title: '拾取关键词原神',
        desc: '本来聊得好好的，突然有人聊起了原神，搞得大家都不高兴'
      }
    ]
  },
  {
    group: 'Git仓库推送 （使用锅巴进行配置）',
    list: [
      {
        icon: 6,
        title: '#检查仓库更新',
        desc: '检查是否有仓库更新并推送至对应群或人（定时检查同逻辑）'
      },
      {
        icon: 9,
        title: '#推送仓库更新',
        desc: '获取所有仓库的最新数据并回复到当前对话（不推送群或人）'
      }
    ]
  },
  {
    group: '随机图片类 (查看更多 #DF表情包列表）',
    list: [
      {
        icon: 35,
        title: '#来张制服',
        desc: '随机jk图片'
      },
      {
        icon: 5,
        title: '#来张黑丝/白丝',
        desc: '顾名思义'
      },
      {
        icon: 3,
        title: '#来张cos',
        desc: '随机cos图片'
      },
      {
        icon: 8,
        title: '#看看腿',
        desc: 'kkt'
      },
      // {
      //   icon: 16,
      //   title: '#随机从雨',
      //   desc: '狗修金'
      // },
      // {
      //   icon: 33,
      //   title: '#随机诗歌剧',
      //   desc: '曼波'
      // },
      ...FacePictureHelp
    ]
  },
  {
    group: '给主人带话',
    list: [
      {
        icon: 13,
        title: '#联系主人',
        desc: '给主人带句话'
      },
      {
        icon: 14,
        title: '#回复',
        desc: '主人回复群友的消息'
      }
    ]
  },
  {
    group: '图片外显',
    auth: 'master',
    list: [
      {
        icon: 7,
        title: '#开启/关闭图片外显',
        desc: '开关外显功能'
      },
      {
        icon: 4,
        title: '#设置外显+文字',
        desc: '设置自定义外显文本'
      },
      {
        icon: 6,
        title: '#切换外显模式',
        desc: '切换一言/文本模式'
      }
    ]
  },
  {
    group: '主人功能',
    auth: 'master',
    list: [
      {
        icon: 12,
        title: '#DF(强制)?更新',
        desc: '拉取Git更新'
      },
      {
        icon: 17,
        title: '#DF清理无效数据',
        desc: '清理本插件占用的数据库内存'
      },
      {
        icon: 2,
        title: '#DF更新图库',
        desc: '更新戳一戳图库'
      },
      {
        icon: 14,
        title: '#DF版本',
        desc: '查看近期版本内容'
      }
    ]
  }
]
