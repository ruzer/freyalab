<script lang="ts">
 import {formatNumber,t} from '../lib/i18n.svelte'
 import {controlHint} from '../lib/control-hint'
 import {onMount,onDestroy,tick,untrack} from 'svelte'
 import type {DocumentInfo,TableTransformEdit,TableTransformPreview,TableQuery,TableRange} from '../../shared/types'
 import {readCalculationError,type CalculateColumnEdit,type ColumnRead} from '../../shared/calculated-column'
 import {sqlColumns} from '../../shared/sql-helpers'
 import CsvCalculationFields from './CsvCalculationFields.svelte'
 type Edit=TableTransformEdit|CalculateColumnEdit
 let {doc,initialColumns,initialOperation,initialRows,initialRange,viewQuery,onapply,onclose,onerror}:{doc:DocumentInfo;initialColumns:number[];initialOperation?:Edit['operation'];initialRows:string[];initialRange:TableRange|null;viewQuery:TableQuery;onapply:(edit:Edit)=>Promise<string|null>;onclose:()=>void;onerror:(message:string)=>void}=$props()
 const calculation=untrack(()=>initialOperation==='calculate')
 let operation=$state<TableTransformEdit['operation']>(untrack(()=>initialOperation==='calculate'?'split':initialOperation??'split')),columns=$state<number[]>(untrack(()=>initialColumns.length?[...initialColumns]:[0])),separator=$state(';'),custom=$state(''),name=$state('Combinada')
 let preview=$state<TableTransformPreview|null>(null),prepared=$state<Edit|null>(null),busy=$state(false),processed=$state(0),message=$state('Elige la operación y revisa su vista previa.'),external=$state(false),dialog:HTMLDialogElement
 let calculationName=$state(''),expression=$state(''),reads=$state<ColumnRead[]>([]),onError=$state<CalculateColumnEdit['onError']>('empty'),calculationError=$state<{text:string;detail?:string}|null>(null)
 let previewButton=$state<HTMLButtonElement>(),applyButton=$state<HTMLButtonElement>(),cancelButton=$state<HTMLButtonElement>()
 const calculated=$derived(preview&&'emptyRows'in preview?preview as import('../../shared/calculated-column').CalculatedColumnPreview:null)
 const names=$derived(calculation?sqlColumns(doc.headers??[]):[])
 const markedRows=untrack(()=>[...initialRows]),markedRange=untrack(()=>initialRange?structuredClone($state.snapshot(initialRange)):null)
 const hasSelection=markedRows.length>0||!!markedRange
 let rowScope=$state(hasSelection?'selection':'range'),from=$state(1),to=$state(1),destination=$state(1)
 const viewKey=$derived(JSON.stringify([viewQuery.search,viewQuery.filters,viewQuery.sort,viewQuery.order,viewQuery.conditions,viewQuery.filterMode]))
 const ordering=$derived(['moveRows','moveColumns','commitOrder'].includes(operation))
 let active:string|undefined,applying=false,closeAfterApply=false
 const operations={split:'Dividir una columna',combine:'Combinar columnas',deduplicate:'Eliminar filas duplicadas',normalize:'Componer texto Unicode (NFC)',headers:'Normalizar encabezados',moveRows:'Mover filas',moveColumns:'Mover columnas',commitOrder:'Fijar orden de la vista en el documento'} as const
 const selectedSeparator=$derived(separator==='custom'?custom:separator)
 function cancel(){const id=active??(calculation?prepared?.requestId:undefined);active=undefined;busy=false;if(id)void window.freya.cancelAnalysis(doc.id,id).catch(()=>{})}
 function cancelPreparation(){if(applying&&active){message=calculation?t('calculate.progress.stopping'):'Solicitando cancelación. Si el cambio ya se aplicó, se podrá deshacer.';void window.freya.cancelAnalysis(doc.id,active).catch(error=>onerror(String(error)));return}cancel();preview=null;prepared=null;calculationError=null;message=calculation?t('calculate.error.cancelled'):'Preparación cancelada. Revisa una nueva vista previa para aplicar.';if(calculation)void tick().then(()=>previewButton?.focus())}
 function requestClose(){if(calculation&&applying){closeAfterApply=true;cancelPreparation();return}onclose()}
 function invalidate(){cancel();preview=null;prepared=null;calculationError=null;message=calculation?t('calculate.progress.review'):'Opciones o datos actualizados. Pulsa Vista previa.'}
 $effect(()=>{void doc.revision;if(calculation){void calculationName;void expression;void reads;void onError}else{void operation;void columns;void separator;void custom;void name;void rowScope;void from;void to;void destination;void viewKey}if(!applying)untrack(invalidate)})
 onDestroy(cancel)
 onMount(()=>{dialog.showModal();return window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress&&event.progress.requestId===active){processed=event.progress.rows;message=event.progress.phase.startsWith('calculate.')?t(event.progress.phase):event.progress.phase}else if(event.type==='external'&&event.id===doc.id){invalidate();external=true;message=calculation?t('calculate.error.disk'):'El archivo cambió en disco. Cierra este diálogo y revisa o recarga el documento antes de transformar.'}})})
 function explain(error:unknown){
  const known=readCalculationError(error)
  if(known)return {text:t('calculate.error.'+known.code,{column:known.column??'',row:known.row??''}),detail:known.detail}
  const detail=String(error).replace(/^Error: /,'')
  const localized=['changed','disk','timeout','result','preview','cancelled','sandbox'].map(key=>t('calculate.error.'+key)).find(text=>text===detail)
  return localized?{text:localized}:{text:t('calculate.error.generic'),detail}
 }
 async function inspect(){
  if(busy||external)return;cancel();preview=null;prepared=null;calculationError=null;processed=0;busy=true
  if(calculation){
   const request:CalculateColumnEdit={type:'structure',operation:'calculate',name:calculationName,position:doc.headers?.length??0,expression,columns:$state.snapshot(reads),onError,revision:doc.revision,requestId:crypto.randomUUID()}
   active=request.requestId;message=t('calculate.progress.starting')
   void tick().then(()=>{if(active===request.requestId)cancelButton?.focus()})
   try{const result=await window.freya.transformPreview(doc.id,request);if(active===request.requestId){preview=result;prepared=request;message=t('calculate.progress.ready')}}
   catch(error){if(active===request.requestId){message='';calculationError=explain(error)}}
   finally{if(active===request.requestId){const focus=document.activeElement===cancelButton;active=undefined;busy=false;if(focus)void tick().then(()=>(applyButton?.disabled?previewButton:applyButton)?.focus())}}
   return
  }
  const request:TableTransformEdit={type:'structure',operation,columns:operation==='headers'?[0]:operation==='moveRows'||operation==='commitOrder'?[]:[...columns],revision:doc.revision,requestId:crypto.randomUUID(),separator:selectedSeparator,name}
  if(operation==='moveRows'){request.destination=destination-1;if(rowScope==='selection'){if(markedRows.length)request.rowIds=[...markedRows];else request.range=markedRange??undefined}else request.range={top:from-1,bottom:to-1,left:0,right:0,revision:doc.revision,query:{offset:0,limit:200,requestId:0}}}
  if(operation==='moveColumns')request.destination=destination-1
  if(operation==='commitOrder')request.query=$state.snapshot(viewQuery)
  active=request.requestId;message='Preparando vista previa…'
  try{const result=await window.freya.transformPreview(doc.id,request);if(active===request.requestId){preview=result;prepared=request;message='Vista previa lista. El documento sigue intacto.'}}catch(error){if(active===request.requestId){message=String(error).replace(/^.*Error: /,'');onerror(message)}}finally{if(active===request.requestId){active=undefined;busy=false}}
 }
 async function apply(){
  if(!preview||!prepared||busy||external)return
  const edit={...$state.snapshot(prepared),requestId:crypto.randomUUID()};active=edit.requestId;applying=true;busy=true;processed=0;message=calculation?t('calculate.progress.applying'):'Preparando el cambio…'
  if(calculation)void tick().then(()=>{if(active===edit.requestId)cancelButton?.focus()})
  try{const error=await onapply(edit);if(active!==edit.requestId)return;if(error===null||closeAfterApply)onclose();else{preview=null;prepared=null;if(calculation){message='';calculationError=explain(error);void tick().then(()=>previewButton?.focus())}else message='No se aplicó el cambio. '+error}}finally{applying=false;if(active===edit.requestId){active=undefined;busy=false}}
 }
 const changes=$derived(!!preview&&(preview.cells>0||preview.addedColumns>0||preview.deletedRows>0||preview.changedHeaders>0||preview.movedRows>0||preview.movedColumns>0))
 const blocked=$derived(onError==='abort'&&!!calculated?.failures)
