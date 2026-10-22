<script lang="ts">
 import {onMount,onDestroy} from 'svelte'
 import {init,use,type ECharts} from 'echarts/core'
 import {BarChart,LineChart,ScatterChart,HeatmapChart,BoxplotChart} from 'echarts/charts'
 import {GridComponent,TooltipComponent,VisualMapComponent,AriaComponent,TitleComponent,LegendComponent} from 'echarts/components'
 import {SVGRenderer} from 'echarts/renderers'
 import {chartKinds,chartAggregates,chartLabels,chartSQL,chartData,chartLimit,type ChartOptions,type ChartData} from '../../shared/charts'
 import {chartOption,chartSeries} from '../chart-option'
 import type {DocumentInfo,SqlResult,TableQuery} from '../../shared/types'
 use([BarChart,LineChart,ScatterChart,HeatmapChart,BoxplotChart,GridComponent,TooltipComponent,VisualMapComponent,AriaComponent,TitleComponent,LegendComponent,SVGRenderer])
 let {doc,query,queryValid,onclose,onerror}:{doc:DocumentInfo;query:TableQuery;queryValid:boolean;onclose:()=>void;onerror:(message:string)=>void}=$props()
 let scope=$state<'all'|'filtered'>('all')
 const scopeLabel=$derived(scope==='all'?'Documento completo':'Vista filtrada actual')
 const viewSignature=$derived(JSON.stringify([query.search,query.filters,query.conditions,query.filterMode]))
 const unavailable=$derived(scope==='filtered'&&(!queryValid||doc.readonly))
 let options=$state<ChartOptions>({kind:'bar',x:0,y:-1,bins:10,aggregate:'count',descending:false,measureType:'text',series:-1})
 const axes=$derived(chartLabels(doc.headers??[],options))
 let data=$state<ChartData|null>(null),source=$state<SqlResult['sources'][number]|null>(null),busy=$state(false),message=$state('Elige las columnas y pulsa Generar gráfico.'),tablePage=$state(0),ready=$state(false),zoom=$state(1),exporting=$state(false)
 let hiddenSeries=$state<string[]>([])
 const series=$derived(data?chartSeries(data):[])
 let element:HTMLDivElement,chart:ECharts|undefined,active:string|undefined
 const signature=$derived(JSON.stringify([doc.id,doc.revision,options,scope,scope==='filtered'?viewSignature:null]))
 const tooWide=$derived((doc.headers?.length??0)>200)
 const sql=$derived.by(()=>{try{return chartSQL(doc.headers??[],options)}catch{return ''}})
 function cancel(){const previous=active;active=undefined;busy=false;data=null;source=null;tablePage=0;hiddenSeries=[];if(previous)void window.freya.sqlCancel(previous).catch(()=>{})}
 $effect(()=>{void signature;cancel();message='Opciones o datos actualizados. Pulsa Generar gráfico.'})
 onDestroy(cancel)
 onMount(()=>{
  chart=init(element,undefined,{renderer:'svg'});ready=true
  chart.on('legendselectchanged',event=>{const {selected}=event as {selected:Record<string,boolean>};hiddenSeries=Object.keys(selected).filter(name=>!selected[name])})
  const resize=new ResizeObserver(()=>chart?.resize());resize.observe(element)
  const theme=new MutationObserver(()=>draw());theme.observe(document.documentElement,{attributes:true,attributeFilter:['class']})
  const unsubscribe=window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress&&event.progress.requestId===active)message=event.progress.phase;else if(event.id===doc.id&&event.type==='external'){cancel();message='El archivo cambió en disco. Genera de nuevo el gráfico.'}})
  return()=>{resize.disconnect();theme.disconnect();unsubscribe();chart?.dispose();chart=undefined}
 })
 function draw(){if(!chart||!data)return;try{const css=getComputedStyle(element);chart.setOption(chartOption(data,$state.snapshot(options),{text:css.getPropertyValue('--text').trim(),background:css.getPropertyValue('--panel').trim(),accent:css.getPropertyValue('--accent').trim()},doc.headers,scopeLabel,hiddenSeries),{notMerge:true})}catch(error){chart.clear();data=null;message=String(error);onerror(message)}}
 $effect(()=>{if(ready){if(data)draw();else chart?.clear()}})
 async function generate(){
  if(busy||!sql||tooWide||unavailable)return;cancel();const requestId=crypto.randomUUID();active=requestId;busy=true;message='Preparando gráfico…'
  try{
   const first=await window.freya.sqlRun({requestId,sources:[{id:doc.id,revision:doc.revision,...scope==='filtered'?{query:$state.snapshot(query)}:{}}],sql})
   if(active!==requestId)return
   if(first.limited||first.returnedRows>chartLimit(options.kind)+1)throw new Error('El resultado excedió el límite del gráfico.')
   const rows=[...first.rows]
   for(let offset=100;offset<first.returnedRows;offset+=100){const page=await window.freya.sqlPage(requestId,offset);if(active!==requestId)return;rows.push(...page.rows)}
   const result=chartData(options.kind,first.columns.map(c=>c.name),rows)
   if(result.total>0&&result.usable===0&&options.kind!=='heatmap'&&!(options.kind==='bar'&&['count','distinct'].includes(options.aggregate)))throw new Error('No hay valores numéricos utilizables en las columnas elegidas. Elige otra columna o cuenta filas o valores únicos.')
   data=result;source=first.sources[0];message='Gráfico listo. El archivo no se ha modificado.';zoom=1
  }catch(error){if(active===requestId){data=null;message=String(error).replace(/^.*Error: /,'');onerror(message)}}
  finally{if(active===requestId){active=undefined;busy=false;void window.freya.sqlCancel(requestId).catch(()=>{})}}
 }
 async function exportChart(format:'svg'|'png'|'pdf'){
  if(!data||!source||!chart||busy||exporting)return;exporting=true;message='Exportando gráfico…'
  try{const svg=chart.renderToSVGString();const path=await window.freya.exportGraphic(doc.id,{format,svg,revision:source.revision});message=path?`Gráfico exportado: ${path}`:'Exportación cancelada.'}catch(error){message=String(error);onerror(message)}finally{exporting=false}
 }
 const headings:Record<string,string>={x:'Eje X / categoría',value:'Valor / mediana',upper:'Límite superior',fila:'Fila de la fuente analizada',y:'Categoría Y',q1:'Cuartil 1',q3:'Cuartil 3',low:'Bigote inferior',high:'Bigote superior',series:'Serie (texto exacto)',outliers:'Atípicos totales',count:'Numéricos',atypical:'Primeros atípicos (máx. 20)'}
