<script lang="ts">
 import {onDestroy,onMount} from 'svelte'
 import CsvColumnAnalysis from './CsvColumnAnalysis.svelte'
 import type {DocumentInfo,TableStats,TableQuery,TableRange} from '../../shared/types'
 let {doc,columns,range,query,queryValid,onclose,onerror}:{doc:DocumentInfo;columns:number[];range:TableRange|null;query:TableQuery;queryValid:boolean;onclose:()=>void;onerror:(message:string)=>void}=$props()
 let exploring=$state(false)
 let scope=$state('all'),busy=$state(false),results=$state<(TableStats&{index:number;name:string})[]>([])
 let message=$state('Elige columnas y pulsa Analizar.'),revision=$state(-1),total=$state(0),analyzedScope=$state(''),heading:HTMLHeadingElement
 let request=0,active:string|undefined
 const usingRange=$derived(scope==='range'||scope==='rangeColumns')
 const scopeKey=$derived(JSON.stringify([scope,scope==='selected'?columns:null,usingRange?range:null,usingRange?queryValid:null]))
 onMount(()=>{heading.focus();return window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress&&event.progress.requestId===active)message=`Calculando: ${event.progress.rows.toLocaleString()} filas revisadas.`})})
 onDestroy(cancel)
 function cancel(){request++;if(active)void window.freya.cancelAnalysis(doc.id,active).catch(()=>{});active=undefined;busy=false;results=[];message='Análisis cancelado.'}
 $effect(()=>{void scopeKey;cancel();revision=-1;message='El alcance cambió. Pulsa Analizar para actualizar.'})
 $effect(()=>{if(revision>=0&&doc.revision!==revision){cancel();revision=-1;message='Los datos cambiaron. Vuelve a analizar para obtener resultados actuales.'}})
 $effect(()=>{if(exploring&&busy)cancel()})
 async function analyze(){
  if(usingRange&&(!range||!queryValid)){onerror('Selecciona un rango de una vista válida para analizar.');return}
  const captured=usingRange&&range?structuredClone($state.snapshot(range)):undefined
  const selected=scope==='range'?[-1]:scope==='rangeColumns'&&captured?Array.from({length:captured.right-captured.left+1},(_,i)=>captured.left+i):scope==='all'?(doc.headers??[]).map((_,index)=>index):$state.snapshot(columns)
  if(!selected.length){onerror('Marca al menos una columna para analizar.');return}
  // shortcut: hasta 100 resultados por consulta visual; virtualizar el panel antes de ampliar este límite.
  if(selected.length>100){onerror('Este panel admite hasta 100 columnas. Marca las columnas o reduce el rango.');return}
  cancel();const ticket=request,current=doc.revision,id=doc.id,headers=[...doc.headers??[]]
  revision=current;analyzedScope=captured?`Rango de la vista capturada: filas ${captured.top+1}–${captured.bottom+1}, columnas ${captured.left+1}–${captured.right+1}`:scope==='all'?'Todas las columnas':'Columnas marcadas al iniciar';total=selected.length;results=[];busy=true;message='Analizando columnas…'
  try{
   for(const index of selected){
    const requestId=crypto.randomUUID();active=requestId
    const stats=await window.freya.stats(id,null,index<0?[]:[index],{requestId,revision:current,range:captured})
    if(ticket!==request)return
    if(doc.revision!==current||stats.revision!==current){cancel();message='Los datos cambiaron. Vuelve a analizar.';return}
    active=undefined;results=[...results,{...stats,index,name:index<0?'Celdas del rango':headers[index]||`Columna ${index+1}`}]
   }
   message='Análisis completo.'
  }catch(error){if(ticket===request){results=[];message='No se pudo completar el análisis. Vuelve a intentarlo.';onerror(String(error))}}
  finally{if(ticket===request){active=undefined;busy=false}}
 }
 function number(value:number|null){return value===null?'—':value.toLocaleString(undefined,{maximumSignificantDigits:12})}
