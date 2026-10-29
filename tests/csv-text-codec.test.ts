import {afterEach,expect,it} from 'vitest'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import iconv from 'iconv-lite'
import {decodeCsvText,encodeCsvText,csvTextStatistics,type CsvTextFormat} from '../src/main/csv-text-codec'
import {TableEngine} from '../src/main/table-engine'

const formats:CsvTextFormat[]=[{encoding:'utf8',bom:false},{encoding:'utf8',bom:true},{encoding:'utf16le',bom:true},{encoding:'win1252',bom:false}]
function original(text:string,format:CsvTextFormat){const body=iconv.encode(text,format.encoding,{addBOM:false}),bom=format.bom?Buffer.from(format.encoding==='utf16le'?[0xff,0xfe]:[0xef,0xbb,0xbf]):Buffer.alloc(0);return Buffer.concat([bom,body])}
const sources=[
 '00123\t"á\nñ"\n9007199254740993\tconservar',
 '00123\t"á\r\nñ"\r\n9007199254740993\tconservar\r\n',
 '00123\t"á\rñ"\r9007199254740993\tconservar',
 'id,text\r\n00123,"á\nñ"\r9007199254740993,"conservar"\n',
 '"001","Ana"',
 'id,text\n1,\uFEFFliteral\n2,"comillas ""dobles"""\n'
]
for(const format of formats)it.each(sources.filter(source=>format.encoding!=='win1252'||!source.includes('\uFEFF')))(`conserva bytes y edita sólo lo pedido (${format.encoding}, BOM ${format.bom}): %s`,source=>{
 const bytes=original(source,format),before=Buffer.from(bytes),decoded=decodeCsvText(bytes)
 const detected=format.encoding==='win1252'&&/^[\x00-\x7f]*$/.test(source)?{encoding:'utf8',bom:false}:format
 expect(decoded).toEqual({text:source,format:detected,readonly:false})
 expect(encodeCsvText(decoded.text,decoded.format)).toEqual(bytes)
 const edited=source.replace(/conservar|Ana|literal/,'editado')
 expect(encodeCsvText(edited,decoded.format)).toEqual(original(edited,format))
 expect(bytes).toEqual(before)
})

it.each([{encoding:'utf8',bom:true},{encoding:'utf16le',bom:true}] as const)('retira sólo la firma exterior y conserva otro U+FEFF ($encoding)',format=>{
 const source='\uFEFFid,text\n1,\uFEFFdato\n',bytes=original(source,format),decoded=decodeCsvText(bytes)
 expect(decoded).toEqual({text:source,format,readonly:false});expect(encodeCsvText(decoded.text,decoded.format)).toEqual(bytes)
})

it.each([{encoding:'utf8',bom:false},{encoding:'utf16le',bom:true}] as const)('conserva U+FFFD literal válido en $encoding sin volverlo solo lectura',format=>{
 const source='id,text\r\n1,\uFFFDliteral\n',bytes=original(source,format),decoded=decodeCsvText(bytes)
 expect(decoded).toEqual({text:source,format,readonly:false});expect(encodeCsvText(decoded.text,decoded.format)).toEqual(bytes)
})

it.each(formats)('conserva un archivo vacío ($encoding, BOM $bom)',format=>{
 const bytes=original('',format),decoded=decodeCsvText(bytes)
 expect(decoded.text).toBe('');expect(decoded.readonly).toBe(false);expect(encodeCsvText(decoded.text,decoded.format)).toEqual(bytes)
})

it.each([0x81,0x8d,0x8f,0x90,0x9d])('abre el byte Windows-1252 indefinido %i en solo lectura',byte=>{
 const decoded=decodeCsvText(Buffer.from([0x41,0x0a,byte,0x0a]))
 expect(decoded.format).toEqual({encoding:'win1252',bom:false});expect(decoded.readonly).toBe(true);expect(decoded.warning).toMatch(/solo lectura/i)
 expect(()=>encodeCsvText(decoded.text,decoded.format)).toThrow(/línea 2/)
})

