<script lang="ts">
 import {onMount,tick,untrack} from 'svelte'
 import {quoteIdentifier,sqlColumns} from '../../shared/sql-helpers'
 import type {ColumnRead} from '../../shared/calculated-column'
 import type {DocumentInfo} from '../../shared/types'
 import {t} from '../lib/i18n.svelte'

 let {doc,name=$bindable(),expression=$bindable(),columns=$bindable(),onError=$bindable(),busy}:{doc:DocumentInfo;name:string;expression:string;columns:ColumnRead[];onError:'empty'|'abort';busy:boolean}=$props()
 const uid=$props.id()
 const fields=$derived(sqlColumns(doc.headers??[]))
 // Solo decide qué controles mostrar. DuckDB valida la fórmula al preparar la vista previa.
 const tokens=/--[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|(?:E'(?:''|\\[\s\S]|[^'\\])*|'(?:''|[^'])*)(?:'|$)|"(?:""|[^"])*"|[\p{L}\p{Nl}_][\p{L}\p{M}\p{N}_$]*/giu
 const used=$derived.by(()=>{
  const names=new Set<string>()
  for(const match of expression.matchAll(tokens)){
   const text=match[0]
   if(text.startsWith('"'))names.add(text.slice(1,-1).replaceAll('""','"').toLowerCase())
   else if(/^[\p{L}\p{Nl}_]/u.test(text)&&!/^e'/iu.test(text)&&!expression.slice(match.index+text.length).trimStart().startsWith('('))names.add(text.toLowerCase())
  }
  return fields.filter(field=>names.has(field.name.toLowerCase()))
 })
 const profileKey=$derived(used.map(({index})=>index).join(','))
 const headers=$derived(new Set((doc.headers??[]).map(header=>header.toLowerCase())))
 const suggestedName=$derived(uniqueName(name))
 function uniqueName(base:string){
  if(!headers.has(base.toLowerCase()))return base
  let suffix=2
  while(headers.has(`${base} ${suffix}`.toLowerCase()))suffix++
  return `${base} ${suffix}`
 }
 onMount(()=>{if(!name)name=uniqueName(t('calculate.defaultName'))})
 let formula=$state<HTMLInputElement>(),nameField=$state<HTMLInputElement>()
 let profiles=$state<Record<number,ColumnRead['read']>>({})
 let profileSource=''

 $effect(()=>{
  const indexes=used.map(({index})=>index)
  const previous=untrack(()=>columns)
  if(indexes.length!==previous.length||indexes.some((index,i)=>index!==previous[i].index))columns=indexes.map(index=>previous.find(column=>column.index===index)??{index,read:'text'})
 })
 $effect(()=>{
  const {id,revision}=doc,key=profileKey,source=`${id}:${revision}`
  if(source!==profileSource){profileSource=source;profiles={}}
  if(busy||!key)return
  let requestId:string|undefined,cancelled=false
  void (async()=>{
   for(const index of key.split(',').map(Number)){
    if(cancelled||busy)break
    if(untrack(()=>profiles[index]!==undefined))continue
    requestId=crypto.randomUUID()
    try{
     const {profile}=await window.freya.analyzeColumn(id,{column:index,revision,requestId,frequencyOffset:0,duplicatesOnly:false,bins:1})
     if(!cancelled)profiles[index]=profile.kind==='number'||profile.kind==='date'?profile.kind:'text'
    }catch{
     // Una sugerencia fallida deja disponible la lectura explícita en los tres formatos.
    }finally{requestId=undefined}
   }
  })()
  return ()=>{
   cancelled=true
   if(requestId)void window.freya.cancelAnalysis(id,requestId).catch(()=>{})
  }
 })

 function read(index:number):ColumnRead{return columns.find(column=>column.index===index)??{index,read:'text'}}
 function setRead(index:number,kind:ColumnRead['read']){
  columns=used.map(field=>field.index===index?(kind==='number'?{index,read:kind,scale:read(index).scale??0}:{index,read:kind}):read(field.index))
 }
 function setScale(index:number,scale:number){
  if(Number.isInteger(scale)&&scale>=0&&scale<=12)columns=columns.map(column=>column.index===index?{...column,scale}:column)
 }
 async function insertColumn(select:HTMLSelectElement){
  const field=fields.find(item=>String(item.index)===select.value)
  select.value=''
  if(!field||!formula)return
  const start=formula.selectionStart??expression.length,end=formula.selectionEnd??start,identifier=quoteIdentifier(field.name)
  expression=expression.slice(0,start)+identifier+expression.slice(end)
  await tick()
  formula?.focus()
  formula?.setSelectionRange(start+identifier.length,start+identifier.length)
 }
</script>

<fieldset class="calculation-fields" disabled={busy}>
 <legend class="sr-only">{t('calculate.action')}</legend>
 <label>{t('calculate.name')}
  <input required maxlength="10000" bind:this={nameField} bind:value={name}/>
 </label>
 {#if doc.hasHeader===false}<p>{t('calculate.noHeader')}</p>
 {:else if suggestedName!==name}
  <div class="name-suggestion">
   <p>{t('calculate.duplicate',{name:suggestedName})}</p>
   <button type="button" onclick={()=>{name=suggestedName;nameField?.focus()}}>{t('calculate.useName',{name:suggestedName})}</button>
  </div>
 {/if}
 <div class="formula-fields">
  <label>{t('calculate.formula')}
   <input bind:this={formula} bind:value={expression} required maxlength="100000" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby={`${uid}-formula-help`}/>
  </label>
  <label>{t('calculate.insertColumn')}
   <select value="" aria-label={t('calculate.insertColumn')} onchange={event=>void insertColumn(event.currentTarget)}>
    <option value="" disabled>{t('calculate.columns')}</option>
    {#each fields as field (field.index)}<option value={String(field.index)}>{field.name}</option>{/each}
   </select>
  </label>
 </div>
 <p id={`${uid}-formula-help`}>{t('calculate.formulaHint')}</p>
 {#if used.length}
  <fieldset class="reads">
   <legend>{t('calculate.reads')}</legend>
   {#each used as field (field.index)}
    {@const choice=read(field.index)}
    {@const suggestion=profiles[field.index]}
    <div class="read-field">
     <label>{t('calculate.read',{column:field.name})}
      <select value={choice.read} aria-label={t('calculate.read',{column:field.name})} aria-describedby={choice.read==='text'&&suggestion&&suggestion!=='text'?`${uid}-profile-${field.index}`:undefined} onchange={event=>setRead(field.index,event.currentTarget.value as ColumnRead['read'])}>
       <option value="text">{t('calculate.read.text')}</option>
       <option value="number">{t('calculate.read.number')}</option>
       <option value="date">{t('calculate.read.date')}</option>
      </select>
     </label>
     {#if choice.read==='number'}
      <label>{t('calculate.scale',{column:field.name})}
       <input type="number" min="0" max="12" step="1" required value={choice.scale??0} oninput={event=>setScale(field.index,event.currentTarget.valueAsNumber)}/>
      </label>
     {:else if choice.read==='text'&&suggestion&&suggestion!=='text'}
      <p id={`${uid}-profile-${field.index}`}>{t('calculate.read.suggested',{column:field.name,type:t(`calculate.read.${suggestion}`)})}</p>
     {/if}
    </div>
   {/each}
  </fieldset>
 {/if}
 <label>{t('calculate.onError')}
  <select aria-label={t('calculate.onError')} bind:value={onError}>
   <option value="empty">{t('calculate.onError.empty')}</option>
   <option value="abort">{t('calculate.onError.abort')}</option>
  </select>
 </label>
</fieldset>

<style>
 .calculation-fields,.reads{display:grid;gap:8px;margin:0;padding:0;border:0;min-inline-size:0}
 label{display:grid;gap:5px;min-inline-size:0;font-size:var(--font-ui);overflow-wrap:anywhere}
 input,select{min-inline-size:0;padding:7px;font:inherit;color:var(--text);background:var(--input);border:1px solid var(--control);border-radius:var(--radius-control)}
 .formula-fields,.read-field{display:grid;align-items:end;grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr));gap:8px}
 .reads{padding-block:6px}.reads legend,p{font-size:var(--font-dense);color:var(--muted)}
 p{margin:0;overflow-wrap:anywhere}.name-suggestion{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
 button{justify-self:start;max-width:100%;white-space:normal;overflow-wrap:anywhere}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
 @media(forced-colors:active){input:focus-visible,select:focus-visible{outline-color:Highlight}}
</style>
