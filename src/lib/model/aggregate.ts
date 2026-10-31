import type { CellResult } from '../types'

/** 按 ICPC 规则重算一队的通过数与罚时（秒） */
export function aggregateTeam(
  cells: Record<string, CellResult>,
  penaltyPerWrongSec = 20 * 60,
): { solved: number; penaltySec: number; lastAcSec: number } {
  let solved = 0
  let penaltySec = 0
  let lastAcSec = -1
  for (const cell of Object.values(cells)) {
    if (!cell.ac || cell.acceptSec == null) continue
    solved += 1
    penaltySec += cell.acceptSec + penaltyPerWrongSec * Math.max(0, cell.attempts - 1)
    if (cell.acceptSec > lastAcSec) lastAcSec = cell.acceptSec
  }
  return { solved, penaltySec, lastAcSec }
}
