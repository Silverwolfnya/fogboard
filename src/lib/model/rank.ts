export interface RankEntry {
  id: string
  solved: number
  penaltySec: number
  /** 最后一次通过的时刻；没有通过为 -1 */
  lastAcSec: number
}

/**
 * ICPC 排名：通过数降序 → 罚时升序 → 最后一次通过时刻升序（早者在前）。
 * 三个键完全相同才并列（1-2-2-4）。
 */
export function compareRank(a: RankEntry, b: RankEntry): number {
  if (a.solved !== b.solved) return b.solved - a.solved
  if (a.penaltySec !== b.penaltySec) return a.penaltySec - b.penaltySec
  if (a.lastAcSec !== b.lastAcSec) return a.lastAcSec - b.lastAcSec
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sortRanked<T extends RankEntry>(entries: T[]): T[] {
  return [...entries].sort(compareRank)
}

/** 按已排好序的数组分配名次（并列同名次，下一名跳号） */
export function assignRanks(entries: RankEntry[]): number[] {
  const ranks = new Array<number>(entries.length)
  for (let i = 0; i < entries.length; i += 1) {
    if (i === 0) {
      ranks[i] = 1
      continue
    }
    const prev = entries[i - 1]
    const cur = entries[i]
    const tied =
      prev.solved === cur.solved && prev.penaltySec === cur.penaltySec && prev.lastAcSec === cur.lastAcSec
    ranks[i] = tied ? ranks[i - 1] : i + 1
  }
  return ranks
}
