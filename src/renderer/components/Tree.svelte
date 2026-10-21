<script lang="ts">
 import Tree from './Tree.svelte'
 import type {TreeEntry} from '../../shared/types'
 let {entries,open,onerror,depth=0,filter=''}:{entries:TreeEntry[];open:(path:string)=>void;onerror:(message:string)=>void;depth?:number;filter?:string}=$props()
 let expanded=$state<Record<string,TreeEntry[]>>({})
 async function toggle(entry:TreeEntry){try{if(expanded[entry.path]){const next={...expanded};delete next[entry.path];expanded=next}else expanded={...expanded,[entry.path]:await window.freya.tree(entry.path)}}catch(error){onerror(String(error))}}
</script>
{#each entries.filter(e=>e.directory||e.name.toLowerCase().includes(filter.toLowerCase())) as entry (entry.path)}
 <button class="tree-item" style:padding-left={`${12+depth*14}px`} title={entry.path} onclick={()=>entry.directory?toggle(entry):open(entry.path)} aria-expanded={entry.directory?!!expanded[entry.path]:undefined}>
  <span class="tree-symbol">{entry.directory?(expanded[entry.path]?'▾':'▸'):' '}</span><span class:folder-icon={entry.directory} class="file-icon">{entry.directory?'▰':entry.name.match(/\.(csv|tsv)$/i)?'▦':entry.name.match(/\.(mmd|mermaid)$/i)?'◇':'▤'}</span><span class="truncate">{entry.name}</span>
 </button>
 {#if entry.directory&&expanded[entry.path]}<Tree entries={expanded[entry.path]} {open} {onerror} depth={depth+1} {filter}/>{/if}
{/each}
