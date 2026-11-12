const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { project } = require('./code-update.cjs')

function avatar (letters, background) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="24" fill="${background}"/><text x="40" y="51" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="white">${letters}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Deterministic display data; all images are local or data URLs, never live repository content. */
function displayFixtures () {
  const resourceRoot = path.join(project, 'resources')
  const icon = provider => pathToFileURL(path.join(resourceRoot, 'CodeUpdate/icon', `${provider}.svg`)).href
  const alice = avatar('AL', '#637ddc')
  const lin = avatar('LN', '#369780')
  const common = {
    icon: icon('GitHub'),
    avatar: { is: false, author: alice },
    name: { source: 'GitHub', repo: 'KaguyaJs/Yunzai-DF-Plugin', authorStart: 'A' },
    time_info: '<span>Alice</span> · <span>2026-11-12 16:28</span>',
    translate: false
  }
  const commit = {
    ...common,
    name: { ...common.name, branch: 'main', sha: 'F15D6C0' },
    text: '<span class="commit-prefix prefix-feat haveScope">feat</span><span class="scope commit-prefix">theme</span> <span class="head">为每一条仓库动态，换上一种好心情</span><br><p>新增七套主题与自定义配色，让提交、发布和协作进展清楚呈现。</p><ul><li>深色与浅色自由切换</li><li>多个推送组统一汇总，按配置分片后一次回复</li></ul>',
    stats: { files: 8, additions: 236, deletions: 42 },
    translate: { label: '中文翻译', title: '已在渲染前自动翻译' }
  }
  const release = {
    ...common,
    release: true,
    prerelease: false,
    draft: false,
    name: { ...common.name, tag: 'v2.13.0' },
    time_info: '<span>Alice</span> 发布于 <span>2026-11-12 15:40</span>',
    text: '<span class="head">更清晰，也更有色彩 · v2.13.0</span><br><p>本次更新带来可配置的推送主题、更加整齐的状态标签，以及支持分片的汇总预览。</p><blockquote>让阅读更新成为一件轻松的事。</blockquote>',
    url: 'https://example.invalid/releases/v2.13.0',
    assets: {
      total: 4,
      hidden: 2,
      files: [
        { name: 'Yunzai-DF-Plugin-v2.13.0.zip', size: '2.84 MiB', url: 'https://example.invalid/download/plugin.zip' },
        { name: 'Source code.tar.gz', size: '1.72 MiB', url: 'https://example.invalid/download/source.tar.gz' }
      ]
    }
  }
  const pull = {
    ...common,
    activity: true,
    avatar: { is: false, author: lin },
    name: { ...common.name, authorStart: 'L' },
    time_info: '作者 <span>Lin</span> · 活动于 <span>2026-11-12 14:56</span>',
    text: '<span class="head">合并多个推送组的仓库预览</span><div class="activity-body"><p>重复订阅仅保留一份，分支与不同活动继续分别展示。预览不改变自动推送进度。</p><p>这是一个带有 <code>inline code</code> 和 <a href="https://example.invalid/pulls/128">详情链接</a> 的说明。</p></div>',
    detail: {
      kind: 'PR', number: '128', state: 'merged', stateLabel: '已合并', actions: ['合并'], draft: false,
      labels: [{ name: 'enhancement', color: '1c8e77' }, { name: 'renderer', color: '7463ba' }],
      baseBranch: 'main', headBranch: 'feature/unified-preview', comments: 5, comment: false
    },
    stats: { files: 3, additions: 24, deletions: 18 },
    diff: {
      collapsed: false, fileCount: 1, hasMoreFiles: false, url: 'https://example.invalid/pulls/128/files',
      files: [{
        filename: 'src/modules/CodeUpdate/services/screenshot.ts', status: 'modified', additions: 3, deletions: 1,
        lines: [
          { kind: 'hunk', oldNumber: '', newNumber: '', text: '@@ -12,3 +12,5 @@' },
          { kind: 'context', oldNumber: '12', newNumber: '12', text: 'const content = collectUpdates(groups)' },
          { kind: 'delete', oldNumber: '13', newNumber: '', text: '-renderEachGroup(content)' },
          { kind: 'add', oldNumber: '', newNumber: '13', text: '+const visible = uniqueUpdates(content)' },
          { kind: 'add', oldNumber: '', newNumber: '14', text: '+render(visible)' }
        ]
      }]
    }
  }
  const issue = {
    ...common,
    activity: true,
    icon: icon('Gitee'),
    name: { source: 'Gitee', repo: 'KaguyaJs/Theme-Lab', authorStart: 'A' },
    time_info: '作者 <span>Alice</span> · 活动于 <span>2026-11-12 14:20</span>',
    text: '<span class="head">浅色主题中的状态与代码差异也应该清晰可读</span><div class="activity-body"><p>检查正文、说明文字、附件大小，以及新增和删除代码在不同主题下的对比度。</p><p>长路径：<code>resources/CodeUpdate/a-very-long-example-filename-for-layout-verification.scss</code></p></div>',
    detail: {
      kind: 'Issue', number: '64', state: 'open', stateLabel: '打开', actions: ['新建'], draft: false,
      labels: [{ name: 'design', color: 'b35282' }, { name: 'accessibility', color: '547ca5' }],
      baseBranch: '', headBranch: '', comments: 2, comment: false
    }
  }
  return [commit, release, pull, issue]
}

/** 同分支连续提交、另一分支与发布混排，验证公共卡片和逐条详情。 */
function commitDisplayFixtures () {
  const [first, release] = displayFixtures()
  const second = {
    ...first,
    name: { ...first.name, sha: '977665B', authorStart: 'L', committerStart: 'A' },
    avatar: { is: true, author: avatar('LN', '#369780'), committer: first.avatar.author },
    time_info: '<span>Lin</span> 编写于 <span>18 分钟前</span>，并由 <span>Alice</span> 提交于 <span>12 分钟前</span>',
    text: '<span class="commit-prefix prefix-fix haveScope">fix</span><span class="scope commit-prefix">push</span> <span class="head">连续提交完整推送，失败后继续补发</span><br><p>保留每一条提交的原始内容与发送进度，避免短时间内多次更新遗漏。</p>',
    stats: { files: 4, additions: 86, deletions: 24 },
    translate: false
  }
  const third = {
    ...first,
    name: { ...first.name, sha: '509CE77' },
    time_info: '<span>Alice</span> 提交于 <span>8 分钟前</span>',
    text: '<span class="commit-prefix prefix-style">style</span> <span class="head">多条提交共用一张卡片，阅读更连贯</span><br><p>统一仓库与分支标题，分别保留作者、时间和 SHA。</p>',
    stats: { files: 3, additions: 48, deletions: 16 },
    translate: false
  }
  const fourth = {
    ...first,
    name: { ...first.name, sha: 'A26C8D1' },
    time_info: '<span>Alice</span> 提交于 <span>5 分钟前</span>',
    text: '<span class="commit-prefix prefix-docs">docs</span> <span class="head">补充推送卡片的配置说明</span>',
    stats: false,
    translate: false
  }
  const development = {
    ...fourth,
    name: { ...fourth.name, branch: 'dev', sha: 'D12A640' },
    text: '<span class="commit-prefix prefix-feat haveScope">feat</span><span class="scope commit-prefix">preview</span> <span class="head">验证开发分支中的独立更新</span>',
    stats: { files: 2, additions: 18, deletions: 3 }
  }
  return [first, second, third, fourth, development, release]
}

module.exports = { displayFixtures, commitDisplayFixtures }
