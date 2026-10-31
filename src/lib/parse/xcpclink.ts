import { parseClock } from '../format'
import type { CellResult, Diagnostic, ProblemInfo, TeamRecord } from '../types'
import { splitMembers, str, toInt, warning, type Row } from './shared'
import type { ParseInput, ParsedSheet } from './xcpcio'

const AC_CELL = /^(AC|FB)\s*\/\s*(\d+)\s*\/\s*(\d+:\d{1,2}(?::\d{1,2})?)$/i
const RJ_CELL = /^RJ\s*\/\s*(\d+)$/i
const AC_CJK = /^通过\s*\/\s*(\d+)\s*\/\s*(\d+:\d{1,2}(?::\d{1,2})?)$/

/**
 * xcpclink 导出：
 *   AC/k/H:MM:SS  通过，k = 该题提交总次数（含通过的一次）
 *   FB/k/H:MM:SS  首杀
 *   RJ/n          未通过，n = 错误提交次数
 *   空            无提交
 */
export function parseXcpclink(input: ParseInput): ParsedSheet {
  const { sheet, analysis } = input
  const rows = sheet.rows
  const cols = analysis.columns
  const teams: TeamRecord[] = []
  const notes: Diagnostic[] = []
  let unknownCells = 0

  const idx = {
    rank: cols['R#'],
    award: cols['邀请赛#'],
    organization: cols.Organization,
    name: cols.Name,
    members: cols['Team Members'],
    score: cols.Score,
    time: cols.Time,
    official: cols.Official,
    markers: cols.Markers,
  }

  for (let r = analysis.headerRow + 1; r < rows.length; r += 1) {
    const row: Row = rows[r] ?? []
    const name = str(row[idx.name])
    if (!name || name === 'Name') continue

    const cells: Record<string, CellResult> = {}
    for (const column of analysis.problemColumns) {
      const raw = str(row[column.index])
      if (!raw || raw === '-' || raw === '—') continue

      const ac = AC_CELL.exec(raw) ?? AC_CJK.exec(raw)
      if (ac) {
        const sec = parseClock(ac[3])
        if (sec === null) {
          unknownCells += 1
          continue
        }
        const prefix = raw.slice(0, 2).toUpperCase()
        const result: CellResult = {
          letter: column.letter,
          ac: true,
          attempts: Math.max(1, Number(ac[2])),
          acceptSec: sec,
        }
        if (prefix === 'FB') result.firstBlood = true
        cells[column.letter] = result
        continue
      }

      const rj = RJ_CELL.exec(raw)
      if (rj) {
        const attempts = Number(rj[1])
        if (attempts > 0) cells[column.letter] = { letter: column.letter, ac: false, attempts }
        continue
      }

      unknownCells += 1
    }

    const markersText = `${str(row[idx.markers])} ${str(row[idx.award])}`
    const starred = str(row[idx.official]) === '*'
    const girl = markersText.includes('女队')
    const award = str(row[idx.award])
    const medalMatch = /[(（]([^)）]+)[)）]/.exec(award)

    teams.push({
      id: `t${r}`,
      name,
      organization: str(row[idx.organization]),
      members: splitMembers(row[idx.members]),
      markers: {
        official: !starred,
        starred,
        girl,
        medal: medalMatch ? medalMatch[1].trim() : undefined,
      },
      source: {
        rank: toInt(row[idx.rank]),
        solved: toInt(row[idx.score]),
        penaltySec: parseClock(str(row[idx.time])) ?? undefined,
        rowIndex: r,
      },
      cells,
    })
  }

  if (unknownCells > 0) {
    notes.push(warning(`有 ${unknownCells} 个单元格格式无法识别，已忽略（期望形如 AC/1/1:03:49 或 RJ/3）`))
  }

  const problems: ProblemInfo[] = analysis.problemColumns.map((c) => ({
    letter: c.letter,
    headerStats: c.headerStats,
  }))

  const headerStatsMissing = problems.filter((p) => !p.headerStats).length
  if (headerStatsMissing === problems.length) {
    notes.push({ level: 'info', message: '表头未带 (通过数/总提交) 统计，已忽略该列信息' })
  }

  const titleCell = analysis.headerRow > 0 ? rows[0]?.[0] : undefined
  const title = typeof titleCell === 'string' ? titleCell.trim() : ''

  return { title: title || undefined, problems, teams, notes }
}
