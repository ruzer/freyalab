import {t,formatNumber} from './i18n'
import {chartLabels,type ChartOptions,type ChartTrend} from './charts'
import {formatAnalysisNumber,type AnalysisNumberMode,type AnalysisNumberKind} from './analysis-number-format'

export function chartTrendLine(trend:ChartTrend):number[][]{
 const {n,slope,intercept,xMin,xMax}=trend
 if(n<3||slope===null||intercept===null||xMin===null||xMax===null||xMin===xMax)return[]
 const points=[[xMin,slope*xMin+intercept],[xMax,slope*xMax+intercept]]
 return points.every(point=>point.every(Number.isFinite))?points:[]
}

export type ChartTrendFragment=
 |{type:'text';text:string}
 |{type:'number';value:number;kind:AnalysisNumberKind;unit:string}
const text=(value:string):ChartTrendFragment=>({type:'text',text:value})
const numeric=(value:number|null,kind:AnalysisNumberKind='number',unit=''):ChartTrendFragment[]=>value===null?[text('—')]:[{type:'number',value,kind,unit}]

// Interpolate known message placeholders before inserting literal source labels.
// Numeric values come from typed results, never from parsing the resulting text.
function message(key:string,parameters:Record<string,string|ChartTrendFragment[]>={}):ChartTrendFragment[]{
 const template=t(key),parts:ChartTrendFragment[]=[]
 let offset=0
 for(const match of template.matchAll(/\{([^}]+)\}/g)){
  if(match.index>offset)parts.push(text(template.slice(offset,match.index)))
  const value=parameters[match[1]]
  parts.push(...(value===undefined?[text(match[0])]:typeof value==='string'?[text(value)]:value))
  offset=match.index+match[0].length
 }
 if(offset<template.length)parts.push(text(template.slice(offset)))
 return parts
}

export function chartTrendFragments(trend:ChartTrend,headers:string[],options:ChartOptions):ChartTrendFragment[][]{
 const note=t('charts.trend.cause')
 if(trend.n<3)return[[text(t('charts.trend.minimum'))],[text(note)]]
 if(trend.xMin!==null&&trend.xMin===trend.xMax)return[[text(t('charts.trend.constantX'))],[text(note)]]
 if(!chartTrendLine(trend).length)return[[text(t('charts.trend.unavailable'))],[text(note)]]
 const labels=chartLabels(headers,options)
 const equation=message('charts.trend.equation',{slope:numeric(trend.slope),sign:trend.intercept!<0?'−':'+',intercept:numeric(Math.abs(trend.intercept!))})
 // Every valid trend has at least three integer points: es/en use the plural form.
 const points=message('charts.trend.points.other',{count:numeric(trend.n,'count')})
 const statistics=message('charts.trend.statistics',{r2:numeric(trend.r2,'coefficient'),r:numeric(trend.r,'coefficient'),points})
 let interpretation:ChartTrendFragment[]
 if(trend.constantY)interpretation=message('charts.trend.constantY')
 else{
  interpretation=trend.r2===null?[]:message('charts.trend.explains',{percent:numeric(trend.r2*100,'percent',' %'),y:labels.y})
  if(interpretation.length)interpretation.push(text(' '))
  interpretation.push(...message(trend.slope!>0?'charts.trend.increasing':trend.slope!<0?'charts.trend.decreasing':'charts.trend.flat',{x:labels.x,y:labels.y}))
 }
 return[equation,statistics,interpretation,[text(note)]]
}

export function chartTrendText(trend:ChartTrend,headers:string[],options:ChartOptions,full=false,mode?:AnalysisNumberMode):string[]{
 return chartTrendFragments(trend,headers,options).map(line=>line.map(part=>{
  if(part.type==='text')return part.text
  if(!full&&mode!==undefined)return formatAnalysisNumber(part.value,mode,undefined,part.kind)+part.unit
  // Preserve the existing full report and plot annotation representations.
  if(part.kind==='count')return formatNumber(part.value)
  if(part.kind==='percent')return full?String(part.value)+'%':formatNumber(trend.r2!,{style:'percent',maximumSignificantDigits:4})
  return full?String(part.value):formatNumber(part.value,{maximumSignificantDigits:4})
 }).join(''))
}
