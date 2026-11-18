import {expect,it} from 'vitest'
import {t,plural} from '../src/shared/i18n'

it.each([
 ['sql.ui.readonly','Solo lectura: tus consultas no cambian el archivo.','Read only: your queries do not change the file.'],
 ['sql.ui.empty','Escribe una consulta y pulsa Ejecutar. Los resultados aparecen aquí.','Write a query and choose Run. Your results appear here.'],
 ['sql.ui.limits','Límites','Limits'],
 ['sql.ui.resultDetails','Detalles del resultado','Result details'],
] as const)('SIM-2f: %s conserva el contrato en español e inglés',(key,es,en)=>{
 expect(t(key,{},'es')).toBe(es);expect(t(key,{},'en')).toBe(en)
 const expanded=t(key,{},'en-XA');expect(expanded).toMatch(/^\[.+~+\]$/);expect(expanded).not.toBe(es)
})
it.each([
 ['es',1,'1 fila de resultado'],['es',240,'240 filas de resultado'],
 ['en',1,'1 result row'],['en',240,'240 result rows'],
] as const)('SIM-2f: resultado conciso %s / %d',(language,rows,expected)=>{
 expect(plural('sql.ui.resultRows',rows,{},language)).toBe(expected)
})
