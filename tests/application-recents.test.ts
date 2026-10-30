import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {createHash} from 'node:crypto'
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const native=vi.hoisted(()=>({folder:'',getPath:vi.fn()}))
vi.mock('electron',()=>({app:{getPath:native.getPath}}))
vi.mock('../src/main/files',async original=>{const actual=await original<typeof import('../src/main/files')>();return{...actual,atomicWrite:vi.fn(actual.atomicWrite)}})
import {atomicWrite} from '../src/main/files'
import {removeMissingRecent} from '../src/main/application-recents'

let path:string
beforeEach(async()=>{
 native.folder=await mkdtemp(join(tmpdir(),'freya-application-recents-'));path=join(native.folder,'recents.json')
 native.getPath.mockReset().mockImplementation(name=>{if(name!=='userData')throw new Error('Fuera del contrato');return native.folder})
 const actual=await vi.importActual<typeof import('../src/main/files')>('../src/main/files');vi.mocked(atomicWrite).mockReset().mockImplementation(actual.atomicWrite)
})
afterEach(async()=>{vi.restoreAllMocks();await rm(native.folder,{recursive:true,force:true})})

describe('APP-01 · recientes inexistentes',()=>{
 it('quita sólo el valor exacto y conserva el orden, Unicode y duplicados restantes',async()=>{
  const list=['/fuente/primero.md','/fuente/ausente.csv','/fuente/á🐶.mmd','/fuente/primero.md','/FUENTE/ausente.csv','/fuente/ausente.csv ']
  await writeFile(path,JSON.stringify(list));await removeMissingRecent('/fuente/ausente.csv')
  expect(JSON.parse(await readFile(path,'utf8'))).toEqual([list[0],...list.slice(2)]);expect(native.getPath).toHaveBeenCalledExactlyOnceWith('userData')
 })
 it('elimina todas las referencias repetidas al mismo ausente sin ordenar la lista',async()=>{
  await writeFile(path,'["ausente", "conservar", "ausente"]');await removeMissingRecent('ausente');expect(await readFile(path,'utf8')).toBe('["conservar"]')
 })
 it('al quitar el único reciente conserva un array vacío válido',async()=>{
  await writeFile(path,'["ausente"]');await removeMissingRecent('ausente');expect(await readFile(path,'utf8')).toBe('[]')
 })
 it('usa el SHA de los bytes leídos, incluidos espacios y saltos de línea',async()=>{
  const bytes=Buffer.from('[\n  "ausente",\n  "conservar"\n]\n');await writeFile(path,bytes);await removeMissingRecent('ausente')
  expect(atomicWrite).toHaveBeenCalledExactlyOnceWith(path,'["conservar"]',createHash('sha256').update(bytes).digest('hex'))
 })
 it('sin coincidencia no reescribe ni normaliza el JSON existente',async()=>{
  const bytes=Buffer.from('[\n  "conservar", "á🐶"\n]\n');await writeFile(path,bytes);await removeMissingRecent('ausente');expect(atomicWrite).not.toHaveBeenCalled();expect(await readFile(path)).toEqual(bytes)
 })
 it.each(['{','null','{"recents":["ausente"]}','["ausente",5]','["ausente",null]'])('JSON inválido o esquema distinto se conserva: %s',async data=>{
  await writeFile(path,data);await expect(removeMissingRecent('ausente')).rejects.toThrow();expect(await readFile(path,'utf8')).toBe(data);expect(atomicWrite).not.toHaveBeenCalled()
 })
 it('UTF-8 corrupto no se sustituye silenciosamente por caracteres de reemplazo',async()=>{
  const bytes=Buffer.concat([Buffer.from('["ausente","'),Buffer.from([0xff]),Buffer.from('"]')]);await writeFile(path,bytes);await expect(removeMissingRecent('ausente')).rejects.toThrow();expect(await readFile(path)).toEqual(bytes);expect(atomicWrite).not.toHaveBeenCalled()
 })
 it('no crea recents.json si la lectura falla',async()=>{
  await expect(removeMissingRecent('ausente')).rejects.toMatchObject({code:'ENOENT'});expect(await readdir(native.folder)).toEqual([]);expect(atomicWrite).not.toHaveBeenCalled()
 })
 it('un cambio concurrente no se pisa y no deja temporales',async()=>{
  await writeFile(path,'["ausente","anterior"]');const concurrent='["NUEVO","ausente","anterior"]',actual=await vi.importActual<typeof import('../src/main/files')>('../src/main/files')
  vi.mocked(atomicWrite).mockImplementationOnce(async(...args)=>{await writeFile(path,concurrent);await actual.atomicWrite(...args)})
  await expect(removeMissingRecent('ausente')).rejects.toThrow(/cambió/);expect(await readFile(path,'utf8')).toBe(concurrent);expect(await readdir(native.folder)).toEqual(['recents.json'])
 })
 it('un fallo de escritura conserva la lista y se propaga sin registrar rutas',async()=>{
  const bytes=Buffer.from('["ausente","conservar"]'),failure=Object.assign(new Error('Fallo sintético'),{code:'ENOSPC'});await writeFile(path,bytes)
  const error=vi.spyOn(console,'error').mockImplementation(()=>{}),warn=vi.spyOn(console,'warn').mockImplementation(()=>{}),log=vi.spyOn(console,'log').mockImplementation(()=>{});vi.mocked(atomicWrite).mockRejectedValueOnce(failure)
  await expect(removeMissingRecent('ausente')).rejects.toBe(failure);expect(await readFile(path)).toEqual(bytes);expect(error).not.toHaveBeenCalled();expect(warn).not.toHaveBeenCalled();expect(log).not.toHaveBeenCalled()
 })
 it('missingPath no se convierte en destino de escritura ni modifica archivos ajenos',async()=>{
  const other=join(native.folder,'AJENO.md'),settings=join(native.folder,'settings.json');await writeFile(other,'# ORIGINAL\n');await writeFile(settings,'{"version":1}');await writeFile(path,JSON.stringify([other,'conservar']))
  await removeMissingRecent(other);expect(await readFile(other,'utf8')).toBe('# ORIGINAL\n');expect(await readFile(settings,'utf8')).toBe('{"version":1}');expect(JSON.parse(await readFile(path,'utf8'))).toEqual(['conservar']);expect((await readdir(native.folder)).sort()).toEqual(['AJENO.md','recents.json','settings.json'])
 })
})