</script>
<svelte:window onkeydown={event=>{if(event.key==='Escape'&&event.target instanceof HTMLElement&&event.target.closest('.statistics-panel')){event.preventDefault();event.stopPropagation();onclose()}}}/>
<section class="statistics-panel" aria-labelledby="csv-statistics-title">
 <div class="statistics-heading"><h3 id="csv-statistics-title" tabindex="-1" bind:this={heading}>Estadísticas por columna</h3><button aria-label="Cerrar estadísticas" onclick={onclose}>×</button></div>
 {#if !exploring}
 <p>{doc.readonly?'Solo muestra: los recuentos no describen el archivo completo.':usingRange?'Solo el rango de la vista seleccionada; excluye filas ocultas y encabezados.':'Documento completo: incluye las filas ocultas por búsqueda o filtros; excluye encabezados.'}</p>
 <form onsubmit={event=>{event.preventDefault();void analyze()}}>
  <label>Columnas <select aria-label="Columnas para estadísticas" bind:value={scope} disabled={busy}><option value="all">Todas las columnas</option><option value="selected" disabled={!columns.length}>Columnas marcadas</option><option value="range" disabled={!range||!queryValid}>Celdas del rango</option><option value="rangeColumns" disabled={!range||!queryValid}>Rango por columnas</option></select></label>
  <button class="primary" type="submit" disabled={busy||usingRange&&(!range||!queryValid)}>Analizar</button>
  {#if busy}<button type="button" onclick={cancel}>Cancelar análisis</button><progress aria-label="Progreso del análisis" value={results.length} max={total}></progress>{/if}
  <span role="status">{message}{busy?` ${results.length} de ${total}`:''}</span>
 </form>
 {#if results.length||usingRange}<div class="statistics-scroll" class:reserved={usingRange} role="region" aria-label="Resultados de estadísticas">{#if results.length}<table>
  <caption>{analyzedScope} · revisión {revision}{results[0]?.sample?' · muestra limitada':''}{busy?' · parciales':''}</caption>
  <thead><tr>{#each ['Columna','Celdas','Vacíos','Únicos','Numéricos','Suma','Media','Mínimo','Máximo','Mediana','Desv. poblacional (n)','Desv. muestral (n−1)','Ausentes','Solo espacios','Excluidos'] as title}<th scope="col">{title}</th>{/each}</tr></thead>
  <tbody>{#each results as result (result.index)}<tr><th scope="row">{result.index<0?'':`${result.index+1}. `}{result.name}</th>{#each [result.cells,result.empty,result.unique,result.numeric,result.sum,result.average,result.min,result.max,result.median,result.deviation,result.sampleDeviation,result.missing,result.whitespace,result.excluded] as value}<td>{number(value)}</td>{/each}</tr>{/each}</tbody>
 </table>{:else}<p>Los resultados del rango aparecerán aquí al pulsar Analizar.</p>{/if}</div>{/if}
 {/if}
 <details bind:open={exploring}><summary>{exploring?'Volver a estadísticas generales':'Explorar una columna: frecuencias, calidad y distribución'}</summary>{#if exploring}<CsvColumnAnalysis {doc} {query} {queryValid} {onerror}/>{/if}</details>
 {#if !exploring}<details><summary>Cómo interpretar los resultados</summary><p class="statistics-note">Solo consulta: los valores del archivo se conservan. Vacíos incluye campos ausentes o con espacios; Únicos compara el texto exacto. Ausentes y Solo espacios son subconjuntos de Vacíos. Los cálculos son aproximados y usan punto decimal; Excluidos cuenta textos y números fuera del rango seguro, incluidos identificadores grandes. — indica falta de datos o un resultado no representable. Cancelar descarta los resultados y evita continuar con las siguientes columnas.</p></details>{/if}
</section>
<style>
 .statistics-panel{border-bottom:1px solid var(--border);background:var(--panel);padding:10px 12px;font-size:11px;max-height:310px;overflow:auto;flex-shrink:0}
 .statistics-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.statistics-heading h3{margin:0;font-size:12px}.statistics-heading button{border:0;background:transparent;font-size:18px;padding:0 6px}
 p{margin:6px 0;color:var(--muted);line-height:1.5}form{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}label{display:flex;gap:6px;align-items:center}select,button{font-size:11px;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:5px;padding:5px 8px}button{appearance:none}button.primary{color:white}button:disabled{opacity:.5}button:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}progress{width:90px}form span{color:var(--muted)}
 .statistics-scroll.reserved{height:140px}.statistics-scroll{overflow:auto;max-height:140px;border:1px solid var(--border);border-radius:5px}table{border-collapse:collapse;width:100%;white-space:nowrap;font-size:11px}caption{text-align:left;padding:6px;color:var(--muted)}th,td{padding:6px 9px;border-bottom:1px solid var(--border);text-align:right}th:first-child{text-align:left;position:sticky;left:0;z-index:1;background:var(--panel)}thead th:first-child{z-index:3}thead th{position:sticky;top:0;background:var(--panel)}.statistics-note{font-size:10px}
</style>
