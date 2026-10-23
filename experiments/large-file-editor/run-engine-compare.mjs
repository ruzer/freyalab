#!/usr/bin/env node
// Ejecuta engine-compare.mjs para cada (archivo, motor, tarea) en procesos separados y reúne los resultados.
//   node run-engine-compare.mjs --install /ruta/duckdb-native --temp /ruta/tmp --results results/engines.json --plan plan.json
// plan.json: [{"file":"...","engine":"duckdb-native","tasks":["count","filter"],"timeoutMs":600000,"memory":"2GB"}]
import {spawnSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {dirname,resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,all)=>x.startsWith('--')?[...a,[x.slice(2),all[i+1]]]:a,[]))
const here=dirname(fileURLToPath(import.meta.url)),plan=JSON.parse(readFileSync(resolve(args.plan),'utf8')),runs=[]
for(const {file,engine,tasks,timeoutMs=900000,memory} of plan)for(const task of tasks){
 const cmd=['engine-compare.mjs','--engine',engine,'--task',task,'--file',file,'--install',args.install,'--temp',args.temp,...(memory?['--memory',memory]:[])]
 const t=Date.now(),r=spawnSync(process.execPath,[join(here,cmd[0]),...cmd.slice(1)],{encoding:'utf8',timeout:timeoutMs,maxBuffer:1<<24})
 const line=r.stdout?.trim().split('\n').at(-1);let row
 try{row=JSON.parse(line)}catch{row={engine,task,file,error:r.error?.code==='ETIMEDOUT'?`tiempo agotado (${timeoutMs} ms)`:`sin resultado: ${(r.stderr||'').split('\n').find(l=>/Error|error/.test(l))??r.status}`,ms:Date.now()-t}}
 runs.push(row);console.log(`${engine.padEnd(14)} ${task.padEnd(9)} ${String(row.fileMiB??'').padStart(5)} MiB  ${String(row.ms).padStart(7)} ms  ${String(row.mibPerS??'').padStart(5)} MiB/s  RSS ${row.maxRssMiB??'?'} MiB  tmp ${row.tempPeakMiB??0} MiB  ${row.digest??row.error}`)
}
mkdirSync(dirname(resolve(args.results)),{recursive:true});writeFileSync(resolve(args.results),JSON.stringify({platform:`${process.platform}-${process.arch}`,node:process.version,runs},null,1)+'\n')
