import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const state=vi.hoisted(()=>({version:'1.2.3-alpha.4',packaged:false,folder:'',writeText:vi.fn()}))
vi.mock('electron',()=>({app:{getVersion:()=>state.version,getAppPath:()=>state.folder,get isPackaged(){return state.packaged}},clipboard:{writeText:state.writeText}}))
import {applicationInfo,copyApplicationInfo,thirdPartyNotices} from '../src/main/app-info'
import {formatApplicationInfo,releaseChannel} from '../src/shared/app-info'
import {setLanguage} from '../src/shared/i18n'
beforeEach(async()=>{state.folder=await mkdtemp(join(tmpdir(),'freya-about-'));state.version='1.2.3-alpha.4';state.packaged=false;state.writeText.mockReset();setLanguage('es')})
afterEach(async()=>{await rm(state.folder,{recursive:true,force:true});vi.unstubAllGlobals();setLanguage('es')})
it.each([['1.2.3-alpha.4','alpha'],['1.2.3-beta.12','beta'],['1.2.3','stable'],['1.2.3-rc.2','development'],['desarrollo','development']])('A1 · canal de %s se calcula como %s',(version,channel)=>{expect(releaseChannel(version)).toBe(channel)})
it('A1 · la versión sigue app.getVersion al cambiar los metadatos del paquete',()=>{
 expect(applicationInfo().version).toBe('1.2.3-alpha.4');state.version='9.8.7-beta.12';expect(applicationInfo()).toMatchObject({version:'9.8.7-beta.12',channel:'beta'})
})
it('A2 · compilación inyectada válida y fallback sin commit',()=>{
 expect(applicationInfo().build).toBeNull();vi.stubGlobal('__FREYALAB_BUILD__','a1b2c3d');expect(applicationInfo().build).toBe('a1b2c3d')
 vi.stubGlobal('__FREYALAB_BUILD__','/CANARIO_PRIVADO');expect(applicationInfo().build).toBeNull()
})
it('A3/A4 · publica únicamente versiones, compilación, sistema, arquitectura e idioma',()=>{
 const info=applicationInfo();expect(Object.keys(info).sort()).toEqual(['arch','build','channel','chromium','electron','language','node','platform','version'])
 expect(info).toMatchObject({node:process.versions.node,platform:process.platform,arch:process.arch,language:'es'})
})
it('A4 · el texto copiado descarta rutas, nombres, host y contenido extra',()=>{
 const info={...applicationInfo(),path:'/CANARIO_PRIVADO/documento.md',username:'CANARIO_USUARIO',hostname:'CANARIO_HOST',document:'CANARIO_CONTENIDO'}
 const text=formatApplicationInfo(info)
 expect(text).toContain('FreyaLab');expect(text).toContain(state.version);expect(text).toContain('Electron');expect(text).toContain('Chromium');expect(text).toContain('Node');expect(text).not.toMatch(/CANARIO|documento\.md/)
})
it('A4/A8 · copia la misma información permitida en el idioma activo, sin aceptar texto libre',async()=>{
 await copyApplicationInfo();expect(state.writeText).toHaveBeenCalledExactlyOnceWith(formatApplicationInfo(applicationInfo()))
 setLanguage('en');state.writeText.mockClear();await copyApplicationInfo();expect(state.writeText).toHaveBeenCalledExactlyOnceWith(formatApplicationInfo(applicationInfo()));expect(state.writeText.mock.calls[0][0]).toContain('Channel: alpha')
})
it('A4 · un fallo de portapapeles no revela el error nativo',async()=>{
 state.writeText.mockImplementationOnce(()=>{throw new Error('/CANARIO_PRIVADO permiso denegado')})
 let message='';try{await copyApplicationInfo()}catch(error){message=String(error)}
 expect(message).toMatch(/copiar|copy/i);expect(message).not.toContain('CANARIO')
})
it('A5 · desarrollo lee los avisos incluidos en el proyecto',async()=>{
 expect(await thirdPartyNotices()).toBe(await readFile('THIRD_PARTY_NOTICES.txt','utf8'))
})
it('A5 · paquete lee sus propios avisos y no una copia del checkout',async()=>{
 state.packaged=true;await writeFile(join(state.folder,'THIRD_PARTY_NOTICES.txt'),'AVISOS_DEL_PAQUETE')
 expect(await thirdPartyNotices()).toBe('AVISOS_DEL_PAQUETE')
})
it('A5 · avisos ausentes producen un mensaje comprensible sin rutas',async()=>{
 state.packaged=true;await expect(thirdPartyNotices()).rejects.toThrow(/licencias|licenses/i)
 try{await thirdPartyNotices()}catch(error){expect(String(error)).not.toContain(state.folder)}
})
it('A4 · espera el rechazo asíncrono del portapapeles sin filtrar su detalle',async()=>{
 const denied=Promise.reject(new Error('/CANARIO_PRIVADO rechazo asíncrono'));void denied.catch(()=>{})
 state.writeText.mockReturnValueOnce(denied)
 const operation=copyApplicationInfo()
 await expect(operation).rejects.toThrow(/copiar|copy/i)
 await expect(operation).rejects.not.toThrow('CANARIO')
})
