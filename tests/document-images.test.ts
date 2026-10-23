import {it,expect,vi} from 'vitest'
import {mkdtemp,writeFile,rm,realpath,chmod} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const state=vi.hoisted(()=>({folder:''}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:()=>{const watcher={on:()=>watcher,close:async()=>{}};return watcher}}))
vi.mock('../src/main/table-client',()=>({TableClient:class {async call(){return undefined}stop(){}}}))
import {Documents} from '../src/main/documents'
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64')

it('una imagen local ausente, ilegible o mal codificada devuelve null sin lanzar ni exponer rutas',async()=>{
 state.folder=await realpath(await mkdtemp(join(tmpdir(),'freya-images-')))
 const docs=new Documents(()=>{}),file=join(state.folder,'doc.md');await writeFile(file,'![x](falta.png)');const doc=await docs.open(file)
 try{
  await writeFile(join(state.folder,'ok.png'),PNG)
  expect(await docs.image(doc.id,'ok.png')).toMatch(/^data:image\/png;base64,/)
  expect(await docs.image(doc.id,'falta.png')).toBeNull()
  expect(await docs.image(doc.id,'sub/falta.png')).toBeNull()
  expect(await docs.image(doc.id,'100%.png')).toBeNull()
  expect(await docs.image(doc.id,'../fuera.png')).toBeNull()
  expect(await docs.image(doc.id,'https://example.com/a.png')).toBeNull()
  if(process.platform!=='win32'&&process.getuid?.()!==0){const private_=join(state.folder,'privada.png');await writeFile(private_,PNG);await chmod(private_,0);try{expect(await docs.image(doc.id,'privada.png')).toBeNull()}finally{await chmod(private_,0o600)}}
 }finally{await docs.close(doc.id);await docs.shutdown();await rm(state.folder,{recursive:true,force:true})}
})
