import { Marked } from 'marked'
import { timeAgo } from '@/utils'
import type { ActivityEvent, ActivityInfo } from '@/types'
import { ACTIVITY_ACTIONS, activityOptions, safeActivityUrl } from './activity'
import { displayPullRequestDiff } from './diff'
import { getIcon } from './format'
import { getCodeUpdateTranslateName, translateCodeUpdateTextInfo } from './translate'

function escapeHtml (text: string) {
  return text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

// Repository bodies are rendered as Markdown; raw HTML and embedded images remain text.
const activityMarkdown = new Marked({
  renderer: {
    html ({ text }) { return escapeHtml(text) },
    image ({ text }) { return `<span class="activity-image-alt">[图片${text ? `：${escapeHtml(text)}` : ''}]</span>` },
    link ({ href, tokens }) {
      const text = this.parser.parseInline(tokens)
      const url = safeActivityUrl(href)
      return url ? `<a href="${escapeHtml(url)}">${text}</a>` : text
    }
  }
})

export async function formatActivityInfo (event: ActivityEvent): Promise<ActivityInfo> {
  const { item, comment } = event
  const author = comment?.author ?? item.author
  const title = await translateCodeUpdateTextInfo(item.title)
  const body = await translateCodeUpdateTextInfo(comment?.body ?? item.body, { markdown: true })
  const translated = title.translated || body.translated
  const renderedBody = body.text ? activityMarkdown.parse(body.text, { async: false }) : ''
  const authorText = `<span>${escapeHtml(author)}</span>`
  const timeText = `<span>${escapeHtml(timeAgo(event.occurredAt))}</span>`
  return {
    activity: true,
    url: comment?.url || item.url,
    avatar: { is: false, author: comment?.avatar ?? item.avatar },
    icon: await getIcon(event.provider),
    name: { source: event.provider, repo: event.repo, authorStart: author[0] || '?' },
    time_info: comment ? `${authorText} 评论于 ${timeText}` : `作者 ${authorText} · 活动于 ${timeText}`,
    text: `<span class="head">${escapeHtml(title.text)}</span>${renderedBody ? `<div class="activity-body">${renderedBody}</div>` : ''}`,
    translate: translated ? { label: getCodeUpdateTranslateName(), title: '已在渲染前自动翻译' } : false,
    stats: comment ? undefined : item.stats,
    diff: activityOptions().showDiff && event.method === 'pulls' && !comment && event.diff ? displayPullRequestDiff(event.diff) : undefined,
    detail: {
      kind: event.method === 'pulls' ? 'PR' : 'Issue',
      number: item.number,
      state: item.state,
      stateLabel: { open: '打开', closed: '已关闭', merged: '已合并' }[item.state],
      actions: event.actions.map(action => ACTIVITY_ACTIONS[action]),
      draft: item.draft,
      labels: item.labels,
      baseBranch: item.baseBranch,
      headBranch: item.headBranch,
      comments: item.comments,
      comment: !!comment
    }
  }
}
