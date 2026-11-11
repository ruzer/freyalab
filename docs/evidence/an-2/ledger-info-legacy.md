# AN-2 · Adaptación de pruebas de Información

Editados únicamente `tests/e2e/columns-overview.spec.ts`, `tests/e2e/analysis-tab.spec.ts` y `tests/e2e/project-source.spec.ts`. Base inmediata previa a esta tarea guardada en `/private/tmp/an2-info-legacy-base/`; incluye la adaptación de navegación legacy anterior ya aplicada por el padre. No se tocaron fuentes, helpers, otros tests ni commits.

## Ledger por líneas de la base inmediata

| Archivo / líneas base | Adaptación | Comprobación conservada |
| --- | --- | --- |
| `columns-overview.spec.ts:20,41,54,56,63,64,88` | Nombre del botón Obtener información | Misma petición explícita, resultado completo, cancelación, reemplazo, cardinalidad, límites y espera de metadatos |
| `columns-overview.spec.ts:26` | Contenido en `.non-empty`; desplegar `.quality-breakdown` y comprobar sus tres `dd` | Los cuatro valores originales `1,1,1,1`, en orden contenido/ausentes/vacíos exactos/espacios |
| `columns-overview.spec.ts:27` | Acotar summary/details a `.type-explanation` | Foco y Enter reales, explicación ceros iniciales y atributo open |
| `columns-overview.spec.ts:34–35` | Índice y rowheader separados | Filas 10/11 de página dos: índices 61/62 y ambos nombres Duplicada. Primera seleccionada: índice 1 y C0. No se cambian 50/12/2 filas ni paginación |
| `columns-overview.spec.ts:45` | Texto changed nuevo y prefijo visible de error | Las mismas cuatro causas exactas: cambio de datos/alcance, revisión del motor, fuente cambiada y petición cancelada. A las tres causas de error se añade únicamente el prefijo actual No se pudo completar la información. No se acepta una causa nueva |
| `columns-overview.spec.ts:72` | `expectCounts` abre ayudas de calidad/distintos y apunta a los nuevos elementos | Tupla idéntica `[count,0,0,0,1000,count-1000]`; iteraciones 3000,100000,1000000, heartbeat, reloj, archivo intacto y dirty false |
| `columns-overview.spec.ts:83` | Mismo helper sobre la primera fila | Tupla idéntica `[1000000,0,0,0,1,999999]`, apertura fría, archivo intacto y dirty false |
| `columns-overview.spec.ts:120` | Mismo helper sobre la segunda fila | Tupla idéntica `[10000,0,0,0,1,9999]`; filtro, paginación, espera y revisión intactos |
| `analysis-tab.spec.ts:80,125` | Etiqueta Obtener información | Visibilidad y petición explícita. Todas las comprobaciones de llamadas IPC, foco, rango, cifras 30/110/130 y cancelación permanecen iguales |
| `project-source.spec.ts:127,132,173,189,198` | Etiqueta Obtener información | Protección completa frente a muestra, cierre de proyecto, estado sample canónico, informes, disco y seguridad intactos. Antes del avanzado se añade el recorrido describe autorizado abajo |

`expectCounts` solo abre las dos ayudas ya renderizadas y realiza aserciones; no invoca el puente ni recalcula. Sus seis argumentos conservan exactamente el orden y las cifras de los arrays anteriores: contenido, ausentes, vacíos exactos, espacios, distintos y repeticiones.

## Cobertura adicional solicitada por el padre

- `project-source.spec.ts:136` (base): antes de abrir Más estadísticas, entra en Estadísticas, incluye texto/fechas y pulsa Calcular. Comprueba estado completo, count `[1,1,0]` en las tres columnas y caption Documento completo. Abre el informe del nuevo resumen, espera su título y exige ausencia de MUESTRA LIMITADA; vuelve al mismo análisis y ejecuta los checks legacy originales. El selector del informe legacy pasa de primer Markdown a último Markdown, necesario al existir ahora un informe anterior; conserva su título y ausencia de muestra.
- `analysis-tab.spec.ts:193–194` (base): el alias de paleta describe ahora espera el foco natural en el H2 Estadísticas. Es el contrato AN-2 explícito describe→Estadísticas; el alias anterior AN-1a apuntaba a Información. Se conservan búsqueda, Enter, foco real y secuencia de teclado/SQL posteriores.

## Comprobaciones estáticas

- Identidades de casos, etiquetas perf/solo y timeouts comparados con la base inmediata: iguales.
- Comprobaciones originales de IPC, cancelación, disco, revisión, seguridad, límites y cifras preservadas. Ningún valor esperado original se sustituye por otro número.
- Nuevo resumen protegido añade cuatro expect normales y un expect.poll; paleta conserva la misma aserción de foco con el destino exigido por AN-2.
- `git diff --check`: exit 0.
- No GUI, compilación ni pruebas. El padre conserva la ejecución enfocada.

