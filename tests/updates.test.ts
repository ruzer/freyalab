import {afterEach,describe,expect,it} from 'vitest'
import {createServer,type Server,type RequestListener,type ServerResponse} from 'node:http'
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {compareVersions,selectRelease,releaseUrl,updatesEndpoint,checkUpdates,UpdatesService} from '../src/main/updates'
import {SettingsStore} from '../src/main/settings'

const current='0.1.0-alpha.1',release=(version:string,extra={})=>({tag_name:'v'+version,name:'FreyaLab '+version,draft:false,prerelease:version.includes('-'),published_at:'2026-10-28T12:00:00Z',html_url:'https://github.com/ruzer/freyalab/releases/tag/v'+version,assets:[{name:'FreyaLab-mac-arm64.dmg'}],...extra})
let server:Server|undefined,folder:string|undefined
afterEach(async()=>{server?.closeAllConnections();if(server?.listening)await new Promise<void>(resolve=>server!.close(()=>resolve()));server=undefined;if(folder)await rm(folder,{recursive:true,force:true});folder=undefined})
async function local(handler:RequestListener){
 server=createServer(handler);await new Promise<void>((resolve,reject)=>{server!.once('error',reject);server!.listen(0,'127.0.0.1',resolve)})
 return{FREYALAB_TEST:'1',FREYALAB_TEST_UPDATES_URL:`http://127.0.0.1:${(server.address() as {port:number}).port}/releases`}
}
describe('APP-04 · versiones y frontera de confianza',()=>{
 it('U5 · compara componentes numéricos y prereleases sin orden textual',()=>{
  const ordered=['0.1.0-alpha.1','0.1.0-alpha.2','0.1.0-alpha.10','0.1.0-beta.1','0.1.0','0.1.1','0.2.0','1.0.0']
  for(let i=1;i<ordered.length;i++)expect(compareVersions(ordered[i],ordered[i-1])).toBeGreaterThan(0)
  expect(compareVersions('0.1.0','0.1.0')).toBe(0)
  expect(compareVersions('1.0.0-alpha-z','1.0.0-alpha-a')).toBeGreaterThan(0)
  expect(compareVersions('9007199254740993.0.0','9007199254740992.0.0')).toBeGreaterThan(0)
 })
 it('U5/U6 · ignora borradores y etiquetas inesperadas; elige el máximo por canal',()=>{
  const releases=[release('0.1.0-alpha.2'),release('9.0.0',{draft:true}),release('0.1.0-alpha.10'),release('0.1.0'),release('0.2.0-alpha.1'),release('nonsense')]
  expect(selectRelease(releases,current)?.version).toBe('0.2.0-alpha.1')
  expect(selectRelease(releases,'0.0.9')?.version).toBe('0.1.0')
  expect(selectRelease(releases,'1.0.0')).toBeNull()
 })
 it.each(['http://github.com/ruzer/freyalab/releases/tag/v1','https://evil.invalid/ruzer/freyalab/releases/tag/v1','https://github.com.evil.invalid/ruzer/freyalab/releases/v1','https://user:pass@github.com/ruzer/freyalab/releases/tag/v1','https://github.com:444/ruzer/freyalab/releases/tag/v1','https://github.com/ruzer/other/releases/tag/v1','https://github.com/ruzer/freyalab/releases/../issues','https://github.com/ruzer/freyalab/releases/'])('U7 · rechaza URL ajena o ambigua %s',url=>expect(releaseUrl(url)).toBe(false))
 it('U3 · el producto ignora el endpoint de pruebas y las pruebas no pueden elegir un host externo',()=>{
  expect(updatesEndpoint({FREYALAB_TEST_UPDATES_URL:'http://127.0.0.1:1'})).toBe('https://api.github.com/repos/ruzer/freyalab/releases?per_page=10')
  expect(updatesEndpoint({FREYALAB_TEST:'1',FREYALAB_TEST_UPDATES_URL:'https://evil.invalid'})).toBe('https://api.github.com/repos/ruzer/freyalab/releases?per_page=10')
 })
 it('U3 · una sola GET sin datos personales, cuerpo, cookies ni credenciales',async()=>{
  let count=0,body='';const env=await local((request,response)=>{count++;request.on('data',chunk=>body+=chunk);expect(request.method).toBe('GET');expect(request.headers.accept).toBe('application/vnd.github+json');expect(request.headers['user-agent']).toBe('FreyaLab/'+current);expect(request.headers.cookie).toBeUndefined();expect(request.headers.authorization).toBeUndefined();response.end(JSON.stringify([release('0.1.0-alpha.2')]))})
  expect(await checkUpdates(current,new AbortController().signal,env)).toMatchObject({status:'available',release:{version:'0.1.0-alpha.2'}});expect(count).toBe(1);expect(body).toBe('')
 })
 it.each([403,429,500,302])('U4/U9 · HTTP %i falla sin seguir redirecciones',async status=>{
  let count=0;const env=await local((_request,response)=>{count++;response.writeHead(status,{Location:'http://127.0.0.1:1/private'});response.end('unavailable')})
  expect(await checkUpdates(current,new AbortController().signal,env)).toMatchObject({status:'error'});expect(count).toBe(1)
 })
 it.each(['{broken','{}',JSON.stringify([{tag_name:'v1.0.0'}]),JSON.stringify([release('1.0.0',{html_url:'https://evil.invalid'})])])('U4 · rechaza JSON, esquema o URL inválidos',async data=>{
  const env=await local((_request,response)=>response.end(data));expect(await checkUpdates(current,new AbortController().signal,env)).toMatchObject({status:'error'})
 })
 it('U4 · limita los bytes efectivos aunque Content-Length no exista',async()=>{
  const env=await local((_request,response)=>{response.write('[');response.end(' '.repeat(1024*1024))})
  expect(await checkUpdates(current,new AbortController().signal,env)).toMatchObject({status:'error',code:'size'})
 })
 it('U4 · rechaza Content-Length mayor de 1 MiB sin esperar el cuerpo',async()=>{
  const env=await local((_request,response)=>{response.writeHead(200,{'Content-Length':1024*1024+1});response.flushHeaders()})
  expect(await checkUpdates(current,new AbortController().signal,env)).toMatchObject({status:'error',code:'size'})
 })
 it('U1/U15 · cancelar aborta una respuesta pendiente',async()=>{
  let entered!:()=>void;const requested=new Promise<void>(resolve=>entered=resolve),env=await local(()=>entered()),controller=new AbortController(),result=checkUpdates(current,controller.signal,env)
  await requested;controller.abort();expect(await result).toMatchObject({status:'cancelled'})
 })
 it('U4/U9 · el máximo de 10 segundos también cubre una respuesta que no termina',async()=>{
  const env=await local((_request,response)=>response.write('[')),started=Date.now()
  expect(await checkUpdates(current,new AbortController().signal,env)).toMatchObject({status:'error',code:'timeout'});expect(Date.now()-started).toBeLessThan(11000)
 },12000)
 it('U2/U8/U10 · cero peticiones por omisión, 24 h y persistencia sólo en settings.json',async()=>{
  let count=0;const env=await local((_request,response)=>{count++;response.end(JSON.stringify([release('0.1.0-alpha.2')]))})
  folder=await mkdtemp(join(tmpdir(),'freya-updates-'));const store=new SettingsStore(join(folder,'settings.json'));await store.migrate({})
  const now=()=>Date.parse('2026-10-29T12:00:00Z'),service=new UpdatesService(store,current,env,now)
  expect(await service.startup()).toBeNull();expect(count).toBe(0)
  await store.set({actualizaciones:{buscarAlIniciar:true}})
  expect(await service.startup()).toMatchObject({status:'available'});expect(count).toBe(1)
  expect(await new UpdatesService(store,current,env,now).startup()).toBeNull();expect(count).toBe(1)
  await service.skip('0.1.0-alpha.2');expect((await store.get()).values.actualizaciones.versionesOmitidas).toEqual(['0.1.0-alpha.2'])
  const tomorrow=new UpdatesService(store,current,env,()=>now()+86400000)
  expect(await tomorrow.startup()).toBeNull();expect(count).toBe(2)
  await tomorrow.remind();expect(await new UpdatesService(store,current,env,()=>now()+86400001).startup()).toBeNull()
  expect(await readdir(folder)).toEqual(['settings.json'])
 })
 it('U10 · reloj atrasado y ajustes de versión futura no disparan la red',async()=>{
  let count=0;const env=await local((_request,response)=>{count++;response.end('[]')})
  const values=(await import('../src/shared/settings')).defaultSettings();values.actualizaciones={buscarAlIniciar:true,ultimaComprobacion:'2099-01-01T00:00:00.000Z',versionesOmitidas:[]}
  const settings={get:async()=>({values,readonly:false,migrationPending:false}),set:async()=>{throw new Error('unexpected write')}}
  expect(await new UpdatesService(settings,current,env).startup()).toBeNull();expect(count).toBe(0)
  settings.get=async()=>({values,readonly:true,migrationPending:false})
  expect(await new UpdatesService(settings,current,env).startup()).toBeNull();expect(count).toBe(0)
 })
 it('U1/U15 · cancelar durante la persistencia no cancela una nueva búsqueda inmediata',async()=>{
  let count=0,releaseWrite!:()=>void;const env=await local((_request,response)=>{count++;response.end(JSON.stringify([release('0.1.0-alpha.2')]))})
  const values=(await import('../src/shared/settings')).defaultSettings(),state={values,readonly:false,migrationPending:false},gate=new Promise<void>(resolve=>releaseWrite=resolve)
  let writes=0
  const service=new UpdatesService({get:async()=>state,set:async()=>{if(++writes===1)await gate;return state}},current,env)
  const cancelled=service.check();service.cancel();const next=service.check();releaseWrite()
  expect(await cancelled).toEqual({status:'cancelled'});expect(await next).toMatchObject({status:'available'});expect(count).toBe(1)
 })
})

