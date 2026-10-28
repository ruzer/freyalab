import {beforeEach,describe,expect,it,vi} from 'vitest'
import {isAbsolute,join,win32} from 'node:path'
import {tmpdir} from 'node:os'
import {access} from 'node:fs/promises'
import {constants} from 'node:fs'

const invoked=vi.hoisted(()=>({execFile:vi.fn(),input:vi.fn()}))
vi.mock('node:child_process',()=>({execFile:invoked.execFile}))
import {detectPandoc,pandocPaths,pandocToDocx,stripPandocMetadata,testPandoc,minimumPandocVersion} from '../src/main/pandoc'

beforeEach(()=>{
 vi.clearAllMocks()
 invoked.execFile.mockImplementation((_path:string,args:string[],_options:unknown,done:(error:Error|null,stdout:Buffer,stderr:Buffer)=>void)=>{
  queueMicrotask(()=>done(null,Buffer.from(args[0]==='--version'?`pandoc ${minimumPandocVersion}\nFeatures: +lua`:'PK\x03\x04docx'),Buffer.alloc(0)))
  return{stdin:{on:vi.fn().mockReturnThis(),end:invoked.input}}
 })
})

describe('AC-00 · detección externa y opcional',()=>{
 it('devuelve versión, ruta absoluta y licencia de una ruta elegida',async()=>{
  const result=await detectPandoc(process.execPath)
  expect(result).toMatchObject({available:true,version:minimumPandocVersion,license:'GPL-2.0-or-later'})
  expect(result.available&&isAbsolute(result.path)).toBe(true)
  expect(invoked.execFile.mock.calls[0][1]).toEqual(['--version'])
  expect(invoked.execFile.mock.calls[0][2]).toMatchObject({shell:false,timeout:10_000,windowsHide:true})
 })
 it.each(['../pandoc','pandoc','\0'])('rechaza una ruta elegida no absoluta o inválida: %j',async path=>{
  const result=await detectPandoc(path)
  expect(result).toMatchObject({available:false});expect(invoked.execFile).not.toHaveBeenCalled()
 })
 it('sin ejecutable devuelve una explicación y la guía del sistema',async()=>{
  const result=await detectPandoc(join(tmpdir(),'freyalab-pandoc-inexistente','pandoc'))
  expect(result).toMatchObject({available:false,installation:expect.stringContaining('https://pandoc.org/installing.html')})
  expect(invoked.execFile).not.toHaveBeenCalled()
 })
 it.each(['2.19.2','3.0','3.9.9','invalid','3.10.2-beta'])('deshabilita una versión no validada: %s',async version=>{
  invoked.execFile.mockImplementation((_path:string,_args:string[],_options:unknown,done:(error:Error|null,stdout:Buffer,stderr:Buffer)=>void)=>{
   queueMicrotask(()=>done(null,Buffer.from(`pandoc ${version}\n`),Buffer.alloc(0)))
   return{stdin:{on:vi.fn().mockReturnThis(),end:invoked.input}}
  })
  const result=await detectPandoc(process.execPath)
  expect(result).toMatchObject({available:false,reason:expect.stringMatching(/versión|versi[oó]n mínima/i)})
 })
 it('busca el PATH antes de las ubicaciones habituales de macOS y Linux',()=>{
  expect(pandocPaths('darwin',{PATH:'/custom/bin:/other/bin'})).toEqual(expect.arrayContaining(['/custom/bin/pandoc','/other/bin/pandoc','/opt/homebrew/bin/pandoc','/usr/local/bin/pandoc','/opt/local/bin/pandoc']))
  expect(pandocPaths('linux',{PATH:'/custom/bin',HOME:'/home/freya'})).toEqual(expect.arrayContaining(['/custom/bin/pandoc','/usr/bin/pandoc','/usr/local/bin/pandoc','/home/freya/.local/bin/pandoc']))
  expect(pandocPaths('linux',{PATH:'/custom/bin'})[0]).toBe('/custom/bin/pandoc')
 })
 it('Windows usa exe, PATH con punto y coma y carpetas del usuario y del sistema',()=>{
  const paths=pandocPaths('win32',{Path:'C:\\Tools;D:\\Pandoc',LOCALAPPDATA:'C:\\Users\\Freya\\AppData\\Local',ProgramFiles:'C:\\Program Files',USERPROFILE:'C:\\Users\\Freya'})
  expect(paths[0]).toBe('C:\\Tools\\pandoc.exe')
  expect(paths).toContain('D:\\Pandoc\\pandoc.exe')
  expect(paths).toContain('C:\\Program Files\\Pandoc\\pandoc.exe')
  expect(paths).toContain('C:\\Users\\Freya\\AppData\\Local\\Pandoc\\pandoc.exe')
  expect(paths.every(path=>win32.isAbsolute(path)&&path.endsWith('pandoc.exe'))).toBe(true)
 })
 it('no busca en carpetas relativas o entradas vacías del PATH',()=>{
  expect(pandocPaths('linux',{PATH:':.:relative:/safe/bin:'})).not.toEqual(expect.arrayContaining(['pandoc','relative/pandoc']))
  expect(pandocPaths('linux',{PATH:':.:relative:/safe/bin:'})[0]).toBe('/safe/bin/pandoc')
 })
})

