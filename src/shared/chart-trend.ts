import {t,plural,formatNumber} from './i18n'
import {chartLabels,type ChartOptions,type ChartTrend} from './charts'

export function chartTrendLine(trend:ChartTrend):number[][]{
 const {n,slope,intercept,xMin,xMax}=trend
 if(n<3||slope===null||intercept===null||xMin===null||xMax===null||xMin===xMax)return[]
 const points=[[xMin,slope*xMin+intercept],[xMax,slope*xMax+intercept]]
 return points.every(point=>point.every(Number.isFinite))?points:[]
}

export function chartTrendText(trend:ChartTrend,headers:string[],options:ChartOptions,full=false):string[]{
 const note=t('charts.trend.cause')
 if(trend.n<3)return[t('charts.trend.minimum'),note]
 if(trend.xMin!==null&&trend.xMin===trend.xMax)return[t('charts.trend.constantX'),note]
 if(!chartTrendLine(trend).length)return[t('charts.trend.unavailable'),note]
 const number=(value:number|null)=>value===null?'—':full?String(value):formatNumber(value,{maximumSignificantDigits:4})
 const labels=chartLabels(headers,options),equation=t('charts.trend.equation',{slope:number(trend.slope),sign:trend.intercept!<0?'−':'+',intercept:number(Math.abs(trend.intercept!))})
 const statistics=t('charts.trend.statistics',{r2:number(trend.r2),r:number(trend.r),points:plural('charts.trend.points',trend.n)})
 const interpretation=trend.constantY?t('charts.trend.constantY'):[trend.r2===null?'':t('charts.trend.explains',{percent:full?String(trend.r2*100)+'%':formatNumber(trend.r2,{style:'percent',maximumSignificantDigits:4}),y:labels.y}),t(trend.slope!>0?'charts.trend.increasing':trend.slope!<0?'charts.trend.decreasing':'charts.trend.flat',{x:labels.x,y:labels.y})].filter(Boolean).join(' ')
 return[equation,statistics,interpretation,note]
}
