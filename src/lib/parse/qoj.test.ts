import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { dumpFromText, parseQojDump, QOJ_SNIPPET, type QojDump } from './qoj'
import { aggregateTeam } from '../model/aggregate'

/**
 * 取自 qoj.ac/results/ICPCCamp2026Day1 的两行真实数据：
 * QOJ 的 "+k 0:45" 里 k 是**错误次数**（不是提交总数），罚时 = 时刻 + 20×k。
 */
const HEADER = [
  'Rank.',
  'Username',
  'A 24/61',
  'B 26/61',
  'C 4/14',
  'D 27/33',
  'E 20/62',
  'F 1/21',
  'G 17/32',
  'H 8/33',
  'I 17/37',
  'J 1/8',
  'K 27/43',
  'L 22/23',
  'M 6/30',
  'Solved',
  'Penalty',
  'Dirt',
]

const ROW1 = [
  '1',
  '北京大学 - 飞带不长队',
  '+1 0:45',
  '+ 1:06',
  '+2 4:55',
  '+ 0:17',
  '+ 0:41',
  '+ 3:20',
  '+ 2:03',
  '+ 3:37',
  '+ 1:17',
  '+ 4:13',
  '+ 0:22',
  '+ 0:55',
  '+2 2:05',
  '13',
  '1636',
  '27%',
]

const ROW2 = [
  '2',
  '清华大学 - 零基础新生1队',
  '+ 1:49',
  '+ 0:45',
  '+1 4:32',
  '+ 0:21',
  '+2 1:33',
  '-15 4:59',
  '+ 2:25',
  '+ 2:56',
  '+ 1:52',
  '-',
  '+ 0:12',
  '+ 0:35',
  '+4 4:52',
  '11',
  '1452',
  '38%',
]

const cell = (t: string) => ({ t, ti: '', d: {} })

function dumpOf(rows: string[][]): QojDump {
  return {
    v: 1,
    url: 'https://qoj.ac/results/ICPCCamp2026Day1',
    title: 'The 2026 China ICPC Training Camp. Day 1 - QOJ.ac',
    rows: rows.map((r) => r.map(cell)),
  }
}

describe('QOJ 榜单解析', () => {
  const parsed = parseQojDump(dumpOf([HEADER, ROW1, ROW2]))

  it('认出 13 道题与两支队伍', () => {
    expect(parsed.problems.map((p) => p.letter)).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    ])
    expect(parsed.teams).toHaveLength(2)
  })

  it('把 "学校 - 队名" 拆成机构与队名', () => {
    expect(parsed.teams[0].organization).toBe('北京大学')
    expect(parsed.teams[0].name).toBe('飞带不长队')
  })

  it('"+k" 的 k 是错误次数，重算罚时与榜面完全一致', () => {
    const first = aggregateTeam(parsed.teams[0].cells)
    expect(first.solved).toBe(13)
    expect(first.penaltySec).toBe(1636 * 60)

    const second = aggregateTeam(parsed.teams[1].cells)
    expect(second.solved).toBe(11)
    expect(second.penaltySec).toBe(1452 * 60)
  })

  it('每次通过的提交次数 = k + 1', () => {
    const a = parsed.teams[0].cells.A
    expect(a.ac).toBe(true)
    expect(a.attempts).toBe(2)
    expect(a.acceptSec).toBe(45 * 60)
  })

  it('"-15" 是 15 次错误提交、没有通过；"-" 是没提交', () => {
    const f = parsed.teams[1].cells.F
    expect(f.ac).toBe(false)
    expect(f.attempts).toBe(15)
    expect(parsed.teams[1].cells.J).toBeUndefined()
  })

  it('保留榜面名次，供诊断比对', () => {
    expect(parsed.teams[0].source.rank).toBe(1)
    expect(parsed.teams[0].source.solved).toBe(13)
    expect(parsed.teams[1].source.penaltySec).toBe(1452 * 60)
  })

  it('标题去掉 "- QOJ.ac"', () => {
    expect(parsed.title).toBe('The 2026 China ICPC Training Camp. Day 1')
  })
})

