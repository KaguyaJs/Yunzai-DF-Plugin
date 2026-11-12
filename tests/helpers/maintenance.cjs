const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const project = path.resolve(__dirname, '../..')
const plain = value => JSON.parse(JSON.stringify(value))

/** No filesystem mutation, Redis connection, shell command or real restart can escape this harness. */
function createMaintenanceHarness () {
  const yunzaiPath = path.join(project, 'virtual-yunzai')
  const pluginName = 'DF-Plugin'
  const pluginPath = path.join(yunzaiPath, 'plugins', pluginName)
  const facePath = path.join(pluginPath, 'resources', 'poke')
  const store = new Map()
  const nodes = new Map()
  const actions = []
  const logs = []
  const contexts = new Map()
  let now = Date.parse('2026-11-12T08:00:00Z')
  let inode = 0
  const h = {
    yunzaiPath, pluginName, pluginPath, facePath, store, nodes, actions, logs, contexts,
    activeKeys: [], redisCalls: [], memoryCosts: new Map(), redisTypes: new Map(), loading: false
  }

  function filename (input) { return path.resolve(String(input)) }
  function missing (target) { return Object.assign(new Error(`ENOENT: ${target}`), { code: 'ENOENT' }) }
  function directory (target) {
    target = filename(target)
    if (nodes.has(target)) return target
    const parent = path.dirname(target)
    if (parent !== target) directory(parent)
    nodes.set(target, { type: 'directory', size: 0, ino: ++inode, mtimeMs: now })
    return target
  }
  function file (target, data = '') {
    target = filename(target)
    directory(path.dirname(target))
    nodes.set(target, { type: 'file', data: Buffer.from(data), size: Buffer.byteLength(data), ino: ++inode, mtimeMs: now })
    return target
  }
  function symlink (target, destination) {
    target = filename(target)
    directory(path.dirname(target))
    nodes.set(target, { type: 'link', target: filename(destination), size: Buffer.byteLength(destination), ino: ++inode, mtimeMs: now })
    return target
  }
  function realpath (target, depth = 0) {
    if (depth > 20) throw Object.assign(new Error('ELOOP'), { code: 'ELOOP' })
    target = filename(target)
    const root = path.parse(target).root
    let current = root
    for (const component of target.slice(root.length).split(path.sep).filter(Boolean)) {
      current = path.join(current, component)
      const node = nodes.get(current)
      if (!node) throw missing(current)
      if (node.type === 'link') current = realpath(node.target, depth + 1)
    }
    if (!nodes.has(current)) throw missing(current)
    return current
  }
  function stats (node) {
    return {
      size: node.size, ino: node.ino, dev: 1, mode: 0o777, mtimeMs: node.mtimeMs, ctimeMs: node.mtimeMs,
      isDirectory: () => node.type === 'directory', isFile: () => node.type === 'file', isSymbolicLink: () => node.type === 'link'
    }
  }
  function children (target) {
    target = realpath(target)
    return [...nodes].filter(([name]) => name !== target && path.dirname(name) === target)
      .map(([name, node]) => ({ name: path.basename(name), ...stats(node) }))
  }
  const filesystem = {
    async lstat (target) {
      target = filename(target)
      h.onLstat?.(target)
      const parent = path.dirname(target)
      if (parent !== target) target = path.join(realpath(parent), path.basename(target))
      const node = nodes.get(target)
      if (!node) throw missing(target)
      return stats(node)
    },
    async stat (target) { return stats(nodes.get(realpath(target))) },
    async realpath (target) { return realpath(target) },
    async access (target) { realpath(target) },
    async readlink (target) {
      const node = nodes.get(filename(target))
      if (node?.type !== 'link') throw new Error('not a link')
      return node.target
    },
    async readdir (target, options) {
      const values = children(target)
      return options?.withFileTypes ? values : values.map(value => value.name)
    },
    async opendir (target) {
      const values = children(target)
      return { async * [Symbol.asyncIterator] () { yield * values } }
    },
    async readFile (target, options) {
      target = realpath(target)
      h.onRead?.(target)
      const node = nodes.get(target)
      if (node.type !== 'file') throw new Error('EISDIR')
      return options === 'utf8' || options?.encoding === 'utf8' ? node.data.toString('utf8') : Buffer.from(node.data)
    },
    async rm (target, options = {}) {
      target = filename(target)
      if (h.failRemove === target || (typeof h.failRemove === 'function' && h.failRemove(target))) throw new Error('fixture removal failed')
      actions.push({ kind: 'remove-file', path: target, options: plain(options) })
      h.onRemove?.(target)
      const node = nodes.get(target)
      if (!node) {
        if (!options.force) throw missing(target)
        return
      }
      if (node.type === 'directory' && !options.recursive && children(target).length) throw new Error('ENOTEMPTY')
      for (const name of [...nodes.keys()]) {
        if (name === target || (node.type === 'directory' && name.startsWith(`${target}${path.sep}`))) nodes.delete(name)
      }
    },
    async unlink (target) { return this.rm(target) },
    async mkdir (target) { directory(target) },
    async writeFile (target, value) {
      actions.push({ kind: 'write-file', path: filename(target) })
      file(target, value)
    }
  }
  directory(pluginPath)
  file(path.join(pluginPath, 'package.json'), JSON.stringify({ name: 'yunzai-df-plugin' }))
  const logger = Object.fromEntries(['error', 'warn', 'info', 'debug', 'trace', 'mark'].map(level => [level, (...args) => logs.push({ level, args })]))
  for (const color of ['cyan', 'green', 'yellow', 'magenta']) logger[color] = value => value
  const redis = {
    async scan (cursor, options) {
      h.redisCalls.push({ method: 'scan', cursor, options })
      if (h.failScan) throw new Error('fixture scan failure')
      if (h.scanPages) return h.scanPages[Number(cursor)]
      const keys = [...store.keys()].filter(key => key.startsWith(options.MATCH.slice(0, -1)))
      const offset = Number(cursor)
      const count = options.COUNT || 10
      return { cursor: offset + count < keys.length ? offset + count : 0, keys: keys.slice(offset, offset + count) }
    },
    async memoryUsage (key) {
      h.redisCalls.push({ method: 'memoryUsage', key })
      if (h.memoryError) throw h.memoryError
      if (!store.has(key)) return null
      return h.memoryCosts.get(key) ?? Buffer.byteLength(store.get(key)) + 64
    },
    async type (key) { return !store.has(key) ? 'none' : h.redisTypes.get(key) || 'string' },
    async strLen (key) {
      h.redisCalls.push({ method: 'strLen', key })
      if (h.redisTypes.has(key) && h.redisTypes.get(key) !== 'string') throw new Error('WRONGTYPE')
      return store.has(key) ? Buffer.byteLength(store.get(key)) : 0
    },
    async dump (key) { return store.has(key) ? Buffer.from(store.get(key)) : null },
    async exists (key) { return Number(store.has(key)) },
    async get (key) { return store.get(key) ?? null },
    async set (key, value) {
      store.set(key, value)
      actions.push({ kind: 'redis-write', key })
      return 'OK'
    },
    async unlink (...args) {
      if (h.unlinkError) throw h.unlinkError
      return removeRedis('unlink', args)
    },
    async del (...args) { return removeRedis('del', args) },
    async keys () { throw new Error('KEYS must not be used by maintenance') },
    async flushDb () { throw new Error('must not flush shared Redis') },
    async flushAll () { throw new Error('must not flush shared Redis') }
  }
  async function removeRedis (method, args) {
    const keys = args.flat()
    if (h.failDelete) throw new Error('fixture Redis deletion failed')
    h.redisCalls.push({ method, keys })
    actions.push({ kind: 'remove-redis', keys })
    return keys.reduce((sum, key) => sum + Number(store.delete(key)), 0)
  }
  redis.sendCommand = async command => {
    const [name, ...args] = command
    if (name === 'MEMORY') return redis.memoryUsage(args[1])
    if (name === 'STRLEN') return redis.strLen(args[0])
    if (name === 'TYPE') return redis.type(args[0])
    if (name === 'DUMP') return redis.dump(args[0])
    if (name === 'UNLINK') return redis.unlink(args)
    if (name === 'DEL') return redis.del(args)
    throw new Error(`unexpected Redis command: ${name}`)
  }
  const config = { CodeUpdate: { Auto: true, List: [] } }
  const configStop = async () => {
    actions.push({ kind: 'stop-config' })
    if (h.failConfigStop) throw new Error('fixture config stop failed')
  }
  config.closeWatcher = configStop
  h.config = config
  const utility = { logger, exec: async () => { actions.push({ kind: 'exec' }); return '' } }
  Object.defineProperty(utility, 'Loading', { get: () => h.loading })
  const cache = new Map()
  function contextKey (app, name) {
    return JSON.stringify([app.name, app.e.self_id, app.e.user_id, name])
  }
  const context = vm.createContext({
    console, URL, Buffer, structuredClone, setTimeout, clearTimeout, setImmediate, clearImmediate, logger, redis,
    process: { cwd: () => yunzaiPath, argv: [], env: {} },
    Date: class extends Date {
      constructor (...args) { super(...(args.length ? args : [now])) }
      static now () { return now }
    },
    plugin: class {
      constructor (options) { Object.assign(this, options); this.finishes = []; this.context = null }
      setContext (name, isGroup, timeout) {
        this.context = name
        contexts.set(contextKey(this, name), this.e)
        h.contextCalls ??= []
        h.contextCalls.push({ name, isGroup, timeout })
        return this.e
      }
      getContext (name) { return contexts.get(contextKey(this, name)) }
      finish (name) { this.finishes.push(name); this.context = null; contexts.delete(contextKey(this, name)) }
      reply (message) { return this.e.reply(message) }
    }
  })
  function resolveModule (specifier, parent) {
    let target
    if (specifier.startsWith('@/')) target = path.join(project, 'src', specifier.slice(2))
    else if (specifier.startsWith('.')) target = path.resolve(path.dirname(parent), specifier)
    else return null
    target = target.replace(/\.js$/, '')
    return fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, 'index.ts')
  }
  function load (specifier, parent = path.join(project, 'tests/entry.cjs')) {
    if (specifier === 'node:fs/promises') return filesystem
    if (specifier === 'node:fs') throw new Error('maintenance must use isolated async filesystem')
    if (specifier === '@/dir') return { YunzaiPath: yunzaiPath, PluginPath: pluginPath, PluginName: pluginName, ResPath: path.join(pluginPath, 'resources'), FacePath: facePath }
    if (specifier === '@/constants' || specifier === '@/constants/Redis') return { commonRedisKey: 'DF', CodeUpdateRedisKey: 'DF:CodeUpdate', FaceRepoUrl: 'https://example.invalid/faces' }
    if (specifier === '@/config') return config
    if (specifier === '../../../../lib/plugins/loader.js') return {
      async unloadPlugin (...args) {
        actions.push({ kind: 'unload-plugin', args })
        if (h.failUnload) throw new Error('fixture plugin unregister failed')
      }
    }
    if (specifier === '@/utils') return utility
    if (specifier === '@/utils/logger') return { logger }
    if (specifier === '@/utils/GitRepo') return { get Loading () { return h.loading } }
    if (specifier === '@/utils/data') return { isDirectory: async target => { try { return (await filesystem.stat(target)).isDirectory() } catch { return false } } }
    if (specifier === '@CodeUpdate') return {
      getAllRedisKey: async () => {
        h.activeReads = (h.activeReads || 0) + 1
        if (h.failActive) throw new Error('fixture branch discovery failed')
        return h.activeKeys
      }
    }
    if (specifier.endsWith('/other/restart.js')) return {
      Restart: class {
        constructor (event) { this.e = event }
        async restart () {
          actions.push({ kind: 'restart', event: this.e })
          if (h.failRestart) throw new Error('fixture restart failed')
        }
      }
    }
    if (specifier.endsWith('/other/update.js')) return {
      update: class {
        async update () { actions.push({ kind: 'update' }) }
        async updateLog () { actions.push({ kind: 'update-log' }) }
      }
    }
    if (specifier.endsWith('/lib/common/common')) return { makeForwardMsg: async (_, messages) => messages }
    const target = resolveModule(specifier, parent)
    if (!target) return require(specifier)
    if (cache.has(target)) return cache.get(target).exports
    const module = { exports: {} }
    cache.set(target, module)
    const source = ts.transpileModule(fs.readFileSync(target, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
    }).outputText
    const run = vm.runInContext(`(function(require,module,exports){\n${source}\n})`, context, { filename: target })
    run(value => load(value, target), module, module.exports)
    return module.exports
  }
  function event (msg, overrides = {}) {
    const replies = []
    return {
      msg, self_id: 100, user_id: 200, group_id: 300, isGroup: true, isMaster: true, replies,
      reply: async message => { replies.push(message); actions.push({ kind: 'reply', message }); return true },
      ...overrides
    }
  }
  return Object.assign(h, { load, file, directory, symlink, filesystem, redis, event, setNow: value => { now = typeof value === 'number' ? value : Date.parse(value) } })
}

module.exports = { createMaintenanceHarness, project, plain }
