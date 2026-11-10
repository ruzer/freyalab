# PRJ-01 — Crear y abrir un proyecto, registrar fuentes protegidas

Primera historia de la Iteración 6. Contrato: PRJ-00 (`docs/stories/6-proyectos.md`, PR #75), secciones 4.1, 4.2, 4.3, 4.8, 4.9 y 4.10, y criterios C1 a C4, C11, C12 y C13. Camino del propietario (2026-11-10): AN-1 y luego PRJ-01 a PRJ-05 con el stack actual. PRJ-02 (recetas, con el añadido de muestra y encadenado) se apoya en esta.

## Historia
Como persona que analiza datos, quiero crear un proyecto en una carpeta y añadirle mis archivos originales como fuentes protegidas, para trabajar sobre ellos sabiendo que FreyaLab no los va a modificar y que me avisará si otro programa lo hace.

## Qué hay hoy (main 3a2404a)
- **Carpetas:** «Abrir carpeta» (`case'folder'` en `src/main/index.ts`) añade la carpeta a `docs.roots`, y la barra lateral muestra Archivos | Índice (`Tree.svelte`).
- **Recientes:** `recents.json` en `userData`, máximo 15 rutas (`documents.ts`, `application-recents.ts`).
- **Escritura y huella:**
  - `atomicWrite(path,data,expected?)` (`src/main/files.ts`) escribe con temporal y renombrado, y si recibe `expected` se niega a escribir cuando el archivo cambió en disco.
  - `digest(path)` calcula el SHA-256 en flujo, pero sin progreso ni cancelación.
- **Validación:** zod ya está en el proyecto (IPC).
- **Documentos:** existe `DocumentInfo.readonly`. Los archivos grandes se abren en solo lectura y paginados.
- **Proyecto:** no hay nada (`proyecto.freyalab` no aparece en `src`).

## Diseño UX
**Crear.**
- **Dónde:** Archivo → «Nuevo proyecto…», y el botón «Crear proyecto» de la barra lateral cuando no hay ninguno activo.
- **Diálogo:**
  - Carpeta: una existente o una nueva.
  - Nombre: por defecto, el de la carpeta.
  - Casilla «Crear estructura sugerida», apagada. Crea `01_raw`, `02_datasets`, `03_charts` y `04_reports`, nombres que el propietario puede cambiar.
  - Una nota, solo esta vez: «FreyaLab no controla carpetas sincronizadas ni copias de seguridad. Lo que guardes aquí puede copiarse a otros sitios.»
- **Carpeta que ya tiene `proyecto.freyalab`:** se abre ese proyecto. Nunca se sobrescribe.

**Abrir.**
- Abrir una carpeta que contiene `proyecto.freyalab` activa el proyecto, y abrir el manifiesto con «Abrir» también.
- Archivo → «Proyectos recientes» y la barra lateral sin proyecto muestran los últimos 10, en `userData/recent-projects.json`, con el mismo patrón que `recents.json`.
- Un reciente que ya no existe aparece marcado y se puede quitar.
- **Solo hay un proyecto activo a la vez.** Abrir otro cierra el actual, sin preguntar: el manifiesto ya está guardado.

**Pestaña «Proyecto» en la barra lateral** (FL-MD-007, junto a Archivos | Índice, solo con un proyecto activo).
- **Cabecera:** el nombre, que se puede renombrar en el sitio; la ruta de la carpeta; y «Cerrar proyecto».
- **Sección Fuentes**, una fila por fuente:
  - Nombre del archivo y tamaño.
  - «7 columnas · UTF-8 · coma».
  - Estado: «Verificada», «Cambió desde que se registró», «No está en su ruta» o «Fuera del proyecto».
  - Un candado con el texto «Protegida».
- **Acciones de cada fuente:** Abrir, «Analizar» (abre la pestaña de AN-1), «Mostrar en la carpeta», «Volver a registrar» y «Quitar del proyecto».
- **«Añadir fuente…»:** abre el selector de archivos, solo CSV y TSV.
- **Solo se muestra lo que existe.** Las secciones de conjuntos, gráficos e informes llegan con PRJ-02 a PRJ-05, no como huecos vacíos.

**Añadir una fuente.** También desde el menú contextual del árbol Archivos y desde el menú del CSV abierto («Añadir al proyecto»).
1. **Formato.** Muestra el formato detectado, o el que tiene el CSV abierto: codificación, separador, encabezado, finales de línea y la lista de columnas. Se puede corregir con los mismos controles de la barra de estado del CSV.
2. **Confirmación.** Al pulsar «Añadir y calcular huella» aparece «Calculando huella… 340 MB de 1,0 GB», con barra de progreso y «Cancelar». La interfaz sigue respondiendo.
3. **Al terminar** se guarda la fuente en el manifiesto con `sha256`, `quick`, `format` y `schema` fijos (4.2).
4. **Cancelar no registra nada**, ni siquiera una fuente a medias (C3).

**Casos al añadir:**
- **CSV abierto con cambios sin guardar:** no se registra. Dice «Guarda o descarta los cambios antes de añadirlo», porque se trabaja sobre la versión en disco (4.4).
- **Archivo fuera de la carpeta del proyecto:** se registra con ruta absoluta y `external:true`, y lleva la nota «Otra persona no podrá abrir esta ruta».
- **Archivo ya registrado:** se avisa y no se duplica.
- **Por encima de los límites de análisis** (256 MiB u 8 millones de celdas): se registra igual. La fila lo indica: «Supera el límite de análisis; trabaja con un conjunto o una muestra».

**Protección (4.3).**
- **Al abrir una fuente** se muestra en solo lectura, con este aviso exacto: «Protegida contra cambios hechos por FreyaLab. No impide que otro programa la modifique; FreyaLab lo detecta y avisa.»
- **Bloqueado:** Guardar, reemplazar, transformar, la edición de celdas y el modo Texto editable. Cada control dice el motivo.
- **Permitido:** «Guardar como…» y «Extraer», que crean archivos nuevos.
- **Quitar del proyecto** la devuelve a documento normal.
- **Cerrar el proyecto** deja en solo lectura las pestañas de fuentes abiertas, con el aviso «Proyecto cerrado: cierra y vuelve a abrir el archivo para editarlo».

**Comprobaciones.**
- **Al abrir el proyecto o una fuente:** comprobación rápida (tamaño, `mtime` y el SHA-256 de los primeros y los últimos 64 KiB). Si no coincide, el estado pasa a «Cambió desde que se registró» y aparece «Volver a registrar».
- **Volver a registrar:** recalcula todo y guarda la huella anterior en `history`, un campo opcional y compatible con v1. Nunca se borra la anterior en silencio.
- **Fuente que no está en su ruta:** «Buscar en la carpeta del proyecto» busca solo ahí archivos del mismo tamaño y confirma con el SHA-256 completo. Si coincide, pide confirmación antes de reenlazar. Nunca enlaza por nombre ni recorre otras carpetas.

**El manifiesto.**
- **Escritura:** atómica con `atomicWrite(…, expected)`. Si cambió fuera de FreyaLab, pregunta: «El archivo del proyecto cambió fuera de FreyaLab» con «Recargar» y «Conservar el mío».
- **Formato:** JSON con sangría estable y claves ordenadas.
- **Versión mayor que la conocida:** el proyecto se abre en solo lectura, con un aviso, sin acciones y sin tocar los campos desconocidos.
- **JSON roto o inválido:** muestra el motivo y «Mostrar en la carpeta». Nunca se repara solo.

**Accesibilidad.**
- La pestaña «Proyecto» entra en la lista de pestañas de la barra lateral.
- El progreso es un `progressbar` con el texto anunciado.
- Los estados de cada fuente tienen texto, no solo icono.
- Textos en es, en y en-XA.

## Contrato técnico
- **Validación:** esquema del manifiesto v1 en zod, en `src/shared`, y su JSON Schema publicado (zod 4 lo genera). Pruebas, incluida una versión mayor desconocida (C1).
- **Huella:** una versión cancelable de `digest`, con progreso por bytes y `AbortSignal`, que no bloquee el proceso principal más de lo necesario. Mide la latencia de la interfaz mientras calcula. La usarán PRJ-02 a PRJ-05 (C4).
- **Proyecto activo:** vive en el proceso principal, junto a `docs.roots`. La interfaz lo recibe por IPC validado.
- **Protección:** debe estar en el proceso principal, no solo en la interfaz. Cualquier escritura (`save`, reemplazo, transformación, guardado de texto) sobre una ruta registrada se rechaza ahí aunque la interfaz falle (C2).
- **Fuera de alcance de esta historia:** la red, la telemetría y los borrados de archivos (C12). «Quitar del proyecto» solo olvida la referencia.
- **Sin dependencias nuevas** (C13).

## Entrega en 2 PR (borrador, base `main`, pruebas rojas primero)
1. **PRJ-01a:** manifiesto y validador, crear y abrir, recientes, pestaña «Proyecto» con la cabecera y la lista vacía, escritura atómica con conflicto, versión mayor en solo lectura.
2. **PRJ-01b:** añadir fuente (formato, huella cancelable, esquema), protección en el proceso principal, comprobación rápida, volver a registrar, reenlazar por tamaño y huella, y la medición de la huella.

Coordinación: AN-1a y PRJ-01a tocan los dos `App.svelte` (pestañas superiores y barra lateral). Empieza PRJ-01a cuando AN-1a esté fusionado, o acordad antes qué bloques toca cada uno.

## Aceptación
1. Crear un proyecto en una carpeta vacía escribe un `proyecto.freyalab` válido según el esquema. Con «Crear estructura sugerida» aparecen las cuatro carpetas. En una carpeta que ya tiene manifiesto, lo abre y no lo sobrescribe.
2. Abrir esa carpeta con «Abrir carpeta», abrir el manifiesto o elegirlo en «Proyectos recientes» activa el proyecto y muestra la pestaña «Proyecto».
3. Añadir un CSV de 1 GiB muestra el progreso en bytes, la interfaz responde y al terminar la fuente queda con `sha256`, `quick`, `format` y `schema`. Mide y publica el tiempo en `docs/evidence/` junto con el equipo usado (4.3).
4. Cancelar a mitad deja el manifiesto idéntico, byte a byte, al de antes (C3).
5. Con la fuente registrada abierta, Guardar, reemplazar, transformar, editar celdas y editar el texto están bloqueados con su motivo. Una llamada IPC directa a `save` sobre esa ruta también falla. El SHA-256 de la fuente es igual antes y después de todos los intentos (C2).
6. «Guardar como…» y «Extraer» crean archivos nuevos y no tocan la fuente.
7. Modificar la fuente con otro programa: al abrir el proyecto aparece «Cambió desde que se registró». «Volver a registrar» guarda la huella anterior en `history`.
8. Mover la fuente dentro de la carpeta: aparece «No está en su ruta». «Buscar en la carpeta del proyecto» la encuentra por tamaño y SHA-256 y pide confirmación antes de reenlazar. Un archivo del mismo tamaño pero distinto contenido no se enlaza.
9. Editar el manifiesto fuera de FreyaLab y después cambiar algo en la app: aparece la pregunta de conflicto y no se pierde nada sin elegir (C11).
10. Un manifiesto con `version: 2` se abre en solo lectura y, tras cualquier acción, conserva sus campos desconocidos.
11. Una fuente dentro de la carpeta se guarda con ruta relativa; una de fuera, con ruta absoluta, `external:true` y su nota. El manifiesto no contiene ningún valor de celda (C11).
12. Teclado y lector de pantalla de principio a fin. Capturas en claro y oscuro, en es y en-XA, a 1440×900.

## Casos límite
- La carpeta del proyecto es de solo lectura o se borra con el proyecto abierto: aviso y ninguna escritura a medias.
- Dos ventanas o dos instancias abren el mismo proyecto: lo cubre la detección de cambios del manifiesto.
- La fuente se borra mientras se calcula su huella: error claro y nada registrado.
- Rutas con acentos, espacios y enlaces simbólicos: se guarda la ruta que eligió la persona, y se comprueba con `contained` que una ruta «dentro» realmente lo está.
- CSV con BOM, CRLF, encabezados duplicados o vacíos: `schema` los guarda tal cual, por posición y nombre.

## Plan de pruebas
- Unitarias: esquema y validador, rutas relativas o externas, versión mayor, huella cancelable (progreso y aborto), comprobación rápida y reenlace.
- E2E (`tests/e2e/project.spec.ts`): criterios 1, 2 y 4 a 11, con archivos pequeños.
- Medición fuera de CI (`experiments/`): huella de 1 GiB en el Mac de desarrollo, y si se puede en Windows.

## Fuera de alcance
- Recetas y conjuntos (PRJ-02), extracción con procedencia (PRJ-03), gráficos guardados (PRJ-04), informes (PRJ-05).
- «Copiar al proyecto» un archivo externo, «Exportar proyecto para compartir» y asociar `.freyalab` al sistema operativo.
- Varios proyectos activos a la vez.

## Riesgos que deben quedar escritos en el PR
- El tiempo medido de la huella y en qué equipo.
- Cualquier camino de escritura que no pase por la protección del proceso principal.

## Informa
SHA, pruebas rojas y verdes con su salida, capturas, la medición de la huella y CI de las tres plataformas.
