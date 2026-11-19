# Windows · Recuperación acotada de rename · Propuesta para PR borrador

Base `main 39c2000936f1b03c00daee45bc0a257132fb26ab`. Rama `codex/windows-guardado-rename`, preparada en un worktree privado, 2026-11-19. **Política V2, pruebas finales V3; adopción pendiente.** La preparación, validación y publicación de un PR borrador están autorizadas por el objetivo de estabilidad y corresponden a raíz; este trabajo documental no publica ni modifica PR194/195. La adopción final corresponde al propietario al revisar y fusionar.

En Windows se observó EPERM al renombrar un temporal durante Guardar. No se identificó quién bloqueó el destino ni se probó una causa relacionada con Undo. Esta propuesta conserva la señal del fallo persistente y no cambia reintentos ni plazos de CI.

## Contrato V2

El cambio compartido se limita a `atomicWrite()` en `src/main/files.ts`: recuperar únicamente cuando **expected es string**, la plataforma es win32, el código es EPERM y syscall es rename. Máximo tres intentos; pausas de 50 ms y 100 ms, 150 ms de espera programada sin contar I/O ni hashes y sin prometer latencia total. Al agotarse se propaga el error real sin envolverlo ni presentarlo como éxito.

Cada intento recuperado comprueba el mismo hash esperado original, después de la pausa y antes de rename. Si el destino cambia, se conserva el rechazo existente. El temporal se escribe y sincroniza una sola vez: no reconsumir AsyncIterable, reabrir la escritura ni transformar bytes por intento. Permisos, sync de directorio, limpieza y demás errores siguen igual.

`expected===undefined` mantiene un solo intento de rename, sin recuperación ni CAS nuevos. `expected===null` mantiene publicación exclusiva con link, sin reintentos. Otros sistemas, códigos y syscalls quedan excluidos.

El inventario tiene 20 call sites en nueve archivos. Ocho sitios pasan o admiten huella; los opcionales solo entran cuando aportan string. Los otros diez sin expected y los dos de creación exclusiva con null quedan fuera de la recuperación. No se afirma un bug demostrado en esos diez sitios ni se cambia su contrato.

## Siete respuestas del ADR 0021

1. **Herramienta existente:** atomicWrite, digest, temporal y rename/link ya resuelven escritura y conflicto; reutilizarlos en la rama con huella.
2. **Habilidad reutilizable:** rojo→verde y propuesta revisable con comprobaciones reales de bytes, error y limpieza; sin sustituir la revisión final.
3. **CLI/API/IPC:** sin cambios. No hay operación nueva ni configuración.
4. **Madurez, seguridad y licencia:** primitivas Node ya instaladas; sin dependencia nueva. Todo intento recuperado revalida huella. La ventana hash→rename sigue existiendo; no se promete un bloqueo atómico del destino.
5. **Coste:** hasta dos pausas acotadas y hashes adicionales solo para ese error de Windows con huella. Sin timer configurable, retry de CI ni plazo nuevo.
6. **Pegamento mínimo:** mismo bucle de rename y temporal, un predicado excluye undefined; null/link queda intacto. No modificar callers ni crear protección CAS donde no existía.
7. **Valor del código propio:** evaluar recuperación de una denegación transitoria del guardado protegido por hash, sin perder bytes, pisar un cambio externo ni ocultar un error persistente. No identifica al titular del bloqueo.

## TDD y verificaciones V2

V1 y sus logs/fuente/tests quedan inmutables en el paquete privado `v1`. Antes del único cambio de predicado se añadió el caso undefined: falló sobre V1 porque observaba tres llamadas cuando exigía una; las comprobaciones reales de bytes y limpieza ya pasaban. Los once casos no seleccionados de ese rojo filtrado no son omisiones de la suite final.

| Comprobación V2 | Resultado |
| --- | --- |
| Rojo nuevo sobre fuente V1 | 1 fallo, 11 casos no seleccionados; 276 ms Vitest |
| Nuevas pruebas y files.test.ts original | 17/17; 622 ms Vitest |
| Tipos | 0 errores/advertencias; 8.426 s de proceso |
| Unitarias completas, Pandoc real 3.12.1 | 168 archivos; 2984 aprobadas y 1 omitida; 15.75 s Vitest / 16.026 s de proceso |
| Build | Exit 0; 1.748 s de proceso |

Los tests usan I/O real para archivos, hashes, stream y limpieza. vi.mock envuelve rename y link con delegación real por omisión; solo se inyectan los fallos de rename y la escritura externa controlada. Link conserva I/O real y solo se cuentan sus llamadas. El descriptor de process.platform se cambia durante el caso y se restaura en afterEach. Se verifican consumo único, bytes exactos, error persistente, cambios externos antes de ambos reintentos y todas las exclusiones, ahora también undefined.

La simulación de Windows **no es validación nativa**. La validación V2 inicial precede al caso nativo preparado a continuación. En esa fase inicial V2 no se ejecutaron GUI, E2E completa, CI, commit, PR ni release. Raíz ejecutó después los controles GUI de compatibilidad macOS descritos en la [evidencia final](../evidence/windows-guardado-rename-2026-11-19.md); no califican recuperación Windows. No se mide el tiempo real de las pausas ni se crea un locker. La aceptación final y la calificación nativa siguen pendientes; los verdes no demuestran la causa del fallo histórico.

## Caso nativo separado: readonly transitorio del fixture

V2 de fuente y tests simulados quedó archivada antes de añadir `files-windows-rename-native.test.ts`. El caso se ejecuta solo en Windows real, sin sustituir process.platform ni fabricar un error. Su wrapper del primer rename pone readonly únicamente en el destino sintético ya creado en tmp, invoca rename REAL y captura su error REAL. El finally restaura el permiso original enmascarado a 0o777 antes de propagar el mismo error. No se añade chmod al producto.

Se exige EPERM/syscall rename, segundo intento real, mismo temporal, bytes LF exactos, permisos restaurados y limpieza. Si el kernel no da ese error, el caso falla; no se amplía la política para hacerlo pasar. Los tests simulados conservan el máximo de tres intentos. No se cambia ninguna aserción original de H13.

V3 final añade una sola salida saneada después de los oráculos del caso nativo: code/syscall reales de firstError y número de llamadas rename. No incluye rutas, mensajes de error ni contenido; solo se emitirá si el caso nativo se ejecuta y alcanza esos oráculos. No se ha observado esa salida en macOS porque el caso está omitido.

Comprobaciones locales repetidas sobre los tests finales:

| Comprobación | Resultado local macOS |
| --- | --- |
| Enfocadas | 17 aprobadas y 1 omitida nativa; 2 archivos aprobados y 1 omitido; 649 ms Vitest / 1.077 s proceso |
| Tipos | 0 errores/advertencias; 8.512 s de proceso |
| Unitarias completas, Pandoc real 3.12.1 | 2984 aprobadas y 2 omitidas; 168 archivos aprobados y 1 omitido, 169 en total; 15.72 s Vitest / 16.010 s proceso |
| Build | Exit 0; 1.733 s de proceso |

Las dos omisiones locales son el caso Windows-only ya existente y este caso nativo nuevo. **La omisión no valida Windows.** La calibración real queda pendiente de Windows CI en el futuro borrador; readonly es un fixture controlado y no se presenta como causa del fallo histórico. No hay PowerShell, helpers CLI, dependencias, caps, timers de prueba o workflows nuevos.
