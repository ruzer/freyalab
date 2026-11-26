import {execFileSync} from 'node:child_process'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import {tmpdir} from 'node:os'
import {dirname,join} from 'node:path'
import {expect,it} from 'vitest'
import {areaCommand} from '../scripts/ci-e2e-area.mjs'
import {blockingTimeout} from './helpers/blocking-timeout'
import {expression,matrix,verifySteps,workflow,type MatrixJob} from './helpers/ci-workflow'

type Suite={title:string;suites?:Suite[];specs?:{file:string;title:string;tests:{projectName:string}[]}[]}
const require=createRequire(import.meta.url)
const {scripts}=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'))
// Selección contextual: PR con/sin paquete pueden tener matrices diferentes.
const matrices=[matrix('schedule'),matrix('pull_request',true),matrix('push')]

function selection(script:string){
 const filter=scripts[script]?.match(/ (--grep(?:-invert)?) "([^"]+)"$/)
 if(!filter)throw new Error(`Falta el filtro de Playwright en ${script}`)
 return [filter[1],filter[2]]
}

function identities(suite:Suite,parents:string[]=[]):string[]{
 const titles=[...parents,suite.title]
 return [...(suite.specs??[]).flatMap(spec=>spec.tests.map(test=>JSON.stringify([test.projectName,spec.file,...titles,spec.title]))),
  ...(suite.suites??[]).flatMap(child=>identities(child,titles))]
}

function list(...args:string[]):string[]{
 const report=JSON.parse(execFileSync(process.execPath,[require.resolve('@playwright/test/cli'),'test','--list','--reporter=json',...args],{
  encoding:'utf8',timeout:blockingTimeout-1_000,maxBuffer:4*1024*1024,
  // La enumeración importa los specs sin lanzar Electron ni necesitar su binario.
  env:{...process.env,ELECTRON_OVERRIDE_DIST_PATH:dirname(require.resolve('electron'))}
 })) as {suites:Suite[]}
 return report.suites.flatMap(suite=>identities(suite))
}

it('Intel conserva las identidades de desarrollo en dos partes y prueba el paquete en paralelo',()=>{
 const [scheduled,pr,push]=matrices.map(rows=>rows.filter(job=>job.os==='macos-15-intel'))
 expect(scheduled?.map(job=>[job.part,job.projects])).toEqual([['shell-md','--project=shell --project=md'],['csv','--project=csv'],['package',undefined]])
 expect(pr).toEqual([])
 expect(matrix('pull_request',false).filter(job=>job.os==='macos-15-intel')).toEqual([])
 expect(push).toEqual([])
 expect(matrix('workflow_dispatch').filter(job=>job.os==='macos-15-intel')).toEqual(scheduled)
 expect(matrix('workflow_dispatch')).toEqual(scheduled)
 const workers=workflow.match(/^      FREYALAB_E2E_FAST_WORKERS: (.+)$/m)?.[1]
 expect(workers).toBeDefined()
 for(const job of scheduled)expect(expression(workers!,{matrix:job})).toBe('1')
 expect(matrix('push').filter(job=>job.os.startsWith('macos-'))).toHaveLength(3)
 expect(workflow).toMatch(/^  workflow_dispatch:/m)
 const guard=workflow.split('\n  verify:\n')[1]?.match(/^    if: (.+)$/m)?.[1]
 expect(guard).toBeDefined()
 for(const ref of ['refs/heads/main','refs/heads/feature']){
  expect(!!expression(guard!,{github:{event_name:'workflow_dispatch',ref}})).toBe(ref==='refs/heads/main')
 }
 expect(workflow).toMatch(/run: npm run test:e2e:fast -- [^\n]*\$\{\{ matrix\.projects \}\}/)
 const all=list().sort()
 expect(new Set(all).size).toBe(all.length)
 const [first,second]=scheduled.filter(job=>job.projects).map(job=>list(...selection('test:e2e:fast'),...job.projects!.split(' ')))
 const perf=list(...selection('test:e2e:perf'))
 expect(first.length).toBeGreaterThan(0)
 expect(second.length).toBeGreaterThan(0)
 expect(perf.length).toBeGreaterThan(0)
 expect([...first,...second,...perf].sort()).toEqual(all)
})

