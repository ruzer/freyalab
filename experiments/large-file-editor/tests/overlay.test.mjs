// Correctitud del experimento de superposición: formatos hostiles pequeños, en cada codificación, contra un analizador independiente (csv-parse).
import test,{afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,readdir,stat,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {parse} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import {buildIndex,eachRecord} from '../lib/record-index.mjs'
import {pickFields,splitFields,splitEol,decode} from '../lib/fields.mjs'
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
const dirs=[]
const scratch=async()=>{const dir=await mkdtemp(join(tmpdir(),'fl-overlay-'));dirs.push(dir);return dir}
afterEach(async()=>{for(const doc of opened.splice(0))await doc.close();for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true,maxRetries:3})})
const sha=b=>createHash('sha256').update(b).digest('hex')

async function fixture(encoding,bom){
 const dir=await scratch(),path=join(dir,'datos.csv')
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
 })
 test(`${name}: guardar sin cambios deja el archivo idéntico byte a byte`,async()=>{
  const {dir,path,data}=await fixture(encoding,bom)
  const doc=await LargeDocument.open(path,opts(dir,encoding));await doc.save()
  assert.equal(sha(await readFile(path)),sha(data))
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
})

test('insertar tras el último registro sin salto de línea conserva el estado «sin salto final»',async()=>{
 const {dir,path}=await fixture('utf8',null)
 const doc=await LargeDocument.open(path,opts(dir));await doc.insertAfter(doc.index.records-1,['8','ultimo','',''])
 await doc.save();const text=(await readFile(path)).toString('utf8')
 assert.ok(text.endsWith('8,ultimo,,'));assert.ok(!text.endsWith('\n'))
 assert.equal(oracle(Buffer.from(text),'utf8').length,rows.length+1)
})

test('un cambio externo bloquea el guardado y no toca el archivo',async()=>{
 const {dir,path}=await fixture('utf8',null)
 const doc=await LargeDocument.open(path,opts(dir));await doc.setCell(1,1,'X')
 await writeFile(path,'otro,contenido\n1,2\n');const changed=await readFile(path)
 await assert.rejects(doc.save(),ExternalChangeError)
 assert.ok((await readFile(path)).equals(changed));assert.deepEqual((await readdir(dir)).filter(f=>f.endsWith('.tmp')),[])
})

test('sin espacio suficiente falla antes de escribir y deja el original intacto',async()=>{
 const {dir,path,data}=await fixture('utf8',null)
 const doc=await LargeDocument.open(path,{...opts(dir),freeBytes:()=>1000});await doc.setCell(1,1,'X')
 await assert.rejects(doc.save(),InsufficientSpaceError)
 assert.ok((await readFile(path)).equals(data));assert.deepEqual((await readdir(dir)).filter(f=>f.endsWith('.tmp')),[])
})

test('cancelar a mitad de guardado borra el temporal y no toca el original',async()=>{
 const {dir,path,data}=await fixture('utf8',null)
 const doc=await LargeDocument.open(path,opts(dir));await doc.setCell(3,1,'X')
 const controller=new AbortController();controller.abort()
 await assert.rejects(doc.save({signal:controller.signal}),/cancelado/)
 assert.ok((await readFile(path)).equals(data));assert.deepEqual((await readdir(dir)).filter(f=>f.endsWith('.tmp')),[])
})

test('recuperación: el diario reaplica los cambios y tolera una última línea truncada',async()=>{
 const {dir,path}=await fixture('utf8',null)
 const first=await LargeDocument.open(path,opts(dir));await first.setCell(1,1,'uno');await first.setCell(2,3,'dos');await first.flush()
 await first.journal.appendFile('{"op":"set","r":3,"c":1,"v":"corta') // cierre brusco a mitad de línea
 const second=await LargeDocument.open(path,opts(dir))
 assert.equal(second.recovered,2)
 const page=await second.page(1,2);assert.equal(page[0].values[1],'uno');assert.equal(page[1].values[3],'dos')
 await second.discard()
})

