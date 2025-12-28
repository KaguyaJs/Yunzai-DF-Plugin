import type { GuobaSchemas } from '@/types/guoba'
import { FaceList } from '@/data'

export const Poke: GuobaSchemas = [
  {
    component: 'SOFT_GROUP_BEGIN',
    label: '戳一戳配置'
  },
  {
    field: 'Poke.chuo',
    label: '戳一戳开关',
    component: 'Switch'
  },
  {
    field: 'Poke.mode',
    label: '戳一戳模式',
    component: 'Select',
    componentProps: {
      placeholder: '请选择戳一戳的触发模式',
      mode: 'combobox',
      options: [
        { label: '图片', value: 'image' },
        { label: '文本', value: 'text' },
        { label: '图片 + 文本', value: 'mix' },
        { label: '随机', value: 'random' }
      ]
    },
    required: true
  },
  {
    component: 'Divider',
    label: '图片配置'
  },
  {
    field: 'Poke.imageType',
    label: '戳一戳图片类型',
    bottomHelpMessage: '自定义图片需在resources/poke/default中添加',
    component: 'RadioGroup',
    required: true,
    componentProps: {
      get options () {
        return [
          { label: '随机类型', value: 'all' },
          ...FaceList.map((name, id) => ({ label: name, value: id }))
        ]
      }
    }
  },
  {
    field: 'Poke.imageBlack',
    label: '随机类型排除列表',
    bottomHelpMessage: '设置戳一戳类型为随机时将不会随机到以下类型',
    component: 'Select',
    componentProps: {
      allowClear: true,
      mode: 'tags',
      get options () {
        return FaceList.map((name) => ({ value: name }))
      }
    }
  },
  {
    field: 'Poke.imageApi',
    label: '戳一戳图片Api域名',
    bottomHelpMessage: '戳一戳api域名, 无特殊情况建议留空',
    component: 'Input'
  },
  {
    component: 'Divider',
    label: '文字配置'
  },
  {
    field: 'Poke.textMode',
    label: '文字戳一戳类型',
    component: 'RadioGroup',
    componentProps: {
      options: [
        { label: '一言', value: 'hitokoto' },
        { label: '自定义文字列表', value: 'text' }
      ]
    },
    required: true
  },
  {
    field: 'Poke.textList',
    label: '自定义文本列表',
    component: 'GTags',
    componentProps: {
      allowAdd: true,
      allowDel: true,
      showPrompt: true
    }
  }
]
