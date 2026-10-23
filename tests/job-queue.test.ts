import {describe,expect,it} from 'vitest'
import {JobQueue} from '../src/main/job-queue'

// Una tarea controlable: se resuelve o falla cuando la prueba lo decide, y registra su ciclo de vida.
function task(label:string,log:string[]){
 let resolve!:(value:string)=>void,reject!:(error:Error)=>void
 const promise=new Promise<string>((a,b)=>{resolve=a;reject=b})
 return{resolve,reject,start:()=>{log.push(`inicio ${label}`);return promise},dispose:()=>{log.push(`libera ${label}`)}}
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0))

describe('JobQueue',()=>{
 it('ejecuta una tarea a la vez y arranca la siguiente cuando termina la anterior',async()=>{
  const log:string[]=[],queue=new JobQueue(1),a=task('A',log),b=task('B',log)
  const first=queue.run('a','interactive',a.start,a.dispose),second=queue.run('b','interactive',b.start,b.dispose)
  await tick();expect(log).toEqual(['inicio A'])
  a.resolve('uno');await expect(first).resolves.toBe('uno');await tick()
  expect(log).toEqual(['inicio A','libera A','inicio B'])
  b.resolve('dos');await expect(second).resolves.toBe('dos');expect(log.at(-1)).toBe('libera B')
 })
 it('atiende primero lo interactivo y respeta el orden de llegada dentro de cada prioridad',async()=>{
  const log:string[]=[],queue=new JobQueue(1),running=task('en curso',log),others=['exportar 1','exportar 2'].map(label=>task(label,log)),ui=task('interactiva',log)
  const all=[queue.run('r','export',running.start,running.dispose),queue.run('e1','export',others[0].start,others[0].dispose),queue.run('e2','export',others[1].start,others[1].dispose),queue.run('i','interactive',ui.start,ui.dispose)]
  for(const item of [running,ui,...others]){await tick();item.resolve('ok')}
  await Promise.all(all)
  expect(log.filter(line=>line.startsWith('inicio'))).toEqual(['inicio en curso','inicio interactiva','inicio exportar 1','inicio exportar 2'])
 })
 it('cancelar una tarea en cola la retira sin arrancarla ni liberarla',async()=>{
  const log:string[]=[],queue=new JobQueue(1),a=task('A',log),b=task('B',log),c=task('C',log)
  const first=queue.run('a','interactive',a.start,a.dispose),second=queue.run('b','interactive',b.start,b.dispose),third=queue.run('c','interactive',c.start,c.dispose)
  await tick();expect(queue.cancel('b')).toBe(true)
  await expect(second).rejects.toThrow('Análisis cancelado.')
  a.resolve('A');await first;await tick();c.resolve('C');await expect(third).resolves.toBe('C')
  expect(log).toEqual(['inicio A','libera A','inicio C','libera C'])
 })
 it('cancelar una tarea en curso libera su recurso y el hueco sin esperar a que responda',async()=>{
  const log:string[]=[],queue=new JobQueue(1),a=task('A',log),b=task('B',log)
  const first=queue.run('a','interactive',a.start,a.dispose),second=queue.run('b','interactive',b.start,b.dispose)
  await tick();expect(queue.cancel('a')).toBe(true)
  await expect(first).rejects.toThrow('Análisis cancelado.')
  await tick();expect(log).toEqual(['inicio A','libera A','inicio B']) // A nunca se resolvió y B ya está en marcha
  a.resolve('tarde');await tick();expect(log).toEqual(['inicio A','libera A','inicio B']) // un cierre tardío no libera dos veces
  b.resolve('B');await expect(second).resolves.toBe('B')
 })
 it('usa el error indicado al cancelar',async()=>{
  const queue=new JobQueue(1),a=task('A',[]),run=queue.run('a','interactive',a.start,a.dispose)
  await tick();queue.cancel('a',new Error('El análisis superó dos minutos.'))
  await expect(run).rejects.toThrow('El análisis superó dos minutos.')
 })
 it('propaga un fallo, libera el recurso y deja pasar a la siguiente',async()=>{
  const log:string[]=[],queue=new JobQueue(1),a=task('A',log),b=task('B',log)
  const first=queue.run('a','interactive',a.start,a.dispose),second=queue.run('b','interactive',b.start,b.dispose)
  await tick();a.reject(new Error('falló'));await expect(first).rejects.toThrow('falló')
  await tick();b.resolve('B');await expect(second).resolves.toBe('B')
  expect(log).toEqual(['inicio A','libera A','inicio B','libera B'])
 })
 it('una tarea que lanza al arrancar falla sin bloquear la cola',async()=>{
  const log:string[]=[],queue=new JobQueue(1),b=task('B',log)
  const first=queue.run('a','interactive',()=>{throw new Error('no arranca')},()=>{log.push('libera A')}),second=queue.run('b','interactive',b.start,b.dispose)
  await expect(first).rejects.toThrow('no arranca');await tick();b.resolve('B');await expect(second).resolves.toBe('B')
  expect(log).toEqual(['libera A','inicio B','libera B'])
 })
 it('respeta el límite de concurrencia indicado',async()=>{
  const log:string[]=[],queue=new JobQueue(2),items=['A','B','C'].map(label=>task(label,log))
  const all=items.map((item,index)=>queue.run(String(index),'interactive',item.start,item.dispose))
  await tick();expect(log).toEqual(['inicio A','inicio B'])
  items[0].resolve('A');await tick();expect(log).toContain('inicio C')
  items[1].resolve('B');items[2].resolve('C');await Promise.all(all)
 })
 it('avisa solo a las tareas que tienen que esperar',async()=>{
  const waited:string[]=[],queue=new JobQueue(1,id=>waited.push(id)),a=task('A',[]),b=task('B',[])
  const first=queue.run('a','interactive',a.start,a.dispose),second=queue.run('b','interactive',b.start,b.dispose)
  await tick();a.resolve('A');await first;await tick();b.resolve('B');await second
  expect(waited).toEqual(['b'])
 })
 it('vaciar la cola libera lo que corre y cancela lo que espera sin arrancarlo',async()=>{
  const log:string[]=[],queue=new JobQueue(1),a=task('A',log),b=task('B',log)
  const first=queue.run('a','interactive',a.start,a.dispose),second=queue.run('b','interactive',b.start,b.dispose)
  await tick();queue.clear()
  await expect(first).rejects.toThrow('Análisis cancelado.');await expect(second).rejects.toThrow('Análisis cancelado.')
  await tick();expect(log).toEqual(['inicio A','libera A']) // B nunca llega a crear su recurso
 })
 it('cancelar algo desconocido o ya terminado no hace nada',async()=>{
  const log:string[]=[],queue=new JobQueue(1),a=task('A',log),run=queue.run('a','interactive',a.start,a.dispose)
  await tick();a.resolve('A');await run
  expect(queue.cancel('a')).toBe(false);expect(queue.cancel('nada')).toBe(false)
  expect(log).toEqual(['inicio A','libera A'])
 })
})
