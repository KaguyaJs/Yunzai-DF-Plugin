const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const project = path.resolve(__dirname, '../..')

function createHarness (options = {}) {
  let now = Date.parse('2026-11-10T08:00:00Z')
  const store = new Map()
  const requests = []
  const deliveries = []
  const screenshots = []
  const logs = []
  const failures = new Set()
  const config = {
    CodeUpdate: {
      FirstAdd: false,
      AutoBranch: true,
      Translate: false,
      badgeStyle: true,
      multiPage: 2,
      Activity: { PageSize: 100, MaxPages: 20, InitialLimit: 10, BodyLimit: 600, OverlapSeconds: 60, SendLinks: true },
      repos: [{ provider: 'GitHub', ApiUrl: 'https://api.github.com/repos', token: 'fixture-token', icon: 'GitHub' }],
      List: [],
      ...options.config
    }
  }
  const harness = { store, requests, deliveries, screenshots, logs, failures, config, failWrite: false, render: true, router: () => ({ data: [] }) }
  const logger = Object.fromEntries(['error', 'warn', 'trace', 'debug', 'info', 'mark'].map(name => [name, (...args) => logs.push({ name, args })]))
  for (const name of ['cyan', 'magenta', 'yellow', 'green']) logger[name] = value => value
  const utils = {
    logger,
    PluginPath: [],
    Data: { getJSON: () => ({}) },
    timeAgo: value => value,
    screenshot: async (template, data, options) => {
      screenshots.push({ template, data: JSON.parse(JSON.stringify(data)), options })
      return harness.render ? (options.multiPage ? [{ type: 'image', file: 'page1' }, { type: 'image', file: 'page2' }] : { type: 'image', file: 'page1' }) : false
    },
    request: {
      get: async (input, type, options) => {
        const url = new URL(input)
        requests.push({ url, headers: options.headers })
        const result = await harness.router(url, options.headers)
        if (result === false) return false
        const status = result.status || 200
        return {
          ok: status >= 200 && status < 300,
          status,
          statusText: String(status),
          headers: { get: key => key === 'content-type' ? 'application/json' : key === 'link' ? result.link || null : null },
          json: async () => result.data
        }
      }
    }
  }
  const cache = new Map()
  const context = vm.createContext({
    console,
    URL,
    structuredClone,
    Buffer,
    Date: class extends Date {
      constructor (...args) { super(...(args.length ? args : [now])) }
      static now () { return now }
    },
    redis: {
      get: async key => store.get(key) ?? null,
      set: async (key, value) => {
        if (harness.failWrite) throw new Error('fixture Redis failure')
        store.set(key, value)
        return 'OK'
      },
      keys: async pattern => [...store.keys()].filter(key => key.startsWith(pattern.replace(/\*$/, ''))),
      del: async keys => [...keys].reduce((count, key) => count + Number(store.delete(key)), 0)
    },
    Bot: Object.fromEntries(['Group', 'Friend'].map(type => [`pick${type}`, id => ({
      sendMsg: async message => {
        const target = `${type === 'Friend' ? 'QQ' : 'Group'}:${id}`
        deliveries.push({ target, message })
        return failures.has(target) || harness.failDelivery?.(target, message) ? false : { message_id: `${target}:${deliveries.length}` }
      }
    })]))
  })

  function resolveModule (specifier, parent) {
    let filename
    if (specifier === '@CodeUpdate') filename = path.join(project, 'src/modules/CodeUpdate/index')
    else if (specifier.startsWith('@CodeUpdate/')) filename = path.join(project, 'src/modules/CodeUpdate', specifier.slice(12))
    else if (specifier.startsWith('@/')) filename = path.join(project, 'src', specifier.slice(2))
    else if (specifier.startsWith('.')) filename = path.resolve(path.dirname(parent), specifier)
    else return null
    filename = filename.replace(/\.js$/, '')
    if (fs.existsSync(`${filename}.ts`)) return `${filename}.ts`
    if (filename.endsWith('.ts')) return filename
    return path.join(filename, 'index.ts')
  }

  function load (specifier, parent = path.join(project, 'tests/entry.cjs')) {
    if (specifier === '@/config') return config
    if (specifier === '@/constants') return { CodeUpdateRedisKey: 'fixture:CodeUpdate' }
    if (specifier === '@/utils') return utils
    if (specifier === '@/dir') return { ResPath: path.join(project, 'resources'), PluginName: 'DF-Plugin' }
    if (specifier === '@/modules') return { FacePoke: async () => path.join(project, 'resources/CodeUpdate/icon/git.svg') }
    if (specifier === '@/utils/GitRepo') return { PluginPath: [] }
    const filename = resolveModule(specifier, parent)
    if (!filename) return require(specifier)
    if (filename.endsWith(path.join('utils', 'translate.ts'))) {
      return {
        getCodeUpdateTranslateName: () => '测试翻译',
        translateCodeUpdateTextInfo: async text => ({ text: text || '', translated: config.CodeUpdate.Translate })
      }
    }
    if (filename.endsWith(path.join('CodeUpdate', 'utils', 'index.ts'))) {
      return Object.assign({}, ...['repo', 'redis', 'activity', 'format', 'formatActivity', 'autoBranch'].map(name => load(`./${name}`, filename)))
    }
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
    }).outputText
    const run = vm.runInContext(`(function(require,module,exports){\n${source}\n})`, context, { filename })
    run(value => load(value, filename), module, module.exports)
    return module.exports
  }

  return Object.assign(harness, {
    load,
    setNow: value => { now = Date.parse(value) }
  })
}

function item (number, changes = {}) {
  return {
    id: number,
    number,
    title: `活动 ${number}`,
    body: '**正文**\n\n- 内容一\n- 内容二',
    state: 'open',
    html_url: `https://github.com/owner/repo/issues/${number}`,
    created_at: '2026-11-10T07:00:00Z',
    updated_at: '2026-11-10T07:30:00Z',
    merged_at: null,
    draft: false,
    user: { login: 'alice', avatar_url: 'https://example.com/avatar.png', type: 'User' },
    labels: [{ name: 'bug', color: 'd73a4a' }],
    base: { ref: 'main' },
    head: { ref: 'feature', label: 'alice:feature', sha: 'aaaaa' },
    comments: 0,
    ...changes
  }
}

function subscribe (harness, method = 'issues', overrides = {}, target = 10001) {
  const rule = { provider: 'GitHub', repo: 'owner/repo', type: method, ...overrides }
  harness.config.CodeUpdate.List.push({ Group: [target], repos: [rule] })
  return rule
}

module.exports = { createHarness, item, subscribe, project, plain: value => JSON.parse(JSON.stringify(value)) }
