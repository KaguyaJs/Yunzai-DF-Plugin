import { createHash } from 'node:crypto'
import config from '@/config'
import type { Release, ReleaseInfo } from '@/types'
import { safeActivityUrl } from './activity'

export function releaseIdentity (release: Release) {
  return release.node_id || (release.id !== undefined && release.id !== null ? String(release.id) : release.tag_name) || ''
}

/** Explicit publication state; draft edits exclude timestamps and download counters. */
export function releaseCursor (release: Release) {
  const id = releaseIdentity(release)
  if (!id) return ''
  if (!release.draft) return `${id}:${release.prerelease ? 'prerelease' : 'published'}`
  const assets = (Array.isArray(release.assets) ? release.assets : [])
    .map(asset => [asset.id, asset.name, asset.label, asset.state, asset.size, asset.digest, asset.browser_download_url])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const hash = createHash('sha256').update(JSON.stringify([
    release.tag_name, release.target_commitish, release.name, release.body, !!release.prerelease, assets
  ])).digest('hex')
  return `${id}:draft:${hash}`
}

function fileSize (bytes: unknown) {
  const value = typeof bytes === 'number' ? bytes : Number(bytes)
  if (!Number.isFinite(value) || value < 0) return '大小未知'
  const unit = Math.min(4, Math.floor(Math.log(Math.max(1, value)) / Math.log(1024)))
  return `${Number((value / 1024 ** unit).toFixed(unit ? 2 : 0))} ${['B', 'KB', 'MB', 'GB', 'TB'][unit]}`
}

export function releaseAssets (release: Release): ReleaseInfo['assets'] {
  const options = config.CodeUpdate.Release
  if (options?.ShowAssets === false) return undefined
  const assets = (Array.isArray(release.assets) ? release.assets : [])
    .filter(asset => asset && typeof asset.name === 'string' && asset.name)
  if (!assets.length) return undefined
  const limit = Number.isInteger(options?.AssetLimit) && options.AssetLimit >= -1 ? options.AssetLimit : 5
  const files = (limit === -1 ? assets : assets.slice(0, limit))
    .map(asset => ({ name: asset.name, url: safeActivityUrl(asset.browser_download_url), size: fileSize(asset.size) }))
  return { total: assets.length, hidden: assets.length - files.length, files }
}
