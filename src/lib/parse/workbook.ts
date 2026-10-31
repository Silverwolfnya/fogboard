import * as XLSX from 'xlsx'
import type { SheetData, WorkbookFile } from '../types'

type RawCell = string | number | boolean | null
type RawRow = RawCell[]

function trimTrailingEmpty(rows: RawRow[]): RawRow[] {
  let end = rows.length
  while (end > 0 && rows[end - 1].every((c) => c === null || c === '')) end -= 1
  return rows.slice(0, end)
}

/**
 * 用 SheetJS 解析 xlsx。保留行下标（空行也占位），这样"表头在第几行"的探测结果对得上。
 */
export function parseWorkbook(buffer: ArrayBuffer, fileName: string, fileSize?: number): WorkbookFile {
  const wb = XLSX.read(new Uint8Array(buffer), {
    type: 'array',
    cellDates: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
  })

  const sheets: SheetData[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    if (!ws) return { name, rows: [] }
    const rows = XLSX.utils.sheet_to_json<RawRow>(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    })
    return { name, rows: trimTrailingEmpty(rows) }
  })

  return { fileName, fileSize: fileSize ?? buffer.byteLength, sheets }
}

export async function readWorkbookFile(file: File): Promise<WorkbookFile> {
  const buffer = await file.arrayBuffer()
  return parseWorkbook(buffer, file.name, file.size)
}
