import { describe, expect, it } from 'vitest'
import { CHENGDU, QINHUANGDAO, loadIndex } from '../testing/fixtures'
import { computeUnlocks } from '../rules/unlock'
import { DEFAULT_SETTINGS } from '../rules/settings'
import { buildSnapshot } from './snapshot'
import type { Settings } from '../types'

const min = (m: number) => m * 60

const index = loadIndex(CHENGDU, '所有队伍')

function snap(t: number, settings: Settings = DEFAULT_SETTINGS, manualReveal = false) {
  const plan = computeUnlocks(index, settings)
  return buildSnapshot({ index, plan, settings, t, manualReveal })
}

describe('快照：赛前', () => {
  const s = snap(0)

  it('0:00 时没有任何通过、所有题目未解锁', () => {
    expect(s.phase).toBe('before')
    expect(s.rows.every((r) => r.solved === 0)).toBe(true)
    expect(s.problems.every((p) => !p.unlocked)).toBe(true)
    expect(s.stats.totalAc).toBe(0)
  })
})

describe('快照：逐题解锁', () => {
  it('20:00 之前 M 题仍锁定，20:00 整解锁', () => {
    expect(snap(min(20) - 1).problems.find((p) => p.letter === 'M')!.unlocked).toBe(false)
    expect(snap(min(20)).problems.find((p) => p.letter === 'M')!.unlocked).toBe(true)
  })

  it('29:00 时 M、D 已解锁，F 仍是雾格', () => {
    const s = snap(min(29))
    const by = Object.fromEntries(s.problems.map((p) => [p.letter, p]))
    expect(by.M.unlocked).toBe(true)
    expect(by.D.unlocked).toBe(true)
    expect(by.F.unlocked).toBe(false)
    expect(by.F.reason).toBe('freeze')
  })

  it('2:11:00 时恰好 5 道题解锁', () => {
    const s = snap(min(131))
    const unlocked = s.problems.filter((p) => p.unlocked).map((p) => p.letter).sort()
    expect(unlocked).toEqual(['C', 'D', 'I', 'K', 'M'])
  })

  it('解锁后能看到该题的真实通过数', () => {
    const s = snap(min(131))
    const m = s.problems.find((p) => p.letter === 'M')!
    const expected = index.acSecs.M.filter((sec) => sec <= min(131)).length
    expect(m.accepted).toBe(expected)
  })

  it('未解锁题的单元格在任何行都是 locked', () => {
    const s = snap(min(29))
    const fIndex = s.problems.findIndex((p) => p.letter === 'F')
    expect(s.rows.every((r) => r.cells[fIndex].kind === 'locked')).toBe(true)
  })

  it('刚解锁的列会被标记，用于整列点亮的动效', () => {
    expect(snap(min(20)).problems.find((p) => p.letter === 'M')!.justUnlocked).toBe(true)
    expect(snap(min(30)).problems.find((p) => p.letter === 'M')!.justUnlocked).toBe(false)
  })
})

describe('快照：通过顺序（主榜的"第 k 次通过"）', () => {
  const s = snap(min(60))

  it('每队的通过按时刻升序排列', () => {
    for (const row of s.rows) {
      for (let i = 1; i < row.solves.length; i += 1) {
        expect(row.solves[i].acceptSec).toBeGreaterThanOrEqual(row.solves[i - 1].acceptSec)
      }
    }
  })

  it('solves 长度等于通过数', () => {
    expect(s.rows.every((r) => r.solves.length === r.solved)).toBe(true)
  })

  it('锁定的题目同样计入通过数与通过顺序', () => {
    // 60:00 时只有 M、D 两道题解锁，但主榜的通过数包含全部题目
    const visibleAc = s.rows.reduce(
      (n, r) => n + r.cells.filter((c) => c.kind === 'ac').length,
      0,
    )
    const totalAc = s.rows.reduce((n, r) => n + r.solved, 0)
    expect(totalAc).toBeGreaterThan(visibleAc)
    expect(visibleAc).toBeGreaterThan(0)
  })

  it('未解锁题目在队伍抽屉的明细里仍然是雾', () => {
    const row = s.rows.find((r) => r.solved >= 3)!
    expect(row.cells.some((c) => c.kind === 'locked')).toBe(true)
  })
})

