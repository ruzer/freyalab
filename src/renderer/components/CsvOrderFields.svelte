<script lang="ts">
 import {controlHint} from '../lib/control-hint'
 import {t} from '../lib/i18n.svelte'
 import type {TableSort} from '../../shared/types'
 import Icon from './Icon.svelte'
 let {headers,available,disabled=false,disambiguate=false,invalidColumns=[],oncolumnchange,order=$bindable([]),onchange=()=>{}}:{headers:string[];available?:number[];disabled?:boolean;disambiguate?:boolean;invalidColumns?:number[];oncolumnchange?:(column:number)=>void;order:TableSort[];onchange?:()=>void}=$props()
 const errorId=$props.id()
 const columns=$derived(available??headers.map((_,index)=>index))
 const label=(column:number)=>disambiguate&&(!headers[column]||headers.filter(name=>name===headers[column]).length>1)?t('csvFields.column',{n:column+1}):`${column+1}. ${headers[column]||t('charts.filter.blankHeader')}`
</script>
<div class="order-fields" oninput={onchange} onchange={onchange}>
 {#each order as item,index}<div class="rule">
  <span>{index+1}.</span><select aria-label={t('csvFields.order.column',{n:index+1})} aria-invalid={!columns.includes(item.column)||invalidColumns.includes(item.column)} aria-describedby={!columns.includes(item.column)||invalidColumns.includes(item.column)?errorId+'-'+index:undefined} bind:value={item.column} {disabled} onchange={event=>oncolumnchange?.(Number(event.currentTarget.value))}>
   {#if !columns.includes(item.column)}<option value={item.column}>{t('csvFields.columnUnavailable',{n:item.column+1})}</option>{/if}
   {#each columns as column}<option value={column}>{label(column)}</option>{/each}
  </select>
  <select aria-label={t('csvFields.order.direction',{n:index+1})} bind:value={item.descending} {disabled}><option value={false}>{t('csvFields.order.ascending')}</option><option value={true}>{t('csvFields.order.descending')}</option></select>
  <label><input type="checkbox" aria-label={t('csvFields.order.numeric',{n:index+1})} bind:checked={item.numeric} {disabled}/>{t('csvFields.order.exact')}</label>
  <button {...controlHint(null,t('csvFields.order.remove',{n:index+1}))} type="button" aria-label={t('csvFields.order.remove',{n:index+1})} {disabled} onclick={()=>{order=order.filter((_,i)=>i!==index);onchange()}}><Icon name="x" size={14}/></button>
  {#if !columns.includes(item.column)||invalidColumns.includes(item.column)}<span id={errorId+'-'+index} class="field-error">{t(!columns.includes(item.column)?'csvFields.columnUnavailable':'csvFields.reviewColumn',{n:item.column+1})}</span>{/if}
 </div>{/each}
 <button {...controlHint(!disabled&&!columns.length?'columns':!disabled&&order.length>=20?'sortLimit':null)} type="button" disabled={disabled||order.length>=20||!columns.length} onclick={()=>{order=[...order,{column:columns[0],descending:false,numeric:false}];onchange()}}>{t('csvFields.order.add')}</button>
</div>
<style>
 .rule{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}label{display:inline-flex;align-items:center;gap:5px}.rule select{max-width:190px}button,select,input{font:inherit}button{appearance:none;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:var(--radius-control);padding:5px 8px}.field-error{color:var(--danger)}[aria-invalid=true]{border-color:var(--danger)}
</style>