it('Ubuntu reparte PR con y sin paquete y push sin cambiar la selección de pruebas',()=>{
 const [scheduled,pr,push]=matrices.map(rows=>rows.filter(job=>job.os==='ubuntu-24.04'))
 expect(scheduled).toEqual([])
 expect(pr).toEqual(push)
 expect(matrix('pull_request',false).filter(job=>job.os==='ubuntu-24.04')).toEqual([
  {os:'ubuntu-24.04',part:'shell-md',projects:'--project=shell --project=md'},
  {os:'ubuntu-24.04',part:'csv',projects:'--project=csv'},
 ])
 expect(push.map(job=>[job.part,job.projects,job.executable])).toEqual([
  ['shell-md','--project=shell --project=md',undefined],
  ['csv-package','--project=csv','release/linux-unpacked/freyalab']
 ])
 // La comprobación de identidades enumera estos mismos filtros y la fase serial completa.
 expect(workflow).toMatch(/run: xvfb-run -a npm run test:e2e:fast -- [^\n]*\$\{\{ matrix\.projects \}\}/)
 expect(workflow).toMatch(/name: E2E perf and solo \(Linux\)\n\s*if: [^\n]*matrix\.part == 'shell-md'/)
 expect(workflow).toMatch(/run: xvfb-run -a npm run test:e2e:perf -- --workers=1 --output=test-results-solo\n/)
})

it.each(['windows-2025','ubuntu-24.04'])('%s conserva todas las identidades: rápidas por proyecto y serial completo una sola vez',os=>{
 const all=list().sort(),fast=selection('test:e2e:fast'),serial=list(...selection('test:e2e:perf'))
 const first=list(...fast,'--project=shell','--project=md'),second=list(...fast,'--project=csv')
 const union=[...first,...second,...serial]
 expect(first.length).toBeGreaterThan(0);expect(second.length).toBeGreaterThan(0)
 expect(serial.some(identity=>JSON.parse(identity)[0]!=='csv')).toBe(true)
 expect(new Set(union).size).toBe(union.length)
 expect(union.sort()).toEqual(all)
 for(const [event,pack] of [['pull_request',true],['pull_request',false],['push',true]] as const){
  expect(matrix(event,pack).filter(job=>job.os===os).map(job=>job.projects))
   .toEqual(['--project=shell --project=md','--project=csv'])
 }
})

it.each([['push','ubuntu-24.04'],['schedule','macos-15-intel'],['workflow_dispatch','macos-15-intel']])(
 '%s %s ejecuta perf/solo una vez en shell-md, después de rápidas y con cancelación', (event,os)=>{
  const jobs=matrix(event,true).filter(job=>job.os===os)
  expect(jobs.length).toBeGreaterThan(1)
  const serial=step(os==='ubuntu-24.04'?'E2E perf and solo (Linux)':'E2E perf and solo (macOS and Windows)')
  const selected:string[]=[]
  for(const job of jobs){
   for(const outcome of ['success','failure','skipped']){
    const context={github:{event_name:event},matrix:job,runner:{os:os==='ubuntu-24.04'?'Linux':'macOS'},
     steps:{e2e_fast_linux:{outcome:os==='ubuntu-24.04'?outcome:'skipped'},
      e2e_fast_desktop:{outcome:os==='macos-15-intel'?outcome:'skipped'}}}
    const active=!!expression(serial.condition,context)
    expect(active).toBe(job.part==='shell-md'&&outcome!=='skipped')
    if(active&&outcome==='success')selected.push(job.part!)
    expect(!!expression(serial.condition,{...context,cancelled:()=>true})).toBe(false)
   }
  }
  expect(selected).toEqual(['shell-md'])
  expect(serial.block).toMatch(/test:e2e:perf -- --workers=1 --output=test-results-solo(?:\n|$)/)
 })

