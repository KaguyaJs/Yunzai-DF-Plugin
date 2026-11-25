import config from '@/config'
import type { RepositoryInfo } from '@/types'
import { logger, request } from '@/utils'

// 跳过注释及不会显示图片的原始文本元素；允许属性值中出现 >。
const IMAGE_TAGS = /<!--[\s\S]*?-->|<(script|style|textarea|title)(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>|<img(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/gi
const ATTRIBUTES = /\s+([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function imageUrl (tag: string): string | undefined {
  if (!/^<img(?=[\s/>])/i.test(tag)) return
  const attribute = [...tag.matchAll(ATTRIBUTES)].find(match => match[1].toLowerCase() === 'src')
  const source = attribute && (attribute[2] ?? attribute[3] ?? attribute[4])
  if (!source) return
  const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }
  const decoded = source.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const name = entity.slice(1, -1).toLowerCase()
    if (!name.startsWith('#')) return entities[name]
    const point = name.startsWith('#x') ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1))
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
  }).trim()
  if (!/^(?:https?:)?\/\//i.test(decoded)) return
  try {
    const url = new URL(decoded.startsWith('//') ? `https:${decoded}` : decoded)
    url.hash = ''
    return url.href
  } catch {
    return undefined
  }
}

/** 开启代理时预先下载正文图片，以 data URL 交给浏览器；原始条目保持不变。 */
export async function prepareMarkdownImages (content: RepositoryInfo[]): Promise<RepositoryInfo[]> {
  if (!config.proxy?.open || !config.proxy.url) return content
  const urls = [...new Set(content.flatMap(item => [...item.text.matchAll(IMAGE_TAGS)]
    .map(match => imageUrl(match[0])).filter((url): url is string => !!url)))]
  if (!urls.length) return content
  const images = new Map<string, string>()
  // 同一张截图去重，限制并发；每张图片仍使用下载器的默认超时。
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, async () => {
    while (urls.length) {
      const url = urls.pop()!
      try {
        const result = await request.download(url, { size: MAX_IMAGE_BYTES, headers: { Accept: 'image/*' } })
        if (result && result.data.length && /^image\/[\w.+-]+$/.test(result.contentType)) {
          images.set(url, `data:${result.contentType};base64,${result.data.toString('base64')}`)
        }
      } catch (error) {
        logger.debug('Markdown 图片下载失败:', error)
      }
    }
  }))
  return content.map(item => {
    const text = item.text.replace(IMAGE_TAGS, tag => {
      const url = imageUrl(tag)
      const image = url && images.get(url)
      if (!image) return tag
      return tag.replace(ATTRIBUTES, (attribute, name: string) => {
        switch (name.toLowerCase()) {
          case 'src': return ` ${name}="${image}"`
          case 'srcset': return ''
          case 'loading': return ' loading="eager"'
          default: return attribute
        }
      })
    })
    return text === item.text ? item : { ...item, text }
  })
}
