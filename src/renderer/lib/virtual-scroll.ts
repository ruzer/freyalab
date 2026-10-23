// Desplazamiento virtual de tablas muy largas. Funciones puras, sin DOM ni Svelte.
//
// Chromium no representa un elemento de más de 16 777 214 px de alto (medido en el Chromium de Electron 44): con filas de 32 px son
// 524 286 filas, y a partir de ahí la barra de desplazamiento no llega al final. Si la altura lógica de la tabla supera MAX_SCROLL_PX,
// el elemento desplazable mide MAX_SCROLL_PX y cada píxel físico vale `scale` píxeles lógicos (como una barra de desplazamiento con
// «zoom»). Las filas se colocan en relación con el desplazamiento actual, de modo que las vecinas siguen separadas lo que miden.
export const MAX_SCROLL_PX=15_000_000 // por debajo del límite medido, con margen
export const scrollScale=(total:number,viewport:number,cap=MAX_SCROLL_PX)=>total<=cap?1:(total-viewport)/(cap-viewport)
export const scrollHeight=(total:number,cap=MAX_SCROLL_PX)=>Math.min(total,cap)
export const toLogical=(physical:number,scale:number)=>physical*scale
export const toPhysical=(logical:number,scale:number)=>logical/scale
// Posición física de una fila dentro del contenido desplazable: su inicio lógico menos el desplazamiento lógico, más el físico.
export const rowTop=(start:number,offset:number,scale:number)=>scale===1?start:start-offset+offset/scale
