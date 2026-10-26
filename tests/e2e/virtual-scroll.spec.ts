import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {numericOrder} from './panel'

// Un millón de filas y una columna (unos 7 MB): por debajo de los límites de edición, pero con una altura de 32 000 040 px que un elemento de Chromium no admite.
const ROWS=1_000_000,CHROMIUM_MAX=16_777_214
let app:ElectronApplication,page:Page,folder:string,file:string
test.beforeAll(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-virtual-scroll-'));file=join(folder,'un-millon.csv');await writeFile(file,'Id\n'+Array.from({length:ROWS},(_,i)=>i+1).join('\n')+'\n')})
test.afterAll(async()=>{await rm(folder,{recursive:true,force:true})})
test.beforeEach(async()=>{
 await mkdir(join(folder,'saved'),{recursive:true});await mkdir(join(folder,'exports'),{recursive:true})
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 await page.evaluate(path=>window.freya.openPaths([path]),file);await expect(page.getByRole('grid')).toBeVisible()
 await expect.poll(()=>grid(e=>Number(e.getAttribute('aria-rowcount'))-1)).toBe(ROWS)
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{})})

const grid=<T,>(fn:(element:HTMLElement)=>T)=>page.getByRole('grid').evaluate(fn)
const scrollTo=(fraction:number)=>page.getByRole('grid').evaluate((element,f)=>{element.scrollTop=(element.scrollHeight-element.clientHeight)*f},fraction)
// Números de fila que se ven ahora (la columna # de las filas dibujadas dentro del visor) y su posición real.
const visible=()=>page.getByRole('grid').evaluate(element=>{
 const box=element.getBoundingClientRect(),header=element.querySelector('[role=columnheader]')?.getBoundingClientRect().height??40
 return [...element.querySelectorAll<HTMLElement>('.csv-row')].map(row=>({n:Number(row.querySelector('.row-number')!.textContent),top:row.getBoundingClientRect().top,bottom:row.getBoundingClientRect().bottom})).filter(row=>row.bottom>box.top+header&&row.top<box.bottom).sort((a,b)=>a.n-b.n)
})

test('se llega a la última fila de un millón de filas sin un elemento más alto que el límite de Chromium',async()=>{
 await scrollTo(1)
 await expect.poll(async()=>(await visible()).at(-1)?.n,{message:'última fila visible'}).toBe(ROWS)
 const sizes=await grid(element=>({scroll:element.scrollHeight,content:element.querySelector<HTMLElement>('.virtual-table')!.getBoundingClientRect().height}))
 expect(sizes.scroll).toBeLessThan(CHROMIUM_MAX);expect(sizes.content).toBeLessThan(CHROMIUM_MAX)
 const rows=await visible();expect(rows.length).toBeGreaterThan(10);expect(rows.map(row=>row.n)).toEqual(Array.from({length:rows.length},(_,i)=>rows[0].n+i)) // contiguas, sin huecos
})

test('Ctrl/⌘ + Fin lleva el foco a la última fila y la deja a la vista',async()=>{
 await page.locator('[role=gridcell][data-row="0"][data-column="0"]').click()
 await page.keyboard.press('ControlOrMeta+End')
 const last=page.locator(`[role=gridcell][data-row="${ROWS-1}"][data-column="0"]`)
 await expect(last).toBeFocused({timeout:15000})
 const [cell,box]=await Promise.all([last.boundingBox(),page.getByRole('grid').boundingBox()])
 expect(cell!.y).toBeGreaterThanOrEqual(box!.y);expect(cell!.y+cell!.height).toBeLessThanOrEqual(box!.y+box!.height+1)
})

test('a mitad del recorrido las filas son contiguas, están separadas 32 px y la posición es proporcional',async()=>{
 await scrollTo(0.5)
 await expect.poll(async()=>(await visible()).length).toBeGreaterThan(10)
 const rows=await visible()
 expect(rows[0].n).toBeGreaterThan(ROWS*0.49);expect(rows[0].n).toBeLessThan(ROWS*0.51)
 for(let i=1;i<rows.length;i++){expect(rows[i].n-rows[i-1].n).toBe(1);expect(Math.abs(rows[i].top-rows[i-1].top-32)).toBeLessThan(0.6)}
})

