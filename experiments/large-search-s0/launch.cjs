// One Electron main session; a fresh real utilityProcess per sample gives independent RSS high-water marks.
const {app,utilityProcess}=require('electron')
const {readFileSync,writeFileSync,appendFileSync}=require('node:fs')
const {resolve}=require('node:path')
const [bundle,manifest,output]=process.argv.slice(2)
app.setPath('userData',resolve(output,'electron-profile'))
app.whenReady().then(async()=>{
 const tasks=JSON.parse(readFileSync(manifest,'utf8'))
 for(let i=0;i<tasks.length;i++){
  const request=tasks[i],child=utilityProcess.fork(resolve(bundle),[],{serviceName:'FreyaLab CSV S0'})
  const result=await new Promise((resolve,reject)=>{child.once('message',resolve);child.once('exit',code=>{if(code)reject(new Error(`Utility exit ${code}`))});child.postMessage(request)})
  appendFileSync(resolve(output,'raw.ndjson'),JSON.stringify({sample:i,request,result})+'\n')
  console.log(JSON.stringify({sample:i,kind:request.kind,strategy:request.strategy,jobs:request.jobs,result}))
  child.kill()
  if(result.error)throw new Error(result.error)
 }
 app.quit()
}).catch(error=>{writeFileSync(resolve(output,'error.txt'),String(error));console.error(error);app.exit(1)})
