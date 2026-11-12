const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness, item, subscribe, project, plain } = require('./helpers/code-update.cjs')
const { displayFixtures } = require('./helpers/git-theme-fixtures.cjs')

function declarations (style) {
  return Object.fromEntries(style.split(';').filter(value => value.trim()).map(value => {
    const index = value.indexOf(':')
    return [value.slice(0, index).trim(), value.slice(index + 1).trim()]
  }))
}

const imageCount = message => (Array.isArray(message) ? message : [message]).filter(value => value && typeof value === 'object' && value.type === 'image').length

function installPreviewRouter (h) {
  const commit = {
    sha: 'abcdef123456',
    commit: { message: 'feat: 统一主题', author: { name: 'Alice' }, committer: { name: 'Alice' } },
    author: { avatar_url: '' }, committer: { avatar_url: '' }, parents: []
  }
  const release = { id: 1, node_id: 'release-one', tag_name: 'v1', name: '版本一', body: '版本说明', draft: false, author: { login: 'Alice' } }
  const issues = [item(1), item(2, { labels: ['feature'] })]
  const pull = item(50, { html_url: 'https://github.com/owner/repo/pull/50' })
  h.router = url => {
    if (url.pathname.endsWith('/commits')) return { data: [commit] }
    if (url.pathname.includes('/commits/')) return { data: commit }
    if (url.pathname.endsWith('/releases')) return { data: [release] }
    if (url.pathname.endsWith('/issues')) return { data: issues }
    if (url.pathname.endsWith('/pulls')) return { data: [pull] }
    if (url.pathname.endsWith('/pulls/50')) return { data: pull }
    if (url.pathname.includes('/issues/')) return { data: issues.find(value => String(value.number) === url.pathname.split('/').at(-1)) }
    return { data: [] }
  }
}

test('经典原版与六套新主题均可选择，未配置或非法配置默认海盐蓝', () => {
  const h = createHarness()
  const { CODE_UPDATE_THEMES, resolveCodeUpdateTheme } = h.load('@CodeUpdate/utils/theme')
  assert.deepEqual(plain(CODE_UPDATE_THEMES.map(value => value.name)), ['classic', 'dark', 'light', 'ocean', 'forest', 'sunset', 'lavender'])
  for (const preset of CODE_UPDATE_THEMES) {
    assert.ok(preset.label && preset.description)
    const theme = resolveCodeUpdateTheme({ Name: preset.name })
    assert.equal(theme.name, preset.name)
    assert.equal(theme.label, preset.label)
    if (preset.name === 'classic') assert.equal(theme.style, '')
    else {
      assert.equal(declarations(theme.style)['--git-width'], '640px')
      assert.equal(declarations(theme.style)['--git-radius'], '16px')
    }
  }
  const defaultTheme = resolveCodeUpdateTheme({ Name: 'ocean' })
  for (const value of [undefined, null, '', 0, [], {}, { Name: '' }, { Name: null }, { Name: 'missing-theme' }, { Name: '__proto__' }, { Name: '" onclick="x' }]) {
    assert.equal(resolveCodeUpdateTheme(value).name, 'ocean')
    assert.equal(resolveCodeUpdateTheme(value).style, defaultTheme.style)
  }
})

