import {afterEach,expect,it} from 'vitest'
import {chartOption} from '../src/renderer/chart-option'
import type {ChartData,ChartOptions} from '../src/shared/charts'
import {setLanguage} from '../src/shared/i18n'

afterEach(()=>setLanguage('es'))
const options:ChartOptions={kind:'scatter',x:0,y:1,bins:10,aggregate:'count',descending:false,measureType:'number',series:-1,trend:true}
const colors={text:'#222',background:'#fff',accent:'#2671df',width:900}
const data:ChartData={total:3,usable:3,points:3,limited:false,columns:['x','value'],rows:[['1','2'],['2','4'],['3','5']],trend:{slope:.6,intercept:.83333333333,r2:.9996,r:Math.sqrt(.9996),n:3,xMin:1,xMax:3,constantY:false}}
const screen=(numberMode:'auto'|'all')=>({...colors,compact:true,numberMode})
type Plot=ReturnType<typeof chartOption>
const equation=(plot:Plot)=>((plot.title as {text:string}[]).at(-1)!).text
const aria=(plot:Plot)=>(plot.aria as {label:{description:string}}).label.description

it.each([
 ['auto','y = 0.6·x + 0.83','0.9998'],
 ['all','y = 0.6·x + 0.83333333333','0.999799979995999'],
] as const)('SIM-3d · la ecuación y ARIA en pantalla usan %s sin inventar R² igual a uno',(mode,expectedEquation,expectedR)=>{
 setLanguage('es')
 const plot=chartOption(data,options,screen(mode),['X','Y'])
 expect(equation(plot)).toBe(expectedEquation)
 expect(aria(plot)).toContain('R² = 0.9996')
 expect(aria(plot)).toContain('r = '+expectedR+' ·')
 expect(aria(plot)).not.toContain('R² = 1 ·')
})

it('SIM-3d · cambiar precisión de tendencia conserva series, coordenadas y formato de ejes',()=>{
 const before=structuredClone(data)
 const legacy=chartOption(data,options,{...colors,compact:true},['X','Y'])
 for(const mode of ['auto','all'] as const){
  const plot=chartOption(data,options,screen(mode),['X','Y'])
  expect(plot.series).toEqual(legacy.series)
  for(const axis of [plot.xAxis,plot.yAxis] as {axisLabel:{formatter:(value:number)=>string}}[])
   expect(axis.axisLabel.formatter(1.23456789012345)).toBe('1.23456789012')
 }
 expect(data).toEqual(before)
})

it('SIM-3d · el caller sin modo y la exportación no compacta conservan sus salidas anteriores',()=>{
 const legacyScreen=chartOption(data,options,{...colors,compact:true},['X','Y'])
 expect(equation(legacyScreen)).toBe('y = 0.6·x + 0.8333')
 const legacyExport=chartOption(data,options,{...colors,compact:false},['X','Y'])
 expect(equation(legacyExport)).toBe('y = 0.6·x + 0.83333333333')
 expect(aria(legacyExport)).toContain('r = '+String(data.trend!.r)+' ·')
 for(const numberMode of ['auto','all'] as const){
  const exported=chartOption(data,options,{...colors,compact:false,numberMode},['X','Y'])
  expect(JSON.stringify(exported)).toBe(JSON.stringify(legacyExport))
  expect(exported.series).toEqual(legacyExport.series)
 }
})
