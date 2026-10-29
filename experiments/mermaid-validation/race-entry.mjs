import {diagramSVG,validateDiagram} from 'render-under-test'
const diagram='flowchart LR\n A[Inicio] -->|Revisar| B{Listo}\n B -->|Sí| C[Guardar]'
const luminance=rgb=>rgb.map(channel=>{const value=channel/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05)
function sample(svg,name,dark){
 const section=document.createElement('section');section.dataset.name=name;section.style.background=dark?'#18181b':'white';section.innerHTML=svg;document.body.append(section)
 const colors=selector=>Array.from(section.querySelectorAll(selector)).map(node=>{const style=getComputedStyle(node),property=node.matches('text,tspan')?'fill':node.closest('marker')?'fill':'stroke',color=style[property],rgb=color.match(/[\d.]+/g)?.slice(0,3).map(Number);if(!rgb||color==='none')return null;return{color,contrast:ratio(rgb,dark?[24,24,27]:[255,255,255])}}).filter(Boolean)
 const texts=colors('svg text,svg tspan'),edges=colors('svg .flowchart-link,svg .edgePaths path'),markers=colors('svg marker path')
 const signature={texts:[...new Set(texts.map(value=>value.color))].sort(),edges:[...new Set(edges.map(value=>value.color))].sort(),markers:[...new Set(markers.map(value=>value.color))].sort()}
 return{signature,minimum:{text:Math.min(...texts.map(value=>value.contrast)),edge:Math.min(...edges.map(value=>value.contrast)),marker:Math.min(...markers.map(value=>value.contrast))},counts:{texts:texts.length,edges:edges.length,markers:markers.length}}
}
window.runRealRace=async kind=>{
 const lightSource=diagram+'\n%% raced-light-'+kind,darkSource=diagram+'\n%% raced-dark-'+kind
 const [lightSVG,darkSVG]=kind==='render-render'?await Promise.all([diagramSVG(lightSource,false),diagramSVG(darkSource,true)]):await Promise.all([diagramSVG(lightSource,false),validateDiagram(darkSource,true)])
 const light=sample(lightSVG,'raced-light',false),dark=darkSVG?sample(darkSVG,'raced-dark',true):null
 const cachedSVG=await diagramSVG(lightSource,false),cached=sample(cachedSVG,'cached-light',false)
 const controlLight=sample(await diagramSVG(diagram+'\n%% control-light-'+kind,false),'control-light',false)
 const controlDark=sample(await diagramSVG(diagram+'\n%% control-dark-'+kind,true),'control-dark',true)
 const same=(a,b)=>JSON.stringify(a.signature)===JSON.stringify(b.signature)
 return{kind,light,dark,cached,controlLight,controlDark,cacheExact:cachedSVG===lightSVG,lightMatchesControl:same(light,controlLight),darkMatchesControl:dark?same(dark,controlDark):null,cachedMatchesControl:same(cached,controlLight),isolated:{node:typeof window.require,bridge:typeof window.freya}}
}
