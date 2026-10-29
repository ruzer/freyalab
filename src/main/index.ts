import { app, BrowserWindow, dialog, ipcMain, shell, clipboard } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, relative, isAbsolute, extname } from 'node:path'
import { z } from 'zod'
import {col,query,conditionGroup} from './query-schema'
import {ChartPresets,chartConfiguration} from './chart-presets'
import {exportChartResult} from './chart-result-export'
import { SqlService } from './sql-service'
import appIcon from '../../build/icon.png?asset'
import { Documents } from './documents'
import {initializeLanguage,languageState,changeLanguage} from './language'
import {t} from '../shared/i18n'
import {detectPandoc,testPandoc} from './pandoc'
import {citationStyleIds} from '../shared/bibliography'
import { exportDocument,exportGraphic } from './export'
import { operateDocument } from './extract'
import { operationRequest } from './operation-schema'
import {viewRequest} from './large-view-schema'
import type { Kind,TableEdit,TableOptions,TableExport,TableQuery,ExportRequest,TableRange,TableRangeEdit,TableTransformEdit } from '../shared/types'
const here=dirname(fileURLToPath(import.meta.url))
if(process.env.FREYALAB_USER_DATA)app.setPath('userData',resolve(process.env.FREYALAB_USER_DATA))
let window:BrowserWindow|undefined,docs:Documents,analytics:SqlService,presets:ChartPresets,quitting=false
const waiting:string[]=[]
const id=z.uuid(),path=z.string().min(1).max(32768), text=z.string().max(20*1024*1024), rows=z.array(z.string().max(100)).max(2000000)
const range=z.object({top:z.number().int().nonnegative(),bottom:z.number().int().nonnegative(),left:col,right:col,query,revision:z.number().int().nonnegative()})
const rangeEdit=z.object({type:z.literal('range'),requestId:z.uuid().optional(),range,operation:z.enum(['fill','clear','trim','upper','lower','replace','paste']),value:z.string().max(1024*1024).optional(),find:z.string().max(10000).optional(),values:z.array(z.array(z.string().max(1024*1024)).max(100000)).max(100000).optional()})
const structureEdit=z.object({type:z.literal('structure'),operation:z.enum(['split','combine','deduplicate','normalize','headers','moveRows','moveColumns','commitOrder']),columns:z.array(col).max(200),revision:z.number().int().nonnegative(),requestId:z.uuid(),separator:z.string().max(64).optional(),name:z.string().max(10000).optional(),rowIds:rows.optional(),range:range.optional(),destination:z.number().int().nonnegative().optional(),query:query.optional()})
const edits=z.discriminatedUnion('type',[rangeEdit,structureEdit,
 z.object({type:z.literal('cell'),rowId:z.string().max(100),column:col,value:z.string().max(1024*1024)}),
 z.object({type:z.literal('paste'),rowId:z.string().max(100),column:col,values:z.array(z.array(z.string().max(1024*1024)).max(100000)).max(100000),view:z.object({query,revision:z.number().int().nonnegative()}).optional()}),
 z.object({type:z.literal('duplicateRows'),ids:rows.min(1)}),z.object({type:z.literal('duplicateColumn'),index:col}),
 z.object({type:z.literal('transform'),operation:z.enum(['trim','upper','lower']),rowIds:rows.min(1),columns:z.array(col).min(1).max(100000)}),
 z.object({type:z.literal('insertRow'),afterId:z.string().max(100).optional(),beforeId:z.string().min(1).max(100).optional()}).refine(value=>value.beforeId===undefined||value.afterId===undefined),z.object({type:z.literal('deleteRows'),ids:rows}),
 z.object({type:z.literal('insertColumn'),index:col,name:z.string().max(10000)}),z.object({type:z.literal('deleteColumn'),index:col}),z.object({type:z.literal('header'),index:col,name:z.string().max(10000)}),z.object({type:z.literal('replace'),find:z.string().min(1).max(10000),replacement:z.string().max(1024*1024),column:col.optional()})])
