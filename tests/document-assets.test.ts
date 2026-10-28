import {it,expect,vi,beforeEach,afterEach} from 'vitest'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,realpath,symlink,lstat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {join,dirname} from 'node:path'
import {tmpdir} from 'node:os'
const state=vi.hoisted(()=>({folder:'',target:'',copies:0,failCopy:0,denyAssets:false,failDocument:false,partialCopy:false,readError:'',pickImage:'',pickers:0,pickerHook:()=>{}}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{showOpenDialog:async()=>{state.pickers++;state.pickerHook();return{canceled:!state.pickImage,filePaths:state.pickImage?[state.pickImage]:[]}}},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:()=>{const watcher={on:()=>watcher,close:async()=>{}};return watcher}}))
vi.mock('../src/main/table-client',()=>({TableClient:class {async call(){return undefined}stop(){}}}))
vi.mock('node:fs/promises',async original=>{
 const actual=await original<typeof import('node:fs/promises')>()
 return{...actual,open:async(...args:Parameters<typeof actual.open>)=>{
  if(state.readError&&String(args[0])===state.readError)throw Object.assign(new Error('EACCES: permission denied'),{code:'EACCES'})
  const handle=await actual.open(...args)
  if(!String(args[0]).includes('.assets')||args[1]!=='wx')return handle
  return new Proxy(handle,{get(target,key){if(key==='writeFile')return async(...values:Parameters<typeof handle.writeFile>)=>{state.copies++;if(state.copies===state.failCopy){if(state.partialCopy)await target.writeFile('PARCIAL');throw Object.assign(new Error('No queda espacio para copiar la imagen.'),{code:'ENOSPC'})};return target.writeFile(...values)};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}})
 },copyFile:async(...args:Parameters<typeof actual.copyFile>)=>{
  if(String(args[1]).includes('.assets')){state.copies++;if(state.copies===state.failCopy){if(state.partialCopy)await actual.writeFile(args[1],'PARCIAL',{flag:'wx'});throw Object.assign(new Error('No queda espacio para copiar la imagen.'),{code:'ENOSPC'})}}
  return actual.copyFile(...args)
 },mkdir:async(...args:Parameters<typeof actual.mkdir>)=>{
  if(state.denyAssets&&String(args[0]).endsWith('.assets'))throw Object.assign(new Error('No tienes permiso para crear la carpeta de imágenes.'),{code:'EACCES'})
  return actual.mkdir(...args)
 }}
})
vi.mock('../src/main/files',async original=>{const actual=await original<typeof import('../src/main/files')>();return{...actual,atomicWrite:async(path:string,data:string|Uint8Array,hash?:string)=>{
 if(state.failDocument&&path===state.target)throw Object.assign(new Error('No queda espacio para guardar el documento.'),{code:'ENOSPC'})
 return actual.atomicWrite(path,data,hash)
}}})
import {Documents} from '../src/main/documents'
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64')
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex')
let docs:Documents
beforeEach(async()=>{
 state.folder=await realpath(await mkdtemp(join(tmpdir(),'freya-assets-')));state.target=join(state.folder,'destino','b.md');state.copies=0;state.failCopy=0;state.denyAssets=false;state.failDocument=false;state.partialCopy=false;state.readError='';state.pickImage='';state.pickers=0;state.pickerHook=()=>{}
 await mkdir(dirname(state.target));vi.stubEnv('FREYALAB_TEST','1');vi.stubEnv('FREYALAB_TEST_SAVE_PATH',state.target);docs=new Documents(()=>{})
})
afterEach(async()=>{state.failCopy=0;state.denyAssets=false;state.failDocument=false;state.partialCopy=false;state.readError='';state.pickImage='';state.pickers=0;state.pickerHook=()=>{};await docs.shutdown();await rm(state.folder,{recursive:true,force:true});vi.unstubAllEnvs()})
async function original(source='![x](a.assets/x.png)',images:Record<string,Uint8Array>={'x.png':PNG}){
 const path=join(state.folder,'origen','a.md');await mkdir(join(dirname(path),'a.assets'),{recursive:true})
 await writeFile(path,source)
 for(const [name,data] of Object.entries(images)){const image=join(dirname(path),'a.assets',name);await mkdir(dirname(image),{recursive:true});await writeFile(image,data)}
 return{path,doc:await docs.open(path),source}
}

