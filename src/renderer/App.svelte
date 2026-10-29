<script lang="ts">
 import {onMount,tick} from 'svelte'
 import {t,plural,setUILanguage,getUILanguage} from './lib/i18n.svelte'
 import {defaultSettings,type Settings,type SettingsPatch,type SettingsState} from '../shared/settings'
 import {loadSettings} from './lib/settings-client'
 import {Transaction} from '@codemirror/state'
 import {csvTextStatistics} from '../shared/csv-text'
 import {undo as undoText,redo as redoText,undoDepth,redoDepth} from '@codemirror/commands'
 import {EditorView} from '@codemirror/view'
 import {openSearchPanel} from '@codemirror/search'
 import {applicationEditingState,routeApplicationEdit} from './lib/application-editing'
 import {formatApplicationShortcut,type ApplicationCommand,type ApplicationShortcuts,type ApplicationUiState} from '../shared/application'
 import {ApplicationClosing,type ClosingNotice} from './lib/application-closing'
 import {assetTransaction} from './lib/asset-changes'
 import {createMarkdownSession,taskTransaction,type TaskReference,type MarkdownSession} from './lib/markdown-tasks'
 import appIcon from '../../build/icon.png'
 import {isTableDocument,CSV_TEXT_LIMIT,type CsvView,type CsvViewDecision,type CsvOpenError as CsvOpenIssue,type DocumentInfo,type Kind,type TreeEntry,type RecoveryEntry,type ExportRequest,type AssetChange} from '../shared/types'
 import Editor from './components/Editor.svelte'
 import MarkdownToolbar from './components/MarkdownToolbar.svelte'
 import TextStats from './components/TextStats.svelte'
 import type {TextSelection} from './lib/text-stats'
 import {lineFormatState} from './lib/markdown-commands'
 import Preview from './components/Preview.svelte'
 import Outline from './components/Outline.svelte'
 import Diagram from './components/Diagram.svelte'
 import CsvTable from './components/CsvTable.svelte'
 import CsvFileMenu from './components/CsvFileMenu.svelte'
 import CsvViewDialog from './components/CsvViewDialog.svelte'
 import CsvOpenError from './components/CsvOpenError.svelte'
 import Tree from './components/Tree.svelte'
 import AssetWarnings from './components/AssetWarnings.svelte'
 import AboutDialog from './components/AboutDialog.svelte'
 import SettingsDialog from './components/SettingsDialog.svelte'
 import ShortcutsDialog from './components/ShortcutsDialog.svelte'
 import Icon from './components/Icon.svelte'
 import {kindIcon,fileKind} from './lib/icons'
 import type {Heading} from './lib/render'
 import type {DiagramBlock} from './lib/diagram-diagnostics'
 import type {DiagramDiagnostics} from './lib/diagram-marks'
 import {normalizeTag} from '../shared/front-matter'
 import {tokensFileQuery,tagQueryToken} from '../shared/tag-query'
 import {matchHeadings,currentHeading as headingAtPosition,type EditorHeading} from './lib/outline'
 type SidebarTab='files'|'outline'
 const initialSettings=defaultSettings()
 let preferencesState=$state<SettingsState>({values:initialSettings,readonly:false,migrationPending:true});let settingsReady:Promise<void>|undefined,settingsNotice:string|undefined,settingsWrites=0
 let nextMarkdownMode:Settings['markdown']['modoInicial']|undefined=initialSettings.markdown.modoInicial
 function applySettings(state:SettingsState){
  if(state.values.markdown.modoInicial!==preferencesState.values.markdown.modoInicial)nextMarkdownMode=state.values.markdown.modoInicial
  preferencesState=state;if(!settingsWrites){theme=state.values.tema;sidebar=state.values.barraLateral.visible;sidebarWidth=state.values.barraLateral.ancho;sidebarTab=state.values.barraLateral.pestana;split=state.values.division}
  if(state.notice!==settingsNotice){settingsNotice=state.notice;if(state.notice)notify(state.notice)}
 }
 async function savePreferences(patch:SettingsPatch){settingsWrites++;try{await settingsReady;applySettings(await window.freya.setSettings(patch))}finally{settingsWrites--;if(!settingsWrites)applySettings(preferencesState)}}
 function remember(patch:SettingsPatch){void action(()=>savePreferences(patch))}
 async function resetPreferences(){const state=await window.freya.resetSettings();if(!state)return false;applySettings(state);return true}
 async function clearRecentList(){const cleared=await window.freya.clearRecents();if(cleared)recent=[];return cleared}
 let external=$state<string[]>([])
 let documents=$state<DocumentInfo[]>([]),activeId=$state(''),folderPath=$state(''),entries=$state<TreeEntry[]>([]),recent=$state<string[]>([]),recoveries=$state<RecoveryEntry[]>([])
 let sidebar=$state(initialSettings.barraLateral.visible),sidebarWidth=$state(initialSettings.barraLateral.ancho),split=$state(initialSettings.division),filterFiles=$state('')
 let sidebarTab=$state<SidebarTab>(initialSettings.barraLateral.pestana)
 let filesScroll=$state<HTMLDivElement>(),indexScroll=$state<HTMLDivElement>()
 const sidebarScroll={files:0,outline:0}
 let folderTags=$state<{tag:string;count:number}[]>([]),tagsBusy=$state(false),tagsLimited=$state(false),tagsRefresh=$state(0),tagGeneration=0,tagFolder=''
 const activeTags=$derived(new Set(tokensFileQuery(filterFiles).filter(token=>token.tag).map(token=>normalizeTag(token.value))))
 let fileMatches=$state<TreeEntry[]>([]),fileSearchBusy=$state(false),fileSearchLimited=$state(false),fileSearchGeneration=0
 let mode=$state<'edit'|'preview'|'split'>(initialSettings.markdown.modoInicial),headings=$state<Heading[]>([]),headingDocument=$state(''),status=$state('Todo se procesa en este equipo'),toast=$state(''),toastKind=$state<'info'|'error'>('info'),busy=$state(false)
 let theme=$state<Settings['tema']>(initialSettings.tema),systemDark=$state(matchMedia('(prefers-color-scheme: dark)').matches)
 const dark=$derived(theme==='system'?systemDark:theme==='dark')
 const active=$derived(documents.find(doc=>doc.id===activeId))
 const csvText=$derived(active?.kind==='csv'&&active.csvView==='text')
 const csvTextInfo=$derived(csvText?csvTextStatistics(active?.text??''):undefined)
 let csvWrap=$state(false),csvSpaces=$state(false),csvOptions=$state<HTMLDetailsElement>()
 $effect(()=>{activeId;csvText;csvWrap=false;csvSpaces=false})
 function textOption(action:'wrap'|'spaces'|'line'){if(action==='wrap')csvWrap=!csvWrap;else if(action==='spaces')csvSpaces=!csvSpaces;if(csvOptions)csvOptions.open=false;if(action==='line')editor?.goToLine();else editor?.focus()}
 let csvFileMenu=$state<{path:string;x:number;y:number;origin:HTMLElement}|null>(null)
 let csvChange=$state<{id:string;name:string;view:CsvView;busy:boolean;message:string}|null>(null)
 let csvFailure=$state<CsvOpenIssue|null>(null),csvOpening=$state(false),csvFailureOrigin:HTMLElement|undefined
 let assetBusy=$state<Record<string,string>>({})
 let assetWarnings=$state<Record<string,string[]>>({})
 let applicationClosing=$state(false),closingNotice=$state<ClosingNotice|null>(null),compositionActive=false
 const editingLocked=$derived(applicationClosing||!active||active.readonly||!!assetBusy[active.id]||!!csvChange)
 const effectiveSidebarTab=$derived(active?.kind==='markdown'?sidebarTab:'files')
 const indexVisible=$derived(sidebar&&effectiveSidebarTab==='outline'&&active?.kind==='markdown')
 const outlineHeadings=$derived(headingDocument===activeId?headings:[])
 let appDialog=$state<'about'|'licenses'|'settings'|'shortcuts'|null>(null)
 let shortcutInfo=$state<ApplicationShortcuts>(),applicationReady=false,applicationQueued=false,applicationSignature='',shortcutContext=''
 let newMenu=$state(false),exportMenu=$state(false),exportScope=$state<'all'|'filtered'|'selection'>('all')
 let collapsedByDocument=$state<Record<string,Set<string>>>({})
 let previewHeading=$state<string|undefined>()
 let headingsSource=$state(''),editorSource=$state(''),editorHeadings=$state<EditorHeading[]>([]),editorLine=$state(0),editorDocument=$state('')
 const headingPositions=$derived(headingDocument===activeId&&editorDocument===activeId&&headingsSource===active?.text&&editorSource===active?.text?matchHeadings(outlineHeadings,editorHeadings):new Map<string,number>())
 const editorPositions=$derived([...headingPositions].map(([id,top])=>({id,top})).sort((a,b)=>a.top-b.top))
 const editorHeading=$derived(headingAtPosition(editorPositions,editorLine,0,Infinity))
 let markdownState=$state(lineFormatState('',0)),textSelection=$state<TextSelection|null>(null)
 let editor=$state<Editor>(),preview=$state<Preview>(),diagram=$state<Diagram>(),csv=$state<CsvTable>()
 let diagramCandidates=$state<{id:string;source:string;blocks:DiagramBlock[];complete:boolean}|undefined>()
 let diagnostics=$state<{id:string;value:DiagramDiagnostics}|undefined>()
 function receiveBlocks(id:string){return(blocks:DiagramBlock[],source:string,complete:boolean)=>{if(id===activeId&&source===active?.text)diagramCandidates={id,source,blocks,complete}}}
 function receiveDiagnostics(id:string){return(value:DiagramDiagnostics)=>{if(id!==activeId||value.source!==active?.text)return;diagnostics={id,value}}}
 $effect(()=>{const current=diagnostics,owner=editor;if(current?.id===activeId&&current.value.source===active?.text)owner?.setDiagnostics(current.value)})
 const pending=new Map<string,Promise<unknown>>()
 const textSessions=new Map<string,MarkdownSession>()
 // Apertura de un archivo grande en curso (se indexa de una pasada): progreso y botón para cancelar.
 let opening=$state<{id:string;phase:string}|null>(null)
 async function cancelOpening(){const id=opening?.id;if(id)await window.freya.cancelOpen(id).catch(()=>{})}
 let toastTimer:ReturnType<typeof setTimeout>
 function error(message:string){opening=null;const clean=message.replace(/^Error:\s*/,'');if(csvFailure?.message===clean)return;toastKind='error';toast=clean;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast='',7000)}
 function notify(message:string){toastKind='info';status=message;toast=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast='',3500)}
 function toggleSidebar(){sidebar=!sidebar;remember({barraLateral:{visible:sidebar}})}
 async function selectSidebarTab(tab:SidebarTab,focus=false){
  if(tab==='outline'&&active?.kind!=='markdown')return
  if(active?.kind==='markdown'){sidebarTab=tab;remember({barraLateral:{pestana:tab}})}
  if(focus){await tick();document.getElementById(`freya-${tab}-tab`)?.focus()}
 }
 function sidebarKeydown(event:KeyboardEvent){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
  event.preventDefault()
  const tab=event.key==='Home'?'files':event.key==='End'?'outline':effectiveSidebarTab==='files'?'outline':'files'
  void selectSidebarTab(active?.kind==='markdown'?tab:'files',true)
 }
 function toggleIndex(){if(indexVisible)void selectSidebarTab('files');else{sidebar=true;remember({barraLateral:{visible:true}});void selectSidebarTab('outline')}}
 async function filterByTag(tag:string){
  if(!folderPath){notify('Abre una carpeta para filtrar por etiqueta');return}
  sidebar=true;remember({barraLateral:{visible:true}});await selectSidebarTab('files')
  if(!tokensFileQuery(filterFiles).some(token=>token.tag&&normalizeTag(token.value)===normalizeTag(tag)))filterFiles=[filterFiles.trim(),tagQueryToken(tag)].filter(Boolean).join(' ')
  await tick();document.querySelector<HTMLInputElement>('.sidebar-search input')?.focus()
 }
 async function toggleTag(tag:string){
  const found=tokensFileQuery(filterFiles).find(token=>token.tag&&normalizeTag(token.value)===normalizeTag(tag))
  if(!found){await filterByTag(tag);return}
  filterFiles=[filterFiles.slice(0,found.from).trim(),filterFiles.slice(found.to).trim()].filter(Boolean).join(' ')
  await tick();document.querySelector<HTMLInputElement>('.sidebar-search input')?.focus()
 }
 function receiveCurrent(docId:string){return(value:string|undefined)=>{if(activeId===docId)previewHeading=value}}
 function receiveHeadings(docId:string){return(value:Heading[],source:string)=>{if(activeId===docId){headings=value;headingDocument=docId;headingsSource=source}}}
 function receiveEditorHeadings(id:string){return(value:EditorHeading[],source:string)=>{if(activeId===id){editorHeadings=value;editorSource=source;editorDocument=id}}}
 function receiveEditorLine(id:string){return(from:number)=>{if(activeId===id)editorLine=from}}
 function selectHeading(heading:Heading){
  if(mode!=='edit'){preview?.scrollToHeading(heading.id);return}
  if(editor?.isComposing())return
  const from=headingPositions.get(heading.id)
  if(from===undefined||!editor?.goToHeading(from,headingsSource))notify('Ese título no se puede localizar en el editor')
 }
 let activationGeneration=0
 async function prepareDocumentAction(id:string){
  const before=documents.find(document=>document.id===id)
  if(!before)throw new Error(t('document.actionChanged'))
  const wasActive=activeId===id,owner=wasActive&&isTableDocument(before)?csv:undefined
  await owner?.flushEditing();await pending.get(id)
  const after=documents.find(document=>document.id===id)
  if(!after||before.csvView!==after.csvView||wasActive&&activeId!==id||owner&&csv!==owner)throw new Error(t('document.actionChanged'))
 }
 const closingFlow=new ApplicationClosing({
  snapshot:()=>({documents,activeId,busy:busy||csvOpening||!!csvChange||Object.values(assetBusy).some(Boolean),modal:!!appDialog||!!document.querySelector('dialog[open]'),composing:compositionActive||!!editor?.isComposing()}),
  prepare:prepareDocumentAction,locked:value=>applicationClosing=value,notice:value=>{if(value?.kind==='error')toast='';closingNotice=value}
 })
 function placeClosingNotice(node:HTMLElement){
  const focused=document.activeElement instanceof Element?document.activeElement.closest('dialog[open]'):null
  const parent=focused??Array.from(document.querySelectorAll('dialog[open]')).at(-1)??document.body
  parent.appendChild(node);return{destroy:()=>node.remove()}
 }
 function activate(id:string){
  const generation=++activationGeneration
  if(activeId===id)return
  const previous=activeId
  void action(async()=>{
   if(previous&&documents.some(document=>document.id===previous))await prepareDocumentAction(previous)
   if(generation!==activationGeneration||activeId!==previous||id&&!documents.some(document=>document.id===id))return
   activeId=id;if(documents.find(document=>document.id===id)?.kind==='markdown'&&nextMarkdownMode!==undefined){mode=nextMarkdownMode;nextMarkdownMode=undefined}diagramCandidates=undefined;diagnostics=undefined;headings=[];headingDocument='';previewHeading=undefined;headingsSource='';editorSource='';editorHeadings=[];editorLine=0;editorDocument=''
  })
 }
 $effect(()=>{
  const tab=effectiveSidebarTab,shown=sidebar,target=tab==='files'?filesScroll:indexScroll
  if(shown&&target)void tick().then(()=>{if(sidebar&&effectiveSidebarTab===tab&&target.isConnected)target.scrollTop=sidebarScroll[tab]})
 })
 function textSession(doc:DocumentInfo){
  let session=textSessions.get(doc.id)
  if(!session){session=createMarkdownSession(doc.text??'');textSessions.set(doc.id,session)}
  return session
 }
 $effect(()=>{
  const doc=active
  if(doc?.kind==='markdown'&&mode==='preview'){const selection=textSession(doc).state.selection.main;textSelection=selection.empty?null:{from:selection.from,to:selection.to}}
 })
 function receiveText(id:string){return(transactions:readonly Transaction[])=>{
  const session=textSessions.get(id);if(!session||!transactions.length)return
  let current=session.state
  for(const transaction of transactions){if(transaction.startState!==current)return;current=transaction.state}
  session.state=current;session.receive?.(transactions)
  if(transactions.some(transaction=>transaction.docChanged))updateText(id,current.sliceDoc())
 }}
 function toggleTask(id:string,snapshot:string,reference:TaskReference){
  const doc=documents.find(value=>value.id===id)
  if(!doc||id!==activeId||doc.kind!=='markdown'||doc.readonly||assetBusy[id])return false
  const session=textSession(doc),transaction=doc.text===snapshot?taskTransaction(session.state,snapshot,reference):undefined
  if(!transaction){notify('La lista cambió. Espera a que se actualice la vista previa y vuelve a intentarlo.');return false}
  receiveText(id)([transaction]);return true
 }
 async function searchText(){if(active?.kind==='markdown'&&mode==='preview'){mode='edit';await tick()}editor?.search()}
 function merge(doc:DocumentInfo,focus=false,assetUpdate?:{source:string;changes:AssetChange[];undoable:boolean}){
  const old=documents.find(value=>value.id===doc.id);if(old&&old.csvView!==doc.csvView){exportMenu=false;external=external.filter(value=>value!==doc.id);status=doc.name}
  const fresh=!old,session=textSessions.get(doc.id)
  if(session&&doc.text!==undefined&&doc.text!==session.state.sliceDoc()){const transaction=assetUpdate?assetTransaction(session.state,assetUpdate.source,assetUpdate.changes,doc.text,assetUpdate.undoable):session.state.update({changes:{from:0,to:session.state.doc.length,insert:doc.text},annotations:Transaction.addToHistory.of(false)});if(!transaction)throw new Error('El documento cambió durante la operación. Se conserva tu edición; revisa la copia guardada antes de continuar.');session.state=transaction.state;session.receive?.([transaction])}
  if(opening?.id===doc.id)opening=null;documents=fresh?[...documents,doc]:documents.map(d=>d.id===doc.id?doc:d);if(focus||!activeId)activate(doc.id)}
 async function action<T>(operation:()=>Promise<T>):Promise<T|undefined>{try{return await operation()}catch(e){error(e instanceof Error?e.message:String(e))}}
 async function open(){await action(async()=>{await settingsReady;for(const doc of await window.freya.open())merge(doc,true);recent=await window.freya.recents()})}
 async function openPath(path:string){await action(async()=>{await settingsReady;for(const doc of await window.freya.openPaths([path]))merge(doc,true)})}
 async function finishCsvView(doc:DocumentInfo){merge(doc,true);notify(t('csvText.viewAnnouncement',{view:t(doc.csvView==='text'?'csvText.text':'csvText.table')}));await tick();document.querySelector<HTMLButtonElement>('[data-csv-view] button[aria-pressed="true"]')?.focus()}
 async function chooseCsvView(view:CsvView,path?:string){await action(async()=>{
  const existing=path?documents.find(doc=>doc.path===path):active;if(existing?.id===active?.id&&existing&&isTableDocument(existing))await csv?.flushEditing();if(existing)await pending.get(existing.id)
  const current=existing?documents.find(doc=>doc.id===existing.id):undefined
  if(current?.dirty&&(current.csvView??'table')!==view){csvChange={id:current.id,name:current.name,view,busy:false,message:''};return}
  const doc=current?await window.freya.csvView(current.id,view):await window.freya.csvOpen(path!,view);await finishCsvView(doc)
 })}
 async function resolveCsvChange(decision:CsvViewDecision|'cancel'){
  const request=csvChange;if(!request||request.busy)return
  if(decision==='cancel'){csvChange=null;await tick();document.querySelector<HTMLButtonElement>('[data-csv-view] button[aria-pressed="true"]')?.focus();return}
  csvChange={...request,busy:true,message:''}
  try{await pending.get(request.id);const doc=await window.freya.csvView(request.id,request.view,decision);csvChange=null;await finishCsvView(doc)}
  catch(error){csvChange={...request,busy:false,message:error instanceof Error?error.message:String(error)}}
 }
 function receiveCsvError(issue:CsvOpenIssue){csvFailureOrigin=document.activeElement instanceof HTMLElement?document.activeElement:undefined;csvFailure=issue;opening=null;if(toast===issue.message)toast=''}
 async function dismissCsvError(){csvFailure=null;await tick();if(csvFailureOrigin?.isConnected)csvFailureOrigin.focus();else document.querySelector<HTMLButtonElement>('.tabs [role="tab"][aria-selected="true"]')?.focus()}
 async function openFailedCsv(){
  const issue=csvFailure;if(!issue||csvOpening)return
  csvOpening=true
  try{const doc=await window.freya.csvOpen(issue.path,'text');await finishCsvView(doc);if(csvFailure===issue)csvFailure=null;await tick();if(issue.reportedLine){if(editor?.goToPhysicalLine(issue.reportedLine))notify(t('csvText.error.openedLine',{line:issue.reportedLine}));else{editor?.focus();notify(t('csvText.error.noLine'))}}else editor?.focus()}
  catch(failure){error(failure instanceof Error?failure.message:String(failure))}finally{csvOpening=false}
 }
 function csvContext(event:MouseEvent|KeyboardEvent,path:string){if(!/\.(csv|tsv)$/i.test(path))return;event.preventDefault();const origin=event.currentTarget as HTMLElement,rect=origin.getBoundingClientRect();csvFileMenu={path,origin,x:event instanceof MouseEvent?event.clientX:rect.left,y:event instanceof MouseEvent?event.clientY:rect.bottom}}
 function closeCsvContext(restoreFocus:boolean){const origin=csvFileMenu?.origin;csvFileMenu=null;if(restoreFocus)origin?.focus()}
 async function openFolder(){await action(async()=>{await settingsReady;const path=await window.freya.folder();if(path){folderPath=path;entries=await window.freya.tree(path);sidebar=true;remember({barraLateral:{visible:true}})}})}
 async function create(kind:Kind){newMenu=false;await action(async()=>{await settingsReady;merge(await window.freya.newDocument(kind),true)})}
 function updateText(id:string,text:string){documents=documents.map(d=>d.id===id?{...d,text,dirty:true}:d);const previous=pending.get(id)??Promise.resolve();const task=previous.catch(()=>{}).then(()=>window.freya.update(id,text)).then(doc=>{const current=documents.find(d=>d.id===id);if(current?.text===text)merge(doc)}).catch(e=>{error(String(e));throw e});pending.set(id,task);void task.then(()=>{if(pending.get(id)===task)pending.delete(id)},()=>{})}
 async function openStatisticsReport(text:string){await action(async()=>{await settingsReady;if(new TextEncoder().encode(text).byteLength>10*1024*1024)throw new Error('El informe supera el límite de edición de 10 MiB. Reduce el alcance del análisis.');const doc=await window.freya.newDocument('markdown');merge(doc,true);updateText(doc.id,text);await pending.get(doc.id)})}
 // Las rutas del diálogo y del documento pueden usar alias distintos del sistema.
 async function save(as=false){
  if(!active||editingLocked)return
  const id=active.id,markdown=active.kind==='markdown'
  if(markdown&&editor?.isComposing()){notify('Termina de escribir antes de guardar el documento.');return}
  if(markdown)assetBusy[id]='Guardando…'
  try{await action(async()=>{
   await prepareDocumentAction(id);const snapshot=documents.find(doc=>doc.id===id)?.text??'',saved=await window.freya.save(id,as)
   if(saved){const {assets,...doc}=saved;merge(doc,false,assets?{source:snapshot,changes:assets.changes,undoable:false}:undefined);external=external.filter(value=>value!==id);if(doc.kind==='markdown')tagsRefresh++
    if(assets){if(assets.warnings.length)assetWarnings[id]=assets.warnings;else delete assetWarnings[id]}
    notify(['Archivo guardado',...(assets?.copied?[`${assets.copied===1?'Se copió':'Se copiaron'} ${assets.copied} ${assets.copied===1?'imagen':'imágenes'}`]:[]),...(assets?.warnings.length?[assets.warnings.length===1?'1 imagen no se copió':`${assets.warnings.length} imágenes no se copiaron`]:[])].join(' · '))
   }
  })}finally{delete assetBusy[id]}
 }
 async function locateImage(id:string,snapshot:string,source:string){
  const doc=documents.find(doc=>doc.id===id)
  if(!doc||id!==activeId||doc.readonly||assetBusy[id])return
  if(doc.text!==snapshot){notify('La vista previa cambió. Espera a que termine de actualizarse y vuelve a buscar la imagen.');return}
  if(!doc.path){notify('Guarda el documento para poder insertar imágenes');return}
  if(editor?.isComposing()){notify('Termina de escribir antes de buscar la imagen.');return}
  assetBusy[id]='Buscando imagen…'
  try{await action(async()=>{
   await pending.get(id);const found=await window.freya.locateImage(id,source)
   if(found){const {assets,...updated}=found;merge(updated,false,assets?{source:snapshot,changes:assets.changes,undoable:true}:undefined);notify('Imagen copiada. Guarda el documento para conservar la nueva referencia.')}
  })}finally{delete assetBusy[id];if(activeId===id){await tick();if(mode==='preview')preview?.focus();else editor?.focus()}}
 }
 async function reload(id:string){if(assetBusy[id])return;await action(async()=>{merge(await window.freya.reload(id));external=external.filter(value=>value!==id)})}
 async function close(id:string){if(assetBusy[id])return;await action(async()=>{await prepareDocumentAction(id);if(await window.freya.close(id)){const index=documents.findIndex(d=>d.id===id);documents=documents.filter(d=>d.id!==id);textSessions.delete(id);delete collapsedByDocument[id];delete assetWarnings[id];if(activeId===id)activate(documents[Math.max(0,index-1)]?.id??'')}})}
 async function undo(redo=false){if(!active||editingLocked)return;if(isTableDocument(active))await csv?.undoEdit(redo);else if(active.kind==='markdown'){const id=active.id,session=textSession(active);(redo?redoText:undoText)({state:session.state,dispatch:transaction=>receiveText(id)([transaction])})}else if(redo)editor?.redoEdit();else editor?.undoEdit()}
 async function exportDocument(format:ExportRequest['format']){
  if(!active||assetBusy[active.id]||csvText)return
  const id=active.id,kind=active.kind,table=csv,documentPreview=preview,documentDiagram=diagram
  exportMenu=false;busy=true
  try{await action(async()=>{
   await prepareDocumentAction(id)
   const request:ExportRequest={format}
   if(kind==='csv')request.table=table?.exportOptions(exportScope)
   else if(kind==='mermaid'){if(format==='svg'||format==='png')request.svg=await documentDiagram?.exportSVG();else request.html=await documentDiagram?.exportHTML()}
   else request.html=await documentPreview?.exportHTML()
   if(activeId!==id)throw new Error(t('document.actionChanged'))
   const missing=kind==='markdown'?documentPreview?.missingImages()??0:0,path=await window.freya.export(id,request)
   if(path)notify(`Exportado: ${path}`+(missing?` · ${missing===1?'1 imagen no se encontró':`${missing} imágenes no se encontraron`}; se exportó con su texto alternativo`:''))
  })}finally{busy=false}
 }
 async function recover(id:string){await action(async()=>{merge(await window.freya.recover(id),true);recoveries=await window.freya.recoveries()})}
 async function discard(id:string){await action(async()=>{await window.freya.discardRecovery(id);recoveries=await window.freya.recoveries()})}
 function keydown(event:KeyboardEvent){if(!event.defaultPrevented&&event.key==='Escape'&&csvOptions?.open&&event.target instanceof Node&&csvOptions.contains(event.target)){event.preventDefault();csvOptions.open=false;editor?.focus()}}
 function focusedElement(){return document.activeElement instanceof HTMLElement?document.activeElement:null}
 function previewEditing(target:HTMLElement|null){return active?.kind==='markdown'&&(mode==='preview'||!!target?.closest('.preview'))&&applicationEditingState(target).focus==='none'}
 function applicationState():ApplicationUiState{
  const target=focusedElement();let capabilities=applicationEditingState(target)
  if(previewEditing(target)&&active){const state=textSession(active).state;capabilities={focus:'editor',editable:!editingLocked,canUndo:undoDepth(state)>0,canRedo:redoDepth(state)>0,hasSelection:window.getSelection()?.isCollapsed===false}}
  // El visor pertenece a la pestaña; los diálogos de formulario siguen bloqueando el menú.
  return{activeId:active?.id??null,mode,focus:capabilities.focus,...(active?.kind==='csv'?{csvView:active.csvView??'table'}:{}),inCodeMirror:!!target?.closest('.cm-editor'),locked:applicationClosing||busy||!!assetBusy[activeId],modal:!!appDialog||!!document.querySelector('dialog[open]:not(.diagram-modal)'),canEdit:capabilities.editable??(capabilities.focus==='grid'&&!editingLocked),...(capabilities.canUndo!==undefined?{canUndo:capabilities.canUndo}:{}),...(capabilities.canRedo!==undefined?{canRedo:capabilities.canRedo}:{}),...(capabilities.hasSelection!==undefined?{hasSelection:capabilities.hasSelection}:{})}
 }
 function refreshShortcuts(){void window.freya.applicationShortcuts().then(value=>shortcutInfo=value).catch(()=>{})}
 function queueApplicationState(){
  if(!applicationReady||applicationQueued)return;applicationQueued=true
  queueMicrotask(()=>{applicationQueued=false;if(!applicationReady)return;const state=applicationState(),signature=JSON.stringify(state);if(signature===applicationSignature)return;applicationSignature=signature
   const context=JSON.stringify([state.activeId,state.csvView,state.focus,state.inCodeMirror,getUILanguage(),preferencesState.values.avanzado.herramientasDeDesarrollo]),refresh=context!==shortcutContext;shortcutContext=context
   void window.freya.setApplicationState(state).then(()=>{if(refresh)refreshShortcuts()}).catch(value=>error(String(value)))
  })
 }
 function commandTitle(id:string,label:string){const command=shortcutInfo?.commands.find(command=>command.id===id);return command?.accelerator?`${label} · ${formatApplicationShortcut(command.accelerator,shortcutInfo!.platform)}`:label}
 function searchFocusedEditor(replace=false){const root=focusedElement()?.closest<HTMLElement>('.cm-editor');if(!root)return false;const view=EditorView.findFromDOM(root);if(!view)return false;openSearchPanel(view);if(replace)view.dom.querySelector<HTMLInputElement>('.cm-search input[name="replace"]')?.focus();return true}
 function applicationCommand(command:ApplicationCommand,delegate:()=>void){
  const id=command.id,target=focusedElement()
  if(['edit.undo','edit.redo','edit.cut','edit.copy','edit.paste','edit.pastePlain','edit.selectAll'].includes(id)){
   if(previewEditing(target)){
    if(id==='edit.undo'||id==='edit.redo')void undo(id==='edit.redo')
    else if(id==='edit.copy')delegate()
    else if(id==='edit.selectAll'){const content=document.querySelector('.preview article');if(content){const range=document.createRange();range.selectNodeContents(content);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)}}
   }else routeApplicationEdit(id,target,{grid:id=>csv?.menuEdit(id),delegate})
   queueApplicationState();return
  }
  void action(async()=>{
   switch(id){
    case'app.about':appDialog='about';return
    case'help.licenses':appDialog='licenses';return
    case'app.settings':appDialog='settings';return
    case'help.shortcuts':appDialog='shortcuts';return
    case'file.newMarkdown':await create('markdown');return
    case'file.newMermaid':await create('mermaid');return
    case'file.newCsv':await create('csv');return
    case'file.open':await open();return
    case'file.openFolder':await openFolder();return
    case'file.close':if(active)await close(active.id);return
    case'file.save':await save();return
    case'file.saveAs':await save(true);return
    case'file.clearRecents':await clearRecentList();return
    case'window.document':if(typeof command.argument==='string'&&documents.some(document=>document.id===command.argument))activate(command.argument);return
    case'edit.commandPalette':csv?.applicationCommand(id);return
    case'search.document':case'search.replace':if(searchFocusedEditor(id==='search.replace'))return;if(active?.kind==='csv')csv?.applicationCommand(id);else{await searchText();if(id==='search.replace')searchFocusedEditor(true)}return
    case'search.folder':sidebar=true;remember({barraLateral:{visible:true}});await selectSidebarTab('files');if(!folderPath)await openFolder();await tick();document.querySelector<HTMLInputElement>('.sidebar-search input')?.focus();return
    case'view.mode.edit':mode='edit';return
    case'view.mode.split':mode='split';return
    case'view.mode.preview':mode='preview';return
    case'view.sidebar':toggleSidebar();return
    case'view.outline':toggleIndex();return
    case'view.theme.system':themeChange('system');return
    case'view.theme.light':themeChange('light');return
    case'view.theme.dark':themeChange('dark');return
    case'go.row':csv?.applicationCommand(id);return
    case'go.nextTab':case'go.previousTab':{if(documents.length){const index=documents.findIndex(document=>document.id===activeId);activate(documents[(index+(id==='go.nextTab'?1:documents.length-1))%documents.length].id)}return}
    case'go.files':sidebar=true;remember({barraLateral:{visible:true}});await selectSidebarTab('files',true);return
    case'go.outline':if(active?.kind==='markdown'){sidebar=true;remember({barraLateral:{visible:true}});await selectSidebarTab('outline',true)}return
    case'help.documentation':await window.freya.openLink('https://github.com/ruzer/freyalab#readme');return
    case'help.security':await window.freya.openLink('https://github.com/ruzer/freyalab/blob/main/SECURITY.md');return
    case'help.issue':await window.freya.openLink('https://github.com/ruzer/freyalab/issues/new');return
    case'help.releaseNotes':{const info=await window.freya.appInfo();await window.freya.openLink(`https://github.com/ruzer/freyalab/releases/tag/v${encodeURIComponent(info.version)}`);return}
    case'export.pdf':await exportDocument('pdf');return
    case'export.html':await exportDocument('html');return
    case'export.svg':await exportDocument('svg');return
    case'export.png':await exportDocument('png');return
    case'export.csv':await exportDocument('csv');return
    case'export.tsv':await exportDocument('tsv');return
   }
  })
 }
 function themeChange(value:string){if(value==='system'||value==='light'||value==='dark'){theme=value;remember({tema:value})}}
 function drop(event:DragEvent){event.preventDefault();const files=Array.from(event.dataTransfer?.files??[]);if(files.length)void action(async()=>{for(const doc of await window.freya.openPaths(window.freya.droppedPaths(files)))merge(doc,true)})}
 function resizeSidebar(event:PointerEvent){const start=event.clientX,width=sidebarWidth;const move=(e:PointerEvent)=>sidebarWidth=Math.min(420,Math.max(180,width+e.clientX-start));const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);remember({barraLateral:{ancho:sidebarWidth}})};window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop)}
 function resizeSplit(event:PointerEvent){const pane=(event.currentTarget as Element).parentElement!;const rect=pane.getBoundingClientRect();const move=(e:PointerEvent)=>split=Math.max(20,Math.min(80,(e.clientX-rect.left)/rect.width*100));const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);remember({division:split})};window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop)}
 onMount(()=>{
  const mq=matchMedia('(prefers-color-scheme: dark)'),change=()=>systemDark=mq.matches;mq.addEventListener('change',change)
  settingsReady=(async()=>{let storage:Storage|undefined;try{storage=window.localStorage}catch{}applySettings(await loadSettings(window.freya,storage));setUILanguage((await window.freya.language()).language)})()
  void settingsReady.then(()=>{applicationReady=true;queueApplicationState()}).catch(()=>{})
  const unsubscribeCommand=window.freya.onCommand(applicationCommand)
  const unsubscribeClose=window.freya.onPrepareClose({prepare:()=>closingFlow.prepare(),aborted:()=>{closingFlow.abort();if(closingNotice?.kind==='progress')closingNotice=null}})

  const contextEvents=['focusin','focusout','input','keyup','pointerup','selectionchange'] as const
  for(const event of contextEvents)document.addEventListener(event,queueApplicationState)
  void settingsReady.catch(value=>error(value instanceof Error?value.message:String(value)))
  void action(async()=>{await settingsReady;documents=await window.freya.documents();activate(documents[0]?.id??'');recent=await window.freya.recents();recoveries=await window.freya.recoveries()})
  const unsubscribe=window.freya.onEvent(event=>{if(event.type==='language'&&event.language){setUILanguage(event.language.language);refreshShortcuts()}else if(event.type==='recents'){void window.freya.recents().then(value=>recent=value).catch(value=>error(String(value)))}else if(event.type==='settings'&&event.settings)applySettings(event.settings);else if(event.type==='csv-open-error'&&event.csvOpenError)receiveCsvError(event.csvOpenError);else if(event.type==='opened'&&event.document){const document=event.document;void action(async()=>{await settingsReady;merge(document,true)})}else if(event.type==='changed'&&event.document){if(!pending.has(event.document.id))merge(event.document)}else if(event.type==='close-status'&&event.message)closingNotice={kind:event.closingKind??'notice',message:event.message};else if(event.type==='error')error(event.message??'Ocurrió un error');else if(event.type==='analysis'&&event.progress?.requestId.startsWith('open:'))opening={id:event.progress.requestId.slice(5),phase:event.progress.phase};else if(event.type==='external'){if(event.id&&!external.includes(event.id))external=[...external,event.id];notify(event.message??'El archivo cambió en otra aplicación. Al guardar se comprobarán los cambios.')}})
  return()=>{applicationReady=false;for(const event of contextEvents)document.removeEventListener(event,queueApplicationState);unsubscribeCommand();unsubscribeClose();closingFlow.abort();mq.removeEventListener('change',change);unsubscribe();clearTimeout(toastTimer)}
 })
 $effect(()=>{
  const root=folderPath,query=filterFiles.trim(),token=++fileSearchGeneration
  fileMatches=[];fileSearchLimited=false;fileSearchBusy=!!root&&!!query
  if(!root||!query)return
  const timer=setTimeout(async()=>{try{const result=await window.freya.findFiles(root,query);if(token!==fileSearchGeneration)return;fileMatches=result.entries;fileSearchLimited=result.limited}catch(e){if(token===fileSearchGeneration)error(String(e))}finally{if(token===fileSearchGeneration)fileSearchBusy=false}},150)
  return()=>{clearTimeout(timer);void window.freya.cancelFileSearch().catch(()=>{})}
 })
 $effect(()=>{
  tagsRefresh
  const root=folderPath,visible=sidebar&&effectiveSidebarTab==='files',token=++tagGeneration
  if(tagFolder!==root){tagFolder=root;folderTags=[];tagsLimited=false}
  tagsBusy=!!root&&visible
  if(!root||!visible)return
  const timer=setTimeout(async()=>{try{const result=await window.freya.listTags(root);if(token!==tagGeneration)return;folderTags=result.tags;tagsLimited=result.limited}catch(e){if(token===tagGeneration)error(String(e))}finally{if(token===tagGeneration)tagsBusy=false}},150)
  return()=>{clearTimeout(timer);void window.freya.cancelTagList().catch(()=>{})}
 })
 $effect(()=>{document.documentElement.classList.toggle('dark',dark)})
 $effect(()=>{document.documentElement.lang=getUILanguage()})
 $effect(()=>{active?.id;active?.readonly;mode;busy;applicationClosing;assetBusy[activeId];appDialog;getUILanguage();preferencesState.values.avanzado.herramientasDeDesarrollo;queueApplicationState()})
