import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import _ from 'lodash'
import { YunzaiPath, PluginPath, ResPath } from '@/dir'
import { createHash } from 'node:crypto'

type RootType = 'root' | 'yunzai' | 'plugin' | 'res' | 'assets' | 'json'

/**
 * 获取根路径
 * @param root - 根路径类型
 * @returns 对应根路径字符串
 */
export function getRoot (root: RootType = 'plugin'): string {
  switch (root) {
    case 'root':
    case 'yunzai':
      return `${YunzaiPath}/`
    case 'res':
    case 'assets':
      return `${ResPath}/`
    case 'json':
      return `${ResPath}/json`
    case 'plugin':
    default:
      return `${PluginPath}/`
  }
}

/**
 * 统一路径解析函数：
 * - 若传入绝对路径，则直接返回；
 * - 若为相对路径，则拼接根路径。
 * @param file - 文件路径（可为绝对或相对路径）
 * @param root - 根路径类型（仅在相对路径时有效）
 * @returns 解析后的绝对路径
 */
function resolvePath (file: string, root: RootType = 'plugin'): string {
  return path.isAbsolute(file) ? file : path.resolve(getRoot(root), file)
}

/**
 * 通用数据与文件操作工具类
 */
export class Data {
  /** JSON 文件缓存 */
  private static JSONCache = new Map<string, any>()

  /**
   * 创建目录（递归），可选是否包含文件层级。
   * @param _path - 目录路径或文件路径（可为相对或绝对路径）
   * @param root - 根路径类型（仅在相对路径时有效）
   * @param includeFile - 是否将最后一级视为文件名（默认 false）
   * @example
   * Data.createDir('data/user/config.json', 'plugin', true)
   * Data.createDir('/tmp/mydir', undefined, false)
   */
  static createDir (_path = '', root: RootType = 'plugin', includeFile = false): void {
    const fullPath = resolvePath(_path, root)
    const dirPath = includeFile ? path.dirname(fullPath) : fullPath
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
  }

