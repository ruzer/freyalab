import {describe,it,expect} from 'vitest'
import {prepareTextStats,countSelectedWords,type PreparedTextStats} from '../src/renderer/lib/text-stats'

function finish<T>(job:Generator<void,T>):T {let step=job.next();while(!step.done)step=job.next();return step.value}
const stats=(source:string)=>finish(prepareTextStats(source))
const selected=(prepared:PreparedTextStats,from:number,to:number)=>finish(countSelectedWords(prepared,{from,to}))

describe('FL-MD-003 · palabras de prosa y bloques excluidos',()=>{
 it.each([
  ['vacío','',0],
  ['solo BOM','\ufeff',0],
  ['signos sin palabras','... !!! — ¿?',0],
  ['texto sencillo','Hola, mundo.',2],
  ['números conservados','123 045',2],
  ['fecha por segmentos numéricos','2026-10-27',3],
  ['acentos','café acción pingüino',3],
  ['marca combinada','cafe\u0301',1],
  ['apóstrofes',"l'été d'Artagnan",2],
  ['guion entre palabras','hola-mundo',2],
  ['emoji y prosa','🐕 Freya 🐾',1],
  ['CJK sin espacios','你好世界',2],
  ['mezcla de idiomas','hola 你好世界 mundo',4],
  ['título','# Título claro',2],
  ['viñetas','- uno\n- dos',2],
  ['marcadores de lista numerada','1. uno\n2. dos',2],
  ['tareas sin contar x','- [ ] uno\n- [x] dos',2],
  ['tabla GFM','| Uno | Dos |\n| --- | --- |\n| tres | cuatro |',4],
  ['código en línea es texto restante','`hola mundo`',2],
  ['front matter','---\ntitle: Hola mundo\n---\nTexto final',2],
  ['solo front matter','---\ntitle: Hola mundo\n---\n',0],
  ['cierre alternativo de propiedades','---\ntitle: Hola mundo\n...\nTexto final',2],
  ['front matter sin cierre no se inventa','---\ntitle: hola',2],
  ['separador entre párrafos','antes\n\n---\n\ndespués',2],
  ['BOM y CRLF','\ufeff---\r\nlang: es\r\n---\r\nsolo una frase',3],
  ['CR aislado no amplía la regla de front matter del render','---\rtitle: oculto\r---\rtexto',3],
  ['solo código cercado','```js\nno cuenta\n```',0],
  ['código entre prosa','antes\n\n```js\nno cuenta\n```\n\ndespués',2],
  ['cerca Mermaid','```mermaid\nflowchart LR\n A --> B\n```\n\nfinal',1],
  ['cerca de tildes','~~~python\nno cuenta\n~~~',0],
  ['cierre menor no cierra cerca','````js\n```\nno cuenta\n````',0],
  ['cerca sin cerrar','antes\n\n```py\noculto dos palabras',1],
  ['código indentado','    no cuenta\n    tampoco esto',0],
  ['código con tabulador','\tno cuenta',0],
  ['sangría que continúa párrafo','antes\n    esto sigue párrafo',4],
  ['cerca dentro de cita','> ```mermaid\n> flowchart LR\n> A --> B\n> ```\n\nfinal',1],
  ['código indentado en cita','>     no cuenta\n\nfinal',1],
  ['cerca dentro de lista','- texto\n\n  ```py\n  oculto\n  ```\n\n- final',2],
  ['código indentado en lista','- texto\n\n      oculto\n\n- final',2],
 ] as const)('%s',(_,source,words)=>{expect(stats(source).words).toBe(words)})

 it.each([
  ['sin idioma','hola','es'],
  ['inglés de documento','---\nlang: en-US\n---\nhola','en-US'],
  ['chino de documento','---\nlang: zh\n---\n你好世界','zh'],
  ['scalar entre comillas y comentario','---\nlang: "es-MX" # idioma\n---\nhola','es-MX'],
  ['scalar entre comillas simples',"---\nlang: 'en-GB'\n---\nhola",'en-GB'],
  ['valor inválido','---\nlang: no_es_locale\n---\nhola','es'],
  ['idioma no soportado','---\nlang: zz-ZZ\n---\nhola','es'],
  ['campo anidado no es idioma global','---\nmeta:\n  lang: zh\n---\nhola','es'],
  ['otro nombre de campo no crea alias','---\nlanguage: en\n---\nhola','es'],
 ] as const)('idioma: %s',(_,source,language)=>{expect(stats(source).language).toBe(language)})

 it.each([[0,'< 1 min'],[1,'< 1 min'],[199,'< 1 min'],[200,'1 min'],[201,'2 min'],[400,'2 min']] as const)('%i palabras → %s',(words,reading)=>{
  const result=stats('palabra '.repeat(words));expect(result.words).toBe(words);expect(result.reading).toBe(reading)
 })
})

