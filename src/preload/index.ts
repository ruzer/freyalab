import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { FreyaAPI, AppEvent } from '../shared/types'
import {invocationMessage} from './invoke-error'
const invoke=async(operation:string,...args:unknown[])=>{try{return await ipcRenderer.invoke('freya',operation,...args)}catch(error){throw new Error(invocationMessage(error))}}
// El atajo requiere una pulsación real; el puente no ofrece lectura del portapapeles.
window.addEventListener('keydown',event=>{
 if(!event.isTrusted||event.isComposing||!(event.metaKey||event.ctrlKey)||!event.shiftKey||event.altKey||event.key.toLowerCase()!=='v')return
 event.preventDefault();event.stopImmediatePropagation()
 window.dispatchEvent(new Event('freya-paste-plain'))
 ipcRenderer.send('freya:paste-plain')
},true)
const api:FreyaAPI={
 appInfo:()=>invoke('appInfo'),copyAppInfo:()=>invoke('copyAppInfo'),thirdPartyNotices:()=>invoke('thirdPartyNotices'),
 language:()=>invoke('language'),setLanguage:preference=>invoke('setLanguage',preference),
 open:()=>invoke('open'),openPaths:paths=>invoke('openPaths',paths),newDocument:kind=>invoke('new',kind),folder:()=>invoke('folder'),tree:path=>invoke('tree',path),findFiles:(root,query)=>invoke('findFiles',root,query),cancelFileSearch:()=>invoke('cancelFileSearch'),listTags:root=>invoke('listTags',root),cancelTagList:()=>invoke('cancelTagList'),
 csvOpen:(path,view)=>invoke('csvOpen',path,view),csvView:(id,view,decision)=>invoke('csvView',id,view,decision),csvViewInfo:path=>invoke('csvViewInfo',path),
 update:(id,text)=>invoke('update',id,text),save:(id,as)=>invoke('save',id,as),close:id=>invoke('close',id),reload:id=>invoke('reload',id),documents:()=>invoke('documents'),
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
 export:(id,request)=>invoke('export',id,request),locateImage:(id,src)=>invoke('locateImage',id,src),image:async(id,src)=>{if(process.env.FREYALAB_TEST==='1'&&process.env.FREYALAB_TEST_IMAGE_DELAY_MS)await new Promise(resolve=>setTimeout(resolve,Number(process.env.FREYALAB_TEST_IMAGE_DELAY_MS)));return invoke('image',id,src)},openLink:url=>invoke('link',url),
 recents:()=>invoke('recents'),recoveries:()=>invoke('recoveries'),recover:id=>invoke('recover',id),discardRecovery:id=>invoke('discardRecovery',id),
 onEvent(callback){const listener=(_:unknown,event:AppEvent)=>callback(event);ipcRenderer.on('freya:event',listener);return()=>ipcRenderer.removeListener('freya:event',listener)},
 droppedPaths(files){const paths=Array.from(files).map(f=>webUtils.getPathForFile(f)).filter(Boolean);ipcRenderer.send('freya:drop',paths);return paths}
}
contextBridge.exposeInMainWorld('freya',api)
