import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {resolve,dirname,join} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
const root=resolve(process.argv[2]??process.cwd()),phase=process.argv[3]??'before',here=dirname(fileURLToPath(import.meta.url)),destination=join(here,phase)
assert(['before','after'].includes(phase))
const require=createRequire(join(root,'package.json')),hash=value=>createHash('sha256').update(value).digest('hex'),run=promisify(execFile)
const modulePath=join(root,'src/renderer/lib/render.ts')
const source=phase==='before'?(await run('git',['show','4358d91:src/renderer/lib/render.ts'],{cwd:root})).stdout:await readFile(modulePath,'utf8')
await mkdir(destination,{recursive:true})
const input=join(destination,'index.html'),csp='default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; font-src \'self\' data:; connect-src \'self\'; object-src \'none\'; base-uri \'none\''
await writeFile(input,`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Mermaid real ${phase}</title><script type="module" src="../race-entry.mjs"></script>`)
const {build}=await import(pathToFileURL(require.resolve('vite')).href)
await build({configFile:false,root:destination,base:'./',plugins:[{name:'render-under-test',enforce:'pre',resolveId(id){if(id==='render-under-test')return modulePath},load(id){if(id===modulePath)return source}}],build:{outDir:join(destination,'bundle'),emptyOutDir:true,minify:false,rollupOptions:{input}}})
const {_electron:electron}=require('@playwright/test'),electronPath=require('electron'),{ELECTRON_RUN_AS_NODE:_,...env}=process.env
const app=await electron.launch({chromiumSandbox:true,executablePath:electronPath,args:[join(here,'window-main.cjs')],env:{...env,FREYALAB_RACE_HTML:join(destination,'bundle','index.html'),FREYALAB_HARNESS_PROFILE:join(destination,'profile')}}).catch(async error=>{throw new Error('Harness launch failed: '+error.message)})
const result={phase,sourceSHA256:hash(source),lockSHA256:hash(await readFile(join(root,'package-lock.json'))),versions:await app.evaluate(()=>process.versions),cases:[]}
let failure
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>typeof window.runRealRace==='function')
 for(const kind of ['render-render','render-validate']){
  if(result.cases.length){await page.reload();await page.waitForFunction(()=>typeof window.runRealRace==='function')}
  const measurement=await page.evaluate(kind=>window.runRealRace(kind),kind);result.cases.push(measurement)
  await page.screenshot({path:join(destination,`${kind}.png`)})
  for(const sample of [measurement.light,measurement.controlLight,measurement.cached])for(const count of Object.values(sample.counts))assert(count>0,'text, edges and arrows must be measured')
  assert.equal(measurement.isolated.node,'undefined');assert.equal(measurement.isolated.bridge,'undefined');assert.equal(measurement.cacheExact,true)
  if(!measurement.lightMatchesControl||measurement.darkMatchesControl===false||!measurement.cachedMatchesControl)failure=new Error('Concurrent theme or cached SVG differs from serial controls')
  if(Object.values(measurement.light.minimum).some(value=>value<4.5))failure=new Error('Concurrent light SVG has contrast below 4.5 against white')
 }
}finally{
 await writeFile(join(destination,'result.json'),JSON.stringify(result,null,2)+'\n')
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})
}
if(failure)throw failure
console.log(JSON.stringify(result,null,2))
