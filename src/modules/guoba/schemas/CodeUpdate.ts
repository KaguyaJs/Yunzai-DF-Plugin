import { GuobaSchemas } from '@/types/guoba'
import { PluginPath } from '@/utils'
import { repoPath, ACTIVITY_ACTIONS } from '@CodeUpdate/utils'
import config from '@/config'
import type { Schemas } from 'trss-yunzai/guoba'
import type { RepositoryConfig } from '@CodeUpdate/utils/repo'

const activityFilters: Schemas<RepositoryConfig> = [
  {
    field: 'events',
    label: 'PR/Issue监听事件',
    bottomHelpMessage: '留空使用生命周期事件；评论、标签、正文修改和新代码需手动勾选。转正式/草稿、合并和新代码仅适用于PR。',
    component: 'Select',
    componentProps: {
      mode: 'multiple',
      allowClear: true,
      options: Object.entries(ACTIVITY_ACTIONS).filter(([value]) => value !== 'snapshot').map(([value, label]) => ({ value, label }))
    }
  },
  ...([
    ['labels', '包含标签', '匹配任一标签；留空不限制'],
    ['excludeLabels', '排除标签', '命中任一标签则不推送'],
    ['authors', '包含作者账号', '留空不限制；评论事件按评论作者匹配'],
    ['excludeAuthors', '排除作者账号', '评论事件按评论作者匹配'],
    ['baseBranches', 'PR目标分支', '留空监听所有目标分支；例如 main、dev']
  ] as const).map(([field, label, bottomHelpMessage]) => ({
    field,
    label,
    bottomHelpMessage: `仅PR/Issue生效。${bottomHelpMessage}`,
    component: 'GTags' as const,
    // componentProps: { mode: 'tags', allowClear: true }
  })),
  { field: 'excludeBots', label: '忽略机器人活动', bottomHelpMessage: '仅PR/Issue生效；省略此项时默认开启。', component: 'Switch', defaultValue: true },
  { field: 'includeDrafts', label: '包含草稿PR', bottomHelpMessage: '省略此项时默认关闭；监听转为草稿事件时应开启。', component: 'Switch', defaultValue: false }
]