describe('SEG-S5b · consulta manual con ajustes futuros intactos',()=>{
 for(const cancel of [false,true])it(`P2 · cambio a futuro antes de guardar la fecha manual, cancelar=${cancel}`,async()=>{
  let count=0;const env=await local((_request,response)=>{count++;response.end(JSON.stringify([release('0.1.0-alpha.2')]))})
  folder=await mkdtemp(join(tmpdir(),'freya-updates-manual-race-'));const path=join(folder,'settings.json'),values=(await import('../src/shared/settings')).defaultSettings();await writeFile(path,JSON.stringify(values))
  const future=JSON.stringify({version:2,privateFutureValue:'CONSERVAR_TRAS_CAMBIO_MANUAL'})+'\n',store=new SettingsStore(path);let reads=0,service:UpdatesService
  const settings={get:async()=>{const state=await store.get();if(++reads===1)await writeFile(path,future);else if(cancel)service.cancel();return state},set:(patch:unknown)=>store.set(patch)}
  service=new UpdatesService(settings,current,env);const result=await service.check()
  expect(await readFile(path,'utf8')).toBe(future);expect(await readdir(folder)).toEqual(['settings.json']);expect((await store.get()).readonly).toBe(true)
  if(cancel){expect(result).toEqual({status:'cancelled'});expect(count).toBe(0)}else{expect(count).toBe(1);expect(result).toMatchObject({status:'available',settingsWarning:'lastCheckNotSaved'})}
 })
 for(const response of ['available','current'] as const)it(`${response}: consulta manual, aviso de fecha no guardada y cero red al iniciar`,async()=>{
  let count=0;const env=await local((_request,res)=>{count++;res.end(JSON.stringify(response==='available'?[release('0.1.0-alpha.2')]:[]))})
  folder=await mkdtemp(join(tmpdir(),'freya-updates-future-'));const path=join(folder,'settings.json'),original=JSON.stringify({version:2,privateFutureValue:'CONSERVAR_SIN_MIGRAR'},null,2)+'\n';await writeFile(path,original)
  const store=new SettingsStore(path),service=new UpdatesService(store,current,env)
  expect((await store.get()).readonly).toBe(true);expect(await service.startup()).toBeNull();expect(count).toBe(0)
  const result=await service.check()
  expect(await readFile(path,'utf8')).toBe(original);expect(await readdir(folder)).toEqual(['settings.json']);expect((await store.get()).readonly).toBe(true)
  expect(count).toBe(1);expect(result).toMatchObject({status:response,currentVersion:current,settingsWarning:'lastCheckNotSaved'})
  if(response==='available')expect(result).toMatchObject({release:{version:'0.1.0-alpha.2'}})
 })
 it('si el archivo pasa de válido a futuro entre startup y check, no hace red automática',async()=>{
  let count=0;const env=await local((_request,response)=>{count++;response.end(JSON.stringify([release('0.1.0-alpha.2')]))})
  folder=await mkdtemp(join(tmpdir(),'freya-updates-future-race-'));const path=join(folder,'settings.json'),values=(await import('../src/shared/settings')).defaultSettings();values.actualizaciones.buscarAlIniciar=true
  await writeFile(path,JSON.stringify(values));const original=JSON.stringify({version:2,privateFutureValue:'CONSERVAR_DURANTE_LA_CARRERA'})+'\n',store=new SettingsStore(path);let reads=0
  const settings={get:async()=>{const state=await store.get();if(++reads===1)await writeFile(path,original);return state},set:(patch:unknown)=>store.set(patch)},service=new UpdatesService(settings,current,env)
  expect(await service.startup()).toBeNull();expect(count).toBe(0);expect(await readFile(path,'utf8')).toBe(original);expect(await readdir(folder)).toEqual(['settings.json']);expect((await store.get()).readonly).toBe(true)
 })
 it('startup no hereda la consulta manual pendiente cuando los ajustes pasaron a una versión futura',async()=>{
  let count=0,held:ServerResponse|undefined,enteredRequest!:()=>void;const requested=new Promise<void>(resolve=>enteredRequest=resolve),env=await local((_request,response)=>{count++;held=response;enteredRequest()})
  folder=await mkdtemp(join(tmpdir(),'freya-updates-future-pending-'));const path=join(folder,'settings.json'),values=(await import('../src/shared/settings')).defaultSettings();values.actualizaciones.buscarAlIniciar=true
  await writeFile(path,JSON.stringify(values));const original=JSON.stringify({version:2,privateFutureValue:'NO_AUTORIZA_RED_AUTOMATICA'})+'\n',store=new SettingsStore(path)
  let releaseStartup!:()=>void,enteredStartup!:()=>void,firstRead=true;const gate=new Promise<void>(resolve=>releaseStartup=resolve),startupRead=new Promise<void>(resolve=>enteredStartup=resolve)
  const settings={get:async()=>{const state=await store.get();if(firstRead){firstRead=false;enteredStartup();await gate}return state},set:(patch:unknown)=>store.set(patch)},service=new UpdatesService(settings,current,env)
  let enteredAutomatic!:()=>void,checks=0;const automaticCalled=new Promise<void>(resolve=>enteredAutomatic=resolve),check=service.check.bind(service)
  service.check=(...args)=>{if(++checks===2)enteredAutomatic();return check(...args)}
  const automatic=service.startup();await startupRead;await writeFile(path,original);const manual=service.check()
  try{
   // Main anterior termina sin GET; el arreglo retiene la respuesta genuina.
   // Ambos recorridos llegan a la misma barrera sin esperar plazos de pared.
   await Promise.race([requested,manual.then(()=>{})]);releaseStartup();await automaticCalled
   held?.end(JSON.stringify([release('0.1.0-alpha.2')]))
   const[automaticResult,manualResult]=await Promise.all([automatic,manual])
   expect(await readFile(path,'utf8')).toBe(original);expect(await readdir(folder)).toEqual(['settings.json']);expect(automaticResult).toBeNull();expect(count).toBe(1)
   expect(manualResult).toMatchObject({status:'available',settingsWarning:'lastCheckNotSaved'})
  }finally{releaseStartup();held?.end();await Promise.allSettled([automatic,manual])}
 })
 it('cancelar mientras se leen ajustes futuros no envía la petición ni devuelve un aviso tardío',async()=>{
  let count=0;const env=await local((_request,response)=>{count++;response.end('[]')})
  folder=await mkdtemp(join(tmpdir(),'freya-updates-future-cancel-'));const path=join(folder,'settings.json'),original=JSON.stringify({version:2,privateFutureValue:'CONSERVAR_AL_CANCELAR'})+'\n';await writeFile(path,original)
  const store=new SettingsStore(path);let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),settings={get:async()=>{await gate;return store.get()},set:(patch:unknown)=>store.set(patch)},service=new UpdatesService(settings,current,env)
  const result=service.check();service.cancel();release()
  expect(await result).toEqual({status:'cancelled'});expect(count).toBe(0);expect(await readFile(path,'utf8')).toBe(original);expect(await readdir(folder)).toEqual(['settings.json'])
 })
 it('un error HTTP real conserva su causa y la advertencia de ajustes, sin detalles privados',async()=>{
  let count=0;const env=await local((_request,response)=>{count++;response.writeHead(429);response.end('PRIVATE_REMOTE_BODY')})
  folder=await mkdtemp(join(tmpdir(),'freya-updates-future-http-'));const path=join(folder,'settings.json'),original=JSON.stringify({version:2,privateFutureValue:'NO_FILTRAR_RUTAS'})+'\n';await writeFile(path,original)
  const service=new UpdatesService(new SettingsStore(path),current,env)
  expect(await service.check()).toEqual({status:'error',code:'rateLimit',settingsWarning:'lastCheckNotSaved'});expect(count).toBe(1);expect(await readFile(path,'utf8')).toBe(original);expect(await readdir(folder)).toEqual(['settings.json'])
 })
 it('dos consultas manuales readonly comparten una sola petición y el aviso de ese resultado',async()=>{
  let count=0;const env=await local((_request,response)=>{count++;response.end(JSON.stringify([release('0.1.0-alpha.2')]))})
  folder=await mkdtemp(join(tmpdir(),'freya-updates-future-shared-'));const path=join(folder,'settings.json'),original=JSON.stringify({version:2,privateFutureValue:'NO_CREAR_OTRO_ESTADO'})+'\n';await writeFile(path,original)
  const service=new UpdatesService(new SettingsStore(path),current,env),[first,second]=await Promise.all([service.check(),service.check()])
  expect(first).toBe(second);expect(first).toMatchObject({status:'available',settingsWarning:'lastCheckNotSaved'});expect(count).toBe(1);expect(await readFile(path,'utf8')).toBe(original);expect(await readdir(folder)).toEqual(['settings.json'])
 })
 it('un fallo de escritura en ajustes editables conserva su error y no abre la red',async()=>{
  let count=0;const env=await local((_request,response)=>{count++;response.end('[]')}),values=(await import('../src/shared/settings')).defaultSettings(),settings={get:async()=>({values,readonly:false,migrationPending:false}),set:async()=>{throw new Error('EIO_PRIVATE_MUST_NOT_LEAK')}}
  expect(await new UpdatesService(settings,current,env).check()).toEqual({status:'error',code:'service'});expect(count).toBe(0)
 })
})
