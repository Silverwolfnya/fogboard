import { useMemo } from 'react'
import type { Contest, Settings, Snapshot } from '../lib/types'
import type { ContestIndex } from '../lib/model/contest'
import type { UnlockPlan } from '../lib/rules/unlock'
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
    const teams = settings.scope === 'official' ? index.officialTeams : index.teams
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
          <span className="aside">仅自己可见</span>
        </div>
        {self ? (
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
        ) : (
          <p className="self-empty">
            点榜单里的任意一队，在抽屉里设为「我的队伍」。
            <br />
            它知道自己过了哪些题，明细只在抽屉里给你看。
          </p>
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