test('主题覆盖仅接受十六进制颜色，拒绝CSS注入与外部资源表达式', () => {
  const h = createHarness()
  const { resolveCodeUpdateTheme } = h.load('@CodeUpdate/utils/theme')
  const valid = declarations(resolveCodeUpdateTheme({
    Name: 'light', Accent: '#aBc', Background: '#fffef8', Surface: '#fff', Text: '#15233b', Muted: '#526078', Border: '#dde4ef'
  }).style)
  for (const key of ['accent', 'bg', 'surface', 'text', 'muted', 'border']) assert.match(valid[`--git-${key}`], /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i, key)
  const untrusted = resolveCodeUpdateTheme({
    Name: 'light',
    Accent: '#fff; background-image: url(https://example.invalid/leak)',
    Background: 'url(file:///private.txt)',
    Surface: 'var(--unsafe)',
    Text: '</style><script>alert(1)</script>',
    Muted: '#12345',
    Border: '#ffffffffff'
  })
  const unsafeValues = declarations(untrusted.style)
  for (const key of ['accent', 'bg', 'surface', 'text', 'muted', 'border']) assert.equal(unsafeValues[`--git-${key}`], undefined)
  assert.doesNotMatch(untrusted.style, /url\(|script|var\(|private\.txt/i)
})

test('主题宽度圆角支持边界与数字文本，空值和非有限值回退且不超范围', () => {
  const h = createHarness()
  const { resolveCodeUpdateTheme } = h.load('@CodeUpdate/utils/theme')
  for (const [width, radius] of [[520, 0], [1000, 28], ['760', '20']]) {
    const style = declarations(resolveCodeUpdateTheme({ Name: 'light', Width: width, Radius: radius }).style)
    assert.equal(style['--git-width'], `${width}px`)
    assert.equal(style['--git-radius'], `${radius}px`)
  }
  for (const value of [undefined, null, '', '   ', NaN, Infinity, -Infinity, 'invalid', '900px']) {
    const style = declarations(resolveCodeUpdateTheme({ Name: 'light', Width: value, Radius: value }).style)
    assert.equal(style['--git-width'], '640px')
    assert.equal(style['--git-radius'], '16px')
  }
  for (const [width, radius] of [[-1, -1], [100000, 100000], [601.75, 16.9]]) {
    const style = declarations(resolveCodeUpdateTheme({ Name: 'light', Width: width, Radius: radius }).style)
    const actualWidth = Number.parseFloat(style['--git-width'])
    const actualRadius = Number.parseFloat(style['--git-radius'])
    assert.ok(Number.isInteger(actualWidth) && actualWidth >= 520 && actualWidth <= 1000)
    assert.ok(Number.isInteger(actualRadius) && actualRadius >= 0 && actualRadius <= 28)
  }
})

test('未配置主题使用海盐蓝，显式经典原版保留独立原模板，两者均遵循分片配置', async () => {
  const h = createHarness({ config: { multiPage: 1 } })
  const { generateScreenshot } = h.load('@CodeUpdate/services/screenshot')
  const content = displayFixtures()
  const result = await generateScreenshot(content, 'default-preview')
  assert.equal(imageCount(result), 2)
  assert.equal(h.screenshots[0].template, 'CodeUpdate/index')
  assert.equal(h.screenshots[0].data.theme.name, 'ocean')
  assert.equal(declarations(h.screenshots[0].data.theme.style)['--git-width'], '640px')
  assert.equal(h.screenshots[0].options.multiPage, true)
  h.config.CodeUpdate.Theme = { Name: 'classic', Width: 1000, Radius: 0, Accent: '#f00', Background: '#fff', Surface: '#eee', Text: '#111', Muted: '#333', Border: '#999' }
  const configured = plain(h.config.CodeUpdate.Theme)
  const automatic = await generateScreenshot(content, 'legacy-auto')
  assert.ok(Array.isArray(automatic))
  assert.equal(h.screenshots[1].template, 'CodeUpdate/classic')
  assert.equal(h.screenshots[1].data.theme.name, 'classic')
  assert.equal(h.screenshots[1].data.theme.style, '')
  assert.equal(h.screenshots[1].options.multiPage, true)
  assert.deepEqual(plain(h.config.CodeUpdate.Theme), configured)
})

test('新主题切回经典时不套用新配色与布局，再次选择新主题可恢复已存设置', async () => {
  const h = createHarness({ config: { multiPage: -1, Theme: { Name: 'forest', Width: 720, Radius: 8, Accent: '#217754', Background: '#eff7f0' } } })
  const { generateScreenshot } = h.load('@CodeUpdate/services/screenshot')
  const configured = h.config.CodeUpdate.Theme
  const content = displayFixtures()
  await generateScreenshot(content, 'switch')
  assert.equal(h.screenshots[0].template, 'CodeUpdate/index')
  const originalStyle = h.screenshots[0].data.theme.style
  assert.equal(declarations(originalStyle)['--git-width'], '720px')
  assert.equal(declarations(originalStyle)['--git-accent'], '#217754')
  configured.Name = 'classic'
  await generateScreenshot(content, 'switch')
  assert.equal(h.screenshots[1].template, 'CodeUpdate/classic')
  assert.equal(h.screenshots[1].data.theme.style, '')
  assert.equal(configured.Width, 720)
  assert.equal(configured.Accent, '#217754')
  configured.Name = 'forest'
  await generateScreenshot(content, 'switch')
  assert.equal(h.screenshots[2].template, 'CodeUpdate/index')
  assert.equal(h.screenshots[2].data.theme.style, originalStyle)
  assert.ok(h.screenshots.every(screenshot => screenshot.options.multiPage === false))
})

test('默认YAML、锅巴和渲染器均使用海盐蓝，并保留经典原版及全部新主题入口', () => {
  const h = createHarness()
  const { resolveCodeUpdateTheme } = h.load('@CodeUpdate/utils/theme')
  const defaults = require('yaml').parse(fs.readFileSync(path.join(project, 'resources/config/default_config.yaml'), 'utf8'))
  const schemas = h.load('@/modules/guoba/schemas/CodeUpdate').CodeUpdate
  const selection = schemas.find(schema => schema.field === 'CodeUpdate.Theme.Name')
  assert.equal(defaults.CodeUpdate.Theme.Name, 'ocean')
  assert.equal(selection.defaultValue, defaults.CodeUpdate.Theme.Name)
  assert.equal(resolveCodeUpdateTheme().name, defaults.CodeUpdate.Theme.Name)
  assert.equal(resolveCodeUpdateTheme({ Name: 'invalid' }).name, defaults.CodeUpdate.Theme.Name)
  assert.deepEqual(plain(selection.componentProps.options.map(option => option.value)), ['classic', 'dark', 'light', 'ocean', 'forest', 'sunset', 'lavender'])
})

test('截图每次读取主题和分片配置，达到阈值时返回全部分片', async () => {
  const h = createHarness({ config: { multiPage: 4, Theme: { Name: 'ocean', Accent: '#135ace', Width: 720, Radius: 12 } } })
  const { generateScreenshot } = h.load('@CodeUpdate/services/screenshot')
  const content = displayFixtures()
  const result = await generateScreenshot(content, 'preview')
  assert.equal(imageCount(result), 2)
  assert.equal(h.screenshots[0].options.multiPage, true)
  assert.equal(h.screenshots[0].data.theme.name, 'ocean')
  assert.equal(h.screenshots[0].data.renderInfo.repositories, 2)
  assert.equal(h.screenshots[0].data.renderInfo.updates, 4)
  assert.equal(declarations(h.screenshots[0].data.theme.style)['--git-width'], '720px')
  h.config.CodeUpdate.Theme = { Name: 'sunset' }
  h.config.CodeUpdate.multiPage = 5
  assert.equal(imageCount(await generateScreenshot(content, 'preview')), 1)
  assert.equal(h.screenshots[1].options.multiPage, false)
  assert.equal(h.screenshots[1].data.theme.name, 'sunset')
})

test('多个推送组主动推送只汇总一次，去重后全部分片与活动链接同次回复', async () => {
  const h = createHarness({ config: { multiPage: 1, Activity: { BatchSize: 1, InitialLimit: 20, SendLinks: true } } })
  subscribe(h, 'commits', { branch: 'main' }, 1)
  subscribe(h, 'commits', { branch: 'main' }, 2)
  subscribe(h, 'commits', { branch: 'dev' }, 3)
  subscribe(h, 'releases', { includeDrafts: true }, 1)
  subscribe(h, 'releases', { includeDrafts: false }, 2)
  subscribe(h, 'issues', { labels: ['bug'] }, 1)
  subscribe(h, 'issues', {}, 2)
  subscribe(h, 'issues', { labels: ['feature'] }, 3)
  subscribe(h, 'pulls', {}, 2)
  installPreviewRouter(h)
  const replies = []
  const result = await h.load('@CodeUpdate').CodeUpdate(false, { user_id: 999, reply: async message => { replies.push(message); return true } })
  assert.equal(result, 1)
  assert.equal(h.screenshots.length, 1)
  assert.equal(h.screenshots[0].template, 'CodeUpdate/index')
  assert.equal(h.screenshots[0].data.theme.name, 'ocean')
  assert.equal(h.screenshots[0].options.multiPage, true)
  const visible = h.screenshots[0].data.lifeData
  assert.equal(visible.length, 6)
  assert.deepEqual(visible.filter(value => value.name.branch).map(value => value.name.branch).sort(), ['dev', 'main'])
  assert.equal(visible.filter(value => value.release).length, 1)
  assert.deepEqual(visible.filter(value => value.activity).map(value => `${value.detail.kind}:${value.detail.number}`).sort(), ['Issue:1', 'Issue:2', 'PR:50'])
  const imageReplies = replies.filter(message => imageCount(message))
  assert.equal(imageReplies.length, 1)
  assert.deepEqual(plain(imageReplies[0].filter(value => typeof value === 'object')), [{ type: 'image', file: 'page1' }, { type: 'image', file: 'page2' }])
  const links = imageReplies[0].filter(value => typeof value === 'string').join('\n').trim().split('\n').sort()
  assert.deepEqual(plain(links), ['https://github.com/owner/repo/issues/1', 'https://github.com/owner/repo/issues/2', 'https://github.com/owner/repo/pull/50'])
  assert.equal(h.deliveries.length, 0)
  assert.equal(h.store.size, 0)
  assert.equal(h.redisWrites.length, 0)
})

for (const theme of ['classic', 'light']) {
  for (const [threshold, pages, label] of [[4, 1, '低于阈值'], [3, 2, '等于阈值'], [-1, 1, '关闭分片']]) {
    test(`${theme}主动汇总在${label}时按配置渲染，所有图片一次回复`, async () => {
      const h = createHarness({ config: { multiPage: threshold, Theme: { Name: theme } } })
      subscribe(h, 'issues', {}, 1)
      subscribe(h, 'issues', { labels: ['bug'] }, 2)
      subscribe(h, 'pulls', {}, 3)
      installPreviewRouter(h)
      const replies = []
      const result = await h.load('@CodeUpdate').CodeUpdate(false, { user_id: 999, reply: async message => { replies.push(message); return true } })
      assert.equal(result, 1)
      assert.equal(h.screenshots.length, 1)
      assert.equal(h.screenshots[0].template, theme === 'classic' ? 'CodeUpdate/classic' : 'CodeUpdate/index')
      assert.equal(h.screenshots[0].data.lifeData.length, 3)
      assert.equal(h.screenshots[0].options.multiPage, pages > 1)
      const imageReplies = replies.filter(message => imageCount(message))
      assert.equal(imageReplies.length, 1)
      assert.equal(imageCount(imageReplies[0]), pages)
      assert.equal(h.deliveries.length, 0)
      assert.equal(h.store.size, 0)
      assert.equal(h.redisWrites.length, 0)
    })
  }
}

test('手动合并图渲染失败仅报告一次失败，不推进自动状态或降级成逐组发送', async () => {
  const h = createHarness({ config: { multiPage: 1, Activity: { BatchSize: 1 } } })
  subscribe(h, 'issues', {}, 1)
  subscribe(h, 'pulls', {}, 2)
  installPreviewRouter(h)
  h.render = false
  const replies = []
  const result = await h.load('@CodeUpdate').CodeUpdate(false, { user_id: 999, reply: async message => { replies.push(message); return true } })
  assert.equal(result, false)
  assert.equal(h.screenshots.length, 1)
  assert.equal(h.deliveries.length, 0)
  assert.equal(h.redisWrites.length, 0)
  assert.equal(replies.filter(message => typeof message === 'string' && message.includes('截图失败')).length, 1)
})

test('合并渲染抛异常时回复失败并释放检查锁，下次预览可恢复且自动状态不变', async () => {
  const h = createHarness({ config: { multiPage: 1, Activity: { BatchSize: 1 } } })
  subscribe(h, 'issues', {}, 1)
  subscribe(h, 'pulls', {}, 2)
  installPreviewRouter(h)
  h.renderError = new Error('fixture browser screenshot failed')
  const replies = []
  const event = { user_id: 999, reply: async message => { replies.push(message); return true } }
  const { CodeUpdate } = h.load('@CodeUpdate')
  assert.equal(await CodeUpdate(false, event), false)
  assert.equal(h.screenshots.length, 1)
  assert.equal(replies.filter(message => typeof message === 'string' && message.includes('截图失败')).length, 1)
  assert.equal(h.redisWrites.length, 0)
  assert.equal(h.deliveries.length, 0)
  h.renderError = undefined
  assert.equal(await CodeUpdate(false, event), 1)
  assert.equal(h.screenshots.length, 2)
  assert.equal(replies.filter(message => imageCount(message)).length, 1)
  assert.equal(h.redisWrites.length, 0)
})

test('所有主题兼容四类卡片与代码差异，缺少主题数据的旧模板调用仍能渲染', () => {
  const h = createHarness()
  const { CODE_UPDATE_THEMES, resolveCodeUpdateTheme } = h.load('@CodeUpdate/utils/theme')
  const template = require('art-template')
  const data = { lifeData: displayFixtures(), pluResPath: path.join(project, 'resources'), sys: { scale: '', copyright: 'fixture' } }
  for (const preset of CODE_UPDATE_THEMES) {
    const filename = path.join(project, 'resources/CodeUpdate', preset.name === 'classic' ? 'classic.html' : 'index.html')
    const html = template(filename, { ...data, theme: resolveCodeUpdateTheme({ Name: preset.name }), renderInfo: { repositories: 2, updates: 4 } })
    if (preset.name === 'classic') {
      assert.match(html, /CodeUpdate\/classic\.css/)
      assert.match(html, /Git仓库更新推送/)
      assert.doesNotMatch(html, /header-topline|--git-width|--git-accent/)
    } else assert.match(html, new RegExp(`data-theme="${preset.name}"`))
    for (const text of ['PR #128', 'Issue #64', 'release-card', '已折叠 2 个文件', 'diff-add', 'diff-delete', '中文翻译']) assert.ok(html.includes(text), `${preset.name}: ${text}`)
  }
  for (const filename of ['classic.html', 'index.html']) {
    const html = template(path.join(project, 'resources/CodeUpdate', filename), data)
    if (filename === 'index.html') {
      assert.match(html, /data-theme="ocean"/)
      assert.match(html, /海盐蓝/)
    } else assert.match(html, /CodeUpdate\/classic\.css/)
  }
})
