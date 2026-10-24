import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

// R1-3 · Limpieza contextual: cada cabecera de columna tiene un menú ▾ con ordenar, filtrar, estadísticas y limpieza con vista previa.
let app:ElectronApplication,page:Page,folder:string
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-column-menu-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

// Cinco filas: tres cambiarían a mayúsculas (la 1.ª, la 3.ª y la 4.ª), «GUADALAJARA» y «PUEBLA» ya lo están; Folio conserva ceros a la izquierda.
const source='Folio,Ciudad,Importe\n00123, oaxaca de juárez ,10\n00124,GUADALAJARA,20\n00125,mérida  ,30\n00126,Cd. de México,40\n00127,PUEBLA,50\n'
async function open(text=source){const path=join(folder,'ventas.csv');await writeFile(path,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(page.getByRole('gridcell',{name:'Fila 1, Folio',exact:true})).toBeVisible();return{doc,path}}
const cell=(row:number,column:string)=>page.getByRole('gridcell',{name:`Fila ${row}, ${column}`,exact:true})
const columnButton=(name:string)=>page.getByRole('button',{name:`Acciones de la columna ${name}`,exact:true})
const menu=()=>page.getByRole('menu',{name:'Acciones de columnas',exact:true})
const state=(id:string)=>page.evaluate(id=>window.freya.documents().then(list=>list.find(item=>item.id===id)),id)
const cities=()=>page.evaluate(async()=>{const [doc]=await window.freya.documents();return(await window.freya.tablePage(doc.id,{offset:0,limit:500,requestId:991})).rows.map(row=>row.cells[1])})

test('cada cabecera tiene un menú ▾ visible con ordenar, filtrar, estadísticas y limpieza', async()=>{
 await open()
 await expect(columnButton('Ciudad')).toBeVisible() // sin pasar el ratón por encima
 await columnButton('Ciudad').click();await expect(menu()).toBeVisible()
 for(const name of ['Ordenar columna ascendente (vista)','Ordenar columna descendente (vista)','Filtrar esta columna','Estadísticas de la columna','Mayúsculas en la columna…','Minúsculas en la columna…','Quitar espacios en la columna…','Quitar filas duplicadas de la columna…','Duplicar columna seleccionada','Eliminar columna seleccionada'])
  await expect(menu().getByRole('menuitem',{name,exact:true}),name).toBeVisible()
 await expect(menu()).toContainText('«Ciudad»')
})

test('el menú se maneja con teclado: Enter lo abre, las flechas recorren y Escape devuelve el foco al botón', async()=>{
 await open()
 await columnButton('Ciudad').focus();await page.keyboard.press('Enter');await expect(menu()).toBeVisible()
 const items=menu().getByRole('menuitem');await expect(items.nth(0)).toBeFocused() // al abrirse enfoca la primera acción
 await page.keyboard.press('ArrowDown');await expect(items.nth(1)).toBeFocused()
 await page.keyboard.press('Escape');await expect(menu()).toHaveCount(0);await expect(columnButton('Ciudad')).toBeFocused()
})

test('mayúsculas en la columna: alcance, vista previa antes → después, recuento, confirmación y un paso de deshacer', async()=>{
 const {doc,path}=await open()
 await columnButton('Ciudad').click();await menu().getByRole('menuitem',{name:'Mayúsculas en la columna…',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Mayúsculas en la columna «Ciudad»',exact:true});await expect(dialog).toBeVisible()
 await expect(dialog).toContainText('columna «Ciudad»');await expect(dialog).toContainText('5 filas')            // alcance
 await expect(dialog.getByRole('status')).toContainText('3 de 5 celdas cambiarán.')                             // vista previa automática: sin pulsar «Vista previa»
 const table=dialog.getByRole('table');await expect(table.locator('tbody tr')).toHaveCount(3)
 await expect(table.locator('tbody tr').first()).toContainText(' oaxaca de juárez ');await expect(table.locator('tbody tr').first()).toContainText(' OAXACA DE JUÁREZ ') // antes y después
 expect(await cities()).toEqual([' oaxaca de juárez ','GUADALAJARA','mérida  ','Cd. de México','PUEBLA']);expect((await state(doc.id))?.dirty).toBe(false) // nada cambia hasta confirmar
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click();await expect(dialog).toHaveCount(0)
 await expect(cell(1,'Ciudad')).toHaveText(' OAXACA DE JUÁREZ ');await expect(cell(4,'Ciudad')).toHaveText('CD. DE MÉXICO');await expect(cell(1,'Folio')).toHaveText('00123')
 expect((await state(doc.id))?.dirty).toBe(true);expect(await readFile(path,'utf8')).toBe(source)               // el archivo solo cambia al guardar
 await page.getByRole('button',{name:'Deshacer',exact:true}).click()
 expect(await cities()).toEqual([' oaxaca de juárez ','GUADALAJARA','mérida  ','Cd. de México','PUEBLA']);expect((await state(doc.id))?.dirty).toBe(false) // un solo paso
})

test('quitar espacios y minúsculas: tres interacciones desde el menú y solo tocan esa columna', async()=>{
 const {doc}=await open()
 await columnButton('Ciudad').click();await menu().getByRole('menuitem',{name:'Quitar espacios en la columna…',exact:true}).click()
 let dialog=page.getByRole('dialog',{name:'Quitar espacios en la columna «Ciudad»',exact:true});await expect(dialog.getByRole('status')).toContainText('2 de 5 celdas cambiarán.')
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click();await expect(dialog).toHaveCount(0)
 expect(await cities()).toEqual(['oaxaca de juárez','GUADALAJARA','mérida','Cd. de México','PUEBLA'])
 await columnButton('Ciudad').click();await menu().getByRole('menuitem',{name:'Minúsculas en la columna…',exact:true}).click()
 dialog=page.getByRole('dialog',{name:'Minúsculas en la columna «Ciudad»',exact:true});await expect(dialog.getByRole('status')).toContainText('3 de 5 celdas cambiarán.')
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click()
 expect(await cities()).toEqual(['oaxaca de juárez','guadalajara','mérida','cd. de méxico','puebla'])
 expect(await page.evaluate(async()=>{const [doc]=await window.freya.documents();return(await window.freya.tablePage(doc.id,{offset:0,limit:5,requestId:992})).rows.map(row=>row.cells[0]+'|'+row.cells[2])})).toEqual(['00123|10','00124|20','00125|30','00126|40','00127|50'])
 expect((await state(doc.id))?.dirty).toBe(true)
})

test('con una búsqueda activa solo cambian las filas visibles y el diálogo avisa de las ocultas', async()=>{
 await open()
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('guadalajara');await expect(page.getByRole('grid',{name:'Tabla de datos'})).toHaveAttribute('aria-rowcount','2')
 await columnButton('Ciudad').click();await menu().getByRole('menuitem',{name:'Minúsculas en la columna…',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Minúsculas en la columna «Ciudad»',exact:true})
 await expect(dialog).toContainText('1 fila de la vista actual');await expect(dialog).toContainText('4 filas ocultas')
 await expect(dialog.getByRole('status')).toContainText('1 de 1 celdas cambiarán.')
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click()
 expect(await cities()).toEqual([' oaxaca de juárez ','guadalajara','mérida  ','Cd. de México','PUEBLA']) // las ocultas no se tocan
})

test('si no hay nada que cambiar la vista previa lo dice y no deja confirmar', async()=>{
 await open('Folio,Ciudad\n1,ya\n2,en\n3,minúsculas\n')
 await columnButton('Ciudad').click();await menu().getByRole('menuitem',{name:'Minúsculas en la columna…',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Minúsculas en la columna «Ciudad»',exact:true})
 await expect(dialog.getByRole('status')).toContainText('0 de 3 celdas cambiarán.');await expect(dialog.getByRole('button',{name:'Aplicar cambio',exact:true})).toBeDisabled()
})

test('«Filtrar esta columna» muestra los filtros y lleva el foco al de esa columna', async()=>{
 await open()
 await columnButton('Ciudad').click();await menu().getByRole('menuitem',{name:'Filtrar esta columna',exact:true}).click()
 await expect(page.getByLabel('Filtrar Ciudad',{exact:true})).toBeFocused()
})

test('«Estadísticas de la columna» abre el panel de resumen con esa columna marcada', async()=>{
 await page.setViewportSize({width:1920,height:1080}) // con una ventana estrecha (la de CI) el panel se abre ampliado y oculta la tabla
 await open()
 await columnButton('Ciudad').click();await menu().getByRole('menuitem',{name:'Estadísticas de la columna',exact:true}).click()
 const tabs=page.getByRole('tablist',{name:'Herramientas de análisis'});await expect(tabs).toBeVisible();await expect(tabs.getByRole('tab',{name:'Resumen',exact:true})).toHaveAttribute('aria-selected','true')
 await expect(page.getByLabel('Seleccionar columna Ciudad',{exact:true})).toBeChecked();await expect(page.getByLabel('Seleccionar columna Folio',{exact:true})).not.toBeChecked()
})

test('«Quitar filas duplicadas de la columna…» abre la transformación con la columna ya elegida y sin cambiar nada', async()=>{
 const {doc}=await open('Folio,Ciudad\n1,Oaxaca\n2,Oaxaca\n3,Mérida\n')
 await columnButton('Ciudad').click();await menu().getByRole('menuitem',{name:'Quitar filas duplicadas de la columna…',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Transformar documento CSV',exact:true});await expect(dialog).toBeVisible()
 await expect(dialog.getByLabel('Transformación CSV',{exact:true})).toHaveValue('deduplicate')
 await expect(dialog.getByLabel('Columnas para transformar',{exact:true})).toHaveValues(['1'])
 await dialog.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(dialog).toContainText('Vista previa lista. El documento sigue intacto.');await expect(dialog.locator('dl')).toContainText('Filas afectadas')
 expect((await state(doc.id))?.dirty).toBe(false)
})
