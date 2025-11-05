import { minify } from 'terser'
import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'

const ROOT = path.resolve(process.argv[2] || 'lib')

// 格式化大小
function formatSize (bytes) {
  if (bytes < 1024) return `${bytes.toFixed(2)} B`
  const kb = bytes / 1024
  return `${kb.toFixed(2)} KB`
}

// 右侧补空格
function padRight (str, width) {
  return str + ' '.repeat(Math.max(0, width - str.length))
}

// 收集所有 js 文件
async function collectFiles (dir, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(full, result)
    } else if (full.endsWith('.js')) {
      result.push(full)
    }
  }
  return result
}

async function main () {
  const startTime = performance.now()

  const files = await collectFiles(ROOT)
  const info = []

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8')
    const before = Buffer.byteLength(code)

    const result = await minify(code, {
      ecma: 2022,
      compress: true,
      mangle: true,
      module: true,
      format: { comments: false }
    })

    fs.writeFileSync(file, result.code, 'utf8')
    const after = Buffer.byteLength(result.code)

    info.push({
      file: path.relative(process.cwd(), file),
      before,
      after,
      size: formatSize(after)
    })
  }

  // 最大列宽
  const maxFileLen = Math.max(...info.map(i => i.file.length)) + 2
  const maxSizeLen = Math.max(...info.map(i => i.size.length)) + 2

  console.log()

  for (const item of info) {
    const diff = (1 - item.after / item.before) * 100

    const left = chalk.green('MINIFY ') + padRight(item.file, maxFileLen)
    const size = chalk.green(padRight(item.size, maxSizeLen))

    let percent
    if (diff >= 0) {
      percent = chalk[diff === 0 ? 'yellow' : 'blue'](`${diff.toFixed(2)}%`)
    } else {
      percent = chalk.red(`${Math.abs(diff).toFixed(2)}%`)
    }

    console.log(left + size + percent)
  }

  console.log()
  console.log(chalk.green(`⚡️ Minify success ${(performance.now() - startTime).toFixed(2)} ms`))
  console.log()
}

main()
