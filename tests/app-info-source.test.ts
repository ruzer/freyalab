import {it,expect} from 'vitest'
import {readFile,readdir} from 'node:fs/promises'
import {join} from 'node:path'
it('APP-02 A1 · la interfaz no escribe a mano la versión del paquete',async()=>{
 const files=(await readdir('src/renderer',{recursive:true})).filter(file=>/\.(?:svelte|ts|html)$/.test(file)),fixed:string[]=[]
 for(const file of files)if((await readFile(join('src/renderer',file),'utf8')).includes('0.1.0'))fixed.push(file)
 expect(fixed).toEqual([])
})
