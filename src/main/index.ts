import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, relative, isAbsolute, extname } from 'node:path'
import { z } from 'zod'
import { Documents } from './documents'
import { exportDocument } from './export'
import type { Kind,TableEdit,TableOptions,TableExport,TableQuery,ExportRequest } from '../shared/types'
const here=dirname(fileURLToPath(import.meta.url))
if(process.env.FREYALAB_USER_DATA)app.setPath('userData',resolve(process.env.FREYALAB_USER_DATA))
let window:BrowserWindow|undefined,docs:Documents,quitting=false
const waiting:string[]=[]
const id=z.uuid(),path=z.string().min(1).max(32768), text=z.string().max(20*1024*1024),col=z.number().int().min(0).max(100000), rows=z.array(z.string().max(100)).max(2000000)
const query=z.object({search:z.string().max(10000).optional(),filters:z.record(z.string(),z.string().max(10000)).optional(),sort:z.object({column:col,descending:z.boolean(),numeric:z.boolean()}).optional(),offset:z.number().int().nonnegative(),limit:z.number().int().min(1).max(1000),requestId:z.number().int().nonnegative()})
const edits=z.discriminatedUnion('type',[
 z.object({type:z.literal('cell'),rowId:z.string().max(100),column:col,value:z.string().max(1024*1024)}),
 z.object({type:z.literal('paste'),rowId:z.string().max(100),column:col,values:z.array(z.array(z.string().max(1024*1024)).max(100000)).max(100000)}),
 z.object({type:z.literal('insertRow'),afterId:z.string().max(100).optional()}),z.object({type:z.literal('deleteRows'),ids:rows}),
 z.object({type:z.literal('insertColumn'),index:col,name:z.string().max(10000)}),z.object({type:z.literal('deleteColumn'),index:col}),z.object({type:z.literal('header'),index:col,name:z.string().max(10000)}),z.object({type:z.literal('replace'),find:z.string().min(1).max(10000),replacement:z.string().max(1024*1024),column:col.optional()})])
