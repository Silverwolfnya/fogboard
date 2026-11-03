import { describe, expect, it } from 'vitest'
import { CHENGDU, loadContest } from '../testing/fixtures'
import { DEFAULT_SETTINGS } from '../rules/settings'
import { computeUnlocks } from '../rules/unlock'
import { buildIndex } from './contest'
import { buildSnapshot } from './snapshot'
import {
  MANUAL_TEAM_ID,
  addSubmission,
  clearSubmissions,
  createManualTeam,
  loadManualTeam,
  manualCells,
  manualLetterStates,
  manualTeamRecord,
  undoLastSubmission,
} from './manual'
import type { ManualTeam, Settings } from '../types'

const LETTERS = ['A', 'B', 'C', 'D', 'E']
const min = (m: number) => m * 60

function team(): ManualTeam {
  return createManualTeam({ name: '我的队伍', organization: '某大学', members: ['张三', '李四'] })
}

describe('虚拟队伍：提交流水折算成题目结果', () => {
  it('过了就是 attempts = 错误数 + 1，时刻取首个 AC', () => {
    let t = team()
    t = addSubmission(t, { letter: 'A', ac: false, sec: 300 }, LETTERS)
    t = addSubmission(t, { letter: 'A', ac: false, sec: 420 }, LETTERS)
    t = addSubmission(t, { letter: 'A', ac: true, sec: 600 }, LETTERS)
    const cells = manualCells(t, LETTERS)
    expect(cells.A).toMatchObject({ ac: true, attempts: 3, acceptSec: 600 })
  })

  it('通过之后的提交不算（ICPC 规则）', () => {
    let t = team()
    t = addSubmission(t, { letter: 'B', ac: true, sec: 120 }, LETTERS)
    t = addSubmission(t, { letter: 'B', ac: false, sec: 200 }, LETTERS)
    const states = manualLetterStates(t, LETTERS)
    expect(states.B.ac).toBe(true)
    expect(states.B.wrongs).toBe(0)
  })

  it('只有错误提交时 ac = false，attempts = 错误数', () => {
    let t = team()
    t = addSubmission(t, { letter: 'C', ac: false, sec: 90 }, LETTERS)
    t = addSubmission(t, { letter: 'C', ac: false, sec: 150 }, LETTERS)
    expect(manualCells(t, LETTERS).C).toMatchObject({ ac: false, attempts: 2 })
    expect(manualCells(t, LETTERS).C.acceptSec).toBeUndefined()
  })

  it('没交过的题不出现在 cells 里', () => {
    const cells = manualCells(team(), LETTERS)
    expect(Object.keys(cells)).toHaveLength(0)
  })

  it('已经通过的题不再接受记录', () => {
    let t = team()
    t = addSubmission(t, { letter: 'A', ac: true, sec: 60 }, LETTERS)
    const next = addSubmission(t, { letter: 'A', ac: false, sec: 90 }, LETTERS)
    expect(next).toBe(t)
  })

  it('撤销与清空', () => {
    let t = team()
    t = addSubmission(t, { letter: 'A', ac: false, sec: 10 }, LETTERS)
    t = addSubmission(t, { letter: 'A', ac: true, sec: 20 }, LETTERS)
    expect(manualCells(undoLastSubmission(t), LETTERS).A.ac).toBe(false)
    expect(Object.keys(manualCells(clearSubmissions(t), LETTERS))).toHaveLength(0)
  })

  it('记录顺序打乱时按时刻重排（回退时间轴也不怕）', () => {
    // 直接从存储里恢复出来的流水可能不是按时刻排的
    const outOfOrder: ManualTeam = {
      ...team(),
      submissions: [
        { letter: 'D', ac: true, sec: 600 },
        { letter: 'D', ac: false, sec: 300 },
      ],
    }
    expect(manualCells(outOfOrder, LETTERS).D).toMatchObject({ attempts: 2, acceptSec: 600 })
  })
})