it('F05: Guardar como copia el activo y la nueva raíz lo resuelve, sin cambiar los hashes del original',async()=>{
 const {path,doc,source}=await original(),image=join(dirname(path),'a.assets','x.png')
 const before={document:hash(await readFile(path)),image:hash(await readFile(image))},data=await docs.image(doc.id,'a.assets/x.png')
 expect(data).toMatch(/^data:image\/png;base64,/)
 const saved=await docs.save(doc.id,true)
 expect(saved?.text).toBe('![x](b.assets/x.png)')
 expect(saved).toMatchObject({path:state.target,dirty:false,assets:{copied:1,warnings:[]}})
 expect(await docs.image(doc.id,'b.assets/x.png')).toBe(data)
 expect(hash(await readFile(path))).toBe(before.document);expect(hash(await readFile(image))).toBe(before.image)
 expect(await readFile(state.target,'utf8')).toBe('![x](b.assets/x.png)');expect(await readFile(path,'utf8')).toBe(source)
 await docs.close(doc.id);const reopened=await docs.open(state.target);expect(await docs.image(reopened.id,'b.assets/x.png')).toBe(data)
})

it('cero imágenes guarda los bytes de texto exactos y devuelve cero copias',async()=>{
 const source='\ufeff---\r\ntitle: Ámbito\r\n---\r\n# Texto\r\n\r\n`![ejemplo](a.assets/x.png)`\r\n'
 const {doc,path}=await original(source,{})
 const saved=await docs.save(doc.id,true)
 expect(saved).toMatchObject({text:source,assets:{copied:0,warnings:[],changes:[]}});expect(await readFile(state.target,'utf8')).toBe(source);expect(await readFile(path,'utf8')).toBe(source)
 expect(await readdir(dirname(state.target))).toEqual(['b.md'])
})

it('tres activos y una referencia repetida se copian una vez por archivo',async()=>{
 const source='![uno](a.assets/x.png)\n![dos](a.assets/sub/y.png)\n![tres](a.assets/z.svg)\n![otra](a.assets/x.png)\n',svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>Editable</text></svg>')
 const {doc,path}=await original(source,{'x.png':PNG,'sub/y.png':PNG,'z.svg':svg}),saved=await docs.save(doc.id,true)
 expect(saved).toMatchObject({assets:{copied:3,warnings:[]}});expect(saved?.text).toBe(source.replaceAll('a.assets','b.assets'))
 for(const name of ['x.png','sub/y.png','z.svg'])expect(hash(await readFile(join(dirname(state.target),'b.assets',name)))).toBe(hash(await readFile(join(dirname(path),'a.assets',name))))
 const changes=(saved as typeof saved&{assets:{changes:{from:number;to:number;insert:string}[]}})!.assets.changes
 let patched=source;for(const change of [...changes].reverse())patched=patched.slice(0,change.from)+change.insert+patched.slice(change.to)
 expect(patched).toBe(saved?.text);expect(changes).toHaveLength(4)
})

it('parcha solo las URL con acentos, espacios, BOM/CRLF, referencias y details compactos',async()=>{
 state.target=join(dirname(state.target),'Resumen final á.markdown');vi.stubEnv('FREYALAB_TEST_SAVE_PATH',state.target)
 const source='\ufeff---\r\ntitle: "![no](a.assets/x.png)"\r\n---\r\n# Guía 😀\r\n\r\n![directa](<a.assets/foto%20á.png> "Título")\r\n![referencia][FOTO]\r\n\r\n[FOTO]: a.assets/foto%20á.png "Conservar título"\r\n\r\n<details><summary>Más</summary>![interior](a.assets/x.png)</details>\r\n\r\n```md\r\n![no](a.assets/x.png)\r\n```\r\n'
 const {doc,path}=await original(source,{'foto á.png':PNG,'x.png':PNG}),saved=await docs.save(doc.id,true),prefix='Resumen%20final%20%C3%A1.assets'
 const expected=source.replace('<a.assets/foto%20á.png>',`<${prefix}/foto%20%C3%A1.png>`).replace('[FOTO]: a.assets/foto%20á.png',`[FOTO]: ${prefix}/foto%20%C3%A1.png`).replace('![interior](a.assets/x.png)',`![interior](${prefix}/x.png)`)
 expect(saved?.text).toBe(expected);expect(saved).toMatchObject({assets:{copied:2,warnings:[]}});expect(await readFile(path,'utf8')).toBe(source)
 expect(await docs.image(doc.id,`${prefix}/foto%20%C3%A1.png`)).toMatch(/^data:image\/png;base64,/)
})

