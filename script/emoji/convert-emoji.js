import fs from 'fs'
import path from 'path'

const URL = 'https://github.com/ricealexander/emoji-list/raw/main/emojis.json'

// 默认输出路径
const DEFAULT_OUTPUT_FILE = 'resources/json/Emoji.json'

// 命令行参数优先
const OUTPUT_FILE = process.argv[2] || DEFAULT_OUTPUT_FILE

async function main () {
  // 1. 下载 JSON
  const res = await fetch(URL)
  if (!res.ok) {
    throw new Error(`下载失败: ${res.status}`)
  }
  const emojis = await res.json()

  // 2. 转换格式
  const newResult = {}

  for (const item of emojis) {
    const unicodeEmoji = item.unicode
    if (!unicodeEmoji) continue
    if (!item.alias) continue
    const aliases = Array.isArray(item.alias) ? item.alias : [item.alias]
    for (const a of aliases) {
      const key = `:${a}:`
      if (newResult[key]) continue
      newResult[key] = unicodeEmoji
    }
  }
  console.log(
    'newResult 数量:',
    Object.keys(newResult).length
  )

  // 3. 读取旧文件（如果存在）
  let oldResult = {}
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      oldResult = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
    } catch (e) {
      console.warn('⚠️ 旧 JSON 解析失败，视为不存在')
    }
  }

  // 4. 合并 & 统计新增
  let addedCount = 0
  const merged = { ...oldResult }

  for (const [key, value] of Object.entries(newResult)) {
    if (!(key in oldResult)) {
      addedCount++
    }
    merged[key] = value
  }

  // 5. 确保目录存在
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })

  // 6. 写入文件
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(merged, null, 2),
    'utf8'
  )

  console.log(
    `转换完成：总计 ${Object.keys(merged).length} 个 alias，新增 ${addedCount} 个`
  )
}

main().catch(console.error)
