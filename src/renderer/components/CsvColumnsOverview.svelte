<script lang="ts">
 import {onDestroy} from 'svelte'
 import {columnSummary} from '../../shared/column-profile'
 import {columnOverviewReport,type ReportContext} from '../lib/statistics-report'
 import type {DocumentInfo,TableQuery,ColumnOverviewRow,TableViewMeta} from '../../shared/types'
 let {doc,columns,query,queryValid,viewMeta,onerror,onreport,oninspect}:{doc:DocumentInfo;columns:number[];query:TableQuery;queryValid:boolean;viewMeta:TableViewMeta;onerror:(message:string)=>void;onreport:(markdown:string)=>Promise<void>;oninspect:(column:number,scope:'all'|'view')=>void}=$props()
 let scope=$state<'all'|'view'>('all'),selection=$state('all'),busy=$state(false),reporting=$state(false),results=$state<ColumnOverviewRow[]>([])
 let message=$state('Pulsa Explorar columnas para comprender este archivo.'),total=$state(0),rowCount=$state(0),search=$state(''),offset=$state(0),context=$state<ReportContext|null>(null)
 let serial=0,active:{id:string;requestId:string}|null=null,timer:ReturnType<typeof setTimeout>|undefined
 const viewKey=(query:TableQuery)=>JSON.stringify([query.search,query.filters,query.sort,query.order,query.conditions,query.filterMode])
 const viewReady=$derived(queryValid&&viewMeta.requestId>0&&viewMeta.revision===doc.revision&&viewMeta.sample===doc.readonly&&viewKey(query)===viewKey(viewMeta.query))
 const scopeKey=$derived(scope==='view'?JSON.stringify([scope,viewKey(query),viewReady]):scope)
 const scopeReady=$derived(scope==='all'?doc.rowCount!==undefined&&Number.isSafeInteger(doc.rowCount)&&doc.rowCount>=0:viewReady)
 const selectionKey=$derived(selection==='selected'?JSON.stringify(columns):'all')
 const visible=$derived(results.filter(row=>`${row.column+1}. ${row.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())))
 const failed=$derived(results.filter(row=>'error'in row).length)
 function cancel(){serial++;clearTimeout(timer);if(active)void window.freya.cancelAnalysis(active.id,active.requestId).catch(()=>{});active=null;busy=false;results=[];context=null;offset=0}
 onDestroy(cancel)
 $effect(()=>{void doc.id;void doc.revision;void scopeKey;void selectionKey;cancel();message='Datos o alcance actualizados. Pulsa Explorar columnas.'})
 $effect(()=>{void search;offset=0})
 async function explore(){
  if(!scopeReady){onerror('Espera a que se cargue el alcance elegido antes de explorar.');return}
  cancel();const ticket=serial,id=doc.id,revision=doc.revision,headers=[...doc.headers??[]],capturedScope=scope,capturedQuery=scope==='view'?$state.snapshot(query):undefined
  const selected=selection==='all'?headers.map((_,index)=>index):[...new Set($state.snapshot(columns))].sort((a,b)=>a-b)
  if(!selected.length){message='Marca al menos una columna en la tabla.';return}
  if(selected.length>2000){message='Explora hasta 2 000 columnas por solicitud. Marca las que quieras analizar.';return}
  total=selected.length;rowCount=0;busy=true;message='Comprobando filas del alcance…'
  timer=setTimeout(()=>{if(ticket===serial){cancel();message='La exploración superó dos minutos. Reduce las columnas o filtra las filas y vuelve a intentarlo.'}},120000)
  try{
   const matched=capturedQuery?viewMeta.matched:doc.rowCount,capturedSample=doc.readonly
   if(matched===undefined||!Number.isSafeInteger(matched)||matched<0)throw new Error('El alcance no tiene un recuento válido. Vuelve a abrir el archivo.')
   if(matched*selected.length>2_000_000)throw new Error('El alcance supera dos millones de posiciones de celdas. Marca menos columnas o elige una vista filtrada.')
   rowCount=matched
   const captured:ReportContext={source:doc.name,revision,sample:capturedSample,dirty:doc.dirty,scope:`${capturedSample?capturedQuery?'Vista filtrada de la muestra':'Muestra completa':capturedQuery?'Vista filtrada':'Documento completo'} · ${selection==='all'?'Todas las columnas':'Columnas marcadas al iniciar'}`,analyzedAt:new Date().toISOString(),query:capturedQuery}
   context=captured
   for(const column of selected){
    const requestId=crypto.randomUUID();active={id,requestId};message=`Explorando columna ${results.length+1} de ${total}…`
    try{
     const data=await window.freya.analyzeColumn(id,{column,query:capturedQuery,revision,requestId,frequencyOffset:0,duplicatesOnly:false,bins:10})
     if(ticket!==serial)return
     if(data.revision!==revision||doc.id!==id||doc.revision!==revision||data.cells!==rowCount||data.sample!==capturedSample)throw new Error('Los datos cambiaron. Vuelve a explorar.')
     const {profile,cells,empty,missing,whitespace,numeric,unique,extraDuplicates,sample,filtered}=data
     results=[...results,{column,name:headers[column],result:{profile,cells,empty,missing,whitespace,numeric,unique,extraDuplicates,revision,sample,filtered}}]
    }catch(error){
     if(ticket!==serial)return
     const detail=String(error).replace(/^.*Error: /,'')
     if(!detail.includes('100 000 valores distintos'))throw error
     const current=(await window.freya.documents()).find(value=>value.id===id)
     if(ticket!==serial)return
     if(!current||current.revision!==revision)throw new Error('Los datos cambiaron. Vuelve a explorar.')
     results=[...results,{column,name:headers[column],error:detail}]
    }finally{if(ticket===serial)active=null}
   }
   message=failed?`Exploración terminada: ${results.length-failed} columnas analizadas; ${failed} no disponibles.`:'Exploración de columnas completa.'
  }catch(error){if(ticket===serial){results=[];context=null;message=String(error).replace(/^.*Error: /,'');onerror(message)}}
  finally{if(ticket===serial){clearTimeout(timer);active=null;busy=false}}
 }
 async function report(){if(!context||busy||reporting||doc.revision!==context.revision)return;reporting=true;try{await onreport(columnOverviewReport($state.snapshot(context),$state.snapshot(results)))}catch(error){onerror(String(error))}finally{reporting=false}}
 const number=(value:number)=>value.toLocaleString()
</script>
<section class="columns-overview" aria-label="Vista general de columnas">
 <p>Comprende las columnas sin cambiar el archivo. No se ejecuta automáticamente al abrirlo.</p>
 <form onsubmit={event=>{event.preventDefault();void explore()}}>
  <label>Columnas <select aria-label="Columnas para explorar" bind:value={selection} disabled={busy}><option value="all">Todas las columnas</option><option value="selected" disabled={!columns.length}>Columnas marcadas</option></select></label>
  <label>Filas <select aria-label="Alcance de la vista general" bind:value={scope} disabled={busy}><option value="all">{doc.readonly?'Muestra completa':'Documento completo'}</option><option value="view">{doc.readonly?'Vista filtrada de la muestra':'Vista filtrada'}</option></select></label>
  <button type="submit" disabled={busy||!scopeReady}>Explorar columnas</button>
  {#if busy}<button type="button" onclick={()=>{cancel();message='Exploración de columnas cancelada.'}}>Cancelar exploración de columnas</button><progress aria-label="Progreso de exploración de columnas" value={results.length} max={total}></progress>{/if}
  <button type="button" disabled={!context||busy||reporting||doc.revision!==context.revision} onclick={report}>Abrir informe de columnas Markdown</button>
 </form>
 <p role="status">{message}</p>
 {#if doc.readonly}<p class="notice">Solo muestra: los perfiles describen hasta 200 registros; no el archivo completo.</p>{/if}
 {#if results.length}
  <p class="scope">{context?.scope??(doc.readonly?scope==='view'?'Vista filtrada de la muestra':'Muestra completa':scope==='view'?'Vista filtrada':'Documento completo')} · revisión {context?.revision??doc.revision} · {number(rowCount)} filas por columna · {results.length} de {total} columnas{busy?' · en curso; resultados provisionales':''}{failed?' · cobertura parcial':''}</p>
  <label>Buscar columnas <input aria-label="Buscar nombres de columnas" bind:value={search} type="search" placeholder="Nombre o posición"/></label>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (La tabla desplazable debe recibir foco para usar flechas y PageDown.) -->
  <div class="overview-scroll" role="region" aria-label="Perfiles de columnas" tabindex="0"><table>
   <caption>Buscar y paginar solo cambia la lista visible. El informe incluye todas las columnas solicitadas.</caption>
   <thead><tr>{#each ['Columna','Tipo probable','Con contenido','Ausentes','Vacíos exactos','Solo espacios','Distintos exactos','Repeticiones adicionales','Detalle'] as title}<th scope="col">{title}</th>{/each}</tr></thead>
   <tbody>{#each visible.slice(offset,offset+50) as entry(entry.column)}<tr>
    <th scope="row">{entry.column+1}. {entry.name||`Columna ${entry.column+1}`}</th>
    {#if 'result'in entry}{@const summary=columnSummary(entry.result)}<td><details class="type-explanation"><summary>{summary.label}</summary><p>{summary.reason}</p></details></td>{#each [entry.result.cells-entry.result.empty,entry.result.missing,entry.result.empty-entry.result.missing-entry.result.whitespace,entry.result.whitespace,entry.result.unique,entry.result.extraDuplicates] as value}<td>{number(value)}</td>{/each}
    {:else}<td>No disponible</td><td colspan="6" class="unavailable">{entry.error}</td>{/if}
    <td><button type="button" disabled={busy} aria-label={`Elegir columna ${entry.column+1} para explorar`} onclick={()=>oninspect(entry.column,scope)}>Explorar detalle</button></td>
   </tr>{/each}</tbody>
  </table></div>
  <div class="pagination"><button disabled={offset===0} onclick={()=>offset=Math.max(0,offset-50)}>Columnas anteriores</button><span>{visible.length?offset+1:0}–{Math.min(offset+50,visible.length)} de {number(visible.length)} columnas visibles</span><button disabled={offset+50>=visible.length} onclick={()=>offset+=50}>Columnas siguientes</button></div>
 {/if}
 <details><summary>Cómo interpretar esta vista</summary><p>Tipos orientativos, no conversiones. Los recuentos de ausentes, vacíos exactos y espacios son diferentes. Repetir categorías es normal. Distintos y repeticiones usan texto exacto, incluidos vacíos. El detalle permite consultar la explicación, frecuencias y distribución. Hasta 2 000 columnas y dos millones de posiciones de celdas por solicitud. Si una columna supera 100 000 valores distintos se indica como no disponible y se continúa con las demás. Cancelar descarta la vista y detiene el trabajo entre bloques; los cálculos síncronos en curso terminan antes de descartarse.</p></details>
</section>
<style>
 .columns-overview{font-size:11px;padding:8px 0}.columns-overview p{color:var(--muted);line-height:1.5;margin:8px 0}form,.pagination{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}label{display:inline-flex;gap:6px;align-items:center}button,input,select{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:5px;padding:5px 8px}input{max-width:240px}button:disabled{opacity:.5}.columns-overview :focus-visible{outline:2px solid var(--accent);outline-offset:2px}progress{width:90px}.notice{border-left:3px solid var(--accent);padding-left:8px}.scope{font-weight:600}.overview-scroll{max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:5px}table{border-collapse:collapse;white-space:nowrap;width:100%}caption{text-align:left;color:var(--muted);padding:6px;white-space:normal}th,td{padding:6px 8px;border-bottom:1px solid var(--border);text-align:right}th:first-child,td:nth-child(2){text-align:left}thead th{position:sticky;top:0;background:var(--panel)}.type-explanation p{white-space:normal;max-width:300px;min-width:180px;text-align:left}.unavailable{white-space:normal;max-width:320px;text-align:left}
</style>
