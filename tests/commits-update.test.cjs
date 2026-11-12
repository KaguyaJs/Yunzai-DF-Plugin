const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, subscribe, plain } = require('./helpers/code-update.cjs')

const cursorKey = 'fixture:CodeUpdate:GitHub:owner/repo:main'
const journalKey = `${cursorKey}:commits`
const lastPage = '<https://example.com/last>; rel="last"'
const nextPage = '<https://example.com/next>; rel="next"'

function commit (sha, parents = [], changes = {}) {
  return {
    sha,
    html_url: `https://github.com/owner/repo/commit/${sha}`,
    commit: {
      message: `fix: ${sha}`,
      author: { name: 'alice', date: '2026-11-10T08:00:00Z' },
      committer: { name: 'alice', date: '2026-11-10T08:00:00Z' }
    },
    author: { login: 'alice', avatar_url: '' },
    committer: { login: 'alice', avatar_url: '' },
    parents: parents.map(sha => ({ sha })),
    ...changes
  }
}

function fixture (h, changes = {}) {
  const state = { head: 'aaaaaa', values: [commit('aaaaaa')], ...changes }
  h.router = async url => {
    if (url.pathname.endsWith('/owner/repo')) return { data: { default_branch: 'main' } }
    const ref = url.pathname.match(/\/commits\/([^/]+)$/)?.[1]
    if (ref) {
      if (decodeURIComponent(ref) === 'main' && state.failHead) return { status: 500 }
      const sha = decodeURIComponent(ref) === 'main' ? state.head : decodeURIComponent(ref)
      return { data: state.values.find(value => value.sha === sha) }
    }
    if (!url.pathname.endsWith('/commits')) return { data: [] }
    const sha = url.searchParams.get('sha')
    if (sha === 'main') return { data: [state.values.find(value => value.sha === state.head)] }
    const page = Number(url.searchParams.get('page'))
    if (state.failPages?.has(page)) return { status: 500 }
    if (state.page) return state.page(url)
    state.onPage?.(url)
    const reachable = new Set()
    const visit = sha => {
      if (reachable.has(sha)) return
      reachable.add(sha)
      for (const parent of state.values.find(value => value.sha === sha)?.parents || []) visit(parent.sha)
    }
    visit(sha)
    const values = state.values.filter(value => reachable.has(value.sha))
    const size = Number(url.searchParams.get('per_page') || url.searchParams.get('limit') || 100)
    const offset = (page - 1) * size
    return { data: values.slice(offset, offset + size), link: offset + size < values.length ? nextPage : lastPage }
  }
  return state
}

function append (state, ...shas) {
  for (const sha of shas) {
    state.values.unshift(commit(sha, [state.head]))
    state.head = sha
  }
}

function screenshots (h, start = 0) {
  return h.screenshots.slice(start).map(value => value.data.lifeData.map(info => info.name.sha))
}

function journal (h) {
  return JSON.parse(h.store.get(journalKey))
}

test('连续同秒提交逐条推送，首次静默且成功后不重复', async () => {
  const h = createHarness()
  subscribe(h, 'commits', { branch: 'main' })
  const state = fixture(h)
  const { CodeUpdate } = h.load('@CodeUpdate')
  assert.equal(await CodeUpdate(true), 0)
  assert.equal(h.deliveries.length, 0)
  append(state, 'bbbbbb', 'cccccc')
  // Git history is identified by SHA; an old author timestamp cannot hide a new commit.
  state.values[1].commit.author.date = '2020-01-01T00:00:00Z'
  assert.equal(await CodeUpdate(true), 1)
  assert.deepEqual(screenshots(h), [['BBBBB', 'CCCCC']])
  assert.equal(h.screenshots[0].data.renderCards.length, 1)
  assert.deepEqual(h.screenshots[0].data.renderCards[0].commits.map(value => value.name.sha), ['BBBBB', 'CCCCC'])
  assert.equal(journal(h).cursor, 'cccccc')
  assert.deepEqual(journal(h).pending, {})
  assert.equal(await CodeUpdate(true), 0)
  assert.equal(h.deliveries.length, 1)
})

test('分页固定已观察的HEAD，扫描期间出现的新提交留给下轮', async () => {
  const h = createHarness({ config: { Activity: { PageSize: 1, MaxPages: 20 } } })
  subscribe(h, 'commits', { branch: 'main' })
  const state = fixture(h)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  append(state, 'bbbbbb', 'cccccc')
  state.onPage = url => {
    if (url.searchParams.get('page') === '1') {
      append(state, 'dddddd')
      state.onPage = null
    }
  }
  await CodeUpdate(true)
  assert.deepEqual(screenshots(h), [['BBBBB', 'CCCCC']])
  assert.equal(journal(h).cursor, 'cccccc')
  const firstScan = h.requests.filter(value => value.url.pathname.endsWith('/commits'))
  assert.ok(firstScan.length >= 2)
  assert.ok(firstScan.every(value => value.url.searchParams.get('sha') === 'cccccc'))
  await CodeUpdate(true)
  assert.deepEqual(screenshots(h), [['BBBBB', 'CCCCC'], ['DDDDD']])
})

