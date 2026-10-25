<script lang="ts" module>
 // El borrador sobrevive al cambio de pestaña: al terminar la extracción la app salta al archivo nuevo y este panel se desmonta.
 import type {TableFilter} from '../../shared/types'
 const drafts=new Map<string,{conditions:TableFilter[];mode:'all'|'any';chosen:boolean[];allColumns:boolean}>()
</script>
<script lang="ts">
 import Icon from './Icon.svelte'
 import {onMount} from 'svelte'
 import {filterOperators} from '../../shared/table-conditions'
 import {PREVIEW_LIMIT,type OperationRequest,type PreviewResult} from '../../shared/operations'
 import type {DocumentInfo} from '../../shared/types'
 // E1 · Extracto no destructivo de un archivo grande: filtros y columnas → recuento, vista previa o archivo NUEVO. El original no se modifica nunca.
 let {doc,onclose,onerror}:{doc:DocumentInfo;onclose:()=>void;onerror:(message:string)=>void}=$props()
 const headers=$derived(doc.headers??[])
 let conditions=$state<TableFilter[]>([]),mode=$state<'all'|'any'>('all'),chosen=$state<boolean[]>([]),allColumns=$state(true)
 let busy=$state<'count'|'preview'|'filter_extract'|null>(null),active='',percent=$state<number|null>(null),phase=$state(''),error=$state(''),cancelled=$state(false)
 let counted=$state<{matched:number;scanned:number}|null>(null),preview=$state<PreviewResult|null>(null)
 let title:HTMLHeadingElement,region:HTMLElement
 const titleId=$props.id()
 const columns=$derived(allColumns?undefined:chosen.flatMap((on,index)=>on?[index]:[]))
 const noColumns=$derived(!allColumns&&!columns?.length)
 const number=(value:number)=>value.toLocaleString('es')
 onMount(()=>{const draft=drafts.get(doc.id);if(draft)({conditions,mode,chosen,allColumns}=structuredClone(draft));title.focus();return window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress?.requestId==='op:'+active){percent=event.progress.rows;phase=event.progress.phase}})})
 $effect(()=>{drafts.set(doc.id,$state.snapshot({conditions,mode,chosen,allColumns}))})
 function build<T extends OperationRequest['operation']>(operation:T){
  const base={requestId:crypto.randomUUID(),source:{revision:doc.revision},...(conditions.length?{conditions:{conditions:$state.snapshot(conditions),filterMode:mode}}:{}),...(columns?{columns}:{})}
  return (operation==='preview'?{...base,operation,limit:PREVIEW_LIMIT}:{...base,operation}) as OperationRequest
 }
 async function run(operation:'count'|'preview'|'filter_extract'){
  if(busy||noColumns)return
  const request=build(operation);active=request.requestId;busy=operation;error='';cancelled=false;percent=null;phase=operation==='filter_extract'?'Elige dónde guardar el extracto…':'Leyendo el archivo…'
  if(operation==='count')counted=null
  if(operation==='preview')preview=null
  try{
   const outcome=await window.freya.operation(doc.id,request)
   if(!outcome){phase='';return}
   if(outcome.result.operation==='filter_extract'){phase='Extracto creado: se abrió en una pestaña nueva.';return}
   if(outcome.result.operation==='count')counted={matched:outcome.result.matched,scanned:outcome.result.scanned}
   else if(outcome.result.operation==='preview')preview=outcome.result
  }catch(e){
   if(cancelled)phase='Operación cancelada. No se creó ningún archivo.'
   else error=String(e instanceof Error?e.message:e).replace(/^Error: /,'')
  }finally{busy=null}
 }
 async function cancel(){cancelled=true;phase='Cancelando…';try{await window.freya.cancelOperation(doc.id,active)}catch(e){onerror(String(e))}}
 function changed(){counted=null;preview=null;error='';phase=''}
