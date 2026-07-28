import config from '@/config'

/**
 * 表情包接口地址，会自动去除尾部的斜杠
 *
 * @default 'https://ciallo.kaguya.fan'
 */
export const FaceApiHostName = (config.Poke.imageApi || 'https://ciallo.kaguya.fan').replace(/\/+$/, '')