describe('FL-MD-003 · texto plano literal',()=>{
 it.each([
  ['cercas','```text\nHola mundo\n```',3],
  ['YAML y lang son texto','---\nlang: zh\n---\nHola mundo',4],
  ['números de lista','1. uno\n2. dos',4],
 ] as const)('%s',(_,source,words)=>{
  const prepared=finish(prepareTextStats(source,false))
  expect(prepared.words).toBe(words);expect(prepared.language).toBe('es')
  expect(selected(prepared,0,prepared.textLF.length)).toBe(words)
 })
})

describe('FL-MD-003 · selección sobre el contexto completo',()=>{
 const source='uno antes\n\n```py\noculto dos\n```\n\ntres después'
 it.each([
  ['todo',0,source.length,4],
  ['vacía',3,3,0],
  ['solo código',source.indexOf('oculto'),source.indexOf('dos')+3,0],
  ['cruza código',source.indexOf('antes'),source.indexOf('tres')+4,2],
  ['invertida',source.length,0,4],
  ['límites externos',-100,source.length+100,4],
 ] as const)('%s',(_,from,to,words)=>{expect(selected(stats(source),from,to)).toBe(words)})
 it('seleccionar propiedades no las vuelve prosa',()=>{
  const source='---\ntitle: oculto\n---\ntexto final',prepared=stats(source)
  expect(selected(prepared,0,source.indexOf('texto'))).toBe(0)
  expect(selected(prepared,source.indexOf('oculto'),source.length)).toBe(2)
 })
 it('selección de lista/tarea no cuenta sus marcadores',()=>{
  const prepared=stats('1. uno\n2. dos\n\n- [x] tres')
  expect(selected(prepared,0,2)).toBe(0);expect(selected(prepared,prepared.textLF.indexOf('[x]'),prepared.textLF.length)).toBe(1)
 })
 it('normaliza una copia LF y selecciona usando offsets lógicos de CodeMirror',()=>{
  const source='uno\r\n\r\n```py\r\noculto\r\n```\r\n\r\nfinal',before=source,prepared=stats(source)
  expect(prepared.textLF).not.toContain('\r');expect(source).toBe(before);expect(source).toContain('\r\n')
  expect(selected(prepared,prepared.textLF.indexOf('oculto'),prepared.textLF.length)).toBe(1)
 })
 it('Unicode y selección parcial mantienen segmentos sin convertir la fuente',()=>{
  const prepared=stats('🐕 café y acción')
  expect(selected(prepared,0,2)).toBe(0);expect(selected(prepared,4,7)).toBe(1)
 })
 it('no vuelve a analizar Markdown al contar selecciones de una instantánea preparada',()=>{
  const prepared=stats(source),original=prepared.textLF
  expect(selected(prepared,0,3)).toBe(1);expect(selected(prepared,source.indexOf('tres'),source.length)).toBe(2)
  expect(prepared.textLF).toBe(original);expect(prepared.words).toBe(4)
 })
 it('cede por lotes, sin introducir un rendimiento dependiente del reloj',()=>{
  const job=prepareTextStats('palabra '.repeat(3000));let step=job.next(),yields=0
  while(!step.done){yields++;step=job.next()}
  expect(step.value.words).toBe(3000);expect(yields).toBeGreaterThan(2);expect(yields).toBeLessThan(100)
 })
})
