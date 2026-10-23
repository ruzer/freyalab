<script module lang="ts">const drafts=new Map<string,{sql:string;sources:string[]}>()</script>
<script lang="ts">
 import Icon from './Icon.svelte'
 import {onMount,onDestroy} from 'svelte'
 import Editor from './Editor.svelte'
 import {sqlReport} from '../lib/sql-report'
 import {sqlColumns} from '../../shared/sql-helpers'
 import {assistedSQL,type SqlAssist} from '../../shared/sql-assist'
 import type {DocumentInfo,SqlResult} from '../../shared/types'
 let {doc,onclose,onerror,onreport}:{doc:DocumentInfo;onclose:()=>void;onerror:(message:string)=>void;onreport:(markdown:string)=>Promise<void>}=$props()
 let sql=$state('SELECT * FROM datos;'),choices=$state<DocumentInfo[]>([]),extra=$state<string[]>([]),busy=$state(false),result=$state<SqlResult|null>(null),choicesReady=$state(false),message=$state('Elige un asistente o escribe SQL. Preparar una consulta no la ejecuta.'),transferred=$state(0)
 let assist=$state<SqlAssist>({mode:'group',group:0,measure:0,category:1,values:'',aggregate:'count',scale:2,leftKey:0,rightKey:0,leftJoin:true,otherTable:2}),showAssist=$state(false)
 let reporting=$state(false)
 let active:string|undefined
 const sources=$derived([doc,...extra.map(id=>choices.find(choice=>choice.id===id)).filter((value):value is DocumentInfo=>!!value)])
 const signature=$derived(JSON.stringify([doc.revision,sql,sources.map(source=>[source.id,source.revision])]))
 const missing=$derived(extra.some(id=>!choices.some(choice=>choice.id===id)))
 const tooWide=$derived(sources.some(source=>(source.headers?.length??0)>200))
 const other=$derived(sources[assist.otherTable-1])
 function cancel(){const previous=active;active=undefined;busy=false;reporting=false;result=null;if(previous)void window.freya.sqlCancel(previous).catch(()=>{})}
 $effect(()=>{void signature;cancel();message='Consulta o fuentes actualizadas. Pulsa Ejecutar consulta.'})
 onMount(()=>{const draft=drafts.get(doc.id);if(draft){sql=draft.sql;extra=draft.sources;}void window.freya.documents().then(documents=>{choices=documents.filter(value=>value.kind==='csv');choicesReady=true});return window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress&&event.progress.requestId===active){message=event.progress.phase;transferred=event.progress.rows}else if(event.id&&event.type==='external'&&sources.some(source=>source.id===event.id)){cancel();message='Una fuente cambió en disco. Vuelve a ejecutar la consulta.'}else if(event.document&&sources.some(source=>source.id===event.document!.id)&&event.type==='changed'){cancel();void window.freya.documents().then(documents=>{choices=documents.filter(value=>value.kind==='csv');choicesReady=true})}})})
 onDestroy(()=>{drafts.set(doc.id,{sql,sources:[...extra]});cancel()})
 async function run(){if(busy||!sql.trim())return;if(missing||tooWide){message=missing?'Una fuente seleccionada ya no está abierta. Revisa los archivos antes de ejecutar.':'Una fuente supera 200 columnas.';return}cancel();const requestId=crypto.randomUUID();active=requestId;busy=true;transferred=0;message='Preparando análisis…';try{const data=await window.freya.sqlRun({requestId,sources:sources.map(source=>({id:source.id,revision:source.revision})),sql});if(active!==requestId)return;result=data;message='Consulta completa. Los documentos no se han modificado.'}catch(error){if(active===requestId){message='No se pudo ejecutar: '+String(error).replace(/^.*Error: /,'');onerror(message)}}finally{if(active===requestId)busy=false}}
 async function page(offset:number){const id=active;if(!id)return;busy=true;try{const data=await window.freya.sqlPage(id,offset);if(active===id)result=data}catch(error){if(active===id){cancel();message=String(error)}}finally{if(active===id)busy=false}}
 async function report(){
  const id=active,data=result;if(!id||!data||busy)return
  busy=true;reporting=true;message='Preparando informe de todas las filas conservadas…'
  try{
   const rows:SqlResult['rows']=[]
   for(let offset=0;offset<Math.max(1,data.returnedRows);offset+=100){
    const part=await window.freya.sqlPage(id,offset);if(active!==id)return
    rows.push(...part.rows);message=`Preparando informe: ${rows.length.toLocaleString()} de ${data.returnedRows.toLocaleString()} filas.`
   }
   if(active!==id)return
   await onreport(sqlReport({...$state.snapshot(data),rows,offset:0},sql))
  }catch(error){if(active===id){message='No se pudo crear el informe: '+String(error).replace(/^.*Error: /,'');onerror(message)}}
  finally{if(active===id){busy=false;reporting=false}}
 }
 function prepare(){try{sql=assistedSQL(doc.headers??[],other?.headers??[],assist)}catch(error){onerror((error as Error).message)}}
 function choose(id:string,checked:boolean){extra=checked?[...extra,id]:extra.filter(value=>value!==id)}
