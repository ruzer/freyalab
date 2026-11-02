import {beforeAll,afterAll,it,expect} from 'vitest'
import {createRequire} from 'node:module'
import {createDuckDB,NODE_RUNTIME,VoidLogger,type DuckDBConnection} from '@duckdb/duckdb-wasm/blocking'
import {chartSQL,chartTotalSQL,type ChartOptions} from '../src/shared/charts'
let connection:DuckDBConnection,close:()=>void
const headers=['Región','Ventas','Canal','Fecha'],options:ChartOptions={kind:'bar',x:0,y:1,bins:10,aggregate:'average',descending:false,measureType:'number',series:2,time:'none'}
beforeAll(async()=>{
 const require=createRequire(import.meta.url),db=await createDuckDB({mvp:{mainModule:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'),mainWorker:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs')},eh:{mainModule:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm'),mainWorker:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-eh.worker.cjs')}},new VoidLogger(),NODE_RUNTIME)
 await db.instantiate();db.open({});connection=db.connect();close=()=>{connection.close();db.reset()}
 connection.query(`CREATE TABLE datos ("Región" VARCHAR,"Ventas" VARCHAR,"Canal" VARCHAR,"Fecha" VARCHAR); INSERT INTO datos VALUES ('A','1','Web','2026-01-01'),('A','3','Tienda','2026-01-15'),('B','10','Web','2026-02-01'),('C','99','Web','2026-02-30')`)
})
afterAll(()=>close?.())
it('recalcula promedio global y por serie sobre los datos, no suma promedios',()=>{
 const totals=connection.query(chartTotalSQL(headers,options)).toArray()
 expect(Number(totals.find(row=>Number(row.grand)===1)?.value)).toBe(28.25)
 expect(Number(totals.find(row=>Number(row.grand)===0&&row.series==='Web')?.value)).toBeCloseTo(110/3)
 expect(connection.query(chartSQL(headers,options)).toArray().map(row=>Number(row.value))).toEqual([3,1,10,99])
})
it('recalcula cada total de fila al pivotar series, incluso promedios no aditivos',()=>{
 const rows=connection.query(chartTotalSQL(headers,options)).toArray()
 expect(Number(rows.find(row=>Number(row.grand)===2&&row.x==='A')?.value)).toBe(2)
})
it('un diagrama de dispersión no inventa una suma ni devuelve un total por cada registro',()=>{
 const rows=connection.query(chartTotalSQL(headers,{...options,kind:'scatter',x:1,y:1,series:-1})).toArray()
 expect(rows).toHaveLength(1);expect(rows[0].value).toBeNull()
})
it.each([
 ['sum',113],['average',28.25],['min',1],['max',99],['median',6.5],['count',4],['distinct',4],
] as const)('total %s equivale a la operación del formulario sobre todas las filas', (aggregate,expected)=>{
 const rows=connection.query(chartTotalSQL(headers,{...options,aggregate,series:-1})).toArray();expect(Number(rows.find(row=>Number(row.grand)===1)?.value)).toBe(expected)
})
it.each([['sum',14],['average',14/3],['median',3],['count',3]] as const)('total temporal %s excluye la fecha inválida y conserva el alcance',(aggregate,expected)=>{
 const rows=connection.query(chartTotalSQL(headers,{...options,kind:'line',x:3,time:'month',aggregate,series:-1})).toArray();expect(Number(rows.find(row=>Number(row.grand)===1)?.value)).toBeCloseTo(expected)
})
it('histograma y mapa de calor conservan frecuencias de la fuente completa',()=>{
 for(const kind of ['histogram','heatmap'] as const){const rows=connection.query(chartTotalSQL(headers,{...options,kind,series:-1})).toArray();expect(Number(rows.find(row=>Number(row.grand)===1)?.value)).toBe(4)}
})
it('los totales de un mapa de calor se limitan a las columnas visibles, conservando el total global',()=>{
 connection.query('BEGIN');try{
  connection.query("DELETE FROM datos; INSERT INTO datos SELECT 'A','1','Y'||i,'2026-01-01' FROM range(1400) t(i)")
  const config={...options,kind:'heatmap' as const,y:2,series:-1},visible=connection.query(chartSQL(headers,config)).toArray().slice(0,400),rows=connection.query(chartTotalSQL(headers,config)).toArray()
  expect(rows).toHaveLength(402);expect(Number(rows.find(row=>Number(row.grand)===1)?.value)).toBe(1400)
  expect(rows.filter(row=>Number(row.grand)===0).every(row=>visible.some(cell=>cell.y===row.series))).toBe(true)
 }finally{connection.query('ROLLBACK')}
})
