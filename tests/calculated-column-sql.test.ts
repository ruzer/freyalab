import {afterAll,beforeAll,expect,it} from 'vitest'
import {createRequire} from 'node:module'
import {TokenType} from '@duckdb/duckdb-wasm'
import {createDuckDB,NODE_RUNTIME,VoidLogger,type DuckDBConnection} from '@duckdb/duckdb-wasm/blocking'
import {calculationProjection,calculationResult,type CalculationColumn} from '../src/renderer/calculated-column-sql'
import {readCalculationError} from '../src/shared/calculated-column'

const req=createRequire(import.meta.url)
const columns:CalculationColumn[]=[
 {index:2,name:'Precio unitario',read:'number',scale:2},
 {index:7,name:'Cantidad',read:'number',scale:0},
 {index:8,name:'Fecha',read:'date'},
 {index:9,name:'Descripción',read:'text'},
 {index:11,name:'datos',read:'text'},
 {index:12,name:'SELECT "; costo',read:'text'},
 {index:13,name:'repeat',read:'text'}
]
let connection:DuckDBConnection,tokenize:Awaited<ReturnType<typeof createDuckDB>>['tokenize'],close:()=>void
beforeAll(async()=>{
 const db=await createDuckDB({
  mvp:{mainModule:req.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'),mainWorker:req.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs')},
  eh:{mainModule:req.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm'),mainWorker:req.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-eh.worker.cjs')}
 },new VoidLogger(),NODE_RUNTIME)
 await db.instantiate();db.open({});connection=db.connect();tokenize=db.tokenize.bind(db);close=()=>{connection.close();db.reset()}
 connection.query(`CREATE TABLE datos (id VARCHAR,"Precio unitario" VARCHAR,Cantidad VARCHAR,Fecha VARCHAR,"Descripción" VARCHAR,datos VARCHAR,"SELECT ""; costo" VARCHAR,repeat VARCHAR);
 INSERT INTO datos VALUES ('1','10.10','3',' 2026-01-05\t\u00a0','Café','visible','privado','columna'),('2','0.1','3','2026-01-05 extra','té',NULL,NULL,NULL),('3','','','2026-02-30','',NULL,NULL,NULL),('4','0.01','0',NULL,'sin fecha',NULL,NULL,NULL)`)
 for(const sql of ["SET enable_external_access=false","SET autoload_known_extensions=false","SET autoinstall_known_extensions=false","SET lock_configuration=true"])connection.query(sql)
})
afterAll(()=>close?.())

function calculate(expression:string,read=columns){
 connection.query('BEGIN TRANSACTION READ ONLY')
 try{
  const input=calculationProjection(expression,tokenize(expression),read,'id')
  const prepared=connection.prepare(input);prepared.close()
  const schema=connection.query('DESCRIBE '+input)
  const values=connection.query(calculationResult(input,String(schema.getChild('column_type')!.get(1)),read))
  return [...values].map(row=>({rowId:row.freya_row,value:row.freya_output,failed:!!row.freya_failed,
   invalid:read.filter(column=>column.read!=='text'&&row['freya_invalid_'+column.index]).map(column=>column.index)}))
 }finally{connection.query('ROLLBACK')}
}

