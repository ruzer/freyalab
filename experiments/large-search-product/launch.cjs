// One local Electron; each sample is a fresh utilityProcess running the actual view manager and worker pool.
const {app,utilityProcess}=require('electron')
const {readFileSync,writeFileSync,appendFileSync}=require('node:fs')
const {resolve}=require('node:path')
const [bundle,manifest,output]=process.argv.slice(2),counts=new Map()
app.setPath('userData',resolve(output,'electron-profile'))
app.whenReady().then(async()=>{
 const tasks=JSON.parse(readFileSync(manifest,'utf8'))
 for(let i=0;i<tasks.length;i++){
  const request=tasks[i],child=utilityProcess.fork(resolve(bundle),[],{serviceName:'FreyaLab CSV product measurement'})
  const result=await new Promise((resolve,reject)=>{child.once('message',resolve);child.once('exit',code=>reject(new Error(`Utility exited before result: ${code}`)));child.postMessage(request)})
  appendFileSync(resolve(output,'raw.ndjson'),JSON.stringify({sample:i,request,result})+'\n')
  console.log(JSON.stringify({sample:i,of:tasks.length,label:request.label,workers:request.workers,...result}))
  await new Promise(resolve=>{child.once('exit',resolve);child.kill()})
  if(result.error)throw new Error(result.error)
  if(!['cancel','cap'].includes(request.kind)){const key=JSON.stringify([request.path,request.query]);if(counts.has(key)&&counts.get(key)!==result.result.state.matched)throw new Error('Measured variants disagree on count');counts.set(key,result.result.state.matched)}
 }
 app.quit()
}).catch(error=>{writeFileSync(resolve(output,'error.txt'),String(error));console.error(error);app.exit(1)})
