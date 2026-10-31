import { describe, expect, it } from 'vitest'
import { CHENGDU, QINHUANGDAO, loadContest } from '../testing/fixtures'
import { aggregateTeam } from '../model/aggregate'

const countAc = (cells: Record<string, { ac: boolean }>) =>
  Object.values(cells).filter((c) => c.ac).length

describe('board.xcpio 导出（成都站）', () => {
  const contest = loadContest(CHENGDU, '所有队伍')

  it('自动识别格式与表头', () => {
    expect(contest.source).toBe('xcpcio')
    expect(contest.problems.map((p) => p.letter)).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    ])
  })

  it('队伍数、题目数、通过数与实测一致', () => {
    expect(contest.teams).toHaveLength(328)
    expect(contest.teams.reduce((n, t) => n + countAc(t.cells), 0)).toBe(1214)
    expect(contest.teams.filter((t) => t.markers.starred)).toHaveLength(9)
  })

  it('逐队重算的通过数与罚时都与文件一致（328/328）', () => {
    const bad: string[] = []
    for (const team of contest.teams) {
      const agg = aggregateTeam(team.cells)
      if (agg.solved !== team.source.solved || agg.penaltySec !== team.source.penaltySec) {
        bad.push(`${team.name}: 文件 ${team.source.solved}/${team.source.penaltySec}s，重算 ${agg.solved}/${agg.penaltySec}s`)
      }
    }
    expect(bad).toEqual([])
  })

  it('最晚通过发生在 299 分钟，建议时长 5 小时', () => {
    expect(contest.suggestedDurationSec).toBe(300 * 60)
    expect(contest.suggestedFreezeSec).toBe(240 * 60)
  })

  it('打星队会被标记为非正式', () => {
    const starred = contest.teams.filter((t) => t.markers.starred)
    expect(starred.every((t) => !t.markers.official)).toBe(true)
    expect(contest.teams.filter((t) => t.markers.official)).toHaveLength(319)
  })
})

describe('board.xcpio 正式队伍工作表', () => {
  const contest = loadContest(CHENGDU, '正式队伍')

  it('只有正式队，且带奖牌列', () => {
    expect(contest.teams).toHaveLength(319)
    expect(contest.teams.reduce((n, t) => n + countAc(t.cells), 0)).toBe(1152)
    expect(contest.teams.every((t) => t.markers.official)).toBe(true)
    expect(contest.teams.some((t) => t.markers.medal === 'Gold')).toBe(true)
  })
})

describe('xcpclink 导出（秦皇岛站）', () => {
  const contest = loadContest(QINHUANGDAO, 'Main')

  it('自动识别格式与表头', () => {
    expect(contest.source).toBe('xcpclink')
    expect(contest.problems).toHaveLength(13)
    expect(contest.problems[0].headerStats).toEqual({ ac: 72, total: 340 })
  })

  it('队伍数、通过数与实测一致', () => {
    expect(contest.teams).toHaveLength(375)
    expect(contest.teams.reduce((n, t) => n + countAc(t.cells), 0)).toBe(1943)
    expect(contest.teams.filter((t) => t.markers.starred)).toHaveLength(12)
  })

  it('逐队重算的罚时与文件秒级一致（375/375）', () => {
    const bad: string[] = []
    for (const team of contest.teams) {
      const agg = aggregateTeam(team.cells)
      if (agg.solved !== team.source.solved || agg.penaltySec !== team.source.penaltySec) {
        bad.push(`${team.name}: 文件 ${team.source.solved}/${team.source.penaltySec}s，重算 ${agg.solved}/${agg.penaltySec}s`)
      }
    }
    expect(bad).toEqual([])
  })

  it('首杀标记与秒级时刻被保留', () => {
    const fb = contest.teams.flatMap((t) => Object.values(t.cells).filter((c) => c.firstBlood))
    expect(fb.length).toBeGreaterThan(0)
    expect(fb.every((c) => c.ac && typeof c.acceptSec === 'number')).toBe(true)
  })

  it('第一名队伍的罚时为 20:07:05', () => {
    const top = contest.teams[0]
    expect(top.name).toBe('有人挑战一天打八小时比赛吗！！！')
    expect(top.source.penaltySec).toBe(20 * 3600 + 7 * 60 + 5)
  })

  it('表头通过数与实算完全一致', () => {
    for (const p of contest.problems) {
      const computed = contest.teams.filter((t) => t.cells[p.letter]?.ac).length
      expect(p.headerStats?.ac, `${p.letter} 题`).toBe(computed)
    }
  })

  it('诊断信息包含队伍规模与同名提示', () => {
    const msg = contest.diagnostics.map((d) => d.message).join('\n')
    expect(msg).toContain('375 支队伍')
    expect(msg).toContain('同名队伍')
  })
})
