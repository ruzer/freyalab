import {describe,expect,it} from 'vitest'
import {DOCK_MIN,DOCK_MAX,TABLE_MIN,defaultLayout,parseLayout,serializeLayout,dockRange,nextWidth} from '../src/renderer/lib/workspace-layout'

const stored=(dock:unknown,version:unknown=1)=>JSON.stringify({version,dock})
const good={visible:true,width:600,tab:'sql'} as const

describe('layout del panel de análisis: lectura segura',()=>{
 it('sin valor guardado usa los valores por defecto',()=>{
  expect(defaultLayout()).toEqual({version:1,dock:{visible:false,width:DOCK_MIN,tab:'resumen'}})
  expect(parseLayout(null)).toEqual(defaultLayout())
 })
 it('recupera un valor válido',()=>{
  expect(parseLayout(stored(good))).toEqual({version:1,dock:good})
  expect(parseLayout(serializeLayout({version:1,dock:good}))).toEqual({version:1,dock:good})
 })
 it.each([
  ['texto vacío',''],['JSON roto','{"version":1,"dock":'],['no es un objeto','[1,2]'],['un número','42'],['null','null'],
  ['otra versión',stored(good,2)],['sin versión',JSON.stringify({dock:good})],['sin dock',JSON.stringify({version:1})],['dock no es un objeto',stored('abierto')],
  ['pestaña desconocida',stored({...good,tab:'otra'})],['visible no es booleano',stored({...good,visible:'si'})],
  ['ancho de texto',stored({...good,width:'ancho'})],['ancho nulo',stored({...good,width:null})],['sin ancho',stored({visible:true,tab:'sql'})]
 ])('%s → valores por defecto',(_name,raw)=>{expect(parseLayout(raw)).toEqual(defaultLayout())})
 it('recorta un ancho fuera de rango y redondea uno fraccionario',()=>{
  expect(parseLayout(stored({...good,width:100})).dock.width).toBe(DOCK_MIN)
  expect(parseLayout(stored({...good,width:1e9})).dock.width).toBe(DOCK_MAX)
  expect(parseLayout(stored({...good,width:600.7})).dock.width).toBe(601)
 })
 it('ignora y no vuelve a escribir claves ajenas (nunca datos del documento)',()=>{
  const layout=parseLayout(JSON.stringify({version:1,dock:{...good,filas:[['secreto']]},csv:[['secreto']]}))
  expect(layout).toEqual({version:1,dock:good})
  expect(JSON.parse(serializeLayout(layout))).toEqual({version:1,dock:{visible:true,width:600,tab:'sql'}})
  expect(Object.keys(JSON.parse(serializeLayout(layout)).dock).sort()).toEqual(['tab','visible','width'])
 })
})

describe('rango y pasos del divisor',()=>{
 it('el panel nunca baja de su mínimo ni deja la tabla por debajo de la suya',()=>{
  expect(dockRange(1679)).toEqual({min:DOCK_MIN,max:1679-TABLE_MIN})
  expect(dockRange(1199)).toEqual({min:DOCK_MIN,max:599})
  expect(dockRange(1039)).toEqual({min:DOCK_MIN,max:DOCK_MIN}) // no hay sitio para ensanchar
  expect(dockRange(0)).toEqual({min:DOCK_MIN,max:DOCK_MIN})
 })
 it('flechas: ← ensancha y → estrecha, 16 px (64 con Mayús), siempre dentro del rango',()=>{
  expect(nextWidth(520,'ArrowLeft',false,1679)).toBe(536)
  expect(nextWidth(520,'ArrowLeft',true,1679)).toBe(584)
  expect(nextWidth(584,'ArrowRight',false,1679)).toBe(568)
  expect(nextWidth(584,'ArrowRight',true,1679)).toBe(520)
  expect(nextWidth(520,'ArrowRight',false,1679)).toBe(520)
  expect(nextWidth(1070,'ArrowLeft',true,1679)).toBe(1079)
 })
 it('Inicio va al mínimo, Fin al máximo e Intro restablece el ancho por defecto',()=>{
  expect(nextWidth(700,'Home',false,1679)).toBe(DOCK_MIN)
  expect(nextWidth(700,'End',false,1679)).toBe(1079)
  expect(nextWidth(900,'Enter',false,1679)).toBe(DOCK_MIN)
 })
 it('otras teclas no cambian nada',()=>{expect(nextWidth(700,'a',false,1679)).toBeNull();expect(nextWidth(700,'ArrowUp',false,1679)).toBeNull()})
 it('un ancho guardado mayor que el sitio disponible se recorta al rango',()=>{expect(nextWidth(2000,'ArrowRight',false,1199)).toBe(599-16)})
})
