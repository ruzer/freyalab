import {execFileSync} from 'node:child_process'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {expect,it} from 'vitest'
import {areaCommand} from '../scripts/ci-e2e-area.mjs'
import {expression,matrix,verifySteps,workflow,type MatrixJob} from './helpers/ci-workflow'

const executable='release/mac-arm64/FreyaLab.app/Contents/MacOS/FreyaLab'
const packageName='CSV analysis and transforms in packaged application (macOS and Windows)'
const cases=[['pull_request',true],['pull_request',false],['push',true]] as const
type Plan={full:boolean;e2e:string[]}
const full:Plan={full:true,e2e:['shell','md','csv']}
function step(name:string){
 const found=verifySteps().find(item=>item.name===name)
 if(!found)throw new Error('Falta el paso '+name)
 return found
}
function projects(job:MatrixJob,plan:Plan){
 if(!job.projects)return {fast:'',serial:''}
 // Ejecutar el selector real evita otra implementación del reparto.
 const code=step('Select Windows PR projects').block.match(/node --input-type=module -e "([\s\S]+?)"\s*$/)?.[1]
 if(!code)throw new Error('Falta el selector real de proyectos.')
 const directory=mkdtempSync(join(tmpdir(),'freyalab-ci-arm-')),output=join(directory,'output')
 try{
  execFileSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',stdio:['ignore','pipe','pipe'],
   env:{...process.env,FREYALAB_CI_AREAS:JSON.stringify(plan),FREYALAB_CI_PROJECTS:job.projects,GITHUB_OUTPUT:output}})
  return Object.fromEntries(readFileSync(output,'utf8').trim().split('\n').map(line=>{
   const separator=line.indexOf('=')
   return [line.slice(0,separator),line.slice(separator+1)]
  })) as {fast:string;serial:string}
 }finally{rmSync(directory,{recursive:true,force:true})}
}
function context(job:MatrixJob,event:string,pack:boolean,fast='success',cancelled=false,plan=full){
 const selector={github:{event_name:event},matrix:job,runner:{os:'macOS'}}
 const outputs=expression(step('Select Windows PR projects').condition,selector)?projects(job,plan):{fast:'',serial:''}
 const packaged=!!job.executable&&(event!=='pull_request'||pack)
 return {github:{event_name:event},matrix:job,runner:{os:'macOS'},env:{FREYALAB_E2E_FAST_WORKERS:'2'},
  needs:{areas:{outputs:{package:String(pack)}}},success:()=>fast==='success'&&!cancelled,cancelled:()=>cancelled,
  steps:{windows_projects:{outputs},e2e_fast_pr:{outcome:event==='pull_request'&&outputs.fast?fast:'skipped'},
   e2e_fast_desktop:{outcome:event!=='pull_request'&&job.projects?fast:'skipped'},
   package:{outcome:packaged?'success':'skipped'}}}
}
function selected(job:MatrixJob,event:string,pack:boolean,fast='success'){
 const values=context(job,event,pack,fast)
 return verifySteps().filter(item=>expression<boolean>(item.condition,values)).map(item=>item.name)
}
function command(name:string,values:ReturnType<typeof context>){
 const run=step(name).block.match(/^        run: (.+)$/m)?.[1]
 if(!run)throw new Error('Falta el comando '+name)
 return run.replace(/\$\{\{([\s\S]*?)\}\}/g,(_,code:string)=>String(expression(code,values)??'')).trim().split(/\s+/)
}
it('ARM reparte PR/push, conserva paquete y no se incorpora de noche',()=>{
 expect(matrix('schedule').filter(job=>job.os==='macos-15')).toEqual([])
 const development=[{os:'macos-15',part:'shell-md',projects:'--project=shell --project=md'},{os:'macos-15',part:'csv',projects:'--project=csv'}]
 expect(matrix('pull_request',false).filter(job=>job.os==='macos-15')).toEqual(development)
 for(const event of ['pull_request','push'])expect(matrix(event,true).filter(job=>job.os==='macos-15')).toEqual([...development,{os:'macos-15',part:'package',executable}])
})
it('el selector de PR se activa en ambas partes ARM y se omite en package y push',()=>{
 for(const [event,pack] of cases)for(const job of matrix(event,pack).filter(job=>job.os==='macos-15')){
  expect(Boolean(expression(step('Select Windows PR projects').condition,context(job,event,pack))))
   .toBe(event==='pull_request'&&['shell-md','csv'].includes(job.part??''))
 }
})
it.each(cases)('ARM %s paquete=%s conserva las verificaciones sin duplicar serial o paquete',(event,pack)=>{
 const jobs=matrix(event,pack).filter(job=>job.os==='macos-15')
 const first=selected(jobs[0],event,pack),second=selected(jobs[1],event,pack),third=jobs[2]?selected(jobs[2],event,pack):[],union=[...first,...second,...third]
 const fast=event==='pull_request'?'E2E fast (PR areas)':'E2E fast (macOS and Windows)'
 const serial=event==='pull_request'?'E2E perf and solo (PR areas)':'E2E perf and solo (macOS and Windows)'
 expect(union.filter(name=>name===fast)).toHaveLength(2)
 for(const name of ['run: npm run check','run: npm test','Large-file editor experiments (correctness on small hostile fixtures)',serial]){
  expect(union.filter(item=>item===name),name).toHaveLength(1)
  expect(first).toContain(name);expect(second).not.toContain(name);expect(third).not.toContain(name)
 }
 for(const name of ['run: npm run licenses','run: npm run build','Cache electron-builder downloads','Package application directory',packageName]){
  expect(union.filter(item=>item===name),name).toHaveLength(pack?1:0)
  expect(first).not.toContain(name);expect(second).not.toContain(name)
  if(pack)expect(third).toContain(name)
 }
})
it.each<Plan>([{full:false,e2e:[]},{full:false,e2e:['shell']},{full:false,e2e:['shell','md']},{full:false,e2e:['shell','csv']},full])(
 'ARM intersecta rápidas con áreas y conserva serial completo una vez %j',plan=>{
  const jobs=matrix('pull_request',false).filter(job=>job.os==='macos-15'),original=areaCommand(JSON.stringify(plan),[]).slice(2)
  const values=jobs.map(job=>context(job,'pull_request',false,'success',false,plan))
  const fast=values.flatMap(value=>value.steps.windows_projects.outputs.fast.split(' ').filter(Boolean))
  expect(fast.sort()).toEqual([...original].sort());expect(new Set(fast).size).toBe(fast.length)
  for(const value of values){
   const outputs=value.steps.windows_projects.outputs,active=expression<boolean>(step('E2E fast (PR areas)').condition,value)
   expect(active).toBe(outputs.fast!=='')
   if(active)expect(command('E2E fast (PR areas)',value)).toEqual(['npm','run','test:e2e:fast','--','--workers=2','--output=test-results-fast',...outputs.fast.split(' ')])
  }
  expect(values[0].steps.windows_projects.outputs.serial.split(' ')).toEqual(original)
  expect(command('E2E perf and solo (PR areas)',values[0])).toEqual(['npm','run','test:e2e:perf','--','--workers=1','--output=test-results-solo',...original])
  expect(expression<boolean>(step('E2E perf and solo (PR areas)').condition,values[0])).toBe(true)
  expect(expression<boolean>(step('E2E perf and solo (PR areas)').condition,values[1])).toBe(false)
 })
