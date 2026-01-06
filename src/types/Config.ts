import type { GitApiMethod } from './CodeUpdate'

export interface Config {
  CodeUpdate: {
    Auto: boolean
    AutoBranch: boolean
    FirstAdd: boolean
    Cron: string
    repos: {
      provider: string
      token?: string
      ApiUrl: string
      icon?: string
      tips?: string
    }[]
    List: {
      Group?: (string | number)[]
      QQ?: (string | number)[]
      AutoPath?: boolean
      Exclude?: string[]
      repos: {
        provider: string
        repo: string
        branch?: string
        type: GitApiMethod | 'commit'
      }[]
    }[]
  }
  Poke: {
    chuo: boolean
    mode: 'image' | 'text' | 'random' | 'mix'
    imageApi: string
    imageType: number | 'all'
    imageBlack: string[]
    textMode: 'hitokoto' | 'list'
    textList: string[]
  }
  Picture: {
    open: boolean
    apiPicture: boolean
    apiDisable: string[]
    facePicture: boolean
    faceDisable: string[]
    Direct: boolean
  }
  sendMaster: {
    open: boolean
    cd: number
    Master: number | string
    BotId: number | string
    MsgTemplate: string
    successMsgTemplate: string
    failsMsgTemplate: string
    replyMsgTemplate: string
    banWords: string[]
    banUser: (number | string)[]
    banGroup: (string | number)[]
  }
  summary: {
    sum: boolean
    type: 1 | 2 | 3
    text: string
    list: string[]
    api: string
  }
  proxy: {
    open: boolean
    url: string
  }
  other: {
    ys: boolean
    renderScale: number
  }
}
