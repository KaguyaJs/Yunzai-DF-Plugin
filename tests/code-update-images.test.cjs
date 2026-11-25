const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, subscribe, plain } = require('./helpers/code-update.cjs')
const { displayFixtures } = require('./helpers/git-theme-fixtures.cjs')

const image = { data: Buffer.from('fixture-image'), contentType: 'image/png' }
const dataUrl = `data:image/png;base64,${image.data.toString('base64')}`

function enableProxy (h) {
  h.config.proxy.open = true
  h.download = async () => image
  return h
}

test('提交和Release的Markdown图片在经典及新主题截图前下载，分组后的提交也使用已下载图片', async () => {
  for (const theme of ['classic', 'ocean']) {
    const h = enableProxy(createHarness({ config: { Theme: { Name: theme } } }))
    const { formatMessage, formatReleaseInfo } = h.load('@CodeUpdate/utils/format')
    const [commit] = displayFixtures()
    commit.text = await formatMessage('feat: 图片展示\n\n![示例](https://example.invalid/image.png?a=1&b=2 "图片标题")')
    const second = { ...commit, name: { ...commit.name, sha: 'BBBBB' } }
    const release = await formatReleaseInfo({
      name: 'v1', body: '![示例][ref]\n\n[ref]: https://example.invalid/image.png?a=1&b=2#preview',
      tag_name: 'v1', author: { login: 'alice' }, published_at: '2026-11-25T12:00:00Z'
    }, 'GitHub', 'owner/repo')
    const content = [commit, second, release]
    const before = plain(content)
    await h.load('@CodeUpdate/services/screenshot').generateScreenshot(content, 'markdown-images')
    assert.equal(h.downloads.length, 1)
    assert.equal(h.downloads[0].url, 'https://example.invalid/image.png?a=1&b=2')
    assert.equal(h.downloads[0].options.size, 10 * 1024 * 1024)
    assert.deepEqual(plain(h.downloads[0].options.headers), { Accept: 'image/*' })
    const snapshot = h.screenshots[0]
    assert.equal(snapshot.template, `CodeUpdate/${theme === 'classic' ? 'classic' : 'index'}`)
    assert.ok(snapshot.data.lifeData.every(item => item.text.includes(dataUrl)))
    assert.ok(snapshot.data.renderCards[0].commits.every(item => item.text.includes(dataUrl)))
    assert.match(snapshot.data.lifeData[0].text, /alt="示例" title="图片标题"/)
    assert.equal(snapshot.options.multiPage, true)
    assert.deepEqual(plain(content), before)
  }
})

test('自动推送及手动汇总都会处理Markdown图片，下载内容不进入自动进度记录', async () => {
  const h = enableProxy(createHarness({ config: { FirstAdd: true } }))
  subscribe(h, 'releases')
  const release = {
    id: 1, node_id: 'RELEASE_1', tag_name: 'v1', name: '版本1',
    body: '![示例](https://example.invalid/image.png)', draft: false, prerelease: false,
    created_at: '2026-11-10T07:00:00Z', published_at: '2026-11-10T08:00:00Z',
    html_url: 'https://github.com/owner/repo/releases/tag/v1', author: { login: 'alice' }, assets: []
  }
  h.router = url => ({ data: url.searchParams.get('page') === '1' ? [release] : [] })
  const { CodeUpdate } = h.load('@CodeUpdate')
  assert.equal(await CodeUpdate(true), 1)
  assert.equal(h.deliveries.length, 1)
  assert.equal(h.downloads.length, 1)
  assert.ok(h.screenshots[0].data.lifeData[0].text.includes(dataUrl))
  const before = plain([...h.store])
  assert.ok(!JSON.stringify(before).includes(dataUrl))
  const replies = []
  assert.equal(await CodeUpdate(false, { user_id: 1, reply: async message => { replies.push(message); return true } }), 1)
  assert.equal(h.downloads.length, 2)
  assert.ok(h.screenshots[1].data.lifeData[0].text.includes(dataUrl))
  assert.ok(replies.some(message => typeof message === 'object'))
  assert.deepEqual(plain([...h.store]), before)
})

test('代理关闭、没有地址或没有配置时不下载图片，截图数据保持原样', async () => {
  const h = createHarness()
  const [commit] = displayFixtures()
  commit.text = '<img src="https://example.invalid/image.png">'
  const generate = h.load('@CodeUpdate/services/screenshot').generateScreenshot
  for (const proxy of [{ open: false, url: 'http://127.0.0.1:7890' }, { open: true, url: '' }, undefined]) {
    h.config.proxy = proxy
    await generate([commit], 'proxy-disabled')
    assert.equal(h.screenshots.at(-1).data.lifeData[0].text, commit.text)
  }
  assert.deepEqual(h.downloads, [])
})

