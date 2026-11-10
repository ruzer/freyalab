import {TokenType,type ScriptTokens} from '@duckdb/duckdb-wasm'
import {CalculationError,type ColumnRead} from '../shared/calculated-column'
import {calculationFunctionGroups} from '../shared/calculation-help'
import {quoteIdentifier} from '../shared/sql-helpers'

export type CalculationColumn=ColumnRead&{name:string}

// El binder sigue interpretando la expresión. Esta lista solo delimita la superficie local.
const calls=new Set(Object.values(calculationFunctionGroups).flat())
const words=new Set('and as between case else end escape false for from ilike in is like not null or then true when date interval day days month months year years hour hours minute minutes second seconds boolean tinyint smallint integer int bigint hugeint utinyint usmallint uinteger ubigint uhugeint decimal numeric double precision float real text string char character varying varchar ::'.split(' '))
const typeModifiers=new Set(['decimal','numeric','char','character','varchar'])
const groups=new Set('and between case else for from in is not or then when interval'.split(' '))
const forbiddenBare=new Set('current_catalog current_database current_query current_role current_schema current_schemas current_setting current_user session_user user'.split(' '))
const operators=new Set('( ) [ ] , + - * / // % ^ ** || = == < <= > >= != <> <=> & | # ~ !~ << >>'.split(' '))
const scalarTypes=new Set('BOOLEAN TINYINT SMALLINT INTEGER BIGINT HUGEINT UTINYINT USMALLINT UINTEGER UBIGINT UHUGEINT FLOAT DOUBLE VARCHAR DATE'.split(' '))
const maxValueBytes=3*1024*1024 // Un byte Windows-1252 puede ocupar hasta tres bytes en UTF-8.
const sizeMarker='freya-calculated-value-too-large'

function validateExpression(expression:string,tokens:ScriptTokens,columns:readonly CalculationColumn[]){
 if(tokens.types.length!==tokens.offsets.length)throw new CalculationError('scalar')
 const bytes=new TextEncoder().encode(expression),decode=new TextDecoder()
 const pieces=tokens.offsets.map((offset,index)=>({
  text:decode.decode(bytes.subarray(offset,tokens.offsets[index+1])).trim(),type:tokens.types[index]
 })).filter(piece=>piece.type!==TokenType.COMMENT)
 const names=new Set(columns.map(column=>column.name.toLowerCase()))
 let depth=0
 if(!pieces.length)throw new CalculationError('scalar')
 for(const [index,{text:token,type}] of pieces.entries()){
  if(type===TokenType.STRING_CONSTANT||type===TokenType.NUMERIC_CONSTANT)continue
  if(type===TokenType.OPERATOR){
   if(!operators.has(token))throw new CalculationError('scalar',token)
   if(token==='(')depth++
   if(token===')'&&--depth<0)throw new CalculationError('scalar',token)
   continue
  }
  const quoted=type===TokenType.IDENTIFIER&&token.startsWith('"')&&token.endsWith('"')
  const name=quoted?token.slice(1,-1).replaceAll('""','"'):token
  const key=name.toLowerCase()
  if(!quoted&&forbiddenBare.has(key))throw new CalculationError('scalar',name)
  if(pieces[index+1]?.type===TokenType.OPERATOR&&pieces[index+1].text==='('){
   if(!calls.has(key)&&!(!quoted&&(groups.has(key)||typeModifiers.has(key))))throw new CalculationError('scalar',name)
  }else if(!names.has(key)&&!(!quoted&&words.has(key))){
   if(type===TokenType.IDENTIFIER)throw new CalculationError('unknownColumn',undefined,name)
   throw new CalculationError('scalar',name)
  }
 }
 if(depth)throw new CalculationError('scalar')
}

function converted(column:CalculationColumn){
 const name=quoteIdentifier(column.name)
 if(column.read==='text')return name
 if(column.read==='date'){
  // Los mismos caracteres exteriores que String.trim() ignora al perfilar.
  const trimmed=`TRIM(${name}, ' \t\n\v\f\r\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')`
  const parsed=`TRY_CAST(${trimmed} AS DATE)`
  return `CASE WHEN length(${trimmed})=10 AND CAST(${parsed} AS VARCHAR)=${trimmed} THEN ${parsed} END`
 }
 const scale=column.scale??0
 if(!Number.isInteger(scale)||scale<0||scale>12)throw new CalculationError('incompatible')
 return `TRY_CAST(NULLIF(TRIM(${name}),'') AS DECIMAL(38,${scale}))`
}

