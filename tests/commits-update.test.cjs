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

const SMALL_PATCH = '@@ -1,2 +1,2 @@\n-oldValue()\n+newValue()\n unchanged()'
const diffRequests = h => h.requests.filter(({ url }) => /\/commits\/[^/]+$/.test(url.pathname) && url.searchParams.has('per_page'))
const diffFiles = (count = 1, patch = SMALL_PATCH) => Array.from({ length: count }, (_, index) => ({ filename: `src/file${index}.ts`, status: 'modified', additions: 1, deletions: 1, patch }))

function installDiffRouter (h, respond = sha => ({ data: { sha, files: diffFiles(), stats: { additions: 1, deletions: 1 } } })) {
  const router = h.router
  h.router = (url, headers) => {
    const sha = url.pathname.match(/\/commits\/([^/]+)$/)?.[1]
    return sha && url.searchParams.has('per_page') ? respond(decodeURIComponent(sha), url) : router(url, headers)
  }
}

test('提交diff默认关闭且独立于PR开关，仅发现新提交后请求，无更新与静默基线不请求', async () => {
  for (const settings of [undefined, { ShowDiff: false }, { ShowDiff: true }]) {
    const enabled = settings?.ShowDiff === true
    const h = createHarness({ config: { Commit: settings, Activity: { ShowDiff: !enabled } } })
    subscribe(h, 'commits', { branch: 'main' }, 1)
    subscribe(h, 'commits', { branch: 'main' }, 2)
    const state = fixture(h)
    installDiffRouter(h)
    const { CodeUpdate } = h.load('@CodeUpdate')
    assert.equal(await CodeUpdate(true), 0)
    assert.equal(await CodeUpdate(true), 0)
    assert.equal(diffRequests(h).length, 0)
    append(state, 'bbbbbb', 'cccccc')
    assert.equal(await CodeUpdate(true), 1)
    assert.equal(h.deliveries.length, 2)
    assert.deepEqual(diffRequests(h).map(({ url }) => url.pathname.split('/').at(-1)), enabled ? ['bbbbbb', 'cccccc'] : [])
    const infos = h.screenshots[0].data.renderCards[0].commits
    assert.equal(infos.length, 2)
    for (const info of infos) {
      if (!enabled) { assert.equal(info.diff, undefined); continue }
      assert.equal(info.diff.collapsed, false)
      assert.equal(info.diff.fileCount, 1)
      assert.deepEqual(info.diff.files[0].lines.map(line => [line.kind, line.oldNumber, line.newNumber]), [
        ['hunk', undefined, undefined], ['delete', 1, undefined], ['add', undefined, 1], ['context', 2, 2]
      ])
      assert.match(info.diff.url, /\/commit\/(?:bbbbbb|cccccc)$/)
      assert.ok(h.deliveries[0].message.some(value => typeof value === 'string' && value.includes(info.diff.url)))
    }
    assert.equal(await CodeUpdate(true), 0)
    assert.equal(diffRequests(h).length, enabled ? 2 : 0, '已发送后的空检查不重复获取diff')
  }
})

test('提交diff按独立文件与总行数上限折叠，边界值可以展开', async () => {
  for (const { files, lines, collapsed } of [
    { files: 2, lines: 8, collapsed: false },
    { files: 3, lines: 40, collapsed: true },
    { files: 1, lines: 4, collapsed: false },
    { files: 1, lines: 3, collapsed: true }
  ]) {
    const h = createHarness({ config: { FirstAdd: true, Commit: { ShowDiff: true, DiffMaxFiles: 2, DiffMaxLines: lines }, Activity: { DiffMaxFiles: 20, DiffMaxLines: 200 } } })
    subscribe(h, 'commits', { branch: 'main' })
    fixture(h)
    installDiffRouter(h, sha => ({ data: { sha, files: diffFiles(files) } }))
    await h.load('@CodeUpdate').CodeUpdate(true)
    const diff = h.screenshots[0].data.lifeData[0].diff
    assert.equal(diff.collapsed, collapsed)
    assert.equal(diff.files.length, Math.min(2, files))
    assert.equal(diff.hasMoreFiles, files > 2)
    assert.ok(diff.files.every(file => collapsed ? file.lines.length === 0 : file.lines.length === 4))
    assert.equal(diffRequests(h).length, 1)
  }
})

