import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import iconv from 'iconv-lite'

const state=vi.hoisted(()=>({directory:'',response:0}))
vi.mock('electron',()=>({app:{getPath:()=>state.directory},dialog:{showMessageBox:async()=>({response:state.response})},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:()=>{const watcher={on:()=>watcher,close:async()=>{}};return watcher}}))
vi.mock('../src/main/table-client',()=>({TableClient:class{stop(){}}}))
import {Documents} from '../src/main/documents'

let documents:Documents
const mixed='# Café\r\nprimera\nsegunda\rtercera'
const utf8=Buffer.from([0xef,0xbb,0xbf]),little=Buffer.from([0xff,0xfe]),big=Buffer.from([0xfe,0xff])
const bytes=(source:string,encoding:string,bom=Buffer.alloc(0))=>Buffer.concat([bom,iconv.encode(source,encoding)])
async function fixture(name:string,data:Buffer){const path=join(state.directory,name);await writeFile(path,data);return path}
beforeEach(async()=>{state.directory=await realpath(await mkdtemp(join(tmpdir(),'freya-text-encoding-')));state.response=0;documents=new Documents(()=>{})})
afterEach(async()=>{try{await documents.shutdown()}finally{vi.unstubAllEnvs();await rm(state.directory,{recursive:true,force:true})}})

it.each([
 ['notas.md','utf8',Buffer.alloc(0)],
 ['notas.md','utf8',utf8],
 ['diagrama.mmd','utf16le',little],
 ['notas.txt','utf16be',big],
] as const)('abre y guarda %s en %s conservando BOM y finales mixtos',async(name,encoding,bom)=>{
 const original=bytes(mixed,encoding,bom),path=await fixture(name,original),document=await documents.open(path)
 expect(document).toMatchObject({text:mixed,encoding,bom:!!bom.length,dirty:false,readonly:false})
 await documents.save(document.id)
 expect(await readFile(path)).toEqual(original)
 await documents.update(document.id,mixed+'\r\nñ')
 await documents.save(document.id)
 expect(await readFile(path)).toEqual(bytes(mixed+'\r\nñ',encoding,bom))
})

it('pide confirmar un texto de un byte, y Latin-1 conserva incluso un byte indefinido en Windows-1252',async()=>{
 const source=mixed+'\u0081',original=bytes(source,'latin1'),path=await fixture('notas.txt',original),document=await documents.open(path)
 expect(document).toMatchObject({encoding:'win1252',encodingPending:true,readonly:true,dirty:false})
 await expect(documents.save(document.id)).rejects.toThrow()
 await expect(documents.reopenTextEncoding(document.id,'win1252')).rejects.toThrow()
 expect(documents.info(document.id)).toEqual(document)
 const reopened=await documents.reopenTextEncoding(document.id,'latin1')
 expect(reopened).toMatchObject({id:document.id,encoding:'latin1',text:source,readonly:false})
 expect(reopened.encodingPending).toBeFalsy()
 expect(await readFile(path)).toEqual(original)
 await documents.save(document.id)
 expect(await readFile(path)).toEqual(original)
})

it('al reabrir, Cancelar conserva cambios y una lectura incompatible tampoco los descarta',async()=>{
 const original=bytes(mixed,'utf8',utf8),path=await fixture('notas.md',original),document=await documents.open(path)
 const draft=mixed+'\nBorrador'
 const updated=await documents.update(document.id,draft)
 expect(await documents.reopenTextEncoding(document.id,'utf16le')).toEqual(updated)
 state.response=1
 await expect(documents.reopenTextEncoding(document.id,'utf16le')).rejects.toThrow(/BOM/)
 expect(documents.info(document.id)).toEqual(updated)
 expect(await readFile(path)).toEqual(original)
})

it('al guardar en otra codificación conserva BOM, y no sobrescribe si el destino no admite los caracteres',async()=>{
 const original=bytes(mixed,'utf8'),path=await fixture('notas.txt',original),document=await documents.open(path)
 const draft=mixed+'\n🐶'
 await documents.update(document.id,draft)
 await expect(documents.saveTextEncoding(document.id,'latin1')).rejects.toThrow(/línea 5/)
 expect(documents.info(document.id)).toMatchObject({text:draft,encoding:'utf8',dirty:true})
 expect(await readFile(path)).toEqual(original)
 expect(await documents.saveTextEncoding(document.id,'utf16be')).toMatchObject({encoding:'utf16be',bom:true,dirty:false})
 const encoded=bytes(draft,'utf16be',big)
 expect(await readFile(path)).toEqual(encoded)
 await expect(documents.saveTextEncoding(document.id,'win1252')).rejects.toThrow(/BOM/)
 expect(await readFile(path)).toEqual(encoded)
 expect(await documents.saveTextEncoding(document.id,'utf8')).toMatchObject({encoding:'utf8',bom:true})
 expect(await readFile(path)).toEqual(bytes(draft,'utf8',utf8))
})

