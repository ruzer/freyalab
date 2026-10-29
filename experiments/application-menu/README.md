# Comprobación de cierre del sistema

`os-close-draft.mjs` comprueba por separado cerrar la ventana (`close`) y Salir (`quit`) con una celda sin confirmar. Usa un perfil y CSV sintéticos; intercepta únicamente la confirmación existente para responder Cancelar. No lee ni escribe el portapapeles.

Es una prueba diagnóstica fuera del producto y de la suite regular. Un resultado rojo conserva JSON y salida antes de cerrar la instancia temporal. No debe presentarse el verde de Cerrar pestaña como evidencia de X/Salir. La implementación de un protocolo de cierre del sistema requiere coordinación: este experimento no lo añade.

Ejecutar desde la raíz del proyecto, tras construir, con Node 24:

```sh
node experiments/application-menu/os-close-draft.mjs close /tmp/freya-os-close.json
node experiments/application-menu/os-close-draft.mjs quit /tmp/freya-os-quit.json
```

Resultados reales del 29 de octubre: **rojo X (99219) y rojo Salir (19783)**, macOS arm64, build b605baf con WIP descrito en la evidencia APP-01. Ambos cerraron con dirtyBefore=false, cero confirmaciones y el original intacto: el borrador local no llegó al modelo. JSON en docs/evidence/app-01-os-close-2026-10-29.json y app-01-os-quit-2026-10-29.json. El contrato de preparación está propuesto fuera de Source, pendiente de autorización; estos probes todavía no tienen verde.
