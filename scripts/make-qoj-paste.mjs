// 生成 fixtures/qoj-paste.txt：模拟用户在 QOJ 榜单页 Ctrl+A / Ctrl+C 得到的纯文本。
// 结构与真实复制一致：单元格内换行（状态 / 时刻），列之间用制表符。
import { writeFileSync } from 'node:fs'

const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
const headerStats = ['32/41', '170/302', '337/725', '296/570', '278/517', '258/541', '41/144', '303/739', '25/166', '4/79', '130/350']

const rows = [
  {
    rank: '1',
    name: 'USA1 (Andrew He, Kevin Sun, Gennady Korotkevich)',
    cells: [
      ['+', '1:36'], ['+', '0:19'], ['+1', '0:05'], ['+', '0:21'], ['+', '0:40'], ['+', '0:12'],
      ['+1', '2:17'], ['+', '0:25'], ['+', '1:50'], ['+2', '3:38'], ['+', '1:12'],
    ],
    tail: ['11', '835', '26%'],
  },
  {
    rank: '2',
    name: 'THU1 (Qiwen Xu, Hengxi Liu, Zixuan Qiu)',
    cells: [
      ['+1', '4:29'], ['+', '0:40'], ['+', '0:15'], ['+', '0:24'], ['+', '1:10'], ['+1', '0:14'],
      ['*+', '2:08'], ['+', '0:33'], ['+', '1:24'], ['+2', '4:20'], ['+', '0:25'],
    ],
    tail: ['11', '1042', '26%'],
  },
  {
    rank: '5',
    name: 'Nameless Dreamer (Huarui Lu, Maohua Wang)',
    cells: [
      ['+', '1:49'], ['+1', '0:55'], ['+1', '0:15'], ['+', '0:42'], ['+1', '1:12'], ['+', '0:31'],
      ['+', '4:23'], ['+', '0:16'], ['+2', '2:39'], ['-'], ['+', '1:20'],
    ],
    tail: ['10', '942', '33%'],
  },
  {
    rank: '6',
    name: 'Almost Retired Dandelion (Aleksei Daniliuk, Nikolay Kalinin, Yahor Dubovik)',
    cells: [
      ['+', '4:13'], ['+', '0:20'], ['+', '0:10'], ['+', '0:22'], ['+1', '1:14'], ['+', '0:45'],
      ['+', '3:36'], ['+', '0:33'], ['+3', '2:40'], ['-11', '4:58'], ['+', '1:11'],
    ],
    tail: ['10', '984', '28%'],
  },
  {
    rank: '344',
    name: 'Jury',
    cells: letters.map(() => ['-']),
    tail: ['0', '0', '0%'],
  },
]

const lines = []
lines.push(`Rank.\tUsername\t${letters[0]}`)
// 每个题号后面跟着自己的"通过/提交"统计，所以下一行是 stats[i-1] + letters[i]
for (let i = 1; i < letters.length; i += 1) lines.push(`${headerStats[i - 1]}\t${letters[i]}`)
lines.push(`${headerStats[letters.length - 1]}\tSolved\tPenalty\tDirt`)

for (const row of rows) {
  lines.push(row.rank)
  lines.push(`${row.name}\t`)
  for (const cell of row.cells) {
    lines.push(cell[0])
    if (cell[1]) lines.push(cell[1])
  }
  lines.push(row.tail.join('\t'))
}

writeFileSync('fixtures/qoj-paste.txt', lines.join('\n') + '\n', 'utf8')
console.log('written fixtures/qoj-paste.txt')