function invalidColumns(columns:readonly CalculationColumn[]){
 return columns.filter(column=>column.read!=='text')
}

export function calculationProjection(expression:string,tokens:ScriptTokens,columns:readonly CalculationColumn[],rowColumn:string){
 const names=new Set(columns.map(column=>column.name.toLowerCase()))
 if(names.size!==columns.length||names.has(rowColumn.toLowerCase())||
    columns.some(column=>!Number.isInteger(column.index)||column.index<0||column.index>199))throw new CalculationError('incompatible')
 validateExpression(expression,tokens,columns)
 const row=quoteIdentifier(rowColumn)
 const source=[row,...columns.map(column=>`${converted(column)} AS ${quoteIdentifier(column.name)}`)]
 const invalid=invalidColumns(columns).map(column=>`${quoteIdentifier(column.name)} IS NULL AS freya_invalid_${column.index}`)
 const packed=`SELECT ${[row+' AS freya_row',`TRY(struct_pack(value := (\n${expression}\n))) AS freya_packed`,...invalid].join(',')} FROM (SELECT ${source.join(',')} FROM datos) AS freya_source`
 return `SELECT ${['freya_row','freya_packed.value AS freya_value','freya_packed IS NULL AS freya_failed',...invalidColumns(columns).map(column=>'freya_invalid_'+column.index)].join(',')} FROM (${packed}) AS freya_result`
}

export function calculationResult(projection:string,type:string,columns:readonly CalculationColumn[]){
 if(!scalarTypes.has(type)&&!type.startsWith('DECIMAL('))throw new CalculationError('scalar',type)
 const flags=invalidColumns(columns).map(column=>'freya_invalid_'+column.index)
 let source=projection,text='CAST(freya_value AS VARCHAR)',failed='freya_failed'
 if(type==='DOUBLE'||type==='FLOAT'){
  // Desplaza el punto del texto de DuckDB sin reinterpretar el valor binario.
  source=`SELECT *, CASE WHEN isfinite(freya_value) THEN CAST(freya_value AS VARCHAR) END AS raw,
   split_part(raw,'e',1) AS mantissa, ltrim(mantissa,'-') AS magnitude,
   replace(magnitude,'.','') AS digits,
   length(split_part(magnitude,'.',1))+TRY_CAST(split_part(raw,'e',2) AS INTEGER) AS point,
   CASE WHEN left(mantissa,1)='-' THEN '-' ELSE '' END AS sign
   FROM (${projection}) AS freya_number`
  text=`CASE WHEN strpos(raw,'e')=0 THEN raw
   WHEN point<=0 THEN sign||'0.'||repeat('0',-point)||digits
   WHEN point>=length(digits) THEN sign||digits||repeat('0',point-length(digits))
   ELSE sign||left(digits,point)||'.'||substr(digits,point+1) END`
  failed='freya_failed OR coalesce(NOT isfinite(freya_value),false)'
 }else if(type==='DATE'){
  text='CASE WHEN length(CAST(freya_value AS VARCHAR))=10 THEN CAST(freya_value AS VARCHAR) END'
  failed='freya_failed OR coalesce(length(CAST(freya_value AS VARCHAR))<>10,false)'
 }
 const display=`SELECT ${['freya_row',`${text} AS freya_text`,`(${failed}) AS freya_failed`,...flags].join(',')} FROM (${source}) AS freya_values`
 return `SELECT ${['freya_row',`CASE WHEN strlen(freya_text)>${maxValueBytes} THEN error('${sizeMarker}') ELSE freya_text END AS freya_output`,'freya_failed',...flags].join(',')} FROM (${display}) AS freya_output_rows ORDER BY freya_row`
}

export function explainCalculationError(error:unknown,columns:readonly CalculationColumn[]){
 if(error instanceof CalculationError)return error
 const detail=error instanceof Error?error.message:String(error)
 if(detail.includes(sizeMarker))return new CalculationError('tooLarge',detail)
 const text=columns.find(column=>column.read==='text'&&detail.includes(column.name))??columns.find(column=>column.read==='text')
 if(text&&detail.includes('VARCHAR')&&(detail.includes('Binder Error')||detail.includes('Cannot combine')))return new CalculationError('textType',detail,text.name)
 if(detail.includes('subquery')||detail.includes('WINDOW')||detail.includes('UNNEST')||detail.includes('aggregate')||detail.includes('multiple statements'))return new CalculationError('scalar',detail)
 return new CalculationError('incompatible',detail)
}
