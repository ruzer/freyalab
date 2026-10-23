# DW-03b — resultados exportables con contexto

Base: `036dcfa6d3a90090d797e7ee8aa80ece94035305` del PR #32. Rama `codex/chart-result-exports`. Se mantiene la secuencia #29 → #30 → #31 → #32. Sin fusión ni publicación automática. El objetivo DW-01–DW-10 sigue abierto.

## Decisiones y alcance

El usuario eligió CSV estándar + JSON de contexto. No se agregan dependencias ni runtime Python. La consulta utiliza el generador SQL existente con un límite parametrizado de 10 000 resultados; el dibujo conserva su límite anterior. Se reutilizan motor aislado, Arrow, paginación, validación de configuraciones/condiciones y revisión/cancelación. La exportación se prepara en main desde una configuración validada; no acepta filas ni contenido arbitrario del renderer.

JSON conserva strings/null, valores y metadatos. CSV usa el serializador instalado, protección de fórmulas visible/modificable y contexto con filas exactas/SHA-256. Markdown reutiliza literal/table, movidos a shared sin cambiar sus reexports ni consumidores existentes. El selector de destino y las protecciones existentes se comparten con los exportadores anteriores.

El límite de resultados es independiente del gráfico. Los totales parciales conservan el recuento real, incluyendo calendario/series. El motor mantiene presupuestos de lectura, 8 MiB de resultados y dos minutos; cada archivo serializado está limitado a 20 MiB. CSV/contexto requieren nombres nuevos, se reservan exclusivamente y se revierten ante fallos normales/cancelación si sus bytes siguen siendo nuestros. La pareja no es atómica ante caída: el contexto tiene la huella del CSV; nunca se sobrescribe una fuente ni un archivo previo.

## Evidencia local

- Tipos: cero errores ni advertencias. Unitarias: **154 correctas**, 18 archivos. Incluyen CSV/JSON/Markdown con ceros iniciales, identificadores largos, Unicode, nulo/vacío y fórmulas; límites; disco lleno en el segundo archivo, cancelación/reversión, archivos existentes y cambios externos conservados.
- Cuatro flujos nuevos de Electron comprobados: sumas por categoría/serie con 3 000 filas y exportación de 150 elementos cuando el gráfico muestra 100; filtros independientes, meses con huecos y calendario acotado a 10 000 con total real; archivo >50 MiB leído completo con un filtro sobre el último registro; cancelar durante lectura real de 100 000 filas y reintentar sin archivos parciales.
- El selector de serie del ensayo visual se corrigió para usar su etiqueta indexada sin asumir el orden de aparición; los tres flujos de API/cancelación ya pasaban. No se modificaron cálculos para ajustar el resultado esperado. La UI final pasó en 6,3 s.
- Capturas revisadas: [claro 1440×900](dw03b-results-light-1440.png) y [oscuro 1280×800](dw03b-results-dark-1280.png), con el aviso de colisión de nombres ejercitado en la prueba.
- Regresión completa: **95 pruebas correctas**, sin reintentos, 4,4 minutos, incluyendo build de producción. Registros: `/private/tmp/freya-results-check.log`, `/private/tmp/freya-results-unit.log`, `/private/tmp/freya-results-acceptance.log`.
- Paquete, copia instalada y CI se registran por separado en el PR del commit exacto.

## Límites pendientes

No se han certificado lectores de pantalla, pruebas de usabilidad con participantes ni instaladores manuales de las otras plataformas. La sugerencia del usuario de aprovechar Python se investigó sin cambiar la arquitectura; una posible sustitución del constructor requiere comparación con los prototipos existentes y demostración de una ventaja de UX. Este PR no adopta ni descarta nuevos motores por inercia.
