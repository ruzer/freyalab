import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,copyFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,directory:string,documentId:string,documentPath:string
type PDFCanvasSurface={canvas:HTMLCanvasElement&{toBuffer:(type:'image/png')=>Buffer};context:CanvasRenderingContext2D}
type PDFCanvasFactory={create:(width:number,height:number)=>PDFCanvasSurface;destroy:(surface:PDFCanvasSurface)=>void}
const diagram='flowchart LR\n  A[Inicio] -->|Revisar| B{¿Completo?}\n  B -->|Sí| C[Exportar]\n  B -->|No| D[Editar]\n  D --> E[Guardar]'
const label={svg:'Imagen SVG',png:'Imagen PNG',pdf:'Documento PDF',html:'HTML autónomo'} as const

test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-mer009-'));await mkdir(join(directory,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:join(directory,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

async function open(source=diagram,extension='mmd'){
 documentPath=join(directory,`documento.${extension}`);await writeFile(documentPath,source)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),documentPath);documentId=doc.id
 await expect(page.locator('.cm-content')).toBeVisible()
 await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('dark')
 await expect(page.locator('html')).toHaveClass(/dark/)
 await expect(page.locator(extension==='mmd'?'.diagram-svg svg':'.preview article svg').first()).toBeVisible()
 await settled()
}
async function settled(){await expect(page.locator('.diagram-panel .render-progress,.preview .render-progress')).toHaveCount(0)}
async function exportFile(format:keyof typeof label){
 const filename=`documento.${format}`,path=join(directory,'exports',filename);await rm(path,{force:true})
 await page.bringToFront()
 await page.getByRole('button',{name:'Exportar',exact:true}).click()
 await page.getByRole('button',{name:label[format],exact:true}).click()
 await expect.poll(()=>readdir(join(directory,'exports')),{timeout:30_000}).toContain(filename)
 if(process.env.FREYALAB_MER_EXPORT_EVIDENCE_DIR){
  const kind=documentPath.endsWith('.mmd')?'individual':'markdown'
  await copyFile(path,join(process.env.FREYALAB_MER_EXPORT_EVIDENCE_DIR,`1-${process.env.FREYALAB_MER_EXPORT_PHASE??'run'}-${kind}.${format}`))
 }
 return path
}
async function standalone(path:string){
 const opened=app.waitForEvent('window')
 await app.evaluate(async({BrowserWindow},path)=>{const window=new BrowserWindow({show:true,width:1200,height:900,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:false,partition:`mer009-export-${Date.now()}`}});await window.loadFile(path)},path)
 const view=await opened;await view.waitForLoadState();await view.evaluate(async()=>{document.documentElement.style.backgroundColor='white';await document.fonts.ready})
 expect(await view.evaluate(()=>typeof window.freya)).toBe('undefined')
 return view
}
async function artifact(name:string,content:unknown){
 const value=JSON.stringify(content,null,2)
 await test.info().attach(name,{body:Buffer.from(value),contentType:'application/json'})
 if(process.env.FREYALAB_MER_EXPORT_EVIDENCE_DIR){const folder=process.env.FREYALAB_MER_EXPORT_EVIDENCE_DIR;await mkdir(folder,{recursive:true});await writeFile(join(folder,`1-${process.env.FREYALAB_MER_EXPORT_PHASE??'run'}-${name}.json`),value)}
}
async function contrast(view:Page,name:string,enforce=true){
 if(process.env.FREYALAB_MER_EXPORT_EVIDENCE_DIR){
  const svgs=await view.locator('svg').evaluateAll(nodes=>nodes.map(node=>node.outerHTML))
  for(const [index,svg] of svgs.entries())await writeFile(join(process.env.FREYALAB_MER_EXPORT_EVIDENCE_DIR,`1-${process.env.FREYALAB_MER_EXPORT_PHASE??'run'}-${name}-${index+1}.svg`),svg)
 }
 const result=await view.evaluate(()=>{
  const luminance=(rgb:number[])=>rgb.slice(0,3).map(channel=>{const value=channel/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
  function sample(node:Element,property:'fill'|'stroke'){
   const style=getComputedStyle(node),color=style[property]
   if(color==='none'||style.display==='none'||style.visibility==='hidden')return null
   const channels=color.match(/[\d.]+/g)?.map(Number)
   if(!channels||channels.length<3)return null
   const alpha=(channels[3]??1)*Number(style.opacity),rgb=channels.slice(0,3).map(channel=>channel*alpha+255*(1-alpha))
   return{tag:node.tagName,text:node.textContent?.trim().slice(0,80),color,ratio:1.05/(luminance(rgb)+.05)}
  }
  const texts=Array.from(document.querySelectorAll<SVGGraphicsElement>('svg text,svg tspan')).filter(node=>node.textContent?.trim()&&node.getBBox().width>0).map(node=>sample(node,'fill')).filter(value=>value!==null)
  const edges=Array.from(document.querySelectorAll('svg .flowchart-link,svg .edgePaths path')).map(node=>sample(node,'stroke')).filter(value=>value!==null)
  const markers=Array.from(document.querySelectorAll('svg marker path')).map(node=>sample(node,'fill')).filter(value=>value!==null)
  return{background:'rgb(255, 255, 255)',texts,edges,markers,minimum:{text:Math.min(...texts.map(value=>value.ratio)),edge:Math.min(...edges.map(value=>value.ratio)),marker:Math.min(...markers.map(value=>value.ratio))}}
 })
 await artifact(name,result)
 expect(result.texts.length,'la medición debe incluir texto SVG real').toBeGreaterThan(0)
 expect(result.edges.length,'la medición debe incluir aristas reales').toBeGreaterThan(0)
 expect(result.markers.length,'la medición debe incluir puntas de flecha reales').toBeGreaterThan(0)
 if(enforce){
  expect(result.minimum.text,'contraste mínimo texto/blanco del archivo exportado').toBeGreaterThanOrEqual(4.5)
  expect(result.minimum.edge,'contraste mínimo arista/blanco del archivo exportado').toBeGreaterThanOrEqual(4.5)
  expect(result.minimum.marker,'contraste mínimo flecha/blanco del archivo exportado').toBeGreaterThanOrEqual(4.5)
 }
 return result
}

async function binaryArtifact(name:string,body:Buffer,extension='png'){
 await test.info().attach(name,{body,contentType:extension==='pdf'?'application/pdf':'image/png'})
 if(process.env.FREYALAB_MER_EXPORT_EVIDENCE_DIR)await writeFile(join(process.env.FREYALAB_MER_EXPORT_EVIDENCE_DIR,`1-${process.env.FREYALAB_MER_EXPORT_PHASE??'run'}-${name}.${extension}`),body)
}
async function pdfResult(path:string,name:string){
 const bytes=await readFile(path);expect(bytes.subarray(0,5).toString()).toBe('%PDF-')
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs'),loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true})
 try{
  // PDFDocumentProxy declara canvasFactory como object; acotar solo los métodos públicos usados.
  const pdf=await loading.promise,factory=pdf.canvasFactory as PDFCanvasFactory,texts:string[]=[];let images=0
  for(let index=1;index<=pdf.numPages;index++){
   const sheet=await pdf.getPage(index),viewport=sheet.getViewport({scale:1}),surface=factory.create(Math.ceil(viewport.width),Math.ceil(viewport.height))
   texts.push((await sheet.getTextContent()).items.map(item=>'str'in item?item.str:'').join(' '))
   images+=(await sheet.getOperatorList()).fnArray.filter(op=>op===OPS.paintImageXObject||op===OPS.paintInlineImageXObject).length
   try{
    await sheet.render({canvas:surface.canvas,canvasContext:surface.context,viewport}).promise
    const png=surface.canvas.toBuffer('image/png')
    await binaryArtifact(`${name}-pagina-${index}`,png)
   }finally{factory.destroy(surface)}
  }
  const result={pages:pdf.numPages,text:texts.join(' ').replace(/\s+/g,' '),images}
  await artifact(`${name}-pdf`,result);await binaryArtifact(name,bytes,'pdf');return result
 }finally{await loading.destroy()}
}
async function observeScreen(selector:string){
 return page.locator(selector).evaluateHandle(node=>{
  const changes:string[]=[],observer=new MutationObserver(records=>{for(const record of records)changes.push(`${record.type}:${record.attributeName??''}`)})
  observer.observe(node,{subtree:true,childList:true,characterData:true,attributes:true})
  return{observer,changes}
 })
}
async function replace(source:string){await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(source)}
async function appScreenshot(name:string){
 if(!process.env.FREYALAB_MER_EXPORT_EVIDENCE_DIR)return
 await page.bringToFront();await page.setViewportSize({width:1440,height:900})
 await binaryArtifact(name,await page.screenshot({animations:'disabled'}))
}

test('E1/E4: SVG individual exportado desde oscuro tiene texto y flechas legibles sobre blanco',async()=>{
 await open()
 const before=await page.locator('.diagram-svg svg').evaluate(node=>node.outerHTML)
 const path=await exportFile('svg'),svg=await readFile(path,'utf8')
 expect(svg).toContain('<svg');expect(svg).not.toContain('<script')
 if(process.env.FREYALAB_MER_EXPORT_EVIDENCE_DIR)await copyFile(path,join(process.env.FREYALAB_MER_EXPORT_EVIDENCE_DIR,`1-${process.env.FREYALAB_MER_EXPORT_PHASE??'run'}-individual.svg`))
 const view=await standalone(path);await contrast(view,'individual-svg-colors')
 expect(await page.locator('.diagram-svg svg').evaluate(node=>node.outerHTML)).toBe(before)
 expect(await readFile(documentPath,'utf8')).toBe(diagram)
 expect((await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),documentId))?.dirty).toBe(false)
})

