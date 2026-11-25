import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest'
import {createRequire} from 'node:module'
import {createDuckDB,NODE_RUNTIME,VoidLogger,type DuckDBConnection} from '@duckdb/duckdb-wasm/blocking'
import {linearRegression,linearRegressionLine,rSquared,sampleCorrelation} from 'simple-statistics'
import {chartSQL,chartData,type ChartOptions} from '../src/shared/charts'
import {chartTrendLine,chartTrendText} from '../src/shared/chart-trend'
import * as chartTrend from '../src/shared/chart-trend'
import {setLanguage} from '../src/shared/i18n'

let connection:DuckDBConnection,close:()=>void
const headers=['X','Y'],options:ChartOptions={kind:'scatter',x:0,y:1,bins:10,aggregate:'count',descending:false,measureType:'number',series:-1,trend:true}
beforeAll(async()=>{
 const require=createRequire(import.meta.url),db=await createDuckDB({mvp:{mainModule:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'),mainWorker:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs')},eh:{mainModule:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm'),mainWorker:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-eh.worker.cjs')}},new VoidLogger(),NODE_RUNTIME)
 await db.instantiate();db.open({});connection=db.connect();close=()=>{connection.close();db.reset()}
 connection.query('CREATE TABLE datos ("X" VARCHAR,"Y" VARCHAR)')
})
afterAll(()=>close?.())
beforeEach(()=>{connection.query('DELETE FROM datos')})
function analyze(config=options){
 const table=connection.query(chartSQL(headers,config)),columns=table.schema.fields.map(field=>field.name)
 return chartData('scatter',columns,table.toArray().map(row=>columns.map(column=>row[column]===null?null:String(row[column]))))
}
it('calcula la tendencia de los cinco pares con el mismo oráculo y precisión completa',()=>{
 const pairs=[[1,2],[2,4],[3,5],[4,4],[5,5]],regression=linearRegression(pairs)
 connection.query("INSERT INTO datos VALUES ('1','2'),('2','4'),('3','5'),('4','4'),('5','5')")
 const data=analyze()
 expect(data).toMatchObject({trend:{n:5,xMin:1,xMax:5,constantY:false}})
 expect(data.trend!.slope).toBeCloseTo(regression.m,12)
 expect(data.trend!.intercept).toBeCloseTo(regression.b,12)
 expect(data.trend!.r2).toBeCloseTo(rSquared(pairs,linearRegressionLine(regression)),12)
 expect(data.trend!.r).toBeCloseTo(sampleCorrelation(pairs.map(pair=>pair[0]),pairs.map(pair=>pair[1])),12)
})

it.each([
 ['X constante',"('2','1'),('2','2'),('2','3')",{n:3,slope:null,intercept:null,r2:null,r:null,xMin:2,xMax:2,constantY:false}],
 ['Y constante',"('1','7'),('2','7'),('3','7')",{n:3,slope:0,intercept:7,r2:null,r:null,constantY:true}],
 ['dos pares',"('1','3'),('2','5')",{n:2,slope:2,intercept:1}],
 ['sin pares',"('x','y')",{n:0,slope:null,intercept:null,r2:null,r:null,xMin:null,xMax:null,constantY:false}],
] as const)('normaliza NULL y no finitos sin inventar certeza: %s',(_name,values,expected)=>{
 connection.query('INSERT INTO datos VALUES '+values)
 expect(analyze().trend).toMatchObject(expected)
})

it('usa las mismas conversiones, exclusiones y pares completos que los puntos',()=>{
 connection.query("INSERT INTO datos VALUES ('1','2'),('2','4'),('003','6'),('4','texto'),('texto','8'),('9007199254740992','3'),('5','1,5'),('6','Infinity'),('7','NaN'),('8',NULL)")
 expect(analyze()).toMatchObject({total:10,usable:3,points:3,columns:['x','value','fila'],trend:{n:3,slope:2,intercept:0,r2:1,r:1,xMin:1,xMax:3}})
})

