import {afterEach,describe,expect,it} from 'vitest'
import {createServer,type Server,type RequestListener} from 'node:http'
import {mkdtemp,readdir,rm} from 'node:fs/promises'
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