</script>
<svelte:window onkeydown={event=>{if(event.key==='Escape'&&event.target instanceof HTMLElement&&event.target.closest('.charts-panel')){event.preventDefault();onclose()}}}/>
<section class="charts-panel" aria-label="Gráficos del CSV">
 <header><h3>Explorar con gráficos</h3><button aria-label="Cerrar gráficos" onclick={onclose}>×</button></header>
 <p>Fuente: {doc.name}. Los gráficos no modifican el CSV. Elige qué comparar y qué datos incluir.</p>
 <form onsubmit={event=>{event.preventDefault();void generate()}}>
  <fieldset disabled={busy||exporting}><legend class="sr-only">Opciones del gráfico</legend>
   <label>Datos incluidos <select aria-label="Alcance del gráfico" bind:value={scope}><option value="all">Documento completo</option><option value="filtered" disabled={doc.readonly}>Vista filtrada actual</option></select></label>
   <label>Gráfico <select aria-label="Tipo de gráfico" bind:value={options.kind} onchange={event=>{if(!['bar','line','scatter'].includes(event.currentTarget.value))options.series=-1}}>{#each Object.entries(chartKinds) as [kind,title]}<option value={kind}>{title}</option>{/each}</select></label>
   {#if options.kind!=='histogram'}<label>{options.kind==='line'||options.kind==='scatter'?'Eje X · columna numérica':'Agrupar por · eje X'} <select aria-label="Columna X del gráfico" bind:value={options.x}>{#each doc.headers??[] as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label>{/if}
   {#if options.kind!=='bar'||options.aggregate!=='count'}<label>{options.kind==='heatmap'?'Eje Y · categoría (texto exacto)':options.kind==='bar'?'Valor · eje Y':'Variable numérica'} <select aria-label="Columna Y del gráfico" value={options.y} onchange={event=>{const next=Number(event.currentTarget.value);if(options.kind==='bar'&&options.y>=0&&next!==options.y){options.measureType='text';options.aggregate='count'}options.y=next}}><option value={-1} disabled>Elige una columna…</option>{#each doc.headers??[] as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label>{/if}
   {#if options.kind==='histogram'}<label>Intervalos <input aria-label="Intervalos del gráfico" type="number" min="1" max="30" bind:value={options.bins}/></label>{/if}
   {#if options.kind==='bar'}
    <label>El valor representa <select aria-label="Tipo de medida del gráfico" bind:value={options.measureType} onchange={event=>{if(event.currentTarget.value==='text'&&!['count','distinct'].includes(options.aggregate))options.aggregate='count'}}><option value="text">Texto / identificador</option><option value="number">Número para calcular</option></select></label>
    <label>Cálculo <select aria-label="Resumen del gráfico" bind:value={options.aggregate}>{#each Object.entries(chartAggregates) as [operation,title]}<option value={operation} disabled={options.measureType==='text'&&!['count','distinct'].includes(operation)}>{title}</option>{/each}</select></label>
   {/if}
   {#if ['bar','line','scatter'].includes(options.kind)}<label>Separar por color <select aria-label="Series del gráfico" bind:value={options.series}><option value={-1}>Sin series</option>{#each doc.headers??[] as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label>{/if}
   {#if ['bar','line','scatter'].includes(options.kind)}<label>Orden <select aria-label="Orden del gráfico" bind:value={options.descending}><option value={false}>{options.kind==='bar'?(options.series!==undefined&&options.series>=0?'Categoría A–Z':'Menor valor primero'):'Menor X primero'}</option><option value={true}>{options.kind==='bar'?(options.series!==undefined&&options.series>=0?'Categoría Z–A':'Mayor valor primero'):'Mayor X primero'}</option></select></label>{/if}
   <button class="primary" type="submit" disabled={!sql||tooWide||unavailable}>Generar gráfico</button>
  </fieldset>
  {#if busy}<button type="button" onclick={()=>{cancel();message='Gráfico cancelado.'}}>Cancelar gráfico</button><progress aria-label="Generación del gráfico"></progress>{/if}
 </form>
 <p class="help">{options.kind==='bar'?(options.aggregate==='count'?'Agrupar por reúne las filas que tienen el mismo texto. El conteo indica cuántas hay en cada grupo.':'Elige el valor que quieres resumir. Para sumar o promediar, indica que es numérico; los identificadores deben seguir como texto.'):options.kind==='histogram'?'Elige una columna numérica: X mostrará sus intervalos e Y cuántas filas caen en cada uno.':options.kind==='heatmap'?'Elige dos categorías: cada celda indica cuántas filas tienen esa combinación.':'Elige las columnas que quieres comparar. Las variables numéricas se calculan con punto decimal.'}</p>
 <p>{scope==='filtered'?'Usa la búsqueda y los filtros actuales de la tabla, sobre todas las filas coincidentes; no solo la página visible. El orden del gráfico se elige aquí.':doc.readonly?'Analiza el archivo completo desde disco; la tabla del editor sigue siendo una muestra de solo lectura.':'Incluye todas las filas y los cambios pendientes, aunque la tabla tenga filtros activos.'}</p>
 <p class="scope" aria-label="Configuración del gráfico">{axes.summary} · {scopeLabel}. Eje X: {axes.x}. Eje Y: {axes.y}.</p>
 {#if unavailable}<p role="alert">La vista filtrada no está disponible: espera a que se aplique una consulta válida. Las muestras solo permiten analizar el documento completo.</p>{/if}
 {#if options.kind==='bar'&&options.measureType==='number'}<p>Conversión numérica explícita con punto decimal. No uses identificadores como medidas; se omiten valores inválidos o fuera del rango seguro. El CSV conserva su texto.</p>{/if}
 {#if options.kind==='bar'&&options.aggregate==='distinct'}<p>Valores únicos compara el texto exacto: cuenta el vacío como un valor y omite campos ausentes. No convierte códigos a números.</p>{/if}
 {#if tooWide}<p role="alert">El análisis admite hasta 200 columnas.</p>{/if}
 {#if options.series!==undefined&&options.series>=0}<p>Un color por categoría de la columna elegida, hasta 8 series. Ocultar un color no filtra los datos ni recalcula los totales. Ausente y vacío se mantienen separados; las combinaciones sin observaciones no se rellenan con cero.</p>{/if}
 <p role="status">{message}</p>
 {#if data&&source}<p class="scope">{source.name} · {source.filtered?'Vista filtrada actual':'Documento completo'} · {source.fromDisk?'Fuente completa desde disco':`Revisión ${source.revision}, cambios pendientes incluidos`} · {data.total.toLocaleString()} filas · {data.usable.toLocaleString()} utilizables · {(data.total-data.usable).toLocaleString()} omitidas del cálculo · {data.rows.length} de {data.points.toLocaleString()} elementos.{#if data.seriesCount!==undefined}{' '}Series representadas: {series.length} de {data.seriesCount}.{/if}</p>{/if}
 {#if data?.limited}<p class="notice">Gráfico parcial: se muestran los primeros {chartLimit(options.kind)} elementos en el orden indicado. Las agregaciones usan toda la fuente. No es una muestra aleatoria.</p>{/if}
 {#if options.kind==='line'}<p>Líneas ordenadas por X numérica y después por fila de la fuente analizada para empates. No infiere fechas. Las Y vacías o inválidas dejan huecos; X inválidas se omiten.</p>{:else if options.kind==='box'}<p>Cuartiles interpolados (Hyndman–Fan tipo 7), bigotes hasta el dato dentro de 1,5 × RIC. Se cuentan todos los atípicos; se dibujan los primeros 20 por categoría en orden numérico.</p>{:else if options.kind==='heatmap'}<p>Conteo por par de categorías exactas. Una posición sin celda significa combinación sin observaciones, no un cero imputado.</p>{:else if options.kind==='histogram'}<p>Intervalos de igual amplitud [desde, hasta), con máximo incluido en el último. Una columna constante usa un intervalo.</p>{/if}
 <!-- svelte-ignore a11y_no_noninteractive_tabindex (La región ampliada debe admitir desplazamiento con teclado.) -->
 <div class="plot-scroll" role="region" aria-label="Área desplazable del gráfico" tabindex="0"><div class="plot" style:width={`${zoom*100}%`} bind:this={element}></div></div>
 {#if data}
  {#if !data.rows.length}<p>No hay filas para el alcance elegido.</p>{/if}
  {#if series.length}<details><summary>Series visibles · controles de teclado</summary><div class="actions">{#each series as group}<label><input type="checkbox" checked={!hiddenSeries.includes(group.name)} onchange={()=>hiddenSeries=hiddenSeries.includes(group.name)?hiddenSeries.filter(name=>name!==group.name):[...hiddenSeries,group.name]}/>{group.name}</label>{/each}</div></details>{/if}
  <div class="actions"><button onclick={()=>zoom=Math.max(1,zoom-0.5)} disabled={zoom<=1}>Reducir gráfico</button><button onclick={()=>zoom=Math.min(4,zoom+0.5)} disabled={zoom>=4}>Ampliar gráfico</button><button onclick={()=>zoom=1}>Ajustar gráfico</button>{#each ['svg','png','pdf'] as format}<button disabled={busy||exporting} onclick={()=>void exportChart(format as 'svg'|'png'|'pdf')}>Exportar gráfico {format.toUpperCase()}</button>{/each}</div>
  {#if doc.readonly}<p>La tabla sigue siendo una muestra de solo lectura. Se exporta una instantánea del gráfico calculado sobre la fuente completa; no el CSV ni sus cambios.</p>{/if}
  <details><summary>Datos del gráfico: tabla accesible</summary><div class="table-scroll"><table><caption>{chartKinds[options.kind]} · valores usados para dibujar; páginas de 50</caption><thead><tr>{#each data.columns as name}<th scope="col">{headings[name]??name}</th>{/each}</tr></thead><tbody>{#each data.rows.slice(tablePage*50,(tablePage+1)*50) as row}<tr>{#each row as value}<td>{value===null?'—':value===''?'(vacío)':value}</td>{/each}</tr>{/each}</tbody></table></div><div class="actions"><button disabled={tablePage===0} onclick={()=>tablePage--}>Datos anteriores</button><span>Página {tablePage+1} de {Math.max(1,Math.ceil(data.rows.length/50))}</span><button disabled={(tablePage+1)*50>=data.rows.length} onclick={()=>tablePage++}>Datos siguientes</button></div></details>
 {/if}
 <details><summary>Consulta y precisión del gráfico</summary><p>Límites de análisis: 256 MiB por fuente, dos millones de filas, 200 columnas y ocho millones de celdas. Números aproximados con punto decimal; se omiten vacíos, valores inválidos y magnitudes mayores que 9 007 199 254 740 991. Las categorías siguen siendo texto exacto; etiquetas largas se abrevian visualmente. No conviertas identificadores a medidas. El CSV conserva su contenido. Los resultados se invalidan al cambiar datos u opciones.</p><pre>{sql}</pre></details>
</section>
<style>
 .charts-panel{padding:10px 12px;border-bottom:1px solid var(--border);background:var(--panel);font-size:11px;max-height:60vh;overflow:auto;flex-shrink:0}header,.actions,fieldset{display:flex;align-items:center;gap:8px;flex-wrap:wrap}header{justify-content:space-between}h3{font-size:12px;margin:0}p{color:var(--muted);line-height:1.5;margin:8px 0}fieldset{border:0;padding:0;margin:8px 0}label{display:flex;align-items:center;gap:6px}select{max-width:180px}input{width:60px}input[type=checkbox]{width:auto}select,input,button{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);padding:5px 8px;border-radius:5px}button.primary{color:white}button:disabled{opacity:.5}button:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.plot-scroll{overflow:auto;border:1px solid var(--border);border-radius:6px}.plot{height:340px;min-width:450px}.actions{margin:8px 0}.scope{font-weight:600}.notice{border-left:3px solid var(--accent);padding-left:8px}summary{cursor:pointer;margin:8px 0}.table-scroll{max-height:180px;overflow:auto}table{border-collapse:collapse;width:100%}td,th{padding:6px;border:1px solid var(--border);text-align:left;overflow-wrap:anywhere;max-width:280px}caption{padding:6px;text-align:left;color:var(--muted)}pre{white-space:pre-wrap;overflow-wrap:anywhere}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
</style>
