import {test,expect,_electron as electron} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

test('AC-00 P1/P5 · Pandoc opcional explica DOCX sin bloquear PDF, con diálogo accesible',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'freya-pandoc-ui-')),path=join(directory,'reporte.md'),source='---\nbibliography: referencias.json\n---\n\n# Un reporte\n\nTexto original.\n'
 await writeFile(path,source);await writeFile(join(directory,'referencias.json'),'[]')
 const{ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 const app=await electron.launch({chromiumSandbox:true,executablePath:electronPath as unknown as string,args:[process.env.FREYALAB_AC_TEST_ENTRY??resolve('out/main/index.js')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_TEST_PANDOC_PATH:join(directory,'pandoc-inexistente'),FREYALAB_USER_DATA:join(directory,'profile')}})
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.evaluate(path=>window.freya.openPaths([path]),path)
  await page.getByRole('button',{name:'Exportar',exact:true}).click()
  await expect(page.getByRole('button',{name:'Documento Word (DOCX)',exact:true})).toBeDisabled()
  await expect(page.getByRole('button',{name:'Documento PDF',exact:true})).toBeEnabled()
  await expect(page.getByRole('combobox',{name:/Estilo de citas/})).toBeDisabled({timeout:1000})
  await page.getByRole('button',{name:'Pandoc para exportar',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Pandoc para exportar',exact:true})
  await expect(dialog).toBeVisible();await expect(dialog).toContainText('No se encontró Pandoc')
  await expect(dialog.getByRole('button',{name:'Probar Pandoc',exact:true})).toBeDisabled()
  await expect(dialog.getByRole('button',{name:'Elegir ejecutable',exact:true})).toBeEnabled()
  await expect(dialog.getByRole('button',{name:'Cómo instalar Pandoc',exact:true})).toBeEnabled()
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0)
  expect(await readFile(path,'utf8')).toBe(source)
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})
