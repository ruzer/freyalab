# SIM-1a · Un solo menú de columna, más corto

Código final local: `43e9dbb5ef233eb65d61d62c46a3da00f7012403`. Base integrada `main 23121eda41fb9380c533a25ef86723046b6d7639`; rama `codex/sim-1a-menu-columnas`. Node 24.22.1, macOS arm64. La raíz ejecutó toda la GUI en exclusiva. Los datos son sintéticos.

[Historia exacta](../stories/historia-sim1-simplificar-flujos-diseno-para-codex.md), SHA-256 `767ade59a0c705f37eab2d8e3ad805a402f44250dfe999a83d1f139e3e4dc446`. [Alcance y siete respuestas ADR 0021](../stories/sim-1a-alcance-adr-0021.md), primer commit `10a1279`, anterior a interfaz. SIM-1g abrió PR #184 antes de comenzar a; su posterior fusión se incorporó normalmente.

## Resultado e invariantes

Clic derecho en cabecera, ▾, Mayús+F10 y tecla de menú muestran el mismo renderer y lista. La raíz tiene el nombre real de columna sin cambiar sus mayúsculas ni añadir filas, separadores sin títulos de grupo y Eliminar columna al final en el color de peligro. Seis hojas quedan en Limpiar. Todo texto nuevo usa catálogo es/en y generación en-XA.

ContextMenu se reutiliza con un padre opcional: el hijo se coloca a derecha o izquierda, limita su posición a la ventana y conserva navegación por nivel. →/Intro abren el hijo; ←/Escape lo cierran y devuelven foco a Limpiar; Escape de raíz devuelve foco al origen; Tab y clic fuera cierran la cadena. Inicio/Fin y flechas operan sobre el menú activo. Los desactivados conservan motivos accesibles y guardas de activación. Los consumidores planos conservan su API. Referencia: [patrón APG de menú](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/).

`targetColumn`, `emptyTarget`, las definiciones, callbacks y guardas de `commands`, `runCommand`, `structuralContext` y `columnMenu` son idénticos a main. No cambian selección, motores, filas, bytes, historial, guardado, IPC, límites, dependencias, plazos o retries. CsvTable continúa en pendientes porque el archivo completo no se tradujo. La alineación general se hereda de g.

**El contexto de entrada se conserva intencionalmente.** Con Folio y Ciudad marcadas, clic derecho/teclado sobre Ciudad conserva `headerColumn` sin fijar `context.column`; ▾ fija `context.column=Ciudad` y mantiene ambas marcas. Por eso filtro, estadísticas y transformaciones de columna pueden estar desactivados en la primera entrada y disponibles en ▾, con sus motivos actuales. `emptyTarget` ya identifica Ciudad en ambas. Las pruebas comprueban listas iguales, marcas intactas y esos destinos distintos; no se restablecen marcas ni se amplían acciones.

## Las veinte acciones

| Acción anterior | Ruta actual, misma conducta |
| --- | --- |
| Ordenar columna ascendente (vista) | Raíz → Ordenar de menor a mayor |
| Ordenar columna descendente (vista) | Raíz → Ordenar de mayor a menor |
| Filtrar esta columna | Raíz → Filtrar esta columna |
| Ver filas vacías de la columna | Raíz → Ver filas vacías |
| Rellenar vacíos de la columna… | Limpiar → Rellenar vacíos… |
| Eliminar filas con vacío en la columna… | Limpiar → Eliminar filas con vacío… |
| Quitar filas duplicadas de la columna… | Limpiar → Quitar filas duplicadas… |
| Quitar espacios en la columna… | Limpiar → Quitar espacios… |
| Mayúsculas en la columna… | Limpiar → Mayúsculas… |
| Minúsculas en la columna… | Limpiar → Minúsculas… |
| Estadísticas de la columna | Raíz → Estadísticas de la columna |
| Insertar columna a la izquierda | Raíz → Insertar a la izquierda |
| Insertar columna a la derecha | Raíz → Insertar a la derecha |
| Duplicar columna seleccionada | Raíz → Duplicar columna |
| Calcular columna a la derecha | Raíz → Calcular columna a la derecha; conserva el callback contextual |
| Eliminar columna seleccionada | Raíz → Eliminar columna; último, peligro |
| Transformar documento… | Barra → Limpiar datos; su renombre pertenece a SIM-1b |
| Copiar como Markdown | Barra → Filas y columnas |
| Deshacer edición CSV | Barra superior → Deshacer; atajo existente |
| Rehacer edición CSV | Barra superior → Rehacer; atajo existente |

