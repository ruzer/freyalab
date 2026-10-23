#!/usr/bin/env node
// PoC 2a: ¿se puede acotar DuckDB nativo (en proceso) a los archivos autorizados, sin red ni extensiones, con límites y cancelación?
//   node duckdb-native-security.mjs --install /ruta/a/duckdb-native --results results/duckdb-native-security.json
// --install es una carpeta AISLADA donde se hizo `npm i @duckdb/node-api@2.0.0-r.1`; el proyecto no añade la dependencia.
// SEGURIDAD DEL PROPIO EXPERIMENTO: ninguna consulta puede disparar la descarga de extensiones: se desactivan autoinstall/autoload y el
// repositorio de extensiones apunta a una ruta local inexistente antes de ejecutar nada.
import {createRequire} from 'node:module'
import {mkdtemp,mkdir,writeFile,symlink,rm,readdir,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import http from 'node:http'

const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,all)=>x.startsWith('--')?[...a,[x.slice(2),all[i+1]]]:a,[]))
const duck=createRequire(join(resolve(args.install),'package.json'))('@duckdb/node-api')
const root=await mkdtemp(join(tmpdir(),'fl-duck-sec-')),allowed=join(root,'permitido'),outside=join(root,'fuera'),temp=join(root,'tmp')
await mkdir(allowed);await mkdir(outside);await mkdir(temp)
await writeFile(join(allowed,'ok.csv'),'a,b\n1,uno\n2,dos\n');await writeFile(join(outside,'secreto.csv'),'a,b\nSECRETO,x\n')
await symlink(join(outside,'secreto.csv'),join(allowed,'enlace.csv'))
const hits=[];const server=http.createServer((req,res)=>{hits.push(req.url);res.end('a,b\nred,1\n')}).listen(0,'127.0.0.1')
const port=server.address().port

const instance=await duck.DuckDBInstance.create(':memory:')
const conn=await instance.connect()
const sql=async text=>(await conn.runAndReadAll(text)).getRowObjects()
const results=[]
async function attempt(name,text,expect){ // expect: 'allowed' | 'denied'
 let outcome,detail
 try{const rows=await sql(text);outcome='allowed';detail=JSON.stringify(rows,(k,v)=>typeof v==='bigint'?Number(v):v).slice(0,140)}catch(e){outcome='denied';detail=String(e.message).split('\n')[0].slice(0,200)}
 const ok=outcome===expect;results.push({name,expect,outcome,ok,detail});console.log(ok?'OK  ':'FALLA',name,'->',outcome,'|',detail.slice(0,110))
}

// 0) Valores por defecto (solo lectura de ajustes: no se ejecuta nada que pueda descargar).
const defaults=await sql(`select name,value from duckdb_settings() where name in ('enable_external_access','autoinstall_known_extensions','autoload_known_extensions','allow_community_extensions','allow_unsigned_extensions','custom_extension_repository','lock_configuration','memory_limit','threads','temp_directory','allowed_directories','allowed_paths') order by name`)
console.log('Valores por defecto:',Object.fromEntries(defaults.map(r=>[r.name,r.value])))
// 1) Endurecimiento, en este orden. Todo antes de bloquear.
await sql(`SET autoinstall_known_extensions=false`);await sql(`SET autoload_known_extensions=false`)
await sql(`SET custom_extension_repository='${join(root,'no-existe')}'`)
await sql(`SET memory_limit='512MB'`);await sql(`SET threads=2`)
await sql(`SET temp_directory='${temp}'`);await sql(`SET max_temp_directory_size='1GB'`)
await sql(`SET allowed_directories=['${allowed}']`)
await sql(`SET enable_external_access=false`)
await sql(`SET lock_configuration=true`)
const hardened=await sql(`select name,value from duckdb_settings() where name in ('enable_external_access','lock_configuration','allowed_directories','memory_limit','threads','max_temp_directory_size','autoinstall_known_extensions','autoload_known_extensions') order by name`)
console.log('Tras endurecer:',Object.fromEntries(hardened.map(r=>[r.name,r.value])))

