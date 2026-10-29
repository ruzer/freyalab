type Clock={now:()=>number;pause:()=>Promise<void>}
const clock:Clock={now:()=>performance.now(),pause:()=>new Promise(resolve=>setTimeout(resolve,2))}
export async function waitForView<T extends {status:string}|null>(read:()=>Promise<T>,deadline:number,time:Clock=clock):Promise<T>{
 let value=await read()
 while(value?.status==='running'){
  if(time.now()>=deadline)throw new Error('La consulta no terminó dentro del plazo de la prueba.')
  await time.pause();value=await read()
 }
 if(time.now()>deadline)throw new Error('La consulta no terminó dentro del plazo de la prueba.')
 return value
}
