import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname} from 'node:path'
import {expect,it} from 'vitest'

type Job={os:string;part?:string;projects?:string;executable?:string}
type Suite={title:string;suites?:Suite[];specs?:{file:string;title:string;tests:{projectName:string}[]}[]}
const require=createRequire(import.meta.url)
const workflow=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8').replaceAll('\r\n','\n')
const {scripts}=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'))
const matrices=[...workflow.matchAll(/^\s*'(\[\{.*\}\])'(?:\s*\|\|)?[ \t]*$/gm)].map(([,rows])=>JSON.parse(rows) as Job[])

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
  encoding:'utf8',timeout:30_000,maxBuffer:4*1024*1024,
  // La enumeración importa los specs sin lanzar Electron ni necesitar su binario.
  env:{...process.env,ELECTRON_OVERRIDE_DIST_PATH:dirname(require.resolve('electron'))}
 })) as {suites:Suite[]}
 return report.suites.flatMap(suite=>identities(suite))
}

it('Intel conserva las identidades de desarrollo en dos partes y prueba el paquete en paralelo',()=>{
 const [scheduled,pr,push]=matrices.map(rows=>rows.filter(job=>job.os==='macos-15-intel'))
 expect(scheduled?.map(job=>[job.part,job.projects])).toEqual([['shell-md','--project=shell --project=md'],['csv','--project=csv'],['package',undefined]])
 expect(pr).toEqual([])
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
},60_000)

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

it('la parte empaquetada construye su app y conserva exactamente los specs del paquete',()=>{
 expect(workflow).toMatch(/name: E2E fast \(macOS and Windows\)\n[^\n]*\n\s*if: .*matrix\.part != 'package'/)
 expect(workflow).toMatch(/run: npm run build\n\s*if: matrix\.part == 'package'/)
 expect(workflow).toMatch(/name: Package application directory\n[^\n]*\n\s*if: matrix\.executable && \(github\.event_name != 'pull_request' \|\| needs\.areas\.outputs\.package == 'true'\)/)
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
 const packageCondition=workflow.match(/name: Package application directory\n[^\n]*\n\s*if: ([^\n]+)/)?.[1]
 expect(caches[1][2]).toContain(`if: ${packageCondition}`)
 expect(caches[0].index).toBeLessThan(workflow.indexOf('- run: npm ci'))
 expect(workflow).toContain("checksums: require('electron/checksums.json')")
})