test('recuperación: si el archivo cambió desde el diario no se aplica',async()=>{
 const {dir,path}=await fixture('utf8',null)
 const first=await LargeDocument.open(path,opts(dir));await first.setCell(1,1,'uno');await first.flush()
 await writeFile(path,'a,b\n1,2\n')
 await assert.rejects(LargeDocument.open(path,opts(dir)),ExternalChangeError)
})

test('un texto que la codificación no puede representar se rechaza al editar, no al guardar',async()=>{
 const {dir,path}=await fixture('win1252',null)
 const doc=await LargeDocument.open(path,opts(dir,'win1252'))
 await assert.rejects(doc.setCell(1,1,'✓'),UnrepresentableError);await doc.setCell(1,1,'José')
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
  assert.ok((await readFile(a)).equals(await readFile(b)))
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
 })
}
test('tras altas y bajas el índice se reconstruye y las páginas siguen siendo correctas',async()=>{
 const {dir,path}=await fixture('utf8',null),doc=await LargeDocument.open(path,opts(dir))
 await doc.deleteRow(2);await doc.insertAfter(3,['n','nuevo','',''])
 await doc.save();const page=await doc.page(0,20)
 assert.deepEqual(page.map(r=>r.values[0]),oracle(await readFile(path),'utf8').map(r=>r[0]))
 assert.equal(doc.index.records,oracle(await readFile(path),'utf8').length)
})

test('cancelar a mitad (tras tocar varios registros) borra el temporal y deja el original intacto',async()=>{
 const {dir,path,data}=await fixture('utf8',null)
 const doc=await LargeDocument.open(path,opts(dir));for(const r of [1,2,3,4])await doc.setCell(r,1,'cambio '+r)
 let checks=0;const signal={get aborted(){return ++checks>4}} // se cancela en la quinta comprobación, ya con registros reescritos
 await assert.rejects(doc.save({signal}),/cancelado/)
 assert.ok((await readFile(path)).equals(data));assert.deepEqual((await readdir(dir)).filter(f=>f.endsWith('.tmp')),[])
 assert.equal(doc.dirty,4) // los cambios siguen en la capa: se puede reintentar
 await doc.save();assert.equal(oracle(await readFile(path),'utf8')[4][1],'cambio 4')
})

test('cancelar un cambio masivo a mitad no deja el original modificado',async()=>{
 const {dir,path,data}=await fixture('utf8',null);let checks=0
 await assert.rejects(bulkTransform(path,join(dir,'v2.csv'),v=>v,{chunkSize:16,signal:{get aborted(){return ++checks>3}}}),/cancelada/)
 assert.ok((await readFile(path)).equals(data))
})

test('TSV: el delimitador es tab y un valor con tab se entrecomilla',async()=>{
 const dir=await scratch(),path=join(dir,'datos.tsv')
 await writeFile(path,'a\tb\tc\n1\t"x\ty"\t003\n2\tdos\t004\n')
 const doc=await LargeDocument.open(path,opts(dir));assert.equal(doc.delimiter,'\t')
 assert.deepEqual((await doc.page(1,1))[0].values,['1','x\ty','003'])
 await doc.setCell(2,1,'con\ttab');await doc.save()
 assert.equal((await readFile(path,'utf8')),'a\tb\tc\n1\t"x\ty"\t003\n2\t"con\ttab"\t004\n')
})

test('cierre brusco real: un proceso hijo muere a mitad de edición y el diario recupera lo escrito',async()=>{
 const {dir,path}=await fixture('utf8',null),{spawnSync}=await import('node:child_process'),{existsSync}=await import('node:fs')
 const lib=new URL('../lib/document.mjs',import.meta.url).href // una URL file://: una ruta con letra de unidad no se puede importar en ESM (Windows)
 const flag=join(dir,'listo.txt')
 const child=spawnSync(process.execPath,['--input-type=module','-e',`
  import {LargeDocument} from ${JSON.stringify(lib)}
  import {writeFileSync} from 'node:fs'
  const doc=await LargeDocument.open(${JSON.stringify(path)},{journalDir:${JSON.stringify(dir)},every:2})
  for(let i=0;i<200;i++)await doc.setCell(1+i%5,1,'v'+i)
  await doc.flush();writeFileSync(${JSON.stringify(flag)},'1');process.kill(process.pid,'SIGKILL')`],{encoding:'utf8'})
 assert.ok(existsSync(flag),`el hijo no llegó al punto de cierre: ${child.stderr}`)
 assert.ok(child.signal==='SIGKILL'||child.status!==0) // en Windows no hay señales: basta con que muera sin terminar
 const doc=await LargeDocument.open(path,opts(dir))
 assert.equal(doc.recovered,200);assert.equal((await doc.page(1,1))[0].values[1],'v195');assert.equal((await doc.page(5,1))[0].values[1],'v199')
 await doc.save();assert.equal(oracle(await readFile(path),'utf8')[5][1],'v199')
})

