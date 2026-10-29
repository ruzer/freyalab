import {it,expect,vi,afterEach} from 'vitest'
import {mkdtemp,rm,readFile,access} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {Documents} from '../src/main/documents'
const captured=vi.hoisted(()=>({options:undefined as Record<string,unknown>|undefined,onPrint:()=>{},scripts:[] as string[]}))
vi.mock('electron',()=>({app:{},dialog:{},BrowserWindow:class{
 webContents={session:{webRequest:{onBeforeRequest:()=>{}},setPermissionRequestHandler:()=>{}},setWindowOpenHandler:()=>{},executeJavaScript:async(script:string)=>{captured.scripts.push(script);return true},printToPDF:async(options:Record<string,unknown>)=>{captured.options=options;captured.onPrint();return Buffer.from('%PDF-fixture')}}
 async loadURL(){}destroy(){}
}}))
import {exportDocument} from '../src/main/export'
let directory=''
afterEach(async()=>{captured.onPrint=()=>{};captured.scripts=[];delete process.env.FREYALAB_TEST;delete process.env.FREYALAB_TEST_EXPORT_DIR;if(directory)await rm(directory,{recursive:true,force:true})})
it('AC-04 · PDF Markdown numera páginas sin fecha, ruta ni título automático del navegador',async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-pdf-pages-'));process.env.FREYALAB_TEST='1';process.env.FREYALAB_TEST_EXPORT_DIR=directory
 const record={info:{id:'reporte',name:'reporte.md',kind:'markdown',path:null,readonly:false,revision:0},text:'# Reporte'}
 const docs={get:()=>record,records:new Map([['reporte',record]])} as unknown as Documents
 const result=await exportDocument(docs,'reporte',{format:'pdf',html:'<article><h1>Reporte</h1></article>'})
 expect(result).toBe(join(directory,'reporte.pdf'));expect((await readFile(result!)).toString()).toBe('%PDF-fixture')
 expect(captured.options).toMatchObject({displayHeaderFooter:false})
 const footer=captured.scripts.find(script=>script.includes('@bottom-center'))
 expect(footer).toContain('counter(page)');expect(footer).toContain('counter(pages)')
 expect(footer).not.toContain('@page:first');expect(captured.options?.footerTemplate).toBeUndefined()
})
it('AC-02 C1 / AC-04 · la portada no lleva número y el resto conserva su pie',async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-pdf-cover-'));process.env.FREYALAB_TEST='1';process.env.FREYALAB_TEST_EXPORT_DIR=directory
 const record={info:{id:'reporte',name:'reporte.md',kind:'markdown',path:null,readonly:false,revision:0},text:'---\nportada: true\ntitle: Reporte\n---\n# Resultados'}
 const docs={get:()=>record,records:new Map([['reporte',record]])} as unknown as Documents
 await exportDocument(docs,'reporte',{format:'pdf',html:'<article><section class="report-cover"><h1>Reporte</h1></section><h1>Resultados</h1></article>'})
 expect(captured.options).toMatchObject({displayHeaderFooter:false})
 const footer=captured.scripts.find(script=>script.includes('@bottom-center'))
 expect(footer).toContain('counter(page)');expect(footer).toContain('counter(pages)')
 expect(footer).toContain('@page:first');expect(footer).toContain('content:none')
})
it.each(['revision','texto','cierre'] as const)('AC-04 · no publica un PDF de Markdown si cambia %s durante la conversión',async change=>{
 directory=await mkdtemp(join(tmpdir(),'freya-pdf-race-'));process.env.FREYALAB_TEST='1';process.env.FREYALAB_TEST_EXPORT_DIR=directory
 const record={info:{id:'reporte',name:'reporte.md',kind:'markdown',path:null,readonly:false,revision:0},text:'# Reporte'},records=new Map([['reporte',record]])
 const docs={get:()=>record,records} as unknown as Documents
 captured.onPrint=()=>{if(change==='revision')record.info.revision++;else if(change==='texto')record.text='# Otro texto';else records.clear()}
 await expect(exportDocument(docs,'reporte',{format:'pdf',revision:0,html:'<article><h1>Reporte</h1></article>'})).rejects.toThrow(/cambi[oó]|changed/i)
 await expect(access(join(directory,'reporte.pdf'))).rejects.toThrow()
})
