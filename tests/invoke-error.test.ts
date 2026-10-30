import {it,expect} from 'vitest'
import {invocationMessage} from '../src/preload/invoke-error'
it.each([
 ["Error invoking remote method 'freya': Error: No se encontró foto á.png.",'No se encontró foto á.png.'],
 ["Error invoking remote method 'freya': Invalid operation data.",'Invalid operation data.'],
 ['Error: Mensaje propio','Error: Mensaje propio'],
 ["Error invoking remote method 'otro': Error: Mensaje", "Error invoking remote method 'otro': Error: Mensaje"],
 ['Nombre <script> y ruta a:b','Nombre <script> y ruta a:b'],
 ["Error invoking remote method 'freya': Error: [freya:TEXT_EDIT_LIMIT] Encoded buffer rejected.",'[freya:TEXT_EDIT_LIMIT] Encoded buffer rejected.'],
])('limpia solamente el envoltorio de freya: %s',(message,expected)=>{
 expect(invocationMessage(new Error(message))).toBe(expected);expect(invocationMessage(message)).toBe(expected)
})

import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {sourceFiles} from './helpers/i18n-audit'
it('elimina el prefijo de Electron en un único módulo del preload',async()=>{
 const root=process.cwd(),matches:string[]=[]
 for(const path of await sourceFiles(root))if((await readFile(join(root,path),'utf8')).includes('Error invoking remote method'))matches.push(path)
 expect(matches).toEqual(['src/preload/invoke-error.ts'])
})
