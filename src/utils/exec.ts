import { exec as _exec } from 'node:child_process'
import { createTimer } from './time'

/**
 * 指定目录运行命令
 * @param cmd 命令
 * @param cwd 工作目录
 * @param quiet 安静输出
 * @throws 命令执行失败
 * @returns 运行结果
 */
export async function exec (cmd: string, cwd?: string, quiet = false): Promise<string> {
  if (Bot.exec) {
    const { error, stdout } = await Bot.exec(cmd, { cwd, quiet })
    if (error) throw error
    return stdout
  } else {
    return new Promise((resolve, reject) => {
      logger[quiet ? 'debug' : 'mark'](`[执行命令] ${logger.red(cmd)}`)
      const timer = createTimer()
      timer.start()
      _exec(cmd, { cwd }, (err, out) => (err ? reject(err) : resolve(String(out).trim())))
      logger[quiet ? 'debug' : 'mark'](`[命令执行完成] ${logger.red(cmd)} 耗时: ${timer.end()}}`)
    })
  }
}
