<script lang="ts">
 import {controlHint} from '../lib/control-hint'
 import {tick} from 'svelte'
 import {t,getUILanguage} from '../lib/i18n.svelte'
 import {chartAggregates,chartTimeGroups,type ChartOptions} from '../../shared/charts'
 import {fieldGroup,recommendedZone,zoneFields,type ChartZone} from '../../shared/chart-fields'
 import type {ChartColumn} from '../../shared/chart-suggest'
 import type {TableConditionGroup} from '../../shared/types'
 let {columns,options,where,disabled=false,loading=false,onadd,onremove,onaggregate,ontime,onswap,onclear,onfilter,onremovefilter,onannounce,onconvert,samples}:{columns:ChartColumn[];options:ChartOptions;where:TableConditionGroup;disabled?:boolean;loading?:boolean;onadd:(zone:ChartZone,column:number)=>void;onremove:(zone:ChartZone)=>void;onaggregate:(aggregate:ChartOptions['aggregate'])=>void;ontime:(time:ChartOptions['time'])=>void;onswap:()=>void;onclear:()=>void;onfilter:(column?:number)=>void;onremovefilter:(column:number)=>void;onannounce:(text:string)=>void;onconvert:(column:number)=>void;samples:Record<number,string[]>}=$props()
 let search=$state(''),menu=$state<number|null>(null),trigger:HTMLButtonElement|undefined,menuElement=$state<HTMLDivElement>(),menuPosition=$state({top:0,left:0})
 const normalize=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase()
 const filtered=$derived(columns.filter(field=>normalize(field.name).includes(normalize(search))))
 const zones=$derived(zoneFields(options))
 const name=(column:number)=>columns.find(field=>field.column===column)?.name||t('charts.fields.emptyHeader',{n:column+1})
 const used=(column:number)=>Object.values(zones).includes(column)||where.conditions.some(rule=>rule.column===column)
 const amount=(column:number)=>samples[column]?.find(value=>/[$%€£]/u.test(value))
 const valuesNumeric=$derived(options.measureType==='number')
 const label=(zone:string)=>t('charts.fields.'+zone)
 const heatHint=$props.id()
 async function openMenu(column:number,button:HTMLButtonElement){
  trigger=button;menu=column;const box=button.getBoundingClientRect();menuPosition={left:Math.max(8,Math.min(box.right-245,window.innerWidth-253)),top:Math.min(box.bottom+4,window.innerHeight-185)}
  await tick();menuElement?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
 }
 function closeMenu(){menu=null;trigger?.focus()}
 function menuKey(event:KeyboardEvent){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenu();return}
  if(event.key==='Tab'){closeMenu();return}
  const buttons=[...menuElement!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],index=buttons.indexOf(document.activeElement as HTMLButtonElement)
  let next=event.key==='ArrowDown'?(index+1)%buttons.length:event.key==='ArrowUp'?(index-1+buttons.length)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:-1
  if(next>=0){event.preventDefault();buttons[next]?.focus()}
 }
 function destinations(column:number){const recommended=recommendedZone(columns.find(field=>field.column===column)!,options);return[recommended,...(['rows','columns','values','filters'] as const).filter(zone=>zone!==recommended)]}
 function unavailable(zone:string){return disabled?'charts.fields.busy':zone==='values'&&options.kind==='heatmap'?'charts.fields.heatCount':zone==='filters'&&where.conditions.length>=20?'charts.fields.filterLimit':null}
 function choose(zone:ChartZone|'filters',column:number){const reason=unavailable(zone);if(reason){onannounce(t(reason));return}closeMenu();if(zone==='filters')onfilter(column);else onadd(zone,column)}
 function rowKey(event:KeyboardEvent,column:number){if(disabled)return;if(event.key==='Enter'&&event.target===event.currentTarget){event.preventDefault();void openMenu(column,(event.currentTarget as HTMLElement).querySelector('button')!)}}
 function searchChanged(){onannounce(t('charts.fields.count',{n:filtered.length}))}
 $effect(()=>{getUILanguage();if(menu!==null&&!filtered.some(field=>field.column===menu))menu=null})
