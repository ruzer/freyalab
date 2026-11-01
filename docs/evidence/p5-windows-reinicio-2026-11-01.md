# P5 Windows tras relanzar · 2026-11-01

## Baseline y alcance

Mismo PR #102 y rama `codex/seg-s2`, partiendo de `7bdcd8946aa65377494866b6a8b61b378827d187`. Producto `src=81a03abb9bfe2c8ee027108297f727b0c3df4e9a`, idéntico a e7e7b4a. Sin cambios de dependencias, plazos, reintentos, workflows ni aserciones existentes; no fusionar ni salir de borrador.

Rojo real preservado: [CI279 Windows](https://github.com/ruzer/freyalab/actions/runs/41263604011), job124721680733. P5 recibió `documents()=[]` durante15000ms, tanto inicialmente como en retry1, al relanzar desde `preferences`. macOS y Linux pasaron. El artefacto original `evidence-windows-2025-1` tiene16472986bytes y SHA256 `5624d0a373467e578afe200733083716e83faa2a8178bd4f0a2785f54564af43`, comprobado al descargar. Conserva ambos `error-context.md` y `trace.zip`. No contenían la salida del proceso principal ni su evento de error de apertura.

## Primera etapa: diagnóstico, todavía sin atribuir causa

El ayudante de sidebar precarga un observador CJS mediante `-r`, conservando el entry real y sin tocar `src`:

- `p5-main-N.jsonl`: PID real, valor de `FREYALAB_TEST_OPEN`, stdout/stderr de Node y cada evento `freya:event/error` antes de reenviarlo, con stack del emisor. Permite distinguir el catch del bucle `initial` de otros errores.
- `p5-stdio-N.log`: salida de las tuberías del proceso lanzado tras obtener el handle de Playwright, incluidas advertencias nativas.
- `p5-lifecycle.jsonl`: solicitudes de arranque/cierre, PID principal y del proceso lanzador, eventos exit/close, estado de vida al volver de `quit()` y antes de arrancar la instancia siguiente. Windows usa `cmd.exe` en Playwright1.64.1; se registra también el PID principal, no sólo el shell.

La instrumentación no espera más tiempo, no reabre por IPC ni vuelve a intentar `openPaths`. El cierre original `app.exit` seguido de `app.close` permanece intacto en esta etapa. La hipótesis de instancia previa aún viva se medirá con estos eventos; no se presume cierta.

Cinco definiciones independientes del P5 de preferencias en Windows, cada una con su `beforeEach`, directorio/perfil nuevo y callback/aserciones originales íntegros. Primera definición conserva su nombre; las otras se nombran Windows2/5…5/5. macOS/Linux conservan una ejecución. Son cinco casos que deben aprobar todos, no cinco reintentos para conseguir uno verde. La configuración existente de retries no cambia y se informará cualquier retry real.

## Comprobaciones locales de la instrumentación

MacBook Pro M2 Max,32GB, Node24.22.1, Playwright1.64.1:

- `npm run build`: salida0, mismo producto base7bdcd89.
- P5 enfocado, `--workers=1 --retries=0`: 1/1,6.1s.
- Sidebar completo, `--workers=1 --retries=0`: 9/9,18.0s.
- Siete cierres/relanzamientos del P5 enfocado: PID principal ya muerto al volver de `quit()`, exitCode0; ninguna instancia previa viva al pedir el siguiente arranque. Sólo descarta el solapamiento observado en esa ejecución de Mac; no acredita Windows.

Salida y JSONL locales preservados en el archivo de recuperación de esta tarea. La causa y la corrección quedan pendientes del diagnóstico nativo Windows. El verde local no se atribuye al futuro SHA final ni se presenta como solución.
