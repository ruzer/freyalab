import {afterEach,beforeEach,expect,it,vi,type Mock} from 'vitest'
import {setLanguage,t} from '../src/shared/i18n'
import {ApplicationClosing,type ClosingSnapshot,type ClosingNotice} from '../src/renderer/lib/application-closing'
const document={id:'12345678-1234-4234-8234-123456789abc',name:'datos.csv',kind:'csv' as const,csvView:'text' as const,text:'A\n00123\n',readonly:false}
let snapshot:ClosingSnapshot,locked:Mock<(value:boolean)=>void>,notice:Mock<(value:ClosingNotice|null)=>void>,prepare:Mock<(id:string)=>Promise<void>>,flow:ApplicationClosing
beforeEach(()=>{setLanguage('es');snapshot={documents:[{...document}],activeId:document.id,busy:false,modal:false,composing:false};locked=vi.fn();notice=vi.fn();prepare=vi.fn(async()=>{});flow=new ApplicationClosing({snapshot:()=>snapshot,prepare:id=>prepare(id),locked,notice})})
afterEach(()=>{flow?.abort();vi.restoreAllMocks();vi.useRealTimers();setLanguage('es')})
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return{promise,resolve}}
for(const flag of ['busy','modal','composing'] as const)it(`rechaza ${flag} con aviso antes del ACK y sin alterar el documento`,async()=>{
 snapshot[flag]=true;expect(await flow.prepare()).toBe(false);expect(prepare).not.toHaveBeenCalled();expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({kind:'error',message:expect.stringContaining('Tus documentos siguen abiertos')}));expect(snapshot.documents[0].text).toBe(document.text)
})
for(const locale of ['es','en'] as const)it(`el rechazo de texto conserva nombre y límite10MiB en ${locale}`,async()=>{
 snapshot.documents[0].kind='markdown';snapshot.documents[0].csvView=undefined
 setLanguage(locale);vi.spyOn(TextEncoder.prototype,'encode').mockReturnValue({byteLength:10*1024*1024+1} as ReturnType<TextEncoder['encode']>)
 expect(await flow.prepare()).toBe(false);expect(prepare).not.toHaveBeenCalled();const message=notice.mock.calls.at(-1)![0]!.message as string;expect(message).toContain('datos.csv');expect(message).toContain('10 MiB');expect(message).toContain(locale==='es'?'Recórtalo':'Shorten');expect(snapshot.documents[0].text).toBe(document.text)
})
it('acepta el límite exacto y no convierte valores ni contenido',async()=>{
 snapshot.documents[0].kind='markdown';snapshot.documents[0].csvView=undefined
 vi.spyOn(TextEncoder.prototype,'encode').mockReturnValue({byteLength:10*1024*1024} as ReturnType<TextEncoder['encode']>);expect(await flow.prepare()).toBe(true);expect(prepare).toHaveBeenCalledExactlyOnceWith(document.id);expect(snapshot.documents[0].text).toBe('A\n00123\n');expect(locked).toHaveBeenLastCalledWith(true)
})
it('el error de una actualización se explica sin exponer detalle técnico ni guardar anterior',async()=>{
 prepare.mockRejectedValue(new Error('RAW_ERROR_PRIVATE'));expect(await flow.prepare()).toBe(false);expect(locked).toHaveBeenLastCalledWith(false);const message=notice.mock.calls.at(-1)![0]!.message as string;expect(message).toContain('datos.csv');expect(message).not.toContain('RAW_ERROR_PRIVATE');expect(snapshot.documents[0].text).toBe(document.text)
})
for(const locale of ['en','en-XA'] as const)it(`S4: el código del límite conserva el aviso específico con mensaje no español en ${locale}`,async()=>{
 setLanguage(locale);prepare.mockRejectedValue(new Error('[freya:TEXT_EDIT_LIMIT] Encoded buffer rejected; keep the local draft.'))
 expect(await flow.prepare()).toBe(false);expect(prepare).toHaveBeenCalledExactlyOnceWith(document.id);expect(locked).toHaveBeenLastCalledWith(false)
 expect(notice).toHaveBeenLastCalledWith({kind:'error',message:t('menu.close.textTooLarge',{name:document.name})});expect(snapshot.documents[0].text).toBe(document.text)
})
for(const locale of ['en','en-XA'] as const)it(`S4: una frase española sin código no clasifica el rechazo en ${locale}`,async()=>{
 setLanguage(locale);prepare.mockRejectedValue(new Error('El documento supera el límite de edición de 10 MiB.'))
 expect(await flow.prepare()).toBe(false);expect(prepare).toHaveBeenCalledExactlyOnceWith(document.id);expect(locked).toHaveBeenLastCalledWith(false)
 expect(notice).toHaveBeenLastCalledWith({kind:'error',message:t('menu.close.updateFailed',{name:document.name})});expect(snapshot.documents[0].text).toBe(document.text)
})
it('anuncia progreso al cumplir1s, una sola vez, con reloj controlado',async()=>{
 vi.useFakeTimers();const wait=deferred();prepare.mockReturnValue(wait.promise);const result=flow.prepare();await vi.advanceTimersByTimeAsync(999);expect(notice.mock.calls.filter(([value])=>value?.kind==='progress')).toHaveLength(0)
 await vi.advanceTimersByTimeAsync(1);expect(notice).toHaveBeenLastCalledWith({kind:'progress',message:'Preparando el cierre…'});await vi.advanceTimersByTimeAsync(1000);expect(notice.mock.calls.filter(([value])=>value?.kind==='progress')).toHaveLength(1);wait.resolve();expect(await result).toBe(true)
})
it('una preparación rápida no muestra una franja fugaz',async()=>{
 vi.useFakeTimers();expect(await flow.prepare()).toBe(true);flow.abort();await vi.advanceTimersByTimeAsync(1000);expect(notice.mock.calls.filter(([value])=>value?.kind==='progress')).toHaveLength(0)
})
it('abortar impide que una respuesta vieja desbloquee o anuncie sobre una nueva',async()=>{
 const first=deferred(),second=deferred();prepare.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);const stale=flow.prepare();flow.abort();const current=flow.prepare();first.resolve();expect(await stale).toBe(false);expect(locked).toHaveBeenLastCalledWith(true);second.resolve();expect(await current).toBe(true);expect(locked).toHaveBeenLastCalledWith(true)
})
for(const change of ['active','list'] as const)it(`un cambio de ${change} aborta sin quitar documentos`,async()=>{
 const wait=deferred();prepare.mockReturnValue(wait.promise);const result=flow.prepare();if(change==='active')snapshot.activeId='otro';else snapshot.documents.push({...document,id:'22345678-1234-4234-8234-123456789abc'});wait.resolve();expect(await result).toBe(false);expect(locked).toHaveBeenLastCalledWith(false);expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({kind:'error',message:expect.stringContaining('cambió')}));expect(snapshot.documents.length).toBe(change==='list'?2:1)
})
it('la muestra de solo lectura no se presenta como texto editable rechazado',async()=>{
 snapshot.documents[0].readonly=true;vi.spyOn(TextEncoder.prototype,'encode').mockReturnValue({byteLength:10*1024*1024+1} as ReturnType<TextEncoder['encode']>);expect(await flow.prepare()).toBe(true)
})
