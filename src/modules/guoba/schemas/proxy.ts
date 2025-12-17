import type { GuobaSchemas } from '@/types/guoba'

export const proxy: GuobaSchemas = [
  {
    component: 'SOFT_GROUP_BEGIN',
    label: '代理配置'
  },
  {
    field: 'proxy.open',
    label: '是否代理部分请求',
    component: 'Switch'
  },
  {
    field: 'proxy.url',
    component: 'Input',
    label: '代理地址',
    helpMessage: '如: http://127.0.0.1:7890'
  }
]