</script>
<svelte:window onpointerdown={event=>{if(menu!==null&&event.target instanceof Element&&!event.target.closest('.field-entry,.field-menu'))menu=null}}/>
<aside class="chart-fields" aria-label={t('charts.fields.panel')}>
 <div class="field-header"><h3>{t('charts.fields.title')}</h3><div class="zone-actions"><button {...controlHint(disabled?'busy':null, (t('charts.fields.swap')))} disabled={disabled} onclick={onswap} aria-label={t('charts.fields.swap')} ><span aria-hidden="true">⇄</span> {t('charts.fields.swapShort')}</button><button {...controlHint(disabled?'busy':null)} disabled={disabled} onclick={onclear}>{t('charts.fields.clear')}</button></div></div>
 <input type="search" aria-label={t('charts.fields.search')} placeholder={t('charts.fields.search')} title={t('charts.fields.search')} bind:value={search} oninput={searchChanged}/>
 {#if loading}<p>{t('charts.fields.loading')}</p>{/if}
 <div class="field-list" role="list" aria-label={t('charts.fields.title')}>
  {#each ['category','number','date','text'] as group}
   {@const entries=filtered.filter(field=>fieldGroup(field)===group)}
   {#if entries.length}<h4>{t('charts.fields.'+group)}</h4>
    {#each entries as field(field.column)}
     <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (Enter abre el menú de esta fila; todos los destinos también tienen botón nativo.) -->
     <div class="field-entry" role="listitem" tabindex="0" title={field.name} onkeydown={event=>rowKey(event,field.column)} ondblclick={event=>{if(!(event.target instanceof Element&&event.target.closest('button'))&&!disabled){trigger=(event.currentTarget as HTMLElement).querySelector('button')!;choose(recommendedZone(field,options),field.column)}}}>
      <span class="field-name" title={field.name}>{#if used(field.column)}<span aria-hidden="true">✓ </span>{/if}{field.name||name(field.column)}</span>
      <span class="field-badge" class:amount={!!amount(field.column)} title={amount(field.column)?t('charts.fields.amountBadge'):t('charts.fields.'+group)}>{t('charts.fields.'+(group==='text'?'textBadge':group))}</span>
      <button {...controlHint(disabled?'busy':null)} disabled={disabled} aria-haspopup="menu" aria-expanded={menu===field.column} aria-label={t('charts.fields.action',{action:t(used(field.column)?'charts.fields.move':'charts.fields.add'),field:field.name})} onclick={event=>void openMenu(field.column,event.currentTarget)}>{t(used(field.column)?'charts.fields.move':'charts.fields.add')}</button>
     </div>
    {/each}
   {/if}
  {/each}
 </div>
 <h3 class="organize">{t('charts.fields.organize')}</h3>
 <div class="zone-content">
 <div class="zones">
 {#each ['rows','columns','values','filters'] as zone}
  <section class="zone" class:wide={zone==='values'||zone==='filters'} aria-label={label(zone)}>
   <h4>{label(zone)}</h4>
   {#if zone==='filters'}
    {#each [...new Set(where.conditions.map(rule=>rule.column))] as column}<span class="chip"><button class="chip-name" title={name(column)} onclick={()=>onfilter()}>{name(column)}</button><button {...controlHint(disabled?'busy':null)} disabled={disabled} aria-label={t('charts.fields.remove',{field:name(column),zone:label(zone)})} onclick={()=>onremovefilter(column)}>×</button></span>{/each}
    {#if !where.conditions.length}<p>{t('charts.fields.empty')}</p>{/if}
   {:else if zone==='values'&&options.kind==='heatmap'}
    <span class="chip"><select aria-label={t('charts.fields.aggregate',{field:t('charts.fields.rowCount')})} aria-describedby={heatHint} value="count" title={t('charts.fields.heatCount')} disabled={disabled}>{#each Object.keys(chartAggregates) as operation}<option value={operation} disabled={operation!=='count'} title={operation!=='count'?t('charts.fields.heatCount'):undefined}>{t('charts.aggregate.'+operation)}</option>{/each}</select></span><p id={heatHint}>{t('charts.fields.heatCount')}</p>
   {:else}
    {@const column=zones[zone as ChartZone]}
    {#if column>=0||zone==='values'&&column===-1&&options.x>=0}
     {@const field=column<0?t('charts.fields.rowCount'):name(column)}
     <span class="chip"><span class="chip-name" title={field}>{field}</span>
      {#if zone==='values'}<select aria-label={t('charts.fields.aggregate',{field})} title={t('charts.fields.aggregate',{field})} value={options.aggregate} disabled={disabled} onchange={event=>onaggregate(event.currentTarget.value as ChartOptions['aggregate'])}>{#each Object.keys(chartAggregates) as operation}<option value={operation} disabled={!valuesNumeric&&!['count','distinct'].includes(operation)} title={!valuesNumeric&&!['count','distinct'].includes(operation)?t('charts.fields.textOnly'):undefined}>{t('charts.aggregate.'+operation)}</option>{/each}</select>{/if}
      <button {...controlHint(disabled?'busy':null)} disabled={disabled} aria-label={t('charts.fields.remove',{field,zone:label(zone)})} onclick={()=>onremove(zone as ChartZone)}>×</button>
     </span>
     {#if zone==='rows'&&columns.find(field=>field.column===column)?.profile?.kind==='date'}<label>{t('charts.fields.groupDate',{field})}<select aria-label={t('charts.fields.groupDate',{field})} value={options.time} disabled={disabled||!['bar','line'].includes(options.kind)} title={!['bar','line'].includes(options.kind)?t('charts.fields.dateUnavailable'):undefined} onchange={event=>ontime(event.currentTarget.value as ChartOptions['time'])}>{#each Object.keys(chartTimeGroups).filter(unit=>unit!=='none') as unit}<option value={unit}>{t('charts.time.'+unit)}</option>{/each}</select></label>{/if}
     {#if zone==='values'}<p>{t('charts.fields.oneValue')}</p>{#if !valuesNumeric&&column>=0}<button {...controlHint(disabled?'busy':null)} disabled={disabled} onclick={()=>onconvert(column)}>{t('charts.fields.conversion')}</button>{/if}{/if}
    {:else}<p>{t('charts.fields.empty')}</p>{/if}
   {/if}
  </section>
 {/each}
 </div>
 {#each columns.filter(field=>used(field.column)&&field.profile?.kind!=='number'&&!!amount(field.column)) as field}<div class="amount-notice"><p>{t('charts.fields.amount',{field:field.name,example:amount(field.column)!})}</p><button {...controlHint(disabled?'busy':null)} disabled={disabled} onclick={()=>onconvert(field.column)}>{t('charts.fields.conversion')}</button></div>{/each}
 </div>
</aside>
{#if menu!==null}
 <div class="field-menu" role="menu" tabindex="-1" aria-label={t('charts.fields.add')} bind:this={menuElement} style:top={`${menuPosition.top}px`} style:left={`${menuPosition.left}px`} onkeydown={menuKey}>
  {#each destinations(menu) as zone,i}<button {...controlHint(disabled?'busy':unavailable(zone)==='charts.fields.heatCount'?'heatCount':unavailable(zone)?'filterLimit':null, (unavailable(zone)?t(unavailable(zone)!):undefined))} role="menuitem" tabindex="-1" disabled={!!unavailable(zone)}  onclick={()=>choose(zone,menu!)}>{t('charts.fields.destination',{zone:label(zone)})}{#if !i}{' '}{t('charts.fields.recommended')}{/if}</button>{/each}
 </div>
{/if}
<style>
 .chart-fields{grid-area:fields;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;border-left:1px solid var(--border);background:var(--bg);padding:8px;color:var(--text);font-size:11px}h3{font-size:12px;margin:0 0 8px}h4{font-size:11px;margin:7px 0 3px;color:var(--text)}.organize{flex-shrink:0;margin:4px 0}.field-header{display:flex;align-items:center;justify-content:space-between;gap:4px;flex-shrink:0;margin-bottom:4px}.field-header h3{margin:0}.field-header .zone-actions{margin:0;flex-wrap:nowrap;gap:4px}.zone-content{flex:1;min-height:0;overflow:auto}button,input,select{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:var(--radius-control);min-height:28px;padding:4px 6px}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}input{width:100%;box-sizing:border-box}.field-list{flex:0 0 240px;overflow:auto;margin-top:5px}.field-list h4{line-height:14px;margin:5px 0 2px}.field-entry{display:flex;align-items:center;gap:4px;min-height:28px;padding:0}.field-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.field-entry button{flex:0 0 auto;font-size:var(--font-meta);padding:3px 5px}.field-badge{font-size:var(--font-meta);padding:2px 4px;border:1px solid var(--border);border-radius:8px;max-width:54px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.amount{border-color:var(--warning);color:var(--text)}.zones{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}.zone{border:1px dashed var(--border);background:var(--panel);border-radius:6px;min-height:40px;padding:4px;min-width:0}.zone.wide{grid-column:1/-1}.zone h4{line-height:14px;margin:0 0 3px}.zone p{font-size:var(--font-meta);line-height:1.4;margin:2px 0}.chip{display:flex;align-items:center;flex-wrap:wrap;gap:3px;padding:2px;margin:0;border:1px solid var(--border);border-radius:var(--radius-control);background:var(--hover);min-width:0}.chip-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chip button{min-width:24px;padding:1px 4px;border:0}.chip select{max-width:100%;min-width:0}.zone label{display:flex;flex-wrap:wrap;gap:4px;font-size:var(--font-meta)}.zone-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}.zone-actions button{font-size:var(--font-meta)}.amount-notice{border:1px solid var(--warning);padding:7px;border-radius:6px;margin-top:8px}.amount-notice p{margin:0 0 5px;line-height:1.4}.field-menu{position:fixed;z-index:50;width:245px;padding:5px;background:var(--panel);color:var(--text);border:1px solid var(--border);border-radius:6px;box-shadow:var(--shadow-float)}.field-menu button{display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:8px;min-height:28px;border-radius:4px}.field-menu button:focus,.field-menu button:hover{background:var(--hover)}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
 @media(max-height:650px){.field-list{flex-basis:180px}}
 @media(max-width:899px){.chart-fields{display:block;overflow:auto;border-left:0;max-height:50vh;border-bottom:1px solid var(--border)}.field-list{height:180px;max-height:180px}.field-header{position:sticky;top:0;background:var(--bg);z-index:1}}
 button,input,select{appearance:none;border-color:var(--muted)}
 .field-badge:not(.amount){border-color:var(--muted)}
</style>
