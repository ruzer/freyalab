import {expect,it} from 'vitest'
import {expression,matrix,verifySteps,workflow,type MatrixJob} from './helpers/ci-workflow'

const executable='release/win-unpacked/FreyaLab.exe'
const packageName='CSV analysis and transforms in packaged application (macOS and Windows)'

function selected(job:MatrixJob,event:string,pack:boolean,fast:'success'|'failure'='success'){
 const packaged=!!job.executable&&(event!=='pull_request'||pack)
 const context={github:{event_name:event},matrix:job,runner:{os:'Windows'},needs:{areas:{outputs:{package:String(pack)}}},
  steps:{e2e_fast_pr:{outcome:event==='pull_request'&&job.part!=='package'?fast:'skipped'},e2e_fast_linux:{outcome:'skipped'},
   e2e_fast_desktop:{outcome:event!=='pull_request'&&job.part!=='package'?fast:'skipped'},package:{outcome:packaged?'success':'skipped'}}}
 return verifySteps().filter(step=>expression<boolean>(step.condition,context)).map(step=>step.name)
}

function gatePatterns(){
 const gate=workflow.split('\n  gate:\n')[1]
 if(!gate)throw new Error('Falta Gate.')
 const patterns=gate.match(/case "\$AREAS_RESULT\/\$DOCS_ONLY\/\$VERIFY_RESULT\/\$UBUNTU\/\$WINDOWS\/\$MACOS" in\n\s+([^\n]+)\) exit 0 ;;/)?.[1]
 if(!patterns)throw new Error('Falta la condición de aceptación del Gate real.')
 const fallback=gate.split(/\n\s*esac\n/)[1]
 if(!fallback||!/^\s*exit 1\s*$/m.test(fallback)||/^\s*exit 0\b/m.test(fallback))throw new Error('Gate debe rechazar los estados no aceptados.')
 return patterns.split('|')
}

it.each(['pull_request','push'])('Windows %s conserva toda la verificación y el paquete exactamente una vez en dos partes',event=>{
 const jobs=matrix(event,true).filter(job=>job.os==='windows-2025')
 expect(jobs).toEqual([{os:'windows-2025'},{os:'windows-2025',part:'package',executable}])
 const [main,pack]=jobs,first=selected(main,event,true),second=selected(pack,event,true),union=[...first,...second]
 const fast=event==='pull_request'?'E2E fast (PR areas)':'E2E fast (macOS and Windows)'
 const serial=event==='pull_request'?'E2E perf and solo (PR areas)':'E2E perf and solo (macOS and Windows)'
 for(const name of ['run: npm run check','run: npm test','Large-file editor experiments (correctness on small hostile fixtures)',fast,serial,
  'run: npm run licenses','run: npm run build','Package application directory',packageName])expect(union.filter(item=>item===name),name).toHaveLength(1)
 for(const name of ['run: npm run check','run: npm test',fast,serial])expect(second).not.toContain(name)
 for(const name of ['run: npm run build','Package application directory',packageName])expect(first).not.toContain(name)
})

it('Windows mantiene el PR sin paquete en un job y no se incorpora a schedule',()=>{
 expect(matrix('schedule').filter(job=>job.os==='windows-2025')).toEqual([])
 const jobs=matrix('pull_request',false).filter(job=>job.os==='windows-2025')
 expect(jobs).toEqual([{os:'windows-2025',executable}])
 const steps=selected(jobs[0],'pull_request',false)
 for(const name of ['run: npm run check','run: npm test','Large-file editor experiments (correctness on small hostile fixtures)',
  'E2E fast (PR areas)','E2E perf and solo (PR areas)'])expect(steps).toContain(name)
 for(const name of ['run: npm run build','Package application directory',packageName])expect(steps).not.toContain(name)
})

it('un fallo de rápidas conserva serial una vez y no lo duplica en el job de paquete Windows',()=>{
 for(const event of ['pull_request','push']){
  const serial=event==='pull_request'?'E2E perf and solo (PR areas)':'E2E perf and solo (macOS and Windows)'
  const union=matrix(event,true).filter(job=>job.os==='windows-2025').flatMap(job=>selected(job,event,true,'failure'))
  expect(union.filter(name=>name===serial)).toHaveLength(1)
 }
})

it('las partes Windows conservan 60 minutos y un worker sin cambiar el comando serial',()=>{
 const timeout=workflow.match(/^    timeout-minutes: (.+)$/m)?.[1]
 const workers=workflow.match(/^      FREYALAB_E2E_FAST_WORKERS: (.+)$/m)?.[1]
 expect(timeout).toBeDefined();expect(workers).toBeDefined()
 for(const event of ['pull_request','push'])for(const job of matrix(event,true).filter(job=>job.os==='windows-2025')){
  expect(expression<number>(timeout!,{matrix:job})).toBe(60)
  expect(expression<string>(workers!,{matrix:job})).toBe('1')
 }
 expect(verifySteps().find(step=>step.name==='E2E perf and solo (macOS and Windows)')?.block)
  .toContain('run: npm run test:e2e:perf -- --workers=1 --output=test-results-solo')
})

it.each(['failure','cancelled','skipped'])('Gate rechaza Verify %s aunque otro job Windows haya producido passed',result=>{
 expect(gatePatterns()).not.toContain(`success/false/${result}/passed/passed/passed`)
})

it('Gate depende del agregado de Verify, exige las tres plataformas y solo se ejecuta en PR',()=>{
 const gate=workflow.split('\n  gate:\n')[1]
 expect(gate).toContain('needs: [areas, verify]')
 expect(gate).toContain('VERIFY_RESULT: ${{ needs.verify.result }}')
 const condition=gate.match(/^    if: (.+)$/m)?.[1]
 expect(condition).toBeDefined()
 expect(expression<boolean>(condition!,{github:{event_name:'pull_request'}})).toBe(true)
 expect(expression<boolean>(condition!,{github:{event_name:'push'}})).toBe(false)
 expect(gatePatterns()).toEqual(['success/true/skipped///','success/false/success/passed/passed/passed'])
 expect(gatePatterns()).not.toContain('success/false/success/passed//passed')
})
