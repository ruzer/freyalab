import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import type {FreyaAPI} from '../src/shared/types'
import type {ApplicationCommand,ApplicationUiState} from '../src/shared/application'

// Los mocks prueban el contrato; la activación real de Chromium se comprueba con E2E.
const mocked=vi.hoisted(()=>({invoke:vi.fn(),send:vi.fn(),expose:vi.fn(),on:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),dispatchEvent:vi.fn()}))
vi.mock('electron',()=>({contextBridge:{exposeInMainWorld:mocked.expose},ipcRenderer:{invoke:mocked.invoke,send:mocked.send,on:mocked.on,removeListener:mocked.removeListener},webUtils:{getPathForFile:vi.fn()}}))
const operation='application:contextEdit'
const ids=['edit.cut','edit.copy','edit.paste','edit.pastePlain','edit.selectAll'] as const
const selector='button[role=menuitem][data-application-edit]'
type ContextAPI=FreyaAPI&{contextEdit:(id:string,state:ApplicationUiState)=>Promise<void>}
let api:ContextAPI
const state=():ApplicationUiState=>({activeId:'12345678-1234-4234-8234-123456789abc',mode:'edit',focus:'editor',locked:false,canEdit:true,hasSelection:true,inCodeMirror:true})

class ElementMock{
 isConnected=true
 parentElement:ElementMock|null=null
 dataset:{applicationEdit?:string}={}
 relay?:(event:Event)=>void
 dispatchEvent=vi.fn((event:Event)=>{this.relay?.(event);return !event.defaultPrevented})
 constructor(readonly tagName:string,readonly attributes:Record<string,string>={}){if(Object.hasOwn(attributes,'data-application-edit'))this.dataset.applicationEdit=attributes['data-application-edit']}
 getAttribute(name:string){return name==='data-application-edit'?this.dataset.applicationEdit??null:this.attributes[name]??null}
 hasAttribute(name:string){return Object.hasOwn(this.attributes,name)}
 closest(value:string):ElementMock|null{
  // Solo el selector contractual y sus comillas equivalentes; no es un motor CSS.
  if(value.replace(/["']/g,'')!==selector)return null
  for(let node:ElementMock|null=this;node;node=node.parentElement)if(node.tagName==='BUTTON'&&node.getAttribute('role')==='menuitem'&&node.hasAttribute('data-application-edit'))return node
  return null
 }
}
class ButtonMock extends ElementMock{
 disabled=false
 constructor(id='edit.copy',attributes:Record<string,string>={}){super('BUTTON',{role:'menuitem','data-application-edit':id,...attributes})}
}
const click=(target:ElementMock,isTrusted=true)=>({type:'click',target,isTrusted,preventDefault:vi.fn(),stopPropagation:vi.fn(),stopImmediatePropagation:vi.fn()})
function clickListener(){
 const registration=mocked.addEventListener.mock.calls.find(([name])=>name==='click')
 expect(registration,'El preload debe instalar la concesión sobre clic en fase de captura').toBeDefined()
 const options=registration![2]
 expect(options===true||options?.capture===true).toBe(true)
 return registration![1] as (event:ReturnType<typeof click>)=>void
}
function request(id:string,current=state()){
 expect(api.contextEdit,'El puente debe publicar la operación acotada contextEdit').toBeTypeOf('function')
 const result=api.contextEdit(id,current)
 expect(result,'La operación siempre devuelve Promise<void>, incluso sin concesión').toBeInstanceOf(Promise)
 return result
}
function activate(button:ButtonMock,isTrusted=true,target:ElementMock=button){const event=click(target,isTrusted);clickListener()(event);return event}
const commandListener=()=>mocked.on.mock.calls.find(([name])=>name==='freya:command')![1] as (event:unknown,command:unknown)=>void

beforeEach(async()=>{
 vi.resetModules();vi.clearAllMocks();mocked.invoke.mockReset().mockResolvedValue(undefined)
 vi.stubGlobal('Element',ElementMock);vi.stubGlobal('HTMLElement',ElementMock);vi.stubGlobal('HTMLButtonElement',ButtonMock)
 vi.stubGlobal('window',{addEventListener:mocked.addEventListener,dispatchEvent:mocked.dispatchEvent})
 await import('../src/preload/index')
 api=mocked.expose.mock.calls.find(([name])=>name==='freya')![1] as ContextAPI
})
afterEach(()=>vi.unstubAllGlobals())

describe('SIM-1h · concesión contextual privada y síncrona',()=>{
 it('expone contextEdit sin una API genérica, nonce o concesión pública',()=>{
  expect(api.contextEdit).toBeTypeOf('function')
  for(const key of ['invoke','nativeEdit','clipboard','readClipboard','executeJavaScript','nonce','contextGrant'])expect(api).not.toHaveProperty(key)
 })
 it.each(ids)('una llamada libre a %s no envía IPC',async id=>{
  await expect(request(id)).resolves.toBeUndefined()
  expect(mocked.invoke).not.toHaveBeenCalled();expect(mocked.send).not.toHaveBeenCalled()
 })
 it.each(ids)('un clic real simulado permite una sola tupla cerrada para %s',async id=>{
  const button=new ButtonMock(id),current=state(),restored=vi.fn(),pending:Promise<void>[]=[]
  button.relay=event=>{
   expect(event).toBeInstanceOf(Event);expect(event.type).toBe('freya-context-edit');expect(event.bubbles).toBe(true)
   expect(event).not.toHaveProperty('nonce');expect(event).not.toHaveProperty('detail')
   restored();pending.push(request(id,current))
  }
  const event=activate(button)
  expect(button.dispatchEvent).toHaveBeenCalledOnce()
  expect(restored).toHaveBeenCalledOnce();expect(restored.mock.invocationCallOrder[0]).toBeLessThan(mocked.invoke.mock.invocationCallOrder[0])
  await expect(pending[0]).resolves.toBeUndefined()
  expect(mocked.invoke).toHaveBeenCalledExactlyOnceWith('freya',operation,id,current)
  expect(event.preventDefault).toHaveBeenCalledOnce();expect(event.stopImmediatePropagation).toHaveBeenCalledOnce()
  expect(mocked.send).not.toHaveBeenCalled()
 })
 it('un clic en un descendiente del botón usa el botón marcado',async()=>{
  const button=new ButtonMock(),child=new ElementMock('SPAN'),pending:Promise<void>[]=[];child.parentElement=button
  button.relay=()=>{pending.push(request('edit.copy'))}
  activate(button,true,child)
  await expect(pending[0]).resolves.toBeUndefined();expect(mocked.invoke).toHaveBeenCalledOnce()
 })
 it('un clic sintético no despacha el evento ni abre una concesión',async()=>{
  const button=new ButtonMock();button.relay=()=>{void request('edit.copy')}
  activate(button,false)
  expect(button.dispatchEvent).not.toHaveBeenCalled()
  await expect(request('edit.copy')).resolves.toBeUndefined();expect(mocked.invoke).not.toHaveBeenCalled()
 })
 it('un evento freya-context-edit sintético por sí solo tampoco autoriza IPC',async()=>{
  const button=new ButtonMock(),pending:Promise<void>[]=[];button.relay=()=>{pending.push(request('edit.copy'))}
  button.dispatchEvent(new Event('freya-context-edit',{bubbles:true}))
  await expect(pending[0]).resolves.toBeUndefined();expect(mocked.invoke).not.toHaveBeenCalled()
 })
 it.each(['edit.undo','edit.redo','file.save','constructor','__proto__','executeJavaScript',''])('el marcador %j no abre una concesión',async id=>{
  const button=new ButtonMock(id);button.relay=()=>{void request(id)}
  activate(button)
  expect(button.dispatchEvent).not.toHaveBeenCalled()
  await expect(request(id)).resolves.toBeUndefined();expect(mocked.invoke).not.toHaveBeenCalled()
 })
 it.each([
  ['un div con el marcador',()=>new ElementMock('DIV',{role:'menuitem','data-application-edit':'edit.copy'})],
  ['un botón que no es menuitem',()=>new ButtonMock('edit.copy',{role:'button'})],
  ['un menuitem sin marcador',()=>new ElementMock('BUTTON',{role:'menuitem'})],
 ] as const)('%s no autoriza el puente',async(_description,create)=>{
  const target=create();clickListener()(click(target))
  expect(target.dispatchEvent).not.toHaveBeenCalled()
  await expect(request('edit.copy')).resolves.toBeUndefined();expect(mocked.invoke).not.toHaveBeenCalled()
 })
 it('caduca al salir del callback aunque la operación se guarde para más tarde',async()=>{
  const button=new ButtonMock();let later:()=>Promise<void>=async()=>{throw new Error('Falta el evento contextual')}
  button.relay=()=>{later=()=>request('edit.copy')}
  activate(button)
  await expect(later()).resolves.toBeUndefined();expect(mocked.invoke).not.toHaveBeenCalled()
 })
 it('una microtarea no prolonga la concesión síncrona',async()=>{
  const button=new ButtonMock();let deferred:Promise<void>|undefined
  button.relay=()=>{queueMicrotask(()=>{deferred=request('edit.copy')})}
  activate(button);await Promise.resolve()
  expect(deferred).toBeDefined();await expect(deferred).resolves.toBeUndefined();expect(mocked.invoke).not.toHaveBeenCalled()
 })
 it('un ID distinto del fijado por el botón no puede aprovechar el clic',async()=>{
  const button=new ButtonMock('edit.copy'),pending:Promise<void>[]=[]
  button.relay=()=>{pending.push(request('edit.cut'))}
  activate(button);await expect(pending[0]).resolves.toBeUndefined()
  await expect(request('edit.copy')).resolves.toBeUndefined();expect(mocked.invoke).not.toHaveBeenCalled()
 })
 it('cambiar el dataset durante el callback no cambia el ID ya fijado',async()=>{
  const button=new ButtonMock('edit.copy'),pending:Promise<void>[]=[]
  button.relay=()=>{button.dataset.applicationEdit='edit.cut';pending.push(request('edit.cut'))}
  activate(button);await expect(pending[0]).resolves.toBeUndefined();expect(mocked.invoke).not.toHaveBeenCalled()
 })
 it('el segundo uso dentro del mismo callback no vuelve a invocar',async()=>{
  const button=new ButtonMock(),current=state(),pending:Promise<void>[]=[]
  button.relay=()=>{pending.push(request('edit.copy',current),request('edit.copy',current))}
  activate(button);await Promise.all(pending)
  expect(mocked.invoke).toHaveBeenCalledExactlyOnceWith('freya',operation,'edit.copy',current)
  await expect(request('edit.copy',current)).resolves.toBeUndefined();expect(mocked.invoke).toHaveBeenCalledOnce()
 })
 it('consume antes de invocar aunque la llamada reentre y falle',async()=>{
  const button=new ButtonMock(),current=state(),pending:Promise<void>[]=[];let reentered:Promise<void>|undefined
  mocked.invoke.mockImplementationOnce(()=>{reentered=request('edit.copy',current);throw new Error('Fallo IPC controlado')})
  button.relay=()=>{pending.push(request('edit.copy',current))}
  activate(button)
  await expect(pending[0]).rejects.toThrow('Fallo IPC controlado');await expect(reentered).resolves.toBeUndefined()
  expect(mocked.invoke).toHaveBeenCalledExactlyOnceWith('freya',operation,'edit.copy',current)
  await expect(request('edit.copy',current)).resolves.toBeUndefined();expect(mocked.invoke).toHaveBeenCalledOnce()
 })
 it('una promesa IPC pendiente no mantiene abierta la concesión',async()=>{
  const button=new ButtonMock(),pending:Promise<void>[]=[];let finish!:()=>void
  mocked.invoke.mockReturnValueOnce(new Promise<void>(resolve=>{finish=resolve}))
  button.relay=()=>{pending.push(request('edit.copy'))}
  activate(button)
  try{await expect(request('edit.copy')).resolves.toBeUndefined();expect(mocked.invoke).toHaveBeenCalledOnce()}
  finally{finish();await Promise.all(pending)}
 })
 it('finally revoca la concesión si el dispatch DOM falla',async()=>{
  const button=new ButtonMock(),failure=new Error('Dispatch DOM controlado')
  button.dispatchEvent.mockImplementationOnce(()=>{throw failure})
  try{activate(button)}catch(error){expect(error).toBe(failure)}
  await expect(request('edit.copy')).resolves.toBeUndefined();expect(mocked.invoke).not.toHaveBeenCalled()
 })
 it('la solicitud contextual continúa por onCommand y su delegado nativo de un solo uso',async()=>{
  const button=new ButtonMock(),current=state(),pending:Promise<void>[]=[],nonce='12345678-1234-4234-8234-123456789abc'
  let later=()=>{}
  api.onCommand((command:ApplicationCommand,delegate:()=>void)=>{
   expect(command).toEqual({id:'edit.copy'});expect(command).not.toHaveProperty('nonce')
   command.id='edit.cut';delegate();delegate();later=delegate
  })
  mocked.invoke.mockImplementationOnce(()=>{commandListener()({}, {id:'edit.copy',nonce});return Promise.resolve(undefined)})
  button.relay=()=>{pending.push(request('edit.copy',current))}
  activate(button);await Promise.all(pending);later()
  expect(mocked.invoke).toHaveBeenCalledExactlyOnceWith('freya',operation,'edit.copy',current)
  expect(mocked.send.mock.calls).toEqual([['freya:menu-native',nonce],['freya:menu-native-done',nonce]])
 })
})
