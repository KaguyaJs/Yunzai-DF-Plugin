import version from './version'

/**
 * 日志工具，针对TRSS做输出优化
*/
let logger = {} as typeof global.logger

const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'mark'] as const

if (version.isTRSS && typeof Bot.makeLog === 'function') {
  levels.forEach(level => {
    logger[level] = (...args: any[]) => Bot.makeLog(level, args, 'DF')
  })
  Object.setPrototypeOf(logger, global.logger)
} else {
  logger = global.logger
}

export {
  logger
}

export default logger
