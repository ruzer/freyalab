import type {MenuItemConstructorOptions} from 'electron'
import {basename,win32} from 'node:path'
import {t} from '../shared/i18n'

type Group='app'|'file'|'edit'|'search'|'view'|'mode'|'theme'|'go'|'window'|'help'|'export'|'dynamic'
type Requirement='always'|'document'|'editable'|'editing'|'textEditing'|'selection'|'markdown'|'csv'|'undo'|'redo'|'tabs'|'updates'|'recents'
type Focus='none'|'editor'|'field'|'grid'|'cell'|'sql'
export interface ApplicationMenuContext {
 documents:readonly {id:string;name:string;kind:'markdown'|'mermaid'|'csv'|'text';readonly:boolean;dirty:boolean;csvView?:'table'|'text'}[]
 recents:readonly string[];activeId:string|null;mode:'edit'|'split'|'preview';theme:'system'|'light'|'dark';sidebar:boolean;focus:Focus;locked:boolean;development:boolean
 canUndo?:boolean;canRedo?:boolean;canEdit?:boolean;hasSelection?:boolean;inCodeMirror?:boolean;modal?:boolean;showDevTools?:boolean;updatesReady?:boolean;docxAvailable?:boolean
}
interface Command {
 id:string;labelKey:string;group:Group;accelerator?:string;requires:Requirement;separator?:boolean;macOnly?:boolean
 role?:MenuItemConstructorOptions['role'];submenu?:'recent'|'export'|'search'|'mode'|'theme';developer?:boolean;format?:string
}
const command=(id:string,group:Group,accelerator?:string,requires:Requirement='always',extra:Partial<Command>={}):Command=>({id,labelKey:`menu.${id}`,group,accelerator,requires,...extra})

// Única tabla de acciones: menú, validación de ID y ayuda consumen estas entradas.
export const applicationCommands:readonly Command[]=[
 command('app.about','app'),command('app.updates','app',undefined,'updates'),
 command('app.settings','app','CommandOrControl+,','always',{separator:true}),
 command('app.services','app',undefined,'always',{role:'services',macOnly:true,separator:true}),
 command('app.hide','app','Command+H','always',{role:'hide',macOnly:true,separator:true}),
 command('app.hideOthers','app','Alt+Command+H','always',{role:'hideOthers',macOnly:true}),
 command('app.showAll','app',undefined,'always',{role:'unhide',macOnly:true}),
 command('app.quit','app','CommandOrControl+Q','always',{role:'quit',separator:true}),
 command('file.newMarkdown','file','CommandOrControl+N'),command('file.newMermaid','file','CommandOrControl+Shift+N'),command('file.newCsv','file','CommandOrControl+Alt+N'),
 command('file.open','file','CommandOrControl+O','always',{separator:true}),command('file.openFolder','file','CommandOrControl+Shift+O'),
 command('file.recents','file',undefined,'always',{submenu:'recent'}),
 command('file.close','file','CommandOrControl+W','document',{separator:true}),command('file.save','file','CommandOrControl+S','editable'),command('file.saveAs','file','CommandOrControl+Shift+S','editable'),
 command('file.exports','file',undefined,'editable',{submenu:'export'}),
 command('file.openRecent','dynamic'),command('file.clearRecents','dynamic',undefined,'recents'),command('window.document','dynamic'),
 command('edit.undo','edit','CommandOrControl+Z','undo'),command('edit.redo','edit','CommandOrControl+Shift+Z','redo'),
 command('edit.cut','edit','CommandOrControl+X','editing',{separator:true}),command('edit.copy','edit','CommandOrControl+C','selection'),command('edit.paste','edit','CommandOrControl+V','editing'),
 command('edit.pastePlain','edit','CommandOrControl+Alt+Shift+V','textEditing'),command('edit.selectAll','edit','CommandOrControl+A','selection'),
 command('edit.commandPalette','edit','CommandOrControl+K','csv'),
 command('edit.search','edit',undefined,'document',{separator:true,submenu:'search'}),
 command('search.document','search','CommandOrControl+F','document'),command('search.replace','search','CommandOrControl+Shift+F','editable'),command('search.folder','search'),
 command('view.mode','view',undefined,'markdown',{submenu:'mode'}),
 command('view.mode.edit','mode',undefined,'markdown'),command('view.mode.split','mode',undefined,'markdown'),command('view.mode.preview','mode',undefined,'markdown'),
 command('view.sidebar','view','CommandOrControl+B'),command('view.outline','view',undefined,'markdown'),
 command('view.theme','view',undefined,'always',{submenu:'theme'}),
 command('view.theme.system','theme'),command('view.theme.light','theme'),command('view.theme.dark','theme'),
 command('view.actualSize','view','CommandOrControl+0','always',{separator:true,role:'resetZoom'}),
 command('view.zoomIn','view','CommandOrControl+Plus','always',{role:'zoomIn'}),command('view.zoomOut','view','CommandOrControl+-','always',{role:'zoomOut'}),
 command('view.fullscreen','view','F11','always',{role:'togglefullscreen'}),
 command('view.reload','view','CommandOrControl+R','always',{separator:true,role:'reload',developer:true}),
 command('view.devTools','view','Alt+CommandOrControl+I','always',{role:'toggleDevTools',developer:true}),
 command('go.row','go','CommandOrControl+G','csv'),command('go.nextTab','go','Control+Tab','tabs'),command('go.previousTab','go','Control+Shift+Tab','tabs'),
 command('go.files','go',undefined,'always',{separator:true}),command('go.outline','go',undefined,'markdown'),
 command('window.minimize','window','CommandOrControl+M','always',{role:'minimize'}),command('window.zoom','window',undefined,'always',{role:'zoom'}),command('window.front','window',undefined,'always',{role:'front',macOnly:true}),
 command('help.documentation','help'),command('help.shortcuts','help'),command('help.releaseNotes','help'),command('help.issue','help'),command('help.licenses','help',undefined,'always',{separator:true}),command('help.security','help'),
 ...(['svg','png','pdf','html','csv','tsv','docx'] as const).map(format=>command(`export.${format}`,'export',undefined,'editable',{format})),
]
export const applicationCommandIds=applicationCommands.filter(item=>!item.submenu).map(item=>item.id)
export function isApplicationCommand(id:string){return applicationCommandIds.includes(id)}

