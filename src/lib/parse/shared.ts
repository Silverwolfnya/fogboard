import type { Diagnostic } from '../types'

export type Row = (string | number | boolean | null)[]

export const str = (v: unknown): string => (v == null ? '' : String(v).trim())

export function toInt(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : undefined
  const s = String(v).replace(/[,，\s]/g, '').replace(/[^\d.+-]/g, '')
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : undefined
}

export function toNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  const n = Number(String(v).trim())
  return Number.isFinite(n) ? n : undefined
}

export function splitMembers(v: unknown): string[] {
  return str(v)
    .split(/[,，、;；]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function warning(message: string): Diagnostic {
  return { level: 'warn', message }
}

export function info(message: string): Diagnostic {
  return { level: 'info', message }
}
