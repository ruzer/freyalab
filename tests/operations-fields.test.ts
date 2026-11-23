// Regresión de rendimiento: CI main 45120143253, Intel PRJ-03 1 GB.
// Estos oráculos comprueban la integridad; no imponen un tiempo absoluto al parser.
import {describe,expect,it} from 'vitest'
import iconv from 'iconv-lite'
import {fieldsOf,StrictRecordError} from '../src/main/operations'
import type {Encoding} from '../src/shared/types'

const encoded=(records:readonly string[],encoding:Encoding)=>records.map(record=>iconv.encode(record,encoding,{addBOM:false}))

function caught(run:()=>unknown):StrictRecordError{
 let error:unknown
 try{run()}catch(value){error=value}
 expect(error).toBeInstanceOf(StrictRecordError)
 return error as StrictRecordError
}

describe('fieldsOf: selección LF sin cambiar contratos CSV',()=>{
 it.each(['utf8','utf16le','win1252'] as const)('%s: LF, comillas, multilínea, identificadores y ausente frente a vacío',encoding=>{
  const raws=encoded([
   '00123;"Mérida; dice ""sí""\nsegunda línea";\n',
   '9007199254740993;México\n',
   '00000;;último'
  ],encoding),before=raws.map(raw=>Buffer.from(raw))
  const result=fieldsOf(raws,7,{encoding,delimiter:';'})
  expect(result).toEqual([
   ['00123','Mérida; dice "sí"\nsegunda línea',''],
   ['9007199254740993','México'],
   ['00000','','último']
  ])
  expect(result[1]).toHaveLength(2);expect(result[1][2]).toBeUndefined()
  expect(result[0]).toHaveLength(3);expect(result[0][2]).toBe('')
  expect(raws).toEqual(before)
 })

 it.each([
  {name:'CR solo',raws:['1,uno\r','2,dos\r','3,tres'],rows:[['1','uno'],['2','dos'],['3','tres']]},
  {name:'CRLF',raws:['1,uno\r\n','2,dos\r\n','3,tres'],rows:[['1','uno'],['2','dos'],['3','tres']]},
  {name:'LF, CRLF y CR en el mismo lote',raws:['1,uno\n','2,dos\r\n','3,tres\r','4,cuatro'],rows:[['1','uno'],['2','dos'],['3','tres'],['4','cuatro']]},
  {name:'CR dentro del campo entrecomillado, aunque los registros acaben en LF',raws:['1,"izquierda\rderecha"\n','2,"A\r\nB"\n','3,"C\nD"\n'],rows:[['1','izquierda\rderecha'],['2','A\r\nB'],['3','C\nD']]},
  {name:'vacío exacto, fila vacía y dos campos vacíos',raws:['\n','""\n',',\n'],rows:[[''],[''],['','']]},
  {name:'fila corta y fila con campo adicional',raws:['1\n','2,x,extra\n'],rows:[['1'],['2','x','extra']]},
  {name:'un registro sin ningún fin de línea',raws:['00123,"café, ""té"""'],rows:[['00123','café, "té"']]}
 ])('$name conserva los campos escritos a mano',({raws,rows})=>{
  const buffers=encoded(raws,'utf8'),before=buffers.map(raw=>Buffer.from(raw))
  expect(fieldsOf(buffers,0,{encoding:'utf8',delimiter:','})).toEqual(rows)
  expect(buffers).toEqual(before)
 })

 it('decide sobre texto UTF-16 decodificado: U+0D00 no es un retorno de carro',()=>{
  // U+0D00 contiene 0x0d en sus bytes LE, pero el texto no contiene U+000D.
  const raws=encoded(['001,ഀ\n','002,México\n'],'utf16le')
  expect(fieldsOf(raws,0,{encoding:'utf16le',delimiter:','})).toEqual([['001','ഀ'],['002','México']])
 })

 it.each(['utf8','utf16le'] as const)('%s: U+FEFF literal al inicio de un registro no se descarta como firma',encoding=>{
  // La firma del archivo ya fue retirada por el escáner. Esto es contenido del usuario.
  const raws=encoded(['001,uno\n','\uFEFF002,\uFEFFdos\n'],encoding)
  expect(fieldsOf(raws,40,{encoding,delimiter:','})).toEqual([['001','uno'],['\uFEFF002','\uFEFFdos']])
  expect(fieldsOf([raws[1]],41,{encoding,delimiter:','})).toEqual([['\uFEFF002','\uFEFFdos']])
 })

 it('el mismo texto conserva sus campos con uno o varios registros por lote',()=>{
  const raws=encoded(['001,"uno\ndos"\n','002,"tres\rcuatro"\n','003,cinco'],'utf8')
  const expected=[['001','uno\ndos'],['002','tres\rcuatro'],['003','cinco']]
  expect(fieldsOf(raws,10,{encoding:'utf8',delimiter:','})).toEqual(expected)
  expect(raws.flatMap((raw,index)=>fieldsOf([raw],10+index,{encoding:'utf8',delimiter:','}))).toEqual(expected)
 })

 it.each(['\n','\r\n','\r'] as const)('el error con %j conserva el registro absoluto y su causa con línea',eol=>{
  // El error está antes del fin de línea: cierre de comillas seguido de texto sin separador.
  // first=40 es ordinal base cero; el segundo registro es el número 42.
  const raws=encoded(['1,correcto'+eol,'2,"sí"x'+eol],'utf8'),before=raws.map(raw=>Buffer.from(raw))
  const error=caught(()=>fieldsOf(raws,40,{encoding:'utf8',delimiter:','}))
  expect(error.message).toMatch(/^El registro 42 no es un CSV válido:/)
  expect(error.cause).toMatchObject({code:'CSV_INVALID_CLOSING_QUOTE',lines:1})
  expect(raws).toEqual(before)
 })

 it('una comilla sin cerrar sigue siendo un error y no una fila reparada',()=>{
  const error=caught(()=>fieldsOf(encoded(['1,correcto\n','2,"sin cerrar\n'],'utf8'),6,{encoding:'utf8',delimiter:','}))
  expect(error.message).toMatch(/^El registro 8 no es un CSV válido:/)
  expect(error.cause).toMatchObject({code:'CSV_QUOTE_NOT_CLOSED'})
 })

 it('UTF-8 inválido falla de forma fatal y conserva la causa de codificación',()=>{
  const raw=Buffer.from([0x32,0x2c,0xc3,0x28,0x0a]),before=Buffer.from(raw)
  const error=caught(()=>fieldsOf([Buffer.from('1,correcto\n'),raw],12,{encoding:'utf8',delimiter:','}))
  expect(error.message).toMatch(/^El registro 14 no es un CSV válido:/)
  expect(error.cause).toMatchObject({code:'ERR_ENCODING_INVALID_ENCODED_DATA'})
  expect(raw).toEqual(before)
 })

 it('mantiene la comprobación de un registro del escáner por registro del analizador',()=>{
  const error=caught(()=>fieldsOf([Buffer.from('1,uno\n2,dos\n')],40,{encoding:'utf8',delimiter:','}))
  expect(error.message).toMatch(/^El registro 41 no es un CSV válido:/)
  expect(error.cause).toMatchObject({message:'2 registros'})
 })

 it('un lote sin registros sigue devolviendo un lote vacío',()=>{
  expect(fieldsOf([],0,{encoding:'utf8',delimiter:','})).toEqual([])
 })
})