test('E1/E3: HTML, PNG blanco y PDF individual no alteran el SVG oscuro visible',async()=>{
 await open()
 const before=await page.locator('.diagram-svg svg').evaluate(node=>node.outerHTML),observer=await observeScreen('.diagram-svg')
 await page.getByRole('button',{name:'Exportar',exact:true}).click()
 await expect(page.locator('.export-dropdown')).toContainText('Se exporta con colores claros para que se lea en papel y en cualquier pantalla')
 await appScreenshot('individual-app-oscuro-1440x900')
 await page.getByRole('button',{name:'Exportar',exact:true}).click()
 const htmlPath=await exportFile('html'),view=await standalone(htmlPath);await contrast(view,'individual-html-colors')
 const pngPath=await exportFile('png'),png=await readFile(pngPath)
 const pixel=await page.evaluate(async data=>{
  const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode()
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
  const context=canvas.getContext('2d')!;context.drawImage(image,0,0)
  return{width:canvas.width,height:canvas.height,corner:Array.from(context.getImageData(0,0,1,1).data)}
 },png.toString('base64'))
 await artifact('individual-png-pixel',pixel);expect(pixel.width).toBeGreaterThan(0);expect(pixel.height).toBeGreaterThan(0);expect(pixel.corner).toEqual([255,255,255,255])
 await binaryArtifact('individual',png)
 const pdf=await pdfResult(await exportFile('pdf'),'individual-oscuro');expect(pdf.text).toContain('Inicio');expect(pdf.text).toContain('Guardar')
 expect(await page.locator('.diagram-svg svg').evaluate(node=>node.outerHTML)).toBe(before)
 expect(await observer.evaluate(({observer,changes})=>{observer.disconnect();return changes})).toEqual([])
 await observer.dispose()
 // El segundo PDF se genera con la pantalla clara; ambas capturas proceden del PDF real.
 await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('light');await settled()
 const light=await pdfResult(await exportFile('pdf'),'individual-claro');expect(light.text).toBe(pdf.text)
 await page.getByRole('button',{name:'Exportar',exact:true}).click();await appScreenshot('individual-app-claro-1440x900');await page.getByRole('button',{name:'Exportar',exact:true}).click()
})

