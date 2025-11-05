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
