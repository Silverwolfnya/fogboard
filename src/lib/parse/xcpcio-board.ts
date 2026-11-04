import type { CellResult, Diagnostic, ProblemInfo, TeamRecord } from '../types'
import type { ParsedSheet } from './xcpcio'
import { info, warning } from './shared'

/**
 * board.xcpcio.com 的原始数据（三个 JSON 合并而成，见 scripts/fetch-xcpcio.mjs）。
 *
 * 和 xlsx 导出最大的区别：这里带 **逐条提交**（run.json），
 * 所以能做到"一队一题一格、按首次提交时刻排序"，未通过的 −n 也能随时间长出来。
 */
export interface XcpcioBoardRaw {
  source?: string
  url?: string
  contest_name?: string
  start_time?: number | null
  end_time?: number | null
  penalty?: number
  frozen_time?: number
  /** config.options.submission_timestamp_unit：millisecond / second */
  timestamp_unit?: string
  problems: { id: string | number; label: string }[]
  teams: {
    id: string | number
    name: string
    organization?: string
    group?: string[]
    members?: string[]
    coaches?: string[]
  }[]
  runs: {
    team_id: string | number
    problem_id: string | number
    timestamp: number
    status: string
  }[]
}

const AC_STATUS = new Set(['CORRECT', 'AC', 'ACCEPTED', 'OK'])
/** 不占提交次数的状态（等待评测之类） */
const IGNORED_STATUS = new Set(['PENDING', 'RUNNING', 'JUDGING', 'WAITING', 'FROZEN'])

export function isXcpcioBoard(raw: unknown): raw is XcpcioBoardRaw {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Partial<XcpcioBoardRaw>
  return Array.isArray(r.teams) && Array.isArray(r.runs) && Array.isArray(r.problems)
}

export function parseXcpcioBoard(raw: XcpcioBoardRaw): ParsedSheet {
  const notes: Diagnostic[] = []
  if (!isXcpcioBoard(raw)) throw new Error('这不是 board.xcpcio 的数据：缺 teams / runs / problems')

  const problems: ProblemInfo[] = raw.problems.map((p) => ({ letter: String(p.label) }))
  const labelById = new Map(raw.problems.map((p) => [String(p.id), String(p.label)]))
  const teamIds = new Set(raw.teams.map((t) => String(t.id)))

  // team_id + problem_id → 这条队的这道题的所有提交
  const buckets = new Map<string, { sec: number; ac: boolean }[]>()
  let droppedUnknownTeam = 0
  let droppedUnknownProblem = 0

  // 时间戳单位：优先看 config，其次按"最长一条比比赛时长还大一个量级"来判断
  const rawTs = raw.runs.map((r) => Number(r.timestamp)).filter((n) => Number.isFinite(n))
  const maxTs = rawTs.length ? Math.max(...rawTs) : 0
  const durationSec =
    raw.start_time && raw.end_time ? Math.abs(raw.end_time - raw.start_time) / 1000 : null
  const unit = String(raw.timestamp_unit ?? '').toLowerCase()
  const inMilliseconds =
    unit.startsWith('milli') || unit === 'ms'
      ? true
      : unit.startsWith('sec') || unit === 's'
        ? false
        : durationSec && durationSec > 0
          ? maxTs > durationSec * 2
          : maxTs > 100_000

  for (const run of raw.runs) {
    const teamId = String(run.team_id)
    const label = labelById.get(String(run.problem_id))
    if (!teamIds.has(teamId)) {
      droppedUnknownTeam += 1
      continue
    }
    if (!label) {
      droppedUnknownProblem += 1
      continue
    }
    const status = String(run.status ?? '').toUpperCase()
    if (IGNORED_STATUS.has(status)) continue
    const ts = Number(run.timestamp)
    if (!Number.isFinite(ts)) continue
    const sec = Math.floor(inMilliseconds ? ts / 1000 : ts)
    const key = `${teamId}\u0000${label}`
    const list = buckets.get(key) ?? []
    list.push({ sec, ac: AC_STATUS.has(status) })
    buckets.set(key, list)
  }

  const teams: TeamRecord[] = raw.teams.map((t) => {
    const id = String(t.id)
    const cells: Record<string, CellResult> = {}

    for (const p of raw.problems) {
      const label = String(p.label)
      const runs = buckets.get(`${id}\u0000${label}`)
      if (!runs || runs.length === 0) continue
      runs.sort((a, b) => a.sec - b.sec)

      const acIdx = runs.findIndex((r) => r.ac)
      if (acIdx >= 0) {
        // ICPC：通过之后同一题再交不算（正常数据里也不会出现）
        const upto = runs.slice(0, acIdx + 1)
        cells[label] = {
          letter: label,
          ac: true,
          attempts: upto.length,
          acceptSec: upto[upto.length - 1].sec,
          submits: upto,
        }
      } else {
        cells[label] = {
          letter: label,
          ac: false,
          attempts: runs.length,
          submits: runs,
        }
      }
    }

    const group = Array.isArray(t.group) ? t.group : []
    const official = group.includes('official') || (!group.includes('unofficial') && group.length === 0)
    return {
      id,
      name: t.name || `Team ${id}`,
      organization: t.organization ?? '',
      members: t.members ?? [],
      coaches: (t.coaches ?? []).join(', '),
      markers: {
        official,
        starred: group.includes('unofficial'),
        girl: false,
      },
      source: { rowIndex: -1 },
      cells,
    }
  })

  const letters = problems.map((p) => p.letter)
  const totalAc = teams.reduce(
    (n, t) => n + letters.filter((l) => t.cells[l]?.ac).length,
    0,
  )
  const totalRuns = [...buckets.values()].reduce((n, list) => n + list.length, 0)

  notes.push(
    info(`xcpcio 数据：${teams.length} 队、${problems.length} 题、${totalRuns} 条提交（${totalAc} 次通过）`),
  )
  notes.push(info(inMilliseconds ? '提交时间戳按毫秒解析' : '提交时间戳按秒解析'))
  if (droppedUnknownTeam > 0) notes.push(warning(`${droppedUnknownTeam} 条提交的队伍不在 team.json 里，已忽略`))
  if (droppedUnknownProblem > 0)
    notes.push(warning(`${droppedUnknownProblem} 条提交的题目不在 config.json 里，已忽略`))
  if (raw.frozen_time && raw.end_time && raw.start_time) {
    const dur = (raw.end_time - raw.start_time) / 1000
    notes.push(info(`比赛时长 ${Math.round(dur / 60)} 分钟，封榜前 ${Math.round(raw.frozen_time / 60)} 分钟`))
  }

  return {
    title: (raw.contest_name ?? '').trim() || 'xcpcio 榜单',
    problems,
    teams,
    notes,
  }
}
