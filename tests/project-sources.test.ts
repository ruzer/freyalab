import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import fs,{mkdtemp,mkdir,readFile,rename,rm,symlink,writeFile} from 'node:fs/promises'
import {syncBuiltinESMExports} from 'node:module'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {fingerprintCsvSource,prepareCsvSource,quickCsvSource,findSourceByFingerprint} from '../src/main/project-sources'

let root:string,folder:string
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')
beforeEach(async()=>{root=await mkdtemp(join(tmpdir(),'freya-project-source-'));folder=join(root,'proyecto');await mkdir(folder)})
afterEach(async()=>{await rm(root,{recursive:true,force:true})})

describe('PRJ-01b · huella y formato de fuentes',()=>{
 it('fija la codificación, el esquema físico y la huella sin alterar el CSV',async()=>{
  const file=join(folder,'datos.csv'),original=Buffer.from('\ufeffID;;ID\r\n00123;"a\r\nb";9007199254740993\r\n','utf8')
  await writeFile(file,original)
  const draft=await prepareCsvSource(file)
  expect(draft).toMatchObject({bytes:original.length,format:{encoding:'utf8',delimiter:';',bom:true,header:true,eol:'\r\n',finalEol:true},
   columns:[{position:1,name:'ID'},{position:2,name:''},{position:3,name:'ID'}]})
  const events:number[]=[]
  const result=await fingerprintCsvSource(file,{progress:done=>events.push(done)})
  expect(result).toMatchObject({sha256:sha(original),quick:{headSha256:sha(original),tailSha256:sha(original)}})
  expect(events.at(-1)).toBe(original.length)
  expect(await quickCsvSource(file)).toEqual({bytes:original.length,quick:result.quick})
  expect(await readFile(file)).toEqual(original)
 })
 it('no guarda encabezados inventados al corregir un CSV sin encabezado',async()=>{
  const file=join(folder,'datos.csv');await writeFile(file,'abc,def\n')
  const draft=await prepareCsvSource(file,{header:false})
  expect(draft.columns).toEqual([{position:1,name:''},{position:2,name:''}])
 })
 it('rechaza una vista previa cuyo primer registro queda cortado',async()=>{
  const file=join(folder,'datos.csv');await writeFile(file,'x'.repeat(1024*1024+50)+'\n')
  await expect(prepareCsvSource(file)).rejects.toThrow()
 })
 it('cancela la huella al primer bloque y conserva el archivo',async()=>{
  const file=join(folder,'datos.csv'),original=Buffer.from('a,b\n'.repeat(100000))
  await writeFile(file,original)
  const control=new AbortController(),events:number[]=[]
  await expect(fingerprintCsvSource(file,{signal:control.signal,progress:done=>{events.push(done);control.abort()}})).rejects.toHaveProperty('name','AbortError')
  expect(events).toHaveLength(1)
  expect(events[0]).toBeLessThan(original.length)
  expect(await readFile(file)).toEqual(original)
 })
 it.skipIf(process.platform==='win32')('omite directorios enlazados fuera del proyecto',async()=>{
  const external=join(root,'fuera');await mkdir(external);const path=join(external,'datos.csv');await writeFile(path,'ID\n1\n')
  const known=await fingerprintCsvSource(path);await symlink(external,join(folder,'enlace'),'dir')
  await expect(findSourceByFingerprint(folder,known.bytes,known.sha256)).resolves.toBeNull()
 })
 it('solo reenlaza dentro del proyecto por tamaño y SHA-256 completo',async()=>{
  const original=Buffer.from('ID\n00001\n'),file=join(folder,'original.csv'),sub=join(folder,'sub')
  await mkdir(sub);await writeFile(file,original)
  const known=await fingerprintCsvSource(file)
  await rename(file,join(root,'fuera.csv'))
  await writeFile(join(sub,'mismo-tamaño.csv'),'ID\n00002\n')
  await expect(findSourceByFingerprint(folder,original.length,known.sha256)).resolves.toBeNull()
  const moved=join(sub,'renombrado.csv');await writeFile(moved,original)
  await expect(findSourceByFingerprint(folder,original.length,known.sha256)).resolves.toBe(await import('node:fs/promises').then(fs=>fs.realpath(moved)))
 })
})

import {ProjectStore} from '../src/main/projects'
import {ProjectSourceRegistry} from '../src/main/project-source-registry'
import {projectFile} from '../src/shared/project'

describe('PRJ-01b · registro en un proyecto',()=>{
 it('cancela antes de guardar y registra después con ruta relativa e historial',async()=>{
  const profile=join(root,'profile');await mkdir(profile)
  const store=new ProjectStore(profile),project=await store.create(folder,'Proyecto',false)
  const file=join(folder,'datos.csv'),original=Buffer.from('ID,Grupo\r\n00123,Oaxaca\r\n'.repeat(100000))
  await writeFile(file,original)
  let opened:{rowCount:number;headers:string[]}|undefined
  const registry=new ProjectSourceRegistry(store,async()=>false,()=>{},()=>opened)
  const draft=await registry.prepare(file,{},true)
  const before=await readFile(join(folder,projectFile))
  const cancel=new AbortController()
  await expect(registry.register(project.id,draft.id,{},cancel.signal,()=>cancel.abort(),async()=>false)).rejects.toHaveProperty('name','AbortError')
  expect(await readFile(join(folder,projectFile))).toEqual(before)
  await registry.register(project.id,draft.id,{},undefined,undefined,async()=>false)
  const [source]=store.sources
  expect(source).toMatchObject({path:'datos.csv',external:false,protection:'readonly',sha256:sha(original)})
  expect((await registry.list())[0]).toMatchObject({status:'verified',overAnalysis:false})
  opened={rowCount:40000,headers:Array(200).fill('Columna')}
  expect((await registry.list())[0].overAnalysis).toBe(false)
  opened.rowCount++
  expect((await registry.list())[0].overAnalysis).toBe(true)
  await writeFile(file,'ID,Grupo\r\n00999,Puebla\r\n')
  expect((await registry.list())[0].status).toBe('changed')
  await registry.reregister(project.id,source.id,undefined,undefined,async()=>false)
  expect(store.sources[0].history).toEqual([sha(original)])
 })
 it('una ruta externa de un manifiesto carece de permiso hasta confirmarla en el selector',async()=>{
  const profile=join(root,'profile');await mkdir(profile)
  const store=new ProjectStore(profile),project=await store.create(folder,'Proyecto',false),outside=join(root,'externa.csv')
  await writeFile(outside,'ID\n1\n')
  const registry=new ProjectSourceRegistry(store,async()=>false,()=>{})
  const draft=await registry.prepare(outside,{},true)
  await registry.register(project.id,draft.id,{},undefined,undefined,async()=>false)
  expect(store.sources[0]).toMatchObject({path:outside,external:true})
  const withoutConsent=new ProjectSourceRegistry(store,async()=>false,()=>{})
  const access=vi.spyOn(fs,'realpath');syncBuiltinESMExports()
  try{
   expect((await withoutConsent.list())[0]).toMatchObject({status:'external',external:true})
   await expect(withoutConsent.openPath(store.sources[0].id)).rejects.toThrow()
   expect(access).not.toHaveBeenCalledWith(outside)
  }finally{access.mockRestore();syncBuiltinESMExports()}
  await withoutConsent.authorizeExternal(store.sources[0].id,outside)
  expect((await withoutConsent.list())[0].status).toBe('verified')
 })
})
