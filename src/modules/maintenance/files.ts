import fs from 'node:fs/promises'
import path from 'node:path'
import { FacePath, PluginName, PluginPath, YunzaiPath } from '@/dir'

export interface FileUsage {
  targets: { path: string, label: string, bytes: number }[]
  bytes: number
}

const yunzaiRoot = path.resolve(YunzaiPath)
const pluginRoot = path.resolve(PluginPath)
const viewDataRoot = path.join(yunzaiRoot, 'data', 'ViewData')

function within (root: string, target: string) {
  const relative = path.relative(root, target)
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function samePath (left: string, right: string) {
  return path.relative(left, right) === ''
}

function knownTargets () {
  if (!PluginName || PluginName !== path.basename(pluginRoot) ||
    !samePath(pluginRoot, path.join(yunzaiRoot, 'plugins', PluginName))) {
    throw new Error('插件目录不在预期的 plugins 路径中，已取消删除')
  }
  const gallery = path.resolve(FacePath)
  if (!samePath(gallery, path.join(pluginRoot, 'resources', 'poke'))) {
    throw new Error('图库目录不在预期的插件资源路径中，已取消删除')
  }
  return [
    { path: pluginRoot, label: '插件目录（含图库与依赖）', kind: 'directory' },
    { path: path.join(yunzaiRoot, 'config', `${PluginName}.yaml`), label: '插件配置', kind: 'file' },
    { path: path.join(yunzaiRoot, 'data', 'html', PluginName), label: '插件渲染数据', kind: 'directory' },
    { path: path.join(yunzaiRoot, 'temp', 'html', PluginName), label: '插件渲染缓存', kind: 'directory' },
    { path: gallery, label: '戳一戳图库', kind: 'directory' },
    { path: path.join(gallery, '.git'), label: '图库 Git 历史', kind: 'directory' }
  ]
}

async function statIfPresent (filename: string) {
  try {
    return await fs.lstat(filename)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/** 检查从磁盘根到目标的每一层，拒绝可能把清理范围指向其他目录的链接。 */
async function rejectPathLinks (target: string) {
  const root = path.parse(target).root
  let current = root
  const parts = path.relative(root, target).split(path.sep).filter(Boolean)
  for (const part of ['', ...parts]) {
    if (part) current = path.join(current, part)
    const stat = await statIfPresent(current)
    if (!stat) return
    if (stat.isSymbolicLink()) throw new Error(`清理路径包含符号链接，已取消删除：${current}`)
    if (!samePath(current, target) && !stat.isDirectory()) throw new Error(`清理路径的父级不是目录：${current}`)
  }
}

function isViewDataFile (target: string) {
  return samePath(path.dirname(target), viewDataRoot) && path.extname(target).toLowerCase() === '.json'
}

async function isOwnedViewData (target: string) {
  const stat = await statIfPresent(target)
  if (!stat) return false
  if (stat.isSymbolicLink() || !stat.isFile()) return false
  try {
    const data: unknown = JSON.parse(await fs.readFile(target, 'utf8'))
    return !!data && typeof data === 'object' && '_plugin' in data && data._plugin === PluginName
  } catch (error) {
    if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function validateTarget (filename: string) {
  if (!path.isAbsolute(filename)) throw new Error('清理目标必须使用绝对路径')
  const target = path.resolve(filename)
  const known = knownTargets().find(value => samePath(value.path, target))
  if (!within(yunzaiRoot, target) ||
    (!known && !isViewDataFile(target))) {
    throw new Error(`清理目标不属于本插件：${target}`)
  }
  await rejectPathLinks(target)
  const stat = await statIfPresent(target)
  if (stat && known && (known.kind === 'file' ? !stat.isFile() : !stat.isDirectory())) {
    throw new Error(`清理目标的文件类型不符，已取消删除：${target}`)
  }
  if (isViewDataFile(target) && stat && !await isOwnedViewData(target)) {
    throw new Error(`调试数据的归属已变化，已取消删除：${target}`)
  }
  return target
}

/** 统计文件的逻辑字节数，内部符号链接只计链接本身，不遍历链接目标。 */
async function countBytes (target: string): Promise<number> {
  const stat = await statIfPresent(target)
  if (!stat) return 0
  if (stat.isSymbolicLink() || !stat.isDirectory()) return stat.size
  let bytes = 0
  for (const name of await fs.readdir(target)) bytes += await countBytes(path.join(target, name))
  return bytes
}

async function inspectTargets (targets: { path: string, label: string }[]): Promise<FileUsage> {
  const result: FileUsage['targets'] = []
  for (const target of targets) {
    const filename = await validateTarget(target.path)
    result.push({ label: target.label, path: filename, bytes: await countBytes(filename) })
  }
  return { targets: result, bytes: result.reduce((sum, target) => sum + target.bytes, 0) }
}

/** 卸载仅清除插件专用路径，共享 ViewData 中逐个核实文件的插件标记。 */
export async function inspectUninstallFiles (): Promise<FileUsage> {
  const targets: { path: string, label: string }[] = knownTargets().slice(0, 4)
  await rejectPathLinks(viewDataRoot)
  const viewStat = await statIfPresent(viewDataRoot)
  if (viewStat) {
    if (!viewStat.isDirectory()) throw new Error('调试数据根路径不是目录，已取消卸载')
    for (const name of await fs.readdir(viewDataRoot)) {
      const filename = path.join(viewDataRoot, name)
      if (isViewDataFile(filename) && await isOwnedViewData(filename)) targets.push({ path: filename, label: '插件调试数据' })
    }
  }
  return inspectTargets(targets)
}

export async function inspectGalleryFiles (uninstall: boolean): Promise<FileUsage> {
  return inspectTargets([knownTargets()[uninstall ? 4 : 5]])
}

/** 全部预校验后再逐项复核和删除，最后才删除插件自身，失败直接向调用者报告。 */
export async function deletePluginFiles (requested: FileUsage['targets']): Promise<void> {
  const targets = Array.from(new Set(requested.map(target => path.resolve(target.path))))
  for (const target of requested) await validateTarget(target.path)
  targets.sort((left, right) => Number(samePath(left, pluginRoot)) - Number(samePath(right, pluginRoot)))
  for (const target of targets) {
    await validateTarget(target)
    await fs.rm(target, { recursive: true, force: true, maxRetries: 3 })
  }
}
