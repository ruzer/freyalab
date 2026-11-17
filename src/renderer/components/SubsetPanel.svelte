<script module lang="ts">
 import type {TableQuery} from '../../shared/types'
 export interface SubsetIntent {draftId?:string;recipeId?:string;baseRecipeId?:string;blank?:boolean;autorun?:boolean;query?:TableQuery;ignoredSearch?:string[]}
 // Solo memoria de esta ventana; ni resultados ni borradores se escriben en el proyecto.
 type SubsetDraft={name:string;base:string;conditions:import('../../shared/types').TableFilter[];order:import('../../shared/types').TableSort[];mode:'all'|'any';allColumns:boolean;chosen:boolean[];extraSelected:import('../../shared/project').ProjectColumn[];keep:'all'|'first'|'randomRows'|'randomPercent';rows:number|undefined;percent:number|undefined;seed:number|undefined;acknowledged:number[];baseline:string;originalNames:[number,string][]}
 const drafts=new Map<string,SubsetDraft>()
</script>
<script lang="ts">
 import {onMount,onDestroy,tick,untrack} from 'svelte'
 import {t,plural,formatNumber,getUILanguage} from '../lib/i18n.svelte'
 import type {ProjectInfo,ProjectSourceView,ProjectRecipeDraft,ProjectRecipeStep,ProjectColumn} from '../../shared/project'
 import type {ProjectRecipeView} from '../../shared/project-recipes'
 import type {RecipeOperationResult} from '../../shared/recipe-operation'
 import type {TableFilter,TableSort} from '../../shared/types'
 import CsvConditionFields from './CsvConditionFields.svelte'
 import CsvColumnFields from './CsvColumnFields.svelte'
 import CsvOrderFields from './CsvOrderFields.svelte'
 import Icon from './Icon.svelte'
 import {subsetSummary} from '../lib/subset-summary'
 let {project,source,recipes,intent,ontry,oncancel,onsave,onclose}:{project:ProjectInfo;source:ProjectSourceView;recipes:ProjectRecipeView[];intent:SubsetIntent;ontry:(draft:ProjectRecipeDraft,requestId:string)=>Promise<RecipeOperationResult&{sourceVersionDifferent?:boolean}>;oncancel:(requestId:string)=>Promise<void>;onsave:(draft:ProjectRecipeDraft)=>Promise<boolean>;onclose:()=>void}=$props()
 const initial=untrack(()=>({source,intent,original:recipes.find(recipe=>recipe.id===intent.recipeId)}))
 const original=initial.original
 const draftKey=untrack(()=>JSON.stringify([project.path,project.id,source.id,intent.recipeId??intent.draftId??'',intent.baseRecipeId??'',!!intent.blank]))
 const remembered=drafts.get(draftKey)
 const originalNames=new Map<number,string>(initial.source.columns.map(column=>[column.position-1,column.name]))
 for(const step of original?.steps??[]){const columns=step.op==='filter'?step.conditions.map(rule=>rule.column):step.op==='order'?step.by.map(rule=>rule.column):step.op==='select'?step.columns:[];for(const column of columns)originalNames.set(column.position-1,column.name)}
 for(const [position,name] of remembered?.originalNames??[])originalNames.set(position,name)
 const initialFilter=original?.steps.find(step=>step.op==='filter'),initialOrder=original?.steps.find(step=>step.op==='order'),initialSample=original?.steps.find(step=>step.op==='sample'),initialSelect=original?.steps.find(step=>step.op==='select')
 let name=$state(original?.name??''),base=$state(original&&'baseRecipeId' in original?'recipe:'+original.baseRecipeId:initial.intent.baseRecipeId?'recipe:'+initial.intent.baseRecipeId:'source:'+initial.source.id)
 let conditions=$state<TableFilter[]>(initialFilter?.op==='filter'?initialFilter.conditions.map(rule=>({...rule,column:rule.column.position-1})):structuredClone(untrack(()=>$state.snapshot(intent.query?.conditions??[]))))
 let order=$state<TableSort[]>(initialOrder?.op==='order'?initialOrder.by.map(rule=>({...rule,column:rule.column.position-1})):structuredClone(untrack(()=>$state.snapshot(intent.query?.order??(intent.query?.sort?[intent.query.sort]:[])))))
 let mode=$state<'all'|'any'>(initialFilter?.op==='filter'?initialFilter.mode:initial.intent.query?.filterMode??'all')
 let allColumns=$state(!initialSelect),chosen=$state<boolean[]>(initialSelect?.op==='select'?Array.from({length:initial.source.columns.length},(_,index)=>initialSelect.columns.some(column=>column.position===index+1)):[])
 // Las referencias retiradas se guardan como registros, nunca como índices de un array disperso.
 let extraSelected=$state<ProjectColumn[]>(initialSelect?.op==='select'?initialSelect.columns.filter(column=>!initial.source.columns.some(current=>current.position===column.position)):[])
 let keep=$state<'all'|'first'|'randomRows'|'randomPercent'>(initialSample?.op==='sample'?initialSample.method==='first'?'first':'percent' in initialSample?'randomPercent':'randomRows':'all')
 let rows=$state<number|undefined>(initialSample&&'rows' in initialSample?initialSample.rows:100),percent=$state<number|undefined>(initialSample&&'percent' in initialSample?initialSample.percent:5),seed=$state<number|undefined>(initialSample&&'seed' in initialSample?initialSample.seed:newSeed())
 let acknowledged=$state<number[]>([]),busy=$state(false),saving=$state(false),request=$state(''),progress=$state({bytesRead:0,scanned:0,totalBytes:initial.source.bytes})
 let result=$state<(RecipeOperationResult&{sourceVersionDifferent?:boolean})|null>(null),message=$state(''),baseline=$state('')
 let confirmation=$state<'discard'|'impact'|null>(null),dialog=$state<HTMLDialogElement>(),region:HTMLElement,nameInput:HTMLInputElement,confirmationReturn:HTMLElement|null=null,afterClose:(()=>void)|undefined
 let finished=false
 const titleId=$props.id(),reasonId=titleId+'-reason'
 const recipe=$derived(recipes.find(value=>value.id===intent.recipeId)??original)
 const baseRecipe=$derived(base.startsWith('recipe:')?recipes.find(value=>value.id===base.slice(7)):undefined)
 const available=$derived((baseRecipe?.columns??source.columns).map(column=>column.position-1))
 const headers=$derived(source.columns.map(column=>column.name))
 const bases=$derived(recipes.filter(value=>value.rootSourceId===source.id&&value.depth<8&&value.id!==recipe?.id&&!recipe?.dependents.includes(value.id)))
 const immutable=$derived(project.readonly||!!recipe&&!recipe.editable)
 function column(index:number):ProjectColumn{acknowledged;return{position:index+1,name:originalNames.get(index)??source.columns.find(value=>value.position===index+1)?.name??''}}
 const selected=$derived([...new Set([...chosen.flatMap((on,index)=>on?[index]:[]),...extraSelected.map(column=>column.position-1)])].sort((a,b)=>a-b))
 const referenced=$derived([...new Set([...conditions.map(rule=>rule.column),...order.map(rule=>rule.column),...allColumns?[]:selected])])
 const invalidColumns=$derived(referenced.filter(index=>!available.includes(index)||column(index).name!==source.columns.find(value=>value.position===index+1)?.name))
 const nameError=$derived(!name.trim()?t('subset.nameRequired'):name.trim().length>200?t('subset.nameLong'):recipes.some(value=>value.id!==recipe?.id&&value.name.trim().toLowerCase()===name.trim().toLowerCase())?t('subset.nameExists'):'')
 const unboundedOrder=$derived(order.length>0&&keep==='randomRows'&&!baseRecipe?.bounded)
 const invalidSample=$derived(keep!=='all'&&(keep==='randomPercent'?percent===undefined||percent<0.01||percent>100:rows===undefined||!Number.isInteger(rows)||rows<1||rows>1_000_000)||keep.startsWith('random')&&(seed===undefined||!Number.isInteger(seed)||seed<-2147483648||seed>2147483647))
 const blocked=$derived(source.status!=='verified'?t('subset.sourceUnavailable',{reason:t('project.source.status.'+source.status)}):immutable?!recipe?.executable?recipe?.reason??t('subset.unknown'):'':baseRecipe&&!baseRecipe.executable?baseRecipe.reason??t('subset.unknown'):invalidColumns.length?t('subset.columnsChanged'):unboundedOrder?t('subset.unboundedOrder'):invalidSample?t('subset.sampleInvalid'):!allColumns&&!selected.length?t('subset.chooseColumn'):nameError)
 const draft=$derived.by(()=>{
  const steps:ProjectRecipeStep[]=immutable&&recipe?structuredClone($state.snapshot(recipe.steps)):[]
  if(!immutable){
   if(conditions.length)steps.push({op:'filter',mode,conditions:conditions.map(rule=>({...rule,column:column(rule.column),value:rule.value??'',caseSensitive:!!rule.caseSensitive}))})
   if(order.length)steps.push({op:'order',by:order.map(rule=>({...rule,column:column(rule.column),descending:!!rule.descending,numeric:!!rule.numeric}))})
   if(keep==='first')steps.push({op:'sample',method:'first',rows:rows??0})
   else if(keep==='randomRows')steps.push({op:'sample',method:'random',rows:rows??0,seed:seed??0})
   else if(keep==='randomPercent')steps.push({op:'sample',method:'random',percent:percent??0,seed:seed??0})
   if(!allColumns)steps.push({op:'select',columns:selected.map(column)})
  }
  return{...(recipe?{id:recipe.id}:{}),name:immutable&&recipe?recipe.name:name.trim(),...(base.startsWith('recipe:')?{baseRecipeId:base.slice(7)}:{sourceId:source.id}),steps} as ProjectRecipeDraft
 })
 const dirty=$derived(!!baseline&&JSON.stringify(draft)!==baseline)
 const dependents=$derived(recipe?.dependents.map(id=>recipes.find(value=>value.id===id)?.name??id)??[])
 export function focusInitial(){if(immutable)region?.focus();else nameInput?.focus()}
 function newSeed(){return crypto.getRandomValues(new Int32Array(1))[0]}
 function anotherSeed(){const next=newSeed();seed=next===seed?next===2147483647?-2147483648:next+1:next;changed()}
 // Una elección reconoce el nombre de hoy, nunca renombres posteriores en esa posición.
 function acknowledge(index:number){originalNames.set(index,source.columns.find(value=>value.position===index+1)?.name??'');acknowledged=[...acknowledged.filter(value=>value!==index),index];changed()}
 function changed(){result=null;message=''}
 function normalizeSelection(columns:ProjectColumn[],visible:number[]){
  const retained=new Map(extraSelected.map(column=>[column.position,column])),next=chosen.slice(0,columns.length)
  for(let index=columns.length;index<chosen.length;index++)if(chosen[index])retained.set(index+1,column(index))
  for(const [position] of retained)if(columns.some(column=>column.position===position)&&visible.includes(position-1)){next[position-1]=true;retained.delete(position)}
  if(next.length!==chosen.length||next.some((value,index)=>value!==chosen[index]))chosen=next
  const refs=[...retained.values()]
  if(JSON.stringify(refs)!==JSON.stringify(extraSelected))extraSelected=refs
 }
 $effect(()=>{const columns=source.columns,visible=available;untrack(()=>normalizeSelection(columns,visible))})
 onMount(()=>{if(remembered)({name,base,conditions,order,mode,allColumns,chosen,extraSelected,keep,rows,percent,seed,acknowledged,baseline}=structuredClone(remembered));else baseline=JSON.stringify($state.snapshot(draft));normalizeSelection(source.columns,available);focusInitial();if(!remembered&&intent.autorun&&!blocked)void run();return window.freya.onEvent(event=>{if(event.type==='project-recipe-progress'&&event.recipeProgress?.requestId===request)progress=event.recipeProgress})})
 onDestroy(()=>{if(!finished)drafts.set(draftKey,$state.snapshot({name,base,conditions,order,mode,allColumns,chosen,extraSelected,keep,rows,percent,seed,acknowledged,baseline,originalNames:[...originalNames]}));if(request)void oncancel(request).catch(()=>{})})
 async function run(){
  if(busy||saving||blocked)return
  busy=true;result=null;message='';request=crypto.randomUUID();progress={bytesRead:0,scanned:0,totalBytes:source.bytes}
  try{result=await ontry($state.snapshot(draft),request);message=plural(result.cancelled?'subset.cancelledReady':'subset.ready',result.resultCount)}
  catch(error){message=error instanceof Error?error.message:String(error)}
  finally{busy=false;request=''}
 }
 async function cancel(){if(request)try{await oncancel(request)}catch(error){message=error instanceof Error?error.message:String(error)}}
 async function ask(kind:'discard'|'impact'){confirmationReturn=document.activeElement as HTMLElement;confirmation=kind;await tick();dialog?.showModal()}
 async function dismiss(){if(confirmation==='discard')afterClose=undefined;dialog?.close();confirmation=null;await tick();confirmationReturn?.focus()}
 function finishClose(){finished=true;drafts.delete(draftKey);const next=afterClose;afterClose=undefined;onclose();next?.()}
 export function closeThen(next?:()=>void){if(busy||saving){message=t('ui.reason.busy');return}afterClose=next;close()}
 function close(){if(busy||saving)return;if(dirty)void ask('discard');else finishClose()}
 async function save(){if(busy||saving||immutable||blocked)return;if(dependents.length)await ask('impact');else await persist()}
 async function persist(){
  if(confirmation){dialog?.close();confirmation=null}saving=true;message=''
  try{if(await onsave($state.snapshot(draft))){baseline=JSON.stringify($state.snapshot(draft));finishClose()}}
  catch(error){message=error instanceof Error?error.message:String(error)}finally{saving=false}
 }
 const number=(value:number)=>formatNumber(value)
 const previewHeaders=$derived(result?Array.from({length:Math.max(result.headers.length,...result.rows.map(row=>row.length))},(_,index)=>result!.headers[index]??t('csvFields.column',{n:index+1})):[])
