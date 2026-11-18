# PRJ-01c: preservación de las cuatro specs existentes

51 identidades iguales antes/después; mismos proyectos, archivos, suites y títulos, sin duplicados. Fixture prj02-censo.csv sin cambios. No se ha ejecutado GUI. El inventario estático pasa de 401 a 428 llamadas a matcher: 376 permanecen textualmente idénticas y las otras 25 migran según la tabla. Estos números no miden ejecuciones: los helpers y bucles repiten aserciones.

La equivalencia fue autorizada en docs/stories/prj01c-alcance-adr-0021.md del commit a203776. Ningún matcher de datos/bytes/manifiesto/semilla/filas/columnas/SQL/límites/cancelación cambió. project-subset-analysis.spec.ts conserva los 89 matchers literales.

## project.spec.ts:68

Antes:

```ts
expect(projectPanel().getByRole('button',{name:'Renombrar proyecto'})).toHaveCount(0)
```

Después:

```ts
// project.spec.ts:70
await expect(rename).toBeDisabled()
// project.spec.ts:71
await expect(rename).toHaveAccessibleDescription(t('project.future',{version:2}))
```

Motivo: La acción de versión futura permanece en su menú: desactivada y con mutationReason accesible; bytes originales intactos.

## project-source.spec.ts:47

Antes:

```ts
expect(panel().getByText('Verificada · 🔒 Protegida')).toBeVisible()
```

Después:

```ts
// project-source.spec.ts:48
await expectSourceReady()
// project-source.spec.ts:50
async function expectSourceReady(name='datos.csv'){
// project-source.spec.ts:52
await expect(row).not.toContainText(t('project.source.status.changed'))
// project-source.spec.ts:53
await expect(row).not.toContainText(t('project.source.status.missing'))
// project-source.spec.ts:54
await expect(panel().getByTitle(t('project.source.protected'),{exact:true})).toBeVisible()
// project-source.spec.ts:55
await expect(panel().getByTitle(t('project.source.protected'),{exact:true})).toHaveCount(1)
// project-source.spec.ts:57
await expect(menu.getByRole('menuitem',{name:t('dialog.open.button'),exact:true})).toBeEnabled()
```

Motivo: Cada llamada al registro conserva espera observable mediante Abrir habilitado, sin aviso de cambio/falta y protección única por título existente.

## project-source.spec.ts:89

Antes:

```ts
expect(panel().getByText('Cambió desde que se registró · 🔒 Protegida')).toBeVisible()
```

Después:

```ts
// project-source.spec.ts:101
await expect(projectTreeRow(page,'datos.csv').getByText(t('project.source.status.changed'),{exact:true})).toBeVisible()
// project-source.spec.ts:102
await expect(panel().getByTitle(t('project.source.protected'),{exact:true})).toBeVisible()
```

Motivo: Mismo problema visible en la fuente exacta; la protección pasa a la nota única.

## project-source.spec.ts:91

Antes:

```ts
expect(panel().getByText('Verificada · 🔒 Protegida')).toBeVisible()
```

Después:

```ts
// project-source.spec.ts:104
await expectSourceReady()
// project-source.spec.ts:50
async function expectSourceReady(name='datos.csv'){
// project-source.spec.ts:52
await expect(row).not.toContainText(t('project.source.status.changed'))
// project-source.spec.ts:53
await expect(row).not.toContainText(t('project.source.status.missing'))
// project-source.spec.ts:54
await expect(panel().getByTitle(t('project.source.protected'),{exact:true})).toBeVisible()
// project-source.spec.ts:55
await expect(panel().getByTitle(t('project.source.protected'),{exact:true})).toHaveCount(1)
// project-source.spec.ts:57
await expect(menu.getByRole('menuitem',{name:t('dialog.open.button'),exact:true})).toBeEnabled()
```

Motivo: Tras volver a registrar se ejecuta la misma comprobación observable de fuente preparada y protegida.

## project-source.spec.ts:104

Antes:

```ts
expect(panel().getByText('No está en su ruta · 🔒 Protegida')).toBeVisible()
```

Después:

