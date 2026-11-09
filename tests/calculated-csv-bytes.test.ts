import {expect,it} from 'vitest'
import iconv from 'iconv-lite'
import {calculatedRecordBytes} from '../src/main/calculated-csv-bytes'

const formats=[
 {encoding:'utf8',delimiter:';',eol:'\n'},
 {encoding:'utf8',delimiter:'\t',eol:'\r\n'},
 {encoding:'win1252',delimiter:';',eol:'\n'},
 {encoding:'utf16le',delimiter:'\t',eol:'\r\n'}
] as const

it.each(formats)('inserta un campo entre bytes intactos ($encoding, $delimiter)',format=>{
 const {encoding,delimiter}=format
 const physical=['"000124"','"9007199254740993"','"Dijo ""sí""\r\n€"']
 const inserted='café'+delimiter+'"mañana"\n'
 const expectedField='"café'+delimiter+'""mañana""\n"'
 for(const eol of ['\r\n','\n','\r']){
  const original=iconv.encode(physical.join(delimiter)+eol,encoding)
  const before=Buffer.from(original)
  const result=calculatedRecordBytes(original,format,['000124',inserted,'9007199254740993','Dijo "sí"\r\n€'],[0,null,1,2],true)
  expect(result).toEqual(iconv.encode([physical[0],expectedField,...physical.slice(1)].join(delimiter)+eol,encoding))
  expect(original).toEqual(before)
 }
})

it.each(formats)('recodifica una edición pendiente y conserva el comillado de los demás campos ($encoding)',format=>{
 const {encoding,delimiter}=format
 const original=iconv.encode(['"Árbol"', '"antes"', '"000124"',''].join(delimiter),encoding)
 const result=calculatedRecordBytes(original,format,['Árbol','nuevo'+delimiter+'€','000124','','30.30'],[0,1,2,3,null],false)
 expect(result).toEqual(iconv.encode(['"Árbol"','"nuevo'+delimiter+'€"','"000124"','','30.30'].join(delimiter),encoding))
})

it('usa el terminador elegido si un registro lo necesita y carecía de él',()=>{
 const format={encoding:'utf8',delimiter:',',eol:'\r\n'} as const
 expect(calculatedRecordBytes(Buffer.from('"a"'),format,['a','b'],[0,null],true).toString()).toBe('"a",b\r\n')
 expect(calculatedRecordBytes(Buffer.from('"a"\n'),format,['a','b'],[0,null],false).toString()).toBe('"a",b')
 expect(calculatedRecordBytes(undefined,format,['a','b'],[null,null],true).toString()).toBe('a,b\r\n')
})

it('conserva los bytes cuando se recupera o cambia la posición de un campo intacto',()=>{
 const format={encoding:'utf8',delimiter:',',eol:'\n'} as const
 const original=Buffer.from('"A🐾","",A🐾\n')
 expect(calculatedRecordBytes(original,format,['A🐾','','A🐾'],[0,1,2],true)).toEqual(original)
 expect(calculatedRecordBytes(original,format,['A🐾','','A🐾'],[2,1,0],true).toString()).toBe('A🐾,"","A🐾"\n')
})

it('copia los bytes Windows-1252 ya presentes sin sustituirlos',()=>{
 const format={encoding:'win1252',delimiter:';',eol:'\n'} as const
 expect(calculatedRecordBytes(Buffer.from([0x81,0x0a]),format,['\uFFFD','ok'],[0,null],true))
  .toEqual(Buffer.from([0x81,0x3b,0x6f,0x6b,0x0a]))
})

it('rechaza valores nuevos que no se pueden representar sin pérdida',()=>{
 expect(()=>calculatedRecordBytes(undefined,{encoding:'win1252',delimiter:';',eol:'\n'},['🐾'],[null],true)).toThrow(/codificación/)
 expect(()=>calculatedRecordBytes(undefined,{encoding:'utf8',delimiter:',',eol:'\n'},['\uD800'],[null],true)).toThrow(/codificación/)
})

it('evita que un valor U+FEFF al comienzo se interprete como BOM',()=>{
 const format={encoding:'utf8',delimiter:',',eol:'\n'} as const
 expect(calculatedRecordBytes(undefined,format,['\uFEFFliteral'],[null],true).toString()).toBe('"\uFEFFliteral"\n')
})

it('limita el tamaño real en bytes, incluidos comillas, delimitadores y terminador',()=>{
 const format={encoding:'utf16le',delimiter:',',eol:'\r\n'} as const
 const letters='a'.repeat(1024*1024/2-2)
 expect(calculatedRecordBytes(undefined,format,[letters],[null],true)).toHaveLength(1024*1024)
 expect(()=>calculatedRecordBytes(undefined,format,[letters,','],[null,null],true)).toThrow(/1 MiB/)
})
