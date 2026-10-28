<script lang="ts">
 import Icon from './Icon.svelte'
 let {warnings,ondismiss}:{warnings:string[];ondismiss:()=>void}=$props()
</script>

<section class="warning-banner asset-warnings" aria-label="Imágenes no copiadas">
 <details>
  <summary>{warnings.length===1?'1 imagen no se copió':`${warnings.length} imágenes no se copiaron`}</summary>
  <ul>{#each warnings as warning}<li>{warning}</li>{/each}</ul>
 </details>
 <button onclick={ondismiss} aria-label="Cerrar aviso de imágenes"><Icon name="x" size={14}/></button>
</section>

<style>
 .asset-warnings{display:flex;align-items:flex-start;gap:10px;flex:none}
 details{flex:1;min-width:0}summary{cursor:pointer}
 ul{margin:7px 0 0;padding-left:20px;max-height:min(180px,30vh);overflow:auto;overflow-wrap:anywhere}
 button{display:flex;flex:none;padding:2px;background:transparent;border:0;color:inherit}
</style>
