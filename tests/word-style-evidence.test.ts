import {it,expect} from 'vitest'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {zipFiles} from './docx'

it('SEG-S2e: conserva el DOCX rojo real y sus dos partes con controles XML ilegales',async()=>{
 const bytes=await readFile(new URL('../docs/evidence/seg-s2e-2026-10-30/custom-style-invalid.docx',import.meta.url))
 expect(bytes.length).toBe(10707)
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('cd3416aa091609f9c0de04bfdcfeb7e2cec629fcc72a43806fa64cf0b8c233d8')
 const illegal=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u,parts=zipFiles(bytes)
 expect([...parts].filter(([name,value])=>/\.(?:xml|rels)$/.test(name)&&illegal.test(value.toString('utf8'))).map(([name])=>name).sort()).toEqual(['word/document.xml','word/styles.xml'])
 expect(parts.get('docProps/core.xml')!.toString('utf8')).not.toMatch(illegal)
})
