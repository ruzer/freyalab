import {describe,it,expect,vi} from 'vitest'
import type {BrowserContext,TestInfo} from '@playwright/test'
import {traceElectronFailure} from './e2e/electron-trace'

function fixture(status:TestInfo['status']='passed'){
 const tracing={start:vi.fn().mockResolvedValue(undefined),stop:vi.fn().mockResolvedValue(undefined)}
 const info={status,annotations:[] as TestInfo['annotations'],outputPath:vi.fn((name:string)=>`/synthetic-results/${name}`),attach:vi.fn().mockResolvedValue(undefined)}
 return{tracing,info,context:{tracing} as unknown as Pick<BrowserContext,'tracing'>}
}

describe('traza del contexto real de Electron',()=>{
 it('inicia snapshots y fotogramas; descarta el ZIP si el caso pasa',async()=>{
  const {tracing,info,context}=fixture(),stop=await traceElectronFailure(context,info)
  expect(tracing.start).toHaveBeenCalledExactlyOnceWith({screenshots:true,snapshots:true,sources:true})
  await stop();expect(tracing.stop).toHaveBeenCalledExactlyOnceWith();expect(info.attach).not.toHaveBeenCalled();expect(info.outputPath).not.toHaveBeenCalled();expect(info.annotations).toEqual([])
 })
 for(const status of ['failed','timedOut','interrupted'] as const)it(`conserva y adjunta el ZIP cuando el resultado final es ${status}`,async()=>{
  const {tracing,info,context}=fixture(),stop=await traceElectronFailure(context,info)
  info.status=status;await stop()
  expect(tracing.stop).toHaveBeenCalledExactlyOnceWith({path:'/synthetic-results/electron-context.zip'})
  expect(info.attach).toHaveBeenCalledExactlyOnceWith('electron-context',{path:'/synthetic-results/electron-context.zip',contentType:'application/zip'});expect(info.annotations).toEqual([])
 })
 it('no sustituye un fallo si iniciar la captura falla',async()=>{
  const {tracing,info,context}=fixture('failed');tracing.start.mockRejectedValue(new Error('inicio'))
  await expect((await traceElectronFailure(context,info))()).resolves.toBeUndefined()
  expect(tracing.stop).not.toHaveBeenCalled();expect(info.attach).not.toHaveBeenCalled();expect(info.status).toBe('failed');expect(info.annotations).toEqual([{type:'electron-trace',description:'No se pudo iniciar la traza del contexto de Electron.'}])
 })
 for(const status of ['passed','failed'] as const)it(`no cambia ${status} si terminar la captura falla`,async()=>{
  const {tracing,info,context}=fixture(status);tracing.stop.mockRejectedValue(new Error('cierre'))
  await expect((await traceElectronFailure(context,info))()).resolves.toBeUndefined()
  expect(tracing.stop).toHaveBeenCalledTimes(1);expect(info.attach).not.toHaveBeenCalled();expect(info.status).toBe(status);expect(info.annotations).toEqual([{type:'electron-trace',description:'No se pudo terminar la traza del contexto de Electron.'}])
 })
 it('conserva el resultado original si adjuntar el ZIP falla',async()=>{
  const {tracing,info,context}=fixture('failed');info.attach.mockRejectedValue(new Error('adjunto'))
  await expect((await traceElectronFailure(context,info))()).resolves.toBeUndefined()
  expect(tracing.stop).toHaveBeenCalledExactlyOnceWith({path:'/synthetic-results/electron-context.zip'});expect(info.status).toBe('failed');expect(info.annotations).toEqual([{type:'electron-trace',description:'No se pudo adjuntar la traza del contexto de Electron.'}])
 })
})
