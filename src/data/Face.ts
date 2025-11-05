import { Data } from '@/utils'
import { FacePath } from '@/dir'
import fs from 'node:fs'

/** 表情json数据 */
const FaceJsonData = Data.getJSON<Record<string, string>>('json/FaceList.json', 'res')
/** 表情包类型列表 */
const FaceList: string[] = Object.keys(FaceJsonData)
/** 表情别名 */
const FaceAlias: Record<string, string[]> = Object.fromEntries(
  Object.entries(FaceJsonData).map(([key, value]) => [key, value ? value.split(',') : []])
)
/** 表情别名反向索引 */
const FaceAliasIndex: Record<string, string> = Object.fromEntries(Object.entries(FaceAlias).flatMap(([k, a]) => a.map(v => [v, k])))

/** 载入用户自建表情文件夹 */
void (async () => {
  if (!fs.existsSync(FacePath)) return
  try {
    const dirNames = (await fs.promises.readdir(FacePath, { withFileTypes: true }))
      .filter(dirent => dirent.isDirectory() && dirent.name !== '.git' && !dirent.name.startsWith('.'))
      .map(dirent => dirent.name)
    dirNames.forEach(name => !FaceList.includes(name) && FaceList.push(name))
  } catch { }
})()

export { FaceJsonData, FaceList, FaceAlias, FaceAliasIndex }