function step(name:string){
 const found=verifySteps().find(item=>item.name===name)
 if(!found)throw new Error('Falta el paso '+name)
 return found
}
type Plan={full:boolean;e2e:string[]}
function ubuntuContext(job:MatrixJob,pack:boolean,plan:Plan,fast='success'){
 const context={github:{event_name:'pull_request'},matrix:job,runner:{os:'Linux'}}
 const selector=step('Select Windows PR projects')
 const directory=mkdtempSync(join(tmpdir(),'freyalab-ci-ubuntu-')),output=join(directory,'output')
 let outputs={fast:'',serial:''},outcome='skipped'
 try{
  if(expression(selector.condition,context)){
   const code=selector.block.match(/node --input-type=module -e "([\s\S]+?)"\s*$/)?.[1]
   if(!code)throw new Error('Falta el selector real de proyectos.')
   execFileSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',stdio:['ignore','pipe','pipe'],
    env:{...process.env,FREYALAB_CI_AREAS:JSON.stringify(plan),FREYALAB_CI_PROJECTS:job.projects,GITHUB_OUTPUT:output}})
   outputs=Object.fromEntries(readFileSync(output,'utf8').trim().split('\n').map(line=>{
    const separator=line.indexOf('=')
    return [line.slice(0,separator),line.slice(separator+1)]
   })) as typeof outputs
   outcome='success'
  }
 }finally{rmSync(directory,{recursive:true,force:true})}
 return {...context,env:{FREYALAB_E2E_FAST_WORKERS:'2'},needs:{areas:{outputs:{package:String(pack)}}},
  steps:{windows_projects:{outputs,outcome},e2e_fast_pr:{outcome:outputs.fast?fast:'skipped'},e2e_fast_linux:{outcome:'skipped'}},
  cancelled:()=>false}
}
function ubuntuCommand(name:string,values:ReturnType<typeof ubuntuContext>){
 const run=step(name).block.match(/^        run: (.+)$/m)?.[1]
 if(!run)throw new Error('Falta el comando '+name)
 return run.replace(/\$\{\{([\s\S]*?)\}\}/g,(_,code:string)=>String(expression(code,values)??'')).trim().split(/\s+/)
}
const plans:Plan[]=[{full:false,e2e:[]},{full:false,e2e:['shell']},{full:false,e2e:['shell','md']},{full:false,e2e:['shell','csv']},{full:true,e2e:['shell','md','csv']}]
it.each([false,true])('Ubuntu PR paquete=%s intersecta áreas y ejecuta serial solo en shell-md, incluso sin rápidas CSV',pack=>{
 const jobs=matrix('pull_request',pack).filter(job=>job.os==='ubuntu-24.04')
 expect(jobs).toHaveLength(2)
 for(const plan of plans){
  const original=areaCommand(JSON.stringify(plan),[]).slice(2)
  const values=jobs.map(job=>ubuntuContext(job,pack,plan))
  const fast=values.flatMap(value=>value.steps.windows_projects.outputs.fast.split(' ').filter(Boolean))
  expect(fast.sort()).toEqual([...original].sort());expect(new Set(fast).size).toBe(fast.length)
  for(const value of values){
   const active=!!expression(step('E2E fast (PR areas)').condition,value),outputs=value.steps.windows_projects.outputs
   expect(active).toBe(outputs.fast!=='')
   if(active)expect(ubuntuCommand('E2E fast (PR areas)',value)).toEqual([
    'xvfb-run','-a','npm','run','test:e2e:fast','--','--workers=2','--output=test-results-fast',...outputs.fast.split(' '),
   ])
  }
  expect(!!expression(step('E2E perf and solo (PR areas)').condition,values[0])).toBe(true)
  expect(!!expression(step('E2E perf and solo (PR areas)').condition,values[1])).toBe(false)
  expect(ubuntuCommand('E2E perf and solo (PR areas)',values[0])).toEqual([
   'xvfb-run','-a','npm','run','test:e2e:perf','--','--workers=1','--output=test-results-solo',...original,
  ])
  // El paquete no puede depender del build de otra máquina: CSV construye si sus rápidas se omiten.
  expect(!!expression(step('run: npm run build').condition,values[1])).toBe(pack&&values[1].steps.e2e_fast_pr.outcome==='skipped')
  for(const [index,value] of values.entries()){
   for(const name of ['run: npm run check','run: npm test','Large-file editor experiments (correctness on small hostile fixtures)']){
    expect(!!expression(step(name).condition,value)).toBe(index===0)
   }
   expect(!!expression(step('Package application directory').condition,value)).toBe(pack&&index===1)
  }
 }
})
it('Ubuntu no pierde serial ante fallo rápido ni la ejecuta con selector fallido u omitido o cancelación',()=>{
 const job=matrix('pull_request',true).find(job=>job.os==='ubuntu-24.04'&&job.part==='shell-md')
 expect(job).toBeDefined()
 const serial=step('E2E perf and solo (PR areas)').condition
 const full:Plan={full:true,e2e:['shell','md','csv']}
 const failed=ubuntuContext(job!,true,full,'failure')
 expect(!!expression(serial,failed)).toBe(true)
 expect(!!expression(serial,{...failed,cancelled:()=>true})).toBe(false)
 for(const outcome of ['failure','skipped']){
  const missing=ubuntuContext(job!,true,{full:false,e2e:['shell','md']})
  missing.steps.windows_projects.outcome=outcome
  missing.steps.e2e_fast_pr.outcome='skipped'
  expect(!!expression(serial,missing)).toBe(false)
 }
})
it('el paquete Ubuntu con rápidas vacías construye localmente solo con selector aprobado y sin fallo o cancelación',()=>{
 const job=matrix('pull_request',true).find(job=>job.os==='ubuntu-24.04'&&job.part==='csv-package')!
 const context=ubuntuContext(job,true,{full:false,e2e:['shell','md']})
 const build=step('run: npm run build').condition
 expect(context.steps.e2e_fast_pr.outcome).toBe('skipped')
 expect(!!expression(build,context)).toBe(true)
 expect(!!expression(build,{...context,success:()=>false})).toBe(false)
 expect(!!expression(build,{...context,cancelled:()=>true})).toBe(false)
 for(const outcome of ['failure','skipped']){
  context.steps.windows_projects.outcome=outcome
  expect(!!expression(build,context)).toBe(false)
 }
 context.steps.windows_projects.outcome='success'
 context.steps.windows_projects.outputs.fast='--project=csv'
 expect(!!expression(build,context)).toBe(false)
})
it('Ubuntu conserva 60 minutos, dos workers rápidos y uno serial, y cada confirmación la produce solo su parte aprobada',()=>{
 const timeout=workflow.match(/^    timeout-minutes: (.+)$/m)?.[1],workers=workflow.match(/^      FREYALAB_E2E_FAST_WORKERS: (.+)$/m)?.[1]
 expect(timeout).toBeDefined();expect(workers).toBeDefined()
 for(const [event,pack] of [['pull_request',true],['pull_request',false],['push',true]] as const)for(const job of matrix(event,pack).filter(job=>job.os==='ubuntu-24.04')){
  expect(expression(timeout!,{matrix:job,startsWith:(text:string,prefix:string)=>text.startsWith(prefix)})).toBe(60);expect(expression(workers!,{matrix:job})).toBe('2')
 }
 for(const [output,parts] of [['ubuntu_shell_md',['shell-md']],['ubuntu_csv',['csv','csv-package']]] as const){
  const source=workflow.match(new RegExp('^      '+output+': (.+)$','m'))?.[1]
  expect(source).toBeDefined()
  for(const pack of [true,false])for(const job of matrix('pull_request',pack))for(const status of ['success','failure','cancelled','skipped']){
   expect(expression(source!,{github:{event_name:'pull_request'},matrix:job,job:{status}}))
    .toBe(job.os==='ubuntu-24.04'&&(parts as readonly string[]).includes(job.part??'')&&status==='success'?'passed':'')
  }
 }
})

