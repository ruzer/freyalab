import {it,expect} from 'vitest'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {parse} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import {buildIndex,readRecords,splitFields} from '../src/main/large-table'

for(const encoding of ['utf8','utf16le'] as const)it(`${encoding}: CR fuera de comillas delimita los registros aunque un campo contenga LF`,async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-search-cr-'))
 try{
  const path=join(folder,'cr.csv'),text='id,text\r1,"primera\nsegunda"\r2,fin\r'
  await writeFile(path,iconv.encode(text,encoding))
  const expected=parse(text,{record_delimiter:'\r'}) as string[][]
  const index=await buildIndex(path,{encoding,bomLength:0,maxRecord:1048576,chunk:6})
  expect(index.records).toBe(expected.length)
  expect((await readRecords(index,0,index.records)).map(record=>splitFields(record,','))).toEqual(expected)
 }finally{await rm(folder,{recursive:true,force:true})}
})
it('busca el primer terminador fuera de un campo entrecomillado de más de 64 KiB',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-search-cr-long-'))
 try{
  const path=join(folder,'long.csv'),text=`"${'x'.repeat(70000)}\nlínea",texto\r1,fin\r`
  await writeFile(path,text)
  const index=await buildIndex(path,{encoding:'utf8',bomLength:0,maxRecord:1048576})
  expect(index.records).toBe(2)
  expect((await readRecords(index,0,2)).map(record=>splitFields(record,','))).toEqual(parse(text,{record_delimiter:'\r'}))
 }finally{await rm(folder,{recursive:true,force:true})}
})