</script>
<svelte:window oncompositionstart={()=>compositionActive=true} oncompositionend={()=>compositionActive=false} onkeydown={keydown} ondragover={event=>event.preventDefault()} ondrop={drop}/>
<div class="app-shell" class:dark inert={applicationClosing}>
 <header class="toolbar">
  <div class="toolbar-left"><button class="icon-button" aria-label="Mostrar u ocultar explorador" title={commandTitle('view.sidebar',t('menu.view.sidebar'))} onclick={toggleSidebar}><Icon name="panel-left"/></button><span class="separator"></span><button title={commandTitle('file.open',t('toolbar.open'))} onclick={open}><Icon name="file"/> {t('toolbar.open')}</button><button title={commandTitle('file.openFolder',t('dialog.folder.title'))} aria-label={t('dialog.folder.title')} onclick={openFolder}><Icon name="folder-open"/></button><div class="menu-anchor"><button title={commandTitle('file.newMarkdown',t('menu.file.newMarkdown'))} onclick={()=>newMenu=!newMenu}><Icon name="plus"/> Nuevo <Icon name="chevron-down" size={12}/></button>{#if newMenu}<div class="dropdown">{#each [{kind:'markdown',label:'Documento Markdown'},{kind:'csv',label:'Tabla CSV'},{kind:'mermaid',label:'Diagrama Mermaid'},{kind:'text',label:'Texto plano'}] as item}<button onclick={()=>create(item.kind as Kind)}><span class="kind-{item.kind}"><Icon name={kindIcon[item.kind as Kind]}/></span> {item.label}</button>{/each}</div>{/if}</div></div>
  <div class="document-title">{#if active}<span class="tag">{active.kind==='markdown'?'MD':active.kind==='csv'?'CSV':active.kind==='mermaid'?'MMD':'TXT'}</span><strong class="truncate" title={active.path??active.name}>{active.name}</strong>{#if active.dirty}<span class="dirty-badge">● Editado</span>{/if}{:else}<img class="brand-mark small" src={appIcon} alt=""/><strong>FreyaLab</strong>{/if}</div>
  <div class="toolbar-right"><button class="icon-button" title={commandTitle('edit.undo',t('menu.edit.undo'))} aria-label="Deshacer" disabled={editingLocked} onclick={()=>undo()}><Icon name="undo-2"/></button><button class="icon-button" title={commandTitle('edit.redo',t('menu.edit.redo'))} aria-label="Rehacer" disabled={editingLocked} onclick={()=>undo(true)}><Icon name="redo-2"/></button><button disabled={editingLocked} title={commandTitle('file.save',t('toolbar.save'))} onclick={()=>save()}><Icon name="save"/> {t('toolbar.save')}</button><button disabled={editingLocked} title={commandTitle('file.saveAs',t('toolbar.saveAs'))} aria-label={t('toolbar.saveAs')} onclick={()=>save(true)}><Icon name="save-all"/></button><div class="menu-anchor"><button class="primary" disabled={editingLocked||busy||active?.kind==='text'||csvText} title={csvText?t('csvText.tableOnly'):'Exportar una copia'} onclick={()=>exportMenu=!exportMenu}><Icon name="upload"/> {busy?'Exportando…':'Exportar'} <Icon name="chevron-down" size={12}/></button>{#if exportMenu&&active}<div class="dropdown export-dropdown"><div class="dropdown-label">Exportar una copia</div>{#if active.kind==='csv'}<label>Contenido<select bind:value={exportScope}><option value="all">Documento completo</option><option value="filtered">Filas filtradas</option><option value="selection">Selección</option></select></label><button onclick={()=>exportDocument('csv')}>CSV</button><button onclick={()=>exportDocument('tsv')}>TSV</button>{:else}<button onclick={()=>exportDocument('pdf')}>Documento PDF</button>{#if active.kind==='mermaid'}<button onclick={()=>exportDocument('svg')}>Imagen SVG</button><button onclick={()=>exportDocument('png')}>Imagen PNG</button>{/if}<button onclick={()=>exportDocument('html')}>HTML autónomo</button><p style="max-width:240px;margin:8px 12px;font-size:11px;line-height:1.4;color:var(--muted);white-space:normal">Se exporta con colores claros para que se lea en papel y en cualquier pantalla</p>{/if}</div>{/if}</div></div>
 </header>
 <div class="workspace">
  {#if sidebar}<aside class="sidebar" style:width={`${sidebarWidth}px`}>
   <div class="sidebar-tabs" role="tablist" aria-label="Barra lateral">
    <button id="freya-files-tab" role="tab" onkeydown={sidebarKeydown} aria-selected={effectiveSidebarTab==='files'} aria-controls="freya-files-panel" tabindex={effectiveSidebarTab==='files'?0:-1} onclick={()=>selectSidebarTab('files')}>Archivos</button>
    <button id="freya-outline-tab" role="tab" onkeydown={sidebarKeydown} aria-selected={effectiveSidebarTab==='outline'} aria-controls="freya-outline-panel" aria-disabled={active?.kind!=='markdown'} disabled={active?.kind!=='markdown'} title={active?.kind!=='markdown'?'El índice está disponible en documentos Markdown':undefined} tabindex={effectiveSidebarTab==='outline'?0:-1} onclick={()=>selectSidebarTab('outline')}>Índice</button>
   </div>
   <div id="freya-files-panel" class="sidebar-tab-panel" role="tabpanel" aria-label="Archivos" hidden={effectiveSidebarTab!=='files'}><div class="sidebar-label">EXPLORADOR <button class="icon-button" title="Abrir carpeta" onclick={openFolder}><Icon name="plus" size={14}/></button></div><div class="sidebar-search"><Icon name="search" size={14}/><input aria-label="Buscar archivo" placeholder="Buscar archivo…" bind:value={filterFiles}/></div>{#if folderPath}<div class="folder-root" title={folderPath}><Icon name="chevron-down" size={12}/> <span class="folder-icon"><Icon name="folder-open" size={14}/></span> {folderPath.split(/[\\/]/).at(-1)}</div><div class="tree-scroll" bind:this={filesScroll} onscroll={event=>{if(event.currentTarget.clientHeight)sidebarScroll.files=event.currentTarget.scrollTop}}>{#if filterFiles.trim()}<div class="file-search-status" role="status">{fileSearchBusy?'Buscando en la carpeta…':fileSearchLimited?'Resultados limitados; acota la búsqueda.':`${fileMatches.length} archivos encontrados`}</div>{#each fileMatches as match (match.path)}{@const type=fileKind(match.name)}<button class="file-search-result" title={match.path} onclick={()=>openPath(match.path)} oncontextmenu={event=>csvContext(event,match.path)} onkeydown={event=>{if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey)csvContext(event,match.path)}}><span><span class="kind-{type.kind}"><Icon name={type.icon} size={14}/></span> {match.name}</span><small>{match.path.slice(folderPath.length+1)}</small></button>{/each}{:else}<Tree {entries} open={openPath} onerror={error} oncsvcontext={csvContext}/>{/if}</div>{#if tagsBusy}<p class="file-tag-status" role="status">Leyendo etiquetas…</p>{/if}{#if tagsLimited}<p class="file-tag-status" role="status">Lista parcial: la carpeta tiene demasiados archivos</p>{/if}{#if folderTags.length}<section class="file-tags" role="group" aria-label="Etiquetas"><div class="sidebar-label">ETIQUETAS <button class="icon-button" aria-label="Actualizar" title="Volver a leer las etiquetas guardadas" onclick={()=>tagsRefresh++}><span aria-hidden="true">↻</span></button></div><div class="file-tags-scroll">{#each folderTags as item (normalizeTag(item.tag))}<button aria-label={`${item.tag}, ${item.count} documentos`} aria-pressed={activeTags.has(normalizeTag(item.tag))} title={item.tag} onclick={()=>toggleTag(item.tag)}><span>{item.tag}</span><small>{item.count}</small></button>{/each}</div></section>{/if}{:else}<div class="sidebar-empty"><p>Explora tus archivos<br/>en un solo lugar.</p><button onclick={openFolder}>Abrir carpeta</button></div>{/if}</div>
   <div id="freya-outline-panel" class="sidebar-tab-panel" role="tabpanel" aria-label="Índice del documento" hidden={effectiveSidebarTab!=='outline'}>
    <div class="sidebar-label">EN ESTE DOCUMENTO</div>
    <Outline headings={outlineHeadings} current={mode==='edit'?editorHeading:previewHeading} collapsed={collapsedByDocument[activeId]??new Set()} oncollapse={next=>collapsedByDocument={...collapsedByDocument,[activeId]:next}} ready={headingDocument===activeId} shown={indexVisible} bind:container={indexScroll} onscroll={top=>sidebarScroll.outline=top} onselect={selectHeading} canselect={()=>mode!=='edit'||!editor?.isComposing()}/>
   </div>
   <div class="sidebar-bottom"><img class="brand-mark small" src={appIcon} alt=""/><button class="text-button" aria-label={t('about.title')} onclick={()=>appDialog='about'}>{t('about.product')}</button><span class="spacer"></span><select aria-label="Tema" value={theme} onchange={e=>themeChange(e.currentTarget.value)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></div>
  </aside><button class="resize-handle sidebar-handle" aria-valuenow={sidebarWidth} aria-valuemin="180" aria-valuemax="420" role="slider" aria-label="Ancho del explorador" aria-orientation="vertical" tabindex="0" onpointerdown={resizeSidebar} onkeydown={e=>{if(e.key==='ArrowRight')sidebarWidth=Math.min(420,sidebarWidth+10);if(e.key==='ArrowLeft')sidebarWidth=Math.max(180,sidebarWidth-10);if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();remember({barraLateral:{ancho:sidebarWidth}})}}}></button>{/if}
  <main class="main-area">
   {#if csvFailure}<CsvOpenError issue={csvFailure} busy={csvOpening} onopen={()=>void openFailedCsv()} onclose={()=>void dismissCsvError()}/>{/if}
   {#if documents.length}<div class="tabs" role="tablist" aria-label="Documentos abiertos">{#each documents as doc (doc.id)}<div class="tab" class:active={activeId===doc.id}><button role="tab" aria-selected={activeId===doc.id} onclick={()=>activate(doc.id)} title={doc.path??doc.name}><span class="tab-icon kind-{doc.kind}"><Icon name={kindIcon[doc.kind]} size={14}/></span>{doc.name}{#if doc.dirty}<span class="dirty-dot">●</span>{/if}</button><button class="tab-close" aria-label={`Cerrar ${doc.name}`} onclick={()=>close(doc.id)}><Icon name="x" size={14}/></button></div>{/each}</div>{/if}
   {#if active}
    {#if external.includes(active.id)}<div class="warning-banner external-banner"><span>Este archivo cambió fuera de FreyaLab.</span><button onclick={()=>reload(active!.id)}>Recargar</button><button onclick={()=>save(true)}>Guardar copia</button><button onclick={()=>external=external.filter(value=>value!==active!.id)}>Conservar mi edición</button></div>{/if}
    {#if assetWarnings[active.id]}<AssetWarnings warnings={assetWarnings[active.id]} ondismiss={()=>{delete assetWarnings[active!.id];if(mode==='preview')preview?.focus();else editor?.focus()}}/>{/if}
    {#snippet csvViewControls()}<div class="mode-switch" role="group" data-csv-view aria-label={t('csvText.viewGroup')}><button class:active={!csvText} aria-pressed={!csvText} onclick={()=>chooseCsvView('table')}><Icon name="table" size={14}/> {t('csvText.table')}</button><button class:active={csvText} aria-pressed={csvText} disabled={(active?.byteLength??0)>CSV_TEXT_LIMIT} title={(active?.byteLength??0)>CSV_TEXT_LIMIT?t('csvText.limit'):undefined} onclick={()=>chooseCsvView('text')}><Icon name="file-text" size={14}/> {t('csvText.text')}</button></div>{/snippet}
    {#key `${active.id}:${active.csvView??'table'}`}
     {#if active.kind==='csv'}
      {#if csvText}<div class="document-tools">{@render csvViewControls()}<span class="spacer"></span><details class="insert-menu csv-text-options" bind:this={csvOptions}><summary>{t('csvText.options')}</summary><div class="dropdown"><button class:primary={csvWrap} aria-pressed={csvWrap} onclick={()=>textOption('wrap')}>{t('csvText.wrap')}</button><button class:primary={csvSpaces} aria-pressed={csvSpaces} onclick={()=>textOption('spaces')}>{t('csvText.spaces')}</button><button onclick={()=>textOption('line')} title={t('csvText.goto.title')}>{t('csvText.goto')}</button></div></details><button class="text-button" onclick={searchText}><Icon name="search" size={14}/> {t('csvText.search')}</button></div>{/if}
      {#if csvText}{#if active.warning}<div class="warning-banner" style="color:var(--text)">{active.warning}</div>{/if}<div class="document-panes"><div class="editor-pane" style:width="100%"><div class="pane-caption">{t('csvText.caption')}{#if active.readonly}<span>{t('csvText.readonly')}</span>{/if}</div><Editor bind:this={editor} text={active.text??''} readonly={editingLocked} kind="csv-text" label={t('csvText.editorLabel')} wrapLines={csvWrap} showWhitespace={csvSpaces} onchange={text=>updateText(active!.id,text)}/></div></div>
      {:else}<CsvTable bind:this={csv} doc={active} {commandTitle} viewControls={csvViewControls} onchange={doc=>merge(doc)} onerror={error} onstatus={value=>status=value} onreport={openStatisticsReport}/>{/if}
     {:else}
      <div class="document-tools"><span class="tag subtle">{active.kind==='mermaid'?'DIAGRAMA':active.kind==='text'?'TEXTO':'DOCUMENTO'}</span><div class="mode-switch" role="group" aria-label="Modo de edición"><button class:active={mode==='edit'} onclick={()=>mode='edit'}>Editar</button>{#if active.kind!=='text'}<button class:active={mode==='split'} onclick={()=>mode='split'}>Dividido</button><button class:active={mode==='preview'} onclick={()=>mode='preview'}>Vista previa</button>{/if}</div>{#if active.kind==='markdown'&&mode!=='preview'}<MarkdownToolbar readonly={editingLocked} formatState={markdownState} onformat={(action,language)=>editor?.format(action,language)}/>{/if}<span class="spacer"></span><button class="text-button" onclick={searchText}><Icon name="search" size={14}/> Buscar</button>{#if active.kind==='markdown'}<button class="text-button" class:active={indexVisible} aria-pressed={indexVisible} onclick={toggleIndex}><Icon name="table-of-contents" size={14}/> Índice</button>{/if}</div>
      {#if active.warning}<div class="warning-banner">{active.warning}</div>{/if}
      <div class="document-panes">
       {#if active.kind!=='markdown'||mode!=='preview'}<div class:hidden={mode==='preview'&&active.kind!=='text'} class="editor-pane" style:width={mode==='split'&&active.kind!=='text'?`${split}%`:'100%'}><div class="pane-caption">{active.kind==='mermaid'?'DEFINICIÓN MERMAID':active.kind==='text'?'TEXTO':'MARKDOWN'}{#if assetBusy[active.id]}<span role="status">{assetBusy[active.id]}</span>{:else if active.readonly}<span>Solo lectura</span>{/if}</div><Editor bind:this={editor} session={active.kind==='markdown'?textSession(active):undefined} ontransactions={active.kind==='markdown'?receiveText(active.id):undefined} text={active.text??''} readonly={editingLocked} kind={active.kind} onformatstate={state=>markdownState=state} onselection={selection=>textSelection=selection} onchange={text=>updateText(active!.id,text)} onscroll={ratio=>{if(mode==='split')preview?.scrollRatio(ratio)}} outlineEnabled={active.kind==='markdown'&&mode==='edit'&&indexVisible} onoutline={receiveEditorHeadings(active.id)} oncurrentline={receiveEditorLine(active.id)} onblocks={active.kind==='markdown'?receiveBlocks(active.id):undefined}/></div>{/if}
       {#if active.kind!=='text'}<button class:hidden={mode!=='split'} class="resize-handle split-handle" aria-valuenow={split} aria-valuemin="20" aria-valuemax="80" role="slider" aria-label="Ancho del editor" aria-orientation="vertical" tabindex="0" onpointerdown={resizeSplit} onkeydown={e=>{if(e.key==='ArrowRight')split=Math.min(80,split+2);if(e.key==='ArrowLeft')split=Math.max(20,split-2);if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();remember({division:split})}}}></button><div class:hidden={mode==='edit'} class="preview-pane"><div class="pane-caption">VISTA PREVIA <span>{active.kind==='mermaid'?'SVG':'Renderizado local'}</span></div>{#if active.kind==='mermaid'}<Diagram bind:this={diagram} text={active.text??''} {dark} onerror={error} ondiagnostics={receiveDiagnostics(active.id)}/>{:else}<Preview bind:this={preview} text={active.text??''} id={active.id} path={active.path} renderEnabled={mode!=='edit'||indexVisible} candidates={diagramCandidates?.id===active.id?diagramCandidates:undefined} ondiagnostics={receiveDiagnostics(active.id)} {dark} readonly={editingLocked} ontask={toggleTask} onheadings={receiveHeadings(active.id)} oncurrent={receiveCurrent(active.id)} onfiltertag={filterByTag} onlocateimage={locateImage} onerror={error}/>{/if}</div>{/if}
      </div>
     {/if}
    {/key}
   {:else}
    <section class="welcome"><div class="welcome-content"><img class="brand-mark" src={appIcon} alt=""/><h1>Tu siguiente idea empieza aquí.</h1><p>Documentos, tablas y diagramas.<br/>Abre un archivo y sigue con lo importante.</p><div class="welcome-actions"><button onclick={open}><span class="welcome-action-icon"><Icon name="file-text" size={18}/></span><strong>Abrir archivo</strong><span>Markdown, CSV, Mermaid o texto</span></button><button onclick={openFolder}><span class="welcome-action-icon"><Icon name="folder-open" size={18}/></span><strong>Abrir carpeta</strong><span>Explora y trabaja con varios archivos</span></button><button onclick={()=>create('markdown')}><span class="welcome-action-icon"><Icon name="file-plus" size={18}/></span><strong>Nuevo archivo</strong><span>Empieza con un documento Markdown</span></button></div><div class="drop-zone">Arrastra aquí tus archivos <span>Se abren y procesan en este equipo</span></div>{#if recoveries.length}<div class="recent-heading">RECUPERAR TRABAJO</div>{#each recoveries as item}<div class="recovery-item"><button onclick={()=>recover(item.id)}><Icon name="history" size={14}/> {item.name} <span>{new Date(item.savedAt).toLocaleString()}</span></button><button onclick={()=>discard(item.id)}>Descartar</button></div>{/each}{/if}{#if recent.length}<div class="recent-heading">RECIENTES</div>{#each recent.slice(0,5) as path}{@const type=fileKind(path)}<button class="recent-item" onclick={()=>openPath(path)}><span><span class="kind-{type.kind}"><Icon name={type.icon} size={14}/></span> {path.split(/[\\/]/).at(-1)}</span><span class="muted truncate">{path}</span></button>{/each}{/if}<div class="welcome-footer"><span>Hecho para trabajar sin interrupciones.</span><button class="text-button" onclick={()=>appDialog='about'}>{t('about.title')}</button></div></div></section>
   {/if}
  </main>
 </div>
 <footer class="statusbar"><span class="status-dot"></span><span class="truncate">{status}</span>{#if opening}<span role="status">{opening.phase}</span><button onclick={cancelOpening}>Cancelar apertura</button>{/if}<span class="spacer"></span><div id="document-status"></div>{#if active&&(active.kind==='markdown'||active.kind==='text')}<TextStats id={active.id} name={active.name} text={active.text??''} markdown={active.kind==='markdown'} partial={active.readonly} selection={textSelection}/>{/if}{#if active}{#if csvText&&csvTextInfo}<span role="status" aria-label={t('csvText.format')} aria-live="polite">{t(`csvText.encoding.${active.encoding}`)} · {t(`csvText.eol.${csvTextInfo.eol}`)} · {plural('csvText.lines',csvTextInfo.lines)}</span>{:else if active.kind!=='csv'}<span>{active.encoding.toUpperCase()}</span>{/if}<span>{active.readonly?'Solo lectura':!active.path?'Sin guardar':active.dirty?'Cambios pendientes':'Guardado'}</span>{/if}<span>Local</span></footer>
 {#if csvChange}<CsvViewDialog name={csvChange.name} busy={csvChange.busy} message={csvChange.message} onchoose={decision=>void resolveCsvChange(decision)}/>{/if}
 {#if csvFileMenu}<CsvFileMenu path={csvFileMenu.path} x={csvFileMenu.x} y={csvFileMenu.y} onopen={(path,view)=>void chooseCsvView(view,path)} onclose={closeCsvContext} onerror={error}/>{/if}
 {#if toast}<div class="toast {toastKind}" role="status"><Icon name={toastKind==='error'?'triangle-alert':'circle-check'} size={16}/><span>{toast}</span><button onclick={()=>toast=''} aria-label="Cerrar aviso"><Icon name="x" size={14}/></button></div>{/if}
 {#if appDialog==='about'||appDialog==='licenses'}<AboutDialog initialLicenses={appDialog==='licenses'} onclose={()=>appDialog=null}/>{:else if appDialog==='settings'}<SettingsDialog settings={preferencesState} onsave={savePreferences} onreset={resetPreferences} onclearrecents={clearRecentList} onshowdata={()=>window.freya.showDataFolder()} onclose={()=>appDialog=null}/>{:else if appDialog==='shortcuts'}<ShortcutsDialog onclose={()=>appDialog=null}/>{/if}
</div>
{#if closingNotice}<div use:placeClosingNotice class="toast close-notice {closingNotice.kind==='error'?'error':'info'}" role={closingNotice.kind==='error'?'alert':'status'} aria-live={closingNotice.kind==='error'?'assertive':'polite'} aria-atomic="true"><span>{closingNotice.message}</span>{#if closingNotice.kind!=='progress'}<button onclick={()=>closingNotice=null} aria-label={t('menu.close.dismiss')}><Icon name="x" size={14}/></button>{/if}</div>{/if}

<style>
 .csv-text-options>.dropdown{left:auto;right:0}
 .close-notice{max-width:min(600px,calc(100vw - 32px));color:var(--text)}.close-notice.error{border-color:var(--accent)}
</style>
