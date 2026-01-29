import type { GitApiMethod } from './CodeUpdate'

export interface Config {
  CodeUpdate: {
    /**
     * 自动检查仓库更新开关
     *
     * @default false
     */
    Auto: boolean
    /**
     * 是否自动给未配置分支的仓库添加默认分支
     *
     * @default true
     */
    AutoBranch: boolean
    /**
     * 首次添加仓库是否进行一次推送
     *
     * @default false
     */
    FirstAdd: boolean
    /**
     * 仓库更新检查Cron表达式
     * Github/Gitee Api 未认证用户每小时限制60 (ip限制), 认证用户每小时限制5000次 (账号限制)
     *
     * @default "0 *\/30 * * * * "
     */
    Cron: string
    /**
     * GitApi 配置
     */
    repos: {
      /**
       * 仓库提供商名称
       *
       * @example 'GitHub' | 'Gitee' | 'Gitcode' | 'CNB'
       */
      provider: string
      /**
       * 认证令牌
       */
      token?: string
      /**
       * Api 地址
       */
      ApiUrl: string
      /** 可选：图标 */
      icon?: string
      /** 提示 */
      tips?: string
    }[]
    /**
     * 推送策略组
     * @default []
     */
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
    /**
     * 戳一戳开关
     *
     * @default true
     */
    chuo: boolean
    /**
     * 戳一戳模式
     *
     * image: 返回图片消息
     * text: 返回文本消息
     * random: 随机返回文本或图片
     * mix: 同时显示图片+文字
     *
     * @default 'image'
     *
     */
    mode: 'image' | 'text' | 'random' | 'mix'
    /**
     * 戳一戳图片 Api 地址，不填默认
     *
     * @default ""
     */
    imageApi: string
    /**
     * 戳一戳图片类型，all为全部
     *
     * @default 1
     */
    imageType: number | 'all'
    /**
     * 戳一戳随机图片黑名单
     *
     * @default []
     */
    imageBlack: string[]
    /**
     * 戳一戳文本模式
     * hitokoto: 一言
     * list: 自定义文本
     *
     * @default "hitokoto"
     */
    textMode: 'hitokoto' | 'list'
    /**
     * 戳一戳文本列表
     *
     * @default ["你干嘛哎呦"]
     */
    textList: string[]
  }
  Picture: {
    /**
     * 随机图片总开关
     *
     * @default true
     */
    open: boolean
    /**
     * 随机Api图片开关
     *
     * @default true
     */
    apiPicture: boolean
    /**
     * api图片禁用列表
     *
     * @default []
     */
    apiDisable: string[]
    /**
     * 随机表情开关
     *
     * @default true
     */
    facePicture: boolean
    /**
     * 随机表情禁用列表
     *
     * @default []
     */
    faceDisable: string[]
  }
  sendMaster: {
    /**
     * 联系主人开关
     *
     * @default true
     */
    open: boolean
    /**
     * 联系主人冷却时间 单位：秒
     *
     * @default 30
     */
    cd: number
    /**
     * 主人账号 0: 仅发送首个主人 1: 发送全部主人
     *
     * @default 0
     */
    Master: number | string
    /**
     * 机器人账号 0为触发Bot
     *
     * @default 0
     */
    BotId: number | string
    /**
     * 发送给主人的消息模板
     *
     * @example
     * `{{key}}
     * {{avatar}}
     * 平台: {{platform}}
     * 用户: {{user}}
     * 来自: {{group}}
     * BOT: {{bot}}
     * 时间: {{time}}
     * 消息内容:
     * {{msg}}
     * -------------
     * 引用该消息：#回复 <内容>`
     */
    MsgTemplate: string
    /**
     * 消息发送成功后返回的消息
     *
     * @default
     * ` ✅ 消息已送达
    主人的QQ: {{masterQQ}}`
     */
    successMsgTemplate: string
    /**
     * 失败时发送的消息
     *
     * @default "❎ 消息发送失败，请尝试自行联系：{{masterQQ}}"
     */
    failsMsgTemplate: string
    /**
     * 主人回复时发送的消息
     *
     * @default
     * `主人 {{nickname}}({{id}}) 回复:
     * {{msg}}`
     * */
    replyMsgTemplate: string
    /**
     * 违禁词，包含以下内容的消息不会发送给主人
     *
     * @default []
     */
    banWords: string[]
    /**
     * 禁用的用户，此列表内的用户无法使用
     *
     * @default []
     */
    banUser: (number | string)[]
    /**
     * 禁用的群，此列表内的群无法使用
     *
     * @default []
     */
    banGroup: (string | number)[]
  }
  summary: {
    /**
     * 图片外显开关
     *
     * @default false
     */
    sum: boolean
    /**
     * 外显模式 (1: 自定义外显 2:  一言接口 3: 列表随机)
     *
     * @default 2
     */
    type: 1 | 2 | 3
    /**
     * 自定义外显文本
     *
     * @default "Ciallo～(∠・ω< )⌒☆"
     */
    text: string
    /**
     * 自定义外显随机列表
     *
     * @default ["你干嘛~","我喜欢你"]
     */
    list: string[]
    /**
     * 一言接口
     *
     * @default "https://v1.hitokoto.cn/?encode=text"
     */
    api: string
  }
  proxy: {
    /**
     * 代理开关
     *
     * @default false
     *  */
    open: boolean
    /**
     * 代理地址
     *
     * @default "http://127.0.0.1:7890"
     * */
    url: string
  }
  other: {
    /**
     * 原神关键词发图
     *
     * @default true
     */
    ys: boolean
    /**
     * 渲染精度
     *
     * @default 100
     */
    renderScale: number
  }
}