it('no calcula tendencia desmarcada, en otro tipo o con Separar por',()=>{
 connection.query("INSERT INTO datos VALUES ('1','2'),('2','4'),('3','6')")
 for(const config of [{...options,trend:false},{...options,kind:'line' as const},{...options,series:0}]){
  expect(chartSQL(headers,config)).not.toContain('regr_')
  expect(analyze(config)).not.toHaveProperty('trend')
 }
 expect(()=>chartSQL(headers,{...options,trend:'true' as never})).toThrow('tendencia')
})

it('compara las 300 000 filas con el oráculo completo aunque solo se dibujen 2 000',()=>{
 connection.query("INSERT INTO datos SELECT CAST(i%1000-500 AS VARCHAR), CAST(3*(i%1000-500)+1+(((i*17)%23)-11)/100.0 AS VARCHAR) FROM range(300000) t(i)")
 const pairs=Array.from({length:300000},(_,i)=>[i%1000-500,3*(i%1000-500)+1+((i*17)%23-11)/100]),regression=linearRegression(pairs),expected=rSquared(pairs,linearRegressionLine(regression)),data=analyze()
 expect(data).toMatchObject({limited:true,points:300000,trend:{n:300000,xMin:-500,xMax:499}})
 expect(data.rows).toHaveLength(2000)
 expect(data.trend!.slope).toBeCloseTo(regression.m,12)
 expect(data.trend!.r2).toBeCloseTo(expected,12)
 const drawn=data.rows.map(row=>[Number(row[0]),Number(row[1])]),drawnRegression=linearRegression(drawn)
 expect(Math.abs(data.trend!.r2!-rSquared(drawn,linearRegressionLine(drawnRegression)))).toBeGreaterThan(0.00001)
})

it.each([
 ['X constante',"('2','1'),('2','2'),('2','3')",'Todas las X son iguales',false],
 ['Y constante',"('1','7'),('2','7'),('3','7')",'Y no varía: R² no aplica',true],
 ['dos pares',"('1','3'),('2','5')",'Hacen falta al menos 3 puntos',false],
 ['sin pares',"('x','y')",'Hacen falta al menos 3 puntos',false],
] as const)('explica %s sin dibujar una recta inválida',(_name,values,message,line)=>{
 connection.query('INSERT INTO datos VALUES '+values)
 const trend=analyze().trend!
 expect(chartTrendText(trend,headers,options).join('\n')).toContain(message)
 expect(chartTrendLine(trend)).toHaveLength(line?2:0)
 if(line)expect(chartTrendLine(trend)).toEqual([[1,7],[3,7]])
})

it('redondea solo la pantalla, describe la pendiente negativa y conserva el título completo',()=>{
 connection.query("INSERT INTO datos VALUES ('1','5'),('2','4'),('3','5'),('4','4'),('5','2')")
 const trend=analyze().trend!,text=chartTrendText(trend,headers,options).join('\n'),full=chartTrendText(trend,headers,options,true).join('\n')
 expect(text).toContain('A más X, menos Y.')
 expect(text).toContain('r = -0.7746')
 expect(full).toContain(String(trend.r))
 expect(full).toContain(String(trend.r2))
})

it('una pendiente cero con Y variable describe una recta horizontal sin confundirla con Y constante',()=>{
 connection.query("INSERT INTO datos VALUES ('1','1'),('2','-2'),('3','1')")
 const trend=analyze().trend!,text=chartTrendText(trend,headers,options).join('\n')
 expect(trend).toMatchObject({slope:0,intercept:0,r2:0,r:0,constantY:false})
 expect(chartTrendLine(trend)).toEqual([[1,0],[3,0]])
 expect(text).toContain('La recta no aumenta ni disminuye Y al variar X.')
 expect(text).not.toContain('A más');expect(text).not.toContain('Y no varía')
})

