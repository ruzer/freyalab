#!/usr/bin/env node
// Contrasta el índice disperso con un informe de validación hecho por OTRA herramienta: lista de {archivo, filas}.
//   node verify-row-counts.mjs /ruta/validacion.json --results results/user-files-row-counts.json
// «filas» = registros de datos (sin cabecera). Los archivos se buscan junto al informe.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {dirname,join,resolve} from 'node:path'
import {buildIndex} from './lib/record-index.mjs'
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,all)=>x.startsWith('--')?[...a,[x.slice(2),all[i+1]]]:a,[]))
const report=resolve(process.argv[2]),entries=JSON.parse(await readFile(report,'utf8')),results=[]
for(const {archivo,filas,columnas,bytes} of entries){
 const t=performance.now(),index=await buildIndex(join(dirname(report),archivo)),ms=Math.round(performance.now()-t),data=index.records-1
 const row={archivo,bytes:index.size,esperado:filas,indexado:data,coincide:data===filas&&(bytes===undefined||bytes===index.size),columnasEsperadas:columnas,ms,mibPorS:Math.round(index.size/2**20/(ms/1000)),indiceKiB:Math.round(index.offsets.byteLength/1024),codificacion:index.encoding,salto:index.eol}
 results.push(row);console.log(JSON.stringify(row))
}
if(args.results){await mkdir(dirname(resolve(args.results)),{recursive:true});await writeFile(resolve(args.results),JSON.stringify({platform:`${process.platform}-${process.arch}`,node:process.version,results},null,1)+'\n')}
process.exit(results.every(r=>r.coincide)?0:1)
