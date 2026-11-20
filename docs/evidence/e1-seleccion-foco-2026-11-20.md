# E1: selección visible y control de foco real

Control local de macOS sobre `43913e2d846659100d932e9a676d8f6bb00d97c0`. No se realizó un cambio de producto E1. `markdown-selection.spec.ts` y `Editor.svelte` conservan exactamente sus bytes respecto de `8a002af72fd015db8457c67974ac10dbf37c0b1a`; sus SHA-256 y las huellas de los insumos privados se registran en [proof.json](e1-seleccion-foco-2026-11-20/proof.json).

| Fase local | Resultado | Reporte | Proceso | Reintentos |
| --- | --- | --- | --- | --- |
| Archivo original, sin modificar | 3/3 aprobados ordinarios | 8.988 s | 9.360 s | 0 |
| Copia privada con observación de foco real | 2/2 aprobados ordinarios | 5.014 s | 5.487 s | 0 |

Ambas fases terminaron con código 0, sin omisiones ni casos flaky. Los dos casos instrumentados coinciden con los casos claro/oscuro originales; las fases no suman cinco identidades distintas. El build utilizado terminó con código 0 en 2.586 s.

## Qué se observó

En el control instrumentado, las lecturas válidas de sesión inmediatamente antes y después registraron `lockedFlags: [false]` y `onConsoleFlags: [true]`. Con la emulación de foco CDP desactivada por el propio test, ambos temas partieron de ventana principal enfocada y `document.hasFocus() === true`. Después de la acción original que abre y enfoca la ventana auxiliar, la principal quedó sin foco, la auxiliar enfocada y `document.hasFocus() === false`.

La copia privada añadió únicamente lecturas de `BrowserWindow`/DOM, adjuntos escalares y dos precondiciones de foco. Conservó las instrucciones originales en su orden y no añadió activaciones ni solicitudes de foco. Los tres casos originales pasaron, incluidos los oráculos de selección y persistencia que alcanzan sus respectivos recorridos.

En el control histórico de main `8a002af`, los dos temas habían fallado en la aserción de pérdida de foco de la ventana principal: se esperaba `document.hasFocus() === false` y permanecía `true`. La sesión estaba bloqueada antes y después de esa ejecución. Este contexto y el control posterior desbloqueado no prueban una causa histórica única ni selección rota; no se atribuye el fallo a un defecto corregido por este trabajo.

## Recortes y contraste

Ocho recortes propios del fixture sintético «Hola mundo / Otra línea», copiados sin alterar sus bytes de la fase instrumentada. La imagen enfocada es idéntica por SHA a la selección por teclado que tiene la muestra de contraste. El estado sin selección sirve como referencia visual y no tiene ratio de selección asignado.

| Tema | Sin selección | Enfocada | Inactiva | Colores forzados |
| --- | --- | --- | --- | --- |
| Claro | [PNG](e1-seleccion-foco-2026-11-20/images/e1-light-before.png) | [PNG](e1-seleccion-foco-2026-11-20/images/e1-light-focused.png) | [PNG](e1-seleccion-foco-2026-11-20/images/e1-light-inactive.png) | [PNG](e1-seleccion-foco-2026-11-20/images/e1-light-forced-colors.png) |
| Oscuro | [PNG](e1-seleccion-foco-2026-11-20/images/e1-dark-before.png) | [PNG](e1-seleccion-foco-2026-11-20/images/e1-dark-focused.png) | [PNG](e1-seleccion-foco-2026-11-20/images/e1-dark-inactive.png) | [PNG](e1-seleccion-foco-2026-11-20/images/e1-dark-forced-colors.png) |

| Tema | Doble clic / arrastre / teclado | Inactiva | Colores forzados |
| --- | --- | --- | --- |
| Claro | 10.661:1 | 10.904:1 | 11.396:1 |
| Oscuro | 8.713:1 | 8.848:1 | 9.021:1 |

Los ratios anteriores proceden de las muestras RGB reales de los adjuntos de contraste; el JSON conserva valores sin redondear, dimensiones y SHA-256 de cada PNG. Son observaciones de esos estados, no una certificación general de accesibilidad.

## Reproducción y límites

Comando del archivo original, relativo al repositorio:

```sh
npx playwright test tests/e2e/markdown-selection.spec.ts --workers=1 --retries=0 --trace=on --reporter=list,json
```

La observación nativa fue una copia privada de los dos casos claro/oscuro, sin cambios en el archivo público ni en el producto. Este paquete no aporta validación nativa de Windows, una nueva suite completa, evidencia de CI ni una causa demostrada para todos los fallos históricos. Los logs completos permanecen privados; el manifiesto contiene sus huellas y solo datos saneados.
