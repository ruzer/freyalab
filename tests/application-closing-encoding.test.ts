import {afterEach,expect,it,vi} from 'vitest'
import {ApplicationClosing} from '../src/renderer/lib/application-closing'
import {decodeCsvText,encodeCsvText,csvTextByteLength} from '../src/main/csv-text-codec'
import {setLanguage} from '../src/shared/i18n'
const MiB=1024*1024,id='12345678-1234-4234-8234-123456789abc'
afterEach(()=>setLanguage('es'))
for(const encoding of ['win1252','utf16le'] as const)it(`el cierre respeta los bytes canónicos de CSVTexto ${encoding}, sin convertirlo aUTF8`,async()=>{
 setLanguage('es')
 const source=encodeCsvText(encoding==='win1252'?'é'.repeat(6*MiB):'id,nombre\n1,base\n',{encoding,bom:encoding==='utf16le'}),decoded=decodeCsvText(source)
 expect(decoded.readonly).toBe(false);expect(decoded.format.encoding).toBe(encoding)
 const text=encoding==='win1252'?decoded.text:'a'.repeat(6*MiB),bytes=csvTextByteLength(text,decoded.format)
 expect(encoding==='win1252'?bytes<=10*MiB:bytes>10*MiB).toBe(true)
 expect(encoding==='win1252'?new TextEncoder().encode(text).byteLength>10*MiB:new TextEncoder().encode(text).byteLength<=10*MiB).toBe(true)
 const document={id,name:'datos.csv',kind:'csv' as const,csvView:'text' as const,encoding:decoded.format.encoding,text,readonly:false},notice=vi.fn()
 // Mismo helper y error que usa Documents.updateNow; Main conserva la autoridad
 // sobre codificación+BOM. El coordinador no vuelve a calcular otro formato.
 const prepare=vi.fn(async()=>{if(bytes>10*MiB)throw new Error('El documento supera el límite de edición de 10 MiB.')})
 const flow=new ApplicationClosing({snapshot:()=>({documents:[document],activeId:id,busy:false,modal:false,composing:false}),prepare,notice,locked:()=>{}})
 try{
  expect(await flow.prepare()).toBe(encoding==='win1252');expect(prepare).toHaveBeenCalledExactlyOnceWith(id)
  if(encoding==='utf16le'){expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({kind:'error',message:expect.stringContaining('10 MiB')}));expect(notice.mock.calls.at(-1)![0].message).toContain('datos.csv');expect(notice.mock.calls.at(-1)![0].message).toContain('Recórtalo')}
  expect(document.text).toBe(text);expect(encodeCsvText(decoded.text,decoded.format).equals(source)).toBe(true)
 }finally{flow.abort()}
})

it('el rechazo previo del límite de cadena IPC conserva el aviso nombrado de10MiB',async()=>{
 setLanguage('es');const text='x'.repeat(10*MiB+1),notice=vi.fn(),document={id,name:'cadena.csv',kind:'csv' as const,csvView:'text' as const,text,readonly:false}
 const flow=new ApplicationClosing({snapshot:()=>({documents:[document],activeId:id,busy:false,modal:false,composing:false}),prepare:async()=>{throw new Error('Datos de operación no válidos.')},notice,locked:()=>{}})
 try{expect(await flow.prepare()).toBe(false);expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({kind:'error',message:expect.stringContaining('10 MiB')}));expect(notice.mock.calls.at(-1)![0].message).toContain('cadena.csv');expect(document.text).toBe(text)}finally{flow.abort()}
})
