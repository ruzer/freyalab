// Ventana mínima de Electron (el mismo Chromium del producto) que carga el banco de pruebas de desplazamiento.
const {app,BrowserWindow}=require('electron')
app.whenReady().then(()=>{const w=new BrowserWindow({width:900,height:800,show:false,webPreferences:{contextIsolation:true}});w.loadFile(require('node:path').join(__dirname,'harness.html'))})
app.on('window-all-closed',()=>app.quit())