test('失败接收者的旧提交与新提交在重启后一起补发，成功接收者只收新提交', async () => {
  const h = createHarness()
  subscribe(h, 'commits', { branch: 'main' }, 1)
  subscribe(h, 'commits', { branch: 'main' }, 2)
  const state = fixture(h)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  h.failures.add('Group:2')
  append(state, 'bbbbbb')
  await CodeUpdate(true)
  assert.deepEqual(journal(h).pending.bbbbbb.targets, ['Group:2'])
  assert.equal(journal(h).pending.bbbbbb.commit.commit.message, 'fix: bbbbbb')
  append(state, 'cccccc')
  const restarted = createHarness({ config: plain(h.config.CodeUpdate) })
  for (const [key, value] of h.store) restarted.store.set(key, value)
  fixture(restarted, { head: state.head, values: plain(state.values) })
  assert.equal(await restarted.load('@CodeUpdate').CodeUpdate(true), 1)
  assert.deepEqual(restarted.screenshots.find(value => value.data.saveId === '1').data.lifeData.map(info => info.name.sha), ['CCCCC'])
  assert.deepEqual(restarted.screenshots.find(value => value.data.saveId === '2').data.lifeData.map(info => info.name.sha), ['BBBBB', 'CCCCC'])
  assert.deepEqual(journal(restarted).pending, {})
  assert.equal(await restarted.load('@CodeUpdate').CodeUpdate(true), 0)
  assert.equal(restarted.deliveries.length, 2)
})

test('HEAD获取失败时仍能投递持久化的旧提交，不改变扫描游标', async () => {
  const h = createHarness()
  subscribe(h, 'commits', { branch: 'main' })
  const state = fixture(h)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  h.failures.add('Group:10001')
  append(state, 'bbbbbb')
  await CodeUpdate(true)
  h.failures.clear()
  state.failHead = true
  assert.equal(await CodeUpdate(true), 1)
  assert.equal(journal(h).cursor, 'bbbbbb')
  assert.deepEqual(journal(h).pending, {})
  assert.equal(h.deliveries.length, 2)
})

test('Redis保存失败时不发送或推进；恢复后完整补发期间所有提交', async () => {
  const h = createHarness()
  subscribe(h, 'commits', { branch: 'main' })
  const state = fixture(h)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  const before = h.store.get(journalKey)
  append(state, 'bbbbbb')
  h.failWrite = true
  await CodeUpdate(true)
  assert.equal(h.deliveries.length, 0)
  assert.equal(h.store.get(journalKey), before)
  h.failWrite = false
  append(state, 'cccccc')
  await CodeUpdate(true)
  assert.deepEqual(screenshots(h), [['BBBBB', 'CCCCC']])
})

test('截图失败保留原提交正文，新HEAD不会替换待投递内容', async () => {
  const h = createHarness()
  subscribe(h, 'commits', { branch: 'main' })
  const state = fixture(h)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  append(state, 'bbbbbb')
  h.render = false
  await CodeUpdate(true)
  assert.equal(h.deliveries.length, 0)
  assert.equal(journal(h).pending.bbbbbb.commit.commit.message, 'fix: bbbbbb')
  h.render = true
  append(state, 'cccccc')
  state.values.find(value => value.sha === 'bbbbbb').commit.message = '接口中被替换的旧内容'
  await CodeUpdate(true)
  assert.deepEqual(screenshots(h).at(-1), ['BBBBB', 'CCCCC'])
  assert.match(h.screenshots.at(-1).data.lifeData[0].text, /bbbbbb/)
})

test('提交积压分批投递，成功批次独立确认后不重复', async () => {
  const h = createHarness({ config: { Activity: { BatchSize: 2 } } })
  subscribe(h, 'commits', { branch: 'main' })
  const state = fixture(h)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  append(state, 'bbbbbb', 'cccccc', 'dddddd', 'eeeeee', 'ffffff')
  h.failDelivery = () => h.deliveries.length === 2
  await CodeUpdate(true)
  assert.deepEqual(Object.keys(journal(h).pending), ['dddddd', 'eeeeee', 'ffffff'])
  h.failDelivery = () => false
  await CodeUpdate(true)
  assert.deepEqual(screenshots(h), [['BBBBB', 'CCCCC'], ['DDDDD', 'EEEEE'], ['DDDDD', 'EEEEE'], ['FFFFF']])
  assert.deepEqual(journal(h).pending, {})
  assert.equal(h.deliveries.length, 4)
})

