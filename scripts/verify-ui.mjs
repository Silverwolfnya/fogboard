// 用本机 Chrome 跑一遍核心交互并截图。
// 用法：先 `pnpm dev`，再 `node scripts/verify-ui.mjs`
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/'
const OUT = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })

const errors = []
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 980 }, deviceScaleFactor: 1 })
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

const shot = async (name) => {
  await page.waitForTimeout(220)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`✓ ${name}`)
}

const seekRatio = async (ratio) => {
  const box = await page.locator('.tl-track').boundingBox()
  if (!box) throw new Error('找不到时间轴')
  await page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2)
  await page.waitForTimeout(160)
}

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.empty')
await shot('01-empty')

// 载入成都站示例
await page.getByRole('button', { name: /成都站/ }).click()
await page.waitForSelector('.board tbody tr')
const rowCount = await page.locator('.board tbody tr').count()
const colCount = await page.locator('.board thead th').count()
const slotCount = await page.locator('.board thead th.h-slot').count()
console.log(`rows=${rowCount} cols=${colCount} slots=${slotCount}`)
if (rowCount !== 328) throw new Error(`期望 328 行，实际 ${rowCount}`)
if (colCount !== 19) throw new Error(`期望 19 列（4 信息列 + 15 个通过位），实际 ${colCount}`)
if (slotCount !== 15) throw new Error(`期望 15 个通过位，实际 ${slotCount}`)
await shot('02-t0')

// 20:10 —— M 题解锁
await seekRatio(1210 / 18000)
const openAt20 = await page.locator('.pcard.open').count()
console.log(`20:10 右栏已点亮 ${openAt20} 题`)
if (openAt20 !== 1) throw new Error(`20:10 应该只有 1 题解锁，实际 ${openAt20}`)
await shot('03-t20m')

// 2:16 —— 5 题解锁
await seekRatio(8160 / 18000)
const openAt131 = await page.locator('.pcard.open').count()
console.log(`2:16 已点亮 ${openAt131} 题`)
if (openAt131 !== 5) throw new Error(`2:16 应该有 5 题解锁，实际 ${openAt131}`)
await shot('04-t131m')

// 点开一道已解锁的题看通过名单
await page.locator('.pcard.open').first().click()
await page.waitForSelector('.solver')
const solverCount = await page.locator('.solver').count()
console.log(`题目详情里能看到 ${solverCount} 支通过队伍`)
if (solverCount < 10) throw new Error(`题目详情通过名单异常：${solverCount}`)
await shot('04b-problem')
await page.locator('.rail-back').click()
await page.waitForTimeout(150)

// 4:05 —— 封榜
await seekRatio(14700 / 18000)
const phaseText = (await page.locator('.playbar-right .chip').last().innerText()).trim()
console.log(`4:05 阶段标记：${phaseText}`)
if (!phaseText.includes('封榜中')) throw new Error(`4:05 应处于封榜，实际 ${phaseText}`)
await shot('05-frozen')

// 解封
await page.getByRole('button', { name: '解封' }).click()
await page.waitForTimeout(200)
await shot('06-unsealed')

// 终榜
await seekRatio(0.998)
await page.waitForTimeout(250)
await shot('07-final')

// 队伍抽屉
await page.locator('.board tbody tr').nth(0).locator('.team-button').click()
await page.waitForSelector('.drawer')
await shot('08-drawer')
await page.keyboard.press('Escape')

// 设置面板
await page.getByRole('button', { name: '设置' }).click()
await page.waitForSelector('.dialog')
await shot('09-settings')
await page.keyboard.press('Escape')

// 规则面板
await page.getByRole('button', { name: '规则' }).click()
await page.waitForSelector('.dialog')
await shot('10-rules')
await page.keyboard.press('Escape')

// 播放
await page.locator('.play-btn').click()
await page.waitForTimeout(1200)
const clock = await page.locator('.clock').innerText()
console.log(`播放中的时钟：${clock}`)
await shot('11-playing')
await page.locator('.play-btn').click()

// 秦皇岛站
await page.getByRole('button', { name: '导入' }).click()
await page.waitForSelector('.dialog')
await page.getByRole('button', { name: /秦皇岛站/ }).click()
await page.waitForSelector('.board tbody tr')
const qhdRows = await page.locator('.board tbody tr').count()
console.log(`秦皇岛 rows=${qhdRows}`)
if (qhdRows !== 375) throw new Error(`秦皇岛期望 375 行，实际 ${qhdRows}`)
await seekRatio(3100 / 18000)
await shot('12-qinhuangdao')