it('mantiene exactamente el texto decimal, los nulos válidos y el índice original de las lecturas',()=>{
 expect(calculate('"Precio unitario" * Cantidad')).toEqual([
  {rowId:'1',value:'30.30',failed:false,invalid:[]},
  {rowId:'2',value:'0.30',failed:false,invalid:[8]},
  {rowId:'3',value:null,failed:false,invalid:[2,7,8]},
  {rowId:'4',value:'0.00',failed:false,invalid:[8]}
 ])
 expect(calculate('CAST(9007199254740993 AS HUGEINT)',[])[0].value).toBe('9007199254740993')
 expect(calculate('round("Precio unitario" * Cantidad, 2)')[0].value).toBe('30.30')
 expect(calculate('coalesce("Precio unitario", 0)')[2].value).toBe('0.00')
})
it('distingue error de evaluación, infinito y NULL intencional',()=>{
 expect(calculate("CAST(Descripción AS INTEGER)")[0]).toMatchObject({value:null,failed:true})
 expect(calculate('1 / Cantidad').at(-1)).toMatchObject({value:null,failed:true})
 expect(calculate('NULL',[])[0]).toMatchObject({value:null,failed:false})
 expect(calculate('1e-8',[])[0].value).toBe('0.00000001')
 expect(calculate('1e+308',[])[0].value).toBe('1'+'0'.repeat(308))
 expect(calculate('Cantidad / Cantidad * 100')[0].value).toBe('100.0')
})
it('acepta fecha ISO real, booleanos, condiciones y texto que parece una sentencia',()=>{
 expect(calculate('Fecha').map(row=>row.value)).toEqual(['2026-01-05',null,null,null])
 expect(calculate('EXTRACT(YEAR FROM Fecha)')[0].value).toBe('2026')
 expect(calculate('month(Fecha)')[0].value).toBe('1')
 expect(calculate('Cantidad > 0')[0].value).toBe('true')
 expect(calculate(`if((Cantidad > 1), "Descripción" || '; SELECT 1 --', 'no')`)[0].value).toBe('Café; SELECT 1 --')
 expect(calculate('"SELECT ""; costo"')[0].value).toBe('privado')
})
it.each(['Cantidad); SELECT 1; --','(SELECT 1)','Cantidad IN (VALUES(1))','Cantidad) FROM datos UNION ALL SELECT (1',
 'Cantidad) --\nFROM datos UNION ALL SELECT (1','Cantidad); INSTALL httpfs; --','(FROM datos)','CAST((FROM datos) AS VARCHAR)',
 "read_csv('/archivo.csv')","CAST(\"read_blob\"('/archivo.csv') AS VARCHAR)","TRY_CAST(read_csv('https://invalid.invalid') AS VARCHAR)",
 'sum(Cantidad)','avg(Cantidad) OVER ()','unnest([1,2])','[1,2]',"current_setting('memory_limit')","\"current_setting\"('memory_limit')",
 'CURRENT_USER','duckdb_settings()','id','datos.Cantidad','main.round(Cantidad, 1)'])('bloquea %s antes de devolver un resultado',expression=>{
 expect(()=>calculate(expression)).toThrow()
})
it('el modo de solo lectura permanece bloqueado después de rechazar fórmulas',()=>{
 expect(connection.query("SELECT current_setting('enable_external_access') AS enabled").getChild('enabled')!.get(0)).toBe(false)
 expect(()=>connection.query('SET enable_external_access=true')).toThrow()
 expect(connection.query('SELECT COUNT(*) AS n FROM datos').getChild('n')!.get(0)).toBe(4n)
})
it('un comentario no permite llamar a funciones excluidas con el mismo nombre que una columna',()=>{
 expect(calculate('"repeat"')[0].value).toBe('columna')
 for(const expression of ["repeat /* nota */ ('x', 3)",'"repeat" -- nota\n (\'x\', 3)']){
  expect(connection.query('SELECT ('+expression+') AS valor').getChild('valor')!.get(0)).toBe('xxx')
  expect(()=>calculate(expression)).toThrow()
 }
 // El tokenizador instalado adjunta el comentario al token anterior. Verifica también
 // el formato público con token COMMENT separado para que no oculte el paréntesis.
 const expression="repeat /* nota */ ('x', 3)",tokens=tokenize(expression)
 tokens.offsets.splice(1,0,expression.indexOf('/*'))
 tokens.types.splice(1,0,TokenType.COMMENT)
 expect(()=>calculationProjection(expression,tokens,columns,'id')).toThrow()
})
it('comunica una columna inexistente sin perder los caracteres del nombre',()=>{
 let failure
 try{calculate('"Columna café"')}catch(error){failure=readCalculationError(error)}
 expect(failure).toMatchObject({code:'unknownColumn',column:'Columna café'})
})
