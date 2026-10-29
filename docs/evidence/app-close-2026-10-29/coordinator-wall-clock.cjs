const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=process.cwd(),out=__dirname;
(async()=>{
 const ts=require(path.join(repo,'node_modules/typescript'));require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.env.DEV','false'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
 const{WindowClosePreparation}=require(path.join(repo,'src/main/application-close.ts')),coordinator=new WindowClosePreparation(),startedUTC=new Date().toISOString(),start=performance.now();
 let requests=0,message='';const request=coordinator.request(42,()=>requests++);
 try{await request.promise;throw new Error('No se esperaba resolución sin ACK')}catch(error){message=error.message}
 const elapsedMs=performance.now()-start,lateAckAccepted=coordinator.complete(42,request.nonce,true);
 const result={startedUTC,finishedUTC:new Date().toISOString(),environment:{platform:process.platform,arch:process.arch,node:process.version},scope:'Coordinador real aislado, reloj real; no es medición de GUI ni garantía de rendimiento',sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,'src/main/application-close.ts'))).digest('hex'),requests,elapsedMs,message,lateAckAccepted};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(elapsedMs<29900||lateAckAccepted||!message.includes('30 segundos'))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