it('destinos con paréntesis escapados y fragmento conservan título y resuelven los bytes',async()=>{
 const source='![a [b] 😀](a.assets/foto\\(1\\).png#detalle "Título intacto")',next='![a [b] 😀](b.assets/foto%281%29.png#detalle "Título intacto")'
 const {doc}=await original(source,{'foto(1).png':PNG}),saved=await docs.save(doc.id,true)
 expect(saved?.text).toBe(next);expect(await docs.image(doc.id,'b.assets/foto%281%29.png#detalle')).toMatch(/^data:image\/png;base64,/)
})

it('no copia definiciones que solo son enlaces, ejemplos de código ni HTML crudo descartado',async()=>{
 const source='[enlace][foto]\n\n[foto]: a.assets/x.png\n\n    ![indentada](a.assets/x.png)\n\n<script>![no](a.assets/x.png)</script>\n\n$![math](a.assets/x.png)$\n'
 const {doc}=await original(source),saved=await docs.save(doc.id,true)
 expect(saved?.text).toBe(source);expect(saved).toMatchObject({assets:{copied:0,warnings:[],changes:[]}})
})

it('una referencia compartida y una imagen dentro de una cita/lista conservan la sintaxis',async()=>{
 const source='> <details>\n> <summary>Más</summary>\n>\n> - ![dentro][foto]\n> </details>\n\n[foto]: <a.assets/x.png> "T"\n'
 const {doc}=await original(source),saved=await docs.save(doc.id,true)
 expect(saved?.text).toBe(source.replace('<a.assets/x.png>','<b.assets/x.png>'));expect(saved).toMatchObject({assets:{copied:1,warnings:[]}})
})

it('ENOSPC en la segunda copia revierte lo creado y deja original, destino previo e identidad intactos',async()=>{
 const source='![1](a.assets/x.png)\n![2](a.assets/y.png)\n![3](a.assets/z.png)',{doc,path}=await original(source,{'x.png':PNG,'y.png':PNG,'z.png':PNG})
 await writeFile(state.target,'Documento anterior de destino.');await mkdir(join(dirname(state.target),'b.assets'));await writeFile(join(dirname(state.target),'b.assets','ajena.png'),'AJENA')
 state.failCopy=2
 await expect(docs.save(doc.id,true)).rejects.toThrow(/espacio/i)
 expect(docs.info(doc.id)).toMatchObject({path,text:source,dirty:false});expect(await readFile(path,'utf8')).toBe(source);expect(await readFile(state.target,'utf8')).toBe('Documento anterior de destino.')
 expect(await readdir(join(dirname(state.target),'b.assets'))).toEqual(['ajena.png']);expect(await readFile(join(dirname(state.target),'b.assets','ajena.png'),'utf8')).toBe('AJENA')
 expect((await readdir(dirname(state.target))).filter(name=>name.startsWith('.'))).toEqual([])
})

it('un permiso denegado al publicar activos no adopta ruta ni guarda un documento parcial',async()=>{
 const {doc,path,source}=await original();state.denyAssets=true
 await expect(docs.save(doc.id,true)).rejects.toThrow(/permiso/i)
 expect(docs.info(doc.id)).toMatchObject({path,text:source});expect(await readdir(dirname(state.target))).toEqual([]);expect(await readFile(path,'utf8')).toBe(source)
})

