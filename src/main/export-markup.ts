import sanitize from 'sanitize-html'

export const svgTags=['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','marker','clipPath','mask','linearGradient','radialGradient','stop','title','desc','style','use','symbol','image','foreignObject','div','span','p','br']
const embeddedImage=(tagName:string,attributes:Record<string,string>)=>({tagName,attribs:Object.fromEntries(Object.entries(attributes).filter(([key,value])=>!['src','href','xlink:href'].includes(key)||value.startsWith('data:image/')))})

// La misma política de la exportación autónoma, también para la salida de Pandoc.
export function cleanExportMarkup(html:string):string {
 return sanitize(html,{transformTags:{img:embeddedImage,image:embeddedImage},allowedTags:[...sanitize.defaults.allowedTags,...svgTags,'html','head','body','meta','style','img','input','details','summary'],allowedAttributes:{'*':['class','id','style','title','role','aria-label','aria-hidden','width','height','viewBox','xmlns','d','transform','fill','stroke','stroke-width','points','x','y','x1','x2','y1','y2','dx','dy','rx','ry','r','cx','cy','opacity','text-anchor','dominant-baseline','font-size','font-family','font-weight','marker-end','marker-start','orient','refX','refY','markerWidth','markerHeight','href','clip-path','preserveAspectRatio'],details:['open'],a:['data-footnote-ref','data-footnote-backref','aria-describedby'],section:['data-footnotes'],span:['data-seccion-faltante'],img:['src','alt','width','height'],input:['type','checked','disabled'],meta:['charset']},allowedSchemes:['data'],allowProtocolRelative:false,allowVulnerableTags:true,parser:{lowerCaseTags:false,lowerCaseAttributeNames:false}})
}
