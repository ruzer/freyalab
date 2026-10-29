// Positions remain safe JS integers; ordinal deltas usually need one byte, keeping 10 M dense matches below 128 MiB.
export const MATCH_LIMIT=10_000_000, MATCH_BYTES=128*1024*1024
interface Block {positions:Float64Array;lengths:Uint32Array;deltas:Uint8Array;used:number;count:number;base:number}
export interface MatchPosition {row:number;position:number;length:number}
export class MatchList {
 private blocks:Block[]=[]
 private last=0
 count=0
 bytes=0
 constructor(private remaining:()=>number=()=>MATCH_BYTES-this.bytes,private blockSize=16384){}
 get tailRow(){return this.last}
 get tailPosition(){const block=this.blocks.at(-1);return block?block.positions[block.count-1]:0}
 get tailLength(){const block=this.blocks.at(-1);return block?block.lengths[block.count-1]:0}
 truncate(count:number){
  if(!Number.isInteger(count)||count<0||count>this.count)throw new Error('Límite de coincidencias no válido.')
  while(this.count>count){
   const block=this.blocks.at(-1)!,end=block.used;let from=end-1,delta=0,factor=1
   while(from>0&&block.deltas[from-1]>=128)from--
   for(let i=from;i<end;i++){delta+=(block.deltas[i]%128)*factor;factor*=128}
   this.last-=delta;block.used=from;block.count--;this.count--
   if(!block.count){this.blocks.pop();this.bytes-=block.positions.byteLength+block.lengths.byteLength+block.deltas.byteLength+512}
  }
 }
 append(row:number,position:number,length:number){
  if(!Number.isSafeInteger(row)||row<=this.last||!Number.isSafeInteger(position)||position<0||!Number.isInteger(length)||length<1||length>1048576)throw new Error('Posición de coincidencia no válida.')
  let block=this.blocks.at(-1),delta=row-this.last,needed=1
  for(let n=delta;n>=128;n=Math.floor(n/128))needed++
  if(!block||block.count===this.blockSize){
   const bytes=this.blockSize*13+512;if(bytes>this.remaining())return false // includes bookkeeping within the same list budget
   block={positions:new Float64Array(this.blockSize),lengths:new Uint32Array(this.blockSize),deltas:new Uint8Array(this.blockSize),used:0,count:0,base:this.last};this.blocks.push(block);this.bytes+=bytes
  }
  if(block.used+needed>block.deltas.length){
   const capacity=Math.max(block.deltas.length*2,block.used+needed),extra=capacity-block.deltas.length;if(extra>this.remaining())return false
   const next=new Uint8Array(capacity);next.set(block.deltas);block.deltas=next;this.bytes+=extra
  }
  block.positions[block.count]=position;block.lengths[block.count++]=length
  while(delta>=128){block.deltas[block.used++]=delta%128+128;delta=Math.floor(delta/128)}block.deltas[block.used++]=delta
  this.last=row;this.count++;return true
 }
 page(offset:number,limit:number):MatchPosition[]{
  const out:MatchPosition[]=[]
  while(offset<this.count&&out.length<limit){
   const block=this.blocks[Math.floor(offset/this.blockSize)],from=offset%this.blockSize;let row=block.base,cursor=0
   for(let i=0;i<block.count&&out.length<limit;i++){
    let delta=0,factor=1,byte:number
    do{byte=block.deltas[cursor++];delta+=(byte%128)*factor;factor*=128}while(byte>=128)
    row+=delta
    if(i>=from){out.push({row,position:block.positions[i],length:block.lengths[i]});offset++}
   }
  }
  return out
 }
}