export const CodeUpdate: GuobaSchemas = [
  {
    component: 'SOFT_GROUP_BEGIN',
    label: 'Git仓库监听配置'
  },
  {
    field: 'CodeUpdate.Auto',
    label: '自动检查开关',
    component: 'Switch'
  },
  {
    field: 'CodeUpdate.Cron',
    label: '自动检查定时表达式',
    helpMessage: '修改后重启生效',
    bottomHelpMessage: '自动检查Cron表达式',
    component: 'EasyCron',
    componentProps: {
      placeholder: '请输入Cron表达式',
      hideYear: true
    }
  },
  {
    field: 'CodeUpdate.FirstAdd',
    label: '首次添加仓库是否推送',
    bottomHelpMessage: '首次监听是否推送当前状态；PR/Issue按首次条目上限推送，关闭时只建立基线。',
    component: 'Switch'
  },
  {
    field: 'CodeUpdate.badgeStyle',
    label: '是否启用徽章样式',
    bottomHelpMessage: '是否启用提交信息中的徽章样式, fix、feat等字段字段替换。',
    component: 'Switch'
  },
  {
    field: 'CodeUpdate.Translate',
    label: '更新内容翻译',
    bottomHelpMessage: '开启后会在截图渲染前将提交、Release、PR、Issue及评论内容翻译为简体中文。',
    component: 'Switch'
  },
  {
    field: 'CodeUpdate.TranslateApi',
    label: '翻译接口地址',
    bottomHelpMessage: '默认使用Google公共翻译接口；也支持包含 {text} / {q} / {target} 占位符的GET接口模板。',
    component: 'Input',
    componentProps: {
      placeholder: '请输入翻译接口地址'
    }
  },
  {
    field: 'CodeUpdate.TranslateName',
    label: '翻译提示名称',
    bottomHelpMessage: '经过翻译的更新内容会在图片中显示此名称，例如：Google 翻译。',
    component: 'Input',
    componentProps: {
      placeholder: '请输入翻译提示名称'
    }
  },
  {
    field: 'CodeUpdate.timeFormat',
    label: '日期格式',
    bottomHelpMessage: '推送显示的日期格式',
    component: 'RadioGroup',
    componentProps: {
      options: [
        { label: '多久前', value: 1 },
        { label: '日期加时间', value: 2 },
        { label: '自适应日期加时间', value: 3 }
      ]
    },
    required: true
  },
  {
    field: 'CodeUpdate.multiPage',
    label: '分片截图发送阈值',
    bottomHelpMessage: '当单次推送达到多少条时使用分片截图发送，填 -1 关闭',
    component: 'InputNumber',
    componentProps: {
      min: -1,
      max: 20,
      placeholder: '请输入数量，-1 关闭'
    },
    required: true,
  },
  {
    field: 'CodeUpdate.Activity.PageSize',
    label: 'PR/Issue每页数量',
    component: 'InputNumber',
    componentProps: { min: 1, max: 100 },
    bottomHelpMessage: '首次检查完整建立基线；后续按更新时间增量获取。'
  },
  {
    field: 'CodeUpdate.Activity.MaxPages',
    label: 'PR/Issue最多获取页数',
    component: 'InputNumber',
    componentProps: { min: 1, max: 1000 },
    bottomHelpMessage: '达到上限且尚有数据时保留原进度；大型仓库可调高。'
  },
  {
    field: 'CodeUpdate.Activity.InitialLimit',
    label: 'PR/Issue首次及预览条目上限',
    component: 'InputNumber',
    componentProps: { min: 1, max: 100 }
  },
  {
    field: 'CodeUpdate.Activity.BatchSize',
    label: 'PR/Issue每条消息的条目上限',
    component: 'InputNumber',
    componentProps: { min: 1, max: 50 },
    bottomHelpMessage: '超过上限时分批发送，每批成功后独立确认；手动预览同样生效。'
  },
  {
    field: 'CodeUpdate.Activity.BodyLimit',
    label: 'PR/Issue正文摘要长度',
    component: 'InputNumber',
    componentProps: { min: 0, max: 10000 },
    bottomHelpMessage: '评论同样生效；填0只展示标题和状态。'
  },
  {
    field: 'CodeUpdate.Activity.OverlapSeconds',
    label: 'PR/Issue增量回看秒数',
    component: 'InputNumber',
    componentProps: { min: 1, max: 3600 },
    bottomHelpMessage: '处理更新时间的边界重叠，已检测过的事件不会重复入队。'
  },
  {
    field: 'CodeUpdate.Activity.SendLinks',
    label: 'PR/Issue附带原始链接',
    component: 'Switch',
    bottomHelpMessage: '图片消息后附可点击链接。'
  },
  {
    field: 'CodeUpdate.repos',
    label: 'GitApi配置',
    bottomHelpMessage: 'Git仓库的接口配置',
    component: 'GSubForm',
    componentProps: {
      multiple: true,
      schemas: [
        {
          field: 'provider',
          label: '仓库提供商',
          component: 'Input',
          componentProps: {
            placeholder: '请输入仓库提供商'
          },
          rules: [
            {
              required: true, message: '不可以为空哦'
            }
          ]
        },
        {
          field: 'token',
          label: '认证Token',
          component: 'InputPassword',
          componentProps: {
            placeholder: '请输入认证Token'
          },
          bottomHelpMessage: 'Gitee 令牌获取地址：https://gitee.com/profile/personal_access_tokens \nGithub 令牌获取地址：https://github.com/settings/tokens \nGitcode 令牌获取地址：https://gitcode.com/setting/token-classic 其他的请自行查找'
        },
        {
          field: 'ApiUrl',
          label: 'Api地址',
          component: 'Input',
          componentProps: {
            placeholder: '请输入Api地址'
          },
          rules: [
            {
              required: true, message: '不可以为空哦'
            }
          ]
        },
        {
          field: 'icon',
          label: '图标',
          component: 'Input',
          bottomHelpMessage: '仓库提供商的图标地址，支持file://、http://、https://等协议，Gitee、GiHhub、GitCode、Gitea内置图标',
          componentProps: {
            placeholder: '请输入图标地址, 不填为默认图标'
          }
        }
      ]
    }
  },
  {
    field: 'CodeUpdate.List',
    label: '推送列表',
    bottomHelpMessage: 'Git仓库推送列表',
    component: 'GSubForm',
    componentProps: {
      multiple: true,
      schemas: [
        {
          field: 'Group',
          helpMessage: '检测到仓库更新后推送的群列表',
          label: '推送群',
          componentProps: {
            placeholder: '点击选择要推送的群'
          },
          component: 'GSelectGroup'
        },
        {
          field: 'QQ',
          helpMessage: '检测到仓库更新后推送的用户列表',
          label: '推送好友',
          componentProps: {
            placeholder: '点击选择要推送的好友'
          },
          component: 'GSelectFriend'
        },
        {
          field: 'AutoPath',
          label: '自动扫描本地插件',
          bottomHelpMessage: '自动扫描监听提交；PR/Issue需在仓库配置中单独添加。',
          component: 'Switch'
        },
        {
          field: 'Exclude',
          label: '排除的仓库',
          component: 'Select',
          componentProps: {
            allowClear: true,
            mode: 'tags',
            get options () {
              return PluginPath.map((i) => ({ value: repoPath(i.repo, i.branch) }))
            }
          }
        },
        {
          field: 'repos',
          label: '监听仓库配置',
          bottomHelpMessage: 'Git仓库推送列表',
          component: 'GSubForm',
          componentProps: {
            multiple: true,
            schemas: [
              {
                field: 'provider',
                label: '仓库提供商',
                component: 'Select',
                componentProps: {
                  placeholder: '请选择仓库提供商',
                  mode: 'combobox',
                  get options () {
                    return config.CodeUpdate?.repos?.map?.(i => ({ value: i?.provider }))
                  }
                },
                rules: [
                  {
                    required: true, message: '不可以为空哦'
                  }
                ]
              },
              {
                field: 'repo',
                label: '仓库名',
                component: 'Input',
                componentProps: {
                  placeholder: '请输入仓库名'
                },
                rules: [
                  {
                    pattern: '^[^\\s]*$', message: '请勿输入空格'
                  },
                  {
                    pattern: '^([\\w-]+)\\/([\\w.-]+)$',
                    message: '格式不正确，请使用 所有者/存储库 的格式'
                  },
                  {
                    required: true, message: '不可以为空哦'
                  }
                ]
              },
              {
                field: 'branch',
                label: '分支名',
                bottomHelpMessage: '仅提交监听生效。留空自动获取默认分支；可输入多个分支，输入all每次自动获取并监听全部分支。PR请使用目标分支筛选。',
                defaultValue: [],
                component: 'Select',
                componentProps: {
                  mode: 'tags',
                  allowClear: true,
                  tokenSeparators: [',', '，', ' '],
                  placeholder: '留空使用默认分支，或输入分支名/all',
                  options: [{ label: '全部分支', value: 'all' }]
                }
              },
              {
                field: 'type',
                label: '监听类型',
                component: 'Select',
                defaultValue: ['commits'],
                required: true,
                componentProps: {
                  mode: 'multiple',
                  allowClear: true,
                  options: [
                    { label: '提交', value: 'commits' },
                    { label: '发布', value: 'releases' },
                    { label: 'PR', value: 'pulls' },
                    { label: 'Issues', value: 'issues' }
                  ]
                },
                bottomHelpMessage: '一个仓库可同时选择多个类型，共用下方PR/Issue筛选。PR/Issue支持GitHub、Gitee、Gitcode和Gitea兼容接口；CNB暂不支持。'
              },
              ...activityFilters
            ]
          }
        },
        {
          field: 'note',
          label: '备注',
          component: 'Input'
        }
      ]
    }
  }
]
