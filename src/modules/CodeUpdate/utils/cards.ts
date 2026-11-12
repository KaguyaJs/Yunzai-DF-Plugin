import type { CommitInfo, RepositoryInfo } from '@/types'

type CommitCard = CommitInfo & { commits: CommitInfo[] }

/** 同一图片内的同仓库、同分支提交共用卡片，保留原始条目与提交顺序。 */
export function groupCommitCards (content: RepositoryInfo[]): (RepositoryInfo | CommitCard)[] {
  const cards: (RepositoryInfo | CommitCard)[] = []
  const groups = new Map<string, CommitCard>()
  for (const item of content) {
    if ('activity' in item || 'release' in item) {
      cards.push(item)
      continue
    }
    const key = JSON.stringify([item.name.source.toLowerCase(), item.name.repo, item.name.branch || ''])
    let card = groups.get(key)
    if (!card) {
      card = { ...item, commits: [] }
      groups.set(key, card)
      cards.push(card)
    }
    card.commits.push(item)
  }
  return cards
}
