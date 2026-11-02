import {it,expect} from 'vitest'
import {addToZone,removeFromZone,swapZones,zoneFields,recommendedZone,initialChart,fieldGroup} from '../src/shared/chart-fields'
import {chartSQL,type ChartOptions} from '../src/shared/charts'
import type {ChartColumn} from '../src/shared/chart-suggest'
const columns:ChartColumn[]=['Región','Canal','Ventas','Fecha','ID'].map((name,column)=>({name,column,profile:{kind:(['category','category','number','date','identifier'] as const)[column],dates:0,invalidDates:0,unsafeIntegers:0,identifierZeros:0,headerHint:false,distinctNonEmpty:3}}))
const empty:ChartOptions={kind:'bar',x:-1,y:-1,bins:10,aggregate:'count',descending:false,measureType:'text',series:-1,time:'none'}
it('arranca con primera categoría y primer número, reutilizando la sugerencia',()=>{
 const result=initialChart(columns)!
 expect(result).toMatchObject({kind:'bar',x:0,y:2,aggregate:'sum',measureType:'number'})
 expect(chartSQL(columns.map(c=>c.name),result)).toContain('SUM(ny)')
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
 expect(addToZone(initialChart(columns)!,'rows',3,columns)).toMatchObject({x:3,kind:'line',time:'month'})
})
it('quitar Filas o Valores deja explícitamente la zona vacía',()=>{
 const start=initialChart(columns)!
 expect(zoneFields(removeFromZone(start,'rows')).rows).toBe(-1)
 expect(zoneFields(removeFromZone(start,'values')).values).toBe(-2)
})
it('intercambia dimensiones manteniendo cálculo y medida',()=>{
 const start=addToZone(initialChart(columns)!,'columns',1,columns)
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
 const start=addToZone(initialChart(more)!,'rows',5,more)
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
 expect(initialChart(reordered)).toMatchObject({x:1,y:2,aggregate:'sum'})
})
