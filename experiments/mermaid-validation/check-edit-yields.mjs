import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const result=JSON.parse(await readFile(process.argv[2],'utf8'))
const large=result.samples.filter(sample=>sample.blocks===40)
assert.equal(large.length,5,'Deben medirse los cinco estados de 40 bloques')
for(const sample of large)assert(sample.callbacks.some(callback=>callback.heartbeatsDuring>0),`${sample.label}: la validación debe ceder el hilo`)
console.log('5/5 estados permiten latidos mientras se valida')
