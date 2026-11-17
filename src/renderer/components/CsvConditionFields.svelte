<script lang="ts">
 import {controlHint} from '../lib/control-hint'
 import {t} from '../lib/i18n.svelte'
 import {filterOperators} from '../../shared/table-conditions'
 import type {TableFilter} from '../../shared/types'
 import Icon from './Icon.svelte'
 let {headers,available,disabled=false,disambiguate=false,invalidColumns=[],oncolumnchange,conditions=$bindable([]),mode=$bindable('all'),onchange=()=>{}}:{headers:string[];available?:number[];disabled?:boolean;disambiguate?:boolean;invalidColumns?:number[];oncolumnchange?:(column:number)=>void;conditions:TableFilter[];mode:'all'|'any';onchange?:()=>void}=$props()
 const errorId=$props.id()
 const columns=$derived(available??headers.map((_,index)=>index))
 const label=(column:number)=>disambiguate&&(!headers[column]||headers.filter(name=>name===headers[column]).length>1)?t('csvFields.column',{n:column+1}):`${column+1}. ${headers[column]||t('charts.filter.blankHeader')}`
</script>
<div class="condition-fields" oninput={onchange} onchange={onchange}>
 <label>{t('charts.filter.match')} <select aria-label={t('charts.filter.combine')} bind:value={mode} {disabled}><option value="all">{t('charts.filter.all')}</option><option value="any">{t('charts.filter.any')}</option></select></label>
 {#each conditions as rule,index}<div class="rule">
  <select aria-label={t('charts.filter.column',{n:index+1})} aria-invalid={!columns.includes(rule.column)||invalidColumns.includes(rule.column)} aria-describedby={!columns.includes(rule.column)||invalidColumns.includes(rule.column)?errorId+'-'+index:undefined} bind:value={rule.column} {disabled} onchange={event=>oncolumnchange?.(Number(event.currentTarget.value))}>
   {#if !columns.includes(rule.column)}<option value={rule.column}>{t('csvFields.columnUnavailable',{n:rule.column+1})}</option>{/if}
   {#each columns as column}<option value={column}>{label(column)}</option>{/each}
  </select>
  <select aria-label={t('charts.filter.operator',{n:index+1})} bind:value={rule.op} {disabled}>{#each filterOperators as [value]}<option {value}>{t('charts.filter.op.'+value)}</option>{/each}</select>
  {#if !['empty','notEmpty'].includes(rule.op)}<input aria-label={t('charts.filter.input',{n:index+1})} bind:value={rule.value} required placeholder={t(rule.op.startsWith('date')?'charts.filter.date':'charts.filter.value')} type={rule.op.startsWith('date')?'date':'text'} {disabled}/>{/if}
  {#if ['contains','equals','notEquals','starts','ends','regex'].includes(rule.op)}<label><input type="checkbox" bind:checked={rule.caseSensitive} {disabled}/>{t('charts.filter.case')}</label>{/if}
  <button {...controlHint(null,t('charts.filter.remove',{n:index+1}))} type="button" aria-label={t('charts.filter.remove',{n:index+1})} {disabled} onclick={()=>{conditions=conditions.filter((_,i)=>i!==index);onchange()}}><Icon name="x" size={14}/></button>
  {#if !columns.includes(rule.column)||invalidColumns.includes(rule.column)}<span id={errorId+'-'+index} class="field-error">{t(!columns.includes(rule.column)?'csvFields.columnUnavailable':'csvFields.reviewColumn',{n:rule.column+1})}</span>{/if}
 </div>{/each}
 <button {...controlHint(!disabled&&!columns.length?'columns':!disabled&&conditions.length>=20?'filterLimit':null)} type="button" disabled={disabled||conditions.length>=20||!columns.length} onclick={()=>{conditions=[...conditions,{column:columns[0],op:'contains',value:''}];onchange()}}>{t('charts.filter.add')}</button>
</div>
<style>
 .rule{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}label{display:inline-flex;align-items:center;gap:5px}.rule select{max-width:190px}.rule input[type=text],.rule input[type=date]{width:170px}button,select,input{font:inherit}button{appearance:none;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:var(--radius-control);padding:5px 8px}.field-error{color:var(--danger)}[aria-invalid=true]{border-color:var(--danger)}
</style>