```ts
// project-source.spec.ts:117
await expect(projectTreeRow(page,'datos.csv').getByText(t('project.source.status.missing'),{exact:true})).toBeVisible()
// project-source.spec.ts:118
await expect(panel().getByTitle(t('project.source.protected'),{exact:true})).toBeVisible()
```

Motivo: Mismo problema de ruta visible en la fuente exacta; la protección pasa a la nota única.

## project-source.spec.ts:107

Antes:

```ts
expect(panel().getByRole('button',{name:'Buscar en la carpeta del proyecto',exact:true})).toBeEnabled()
```

Después:

```ts
// project-source.spec.ts:121
await expect(projectTreeRow(page,'datos.csv').getByRole('button',{name:'Buscar en la carpeta del proyecto',exact:true})).toBeEnabled()
```

Motivo: Mismo botón de resolver el problema, mismo estado habilitado tras cancelar, acotado a su fuente.

## project-source.spec.ts:111

Antes:

```ts
expect(panel().getByText('Verificada · 🔒 Protegida')).toBeVisible()
```

Después:

```ts
// project-source.spec.ts:125
await expectSourceReady('movido.csv')
// project-source.spec.ts:50
async function expectSourceReady(name='datos.csv'){
// project-source.spec.ts:52
await expect(row).not.toContainText(t('project.source.status.changed'))
// project-source.spec.ts:53
await expect(row).not.toContainText(t('project.source.status.missing'))
// project-source.spec.ts:54
await expect(panel().getByTitle(t('project.source.protected'),{exact:true})).toBeVisible()
// project-source.spec.ts:55
await expect(panel().getByTitle(t('project.source.protected'),{exact:true})).toHaveCount(1)
// project-source.spec.ts:57
await expect(menu.getByRole('menuitem',{name:t('dialog.open.button'),exact:true})).toBeEnabled()
```

Motivo: Tras reenlace se comprueba Abrir habilitado sin aviso y protección única de movido.csv, conservando id/sha/ruta/bytes.

## project-source.spec.ts:232

Antes:

```ts
expect(tab.getByText(tr('project.source.badge'),{exact:false})).toBeVisible()
```

Después:

```ts
// project-source.spec.ts:246
await expect(tab.getByTitle(tr('project.source.protected'),{exact:true})).toBeVisible()
// project-source.spec.ts:247
await expect(tab.getByTitle(tr('project.source.protected'),{exact:true})).toHaveCount(1)
// project-source.spec.ts:248
await expect(projectTreeRow(page,'datos.csv',locale)).toBeVisible()
```

Motivo: La protección única por título existente y la presencia de la fuente sustituyen la insignia repetida.

## project-subsets.spec.ts:47

Antes:

```ts
expect(panel.getByText(tr('project.source.status.verified')+' · 🔒 '+tr('project.source.badge'))).toBeVisible()
```

Después:

```ts
// project-subsets.spec.ts:48
const row=projectTreeRow(page,'censo.csv',locale)
// project-subsets.spec.ts:49
await expect(row).not.toContainText(tr('project.source.status.changed'))
// project-subsets.spec.ts:50
await expect(row).not.toContainText(tr('project.source.status.missing'))
// project-subsets.spec.ts:51
await expect(panel.getByTitle(tr('project.source.protected'),{exact:true})).toBeVisible()
// project-subsets.spec.ts:52
await expect(panel.getByTitle(tr('project.source.protected'),{exact:true})).toHaveCount(1)
// project-subsets.spec.ts:54
await expect(menu.getByRole('menuitem',{name:tr('dialog.open.button'),exact:true})).toBeEnabled()
```

Motivo: Esperar registro con Abrir habilitado sin aviso, y protección única; no se usa estado privado ni se cambia el fixture.

## project-subsets.spec.ts:194

Antes:

```ts
expect(projectPanel().getByRole('button',{name:'Renombrar',exact:true})).toBeDisabled()
```

Después:

