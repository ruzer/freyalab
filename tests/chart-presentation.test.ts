import {afterEach,it,expect} from 'vitest'
import {chartOption} from '../src/renderer/chart-option'
import {chartLabels,type ChartData,type ChartOptions} from '../src/shared/charts'
import {setLanguage} from '../src/shared/i18n'
const options:ChartOptions={kind:'bar',x:0,y:1,bins:10,aggregate:'sum',descending:false,measureType:'number'}
const colors={text:'#25252b',background:'#f2f2f7',accent:'#007aff'}
afterEach(()=>setLanguage('es'))
it('muestra nombres sin numeración salvo etiquetas visualmente iguales',()=>{
 const data:ChartData={total:4,usable:4,points:4,limited:false,columns:['x','value'],rows:[['Norte','30'],['Sur','5'],[null,'1'],['(campo ausente)','2']]}
 expect(chartOption(data,options,colors).xAxis).toMatchObject({data:['Norte','Sur','3. (campo ausente)','4. (campo ausente)']})
})
it('localiza descripción y accesibilidad de las marcas en inglés sin renombrar las columnas',()=>{
 setLanguage('en')
 expect(chartLabels(['Región','Ventas'],options)).toMatchObject({summary:'Sum of Ventas by Región'})
 const data:ChartData={total:2,usable:2,points:2,limited:false,columns:['x','value'],rows:[['North','30'],['South','5']]}
 expect(chartOption(data,options,colors,['Región','Ventas'],'Whole document').aria).toMatchObject({label:{description:expect.stringContaining('Bars. Sum of Ventas by Región. Whole document.')}})
})

const luminance=(hex:string)=>{const [r,g,b]=hex.slice(1).match(/../g)!.map(pair=>{const n=parseInt(pair,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b}
it.each([false,true])('ocho series tienen contraste ≥ 3:1 y marcas con patrones; oscuro=%s',dark=>{
 const background=dark?'#202024':'#f2f2f7',accent=dark?'#308bff':'#007aff'
 const data:ChartData={total:8,usable:8,points:8,limited:false,columns:['x','value','series'],rows:Array.from({length:8},(_,i)=>['Norte',String(i),String(i)])}
 const plot=chartOption(data,{...options,series:2},{...colors,background,accent,dark})
 for(const color of plot.color as string[]){const a=luminance(color),b=luminance(background);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),color).toBeGreaterThanOrEqual(3)}
 expect(plot.aria).toMatchObject({decal:{show:true}})
})
it('el nombre de los valores atípicos de Caja también se localiza en inglés',()=>{
 setLanguage('en')
 const data:ChartData={total:6,usable:6,points:1,limited:false,columns:['x','value','q1','q3','low','high','outliers','count','atypical'],rows:[['A','2','1','3','0','4','1','6','[10]']]}
 expect(chartOption(data,{...options,kind:'box'},colors).series).toMatchObject([{type:'boxplot'},{name:'Outliers (up to 20 per group)'}])
})
it('ocho series se distinguen sin color: trazos únicos en líneas largas y símbolos en dispersión',()=>{
 const rows=Array.from({length:8},(_,group)=>Array.from({length:120},(_,i)=>[String(i),String(i+group),String(group)])).flat(),data:ChartData={total:rows.length,usable:rows.length,points:rows.length,limited:false,columns:['x','value','series'],rows}
 const lines=chartOption(data,{...options,kind:'line',series:2},colors).series as {lineStyle?:{type?:unknown}}[]
 expect(new Set(lines.map(series=>JSON.stringify(series.lineStyle?.type))).size).toBe(8)
 const points=chartOption(data,{...options,kind:'scatter',series:2},colors).series as {symbol?:string}[]
 expect(new Set(points.map(series=>series.symbol)).size).toBe(8)
})
it.each([false,true])('los números del mapa de calor contrastan con todas sus celdas; oscuro=%s',dark=>{
 const data:ChartData={total:4,usable:4,points:2,limited:false,columns:['x','value','y'],rows:[['A','1','Web'],['B','3','Tienda']]}
 const plot=chartOption(data,{...options,kind:'heatmap'},{...colors,text:dark?'#f5f5f7':colors.text,background:dark?'#202024':colors.background,accent:dark?'#308bff':colors.accent,dark})
 const [series]=plot.series as {label:{color:string}}[],map=plot.visualMap as {inRange:{color:string[]}},endpoints=map.inRange.color.map(value=>value.slice(1).match(/../g)!.map(pair=>parseInt(pair,16)))
 for(let step=0;step<=32;step++){
  const fill='#'+endpoints[0].map((v,i)=>Math.round(v+(endpoints[1][i]-v)*step/32).toString(16).padStart(2,'0')).join(''),a=luminance(series.label.color),b=luminance(fill)
  expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),fill).toBeGreaterThanOrEqual(4.5)
 }
})

it.each(['es','en','en-XA'] as const)('los ejes numéricos usan separadores del idioma de interfaz: %s',language=>{
 setLanguage(language)
 const data:ChartData={total:1,usable:1,points:1,limited:false,columns:['x','value'],rows:[['Cliente','285600']]}
 const plot=chartOption(data,options,colors)
 const axis=plot.yAxis as {axisLabel:{formatter:(value:number,index:number)=>string}}
 expect(axis.axisLabel.formatter(1146383,0)).toBe('1,146,383')
 expect(axis.axisLabel.formatter(285600.5,0)).toBe('285,600.5')
})
it.each(['bar','line','histogram'] as const)('las etiquetas de %s usan el mismo formato numérico que el eje',kind=>{
 const data:ChartData={total:1,usable:1,points:1,limited:false,columns:['x','value','upper'],rows:[['1000','285600','2000']]}
 const plot=chartOption(data,{...options,kind},colors)
 const [series]=plot.series as {label:{formatter:(params:{value:number|number[]})=>string}}[]
 expect(series.label.formatter({value:kind==='line'?[1000,285600]:285600})).toBe('285,600')
})
it('los dos ejes de dispersión formatean números sin cambiar las coordenadas',()=>{
 const data:ChartData={total:1,usable:1,points:1,limited:false,columns:['x','value'],rows:[['1200','285600']]}
 const plot=chartOption(data,{...options,kind:'scatter'},colors)
 for(const axis of [plot.xAxis,plot.yAxis] as {axisLabel:{formatter:(value:number,index:number)=>string}}[])expect(axis.axisLabel.formatter(285600,0)).toBe('285,600')
 expect(plot.series).toMatchObject([{data:[[1200,285600]]}])
})
it('las etiquetas numéricas del mapa no formatean sus identificadores de categoría',()=>{
 const data:ChartData={total:1200,usable:1200,points:1,limited:false,columns:['x','value','y'],rows:[['00123','1200','90071992547409931234']]}
 const plot=chartOption(data,{...options,kind:'heatmap'},colors)
 const [series]=plot.series as {label:{formatter:(params:{value:number[]})=>string}}[]
 expect(series.label.formatter({value:[0,0,1200]})).toBe('1,200')
 expect(plot.xAxis).toMatchObject({data:['00123']});expect(plot.yAxis).toMatchObject({data:['90071992547409931234']})
})