  /**
   * 同步读取 JSON。
   * @template T - JSON 数据类型
   * @param file - 文件路径（相对或绝对）
   * @param root - 根路径类型
   * @param cache - 是否缓存
   * @returns 解析后的对象，若失败返回空对象
   * @example
   * const cfg = Data.getJSON<{ port: number }>('config/server.json')
   */
  static getJSON<T = any> (file: string, root: RootType = 'plugin', cache = true): T {
    const filePath = resolvePath(file, root)
    if (cache && this.JSONCache.has(filePath)) return this.JSONCache.get(filePath)
    if (!fs.existsSync(filePath)) return {} as T

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      // delete data['$schema'] // 删除 schema
      if (cache) this.JSONCache.set(filePath, data)
      return data
    } catch (e) {
      logger.error('读取 JSON 文件错误', e)
      return {} as T
    }
  }

  /**
   * 异步读取 JSON 文件。
   * @template T - JSON 数据类型
   * @param file - 文件路径（相对或绝对）
   * @param root - 根路径类型
   * @returns Promise 解析为 JSON 对象，读取失败返回空对象
   */
  static async readJSON<T = any> (file: string, root: RootType = 'plugin'): Promise<T> {
    const filePath = resolvePath(file, root)
    try {
      const content = await fsp.readFile(filePath, 'utf8')
      return JSON.parse(content)
    } catch {
      return {} as T
    }
  }

  /**
   * 异步写入 JSON 文件（自动创建目录）。
   * @param file - 文件路径（相对或绝对）
   * @param data - 要写入的数据对象
   * @param root - 根路径类型
   * @param space - 缩进空格数（默认 2）
   * @returns 是否写入成功
   * @example
   * await Data.writeJSON('/tmp/test.json', { ok: true })
   */
  static async writeJSON (file: string, data: any, root: RootType = 'plugin', space = 2): Promise<boolean> {
    const filePath = resolvePath(file, root)
    try {
      this.createDir(filePath, root, true)
      await fsp.writeFile(filePath, JSON.stringify(data, null, space))
      this.JSONCache.set(filePath, data)
      return true
    } catch (err) {
      logger.error(err)
      return false
    }
  }

  /**
   * 异步获取 Redis 中存储的 JSON 数据。
   * @template T - JSON 数据类型
   * @param key - Redis 键名
   * @returns JSON 对象或空对象
   */
  static async getRedisJSON<T = any> (key: string): Promise<T> {
    try {
      const txt = await redis.get(key)
      return txt ? JSON.parse(txt) : ({} as T)
    } catch (e) {
      logger.error(e)
      return {} as T
    }
  }

  /**
   * 异步设置 Redis JSON 数据。
   * @param key - Redis 键名
   * @param data - 要存储的数据对象
   * @param EX - 过期时间（秒），默认 90 天
   */
  static async setRedisJSON (key: string, data: any, EX = 3600 * 24 * 90): Promise<void> {
    await redis.set(key, JSON.stringify(data), { EX })
  }

  /**
   * 动态导入 JS 模块。
   * @template T - 模块类型
   * @param file - 模块路径（相对或绝对，可省略 .js 后缀）
   * @param root - 根路径类型
   * @returns 模块对象或空对象
   * @example
   * const mod = await Data.importModule<{ init: () => void }>('utils/startup')
   */
  static async importModule<T = any> (file: string, root: RootType = 'plugin'): Promise<T> {
    const fullPath = resolvePath(file.endsWith('.js') ? file : `${file}.js`, root)
    if (!fs.existsSync(fullPath)) return {} as T

    try {
      const module = await import(`file://${fullPath}?t=${Date.now()}`)
      return (module as T) ?? ({} as T)
    } catch (e) {
      logger.error(e)
      return {} as T
    }
  }

  /**
   * 动态导入模块默认导出。
   * @template T - 默认导出类型
   * @param file - 模块路径
   * @param root - 根路径类型
   * @returns 模块默认导出或空对象
   * @example
   * const config = await Data.importDefault<{ name: string }>('config/default')
   */
  static async importDefault<T = any> (file: string, root?: RootType): Promise<T> {
    const mod = await this.importModule<{ default?: T }>(file, root)
    return mod.default ?? ({} as T)
  }

  /**
   * 递归读取指定目录下所有匹配后缀的文件。
   * 可排除某个子目录。
   * @param directory - 根目录路径（相对或绝对）
   * @param extension - 文件后缀（不带点）
   * @param excludeDir - 要排除的目录名
   * @returns 相对路径数组
   * @example
   * const files = Data.readDirRecursive('src', 'ts', 'node_modules')
   */
  static readDirRecursive (directory: string, extension: string, excludeDir?: string): string[] {
    const dirPath = resolvePath(directory)
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const results: string[] = []

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === excludeDir) continue
        const subFiles = this.readDirRecursive(fullPath, extension, excludeDir)
        results.push(...subFiles.map(f => path.join(entry.name, f)))
      } else if (path.extname(entry.name) === `.${extension}`) {
        results.push(entry.name)
      }
    }
    return results
  }

  /**
   * 异步任务池，限制并发执行数量。
   * @template T 输入数组元素类型
   * @template R 异步任务返回类型
   * @param limit - 最大并发数
   * @param array - 任务输入数组
   * @param iteratorFn - 异步处理函数
   * @returns Promise，结果数组顺序与输入一致
   * @example
   * await Data.asyncPool(5, urls, async url => fetch(url))
   */
  static async asyncPool<T, R> (
    limit: number,
    array: T[],
    iteratorFn: (item: T, array: T[]) => Promise<R>
  ): Promise<R[]> {
    const results: Promise<R>[] = []
    const executing: Promise<any>[] = []

    for (const item of array) {
      const p = Promise.resolve().then(() => iteratorFn(item, array))
      results.push(p)

      if (limit <= array.length) {
        const e = p.finally(() => executing.splice(executing.indexOf(e), 1))
        executing.push(e)
        if (executing.length >= limit) await Promise.race(executing)
      }
    }

    return Promise.all(results)
  }

  /**
   * 延迟指定毫秒数。
   * @param ms - 毫秒数
   * @returns Promise<void>
   */
  static sleep (ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取第一个非 undefined 的值。
   * @param args - 候选值列表
   * @returns 第一个非 undefined 值
   */
  static def<T> (...args: (T | undefined)[]): T | undefined {
    return args.find(v => !_.isUndefined(v))
  }

  /**
   * 遍历字符串或数组，按分隔符（,；；、，）分割并执行回调。
   * @param arr - 字符串、数字或字符串数组
   * @param fn - 回调函数 (str, idx)
   * @example
   * Data.eachStr('A,B,C', console.log)
   */
  static eachStr (arr: string | number | string[], fn: (str: string, idx: number) => void): void {
    let list: string[]
    if (typeof arr === 'string') {
      list = arr.replace(/\s*(;|；|、|，)\s*/g, ',').split(',')
    } else if (typeof arr === 'number') {
      list = [arr.toString()]
    } else {
      list = arr
    }
    list.forEach((str, idx) => fn(str.trim?.() ?? str, idx))
  }

  /**
   * 正则匹配并返回指定索引的值。
   * @param reg - 正则表达式对象
   * @param txt - 待匹配文本
   * @param idx - 捕获组索引
   * @returns 匹配内容或 false
   * @example
   * Data.regRet(/user:(\\w+)/, 'user:alice', 1) // => "alice"
   */
  static regRet (reg: RegExp, txt: string, idx: number): string | false {
    const ret = reg.exec(txt)
    return ret?.[idx] ?? false
  }

  /**
   * 判断指定路径是否存在
   * @param path 路径
   * @returns 是否存在
   */
  static async exists (path: string): Promise<boolean> {
    try {
      await fsp.access(path, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * 判断路径是否存在并为文件夹
   * @param path 路径
   * @returns 是否存在并为文件夹
   */
  static async isDirectory (path: string) {
    try {
      const info = await fsp.stat(path)
      return info.isDirectory()
    } catch {
      return false
    }
  }

  static stableStringify (obj: any, cache = new WeakMap()): string {
    // 原始类型直接返回
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj)
    }

    // 如果缓存中已有，直接返回
    if (cache.has(obj)) {
      return cache.get(obj)!
    }

    let result: string

    if (Array.isArray(obj)) {
      result = '[' + obj.map(item => this.stableStringify(item, cache)).join(',') + ']'
    } else {
      const keys = Object.keys(obj).sort()
      const keyValuePairs = keys.map(k => `"${k}":${this.stableStringify(obj[k], cache)}`)
      result = '{' + keyValuePairs.join(',') + '}'
    }

    cache.set(obj, result)
    return result
  }

  /**
   * 根据 Set 生成唯一 key
   */
  static getSetKey (set: Set<any>): string {
    const arr = Array.from(set)
    const cache = new WeakMap()

    const stableStrings = arr.map(obj => this.stableStringify(obj, cache))

    stableStrings.sort((a, b) => a.localeCompare(b))

    return createHash('sha256').update(JSON.stringify(stableStrings)).digest('hex')
  }
}

export default Data
