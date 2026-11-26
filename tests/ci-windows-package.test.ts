import {execFileSync} from 'node:child_process'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {expect,it} from 'vitest'
import {areaCommand} from '../scripts/ci-e2e-area.mjs'
import {expression,matrix,verifySteps,workflow,type MatrixJob} from './helpers/ci-workflow'

const executable='release/win-unpacked/FreyaLab.exe'
const packageName='CSV analysis and transforms in packaged application (macOS and Windows)'
const cases=[['pull_request',true],['pull_request',false],['push',true]] as const
const all=['shell','md','csv']
type Plan={full:boolean;e2e:string[]}
const full:Plan={full:true,e2e:all}

function step(name:string){
 const found=verifySteps().find(item=>item.name===name)
 if(!found)throw new Error(`Falta el paso ${name}`)
 return found
}

function projects(job:MatrixJob,plan:Plan){
 // Ejecutar el selector del YAML evita probar una segunda implementación del reparto.
 const code=step('Select Windows PR projects').block.match(/node --input-type=module -e "([\s\S]+?)"\s*$/)?.[1]
 if(!code)throw new Error('Falta el selector real de proyectos Windows.')
 const directory=mkdtempSync(join(tmpdir(),'freyalab-ci-projects-')),output=join(directory,'output')
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
 const outputs=projects(job,plan),packaged=!!job.executable&&(event!=='pull_request'||pack)
 return {github:{event_name:event},matrix:job,runner:{os:'Windows'},env:{FREYALAB_E2E_FAST_WORKERS:'2'},
  needs:{areas:{outputs:{package:String(pack)}}},success:()=>fast==='success'&&!cancelled,cancelled:()=>cancelled,
  steps:{windows_projects:{outputs},e2e_fast_pr:{outcome:event==='pull_request'&&outputs.fast?fast:'skipped'},
   e2e_fast_linux:{outcome:'skipped'},e2e_fast_desktop:{outcome:event!=='pull_request'?fast:'skipped'},
   package:{outcome:packaged?'success':'skipped'}}}
}

function selected(job:MatrixJob,event:string,pack:boolean,fast='success'){
 const values=context(job,event,pack,fast)
 return verifySteps().filter(item=>expression<boolean>(item.condition,values)).map(item=>item.name)
}

function command(name:string,values:ReturnType<typeof context>){
 const run=step(name).block.match(/^        run: (.+)$/m)?.[1]
 if(!run)throw new Error(`Falta el comando ${name}`)
 return run.replace(/\$\{\{([\s\S]*?)\}\}/g,(_,code:string)=>String(expression(code,values)??'')).trim().split(/\s+/)
}

function gatePatterns(){
 const gate=workflow.split('\n  gate:\n')[1]
 if(!gate)throw new Error('Falta Gate.')
 const patterns=gate.match(/case "\$AREAS_RESULT\/\$DOCS_ONLY\/\$VERIFY_RESULT\/\$UBUNTU_SHELL_MD\/\$UBUNTU_CSV\/\$WINDOWS_SHELL_MD\/\$WINDOWS_CSV\/\$MACOS_SHELL_MD\/\$MACOS_CSV" in\n\s+([^\n]+)\) exit 0 ;;/)?.[1]
 if(!patterns)throw new Error('Falta la condición de aceptación del Gate real.')
 const fallback=gate.split(/\n\s*esac\n/)[1]
 if(!fallback||!/^\s*exit 1\s*$/m.test(fallback)||/^\s*exit 0\b/m.test(fallback))throw new Error('Gate debe rechazar los estados no aceptados.')
 return patterns.split('|')
}

