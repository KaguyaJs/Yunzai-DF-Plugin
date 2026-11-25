const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const http = require('node:http')
const net = require('node:net')
const { Readable } = require('node:stream')
const ts = require('typescript')
const { default: fetch, Response } = require('node-fetch')
const { HttpsProxyAgent } = require('https-proxy-agent')

const filename = path.resolve(__dirname, '../src/utils/request.ts')
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
}).outputText

function createHarness () {
  const h = { config: { proxy: { open: false, url: '' } }, calls: [], logs: [], fetch: async () => new Response('resource') }
  const logger = Object.fromEntries(['trace', 'debug', 'info', 'mark', 'warn', 'error'].map(name => [name, (...args) => h.logs.push({ name, args })]))
  logger.green = value => value
  const dependencies = {
    '@/config': h.config,
    'node-fetch': async (url, options) => { h.calls.push({ url, options }); return h.fetch(url, options) },
    'https-proxy-agent': { HttpsProxyAgent },
    './logger': logger
  }
  const module = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports){\n${source}\n})`, { filename })(
    name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module, module.exports)
  return Object.assign(h, { request: module.exports.request })
}

test('下载器返回原始二进制和规范化媒体类型，保留调用方请求参数', async () => {
  const h = createHarness()
  const bytes = Buffer.from([0, 255, 128, 1, 10])
  h.fetch = async () => new Response(bytes, { headers: { 'Content-Type': 'IMAGE/PNG; charset=binary' } })
  const controller = new AbortController()
  const options = { headers: { Accept: 'image/*' }, signal: controller.signal, size: 1024, log: false }
  const result = await h.request.download('https://example.invalid/image', options)
  assert.deepEqual(result, { data: bytes, contentType: 'image/png' })
  assert.equal(h.calls[0].options.signal, controller.signal)
  assert.equal(h.calls[0].options.size, 1024)
  assert.deepEqual(h.calls[0].options.headers, options.headers)
  assert.equal(h.calls[0].options.method, 'GET')
  assert.equal(options.agent, undefined)
  assert.deepEqual(h.logs, [])
})

test('未开启代理或代理地址为空时直接请求，未指定超时时使用默认信号', async () => {
  const h = createHarness()
  for (const proxy of [{ open: false, url: 'http://127.0.0.1:7890' }, { open: true, url: '' }]) {
    h.config.proxy = proxy
    const result = await h.request.download('https://example.invalid/resource')
    assert.equal(result.data.toString(), 'resource')
    assert.equal(result.contentType, 'text/plain')
    assert.equal(h.calls.at(-1).options.agent, undefined)
    assert.ok(h.calls.at(-1).options.signal instanceof AbortSignal)
  }
})

test('下载器通过配置的代理完成真实HTTP下载及重定向，运行中关闭代理后恢复直连', async t => {
  const sockets = new Set()
  const paths = []
  const bytes = Buffer.from([1, 2, 3, 255])
  const server = http.createServer((req, res) => {
    paths.push(req.url)
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/image' }); res.end(); return }
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(bytes)
  })
  let connections = 0
  const proxy = http.createServer()
  for (const service of [server, proxy]) service.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  proxy.on('connect', (req, socket, head) => {
    connections++
    assert.equal(req.url, `127.0.0.1:${server.address().port}`)
    const upstream = net.connect(server.address().port, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length) upstream.write(head)
      socket.pipe(upstream).pipe(socket)
    })
    sockets.add(upstream)
    upstream.on('close', () => sockets.delete(upstream))
    upstream.on('error', () => socket.destroy())
    socket.on('error', () => upstream.destroy())
  })
  t.after(async () => {
    for (const socket of sockets) socket.destroy()
    await Promise.all([server, proxy].map(service => new Promise(resolve => service.close(resolve))))
  })
  await Promise.all([server, proxy].map(service => new Promise(resolve => service.listen(0, '127.0.0.1', resolve))))
  const h = createHarness()
  h.fetch = fetch
  h.config.proxy = { open: true, url: `http://127.0.0.1:${proxy.address().port}` }
  const result = await h.request.download(`http://127.0.0.1:${server.address().port}/redirect`)
  assert.deepEqual(result.data, bytes)
  assert.equal(result.contentType, 'image/png')
  assert.deepEqual(paths, ['/redirect', '/image'])
  assert.ok(connections >= 1)
  assert.ok(h.calls[0].options.agent instanceof HttpsProxyAgent)
  const before = connections
  h.config.proxy.open = false
  assert.deepEqual((await h.request.download(`http://127.0.0.1:${server.address().port}/image`)).data, bytes)
  assert.equal(connections, before)
  assert.equal(h.calls.at(-1).options.agent, undefined)
})

test('HTTP失败、网络失败和中断的数据流返回false，失败响应及时释放', async () => {
  const h = createHarness()
  const response = new Response('not found', { status: 404 })
  h.fetch = async () => response
  assert.equal(await h.request.download('https://example.invalid/missing', { log: false }), false)
  assert.equal(response.body.destroyed, true)
  assert.deepEqual(h.logs, [])
  h.fetch = async () => { throw new Error('fixture network failure') }
  assert.equal(await h.request.download('https://example.invalid/offline'), false)
  h.fetch = async () => new Response(Readable.from((async function * () {
    yield Buffer.from('partial')
    throw new Error('fixture stream failure')
  })()))
  assert.equal(await h.request.download('https://example.invalid/interrupted'), false)
})

test('下载字节上限约束实际响应流，缺少媒体类型仍能供其他下载用途复用', async () => {
  const h = createHarness()
  h.fetch = async (_, options) => new Response(Readable.from([Buffer.alloc(4), Buffer.alloc(8)]), { size: options.size })
  assert.equal(await h.request.download('https://example.invalid/large', { size: 10, log: false }), false)
  h.fetch = async () => new Response(Buffer.from('binary'))
  assert.deepEqual(await h.request.download('https://example.invalid/file'), { data: Buffer.from('binary'), contentType: 'application/octet-stream' })
})
