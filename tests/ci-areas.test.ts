import {execFileSync,spawnSync} from 'node:child_process'
import {readdirSync} from 'node:fs'
import {basename} from 'node:path'
import {expect,it} from 'vitest'
import {classifyPaths} from '../scripts/ci-areas.mjs'
import {areaCommand} from '../scripts/ci-e2e-area.mjs'
import {mdFiles,shellFiles} from './e2e/groups'

const all=['shell','md','csv']
const full={checks:true,unit:true,e2e:all,full:true,package:false,specs:[],docsOnly:false}

it.each([
 ['src/renderer/components/MarkdownToolbar.svelte',['shell','md'],false],
 ['src/renderer/components/TextStats.svelte',['shell','md'],false],
 ['src/renderer/lib/markdown-editing.ts',['shell','md'],false],
 ['src/renderer/components/CsvTable.svelte',['shell','csv'],false],
 ['src/renderer/lib/csv-text-model.ts',['shell','csv'],false],
 ['src/renderer/components/AnalysisDock.svelte',['shell','csv'],false],
 ['src/main/table-worker.ts',['shell','csv'],true],
 ['src/main/large-search-worker.ts',['shell','csv'],true],
 ['tests/markdown-commands.test.ts',[],false],
 ['tests/documents.test.ts',[],false],
 ['tests/nested/regression.test.ts',[],false],
] as const)('%s selecciona sus áreas y el paquete cuando corresponde',(path,e2e,pack)=>{
 expect(classifyPaths([path])).toEqual({...full,e2e,full:false,package:pack})
})

it.each([
 ['src/renderer/components/Editor.svelte',false],
 ['src/renderer/components/Preview.svelte',false],
 ['src/renderer/lib/render.ts',false],
 ['src/renderer/lib/remark-details.ts',false],
 ['src/renderer/lib/remark-numbering.ts',false],
 ['src/renderer/App.svelte',false],
 ['src/renderer/style.css',false],
 ['src/renderer/lib/i18n.svelte.ts',false],
 ['src/shared/csv-text.ts',false],
 ['src/main/export.ts',true],
 ['src/preload/index.ts',true],
 ['electron.vite.config.ts',true],
 ['playwright.config.ts',false],
 ['tests/e2e/groups.ts',false],
 ['package.json',true],
 ['package-lock.json',true],
 ['build/icon.png',true],
 ['.github/workflows/ci.yml',false],
 ['scripts/ci-areas.mjs',false],
 ['tests/e2e/freya-helper.ts',false],
 ['tests/e2e/helper.test.ts',false],
 ['docs/design/freya-icon-original.png',false],
 ['docs/licenses/csl-CC-BY-SA-3.0.txt',false],
 ['src/renderer/components/MarkdownNuevo.svelte',false],
 ['zona-desconocida/archivo.ts',false],
] as const)('%s conserva la ejecución completa',(path,pack)=>{
 expect(classifyPaths([path])).toEqual({...full,package:pack})
})

it('solo documentación y evidencia generada omiten Verify',()=>{
 expect(classifyPaths([
  'README.md','docs/stories/historia-ci1-pruebas-por-area-diseno-para-codex.md',
  'docs/evidence/fase/captura.png','docs/evidence/fase/vista.html','docs/evidence/fase/medición.json',
 ])).toEqual({...full,e2e:[],full:false,docsOnly:true})
})

it('una captura no amplía un cambio Markdown y una unitaria impide omitir Verify',()=>{
 const evidence='docs/evidence/captura.png'
 expect(classifyPaths(['src/renderer/lib/markdown-commands.ts',evidence])).toEqual({...full,e2e:['shell','md'],full:false})
 expect(classifyPaths(['tests/markdown-commands.test.ts',evidence])).toEqual({...full,e2e:[],full:false})
})

it.each([
 'docs/evidence/seg-s2e-2026-10-30/custom-style-invalid.docx',
 'docs/evidence/i18n-01-baseline-2026-10-28.json',
])('la entrada de Vitest %s exige Verify sin ampliar las E2E',fixture=>{
 expect(classifyPaths([fixture,'README.md'])).toEqual({...full,e2e:[],full:false})
})

it('una prueba unitaria no amplía el área de su fuente',()=>{
 expect(classifyPaths(['src/renderer/lib/markdown-commands.ts','tests/markdown-commands.test.ts']))
  .toEqual({...full,full:false,e2e:['shell','md']})
})

