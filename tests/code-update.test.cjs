const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness, item, subscribe, project, plain } = require('./helpers/code-update.cjs')

function installRouter (harness, data) {
  harness.router = url => {
    const route = url.pathname.match(/\/(pulls|issues)(?:\/([^/]+))?(?:\/comments)?$/)
    if (!route) return { data: [] }
    const [full, method, number] = route
    if (full.endsWith('/comments')) return { data: data.comments || [] }
    if (number) return { data: (data[method] || []).find(value => String(value.number) === number) }
    return { data: data[method] || [] }
  }
}

test('完整流程：首次静默建基线，多个Issue与PR按群的标签筛选发送', async () => {
  const h = createHarness()
  subscribe(h, 'issues', { labels: ['bug'] }, 1)
  subscribe(h, 'issues', { labels: ['feature'] }, 2)
  subscribe(h, 'pulls', {}, 1)
  const data = { issues: [item(1)], pulls: [item(10)] }
  installRouter(h, data)
  const { CodeUpdate } = h.load('@CodeUpdate')
  assert.equal(await CodeUpdate(true), 0)
  assert.equal(h.deliveries.length, 0)
  assert.equal(h.store.size, 2)
  h.setNow('2026-11-10T08:02:00Z')
  data.issues.push(item(2, { created_at: '2026-11-10T08:01:00Z', updated_at: '2026-11-10T08:01:00Z' }))
  data.issues.push(item(3, { labels: ['feature'], created_at: '2026-11-10T08:01:01Z', updated_at: '2026-11-10T08:01:01Z' }))
  data.pulls[0] = item(10, { state: 'closed', merged_at: '2026-11-10T08:01:30Z', updated_at: '2026-11-10T08:01:30Z', changed_files: 3, additions: 20, deletions: 4 })
  assert.equal(await CodeUpdate(true), 1)
  assert.equal(h.deliveries.length, 2)
  const first = h.screenshots.find(value => value.data.saveId === '1')
  const second = h.screenshots.find(value => value.data.saveId === '2')
  assert.deepEqual(first.data.lifeData.map(value => value.detail.number).sort(), ['10', '2'])
  assert.deepEqual(second.data.lifeData.map(value => value.detail.number), ['3'])
  assert.equal(first.options.multiPage, true)
  assert.ok(h.deliveries[0].message.some(value => typeof value === 'string' && value.includes('https://github.com/')))
  assert.equal(await CodeUpdate(true), 0)
  assert.equal(h.deliveries.length, 2)
})

test('按接收者重试旧事件，新活动不会覆盖失败的消息', async () => {
  const h = createHarness()
  subscribe(h, 'issues', {}, 1)
  subscribe(h, 'issues', {}, 2)
  const data = { issues: [] }
  installRouter(h, data)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  h.failures.add('Group:2')
  h.setNow('2026-11-10T08:02:00Z')
  data.issues = [item(1, { created_at: '2026-11-10T08:01:00Z', updated_at: '2026-11-10T08:01:00Z' })]
  await CodeUpdate(true)
  h.failures.clear()
  h.setNow('2026-11-10T08:04:00Z')
  data.issues.push(item(2, { created_at: '2026-11-10T08:03:00Z', updated_at: '2026-11-10T08:03:00Z' }))
  await CodeUpdate(true)
  const recent = h.screenshots.slice(-2)
  assert.deepEqual(recent.find(value => value.data.saveId === '1').data.lifeData.map(value => value.detail.number), ['2'])
  assert.deepEqual(recent.find(value => value.data.saveId === '2').data.lifeData.map(value => value.detail.number), ['1', '2'])
  const journal = [...h.store.values()].map(JSON.parse)[0]
  assert.deepEqual(journal.pending, {})
})

test('积压活动分批发送，成功的批次独立确认', async () => {
  const h = createHarness({ config: { Activity: { BatchSize: 2 } } })
  subscribe(h)
  const data = { issues: [] }
  installRouter(h, data)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  data.issues = [1, 2, 3, 4, 5].map(number => item(number, { created_at: `2026-11-10T08:01:0${number}Z`, updated_at: `2026-11-10T08:01:0${number}Z` }))
  h.setNow('2026-11-10T08:02:00Z')
  h.failDelivery = () => h.deliveries.length === 2
  await CodeUpdate(true)
  assert.equal(Object.keys(JSON.parse([...h.store.values()][0]).pending).length, 3)
  h.failDelivery = () => false
  await CodeUpdate(true)
  assert.deepEqual(h.screenshots.map(value => value.data.lifeData.length), [2, 2, 2, 1])
  assert.equal(h.deliveries.length, 4)
  assert.deepEqual(JSON.parse([...h.store.values()][0]).pending, {})
})

test('网络失败时仍发送已有待投递事件，并保留原检查时间', async () => {
  const h = createHarness()
  subscribe(h)
  const data = { issues: [] }
  installRouter(h, data)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  h.failures.add('Group:10001')
  h.setNow('2026-11-10T08:02:00Z')
  data.issues = [item(1, { updated_at: '2026-11-10T08:01:00Z' })]
  await CodeUpdate(true)
  const key = [...h.store.keys()][0]
  const checkedAt = JSON.parse(h.store.get(key)).checkedAt
  h.router = () => ({ status: 500 })
  h.failures.clear()
  h.setNow('2026-11-10T08:04:00Z')
  assert.equal(await CodeUpdate(true), 1)
  assert.equal(JSON.parse(h.store.get(key)).checkedAt, checkedAt)
  assert.deepEqual(JSON.parse(h.store.get(key)).pending, {})
})

