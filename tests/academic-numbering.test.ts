import {describe,it,expect} from 'vitest'
import {markdownHTML,standaloneHTML} from '../src/renderer/lib/render'

const figure=(key:string,caption='Pie **importante**')=>`![${caption}](a.png){#fig:${key}}`
const table=(key:string,caption='Datos *revisados*')=>`| A | B |\n| - | - |\n| 001 | 2 |\n\n: ${caption} {#tbl:${key}}`
function anchorInvariant(html:string){
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1])
 const links=[...html.matchAll(/href="#([^"]+)"/g)].map(match=>match[1])
 expect(new Set(ids).size).toBe(ids.length)
 for(const id of links)expect(ids).toContain(id)
 return links.length
}
describe('AC-01 · numeración portable',()=>{
 it.each([
  ['figura',figure('uno'),'Figura 1. Pie <strong>importante</strong>'],
  ['tabla',table('uno'),'Tabla 1. Datos <em>revisados</em>'],
  ['tres figuras',[figure('uno'),figure('dos'),figure('tres')].join('\n\n'),'Figura 3.'],
  ['tres tablas',[table('uno'),table('dos'),table('tres')].join('\n\n'),'Tabla 3.'],
  ['conteos independientes',[figure('uno'),table('uno'),figure('dos')].join('\n\n'),'Figura 2.'],
  ['referencia anterior','Ver [@fig:uno].\n\n'+figure('uno'),'href="#figure-1">Figura 1</a>'],
  ['referencia posterior',table('uno')+'\n\nVer [@tbl:uno].','href="#table-1">Tabla 1</a>'],
  ['referencia ausente','Ver [@fig:ausente].','class="enlace-roto"'],
  ['referencia ausente preserva etiqueta','Ver [@tbl:ausente].','[@tbl:ausente]'],
  ['inglés','---\nlang: en-US\n---\n'+figure('uno'),'Figure 1.'],
  ['tabla inglés','---\nlang: "en"\n---\n'+table('uno'),'Table 1.'],
  ['idioma por defecto','---\nlang: no-es-un-idioma\n---\n'+figure('uno'),'Figura 1.'],
  ['CRLF',figure('uno')+'\r\n\r\n[@fig:uno]','href="#figure-1">Figura 1</a>'],
  ['Unicode',figure('niñez','Niñez 🐕')+'\n\n[@fig:niñez]','href="#figure-1">Figura 1</a>'],
  ['formato en pie de figura',figure('uno','**Fuerte**, *cursiva* y `código`'),'<strong>Fuerte</strong>, <em>cursiva</em> y <code>código</code>'],
  ['corchete escapado',figure('uno','Pie \\] **visible**'),'<strong>visible</strong>'],
  ['figura en plegable','<details><summary>Datos</summary>\n\n'+figure('uno')+'\n\n</details>','Figura 1.'],
  ['tabla sin línea vacía antes del pie',table('uno').replace('\n\n:', '\n:'),'Tabla 1.'],
  ['figura con referencia de imagen','![**Datos**][imagen]{#fig:uno}\n\n[imagen]: a.png','Figura 1. <strong>Datos</strong>'],
 ] as const)('%s',async(_,source,expected)=>{
  const copy=source,result=await markdownHTML(source)
  expect(result.html).toContain(expected);expect(source).toBe(copy);anchorInvariant(result.html)
 })
 it('avisa del duplicado sin crear ids repetidos y referencia la primera figura',async()=>{
  const result=await markdownHTML(figure('igual')+'\n\n'+figure('igual')+'\n\n[@fig:igual]')
  expect(result).toMatchObject({warnings:[expect.stringContaining('fig:igual')]})
  expect(result.html).toContain('Figura 2.');expect(result.html).toContain('href="#figure-1">Figura 1</a>');anchorInvariant(result.html)
 })
 it('renumera al mover o quitar una figura sin modificar la fuente',async()=>{
  const a=figure('a'),b=figure('b'),ref='[@fig:a]'
  expect((await markdownHTML(a+'\n\n'+b+'\n\n'+ref)).html).toContain('href="#figure-1">Figura 1</a>')
  expect((await markdownHTML(b+'\n\n'+a+'\n\n'+ref)).html).toContain('href="#figure-2">Figura 2</a>')
  expect((await markdownHTML(a+'\n\n'+ref)).html).toContain('href="#figure-1">Figura 1</a>')
 })
 it.each([
  ['imagen normal','![Normal](a.png)'],['tabla normal','| A |\n| - |\n| 1 |'],
  ['código cercado','```md\n'+figure('uno')+'\n[@fig:uno]\n```'],
  ['código en línea','`[@fig:uno]`'],['atributo ajeno','![Pie](a.png){#fig:uno onclick="x()"}'],
 ] as const)('no numera %s',async(_,source)=>{
  const result=await markdownHTML(source);expect(result.html).not.toContain('Figura 1.');expect(result.html).not.toContain('Tabla 1.');expect(result.html).not.toContain('<figure')
 })
 it('sanea pies, atributos, enlaces y referencias hostiles',async()=>{
  const result=await markdownHTML(figure('uno','<script>CANARIO</script> [mal](javascript:alert(1))')+'\n\n[@fig:uno]\n\n<figure id="figure-1" onclick="x()">crudo</figure>')
  expect(result.html).toContain('Figura 1.');expect(result.html).not.toMatch(/(?:^|>)\s*<script|onclick=|href="javascript:/);anchorInvariant(result.html)
 })
 it('exporta el mismo número y estilo de pies sin activar HTML crudo',async()=>{
  const result=await markdownHTML(figure('uno')+'\n\n'+table('uno')+'\n\n[@fig:uno] [@tbl:uno]')
  const html=standaloneHTML(result.html,'Informe')
  expect(html).toContain('<figcaption>Figura 1.');expect(html).toContain('<figcaption>Tabla 1.');expect(html).toContain('figcaption');anchorInvariant(html)
 })
 it('el pie sigue siendo contenido en línea aunque empiece por una lista o título',async()=>{
  for(const caption of ['- Elemento **visible**','1. Elemento **visible**','# Título **visible**']){
   const r=await markdownHTML(table('uno',caption));expect(r.html).toContain('<strong>visible</strong>');expect(r.html).not.toMatch(/<li|<h1/)
  }
 })
 it('un encabezado de tabla parecido a un pie no se consume como una fila posterior',async()=>{
  const r=await markdownHTML(': Encabezado {#tbl:parecido}\n| --- |')
  expect(r.html).toContain('Encabezado');expect(r.html).toContain('{#tbl:parecido}');expect(r.html).not.toContain('<figure')
 })

})
