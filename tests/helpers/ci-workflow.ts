import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'

export type MatrixJob={os:string;part?:string;projects?:string;executable?:string}
type Context=Record<string,unknown>
export const workflow=readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8').replaceAll('\r\n','\n')

// Estas expresiones del workflow solo usan cadenas/booleanos y &&/||/==/!=,
// cuya evaluación coincide aquí con Actions. No es un intérprete general de YAML/Actions.
export function expression<T>(source:string,context:Context):T{
 const code=source.trim().replace(/^\$\{\{\s*/,'').replace(/\s*\}\}$/,'')
 return runInNewContext(code,{fromJSON:JSON.parse,cancelled:()=>false,always:()=>true,...context},{timeout:1_000}) as T
}

export function matrix(event:string,pack=false):MatrixJob[]{
 const source=workflow.match(/        include: >-\n([\s\S]+?)\n    runs-on:/)?.[1]
 if(!source)throw new Error('Falta la expresión de la matriz Verify.')
 return expression(source,{github:{event_name:event},needs:{areas:{outputs:{package:String(pack)}}}})
}

export function verifySteps(){
 const verify=workflow.split('\n  verify:\n')[1]?.split('\n  gate:\n')[0]
 if(!verify)throw new Error('Falta Verify.')
 return verify.split('\n      - ').slice(1).map(block=>{
  const first=block.split('\n')[0],name=first.startsWith('name: ')?first.slice(6):first
  const condition=block.match(/^        if: (.+)$/m)?.[1]??'true'
  return{name,condition,block}
 })
}
