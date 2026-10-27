import {describe,it,expect} from 'vitest'
import {markdownHTML,standaloneHTML} from '../src/renderer/lib/render'
import {localAnchorStats} from './helpers/markdown-invariants'
describe('Markdown rendering',()=>{
 it('renders GFM without executing or preserving raw HTML',async()=>{const result=await markdownHTML('# Hola\n\n<script>alert(1)</script>\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n[mal](javascript:alert(1))');expect(result.html).toContain('<table>');expect(result.html).not.toContain('<script>');expect(result.html).not.toContain('href="javascript:');expect(result.headings).toEqual([{id:'heading-hola',text:'Hola',level:1}])})
 it('makes repeated heading anchors unique and retains diagram source',async()=>{const result=await markdownHTML('# Uno\n\n# Uno\n\n```mermaid\nflowchart LR\nA-->B\n```');expect(result.headings.map(h=>h.id)).toEqual(['heading-uno','heading-uno-1']);expect(result.html).toContain('language-mermaid');expect(result.html).toContain('A-->B')})
 it('renders formulas and produces a standalone document with escaped title',async()=>{const result=await markdownHTML('$x^2$');expect(result.html).toContain('class="katex"');const html=standaloneHTML(result.html,'<script>');expect(html).toContain('<title>&lt;script&gt;</title>');expect(html).toContain('@page');expect(html).not.toContain('cdn.')})
})

describe('FL-MD-002 A · propiedades del documento',()=>{
 it('A1 aparta YAML antes de parsearlo y deja solo títulos del cuerpo en el índice',async()=>{
  const source='---\ntitle: Guía\ntags: [a, b]\n---\n\n# Hola\n',r=await markdownHTML(source)
  expect(r.html).not.toContain('<hr');expect(r.html).not.toContain('title: Guía')
  expect(r.headings.map(h=>h.text)).toEqual(['Hola']);expect(r.frontMatter).toBe('title: Guía\ntags: [a, b]\n')
 })
 it.each(['---','...'])('A1 reconoce cierre %s sin consumir el cuerpo',async close=>{
  const r=await markdownHTML(`---\ntitle: Guía\n${close}\n# Contenido`)
  expect(r.frontMatter).toBe('title: Guía\n');expect(r.html).toContain('Contenido');expect(r.headings).toHaveLength(1)
 })
 it('A2 el resultado autónomo no incluye propiedades ni su contenido',async()=>{
  const r=await markdownHTML('---\nsecreto_interno: solo propiedades\n---\n\nCuerpo público.')
  const html=standaloneHTML(r.html,'Guía');expect(html).toContain('Cuerpo público.')
  expect(html).not.toContain('secreto_interno');expect(r.frontMatter).toContain('solo propiedades')
 })
 it('A3 conserva un separador inicial que no es YAML',async()=>{
  const r=await markdownHTML('---\n\nTexto\n\n---')
  expect(r.frontMatter).toBeUndefined();expect(r.html).toContain('<hr>');expect(r.html).toContain('Texto')
 })
 it('no consume un encabezado sin cierre',async()=>{
  const r=await markdownHTML('---\ntitle: Sin cierre\n\nTexto')
  expect(r.frontMatter).toBeUndefined();expect(r.html).toContain('Sin cierre');expect(r.html).toContain('<hr>')
 })
 it('A4 conserva CRLF y BOM sin modificar la cadena original',async()=>{
  const source='\uFEFF---\r\ntitle: Guía\r\ntags:\r\n  - uno\r\n  - dos\r\n...\r\n\r\n# Hola',copy=source
  const r=await markdownHTML(source);expect(source).toBe(copy);expect(r.frontMatter).toBe('title: Guía\r\ntags:\r\n  - uno\r\n  - dos\r\n');expect(r.headings.map(h=>h.text)).toEqual(['Hola'])
 })
 it('reconoce un bloque vacío y distingue undefined de vacío',async()=>{
  const r=await markdownHTML('---\n---\n# Hola');expect(r.frontMatter).toBe('');expect(r.html).not.toContain('<hr>')
 })
 it('acepta comentarios, listas y valores multilínea con sangría sin interpretar YAML',async()=>{
  const yaml='# comentario\ntitle: "<img src=x onerror=x>"\nlist:\n- uno\n- dos\nbody: |\n  texto\n\n',r=await markdownHTML('---\n'+yaml+'---\n# Hola')
  expect(r.frontMatter).toBe(yaml);expect(r.html).not.toContain('onerror');expect(r.headings).toHaveLength(1)
 })
 it('limita la detección a las primeras 100 líneas y no consume un bloque mayor',async()=>{
  const accepted='---\n'+'key: value\n'.repeat(98)+'---\n# Hola',rejected='---\n'+'key: value\n'.repeat(99)+'---\n# Hola'
  expect((await markdownHTML(accepted)).frontMatter).toBe('key: value\n'.repeat(98))
  const r=await markdownHTML(rejected);expect(r.frontMatter).toBeUndefined();expect(r.html).toContain('key: value')
 })
 it('no interpreta un separador posterior a un título como propiedades',async()=>{
  const r=await markdownHTML('# Hola\n\n---\ntitle: visible\n---');expect(r.frontMatter).toBeUndefined();expect(r.html).toContain('title: visible')
 })
})

