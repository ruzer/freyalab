import {it,expect} from 'vitest'
import {chartPivot} from '../src/shared/chart-pivot'
import type {ChartData,ChartOptions} from '../src/shared/charts'
const options:ChartOptions={kind:'bar',x:0,y:1,bins:10,aggregate:'sum',descending:false,measureType:'number',series:2}
const data:ChartData={columns:['x','value','series'],rows:[['A','1','Web'],['A','3','Tienda'],['B','10','Web']],total:3,usable:3,points:3,limited:false}
it('pivota celdas exactas y usa totales del motor para filas, columnas y porcentajes',()=>{
 const totals=[{grand:'2',x:'A',value:'4'},{grand:'2',x:'B',value:'10'},{grand:'0',series:'Web',value:'11'},{grand:'0',series:'Tienda',value:'3'},{grand:'1',value:'14'}]
 expect(chartPivot(data,options,totals)).toMatchObject({columns:['Web','Tienda'],additive:true,grandTotal:'14',totalValues:['11','3'],rows:[{label:'A',values:['1','3'],total:'4',percent:4/14*100},{label:'B',values:['10',null],total:'10',percent:10/14*100}]})
})
it('no suma promedios ni medianas y no muestra porcentajes no aditivos',()=>{
 for(const aggregate of ['average','median','distinct','min','max'] as const){const result=chartPivot(data,{...options,aggregate},[{grand:'1',value:'6.5'},{grand:'2',x:'A',value:'2'}]);expect(result.additive).toBe(false);expect(result.grandTotal).toBe('6.5');expect(result.rows[0].total).toBe('2');expect(result.rows[0].percent).toBeNull()}
})
it('distingue ausente y vacío, y un total cero no inventa porcentajes',()=>{
 const result=chartPivot({...data,rows:[[null,'0',''],['','0',null]]},options,[{grand:'1',value:'0'},{grand:'2',x:null,value:'0'},{grand:'2',x:'',value:'0'}])
 expect(result.columns).toEqual(['',null]);expect(result.rows.map(row=>row.label)).toEqual([null,'']);expect(result.rows.every(row=>row.percent===null)).toBe(true)
})
it('dispersión mantiene observaciones con X repetida sin unirlas ni crear totales',()=>{
 const result=chartPivot({...data,columns:['x','value'],rows:[['1','2'],['1','3']]},{...options,kind:'scatter',series:-1},[{grand:'1',value:null}]);expect(result.rows.map(row=>row.values)).toEqual([['2'],['3']]);expect(result.rows.every(row=>row.total===null)).toBe(true);expect(result.additive).toBe(false)
})
