import { Marked } from 'marked'

export const markdown = new Marked({
  tokenizer: {
    del (src) {
      // false 使用内建双波浪号规则，undefined 跳过单波浪号删除线。
      return src.startsWith('~~') ? false : undefined
    }
  }
})