it.each(cases)('un fallo de rápidas conserva serial ARM; cancelar la detiene (%s, %s)',(event,pack)=>{
 const jobs=matrix(event,pack).filter(job=>job.os==='macos-15'),serial=event==='pull_request'?'E2E perf and solo (PR areas)':'E2E perf and solo (macOS and Windows)'
 expect(jobs.flatMap(job=>selected(job,event,pack,'failure')).filter(name=>name===serial)).toHaveLength(1)
 for(const job of jobs)expect(expression<boolean>(step(serial).condition,context(job,event,pack,'failure',true))).toBeFalsy()
})
it('cada confirmación ARM solo la produce su parte aprobada; package no suplanta desarrollo',()=>{
 for(const [output,part] of [['macos_shell_md','shell-md'],['macos_csv','csv']]){
  const source=workflow.match(new RegExp('^      '+output+': (.+)$','m'))?.[1];expect(source).toBeDefined()
  for(const matrixJob of matrix('pull_request',true).filter(job=>job.os==='macos-15'))for(const status of ['success','failure','cancelled','skipped']){
   expect(expression(source!,{github:{event_name:'pull_request'},matrix:matrixJob,job:{status}})).toBe(matrixJob.part===part&&status==='success'?'passed':'')
  }
 }
})
it('ARM mantiene 75 minutos, dos workers rápidos y un worker serial',()=>{
 const timeout=workflow.match(/^    timeout-minutes: (.+)$/m)?.[1],workers=workflow.match(/^      FREYALAB_E2E_FAST_WORKERS: (.+)$/m)?.[1]
 expect(timeout).toBeDefined();expect(workers).toBeDefined()
 for(const [event,pack] of cases)for(const job of matrix(event,pack).filter(job=>job.os==='macos-15')){
  expect(expression<number>(timeout!,{matrix:job})).toBe(75);expect(expression<string>(workers!,{matrix:job})).toBe('2')
 }
 expect(step('E2E perf and solo (macOS and Windows)').block).toContain('run: npm run test:e2e:perf -- --workers=1 --output=test-results-solo')
 expect(verifySteps().find(item=>item.name===packageName)?.block).toContain('run: npx playwright test tests/e2e/structural-context.spec.ts')
})

it('Intel conserva serial en shell-md y sigue fuera de los PR y push',()=>{
 expect(matrix('pull_request',true).filter(job=>job.os==='macos-15-intel')).toEqual([])
 expect(matrix('push',true).filter(job=>job.os==='macos-15-intel')).toEqual([])
 for(const event of ['schedule','workflow_dispatch']){
  const jobs=matrix(event,true).filter(job=>job.os==='macos-15-intel'),serial='E2E perf and solo (macOS and Windows)'
  expect(jobs.map(job=>job.part)).toEqual(['shell-md','csv','package'])
  for(const job of jobs)expect(selected(job,event,true).includes(serial)).toBe(job.part==='shell-md')
 }
})