it('la parte empaquetada construye su app y conserva exactamente los specs del paquete',()=>{
 expect(workflow).toMatch(/name: E2E fast \(macOS and Windows\)\n[^\n]*\n\s*if: .*matrix\.part != 'package'/)
 const build=verifySteps().find(step=>step.name==='run: npm run build')
 const packageStep=verifySteps().find(step=>step.name==='Package application directory')
 expect(build).toBeDefined();expect(packageStep).toBeDefined()
 for(const [event,pack] of [['schedule',false],['workflow_dispatch',false],['pull_request',true],['pull_request',false],['push',true]] as const){
  for(const job of matrix(event,pack)){
   const packaged=!!job.executable&&(event!=='pull_request'||pack)
   const context={github:{event_name:event},matrix:job,runner:{os:job.os.startsWith('windows')?'Windows':job.os.startsWith('macos')?'macOS':'Linux'},
    needs:{areas:{outputs:{package:String(pack)}}},steps:{e2e_fast_pr:{outcome:'success'}}}
   expect(!!expression(build!.condition,context)).toBe(job.part==='package'||(job.os==='windows-2025'&&packaged))
   expect(!!expression(packageStep!.condition,context)).toBe(packaged)
  }
 }
 const packaged=[...workflow.matchAll(/run: (?:xvfb-run -a )?npx playwright test (tests\/e2e\/[^\n]+) --output=packaged-test-results/g)].map(([,specs])=>specs.split(' '))
 const original='structural-context commands search sql charts structure ordering range-cancellation selection-statistics statistics-reports'.split(' ').map(name=>`tests/e2e/${name}.spec.ts`)
 expect(packaged).toEqual([original,original])
})

