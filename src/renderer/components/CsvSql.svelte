<script module lang="ts">const drafts=new Map<string,{sql:string;sources:string[]}>()</script>
<script lang="ts">
 import {t,plural,formatNumber,type TranslationParameters} from '../lib/i18n.svelte'
 import {csvAnalysisSample} from '../lib/csv-analysis-view'
 import {controlHint} from '../lib/control-hint'
 import Icon from './Icon.svelte'
 import {onMount,onDestroy} from 'svelte'
 import Editor from './Editor.svelte'
 import {sqlReport} from '../lib/sql-report'
 import {sqlColumns,quoteIdentifier} from '../../shared/sql-helpers'
 import {assistedSQL,type SqlAssist} from '../../shared/sql-assist'
 import type {DocumentInfo,SqlResult,TableViewMeta} from '../../shared/types'
 let {doc,viewMeta,embedded=false,onclose,onerror,onreport}:{doc:DocumentInfo;viewMeta:TableViewMeta;embedded?:boolean;onclose:()=>void;onerror:(message:string)=>void;onreport:(markdown:string)=>Promise<void>}=$props()
 const sample=$derived(csvAnalysisSample(doc,viewMeta))
 let sql=$state('SELECT * FROM datos;'),choices=$state<DocumentInfo[]>([]),extra=$state<string[]>([]),busy=$state(false),result=$state<SqlResult|null>(null),choicesReady=$state(false),message=$state(''),transferred=$state(0)
 let assist=$state<SqlAssist>({mode:'group',group:0,measure:0,category:1,values:'',aggregate:'count',scale:2,leftKey:0,rightKey:0,leftJoin:true,otherTable:2}),showAssist=$state(false)
 let reporting=$state(false),messageParameters=$state<TranslationParameters>({}),editor=$state<Editor>()
 let executed=false
 const messageText=$derived(message.startsWith('sql.ui.')?t(message,messageParameters):message)
 const columns=$derived(sqlColumns((doc.headers??[]).slice(0,200)))
 function status(key:string,parameters:TranslationParameters={}){message=key;messageParameters=parameters}
 let active:string|undefined
 const sources=$derived([doc,...extra.map(id=>choices.find(choice=>choice.id===id)).filter((value):value is DocumentInfo=>!!value)])
 const hasOtherFiles=$derived(sources.length>1||extra.length>0||choices.some(choice=>choice.id!==doc.id))
 const signature=$derived(JSON.stringify([doc.revision,sql,sources.map(source=>[source.id,source.revision])]))
 const missing=$derived(extra.some(id=>!choices.some(choice=>choice.id===id)))
 const tooWide=$derived(sources.some(source=>(source.headers?.length??0)>200))
 const other=$derived(sources[assist.otherTable-1])
 function cancel(){const previous=active;active=undefined;busy=false;reporting=false;result=null;if(previous)void window.freya.sqlCancel(previous).catch(()=>{})}
 $effect(()=>{void signature;cancel();status(executed?'sql.ui.changed':'')})
 onMount(()=>{const draft=drafts.get(doc.id);if(draft){sql=draft.sql;extra=draft.sources;}void window.freya.documents().then(documents=>{choices=documents.filter(value=>value.kind==='csv');choicesReady=true});return window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress&&event.progress.requestId===active){message=event.progress.phase;transferred=event.progress.rows}else if(event.id&&event.type==='external'&&sources.some(source=>source.id===event.id)){cancel();status('sql.ui.external')}else if(event.document&&sources.some(source=>source.id===event.document!.id)&&event.type==='changed'){cancel();void window.freya.documents().then(documents=>{choices=documents.filter(value=>value.kind==='csv');choicesReady=true})}})})
 onDestroy(()=>{drafts.set(doc.id,{sql,sources:[...extra]});cancel()})
 async function run(){if(busy||!sql.trim())return;if(missing||tooWide){status(missing?'sql.ui.missingSource':'sql.ui.tooWide');return}executed=true;cancel();const requestId=crypto.randomUUID();active=requestId;busy=true;transferred=0;status('sql.ui.preparing');try{const data=await window.freya.sqlRun({requestId,sources:sources.map(source=>({id:source.id,revision:source.revision})),sql});if(active!==requestId)return;result=data;status('sql.ui.complete')}catch(error){if(active===requestId){status('sql.ui.runError',{detail:String(error).replace(/^.*Error: /,'')});onerror(messageText)}}finally{if(active===requestId)busy=false}}
 async function page(offset:number){const id=active;if(!id)return;busy=true;try{const data=await window.freya.sqlPage(id,offset);if(active===id)result=data}catch(error){if(active===id){cancel();message=String(error)}}finally{if(active===id)busy=false}}
 async function report(){
  const id=active,data=result;if(!id||!data||busy)return
  busy=true;reporting=true;status('sql.ui.reportPreparing')
  try{
   const rows:SqlResult['rows']=[]
   for(let offset=0;offset<Math.max(1,data.returnedRows);offset+=100){
    const part=await window.freya.sqlPage(id,offset);if(active!==id)return
    rows.push(...part.rows);status('sql.ui.reportProgress',{rows:formatNumber(rows.length),total:formatNumber(data.returnedRows)})
   }
   if(active!==id)return
   await onreport(sqlReport({...$state.snapshot(data),rows,offset:0},sql))
  }catch(error){if(active===id){status('sql.ui.reportError',{detail:String(error).replace(/^.*Error: /,'')});onerror(messageText)}}
  finally{if(active===id){busy=false;reporting=false}}
 }
 function prepare(){try{sql=assistedSQL(doc.headers??[],other?.headers??[],assist)}catch(error){onerror((error as Error).message)}}
 function insertColumn(name:string){if(!busy)editor?.insertText(quoteIdentifier(name))}
 function executeShortcut(event:KeyboardEvent){
  if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!event.isComposing&&!editor?.isComposing()&&!busy&&sql.trim()){
   // CodeMirror también usa Mod-Enter para insertar una línea: SQL lo intercepta antes.
   event.preventDefault();event.stopPropagation();void run()
  }
 }
 function choose(id:string,checked:boolean){extra=checked?[...extra,id]:extra.filter(value=>value!==id)}