describe('FL-MD-002 B · enlaces internos',()=>{
 const targets=(html:string)=>{
  const stats=localAnchorStats(html)
  expect(stats.duplicates).toEqual([]);expect(stats.missing).toEqual([])
  return{ids:stats.ids,hrefs:stats.targets}
 }
 it.each(['instalacion','Instalación','INSTALACI%C3%93N','heading-instalacion'])('resuelve #%s al id real sin acentos ni mayúsculas',async fragment=>{
  const r=await markdownHTML(`# Instalación\n\n[ir](#${fragment})`)
  expect(r.headings[0].id).toBe('heading-instalacion');expect(r.html).toContain('href="#heading-instalacion"');targets(r.html)
 })
 it('los repetidos y las colisiones con un título numerado tienen ids únicos',async()=>{
  const r=await markdownHTML('# Uno\n\n# Uno\n\n# Uno-1\n\n[primero](#uno) [segundo](#uno-1)')
  expect(r.headings.map(h=>h.id)).toEqual(['heading-uno','heading-uno-1','heading-uno-1-1']);targets(r.html)
  expect(r.html).toContain('href="#heading-uno"');expect(r.html).toContain('href="#heading-uno-1"')
 })
 it('respaldo seccion para signos/emoji y títulos que contienen enlaces',async()=>{
  const r=await markdownHTML('# !!!\n\n# 🐕\n\n# Guía con [enlace](https://example.com)\n\n[primero](#seccion) [segundo](#seccion-1) [tercero](#guia-con-enlace)')
  expect(r.headings.map(h=>h.id)).toEqual(['heading-seccion','heading-seccion-1','heading-guia-con-enlace']);targets(r.html)
 })
 it('un destino inexistente es un span sin href ni foco y conserva el contenido',async()=>{
  const r=await markdownHTML('[**ausente**](#Secci%C3%B3n-faltante)')
  expect(r.html).toContain('<span class="enlace-roto" data-seccion-faltante="Sección-faltante"><strong>ausente</strong></span>')
  expect(r.html).not.toContain('href=');expect(r.html).not.toContain('tabindex');targets(r.html)
  expect(standaloneHTML(r.html,'Documento')).toContain('.enlace-roto{')
 })
 it('un porcentaje mal formado no lanza excepciones y también se marca sin salto',async()=>{
  const r=await markdownHTML('[mal](#%ZZ)');expect(r.html).toContain('data-seccion-faltante="%ZZ"');expect(r.html).not.toContain('href=')
 })
 it('un fragmento mal codificado sigue roto aunque su slug coincida con un título',async()=>{
  const r=await markdownHTML('# ZZ\n\n[mal](#%ZZ)');expect(r.html).toContain('data-seccion-faltante="%ZZ"');expect(r.html).not.toContain('href=')
 })
 it('no toca # ni enlaces externos o mailto con fragmento',async()=>{
  const r=await markdownHTML('[inicio](#) [web](https://example.com/#Instalación) [correo](mailto:test@example.com#seccion)')
  expect(r.html).toContain('href="#"');expect(r.html).toContain('href="https://example.com/#Instalaci%C3%B3n"');expect(r.html).toContain('href="mailto:test@example.com#seccion"')
  expect(r.html).not.toContain('enlace-roto')
 })
 it('el corpus B cumple el invariante para cada href local no vacío',async()=>{
  const {readFile}=await import('node:fs/promises'),source=await readFile(new URL('./fixtures/markdown-corpus/b-links.md',import.meta.url),'utf8')
  const r=await markdownHTML(source);const stats=targets(r.html);expect(stats.hrefs.length).toBeGreaterThan(6);expect(r.html).toContain('enlace-roto')
 })
 it('el invariante cuenta elementos reales, no cadenas href/id dentro del código',async()=>{
  const r=await markdownHTML('```html\n<a href="#fantasma" id="falso">no es enlace</a>\n```')
  expect(localAnchorStats(r.html)).toEqual({ids:[],targets:[],duplicates:[],missing:[]})
 })
})
