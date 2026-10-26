import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

// Desplazamiento virtual con varias columnas (virtual-scroll.spec.ts usa una sola). El recuento de celdas incluye el encabezado: 249 999 filas × 8 columnas son
// exactamente 2 000 000 (el máximo editable; con 250 000 el archivo ya se abre en modo grande) y no llegan al tope de altura, así que la barra no se escala. Con la barra
// escalada (más de unas 468 750 filas de 32 px) lo editable llega a 999 999 filas × 2 columnas; con más columnas hace falta el modo grande, que aquí se fuerza con FREYALAB_LARGE_BYTES.
const cases=[
 {name:'editable · 999 999 filas × 2 columnas (barra escalada)',ROWS:999_999,COLS:2,WIDTH:600,large:false},
 {name:'editable · 249 999 filas × 8 columnas (límite de celdas)',ROWS:249_999,COLS:8,WIDTH:1000,large:false},
 {name:'grande · 700 000 filas × 8 columnas (barra escalada)',ROWS:700_000,COLS:8,WIDTH:1000,large:true}
]
for(const {name,ROWS,COLS,WIDTH,large} of cases)test.describe(name,()=>{
 let app:ElectronApplication,page:Page,folder:string,file:string
 test.beforeAll(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-virtual-columns-'));file=join(folder,'tabla.csv');await writeFile(file,Array.from({length:COLS},(_,j)=>`c${j+1}`).join(',')+'\n'+Array.from({length:ROWS},(_,i)=>Array(COLS).fill(i+1).join(',')).join('\n')+'\n')})
 test.afterAll(async()=>{await rm(folder,{recursive:true,force:true})})
 test.beforeEach(async()=>{
  await mkdir(join(folder,'saved'),{recursive:true});await mkdir(join(folder,'exports'),{recursive:true})
  const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
  app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',...(large?{FREYALAB_LARGE_BYTES:'1024'}:{}),FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000})
  page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:WIDTH,height:900}) // lo bastante estrecha para que la última columna empiece fuera de la vista
  const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),file);expect(Boolean(doc.large),'camino de apertura').toBe(large);expect(doc.rowCount).toBe(ROWS)
  await expect(page.getByRole('grid')).toBeVisible();await expect.poll(()=>grid(e=>Number(e.getAttribute('aria-rowcount'))-1)).toBe(ROWS)
 })
 test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{})})

 const grid=<T,>(fn:(element:HTMLElement)=>T)=>page.getByRole('grid').evaluate(fn)
 const scrollTo=(fraction:number)=>page.getByRole('grid').evaluate((element,f)=>{element.scrollTop=(element.scrollHeight-element.clientHeight)*f},fraction)
 // Filas visibles ahora: su número (columna #), su posición y el texto de su celda en la última columna (si está dibujada).
 const visible=()=>page.getByRole('grid').evaluate((element,column)=>{
  const box=element.getBoundingClientRect(),header=element.querySelector('[role=columnheader]')?.getBoundingClientRect().height??40
  return [...element.querySelectorAll<HTMLElement>('.csv-row')].map(row=>({n:Number(row.querySelector('.row-number')!.textContent),top:row.getBoundingClientRect().top,bottom:row.getBoundingClientRect().bottom,last:row.querySelector(`[data-column="${column}"]`)?.textContent?.trim()})).filter(row=>row.bottom>box.top+header&&row.top<box.bottom).sort((a,b)=>a.n-b.n)
 },COLS-1)
 const lastRow=async()=>(await visible()).at(-1)?.n

 test('la última fila es alcanzable y las filas visibles son contiguas',async()=>{
  await scrollTo(1)
  await expect.poll(lastRow,{message:'última fila visible'}).toBe(ROWS)
  const rows=await visible();expect(rows.length).toBeGreaterThan(10);expect(rows.map(row=>row.n)).toEqual(Array.from({length:rows.length},(_,i)=>rows[0].n+i))
 })

 test('ir a la última columna no rompe el desplazamiento vertical',async()=>{
  expect(await grid(e=>e.scrollWidth>e.clientWidth),'la última columna empieza fuera de la vista').toBe(true)
  await grid(e=>{e.scrollLeft=e.scrollWidth})
  await expect(page.getByRole('columnheader').filter({hasText:`c${COLS}`})).toBeVisible()
  for(const fraction of [0,0.5,1,0.25]){
   await scrollTo(fraction)
   await expect.poll(async()=>{const rows=await visible();return rows.length>10&&Math.abs(rows[0].n-fraction*(ROWS-rows.length))<ROWS*0.002},{message:`posición en ${fraction}`}).toBe(true)
   const rows=await visible()
   expect(rows.map(row=>row.n),`contiguas en ${fraction}`).toEqual(Array.from({length:rows.length},(_,i)=>rows[0].n+i))
   expect(rows.map(row=>row.last),`celda de la última columna en ${fraction}`).toEqual(rows.map(row=>String(row.n)))
   if(fraction===0)expect(rows[0].n).toBe(1);if(fraction===1)expect(rows.at(-1)!.n).toBe(ROWS)
  }
  await grid(e=>{e.scrollLeft=0});await scrollTo(1)
  await expect.poll(lastRow,{message:'última fila tras volver a la primera columna'}).toBe(ROWS)
  await expect(page.locator(`.csv-cell[data-row="${ROWS-1}"][data-column="0"]`)).toHaveText(String(ROWS))
 })

 test('al cambiar el alto de la ventana la última fila sigue alcanzable',async()=>{
  for(const height of [900,600,1200]){
   await page.setViewportSize({width:WIDTH,height});await scrollTo(1)
   await expect.poll(lastRow,{message:`última fila con ${height} px`}).toBe(ROWS)
  }
 })

 test('al agrandar la ventana estando al final la última fila se queda a la vista sin volver a desplazar',async()=>{
  await scrollTo(1);await expect.poll(lastRow).toBe(ROWS)
  await page.setViewportSize({width:WIDTH,height:1200})
  await expect.poll(lastRow,{message:'última fila tras agrandar'}).toBe(ROWS)
 })
})
