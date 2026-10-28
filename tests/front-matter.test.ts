import {describe,expect,it} from 'vitest'
import {frontMatterOf,parseTags} from '../src/shared/front-matter'

describe('FL-MD-009 A · etiquetas del front matter',()=>{
 it.each([
  ['sin encabezado',undefined,[]],
  ['vacío','',[]],
  ['sin tags','title: Informe',[]],
  ['solo clave minúscula','Tags: [a]\nTAGS: [b]',[]],
  ['clave anidada','meta:\n  tags: [a]',[]],
  ['raíz después de otra clave','meta:\n  tags: [anidada]\ntags: [raíz]',['raíz']],
  ['lista en línea','tags: [proyecto, informe, 2026]',['proyecto','informe','2026']],
  ['comas sin lista','tags: proyecto, informe',['proyecto','informe']],
  ['una etiqueta','tags: proyecto',['proyecto']],
  ['número textual','tags: 2026',['2026']],
  ['ceros e identificadores textuales','tags: [00123, 999999999999999999999]',['00123','999999999999999999999']],
  ['espacios','tags: [  a ,  b  ]',['a','b']],
  ['prefijo almohadilla','tags: [#proyecto, "#informe", \'#2026\']',['proyecto','informe','2026']],
  ['espacios tras el prefijo','tags: "# informe final"',['informe final']],
  ['comillas dobles','tags: "a, b"',['a, b']],
  ['comillas simples','tags: \'a, b\'',['a, b']],
  ['comas entre valores entrecomillados','tags: ["a, b", \'c, d\', e]',['a, b','c, d','e']],
  ['comentario final','tags: [a, b] # nota',['a','b']],
  ['comentario suelto','tags: a, b # nota',['a','b']],
  ['almohadilla literal entre comillas','tags: ["a # b", \'c # d\']',['a # b','c # d']],
  ['almohadilla interior','tags: a#b',['a#b']],
  ['vacíos','tags: [a,,b, "", \'\', #]',['a','b']],
  ['lista vacía','tags: []',[]],
  ['clave vacía','tags:',[]],
  ['clave nula','tags: null',[]],
  ['nulo YAML','tags: ~',[]],
  ['booleano','tags: true',[]],
  ['tipo no textual mezclado','tags: [a, false]',[]],
  ['literal nulo entre comillas','tags: ["null", \'false\']',['null','false']],
  ['objeto','tags: {proyecto: a}',[]],
  ['objeto dentro de lista','tags: [a, {nombre: b}]',[]],
  ['lista anidada','tags: [a, [b]]',[]],
  ['lista en varias líneas','tags: [a,\n b]',[]],
  ['comillas sin cerrar','tags: ["a, b]',[]],
  ['contenido tras comillas','tags: "a" texto',[]],
  ['objeto suelto','tags: clave: valor',[]],
  ['bloque literal','tags: |\n  a',[]],
  ['bloque plegado','tags: >\n  a',[]],
  ['alias','tags: *otra',[]],
  ['ancla','tags: &otra a',[]],
  ['tipo explícito','tags: !!str a',[]],
  ['primera clave repetida','tags: [primera]\ntags: [segunda]',['primera']],
  ['primera vacía repetida','tags:\ntags: [segunda]',[]],
  ['primera inválida repetida','tags: {a: b}\ntags: [segunda]',[]],
  ['lista en bloque','tags:\n  - proyecto\n  - "informe final"',['proyecto','informe final']],
  ['bloque con sangrías distintas','tags:\n - uno\n    - dos\n\t- tres',['uno','dos','tres']],
  ['bloque con lista sin sangría','tags:\n- uno\n- dos\ntitle: Informe',['uno','dos']],
  ['bloque y comentarios','tags: # nota\n  # comentario\n  - uno # final\n\n  - "dos # literal"\nother: valor',['uno','dos # literal']],
  ['bloque con comas literales','tags:\n - uno, dos\n - \'tres, cuatro\'',['uno, dos','tres, cuatro']],
  ['bloque con vacíos','tags:\n  -\n  - ""\n  - #\n  - a',['a']],
  ['objeto en bloque','tags:\n  - uno\n  - {nombre: dos}',[]],
  ['valor anidado no entendido','tags:\n  nombre: uno',[]],
  ['CRLF','tags:\r\n  - proyecto\r\n  - 2026\r\ntitle: Informe',['proyecto','2026']],
  ['HTML y rutas son texto','tags: [<script>alert(1)</script>, ../dato, proyecto/2026]',['<script>alert(1)</script>','../dato','proyecto/2026']],
  ['dedupe por acentos y mayúsculas','tags: [Árbol, arbol, ÁRBOL, árbol, Proyecto, proyecto]',['Árbol','Proyecto']],
  ['dedupe por acento combinado','tags: [Café, Café]',['Café']],
  ['emoji','tags: [🐶, 👩🏽‍💻, proyecto/2026]',['🐶','👩🏽‍💻','proyecto/2026']],
 ] as const)('%s',(_label,source,expected)=>{expect(parseTags(source)).toEqual(expected)})
 it('conserva las primeras 50 etiquetas únicas',()=>{
  const tags=Array.from({length:51},(_,index)=>`etiqueta${index}`)
  expect(parseTags(`tags: [${tags.join(',')}]`)).toEqual(tags.slice(0,50))
 })
 it('los duplicados y los valores vacíos no consumen el límite de 50',()=>{
  const tags=Array.from({length:50},(_,index)=>`etiqueta${index}`)
  expect(parseTags(`tags: [${tags.flatMap(tag=>[tag,tag.toUpperCase(),'']).join(',')}]`)).toEqual(tags)
 })
 it('descarta valores de más de 64 puntos Unicode sin partir pares sustitutos',()=>{
  const accepted='🐶'.repeat(64),rejected='🐶'.repeat(65)
  expect(parseTags(`tags: [${accepted}, ${rejected}, ${'á'.repeat(64)}, ${'a'.repeat(65)}, final]`)).toEqual([accepted,'á'.repeat(64),'final'])
 })
 it.each(['\n','\r\n'])('lee el front matter con BOM y cierre ... con %j sin modificar la fuente',newline=>{
  const source=['\ufeff---','title: Informe','tags: [Árbol, 2026]','...','# Contenido'].join(newline),before=source
  const separated=frontMatterOf(source)
  expect(parseTags(separated.frontMatter)).toEqual(['Árbol','2026'])
  expect(separated.body).toBe('# Contenido');expect(source).toBe(before)
 })
})

describe('frontMatterOf · comportamiento compartido conservado',()=>{
 it.each([
  ['---\ntitle: Informe\n---\n# Texto',{body:'# Texto',frontMatter:'title: Informe\n'}],
  ['---\r\ntitle: Informe\r\n...\r\n# Texto',{body:'# Texto',frontMatter:'title: Informe\r\n'}],
  ['\ufeff---\ntags: [a]\n---',{body:'',frontMatter:'tags: [a]\n'}],
  ['---\ntitle: Abierto\n# Texto',{body:'---\ntitle: Abierto\n# Texto'}],
  ['Texto\n---\ntags: [a]\n---',{body:'Texto\n---\ntags: [a]\n---'}],
 ] as const)('conserva %j',(source,expected)=>{expect(frontMatterOf(source)).toEqual(expected)})
})
