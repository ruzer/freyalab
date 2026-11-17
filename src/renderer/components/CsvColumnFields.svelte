<script lang="ts">
 import {t,formatNumber} from '../lib/i18n.svelte'
 let {headers,available,disabled=false,disambiguate=false,invalidColumns=[],oncolumnchange,onallchange,chosen=$bindable([]),allColumns=$bindable(true),legend,onchange=()=>{}}:{headers:string[];available?:number[];disabled?:boolean;disambiguate?:boolean;invalidColumns?:number[];oncolumnchange?:(column:number)=>void;onallchange?:(all:boolean)=>void;chosen:boolean[];allColumns:boolean;legend?:string;onchange?:()=>void}=$props()
 const columns=$derived(available??headers.map((_,index)=>index))
 const none=$derived(!allColumns&&!columns.some(index=>chosen[index]))
 const errorId=$props.id()
 const label=(column:number)=>disambiguate&&(!headers[column]||headers.filter(name=>name===headers[column]).length>1)?t('csvFields.column',{n:column+1}):`${column+1}. ${headers[column]||t('charts.filter.blankHeader')}`
</script>
<fieldset {disabled} oninput={onchange} onchange={onchange} aria-describedby={none?errorId:undefined}>
 <legend>{legend??t('csvFields.columns.extract')}</legend>
 <label><input type="checkbox" aria-label={t('csvFields.columns.allLabel')} bind:checked={allColumns} onchange={event=>onallchange?.(event.currentTarget.checked)}/>{t('csvFields.columns.all',{n:formatNumber(columns.length)})}</label>
 {#if !allColumns}<div class="column-list">{#each columns as index}<label><input type="checkbox" aria-label={t('csvFields.columns.include',{n:index+1})} bind:checked={chosen[index]} aria-invalid={invalidColumns.includes(index)} aria-describedby={invalidColumns.includes(index)?errorId+'-'+index:undefined} onchange={()=>oncolumnchange?.(index)}/>{label(index)}{#if invalidColumns.includes(index)}<span id={errorId+'-'+index} class="field-error">{t('csvFields.reviewColumn',{n:index+1})}</span>{/if}</label>{/each}</div>
  {#if none}<span id={errorId} class="field-error">{t('csvFields.columns.required')}</span>{/if}
 {/if}
 {#each invalidColumns.filter(column=>!columns.includes(column)) as column}<span class="field-error">{t('csvFields.reviewColumn',{n:column+1})}</span>{/each}
 {#if allColumns}{#each invalidColumns.filter(column=>columns.includes(column)) as column}<span class="field-error">{t('csvFields.reviewColumn',{n:column+1})}</span>{/each}{/if}
</fieldset>
<style>
 fieldset{margin:8px 0;border:1px solid var(--border);padding:8px}label{display:inline-flex;align-items:center;gap:5px}.column-list{display:flex;flex-wrap:wrap;gap:4px 14px;max-height:120px;overflow:auto;margin-top:6px}input{font:inherit}.field-error{color:var(--danger)}
</style>
