import type { GitApiMethod, GitActivityAction } from './CodeUpdate'

export interface Config {
  /**
   * Git仓库更新推送配置
   */
  CodeUpdate: {
    /**
     * 自动检查仓库更新开关
     *
     * @default false
     */
    Auto: boolean
    /**
     * 是否输出仓库请求统计日志，不影响自动检查
     *
     * @default true
     */
    RequestEstimateLog: boolean
    /**
     * 首次添加仓库是否进行一次推送
     *
     * @default false
     */
    FirstAdd: boolean
    /**
     * 是否启用徽章样式
     * 将提交标题中的 feat、fix 等类型显示为徽章
     *
     * @default true
     */
    badgeStyle: boolean
    /**
     * 仓库更新图片主题
     * 自动推送与手动汇总共用，默认使用海盐蓝，经典原版可自行选择
     * 新主题颜色留空时使用所选主题的默认配色
     */
    Theme: {
      /**
       * 内置主题名称
       * classic: 经典原版（主题改造前的原始深色布局）
       * dark: 深空（深色）
       * light: 晨光（浅色）
       * ocean: 海盐蓝
       * forest: 松石绿
       * sunset: 暖砂橙
       * lavender: 薰衣草
       * pink: 樱花粉
       *
       * @default "ocean"
       */
      Name: 'classic' | 'dark' | 'light' | 'ocean' | 'forest' | 'sunset' | 'lavender' | 'pink'
      /**
       * 自定义强调色，用于标题点缀、链接等，留空跟随主题
       * 仅对新主题生效，经典原版保持原始配色
       * 支持 #RGB 或 #RRGGBB 格式
       *
       * @default ""
       * @example "#58a6ff"
       */
      Accent: string
      /**
       * 图片背景色，留空跟随主题
       * 仅对新主题生效，经典原版保持原始配色
       * 支持 #RGB 或 #RRGGBB 格式
       *
       * @default ""
       */
      Background: string
      /**
       * 更新卡片背景色，留空跟随主题
       * 仅对新主题生效，经典原版保持原始配色
       * 支持 #RGB 或 #RRGGBB 格式
       *
       * @default ""
       */
      Surface: string
      /**
       * 主要文字颜色，留空跟随主题
       * 仅对新主题生效，经典原版保持原始配色
       * 支持 #RGB 或 #RRGGBB 格式
       *
       * @default ""
       */
      Text: string
      /**
       * 辅助文字颜色，留空跟随主题
       * 仅对新主题生效，经典原版保持原始配色
       * 支持 #RGB 或 #RRGGBB 格式
       *
       * @default ""
       */
      Muted: string
      /**
       * 卡片边框与分隔线颜色，留空跟随主题
       * 仅对新主题生效，经典原版保持原始配色
       * 支持 #RGB 或 #RRGGBB 格式
       *
       * @default ""
       */
      Border: string
      /**
       * 图片的布局宽度，单位：像素，实际输出还会应用渲染精度缩放
       * 仅对新主题生效，经典原版保持原始宽度
       * 范围：520~1000
       *
       * @default 640
       */
      Width: number
      /**
       * 更新卡片的圆角大小，单位：像素，0为直角
       * 仅对新主题生效，经典原版保持原始圆角
       * 范围：0~28
       *
       * @default 16
       */
      Radius: number
    }
    /**
     * 是否在渲染仓库更新前，将提交、Release、PR、Issue及评论内容翻译为简体中文
     *
     * @default false
     */
    Translate: boolean
    /**
     * 翻译接口地址
     * 默认兼容Google公共翻译接口，也支持包含 {text}、{q}、{target} 占位符的GET接口模板
     *
     * @default "https://translate.googleapis.com/translate_a/single"
     */
    TranslateApi: string
    /**
     * 翻译结果提示名称
     *
     * @default "Google 翻译"
     */
    TranslateName: string
    /**
     * 时间格式
     * ```
     * 1: 多久之前 x分钟前 X小时前
     * 2: 日期加时间 2023-01-01 00:00:00
     * 3: 自适应时分（非当日显示日期） 2023-01-01 00:00
     * ```
     *
     * @default 1
     */
    timeFormat: 1 | 2 | 3
    /**
     * 推送截图的数据达到多少条时启用分片截图发送，-1 关闭
     * 自动推送与手动推送仓库更新均生效，手动汇总后的全部分片在同一次回复中发送
     *
     * @default 12
     */
    multiPage: number
    /**
     * Release附件展示配置
     * 草稿是否推送由各仓库的 includeDrafts 设置控制
     */
    Release: {
      /**
       * 是否在推送图片中展示Release附件名称和大小
       *
       * @default true
       */
      ShowAssets: boolean
      /**
       * Release附件最多展开的数量，超出后显示折叠数量
       * 0: 折叠全部附件
       * -1: 展示全部附件
       *
       * @default 5
       */
      AssetLimit: number
    }
    /**
     * PR/Issue获取与展示配置
     * 分页数量、最多页数和消息条目上限也用于提交推送
     */
    Activity: {
      /**
       * 提交、PR及Issue每页获取的条目数量
       * 范围：1~100
       *
       * @default 100
       */
      PageSize: number
      /**
       * 单次检查最多获取的页数
       * 达到上限且尚未确认数据完整时保留原进度，需调高后重试
       * CNB提交的父链扫描节点上限为 PageSize × MaxPages
       * 范围：1~1000
       *
       * @default 20
       */
      MaxPages: number
      /**
       * PR/Issue首次推送与手动预览时，每个仓库最多展示的条目数量
       * 范围：1~100
       *
       * @default 10
       */
      InitialLimit: number
      /**
       * 包含提交、PR或Issue时，每条推送消息最多包含的条目数量
       * 自动推送超过上限时分批发送，每批成功后独立确认
       * 手动预览会将各推送组汇总后一次回复，不受此项影响；图片是否分片由 multiPage 控制
       * 范围：1~50
       *
       * @default 20
       */
      BatchSize: number
      /**
       * PR/Issue正文及评论摘要的最大字符数，0为隐藏正文
       * 范围：0~10000
       *
       * @default 600
       */
      BodyLimit: number
      /**
       * PR/Issue增量查询向前回看的秒数，用于处理更新时间边界
       * 已检测过的事件不会重复加入待推送队列
       * 范围：1~3600
       *
       * @default 60
       */
      OverlapSeconds: number
      /**
       * 是否在PR/Issue图片消息后附带可点击的原始链接
       * 展示代码差异时也会附带对应的完整差异链接
       *
       * @default false
       */
      SendLinks: boolean
      /**
       * 是否在PR活动卡片中展示代码差异
       * 代码差异过大时收起为摘要，不用于评论通知
       *
       * @default false
       */
      ShowDiff: boolean
      /**
       * PR代码差异最多展开的文件数量，超过后收起代码并保留部分文件列表
       * 范围：1~20
       *
       * @default 3
       */
      DiffMaxFiles: number
      /**
       * PR代码差异最多展开的总行数，包含所有文件的代码及上下文
       * 超过上限时收起为摘要
       * 范围：1~200
       *
       * @default 40
       */
      DiffMaxLines: number
    }
    /**
     * 仓库更新检查Cron表达式
     * Github/Gitee Api 未认证用户每小时限制60 (ip限制), 认证用户每小时限制5000次 (账号限制)
     *
     * @default "0 *\/30 * * * *"
     */
    Cron: string
    /**
     * Git仓库提供商的接口配置
     * 用于设置各平台的接口地址、认证令牌和图标
     */
    repos: {
      /**
       * 仓库提供商名称
       *
       * @example 'GitHub' | 'Gitee' | 'Gitcode' | 'CNB' | 'MyGitea'
       */
      provider: string
      /**
       * 认证令牌
       * 用于访问私有仓库、读取草稿及提高接口请求额度
       *
       * @default ""
       */
      token?: string
      /**
       * Git仓库接口根地址
       *
       * @example "https://api.github.com/repos"
       * @example "https://gitea.example.com/api/v1/repos"
       */
      ApiUrl: string
      /**
       * 仓库提供商的图标名称或地址，不填使用默认图标
       *
       * @example "GitHub"
       * @example "https://example.com/icon.png"
       */
      icon?: string
      /**
       * 仓库提供商的配置提示，例如认证令牌获取地址
       */
      tips?: string
    }[]
    /**
     * 推送策略组
     *
     * @default []
     */
    List: {
      /**
       * 接收仓库更新推送的群号列表
       *
       * @default []
       */
      Group?: (string | number)[]
      /**
       * 接收仓库更新推送的好友账号列表
       *
       * @default []
       */
      QQ?: (string | number)[]
      /**
       * 是否自动扫描并监听已安装插件的Git提交
       * PR/Issue需在仓库配置中单独添加
       *
       * @default false
       */
      AutoPath?: boolean
      /**
       * 自动扫描时排除的仓库列表，格式为 所有者/仓库名:分支名
       * 仅作用于本地自动扫描，不影响手动添加的仓库
       *
       * @default []
       * @example ["owner/repo:main"]
       */
      Exclude?: string[]
      /**
       * 手动配置的监听仓库列表
       *
       * @default []
       */
      repos: {
        /**
         * 仓库提供商名称，对应Git接口配置中的 provider
         *
         * @example "GitHub"
         */
        provider: string
        /**
         * 仓库路径，格式为 所有者/仓库名
         *
         * @example "owner/repo"
         */
        repo: string
        /**
         * 需要监听的提交分支列表，仅对 commits 生效
         * 留空自动获取默认分支，填写 all 时每轮获取并监听全部分支
         *
         * @default []
         * @example ["main", "dev"]
         * @example ["all"]
         */
        branch?: string[]
        /**
         * 仓库监听类型列表，可同时选择多个类型
         * commits: 提交
         * releases: 发布
         * pulls: PR
         * issues: Issue
         *
         * @default ["commits"]
         * @example ["commits", "releases", "pulls", "issues"]
         */
        type: GitApiMethod[]
        /**
         * PR/Issue需要监听的事件列表
         * 留空监听新建、关闭和重开，PR另监听合并与转为正式
         * 评论、标签、正文修改和提交新代码需单独配置
         *
         * @default []
         * @example ["opened", "closed", "commented"]
         */
        events?: GitActivityAction[]
        /**
         * PR/Issue需要包含的标签，匹配任一标签即可，留空不限制
         * 标签名称忽略大小写
         *
         * @default []
         * @example ["bug", "feature"]
         */
        labels?: string[]
        /**
         * PR/Issue需要排除的标签，命中任一标签则不推送
         * 标签名称忽略大小写
         *
         * @default []
         */
        excludeLabels?: string[]
        /**
         * PR/Issue需要包含的作者账号，留空不限制
         * 评论事件按评论作者匹配，账号忽略大小写
         *
         * @default []
         * @example ["alice", "bob"]
         */
        authors?: string[]
        /**
         * PR/Issue需要排除的作者账号
         * 评论事件按评论作者匹配，账号忽略大小写
         *
         * @default []
         */
        excludeAuthors?: string[]
        /**
         * 是否忽略机器人创建的PR/Issue及机器人评论
         *
         * @default true
         */
        excludeBots?: boolean
        /**
         * 是否包含草稿PR及最新草稿Release
         * 草稿Release内容修改和转为正式均会触发推送，认证令牌需有读取草稿的权限
         * 监听PR转为草稿事件时应开启
         *
         * @default false
         */
        includeDrafts?: boolean
        /**
         * PR目标分支筛选，留空监听所有目标分支
         * 分支名称区分大小写
         *
         * @default []
         * @example ["main", "dev"]
         */
        baseBranches?: string[]
      }[]
    }[]
  }
  /**
   * 戳一戳配置
   */
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
     * @default ["default"]
     */
    imageBlack: string[]
    /**
     * 戳一戳文本模式
     * hitokoto: 一言
     * list: 自定义文本
     * text: 自定义文本，与 list 相同
     *
     * @default "hitokoto"
     */
    textMode: 'hitokoto' | 'list' | 'text'
    /**
     * 戳一戳文本列表
     *
     * @default ["你干嘛哎呦"]
     */
    textList: string[]
  }
  /**
   * 随机图片配置
   */
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
  /**
   * 联系主人配置
   */
  sendMaster: {
    /**
     * 联系主人开关
     *
     * @default true
     */
    open: boolean
    /**
     * 联系主人冷却时间，单位：秒，0为关闭冷却
     *
     * @default 30
     */
    cd: number
    /**
     * 主人账号 0: 仅发送首个主人 1: 发送全部主人
     * 填写具体账号时仅发送给指定主人
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
     * `✅ 消息已送达
     * 主人的QQ: {{masterQQ}}`
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
     */
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
  /**
   * 图片外显配置
   */
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
  /**
   * 网络代理配置
   */
  proxy: {
    /**
     * 代理开关
     *
     * @default false
     */
    open: boolean
    /**
     * 代理地址
     *
     * @default "http://127.0.0.1:7890"
     */
    url: string
  }
  /**
   * 其他功能配置
   */
  other: {
    /**
     * 原神关键词发图
     *
     * @default true
     */
    ys: boolean
    /**
     * 渲染精度
     * 范围：50~200
     *
     * @default 100
     */
    renderScale: number
  }
}