| Archivo | Casos | expect estáticos | expect.poll |
| --- | --- | --- | --- |
| `tests/e2e/columns-overview.spec.ts` | 8 → 8 | 96 → 101 | 2 → 2 |
| `tests/e2e/analysis-tab.spec.ts` | 7 → 7 | 65 → 65 | 4 → 4 |
| `tests/e2e/project-source.spec.ts` | 6 → 6 | 86 → 90 | 0 → 1 |

El conteo estático de expect no refleja invocaciones: tres comparaciones de arrays se trasladan al helper, que contiene cuatro aserciones por cada invocación. Ninguna cifra original se elimina.

## Diff exacto contra la base inmediata

```diff
--- base/tests/e2e/columns-overview.spec.ts
+++ actual/tests/e2e/columns-overview.spec.ts
@@ -17,32 +17,37 @@
 test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
 async function open(text=source){const path=join(folder,'datos.csv');await writeFile(path,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(page.getByRole('grid',{name:'Tabla de datos'})).toBeVisible();return{doc,path}}
 async function overview(){await openAnalysis(page,'Información');return analysisRegion(page,'Vista general de columnas')}
-async function explore(panel:Locator){await panel.getByRole('button',{name:'Explorar columnas',exact:true,includeHidden:true}).click();await expect(panel.getByRole('status')).toHaveText('Exploración de columnas completa.',{timeout:90000})}
+async function explore(panel:Locator){await panel.getByRole('button',{name:'Obtener información',exact:true,includeHidden:true}).click();await expect(panel.getByRole('status')).toHaveText('Exploración de columnas completa.',{timeout:90000})}
 async function report(panel:Locator){await panel.getByRole('button',{name:'Abrir informe de columnas Markdown',exact:true}).click();await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.kind==='markdown')?.text).toContain('# Vista general de columnas CSV');return(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.kind==='markdown')!}
+async function expectCounts(row:Locator,[content,missing,exact,spaces,unique,repetitions]:[string,string,string,string,string,string]){
+ await expect(row.locator('.non-empty')).toHaveText(content)
+ await row.locator('.quality-breakdown>summary').click();await expect(row.locator('.quality-breakdown dd')).toHaveText([missing,exact,spaces])
+ await row.locator('.distinct-detail>summary').click();await expect(row.locator('.distinct-detail>summary')).toHaveText(unique);await expect(row.locator('.distinct-detail p').nth(1)).toHaveText('Repeticiones adicionales: '+repetitions)
+}
 
 test('panorámica: tipos, calidad, alcance, explicación por teclado, informe y documento intacto',async()=>{
  const {doc,path}=await open(),before=await page.evaluate(()=>window.freya.documents()),panel=await overview();await explore(panel)
  const rows=panel.locator('tbody tr');await expect(rows).toHaveCount(5);await expect(rows.nth(0)).toContainText('Posible identificador');await expect(rows.nth(1)).toContainText('Categórico');await expect(rows.nth(2)).toContainText('Numérico');await expect(rows.nth(3)).toContainText('Mixto')
- expect((await rows.nth(4).locator('th,td').allTextContents()).slice(2,6)).toEqual(['1','1','1','1'])
- const explanation=rows.nth(0).locator('summary');await explanation.focus();await explanation.press('Enter');await expect(rows.nth(0)).toContainText('ceros iniciales');await expect(rows.nth(0).locator('details')).toHaveAttribute('open','')
+ await expect(rows.nth(4).locator('.non-empty')).toHaveText('1');await rows.nth(4).locator('.quality-breakdown>summary').click();await expect(rows.nth(4).locator('.quality-breakdown dd')).toHaveText(['1','1','1'])
+ const explanation=rows.nth(0).locator('.type-explanation>summary');await explanation.focus();await explanation.press('Enter');await expect(rows.nth(0)).toContainText('ceros iniciales');await expect(rows.nth(0).locator('.type-explanation')).toHaveAttribute('open','')
  for(const [theme,width,height] of [['light',1440,900],['dark',1280,800]] as const){await page.getByLabel('Tema',{exact:true}).selectOption(theme);await page.setViewportSize({width,height});await panel.scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:test.info().outputPath(`dw04b-overview-${theme}-${width}x${height}.png`)})}
  await showTable(page);await page.getByLabel('Buscar en tabla',{exact:true}).fill('Oaxaca');await expect(page.locator('footer')).toContainText('3 de 4 filas');await overview();await expect(rows).toHaveCount(5);await panel.getByLabel('Alcance de la vista general',{exact:true}).selectOption('view');await explore(panel);await expect(panel.locator('.scope')).toContainText('Vista filtrada');await expect(panel.locator('.scope')).toContainText('3 filas por columna')
  await panel.getByLabel('Buscar nombres de columnas',{exact:true}).fill('Total');await expect(rows).toHaveCount(1);const output=await report(panel);expect(output.text).toContain('Columnas solicitadas: 5. Analizadas: 5. No disponibles: 0.');expect(output.text).toContain('"search": "Oaxaca"');expect(output.text).toContain('"1. ID"');expect(output.text).toContain('"5. Opcional"');expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toEqual(before[0]);expect(await readFile(path,'utf8')).toBe(source)
 })
 
 test('panorámica: páginas, nombres duplicados, columnas marcadas y detalle conservan el alcance',async()=>{
- const headers=Array.from({length:62},(_,i)=>i===60||i===61?'Duplicada':'C'+i),text=stringify([headers,headers.map((_,i)=>String(i))]),{path}=await open(text),panel=await overview();await explore(panel);const rows=panel.locator('tbody tr');await expect(rows).toHaveCount(50);await panel.getByRole('button',{name:'Columnas siguientes',exact:true}).click();await expect(rows).toHaveCount(12);await expect(rows.nth(10)).toContainText('61. Duplicada');await expect(rows.nth(11)).toContainText('62. Duplicada')
- await showTable(page);await page.getByLabel('Seleccionar columna C0',{exact:true}).check();await page.getByLabel('Seleccionar columna C1',{exact:true}).check();await overview();await panel.getByLabel('Columnas para explorar',{exact:true}).selectOption('selected');await explore(panel);await expect(rows).toHaveCount(2);await expect(rows.first()).toContainText('1. C0');await expect(panel.locator('.pagination')).toContainText('1–2 de 2');await expect(panel.getByRole('button',{name:'Columnas anteriores',exact:true})).toBeDisabled()
+ const headers=Array.from({length:62},(_,i)=>i===60||i===61?'Duplicada':'C'+i),text=stringify([headers,headers.map((_,i)=>String(i))]),{path}=await open(text),panel=await overview();await explore(panel);const rows=panel.locator('tbody tr');await expect(rows).toHaveCount(50);await panel.getByRole('button',{name:'Columnas siguientes',exact:true}).click();await expect(rows).toHaveCount(12);await expect(rows.nth(10).locator('td').first()).toHaveText('61');await expect(rows.nth(10).getByRole('rowheader')).toHaveText('Duplicada');await expect(rows.nth(11).locator('td').first()).toHaveText('62');await expect(rows.nth(11).getByRole('rowheader')).toHaveText('Duplicada')
+ await showTable(page);await page.getByLabel('Seleccionar columna C0',{exact:true}).check();await page.getByLabel('Seleccionar columna C1',{exact:true}).check();await overview();await panel.getByLabel('Columnas para explorar',{exact:true}).selectOption('selected');await explore(panel);await expect(rows).toHaveCount(2);await expect(rows.first().locator('td').first()).toHaveText('1');await expect(rows.first().getByRole('rowheader')).toHaveText('C0');await expect(panel.locator('.pagination')).toContainText('1–2 de 2');await expect(panel.getByRole('button',{name:'Columnas anteriores',exact:true})).toBeDisabled()
  await panel.getByLabel('Alcance de la vista general',{exact:true}).selectOption('view');await explore(panel);await panel.getByRole('button',{name:'Elegir columna 2 para explorar',exact:true}).click();const detail=page.getByRole('region',{name:'Exploración de columna',exact:true});await expect(detail.getByLabel('Columna para explorar',{exact:true})).toHaveValue('1');await expect(detail.getByLabel('Filas para explorar',{exact:true})).toHaveValue('view');await expect(page.locator('.analysis-workspace:not([hidden])').getByRole('heading',{name:'Estadísticas',exact:true})).toBeFocused();await detail.getByRole('button',{name:'Explorar columna',exact:true}).click();await expect(detail.getByRole('status')).toHaveText('Exploración completa.');expect(await readFile(path,'utf8')).toBe(text)
 })
 
 test('panorámica: cancelar o cambiar revisión descarta respuestas tardías y no continúa columnas',async()=>{
  const {doc,path}=await open(),panel=await overview()
- await expect(panel.getByRole('button',{name:'Explorar columnas',exact:true})).toBeEnabled()
+ await expect(panel.getByRole('button',{name:'Obtener información',exact:true})).toBeEnabled()
  await panel.evaluate(element=>{element.querySelector<HTMLFormElement>('form')!.requestSubmit();queueMicrotask(()=>{Reflect.set(window,'overviewCancelledPhase',element.querySelector('[role=status]')?.textContent);const button=[...element.querySelectorAll('button')].find(button=>button.textContent==='Cancelar exploración de columnas');if(!button)throw new Error('Sin cancelación durante el análisis');button.click()})})
  expect(await page.evaluate(()=>Reflect.get(window,'overviewCancelledPhase'))).toBe('Explorando columna 1 de 5…');await expect(panel.getByRole('status')).toHaveText('Exploración de columnas cancelada.');await page.evaluate(id=>window.freya.tablePage(id,{offset:0,limit:1,requestId:999}),doc.id);await expect(panel.locator('tbody tr')).toHaveCount(0);await expect(panel.getByRole('button',{name:'Abrir informe de columnas Markdown',exact:true})).toBeDisabled()
  await panel.evaluate((element,id)=>{element.querySelector<HTMLFormElement>('form')!.requestSubmit();queueMicrotask(()=>Reflect.set(window,'overviewPendingEdit',window.freya.tableEdit(id,{type:'cell',rowId:'1',column:2,value:'99'})))},doc.id)
- await page.evaluate(async()=>await Reflect.get(window,'overviewPendingEdit'));await expect(panel.getByRole('status')).toHaveText(/^(Datos o alcance actualizados\. Pulsa Explorar columnas\.|La tabla cambió\. Vuelve a analizar\.|Los datos cambiaron\. Vuelve a explorar\.|Análisis cancelado: la tabla cambió o se recibió otra solicitud\.)$/);await expect(panel.locator('tbody tr')).toHaveCount(0);await expect(panel.getByRole('button',{name:'Abrir informe de columnas Markdown',exact:true})).toBeDisabled();expect(await readFile(path,'utf8')).toBe(source)
+ await page.evaluate(async()=>await Reflect.get(window,'overviewPendingEdit'));await expect(panel.getByRole('status')).toHaveText(/^(Datos o alcance actualizados\. Pulsa Obtener información\.|No se pudo completar la información\. (La tabla cambió\. Vuelve a analizar\.|Los datos cambiaron\. Vuelve a explorar\.|Análisis cancelado: la tabla cambió o se recibió otra solicitud\.))$/);await expect(panel.locator('tbody tr')).toHaveCount(0);await expect(panel.getByRole('button',{name:'Abrir informe de columnas Markdown',exact:true})).toBeDisabled();expect(await readFile(path,'utf8')).toBe(source)
  // La edición directa prueba el rechazo del motor; reabrir sincroniza sus metadatos con la interfaz.
  await page.evaluate(path=>window.freya.openPaths([path]),path);await overview();await expect(panel.getByRole('status')).toContainText('Datos o alcance actualizados');await explore(panel);await expect(panel.locator('tbody tr')).toHaveCount(5);const current=(await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)!;expect(current.revision).toBeGreaterThan(doc.revision);expect((await page.evaluate(id=>window.freya.tablePage(id,{offset:0,limit:1,requestId:1000}),doc.id)).rows[0].cells[2]).toBe('99')
 })
@@ -51,17 +56,17 @@
  test.setTimeout(120000)
  const text='Valor\n'+'2\n'.repeat(1000000),{doc,path}=await open(text),panel=await overview()
  await panel.evaluate((element,doc)=>{const observer=new MutationObserver(()=>{if(!element.querySelector('[role=status]')?.textContent?.startsWith('Explorando columna 1 de'))return;observer.disconnect();void window.freya.analyzeColumn(doc.id,{column:0,revision:doc.revision,requestId:crypto.randomUUID(),frequencyOffset:0,duplicatesOnly:false,bins:10}).then(()=>Reflect.set(window,'overviewReplacementSettled',true),error=>{Reflect.set(window,'overviewReplacementError',String(error));Reflect.set(window,'overviewReplacementSettled',true)})});observer.observe(element,{subtree:true,childList:true,characterData:true})},doc)
- await panel.getByRole('button',{name:'Explorar columnas',exact:true,includeHidden:true}).click();await page.waitForFunction(()=>Reflect.get(window,'overviewReplacementSettled'));expect(await page.evaluate(()=>Reflect.get(window,'overviewReplacementError'))).toBeUndefined()
+ await panel.getByRole('button',{name:'Obtener información',exact:true,includeHidden:true}).click();await page.waitForFunction(()=>Reflect.get(window,'overviewReplacementSettled'));expect(await page.evaluate(()=>Reflect.get(window,'overviewReplacementError'))).toBeUndefined()
  await expect(panel.getByRole('status')).toContainText('cancelado');await expect(panel.locator('tbody tr')).toHaveCount(0);await expect(panel.getByRole('button',{name:'Abrir informe de columnas Markdown',exact:true})).toBeDisabled();expect(await readFile(path,'utf8')).toBe(text)
- const file=join(folder,'cardinalidad.csv'),large='Inicio,ID,Final\n'+Array.from({length:100001},(_,i)=>`2,${i},texto`).join('\n')+'\n';await writeFile(file,large);await page.evaluate(path=>window.freya.openPaths([path]),file);const next=await overview();await next.getByRole('button',{name:'Explorar columnas',exact:true}).click();await expect(next.getByRole('status')).toHaveText('Exploración terminada: 2 columnas analizadas; 1 no disponibles.',{timeout:90000});await expect(next.locator('tbody tr')).toHaveCount(3);await expect(next.locator('tbody tr').nth(1)).toContainText('No disponible');await expect(next.locator('.scope')).toContainText('cobertura parcial');const output=await report(next);expect(output.text).toContain('COBERTURA PARCIAL');expect(output.text).toContain('Columnas solicitadas: 3. Analizadas: 2. No disponibles: 1.');expect(await readFile(file,'utf8')).toBe(large)
+ const file=join(folder,'cardinalidad.csv'),large='Inicio,ID,Final\n'+Array.from({length:100001},(_,i)=>`2,${i},texto`).join('\n')+'\n';await writeFile(file,large);await page.evaluate(path=>window.freya.openPaths([path]),file);const next=await overview();await next.getByRole('button',{name:'Obtener información',exact:true}).click();await expect(next.getByRole('status')).toHaveText('Exploración terminada: 2 columnas analizadas; 1 no disponibles.',{timeout:90000});await expect(next.locator('tbody tr')).toHaveCount(3);await expect(next.locator('tbody tr').nth(1)).toContainText('No disponible');await expect(next.locator('.scope')).toContainText('cobertura parcial');const output=await report(next);expect(output.text).toContain('COBERTURA PARCIAL');expect(output.text).toContain('Columnas solicitadas: 3. Analizadas: 2. No disponibles: 1.');expect(await readFile(file,'utf8')).toBe(large)
 })
 
 test('panorámica: muestra etiquetada incluso durante el cálculo y presupuesto sin totales inventados',{tag:'@perf'},async()=>{
  const path=join(folder,'muestra.csv');await writeFile(path,'ID,Valor\n'+'00123,2\n'.repeat(250));await truncate(path,50*1024*1024+1);const before=await stat(path),[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);expect(doc.readonly).toBe(true);const panel=await overview()
  await panel.evaluate(element=>{const observer=new MutationObserver(()=>{if(element.querySelectorAll('tbody tr').length!==1||!element.querySelector('[role=status]')?.textContent?.startsWith('Explorando columna'))return;Reflect.set(window,'overviewProvisionalSampleScope',element.querySelector('.scope')?.textContent);observer.disconnect()});observer.observe(element,{subtree:true,childList:true,characterData:true})})
  await explore(panel);const provisional=await page.evaluate(()=>Reflect.get(window,'overviewProvisionalSampleScope'));expect(provisional).toContain('Muestra completa');expect(provisional).not.toContain('Documento completo');expect(provisional).toContain('resultados provisionales');const output=await report(panel);expect(output.text).toContain('MUESTRA LIMITADA');expect((await stat(path)).size).toBe(before.size);expect((await stat(path)).mtimeMs).toBe(before.mtimeMs)
- const many=join(folder,'muchas-columnas.csv'),manyText=Array.from({length:2001},(_,i)=>'C'+i).join(',')+'\n1\n';await writeFile(many,manyText);await page.evaluate(path=>window.freya.openPaths([path]),many);const capped=await overview();await capped.getByRole('button',{name:'Explorar columnas',exact:true}).click();await expect(capped.getByRole('status')).toContainText('hasta 2 000 columnas');await expect(capped.locator('tbody tr')).toHaveCount(0);expect(await readFile(many,'utf8')).toBe(manyText)
- const wide=join(folder,'ancho.csv');await writeFile(wide,Array.from({length:2000},(_,i)=>'C'+i).join(',')+'\n'+'1\n'.repeat(1001));await page.evaluate(path=>window.freya.openPaths([path]),wide);const limited=await overview();await limited.getByRole('button',{name:'Explorar columnas',exact:true}).click();await expect(limited.getByRole('status')).toContainText('dos millones de posiciones');await expect(limited.locator('tbody tr')).toHaveCount(0);await expect(limited.getByRole('button',{name:'Abrir informe de columnas Markdown',exact:true})).toBeDisabled()
+ const many=join(folder,'muchas-columnas.csv'),manyText=Array.from({length:2001},(_,i)=>'C'+i).join(',')+'\n1\n';await writeFile(many,manyText);await page.evaluate(path=>window.freya.openPaths([path]),many);const capped=await overview();await capped.getByRole('button',{name:'Obtener información',exact:true}).click();await expect(capped.getByRole('status')).toContainText('hasta 2 000 columnas');await expect(capped.locator('tbody tr')).toHaveCount(0);expect(await readFile(many,'utf8')).toBe(manyText)
+ const wide=join(folder,'ancho.csv');await writeFile(wide,Array.from({length:2000},(_,i)=>'C'+i).join(',')+'\n'+'1\n'.repeat(1001));await page.evaluate(path=>window.freya.openPaths([path]),wide);const limited=await overview();await limited.getByRole('button',{name:'Obtener información',exact:true}).click();await expect(limited.getByRole('status')).toContainText('dos millones de posiciones');await expect(limited.locator('tbody tr')).toHaveCount(0);await expect(limited.getByRole('button',{name:'Abrir informe de columnas Markdown',exact:true})).toBeDisabled()
 })
 
 test('panorámica: mide 3 000, 100 000 y un millón de filas completas con una columna',{tag:'@perf'},async()=>{
@@ -69,7 +74,7 @@
  for(const count of [3000,100000,1000000]){
   const text='Valor\n'+(Array.from({length:1000},(_,i)=>String(i)).join('\n')+'\n').repeat(count/1000),begin=performance.now(),{doc,path}=await open(text),openMs=performance.now()-begin;expect(doc.readonly).toBe(false)
   const panel=await overview();await page.evaluate(()=>{let previous=performance.now();const state={gaps:[] as number[],timer:0};state.timer=window.setInterval(()=>{const now=performance.now();state.gaps.push(now-previous);previous=now},20);Reflect.set(window,'overviewTiming',state)})
-  const started=performance.now();await explore(panel);const exploreMs=performance.now()-started,heartbeat=await page.evaluate(()=>{const state=Reflect.get(window,'overviewTiming');clearInterval(state.timer);return{intervalMs:20,samples:state.gaps.length,maxGapMs:Math.max(0,...state.gaps)}});await expect(panel.locator('.scope')).toContainText(count.toLocaleString()+' filas por columna');expect((await panel.locator('tbody tr th,tbody tr td').allTextContents()).slice(2,8)).toEqual([count.toLocaleString(),'0','0','0',(1000).toLocaleString(),(count-1000).toLocaleString()]);expect(await readFile(path,'utf8')).toBe(text);expect((await page.evaluate(()=>window.freya.documents())).find(item=>item.id===doc.id)?.dirty).toBe(false)
+  const started=performance.now();await explore(panel);const exploreMs=performance.now()-started,heartbeat=await page.evaluate(()=>{const state=Reflect.get(window,'overviewTiming');clearInterval(state.timer);return{intervalMs:20,samples:state.gaps.length,maxGapMs:Math.max(0,...state.gaps)}});await expect(panel.locator('.scope')).toContainText(count.toLocaleString()+' filas por columna');await expectCounts(panel.locator('tbody tr').first(),[count.toLocaleString(),'0','0','0',(1000).toLocaleString(),(count-1000).toLocaleString()]);expect(await readFile(path,'utf8')).toBe(text);expect((await page.evaluate(()=>window.freya.documents())).find(item=>item.id===doc.id)?.dirty).toBe(false)
   measurements.push({rows:count,columns:1,bytes:Buffer.byteLength(text),openMs,exploreMs,heartbeat});await page.evaluate(id=>window.freya.close(id),doc.id)
  }
  await writeFile(test.info().outputPath('column-overview-profile.json'),JSON.stringify({recordedAt:new Date().toISOString(),platform:process.platform,arch:process.arch,os:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),node:process.versions.node,electron:await app.evaluate(()=>process.versions.electron),measurements},null,2)+'\n')
@@ -80,12 +85,12 @@
  const text='Valor\n'+'2\n'.repeat(1000000),path=join(folder,'apertura-fria.csv');await writeFile(path,text)
  const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);expect(doc.readonly).toBe(false)
  const panel=await overview();await explore(panel)
- await expect(panel.locator('.scope')).toContainText((1000000).toLocaleString()+' filas por columna');expect((await panel.locator('tbody tr th,tbody tr td').allTextContents()).slice(2,8)).toEqual([(1000000).toLocaleString(),'0','0','0','1',(999999).toLocaleString()])
+ await expect(panel.locator('.scope')).toContainText((1000000).toLocaleString()+' filas por columna');await expectCounts(panel.locator('tbody tr').first(),[(1000000).toLocaleString(),'0','0','0','1',(999999).toLocaleString()])
  expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)?.dirty).toBe(false);expect(await readFile(path,'utf8')).toBe(text)
 })
 
 test('panorámica: espera metadatos del filtro nuevo y conserva el análisis al paginar ese mismo alcance',async()=>{
- const text='Grupo,Valor\n'+'visible,2\noculto,9\n'.repeat(10000),{path}=await open(text),panel=await overview(),button=panel.getByRole('button',{name:'Explorar columnas',exact:true,includeHidden:true})
+ const text='Grupo,Valor\n'+'visible,2\noculto,9\n'.repeat(10000),{path}=await open(text),panel=await overview(),button=panel.getByRole('button',{name:'Obtener información',exact:true,includeHidden:true})
  await panel.getByLabel('Alcance de la vista general',{exact:true}).selectOption('view');await expect(button).toBeEnabled()
  await showTable(page)
  const blocked=await page.getByLabel('Buscar en tabla',{exact:true}).evaluate(async input=>{
@@ -117,5 +122,5 @@
  await overview();await expect(panel.getByRole('status')).toHaveText('Explorando columna 1 de 2…');await app.evaluate(()=>Reflect.get(globalThis,'overviewPagingRelease')?.())
  await expect(panel.getByRole('status')).toHaveText('Exploración de columnas completa.',{timeout:90000})
  await expect(panel.locator('.scope')).toContainText((10000).toLocaleString()+' filas por columna');await expect(panel.locator('tbody tr')).toHaveCount(2)
- expect((await panel.locator('tbody tr').nth(1).locator('th,td').allTextContents()).slice(2,8)).toEqual([(10000).toLocaleString(),'0','0','0','1',(9999).toLocaleString()]);expect(await readFile(path,'utf8')).toBe(text)
+ await expectCounts(panel.locator('tbody tr').nth(1),[(10000).toLocaleString(),'0','0','0','1',(9999).toLocaleString()]);expect(await readFile(path,'utf8')).toBe(text)
 })
--- base/tests/e2e/analysis-tab.spec.ts
+++ actual/tests/e2e/analysis-tab.spec.ts
@@ -77,7 +77,7 @@
  await analysis().locator('.advanced-statistics>summary').click();await expect(button('Analizar')).toBeVisible()
  expect(await calls()).toEqual(['save'])
  await section('SQL').click();await expect(button('Ejecutar consulta')).toBeVisible()
- await section('Información').click();await expect(button('Explorar columnas')).toBeVisible()
+ await section('Información').click();await expect(button('Obtener información')).toBeVisible()
  expect(await calls()).toEqual(['save'])
  await button('Ir al CSV').click();await openAnalysis();await expect(tab()).toHaveCount(1)
  for(const name of ['Guardar','Deshacer','Rehacer','Exportar'])await expect(page.locator('.toolbar').getByRole('button',{name,exact:true})).toBeDisabled()
@@ -122,7 +122,7 @@
  await openAnalysis()
  await analysis().getByLabel('Alcance de la vista general',{exact:true}).selectOption('view')
  await analysis().getByLabel('Columnas para explorar',{exact:true}).selectOption('selected')
- await button('Explorar columnas').click()
+ await button('Obtener información').click()
  await expect(analysis().locator('.scope')).toContainText('2 filas por columna')
  await expect(analysis().locator('tbody tr')).toHaveCount(1)
  await section('Estadísticas').click();await analysis().locator('.advanced-statistics>summary').click()
@@ -191,7 +191,7 @@
  await runApplicationMenu(app,'edit.commandPalette')
  const search=page.getByRole('searchbox',{name:'Buscar comando CSV',exact:true})
  await search.fill('describe');await search.press('Enter')
- await expect(analysis().getByRole('heading',{name:'Información',exact:true})).toBeFocused()
+ await expect(analysis().getByRole('heading',{name:'Estadísticas',exact:true})).toBeFocused()
  await tab().focus();await page.keyboard.press('ArrowLeft')
  const csv=tablist().getByRole('tab',{name:'datos.csv',exact:true})
  await expect(csv).toBeFocused();await page.keyboard.press('ArrowRight');await expect(tab()).toBeFocused()
--- base/tests/e2e/project-source.spec.ts
+++ actual/tests/e2e/project-source.spec.ts
@@ -124,22 +124,31 @@
  const workspace=page.locator('.analysis-workspace:not([hidden])'),overview=workspace.getByRole('region',{name:'Vista general de columnas',exact:true})
  await expect(workspace.locator('.analysis-warning')).toHaveCount(0)
  await expect(overview.getByLabel('Alcance de la vista general').locator('option[value="all"]')).toHaveText('Documento completo')
- await overview.getByRole('button',{name:'Explorar columnas',exact:true}).click()
+ await overview.getByRole('button',{name:'Obtener información',exact:true}).click()
  await expect(overview.getByRole('status')).toHaveText('Exploración de columnas completa.')
  await expect(overview.locator('tbody tr')).toHaveCount(3)
  await expect(overview.locator('.scope')).toContainText('Documento completo')
  await overview.getByLabel('Alcance de la vista general').selectOption('view')
- await overview.getByRole('button',{name:'Explorar columnas',exact:true}).click()
+ await overview.getByRole('button',{name:'Obtener información',exact:true}).click()
  await expect(overview.getByRole('status')).toHaveText('Exploración de columnas completa.')
  await expect(overview.locator('.scope')).toContainText('Vista filtrada')
  await expect(overview.locator('.scope')).not.toContainText('muestra')
+ await workspace.getByRole('button',{name:'Estadísticas',exact:true}).click()
+ const describe=workspace.getByRole('region',{name:'Resumen estadístico',exact:true})
+ await describe.getByRole('checkbox',{name:'Incluir texto y fechas',exact:true}).check();await describe.getByRole('button',{name:'Calcular',exact:true}).click()
+ await expect(describe.getByRole('status')).toHaveText('Resumen calculado.');await expect(describe.locator('tbody tr').first().locator('td')).toHaveText(['1','1','0']);await expect(describe.locator('caption')).toContainText('Documento completo')
+ await describe.getByRole('button',{name:'Abrir informe Markdown',exact:true}).click()
+ await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).filter(doc=>doc.kind==='markdown').at(-1)?.text).toContain('# Resumen estadístico CSV')
+ const describeReport=(await page.evaluate(()=>window.freya.documents())).filter(doc=>doc.kind==='markdown').at(-1)!
+ expect(describeReport.text).not.toContain('MUESTRA LIMITADA')
+ await page.getByRole('tab',{name:'Análisis de datos.csv',exact:true}).click()
  await showPanel(page,'Estadísticas')
  const statistics=workspace.getByRole('region',{name:'Estadísticas por columna',exact:true})
  await expect(statistics).not.toContainText('Solo muestra')
  await statistics.getByRole('button',{name:'Analizar',exact:true}).click()
  await expect(statistics.getByRole('status')).toHaveText('Análisis completo.')
  await statistics.getByRole('button',{name:'Abrir informe detallado',exact:true}).click()
- const statisticsReport=(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.kind==='markdown')!
+ const statisticsReport=(await page.evaluate(()=>window.freya.documents())).filter(doc=>doc.kind==='markdown').at(-1)!
  expect(statisticsReport.text).toContain('# Informe de estadísticas CSV')
  expect(statisticsReport.text).not.toContain('MUESTRA LIMITADA')
  await page.getByRole('tab',{name:'Análisis de datos.csv',exact:true}).click()
@@ -170,7 +179,7 @@
  await expect(workspace.locator('.analysis-warning')).toHaveCount(0)
  await workspace.getByRole('button',{name:'Información',exact:true}).click()
  await overview.getByLabel('Alcance de la vista general').selectOption('all')
- await overview.getByRole('button',{name:'Explorar columnas',exact:true}).click()
+ await overview.getByRole('button',{name:'Obtener información',exact:true}).click()
  await expect(overview.getByRole('status')).toHaveText('Exploración de columnas completa.')
  await expect(overview.locator('.scope')).toContainText('Documento completo')
  await showTable(page,'datos.csv');const closedCommands=await openCsvCommands(page,app);await expect(closedCommands.locator(':scope>p').first()).toHaveText(t('ui.reason.projectClosed'));await expect(closedCommands).not.toContainText('Muestra de solo lectura');await closedCommands.getByRole('button',{name:'Cerrar comandos CSV',exact:true}).click();await openAnalysis(page,'Información')
@@ -186,7 +195,7 @@
  const workspace=page.locator('.analysis-workspace:not([hidden])'),overview=workspace.getByRole('region',{name:'Vista general de columnas',exact:true})
  await expect(workspace.locator('.analysis-warning')).toHaveText(t('charts.fields.sample'))
  await expect(overview.getByLabel('Alcance de la vista general').locator('option[value="all"]')).toHaveText('Muestra completa')
- await overview.getByRole('button',{name:'Explorar columnas',exact:true}).click()
+ await overview.getByRole('button',{name:'Obtener información',exact:true}).click()
  await expect(overview.getByRole('status')).toHaveText('Exploración de columnas completa.')
  await expect(overview.locator('.scope')).toContainText('200 filas por columna')
  await expect(overview.locator('.scope')).toContainText('Muestra completa')
@@ -195,7 +204,7 @@
  await panel().getByRole('button',{name:'Analizar',exact:true}).click()
  expect((await page.evaluate(()=>window.freya.documents()))[0]).toMatchObject({readonly:true,projectSource:'protected',rowCount:200})
  await expect(workspace.locator('.analysis-warning')).toHaveText(t('charts.fields.sample'))
- await overview.getByRole('button',{name:'Explorar columnas',exact:true}).click()
+ await overview.getByRole('button',{name:'Obtener información',exact:true}).click()
  await expect(overview.getByRole('status')).toHaveText('Exploración de columnas completa.')
  await expect(overview.locator('.scope')).toContainText('Muestra completa')
  await panel().getByRole('button',{name:'Cerrar proyecto',exact:true}).click()
```
