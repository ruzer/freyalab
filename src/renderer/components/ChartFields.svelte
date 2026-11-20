<script lang="ts">
 import {controlHint} from '../lib/control-hint'
 import {tick,type Snippet} from 'svelte'
 import Icon from './Icon.svelte'
 import ContextMenu from './ContextMenu.svelte'
 import {t,getUILanguage} from '../lib/i18n.svelte'
 import {chartAggregates,type ChartOptions} from '../../shared/charts'
 import {fieldGroup,recommendedZone,zoneFields,type ChartZone} from '../../shared/chart-fields'
 import type {ChartColumn} from '../../shared/chart-suggest'
 import type {TableConditionGroup} from '../../shared/types'
 let {columns,options,where,disabled=false,loading=false,onadd,onremove,onaggregate,onswap,onclear,onfilter,onremovefilter,onannounce,onconvert,samples,settings}:{columns:ChartColumn[];options:ChartOptions;where:TableConditionGroup;disabled?:boolean;loading?:boolean;onadd:(zone:ChartZone,column:number)=>void;onremove:(zone:ChartZone)=>void;onaggregate:(aggregate:ChartOptions['aggregate'])=>void;onswap:()=>void;onclear:()=>void;onfilter:(column?:number)=>void;onremovefilter:(column:number)=>void;onannounce:(text:string)=>void;onconvert:(column:number)=>void;samples:Record<number,string[]>;settings?:Snippet}=$props()
 let search=$state(''),menu=$state<number|null>(null),focused=$state<number|null>(null),trigger:HTMLElement|undefined,list:HTMLDivElement,menuPosition=$state({x:8,y:8})
 const groups=['category','number','date','text'] as const
 const fieldIcons={category:'list',number:'hash',date:'history',text:'file-text'} as const
 const normalize=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase()
 const filtered=$derived(columns.filter(field=>normalize(field.name).includes(normalize(search))))
 const ordered=$derived(groups.flatMap(group=>filtered.filter(field=>fieldGroup(field)===group)))
 const current=$derived(ordered.some(field=>field.column===focused)?focused:ordered[0]?.column)
 const zones=$derived(zoneFields(options))
 const name=(column:number)=>columns.find(field=>field.column===column)?.name||t('charts.fields.emptyHeader',{n:column+1})
 const used=(column:number)=>Object.values(zones).includes(column)||where.conditions.some(rule=>rule.column===column)
 const amount=(column:number)=>samples[column]?.find(value=>/[$%€£]/u.test(value))
 const valuesNumeric=$derived(options.measureType==='number')
 const label=(zone:string)=>t('charts.fields.'+zone)
 const heatHint=$props.id()
 const menuId=heatHint+'-menu'
 function openMenu(column:number,origin:HTMLElement){
  focused=column
  if(disabled){onannounce(t('charts.fields.busy'));return}
  trigger=origin;const box=origin.getBoundingClientRect();menuPosition={x:box.left,y:box.bottom+4};menu=column
 }
 async function closeMenu(restore:boolean){menu=null;if(restore){await tick();if(trigger?.isConnected)trigger.focus()}}
 async function focusField(column:number){focused=column;await tick();list?.querySelector<HTMLElement>('[data-chart-field="'+column+'"]')?.focus()}
 function activate(column:number,origin:HTMLElement){
  focused=column;trigger=origin
  if(disabled){onannounce(t('charts.fields.busy'));return}
  if(used(column))openMenu(column,origin)
  else choose(recommendedZone(columns.find(field=>field.column===column)!,options),column)
 }
 function destinations(column:number){const recommended=recommendedZone(columns.find(field=>field.column===column)!,options);return[recommended,...(['rows','columns','values','filters'] as const).filter(zone=>zone!==recommended)]}
 function unavailable(zone:string){return disabled?'charts.fields.busy':zone==='values'&&options.kind==='heatmap'?'charts.fields.heatCount':zone==='filters'&&where.conditions.length>=20?'charts.fields.filterLimit':null}
 async function choose(zone:ChartZone|'filters',column:number){const reason=unavailable(zone);if(reason){onannounce(t(reason));return}await closeMenu(true);if(zone==='filters')onfilter(column);else onadd(zone,column)}
 const placements=(column:number)=>(['rows','columns','values'] as const).filter(zone=>zones[zone]===column)
 function remove(zone:ChartZone|'filters',column:number){if(disabled){onannounce(t('charts.fields.busy'));return}void closeMenu(true);if(zone==='filters')onremovefilter(column);else onremove(zone)}
 function rowKey(event:KeyboardEvent,column:number){
  if(event.target!==event.currentTarget)return
  const index=ordered.findIndex(field=>field.column===column)
  const next=event.key==='ArrowDown'?Math.min(index+1,ordered.length-1):event.key==='ArrowUp'?Math.max(index-1,0):event.key==='Home'?0:event.key==='End'?ordered.length-1:-1
  if(next>=0){event.preventDefault();event.stopPropagation();void focusField(ordered[next].column)}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();activate(column,event.currentTarget as HTMLElement)}
  else if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey){event.preventDefault();event.stopPropagation();openMenu(column,event.currentTarget as HTMLElement)}
 }
 function searchChanged(){onannounce(t('charts.fields.count',{n:filtered.length}))}
 $effect(()=>{getUILanguage();if(menu!==null&&!filtered.some(field=>field.column===menu))menu=null})
