import {afterEach,describe,expect,it,vi} from 'vitest'
import {mkdtemp,writeFile,readFile,rm,mkdir,symlink,truncate,realpath,rename} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {loadBibliography,MAX_BIBLIOGRAPHY_BYTES} from '../src/main/bibliography'
import {setLanguage} from '../src/shared/i18n'

// Sólo se intercepta la frontera FS para colocar una mutación real entre syscalls.
const fsRace=vi.hoisted(()=>({afterRealpath:undefined as undefined|((path:unknown)=>Promise<void>)}))
vi.mock('node:fs/promises',async original=>{
 const fs=await original<typeof import('node:fs/promises')>()
 return{...fs,realpath:async(...args:Parameters<typeof fs.realpath>)=>{
  const path=await Reflect.apply(fs.realpath,undefined,args)
  await fsRace.afterRealpath?.(args[0])
  return path
 }}
})
const folders:string[]=[]
afterEach(async()=>{fsRace.afterRealpath=undefined;setLanguage('es');for(const folder of folders.splice(0))await rm(folder,{recursive:true,force:true})})
const reference={id:'garcia2020',type:'book',title:'Fuente sintética con ñ',author:[{family:'García',given:'Elena'}],issued:{'date-parts':[[2020,2,29]]},publisher:'Editorial local'}
async function fixture(content:string|Buffer=JSON.stringify([reference]),name='referencias.json'){
 const folder=await mkdtemp(join(tmpdir(),'freyalab-bibliography-'));folders.push(folder)
 const documentPath=join(folder,'informe.md'),path=join(folder,name)
 await writeFile(documentPath,'# Informe');await writeFile(path,content)
 return{folder,documentPath,path,read:()=>loadBibliography({documentPath,bibliographyPath:name})}
}
async function loadValue(value:unknown){return(await fixture(JSON.stringify(value))).read()}

it('lee referencias CSL JSON de la carpeta del documento y conserva Unicode y el archivo original',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freyalab-bibliography-'));folders.push(folder)
 const documentPath=join(folder,'informe.md'),path=join(folder,'referencias.json')
 const entries=[{id:'garcia2020',type:'book',title:'Fuente sintética con ñ',author:[{family:'García',given:'Elena'}],issued:{'date-parts':[[2020,2,29]]},publisher:'Editorial local'}]
 const original=JSON.stringify(entries,null,2)+'\n'
 await writeFile(documentPath,'# Informe');await writeFile(path,original)
 const result=await loadBibliography({documentPath,bibliographyPath:'referencias.json'})
 expect(result).toMatchObject({ok:true,entries,bytes:Buffer.byteLength(original)})
 expect(await readFile(path,'utf8')).toBe(original)
})