</script>
<svelte:window onkeydown={event=>{if(event.key==='Escape'&&!confirmation&&event.target instanceof HTMLElement&&region?.contains(event.target)){event.preventDefault();event.stopPropagation();close()}}}/>
<section bind:this={region} class="subset-tools" aria-labelledby={titleId} tabindex="-1">
 <header><h3 id={titleId}>{t('subset.title')}</h3><button type="button" aria-label={t('subset.close')} disabled={busy||saving} onclick={close}><Icon name="x" size={14}/></button></header>
 <div class="subset-body">
  <label>{t('subset.name')}<input bind:this={nameInput} bind:value={name} maxlength="200" required disabled={immutable||busy||saving} oninput={changed} aria-invalid={!!name.trim()&&!!nameError} aria-describedby={nameError?reasonId:undefined}/></label>
  <label>{t('subset.base')}<select bind:value={base} disabled={immutable||busy||saving} onchange={()=>{allColumns=true;chosen=[];changed()}}><option value={'source:'+source.id}>{t('subset.sourceOption',{name:source.name})}</option>{#each bases as value}<option value={'recipe:'+value.id}>{t('subset.subsetOption',{name:value.name})}</option>{/each}</select></label>
  {#if baseRecipe}<p class="base-description">{t('subset.baseDescription',{name:baseRecipe.name,steps:subsetSummary(baseRecipe.steps,getUILanguage())})}</p>{/if}
  {#if intent.ignoredSearch?.length}<p class="notice" role="note">{t('subset.searchIgnored',{search:intent.ignoredSearch.join(' · ')})}</p>{/if}
  {#if immutable}<p class="notice" role="note">{project.readonly?t('project.future',{version:formatNumber(project.version)}):t('subset.unsupported')}</p>{#if recipe}<p>{subsetSummary(recipe.steps,getUILanguage())}</p>{/if}{/if}
  <fieldset><legend>{t('subset.rows')}</legend><CsvConditionFields {headers} {available} {invalidColumns} disambiguate bind:conditions bind:mode disabled={immutable||busy||saving} onchange={changed} oncolumnchange={acknowledge}/></fieldset>
  <fieldset><legend>{t('subset.order')}</legend><CsvOrderFields {headers} {available} {invalidColumns} disambiguate bind:order disabled={immutable||busy||saving} onchange={changed} oncolumnchange={acknowledge}/><p>{t('subset.orderHelp')}</p></fieldset>
  <fieldset disabled={immutable||busy||saving}><legend>{t('subset.keep')}</legend>
   <select aria-label={t('subset.keep')} bind:value={keep} onchange={changed}><option value="all">{t('subset.keepAll')}</option><option value="first">{t('subset.keepFirst')}</option><option value="randomRows">{t('subset.keepRandomRows')}</option><option value="randomPercent">{t('subset.keepRandomPercent')}</option></select>
   {#if keep==='first'||keep==='randomRows'}<label>{t('subset.rowCount')}<input type="number" min="1" max="1000000" step="1" bind:value={rows} oninput={changed}/></label>{/if}
   {#if keep==='randomPercent'}<label>{t('subset.percent')}<input type="number" min="0.01" max="100" step="any" bind:value={percent} oninput={changed}/></label>{/if}
   {#if keep.startsWith('random')}<label>{t('subset.seed')}<input type="number" min="-2147483648" max="2147483647" step="1" bind:value={seed} oninput={changed}/></label><button type="button" onclick={anotherSeed}>{t('subset.anotherSample')}</button><p>{t('subset.seedHelp')}</p>{/if}
  </fieldset>
  <CsvColumnFields {headers} {available} {invalidColumns} disambiguate legend={t('subset.columns')} bind:chosen bind:allColumns disabled={immutable||busy||saving} onchange={changed} onallchange={all=>{if(all){extraSelected=[];chosen=chosen.map((on,index)=>available.includes(index)&&on)}changed()}} oncolumnchange={acknowledge}/>
  {#if blocked}<p id={reasonId} class="reason">{blocked}</p>{/if}
  {#if result}
   <div class="coverage" role="status">
    <p><strong>{t('subset.finalRows',{n:number(result.resultCount)})}</strong></p>
    {#if result.cancelled}<p>{t('subset.coverageCancelled',{n:number(result.resultCount),scanned:number(result.scanned)})}</p>
    {:else if !result.complete}<p>{t(!immutable&&keep==='first'?'subset.coverageFirst':'subset.coveragePartial',{n:number(result.resultCount),scanned:number(result.scanned)})}</p>
    {:else if !result.sampling.length}<p>{t(result.resultCount===result.scanned&&!baseRecipe&&!draft.steps.some(step=>step.op==='filter')?'subset.coverageAll':'subset.coverageFiltered',{n:number(result.resultCount),total:number(result.scanned)})}</p>
    {:else}
     {#each result.sampling as sample}<p>{t(sample.method==='first'?'subset.coverageOrderedFirst':sample.percent===undefined?'subset.coverageRandomRows':'subset.coverageRandomPercent',{n:number(sample.selected),eligible:number(sample.eligible),percent:number(sample.percent??0),seed:String(sample.seed??0),step:sample.step+1})}{#if sample.requestedRows!==undefined&&sample.requestedRows>sample.eligible} {t('subset.tooFewRows',{requested:number(sample.requestedRows),available:number(sample.eligible)})}{/if}</p>{/each}
     <p>{t('subset.examined',{n:number(result.scanned)})}</p>
    {/if}
    {#if !result.complete}{#each result.sampling as sample}<p>{t(sample.method==='first'?'subset.coveragePartialFirst':sample.percent===undefined?'subset.coveragePartialRandomRows':'subset.coveragePartialRandomPercent',{step:sample.step+1,n:number(sample.selected),requested:number(sample.requestedRows??sample.selected),percent:number(sample.percent??0),seed:String(sample.seed??0)})}</p>{/each}{/if}
    {#if draft.steps.length}<p>{subsetSummary(draft.steps,getUILanguage())}</p>{/if}
    <p>{t('subset.bytesRead',{n:number(result.bytesRead)})} · {t(result.complete?'subset.verifiedIdentity':'subset.partialIdentity')}</p>
    {#if result.sourceVersionDifferent}<p>{t('subset.sourceVersionDifferent',{name:source.name})}</p>{/if}
   </div>
   <!-- svelte-ignore a11y_no_noninteractive_tabindex (La vista previa desplazable admite navegación por teclado.) -->
   {#if result.rows.length}<div class="preview-box" role="region" aria-label={t('subset.preview')} tabindex="0"><table aria-label={t('subset.preview')}><thead><tr>{#each previewHeaders as header}<th scope="col">{header}</th>{/each}</tr></thead><tbody>{#each result.rows as row}<tr>{#each previewHeaders as _,index}{#if index===0}<th scope="row">{row[index]===null||row[index]===undefined?t('subset.missingCell'):row[index]===''?t('subset.emptyCell'):row[index]}</th>{:else}<td>{row[index]===null||row[index]===undefined?t('subset.missingCell'):row[index]===''?t('subset.emptyCell'):row[index]}</td>{/if}{/each}</tr>{/each}</tbody></table></div>{:else}<p>{t('subset.noRows')}</p>{/if}
  {/if}
 </div>
 <footer>
  <button type="button" class="btn-secondary" disabled={busy||saving||!!blocked} aria-describedby={blocked?reasonId:undefined} onclick={()=>void run()}>{t('subset.try')}</button>
  <button type="button" class="btn-primary" disabled={busy||saving||immutable||!!blocked} aria-describedby={blocked?reasonId:undefined} onclick={()=>void save()}>{t('dialog.save')}</button>
  <button type="button" disabled={busy||saving} onclick={close}>{t('subset.close')}</button>
  {#if busy}<button type="button" onclick={()=>void cancel()}>{t('dialog.cancel')}</button><progress max={progress.totalBytes||1} value={progress.bytesRead} aria-label={t('subset.progress')}></progress><span role="status" aria-live="polite">{t('subset.progressBytes',{bytes:number(progress.bytesRead),total:number(progress.totalBytes)})}</span>{/if}
  {#if message}<span role="status" aria-live="polite">{message}</span>{/if}
 </footer>
 {#if confirmation}<dialog bind:this={dialog} aria-labelledby={titleId+'-confirm'} oncancel={event=>{event.preventDefault();void dismiss()}}>
  <h3 id={titleId+'-confirm'}>{t(confirmation==='discard'?'subset.discardTitle':'subset.impactTitle')}</h3>
  <p>{confirmation==='discard'?t('subset.discardQuestion'):plural('subset.impact',dependents.length,{names:dependents.join('; ')})}</p>
  <div class="actions"><button type="button" onclick={()=>void dismiss()}>{t('dialog.cancel')}</button><button type="button" class="btn-primary" onclick={()=>{if(confirmation==='discard'){dialog?.close();confirmation=null;finishClose()}else void persist()}}>{t(confirmation==='discard'?'subset.discard':'dialog.save')}</button></div>
 </dialog>{/if}
</section>
<style>
 .subset-tools{display:flex;flex-direction:column;flex-shrink:0;max-height:min(72vh,660px);min-height:0;border-bottom:1px solid var(--border);background:var(--panel);font-size:var(--font-control,13px)}header,footer,.actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px}header{justify-content:space-between}h3{font-size:14px;margin:0}header button{background:transparent;border:0}.subset-body{overflow:auto;min-height:0;padding:0 12px}label{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 12px 4px 0}input,select{max-width:100%;min-height:28px}input{width:220px}input[type=number]{width:110px}fieldset{border:1px solid var(--border);margin:8px 0;padding:8px}legend{font-weight:600}p{margin:6px 0;line-height:1.5;overflow-wrap:anywhere}.notice,.reason{border-left:3px solid var(--accent);padding:5px 8px}.reason{color:var(--danger)}footer{flex-shrink:0;border-top:1px solid var(--border)}footer span{font-size:12px}button{min-height:28px}button:focus-visible,input:focus-visible,select:focus-visible,.preview-box:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.preview-box{max-height:190px;overflow:auto;border:1px solid var(--border);margin:8px 0}.preview-box table{border-collapse:collapse;min-width:100%}.preview-box th,.preview-box td{white-space:pre;max-width:300px;border-bottom:1px solid var(--border);padding:4px 8px;text-align:left}.preview-box thead th{position:sticky;top:0;background:var(--panel)}.coverage{font-size:12px}dialog{max-width:min(520px,90vw);border:1px solid var(--border);border-radius:var(--radius-control);color:var(--text);background:var(--panel);padding:16px}dialog::backdrop{background:#0006}dialog .actions{padding:8px 0 0;justify-content:flex-end}@media(max-width:800px){.subset-tools{max-height:76vh}.subset-body>label{display:flex}input,select{min-width:0}footer{gap:5px}}
</style>
