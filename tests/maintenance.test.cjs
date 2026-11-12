const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { createMaintenanceHarness, plain } = require('./helpers/maintenance.cjs')

const destructive = h => h.actions.filter(action => ['remove-redis', 'remove-file', 'unload-plugin', 'restart'].includes(action.kind))
const replies = event => event.replies.map(message => typeof message === 'string' ? message : JSON.stringify(message)).join('\n')

function deferred () {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function appEvent (h, message, changes) {
  const { DFUpdate } = h.load('@/apps/update')
  const app = new DFUpdate()
  const event = h.event(message, changes)
  app.e = event
  return { app, event }
}

async function confirm (h, original, message, changes) {
  // Yunzai creates a new handler instance; confirmation state must live on the original event.
  const current = appEvent(h, message, changes)
  await current.app.confirmMaintenance(original)
  return current
}

function populatedFiles (h) {
  const config = h.file(path.join(h.yunzaiPath, 'config', `${h.pluginName}.yaml`), 'fixture: true\n')
  const data = h.file(path.join(h.yunzaiPath, 'data', 'html', h.pluginName, 'index.html'), 'render-data')
  const rendered = h.file(path.join(h.yunzaiPath, 'temp', 'html', h.pluginName, 'index.png'), 'render-image')
  const debug = h.file(path.join(h.yunzaiPath, 'data', 'ViewData', 'index.json'), JSON.stringify({ _plugin: h.pluginName, content: 'own debug' }))
  const foreignDebug = h.file(path.join(h.yunzaiPath, 'data', 'ViewData', 'foreign.json'), JSON.stringify({ _plugin: 'other-plugin' }))
  const foreignConfig = h.file(path.join(h.yunzaiPath, 'config', 'other-plugin.yaml'), 'keep: true\n')
  const foreignHtml = h.file(path.join(h.yunzaiPath, 'temp', 'html', 'other-plugin', 'index.html'), 'keep')
  const image = h.file(path.join(h.facePath, 'one.png'), 'fixture-image')
  const history = h.file(path.join(h.facePath, '.git', 'objects', 'one'), 'git-history')
  return { config, data, rendered, debug, foreignDebug, foreignConfig, foreignHtml, image, history }
}

test('Redis统计使用SCAN去重和MEMORY字节数，过期键不会虚增占用', async () => {
  const h = createMaintenanceHarness()
  h.store.set('DF:CodeUpdate:first', 'small')
  h.store.set('DF:contact:second', 'large')
  h.store.set('Other:keep', 'foreign')
  h.scanPages = {
    0: { cursor: 2, keys: ['DF:CodeUpdate:first', 'DF:expired'] },
    2: { cursor: 0, keys: ['DF:CodeUpdate:first', 'DF:contact:second'] }
  }
  h.memoryCosts.set('DF:CodeUpdate:first', 1024)
  h.memoryCosts.set('DF:contact:second', 4096)
  const usage = plain(await h.load('@/modules/maintenance/redis').inspectRedis())
  assert.equal(usage.mode, 'memory')
  assert.equal(usage.bytes, 5120)
  assert.deepEqual(usage.keys.sort(), ['DF:CodeUpdate:first', 'DF:contact:second'])
  assert.equal(usage.unknownKeys, 0)
  assert.equal(h.redisCalls.filter(call => call.method === 'scan').length, 2)
  assert.ok(h.redisCalls.filter(call => call.method === 'scan').every(call => call.options.MATCH === 'DF:*'))
  assert.deepEqual(destructive(h), [])
})

test('MEMORY受限时统一标注有效负载字节，中文和emoji按UTF-8计量；网络失败不伪报成功', async () => {
  const h = createMaintenanceHarness()
  h.store.set('DF:text', '中文😀')
  h.store.set('DF:hash', 'not-a-string')
  h.redisTypes.set('DF:hash', 'hash')
  h.memoryError = new Error('NOPERM this user has no permissions to run MEMORY')
  const api = h.load('@/modules/maintenance/redis')
  const usage = plain(await api.inspectRedis())
  assert.equal(usage.mode, 'payload')
  assert.equal(usage.bytes, Buffer.byteLength('中文😀'))
  assert.equal(usage.unknownKeys, 1)
  assert.equal(usage.keys.length, 2)
  assert.equal(api.formatBytes(1024), '1.00 KiB')
  h.memoryError = new Error('ECONNRESET')
  await assert.rejects(api.inspectRedis(), /ECONNRESET/)
  assert.deepEqual(destructive(h), [])
})

test('SCAN游标停滞或返回外部命名空间时拒绝接受不完整范围', async () => {
  for (const pages of [
    { 0: { cursor: 5, keys: ['DF:a'] }, 5: { cursor: 5, keys: ['DF:a'] } },
    { 0: { cursor: 0, keys: ['DF:a', 'DF-other:foreign'] } }
  ]) {
    const h = createMaintenanceHarness()
    h.scanPages = pages
    await assert.rejects(h.load('@/modules/maintenance/redis').listPluginRedisKeys())
    assert.deepEqual(destructive(h), [])
  }
})

test('Redis清理先校验整个范围再分批UNLINK，兼容旧服务器DEL且保留其他插件键', async () => {
  const h = createMaintenanceHarness()
  const keys = Array.from({ length: 451 }, (_, index) => `DF:item:${index}`)
  for (const key of keys) h.store.set(key, 'value')
  h.store.set('DF-other:keep', 'foreign')
  const api = h.load('@/modules/maintenance/redis')
  await assert.rejects(api.deletePluginRedis([...keys, 'DF-other:keep']))
  assert.equal(h.store.size, 452)
  assert.deepEqual(destructive(h), [])
  h.unlinkError = new Error("ERR unknown command 'UNLINK'")
  assert.equal(await api.deletePluginRedis([...keys, keys[0]]), keys.length)
  assert.deepEqual([...h.store], [['DF-other:keep', 'foreign']])
  const deletes = h.redisCalls.filter(call => call.method === 'del')
  assert.ok(deletes.length > 1)
  assert.ok(deletes.every(call => call.keys.length <= 200 && call.keys.every(key => key.startsWith('DF:'))))
})

test('卸载统计覆盖配置和两种渲染缓存，共享调试文件只认本插件标记', async () => {
  const h = createMaintenanceHarness()
  const files = populatedFiles(h)
  const outside = h.file(path.join(h.yunzaiPath, 'shared', 'huge.bin'), 'x'.repeat(5000))
  const link = h.symlink(path.join(h.pluginPath, 'linked-library'), path.dirname(outside))
  const api = h.load('@/modules/maintenance/files')
  const usage = plain(await api.inspectUninstallFiles())
  const targets = usage.targets.map(target => target.path)
  for (const required of [h.pluginPath, files.config, path.dirname(files.data), path.dirname(files.rendered), files.debug]) assert.ok(targets.includes(required), required)
  assert.ok(!targets.includes(files.foreignDebug))
  assert.ok(!targets.includes(path.dirname(files.debug)))
  const expected = [...h.nodes].filter(([name, node]) => node.type !== 'directory' &&
    (name.startsWith(`${h.pluginPath}${path.sep}`) || [files.config, files.data, files.rendered, files.debug].includes(name)))
    .reduce((sum, [, node]) => sum + node.size, 0)
  assert.equal(usage.bytes, expected)
  assert.ok(usage.bytes < 5000, '链接目标内容不能被统计或遍历')
  assert.ok(h.nodes.has(link))
  assert.deepEqual(destructive(h), [])
  await api.deletePluginFiles(usage.targets)
  assert.equal(h.actions.filter(action => action.kind === 'remove-file').at(-1).path, h.pluginPath)
  for (const retained of [files.foreignDebug, files.foreignConfig, files.foreignHtml, outside]) assert.ok(h.nodes.has(retained), retained)
})

test('删除前完整预校验路径，拒绝外部目录、符号链接父级和调试文件归属变化', async () => {
  const h = createMaintenanceHarness()
  const files = populatedFiles(h)
  const api = h.load('@/modules/maintenance/files')
  const usage = plain(await api.inspectUninstallFiles())
  await assert.rejects(api.deletePluginFiles([...usage.targets, { path: h.yunzaiPath, label: 'invalid', bytes: 0 }]))
  assert.deepEqual(destructive(h), [])
  h.file(files.debug, JSON.stringify({ _plugin: 'now-another-plugin' }))
  await assert.rejects(api.deletePluginFiles(usage.targets), /归属/)
  assert.deepEqual(destructive(h), [])
  h.file(files.debug, JSON.stringify({ _plugin: h.pluginName }))
  h.nodes.delete(files.config)
  h.directory(files.config)
  h.file(path.join(files.config, 'unexpected-child'), 'keep')
  await assert.rejects(api.deletePluginFiles(usage.targets), /类型/)
  assert.deepEqual(destructive(h), [])
  h.file(files.config, 'fixture: true\n')
  const external = h.directory(path.join(h.yunzaiPath, 'external-cache'))
  h.symlink(path.join(h.yunzaiPath, 'temp', 'html'), external)
  await assert.rejects(api.deletePluginFiles(usage.targets), /链接/)
  assert.deepEqual(destructive(h), [])
})

test('维护锁等待已有写任务结束并阻止新任务，失败后释放，卸载停用后仍可重试维护', async () => {
  const h = createMaintenanceHarness()
  const lifecycle = h.load('@/utils/lifecycle')
  const release = lifecycle.enterPluginTask()
  const order = []
  const cleaning = lifecycle.withMaintenance(async () => { order.push('clean') })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(order, [])
  assert.equal(lifecycle.enterPluginTask(), false)
  await assert.rejects(lifecycle.withMaintenance(async () => {}), /维护/)
  order.push('write-finished')
  release()
  release() // A release callback can safely be reached through multiple finally paths.
  await cleaning
  assert.deepEqual(order, ['write-finished', 'clean'])
  await assert.rejects(lifecycle.withMaintenance(async () => { throw new Error('fixture failure') }), /fixture failure/)
  const next = lifecycle.enterPluginTask()
  assert.equal(typeof next, 'function')
  next()
  lifecycle.stopPluginTasks()
  assert.equal(lifecycle.enterPluginTask(), false)
  await lifecycle.withMaintenance(async () => { order.push('retry') })
  assert.equal(order.at(-1), 'retry')
})

test('维护等待时旧任务await后的嵌套写入可完成，新任务仍被阻止', async () => {
  const h = createMaintenanceHarness()
  const lifecycle = h.load('@/utils/lifecycle')
  const resume = deferred()
  const order = []
  const original = lifecycle.withPluginTask(async () => {
    order.push('original-start')
    await resume.promise
    const screenshot = await lifecycle.withPluginTask(async () => {
      await new Promise(resolve => setImmediate(resolve))
      order.push('screenshot')
      return 'image'
    }, () => 'rejected')
    assert.equal(screenshot, 'image')
    await lifecycle.withPluginTask(async () => {
      const release = lifecycle.enterPluginTask()
      assert.equal(typeof release, 'function')
      try { order.push('config-save') } finally { release() }
    }, () => { assert.fail('旧任务内的配置保存不能被维护拒绝') })
    order.push('original-end')
    return 'completed'
  }, () => 'rejected')
  const cleaning = lifecycle.withMaintenance(async () => { order.push('clean') })
  assert.equal(lifecycle.enterPluginTask(), false)
  assert.equal(await lifecycle.withPluginTask(async () => { assert.fail('新的写任务不可进入') }, () => 'blocked'), 'blocked')
  assert.deepEqual(order, ['original-start'])
  resume.resolve()
  assert.equal(await original, 'completed')
  await cleaning
  assert.deepEqual(order, ['original-start', 'screenshot', 'config-save', 'original-end', 'clean'])
})

test('父任务已结束的遗留异步回调不能继承旧任务在维护期间的写入权限', async () => {
  const h = createMaintenanceHarness()
  const lifecycle = h.load('@/utils/lifecycle')
  const invokeLate = deferred()
  const maintenanceEntered = deferred()
  const finishMaintenance = deferred()
  let late
  await lifecycle.withPluginTask(async () => {
    late = (async () => {
      await invokeLate.promise
      assert.equal(lifecycle.enterPluginTask(), false)
      return lifecycle.withPluginTask(async () => { assert.fail('父任务结束后不得越过维护锁') }, () => 'blocked')
    })()
  }, () => { assert.fail('初始任务应当被接纳') })
  const cleaning = lifecycle.withMaintenance(async () => {
    maintenanceEntered.resolve()
    await finishMaintenance.promise
  })
  await maintenanceEntered.promise
  try {
    invokeLate.resolve()
    assert.equal(await late, 'blocked')
  } finally {
    finishMaintenance.resolve()
    await cleaning
  }
  assert.equal(await lifecycle.withPluginTask(async () => 'ready', () => 'blocked'), 'ready')
})

test('维护命令限制主人；Redis统计为只读并显示数量、内存与有效负载口径', async () => {
  const h = createMaintenanceHarness()
  h.store.set('DF:CodeUpdate:a', '中文')
  h.memoryCosts.set('DF:CodeUpdate:a', 2048)
  for (const method of ['redisStats', 'clearRedis', 'clear', 'uninstall', 'removeImg']) {
    const { app, event } = appEvent(h, '#DFRedis统计', { isMaster: false })
    await app[method](event)
    assert.equal(h.contexts.size, 0)
    assert.deepEqual(destructive(h), [])
  }
  const { app, event } = appEvent(h, '#DFRedis统计')
  for (const method of ['redisStats', 'clearRedis', 'clear', 'uninstall', 'removeImg']) {
    const rules = app.rule.filter(rule => rule.fnc === method)
    assert.ok(rules.length && rules.every(rule => rule.permission === 'master'), method)
  }
  await app.redisStats(event)
  assert.match(replies(event), /1/)
  assert.match(replies(event), /2\.00 KiB/)
  assert.match(replies(event), /内存/)
  h.memoryError = new Error("ERR unknown command 'MEMORY'")
  await app.redisStats(event)
  assert.match(replies(event), /有效负载|估算|数据大小/)
  assert.equal(h.contexts.size, 0)
  assert.deepEqual(destructive(h), [])
})

test('清空Redis先提示大小并保存上下文，取消或超时不删除', async () => {
  for (const expired of [false, true]) {
    const h = createMaintenanceHarness()
    h.store.set('DF:contact:one', 'value')
    h.memoryCosts.set('DF:contact:one', 1024)
    const { app, event } = appEvent(h, '#DF清空Redis')
    await app.clearRedis(event)
    assert.match(replies(event), /1\.00 KiB/)
    assert.match(replies(event), /确认清空Redis/)
    assert.ok(event.dfMaintenance)
    assert.equal(h.contexts.size, 1)
    assert.deepEqual(destructive(h), [])
    if (expired) h.setNow('2026-11-12T08:03:00Z')
    const current = await confirm(h, event, expired ? '#确认清空Redis' : '算了')
    assert.match(replies(current.event), /取消|超时/)
    assert.equal(h.contexts.size, 0)
    assert.equal(h.store.size, 1)
    assert.deepEqual(destructive(h), [])
  }
})

test('确认绑定原主人、机器人与会话，跨用户跨机器人跨群不能删除，重复确认仅执行一次', async () => {
  const h = createMaintenanceHarness()
  h.store.set('DF:one', 'value')
  h.store.set('Other:keep', 'foreign')
  const { app, event } = appEvent(h, '#DF清空Redis')
  await app.clearRedis(event)
  for (const changes of [{ user_id: 201 }, { self_id: 101 }, { group_id: 301 }, { isGroup: false, group_id: undefined }, { isGroup: false, group_id: 300 }]) {
    await confirm(h, event, '#确认清空Redis', changes)
    assert.equal(h.store.size, 2)
    assert.deepEqual(destructive(h), [])
  }
  await Promise.all([confirm(h, event, '#确认清空Redis'), confirm(h, event, '#确认清空Redis')])
  const calls = destructive(h).length
  assert.ok(calls > 0)
  await confirm(h, event, '#确认清空Redis')
  assert.equal(destructive(h).length, calls)
  assert.deepEqual([...h.store], [['Other:keep', 'foreign']])
})

test('确认前失去主人权限会结束上下文并保留数据', async () => {
  const h = createMaintenanceHarness()
  h.store.set('DF:one', 'value')
  const { app, event } = appEvent(h, '#DF清空Redis')
  await app.clearRedis(event)
  const current = await confirm(h, event, '#确认清空Redis', { isMaster: false })
  assert.match(replies(current.event), /主人|取消/)
  assert.equal(h.contexts.size, 0)
  assert.equal(event.dfMaintenance, undefined)
  assert.equal(h.store.size, 1)
  assert.deepEqual(destructive(h), [])
})

test('无效记录确认时重新检查有效键，分支失败与数据统计失败均不执行删除', async () => {
  const h = createMaintenanceHarness()
  const active = 'DF:CodeUpdate:GitHub:owner/repo:main'
  const stale = 'DF:CodeUpdate:GitHub:owner/old:main'
  const nowActive = 'DF:CodeUpdate:GitHub:owner/new:main'
  for (const key of [active, stale, nowActive]) h.store.set(key, 'value')
  h.activeKeys = [active]
  const first = appEvent(h, '#DF清理无效数据')
  h.failActive = true
  await first.app.clear(first.event)
  assert.equal(h.contexts.size, 0)
  assert.deepEqual(destructive(h), [])
  h.failActive = false
  const second = appEvent(h, '#DF清理无效数据')
  await second.app.clear(second.event)
  h.activeKeys.push(nowActive)
  await confirm(h, second.event, '#确认清理')
  assert.deepEqual([...h.store.keys()].sort(), [active, nowActive].sort())
  const failed = appEvent(h, '#DF清理无效数据')
  h.activeKeys = []
  await failed.app.clear(failed.event)
  h.failActive = true
  await confirm(h, failed.event, '#确认清理')
  assert.equal(h.store.size, 2)
  assert.equal(h.contexts.size, 0)
  h.failActive = false
  h.memoryError = new Error('connection lost')
  const sizeFailed = appEvent(h, '#DF清空Redis')
  await sizeFailed.app.clearRedis(sizeFailed.event)
  assert.equal(h.contexts.size, 0)
  assert.equal(h.store.size, 2)
})

test('清空包含迁移标记和联系主人记录，确认前新增的本插件键也清理，其他键保留', async () => {
  const h = createMaintenanceHarness()
  for (const key of ['DF:CodeUpdate:repo', 'DF:ConfigMigration:CodeUpdate:v2', 'DF:contact:cd', 'Other:keep']) h.store.set(key, 'value')
  const { app, event } = appEvent(h, '#DF清空Redis')
  await app.clearRedis(event)
  h.store.set('DF:contact:new', 'new data')
  const current = await confirm(h, event, '#确认清空Redis')
  assert.deepEqual([...h.store], [['Other:keep', 'value']])
  assert.match(replies(current.event), /清理|清空/)
  assert.equal(h.contexts.size, 0)
  const release = h.load('@/utils/lifecycle').enterPluginTask()
  assert.equal(typeof release, 'function')
  release()
})

test('清空后复查发现其他实例新写入时报告残余数量，不误报全部成功', async () => {
  const h = createMaintenanceHarness()
  h.store.set('DF:one', 'payload')
  h.store.set('Other:keep', 'foreign')
  const { app, event } = appEvent(h, '#DF清空Redis')
  await app.clearRedis(event)
  const unlink = h.redis.unlink
  h.redis.unlink = async (...args) => {
    const count = await unlink(...args)
    h.store.set('DF:external-writer', 'new payload')
    return count
  }
  const current = await confirm(h, event, '#确认清空Redis')
  assert.match(replies(current.event), /已删除1个Redis键.*仍有1个插件键/s)
  assert.doesNotMatch(replies(current.event), /已清空/)
  assert.deepEqual([...h.store.keys()].sort(), ['DF:external-writer', 'Other:keep'])
  assert.equal(h.contexts.size, 0)
})

test('清理已完成而首次结果通知失败时只重发成功结果，不重复删除或误报操作失败', async () => {
  for (const [method, message, confirmation] of [
    ['clear', '#DF清理无效数据', '#确认清理'],
    ['clearRedis', '#DF清空Redis', '#确认清空Redis'],
    ['removeImg', '#DF卸载图库', '#确认卸载图库']
  ]) {
    const h = createMaintenanceHarness()
    populatedFiles(h)
    h.store.set('DF:CodeUpdate:obsolete', 'value')
    const { app, event } = appEvent(h, message)
    await app[method](event)
    const delivered = []
    let attempts = 0
    await confirm(h, event, confirmation, {
      replies: delivered,
      reply: async message => {
        if (++attempts === 1) throw new Error('fixture notification failed')
        delivered.push(message)
        return true
      }
    })
    assert.equal(attempts, 2, method)
    assert.equal(destructive(h).length, 1, method)
    assert.match(delivered.join('\n'), /成功清理|已清空|已卸载/, method)
    assert.doesNotMatch(delivered.join('\n'), /操作失败/, method)
    assert.equal(method === 'removeImg' ? h.nodes.has(h.facePath) : h.store.size > 0, false, method)
    assert.equal(h.contexts.size, 0, method)
  }
})

test('卸载在确认前只统计大小；确认后清理专用数据、最后删除插件、注销框架注册再重启', async () => {
  const h = createMaintenanceHarness()
  const files = populatedFiles(h)
  h.store.set('DF:CodeUpdate:repo', 'pending payload')
  h.store.set('DF:ConfigMigration:CodeUpdate:v2', '1')
  h.store.set('Other:keep', 'foreign')
  const { app, event } = appEvent(h, '#DF卸载插件')
  await app.uninstall(event)
  assert.match(replies(event), /Redis/i)
  assert.match(replies(event), /文件|磁盘|目录/)
  assert.match(replies(event), /确认卸载插件/)
  assert.deepEqual(destructive(h), [])
  const current = await confirm(h, event, '#确认卸载插件')
  const changes = destructive(h)
  assert.equal(changes.at(-1).kind, 'restart')
  assert.equal(changes.at(-1).event, current.event)
  assert.equal(changes.filter(action => action.kind === 'remove-file').at(-1).path, h.pluginPath)
  assert.equal(changes.at(-2).kind, 'unload-plugin')
  assert.equal(changes.at(-3).path, h.pluginPath)
  assert.deepEqual(plain(changes.at(-2)), { kind: 'unload-plugin', args: [h.pluginName, true] })
  assert.ok(h.actions.findIndex(action => action.kind === 'stop-config') < h.actions.findIndex(action => action.kind === 'remove-file'))
  assert.equal(h.nodes.has(h.pluginPath), false)
  for (const removed of [files.config, files.data, files.rendered, files.debug, files.image, files.history]) assert.equal(h.nodes.has(removed), false, removed)
  for (const retained of [files.foreignConfig, files.foreignDebug, files.foreignHtml]) assert.ok(h.nodes.has(retained), retained)
  assert.deepEqual([...h.store], [['Other:keep', 'foreign']])
  assert.equal(h.contexts.size, 0)
  assert.equal(h.load('@/utils/lifecycle').enterPluginTask(), false)
})

test('卸载取消完整保留数据；关闭配置、Redis或文件删除失败不重启，解除故障后可重试', async () => {
  for (const mode of ['cancel', 'config', 'redis', 'files']) {
    const h = createMaintenanceHarness()
    const files = populatedFiles(h)
    h.store.set('DF:one', 'payload')
    const { app, event } = appEvent(h, '#DF卸载插件')
    await app.uninstall(event)
    if (mode === 'config') h.failConfigStop = true
    if (mode === 'redis') h.failDelete = true
    if (mode === 'files') h.failRemove = files.config
    const current = await confirm(h, event, mode === 'cancel' ? '取消' : '#确认卸载插件')
    assert.equal(h.actions.filter(action => action.kind === 'restart').length, 0, mode)
    assert.equal(h.actions.filter(action => action.kind === 'unload-plugin').length, 0, mode)
    assert.ok(h.nodes.has(h.pluginPath), mode)
    assert.equal(h.contexts.size, 0)
    if (mode === 'cancel') {
      assert.deepEqual(destructive(h), [])
      assert.equal(h.store.size, 1)
    } else {
      assert.match(replies(current.event), /失败|未完成/)
      h.failConfigStop = false
      h.failDelete = false
      h.failRemove = undefined
      const retry = appEvent(h, '#DF卸载插件')
      await retry.app.uninstall(retry.event)
      await confirm(h, retry.event, '#确认卸载插件')
      assert.equal(h.nodes.has(h.pluginPath), false, mode)
      assert.equal(h.store.size, 0, mode)
      assert.equal(h.actions.filter(action => action.kind === 'restart').length, 1, mode)
    }
  }
})

test('卸载已完成但重启失败时保留准确状态并提示使用框架重启', async () => {
  const h = createMaintenanceHarness()
  populatedFiles(h)
  h.store.set('DF:one', 'payload')
  const { app, event } = appEvent(h, '#DF卸载插件')
  await app.uninstall(event)
  h.failRestart = true
  const current = await confirm(h, event, '#确认卸载插件')
  assert.equal(h.nodes.has(h.pluginPath), false)
  assert.equal(h.store.size, 0)
  assert.match(replies(current.event), /已卸载.*重启失败/s)
  assert.match(replies(current.event), /#重启/)
  assert.equal(h.actions.filter(action => action.kind === 'restart').length, 1)
})

test('文件已清除后注销或成功提示失败仍调用框架重启', async () => {
  for (const mode of ['unload', 'reply']) {
    const h = createMaintenanceHarness()
    populatedFiles(h)
    h.store.set('DF:one', 'payload')
    const { app, event } = appEvent(h, '#DF卸载插件')
    await app.uninstall(event)
    if (mode === 'unload') h.failUnload = true
    await confirm(h, event, '#确认卸载插件', mode === 'reply' ? { reply: async () => { throw new Error('fixture reply failed') } } : {})
    assert.equal(h.nodes.has(h.pluginPath), false, mode)
    assert.equal(h.store.size, 0, mode)
    assert.equal(destructive(h).at(-1).kind, 'restart', mode)
    assert.ok(h.logs.some(log => log.level === 'warn'), mode)
  }
})

test('图库精简与卸载也先显示大小和上下文确认，精简仅删除Git历史', async () => {
  const h = createMaintenanceHarness()
  const files = populatedFiles(h)
  const prune = appEvent(h, '#DF精简图库')
  await prune.app.removeImg(prune.event)
  assert.match(replies(prune.event), /确认精简图库/)
  assert.deepEqual(destructive(h), [])
  await confirm(h, prune.event, '#确认精简图库')
  assert.ok(h.nodes.has(files.image))
  assert.equal(h.nodes.has(files.history), false)
  const uninstall = appEvent(h, '#DF卸载图库')
  await uninstall.app.removeImg(uninstall.event)
  assert.match(replies(uninstall.event), /确认卸载图库/)
  await confirm(h, uninstall.event, '#确认卸载图库')
  assert.equal(h.nodes.has(h.facePath), false)
  assert.ok(h.nodes.has(h.pluginPath))
  assert.equal(h.actions.filter(action => action.kind === 'restart').length, 0)
})
