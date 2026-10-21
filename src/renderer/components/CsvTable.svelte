<script lang="ts">
 import {createTable,tableFeatures} from '@tanstack/svelte-table'
 import {createVirtualizer} from '@tanstack/svelte-virtual'
 import {get} from 'svelte/store'
 import {untrack} from 'svelte'
 import {parse} from 'csv-parse/browser/esm/sync'
 import {stringify} from 'csv-stringify/browser/esm/sync'
 import type {DocumentInfo,TablePage,TableQuery,TableEdit,TableExport,TableStats,Encoding} from '../../shared/types'
 let {doc,onchange,onerror,onstatus}:{doc:DocumentInfo;onchange:(doc:DocumentInfo)=>void;onerror:(message:string)=>void;onstatus:(status:string)=>void}=$props()
 let search=$state(''),filters=$state<Record<string,string>>({}),sort=$state<TableQuery['sort']>(),page=$state<TablePage>({rows:[],total:0,matched:0,revision:0,requestId:0,sample:false}),busy=$state(false),showFilters=$state(false),showReplace=$state(false)
 let selectedRows=$state<string[]>([]),selectedColumns=$state<number[]>([]),selectionStats=$state<TableStats|null>(null)
 let replaceFind=$state(''),replaceWith=$state(''),header=$state(true),numeric=$state(false)
 let scrollElement=$state<HTMLDivElement>(),pageOffset=$state(0),requestId=0
 const selectedRecords=new Map<string,string[]>()
 let editing=$state<{rowId:string;column:number;value:string}|null>(null),editingHeader=$state<{index:number;value:string}|null>(null)
 const features=tableFeatures({})
 const table=createTable({features,get columns(){return(doc.headers??[]).map((name,index)=>({id:String(index),header:name,accessorFn:(row:{id:string;cells:string[]})=>row.cells[index]}))},get data(){return page.rows},getRowId:row=>row.id})
 const rowsVirtual=createVirtualizer<HTMLDivElement,HTMLDivElement>({count:0,getScrollElement:()=>scrollElement??null,estimateSize:()=>32,overscan:8,paddingStart:40})
 const columnsVirtual=createVirtualizer<HTMLDivElement,HTMLDivElement>({horizontal:true,count:0,getScrollElement:()=>scrollElement??null,estimateSize:()=>180,overscan:2,paddingStart:52})
 const rowMap=$derived(new Map(table.getRowModel().rows.map(row=>[row.original.id,row.original])))
 const renderedRows=$derived(page.rows.map(row=>rowMap.get(row.id)!).filter(Boolean))
 $effect(()=>{const count=page.matched,padding=showFilters?76:40,columns=doc.headers?.length??0;get(rowsVirtual).setOptions({count,paddingStart:padding});get(columnsVirtual).setOptions({count:columns})})
 function query(offset=0):TableQuery{return{search,filters:$state.snapshot(filters),sort:sort?$state.snapshot(sort):undefined,offset,limit:200,requestId}}
 async function load(offset=0){const q={...query(offset),requestId:++requestId};busy=true;try{const result=await window.freya.tablePage(doc.id,q);if(result.requestId!==requestId)return;pageOffset=offset;page=result;for(const row of result.rows)if(selectedRecords.has(row.id))selectedRecords.set(row.id,row.cells);onstatus(`${result.matched.toLocaleString()} de ${result.total.toLocaleString()} filas${result.sample?' · muestra':''}`)}catch(error){if(q.requestId===requestId)onerror(String(error))}finally{if(q.requestId===requestId)busy=false}}
 $effect(()=>{const signature=JSON.stringify([doc.id,doc.revision,search,filters,sort]);void signature;const timer=setTimeout(()=>{selectedRows=[];selectionStats=null;scrollElement?.scrollTo({top:0});void load(0)},150);return()=>clearTimeout(timer)})
 $effect(()=>{const items=$rowsVirtual.getVirtualItems(),first=items[0]?.index??0,last=items.at(-1)?.index??0;if(items.length&&!busy&&(first<pageOffset||last>=pageOffset+page.rows.length))untrack(()=>void load(Math.floor(first/100)*100))})
 async function edit(change:TableEdit){if(doc.readonly)return;try{onchange(await window.freya.tableEdit(doc.id,$state.snapshot(change)));editing=null;await load(pageOffset);await stats()}catch(error){onerror(String(error))}}
 async function stats(){if(!selectedRows.length){selectionStats=null;return}try{selectionStats=await window.freya.stats(doc.id,$state.snapshot(selectedRows),selectedColumns.length?$state.snapshot(selectedColumns):(doc.headers??[]).map((_,i)=>i))}catch(error){onerror(String(error))}}
 function selectRow(id:string,add:boolean){if(!add)selectedRecords.clear();const row=page.rows.find(value=>value.id===id);if(row)selectedRecords.set(id,row.cells);selectedRows=add?(selectedRows.includes(id)?selectedRows.filter(x=>x!==id):[...selectedRows,id]):[id];void stats()}
 function selectColumn(index:number){selectedColumns=selectedColumns.includes(index)?selectedColumns.filter(x=>x!==index):[...selectedColumns,index];void stats()}
 function sortBy(column:number){sort=sort?.column===column?{column,descending:!sort.descending,numeric}:{column,descending:false,numeric};}
 function setFilter(column:number,value:string){filters={...filters,[column]:value}}
 async function copyMarkdown(){try{const text=await window.freya.tableMarkdown(doc.id,{scope:selectedRows.length?'selection':'filtered',rowIds:$state.snapshot(selectedRows),columns:selectedColumns.length?$state.snapshot(selectedColumns):undefined,query:query()});await navigator.clipboard.writeText(text);onstatus('Tabla Markdown copiada')}catch(error){onerror(String(error))}}
 async function paste(event:ClipboardEvent,rowId:string,column:number){if(doc.readonly)return;const value=event.clipboardData?.getData('text/plain');if(value===undefined)return;if((event.target as HTMLElement).tagName==='INPUT'&&!value.includes('\t')&&!value.includes('\n'))return;event.preventDefault();try{const lines=parse(value,{delimiter:'\t',relax_column_count:true,skip_empty_lines:false}) as string[][];await edit({type:'paste',rowId,column,values:lines})}catch(error){onerror(String(error))}}
 async function copyCells(){try{const columns=selectedColumns.length?selectedColumns:(doc.headers??[]).map((_,i)=>i);const values=selectedRows.map(id=>columns.map(index=>selectedRecords.get(id)?.[index]??''));await navigator.clipboard.writeText(stringify(values,{delimiter:'\t',record_delimiter:'\n'}));onstatus('Selección copiada')}catch(error){onerror(String(error))}}
 async function options(change:{encoding?:Encoding;delimiter?:string;header?:boolean}){try{onchange(await window.freya.tableOptions(doc.id,change));await load(0)}catch(error){onerror(String(error))}}
 export function exportOptions(scope:'all'|'filtered'|'selection'='all'):TableExport{return{scope,query:query(),rowIds:$state.snapshot(selectedRows),columns:selectedColumns.length?$state.snapshot(selectedColumns):undefined}}
 export async function undoEdit(redo=false){try{onchange(await window.freya.undo(doc.id,redo));await load(pageOffset)}catch(error){onerror(String(error))}}