</script>
<svelte:window onkeydown={event=>{if(!(event.target instanceof HTMLElement)||!event.target.closest('.sql-panel'))return;if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();if(!busy&&sql.trim())void run()}else if(event.key==='Escape'){event.preventDefault();onclose()}}}/>
<section class="sql-panel" aria-label="Análisis SQL y asistentes">
 <div class="heading"><h3>Análisis local con DuckDB</h3><button aria-label="Cerrar análisis SQL" onclick={onclose}><Icon name="x" size={14}/></button></div>
 <p>Solo lectura. Consulta todos los registros, incluidos los cambios pendientes; los filtros y la búsqueda de la tabla no limitan SQL. Para una muestra, lee el archivo original completo desde disco. Hasta 4 fuentes, 256 MiB por archivo y 8 millones de celdas en total; máximo 2 millones de filas y 200 columnas por fuente; no cambia los límites de edición.</p>
 <details><summary>Archivos y nombres para SQL</summary><p><strong>datos</strong>: {doc.name} · {doc.readonly?'archivo completo en disco':`documento en memoria, revisión ${doc.revision}`}</p><div class="sources">{#each choices.filter(value=>value.id!==doc.id) as choice}<label><input type="checkbox" checked={extra.includes(choice.id)} disabled={busy||extra.length>=3&&!extra.includes(choice.id)} onchange={event=>choose(choice.id,event.currentTarget.checked)}/>{choice.name}{choice.dirty?' · cambios pendientes':''}</label>{/each}</div>{#each sources as source,index}<p>{index===0?'datos':`tabla_${index+1}`}: {sqlColumns((source.headers??[]).slice(0,200)).map(column=>`${column.name}${column.name!==column.original?` (encabezado ${column.index+1})`:''}`).join(' · ')}</p>{/each}</details>
 <button disabled={tooWide} aria-expanded={showAssist} onclick={()=>showAssist=!showAssist}>Asistentes: agrupar, pivotar y cruzar</button>
 {#if tooWide}<p class="warning">Una fuente supera 200 columnas; no puede analizarse en esta entrega.</p>{/if}
 {#if choicesReady&&missing}<p class="warning">Un archivo seleccionado ya no está abierto. <button onclick={()=>extra=extra.filter(id=>choices.some(choice=>choice.id===id))}>Quitar archivos cerrados</button> Revisa los nombres de tabla antes de ejecutar.</p>{/if}
 {#if showAssist&&!tooWide}<fieldset disabled={busy}><legend>Preparar SQL visualmente</legend>
  <label>Operación <select aria-label="Operación analítica" bind:value={assist.mode}><option value="group">Agrupar y resumir</option><option value="pivot">Tabla dinámica</option><option value="join">Cruzar archivos</option></select></label>
  {#if assist.mode==='join'}<label>Otro archivo <select aria-label="Archivo para cruce" bind:value={assist.otherTable}>{#each sources.slice(1) as source,index}<option value={index+2}>{source.name}</option>{/each}</select></label><label>Clave principal <select aria-label="Clave principal" bind:value={assist.leftKey}>{#each (doc.headers??[]).slice(0,200) as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label><label>Clave del otro archivo <select aria-label="Clave del otro archivo" bind:value={assist.rightKey}>{#each (other?.headers??[]).slice(0,200) as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label><label><input type="checkbox" bind:checked={assist.leftJoin}/>Conservar filas sin coincidencia</label><p>Claves como texto exacto; se excluyen claves vacías. Las claves repetidas pueden multiplicar filas.</p>
  {:else}<label>{assist.mode==='pivot'?'Filas':'Agrupar por'} <select aria-label="Columna para agrupar" bind:value={assist.group}>{#each (doc.headers??[]).slice(0,200) as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label><label>Resumen <select aria-label="Agregación" bind:value={assist.aggregate}><option value="count">Contar filas</option><option value="sum">Sumar números</option><option value="average">Promedio numérico</option></select></label>
   {#if assist.aggregate!=='count'}<label>Columna numérica <select aria-label="Columna de medida" bind:value={assist.measure}>{#each (doc.headers??[]).slice(0,200) as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label><label>Decimales <input aria-label="Decimales del análisis" type="number" min="0" max="12" bind:value={assist.scale}/></label><p>Conversión explícita a DECIMAL(38,{assist.scale}); otros valores se omiten. El CSV conserva su texto original.</p>{/if}
   {#if assist.mode==='pivot'}<label>Categorías en <select aria-label="Columna de categorías" bind:value={assist.category}>{#each (doc.headers??[]).slice(0,200) as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label><label>Valores de categoría, uno por línea (hasta 20)<textarea aria-label="Categorías de tabla dinámica" rows="3" bind:value={assist.values}></textarea></label>{/if}
  {/if}<button onclick={prepare}>Preparar consulta</button>
 </fieldset>{/if}
 <div class="sql-editor"><Editor text={sql} label="Consulta SQL" kind="sql" readonly={busy} onchange={value=>sql=value}/></div>
 <div class="actions"><button class="primary" disabled={busy||!sql.trim()||missing||tooWide} onclick={()=>void run()}>Ejecutar consulta</button>{#if busy}<button onclick={()=>{cancel();message='Análisis cancelado.'}}>{reporting?'Cancelar informe':'Cancelar consulta'}</button><progress aria-label="Análisis en curso"></progress><span>{transferred.toLocaleString()} filas transferidas</span>{/if}<span>Ctrl/⌘ + Enter</span></div><p role="status">{message}</p>
 {#if result}<button disabled={busy} onclick={report}>Abrir informe Markdown</button><p class="scope">DuckDB {result.version} · {result.sources.map(source=>`${source.name}: ${source.rows.toLocaleString()} filas completas${source.fromDisk?' desde disco':`, revisión ${source.revision}`}`).join(' · ')} · {result.returnedRows.toLocaleString()} filas de resultado conservadas.</p>
  {#if result.limited}<p class="warning">Vista parcial del resultado: se conservaron las primeras 10 000 filas. La consulta analizó las fuentes completas. Añade filtros o agregaciones para reducir el resultado.</p>{/if}
  <div class="sql-results" role="region" aria-label="Resultado SQL"><table><thead><tr>{#each result.columns as column}<th title={column.type}>{column.name}<small>{column.type}</small></th>{/each}</tr></thead><tbody>{#each result.rows as row}<tr>{#each row as value}<td class:missing={value===null}>{value===null?'NULL':value}</td>{/each}</tr>{/each}</tbody></table></div>
  <div class="actions"><button disabled={busy||result.offset===0} onclick={()=>void page(Math.max(0,result!.offset-100))}>Página anterior SQL</button><span>{result.returnedRows?result.offset+1:0}–{Math.min(result.offset+100,result.returnedRows)} de {result.returnedRows.toLocaleString()}{result.limited?' conservadas':''}</span><button disabled={busy||result.offset+100>=result.returnedRows} onclick={()=>void page(result!.offset+100)}>Página siguiente SQL</button></div>
 {/if}
 <p>Sin acceso SQL a disco, red ni extensiones. Resultados de hasta 10 000 filas, 200 columnas y 8 MiB; cada página muestra hasta 100 filas. Tiempo máximo de dos minutos. Cancelar destruye el proceso de consulta. El borrador SQL se conserva durante esta sesión; no es un archivo guardado.</p>
</section>
<style>
 .sql-panel{padding:10px 12px;background:var(--panel);border-bottom:1px solid var(--border);font-size:11px;max-height:55vh;overflow:auto;flex-shrink:0}.heading{display:flex;align-items:center;justify-content:space-between}.heading h3{font-size:12px;margin:0}.heading button{border:0;background:transparent}.sql-panel p{color:var(--muted);line-height:1.5;margin:8px 0}.sql-panel summary{cursor:pointer;margin:8px 0}.sources,.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sources label,.sql-panel fieldset label{display:flex;gap:6px;align-items:center}.sql-panel fieldset{margin:8px 0;border:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;padding:8px}.sql-panel fieldset p{flex-basis:100%}.sql-panel textarea{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);padding:6px}.sql-panel select{max-width:200px}.sql-panel input[type=number]{width:60px}.sql-editor{height:150px;border:1px solid var(--border);border-radius:5px;margin:8px 0;overflow:hidden;background:var(--bg)}.actions{margin:8px 0}.actions span{color:var(--muted)}.sql-panel progress{width:100px}.sql-results{overflow:auto;max-height:220px;border:1px solid var(--border);background:var(--bg)}.sql-results table{border-collapse:collapse;min-width:100%;white-space:pre-wrap}.sql-results th,.sql-results td{min-width:120px;max-width:320px;padding:6px 8px;border:1px solid var(--border);text-align:left;overflow-wrap:anywhere;vertical-align:top}.sql-results th{position:sticky;top:0;background:var(--panel)}.sql-results small{display:block;color:var(--muted);font-weight:400}.sql-results .missing{color:var(--muted);font-style:italic}.warning{border-left:3px solid var(--accent);padding-left:8px}
</style>
