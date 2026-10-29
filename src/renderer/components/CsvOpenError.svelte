<script lang="ts">
 import {t} from '../lib/i18n.svelte'
 import type {CsvOpenError} from '../../shared/types'
 import Icon from './Icon.svelte'
 let {issue,busy=false,onopen,onclose}:{issue:CsvOpenError;busy?:boolean;onopen:()=>void;onclose:()=>void}=$props()
</script>
<section class="csv-open-error" role="alert" aria-label={t('csvText.error.label')}>
 <header><strong>{t('csvText.error.title',{nombre:issue.name})}</strong><button class="icon-button" disabled={busy} aria-label={t('csvText.error.dismiss')} onclick={onclose}><Icon name="x" size={14}/></button></header>
 <p>{issue.reportedLine?t('csvText.error.location',{line:issue.reportedLine}):t('csvText.error.locationUnknown')}</p>
 <details><summary>{t('csvText.error.detail')}</summary><pre>{issue.message}</pre></details>
 <button class="primary" disabled={busy||!issue.textAllowed} title={!issue.textAllowed?t('csvText.limit'):undefined} onclick={onopen}>{busy?t('csvText.error.opening'):t('csvText.openText')}</button>
</section>
<style>
 .csv-open-error{padding:12px 16px;color:var(--text);background:var(--panel);border-bottom:1px solid var(--border);font-size:12px;max-height:45vh;overflow:auto}
 header{display:flex;align-items:center;justify-content:space-between;gap:12px}strong{overflow-wrap:anywhere}p{margin:6px 0;line-height:1.6}
 details{margin:8px 0}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:120px;overflow:auto;line-height:1.6;background:var(--bg);padding:8px}
</style>