test('la selección sigue en su fila al alejarse y volver',async()=>{
 await page.locator('[role=gridcell][data-row="0"][data-column="0"]').click();await page.keyboard.press('ControlOrMeta+End')
 await expect(page.locator(`[role=gridcell][data-row="${ROWS-1}"][data-column="0"]`)).toBeFocused({timeout:15000})
 const selection=await page.locator('.csv-status').textContent();expect(selection).toContain('1000000')
 await scrollTo(0);await expect.poll(async()=>(await visible())[0]?.n).toBe(1)
 await scrollTo(1);await expect.poll(async()=>(await visible()).at(-1)?.n).toBe(ROWS)
 expect(await page.locator('.csv-status').textContent()).toBe(selection)
 await expect(page.locator(`[role=gridcell][data-row="${ROWS-1}"][data-column="0"]`)).toHaveAttribute('aria-selected','true')
})

test('una muesca de la rueda mueve las filas que dice la rueda, no miles',async()=>{
 await scrollTo(0.5);await expect.poll(async()=>(await visible()).length).toBeGreaterThan(10)
 await page.getByRole('grid').evaluate(element=>{const w=window as unknown as {__wheel:number[]};w.__wheel=[];element.addEventListener('wheel',event=>w.__wheel.push((event as WheelEvent).deltaY),true)})
 const before=(await visible())[0].n
 const box=(await page.getByRole('grid').boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,96)
 await expect.poll(async()=>(await visible())[0].n-before,{message:'filas desplazadas por la rueda'}).toBeGreaterThan(0)
 const delta=(await page.evaluate(()=>(window as unknown as {__wheel:number[]}).__wheel)).reduce((sum,value)=>sum+value,0) // px que informa el navegador (depende de la densidad de píxeles)
 const moved=(await visible())[0].n-before;expect(Math.abs(moved-delta/32)).toBeLessThanOrEqual(1.5)
})

test('con un filtro o un orden la tabla sigue siendo correcta',async()=>{
 const expected=Array.from({length:ROWS},(_,i)=>String(i+1)).filter(n=>n.includes('99999')).length
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('99999')
 await expect(page.locator('footer')).toContainText(`${expected.toLocaleString()} de ${ROWS.toLocaleString()} filas`,{timeout:30000})
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('')
 await expect(page.locator('footer')).toContainText(`${ROWS.toLocaleString()} de ${ROWS.toLocaleString()} filas`,{timeout:30000})
 await numericOrder(page);await page.locator('.sort-button').filter({hasText:/^Id/}).click();await page.locator('.sort-button').filter({hasText:/^Id/}).click() // descendente
 await expect.poll(async()=>page.locator('[role=gridcell][data-row="0"][data-column="0"]').innerText(),{timeout:30000}).toBe(String(ROWS))
 await scrollTo(1);await expect.poll(async()=>(await visible()).at(-1)?.n).toBe(ROWS)
 await expect(page.locator('[role=gridcell][data-column="0"]').last()).toHaveText('1')
})

test('recorrer el archivo entero deja ver todas las filas en orden y sin huecos',async()=>{
 // Siete posiciones repartidas: en cada una, filas contiguas y la primera visible donde corresponde a esa fracción del recorrido.
 for(const fraction of [0,0.1,0.25,0.5,0.75,0.9,1]){
  await scrollTo(fraction)
  await expect.poll(async()=>(await visible()).length,{message:`filas visibles en ${fraction}`}).toBeGreaterThan(10)
  const rows=await visible()
  expect(rows.map(row=>row.n),`contiguas en ${fraction}`).toEqual(Array.from({length:rows.length},(_,i)=>rows[0].n+i))
  const expected=fraction*(ROWS-rows.length);expect(Math.abs(rows[0].n-expected),`posición en ${fraction}`).toBeLessThan(ROWS*0.002)
  if(fraction===0)expect(rows[0].n).toBe(1);if(fraction===1)expect(rows.at(-1)!.n).toBe(ROWS)
 }
})

test('al cambiar el alto de la ventana con la barra escalada la última fila sigue alcanzable',async()=>{
 for(const height of [900,600,1200]){
  await page.setViewportSize({width:1440,height});await scrollTo(1)
  await expect.poll(async()=>(await visible()).at(-1)?.n,{message:`última fila con ${height} px`}).toBe(ROWS)
 }
})

test('al agrandar la ventana estando al final la última fila se queda a la vista sin volver a desplazar',async()=>{
 await scrollTo(1);await expect.poll(async()=>(await visible()).at(-1)?.n).toBe(ROWS)
 await page.setViewportSize({width:1440,height:1200}) // el navegador recorta scrollTop al nuevo máximo y la tabla cambia de escala
 await expect.poll(async()=>(await visible()).at(-1)?.n,{message:'última fila tras agrandar'}).toBe(ROWS)
})