test('diff接口失败、SHA不匹配或缺少文件时回退关闭diff的样式，保留commit统计且重试不再请求', async () => {
  for (const response of [false, { status: 500 }, { data: { sha: 'different-sha', files: diffFiles() } }, { data: { sha: 'aaaaaa' } }]) {
    const h = createHarness({ config: { FirstAdd: true, Commit: { ShowDiff: true } } })
    subscribe(h, 'commits', { branch: 'main' })
    fixture(h, { values: [commit('aaaaaa', [], { stats: { additions: 7, deletions: 2 }, files: diffFiles(2) })] })
    installDiffRouter(h, () => response)
    h.failures.add('Group:10001')
    const { CodeUpdate } = h.load('@CodeUpdate')
    assert.equal(await CodeUpdate(true), 1)
    assert.equal(h.deliveries.length, 1)
    const info = h.screenshots[0].data.lifeData[0]
    assert.equal(info.diff, undefined)
    assert.deepEqual(info.stats, { files: 2, additions: 7, deletions: 2 })
    const pending = journal(h).pending.aaaaaa
    assert.match(pending.diff.unavailable, /Diff暂不可用/)
    h.config.CodeUpdate.Commit.ShowDiff = false
    const disabled = await h.load('@CodeUpdate/utils/format').formatCommitInfo(pending.commit, 'GitHub', 'owner/repo', 'main', pending.diff)
    assert.deepEqual(info, plain(disabled), '完整卡片数据与关闭diff时一致')
    h.config.CodeUpdate.Commit.ShowDiff = true
    assert.equal(journal(h).cursor, 'aaaaaa')
    h.failures.clear()
    assert.equal(await CodeUpdate(true), 1)
    assert.deepEqual(h.screenshots.at(-1).data.lifeData[0], info)
    const message = h.deliveries.at(-1).message
    assert.equal(Array.isArray(message) && message.some(value => typeof value === 'string' && value.includes('/commit/aaaaaa')), false)
    assert.deepEqual(journal(h).pending, {})
    assert.equal(await CodeUpdate(true), 0)
    assert.equal(diffRequests(h).length, 1)
  }
})

test('失败提交保存当时diff，重启后的重试不访问旧diff接口，只获取新HEAD的差异', async () => {
  const h = createHarness({ config: { Commit: { ShowDiff: true } } })
  subscribe(h, 'commits', { branch: 'main' }, 1)
  subscribe(h, 'commits', { branch: 'main' }, 2)
  const state = fixture(h)
  installDiffRouter(h)
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  append(state, 'bbbbbb')
  h.failures.add('Group:2')
  await CodeUpdate(true)
  assert.match(journal(h).pending.bbbbbb.diff.files[0].lines[2].text, /newValue/)
  assert.equal(diffRequests(h).length, 1)
  append(state, 'cccccc')
  const restarted = createHarness({ config: plain(h.config.CodeUpdate) })
  for (const [key, value] of h.store) restarted.store.set(key, value)
  fixture(restarted, { head: state.head, values: plain(state.values) })
  installDiffRouter(restarted, sha => ({ data: { sha, files: diffFiles(1, SMALL_PATCH.replace('newValue', 'laterValue')) } }))
  await restarted.load('@CodeUpdate').CodeUpdate(true)
  assert.deepEqual(diffRequests(restarted).map(({ url }) => url.pathname.split('/').at(-1)), ['cccccc'])
  const infos = restarted.screenshots.find(value => value.data.saveId === '2').data.lifeData
  assert.deepEqual(infos.map(info => info.name.sha), ['BBBBB', 'CCCCC'])
  assert.match(infos[0].diff.files[0].lines[2].text, /newValue/)
  assert.match(infos[1].diff.files[0].lines[2].text, /laterValue/)
  assert.deepEqual(journal(restarted).pending, {})
})

test('失败重试应用当前展示上限，关闭提交diff后隐藏已保存差异且不重新获取', async () => {
  const h = createHarness({ config: { FirstAdd: true, Commit: { ShowDiff: true, DiffMaxFiles: 3, DiffMaxLines: 40 } } })
  subscribe(h, 'commits', { branch: 'main' })
  fixture(h)
  installDiffRouter(h, sha => ({ data: { sha, files: diffFiles(2) } }))
  h.failures.add('Group:10001')
  const { CodeUpdate } = h.load('@CodeUpdate')
  await CodeUpdate(true)
  h.config.CodeUpdate.Commit.DiffMaxFiles = 1
  await CodeUpdate(true)
  const diff = h.screenshots.at(-1).data.lifeData[0].diff
  assert.equal(diff.collapsed, true)
  assert.equal(diff.files.length, 1)
  assert.equal(diff.files[0].lines.length, 0)
  h.config.CodeUpdate.Commit.ShowDiff = false
  h.failures.clear()
  await CodeUpdate(true)
  assert.equal(h.screenshots.at(-1).data.lifeData[0].diff, undefined)
  assert.equal(diffRequests(h).length, 1)
})

