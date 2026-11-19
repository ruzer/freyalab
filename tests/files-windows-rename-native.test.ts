import {expect,it,vi} from 'vitest'
import {chmod,mkdtemp,readFile,readdir,rename,rm,stat,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {atomicWrite,digest} from '../src/main/files'

vi.mock('node:fs/promises',async original=>{
 const fs=await original<typeof import('node:fs/promises')>()
 return{...fs,rename:vi.fn(fs.rename)}
})

it.skipIf(process.platform!=='win32')('Windows nativo: recupera EPERM real al reemplazar un destino readonly transitorio',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-native-rename-')),path=join(folder,'datos.txt')
 const original=Buffer.from('a,b\r\nc,d\ne,f'),edited=Buffer.from('a,b\nc,d\ne,f')
 const fs=await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
 let permissions=0o600,firstError:unknown,readonlyWriteBit:number|undefined
 try{
  await writeFile(path,original,{mode:0o600});permissions=(await stat(path)).mode&0o777
  expect(permissions&0o200).not.toBe(0)
  const expected=await digest(path)
  vi.mocked(rename).mockReset().mockImplementation(fs.rename).mockImplementationOnce(async(...args)=>{
   await chmod(path,0o444);readonlyWriteBit=(await stat(path)).mode&0o200
   try{await fs.rename(...args)}
   catch(error){firstError=error;throw error}
   finally{await chmod(path,permissions)}
  })
  await atomicWrite(path,edited,expected)
  expect(firstError).toMatchObject({code:'EPERM',syscall:'rename'})
  expect(readonlyWriteBit).toBe(0);expect(rename).toHaveBeenCalledTimes(2)
  expect(vi.mocked(rename).mock.calls[0]).toEqual(vi.mocked(rename).mock.calls[1])
  expect(await readFile(path)).toEqual(edited)
  expect((await stat(path)).mode&0o777).toBe(permissions)
  expect(await readdir(folder)).toEqual(['datos.txt'])
  console.log('[WINDOWS-RENAME-NATIVE]',JSON.stringify({code:(firstError as NodeJS.ErrnoException).code,syscall:(firstError as NodeJS.ErrnoException).syscall,renameCalls:vi.mocked(rename).mock.calls.length}))
 }finally{
  vi.mocked(rename).mockReset().mockImplementation(fs.rename)
  await chmod(path,permissions).catch(()=>{})
  await rm(folder,{recursive:true,force:true})
 }
})