La aceptación recorre las veinte rutas sin alterar el documento. Las pruebas de acción existentes siguen comprobando cambios, vista previa, confirmación y un solo deshacer.

## Rojo y corrección reales

1. Producto base fd4 sin cambios: cinco casos SIM-1a fallan por lista antigua y ausencia del hijo/etiquetas. No fue un fallo de preparación. Spec exacta SHA-256 `30b54679dbb838dccc228fec5b2813bd06e18a16ded6354a85b5e4f797521ccd`; log conservado, ocho capturas previas completas.
2. Primer candidato `6f631cf`: 15/17 pasan. El título heredaba mayúsculas de dropdown-label y dos etiquetas en en-XA heredaban nowrap. Se conserva el fallo, sin convertirlo en verde ni relajar las aserciones.
3. Sonda temporal sobre el mismo producto: raíz 258/278 y submenú 258/302 px (client/scroll). Solo estilo de prueba con salto de línea deja ambos 258/258 a los dos tamaños, raíz 412.5 px de alto e hijo 211; Ciudad conserva su forma original. Se aplicó CSS local equivalente. La sonda fue retirada de tests y no cuenta como caso del PR.
4. `8a5c7ef`: cinco afectados pasan 5/5 en 7.7 s, sin reintentos. Después se integró main con g y se calificaron juntos consumidores y menús, según la tabla siguiente.

[Log curado con los fallos y resultados reales](sim1a-validacion-2026-11-18.txt) · [Pruebas, hashes y manifiesto de capturas](sim1a-prueba-validacion-2026-11-18.json).

## Migraciones, sin perder oráculos

Los nueve casos anteriores de column-menu se conservan; ocho casos SIM-1a nuevos se añaden en el mismo archivo (cinco de aceptación, dos de idiomas/capturas y uno de colores forzados). No se borra ningún caso ni se cambian grupos.

| Caso anterior | Cambio de acceso o presentación | Oráculo conservado |
| --- | --- | --- |
| Lista visible de cabecera | Nombres cortos, raíz/hijo y título exacto | Las diez hojas originales siguen visibles en su ruta |
| Enter, flechas y Escape | Misma raíz unificada | Primera acción, siguiente acción y retorno al botón |
| Mayúsculas | Ruta Limpiar | Alcance, 3/5 celdas, antes/después, original, bytes, dirty y un deshacer |
| Espacios y minúsculas | Ruta Limpiar; título ya no dice tres interacciones | 2/5 y 3/5 cambios, todas las filas y las otras dos columnas |
| Búsqueda activa | Ruta Limpiar | Solo una fila visible cambia; cuatro ocultas permanecen |
| Sin cambios | Ruta Limpiar | 0/3 y Aplicar desactivado |
| Filtrar esta columna | Igual etiqueta en raíz | Foco en filtro de Ciudad |
| Estadísticas de la columna | Igual etiqueta en raíz | Análisis y única marca de Ciudad |
| Duplicados | Ruta Limpiar | Transformación deduplicate, columna elegida, vista previa y dirty=false |

Las expectativas retiradas son exclusivamente de presentación que la historia cambia: limpieza plana, nombres largos, comillas decorativas del título y la frase tres interacciones. Se sustituyen por la jerarquía y el título real; no se retira ningún dato esperado.

- `structural-context`: selectores cortos. Se restauran como código las expresiones que estaban accidentalmente después de `//` en la misma línea: Escape/retorno de foco, orden descendente de vista, filas originales y dirty=false. **Cobertura restaurada**, no comprobaciones que ya se hubieran ejecutado en el baseline.
- `empty-values`: entrada por Limpiar y selectores localizados; conserva vistas previas, vacíos/filas cortas, datos, archivo, bytes, historial, límites y motivos de bloqueo. La paleta mantiene sus nombres anteriores y sus alias.
- `large-file`: distingue el padre Limpiar de sus seis hojas y comprueba cada bloqueo y motivo; las dos acciones de vista siguen disponibles.
- `menu-alignment`, ya en main por g: solo selectores localizados y etiqueta de evidencia Título de columna. La medición preexistente de dropdown-label incluía nombre y grupos; ahora mide el único título real. No se recrea un grupo ni se añade un caso para conservar cantidad. Range, umbral 0–12 px, teclado, archivo y capturas se mantienen.

