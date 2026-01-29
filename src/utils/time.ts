import moment from 'moment'

/**
 * 创建一个计时器对象
 *
 * 调用 `start()` 开始计时，调用 `end()` 返回耗时字符串
 *
 * @example
 * const timer = createTimer()
 * timer.start()
 * setTimeout(() => console.log(`运行结束，耗时 ${timer.end()}`), 3000)
 * // log: 运行结束，耗时3秒
 */
export function createTimer () {
  let startTime = 0
  return {
    start () {
      startTime = Date.now()
    },
    end () {
      if (!startTime) return '计时器未启动'
      const elapsed = Date.now() - startTime
      if (elapsed < 1000) {
        return `${elapsed}毫秒`
      } else if (elapsed < 60000) {
        return `${(elapsed / 1000).toFixed(2)}秒`
      } else {
        return `${(elapsed / 60000).toFixed(2)}分钟`
      }
    }
  }
}

/**
 * 格式化时间戳，返回多久之前
 * @param date 时间戳
 * @returns 多久前
 */
export function timeAgo (date: string) {
  const now = moment()
  const duration = moment.duration(now.diff(date))
  const years = duration.years()
  const months = duration.months()
  const days = duration.days()
  const hours = duration.hours()
  const minutes = duration.minutes()

  if (years >= 2) {
    return '两年以前'
  } else if (years >= 1) {
    return '1年前'
  } else if (months >= 1) {
    return `${months}个月前`
  } else if (days >= 1) {
    return `${days}天前`
  } else if (hours >= 1) {
    return `${hours}小时前`
  } else if (minutes >= 1) {
    return `${minutes}分钟前`
  } else {
    return '刚刚'
  }
}

/**
 * 判断指定时间戳是否已过期（按 TTL 计算）。
 *
 * @param {number} timestamp - 待判断的时间戳（秒或毫秒均可，函数会自动识别）。
 * @param {number} ttlSeconds - 生存时间（TTL），单位为秒（必须是非负数）。
 * @returns {boolean} 已过期返回 `true`，未过期返回 `false`。
 *
 * @throws {TypeError} 当任一参数不是有限数字时抛出。
 * @throws {RangeError} 当 ttlSeconds 为负数时抛出。
 *
 * @example
 * // 毫秒时间戳，5 秒之前的时间，ttl = 3 秒 -> 已过期
 * isExpired(Date.now() - 5000, 3) // => true
 *
 * @example
 * // 秒时间戳（自动识别），距现在 2 秒之前，ttl = 5 秒 -> 未过期
 * isExpired(Math.floor(Date.now() / 1000) - 2, 5) // => false
 */
export function isExpired (timestamp: number, ttlSeconds: number): boolean {
  if (!Number.isFinite(timestamp) || !Number.isFinite(ttlSeconds)) {
    throw new TypeError('两个参数必须是有限数字（number）')
  }
  if (ttlSeconds < 0) {
    throw new RangeError('ttlSeconds 必须是非负数')
  }

  // 自动识别秒/毫秒：如果绝对值小于 1e12（约 2001-09-09 的毫秒表示），认为是秒级时间戳
  const tsMs = Math.abs(timestamp) < 1e12 ? timestamp * 1000 : timestamp
  const expireAt = tsMs + ttlSeconds * 1000

  // 当前时间大于等于到期时间则视为过期
  return Date.now() >= expireAt
}
