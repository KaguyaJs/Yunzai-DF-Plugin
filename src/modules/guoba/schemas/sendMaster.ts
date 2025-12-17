import type { GuobaSchemas } from '@/types/guoba'

export const sendMaster: GuobaSchemas = [
  {
    component: 'SOFT_GROUP_BEGIN',
    label: '联系主人配置'
  },
  {
    field: 'sendMaster.open',
    label: '功能开关',
    bottomHelpMessage: '允许用户联系主人',
    component: 'Switch'
  },
  {
    field: 'sendMaster.cd',
    label: '触发冷却',
    helpMessage: '主人不受限制',
    bottomHelpMessage: '单位：秒',
    component: 'InputNumber',
    required: true,
    componentProps: {
      min: 1,
      placeholder: '请输入冷却时间'
    }
  },
  {
    field: 'sendMaster.Master',
    label: '主人配置',
    helpMessage: '填主人QQ可发送某个指定主人',
    bottomHelpMessage: '0：仅发送首个主人 1：发送全部主人 QQ号：发送指定QQ号',
    component: 'Input',
    required: true,
    componentProps: {
      placeholder: '请输入主人QQ或配置项'
    }
  },
  {
    field: 'sendMaster.BotId',
    label: 'Bot配置',
    bottomHelpMessage: '指定某个Bot发送，为0时为触发Bot',
    component: 'Input',
    required: true,
    componentProps: {
      placeholder: '请输入Bot账号或配置项'
    }
  },
  {
    field: 'sendMaster.MsgTemplate',
    label: '通知消息模板',
    helpMessage: '发送给主人的消息模板',
    bottomHelpMessage: `支持的变量:
    key: 消息标识，用于回复消息时调用，如果不需要回复可以删掉
    avatar: 发送者头像
    platform: 平台信息
    user: 触发者信息
    gloup: 群聊信息 私聊时显示私聊
    bot: 触发Bot信息
    time: 发送时间
    msg: 消息内容`,
    component: 'InputTextArea',
    required: true,
    componentProps: {
      // readonly: true,
      // autosize: true,
      autosize: {
        minRows: 5,
        maxRows: 11
      }
    }
  },
  {
    field: 'sendMaster.successMsgTemplate',
    label: '成功发送回复文本',
    helpMessage: '发送成功后回复给用户的消息',
    bottomHelpMessage: `支持的变量:
    masterQQ 主人的QQ`,
    component: 'InputTextArea',
    required: true,
    componentProps: {
      autosize: {
        minRows: 1,
        maxRows: 10
      }
    }
  },
  {
    field: 'sendMaster.failsMsgTemplate',
    label: '发送失败回复文本',
    helpMessage: '发送失败后回复给用户的消息',
    bottomHelpMessage: `支持的变量:
    masterQQ 主人的QQ`,
    component: 'InputTextArea',
    required: true,
    componentProps: {
      autosize: {
        minRows: 1,
        maxRows: 10
      }
    }
  },
  {
    field: 'sendMaster.replyMsgTemplate',
    label: '回复消息文本',
    helpMessage: '主人回复时发送的消息',
    bottomHelpMessage: `支持的变量:
    nickname 主人昵称
    id 进行回复操作的主人账号
    msg 消息内容`,
    component: 'InputTextArea',
    required: true,
    componentProps: {
      autosize: {
        minRows: 1,
        maxRows: 10
      }
    }
  },
  {
    field: 'sendMaster.banWords',
    label: '违禁词',
    bottomHelpMessage: '当消息包含下列内容时将不会发送给主人',
    component: 'GTags',
    componentProps: {
      allowAdd: true,
      allowDel: true
    }
  },
  {
    field: 'sendMaster.banUser',
    label: '禁用用户',
    bottomHelpMessage: '不允许该用户联系主人',
    component: 'GTags',
    componentProps: {
      allowAdd: true,
      allowDel: true
    }
  },
  {
    field: 'sendMaster.banGroup',
    component: 'GSelectGroup',
    label: '禁用群',
    helpMessage: '不允许通过该群联系主人的群聊',
    componentProps: {
      placeholder: '点击选择要禁用的群'
    }
  }
]