it.each(cases)('Windows %s paquete=%s reparte rápidas y conserva serial y paquete una sola vez',(event,pack)=>{
 const jobs=matrix(event,pack).filter(job=>job.os==='windows-2025')
 expect(jobs).toEqual([
  {os:'windows-2025',part:'shell-md',projects:'--project=shell --project=md',executable},
  {os:'windows-2025',part:'csv',projects:'--project=csv'},
 ])
 const [shell,csv]=jobs,first=selected(shell,event,pack),second=selected(csv,event,pack),union=[...first,...second]
 const fast=event==='pull_request'?'E2E fast (PR areas)':'E2E fast (macOS and Windows)'
 const serial=event==='pull_request'?'E2E perf and solo (PR areas)':'E2E perf and solo (macOS and Windows)'
 expect(union.filter(name=>name===fast)).toHaveLength(2)
 for(const name of ['run: npm run check','run: npm test','Large-file editor experiments (correctness on small hostile fixtures)',serial,'run: npm run licenses']){
  expect(union.filter(item=>item===name),name).toHaveLength(1)
  expect(first).toContain(name)
  expect(second).not.toContain(name)
 }
 for(const name of ['run: npm run build','Package application directory',packageName]){
  expect(union.filter(item=>item===name),name).toHaveLength(pack?1:0)
  expect(second).not.toContain(name)
 }
})

it('Windows no se incorpora a schedule',()=>{
 expect(matrix('schedule').filter(job=>job.os==='windows-2025')).toEqual([])
})

it.each<Plan>([{full:false,e2e:[]},{full:false,e2e:['shell']},{full:false,e2e:['shell','md']},{full:false,e2e:['shell','csv']},full])(
 'el selector real intersecta rápidas sin ampliar ni perder el plan %j',plan=>{
  const jobs=matrix('pull_request',false).filter(job=>job.os==='windows-2025')
  const original=areaCommand(JSON.stringify(plan),[]).slice(2)
  const values=jobs.map(job=>context(job,'pull_request',false,'success',false,plan))
  const fast=values.flatMap(value=>value.steps.windows_projects.outputs.fast.split(' ').filter(Boolean))
  expect(fast.sort()).toEqual([...original].sort())
  expect(new Set(fast).size).toBe(fast.length)
  for(const value of values){
   const outputs=value.steps.windows_projects.outputs
   const active=expression<boolean>(step('E2E fast (PR areas)').condition,value)
   expect(active).toBe(outputs.fast!=='')
   if(active)expect(command('E2E fast (PR areas)',value)).toEqual([
    'npm','run','test:e2e:fast','--','--workers=2','--output=test-results-fast',...outputs.fast.split(' '),
   ])
  }
  expect(values[0].steps.windows_projects.outputs.serial.split(' ')).toEqual(original)
  expect(command('E2E perf and solo (PR areas)',values[0])).toEqual([
   'npm','run','test:e2e:perf','--','--workers=1','--output=test-results-solo',...original,
  ])
  expect(expression<boolean>(step('E2E perf and solo (PR areas)').condition,values[0])).toBe(true)
  expect(expression<boolean>(step('E2E perf and solo (PR areas)').condition,values[1])).toBe(false)
 })

it('el selector rechaza áreas inválidas en vez de ejecutar una selección incompleta',()=>{
 const job=matrix('pull_request',false).find(job=>job.os==='windows-2025')!
 expect(()=>projects(job,{full:false,e2e:['ajena']})).toThrow()
})

it.each(cases)('un fallo de rápidas conserva serial y paquete Windows; una cancelación los detiene (%s, %s)',(event,pack)=>{
 const jobs=matrix(event,pack).filter(job=>job.os==='windows-2025')
 const serial=event==='pull_request'?'E2E perf and solo (PR areas)':'E2E perf and solo (macOS and Windows)'
 const union=jobs.flatMap(job=>selected(job,event,pack,'failure'))
 expect(union.filter(name=>name===serial)).toHaveLength(1)
 for(const name of ['run: npm run build','Package application directory',packageName])expect(union.filter(item=>item===name),name).toHaveLength(pack?1:0)
 for(const job of jobs){
  const cancelled=context(job,event,pack,'failure',true)
  for(const name of [serial,'run: npm run build','Package application directory',packageName]){
   expect(expression<boolean>(step(name).condition,cancelled),name).toBeFalsy()
  }
 }
 const failedPackage=context(jobs[0],event,pack,'failure')
 failedPackage.steps.package.outcome='failure'
 expect(expression<boolean>(step(packageName).condition,failedPackage)).toBe(false)
})

