// Correctitud del experimento de superposición: formatos hostiles pequeños, en cada codificación, contra un analizador independiente (csv-parse).
import test,{afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,readdir,stat,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {parse} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import {buildIndex} from '../lib/record-index.mjs'
import {LargeDocument as Doc,ExternalChangeError,InsufficientSpaceError,UnrepresentableError,bulkTransform} from '../lib/document.mjs'

// Texto hostil: ceros a la izquierda, ID largo, comillas escapadas, salto de línea dentro de comillas, filas irregulares, campos vacíos,
// saltos mixtos y último registro sin salto de línea.
const rows=[
 ['id','nombre','texto','nota'],
 ['000123','Ana','dice "hola"','x'],
 ['9007199254740993','José, el "grande"','línea 1\r\nlínea 2',''],
 ['4','corto'],
 ['5','','',' espacios '],
 ['6','Zoë ✓','a;b','fin'],
]
const eols=['\r\n','\n','\r\n','\n','\r\n']
const quote=v=>/[",\r\n]/.test(v)?`"${v.replaceAll('"','""')}"`:v
const build=(encoding,bom)=>{
 const text=rows.map((r,i)=>r.map(quote).join(',')+(i<rows.length-1?eols[i]:'')).join('')
 const bytes=iconv.encode(text,encoding),prefix=bom==='utf8'?Buffer.from([0xEF,0xBB,0xBF]):bom==='utf16le'?Buffer.from([0xFF,0xFE]):Buffer.alloc(0)
 return Buffer.concat([prefix,bytes])
}
const variants=[['utf8',null],['utf8','utf8'],['utf16le','utf16le'],['win1252',null]]
const supported=(e,t)=>e!=='win1252'||!/[✓]/.test(t) // win1252 no puede representar ✓
// Todo documento abierto en una prueba se cierra al terminar (sin borrar su diario) para no dejar manejadores abiertos.
const opened=[]
const LargeDocument={open:async(...args)=>{const doc=await Doc.open(...args);opened.push(doc);return doc}}
afterEach(async()=>{for(const doc of opened.splice(0))await doc.close()})
const sha=b=>createHash('sha256').update(b).digest('hex')

async function fixture(encoding,bom){
 const dir=await mkdtemp(join(tmpdir(),'fl-overlay-')),path=join(dir,'datos.csv')
 let data
 if(encoding==='win1252'){const saved=rows[5][1];rows[5][1]='Zoe';data=build(encoding,bom);rows[5][1]=saved}else data=build(encoding,bom)
 await writeFile(path,data);return {dir,path,data}
}
const oracle=(data,encoding)=>parse(iconv.decode(data,encoding).replace(/^﻿/,''),{relax_column_count:true,skip_empty_lines:false,record_delimiter:['\r\n','\n']})
const opts=(dir,encoding)=>({journalDir:dir,every:2,encoding:encoding==='win1252'?'win1252':undefined})

for(const [encoding,bom] of variants){
 const name=`${encoding}${bom?'+BOM':''}`
 test(`${name}: el índice y las páginas coinciden con el analizador independiente`,async()=>{
  const {dir,path,data}=await fixture(encoding,bom)
  const doc=await LargeDocument.open(path,opts(dir,encoding)),expected=oracle(data,encoding)
  assert.equal(doc.index.records,expected.length)
  const page=await doc.page(0,100)
  assert.deepEqual(page.map(r=>r.values),expected)
  assert.equal(page[1].values[0],'000123') // ceros a la izquierda intactos
  assert.equal(page[2].values[0],'9007199254740993') // ID más grande que 2^53 intacto
  await rm(dir,{recursive:true})
 })
 test(`${name}: guardar sin cambios deja el archivo idéntico byte a byte`,async()=>{
  const {dir,path,data}=await fixture(encoding,bom)
  const doc=await LargeDocument.open(path,opts(dir,encoding));await doc.save()
  assert.equal(sha(await readFile(path)),sha(data))
  await rm(dir,{recursive:true})
 })
 test(`${name}: un cambio de celda solo toca los bytes de su registro`,async()=>{
  const {dir,path,data}=await fixture(encoding,bom)
  const doc=await LargeDocument.open(path,opts(dir,encoding)),index=doc.index
  await doc.setCell(2,2,'nuevo, con "comillas"');await doc.save()
  const after=await readFile(path),offsets=[...(await buildIndex(path,{every:1})).offsets],before=[...(await buildIndex(path,{every:1})).offsets]
  const prevOffsets=[...(await (async()=>{const p=join(dir,'orig.csv');await writeFile(p,data);return buildIndex(p,{every:1})})()).offsets]
  // todo lo anterior y posterior al registro 2 es idéntico
  assert.ok(after.subarray(0,prevOffsets[2]).equals(data.subarray(0,prevOffsets[2])))
  const tailBefore=data.subarray(prevOffsets[3]),tailAfter=after.subarray(after.length-tailBefore.length)
  assert.ok(tailAfter.equals(tailBefore))
  const check=oracle(after,encoding)
  assert.equal(check[2][2],'nuevo, con "comillas"');assert.equal(check[2][0],'9007199254740993')
  assert.ok(offsets.length===prevOffsets.length&&index.records===doc.index.records)
  await rm(dir,{recursive:true})
 })
}

test('borrar, insertar y editar a la vez producen el CSV esperado',async()=>{
 const {dir,path,data}=await fixture('utf8',null)
 const doc=await LargeDocument.open(path,opts(dir))
 await doc.deleteRow(4);await doc.insertAfter(1,['7','nuevo','a,b','']);await doc.setCell(5,3,'editado')
 await doc.save()
 const after=oracle(await readFile(path),'utf8')
 assert.deepEqual(after.map(r=>r[0]),['id','000123','7','9007199254740993','4','6'])
 assert.equal(after.at(-1)[3],'editado');assert.equal(after[2][2],'a,b')
 await rm(dir,{recursive:true})
})

test('insertar tras el último registro sin salto de línea conserva el estado «sin salto final»',async()=>{
 const {dir,path}=await fixture('utf8',null)
 const doc=await LargeDocument.open(path,opts(dir));await doc.insertAfter(doc.index.records-1,['8','ultimo','',''])
 await doc.save();const text=(await readFile(path)).toString('utf8')
 assert.ok(text.endsWith('8,ultimo,,'));assert.ok(!text.endsWith('\n'))
 assert.equal(oracle(Buffer.from(text),'utf8').length,rows.length+1)
 await rm(dir,{recursive:true})
})

test('un cambio externo bloquea el guardado y no toca el archivo',async()=>{
 const {dir,path}=await fixture('utf8',null)
 const doc=await LargeDocument.open(path,opts(dir));await doc.setCell(1,1,'X')
 await writeFile(path,'otro,contenido\n1,2\n');const changed=await readFile(path)
 await assert.rejects(doc.save(),ExternalChangeError)
 assert.ok((await readFile(path)).equals(changed));assert.deepEqual((await readdir(dir)).filter(f=>f.endsWith('.tmp')),[])
 await rm(dir,{recursive:true})
})

test('sin espacio suficiente falla antes de escribir y deja el original intacto',async()=>{
 const {dir,path,data}=await fixture('utf8',null)
 const doc=await LargeDocument.open(path,{...opts(dir),freeBytes:()=>1000});await doc.setCell(1,1,'X')
 await assert.rejects(doc.save(),InsufficientSpaceError)
 assert.ok((await readFile(path)).equals(data));assert.deepEqual((await readdir(dir)).filter(f=>f.endsWith('.tmp')),[])
 await rm(dir,{recursive:true})
})

test('cancelar a mitad de guardado borra el temporal y no toca el original',async()=>{
 const {dir,path,data}=await fixture('utf8',null)
 const doc=await LargeDocument.open(path,opts(dir));await doc.setCell(3,1,'X')
 const controller=new AbortController();controller.abort()
 await assert.rejects(doc.save({signal:controller.signal}),/cancelado/)
 assert.ok((await readFile(path)).equals(data));assert.deepEqual((await readdir(dir)).filter(f=>f.endsWith('.tmp')),[])
 await rm(dir,{recursive:true})
})

test('recuperación: el diario reaplica los cambios y tolera una última línea truncada',async()=>{
 const {dir,path}=await fixture('utf8',null)
 const first=await LargeDocument.open(path,opts(dir));await first.setCell(1,1,'uno');await first.setCell(2,3,'dos');await first.flush()
 await first.journal.appendFile('{"op":"set","r":3,"c":1,"v":"corta') // cierre brusco a mitad de línea
 const second=await LargeDocument.open(path,opts(dir))
 assert.equal(second.recovered,2)
 const page=await second.page(1,2);assert.equal(page[0].values[1],'uno');assert.equal(page[1].values[3],'dos')
 await second.discard();await rm(dir,{recursive:true})
})

test('recuperación: si el archivo cambió desde el diario no se aplica',async()=>{
 const {dir,path}=await fixture('utf8',null)
 const first=await LargeDocument.open(path,opts(dir));await first.setCell(1,1,'uno');await first.flush()
 await writeFile(path,'a,b\n1,2\n')
 await assert.rejects(LargeDocument.open(path,opts(dir)),ExternalChangeError)
 await rm(dir,{recursive:true})
})

test('un texto que la codificación no puede representar se rechaza al editar, no al guardar',async()=>{
 const {dir,path}=await fixture('win1252',null)
 const doc=await LargeDocument.open(path,opts(dir,'win1252'))
 await assert.rejects(doc.setCell(1,1,'✓'),UnrepresentableError);await doc.setCell(1,1,'José');await rm(dir,{recursive:true})
})

test('cambio masivo en flujo: respeta el resto del archivo y deja la versión anterior intacta',async()=>{
 const {dir,path,data}=await fixture('utf8',null),out=join(dir,'v2.csv')
 const result=await bulkTransform(path,out,(v,i)=>i===0?undefined:Object.assign([...v],{1:v[1]?.toUpperCase()}),{})
 assert.ok((await readFile(path)).equals(data))
 const expected=oracle(data,'utf8').map((r,i)=>i?[...r.slice(0,1),r[1]?.toUpperCase(),...r.slice(2)]:r)
 assert.deepEqual(oracle(await readFile(out),'utf8'),expected)
 assert.equal(result.records,rows.length)
 // los registros cuyo valor no cambió conservan sus bytes (la cabecera y «000123» siguen idénticos)
 assert.ok((await readFile(out)).subarray(0,14).equals(data.subarray(0,14)))
 await rm(dir,{recursive:true})
})

for(const [encoding,bom] of variants){
 test(`${encoding}${bom?'+BOM':''}: trozos diminutos dan el mismo índice, las mismas páginas y el mismo cambio masivo`,async()=>{
  const {dir,path,data}=await fixture(encoding,bom),enc=encoding==='win1252'?'win1252':undefined
  const whole=await buildIndex(path,{encoding:enc,every:1}),tiny=await buildIndex(path,{encoding:enc,every:1,chunk:6})
  assert.deepEqual([...tiny.offsets],[...whole.offsets]);assert.equal(tiny.records,whole.records)
  const {recordBounds}=await import('../lib/record-index.mjs'),{open}=await import('node:fs/promises'),h=await open(path,'r')
  assert.deepEqual(await recordBounds(h,whole,1,3,5),await recordBounds(h,whole,1,3));await h.close()
  const a=join(dir,'a.csv'),b=join(dir,'b.csv'),upper=(v,i)=>i?Object.assign([...v],{1:v[1].toUpperCase()}):undefined
  await bulkTransform(path,a,upper,{encoding:enc});await bulkTransform(path,b,upper,{encoding:enc,chunkSize:6})
  assert.ok((await readFile(a)).equals(await readFile(b)));await rm(dir,{recursive:true})
 })
}

for(const [encoding,bom] of variants){
 test(`${encoding}${bom?'+BOM':''}: tras guardar cambios de celda el índice se desplaza sin releer y coincide con uno reconstruido`,async()=>{
  const {dir,path}=await fixture(encoding,bom),enc=encoding==='win1252'?'win1252':undefined
  const doc=await LargeDocument.open(path,opts(dir,encoding));await doc.setCell(1,1,'mucho más largo, "con comillas"');await doc.setCell(3,1,'');await doc.setCell(5,0,'z')
  await doc.save()
  const fresh=await buildIndex(path,{encoding:enc,every:2})
  assert.deepEqual([...doc.index.offsets],[...fresh.offsets]);assert.equal(doc.index.size,fresh.size);assert.equal(doc.index.records,fresh.records)
  assert.equal((await doc.page(1,1))[0].values[1],'mucho más largo, "con comillas"') // la página usa el índice desplazado
  await rm(dir,{recursive:true})
 })
}
test('tras altas y bajas el índice se reconstruye y las páginas siguen siendo correctas',async()=>{
 const {dir,path}=await fixture('utf8',null),doc=await LargeDocument.open(path,opts(dir))
 await doc.deleteRow(2);await doc.insertAfter(3,['n','nuevo','',''])
 await doc.save();const page=await doc.page(0,20)
 assert.deepEqual(page.map(r=>r.values[0]),oracle(await readFile(path),'utf8').map(r=>r[0]))
 assert.equal(doc.index.records,oracle(await readFile(path),'utf8').length)
 await rm(dir,{recursive:true})
})
