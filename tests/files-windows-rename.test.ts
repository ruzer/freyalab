import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {mkdtemp,readFile,readdir,rm,writeFile,rename,link} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {atomicWrite,digest} from '../src/main/files'

vi.mock('node:fs/promises',async original=>{
 const fs=await original<typeof import('node:fs/promises')>()
 return{...fs,rename:vi.fn(fs.rename),link:vi.fn(fs.link)}
})

const platformDescriptor=Object.getOwnPropertyDescriptor(process,'platform')!
const platform=(value:NodeJS.Platform)=>Object.defineProperty(process,'platform',{...platformDescriptor,value})
const denied=()=>Object.assign(new Error('EPERM: operation not permitted, rename'),{code:'EPERM',syscall:'rename'})
const originalBytes=Buffer.from('a,b\r\nc,d\ne,f')
let folder:string,path:string,expected:string

beforeEach(async()=>{
 Object.defineProperty(process,'platform',platformDescriptor)
 const fs=await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
 vi.mocked(rename).mockReset().mockImplementation(fs.rename)
 vi.mocked(link).mockReset().mockImplementation(fs.link)
 folder=await mkdtemp(join(tmpdir(),'freya-rename-proposal-'));path=join(folder,'datos.txt')
 await writeFile(path,originalBytes);expected=await digest(path)
})
afterEach(async()=>{
 Object.defineProperty(process,'platform',platformDescriptor)
 await rm(folder,{recursive:true,force:true})
})

describe('propuesta local: EPERM rename de Windows simulado',()=>{
 it('recupera un EPERM y publica los bytes reales sin volver a consumir la entrada',async()=>{
  platform('win32')
  const failure=denied(),bytes=Buffer.from('\ufeffá🐶\r\nx\n'),chunks=[bytes.subarray(0,5),bytes.subarray(5)]
  let consumed=0
  async function* data(){for(const chunk of chunks){consumed++;yield chunk}}
  vi.mocked(rename).mockRejectedValueOnce(failure)
  await atomicWrite(path,data(),expected)
  expect(await readFile(path)).toEqual(bytes);expect(consumed).toBe(2)
  expect(rename).toHaveBeenCalledTimes(2)
  expect(vi.mocked(rename).mock.calls[0]).toEqual(vi.mocked(rename).mock.calls[1])
  expect(await readdir(folder)).toEqual(['datos.txt'])
 })

 it('propaga el EPERM persistente tras tres intentos y conserva original y limpieza',async()=>{
  platform('win32');const failure=denied();vi.mocked(rename).mockRejectedValue(failure)
  await expect(atomicWrite(path,'nuevo',expected)).rejects.toBe(failure)
  expect(rename).toHaveBeenCalledTimes(3)
  expect(await readFile(path)).toEqual(originalBytes);expect(await readdir(folder)).toEqual(['datos.txt'])
  expect(vi.mocked(rename).mock.calls.every(args=>args[0]===vi.mocked(rename).mock.calls[0][0])).toBe(true)
 })

 for(const changeAfter of [1,2])it(`rechaza un cambio externo antes del reintento ${changeAfter}`,async()=>{
  platform('win32');const external=Buffer.from('externo\r\ná\n');let calls=0
  vi.mocked(rename).mockImplementation(async()=>{
   if(++calls===changeAfter)await writeFile(path,external)
   throw denied()
  })
  await expect(atomicWrite(path,'nuevo',expected)).rejects.toThrow('El archivo cambió durante el guardado. Guarda una copia.')
  expect(rename).toHaveBeenCalledTimes(changeAfter)
  expect(await readFile(path)).toEqual(external);expect(await readdir(folder)).toEqual(['datos.txt'])
 })

 for(const os of ['linux','darwin'] as const)it(`no reintenta EPERM rename en ${os}`,async()=>{
  platform(os);const failure=denied();vi.mocked(rename).mockRejectedValue(failure)
  await expect(atomicWrite(path,'nuevo',expected)).rejects.toBe(failure)
  expect(rename).toHaveBeenCalledTimes(1)
  expect(await readFile(path)).toEqual(originalBytes);expect(await readdir(folder)).toEqual(['datos.txt'])
 })

 it.each([
  {code:'EACCES',syscall:'rename'},
  {code:'ENOENT',syscall:'rename'},
  {code:'EPERM',syscall:'open'},
  {code:'EPERM',syscall:undefined}
 ])('no reintenta $code/$syscall en Windows',async fields=>{
  platform('win32');const failure=Object.assign(new Error('fallo real conservado'),fields);vi.mocked(rename).mockRejectedValue(failure)
  await expect(atomicWrite(path,'nuevo',expected)).rejects.toBe(failure)
  expect(rename).toHaveBeenCalledTimes(1)
  expect(await readFile(path)).toEqual(originalBytes);expect(await readdir(folder)).toEqual(['datos.txt'])
 })

 it('mantiene expected undefined sin recuperación ante EPERM rename',async()=>{
  platform('win32');const failure=denied();vi.mocked(rename).mockRejectedValue(failure)
  await expect(atomicWrite(path,'nuevo')).rejects.toBe(failure)
  expect(await readFile(path)).toEqual(originalBytes);expect(await readdir(folder)).toEqual(['datos.txt'])
  expect(rename).toHaveBeenCalledTimes(1)
 })

 it('mantiene expected null en link exclusivo sin rename ni reintentar EEXIST',async()=>{
  platform('win32')
  await expect(atomicWrite(path,'nuevo',null)).rejects.toMatchObject({code:'EEXIST'})
  expect(link).toHaveBeenCalledTimes(1);expect(rename).not.toHaveBeenCalled()
  expect(await readFile(path)).toEqual(originalBytes);expect(await readdir(folder)).toEqual(['datos.txt'])
 })
})
