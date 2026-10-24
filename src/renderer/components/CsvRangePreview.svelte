<script lang="ts">
 import {onMount,onDestroy,untrack} from 'svelte'
 import type {TableRangeEdit,TableRangePreview} from '../../shared/types'
 let {id,initial,cut=false,documentScope=false,column,onapply,onclose,onerror}:{id:string;initial:TableRangeEdit;cut?:boolean;documentScope?:boolean;column?:{name:string;rows:number;hidden:number;title:string};onapply:(edit:TableRangeEdit,cancelled:()=>boolean)=>Promise<string|null>;onclose:()=>void;onerror:(text:string)=>void}=$props()
 let edit=$state(untrack(()=>structuredClone($state.snapshot(initial)))),preview=$state<TableRangePreview|null>(null),busy=$state(false),message=$state(''),processed=$state(0),external=$state(false),dialog:HTMLDialogElement
 let active:string|undefined,applying=false,cancelled=false,closing=false
 const labels={fill:'Rellenar rango',clear:'Vaciar rango',trim:'Quitar espacios del rango',upper:'Mayúsculas en el rango',lower:'Minúsculas en el rango',replace:'Reemplazar en el rango',paste:'Pegar bloque en el rango'}
 function stop(){cancelled=true;const request=active;active=undefined;busy=false;if(request)void window.freya.cancelAnalysis(id,request).catch(()=>{})}
 function invalidate(){stop();preview=null;message='Pulsa Vista previa para revisar estos valores.'}
 function cancelPreparation(){
  cancelled=true;preview=null
  if(applying&&active){message='Solicitando cancelación. Si el cambio ya se aplicó, se podrá deshacer.';void window.freya.cancelAnalysis(id,active).catch(error=>onerror(String(error)));return}
  stop();message='Preparación cancelada. Pulsa Vista previa para volver a calcular.'
 }
 function close(){if(applying){closing=true;cancelPreparation()}else{stop();onclose()}}
 onDestroy(stop)
 onMount(()=>{dialog.showModal();const unsubscribe=window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress&&event.progress.requestId===active){processed=event.progress.rows;if(!cancelled)message=event.progress.phase}else if(event.type==='external'&&event.id===id){external=true;cancelPreparation();message='El archivo cambió en disco. Cierra este diálogo y revisa o recarga el documento.'}});if(documentScope||!['fill','replace'].includes(edit.operation))void inspect();return unsubscribe})
 async function inspect(){
  if(busy||external)return;stop();cancelled=false;preview=null;processed=0;busy=true
  const change={...$state.snapshot(edit),requestId:crypto.randomUUID()};active=change.requestId;message='Calculando vista previa…'
  try{const result=await window.freya.rangePreview(id,change);if(active===change.requestId){preview=result;message=`${result.changed.toLocaleString()} de ${result.cells.toLocaleString()} celdas cambiarán.`}}catch(error){if(active===change.requestId){message='No se pudo preparar el cambio. '+String(error).replace(/^.*Error: /,'');onerror(String(error))}}finally{if(active===change.requestId){active=undefined;busy=false}}
 }
 async function apply(){
  if(!preview||busy||external)return
  const change={...$state.snapshot(edit),requestId:crypto.randomUUID()};active=change.requestId;applying=true;cancelled=false;busy=true;processed=0;message=cut?'Copiando el rango antes de preparar el borrado…':'Preparando el cambio…'
  try{const error=await onapply(change,()=>cancelled);if(active!==change.requestId)return;if(error===null||closing)onclose();else{preview=null;message='El cambio no se aplicó. '+error}}finally{applying=false;if(active===change.requestId){active=undefined;busy=false}}
 }
</script>
<dialog bind:this={dialog} aria-labelledby="range-preview-title" oncancel={event=>{event.preventDefault();close()}}>
 <h3 id="range-preview-title">{documentScope?'Reemplazar en documento':cut?'Cortar rango':column?column.title:labels[edit.operation]}</h3>
 <p>{column?`Alcance: columna «${column.name}» · ${column.rows.toLocaleString()} ${column.rows===1?'fila':'filas'} de la vista actual.${column.hidden?` ${column.hidden.toLocaleString()} ${column.hidden===1?'fila oculta':'filas ocultas'} por búsqueda o filtros no se modifican.`:''} Los encabezados se conservan.`:documentScope?'Documento completo: incluye filas ocultas por búsqueda o filtros y las columnas indicadas en la vista previa. Reemplazo literal que distingue mayúsculas; no cambia encabezados.':'Solo las celdas del rango visible. Los encabezados y las filas ocultas se conservan.'} Un paso de deshacer.</p>
 <form onsubmit={event=>{event.preventDefault();void inspect()}}>
  {#if edit.operation==='replace'}<label>Buscar <input aria-label="Buscar dentro del rango" bind:value={edit.find} oninput={invalidate} required disabled={busy||external}/></label>{/if}
  {#if ['fill','replace'].includes(edit.operation)}<label>{edit.operation==='fill'?'Valor para todas las celdas':'Reemplazar por'}<textarea aria-label="Valor del rango" bind:value={edit.value} oninput={invalidate} disabled={busy||external} rows="3"></textarea></label>{/if}
  <button type="submit" disabled={busy||external}>Vista previa</button>
 </form>
 <p role="status">{message}</p>
 {#if busy}<div class="progress"><progress aria-label="Preparación del rango"></progress><span>{processed.toLocaleString()} filas revisadas</span><button onclick={cancelPreparation}>Cancelar preparación</button></div>{/if}
 {#if preview?.samples.length}<div class="preview-scroll"><table><caption>Hasta ocho ejemplos; textos abreviados a 256 caracteres.</caption><thead><tr><th>Fila / columna</th><th>Antes</th><th>Después</th></tr></thead><tbody>{#each preview.samples as sample}<tr><th>{sample.row+1} / {sample.column+1}</th><td><pre>{sample.before}</pre></td><td><pre>{sample.after}</pre></td></tr>{/each}</tbody></table></div>{/if}
 <p>La preparación se puede cancelar. El cambio final se aplica completo y se puede deshacer. Cerrar mientras se aplica solicita cancelación y espera su resultado.</p>
 {#if cut}<p>Aplicar copia el rango al portapapeles y después vacía sus celdas. Si falla la copia o cancelas antes del borrado, los datos se conservan. Una copia al portapapeles ya iniciada puede terminar.</p>{/if}
 <div class="actions"><button class="primary" disabled={busy||external||!preview?.changed} onclick={()=>void apply()}>Aplicar cambio</button><button onclick={close}>Cancelar</button></div>
</dialog>
<style>
 dialog{margin:auto;width:min(680px,90vw);max-height:80vh;overflow:auto;color:var(--text);background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px}dialog::backdrop{background:#0007}h3{margin:0 0 10px;font-size:16px}p,caption{font-size:12px;line-height:1.5;color:var(--muted)}form,label{display:flex;flex-direction:column;gap:8px}form button{align-self:flex-start}input,textarea{padding:8px;font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:5px}table{font-size:12px;width:100%;border-collapse:collapse}td,th{padding:6px;border:1px solid var(--border);text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-width:230px;margin:0;font-size:11px}.preview-scroll{max-height:250px;overflow:auto}.progress{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}button{appearance:none;font-size:12px}button.primary{color:white}
</style>