it('restaura las descargas por sistema, arquitectura y lockfile sin compartir un caché parcial de builder',()=>{
 const caches=[...workflow.matchAll(/- name: Cache (Electron|electron-builder) downloads\n([\s\S]+?)(?=\n      - )/g)]
 expect(caches.map(([,name])=>name)).toEqual(['Electron','electron-builder'])
 for(const [,name,step] of caches){
  expect(step).toMatch(/uses: actions\/cache@[a-f0-9]{40}/)
  expect(step).toContain(`key: ${name.toLowerCase()}-v1-\${{ runner.os }}-\${{ runner.arch }}-\${{ hashFiles('package-lock.json') }}`)
  expect(step).not.toMatch(/restore-keys|node_modules/)
 }
 const cacheCondition=caches[1][2].match(/^        if: (.+)$/m)?.[1]
 const packageCondition=verifySteps().find(step=>step.name==='Package application directory')?.condition
 expect(cacheCondition).toBeDefined();expect(packageCondition).toBeDefined()
 // El caché se prepara antes de las pruebas; Windows puede empaquetar después de un fallo.
 for(const [event,pack] of [['schedule',false],['workflow_dispatch',false],['pull_request',true],['pull_request',false],['push',true]] as const){
  for(const job of matrix(event,pack)){
   const context={github:{event_name:event},matrix:job,runner:{os:job.os.startsWith('windows')?'Windows':job.os.startsWith('macos')?'macOS':'Linux'},
    needs:{areas:{outputs:{package:String(pack)}}}}
   expect(!!expression(cacheCondition!,context)).toBe(!!job.executable&&(event!=='pull_request'||pack))
   expect(!!expression(packageCondition!,context)).toBe(!!expression(cacheCondition!,context))
  }
 }
 expect(caches[0].index).toBeLessThan(workflow.indexOf('- run: npm ci'))
 expect(workflow).toContain("checksums: require('electron/checksums.json')")
})
