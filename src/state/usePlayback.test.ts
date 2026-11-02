import { describe, expect, it } from 'vitest'
import { elapsedAt } from './usePlayback'

const DURATION = 5 * 3600

describe('播放时钟按墙钟推算，而不是按帧累加', () => {
  it('1× 走了 60 秒，就是 60 秒', () => {
    expect(elapsedAt(0, 1_000, 61_000, 1, DURATION)).toBeCloseTo(60, 6)
  })

  it('30× 走了 60 秒，等于赛时 30 分钟', () => {
    expect(elapsedAt(0, 0, 60_000, 30, DURATION)).toBeCloseTo(1800, 6)
  })

  it('从一个锚点继续走（暂停再播放）', () => {
    expect(elapsedAt(120, 5_000, 35_000, 1, DURATION)).toBeCloseTo(150, 6)
  })

  it('后台挂了半小时再回来，时间一次追平', () => {
    // 播放中切后台 30 分钟，rAF 一帧都没跑，回来后仍然应该是 +30:00
    expect(elapsedAt(600, 0, 30 * 60 * 1000, 1, DURATION)).toBeCloseTo(2400, 6)
  })

  it('不会超过总时长', () => {
    expect(elapsedAt(DURATION - 10, 0, 10 * 60 * 1000, 1, DURATION)).toBe(DURATION)
  })

  it('系统时钟被往回拨时不倒退', () => {
    expect(elapsedAt(600, 10_000, 4_000, 1, DURATION)).toBe(600)
  })
})