test('分页失败、达到上限或不前进均保留原进度，恢复后跨页完整推送', async () => {
  for (const mode of ['failure', 'limit', 'stalled']) {
    const h = createHarness({ config: { Activity: { PageSize: 1, MaxPages: mode === 'limit' ? 1 : 10 } } })
    subscribe(h, 'commits', { branch: 'main' })
    const state = fixture(h)
    const { CodeUpdate } = h.load('@CodeUpdate')
    await CodeUpdate(true)
    append(state, 'bbbbbb', 'cccccc')
    if (mode === 'failure') state.failPages = new Set([2])
    if (mode === 'stalled') state.page = () => ({ data: [state.values[0]], link: nextPage })
    const before = h.store.get(journalKey)
    await CodeUpdate(true)
    assert.equal(h.deliveries.length, 0, mode)
    assert.equal(h.store.get(journalKey), before, mode)
    state.failPages = null
    state.page = null
    h.config.CodeUpdate.Activity.MaxPages = 10
    await CodeUpdate(true)
    assert.deepEqual(screenshots(h), [['BBBBB', 'CCCCC']], mode)
  }
})

test('旧SHA与各接收者部分成功记录迁移后，只补发尚未投递的提交', async () => {
  for (const provider of ['GitHub', 'github']) {
    const h = createHarness()
    subscribe(h, 'commits', { provider, branch: 'main' }, 1)
    subscribe(h, 'commits', { provider, branch: 'main' }, 2)
    const legacy = `fixture:CodeUpdate:${provider}:owner/repo:main`
    h.store.set(legacy, JSON.stringify([{ shacode: 'aaaaaa' }]))
    h.store.set(`${legacy}:delivery:Group:1`, JSON.stringify([{ shacode: 'bbbbbb' }]))
    h.store.set(`${legacy}:delivery:Group:2`, JSON.stringify([{ shacode: 'aaaaaa' }]))
    const state = fixture(h)
    append(state, 'bbbbbb', 'cccccc')
    await h.load('@CodeUpdate').CodeUpdate(true)
    assert.deepEqual(h.screenshots.find(value => value.data.saveId === '1').data.lifeData.map(info => info.name.sha), ['CCCCC'], provider)
    assert.deepEqual(h.screenshots.find(value => value.data.saveId === '2').data.lifeData.map(info => info.name.sha), ['BBBBB', 'CCCCC'], provider)
    assert.deepEqual(journal(h).pending, {})
  }
})

test('FirstAdd只推当前提交，手动预览最新提交不修改自动队列', async () => {
  const h = createHarness({ config: { FirstAdd: true } })
  subscribe(h, 'commits', { branch: 'main' })
  const state = fixture(h)
  append(state, 'bbbbbb', 'cccccc')
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  assert.deepEqual(screenshots(h), [['CCCCC']])
  append(state, 'dddddd')
  const before = [...h.store]
  const replies = []
  await CodeUpdate(false, { user_id: 999, reply: async value => replies.push(value) })
  assert.deepEqual([...h.store], before)
  assert.deepEqual(screenshots(h).at(-1), ['DDDDD'])
  assert.equal(h.deliveries.length, 1)
  await CodeUpdate(true)
  assert.equal(h.deliveries.length, 2)
  assert.deepEqual(journal(h).pending, {})
})

test('取消接收者订阅会移除过期待投递目标，有效提交日志保留在清理键中', async () => {
  const h = createHarness()
  subscribe(h, 'commits', { branch: 'main' }, 1)
  subscribe(h, 'commits', { branch: 'main' }, 2)
  const state = fixture(h)
  const module = h.load('@CodeUpdate')
  await module.CodeUpdate(true)
  h.failures.add('Group:2')
  append(state, 'bbbbbb')
  await module.CodeUpdate(true)
  assert.ok((await module.getAllRedisKey()).includes(journalKey))
  h.config.CodeUpdate.List[1].Group = []
  await module.CodeUpdate(true)
  assert.deepEqual(journal(h).pending, {})
})

test('合并侧分支的旧日期提交不会因先见到旧HEAD而漏掉', async () => {
  const h = createHarness()
  fixture(h, {
    head: 'mmmmmm',
    values: [commit('mmmmmm', ['aaaaaa', 'xxxxxx']), commit('aaaaaa', ['rrrrrr']), commit('rrrrrr'), commit('xxxxxx', ['rrrrrr'])]
  })
  const result = await h.load('@/modules/GitApi').default.getCommitUpdates('GitHub', 'owner/repo', 'aaaaaa', 'mmmmmm', { pageSize: 2, maxPages: 5 })
  assert.notEqual(result, false)
  assert.equal(result.reset, false)
  assert.deepEqual(plain(result.commits).map(value => value.sha), ['xxxxxx', 'mmmmmm'])
})

