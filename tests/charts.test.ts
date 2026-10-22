import {it,expect} from 'vitest'
import {chartSQL,chartData,type ChartOptions} from '../src/shared/charts'
import {chartOption} from '../src/renderer/chart-option'
const options:ChartOptions={kind:'histogram',x:0,y:1,bins:2,aggregate:'count',descending:false,measureType:'number'}
const colors={text:'#222',background:'#fff',accent:'#2671df'}
it('cita encabezados hostiles, valida opciones y limita los resultados después de agregar',()=>{
 const sql=chartSQL(['x";DELETE','Y'],options)
 expect(sql).toContain('"x"";DELETE" AS x');expect(sql).toContain('LIMIT 101');expect(sql).toContain('GROUP BY bins.i')
 expect(()=>chartSQL(['x'],options)).toThrow('columna válida')
 expect(()=>chartSQL(['x','y'],{...options,bins:0})).toThrow('intervalos')
 expect(()=>chartSQL(['x','y'],{...options,kind:'script' as ChartOptions['kind']})).toThrow('tipo')
})
it('distingue un resultado vacío de una vista limitada, sin confundir categorías vacías y ausentes',()=>{
 const columns=['total','usable','points','present','x','value']
 expect(chartData('bar',columns,[['0','0','0',null,null,null]]).rows).toEqual([])
 const data=chartData('bar',columns,[['2','2','101','1','','1'],['2','2','101','1',null,'1']]);expect(data.limited).toBe(true)
 const plot=chartOption(data,{...options,kind:'bar'},colors)
 expect(plot.xAxis).toMatchObject({data:['1. (vacío)','2. (campo ausente)']})
 expect(()=>chartData('bar',columns,[['bad','0','0',null,null,null]])).toThrow('Recuento')
})
it('preserva huecos en líneas y usa texto seguro en tooltips, sin HTML interpretado',()=>{
 const data={total:3,usable:2,points:3,limited:false,columns:['x','value'],rows:[['1','2'],['2',null],['3','4']]}
 const plot=chartOption(data,{...options,kind:'line'},colors)
 expect(plot.series).toEqual([{type:'line',connectNulls:false,showSymbol:true,data:[[1,2],[2,null],[3,4]]}])
 expect(plot.tooltip).toMatchObject({renderMode:'richText'})
 expect(()=>chartOption({...data,rows:[['1','NaN']]},{...options,kind:'scatter'},colors)).toThrow('representar')
})
it('dibuja bigotes observados, cuartiles y atípicos de una distribución conocida',()=>{
 const data={total:5,usable:5,points:1,limited:false,columns:[],rows:[['A','3','2','4','1','4','1','5','[100]']]}
 const plot=chartOption(data,{...options,kind:'box'},colors)
 expect(plot.series).toEqual([{type:'boxplot',data:[[1,2,3,4,4]]},{name:'Atípicos (hasta 20 por grupo)',type:'scatter',symbolSize:6,data:[[0,100]]}])
})
it('mantiene ausencias del mapa de calor sin inventar ceros',()=>{
 const data={total:2,usable:2,points:2,limited:false,columns:[],rows:[['A','1','X'],['B','1','Y']]}
 const plot=chartOption(data,{...options,kind:'heatmap'},colors)
 expect(plot.series).toMatchObject([{data:[[0,0,1],[1,1,1]]}])
})
it('describe ejes reales y alcance también en el gráfico exportable',()=>{
 const data={total:3,usable:3,points:1,limited:false,columns:['x','value'],rows:[['Oaxaca','15']]}
 const plot=chartOption(data,{...options,kind:'bar',aggregate:'sum'},colors,['Ciudad','Total MXN'],'Vista filtrada actual')
 expect(plot.xAxis).toMatchObject({name:'Ciudad'});expect(plot.yAxis).toMatchObject({name:'Suma de Total MXN'})
 expect(plot.title).toMatchObject({text:'Suma de Total MXN por Ciudad',subtext:expect.stringContaining('Vista filtrada actual')})
 const histogram=chartOption(data,options,colors,['Ciudad','Total MXN']);expect(histogram.xAxis).toMatchObject({name:'Intervalos de Total MXN'});expect(histogram.yAxis).toMatchObject({name:'Frecuencia (filas)'})
 for(const [aggregate,sql] of [['distinct','COUNT(DISTINCT y)'],['min','MIN(ny)'],['max','MAX(ny)'],['median','MEDIAN(ny)']] as const)expect(chartSQL(['Ciudad','Total MXN'],{...options,kind:'bar',aggregate})).toContain(sql)
 expect(()=>chartSQL(['Ciudad','Total MXN'],{...options,aggregate:'toString' as ChartOptions['aggregate']})).toThrow('agregación válida')
})
it('rechaza cálculos numéricos para texto y permite contar sin convertir identificadores',()=>{
 for(const aggregate of ['sum','average','min','max','median'] as const)expect(()=>chartSQL(['Ciudad','Código'],{...options,kind:'bar',aggregate,measureType:'text'})).toThrow('medida numérica')
 expect(chartSQL(['Código'],{...options,kind:'bar',x:0,y:-1,measureType:'text'})).toContain('NULL AS y')
 expect(()=>chartSQL(['Ciudad','Código'],{...options,measureType:'date' as never})).toThrow('texto o número')
 expect(()=>chartSQL(['Ciudad','Código'],{...options,y:-1})).toThrow('columna válida')
})
