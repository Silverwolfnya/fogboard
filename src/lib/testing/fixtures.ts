import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { analyzeWorkbook } from '../parse/detect'
import { parseWorkbook } from '../parse/workbook'
import { analyzeSheet } from '../parse/detect'
import { parseXcpcio } from '../parse/xcpcio'
import { parseXcpclink } from '../parse/xcpclink'
import { buildIndex, createContest, type ContestIndex } from '../model/contest'
import type { Contest } from '../types'

export const CHENGDU = 'board-xcpcio-chengdu.xlsx'
export const QINHUANGDAO = 'xcpclink-qinhuangdao.xlsx'

export function readFixture(file: string): ArrayBuffer {
  const buf = readFileSync(resolve(process.cwd(), 'fixtures', file))
  const ab = new ArrayBuffer(buf.byteLength)
  new Uint8Array(ab).set(buf)
  return ab
}

export function loadContest(file: string, sheetName?: string): Contest {
  const workbook = parseWorkbook(readFixture(file), file)
  const report = analyzeWorkbook(workbook)
  const name = sheetName ?? report.bestSheet
  if (!name) throw new Error(`没有可用的工作表：${file}`)
  const sheet = workbook.sheets.find((s) => s.name === name)
  if (!sheet) throw new Error(`找不到工作表 ${name}`)
  const analysis = analyzeSheet(sheet)
  if (!analysis.format) throw new Error(`工作表 ${name} 无法识别`)
  const parsed =
    analysis.format === 'xcpcio'
      ? parseXcpcio({ fileName: file, sheet, analysis })
      : parseXcpclink({ fileName: file, sheet, analysis })
  return createContest({ fileName: file, sheetName: name, source: analysis.format, parsed })
}

export function loadIndex(file: string, sheetName?: string): ContestIndex {
  return buildIndex(loadContest(file, sheetName))
}
