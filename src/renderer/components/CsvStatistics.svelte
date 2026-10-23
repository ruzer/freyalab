<script lang="ts">
 import Icon from './Icon.svelte'
 import {onDestroy,onMount,tick} from 'svelte'
 import {STATISTICS_FIELDS,NUMERIC_DETAIL_FIELDS,NUMERIC_DETAIL_HELP,statisticsReport,type ReportContext,type StatisticsRow} from '../lib/statistics-report'
 import CsvColumnAnalysis from './CsvColumnAnalysis.svelte'
 import CsvColumnsOverview from './CsvColumnsOverview.svelte'
 import type {DocumentInfo,TableQuery,TableRange,TableViewMeta} from '../../shared/types'
 let {doc,autofocus=true,columns,range,query,queryValid,viewMeta,onclose,onerror,onreport}:{doc:DocumentInfo;autofocus?:boolean;columns:number[];range:TableRange|null;query:TableQuery;queryValid:boolean;viewMeta:TableViewMeta;onclose:()=>void;onerror:(message:string)=>void;onreport:(markdown:string)=>Promise<void>}=$props()
 let exploring=$state(false),overviewing=$state(false),explorationColumn=$state(0),explorationScope=$state<'all'|'view'>('all')
 let scope=$state('all'),busy=$state(false),results=$state<StatisticsRow[]>([]),numericDetails=$state(false)
 let message=$state('Elige columnas y pulsa Analizar.'),revision=$state(-1),total=$state(0),analyzedScope=$state(''),heading:HTMLHeadingElement
 let reportContext=$state<ReportContext|null>(null),reporting=$state(false)
 let request=0,active:string|undefined
 const usingRange=$derived(scope==='range'||scope==='rangeColumns')
 const fields=$derived([...STATISTICS_FIELDS,...(numericDetails?NUMERIC_DETAIL_FIELDS:[])])
 const scopeKey=$derived(JSON.stringify([scope,scope==='selected'?columns:null,usingRange?range:null,usingRange?queryValid:null]))
 onMount(()=>{if(autofocus)heading.focus();return window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress&&event.progress.requestId===active)message=`Calculando: ${event.progress.rows.toLocaleString()} filas revisadas.`})})
 onDestroy(cancel)
 function cancel(){request++;if(active)void window.freya.cancelAnalysis(doc.id,active).catch(()=>{});active=undefined;busy=false;results=[];reportContext=null;message='Análisis cancelado.'}
 $effect(()=>{void scopeKey;cancel();revision=-1;message='El alcance cambió. Pulsa Analizar para actualizar.'})
 $effect(()=>{if(revision>=0&&doc.revision!==revision){cancel();revision=-1;message='Los datos cambiaron. Vuelve a analizar para obtener resultados actuales.'}})
 $effect(()=>{if((exploring||overviewing)&&busy)cancel()})
 async function inspectColumn(column:number,scope:'all'|'view'){explorationColumn=column;explorationScope=scope;overviewing=false;exploring=true;await tick();heading.focus()}
 async function analyze(){
  if(usingRange&&(!range||!queryValid)){onerror('Selecciona un rango de una vista válida para analizar.');return}
  const captured=usingRange&&range?structuredClone($state.snapshot(range)):undefined
  const selected=scope==='range'?[-1]:scope==='rangeColumns'&&captured?Array.from({length:captured.right-captured.left+1},(_,i)=>captured.left+i):scope==='all'?(doc.headers??[]).map((_,index)=>index):$state.snapshot(columns)
  if(!selected.length){onerror('Marca al menos una columna para analizar.');return}
  // shortcut: hasta 100 resultados por consulta visual; virtualizar el panel antes de ampliar este límite.
  if(selected.length>100){onerror('Este panel admite hasta 100 columnas. Marca las columnas o reduce el rango.');return}
  cancel();const ticket=request,current=doc.revision,id=doc.id,headers=[...doc.headers??[]]
  revision=current;analyzedScope=captured?`Rango de la vista capturada: filas ${captured.top+1}–${captured.bottom+1}, columnas ${captured.left+1}–${captured.right+1}`:scope==='all'?'Todas las columnas':'Columnas marcadas al iniciar';total=selected.length;results=[];busy=true;message='Analizando columnas…'
  const context:ReportContext={source:doc.name,revision:current,sample:doc.readonly,dirty:doc.dirty,scope:analyzedScope,analyzedAt:new Date().toISOString(),query:captured?.query}
  try{
   for(const index of selected){
    const requestId=crypto.randomUUID();active=requestId
    const stats=await window.freya.stats(id,null,index<0?[]:[index],{requestId,revision:current,range:captured})
    if(ticket!==request)return
    if(doc.revision!==current||stats.revision!==current){cancel();message='Los datos cambiaron. Vuelve a analizar.';return}
    active=undefined;results=[...results,{...stats,index,name:index<0?'Celdas del rango':headers[index]||`Columna ${index+1}`}]
   }
   reportContext={...context,sample:results[0].sample};message='Análisis completo.'
  }catch(error){if(ticket===request){results=[];message='No se pudo completar el análisis. Vuelve a intentarlo.';onerror(String(error))}}
  finally{if(ticket===request){active=undefined;busy=false}}
 }
 async function report(){if(!reportContext||busy||reporting||doc.revision!==revision)return;const text=statisticsReport($state.snapshot(reportContext),$state.snapshot(results));reporting=true;try{await onreport(text)}catch(error){onerror(String(error))}finally{reporting=false}}
 function number(value:number|null){return value===null?'—':value.toLocaleString(undefined,{maximumSignificantDigits:12})}