describe('QOJ 抓取内容的容错', () => {
  it('能自动区分 h:mm 与 m:ss', () => {
    const rows = [
      ['Rank.', 'Username', 'A 1/1', 'B 1/1', 'Solved', 'Penalty'],
      ['1', 'X - Y', '+ 1:30', '+ 0:10', '2', '100'],
    ]
    const dump: QojDump = { rows: rows.map((r) => r.map(cell)) }
    const parsed = parseQojDump(dump)
    // m:ss 解读下罚时 = 90 + 10 = 100 秒 ≈ 2 分钟，与榜面 100 分不符；
    // h:mm 解读 = 90 + 10 分钟 = 100 分钟，刚好对上 → 选 h:mm
    expect(parsed.notes.some((n) => n.message.includes('h:mm'))).toBe(true)
    expect(aggregateTeam(parsed.teams[0].cells).penaltySec).toBe(100 * 60)
  })

  it('粘贴 JSON 能直接解析', () => {
    const dump = dumpFromText(JSON.stringify(dumpOf([HEADER, ROW1])))
    expect(dump.rows).toHaveLength(2)
    expect(parseQojDump(dump).teams).toHaveLength(1)
  })

  it('认不出的内容给出明确错误', () => {
    expect(() => dumpFromText('hello')).toThrow(/太短|认不出/)
    expect(() => dumpFromText('')).toThrow(/空的/)
    expect(() => dumpFromText('{"foo":1}')).toThrow(/rows/)
  })

  it('抓错页面（没有题目列）时报错', () => {
    const dump: QojDump = { rows: [['a', 'b'], ['c', 'd']].map((r) => r.map(cell)) }
    expect(() => parseQojDump(dump)).toThrow(/题目列/)
  })

  it('给用户的抓取脚本包含表格探测与复制', () => {
    expect(QOJ_SNIPPET).toContain('querySelectorAll')
    expect(QOJ_SNIPPET).toContain('copy(')
  })
})

describe('直接粘贴的纯文本（Ctrl+A / Ctrl+C）', () => {
  const raw = readFileSync(resolve(process.cwd(), 'fixtures/qoj-paste.txt'), 'utf8')
  const parsed = parseQojDump(dumpFromText(raw))

  it('认出 11 道题与 5 支队伍', () => {
    expect(parsed.problems.map((p) => p.letter)).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K',
    ])
    expect(parsed.teams).toHaveLength(5)
  })

  it('罚时与榜面逐队一致（含 *+ 首杀、-11、纯 -）', () => {
    const expected: [string, number, number][] = [
      ['USA1', 11, 835],
      ['THU1', 11, 1042],
      ['Nameless Dreamer', 10, 942],
      ['Almost Retired Dandelion', 10, 984],
      ['Jury', 0, 0],
    ]
    parsed.teams.forEach((team, i) => {
      const agg = aggregateTeam(team.cells)
      expect(team.name.startsWith(expected[i][0])).toBe(true)
      expect(agg.solved).toBe(expected[i][1])
      expect(Math.round(agg.penaltySec / 60)).toBe(expected[i][2])
    })
  })

  it('"*" 标记开成首杀', () => {
    const thu = parsed.teams[1]
    expect(thu.cells.G.firstBlood).toBe(true)
    expect(Object.values(thu.cells).filter((c) => c.firstBlood)).toHaveLength(1)
  })

  it('"队名 (队员, 队员)" 拆成队名与队员', () => {
    expect(parsed.teams[0].name).toBe('USA1')
    expect(parsed.teams[0].members).toEqual(['Andrew He', 'Kevin Sun', 'Gennady Korotkevich'])
    expect(parsed.teams[4].name).toBe('Jury')
    expect(parsed.teams[4].members).toEqual([])
  })

  it('复制时带上页面导航/年份也不影响', () => {
    const noisy = `QOJ.ac 2026 Contests  A  B\n${raw}`
    const p = parseQojDump(dumpFromText(noisy))
    expect(p.teams).toHaveLength(5)
    expect(p.problems).toHaveLength(11)
  })

  it('"-11" 是 11 次错误提交，纯 "-" 表示没提交', () => {
    expect(parsed.teams[3].cells.J.ac).toBe(false)
    expect(parsed.teams[3].cells.J.attempts).toBe(11)
    expect(parsed.teams[2].cells.J).toBeUndefined()
  })
})

describe('内置的 QOJ 示例（fixtures/qoj-demo.json）', () => {  it('四支队伍的通过数与罚时都和 QOJ 榜面一致', () => {
    const raw = readFileSync(resolve(process.cwd(), 'fixtures/qoj-demo.json'), 'utf8')
    const parsed = parseQojDump(dumpFromText(raw))
    expect(parsed.teams).toHaveLength(4)
    const expected: [number, number][] = [
      [13, 1636],
      [11, 1452],
      [11, 1713],
      [10, 1242],
    ]
    parsed.teams.forEach((team, i) => {
      const agg = aggregateTeam(team.cells)
      expect(`${team.name} ${agg.solved}/${Math.round(agg.penaltySec / 60)}`).toBe(
        `${team.name} ${expected[i][0]}/${expected[i][1]}`,
      )
      expect(agg.solved).toBe(expected[i][0])
      expect(Math.round(agg.penaltySec / 60)).toBe(expected[i][1])
    })
  })
})
