import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
let app:ElectronApplication,page:Page,folder:string,target:string,selected:string
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6X8sAAAAASUVORK5CYII=','base64')
const article=()=>page.locator('.preview article.markdown-body')
const current=(id:string)=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),id)
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-assets-'));await mkdir(join(folder,'origen'));await mkdir(join(folder,'destino'));await mkdir(join(folder,'exports'))
 target=join(folder,'destino','Copia á.md');selected=join(folder,'elegida.png');await writeFile(selected,png)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_PATH:target,FREYALAB_TEST_IMAGE_PATH:selected,FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(text:string,name='a.md'){
 const path=join(folder,'origen',name);await writeFile(path,text)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.locator('.cm-content')).toBeVisible();return{path,doc}
}
async function loaded(count=1){await expect(article().locator('img')).toHaveCount(count);await expect.poll(()=>article().locator('img').evaluateAll(images=>images.length>0&&images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true)}
async function fixture(){
 await mkdir(join(folder,'origen','a.assets'));for(const name of ['uno.png','dos.png','tres.png'])await writeFile(join(folder,'origen','a.assets',name),png)
 return '# Informe\r\n\r\n![Árbol](a.assets/uno.png)\r\n\r\n<details><summary>Más</summary>\r\n\r\n![Segundo](a.assets/dos.png)\r\n\r\n</details>\r\n\r\n![Tercero][tercero]\r\n\r\n[tercero]: a.assets/tres.png "Título"\r\n'
}
test('A1 A2 · Guardar como copia tres activos; cerrar y reabrir prueba que las imágenes siguen resolviéndose',async()=>{
 const source=await fixture(),{path,doc}=await open(source);await expect(article().locator('img')).toHaveCount(3);await loaded(3)
 await page.getByRole('button',{name:'Guardar como',exact:true}).click();await expect(page.locator('.toast')).toContainText('Se copiaron 3 imágenes')
 const saved=(await current(doc.id))!,text=await readFile(target,'utf8')
 expect(saved.dirty).toBe(false);expect(saved.text).toBe(text);expect(text).toBe(source.replaceAll('a.assets','Copia%20%C3%A1.assets'))
 await page.getByRole('button',{name:`Cerrar ${saved.name}`,exact:true}).click()
 await page.evaluate(path=>window.freya.openPaths([path]),target);await expect(article().locator('img')).toHaveCount(3);await loaded(3)
 expect(await readFile(path,'utf8')).toBe(source)
 for(const name of ['uno.png','dos.png','tres.png']){expect(await readFile(join(folder,'origen','a.assets',name))).toEqual(png);expect(await readFile(join(folder,'destino','Copia á.assets',name))).toEqual(png)}
})
test('Buscar · el marcador permite elegir, copiar, deshacer y rehacer sin modificar el Markdown original en disco',async()=>{
 const source='# Sin imagen\n\n![Gráfico](a.assets/ausente.png "Descripción")\n',{path,doc}=await open(source)
 const locate=article().getByRole('button',{name:/Buscar imagen.*Gráfico/});await expect(locate).toBeVisible()
 for(const theme of ['light','dark']){await page.getByLabel('Tema',{exact:true}).selectOption(theme);await expect(locate).toBeEnabled();await page.screenshot({path:resolve(`docs/evidence/drw-001-missing-${theme}-1440x900.png`),animations:'disabled'})}
 await locate.focus();await page.keyboard.press('Enter')
 await loaded();const changed=(await current(doc.id))!
 expect(changed.dirty).toBe(true);expect(changed.text).toMatch(/!\[Gráfico\]\(a\.assets\/[a-f0-9-]+\.png "Descripción"\)/);expect(await readFile(path,'utf8')).toBe(source)
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(locate).toBeVisible();expect((await current(doc.id))?.text).toBe(source)
 await page.getByRole('button',{name:'Rehacer',exact:true}).click();await loaded();expect((await current(doc.id))?.text).toBe(changed.text)
 expect((await readdir(join(folder,'origen','a.assets'))).filter(name=>name.endsWith('.png'))).toHaveLength(1)
})
test('A3 · un recuperado sin ruta pide guardar antes de Buscar y no escribe activos en Documentos',async()=>{
 const source='![Recuperada](a.assets/ausente.png)\n',{doc}=await open(source)
 await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText('Nota recuperable')
 await expect.poll(async()=>{try{return JSON.parse(await readFile(join(folder,'profile','recovery',doc.id+'.json'),'utf8')).snapshot.text}catch{return ''}}).toContain('Nota recuperable')
 const provisional=join(folder,'Documentos-aislados');await mkdir(provisional);await app.evaluate(({app},path)=>app.setPath('documents',path),provisional)
 const recovered=await page.evaluate(id=>window.freya.recover(id),doc.id)
 await page.reload();await expect(page.locator('.toolbar')).toBeVisible();const recoveredTab=page.getByRole('tablist',{name:'Documentos abiertos',exact:true}).getByRole('tab').filter({hasText:recovered.name});await recoveredTab.click()
 await expect(recoveredTab).toHaveAttribute('aria-selected','true')
 await article().getByRole('button',{name:/Buscar imagen.*Recuperada/}).click();await expect(page.locator('.toast')).toContainText('Guarda el documento para poder insertar imágenes')
 await expect(page.evaluate(id=>window.freya.locateImage(id,'a.assets/ausente.png'),recovered.id)).rejects.toThrow('Guarda el documento para poder insertar imágenes')
 expect((await current(recovered.id))?.path).toBeNull();expect(await readdir(provisional)).toEqual([]);expect(await readdir(join(folder,'destino'))).toEqual([])
})
test('Guardar como bloquea temporalmente edición y conserva el historial anterior durante el selector',async()=>{
 await mkdir(join(folder,'origen','a.assets'));await writeFile(join(folder,'origen','a.assets','uno.png'),png)
 const original='![x](a.assets/uno.png)\n',{doc,path}=await open(original)
 await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText('Nota anterior')
 const before=(await current(doc.id))!.text
 await app.evaluate(({dialog})=>{
  delete process.env.FREYALAB_TEST_SAVE_PATH
  const target=globalThis as typeof globalThis&{assetSaveWaiting?:boolean;releaseAssetSave?:(path:string)=>void}
  dialog.showSaveDialog=(()=>new Promise(resolve=>{target.assetSaveWaiting=true;target.releaseAssetSave=path=>resolve({canceled:false,filePath:path})})) as typeof dialog.showSaveDialog
 })
 await page.getByRole('button',{name:'Guardar como',exact:true}).click()
 await expect.poll(()=>app.evaluate(()=>!!(globalThis as typeof globalThis&{assetSaveWaiting?:boolean}).assetSaveWaiting)).toBe(true)
 await expect(page.locator('.cm-content')).toHaveAttribute('contenteditable','false');await expect(page.getByRole('button',{name:'Deshacer',exact:true})).toBeDisabled()
 await app.evaluate((_,path)=>(globalThis as typeof globalThis&{releaseAssetSave:(path:string)=>void}).releaseAssetSave(path),target)
 await expect(page.locator('.toast')).toContainText('Archivo guardado');await expect(page.locator('.cm-content')).toHaveAttribute('contenteditable','true')
 expect((await current(doc.id))?.text).toBe(before!.replaceAll('a.assets','Copia%20%C3%A1.assets'));await page.getByRole('button',{name:'Deshacer',exact:true}).click();expect((await current(doc.id))?.text).toBe(original.replaceAll('a.assets','Copia%20%C3%A1.assets'));expect(await readFile(path,'utf8')).toBe(original)
})

test('Guardar sin cambiar fuente conserva las imágenes y el DOM; no vuelve a preparar recursos por el bloqueo',async()=>{
 await mkdir(join(folder,'origen','a.assets'));await writeFile(join(folder,'origen','a.assets','uno.png'),png)
 await open('![Vista](a.assets/uno.png)\n\n- [ ] Tarea\n');await loaded();await expect(page.locator('.preview .render-progress')).toHaveCount(0)
 await article().locator('img').evaluate(image=>image.setAttribute('data-asset-identity','original'))
 await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('.toast')).toContainText('Archivo guardado');await expect(page.locator('.preview .render-progress')).toHaveCount(0)
 await expect(article().locator('img')).toHaveAttribute('data-asset-identity','original');await expect(article().getByRole('checkbox')).toBeEnabled()
})
test('una imagen enlazada coloca Buscar fuera del enlace y conserva su destino al reparar',async()=>{
 const source='[![Logo](a.assets/ausente.png)](https://example.test/)\n',{path}=await open(source)
 const button=article().getByRole('button',{name:/Buscar imagen.*Logo/});await expect(button).toBeVisible()
 expect(await button.evaluate(node=>!!node.closest('a'))).toBe(false)
 await button.click();await loaded();await expect(article().locator('a')).toHaveAttribute('href','https://example.test/');expect(await readFile(path,'utf8')).toBe(source)
})
test('Buscar SVG conserva sus bytes y lo muestra como imagen sin ejecutar contenido',async()=>{
 const hostile='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" onload="parent.__assetInjected=1"><script>parent.__assetInjected=2</script><rect width="64" height="64" fill="blue"/></svg>',svg=join(folder,'elegida.svg')
 await writeFile(svg,hostile);await app.evaluate((_,path)=>process.env.FREYALAB_TEST_IMAGE_PATH=path,svg)
 const source='![Vector](a.assets/falta.svg)\n',{doc,path}=await open(source)
 await article().getByRole('button',{name:/Buscar imagen.*Vector/}).click();await loaded()
 expect(await page.evaluate(()=>Reflect.get(window,'__assetInjected'))).toBeUndefined();await expect(article().locator('script,svg')).toHaveCount(0)
 const text=(await current(doc.id))!.text!,reference=/\]\(([^)]+)\)/.exec(text)![1]
 expect(await readFile(join(folder,'origen',decodeURIComponent(reference)),'utf8')).toBe(hostile);expect(await readFile(path,'utf8')).toBe(source)
})
test('A4 · Guardar como avisa de la imagen externa y refresca su resolución desde la carpeta nueva',async()=>{
 await writeFile(join(folder,'origen','fuera.png'),png)
 const source='![Fuera](fuera.png)\n',{path}=await open(source);await loaded()
 await page.getByRole('button',{name:'Guardar como',exact:true}).click();await expect(page.locator('.toast')).toContainText('1 imagen no se copió')
 const warning=page.getByRole('region',{name:'Imágenes no copiadas'});await expect(warning).toContainText('1 imagen no se copió');await expect(warning.getByRole('list')).not.toBeVisible()
 await warning.locator('summary').click();await expect(warning.getByRole('list')).toContainText('fuera.png: La referencia está fuera de la carpeta de activos')
 await expect(article().locator('img')).toHaveAttribute('alt','Imagen no disponible: Fuera');await expect(article().getByRole('button',{name:/Buscar imagen.*Fuera/})).toBeVisible()
 expect(await readFile(path,'utf8')).toBe(source);expect(await readFile(target,'utf8')).toBe(source);expect(await readdir(join(folder,'destino'))).toEqual(['Copia á.md'])
})

