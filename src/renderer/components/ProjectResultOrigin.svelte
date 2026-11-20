<script lang="ts">
 import type {ProjectResultView} from '../../shared/project-exports'
 import {t,getUILanguage} from '../lib/i18n.svelte'
 import {projectResultSummary,projectResultWarnings} from '../lib/project-result'
 import Icon from './Icon.svelte'
 let{result,dirty=false}:{result:ProjectResultView;dirty?:boolean}=$props()
 const snapshot=$derived(result.provenance.snapshot)
 const summary=$derived(projectResultSummary(result,getUILanguage()))
 const problem=$derived(result.status==='verified'?'':result.reason||t(result.status==='changed'?'project.export.changed':result.status==='missing'?'project.export.missing':'project.result.unknown'))
</script>
<aside class="project-result-origin" role="note" aria-label={t('project.result.origin')}>
 <Icon name="file" size={14}/>
 <div>
  <p><strong>{snapshot?t('project.result.originLine',{name:snapshot.recipes.at(-1)?.name??'',source:snapshot.sourceName}):t('project.result.origin')}</strong> · {summary}</p>
  {#if problem}<p role="status">{problem}</p>{/if}
  {#if dirty}<p>{t('project.result.modifiedWarning')}</p>{/if}
  {#each projectResultWarnings(result) as warning}<p>{warning}</p>{/each}
 </div>
</aside>
<style>
 .project-result-origin{display:flex;gap:7px;flex:none;padding:7px 12px;border-bottom:1px solid var(--border);background:var(--tint);color:var(--text);font-size:12px;line-height:1.4;overflow-wrap:anywhere}.project-result-origin :global(.icon){flex:none;margin-top:2px}.project-result-origin div{min-width:0}.project-result-origin p{margin:0}.project-result-origin p+p{margin-top:3px}
</style>
