<script lang="ts">
 import {onMount,onDestroy,untrack} from 'svelte'
 import type {DocumentInfo,TableTransformEdit,TableTransformPreview} from '../../shared/types'
 let {doc,initialColumns,onapply,onclose,onerror}:{doc:DocumentInfo;initialColumns:number[];onapply:(edit:TableTransformEdit)=>Promise<string|null>;onclose:()=>void;onerror:(message:string)=>void}=$props()
 let operation=$state<TableTransformEdit['operation']>('split'),columns=$state<number[]>(untrack(()=>initialColumns.length?[...initialColumns]:[0])),separator=$state(';'),custom=$state(''),name=$state('Combinada')
 let preview=$state<TableTransformPreview|null>(null),prepared=$state<TableTransformEdit|null>(null),busy=$state(false),processed=$state(0),message=$state('Elige la operación y revisa su vista previa.'),external=$state(false),dialog:HTMLDialogElement
 let active:string|undefined,applying=false
 const operations={split:'Dividir una columna',combine:'Combinar columnas',deduplicate:'Eliminar filas duplicadas',normalize:'Componer texto Unicode (NFC)',headers:'Normalizar encabezados'} as const
 const selectedSeparator=$derived(separator==='custom'?custom:separator)
 function cancel(){const id=active;active=undefined;busy=false;if(id)void window.freya.cancelAnalysis(doc.id,id).catch(()=>{})}
 function cancelPreparation(){if(applying&&active){message='Solicitando cancelación. Si el cambio ya se aplicó, se podrá deshacer.';void window.freya.cancelAnalysis(doc.id,active).catch(error=>onerror(String(error)));return}cancel();preview=null;prepared=null;message='Preparación cancelada. Revisa una nueva vista previa para aplicar.'}
 function invalidate(){cancel();preview=null;prepared=null;message='Opciones o datos actualizados. Pulsa Vista previa.'}
 $effect(()=>{void operation;void columns;void separator;void custom;void name;void doc.revision;if(!applying)invalidate()})
 onDestroy(cancel)
 onMount(()=>{dialog.showModal();return window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress&&event.progress.requestId===active){processed=event.progress.rows;message=event.progress.phase}else if(event.type==='external'&&event.id===doc.id){invalidate();external=true;message='El archivo cambió en disco. Cierra este diálogo y revisa o recarga el documento antes de transformar.'}})})
 async function inspect(){
  if(busy||external)return;cancel();preview=null;prepared=null;processed=0;busy=true
  const request:TableTransformEdit={type:'structure',operation,columns:operation==='headers'?[0]:[...columns],revision:doc.revision,requestId:crypto.randomUUID(),separator:selectedSeparator,name}
  active=request.requestId;message='Preparando vista previa…'
  try{const result=await window.freya.transformPreview(doc.id,request);if(active===request.requestId){preview=result;prepared=request;message='Vista previa lista. El documento sigue intacto.'}}catch(error){if(active===request.requestId){message=String(error).replace(/^.*Error: /,'');onerror(message)}}finally{if(active===request.requestId){active=undefined;busy=false}}
 }
 async function apply(){
  if(!preview||!prepared||busy||external)return
  const edit={...$state.snapshot(prepared),requestId:crypto.randomUUID()};active=edit.requestId;applying=true;busy=true;processed=0;message='Preparando el cambio…'
  try{const error=await onapply(edit);if(active!==edit.requestId)return;if(error===null)onclose();else{preview=null;prepared=null;message='No se aplicó el cambio. '+error}}finally{applying=false;if(active===edit.requestId){active=undefined;busy=false}}
 }
 const changes=$derived(!!preview&&(preview.cells>0||preview.addedColumns>0||preview.deletedRows>0||preview.changedHeaders>0))
