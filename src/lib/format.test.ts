import { describe, expect, it } from 'vitest'
import {
  formatAcceptTime,
  formatClock,
  formatPenalty,
  formatPenaltyFull,
  formatShort,
  parseClock,
} from './format'

describe('时刻格式化', () => {
  it('分钟精度的通过时刻不带 ":00"', () => {
    expect(formatAcceptTime(46 * 60, true)).toBe('46')
    expect(formatAcceptTime(25 * 60, true)).toBe('25')
    expect(formatAcceptTime(183 * 60, true)).toBe('3:03')
  })

  it('秒级精度保留秒', () => {
    expect(formatAcceptTime(2 * 60 + 24, false)).toBe('2:24')
    expect(formatAcceptTime(63 * 60 + 49, false)).toBe('1:03:49')
    expect(formatAcceptTime(59, false)).toBe('0:59')
  })

  it('大时钟与时间轴刻度', () => {
    expect(formatClock(72425)).toBe('20:07:05')
    expect(formatShort(7260)).toBe('2:01')
    expect(formatClock(0)).toBe('00:00:00')
  })

  it('罚时按分钟取整显示', () => {
    expect(formatPenalty(1294 * 60)).toBe('1294')
    expect(formatPenalty(0)).toBe('0')
    expect(formatPenaltyFull(72425)).toBe('20:07:05')
  })

  it('能解析 h:mm:ss / m:ss', () => {
    expect(parseClock('20:07:05')).toBe(72425)
    expect(parseClock('1:03')).toBe(63)
    expect(parseClock('abc')).toBeNull()
    expect(parseClock('1:2:3:4')).toBeNull()
  })
})
