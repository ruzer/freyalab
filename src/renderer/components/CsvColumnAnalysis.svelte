<script lang="ts">
 import {PROFILE_FIELDS,columnReport,type ColumnReportContext} from '../lib/statistics-report'
 import {onDestroy} from 'svelte'
 import {columnSummary} from '../../shared/column-profile'
 import type {DocumentInfo,TableQuery,ColumnAnalysis,ColumnAnalysisRequest} from '../../shared/types'
 let {doc,query,queryValid,onerror,onreport,column=$bindable(0),scope=$bindable('all')}:{doc:DocumentInfo;query:TableQuery;queryValid:boolean;column?:number;scope?:'all'|'view';onerror:(message:string)=>void;onreport:(markdown:string)=>Promise<void>}=$props()
 let otherColumn=$state(-1),duplicatesOnly=$state(false),bins=$state(10)
 let result=$state<ColumnAnalysis|null>(null),busy=$state(false),message=$state('Elige una columna. El análisis no modifica los datos.'),page=$state<'profile'|'frequencies'|'distribution'|'correlation'>('profile')
 let reportContext=$state<ColumnReportContext|null>(null),reporting=$state(false)
 let active:string|null=null
 const queryKey=$derived(JSON.stringify([query.search,query.filters,query.sort,query.order,query.conditions,query.filterMode]))
 function cancel(){if(active){void window.freya.cancelAnalysis(doc.id,active).catch(()=>{});active=null}busy=false;result=null;reportContext=null}
 onDestroy(cancel)
 $effect(()=>{void doc.id;void doc.revision;void queryKey;void queryValid;cancel();message='Los datos o la vista cambiaron. Pulsa Explorar columna para actualizar.'})
 $effect(()=>{void column;void otherColumn;void scope;void duplicatesOnly;void bins;cancel();message='Opciones actualizadas. Pulsa Explorar columna.'})
 async function analyze(offset=0){
  cancel();const request:ColumnAnalysisRequest={column,otherColumn:otherColumn<0?undefined:otherColumn,query:scope==='view'?$state.snapshot(query):undefined,revision:doc.revision,requestId:crypto.randomUUID(),frequencyOffset:offset,duplicatesOnly,bins}
  const context:ColumnReportContext={source:doc.name,revision:doc.revision,sample:doc.readonly,dirty:doc.dirty,scope:doc.readonly?request.query?'Vista filtrada de la muestra':'Muestra completa':request.query?'Vista filtrada':'Documento completo',analyzedAt:new Date().toISOString(),query:request.query,columnName:doc.headers?.[column]??'',otherColumnName:doc.headers?.[otherColumn],duplicatesOnly}
  active=request.requestId;busy=true;message='Analizando columna…'
  try{const data=await window.freya.analyzeColumn(doc.id,request);if(active!==request.requestId)return;result=data;reportContext={...context,sample:data.sample};message='Exploración completa.'}
  catch(error){if(active===request.requestId){message=String(error).replace(/^.*Error: /,'');onerror(message)}}
  finally{if(active===request.requestId){active=null;busy=false}}
 }
 async function report(){if(!result||!reportContext||busy||reporting||doc.revision!==result.revision)return;reporting=true;try{await onreport(columnReport($state.snapshot(reportContext),$state.snapshot(result),page))}catch(error){onerror(String(error))}finally{reporting=false}}
 const summary=$derived(result?columnSummary(result):null)
 const number=(value:number|null)=>value===null?'—':value.toLocaleString(undefined,{maximumSignificantDigits:12})
 const columnName=(index:number)=>`${index+1}. ${doc.headers?.[index]||`Columna ${index+1}`}`
 const tabs=[['profile','Perfil'],['frequencies','Frecuencias'],['distribution','Distribución'],['correlation','Correlación']] as const
