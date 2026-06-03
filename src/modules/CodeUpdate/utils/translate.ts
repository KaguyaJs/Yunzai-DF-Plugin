import config from '@/config'
import { logger, request } from '@/utils'

const DEFAULT_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single'
const DEFAULT_TRANSLATE_NAME = 'Google 翻译'
const TARGET_LANG = 'zh-CN'
const MAX_CHUNK_LENGTH = 1200
const cache = new Map<string, Promise<string>>()

interface TranslateInfo {
  text: string
  translated: boolean
}

interface TranslateOptions {
  markdown?: boolean
}

export async function translateCodeUpdateText (text: string | undefined, options: TranslateOptions = {}): Promise<string> {
  return (await translateCodeUpdateTextInfo(text, options)).text
}

export async function translateCodeUpdateTextInfo (
  text: string | undefined,
  { markdown = false }: TranslateOptions = {}
): Promise<TranslateInfo> {
  const value = String(text ?? '')

  if (!config.CodeUpdate?.Translate || !value.trim()) {
    return { text: value, translated: false }
  }

  const translatedText = markdown
    ? await translateMarkdown(value)
    : await translatePlainText(value)

  return {
    text: translatedText,
    translated: isTranslated(value, translatedText)
  }
}

export function getCodeUpdateTranslateName (): string {
  return config.CodeUpdate?.TranslateName?.trim() || DEFAULT_TRANSLATE_NAME
}

async function translateMarkdown (text: string): Promise<string> {
  const lines = text.split('\n')
  const result: string[] = []
  let buffer: string[] = []
  let inCodeBlock = false

  const flush = async () => {
    if (!buffer.length) return
    result.push(await translatePlainText(buffer.join('\n')))
    buffer = []
  }

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      await flush()
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }

    if (inCodeBlock) {
      result.push(line)
    } else {
      buffer.push(line)
    }
  }

  await flush()
  return result.join('\n')
}

async function translatePlainText (text: string): Promise<string> {
  if (!shouldTranslate(text)) return text

  const chunks = splitText(text)
  const translated: string[] = []

  for (const chunk of chunks) {
    translated.push(await translateChunk(chunk))
  }

  return translated.join('')
}

async function translateChunk (text: string): Promise<string> {
  if (!shouldTranslate(text)) return text

  const key = `${TARGET_LANG}:${text}`
  if (!cache.has(key)) {
    cache.set(
      key,
      requestTranslate(text).catch((error) => {
        cache.delete(key)
        logger.warn(`[CodeUpdate] 翻译失败: ${error instanceof Error ? error.message : String(error)}`)
        return text
      })
    )
  }

  return cache.get(key) ?? text
}

async function requestTranslate (text: string): Promise<string> {
  const protectedText = protectSegments(text)
  const data = await request.get(buildTranslateUrl(protectedText.text), 'json', { log: 'trace' })
  const translated = parseTranslateResult(data)
  return translated ? protectedText.restore(translated) : text
}

function buildTranslateUrl (text: string): string {
  const api = config.CodeUpdate?.TranslateApi || DEFAULT_TRANSLATE_API

  if (api.includes('{text}') || api.includes('{q}') || api.includes('{target}')) {
    return api
      .replaceAll('{text}', encodeURIComponent(text))
      .replaceAll('{q}', encodeURIComponent(text))
      .replaceAll('{target}', TARGET_LANG)
  }

  const url = new URL(api)
  if (!url.searchParams.has('client')) url.searchParams.set('client', 'gtx')
  if (!url.searchParams.has('sl')) url.searchParams.set('sl', 'auto')
  if (!url.searchParams.has('tl')) url.searchParams.set('tl', TARGET_LANG)
  if (!url.searchParams.has('dt')) url.searchParams.append('dt', 't')
  url.searchParams.set('q', text)
  return url.toString()
}

function parseTranslateResult (data: unknown): string {
  if (!data) return ''

  if (Array.isArray(data)) {
    const googleText = data[0]
      ?.map((item: unknown) => Array.isArray(item) ? String(item[0] ?? '') : '')
      .join('')
    if (googleText) return googleText
  }

  if (typeof data === 'string') return data
  if (typeof data !== 'object') return ''

  const result = data as Record<string, any>
  const direct = result.translatedText ?? result.translated_text ?? result.translation ?? result.text
  if (typeof direct === 'string') return direct

  if (Array.isArray(result.trans_result)) {
    return result.trans_result.map((item: any) => item?.dst ?? '').join('\n')
  }

  if (Array.isArray(result.data?.translations)) {
    return result.data.translations.map((item: any) => item?.translatedText ?? '').join('\n')
  }

  if (Array.isArray(result.data?.trans_result)) {
    return result.data.trans_result.map((item: any) => item?.dst ?? '').join('\n')
  }

  if (typeof result.data?.translatedText === 'string') return result.data.translatedText
  if (typeof result.data?.translation === 'string') return result.data.translation

  return ''
}

function shouldTranslate (text: string): boolean {
  const content = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[{}[\]()#*_~>|.:,;!?/\\0-9-]/g, ' ')

  return /[A-Za-z]{2,}/.test(content)
}

function isTranslated (source: string, translated: string): boolean {
  return shouldTranslate(source) && normalizeText(source) !== normalizeText(translated)
}

function normalizeText (text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
}

function protectSegments (text: string): { text: string, restore: (value: string) => string } {
  const segments: Array<{ token: string, segment: string }> = []
  const protectedText = text.replace(/`[^`\n]+`|https?:\/\/[^\s)]+/g, (segment) => {
    const token = `{{${segments.length}}}`
    segments.push({ token, segment })
    return token
  })

  return {
    text: protectedText,
    restore (value: string) {
      return segments.reduce(
        (result, { token, segment }) => result.replaceAll(token, segment),
        value
      )
    }
  }
}

function splitText (text: string): string[] {
  const chunks: string[] = []
  let current = ''

  for (const part of text.split(/(\n+)/)) {
    if (part.length > MAX_CHUNK_LENGTH) {
      if (current) {
        chunks.push(current)
        current = ''
      }

      for (let start = 0; start < part.length; start += MAX_CHUNK_LENGTH) {
        chunks.push(part.slice(start, start + MAX_CHUNK_LENGTH))
      }

      continue
    }

    if (current && current.length + part.length > MAX_CHUNK_LENGTH) {
      chunks.push(current)
      current = part
    } else {
      current += part
    }
  }

  if (current) chunks.push(current)
  return chunks
}
