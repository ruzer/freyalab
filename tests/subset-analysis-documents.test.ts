import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {mkdtemp,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {RecipeAnalysisContext,RecipeOperationResult} from '../src/shared/recipe-operation'
const state=vi.hoisted(()=>({folder:'',calls:[] as string[],dialogs:0}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{showSaveDialog:async()=>{state.dialogs++;return{canceled:true}}},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:()=>{throw new Error('A subset must not create a file watcher')}}))
vi.mock('../src/main/table-client',async()=>{const{TableEngine}=await import('../src/main/table-engine');return{TableClient:class{engine=new TableEngine();async call(method:string,...args:unknown[]){state.calls.push(method);return(this.engine as unknown as Record<string,(...args:unknown[])=>unknown>)[method](...args)}stop(){}}}})
import {Documents} from '../src/main/documents'
const coverage={headers:['ID'],columns:[{position:1,name:'ID'}],scanned:7,eligible:3,resultCount:3,complete:true,cancelled:false,bytesRead:200,sha256:'a'.repeat(64),sampling:[]}
const context:RecipeAnalysisContext={projectId:'project',recipeId:'recipe',sourceId:'source',name:'Adultos',sourceName:'censo.csv',steps:[],stepOwners:[],coverage}
const result:RecipeOperationResult={...coverage,rows:[['00123'],['00126'],['00128']]}
let docs:Documents
beforeEach(async()=>{state.folder=await mkdtemp(join(tmpdir(),'freya-subset-docs-'));state.calls=[];state.dialogs=0;docs=new Documents(()=>{})})
afterEach(async()=>{await docs.shutdown();await rm(state.folder,{recursive:true,force:true})})
async function install(){await docs.table.call('installSubset','subset',result);return docs.installSubset('subset',structuredClone(context))}
describe('PRJ-02b · registro efímero sin permisos de archivo',()=>{
 it('solo publica metadata de un snapshot ya preparado, sin abrir archivo ni crear recuperación',async()=>{
  const original=structuredClone(context),info=await install()
  expect(info).toMatchObject({id:'subset',path:null,name:'Adultos',kind:'csv',readonly:true,dirty:false,rowCount:3,analysisSubset:original})
  expect(docs.requireTable('subset').info.headers).toEqual(['ID']);expect(docs.records.size).toBe(1)
  expect(state.calls).toEqual(['installSubset','info']);await docs.checkpoint('subset');expect(await readdir(state.folder)).toEqual([])
 })
 it.each(['save','saveAs','update','edit','options','undo'] as const)('rechaza %s antes de diálogo, cambios o escritura',async method=>{
  await install();const before=structuredClone(docs.info('subset'))
  const action=method==='save'?()=>docs.save('subset'):method==='saveAs'?()=>docs.save('subset',true):method==='update'?()=>docs.update('subset','cambio'):method==='edit'?()=>docs.tableEdit('subset',{type:'cell',rowId:'1',column:0,value:'cambio'}):method==='options'?()=>docs.tableOptions('subset',{header:false}):()=>docs.undo('subset')
  await expect(action()).rejects.toThrow();expect(docs.info('subset')).toEqual(before);expect(state.dialogs).toBe(0);expect(await readdir(state.folder)).toEqual([])
 })
 it('el id analítico no concede acceso relativo a imágenes o bibliografía',async()=>{
  await install();await expect(docs.image('subset','imagen.png')).resolves.toBeNull()
  await expect(docs.bibliography('subset','referencias.bib')).rejects.toThrow()
 })
 it('cerrar libera el motor y el registro sin modificar fuentes ni pedir guardar',async()=>{
  await install();expect(await docs.close('subset')).toBe(true)
  expect(docs.records.size).toBe(0);expect(state.calls).toContain('close');expect(state.dialogs).toBe(0)
  await expect(docs.table.call('info','subset')).rejects.toThrow()
 })
 it('no reemplaza un id ya publicado ni publica un motor inexistente',async()=>{
  await expect(docs.installSubset('missing',context)).rejects.toThrow()
  await install();await expect(docs.installSubset('subset',{...context,name:'Reemplazo'})).rejects.toThrow()
  expect(docs.info('subset').name).toBe('Adultos')
 })
})