describe('B4 · confinamiento a la carpeta real del documento',()=>{
 it('admite rutas con espacios, subcarpetas y ruta absoluta canónica',async()=>{
  const {folder,documentPath}=await fixture();await mkdir(join(folder,'fuentes con espacios'))
  const path=join(folder,'fuentes con espacios','archivo CSL.json');await writeFile(path,JSON.stringify([reference]))
  expect(await loadBibliography({documentPath,bibliographyPath:join('fuentes con espacios','archivo CSL.json')})).toMatchObject({ok:true,path:await realpath(path)})
  expect(await loadBibliography({documentPath,bibliographyPath:await realpath(path)})).toMatchObject({ok:true})
 })
 it('rechaza una ruta relativa que sale de la carpeta aunque exista',async()=>{
  const inside=await fixture(),outside=await fixture()
  expect(await loadBibliography({documentPath:inside.documentPath,bibliographyPath:join('..',outside.folder.split(/[\\/]/).at(-1)!,'referencias.json')})).toMatchObject({ok:false,error:{code:'outside'}})
 })
 it('rechaza un archivo absoluto externo y una carpeta hermana con el mismo prefijo',async()=>{
  const {folder,documentPath}=await fixture(),sibling=folder+'-hermana';folders.push(sibling)
  await mkdir(sibling);const path=join(sibling,'referencias.json');await writeFile(path,JSON.stringify([reference]))
  expect(await loadBibliography({documentPath,bibliographyPath:path})).toMatchObject({ok:false,error:{code:'outside'}})
 })
 it('rechaza enlaces de directorio que conducen fuera, también junctions de Windows',async()=>{
  const inside=await fixture(),outside=await fixture()
  await symlink(outside.folder,join(inside.folder,'alias'),process.platform==='win32'?'junction':'dir')
  expect(await loadBibliography({documentPath:inside.documentPath,bibliographyPath:join('alias','referencias.json')})).toMatchObject({ok:false,error:{code:'outside'}})
 })
 it('rechaza sustituir una carpeta interna por un enlace externo después de resolver la ruta',async()=>{
  const inside=await fixture(),outside=await fixture(JSON.stringify([{...reference,title:'CANARIO EXTERNO'}]))
  const directory=join(inside.folder,'fuentes'),path=join(directory,'referencias.json')
  await mkdir(directory);await writeFile(path,JSON.stringify([reference]))
  fsRace.afterRealpath=async candidate=>{
   if(candidate!==path)return
   fsRace.afterRealpath=undefined
   await rename(directory,join(inside.folder,'fuentes-anteriores'))
   await symlink(outside.folder,directory,process.platform==='win32'?'junction':'dir')
  }
  const result=await loadBibliography({documentPath:inside.documentPath,bibliographyPath:path})
  expect(result.ok&&result.entries[0]?.title).not.toBe('CANARIO EXTERNO')
  expect(result).toMatchObject({ok:false,error:{code:'outside'}})
 })
 it('admite un enlace interno y resuelve la ubicación real del documento',async()=>{
  const {folder,documentPath,path}=await fixture(),alias=folder+'-alias';folders.push(alias)
  await symlink(folder,alias,process.platform==='win32'?'junction':'dir')
  expect(await loadBibliography({documentPath:join(alias,'informe.md'),bibliographyPath:join(alias,'referencias.json')})).toMatchObject({ok:true,path:await realpath(path)})
  expect(await loadBibliography({documentPath,bibliographyPath:'referencias.json'})).toMatchObject({ok:true})
 })
 it.each(['','  ','https://example.invalid/bibliography.json','file:///tmp/referencias.json','ref\0.json'])('rechaza la selección no válida %j sin excepciones',async bibliographyPath=>{
  const {documentPath}=await fixture()
  await expect(loadBibliography({documentPath,bibliographyPath})).resolves.toMatchObject({ok:false,error:{code:'invalid-path'}})
 })
 it('no usa un directorio como documento para ampliar el alcance',async()=>{
  const {folder}=await fixture()
  expect(await loadBibliography({documentPath:folder,bibliographyPath:'referencias.json'})).toMatchObject({ok:false,error:{code:'invalid-path'}})
 })
 it('archivo ausente o directorio seleccionado dan errores estructurados sin revelar rutas',async()=>{
  const {folder,documentPath}=await fixture()
  const missing=await loadBibliography({documentPath,bibliographyPath:'ausente.json'})
  expect(missing).toMatchObject({ok:false,error:{code:'unavailable'}})
  if(!missing.ok)expect(missing.error.message).not.toContain(folder)
  expect(await loadBibliography({documentPath,bibliographyPath:'.'})).toMatchObject({ok:false,error:{code:'not-file'}})
 })
})

