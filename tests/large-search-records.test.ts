import {it,expect} from 'vitest'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {buildIndex,recordBatches,RecordTooLargeError} from '../src/main/large-table'

it('los lotes se acotan también por bytes cuando hay campos largos',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-record-bytes-')),path=join(folder,'data.csv'),text=('x'.repeat(40)+'\n').repeat(10)
 try{await writeFile(path,text);const index=await buildIndex(path,{encoding:'utf8',bomLength:0,maxRecord:64});const records:Buffer[]=[];for await(const batch of recordBatches(index,{batchRecords:100,chunk:64,batchBytes:60})){expect(batch.records.length).toBeLessThanOrEqual(2);records.push(...batch.records)}expect(Buffer.concat(records).toString()).toBe(text)}finally{await rm(folder,{recursive:true,force:true})}
})
it('un rango solo entrega sus registros y conserva fronteras CR/LF',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-record-range-')),path=join(folder,'data.csv'),text='a\r\nb\nc\rd\r\ne\n'
 try{await writeFile(path,text);const index=await buildIndex(path,{encoding:'utf8',bomLength:0,maxRecord:64,every:2});const out:Buffer[]=[];for await(const batch of recordBatches(index,{from:index.offsets[1],to:index.offsets[2],first:2,chunk:1,batchRecords:1})){expect(batch.first).toBe(2+out.length);expect(batch.position).toBeLessThanOrEqual(index.offsets[2]);out.push(...batch.records)}expect(Buffer.concat(out).toString()).toBe('c\rd\r\n')}finally{await rm(folder,{recursive:true,force:true})}
})
it('si el archivo cambia, un registro que crece no acumula el resto del archivo en memoria',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-record-grow-')),path=join(folder,'data.csv'),text='a\n'+'x\n'.repeat(100)
 try{await writeFile(path,text);const index=await buildIndex(path,{encoding:'utf8',bomLength:0,maxRecord:64});await writeFile(path,'a\n"'+'x'.repeat(text.length-4)+'"');await expect((async()=>{for await(const _ of recordBatches(index,{chunk:32})){}})()).rejects.toBeInstanceOf(RecordTooLargeError)}finally{await rm(folder,{recursive:true,force:true})}
})
it('no da por válido un índice que mezcló dos versiones del archivo',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-index-change-')),path=join(folder,'data.csv'),text='a\n'+'x\n'.repeat(100);let changed=false
 try{await writeFile(path,text);await expect(buildIndex(path,{encoding:'utf8',bomLength:0,maxRecord:64,chunk:32,onProgress:()=>{if(!changed){changed=true;writeFileSync(path,text+'y\n')}}})).rejects.toThrow('cambió');expect(await readFile(path,'utf8')).toBe(text+'y\n')}finally{await rm(folder,{recursive:true,force:true})}
})
