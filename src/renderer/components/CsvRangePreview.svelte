<script lang="ts">
 import {onMount,untrack} from 'svelte'
 import type {TableRangeEdit,TableRangePreview} from '../../shared/types'
 let {id,initial,cut=false,onapply,onclose,onerror}:{id:string;initial:TableRangeEdit;cut?:boolean;onapply:(edit:TableRangeEdit)=>Promise<string|null>;onclose:()=>void;onerror:(text:string)=>void}=$props()
 let edit=$state(untrack(()=>structuredClone($state.snapshot(initial)))),preview=$state<TableRangePreview|null>(null),busy=$state(false),message=$state(''),dialog:HTMLDialogElement
 let request=0
 const labels={fill:'Rellenar rango',clear:'Vaciar rango',trim:'Quitar espacios del rango',upper:'Mayúsculas en el rango',lower:'Minúsculas en el rango',replace:'Reemplazar en el rango',paste:'Pegar bloque en el rango'}
 onMount(()=>{dialog.showModal();if(!['fill','replace'].includes(edit.operation))void inspect();return()=>{request++}})
 function invalidate(){request++;preview=null;message='Pulsa Vista previa para revisar estos valores.'}
 async function inspect(){const ticket=++request;busy=true;preview=null;message='Calculando vista previa…';try{const result=await window.freya.rangePreview(id,$state.snapshot(edit));if(ticket===request){preview=result;message=`${result.changed.toLocaleString()} de ${result.cells.toLocaleString()} celdas cambiarán.`}}catch(error){if(ticket===request){message='No se pudo preparar el cambio. '+String(error).replace(/^.*Error: /,'');onerror(String(error))}}finally{if(ticket===request)busy=false}}
 async function apply(){if(!preview||busy)return;busy=true;try{const error=await onapply($state.snapshot(edit));if(error===null)onclose();else{preview=null;message='El cambio no se aplicó. '+error}}finally{busy=false}}
</script>
<dialog bind:this={dialog} aria-labelledby="range-preview-title" oncancel={event=>{event.preventDefault();onclose()}}>
 <h3 id="range-preview-title">{cut?'Cortar rango':labels[edit.operation]}</h3>
 <p>Solo las celdas del rango visible. Los encabezados y las filas ocultas se conservan. Un paso de deshacer.</p>
 <form onsubmit={event=>{event.preventDefault();void inspect()}}>
  {#if edit.operation==='replace'}<label>Buscar <input aria-label="Buscar dentro del rango" bind:value={edit.find} oninput={invalidate} required disabled={busy}/></label>{/if}
  {#if ['fill','replace'].includes(edit.operation)}<label>{edit.operation==='fill'?'Valor para todas las celdas':'Reemplazar por'}<textarea aria-label="Valor del rango" bind:value={edit.value} oninput={invalidate} disabled={busy} rows="3"></textarea></label>{/if}
  <button type="submit" disabled={busy}>Vista previa</button>
 </form>
 <p role="status">{message}</p>
 {#if preview?.samples.length}<div class="preview-scroll"><table><caption>Hasta ocho ejemplos; textos abreviados a 256 caracteres.</caption><thead><tr><th>Fila / columna</th><th>Antes</th><th>Después</th></tr></thead><tbody>{#each preview.samples as sample}<tr><th>{sample.row+1} / {sample.column+1}</th><td><pre>{sample.before}</pre></td><td><pre>{sample.after}</pre></td></tr>{/each}</tbody></table></div>{/if}
 {#if cut}<p>Aplicar copia el rango al portapapeles y después vacía sus celdas. Si falla la copia, los datos se conservan.</p>{/if}
 <div class="actions"><button class="primary" disabled={busy||!preview?.changed} onclick={()=>void apply()}>Aplicar cambio</button><button disabled={busy} onclick={onclose}>Cancelar</button></div>
</dialog>
<style>
 dialog{margin:auto;width:min(680px,90vw);max-height:80vh;overflow:auto;color:var(--text);background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px}dialog::backdrop{background:#0007}h3{margin:0 0 10px;font-size:16px}p,caption{font-size:12px;line-height:1.5;color:var(--muted)}form,label{display:flex;flex-direction:column;gap:8px}form button{align-self:flex-start}input,textarea{padding:8px;font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:5px}table{font-size:12px;width:100%;border-collapse:collapse}td,th{padding:6px;border:1px solid var(--border);text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-width:230px;margin:0;font-size:11px}.preview-scroll{max-height:250px;overflow:auto}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}button{appearance:none;font-size:12px}button.primary{color:white}
</style>
