import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import apa from './csl/apa.csl?asset'
import ieee from './csl/ieee.csl?asset'
import vancouver from './csl/nlm-citation-sequence.csl?asset'
import chicago from './csl/chicago-author-date.csl?asset'
import mla from './csl/modern-language-association.csl?asset'
import manifest from './csl/manifest.json'
import type {CitationStyleId} from '../shared/bibliography'
import {t} from '../shared/i18n'

const styles=Object.freeze({apa:{path:apa,file:'apa.csl'},ieee:{path:ieee,file:'ieee.csl'},vancouver:{path:vancouver,file:'nlm-citation-sequence.csl'},chicago:{path:chicago,file:'chicago-author-date.csl'},mla:{path:mla,file:'modern-language-association.csl'}})
export async function citationStyleBytes(id:CitationStyleId):Promise<Buffer>{
 if(!Object.hasOwn(styles,id))throw new Error(t('pandoc.styleUnavailable'))
 try{
  const resource=styles[id],bytes=await readFile(resource.path),expected=manifest.styles.find(style=>style.file===resource.file)?.sha256
  if(createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error()
  return bytes
 }catch{throw new Error(t('pandoc.styleUnavailable'))}
}
