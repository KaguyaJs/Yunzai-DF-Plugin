import { Data, logger } from '@/utils'
import { FacePath } from '@/dir'
import fs from 'node:fs'

/** 表情json数据 */
export const FaceJsonData = Data.getJSON<Record<string, string>>('json/FaceList.json', 'res')
/** 表情包类型列表 */
export const FaceList: string[] = Object.keys(FaceJsonData)
/**
 * 表情别名
 *
 * @example
 *{
 *  "name1": [ "别名1", "别名2", "别名3" ],
 *  "name2": [ "别名4" ],
 *  "name3": []
 *}
 */
export const FaceAlias: Record<string, string[]> = Object.fromEntries(
  Object.entries(FaceJsonData)
    .map(([key, value]) => [key, value ? value.split(',') : []])
)
/**
 * 表情别名反向索引
 *
 * @example
 * { "别名1": "name", "别名2": "name" }
 */
export const FaceAliasIndex: Record<string, string> = Object.fromEntries(
  Object.entries(FaceAlias)
    .flatMap(([k, a]) => a.map(v => [v, k]))
)

/** 载入用户自建表情文件夹 */
if (await Data.isDirectory(FacePath)) {
  try {
    (await fs.promises.readdir(FacePath, { withFileTypes: true }))
      .filter(dirent => dirent.isDirectory() && dirent.name !== '.git' && !dirent.name.startsWith('.'))
      .map(dirent => dirent.name)
      .forEach(name => {
        if (!FaceList.includes(name)) FaceList.push(name)
        FaceAlias[name] ??= []
      })
  } catch (err) {
    logger.warn('载入自建表情文件夹时发生错误:', err)
  }
}