const active=(context:ApplicationMenuContext)=>context.documents.find(document=>document.id===context.activeId)
function enabled(requirement:Requirement,context:ApplicationMenuContext):boolean{
 const document=active(context),editing=context.focus!=='none'
 if(context.locked)return false
 switch(requirement){
  case'document':return !!document
  case'editable':return !!document&&!document.readonly
  case'editing':return !(document?.kind==='markdown'&&context.focus==='editor'&&(context.mode==='preview'||context.inCodeMirror===false))&&editing&&context.canEdit!==false&&(context.focus==='field'||context.focus==='sql'||!document?.readonly)
  case'textEditing':return context.focus!=='grid'&&enabled('editing',context)
  case'selection':return editing
  case'markdown':return document?.kind==='markdown'
  case'csv':return document?.kind==='csv'&&document.csvView!=='text'
  case'undo':return editing&&context.canEdit!==false&&(context.focus==='field'||context.focus==='sql'||!document?.readonly)&&(context.canUndo??(['field','cell','sql','grid'].includes(context.focus)))
  case'redo':return editing&&context.canEdit!==false&&(context.focus==='field'||context.focus==='sql'||!document?.readonly)&&(context.canRedo??(['field','cell','sql','grid'].includes(context.focus)))
  case'tabs':return context.documents.length>1
  case'updates':return !!context.updatesReady
  case'recents':return context.recents.length>0
  default:return true
 }
}
function accelerator(item:Command,context:ApplicationMenuContext,platform:NodeJS.Platform=process.platform){
 // El editor Markdown ya posee Mod+B; el menú conserva el contexto previo.
 if(item.id==='view.sidebar'&&context.focus==='editor'&&context.inCodeMirror!==false&&active(context)?.kind==='markdown')return undefined
 if(item.id==='go.row'&&(context.focus==='sql'||context.inCodeMirror))return undefined
 if((item.id==='go.row'||item.id==='edit.commandPalette')&&!enabled('csv',context))return undefined
 if(item.id==='edit.redo'&&platform==='win32')return 'Control+Y'
 if(item.id==='view.fullscreen'&&platform==='darwin')return 'Control+Command+F'
 return item.accelerator
}
function available(item:Command,context:ApplicationMenuContext){return enabled(item.requires,context)&&(!context.modal||item.group==='edit'&&!item.submenu||!!item.role)}
function formats(context:ApplicationMenuContext){
 const document=active(context)
 if(!document||document.readonly)return[]
 if(document.kind==='markdown')return['pdf','html',...(context.docxAvailable?['docx']:[])]
 if(document.kind==='mermaid')return['svg','png','pdf']
 if(document.kind==='csv'&&document.csvView!=='text')return['csv','tsv']
 return[]
}

