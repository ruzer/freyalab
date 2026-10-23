import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {mkdtemp,writeFile,readFile,rm,access} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import * as files from '../src/main/files'
import {randomUUID} from 'node:crypto'
const state=vi.hoisted(()=>({folder:'',destination:'',cancelled:false,onDialog:()=>{},onPrint:()=>{},destroy:vi.fn(),table:vi.fn(),saveDialog:vi.fn()}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{showSaveDialog:async()=>{state.saveDialog();state.onDialog();return{canceled:state.cancelled,filePath:state.destination}}},BrowserWindow:class{
 static getFocusedWindow(){return undefined}static getAllWindows(){return[]}
 webContents={session:{webRequest:{onBeforeRequest:()=>{}}},executeJavaScript:async()=>true,printToPDF:async()=>{state.onPrint();return Buffer.from('%PDF-fixture')}}
 async loadURL(){}destroy(){state.destroy()}
}}))
vi.mock('../src/main/table-client',()=>({TableClient:class{call=state.table;stop(){}}}))
import {Documents} from '../src/main/documents'
import {exportDocument,exportGraphic,exportResult} from '../src/main/export'
let docs:Documents,id:string,source:string
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script><text onclick="alert(1)">00123</text><use href="https://invalid.test/x"/></svg>'
beforeEach(async()=>{
 vi.stubEnv('FREYALAB_TEST','0');state.folder=await mkdtemp(join(tmpdir(),'freya-graphic-export-'));source=join(state.folder,'original.csv');state.destination=join(state.folder,'graphic.svg');await writeFile(source,'N\n00123\n');state.cancelled=false;state.onDialog=()=>{};state.onPrint=()=>{};state.table.mockReset();state.table.mockRejectedValue(new Error('Un gráfico no debe serializar la tabla.'));state.saveDialog.mockClear();state.destroy.mockClear();docs=new Documents(()=>{});id=randomUUID();docs.records.set(id,{info:{id,name:'original.csv',path:source,kind:'csv',revision:3,readonly:true,dirty:false,encoding:'utf8',delimiter:',',rowCount:200,headers:['N']},text:'',undo:[],redo:[],root:state.folder,saving:false})
})
afterEach(async()=>{vi.unstubAllEnvs();await rm(state.folder,{recursive:true,force:true})})
it('conserva el guardián original de muestras en todos los formatos de exportación de documentos',async()=>{
 for(const format of ['csv','tsv','svg','png','pdf','html'] as const)await expect(exportDocument(docs,id,{format,svg,html:'<p>muestra</p>',table:{scope:'all'}})).rejects.toThrow('muestra limitada')
 expect(state.table).not.toHaveBeenCalled();expect(state.saveDialog).not.toHaveBeenCalled();expect(await readFile(source,'utf8')).toBe('N\n00123\n')
})
it('exporta solo el SVG saneado de la muestra sin serializar ni modificar el CSV o su estado',async()=>{
 const before=docs.info(id);expect(await exportGraphic(docs,id,{format:'svg',svg,revision:3})).toBe(state.destination);const output=await readFile(state.destination,'utf8');expect(output).toContain('<svg');expect(output).toContain('00123');expect(output).not.toMatch(/script|onclick|https:/);expect(docs.info(id)).toEqual(before);expect(state.table).not.toHaveBeenCalled();expect(await readFile(source,'utf8')).toBe('N\n00123\n')
})
it('rechaza revisiones antiguas, fuentes no CSV y documentos cerrados antes de pedir destino',async()=>{
 await expect(exportGraphic(docs,id,{format:'svg',svg,revision:2})).rejects.toThrow('fuente cambió');docs.get(id).info.kind='markdown';await expect(exportGraphic(docs,id,{format:'svg',svg,revision:3})).rejects.toThrow('CSV abierto');docs.records.delete(id);await expect(exportGraphic(docs,id,{format:'svg',svg,revision:3})).rejects.toThrow('ya no está abierto');expect(state.saveDialog).not.toHaveBeenCalled()
})
it('protege los documentos abiertos y la extensión del destino también en la nueva operación',async()=>{
 state.destination=source;await expect(exportGraphic(docs,id,{format:'svg',svg,revision:3})).rejects.toThrow('ruta distinta');state.destination=join(state.folder,'wrong.csv');await expect(exportGraphic(docs,id,{format:'svg',svg,revision:3})).rejects.toThrow('terminar en .svg');expect(await readFile(source,'utf8')).toBe('N\n00123\n');await expect(access(state.destination)).rejects.toThrow()
})
it('revalida la revisión después de elegir el destino y no escribe una fuente modificada o cerrada',async()=>{
 state.onDialog=()=>{docs.get(id).info.revision++};await expect(exportGraphic(docs,id,{format:'svg',svg,revision:3})).rejects.toThrow('fuente cambió');await expect(access(state.destination)).rejects.toThrow();state.onDialog=()=>{docs.records.delete(id)};await expect(exportGraphic(docs,id,{format:'svg',svg,revision:4})).rejects.toThrow('ya no está abierto');await expect(access(state.destination)).rejects.toThrow()
})
it('revalida antes de escribir si la fuente cambió mientras se generaba el PDF y libera la ventana',async()=>{
 state.destination=join(state.folder,'graphic.pdf');state.onPrint=()=>{docs.get(id).info.revision++};await expect(exportGraphic(docs,id,{format:'pdf',svg,revision:3})).rejects.toThrow('fuente cambió');expect(state.destroy).toHaveBeenCalledTimes(1);await expect(access(state.destination)).rejects.toThrow();expect(await readFile(source,'utf8')).toBe('N\n00123\n')
})
it('cancelar el destino no escribe archivos ni cambia el documento',async()=>{
 const before=docs.info(id);state.cancelled=true;expect(await exportGraphic(docs,id,{format:'svg',svg,revision:3})).toBeNull();expect(docs.info(id)).toEqual(before);await expect(access(state.destination)).rejects.toThrow();expect(state.table).not.toHaveBeenCalled()
})
it('una imagen de la revisión editable actual no guarda ni descarta cambios pendientes',async()=>{
 Object.assign(docs.get(id).info,{readonly:false,dirty:true,revision:4});const before=docs.info(id);await exportGraphic(docs,id,{format:'svg',svg,revision:4});expect(docs.info(id)).toEqual(before);expect(docs.info(id).dirty).toBe(true);expect(state.table).not.toHaveBeenCalled();expect(await readFile(source,'utf8')).toBe('N\n00123\n')
})

