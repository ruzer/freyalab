<script lang="ts">
 import {t} from '../lib/i18n.svelte'
 import type {UpdateRelease} from '../../shared/updates'
 let{release,onview,ondismiss}:{release:UpdateRelease;onview:()=>void;ondismiss:()=>void}=$props()
 let busy=$state(false),message=$state('')
 async function dismiss(skip:boolean){
  busy=true
  try{if(skip)await window.freya.skipUpdate(release.version);else await window.freya.remindUpdate();ondismiss()}
  catch{message=t('updates.error.action')}finally{busy=false}
 }
</script>
<div class="update-notice" role="status" aria-live="polite">
 <span>{message||t('updates.notice',{version:release.version})}</span>
 <div><button disabled={busy} onclick={onview}>{t('updates.view')}</button><button disabled={busy} onclick={()=>dismiss(false)}>{t('updates.remind')}</button><button disabled={busy} onclick={()=>dismiss(true)}>{t('updates.skip')}</button></div>
</div>
<style>
 .update-notice{position:fixed;right:20px;bottom:70px;z-index:100;max-width:min(620px,calc(100vw - 40px));padding:16px;border:1px solid var(--border);border-radius:10px;background:var(--panel);color:var(--text);box-shadow:0 8px 30px #0004;line-height:1.5;overflow-wrap:anywhere}.update-notice div{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:12px}button{white-space:normal;min-height:32px}
</style>
