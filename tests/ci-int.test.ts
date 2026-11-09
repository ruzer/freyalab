import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {expect,it} from 'vitest'

type Job={os:string;part?:string;projects?:string}
type Suite={title:string;suites?:Suite[];specs?:{file:string;title:string;tests:{projectName:string}[]}[]}
const require=createRequire(import.meta.url)
const workflow=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8')
const {scripts}=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'))

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
 const report=JSON.parse(execFileSync(process.execPath,[require.resolve('@playwright/test/cli'),'test','--list','--reporter=json',...args],{encoding:'utf8',timeout:30_000,maxBuffer:4*1024*1024})) as {suites:Suite[]}
 return report.suites.flatMap(suite=>identities(suite))
}

it('las dos partes Intel conservan todas las identidades de Playwright exactamente una vez',()=>{
 const matrices=[...workflow.matchAll(/^\s*'(\[\{.*\}\])'(?:\s*\|\|)?[ \t]*$/gm)]
  .map(([,rows])=>(JSON.parse(rows) as Job[]).filter(job=>job.os==='macos-15-intel'))
 const scheduled=matrices[0],push=matrices.at(-1)
 expect(scheduled?.map(job=>[job.part,job.projects])).toEqual([['shell-md','--project=shell --project=md'],['csv-package','--project=csv']])
 expect(push).toEqual(scheduled)
 expect(workflow).toMatch(/run: npm run test:e2e:fast -- [^\n]*\$\{\{ matrix\.projects \}\}/)
 const all=list().sort()
 expect(new Set(all).size).toBe(all.length)
 const [first,second]=scheduled.map(job=>list(...selection('test:e2e:fast'),...job.projects!.split(' ')))
 const perf=list(...selection('test:e2e:perf'))
 expect(first.length).toBeGreaterThan(0)
 expect(second.length).toBeGreaterThan(0)
 expect(perf.length).toBeGreaterThan(0)
 expect([...first,...second,...perf].sort()).toEqual(all)
},60_000)
