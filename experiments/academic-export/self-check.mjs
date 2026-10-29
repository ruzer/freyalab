import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {reportSource,prepareFixture,sha256,library} from './generate.mjs'
const here=dirname(fileURLToPath(import.meta.url)),folder=join(here,'generator-self-check');await mkdir(folder,{recursive:true})
for(const count of [0,1,200,2000]){
 const first=reportSource(count),second=reportSource(count)
 assert.equal(first,second);assert.equal((first.match(/APENDICE-/g)??[]).length,count)
 assert(first.includes('\ninstitution: Instituto FreyaLab Sintético\n'))
 assert.equal((first.match(/^```mermaid$/gm)??[]).length,3);assert.equal((first.match(/!\[Ventas del capítulo/g)??[]).length,6)
 assert(!/page-break|break-before|<style|<div|https?:\/\//.test(first));assert(first.endsWith('FIN-REPORTE-SINTETICO\n'))
 assert(Buffer.byteLength(first)<10*1024*1024)
}
for(const count of [-1,0.5,2001])assert.throws(()=>reportSource(count))
assert.equal(new Set(library.map(entry=>entry.id)).size,library.length)
const first=await prepareFixture(join(folder,'a'),3),second=await prepareFixture(join(folder,'b'),3);assert.deepEqual(first,second)
for(const [name,entry]of Object.entries(first.files))assert.equal(sha256(await readFile(join(folder,'a',name))),entry.sha256)
const refused=spawnSync(process.execPath,[join(here,'measure.mjs'),'calibrate'],{encoding:'utf8'});assert.equal(refused.status,1);assert(refused.stderr.includes('No ejecutar sin una concesión explícita'))
const result={status:'pass',checks:['deterministic source at 0/1/200/2000 paragraphs','synthetic institution metadata preserved','paragraph counts and 3 Mermaid/6 figures','no page-break CSS, HTML or remote URLs','source below 10 MiB','reject invalid counts','unique bibliography ids','identical on-disk source/library/image bytes across two directories','runner refuses execution without explicit lease'],electronExecuted:false,pandocExecuted:false,benchmarkExecuted:false,fixtureState:'generated, not calibrated'}
await writeFile(join(here,'generator-self-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))
