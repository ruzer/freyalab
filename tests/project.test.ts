import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import filesystem from 'node:fs/promises'
import {syncBuiltinESMExports} from 'node:module'
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ProjectStore} from '../src/main/projects'
import {projectManifest,projectFile,projectManifestJSONSchema} from '../src/shared/project'

let root:string,folder:string,store:ProjectStore
beforeEach(async()=>{
 root=await mkdtemp(join(tmpdir(),'freya-project-'))
 folder=join(root,'Censo');await mkdir(folder)
 const profile=join(root,'profile');await mkdir(profile)
 store=new ProjectStore(profile)
})
afterEach(async()=>{await rm(root,{recursive:true,force:true})})

describe('PRJ-01a · manifiesto y proyectos recientes',()=>{
 it('crea un manifiesto v1, con estructura opcional y sin sobrescribir proyectos existentes',async()=>{
  const active=await store.create(folder,'Población',true)
  const file=join(folder,projectFile)
  const bytes=await readFile(file,'utf8')
  expect(active).toMatchObject({name:'Población',readonly:false})
  expect(projectManifest.parse(JSON.parse(bytes))).toMatchObject({format:'freyalab-project',version:1,name:'Población',sources:[],recipes:[],results:[]})
  expect(projectManifestJSONSchema.required).toEqual(expect.arrayContaining(['format','version']))
  expect((await readdir(folder)).sort()).toEqual(['01_raw','02_datasets','03_charts','04_reports',projectFile])
  await expect(store.create(folder,'Otro nombre',false)).resolves.toEqual(active)
  expect(await readFile(file,'utf8')).toBe(bytes)
 })
 it('confirma un conflicto antes de renombrar y conserva el contenido ajeno',async()=>{
  const active=await store.create(folder,'Antes',false)
  const file=join(folder,projectFile)
  const external={...JSON.parse(await readFile(file,'utf8')),name:'Externo'}
  await writeFile(file,JSON.stringify(external))
  await expect(store.rename(active.id,'Local',async()=>false)).resolves.toMatchObject({name:'Externo'})
  expect(JSON.parse(await readFile(file,'utf8'))).toEqual(external)
  await writeFile(file,JSON.stringify({...external,name:'Segundo'}))
  await expect(store.rename(active.id,'Local',async()=>true)).resolves.toMatchObject({name:'Local'})
  expect(projectManifest.parse(JSON.parse(await readFile(file,'utf8')))).toEqual({...external,name:'Local'})
 })
 it('abre versiones futuras sin escribirlas y rechaza JSON inválido sin modificar el activo',async()=>{
  const file=join(folder,projectFile),future='{"format":"freyalab-project","version":2,"id":"future","name":"Por venir","unknown":{"keep":true}}'
  await writeFile(file,future)
  const active=await store.open(folder)
  expect(active).toMatchObject({id:'future',name:'Por venir',readonly:true})
  await expect(store.rename(active.id,'local',async()=>true)).rejects.toThrow()
  const broken=join(root,'Roto');await mkdir(broken);await writeFile(join(broken,projectFile),'{')
  await expect(store.open(broken)).rejects.toThrow()
  expect(store.active).toEqual(active)
  expect(await readFile(file,'utf8')).toBe(future)
 })
 it('valida la ruta protegida y la cadena de recetas del contrato',async()=>{
  await store.create(folder,'Población',false)
  const manifest=JSON.parse(await readFile(join(folder,projectFile),'utf8')),sha256='1'.repeat(64),date='2026-11-10T00:00:00.000Z'
  const source={id:'fuente',path:'datos.csv',external:false,protection:'readonly',bytes:10,sha256,registeredAt:date,
   quick:{mtimeMs:0,headSha256:sha256,tailSha256:sha256},format:{encoding:'utf8',bom:false,delimiter:',',header:true,eol:'\n',finalEol:true},
   schema:{sha256,columns:[{position:1,name:'ID'}]}}
  const recipe={id:'base',name:'Base',sourceId:source.id,sourceSha256:sha256,semantics:1,steps:[],createdAt:date}
  const derived={id:'sub',name:'Muestra',baseRecipeId:recipe.id,sourceSha256:sha256,semantics:1,
   steps:[{op:'sample',method:'random',percent:5,seed:7}],createdAt:date}
  const valid={...manifest,sources:[source],recipes:[recipe,derived]}
  expect(projectManifest.safeParse(valid).success).toBe(true)
  for(const invalid of [
   {...valid,sources:[{...source,path:'../otro.csv'}]},
   {...valid,sources:[{...source,path:'C:\\otro.csv'}]},
   {...valid,recipes:[{...derived,sourceId:source.id}]},
   {...valid,recipes:[{...derived,baseRecipeId:derived.id}]},
   {...valid,recipes:[{...derived,baseRecipeId:'no-existe'}]},
   {...valid,recipes:[{...recipe,sourceId:'no-existe'}]},
   {...valid,recipes:[recipe,...Array.from({length:8},(_,i)=>({...derived,id:'sub'+i,baseRecipeId:i?'sub'+(i-1):'base'}))]},
   {...valid,sources:[{...source,cells:['No pertenecen al manifiesto']}]}
  ])expect(projectManifest.safeParse(invalid).success,JSON.stringify(invalid)).toBe(false)
 })
 it('avisa si el sistema de archivos no admite creación atómica y deja intactos los datos',async()=>{
  await writeFile(join(folder,'original.txt'),'original')
  const link=vi.spyOn(filesystem,'link').mockRejectedValueOnce(Object.assign(new Error('unsupported'),{code:'ENOTSUP'}))
  syncBuiltinESMExports()
  try{
   await expect(store.create(folder,'Proyecto',true)).rejects.toThrow(/sistema de archivos|permisos/)
   expect(await readdir(folder)).toEqual(['original.txt'])
   expect(await readFile(join(folder,'original.txt'),'utf8')).toBe('original')
   expect(store.active).toBeNull()
  }finally{link.mockRestore();syncBuiltinESMExports()}
 })
 it('protege el manifiesto cuando dos procesos crean a la vez',async()=>{
  const secondProfile=join(root,'otro-perfil');await mkdir(secondProfile)
  const other=new ProjectStore(secondProfile)
  const created=await Promise.all([store.create(folder,'Primero',false),other.create(folder,'Segundo',false)])
  expect(created[0]).toEqual(created[1])
  expect(JSON.parse(await readFile(join(folder,projectFile),'utf8'))).toMatchObject({id:created[0].id,name:created[0].name})
 })
 it('vuelve a detectar un cambio en disco durante el diálogo de conflicto',async()=>{
  const active=await store.create(folder,'Original',false),file=join(folder,projectFile)
  const external={...JSON.parse(await readFile(file,'utf8')),name:'Externo'}
  await writeFile(file,JSON.stringify(external))
  const during=JSON.stringify({...external,name:'Otra edición'})
  await expect(store.rename(active.id,'Local',async()=>{await writeFile(file,during);return true})).rejects.toThrow()
  expect(await readFile(file,'utf8')).toBe(during)
 })
 it('publica exactamente el esquema JSON generado por el validador',async()=>{
  expect(JSON.parse(await readFile(new URL('../docs/design/project-manifest-v1.schema.json',import.meta.url),'utf8'))).toEqual(projectManifestJSONSchema)
 })
 it('abre el proyecto aunque el historial de recientes no se pueda actualizar',async()=>{
  const recent=join(root,'profile','recent-projects.json'),corrupt='{"contenido": "no sobrescribir"}'
  await writeFile(recent,corrupt)
  const active=await store.create(folder,'Proyecto',false)
  expect(store.active).toEqual(active)
  expect(store.recentWriteFailed).toBe(true)
  expect(await store.recents()).toEqual([])
  expect(await readFile(recent,'utf8')).toBe(corrupt)
  expect(projectManifest.parse(JSON.parse(await readFile(join(folder,projectFile),'utf8'))).name).toBe('Proyecto')
 })
 it('conserva hasta diez recientes y solo permite abrir rutas registradas',async()=>{
  await expect(store.openRecent(folder)).rejects.toThrow()
  for(let i=0;i<11;i++)await store.create(join(root,'Censo '+i),'Censo '+i,false)
  const recent=await store.recents()
  expect(recent.map(item=>item.name)).toEqual(['Censo 10','Censo 9','Censo 8','Censo 7','Censo 6','Censo 5','Censo 4','Censo 3','Censo 2','Censo 1'])
  await rm(recent[0].path,{recursive:true})
  expect((await store.recents())[0]).toMatchObject({missing:true})
  await store.forgetRecent(recent[0].path)
  expect((await store.recents()).map(item=>item.path)).not.toContain(recent[0].path)
 })
})