</script>
<svelte:window onkeydown={event=>{if(event.key==='Escape'&&event.target instanceof HTMLElement&&event.target.closest('.statistics-panel')){event.preventDefault();event.stopPropagation();onclose()}}}/>
<section class="statistics-panel" aria-labelledby="csv-statistics-title">
 <div class="statistics-heading"><h3 id="csv-statistics-title" tabindex="-1" bind:this={heading}>Estadísticas por columna</h3><button aria-label="Cerrar estadísticas" onclick={onclose}><Icon name="x" size={14}/></button></div>
 {#if !exploring&&!overviewing}
 <p>{doc.readonly?'Solo muestra: los recuentos no describen el archivo completo.':usingRange?'Solo el rango de la vista seleccionada; excluye filas ocultas y encabezados.':'Documento completo: incluye las filas ocultas por búsqueda o filtros; excluye encabezados.'}</p>
 <form onsubmit={event=>{event.preventDefault();void analyze()}}>
  <label>Columnas <select aria-label="Columnas para estadísticas" bind:value={scope} disabled={busy}><option value="all">Todas las columnas</option><option value="selected" disabled={!columns.length}>Columnas marcadas</option><option value="range" disabled={!range||!queryValid}>Celdas del rango</option><option value="rangeColumns" disabled={!range||!queryValid}>Rango por columnas</option></select></label>
  <button class="primary" type="submit" disabled={busy||usingRange&&(!range||!queryValid)}>Analizar</button>
  {#if busy}<button type="button" onclick={cancel}>Cancelar análisis</button><progress aria-label="Progreso del análisis" value={results.length} max={total}></progress>{/if}
  <span role="status">{message}{busy?` ${results.length} de ${total}`:''}</span>
  <button type="button" disabled={!reportContext||busy||reporting||doc.revision!==revision} onclick={report}>Abrir informe Markdown</button>
 </form>
 <label><input type="checkbox" bind:checked={numericDetails}/>Varianza y percentiles</label>
 {#if numericDetails}<p>{NUMERIC_DETAIL_HELP}</p>{/if}
 {#if results.length||usingRange}<div class="statistics-scroll" class:reserved={usingRange} role="region" aria-label="Resultados de estadísticas">{#if results.length}<table>
  <caption>{analyzedScope} · revisión {revision}{results[0]?.sample?' · muestra limitada':''}{busy?' · parciales':''}</caption>
  <thead><tr>{#each ['Columna',...fields.map(([,label])=>label)] as title}<th scope="col">{title}</th>{/each}</tr></thead>
  <tbody>{#each results as result (result.index)}<tr><th scope="row">{result.index<0?'':`${result.index+1}. `}{result.name}</th>{#each fields as [key]}<td>{number(result[key])}</td>{/each}</tr>{/each}</tbody>
 </table>{:else}<p>Los resultados del rango aparecerán aquí al pulsar Analizar.</p>{/if}</div>{/if}
 {/if}
 {#if !overviewing}<details bind:open={exploring}><summary>{exploring?'Volver a estadísticas generales':'Explorar una columna: frecuencias, calidad y distribución'}</summary>{#if exploring}<CsvColumnAnalysis {doc} {query} {queryValid} {onerror} {onreport} bind:column={explorationColumn} bind:scope={explorationScope}/>{/if}</details>{/if}
 {#if !exploring}<details bind:open={overviewing}><summary>{overviewing?'Volver a estadísticas generales':'Comprender todas las columnas'}</summary>{#if overviewing}<CsvColumnsOverview {doc} {columns} {query} {queryValid} {viewMeta} {onerror} {onreport} oninspect={inspectColumn}/>{/if}</details>{/if}
 {#if !exploring&&!overviewing}<details><summary>Cómo interpretar los resultados</summary><p class="statistics-note">Solo consulta: los valores del archivo se conservan. Vacíos incluye campos ausentes o con espacios; Únicos compara el texto exacto. Ausentes y Solo espacios son subconjuntos de Vacíos. Los cálculos son aproximados y usan punto decimal; Excluidos cuenta textos y números fuera del rango seguro, incluidos identificadores grandes. — indica falta de datos o un resultado no representable. Cancelar descarta los resultados y evita continuar con las siguientes columnas.</p></details>{/if}
</section>
<style>
 .statistics-panel{border-bottom:1px solid var(--border);background:var(--panel);padding:10px 12px;font-size:11px;max-height:310px;overflow:auto;flex-shrink:0}
 .statistics-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.statistics-heading h3{margin:0;font-size:12px}.statistics-heading button{border:0;background:transparent;font-size:18px;padding:0 6px}
 p{margin:6px 0;color:var(--muted);line-height:1.5}form{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}label{display:flex;gap:6px;align-items:center}select,button{font-size:11px;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:5px;padding:5px 8px}button{appearance:none}button.primary{color:white}button:disabled{opacity:.5}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}progress{width:90px}form span{color:var(--muted)}
 .statistics-scroll.reserved{height:140px}.statistics-scroll{overflow:auto;max-height:140px;border:1px solid var(--border);border-radius:5px}table{border-collapse:collapse;width:100%;white-space:nowrap;font-size:11px}caption{text-align:left;padding:6px;color:var(--muted)}th,td{padding:6px 9px;border-bottom:1px solid var(--border);text-align:right}th:first-child{text-align:left;position:sticky;left:0;z-index:1;background:var(--panel)}thead th:first-child{z-index:3}thead th{position:sticky;top:0;background:var(--panel)}.statistics-note{font-size:10px}
</style>
