<script lang="ts">
 import type {TextSelection} from '../lib/text-stats'
 import type {TextStatsRequest,TextStatsReply,TextStatsValue} from '../lib/text-stats.worker'
 let {id,name,text,markdown,partial=false,selection=null}:{id:string;name:string;text:string;markdown:boolean;partial?:boolean;selection?:TextSelection|null}=$props()
 let worker:Worker|undefined,request=0,announced=''
 let result=$state<{id:string;partial:boolean;markdown:boolean;value:TextStatsValue}|null>(null),busy=$state(true),failed=$state(false),announcement=$state('')
 const current=$derived(result?.id===id&&result.partial===partial&&result.markdown===markdown?result.value:null)
 const help=$derived((markdown?'No cuenta metadatos ni bloques de código.':'Cuenta todo el texto.')+' Lectura a 200 palabras por minuto.'+(partial?' Solo se cuenta el primer MiB cargado.':''))
 const number=new Intl.NumberFormat('es')
 const words=$derived(current?`${number.format(current.words)} ${current.words===1?'palabra':'palabras'}`:'')
 const label=$derived(failed?'Conteo no disponible':!current?'Contando…':selection?`${busy||current.selected===null?'…':number.format(current.selected)} de ${words}`:`${words} · ${current.reading}`)
 function send(source?:string){
  if(!worker)return
  busy=true
  // La selección es un proxy de Svelte; al worker solo cruzan sus offsets numéricos.
  const message:TextStatsRequest={request:++request,selection:selection?{from:selection.from,to:selection.to}:null,...(source!==undefined?{text:source,markdown}:{})}
  worker.postMessage(message)
 }
 $effect(()=>{
  const source=text,documentId=id,format=markdown,sample=partial
  busy=true;failed=false
  if(announced!==documentId)announcement=''
  const timer=setTimeout(()=>{
   let instance:Worker
   const fail=()=>{
    if(worker!==instance)return
    failed=true;busy=false
    if(announced!==documentId){announced=documentId;announcement=`${name}. No pude contar las palabras de este documento.`}
   }
   try{
    instance=new Worker(new URL('../lib/text-stats.worker.ts',import.meta.url),{type:'module'});worker=instance
    instance.onerror=fail
    instance.onmessage=(event:MessageEvent<TextStatsReply>)=>{
     const reply=event.data
     if(worker!==instance||reply.request!==request)return
     if('error'in reply){fail();return}
     result={id:documentId,markdown:format,partial:sample,value:reply.value};busy=false;failed=false
     if(announced!==documentId){announced=documentId;announcement=`${name}. ${sample?'Muestra. ':''}${number.format(reply.value.words)} ${reply.value.words===1?'palabra':'palabras'}. ${reply.value.reading}.`}
    }
    send(source)
   }catch{failed=true;busy=false}
  },300)
  return()=>{clearTimeout(timer);worker?.terminate();worker=undefined;request++}
 })
 $effect(()=>{selection;send()})
</script>
<span class="text-stats" title={help} aria-busy={busy}>{partial?'Muestra: ':''}{label}{busy&&current&&!selection?' …':''}</span>
<span class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