</script>
<section class="column-explorer" aria-label="Exploración de columna">
 <form onsubmit={event=>{event.preventDefault();void analyze()}}>
  <label>Columna <select aria-label="Columna para explorar" bind:value={column} disabled={busy}>{#each doc.headers??[] as name,index}<option value={index}>{index+1}. {name||`Columna ${index+1}`}</option>{/each}</select></label>
  <label>Filas <select aria-label="Filas para explorar" bind:value={scope} disabled={busy}><option value="all">{doc.readonly?'Muestra completa':'Documento completo'}</option><option value="view">{doc.readonly?'Vista de la muestra':'Vista filtrada'}</option></select></label>
  <button type="submit" disabled={busy||!queryValid||!Number.isInteger(bins)||bins<1||bins>30}>Explorar columna</button>
  {#if busy}<button type="button" onclick={()=>{cancel();message='Exploración cancelada.'}}>Cancelar exploración</button>{/if}
  <button type="button" title="Abrir como documento editable la vista actual; en frecuencias incluye solo la página cargada" disabled={!result||!reportContext||busy||reporting||doc.revision!==result.revision||page==='correlation'&&!result.correlation} onclick={report}>Abrir informe Markdown</button>
 </form>
 <p role="status">{message}</p>
 {#if doc.readonly}<p class="notice">Solo muestra: todos los resultados describen hasta 200 registros; no el archivo completo.</p>{/if}
 <div class="views" aria-label="Vistas de exploración">{#each tabs as [value,label]}<button aria-pressed={page===value} onclick={()=>page=value}>{label}</button>{/each}</div>
 {#if page==='frequencies'}<label class="option"><input type="checkbox" bind:checked={duplicatesOnly} disabled={busy}/>Solo valores repetidos</label>{/if}
 {#if page==='distribution'}<label class="option">Intervalos <input aria-label="Número de intervalos" type="number" min="1" max="30" bind:value={bins} disabled={busy}/></label>{/if}
 {#if page==='correlation'}<label class="option">Comparar con <select aria-label="Columna para correlación" bind:value={otherColumn} disabled={busy}><option value={-1}>Elige otra columna</option>{#each doc.headers??[] as name,index}<option value={index}>{index+1}. {name||`Columna ${index+1}`}</option>{/each}</select></label>{/if}
 {#if result}
  <p class="scope">{columnName(result.column)} · {result.sample?'Muestra limitada':result.filtered?'Vista filtrada':'Documento completo'} · {number(result.cells)} filas · revisión {result.revision}</p>
  {#if page==='profile'}
   {#if summary}<section class="interpretation" aria-label="Interpretación de columna"><p><strong>Tipo probable: {summary.label}</strong></p><p>{summary.reason}</p><p class="quality">{#each summary.quality as [label,value],index}{index?' · ':''}{label}: <strong>{number(value)}</strong>{/each}</p><small>Sugerencia sobre el alcance analizado. No convierte celdas ni cambia los cálculos manuales; las fechas ambiguas no se interpretan.</small></section>{/if}
   <dl aria-label="Perfil de columna">{#each PROFILE_FIELDS as [key,label]}<div><dt>{label}</dt><dd>{number(result[key])}</dd></div>{/each}</dl>
   {#if result.missingRows.length}<p>Primeras filas originales con vacíos (máximo 20; sin encabezado): {result.missingRows.map(item=>item.row).join(', ')}.</p>{/if}
  {:else if page==='frequencies'}
   <p>Valores de texto exactos, ordenados por frecuencia; empates por primera fila original. Las vistas previas largas se indican; no se agrupan por el texto recortado.</p>
   <!-- svelte-ignore a11y_no_noninteractive_tabindex (La región desplazable debe recibir foco para usar flechas y PageDown.) -->
   <div class="results-scroll" tabindex="0" role="region" aria-label="Frecuencias de columna"><table><thead><tr><th>Valor</th><th>Conteo</th><th>Porcentaje de filas</th><th>Primera fila original</th></tr></thead><tbody>{#each result.frequencies as entry}<tr><td><pre>{JSON.stringify(entry.value)}</pre>{#if entry.truncated}<small>Vista previa: primeros 256 caracteres</small>{/if}</td><td>{number(entry.count)}</td><td>{number(result.cells?entry.count/result.cells*100:0)} %</td><td>{entry.firstRow}</td></tr>{/each}</tbody></table></div>
   <div class="pagination"><button disabled={busy||result.frequencyOffset===0} onclick={()=>void analyze(Math.max(0,result!.frequencyOffset-50))}>Valores anteriores</button><span>{result.frequencyTotal?result.frequencyOffset+1:0}–{Math.min(result.frequencyOffset+50,result.frequencyTotal)} de {number(result.frequencyTotal)} valores</span><button disabled={busy||result.frequencyOffset+50>=result.frequencyTotal} onclick={()=>void analyze(result!.frequencyOffset+50)}>Valores siguientes</button></div>
  {:else if page==='distribution'}
   <p>Intervalos de igual amplitud: incluyen el límite inferior y excluyen el superior; el último incluye el máximo. Solo {number(result.numeric)} valores numéricos utilizables.</p>
   <!-- svelte-ignore a11y_no_noninteractive_tabindex (La región desplazable debe recibir foco para usar flechas y PageDown.) -->
   <div class="results-scroll" tabindex="0" role="region" aria-label="Distribución de columna"><table><thead><tr><th>Desde</th><th>Hasta</th><th>Filas</th></tr></thead><tbody>{#each result.histogram as bin}<tr><td>{number(bin.lower)}</td><td>{number(bin.upper)}</td><td>{number(bin.count)}</td></tr>{/each}</tbody></table></div>
  {:else if page==='correlation'}
   {#if result.correlation}<dl aria-label="Correlación de Pearson"><div><dt>Pearson con {columnName(result.correlation.column)}</dt><dd>{number(result.correlation.value)}</dd></div><div><dt>Pares numéricos de la misma fila</dt><dd>{number(result.correlation.pairs)}</dd></div><div><dt>Filas omitidas</dt><dd>{number(result.correlation.omitted)}</dd></div></dl><p>Pearson mide asociación lineal; no demuestra causalidad.</p>{:else}<p>Elige una columna de comparación y vuelve a explorar.</p>{/if}
  {/if}
  {#each result.warnings as warning}<p class="notice">{warning}</p>{/each}
 {/if}
 <p>Solo consulta. Vacíos incluye espacios y campos ausentes; repetidos distingue el texto exacto e incluye vacíos. Cálculos aproximados con punto decimal; se excluyen enteros fuera del rango seguro. Se conserva el texto original. Máximo 100 000 valores distintos por exploración. Cancelar detiene la recogida entre bloques; los cálculos matemáticos en curso terminan antes de descartarse.</p>
</section>
<style>
 .column-explorer{padding:8px 0;font-size:11px}.column-explorer form,.views,.pagination{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.column-explorer label{display:flex;gap:6px;align-items:center}.option{margin:8px 0}.column-explorer select{max-width:240px}.column-explorer select,.column-explorer input[type=number],.column-explorer button{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);padding:5px 8px;border-radius:5px}.column-explorer input[type=number]{width:65px}.column-explorer button[aria-pressed=true]{border-color:var(--accent);color:var(--accent)}.column-explorer button:disabled{opacity:.5}.column-explorer :focus-visible{outline:2px solid var(--accent);outline-offset:2px}.column-explorer p{color:var(--muted);line-height:1.5;margin:8px 0}.scope{font-weight:600}.notice{border-left:3px solid var(--accent);padding-left:8px}.column-explorer dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin:8px 0}.column-explorer dl div{padding:6px;background:var(--input);border-radius:5px}.column-explorer dt{color:var(--muted)}.column-explorer dd{margin:4px 0 0;font-variant-numeric:tabular-nums}.results-scroll{max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:5px}.results-scroll table{border-collapse:collapse;width:100%}.results-scroll th,.results-scroll td{padding:6px 8px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}.results-scroll th{position:sticky;top:0;background:var(--panel)}.results-scroll pre{white-space:pre-wrap;overflow-wrap:anywhere;max-width:360px;margin:0;font-size:11px}.pagination{margin-top:8px}.column-explorer small{color:var(--muted)}.interpretation{border:1px solid var(--border);border-radius:6px;padding:0 10px 8px;margin:8px 0;background:var(--input)}.interpretation strong{color:var(--text)}.quality{font-variant-numeric:tabular-nums}
</style>
