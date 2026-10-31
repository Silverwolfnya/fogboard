const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n))

/**
 * 通过时刻（单元格里用）。
 * minutePrecision = true（board.xcpio 只有分钟）："46" / "3:03"
 * minutePrecision = false（xcpclink 有秒）："46:12" / "1:03:49"
 */
export function formatAcceptTime(sec: number, minutePrecision: boolean): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  if (minutePrecision) {
    return m >= 60 ? `${Math.floor(m / 60)}:${pad2(m % 60)}` : String(m)
  }
  const r = s % 60
  if (m >= 60) return `${Math.floor(m / 60)}:${pad2(m % 60)}:${pad2(r)}`
  return `${m}:${pad2(r)}`
}

/** 04:12:33 —— 用于大时钟 */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`
}

/** 4:12 —— 用于时间轴刻度 / 封榜标记 */
export function formatShort(sec: number): string {
  if (!Number.isFinite(sec)) return '—'
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 3600)}:${pad2(Math.floor((s % 3600) / 60))}`
}

/** 罚时统一用"分钟"整数字符串（ICPC 习惯）：1207 */
export function formatPenalty(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0'
  return String(Math.round(sec / 60))
}

/** 20:07:05 —— 罚时明细里保留秒 */
export function formatPenaltyFull(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${pad2(m)}:${pad2(s % 60)}`
}

export function formatPercent(x: number): string {
  return Number.isInteger(x) ? `${x}%` : `${x.toFixed(1)}%`
}

export function formatSigned(sec: number): string {
  if (sec === 0) return '±0:00'
  const sign = sec > 0 ? '+' : '−'
  const s = Math.abs(Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? `${sign}${h}:${pad2(m)}:${pad2(r)}` : `${sign}${m}:${pad2(r)}`
}

export function pluralTeams(n: number): string {
  return `${n} 队`
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** 把 "h:mm:ss" / "m:ss" 解析成秒；失败返回 null */
export function parseClock(text: string): number | null {
  const t = text.trim()
  if (!/^\d+(:\d{1,2}){1,2}$/.test(t)) return null
  const parts = t.split(':').map((x) => Number(x))
  if (parts.some((x) => !Number.isFinite(x))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return parts[0] * 60 + parts[1]
}
