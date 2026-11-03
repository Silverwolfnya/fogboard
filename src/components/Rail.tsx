import { useMemo, useState } from 'react'
import type { Contest, ManualTeam, Settings, Snapshot } from '../lib/types'
import type { ContestIndex } from '../lib/model/contest'
import type { UnlockPlan } from '../lib/rules/unlock'
import { manualLetterStates } from '../lib/model/manual'
import { formatAcceptTime, formatClock, formatPenalty, formatPercent } from '../lib/format'
import { cx, Icon } from './ui'

interface RailProps {
  contest: Contest
  index: ContestIndex
  snapshot: Snapshot
  plan: UnlockPlan
  settings: Settings
  selectedProblem: string | null
  onSelectProblem: (letter: string | null) => void
  onSelectTeam: (id: string) => void
  /** 自己创建的虚拟队伍 */
  manualTeam: ManualTeam | null
  manualPick: string | null
  onPickProblem: (letter: string | null) => void
  onRecord: (letter: string, ac: boolean) => void
  onUndo: () => void
  onClear: () => void
  onCreateTeam: () => void
  onRemoveTeam: () => void
}

/** 右栏：要么是题目总览，要么是某道题的详情（解锁后才看得到名单） */
export function Rail(props: RailProps) {
  if (props.selectedProblem) {
    return (
      <ProblemPanel
        letter={props.selectedProblem}
        snapshot={props.snapshot}
        index={props.index}
        settings={props.settings}
        minutePrecision={props.contest.source !== 'xcpclink'}
        onBack={() => props.onSelectProblem(null)}
        onSelectTeam={props.onSelectTeam}
      />
    )
  }
  return <OverviewPanel {...props} />
}

/* ------------------------------------------------------------------ */

