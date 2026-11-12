const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const template = require('art-template')
const puppeteer = require('puppeteer')
const { createHarness, project } = require('./helpers/code-update.cjs')
const { displayFixtures } = require('./helpers/git-theme-fixtures.cjs')

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

async function main () {
  const args = process.argv.slice(2).filter(value => value !== '--')
  const output = path.resolve((args[0] === '--output' ? args[1] : args[0]) || path.join(os.tmpdir(), 'yunzai-df-git-themes'))
  await fs.mkdir(output, { recursive: true })
  const { CODE_UPDATE_THEMES, resolveCodeUpdateTheme } = createHarness().load('@CodeUpdate/utils/theme')
  const data = {
    lifeData: displayFixtures(),
    pluResPath: pathToFileURL(path.join(project, 'resources')).href,
    sys: { scale: '', copyright: 'Created By Yunzai &amp; DF-Plugin' },
    renderInfo: { repositories: 2, updates: 4 }
  }
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--allow-file-access-from-files', '--disable-background-networking', '--disable-component-update', '--no-first-run'],
    defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1 }
  })
  const reports = []
  try {
    const page = await browser.newPage()
    const blockedRequests = []
    const failedRequests = []
    const errors = []
    await page.setRequestInterception(true)
    page.on('request', request => {
      if (/^(?:file|data|about|blob):/.test(request.url())) void request.continue()
      else {
        blockedRequests.push(request.url())
        void request.abort()
      }
    })
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), type: request.resourceType(), error: request.failure()?.errorText }))
    page.on('response', response => { if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() }) })
    page.on('pageerror', error => errors.push(error.message))
    const cases = [
      ...CODE_UPDATE_THEMES.map(preset => ({ ...preset, themeName: preset.name, scale: 1, overview: true })),
      { ...CODE_UPDATE_THEMES.find(preset => preset.name === 'classic'), name: 'classic-2x', themeName: 'classic', scale: 2 },
      { ...CODE_UPDATE_THEMES.find(preset => preset.name === 'light'), name: 'light-2x', themeName: 'light', scale: 2 },
      { name: 'light-compact', label: '晨光 · 紧凑', themeName: 'light', scale: 1, settings: { Width: 520, Radius: 0 }, longContent: true },
      {
        name: 'dark-wide', label: '深空 · 自定义', themeName: 'dark', scale: 1,
        settings: { Width: 1000, Radius: 28, Background: '#10232f', Surface: '#172f3e', Text: '#e7f3fa', Muted: '#a5c1d1', Accent: '#7ce0ca', Border: '#365563' }
      }
    ]
    for (const preset of cases) {
      const classic = preset.themeName === 'classic'
      const theme = resolveCodeUpdateTheme({ Name: preset.themeName, ...preset.settings })
      const htmlPath = path.join(output, `${preset.name}.html`)
      const imagePath = path.join(output, `${preset.name}.png`)
      await page.setViewport({ width: preset.scale > 1 ? 1440 : 1200, height: 900, deviceScaleFactor: 1 })
      // The original stylesheet has its own default scale; runtime always overrides it too.
      const sys = { ...data.sys, scale: `style="transform:scale(${preset.scale})"` }
      const lifeData = structuredClone(data.lifeData)
      if (preset.longContent) {
        lifeData[0].name.repo = 'VeryLongOrganizationName/a-repository-name-that-is-deliberately-long-for-layout-verification'
        lifeData[0].name.branch = 'feature/very-long-branch-name-without-extra-spaces-to-check-wrapping'
        lifeData[2].diff.files[0].filename = 'packages/a-really-long-package-name/src/modules/CodeUpdate/services/aggregate-all-configured-repositories-into-one-image.ts'
        lifeData[2].diff.files[0].lines[3].text += '.map((repository) => repository.subscriptions.filter((subscription) => subscription.enabled))'
      }
      const templatePath = path.join(project, 'resources/CodeUpdate', classic ? 'classic.html' : 'index.html')
      await fs.writeFile(htmlPath, template(templatePath, { ...data, lifeData, sys, theme }))
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' })
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = resolve; image.onerror = resolve })))
      })
      const metrics = await page.evaluate(() => {
        const container = document.querySelector('#container')
        const bounds = container.getBoundingClientRect()
        const selectors = '.item, .text, .repo-name, .branch, .branch-ref, .desc, .activity-body, .release-assets, .pr-diff, .diff-file, .diff-line, .diff-file-heading, .activity-labels'
        const overflow = [...container.querySelectorAll(selectors)].filter(element => {
          const rect = element.getBoundingClientRect()
          return rect.right > bounds.right + 1 || rect.left < bounds.left - 1 || element.scrollWidth > element.clientWidth + 1
        }).map(element => element.className)
        return {
          width: Math.round(bounds.width), height: Math.round(bounds.height),
          cards: container.querySelectorAll('.item').length,
          borderRadius: getComputedStyle(container.querySelector('.item')).borderRadius,
          colors: Object.fromEntries(['bg', 'surface', 'text', 'muted', 'accent', 'border'].map(name => [name, getComputedStyle(container).getPropertyValue(`--git-${name}`).trim()])),
          loadedFonts: [...document.fonts].map(font => ({ family: font.family, status: font.status })),
          brokenImages: [...container.querySelectorAll('img')].filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src),
          overflow
        }
      })
      if (classic) {
        assert.ok(metrics.width >= 500 * preset.scale && metrics.width <= 630 * preset.scale, `${preset.name}: original responsive container width`)
        assert.ok(Object.values(metrics.colors).every(color => color === ''), `${preset.name}: original palette must not depend on new theme variables`)
      } else assert.equal(metrics.width, (preset.settings?.Width ?? 640) * preset.scale, `${preset.name}: expected card width including rendering scale`)
      assert.equal(metrics.borderRadius, `${preset.settings?.Radius ?? 16}px`, `${preset.name}: configured card radius`)
      for (const [option, color] of Object.entries({ Background: 'bg', Surface: 'surface', Text: 'text', Muted: 'muted', Accent: 'accent', Border: 'border' })) {
        if (preset.settings?.[option]) assert.equal(metrics.colors[color], preset.settings[option], `${preset.name}: ${option} override`)
      }
      assert.equal(metrics.cards, 4, `${preset.name}: all display fixtures must be present`)
      for (const family of classic ? ['font', 'Orbitron-Bold'] : ['DF Sans', 'DF Mono']) assert.ok(metrics.loadedFonts.some(font => font.family.replace(/["']/g, '') === family && font.status === 'loaded'), `${preset.name}: ${family} must load`)
      assert.deepEqual(metrics.brokenImages, [], `${preset.name}: local artwork must load`)
      assert.deepEqual(metrics.overflow, [], `${preset.name}: content must remain within the image`)
      assert.deepEqual(failedRequests, [], `${preset.name}: styles, fonts and local assets must load`)
      const container = await page.$('#container')
      await container.screenshot({ path: imagePath })
      reports.push({ name: preset.name, label: preset.label, description: preset.description, scale: preset.scale, overview: !!preset.overview, image: imagePath, ...metrics })
    }
    assert.deepEqual(errors, [], 'templates must not cause browser exceptions')
    assert.deepEqual(blockedRequests, [], 'the fixture must render entirely from local resources')
    const overviewHtml = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>仓库推送主题</title><style>
*{box-sizing:border-box}body{margin:0;background:#eef2f8;color:#203047;font-family:"Microsoft YaHei",system-ui,sans-serif}.overview{width:1160px;padding:38px 38px 34px}.eyebrow{font-size:12px;letter-spacing:3px;color:#64748b;font-weight:700}h1{margin:12px 0;font-size:34px;letter-spacing:1px}header p{margin:0;color:#64748b;font-size:15px}.themes{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:30px}.theme{background:#fff;border:1px solid #dce3ec;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px #2030470b}.theme h2{font-size:18px;margin:0 0 6px}.theme p{font-size:12px;color:#718096;margin:0}.theme-title{padding:18px 18px 16px}.preview{height:680px;overflow:hidden;background:#e2e8f0}.preview img{width:100%;display:block}footer{margin-top:26px;color:#718096;font-size:13px}
</style><div class="overview"><header><div class="eyebrow">GIT UPDATE · CLASSIC + SIX THEMES</div><h1>熟悉的经典，更多的选择</h1><p>经典原版默认保留，六套新主题自由选择；新主题支持自定义配色、宽度与圆角</p></header><div class="themes">${reports.filter(report => report.overview).map(report => `<section class="theme"><div class="theme-title"><h2>${escapeHtml(report.label)}</h2><p>${escapeHtml(report.description)}</p></div><div class="preview"><img src="${escapeHtml(pathToFileURL(report.image).href)}" alt="${escapeHtml(report.label)}"></div></section>`).join('')}</div><footer>主题预览 · 完整长图分别保存在各主题 PNG 中</footer></div></html>`
    const overviewPath = path.join(output, 'overview.html')
    await fs.writeFile(overviewPath, overviewHtml)
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 })
    await page.goto(pathToFileURL(overviewPath).href, { waitUntil: 'networkidle0' })
    const overview = await page.$('.overview')
    await overview.screenshot({ path: path.join(output, 'overview.png') })
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ themes: reports, blockedRequests, failedRequests, errors }, null, 2))
    console.log(JSON.stringify({ output, overview: path.join(output, 'overview.png'), themes: reports.map(({ name, width, height, cards }) => ({ name, width, height, cards })) }, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
