import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname} from 'node:path'
import {expect,it} from 'vitest'
import {blockingTimeout} from './helpers/blocking-timeout'
import {expression,matrix,verifySteps,workflow} from './helpers/ci-workflow'

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
 expect(push).toEqual(scheduled)
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

it('Ubuntu solo reparte los push y conserva la misma selección de pruebas que Intel',()=>{
 const [scheduled,pr,push]=matrices.map(rows=>rows.filter(job=>job.os==='ubuntu-24.04'))
 expect(scheduled).toEqual([])
 expect(pr).toEqual([{os:'ubuntu-24.04',executable:'release/linux-unpacked/freyalab'}])
 expect(push.map(job=>[job.part,job.projects,job.executable])).toEqual([
  ['shell-md','--project=shell --project=md',undefined],
  ['csv-package','--project=csv','release/linux-unpacked/freyalab']
 ])
 // La prueba anterior enumera los dos mismos filtros y la fase serial completa.
 expect(workflow).toMatch(/run: xvfb-run -a npm run test:e2e:fast -- [^\n]*\$\{\{ matrix\.projects \}\}/)
 expect(workflow).toMatch(/name: E2E perf and solo \(Linux\)\n\s*if: [^\n]*matrix\.part != 'shell-md'/)
 expect(workflow).toMatch(/run: xvfb-run -a npm run test:e2e:perf -- --workers=1 --output=test-results-solo\n/)
})

it('Windows conserva todas las identidades: rápidas por proyecto y serial completo una sola vez',()=>{
 const all=list().sort(),fast=selection('test:e2e:fast'),serial=list(...selection('test:e2e:perf'))
 const first=list(...fast,'--project=shell','--project=md'),second=list(...fast,'--project=csv')
 const union=[...first,...second,...serial]
 expect(first.length).toBeGreaterThan(0);expect(second.length).toBeGreaterThan(0)
 expect(serial.some(identity=>JSON.parse(identity)[0]!=='csv')).toBe(true)
 expect(new Set(union).size).toBe(union.length)
 expect(union.sort()).toEqual(all)
 for(const [event,pack] of [['pull_request',true],['pull_request',false],['push',true]] as const){
  expect(matrix(event,pack).filter(job=>job.os==='windows-2025').map(job=>job.projects))
   .toEqual(['--project=shell --project=md','--project=csv'])
 }
})

it('la parte empaquetada construye su app y conserva exactamente los specs del paquete',()=>{
 expect(workflow).toMatch(/name: E2E fast \(macOS and Windows\)\n[^\n]*\n\s*if: .*matrix\.part != 'package'/)
 const build=verifySteps().find(step=>step.name==='run: npm run build')
 const packageStep=verifySteps().find(step=>step.name==='Package application directory')
 expect(build).toBeDefined();expect(packageStep).toBeDefined()
 for(const [event,pack] of [['schedule',false],['pull_request',true],['pull_request',false],['push',true]] as const){
  for(const job of matrix(event,pack)){
   const packaged=!!job.executable&&(event!=='pull_request'||pack)
   const context={github:{event_name:event},matrix:job,runner:{os:job.os.startsWith('windows')?'Windows':job.os.startsWith('macos')?'macOS':'Linux'},
    needs:{areas:{outputs:{package:String(pack)}}}}
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
 for(const [event,pack] of [['schedule',false],['pull_request',true],['pull_request',false],['push',true]] as const){
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
