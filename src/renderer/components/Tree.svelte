<script lang="ts">
 import Tree from './Tree.svelte'
 import Icon from './Icon.svelte'
 import {fileKind} from '../lib/icons'
 import type {TreeEntry} from '../../shared/types'
 let {entries,open,onerror,depth=0,filter=''}:{entries:TreeEntry[];open:(path:string)=>void;onerror:(message:string)=>void;depth?:number;filter?:string}=$props()
 let expanded=$state<Record<string,TreeEntry[]>>({})
 async function toggle(entry:TreeEntry){try{if(expanded[entry.path]){const next={...expanded};delete next[entry.path];expanded=next}else expanded={...expanded,[entry.path]:await window.freya.tree(entry.path)}}catch(error){onerror(String(error))}}
</script>
{#each entries.filter(e=>e.directory||e.name.toLowerCase().includes(filter.toLowerCase())) as entry (entry.path)}
 <button class="tree-item" style:padding-left={`${12+depth*14}px`} title={entry.path} onclick={()=>entry.directory?toggle(entry):open(entry.path)} aria-expanded={entry.directory?!!expanded[entry.path]:undefined}>
  <span class="tree-symbol">{#if entry.directory}<Icon name={expanded[entry.path]?'chevron-down':'chevron-right'} size={12}/>{/if}</span>{#if entry.directory}<span class="folder-icon file-icon"><Icon name={expanded[entry.path]?'folder-open':'folder'} size={14}/></span>{:else}{@const type=fileKind(entry.name)}<span class="file-icon kind-{type.kind}"><Icon name={type.icon} size={14}/></span>{/if}<span class="truncate">{entry.name}</span>
 </button>
 {#if entry.directory&&expanded[entry.path]}<Tree entries={expanded[entry.path]} {open} {onerror} depth={depth+1} {filter}/>{/if}
{/each}
