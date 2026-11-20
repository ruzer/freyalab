<script lang="ts">
 import {onMount,tick} from 'svelte'
 import {t,plural,formatNumber,formatBytes,formatDate,getUILanguage} from '../lib/i18n.svelte'
 import type {ProjectInfo,ProjectSourceView} from '../../shared/project'
 import type {ProjectRecipeView} from '../../shared/project-recipes'
 import type {ProjectResultView} from '../../shared/project-exports'
 import {projectResultSummary,projectResultWarnings,type ProjectExportJob} from '../lib/project-result'
 import {subsetSummary} from '../lib/subset-summary'
 import Icon from './Icon.svelte'
 import ContextMenu from './ContextMenu.svelte'
 import ProjectExportStatus from './ProjectExportStatus.svelte'
 let{project,sources,recipes=[],results=[],exportJobs=[],onclose,onadd,onopen,onnewsubset,onopensubset,onanalyzesubset,onexportsubset,onopenresult,onshowresult,onaddresultsource,onregisterresult,oncancelexport,analysisBusy=false}: {
  project:ProjectInfo;sources:ProjectSourceView[];recipes?:ProjectRecipeView[];results?:ProjectResultView[];exportJobs?:ProjectExportJob[]
  onclose:()=>void;onadd:()=>void;onopen:(source:string,analyze:boolean)=>void;onnewsubset?:(source:string,base?:string)=>void
  onopensubset?:(recipe:ProjectRecipeView)=>void;onanalyzesubset?:(recipe:ProjectRecipeView)=>void;onexportsubset:(recipe:ProjectRecipeView)=>void
  onopenresult:(id:string)=>void;onshowresult:(id:string)=>void;onaddresultsource:(id:string)=>void;onregisterresult:(id:string)=>void;oncancelexport:(requestId:string)=>void;analysisBusy?:boolean
 }=$props()
 type Node=ProjectSourceView|ProjectRecipeView|ProjectResultView
 type Action={key:string;run:()=>unknown;reason?:string;separator?:boolean;danger?:boolean}
 let panel:HTMLElement,projectButton:HTMLButtonElement
 let selected=$state<string|null>(null),focused=$state<string|null>(null),collapsed=$state(new Set<string>())
 let menu=$state<{key:string;x:number;y:number}|null>(null)
 let busy=$state(false),request=$state<string|null>(null),operation=$state<'hash'|'find'|null>(null),operationSource=$state<string|null>(null),progress=$state({bytes:0,total:0})
 let problem=$state<{key:string;message:string}|null>(null)
 let renaming=$state<string|null>(null),name=$state(''),renameError=$state('')
 let removing=$state<{kind:'recipe';node:ProjectRecipeView}|{kind:'result';node:ProjectResultView}|null>(null),removeDialog=$state<HTMLDialogElement>()
 const isSource=(node:Node):node is ProjectSourceView=>sources.some(source=>source===node)
 const isResult=(node:Node):node is ProjectResultView=>'recipeId'in node
 const keyOf=(node:Node)=>(isResult(node)?'result:':isSource(node)?'source:':'recipe:')+node.id
 const nodes=$derived(new Map<string,Node>([...sources,...recipes,...results].map(node=>[keyOf(node),node])))
 const children=$derived.by(()=>{
  const tree=new Map<string,Node[]>()
  for(const recipe of recipes){const parent='baseRecipeId'in recipe?'recipe:'+recipe.baseRecipeId:'source:'+recipe.sourceId;tree.set(parent,[...tree.get(parent)??[],recipe])}
  for(const result of [...results].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id))){const parent='recipe:'+result.recipeId;tree.set(parent,[...tree.get(parent)??[],result])}
  return tree
 })
 function childNodes(node:Node,flat=false){return(children.get(keyOf(node))??[]).filter(child=>isResult(child)||!flat&&!isSource(child)&&child.depth<=8)}
 const unavailable=$derived(recipes.filter(recipe=>!sources.some(source=>source.id===recipe.rootSourceId)))
 const visible=$derived.by(()=>{
  const rows:{key:string;parent:string|null}[]=[],seen=new Set<string>()
  function add(node:Node,parent:string|null,depth:number,flat=false){const key=keyOf(node);if(seen.has(key)||depth>10||!isResult(node)&&depth>9)return;seen.add(key);rows.push({key,parent});if(!collapsed.has(key))for(const child of childNodes(node,flat))add(child,key,depth+1)}
  for(const node of sources)add(node,null,1)
  for(const node of unavailable)add(node,null,1,true)
  return rows
 })
 const menuNode=$derived(menu&&menu.key!=='project'?nodes.get(menu.key):undefined)
 const menuActions=$derived(menu?.key==='project'?projectActions():menuNode?actions(menuNode):[])
 const mutationReason=$derived(project.readonly?t('project.future',{version:formatNumber(project.version)}):'')
 const busyReason=()=>busy?t('ui.reason.busy'):''
 const sourceOf=(node:Node)=>isSource(node)?node:sources.find(source=>source.id===(isResult(node)?recipes.find(recipe=>recipe.id===node.recipeId)?.rootSourceId:node.rootSourceId))
 const sourceDependents=(id:string)=>recipes.filter(recipe=>recipe.rootSourceId===id)
 const capitalize=(text:string)=>text.charAt(0).toLocaleUpperCase()+text.slice(1)
 const detail=(node:Node)=>isResult(node)?plural('project.result.detail',node.provenance.coverage.matched,{date:formatDate(new Date(node.createdAt),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}):isSource(node)?plural('project.tree.sourceDetail',node.columnCount,{size:formatBytes(node.bytes)})+(node.external?' · '+t('project.source.status.external'):''):capitalize(subsetSummary(node.steps,getUILanguage()))
 function nodeProblem(node:Node){
  if(problem?.key===keyOf(node))return problem.message
  if(isResult(node))return node.status==='verified'?'':node.reason||t(node.status==='changed'?'project.export.changed':node.status==='missing'?'project.export.missing':'project.result.unknown')
  if(isSource(node))return node.status==='changed'||node.status==='missing'?t('project.source.status.'+node.status):''
  const source=sourceOf(node)
  return !node.executable&&(!source||source.status==='verified')?node.reason??t('subset.unknown'):''
 }
 function title(node:Node){if(isResult(node))return[node.name,node.path,projectResultSummary(node,getUILanguage()),nodeProblem(node),node.isSource?t('project.result.alsoSource'):'',...projectResultWarnings(node)].filter(Boolean).join('\n');return isSource(node)?[node.name,node.path,node.external?t('project.source.externalNotice'):''].filter(Boolean).join('\n'):[node.name,node.sourceVersionDifferent?t('subset.versionDifferent'):'',!node.editable?t(node.executable?'subset.unsupported':'subset.unknown'):''].filter(Boolean).join('\n')}
 $effect(()=>{if(menu&&menu.key!=='project'&&!nodes.has(menu.key))menu=null;if(selected&&!nodes.has(selected))selected=null;if(focused&&!visible.some(row=>row.key===focused))focused=visible[0]?.key??null})
 async function focus(key:string){await tick();if(key==='project')projectButton?.focus();else panel?.querySelector<HTMLElement>(`[data-project-node="${CSS.escape(key)}"]`)?.focus()}
 function toggle(node:Node){const key=keyOf(node),next=new Set(collapsed);if(next.has(key))next.delete(key);else next.add(key);collapsed=next;focused=key}
 function showMenu(event:MouseEvent|KeyboardEvent,key:string){
  event.preventDefault();event.stopPropagation();const target=event.currentTarget as HTMLElement,box=target.getBoundingClientRect()
  if(key!=='project'){selected=key;focused=key}
  menu={key,x:event instanceof MouseEvent&&event.type==='contextmenu'?event.clientX:box.right,y:event instanceof MouseEvent&&event.type==='contextmenu'?event.clientY:box.top}
 }
 async function closeMenu(restore:boolean){const key=menu?.key;menu=null;if(restore&&key)await focus(key)}
 function choose(action:Action){if(action.reason)return;menu=null;action.run()}
 function openNode(node:Node){const action=actions(node)[0];selected=keyOf(node);if(!action.reason)action.run()}
 function rowClick(event:MouseEvent,node:Node){if((event.target as HTMLElement).closest('[role="treeitem"]')!==event.currentTarget||(event.target as HTMLElement).closest('button,input,form'))return;selected=keyOf(node);focused=keyOf(node);void focus(keyOf(node));if((event.target as HTMLElement).closest('[data-disclosure]')&&childNodes(node).length)toggle(node);else openNode(node)}
 function rowContext(event:MouseEvent,node:Node){if((event.target as HTMLElement).closest('[role="treeitem"]')===event.currentTarget)showMenu(event,keyOf(node))}
 function rowKey(event:KeyboardEvent,node:Node){
  if(event.target!==event.currentTarget)return
  const key=keyOf(node),index=visible.findIndex(row=>row.key===key),kids=childNodes(node,!isSource(node)&&!isResult(node)&&unavailable.some(recipe=>recipe.id===node.id))
  if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey){showMenu(event,key);return}
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(event.key))return
  event.preventDefault();event.stopPropagation()
  if(event.key==='Enter'){openNode(node);return}
  if(event.key===' '){selected=key;return}
  if(event.key==='ArrowRight'){if(kids.length&&collapsed.has(key))toggle(node);else if(kids.length)void focus(visible[index+1]?.key??key);return}
  if(event.key==='ArrowLeft'){if(kids.length&&!collapsed.has(key))toggle(node);else if(visible[index]?.parent)void focus(visible[index].parent!);return}
  const target=event.key==='Home'?0:event.key==='End'?visible.length-1:Math.max(0,Math.min(visible.length-1,index+(event.key==='ArrowDown'?1:-1)))
  if(visible[target])void focus(visible[target].key)
 }
 async function beginRename(key:string,current:string){renaming=key;name=current;renameError='';await tick();panel.querySelector<HTMLInputElement>('input[data-project-rename]')?.focus()}
 async function cancelRename(restore:boolean){const key=renaming;renaming=null;renameError='';if(restore&&key)await focus(key)}
 async function rename(event:SubmitEvent){
  event.preventDefault();event.stopPropagation();if(!renaming||!name.trim()||busy)return
  const key=renaming;busy=true;renameError=''
  try{if(key==='project')await window.freya.projectRename(project.id,name);else if(!await window.freya.projectRenameRecipe(project.id,key.slice('recipe:'.length),name))return;renaming=null;await focus(key)}
  catch(error){renameError=error instanceof Error?error.message:String(error)}finally{busy=false;if(renaming===key){await tick();panel.querySelector<HTMLInputElement>('input[data-project-rename]')?.focus()}}
 }
 async function simple(key:string,action:()=>Promise<void>){busy=true;problem=null;try{await action()}catch(error){problem={key,message:error instanceof Error?error.message:String(error)}}finally{busy=false}}
 onMount(()=>window.freya.onEvent(event=>{const value=event.sourceProgress;if(value&&value.requestId===request)progress={bytes:value.bytes,total:value.total}}))
 async function run(kind:'hash'|'find',id:string){request=crypto.randomUUID();operation=kind;operationSource=id;busy=true;problem=null;progress={bytes:0,total:0};try{if(kind==='hash')await window.freya.projectReregisterSource(project.id,id,request);else await window.freya.projectRelinkSource(project.id,id,request)}catch(error){problem={key:'source:'+id,message:error instanceof Error?error.message:String(error)}}finally{request=null;operation=null;operationSource=null;busy=false}}
 function cancel(){if(request)void window.freya.projectCancelSource(request).catch(error=>{if(operationSource)problem={key:'source:'+operationSource,message:String(error)}})}
 async function askRemove(node:ProjectRecipeView|ProjectResultView){removing=isResult(node)?{kind:'result',node}:{kind:'recipe',node};await tick();removeDialog?.showModal()}
 async function dismissRemove(){const key=removing?(removing.kind==='result'?'result:':'recipe:')+removing.node.id:null;removeDialog?.close();removing=null;if(key)await focus(key)}
 async function removeNode(){
  if(!removing||busy||mutationReason)return
  const item=removing,key=(item.kind==='result'?'result:':'recipe:')+item.node.id,parent=visible.find(row=>row.key===key)?.parent
  busy=true;problem=null
  try{const removed=item.kind==='result'?await window.freya.projectForgetResult(project.id,item.node.id):await window.freya.projectRemoveRecipe(project.id,item.node.id);if(removed){removeDialog?.close();removing=null;await focus(parent??visible[0]?.key??'project')}}
  catch(error){problem={key,message:error instanceof Error?error.message:String(error)}}finally{busy=false}
 }
 function projectActions():Action[]{return[
  {key:'project.rename',reason:busyReason()||mutationReason,run:()=>beginRename('project',project.name)},
  {key:'project.showFolder',reason:busyReason(),run:()=>simple('project',()=>window.freya.projectShow(project.id))},
  {key:'project.close',separator:true,reason:busyReason(),run:onclose}
 ]}
 function exportReason(recipe:ProjectRecipeView){
  const source=sourceOf(recipe),sourceReason=!source?t('project.source.missing'):source.status!=='verified'?t(source.status==='external'?'project.source.authorize':'project.source.status.'+source.status):''
  return busyReason()||mutationReason||(!source||source.status!=='verified'||!recipe.executable?recipe.reason||sourceReason||t('subset.unknown'):'')
 }
 function actions(node:Node):Action[]{
  if(isResult(node)){
   const missing=node.status==='missing'?node.reason||t('project.export.missing'):'',changed=node.status==='changed'?node.reason||t('project.export.changed'):''
   return[
    {key:'dialog.open.button',reason:busyReason()||missing,run:()=>onopenresult(node.id)},
    {key:'project.showFolder',reason:busyReason()||missing,run:()=>onshowresult(node.id)},
    {key:'project.result.addSource',reason:busyReason()||mutationReason||(node.isSource?t('project.export.isSource'):'')||missing||changed,run:()=>onaddresultsource(node.id)},
    {key:'project.source.forget',separator:true,danger:true,reason:busyReason()||mutationReason,run:()=>askRemove(node)}
   ]
  }
  const source=sourceOf(node),unavailable=!source||source.status!=='verified',missing=source?.status==='missing'?t('project.source.status.missing'):'',sourceReason=source&&source.status!=='verified'?t(source.status==='external'?'project.source.authorize':'project.source.status.'+source.status):''
  if(isSource(node))return[
   {key:'dialog.open.button',reason:busyReason()||missing,run:()=>onopen(node.id,false)},
   {key:'analysis.tab.open',reason:busyReason()||missing||(node.overAnalysis?t('project.source.overAnalysis'):''),run:()=>onopen(node.id,true)},
   {key:'subset.new',reason:busyReason()||mutationReason||sourceReason,run:()=>onnewsubset?.(node.id)},
   {key:'project.showFolder',separator:true,reason:busyReason()||missing||(node.status==='external'?t('project.source.authorize'):''),run:()=>simple(keyOf(node),()=>window.freya.projectShowSource(node.id))},
   {key:node.status==='missing'?'project.source.find':'project.source.reregister',reason:busyReason()||mutationReason||(node.status==='external'?t('project.source.authorize'):''),run:()=>run(node.status==='missing'?'find':'hash',node.id)},
   {key:'project.source.forget',separator:true,danger:true,reason:busyReason()||mutationReason||(sourceDependents(node.id).length?plural('subset.sourceHasSubsets',sourceDependents(node.id).length):''),run:()=>simple(keyOf(node),()=>window.freya.projectForgetSource(project.id,node.id))}
  ]
  const names=node.dependents.map(id=>recipes.find(recipe=>recipe.id===id)?.name??id).join('; '),reason=node.reason||sourceReason,count=results.filter(result=>result.recipeId===node.id).length
  const removeReason=[count?plural('project.result.hasResults',count):'',node.dependents.length?plural('subset.hasDependents',node.dependents.length,{names}):''].filter(Boolean).join(' ')
  return[
   {key:'dialog.open.button',reason:busyReason()||(unavailable?reason||t('project.source.missing'):'')||(!node.executable&&!node.editable?reason||t('subset.unknown'):''),run:()=>onopensubset?.(node)},
   {key:'analysis.tab.open',reason:busyReason()||(analysisBusy?t('ui.reason.busy'):'')||(unavailable||!node.executable?reason||t('subset.unknown'):'')||(source?.overAnalysis?t('subset.analysis.limit'):''),run:()=>onanalyzesubset?.(node)},
   {key:'project.export.action',reason:exportReason(node),run:()=>onexportsubset(node)},
   {key:'subset.newFromThis',reason:busyReason()||mutationReason||(unavailable?sourceReason||t('project.source.missing'):'')||(node.depth>=8?t('subset.maxDepth'):''),run:()=>onnewsubset?.(node.rootSourceId,node.id)},
   {key:'subset.rename',separator:true,reason:busyReason()||mutationReason,run:()=>beginRename(keyOf(node),node.name)},
   {key:'subset.remove',separator:true,danger:true,reason:busyReason()||mutationReason||removeReason,run:()=>askRemove(node)}
  ]
 }
