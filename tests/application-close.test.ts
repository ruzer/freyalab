import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {WindowClosePreparation,closePreparedArguments} from '../src/main/application-close'
import {closePrepareCommand} from '../src/shared/application'

const nonce='12345678-1234-4234-8234-123456789abc'
const wrongNonce='87654321-4321-4321-8321-cba987654321'
beforeEach(()=>vi.useFakeTimers())
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers()})

describe('APP-01 · ACK booleano privado de preparación del cierre',()=>{
 it('acepta sólo UUID y booleano, sin motivo, nombre ni ruta del documento',()=>{
  expect(closePreparedArguments.parse([nonce,true])).toEqual([nonce,true])
  expect(closePreparedArguments.parse([nonce,false])).toEqual([nonce,false])
 })
 it.each([
  [],['no-uuid',true],[nonce,'true'],[nonce,{ready:true}],
  [nonce,true,'edit.paste'],[nonce,false,{documentId:nonce}],
  [nonce,false,{reason:'busy',path:'/ruta/privada.csv'}],
 ].map(args=>({args})))('rechaza un ACK ajeno al contrato %#',({args})=>{
  expect(closePreparedArguments.safeParse(args).success).toBe(false)
 })
 it('envía sólo el comando interno y consume el ACK una vez para su dueño',async()=>{
  const close=new WindowClosePreparation(),send=vi.fn(),request=close.request(7,send)
  expect(closePreparedArguments.safeParse([request.nonce,true]).success).toBe(true)
  expect(send).toHaveBeenCalledTimes(1);expect(send).toHaveBeenCalledWith({id:closePrepareCommand,nonce:request.nonce})
  expect(close.complete(8,request.nonce,true)).toBe(false)
  expect(close.complete(7,wrongNonce,true)).toBe(false)
  expect(close.complete(7,request.nonce,true)).toBe(true)
  await expect(request.promise).resolves.toBe(true)
  expect(close.complete(7,request.nonce,true)).toBe(false);expect(vi.getTimerCount()).toBe(0)
 })
 it('el mismo dueño reutiliza preparación y otro no puede sustituirla',async()=>{
  const close=new WindowClosePreparation(),send=vi.fn(),first=close.request(7,send),same=close.request(7,send)
  expect(same.nonce).toBe(first.nonce);expect(same.promise).toBe(first.promise);expect(send).toHaveBeenCalledTimes(1)
  expect(()=>close.request(8,send)).toThrow();expect(send).toHaveBeenCalledTimes(1)
  close.complete(7,first.nonce,false);await expect(first.promise).resolves.toBe(false)
 })
 it.each([0,-1,1.5,NaN,Infinity])('no inicia un cierre con webContents inválido %s',contents=>{
  const close=new WindowClosePreparation(),send=vi.fn()
  expect(()=>close.request(contents,send)).toThrow();expect(send).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0)
 })
 it('a los 30 segundos expira localmente; el ACK antiguo no sirve en un reintento',async()=>{
  const close=new WindowClosePreparation(),first=close.request(7,vi.fn()),observed=vi.fn()
  const outcome=first.promise.then(value=>({value}),error=>({error}));void outcome.then(observed)
  await vi.advanceTimersByTimeAsync(29999);expect(observed).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect((await outcome as {error:unknown}).error).toBeInstanceOf(Error)
  const next=close.request(7,vi.fn());expect(next.nonce).not.toBe(first.nonce)
  expect(close.complete(7,first.nonce,true)).toBe(false);expect(close.complete(7,next.nonce,true)).toBe(true)
  await expect(next.promise).resolves.toBe(true);expect(vi.getTimerCount()).toBe(0)
 })
 it('destruir otra ventana no cancela la del dueño; destruir la suya libera el reintento',async()=>{
  const close=new WindowClosePreparation(),first=close.request(7,vi.fn()),observed=vi.fn()
  void first.promise.then(observed);close.clear(8);await Promise.resolve();expect(observed).not.toHaveBeenCalled()
  close.clear(7);await expect(first.promise).resolves.toBe(false)
  const next=close.request(7,vi.fn());close.clear(8)
  expect(close.complete(7,first.nonce,true)).toBe(false);expect(close.complete(7,next.nonce,false)).toBe(true)
  await expect(next.promise).resolves.toBe(false);expect(vi.getTimerCount()).toBe(0)
 })
 it('un envío fallido resuelve false sin rechazar ni consumir un reintento',async()=>{
  const close=new WindowClosePreparation(),first=close.request(7,()=>{throw new Error('envío fallido')})
  await expect(first.promise).resolves.toBe(false)
  const next=close.request(7,vi.fn());expect(next.nonce).not.toBe(first.nonce)
  expect(close.complete(7,first.nonce,true)).toBe(false);close.clear(7)
  await expect(next.promise).resolves.toBe(false);expect(vi.getTimerCount()).toBe(0)
 })
 it('puede recibir el ACK durante el envío síncrono sin dejar temporizadores',async()=>{
  const close=new WindowClosePreparation(),request=close.request(7,event=>{expect(close.complete(7,event.nonce,true)).toBe(true)})
  await expect(request.promise).resolves.toBe(true);expect(vi.getTimerCount()).toBe(0)
 })
 it('un valor no booleano no consume el nonce ni se interpreta como true',async()=>{
  const close=new WindowClosePreparation(),request=close.request(7,vi.fn())
  expect(close.complete(7,request.nonce,'true' as unknown as boolean)).toBe(false)
  expect(close.complete(7,request.nonce,false)).toBe(true)
  await expect(request.promise).resolves.toBe(false);expect(vi.getTimerCount()).toBe(0)
 })
})
