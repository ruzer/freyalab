<script lang="ts">
 import {t} from '../lib/i18n.svelte'
 import {onMount} from 'svelte'
 import {matchingChartHeaders,ambiguousChartHeaders,type ChartConfiguration,type ChartPreset} from '../../shared/chart-presets'
 let {docId,headers,readonly,configuration,disabled,canSave,onapply}:{docId:string;headers:string[];readonly:boolean;configuration:ChartConfiguration;disabled:boolean;canSave:boolean;onapply:(configuration:ChartConfiguration)=>void}=$props()
 let presets=$state<ChartPreset[]>([]),selected=$state(''),name=$state(''),busy=$state(false),message=$state(''),acknowledged=$state(false)
 const chosen=$derived(presets.find(item=>item.id===selected))
 const matches=$derived(chosen&&matchingChartHeaders(chosen.configuration.headers,headers))
 const ambiguous=$derived(ambiguousChartHeaders(headers))
 const blocked=$derived(!chosen||!matches||(ambiguous&&!acknowledged)||(readonly&&!!chosen.configuration.view))
 async function refresh(){busy=true;try{presets=await window.freya.chartPresets();message=t('charts.presets.library')}catch(error){message=String(error)}finally{busy=false}}
 onMount(()=>{void refresh()})
 async function save(){busy=true;try{const saved=await window.freya.saveChartPreset(docId,{name,configuration:$state.snapshot(configuration)});presets=await window.freya.chartPresets();selected=saved.id;acknowledged=false;name='';message=t('charts.presets.savedMessage')}catch(error){message=String(error)}finally{busy=false}}
 async function remove(){if(!chosen)return;busy=true;try{await window.freya.deleteChartPreset(chosen.id);presets=await window.freya.chartPresets();selected='';acknowledged=false;message=t('charts.presets.removedMessage')}catch(error){message=String(error)}finally{busy=false}}
 function apply(){if(!chosen||blocked)return;onapply(structuredClone($state.snapshot(chosen.configuration)));message=t('charts.presets.appliedMessage')}
</script>
<details class="presets">
 <summary>{t('charts.presets.savedTitle')}</summary>
 <p>{t('charts.presets.help')}</p>
 <div class="controls">
  <label>{t('charts.presets.name')} <input aria-label={t('charts.presets.nameLabel')} maxlength="80" bind:value={name} disabled={disabled||busy}/></label>
  <button type="button" disabled={disabled||busy||!canSave||!name.trim()} onclick={()=>void save()}>{t('charts.presets.save')}</button>
 </div>
 <div class="controls">
  <label>{t('charts.presets.restore')} <select aria-label={t('charts.presets.choice')} bind:value={selected} onchange={()=>{acknowledged=false;message=''}} disabled={busy||disabled}><option value="">{t('charts.presets.choose')}</option>{#each presets as item}<option value={item.id}>{item.name}</option>{/each}</select></label>
  <button type="button" disabled={disabled||busy||blocked} onclick={apply}>{t('charts.presets.apply')}</button>
  <button type="button" disabled={disabled||busy||!chosen} onclick={()=>void remove()}>{t('charts.presets.remove')}</button>
  <button type="button" disabled={busy||disabled} onclick={()=>void refresh()}>{t('charts.presets.refresh')}</button>
 </div>
 {#if chosen&&!matches}<p role="alert">{t('charts.presets.changedHeaders')}</p>{/if}
 {#if chosen&&matches&&ambiguous}<label><input type="checkbox" bind:checked={acknowledged}/>{t('charts.presets.confirm')}</label>{/if}
 {#if readonly&&chosen?.configuration.view}<p role="alert">{t('charts.presets.sample')}</p>{/if}
 <p aria-live="polite" aria-label={t('charts.presets.status')}>{message}</p>
</details>
<style>
 .presets{border:1px solid var(--border);border-radius:6px;padding:0 8px;margin:8px 0}summary{cursor:pointer;padding:8px 0}.controls{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0}label{display:flex;align-items:center;gap:6px}p{color:var(--muted);line-height:1.5}input,select,button{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:5px;padding:5px 8px}select{max-width:240px}button:disabled{opacity:.5}button:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
