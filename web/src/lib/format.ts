/** 相对时间：“3 分钟前”；一分钟内返回 null，由调用方显示“刚刚” */
export function formatRelative(date: Date, locale: string, now = Date.now()): string | null {
  const seconds = Math.round((date.getTime() - now) / 1000)
  if (Math.abs(seconds) < 60) return null
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return null
}

export function formatDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** 游戏时长：“2 小时 5 分” / “12 分钟” */
export function formatPlayTime(seconds: number, t: (key: string, values: Record<string, number>) => string): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? t('saves.hours', { h, m }) : t('saves.minutes', { m })
}
