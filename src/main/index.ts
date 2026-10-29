import { app, BrowserWindow, dialog, ipcMain, shell, clipboard, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, relative, isAbsolute, extname, basename } from 'node:path'
import { z } from 'zod'
import {col,query,conditionGroup} from './query-schema'
import {ChartPresets,chartConfiguration} from './chart-presets'
import {exportChartResult} from './chart-result-export'
import { SqlService } from './sql-service'
import appIcon from '../../build/icon.png?asset'
import { Documents } from './documents'
import {initializeLanguage,languageState,changeLanguage} from './language'
import {t,formatList} from '../shared/i18n'
import {applicationInfo,copyApplicationInfo,thirdPartyNotices} from './app-info'
import {SettingsStore} from './settings'
import {UpdatesService,releaseUrl} from './updates'
import {resetSettings,clearRecents,showDataFolder} from './settings-actions'
import {legacySettingsInputSchema,type SettingsState} from '../shared/settings'
import {applicationMenu,applicationShortcutHelp,type ApplicationMenuContext} from './application-menu'
import {applicationUiStateSchema,applicationCommandSchema,menuFingerprint} from './application-state'
import {MenuNativeEdits,nativeEditArguments} from './menu-native-edit'
import {removeMissingRecent} from './application-recents'
import {WindowClosePreparation,closePreparedArguments} from './application-close'
import {ApplicationWindowClose} from './application-window-close'
import type {ApplicationUiState} from '../shared/application'
import { exportDocument,exportGraphic } from './export'
import { operateDocument } from './extract'
import { operationRequest } from './operation-schema'
import {viewRequest} from './large-view-schema'
import {isTableDocument} from '../shared/types'
import type { Kind,TableEdit,TableOptions,TableExport,TableQuery,ExportRequest,TableRange,TableRangeEdit,TableTransformEdit } from '../shared/types'
const here=dirname(fileURLToPath(import.meta.url))
if(process.env.FREYALAB_USER_DATA)app.setPath('userData',resolve(process.env.FREYALAB_USER_DATA))
let window:BrowserWindow|undefined,windowReady:Promise<void>|undefined,docs:Documents,analytics:SqlService,presets:ChartPresets,settings:SettingsStore,updates:UpdatesService,settingsStartupNotice:string|undefined,quitting=false,quitRequested=false,closingWindow=false
let menuState:ApplicationUiState={activeId:null,mode:'split',focus:'none',locked:false,canEdit:false},menuSettings:SettingsState,menuRecents:string[]=[],menuSignature=''
const nativeEdits=new MenuNativeEdits()
const closePreparation=new WindowClosePreparation(),applicationClose=new ApplicationWindowClose(closePreparation)
const waiting:string[]=[]
const id=z.uuid(),path=z.string().min(1).max(32768), text=z.string().max(20*1024*1024), rows=z.array(z.string().max(100)).max(2000000)
const csvView=z.enum(['table','text'])
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
function applicationContext():ApplicationMenuContext {
 const documents=docs?[...docs.records.values()].map(({info:{id,name,kind,readonly,dirty,csvView}})=>({id,name,kind,readonly,dirty,...(kind==='csv'?{csvView:csvView??'table'}:{})})):[]
 return{...menuState,documents,recents:menuRecents,theme:menuSettings.values.tema,sidebar:menuSettings.values.barraLateral.visible,development:!app.isPackaged,showDevTools:menuSettings.values.avanzado.herramientasDeDesarrollo,updatesReady:true}
}
function refreshApplicationMenu(){
 const context=applicationContext(),signature=languageState().language+'\n'+menuFingerprint(context)
 if(signature===menuSignature)return;menuSignature=signature
 Menu.setApplicationMenu(Menu.buildFromTemplate(applicationMenu(context,(id,argument)=>{const recent=id==='file.openRecent'&&typeof argument==='number'?context.recents[argument]:undefined;void dispatchApplicationCommand(id,argument,recent).catch(error=>window?.webContents.send('freya:event',{type:'error',message:error.message}))})))
}
async function refreshMenuRecents(){menuRecents=z.array(path).safeParse(await docs.recents()).data??[];refreshApplicationMenu()}
async function dispatchApplicationCommand(id:string,argument?:string|number,recent?:string){
 const command=applicationCommandSchema.parse({id,...(argument!==undefined?{argument}:{})})
 const target=await createApplicationWindow()
 if(id==='file.openRecent'){
  if(!recent)return;docs.grants.add(resolve(recent))
  try{await openPaths([recent])}catch(error){
   if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error
   try{await removeMissingRecent(recent)}catch{throw new Error(t('menu.file.missingRecentUnchanged',{name:basename(recent)}))}
   await refreshMenuRecents();target.webContents.send('freya:event',{type:'recents'});throw new Error(t('menu.file.missingRecent',{name:basename(recent)}))
  }
  await refreshMenuRecents();return
 }
 if(id==='window.zoom'){if(target.isMaximized())target.unmaximize();else target.maximize();return}
 const context=applicationContext(),document=context.documents.find(document=>document.id===context.activeId)
 const nonce=nativeEdits.issue(target.webContents.id,id,context.canEdit!==false&&(context.focus==='field'||context.focus==='sql'||!document?.readonly))
 target.webContents.send('freya:command',{...command,...(nonce?{nonce}:{})})
}
function changedSettings(state:SettingsState,explicitLanguage=false):SettingsState {
 menuSettings=state
 if(explicitLanguage||state.values.idioma!==languageState().preference){const language=changeLanguage(state.values.idioma);window?.webContents.send('freya:event',{type:'language',language})}
 window?.webContents.send('freya:event',{type:'settings',settings:state})
 refreshApplicationMenu()
 return state
}
async function handle(operation:string,args:unknown[]){
 const [a,b,c,d]=args
 switch(operation){
 case'application:state':{const [state]=z.tuple([applicationUiStateSchema]).parse(args);menuState={...state,locked:closingWindow||state.locked,activeId:state.activeId&&docs.records.has(state.activeId)?state.activeId:null};refreshApplicationMenu();return}
 case'application:shortcuts':z.tuple([]).parse(args);return{platform:process.platform,commands:applicationShortcutHelp(applicationContext())}
 case'language':return languageState()
 case'appInfo':z.tuple([]).parse(args);return applicationInfo()
 case'copyAppInfo':z.tuple([]).parse(args);return copyApplicationInfo()
 case'thirdPartyNotices':z.tuple([]).parse(args);return thirdPartyNotices()
 case'updates:check':{z.tuple([]).parse(args);const result=await updates.check();changedSettings(await settings.get());return result}
 case'updates:cancel':z.tuple([]).parse(args);updates.cancel();return
 case'updates:skip':{const[version]=z.tuple([z.string().max(256)]).parse(args);return changedSettings(await updates.skip(version))}
 case'updates:remind':z.tuple([]).parse(args);return changedSettings(await updates.remind())
 case'updates:open':{const[url]=z.tuple([z.string().max(2048)]).parse(args);if(!releaseUrl(url))throw new Error(t('updates.error.invalid'));await shell.openExternal(url);return}
 case'settings:get':{z.tuple([]).parse(args);const state=await settings.get();return changedSettings(settingsStartupNotice&&!state.notice?{...state,notice:settingsStartupNotice}:state)}
 case'settings:set':{const [patch]=z.tuple([z.unknown()]).parse(args),state=await settings.set(patch);settingsStartupNotice=undefined;return changedSettings(state,typeof patch==='object'&&patch!==null&&Object.hasOwn(patch,'idioma'))}
 case'settings:migrate':{const [previous]=z.tuple([legacySettingsInputSchema]).parse(args);return changedSettings(await settings.migrate(previous))}
 case'settings:reset':{z.tuple([]).parse(args);const state=await resetSettings(settings,window);if(!state)return null;settingsStartupNotice=undefined;return changedSettings(state,true)}
 case'recents:clear':z.tuple([]).parse(args);return clearRecents(window)
 case'settings:showDataFolder':z.tuple([]).parse(args);return showDataFolder()
 case'setLanguage':{const [preference]=z.tuple([z.enum(['sistema','es','en'])]).parse(args);changedSettings(await settings.set({idioma:preference}),true);settingsStartupNotice=undefined;return languageState()}
 case'open':{const result=await dialog.showOpenDialog(window!,{title:t('dialog.open.title'),buttonLabel:t('dialog.open.button'),properties:['openFile','multiSelections'],filters:[{name:t('dialog.open.filter'),extensions:['md','markdown','txt','mmd','mermaid','csv','tsv']}]});for(const p of result.filePaths)docs.grants.add(resolve(p));return result.canceled?[]:openPaths(result.filePaths)}
 case'openPaths':return openPaths(z.array(path).max(100).parse(a))
 case'csvOpen':{const target=path.parse(a),view=csvView.parse(b);if(!await docs.allowed(target))throw new Error(t('csvText.openAuthorized'));const previous=new Map([...docs.records].map(([key,record])=>[key,record.info.csvView??'table'])),document=await docs.open(target,view);if(previous.has(document.id)&&previous.get(document.id)!==document.csvView)analytics.forget(document.id);window?.webContents.send('freya:event',{type:'opened',document});return document}
 case'csvView':{const key=id.parse(a),before=docs.info(key).csvView,document=await docs.setCsvView(key,csvView.parse(b),z.enum(['save','discard']).optional().parse(c));if(before!==document.csvView)analytics.forget(key);return document}
 case'csvViewInfo':{const target=path.parse(a);if(!await docs.allowed(target))throw new Error(t('csvText.openAuthorized'));return docs.csvViewInfo(target)}
 case'new':return docs.create(z.enum(['markdown','text','mermaid','csv']).parse(a) as Kind)
 case'folder':{if(process.env.FREYALAB_TEST==='1'&&process.env.FREYALAB_TEST_FOLDER){const folder=resolve(process.env.FREYALAB_TEST_FOLDER);docs.roots.add(folder);return folder}const result=await dialog.showOpenDialog(window!,{title:t('dialog.folder.title'),buttonLabel:t('dialog.open.button'),properties:['openDirectory']});if(result.canceled)return null;docs.roots.add(result.filePaths[0]);return result.filePaths[0]}
 case'tree':return docs.tree(path.parse(a))
 case'findFiles':return docs.findFiles(path.parse(a),z.string().min(1).max(500).parse(b))
 case'cancelFileSearch':return docs.cancelFileSearch()
 case'listTags':return docs.listTags(path.parse(a))
 case'cancelTagList':return docs.cancelTagList()
 case'documents':return[...docs.records.keys()].map(key=>docs.info(key))
 case'update':return docs.update(id.parse(a),text.parse(b))
 case'save':return docs.save(id.parse(a),z.boolean().optional().parse(b))
 case'close':{const key=id.parse(a),closed=await docs.close(key);if(closed)analytics.forget(key);return closed}
 case'reload':return docs.reload(id.parse(a))
 case'copyTable':{docs.requireTable(id.parse(a));const options=tableExport.parse(b),format=z.enum(['tsv','markdown']).parse(c),output=await docs.table.call<string>(format==='markdown'?'markdown':'clipboard',a,options);if(Buffer.byteLength(output,'utf8')>8*1024*1024)throw new Error('La copia supera 8 MiB. Reduce la selección o expórtala.');await clipboard.writeText(output);return}
 case'pasteTable':{docs.requireTable(id.parse(a));const selected=range.parse(b);await docs.table.call('rangePreview',a,{type:'range',range:selected,operation:'clear'});const content=await clipboard.readText();if(Buffer.byteLength(content,'utf8')>8*1024*1024)throw new Error('El portapapeles supera 8 MiB. Pega un bloque menor.');return content}
 case'transformPreview':docs.requireTable(id.parse(a));return docs.table.call('transformPreview',a,structureEdit.parse(b) as TableTransformEdit)
 case'rangePreview':docs.requireTable(id.parse(a));return docs.table.call('rangePreview',a,rangeEdit.parse(b) as TableRangeEdit)
 case'rangeClipboard':docs.requireTable(id.parse(a));return docs.table.call('rangeClipboard',a,range.parse(b) as TableRange)
 case'page':docs.requireTable(id.parse(a));return docs.table.call('page',a,query.parse(b) as TableQuery)
 case'viewStart':docs.requireTable(id.parse(a));return docs.table.call('viewStart',a,viewRequest.parse(b))
 case'viewState':docs.requireTable(id.parse(a));return docs.table.call('viewState',a)
 case'viewCancel':docs.requireTable(id.parse(a));return docs.table.call('viewCancel',a,z.uuid().parse(b))
 case'viewClear':docs.requireTable(id.parse(a));return docs.table.call('viewClear',a)
 case'edit':return docs.tableEdit(id.parse(a),edits.parse(b) as TableEdit)
 case'options':return docs.tableOptions(id.parse(a),z.object({encoding:z.enum(['utf8','utf16le','win1252']).optional(),delimiter:z.enum([',',';','\t','|']).optional(),header:z.boolean().optional()}).parse(b) as TableOptions)
 case'undo':return docs.undo(id.parse(a),z.boolean().optional().parse(b))
 case'chartPresets':return presets.list()
 case'saveChartPreset':{const document=docs.info(id.parse(a));if(!isTableDocument(document))throw new Error('Abre un CSV para guardar el gráfico.');return presets.save(b,document.headers??[])}
 case'deleteChartPreset':return presets.delete(id.parse(a))
 case'sqlRun':return analytics.run(z.object({requestId:z.uuid(),sources:z.array(z.object({id,revision:z.number().int().nonnegative(),query:query.optional(),where:conditionGroup.optional()})).min(1).max(4),sql:z.string().trim().min(1).max(100000)}).parse(a))
 case'sqlPage':return analytics.page(id.parse(a),z.number().int().min(0).max(9999).parse(b))
 case'sqlCancel':return analytics.cancel(id.parse(a))
 case'analyzeColumn':docs.requireTable(id.parse(a));return docs.table.call('analyzeColumn',a,z.object({column:col,otherColumn:col.optional(),query:query.optional(),revision:z.number().int().nonnegative(),requestId:z.uuid(),frequencyOffset:z.number().int().min(0).max(2000000),duplicatesOnly:z.boolean(),bins:z.number().int().min(1).max(30)}).parse(b))
 case'cancelAnalysis':docs.requireTable(id.parse(a));return docs.table.call('cancelAnalysis',a,z.uuid().parse(b))
 case'operation':{const key=id.parse(a),outcome=await operateDocument(docs,key,operationRequest.parse(b));if(outcome?.document)window?.webContents.send('freya:event',{type:'opened',document:outcome.document});return outcome}
 case'cancelOperation':docs.requireTable(id.parse(a));return docs.table.call('cancelOperation',z.uuid().parse(b))
 case'cancelOpen':return docs.table.call('cancelOpen',id.parse(a)) // el documento aún no está en `records`: se está abriendo
 case'stats':docs.requireTable(id.parse(a));return docs.table.call('stats',a,rows.nullable().parse(b),z.array(col).max(100000).parse(c),z.object({requestId:z.uuid(),revision:z.number().int().nonnegative(),range:range.optional()}).optional().parse(d))
 case'markdown':docs.requireTable(id.parse(a));return docs.table.call('markdown',a,tableExport.parse(b) as TableExport)
 case'exportChartResult':return exportChartResult(docs,analytics,id.parse(a),z.object({requestId:id,revision:z.number().int().nonnegative(),configuration:chartConfiguration,format:z.enum(['csv','json','md']),protectFormulas:z.boolean()}).strict().parse(b))
 case'exportGraphic':return exportGraphic(docs,id.parse(a),z.object({format:z.enum(['svg','png','pdf']),svg:text.min(1),revision:z.number().int().nonnegative()}).strict().parse(b))
 case'export':return exportDocument(docs,id.parse(a),z.object({format:z.enum(['pdf','html','svg','png','csv','tsv']),html:text.optional(),svg:text.optional(),table:tableExport.optional()}).parse(b) as ExportRequest)
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
function openSystemPaths(paths:string[],focus=false){
 if(quitting)return
 if(!docs||closingWindow){waiting.push(...paths);return}
 for(const path of paths)docs.grants.add(resolve(path))
 void createApplicationWindow().then(target=>{if(focus){target.show();target.focus()}return openPaths(paths)}).then(()=>refreshMenuRecents()).catch(error=>{try{window?.webContents.send('freya:event',{type:'error',message:error.message})}catch{}})
}
function resumeSystemPaths(){if(!quitting&&!closingWindow&&waiting.length)openSystemPaths(waiting.splice(0),true)}
app.on('open-file',(event,path)=>{event.preventDefault();openSystemPaths([path])})
if(!app.requestSingleInstanceLock()&&process.env.FREYALAB_TEST!=='1')app.quit()
app.on('second-instance',(_event,argv)=>{openSystemPaths(argv.filter(p=>/\.(md|markdown|csv|tsv|mmd|mermaid|txt)$/i.test(p)&&!p.startsWith('-')),true)})
app.whenReady().then(async()=>{
 app.setName('FreyaLab')
 initializeLanguage(app.getPreferredSystemLanguages(),process.env)
 settings=new SettingsStore(join(app.getPath('userData'),'settings.json'))
 updates=new UpdatesService(settings,app.getVersion())
 const initialSettings=await settings.get();settingsStartupNotice=initialSettings.notice;menuSettings=initialSettings
 initializeLanguage(app.getPreferredSystemLanguages(),process.env,initialSettings.values.idioma)
 docs=new Documents(event=>{window?.webContents.send('freya:event',event);refreshApplicationMenu()})
 presets=new ChartPresets(join(app.getPath('userData'),'chart-presets.json'))
 analytics=new SqlService(docs,progress=>window?.webContents.send('freya:event',{type:'analysis',progress}))
 ipcMain.handle('freya',async(event,operation,...args)=>{assertSender(event);try{const result=await handle(z.string().max(100).parse(operation),args);if(['open','openPaths','save','recover','recents:clear'].includes(operation)){await refreshMenuRecents();if(operation==='recents:clear')window?.webContents.send('freya:event',{type:'recents'})}else if(['new','close','reload'].includes(operation))refreshApplicationMenu();return result}catch(e){throw new Error(e instanceof z.ZodError?t('error.invalidOperation'):(e as Error).message)}})
 ipcMain.on('freya:drop',(event,paths)=>{assertSender(event);for(const p of z.array(path).max(100).parse(paths))docs.grants.add(resolve(p))})
 ipcMain.on('freya:paste-plain',event=>{
  try{assertSender(event);if(!event.sender.isDestroyed())event.sender.pasteAndMatchStyle()}
  catch{if(window&&!window.isDestroyed())window.webContents.send('freya:event',{type:'error',message:'No pude pegar sin formato.'})}
 })
 ipcMain.on('freya:menu-native',(event,...args)=>{try{assertSender(event);const[nonce]=nativeEditArguments.parse(args),method=nativeEdits.take(event.sender.id,nonce);if(method)event.sender[method]()}catch{window?.webContents.send('freya:event',{type:'error',message:t('menu.edit.error')})}})
 ipcMain.on('freya:close-prepared',(event,...args)=>{try{assertSender(event);const[nonce,ready]=closePreparedArguments.parse(args);closePreparation.complete(event.sender.id,nonce,ready)}catch{}})
 ipcMain.on('freya:menu-native-done',(event,...args)=>{try{assertSender(event);const[nonce]=nativeEditArguments.parse(args);nativeEdits.finish(event.sender.id,nonce)}catch{}})
 await refreshMenuRecents();await createApplicationWindow()
 void updates.startup().then(async result=>{changedSettings(await settings.get());if(result)window?.webContents.send('freya:event',{type:'updates',update:result})}).catch(()=>{})
 const initial=process.env.FREYALAB_TEST==='1'&&process.env.FREYALAB_TEST_OPEN?JSON.parse(process.env.FREYALAB_TEST_OPEN):process.argv.slice(1).filter(p=>/\.(md|markdown|csv|tsv|mmd|mermaid|txt)$/i.test(p))
 for(const p of [...waiting.splice(0),...initial]){docs.grants.add(resolve(p));await openPaths([p]).catch(e=>window?.webContents.send('freya:event',{type:'error',message:e.message}))}
 await refreshMenuRecents()
}).catch(e=>{console.error(e);app.exit(1)})
async function createApplicationWindow():Promise<BrowserWindow>{
 if(window&&!window.isDestroyed()){await windowReady;return window}
 window=new BrowserWindow({icon:appIcon,width:1440,height:900,minWidth:720,minHeight:600,title:'FreyaLab',backgroundColor:'#18181b',autoHideMenuBar:false,titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',webPreferences:{preload:join(here,'../preload/index.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}})
 const target=window,contents=target.webContents.id;target.on('closed',()=>{closePreparation.clear(contents);nativeEdits.clear(contents);if(window===target){window=undefined;windowReady=undefined;menuState={activeId:null,mode:menuState.mode,focus:'none',locked:false,canEdit:false};refreshApplicationMenu()}})
 if(process.platform!=='darwin')window.setMenuBarVisibility(true)
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}))
 window.webContents.on('will-navigate',(event)=>event.preventDefault())
 window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false))
 if(!process.env.ELECTRON_RENDERER_URL)window.webContents.session.webRequest.onBeforeRequest((details,callback)=>{
  if(details.url.startsWith('data:')||details.url.startsWith('devtools:')){callback({cancel:false});return}
  try{const asset=relative(resolve(here,'../renderer'),fileURLToPath(details.url));callback({cancel:asset.startsWith('..')||isAbsolute(asset)})}catch{callback({cancel:true})}
 })
 window.on('close',event=>{if(quitting)return;event.preventDefault();requestWindowClose()})
 const url=process.env.ELECTRON_RENDERER_URL;windowReady=url?window.loadURL(url):window.loadFile(join(here,'../renderer/index.html'));await windowReady
 return window
}
function requestWindowClose(){void closeApplicationWindow().catch(error=>{quitRequested=false;dialog.showErrorBox(t('dialog.close.error'),error.message)})}
function closingNotice(owner:BrowserWindow|undefined,kind:'error'|'notice',message:string){
 try{if(owner&&!owner.isDestroyed()){owner.webContents.send('freya:event',{type:'close-status',closingKind:kind,message});return}}catch{}
 try{if(kind==='error')dialog.showErrorBox(t('dialog.close.error'),message);else void dialog.showMessageBox({type:'info',message}).catch(()=>{})}catch{}
}
async function closeApplicationWindow(){
 if(closingWindow||quitting)return
 const owner=window,wasLocked=menuState.locked
 const closed=await applicationClose.close({owner,currentWindow:()=>window,documents:docs,settings,
  started:()=>{closingWindow=true;menuState={...menuState,locked:true};refreshApplicationMenu()},
  ended:()=>{closingWindow=false;try{if(window===owner&&owner&&!owner.isDestroyed()){menuState={...menuState,locked:wasLocked};refreshApplicationMenu()}}catch{}finally{if(!quitting)resumeSystemPaths()}},
  failed:message=>{quitRequested=false;closingNotice(owner,'error',message)},
  cancelled:saved=>{quitRequested=false;closingNotice(owner,'notice',saved.length===1?t('menu.close.cancelledSaved',{name:saved[0]}):saved.length?t('menu.close.cancelledSavedMany',{names:formatList(saved.map(name=>`«${name}»`))}):t('menu.close.cancelled'))},
  finish:async ids=>{
   for(const id of ids)analytics.forget(id)
   if(process.platform==='darwin'&&!quitRequested){owner?.destroy();return}
   analytics.stop();await docs.shutdown()
   if(window!==owner||owner?.isDestroyed())throw new Error(t('menu.close.changed'))
   quitting=true;owner?.destroy();app.quit()
  },
 })
 if(!closed)quitRequested=false
}
app.on('activate',()=>{if(docs&&!window&&!quitting&&!quitRequested&&!closingWindow)void createApplicationWindow().catch(error=>dialog.showErrorBox(t('dialog.close.error'),error.message))})
app.on('window-all-closed',()=>{if(process.platform!=='darwin'&&!quitting)app.quit()})
app.on('before-quit',event=>{if(quitting||!docs)return;event.preventDefault();quitRequested=true;if(window&&!window.isDestroyed())window.close();else requestWindowClose()})
