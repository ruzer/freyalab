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
