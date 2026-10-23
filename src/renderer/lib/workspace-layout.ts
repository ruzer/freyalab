// Layout del panel de análisis: valores, lectura segura del almacenamiento local y pasos del divisor.
// Funciones puras, sin Svelte ni DOM, para poder probarlas aparte. Solo se guarda `{version, dock:{visible,width,tab}}`: nunca datos de un documento.
export type DockTab='resumen'|'graficos'|'sql'
export interface Layout{version:1;dock:{visible:boolean;width:number;tab:DockTab}}
// 520 px: ancho con el que un gráfico no se desplaza en horizontal. 600 px: tabla con ~3 columnas (180 px cada una más la numeración).
export const DOCK_MIN=520,TABLE_MIN=600,DOCK_MAX=3000,STEP=16,BIG_STEP=64
const tabs:DockTab[]=['resumen','graficos','sql']
// Por debajo de este ancho del área de trabajo no caben juntos el panel y la tabla: el panel se abre ampliado.
export const NARROW_AREA=DOCK_MIN+TABLE_MIN
export const isNarrow=(area:number)=>area>0&&area<NARROW_AREA
export type DockMode='hidden'|'docked'|'expanded'
// La persona decide (abierto, ampliado); el modo efectivo sale de eso y del espacio, así que ensanchar la ventana devuelve el panel junto a la tabla.
export const dockMode=({visible,expanded,area}:{visible:boolean;expanded:boolean;area:number}):DockMode=>!visible?'hidden':expanded||isNarrow(area)?'expanded':'docked'
// Un panel guardado como abierto se restaura al arrancar solo si el área de trabajo admite acoplarlo: en una ventana estrecha se abriría ampliado y ocultaría la tabla del archivo que se acaba de abrir.
export const restoreVisible=(stored:boolean,area:number)=>stored&&!isNarrow(area)
export const defaultLayout=():Layout=>({version:1,dock:{visible:false,width:DOCK_MIN,tab:'resumen'}})
const isObject=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value)
export function parseLayout(raw:string|null):Layout{
 try{
  const value:unknown=JSON.parse(raw??'')
  if(!isObject(value)||value.version!==1||!isObject(value.dock))return defaultLayout()
  const {visible,width,tab}=value.dock
  if(typeof visible!=='boolean'||typeof width!=='number'||!Number.isFinite(width)||!tabs.includes(tab as DockTab))return defaultLayout()
  return{version:1,dock:{visible,width:Math.min(DOCK_MAX,Math.max(DOCK_MIN,Math.round(width))),tab:tab as DockTab}}
 }catch{return defaultLayout()}
}
export const serializeLayout=(layout:Layout)=>JSON.stringify({version:1,dock:{visible:layout.dock.visible,width:layout.dock.width,tab:layout.dock.tab}})
// Rango del ancho del panel según el ancho del área de trabajo: nunca menos de DOCK_MIN ni deja la tabla por debajo de TABLE_MIN.
export const dockRange=(area:number)=>({min:DOCK_MIN,max:Math.max(DOCK_MIN,Math.min(DOCK_MAX,area-TABLE_MIN))})
export function clampWidth(width:number,area:number){const {min,max}=dockRange(area);return Math.min(max,Math.max(min,width))}
// ← ensancha el panel (está a la derecha) y → lo estrecha; Inicio al mínimo, Fin al máximo, Intro restablece el ancho por defecto.
export function nextWidth(current:number,key:string,shift:boolean,area:number):number|null{
 const {min,max}=dockRange(area),width=clampWidth(current,area),step=shift?BIG_STEP:STEP
 switch(key){
  case'ArrowLeft':return clampWidth(width+step,area)
  case'ArrowRight':return clampWidth(width-step,area)
  case'Home':return min
  case'End':return max
  case'Enter':return DOCK_MIN
  default:return null
 }
}