// 移动端
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(250)
await shot('13-mobile')

// 回到桌面，测搜索 / 我的队伍 / 帧率
await page.setViewportSize({ width: 1600, height: 980 })
await seekRatio(1210 / 18000)
await page.locator('.search-box input').fill('武汉')
await page.waitForTimeout(200)
const filtered = await page.locator('.board tbody tr').count()
console.log(`搜索「武汉」→ ${filtered} 行`)
if (filtered === 0 || filtered >= 100) throw new Error(`搜索筛选异常：${filtered}`)
await shot('14-search')
await page.locator('.search-clear').click()

// 回到成都站，验证「我的队伍」的明细豁免
await page.getByRole('button', { name: '导入' }).click()
await page.waitForSelector('.dialog')
await page.getByRole('button', { name: /成都站/ }).click()
await page.waitForSelector('.board tbody tr')
await seekRatio(3600 / 18000)

// 普通队伍的抽屉：未解锁的题应该留雾
await page.locator('.board tbody tr').nth(1).locator('.team-button').click()
await page.waitForSelector('.drawer')
const otherLocked = await page.locator('.drawer .mini-cell.locked').count()
console.log(`普通队伍抽屉里未解锁的格子：${otherLocked}`)
if (otherLocked === 0) throw new Error('普通队伍的抽屉没有隐藏未解锁的题')
await page.keyboard.press('Escape')
await page.waitForTimeout(150)

// 设为我的队伍后：自己的格子全部可见
await page.locator('.board tbody tr').nth(0).locator('.team-button').click()
await page.waitForSelector('.drawer')
await page.getByRole('button', { name: '设为「我的队伍」' }).click()
await page.waitForTimeout(300)
await page.locator('.row.is-self .team-button').click()
await page.waitForSelector('.drawer')
const selfLocked = await page.locator('.drawer .mini-cell.locked').count()
const selfAc = await page.locator('.drawer .mini-cell.ac').count()
console.log(`我的队伍抽屉：${selfAc} 题可见，${selfLocked} 题是雾`)
if (selfLocked !== 0 || selfAc === 0) throw new Error('「我的队伍」的抽屉没有显示自己的全部题目')
await page.waitForTimeout(3400)
await shot('15-self-team')
await page.keyboard.press('Escape')
await page.waitForTimeout(150)

// 帧率（30× 播放）
await page.locator('.segmented button', { hasText: '30×' }).click()
await page.locator('.play-btn').click()
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0
      const start = performance.now()
      const tick = () => {
        frames += 1
        if (performance.now() - start < 2500) requestAnimationFrame(tick)
        else resolve(frames / ((performance.now() - start) / 1000))
      }
      requestAnimationFrame(tick)
    }),
)
await page.locator('.play-btn').click()
console.log(`30× 播放时帧率约 ${fps.toFixed(1)} fps`)
if (fps < 24) throw new Error(`播放帧率过低：${fps.toFixed(1)} fps`)

// QOJ 导入（粘贴抓取脚本的 JSON）
await page.getByRole('button', { name: '导入', exact: true }).click()
await page.waitForSelector('.dialog')
await shot('17-qoj-import')
const qojText = readFileSync('fixtures/qoj-paste.txt', 'utf8')
await page.locator('.qoj-input').fill(qojText)
await page.getByRole('button', { name: '导入这段内容' }).click()
await page.waitForTimeout(500)
const qojRows = await page.locator('.board tbody tr').count()
const railText = await page.locator('.rail').innerText()
console.log(`QOJ 纯文本导入 → ${qojRows} 行；来源标记：${railText.includes('QOJ') ? 'QOJ ✓' : '缺失'}`)
if (qojRows !== 5) throw new Error(`QOJ 导入行数异常：${qojRows}`)
if (!railText.includes('QOJ')) throw new Error('右栏没有显示 QOJ 来源')
const qojBoard = await page.locator('.board tbody tr').first().innerText()
if (!qojBoard.includes('USA1')) throw new Error(`QOJ 第一行异常：${qojBoard}`)
await seekRatio(0.62)
await shot('16-qoj')

await browser.close()

if (errors.length) {
  console.error('控制台错误：')
  for (const e of errors) console.error(' -', e)
  process.exit(1)
}
console.log('全部通过，截图在', OUT)
