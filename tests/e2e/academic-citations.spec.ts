import {test,expect,_electron as electron} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

test('AC-03 · citas, problemas y recarga bibliográfica conservan el archivo',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'freya-ac03-')),path=join(directory,'reporte.md'),library=join(directory,'referencias.json')
 const source='---\nbibliography: referencias.json\nlof: true\n---\n\n# Reporte\n\nVéase [@garcia2020, p. 10] y [@ausente].\n\n`[@garcia2020]`\n\n![Datos [@garcia2020]](figura.svg){#fig:datos}'
 const entries=[{id:'garcia2020',type:'book',title:'Una fuente local',author:[{family:'García'}],issued:{'date-parts':[[2020]]}}]
 await writeFile(path,source);await writeFile(library,JSON.stringify(entries));await writeFile(join(directory,'figura.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><rect width="200" height="80" fill="#1670be"/></svg>')
 const{ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 const app=await electron.launch({chromiumSandbox:true,executablePath:electronPath as unknown as string,args:[process.env.FREYALAB_AC_TEST_ENTRY??resolve('out/main/index.js')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile')}})
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
  const[document]=await page.evaluate(path=>window.freya.openPaths([path]),path)
  const article=page.locator('.preview article')
  await expect(article.locator('#citation-1')).toHaveText('(García, 2020, p. 10)')
  await expect(article.locator('.citation-missing')).toHaveText('(@ausente)')
  await expect(article.locator('.document-bibliography')).toContainText('Una fuente local')
  const warnings=page.getByLabel('Advertencias del documento',{exact:true});await warnings.locator('summary').click();await expect(warnings).toContainText('ausente');await expect(warnings).toContainText('sin estilo final')
  await expect(article.locator('code')).toHaveText('[@garcia2020]')
  for(const theme of ['light','dark']){
   await page.getByLabel('Tema',{exact:true}).selectOption(theme);await expect(article.locator('#citation-1')).toHaveText('(García, 2020, p. 10)');await expect(page.locator('.render-progress')).toHaveCount(0)
   if(process.env.FREYALAB_AC_EVIDENCE==='1')await page.screenshot({path:`docs/evidence/ac-03-${theme}-1440x900.png`,animations:'disabled'})
  }
  await writeFile(library,JSON.stringify([{...entries[0],author:[{family:'Chen'}]}]))
  await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText('\n\nTexto nuevo.')
  await expect(article.locator('#citation-1')).toHaveText('(Chen, 2020, p. 10)')
  await expect(article.locator('.report-figures a')).toHaveText('Figura 1. Datos (Chen, 2020)')
  expect(await readFile(path,'utf8')).toBe(source)
  const current=await page.evaluate(async id=>(await window.freya.documents()).find(document=>document.id===id),document.id)
  expect(current?.text).toBe(source+'\n\nTexto nuevo.');expect(current?.dirty).toBe(true)
  const before=source+'\n\nTexto nuevo.'
  // Enter debe aceptar la opción visible aunque no haya avanzado el reloj.
  await page.evaluate(()=>{const now=Date.now();Date.now=()=>now})
  for(const theme of ['light','dark']){
   await page.getByLabel('Tema',{exact:true}).selectOption(theme)
   await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText('\n\n[@gar')
   await expect(page.getByRole('option',{name:/garcia2020/})).toBeVisible()
   if(process.env.FREYALAB_AC_EVIDENCE==='1')await page.screenshot({path:`docs/evidence/ac-03-completion-${theme}-1440x900.png`,animations:'disabled'})
   await page.keyboard.press('Enter')
   await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.id===document.id)?.text).toBe(before+'\n\n[@garcia2020]')
   await page.keyboard.press('ControlOrMeta+Z')
   await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.id===document.id)?.text).toBe(before+'\n\n[@gar')
   await page.keyboard.press('ControlOrMeta+Z')
   await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.id===document.id)?.text).toBe(before)
  }
  expect(await readFile(path,'utf8')).toBe(source)
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})

test('AC-03 · HTML y PDF sin Pandoc usan la biblioteca actual aunque el Markdown no cambie',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'freya-ac03-fresh-')),path=join(directory,'reporte.md'),library=join(directory,'referencias.json'),source='---\nbibliography: referencias.json\n---\n\n# Reporte\n\n[@garcia2020]'
 const entry={id:'garcia2020',type:'book',title:'Fuente actual',author:[{family:'García'}],issued:{'date-parts':[[2020]]}}
 await writeFile(path,source);await writeFile(library,JSON.stringify([entry]))
 const{ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 const app=await electron.launch({chromiumSandbox:true,executablePath:electronPath as unknown as string,args:[resolve('out/main/index.js')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_TEST_PANDOC_PATH:join(directory,'pandoc-inexistente'),FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:directory}})
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
  await expect(page.locator('.preview #citation-1')).toHaveText('(García, 2020)')
  const updated=JSON.stringify([{...entry,title:'Fuente revisada',author:[{family:'Chen'}],issued:{'date-parts':[[2024]]}}]);await writeFile(library,updated)
  for(const format of ['html','pdf'] as const){
   await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:format==='html'?'HTML autónomo':'Documento PDF',exact:true}).click()
   const output=join(directory,'reporte.'+format);await expect.poll(async()=>readFile(output).catch(()=>null)).not.toBeNull();const bytes=await readFile(output)
   if(format==='html'){const labels=await page.evaluate(html=>{const document=new DOMParser().parseFromString(html,'text/html');return{citation:document.getElementById('citation-1')?.textContent,references:document.getElementById('document-bibliography')?.textContent}},bytes.toString());expect(labels.citation).toBe('(Chen, 2024)');expect(labels.references).toContain('Chen (2024). Fuente revisada');expect(labels.references).not.toContain('García (2020)')}
   else{const{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});try{const pdf=await loading.promise,parts:string[]=[];for(let n=1;n<=pdf.numPages;n++)parts.push((await(await pdf.getPage(n)).getTextContent()).items.map(item=>'str'in item?item.str:'').join(' '));expect(parts.join(' ')).toContain('(Chen, 2024)');expect(parts.join(' ')).toContain('Fuente revisada');expect(parts.join(' ')).not.toContain('(García, 2020)')}finally{await loading.destroy()}}
  }
  expect((await page.evaluate(()=>window.freya.documents())).find(current=>current.id===doc.id)).toMatchObject({text:source,dirty:false});expect(await readFile(path,'utf8')).toBe(source);expect(await readFile(library,'utf8')).toBe(updated)
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})
