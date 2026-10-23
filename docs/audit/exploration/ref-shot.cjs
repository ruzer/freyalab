const { app, BrowserWindow } = require('electron'); const fs = require('fs')
const out = process.env.OUT
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, width: 1440, height: 1000 })
  await w.loadFile(process.env.REF); await new Promise(r => setTimeout(r, 4000))
  const info = await w.webContents.executeJavaScript(`({ buttons: [...document.querySelectorAll('nav button')].map(b => b.innerText.trim()), tw: typeof tailwind, h: document.getElementById('macos-window')?.getBoundingClientRect().height })`)
  console.log(JSON.stringify(info))
  for (const theme of ['light', 'dark']) {
    await w.webContents.executeJavaScript(`document.documentElement.classList.toggle('dark', ${theme === 'dark'}); 0`)
    for (const n of [0, 1, 2]) {
      await w.webContents.executeJavaScript(`(() => { const b = [...document.querySelectorAll('nav button')][${n}]; b && b.click(); return 0 })()`)
      await new Promise(r => setTimeout(r, 700))
      const rect = await w.webContents.executeJavaScript(`(() => { const e = document.getElementById('macos-window'); e.scrollIntoView(); const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } })()`)
      const img = await w.webContents.capturePage(rect)
      fs.writeFileSync(`${out}/33-reference-${'ABC'[n]}-${theme}.png`, img.toPNG()); console.log('saved', n, theme, rect.width + 'x' + rect.height)
    }
  }
  app.quit()
})
