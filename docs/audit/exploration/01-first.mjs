import { launch, close, setSize, DATA } from './lib.mjs'
const a = await launch({ theme: 'light' })
const { page } = a
console.log('title', await page.title())
console.log('window min size', await a.app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return w.getMinimumSize() }))
await a.shot('01-welcome-light-1440x900')
console.log('BUTTONS', JSON.stringify(await page.getByRole('button').allInnerTexts()))
console.log('TEXT', (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 800))
await page.getByRole('combobox', { name: 'Tema' }).selectOption('dark')
await a.shot('01-welcome-dark-1440x900')
for (const [w, h] of [[1280, 800], [1024, 700], [800, 600]]) { await setSize(a.app, [w, h]); await a.shot(`01-welcome-dark-${w}x${h}`) }
console.log('errors', a.errors)
await close(a)