</script>
<svelte:window onkeydown={event=>{if(!embedded&&event.key==='Escape'&&event.target instanceof HTMLElement&&event.target.closest('.sql-panel')){event.preventDefault();onclose()}}}/>
<section class="sql-panel" aria-label={t('sql.ui.region')} onkeydowncapture={executeShortcut}>
 <p class="sql-intro">{t('sql.ui.readonly')}</p>
 <div class="sql-columns" role="group" aria-label={t('sql.ui.columns')}>
  {#each columns as column}<button type="button" {...controlHint(busy?'busy':null,t('sql.ui.insertColumn',{name:column.name}))} aria-label={t('sql.ui.insertColumn',{name:column.name})} disabled={busy} onclick={()=>insertColumn(column.name)}>{column.name}</button>{/each}
 </div>
 <div class="sql-tools">
  <details class="sql-limits"><summary><span aria-hidden="true">ⓘ</span> <span>{t('sql.ui.limits')}</span></summary>
   {#if doc.analysisSubset}<p>{t('subset.analysis.sqlHelp')}</p>{:else}<p>{t('sql.ui.scopeHelp')}</p>{/if}
   <p>{t('sql.ui.resourceHelp')}</p>
   <p>{t('sql.ui.sourceHeading',{table:'datos',name:doc.name})} · {sample===undefined?t('analysis.scope.pending'):doc.analysisSubset?t('subset.analysis.origin'):sample||doc.large?t('sql.ui.fullDisk'):t('sql.ui.memory',{revision:doc.revision})}</p>
  </details>
  {#if hasOtherFiles}<details class="sql-files"><summary>{t('sql.ui.files')}</summary><div class="sources">{#each choices.filter(value=>value.id!==doc.id) as choice}<label><input type="checkbox" checked={extra.includes(choice.id)} disabled={busy||extra.length>=3&&!extra.includes(choice.id)} onchange={event=>choose(choice.id,event.currentTarget.checked)}/>{choice.name}{choice.dirty?t('sql.ui.pending'):''}</label>{/each}</div>{#each sources as source,index}<p>{t('sql.ui.sourceColumns',{table:index===0?'datos':`tabla_${index+1}`})} {#each sqlColumns((source.headers??[]).slice(0,200)) as column,columnIndex}{columnIndex?' · ':''}{column.name!==column.original?t('sql.ui.header',{name:column.name,n:column.index+1}):column.name}{/each}</p>{/each}</details>{/if}
  <button {...controlHint(tooWide?'columnLimit':null)} disabled={tooWide} aria-expanded={showAssist} onclick={()=>showAssist=!showAssist}>{t('sql.ui.assistants')}</button>
  {#if !embedded}<button class="sql-close" title={t('sql.ui.close')} aria-label={t('sql.ui.close')} onclick={onclose}><Icon name="x" size={14}/></button>{/if}
 </div>
 {#if tooWide}<p class="warning">{t('sql.ui.wide')}</p>{/if}
 {#if choicesReady&&missing}<p class="warning">{t('sql.ui.missing')} <button onclick={()=>extra=extra.filter(id=>choices.some(choice=>choice.id===id))}>{t('sql.ui.removeClosed')}</button> {t('sql.ui.reviewTables')}</p>{/if}
 {#if showAssist&&!tooWide}<fieldset disabled={busy}><legend>{t('sql.ui.prepareVisual')}</legend>
  <label>{t('sql.ui.operation')} <select aria-label={t('sql.ui.operationLabel')} bind:value={assist.mode}><option value="group">{t('sql.ui.group')}</option><option value="pivot">{t('sql.ui.pivot')}</option><option value="join">{t('sql.ui.join')}</option></select></label>
  {#if assist.mode==='join'}<label>{t('sql.ui.otherFile')} <select aria-label={t('sql.ui.joinFile')} bind:value={assist.otherTable}>{#each sources.slice(1) as source,index}<option value={index+2}>{source.name}</option>{/each}</select></label><label>{t('sql.ui.primaryKey')} <select aria-label={t('sql.ui.primaryKey')} bind:value={assist.leftKey}>{#each (doc.headers??[]).slice(0,200) as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label><label>{t('sql.ui.otherKey')} <select aria-label={t('sql.ui.otherKey')} bind:value={assist.rightKey}>{#each (other?.headers??[]).slice(0,200) as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label><label><input type="checkbox" bind:checked={assist.leftJoin}/>{t('sql.ui.keepUnmatched')}</label><p>{t('sql.ui.joinHelp')}</p>
  {:else}<label>{t(assist.mode==='pivot'?'sql.ui.rows':'sql.ui.groupBy')} <select aria-label={t('sql.ui.groupColumn')} bind:value={assist.group}>{#each (doc.headers??[]).slice(0,200) as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label><label>{t('sql.ui.summary')} <select aria-label={t('sql.ui.aggregate')} bind:value={assist.aggregate}><option value="count">{t('sql.ui.count')}</option><option value="sum">{t('sql.ui.sum')}</option><option value="average">{t('sql.ui.average')}</option></select></label>
   {#if assist.aggregate!=='count'}<label>{t('sql.ui.numberColumn')} <select aria-label={t('sql.ui.measureColumn')} bind:value={assist.measure}>{#each (doc.headers??[]).slice(0,200) as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label><label>{t('sql.ui.decimals')} <input aria-label={t('sql.ui.analysisDecimals')} type="number" min="0" max="12" bind:value={assist.scale}/></label><p>{t('sql.ui.convertHelp',{scale:assist.scale})}</p>{/if}
   {#if assist.mode==='pivot'}<label>{t('sql.ui.categoriesIn')} <select aria-label={t('sql.ui.categoryColumn')} bind:value={assist.category}>{#each (doc.headers??[]).slice(0,200) as header,index}<option value={index}>{index+1}. {header}</option>{/each}</select></label><label>{t('sql.ui.categoryValues')}<textarea aria-label={t('sql.ui.pivotCategories')} rows="3" bind:value={assist.values}></textarea></label>{/if}
  {/if}<button {...controlHint(busy?'busy':null)} onclick={prepare}>{t('sql.ui.prepare')}</button>
 </fieldset>{/if}
 <div class="sql-editor"><Editor bind:this={editor} text={sql} label={t('sql.ui.query')} kind="sql" readonly={busy} onchange={value=>sql=value}/></div>
 <div class="actions"><button aria-busy={busy} {...controlHint(busy?'busy':!sql.trim()?'query':missing?'fileReady':tooWide?'columnLimit':null)} class="btn-primary" disabled={busy||!sql.trim()||missing||tooWide} onclick={()=>void run()}>{#if busy}<span class="button-spinner" aria-hidden="true"></span>{/if}<span class:busy-label={busy} data-loading={t('ui.button.calculating')}>{t('sql.ui.run')}</span></button>{#if busy}<button onclick={()=>{cancel();status('sql.ui.cancelled')}}>{t(reporting?'sql.ui.cancelReport':'sql.ui.cancelQuery')}</button><progress aria-label={t('sql.ui.running')}></progress><span>{plural('sql.ui.transferred',transferred)}</span>{/if}<span>{t(navigator.platform.startsWith('Mac')?'sql.ui.shortcutMac':'sql.ui.shortcutOther')}</span></div>
 <p class="sql-status" class:sr-only={!messageText} role="status" aria-live="polite" aria-atomic="true">{messageText}</p>
 {#if result}<button {...controlHint(busy?'busy':null)} disabled={busy} onclick={report}>{t('sql.ui.report')}</button><p class="scope">{plural('sql.ui.resultRows',result.returnedRows)}</p>
  <details class="sql-result-details"><summary>{t('sql.ui.resultDetails')}</summary><p>{t('sql.ui.engineVersion',{version:result.version})} · {result.sources.map(source=>t(source.fromDisk?'sql.ui.sourceDisk':'sql.ui.sourceMemory',{name:source.name,rows:formatNumber(source.rows),revision:source.revision})).join(' · ')}</p></details>
  {#if result.limited}<p class="warning">{t('sql.ui.partial')}</p>{/if}
  <div class="sql-results" role="region" aria-label={t('sql.ui.result')}><table><thead><tr>{#each result.columns as column}<th title={column.type}>{column.name}<small>{column.type}</small></th>{/each}</tr></thead><tbody>{#each result.rows as row}<tr>{#each row as value}<td class:missing={value===null}>{value===null?t('sql.ui.null'):value}</td>{/each}</tr>{/each}</tbody></table></div>
  <div class="actions"><button {...controlHint(busy?'busy':result.offset===0?'firstPage':null)} disabled={busy||result.offset===0} onclick={()=>void page(Math.max(0,result!.offset-100))}>{t('sql.ui.previous')}</button><span>{t(result.limited?'sql.ui.pageRetained':'sql.ui.page',{from:formatNumber(result.returnedRows?result.offset+1:0),to:formatNumber(Math.min(result.offset+100,result.returnedRows)),total:formatNumber(result.returnedRows)})}</span><button {...controlHint(busy?'busy':result.offset+100>=result.returnedRows?'lastPage':null)} disabled={busy||result.offset+100>=result.returnedRows} onclick={()=>void page(result!.offset+100)}>{t('sql.ui.next')}</button></div>
 {:else if !busy}<p class="sql-empty">{t('sql.ui.empty')}</p>{/if}
</section>
<style>
 .sql-panel{padding:10px 12px;background:var(--panel);border-bottom:1px solid var(--border);font-size:11px;max-height:55vh;overflow:auto;flex-shrink:0}.sql-panel p{color:var(--muted);line-height:1.5;margin:8px 0}.sql-panel .sql-intro{margin-top:0}.sql-panel summary{cursor:pointer;margin:0}.sql-tools{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;margin:8px 0}.sql-tools>details{min-width:0}.sql-tools>details[open]{flex-basis:100%;order:1}.sql-close{margin-left:auto}.sql-columns{display:flex;flex-wrap:wrap;gap:4px;max-height:76px;overflow:auto;padding:2px}.sql-columns button{min-height:24px;padding:2px 8px;border-radius:var(--radius-control);font-size:inherit}.sources,.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sources label,.sql-panel fieldset label{display:flex;gap:6px;align-items:center}.sql-panel fieldset{margin:8px 0;border:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;padding:8px}.sql-panel fieldset p{flex-basis:100%}.sql-panel textarea{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);padding:6px}.sql-panel select{max-width:200px}.sql-panel input[type=number]{width:60px}.sql-editor{height:150px;border:1px solid var(--border);border-radius:var(--radius-control);margin:8px 0;overflow:hidden;background:var(--bg)}.actions{margin:8px 0}.actions>span{color:var(--muted)}.sql-empty{padding:16px 8px;border:1px dashed var(--border);border-radius:var(--radius-control);text-align:center}.sql-panel progress{width:100px}.sql-results{overflow:auto;max-height:220px;border:1px solid var(--border);background:var(--bg)}.sql-results table{border-collapse:collapse;min-width:100%;white-space:pre-wrap}.sql-results th,.sql-results td{min-width:120px;max-width:320px;padding:6px 8px;border:1px solid var(--border);text-align:left;overflow-wrap:anywhere;vertical-align:top}.sql-results th{position:sticky;top:0;background:var(--panel)}.sql-results small{display:block;color:var(--muted);font-weight:400}.sql-results .missing{color:var(--muted);font-style:italic}.warning{border-left:3px solid var(--accent);padding-left:8px}
</style>
