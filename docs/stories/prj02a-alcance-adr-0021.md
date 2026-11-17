# PRJ-02a · Alcance, reutilización e interfaces de prueba

Base `main a30988e`. PR en borrador, sin fusión, publicación ni actualización instalada. Historia original copiada con SHA-256 `8012a58ce476cb4aa3c2d8546c74224e5be5a4f34816d82c11481a91abb51050`. El propietario confirmó E0 §8 y cuatro aclaraciones de identidad, memoria, lectura futura y colación el 2026-11-16. El contrato matemático y sus vectores se registran antes de código del motor.

## Cambio mínimo completo

Crear, guardar, renombrar, eliminar y probar conjuntos desde fuentes registradas y la pestaña Proyecto. Se conservan ids y nombres únicos, cadenas sin ciclos hasta ocho niveles, columnas raíz y conflicto de manifiesto. La interfaz reutiliza condiciones y columnas de E1, muestra progreso/cancelación/cobertura y solo una vista previa de cien filas. «Analizar» queda para PRJ-02b.

No conviene fabricar un LargeIndex ni usar TableEngine.operation para arrancar este flujo: abrir/indexar la fuente haría una pasada completa previa incluso al pedir las primeras dos filas. El ejecutor reutiliza el escáner de registros y el analizador CSV estricto de I0 con un descriptor de lectura reducido. Main resuelve los ids a una fuente autorizada; el proceso de datos recibe esa lectura y pasos cerrados, nunca SQL. No se añade un segundo parser.

La excepción de lectura futura exige proteger explícitamente todas las mutaciones por `readonly`: hoy se basan en que un futuro carece de manifest. Se valida una proyección conocida, sin escribir ni perder campos desconocidos. Las fuentes abiertas se enlazan mediante ids de documentos, no por nombre ni concatenando rutas en renderer.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** I0 ya delimita y valida CSV en flujo; `compileTableQuery` resuelve filtros estrictos/Decimal/RE2; PRJ-01 resuelve fuente, identidad y escritura atómica. SplitMix64 y Algorithm R son algoritmos publicados. Falta su composición cerrada y la experiencia de conjuntos.
2. **Is there a skill we can reuse?** Cambio mínimo, rojo/verde y diagnóstico por reproducción. Las interfaces observables están fijadas por los criterios de la historia, sin probar miembros privados ni generar expectativas desde el motor.
3. **Can it be integrated through CLI, API, or MCP?** Mediante el puente validado y el worker existentes. Main recibe ids y pasos, resuelve la ruta autorizada y conserva cancelación. No se agrega CLI, MCP ni servicio a la aplicación.
4. **How mature, secure, and maintained is it?** Se mantienen versiones/licencias bloqueadas; csv-parse, Decimal y RE2JS existentes. El generador publicado es de dominio público y solo se integra su aritmética mínima. Sin red, comandos, expresiones o permisos generales.
5. **What maintenance cost does it add?** Un plan de ejecución acotado, la mutación de definiciones y un panel. Se evita duplicar escáner, parser, guardado o historial, y no se conecta todavía otro motor analítico.
6. **What is the minimum glue LAB must write?** En FreyaLab: resolver y validar cadenas, muestrear/seleccionar en flujo, transmitir cien ejemplos y recuentos, persistir definiciones y conectar los controles. LAB no cambia.
7. **Does writing our own code add value?** Sí: preserva ausentes y vacíos, fija semántica reproducible, rechaza planes no ejecutables con las garantías acordadas y explica cobertura. Una biblioteca que materialice todo o convierta tipos automáticamente no cumpliría el contrato.

## Interfaces ya acordadas por la historia

- Muestreo puro: vectores literales de palabras, depósito y porcentaje; incluidos semilla negativa, límites y rechazo sin sesgo.
- Ejecutor público de la operación: fixture de siete filas, cadena frente a pasos aplanados, cobertura, esquema, hash, presencia de campos, cancelación y planes no soportados.
- ProjectStore/registro a través de sus métodos públicos: persistencia, ids, nombres, dependientes, conflicto externo y futura versión sin escrituras.
- App real por el puente: teclado, paleta, estado, es/en/en-XA y capturas de panel/proyecto en claro/oscuro a 1440×900 y 1280×720.
- Sonda reproducible de 1 GB en Intel y ARM: primeras dos filas con bytes reales; depósito 10.000 en una pasada, tiempo y memoria máxima; cancelación sin archivos. No es una promesa universal de velocidad.

Por bloque, se guarda salida roja antes del cambio y se comprueba el comportamiento mínimo. Al cierre: check, unitarias completas, build y E2E; CI de tres plataformas y una corrida Intel completa sin retry #1. La condición de prioridad del propietario se vigila por separado: si la nocturna repite el fallo de gráficos empaquetados de main, se atiende antes.
