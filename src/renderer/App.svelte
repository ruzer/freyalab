<script lang="ts">
 import {onMount,tick} from 'svelte'
 import {Transaction} from '@codemirror/state'
 import {undo as undoText,redo as redoText} from '@codemirror/commands'
 import {createMarkdownSession,taskTransaction,type TaskReference,type MarkdownSession} from './lib/markdown-tasks'
 import appIcon from '../../build/icon.png'
 import type {DocumentInfo,Kind,TreeEntry,RecoveryEntry,ExportRequest} from '../shared/types'
 import Editor from './components/Editor.svelte'
 import MarkdownToolbar from './components/MarkdownToolbar.svelte'
 import TextStats from './components/TextStats.svelte'
 import type {TextSelection} from './lib/text-stats'
 import {lineFormatState} from './lib/markdown-commands'
 import Preview from './components/Preview.svelte'
 import Diagram from './components/Diagram.svelte'
 import CsvTable from './components/CsvTable.svelte'
 import Tree from './components/Tree.svelte'
 import Icon from './components/Icon.svelte'
 import {kindIcon,fileKind} from './lib/icons'
 import type {Heading} from './lib/render'
 let external=$state<string[]>([])
 let documents=$state<DocumentInfo[]>([]),activeId=$state(''),folderPath=$state(''),entries=$state<TreeEntry[]>([]),recent=$state<string[]>([]),recoveries=$state<RecoveryEntry[]>([])
 let sidebar=$state(localStorage.getItem('freya-sidebar')!=='false'),sidebarWidth=$state(Number(localStorage.getItem('freya-sidebar-width')??240)),split=$state(Number(localStorage.getItem('freya-split')??50)),filterFiles=$state('')
 let fileMatches=$state<TreeEntry[]>([]),fileSearchBusy=$state(false),fileSearchLimited=$state(false),fileSearchGeneration=0
 let mode=$state<'edit'|'preview'|'split'>('split'),outline=$state(true),headings=$state<Heading[]>([]),status=$state('Todo se procesa en este equipo'),toast=$state(''),toastKind=$state<'info'|'error'>('info'),busy=$state(false)
 let theme=$state(localStorage.getItem('freya-theme')??'system'),systemDark=$state(matchMedia('(prefers-color-scheme: dark)').matches)
 const dark=$derived(theme==='system'?systemDark:theme==='dark')
 const active=$derived(documents.find(doc=>doc.id===activeId))
 let newMenu=$state(false),exportMenu=$state(false),about=$state(false),exportScope=$state<'all'|'filtered'|'selection'>('all')
 let markdownState=$state(lineFormatState('',0)),textSelection=$state<TextSelection|null>(null)
 let editor=$state<Editor>(),preview=$state<Preview>(),diagram=$state<Diagram>(),csv=$state<CsvTable>()
 const pending=new Map<string,Promise<unknown>>()
 const textSessions=new Map<string,MarkdownSession>()
 // Apertura de un archivo grande en curso (se indexa de una pasada): progreso y botón para cancelar.
 let opening=$state<{id:string;phase:string}|null>(null)
 async function cancelOpening(){const id=opening?.id;if(id)await window.freya.cancelOpen(id).catch(()=>{})}
 let toastTimer:ReturnType<typeof setTimeout>
 function error(message:string){opening=null;toastKind='error';toast=message.replace(/^Error:\s*/,'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast='',7000)}
 function notify(message:string){toastKind='info';status=message;toast=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast='',3500)}
 function textSession(doc:DocumentInfo){
  let session=textSessions.get(doc.id)
  if(!session){session=createMarkdownSession(doc.text??'');textSessions.set(doc.id,session)}
  return session
 }
 function receiveText(id:string){return(transactions:readonly Transaction[])=>{
  const session=textSessions.get(id);if(!session||!transactions.length)return
  let current=session.state
  for(const transaction of transactions){if(transaction.startState!==current)return;current=transaction.state}
  session.state=current;session.receive?.(transactions)
  if(transactions.some(transaction=>transaction.docChanged))updateText(id,current.sliceDoc())
 }}
 function toggleTask(id:string,snapshot:string,reference:TaskReference){
  const doc=documents.find(value=>value.id===id)
  if(!doc||id!==activeId||doc.kind!=='markdown'||doc.readonly)return false
  const session=textSession(doc),transaction=doc.text===snapshot?taskTransaction(session.state,snapshot,reference):undefined
  if(!transaction){notify('La lista cambió. Espera a que se actualice la vista previa y vuelve a intentarlo.');return false}
  receiveText(id)([transaction]);return true
 }
 async function searchText(){if(active?.kind==='markdown'&&mode==='preview'){mode='edit';await tick()}editor?.search()}
 function merge(doc:DocumentInfo,focus=false){
  const session=textSessions.get(doc.id)
  if(session&&doc.text!==undefined&&doc.text!==session.state.sliceDoc()){const transaction=session.state.update({changes:{from:0,to:session.state.doc.length,insert:doc.text},annotations:Transaction.addToHistory.of(false)});session.state=transaction.state;session.receive?.([transaction])}
  if(opening?.id===doc.id)opening=null;documents=documents.some(d=>d.id===doc.id)?documents.map(d=>d.id===doc.id?doc:d):[...documents,doc];if(focus||!activeId)activeId=doc.id}
 async function action<T>(operation:()=>Promise<T>):Promise<T|undefined>{try{return await operation()}catch(e){error(e instanceof Error?e.message:String(e))}}
 async function open(){await action(async()=>{for(const doc of await window.freya.open())merge(doc,true);recent=await window.freya.recents()})}
 async function openPath(path:string){await action(async()=>{for(const doc of await window.freya.openPaths([path]))merge(doc,true)})}
 async function openFolder(){await action(async()=>{const path=await window.freya.folder();if(path){folderPath=path;entries=await window.freya.tree(path);sidebar=true}})}
 async function create(kind:Kind){newMenu=false;await action(async()=>merge(await window.freya.newDocument(kind),true))}
 function updateText(id:string,text:string){documents=documents.map(d=>d.id===id?{...d,text,dirty:true}:d);const previous=pending.get(id)??Promise.resolve();const task=previous.catch(()=>{}).then(()=>window.freya.update(id,text)).then(doc=>{const current=documents.find(d=>d.id===id);if(current?.text===text)merge(doc)}).catch(e=>{error(String(e));throw e});pending.set(id,task);void task.catch(()=>{}).finally(()=>{if(pending.get(id)===task)pending.delete(id)})}
 async function openStatisticsReport(text:string){await action(async()=>{if(new TextEncoder().encode(text).byteLength>10*1024*1024)throw new Error('El informe supera el límite de edición de 10 MiB. Reduce el alcance del análisis.');const doc=await window.freya.newDocument('markdown');merge(doc,true);updateText(doc.id,text);await pending.get(doc.id)})}
 async function save(as=false){if(!active)return;const id=active.id;await action(async()=>{await pending.get(id);const doc=await window.freya.save(id,as);if(doc){merge(doc);external=external.filter(value=>value!==id);notify('Archivo guardado')}})}
 async function reload(id:string){await action(async()=>{merge(await window.freya.reload(id));external=external.filter(value=>value!==id)})}
 async function close(id:string){await action(async()=>{await pending.get(id);if(await window.freya.close(id)){const index=documents.findIndex(d=>d.id===id);documents=documents.filter(d=>d.id!==id);textSessions.delete(id);if(activeId===id)activeId=documents[Math.max(0,index-1)]?.id??''}})}
 async function undo(redo=false){if(!active||active.readonly)return;if(active.kind==='csv')await csv?.undoEdit(redo);else if(active.kind==='markdown'){const id=active.id,session=textSession(active);(redo?redoText:undoText)({state:session.state,dispatch:transaction=>receiveText(id)([transaction])})}else if(redo)editor?.redoEdit();else editor?.undoEdit()}
 async function exportDocument(format:ExportRequest['format']){if(!active)return;exportMenu=false;busy=true;await action(async()=>{await pending.get(active!.id);const request:ExportRequest={format};if(active!.kind==='csv'){request.table=csv?.exportOptions(exportScope)}else if(active!.kind==='mermaid'){if(format==='svg'||format==='png')request.svg=await diagram?.exportSVG();else request.html=await diagram?.exportHTML()}else request.html=await preview?.exportHTML();const missing=active!.kind==='markdown'?preview?.missingImages()??0:0;const path=await window.freya.export(active!.id,request);if(path)notify(`Exportado: ${path}`+(missing?` · ${missing===1?'1 imagen no se encontró':`${missing} imágenes no se encontraron`}; se exportó con su texto alternativo`:''))});busy=false}
 async function recover(id:string){await action(async()=>{merge(await window.freya.recover(id),true);recoveries=await window.freya.recoveries()})}
 async function discard(id:string){await action(async()=>{await window.freya.discardRecovery(id);recoveries=await window.freya.recoveries()})}
 function keydown(event:KeyboardEvent){if(event.defaultPrevented||!(event.metaKey||event.ctrlKey))return;const key=event.key.toLowerCase();if(active?.kind==='markdown'&&!event.altKey&&(mode==='preview'||event.target instanceof Element&&!!event.target.closest('.preview'))&&(key==='z'||key==='y'&&!event.metaKey&&!event.shiftKey)){event.preventDefault();void undo(key==='y'||event.shiftKey)}else if(key==='o'){event.preventDefault();void(event.shiftKey?openFolder():open())}else if(key==='s'){event.preventDefault();void save(event.shiftKey)}else if(key==='n'){event.preventDefault();void create(event.shiftKey?'mermaid':event.altKey?'csv':'markdown')}else if(key==='b'){event.preventDefault();sidebar=!sidebar;localStorage.setItem('freya-sidebar',String(sidebar))}else if(key==='w'&&active){event.preventDefault();void close(active.id)}}
 function themeChange(value:string){theme=value;localStorage.setItem('freya-theme',value)}
 function drop(event:DragEvent){event.preventDefault();const files=Array.from(event.dataTransfer?.files??[]);if(files.length)void action(async()=>{for(const doc of await window.freya.openPaths(window.freya.droppedPaths(files)))merge(doc,true)})}
 function resizeSidebar(event:PointerEvent){const start=event.clientX,width=sidebarWidth;const move=(e:PointerEvent)=>sidebarWidth=Math.min(420,Math.max(180,width+e.clientX-start));const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);localStorage.setItem('freya-sidebar-width',String(sidebarWidth))};window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop)}
 function resizeSplit(event:PointerEvent){const pane=(event.currentTarget as Element).parentElement!;const rect=pane.getBoundingClientRect();const move=(e:PointerEvent)=>split=Math.max(20,Math.min(80,(e.clientX-rect.left)/rect.width*100));const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);localStorage.setItem('freya-split',String(split))};window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop)}
 onMount(()=>{
  const mq=matchMedia('(prefers-color-scheme: dark)'),change=()=>systemDark=mq.matches;mq.addEventListener('change',change)
  void action(async()=>{documents=await window.freya.documents();activeId=documents[0]?.id??'';recent=await window.freya.recents();recoveries=await window.freya.recoveries()})
  const unsubscribe=window.freya.onEvent(event=>{if(event.type==='opened'&&event.document)merge(event.document,true);else if(event.type==='changed'&&event.document){if(!pending.has(event.document.id))merge(event.document)}else if(event.type==='error')error(event.message??'Ocurrió un error');else if(event.type==='analysis'&&event.progress?.requestId.startsWith('open:'))opening={id:event.progress.requestId.slice(5),phase:event.progress.phase};else if(event.type==='external'){if(event.id&&!external.includes(event.id))external=[...external,event.id];notify(event.message??'El archivo cambió en otra aplicación. Al guardar se comprobarán los cambios.')}})
  return()=>{mq.removeEventListener('change',change);unsubscribe();clearTimeout(toastTimer)}
 })
 $effect(()=>{
  const root=folderPath,query=filterFiles.trim(),token=++fileSearchGeneration
  fileMatches=[];fileSearchLimited=false;fileSearchBusy=!!root&&!!query
  if(!root||!query)return
  const timer=setTimeout(async()=>{try{const result=await window.freya.findFiles(root,query);if(token!==fileSearchGeneration)return;fileMatches=result.entries;fileSearchLimited=result.limited}catch(e){if(token===fileSearchGeneration)error(String(e))}finally{if(token===fileSearchGeneration)fileSearchBusy=false}},150)
  return()=>clearTimeout(timer)
 })
 $effect(()=>{document.documentElement.classList.toggle('dark',dark)})
