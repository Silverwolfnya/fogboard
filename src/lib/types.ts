/** 输入榜单的来源格式 */
export type SourceFormat = 'xcpcio' | 'xcpclink' | 'qoj'

/** 一支队伍在某道题上的最终结果（来自导出文件的聚合信息，没有提交时刻流） */
export interface CellResult {
  /** 题目字母（A、B、C…，按实际表头，不写死） */
  letter: string
  /** 是否通过 */
  ac: boolean
  /**
   * 通过时：该题提交总次数（含通过的那一次），错误次数 = attempts - 1；
   * 未通过时：错误提交次数。
   */
  attempts: number
  /** 通过时刻（秒，从比赛开始计时）；未通过时缺省 */
  acceptSec?: number
  /** 是否首杀（仅 xcpclink 提供） */
  firstBlood?: boolean
}

export interface TeamMarkers {
  /** 正式队（非打星） */
  official: boolean
  /** 打星 / 非正式（xcpcio: Unofficial=Y；xcpclink: Official=*） */
  starred: boolean
  /** 女队 */
  girl: boolean
  /** 奖牌（Gold / Silver / Bronze / Honorable），来自 xcpcio 的 Medal 列或 xcpclink 的首列文本 */
  medal?: string
}

/** 导出文件里自带的、未经本系统重算的字段，仅用于校验与展示 */
export interface TeamSource {
  rank?: number
  organizationRank?: number
  solved?: number
  penaltySec?: number
  rowIndex: number
}

export interface TeamRecord {
  id: string
  name: string
  organization: string
  members: string[]
  coaches?: string
  icpcId?: string
  markers: TeamMarkers
  source: TeamSource
  /** 仅保存真正有提交的题目，键为题目字母 */
  cells: Record<string, CellResult>
  /**
   * 自己手工组建的虚拟队伍：会出现在榜上参与排名，
   * 但不计入解锁阈值、首杀与全场统计（别人看不见你）。
   */
  virtual?: boolean
}

/** 一次手工记录的提交 */
export interface ManualSubmission {
  letter: string
  ac: boolean
  /** 记录时的赛时秒数 */
  sec: number
}

/** 用户自己"参加"这场 VP 的队伍 */
export interface ManualTeam {
  id: string
  name: string
  organization: string
  members: string[]
  submissions: ManualSubmission[]
}

export interface ProblemInfo {
  letter: string
  /** xcpclink 表头形如 "A (72/340)" 时的两个数字（口径未明，只作展示） */
  headerStats?: { ac: number; total: number }
}

export interface Diagnostic {
  level: 'info' | 'warn'
  message: string
}

export interface Contest {
  id: string
  title: string
  fileName: string
  sheetName: string
  source: SourceFormat
  problems: ProblemInfo[]
  teams: TeamRecord[]
  /** 由数据推测的建议比赛时长（秒），实际以设置中的时长为准 */
  suggestedDurationSec: number
  /** 建议封榜时刻（秒） */
  suggestedFreezeSec: number
  importedAt: number
  diagnostics: Diagnostic[]
}

/* ------------------------------------------------------------------ */
/* 回放设置                                                            */
/* ------------------------------------------------------------------ */

export interface Settings {
  /** 固定阈值：通过队伍数达到该值即解锁；null 表示关闭这条规则 */
  unlockCount: number | null
  /** 百分比阈值：通过队伍数达到 N * pct% 即解锁；null 表示关闭 */
  unlockPercent: number | null
  /** 两条规则同时开启时的组合方式：min = 任一满足（默认），max = 需同时满足 */
  combine: 'min' | 'max'
  /** 封榜时是否让所有题目立即解锁 */
  unlockAtFreeze: boolean
  freezeEnabled: boolean
  /** 封榜时刻（分钟） */
  freezeStartMin: number
  /** 比赛时长（分钟） */
  durationMin: number
  penaltyPerWrongMin: number
  /** 榜单口径：全部队伍 / 仅正式队（同时影响 N、阈值、展示行） */
  scope: 'all' | 'official'
  /** 我的队伍：它的格子永远可见、结果实时更新 */
  selfTeamId: string | null
  selfSeesLive: boolean
  /** 调试：显示未解锁题目的解锁进度 */
  showLockedProgress: boolean
  /** 调试：无视解锁与封榜，显示完整信息 */
  showFullInfo: boolean
}

/* ------------------------------------------------------------------ */
/* 快照                                                                */
/* ------------------------------------------------------------------ */

export type Phase = 'before' | 'live' | 'frozen' | 'final'

export type CellKind = 'locked' | 'empty' | 'ac' | 'rejected'

export interface CellView {
  kind: CellKind
  /** 通过/错误提交次数（AC 时为提交总次数） */
  attempts: number
  acceptSec?: number
  firstBlood?: boolean
  /** 最近 1 分钟内通过：用于翻牌高亮 */
  recent?: boolean
  /** 该列当前是否仍处于未解锁状态（"我的队伍"仍会显示自己的格子） */
  lockedColumn?: boolean
}

/** 一次通过：主榜按时间顺序展示，不带题号 */
export interface SolveView {
  attempts: number
  acceptSec: number
  firstBlood?: boolean
  recent?: boolean
}

export interface ProblemView {
  letter: string
  unlocked: boolean
  /** 解锁时刻（秒）；Infinity 表示永远不会在赛时解锁 */
  unlockSec: number
  reason: 'threshold' | 'freeze' | 'never'
  /** 已通过队伍数（未解锁时 UI 默认不展示） */
  accepted: number
  threshold: number | null
  /** 刚刚解锁（3 分钟内）：用于题卡点亮的动效 */
  justUnlocked: boolean
}

export interface RowView {
  teamId: string
  team: TeamRecord
  rank: number
  solved: number
  penaltySec: number
  lastAcSec: number
  isSelf: boolean
  /**
   * 主榜显示的"通过顺序"：按通过时刻升序，只有次数、提交数、时刻，没有题号。
   * 锁定的题目同样计入这里 —— 过题数/罚时/时刻都不含题目身份。
   */
  solves: SolveView[]
  /** 与题目列一一对应（仅队伍抽屉用，受解锁状态约束） */
  cells: CellView[]
}

export interface Snapshot {
  /** 当前播放时刻（秒） */
  t: number
  /** 用于计算榜单数据的时刻（封榜期间被截断） */
  dataT: number
  durationSec: number
  freezeSec: number | null
  phase: Phase
  /** 是否已经"解封"（能看到封榜后的结果） */
  revealed: boolean
  /** 生效的阈值 k 与它的来源 */
  threshold: number | null
  thresholdSource: string
  teamCount: number
  problems: ProblemView[]
  rows: RowView[]
  stats: {
    totalAc: number
    solvedTeams: number
    unlockedProblems: number
    acceptedRecent: number
  }
}

/* ------------------------------------------------------------------ */
/* 解析                                                                */
/* ------------------------------------------------------------------ */

export interface ProblemColumn {
  letter: string
  index: number
  headerStats?: { ac: number; total: number }
}

export interface SheetAnalysis {
  name: string
  format: SourceFormat | null
  headerRow: number
  problemColumns: ProblemColumn[]
  columns: Record<string, number>
  teamCount: number
  /** 0 表示不可用 */
  score: number
  reason: string
}

export interface SheetData {
  name: string
  rows: (string | number | boolean | null)[][]
}

export interface WorkbookFile {
  fileName: string
  fileSize: number
  sheets: SheetData[]
}
