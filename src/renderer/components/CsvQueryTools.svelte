<script lang="ts">
 import {onMount,untrack} from 'svelte'
 import {filterOperators} from '../../shared/table-conditions'
 import type {TableFilter,TableSort} from '../../shared/types'
 let {filtersOnly=false,headers,initialConditions,initialOrder,initialMode,onapply,onclose}:{filtersOnly?:boolean;headers:string[];initialConditions:TableFilter[];initialOrder:TableSort[];initialMode:'all'|'any';onapply:(conditions:TableFilter[],order:TableSort[],mode:'all'|'any')=>void;onclose:()=>void}=$props()
 let conditions=$state<TableFilter[]>(untrack(()=>structuredClone($state.snapshot(initialConditions)))),order=$state<TableSort[]>(untrack(()=>structuredClone($state.snapshot(initialOrder)))),mode=$state(untrack(()=>initialMode)),title:HTMLHeadingElement,region:HTMLElement
 const titleId=$props.id()
 const label=$derived(filtersOnly?'Filtros del gráfico':'Consulta avanzada')
 onMount(()=>title.focus())
</script>
<svelte:window onkeydown={event=>{if(event.key==='Escape'&&event.target instanceof HTMLElement&&region?.contains(event.target)){event.preventDefault();event.stopPropagation();onclose()}}}/>
<section bind:this={region} class="query-tools" aria-labelledby={titleId}>
 <div class="heading"><h3 id={titleId} tabindex="-1" bind:this={title}>{label}</h3><button type="button" aria-label={filtersOnly?'Cerrar filtros del gráfico':'Cerrar consulta avanzada'} onclick={onclose}>×</button></div>
 <form onsubmit={event=>{event.preventDefault();onapply($state.snapshot(conditions),$state.snapshot(order),mode)}}>
  <div class="query-body">
  <label>Coincidir <select aria-label="Combinar condiciones" bind:value={mode}><option value="all">Todas las condiciones (Y)</option><option value="any">Cualquier condición (O)</option></select></label>
  {#each conditions as rule,index}<div class="rule">
   <select aria-label={`Columna de condición ${index+1}`} bind:value={rule.column}>{#each headers as name,column}<option value={column}>{column+1}. {name||'Sin encabezado'}</option>{/each}</select>
   <select aria-label={`Operador de condición ${index+1}`} bind:value={rule.op}>{#each filterOperators as [value,label]}<option {value}>{label}</option>{/each}</select>
   {#if !['empty','notEmpty'].includes(rule.op)}<input aria-label={`Valor de condición ${index+1}`} bind:value={rule.value} required placeholder={rule.op.startsWith('date')?'AAAA-MM-DD':'Valor'} type={rule.op.startsWith('date')?'date':'text'}/>{/if}
   {#if ['contains','equals','notEquals','starts','ends','regex'].includes(rule.op)}<label><input type="checkbox" bind:checked={rule.caseSensitive}/>Distinguir mayúsculas</label>{/if}
   <button type="button" aria-label={`Quitar condición ${index+1}`} onclick={()=>conditions=conditions.filter((_,i)=>i!==index)}>×</button>
  </div>{/each}
  <button type="button" disabled={conditions.length>=20||!headers.length} onclick={()=>conditions=[...conditions,{column:0,op:'contains',value:''}]}>Añadir condición</button>
  {#if !filtersOnly}<h4>Orden por prioridad</h4>
  {#each order as item,index}<div class="rule">
   <span>{index+1}.</span><select aria-label={`Columna de orden ${index+1}`} bind:value={item.column}>{#each headers as name,column}<option value={column}>{column+1}. {name||'Sin encabezado'}</option>{/each}</select>
   <select aria-label={`Dirección de orden ${index+1}`} bind:value={item.descending}><option value={false}>Ascendente</option><option value={true}>Descendente</option></select>
   <label><input type="checkbox" aria-label={`Orden numérico ${index+1}`} bind:checked={item.numeric}/>Numérico exacto</label>
   <button type="button" aria-label={`Quitar orden ${index+1}`} onclick={()=>order=order.filter((_,i)=>i!==index)}>×</button>
  </div>{/each}
  <button type="button" disabled={order.length>=20||!headers.length} onclick={()=>order=[...order,{column:0,descending:false,numeric:false}]}>Añadir orden</button>{/if}
  {#if filtersOnly}<p>Solo limita el análisis del gráfico; no cambia la tabla ni el CSV. Las condiciones se combinan mediante Y u O dentro de este grupo y se aplican después del alcance elegido y antes del cálculo. Fechas ISO AAAA-MM-DD; números con punto decimal y expresiones RE2.</p>{:else}<p>Solo cambia la vista. Guardar conserva el orden del documento. Mayús + clic en un encabezado añade un criterio. Fechas ISO AAAA-MM-DD; los campos con otra fecha no coinciden. La búsqueda global y los filtros de encabezado se combinan con esta consulta mediante Y.</p>{/if}
  </div>
  <div class="actions"><button type="submit" class="primary">{filtersOnly?'Aplicar filtros del gráfico':'Aplicar consulta'}</button><button type="button" onclick={onclose}>Cancelar</button></div>
 </form>
</section>
<style>
 .query-tools{padding:10px 12px;border-bottom:1px solid var(--border);background:var(--panel);font-size:11px;max-height:360px;overflow:hidden;flex-shrink:0;display:flex;flex-direction:column}form{min-height:0;display:flex;flex-direction:column}.query-body{overflow:auto;max-height:250px;min-height:0}.actions{flex-shrink:0}.heading{display:flex;justify-content:space-between;align-items:center}.heading h3{font-size:12px;margin:0}.heading button{border:0;background:transparent}.rule,.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}label{display:inline-flex;align-items:center;gap:5px}.rule select{max-width:190px}.rule input[type=text],.rule input[type=date]{width:170px}h4{font-size:11px;margin:12px 0 6px}p{line-height:1.5;color:var(--muted);max-width:850px}button,select,input{font-size:11px}button{appearance:none;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:5px;padding:5px 8px}button.primary{color:white}
</style>
