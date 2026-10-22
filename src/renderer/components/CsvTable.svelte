<script lang="ts">
 import {createTable,tableFeatures} from '@tanstack/svelte-table'
 import {createVirtualizer} from '@tanstack/svelte-virtual'
 import {get} from 'svelte/store'
 import {untrack,tick} from 'svelte'
 import CsvRangePreview from './CsvRangePreview.svelte'
 import CsvTransform from './CsvTransform.svelte'
 import CsvSql from './CsvSql.svelte'
 import CsvStatistics from './CsvStatistics.svelte'
 import CsvQueryTools from './CsvQueryTools.svelte'
 import {parse} from 'csv-parse/browser/esm/sync'
 import type {DocumentInfo,TablePage,TableQuery,TableEdit,TableExport,TableStats,Encoding,TableFilter,TableSort,TableRange,TableRangeEdit} from '../../shared/types'
 let {doc,onchange,onerror,onstatus}:{doc:DocumentInfo;onchange:(doc:DocumentInfo)=>void;onerror:(message:string)=>void;onstatus:(status:string)=>void}=$props()
 let showTransform=$state(false)
 let showCharts=$state(false),chartsButton=$state<HTMLButtonElement>()
 let showSql=$state(false),sqlButton=$state<HTMLButtonElement>()
 let interpreting=$state(false),showStatistics=$state(false),statisticsButton=$state<HTMLButtonElement>()
 let conditions=$state<TableFilter[]>([]),order=$state<TableSort[]>([]),filterMode=$state<'all'|'any'>('all'),showQuery=$state(false),queryError=$state(''),queryButton=$state<HTMLButtonElement>()
 const locked=$derived(doc.readonly||interpreting||!!queryError)
 let search=$state(''),filters=$state<Record<string,string>>({}),sort=$state<TableQuery['sort']>(),page=$state<TablePage>({rows:[],total:0,matched:0,revision:0,requestId:0,sample:false}),busy=$state(false),showFilters=$state(false),showReplace=$state(false)
 const activeOrder=$derived(order.length?order:sort?[sort]:[])
 let selectedRows=$state<string[]>([]),selectedColumns=$state<number[]>([]),selectionStats=$state<TableStats|null>(null)
 let replaceFind=$state(''),replaceWith=$state(''),header=$state(true),numeric=$state(false)
 let scrollElement=$state<HTMLDivElement>(),pageOffset=$state(0),requestId=0
 let editing=$state<{rowId:string;column:number;value:string}|null>(null),editingHeader=$state<{index:number;value:string}|null>(null)
 type Cell={row:number;column:number}
 let selection=$state<{anchor:Cell;end:Cell;query:TableQuery;revision:number}|null>(null),dragging=$state(false),pendingCell=$state<Cell|null>(null)
 let rangeDialog=$state<{edit:TableRangeEdit;cut?:boolean}|null>(null),context=$state<{x:number;y:number}|null>(null)
 let dragPoint={x:0,y:0}
 const cellRange=$derived<TableRange|null>(selection?{top:Math.min(selection.anchor.row,selection.end.row),bottom:Math.max(selection.anchor.row,selection.end.row),left:Math.min(selection.anchor.column,selection.end.column),right:Math.max(selection.anchor.column,selection.end.column),query:selection.query,revision:selection.revision}:null)
 const rangeActions=[['copy','Copiar rango'],['cut','Cortar rango…'],['paste','Pegar en rango…'],['fill','Rellenar rango…'],['clear','Vaciar rango…'],['trim','Quitar espacios del rango…'],['upper','Mayúsculas en el rango…'],['lower','Minúsculas en el rango…'],['replace','Reemplazar en el rango…'],['transformations','Transformar documento…']] as const
 function inside(row:number,column:number){return !!cellRange&&row>=cellRange.top&&row<=cellRange.bottom&&column>=cellRange.left&&column<=cellRange.right}
 function selectCell(row:number,column:number,extend=false){
  if(queryError||page.revision!==doc.revision)return
  selectedRows=[];selectionStats=null
  selection=extend&&selection?{...selection,end:{row,column}}:{anchor:{row,column},end:{row,column},query:$state.snapshot(pageQuery),revision:page.revision}
 }
 function beginSelection(event:PointerEvent,row:number,column:number){if(event.button!==0||(event.target as HTMLElement).tagName==='INPUT'||busy)return;event.preventDefault();selectCell(row,column,event.shiftKey);dragging=true;dragPoint={x:event.clientX,y:event.clientY};(event.currentTarget as HTMLElement).focus()}
 $effect(()=>{if(!dragging)return;const timer=setInterval(()=>{const grid=scrollElement;if(!grid)return;const rect=grid.getBoundingClientRect(),{x,y}=dragPoint;grid.scrollBy({top:y>rect.bottom-24?32:y<rect.top+44?-32:0,left:x>rect.right-24?32:x<rect.left+54?-32:0});const cell=document.elementFromPoint(Math.max(rect.left+54,Math.min(x,rect.right-8)),Math.max(rect.top+(showFilters?80:44),Math.min(y,rect.bottom-8)))?.closest<HTMLElement>('.csv-cell');if(cell&&selection)selection={...selection,end:{row:Number(cell.dataset.row),column:Number(cell.dataset.column)}}},50);return()=>clearInterval(timer)})
 $effect(()=>{const target=pendingCell;void page;void renderedRows;void $rowsVirtual.getVirtualItems();void $columnsVirtual.getVirtualItems();if(target)void tick().then(()=>{if(pendingCell!==target)return;const node=scrollElement?.querySelector<HTMLElement>(`.csv-cell[data-row="${target.row}"][data-column="${target.column}"]`);if(node)node.focus()})})
 function focusCell(row:number,column:number,extend=false){if(!page.matched)return;row=Math.max(0,Math.min(row,page.matched-1));column=Math.max(0,Math.min(column,(doc.headers?.length??1)-1));selectCell(row,column,extend);pendingCell={row,column};get(rowsVirtual).scrollToIndex(row,{align:'auto'});get(columnsVirtual).scrollToIndex(column,{align:'auto'});if(row<pageOffset||row>=pageOffset+page.rows.length)void load(Math.floor(row/100)*100)}
 function openContext(x:number,y:number){pendingCell=null;context={x:Math.max(0,Math.min(x,window.innerWidth-270)),y:Math.max(0,Math.min(y,window.innerHeight-370))};void tick().then(()=>document.querySelector<HTMLButtonElement>('.range-context button')?.focus())}
 function closeContext(){context=null;if(selection)focusCell(selection.end.row,selection.end.column,true)}
 async function rangeAction(action:string){
  context=null;pendingCell=null;if(!cellRange||locked||busy)return
  try{if(action==='transformations'){openTransform();return}if(action==='copy'){await window.freya.tableCopy(doc.id,{scope:'selection',range:$state.snapshot(cellRange)},'tsv');onstatus('Rango copiado');return}
   if(action==='paste'){preparePaste(await window.freya.tablePaste(doc.id,$state.snapshot(cellRange)));return}
   rangeDialog={edit:{type:'range',range:$state.snapshot(cellRange),operation:(action==='cut'?'clear':action) as TableRangeEdit['operation'],value:'',find:''},cut:action==='cut'}
  }catch(error){onerror(action==='paste'?'No se pudo leer el portapapeles. Usa Ctrl/⌘ + V sobre la tabla.':String(error))}
 }
 function openTransform(){if(locked)return;if((doc.headers?.length??0)>200){onerror('Estas transformaciones admiten hasta 200 columnas por documento.');return}context=null;pendingCell=null;showTransform=true}
 async function applyTransform(change:import('../../shared/types').TableTransformEdit){const error=await edit(change);if(error===null){if(['moveRows','moveColumns','commitOrder'].includes(change.operation)){search='';filters={};sort=undefined;conditions=[];order=[];showQuery=false}selection=null;selectedRows=[];selectedColumns=[];selectionStats=null;await load(0);scrollElement?.scrollTo({top:0,left:0})}return error}
 function closeTransform(){showTransform=false;if(selection)focusCell(selection.end.row,selection.end.column,true);else document.querySelector<HTMLElement>('[aria-label="Operaciones CSV"]')?.focus()}
 function preparePaste(text:string){if(!cellRange||locked)return;try{rangeDialog={edit:{type:'range',range:$state.snapshot(cellRange),operation:'paste',values:parse(text,{delimiter:'\t',relax_column_count:true,skip_empty_lines:false}) as string[][]}}}catch(error){onerror(String(error))}}
 async function applyRange(change:TableRangeEdit){try{if(rangeDialog?.cut)await window.freya.tableCopy(doc.id,{scope:'selection',range:change.range},'tsv');return await edit(change)}catch(error){const message=String(error).replace(/^.*Error: /,'');onerror(message);return message}}
 function closeRangeDialog(){rangeDialog=null;if(selection)focusCell(selection.end.row,selection.end.column,true)}
 function gridKey(event:KeyboardEvent){
  const target=event.target as HTMLElement,command=event.metaKey||event.ctrlKey
  if(target.tagName==='INPUT'||target.tagName==='TEXTAREA')return
  if(command&&event.shiftKey&&event.key.toLowerCase()==='t'){event.preventDefault();if(!locked)openTransform();return}
  if(command&&event.key.toLowerCase()==='z'){event.preventDefault();void undoEdit(event.shiftKey);return}
  if(command&&event.key.toLowerCase()==='c'&&(cellRange||selectedRows.length)){event.preventDefault();void(cellRange?rangeAction('copy'):copyCells());return}
  if(command&&event.key.toLowerCase()==='x'&&cellRange){event.preventDefault();void rangeAction('cut');return}
  if(command&&event.key.toLowerCase()==='a'&&page.matched){event.preventDefault();selectCell(0,0);selectCell(page.matched-1,(doc.headers?.length??1)-1,true);return}
  const row=Number(target.closest<HTMLElement>('.csv-cell')?.dataset.row),column=Number(target.closest<HTMLElement>('.csv-cell')?.dataset.column)
  if(!Number.isInteger(row)||!Number.isInteger(column))return
  if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey){event.preventDefault();if(!inside(row,column))selectCell(row,column);const rect=target.getBoundingClientRect();openContext(rect.left,rect.bottom);return}
  if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End','PageDown','PageUp'].includes(event.key)){event.preventDefault();let nextRow=row,nextColumn=column;if(event.key==='ArrowDown')nextRow++;if(event.key==='ArrowUp')nextRow--;if(event.key==='ArrowRight')nextColumn++;if(event.key==='ArrowLeft')nextColumn--;if(event.key==='PageDown')nextRow+=Math.max(1,Math.floor((scrollElement?.clientHeight??320)/32)-1);if(event.key==='PageUp')nextRow-=Math.max(1,Math.floor((scrollElement?.clientHeight??320)/32)-1);if(event.key==='Home'){nextColumn=0;if(command)nextRow=0}if(event.key==='End'){nextColumn=(doc.headers?.length??1)-1;if(command)nextRow=page.matched-1}focusCell(nextRow,nextColumn,event.shiftKey);return}
  if((event.key==='Delete'||event.key==='Backspace')&&cellRange){event.preventDefault();void rangeAction('clear')}
  if(event.key==='Enter'&&command&&cellRange){event.preventDefault();void rangeAction('fill')}
  if(event.key==='Escape'){selection=null;context=null}
 }
 const features=tableFeatures({})
 const table=createTable({features,get columns(){return(doc.headers??[]).map((name,index)=>({id:String(index),header:name,accessorFn:(row:{id:string;cells:string[]})=>row.cells[index]}))},get data(){return page.rows},getRowId:row=>row.id})
 const rowsVirtual=createVirtualizer<HTMLDivElement,HTMLDivElement>({count:0,getScrollElement:()=>scrollElement??null,estimateSize:()=>32,overscan:8,paddingStart:40})
 const columnsVirtual=createVirtualizer<HTMLDivElement,HTMLDivElement>({horizontal:true,count:0,getScrollElement:()=>scrollElement??null,estimateSize:()=>180,overscan:2,paddingStart:52})
 const rowMap=$derived(new Map(table.getRowModel().rows.map(row=>[row.original.id,row.original])))
 const renderedRows=$derived(page.rows.map(row=>rowMap.get(row.id)!).filter(Boolean))
 $effect(()=>{const count=page.matched,padding=showFilters?76:40,columns=doc.headers?.length??0;get(rowsVirtual).setOptions({count,paddingStart:padding});get(columnsVirtual).setOptions({count:columns})})
 let pageQuery:TableQuery={offset:0,limit:200,requestId:0}
 function query(offset=0):TableQuery{return{search,conditions:$state.snapshot(conditions),filterMode,order:order.length?$state.snapshot(order):undefined,filters:$state.snapshot(filters),sort:sort?$state.snapshot(sort):undefined,offset,limit:200,requestId}}
 async function load(offset=0){const q={...query(offset),requestId:++requestId};busy=true;try{const result=await window.freya.tablePage(doc.id,q);if(result.requestId!==requestId)return;queryError='';pageOffset=offset;page=result;pageQuery=q;onstatus(`${result.matched.toLocaleString()} de ${result.total.toLocaleString()} filas${result.sample?' · muestra':''}`)}catch(error){if(q.requestId===requestId){queryError=String(error).replace(/^.*Error: /,'');onerror(queryError)}}finally{if(q.requestId===requestId)busy=false}}
 $effect(()=>{const signature=JSON.stringify([doc.id,doc.revision,search,filters,sort,conditions,filterMode,order]);void signature;untrack(()=>{selectedRows=[];selectionStats=null;selection=null;context=null;rangeDialog=null;pendingCell=null;dragging=false;scrollElement?.scrollTo({top:0})});const timer=setTimeout(()=>void load(0),150);return()=>clearTimeout(timer)})
 $effect(()=>{const items=$rowsVirtual.getVirtualItems(),first=items[0]?.index??0,last=items.at(-1)?.index??0;if(items.length&&!busy&&(first<pageOffset||last>=pageOffset+page.rows.length))untrack(()=>void load(Math.floor(first/100)*100))})
 function update(updated:DocumentInfo){if(updated.headers?.length!==doc.headers?.length){filters={};sort=undefined;conditions=[];order=[];showQuery=false;selectedColumns=[]}onchange(updated)}
 async function edit(change:TableEdit){if(locked)return 'La vista no permite editar.';try{update(await window.freya.tableEdit(doc.id,$state.snapshot(change)));editing=null;await load(pageOffset);await stats();return null}catch(error){const message=String(error).replace(/^.*Error: /,'');onerror(message);return message}}
 async function stats(){if(!selectedRows.length){selectionStats=null;return}try{selectionStats=await window.freya.stats(doc.id,$state.snapshot(selectedRows),selectedColumns.length?$state.snapshot(selectedColumns):(doc.headers??[]).map((_,i)=>i))}catch(error){onerror(String(error))}}
 function selectRow(id:string,add:boolean){selection=null;context=null;selectedRows=add?(selectedRows.includes(id)?selectedRows.filter(x=>x!==id):[...selectedRows,id]):[id];void stats()}
 function selectColumn(index:number){selection=null;context=null;selectedColumns=selectedColumns.includes(index)?selectedColumns.filter(x=>x!==index):[...selectedColumns,index];void stats()}
 function sortBy(column:number,append=false){const current=activeOrder.find(item=>item.column===column),next={column,descending:current?!current.descending:false,numeric};if(append){order=current?activeOrder.map(item=>item.column===column?next:item):[...activeOrder,next];sort=undefined}else{sort=next;order=[]}}
 function applyQuery(next:TableFilter[],sorts:TableSort[],mode:'all'|'any'){conditions=next;order=sorts;filterMode=mode;sort=undefined;showQuery=false;queryButton?.focus()}

 function setFilter(column:number,value:string){filters={...filters,[column]:value}}
 async function copyMarkdown(){try{await window.freya.tableCopy(doc.id,{scope:cellRange||selectedRows.length?'selection':'filtered',range:cellRange?$state.snapshot(cellRange):undefined,rowIds:$state.snapshot(selectedRows),columns:selectedColumns.length?$state.snapshot(selectedColumns):undefined,query:query()},'markdown');onstatus('Tabla Markdown copiada')}catch(error){onerror(String(error))}}
 async function paste(event:ClipboardEvent,rowId:string,column:number){if(locked)return;const value=event.clipboardData?.getData('text/plain');if(value===undefined)return;if((event.target as HTMLElement).tagName==='INPUT'&&!value.includes('\t')&&!value.includes('\n'))return;event.preventDefault();if(cellRange&&(event.target as HTMLElement).tagName!=='INPUT'){preparePaste(value);return}try{const lines=parse(value,{delimiter:'\t',relax_column_count:true,skip_empty_lines:false}) as string[][];await edit({type:'paste',rowId,column,values:lines,view:{query:pageQuery,revision:page.revision}})}catch(error){onerror(String(error))}}
 async function copyCells(){try{await window.freya.tableCopy(doc.id,{scope:'selection',rowIds:$state.snapshot(selectedRows),columns:selectedColumns.length?$state.snapshot(selectedColumns):undefined},'tsv');onstatus('Selección copiada')}catch(error){onerror(String(error))}}
 async function options(change:{encoding?:Encoding;delimiter?:string;header?:boolean}){if(interpreting)return;interpreting=true;editing=null;editingHeader=null;try{onchange(await window.freya.tableOptions(doc.id,change));await load(0)}catch(error){onerror(String(error))}finally{interpreting=false}}
 export function exportOptions(scope:'all'|'filtered'|'selection'='all'):TableExport{
  return{scope,range:scope==='selection'&&cellRange?$state.snapshot(cellRange):undefined,query:query(),rowIds:scope==='selection'?$state.snapshot(selectedRows):undefined,columns:scope==='selection'&&selectedColumns.length?$state.snapshot(selectedColumns):undefined}
 }
 export async function undoEdit(redo=false){try{update(await window.freya.undo(doc.id,redo));await load(pageOffset)}catch(error){onerror(String(error))}}
