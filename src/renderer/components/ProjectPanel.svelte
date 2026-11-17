<script lang="ts">
 import {onMount,tick} from 'svelte'
 import {t,plural,formatNumber,getUILanguage} from '../lib/i18n.svelte'
 import type {ProjectInfo,ProjectSourceView} from '../../shared/project'
 import type {ProjectRecipeView} from '../../shared/project-recipes'
 import {subsetSummary} from '../lib/subset-summary'
 let{project,sources,recipes=[],onclose,onadd,onopen,onnewsubset,onopensubset,onanalyzesubset,analysisBusy=false}:{project:ProjectInfo;sources:ProjectSourceView[];recipes?:ProjectRecipeView[];onclose:()=>void;onadd:()=>void;onopen:(source:string,analyze:boolean)=>void;onnewsubset?:(source:string,base?:string)=>void;onopensubset?:(recipe:ProjectRecipeView)=>void;onanalyzesubset?:(recipe:ProjectRecipeView)=>void;analysisBusy?:boolean}=$props()
 let editing=$state(false),busy=$state(false),name=$state(''),message=$state('')
 let request=$state<string|null>(null),operation=$state<'hash'|'find'|null>(null),progress=$state({bytes:0,total:0})
 let renaming=$state<string|null>(null),recipeName=$state(''),removing=$state<ProjectRecipeView|null>(null),removeDialog=$state<HTMLDialogElement>(),removeReturn:HTMLElement|null=null
 const children=$derived.by(()=>{const result=new Map<string,ProjectRecipeView[]>();for(const recipe of recipes){const parent='baseRecipeId' in recipe?'recipe:'+recipe.baseRecipeId:'source:'+recipe.sourceId;result.set(parent,[...result.get(parent)??[],recipe])}return result})
 const unavailableRecipes=$derived(recipes.filter(recipe=>!sources.some(source=>source.id===recipe.rootSourceId)))
 const sourceDependents=(id:string)=>recipes.filter(recipe=>recipe.rootSourceId===id)
 const sourceReady=(source:string)=>sources.find(value=>value.id===source)?.status==='verified'
 const mutationReason=$derived(project.readonly?t('project.future',{version:formatNumber(project.version)}):'')
 const recipeSummary=(recipe:ProjectRecipeView)=>subsetSummary(recipe.steps,getUILanguage())
 async function renameSubset(event:SubmitEvent,recipe:ProjectRecipeView){event.preventDefault();if(!recipeName.trim()||busy)return;busy=true;message='';try{if(await window.freya.projectRenameRecipe(project.id,recipe.id,recipeName))renaming=null}catch(error){message=error instanceof Error?error.message:String(error)}finally{busy=false}}
 async function askRemove(recipe:ProjectRecipeView){removeReturn=document.activeElement as HTMLElement;removing=recipe;await tick();removeDialog?.showModal()}
 async function dismissRemove(){removeDialog?.close();removing=null;await tick();removeReturn?.focus()}
 async function removeSubset(){if(!removing)return;busy=true;message='';try{if(await window.freya.projectRemoveRecipe(project.id,removing.id)){removeDialog?.close();removing=null}}catch(error){message=error instanceof Error?error.message:String(error)}finally{busy=false}}
 onMount(()=>window.freya.onEvent(event=>{const value=event.sourceProgress;if(value&&value.requestId===request)progress={bytes:value.bytes,total:value.total}}))
 async function run(kind:'hash'|'find',id:string){
  request=crypto.randomUUID();operation=kind;busy=true;message='';progress={bytes:0,total:0}
  try{if(kind==='hash')await window.freya.projectReregisterSource(project.id,id,request);else await window.freya.projectRelinkSource(project.id,id,request)}
  catch(error){message=error instanceof Error?error.message:String(error)}
  finally{request=null;operation=null;busy=false}
 }
 async function simple(action:()=>Promise<void>){
  busy=true;message=''
  try{await action()}catch(error){message=error instanceof Error?error.message:String(error)}finally{busy=false}
 }
 function cancel(){if(request)void window.freya.projectCancelSource(request).catch(error=>{message=String(error)})}
 const delimiters={',':'comma',';':'semicolon','\t':'tab','|':'pipe'} as const
 async function rename(event:SubmitEvent){
  event.preventDefault()
  if(!name.trim()||busy)return
  busy=true;message=''
  try{await window.freya.projectRename(project.id,name);editing=false}
  catch(error){message=error instanceof Error?error.message:String(error)}
  finally{busy=false}
 }