test('截图与Redis写入失败均可恢复，消息在持久化之前不发送', async () => {
  const h = createHarness()
  subscribe(h)
  const data = { issues: [] }
  installRouter(h, data)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  data.issues = [item(1, { updated_at: '2026-11-10T08:01:00Z' })]
  h.setNow('2026-11-10T08:02:00Z')
  h.failWrite = true
  await CodeUpdate(true)
  assert.equal(h.deliveries.length, 0)
  assert.deepEqual(JSON.parse([...h.store.values()][0]).items, {})
  h.failWrite = false
  h.render = false
  await CodeUpdate(true)
  assert.equal(h.deliveries.length, 0)
  assert.equal(Object.keys(JSON.parse([...h.store.values()][0]).pending).length, 1)
  h.render = true
  await CodeUpdate(true)
  assert.equal(h.deliveries.length, 1)
})

test('手动预览不改变自动推送状态，限制条目数量并沿用订阅筛选', async () => {
  const h = createHarness({ config: { Activity: { InitialLimit: 1 } } })
  subscribe(h, 'issues', { labels: ['bug'] })
  const data = { issues: [item(1), item(2, { labels: ['feature'] }), item(3, { updated_at: '2026-11-10T07:59:00Z' })] }
  installRouter(h, data)
  const { CodeUpdate } = h.load('@CodeUpdate')
  const replies = []
  assert.equal(await CodeUpdate(false, { user_id: 999, reply: async value => replies.push(value) }), 1)
  assert.equal(h.store.size, 0)
  assert.equal(h.deliveries.length, 0)
  assert.deepEqual(h.screenshots[0].data.lifeData.map(value => value.detail.number), ['3'])
  assert.ok(Array.isArray(replies.at(-1)))
  await CodeUpdate(true)
  assert.equal(h.deliveries.length, 0)
})

test('首次推送尊重上限，关闭首次推送仍保存机器人及草稿的基线', async () => {
  const h = createHarness({ config: { FirstAdd: true, Activity: { InitialLimit: 1 } } })
  subscribe(h, 'pulls')
  const data = { pulls: [item(1), item(2, { draft: true }), item(3, { user: { login: 'robot[bot]' } })] }
  installRouter(h, data)
  await h.load('@CodeUpdate').CodeUpdate(true)
  assert.equal(h.screenshots[0].data.lifeData.length, 1)
  const journal = JSON.parse([...h.store.values()][0])
  assert.equal(Object.keys(journal.items).length, 3)
  data.pulls[1] = item(2, { draft: false, updated_at: '2026-11-10T08:01:00Z' })
  h.setNow('2026-11-10T08:02:00Z')
  await h.load('@CodeUpdate').CodeUpdate(true)
  assert.equal(h.screenshots.at(-1).data.lifeData[0].detail.actions[0], '转为正式')
})

test('正文、标签、新代码、重开、关闭和草稿状态分别识别，单纯更新时间不会触发', () => {
  const h = createHarness()
  const utils = h.load('@CodeUpdate/utils/activity')
  const original = utils.normalizeActivityItem(item(1), 'pulls')
  const before = utils.activitySnapshot(original)
  const cases = [
    [{ body: '新正文' }, ['edited']],
    [{ labels: ['bug', 'feature'] }, ['labeled']],
    [{ labels: [] }, ['unlabeled']],
    [{ head: { sha: 'bbbb' } }, ['synchronize']],
    [{ state: 'closed', closed_at: '2026-11-10T08:00:00Z' }, ['closed']],
    [{ draft: true }, ['converted_to_draft']],
    [{ updated_at: '2026-11-10T08:00:00Z' }, []]
  ]
  for (const [changes, expected] of cases) assert.deepEqual(plain(utils.detectActivityActions(utils.normalizeActivityItem(item(1, changes), 'pulls'), before)), expected)
  assert.deepEqual(plain(utils.detectActivityActions(original, { ...before, state: 'closed' })), ['reopened'])
})

test('同一条目多条新评论逐条发送，回看窗口内已发送评论不重复', async () => {
  const h = createHarness()
  subscribe(h, 'issues', { events: ['commented'] })
  const data = { issues: [item(1)], comments: [] }
  installRouter(h, data)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  h.setNow('2026-11-10T08:02:00Z')
  data.issues[0] = item(1, { comments: 2, updated_at: '2026-11-10T08:01:30Z' })
  data.comments = [100, 101].map(id => ({ id, body: `评论${id}`, html_url: `https://github.com/owner/repo/issues/1#issuecomment-${id}`, created_at: '2026-11-10T08:01:00Z', user: { login: 'bob' } }))
  await CodeUpdate(true)
  assert.equal(h.screenshots[0].data.lifeData.length, 2)
  h.setNow('2026-11-10T08:03:00Z')
  data.issues[0] = item(1, { comments: 3, updated_at: '2026-11-10T08:02:10Z' })
  data.comments.push({ id: 102, body: '第三条评论', created_at: '2026-11-10T08:02:10Z', user: { login: 'bob' } })
  await CodeUpdate(true)
  assert.equal(h.screenshots.at(-1).data.lifeData.length, 1)
  assert.match(h.screenshots.at(-1).data.lifeData[0].text, /第三条评论/)
  assert.equal(JSON.parse([...h.store.values()][0]).items['1'].lastCommentId, '102')
})

