import { AsyncLocalStorage } from 'node:async_hooks'

let activeTasks = 0
let maintaining = false
let stopped = false
const idleListeners = new Set<() => void>()
const stopListeners = new Set<() => void>()
const taskContext = new AsyncLocalStorage<{ active: boolean }>()

/** 登记可能写入插件数据的任务；维护期间不再接受新任务。 */
export function enterPluginTask (): false | (() => void) {
  if ((maintaining || stopped) && !taskContext.getStore()?.active) return false
  activeTasks++
  let released = false
  return () => {
    if (released) return
    released = true
    activeTasks--
    if (!activeTasks) for (const notify of idleListeners) notify()
  }
}

/** 已接受任务中的截图、保存等嵌套操作仍可完成；维护期间拒绝独立的新任务。 */
export async function withPluginTask<T, B> (operation: () => Promise<T>, unavailable: () => B | Promise<B>): Promise<T | B> {
  const release = enterPluginTask()
  if (!release) return unavailable()
  const scope = { active: true }
  try {
    return await taskContext.run(scope, operation)
  } finally {
    scope.active = false
    release()
  }
}

/** 卸载开始后保持停止状态，直到进程重启；维护命令仍可重试。 */
export function stopPluginTasks () {
  stopped = true
  for (const dispose of stopListeners) dispose()
  stopListeners.clear()
}

/** 注册随插件卸载释放的资源；已经停止时立即释放。 */
export function onPluginStop (dispose: () => void) {
  if (stopped) dispose()
  else stopListeners.add(dispose)
}

/** 等待已有写入结束，再独占执行清理，避免删除后的数据被旧任务写回。 */
export async function withMaintenance<T> (operation: () => Promise<T>): Promise<T> {
  if (maintaining) throw new Error('已有数据维护任务正在进行，请稍后重试')
  maintaining = true
  try {
    if (activeTasks) {
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer)
          idleListeners.delete(done)
          resolve()
        }
        const timer = setTimeout(() => {
          idleListeners.delete(done)
          reject(new Error('插件任务尚未结束，本次操作已取消，请稍后重试'))
        }, 30_000)
        idleListeners.add(done)
      })
    }
    return await operation()
  } finally {
    maintaining = false
  }
}