test('abrir por un enlace simbólico guarda sobre el destino real y el enlace sigue siendo un enlace',{skip:process.platform==='win32'},async()=>{
 const {dir,path}=await fixture('utf8',null),{symlink,lstat,chmod}=await import('node:fs/promises'),link=join(dir,'enlace.csv')
 await symlink(path,link);await chmod(path,0o640)
 const doc=await LargeDocument.open(link,opts(dir));await doc.setCell(1,1,'por el enlace');await doc.save()
 assert.ok((await lstat(link)).isSymbolicLink());assert.equal(oracle(await readFile(path),'utf8')[1][1],'por el enlace');assert.equal((await stat(path)).mode&0o777,0o640)
})

test('cancelar el indexado se detiene y no deja nada a medias',async()=>{
 const {path}=await fixture('utf8',null)
 await assert.rejects(buildIndex(path,{chunk:4,signal:{get aborted(){return true}}}),/cancelado/)
})

test('recuperación: tras una línea truncada, lo que se añada después también se recupera en la siguiente apertura',async()=>{
 const {dir,path}=await fixture('utf8',null)
 const first=await LargeDocument.open(path,opts(dir));await first.setCell(1,1,'uno');await first.flush()
 await first.journal.appendFile('{"op":"set","r":3,"c":1,"v":"corta') // cierre brusco a mitad de línea
 await first.close()
 const second=await LargeDocument.open(path,opts(dir));assert.equal(second.recovered,1)
 await second.setCell(2,1,'dos');await second.flush();await second.close()
 const third=await LargeDocument.open(path,opts(dir));assert.equal(third.recovered,2)
 assert.equal((await third.page(1,2)).map(r=>r.values[1]).join('|'),'uno|dos')
})

test('recuperación: un diario con la cabecera ilegible se descarta sin romper la apertura',async()=>{
 const {dir,path}=await fixture('utf8',null),doc0=await LargeDocument.open(path,opts(dir));await doc0.close()
 await writeFile(doc0.journalPath,'{"v":1,"pa');const doc=await LargeDocument.open(path,opts(dir));assert.equal(doc.recovered,undefined)
})

test('el extractor perezoso de columnas coincide con la división completa en cada registro (hostil, 2 MiB, saltos mixtos)',async()=>{
 const dir=await scratch(),{spawnSync}=await import('node:child_process'),{fileURLToPath}=await import('node:url')
 const gen=fileURLToPath(new URL('../gen-fixture.mjs',import.meta.url))
 const run=spawnSync(process.execPath,[gen,'--size','2MiB','--profile','hostile','--eol','mixed','--seed','5','--out',dir],{encoding:'utf8'});assert.equal(run.status,0,run.stderr)
 const file=join(dir,(await readdir(dir)).find(f=>f.endsWith('.csv'))),wanted=new Set([0,1,2,3,4,5,6,7,9]),pick=pickFields(wanted);let records=0,checked=0
 await eachRecord(file,buf=>{
  const text=decode(buf,'utf8'),{body}=splitEol(text),all=splitFields(body,','),got=pick(text);records++
  for(const c of wanted){assert.equal(got.get(c),all[c]?.value,`registro ${records}, columna ${c}`);checked++}
 })
 assert.ok(records>10000&&checked>90000)
})

test('el recorrido en flujo se detiene cuando se cancela',async()=>{
 const {path}=await fixture('utf8',null);let seen=0
 await assert.rejects(eachRecord(path,()=>{seen++},{chunk:8,signal:{get aborted(){return seen>=2}}}),/cancelado/)
 assert.ok(seen>=2&&seen<rows.length)
})
