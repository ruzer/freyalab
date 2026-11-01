import './pandoc-assets'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import type {Documents} from '../src/main/documents'
import {getLanguage,setLanguage} from '../src/shared/i18n'

const state=vi.hoisted(()=>({detect:vi.fn(),convert:vi.fn(),bibliography:vi.fn()}))
vi.mock('electron',()=>({app:{},dialog:{},BrowserWindow:class{
 webContents={session:{webRequest:{onBeforeRequest:()=>{}},setPermissionRequestHandler:()=>{}},setWindowOpenHandler:()=>{},executeJavaScript:async(script:string)=>script.includes('Array.from(document.querySelectorAll(\'.mermaid-render svg\')')?[]:true}
 async loadURL(){}destroy(){}
}}))
vi.mock('../src/main/pandoc',async importOriginal=>({...await importOriginal<typeof import('../src/main/pandoc')>(),detectPandoc:state.detect,pandocToDocx:state.convert}))
vi.mock('../src/main/bibliography',()=>({loadBibliography:state.bibliography}))
import {exportDocument} from '../src/main/export'
let directory='',previousLanguage=getLanguage()
beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-metadata-early-'));previousLanguage=getLanguage();setLanguage('es')
 process.env.FREYALAB_TEST='1';process.env.FREYALAB_TEST_EXPORT_DIR=directory
 vi.clearAllMocks();state.detect.mockResolvedValue({available:true,path:'/synthetic/pandoc',version:'3.10.2',license:'GPL-2.0-or-later'});state.convert.mockResolvedValue(Buffer.from('PK\x03\x04documento sintético'))
 const content=Buffer.from('[{"id":"approved","type":"book","title":"Fuente"}]'),sha256=createHash('sha256').update(content).digest('hex')
 state.bibliography.mockResolvedValue({ok:true,path:join(directory,'approved.bib'),sha256,snapshot:{format:'csl-json',content,sha256}})
})
afterEach(async()=>{setLanguage(previousLanguage);delete process.env.FREYALAB_TEST;delete process.env.FREYALAB_TEST_EXPORT_DIR;await rm(directory,{recursive:true,force:true})})
async function document(abstract:string,bibliography:boolean){
 const path=join(directory,'informe.md'),original='# Original conservado\n';await writeFile(path,original)
 const source='---\nportada: true\n'+(bibliography?'bibliography: approved.bib\n':'')+'abstract: '+JSON.stringify(abstract)+'\n---\n\n# Fuente conservada\n'
 const record={info:{id:'informe',name:'informe.md',kind:'markdown',path,readonly:false,revision:0,dirty:true},text:source,root:directory}
 return{record,original,path,docs:{get:()=>record,records:new Map([['informe',record]]),pandocPath:'/synthetic/pandoc'} as unknown as Documents}
}
it.each([false,true])('S2b: exportar rechaza el total antes de detectar Pandoc o convertir BibTeX (bibliografía=%s)',async bibliography=>{
 const {record,original,path,docs}=await document('x'.repeat(8001),bibliography),snapshot=structuredClone(record)
 await expect(exportDocument(docs,'informe',{format:'docx',revision:0,html:'<article></article>'})).rejects.toThrow('Revisa el resumen: los metadatos superan el límite conjunto de 8000 unidades UTF-16. Exceso: 12.')
 expect(state.detect).not.toHaveBeenCalled();expect(state.bibliography).not.toHaveBeenCalled();expect(state.convert).not.toHaveBeenCalled()
 expect(record).toEqual(snapshot);expect(await readFile(path,'utf8')).toBe(original);expect((await readdir(directory)).filter(file=>file.endsWith('.docx'))).toEqual([])
})
it('S2b: exportar conserva el flujo válido en la frontera conjunta y su bibliografía',async()=>{
 const {record,original,path,docs}=await document('x'.repeat(7989),true),snapshot=structuredClone(record)
 expect(await exportDocument(docs,'informe',{format:'docx',revision:0,html:'<article></article>'})).toBe(join(directory,'informe.docx'))
 expect(state.detect).toHaveBeenCalledTimes(1);expect(state.bibliography).toHaveBeenCalledTimes(2);expect(state.convert).toHaveBeenCalledTimes(1)
 expect(state.convert.mock.calls[0][2].metadata).toEqual({lang:'es',tocTitle:'Contenido',abstract:'x'.repeat(7989)})
 expect((await readFile(join(directory,'informe.docx'))).subarray(0,4)).toEqual(Buffer.from('PK\x03\x04'));expect(record).toEqual(snapshot);expect(await readFile(path,'utf8')).toBe(original)
})
