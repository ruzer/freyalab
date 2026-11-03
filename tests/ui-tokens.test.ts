import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
const css=readFileSync(new URL('../src/renderer/style.css',import.meta.url),'utf8')
function tokens(dark=false){
 const values:Record<string,string>={}
 for(const match of css.matchAll(/:root(\.dark)?\s*\{([^}]+)\}/g))if(!match[1]||dark)for(const pair of match[2].matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g))values[pair[1]]=pair[2].trim()
 return values
}
function luminance(color:string){
 const hex=color.slice(1),full=hex.length===3?[...hex].map(value=>value+value).join(''):hex
 const [r,g,b]=full.match(/../g)!.map(pair=>{const n=parseInt(pair,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4})
 return .2126*r+.7152*g+.0722*b
}
function contrast(first:string,second:string){const a=luminance(first),b=luminance(second);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
it('el acento claro del CSS alcanza 4,5:1 con texto blanco de botón',()=>{
 expect(contrast(tokens()['--accent'],'#fff')).toBeGreaterThanOrEqual(4.5)
})

const pairs=[
 ['--text','--bg',4.5],['--text','--panel',4.5],['--text','--input',4.5],
 ['--muted','--bg',4.5],['--muted','--panel',4.5],['--muted','--input',4.5],['--muted','--hover',4.5],
 ['--control','--bg',3],['--control','--panel',3],['--control','--input',3],['--control','--hover',3],
 ['--accent-strong','--tint',4.5],['--danger','--danger-tint',4.5],
 ['--ok','--panel',4.5],['--ok','--bg',4.5],['--kind-csv','--panel',4.5],
 ['--kind-md','--panel',4.5],['--kind-mermaid','--panel',4.5],
 ['--focus','--bg',3],['--focus','--panel',3],['--focus','--input',3],
 ['--accent-text','--accent',4.5]
] as const
for(const dark of [false,true])it.each(pairs)(`contraste del CSS: %s sobre %s ≥ %s; oscuro=${dark}`,(foreground,background,minimum)=>{
 const values=tokens(dark)
 function resolve(name:string):string{expect(values[name],`token ${name}`).toBeTruthy();const value=values[name];return value.startsWith('var(')?resolve(value.slice(4,-1)):value}
 expect(contrast(resolve(foreground),resolve(background))).toBeGreaterThanOrEqual(minimum)
})
it('el azul aprobado está definido una sola vez detrás del token de acento claro',()=>{
 expect(tokens()['--accent']).toBe('#2563eb');expect(css.match(/#2563eb/gi)).toHaveLength(1)
})