## Validación por SHA, sin transferir verdes

| Fuente probada | Comprobación | Resultado real |
| --- | --- | --- |
| e1301a9 | Check y build Node24 | Correctos; 0 errores/avisos |
| e1301a9 | Unitarias completas, incluido CSV | 2961 aprobadas / 1 exclusiva de Windows omitida en este Mac; 165 archivos, 31.68 s |
| e1301a9 | Cuatro archivos editados más alineación g | 48/48 E2E, 1.2 min, cero reintentos |
| e1301a9 | Ocho archivos de consumidores, incluidos menús planos | 72/72 E2E, 2.3 min, cero reintentos |
| 43e9dbb | Check y build Node24 tras mover solo claves nuevas | Correctos; 0 errores/avisos |
| 43e9dbb | Unitarias de idiomas | 43/43 en 0.664 s |
| 43e9dbb | Dos casos es/en-XA de teclado y ocho capturas | 2/2 en 3.7 s, cero reintentos |

Los ocho consumidores son analysis-dock, large-filter, calculated-column, structure, csv-text, seg-csv-text, project-tree y project-source. Las 120 E2E incluyen cuatro entradas, veinte rutas, teclado por nivel, límites/flip/sin scroll, muestras, motivos, selección múltiple, colores forzados y consumidores planos. Se atribuyen a e130, no al head posterior.

El último cambio de producto solo reubica las 21 claves nuevas csv.columnMenu antes de csvText.menu, junto a las existentes de menús. Los mapas parseados completos son idénticos a e130, sin cambiar/eliminar valores existentes y conservando los bytes de las líneas de main; el árbol de tests es idéntico. Se evita volver a colisionar en la cola de los catálogos sin reordenar el archivo. La simulación de merge con estadísticas `0af73fa` terminó sin conflictos, árbol `7fa60c78de2cbe9e8bd59b45b3ca73b3470e9ddd`; no se aplicó ese merge al worktree ni se mezcla su entrega.

## Capturas

Antes: producto fd4. Después: código 43e9, que incluye main231 y su alineación global g; no se atribuye todo cambio respecto a fd4 únicamente a a. Las dieciséis imágenes se copian sin modificar sus bytes y se comprueban sus dimensiones.

| Idioma | Tema | Tamaño | Antes | Después |
| --- | --- | --- | --- | --- |
| es | claro | 1440×900 | [Antes](sim1a-before-es-light-1440x900.png) | [Después](sim1a-after-es-light-1440x900.png) |
| es | claro | 1280×720 | [Antes](sim1a-before-es-light-1280x720.png) | [Después](sim1a-after-es-light-1280x720.png) |
| es | oscuro | 1440×900 | [Antes](sim1a-before-es-dark-1440x900.png) | [Después](sim1a-after-es-dark-1440x900.png) |
| es | oscuro | 1280×720 | [Antes](sim1a-before-es-dark-1280x720.png) | [Después](sim1a-after-es-dark-1280x720.png) |
| en-XA | claro | 1440×900 | [Antes](sim1a-before-en-XA-light-1440x900.png) | [Después](sim1a-after-en-XA-light-1440x900.png) |
| en-XA | claro | 1280×720 | [Antes](sim1a-before-en-XA-light-1280x720.png) | [Después](sim1a-after-en-XA-light-1280x720.png) |
| en-XA | oscuro | 1440×900 | [Antes](sim1a-before-en-XA-dark-1440x900.png) | [Después](sim1a-after-en-XA-dark-1440x900.png) |
| en-XA | oscuro | 1280×720 | [Antes](sim1a-before-en-XA-dark-1280x720.png) | [Después](sim1a-after-en-XA-dark-1280x720.png) |

## Pendiente

CI, paquete y calificación de las plataformas del head final, sin transferir resultados de otros SHA. La suite local completa no se ejecutó para a; se declaran los 120 casos enfocados y la repetición posterior indicada. Intel no forma parte de CI de PR según la política vigente. No se probó instalación manual ni lector de pantalla físico. Sin push, PR nuevo, fusión, publicación o instalación en esta preparación; la raíz revisará el candidato antes de publicarlo.
