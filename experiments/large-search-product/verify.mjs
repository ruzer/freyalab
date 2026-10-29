import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {resolve} from 'node:path'
const folder=resolve(process.argv[2]),before=JSON.parse(await readFile(folder+'/sources-before.json','utf8')),sources=Object.fromEntries(await Promise.all(Object.keys(before.sources).map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));await writeFile(folder+'/sources-after.json',JSON.stringify({sources},null,2)+'\n');assert.deepEqual(sources,before.sources);const artifacts=Object.fromEntries(await Promise.all(Object.keys(before.artifacts).map(async path=>[path,createHash('sha256').update(await readFile(resolve(folder,path))).digest('hex')])));assert.deepEqual(artifacts,before.artifacts);console.log('Frozen sources and bundles unchanged')
