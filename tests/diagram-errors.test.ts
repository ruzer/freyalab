import {describe,it,expect} from 'vitest'
import capture from './fixtures/diagram-errors.json'
import {explainDiagramError} from '../src/renderer/lib/diagram-errors'

// Captura real 2026-10-26, Mermaid 12.2.0 del lockfile: cada `source` se guardó
// como .mmd, se abrió con window.freya.openPaths en Electron sobre main d17c427
// y se leyó .diagram-error pre tras el debounce. Esto ejecuta diagramSVG /
// mermaid.render con la configuración strict/htmlLabels:false original, sin mocks
// ni initialize alternativo. La fixture guarda el mensaje exacto, incluidos EOF
// y la línea 3 que flowchart añade aunque la fuente tenga dos líneas.
describe('explicaciones de errores reales de Mermaid 12.2.0',()=>{
 it('el corpus cubre al menos diez fuentes inválidas reales y todos los tipos pedidos',()=>{
  expect(capture.version).toBe('12.2.0');expect(capture.fixtures.length).toBeGreaterThanOrEqual(10)
  for(const id of ['flowchart-corchete','sequence','class','state','er','gantt','pie','tipo','vacio','flowchart-comilla'])expect(capture.fixtures.some(item=>item.id===id)).toBe(true)
 })
 it.each(capture.fixtures)('$id: conserva el detalle, informa en español y respeta la línea del parser',fixture=>{
  const result=explainDiagramError(fixture.message,fixture.source)
  expect(result.detail).toBe(fixture.message)
  expect(result.title.length).toBeGreaterThan(10);expect(result.hint.length).toBeGreaterThan(15)
  expect(result.title+' '+result.hint).not.toMatch(/Parse error|Expecting|got |No diagram type|Lexer error|Parsing failed|EOF_IN_STRUCT|unexpected character/i)
  expect(result.hint).toMatch(/revisa|cierra|añade|completa|escribe|empieza|prueba|indica/i)
  if('line' in fixture)expect(result.line).toBe(fixture.line)
 })
 it('un corchete abierto obtiene una pista concreta',()=>{
  const f=capture.fixtures.find(item=>item.id==='flowchart-corchete')!,r=explainDiagramError(f.message,f.source)
  expect(r.kind).toBe('sintaxis');expect(r.hint).toMatch(/corchete/);expect(r.hint).toContain(']')
 })
 it('una comilla abierta no se confunde con el corchete',()=>{
  const f=capture.fixtures.find(item=>item.id==='flowchart-comilla')!
  expect(explainDiagramError(f.message,f.source).hint).toMatch(/comillas/)
 })
 it.each(['flowchart-flecha','sequence','state','er'])('%s explica una relación incompleta o inválida',id=>{
  const f=capture.fixtures.find(item=>item.id===id)!,r=explainDiagramError(f.message,f.source)
  expect(r.kind).toBe('sintaxis');expect(r.hint).toMatch(/flecha|relación/)
 })
 it('el fin inesperado pide completar el diagrama',()=>{
  const f=capture.fixtures.find(item=>item.id==='flowchart-fin')!,r=explainDiagramError(f.message,f.source)
  expect(r.kind).toBe('sintaxis');expect(r.title+' '+r.hint).toMatch(/completa|termina|final/i)
 })
 it('pie conserva la columna real, sin deducirla de las rayas del mensaje',()=>{
  const f=capture.fixtures.find(item=>item.id==='pie')!,r=explainDiagramError(f.message,f.source)
  expect(r.line).toBe(2);expect(r.column).toBe(10);expect(r.hint).toMatch(/número/)
 })
 it('tipo desconocido señala el encabezado no vacío',()=>{
  const message='No diagram type detected matching given configuration for text: extraño'
  const r=explainDiagramError(message,'\n\nextraño\n A --> B')
  expect(r.kind).toBe('tipo');expect(r.line).toBe(3);expect(r.hint).toContain('flowchart LR')
 })
 it.each(['',' \n\t ','\r\n  '])('fuente vacía %j invita a empezar, sin inventar línea',source=>{
  const r=explainDiagramError('No diagram type detected matching given configuration for text: ',source)
  expect(r.kind).toBe('vacio');expect(r.line).toBeUndefined();expect(r.column).toBeUndefined()
 })
 it('la clase sin cierre propone cerrar su llave',()=>{
  const f=capture.fixtures.find(item=>item.id==='class')!
  expect(explainDiagramError(f.message,f.source).hint).toMatch(/llave/)
 })
 it.each(['flowchart LR\n A[Inicio','flowchart LR\n A["Inicio]'])('un error de sintaxis sin línea ofrece una pista sin ubicaciones inventadas: %s',source=>{
  const message='Syntax error in text',r=explainDiagramError(message,source)
  expect(r.kind).toBe('sintaxis');expect(r.line).toBeUndefined();expect(r.column).toBeUndefined()
  expect(r.hint).not.toContain('anterior');expect(r.hint).toMatch(/^Revisa la definición: cierra/);expect(r.detail).toBe(message)
 })
 it('un error desconocido con HTML se conserva solo en detail',()=>{
  const message='<img src=x onerror=alert(1)> & "problema"',r=explainDiagramError(message,'flowchart LR\n A --> B')
  expect(r.kind).toBe('otro');expect(r.detail).toBe(message);expect(r.title+r.hint).not.toContain('<img');expect(r.line).toBeUndefined()
 })
 it('no confunde comillas dentro de un comentario con texto sin cerrar',()=>{
  const r=explainDiagramError('Parse error on line 3: got EOF','flowchart LR\n %% "comentario\n A -->')
  expect(r.hint).not.toMatch(/comillas/)
 })
 it('un diagrama excesivo ofrece reducirlo, sin recorrer su sintaxis',()=>{
  const r=explainDiagramError('Maximum text size in diagram exceeded','flowchart LR\n'+' A --> B\n'.repeat(20000))
  expect(r.kind).toBe('otro');expect(r.hint).toMatch(/reduc|divide|pequeñ/i);expect(r.detail).toBe('Maximum text size in diagram exceeded')
 })
 it('un número de línea inválido no produce ubicaciones falsas',()=>{
  const r=explainDiagramError('Parse error on line 0, column 4: got EOF','flowchart LR\n A -->')
  expect(r.line).toBeUndefined();expect(r.column).toBeUndefined()
 })
})