test('作者、排除标签、机器人和目标分支筛选可组合使用', () => {
  const h = createHarness()
  const utils = h.load('@CodeUpdate/utils/activity')
  const rule = { provider: 'GitHub', repo: 'owner/repo', type: 'pulls', labels: ['BUG'], authors: ['ALICE'], baseBranches: ['main'] }
  const event = utils.makeActivityEvent(rule, utils.normalizeActivityItem(item(1), 'pulls'), ['opened'])
  assert.equal(utils.matchesActivity(event, rule), true)
  for (const changes of [{ excludeLabels: ['bug'] }, { authors: ['bob'] }, { baseBranches: ['dev'] }, { excludeAuthors: ['alice'] }]) assert.equal(utils.matchesActivity(event, { ...rule, ...changes }), false)
  event.item.bot = true
  assert.equal(utils.matchesActivity(event, rule), false)
  assert.equal(utils.matchesActivity(event, { ...rule, excludeBots: false }), true)
})

test('标签筛选仍能收到移除该标签的事件', async () => {
  const h = createHarness()
  subscribe(h, 'issues', { labels: ['bug'], events: ['unlabeled'] })
  const data = { issues: [item(1)] }
  installRouter(h, data)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  data.issues[0] = item(1, { labels: [], updated_at: '2026-11-10T08:01:00Z' })
  h.setNow('2026-11-10T08:02:00Z')
  await CodeUpdate(true)
  assert.equal(h.screenshots[0].data.lifeData[0].detail.actions[0], '移除标签')
})

test('更新时间相同的新增评论仍被获取，时间边界不丢失', async () => {
  const h = createHarness()
  subscribe(h, 'issues', { events: ['commented'] })
  const data = { issues: [item(1, { comments: 1, updated_at: '2026-11-10T08:00:00Z' })], comments: [] }
  installRouter(h, data)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  data.comments = [{ id: 100, body: '边界评论', created_at: '2026-11-10T08:00:00Z', user: { login: 'bob' } }]
  h.setNow('2026-11-10T08:00:30Z')
  await CodeUpdate(true)
  assert.equal(h.screenshots[0].data.lifeData.length, 1)
})

test('GitHub分页包含已关闭记录、排除PR，并只请求一次相同数据源', async () => {
  const h = createHarness()
  h.router = url => Number(url.searchParams.get('page')) === 1
    ? { data: [item(1, { pull_request: {} })], link: '<https://api.github.com/next>; rel="next"' }
    : { data: [item(2, { state: 'closed' })], link: '<https://api.github.com/prev>; rel="prev"' }
  const api = h.load('@/modules/GitApi').default
  const result = await api.getActivityItems('GitHub', 'owner/repo', 'issues', { pageSize: 1, maxPages: 5, since: '2026-11-10T07:00:00Z' })
  assert.deepEqual(plain(result).map(value => value.number), [2])
  assert.equal(h.requests.length, 2)
  assert.equal(h.requests[0].url.searchParams.get('state'), 'all')
  assert.equal(h.requests[0].url.searchParams.get('since'), '2026-11-10T07:00:00Z')
  assert.equal(h.requests[0].headers.Authorization, 'Bearer fixture-token')
})

test('分页上限或后续页面失败不会建立或推进基线', async () => {
  for (const failSecond of [false, true]) {
    const h = createHarness({ config: { Activity: { PageSize: 1, MaxPages: failSecond ? 2 : 1 } } })
    subscribe(h)
    h.router = url => Number(url.searchParams.get('page')) === 1 ? { data: [item(1)], link: '<https://api.github.com/next>; rel="next"' } : { status: 500 }
    await h.load('@CodeUpdate').CodeUpdate(true)
    assert.equal(h.store.size, 0)
    assert.equal(h.deliveries.length, 0)
  }
})

test('增量扫描回看时间边界；PR不发送不受支持的since参数', async () => {
  const h = createHarness()
  h.router = () => ({ data: [item(1, { updated_at: '2026-11-10T06:00:00Z' })], link: '<https://api.github.com/next>; rel="next"' })
  const result = await h.load('@/modules/GitApi').default.getActivityItems('GitHub', 'owner/repo', 'pulls', { pageSize: 100, maxPages: 3, since: '2026-11-10T07:00:00Z' })
  assert.deepEqual(plain(result), [])
  assert.equal(h.requests.length, 1)
  assert.equal(h.requests[0].url.searchParams.has('since'), false)
})

test('Gitea使用limit及recentupdate，Gitee令牌和PR评论路径正确', async () => {
  const h = createHarness()
  h.config.CodeUpdate.repos.push({ provider: 'MyGitea', ApiUrl: 'https://git.example/api/v1/repos', token: 'gitea-token' }, { provider: 'Gitee', ApiUrl: 'https://gitee.com/api/v5/repos', token: 'gitee-token' })
  const api = h.load('@/modules/GitApi').default
  await api.getActivityItems('MyGitea', 'owner/repo', 'pulls', { pageSize: 20, maxPages: 2 })
  assert.equal(h.requests[0].url.searchParams.get('limit'), '20')
  assert.equal(h.requests[0].url.searchParams.get('sort'), 'recentupdate')
  await api.getActivityComments('Gitee', 'owner/repo', 'pulls', '5', { pageSize: 20, maxPages: 2, since: '2026-11-10T07:00:00Z' })
  assert.match(h.requests.at(-1).url.pathname, /\/pulls\/5\/comments$/)
  assert.equal(h.requests.at(-1).url.searchParams.get('access_token'), 'gitee-token')
  assert.equal(api.supportsActivity('CNB'), false)
})