export function applicationMenu(context:ApplicationMenuContext,dispatch:(id:string,argument?:string|number)=>void,platform:NodeJS.Platform=process.platform):MenuItemConstructorOptions[]{
 const mac=platform==='darwin',visible=(item:Command)=>(!item.macOnly||mac)&&(!item.developer||context.development||context.showDevTools)
 const definitions=new Map(applicationCommands.map(item=>[item.id,item]))
 const label=(name:string)=>mac?name:name.replaceAll('&','&&')
 function item(definition:Command):MenuItemConstructorOptions{
  const result:MenuItemConstructorOptions={id:definition.id,label:t(definition.labelKey),enabled:available(definition,context),accelerator:accelerator(definition,context,platform)}
  if(definition.submenu){
   if(definition.submenu==='recent'){
    result.submenu=context.recents.slice(0,10).map((path,index)=>({id:`recent.${index}`,label:label((platform==='win32'?win32.basename:basename)(path)),enabled:!context.locked,click:()=>dispatch('file.openRecent',index)}))
    if(result.submenu.length)result.submenu.push({type:'separator'})
    result.submenu.push(item(definitions.get('file.clearRecents')!))
   }else if(definition.submenu==='export'){result.submenu=formats(context).map(format=>item(definitions.get(`export.${format}`)!));result.enabled=!!result.enabled&&result.submenu.length>0}
   else result.submenu=group(definition.submenu)
  }else if(definition.role&&!(definition.id==='window.zoom'&&!mac))result.role=definition.role
  else result.click=()=>dispatch(definition.id)
  if(definition.group==='mode'){result.type='radio';result.checked=definition.id===`view.mode.${context.mode}`}
  if(definition.group==='theme'){result.type='radio';result.checked=definition.id===`view.theme.${context.theme}`}
  if(definition.id==='view.sidebar'){result.type='checkbox';result.checked=context.sidebar}
  return result
 }
 function group(name:Group){
  const result:MenuItemConstructorOptions[]=[]
  for(const definition of applicationCommands.filter(command=>command.group===name&&visible(command))){
   if(definition.separator&&result.length)result.push({type:'separator'})
   result.push(item(definition))
  }
  return result
 }
 const file=group('file'),help=group('help'),window=group('window')
 if(!mac){file.push({type:'separator'},item(definitions.get('app.settings')!),item(definitions.get('app.quit')!));help.push({type:'separator'},item(definitions.get('app.about')!),item(definitions.get('app.updates')!))}
 if(context.documents.length){window.push({type:'separator'},...context.documents.map(document=>({id:`document.${document.id}`,label:label(document.name),type:'checkbox' as const,checked:document.id===context.activeId,enabled:!context.locked,click:()=>dispatch('window.document',document.id)})))}
 return[
  ...(mac?[{label:t('about.product'),submenu:group('app')}]:[]),
  {label:t('menu.file'),submenu:file},{label:t('menu.edit'),submenu:group('edit')},
  {label:t('menu.view'),submenu:group('view')},{label:t('menu.go'),submenu:group('go')},
  {label:t('menu.window'),submenu:window},{label:t('menu.help'),submenu:help},
 ]
}

export function applicationShortcutHelp(context:ApplicationMenuContext,platform:NodeJS.Platform=process.platform){
 return applicationCommands.filter(item=>!item.submenu&&item.group!=='dynamic'&&(!item.macOnly||platform==='darwin')&&(!item.developer||context.development||context.showDevTools)).map(item=>({id:item.id,label:t(item.labelKey),accelerator:accelerator(item,context,platform)??null,enabled:available(item,context)}))
}
