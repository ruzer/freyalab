import {it,expect} from 'vitest'
import {waitForView} from './helpers/view-state'
function simulatedClock(step=2){let elapsed=0;return{now:()=>elapsed,pause:async()=>{elapsed+=step}}}
it('espera más de 3000 sondeos si la condición termina dentro del presupuesto existente',async()=>{
 const time=simulatedClock();let calls=0
 const result=await waitForView(async()=>({status:++calls>4000?'complete':'running'}),29000,time)
 expect(result.status).toBe('complete');expect(calls).toBe(4001);expect(time.now()).toBe(8000);expect(time.now()).toBeLessThan(30000)
})
it('mantiene un único plazo entre consultas sin reiniciar el presupuesto exterior',async()=>{
 const time=simulatedClock();let calls=0
 await waitForView(async()=>({status:++calls>20?'complete':'running'}),60,time);expect(time.now()).toBe(40);calls=0
 await expect(waitForView(async()=>({status:++calls>20?'complete':'running'}),60,time)).rejects.toThrow('plazo');expect(time.now()).toBe(60)
})
it('un trabajo que nunca termina se rechaza antes del exterior de 30 segundos',async()=>{
 const time=simulatedClock(1000)
 await expect(waitForView(async()=>({status:'running'}),29000,time)).rejects.toThrow('plazo');expect(time.now()).toBe(29000);expect(time.now()).toBeLessThan(30000)
})
it('un resultado completo, error o ausente devuelve su estado sin esperar',async()=>{
 const time=simulatedClock()
 for(const value of [{status:'complete'},{status:'error'},null])expect(await waitForView(async()=>value,29000,time)).toEqual(value)
 expect(time.now()).toBe(0)
})
it('no acepta una respuesta que llega después del plazo exterior',async()=>{
 const time=simulatedClock(31000)
 await expect(waitForView(async()=>{await time.pause();return{status:'complete'}},29000,time)).rejects.toThrow('plazo');expect(time.now()).toBe(31000)
})