test('合并状态不明确时获取详情，详情失败不误报关闭', async () => {
  const h = createHarness()
  subscribe(h, 'pulls')
  const data = { pulls: [item(1)] }
  installRouter(h, data)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  const before = [...h.store.values()][0]
  data.pulls[0] = item(1, { state: 'closed', merged_at: undefined, updated_at: '2026-11-10T08:01:00Z' })
  h.router = url => /\/pulls\/1$/.test(url.pathname) ? { status: 500 } : { data: data.pulls }
  h.setNow('2026-11-10T08:02:00Z')
  await CodeUpdate(true)
  assert.equal([...h.store.values()][0], before)
  assert.equal(h.deliveries.length, 0)
  h.router = url => /\/pulls\/1$/.test(url.pathname) ? { data: item(1, { state: 'closed', merged: true, updated_at: '2026-11-10T08:01:00Z' }) } : { data: data.pulls }
  await CodeUpdate(true)
  assert.equal(h.screenshots[0].data.lifeData[0].detail.state, 'merged')
})

test('取消订阅后清理过期投递，有效活动记录不会被无效数据清理误删', async () => {
  const h = createHarness()
  subscribe(h)
  const data = { issues: [] }
  installRouter(h, data)
  const module = h.load('@CodeUpdate')
  await module.CodeUpdate(true)
  h.failures.add('Group:10001')
  h.setNow('2026-11-10T08:02:00Z')
  data.issues = [item(1, { updated_at: '2026-11-10T08:01:00Z' })]
  await module.CodeUpdate(true)
  assert.ok((await module.getAllRedisKey()).includes([...h.store.keys()][0]))
  h.config.CodeUpdate.List[0].Group = []
  await module.CodeUpdate(true)
  assert.deepEqual(JSON.parse([...h.store.values()][0]).pending, {})
})

test('原有Commit和Release自动去重与手动预览保持可用', async () => {
  const h = createHarness()
  subscribe(h, 'commits', { branch: 'main' })
  subscribe(h, 'releases')
  const commit = {
    sha: 'abcdef', commit: { message: 'feat: 新功能', author: { name: 'alice', date: '2026-11-10T08:00:00Z' }, committer: { name: 'alice', date: '2026-11-10T08:00:00Z' } }, author: { avatar_url: '' }, committer: { avatar_url: '' }
  }
  const release = { id: 1, tag_name: 'v1', name: '版本1', body: '发布正文', published_at: '2026-11-10T08:00:00Z', author: { login: 'alice' } }
  h.router = url => ({ data: url.pathname.includes('/commits') ? commit : [release] })
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  assert.equal(h.deliveries.length, 0)
  commit.sha = 'abcdef2'
  release.id = 2
  assert.equal(await CodeUpdate(true), 1)
  assert.equal(h.screenshots[0].data.lifeData.length, 2)
  assert.equal(await CodeUpdate(true), 0)
  assert.equal(await CodeUpdate(false, { user_id: 1, reply: async () => true }), 1)
})

