import {build} from 'rolldown'
import {mkdir,readFile,writeFile,symlink} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true})
for(const [input,name] of [['experiments/large-search-product/bench.ts','bench'],['src/main/large-search-worker.ts','worker']])await build({input,platform:'node',external:id=>!id.startsWith('.')&&!id.startsWith('/'),output:{file:resolve(out,name+'.mjs'),format:'esm',sourcemap:true}})
await symlink(resolve('node_modules'),resolve(out,'node_modules'),'junction').catch(error=>{if(error.code!=='EEXIST')throw error})
const sources=['src/main/large-table.ts','src/main/large-view.ts','src/main/large-search-pool.ts','src/main/large-search-scan.ts','src/main/large-search-worker.ts','src/main/large-matches.ts','src/main/table-query.ts','src/main/table-engine.ts','src/main/operations.ts','src/main/operation-schema.ts','src/shared/types.ts','src/shared/operations.ts','experiments/large-search-product/bench.ts','package-lock.json'],hash={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources:Object.fromEntries(await Promise.all(sources.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])))}
hash.artifacts=Object.fromEntries(await Promise.all(['bench.mjs','bench.mjs.map','worker.mjs','worker.mjs.map'].map(async path=>[path,createHash('sha256').update(await readFile(resolve(out,path))).digest('hex')])));await writeFile(resolve(out,'sources-before.json'),JSON.stringify(hash,null,2)+'\n');console.log(resolve(out,'bench.mjs'))