test('手动提交预览按需获取diff，不修改自动进度，链接遵循SendLinks', async () => {
  for (const sendLinks of [false, true]) {
    const h = createHarness({ config: { Commit: { ShowDiff: true }, Activity: { SendLinks: sendLinks } } })
    subscribe(h, 'commits', { branch: 'main' })
    const state = fixture(h)
    installDiffRouter(h)
    const { CodeUpdate } = h.load('@CodeUpdate')
    await CodeUpdate(true)
    append(state, 'bbbbbb')
    const before = [...h.store]
    const replies = []
    await CodeUpdate(false, { user_id: 999, reply: async value => replies.push(value) })
    assert.deepEqual([...h.store], before)
    assert.equal(diffRequests(h).length, 1)
    assert.equal(h.screenshots.at(-1).data.lifeData[0].diff.collapsed, false)
    assert.equal(Array.isArray(replies.at(-1)) && replies.at(-1).some(value => typeof value === 'string' && value.includes('/commit/bbbbbb')), sendLinks)
    h.config.CodeUpdate.Commit.ShowDiff = false
    await CodeUpdate(false, { user_id: 999, reply: async value => replies.push(value) })
    assert.equal(diffRequests(h).length, 1)
    assert.equal(h.screenshots.at(-1).data.lifeData[0].diff, undefined)
    assert.deepEqual([...h.store], before)
  }
})

test('多分支和多接收者监听同一SHA仅共享一次diff请求，无接收者时不请求', async () => {
  const h = createHarness({ config: { FirstAdd: true, Commit: { ShowDiff: true } } })
  subscribe(h, 'commits', { branch: ['main', 'dev'] }, 1)
  subscribe(h, 'commits', { branch: ['main', 'dev'] }, 2)
  const state = fixture(h)
  const router = h.router
  h.router = url => url.pathname.endsWith('/commits/dev') ? { data: state.values[0] } : router(url)
  installDiffRouter(h)
  await h.load('@CodeUpdate').CodeUpdate(true)
  assert.equal(diffRequests(h).length, 1)
  assert.equal(h.deliveries.length, 2)
  assert.deepEqual(h.screenshots[0].data.lifeData.map(info => info.name.branch).sort(), ['dev', 'main'])

  const silent = createHarness({ config: { FirstAdd: true, Commit: { ShowDiff: true } } })
  fixture(silent)
  installDiffRouter(silent)
  const pending = await silent.load('@CodeUpdate/services/commits').fetchCommits({ provider: 'GitHub', repo: 'owner/repo', type: 'commits', branch: 'main' }, true, new Map(), [])
  assert.equal(pending.length, 0)
  assert.equal(diffRequests(silent).length, 0)
})

test('提交diff接口固定SHA，兼容GitHub文件分页及Gitee、Gitcode、CNB认证和路径', async () => {
  for (const provider of ['GitHub', 'Gitee', 'Gitcode', 'CNB']) {
    const h = createHarness()
    h.config.CodeUpdate.repos.push({ provider, token: 'test-token' })
    h.router = url => {
      const page = Number(url.searchParams.get('page'))
      return { data: { sha: 'aaaaaa', files: [{ new_path: `new${page}.ts`, old_path: `old${page}.ts`, renamed_file: true, diff: '@@ -0,0 +1 @@\n+new' }] }, link: provider === 'GitHub' && page === 1 ? nextPage : lastPage }
    }
    const data = await h.load('@/modules/GitApi').default.getCommitDiff(provider, 'owner/repo', 'aaaaaa', 3)
    assert.equal(data.kind, 'files', provider)
    assert.equal(data.files.length, provider === 'GitHub' ? 2 : 1, provider)
    assert.ok(h.requests.every(({ url }) => url.pathname.endsWith('/commits/aaaaaa')))
    assert.ok(h.requests.every(({ url }) => url.searchParams.get('per_page') === '4'))
    assert.equal(h.requests[0].headers.Authorization, 'Bearer test-token')
    if (provider === 'Gitee') assert.equal(h.requests[0].url.searchParams.get('access_token'), 'test-token')
    if (provider === 'Gitcode') assert.equal(h.requests[0].url.searchParams.get('show_diff'), 'true')
    if (provider === 'CNB') assert.ok(h.requests[0].url.pathname.includes('/-/git/commits/'))
    const utils = h.load('@CodeUpdate/utils/diff')
    const diff = utils.normalizeCodeDiff(data, 'https://example.invalid/commit/aaaaaa', utils.commitDiffOptions())
    assert.equal(diff.files[0].status, '重命名')
    assert.equal(diff.files[0].previousFilename, 'old1.ts')
  }
})

