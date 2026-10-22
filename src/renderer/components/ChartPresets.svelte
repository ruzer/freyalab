<script lang="ts">
 import {onMount} from 'svelte'
 import {matchingChartHeaders,ambiguousChartHeaders,type ChartConfiguration,type ChartPreset} from '../../shared/chart-presets'
 let {docId,headers,readonly,configuration,disabled,canSave,onapply}:{docId:string;headers:string[];readonly:boolean;configuration:ChartConfiguration;disabled:boolean;canSave:boolean;onapply:(configuration:ChartConfiguration)=>void}=$props()
 let presets=$state<ChartPreset[]>([]),selected=$state(''),name=$state(''),busy=$state(false),message=$state(''),acknowledged=$state(false)
 const chosen=$derived(presets.find(item=>item.id===selected))
 const matches=$derived(chosen&&matchingChartHeaders(chosen.configuration.headers,headers))
 const ambiguous=$derived(ambiguousChartHeaders(headers))
 const blocked=$derived(!chosen||!matches||(ambiguous&&!acknowledged)||(readonly&&!!chosen.configuration.view))
 async function refresh(){busy=true;try{presets=await window.freya.chartPresets();message='Biblioteca actualizada.'}catch(error){message=String(error)}finally{busy=false}}
 onMount(()=>{void refresh()})
 async function save(){busy=true;try{const saved=await window.freya.saveChartPreset(docId,{name,configuration:$state.snapshot(configuration)});presets=await window.freya.chartPresets();selected=saved.id;acknowledged=false;name='';message='Configuración guardada en este equipo. El CSV no se modificó.'}catch(error){message=String(error)}finally{busy=false}}
 async function remove(){if(!chosen)return;busy=true;try{await window.freya.deleteChartPreset(chosen.id);presets=await window.freya.chartPresets();selected='';acknowledged=false;message='Configuración eliminada. El CSV no se modificó.'}catch(error){message=String(error)}finally{busy=false}}
 function apply(){if(!chosen||blocked)return;onapply(structuredClone($state.snapshot(chosen.configuration)));message='Configuración recuperada. Pulsa Generar gráfico para calcular con los datos actuales.'}
</script>
<details class="presets">
 <summary>Configuraciones guardadas</summary>
 <p>Guarda los ejes, cálculos, series y filtros en este equipo. No guarda filas ni resultados. Puedes reutilizarlos con las mismas columnas, en el mismo orden.</p>
 <div class="controls">
  <label>Nombre <input aria-label="Nombre de configuración del gráfico" maxlength="80" bind:value={name} disabled={disabled||busy}/></label>
  <button type="button" disabled={disabled||busy||!canSave||!name.trim()} onclick={()=>void save()}>Guardar configuración</button>
 </div>
 <div class="controls">
  <label>Recuperar <select aria-label="Configuración guardada del gráfico" bind:value={selected} onchange={()=>{acknowledged=false;message=''}} disabled={busy||disabled}><option value="">Elige una configuración…</option>{#each presets as item}<option value={item.id}>{item.name}</option>{/each}</select></label>
  <button type="button" disabled={disabled||busy||blocked} onclick={apply}>Aplicar configuración</button>
  <button type="button" disabled={disabled||busy||!chosen} onclick={()=>void remove()}>Eliminar configuración elegida</button>
  <button type="button" disabled={busy||disabled} onclick={()=>void refresh()}>Actualizar biblioteca</button>
 </div>
 {#if chosen&&!matches}<p role="alert">Las columnas cambiaron de nombre, posición o cantidad. Esta configuración se conserva, pero no puede aplicarse a este documento.</p>{/if}
 {#if chosen&&matches&&ambiguous}<label><input type="checkbox" bind:checked={acknowledged}/>Confirmo que las columnas sin nombre o repetidas corresponden a las mismas posiciones.</label>{/if}
 {#if readonly&&chosen?.configuration.view}<p role="alert">Los filtros de tabla guardados no se pueden aplicar a una muestra. Abre un documento editable o elige una configuración del documento completo.</p>{/if}
 <p aria-live="polite" aria-label="Estado de configuraciones">{message}</p>
</details>
<style>
 .presets{border:1px solid var(--border);border-radius:6px;padding:0 8px;margin:8px 0}summary{cursor:pointer;padding:8px 0}.controls{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0}label{display:flex;align-items:center;gap:6px}p{color:var(--muted);line-height:1.5}input,select,button{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:5px;padding:5px 8px}select{max-width:240px}button:disabled{opacity:.5}button:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