describe('虚拟队伍：进榜但不改规则', () => {
  const contest = loadContest(CHENGDU, '所有队伍')
  const letters = contest.problems.map((p) => p.letter)

  let manual = createManualTeam({ name: '孤军奋战', organization: '某大学', members: [] })
  manual = addSubmission(manual, { letter: 'F', ac: false, sec: min(10) }, letters)
  manual = addSubmission(manual, { letter: 'F', ac: true, sec: min(19) }, letters)

  const record = manualTeamRecord(manual, letters)
  const baseIndex = buildIndex(contest)
  const index = buildIndex({ ...contest, teams: [...contest.teams, record] })
  const AC_SEC = min(19)
  const PENALTY = AC_SEC + 20 * 60

  it('虚拟队伍单独归类，不混进参赛名单', () => {
    expect(index.virtualTeams).toHaveLength(1)
    expect(index.fieldTeams).toHaveLength(baseIndex.fieldTeams.length)
    expect(index.fieldTeams.some((t) => t.virtual)).toBe(false)
  })

  it('不影响每题的 AC 序列、首杀与总数', () => {
    expect(index.acSecs.F).toEqual(baseIndex.acSecs.F)
    expect(index.totalAc).toBe(baseIndex.totalAc)
    expect(index.firstBlood.F).toEqual(baseIndex.firstBlood.F)
    expect(index.maxAcceptSec).toBe(baseIndex.maxAcceptSec)
  })

  it('阈值与解锁时刻与没有虚拟队伍时完全一致', () => {
    const a = computeUnlocks(baseIndex, DEFAULT_SETTINGS)
    const b = computeUnlocks(index, DEFAULT_SETTINGS)
    expect(b.threshold).toEqual(a.threshold)
    expect(b.problems.map((p) => p.unlockSec)).toEqual(a.problems.map((p) => p.unlockSec))
  })

  it('自己解题不会点亮题卡', () => {
    const plan = computeUnlocks(index, DEFAULT_SETTINGS)
    const s = buildSnapshot({ index, plan, settings: DEFAULT_SETTINGS, t: AC_SEC + 30, manualReveal: false })
    // F 要等封榜才解锁，我提前过了它也不会亮
    const f = s.problems.find((p) => p.letter === 'F')!
    expect(f.unlocked).toBe(false)
    expect(f.reason).toBe('freeze')
    const row = s.rows.find((r) => r.teamId === MANUAL_TEAM_ID)!
    expect(row.solved).toBe(1)
    expect(row.penaltySec).toBe(PENALTY)
  })

  it('参与排名，但不进全场统计', () => {
    const plan = computeUnlocks(index, DEFAULT_SETTINGS)
    const settings: Settings = { ...DEFAULT_SETTINGS, selfTeamId: MANUAL_TEAM_ID }
    const s = buildSnapshot({ index, plan, settings, t: AC_SEC + 30, manualReveal: false })
    const row = s.rows.find((r) => r.teamId === MANUAL_TEAM_ID)!
    expect(row.isSelf).toBe(true)
    expect(row.rank).toBeGreaterThan(0)
    expect(s.rows.filter((r) => r.solved > row.solved).every((r) => r.rank < row.rank)).toBe(true)

    const basePlan = computeUnlocks(baseIndex, DEFAULT_SETTINGS)
    const base = buildSnapshot({
      index: baseIndex,
      plan: basePlan,
      settings: DEFAULT_SETTINGS,
      t: AC_SEC + 30,
      manualReveal: false,
    })
    expect(s.stats.totalAc).toBe(base.stats.totalAc)
    expect(s.teamCount).toBe(base.teamCount)
  })

  it('自己的格子永远可见（哪怕题目没解锁）', () => {
    const plan = computeUnlocks(index, DEFAULT_SETTINGS)
    const settings: Settings = { ...DEFAULT_SETTINGS, selfTeamId: MANUAL_TEAM_ID }
    const s = buildSnapshot({ index, plan, settings, t: AC_SEC + 30, manualReveal: false })
    const row = s.rows.find((r) => r.teamId === MANUAL_TEAM_ID)!
    const i = s.problems.findIndex((p) => p.letter === 'F')
    expect(s.problems[i].unlocked).toBe(false)
    expect(row.cells[i].kind).toBe('ac')
    expect(row.cells[i].acceptSec).toBe(AC_SEC)
  })

  it('AC 之前那一行是 0 题', () => {
    const plan = computeUnlocks(index, DEFAULT_SETTINGS)
    const s = buildSnapshot({ index, plan, settings: DEFAULT_SETTINGS, t: AC_SEC - 60, manualReveal: false })
    const row = s.rows.find((r) => r.teamId === MANUAL_TEAM_ID)!
    expect(row.solved).toBe(0)
    expect(row.solves).toHaveLength(0)
  })

  it('仅正式队口径下自己依然在榜上', () => {
    const plan = computeUnlocks(index, { ...DEFAULT_SETTINGS, scope: 'official' })
    const s = buildSnapshot({
      index,
      plan,
      settings: { ...DEFAULT_SETTINGS, scope: 'official' },
      t: AC_SEC + 30,
      manualReveal: false,
    })
    expect(s.rows.some((r) => r.teamId === MANUAL_TEAM_ID)).toBe(true)
    expect(s.teamCount).toBe(baseIndex.officialTeams.length)
  })
})

describe('虚拟队伍：持久化', () => {
  it('没有 localStorage 的环境下安静返回 null', () => {
    expect(loadManualTeam('whatever')).toBeNull()
  })
})
