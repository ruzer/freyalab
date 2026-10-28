import {markdownHTML} from 'render-under-test'
window.measureAcademicRender=async()=>{
 const size=10*1024*1024,objects=Array.from({length:20},(_,index)=>`# Apartado ${index+1}\n\n![Pie **destacado** ${index+1}](a.png){#fig:f${index}}\n\n| Clave | Valor |\n| - | - |\n| 001 | 2 |\n\n: Datos *revisados* ${index+1} {#tbl:t${index}}\n\nVer [@fig:f${index}] y [@tbl:t${index}].\n\n`).join('')
 const block=('Contenido del informe para comprobar el render. '.repeat(300))+'\n\n',remaining=size-objects.length,source=objects+block.repeat(Math.ceil(remaining/block.length)).slice(0,remaining)
 if(new TextEncoder().encode(source).byteLength!==size)throw new Error('El fixture debe medir exactamente10MiB')
 await markdownHTML('# Calentar imports\n\nTexto breve.')
 const timings=[];let last
 for(let repeat=0;repeat<3;repeat++){const start=performance.now();last=await markdownHTML(source);timings.push(performance.now()-start)}
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)),fixtureSHA256=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')
 return{fixtureBytes:size,fixtureSHA256,timingsMs:timings,medianMs:[...timings].sort((a,b)=>a-b)[1],figures:last.figures?.length??0,tables:last.tables?.length??0,warnings:last.warnings??[],htmlBytes:new TextEncoder().encode(last.html).byteLength,headings:last.headings.length,isolated:{node:typeof window.require,bridge:typeof window.freya}}
}