await attempt('leer un CSV autorizado',`select count(*) n from read_csv('${join(allowed,'ok.csv')}')`,'allowed')
await attempt('leer un CSV fuera de la carpeta autorizada',`select * from read_csv('${join(outside,'secreto.csv')}')`,'denied')
await attempt('recorrido de ruta con ../',`select * from read_csv('${allowed}/../fuera/secreto.csv')`,'denied')
await attempt('enlace simbólico dentro de la carpeta que apunta fuera',`select * from read_csv('${join(allowed,'enlace.csv')}')`,'denied')
await attempt('read_text de /etc/hosts',`select length(content) from read_text('/etc/hosts')`,'denied')
await attempt('glob de /etc',`select count(*) from glob('/etc/*')`,'denied')
await attempt('escribir fuera con COPY',`copy (select 1 a) to '${join(outside,'salida.csv')}'`,'denied')
await attempt('ATTACH de una base en disco',`attach '${join(outside,'x.db')}' as x`,'denied')
await attempt('URL local con read_csv (red)',`select * from read_csv('http://127.0.0.1:${port}/x.csv')`,'denied')
await attempt('INSTALL httpfs',`install httpfs`,'denied')
await attempt('LOAD httpfs',`load httpfs`,'denied')
await attempt('reactivar el acceso externo',`set enable_external_access=true`,'denied')
await attempt('ampliar allowed_directories',`set allowed_directories=['/']`,'denied')
await attempt('cambiar memory_limit tras el bloqueo',`set memory_limit='64GB'`,'denied')
// Escritura dentro de la carpeta autorizada: se registra, no se espera un resultado concreto (decide la política de la aplicación).
let writeInside;try{await sql(`copy (select 1 a) to '${join(allowed,'dentro.csv')}'`);writeInside='allowed'}catch(e){writeInside='denied'}
results.push({name:'escribir dentro de la carpeta autorizada (informativo)',outcome:writeInside,ok:true});console.log('INFO ','escribir dentro de la carpeta autorizada ->',writeInside)

// 2) Validación de sentencias en la capa de la aplicación: una sola sentencia y solo SELECT.
const validate=text=>{const st=conn.extractStatements(text);if(st.count!==1)throw new Error(`se esperaba 1 sentencia y hay ${st.count}`);const t=st.getStatement?.(0)?.type??st.statementType?.(0);return t}
let multi='allowed';try{validate(`select 1; drop table t`)}catch{multi='denied'}
results.push({name:'la capa de la aplicación rechaza varias sentencias',expect:'denied',outcome:multi,ok:multi==='denied'});console.log(multi==='denied'?'OK  ':'FALLA','varias sentencias ->',multi)

// 3) Límite de memoria con derrame a disco acotado: una ordenación mayor que el límite no puede crecer sin freno.
const t0=performance.now();let spill
try{await sql(`select count(*) from (select * from range(300000000) t(i) order by hash(i) desc limit 5)`);spill='terminó'}catch(e){spill=String(e.message).split('\n')[0].slice(0,160)}
results.push({name:'ordenar 300M filas con memory_limit=512MB y max_temp_directory_size=1GB',outcome:spill,ms:Math.round(performance.now()-t0),tempFiles:(await readdir(temp)).length,ok:true});console.log('INFO ','ordenación con límites ->',spill,Math.round(performance.now()-t0),'ms')

// 4) Cancelación: interrupt() a los 500 ms de una consulta larga; tiempo hasta que la promesa se rechaza.
const long=conn.runAndReadAll(`select count(*) from range(100000000000) t(i) where hash(i)%7=0`);const tStart=performance.now()
setTimeout(()=>conn.interrupt(),500);let interrupted;try{await long;interrupted=null}catch(e){interrupted=Math.round(performance.now()-tStart-500)}
results.push({name:'interrupt() cancela una consulta larga',outcome:interrupted===null?'no se canceló':`rechazada ${interrupted} ms después del interrupt()`,ok:interrupted!==null});console.log(interrupted===null?'FALLA':'OK  ','cancelación ->',interrupted,'ms tras interrupt()')
console.log('peticiones HTTP recibidas por el servidor local:',hits.length)
results.push({name:'peticiones de red observadas en el servidor local durante las pruebas',outcome:String(hits.length),ok:hits.length===0})

server.close();conn.closeSync();await rm(root,{recursive:true,force:true})
const failed=results.filter(r=>!r.ok);await writeFile(resolve(args.results??'results/duckdb-native-security.json'),JSON.stringify({version:(await (async()=>{const i=await duck.DuckDBInstance.create(':memory:');const c=await i.connect();return (await c.runAndReadAll('select version() v')).getRowObjects()[0].v})()),platform:`${process.platform}-${process.arch}`,node:process.version,defaults:Object.fromEntries(defaults.map(r=>[r.name,r.value])),hardened:Object.fromEntries(hardened.map(r=>[r.name,r.value])),results},null,1)+'\n')
console.log(failed.length?`${failed.length} comprobaciones no cumplieron lo esperado`:'todas las comprobaciones cumplieron lo esperado');process.exit(0)
