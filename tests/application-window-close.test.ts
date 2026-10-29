import {afterEach,beforeEach,expect,it,vi,type Mock} from 'vitest'
import {ApplicationWindowClose,type ApplicationWindowCloseOptions} from '../src/main/application-window-close'
import {WindowClosePreparation} from '../src/main/application-close'
import {setLanguage} from '../src/shared/i18n'
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return{promise,resolve}}
type Transport={id?:string;nonce?:string;type?:string}
let preparation:WindowClosePreparation,controller:ApplicationWindowClose,options:ApplicationWindowCloseOptions,current:ApplicationWindowCloseOptions['owner']
let lease:{ready:Promise<void>;closeAll:Mock<(owner:()=>boolean)=>Promise<{closed:boolean;saved:string[]}>>;release:Mock<()=>void>}
let send:Mock<(channel:string,event:unknown)=>void>,started:Mock<()=>void>,ended:Mock<()=>void>,finish:Mock<(ids:string[])=>Promise<void>>,failed:Mock<(message:string)=>void>,cancelled:Mock<(saved:string[])=>void>

beforeEach(()=>{
 setLanguage('es');preparation=new WindowClosePreparation();controller=new ApplicationWindowClose(preparation);started=vi.fn();ended=vi.fn();finish=vi.fn(async()=>{});failed=vi.fn();cancelled=vi.fn()
 send=vi.fn((_channel,raw)=>{const event=raw as Transport;if(event.id==='app.prepareClose')queueMicrotask(()=>preparation.complete(1,event.nonce!,true))});const owner={webContents:{id:1,send},isDestroyed:()=>false};current=owner
 lease={ready:Promise.resolve(),closeAll:vi.fn(async()=>({closed:true,saved:[]})),release:vi.fn()}
 options={owner,currentWindow:()=>current,documents:{records:new Map([['A',{}],['B',{}]]),info:(id:string)=>({id,name:id+'.md'}),holdForApplicationClose:()=>lease} as unknown as ApplicationWindowCloseOptions['documents'],settings:{flush:vi.fn(async()=>{})},started,ended,finish,failed,cancelled}
})
afterEach(()=>{vi.useRealTimers();setLanguage('es')})
it('prepara una vez, mantiene lease durante finish y limpia después',async()=>{
 finish.mockImplementation(async ids=>{expect(ids).toEqual(['A','B']);expect(lease.release).not.toHaveBeenCalled()});expect(await controller.close(options)).toBe(true);expect(started).toHaveBeenCalledOnce();expect(lease.closeAll).toHaveBeenCalledOnce();expect(lease.release).toHaveBeenCalledOnce();expect(ended).toHaveBeenCalledOnce();expect(controller.isClosing).toBe(false)
})
it('un rechazo booleano no toca documentos ni tapa el aviso preciso de la interfaz',async()=>{
 send.mockImplementation((_channel,raw)=>{const event=raw as Transport;if(event.id==='app.prepareClose')queueMicrotask(()=>preparation.complete(1,event.nonce!,false))});const hold=vi.spyOn(options.documents,'holdForApplicationClose');expect(await controller.close(options)).toBe(false);expect(hold).not.toHaveBeenCalled();expect(failed).not.toHaveBeenCalled();expect(cancelled).not.toHaveBeenCalled();expect(finish).not.toHaveBeenCalled();expect(ended).toHaveBeenCalledOnce()
})
it('intentos superpuestos comparten la misma tarea y no repiten preparación',async()=>{
 const wait=deferred();options.settings.flush=()=>wait.promise;const first=controller.close(options),second=controller.close(options);expect(first).toBe(second);await Promise.resolve();await Promise.resolve();wait.resolve();expect(await first).toBe(true);expect(started).toHaveBeenCalledOnce()
})
it('un fallo al iniciar o al enviar no deja el cierre retenido',async()=>{
 started.mockImplementationOnce(()=>{throw new Error('fallo inicio')});expect(await controller.close(options)).toBe(false);expect(controller.isClosing).toBe(false);expect(ended).toHaveBeenCalledOnce();expect(await controller.close(options)).toBe(true)
})
it('un envío fallido informa el motivo local y no cierra',async()=>{
 send.mockImplementation(()=>{throw new Error('transport')});expect(await controller.close(options)).toBe(false);expect(failed).toHaveBeenCalledWith(expect.stringContaining('comunicarme'));expect(finish).not.toHaveBeenCalled();expect(controller.isClosing).toBe(false)
})
it('el timeout30s conserva registros, avisa y permite reintentar (reloj simulado)',async()=>{
 vi.useFakeTimers();send.mockImplementation(()=>{});const result=controller.close(options);await vi.advanceTimersByTimeAsync(29999);expect(failed).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(await result).toBe(false);expect(failed).toHaveBeenCalledWith(expect.stringContaining('30 segundos'));expect(options.documents.records.size).toBe(2);expect(finish).not.toHaveBeenCalled();expect(controller.isClosing).toBe(false)
})
it('un dueño sustituido durante settings.flush no llega a confirmar ni disponer',async()=>{
 const wait=deferred();options.settings.flush=()=>wait.promise;const result=controller.close(options);await vi.waitFor(()=>expect(started).toHaveBeenCalled());await Promise.resolve();await Promise.resolve();current={webContents:{id:2,send:vi.fn()},isDestroyed:()=>false};wait.resolve();expect(await result).toBe(false);expect(lease.closeAll).not.toHaveBeenCalled();expect(finish).not.toHaveBeenCalled();expect(lease.release).toHaveBeenCalledOnce()
})
it('el predicado pasa a Documents y detecta sustitución durante la confirmación',async()=>{
 lease.closeAll.mockImplementation(async owner=>{expect(owner()).toBe(true);current={webContents:{id:2,send:vi.fn()},isDestroyed:()=>false};expect(owner()).toBe(false);return{closed:false,saved:[]}});expect(await controller.close(options)).toBe(false);expect(finish).not.toHaveBeenCalled();expect(options.documents.records.size).toBe(2)
})
it('cancelar después de Guardar A informa A guardado y refleja metadatos',async()=>{
 lease.closeAll.mockResolvedValue({closed:false,saved:['A.md']});expect(await controller.close(options)).toBe(false);expect(cancelled).toHaveBeenCalledExactlyOnceWith(['A.md']);expect(send.mock.calls.filter(([channel])=>channel==='freya:event')).toHaveLength(2);expect(finish).not.toHaveBeenCalled();expect(options.documents.records.size).toBe(2)
})
for(const rejected of ['changed','app.closeAborted'] as const)it(`fallar el envío ${rejected} no omite cleanup ni bloquea un reintento`,async()=>{
 lease.closeAll.mockResolvedValue({closed:false,saved:[]});send.mockImplementation((channel,raw)=>{const event=raw as Transport;if(event.id==='app.prepareClose')queueMicrotask(()=>preparation.complete(1,event.nonce!,true));else if(event.type===rejected||event.id===rejected)throw new Error('fallo envío')})
 expect(await controller.close(options)).toBe(false);expect(lease.release).toHaveBeenCalledOnce();expect(ended).toHaveBeenCalledOnce();expect(controller.isClosing).toBe(false);expect(await controller.close(options)).toBe(false);expect(started).toHaveBeenCalledTimes(2)
})
it('el rechazo de release todavía ejecuta ended y permite otro intento',async()=>{
 lease.release.mockImplementationOnce(()=>{throw new Error('fallo cleanup')});await controller.close(options).catch(()=>{});expect(ended).toHaveBeenCalledOnce();expect(controller.isClosing).toBe(false)
})
