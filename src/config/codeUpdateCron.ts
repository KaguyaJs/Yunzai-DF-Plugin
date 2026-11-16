/** EasyCron 的通配年份不限制执行时间，可移除以兼容 node-schedule 的五/六段格式。 */
export function normalizeCodeUpdateCron (cron: string): string {
  if (typeof cron !== 'string') return cron
  const fields = cron.trim().split(/\s+/)
  return fields.length === 7 && fields[6] === '*' ? fields.slice(0, 6).join(' ') : cron
}
