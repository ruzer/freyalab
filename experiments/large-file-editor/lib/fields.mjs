// Campos de un registro conservando su texto original, para poder cambiar uno sin tocar los demás. Experimento, no producto.
import iconv from 'iconv-lite'
export const decode=(buffer,encoding)=>encoding==='utf8'?buffer.toString('utf8'):iconv.decode(buffer,encoding)
export const encode=(text,encoding)=>encoding==='utf8'?Buffer.from(text,'utf8'):iconv.encode(text,encoding)
// «registro» = texto sin su salto de línea final. Una comilla solo abre un campo al principio de este.
export function splitFields(record,delimiter){
 const fields=[];let i=0
 while(true){
  const start=i;let quoted=false,value=''
  if(record[i]==='"'){
   quoted=true;i++
   while(i<record.length){if(record[i]==='"'){if(record[i+1]==='"'){value+='"';i+=2;continue}i++;break}value+=record[i++]}
   while(i<record.length&&record[i]!==delimiter)value+=record[i++] // basura tras la comilla de cierre: se conserva
  }else{while(i<record.length&&record[i]!==delimiter)i++;value=record.slice(start,i)}
  fields.push({text:record.slice(start,i),value,quoted})
  if(i>=record.length)break
  i++ // delimitador
  if(i===record.length){fields.push({text:'',value:'',quoted:false});break} // delimitador final = campo vacío
 }
 return fields
}
export const needsQuotes=(value,delimiter)=>value.includes(delimiter)||/["\r\n]/.test(value)
export const serializeField=(value,delimiter,wasQuoted)=>needsQuotes(value,delimiter)||wasQuoted?`"${value.replaceAll('"','""')}"`:value
// Separa el salto de línea final del texto de un registro.
export const splitEol=text=>{const m=/(\r\n|\n|\r)$/.exec(text);return m?{body:text.slice(0,-m[0].length),eol:m[0]}:{body:text,eol:''}}

// Extractor perezoso: recorre el registro y solo materializa los campos pedidos (no divide las 230 columnas).
export function pickFields(wanted,delimiter=','){
 const max=Math.max(...wanted)
 return text=>{
  const out=new Map();let i=0,field=0,n=text.length
  while(field<=max&&i<=n){
   const quoted=text[i]==='"';let value=''
   if(quoted){i++;let from=i;for(;i<n;i++){if(text[i]==='"'){if(text[i+1]==='"'){value+=text.slice(from,i+1);i++;from=i+1;continue}break}}value+=text.slice(from,i);i++}
   else{const from=i;while(i<n&&text[i]!==delimiter&&text[i]!=='\n'&&text[i]!=='\r')i++;value=text.slice(from,i)}
   while(i<n&&text[i]!==delimiter&&text[i]!=='\n'&&text[i]!=='\r')i++
   if(wanted.has(field))out.set(field,value)
   if(text[i]===delimiter){i++;field++}else break
  }
  return out
 }
}
