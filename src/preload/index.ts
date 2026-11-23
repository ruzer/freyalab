import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { FreyaAPI, AppEvent } from '../shared/types'
import {closePrepareCommand,closeAbortCommand,contextEditCommands,type ContextEditCommand,type ApplicationCommand} from '../shared/application'
import {invocationMessage} from './invoke-error'
const invoke=async(operation:string,...args:unknown[])=>{try{return await ipcRenderer.invoke('freya',operation,...args)}catch(error){throw new Error(invocationMessage(error))}}
// El atajo requiere una pulsación real; el puente no ofrece lectura del portapapeles.
window.addEventListener('keydown',event=>{
 if(!event.isTrusted||event.isComposing||!(event.metaKey||event.ctrlKey)||!event.shiftKey||event.altKey||event.key.toLowerCase()!=='v')return
 event.preventDefault();event.stopImmediatePropagation()
 window.dispatchEvent(new Event('freya-paste-plain'))
 ipcRenderer.send('freya:paste-plain')
},true)
// El permiso solo existe durante la activación real de ese botón; no atraviesa una microtarea.
let contextEdit:ContextEditCommand|undefined
window.addEventListener('click',event=>{
 if(!event.isTrusted||!(event.target instanceof Element))return
 const item=event.target.closest('button[role="menuitem"][data-application-edit]'),id=item?.getAttribute('data-application-edit')
 if(!item||!contextEditCommands.some(command=>command===id))return
 event.preventDefault();event.stopImmediatePropagation()
 contextEdit=id as ContextEditCommand
 try{item.dispatchEvent(new Event('freya-context-edit',{bubbles:true}))}finally{contextEdit=undefined}
},true)
const api:FreyaAPI={
 contextEdit(id,state){if(!contextEdit||contextEdit!==id)return Promise.resolve();contextEdit=undefined;return invoke('application:contextEdit',id,state)},
 setApplicationState:state=>invoke('application:state',state),applicationShortcuts:()=>invoke('application:shortcuts'),
 onCommand(callback){
  const listener=(_:unknown,event:ApplicationCommand&{nonce?:string})=>{
   if(event.id===closePrepareCommand||event.id===closeAbortCommand)return
   let active=true,used=false
   const delegate=()=>{if(!active||used||!event.nonce)return;used=true;if(event.id==='edit.pastePlain')window.dispatchEvent(new Event('freya-paste-plain'));ipcRenderer.send('freya:menu-native',event.nonce)}
   try{callback({id:event.id,...(event.argument!==undefined?{argument:event.argument}:{})},delegate)}finally{active=false;if(event.nonce)ipcRenderer.send('freya:menu-native-done',event.nonce)}
  }
  ipcRenderer.on('freya:command',listener);return()=>ipcRenderer.removeListener('freya:command',listener)
 },
 onPrepareClose(handlers){
  let current:string|undefined,live=true
  const listener=(_:unknown,event:unknown)=>{
   if(!event||typeof event!=='object'||Array.isArray(event))return
   const value=event as {id?:unknown;nonce?:unknown}
   if(Object.keys(value).length!==2||typeof value.nonce!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.nonce))return
   if(value.id===closeAbortCommand){if(value.nonce===current){current=undefined;handlers.aborted()}return}
   if(value.id!==closePrepareCommand||value.nonce===current)return
   const nonce=current=value.nonce
   const acknowledge=(ready:boolean)=>{if(live&&current===nonce)ipcRenderer.send('freya:close-prepared',nonce,ready===true)}
   try{void Promise.resolve(handlers.prepare()).then(ready=>acknowledge(ready===true),()=>acknowledge(false))}catch{acknowledge(false)}
  }
  ipcRenderer.on('freya:command',listener);return()=>{live=false;current=undefined;ipcRenderer.removeListener('freya:command',listener)}
 },
 appInfo:()=>invoke('appInfo'),copyAppInfo:()=>invoke('copyAppInfo'),thirdPartyNotices:()=>invoke('thirdPartyNotices'),
 checkUpdates:()=>invoke('updates:check'),cancelUpdates:()=>invoke('updates:cancel'),skipUpdate:version=>invoke('updates:skip',version),remindUpdate:()=>invoke('updates:remind'),openUpdate:url=>invoke('updates:open',url),
 settings:()=>invoke('settings:get'),setSettings:patch=>invoke('settings:set',patch),migrateSettings:values=>invoke('settings:migrate',values),
 resetSettings:()=>invoke('settings:reset'),clearRecents:()=>invoke('recents:clear'),showDataFolder:()=>invoke('settings:showDataFolder'),
 language:()=>invoke('language'),setLanguage:preference=>invoke('setLanguage',preference),
 open:()=>invoke('open'),openPaths:paths=>invoke('openPaths',paths),newDocument:kind=>invoke('new',kind),folder:()=>invoke('folder'),tree:path=>invoke('tree',path),findFiles:(root,query)=>invoke('findFiles',root,query),cancelFileSearch:()=>invoke('cancelFileSearch'),listTags:root=>invoke('listTags',root),cancelTagList:()=>invoke('cancelTagList'),
 csvOpen:(path,view)=>invoke('csvOpen',path,view),csvView:(id,view,decision)=>invoke('csvView',id,view,decision),csvViewInfo:path=>invoke('csvViewInfo',path),
 documentShow:id=>invoke('documentShow',id),fileShow:path=>invoke('fileShow',path),
 update:(id,text)=>invoke('update',id,text),save:(id,as)=>invoke('save',id,as),close:id=>invoke('close',id),reload:id=>invoke('reload',id),documents:()=>invoke('documents'),
 reopenTextEncoding:(id,encoding)=>invoke('reopenTextEncoding',id,encoding),saveTextEncoding:(id,encoding)=>invoke('saveTextEncoding',id,encoding),
 tableCopy:(id,options,format)=>invoke('copyTable',id,options,format),tablePaste:(id,range)=>invoke('pasteTable',id,range),
 chartPresets:()=>invoke('chartPresets'),saveChartPreset:(id,input)=>invoke('saveChartPreset',id,input),deleteChartPreset:id=>invoke('deleteChartPreset',id),
 sqlRun:request=>invoke('sqlRun',request),sqlPage:(requestId,offset)=>invoke('sqlPage',requestId,offset),sqlCancel:requestId=>invoke('sqlCancel',requestId),
 operation:(id,request)=>invoke('operation',id,request),cancelOperation:(id,requestId)=>invoke('cancelOperation',id,requestId),
 analyzeColumn:(id,request)=>invoke('analyzeColumn',id,request),cancelAnalysis:(id,requestId)=>invoke('cancelAnalysis',id,requestId),cancelOpen:id=>invoke('cancelOpen',id),
 transformPreview:(id,edit)=>invoke('transformPreview',id,edit),
 rangePreview:(id,edit)=>invoke('rangePreview',id,edit),rangeClipboard:(id,range)=>invoke('rangeClipboard',id,range),
 tablePage:(id,query)=>invoke('page',id,query),tableEdit:(id,edit)=>invoke('edit',id,edit),tableOptions:(id,options)=>invoke('options',id,options),undo:(id,redo)=>invoke('undo',id,redo),stats:(id,rows,columns,options)=>invoke('stats',id,rows,columns,options),tableMarkdown:(id,options)=>invoke('markdown',id,options),
 tableViewStart:(id,request)=>invoke('viewStart',id,request),tableViewState:id=>invoke('viewState',id),tableViewCancel:(id,requestId)=>invoke('viewCancel',id,requestId),tableViewClear:id=>invoke('viewClear',id),
 exportChartResult:(id,request)=>invoke('exportChartResult',id,request),
 exportGraphic:(id,request)=>invoke('exportGraphic',id,request),
 bibliography:(id,source)=>invoke('bibliography',id,source),
 pandocStatus:()=>invoke('pandocStatus'),pandocChoose:()=>invoke('pandocChoose'),pandocTest:()=>invoke('pandocTest'),
 export:(id,request)=>invoke('export',id,request),locateImage:(id,src)=>invoke('locateImage',id,src),image:async(id,src)=>{if(process.env.FREYALAB_TEST==='1'&&process.env.FREYALAB_TEST_IMAGE_DELAY_MS)await new Promise(resolve=>setTimeout(resolve,Number(process.env.FREYALAB_TEST_IMAGE_DELAY_MS)));return invoke('image',id,src)},openLink:url=>invoke('link',url),
 projectState:()=>invoke('project:state'),projectPickFolder:()=>invoke('project:pickFolder'),projectCancelCreate:()=>invoke('project:cancelCreate'),projectCreate:(name,suggested)=>invoke('project:create',name,suggested),projectClose:id=>invoke('project:close',id),projectShow:id=>invoke('project:show',id),projectRename:(id,name)=>invoke('project:rename',id,name),projectOpenRecent:path=>invoke('project:openRecent',path),projectForgetRecent:path=>invoke('project:forgetRecent',path),
 projectPickSource:path=>invoke('project:pickSource',path),projectInspectSource:(id,format)=>invoke('project:inspectSource',id,format),projectDiscardSourceDraft:()=>invoke('project:discardSourceDraft'),
 projectRegisterSource:(id,draft,format,request)=>invoke('project:registerSource',id,draft,format,request),projectReregisterSource:(id,source,request)=>invoke('project:reregisterSource',id,source,request),
 projectOpenSource:source=>invoke('project:openSource',source),projectShowSource:source=>invoke('project:showSource',source),projectForgetSource:(id,source)=>invoke('project:forgetSource',id,source),
 projectRelinkSource:(id,source,request)=>invoke('project:relinkSource',id,source,request),projectCancelSource:request=>invoke('project:cancelSource',request),
 projectRecipeTry:(id,draft,request)=>invoke('project:recipeTry',id,draft,request),projectRecipeCancel:request=>invoke('project:recipeCancel',request),
 projectRecipeAnalyze:(id,recipe,request)=>invoke('project:recipeAnalyze',id,recipe,request),
 projectRecipeExport:(id,recipe,request)=>invoke('project:recipeExport',id,recipe,request),projectRegisterResult:(id,result)=>invoke('project:registerResult',id,result),
 projectOpenResult:(id,result)=>invoke('project:openResult',id,result),projectShowResult:(id,result)=>invoke('project:showResult',id,result),projectResultSource:(id,result)=>invoke('project:resultSource',id,result),projectForgetResult:(id,result)=>invoke('project:forgetResult',id,result),
 projectSaveRecipe:(id,draft)=>invoke('project:saveRecipe',id,draft),projectRenameRecipe:(id,recipe,name)=>invoke('project:renameRecipe',id,recipe,name),projectRemoveRecipe:(id,recipe)=>invoke('project:removeRecipe',id,recipe),
 recents:()=>invoke('recents'),recoveries:()=>invoke('recoveries'),recover:id=>invoke('recover',id),discardRecovery:id=>invoke('discardRecovery',id),
 onEvent(callback){const listener=(_:unknown,event:AppEvent)=>callback(event);ipcRenderer.on('freya:event',listener);return()=>ipcRenderer.removeListener('freya:event',listener)},
 droppedPaths(files){const paths=Array.from(files).map(f=>webUtils.getPathForFile(f)).filter(Boolean);ipcRenderer.send('freya:drop',paths);return paths}
}
contextBridge.exposeInMainWorld('freya',api)
