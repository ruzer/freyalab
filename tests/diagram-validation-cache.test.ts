import {beforeEach,describe,expect,it,vi} from 'vitest'

const state=vi.hoisted(()=>({calls:[] as string[]}))
vi.mock('mermaid',()=>({default:{
 initialize:()=>{},mermaidAPI:{getConfig:()=>({maxTextSize:50_000})},
 parse:async(source:string)=>{state.calls.push(source);if(source==='invalido')throw new Error('Parse error on line 2')},
 render:async()=>({svg:'<svg>válido</svg>'}),
}}))
vi.mock('dompurify',()=>({default:{sanitize:(svg:string)=>svg}}))
beforeEach(()=>{vi.resetModules();state.calls=[]})

describe('A0 R2 · validación acotada por tema y fuente',()=>{
 it('valida una sola vez un bloque sin cambios durante pausas consecutivas',async()=>{
  const {validateDiagram}=await import('../src/renderer/lib/render')
  await validateDiagram('flowchart LR\n A-->B',false);await validateDiagram('flowchart LR\n A-->B',false)
  expect(state.calls).toHaveLength(1)
 })
 it('comparte una validación pendiente para la misma clave',async()=>{
  const {validateDiagram}=await import('../src/renderer/lib/render')
  await Promise.all([validateDiagram('flowchart LR\n A-->B',true),validateDiagram('flowchart LR\n A-->B',true)])
  expect(state.calls).toHaveLength(1)
 })
 it('una fuente o tema distinto requiere su propia validación',async()=>{
  const {validateDiagram}=await import('../src/renderer/lib/render')
  await validateDiagram('flowchart LR\n A-->B',false);await validateDiagram('flowchart LR\n A-->B',true);await validateDiagram('flowchart LR\n A-->C',true)
  expect(state.calls).toHaveLength(3)
 })
 it('un SVG ya preparado demuestra validez sin volver a parsearlo',async()=>{
  const {diagramSVG,validateDiagram}=await import('../src/renderer/lib/render')
  await diagramSVG('flowchart LR\n A-->B',false);await validateDiagram('flowchart LR\n A-->B',false)
  expect(state.calls).toHaveLength(0)
 })
 it('limita a 64 fuentes y vuelve a validar la expulsada',async()=>{
  const {validateDiagram}=await import('../src/renderer/lib/render')
  for(let index=0;index<65;index++)await validateDiagram(`flowchart LR\n A[${index}]-->B`,false)
  await validateDiagram('flowchart LR\n A[0]-->B',false)
  expect(state.calls).toHaveLength(66)
 })
 it('no convierte un error en una validación válida ni bloquea el siguiente trabajo',async()=>{
  const {validateDiagram}=await import('../src/renderer/lib/render')
  await expect(validateDiagram('invalido',false)).rejects.toThrow('Parse error on line 2')
  await expect(validateDiagram('invalido',false)).rejects.toThrow('Parse error on line 2')
  await validateDiagram('flowchart LR\n A-->B',false)
  expect(state.calls).toEqual(['invalido','invalido','flowchart LR\n A-->B'])
 })
 it('conserva el límite de texto y no llama al parser al superarlo',async()=>{
  const {validateDiagram}=await import('../src/renderer/lib/render')
  await expect(validateDiagram('x'.repeat(50_001),false)).rejects.toThrow('Maximum text size in diagram exceeded')
  expect(state.calls).toHaveLength(0)
 })
})
