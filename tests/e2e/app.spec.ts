import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import electronPath from 'electron'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { once } from 'node:events'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import type { FreyaAPI } from '../../src/shared/types'

declare global { interface Window { freya: FreyaAPI } }
let app: ElectronApplication
let page: Page
let directory: string

test.beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'freyalab-e2e-'))
  await mkdir(join(directory, 'exports'))
  await mkdir(join(directory, 'saved'))
  await launch()
})

async function launch() {
  const { ELECTRON_RUN_AS_NODE: _unused, ...cleanEnv } = process.env
  app = await electron.launch({chromiumSandbox:true,
    executablePath: process.env.FREYALAB_EXECUTABLE || electronPath as unknown as string,
    args: process.env.FREYALAB_EXECUTABLE ? [] : [resolve('out/main/index.js')],
    env: { ...cleanEnv as Record<string, string>, FREYALAB_TEST: '1', FREYALAB_USER_DATA: join(directory, 'profile'), FREYALAB_TEST_EXPORT_DIR: join(directory, 'exports'), FREYALAB_TEST_SAVE_DIR: join(directory, 'saved') },
    timeout: 60_000
  })
  page = await app.firstWindow()
  await page.waitForFunction(() => !!window.freya)
}
test.afterEach(async () => {
  if (app?.process().exitCode === null) await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  await app?.close().catch(() => {})
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
})

test('renderer aislado, documento Markdown editable y guardado real', async () => {
  expect(await page.evaluate(() => ({ require: typeof (window as unknown as Record<string, unknown>).require, process: typeof (window as unknown as Record<string, unknown>).process }))).toEqual({ require: 'undefined', process: 'undefined' })
  const saved = await page.evaluate(async () => {
    const doc = await window.freya.newDocument('markdown')
    const updated = await window.freya.update(doc.id, '# Freya\n\nTexto **editable** con acentos: México.\n')
    if (!updated.dirty) throw new Error('La edición no marcó cambios')
    return await window.freya.save(doc.id)
  })
  expect(saved?.path).toBeTruthy()
  expect(saved?.dirty).toBe(false)
  expect(await readFile(saved!.path!, 'utf8')).toContain('México')
  const reopened = await page.evaluate(async path => {
    const docs = await window.freya.documents()
    for (const doc of docs) await window.freya.close(doc.id)
    return await window.freya.openPaths([path])
  }, saved!.path!)
  expect(reopened[0].text).toContain('# Freya')
  await expect(page.getByRole('document').getByRole('heading', { name: 'Freya', exact: true })).toBeVisible()
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Tema' }).selectOption(theme)
    if(theme==='dark')await expect(page.locator('html')).toHaveClass(/dark/);else await expect(page.locator('html')).not.toHaveClass(/dark/)
    for (const [width, height] of [[1440, 900], [1280, 800]]) {
      await page.setViewportSize({ width, height })
      await page.screenshot({ path: test.info().outputPath(`markdown-${theme}-${width}x${height}.png`) })
    }
  }
})

test('CSV: ceros, multilinea, filtro, edición por identificador y guardado', async () => {
  const input = join(directory, 'inventario.csv')
  await writeFile(input, 'Código,Artículo,Existencias\r\n000124,"Nombre, con coma",5\r\n000125,"Dos\nlineas",12\r\n')
  const result = await page.evaluate(async path => {
    const [doc] = await window.freya.openPaths([path])
    const query = { offset: 0, limit: 20, requestId: 1 }
    const initial = await window.freya.tablePage(doc.id, query)
    if (initial.rows[0].cells[0] !== '000124') throw new Error('Se perdieron ceros')
    await window.freya.tableEdit(doc.id, { type: 'cell', rowId: initial.rows[1].id, column: 2, value: '14' })
    const filtered = await window.freya.tablePage(doc.id, { ...query, requestId: 2, search: '000125' })
    const saved = await window.freya.save(doc.id)
    return { initial, filtered, saved }
  }, input)
  expect(result.filtered.matched).toBe(1)
  expect(result.filtered.rows[0].cells[2]).toBe('14')
  expect(result.saved?.dirty).toBe(false)
  const text = await readFile(input, 'utf8')
  expect(text).toContain('000124')
  expect(text).toContain('Dos\nlineas')
  expect(text).toContain(',14')
})