test('E2/E3/E4: Markdown mixto exporta sus diagramas claros sin cambiar la vista oscura',async()=>{
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64')
 await writeFile(join(directory,'local.png'),image)
 const source='---\ntitle: PROPIEDAD_NO_EXPORTAR\n---\n\n# Informe mixto\n\nPárrafo intacto. Fórmula $x^2$.\n\n![Imagen local](local.png)\n\n<details><summary>Más información</summary>Contenido adicional.</details>\n\n```mermaid\n'+diagram+'\n```\n\n```mermaid\nflowchart LR\n  F[Segundo] --> G[Resultado]\n```\n'
 await open(source,'md');await expect(page.locator('.preview article svg')).toHaveCount(2)
 await expect(page.locator('.preview article img')).toHaveAttribute('src',/^data:image/)
 const before=await page.locator('.preview article').evaluate(node=>node.innerHTML),observer=await observeScreen('.preview article')
 const htmlPath=await exportFile('html'),html=await readFile(htmlPath,'utf8')
 expect(html).not.toContain('PROPIEDAD_NO_EXPORTAR');expect(html).not.toContain('Propiedades del documento')
 const view=await standalone(htmlPath);await expect(view.locator('svg')).toHaveCount(2);await contrast(view,'markdown-html-colors')
 await expect(view.locator('img')).toHaveAttribute('src',/^data:image/);await expect(view.locator('.katex')).toHaveCount(1)
 const pdf=await pdfResult(await exportFile('pdf'),'markdown-oscuro');expect(pdf.text).toContain('Informe mixto');expect(pdf.text).toContain('Segundo');expect(pdf.text).toContain('Contenido adicional.');expect(pdf.images).toBeGreaterThan(0);expect(pdf.text).not.toContain('PROPIEDAD_NO_EXPORTAR')
 expect(await page.locator('.preview article').evaluate(node=>node.innerHTML)).toBe(before)
 expect(await observer.evaluate(({observer,changes})=>{observer.disconnect();return changes})).toEqual([]);await observer.dispose()
 expect(await readFile(documentPath,'utf8')).toBe(source)
 await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('light');await settled()
 const light=await pdfResult(await exportFile('pdf'),'markdown-claro');expect(light.text).toBe(pdf.text)
})

