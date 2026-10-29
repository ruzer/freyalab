import {describe,it,expect} from 'vitest'
import {markdownHTML,standaloneHTML} from '../src/renderer/lib/render'
const table='| A | B |\n| - | - |\n| 1 | 2 |\n\n: Datos **revisados** {#tbl:datos}'
const body='# Introducción\n\nTexto.\n\n## Resultados\n\n![**Ventas**](a.png){#fig:ventas}\n\n'+table
const doc=(metadata:string,content=body)=>`---\n${metadata}\n---\n\n${content}`
function anchors(html:string){const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));for(const match of html.matchAll(/href="#([^"]+)"/g))expect(ids.has(match[1])).toBe(true)}
describe('AC-02 · portada e índices optativos',()=>{
 it('muestra solo metadatos vetados y conserva el índice de encabezados del cuerpo',async()=>{
  const source=doc('portada: true\ntitle: Informe final\nsubtitle: Datos locales\nauthor: Ana Pérez\ndate: 2026-10-28\ninstitution: Universidad\nabstract: Resumen breve\nprivado: NOEXPORTAR'),copy=source,r=await markdownHTML(source)
  expect(r.html).toContain('class="report-cover"');for(const text of ['Informe final','Datos locales','Ana Pérez','2026-10-28','Universidad','Resumen breve'])expect(r.html).toContain(text)
  expect(r.html).not.toContain('NOEXPORTAR');expect(r.headings.map(heading=>heading.text)).toEqual(['Introducción','Resultados']);expect(source).toBe(copy)
 })
 it.each([
  ['author: [Ana, Luis]',['Ana','Luis']],
  ['author: ["Pérez, Ana", "Luis"]',['Pérez, Ana','Luis']],
  ["author: ['O''Brien', 'Luis']",["O'Brien",'Luis']],
  ['author:\n  - Ana\n  - Luis',['Ana','Luis']],
 ] as const)('conserva autores %s',async(value,names)=>{
  const r=await markdownHTML(doc('portada: true\ntitle: Informe\n'+value));for(const name of names)expect(r.html).toContain(name.replaceAll("'",'&#39;'))
 })
 it.each([
  ['abstract: |\n  Primera línea.\n  Segunda línea.','Primera línea.\nSegunda línea.'],
  ['abstract: >\n  Primera línea.\n  Segunda línea.','Primera línea. Segunda línea.'],
 ] as const)('admite resumen multilínea %s',async(value,expected)=>{expect((await markdownHTML(doc('portada: true\ntitle: Informe\n'+value))).html).toContain(expected)})
 it('escapa metadatos e índices sin interpretar HTML ni atributos',async()=>{
  const r=await markdownHTML(doc('portada: true\ntoc: true\ntitle: "<img src=x onerror=CANARIO>"\nauthor: "<script>CANARIO</script>"\nabstract: "</section><svg onload=CANARIO>"','# Texto <img src=x onerror=CANARIO>'))
  expect(r.html).toContain('&lt;img');expect(r.html).toContain('&lt;script&gt;');expect(r.html).not.toMatch(/<script|<svg|<img src=x|<section[^>]*onload/);anchors(r.html)
 })
 it.each([
  ['toc','report-toc','href="#heading-introduccion"'],
  ['lof','report-figures','href="#figure-1"'],
  ['lot','report-tables','href="#table-1"'],
 ] as const)('activa %s independientemente',async(key,kind,link)=>{
  const r=await markdownHTML(doc(`${key}: true`));expect(r.html).toContain(kind);expect(r.html).toContain(link);expect(r.html).not.toContain('report-cover');anchors(r.html)
  const other=['report-toc','report-figures','report-tables'].filter(item=>item!==kind);for(const item of other)expect(r.html).not.toContain(item)
 })
 it('índices completos tienen enlaces, sin números de página inventados',async()=>{
  const r=await markdownHTML(doc('portada: true\ntitle: Informe\ntoc: true\nlof: true\nlot: true'))
  for(const text of ['Contenido','Índice de figuras','Índice de tablas','Figura 1. Ventas','Tabla 1. Datos revisados'])expect(r.html).toContain(text)
  expect(r.html).not.toMatch(/página \d|page-number/);anchors(r.html)
 })
 it('exporta portada e índices, conservando el salto de página de portada',async()=>{
  const r=await markdownHTML(doc('portada: true\ntitle: Informe\ntoc: true')),html=standaloneHTML(r.html,'Informe')
  expect(html).toContain('report-cover');expect(html).toMatch(/report-cover[^}]*break-after:page/);expect(html).toContain('href="#heading-introduccion"');anchors(html)
 })
 it.each(['','title: SOLOPROPIEDADES','portada: false\ntoc: false\nlof: false\nlot: false','portada: "true"\ntoc: "true"'])('sin opciones activas no añade secciones: %s',async(metadata)=>{
  const r=await markdownHTML(doc(metadata));expect(r.html).not.toContain('report-cover');expect(r.html).not.toContain('report-index');expect(r.html).not.toContain('SOLOPROPIEDADES')
 })
 it('el idioma del documento también se aplica a los rótulos del reporte',async()=>{
  const r=await markdownHTML(doc('lang: en-US\nportada: true\ntitle: Report\nabstract: Summary text\ntoc: true\nlof: true\nlot: true'))
  for(const text of ['Contents','List of figures','List of tables','Abstract','Figure 1.','Table 1.'])expect(r.html).toContain(text);anchors(r.html)
 })
 it('el cambio de opciones no altera el texto original ni pierde tablas o tareas',async()=>{
  const source=doc('portada: true\ntoc: true',body+'\n\n- [ ] Revisar reporte'),r=await markdownHTML(source)
  expect(r.html).toContain('<table>');expect(r.tasks).toHaveLength(1);expect(r.tasks[0].expectedLine).toBe('- [ ] Revisar reporte');expect(r.frontMatter).toContain('portada: true')
 })
 it('los índices usan el pie resuelto y saneado, incluidas referencias cruzadas',async()=>{
  const r=await markdownHTML(doc('lof: true','![Ver [@fig:b]](a.png){#fig:a}\n\n![Segunda](a.png){#fig:b}'))
  expect(r.figures[0].caption).toBe('Ver Figura 2');expect(r.html.slice(0,r.html.indexOf('</nav>'))).not.toContain('[@fig:b]');anchors(r.html)
 })

})
