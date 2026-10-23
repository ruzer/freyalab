import {parseLayout,serializeLayout,type DockTab} from './workspace-layout'
// Estado compartido del panel de análisis. Vive fuera de CsvTable para sobrevivir al cambio de documento.
const KEY='freya-workspace'
function read(){try{return parseLayout(localStorage.getItem(KEY))}catch{return parseLayout(null)}}
const initial=read()
export const workspace=$state<{visible:boolean;width:number;tab:DockTab}>({visible:initial.dock.visible,width:initial.dock.width,tab:initial.dock.tab})
// Se guarda al terminar una acción (abrir, cerrar, cambiar de pestaña, soltar el divisor), no en cada píxel.
export function saveWorkspace(){try{localStorage.setItem(KEY,serializeLayout({version:1,dock:{visible:workspace.visible,width:workspace.width,tab:workspace.tab}}))}catch{/* sin almacenamiento: el panel funciona igual, solo no recuerda */}}
