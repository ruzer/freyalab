# DW-03a — guardar y recuperar configuraciones

Base: `9f711ab00414fec50c3f0a79bf702b72d9f62861` del PR #31. Rama `codex/chart-presets`. Entrega dependiente de #29 → #30 → #31; sin fusión ni publicación automática. DW-01–DW-10 sigue abierto.

## Cambio mínimo

Biblioteca local nombrada, independiente del CSV y del origen file:// del renderer. Reutiliza `atomicWrite`, Zod, el compilador de condiciones, DuckDB y ECharts. Solo se extraen los esquemas de consulta existentes para evitar duplicar su validación. No incorpora dependencias ni otro motor.

Guardar captura opciones, encabezados exactos y filtros, sin filas, SQL arbitrario ni resultados. Recuperar requiere esquema idéntico; nombres vacíos/duplicados requieren reconocimiento posicional. La búsqueda y condiciones de la tabla se recuperan como alcance explícito, independiente de su vista actual. Aplicar invalida el resultado y requiere Generar; nunca modifica datos ni consulta por sí solo. La interfaz progresiva usa controles nativos accesibles por teclado.

El proceso principal valida y guarda en userData; el renderer no recibe rutas ni escritura arbitraria. Operaciones serializadas, escritura temporal/sync/reemplazo y hash del archivo leído. Solo ENOENT significa biblioteca vacía; daño, versiones desconocidas o límites excedidos bloquean escrituras y conservan el archivo. Límite 50 entradas/8 MiB. No se promete coordinación de editores externos simultáneos más allá del control de hash existente; la app de producción conserva instancia única.

## Validación

- Comprobación estática sin errores ni advertencias.
- Unitarias: 142 correctas en 17 archivos; persistencia entre instancias, filtros textuales exactos, colas concurrentes, error de disco simulado/reintento, límites y bibliotecas dañadas/futuras, tipos incompatibles, condiciones inválidas, claves no permitidas y encabezados.
- Dos E2E nuevas pasaron en Electron: guardado mediante controles, captura de vista A mientras la tabla cambia a B, suma/series independientes (`3 + 100 = 103` para U, `4` para V), reinicio y nueva consulta con los mismos resultados; archivo y estado del documento intactos. La referencia inicial se corrigió de 104 a 103 porque el filtro X > 2 excluye el primer valor de U; no se cambió el motor para ajustar el cálculo.
- IPC rechaza suma con medida textual; nombres incompatibles bloquean aplicar; encabezados duplicados requieren confirmación; una versión de biblioteca no reconocida se conserva tras refrescar y guardar.
- Capturas revisadas: [claro 1440×900](dw03a-presets-light-1440.png) y [oscuro 1280×800](dw03a-presets-dark-1280.png).
- Regresión completa final: **91 pruebas correctas**, sin reintentos, en 3,6 minutos, incluyendo build. Se ajustaron cinco selectores anteriores a coincidencia exacta: el nuevo campo de nombre también contenía «Configuración del gráfico». La suite anterior detectó cuatro ambigüedades y se repitió completa tras corregirlas. Registros: `/private/tmp/freya-presets-check.log`, `/private/tmp/freya-presets-unit.log`, `/private/tmp/freya-presets-acceptance.log`.
- Paquete, copia instalada y CI se registran por separado en el PR para el commit exacto.

## Límites

No incluye exportación de agregados, actualización de una entrada por el mismo nombre, remapeo de columnas, sincronización, portabilidad de presets ni undo de configuración. La eliminación se solicita mediante un botón explícito. Los valores de filtro y encabezados se guardan localmente; no se guardan filas. No certifica lectores de pantalla, usabilidad con participantes ni instalación manual multiplataforma.