</script>
<svelte:window onkeydown={event=>{if(event.key==='Escape'&&!busy&&event.target instanceof HTMLElement&&region?.contains(event.target)){event.preventDefault();event.stopPropagation();onclose()}}}/>
<section bind:this={region} class="extract-tools" aria-labelledby={titleId}>
 <div class="heading"><h3 id={titleId} tabindex="-1" bind:this={title}>Extraer filas de un archivo grande</h3><button type="button" aria-label="Cerrar extracción" disabled={!!busy} onclick={onclose}><Icon name="x" size={14}/></button></div>
 <p>Crea un archivo nuevo con las filas que cumplan las condiciones. <strong>El original no se modifica.</strong> Las filas se copian tal cual (bytes idénticos) salvo que elijas columnas: entonces el CSV se vuelve a escribir y se te avisa de qué se normaliza.</p>
 <div class="extract-body" oninput={changed} onchange={changed}>
  <label>Coincidir <select aria-label="Combinar condiciones" bind:value={mode}><option value="all">Todas las condiciones (Y)</option><option value="any">Cualquier condición (O)</option></select></label>
  {#each conditions as rule,index}<div class="rule">
   <select aria-label={`Columna de condición ${index+1}`} bind:value={rule.column}>{#each headers as name,column}<option value={column}>{column+1}. {name||'Sin encabezado'}</option>{/each}</select>
   <select aria-label={`Operador de condición ${index+1}`} bind:value={rule.op}>{#each filterOperators as [value,label]}<option {value}>{label}</option>{/each}</select>
   {#if !['empty','notEmpty'].includes(rule.op)}<input aria-label={`Valor de condición ${index+1}`} bind:value={rule.value} required placeholder={rule.op.startsWith('date')?'AAAA-MM-DD':'Valor'} type={rule.op.startsWith('date')?'date':'text'}/>{/if}
   {#if ['contains','equals','notEquals','starts','ends','regex'].includes(rule.op)}<label><input type="checkbox" bind:checked={rule.caseSensitive}/>Distinguir mayúsculas</label>{/if}
   <button type="button" aria-label={`Quitar condición ${index+1}`} onclick={()=>{conditions=conditions.filter((_,i)=>i!==index);changed()}}><Icon name="x" size={14}/></button>
  </div>{/each}
  <button type="button" disabled={conditions.length>=20||!headers.length} onclick={()=>{conditions=[...conditions,{column:0,op:'contains',value:''}];changed()}}>Añadir condición</button>
  <fieldset><legend>Columnas del extracto</legend>
   <label><input type="checkbox" aria-label="Todas las columnas" bind:checked={allColumns}/>Todas las columnas ({number(headers.length)})</label>
   {#if !allColumns}<div class="column-list">{#each headers as name,index}<label><input type="checkbox" aria-label={`Incluir columna ${index+1}`} bind:checked={chosen[index]}/>{index+1}. {name||'Sin encabezado'}</label>{/each}</div>{#if noColumns}<span class="extract-error">Elige al menos una columna.</span>{/if}{/if}
  </fieldset>
 </div>
 <form class="actions" onsubmit={event=>{event.preventDefault();void run('filter_extract')}}>
  <button type="button" disabled={!!busy||noColumns} onclick={()=>void run('count')}>Contar coincidencias</button>
  <button type="button" disabled={!!busy||noColumns} onclick={()=>void run('preview')}>Vista previa ({PREVIEW_LIMIT} filas)</button>
  <button type="submit" class="primary" disabled={!!busy||noColumns}>Extraer a un archivo nuevo…</button>
  {#if busy}<button type="button" onclick={()=>void cancel()}>Cancelar</button>{/if}
 </form>
 {#if busy}<div role="status" class="extract-progress"><span>{phase}</span>{#if percent!==null}<progress max="100" value={percent} aria-label="Avance de la operación"></progress>{/if}</div>
 {:else if phase}<p role="status">{phase}</p>{/if}
 {#if error}<p class="extract-error" role="alert">{error}</p>{/if}
 {#if counted}<p role="status"><strong>{number(counted.matched)}</strong> de {number(counted.scanned)} filas cumplen las condiciones.</p>{/if}
 <!-- svelte-ignore a11y_no_noninteractive_tabindex (La región desplazable debe recibir foco para usar el teclado.) -->
 {#if preview}<div class="preview-box" role="region" aria-label="Vista previa del extracto" tabindex="0">
  <p>{preview.complete?`Se muestran las ${number(preview.rows.length)} filas que coinciden.`:`Primeras ${number(preview.rows.length)} coincidencias; puede haber más (la lectura se detuvo al llegar al límite de la vista previa).`}</p>
  {#if preview.rows.length}<table><thead><tr>{#each preview.headers as name}<th>{name}</th>{/each}</tr></thead><tbody>{#each preview.rows as row}<tr>{#each row as cell}<td>{cell}</td>{/each}</tr>{/each}</tbody></table>{/if}
 </div>{/if}
</section>
<style>
 .extract-tools{padding:10px 12px;border-bottom:1px solid var(--border);background:var(--panel);font-size:11px;max-height:60vh;overflow:auto;flex-shrink:0}.heading{display:flex;justify-content:space-between;align-items:center}.heading h3{font-size:12px;margin:0}.heading button{border:0;background:transparent}.rule,.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}label{display:inline-flex;align-items:center;gap:5px}.rule select{max-width:190px}.rule input[type=text],.rule input[type=date]{width:170px}p{line-height:1.5;color:var(--muted);max-width:850px;margin:6px 0}fieldset{margin:8px 0;border:1px solid var(--border);padding:8px}.column-list{display:flex;flex-wrap:wrap;gap:4px 14px;max-height:120px;overflow:auto;margin-top:6px}button,select,input{font-size:11px}button{appearance:none;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:5px;padding:5px 8px}button.primary{color:white}.extract-error{color:#c0392b}:global(:root.dark) .extract-error{color:#f97066}.extract-progress{display:flex;gap:8px;align-items:center}.preview-box{max-height:220px;overflow:auto;border:1px solid var(--border);margin:8px 0}.preview-box p{padding:0 8px}.preview-box table{border-collapse:collapse;width:max-content;min-width:100%}.preview-box th,.preview-box td{border-bottom:1px solid var(--border);padding:3px 8px;text-align:left;white-space:pre;max-width:260px;overflow:hidden;text-overflow:ellipsis}.preview-box th{position:sticky;top:0;background:var(--panel)}
</style>