test('HTML图片识别实体、引号和大小写，保留尺寸与链接并避免浏览器改用远程srcset', async () => {
  const h = enableProxy(createHarness())
  const [commit] = displayFixtures()
  commit.text = '<a href="https://example.invalid/image.png?a=1&amp;b=2"><IMG title=\'大于 > 且 src="https://example.invalid/wrong"\' data-src="https://example.invalid/deferred" width="300" height="200" SRC=\'https:&#47;&#47;example.invalid/image.png?a=1&amp;b=2\' srcset="https://example.invalid/other.png 2x" loading="lazy"></a>'
  await h.load('@CodeUpdate/services/screenshot').generateScreenshot([commit], 'html-images')
  assert.deepEqual(h.downloads.map(item => item.url), ['https://example.invalid/image.png?a=1&b=2'])
  const text = h.screenshots[0].data.lifeData[0].text
  assert.ok(text.includes(`SRC="${dataUrl}"`))
  assert.ok(text.includes('title=\'大于 > 且 src="https://example.invalid/wrong"\''))
  assert.match(text, /width="300" height="200"/)
  assert.match(text, /href="https:\/\/example.invalid\/image.png\?a=1&amp;b=2"/)
  assert.match(text, /data-src="https:\/\/example.invalid\/deferred"/)
  assert.match(text, /loading="eager"/)
  assert.doesNotMatch(text, /srcset=/)
})

test('只下载真正远程图片，跳过本地资源、dataURL、注释和原始文本元素', async () => {
  const h = enableProxy(createHarness())
  const [commit] = displayFixtures()
  const skipped = [
    '<img src="data:image/png;base64,AA==">', '<img src="file:///tmp/image.png">',
    '<img src="./local.png">', '<img src="javascript:alert(1)">',
    '<!-- <img src="https://example.invalid/comment.png"> -->',
    '<script>const example = \'<img src="https://example.invalid/script.png">\'</script>',
    '<textarea><img src="https://example.invalid/textarea.png"></textarea>',
    '<style>/* <img src="https://example.invalid/style.png"> */</style>',
    '<title><img src="https://example.invalid/title.png"></title>',
    '&lt;img src="https://example.invalid/escaped.png"&gt;',
    '<img-loader src="https://example.invalid/custom.png">'
  ].join('\n')
  commit.text = `${skipped}\n<img src=//example.invalid/protocol-relative.png>`
  await h.load('@CodeUpdate/services/screenshot').generateScreenshot([commit], 'local-images')
  assert.deepEqual(h.downloads.map(item => item.url), ['https://example.invalid/protocol-relative.png'])
  assert.equal(h.screenshots[0].data.lifeData[0].text, `${skipped}\n<img src="${dataUrl}">`)
})

test('下载失败、非图片响应和空图片保留原链接，其他图片仍能渲染', async () => {
  const h = enableProxy(createHarness())
  h.download = async url => {
    if (url.endsWith('/failed')) return false
    if (url.endsWith('/throws')) throw new Error('fixture download failure')
    if (url.endsWith('/html')) return { data: Buffer.from('<html>error</html>'), contentType: 'text/html' }
    if (url.endsWith('/empty')) return { data: Buffer.alloc(0), contentType: 'image/png' }
    return image
  }
  const [commit] = displayFixtures()
  const unchanged = ['failed', 'throws', 'html', 'empty'].map(name => `<img src="https://example.invalid/${name}" srcset="https://example.invalid/${name}-2x 2x">`).join('')
  commit.text = `${unchanged}<img src="https://example.invalid/ok">`
  await h.load('@CodeUpdate/services/screenshot').generateScreenshot([commit], 'failed-images')
  assert.equal(h.downloads.length, 5)
  assert.equal(h.screenshots[0].data.lifeData[0].text, `${unchanged}<img src="${dataUrl}">`)
})

test('图片下载限制并发且在截图前全部完成，每次截图重新读取代理配置', async () => {
  const h = enableProxy(createHarness())
  const [commit] = displayFixtures()
  const tags = Array.from({ length: 9 }, (_, index) => `<img src="https://example.invalid/${index}.png">`)
  commit.text = [...tags, tags[0]].join('')
  let active = 0
  let peak = 0
  h.download = async () => {
    active++
    peak = Math.max(peak, active)
    assert.equal(h.screenshots.length, 0)
    await new Promise(resolve => setImmediate(resolve))
    active--
    return image
  }
  const generate = h.load('@CodeUpdate/services/screenshot').generateScreenshot
  await generate([commit], 'parallel-images')
  assert.equal(peak, 4)
  assert.equal(active, 0)
  assert.equal(h.downloads.length, 9)
  assert.equal((h.screenshots[0].data.lifeData[0].text.match(/data:image\/png;base64,/g) || []).length, 10)
  h.config.proxy.open = false
  await generate([commit], 'direct-images')
  assert.equal(h.downloads.length, 9)
  assert.equal(h.screenshots[1].data.lifeData[0].text, commit.text)
  h.config.proxy.open = true
  h.download = async () => image
  await generate([commit], 'refresh-images')
  assert.equal(h.downloads.length, 18)
})
