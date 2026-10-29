import {describe,it,expect} from 'vitest'
import {markdownHTML} from '../src/renderer/lib/render'
import type {BibliographyEntry} from '../src/shared/bibliography'
import {bibliographyPath} from '../src/shared/bibliography-source'
const entries:BibliographyEntry[]=[{id:'garcia2020',type:'book',title:'Estudio local',author:[{family:'García',given:'Ana'}],issued:{'date-parts':[[2020]]}},{id:'chen2021',type:'article-journal',title:'Datos revisados',author:[{family:'Chen',given:'Luis'}],issued:{'date-parts':[[2021]]}}]
describe('AC-03 · citas portables sin motor CSL en JavaScript',()=>{
 it('resuelve la cita autor-año y conserva su fuente',async()=>{
  const source='Véase [@garcia2020].',copy=source
  const r=await markdownHTML(source,{bibliography:entries})
  expect(r.html).toContain('García, 2020');expect(source).toBe(copy)
 })
 it('conserva el localizador de página',async()=>{expect((await markdownHTML('Véase [@garcia2020, p. 10].',{bibliography:entries})).html).toContain('p. 10')})
 it('admite la forma narrativa',async()=>{expect((await markdownHTML('@garcia2020 explica los resultados.',{bibliography:entries})).html).toContain('García')})
 it('marca claves ausentes y las enumera como problemas',async()=>{
  const r=await markdownHTML('[@ausente]',{bibliography:entries})
  expect(r.html).toContain('citation-missing');expect(r.warnings.some(message=>message.includes('ausente'))).toBe(true)
 })
 it('incluye solamente las referencias citadas',async()=>{
  const r=await markdownHTML('[@garcia2020]',{bibliography:entries})
  expect(r.html).toContain('Estudio local');expect(r.html).not.toContain('Datos revisados')
 })
 it('no interpreta correo o código como una cita',async()=>{
  const r=await markdownHTML('correo@example.com y `[@garcia2020]`\n\n```md\n[@chen2021]\n```',{bibliography:entries})
  expect(r.html).toContain('correo@example.com');expect(r.html).not.toContain('Estudio local');expect(r.html).not.toContain('Datos revisados')
 })
 it('convive con las referencias de figuras y notas al pie',async()=>{
  const r=await markdownHTML('![Datos](a.png){#fig:datos}\n\n[@fig:datos] y [@garcia2020], nota[^n].\n\n[^n]: Una nota.',{bibliography:entries})
  expect(r.html).toContain('Figura 1');expect(r.html).toContain('García, 2020');expect(r.html).toContain('Una nota.')
 })
 it('nunca convierte los datos bibliográficos en HTML ejecutable',async()=>{
  const r=await markdownHTML('[@hostil]',{bibliography:[{id:'hostil',type:'book',title:'<script>CANARIO</script>',author:[{literal:'<img onerror=CANARIO>'}],issued:{'date-parts':[[2026]]}}]})
  expect(r.html).toContain('CANARIO');expect(r.html).not.toMatch(/<script|<img onerror/)
 })
 it('combina varias fuentes sin repetir su bibliografía',async()=>{
  const r=await markdownHTML('[@garcia2020; @chen2021, p. 8]. También [@garcia2020].',{bibliography:entries})
  expect(r.html).toContain('(García, 2020; Chen, 2021, p. 8)');expect(r.html.match(/Estudio local/g)).toHaveLength(1)
  expect(r.html.match(/Datos revisados/g)).toHaveLength(1)
 })
 it('conserva la puntuación que sigue a una cita narrativa',async()=>{
  const r=await markdownHTML('Así lo explicó @garcia2020.',{bibliography:entries})
  expect(r.html).toContain('García (2020)</a>.');expect(r.warnings).toEqual([])
 })
 it.each(['\\@garcia2020','\\[@garcia2020]'])('respeta la cita escapada %s',async source=>{
  const r=await markdownHTML(source,{bibliography:entries})
  expect(r.citations).toHaveLength(0);expect(r.html).not.toContain('Estudio local')
 })
 it('distingue una cita escapada y otra real en el mismo párrafo',async()=>{
  const r=await markdownHTML('\\[@garcia2020] y [@garcia2020].',{bibliography:entries})
  expect(r.citations).toHaveLength(1);expect(r.html).toContain('[@garcia2020] y <a');expect(r.html).toContain('García, 2020')
 })
 it.each([
  '![Datos de [@garcia2020]](a.png){#fig:datos}',
  '| A |\n| - |\n| B |\n\n: Datos de [@garcia2020] {#tbl:datos}',
 ])('resuelve citas de un pie sin perder su origen: %s',async source=>{
  const r=await markdownHTML(source,{bibliography:entries})
  expect(r.citations).toHaveLength(1);expect(r.html).toMatch(/<figcaption>.*García, 2020/)
 })
 it('un pie de figura conserva una cita escapada como texto',async()=>{
  const r=await markdownHTML('![Datos de \\[@garcia2020]](a.png){#fig:datos}',{bibliography:entries})
  expect(r.citations).toHaveLength(0);expect(r.html).toContain('Datos de [@garcia2020]')
 })
 it('no convierte figuras ausentes en claves de bibliografía',async()=>{
  const r=await markdownHTML('[@fig:ausente]',{bibliography:entries})
  expect(r.html).toContain('enlace-roto');expect(r.citations).toHaveLength(0)
 })
 it('no interpreta arrobas de un documento que no declara bibliografía',async()=>{
  const r=await markdownHTML('Escribe @garcia2020 o [@chen2021].')
  expect(r.citations).toHaveLength(0);expect(r.html).not.toContain('document-bibliography')
 })
 it.each([
  ['bibliography: refs.json','refs.json'],
  ['bibliography: "refs con espacios.json"','refs con espacios.json'],
  ["bibliography: 'it''s.json' # datos","it's.json"],
  ['title: Sin fuentes',undefined],
  ['bibliography: refs.json\r\ntitle: CRLF','refs.json'],
 ])('lee la ruta declarada sin modificarla: %s',(source,expected)=>{expect(bibliographyPath(source)).toBe(expected)})
})
it.each(['[@gar','Texto [@gar'])('no anuncia una clave rota mientras la cita %s sigue abierta',async source=>{
 const result=await markdownHTML(source,{bibliography:entries})
 expect(result.citations).toEqual([]);expect(result.warnings).toEqual([]);expect(result.html).toContain(source)
})