it('localiza los errores nuevos de la tendencia sin cambiar el contrato anterior',()=>{
 setLanguage('en')
 try{expect(()=>chartSQL(headers,{...options,trend:'true' as never})).toThrow('trend option')}
 finally{setLanguage('es')}
})

it('SIM-3d · el texto HTML automático usa tres decimales en coeficientes y unidad de porcentaje',()=>{
 connection.query("INSERT INTO datos VALUES ('1','5'),('2','4'),('3','5'),('4','4'),('5','2')")
 const trend=analyze().trend!,before=structuredClone(trend)
 const text=chartTrendText(trend,headers,options,false,'auto').join('\n')
 expect(text).toContain('r = -0.775')
 expect(text).toContain('R² = 0.6')
 expect(text).toContain('60 %')
 expect(text).toContain('5 puntos')
 expect(trend).toEqual(before)
})

it('SIM-3d · Más precisión afecta al texto HTML sin limitar la ayuda ni el informe a quince cifras',()=>{
 connection.query("INSERT INTO datos VALUES ('1','5'),('2','4'),('3','5'),('4','4'),('5','2')")
 const trend=analyze().trend!,text=chartTrendText(trend,headers,options,false,'all').join('\n')
 expect(text).toContain('r = '+String(Number(trend.r!.toPrecision(15))))
 const full=chartTrendText(trend,headers,options,true).join('\n')
 expect(full).toContain('r = '+String(trend.r))
 expect(full).toContain('R² = '+String(trend.r2))
 expect(chartTrendText(trend,headers,options,true,'auto').join('\n')).toBe(full)
 expect(chartTrendText(trend,headers,options,true,'all').join('\n')).toBe(full)
})

it('SIM-3d · la tendencia entrega métricas crudas tipadas para marcar números y conservar texto',()=>{
 connection.query("INSERT INTO datos VALUES ('1','5'),('2','4'),('3','5'),('4','4'),('5','2')")
 const trend=analyze().trend!,fragments=Reflect.get(chartTrend,'chartTrendFragments')
 expect(fragments).toBeTypeOf('function')
 const lines=Reflect.apply(fragments,undefined,[trend,headers,options]) as {type:string;value?:number;kind?:string;unit?:string;text?:string}[][]
 expect(lines).toHaveLength(4)
 expect(lines.flat().filter(part=>part.type==='number')).toEqual([
  {type:'number',value:trend.slope,kind:'number',unit:''},
  {type:'number',value:Math.abs(trend.intercept!),kind:'number',unit:''},
  {type:'number',value:trend.r2,kind:'coefficient',unit:''},
  {type:'number',value:trend.r,kind:'coefficient',unit:''},
  {type:'number',value:trend.n,kind:'count',unit:''},
  {type:'number',value:trend.r2!*100,kind:'percent',unit:' %'},
 ])
 expect(lines[3]).toEqual([{type:'text',text:chartTrendText(trend,headers,options,true)[3]}])
 expect(lines[2].filter(part=>part.type==='text').map(part=>part.text).join('')).toContain('A más X, menos Y.')
})

it('SIM-3d · la ruta anterior del dibujo y el informe conserva su representación completa',()=>{
 connection.query("INSERT INTO datos VALUES ('1','5'),('2','4'),('3','5'),('4','4'),('5','2')")
 const trend=analyze().trend!,full=chartTrendText(trend,headers,options,true)
 expect(chartTrendText(trend,headers,options).join('\n')).toContain('r = -0.7746')
 expect(full[1]).toBe(`R² = ${String(trend.r2)} · r = ${String(trend.r)} · 5 puntos`)
 expect(full[2]).toContain(String(trend.r2!*100)+'%')
 expect(chartTrendLine(trend)).toEqual([[1,trend.slope!+trend.intercept!],[5,trend.slope!*5+trend.intercept!]])
})
