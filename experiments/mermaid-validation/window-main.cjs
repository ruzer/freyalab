const {app,BrowserWindow}=require('electron')
app.setPath('userData',process.env.FREYALAB_HARNESS_PROFILE)
app.whenReady().then(async()=>{
 const window=new BrowserWindow({width:1440,height:900,show:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}})
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}))
 window.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('file:')}))
 await window.loadFile(process.env.FREYALAB_RACE_HTML)
})
app.on('window-all-closed',()=>app.quit())
