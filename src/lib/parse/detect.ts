import type { ProblemColumn, SheetAnalysis, SheetData, SourceFormat, WorkbookFile } from '../types'

type Row = (string | number | boolean | null)[]

const norm = (v: unknown): string => (v == null ? '' : String(v).trim())

const XCPCIO_COLUMNS = [
  'Rank',
  'Organization Rank',
  'Organization',
  'Team',
  'Solved',
  'Penalty',
  'Dirt',
  'Medal',
  'Member1',
  'Member2',
  'Member3',
  'Coaches',
  'Unofficial',
  'Girl',
  'ICPC ID',
]

const XCPCLINK_COLUMNS = [
  'R#',
  '邀请赛#',
  '省赛#',
  'S#',
  'Markers',
  'Official',
  'Organization',
  'Name',
  'Team Members',
  'Score',
  'Time',
]

const STAT_PROBLEM = /^([A-Z])\s*[(（]\s*(\d+)\s*\/\s*(\d+)\s*[)）]$/
const PLAIN_PROBLEM = /^([A-Z])$/

function lookup(header: Row, names: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (let i = 0; i < header.length; i += 1) {
    const cell = norm(header[i])
    if (!cell) continue
    const hit = names.find((n) => n.toLowerCase() === cell.toLowerCase())
    if (hit && out[hit] === undefined) out[hit] = i
  }
  return out
}

function problemColumnsFrom(header: Row, withStats: boolean): ProblemColumn[] {
  const cols: ProblemColumn[] = []
  for (let i = 0; i < header.length; i += 1) {
    const cell = norm(header[i])
    if (!cell) continue
    if (withStats) {
      const m = STAT_PROBLEM.exec(cell)
      if (m) {
        cols.push({ letter: m[1], index: i, headerStats: { ac: Number(m[2]), total: Number(m[3]) } })
        continue
      }
    }
    const p = PLAIN_PROBLEM.exec(cell)
    if (p && !cols.some((c) => c.letter === p[1])) cols.push({ letter: p[1], index: i })
  }
  return cols
}

function countTeams(rows: Row[], headerRow: number, teamNameIndex: number | undefined): number {
  if (teamNameIndex === undefined) return 0
  let n = 0
  for (let r = headerRow + 1; r < rows.length; r += 1) {
    if (norm(rows[r]?.[teamNameIndex])) n += 1
  }
  return n
}

function tryXcpcio(rows: Row[]): SheetAnalysis | null {
  const limit = Math.min(rows.length, 8)
  for (let r = 0; r < limit; r += 1) {
    const header = rows[r] ?? []
    const cols = lookup(header, XCPCIO_COLUMNS)
    if (cols.Team === undefined || cols.Solved === undefined || cols.Penalty === undefined) continue
    const problems = problemColumnsFrom(header, false)
    if (problems.length < 3) continue
    const teamCount = countTeams(rows, r, cols.Team)
    return {
      name: '',
      format: 'xcpcio',
      headerRow: r,
      problemColumns: problems,
      columns: cols,
      teamCount,
      score: 100 + problems.length * 2,
      reason: `board.xcpcio 表头（第 ${r + 1} 行，${problems.length} 道题）`,
    }
  }
  return null
}

function tryXcpclink(rows: Row[]): SheetAnalysis | null {
  const limit = Math.min(rows.length, 8)
  for (let r = 0; r < limit; r += 1) {
    const header = rows[r] ?? []
    const cols = lookup(header, XCPCLINK_COLUMNS)
    if (cols.Score === undefined || cols.Time === undefined || cols.Name === undefined) continue
    let problems = problemColumnsFrom(header, true)
    // 有些导出不带表头统计，退化为单字母列
    if (problems.length < 3) problems = problemColumnsFrom(header, false)
    if (problems.length < 3) continue
    const teamCount = countTeams(rows, r, cols.Name)
    return {
      name: '',
      format: 'xcpclink',
      headerRow: r,
      problemColumns: problems,
      columns: cols,
      teamCount,
      score: 110 + problems.length * 2,
      reason: `xcpclink 表头（第 ${r + 1} 行，${problems.length} 道题）`,
    }
  }
  return null
}

export function analyzeSheet(sheet: SheetData): SheetAnalysis {
  const rows = sheet.rows
  const a = tryXcpclink(rows)
  const b = tryXcpcio(rows)
  const best = [a, b].filter((x): x is SheetAnalysis => x !== null).sort((x, y) => y.score - x.score)[0]
  if (best) {
    best.name = sheet.name
    if (best.teamCount === 0) {
      best.score = 0
      best.reason = `${best.reason}，但没有数据行`
    }
    return best
  }
  return {
    name: sheet.name,
    format: null,
    headerRow: -1,
    problemColumns: [],
    columns: {},
    teamCount: 0,
    score: 0,
    reason: '未找到 board.xcpio 或 xcpclink 的表头',
  }
}

export interface WorkbookReport {
  fileName: string
  sheets: SheetAnalysis[]
  /** 默认打开的工作表 */
  bestSheet: string | null
  format: SourceFormat | null
}

const PREFERRED = ['所有队伍', 'Main', '正式队伍', 'Official', '正式榜单']

export function analyzeWorkbook(file: WorkbookFile): WorkbookReport {
  const sheets = file.sheets.map(analyzeSheet)
  const usable = sheets.filter((s) => s.score > 0)
  usable.sort((x, y) => {
    const px = PREFERRED.indexOf(x.name)
    const py = PREFERRED.indexOf(y.name)
    if (px !== -1 || py !== -1) {
      if (px === -1) return 1
      if (py === -1) return -1
      return px - py
    }
    return y.score - x.score
  })
  const best = usable[0] ?? null
  return {
    fileName: file.fileName,
    sheets,
    bestSheet: best?.name ?? null,
    format: best?.format ?? null,
  }
}
