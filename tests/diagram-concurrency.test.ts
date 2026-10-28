import {beforeEach,describe,expect,it,vi} from 'vitest'

const engine=vi.hoisted(()=>({theme:'default',renders:[] as {source:string;theme:string}[],initializations:[] as Record<string,unknown>[],parses:0,fail:false}))
vi.mock('mermaid',()=>({default:{
 initialize:(config:Record<string,unknown>)=>{engine.theme=String(config.theme);engine.initializations.push(config)},
 mermaidAPI:{getConfig:()=>({maxTextSize:50_000})},
 render:async(_id:string,source:string)=>{engine.renders.push({source,theme:engine.theme});return{svg:`<svg>${engine.theme}:${source}</svg>`}},
 parse:async()=>{engine.parses++;if(engine.fail)throw new Error('Parse error on line 2: falta un cierre')},
}}))
vi.mock('dompurify',async original=>{
 const module=await original<typeof import('dompurify')>()
 // Conserva la identidad de la factory de Node durante imports concurrentes del runner.
 const purify=Object.assign(module.default,{sanitize:(svg:string)=>svg})
 return{default:purify,sanitize:purify.sanitize}
})
beforeEach(async()=>{
 vi.resetModules();engine.theme='default';engine.renders=[];engine.initializations=[];engine.parses=0;engine.fail=false
 expect(typeof(await import('dompurify')).default.sanitize).toBe('function')
})

describe('A0 R1 · configuración por operación Mermaid',()=>{
 it('conserva el tema de dos renders claro y oscuro concurrentes',async()=>{
  const {diagramSVG}=await import('../src/renderer/lib/render')
  const [light,dark]=await Promise.all([diagramSVG('flowchart LR\n A[Claro] --> B[Fin]',false),diagramSVG('flowchart LR\n A[Oscuro] --> B[Fin]',true)])
  expect(light).toContain('<svg>default:');expect(dark).toContain('<svg>dark:')
  expect(engine.renders.map(item=>item.theme)).toEqual(['default','dark'])
  for(const config of engine.initializations)expect(config).toMatchObject({securityLevel:'strict',htmlLabels:false,flowchart:{htmlLabels:false}})
 })
 it('una validación oscura concurrente no contamina un render claro',async()=>{
  const {diagramSVG,validateDiagram}=await import('../src/renderer/lib/render')
  const [light]=await Promise.all([diagramSVG('flowchart LR\n A[Exportar] --> B[Claro]',false),validateDiagram('flowchart LR\n A[Validar] --> B[Oscuro]',true)])
  expect(light).toContain('<svg>default:');expect(engine.parses).toBe(1)
 })
 it('la caché clara conserva un SVG claro tras la carrera',async()=>{
  const {diagramSVG}=await import('../src/renderer/lib/render'),source='flowchart LR\n A[Guardado] --> B[Claro]'
  const [first]=await Promise.all([diagramSVG(source,false),diagramSVG('flowchart LR\n A[Otro] --> B[Oscuro]',true)])
  expect(await diagramSVG(source,false)).toBe(first)
  expect(first).toContain('<svg>default:');expect(engine.renders).toHaveLength(2)
 })
})