test('más de 64 diagramas y dos bloques iguales conservan todas las fuentes y el orden al exportar',async()=>{
 test.setTimeout(180_000)
 const sources=[diagram,...Array.from({length:65},(_,index)=>`flowchart LR\n  A[Diagrama ${index}] --> B[Fin ${index}]`),diagram]
 await open('# Colección\n\n'+sources.map(source=>'```mermaid\n'+source+'\n```').join('\n\n'),'md')
 await expect(page.locator('.preview article svg')).toHaveCount(67)
 const view=await standalone(await exportFile('html'));await expect(view.locator('svg')).toHaveCount(67)
 await expect(view.locator('svg').nth(0)).toContainText('Revisar');await expect(view.locator('svg').nth(66)).toContainText('Revisar')
 for(const index of [0,32,64])await expect(view.locator('svg').nth(index+1)).toContainText(`Diagrama ${index}`)
 await contrast(view,'coleccion-html-colors')
})

test('la directiva de tema del autor se conserva y su excepción de contraste queda medida',async()=>{
 const source='%%{init: {"theme":"dark"}}%%\n'+diagram
 await open(source)
 const view=await standalone(await exportFile('svg')),colors=await contrast(view,'tema-autoral-colors',false)
 expect(colors.minimum.text).toBeLessThan(4.5)
 expect(await readFile(documentPath,'utf8')).toBe(source)
})

for(const format of ['svg','png','pdf','html'] as const){
 test(`E5: ${format} rechaza una fuente inválida sin exportar la última versión válida`,async()=>{
  await open();const previous=await page.locator('.diagram-svg svg').evaluate(node=>node.outerHTML)
  const invalid='flowchart LR\n  A[Inicio] --> B[Sin cierre';await replace(invalid)
  await expect(page.locator('.diagram-notice')).toBeVisible();await settled()
  await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:label[format],exact:true}).click()
  await expect(page.locator('.toast')).toContainText('Corrige el diagrama antes de exportar.')
  expect(await readdir(join(directory,'exports'))).toEqual([])
  expect(await page.locator('.diagram-svg svg').evaluate(node=>node.outerHTML)).toBe(previous)
  expect(Number(await page.locator('.diagram-svg').evaluate(node=>getComputedStyle(node).opacity))).toBeCloseTo(.45,2)
 })
}

