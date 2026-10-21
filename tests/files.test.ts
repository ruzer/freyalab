import { describe,it,expect,vi } from 'vitest'
import { mkdtemp,readFile,rm,mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as fs from 'node:fs/promises'
import { atomicWrite,digest,contained } from '../src/main/files'
vi.mock('node:fs/promises',async importOriginal=>{const fs=await importOriginal<typeof import('node:fs/promises')>();return{...fs,open:vi.fn(fs.open)}})
describe('guardado seguro',()=>{
 it('calcula la huella completa por bloques y propaga errores de lectura',async()=>{const dir=await mkdtemp(join(tmpdir(),'freya-hash-'));try{const p=join(dir,'datos');await fs.writeFile(p,'á\u0000😀\r\n'.repeat(20000));expect(await digest(p)).toBe('f473a50eafad2fe8da4b5ae81f065732239d73476579b964540c76b9994de623');await fs.writeFile(p,'');expect(await digest(p)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');await expect(digest(join(dir,'ausente'))).rejects.toMatchObject({code:'ENOENT'})}finally{await rm(dir,{recursive:true,force:true})}})

 it('rechaza conflicto y conserva el archivo externo',async()=>{const dir=await mkdtemp(join(tmpdir(),'freya-'));try{const p=join(dir,'doc.md');await atomicWrite(p,'base');const hash=await digest(p);await atomicWrite(p,'externo');await expect(atomicWrite(p,'edicion',hash)).rejects.toThrow('cambió');expect(await readFile(p,'utf8')).toBe('externo')}finally{await rm(dir,{recursive:true,force:true})}})
 it('reemplaza completo y no deja temporales ante fallo de destino',async()=>{const dir=await mkdtemp(join(tmpdir(),'freya-'));try{const p=join(dir,'doc.md');await atomicWrite(p,'base');await atomicWrite(p,'nuevo',await digest(p));expect(await readFile(p,'utf8')).toBe('nuevo');await expect(atomicWrite(join(dir,'inexistente','doc'),'x')).rejects.toThrow();expect(await readFile(p,'utf8')).toBe('nuevo')}finally{await rm(dir,{recursive:true,force:true})}})
 it('autoriza solo rutas contenidas',async()=>{const dir=await mkdtemp(join(tmpdir(),'freya-'));try{await mkdir(join(dir,'sub'));expect(await contained(dir,join(dir,'sub'))).toBe(true);expect(await contained(join(dir,'sub'),dir)).toBe(false)}finally{await rm(dir,{recursive:true,force:true})}})
 it('conserva el original y limpia el temporal si falla la escritura por disco lleno',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'freya-'));const p=join(dir,'doc.md');await atomicWrite(p,'original')
  const originalOpen=(await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')).open;const spy=vi.spyOn(fs,'open').mockImplementation(async(...args:Parameters<typeof fs.open>)=>{const handle=await originalOpen(...args);if(String(args[0]).endsWith('.tmp'))vi.spyOn(handle,'writeFile').mockRejectedValue(Object.assign(new Error('Disco lleno'),{code:'ENOSPC'}));return handle})
  try{await expect(atomicWrite(p,'cambio',await digest(p))).rejects.toThrow('Disco lleno');expect(await readFile(p,'utf8')).toBe('original');expect(await fs.readdir(dir)).toEqual(['doc.md'])}finally{spy.mockRestore();await rm(dir,{recursive:true,force:true})}
 })

})
