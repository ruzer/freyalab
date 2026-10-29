import {mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises'
import {join,resolve,basename,dirname} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {cpus,totalmem,release,arch,platform,availableParallelism} from 'node:os'
import assert from 'node:assert/strict'
import {prepareFixture,sha256} from './generate.mjs'
const exec=promisify(execFile),here=dirname(fileURLToPath(import.meta.url))
const [mode,...args]=process.argv.slice(2),option=(name,fallback)=>{const at=args.indexOf(name);return at<0?fallback:args[at+1]}
assert(['calibrate','measure'].includes(mode),'Uso: node measure.mjs calibrate|measure --lease TOKEN --worktree RUTA --pandoc RUTA [--soffice RUTA]')
assert(option('--lease',''),'No ejecutar sin una concesión explícita y vigente de CPU/Electron por el coordinador.')
const worktree=resolve(option('--worktree','/private/tmp/freyalab-lote2/citas-exportar')),root=resolve(option('--root',here)),pandoc=resolve(option('--pandoc','/opt/homebrew/bin/pandoc')),soffice=option('--soffice','/Applications/LibreOffice.app/Contents/MacOS/soffice')
const require=createRequire(join(worktree,'package.json')),{_electron:electron}=require('@playwright/test'),electronPath=require('electron')
const run=join(root,`${mode}-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(run,{recursive:true})
const sleep=ms=>new Promise(done=>setTimeout(done,ms)),save=async(name,value)=>writeFile(join(run,name),JSON.stringify(value,null,2)+'\n')
async function filesUnder(directory){const result=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())result.push(...await filesUnder(path));else if(entry.isFile())result.push(path)}return result.sort()}
async function snapshot(){
 const files=[...await filesUnder(join(worktree,'src')),...await filesUnder(join(worktree,'out')),join(worktree,'package.json'),join(worktree,'package-lock.json'),join(worktree,'electron.vite.config.ts')],hashes={}
 for(const path of files)hashes[path.slice(worktree.length+1)]=sha256(await readFile(path))
 return{head:(await exec('git',['rev-parse','HEAD'],{cwd:worktree})).stdout.trim(),branch:(await exec('git',['branch','--show-current'],{cwd:worktree})).stdout.trim(),hashes,fingerprint:sha256(JSON.stringify(hashes))}
}
async function inputSnapshot(directory){const files={};for(const name of ['informe.md','referencias.json','grafico.svg']){const path=join(directory,name),info=await stat(path);files[name]={sha256:sha256(await readFile(path)),bytes:info.size,mtimeMs:info.mtimeMs,ino:info.ino}}return files}
async function waitFor(check,timeout=180000){const start=performance.now();while(!await check()){if(performance.now()-start>timeout)throw new Error('El flujo no completó dentro del plazo del arnés.');await sleep(5)}}
async function pdfReport(path){
 const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href),bytes=await readFile(path),loading=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true})
 try{const pdf=await loading.promise,text=[];for(let i=1;i<=pdf.numPages;i++){const content=await(await pdf.getPage(i)).getTextContent();text.push(content.items.map(item=>'str'in item?item.str:'').join(' ').replace(/\s+/g,' '))}return{pages:pdf.numPages,bytes:bytes.length,sha256:sha256(bytes),pageText:text,textSha256:sha256(text.join('\n'))}}finally{await loading.destroy()}
}
async function exportFromApp(directory,formats){
 const before=await inputSnapshot(directory),source=await readFile(join(directory,'informe.md'),'utf8'),output=join(directory,'exported');await mkdir(output,{recursive:true})
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env,start=performance.now()
 const app=await electron.launch({chromiumSandbox:true,executablePath:electronPath,args:[join(worktree,'out/main/index.js')],env:{...environment,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_TEST_PANDOC_PATH:pandoc,FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:output}})
 try{
  const appInfo=await app.evaluate(({app})=>({version:app.getVersion(),versions:process.versions,architecture:process.arch})),page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900});await page.getByLabel('Tema',{exact:true}).selectOption('light')
  const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),join(directory,'informe.md'))
  await page.waitForFunction(()=>{const article=document.querySelector('.preview article');return article?.textContent?.includes('FIN-REPORTE-SINTETICO')&&!document.querySelector('.render-progress')&&document.querySelectorAll('.preview .mermaid-render svg').length===3&&document.querySelector('.preview #citation-1')?.textContent?.includes('García')&&Array.from(article.querySelectorAll('img')).every(image=>image.complete&&image.naturalWidth>0)},{},{timeout:180000})
  const openAndReadyMs=performance.now()-start,exports=[]
  for(const format of formats){
   const path=join(output,`informe.${format}`);assert(!await stat(path).catch(()=>null),'Cada muestra necesita un destino nuevo.')
   await page.getByRole('button',{name:'Exportar',exact:true}).click()
   const button=page.getByRole('button',{name:format==='pdf'?'Documento PDF':'Documento Word (DOCX)',exact:true});await button.waitFor({state:'visible'});await waitFor(async()=>!await button.isDisabled())
   const began=performance.now();await button.click()
   await waitFor(async()=>{const info=await stat(path).catch(()=>null);return !!info&&info.size>0})
   await page.waitForFunction(name=>Array.from(document.querySelectorAll('.toast')).some(node=>node.textContent?.includes(name)),basename(path),{timeout:180000})
   const elapsedMs=performance.now()-began,bytes=await readFile(path)
   assert(format==='pdf'?bytes.subarray(0,5).toString()==='%PDF-':bytes.subarray(0,4).equals(Buffer.from('PK\x03\x04')))
   exports.push({format,path,elapsedMs,bytes:bytes.length,sha256:sha256(bytes)})
  }
  const unchanged=await page.evaluate(({id,source})=>window.freya.documents().then(docs=>{const current=docs.find(doc=>doc.id===id);return current?.text===source&&!current?.dirty}),{id:doc.id,source});assert(unchanged,'El documento abierto cambió durante la exportación.')
  assert.deepEqual(await inputSnapshot(directory),before,'Los archivos fuente cambiaron durante la exportación.')
  return{appInfo,openAndReadyMs,exports,originalsUnchanged:true,inputs:before}
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
}
const before=await snapshot(),hardware={platform:platform(),release:release(),arch:arch(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,availableParallelism:availableParallelism(),memoryBytes:totalmem(),node:process.version},pandocVersion=(await exec(pandoc,['--version'],{timeout:10000,maxBuffer:1048576})).stdout.split(/\r?\n/)[0]
const report={mode,run,startedUTC:new Date().toISOString(),lease:option('--lease',''),hardware,pandoc:{path:pandoc,version:pandocVersion},snapshotBefore:before,method:'Formato-click a archivo completo y notificación de la API real desde la interfaz; apertura aparte. Sin purgar caché del SO.'};await save('result.json',report)
try{
 if(mode==='calibrate'){
  const trials=[],target=50;let low=-1,high=-1,next=0,found
  for(let trial=0;trial<14;trial++){
   const directory=join(run,`paragraphs-${next}`);await prepareFixture(directory,next);const actual=await exportFromApp(directory,['pdf']),pdf=await pdfReport(actual.exports[0].path);trials.push({extraParagraphs:next,pages:pdf.pages,app:actual,pdf});report.trials=trials;await save('result.json',report);console.log(JSON.stringify({trial,extraParagraphs:next,pages:pdf.pages,calibrationOnly:true}))
   if(pdf.pages===target){found={directory,extraParagraphs:next,source:await readFile(join(directory,'fixture-manifest.json'),'utf8'),pdf};break}
   if(next===0&&pdf.pages>target)throw new Error('El corpus fijo ya supera 50 páginas; no se fuerza su paginación.')
   if(pdf.pages<target)low=Math.max(low,next);else high=high<0?next:Math.min(high,next)
   if(high<0)next=next===0?200:next*2;else{if(high-low<=1)break;next=Math.floor((low+high)/2)}
   assert(next<=2000,'Se alcanzó el límite de corpus del arnés.')
  }
  assert(found,'La calibración no produjo exactamente 50 páginas; conservar intentos y consultar antes de modificar el corpus.')
  const fixture=join(root,'frozen-fixture');assert(!await stat(fixture).catch(()=>null),'No sobrescribir un fixture ya congelado. Usa otro --root o archiva conscientemente el anterior.')
  const manifest=await prepareFixture(fixture,found.extraParagraphs);assert(manifest.files['informe.md'].sha256===JSON.parse(found.source).files['informe.md'].sha256)
  await writeFile(join(fixture,'calibrated.json'),JSON.stringify({targetPDFPages:50,extraParagraphs:found.extraParagraphs,calibratedAgainst:before.fingerprint,calibrationRun:run,observedPDF:found.pdf,fixture:manifest},null,2)+'\n')
  report.frozenFixture=fixture
 }else{
  const frozen=join(root,'frozen-fixture'),calibrated=JSON.parse(await readFile(join(frozen,'calibrated.json'),'utf8'));assert(calibrated.targetPDFPages===50);assert.equal(calibrated.calibratedAgainst,before.fingerprint,'La fuente o el build cambiaron: no usar una calibración anterior.')
  const sofficeInfo=await stat(soffice);assert(sofficeInfo.isFile(),'Se necesita LibreOffice existente para contar las páginas reales del DOCX de forma independiente.')
  report.libreOffice={path:soffice,version:(await exec(soffice,['--headless',`-env:UserInstallation=${pathToFileURL(join(run,'version-profile')).href}`,'--version'],{timeout:10000,maxBuffer:1048576})).stdout.trim()};report.samples=[]
  for(let sample=1;sample<=3;sample++){
   const directory=join(run,`sample-${sample}`),manifest=await prepareFixture(directory,calibrated.extraParagraphs);assert.deepEqual(manifest.files,calibrated.fixture.files)
   const app=await exportFromApp(directory,['pdf','docx']),pdf=await pdfReport(app.exports.find(item=>item.format==='pdf').path);assert.equal(pdf.pages,50,'El PDF medido no tiene exactamente 50 páginas.');assert(pdf.pageText.join(' ').includes('FIN-REPORTE-SINTETICO'),'Falta el final del documento en el PDF.')
   const docx=app.exports.find(item=>item.format==='docx'),docxBytesBefore=await readFile(docx.path),independent=join(directory,'libreoffice-pdf');await mkdir(independent,{recursive:true});const began=performance.now()
   const converted=await exec(soffice,['--headless',`-env:UserInstallation=${pathToFileURL(join(directory,'lo-profile')).href}`,'--convert-to','pdf:writer_pdf_Export','--outdir',independent,docx.path],{timeout:180000,maxBuffer:1048576}),independentRenderMs=performance.now()-began,docxPDF=await pdfReport(join(independent,'informe.pdf'))
   assert.equal(sha256(await readFile(docx.path)),sha256(docxBytesBefore),'LibreOffice modificó el DOCX exportado.');assert(docxPDF.pageText.join(' ').includes('FIN-REPORTE-SINTETICO'),'Falta el final del documento en el DOCX abierto por LibreOffice.')
   const row={sample,app,pdf,docxIndependentPagination:{engine:'LibreOffice',pages:docxPDF.pages,pdf:docxPDF,renderMs:independentRenderMs,conversionOutput:converted.stdout.trim(),docxUnchanged:true}};report.samples.push(row);await save('result.json',report);console.log(JSON.stringify({sample,pdfPages:pdf.pages,docxPagesInLibreOffice:docxPDF.pages,exports:app.exports.map(({format,elapsedMs})=>({format,elapsedMs}))}))
  }
  const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];report.mediansMs={pdf:median(report.samples.map(row=>row.app.exports.find(item=>item.format==='pdf').elapsedMs)),docx:median(report.samples.map(row=>row.app.exports.find(item=>item.format==='docx').elapsedMs))}
 }
 report.snapshotAfter=await snapshot();assert.deepEqual(report.snapshotAfter,before,'La fuente o el build cambió durante la comprobación.');report.status='complete';report.finishedUTC=new Date().toISOString();await save('result.json',report)
}catch(error){report.status='failed';report.error=String(error);report.snapshotAfter=await snapshot();await save('result.json',report);throw error}
console.log(JSON.stringify({status:report.status,run,mediansMs:report.mediansMs??null,frozenFixture:report.frozenFixture??null}))
