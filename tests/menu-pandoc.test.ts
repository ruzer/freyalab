import {describe,it,expect,vi} from 'vitest'
import {MenuPandocAvailability} from '../src/main/menu-pandoc'
import type {PandocStatus} from '../src/shared/pandoc'
const available=(path='/tools/pandoc'):PandocStatus=>({available:true,path,version:'3.12.1',license:'GPL-2.0-or-later'})
const unavailable:PandocStatus={available:false,reason:'No disponible',installation:'Instalar Pandoc'}
function deferred(){let resolve!:(status:PandocStatus)=>void,reject!:(reason:Error)=>void;const promise=new Promise<PandocStatus>((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
function setup(path?:string){
 let current=path
 const detector=vi.fn<(path?:string)=>Promise<PandocStatus>>(),writePath=vi.fn((path:string)=>{current=path}),onAvailable=vi.fn<(available:boolean)=>void>()
 const subject=new MenuPandocAvailability(detector,()=>current,writePath,onAvailable)
 return{subject,detector,writePath,onAvailable,path:()=>current,external:(path?:string)=>{current=path}}
}
describe('disponibilidad de Pandoc para el menú',()=>{
 it('no detecta ni notifica al construir; cada refresh explícito llama una sola vez',async()=>{
  const h=setup();expect(h.detector).not.toHaveBeenCalled();expect(h.onAvailable).not.toHaveBeenCalled();h.detector.mockResolvedValue(unavailable)
  expect(await h.subject.refresh()).toBe(unavailable);expect(h.detector).toHaveBeenCalledExactlyOnceWith(undefined)
  await h.subject.refresh();expect(h.detector).toHaveBeenCalledTimes(2);expect(h.onAvailable).not.toHaveBeenCalled();expect(h.writePath).not.toHaveBeenCalled()
 })
 it('detecta la ruta capturada sin reemplazarla por la ruta resuelta al refrescar',async()=>{
  const h=setup('/chosen/pandoc'),status=available('/resolved/pandoc');h.detector.mockResolvedValue(status)
  expect(await h.subject.refresh()).toBe(status);expect(h.detector).toHaveBeenCalledExactlyOnceWith('/chosen/pandoc');expect(h.path()).toBe('/chosen/pandoc');expect(h.writePath).not.toHaveBeenCalled();expect(h.onAvailable).toHaveBeenCalledExactlyOnceWith(true)
 })
 it('notifica sólo cambios true→false, sin duplicar el valor cacheado',async()=>{
  const h=setup();h.detector.mockResolvedValueOnce(available()).mockResolvedValueOnce(available()).mockResolvedValueOnce(unavailable).mockResolvedValueOnce(unavailable)
  await h.subject.refresh();await h.subject.refresh();await h.subject.refresh();await h.subject.refresh()
  expect(h.onAvailable.mock.calls).toEqual([[true],[false]]);expect(h.detector).toHaveBeenCalledTimes(4)
 })
 it('una detección startup tardía no pisa una selección válida más reciente',async()=>{
  const h=setup(),startup=deferred(),choice=deferred();h.detector.mockReturnValueOnce(startup.promise).mockReturnValueOnce(choice.promise)
  const old=h.subject.refresh(),selected=h.subject.choose('/candidate/pandoc'),status=available('/selected/pandoc');choice.resolve(status);expect(await selected).toBe(status)
  startup.resolve(unavailable);await old;expect(h.path()).toBe('/selected/pandoc');expect(h.writePath).toHaveBeenCalledExactlyOnceWith('/selected/pandoc');expect(h.onAvailable.mock.calls).toEqual([[true]])
 })
 it('refresh antiguo no aplica cuando existe otro refresh más reciente de la misma ruta',async()=>{
  const h=setup(),old=deferred(),latest=deferred();h.detector.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
  const a=h.subject.refresh(),b=h.subject.refresh();latest.resolve(unavailable);await b;old.resolve(available());await a
  expect(h.onAvailable).not.toHaveBeenCalled();expect(h.writePath).not.toHaveBeenCalled()
 })
 it('refresh inválido antiguo no revoca un refresh disponible reciente',async()=>{
  const h=setup(),old=deferred(),latest=deferred();h.detector.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
  const a=h.subject.refresh(),b=h.subject.refresh();latest.resolve(available());await b;old.resolve(unavailable);await a;expect(h.onAvailable.mock.calls).toEqual([[true]])
 })
 it('refresh no aplica si cambió la ruta externamente mientras detectaba',async()=>{
  const h=setup('/first'),pending=deferred();h.detector.mockReturnValue(pending.promise);const status=available('/first'),result=h.subject.refresh();h.external('/external');pending.resolve(status)
  expect(await result).toBe(status);expect(h.path()).toBe('/external');expect(h.onAvailable).not.toHaveBeenCalled();expect(h.writePath).not.toHaveBeenCalled()
 })
 it('choose usa el candidato una vez y guarda sólo la ruta validada por el detector',async()=>{
  const h=setup('/previous'),status=available('/canonical');h.detector.mockResolvedValue(status);expect(await h.subject.choose('/candidate')).toBe(status)
  expect(h.detector).toHaveBeenCalledExactlyOnceWith('/candidate');expect(h.writePath).toHaveBeenCalledExactlyOnceWith('/canonical');expect(h.path()).toBe('/canonical');expect(h.onAvailable).toHaveBeenCalledExactlyOnceWith(true)
 })
 it('dos selecciones solapadas: sólo la última puede escribir y publicar disponibilidad',async()=>{
  const h=setup('/previous'),first=deferred(),last=deferred();h.detector.mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise)
  const a=h.subject.choose('/first'),b=h.subject.choose('/last');last.resolve(available('/last'));await b;first.resolve(available('/first'));await a
  expect(h.path()).toBe('/last');expect(h.writePath).toHaveBeenCalledExactlyOnceWith('/last');expect(h.onAvailable.mock.calls).toEqual([[true]])
 })
 it('una selección inválida mantiene la ruta y la disponibilidad previas',async()=>{
  const h=setup('/previous');h.detector.mockResolvedValueOnce(available('/previous')).mockResolvedValueOnce(unavailable);await h.subject.refresh()
  expect(await h.subject.choose('/invalid')).toBe(unavailable);expect(h.path()).toBe('/previous');expect(h.writePath).not.toHaveBeenCalled();expect(h.onAvailable.mock.calls).toEqual([[true]])
 })
 it('una selección inválida nueva también invalida el startup anterior aún pendiente',async()=>{
  const h=setup('/previous'),startup=deferred();h.detector.mockReturnValueOnce(startup.promise).mockResolvedValueOnce(unavailable)
  const old=h.subject.refresh();await h.subject.choose('/invalid');startup.resolve(available());await old
  expect(h.path()).toBe('/previous');expect(h.onAvailable).not.toHaveBeenCalled();expect(h.writePath).not.toHaveBeenCalled()
 })
 it('una selección inválida nueva impide que una elección válida anterior escriba tarde',async()=>{
  const h=setup('/previous'),first=deferred();h.detector.mockReturnValueOnce(first.promise).mockResolvedValueOnce(unavailable)
  const old=h.subject.choose('/first');await h.subject.choose('/invalid');first.resolve(available('/first'));await old
  expect(h.path()).toBe('/previous');expect(h.writePath).not.toHaveBeenCalled();expect(h.onAvailable).not.toHaveBeenCalled()
 })
 it('choose no aplica si otra operación cambió la ruta externa durante la detección',async()=>{
  const h=setup('/previous'),pending=deferred();h.detector.mockReturnValue(pending.promise);const result=h.subject.choose('/candidate');h.external('/external');pending.resolve(available('/candidate'));await result
  expect(h.path()).toBe('/external');expect(h.writePath).not.toHaveBeenCalled();expect(h.onAvailable).not.toHaveBeenCalled()
 })
 it('el rechazo de choose se propaga, mantiene el estado e invalida un startup antiguo',async()=>{
  const h=setup('/previous'),startup=deferred(),chosen=deferred();h.detector.mockReturnValueOnce(startup.promise).mockReturnValueOnce(chosen.promise)
  const old=h.subject.refresh(),result=h.subject.choose('/candidate'),rejected=expect(result).rejects.toThrow('detector failed');chosen.reject(new Error('detector failed'));await rejected
  startup.resolve(available());await old;expect(h.path()).toBe('/previous');expect(h.onAvailable).not.toHaveBeenCalled();expect(h.writePath).not.toHaveBeenCalled()
 })
 it('el rechazo de refresh conserva la disponibilidad existente y no escribe rutas',async()=>{
  const h=setup('/previous');h.detector.mockResolvedValueOnce(available()).mockRejectedValueOnce(new Error('detector failed'));await h.subject.refresh()
  await expect(h.subject.refresh()).rejects.toThrow('detector failed');expect(h.path()).toBe('/previous');expect(h.onAvailable.mock.calls).toEqual([[true]]);expect(h.writePath).not.toHaveBeenCalled()
 })
 it('un refresh más reciente invalida una elección anterior sin tocar la ruta',async()=>{
  const h=setup('/previous'),first=deferred();h.detector.mockReturnValueOnce(first.promise).mockResolvedValueOnce(unavailable)
  const old=h.subject.choose('/first');await h.subject.refresh();first.resolve(available('/first'));await old
  expect(h.path()).toBe('/previous');expect(h.writePath).not.toHaveBeenCalled();expect(h.onAvailable).not.toHaveBeenCalled()
 })
})