test('日期乱序时继续解析旧祖先，已包含在基线里的合并父提交不重推', async () => {
  const h = createHarness()
  fixture(h, {
    head: 'mmmmmm',
    values: [
      commit('mmmmmm', ['aaaaaa', 'xxxxxx']),
      commit('aaaaaa', ['pppppp', 'rrrrrr']),
      commit('xxxxxx', ['rrrrrr']),
      commit('rrrrrr'),
      commit('pppppp', ['xxxxxx'])
    ]
  })
  const result = await h.load('@/modules/GitApi').default.getCommitUpdates('GitHub', 'owner/repo', 'aaaaaa', 'mmmmmm', { pageSize: 2, maxPages: 5 })
  assert.notEqual(result, false)
  assert.deepEqual(plain(result.commits).map(value => value.sha), ['mmmmmm'])
})

test('旧提交确实不在完整历史中时恢复到当前HEAD，截断历史不误判force-push', async () => {
  for (const maxPages of [1, 5]) {
    const h = createHarness()
    fixture(h, { head: 'dddddd', values: [commit('dddddd', ['eeeeee']), commit('eeeeee')] })
    const result = await h.load('@/modules/GitApi').default.getCommitUpdates('GitHub', 'owner/repo', 'aaaaaa', 'dddddd', { pageSize: 1, maxPages })
    if (maxPages === 1) assert.equal(result, false)
    else {
      assert.equal(result.reset, true)
      assert.deepEqual(plain(result.commits).map(value => value.sha), ['dddddd'])
    }
  }
})

test('GitHub、Gitee、Gitcode与Gitea提交列表固定SHA并保留分页与认证参数', async () => {
  for (const provider of ['GitHub', 'Gitee', 'Gitcode', 'MyGitea']) {
    const h = createHarness()
    h.config.CodeUpdate.repos.push({ provider, ApiUrl: `https://${provider.toLowerCase()}.example/repos`, token: 'test-token' })
    const state = fixture(h)
    append(state, 'bbbbbb', 'cccccc')
    const result = await h.load('@/modules/GitApi').default.getCommitUpdates(provider, 'owner/repo', 'aaaaaa', 'cccccc', { pageSize: 1, maxPages: 5 })
    assert.notEqual(result, false, provider)
    assert.deepEqual(plain(result.commits).map(value => value.sha), ['bbbbbb', 'cccccc'], provider)
    const request = h.requests.find(value => value.url.pathname.endsWith('/commits'))
    assert.equal(request.url.searchParams.get('sha'), 'cccccc', provider)
    assert.equal(request.url.searchParams.get(/gitea/i.test(provider) ? 'limit' : 'per_page'), '1', provider)
    assert.equal(request.headers.Authorization, 'Bearer test-token', provider)
    if (provider === 'Gitee') assert.equal(request.url.searchParams.get('access_token'), 'test-token')
  }
})

test('CNB沿固定SHA详情父链获取连续提交，缺少父链或超过预算不接受部分结果', async () => {
  for (const mode of ['complete', 'missing-parents', 'limit']) {
    const h = createHarness()
    h.config.CodeUpdate.repos.push({ provider: 'CNB', ApiUrl: 'https://cnb.example', token: 'cnb-token' })
    const state = fixture(h)
    append(state, 'bbbbbb', 'cccccc')
    if (mode === 'missing-parents') delete state.values[0].parents
    const result = await h.load('@/modules/GitApi').default.getCommitUpdates('CNB', 'owner/repo', 'aaaaaa', 'cccccc', { pageSize: 1, maxPages: mode === 'limit' ? 1 : mode === 'complete' ? 2 : 10 })
    if (mode === 'complete') {
      assert.notEqual(result, false)
      assert.deepEqual(plain(result.commits).map(value => value.sha), ['bbbbbb', 'cccccc'])
    } else assert.equal(result, false, mode)
    assert.ok(h.requests.every(value => /\/-\/git\/commits\/[^/]+$/.test(value.url.pathname)))
    assert.ok(h.requests.every(value => value.headers.Authorization === 'Bearer cnb-token'))
  }
})

test('提交父链出现循环时拒绝异常数据，不误判为完整force-push历史', async () => {
  for (const provider of ['GitHub', 'CNB']) {
    const h = createHarness()
    if (provider === 'CNB') h.config.CodeUpdate.repos.push({ provider, ApiUrl: 'https://cnb.example' })
    fixture(h, { head: 'cccccc', values: [commit('cccccc', ['bbbbbb']), commit('bbbbbb', ['cccccc'])] })
    assert.equal(await h.load('@/modules/GitApi').default.getCommitUpdates(provider, 'owner/repo', 'aaaaaa', 'cccccc', { pageSize: 2, maxPages: 5 }), false, provider)
  }
})