const tableExport=z.object({scope:z.enum(['all','filtered','selection']),query:query.optional(),rowIds:rows.optional(),columns:z.array(col).optional(),delimiter:z.enum([',',';','\t','|']).optional()})
async function openPaths(paths:string[]){const result=[];for(const p of paths){if(!await docs.allowed(p))throw new Error('Abre el archivo desde el selector o arrástralo a la ventana.');const document=await docs.open(p);result.push(document);window?.webContents.send('freya:event',{type:'opened',document})}return result}
function assertSender(event:Electron.IpcMainInvokeEvent|Electron.IpcMainEvent){if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Origen no autorizado.')}
async function handle(operation:string,args:unknown[]){
 const [a,b,c]=args
 switch(operation){
 case'open':{const result=await dialog.showOpenDialog(window!,{properties:['openFile','multiSelections'],filters:[{name:'Documentos',extensions:['md','markdown','txt','mmd','mermaid','csv','tsv']}]});for(const p of result.filePaths)docs.grants.add(resolve(p));return result.canceled?[]:openPaths(result.filePaths)}
 case'openPaths':return openPaths(z.array(path).max(100).parse(a))
 case'new':return docs.create(z.enum(['markdown','text','mermaid','csv']).parse(a) as Kind)
 case'folder':{if(process.env.FREYALAB_TEST==='1'&&process.env.FREYALAB_TEST_FOLDER){const folder=resolve(process.env.FREYALAB_TEST_FOLDER);docs.roots.add(folder);return folder}const result=await dialog.showOpenDialog(window!,{properties:['openDirectory']});if(result.canceled)return null;docs.roots.add(result.filePaths[0]);return result.filePaths[0]}
 case'tree':return docs.tree(path.parse(a))
 case'findFiles':return docs.findFiles(path.parse(a),z.string().min(1).max(500).parse(b))
 case'documents':return[...docs.records.keys()].map(key=>docs.info(key))
 case'update':return docs.update(id.parse(a),text.parse(b))
 case'save':return docs.save(id.parse(a),z.boolean().optional().parse(b))
 case'close':return docs.close(id.parse(a))
 case'reload':return docs.reload(id.parse(a))
 case'page':docs.get(id.parse(a));return docs.table.call('page',a,query.parse(b) as TableQuery)
 case'edit':return docs.tableEdit(id.parse(a),edits.parse(b) as TableEdit)
 case'options':return docs.tableOptions(id.parse(a),z.object({encoding:z.enum(['utf8','utf16le','win1252']).optional(),delimiter:z.enum([',',';','\t','|']).optional(),header:z.boolean().optional()}).parse(b) as TableOptions)
 case'undo':return docs.undo(id.parse(a),z.boolean().optional().parse(b))
 case'stats':docs.get(id.parse(a));return docs.table.call('stats',a,rows.parse(b),z.array(col).max(100000).parse(c))
 case'markdown':docs.get(id.parse(a));return docs.table.call('markdown',a,tableExport.parse(b) as TableExport)
 case'export':return exportDocument(docs,id.parse(a),z.object({format:z.enum(['pdf','html','svg','png','csv','tsv']),html:text.optional(),svg:text.optional(),table:tableExport.optional()}).parse(b) as ExportRequest)
 case'image':return docs.image(id.parse(a),z.string().max(16*1024*1024).parse(b))
 case'link':{const url=z.url().parse(a);if(!['https:','http:'].includes(new URL(url).protocol))throw new Error('Solo se permiten enlaces web.');await shell.openExternal(url);return}
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
 docs=new Documents(event=>window?.webContents.send('freya:event',event))
 ipcMain.handle('freya',async(event,operation,...args)=>{assertSender(event);try{return await handle(z.string().max(100).parse(operation),args)}catch(e){throw new Error(e instanceof z.ZodError?'Datos de operación no válidos.':(e as Error).message)}})
 ipcMain.on('freya:drop',(event,paths)=>{assertSender(event);for(const p of z.array(path).max(100).parse(paths))docs.grants.add(resolve(p))})
 window=new BrowserWindow({width:1440,height:900,minWidth:900,minHeight:600,title:'FreyaLab',backgroundColor:'#18181b',titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',webPreferences:{preload:join(here,'../preload/index.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}})
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}))
 window.webContents.on('will-navigate',(event)=>event.preventDefault())
 window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false))
 if(!process.env.ELECTRON_RENDERER_URL)window.webContents.session.webRequest.onBeforeRequest((details,callback)=>{
  if(details.url.startsWith('data:')||details.url.startsWith('devtools:')){callback({cancel:false});return}
  try{const asset=relative(resolve(here,'../renderer'),fileURLToPath(details.url));callback({cancel:asset.startsWith('..')||isAbsolute(asset)})}catch{callback({cancel:true})}
 })
 window.on('close',event=>{if(quitting)return;event.preventDefault();void(async()=>{for(const key of [...docs.records.keys()])if(!await docs.close(key))return;quitting=true;await docs.shutdown();window?.destroy();app.quit()})().catch(e=>dialog.showErrorBox('No se pudo cerrar',e.message))})
 const url=process.env.ELECTRON_RENDERER_URL;if(url)await window.loadURL(url);else await window.loadFile(join(here,'../renderer/index.html'))
 const initial=process.env.FREYALAB_TEST==='1'&&process.env.FREYALAB_TEST_OPEN?JSON.parse(process.env.FREYALAB_TEST_OPEN):process.argv.slice(1).filter(p=>/\.(md|markdown|csv|tsv|mmd|mermaid|txt)$/i.test(p))
 for(const p of [...waiting,...initial]){docs.grants.add(resolve(p));await openPaths([p]).catch(e=>window?.webContents.send('freya:event',{type:'error',message:e.message}))}
}).catch(e=>{console.error(e);app.exit(1)})
app.on('window-all-closed',()=>app.quit())
app.on('before-quit',()=>{if(!quitting&&docs){for(const key of docs.records.keys())void docs.checkpoint(key)}})