```ts
// project-subsets.spec.ts:203
await expect(menu.getByRole('menuitem',{name:'Renombrar',exact:true})).toBeDisabled()
// project-subsets.spec.ts:204
await expect(menu.getByRole('menuitem',{name:'Renombrar',exact:true})).toHaveAccessibleDescription(t('project.future',{version:2},locale))
```

Motivo: Renombrar sigue desactivado como menuitem e incorpora motivo de versión futura accesible.

## project-subsets.spec.ts:195

Antes:

```ts
expect(projectPanel().getByRole('button',{name:'Eliminar',exact:true})).toBeDisabled()
```

Después:

```ts
// project-subsets.spec.ts:205
await expect(menu.getByRole('menuitem',{name:'Eliminar',exact:true})).toBeDisabled()
// project-subsets.spec.ts:206
await expect(menu.getByRole('menuitem',{name:'Eliminar',exact:true})).toHaveAccessibleDescription(t('project.future',{version:2},locale))
```

Motivo: Eliminar sigue desactivado como menuitem e incorpora motivo de versión futura accesible.

## project-subsets.spec.ts:300

Antes:

```ts
expect(projectPanel().locator('ul.subsets ul.subsets ul.subsets')).toHaveCount(1)
```

Después:

```ts
// project-subsets.spec.ts:312
const sourceRow=projectTreeRow(page,'censo.csv',locale)
// project-subsets.spec.ts:313
const adults=sourceRow.getByRole('group').getByRole('treeitem',{name:'Adultos',exact:true})
// project-subsets.spec.ts:314
const sample=adults.getByRole('group').getByRole('treeitem',{name:'Muestra estable',exact:true})
// project-subsets.spec.ts:315
const columns=sample.getByRole('group').getByRole('treeitem',{name:'Identificador y nota',exact:true})
// project-subsets.spec.ts:316
await expect(columns).toHaveCount(1)
// project-subsets.spec.ts:317
for(const [row,level] of [[sourceRow,1],[adults,2],[sample,3],[columns,4]] as const)await expect(row).toHaveAttribute('aria-level',String(level))
```

Motivo: Misma cadena anidada única mediante groups/treeitems y niveles 1/2/3/4, en lugar de clases de listas retiradas.

## project-subsets.spec.ts:301

Antes:

```ts
expect(recipeRow('Adultos').locator(':scope > .actions').getByRole('button',{name:t('subset.remove',{},language),exact:true})).toBeDisabled()
```

Después:

```ts
// project-subsets.spec.ts:318
const menu=await openProjectRowMenu(recipeRow('Adultos'),locale),remove=menu.getByRole('menuitem',{name:t('subset.remove',{},language),exact:true})
// project-subsets.spec.ts:319
await expect(remove).toBeDisabled()
// project-subsets.spec.ts:320
await expect(remove).toHaveAccessibleDescription(t('subset.hasDependents.other',{count:2,names:'Muestra estable; Identificador y nota'},locale))
```

Motivo: Eliminar Adultos sigue desactivado en su menú con descripción de sus dos descendientes.

## project-subsets.spec.ts:359

Antes:

```ts
expect(projectPanel().locator('.sources').getByRole('button',{name:'Quitar del proyecto',exact:true})).toBeDisabled()
```

Después:

```ts
// project-subsets.spec.ts:379
const sourceMenu=await openProjectRowMenu(projectTreeRow(page,'censo.csv',locale),locale)
// project-subsets.spec.ts:380
await expect(sourceMenu.getByRole('menuitem',{name:'Quitar del proyecto',exact:true})).toBeDisabled()
```

Motivo: Quitar fuente permanece desactivado en su menú; mismo fixture con dependientes.

## project-subsets.spec.ts:360

Antes:

```ts
expect(recipeRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:'Eliminar',exact:true})).toBeDisabled()
```

Después:

```ts
// project-subsets.spec.ts:382
const menu=await openProjectRowMenu(recipeRow('Oaxaca, adultos'),locale),remove=menu.getByRole('menuitem',{name:'Eliminar',exact:true})
// project-subsets.spec.ts:383
await expect(remove).toBeDisabled()
```

Motivo: Eliminar base permanece desactivado en su menú.

## project-subsets.spec.ts:361

