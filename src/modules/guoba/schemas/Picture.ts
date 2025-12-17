import type { GuobaSchemas } from '@/types/guoba'

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
    field: 'Picture.Direct',
    label: '是否去除 #来张/随机 前缀',
    component: 'Switch'
  }
]
