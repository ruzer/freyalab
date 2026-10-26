<script lang="ts">
 import Icon from './Icon.svelte'
 import {codeLanguages,type CodeLanguage,type MarkdownAction,type lineFormatState} from '../lib/markdown-commands'
 let {readonly=false,formatState,onformat}:{readonly?:boolean;formatState:ReturnType<typeof lineFormatState>;onformat:(action:MarkdownAction,language?:CodeLanguage)=>void}=$props()
 let menu:HTMLDetailsElement,language=$state<CodeLanguage>('text')
 function apply(action:MarkdownAction){menu?.removeAttribute('open');onformat(action,language)}
 function close(event:KeyboardEvent){if(event.key==='Escape'&&menu?.open){event.preventDefault();menu.open=false;menu.querySelector('summary')?.focus()}}
</script>
<svelte:window onkeydown={close} onpointerdown={event=>{if(menu?.open&&!menu.contains(event.target as Node))menu.open=false}}/>
<div class="markdown-toolbar" role="group" aria-label="Formato Markdown">
 <select class="block-type" aria-label="Tipo de bloque" title="Párrafo o título · Ctrl/⌘ + Alt + 0…3" disabled={readonly} value={formatState.block} onchange={event=>apply(event.currentTarget.value as MarkdownAction)}>
  <option value="paragraph">Párrafo</option><option value="heading1">Título 1</option><option value="heading2">Título 2</option><option value="heading3">Título 3</option>
 </select>
 <button disabled={readonly} aria-pressed={formatState.bold} title="Negrita · Ctrl/⌘ + B" aria-label="Negrita" onclick={()=>apply('bold')}><Icon name="bold"/></button>
 <button disabled={readonly} aria-pressed={formatState.italic} title="Cursiva · Ctrl/⌘ + I" aria-label="Cursiva" onclick={()=>apply('italic')}><Icon name="italic"/></button>
 <button disabled={readonly} aria-pressed={formatState.inline} title="Código en línea" aria-label="Código en línea" onclick={()=>apply('inline')}><Icon name="code"/></button>
 <button disabled={readonly} aria-pressed={formatState.strike} title="Tachado · Ctrl/⌘ + Mayús + X" aria-label="Tachado" onclick={()=>apply('strike')}><span class="strike" aria-hidden="true">S</span></button>
 <span class="separator"></span>
 <button disabled={readonly} title="Alternar lista de tareas" onclick={()=>apply('task')}><Icon name="square-check-big"/> Tarea</button>
 <button disabled={readonly} title="Insertar tabla Markdown" onclick={()=>apply('table')}><Icon name="table"/> Tabla</button>
 <button disabled={readonly} class="mermaid-insert" title="Insertar diagrama de ejemplo" onclick={()=>apply('mermaid')}><Icon name="workflow"/> Mermaid</button>
 <details bind:this={menu} class="insert-menu">
  <summary aria-label="Más opciones de Markdown" aria-disabled={readonly} onclick={event=>{if(readonly)event.preventDefault()}} onkeydown={event=>{if(readonly&&(event.key==='Enter'||event.key===' '))event.preventDefault()}}>Insertar <Icon name="chevron-down" size={12}/></summary>
  <div class="dropdown">
   {#each [{action:'list',label:'Lista con viñetas'},{action:'ordered',label:'Lista numerada'},{action:'task',label:'Lista de tareas'},{action:'quote',label:'Cita'},{action:'rule',label:'Separador'},{action:'link',label:'Enlace'}] as item}
    <button disabled={readonly} onclick={()=>apply(item.action as MarkdownAction)}>{item.label}</button>
   {/each}
   <label>Lenguaje del bloque de código<select aria-label="Lenguaje del bloque de código" disabled={readonly} bind:value={language}>{#each codeLanguages as value}<option value={value}>{value}</option>{/each}</select></label>
   <button disabled={readonly} title="Insertar un bloque con el lenguaje elegido" onclick={()=>apply('code')}>Bloque de código</button>
  </div>
 </details>
</div>
<style>
 .markdown-toolbar{flex-wrap:nowrap;flex-shrink:0;gap:1px;height:28px}
 .markdown-toolbar>button{display:inline-flex;align-items:center;gap:4px;height:28px;padding:4px 5px}
 .block-type{width:89px;height:27px;font-size:11px;padding:3px 4px}
 .strike{font-size:16px;line-height:18px;width:18px;font-weight:600;text-decoration:line-through}
 button[aria-pressed=true]{background:#dbeafe;color:#174a91;border-color:#174a91}
 :global(:root.dark) button[aria-pressed=true]{background:#233e63;color:#dbeafe;border-color:#93c5fd}
 .insert-menu summary{white-space:nowrap;padding:5px}
 summary[aria-disabled=true]{opacity:.4;cursor:default}
 .dropdown label{display:flex;flex-direction:column;gap:5px;padding:5px;font-size:11px}
 .dropdown button{text-align:left}
</style>