Antes:

```ts
expect(recipeRow('Oaxaca, adultos').locator(':scope > p')).toContainText(['Entidad','Listo','No se puede eliminar: Dos mayores'])
```

Después:

```ts
// project-subsets.spec.ts:384
await expect(recipeRow('Oaxaca, adultos')).toContainText('Entidad')
// project-subsets.spec.ts:385
await expect(recipeRow('Oaxaca, adultos')).not.toContainText('Listo')
// project-subsets.spec.ts:386
await expect(recipeRow('Oaxaca, adultos')).not.toContainText(t('project.source.status.changed',{},locale))
// project-subsets.spec.ts:387
await expect(recipeRow('Oaxaca, adultos')).not.toContainText(t('project.source.status.missing',{},locale))
// project-subsets.spec.ts:388
await expect(menu.getByRole('menuitem',{name:'Abrir',exact:true})).toBeEnabled()
// project-subsets.spec.ts:389
await expect(menu.getByRole('menuitem',{name:'Analizar',exact:true})).toBeEnabled()
// project-subsets.spec.ts:390
await expect(remove).toHaveAccessibleDescription(t('subset.hasDependents.one',{count:1,names:'Dos mayores'},locale))
```

Motivo: Las tres propiedades se conservan: resumen Entidad, preparación observable (sin problemas, Abrir/Analizar habilitados, sin Listo) y motivo exacto de eliminación ahora accesible en el menú.

## project-subsets.spec.ts:381

Antes:

```ts
expect(projectPanel().getByText('Cambió desde que se registró · 🔒 Protegida',{exact:true})).toBeVisible()
```

Después:

```ts
// project-subsets.spec.ts:411
await expect(projectTreeRow(page,'censo.csv',locale).getByText(t('project.source.status.changed',{},locale),{exact:true})).toBeVisible()
// project-subsets.spec.ts:412
await expect(projectPanel().getByTitle(t('project.source.protected',{},locale),{exact:true})).toBeVisible()
```

Motivo: Mismo aviso visible en fuente exacta más protección global, conservando todos los pasos del escenario de esquema.

## project-subsets.spec.ts:383

Antes:

```ts
expect(recipeRow(name).locator(':scope > p')).toContainText(['Las columnas de censo.csv cambiaron: la columna 3 era «Edad» y ahora es «Años»'])
```

Después:

```ts
// project-subsets.spec.ts:414
for(const name of ['Oaxaca, adultos','Dos mayores'])await expect(recipeRow(name)).toHaveAccessibleDescription(/Las columnas de censo\.csv cambiaron: la columna 3 era «Edad» y ahora es «Años»/)
```

Motivo: Mismo texto completo escapado en descripción accesible PROPIA de cada base/hijo, evitando coincidencias en descendientes del treeitem.

## project-subsets.spec.ts:404

Antes:

```ts
expect(projectPanel().getByText('Cambió desde que se registró · 🔒 Protegida',{exact:true})).toBeVisible()
```

Después:

```ts
// project-subsets.spec.ts:435
await expect(projectTreeRow(page,'censo.csv',locale).getByText(t('project.source.status.changed',{},locale),{exact:true})).toBeVisible()
// project-subsets.spec.ts:436
await expect(projectPanel().getByTitle(t('project.source.protected',{},locale),{exact:true})).toBeVisible()
```

Motivo: Mismo aviso visible en fuente exacta más protección global.

## project-subsets.spec.ts:405

Antes:

```ts
expect(recipeRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:'Abrir',exact:true})).toBeDisabled()
```

Después:

```ts
// project-subsets.spec.ts:437
const menu=await openProjectRowMenu(recipeRow('Oaxaca, adultos'),locale)
// project-subsets.spec.ts:438
await expect(menu.getByRole('menuitem',{name:'Abrir',exact:true})).toBeDisabled()
```

Motivo: Abrir conjunto sigue desactivado en su menú antes del registro.

## project-subsets.spec.ts:407

Antes:

```ts
expect(recipeRow('Oaxaca, adultos').locator(':scope > p')).toContainText(['Versión distinta de la fuente'])
```

