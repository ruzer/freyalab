<script lang="ts">
 import {tick} from 'svelte'
 import {controlHint} from '../lib/control-hint'
 import {t} from '../lib/i18n.svelte'
 import Icon from './Icon.svelte'
 import {codeLanguages,type CodeLanguage,type MarkdownAction,type lineFormatState} from '../lib/markdown-commands'
 let {readonly=false,formatState,onformat,onsearch,onindex,indexVisible}:{readonly?:boolean;formatState:ReturnType<typeof lineFormatState>;onformat:(action:MarkdownAction,language?:CodeLanguage)=>void;onsearch:()=>void;onindex:()=>void;indexVisible:boolean}=$props()
 const actions=[
  {id:'task',icon:'square-check-big',hintKey:'taskHint'},{id:'table',icon:'table',hintKey:'tableHint'},
  {id:'mermaid',icon:'workflow',hintKey:'mermaidHint'},{id:'insert',icon:'chevron-down',hintKey:'insert'},
  {id:'search',icon:'search',hintKey:'search'},{id:'index',icon:'table-of-contents',hintKey:'index'}
 ] as const
 type Action=(typeof actions)[number]
 let insertMenu:HTMLDetailsElement|undefined=$state(),moreButton:HTMLButtonElement|undefined=$state(),popup:HTMLElement|undefined=$state()
 let language=$state<CodeLanguage>('text'),panel=$state<'more'|'insert'|null>(null)
 let width=$state(0),priorityWidth=$state(0),sizes=$state<number[]>([])
 const moreWidth=28,gap=2
 // Deja margen al redondear los anchos fraccionarios medidos por ResizeObserver.
 const fitAllowance=4
 let collapsed=$derived.by(()=>{
  let total=priorityWidth+actions.reduce((sum,_,i)=>sum+(sizes[i]??0)+gap+1,0)
  if(total<=width-fitAllowance&&sizes.length===actions.length)return 0
  total+=moreWidth+gap
  for(let i=0;i<actions.length;i++){
   total-=(sizes[i]??0)+gap+1
   if(total<=width-fitAllowance&&sizes.length===actions.length)return i+1
  }
  return actions.length
 })
 const label=(key:string)=>t('markdown.toolbar.'+key)
 const locked=(action:Action)=>readonly&&action.id!=='search'&&action.id!=='index'
 function apply(action:MarkdownAction){if(insertMenu)insertMenu.open=false;panel=null;onformat(action,language)}
 function dismiss(restore=false){panel=null;if(restore)moreButton?.focus()}
 async function openPanel(next:'more'|'insert',last=false){
  panel=next
  await tick()
  const items=popup?.querySelectorAll<HTMLButtonElement>('button')
  if(items?.length)items[last?items.length-1:0].focus()
  else popup?.focus()
 }
 function activate(action:Action,overflow=false){
  if(locked(action))return
  if(action.id==='insert'){void openPanel('insert');return}
  if(action.id==='search'){dismiss();onsearch();return}
  if(action.id==='index'){dismiss(overflow);onindex();return}
  apply(action.id)
 }
 function close(event:KeyboardEvent){
  if(event.key!=='Escape')return
  if(panel){event.preventDefault();dismiss(true)}
  else if(insertMenu?.open){event.preventDefault();insertMenu.open=false;insertMenu.querySelector('summary')?.focus()}
 }
 $effect(()=>{
  if(!collapsed&&panel)dismiss()
 })
 function menuKey(event:KeyboardEvent){
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return
  event.preventDefault()
  const items=Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button'))
  const current=items.indexOf(document.activeElement as HTMLButtonElement)
  items[event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus()
 }
</script>
<svelte:window onkeydown={close} onpointerdown={event=>{
 const target=event.target as Node
 if(insertMenu?.open&&!insertMenu.contains(target))insertMenu.open=false
 if(panel&&!moreButton?.contains(target)&&!popup?.contains(target))dismiss()
}}/>
{#snippet actionLabel(action:Action)}
 {#if action.id==='insert'}{label('insert')} <Icon name={action.icon} size={12}/>
 {:else}<Icon name={action.icon} size={14}/> {label(action.id)}{/if}
{/snippet}
{#snippet insertControls()}
 {#each ['list','ordered','taskList','quote','rule','link','date','datetime'] as item}
  <button {...controlHint(readonly?'readonly':null)} disabled={readonly} onclick={()=>apply((item==='taskList'?'task':item) as MarkdownAction)}>{label(item)}</button>
 {/each}
 <label>{label('language')}<select aria-label={label('language')} disabled={readonly} bind:value={language}>{#each codeLanguages as value}<option value={value}>{value}</option>{/each}</select></label>
 <button {...controlHint(readonly?'readonly':null,label('codeHint'))} disabled={readonly} onclick={()=>apply('code')}>{label('codeBlock')}</button>
{/snippet}

<div class="markdown-toolbar" role="group" aria-label={label('group')} bind:clientWidth={width}>
 <div class="priority" bind:offsetWidth={priorityWidth}>
 <select class="block-type" aria-label={label('block')} title={label('blockHint')} disabled={readonly} value={formatState.block} onchange={event=>apply(event.currentTarget.value as MarkdownAction)}>
  <option value="paragraph">{label('paragraph')}</option><option value="heading1">{label('heading1')}</option><option value="heading2">{label('heading2')}</option><option value="heading3">{label('heading3')}</option>
 </select>
 <button {...controlHint(readonly?'readonly':null,label('boldHint'))} disabled={readonly} aria-pressed={formatState.bold}  aria-label={label('bold')} onclick={()=>apply('bold')}><Icon name="bold"/></button>
 <button {...controlHint(readonly?'readonly':null,label('italicHint'))} disabled={readonly} aria-pressed={formatState.italic}  aria-label={label('italic')} onclick={()=>apply('italic')}><Icon name="italic"/></button>
 <button {...controlHint(readonly?'readonly':null,label('inline'))} disabled={readonly} aria-pressed={formatState.inline}  aria-label={label('inline')} onclick={()=>apply('inline')}><Icon name="code"/></button>
 <button {...controlHint(readonly?'readonly':null,label('strikeHint'))} disabled={readonly} aria-pressed={formatState.strike}  aria-label={label('strike')} onclick={()=>apply('strike')}><span class="strike" aria-hidden="true"></span></button>
 </div>
 <div class="measure" aria-hidden="true">
  {#each actions as action,i}
   <span class="action-size" bind:offsetWidth={sizes[i]}>{@render actionLabel(action)}</span>
  {/each}
 </div>
 {#each actions.slice(collapsed) as action (action.id)}
  {#if action.id==='insert'}
   <details bind:this={insertMenu} class="insert-menu">
    <summary class="action-size" aria-label={label('insert')} {...controlHint(locked(action)?'readonly':null)} aria-disabled={locked(action)} onclick={event=>{if(locked(action))event.preventDefault()}} onkeydown={event=>{if(locked(action)&&(event.key==='Enter'||event.key===' '))event.preventDefault()}}>{@render actionLabel(action)}</summary>
    <div class="dropdown insert-dropdown">{@render insertControls()}</div>
   </details>
  {:else}
   <button class="action-size" class:mermaid-insert={action.id==='mermaid'} {...controlHint(locked(action)?'readonly':null,t('markdown.toolbar.'+action.hintKey))} disabled={locked(action)} aria-pressed={action.id==='index'?indexVisible:undefined} onclick={()=>activate(action)}>{@render actionLabel(action)}</button>
  {/if}
 {/each}
 {#if collapsed}
  <div class="more-anchor">
   <button class="more-button" style:width={`${moreWidth}px`} bind:this={moreButton} aria-label={label('more')} title={label('more')} aria-haspopup="menu" aria-expanded={panel==='more'}
    onclick={()=>panel?dismiss():openPanel('more')} onkeydown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();void openPanel('more',event.key==='ArrowUp')}}}>⋯</button>
   {#if panel==='more'}
    <div class="dropdown overflow-menu" bind:this={popup} role="menu" aria-label={label('more')} tabindex="-1" onkeydown={menuKey} onfocusout={event=>{if(panel==='more'&&!event.currentTarget.contains(event.relatedTarget as Node)&&event.relatedTarget!==moreButton)dismiss()}}>
     {#each actions.slice(0,collapsed) as action (action.id)}
      <button role={action.id==='index'?'menuitemcheckbox':'menuitem'} aria-checked={action.id==='index'?indexVisible:undefined} aria-haspopup={action.id==='insert'?'dialog':undefined} aria-label={action.id==='insert'?label('insert'):undefined} aria-disabled={locked(action)} {...controlHint(locked(action)?'readonly':null,t('markdown.toolbar.'+action.hintKey))} tabindex="-1" onclick={()=>activate(action,true)}>
       {@render actionLabel(action)}{#if action.id==='index'&&indexVisible}<Icon name="circle-check" size={14}/>{/if}
      </button>
     {/each}
    </div>
   {:else if panel==='insert'}
    <div class="dropdown overflow-menu" bind:this={popup} role="dialog" aria-label={label('insert')} tabindex="-1" onfocusout={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)&&event.relatedTarget!==moreButton)dismiss()}}>
     {@render insertControls()}
    </div>
   {/if}
  </div>
 {/if}
</div>
<style>
 .markdown-toolbar{position:relative;flex:1;min-width:0;flex-wrap:nowrap;gap:2px;height:28px}
 .priority{display:flex;align-items:center;gap:1px;flex:none}
 .priority button{height:28px;padding:4px 5px}
 .block-type{width:89px;height:27px;font-size:11px;padding:3px 4px}
 .strike::before{content:"S"}
 .strike{font-size:16px;line-height:18px;width:18px;font-weight:600;text-decoration:line-through}
 button[aria-pressed=true]{background:var(--tint);color:var(--accent-strong);border-color:var(--accent-strong)}
 :global(:root.dark) button[aria-pressed=true]{background:var(--tint);color:var(--accent-strong);border-color:var(--accent-strong)}
 .measure{position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;display:flex}
 .action-size,.insert-menu summary{display:inline-flex;flex:none;align-items:center;gap:4px;height:28px;min-width:24px;padding:0 5px;border:1px solid transparent;white-space:nowrap;font-size:var(--font-ui);font-weight:500}
 summary[aria-disabled=true]{opacity:.45;cursor:default}
 .more-anchor{position:relative;flex:none}
 .more-button{height:28px;padding:0;font-size:18px}
 .overflow-menu,.insert-dropdown{left:auto;right:0;max-height:55vh;overflow:auto}
 .dropdown label{display:flex;flex-direction:column;gap:5px;padding:5px;font-size:11px}
 .dropdown button{justify-content:flex-start;text-align:left;white-space:normal}
 .dropdown button[aria-disabled=true]{opacity:.45;cursor:default}
 .dropdown button:focus-visible{outline-offset:-2px}
</style>
