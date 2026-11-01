import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mkdtemp,readFile,rm,access} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import type {Documents} from '../src/main/documents'

const state=vi.hoisted(()=>({count:1,writeStarted:false,release:undefined as (()=>void)|undefined,writeError:false,writes:new Map<string,()=>void>()}))
vi.mock('electron',()=>({app:{},dialog:{},BrowserWindow:class{
 webContents={session:{webRequest:{onBeforeRequest:()=>{}},setPermissionRequestHandler:()=>{}},setWindowOpenHandler:()=>{},executeJavaScript:async(script:string)=>script.includes('Array.from(document.querySelectorAll(\'.mermaid-render svg\')')?[]:true}
 async loadURL(){}destroy(){}
}}))
vi.mock('../src/main/pandoc',async importOriginal=>({
 ...await importOriginal<typeof import('../src/main/pandoc')>(),
 detectPandoc:async()=>({available:true,path:'/synthetic/pandoc',version:'3.10.2',license:'GPL-2.0-or-later'}),
 pandocToDocx:async(_path:string,_source:string,_options:unknown,onMathWarnings?:(count:number)=>void)=>{onMathWarnings?.(state.count);return Buffer.from('PK\x03\x04documento sintético')},
 pandocCitationsToHtml:vi.fn(),
}))
vi.mock('../src/main/files',async importOriginal=>{
 const original=await importOriginal<typeof import('../src/main/files')>()
 return{...original,atomicWrite:async(...args:Parameters<typeof original.atomicWrite>)=>{
  state.writeStarted=true
  await new Promise<void>(resolve=>{state.release=resolve;state.writes.set(args[0],resolve)})
  if(state.writeError)throw new Error('Disco no disponible')
  return original.atomicWrite(...args)
 }}
})
import {exportDocument} from '../src/main/export'
let directory=''
beforeEach(async()=>{directory=await mkdtemp(join(tmpdir(),'freya-docx-warning-'));process.env.FREYALAB_TEST='1';process.env.FREYALAB_TEST_EXPORT_DIR=directory;state.count=1;state.writeStarted=false;state.release=undefined;state.writeError=false;state.writes.clear()})
afterEach(async()=>{delete process.env.FREYALAB_TEST;delete process.env.FREYALAB_TEST_EXPORT_DIR;await rm(directory,{recursive:true,force:true})})
function document(name='informe'){const record={info:{id:'informe',name:name+'.md',kind:'markdown',path:null,readonly:false,revision:0,dirty:true},text:'# Fuente original'};return{record,docs:{get:()=>record,records:new Map([['informe',record]])} as unknown as Documents}}
it.each([0,2])('S2d: éxito con %i avisos se entrega sólo después de escribir, conservando el contrato normal',async count=>{
 state.count=count;const {record,docs}=document(),snapshot=structuredClone(record);let finished=false
 const task=exportDocument(docs,'informe',{format:'docx',revision:0,html:'<article></article>'}).finally(()=>{finished=true})
 await vi.waitFor(()=>expect(state.writeStarted).toBe(true));expect(finished).toBe(false);await expect(access(join(directory,'informe.docx'))).rejects.toThrow()
 state.release!();const result=await task,path=join(directory,'informe.docx')
 expect(result).toEqual(count?{path,mathWarnings:count}:path);expect((await readFile(path)).subarray(0,4)).toEqual(Buffer.from('PK\x03\x04'));expect(record).toEqual(snapshot)
})
it('S2d: un fallo al guardar no devuelve éxito ni un aviso de exportación',async()=>{
 state.writeError=true;const {record,docs}=document(),snapshot=structuredClone(record)
 const task=exportDocument(docs,'informe',{format:'docx',revision:0,html:'<article></article>'}),rejected=expect(task).rejects.toThrow('Disco no disponible')
 await vi.waitFor(()=>expect(state.writeStarted).toBe(true));state.release!();await rejected
 await expect(access(join(directory,'informe.docx'))).rejects.toThrow();expect(record).toEqual(snapshot)
})
it('S2d: dos exportaciones que terminan al revés conservan su propio recuento',async()=>{
 const first=document('primero'),second=document('segundo'),request={format:'docx',revision:0,html:'<article></article>'} as const
 state.count=2;const a=exportDocument(first.docs,'informe',request);await vi.waitFor(()=>expect(state.writes.has(join(directory,'primero.docx'))).toBe(true))
 state.count=0;const b=exportDocument(second.docs,'informe',request);await vi.waitFor(()=>expect(state.writes.has(join(directory,'segundo.docx'))).toBe(true))
 state.writes.get(join(directory,'segundo.docx'))!();expect(await b).toBe(join(directory,'segundo.docx'))
 state.writes.get(join(directory,'primero.docx'))!();expect(await a).toEqual({path:join(directory,'primero.docx'),mathWarnings:2})
})