</script>
<section class="project-panel">
 {#if editing&&!project.readonly}
  <form onsubmit={rename}>
   <label>{t('project.name')}<input bind:value={name} maxlength="200" required disabled={busy}/></label>
   <div class="actions">
    <button type="button" disabled={busy} onclick={()=>editing=false}>{t('dialog.cancel')}</button>
    <button type="submit" class="btn-primary" disabled={!name.trim()||busy}>{t('dialog.save')}</button>
   </div>
  </form>
 {:else}
  <h2>{project.name}</h2>
 {/if}
 <p class="path" title={project.path}>{project.path}</p>
 {#if message}<p role="alert">{message}</p>{/if}
 {#if project.readonly}<p role="status">{t('project.future',{version:formatNumber(project.version)})}</p>{/if}
 <div class="actions">
  {#if !project.readonly&&!editing}<button onclick={()=>{name=project.name;message='';editing=true}}>{t('project.rename')}</button>{/if}
  <button onclick={onclose} disabled={busy}>{t('project.close')}</button>
 </div>
  <h3>{t('project.sources')}</h3>
  <button onclick={onadd} disabled={busy||project.readonly} title={mutationReason||undefined}>{t('project.source.add')}</button>
  {#if operation}
   {#if operation==='hash'}<progress aria-label={t('project.source.hashing')} max={progress.total||1} value={progress.bytes}></progress>{/if}
   <p role="status" aria-live="polite">{operation==='find'?t('project.source.searching'):t('project.source.hashProgress',{bytes:formatNumber(progress.bytes),total:formatNumber(progress.total)})}</p>
   <button onclick={cancel}>{t('dialog.cancel')}</button>
  {/if}
  {#if sources.length}
   <ul class="sources">{#each sources as source (source.id)}
    <li>
     <strong title={source.path}>{source.name}</strong>
     <p>{t('project.source.summary',{columns:formatNumber(source.columnCount),encoding:t(`csvText.encoding.${source.format.encoding}`),delimiter:t(`project.source.${delimiters[source.format.delimiter]}`),bytes:formatNumber(source.bytes)})}</p>
     <p title={source.status==='verified'?t('project.source.quickOnly'):undefined}>{t(`project.source.status.${source.status}`)} · <span aria-hidden="true">🔒</span> {t('project.source.badge')}</p>
     {#if source.external}<p class="path">{t('project.source.externalNotice')}</p>{/if}
     {#if source.overAnalysis}<p role="status">{t('project.source.overAnalysis')}</p>{/if}
     <div class="actions">
      <button disabled={busy||source.status==='missing'} onclick={()=>onopen(source.id,false)}>{t('dialog.open.button')}</button>
      <button disabled={busy||source.status==='missing'} onclick={()=>onopen(source.id,true)}>{t('analysis.tab.open')}</button>
      <button disabled={busy||source.status==='missing'||source.status==='external'} onclick={()=>void simple(()=>window.freya.projectShowSource(source.id))}>{t('project.showFolder')}</button>
      {#if source.status==='missing'}
       <button disabled={busy||project.readonly} title={mutationReason||undefined} onclick={()=>void run('find',source.id)}>{t('project.source.find')}</button>
      {:else}
       <button disabled={busy||project.readonly||source.status==='external'} title={mutationReason||undefined} onclick={()=>void run('hash',source.id)}>{t('project.source.reregister')}</button>
      {/if}
      {#if onnewsubset}<button disabled={busy||project.readonly||source.status!=='verified'} title={mutationReason||undefined} onclick={()=>onnewsubset?.(source.id)}>{t('subset.new')}</button>{/if}
      <button disabled={busy||project.readonly||sourceDependents(source.id).length>0} aria-describedby={sourceDependents(source.id).length?'source-subsets-'+source.id:undefined} title={mutationReason||undefined} onclick={()=>void simple(()=>window.freya.projectForgetSource(project.id,source.id))}>{t('project.source.forget')}</button>
     </div>
     {#if sourceDependents(source.id).length}<p id={'source-subsets-'+source.id} class="reason">{plural('subset.sourceHasSubsets',sourceDependents(source.id).length)}</p>{/if}
    </li>
   {/each}</ul>
  {:else}
   <p>{t('project.noSources')}</p>
  {/if}
 <h3>{t('subset.section')}</h3>
 {#if recipes.length}{#each sources as source (source.id)}{#if sourceDependents(source.id).length}<h4>{source.name}</h4>{@render recipeList('source:'+source.id)}{/if}{/each}{#if unavailableRecipes.length}<h4>{t('subset.unavailableSection')}</h4>{@render recipeList('',unavailableRecipes)}{/if}{:else}<p>{t('subset.noSubsets')}</p>{/if}
 {#if removing}<dialog bind:this={removeDialog} aria-labelledby="subset-remove-title" oncancel={event=>{event.preventDefault();void dismissRemove()}}><h3 id="subset-remove-title">{t('subset.removeTitle')}</h3><p>{t('subset.removeQuestion',{name:removing.name})}</p><div class="actions"><button type="button" disabled={busy} onclick={()=>void dismissRemove()}>{t('dialog.cancel')}</button><button type="button" disabled={busy} class="btn-primary" onclick={()=>void removeSubset()}>{t('subset.remove')}</button></div></dialog>{/if}
</section>

{#snippet recipeList(parent:string,flat?:ProjectRecipeView[])}
 <ul class="subsets">{#each flat??children.get(parent)??[] as recipe (recipe.id)}
  {@const unavailable=!sourceReady(recipe.rootSourceId)}
  {@const analysisReason=recipe.reason??(sources.find(source=>source.id===recipe.rootSourceId)?.overAnalysis?t('subset.analysis.limit'):'')}
  {@const dependentNames=recipe.dependents.map(id=>recipes.find(value=>value.id===id)?.name??id).join('; ')}
  <li>
   {#if renaming===recipe.id}<form onsubmit={event=>void renameSubset(event,recipe)}><label>{t('subset.name')}<input bind:value={recipeName} maxlength="200" required disabled={busy}/></label><div class="actions"><button type="button" disabled={busy} onclick={()=>renaming=null}>{t('dialog.cancel')}</button><button type="submit" disabled={busy||!recipeName.trim()}>{t('dialog.save')}</button></div></form>{:else}<strong>{recipe.name}</strong>{/if}
   <p>{recipeSummary(recipe)}</p>
   <p>{recipe.reason??(recipe.sourceVersionDifferent?t('subset.versionDifferent'):t('subset.readyState'))}</p>
   {#if !recipe.editable}<p>{t(recipe.executable?'subset.unsupported':'subset.unknown')}</p>{/if}
   <div class="actions">
    {#if onopensubset}<button disabled={busy||unavailable||!recipe.executable&&!recipe.editable} title={recipe.reason} onclick={()=>onopensubset?.(recipe)}>{t('dialog.open.button')}</button>{/if}
    {#if onanalyzesubset}<button disabled={busy||analysisBusy||unavailable||!recipe.executable||!!analysisReason} aria-describedby={analysisReason?'subset-analysis-reason-'+recipe.id:undefined} onclick={()=>onanalyzesubset?.(recipe)}>{t('analysis.tab.open')}</button>{/if}
    {#if onnewsubset}<button disabled={busy||project.readonly||unavailable||recipe.depth>=8} aria-describedby={recipe.depth>=8?'subset-depth-'+recipe.id:undefined} title={mutationReason||undefined} onclick={()=>onnewsubset?.(recipe.rootSourceId,recipe.id)}>{t('subset.new')}</button>{/if}
    <button disabled={busy||project.readonly} title={mutationReason||undefined} onclick={()=>{renaming=recipe.id;recipeName=recipe.name;tick().then(()=>document.querySelector<HTMLInputElement>('.subsets form input')?.focus())}}>{t('subset.rename')}</button>
    <button disabled={busy||project.readonly||recipe.dependents.length>0} aria-describedby={recipe.dependents.length?'subset-dependents-'+recipe.id:undefined} title={mutationReason||undefined} onclick={()=>void askRemove(recipe)}>{t('subset.remove')}</button>
   </div>
   {#if analysisReason}<p id={'subset-analysis-reason-'+recipe.id} class="reason">{analysisReason}</p>{/if}
   {#if recipe.depth>=8}<p id={'subset-depth-'+recipe.id} class="reason">{t('subset.maxDepth')}</p>{/if}
   {#if recipe.dependents.length}<p id={'subset-dependents-'+recipe.id} class="reason">{plural('subset.hasDependents',recipe.dependents.length,{names:dependentNames})}</p>{/if}
   {#if !flat&&recipe.depth<8&&children.has('recipe:'+recipe.id)}{@render recipeList('recipe:'+recipe.id)}{/if}
  </li>
 {/each}</ul>
{/snippet}

<style>
 .project-panel{padding:12px;overflow:auto}
 h2,h3{overflow-wrap:anywhere;margin:0 0 8px}
 h2{font-size:16px}h3{margin-top:16px;font-size:14px}
 p{margin:0 0 12px}.path{color:var(--muted);overflow-wrap:anywhere}
 label{display:grid;gap:6px}input{min-width:0;width:100%}
 .actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
 .sources{list-style:none;margin:12px 0 0;padding:0}
 .sources li{padding:8px 0;border-top:1px solid var(--border);overflow-wrap:anywhere}
 .sources p{margin:4px 0}.sources button{padding:4px 6px}
 progress{width:100%;margin-top:10px}
 .subsets{list-style:none;margin:6px 0 10px;padding-left:12px;border-left:1px solid var(--border)}.subsets li{margin:8px 0;overflow-wrap:anywhere}.subsets p{font-size:12px;margin:4px 0}.reason{font-size:12px;color:var(--muted)}h4{margin:8px 0;font-size:13px}.subsets .actions{gap:5px}.subsets button{padding:4px 6px}.subsets form input{width:100%}dialog{max-width:min(520px,90vw);border:1px solid var(--border);border-radius:var(--radius-control);padding:16px;background:var(--panel);color:var(--text)}dialog::backdrop{background:#0006}
</style>
