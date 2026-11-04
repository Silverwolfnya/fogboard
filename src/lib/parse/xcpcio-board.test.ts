import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isXcpcioBoard, parseXcpcioBoard, type XcpcioBoardRaw } from './xcpcio-board'

const raw = JSON.parse(
  readFileSync(resolve(process.cwd(), 'fixtures/xcpcio-chongqing.json'), 'utf8'),
) as XcpcioBoardRaw

describe('board.xcpcio 数据', () => {
  it('认得出来', () => {
    expect(isXcpcioBoard(raw)).toBe(true)
    expect(isXcpcioBoard({})).toBe(false)
  })

  const parsed = parseXcpcioBoard(raw)
  const letters = parsed.problems.map((p) => p.letter)

  it('324 队 / 13 题', () => {
    expect(parsed.teams).toHaveLength(324)
    expect(letters).toHaveLength(13)
    expect(letters[0]).toBe('A')
  })

  it('每题都能算出通过数，重复的 CORRECT 只算一次通过', () => {
    const acCells = parsed.teams.reduce(
      (n, t) => n + letters.filter((l) => t.cells[l]?.ac).length,
      0,
    )
    const correctRuns = raw.runs.filter((r) => r.status === 'CORRECT').length
    console.log(`AC 格 ${acCells} 条 / CORRECT 提交 ${correctRuns} 条`)
    expect(acCells).toBe(1351)
    expect(correctRuns).toBe(1419)
    expect(acCells).toBeLessThanOrEqual(correctRuns)
  })

  it('每道题的提交流按时间升序，AC 的那次就是最后一次', () => {
    for (const team of parsed.teams.slice(0, 50)) {
      for (const cell of Object.values(team.cells)) {
        expect(cell.submits).toBeTruthy()
        const subs = cell.submits!
        for (let i = 1; i < subs.length; i += 1) {
          expect(subs[i].sec).toBeGreaterThanOrEqual(subs[i - 1].sec)
        }
        if (cell.ac) {
          expect(subs[subs.length - 1].ac).toBe(true)
          expect(cell.acceptSec).toBe(subs[subs.length - 1].sec)
          expect(cell.attempts).toBe(subs.length)
        } else {
          expect(subs.every((s) => !s.ac)).toBe(true)
          expect(cell.attempts).toBe(subs.length)
        }
      }
    }
  })

  it('时刻落在比赛时长里（毫秒换算正确）', () => {
    const max = Math.max(
      ...parsed.teams.flatMap((t) =>
        Object.values(t.cells).map((c) => c.acceptSec ?? c.submits?.[c.submits.length - 1]?.sec ?? 0),
      ),
    )
    console.log(`最晚时刻 ${max}s = ${(max / 3600).toFixed(2)}h`)
    expect(max).toBeLessThanOrEqual(5 * 3600 + 60)
  })

  it('每道题的"第一次提交"就是这队最早的那次，AC 时刻不早于它', () => {
    const team = parsed.teams.find((t) => t.name === '小青鱼粉丝团')!
    expect(team).toBeTruthy()
    const cells = Object.values(team.cells)
    const firsts = cells.map((c) => c.submits![0].sec)
    const all = cells.flatMap((c) => c.submits!.map((s) => s.sec))
    expect(Math.min(...firsts)).toBe(Math.min(...all))
    for (const c of cells) {
      if (!c.ac) continue
      expect(c.acceptSec).toBeGreaterThanOrEqual(c.submits![0].sec)
    }
  })

  it('打星队被标成非正式', () => {
    const official = parsed.teams.filter((t) => t.markers.official).length
    console.log(`正式队 ${official} / 全部 ${parsed.teams.length}`)
    expect(official).toBe(260)
  })
})
