import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {resolve,dirname,join} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {cpus,totalmem} from 'node:os'
const root=resolve(process.argv[2]??process.cwd()),phase=process.argv[3],here=dirname(fileURLToPath(import.meta.url)),destination=join(here,phase??'')
assert(['before','after'].includes(phase),'Fase before/after requerida')
assert.equal(process.versions.node.split('.')[0],'24')
const require=createRequire(join(root,'package.json')),hash=value=>createHash('sha256').update(value).digest('hex'),run=promisify(execFile),modulePath=join(root,'src/renderer/lib/render.ts')
const source=phase==='before'?(await run('git',['show','33a5dfd:src/renderer/lib/render.ts'],{cwd:root})).stdout:await readFile(modulePath,'utf8')
await mkdir(destination,{recursive:true})
const input=join(destination,'index.html'),csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'"
await writeFile(input,`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><script type="module" src="../entry.mjs"></script>`)
const {build}=await import(pathToFileURL(require.resolve('vite')).href)
await build({configFile:false,root:destination,base:'./',plugins:[{name:'render-under-test',enforce:'pre',resolveId(id){if(id==='render-under-test')return modulePath},load(id){if(id===modulePath)return source}}],build:{outDir:join(destination,'bundle'),emptyOutDir:true,minify:false,rollupOptions:{input}}})
const {_electron:electron}=require('@playwright/test'),electronPath=require('electron'),{ELECTRON_RUN_AS_NODE:_,...env}=process.env
const app=await electron.launch({chromiumSandbox:true,executablePath:electronPath,args:[join(root,'experiments/mermaid-validation/window-main.cjs')],env:{...env,FREYALAB_RACE_HTML:join(destination,'bundle','index.html'),FREYALAB_HARNESS_PROFILE:join(destination,'profile')}})
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>typeof window.measureAcademicRender==='function')
 const measurement=await page.evaluate(()=>window.measureAcademicRender())
 const result={phase,baseline:'33a5dfd',sourceSHA256:hash(source),lockSHA256:hash(await readFile(join(root,'package-lock.json'))),machine:{platform:process.platform,arch:process.arch,cpu:cpus()[0].model,ramBytes:totalmem()},versions:await app.evaluate(()=>process.versions),...measurement}
 assert.equal(measurement.isolated.node,'undefined');assert.equal(measurement.isolated.bridge,'undefined');assert.equal(measurement.headings,20)
 if(phase==='after'){assert.equal(measurement.figures,20);assert.equal(measurement.tables,20);assert.deepEqual(measurement.warnings,[])}
 await writeFile(join(destination,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
