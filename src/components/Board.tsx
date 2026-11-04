import { memo } from 'react'
import type { EntryView, RowView, SolveView } from '../lib/types'
import { formatAcceptTime, formatPenalty, formatPenaltyFull } from '../lib/format'
import { cx } from './ui'

interface BoardProps {
  rows: RowView[]
  /** 固定列数（默认 15）：第 1 次、第 2 次…通过 */
  slotCount: number
  /** 本场题数，用于"5/13"里的分母 */
  problemCount: number
  minutePrecision: boolean
  onSelectTeam: (id: string) => void
}

/**
 * 主榜：名次 / 队伍 / 通过数 / 罚时 / 第 1..15 次通过。
 * 每次通过只给"第几次、几次提交、什么时刻"，不给题号 —— 题号只活在右栏，解锁后才有。
 */
export function BoardTable({ rows, slotCount, problemCount, minutePrecision, onSelectTeam }: BoardProps) {
  return (
    <table className="board">
      <colgroup>
        <col className="col-rank" />
        <col className="col-team" />
        <col className="col-solved" />
        <col className="col-penalty" />
        {Array.from({ length: slotCount }, (_, i) => (
          <col className="col-slot" key={i} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th className="h-rank">#</th>
          <th className="h-team">队伍</th>
          <th className="h-solved">通过</th>
          <th className="h-penalty">罚时</th>
          {Array.from({ length: slotCount }, (_, i) => (
            <th className="h-slot" key={i} title={`第 ${i + 1} 次通过（按时间顺序，不含题号）`}>
              <span className="n">{i + 1}</span>
              <span className="u">次</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <TeamRow
            key={row.teamId}
            row={row}
            onSelect={onSelectTeam}
            slotCount={slotCount}
            problemCount={problemCount}
            minutePrecision={minutePrecision}
          />
        ))}
      </tbody>
    </table>
  )
}

interface TeamRowProps {
  row: RowView
  onSelect: (id: string) => void
  slotCount: number
  problemCount: number
  minutePrecision: boolean
}

const TeamRow = memo(function TeamRow({
  row,
  onSelect,
  slotCount,
  problemCount,
  minutePrecision,
}: TeamRowProps) {
  const { team } = row
  const pct = problemCount > 0 ? Math.min(100, (row.solved / problemCount) * 100) : 0
  const subtitle = [team.organization, team.markers.girl ? '女队' : '', team.markers.starred ? '打星' : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <tr className={cx('row', row.isSelf && 'is-self', row.rank >= 1 && row.rank <= 3 && 'is-top')}>
      <td className={cx('c-rank', row.medal && `has-${row.medal}`)}>
        <i className={cx('rank-medal', row.medal && `medal-${row.medal}`)} aria-hidden="true" />
        <span className="rank-num">{row.rank > 0 ? row.rank : '–'}</span>
      </td>
      <td className="c-team">
        <button
          className="team-button"
          onClick={() => onSelect(row.teamId)}
          title={`${team.name}${subtitle ? ` · ${subtitle}` : ''}`}
        >
          <span className="team-name">{team.name}</span>
          {team.virtual ? <span className="tag-virtual">虚拟</span> : null}
          {team.organization ? <span className="team-org">{team.organization}</span> : null}
        </button>
      </td>
      <td className="c-solved">
        <span className="solved-num">{row.solved}</span>
        <span className="solved-total">/{problemCount}</span>
        <span className="solved-bar" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </span>
      </td>
      <td
        className="c-penalty"
        title={row.penaltySec > 0 ? `罚时 ${formatPenaltyFull(row.penaltySec)}` : '暂无罚时'}
      >
        {formatPenalty(row.penaltySec)}
      </td>
      {Array.from({ length: slotCount }, (_, i) => {
        const entry = row.entries[i]
        if (!entry) return <td className="pcell is-empty" key={i} />
        if (entry.kind === 'fail') {
          return <FailCell key={i} entry={entry} ordinal={i + 1} minutePrecision={minutePrecision} />
        }
        return (
          <SolveCell
            key={i}
            solve={{
              attempts: entry.attempts,
              acceptSec: entry.sec ?? 0,
              firstBlood: entry.firstBlood,
              recent: entry.recent,
              letter: entry.letter,
            }}
            ordinal={i + 1}
            minutePrecision={minutePrecision}
          />
        )
      })}
    </tr>
  )
}, areRowsEqual)

function entriesEqual(a: EntryView[], b: EntryView[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]
    const y = b[i]
    if (
      x.kind !== y.kind ||
      x.attempts !== y.attempts ||
      x.sec !== y.sec ||
      x.firstSec !== y.firstSec ||
      x.recent !== y.recent ||
      x.firstBlood !== y.firstBlood ||
      x.letter !== y.letter
    ) {
      return false
    }
  }
  return true
}

function areRowsEqual(a: TeamRowProps, b: TeamRowProps): boolean {
  if (a.row === b.row) return true
  if (
    a.slotCount !== b.slotCount ||
    a.problemCount !== b.problemCount ||
    a.minutePrecision !== b.minutePrecision ||
    a.onSelect !== b.onSelect
  ) {
    return false
  }
  if (a.row.rank !== b.row.rank ||
    a.row.solved !== b.row.solved ||
    a.row.penaltySec !== b.row.penaltySec ||
    a.row.isSelf !== b.row.isSelf ||
    a.row.medal !== b.row.medal ||
    a.row.team.name !== b.row.team.name ||
    a.row.team.organization !== b.row.team.organization
  ) {
    return false
  }
  return entriesEqual(a.row.entries, b.row.entries)
}

function FailCell({
  entry,
  ordinal,
  minutePrecision,
}: {
  entry: EntryView
  ordinal: number
  minutePrecision: boolean
}) {
  const last = entry.sec != null ? formatAcceptTime(entry.sec, minutePrecision) : null
  return (
    <td
      className="pcell is-fail"
      title={`第 ${ordinal} 格 · 未通过${entry.letter ? ` · ${entry.letter} 题` : ''} · ${
        entry.attempts
      } 次错误提交${last ? ` · 最后一次 ${last}` : ''}`}
    >
      <span className="tile-fail">
        {entry.letter ? <span className="tile-letter is-fail">{entry.letter}</span> : null}
        −{entry.attempts}
        {last ? <span className="tile-fail-time">{last}</span> : null}
      </span>
    </td>
  )
}

function SolveCell({
  solve,
  ordinal,
  minutePrecision,
}: {
  solve: SolveView
  ordinal: number
  minutePrecision: boolean
}) {
  return (
    <td
      className={cx('pcell', solve.recent && 'is-recent')}
      title={`第 ${ordinal} 次通过${solve.letter ? ` · ${solve.letter} 题` : ''} · ${formatAcceptTime(
        solve.acceptSec,
        minutePrecision,
      )} · ${solve.attempts} 次提交${solve.firstBlood ? ' · 首杀' : ''}`}
    >
      <span className="tile">
        {solve.letter ? <span className="tile-letter">{solve.letter}</span> : null}
        <span className="tile-main">+{solve.attempts}</span>
        <span className="tile-time">{formatAcceptTime(solve.acceptSec, minutePrecision)}</span>
      </span>
      {solve.firstBlood ? <span className="tile-fb" /> : null}
    </td>
  )
}