it('resultados: CSV y JSON requieren nombres nuevos y no serializan la fuente de muestra',async()=>{
 state.destination=join(state.folder,'result.csv');const before=docs.info(id)
 expect(await exportResult(docs,id,{format:'csv',content:'X,Y\r\n00123,5\r\n',context:'{"rows":[["00123","5"]]}'},async()=>{})).toBe(state.destination)
 expect(await readFile(state.destination,'utf8')).toBe('X,Y\r\n00123,5\r\n');expect(JSON.parse(await readFile(state.destination+'.contexto.json','utf8'))).toEqual({rows:[['00123','5']]});expect(docs.info(id)).toEqual(before);expect(state.table).not.toHaveBeenCalled()
 await expect(exportResult(docs,id,{format:'csv',content:'nuevo',context:'{}'},async()=>{})).rejects.toThrow('nombres nuevos');expect(await readFile(state.destination,'utf8')).toContain('00123')
})
it('resultados: contexto existente, destinos abiertos, extensión incorrecta y cancelación no alteran archivos',async()=>{
 state.destination=source;await expect(exportResult(docs,id,{format:'csv',content:'x',context:'{}'},async()=>{})).rejects.toThrow('ruta distinta')
 state.destination=join(state.folder,'result.csv');await writeFile(state.destination+'.contexto.json','conservar');await expect(exportResult(docs,id,{format:'csv',content:'x',context:'{}'},async()=>{})).rejects.toThrow('nombres nuevos');await expect(access(state.destination)).rejects.toThrow();expect(await readFile(state.destination+'.contexto.json','utf8')).toBe('conservar')
 state.destination=join(state.folder,'wrong.txt');await expect(exportResult(docs,id,{format:'json',content:'{}'},async()=>{})).rejects.toThrow('terminar en .json');state.cancelled=true;expect(await exportResult(docs,id,{format:'json',content:'{}'},async()=>{})).toBeNull()
})
it('resultados: un error de disco en el segundo archivo revierte solamente los archivos de esta exportación',async()=>{
 state.destination=join(state.folder,'result.csv');const originalWrite=files.atomicWrite,write=vi.spyOn(files,'atomicWrite').mockImplementation(async(path,...args)=>{if(path===state.destination)throw new Error('Disco lleno');await originalWrite(path,...args)})
 try{await expect(exportResult(docs,id,{format:'csv',content:'X\n1\n',context:'{}'},async()=>{})).rejects.toThrow('Disco lleno');await expect(access(state.destination)).rejects.toThrow();await expect(access(state.destination+'.contexto.json')).rejects.toThrow();expect(await readFile(source,'utf8')).toBe('N\n00123\n')}finally{write.mockRestore()}
})
it('resultados: cancelar o cambiar revisión después del contexto limpia ambos destinos nuevos',async()=>{
 state.destination=join(state.folder,'result.csv');let validations=0
 await expect(exportResult(docs,id,{format:'csv',content:'X\n1\n',context:'{}'},async()=>{if(++validations===3)throw new Error('Análisis cancelado.')})).rejects.toThrow('cancelado');await expect(access(state.destination)).rejects.toThrow();await expect(access(state.destination+'.contexto.json')).rejects.toThrow()
})
it('resultados: no borra cambios externos durante una reversión y explica la entrega incompleta',async()=>{
 state.destination=join(state.folder,'result.csv');let validations=0
 await expect(exportResult(docs,id,{format:'csv',content:'X\n1\n',context:'{}'},async()=>{if(++validations===3){await writeFile(state.destination+'.contexto.json','cambio externo');throw new Error('Cancelar')}})).rejects.toThrow('se conservaron');expect(await readFile(state.destination+'.contexto.json','utf8')).toBe('cambio externo');await expect(access(state.destination)).rejects.toThrow()
})
it('resultados: limita tamaño antes del selector y revalida antes de escribir JSON o Markdown',async()=>{
 state.destination=join(state.folder,'result.json');await expect(exportResult(docs,id,{format:'json',content:'x'.repeat(20*1024*1024+1)},async()=>{})).rejects.toThrow('20 MiB');expect(state.saveDialog).not.toHaveBeenCalled()
 await expect(exportResult(docs,id,{format:'json',content:'{}'},async()=>{throw new Error('Fuente cambió')})).rejects.toThrow('Fuente cambió');await expect(access(state.destination)).rejects.toThrow()
 state.destination=join(state.folder,'result.md');expect(await exportResult(docs,id,{format:'md',content:'# Resultado'},async()=>{})).toBe(state.destination);expect(await readFile(state.destination,'utf8')).toBe('# Resultado')
})
