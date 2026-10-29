import {yamlParts} from './front-matter'

export function bibliographyPath(frontMatter?:string):string|undefined {
 const value=/^bibliography[ \t]*:[ \t]*(.+)$/m.exec(frontMatter??'')?.[1]
 if(value===undefined)return
 const raw=(yamlParts(value,false)?.[0]??'').trim()
 if(raw.startsWith('"'))try{const result:unknown=JSON.parse(raw);return typeof result==='string'?result:raw}catch{}
 return raw.startsWith("'")&&raw.endsWith("'")?raw.slice(1,-1).replaceAll("''","'"):raw||undefined
}
