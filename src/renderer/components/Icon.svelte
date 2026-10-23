<script lang="ts">
 import {icons,type IconName} from '../lib/icons'
 let {name,size=16,label}:{name:IconName;size?:number;label?:string}=$props()
</script>
<svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden={label?undefined:'true'} role={label?'img':undefined} aria-label={label}>{@html icons[name]}</svg>
<style>.icon{display:inline-block;vertical-align:-3px;flex:none}</style>