test('exportación PDF con varias páginas y texto recuperable', async () => {
  const result = await page.evaluate(async () => {
    const doc = await window.freya.newDocument('markdown')
    await window.freya.update(doc.id, '# Pendiente')
    const html = '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:20mm}.second{break-before:page}</style></head><body><h1>Freya primera página</h1><section class="second"><h1>Freya segunda página</h1></section></body></html>'
    const path = await window.freya.export(doc.id, { format: 'pdf', html })
    return { path, dirty: (await window.freya.documents()).find(d => d.id === doc.id)?.dirty }
  })
  expect(result.path).toBeTruthy()
  expect(result.dirty).toBe(true)
  expect((await stat(result.path!)).size).toBeGreaterThan(1000)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = getDocument({ data: new Uint8Array(await readFile(result.path!)), useSystemFonts: true })
  const pdf = await loadingTask.promise
  try {
    expect(pdf.numPages).toBeGreaterThanOrEqual(2)
    const text = await (await pdf.getPage(2)).getTextContent()
    expect(text.items.map(item => 'str' in item ? item.str : '').join(' ')).toContain('segunda')
  } finally { await loadingTask.destroy() }
})

test('exportación SVG independiente mantiene cambios pendientes', async () => {
  const result = await page.evaluate(async () => {
    const doc = await window.freya.newDocument('mermaid')
    await window.freya.update(doc.id, 'flowchart LR\n A[Recibir] --> B[Exportar]')
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120"><rect width="400" height="120" fill="white"/><text x="20" y="60">Freya</text></svg>'
    const path = await window.freya.export(doc.id, { format: 'svg', svg })
    return { path, dirty: (await window.freya.documents()).find(d => d.id === doc.id)?.dirty }
  })
  expect(result.path).toBeTruthy()
  expect(result.dirty).toBe(true)
  expect(await readFile(result.path!, 'utf8')).toContain('<svg')
})


test('HTML autónomo incluye fuentes y SVG, excluye recursos remotos y scripts', async () => {
  const font = (await readdir('out/renderer/assets')).find(name => name.endsWith('.woff2'))!
  expect(font).toBeTruthy()
  const path = await page.evaluate(async font => {
    const doc = await window.freya.newDocument('markdown')
    const html = `<style>@font-face{font-family:Freya;src:url('./assets/${font}')}h1{font-family:Freya}</style><h1>Autónomo</h1><svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><text x="5" y="30">Freya</text></svg><img src="https://example.com/tracker.png"><script>throw new Error('unsafe')</script>`
    return window.freya.export(doc.id, { format: 'html', html })
  }, font)
  expect(path).toBeTruthy()
  const html = await readFile(path!, 'utf8')
  expect(html).toContain('data:font/')
  expect(html).toContain('<svg')
  expect(html).not.toContain('<script')
  expect(html).not.toContain('https://example.com')
  expect(html).not.toContain("url('./assets/")
})

test('recupera cambios tras caída como documento nuevo sin sobrescribir el original', async () => {
  const source = join(directory, 'recuperacion.md')
  await writeFile(source, '# Original intacto\n')
  const doc = await page.evaluate(async path => {
    const [doc] = await window.freya.openPaths([path])
    await window.freya.update(doc.id, '# Cambio pendiente de recuperación\n')
    return doc
  }, source)
  await expect.poll(() => page.evaluate(() => window.freya.recoveries()), { timeout: 15_000 }).not.toHaveLength(0)
  const recoveredId = await page.evaluate(async () => (await window.freya.recoveries())[0].id)
  await test.step('Simular caída del árbol de Electron', async () => {
    const child = app.process()
    const exited = once(child, 'exit', { signal: AbortSignal.timeout(10_000) })
    // Playwright inicia Electron mediante cmd.exe en Windows; matar solo el shell deja la app viva.
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { timeout: 10_000, stdio: 'pipe' })
    else child.kill('SIGKILL')
    await exited
  })
  await app.close().catch(() => {})
  await launch()
  const recovered = await page.evaluate(id => window.freya.recover(id), recoveredId)
  expect(recovered.id).not.toBe(doc.id)
  expect(recovered.path).toBeNull()
  expect(recovered.text).toContain('Cambio pendiente')
  expect(recovered.dirty).toBe(true)
  expect(await readFile(source, 'utf8')).toBe('# Original intacto\n')
})