</script>
<div class="csv-workspace">
 <div class="csv-toolbar">
  <div class="search-field"><span>⌕</span><input aria-label="Buscar en tabla" placeholder="Buscar en la tabla…" bind:value={search}/>{#if search}<button onclick={()=>search=''} aria-label="Borrar búsqueda">×</button>{/if}</div>
  <button class:active={showFilters} onclick={()=>showFilters=!showFilters}>☷ Filtros {Object.values(filters).filter(Boolean).length||''}</button>
  {#if search||Object.values(filters).some(Boolean)||sort}<button onclick={()=>{search='';filters={};sort=undefined}}>Quitar filtros y orden</button>{/if}
  <label class="check-label"><input type="checkbox" bind:checked={numeric} onchange={()=>{if(sort)sort={...sort,numeric}}}/>Orden numérico</label>
  <button onclick={()=>showReplace=!showReplace}>Reemplazar</button>
  <span class="spacer"></span><span class="muted">{busy?'Procesando…':`${page.matched.toLocaleString()} de ${page.total.toLocaleString()} filas`}</span>
 </div>
 {#if doc.warning||doc.readonly}<div class="warning-banner">{doc.warning??'Solo lectura'}{#if page.sample} Los filtros y recuentos describen únicamente la muestra.{/if}</div>{/if}
 {#if showReplace}<form class="csv-toolbar" onsubmit={event=>{event.preventDefault();void edit({type:'replace',find:replaceFind,replacement:replaceWith,column:selectedColumns.length===1?selectedColumns[0]:undefined})}}><input aria-label="Buscar valor para reemplazar" placeholder="Buscar valor" bind:value={replaceFind}/><input aria-label="Nuevo valor" placeholder="Reemplazar por" bind:value={replaceWith}/><span class="muted">{selectedColumns.length===1?'Columna seleccionada':'Todas las columnas'}</span><button disabled={doc.readonly||!replaceFind} type="submit">Reemplazar coincidencias</button></form>{/if}
 <div class="csv-options"><label>Codificación <select value={doc.encoding} disabled={doc.dirty} onchange={e=>void options({encoding:e.currentTarget.value as Encoding})}><option value="utf8">UTF-8</option><option value="utf16le">UTF-16 LE</option><option value="win1252">Windows-1252</option></select></label><label>Separador <select value={doc.delimiter} disabled={doc.dirty} onchange={e=>void options({delimiter:e.currentTarget.value})}><option value=",">Coma</option><option value=";">Punto y coma</option><option value={'\t'}>Tabulación</option><option value="|">Barra vertical</option></select></label><label class="check-label"><input type="checkbox" bind:checked={header} disabled={doc.dirty} onchange={()=>void options({header})}/>Primera fila como encabezado</label><span class="spacer"></span><button disabled={doc.readonly} onclick={()=>void edit({type:'insertRow',afterId:selectedRows.at(-1)})}>+ Fila</button><button disabled={doc.readonly} onclick={()=>void edit({type:'insertColumn',index:doc.headers?.length??0,name:`Columna ${(doc.headers?.length??0)+1}`})}>+ Columna</button><button disabled={doc.readonly||!selectedRows.length} onclick={()=>void edit({type:'deleteRows',ids:selectedRows})}>Eliminar filas</button><button disabled={doc.readonly||selectedColumns.length!==1} onclick={()=>void edit({type:'deleteColumn',index:selectedColumns[0]})}>Eliminar columna</button></div>
 <div class="csv-scroll" bind:this={scrollElement} role="grid" aria-label="Tabla de datos" aria-rowcount={page.matched+1} aria-colcount={(doc.headers?.length??0)+1} tabindex="0" onkeydown={event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='c'&&selectedRows.length&&(event.target as HTMLElement).tagName!=='INPUT'){event.preventDefault();void copyCells()}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();void undoEdit(event.shiftKey)}}}>
  <div class="virtual-table" style:height={`${$rowsVirtual.getTotalSize()}px`} style:width={`${Math.max($columnsVirtual.getTotalSize(),scrollElement?.clientWidth??0)}px`}>
   <div class="csv-header" role="row" style:height={showFilters?'76px':'40px'}>
    <div class="row-number corner">#</div>
    {#each $columnsVirtual.getVirtualItems() as col (col.key)}
     <div class="column-header" role="columnheader" aria-sort={sort?.column===col.index?(sort.descending?'descending':'ascending'):'none'} style:left={`${col.start}px`} style:width={`${col.size}px`}>
      {#if editingHeader?.index===col.index}<input class="column-filter" aria-label="Nombre del encabezado" bind:value={editingHeader.value} use:focus onblur={()=>{if(editingHeader){void edit({type:'header',index:col.index,name:editingHeader.value});editingHeader=null}}} onkeydown={event=>{if(event.key==='Enter')event.currentTarget.blur();else if(event.key==='Escape')editingHeader=null}}/>{:else}<div class="column-title"><input class="column-select" type="checkbox" aria-label={`Seleccionar columna ${doc.headers?.[col.index]}`} checked={selectedColumns.includes(col.index)} onchange={()=>selectColumn(col.index)}/><button class="sort-button" title="Ordenar columna" onclick={()=>sortBy(col.index)}>{doc.headers?.[col.index]||`Columna ${col.index+1}`} {sort?.column===col.index?(sort.descending?'↓':'↑'):''}</button><button class="header-edit" title="Editar encabezado" aria-label={`Editar encabezado ${col.index+1}`} disabled={doc.readonly} onclick={()=>editingHeader={index:col.index,value:doc.headers?.[col.index]??''}}>✎</button></div>{/if}
      {#if showFilters}<input class="column-filter" aria-label={`Filtrar ${doc.headers?.[col.index]}`} placeholder="Contiene…" value={filters[col.index]??''} oninput={e=>setFilter(col.index,e.currentTarget.value)}/>{/if}
     </div>
    {/each}
   </div>
   {#each $rowsVirtual.getVirtualItems() as virtualRow (virtualRow.key)}
    {@const row=renderedRows[virtualRow.index-pageOffset]}
    {#if row}<div class="csv-row" class:selected={selectedRows.includes(row.id)} role="row" style:transform={`translateY(${virtualRow.start}px)`} style:height={`${virtualRow.size}px`}>
     <button class="row-number" aria-label={`Seleccionar fila ${virtualRow.index+1}`} onclick={event=>selectRow(row.id,event.metaKey||event.ctrlKey||event.shiftKey)}>{virtualRow.index+1}</button>
     {#each $columnsVirtual.getVirtualItems() as col (col.key)}
      <div class="csv-cell" class:column-selected={selectedColumns.includes(col.index)} role="gridcell" tabindex="0" aria-label={`Fila ${virtualRow.index+1}, ${doc.headers?.[col.index]}`} style:left={`${col.start}px`} style:width={`${col.size}px`} ondblclick={()=>{if(!doc.readonly)editing={rowId:row.id,column:col.index,value:row.cells[col.index]??''}}} onkeydown={event=>{if(!doc.readonly&&(event.key==='Enter'||event.key==='F2')){event.preventDefault();editing={rowId:row.id,column:col.index,value:row.cells[col.index]??''}}}} onpaste={event=>void paste(event,row.id,col.index)}>
       {#if editing?.rowId===row.id&&editing?.column===col.index}<input class="cell-input" aria-label="Editar celda" bind:value={editing.value} use:focus onblur={()=>{if(editing)void edit({type:'cell',rowId:row.id,column:col.index,value:editing.value})}} onkeydown={event=>{if(event.key==='Enter'&&editing){event.preventDefault();event.currentTarget.blur()}else if(event.key==='Escape'){editing=null}}}/>{:else}<span title={row.cells[col.index]??''}>{row.cells[col.index]??''}</span>{/if}
      </div>
     {/each}
    </div>{/if}
   {/each}
  </div>
  {#if !page.matched&&!busy}<div class="table-empty">No hay filas que coincidan. <button onclick={()=>void edit({type:'insertRow'})} disabled={doc.readonly}>Añadir fila</button></div>{/if}
 </div>
 <div class="selection-bar"><span>{selectedRows.length?`${selectedRows.length} filas seleccionadas`:'Selecciona filas para consultar estadísticas'}</span>{#if selectionStats}<span>Vacíos: {selectionStats.empty} · Únicos: {selectionStats.unique}</span>{#if selectionStats.numeric}<span>Suma: {selectionStats.sum?.toLocaleString()} · Media: {selectionStats.average?.toLocaleString()} · Mín: {selectionStats.min?.toLocaleString()} · Máx: {selectionStats.max?.toLocaleString()}</span>{/if}{/if}<span class="spacer"></span><button onclick={copyMarkdown}>Copiar como Markdown</button></div>
</div>
<script lang="ts" module>
 function focus(node:HTMLInputElement){node.focus();node.select()}
</script>