it('un fallo al guardar el documento elimina solo los activos nuevos y conserva los existentes',async()=>{
 const {doc,path,source}=await original();await mkdir(join(dirname(state.target),'b.assets'));await writeFile(join(dirname(state.target),'b.assets','previa.png'),'PREVIA');state.failDocument=true
 await expect(docs.save(doc.id,true)).rejects.toThrow(/espacio/i)
 expect(await readdir(join(dirname(state.target),'b.assets'))).toEqual(['previa.png']);expect(await readFile(join(dirname(state.target),'b.assets','previa.png'),'utf8')).toBe('PREVIA');expect(docs.info(doc.id)).toMatchObject({path,text:source})
 expect((await readdir(dirname(state.target))).filter(name=>name.startsWith('.'))).toEqual([])
})

for(const existing of ['x.png','X.PNG'])it(`rechaza la colisión con ${existing}, también al plegar mayúsculas`,async()=>{
 const {doc,path,source}=await original();await mkdir(join(dirname(state.target),'b.assets'));await writeFile(join(dirname(state.target),'b.assets',existing),'AJENA')
 await expect(docs.save(doc.id,true)).rejects.toThrow(/existe|colisi[oó]n/i)
 expect(await readFile(join(dirname(state.target),'b.assets',existing),'utf8')).toBe('AJENA');expect(docs.info(doc.id)).toMatchObject({path,text:source});expect(await readdir(dirname(state.target))).toEqual(['b.assets'])
})

it('una carpeta de activos de destino simbólica se rechaza sin escribir en su objetivo',async()=>{
 const {doc,path,source}=await original(),outside=join(state.folder,'ajena');await mkdir(outside);await symlink(outside,join(dirname(state.target),'b.assets'),process.platform==='win32'?'junction':'dir')
 await expect(docs.save(doc.id,true)).rejects.toThrow(/simb[oó]lic/i)
 expect(await readdir(outside)).toEqual([]);expect((await lstat(join(dirname(state.target),'b.assets'))).isSymbolicLink()).toBe(true);expect(docs.info(doc.id)).toMatchObject({path,text:source})
})

it.skipIf(process.platform==='win32')('un activo simbólico, aunque apunte dentro, aborta sin publicar la copia',async()=>{
 const {doc,path,source}=await original('![link](a.assets/link.png)'),assets=join(dirname(path),'a.assets');await symlink(join(assets,'x.png'),join(assets,'link.png'))
 await expect(docs.save(doc.id,true)).rejects.toThrow(/simb[oó]lic/i)
 expect(docs.info(doc.id)).toMatchObject({path,text:source});expect(await readdir(dirname(state.target))).toEqual([])
})

it('traversal y referencias fuera de assets no se copian, permanecen intactas y se avisa',async()=>{
 const source='![fuera](../escape.png)\n![otra](otra.png)',{doc,path}=await original(source);await writeFile(join(dirname(path),'otra.png'),PNG)
 const saved=await docs.save(doc.id,true),assets=(saved as typeof saved&{assets:{copied:number;warnings:string[]}})!.assets
 expect(saved?.text).toBe(source);expect(assets.copied).toBe(0);expect(assets.warnings).toHaveLength(2);expect(assets.warnings.join(' ')).toMatch(/fuera/i);expect(await readdir(dirname(state.target))).toEqual(['b.md'])
})

for(const scenario of [{name:'ausente',file:'no.png',images:{} as Record<string,Uint8Array>,error:/No se encontró/},{name:'mayor de 8 MiB',file:'grande.png',images:{'grande.png':Buffer.alloc(8*1024*1024+1)},error:/8 MiB/}])it(`un activo propio ${scenario.name} aborta sin guardar un documento incompleto`,async()=>{
 const source=`![x](a.assets/${scenario.file})`,{doc,path}=await original(source,scenario.images)
 const saving=docs.save(doc.id,true);await expect(saving).rejects.toThrow(scenario.error);await expect(saving).rejects.toThrow(scenario.file)
 expect(docs.info(doc.id)).toMatchObject({path,text:source});expect(await readFile(path,'utf8')).toBe(source);expect(await readdir(dirname(state.target))).toEqual([])
})

it('data: y las lecturas remotas bloqueadas conservan su comportamiento al guardar',async()=>{
 const data=`data:image/png;base64,${PNG.toString('base64')}`,source=`![incrustada](${data})\n![remota](https://example.invalid/x.png)`
 const {doc}=await original(source),saved=await docs.save(doc.id,true)
 expect(saved?.text).toBe(source);expect(await docs.image(doc.id,data)).toBe(data);expect(await docs.image(doc.id,'https://example.invalid/x.png')).toBeNull();expect(saved).toMatchObject({assets:{copied:0}})
})

