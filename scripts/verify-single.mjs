// 验证单文件版：直接以 file:// 打开 dist-single/FogBoard.html，确认内置榜单能加载。
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const file = resolve('dist-single/FogBoard.html')
const url = pathToFileURL(file).href
mkdirSync('docs/screenshots', { recursive: true })

const errors = []
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 980 } })
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

console.log('打开', url, `${(await (await import('node:fs')).promises.stat(file)).size / 1024 / 1024} MB`)
await page.goto(url)
await page.waitForSelector('.empty', { timeout: 15000 })
await page.screenshot({ path: 'docs/screenshots/18-single-file.png' })

await page.getByRole('button', { name: /成都站/ }).click()
await page.waitForSelector('.board tbody tr', { timeout: 15000 })
await page.waitForTimeout(600)
const rows = await page.locator('.board tbody tr').count()
const title = await page.locator('.context-title').innerText()
console.log(`单文件版载入成都站：${rows} 行 · ${title}`)
if (rows !== 328) throw new Error(`行数不对：${rows}`)

await browser.close()
if (errors.length) {
  console.error('控制台错误：', errors)
  process.exit(1)
}
console.log('单文件版 OK')
