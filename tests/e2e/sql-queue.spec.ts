import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import type {DocumentInfo} from '../../src/shared/types'

let app:ElectronApplication,page:Page,folder:string
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-sql-queue-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true})})

const csv='Id,Ciudad,Valor\n'+Array.from({length:240},(_,i)=>`${i},C${i%5},${i%97}`).join('\n')+'\n'
const SQL='SELECT ciudad, count(*) AS n FROM datos GROUP BY 1 ORDER BY 1',ALL='SELECT * FROM datos ORDER BY CAST(id AS INTEGER)'
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
async function open(name='datos.csv',text=csv){const path=join(folder,name);await writeFile(path,text);return(await page.evaluate(path=>window.freya.openPaths([path]),path))[0]}
// Lanza un análisis sin esperarlo y devuelve cómo y cuándo termina.
const run=(doc:DocumentInfo,sql=SQL,requestId=crypto.randomUUID())=>({requestId,done:page.evaluate(({id,revision,requestId,sql})=>window.freya.sqlRun({requestId,sources:[{id,revision}],sql}).then(result=>({ok:true as const,rows:result.returnedRows,at:performance.now()}),error=>({ok:false as const,error:String(error.message??error),at:performance.now()})),{id:doc.id,revision:doc.revision,requestId,sql})})
const exportOnce=(doc:DocumentInfo)=>page.evaluate(doc=>window.freya.exportChartResult(doc.id,{requestId:crypto.randomUUID(),revision:doc.revision,format:'json',protectFormulas:true,configuration:{headers:doc.headers!,options:{kind:'bar',x:1,y:-1,bins:10,aggregate:'count',descending:false,measureType:'text'},where:{conditions:[],filterMode:'all'}}}).then(()=>({ok:true as const,at:performance.now()}),error=>({ok:false as const,error:String(error.message??error),at:performance.now()})),doc)
// Vigila cuántas ventanas hay: un motor de análisis es una ventana oculta, así que más de 2 significa dos motores a la vez.
function watchWindows(){let max=0,stop=false;const loop=(async()=>{while(!stop){max=Math.max(max,await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length));await sleep(20)}})();return{finish:async()=>{stop=true;await loop;return max}}}

test('un segundo análisis espera al primero: ninguno se cancela y nunca hay dos motores',async()=>{
 const doc=await open(),windows=watchWindows()
 const first=run(doc);await sleep(150);const second=run(doc,'SELECT count(*) AS total FROM datos')
 const [a,b]=await Promise.all([first.done,second.done]);const max=await windows.finish()
 expect(a).toMatchObject({ok:true,rows:5});expect(b).toMatchObject({ok:true,rows:1})
 expect(b.at).toBeGreaterThan(a.at);expect(max).toBeLessThanOrEqual(2)
})

test('el resultado paginable de un análisis sigue disponible mientras se ejecuta otro',async()=>{
 const doc=await open(),first=run(doc,ALL);expect(await first.done).toMatchObject({ok:true,rows:240})
 expect(await run(doc).done).toMatchObject({ok:true})
 const page2=await page.evaluate(id=>window.freya.sqlPage(id,100),first.requestId)
 expect(page2.offset).toBe(100);expect(page2.rows).toHaveLength(100);expect(page2.rows[0][0]).toBe('100')
})

test('cancelar un análisis en cola no toca el que está en curso ni arranca otro motor',async()=>{
 const doc=await open(),windows=watchWindows(),running=run(doc);await sleep(150);const queued=run(doc,'SELECT 1 AS uno')
 await sleep(100);await page.evaluate(id=>window.freya.sqlCancel(id),queued.requestId)
 const [a,b]=await Promise.all([running.done,queued.done]);const max=await windows.finish()
 expect(a).toMatchObject({ok:true,rows:5});expect(b).toMatchObject({ok:false,error:expect.stringContaining('Análisis cancelado.')});expect(max).toBeLessThanOrEqual(2)
})

test('cancelar el análisis en curso libera el motor y deja pasar al siguiente',async()=>{
 const doc=await open(),running=run(doc);await sleep(150);const next=run(doc,'SELECT 1 AS uno')
 await sleep(100);await page.evaluate(id=>window.freya.sqlCancel(id),running.requestId)
 const [a,b]=await Promise.all([running.done,next.done])
 expect(a).toMatchObject({ok:false,error:expect.stringContaining('Análisis cancelado.')});expect(b).toMatchObject({ok:true,rows:1})
 await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(1)
})

test('generar un gráfico y exportar sus resultados a la vez: ambos terminan',async()=>{
 const doc=await open(),chart=run(doc);await sleep(150);const exported=exportOnce(doc)
 const [a,b]=await Promise.all([chart.done,exported])
 expect(a).toMatchObject({ok:true});expect(b).toMatchObject({ok:true})
 expect(await readdir(join(folder,'exports'))).toHaveLength(1)
 const reverse=exportOnce(doc);await sleep(150);const chart2=run(doc,'SELECT count(*) AS total FROM datos')
 expect(await Promise.all([reverse,chart2.done])).toMatchObject([{ok:true},{ok:true}])
})