it('un recuperado sin ruta no usa Documentos como autorización para copiar activos',async()=>{
 const original=await docs.create('markdown');await docs.update(original.id,'![x](a.assets/x.png)');await mkdir(join(state.folder,'a.assets'));await writeFile(join(state.folder,'a.assets','x.png'),PNG)
 await docs.shutdown();const recovered=await docs.recover(original.id);expect(recovered.path).toBeNull()
 const saved=await docs.save(recovered.id,true),assets=(saved as typeof saved&{assets:{copied:number;warnings:string[]}})!.assets
 expect(assets.copied).toBe(0);expect(assets.warnings.join(' ')).toMatch(/no tenía una ubicación/i);expect(assets.warnings.join(' ')).not.toMatch(/Guarda el documento/i);expect(await readdir(dirname(state.target))).toEqual(['b.md']);expect(await readFile(join(state.folder,'a.assets','x.png'))).toEqual(PNG)
})

it('el mismo directorio assets no necesita copias y un guardado ordinario posterior conserva historial',async()=>{
 const {doc,path}=await original();state.target=join(dirname(path),'a.markdown');vi.stubEnv('FREYALAB_TEST_SAVE_PATH',state.target)
 const saved=await docs.save(doc.id,true);expect(saved?.text).toBe('![x](a.assets/x.png)');expect(saved).toMatchObject({assets:{copied:0,warnings:[]}})
 await docs.update(doc.id,'![x](a.assets/x.png)\nPrimera');await docs.update(doc.id,'![x](a.assets/x.png)\nSegunda');await docs.save(doc.id)
 expect((await docs.undo(doc.id)).text).toContain('Primera');expect((await docs.undo(doc.id,true)).text).toContain('Segunda');expect(await readFile(path,'utf8')).toBe('![x](a.assets/x.png)')
})


it('ENOSPC después de crear parte de la segunda imagen tampoco deja archivos parciales',async()=>{
 const source='![1](a.assets/x.png)\n![2](a.assets/y.png)',{doc,path}=await original(source,{'x.png':PNG,'y.png':PNG})
 state.failCopy=2;state.partialCopy=true
 await expect(docs.save(doc.id,true)).rejects.toThrow(/espacio/i)
 expect(await readdir(dirname(state.target))).toEqual([]);expect(docs.info(doc.id)).toMatchObject({path,text:source});expect(await readFile(path,'utf8')).toBe(source)
})

for(const alt of ['`[`','<span title="]">texto</span>'])it(`el destino de una imagen con alt ${alt} se localiza sin reinterpretar su contenido`,async()=>{
 const source=`![${alt}](a.assets/x.png "Título")`,{doc}=await original(source),saved=await docs.save(doc.id,true)
 expect(saved?.text).toBe(source.replace('a.assets/x.png','b.assets/x.png'));expect(saved).toMatchObject({assets:{copied:1,warnings:[]}})
})

it('el parche de Guardar como conserva las pilas textuales existentes, sin añadir un paso del sistema',async()=>{
 const {doc}=await original(),source='![x](a.assets/x.png)'
 await docs.update(doc.id,`${source}\nPrimera`);await docs.update(doc.id,`${source}\nSegunda`);await docs.undo(doc.id)
 const record=docs.records.get(doc.id)!,before={undo:[...record.undo],redo:[...record.redo],revision:record.info.revision}
 const saved=await docs.save(doc.id,true)
 expect(record.undo).toEqual(before.undo);expect(record.redo).toEqual(before.redo)
 expect(saved?.text).toBe('![x](b.assets/x.png)\nPrimera');expect(saved?.revision).toBe(before.revision+1);expect(saved?.dirty).toBe(false)
})


it('EACCES al leer un activo propio antes visible aborta Guardar como sin publicar un Markdown incompleto',async()=>{
 const {doc,path,source}=await original(),image=join(dirname(path),'a.assets','x.png'),before={document:hash(await readFile(path)),image:hash(await readFile(image))}
 expect(await docs.image(doc.id,'a.assets/x.png')).toMatch(/^data:image\/png;base64,/)
 state.readError=image
 await expect(docs.save(doc.id,true)).rejects.toThrow(/permiso/i)
 expect(await readdir(dirname(state.target))).toEqual([]);expect(docs.info(doc.id)).toMatchObject({path,text:source,dirty:false})
 expect(hash(await readFile(path))).toBe(before.document);expect(hash(await readFile(image))).toBe(before.image)
})