</script>
<section bind:this={panel} class="project-panel">
 <header class="project-header">
  {#if renaming==='project'}{@render renameForm('project')}{:else}<h2 title={project.path}>{project.name}</h2>{/if}
  <button bind:this={projectButton} class="icon-button project-actions" type="button" aria-label={t('project.actions')} aria-haspopup="menu" aria-expanded={menu?.key==='project'} onclick={event=>showMenu(event,'project')}>⋯</button>
 </header>
 {#if problem?.key==='project'}<p class="header-message" role="alert">{problem.message}</p>{/if}
 {#if project.readonly}<p id="project-mutation-reason" class="header-message" role="status">{mutationReason}</p>{/if}
 <h3 class="sources-heading"><span>{t('project.sources')}</span><button class="icon-button" type="button" onclick={onadd} disabled={busy||project.readonly} aria-label={t('project.source.add')} title={mutationReason||t('project.source.add')} aria-describedby={project.readonly?'project-mutation-reason':undefined}><Icon name="plus" size={16}/></button></h3>
 <p class="protection-note" title={t('project.source.protected')}><Icon name="lock" size={12}/><span>{t('project.source.badge')}</span><span aria-hidden="true">·</span><span class="truncate">{t('project.tree.protection')}</span></p>
 {#if !sources.length}<p class="header-message">{t('project.noSources')}</p>{/if}
 {#if sources.length||unavailable.length}<div role="tree" aria-label={t('project.tree.label')}>
  {@render nodeList(sources,1)}
  {#if unavailable.length}<div role="group" aria-label={t('subset.unavailableSection')}><h3 class="unavailable-heading">{t('subset.unavailableSection')}</h3>{@render nodeList(unavailable,1,true)}</div>{/if}
 </div>{/if}
 {#if menu}<ContextMenu x={menu.x} y={menu.y} label={menu.key==='project'?t('project.actions'):t('project.tree.actions',{name:menuNode?.name??''})} onclose={restore=>void closeMenu(restore)}>
  {#each menuActions as action,index}
   {#if action.separator}<div class="menu-separator" role="separator"></div>{/if}
   <div role="presentation"><button type="button" role="menuitem" class="project-menu-item" class:menu-danger={action.danger} aria-disabled={action.reason?'true':undefined} aria-describedby={action.reason?'project-menu-reason-'+index:undefined} onclick={()=>choose(action)}>{t(action.key)}</button>{#if action.reason}<p id={'project-menu-reason-'+index} class="menu-reason">{action.reason}</p>{/if}</div>
  {/each}
 </ContextMenu>{/if}
 {#if removing}<dialog bind:this={removeDialog} aria-labelledby="project-remove-title" oncancel={event=>{event.preventDefault();void dismissRemove()}}><h3 id="project-remove-title">{t(removing.kind==='result'?'project.result.forgetTitle':'subset.removeTitle')}</h3><p>{t(removing.kind==='result'?'project.result.forgetQuestion':'subset.removeQuestion',{name:removing.node.name})}</p><div class="actions"><button type="button" disabled={busy} onclick={()=>void dismissRemove()}>{t('dialog.cancel')}</button><button type="button" disabled={busy} class="btn-primary" onclick={()=>void removeNode()}>{t(removing.kind==='result'?'project.source.forget':'subset.remove')}</button></div></dialog>{/if}
</section>

{#snippet renameForm(key:string)}
 <form class="rename-form" onsubmit={rename}><label class="sr-only" for="project-tree-rename">{t(key==='project'?'project.name':'subset.name')}</label><input id="project-tree-rename" data-project-rename bind:value={name} maxlength="200" required disabled={busy} aria-invalid={renameError?true:undefined} aria-describedby={renameError?'project-rename-error':undefined} onblur={()=>{if(!busy)void cancelRename(false)}} onkeydown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();void cancelRename(true)}}}/>{#if renameError}<p id="project-rename-error" class="rename-error" role="alert">{renameError}</p>{/if}</form>
{/snippet}
{#snippet nodeList(items:Node[],level:number,flat=false)}
 {#each items as node (keyOf(node))}
  {@const key=keyOf(node)}{@const kids=childNodes(node,flat).filter(child=>level<9||isResult(child))}{@const issue=nodeProblem(node)}
  <div role="treeitem" class="project-tree-item" class:selected={selected===key} data-project-node={key} title={title(node)} tabindex={(focused??visible[0]?.key)===key?0:-1} aria-labelledby={'project-name-'+key} aria-describedby={'project-detail-'+key+(issue?' project-problem-'+key:'')+(isResult(node)&&node.isSource?' project-also-source-'+key:'')} aria-level={level} aria-expanded={kids.length?!collapsed.has(key):undefined} aria-selected={selected===key} onfocus={()=>focused=key} onclick={event=>rowClick(event,node)} oncontextmenu={event=>rowContext(event,node)} onkeydown={event=>rowKey(event,node)}>
   <div class="tree-item project-tree-row" style:padding-left={`${12+(level-1)*16}px`}>
    <span class="tree-symbol" data-disclosure aria-hidden="true">{#if kids.length}<Icon name={collapsed.has(key)?'chevron-right':'chevron-down'} size={12}/>{/if}</span>
    <span class="file-icon" aria-hidden="true">{#if isResult(node)}<Icon name="file" size={14}/>{:else if isSource(node)}<Icon name="table" size={14}/>{:else}<Icon name="filter" size={14}/>{/if}</span>
    <div class="node-copy">
     {#if renaming===key}<span id={'project-name-'+key} class="sr-only">{node.name}</span>{@render renameForm(key)}{:else}<span id={'project-name-'+key} class="node-name truncate" title={title(node)}>{node.name}</span>{/if}
     <span id={'project-detail-'+key} class="node-detail truncate" title={detail(node)}>{detail(node)}</span>
     {#if isResult(node)&&node.isSource}<span id={'project-also-source-'+key} class="result-source-badge">{t('project.result.alsoSource')}</span>{/if}
    </div>
    <button class="icon-button node-more" type="button" tabindex="-1" aria-label={t('project.tree.more',{name:node.name})} aria-haspopup="menu" aria-expanded={menu?.key===key} onclick={event=>{event.stopPropagation();showMenu(event,key)}}>⋯</button>
   </div>
   {#if issue}<p id={'project-problem-'+key} role={problem?.key===key?'alert':undefined} class="node-problem" style:padding-left={`${38+(level-1)*16}px`}>
    <Icon name="triangle-alert" size={12}/><span>{issue}</span>
    {#if isSource(node)&&['changed','missing'].includes(node.status)&&problem?.key!==key}<button type="button" disabled={busy||project.readonly} title={mutationReason||undefined} onclick={event=>{event.stopPropagation();void run(node.status==='missing'?'find':'hash',node.id)}}>{t(node.status==='missing'?'project.source.find':'project.source.reregister')}</button>{/if}
   </p>{/if}
   {#if isSource(node)&&operationSource===node.id&&operation}<div class="node-progress" style:padding-left={`${38+(level-1)*16}px`}>
    {#if operation==='hash'}<progress aria-label={t('project.source.hashing')} max={progress.total||1} value={progress.bytes}></progress>{/if}
    <p role="status" aria-live="polite">{operation==='find'?t('project.source.searching'):t('project.source.hashProgress',{bytes:formatNumber(progress.bytes),total:formatNumber(progress.total)})}</p>
    <button type="button" onclick={event=>{event.stopPropagation();cancel()}}>{t('dialog.cancel')}</button>
   </div>{/if}
   {#if !isSource(node)&&!isResult(node)&&sourceOf(node)?.overAnalysis}
    {@const limitReason=exportReason(node)}
    <div class="node-problem analysis-export" style:padding-left={`${38+(level-1)*16}px`}><Icon name="triangle-alert" size={12}/><span id={'project-analysis-limit-'+key}>{t('subset.analysis.limit')}</span><button type="button" aria-disabled={limitReason?'true':undefined} aria-describedby={'project-analysis-limit-'+key+(limitReason?' project-export-reason-'+key:'')} title={limitReason||undefined} onclick={event=>{event.stopPropagation();if(!limitReason)onexportsubset(node)}}>{t('project.export.action')}</button>{#if limitReason}<span id={'project-export-reason-'+key}>{limitReason}</span>{/if}</div>
   {/if}
   {#if isResult(node)}{#each projectResultWarnings(node) as warning}<p class="node-problem result-warning" style:padding-left={`${38+(level-1)*16}px`}>{warning}</p>{/each}{/if}
   {#if !isSource(node)&&!isResult(node)}{@const jobs=exportJobs.filter(job=>job.projectId===project.id&&job.recipeId===node.id)}{#if jobs.length}<div class="node-export" style:padding-left={`${38+(level-1)*16}px`}><ProjectExportStatus {jobs} {results} {mutationReason} {onopenresult} {onshowresult} {onaddresultsource} {onregisterresult} {oncancelexport}/></div>{/if}{/if}
   {#if kids.length&&!collapsed.has(key)&&level<10}<div role="group">{@render nodeList(kids,level+1)}</div>{/if}
  </div>
 {/each}
{/snippet}

<style>
 .project-panel{padding:12px 0;overflow:auto;min-width:0}.project-header{display:flex;align-items:center;gap:6px;margin:0 12px 8px;min-width:0}h2{font-size:14px;font-weight:600;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}.icon-button{width:24px;height:24px;flex:none;padding:0;font-size:20px;line-height:1}.sources-heading{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:12px 12px 5px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.protection-note{display:flex;align-items:center;gap:4px;margin:0 12px 10px;font-size:11px;color:var(--muted);min-width:0}.header-message{margin:6px 12px;font-size:12px;overflow-wrap:anywhere}.unavailable-heading{margin:12px;font-size:11px;color:var(--muted)}.project-tree-item{min-width:0;outline:none}.project-tree-row{min-height:44px;min-width:0;padding-top:4px;padding-bottom:4px;padding-right:8px;gap:6px}.node-copy{display:flex;flex-direction:column;min-width:0;flex:1;gap:2px}.node-name{font-weight:500;display:block}.node-detail{font-size:11px;color:var(--muted);display:block}.node-more{visibility:hidden}.project-tree-row:hover .node-more,.project-tree-row:focus-within .node-more,.project-tree-item:focus>.project-tree-row .node-more,.project-tree-item.selected>.project-tree-row .node-more{visibility:visible}.project-tree-row:hover{background:var(--hover)}.project-tree-item.selected>.project-tree-row{background:var(--tint)}.project-tree-item:focus-visible>.project-tree-row{outline:2px solid var(--accent);outline-offset:-2px}.node-problem{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:4px 8px 6px 0;font-size:11px;color:var(--text);overflow-wrap:anywhere}.node-problem>:global(.icon){color:var(--warning)}.node-problem span{flex:1 1 10em;min-width:0}.node-problem button,.node-progress button{font-size:11px;padding:3px 5px}.node-progress{padding-right:10px;font-size:11px;color:var(--muted)}.node-progress progress{width:100%}.node-progress p{margin:4px 0}.rename-form{min-width:0;flex:1}.rename-form input{min-width:0;width:100%;padding:3px 5px;font-size:12px}.rename-error{font-size:11px;color:var(--danger);margin:4px 0;overflow-wrap:anywhere}.project-menu-item{width:100%;text-align:left}.menu-reason{font-size:11px;color:var(--muted);padding:0 7px 6px;margin:0;overflow-wrap:anywhere}.menu-danger{color:var(--danger)}.menu-separator{height:1px;flex:none;background:var(--border);margin:4px}.actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}dialog{max-width:min(520px,90vw);border:1px solid var(--border);border-radius:var(--radius-control);padding:16px;background:var(--panel);color:var(--text)}dialog::backdrop{background:#0006}
 .analysis-export button[aria-disabled="true"]{opacity:.5;cursor:default}
 .node-export{min-width:0;padding-right:10px;margin:5px 0 8px}.result-warning{display:block}.result-source-badge{display:block;width:fit-content;max-width:100%;padding:1px 4px;border:1px solid var(--border);border-radius:var(--radius-control);font-size:10px;color:var(--muted);overflow-wrap:anywhere}
 @media(forced-colors:active){.project-tree-item.selected>.project-tree-row{background:SelectedItem;color:SelectedItemText}.project-tree-item:focus-visible>.project-tree-row{outline-color:Highlight}.menu-danger{color:CanvasText}}
</style>
