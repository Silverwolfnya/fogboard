import { describe, expect, it } from 'vitest'
import { CHENGDU, QINHUANGDAO, loadIndex } from '../testing/fixtures'
import { computeThreshold, computeUnlocks } from './unlock'
import { DEFAULT_SETTINGS } from './settings'
import type { Settings } from '../types'

const min = (m: number) => m * 60

describe('阈值 k = min(50, ceil(20% · N))', () => {
  it('328 队 → 50（固定阈值更小）', () => {
    const t = computeThreshold(328, DEFAULT_SETTINGS)
    expect(t.percentThreshold).toBe(66)
    expect(t.threshold).toBe(50)
    expect(t.source).toBe('min')
  })

  it('100 队 → 20（百分比更小）', () => {
    expect(computeThreshold(100, DEFAULT_SETTINGS).threshold).toBe(20)
  })

  it('20 队 → 4（ceil 向上取整）', () => {
    expect(computeThreshold(20, DEFAULT_SETTINGS).threshold).toBe(4)
  })

  it('关掉固定阈值 → 只剩百分比', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, unlockCount: null }
    expect(computeThreshold(328, s).threshold).toBe(66)
    expect(computeThreshold(328, s).source).toBe('percent')
  })

  it('两条同时满足 → 取较大值', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, combine: 'max' }
    expect(computeThreshold(328, s).threshold).toBe(66)
  })

  it('两条都关掉 → 没有阈值', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, unlockCount: null, unlockPercent: null }
    const t = computeThreshold(328, s)
    expect(t.threshold).toBeNull()
    expect(t.source).toBe('off')
  })
})

describe('解锁时刻（成都站 / 所有队伍，N=328, k=50）', () => {
  const index = loadIndex(CHENGDU, '所有队伍')
  const plan = computeUnlocks(index, DEFAULT_SETTINGS)
  const byLetter = Object.fromEntries(plan.problems.map((p) => [p.letter, p]))

  it('阈值与需求一致', () => {
    expect(plan.threshold.n).toBe(328)
    expect(plan.threshold.threshold).toBe(50)
  })

  it('达到 50 队的题按第 50 个 AC 解锁', () => {
    expect(byLetter.M.unlockSec).toBe(min(20))
    expect(byLetter.M.reason).toBe('threshold')
    expect(byLetter.D.unlockSec).toBe(min(29))
    expect(byLetter.K.unlockSec).toBe(min(80))
    expect(byLetter.C.unlockSec).toBe(min(121))
    expect(byLetter.I.unlockSec).toBe(min(131))
  })

  it('没达到 50 队的题在封榜时（4:00）解锁', () => {
    for (const letter of ['A', 'B', 'E', 'F', 'G', 'H', 'J', 'L']) {
      expect(byLetter[letter].unlockSec).toBe(min(240))
      expect(byLetter[letter].reason).toBe('freeze')
    }
  })

  it('通过数达不到阈值时给出阈值时刻 null', () => {
    expect(byLetter.A.thresholdAtSec).toBeNull()
    expect(byLetter.M.thresholdAtSec).toBe(min(20))
  })
})

describe('解锁时刻（成都站 / 正式队伍，N=319, k=50）', () => {
  const index = loadIndex(CHENGDU, '正式队伍')
  const plan = computeUnlocks(index, DEFAULT_SETTINGS)
  const byLetter = Object.fromEntries(plan.problems.map((p) => [p.letter, p]))

  it('只有正式队参与计数，解锁更晚', () => {
    expect(byLetter.M.unlockSec).toBe(min(21))
    expect(byLetter.D.unlockSec).toBe(min(29))
    expect(byLetter.K.unlockSec).toBe(min(82))
    expect(byLetter.C.unlockSec).toBe(min(138))
    expect(byLetter.I.unlockSec).toBe(min(140))
  })
})

describe('解锁时刻（秦皇岛站 / Main，N=375, k=50）', () => {
  const index = loadIndex(QINHUANGDAO, 'Main')
  const plan = computeUnlocks(index, DEFAULT_SETTINGS)
  const byLetter = Object.fromEntries(plan.problems.map((p) => [p.letter, p]))

  it('7 道简单题按第 50 个 AC 解锁', () => {
    expect(byLetter.B.unlockSec).toBe(102)
    expect(byLetter.I.unlockSec).toBe(586)
    expect(byLetter.J.unlockSec).toBe(904)
    expect(byLetter.H.unlockSec).toBe(961)
    expect(byLetter.E.unlockSec).toBe(1 * 3600 + 12 * 60 + 7)
    expect(byLetter.K.unlockSec).toBe(3 * 3600 + 6 * 60 + 27)
    expect(byLetter.A.unlockSec).toBe(3 * 3600 + 18 * 60 + 32)
  })

  it('6 道难题一直等到封榜', () => {
    for (const letter of ['C', 'D', 'F', 'G', 'L', 'M']) {
      expect(byLetter[letter].unlockSec).toBe(min(240))
      expect(byLetter[letter].reason).toBe('freeze')
    }
  })
})

describe('阈值可调', () => {
  const index = loadIndex(CHENGDU, '所有队伍')

  it('把固定阈值改成 30 队，解锁提前', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, unlockCount: 30 }
    const plan = computeUnlocks(index, s)
    const m = plan.problems.find((p) => p.letter === 'M')!
    expect(plan.threshold.threshold).toBe(30)
    expect(m.thresholdAtSec).toBe(index.acSecs.M[29])
    expect(m.unlockSec).toBeLessThan(min(20))
  })

  it('只留 5% 的百分比规则，阈值变成 17 队', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, unlockCount: null, unlockPercent: 5 }
    const plan = computeUnlocks(index, s)
    expect(plan.threshold.threshold).toBe(17)
  })

  it('关闭封榜后，没达到阈值的题永远不解锁', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, freezeEnabled: false }
    const plan = computeUnlocks(index, s)
    const a = plan.problems.find((p) => p.letter === 'A')!
    expect(a.unlockSec).toBe(Number.POSITIVE_INFINITY)
    expect(a.reason).toBe('never')
  })

  it('关掉"封榜全解锁"后，没达到阈值的题也不解锁', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, unlockAtFreeze: false }
    const plan = computeUnlocks(index, s)
    const a = plan.problems.find((p) => p.letter === 'A')!
    expect(a.unlockSec).toBe(Number.POSITIVE_INFINITY)
  })
})