</script>
<dialog bind:this={dialog} class:calculation aria-labelledby="csv-transform-title" oncancel={event=>{event.preventDefault();requestClose()}}>
 <h3 id="csv-transform-title">{calculation?t('calculate.action'):'Transformar documento CSV'}</h3>
 {#if calculation}
  <div class="calculation-content">
  <p class="notice">{t('calculate.scope')}</p>
  <form onsubmit={event=>{event.preventDefault();void inspect()}}>
   <fieldset disabled={busy||external}><legend class="sr-only">{t('calculate.action')}</legend>
    <CsvCalculationFields {doc} busy={busy||external} bind:name={calculationName} bind:expression bind:columns={reads} bind:onError/>
    <button bind:this={previewButton} type="submit" aria-busy={busy} disabled={!calculationName.trim()||!expression.trim()}>{t('calculate.preview')}</button>
   </fieldset>
  </form>
  <p role="status">{message}</p>
  {#if busy}<div class="progress"><progress aria-label={t('calculate.progress.preparing')}></progress><span>{t('calculate.progress.rows',{rows:formatNumber(processed)})}</span><button bind:this={cancelButton} class="btn-ghost" onclick={cancelPreparation}>{t('calculate.cancel')}</button></div>{/if}
  {#if calculationError}<div role="alert"><p>{calculationError.text}</p>{#if calculationError.detail}<details><summary>{t('calculate.detail')}</summary><pre>{calculationError.detail}</pre></details>{/if}</div>{/if}
  {#if calculated}
   <dl>
    <div><dt>{t('calculate.preview.rows')}</dt><dd>{formatNumber(calculated.rows)}</dd></div>
    <div><dt>{t('calculate.preview.empty')}</dt><dd>{formatNumber(calculated.emptyRows)}</dd></div>
    <div><dt>{t('calculate.preview.failures')}</dt><dd>{formatNumber(calculated.failures)}</dd></div>
    {#each reads.filter(column=>column.read!=='text') as {index} (index)}<div><dt>{t('calculate.preview.unread',{column:names[index]?.name??''})}</dt><dd>{formatNumber(calculated.invalidByColumn[index]??0)}</dd></div>{/each}
   </dl>
   {#if calculated.failures}<p id="calculation-failures">{blocked?t('calculate.error.failedRows'):t('calculate.preview.failureHint')}</p>{/if}
   {#if calculated.samples.length}
    <div class="preview-scroll"><table><caption>{t('calculate.preview.examples')}</caption>
     <thead><tr><th scope="col">{t('calculate.preview.row')}</th><th scope="col">{t('calculate.preview.source')}</th><th scope="col">{t('calculate.preview.result')}</th></tr></thead>
     <tbody>{#each calculated.samples as sample}<tr><th scope="row">{formatNumber((sample.row??0)+1)}</th><td><pre>{sample.before}</pre></td><td><pre>{sample.after}</pre></td></tr>{/each}</tbody>
    </table></div>
   {/if}
  {/if}
  </div>
  <div class="actions"><button bind:this={applyButton} class="primary" aria-busy={busy} aria-describedby={blocked?'calculation-failures':undefined} disabled={busy||external||!changes||blocked} onclick={()=>void apply()}>{t('calculate.apply')}</button><button onclick={requestClose}>{t('calculate.close')}</button></div>
 {:else}
 {#if ordering}<p class="notice"><strong>Cambiar orden del documento:</strong> se conserva el contenido; Guardar persistirá el nuevo orden. Después de aplicar se muestra el documento completo sin filtros ni orden de vista. Un paso de deshacer.</p>{:else}<p class="notice"><strong>Documento completo:</strong> incluye filas ocultas por búsqueda o filtros; excluye encabezados salvo que elijas normalizarlos. No usa el rango de filas seleccionado. Un paso de deshacer.</p>{/if}
 <form onsubmit={event=>{event.preventDefault();void inspect()}}>
  <fieldset disabled={busy||external}><legend class="sr-only">Opciones de transformación</legend>
   <label>Operación <select aria-label="Transformación CSV" bind:value={operation}>{#each Object.entries(operations) as [value,title]}<option value={value}>{title}</option>{/each}</select></label>
   {#if !['headers','moveRows','commitOrder'].includes(operation)}<label>Columnas <select multiple size="5" aria-label="Columnas para transformar" bind:value={columns}>{#each doc.headers??[] as header,index}<option value={index}>{index+1}. {header||`Columna ${index+1}`}</option>{/each}</select></label><p>Ctrl/⌘ y Mayús permiten marcar varias columnas. Dividir necesita una; combinar y mover mantienen el orden relativo original de las columnas marcadas.</p>{/if}
   {#if operation==='moveRows'}<label>Filas para mover <select aria-label="Filas para mover" bind:value={rowScope}><option value="selection" disabled={!hasSelection}>Selección de la tabla</option><option value="range">Intervalo del documento original</option></select></label>
    {#if rowScope==='selection'}<p>{markedRows.length?`${markedRows.length} filas marcadas en la tabla`:`Filas ${(markedRange?.top??0)+1}–${(markedRange?.bottom??0)+1} de la vista seleccionada`}. Se conserva su orden relativo original.</p>{:else}<label>Desde <input aria-label="Primera fila original" type="number" min="1" max={doc.rowCount??0} bind:value={from}/></label><label>Hasta <input aria-label="Última fila original" type="number" min="1" max={doc.rowCount??0} bind:value={to}/></label>{/if}
   {/if}
   {#if operation==='moveRows'||operation==='moveColumns'}<label>Insertar antes de {operation==='moveRows'?'la fila original':'la columna original'} <input aria-label="Posición original de destino" type="number" min="1" max={(operation==='moveRows'?(doc.rowCount??0):(doc.headers?.length??0))+1} bind:value={destination}/></label><button {...controlHint(busy?'busy':external?'external':null)} type="button" onclick={()=>destination=(operation==='moveRows'?(doc.rowCount??0):(doc.headers?.length??0))+1}>Colocar al final</button><p>El destino usa posiciones originales, sin filtros ni orden de vista. No debe formar parte de la selección. Mover columnas incluye todas las filas y sus encabezados; se rechaza si convertiría campos ausentes en vacíos.</p>{/if}
   {#if operation==='commitOrder'}<p>Convierte la ordenación actual de la vista en el orden físico del documento. Requiere ordenar primero y quitar toda búsqueda o filtro; no elimina filas ni cambia sus valores. Los empates conservan su orden relativo.</p>{/if}
   {#if operation==='split'||operation==='combine'}<label>Separador <select aria-label="Separador de transformación" bind:value={separator}><option value=";">Punto y coma</option><option value=",">Coma</option><option value="|">Barra vertical</option><option value={'\t'}>Tabulación</option><option value=" ">Espacio</option><option value="custom">Texto personalizado</option></select></label>{#if separator==='custom'}<label>Texto literal <input aria-label="Separador literal" maxlength="64" bind:value={custom}/></label>{/if}<p>Se interpreta como texto literal, sin reglas de comillas ni expresiones regulares. Las columnas originales se conservan; las resultantes se añaden al principio para conservar también campos originales ausentes. Máximo 32 columnas nuevas al dividir.</p>{/if}
   {#if operation==='combine'}<label>Nombre de la columna nueva <input aria-label="Nombre de columna combinada" maxlength="10000" bind:value={name}/></label>{/if}
   {#if operation==='deduplicate'}<p>Compara el texto exacto de las columnas marcadas y conserva la primera fila en el orden original. Vacío y campo ausente son diferentes. Elimina las filas repetidas completas, incluidas sus otras celdas.</p>{/if}
   {#if operation==='normalize'}<p>Compone caracteres Unicode equivalentes (NFC). Conserva espacios, mayúsculas, acentos e identificadores. No convierte números ni fechas.</p>{/if}
   {#if operation==='headers'}<p>Todos los encabezados: compone Unicode, quita espacios de los extremos, sustituye espacios internos por guiones bajos y pasa a minúsculas. Genera nombres para vacíos y añade sufijos para evitar duplicados. No cambia celdas de datos.</p>{/if}
   <button aria-busy={busy} {...controlHint(busy?'busy':external?'external':operation==='moveRows'&&!doc.rowCount?'noRows':operation==='split'&&columns.length!==1?'oneColumn':!['headers','moveRows','commitOrder'].includes(operation)&&!columns.length?'columns':null)} type="submit" disabled={!['headers','moveRows','commitOrder'].includes(operation)&&!columns.length||operation==='split'&&columns.length!==1||operation==='moveRows'&&!doc.rowCount}>{#if busy}<span class="button-spinner" aria-hidden="true"></span>{/if}<span class:busy-label={busy} data-loading={t('ui.button.calculating')}>Vista previa</span></button>
  </fieldset>
 </form>
 <p role="status">{message}</p>
 {#if busy}<div class="progress"><progress aria-label="Preparación de transformación"></progress><span>{processed.toLocaleString()} elementos revisados</span><button class="btn-ghost" onclick={cancelPreparation}>Cancelar preparación</button></div>{/if}
 {#if preview}<dl>{#each (ordering?[['Filas originales',preview.rows],['Filas afectadas',preview.affected],['Filas que cambian de posición',preview.movedRows],['Columnas que cambian de posición',preview.movedColumns]]:[['Filas originales',preview.rows],['Filas afectadas',preview.affected],['Celdas escritas',preview.cells],['Columnas añadidas',preview.addedColumns],['Filas por eliminar',preview.deletedRows],['Encabezados renombrados',preview.changedHeaders]]) as [label,value]}<div><dt>{label}</dt><dd>{Number(value).toLocaleString()}</dd></div>{/each}</dl>
  {#if preview.samples.length}<div class="preview-scroll"><table><caption>Hasta ocho ejemplos, textos abreviados a 256 caracteres. Posiciones originales, sin contar la fila de encabezados.</caption><thead><tr><th>Posición original</th><th>Antes</th><th>Después</th></tr></thead><tbody>{#each preview.samples as sample}<tr><th>{sample.row===null?'Encabezado':`Fila ${sample.row+1}`}{#if sample.column!==null} / columna {sample.column+1}{/if}</th><td><pre>{sample.before}</pre></td><td><pre>{sample.after}</pre></td></tr>{/each}</tbody></table></div>{/if}
 {/if}
 <p>La preparación se puede cancelar; el cambio final se aplica completo y se puede deshacer. Los límites de edición, codificación y recuperación siguen vigentes; presupuesto de deshacer de 20 MiB.</p>
 <div class="actions"><button aria-busy={busy} {...controlHint(busy?'busy':external?'external':!preview?'preview':!changes?'noChanges':null)} class="primary" disabled={busy||external||!changes} onclick={()=>void apply()}>{#if busy}<span class="button-spinner" aria-hidden="true"></span>{/if}<span class:busy-label={busy} data-loading={t('ui.button.calculating')}>Aplicar transformación</span></button><button onclick={onclose}>Cerrar</button></div>
 {/if}
</dialog>
<style>
 dialog.calculation[open]{display:flex;flex-direction:column;max-height:calc(100dvh - 48px);overflow:hidden}
 .calculation-content{min-height:0;overflow:auto;padding:4px}
 .calculation-content :is(dt,pre){overflow-wrap:anywhere}
 dialog{margin:auto;width:min(740px,90vw);max-height:85vh;overflow:auto;color:var(--text);background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px}dialog::backdrop{background:#0007}h3{margin:0 0 10px;font-size:16px}p,caption{font-size:12px;line-height:1.5;color:var(--muted)}.notice{border-left:3px solid var(--accent);padding-left:10px}fieldset{display:flex;flex-direction:column;gap:8px;padding:0;border:0}label{display:flex;flex-direction:column;gap:6px;font-size:12px}input,select{padding:7px;font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:var(--radius-control)}select[multiple]{min-height:100px}fieldset button{align-self:flex-start}button{font-size:12px}button.primary{color:white}button:disabled{opacity:.5}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.progress,.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.progress{font-size:12px}.actions{justify-content:flex-end;margin-top:14px}dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px}dl div{padding:8px;background:var(--input);border-radius:var(--radius-control)}dt{color:var(--muted)}dd{margin:4px 0 0}table{font-size:12px;width:100%;border-collapse:collapse}td,th{padding:6px;border:1px solid var(--border);text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-width:250px;margin:0;font-size:11px}.preview-scroll{max-height:220px;overflow:auto}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
</style>
