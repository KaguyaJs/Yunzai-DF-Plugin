/**
 * 由 DF 的锅巴扩展路由注入 Vue 导入后加载，不依赖其他插件。
 * 主体是模板编辑区，其次是示例预览，变量提示和源码入口为辅助。
 * 保存使用锅巴原有主按钮；样式沿用锅巴 Ant Design 的颜色、4px 圆角与 8/12/16px 间距。
 */
export function registerContactTemplateEditor(vue, componentMap) {
  const { defineComponent, h, ref, watch, onMounted, onBeforeUnmount } = vue
  const original = componentMap.get('InputTextArea')
  if (original?.dfContactTemplateWrapper) return
  const fields = {
    notice: { key: '消息标识', avatar: '发送者头像', platform: '平台', user: '发送者信息', group: '群聊信息', bot: '机器人信息', time: '发送时间', msg: '消息内容' },
    success: { masterQQ: '主人账号' },
    failure: { masterQQ: '主人账号' },
    reply: { nickname: '主人昵称', id: '主人账号', msg: '回复内容' },
  }
  // 与 DF parseTemplate 使用相同的分段规则，未知变量原样保留。
  const split = value => String(value || '').split(/(\{\{.*?\}\})/g)
  const variable = part => part.match(/^\{\{(.*?)\}\}$/)?.[1].trim()
  const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#e6f7ff"/><circle cx="32" cy="24" r="10" fill="#1890ff"/><path d="M13 55c0-13 8-20 19-20s19 7 19 20" fill="#1890ff"/></svg>')
  const css = `
  .df-contact-template{width:100%;min-width:0;color:inherit}
  .df-contact-template .dfct-tools{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
  .df-contact-template button{font:inherit;cursor:pointer;border:1px solid #d9d9d9;border-radius:4px;background:transparent;color:inherit;padding:6px 10px;min-height:36px}
  .df-contact-template button:disabled{opacity:.5;cursor:default}
  .df-contact-template button:focus-visible,.df-contact-template [contenteditable]:focus-visible{outline:2px solid #1890ff;outline-offset:2px}
  .df-contact-template .dfct-text{border:1px solid #d9d9d9;border-radius:4px;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;min-height:96px;line-height:1.8;outline:none}
  .df-contact-template .dfct-token{display:inline-block;background:#e6f7ff;color:#0050b3;border:1px solid #91d5ff;border-radius:4px;padding:0 6px;margin:0 2px;user-select:all}
  .df-contact-template .dfct-help{font-size:13px;line-height:1.7;opacity:.8;overflow-wrap:anywhere;margin:8px 0}
  .df-contact-template .dfct-preview{border-top:1px solid #d9d9d9;padding-top:12px;margin-top:16px}
  .df-contact-template .dfct-preview-title{font-weight:600}
  .df-contact-template .dfct-preview[open] .dfct-preview-title{margin-bottom:8px}
  .df-contact-template .dfct-content{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;max-width:35em}
  .df-contact-template .dfct-avatar{display:block;width:64px;height:64px;margin:8px 0}
  .df-contact-template .dfct-media{display:block;border-left:3px solid #91d5ff;padding:8px 12px;margin:8px 0;white-space:pre-wrap}
  .df-contact-template .dfct-warning{color:#ad6800;font-size:13px;line-height:1.7;margin:8px 0;overflow-wrap:anywhere}
  .df-contact-template details{margin:12px 0}.df-contact-template summary{cursor:pointer}
  .df-contact-template .dfct-source{box-sizing:border-box;width:100%;font:inherit;border:1px solid #d9d9d9;border-radius:4px;background:transparent;color:inherit;padding:8px;margin-top:8px;resize:vertical}
  [data-theme=dark] .df-contact-template{color:#d9d9d9}
  [data-theme=dark] .df-contact-template button,[data-theme=dark] .df-contact-template .dfct-text,[data-theme=dark] .df-contact-template .dfct-source,[data-theme=dark] .df-contact-template .dfct-preview{border-color:#595959}
  [data-theme=dark] .df-contact-template .dfct-token{background:#111d2c;color:#69c0ff;border-color:#177ddc}
  [data-theme=dark] .df-contact-template .dfct-warning{color:#ffc53d}
  `
  const Editor = defineComponent({
    name: 'DFContactTemplateEditor', inheritAttrs: false,
    props: { value: { type: String, default: '' }, kind: String, disabled: Boolean }, emits: ['change'],
    setup(props, { emit }) {
      const text = ref(String(props.value || ''))
      let ownValue = text.value, editor, caret
      const allowed = () => fields[props.kind] || {}
      function fillEditor() {
        if (!editor) return
        editor.replaceChildren()
        for (const part of split(text.value)) {
          const key = variable(part)
          if (key && Object.hasOwn(allowed(), key)) {
            const chip = document.createElement('span')
            chip.className = 'dfct-token'; chip.contentEditable = 'false'; chip.dataset.placeholder = key; chip.dataset.raw = part; chip.textContent = allowed()[key]
            editor.append(chip)
          } else editor.append(document.createTextNode(part))
        }
        caret = undefined
      }
      function readText(node) {
        if (node.nodeType === 3) return node.textContent
        if (node.dataset?.placeholder) return node.dataset.raw || '{{' + node.dataset.placeholder + '}}'
        if (node.nodeName === 'BR') return '\n'
        let value = ''
        for (const child of node.childNodes) {
          const block = ['DIV', 'P'].includes(child.nodeName)
          if (block && value && !value.endsWith('\n')) value += '\n'
          const empty = block && child.childNodes.length === 1 && child.firstChild.nodeName === 'BR'
          value += empty ? '\n' : readText(child)
        }
        return value
      }
      function remember() {
        const selection = window.getSelection()
        if (selection.rangeCount && editor?.contains(selection.anchorNode)) caret = selection.getRangeAt(0).cloneRange()
      }
      function update(value) { ownValue = value; text.value = value; emit('change', value) }
      function changed() { update(readText(editor)); remember() }
      function copy(event, cut = false) {
        const selection = window.getSelection()
        if (!selection?.rangeCount) return
        const range = selection.getRangeAt(0)
        if (!editor?.contains(range.startContainer) || !editor.contains(range.endContainer)) return
        event.preventDefault()
        event.clipboardData.setData('text/plain', readText(range.cloneContents()))
        if (cut && !props.disabled) { range.deleteContents(); changed() }
      }
      function insert(key) {
        if (!editor || props.disabled) return
        editor.focus()
        const range = caret && editor.contains(caret.startContainer) ? caret : document.createRange()
        if (!caret || !editor.contains(range.startContainer)) { range.selectNodeContents(editor); range.collapse(false) }
        range.deleteContents()
        const node = document.createElement('span'); node.className = 'dfct-token'; node.contentEditable = 'false'; node.dataset.placeholder = key; node.dataset.raw = '{{' + key + '}}'; node.textContent = allowed()[key]
        range.insertNode(node); range.setStartAfter(node); range.collapse(true)
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); caret = range.cloneRange(); changed()
      }
      const editorRef = node => { if (node && editor !== node) { editor = node; fillEditor() } else if (!node) editor = undefined }
      function preview() {
        const values = { key: '联系主人消息(AB123)', platform: 'QQ', user: '小明(123456)', group: '示例群(654321)', bot: '机器人(10001)', time: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }), masterQQ: '10086', nickname: '主人小林', id: '10086' }
        return split(text.value).map(part => {
          const key = variable(part)
          if (!key || !Object.hasOwn(allowed(), key)) return part
          if (key === 'avatar') return h('img', { class: 'dfct-avatar', src: avatar, alt: '发送者头像示例' })
          if (key === 'msg') return h('span', { class: 'dfct-media' }, props.kind === 'reply' ? '示例回复内容\n[原回复中的图片等消息段]' : '示例联系内容\n[原消息中的图片等消息段]')
          return values[key] || part
        })
      }
      watch(() => props.value, value => { if (String(value || '') !== ownValue) { ownValue = String(value || ''); text.value = ownValue; fillEditor() } })
      onMounted(fillEditor)
      onBeforeUnmount(() => { editor = undefined; caret = undefined })
      return () => h('div', { class: 'df-contact-template' }, [
        h('style', css),
        h('div', { class: 'dfct-tools' }, Object.entries(allowed()).map(([key, label]) => h('button', { type: 'button', disabled: props.disabled, onMousedown: event => event.preventDefault(), onClick: () => insert(key) }, label))),
        h('div', { class: 'dfct-text', ref: editorRef, contenteditable: !props.disabled, role: 'textbox', 'aria-label': '联系主人模板文字', 'aria-multiline': 'true', onInput: changed, onFocus: remember, onKeyup: remember, onMouseup: remember, onCopy: event => copy(event), onCut: event => copy(event, true), onPaste: event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')) } }),
        h('p', { class: 'dfct-help' }, '直接编写文字或换行，点击按钮插入变量块；变量块可选中删除。完成后点击锅巴原有的“保存”。'),
        ...(!text.value.trim() ? [h('p', { class: 'dfct-warning' }, '模板不能为空，请填写内容后保存。')] : []),
        ...split(text.value).filter(part => variable(part) && !Object.hasOwn(allowed(), variable(part))).map(part => h('p', { class: 'dfct-warning' }, '未识别变量 ' + part + '：实际发送会原样保留，请检查拼写。')),
        ...(props.kind === 'notice' && !split(text.value).some(part => variable(part) === 'key') ? [h('p', { class: 'dfct-warning' }, '未包含消息标识：主人无法引用这条通知回复，建议插入“消息标识”。')] : []),
        h('details', { class: 'dfct-preview', 'aria-label': '联系主人模板实时预览' }, [h('summary', { class: 'dfct-preview-title' }, '预览 · 使用示例账号和消息'), h('div', { class: 'dfct-content' }, preview())]),
        h('details', [h('summary', '查看或粘贴模板内容'), h('textarea', { class: 'dfct-source', rows: 4, value: text.value, disabled: props.disabled, 'aria-label': '联系主人模板源码', onInput: event => { update(event.target.value); fillEditor() } })]),
      ])
    },
  })
  const Wrapper = defineComponent({
    name: 'DFContactTemplateTextArea', inheritAttrs: false,
    props: { dfContactTemplate: String, value: [String, Number], disabled: Boolean },
    setup(props, { attrs }) { return () => props.dfContactTemplate ? h(Editor, { ...attrs, value: String(props.value || ''), kind: props.dfContactTemplate, disabled: props.disabled }) : h(original, { ...attrs, value: props.value, disabled: props.disabled }) },
  })
  Wrapper.dfContactTemplateWrapper = true
  componentMap.set('InputTextArea', Wrapper)
}
