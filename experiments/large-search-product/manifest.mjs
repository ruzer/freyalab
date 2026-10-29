import {writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const out=resolve(process.argv[2]),tasks=[],base='/private/tmp/FreyaLab-pruebas/',conditions=(op,value)=>({conditions:[{column:0,op,value}],filterMode:'all'})
const modes=[{label:'O0',workers:1,prefilter:false,partial:false},{label:'O1',workers:1,prefilter:true,partial:false},{label:'O2',workers:1,prefilter:true,partial:true},{label:'O3',workers:4,prefilter:true,partial:true}]
for(let series=0;series<3;series++)for(const [name,count] of [['ventas_100MiB.csv',448000],['ventas_1GiB.csv',4587000]])for(const [label,query,expected] of [['rare',conditions('ends','00000'),Math.floor(count/100000)],['ten-percent',conditions('ends','0'),count/10],['all',conditions('starts','V-'),count],['ascii',{search:'12345'},undefined],['unicode',{search:'mérida'},undefined],['all-search',{search:'V-'},count]])for(const mode of modes)tasks.push({...mode,series,label:label+'/'+mode.label,path:base+name,query,expected})
for(let series=0;series<3;series++)for(const search of ['mérida','zzq99','12345'])tasks.push({series,label:'wide-irregular/O0',path:out.replace(/\/product.*/, '')+'/fixtures/fixture-wide-lf-utf8-529MiB.csv',query:{search},workers:1,prefilter:false,partial:false})
for(const jobs of [1,2,4,8])tasks.push({label:'all/'+jobs+'-workers',path:base+'ventas_1GiB.csv',query:{search:'V-'},expected:4587000,workers:jobs,prefilter:true,partial:true})
tasks.push({label:'one-match',path:base+'ventas_1GiB.csv',query:{search:'V-000000012345'},expected:1,workers:4,prefilter:true,partial:true})
tasks.push({label:'million-page',kind:'page',path:base+'ventas_1GiB.csv',query:{search:'mérida'},workers:4,prefilter:true,partial:true})
tasks.push({label:'same-query-cache',kind:'cache',path:base+'ventas_1GiB.csv',query:{search:'12345'},workers:4,prefilter:true,partial:true})
for(const workers of [1,2,4,8])tasks.push({label:'regex-cancel/'+workers,kind:'cancel',path:out+'/fixtures/regex-hostile-1GiB.csv',query:{conditions:[{column:1,op:'regex',value:'(a+)+b'}],filterMode:'all'},workers,prefilter:true,partial:true,cancelAfterMs:350})
tasks.push({label:'ten-million-cap',kind:'cap',path:out+'/fixtures/ten-million.csv',query:{search:'target'},workers:8,prefilter:true,partial:true,expected:10000000})
for(const task of tasks)task.productWorker=true
await writeFile(out+'/manifest.json',JSON.stringify(tasks,null,2)+'\n');console.log(JSON.stringify({samples:tasks.length,path:out+'/manifest.json'}))