test('lo interactivo pasa por delante de una exportación que espera',async()=>{
 const doc=await open(),running=run(doc);await sleep(150);const exported=exportOnce(doc);await sleep(100);const interactive=run(doc,'SELECT count(*) AS total FROM datos')
 const [a,e,i]=await Promise.all([running.done,exported,interactive.done])
 expect([a.ok,e.ok,i.ok]).toEqual([true,true,true]);expect(a.at).toBeLessThan(i.at);expect(i.at).toBeLessThan(e.at)
})

test('solo se conservan los resultados más recientes',async()=>{
 const doc=await open(),ids:string[]=[]
 for(let n=0;n<6;n++){const request=run(doc,`SELECT ${n} AS n FROM datos LIMIT 1`);ids.push(request.requestId);expect(await request.done).toMatchObject({ok:true})}
 const pageOf=(id:string)=>page.evaluate(id=>window.freya.sqlPage(id,0).then(()=>'disponible',error=>String(error.message??error)),id)
 const state=await Promise.all(ids.map(pageOf))
 expect(state.slice(0,3).every(text=>text.includes('ya no está disponible'))).toBe(true);expect(state.slice(3)).toEqual(Array(3).fill('disponible'))
})

test('cerrar la aplicación con un análisis en curso y otro en cola termina sin motores huérfanos',async()=>{
 const doc=await open(),running=run(doc);await sleep(150);const queued=run(doc,'SELECT 1 AS uno'),settled=Promise.allSettled([running.done,queued.done]) // la página desaparece al salir
 const closed=app.waitForEvent('close',{timeout:15000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.isVisible())!.close()).catch(()=>{})
 await closed;await settled
})

test('muchas solicitudes a la vez: todas devuelven su resultado aunque superen los resultados que se conservan',async()=>{
 const doc=await open(),requests=Array.from({length:6},(_,n)=>run(doc,`SELECT ${n} AS n FROM datos LIMIT 1`))
 const outcomes=await Promise.all(requests.map(request=>request.done))
 expect(outcomes.map(outcome=>outcome.ok?'ok':outcome.error)).toEqual(Array(6).fill('ok'))
})

test('una exportación en cola no espera indefinidamente aunque sigan llegando consultas interactivas',async()=>{
 const doc=await open()
 const order=await page.evaluate(async doc=>{
  const done:string[]=[],sources=[{id:doc.id,revision:doc.revision}]
  const hold=window.freya.sqlRun({requestId:crypto.randomUUID(),sources,sql:'SELECT count(*) AS n FROM datos'}).then(()=>{done.push('inicial')})
  await new Promise(resolve=>setTimeout(resolve,150))
  const exported=window.freya.exportChartResult(doc.id,{requestId:crypto.randomUUID(),revision:doc.revision,format:'json',protectFormulas:true,configuration:{headers:doc.headers!,options:{kind:'bar',x:1,y:-1,bins:10,aggregate:'count',descending:false,measureType:'text'},where:{conditions:[],filterMode:'all'}}}).then(()=>{done.push('exportación')})
  // Dos paneles que lanzan otra consulta en cuanto termina la suya: siempre hay una interactiva esperando.
  const chain=async(panel:string)=>{for(let n=0;n<5;n++){await window.freya.sqlRun({requestId:crypto.randomUUID(),sources,sql:`SELECT '${panel}${n}' AS tag FROM datos LIMIT 1`});done.push(`${panel}${n}`)}}
  await Promise.all([hold,chain('sql'),chain('gráfico'),exported]);return done
 },doc)
 // En cola detrás de la inicial: la adelantan como mucho dos interactivas (una por panel que puede tener una pendiente).
 expect(order.indexOf('exportación'),order.join(' > ')).toBeLessThanOrEqual(3)
})

test('cerrar un documento cancela sus solicitudes en cola sin esperar su turno',async()=>{
 const crossJoin='SELECT count(*) AS n FROM datos a, datos b, datos c',long=await open('larga.csv','Id,Ciudad,Valor\n'+Array.from({length:4000},(_,i)=>`${i},C${i%5},${i%97}`).join('\n')+'\n'),other=await open('otra.csv')
 const running=run(long,crossJoin);await sleep(400);const queued=run(other);await sleep(100)
 await page.evaluate(id=>window.freya.close(id),other.id)
 const outcome=await Promise.race([queued.done.then(result=>result.ok?'ok':result.error),sleep(2000).then(()=>'sigue esperando')])
 await page.evaluate(id=>window.freya.sqlCancel(id),running.requestId);await running.done
 expect(outcome).toContain('Análisis cancelado.')
})