test('limita imágenes a la carpeta autorizada y rechaza argumentos IPC inválidos', async () => {
  const folder = join(directory, 'autorizado')
  await mkdir(folder)
  const source = join(folder, 'documento.md')
  await writeFile(source, '# Imágenes locales\n')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=', 'base64')
  await writeFile(join(folder, 'permitida.png'), png)
  await writeFile(join(directory, 'fuera.png'), png)
  const result = await page.evaluate(async source => {
    const [doc] = await window.freya.openPaths([source])
    const allowed = await window.freya.image(doc.id, 'permitida.png')
    const escape = await window.freya.image(doc.id, '../fuera.png').catch(() => null)
    let invalidRejected = false
    try { await (window.freya.update as unknown as (id: string, text: number) => Promise<unknown>)(doc.id, 42) } catch { invalidRejected = true }
    return { allowed, escape, invalidRejected }
  }, source)
  expect(result.allowed).toMatch(/^data:image\//)
  expect(result.escape).toBeNull()
  expect(result.invalidRejected).toBe(true)
})

test('exportar una vista CSV nunca reemplaza el archivo abierto', async () => {
  const source = join(directory, 'original.csv')
  const original = 'Código,Artículo\n000124,Uno\n000125,Dos\n'
  await writeFile(source, original)
  const id = await page.evaluate(async path => (await window.freya.openPaths([path]))[0].id, source)
  await app.evaluate((_electron, source) => { process.env.FREYALAB_TEST_EXPORT_PATH = source }, source)
  try {
    const rejected = await page.evaluate(async id => {
      try {
        await window.freya.export(id, { format: 'csv', table: { scope: 'filtered', query: { search: '000124', offset: 0, limit: 20, requestId: 1 } } })
        return false
      } catch { return true }
    }, id)
    expect(rejected).toBe(true)
    expect(await readFile(source, 'utf8')).toBe(original)
    const pageState = await page.evaluate(id => window.freya.tablePage(id, { offset: 0, limit: 20, requestId: 2 }), id)
    expect(pageState.rows).toHaveLength(2)
  } finally { await app.evaluate(() => { delete process.env.FREYALAB_TEST_EXPORT_PATH }) }
})

test('PNG usa el tamaño completo del SVG a escala 2x sin recorte al viewport', async () => {
  const path = await page.evaluate(async () => {
    const doc = await window.freya.newDocument('mermaid')
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="100" viewBox="0 0 1600 100"><rect width="1600" height="100" fill="white"/><rect x="1400" width="200" height="100" fill="blue"/></svg>'
    return window.freya.export(doc.id, { format: 'png', svg })
  })
  expect(path).toBeTruthy()
  const png = await readFile(path!)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.readUInt32BE(16)).toBe(3200)
  expect(png.readUInt32BE(20)).toBe(200)
})

test('buscar archivos recorre carpetas cerradas y excluye ocultos y dependencias',async()=>{
 await mkdir(join(directory,'sub','nested'),{recursive:true});await mkdir(join(directory,'node_modules'),{recursive:true})
 await writeFile(join(directory,'sub','nested','objetivo.md'),'# Dentro')
 await writeFile(join(directory,'node_modules','objetivo.md'),'# Dependencia')
 await writeFile(join(directory,'.objetivo.md'),'# Oculto')
 await app.evaluate((_,path)=>{process.env.FREYALAB_TEST_FOLDER=path},directory)
 const results=await page.evaluate(async()=>{const root=await window.freya.folder();return window.freya.findFiles(root!,'objetivo')})
 expect(results.entries.map(e=>e.path)).toEqual([join(directory,'sub','nested','objetivo.md')]);expect(results.limited).toBe(false)
})