</script>
<aside class="chart-fields" aria-label={t('charts.fields.panel')}>
 <div class="field-header"><h3>{t('charts.fields.title')}</h3><div class="zone-actions"><button {...controlHint(disabled?'busy':null, (t('charts.fields.swap')))} disabled={disabled} onclick={onswap} aria-label={t('charts.fields.swap')} ><span aria-hidden="true">⇄</span> {t('charts.fields.swapShort')}</button><button {...controlHint(disabled?'busy':null)} disabled={disabled} onclick={onclear}>{t('charts.fields.clear')}</button></div></div>
 <input type="search" aria-label={t('charts.fields.search')} placeholder={t('charts.fields.search')} title={t('charts.fields.search')} bind:value={search} oninput={searchChanged}/>
 {#if loading}<p>{t('charts.fields.loading')}</p>{/if}
 <div bind:this={list} class="field-list" role="list" aria-label={t('charts.fields.title')} aria-busy={disabled}>
  {#each groups as group}
   {@const entries=filtered.filter(field=>fieldGroup(field)===group)}
   {#if entries.length}<h4>{t('charts.fields.'+group)}</h4>
    {#each entries as field(field.column)}
     <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events (La lista tiene un tabindex itinerante; Intro/Espacio activan y Mayús+F10 abre el mismo menú que el botón nativo.) -->
     <div class="field-entry" class:used={used(field.column)} role="listitem" data-chart-field={field.column} tabindex={current===field.column?0:-1} {...controlHint(disabled?'busy':null,name(field.column))} onfocus={()=>focused=field.column} onkeydown={event=>rowKey(event,field.column)} onclick={event=>{if(!(event.target instanceof Element&&event.target.closest('button')))activate(field.column,event.currentTarget)}} oncontextmenu={event=>{event.preventDefault();event.stopPropagation();openMenu(field.column,event.currentTarget)}}>
      <span class="field-badge" role="img" title={t('charts.fields.'+group)} aria-label={t('charts.fields.'+group)}><Icon name={fieldIcons[group]} size={14}/></span>
      <span class="field-copy"><span class="field-name" title={field.name}>{#if used(field.column)}<span aria-hidden="true">✓ </span>{/if}{field.name||name(field.column)}</span>{#if amount(field.column)}<span class="field-amount" title={t('charts.fields.amountBadge')}><Icon name="triangle-alert" size={12}/><span>{t('charts.fields.amountBadge')}</span></span>{/if}</span>
      <button type="button" class="field-more" tabindex="-1" {...controlHint(disabled?'busy':null,t('charts.fields.more',{field:name(field.column)}))} aria-disabled={disabled} aria-haspopup="menu" aria-expanded={menu===field.column} aria-label={t('charts.fields.more',{field:name(field.column)})} onclick={event=>{event.stopPropagation();openMenu(field.column,event.currentTarget)}}><span aria-hidden="true">⋯</span></button>
     </div>
    {/each}
   {/if}
  {/each}
 </div>
 <h3 class="organize">{t('charts.fields.organize')}</h3>
 <div class="zone-content">
 <p class="field-hint">{t('charts.fields.hint')}</p>
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
     {#if zone==='values'}<p>{t('charts.fields.oneValue')}</p>{#if !valuesNumeric&&column>=0}<button {...controlHint(disabled?'busy':null)} disabled={disabled} onclick={()=>onconvert(column)}>{t('charts.fields.conversion')}</button>{/if}{/if}
    {:else}<p>{t('charts.fields.empty')}</p>{/if}
   {/if}
  </section>
 {/each}
 </div>
 {#each columns.filter(field=>used(field.column)&&field.profile?.kind!=='number'&&!!amount(field.column)) as field}<div class="amount-notice"><p>{t('charts.fields.amount',{field:field.name,example:amount(field.column)!})}</p><button {...controlHint(disabled?'busy':null)} disabled={disabled} onclick={()=>onconvert(field.column)}>{t('charts.fields.conversion')}</button></div>{/each}
 {#if settings}{@render settings()}{/if}
 </div>
</aside>
{#if menu!==null}
 <ContextMenu x={menuPosition.x} y={menuPosition.y} label={t('charts.fields.more',{field:name(menu)})} onclose={restore=>void closeMenu(restore)}>
  <div class="field-menu-content">
   {#each destinations(menu) as zone,i}{@const reason=unavailable(zone)}<button type="button" class="field-menu-item" role="menuitem" tabindex="-1" aria-disabled={!!reason} title={reason?t(reason):undefined} aria-describedby={reason?menuId+'-'+zone:undefined} onclick={()=>choose(zone,menu!)}>{t(used(menu)?'charts.fields.moveDestination':'charts.fields.destination',{zone:label(zone)})}{#if !i}{' '}{t('charts.fields.recommended')}{/if}</button>{#if reason}<p class="menu-reason" id={menuId+'-'+zone}>{t(reason)}</p>{/if}{/each}
   {#each placements(menu) as zone}<button type="button" class="field-menu-item" role="menuitem" tabindex="-1" aria-disabled={disabled} {...controlHint(disabled?'busy':null)} onclick={()=>remove(zone,menu!)}>{t('charts.fields.remove',{field:name(menu),zone:label(zone)})}</button>{/each}
   {#if where.conditions.some(rule=>rule.column===menu)}<button type="button" class="field-menu-item" role="menuitem" tabindex="-1" aria-disabled={disabled} {...controlHint(disabled?'busy':null)} onclick={()=>remove('filters',menu!)}>{t('charts.fields.remove',{field:name(menu),zone:label('filters')})}</button>{/if}
  </div>
 </ContextMenu>
{/if}
<style>
 .chart-fields{grid-area:fields;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;border-left:1px solid var(--border);background:var(--bg);padding:8px;color:var(--text);font-size:11px}h3{font-size:12px;margin:0 0 8px}h4{font-size:11px;margin:7px 0 3px;color:var(--text)}.organize{flex-shrink:0;margin:4px 0}.field-header{display:flex;align-items:center;justify-content:space-between;gap:4px;flex-shrink:0;margin-bottom:4px}.field-header h3{margin:0}.field-header .zone-actions{margin:0;flex-wrap:nowrap;gap:4px}.zone-content{flex:1;min-height:0;overflow:auto}button,input,select{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:var(--radius-control);min-height:28px;padding:4px 6px}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}input{width:100%;box-sizing:border-box}.field-list{flex:0 0 244px;overflow:auto;margin-top:5px}.field-list h4{line-height:14px;margin:5px 0 2px}.field-entry{display:flex;align-items:center;gap:4px;min-height:28px;padding:0}.field-entry+.field-entry{margin-top:4px}.field-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.field-entry button{flex:0 0 auto;font-size:var(--font-meta);padding:3px 5px}.field-badge{font-size:var(--font-meta);padding:2px 4px;border:1px solid var(--border);border-radius:8px;flex:none;white-space:nowrap}.zones{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}.zone{border:1px dashed var(--border);background:var(--panel);border-radius:6px;min-height:40px;padding:4px;min-width:0}.zone.wide{grid-column:1/-1}.zone h4{line-height:14px;margin:0 0 3px}.zone p{font-size:var(--font-meta);line-height:1.4;margin:2px 0}.chip{display:flex;align-items:center;flex-wrap:wrap;gap:3px;padding:2px;margin:0;border:1px solid var(--border);border-radius:var(--radius-control);background:var(--hover);min-width:0}.chip-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chip button{min-width:24px;padding:1px 4px;border:0}.chip select{max-width:100%;min-width:0}.zone-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}.zone-actions button{font-size:var(--font-meta)}.amount-notice{border:1px solid var(--warning);padding:7px;border-radius:6px;margin-top:8px}.amount-notice p{margin:0 0 5px;line-height:1.4}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
 @media(max-height:650px){.field-list{flex-basis:180px}}
 @media(max-width:899px){.chart-fields{display:block;overflow:auto;border-left:0;max-height:50vh;border-bottom:1px solid var(--border)}.field-list{height:180px;max-height:180px}.field-header{position:sticky;top:0;background:var(--bg);z-index:1}}
 button,input,select{appearance:none;border-color:var(--muted)}
 .chart-fields :global(button),.chart-fields :global(select),.chart-fields :global(input){appearance:none}
 .field-entry{cursor:pointer}.field-entry:hover{background:var(--hover)}.field-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.field-name{flex:none}.field-badge{border:0;border-radius:0;padding:0;color:var(--muted)}.field-amount{display:flex;align-items:center;gap:3px;color:var(--warning);font-size:10px;line-height:1.3}.field-more{visibility:hidden;min-width:24px;height:24px;padding:0;border-color:transparent;background:transparent}.field-entry:hover .field-more,.field-entry:focus-within .field-more,.field-entry.used .field-more{visibility:visible}.field-hint{margin:0 0 6px;font-size:11px;color:var(--muted)}.field-menu-content{min-width:220px;max-width:280px}.field-menu-item{display:block;width:100%;text-align:left;border:0;background:transparent;padding:8px;min-height:28px}.field-menu-item:focus-visible,.field-menu-item:hover{background:var(--hover)}.menu-reason{font-size:11px;line-height:1.3;margin:0;padding:0 8px 6px;color:var(--muted)}
</style>
