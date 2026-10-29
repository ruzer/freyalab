import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {crc32} from 'node:zlib'
import reference from './docx-reference.docx?asset'
import manifest from './docx-reference/manifest.json'
import {t} from '../shared/i18n'

const office='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const word='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
function institutionText(value:string){
 for(const character of value){
  const code=character.codePointAt(0)!
  if(!(code===9||code===10||code===13||code>=0x20&&code<=0xd7ff||code>=0xe000&&code<=0xfffd||code>=0x10000&&code<=0x10ffff))throw new Error(t('report.invalidInstitution'))
 }
 return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;').split(/\r\n|\r|\n/).join('</w:t><w:br/><w:t xml:space="preserve">')
}
// Sólo abre nuestro ZIP_STORED conocido, después de verificar su SHA completo.
// No procesa archivos DOCX del usuario ni extrae rutas al sistema de archivos.
function ownParts(bytes:Buffer){
 const parts=new Map<string,Buffer>();let offset=0
 while(bytes.readUInt32LE(offset)===0x04034b50){
  const size=bytes.readUInt32LE(offset+18),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28)
  if(bytes.readUInt16LE(offset+8)!==0)throw new Error(t('pandoc.referenceUnavailable'))
  const name=bytes.subarray(offset+30,offset+30+length).toString('utf8'),start=offset+30+length+extra
  parts.set(name,bytes.subarray(start,start+size));offset=start+size
 }
 return parts
}
// Misma forma sin compresión que el generador del recurso propio. CRC usa Node.
function storedReference(parts:Map<string,Buffer>,date:number){
 const files:Buffer[]=[],directory:Buffer[]=[];let offset=0
 for(const[name,data]of [...parts].sort(([a],[b])=>a<b?-1:a>b?1:0)){
  const filename=Buffer.from(name),crc=crc32(data),local=Buffer.alloc(30),central=Buffer.alloc(46)
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(date,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26)
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(date,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(0x20,38);central.writeUInt32LE(offset,42)
  files.push(local,filename,data);directory.push(central,filename);offset+=local.length+filename.length+data.length
 }
 const listing=Buffer.concat(directory),end=Buffer.alloc(22)
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(parts.size,8);end.writeUInt16LE(parts.size,10);end.writeUInt32LE(listing.length,12);end.writeUInt32LE(offset,16)
 return Buffer.concat([...files,listing,end])
}
export async function reportReferenceBytes(institution?:string):Promise<Buffer>{
 let bytes:Buffer
 try{
  bytes=await readFile(reference)
  if(createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw new Error()
 }catch{throw new Error(t('pandoc.referenceUnavailable'))}
 if(!institution)return bytes
 const text=institutionText(institution),parts=ownParts(bytes)
 const update=(name:string,transform:(xml:string)=>string)=>parts.set(name,Buffer.from(transform(parts.get(name)!.toString('utf8'))))
 update('word/document.xml',xml=>xml.replace('<w:document ',`<w:document xmlns:r="${office}" `).replace('<w:sectPr>',`<w:sectPr><w:headerReference w:type="first" r:id="rIdFreyaInstitution"/>`).replace('</w:sectPr>','<w:titlePg/></w:sectPr>'))
 update('word/_rels/document.xml.rels',xml=>xml.replace('</Relationships>',`<Relationship Id="rIdFreyaInstitution" Type="${office}/header" Target="header-institution.xml"/></Relationships>`))
 update('[Content_Types].xml',xml=>xml.replace('</Types>','<Override PartName="/word/header-institution.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>'))
 parts.set('word/header-institution.xml',Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><w:hdr xmlns:w="${word}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:hdr>`))
 return storedReference(parts,bytes.readUInt16LE(12))
}
