// Bootstrap externo de prueba: no se importa desde el producto ni abre canales IPC.
const {app,ipcMain}=require('electron')
const {pathToFileURL}=require('node:url')
const {isAbsolute,resolve}=require('node:path')
const main=process.env.FREYALAB_TEST_OUTLINE_MAIN
const root=process.env.FREYALAB_TEST_OUTLINE_ROOT
if(process.env.FREYALAB_TEST!=='1'||process.env.FREYALAB_TEST_OUTLINE_GATE!=='1'||!main||!root||!isAbsolute(main)||!isAbsolute(root))throw new Error('La barrera A5 sólo funciona en una prueba con rutas explícitas.')
app.setAppPath(resolve(root))
let released=false,arrivals=0,finished=0
const waiting=[],events=[]
const mark=type=>events.push({type,at:performance.now(),arrivals,finished})
Object.defineProperty(globalThis,'__freyaA5Gate',{value:Object.freeze({
 state:()=>({released,arrivals,finished,waiting:waiting.length,events:[...events]}),
 release:()=>{if(!released){released=true;mark('release');for(const finish of waiting.splice(0))finish()}return released}
})})
const original=ipcMain.handle.bind(ipcMain)
ipcMain.handle=function(channel,handler){
 if(channel!=='freya')return original(channel,handler)
 return original(channel,async(event,operation,...args)=>{
  if(operation!=='image')return handler(event,operation,...args)
  arrivals++;mark('image-arrived')
  if(!released)await new Promise(finish=>waiting.push(finish))
  const result=await handler(event,operation,...args)
  finished++;mark('image-returned')
  return result
 })
}
import(pathToFileURL(main).href).catch(error=>{console.error(error);app.exit(1)})
