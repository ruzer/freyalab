import {it,expect} from 'vitest'
import {chartTop} from '../src/shared/chart-pivot'
import type {ChartData,ChartOptions} from '../src/shared/charts'
const options:ChartOptions={kind:'bar',x:0,y:1,bins:10,aggregate:'sum',descending:false,measureType:'number'}
const data:ChartData={total:842,usable:842,points:842,limited:false,columns:['x','value'],rows:Array.from({length:842},(_,i)=>['G'+i,String(i+1)])}
it('representa los diez mayores y Otros, manteniendo todas las filas fuente',()=>{
 const before=structuredClone(data),result=chartTop(data,options,[])
 expect(data).toEqual(before);expect(result.groups).toBe(842);expect(result.other).toBe(true)
 expect(result.data.rows.slice(0,2)).toEqual([['G841','842'],['G840','841']])
 expect(result.data.rows).toHaveLength(11);expect(result.data.rows[10]).toEqual(['Otros','346528'])
})
it.each(['average','median','min','max'] as const)('no inventa Otros con %s y usa total recalculado para ordenar',aggregate=>{
 const totals=data.rows.map(row=>({grand:'2',x:row[0],value:row[0]==='G0'?'9999':row[1]}))
 const result=chartTop(data,{...options,aggregate},totals)
 expect(result.other).toBe(false);expect(result.data.rows).toHaveLength(10);expect(result.data.rows[0][0]).toBe('G0')
})
it('nunca calcula Otros si el motor ha truncado el resultado',()=>{
 const limited={...data,limited:true,rows:data.rows.slice(0,100)}
 const result=chartTop(limited,options,[])
 expect(result.other).toBe(false);expect(result.groups).toBe(842);expect(result.data.rows).toHaveLength(10)
})
it.each(['line','scatter','histogram','box'] as const)('no aplica Top10 a %s',kind=>{
 const result=chartTop(data,{...options,kind},[]);expect(result.top).toBe(false);expect(result.data).toBe(data)
})
it('Otros conserva cada serie y suma decimales sin redondeos binarios',()=>{
 const rows=Array.from({length:12},(_,i)=>[['G'+i,'0.1','Web'],['G'+i,'0.2','Tienda']]).flat()
 const result=chartTop({...data,points:24,rows,columns:['x','value','series']},{...options,series:2},[])
 expect(result.groups).toBe(12)
 expect(result.data.rows.slice(-2)).toEqual([['Otros','0.2','Web'],['Otros','0.4','Tienda']])
})
it('mapa conserva combinaciones y distingue ausencia, vacío y nombre Otros',()=>{
 const rows=Array.from({length:12},(_,i)=>[i===0?null:i===1?'':i===2?'Otros':'G'+i,String(i+1),'A'])
 const result=chartTop({...data,points:12,rows,columns:['x','value','y']},{...options,kind:'heatmap',aggregate:'count'},[])
 expect(result.other).toBe(true);expect(result.data.rows.at(-1)).toEqual(['Otros (2)','3','A'])
 expect(rows[0][0]).toBeNull();expect(rows[1][0]).toBe('')
})
it('un grupo sin medida no se trata como cero al ordenar valores negativos',()=>{
 const rows=Array.from({length:12},(_,i)=>['G'+i,i<10?null:String(-(i-9))])
 const result=chartTop({...data,points:12,rows},options,[])
 expect(result.data.rows.slice(0,2)).toEqual([['G10','-1'],['G11','-2']])
 expect(result.data.rows.at(-1)?.[1]).toBeNull()
})
it('no suma promedios por serie si no recibió el total recalculado del motor',()=>{
 const rows=Array.from({length:12},(_,i)=>[['G'+i,'10','A'],['G'+i,'20','B']]).flat(),input={...data,points:24,rows,columns:['x','value','series']}
 expect(chartTop(input,{...options,aggregate:'average',series:2},[])).toMatchObject({top:false,other:false,data:input})
})
