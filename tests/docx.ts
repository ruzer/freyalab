import {inflateRawSync} from 'node:zlib'
// El directorio central permite inspeccionar el DOCX sin herramientas del sistema ni dependencias.
export function zipFiles(zip:Buffer):Map<string,Buffer> {
 const files=new Map<string,Buffer>()
 for(let offset=0;offset<zip.length-22;offset++){
  if(zip.readUInt32LE(offset)!==0x02014b50)continue
  const method=zip.readUInt16LE(offset+10),size=zip.readUInt32LE(offset+20),nameLength=zip.readUInt16LE(offset+28),extraLength=zip.readUInt16LE(offset+30),commentLength=zip.readUInt16LE(offset+32),local=zip.readUInt32LE(offset+42)
  const name=zip.subarray(offset+46,offset+46+nameLength).toString('utf8'),start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28),data=zip.subarray(start,start+size)
  files.set(name,method===8?inflateRawSync(data):data)
  offset+=45+nameLength+extraLength+commentLength
 }
 return files
}