it('Guardar como conserva la codificación y el BOM en una copia de Markdown',async()=>{
 const original=bytes(mixed,'utf16le',little),path=await fixture('original.md',original),document=await documents.open(path)
 const copy=join(state.directory,'copia.md')
 vi.stubEnv('FREYALAB_TEST','1');vi.stubEnv('FREYALAB_TEST_SAVE_PATH',copy)
 expect(await documents.save(document.id,true)).toMatchObject({path:copy,encoding:'utf16le',bom:true})
 expect(await readFile(path)).toEqual(original)
 expect(await readFile(copy)).toEqual(original)
})

it('recupera un borrador en UTF-16 BE y escribe una copia sin tocar el original',async()=>{
 const original=bytes(mixed,'utf16be',big),path=await fixture('original.mmd',original),document=await documents.open(path),draft=mixed+'\nBorrador'
 await documents.update(document.id,draft)
 await documents.checkpoint(document.id)
 const recovered=await documents.recover(document.id),copy=join(state.directory,'copia.mmd')
 expect(recovered).toMatchObject({path:null,encoding:'utf16be',bom:true,text:draft,dirty:true})
 vi.stubEnv('FREYALAB_TEST','1');vi.stubEnv('FREYALAB_TEST_SAVE_PATH',copy)
 await documents.save(recovered.id)
 expect(await readFile(copy)).toEqual(bytes(draft,'utf16be',big))
 expect(await readFile(path)).toEqual(original)
})

it('migra una recuperación antigua cuyo texto incluía el BOM de UTF-8',async()=>{
 const directory=join(state.directory,'recovery')
 await mkdir(directory);await writeFile(join(directory,'a.json'),JSON.stringify({version:1,info:{kind:'markdown',name:'original.md'},snapshot:{text:'\uFEFF'+mixed}}))
 const recovered=await documents.recover('a'),copy=join(state.directory,'copia.md')
 expect(recovered).toMatchObject({path:null,encoding:'utf8',bom:true,text:mixed,dirty:true})
 vi.stubEnv('FREYALAB_TEST','1');vi.stubEnv('FREYALAB_TEST_SAVE_PATH',copy)
 await documents.save(recovered.id)
 expect(await readFile(copy)).toEqual(bytes(mixed,'utf8',utf8))
})

it('verifica UTF-8 completo aunque el primer MiB sea ASCII',async()=>{
 const source='a'.repeat(1024*1024+16)+' café',original=bytes(source,'win1252'),path=await fixture('notas.txt',original),document=await documents.open(path)
 expect(document).toMatchObject({encoding:'win1252',encodingPending:true,readonly:true})
 expect(await documents.reopenTextEncoding(document.id,'win1252')).toMatchObject({text:source,readonly:false})
 await documents.save(document.id);expect(await readFile(path)).toEqual(original)
})

it('un cambio externo impide convertir y conserva el borrador y la codificación',async()=>{
 const path=await fixture('notas.txt',bytes(mixed,'utf8',utf8)),document=await documents.open(path)
 const draft=await documents.update(document.id,mixed+'\nBorrador')
 const external=bytes('Externo','utf8',utf8);await writeFile(path,external)
 await expect(documents.saveTextEncoding(document.id,'utf16be')).rejects.toThrow(/cambió/i)
 expect(documents.info(document.id)).toEqual(draft)
 expect(await readFile(path)).toEqual(external)
})

it('CSV Texto conserva su ida y vuelta UTF-16 LE incluso con un sustituto aislado',async()=>{
 const source='id,valor\n1,\uD800\n',original=bytes(source,'utf16le',little),path=await fixture('datos.csv',original),document=await documents.open(path,'text')
 expect(document).toMatchObject({csvView:'text',readonly:false,text:source})
 await documents.save(document.id)
 expect(await readFile(path)).toEqual(original)
 const draft=source+'2,otro\n'
 await documents.update(document.id,draft);await documents.checkpoint(document.id)
 const recovered=await documents.recover(document.id),copy=join(state.directory,'copia.csv')
 vi.stubEnv('FREYALAB_TEST','1');vi.stubEnv('FREYALAB_TEST_SAVE_PATH',copy)
 await documents.save(recovered.id)
 expect(await readFile(copy)).toEqual(bytes(draft,'utf16le',little))
 expect(await readFile(path)).toEqual(original)
})

it('un documento de texto no escribe un sustituto aislado al convertir a UTF-16',async()=>{
 const path=await fixture('notas.txt',bytes(mixed,'utf8')),document=await documents.open(path)
 const draft=await documents.update(document.id,mixed+'\n\uD800')
 await expect(documents.saveTextEncoding(document.id,'utf16le')).rejects.toThrow(/línea 5/)
 expect(documents.info(document.id)).toEqual(draft)
 expect(await readFile(path)).toEqual(bytes(mixed,'utf8'))
})
