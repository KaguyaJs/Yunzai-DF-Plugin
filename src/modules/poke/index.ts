import _ from 'lodash'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Data } from '@/utils'
import { FaceApiHostName } from '@/constants'
import { FacePath } from '@/dir'

export async function randomFile (dirPath: string): Promise<string | null> {
  if (!await Data.isDirectory(dirPath)) return null
  const files = (await fs.readdir(dirPath, { withFileTypes: true }))
    .filter(i => i.isFile())
    .map(i => path.join(dirPath, i.name))

  if (files.length < 1) return null

  return _.sample(files) ?? null
}

/**
 * 获取表情戳一戳
 * @param name 表情名称
 * @returns 图片路径或api
 */
export async function FacePoke (name: string): Promise<string> {
  if (!name) throw new Error('表情属性为空，请检查表情黑名单或表情列表是否正确')
  const Path = path.join(FacePath, name)
  const file = await randomFile(Path)
  return file ?? `https://${FaceApiHostName}/?name=${name}`
}
