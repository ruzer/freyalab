import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { FreyaAPI, AppEvent } from '../shared/types'
const invoke=(operation:string,...args:unknown[])=>ipcRenderer.invoke('freya',operation,...args)
const api:FreyaAPI={
 open:()=>invoke('open'),openPaths:paths=>invoke('openPaths',paths),newDocument:kind=>invoke('new',kind),folder:()=>invoke('folder'),tree:path=>invoke('tree',path),
 update:(id,text)=>invoke('update',id,text),save:(id,as)=>invoke('save',id,as),close:id=>invoke('close',id),reload:id=>invoke('reload',id),documents:()=>invoke('documents'),
 tablePage:(id,query)=>invoke('page',id,query),tableEdit:(id,edit)=>invoke('edit',id,edit),tableOptions:(id,options)=>invoke('options',id,options),undo:(id,redo)=>invoke('undo',id,redo),stats:(id,rows,columns)=>invoke('stats',id,rows,columns),tableMarkdown:(id,options)=>invoke('markdown',id,options),
 export:(id,request)=>invoke('export',id,request),image:(id,src)=>invoke('image',id,src),openLink:url=>invoke('link',url),
 recents:()=>invoke('recents'),recoveries:()=>invoke('recoveries'),recover:id=>invoke('recover',id),discardRecovery:id=>invoke('discardRecovery',id),
 onEvent(callback){const listener=(_:unknown,event:AppEvent)=>callback(event);ipcRenderer.on('freya:event',listener);return()=>ipcRenderer.removeListener('freya:event',listener)},
 droppedPaths(files){const paths=Array.from(files).map(f=>webUtils.getPathForFile(f)).filter(Boolean);ipcRenderer.send('freya:drop',paths);return paths}
}
contextBridge.exposeInMainWorld('freya',api)
