export interface DiagramError {
 kind:'sintaxis'|'tipo'|'vacio'|'otro'
 title:string
 hint:string
 line?:number
 column?:number
 detail:string
}

export function explainDiagramError(message:string,source:string):DiagramError {
 const detail=message
 if(!source.trim())return{kind:'vacio',title:'Escribe un diagrama para empezar.',hint:'Empieza con «flowchart LR» y añade «A --> B» en la línea siguiente.',detail}
 if(/No diagram type detected|UnknownDiagramError|unknown diagram type/i.test(message)){
  const line=source.split(/\r?\n/).findIndex(text=>text.trim()&&!text.trim().startsWith('%%'))+1
  return{kind:'tipo',title:'No se reconoce el tipo de diagrama.',hint:`Revisa la primera línea de la definición: indica un tipo como «flowchart LR» o «sequenceDiagram».`,...(line>0?{line}:{}),detail}
 }
 if(/maximum text size|max(?:imum)?(?:Edges| edges)|too (?:large|many)/i.test(message))return{kind:'otro',title:'El diagrama es demasiado grande.',hint:'Reduce el contenido o divide el dibujo en diagramas más pequeños y vuelve a probar.',detail}
 const location=/(?:parse|lexer)\s+error\s+on\s+line\s+(\d+)(?:,\s*column\s+(\d+))?/i.exec(message)
 const number=(value:string|undefined)=>value&&Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):undefined
 const line=number(location?.[1]),column=line?number(location?.[2]):undefined
 const where=line?`Revisa la línea ${line}${column?`, columna ${column}`:''}`:'Revisa la definición'
 const nearby=line?`${where} y la anterior`:where
 const base={kind:'sintaxis' as const,...(line?{line}:{}),...(column?{column}:{}),detail}
 if(!/parse error|parsing failed|syntax error|lexical error|lexer error|unexpected end|got ['"`]?EOF/i.test(message))return{kind:'otro',title:'No se pudo dibujar el diagrama.',hint:'Prueba una definición más corta y vuelve a añadir sus partes de una en una. El detalle técnico puede ayudar a localizar el problema.',detail}
 // Las llaves de una relación ER no delimitan un bloque; no deben sugerirse como cierres perdidos.
 const braces=/^\s*(?:flowchart|graph|classDiagram|stateDiagram)/.test(source),stack:string[]=[]
 let quoted=false
 for(let i=0;i<source.length;i++){
  const char=source[i]
  if(char==='\\'){i++;continue}
  if(!quoted&&char==='%'&&source[i+1]==='%'){const end=source.indexOf('\n',i);if(end<0)break;i=end;continue}
  if(char==='"'){quoted=!quoted;continue}
  if(quoted||!braces)continue
  if('[({'.includes(char))stack.push(char)
  else if(stack.length&&'])}'.includes(char)&&'[({'.indexOf(stack.at(-1)!)==='])}'.indexOf(char))stack.pop()
 }
 if(quoted)return{...base,title:'Falta cerrar unas comillas.',hint:`${nearby}: cierra las comillas dobles del texto antes de seguir.`}
 if(stack.length){const open=stack.at(-1)!,close={'[':']','(':')','{':'}'}[open],name={'[':'corchete','(':'paréntesis','{':'llave'}[open];return{...base,title:`Falta cerrar ${open==='{'?'una':'un'} ${name}.`,hint:`${nearby}: cierra ${open==='{'?'la':'el'} ${name} «${open}» con «${close}».`}}
 if(/got ['"`]?EOF|EOF_IN_STRUCT|unexpected end|end of (?:input|file)/i.test(message))return{...base,title:'Falta completar el diagrama.',hint:`${where} y el final: completa la última relación o cierra el bloque que quedó abierto.`}
 if(/ARROW|START_LINK|LINK_ID|EDGE_STATE|IDENTIFYING/.test(message)||/[-=][-.>ox]*>\s*$/.test(source)){
  const example=/^\s*sequenceDiagram/.test(source)?'A->>B: mensaje':/^\s*erDiagram/.test(source)?'CLIENTE ||--o{ PEDIDO : tiene':'A --> B'
  return{...base,title:'Revisa la flecha o la relación.',hint:`${where}: comprueba que haya un elemento a cada lado de la flecha. Prueba «${example}».`}
 }
 if(/^\s*pie\b/.test(source))return{...base,title:'Revisa el valor de la porción.',hint:`${where}: escribe un número después de los dos puntos; por ejemplo «"Parte": 10».`}
 if(/^\s*gantt\b/.test(source))return{...base,title:'Faltan datos en una tarea.',hint:`${where}: añade los datos de la tarea después de «:», por ejemplo una fecha y una duración.`}
 return{...base,title:'Hay un problema de sintaxis.',hint:`${where}: comprueba los nombres, signos y separadores. Prueba deshacer el último cambio y escribirlo de nuevo.`}
}
