import {spawnSync} from 'node:child_process'

const projects=['shell','md','csv']
const phases={'--phase=fast':'test:e2e:fast','--phase=serial':'test:e2e:perf'}

export function areaCommand(plan,args) {
  const {full,e2e}=JSON.parse(plan)
  if(typeof full!=='boolean'||!Array.isArray(e2e)||e2e.some(project=>!projects.includes(project))){
    throw new Error('Plan E2E inválido')
  }
  const phase=Object.hasOwn(phases,args[0])?phases[args[0]]:null
  const options=phase?args.slice(1):args
  if(options.some(option=>!/^--(?:workers=[12]|output=.+)$/.test(option))||
    (phase==='test:e2e:perf'&&options.includes('--workers=2'))){
    throw new Error('Opciones de E2E por área inválidas')
  }
  const selected=projects.filter(project=>full||project==='shell'||e2e.includes(project))
  return [phase??'test:e2e','--',...selected.map(project=>'--project='+project),...options]
}

if(import.meta.main){
  const args=process.argv.slice(2)
  const plan=process.env.FREYALAB_CI_AREAS??args.shift()
  const command=areaCommand(plan,args)
  const result=spawnSync(process.execPath,[process.env.npm_execpath,'run',...command],{stdio:'inherit'})
  if(result.error)throw result.error
  process.exitCode=result.status??1
}