async function selectedImage(name='elegida á.png',bytes:Uint8Array=PNG){
 const path=join(state.folder,'selección',name);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);state.pickImage=path;return path
}

it('Buscar importa una imagen con nombre generado, cambia solo la referencia y permite deshacer en un paso',async()=>{
 const source='![perdida](a.assets/falta.png "Título intacto")',originalDoc=await original(source),selected=await selectedImage(),before=hash(await readFile(selected))
 const result=await docs.locateImage(originalDoc.doc.id,'a.assets/falta.png')
 expect(state.pickers).toBe(1);expect(result).toMatchObject({dirty:true,path:originalDoc.path,assets:{copied:1,warnings:[]}})
 expect(result?.text).toMatch(/^!\[perdida\]\(a\.assets\/[a-f0-9-]{36}\.png "Título intacto"\)$/)
 const url=/\(([^ ]+)/.exec(result!.text!)![1]
 expect(await docs.image(originalDoc.doc.id,url)).toBe(`data:image/png;base64,${PNG.toString('base64')}`)
 expect(await readFile(originalDoc.path,'utf8')).toBe(source);expect(hash(await readFile(selected))).toBe(before)
 expect((await docs.undo(originalDoc.doc.id)).text).toBe(source);expect((await docs.undo(originalDoc.doc.id,true)).text).toBe(result?.text)
})

it('Buscar cancelado no cambia documento, historial ni activos',async()=>{
 const {doc,path,source}=await original('![x](a.assets/falta.png)'),record=docs.records.get(doc.id)!,before={undo:[...record.undo],redo:[...record.redo]}
 expect(await docs.locateImage(doc.id,'a.assets/falta.png')).toBeNull();expect(state.pickers).toBe(1)
 expect(docs.info(doc.id)).toMatchObject({path,text:source,dirty:false});expect(record.undo).toEqual(before.undo);expect(record.redo).toEqual(before.redo);expect(await readdir(join(dirname(path),'a.assets'))).toEqual(['x.png'])
})

it('Buscar sin ruta o recuperado se rechaza antes del selector y no escribe activos en Documentos',async()=>{
 const doc=await docs.create('markdown');await docs.update(doc.id,'![x](a.assets/falta.png)');await docs.shutdown();const recovered=await docs.recover(doc.id)
 for(const id of [doc.id,recovered.id])await expect(docs.locateImage(id,'a.assets/falta.png')).rejects.toThrow('Guarda el documento para poder insertar imágenes')
 expect(state.pickers).toBe(0);expect((await readdir(state.folder)).filter(name=>name.endsWith('.assets'))).toEqual([])
})

it('Buscar en una muestra de solo lectura o en texto plano se rechaza antes del selector',async()=>{
 const path=join(state.folder,'muestra.md');await writeFile(path,'![x](a.assets/falta.png)\n'+'x'.repeat(10*1024*1024));const doc=await docs.open(path);expect(doc.readonly).toBe(true)
 await expect(docs.locateImage(doc.id,'a.assets/falta.png')).rejects.toThrow(/solo lectura/i)
 const text=await docs.create('text');await expect(docs.locateImage(text.id,'a.assets/falta.png')).rejects.toThrow(/Markdown/i);expect(state.pickers).toBe(0)
})

it('Buscar usa el selector solo sobre una referencia relativa AST vigente',async()=>{
 const {doc}=await original('![x](a.assets/falta.png)')
 for(const url of ['no-existe.png','https://example.invalid/a.png','data:image/png;base64,AA=='])await expect(docs.locateImage(doc.id,url)).rejects.toThrow(/referencia|relativa/i)
 expect(state.pickers).toBe(0)
})

it('Buscar respeta espacios/acentos codificados y referencias/details sin reserializar el Markdown',async()=>{
 const source='\ufeff# Guía 😀\r\n\r\n![uno](a.assets/foto%20á.png "T")\r\n![dos][FOTO]\r\n\r\n[FOTO]: <a.assets/foto á.png> "Referencia"\r\n\r\n<details><summary>Más</summary>![tres](a.assets/foto%20%C3%A1.png)</details>\r\n'
 const {doc,path}=await original(source,{});await selectedImage();const result=await docs.locateImage(doc.id,'a.assets/foto%20%C3%A1.png'),changes=result!.assets.changes
 expect(changes).toHaveLength(3);let text=source
 for(const change of [...changes].reverse())text=text.slice(0,change.from)+change.insert+text.slice(change.to)
 expect(text).toBe(result?.text);expect(result?.assets.copied).toBe(1)
 expect(result?.text).toContain('![dos][FOTO]');expect(result?.text).toContain('"Referencia"');expect(result?.text).toContain('<details><summary>Más</summary>');expect(await readFile(path,'utf8')).toBe(source)
})

for(const fixture of [{name:'formato no admitido',nameFile:'no.pdf',bytes:PNG,error:/formato|imagen/i},{name:'mayor de 8 MiB',nameFile:'grande.png',bytes:Buffer.alloc(8*1024*1024+1),error:/8 MiB/}])it(`Buscar rechaza ${fixture.name} sin modificar el documento ni publicar activos`,async()=>{
 const {doc,path,source}=await original('![x](a.assets/falta.png)');await selectedImage(fixture.nameFile,fixture.bytes)
 await expect(docs.locateImage(doc.id,'a.assets/falta.png')).rejects.toThrow(fixture.error)
 expect(docs.info(doc.id)).toMatchObject({path,text:source,dirty:false});expect(await readdir(join(dirname(path),'a.assets'))).toEqual(['x.png'])
})

it.skipIf(process.platform==='win32')('Buscar rechaza una selección que sea enlace simbólico',async()=>{
 const {doc,path,source}=await original('![x](a.assets/falta.png)'),real=await selectedImage(),link=join(dirname(real),'enlace.png');await symlink(real,link);state.pickImage=link
 await expect(docs.locateImage(doc.id,'a.assets/falta.png')).rejects.toThrow(/simb[oó]lic/i)
 expect(docs.info(doc.id)).toMatchObject({path,text:source,dirty:false});expect(await readdir(join(dirname(path),'a.assets'))).toEqual(['x.png'])
})

it('Buscar revierte su archivo parcial ante ENOSPC y conserva activos anteriores',async()=>{
 const {doc,path,source}=await original('![x](a.assets/falta.png)');await selectedImage();state.failCopy=1;state.partialCopy=true
 await expect(docs.locateImage(doc.id,'a.assets/falta.png')).rejects.toThrow(/espacio/i)
 expect(await readdir(join(dirname(path),'a.assets'))).toEqual(['x.png']);expect(docs.info(doc.id)).toMatchObject({path,text:source,dirty:false});expect(await readFile(path,'utf8')).toBe(source)
})

it('Buscar no publica activos si el snapshot cambió durante el selector',async()=>{
 const {doc,path,source}=await original('![x](a.assets/falta.png)');await selectedImage()
 // Inyección de carrera de prueba: simula un cambio de snapshot ajeno a la cola serial, sin API nueva de producto.
 state.pickerHook=()=>{const record=docs.records.get(doc.id)!;record.text+='\nCambio concurrente';record.info.revision++}
 await expect(docs.locateImage(doc.id,'a.assets/falta.png')).rejects.toThrow(/cambi[oó]|vuelve/i)
 expect(await readdir(join(dirname(path),'a.assets'))).toEqual(['x.png']);expect(await readFile(path,'utf8')).toBe(source)
})

it('FREYALAB_TEST_IMAGE_PATH se usa solo en modo de prueba y preserva SVG editable sin limpiarlo',async()=>{
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" data-editable="sí"><!-- metadata original --><path d="M0 0L1 1"/></svg>'),{doc,path}=await original('![x](a.assets/falta.svg)'),selected=await selectedImage('dibujo.svg',svg)
 state.pickImage='';vi.stubEnv('FREYALAB_TEST_IMAGE_PATH',selected)
 const result=await docs.locateImage(doc.id,'a.assets/falta.svg');expect(state.pickers).toBe(0)
 const imported=result!.assets.changes[0].insert;expect(imported).toMatch(/^a\.assets\/[a-f0-9-]{36}\.svg$/);expect(await readFile(join(dirname(path),imported))).toEqual(svg);expect(await readFile(selected)).toEqual(svg)
})


it('Buscar no deja un activo si el texto parcheado rebasa el límite del documento',async()=>{
 const {doc,path,source}=await original('![x](a.assets/falta.png)');await selectedImage()
 const bytes=Buffer.byteLength.bind(Buffer),probe=vi.spyOn(Buffer,'byteLength').mockImplementation((value,encoding)=>typeof value==='string'&&/a\.assets\/[a-f0-9-]{36}\.png/.test(value)?10*1024*1024+1:bytes(value,encoding))
 try{await expect(docs.locateImage(doc.id,'a.assets/falta.png')).rejects.toThrow(/10 MiB|l[ií]mite/i)}finally{probe.mockRestore()}
 expect(await readdir(join(dirname(path),'a.assets'))).toEqual(['x.png']);expect(docs.info(doc.id)).toMatchObject({path,text:source,dirty:false})
})

it('Guardar como no publica un texto que crezca por encima del límite al cambiar sus URL',async()=>{
 const {doc,path,source}=await original(),bytes=Buffer.byteLength.bind(Buffer),probe=vi.spyOn(Buffer,'byteLength').mockImplementation((value,encoding)=>typeof value==='string'&&value.includes('b.assets/x.png')?10*1024*1024+1:bytes(value,encoding))
 try{await expect(docs.save(doc.id,true)).rejects.toThrow(/10 MiB|l[ií]mite/i)}finally{probe.mockRestore()}
 expect(await readdir(dirname(state.target))).toEqual([]);expect(docs.info(doc.id)).toMatchObject({path,text:source,dirty:false});expect(await readFile(path,'utf8')).toBe(source)
})

it('Guardar tras Guardar como por alias de carpeta conserva la protección de hash frente a cambios externos',async()=>{
 const {doc,path,source}=await original('# Original sin imágenes\n',{}),targetDirectory=dirname(state.target),alias=join(state.folder,'alias-destino')
 await symlink(targetDirectory,alias,process.platform==='win32'?'junction':'dir');state.target=join(alias,'b.md');vi.stubEnv('FREYALAB_TEST_SAVE_PATH',state.target)
 const saved=await docs.save(doc.id,true);expect(saved?.path).toBe(state.target)
 const physical=join(targetDirectory,'b.md');await writeFile(physical,'Cambio externo que debe conservarse.\n');await docs.update(doc.id,'Edición local pendiente.\n')
 await expect(docs.save(doc.id)).rejects.toThrow(/cambió.*disco/i)
 expect(await readFile(physical,'utf8')).toBe('Cambio externo que debe conservarse.\n');expect(await readFile(path,'utf8')).toBe(source)
 expect(docs.info(doc.id)).toMatchObject({path:state.target,text:'Edición local pendiente.\n',dirty:true})
})

it('Guardar legítimo por alias reutiliza sus activos y no intenta copiarlos sobre sí mismos',async()=>{
 const {doc,path,source}=await original(),targetDirectory=dirname(state.target),alias=join(state.folder,'alias-destino')
 await symlink(targetDirectory,alias,process.platform==='win32'?'junction':'dir');state.target=join(alias,'b.md');vi.stubEnv('FREYALAB_TEST_SAVE_PATH',state.target)
 const first=await docs.save(doc.id,true),text=`${first!.text}\nEdición posterior.`;await docs.update(doc.id,text)
 const saved=await docs.save(doc.id)
 expect(saved).toMatchObject({path:state.target,text,dirty:false});expect(saved).not.toHaveProperty('assets')
 expect(await readFile(join(targetDirectory,'b.md'),'utf8')).toBe(text);expect(await readFile(path,'utf8')).toBe(source)
 expect(await docs.image(doc.id,'b.assets/x.png')).toBe(`data:image/png;base64,${PNG.toString('base64')}`)
 expect(await readdir(join(targetDirectory,'b.assets'))).toEqual(['x.png'])
})
