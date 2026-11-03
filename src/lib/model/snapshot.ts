import type { CellView, Phase, ProblemView, RowView, Settings, Snapshot, SolveView } from '../types'
import type { ContestIndex } from './contest'
import type { UnlockPlan } from '../rules/unlock'
import { assignRanks, sortRanked, type RankEntry } from './rank'
import { clamp } from '../format'

export interface SnapshotOptions {
  index: ContestIndex
  plan: UnlockPlan
  settings: Settings
  /** 当前播放时刻（秒） */
  t: number
  /** 用户手动"解封" */
  manualReveal: boolean
}

function upperBound(sorted: number[], value: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid] <= value) lo = mid + 1
    else hi = mid
  }
  return lo
}

const EMPTY_CELL: CellView = { kind: 'empty', attempts: 0 }

export function buildSnapshot(opts: SnapshotOptions): Snapshot {
  const { index, plan, settings } = opts
  const durationSec = plan.durationSec
  const t = clamp(opts.t, 0, durationSec)
  const freezeSec = plan.freezeSec
  const freezeActive = Number.isFinite(freezeSec)

  const revealed = settings.showFullInfo || opts.manualReveal || t >= durationSec
  const frozenNow = freezeActive && t >= freezeSec && t < durationSec
  const phase: Phase = t >= durationSec ? 'final' : t <= 0 ? 'before' : frozenNow ? 'frozen' : 'live'

  const dataT = revealed ? t : freezeActive && t > freezeSec ? freezeSec : t
  const tSelf = settings.selfSeesLive ? t : dataT

  const problems: ProblemView[] = plan.problems.map((p) => {
    const unlocked = settings.showFullInfo || p.unlockSec <= dataT
    const accepted = upperBound(p.acceptedSecs, dataT)
    const justUnlocked =
      unlocked && Number.isFinite(p.unlockSec) && dataT >= p.unlockSec && dataT - p.unlockSec <= 180
    return {
      letter: p.letter,
      unlocked,
      unlockSec: p.unlockSec,
      reason: p.reason,
      accepted,
      threshold: plan.threshold.threshold,
      justUnlocked,
    }
  })

  // 虚拟队伍永远出现在榜上（哪怕口径是"仅正式队"，否则一勾自己就消失了）
  const roster = settings.scope === 'official' ? index.officialTeams : index.fieldTeams
  const teams = index.virtualTeams.length ? [...roster, ...index.virtualTeams] : roster
  const entries: (RankEntry & { row: RowView })[] = []

  for (const team of teams) {
    const isSelf = settings.selfTeamId === team.id
    const tTeam = isSelf ? tSelf : dataT

    // 主榜的"通过顺序"：与题目是否解锁无关，只看通过时刻
    const raw: { letter: string; attempts: number; acceptSec: number; firstBlood?: boolean }[] = []
    for (const cell of Object.values(team.cells)) {
      if (cell.ac && cell.acceptSec != null && cell.acceptSec <= tTeam) {
        raw.push({
          letter: cell.letter,
          attempts: cell.attempts,
          acceptSec: cell.acceptSec,
          firstBlood: cell.firstBlood,
        })
      }
    }
    raw.sort((a, b) => a.acceptSec - b.acceptSec || a.letter.localeCompare(b.letter))

    let solved = 0
    let penaltySec = 0
    let lastAcSec = -1
    const solves: SolveView[] = raw.map((s) => {
      solved += 1
      penaltySec += s.acceptSec + plan.penaltyPerWrongSec * Math.max(0, s.attempts - 1)
      if (s.acceptSec > lastAcSec) lastAcSec = s.acceptSec
      return {
        attempts: s.attempts,
        acceptSec: s.acceptSec,
        firstBlood: s.firstBlood,
        recent: tTeam - s.acceptSec <= 60,
      }
    })

    // 队伍抽屉用的逐题明细：受解锁状态约束
    const cells: CellView[] = plan.problems.map((p, i) => {
      const cell = team.cells[p.letter]
      const columnUnlocked = problems[i].unlocked
      const visible = columnUnlocked || isSelf
      if (!visible) return { kind: 'locked', attempts: 0, lockedColumn: true }

      if (cell?.ac && cell.acceptSec != null && cell.acceptSec <= tTeam) {
        return {
          kind: 'ac',
          attempts: cell.attempts,
          acceptSec: cell.acceptSec,
          firstBlood: cell.firstBlood,
          recent: tTeam - cell.acceptSec <= 60,
          lockedColumn: !columnUnlocked,
        }
      }

      if (revealed && cell && !cell.ac && cell.attempts > 0) {
        return { kind: 'rejected', attempts: cell.attempts, lockedColumn: !columnUnlocked }
      }

      return columnUnlocked ? EMPTY_CELL : { kind: 'empty', attempts: 0, lockedColumn: true }
    })

    const row: RowView = {
      teamId: team.id,
      team,
      rank: 0,
      solved,
      penaltySec,
      lastAcSec,
      isSelf,
      solves,
      cells,
    }
    entries.push({ id: team.id, solved, penaltySec, lastAcSec, row })
  }

  const sorted = sortRanked(entries)
  const ranks = assignRanks(sorted)
  const rows: RowView[] = sorted.map((entry, i) => {
    entry.row.rank = phase === 'before' ? 0 : ranks[i]
    return entry.row
  })

  let totalAc = 0
  let solvedTeams = 0
  let acceptedRecent = 0
  for (const row of rows) {
    // 全场统计只算官方队伍，虚拟队伍不参与
    if (row.team.virtual) continue
    totalAc += row.solved
    if (row.solved > 0) solvedTeams += 1
    for (const cell of row.cells) if (cell.recent) acceptedRecent += 1
  }

  return {
    t,
    dataT,
    durationSec,
    freezeSec: freezeActive ? freezeSec : null,
    phase,
    revealed,
    threshold: plan.threshold.threshold,
    thresholdSource: plan.threshold.source,
    teamCount: roster.length,
    problems,
    rows,
    stats: {
      totalAc,
      solvedTeams,
      unlockedProblems: problems.filter((p) => p.unlocked).length,
      acceptedRecent,
    },
  }
}
