import {describe,it,expect} from 'vitest'
import {readdirSync,readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import * as ts from 'typescript'
import config from '../playwright.config'
import {shellFiles,mdFiles} from './e2e/groups'

const directory=fileURLToPath(new URL('./e2e/',import.meta.url))
const specFiles=readdirSync(directory).filter(file=>file.endsWith('.spec.ts')).sort()
const projects=()=>config.projects??[]
type Project=NonNullable<typeof config.projects>[number]

// Solo interpreta los dos patrones de archivo que permite esta configuración.
function selectedBy(project:Project,file:string){
 const name=file.split(/[\\/]/).at(-1)!
 const matches=(value:Project['testMatch'])=>(Array.isArray(value)?value:value?[value]:[]).some(pattern=>pattern===`**/${name}`||pattern==='**/*.spec.ts'&&name.endsWith('.spec.ts'))
 return matches(project.testMatch)&&!matches(project.testIgnore)
}
const selectedProjects=(file:string)=>projects().filter(project=>selectedBy(project,file)).map(project=>project.name)

function reservedPerfNames(file:string,source:string):string[]{
 const found:string[]=[]
 if(file.includes('@perf'))found.push('archivo')
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true)
 const namedCalls=new Set(['test','test.only','test.skip','test.fixme','test.describe','test.describe.only','test.describe.skip','test.describe.fixme'])
 function visit(node:ts.Node){
  if(ts.isCallExpression(node)&&namedCalls.has(node.expression.getText(tree))){
   const title=node.arguments[0]
   if(title&&(ts.isStringLiteralLike(title)||ts.isTemplateExpression(title))&&title.getText(tree).includes('@perf'))found.push('título')
  }
  ts.forEachChild(node,visit)
 }
 visit(tree)
 return found
}

describe('FL-TST-001 · partición E2E sin pérdida de casos',()=>{
 it('las listas solo declaran basenames de specs que existen',()=>{
  for(const file of [...shellFiles,...mdFiles]){
   expect(file).not.toMatch(/[\\/]/)
   expect(specFiles).toContain(file)
  }
 })

 it('no hay archivos repetidos dentro de las listas ni entre shell y md',()=>{
  const declared=[...shellFiles,...mdFiles]
  expect(new Set(declared).size).toBe(declared.length)
 })

 it('la configuración real usa shell/md explícitos y CSV como complemento',()=>{
  const glob=(files:readonly string[])=>files.map(file=>`**/${file}`)
  expect(projects()).toEqual([
   {name:'shell',testMatch:glob(shellFiles)},
   {name:'md',testMatch:glob(mdFiles)},
   {name:'csv',testMatch:'**/*.spec.ts',testIgnore:glob([...shellFiles,...mdFiles])},
  ])
  expect(mdFiles).toContain('mermaid-export-theme.spec.ts')
  expect(mdFiles).toContain('mermaid-fit.spec.ts')
  expect(mdFiles).toContain('text-stats.spec.ts')
  expect(mdFiles).toContain('markdown-paste.spec.ts')
  expect(mdFiles).toContain('markdown-date.spec.ts')
  expect(mdFiles).toContain('markdown-tasks.spec.ts')
  expect(mdFiles).toContain('preview-edit.spec.ts')
 })

 it('cada spec actual pertenece exactamente a un proyecto, incluidos los de CSV no registrados',()=>{
  expect(specFiles.length).toBeGreaterThan(shellFiles.length+mdFiles.length)
  for(const file of specFiles){
   const expected=shellFiles.some(name=>name===file)?'shell':mdFiles.some(name=>name===file)?'md':'csv'
   expect(selectedProjects(file),file).toEqual([expected])
  }
 })

 it('un spec futuro cae solo en CSV y las rutas POSIX/Windows conservan la clasificación',()=>{
  for(const file of ['futuro.spec.ts','/tmp/tests/e2e/futuro.spec.ts','C:\\tmp\\tests\\e2e\\futuro.spec.ts'])expect(selectedProjects(file)).toEqual(['csv'])
  expect(selectedProjects('/tmp/tests/e2e/app.spec.ts')).toEqual(['shell'])
  expect(selectedProjects('C:\\tmp\\tests\\e2e\\mermaid-fit.spec.ts')).toEqual(['md'])
  expect(selectedProjects('groups.ts')).toEqual([])
 })

 it('conserva las opciones comunes de ejecución de la suite anterior',()=>{
  const common=Object.fromEntries(Object.entries(config).filter(([key])=>key!=='projects'))
  expect(common).toEqual({
   testDir:'./tests/e2e',timeout:90_000,expect:{timeout:15_000},workers:1,fullyParallel:false,
   forbidOnly:!!process.env.CI,retries:process.env.CI?1:0,
   reporter:[['list'],['html',{open:'never'}]],use:{trace:'retain-on-failure',screenshot:'only-on-failure'},
  })
 })

 it('reserva @perf en archivos y títulos/describe existentes sin rechazar la anotación',()=>{
  for(const file of specFiles)expect(reservedPerfNames(file,readFileSync(new URL(`./e2e/${file}`,import.meta.url),'utf8')),file).toEqual([])
 })

 it.each([
  ['nombre de archivo','literal@perf.spec.ts',"test('normal',()=>{})",['archivo']],
  ['título literal','normal.spec.ts',"test('literal @perf',()=>{})",['título']],
  ['título describe','normal.spec.ts',"test.describe('grupo @perf',()=>{})",['título']],
  ['plantilla del título','normal.spec.ts','test(`literal ${"@perf"}`,()=>{})',['título']],
  ['anotación válida','normal.spec.ts',"test('normal',{tag:'@perf'},()=>{})",[]],
  ['contenido que no es nombre','normal.spec.ts',"test('normal',()=>{const source='@perf'})",[]],
 ] as const)('%s',(_,file,source,expected)=>expect(reservedPerfNames(file,source)).toEqual(expected))
})