test('guardar como protege otro documento abierto',async()=>{
 const source=join(directory,'primero.md'),target=join(directory,'segundo.md');await writeFile(source,'original uno');await writeFile(target,'original dos')
 const [first]=await page.evaluate(paths=>window.freya.openPaths(paths),[source,target])
 await page.evaluate(id=>window.freya.update(id,'edición propia'),first.id)
 await app.evaluate((_,path)=>{process.env.FREYALAB_TEST_SAVE_PATH=path},target)
 await expect(page.evaluate(id=>window.freya.save(id,true),first.id)).rejects.toThrow('otro documento abierto')
 expect(await readFile(target,'utf8')).toBe('original dos');expect(await readFile(source,'utf8')).toBe('original uno')
})

test('reinterpretar CSV rechaza ediciones simultáneas y conserva todas las filas',async()=>{
 const file=join(directory,'opciones.csv');await writeFile(file,'Nombre,Valor\nFreya,01\nOtra,02\n')
 const result=await page.evaluate(async path=>{
  const [doc]=await window.freya.openPaths([path]);const original=await window.freya.tablePage(doc.id,{offset:0,limit:20,requestId:1})
  const options=window.freya.tableOptions(doc.id,{header:false})
  let rejected=false;try{await window.freya.tableEdit(doc.id,{type:'cell',rowId:original.rows[0].id,column:0,value:'NO'})}catch(error){rejected=String(error).includes('recarga')}
  await options;const page=await window.freya.tablePage(doc.id,{offset:0,limit:20,requestId:2});await window.freya.save(doc.id);return{rejected,page}
 },file)
 expect(result.rejected).toBe(true);expect(result.page.total).toBe(3);expect(result.page.rows[0].cells).toEqual(['Nombre','Valor']);expect(await readFile(file,'utf8')).not.toContain('NO')
})

test('PDF desde Markdown real conserva imagen local grande, fórmula y diagrama en varias páginas',async()=>{
 const file=join(directory,'completo.md'),image=await readFile(resolve('docs/design/freya-icon-original.png'));expect(image.byteLength).toBeGreaterThan(1024*1024);await writeFile(join(directory,'freya.png'),image)
 await writeFile(file,'# Documento completo\n\n![Freya](freya.png)\n\nFórmula $x^2$.\n\n```mermaid\nflowchart LR\n A[Recibir] --> B[Revisar]\n```\n\n'+Array.from({length:100},(_,i)=>`Párrafo ${i+1}: contenido para comprobar el paginado.\n\n`).join('')+'## Última hoja\n')
 await page.evaluate(path=>window.freya.openPaths([path]),file)
 await expect(page.locator('.markdown-body .katex')).toHaveCount(1);await expect(page.locator('.markdown-body .mermaid-render svg')).toBeVisible({timeout:40_000});await expect(page.locator('.markdown-body img')).toHaveAttribute('src',/^data:image\/png/)
 await page.getByRole('button',{name:'⇧ Exportar ▾',exact:true}).click();await page.getByRole('button',{name:'Documento PDF',exact:true}).click();await expect(page.locator('.toast')).toContainText('Exportado:',{timeout:30_000})
 const output=(await readdir(join(directory,'exports'))).find(name=>name.endsWith('.pdf'))!;const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(await readFile(join(directory,'exports',output))),useSystemFonts:true});const pdf=await task.promise
 try{expect(pdf.numPages).toBeGreaterThan(2);const texts:string[]=[];let images=0;for(let i=1;i<=pdf.numPages;i++){const sheet=await pdf.getPage(i);texts.push((await sheet.getTextContent()).items.map(item=>'str'in item?item.str:'').join(' '));images+=(await sheet.getOperatorList()).fnArray.filter(op=>op===OPS.paintImageXObject||op===OPS.paintInlineImageXObject).length}expect(texts.join(' ')).toMatch(/Recibir[\s\S]*Revisar/);expect(texts.at(-1)).toContain('Última hoja');expect(images).toBeGreaterThan(0)}finally{await task.destroy()}
})
