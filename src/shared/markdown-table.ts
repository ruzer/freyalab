// Un tramo de código evita enlaces automáticos de GFM; JSON distingue controles, vacíos y barras.
export const literal=(text:string)=>{
 const json=JSON.stringify(text),fence='`'.repeat((json.match(/`+/g)??[]).reduce((n,run)=>Math.max(n,run.length+1),1))
 return fence+' '+json.replace(/\|/g,'\\|')+' '+fence
}
export const table=(rows:string[][])=>rows.map(row=>'| '+row.join(' | ')+' |').join('\n')+'\n\n'
