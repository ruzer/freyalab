import {build} from 'rolldown'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
const out=resolve(process.argv[2])
await mkdir(out,{recursive:true})
await build({input:'experiments/large-search-s0/bench.ts',platform:'node',external:id=>!id.startsWith('.')&&!id.startsWith('/'),output:{file:resolve(out,'bench.mjs'),format:'esm',sourcemap:true}})
await build({input:'experiments/large-search-s0/parity.ts',platform:'node',external:id=>!id.startsWith('.')&&!id.startsWith('/'),output:{file:resolve(out,'parity.mjs'),format:'esm',sourcemap:true}})
console.log(resolve(out,'bench.mjs'))