describe('AC-00 · frontera de invocación',()=>{
 it.each(['\n','\r\n'])('quita todo el YAML inicial, con BOM y sin límite de 100 líneas (%j)',newline=>{
  const source=['\ufeff---','bibliography: /secret.bib',...Array.from({length:110},(_,i)=>`key${i}: valor`),'...','# Informe'].join(newline)
  expect(stripPandocMetadata(source)).toBe('# Informe')
  expect(stripPandocMetadata('# Informe\n\n---\nTexto')).toBe('# Informe\n\n---\nTexto')
 })
 it('rechaza un encabezado YAML sin cierre sin enviar el documento al proceso',async()=>{
  await expect(pandocToDocx(process.execPath,'---\nbibliography: /secret.bib\n')).rejects.toThrow('metadatos')
  expect(invoked.execFile).not.toHaveBeenCalled()
 })
 it.each(['---\n# Informe\n\nCuerpo\n---\nFinal','---\n# Informe'])('conserva una regla horizontal inicial que no es metadatos: %j',source=>{
  expect(stripPandocMetadata(source)).toBe(source)
 })
 it('mantiene argumentos fijos, sin shell ni filtros, y usa un directorio vacío que elimina al terminar',async()=>{
  const result=await pandocToDocx(process.execPath,'---\nlua-filter: /secret.lua\n---\n# Informe')
  expect(result.subarray(0,4)).toEqual(Buffer.from('PK\x03\x04'))
  const call=invoked.execFile.mock.calls.find(([,args])=>args.includes('--sandbox'))!
  expect(call[1]).toEqual(['--sandbox','--data-dir',expect.any(String),'-f','markdown-raw_attribute-raw_html-raw_tex-yaml_metadata_block','-t','docx'])
  expect(call[1].join(' ')).not.toMatch(/--(?:lua-filter|filter|defaults|metadata-file|pdf-engine)/)
  expect(call[2]).toMatchObject({shell:false,timeout:10_000,maxBuffer:64*1024*1024,windowsHide:true,cwd:call[1][2]})
  expect(invoked.input).toHaveBeenLastCalledWith('# Informe')
  await expect(access(call[1][2],constants.F_OK)).rejects.toThrow()
 })
 it('Probar Pandoc convierte un documento sintético y confirma el contenedor DOCX',async()=>{
  const result=await testPandoc(process.execPath)
  expect(result).toMatchObject({ok:true,bytes:expect.any(Number)})
  expect(invoked.input).toHaveBeenLastCalledWith(expect.stringContaining('FreyaLab'))
 })
 it('Probar Pandoc rechaza una salida que no es un DOCX',async()=>{
  invoked.execFile.mockImplementation((_path:string,args:string[],_options:unknown,done:(error:Error|null,stdout:Buffer,stderr:Buffer)=>void)=>{
   queueMicrotask(()=>done(null,Buffer.from(args[0]==='--version'?`pandoc ${minimumPandocVersion}\n`:'texto sin contenedor DOCX'),Buffer.alloc(0)))
   return{stdin:{on:vi.fn().mockReturnThis(),end:invoked.input}}
  })
  await expect(testPandoc(process.execPath)).rejects.toThrow('Pandoc no produjo un archivo DOCX válido')
 })
 it('no devuelve rutas ni contenido privado de los errores del proceso',async()=>{
  invoked.execFile.mockImplementation((_path:string,args:string[],_options:unknown,done:(error:Error|null,stdout:Buffer,stderr:Buffer)=>void)=>{
   queueMicrotask(()=>args[0]==='--version'?done(null,Buffer.from(`pandoc ${minimumPandocVersion}\n`),Buffer.alloc(0)):done(new Error('/private/secreto: CONTENIDO PRIVADO'),Buffer.alloc(0),Buffer.from('/private/secreto: CONTENIDO PRIVADO')))
   return{stdin:{on:vi.fn().mockReturnThis(),end:invoked.input}}
  })
  await expect(pandocToDocx(process.execPath,'# CONTENIDO PRIVADO')).rejects.toThrow('Pandoc no pudo convertir')
  await expect(pandocToDocx(process.execPath,'# CONTENIDO PRIVADO')).rejects.not.toThrow(/secreto|CONTENIDO PRIVADO/)
 })
})