const tableExport=z.object({range:range.optional(),scope:z.enum(['all','filtered','selection']),query:query.optional(),rowIds:rows.optional(),columns:z.array(col).optional(),delimiter:z.enum([',',';','\t','|']).optional()})
async function openPaths(paths:string[]){const result=[];for(const p of paths){if(!await docs.allowed(p))throw new Error('Abre el archivo desde el selector o arrástralo a la ventana.');const document=await docs.open(p);result.push(document);window?.webContents.send('freya:event',{type:'opened',document})}return result}
function assertSender(event:Electron.IpcMainInvokeEvent|Electron.IpcMainEvent){if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Origen no autorizado.')}
async function handle(operation:string,args:unknown[]){
 const [a,b,c,d]=args
 switch(operation){
 case'language':return languageState()
 case'setLanguage':{const language=changeLanguage(z.enum(['sistema','es','en']).parse(a));window?.webContents.send('freya:event',{type:'language',language});return language}
 case'pandocStatus':z.tuple([]).parse(args);return detectPandoc(docs.pandocPath)
 case'pandocChoose':{
  z.tuple([]).parse(args)
  const selected=await dialog.showOpenDialog(window!,{title:t('pandoc.dialog.choose'),buttonLabel:t('dialog.open.button'),properties:['openFile']})
  if(selected.canceled)return detectPandoc(docs.pandocPath)
  const status=await detectPandoc(selected.filePaths[0]);if(status.available)docs.pandocPath=status.path
  return status
 }
 case'pandocTest':{z.tuple([]).parse(args);const status=await detectPandoc(docs.pandocPath);if(!status.available)throw new Error(status.reason);return testPandoc(status.path)}
 case'open':{const result=await dialog.showOpenDialog(window!,{title:t('dialog.open.title'),buttonLabel:t('dialog.open.button'),properties:['openFile','multiSelections'],filters:[{name:t('dialog.open.filter'),extensions:['md','markdown','txt','mmd','mermaid','csv','tsv']}]});for(const p of result.filePaths)docs.grants.add(resolve(p));return result.canceled?[]:openPaths(result.filePaths)}
 case'openPaths':return openPaths(z.array(path).max(100).parse(a))
 case'new':return docs.create(z.enum(['markdown','text','mermaid','csv']).parse(a) as Kind)
 case'folder':{if(process.env.FREYALAB_TEST==='1'&&process.env.FREYALAB_TEST_FOLDER){const folder=resolve(process.env.FREYALAB_TEST_FOLDER);docs.roots.add(folder);return folder}const result=await dialog.showOpenDialog(window!,{title:t('dialog.folder.title'),buttonLabel:t('dialog.open.button'),properties:['openDirectory']});if(result.canceled)return null;docs.roots.add(result.filePaths[0]);return result.filePaths[0]}
 case'tree':return docs.tree(path.parse(a))
 case'findFiles':return docs.findFiles(path.parse(a),z.string().min(1).max(500).parse(b))
 case'cancelFileSearch':return docs.cancelFileSearch()
 case'listTags':return docs.listTags(path.parse(a))
 case'cancelTagList':return docs.cancelTagList()
 case'documents':return[...docs.records.keys()].map(key=>docs.info(key))
 case'bibliography':return docs.bibliography(id.parse(a),text.parse(b))
 case'update':return docs.update(id.parse(a),text.parse(b))
 case'save':return docs.save(id.parse(a),z.boolean().optional().parse(b))
 case'close':{const key=id.parse(a),closed=await docs.close(key);if(closed)analytics.forget(key);return closed}
 case'reload':return docs.reload(id.parse(a))
 case'copyTable':{docs.get(id.parse(a));const options=tableExport.parse(b),format=z.enum(['tsv','markdown']).parse(c),output=await docs.table.call<string>(format==='markdown'?'markdown':'clipboard',a,options);if(Buffer.byteLength(output,'utf8')>8*1024*1024)throw new Error('La copia supera 8 MiB. Reduce la selección o expórtala.');await clipboard.writeText(output);return}
 case'pasteTable':{docs.get(id.parse(a));const selected=range.parse(b);await docs.table.call('rangePreview',a,{type:'range',range:selected,operation:'clear'});const content=await clipboard.readText();if(Buffer.byteLength(content,'utf8')>8*1024*1024)throw new Error('El portapapeles supera 8 MiB. Pega un bloque menor.');return content}
 case'transformPreview':docs.get(id.parse(a));return docs.table.call('transformPreview',a,structureEdit.parse(b) as TableTransformEdit)
 case'rangePreview':docs.get(id.parse(a));return docs.table.call('rangePreview',a,rangeEdit.parse(b) as TableRangeEdit)
 case'rangeClipboard':docs.get(id.parse(a));return docs.table.call('rangeClipboard',a,range.parse(b) as TableRange)
 case'page':docs.get(id.parse(a));return docs.table.call('page',a,query.parse(b) as TableQuery)
 case'viewStart':docs.get(id.parse(a));return docs.table.call('viewStart',a,viewRequest.parse(b))
 case'viewState':docs.get(id.parse(a));return docs.table.call('viewState',a)
 case'viewCancel':docs.get(id.parse(a));return docs.table.call('viewCancel',a,z.uuid().parse(b))
 case'viewClear':docs.get(id.parse(a));return docs.table.call('viewClear',a)
 case'edit':return docs.tableEdit(id.parse(a),edits.parse(b) as TableEdit)
 case'options':return docs.tableOptions(id.parse(a),z.object({encoding:z.enum(['utf8','utf16le','win1252']).optional(),delimiter:z.enum([',',';','\t','|']).optional(),header:z.boolean().optional()}).parse(b) as TableOptions)
 case'undo':return docs.undo(id.parse(a),z.boolean().optional().parse(b))
 case'chartPresets':return presets.list()
 case'saveChartPreset':{const document=docs.info(id.parse(a));if(document.kind!=='csv')throw new Error('Abre un CSV para guardar el gráfico.');return presets.save(b,document.headers??[])}
 case'deleteChartPreset':return presets.delete(id.parse(a))
 case'sqlRun':return analytics.run(z.object({requestId:z.uuid(),sources:z.array(z.object({id,revision:z.number().int().nonnegative(),query:query.optional(),where:conditionGroup.optional()})).min(1).max(4),sql:z.string().trim().min(1).max(100000)}).parse(a))
 case'sqlPage':return analytics.page(id.parse(a),z.number().int().min(0).max(9999).parse(b))
 case'sqlCancel':return analytics.cancel(id.parse(a))
 case'analyzeColumn':docs.get(id.parse(a));return docs.table.call('analyzeColumn',a,z.object({column:col,otherColumn:col.optional(),query:query.optional(),revision:z.number().int().nonnegative(),requestId:z.uuid(),frequencyOffset:z.number().int().min(0).max(2000000),duplicatesOnly:z.boolean(),bins:z.number().int().min(1).max(30)}).parse(b))
 case'cancelAnalysis':docs.get(id.parse(a));return docs.table.call('cancelAnalysis',a,z.uuid().parse(b))
 case'operation':{const key=id.parse(a),outcome=await operateDocument(docs,key,operationRequest.parse(b));if(outcome?.document)window?.webContents.send('freya:event',{type:'opened',document:outcome.document});return outcome}
 case'cancelOperation':docs.get(id.parse(a));return docs.table.call('cancelOperation',z.uuid().parse(b))
 case'cancelOpen':return docs.table.call('cancelOpen',id.parse(a)) // el documento aún no está en `records`: se está abriendo
 case'stats':docs.get(id.parse(a));return docs.table.call('stats',a,rows.nullable().parse(b),z.array(col).max(100000).parse(c),z.object({requestId:z.uuid(),revision:z.number().int().nonnegative(),range:range.optional()}).optional().parse(d))
 case'markdown':docs.get(id.parse(a));return docs.table.call('markdown',a,tableExport.parse(b) as TableExport)
 case'exportChartResult':return exportChartResult(docs,analytics,id.parse(a),z.object({requestId:id,revision:z.number().int().nonnegative(),configuration:chartConfiguration,format:z.enum(['csv','json','md']),protectFormulas:z.boolean()}).strict().parse(b))
 case'exportGraphic':return exportGraphic(docs,id.parse(a),z.object({format:z.enum(['svg','png','pdf']),svg:text.min(1),revision:z.number().int().nonnegative()}).strict().parse(b))
 case'export':return exportDocument(docs,id.parse(a),z.object({format:z.enum(['pdf','html','svg','png','csv','tsv','docx']),html:text.optional(),svg:text.optional(),table:tableExport.optional(),revision:z.number().int().nonnegative().optional(),citationStyle:z.enum(citationStyleIds).optional()}).parse(b) as ExportRequest)
 case'locateImage':return docs.locateImage(id.parse(a),z.string().min(1).max(16*1024*1024).parse(b))
 case'image':return docs.image(id.parse(a),z.string().max(16*1024*1024).parse(b))
 case'link':{const url=z.url().parse(a),target=new URL(url);if(!['https:','http:','mailto:'].includes(target.protocol))throw new Error('Solo se permiten enlaces web o de correo.');if(target.protocol==='mailto:'&&[...target.searchParams.keys()].some(key=>['attach','attachment'].includes(key.toLowerCase())))throw new Error('No se permiten adjuntos en enlaces de correo.');await shell.openExternal(url);return}
 case'recents':{const recents=await docs.recents();for(const p of recents)docs.grants.add(resolve(p));return recents}
 case'recoveries':return docs.listRecoveries()
 case'recover':return docs.recover(id.parse(a))
 case'discardRecovery':return docs.discardRecovery(id.parse(a))
 default:throw new Error('Operación no compatible.')
 }
}
app.on('open-file',(event,path)=>{event.preventDefault();waiting.push(path);if(docs){docs.grants.add(resolve(path));void openPaths([path]).catch(e=>window?.webContents.send('freya:event',{type:'error',message:e.message}))}})
if(!app.requestSingleInstanceLock()&&process.env.FREYALAB_TEST!=='1')app.quit()
app.on('second-instance',(_event,argv)=>{window?.show();window?.focus();const paths=argv.filter(p=>/\.(md|markdown|csv|tsv|mmd|mermaid|txt)$/i.test(p)&&!p.startsWith('-'));for(const p of paths)docs.grants.add(resolve(p));void openPaths(paths).catch(e=>window?.webContents.send('freya:event',{type:'error',message:e.message}))})
app.whenReady().then(async()=>{
 app.setName('FreyaLab')
 initializeLanguage(app.getPreferredSystemLanguages(),process.env)
 docs=new Documents(event=>window?.webContents.send('freya:event',event))
 if(process.env.FREYALAB_TEST==='1'&&process.env.FREYALAB_TEST_PANDOC_PATH)docs.pandocPath=process.env.FREYALAB_TEST_PANDOC_PATH
 presets=new ChartPresets(join(app.getPath('userData'),'chart-presets.json'))
 analytics=new SqlService(docs,progress=>window?.webContents.send('freya:event',{type:'analysis',progress}))
 ipcMain.handle('freya',async(event,operation,...args)=>{assertSender(event);try{return await handle(z.string().max(100).parse(operation),args)}catch(e){throw new Error(e instanceof z.ZodError?t('error.invalidOperation'):(e as Error).message)}})
 ipcMain.on('freya:drop',(event,paths)=>{assertSender(event);for(const p of z.array(path).max(100).parse(paths))docs.grants.add(resolve(p))})
 ipcMain.on('freya:paste-plain',event=>{
  try{assertSender(event);if(!event.sender.isDestroyed())event.sender.pasteAndMatchStyle()}
  catch{if(window&&!window.isDestroyed())window.webContents.send('freya:event',{type:'error',message:'No pude pegar sin formato.'})}
 })
 window=new BrowserWindow({icon:appIcon,width:1440,height:900,minWidth:720,minHeight:600,title:'FreyaLab',backgroundColor:'#18181b',titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',webPreferences:{preload:join(here,'../preload/index.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}})
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}))
 window.webContents.on('will-navigate',(event)=>event.preventDefault())
 window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false))
 if(!process.env.ELECTRON_RENDERER_URL)window.webContents.session.webRequest.onBeforeRequest((details,callback)=>{
  if(details.url.startsWith('data:')||details.url.startsWith('devtools:')){callback({cancel:false});return}
  try{const asset=relative(resolve(here,'../renderer'),fileURLToPath(details.url));callback({cancel:asset.startsWith('..')||isAbsolute(asset)})}catch{callback({cancel:true})}
 })
 window.on('close',event=>{if(quitting)return;event.preventDefault();void(async()=>{for(const key of [...docs.records.keys()])if(!await docs.close(key))return;quitting=true;analytics.stop();await docs.shutdown();window?.destroy();app.quit()})().catch(e=>dialog.showErrorBox(t('dialog.close.error'),e.message))})
 const url=process.env.ELECTRON_RENDERER_URL;if(url)await window.loadURL(url);else await window.loadFile(join(here,'../renderer/index.html'))
 const initial=process.env.FREYALAB_TEST==='1'&&process.env.FREYALAB_TEST_OPEN?JSON.parse(process.env.FREYALAB_TEST_OPEN):process.argv.slice(1).filter(p=>/\.(md|markdown|csv|tsv|mmd|mermaid|txt)$/i.test(p))
 for(const p of [...waiting,...initial]){docs.grants.add(resolve(p));await openPaths([p]).catch(e=>window?.webContents.send('freya:event',{type:'error',message:e.message}))}
}).catch(e=>{console.error(e);app.exit(1)})
app.on('window-all-closed',()=>app.quit())
app.on('before-quit',()=>{if(!quitting&&docs){for(const key of docs.records.keys())void docs.checkpoint(key)}})