</script>
<svelte:window onblur={()=>dragging=false} onpointerup={()=>dragging=false} onpointercancel={()=>dragging=false} onkeydown={event=>{if(event.key==='Tab')pendingCell=null}} onpointermove={event=>{dragPoint={x:event.clientX,y:event.clientY}}} onpointerdown={event=>{pendingCell=null;if(context&&!(event.target as HTMLElement).closest('.range-context'))context=null}}/>
{#snippet rangeButtons(menu=false)}{#each rangeActions as [action,label]}<button role={menu?'menuitem':undefined} disabled={locked||busy||!cellRange} onclick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');void rangeAction(action)}}>{label}</button>{/each}{/snippet}
{#if showTransform}<CsvTransform {doc} initialRows={selectedRows} initialRange={cellRange} viewQuery={query()} initialColumns={selectedColumns.length?selectedColumns:cellRange?Array.from({length:cellRange.right-cellRange.left+1},(_,i)=>cellRange.left+i):[]} onapply={applyTransform} onclose={closeTransform} {onerror}/>{/if}
{#if rangeDialog}<CsvRangePreview id={doc.id} initial={rangeDialog.edit} cut={rangeDialog.cut} onapply={applyRange} onclose={closeRangeDialog} {onerror}/>{/if}
{#if context}<div class="range-context" role="menu" aria-label="Acciones del rango" tabindex="-1" style:left={`${context.x}px`} style:top={`${context.y}px`} onkeydown={event=>{const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),index=buttons.indexOf(document.activeElement as HTMLButtonElement);if(event.key==='Escape'){event.preventDefault();closeContext()}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus()}else if(event.key==='Tab')context=null}}>{@render rangeButtons(true)}</div>{/if}
<div class="csv-workspace">
 <div class="csv-toolbar">
  <div class="search-field"><span>⌕</span><input aria-label="Buscar en tabla" placeholder="Buscar en la tabla…" bind:value={search}/>{#if search}<button onclick={()=>search=''} aria-label="Borrar búsqueda">×</button>{/if}</div>
  <button class:active={showFilters} onclick={()=>showFilters=!showFilters}>☷ Filtros {Object.values(filters).filter(Boolean).length||''}</button>
  {#if search||Object.values(filters).some(Boolean)||sort||order.length||conditions.length}<button onclick={()=>{search='';filters={};sort=undefined;conditions=[];order=[];showQuery=false}}>Quitar filtros y orden</button>{/if}
  <label class="check-label"><input type="checkbox" bind:checked={numeric} onchange={()=>{if(sort)sort={...sort,numeric}}}/>Orden numérico</label>
  <button onclick={()=>showReplace=!showReplace}>Reemplazar</button>
  <button bind:this={queryButton} class:active={conditions.length>0||order.length>0} aria-expanded={showQuery} onclick={()=>showQuery=!showQuery}>Consulta avanzada</button>
  <button bind:this={sqlButton} aria-expanded={showSql} onclick={()=>{showSql=!showSql;showStatistics=false;showQuery=false;showCharts=false}}>Análisis</button>
  <button bind:this={statisticsButton} aria-expanded={showStatistics} onclick={()=>{showStatistics=!showStatistics;showSql=false;showCharts=false}}>Estadísticas</button>
  <button bind:this={chartsButton} aria-expanded={showCharts} onclick={()=>{showCharts=!showCharts;showSql=false;showStatistics=false;showQuery=false}}>Gráficos</button>
  <span class="spacer"></span><span class="muted">{busy?'Procesando…':`${page.matched.toLocaleString()} de ${page.total.toLocaleString()} filas`}</span>
 </div>
 {#if showQuery}<CsvQueryTools headers={doc.headers??[]} initialConditions={conditions} initialOrder={activeOrder} initialMode={filterMode} onapply={applyQuery} onclose={()=>{showQuery=false;queryButton?.focus()}}/>{/if}
 {#if queryError}<div class="warning-banner" role="alert">Consulta no aplicada. Se conserva la última vista válida. {queryError} Corrige o limpia la consulta para editar. <button disabled={busy} onclick={()=>void load(0)}>Reintentar consulta</button></div>{/if}
 {#if doc.warning||doc.readonly}<div class="warning-banner">{doc.warning??'Solo lectura'}{#if page.sample} Los filtros y recuentos describen únicamente la muestra.{/if}</div>{/if}
 {#if showReplace}<form class="csv-toolbar" onsubmit={event=>{event.preventDefault();void edit({type:'replace',find:replaceFind,replacement:replaceWith,column:selectedColumns.length===1?selectedColumns[0]:undefined})}}><input aria-label="Buscar valor para reemplazar" placeholder="Buscar valor" bind:value={replaceFind}/><input aria-label="Nuevo valor" placeholder="Reemplazar por" bind:value={replaceWith}/><span class="muted">{selectedColumns.length===1?'Columna seleccionada':'Todas las columnas'}</span><button disabled={locked||!replaceFind} type="submit">Reemplazar coincidencias</button></form>{/if}
 <div class="csv-operations">
  <details class="insert-menu"><summary aria-label="Operaciones CSV">Operaciones ▾</summary><div class="dropdown">
   <button disabled={locked||(doc.headers?.length??0)>200} title="Documento completo · Ctrl/⌘ + Mayús + T · hasta 200 columnas" onclick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');openTransform()}}>Transformar documento…</button>
   <span class="dropdown-label">Filas y columnas</span>
   <button disabled={locked||!selectedRows.length} onclick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');void edit({type:'duplicateRows',ids:selectedRows})}}>Duplicar filas seleccionadas</button>
   <button disabled={locked||selectedColumns.length!==1} onclick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');void edit({type:'duplicateColumn',index:selectedColumns[0]})}} title="Al cambiar columnas se restablecen filtros y orden">Duplicar columna seleccionada</button>
   <span class="dropdown-label">Limpiar selección</span>
   {#each [{operation:'trim',label:'Quitar espacios al inicio y final'},{operation:'upper',label:'Convertir a mayúsculas'},{operation:'lower',label:'Convertir a minúsculas'}] as item}
    <button disabled={locked||!selectedRows.length} onclick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');void edit({type:'transform',operation:item.operation as 'trim'|'upper'|'lower',rowIds:selectedRows,columns:selectedColumns.length?selectedColumns:(doc.headers??[]).map((_,i)=>i)})}}>{item.label}</button>
   {/each}
  </div></details>
  <span class="muted">{selectedRows.length?`Limpieza: ${selectedRows.length} filas × ${selectedColumns.length||doc.headers?.length||0} columnas · sin encabezados`:'Selecciona filas por su número; Ctrl/⌘ o Mayús añade más. Marca columnas para limitar la operación.'}</span>
 </div>
 <div class="csv-options"><label>Codificación <select value={doc.encoding} disabled={doc.dirty||interpreting} onchange={e=>void options({encoding:e.currentTarget.value as Encoding})}><option value="utf8">UTF-8</option><option value="utf16le">UTF-16 LE</option><option value="win1252">Windows-1252</option></select></label><label>Separador <select value={doc.delimiter} disabled={doc.dirty||interpreting} onchange={e=>void options({delimiter:e.currentTarget.value})}><option value=",">Coma</option><option value=";">Punto y coma</option><option value={'\t'}>Tabulación</option><option value="|">Barra vertical</option></select></label><label class="check-label"><input type="checkbox" bind:checked={header} disabled={doc.dirty||interpreting} onchange={()=>void options({header})}/>Primera fila como encabezado</label><span class="spacer"></span><button disabled={locked} onclick={()=>void edit({type:'insertRow',afterId:selectedRows.at(-1)})}>+ Fila</button><button disabled={locked} onclick={()=>void edit({type:'insertColumn',index:doc.headers?.length??0,name:`Columna ${(doc.headers?.length??0)+1}`})}>+ Columna</button><button disabled={locked||!selectedRows.length} onclick={()=>void edit({type:'deleteRows',ids:selectedRows})}>Eliminar filas</button><button disabled={locked||selectedColumns.length!==1} onclick={()=>void edit({type:'deleteColumn',index:selectedColumns[0]})}>Eliminar columna</button></div>
 {#if showCharts}{#await import('./CsvCharts.svelte')}<p role="status">Preparando gráficos…</p>{:then module}<module.default {doc} {onerror} onclose={()=>{showCharts=false;chartsButton?.focus()}}/>{:catch}<p role="alert">No se pudo cargar el panel de gráficos. Cierra el panel y vuelve a intentarlo.</p>{/await}{/if}
 {#if showSql}<CsvSql {doc} {onerror} onclose={()=>{showSql=false;sqlButton?.focus()}}/>{/if}
 {#if showStatistics}<CsvStatistics {doc} query={query()} queryValid={!queryError} columns={selectedColumns} onerror={onerror} onclose={()=>{showStatistics=false;statisticsButton?.focus()}}/>{/if}
 <div class="csv-scroll" bind:this={scrollElement} role="grid" aria-label="Tabla de datos" aria-rowcount={page.matched+1} aria-colcount={(doc.headers?.length??0)+1} tabindex="0" aria-multiselectable="true" onkeydown={gridKey}>
  <div class="virtual-table" style:height={`${$rowsVirtual.getTotalSize()}px`} style:width={`${Math.max($columnsVirtual.getTotalSize(),scrollElement?.clientWidth??0)}px`}>
   <div class="csv-header" role="row" style:height={showFilters?'76px':'40px'}>
    <div class="row-number corner">#</div>
    {#each $columnsVirtual.getVirtualItems() as col (col.key)}
     <div class="column-header" role="columnheader" aria-sort={activeOrder.find(item=>item.column===col.index)?.descending===true?'descending':activeOrder.some(item=>item.column===col.index)?'ascending':'none'} style:left={`${col.start}px`} style:width={`${col.size}px`}>
      {#if editingHeader?.index===col.index}<input class="column-filter" aria-label="Nombre del encabezado" bind:value={editingHeader.value} use:focus onblur={()=>{if(editingHeader){void edit({type:'header',index:col.index,name:editingHeader.value});editingHeader=null}}} onkeydown={event=>{if(event.key==='Enter')event.currentTarget.blur();else if(event.key==='Escape')editingHeader=null}}/>{:else}<div class="column-title"><input class="column-select" type="checkbox" aria-label={`Seleccionar columna ${doc.headers?.[col.index]}`} checked={selectedColumns.includes(col.index)} onchange={()=>selectColumn(col.index)}/><button class="sort-button" title="Ordenar columna" onclick={event=>sortBy(col.index,event.shiftKey)}>{doc.headers?.[col.index]||`Columna ${col.index+1}`} {activeOrder.some(item=>item.column===col.index)?(activeOrder.find(item=>item.column===col.index)?.descending?'↓':'↑'):''}</button><button class="header-edit" title="Editar encabezado" aria-label={`Editar encabezado ${col.index+1}`} disabled={locked} onclick={()=>editingHeader={index:col.index,value:doc.headers?.[col.index]??''}}>✎</button></div>{/if}
      {#if showFilters}<input class="column-filter" aria-label={`Filtrar ${doc.headers?.[col.index]}`} placeholder="Contiene…" value={filters[col.index]??''} oninput={e=>setFilter(col.index,e.currentTarget.value)}/>{/if}
     </div>
    {/each}
   </div>
   {#each $rowsVirtual.getVirtualItems() as virtualRow (virtualRow.key)}
    {@const row=renderedRows[virtualRow.index-pageOffset]}
    {#if row}<div class="csv-row" class:selected={selectedRows.includes(row.id)} role="row" aria-rowindex={virtualRow.index+2} style:transform={`translateY(${virtualRow.start}px)`} style:height={`${virtualRow.size}px`}>
     <button class="row-number" aria-label={`Seleccionar fila ${virtualRow.index+1}`} onclick={event=>selectRow(row.id,event.metaKey||event.ctrlKey||event.shiftKey)}>{virtualRow.index+1}</button>
     {#each $columnsVirtual.getVirtualItems() as col (col.key)}
      <div class="csv-cell" class:range-selected={inside(virtualRow.index,col.index)} aria-selected={inside(virtualRow.index,col.index)} data-row={virtualRow.index} data-column={col.index} onpointerdown={event=>beginSelection(event,virtualRow.index,col.index)} onpointerenter={()=>{if(dragging&&selection)selection={...selection,end:{row:virtualRow.index,column:col.index}}}} oncontextmenu={event=>{event.preventDefault();if(!inside(virtualRow.index,col.index))selectCell(virtualRow.index,col.index);openContext(event.clientX,event.clientY)}} class:column-selected={selectedColumns.includes(col.index)} role="gridcell" aria-colindex={col.index+2} tabindex="0" aria-label={`Fila ${virtualRow.index+1}, ${doc.headers?.[col.index]}`} style:left={`${col.start}px`} style:width={`${col.size}px`} ondblclick={()=>{if(!locked)editing={rowId:row.id,column:col.index,value:row.cells[col.index]??''}}} onkeydown={event=>{if(!locked&&!event.metaKey&&!event.ctrlKey&&(event.key==='Enter'||event.key==='F2')){event.preventDefault();editing={rowId:row.id,column:col.index,value:row.cells[col.index]??''}}}} onpaste={event=>void paste(event,row.id,col.index)}>
       {#if editing?.rowId===row.id&&editing?.column===col.index}<input class="cell-input" aria-label="Editar celda" bind:value={editing.value} use:focus onblur={()=>{if(editing)void edit({type:'cell',rowId:row.id,column:col.index,value:editing.value})}} onkeydown={event=>{if(event.key==='Enter'&&editing){event.preventDefault();event.currentTarget.blur()}else if(event.key==='Escape'){editing=null}}}/>{:else}<span title={row.cells[col.index]??''}>{row.cells[col.index]??''}</span>{/if}
      </div>
     {/each}
    </div>{/if}
   {/each}
  </div>
  {#if !page.matched&&!busy}<div class="table-empty">No hay filas que coincidan. <button onclick={()=>void edit({type:'insertRow'})} disabled={locked}>Añadir fila</button></div>{/if}
 </div>
 <div class="selection-bar">{#if cellRange}<span role="status">Rango: filas {cellRange.top+1}–{cellRange.bottom+1}, columnas {cellRange.left+1}–{cellRange.right+1} · {((cellRange.bottom-cellRange.top+1)*(cellRange.right-cellRange.left+1)).toLocaleString()} celdas</span><details class="insert-menu"><summary aria-label="Acciones del rango">Rango ▾</summary><div class="dropdown">{@render rangeButtons()}</div></details>{:else}<span>{selectedRows.length?`${selectedRows.length} filas seleccionadas`:'Selecciona filas para consultar estadísticas'}</span>{/if}{#if selectionStats}<span>Vacíos: {selectionStats.empty} · Únicos: {selectionStats.unique}</span>{#if selectionStats.numeric}<span>Suma: {selectionStats.sum?.toLocaleString()} · Media: {selectionStats.average?.toLocaleString()} · Mín: {selectionStats.min?.toLocaleString()} · Máx: {selectionStats.max?.toLocaleString()}</span>{/if}{/if}<span class="spacer"></span><button onclick={copyMarkdown}>Copiar como Markdown</button></div>
</div>
<script lang="ts" module>
 function focus(node:HTMLInputElement){node.focus();node.select()}
</script>
