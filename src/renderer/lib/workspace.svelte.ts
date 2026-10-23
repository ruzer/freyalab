import {parseLayout,restoreVisible,serializeLayout,type DockTab} from './workspace-layout'
// Estado compartido del panel de análisis. Vive fuera de CsvTable para sobrevivir al cambio de documento.
const KEY='freya-workspace'
function read(){try{return parseLayout(localStorage.getItem(KEY))}catch{return parseLayout(null)}}
const initial=read()
// `expanded` es solo de la sesión: no se guarda y el panel siempre arranca acoplado.
export const workspace=$state<{visible:boolean;width:number;tab:DockTab;expanded:boolean}>({visible:initial.dock.visible,width:initial.dock.width,tab:initial.dock.tab,expanded:false})
// La decisión de arranque se toma una sola vez, al medir el área de la primera tabla. No toca lo guardado: en una ventana ancha se restaurará abierto.
let settled=false
export function settleStartup(area:number){if(settled||area<=0)return;settled=true;workspace.visible=restoreVisible(workspace.visible,area)}
// Se guarda al terminar una acción (abrir, cerrar, cambiar de pestaña, soltar el divisor), no en cada píxel. Cualquier acción de la persona zanja la decisión de arranque.
export function saveWorkspace(){settled=true;try{localStorage.setItem(KEY,serializeLayout({version:1,dock:{visible:workspace.visible,width:workspace.width,tab:workspace.tab}}))}catch{/* sin almacenamiento: el panel funciona igual, solo no recuerda */}}
