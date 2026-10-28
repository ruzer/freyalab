import {afterEach,describe,it,expect,vi} from 'vitest'
import es from '../src/shared/i18n/es.json'
import en from '../src/shared/i18n/en.json'
import {t,plural,formatNumber,formatDate,formatList,getLanguage,setLanguage,resolveLanguage} from '../src/shared/i18n'

afterEach(()=>{setLanguage('es');vi.unstubAllEnvs();vi.restoreAllMocks()})
describe('I18N-01 · catálogos y traducción',()=>{
 it('tiene las mismas claves y marcadores, sin HTML ni formas plurales incompletas',()=>{
  expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
  for(const [key,value] of Object.entries(es)){
   expect(value).not.toMatch(/<\/?[a-z][^>]*>/i)
   expect(en[key as keyof typeof en]).not.toMatch(/<\/?[a-z][^>]*>/i)
   const markers=(text:string)=>Array.from(text.matchAll(/\{([^}]+)\}/g),match=>match[1]).sort()
   expect(markers(en[key as keyof typeof en])).toEqual(markers(value))
   if(key.endsWith('.one'))expect(Object.hasOwn(en,key.slice(0,-4)+'.other')).toBe(true)
  }
 })
 it('comparte el idioma activo y permite un cambio inmediato',()=>{
  setLanguage('es');expect(getLanguage()).toBe('es');expect(t('dialog.save')).toBe('Guardar')
  setLanguage('en');expect(getLanguage()).toBe('en');expect(t('dialog.save')).toBe('Save')
 })
 it('interpola parámetros completos y conserva un marcador que no tiene valor',()=>{
  expect(t('dialog.close.message',{nombre:'tesis_á.md'})).toBe('¿Guardar los cambios de tesis_á.md?')
  expect(t('dialog.close.message')).toContain('{nombre}')
 })
 it('no traduce ni interpreta el contenido de los parámetros',()=>{
  setLanguage('en-XA')
  const result=t('dialog.close.message',{nombre:'<img src=x> My_File.csv'})
  expect(result).toContain('<img src=x> My_File.csv');expect(result.startsWith('[')).toBe(true);expect(result.endsWith(']')).toBe(true)
 })
 it('una clave desconocida aparece como clave y avisa solamente en desarrollo',()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
  vi.stubEnv('DEV',true);expect(t('clave.desconocida')).toBe('clave.desconocida');expect(warn).toHaveBeenCalledTimes(1)
  warn.mockClear();vi.stubEnv('DEV',false);expect(t('clave.desconocida')).toBe('clave.desconocida');expect(warn).not.toHaveBeenCalled()
 })
 it('usa español en producción si una clave del catálogo inglés falta',()=>{
  const catalog=en as Record<string,string>,original=catalog['dialog.save'];delete catalog['dialog.save']
  try{vi.stubEnv('DEV',false);setLanguage('en');expect(t('dialog.save')).toBe('Guardar')}finally{catalog['dialog.save']=original}
 })
 it('en desarrollo una traducción inglesa ausente muestra la clave',()=>{
  const catalog=en as Record<string,string>,original=catalog['dialog.save'];delete catalog['dialog.save']
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
  try{vi.stubEnv('DEV',true);setLanguage('en');expect(t('dialog.save')).toBe('dialog.save');expect(warn).toHaveBeenCalledTimes(1)}finally{catalog['dialog.save']=original}
 })
 it('el pseudoidioma conserva marcadores, acentúa y expande al menos 30 % el texto',()=>{
  setLanguage('en-XA');const result=t('dialog.reload.message'),original=en['dialog.reload.message']
  expect(result).toMatch(/^\[.*\]$/s);expect(result).toMatch(/[áéíóúàëïöü]/i);expect(result.length).toBeGreaterThanOrEqual(Math.ceil(original.length*1.3))
 })
 it('no interpreta claves heredadas del prototipo como mensajes',()=>{expect(t('toString')).toBe('toString');expect(t('__proto__')).toBe('__proto__')})
})
describe('I18N-01 · resolución del idioma',()=>{
 it.each([
  ['sistema',['es-MX'],'es'],['sistema',['es-419'],'es'],['sistema',['ES-es'],'es'],['sistema',['en-GB'],'en'],
  ['sistema',['pt-BR'],'en'],['sistema',[],'en'],['sistema',['pt-BR','es-MX'],'en'],
  ['es',['en-US'],'es'],['en',['es-MX'],'en'],['eliminado',['es-MX'],'es'],[undefined,['en-US'],'en'],
 ] as const)('%s / %j → %s',(preference,system,expected)=>expect(resolveLanguage(preference,system)).toBe(expected))
})
describe('I18N-01 · plural y formato regional',()=>{
 it.each([['es',0,'0 filas'],['es',1,'1 fila'],['es',2,'2 filas'],['en',0,'0 rows'],['en',1,'1 row'],['en',2,'2 rows']] as const)('%s / %d',(language,count,expected)=>{setLanguage(language);expect(plural('filas',count)).toBe(expected)})
 it('no usa el idioma del sistema para números, fechas o listas',()=>{
  const value=new Date('2026-10-28T12:30:00Z'),options={dateStyle:'long',timeZone:'UTC'} as const
  setLanguage('es');expect(formatNumber(1234.56)).toBe(new Intl.NumberFormat('es-MX').format(1234.56));expect(formatDate(value,options)).toBe(new Intl.DateTimeFormat('es-MX',options).format(value));expect(formatList(['a','b'])).toBe('a y b')
  setLanguage('en');expect(formatNumber(1234.56)).toBe(new Intl.NumberFormat('en-US').format(1234.56));expect(formatDate(value,options)).toBe(new Intl.DateTimeFormat('en-US',options).format(value));expect(formatList(['a','b'])).toBe('a and b')
 })
})