test('U1 · Guardar como nombra el activo propio ausente sin mostrar el prefijo remoto',async()=>{
 const source='![Perdida](a.assets/foto%20%C3%A1.png)\n',{path,doc}=await open(source)
 await page.getByRole('button',{name:'Guardar como',exact:true}).click()
 const toast=page.locator('.toast.error');await expect(toast).toContainText('foto á.png');await expect(toast).toContainText('No se encontró')
 const message=await toast.innerText();expect(message).not.toContain('Error invoking remote method');expect(message).not.toContain('Error:')
 expect((await current(doc.id))?.path).toBe(path);expect(await readFile(path,'utf8')).toBe(source);expect(await readdir(join(folder,'destino'))).toEqual([])
})

test('U2 · el resumen conserva el detalle de cada imagen hasta cerrarlo y sobrevive a otro aviso',async()=>{
 const source='![Uno](fuera.png)\n![Dos](https://example.invalid/remota.png)\n',{doc}=await open(source)
 await page.clock.install()
 await page.getByRole('button',{name:'Guardar como',exact:true}).click()
 const warning=page.getByRole('region',{name:'Imágenes no copiadas'});await expect(warning).toContainText('2 imágenes no se copiaron')
 await page.clock.runFor(4000);await expect(warning).toBeVisible()
 await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('.toast')).toContainText('Archivo guardado');await expect(warning).toBeVisible()
 await open('# Otro documento\n','otro.md');await expect(warning).toHaveCount(0)
 await page.getByRole('tab',{name:'Copia á.md',exact:true}).click();await expect(warning).toBeVisible();expect((await current(doc.id))?.path).toBe(target)
 await warning.locator('summary').focus();await page.keyboard.press('Enter')
 await expect(warning.getByRole('listitem')).toHaveCount(2);await expect(warning.getByRole('list')).toContainText('fuera.png:');await expect(warning.getByRole('list')).toContainText('https://example.invalid/remota.png:')
 await warning.getByRole('button',{name:'Cerrar aviso de imágenes'}).click();await expect(warning).toHaveCount(0);await expect(page.locator('.cm-content')).toBeFocused()
})