test('卡片格式化处理翻译、Markdown和不可信HTML，模板兼容四种数据', async () => {
  const h = createHarness({ config: { Translate: true } })
  const utils = h.load('@CodeUpdate/utils/activity')
  const event = utils.makeActivityEvent({ provider: 'GitHub', repo: 'owner/repo', type: 'pulls' }, utils.normalizeActivityItem(item(1, { title: '<script>标题</script>', body: '<script>alert(1)</script>\n\n[坏链接](javascript:alert(1))\n\n![截图](https://example.com/a.png)\n\n**加粗**' }), 'pulls'), ['opened'])
  const info = await h.load('@CodeUpdate/utils/formatActivity').formatActivityInfo(event)
  assert.match(info.text, /&lt;script&gt;/)
  assert.doesNotMatch(info.text, /<script|href="javascript:|<img/i)
  assert.match(info.text, /<strong>加粗<\/strong>/)
  assert.equal(info.translate.label, '测试翻译')
  const template = require('art-template')
  const format = h.load('@CodeUpdate/utils/format')
  const commit = await format.formatCommitInfo({ sha: 'abcde', commit: { message: 'fix: 修复', author: { name: 'alice' }, committer: { name: 'alice' } } }, 'GitHub', 'owner/repo', 'main')
  const release = await format.formatReleaseInfo({ tag_name: 'v1', author: { login: 'alice' } }, 'GitHub', 'owner/repo')
  const issue = { ...plain(info), detail: { ...plain(info.detail), kind: 'Issue', baseBranch: '', headBranch: '' } }
  const html = template(path.join(project, 'resources/CodeUpdate/index.html'), { pluResPath: path.join(project, 'resources'), sys: { scale: '', copyright: 'test' }, lifeData: [commit, release, plain(info), issue] })
  for (const value of ['PR #1', 'Issue #1', 'Releases', 'activity-state']) assert.ok(html.includes(value), value)
})

test('默认配置与锅巴表单覆盖所有活动设置和筛选项', () => {
  const defaults = require('yaml').parse(fs.readFileSync(path.join(project, 'resources/config/default_config.yaml'), 'utf8'))
  const h = createHarness()
  const schemas = h.load('@/modules/guoba/schemas/CodeUpdate').CodeUpdate
  const fields = new Set()
  const walk = values => values.forEach(value => { if (value.field) fields.add(value.field); if (value.componentProps?.schemas) walk(value.componentProps.schemas) })
  walk(schemas)
  for (const key of Object.keys(defaults.CodeUpdate.Activity)) assert.ok(fields.has(`CodeUpdate.Activity.${key}`), key)
  for (const key of ['events', 'labels', 'excludeLabels', 'authors', 'excludeAuthors', 'excludeBots', 'includeDrafts', 'baseBranches']) assert.ok(fields.has(key), key)
})

test('无效时间或损坏记录不会静默推进游标或覆盖数据', async () => {
  const h = createHarness()
  subscribe(h)
  installRouter(h, { issues: [item(1, { updated_at: 'invalid' })] })
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  assert.equal(h.store.size, 0)
  const redis = h.load('@CodeUpdate/utils/redis').redisHeler
  const key = redis.getActivityKey(redis.getRedisKey('GitHub', 'issues', 'owner/repo', ''))
  h.store.set(key, '{broken')
  await CodeUpdate(true)
  assert.equal(h.store.get(key), '{broken')
  assert.equal(h.deliveries.length, 0)
})

function commit (sha) {
  return { sha, commit: { message: `fix: ${sha}`, author: { name: 'alice', date: '2026-11-10T08:00:00Z' }, committer: { name: 'alice' } } }
}

test('一个仓库同时监听四种类型，多分支独立去重且每种活动只查询一次', async () => {
  const h = createHarness({ config: { FirstAdd: true } })
  subscribe(h, ['commits', 'releases', 'pulls', 'issues'], { branch: ['main', 'feature/a'], labels: ['bug'] }, 1)
  subscribe(h, ['commits', 'pulls', 'issues'], { branch: ['feature/a'], labels: ['feature'] }, 2)
  h.router = url => {
    if (url.pathname.includes('/commits/')) return { data: commit(decodeURIComponent(url.pathname.split('/commits/')[1])) }
    if (url.pathname.endsWith('/releases')) return { data: [{ id: 1, tag_name: 'v1', author: { login: 'alice' } }] }
    const number = url.pathname.match(/\/pulls\/(\d+)$/)?.[1]
    if (number) return { data: item(Number(number), Number(number) === 2 ? { labels: ['feature'] } : {}) }
    return { data: [item(1), item(2, { labels: ['feature'] })] }
  }
  const module = h.load('@CodeUpdate')
  assert.equal(await module.CodeUpdate(true), 1)
  assert.equal(h.requests.filter(value => !/\/(pulls|issues)\/\d+$/.test(value.url.pathname)).length, 5)
  assert.match(h.requests[1].url.pathname, /feature%2Fa/)
  assert.equal(h.screenshots.find(value => value.data.saveId === '1').data.lifeData.length, 5)
  assert.equal(h.screenshots.find(value => value.data.saveId === '2').data.lifeData.length, 3)
  assert.equal(await module.CodeUpdate(true), 0)
  assert.equal(h.deliveries.length, 2)
})

test('空分支总是自动解析默认分支、保留原游标身份，五分钟后发现默认分支变化', async () => {
  const h = createHarness({ config: { AutoBranch: false } })
  subscribe(h, 'commits', { branch: [] })
  let branch = 'main'
  h.router = url => ({ data: url.pathname.endsWith('/owner/repo') ? { default_branch: branch } : commit(decodeURIComponent(url.pathname.split('/commits/')[1])) })
  const module = h.load('@CodeUpdate')
  await module.CodeUpdate(true)
  assert.equal(h.requests[1].url.pathname.endsWith('/commits/main'), true)
  assert.ok(h.store.has('fixture:CodeUpdate:GitHub:owner/repo'))
  branch = 'dev'
  h.setNow('2026-11-10T08:04:00Z')
  await module.CodeUpdate(true)
  assert.equal(h.requests.filter(value => value.url.pathname.endsWith('/owner/repo')).length, 1)
  h.setNow('2026-11-10T08:06:00Z')
  await module.CodeUpdate(true)
  assert.equal(h.requests.at(-1).url.pathname.endsWith('/commits/dev'), true)
  assert.equal(h.deliveries.length, 1)
  assert.equal(h.screenshots[0].data.lifeData[0].name.branch, 'dev')
})

test('默认分支失败不请求不明确的提交、不推进游标，下次可恢复，其他类型继续检查', async () => {
  const h = createHarness()
  subscribe(h, ['commits', 'issues'])
  h.router = url => url.pathname.endsWith('/issues') ? { data: [] } : { status: 500 }
  const module = h.load('@CodeUpdate')
  await module.CodeUpdate(true)
  assert.equal(h.requests.some(value => value.url.pathname.includes('/commits')), false)
  assert.equal(h.store.size, 1)
  h.router = url => ({ data: url.pathname.endsWith('/owner/repo') ? { default_branch: 'main' } : url.pathname.includes('/commits/') ? commit('abc') : [] })
  await module.CodeUpdate(true)
  assert.equal(h.store.size, 2)
})

test('all每次刷新并跨接收者共享一次分支发现，新增分支独立初始化', async () => {
  const h = createHarness()
  subscribe(h, ['commits', 'issues'], { branch: ['all', 'ignored'] }, 1)
  subscribe(h, 'commits', { branch: 'all' }, 2)
  const names = ['main', 'dev']
  let changed = false
  h.router = url => ({ data: url.pathname.endsWith('/branches') ? Number(url.searchParams.get('page')) === 1 ? names.map(name => ({ name })) : [] : url.pathname.endsWith('/issues') ? [] : commit(`${decodeURIComponent(url.pathname.split('/commits/')[1])}-${changed}`) })
  const module = h.load('@CodeUpdate')
  await module.CodeUpdate(true)
  assert.equal(h.requests.filter(value => value.url.pathname.endsWith('/branches')).length, 2)
  assert.equal(h.requests.length, 5)
  names.push('feature/new')
  changed = true
  await module.CodeUpdate(true)
  assert.equal(h.requests.filter(value => value.url.pathname.endsWith('/branches')).length, 4)
  assert.equal(h.deliveries.length, 2)
  assert.equal(h.screenshots[0].data.lifeData.length, 2)
  assert.ok(h.store.has('fixture:CodeUpdate:GitHub:owner/repo:feature/new'))
  const active = await module.getAllRedisKey()
  for (const key of h.store.keys()) assert.ok(active.includes(key), key)
})

test('all后续页失败不会使用部分分支列表，清理拒绝删除记录且其他类型仍工作', async () => {
  const h = createHarness()
  subscribe(h, ['commits', 'issues'], { branch: ['all'] })
  h.router = url => url.pathname.endsWith('/issues')
    ? { data: [] }
    : Number(url.searchParams.get('page')) === 1
      ? { data: [{ name: 'main' }], link: '<https://api.github.com/next>; rel="next"' }
      : { status: 500 }
  const module = h.load('@CodeUpdate')
  await module.CodeUpdate(true)
  assert.equal(h.requests.some(value => value.url.pathname.includes('/commits')), false)
  assert.equal(h.store.size, 1)
  await assert.rejects(module.getAllRedisKey(), /本次不清理/)
  assert.equal(h.store.size, 1)
})

test('分支发现完整分页、去重并使用各提供商参数，默认Api地址仍带令牌', async () => {
  const h = createHarness()
  h.config.CodeUpdate.repos[0].ApiUrl = ''
  h.router = url => Number(url.searchParams.get('page')) === 1
    ? { data: [{ name: 'main' }], link: '<https://api.github.com/next>; rel="next"' }
    : { data: [{ name: 'main' }, { name: 'feature/a' }], link: '<https://api.github.com/prev>; rel="prev"' }
  const api = h.load('@/modules/GitApi').default
  assert.deepEqual(plain(await api.getBranches('GitHub', 'owner/repo')), ['main', 'feature/a'])
  assert.equal(h.requests[0].headers.Authorization, 'Bearer fixture-token')
  h.config.CodeUpdate.repos.push({ provider: 'MyGitea', ApiUrl: 'https://gitea.example/api/v1/repos' }, { provider: 'Gitee', token: 'gitee-token' })
  await api.getBranches('MyGitea', 'owner/repo')
  assert.equal(h.requests.at(-1).url.searchParams.get('limit'), '100')
  await api.getBranches('Gitee', 'owner/repo')
  assert.equal(h.requests.at(-1).url.searchParams.get('access_token'), 'gitee-token')
  await api.getRepositoryData('Gitee', 'owner/repo', 'commits', 'feature/a')
  assert.equal(h.requests.at(-1).url.pathname.endsWith('/commits/feature%2Fa'), true)
})

test('单个、多个、默认加指定分支及本地扫描兼容，显式分支无需访问默认分支接口', async () => {
  const h = createHarness()
  subscribe(h, 'commits', { branch: 'main,dev' })
  subscribe(h, 'commits', { branch: ['', 'dev'] }, 2)
  h.localRepos.push({ provider: 'github', repo: 'owner/local', type: 'commit', branch: 'local' }, { provider: 'github', repo: 'owner/ignored', type: 'commit', branch: 'main' })
  h.config.CodeUpdate.List.push({ Group: [3], AutoPath: true, Exclude: ['owner/ignored:main'], repos: [] })
  h.router = url => ({ data: url.pathname.includes('/commits/') ? commit('abc') : { default_branch: 'main' } })
  await h.load('@CodeUpdate').CodeUpdate(true)
  assert.equal(h.requests.filter(value => !value.url.pathname.includes('/commits/')).length, 1)
  assert.equal(h.requests.filter(value => value.url.pathname.includes('/commits/')).length, 4)
  assert.equal(h.requests.some(value => value.url.pathname.includes('ignored')), false)
  assert.equal(h.config.CodeUpdate.List[0].repos[0].branch, 'main,dev')
})

test('初始化自动合并兼容的旧类型和分支，保留不同筛选与群策略，保存后写永久标记', async () => {
  const h = createHarness({ config: { AutoBranch: false, AutoBranchTips: 'old' } })
  const repo = { provider: 'GitHub', repo: 'owner/repo' }
  h.config.CodeUpdate.List = [
    {
      Group: [1],
      note: '原备注',
      repos: [
        { ...repo, type: 'commit', branch: 'main' },
        { ...repo, type: 'commits', branch: 'dev' },
        { ...repo, type: 'releases' },
        { ...repo, type: 'pulls', events: ['merged'] },
        { ...repo, type: 'issues', labels: ['bug'] }
      ]
    },
    { QQ: [2], repos: [{ ...repo, type: 'issues' }] }
  ]
  const migration = h.load('@/config/codeUpdateMigration')
  let saved
  const config = await h.loadConfig(async () => {
    assert.equal(h.store.has(migration.CODE_UPDATE_MIGRATION_KEY), false)
    saved = plain(h.config.CodeUpdate)
  })
  assert.equal(config.CodeUpdate.List[0].repos.length, 3)
  assert.deepEqual(saved.List[0].repos[0].type, ['commits', 'releases'])
  assert.deepEqual(saved.List[0].repos[0].branch, ['main', 'dev'])
  assert.deepEqual(saved.List[0].repos[1].events, ['merged'])
  assert.deepEqual(saved.List[0].repos[2].labels, ['bug'])
  assert.equal(saved.List[0].note, '原备注')
  assert.equal(saved.AutoBranch, undefined)
  assert.equal(h.redisWrites.at(-1).key, migration.CODE_UPDATE_MIGRATION_KEY)
  assert.equal(h.redisWrites.at(-1).options, undefined)
  h.config.CodeUpdate.List[0].repos.push({ ...repo, type: 'issues' })
  await h.loadConfig(async () => assert.fail('有标记时不应再次迁移保存'))
  assert.equal(h.config.CodeUpdate.List[0].repos.at(-1).type, 'issues')
})

test('迁移合并指定及默认提交分支，all优先，保留空的类型数组且拒绝未知类型', () => {
  const h = createHarness()
  const migration = h.load('@/config/codeUpdateMigration')
  const repo = { provider: 'GitHub', repo: 'owner/repo' }
  const merged = migration.migrateRepositoryList([{ ...repo, type: 'commit' }, { ...repo, type: 'commits', branch: 'dev' }])
  assert.deepEqual(plain(merged[0].branch), ['', 'dev'])
  const all = migration.migrateRepositoryList([...plain(merged), { ...repo, type: 'commits', branch: 'all' }])
  assert.deepEqual(plain(all[0].branch), ['all'])
  assert.deepEqual(plain(migration.normalizeRepository({ ...repo, type: [] }).type), [])
  assert.throws(() => migration.migrateRepositoryList([{ ...repo, type: 'unsupported' }]), /不支持/)
})

test('保存、读取Redis或写迁移标记失败都不标记成功；已保存配置可在下次启动重试', async () => {
  for (const failure of ['save', 'read', 'marker']) {
    const h = createHarness()
    subscribe(h, 'issues', { type: 'issues' })
    const { migrateCodeUpdateConfig, CODE_UPDATE_MIGRATION_KEY: key } = h.load('@/config/codeUpdateMigration')
    let fail = true
    let saves = 0
    const storage = {
      get: async name => { if (fail && failure === 'read') throw new Error('read'); return h.store.get(name) ?? null },
      copy: async (name, value) => { if (!h.store.has(name)) h.store.set(name, value) },
      set: async (name, value) => { if (fail && failure === 'marker') throw new Error('marker'); h.store.set(name, value); return 'OK' }
    }
    const save = async () => { saves++; if (fail && failure === 'save') throw new Error('save') }
    await assert.rejects(migrateCodeUpdateConfig(h.config.CodeUpdate, save, storage))
    assert.equal(h.store.has(key), false)
    fail = false
    assert.equal(await migrateCodeUpdateConfig(h.config.CodeUpdate, save, storage), true)
    assert.deepEqual(plain(h.config.CodeUpdate.List[0].repos[0].type), ['issues'])
    const count = saves
    assert.equal(await migrateCodeUpdateConfig(h.config.CodeUpdate, save, storage), false)
    assert.equal(saves, count)
  }
})

test('初始化保存失败记录错误但继续兼容旧配置，下一次启动自动重试', async () => {
  const h = createHarness()
  subscribe(h, 'issues', { type: 'issues' })
  const migration = h.load('@/config/codeUpdateMigration')
  await h.loadConfig(async () => { throw new Error('fixture save failure') })
  assert.equal(h.store.has(migration.CODE_UPDATE_MIGRATION_KEY), false)
  assert.ok(h.logs.some(value => value.name === 'error' && value.args[0].includes('下次启动将重试')))
  await h.loadConfig()
  assert.equal(h.store.has(migration.CODE_UPDATE_MIGRATION_KEY), true)
})

test('迁移衔接旧发布分支和大小写游标，不覆盖现有记录，活动积压仍可重试', async () => {
  const h = createHarness()
  subscribe(h, 'issues', {}, 1)
  const data = { issues: [] }
  installRouter(h, data)
  const module = h.load('@CodeUpdate')
  await module.CodeUpdate(true)
  h.failures.add('Group:1')
  h.setNow('2026-11-10T08:02:00Z')
  data.issues = [item(1, { updated_at: '2026-11-10T08:01:00Z' })]
  await module.CodeUpdate(true)
  const journal = [...h.store.entries()][0]
  h.config.CodeUpdate.List[0].repos.push({ provider: 'github', repo: 'owner/other', type: 'releases', branch: 'main' })
  h.store.set('fixture:CodeUpdate:githubReleases:owner/other:main', JSON.stringify([{ shacode: '1' }]))
  h.store.set('fixture:CodeUpdate:githubReleases:owner/other:main:delivery:Group:1', JSON.stringify([{ shacode: '1' }]))
  await h.loadConfig()
  const cursor = 'fixture:CodeUpdate:GitHubReleases:owner/other'
  assert.equal(h.store.get(cursor), JSON.stringify([{ shacode: '1' }]))
  assert.equal(h.store.get(`${cursor}:delivery:Group:1`), JSON.stringify([{ shacode: '1' }]))
  assert.equal(h.store.get(journal[0]), journal[1])
  h.failures.clear()
  h.router = url => ({ data: url.pathname.endsWith('/releases') ? [{ id: 1, tag_name: 'v1', author: { login: 'alice' } }] : data.issues })
  await module.CodeUpdate(true)
  assert.equal(h.screenshots.at(-1).data.lifeData.length, 1)
  assert.equal(h.screenshots.at(-1).data.lifeData[0].detail.kind, 'Issue')
  const fresh = createHarness()
  fresh.config.CodeUpdate.List = [{ repos: [{ provider: 'github', repo: 'owner/repo', type: 'releases', branch: 'main' }] }]
  fresh.store.set('fixture:CodeUpdate:githubReleases:owner/repo:main', JSON.stringify([{ shacode: 'old' }]))
  fresh.store.set('fixture:CodeUpdate:GitHubReleases:owner/repo', JSON.stringify([{ shacode: 'current' }]))
  await fresh.loadConfig()
  assert.equal(fresh.store.get('fixture:CodeUpdate:GitHubReleases:owner/repo'), JSON.stringify([{ shacode: 'current' }]))
})

test('锅巴监听类型为多选、分支为标签输入，旧默认分支开关已移除', () => {
  const h = createHarness()
  const fields = new Map()
  const walk = values => values.forEach(value => { if (value.field) fields.set(value.field, value); if (value.componentProps?.schemas) walk(value.componentProps.schemas) })
  walk(h.load('@/modules/guoba/schemas/CodeUpdate').CodeUpdate)
  assert.equal(fields.get('type').component, 'Select')
  assert.equal(fields.get('type').componentProps.mode, 'multiple')
  assert.equal(fields.get('branch').componentProps.mode, 'tags')
  assert.equal(fields.has('CodeUpdate.AutoBranch'), false)
})

test('锅巴深层设置可保存，更新单个Activity字段保留其他设置和监听列表', async () => {
  const h = createHarness()
  subscribe(h, ['commits', 'issues'], { branch: ['all'] })
  let saves = 0
  const config = await h.loadConfig(async () => { saves++ })
  const before = plain(config.CodeUpdate)
  await config.modify('CodeUpdate', 'Activity.PageSize', 20)
  assert.equal(config.CodeUpdate.Activity.PageSize, 20)
  assert.equal(config.CodeUpdate.Activity.BodyLimit, before.Activity.BodyLimit)
  assert.deepEqual(plain(config.CodeUpdate.List), before.List)
  assert.equal(saves, 2)
  assert.throws(() => config.modify('CodeUpdate', '__proto__.polluted', true), /无效/)
  h.configFacade = config
  const { configInfo } = h.load('@/modules/guoba').supportGuoba()
  const updated = await configInfo.setConfigData({ 'CodeUpdate.Activity.PageSize': 30, 'CodeUpdate.Activity.BatchSize': 3 }, { Result: { ok: () => 'saved' } })
  assert.equal(updated, 'saved')
  assert.equal(config.CodeUpdate.Activity.PageSize, 30)
  assert.equal(config.CodeUpdate.Activity.BatchSize, 3)
  assert.deepEqual(plain(config.CodeUpdate.List), before.List)
})

test('分支接口限制每页数量且没有Link时继续分页，忽略分页的接口不能误判为完整列表', async () => {
  const h = createHarness()
  h.config.CodeUpdate.repos.push({ provider: 'MyGitea', ApiUrl: 'https://gitea.example/api/v1/repos' })
  h.router = url => ({ data: Number(url.searchParams.get('page')) < 3 ? [{ name: Number(url.searchParams.get('page')) === 1 ? 'main' : 'dev' }] : [] })
  const api = h.load('@/modules/GitApi').default
  assert.deepEqual(plain(await api.getBranches('MyGitea', 'owner/repo')), ['main', 'dev'])
  assert.equal(h.requests.length, 3)
  h.router = () => ({ data: [{ name: 'main' }] })
  assert.equal(await api.getBranches('MyGitea', 'owner/repo'), false)
})

test('清理命令在分支查询失败时回复取消，确认失败也结束等待且保留全部记录', async () => {
  const h = createHarness()
  subscribe(h, 'commits', { branch: ['all'] })
  const active = 'fixture:CodeUpdate:GitHub:owner/repo:main'
  const stale = 'fixture:CodeUpdate:GitHub:owner/old:main'
  h.store.set(active, 'active')
  h.store.set(stale, 'stale')
  h.router = () => ({ status: 500 })
  const { GitRepoUpdate } = h.load('@/apps/CodeUpdate')
  const app = new GitRepoUpdate()
  const replies = []
  app.e = { msg: '#DF清理无效数据', reply: async value => replies.push(value) }
  await app.clear(app.e)
  assert.match(replies.at(-1), /清理已取消/)
  assert.equal(app.context, null)
  app.setContext('startClear')
  app.e.msg = '#确认清理'
  await app.startClear({ redisInvalidKeys: [active, stale] })
  assert.match(replies.at(-1), /清理失败/)
  assert.equal(app.context, null)
  assert.deepEqual(plain(app.finishes), ['startClear'])
  assert.deepEqual([...h.store], [[active, 'active'], [stale, 'stale']])
  // A later successful confirmation rechecks subscriptions and keeps keys that became active.
  h.config.CodeUpdate.List[0].repos[0].branch = ['main']
  app.setContext('startClear')
  await app.startClear({ redisInvalidKeys: [active, stale] })
  assert.deepEqual([...h.store.keys()], [active])
  assert.match(replies.at(-1), /成功清理1个/)
  assert.equal(app.context, null)
})

test('手动检查全部分支在发现分支前给出提示，失败后回复原因并释放检查锁', async () => {
  const h = createHarness()
  subscribe(h, 'commits', { branch: ['all'] })
  const replies = []
  h.router = () => {
    assert.match(replies[0], /正在检查/)
    return { status: 500 }
  }
  const { CodeUpdate } = h.load('@CodeUpdate')
  assert.equal(await CodeUpdate(true, { user_id: 1, reply: async value => replies.push(value) }), false)
  assert.match(replies.at(-1), /分支列表失败/)
  assert.equal(h.store.size, 0)
  h.config.CodeUpdate.List[0].repos[0].branch = ['main']
  h.router = () => ({ data: commit('abc') })
  assert.equal(await CodeUpdate(true), 0)
  assert.equal(h.store.size, 1)
})