describe('快照：封榜与终榜', () => {
  const atFreeze = snap(min(240))
  const frozen = snap(min(245))
  const final = snap(min(300))

  it('4:00 时所有题目解锁（封榜全解锁）', () => {
    expect(atFreeze.problems.every((p) => p.unlocked)).toBe(true)
    expect(atFreeze.phase).toBe('frozen')
  })

  it('封榜期间数据冻结在 4:00', () => {
    expect(frozen.phase).toBe('frozen')
    expect(frozen.dataT).toBe(min(240))
    expect(frozen.stats.totalAc).toBe(atFreeze.stats.totalAc)
    expect(frozen.rows.map((r) => r.solved)).toEqual(atFreeze.rows.map((r) => r.solved))
  })

  it('封榜期间不显示错误提交数', () => {
    expect(frozen.rows.every((r) => r.cells.every((c) => c.kind !== 'rejected'))).toBe(true)
  })

  it('5:00 终榜解冻，能看到 4:00 之后的通过', () => {
    expect(final.phase).toBe('final')
    expect(final.stats.totalAc).toBeGreaterThan(frozen.stats.totalAc)
    expect(final.rows.some((r) => r.cells.some((c) => c.kind === 'rejected'))).toBe(true)
    expect(final.stats.totalAc).toBe(1214)
  })

  it('终榜名次与导出文件逐队一致', () => {
    const bad = final.rows.filter((r) => r.team.source.rank !== r.rank)
    expect(bad.map((r) => `${r.team.name}: 文件 ${r.team.source.rank} / 重算 ${r.rank}`)).toEqual([])
  })

  it('终榜第一与文件的 Rank 1 一致', () => {
    expect(final.rows[0].team.name).toBe('CF皇帝')
    expect(final.rows[0].solved).toBe(11)
    expect(final.rows[0].penaltySec).toBe(1294 * 60)
  })

  it('手动解封可以提前看到封榜后的数据', () => {
    const s = snap(min(245), DEFAULT_SETTINGS, true)
    expect(s.revealed).toBe(true)
    expect(s.dataT).toBe(min(245))
    expect(s.stats.totalAc).toBeGreaterThan(frozen.stats.totalAc)
  })
})

describe('快照：我的队伍与口径', () => {
  const early = index.teams.find((t) => Object.values(t.cells).some((c) => c.ac && (c.acceptSec ?? 1e9) <= 600))!

  it('找到一支在 10 分钟内就通过的队伍用于测试', () => {
    expect(early).toBeTruthy()
  })

  it('未解锁题目下，只有"我的队伍"能看见自己的格子', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, selfTeamId: early.id }
    const s = snap(600, settings)
    const self = s.rows.find((r) => r.teamId === early.id)!
    expect(self.isSelf).toBe(true)
    expect(self.cells.filter((c) => c.kind === 'ac').length).toBeGreaterThan(0)
    const others = s.rows.filter((r) => !r.isSelf)
    expect(others.every((r) => r.cells.every((c) => c.kind === 'locked'))).toBe(true)
  })

  it('只统计正式队时，N 与行数都变成 319', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, scope: 'official' }
    const s = snap(min(300), settings)
    expect(s.teamCount).toBe(319)
    expect(s.rows).toHaveLength(319)
    expect(s.rows.every((r) => r.team.markers.official)).toBe(true)
  })

  it('降低阈值后，同一时刻解锁的题更多', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, unlockCount: 30 }
    const looser = snap(min(20), settings)
    const base = snap(min(20))
    expect(looser.stats.unlockedProblems).toBeGreaterThanOrEqual(base.stats.unlockedProblems)
    expect(looser.problems.find((p) => p.letter === 'M')!.unlocked).toBe(true)
  })

  it('调试开关"显示完整信息"会跳过解锁与封榜', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, showFullInfo: true }
    const s = snap(min(10), settings)
    expect(s.problems.every((p) => p.unlocked)).toBe(true)
    expect(s.revealed).toBe(true)
  })
})

describe('快照：秦皇岛站', () => {
  const qhd = loadIndex(QINHUANGDAO, 'Main')
  const plan = computeUnlocks(qhd, DEFAULT_SETTINGS)
  const s = buildSnapshot({ index: qhd, plan, settings: DEFAULT_SETTINGS, t: 3000, manualReveal: false })

  it('50 分钟时 B、I、J、H 已解锁，A 未解锁', () => {
    const by = Object.fromEntries(s.problems.map((p) => [p.letter, p]))
    expect(by.B.unlocked).toBe(true)
    expect(by.I.unlocked).toBe(true)
    expect(by.J.unlocked).toBe(true)
    expect(by.H.unlocked).toBe(true)
    expect(by.A.unlocked).toBe(false)
  })

  it('首杀标记随解锁一起可见', () => {
    const j = s.problems.findIndex((p) => p.letter === 'J')
    expect(s.rows.some((r) => r.cells[j].firstBlood)).toBe(true)
  })
})