</script>
<svelte:window onkeydown={keydown} ondragover={event=>event.preventDefault()} ondrop={drop}/>
<div class="app-shell" class:dark>
 <header class="toolbar">
  <div class="toolbar-left"><button class="icon-button" aria-label="Mostrar u ocultar explorador" title="Explorador · Ctrl/Cmd B" onclick={()=>sidebar=!sidebar}><Icon name="panel-left"/></button><span class="separator"></span><button title="Abrir archivo · Ctrl/Cmd O" onclick={open}><Icon name="file"/> Abrir</button><button title="Abrir carpeta · Ctrl/Cmd Mayús O" aria-label="Abrir carpeta" onclick={openFolder}><Icon name="folder-open"/></button><div class="menu-anchor"><button title="Nuevo · Ctrl/Cmd N" onclick={()=>newMenu=!newMenu}><Icon name="plus"/> Nuevo <Icon name="chevron-down" size={12}/></button>{#if newMenu}<div class="dropdown">{#each [{kind:'markdown',label:'Documento Markdown'},{kind:'csv',label:'Tabla CSV'},{kind:'mermaid',label:'Diagrama Mermaid'},{kind:'text',label:'Texto plano'}] as item}<button onclick={()=>create(item.kind as Kind)}><span class="kind-{item.kind}"><Icon name={kindIcon[item.kind as Kind]}/></span> {item.label}</button>{/each}</div>{/if}</div></div>
  <div class="document-title">{#if active}<span class="tag">{active.kind==='markdown'?'MD':active.kind==='csv'?'CSV':active.kind==='mermaid'?'MMD':'TXT'}</span><strong class="truncate" title={active.path??active.name}>{active.name}</strong>{#if active.dirty}<span class="dirty-badge">● Editado</span>{/if}{:else}<img class="brand-mark small" src={appIcon} alt=""/><strong>FreyaLab</strong>{/if}</div>
  <div class="toolbar-right"><button class="icon-button" title="Deshacer · Ctrl/Cmd Z" aria-label="Deshacer" disabled={!active||active.readonly} onclick={()=>undo()}><Icon name="undo-2"/></button><button class="icon-button" title="Rehacer · Ctrl/Cmd Mayús Z" aria-label="Rehacer" disabled={!active||active.readonly} onclick={()=>undo(true)}><Icon name="redo-2"/></button><button disabled={!active||active.readonly} title="Guardar · Ctrl/Cmd S" onclick={()=>save()}><Icon name="save"/> Guardar</button><button disabled={!active||active.readonly} title="Guardar como… · Ctrl/Cmd Mayús S" aria-label="Guardar como" onclick={()=>save(true)}><Icon name="save-all"/></button><div class="menu-anchor"><button class="primary" disabled={!active||active.readonly||busy||active.kind==='text'} title="Exportar una copia" onclick={()=>exportMenu=!exportMenu}><Icon name="upload"/> {busy?'Exportando…':'Exportar'} <Icon name="chevron-down" size={12}/></button>{#if exportMenu&&active}<div class="dropdown export-dropdown"><div class="dropdown-label">Exportar una copia</div>{#if active.kind==='csv'}<label>Contenido<select bind:value={exportScope}><option value="all">Documento completo</option><option value="filtered">Filas filtradas</option><option value="selection">Selección</option></select></label><button onclick={()=>exportDocument('csv')}>CSV</button><button onclick={()=>exportDocument('tsv')}>TSV</button>{:else}<button onclick={()=>exportDocument('pdf')}>Documento PDF</button>{#if active.kind==='mermaid'}<button onclick={()=>exportDocument('svg')}>Imagen SVG</button><button onclick={()=>exportDocument('png')}>Imagen PNG</button>{/if}<button onclick={()=>exportDocument('html')}>HTML autónomo</button><p style="max-width:240px;margin:8px 12px;font-size:11px;line-height:1.4;color:var(--muted);white-space:normal">Se exporta con colores claros para que se lea en papel y en cualquier pantalla</p>{/if}</div>{/if}</div></div>
 </header>
 <div class="workspace">
  {#if sidebar}<aside class="sidebar" style:width={`${sidebarWidth}px`}><div class="sidebar-label">EXPLORADOR <button class="icon-button" title="Abrir carpeta" onclick={openFolder}><Icon name="plus" size={14}/></button></div><div class="sidebar-search"><Icon name="search" size={14}/><input aria-label="Buscar archivo" placeholder="Buscar archivo…" bind:value={filterFiles}/></div>{#if folderPath}<div class="folder-root" title={folderPath}><Icon name="chevron-down" size={12}/> <span class="folder-icon"><Icon name="folder-open" size={14}/></span> {folderPath.split(/[\\/]/).at(-1)}</div><div class="tree-scroll">{#if filterFiles.trim()}<div class="file-search-status" role="status">{fileSearchBusy?'Buscando en la carpeta…':fileSearchLimited?'Resultados limitados; acota la búsqueda.':`${fileMatches.length} archivos encontrados`}</div>{#each fileMatches as match (match.path)}{@const type=fileKind(match.name)}<button class="file-search-result" title={match.path} onclick={()=>openPath(match.path)}><span><span class="kind-{type.kind}"><Icon name={type.icon} size={14}/></span> {match.name}</span><small>{match.path.slice(folderPath.length+1)}</small></button>{/each}{:else}<Tree {entries} open={openPath} onerror={error}/>{/if}</div>{:else}<div class="sidebar-empty"><p>Explora tus archivos<br/>en un solo lugar.</p><button onclick={openFolder}>Abrir carpeta</button></div>{/if}<div class="sidebar-bottom"><img class="brand-mark small" src={appIcon} alt=""/><button class="text-button" onclick={()=>about=true}>FreyaLab <span class="muted">alfa</span></button><span class="spacer"></span><select aria-label="Tema" value={theme} onchange={e=>themeChange(e.currentTarget.value)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></div></aside><button class="resize-handle sidebar-handle" aria-valuenow={sidebarWidth} aria-valuemin="180" aria-valuemax="420" role="slider" aria-label="Ancho del explorador" aria-orientation="vertical" tabindex="0" onpointerdown={resizeSidebar} onkeydown={e=>{if(e.key==='ArrowRight')sidebarWidth=Math.min(420,sidebarWidth+10);if(e.key==='ArrowLeft')sidebarWidth=Math.max(180,sidebarWidth-10)}}></button>{/if}
  <main class="main-area">
   {#if documents.length}<div class="tabs" role="tablist" aria-label="Documentos abiertos">{#each documents as doc (doc.id)}<div class="tab" class:active={activeId===doc.id}><button role="tab" aria-selected={activeId===doc.id} onclick={()=>{activeId=doc.id;headings=[]}} title={doc.path??doc.name}><span class="tab-icon kind-{doc.kind}"><Icon name={kindIcon[doc.kind]} size={14}/></span>{doc.name}{#if doc.dirty}<span class="dirty-dot">●</span>{/if}</button><button class="tab-close" aria-label={`Cerrar ${doc.name}`} onclick={()=>close(doc.id)}><Icon name="x" size={14}/></button></div>{/each}</div>{/if}
   {#if active}
    {#if external.includes(active.id)}<div class="warning-banner external-banner"><span>Este archivo cambió fuera de FreyaLab.</span><button onclick={()=>reload(active!.id)}>Recargar</button><button onclick={()=>save(true)}>Guardar copia</button><button onclick={()=>external=external.filter(value=>value!==active!.id)}>Conservar mi edición</button></div>{/if}
    {#key active.id}
     {#if active.kind==='csv'}<CsvTable bind:this={csv} doc={active} onchange={doc=>merge(doc)} onerror={error} onstatus={value=>status=value} onreport={openStatisticsReport}/>
     {:else}
      <div class="document-tools"><span class="tag subtle">{active.kind==='mermaid'?'DIAGRAMA':active.kind==='text'?'TEXTO':'DOCUMENTO'}</span><div class="mode-switch" role="group" aria-label="Modo de edición"><button class:active={mode==='edit'} onclick={()=>mode='edit'}>Editar</button>{#if active.kind!=='text'}<button class:active={mode==='split'} onclick={()=>mode='split'}>Dividido</button><button class:active={mode==='preview'} onclick={()=>mode='preview'}>Vista previa</button>{/if}</div>{#if active.kind==='markdown'&&mode!=='preview'}<MarkdownToolbar readonly={active.readonly} formatState={markdownState} onformat={(action,language)=>editor?.format(action,language)}/>{/if}<span class="spacer"></span><button class="text-button" onclick={searchText}><Icon name="search" size={14}/> Buscar</button>{#if active.kind==='markdown'}<button class="text-button" class:active={outline} onclick={()=>outline=!outline}><Icon name="table-of-contents" size={14}/> Índice</button>{/if}</div>
      {#if active.warning}<div class="warning-banner">{active.warning}</div>{/if}
      <div class="document-panes">
       {#if active.kind!=='markdown'||mode!=='preview'}<div class:hidden={mode==='preview'&&active.kind!=='text'} class="editor-pane" style:width={mode==='split'&&active.kind!=='text'?`${split}%`:'100%'}><div class="pane-caption">{active.kind==='mermaid'?'DEFINICIÓN MERMAID':active.kind==='text'?'TEXTO':'MARKDOWN'}{#if active.readonly}<span>Solo lectura</span>{/if}</div><Editor bind:this={editor} session={active.kind==='markdown'?textSession(active):undefined} ontransactions={active.kind==='markdown'?receiveText(active.id):undefined} text={active.text??''} readonly={active.readonly} kind={active.kind} onformatstate={state=>markdownState=state} onselection={selection=>textSelection=selection} onchange={text=>updateText(active!.id,text)} onscroll={ratio=>preview?.scrollRatio(ratio)}/></div>{/if}
       {#if active.kind!=='text'}<button class:hidden={mode!=='split'} class="resize-handle split-handle" aria-valuenow={split} aria-valuemin="20" aria-valuemax="80" role="slider" aria-label="Ancho del editor" aria-orientation="vertical" tabindex="0" onpointerdown={resizeSplit} onkeydown={e=>{if(e.key==='ArrowRight')split=Math.min(80,split+2);if(e.key==='ArrowLeft')split=Math.max(20,split-2)}}></button><div class:hidden={mode==='edit'} class="preview-pane"><div class="pane-caption">VISTA PREVIA <span>{active.kind==='mermaid'?'SVG':'Renderizado local'}</span></div>{#if active.kind==='mermaid'}<Diagram bind:this={diagram} text={active.text??''} {dark} onerror={error}/>{:else}<Preview bind:this={preview} text={active.text??''} id={active.id} {dark} readonly={active.readonly} ontask={toggleTask} onheadings={value=>headings=value} onerror={error}/>{/if}</div>{/if}
       {#if outline&&active.kind==='markdown'&&mode!=='edit'&&headings.length}<aside class="outline"><div class="sidebar-label">EN ESTE DOCUMENTO</div>{#each headings as heading}<button style:padding-left={`${12+(heading.level-1)*10}px`} onclick={()=>preview?.scrollToHeading(heading.id)}>{heading.text}</button>{/each}</aside>{/if}
      </div>
     {/if}
    {/key}
   {:else}
    <section class="welcome"><div class="welcome-content"><img class="brand-mark" src={appIcon} alt=""/><h1>Tu siguiente idea empieza aquí.</h1><p>Documentos, tablas y diagramas.<br/>Abre un archivo y sigue con lo importante.</p><div class="welcome-actions"><button onclick={open}><span class="welcome-action-icon"><Icon name="file-text" size={18}/></span><strong>Abrir archivo</strong><span>Markdown, CSV, Mermaid o texto</span></button><button onclick={openFolder}><span class="welcome-action-icon"><Icon name="folder-open" size={18}/></span><strong>Abrir carpeta</strong><span>Explora y trabaja con varios archivos</span></button><button onclick={()=>create('markdown')}><span class="welcome-action-icon"><Icon name="file-plus" size={18}/></span><strong>Nuevo archivo</strong><span>Empieza con un documento Markdown</span></button></div><div class="drop-zone">Arrastra aquí tus archivos <span>Se abren y procesan en este equipo</span></div>{#if recoveries.length}<div class="recent-heading">RECUPERAR TRABAJO</div>{#each recoveries as item}<div class="recovery-item"><button onclick={()=>recover(item.id)}><Icon name="history" size={14}/> {item.name} <span>{new Date(item.savedAt).toLocaleString()}</span></button><button onclick={()=>discard(item.id)}>Descartar</button></div>{/each}{/if}{#if recent.length}<div class="recent-heading">RECIENTES</div>{#each recent.slice(0,5) as path}{@const type=fileKind(path)}<button class="recent-item" onclick={()=>openPath(path)}><span><span class="kind-{type.kind}"><Icon name={type.icon} size={14}/></span> {path.split(/[\\/]/).at(-1)}</span><span class="muted truncate">{path}</span></button>{/each}{/if}<div class="welcome-footer"><span>Hecho para trabajar sin interrupciones.</span><button class="text-button" onclick={()=>about=true}>Acerca de FreyaLab</button></div></div></section>
   {/if}
  </main>
 </div>
 <footer class="statusbar"><span class="status-dot"></span><span class="truncate">{status}</span>{#if opening}<span role="status">{opening.phase}</span><button onclick={cancelOpening}>Cancelar apertura</button>{/if}<span class="spacer"></span><div id="document-status"></div>{#if active&&(active.kind==='markdown'||active.kind==='text')}<TextStats id={active.id} name={active.name} text={active.text??''} markdown={active.kind==='markdown'} partial={active.readonly} selection={textSelection}/>{/if}{#if active}{#if active.kind!=='csv'}<span>{active.encoding.toUpperCase()}</span>{/if}<span>{active.readonly?'Solo lectura':!active.path?'Sin guardar':active.dirty?'Cambios pendientes':'Guardado'}</span>{/if}<span>Local</span></footer>
 {#if toast}<div class="toast {toastKind}" role="status"><Icon name={toastKind==='error'?'triangle-alert':'circle-check'} size={16}/><span>{toast}</span><button onclick={()=>toast=''} aria-label="Cerrar aviso"><Icon name="x" size={14}/></button></div>{/if}
 {#if about}<div class="modal-backdrop" role="presentation"><div class="modal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="about-title"><img class="brand-mark" src={appIcon} alt=""/><h2 id="about-title">FreyaLab</h2><p>Documentos, tablas y diagramas.<br/>Una herramienta local, de código abierto.</p><p>Para Freya. 🐾</p><p class="muted">v0.1.0-alpha.1 · Licencia MIT</p><button class="primary" onclick={()=>about=false}>Cerrar</button></div></div>{/if}
</div>
