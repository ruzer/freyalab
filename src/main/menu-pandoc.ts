import type {PandocStatus} from '../shared/pandoc'

export class MenuPandocAvailability {
 private revision=0
 private available=false
 constructor(
  private readonly detector:(path?:string)=>Promise<PandocStatus>,
  private readonly readPath:()=>string|undefined,
  private readonly writePath:(path:string)=>void,
  private readonly onAvailable:(available:boolean)=>void,
 ){}
 async refresh():Promise<PandocStatus>{
  const revision=++this.revision,path=this.readPath(),status=await this.detector(path)
  if(this.current(revision,path))this.publish(status.available)
  return status
 }
 async choose(path:string):Promise<PandocStatus>{
  const revision=++this.revision,previous=this.readPath(),status=await this.detector(path)
  if(status.available&&this.current(revision,previous)){
   this.writePath(status.path)
   this.publish(true)
  }
  return status
 }
 private current(revision:number,path:string|undefined){return this.revision===revision&&this.readPath()===path}
 private publish(available:boolean){if(this.available===available)return;this.available=available;this.onAvailable(available)}
}
