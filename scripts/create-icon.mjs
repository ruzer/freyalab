import { deflateSync, crc32 } from 'node:zlib'
import { writeFile } from 'node:fs/promises'
const size=512, pixels=Buffer.alloc((size*4+1)*size)
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const i=y*(size*4+1)+1+x*4
 const inside=x>=24&&x<488&&y>=24&&y<488
 const f=(x>=170&&x<214&&y>=126&&y<386)||(x>=170&&x<350&&y>=126&&y<172)||(x>=170&&x<320&&y>=232&&y<276)
 pixels.set(f?[255,255,255,255]:inside?[0,122,255,255]:[0,0,0,0],i)
}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc])}
const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))])
if(png.readUInt32BE(16)!==512||png.readUInt32BE(20)!==512)throw new Error('Icon dimensions invalid')
await writeFile(new URL('../build/icon.png',import.meta.url),png)
