type FlattenValue<V> = V extends Array<infer U> ? U : V

/**
 * 按 {{变量名}} 分割模板，并替换传入对象中的值
 * 如果值是数组则展开
 * @param template 模板字符串
 * @param data 替换用的数据对象
 * @param join 是否拼接回字符串
 * @returns 替换后的内容
 */
export function parseTemplate<T extends Record<string, any>> (
  template: string,
  data: T,
  join: true
): string

export function parseTemplate<T extends Record<string, any>> (
  template: string,
  data: T,
  join?: false
): Array<string | FlattenValue<T[keyof T]>>

export function parseTemplate<T extends Record<string, any>> (
  template: string,
  data: T,
  join: boolean = false
) {
  const parts = template.split(/(\{\{.*?\}\})/g)
  const result: Array<any> = []

  for (const part of parts) {
    const match = part.match(/^\{\{(.*?)\}\}$/)
    if (match) {
      const key = match[1].trim() as keyof T
      const value = data[key]
      if (Array.isArray(value)) {
        result.push(...(value as any[]))
      } else if (value !== undefined) {
        result.push(value)
      } else {
        result.push(part)
      }
    } else {
      result.push(part)
    }
  }

  return join ? result.join('') : result
}
