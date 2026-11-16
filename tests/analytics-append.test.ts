import {beforeAll,beforeEach,afterAll,expect,it,vi} from 'vitest'

const connection=vi.hoisted(()=>({
 query:vi.fn(async(_sql:string)=>({})),
 insertArrowFromIPCStream:vi.fn(async(_bytes:Uint8Array,_options:{name:string;create:boolean})=>{})
}))
vi.mock('@duckdb/duckdb-wasm',()=>({
 AsyncDuckDB:class{async instantiate(){}async open(){}async connect(){return connection}},
 VoidLogger:class{}
}))
vi.mock('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url',()=>({default:'/engine.wasm'}))
vi.mock('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url',()=>({default:'/engine.worker.js'}))

const original=Object.getOwnPropertyDescriptor(Uint8Array,'fromBase64')
// Solo admite el base64 canónico de los fixtures; la implementación nativa real se prueba en Electron.
const nativeDecode=vi.fn((input:string)=>{
 const bytes=Buffer.from(input,'base64')
 if(bytes.toString('base64')!==input)throw new SyntaxError('Fixture base64 no válido')
 return new Uint8Array(bytes)
})
beforeAll(async()=>{
 vi.stubGlobal('Worker',class{})
 vi.stubGlobal('location',{href:'https://freyalab.test/analytics.html'})
 vi.stubGlobal('freyaSQL',undefined)
 Object.defineProperty(Uint8Array,'fromBase64',{value:nativeDecode,configurable:true,writable:true})
 await import('../src/renderer/analytics')
})
beforeEach(()=>{connection.insertArrowFromIPCStream.mockClear();nativeDecode.mockClear()})
afterAll(()=>{
 if(original)Object.defineProperty(Uint8Array,'fromBase64',original)
 else Reflect.deleteProperty(Uint8Array,'fromBase64')
 vi.unstubAllGlobals()
})

function fixture(length:number){const bytes=Buffer.alloc(length);for(let index=0;index<length;index++)bytes[index]=index%256;return bytes}

it.each([0,1,2,3,255,256,257,4097])('append conserva exactamente %i bytes, incluidos 0 y 255',async length=>{
 const bytes=fixture(length)
 await globalThis.freyaSQL.append('datos',bytes.toString('base64'))
 expect(connection.insertArrowFromIPCStream).toHaveBeenCalledOnce()
 const [actual,options]=connection.insertArrowFromIPCStream.mock.calls[0]
 expect(actual).toEqual(new Uint8Array(bytes))
 expect(options).toEqual({name:'_datos',create:false})
})

it('append delega la decodificación nativa sin ejecutar un callback JavaScript por byte',async()=>{
 const input=fixture(4097).toString('base64'),from=vi.spyOn(Uint8Array,'from')
 let mappedCalls:number
 try{
  await globalThis.freyaSQL.append('datos',input)
  mappedCalls=from.mock.calls.filter(([,map])=>typeof map==='function').length
 }finally{from.mockRestore()}
 expect.soft(nativeDecode).toHaveBeenCalledOnce()
 expect(mappedCalls).toBe(0)
 expect(nativeDecode).toHaveBeenCalledWith(input)
})