it('las partes Windows conservan 60 minutos, dos workers rápidos, uno serial y el reintento existente',()=>{
 const timeout=workflow.match(/^    timeout-minutes: (.+)$/m)?.[1]
 const workers=workflow.match(/^      FREYALAB_E2E_FAST_WORKERS: (.+)$/m)?.[1]
 expect(timeout).toBeDefined();expect(workers).toBeDefined()
 for(const [event,pack] of cases)for(const job of matrix(event,pack).filter(job=>job.os==='windows-2025')){
  expect(expression<number>(timeout!,{matrix:job})).toBe(60)
  expect(expression<string>(workers!,{matrix:job})).toBe('2')
 }
 expect(step('E2E perf and solo (macOS and Windows)').block).toContain('run: npm run test:e2e:perf -- --workers=1 --output=test-results-solo')
 expect(workflow).not.toMatch(/--(?:retries|repeat-each|pass-with-no-tests)\b/)
 expect(readFileSync(new URL('../playwright.config.ts',import.meta.url),'utf8')).toContain('retries: process.env.CI ? 1 : 0')
})

it('cada confirmación Windows solo la puede producir su propia parte aprobada',()=>{
 const jobs=matrix('pull_request',true).filter(job=>job.os==='windows-2025')
 for(const [output,part] of [['windows_shell_md','shell-md'],['windows_csv','csv']]){
  const source=workflow.match(new RegExp(`^      ${output}: (.+)$`,'m'))?.[1]
  expect(source).toBeDefined()
  for(const matrixJob of jobs)for(const status of ['success','failure','cancelled','skipped']){
   expect(expression(source!,{github:{event_name:'pull_request'},matrix:matrixJob,job:{status}}))
    .toBe(matrixJob.part===part&&status==='success'?'passed':'')
  }
 }
})

it.each(['failure','cancelled','skipped'])('Gate rechaza Verify %s aunque ambas partes Windows hayan producido passed',result=>{
 expect(gatePatterns()).not.toContain(`success/false/${result}/passed/passed/passed/passed/passed/passed`)
})

it('Gate exige las seis partes de Ubuntu, Windows y ARM; documentación conserva su excepción',()=>{
 const gate=workflow.split('\n  gate:\n')[1]
 expect(gate).toContain('needs: [areas, verify]')
 for(const [name,output] of [['VERIFY_RESULT','result'],['UBUNTU_SHELL_MD','outputs.ubuntu_shell_md'],['UBUNTU_CSV','outputs.ubuntu_csv'],['WINDOWS_SHELL_MD','outputs.windows_shell_md'],['WINDOWS_CSV','outputs.windows_csv'],['MACOS_SHELL_MD','outputs.macos_shell_md'],['MACOS_CSV','outputs.macos_csv']]){
  expect(gate).toContain(`${name}: \${{ needs.verify.${output} }}`)
 }
 const condition=gate.match(/^    if: (.+)$/m)?.[1]
 expect(condition).toBeDefined()
 expect(expression<boolean>(condition!,{github:{event_name:'pull_request'}})).toBe(true)
 expect(expression<boolean>(condition!,{github:{event_name:'push'}})).toBe(false)
 const accepted=gatePatterns()
 expect(accepted).toEqual(['success/true/skipped//////','success/false/success/passed/passed/passed/passed/passed/passed'])
 for(const index of [3,4,5,6,7,8])for(const missing of ['','failure','cancelled','skipped']){
  const values=['success','false','success','passed','passed','passed','passed','passed','passed']
  values[index]=missing
  expect(accepted).not.toContain(values.join('/'))
 }
 expect(accepted).not.toContain('failure/false/success/passed/passed/passed/passed/passed/passed')
})