describe('B1 · bytes, codificación, JSON y snapshot',()=>{
 it('acepta exactamente 10 MiB y rechaza un byte más sin alterar el archivo',async()=>{
  expect(MAX_BIBLIOGRAPHY_BYTES).toBe(10*1024*1024)
  const bytes=Buffer.alloc(MAX_BIBLIOGRAPHY_BYTES,0x20);bytes.write('[]')
  const file=await fixture(bytes)
  expect(await file.read()).toMatchObject({ok:true,bytes:MAX_BIBLIOGRAPHY_BYTES,entries:[]})
  await truncate(file.path,MAX_BIBLIOGRAPHY_BYTES+1)
  expect(await file.read()).toMatchObject({ok:false,error:{code:'too-large'}})
 })
 it('rechaza UTF-8 inválido en vez de sustituir caracteres',async()=>{
  const file=await fixture(Buffer.from([0x5b,0xc3,0x28,0x5d]))
  expect(await file.read()).toMatchObject({ok:false,error:{code:'encoding'}})
 })
 it('acepta BOM UTF-8 y el hash corresponde a los bytes originales, incluidos formato y BOM',async()=>{
  const bytes=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(JSON.stringify([reference]))]),file=await fixture(bytes)
  const loaded=await file.read()
  expect(loaded).toMatchObject({ok:true,entries:[reference],sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length})
  expect(await readFile(file.path)).toEqual(bytes)
 })
 it('una edición del archivo invalida su hash aunque las referencias sean iguales',async()=>{
  const file=await fixture('[]'),first=await file.read();await writeFile(file.path,'[]\n');const second=await file.read()
  expect(first.ok&&second.ok).toBe(true)
  if(first.ok&&second.ok){expect(first.sha256).toMatch(/^[0-9a-f]{64}$/);expect(second.sha256).not.toBe(first.sha256);expect(second.entries).toEqual(first.entries)}
 })
 it('produce un snapshot de bytes privado para exportar sin releer la ruta',async()=>{
  const raw=Buffer.from(JSON.stringify([reference])+'\n'),file=await fixture(raw)
  expect(await file.read()).toMatchObject({ok:true,snapshot:{format:'csl-json',content:raw,sha256:createHash('sha256').update(raw).digest('hex')}})
 })
 it('un BibTeX sin Pandoc explica la instalación, no lo diagnostica como JSON',async()=>{
  const file=await fixture('@book{garcia2020, title={Fuente sintética}, year={2020}}','referencias.bib')
  const result=await loadBibliography({documentPath:file.documentPath,bibliographyPath:'referencias.bib',pandocPath:join(file.folder,'pandoc-ausente.exe')})
  expect(result).toMatchObject({ok:false,error:{code:'pandoc-required'}})
  if(!result.ok){expect(result.error.message).toContain('https://pandoc.org/installing.html');expect(result.error.message).not.toContain('JSON no válido')}
 })
 it('informa la línea y columna de un error JSON con CRLF',async()=>{
  const file=await fixture('[\r\n  {"id":"a","type":"book"},\r\n]')
  expect(await file.read()).toMatchObject({ok:false,error:{code:'syntax',location:{line:3,column:1}}})
 })
 it('localiza un token inválido dentro de una referencia, no sólo el inicio del archivo',async()=>{
  const file=await fixture('[\n {"id":"u","type":"book","title": undefined}\n]')
  expect(await file.read()).toMatchObject({ok:false,error:{code:'syntax',location:{line:2,column:35}}})
 })
 it('localiza el final prematuro del JSON',async()=>{
  const file=await fixture('[\n {"id":"a","type":"book"}')
  expect(await file.read()).toMatchObject({ok:false,error:{code:'syntax',location:{line:2,column:26}}})
 })
 it('distingue un cierre inválido de otros cierres válidos del mismo carácter',async()=>{
  const file=await fixture('[\n {"id":"a","type":"book","author":[{"family":"Uno"}]},\n]')
  expect(await file.read()).toMatchObject({ok:false,error:{code:'syntax',location:{line:3,column:1}}})
 })
 it('un texto position dentro del documento no se confunde con un offset del motor',async()=>{
  const file=await fixture('{"position 9":u}')
  expect(await file.read()).toMatchObject({ok:false,error:{code:'syntax',location:{line:1,column:15}}})
 })
 it('localiza un cierre inválido en 10 MiB con parseos acotados, sin escanear cada prefijo',async()=>{
  const record='{"id":"a","type":"book","author":[{"family":"A"}],"title":"'+'x'.repeat(100)+'"},\n'
  const count=Math.floor((MAX_BIBLIOGRAPHY_BYTES-3)/record.length),start='[\n'+record.repeat(count),padding=MAX_BIBLIOGRAPHY_BYTES-start.length-1
  const file=await fixture(start+' '.repeat(padding)+']'),parse=vi.spyOn(JSON,'parse')
  try{
   expect(await file.read()).toMatchObject({ok:false,error:{code:'syntax',location:{line:count+2,column:padding+1}}})
   expect(parse.mock.calls.length).toBeLessThanOrEqual(32)
  }finally{parse.mockRestore()}
 },10_000)
 it('traduce los mensajes en origen y conserva los códigos y ubicación estructurada',async()=>{
  setLanguage('en');const file=await fixture('[\r\n  {"id":"a","type":"book"},\r\n]'),result=await file.read()
  expect(result).toMatchObject({ok:false,error:{code:'syntax',location:{line:3,column:1}}})
  if(!result.ok)expect(result.error.message).toBe('The bibliography contains invalid JSON (line 3, column 1).')
 })
})

