import {it,expect} from 'vitest'
import {chartOption} from '../src/renderer/chart-option'
import type {ChartData,ChartOptions} from '../src/shared/charts'

const options:ChartOptions={kind:'bar',x:0,y:1,bins:10,aggregate:'sum',descending:false,measureType:'number'}
const colors={text:'#25252b',background:'#f2f2f7',accent:'#007aff',width:900}
const data=(names:string[]):ChartData=>({total:names.length,usable:names.length,points:names.length,limited:false,columns:['x','value'],rows:names.map((name,index)=>[name,String(index+1)])})
const cities=['Oaxaca','Mérida','Puebla','Toluca','Colima']
const longNames=Array.from({length:30},(_,index)=>`Ciudad ${String(index+1).padStart(2,'0')} del Valle Verde`)

it.each([900,650])('cinco ciudades que caben usan etiquetas rectas con ancho real %s',width=>{
 expect(chartOption(data(cities),options,{...colors,width}).xAxis).toMatchObject({axisLabel:{rotate:0,fontFamily:'Inter',fontSize:12}})
})
it.each(['bar','box'] as const)('treinta nombres largos giran 25 grados en %s',kind=>{
 const values=data(longNames)
 if(kind==='box')values.rows=values.rows.map(row=>[row[0],'2','1','3','0','4','2','0','[]'])
 expect(chartOption(values,{...options,kind},colors).xAxis).toMatchObject({axisLabel:{rotate:25}})
})
it('las mismas etiquetas cambian de rotación al cambiar solo el ancho real',()=>{
 const values=data(cities)
 expect(chartOption(values,options,{...colors,width:900}).xAxis).toMatchObject({axisLabel:{rotate:0}})
 expect(chartOption(values,options,{...colors,width:200}).xAxis).toMatchObject({axisLabel:{rotate:25}})
})
it('mide glifos distintos aunque sus etiquetas tengan la misma longitud',()=>{
 const narrow=data(Array.from({length:5},(_,index)=>`iiiiiii${index}`)),wide=data(Array.from({length:5},(_,index)=>`WWWWWWW${index}`))
 expect(chartOption(narrow,options,{...colors,width:350}).xAxis).toMatchObject({axisLabel:{rotate:0}})
 expect(chartOption(wide,options,{...colors,width:350}).xAxis).toMatchObject({axisLabel:{rotate:25}})
})
it('mide las etiquetas finales truncadas y conserva la distinción de categorías iguales',()=>{
 const values=data(['Norte',...Array.from({length:4},(_,index)=>`Norte${'i'.repeat(70)}${index}`)])
 const plot=chartOption(values,options,{...colors,width:1600})
 expect(plot.xAxis).toMatchObject({data:['Norte',...values.rows.slice(1).map((row,index)=>`${index+2}. ${row[0]}`)],axisLabel:{rotate:0}})
})
it('las series cuentan categorías X distintas y no repiten sus etiquetas al medir',()=>{
 const values=data(cities);values.columns.push('series');values.rows=values.rows.flatMap(row=>[[...row,'Norte'],[...row,'Sur']]);values.points=values.rows.length
 expect(chartOption(values,{...options,series:2},{...colors,width:500}).xAxis).toMatchObject({data:cities,axisLabel:{rotate:0}})
 expect(chartOption(values,{...options,series:2},{...colors,width:200}).xAxis).toMatchObject({data:cities,axisLabel:{rotate:25}})
})
it('los intervalos del histograma y las categorías del mapa usan su texto final',()=>{
 const histogram:ChartData={total:2,usable:2,points:2,limited:false,columns:['x','value','upper'],rows:[['0','1','10'],['10','1','20']]}
 expect(chartOption(histogram,{...options,kind:'histogram'},colors).xAxis).toMatchObject({data:['[0, 10)','[10, 20]'],axisLabel:{rotate:0}})
 expect(chartOption(histogram,{...options,kind:'histogram'},{...colors,width:150}).xAxis).toMatchObject({axisLabel:{rotate:25}})
 const heat=data(cities);heat.columns.push('y');heat.rows=heat.rows.map(row=>[...row,'Grupo'])
 const plot=chartOption(heat,{...options,kind:'heatmap'},colors)
 expect(plot.xAxis).toMatchObject({data:cities,axisLabel:{rotate:0}});expect(plot.yAxis).toMatchObject({data:['Grupo']})
})
it.each(['scatter','line'] as const)('los ejes numéricos de %s no reciben rotación categórica',kind=>{
 const values=data(['1','2','3'])
 const plot=chartOption(values,{...options,kind},{...colors,width:130})
 expect(plot.xAxis).toMatchObject({type:'value'});expect(plot.xAxis).not.toHaveProperty('axisLabel.rotate')
 expect(plot.yAxis).toMatchObject({type:'value'});expect(plot.yAxis).not.toHaveProperty('axisLabel.rotate')
})
