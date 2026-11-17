import {expect,it} from 'vitest'
import {expression,matrix,verifySteps,workflow,type MatrixJob} from './helpers/ci-workflow'

const executable='release/mac-arm64/FreyaLab.app/Contents/MacOS/FreyaLab'
const packageName='CSV analysis and transforms in packaged application (macOS and Windows)'

function selected(job:MatrixJob,event:string,pack:boolean,fast:'success'|'failure'='success'){
 const packaged=!!job.executable&&(event!=='pull_request'||pack)
 const context={github:{event_name:event},matrix:job,runner:{os:'macOS'},needs:{areas:{outputs:{package:String(pack)}}},
  steps:{e2e_fast_pr:{outcome:event==='pull_request'&&job.part!=='package'?fast:'skipped'},e2e_fast_desktop:{outcome:event!=='pull_request'&&job.part!=='package'?fast:'skipped'},package:{outcome:packaged?'success':'skipped'}}}
 return verifySteps().filter(step=>expression<boolean>(step.condition,context)).map(step=>step.name)
}

it('ARM separa el paquete solo si el PR lo necesita y en todos los push, sin añadirse de noche',()=>{
 expect(matrix('schedule').filter(job=>job.os==='macos-15')).toEqual([])
 expect(matrix('pull_request',false).filter(job=>job.os==='macos-15')).toEqual([{os:'macos-15'}])
 for(const event of ['pull_request','push']){
  expect(matrix(event,true).filter(job=>job.os==='macos-15')).toEqual([{os:'macos-15'},{os:'macos-15',part:'package',executable}])
 }
})

it('el PR sin paquete conserva check, todas las unitarias y sus dos fases de áreas sin trabajo empaquetado',()=>{
 const jobs=matrix('pull_request',false).filter(job=>job.os==='macos-15')
 expect(jobs).toHaveLength(1)
 const steps=selected(jobs[0],'pull_request',false)
 for(const name of ['run: npm run check','run: npm test','Large-file editor experiments (correctness on small hostile fixtures)','E2E fast (PR areas)','E2E perf and solo (PR areas)'])expect(steps).toContain(name)
 for(const name of ['run: npm run licenses','run: npm run build','Cache electron-builder downloads','Package application directory',packageName])expect(steps).not.toContain(name)
})

it.each(['pull_request','push'])('ARM %s ejecuta exactamente una vez cada verificación y el mismo paquete en la unión de sus partes',event=>{
 const [main,pack]=matrix(event,true).filter(job=>job.os==='macos-15')
 expect(pack).toBeDefined()
 const first=selected(main,event,true),second=selected(pack,event,true),union=[...first,...second]
 const fast=event==='pull_request'?'E2E fast (PR areas)':'E2E fast (macOS and Windows)'
 const serial=event==='pull_request'?'E2E perf and solo (PR areas)':'E2E perf and solo (macOS and Windows)'
 for(const name of ['run: npm run check','run: npm test','Large-file editor experiments (correctness on small hostile fixtures)',fast,serial,'run: npm run licenses','run: npm run build','Package application directory',packageName])expect(union.filter(item=>item===name),name).toHaveLength(1)
 expect(second).not.toContain(fast)
 expect(second).not.toContain(serial)
 expect(second).not.toContain('run: npm test')
 expect(first).not.toContain('Package application directory')
 expect(first).not.toContain(packageName)
})

it('un fallo de rápidas conserva la fase serial en ARM principal y no la duplica en package',()=>{
 for(const event of ['pull_request','push']){
  const jobs=matrix(event,true).filter(job=>job.os==='macos-15')
  const serial=event==='pull_request'?'E2E perf and solo (PR areas)':'E2E perf and solo (macOS and Windows)'
  expect(jobs.flatMap(job=>selected(job,event,true,'failure')).filter(name=>name===serial)).toHaveLength(1)
 }
})

it('las dos partes ARM conservan el mismo límite de 75 minutos y los mismos workers',()=>{
 expect(workflow).toContain("matrix.os == 'macos-15' && 75")
 expect(workflow).toContain("FREYALAB_E2E_FAST_WORKERS: ${{ matrix.os == 'macos-15' && '2' || '1' }}")
 expect(workflow).toContain('npm run test:e2e:perf -- --workers=1 --output=test-results-solo')
 // package emplea el mismo comando de diez specs que ya verifica ci-int.test.ts.
 expect(verifySteps().find(step=>step.name===packageName)?.block).toContain('run: npx playwright test tests/e2e/structural-context.spec.ts')
})
