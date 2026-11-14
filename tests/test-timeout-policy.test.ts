import {beforeAll,expect,it} from 'vitest'
import {resolveConfig} from 'vitest/node'
import type {} from 'vitest/config'
import {fileURLToPath} from 'node:url'

let prepared=false
beforeAll(()=>{prepared=true})

it('una prueba sin plazo propio hereda el límite común de bloqueo',({task})=>{
 expect(prepared).toBe(true)
 expect(task.timeout).toBe(120_000)
})

it('la configuración real aplica el mismo límite a pruebas y hooks',async()=>{
 const {test}=await resolveConfig({root:fileURLToPath(new URL('../',import.meta.url)),config:'vitest.config.ts'})
 expect(test).toMatchObject({testTimeout:120_000,hookTimeout:120_000})
})
