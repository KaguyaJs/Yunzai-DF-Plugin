import config from '@/config'

/**
 * 获取配置中各平台对应token
 * @returns 平台对应token
 */
export const getTokens = () => Object.fromEntries(config.CodeUpdate.repos.map(({ provider, token }) => [provider, token]))

/**
 * 获取指定平台的token
 * @param provider 平台标识符
 * @returns token
 */
export const getToken = (provider: string) => getTokens()[provider] || ''