describe('B1 · registros CSL JSON estrictos',()=>{
 it.each([null,{},'texto',42])('exige una lista, no %j',async value=>{
  expect(await loadValue(value)).toMatchObject({ok:false,error:{code:'schema'}})
 })
 it.each([
  ['registro nulo',null],['registro textual','fuente'],['falta id',{type:'book'}],['falta tipo',{id:'x'}],
  ['id vacío',{...reference,id:''}],['id en blanco',{...reference,id:'  '}],['id con control',{...reference,id:'a\nb'}],
  ['id booleano',{...reference,id:true}],['id decimal',{...reference,id:1.25}],['id redondeado',{...reference,id:9007199254740992}],
  ['tipo inexistente',{...reference,type:'tipo-inventado'}],['título no textual',{...reference,title:['título']}],
  ['autor no listado',{...reference,author:'García'}],['autor vacío',{...reference,author:[{}]}],['apellido no textual',{...reference,author:[{family:17}]}],
  ['campo desconocido',{...reference,filters:['filtro.lua']}],['campo de nombre desconocido',{...reference,author:[{family:'García',script:'x'}]}],
  ['fecha vacía',{...reference,issued:{}}],['mes 13',{...reference,issued:{'date-parts':[[2020,13]]}}],
  ['29 de febrero no bisiesto',{...reference,issued:{'date-parts':[[2023,2,29]]}}],['31 de abril',{...reference,issued:{'date-parts':[[2020,4,31]]}}],
  ['fecha con cuatro partes',{...reference,issued:{'date-parts':[[2020,1,1,2]]}}],['intervalo invertido',{...reference,issued:{'date-parts':[[2024,3],[2024,2]]}}],
  ['categoría no textual',{...reference,categories:[7]}]
 ])('rechaza %s sin aceptar parcialmente la lista',async(_name,value)=>{
  expect(await loadValue([reference,value])).toMatchObject({ok:false,error:{code:'schema',entry:2}})
 })
 it.each([
  [{...reference,id:'x'},{...reference,id:'x'}],
  [{...reference,id:1},{...reference,id:'1'}]
 ])('rechaza claves duplicadas, incluidas las equivalentes numéricas/textuales (%#)',async(first,second)=>{
  expect(await loadValue([first,second])).toMatchObject({ok:false,error:{code:'duplicate-id',entry:2,field:'id'}})
 })
 it('conserva identificadores originales y fechas/autores legítimos sin coerción',async()=>{
  const entries=[{id:12,type:'book',author:[{literal:'Universidad Sintética'}],issued:{literal:'sin fecha'}},{id:'0012',type:'dataset',author:[{given:'Autor'}],issued:{'date-parts':[['2020','02','29'],['2021']]},custom:{revisado:true,valores:[null,'ñ',2]},'citation-key':'datos2020',journalAbbreviation:'RS',shortTitle:'Datos'}]
  expect(await loadValue(entries)).toMatchObject({ok:true,entries})
 })
 it('rechaza números no finitos que JSON.parse admite al desbordar exponentes',async()=>{
  for(const content of ['[{"id":1e400,"type":"book"}]','[{"id":"a","type":"book","custom":{"dato":1e400}}]']){
   expect(await(await fixture(content)).read()).toMatchObject({ok:false,error:{code:'schema',entry:1}})
  }
 })
})
