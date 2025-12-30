import type { GuobaSchemas } from '@/types/guoba'
import { apiHandlers } from '@/modules/picture'
import { FaceList } from '@/data'

export const Picture: GuobaSchemas = [
  {
    component: 'SOFT_GROUP_BEGIN',
    label: '随机图片配置'
  },
  {
    field: 'Picture.open',
    label: '随机图片开关',
    component: 'Switch'
  },
  {
    field: 'Picture.apiPicture',
    label: 'api图片开关',
    component: 'Switch',
    helpMessage: '看看腿、黑丝、白丝等'
  },
  {
    field: 'Picture.apiDisable',
    label: 'api图片禁用列表',
    bottomHelpMessage: '配置在这个列表里的图片功能不会被触发',
    component: 'Select',
    componentProps: {
      allowClear: true,
      mode: 'tags',
      get options () {
        return apiHandlers.map(i => ({ value: i.name }))
      }
    }
  },
  {
    field: 'Picture.facePicture',
    label: '随机表情功能开关',
    component: 'Switch',
    helpMessage: '戳一戳的表情包'
  },
  {
    field: 'Picture.faceDisable',
    label: '随机表情禁用列表',
    component: 'Select',
    componentProps: {
      allowClear: true,
      mode: 'tags',
      get options () {
        return FaceList.map(name => ({ value: name }))
      }
    }
  }
]
