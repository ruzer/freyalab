import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const folder=resolve(process.argv[2]),all=JSON.parse(await readFile(folder+'/manifest.json','utf8')),tasks=all.filter(task=>task.label.endsWith('/O0')&&task.query.search&&(task.path.endsWith('ventas_100MiB.csv')||task.label==='wide-irregular/O0'))
await writeFile(folder+'/baseline.json',JSON.stringify(tasks,null,2)+'\n');console.log(JSON.stringify({samples:tasks.length,path:folder+'/baseline.json'}))
