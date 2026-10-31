import { useCallback, useEffect, useMemo, useState } from 'react'
import chengduUrl from '../fixtures/board-xcpcio-chengdu.xlsx?url'
import qinhuangdaoUrl from '../fixtures/xcpclink-qinhuangdao.xlsx?url'

import { analyzeSheet, analyzeWorkbook, type WorkbookReport } from './lib/parse/detect'
import { parseWorkbook, readWorkbookFile } from './lib/parse/workbook'
import { parseXcpcio } from './lib/parse/xcpcio'
import { parseXcpclink } from './lib/parse/xcpclink'
import { dumpFromText, parseQojDump } from './lib/parse/qoj'
import { buildIndex, createContest } from './lib/model/contest'
import { computeUnlocks } from './lib/rules/unlock'
import { buildSnapshot } from './lib/model/snapshot'
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings } from './lib/rules/settings'
import type { Contest, Settings, WorkbookFile } from './lib/types'
import { cx, Icon, Toast } from './components/ui'
import { formatClock } from './lib/format'
import { BoardTable } from './components/Board'
import { Playbar, Timeline, type UnlockMark } from './components/Playback'
import { Rail } from './components/Rail'
import { DiagnosticsDialog, ImportDialog, RuleDialog, SettingsDialog, TeamDrawer } from './components/Dialogs'
import { usePlayback } from './state/usePlayback'

type DialogName = 'import' | 'settings' | 'help' | 'diagnostics' | null

const SAMPLE_FILE = {
  chengdu: 'board-xcpcio-chengdu.xlsx',
  qinhuangdao: 'xcpclink-qinhuangdao.xlsx',
} as const