test('exportar durante el debounce espera la fuente actual y no reutiliza el SVG viejo',async()=>{
 await open();const next='flowchart LR\n A[Texto NUEVO] --> B[Salida actual]';await replace(next)
 const view=await standalone(await exportFile('svg')),texts=(await view.locator('svg text').allTextContents()).join(' ')
 // Mermaid puede separar palabras con tspans: verificar contenido, no serialización HTML.
 expect(texts).toMatch(/Texto\s*NUEVO/);expect(texts).not.toContain('¿Completo?')
 await contrast(view,'render-pendiente-colors')
})

test('cambiar el tema mientras se prepara la exportación mantiene la salida clara y la elección del usuario',async()=>{
 await open()
 const result=await page.evaluate(async()=>{
  const click=(name:string)=>{const button=Array.from(document.querySelectorAll<HTMLButtonElement>('.toolbar button')).find(node=>node.textContent?.trim()===name);if(!button)throw new Error(`Falta ${name}`);button.click()}
  click('Exportar');await Promise.resolve();click('Imagen SVG')
  const select=document.querySelector<HTMLSelectElement>('select[aria-label="Tema"]')!;select.value='light';select.dispatchEvent(new Event('change',{bubbles:true}))
  return{theme:select.value}
 })
 expect(result.theme).toBe('light');await expect(page.locator('html')).not.toHaveClass(/dark/)
 await expect.poll(()=>readdir(join(directory,'exports'))).toContain('documento.svg')
 const view=await standalone(join(directory,'exports','documento.svg'));await contrast(view,'cambio-tema-colors');await settled()
 await expect(page.getByRole('combobox',{name:'Tema',exact:true})).toHaveValue('light')
})

test('cerrar la pestaña mientras espera el render cancela la salida de la vista destruida',async()=>{
 documentPath=join(directory,'documento.mmd');await writeFile(documentPath,diagram)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),documentPath);documentId=doc.id
 await expect(page.locator('.cm-content')).toBeVisible()
 await page.evaluate(async name=>{
  const click=(label:string)=>{const button=Array.from(document.querySelectorAll<HTMLButtonElement>('.toolbar button')).find(node=>node.textContent?.trim()===label);if(!button)throw new Error(`Falta ${label}`);button.click()}
  click('Exportar');await Promise.resolve();click('Imagen SVG')
  for(let i=0;i<4;i++)await Promise.resolve()
  document.querySelector<HTMLButtonElement>(`.tab-close[aria-label=${JSON.stringify('Cerrar '+name)}]`)!.click()
 },doc.name)
 await expect(page.getByRole('tab')).toHaveCount(0)
 await expect(page.locator('.toast')).toContainText('Corrige el diagrama antes de exportar.')
 expect(await readdir(join(directory,'exports'))).toEqual([])
})

test('cancelar el diálogo de destino no altera la pantalla ni crea archivos',async()=>{
 await open();const before=await page.locator('.diagram-svg svg').evaluate(node=>node.outerHTML)
 // Cancelación del diálogo simulado con la API de Electron, sin hook de IPC ni interfaz de producto.
 await app.evaluate(({dialog})=>{delete process.env.FREYALAB_TEST_EXPORT_DIR;dialog.showSaveDialog=async()=>({canceled:true,filePath:''})})
 await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:'Imagen SVG',exact:true}).click()
 await expect(page.getByRole('button',{name:'Exportar',exact:true})).toBeEnabled()
 expect(await readdir(join(directory,'exports'))).toEqual([])
 expect(await page.locator('.diagram-svg svg').evaluate(node=>node.outerHTML)).toBe(before)
})
