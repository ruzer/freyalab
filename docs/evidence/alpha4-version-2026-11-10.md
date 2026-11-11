# Alpha.4: versión de desarrollo aislada

La rama local `codex/alpha4-integracion` parte de la base recuperada `7eca50b` y prepara `0.1.0-alpha.4`. No cambia la rama del candidato alpha.3, no genera paquetes ni actualiza la app instalada.

Se actualizan únicamente las tres versiones raíz de `package.json` y `package-lock.json`. Las dependencias y sus versiones permanecen iguales.

La prueba de actualizaciones conserva el caso del candidato alpha.2 y añade el paso desde alpha.3. Ambos comprueban que una versión publicada más nueva se ofrece y que un borrador se ignora.

| Comprobación | Resultado real |
|---|---|
| Caso nuevo desde alpha.3 con los metadatos anteriores | Rojo: no encuentra una versión posterior cuando la versión empaquetada sigue siendo alpha.3. Salida 1. |
| `npx --no-install vitest run tests/updates.test.ts` después de actualizar a alpha.4 | 39/39 aprobadas, 10,28 s. Salida 0. |
| `git diff --check` | Sin errores. |

Las salidas se conservan en `/private/tmp/alpha4-version-rojo.log` y `/private/tmp/alpha4-version-verde.log`. No se añadieron omisiones ni reintentos.

No se repitieron las pruebas de interfaz ni el empaquetado para este cambio de metadatos. La integración de AN-1b necesita sus comprobaciones enfocadas y la validación completa del bloque. Alpha.4 todavía no tiene CI ni instaladores y no está preparada para publicarse.
