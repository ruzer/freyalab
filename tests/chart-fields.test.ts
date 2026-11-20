import {it,expect} from 'vitest'
import {addToZone,removeFromZone,swapZones,zoneFields,recommendedZone,initialChart,fieldGroup,projectChartKind,chartKindUnavailable} from '../src/shared/chart-fields'
import {chartSQL,type ChartOptions} from '../src/shared/charts'
import type {ChartColumn} from '../src/shared/chart-suggest'
const columns:ChartColumn[]=['Región','Canal','Ventas','Fecha','ID'].map((name,column)=>({name,column,profile:{kind:(['category','category','number','date','identifier'] as const)[column],dates:0,invalidDates:0,unsafeIntegers:0,identifierZeros:0,headerHint:false,distinctNonEmpty:3}}))
const empty:ChartOptions={kind:'bar',x:-1,y:-1,bins:10,aggregate:'count',descending:false,measureType:'text',series:-1,time:'none'}
const chosen:ChartOptions={...empty,x:0,y:2,aggregate:'sum',measureType:'number'}
it('SIM-1d: arranca contando la primera categoría sin elegir una medida numérica',()=>{
 const result=initialChart(columns)!
 expect(result).toMatchObject({kind:'bar',x:0,y:-1,aggregate:'count',measureType:'text'})
 expect(chartSQL(columns.map(c=>c.name),result)).toContain('COUNT(*)')
 expect(chartSQL(columns.map(c=>c.name),result)).not.toContain('SUM(ny)')
})
it.each(['rows','columns','values'] as const)('reemplaza %s sin modificar las opciones de entrada',zone=>{
 const start=initialChart(columns)!,before=structuredClone(start)
 const result=addToZone(start,zone,zone==='values'?4:1,columns)
 expect(start).toEqual(before)
 expect(zoneFields(result)[zone]).toBe(zone==='values'?4:1)
 expect(()=>chartSQL(columns.map(c=>c.name),result)).not.toThrow()
})
it('texto en Valores cuenta, no suma identificadores con ceros',()=>{
 expect(addToZone(initialChart(columns)!,'values',4,columns)).toMatchObject({y:4,aggregate:'count',measureType:'text'})
})
it('fecha en Filas con medida numérica sugiere líneas mensuales',()=>{
 expect(addToZone(chosen,'rows',3,columns)).toMatchObject({x:3,y:2,kind:'line',time:'month',aggregate:'sum'})
})
it('quitar Filas o Valores deja explícitamente la zona vacía',()=>{
 const start=initialChart(columns)!
 expect(zoneFields(removeFromZone(start,'rows')).rows).toBe(-1)
 expect(zoneFields(removeFromZone(start,'values')).values).toBe(-2)
})
it('intercambia dimensiones manteniendo cálculo y medida',()=>{
 const start=addToZone(chosen,'columns',1,columns)
 expect(swapZones(start)).toMatchObject({x:1,series:0,y:2,aggregate:'sum'})
 expect(swapZones(swapZones(start))).toEqual(start)
})
it.each([[2,'values'],[0,'rows'],[3,'rows'],[4,'rows']] as const)('recomienda destino del campo %s', (index,zone)=>{
 expect(recommendedZone(columns[index],empty)).toBe(zone)
})
it('categoría propone Columnas si Filas ya está ocupado; Fecha conserva Filas',()=>{
 expect(recommendedZone(columns[1],initialChart(columns)!)).toBe('columns')
 expect(recommendedZone(columns[3],initialChart(columns)!)).toBe('rows')
})
it('clasifica con el perfil existente, sin detector nuevo',()=>{
 expect(columns.map(fieldGroup)).toEqual(['category','category','number','date','text'])
})
it('sin columnas no inventa configuración',()=>expect(initialChart([])).toBeNull())
it('200 campos y encabezados Unicode o repetidos siguen siendo distintos por posición',()=>{
 const many=Array.from({length:200},(_,column)=>({...columns[column%columns.length],column,name:column%2?'«País» "x"':'重复'}))
 const start=initialChart(many)!
 for(const column of [0,99,199])for(const zone of ['rows','columns','values'] as const){
  const next=addToZone(start,zone,column,many)
  expect(()=>chartSQL(many.map(c=>c.name),next)).not.toThrow()
 }
})
it('números en ambos ejes dan dispersión sin agregarlos',()=>{
 const more=[...columns,{...columns[2],column:5,name:'Unidades'}]
 const start=addToZone(chosen,'rows',5,more)
 expect(start).toMatchObject({kind:'scatter',x:5,y:2})
 expect(chartSQL(more.map(c=>c.name),start)).not.toContain('SUM(ny)')
})
it('perfil ausente o vacío no permite una suma automática',()=>{
 for(const profile of [undefined,{...columns[2].profile!,kind:'empty' as const}]){
  const unknown=[{column:0,name:'Identificador',profile}]
  expect(initialChart(unknown)).toMatchObject({aggregate:'count',measureType:'text'})
 }
})
it('rechaza un índice de campo que no existe sin tocar configuración',()=>{
 expect(()=>addToZone(empty,'values',200,columns)).toThrow('Campo no disponible')
 expect(empty.x).toBe(-1)
})
it('cambiar Filas conserva un Valor textual como Cuenta, no lo mueve a Columnas',()=>{
 const text=addToZone(initialChart(columns)!,'values',4,columns)
 expect(addToZone(text,'rows',1,columns)).toMatchObject({kind:'bar',x:1,y:4,aggregate:'count',measureType:'text',series:-1})
})
it('el arranque prefiere una categoría real antes que un identificador',()=>{
 const reordered=[columns[4],columns[0],columns[2]].map((field,column)=>({...field,column}))
 expect(initialChart(reordered)).toMatchObject({x:1,y:-1,aggregate:'count',measureType:'text'})
})
it('intercambiar una fecha agrupada por una categoría conserva valores sin agrupar texto como fecha',()=>{
 const dated=addToZone(addToZone(chosen,'rows',3,columns),'columns',1,columns)
 expect(swapZones(dated)).toMatchObject({kind:'bar',time:'none',x:1,series:3,y:2,aggregate:'sum'})
})
it('Filas de un mapa puede ser fecha, contada como etiqueta, sin agrupación temporal inválida',()=>{
 const heat={...chosen,kind:'heatmap' as const,aggregate:'count' as const}
 const result=addToZone(heat,'rows',3,columns)
 expect(result.time).toBe('none');expect(()=>chartSQL(columns.map(c=>c.name),result)).not.toThrow()
})
it.each(['category','text'] as const)('SIM-1d: añadir el primer Valor numérico a %s propone Promedio',kind=>{
 const fields=columns.map(field=>field.column===0?{...field,profile:{...field.profile!,kind}}:field)
 const before={...empty,x:0},result=addToZone(before,'values',2,fields)
 expect(result).toMatchObject({kind:'bar',x:0,y:2,aggregate:'average',measureType:'number',time:'none'})
 expect(chartSQL(fields.map(field=>field.name),result)).toContain('AVG(ny)')
 expect(before).toEqual({...empty,x:0})
})
it('SIM-1d: añadir un Valor numérico a Fecha conserva Suma mensual',()=>{
 expect(addToZone({...empty,x:3},'values',2,columns)).toMatchObject({kind:'line',x:3,y:2,aggregate:'sum',measureType:'number',time:'month'})
})
it('SIM-1d: sin categoría ni texto el arranque de Fecha y número conserva Suma mensual',()=>{
 expect(initialChart([columns[3],columns[2]])).toMatchObject({kind:'line',x:3,y:2,aggregate:'sum',measureType:'number',time:'month'})
})
it('SIM-1d: añadir dos campos numéricos conserva Suma y las observaciones sin agregar',()=>{
 const more=[...columns,{...columns[2],column:5,name:'Unidades'}]
 const result=addToZone({...empty,x:2},'values',5,more)
 expect(result).toMatchObject({kind:'scatter',x:2,y:5,aggregate:'sum',measureType:'number'})
 const sql=chartSQL(more.map(field=>field.name),result)
 expect(sql).not.toContain('SUM(ny)');expect(sql).not.toContain('AVG(ny)');expect(sql).not.toContain('GROUP BY')
})
it('SIM-1d: Valores antes que Filas propone Promedio desde el histograma y conserva una Suma ya elegida',()=>{
 const histogram=addToZone(empty,'values',2,columns)
 expect(histogram).toMatchObject({kind:'histogram',x:2,y:2,aggregate:'sum'})
 expect(addToZone(histogram,'rows',0,columns)).toMatchObject({kind:'bar',x:0,y:2,aggregate:'average'})
 expect(addToZone({...histogram,kind:'bar'},'rows',0,columns)).toMatchObject({kind:'bar',x:0,y:2,aggregate:'sum'})
 expect(histogram).toMatchObject({kind:'histogram',x:2,y:2,aggregate:'sum'})
})
it.each(['sum','average','median'] as const)('SIM-1d: cambiar Filas o Columnas conserva el cálculo explícito %s',aggregate=>{
 const before={...chosen,aggregate}
 for(const zone of ['rows','columns'] as const){
  const result=addToZone(before,zone,1,columns)
  expect(result.aggregate).toBe(aggregate);expect(result.y).toBe(2)
  expect(()=>chartSQL(columns.map(field=>field.name),result)).not.toThrow()
 }
 expect(before).toEqual({...chosen,aggregate})
})
it.each([{row:0,aggregate:'average'},{row:3,aggregate:'sum'}] as const)('SIM-1d: reemplazar Valores en Filas $row conserva el reinicio de cálculo con $aggregate',({row,aggregate})=>{
 const more=[...columns,{...columns[2],column:5,name:'Unidades'}]
 expect(addToZone({...chosen,x:row,aggregate:'max'},'values',5,more)).toMatchObject({x:row,y:5,aggregate,measureType:'number'})
})
it('SIM-2c: Ciudad y Edad ofrecen cuatro tipos; Líneas y Dispersión requieren los perfiles compatibles',()=>{
 const fields:ChartColumn[]=[{...columns[0],name:'Ciudad',profile:{...columns[0].profile!,kind:'text'}},{...columns[2],column:1,name:'Edad'}]
 const headers=fields.map(field=>field.name),options:ChartOptions={...chosen,y:1,aggregate:'average'}
 const kinds=['bar','line','scatter','histogram','heatmap','box'] as const
 expect(kinds.map(kind=>chartKindUnavailable(headers,options,kind,fields,options))).toEqual([
  null,'charts.kind.unavailable.line','charts.kind.unavailable.scatter',null,null,null
 ])
 // La nueva elegibilidad es del botón: el motor manual sigue construyendo los seis SQL.
 for(const kind of kinds)expect(()=>chartSQL(headers,projectChartKind(options,kind,fields,options))).not.toThrow()
})
it('SIM-2c: sin perfiles se conserva el fallback manual y se rechaza una selección estructuralmente vacía',()=>{
 const fields=columns.map(({column,name})=>({column,name})),headers=fields.map(field=>field.name)
 for(const kind of ['line','scatter'] as const){
  expect(chartKindUnavailable(headers,chosen,kind,fields,null)).toBeNull()
  expect(()=>chartSQL(headers,projectChartKind(chosen,kind,fields,null))).not.toThrow()
  expect(chartKindUnavailable(headers,{...chosen,y:-2},kind,fields,null)).toBe('charts.kind.unavailable.'+kind)
 }
})
it('SIM-2c: un identificador conocido no se convierte en eje numérico al consultar los tipos',()=>{
 const before=structuredClone(columns),options={...chosen,x:4},headers=columns.map(field=>field.name)
 expect(chartKindUnavailable(headers,options,'bar',columns,null)).toBeNull()
 for(const kind of ['line','scatter'] as const)expect(chartKindUnavailable(headers,options,kind,columns,null)).toBe('charts.kind.unavailable.'+kind)
 expect(columns).toEqual(before)
 expect(options).toEqual({...chosen,x:4})
 expect(recommendedZone(columns[4],empty)).toBe('rows')
})
it('SIM-2c: proyectar Líneas conserva título, orden y medida, sin mutar la selección de fecha',()=>{
 const options=Object.freeze({...chosen,x:3,bins:7,descending:true,title:'Informe propio',trend:true}),before={...options}
 const result=projectChartKind(options,'line',columns,{...options,kind:'line',time:'month'})
 expect(options).toEqual(before);expect(result).not.toBe(options)
 expect(result).toMatchObject({title:'Informe propio',descending:true,bins:7,x:3,y:2,aggregate:'sum',measureType:'number',trend:true})
 const sql=chartSQL(columns.map(field=>field.name),result)
 expect(sql).toContain("date_trunc('month',dx)");expect(sql).toContain('SUM(ny)')
})
it('SIM-2c: proyectar Dispersión conserva observaciones y tendencia sin agregar ni mutar el origen',()=>{
 const fields=[...columns,{...columns[2],column:5,name:'Unidades'}]
 const options=Object.freeze({...chosen,x:2,y:5,time:'month' as const,title:'Relación propia',trend:true,descending:true}),before={...options}
 const result=projectChartKind(options,'scatter',fields,null)
 expect(options).toEqual(before);expect(result).not.toBe(options)
 expect(result).toMatchObject({x:2,y:5,title:'Relación propia',trend:true,descending:true})
 const sql=chartSQL(fields.map(field=>field.name),result)
 expect(sql).toContain('regr_count(ny,nx) AS trend_n')
 expect(sql).toContain('nx IS NOT NULL AND ny IS NOT NULL')
 expect(sql).not.toContain('GROUP BY');expect(sql).not.toContain('SUM(ny)');expect(sql).not.toContain('AVG(ny)')
})
