// 从 board.xcpcio.com 拉一场比赛的完整数据（含**逐条提交**），合并成一个文件。
//
// 用法：
//   node scripts/fetch-xcpcio.mjs https://board.xcpcio.com/ccpc/11th/chongqing?group=official
//   node scripts/fetch-xcpcio.mjs <url> --out fixtures/xcpcio-chongqing.json
//
// 页面本身是 SPA，真正的数据在 /data/<赛事路径>/{config,team,run}.json：
//   config.json  比赛信息、题目、罚时、封榜时长
//   team.json    队伍（含 organization / group / members）
//   run.json     逐条提交：team_id / problem_id / timestamp(ms) / status
//
// 注意：这些接口没有 Access-Control-Allow-Origin，浏览器里 fetch 会被 CORS 挡，
// 所以只能由本脚本（Node，不受 CORS 限制）下载后交给页面导入。
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const url = process.argv[2]
if (!url) {
  console.error('用法: node scripts/fetch-xcpcio.mjs <board 页面 URL> [--out 路径]')
  process.exit(1)
}

const outIdx = process.argv.indexOf('--out')
const outFlag = outIdx > 0 ? process.argv[outIdx + 1] : null

const u = new URL(url)
const path = u.pathname.replace(/^\/+|\/+$/g, '')
if (!path) {
  console.error('URL 里没有赛事路径，例如 /ccpc/11th/chongqing')
  process.exit(1)
}
const base = `${u.origin}/data/${path}`
const slug = path.split('/').pop()

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

async function getJSON(name) {
  const res = await fetch(`${base}/${name}.json`, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`${name}.json → HTTP ${res.status}`)
  return res.json()
}

console.log(`数据目录: ${base}`)
const [config, teams, runs] = await Promise.all([getJSON('config'), getJSON('team'), getJSON('run')])

// run.json 有时是数组、有时包一层
const runList = Array.isArray(runs) ? runs : Array.isArray(runs?.runs) ? runs.runs : []
const teamList = Array.isArray(teams) ? teams : Array.isArray(teams?.teams) ? teams.teams : []

const payload = {
  source: 'xcpcio',
  url,
  contest_name: config.contest_name ?? '',
  start_time: config.start_time ?? null,
  end_time: config.end_time ?? null,
  penalty: config.penalty ?? 1200,
  frozen_time: config.frozen_time ?? 3600,
  medal: config.medal ?? null,
  timestamp_unit: config.options?.submission_timestamp_unit ?? null,
  groups: config.group ?? {},
  problems: (config.problems ?? []).map((p) => ({ id: String(p.id), label: p.label })),
  teams: teamList.map((t) => ({
    id: String(t.id),
    name: t.name ?? '',
    organization: t.organization ?? '',
    group: Array.isArray(t.group) ? t.group : t.group ? [t.group] : [],
    members: t.members ?? [],
    coaches: t.coaches ?? [],
  })),
  runs: runList.map((r) => ({
    team_id: String(r.team_id),
    problem_id: String(r.problem_id),
    timestamp: Number(r.timestamp),
    status: String(r.status),
  })),
}

const out = outFlag ?? `fixtures/xcpcio-${slug}.json`
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(payload), 'utf8')

const ac = payload.runs.filter((r) => r.status === 'CORRECT').length
const official = payload.teams.filter((t) => t.group.includes('official')).length
console.log(
  `✓ ${payload.contest_name}\n  ${payload.teams.length} 队（正式 ${official}）· ${payload.problems.length} 题 · ` +
    `${payload.runs.length} 条提交（AC ${ac}）\n  罚时 ${payload.penalty / 60} 分/次 · 封榜前 ${payload.frozen_time / 3600} 小时 · 写入 ${out}`,
)
