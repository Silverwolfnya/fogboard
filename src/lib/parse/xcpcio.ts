import type { CellResult, Diagnostic, ProblemInfo, SheetAnalysis, SheetData, TeamRecord } from '../types'
import { str, toInt, warning, type Row } from './shared'

export interface ParseInput {
  fileName: string
  sheet: SheetData
  analysis: SheetAnalysis
}

export interface ParsedSheet {
  title?: string
  problems: ProblemInfo[]
  teams: TeamRecord[]
  notes: Diagnostic[]
}

const AC_CELL = /^\+(\d+)\s*[(（]\s*(\d+)\s*[)）]$/
const RJ_CELL = /^-(\d+)$/

/**
 * board.xcpio 导出：
 *   +k(mm)  通过，k = 该题提交总次数（含通过的一次），mm = 通过时刻（分钟）
 *   -n      未通过，n = 错误提交次数
 *   -       无提交
 */
export function parseXcpcio(input: ParseInput): ParsedSheet {
  const { sheet, analysis } = input
  const rows = sheet.rows
  const cols = analysis.columns
  const teams: TeamRecord[] = []
  const notes: Diagnostic[] = []
  let unknownCells = 0

  const idx = {
    rank: cols.Rank,
    orgRank: cols['Organization Rank'],
    organization: cols.Organization,
    team: cols.Team,
    solved: cols.Solved,
    penalty: cols.Penalty,
    medal: cols.Medal,
    member1: cols.Member1,
    member2: cols.Member2,
    member3: cols.Member3,
    coaches: cols.Coaches,
    unofficial: cols.Unofficial,
    girl: cols.Girl,
    icpcId: cols['ICPC ID'],
  }

  for (let r = analysis.headerRow + 1; r < rows.length; r += 1) {
    const row: Row = rows[r] ?? []
    const name = str(row[idx.team])
    if (!name || name === 'Team') continue

    const cells: Record<string, CellResult> = {}
    for (const column of analysis.problemColumns) {
      const raw = str(row[column.index])
      if (!raw || raw === '-' || raw === '—' || raw === '·') continue
      const ac = AC_CELL.exec(raw)
      if (ac) {
        const attempts = Number(ac[1])
        cells[column.letter] = {
          letter: column.letter,
          ac: true,
          attempts: Math.max(1, attempts),
          acceptSec: Number(ac[2]) * 60,
        }
        continue
      }
      const rj = RJ_CELL.exec(raw)
      if (rj) {
        const attempts = Number(rj[1])
        if (attempts > 0) {
          cells[column.letter] = { letter: column.letter, ac: false, attempts }
        }
        continue
      }
      unknownCells += 1
    }

    const unofficial = str(row[idx.unofficial]).toUpperCase()
    const starred = unofficial === 'Y' || unofficial === 'YES' || unofficial === 'TRUE' || unofficial === '*'
    const girl = str(row[idx.girl]).toUpperCase() === 'Y'
    const medal = str(row[idx.medal])

    const members = [idx.member1, idx.member2, idx.member3]
      .map((i) => (i === undefined ? '' : str(row[i])))
      .filter(Boolean)

    teams.push({
      id: `t${r}`,
      name,
      organization: str(row[idx.organization]),
      members,
      coaches: str(row[idx.coaches]) || undefined,
      icpcId: str(row[idx.icpcId]) || undefined,
      markers: { official: !starred, starred, girl, medal: medal || undefined },
      source: {
        rank: toInt(row[idx.rank]),
        organizationRank: toInt(row[idx.orgRank]),
        solved: toInt(row[idx.solved]),
        penaltySec: (toInt(row[idx.penalty]) ?? 0) * 60,
        rowIndex: r,
      },
      cells,
    })
  }

  if (unknownCells > 0) {
    notes.push(warning(`有 ${unknownCells} 个单元格格式无法识别，已忽略（期望形如 +2(183) 或 -3）`))
  }

  const titleCell = rows[0]?.[0]
  const title = analysis.headerRow > 0 && typeof titleCell === 'string' ? titleCell.trim() : ''

  return {
    title: title || undefined,
    problems: analysis.problemColumns.map((c) => ({ letter: c.letter })),
    teams,
    notes,
  }
}