test('Gitea提交diff使用固定SHA原始接口，二进制文件保留提示，巨大响应在读取上限停止', async () => {
  const h = createHarness({ config: { Commit: { ShowDiff: true } } })
  h.config.CodeUpdate.repos.push({ provider: 'MyGitea', ApiUrl: 'https://gitea.example/api/v1/repos' })
  h.router = () => ({ text: 'diff --git a/main.ts b/main.ts\n--- a/main.ts\n+++ b/main.ts\n' + SMALL_PATCH + '\ndiff --git a/logo.png b/logo.png\nBinary files a/logo.png and b/logo.png differ\n' })
  const api = h.load('@/modules/GitApi').default
  const data = await api.getCommitDiff('MyGitea', 'owner/repo', 'aaaaaa', 3)
  assert.ok(h.requests[0].url.pathname.endsWith('/git/commits/aaaaaa.diff'))
  assert.equal(h.requests[0].headers.Accept, 'text/plain')
  const utils = h.load('@CodeUpdate/utils/diff')
  const diff = utils.normalizeCodeDiff(data, 'https://gitea.example/owner/repo/commit/aaaaaa', utils.commitDiffOptions())
  assert.equal(diff.files[0].lines.length, 4)
  assert.equal(diff.files[1].missingPatch, true)
  let reads = 0
  h.router = () => ({ chunks: ['diff --git a/big.ts b/big.ts\n--- a/big.ts\n+++ b/big.ts\n@@ -0,0 +1,200000 @@\n' + '+x\n'.repeat(200000), 'must-not-be-read'], onChunk: () => reads++ })
  const big = await api.getCommitDiff('MyGitea', 'owner/repo', 'aaaaaa', 3)
  assert.equal(reads, 1)
  assert.equal(big.truncated, true)
  assert.equal(utils.normalizeCodeDiff(big, '', utils.commitDiffOptions()).collapsed, true)
  h.router = () => ({ chunks: [JSON.stringify({ sha: 'aaaaaa', files: [{ filename: 'big.ts', patch: 'x'.repeat(600000) }] }), 'must-not-be-read'], onChunk: () => reads++ })
  assert.equal(await api.getCommitDiff('GitHub', 'owner/repo', 'aaaaaa', 3), false)
  assert.equal(reads, 2)
})

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

for (const failure of ['截图返回失败', '截图抛出异常', '部分群发送失败']) {
  test(`检查命令在${failure}时回复失败，保留待投递提交并在重试后报告成功`, async () => {
    const h = createHarness()
    subscribe(h, 'commits', { branch: 'main' }, 1)
    subscribe(h, 'commits', { branch: 'main' }, 2)
    const state = fixture(h)
    const { CodeUpdate } = h.load('@CodeUpdate')
    await CodeUpdate(true)
    append(state, 'bbbbbb', 'cccccc')
    if (failure === '截图返回失败') h.render = false
    else if (failure === '截图抛出异常') h.renderError = new Error('fixture template not found')
    else h.failures.add('Group:2')
    const replies = []
    const event = { msg: '#检查仓库更新', user_id: 999, reply: async message => { replies.push(message); return true } }
    const { GitRepoUpdate } = h.load('@/apps/CodeUpdate')
    const app = new GitRepoUpdate()
    assert.equal(await app.check(event), false)
    assert.match(replies.at(-1), /共有1个仓库有更新.*推送未全部成功/)
    assert.ok(replies.every(message => typeof message !== 'string' || !/正在按照你的配置|已按照你的配置/.test(message)))
    assert.deepEqual(Object.keys(journal(h).pending), ['bbbbbb', 'cccccc'])
    h.render = true
    h.renderError = undefined
    h.failures.clear()
    assert.equal(await app.check(event), true)
    assert.match(replies.at(-1), /共有1个仓库有更新.*已按照你的配置完成推送/)
    assert.deepEqual(journal(h).pending, {})
    assert.equal(h.deliveries.filter(value => value.target === 'Group:1').length, 1, '成功的群在重试时不重复发送')
    assert.equal(h.deliveries.filter(value => value.target === 'Group:2').length, failure === '部分群发送失败' ? 2 : 1)
  })
}

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
