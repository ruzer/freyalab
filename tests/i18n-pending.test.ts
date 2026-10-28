import {describe,it,expect} from 'vitest'
import {pendingIssues} from './helpers/i18n-audit'
describe('I18N-01 · la lista pendiente solo encoge',()=>{
 it('rechaza añadir rutas a la fotografía inicial',()=>{
  expect(pendingIssues(['old.svelte','new.svelte'],['old.svelte'],new Map())).toContain('La lista pendiente creció: new.svelte')
 })
 it('rechaza un archivo nuevo con texto visible sin catálogo',()=>{
  expect(pendingIssues([],[],new Map([['new.svelte','<button>Guardar</button>']]))).toEqual(['new.svelte: Guardar'])
 })
 it('detecta la regresión de un archivo que ya salió de la lista',()=>{
  expect(pendingIssues([],['old.svelte'],new Map([['old.svelte','<p>Hola</p>']]))).toEqual(['old.svelte: Hola'])
 })
 it('permite retirar un archivo traducido y añadir código nuevo sin mensajes visibles',()=>{
  expect(pendingIssues([],['old.svelte'],new Map([['old.svelte','<p>{t("hola")}</p>'],['data.ts',"const kind='csv',unit='MiB'\nexport const data={id:'0001'}"]]))).toEqual([])
 })
 it('conserva fuentes pendientes preexistentes, sin afirmar que ya estén traducidas',()=>{
  expect(pendingIssues(['old.svelte'],['old.svelte'],new Map([['old.svelte','<p>Hola</p>']]))).toEqual([])
 })
})

import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
// El checkout de Windows convierte LF a CRLF; se fija el contenido, no ese transporte.
const snapshotHash=(source:string)=>createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex')
import {sourceFiles} from './helpers/i18n-audit'
it('conserva la fotografía inicial y comprueba los archivos actuales, sin ampliar pendientes',async()=>{
 const root=process.cwd(),raw=await readFile(join(root,'docs/evidence/i18n-01-baseline-2026-10-28.json'),'utf8')
 expect(snapshotHash(raw)).toBe('2b92d993e5dad9b18860282db9db1c0b99eabf791cab51a8b9791db0be775835')
 const initial=(JSON.parse(raw) as {initialPending:string[]}).initialPending
 const pending=JSON.parse(await readFile(join(root,'src/shared/i18n/pending-files.json'),'utf8')) as string[]
 expect([...new Set(pending)].sort()).toEqual(pending)
 const sources=new Map(await Promise.all((await sourceFiles(root)).map(async path=>[path,await readFile(join(root,path),'utf8')] as const)))
 expect(pendingIssues(pending,initial,sources)).toEqual([])
})

it('compara la misma fotografía en LF y CRLF, sin aceptar cambios en su contenido',async()=>{
 const raw=await readFile(join(process.cwd(),'docs/evidence/i18n-01-baseline-2026-10-28.json'),'utf8')
 const lf=raw.replace(/\r\n/g,'\n'),crlf=lf.replace(/\n/g,'\r\n')
 expect(snapshotHash(crlf)).toBe('2b92d993e5dad9b18860282db9db1c0b99eabf791cab51a8b9791db0be775835')
 expect(snapshotHash(lf)).toBe(snapshotHash(crlf))
 expect(snapshotHash(lf.replace('initialPending','initialPendingAlterado'))).not.toBe(snapshotHash(lf))
})
