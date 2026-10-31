import type { Settings } from '../types'

export const DEFAULT_SETTINGS: Settings = {
  unlockCount: 50,
  unlockPercent: 20,
  combine: 'min',
  unlockAtFreeze: true,
  freezeEnabled: true,
  freezeStartMin: 240,
  durationMin: 300,
  penaltyPerWrongMin: 20,
  scope: 'all',
  selfTeamId: null,
  selfSeesLive: true,
  showLockedProgress: false,
  showFullInfo: false,
}

const STORAGE_KEY = 'fogboard.settings.v1'

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(hi, Math.max(lo, Math.round(n)))
}

export function normalizeSettings(input: Partial<Settings> | null | undefined): Settings {
  const raw = input ?? {}
  const pickNumber = (v: unknown, lo: number, hi: number, fallback: number | null): number | null => {
    if (v === null) return null
    if (v === undefined) return fallback
    return clampInt(v, lo, hi, fallback ?? lo)
  }
  return {
    unlockCount: pickNumber(raw.unlockCount, 1, 1000, 50),
    unlockPercent: pickNumber(raw.unlockPercent, 0.1, 100, 20),
    combine: raw.combine === 'max' ? 'max' : 'min',
    unlockAtFreeze: raw.unlockAtFreeze !== false,
    freezeEnabled: raw.freezeEnabled !== false,
    freezeStartMin: clampInt(raw.freezeStartMin, 0, 600, 240),
    durationMin: clampInt(raw.durationMin, 1, 600, 300),
    penaltyPerWrongMin: clampInt(raw.penaltyPerWrongMin, 0, 120, 20),
    scope: raw.scope === 'official' ? 'official' : 'all',
    selfTeamId: typeof raw.selfTeamId === 'string' ? raw.selfTeamId : null,
    selfSeesLive: raw.selfSeesLive !== false,
    showLockedProgress: raw.showLockedProgress === true,
    showFullInfo: raw.showFullInfo === true,
  }
}

export function loadSettings(): Settings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return normalizeSettings(JSON.parse(raw) as Partial<Settings>)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* 隐私模式下忽略 */
  }
}
