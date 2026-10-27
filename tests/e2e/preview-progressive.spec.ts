import {test,expect,_electron as electron} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

test('el párrafo nuevo aparece mientras las imágenes siguen pendientes, sin depender de su latencia',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-preview-progressive-'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 const app=await electron.launch({chromiumSandbox:true,executablePath:electronPath as unknown as string,args:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_TEST_IMAGE_DELAY_MS:'1500',FREYALAB_USER_DATA:join(folder,'profile')}})
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
  await writeFile(join(folder,'imagen.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6X8sAAAAASUVORK5CYII=','base64'))
  const path=join(folder,'documento.md')
  await writeFile(path,'Texto inicial.\n\n![Una imagen](imagen.png)\n\n![Otra imagen](imagen.png)\n\n```mermaid\nflowchart LR\n A --> B\n```\n')
  await page.evaluate(path=>window.freya.openPaths([path]),path)
  await page.getByRole('button',{name:'Dividido',exact:true}).click()
  const preview=page.locator('.preview'),paragraph=preview.locator('article p').first(),images=preview.locator('article img')
  await expect(preview.locator('img[src^="data:"]')).toHaveCount(2)
  await expect(preview.locator('.render-progress')).toHaveCount(0)
  await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+Home');await page.keyboard.insertText('Párrafo actualizado: ')
  await expect(paragraph).toContainText('Párrafo actualizado: Texto inicial.')
  // El estado pendiente, no un umbral de reloj, demuestra que el texto no esperó los recursos.
  expect(await images.evaluateAll(nodes=>nodes.every(node=>!node.getAttribute('src')))).toBe(true)
  await expect(preview.locator('.render-progress')).toBeVisible()
  await expect(preview.locator('img[src^="data:"]')).toHaveCount(2)
  await expect(preview.locator('.mermaid-render svg')).toBeVisible()
  await expect(preview.locator('.render-progress')).toHaveCount(0)
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})