it('anuncia las rutas no clasificadas en stderr sin contaminar el plan JSON',()=>{
 const paths=['zona-nueva/b.ts','zona-nueva/a.ts']
 const result=spawnSync(process.execPath,['scripts/ci-areas.mjs','--stdin'],{input:paths.join('\0')+'\0',encoding:'utf8'})
 expect(result.status).toBe(0)
 expect(JSON.parse(result.stdout)).toEqual(full)
 expect(result.stderr).toBe('no clasificado: zona-nueva/a.ts, zona-nueva/b.ts\n')
})

it.each([
 [['README.md'],['--project=shell']],
 [['src/renderer/lib/markdown-commands.ts'],['--project=shell','--project=md']],
 [['tests/e2e/csv-text.spec.ts'],['--project=shell','--project=csv']],
 [['src/renderer/components/Editor.svelte'],['--project=shell','--project=md','--project=csv']],
] as const)('reproduce en cada fase los proyectos del plan para %j',(paths,projects)=>{
 const plan=JSON.stringify(classifyPaths(paths))
 expect(areaCommand(plan,[])).toEqual(['test:e2e','--',...projects])
 expect(areaCommand(plan,['--phase=fast','--workers=2'])).toEqual(['test:e2e:fast','--',...projects,'--workers=2'])
 expect(areaCommand(plan,['--phase=serial','--workers=1'])).toEqual(['test:e2e:perf','--',...projects,'--workers=1'])
})

it('rechaza planes inválidos y argumentos que puedan reducir la cobertura',()=>{
 expect(()=>areaCommand('{"full":false,"e2e":["ajeno"]}',[])).toThrow()
 expect(()=>areaCommand('{"e2e":[]}',[])).toThrow()
 expect(()=>areaCommand(JSON.stringify(classifyPaths([])),['--project=csv'])).toThrow()
})

it('cada spec real tiene un proyecto y se incluye si cambia',()=>{
 const root=new URL('./e2e/',import.meta.url)
 const specs=readdirSync(root,{recursive:true,encoding:'utf8'}).filter(path=>path.endsWith('.spec.ts')).map(path=>path.replaceAll('\\','/'))
 expect(specs.length).toBeGreaterThan(0)
 for(const name of [...shellFiles,...mdFiles])expect(specs.filter(path=>basename(path)===name)).toHaveLength(1)
 for(const path of specs){
  const name=basename(path),project=[
   ...shellFiles.filter(item=>item===name).map(()=>'shell'),
   ...mdFiles.filter(item=>item===name).map(()=>'md'),
  ]
  if(!project.length)project.push('csv')
  expect(project).toHaveLength(1)
  const spec='tests/e2e/'+path
  expect(classifyPaths([spec])).toEqual({...full,e2e:[...new Set(['shell',...project])],full:false,specs:[spec]})
 }
})

it('añade el proyecto de cada spec aunque el código cambie en otra área',()=>{
 const spec='tests/e2e/csv-text.spec.ts'
 expect(classifyPaths(['src/renderer/components/MarkdownToolbar.svelte',spec,spec])).toEqual({...full,full:false,specs:[spec]})
 expect(classifyPaths(['src/renderer/App.svelte',spec])).toEqual({...full,specs:[spec]})
 expect(classifyPaths(['tests/e2e/new-area.spec.ts'])).toEqual({...full,full:false,e2e:['shell','csv'],specs:['tests/e2e/new-area.spec.ts']})
})

it('entrada vacía o rutas ambiguas conservan la ejecución completa',()=>{
 for(const paths of [[],[''],['/src/renderer/components/Preview.svelte'],['docs/stories/../foo.ts'],['docs//stories/foo.md']]){
  expect(classifyPaths(paths)).toEqual(full)
 }
})

it('el comando lee rutas Git separadas por NUL y emite JSON sin ruido',()=>{
 const run=(input:string)=>JSON.parse(execFileSync(process.execPath,['scripts/ci-areas.mjs','--stdin'],{input,encoding:'utf8'}))
 expect(run('src/renderer/components/MarkdownToolbar.svelte\0tests/e2e/csv-text.spec.ts\0')).toEqual({...full,full:false,specs:['tests/e2e/csv-text.spec.ts']})
 expect(run('src/renderer/components/Preview.svelte')).toEqual(full)
 expect(run('')).toEqual(full)
})