export default function App() {
  const [workbook, setWorkbook] = useState<WorkbookFile | null>(null)
  const [report, setReport] = useState<WorkbookReport | null>(null)
  const [sheetName, setSheetName] = useState<string | null>(null)
  const [contest, setContest] = useState<Contest | null>(null)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [manualReveal, setManualReveal] = useState(false)
  const [dialog, setDialog] = useState<DialogName>(null)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [selectedProblem, setSelectedProblem] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [railOpen, setRailOpen] = useState(true)

  const index = useMemo(() => (contest ? buildIndex(contest) : null), [contest])
  const plan = useMemo(() => (index ? computeUnlocks(index, settings) : null), [index, settings])
  const durationSec = plan?.durationSec ?? 300 * 60
  const playback = usePlayback(durationSec)

  const snapshot = useMemo(() => {
    if (!index || !plan) return null
    return buildSnapshot({ index, plan, settings, t: playback.t, manualReveal })
  }, [index, plan, settings, playback.t, manualReveal])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3400)
    return () => window.clearTimeout(id)
  }, [toast])

  const finishLoad = useCallback(
    (next: Contest, sheetLabel: string) => {
      setContest(next)
      setSheetName(sheetLabel)
      setManualReveal(false)
      setSelectedTeam(null)
      setSelectedProblem(null)
      setQuery('')
      setSettings((prev) => ({
        ...prev,
        durationMin: Math.round(next.suggestedDurationSec / 60),
        freezeStartMin: Math.round(next.suggestedFreezeSec / 60),
        selfTeamId: null,
      }))
      setDialog(null)
      setToast(`${next.title} · ${next.teams.length} 支队伍 · ${next.problems.length} 道题`)
      playback.pause()
      playback.seek(0)
    },
    [playback],
  )

  const applySheet = useCallback(
    (file: WorkbookFile, name: string) => {
      const sheet = file.sheets.find((s) => s.name === name)
      if (!sheet) return
      const analysis = analyzeSheet(sheet)
      if (!analysis.format) {
        setToast(`工作表「${name}」里没有找到题目列`)
        setDialog('import')
        return
      }
      const parsed =
        analysis.format === 'xcpcio'
          ? parseXcpcio({ fileName: file.fileName, sheet, analysis })
          : parseXcpclink({ fileName: file.fileName, sheet, analysis })
      const next = createContest({
        fileName: file.fileName,
        sheetName: name,
        source: analysis.format,
        parsed,
      })
      setWorkbook(file)
      setReport(analyzeWorkbook(file))
      finishLoad(next, name)
    },
    [finishLoad],
  )

  /** 粘贴 QOJ 抓取结果（JSON）或另存网页的 HTML；返回错误信息，成功返回 null */
  const loadQojText = useCallback(
    (text: string): string | null => {
      try {
        const dump = dumpFromText(text)
        const parsed = parseQojDump(dump)
        const next = createContest({
          fileName: dump.url || 'qoj',
          sheetName: 'QOJ 榜单',
          source: 'qoj',
          parsed,
        })
        setWorkbook(null)
        setReport(null)
        finishLoad(next, 'QOJ 榜单')
        return null
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      }
    },
    [finishLoad],
  )

  const loadFromBuffer = useCallback(
    (buffer: ArrayBuffer, fileName: string) => {
      try {
        const file = parseWorkbook(buffer, fileName)
        const rep = analyzeWorkbook(file)
        setWorkbook(file)
        setReport(rep)
        if (rep.bestSheet) applySheet(file, rep.bestSheet)
        else {
          setDialog('import')
          setToast('没有识别到榜单工作表，请确认是 board.xcpio 或 xcpclink 的导出')
        }
      } catch (err) {
        setToast(`读取失败：${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [applySheet],
  )

  const loadFile = useCallback(
    async (file: File) => {
      try {
        const parsed = await readWorkbookFile(file)
        const rep = analyzeWorkbook(parsed)
        setWorkbook(parsed)
        setReport(rep)
        if (rep.bestSheet) applySheet(parsed, rep.bestSheet)
        else {
          setDialog('import')
          setToast('没有识别到榜单工作表，请确认是 board.xcpio 或 xcpclink 的导出')
        }
      } catch (err) {
        setToast(`读取失败：${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [applySheet],
  )

  const loadSample = useCallback(
    async (which: 'chengdu' | 'qinhuangdao') => {
      const url = which === 'chengdu' ? chengduUrl : qinhuangdaoUrl
      try {
        const res = await fetch(url)
        const buffer = await res.arrayBuffer()
        loadFromBuffer(buffer, SAMPLE_FILE[which])
      } catch (err) {
        setToast(`示例载入失败：${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [loadFromBuffer],
  )

  const pickSheet = useCallback(
    (name: string) => {
      if (!workbook) return
      applySheet(workbook, name)
    },
    [workbook, applySheet],
  )

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => normalizeSettings({ ...prev, ...patch }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings((prev) => ({
      ...DEFAULT_SETTINGS,
      durationMin: prev.durationMin,
      freezeStartMin: prev.freezeStartMin,
      selfTeamId: prev.selfTeamId,
    }))
  }, [])

  const marks = useMemo<UnlockMark[]>(() => {
    if (!plan) return []
    const groups = new Map<number, string[]>()
    for (const p of plan.problems) {
      if (!Number.isFinite(p.unlockSec)) continue
      const sec = Math.round(p.unlockSec)
      groups.set(sec, [...(groups.get(sec) ?? []), p.letter])
    }
    return [...groups.entries()]
      .map(([sec, letters]) => ({ sec, letters }))
      .sort((a, b) => a.sec - b.sec)
  }, [plan])

  const visibleRows = useMemo(() => {
    if (!snapshot) return []
    const q = query.trim().toLowerCase()
    if (!q) return snapshot.rows
    return snapshot.rows.filter(
      (r) =>
        r.team.name.toLowerCase().includes(q) ||
        r.team.organization.toLowerCase().includes(q) ||
        r.team.members.join(' ').toLowerCase().includes(q),
    )
  }, [snapshot, query])

  const selectedRow = useMemo(
    () => (snapshot && selectedTeam ? snapshot.rows.find((r) => r.teamId === selectedTeam) ?? null : null),
    [snapshot, selectedTeam],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (dialog) return
      if (selectedTeam) return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          playback.toggle()
          break
        case 'ArrowLeft':
          e.preventDefault()
          playback.step(e.shiftKey ? -60 : -10)
          break
        case 'ArrowRight':
          e.preventDefault()
          playback.step(e.shiftKey ? 60 : 10)
          break
        case 'Home':
          e.preventDefault()
          playback.seek(0)
          break
        case 'End':
          e.preventDefault()
          playback.seek(durationSec)
          break
        case 'u':
        case 'U':
          setManualReveal((v) => !v)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playback, dialog, selectedTeam, durationSec])

  const selfName =
    (settings.selfTeamId && index?.teamById.get(settings.selfTeamId)?.name) || null

  return (
    <div className={cx('app', !snapshot && 'empty-shell')}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">雾榜</span>
          <span className="brand-latin">FOG BOARD</span>
        </div>
        <div className="topbar-sep" />
        <div className="topbar-context">
          <span className="context-tag">CCPC 2026 · 新赛制</span>
          <span className="context-title">
            {contest
              ? `${[...new Set([contest.title, contest.sheetName].filter(Boolean))].join(' · ')} · ${
                  contest.teams.length
                } 队`
              : '赛时榜单回放'}
          </span>
        </div>
        <div className="topbar-actions">
          <button className="ghost-btn" onClick={() => setDialog('import')} title="导入榜单文件">
            <Icon name="upload" />
            <span>导入</span>
          </button>
          <button className="ghost-btn" onClick={() => setDialog('help')} title="规则与数据说明">
            <Icon name="book" />
            <span>规则</span>
          </button>
          <button
            className="ghost-btn"
            onClick={() => setDialog('diagnostics')}
            disabled={!contest}
            title="数据诊断"
          >
            <Icon name="pulse" />
            <span>诊断</span>
          </button>
          <button
            className="ghost-btn"
            data-active={railOpen}
            onClick={() => setRailOpen((v) => !v)}
            title="展开 / 收起右栏"
          >
            <Icon name="panel" />
            <span>面板</span>
          </button>
          <button className="ghost-btn" onClick={() => setDialog('settings')} title="回放规则设置">
            <Icon name="sliders" />
            <span>设置</span>
          </button>
        </div>
      </header>

      {snapshot && index && plan ? (
        <>
          <Playbar
            t={snapshot.t}
            durationSec={snapshot.durationSec}
            freezeSec={snapshot.freezeSec}
            phase={snapshot.phase}
            playing={playback.playing}
            speed={playback.speed}
            revealed={snapshot.revealed}
            unlocked={snapshot.stats.unlockedProblems}
            problemCount={snapshot.problems.length}
            query={query}
            filtered={query.trim() ? visibleRows.length : null}
            onQuery={setQuery}
            onToggle={playback.toggle}
            onSeek={playback.seek}
            onSpeed={playback.setSpeed}
          />

          <main className={cx('stage', railOpen && 'has-rail', snapshot.phase === 'frozen' && 'is-frozen')}>
            <div className="stage-main">
              {snapshot.phase === 'frozen' ? (
                <div className="freeze-banner" role="status">
                  <span className="fb-tag">封榜</span>
                  <span className="fb-text">
                    数据冻结于 {formatClock(snapshot.freezeSec ?? 0)}
                    {snapshot.revealed
                      ? ' · 已解封，正在显示封榜后的结果'
                      : ' · 封榜后新的通过不会显示'}
                  </span>
                  <span className="fb-spacer" />
                  <button
                    className="action-btn"
                    data-on={snapshot.revealed}
                    onClick={() => setManualReveal((v) => !v)}
                  >
                    {snapshot.revealed ? '恢复封榜' : '解封'}
                  </button>
                </div>
              ) : null}
              <div className="board-wrap">
                <BoardTable
                  rows={visibleRows}
                  slotCount={Math.max(15, snapshot.problems.length)}
                  problemCount={snapshot.problems.length}
                  minutePrecision={contest!.source !== 'xcpclink'}
                  onSelectTeam={setSelectedTeam}
                />
              </div>
            </div>
            {railOpen ? (
              <Rail
                contest={contest!}
                index={index}
                snapshot={snapshot}
                plan={plan}
                settings={settings}
                selectedProblem={selectedProblem}
                onSelectProblem={setSelectedProblem}
                onSelectTeam={setSelectedTeam}
              />
            ) : null}
          </main>

          <Timeline
            t={snapshot.t}
            durationSec={snapshot.durationSec}
            freezeSec={snapshot.freezeSec}
            marks={marks}
            onSeek={playback.seek}
          />
        </>
      ) : (
        <EmptyState
          onFile={loadFile}
          onSample={loadSample}
          onOpenImport={() => setDialog('import')}
          onOpenQoj={() => setDialog('import')}
        />
      )}

      {dialog === 'import' ? (
        <ImportDialog
          report={report}
          activeSheet={sheetName}
          onFile={loadFile}
          onPickSheet={pickSheet}
          onSample={loadSample}
          onQojText={loadQojText}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'settings' ? (
        <SettingsDialog
          settings={settings}
          teamCount={index ? (settings.scope === 'official' ? index.officialTeams.length : index.teams.length) : 0}
          selfName={selfName}
          onChange={patchSettings}
          onReset={resetSettings}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'help' ? <RuleDialog onClose={() => setDialog(null)} /> : null}

      {dialog === 'diagnostics' && contest ? (
        <DiagnosticsDialog
          contest={contest}
          report={report}
          activeSheet={sheetName}
          onPickSheet={pickSheet}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {selectedRow && snapshot ? (
        <TeamDrawer
          row={selectedRow}
          problems={snapshot.problems}
          minutePrecision={contest?.source !== 'xcpclink'}
          onClose={() => setSelectedTeam(null)}
          onSetSelf={() => {
            patchSettings({ selfTeamId: selectedRow.teamId })
            setToast(`已设为「我的队伍」：${selectedRow.team.name}`)
            setSelectedTeam(null)
          }}
          onClearSelf={() => {
            patchSettings({ selfTeamId: null })
            setSelectedTeam(null)
          }}
        />
      ) : null}

      {toast ? <Toast text={toast} /> : null}
    </div>
  )
}

function EmptyState({
  onFile,
  onSample,
  onOpenImport,
  onOpenQoj,
}: {
  onFile: (f: File) => void
  onSample: (w: 'chengdu' | 'qinhuangdao') => void
  onOpenImport: () => void
  onOpenQoj: () => void
}) {
  const [over, setOver] = useState(false)
  return (
    <div className="empty">
      <div className="empty-inner">
        <div className="empty-lead">
          <p className="eyebrow">China Collegiate Programming Contest · 2026</p>
          <h1>雾榜</h1>
          <p className="lede">
            赛时榜单只告诉你每支队伍<em>过了几题</em>、<em>罚时多少</em>。
            哪支队过了哪一道题，要等这道题够热，或者封榜的那一刻，才会亮起来。
          </p>
          <ol className="rule-brief">
            <li>
              <span className="idx">01</span>
              <span>一道题被 min(50 队, 20% 队伍) 通过后，右栏那张题卡才亮起来，点开能看是谁过的。</span>
            </li>
            <li>
              <span className="idx">02</span>
              <span>4:00 封榜：剩下的题同时亮起，但榜单停在那一刻，不再变化。</span>
            </li>
            <li>
              <span className="idx">03</span>
              <span>5:00 终榜：全部细节可见，包括没通过题目的错误提交次数。</span>
            </li>
          </ol>

          <div className="fog-strip" aria-hidden="true">
            {[
              ['A', null],
              ['B', null],
              ['C', 55],
              ['D', 302],
              ['E', null],
              ['F', null],
              ['G', null],
              ['H', null],
              ['I', 53],
              ['J', null],
              ['K', 131],
              ['L', null],
              ['M', 254],
            ].map(([letter, count]) => (
              <span key={String(letter)} className={cx('fs', count != null && 'on')}>
                <b>{letter}</b>
                <i>{count != null ? count : '?'}</i>
              </span>
            ))}
          </div>
        </div>

        <div className="empty-side">
          <div
            className="dropzone"
            data-over={over}
            role="button"
            tabIndex={0}
            onClick={onOpenImport}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onOpenImport()
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file) onFile(file)
            }}
          >
            <Icon name="upload" />
            <span className="dz-title">把榜单 xlsx 拖进来</span>
            <span className="dz-sub">board.xcpio 与 xcpclink 的导出都能直接用</span>
          </div>

          <div className="sample-row">
            <button className="sample-btn" onClick={() => onSample('chengdu')}>
              <b>成都站 · 所有队伍</b>
              <span>board.xcpio · 328 队 · 13 题 · 5 小时</span>
            </button>
            <button className="sample-btn" onClick={() => onSample('qinhuangdao')}>
              <b>秦皇岛站 · Main</b>
              <span>xcpclink · 375 队 · 13 题 · 5 小时</span>
            </button>
          </div>

          <p className="side-note">
            文件只在本机解析，不会上传。回放规则、封榜时刻、解锁阈值都可以改。
            <br />
            <button className="qoj-link" onClick={onOpenQoj}>
              榜单在 QOJ 上？用「QOJ 导入」→
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
