import {it,expect} from 'vitest'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {parse} from 'csv-parse/sync'
import {TableEngine} from '../src/main/table-engine'

// S0 red: preserve the contract disagreement until the owner decides mixed-line-ending interpretation.
for(const eol of ['\n','\r\n'])it(`editable y grande conservan los mismos valores con finales mixtos y encabezado ${JSON.stringify(eol)}`,async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-search-mixed-'))
 try{
  const path=join(folder,'mixed.csv'),text=`id,text${eol}1,x\r\n2,y\n3,z\r\n`
  await writeFile(path,text)
  const editable=new TableEngine(),large=new TableEngine(()=>{},{largeBytes:1})
  await editable.open('a',path);await large.open('a',path)
  const query={offset:0,limit:1000,requestId:1},expected=parse(text,{record_delimiter:['\r\n','\n']}).slice(1)
  expect((await editable.page('a',query)).rows.map(row=>row.cells)).toEqual(expected)
  expect((await large.page('a',query)).rows.map(row=>row.cells)).toEqual(expected)
 }finally{await rm(folder,{recursive:true,force:true})}
})