it('detecta con el mismo prefijo y permite una secuencia UTF-8 incompleta al borde del prefijo',()=>{
 const prefix=1024*1024+4,bytes=Buffer.concat([Buffer.alloc(prefix-1,0x61),Buffer.from('€\n')]),decoded=decodeCsvText(bytes)
 expect(decoded.format).toEqual({encoding:'utf8',bom:false});expect(decoded.readonly).toBe(false);expect(encodeCsvText(decoded.text,decoded.format)).toEqual(bytes)
})

it('no cambia a Windows-1252 por bytes inválidos posteriores al prefijo; protege el original',()=>{
 const bytes=Buffer.concat([Buffer.alloc(1024*1024+4,0x61),Buffer.from([0xff])]),decoded=decodeCsvText(bytes)
 expect(decoded.format).toEqual({encoding:'utf8',bom:false});expect(decoded.readonly).toBe(true);expect(decoded.warning).toMatch(/solo lectura/i)
})

it.each([Buffer.from([0xe2,0x82]),Buffer.from([0xff,0xfe,0x61,0x00,0x62])])('protege una secuencia truncada sin reemplazo silencioso: %j',bytes=>{
 const before=Buffer.from(bytes),decoded=decodeCsvText(bytes)
 expect(decoded.readonly).toBe(true);expect(decoded.warning).toMatch(/solo lectura/i);expect(bytes).toEqual(before)
})

it('el fallback de un byte inválido UTF-8 representable sigue siendo Windows-1252 editable',()=>{
 const bytes=Buffer.from([0x41,0x0a,0xff,0x0a]),decoded=decodeCsvText(bytes)
 expect(decoded).toEqual({text:'A\nÿ\n',format:{encoding:'win1252',bom:false},readonly:false});expect(encodeCsvText(decoded.text,decoded.format)).toEqual(bytes)
})

it.each([
 {text:'primera\r\nsegunda\rtercera\ncuarta😀',line:4},
 {text:'primera\r\nsegunda😀',line:2},
 {text:'primera\rsegunda😀',line:2}
])('rechaza un carácter no representable indicando la línea física $line',({text,line})=>{
 expect(()=>encodeCsvText(text,{encoding:'win1252',bom:false})).toThrow(new RegExp(`línea ${line}`))
})

it('rechaza sustitución UTF-8 de un surrogate aislado con su línea física',()=>{
 expect(()=>encodeCsvText('primera\r\nsegunda\r\uD800',{encoding:'utf8',bom:true})).toThrow(/línea 3/)
})

it('rechaza un BOM que Windows-1252 no puede representar como firma',()=>{
 expect(()=>encodeCsvText('texto',{encoding:'win1252',bom:true})).toThrow(/BOM/)
})

it.each([
 {text:'',eol:'none',lines:1},
 {text:'sin salto',eol:'none',lines:1},
 {text:'a\nb\n',eol:'LF',lines:3},
 {text:'a\r\nb',eol:'CRLF',lines:2},
 {text:'a\rb\r',eol:'CR',lines:3},
 {text:'a\r\nb\rc\nd',eol:'mixed',lines:4},
 {text:'a\r\n\n\r',eol:'mixed',lines:4}
])('cuenta líneas físicas y terminadores: $eol / $lines',({text,eol,lines})=>expect(csvTextStatistics(text)).toEqual({eol,lines}))

const folders:string[]=[]
afterEach(async()=>{for(const folder of folders.splice(0))await rm(folder,{recursive:true,force:true})})
it.each(formats)('comparte detección con TableEngine real ($encoding, BOM $bom)',async format=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-text-codec-'));folders.push(folder)
 const path=join(folder,'valid.csv'),bytes=original('id,text\r\n00123,"á\nñ"\r9007199254740993,conservar\n',format);await writeFile(path,bytes)
 const engine=new TableEngine()
 try{const info=await engine.open('codec-parity',path);expect(decodeCsvText(bytes).format.encoding).toBe(info.encoding);expect(info.encoding).toBe(format.encoding);expect(await readFile(path)).toEqual(bytes)}finally{await engine.close('codec-parity')}
})