</script>
<dialog bind:this={dialog} aria-labelledby="csv-transform-title" oncancel={event=>{event.preventDefault();onclose()}}>
 <h3 id="csv-transform-title">Transformar documento CSV</h3>
 <p class="notice"><strong>Documento completo:</strong> incluye filas ocultas por búsqueda o filtros; excluye encabezados salvo que elijas normalizarlos. No usa el rango de filas seleccionado. Un paso de deshacer.</p>
 <form onsubmit={event=>{event.preventDefault();void inspect()}}>
  <fieldset disabled={busy||external}><legend class="sr-only">Opciones de transformación</legend>
   <label>Operación <select aria-label="Transformación CSV" bind:value={operation}>{#each Object.entries(operations) as [value,title]}<option value={value}>{title}</option>{/each}</select></label>
   {#if operation!=='headers'}<label>Columnas <select multiple size="5" aria-label="Columnas para transformar" bind:value={columns}>{#each doc.headers??[] as header,index}<option value={index}>{index+1}. {header||`Columna ${index+1}`}</option>{/each}</select></label><p>Ctrl/⌘ y Mayús permiten marcar varias columnas. Dividir necesita una; combinar conserva el orden original de las columnas.</p>{/if}
   {#if operation==='split'||operation==='combine'}<label>Separador <select aria-label="Separador de transformación" bind:value={separator}><option value=";">Punto y coma</option><option value=",">Coma</option><option value="|">Barra vertical</option><option value={'\t'}>Tabulación</option><option value=" ">Espacio</option><option value="custom">Texto personalizado</option></select></label>{#if separator==='custom'}<label>Texto literal <input aria-label="Separador literal" maxlength="64" bind:value={custom}/></label>{/if}<p>Se interpreta como texto literal, sin reglas de comillas ni expresiones regulares. Las columnas originales se conservan; las resultantes se añaden al principio para conservar también campos originales ausentes. Máximo 32 columnas nuevas al dividir.</p>{/if}
   {#if operation==='combine'}<label>Nombre de la columna nueva <input aria-label="Nombre de columna combinada" maxlength="10000" bind:value={name}/></label>{/if}
   {#if operation==='deduplicate'}<p>Compara el texto exacto de las columnas marcadas y conserva la primera fila en el orden original. Vacío y campo ausente son diferentes. Elimina las filas repetidas completas, incluidas sus otras celdas.</p>{/if}
   {#if operation==='normalize'}<p>Compone caracteres Unicode equivalentes (NFC). Conserva espacios, mayúsculas, acentos e identificadores. No convierte números ni fechas.</p>{/if}
   {#if operation==='headers'}<p>Todos los encabezados: compone Unicode, quita espacios de los extremos, sustituye espacios internos por guiones bajos y pasa a minúsculas. Genera nombres para vacíos y añade sufijos para evitar duplicados. No cambia celdas de datos.</p>{/if}
   <button type="submit" disabled={operation!=='headers'&&!columns.length||operation==='split'&&columns.length!==1}>Vista previa</button>
  </fieldset>
 </form>
 <p role="status">{message}</p>
 {#if busy}<div class="progress"><progress aria-label="Preparación de transformación"></progress><span>{processed.toLocaleString()} elementos revisados</span><button onclick={cancelPreparation}>Cancelar preparación</button></div>{/if}
 {#if preview}<dl>{#each [['Filas originales',preview.rows],['Filas afectadas',preview.affected],['Celdas escritas',preview.cells],['Columnas añadidas',preview.addedColumns],['Filas por eliminar',preview.deletedRows],['Encabezados renombrados',preview.changedHeaders]] as [label,value]}<div><dt>{label}</dt><dd>{Number(value).toLocaleString()}</dd></div>{/each}</dl>
  {#if preview.samples.length}<div class="preview-scroll"><table><caption>Hasta ocho ejemplos, textos abreviados a 256 caracteres. Filas en orden original, sin encabezado.</caption><thead><tr><th>Posición original</th><th>Antes</th><th>Después</th></tr></thead><tbody>{#each preview.samples as sample}<tr><th>{sample.row===null?'Encabezado':`Fila ${sample.row+1}`} / columna {sample.column+1}</th><td><pre>{sample.before}</pre></td><td><pre>{sample.after}</pre></td></tr>{/each}</tbody></table></div>{/if}
 {/if}
 <p>La preparación se puede cancelar; el cambio final se aplica completo y se puede deshacer. Los límites de edición, codificación y recuperación siguen vigentes; presupuesto de deshacer de 20 MiB.</p>
 <div class="actions"><button class="primary" disabled={busy||external||!changes} onclick={()=>void apply()}>Aplicar transformación</button><button onclick={onclose}>Cerrar</button></div>
</dialog>
<style>
 dialog{margin:auto;width:min(740px,90vw);max-height:85vh;overflow:auto;color:var(--text);background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px}dialog::backdrop{background:#0007}h3{margin:0 0 10px;font-size:16px}p,caption{font-size:12px;line-height:1.5;color:var(--muted)}.notice{border-left:3px solid var(--accent);padding-left:10px}fieldset{display:flex;flex-direction:column;gap:8px;padding:0;border:0}label{display:flex;flex-direction:column;gap:6px;font-size:12px}input,select{padding:7px;font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:5px}select[multiple]{min-height:100px}fieldset button{align-self:flex-start}button{font-size:12px}button.primary{color:white}button:disabled{opacity:.5}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.progress,.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.progress{font-size:12px}.actions{justify-content:flex-end;margin-top:14px}dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px}dl div{padding:8px;background:var(--input);border-radius:5px}dt{color:var(--muted)}dd{margin:4px 0 0}table{font-size:12px;width:100%;border-collapse:collapse}td,th{padding:6px;border:1px solid var(--border);text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-width:250px;margin:0;font-size:11px}.preview-scroll{max-height:220px;overflow:auto}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
</style>
