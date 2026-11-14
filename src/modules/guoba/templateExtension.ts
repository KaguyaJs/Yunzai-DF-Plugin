import fs from 'node:fs/promises'
import path from 'node:path'
import { PluginPath, ResPath } from '@/dir'
import { onPluginStop } from '@/utils/lifecycle'

type GuobaApp = {
  use: (handler: any) => void
  router?: { stack: Array<{ handle: unknown }> }
  _router?: { stack: Array<{ handle: unknown }> }
}
const installed = new Map<GuobaApp, unknown>()
const prefix = '/guoba-plugin-mock-root'
const modulePath = `${prefix}/df-contact-template-component.js`
let waiting: NodeJS.Timeout | undefined
let stopped = false

onPluginStop(() => {
  stopped = true
  clearInterval(waiting)
  waiting = undefined
  for (const [app, middleware] of installed) {
    const stack = app.router?.stack || app._router?.stack
    const index = stack?.findIndex(layer => layer.handle === middleware) ?? -1
    if (stack && index >= 0) stack.splice(index, 1)
  }
  installed.clear()
})

function exportAlias (source: string, name: string) {
  const exports = source.slice(source.lastIndexOf('export{'))
  const match = exports.match(new RegExp(`(?:[,\\{])${name}(?:\\$\\d+)? as ([\\w$]+)[,}]`))
  if (!match) throw new Error(`锅巴前端缺少 ${name} 导出`)
  return match[1]
}

async function componentModule () {
  const assets = path.join(PluginPath, '..', 'Guoba-Plugin', 'server', 'static', 'assets')
  const [index, registry, source] = await Promise.all([
    fs.readFile(path.join(assets, 'index.js'), 'utf8'),
    fs.readFile(path.join(assets, 'BasicForm.vue_vue_type_style_index_0_lang.js'), 'utf8'),
    fs.readFile(path.join(ResPath, 'guoba', 'contact-template-editor.js'), 'utf8')
  ])
  const names = ['defineComponent', 'h', 'ref', 'watch', 'onMounted', 'onBeforeUnmount']
  const imports = names.map(name => `${exportAlias(index, name)} as ${name}`).join(', ')
  return `import { ${imports} } from '${prefix}/assets/index.js';\nimport { ${exportAlias(registry, 'componentMap')} as componentMap } from '${prefix}/assets/BasicForm.vue_vue_type_style_index_0_lang.js';\n${source}\nregisterContactTemplateEditor({${names.join(',')}}, componentMap);`
}

function install (app: GuobaApp) {
  if (installed.has(app)) return
  let modulePromise: Promise<string> | undefined
  const middleware = (req: any, res: any, next: () => void) => {
    const pathname = new URL(req.originalUrl || req.url, 'http://localhost').pathname
    if (pathname === modulePath) {
      modulePromise ||= componentModule()
      void modulePromise.then(source => {
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(source)
      }).catch(error => {
        modulePromise = undefined
        logger.error('[DF] 联系主人模板编辑器加载失败', error)
        res.statusCode = 500
        res.end('/* 联系主人模板编辑器加载失败 */')
      })
      return
    }
    const send = res.send
    res.send = function (body: unknown) {
      if (typeof body === 'string' && body.includes('id="app"') && body.includes('/assets/index.js') && !body.includes(`<script type="module" src="${modulePath}"`)) {
        body = body.replace('</head>', `<script type="module" src="${modulePath}"></script></head>`)
      }
      return send.call(this, body)
    }
    next()
  }
  app.use(middleware)
  installed.set(app, middleware)
  // 首页由锅巴 preload 直接返回，扩展需要在 preload 之前附加模块。
  const stack = app.router?.stack || app._router?.stack
  if (stack) {
    const index = stack.findIndex(layer => layer.handle === middleware)
    if (index > 0) stack.unshift(stack.splice(index, 1)[0])
  }
}

export function installContactTemplateExtension () {
  if (stopped) return
  const getApp = () => (globalThis as typeof globalThis & { Guoba?: { app?: GuobaApp } }).Guoba?.app
  const current = getApp()
  if (current) install(current)
  if (!waiting) {
    // 锅巴可单独重载，实例变化后继续挂载；没有安装锅巴时不影响 DF 功能。
    waiting = setInterval(() => { const app = getApp(); if (app) install(app) }, 1000)
    waiting.unref()
  }
}