function ProblemPanel({
  letter,
  snapshot,
  index,
  settings,
  minutePrecision,
  onBack,
  onSelectTeam,
}: {
  letter: string
  snapshot: Snapshot
  index: ContestIndex
  settings: Settings
  minutePrecision: boolean
  onBack: () => void
  onSelectTeam: (id: string) => void
}) {
  const problem = snapshot.problems.find((p) => p.letter === letter)

  const solvers = useMemo(() => {
    const teams = settings.scope === 'official' ? index.officialTeams : index.fieldTeams
    const out: {
      teamId: string
      name: string
      organization: string
      sec: number
      attempts: number
      firstBlood: boolean
    }[] = []
    for (const team of teams) {
      const cell = team.cells[letter]
      if (!cell?.ac || cell.acceptSec == null || cell.acceptSec > snapshot.dataT) continue
      out.push({
        teamId: team.id,
        name: team.name,
        organization: team.organization,
        sec: cell.acceptSec,
        attempts: cell.attempts,
        firstBlood: Boolean(cell.firstBlood),
      })
    }
    out.sort((a, b) => a.sec - b.sec || a.teamId.localeCompare(b.teamId))
    return out
  }, [letter, index, snapshot, settings.scope])

  return (
    <aside className="rail" aria-label="题目详情">
      <button className="rail-back" onClick={onBack}>
        <Icon name="back" />
        全部题目
      </button>

      <div className="pdetail-head">
        <span className={cx('pd-letter', problem?.unlocked ? 'on' : 'off')}>{letter}</span>
        <div className="pd-meta">
          <span className="pd-title">{problem?.unlocked ? `${problem.accepted} 队通过` : '尚未解锁'}</span>
          <span className="pd-sub">
            {problem?.unlocked
              ? `${formatClock(problem.unlockSec)} 解锁`
              : `通过数达到 ${problem?.threshold ?? '—'} 队或封榜后可见`}
          </span>
        </div>
      </div>

      {problem?.unlocked ? (
        solvers.length > 0 ? (
          <>
            <div className="rail-head">
              <h2>通过名单</h2>
              <span className="aside">{solvers.length} 队</span>
            </div>
            <ol className="solver-list">
              {solvers.map((s) => (
                <li key={s.teamId}>
                  <button className="solver" onClick={() => onSelectTeam(s.teamId)}>
                    <span className="sv-time">{formatAcceptTime(s.sec, minutePrecision)}</span>
                    <span className="sv-name">
                      <span className="sv-team">{s.name}</span>
                      <span className="sv-org">{s.organization}</span>
                    </span>
                    <span className="sv-att">
                      {s.firstBlood ? <em className="sv-fb">FB</em> : null}+{s.attempts}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="field-help">此刻还没有队伍通过这道题。</p>
        )
      ) : (
        <p className="field-help">
          这道题还在雾里。赛时榜不会显示任何队伍在这道题上的结果，直到通过数达到阈值，或者封榜把剩下的题目一起解锁。
        </p>
      )}
    </aside>
  )
}

/* ------------------------------------------------------------------ */

function OverviewPanel({
  contest,
  index,
  snapshot,
  plan,
  settings,
  onSelectProblem,
  onSelectTeam,
  manualTeam,
  manualPick,
  onPickProblem,
  onRecord,
  onUndo,
  onClear,
  onCreateTeam,
  onRemoveTeam,
}: Omit<RailProps, 'selectedProblem'>) {
  const minutePrecision = contest.source !== 'xcpclink'
  const self = settings.selfTeamId ? snapshot.rows.find((r) => r.teamId === settings.selfTeamId) : null
  const threshold = plan.threshold

  const curve = useMemo(() => {
    const minutes = Math.max(1, Math.round(snapshot.durationSec / 60))
    const counts = new Array<number>(minutes + 1).fill(0)
    for (const letter of index.letters) {
      for (const sec of index.acSecs[letter]) {
        const m = Math.min(minutes, Math.max(0, Math.floor(sec / 60)))
        counts[m] += 1
      }
    }
    let acc = 0
    return counts.map((c) => (acc += c))
  }, [index, snapshot.durationSec])

  const max = curve[curve.length - 1] || 1
  const w = 288
  const h = 54
  const cut = Math.min(curve.length - 1, Math.max(0, Math.floor(snapshot.dataT / 60)))
  const visible = curve.slice(0, cut + 1)
  const points = visible
    .map((v, i) => `${(i / (curve.length - 1)) * w},${h - 3 - (v / max) * (h - 8)}`)
    .join(' ')
  const lastX = (cut / (curve.length - 1)) * w
  const cursorX = (snapshot.dataT / snapshot.durationSec) * w

  return (
    <aside className="rail" aria-label="题目与统计">
      <section className="rail-section">
        <div className="rail-head">
          <h2>题目</h2>
          <span className="aside">
            {snapshot.stats.unlockedProblems}/{snapshot.problems.length} 已解锁
          </span>
        </div>
        <div className="problem-grid">
          {snapshot.problems.map((p) => (
            <button
              key={p.letter}
              className={cx('pcard', p.unlocked ? 'open' : 'locked', p.justUnlocked && 'just')}
              onClick={() => onSelectProblem(p.letter)}
              title={
                p.unlocked
                  ? `${p.letter} 题 · ${p.accepted} 队通过 · ${formatClock(p.unlockSec)} 解锁`
                  : `${p.letter} 题 · 未解锁${
                      settings.showLockedProgress ? ` · ${p.accepted}/${p.threshold ?? '—'}` : ''
                    }`
              }
            >
              <span className="l">{p.letter}</span>
              <span className="v">
                {p.unlocked ? (
                  p.accepted
                ) : (
                  <>
                    <Icon name="lock" className="pcard-lock" />
                    {settings.showLockedProgress ? (
                      <em>
                        {p.accepted}/{p.threshold ?? '∞'}
                      </em>
                    ) : null}
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
        <p className="field-help">点开已解锁的题目，看是哪几支队通过的。</p>
      </section>

      <section className="rail-section">
        <div className="rail-head">
          <h2>全场</h2>
          <span className="aside">
            {contest.source === 'xcpcio' ? 'board.xcpio' : contest.source === 'xcpclink' ? 'xcpclink' : 'QOJ'}
          </span>
        </div>
        <dl className="stat-list">
          <div className="stat-row">
            <dt>累计通过</dt>
            <dd>
              {snapshot.stats.totalAc}
              <em>/ {index.totalAc}</em>
            </dd>
          </div>
          <div className="stat-row">
            <dt>有通过队伍</dt>
            <dd>
              {snapshot.stats.solvedTeams}
              <em>/ {snapshot.teamCount}</em>
            </dd>
          </div>
          <div className="stat-row">
            <dt>解锁阈值</dt>
            <dd>
              {threshold.threshold ?? '—'}
              <em>{threshold.source === 'min' ? '取较小' : threshold.source === 'max' ? '取较大' : ''}</em>
            </dd>
          </div>
          <div className="stat-row">
            <dt>统计口径</dt>
            <dd>
              {threshold.n}
              <em>{settings.scope === 'official' ? '正式队' : '全部队伍'}</em>
            </dd>
          </div>
          <div className="stat-row">
            <dt>封榜</dt>
            <dd>{snapshot.freezeSec != null ? formatClock(snapshot.freezeSec) : '未启用'}</dd>
          </div>
        </dl>
        <svg className="tiny-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={`0,${h} ${points} ${lastX},${h}`} fill="rgba(70,177,131,0.10)" stroke="none" />
          <polyline
            points={points}
            fill="none"
            stroke="rgba(70,177,131,0.75)"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={cursorX}
            x2={cursorX}
            y1={0}
            y2={h}
            stroke="rgba(237,230,216,0.35)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </section>

      <section className="rail-section">
        <div className="rail-head">
          <h2>我的队伍</h2>
          <span className="aside">{manualTeam ? '虚拟 · 仅自己可见' : '仅自己可见'}</span>
        </div>
        {manualTeam ? (
          <ManualCard
            team={manualTeam}
            row={self ?? null}
            pick={manualPick}
            letters={index.letters}
            minutePrecision={minutePrecision}
            onPick={onPickProblem}
            onRecord={onRecord}
            onUndo={onUndo}
            onClear={onClear}
            onRemove={onRemoveTeam}
            onEdit={onCreateTeam}
          />
        ) : self ? (
          <>
            <div className="self-card">
              <button
                className="name"
                onClick={() => onSelectTeam(self.teamId)}
                style={{ textAlign: 'left', overflow: 'hidden' }}
              >
                {self.team.name}
              </button>
              <div className="meta">
                #{self.rank} · {self.solved} 题 · 罚时 {formatPenalty(self.penaltySec)}
              </div>
              <div className="meta">
                最近通过 {self.lastAcSec >= 0 ? formatAcceptTime(self.lastAcSec, minutePrecision) : '—'}
              </div>
            </div>
            <button className="action-btn" onClick={onCreateTeam}>
              换成自己的虚拟队伍
            </button>
          </>
        ) : (
          <>
            <p className="self-empty">
              点榜单里的任意一队，在抽屉里设为「我的队伍」。
              <br />
              你自己没打过这场？建一支虚拟队伍，边打边记。
            </p>
            <button className="action-btn primary" onClick={onCreateTeam}>
              创建我的队伍
            </button>
          </>
        )}
      </section>

      <section className="rail-section">
        <div className="rail-head">
          <h2>阈值构成</h2>
        </div>
        <dl className="stat-list">
          <div className="stat-row">
            <dt>固定阈值</dt>
            <dd>{threshold.countThreshold ?? '关闭'}</dd>
          </div>
          <div className="stat-row">
            <dt>百分比阈值</dt>
            <dd>
              {threshold.percentThreshold ?? '关闭'}
              {threshold.percentThreshold != null ? (
                <em>{settings.unlockPercent != null ? formatPercent(settings.unlockPercent) : ''}</em>
              ) : null}
            </dd>
          </div>
        </dl>
        <p className="field-help">
          达到阈值的题目会立刻解锁；封榜时其余题目一并解锁，但榜单数据冻结在封榜时刻。
        </p>
      </section>

      {settings.showFullInfo ? (
        <div className="note warn">
          <Icon name="lock" />
          <span>
            调试开关已打开：所有题目强制解锁、榜单不封冻。
            <br />
            关闭后可回到真实规则。
          </span>
        </div>
      ) : null}
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* 虚拟队伍记分板                                                       */
/* ------------------------------------------------------------------ */

function ManualCard({
  team,
  row,
  pick,
  letters,
  minutePrecision,
  onPick,
  onRecord,
  onUndo,
  onClear,
  onRemove,
  onEdit,
}: {
  team: ManualTeam
  row: { rank: number; solved: number; penaltySec: number } | null
  pick: string | null
  letters: string[]
  minutePrecision: boolean
  onPick: (letter: string | null) => void
  onRecord: (letter: string, ac: boolean) => void
  onUndo: () => void
  onClear: () => void
  onRemove: () => void
  onEdit: () => void
}) {
  const states = useMemo(() => manualLetterStates(team, letters), [team, letters])
  const recent = team.submissions.slice(-5).reverse()
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const picked = pick ? states[pick] : null
  const locked = picked?.ac === true

  return (
    <div className="manual">
      <div className="manual-head">
        <span className="manual-name" title={team.members.join('、')}>
          {team.name}
        </span>
        <button className="text-btn" onClick={onEdit}>
          编辑
        </button>
      </div>

      <div className="manual-meta">
        {row
          ? `${row.rank > 0 ? `#${row.rank}` : '—'} · ${row.solved} 题 · 罚时 ${formatPenalty(row.penaltySec)}`
          : '0 题 · 还没交过'}
      </div>

      <div className="manual-letters">
        {letters.map((letter) => {
          const st = states[letter]
          return (
            <button
              key={letter}
              className={cx(
                'letter-chip',
                st.ac && 'is-ac',
                !st.ac && st.wrongs > 0 && 'is-wrong',
                pick === letter && 'is-pick',
              )}
              onClick={() => onPick(pick === letter ? null : letter)}
              title={
                st.ac
                  ? `${letter} 题 · 通过 ${formatAcceptTime(st.acceptSec ?? 0, minutePrecision)}${
                      st.wrongs > 0 ? ` · 之前错 ${st.wrongs} 次` : ''
                    }`
                  : `${letter} 题${st.wrongs > 0 ? ` · 已错 ${st.wrongs} 次` : ''}`
              }
            >
              <b>{letter}</b>
              <i>{st.ac ? '✓' : st.wrongs > 0 ? st.wrongs : ''}</i>
            </button>
          )
        })}
      </div>

      <div className="manual-actions">
        <button
          className="action-btn primary"
          disabled={!pick || locked}
          onClick={() => pick && onRecord(pick, true)}
        >
          通过了
        </button>
        <button
          className="action-btn"
          disabled={!pick || locked}
          onClick={() => pick && onRecord(pick, false)}
        >
          没通过
        </button>
      </div>

      <p className="field-help manual-hint">
        {!pick
          ? '先点一个题号，再选「通过了 / 没通过」（Enter / Backspace 也行）'
          : locked
            ? `${pick} 题已经通过了`
            : `${pick} 题${picked && picked.wrongs > 0 ? ` · 已错 ${picked.wrongs} 次` : ' · 还没交过'}`}
      </p>

      {recent.length > 0 ? (
        <ul className="manual-log">
          {recent.map((s, i) => (
            <li key={`${s.sec}-${s.letter}-${i}`}>
              <span className="ml-time">{formatAcceptTime(s.sec, minutePrecision)}</span>
              <span className="ml-letter">{s.letter}</span>
              <span className={cx('ml-res', s.ac ? 'ok' : 'no')}>{s.ac ? '通过' : '没通过'}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="manual-foot">
        <button className="text-btn" onClick={onUndo} disabled={team.submissions.length === 0}>
          撤销
        </button>
        <button
          className="text-btn"
          onClick={() => {
            if (confirmClear) {
              onClear()
              setConfirmClear(false)
            } else {
              setConfirmClear(true)
              window.setTimeout(() => setConfirmClear(false), 2600)
            }
          }}
        >
          {confirmClear ? '确定清空？' : '清空'}
        </button>
        <button
          className="text-btn danger"
          onClick={() => {
            if (confirmRemove) onRemove()
            else {
              setConfirmRemove(true)
              window.setTimeout(() => setConfirmRemove(false), 2600)
            }
          }}
        >
          {confirmRemove ? '确定移除？' : '移除队伍'}
        </button>
      </div>
    </div>
  )
}
