import './pandoc-assets'
import {it,expect} from 'vitest'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {zipFiles} from './docx'
import {reportReferenceBytes} from '../src/main/report-reference'

const reference=reportReferenceBytes as (institution?:string)=>Promise<Buffer>
const asset=new URL('../src/main/docx-reference.docx',import.meta.url)
it('sin institución conserva byte a byte el recurso propio que ya fue revisado',async()=>{
 expect((await reference()).equals(await readFile(asset))).toBe(true)
})
it.each([
 ['Universidad Sintética','Universidad Sintética'],
 ['Centro & Facultad <A>','Centro &amp; Facultad &lt;A&gt;'],
 ['Instituto "Ñ" 🐕','Instituto &quot;Ñ&quot; 🐕'],
 ['Primera\r\nSegunda','Primera</w:t><w:br/><w:t xml:space="preserve">Segunda'],
])('incluye texto estático y escapado en la primera cabecera: %s',async(institution,expected)=>{
 const before=await readFile(asset),parts=zipFiles(await reference(institution))
 expect(parts.get('word/header-institution.xml')?.toString()).toContain(expected)
 expect(parts.get('word/header-institution.xml')?.toString()).not.toMatch(/DOCPROPERTY|fldSimple|instrText|INCLUDETEXT|<script>/)
 expect(parts.get('word/document.xml')?.toString()).toContain('w:type="first"')
 expect(parts.get('word/document.xml')?.toString()).toContain('xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"')
 expect(parts.get('word/document.xml')?.toString()).toContain('<w:titlePg/>')
 expect(parts.get('word/_rels/document.xml.rels')?.toString()).toContain('Target="header-institution.xml"')
 expect(parts.get('[Content_Types].xml')?.toString()).toContain('/word/header-institution.xml')
 expect((await readFile(asset)).equals(before)).toBe(true)
})
it('la variante conserva estilos y ajustes; no crea una cabecera para páginas siguientes',async()=>{
 const original=zipFiles(await reference()),variant=zipFiles(await reference('Institución'))
 for(const name of ['word/styles.xml','word/settings.xml','_rels/.rels'])expect(variant.get(name)?.equals(original.get(name)!)).toBe(true)
 expect([...variant.keys()].filter(name=>name.includes('header-'))).toEqual(['word/header-institution.xml'])
 expect(variant.get('word/document.xml')?.toString()).not.toContain('w:type="default"')
})
it('la misma institución genera una variante determinista y no cambia el hash base',async()=>{
 expect((await reference('Institución')).equals(await reference('Institución'))).toBe(true)
 expect(createHash('sha256').update(await readFile(asset)).digest('hex')).toBe('8557dea1c67095d2df33743d4749a3a2d6783bcf33594acbb740a2054d90a8c4')
})
it.each(['Nulo\0dato','Surrogate\uD800','No carácter\uFFFF'])('rechaza XML imposible sin eliminar silenciosamente texto',async value=>{
 await expect(reference(value)).rejects.toThrow(/instituci[oó]n|institution/i)
})
