import fs from 'node:fs/promises'
import { AppsDir, PluginName } from '@/dir'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import chalk from 'chalk'

const moduleMap = new Map()
const startTime = Date.now()

type PackErr = Array<{
  file: {
    name: string
  }
  error: any
}>

export async function loadApps () {
  const apps: Record<string, any> = {}
  let succeed = 0
  let failed = 0
  const packageErr: PackErr = []
  try {
    const AppsFiles = await getJsFilePaths(AppsDir)
    await Promise.all(AppsFiles.map(async (file) => {
      try {
        let module = moduleMap.get(file)
        if (!module) {
          module = await import((pathToFileURL(file)).href)
          moduleMap.set(file, module)
        }
        for (const [key, value] of Object.entries(module)) {
          if (typeof value === 'function' && value.prototype) {
            if (!apps[key]) {
              apps[key] = value
              succeed++
            } else {
              logger.warn(`[${PluginName}] 已存在 class ${key} 同名导出: ${file}`)
              failed++
            }
          }
        }
      } catch (error: any) {
        const fileName = path.basename(file)
        if (error?.code === 'ERR_MODULE_NOT_FOUND') {
          // const pack = error?.stack?.match(/'(.+?)'/g)[0].replace(/'/g, '')
          // logger.error(`[${PluginName}] ${logger.yellow(fileName)} 缺少依赖 ${logger.red(pack)}`)
          packageErr.push({
            file: { name: fileName },
            error
          })
        } else {
          logger.error(`[${PluginName}] 载入 ${fileName} 错误：`, error)
        }
        failed++
      }
    }))
  } catch (error) {
    logger.error(`[${PluginName}] 载入插件时发生错误/(ㄒoㄒ)/~~`, error)
  }
  packageTips(packageErr)
  logSuccess(
    `${PluginName} 加载完成 (*^▽^*)`,
    `成功: ${succeed} 个`,
    failed > 0 ? `失败: ${failed}` : '没有失败 (～￣▽￣)~'
  )
  return {
    apps
  }
}

/**
 * 提取出文件夹中的所有js文件 (遍历)
 * @param dir 目录路径
 * @returns 文件夹内的所有js文件
 */
async function getJsFilePaths (dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true })
    const jsFiles = []
    for (const file of files) {
      const pathname = path.join(dir, file.name)
      if (file.isDirectory()) {
        jsFiles.push(...await getJsFilePaths(pathname))
      } else if (file.name.endsWith('.js')) {
        jsFiles.push(pathname)
      }
    }
    return jsFiles
  } catch (error: any) {
    logger.error('读取插件失败:', error)
    return []
  }
}

function logSuccess (...messages: any[]): void {
  const endTime = Date.now()
  const duration = endTime - startTime
  const border = '-'.repeat(30)
  logger.info(border)

  const colors = [
    chalk.cyanBright.bold,
    chalk.greenBright.bold,
    chalk.magentaBright.bold,
    chalk.yellowBright.bold
  ]

  messages.forEach((msg, i) => {
    const colorFn = colors[i % colors.length]
    logger.info(colorFn(msg))
  })

  logger.info(`✅  总耗时: ${duration} ms`)

  logger.info(border)
}

function packageTips (packageErr: PackErr): void {
  if (!packageErr.length) return
  logger.error(`--------- ${PluginName} 缺少依赖 ---------`)
  for (const i of packageErr) {
    const pack = i.error.stack.match(/'(.+?)'/g)[0].replace(/'/g, '')
    logger.error(`${logger.cyan(i.file.name)} 缺少 ${logger.red(pack)}`)
  }
  logger.error(`请使用 ${logger.red('pnpm install')} 安装依赖`)
  logger.error('如仍报错可将问题反馈给开发者')
  logger.error('--------------------------------')
}