Después:

```ts
// project-subsets.spec.ts:441
await expect(recipeRow('Oaxaca, adultos')).toHaveAttribute('title',/Versión distinta de la fuente/)
```

Motivo: Mismo aviso informativo en título del treeitem exacto, conservando cobertura, hashes y bytes de la prueba.

## project-subsets.spec.ts:419

Antes:

```ts
expect(projectPanel().locator('.sources').getByRole('button',{name:'Nuevo conjunto…',exact:true})).toBeDisabled()
```

Después:

```ts
// project-subsets.spec.ts:453
const sourceMenu=await openProjectRowMenu(projectTreeRow(page,'censo.csv',locale),locale)
// project-subsets.spec.ts:454
await expect(sourceMenu.getByRole('menuitem',{name:'Nuevo conjunto…',exact:true})).toBeDisabled()
// project-subsets.spec.ts:455
await expect(sourceMenu.getByRole('menuitem',{name:'Nuevo conjunto…',exact:true})).toHaveAccessibleDescription(t('project.future',{version:2},locale))
```

Motivo: Nuevo conjunto sigue desactivado en menú de fuente futura, con mutationReason accesible.

## project-subsets.spec.ts:420

Antes:

```ts
expect(recipeRow('Dos conocidas').locator(':scope > .actions').getByRole('button',{name,exact:true})).toBeDisabled()
```

Después:

```ts
// project-subsets.spec.ts:457
const menu=await openProjectRowMenu(recipeRow('Dos conocidas'),locale)
// project-subsets.spec.ts:458
for(const name of ['Renombrar','Eliminar']){
// project-subsets.spec.ts:459
await expect(menu.getByRole('menuitem',{name,exact:true})).toBeDisabled()
// project-subsets.spec.ts:460
await expect(menu.getByRole('menuitem',{name,exact:true})).toHaveAccessibleDescription(t('project.future',{version:2},locale))
```

Motivo: El mismo bucle conserva ambos Renombrar/Eliminar desactivados en su menú, añadiendo mutationReason accesible.

## project-subsets.spec.ts:449

Antes:

```ts
expect(projectPanel().getByText('Cambió desde que se registró · 🔒 Protegida',{exact:true})).toBeVisible()
```

Después:

```ts
// project-subsets.spec.ts:491
await expect(projectTreeRow(page,'censo.csv',locale).getByText(t('project.source.status.changed',{},locale),{exact:true})).toBeVisible()
// project-subsets.spec.ts:492
await expect(projectPanel().getByTitle(t('project.source.protected',{},locale),{exact:true})).toBeVisible()
```

Motivo: Mismo aviso visible en la fuente exacta más protección única, sin cambiar columnas o comprobaciones de reparación.

## project-subsets.spec.ts:480

Antes:

```ts
expect(projectPanel().getByText('Cambió desde que se registró · 🔒 Protegida',{exact:true})).toBeVisible()
```

Después:

```ts
// project-subsets.spec.ts:523
await expect(projectTreeRow(page,'censo.csv',locale).getByText(t('project.source.status.changed',{},locale),{exact:true})).toBeVisible()
// project-subsets.spec.ts:524
await expect(projectPanel().getByTitle(t('project.source.protected',{},locale),{exact:true})).toBeVisible()
```

Motivo: Mismo aviso visible en la fuente exacta más protección única, sin cambiar el borrador o sus comprobaciones de persistencia.

## Comprobaciones estáticas realizadas

- Playwright --list --reporter=json: exit 0; comparación exacta de las 51 identidades contra before, mediante assert.
- tsc -p tsconfig.node.json --noEmit: exit 0 durante la adaptación; no califica las modificaciones concurrentes posteriores del producto.
- git diff --check en las cuatro specs: exit 0.
- Inventario AST: todo matcher retirado tiene una migración explícita; cualquier otro matcher faltante aborta la comprobación.
- SHA-256 del fixture coincide exactamente con before.

Pendiente: E2E con build actualizado, capturas y CI del head final; no se han ejecutado ni declarado verdes.
